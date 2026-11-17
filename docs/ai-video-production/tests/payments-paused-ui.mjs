// Payment pause check: even with a payment key in the build, nothing leads to the on-site checkout. Build with VITE_TOSS_CLIENT_KEY=test_ck_dummy and preview on port 4196.
const { chromium } = await import(process.env.PW_MODULE);
const b = await chromium.launch({ executablePath: chromium.executablePath() });
const ok = (n, c, i = '') => console.log(`${c ? 'PASS' : 'FAIL'}  ${n}${i ? '  — ' + i : ''}`);
const ctx = await b.newContext({ viewport: { width: 1280, height: 1000 } });
await ctx.addInitScript(() => sessionStorage.setItem('lagi-intro-seen', '1'));
const p = await ctx.newPage(); const errs = []; p.on('pageerror', (e) => errs.push(e.message));
const B = 'http://localhost:4196/#/';
await p.goto(B + 'product/daily-tote'); await p.waitForTimeout(1500);
const buy = p.getByRole('link', { name: /바로 구매/ });
ok('P1 even with a payment key in the build, "바로 구매" is a link to the official store (no on-site checkout)', (await buy.count()) === 1 && /smartstore\.naver\.com/.test((await buy.first().getAttribute('href')) ?? ''), await buy.first().getAttribute('href'));
await p.getByRole('button', { name: /장바구니/ }).first().click(); await p.waitForTimeout(500);
await p.goto(B + 'cart'); await p.waitForTimeout(1000);
ok('P2 the cart offers the store, not "주문하기"', (await p.getByTestId('cart-store-order').count()) === 1 && (await p.getByRole('link', { name: '주문하기' }).count()) === 0);
await p.goto(B + 'checkout'); await p.waitForTimeout(1000);
ok('P3 opening /checkout directly shows the pause notice, no address or payment form', (await p.getByTestId('checkout-store-notice').count()) === 1 && /잠시 중단/.test(await p.getByTestId('checkout-store-notice').innerText()) && (await p.locator('input').count()) === 0);
ok('P4 no page errors', errs.length === 0, errs.join('|'));
await b.close();
