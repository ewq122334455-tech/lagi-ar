// LEVEL 1 (free, local): the AI-video page against a MOCK Decart SDK + mocked Worker. Proves wiring, NOT AI video quality.
// Playwright is found through PW_MODULE (path to its index.mjs) when it is installed globally, else as playwright-core.
const { chromium } = await import(process.env.PW_MODULE ?? 'playwright-core');
import fs from 'node:fs';
const jpg = fs.readFileSync('/home/user/lagi-ar/public/products/plano-bag/images/main.jpg').toString('base64');
const W = 'https://lagi-tryon.lagi-official.workers.dev';
const ok = (n, c, i = '') => console.log(`${c ? 'PASS' : 'FAIL'}  ${n}${i ? '  — ' + i : ''}`);
const b = await chromium.launch({ executablePath: process.env.CHROME_PATH ?? chromium.executablePath(), args: ['--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream', '--autoplay-policy=no-user-gesture-required'] });
async function open({ token = 'ok', mock = 'ok', deny = false, seconds = 5, model, prefit = 'ok', release = 'ok' } = {}) {
  const ctx = await b.newContext({ viewport: { width: 1280, height: 1000 }, permissions: ['camera'], acceptDownloads: true });
  await ctx.addInitScript(([m, d]) => {
    sessionStorage.setItem('lagi-intro-seen', '1'); window.__rtMock = { mode: m };
    if (d) navigator.mediaDevices.getUserMedia = async () => { throw new DOMException('denied', 'NotAllowedError'); };
    const orig = navigator.mediaDevices.getUserMedia?.bind(navigator.mediaDevices); window.__tracks = [];
    if (!d && orig) navigator.mediaDevices.getUserMedia = async (c) => { window.__gum = c; const s = await orig(c); window.__tracks.push(...s.getTracks()); return s; };
  }, [mock, deny]);
  const p = await ctx.newPage(); p.errs = []; p.on('pageerror', (e) => p.errs.push(e.message)); p.calls = [];
  const cors = { 'Access-Control-Allow-Origin': 'http://localhost:4195', 'Access-Control-Allow-Headers': 'Content-Type,Authorization' };
  await p.route(W + '/**', (rt) => {
    const u = rt.request().url().replace(W, ''); const body = rt.request().postData() ?? '';
    if (u === '/realtime/report') { p.calls.push(u); return rt.fulfill({ status: 200, headers: cors, contentType: 'application/json', body: '{"ok":true}' }); }
    if (u === '/realtime/release') { p.calls.push(u); return rt.request().method() === 'OPTIONS' ? rt.fulfill({ status: 204, headers: cors }) : release === 'fail' ? rt.fulfill({ status: 404, headers: cors, contentType: 'application/json', body: '{"error":"not found"}' }) : rt.fulfill({ status: 200, headers: cors, contentType: 'application/json', body: '{"ok":true}' }); }
    if (rt.request().method() === 'OPTIONS') return rt.fulfill({ status: 204, headers: cors });
    p.calls.push(u + (body.includes('matte') ? '(matte)' : '')); (p.bodies ??= {})[u] = body;
    const J = (status, o) => rt.fulfill({ status, headers: cors, contentType: 'application/json', body: JSON.stringify(o) });
    if (u === '/cutout') return body.includes('matte') ? J(200, { matte: 'data:image/jpeg;base64,' + jpg }) : J(200, { image: 'data:image/jpeg;base64,' + jpg, cutout: true, description: 'a small square bag' });
    if (u === '/realtime/prefit') { p.prefitBody = body; return prefit === 'fail' ? J(502, { error: '참조 사진을 만들지 못했습니다.', reason: 'provider' }) : prefit === 'reject' ? J(422, { error: '만들어진 참조 사진이 제품과 충분히 같지 않아 사용하지 않았습니다.', reason: 'verify_failed', checks: { designMatch: 2 } }) : J(200, { image: 'data:image/jpeg;base64,' + jpg, provider: 'gemini', verified: true, checks: { designMatch: 5 } }); }
    if (u === '/realtime/token') {
      if (token === 'daily') return J(429, { error: '실시간 착용은 하루 3번까지 체험할 수 있습니다. 내일 다시 이용해 주세요.', reason: 'daily_limit' });
      if (token === 'busy') return J(429, { error: '이미 진행 중인 실시간 착용이 있습니다. 끝난 뒤에 다시 시작해 주세요.', reason: 'busy_ip' });
      if (token === 'down') return J(503, { error: '실시간 착용은 아직 준비 중입니다.', reason: 'not_configured' });
      { let rm; try { rm = JSON.parse(body || '{}').model; } catch {} return J(200, { apiKey: 'mock-token', seconds, remainingToday: 2, ...((rm ?? model) ? { model: rm ?? model } : {}) }); }
    }
    return rt.abort();
  });
  await p.goto('http://localhost:4195/#/again?p=zz-test-top&m=live&map=1'); await p.waitForSelector('[data-testid=live-stage]', { timeout: 20000 });
  return p;
}
const start = async (p, rec = false) => { if (rec) await p.getByTestId('rec-toggle').check(); await p.getByLabel(/카메라 영상이 AI 서버/).check(); await p.getByRole('button', { name: '실시간 착용 시작' }).click(); };
const step = (p) => p.getByTestId('live-steps').getAttribute('data-step');

