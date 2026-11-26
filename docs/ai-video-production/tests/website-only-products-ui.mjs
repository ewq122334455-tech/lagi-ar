// Website-only products (not on the smart store): no store link inside the product page, no buy buttons, fitting still offered. Build with npm run build, preview on port 4197.
const { chromium } = await import(process.env.PW_MODULE);
const b = await chromium.launch({ executablePath: chromium.executablePath(), args: ['--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream'] });
const ok = (n, c, i = '') => console.log(`${c ? 'PASS' : 'FAIL'}  ${n}${i ? '  — ' + i : ''}`);
const ctx = await b.newContext({ viewport: { width: 1280, height: 1000 }, permissions: ['camera'] });
await ctx.addInitScript(() => sessionStorage.setItem('lagi-intro-seen', '1'));
const p = await ctx.newPage(); const errs = []; p.on('pageerror', (e) => errs.push(e.message));
const B = 'http://localhost:4197/#/';
for (const id of ['lagi-forest-green-denim-jacket', 'lagi-grey-ringer-tee', 'lagi-royal-blue-fleece-pullover']) {
  await p.goto(B + 'product/' + id); await p.waitForTimeout(1500);
  const html = await p.locator('article').innerHTML(); /* the site-wide footer keeps its link to the brand's store */
  ok(`T1 ${id}: no link to the smart store anywhere on the page`, !/smartstore\.naver\.com/.test(html));
  ok(`T2 ${id}: shows "구매 준비 중" and no 장바구니 / 바로 구매 buttons`, (await p.getByTestId('not-for-sale').count()) === 1 && (await p.getByRole('button', { name: /^장바구니$|^바로 구매/ }).count()) === 0);
  ok(`T3 ${id}: the AI fitting button is there`, (await p.getByTestId('fit-button').count()) === 1);
}
await p.screenshot({ path: process.env.OUT + '/set-page2.png' });
await p.goto(B + 'product/daily-tote'); await p.waitForTimeout(1500);
ok('T4 an existing bag still links to the smart store and can be bought as before', (await p.getByTestId('buy-now-store').count()) === 1 && (await p.getByRole('button', { name: /^장바구니$/ }).count()) === 1);
await p.goto(B + 'again?p=lagi-forest-green-denim-jacket&m=live'); await p.waitForTimeout(1500);
ok('T5 the fitting page opens for the new clothes', (await p.getByTestId('live-stage').count()) === 1);
await p.goto(B + 'again?p=lagi-forest-green-denim-jacket&m=photo'); await p.waitForTimeout(1200);
ok('T6 photo compositing is still available for them', /사진/.test(await p.locator('body').innerText()));
ok('T7 no page errors', errs.length === 0, errs.join('|'));
await b.close();
