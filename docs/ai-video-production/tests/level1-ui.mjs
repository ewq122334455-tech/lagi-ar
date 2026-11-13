// LEVEL 1 (free, local): the AI-video page against a MOCK Decart SDK + mocked Worker. Proves wiring, NOT AI video quality.
import { chromium } from 'playwright-core';
import fs from 'node:fs';
const jpg = fs.readFileSync('/home/user/lagi-ar/public/products/plano-bag/images/main.jpg').toString('base64');
const W = 'https://lagi-tryon.lagi-official.workers.dev';
const ok = (n, c, i = '') => console.log(`${c ? 'PASS' : 'FAIL'}  ${n}${i ? '  — ' + i : ''}`);
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream', '--autoplay-policy=no-user-gesture-required'] });
async function open({ token = 'ok', mock = 'ok', deny = false, seconds = 5, model } = {}) {
  const ctx = await b.newContext({ viewport: { width: 1280, height: 1000 }, permissions: ['camera'], acceptDownloads: true });
  await ctx.addInitScript(([m, d]) => {
    sessionStorage.setItem('lagi-intro-seen', '1'); window.__rtMock = { mode: m };
    if (d) navigator.mediaDevices.getUserMedia = async () => { throw new DOMException('denied', 'NotAllowedError'); };
    const orig = navigator.mediaDevices.getUserMedia?.bind(navigator.mediaDevices); window.__tracks = [];
    if (!d && orig) navigator.mediaDevices.getUserMedia = async (c) => { const s = await orig(c); window.__tracks.push(...s.getTracks()); return s; };
  }, [mock, deny]);
  const p = await ctx.newPage(); p.errs = []; p.on('pageerror', (e) => p.errs.push(e.message)); p.calls = [];
  const cors = { 'Access-Control-Allow-Origin': 'http://localhost:4195', 'Access-Control-Allow-Headers': 'Content-Type,Authorization' };
  await p.route(W + '/**', (rt) => {
    const u = rt.request().url().replace(W, ''); const body = rt.request().postData() ?? '';
    if (u === '/realtime/report') { p.calls.push(u); return rt.fulfill({ status: 200, headers: cors, contentType: 'application/json', body: '{"ok":true}' }); }
    if (rt.request().method() === 'OPTIONS') return rt.fulfill({ status: 204, headers: cors });
    p.calls.push(u + (body.includes('matte') ? '(matte)' : ''));
    const J = (status, o) => rt.fulfill({ status, headers: cors, contentType: 'application/json', body: JSON.stringify(o) });
    if (u === '/cutout') return body.includes('matte') ? J(200, { matte: 'data:image/jpeg;base64,' + jpg }) : J(200, { image: 'data:image/jpeg;base64,' + jpg, cutout: true, description: 'a small square bag' });
    if (u === '/realtime/token') {
      if (token === 'daily') return J(429, { error: '실시간 착용은 하루 3번까지 체험할 수 있습니다. 내일 다시 이용해 주세요.', reason: 'daily_limit' });
      if (token === 'busy') return J(429, { error: '이미 진행 중인 실시간 착용이 있습니다. 끝난 뒤에 다시 시작해 주세요.', reason: 'busy_ip' });
      if (token === 'down') return J(503, { error: '실시간 착용은 아직 준비 중입니다.', reason: 'not_configured' });
      { let rm; try { rm = JSON.parse(body || '{}').model; } catch {} return J(200, { apiKey: 'mock-token', seconds, remainingToday: 2, ...((rm ?? model) ? { model: rm ?? model } : {}) }); }
    }
    return rt.abort();
  });
  await p.goto('http://localhost:4195/#/again?p=plano-bag&m=live'); await p.waitForSelector('[data-testid=live-stage]', { timeout: 20000 });
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
  ok('C10 no request carries video to our server (only /cutout, /realtime/token, /realtime/report)', p.calls.every((c) => c.startsWith('/cutout') || c === '/realtime/token' || c === '/realtime/report'), p.calls.join(','));
  await p.waitForSelector('[data-testid=evidence]', { timeout: 5000 });
  ok('C12 measurement record appears after the session', true);
  ok('C13 a mock SDK run is labelled "not real AI" on screen', /실제 AI가 만든 영상이 아닙니다/.test(await p.getByTestId('evidence-mock').innerText()));
  const [ed] = await Promise.all([p.waitForEvent('download'), p.getByTestId('save-evidence').click()]); const ef = '/tmp/rtev-' + ed.suggestedFilename(); await ed.saveAs(ef); const E = JSON.parse(fs.readFileSync(ef, 'utf8'));
  ok('C14 record has model, standard speed, sdkIsMock=true, ticks, first-frame times, resolution, fps, session seconds', E.model === 'lucy-2.6' && E.speed === 'standard' && E.sdkIsMock === true && E.generationTicks >= 1 && E.msFirstGenerationTick > 0 && E.msFirstVideoFrame > 0 && /^\d+x\d+$/.test(E.outputResolution) && E.fps > 0 && E.actualSessionSeconds > 0 && E.requestedSeconds === 9, JSON.stringify({ tick: E.msFirstGenerationTick, frame: E.msFirstVideoFrame, fps: E.fps, res: E.outputResolution, secs: E.actualSessionSeconds, diff: E.meanDiffFromInput }));
  ok('C16 record keeps the SDK own connection states and diagnostics (so a missing AI output can be explained)', E.connectionStates.some((c) => c.state === 'generating') && E.diagnostics.some((d) => d.name === 'client-session-connection-breakdown'), JSON.stringify(E.connectionStates.map((c) => c.state)));
  ok('C15 measured difference from the camera input is a number (mock overlay is visibly different)', typeof E.meanDiffFromInput === 'number' && E.meanDiffFromInput > 5, String(E.meanDiffFromInput));
  ok('C11 no page errors', p.errs.length === 0, p.errs.join('|')); await p.context().close(); }