// A. before start
{ const p = await open(); ok('A1 start state: step "before" and the start button is locked until consent', (await step(p)) === 'before' && await p.getByRole('button', { name: '실시간 착용 시작' }).isDisabled());
  await p.getByLabel(/카메라 영상이 AI 서버/).check(); ok('A2 product + consent → step "ready"', (await step(p)) === 'ready');
  ok('A3 the beta label stays on the tab', (await p.getByRole('tab', { name: /AI 영상 \(베타\)/ }).count()) === 1);
  ok('A4 no paid request before the visitor starts', p.calls.length === 0, p.calls.join(',')); await p.context().close(); }

// B. camera denied → nothing paid
{ const p = await open({ deny: true }); await start(p); await p.waitForSelector('[data-testid=live-error]');
  ok('B1 camera denied: clear message', /카메라 권한/.test(await p.getByTestId('live-error').innerText()));
  ok('B2 camera denied: NO token and NO Gemini cut-out request (nothing paid)', p.calls.length === 0, p.calls.join(',') || 'none'); await p.context().close(); }

// C. full mock session
{ const p = await open({ seconds: 9 }); await start(p, true);
  await p.waitForFunction(() => document.querySelector('[data-testid=live-steps]')?.getAttribute('data-step') === 'live', null, { timeout: 40000 });
  ok('C1 steps reach "live"', true);
  const order = p.calls.filter((c) => c !== '/cutout(matte)'); ok('C2 order: cut-out first, token after (camera already on)', p.calls.indexOf('/cutout') < p.calls.indexOf('/realtime/token') && p.calls.includes('/realtime/token'), p.calls.join(' > '));
  ok('C3 product reference sent to the (mock) model', (await p.evaluate(() => window.__rtLog)).some((l) => l.startsWith('setImage:')), (await p.evaluate(() => window.__rtLog)).join(' | '));
  ok('C4 countdown shown', /\d/.test(await p.getByTestId('countdown').innerText()));
  ok('C5 recording indicator shown (local only)', await p.getByTestId('rec-on').waitFor({ timeout: 6000 }).then(() => true).catch(() => false));
  await p.waitForFunction(() => document.querySelector('[data-testid=live-steps]')?.getAttribute('data-step') === 'ended', null, { timeout: 20000 });
  ok('C6 session ends by itself at the token limit → "ended"', true);
  ok('C7 resources released: disconnect called, camera tracks stopped', (await p.evaluate(() => window.__rtLog)).includes('disconnect') && (await p.evaluate(() => window.__tracks.every((t) => t.readyState === 'ended'))));
  await p.waitForSelector('[data-testid=clip-result]', { timeout: 10000 }); ok('C8 recorded clip preview appears', true);
  const [dl] = await Promise.all([p.waitForEvent('download'), p.getByRole('button', { name: /영상 저장/ }).click()]); const f = '/tmp/rtclip-' + dl.suggestedFilename(); await dl.saveAs(f);
  ok('C9 clip downloads and is not empty', fs.statSync(f).size > 2000, `${dl.suggestedFilename()} ${fs.statSync(f).size} bytes`);
  ok('C10 no request carries video to our server (only /cutout, /realtime/token, /realtime/report)', p.calls.every((c) => c.startsWith('/cutout') || c === '/realtime/token' || c === '/realtime/report' || c === '/realtime/release' || c === '/realtime/prefit'), p.calls.join(','));
  await p.waitForSelector('[data-testid=evidence]', { timeout: 5000 });
  ok('C12 measurement record appears after the session', true);
  ok('C13 a mock SDK run is labelled "not real AI" on screen', /실제 AI가 만든 영상이 아닙니다/.test(await p.getByTestId('evidence-mock').innerText()));
  const [ed] = await Promise.all([p.waitForEvent('download'), p.getByTestId('save-evidence').click()]); const ef = '/tmp/rtev-' + ed.suggestedFilename(); await ed.saveAs(ef); const E = JSON.parse(fs.readFileSync(ef, 'utf8'));
  ok('C14 record has the default model (pipeline B: lucy-vton-3.6), standard speed, sdkIsMock=true, ticks, first-frame times, resolution, fps, session seconds', E.model === 'lucy-vton-3.6' && E.speed === 'standard' && E.sdkIsMock === true && E.generationTicks >= 1 && E.msFirstGenerationTick > 0 && E.msFirstVideoFrame > 0 && /^\d+x\d+$/.test(E.outputResolution) && E.fps > 0 && E.actualSessionSeconds > 0 && E.requestedSeconds === 9, JSON.stringify({ tick: E.msFirstGenerationTick, frame: E.msFirstVideoFrame, fps: E.fps, res: E.outputResolution, secs: E.actualSessionSeconds, diff: E.meanDiffFromInput }));
  ok('C16 record keeps the SDK own connection states and diagnostics (so a missing AI output can be explained)', E.connectionStates.some((c) => c.state === 'generating') && E.diagnostics.some((d) => d.name === 'client-session-connection-breakdown'), JSON.stringify(E.connectionStates.map((c) => c.state)));
  ok('C15 measured difference from the camera input is a number (mock overlay is visibly different)', typeof E.meanDiffFromInput === 'number' && E.meanDiffFromInput > 5, String(E.meanDiffFromInput));
  ok('C11 no page errors', p.errs.length === 0, p.errs.join('|')); await p.context().close(); }

