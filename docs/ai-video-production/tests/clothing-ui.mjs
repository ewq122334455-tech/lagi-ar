// Clothing pages and the clothing-only AI fitting (render check). Needs the two test products (created by add-clothing, removed afterwards — see run-ui-tests.sh).
const { chromium } = await import(process.env.PW_MODULE);
const b = await chromium.launch({ executablePath: chromium.executablePath(), args: ['--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream'] });
const ok = (n, c, i = '') => console.log(`${c ? 'PASS' : 'FAIL'}  ${n}${i ? '  — ' + i : ''}`);
const ctx = await b.newContext({ viewport: { width: 1280, height: 1000 }, permissions: ['camera'] });
await ctx.addInitScript(() => sessionStorage.setItem('lagi-intro-seen', '1'));
const p = await ctx.newPage(); const errs = []; p.on('pageerror', (e) => errs.push(e.message));
const B = 'http://localhost:4195/#/';
await p.goto(B + 'discover'); await p.waitForTimeout(1500);
const t = await p.locator('body').innerText();
ok('R1 clothing appears in the product list with the Korean category names', /테스트 상의 블랙/.test(t) && /테스트 스웻 세트 블랙/.test(t) && /상의/.test(t) && /세트/.test(t));
await p.goto(B + 'product/zz-test-set'); await p.waitForTimeout(1500);
ok('R2 set page: the exact set name and the contents are shown', /테스트 스웻 세트 블랙/.test(await p.locator('h1').innerText()) && /테스트 후드 \+ 테스트 팬츠/.test(await p.getByTestId('set-items').innerText()));
ok('R3 the product page for clothing has no page errors', errs.length === 0, errs.join('|'));
await p.goto(B + 'product/zz-test-top'); await p.waitForTimeout(1200);
ok('R4 top page renders (name, price)', /테스트 상의 블랙/.test(await p.locator('h1').innerText()) && /39,000/.test(await p.locator('body').innerText()));
// AI video tab: clothing only
await p.goto(B + 'again?p=plano-bag&m=live'); await p.waitForTimeout(1500);
ok('R5 live tab with a bag selected says realtime fitting is clothing only and offers 3D / photo', await p.getByTestId('live-clothing-only').count() === 1 && /옷만 가능/.test(await p.getByTestId('live-clothing-only').innerText()));
ok('R6 no bag in the live picker, only clothing', !(await p.locator('ul').filter({ hasText: '플라노' }).count()) && /테스트 상의 블랙/.test(await p.locator('section').first().innerText()));
await p.goto(B + 'again?p=zz-test-set&m=live'); await p.waitForTimeout(1500);
ok('R7 clothing set opens in the AI video with the start flow', await p.getByTestId('live-stage').count() === 1);
ok('R8 clothing has one way to try it on, so no way-of-wearing choice is shown (and no bag carry choices)', !/손에 들기|어깨에 메기/.test(await p.locator('body').innerText()));
await p.goto(B + 'again?p=plano-bag&m=photo'); await p.waitForTimeout(1200);
ok('R9 the photo compositing still lists bags', /플라노/.test(await p.locator('body').innerText()));
await p.goto(B + 'again?p=plano-bag&m=map'); await p.waitForTimeout(1200);
ok('R10 the 3D try-on tab is kept for bags', /3D/.test(await p.locator('body').innerText()));
await p.goto(B + 'again?p=lagi-star-knit-denim-set&m=live'); await p.waitForTimeout(1500);
ok('R12 a set offers 상의 / 하의 for the live fitting (top selected first)', await p.getByTestId('part-toggle').count() === 1 && (await p.getByTestId('part-top').getAttribute('aria-pressed')) === 'true');
await p.getByTestId('part-bottom').click(); await p.waitForTimeout(300);
ok('R13 choosing 하의 selects it and unselects 상의', (await p.getByTestId('part-bottom').getAttribute('aria-pressed')) === 'true' && (await p.getByTestId('part-top').getAttribute('aria-pressed')) === 'false');
await p.goto(B + 'again?p=zz-test-top&m=live'); await p.waitForTimeout(1500);
ok('R14 a single top has no 상의 / 하의 choice', await p.getByTestId('part-toggle').count() === 0);
await p.goto(B + 'product/zz-test-set'); await p.waitForTimeout(1500);
{ const info = p.getByTestId('product-info'); const t = await info.innerText();
  ok('R15 clothing page has the written sections: story, why selected, made by, fabric, size, 상품 정보 제공 고시', ['STORY', 'WHY WE SELECTED', 'MADE BY', 'FABRIC', 'SIZE', 'INFORMATION'].every((k) => t.toUpperCase().includes(k)) && /상품 정보 제공 고시/.test(t));
  ok('R16 the legally required items are all listed, and nothing unknown is invented (shown as 정보 준비 중)', ['제품 소재', '색상', '치수', '제조국', '세탁방법', '제조연월', '품질보증기준', 'A/S'].every((k) => t.includes(k)) && (await p.locator('[data-testid=notice] dd').allInnerTexts()).every((x) => x === '정보 준비 중')); }
ok('R11 no page errors on any of them', errs.length === 0, errs.join('|'));
await b.close();