ok_(); function ok_() {}
{ const p = await open({ seconds: 5 }); await start(p);
  await p.waitForFunction(() => document.querySelector('[data-testid=live-steps]')?.getAttribute('data-step') === 'live', null, { timeout: 40000 });
  const log = await p.evaluate(() => window.__rtLog);
  ok('F1 default model is lucy-2.6 and standard speed (fast mode bills 2x and is never requested)', log.includes('model:lucy-2.6') && log.includes('speed:standard'), log.filter((l) => /^(model|speed)/.test(l)).join(' '));
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
  const p = await ctx.newPage(); await p.route(W + '/**', (rt) => { p.calls = (p.calls ?? []).concat(rt.request().url().replace(W, '')); rt.abort(); }); await p.goto('http://localhost:4195/#/again?p=plano-bag&m=live'); await p.waitForSelector('[data-testid=live-stage]'); await start(p); await p.waitForSelector('[data-testid=live-error]');
  ok('G2 camera busy (NotReadableError): says another app/tab may be using it, no paid request', /다른 앱이나 탭/.test(await p.getByTestId('live-error').innerText()) && !(p.calls ?? []).length); await ctx.close(); }
{ const p = await open({ token: 'netfail' }); await p.unroute(W + '/**'); await p.route(W + '/**', (rt) => rt.request().url().endsWith('/cutout') && !rt.request().postData()?.includes('matte') ? rt.fulfill({ status: 200, headers: { 'Access-Control-Allow-Origin': 'http://localhost:4195' }, contentType: 'application/json', body: JSON.stringify({ image: 'data:image/jpeg;base64,' + jpg }) }) : rt.abort('failed')); await p.getByLabel(/실제 디자인 입히기|실제 디자인/).first().uncheck().catch(() => {}); await start(p); await p.waitForSelector('[data-testid=live-error]', { timeout: 30000 });
  ok('G3 server unreachable: says the AI server could not be reached and to check the internet connection (not a generic retry)', /AI 서버에 닿지 못했습니다/.test(await p.getByTestId('live-error').innerText()), (await p.getByTestId('live-error').innerText()).slice(0, 60)); await p.context().close(); }
{ const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, permissions: ['camera'] }); await ctx.addInitScript(() => { sessionStorage.setItem('lagi-intro-seen', '1'); window.__rtMock = { mode: 'ok' }; delete window.MediaRecorder; });
  const p = await ctx.newPage(); p.calls = []; p.errs = []; p.on('pageerror', (e) => p.errs.push(e.message)); await p.route(W + '/**', (rt) => { const u = rt.request().url().replace(W, ''); const body = rt.request().postData() ?? ''; const cors = { 'Access-Control-Allow-Origin': 'http://localhost:4195', 'Access-Control-Allow-Headers': 'Content-Type,Authorization' }; const J = (o) => rt.fulfill({ status: 200, headers: cors, contentType: 'application/json', body: JSON.stringify(o) }); if (rt.request().method() === 'OPTIONS') return rt.fulfill({ status: 204, headers: cors }); if (u === '/cutout') return body.includes('matte') ? J({ matte: 'data:image/jpeg;base64,' + jpg }) : J({ image: 'data:image/jpeg;base64,' + jpg }); if (u === '/realtime/token') return J({ apiKey: 'm', seconds: 5, remainingToday: 2 }); if (u === '/realtime/report') return J({ ok: true }); rt.abort(); });
  await p.goto('http://localhost:4195/#/again?p=plano-bag&m=live'); await p.waitForSelector('[data-testid=live-stage]');
  const over = await p.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  ok('G4 phone-size screen (390x844, simulated): no sideways scrolling before the session', over <= 1, `overflow ${over}px`);
  ok('G5 browser without MediaRecorder: the record option is hidden instead of failing later', (await p.getByTestId('rec-toggle').count()) === 0);
  await start(p); await p.waitForFunction(() => document.querySelector('[data-testid=live-steps]')?.getAttribute('data-step') === 'live', null, { timeout: 40000 });
  ok('G6 phone-size: session reaches "live" and the stage fits the screen', await p.evaluate(() => document.querySelector('[data-testid=live-stage]').getBoundingClientRect().width <= window.innerWidth));
  await p.waitForFunction(() => document.querySelector('[data-testid=live-steps]')?.getAttribute('data-step') === 'ended', null, { timeout: 20000 });
  ok('G7 after the session a link to the product page is offered', (await p.getByTestId('to-product').getAttribute('href'))?.includes('/product/plano-bag'));
  const over2 = await p.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  ok('G8 phone-size: no sideways scrolling after the session either; no page errors', over2 <= 1 && p.errs.length === 0, `overflow ${over2}px; ${p.errs.join('|')}`); await ctx.close(); }