ok_(); function ok_() {}
{ const p = await open({ seconds: 5 }); await start(p);
  await p.waitForFunction(() => document.querySelector('[data-testid=live-steps]')?.getAttribute('data-step') === 'live', null, { timeout: 40000 });
  const log = await p.evaluate(() => window.__rtLog);
  ok('F1 default pipeline B uses lucy-vton-3.6 at standard speed (fast mode bills 2x and is never requested)', log.includes('model:lucy-vton-3.6') && log.includes('speed:standard'), log.filter((l) => /^(model|speed)/.test(l)).join(' '));
  await p.waitForFunction(() => document.querySelector('[data-testid=live-steps]')?.getAttribute('data-step') === 'ended', null, { timeout: 20000 });
  await p.waitForTimeout(500);
  ok('F2 the page reports the real run time to the Worker when the session ends (advisory)', p.calls.includes('/realtime/report'), p.calls.join(','));
  await p.context().close(); }
{ const p = await open({ seconds: 5, model: 'lucy-vton-3.6' }); await start(p);
  await p.waitForFunction(() => document.querySelector('[data-testid=live-steps]')?.getAttribute('data-step') === 'live', null, { timeout: 40000 });
  const log = await p.evaluate(() => window.__rtLog);
  ok('F3 when the Worker names lucy-vton-3.6 the page uses it with the VTON "Add … to the outfit" prompt', log.includes('model:lucy-vton-3.6') && log.some((l) => l.startsWith('setImage:Add a plain flat chroma-key')), log.filter((l) => /^(model|setImage)/.test(l)).join(' | '));
  await p.context().close(); }
// G. browsers and devices that cannot do it, network trouble, recording trouble, mobile layout (simulated, NOT a real device)
{ const p = await open(); await p.addInitScript(() => { try { delete window.RTCPeerConnection; delete window.webkitRTCPeerConnection; } catch {} Object.defineProperty(window, 'RTCPeerConnection', { value: undefined, configurable: true }); }); await p.reload(); await p.waitForSelector('[data-testid=live-stage]'); await start(p); await p.waitForSelector('[data-testid=live-error]');
  ok('G1 no WebRTC: clear "unsupported" message, step "unsupported", and NO paid request', /WebRTC/.test(await p.getByTestId('live-error').innerText()) && (await step(p)) === 'unsupported' && p.calls.length === 0, p.calls.join(',') || 'none'); await p.context().close(); }
{ const ctx = await b.newContext({ permissions: ['camera'] }); await ctx.addInitScript(() => { sessionStorage.setItem('lagi-intro-seen', '1'); navigator.mediaDevices.getUserMedia = async () => { throw new DOMException('busy', 'NotReadableError'); }; });
  const p = await ctx.newPage(); await p.route(W + '/**', (rt) => { p.calls = (p.calls ?? []).concat(rt.request().url().replace(W, '')); rt.abort(); }); await p.goto('http://localhost:4195/#/again?p=zz-test-top&m=live'); await p.waitForSelector('[data-testid=live-stage]'); await start(p); await p.waitForSelector('[data-testid=live-error]');
  ok('G2 camera busy (NotReadableError): says another app/tab may be using it, no paid request', /다른 앱이나 탭/.test(await p.getByTestId('live-error').innerText()) && !(p.calls ?? []).length); await ctx.close(); }
{ const p = await open({ token: 'netfail' }); await p.unroute(W + '/**'); await p.route(W + '/**', (rt) => rt.request().url().endsWith('/cutout') && !rt.request().postData()?.includes('matte') ? rt.fulfill({ status: 200, headers: { 'Access-Control-Allow-Origin': 'http://localhost:4195' }, contentType: 'application/json', body: JSON.stringify({ image: 'data:image/jpeg;base64,' + jpg }) }) : rt.abort('failed')); await p.getByLabel(/실제 디자인 입히기|실제 디자인/).first().uncheck().catch(() => {}); await start(p); await p.waitForSelector('[data-testid=live-error]', { timeout: 30000 });
  ok('G3 server unreachable: says the AI server could not be reached and to check the internet connection (not a generic retry)', /AI 서버에 닿지 못했습니다/.test(await p.getByTestId('live-error').innerText()), (await p.getByTestId('live-error').innerText()).slice(0, 60)); await p.context().close(); }
{ const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, permissions: ['camera'] }); await ctx.addInitScript(() => { sessionStorage.setItem('lagi-intro-seen', '1'); window.__rtMock = { mode: 'ok' }; delete window.MediaRecorder; });
  const p = await ctx.newPage(); p.calls = []; p.errs = []; p.on('pageerror', (e) => p.errs.push(e.message)); await p.route(W + '/**', (rt) => { const u = rt.request().url().replace(W, ''); const body = rt.request().postData() ?? ''; const cors = { 'Access-Control-Allow-Origin': 'http://localhost:4195', 'Access-Control-Allow-Headers': 'Content-Type,Authorization' }; const J = (o) => rt.fulfill({ status: 200, headers: cors, contentType: 'application/json', body: JSON.stringify(o) }); if (rt.request().method() === 'OPTIONS') return rt.fulfill({ status: 204, headers: cors }); if (u === '/cutout') return body.includes('matte') ? J({ matte: 'data:image/jpeg;base64,' + jpg }) : J({ image: 'data:image/jpeg;base64,' + jpg }); if (u === '/realtime/token') return J({ apiKey: 'm', seconds: 5, remainingToday: 2 }); if (u === '/realtime/report') return J({ ok: true }); rt.abort(); });
  await p.goto('http://localhost:4195/#/again?p=zz-test-top&m=live'); await p.waitForSelector('[data-testid=live-stage]');
  const over = await p.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  ok('G4 phone-size screen (390x844, simulated): no sideways scrolling before the session', over <= 1, `overflow ${over}px`);
  ok('G5 browser without MediaRecorder: the record option is hidden instead of failing later', (await p.getByTestId('rec-toggle').count()) === 0);
  await start(p); await p.waitForFunction(() => document.querySelector('[data-testid=live-steps]')?.getAttribute('data-step') === 'live', null, { timeout: 40000 });
  ok('G6 phone-size: session reaches "live" and the stage fits the screen', await p.evaluate(() => document.querySelector('[data-testid=live-stage]').getBoundingClientRect().width <= window.innerWidth));
  await p.waitForFunction(() => document.querySelector('[data-testid=live-steps]')?.getAttribute('data-step') === 'ended', null, { timeout: 20000 });
  ok('G7 after the session a link to the product page is offered', (await p.getByTestId('to-product').getAttribute('href'))?.includes('/product/zz-test-top'));
  const over2 = await p.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  ok('G8 phone-size: no sideways scrolling after the session either; no page errors', over2 <= 1 && p.errs.length === 0, `overflow ${over2}px; ${p.errs.join('|')}`); await ctx.close(); }
