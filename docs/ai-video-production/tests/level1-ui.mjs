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
      return J(200, { apiKey: 'mock-token', seconds, remainingToday: 2, ...(model ? { model } : {}) });
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