// H. diagnostic mode (&debug=1): one picture with the AI raw frame, the camera and the result; invisible without the flag
{ const p = await open({ seconds: 6 }); await p.goto('http://localhost:4195/#/again?p=plano-bag&m=live&debug=1'); await p.waitForSelector('[data-testid=live-stage]'); await start(p);
  await p.waitForFunction(() => document.querySelector('[data-testid=live-steps]')?.getAttribute('data-step') === 'ended', null, { timeout: 40000 });
  await p.waitForSelector('[data-testid=save-diag]', { timeout: 5000 }).catch(() => {});
  const has = (await p.getByTestId('save-diag').count()) > 0; ok('H1 with &debug=1 a diagnostic picture can be saved after the session', has);
  if (has) { const [dl] = await Promise.all([p.waitForEvent('download'), p.getByTestId('save-diag').click()]); const f = '/tmp/rtdiag-' + dl.suggestedFilename(); await dl.saveAs(f); const hdr = fs.readFileSync(f).subarray(16, 24); const m = { width: hdr.readUInt32BE(0), height: hdr.readUInt32BE(4) }; ok('H2 the picture holds three panels side by side (AI raw, camera, result)', m.width >= 2800 && m.height > 400, `${m.width}x${m.height}`); }
  await p.context().close(); }
{ const p = await open({ seconds: 5 }); await start(p); await p.waitForFunction(() => document.querySelector('[data-testid=live-steps]')?.getAttribute('data-step') === 'ended', null, { timeout: 40000 });
  ok('H3 without the flag there is no diagnostic button for normal visitors', (await p.getByTestId('save-diag').count()) === 0); await p.context().close(); }