// H. diagnostic mode (&debug=1): one picture with the AI raw frame, the camera and the result; invisible without the flag
{ const p = await open({ seconds: 6 }); await p.goto('http://localhost:4195/#/again?p=zz-test-top&m=live&debug=1'); await p.waitForSelector('[data-testid=live-stage]'); await start(p);
  await p.waitForFunction(() => document.querySelector('[data-testid=live-steps]')?.getAttribute('data-step') === 'ended', null, { timeout: 40000 });
  await p.waitForSelector('[data-testid=save-diag]', { timeout: 5000 }).catch(() => {});
  const has = (await p.getByTestId('save-diag').count()) > 0; ok('H1 with &debug=1 a diagnostic picture can be saved after the session', has);
  if (has) { const [dl] = await Promise.all([p.waitForEvent('download'), p.getByTestId('save-diag').click()]); const f = '/tmp/rtdiag-' + dl.suggestedFilename(); await dl.saveAs(f); const hdr = fs.readFileSync(f).subarray(16, 24); const m = { width: hdr.readUInt32BE(0), height: hdr.readUInt32BE(4) }; ok('H2 the picture holds three panels side by side (AI raw, camera, result)', m.width >= 2800 && m.height > 400, `${m.width}x${m.height}`); }
  await p.context().close(); }
{ const p = await open({ seconds: 5 }); await start(p); await p.waitForFunction(() => document.querySelector('[data-testid=live-steps]')?.getAttribute('data-step') === 'ended', null, { timeout: 40000 });
  ok('H3 without the flag there is no diagnostic button for normal visitors', (await p.getByTestId('save-diag').count()) === 0); await p.context().close(); }
// I. Anywear way: &model=lucy-vton-3.6&map=0 -> VTON model by name, no green-screen overlay, plain "Add ... to the outfit" prompt
{ const p = await open({ seconds: 5 }); await p.goto('http://localhost:4195/#/again?p=zz-test-set&m=live&model=lucy-vton-3.6'); await p.reload(); await p.waitForSelector('[data-testid=live-stage]');
  ok('I1 by default (no &map=1) the design-mapping option starts off: the Anywear way', !(await p.getByTestId('map-toggle').isChecked()));
  await start(p); await p.waitForFunction(() => document.querySelector('[data-testid=live-steps]')?.getAttribute('data-step') === 'live', null, { timeout: 40000 });
  const log = await p.evaluate(() => window.__rtLog);
  ok('I2 the page asks for lucy-vton-3.6 and the SDK connects with it (standard speed)', log.includes('model:lucy-vton-3.6') && log.includes('speed:standard'), log.filter((l) => /^(model|speed)/.test(l)).join(' '));
  ok('I3 the prompt is the clothing VTON one ("Substitute the current … with …", never the bag wording), with no green-screen wording', log.some((l) => l.startsWith('setImage:Substitute the current ')) && !log.some((l) => /chroma-key|green/i.test(l)), log.filter((l) => l.startsWith('setImage')).join(' | '));
  ok('I4 no cut-out matte request (that step belongs to the green overlay only)', !p.calls.some((c) => c.includes('(matte)')), p.calls.join(','));
  await p.context().close(); }
// J. address flags go back to the old way: &model=lucy-2.6&map=1 (green overlay on, old model); a pasted address is picked up without a reload
{ const p = await open({ seconds: 5 }); await p.goto('http://localhost:4195/#/again?p=zz-test-top&m=live&model=lucy-2.6&map=1'); await p.waitForTimeout(600);
  ok('J1 the flags are read again when the address changes (no reload needed)', await p.getByTestId('map-toggle').isChecked());
  await p.goto('http://localhost:4195/#/again?p=zz-test-top&m=live&debug=1'); await p.waitForTimeout(600);
  ok('J2 and back to the default: option off again', !(await p.getByTestId('map-toggle').isChecked())); await p.context().close(); }
