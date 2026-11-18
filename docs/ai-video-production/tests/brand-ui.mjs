// Brand film intro (click to enter), ABOUT film, brand blue instead of black, big blue fitting stage. Build with npm run build and preview on port 4200.
const { chromium } = await import(process.env.PW_MODULE);
const out = process.env.OUT;
const b = await chromium.launch({ executablePath: chromium.executablePath(), args: ['--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream', '--autoplay-policy=no-user-gesture-required'] });
const ok = (n, c, i = '') => console.log(`${c ? 'PASS' : 'FAIL'}  ${n}${i ? '  — ' + i : ''}`);
const ctx = await b.newContext({ viewport: { width: 1440, height: 900 }, permissions: ['camera'] });
const p = await ctx.newPage(); const errs = []; p.on('pageerror', (e) => errs.push(e.message));
const B = 'http://localhost:4200/#/';
// first visit: the film, not the old logo animation
await p.goto(B); await p.waitForTimeout(2500);
ok('V1 first visit shows the intro film full screen', await p.getByTestId('intro-film').count() === 1 && await p.getByTestId('intro').count() === 1);
const st = await p.evaluate(() => { const v = document.querySelector('[data-testid=intro-film]'); return { t: v.currentTime, paused: v.paused, w: v.videoWidth, src: v.currentSrc.split('/').pop() }; });
ok('V2 the film is really playing (time moves, not paused)', st.t > 0.5 && !st.paused && st.w >= 1280, JSON.stringify(st));
await p.screenshot({ path: '/tmp/lagi-brand-intro.png' });
await p.waitForTimeout(6000);
await p.screenshot({ path: '/tmp/lagi-brand-intro-later.png' });
// one click enters
await p.getByTestId('intro').click(); await p.waitForTimeout(1600);
ok('V3 one click removes the intro and shows the site', await p.getByTestId('intro').count() === 0 && /LAGI/.test(await p.locator('h1').first().innerText()));
await p.screenshot({ path: '/tmp/lagi-brand-home-after-intro.png' });
// not shown again in the same visit
await p.goto(B + 'discover'); await p.waitForTimeout(800); await p.goto(B); await p.waitForTimeout(1200);
ok('V4 the intro is not shown again in the same visit', await p.getByTestId('intro').count() === 0);
// keyboard also enters (new context = new visit)
const c2 = await b.newContext({ viewport: { width: 1440, height: 900 } }); const q = await c2.newPage(); await q.goto(B); await q.waitForTimeout(1200); await q.keyboard.press('Enter'); await q.waitForTimeout(1500);
ok('V5 Enter key also opens the site', await q.getByTestId('intro').count() === 0);
// about page has the new film
await p.goto(B + 'about'); await p.waitForTimeout(2500);
await p.evaluate(() => document.querySelector('#film')?.scrollIntoView()); await p.waitForTimeout(2500);
const f = await p.evaluate(() => { const v = document.querySelector('#film video'); return v ? { dur: v.duration, w: v.videoWidth, src: v.currentSrc.split('/').pop(), t: v.currentTime } : null; });
ok('V6 ABOUT shows the new 43-second film', !!f && f.dur > 40 && f.dur < 46, JSON.stringify(f));
await p.screenshot({ path: '/tmp/lagi-brand-about.png' });
// footer blue + buttons blue
await p.goto(B + 'product/lagi-star-knit-denim-set'); await p.waitForTimeout(1500);
const col = await p.evaluate(() => { const bg = (el) => getComputedStyle(el).backgroundColor; return { page: bg(document.querySelector('.v3')), footer: bg(document.querySelector('footer')), fit: bg(document.querySelector('[data-testid=fit-button]')) }; });
ok('V7 page background and footer are the brand blue (rgb 29,81,152), not black', col.page === 'rgb(29, 81, 152)' && col.footer === 'rgb(29, 81, 152)', JSON.stringify(col));
await p.screenshot({ path: '/tmp/lagi-brand-product.png', fullPage: true });
// fitting screen: big and blue
await p.goto(B + 'again?p=lagi-star-knit-denim-set&m=live'); await p.waitForTimeout(1800);
const stage = await p.evaluate(() => { const e = document.querySelector('[data-testid=live-stage]'); const r = e.getBoundingClientRect(); return { w: Math.round(r.width), h: Math.round(r.height), bg: getComputedStyle(e).backgroundColor, vw: innerWidth }; });
ok('V8 the fitting stage is brand blue, not black', stage.bg === 'rgb(29, 81, 152)', JSON.stringify(stage));
ok('V9 the fitting stage is much wider than before (before: under half of the page, now about 90%)', stage.w / stage.vw > 0.85, `${stage.w}px of ${stage.vw}px`);
await p.screenshot({ path: '/tmp/lagi-brand-live.png' });
ok('V10 no page errors', errs.length === 0, errs.join('|'));
await b.close();