// I. Anywear way: &model=lucy-vton-3.6&map=0 -> VTON model by name, no green-screen overlay, plain "Add ... to the outfit" prompt
{ const p = await open({ seconds: 5 }); await p.goto('http://localhost:4195/#/again?p=daily-tote&m=live&model=lucy-vton-3.6&map=0'); await p.reload(); await p.waitForSelector('[data-testid=live-stage]');
  ok('I1 &map=0 starts with the design-mapping option off', !(await p.getByTestId('map-toggle').isChecked()));
  await start(p); await p.waitForFunction(() => document.querySelector('[data-testid=live-steps]')?.getAttribute('data-step') === 'live', null, { timeout: 40000 });
  const log = await p.evaluate(() => window.__rtLog);
  ok('I2 the page asks for lucy-vton-3.6 and the SDK connects with it (standard speed)', log.includes('model:lucy-vton-3.6') && log.includes('speed:standard'), log.filter((l) => /^(model|speed)/.test(l)).join(' '));
  ok('I3 the prompt is the VTON "Add ... to the outfit" one, with no green-screen wording', log.some((l) => l.startsWith('setImage:Add ')) && !log.some((l) => /chroma-key|green/i.test(l)), log.filter((l) => l.startsWith('setImage')).join(' | '));
  ok('I4 no cut-out matte request (that step belongs to the green overlay only)', !p.calls.some((c) => c.includes('(matte)')), p.calls.join(','));
  await p.context().close(); }
// D. failures
for (const [name, opt, kind, re] of [['D1 daily limit', { token: 'daily' }, 'limited', /하루 3번/], ['D2 already running', { token: 'busy' }, 'limited', /이미 진행/], ['D3 provider not configured', { token: 'down' }, 'failed', /준비 중/]]) {
  const p = await open(opt); await start(p); await p.waitForSelector('[data-testid=live-error]');
  ok(`${name}: message + step "${kind}"`, re.test(await p.getByTestId('live-error').innerText()) && (await step(p)) === kind, await step(p));
  ok(`${name}: camera released`, await p.evaluate(() => window.__tracks.every((t) => t.readyState === 'ended'))); await p.context().close(); }
{ const p = await open({ mock: 'drop', seconds: 20 }); await start(p);
  await p.waitForFunction(() => document.querySelector('[data-testid=live-steps]')?.getAttribute('data-step') === 'disconnected', null, { timeout: 40000 });
  ok('D4 connection drops mid-session → "disconnected" + message + resources released', /연결이 끊겼/.test(await p.getByTestId('live-error').innerText()) && (await p.evaluate(() => window.__rtLog)).includes('disconnect')); await p.context().close(); }
{ const p = await open({ mock: 'refuse-image', seconds: 20 }); await start(p); await p.waitForSelector('[data-testid=live-error]', { timeout: 40000 });
  ok('D5 product image refused by the model → error says so (no silent video without the product)', /제품 이미지를 AI에 전달하지 못했습니다/.test(await p.getByTestId('live-error').innerText())); await p.context().close(); }
{ const p = await open({ mock: 'noframes', seconds: 30 }); await start(p); await p.waitForSelector('[data-testid=live-error]', { timeout: 60000 });
  ok('D6 no generated frames within 12 s → stopped, with message', /오지 않아 중단/.test(await p.getByTestId('live-error').innerText()), await step(p)); await p.context().close(); }
// E. leaving the page releases the session
{ const p = await open({ seconds: 30 }); await start(p);
  await p.waitForFunction(() => document.querySelector('[data-testid=live-steps]')?.getAttribute('data-step') === 'live', null, { timeout: 40000 });
  await p.getByRole('tab', { name: /사진 합성/ }).click(); await p.waitForTimeout(800);
  ok('E1 switching away from the tab disconnects the session and stops the camera', (await p.evaluate(() => window.__rtLog)).includes('disconnect') && await p.evaluate(() => window.__tracks.every((t) => t.readyState === 'ended'))); await p.context().close(); }
await b.close();