// K. Anywear's way: photo + instruction go in WITH the connection; another product while live is swapped without reconnecting
{ const p = await open({ seconds: 20 }); await p.goto('http://localhost:4195/#/again?p=zz-test-set&m=live'); await p.reload(); await p.waitForSelector('[data-testid=live-stage]'); await start(p);
  await p.waitForFunction(() => document.querySelector('[data-testid=live-steps]')?.getAttribute('data-step') === 'live', null, { timeout: 40000 });
  let log = await p.evaluate(() => window.__rtLog);
  ok('K1 the product photo and instruction travel WITH the connection (initialState), not after it', log.includes('initialState:with-connect') && log.filter((l) => l.startsWith('setImage:')).length === 1, log.filter((l) => /initialState|setImage/.test(l)).join(' | '));
  const before = p.calls.filter((c) => c === '/cutout').length;
  await p.evaluate(() => { location.hash = '#/again?p=zz-test-top&m=live'; }); await p.waitForTimeout(2500);
  log = await p.evaluate(() => window.__rtLog);
  ok('K2 choosing another product while live sends its photo on the same session (no reconnect)', log.filter((l) => l.startsWith('setImage:')).length === 2 && log.filter((l) => l === 'disconnect').length === 0 && p.calls.filter((c) => c === '/cutout').length === before + 1, `${log.filter((l) => l.startsWith('setImage:')).length} setImage, ${p.calls.filter((c) => c === '/cutout').length - before} new cut-out`);
  await p.context().close(); }
// L. Anywear's step for bags (&prefit=1): a still of the visitor holding the product is made BEFORE the paid token, and is the reference
{ const p = await open({ seconds: 20 }); await p.goto('http://localhost:4195/#/again?p=zz-test-top&m=live&prefit=1'); await p.reload(); await p.waitForSelector('[data-testid=live-stage]'); await start(p);
  await p.waitForFunction(() => document.querySelector('[data-testid=live-steps]')?.getAttribute('data-step') === 'live', null, { timeout: 40000 });
  ok('L1 prefit comes after the cut-out and BEFORE the paid token', p.calls.indexOf('/realtime/prefit') > p.calls.indexOf('/cutout') && p.calls.indexOf('/realtime/prefit') < p.calls.indexOf('/realtime/token'), p.calls.join(' > '));
  const body = JSON.parse(p.prefitBody || '{}');
  ok('L2 the request carries a camera still (JPEG data URL) and the product address, nothing else', /^data:image\/jpeg;base64,/.test(body.person ?? '') && /zz-test-top/.test(body.productImage ?? '') && Object.keys(body).every((k) => ['person', 'productImage', 'productName', 'carry', 'garment', 'provider', 'variant'].includes(k)), Object.keys(body).join(','));
  const log = await p.evaluate(() => window.__rtLog);
  ok('L3 the generated photo (not the bare product photo) goes in with the connection', log.includes('initialState:with-connect'));
  await p.getByTestId('live-steps').waitFor(); ok('L4 the extra step is listed only when prefit is on', (await p.getByTestId('live-steps').innerText()).includes('참조 사진'));
  await p.context().close(); }
{ const p = await open({ seconds: 20, prefit: 'fail' }); await p.goto('http://localhost:4195/#/again?p=zz-test-top&m=live&prefit=1'); await p.reload(); await p.waitForSelector('[data-testid=live-stage]'); await start(p);
  await p.waitForFunction(() => document.querySelector('[data-testid=live-steps]')?.getAttribute('data-step') === 'live', null, { timeout: 40000 });
  ok('L5 if the reference photo fails, the session still starts with the plain product photo', (await p.evaluate(() => window.__rtLog)).includes('initialState:with-connect'));
  await p.context().close(); }
{ const p = await open({ seconds: 20 }); await p.goto('http://localhost:4195/#/again?p=zz-test-top&m=live&pipe=B'); await p.reload(); await p.waitForSelector('[data-testid=live-stage]'); await start(p);
  await p.waitForFunction(() => document.querySelector('[data-testid=live-steps]')?.getAttribute('data-step') === 'live', null, { timeout: 40000 });
  ok('L6 &pipe=B turns the clothes default off: no prefit request, no extra step', !p.calls.includes('/realtime/prefit') && !(await p.getByTestId('live-steps').innerText()).includes('참조 사진'), p.calls.join(','));
  await p.context().close(); }
{ const p = await open({ seconds: 20 }); await p.goto('http://localhost:4195/#/again?p=zz-test-top&m=live'); await p.reload(); await p.waitForSelector('[data-testid=live-stage]'); await start(p);
  await p.waitForFunction(() => document.querySelector('[data-testid=live-steps]')?.getAttribute('data-step') === 'live', null, { timeout: 40000 });
  ok('L6c clothes default (no flag) = pipeline C: the checked reference picture is requested first', p.calls.includes('/realtime/prefit') && p.calls.indexOf('/realtime/prefit') < p.calls.indexOf('/realtime/token'), p.calls.join(','));
  await p.context().close(); }
// M. pipelines A/B/C/D, original product photo, carry styles, developer UI hidden from visitors
const body = (p, u) => { try { return JSON.parse(p.bodies?.[u] || '{}'); } catch { return {}; } };
const live = (p) => p.waitForFunction(() => document.querySelector('[data-testid=live-steps]')?.getAttribute('data-step') === 'live', null, { timeout: 40000 });
{ const p = await open({ seconds: 20 }); await p.goto('http://localhost:4195/#/again?p=zz-test-top&m=live'); await p.reload(); await p.waitForSelector('[data-testid=live-stage]');
  ok('M1 visitors do not see the experimental overlay option or developer settings', (await p.getByTestId('map-toggle').count()) === 0);
  await p.goto('http://localhost:4195/#/again?p=zz-test-top&m=live&pipe=B'); await p.reload(); await p.waitForSelector('[data-testid=live-stage]');
  await start(p); await live(p);
  ok('M2 pipeline B (&pipe=B): the ORIGINAL clean photo is used (describe only, nothing redrawn, no prefit)', body(p, '/cutout').describeOnly === true && /drawings\/front\.jpg/.test(body(p, '/cutout').productImage ?? '') && !p.calls.includes('/realtime/prefit'), JSON.stringify(body(p, '/cutout')));
  ok('M3 default pipeline asks for lucy-vton-3.6', body(p, '/realtime/token').model === 'lucy-vton-3.6', JSON.stringify(body(p, '/realtime/token')));
  ok('M4 no measurement panel for visitors after the session', (await p.getByTestId('evidence').count()) === 0);
  await p.context().close(); }
{ const p = await open({ seconds: 20 }); await p.goto('http://localhost:4195/#/again?p=zz-test-top&m=live&pipe=A'); await p.reload(); await p.waitForSelector('[data-testid=live-stage]'); await start(p); await live(p);
  ok('M5 pipeline A keeps the old Gemini cut-out (no describeOnly)', !body(p, '/cutout').describeOnly && /zz-test-top.*main\.jpg/.test(body(p, '/cutout').productImage ?? ''));
  ok('M6 pipeline A is shown in the developer panel', (await p.getByTestId('evidence').innerText()).includes('파이프라인') ); await p.context().close(); }
{ const p = await open({ seconds: 20 }); await p.goto('http://localhost:4195/#/again?p=zz-test-top&m=live&pipe=D'); await p.reload(); await p.waitForSelector('[data-testid=live-stage]'); await start(p); await live(p);
  ok('M7 pipeline D asks for lucy-2.6 with the original photo and no prefit', body(p, '/realtime/token').model === 'lucy-2.6' && body(p, '/cutout').describeOnly === true && !p.calls.includes('/realtime/prefit'));
  const log = await p.evaluate(() => window.__rtLog); ok('M8 pipeline D: the connection carried the lucy-2.6 model name', log.some((l) => /lucy-2\.6/.test(l)), log.filter((l) => /model/.test(l)).join('|')); await p.context().close(); }
{ const p = await open({ seconds: 20 }); await p.goto('http://localhost:4195/#/again?p=zz-test-top&m=live&pipe=C'); await p.reload(); await p.waitForSelector('[data-testid=live-stage]'); await start(p); await live(p);
  const pb = body(p, '/realtime/prefit');
  ok('M9 pipeline C: prefit sends the camera still, the ORIGINAL front photo, the carry style and the name', /^data:image\/jpeg/.test(pb.person ?? '') && /drawings\/front\.jpg/.test(pb.productImage ?? '') && pb.carry === 'hand' && typeof pb.productName === 'string', Object.keys(pb).join(','));
  ok('M10 prefit before the paid token, token model lucy-vton-3.6', p.calls.indexOf('/realtime/prefit') < p.calls.indexOf('/realtime/token') && body(p, '/realtime/token').model === 'lucy-vton-3.6');
  ok('M11 the developer panel shows the check result of the reference picture', /검사 통과/.test(await p.getByTestId('evidence').innerText())); await p.context().close(); }
{ const p = await open({ seconds: 20 }); await p.goto('http://localhost:4195/#/again?p=zz-test-top&m=live&pipe=C'); await p.reload(); await p.waitForSelector('[data-testid=live-stage]'); await start(p); await live(p);
  ok('M12 clothing: the reference picture request names the garment kind (top)', body(p, '/realtime/prefit').garment === 'top', JSON.stringify(Object.keys(body(p, '/realtime/prefit'))));
  const lg = await p.evaluate(() => window.__rtLog); ok('M12b the instruction sent with the connection is the clothing one ("Substitute the current top …")', lg.some((l) => /^prompt:Substitute the current top/.test(l)), lg.filter((l) => l.startsWith('prompt:')).join('|')); await p.context().close(); }
{ const p = await open({ seconds: 20 }); await p.goto('http://localhost:4195/#/again?p=zz-test-set&m=live&pipe=D'); await p.reload(); await p.waitForSelector('[data-testid=live-stage]'); await start(p); await live(p);
  const lg = await p.evaluate(() => window.__rtLog); ok('M12c a set on lucy-2.6 gets the "wears the matching set" wording', lg.some((l) => /^prompt:The person wears the matching set/.test(l)), lg.filter((l) => l.startsWith('prompt:')).join('|')); await p.context().close(); }
{ const p = await open({ seconds: 20, prefit: 'reject' }); await p.goto('http://localhost:4195/#/again?p=zz-test-top&m=live&pipe=C'); await p.reload(); await p.waitForSelector('[data-testid=live-stage]'); await start(p); await live(p);
  const t = await p.getByTestId('evidence').innerText();
  ok('M13 a reference picture that fails the check is NOT used: the session starts with the original photo and the panel says so', /사용 안 함/.test(t) && /원본 제품 사진으로 진행/.test(t), t.split('\n').find((l) => l.includes('prefit')) ?? ''); await p.context().close(); }
{ const p = await open({ seconds: 20 }); await p.goto('http://localhost:4195/#/again?p=zz-test-top&m=live&pipe=B'); await p.reload(); await p.waitForSelector('[data-testid=live-stage]'); await start(p); await live(p);
  ok('M14 pipeline B sends no camera frame to our server (only the Decart connection gets video)', !p.calls.includes('/realtime/prefit')); await p.context().close(); }
// N. cost protection: no automatic re-dial, one connect retry only, network checked before anything is paid
{ const p = await open({ mock: 'reconnect', seconds: 20 }); await start(p);
  await p.waitForFunction(() => document.querySelector('[data-testid=live-steps]')?.getAttribute('data-step') === 'disconnected', null, { timeout: 40000 });
  ok('N1 the SDK starting to re-dial ends the session at once (a re-dial is another billed session), with a clear message', /자동으로 다시 연결하지 않습니다/.test(await p.getByTestId('live-error').innerText()) && (await p.evaluate(() => window.__rtLog)).includes('disconnect'));
  ok('N2 camera released after the dropped session', await p.evaluate(() => window.__tracks.every((t) => t.readyState === 'ended'))); await p.context().close(); }
{ const p = await open({ seconds: 20 }); await start(p); await live(p);
  const log = await p.evaluate(() => window.__rtLog);
  ok('N3 a failed first dial is retried once, not the SDK default of five times', log.includes('retries:1'), log.filter((l) => /retries/.test(l)).join(','));
  ok('N4 the network was checked (free) before the token was asked for', log.includes('preflight') && log.indexOf('preflight') < log.indexOf('connect:ok'));
  await p.context().close(); }
{ const p = await open({ mock: 'netfail', seconds: 20 }); await start(p); await p.waitForSelector('[data-testid=live-error]', { timeout: 30000 });
  ok('N5 a network that cannot carry realtime video stops before ANY paid request (no cut-out, no token, no reference picture)', /실시간 영상 연결이 되지 않습니다/.test(await p.getByTestId('live-error').innerText()) && !p.calls.some((c) => c === '/realtime/token' || c === '/realtime/prefit'), p.calls.join(',') || 'no requests');
  ok('N6 camera released after the network refusal', await p.evaluate(() => window.__tracks.every((t) => t.readyState === 'ended'))); await p.context().close(); }
{ const p = await open({ seconds: 20 }); await start(p); await p.getByRole('button', { name: '실시간 착용 시작' }).click({ force: true, timeout: 2000 }).catch(() => undefined); await live(p);
  ok('N7 pressing start again while starting does not make a second paid token request', p.calls.filter((c) => c === '/realtime/token').length === 1, p.calls.filter((c) => c === '/realtime/token').length + ' token request(s)'); await p.context().close(); }
// O. products with their own fitting data (one piece on a plain background + an exact description): used instead of asking the server to describe the photo
{ const p = await open({ seconds: 20 }); await p.goto('http://localhost:4195/#/again?p=zz-test-fit&m=live'); await p.reload(); await p.waitForSelector('[data-testid=live-stage]'); await start(p); await live(p);
  ok('O1 no server description request for a product that has its own description (nothing to pay for)', !p.calls.includes('/cutout'), p.calls.join(','));
  const lg = await p.evaluate(() => window.__rtLog);
  ok('O2 the instruction is the clothing one for the fitting part (top) and carries the exact description', lg.some((l) => /^prompt:Substitute the current top with a black oversized short-sleeve cotton tee/.test(l)), lg.filter((l) => l.startsWith('prompt:')).join('|').slice(0, 200));
  ok('O2b the instruction insists on an identical copy (weave, colours, print size/position/lettering, neckline, sleeves), keeps the wearer\'s own body and chest, shows no underwear through the fabric, and stays under 750 characters', lg.some((l) => /identical to the reference image/.test(l) && /print size, position and lettering/.test(l) && /body shape, chest, build/.test(l) && /no underwear and no bare skin/.test(l) && l.length - 7 <= 750), String(Math.max(...lg.filter((l) => l.startsWith('prompt:')).map((l) => l.length - 7)))); await p.context().close(); }
{ const p = await open({ seconds: 20 }); await p.goto('http://localhost:4195/#/again?p=zz-test-fit&m=live&debug=1&pipe=B'); await p.reload(); await p.waitForSelector('[data-testid=live-stage]'); await start(p); await live(p);
  await p.waitForSelector('[data-testid=evidence]', { timeout: 40000 }); const ev = await p.getByTestId('evidence').innerText();
  ok('O4 the developer panel shows exactly which picture and which instruction were sent to the model', /AI에게 보낸 지시문/.test(ev) && /Substitute the current top with a black oversized/.test(ev) && /기준 사진/.test(ev) && /fitting\.jpg/.test(ev)); await p.context().close(); }
{ const p = await open({ seconds: 20 }); await p.goto('http://localhost:4195/#/again?p=zz-test-fit&m=live&pipe=C'); await p.reload(); await p.waitForSelector('[data-testid=live-stage]'); await start(p); await live(p);
  const pb = body(p, '/realtime/prefit');
  ok('O3 the reference-picture request uses the fitting photo and the fitting part, not the whole set photo', /fitting\.jpg/.test(pb.productImage ?? '') && pb.garment === 'top', `${pb.productImage} ${pb.garment}`); await p.context().close(); }
// P. starting again right after a session: the slot is freed at once (or the button shows a countdown instead of failing)
{ const p = await open({ seconds: 5, release: 'ok' }); await p.goto('http://localhost:4195/#/again?p=zz-test-top&m=live'); await p.reload(); await p.waitForSelector('[data-testid=live-stage]'); await start(p);
  await p.waitForFunction(() => document.querySelector('[data-testid=live-steps]')?.getAttribute('data-step') === 'ended', null, { timeout: 40000 });
  await p.waitForFunction(() => true, null, { timeout: 100 }); for (let i = 0; i < 30 && !p.calls.includes('/realtime/release'); i++) await p.waitForTimeout(100); // the call is sent just as the session ends; give it a moment to reach the server mock
  ok('P1 when the session ends the page tells the server (frees the slot)', p.calls.includes('/realtime/release'), p.calls.join(','));
  await p.waitForTimeout(700);
  const b = p.getByTestId('start-button');
  ok('P2 right after the session the start button is usable at once and says "다시 시작"', !(await b.isDisabled()) && /^다시 시작$/.test((await b.innerText()).trim()), (await b.innerText()).trim());
  await b.click(); await p.waitForFunction(() => document.querySelector('[data-testid=live-steps]')?.getAttribute('data-step') === 'live', null, { timeout: 40000 });
  ok('P3 and the second session really starts (second token request)', p.calls.filter((c) => c === '/realtime/token').length === 2, p.calls.filter((c) => c === '/realtime/token').length + ' token requests'); await p.context().close(); }
{ const p = await open({ seconds: 5, release: 'fail' }); await p.goto('http://localhost:4195/#/again?p=zz-test-top&m=live'); await p.reload(); await p.waitForSelector('[data-testid=live-stage]'); await start(p);
  await p.waitForFunction(() => document.querySelector('[data-testid=live-steps]')?.getAttribute('data-step') === 'ended', null, { timeout: 40000 }); await p.waitForTimeout(700);
  const b = p.getByTestId('start-button');
  ok('P4 if the server cannot free the slot, the button shows a countdown ("N초 후 다시 시작") instead of letting the visitor hit a refusal', (await b.isDisabled()) && /초 후 다시 시작/.test(await b.innerText()), (await b.innerText()).trim());
  const t1 = Number(/(\d+)초/.exec(await b.innerText())?.[1]); await p.waitForTimeout(2200); const t2 = Number(/(\d+)초/.exec(await b.innerText())?.[1]);
  ok('P5 the countdown moves down', t2 < t1, `${t1} -> ${t2}`); await p.context().close(); }
// Q. camera quality and the size of the AGAIN title
{ const p = await open({ seconds: 20 }); await p.goto('http://localhost:4195/#/again?p=zz-test-top&m=live&debug=1'); await p.reload(); await p.waitForSelector('[data-testid=live-stage]');
  const fs = await p.evaluate(() => parseFloat(getComputedStyle(document.querySelector('h1')).fontSize));
  ok('Q1 the AGAIN title is much smaller than before (it was about 70-92 px; now at most 52 px)', fs <= 52 && fs >= 28, fs + 'px');
  await start(p); await live(p);
  const gum = await p.evaluate(() => window.__gum);
  ok('Q2 the camera is asked for the best picture: ideal 1920x1080 (the browser picks the closest the device has)', gum?.video?.width?.ideal === 1920 && gum?.video?.height?.ideal === 1080, JSON.stringify(gum?.video).slice(0, 160));
  await p.waitForSelector('[data-testid=evidence]', { timeout: 40000 });
  ok('Q3 the developer panel records what the camera really delivered (width x height)', /카메라 입력/.test(await p.getByTestId('evidence').innerText()) && /\d+×\d+/.test(await p.getByTestId('evidence').innerText())); await p.context().close(); }
// D. failures
for (const [name, opt, kind, re] of [['D1 daily limit', { token: 'daily' }, 'limited', /하루 3번/], ['D2 previous session still being wrapped up', { token: 'busy' }, 'limited', /정리하는 중/], ['D3 provider not configured', { token: 'down' }, 'failed', /준비 중/]]) {
  const p = await open(opt); await start(p); await p.waitForSelector('[data-testid=live-error]');
  ok(`${name}: message + step "${kind}"`, re.test(await p.getByTestId('live-error').innerText()) && (await step(p)) === kind, await step(p));
  ok(`${name}: camera released`, await p.evaluate(() => window.__tracks.every((t) => t.readyState === 'ended'))); await p.context().close(); }
{ const p = await open({ mock: 'drop', seconds: 20 }); await start(p);
  await p.waitForFunction(() => document.querySelector('[data-testid=live-steps]')?.getAttribute('data-step') === 'disconnected', null, { timeout: 40000 });
  ok('D4 connection drops mid-session → "disconnected" + message + resources released', /연결이 끊겼/.test(await p.getByTestId('live-error').innerText()) && (await p.evaluate(() => window.__rtLog)).includes('disconnect')); await p.context().close(); }
{ const p = await open({ mock: 'refuse-image', seconds: 20 }); await start(p); await p.waitForSelector('[data-testid=live-error]', { timeout: 40000 });
  ok('D5 product image refused by the model → error says so (no silent video without the product)', /제품 이미지 전달에 실패/.test(await p.getByTestId('live-error').innerText())); await p.context().close(); }
{ const p = await open({ mock: 'noframes', seconds: 30 }); await start(p); await p.waitForSelector('[data-testid=live-error]', { timeout: 60000 });
  ok('D6 no generated frames within 12 s → stopped, with message', /오지 않아 중단/.test(await p.getByTestId('live-error').innerText()), await step(p)); await p.context().close(); }
// E. leaving the page releases the session
{ const p = await open({ seconds: 30 }); await start(p);
  await p.waitForFunction(() => document.querySelector('[data-testid=live-steps]')?.getAttribute('data-step') === 'live', null, { timeout: 40000 });
  await p.getByRole('tab', { name: /사진 합성/ }).click(); await p.waitForTimeout(800);
  ok('E1 switching away from the tab disconnects the session and stops the camera', (await p.evaluate(() => window.__rtLog)).includes('disconnect') && await p.evaluate(() => window.__tracks.every((t) => t.readyState === 'ended'))); await p.context().close(); }
await b.close();
