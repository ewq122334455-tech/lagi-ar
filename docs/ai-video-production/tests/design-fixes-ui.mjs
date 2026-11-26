// Design fixes: AGAIN stage first, phone shop 2 columns, help button gap, empty cart, WHY scroll cue, one-line tabs. Build with npm run build and preview on port 4202.
const { chromium } = await import(process.env.PW_MODULE);
const out = process.env.OUT;
const b = await chromium.launch({ executablePath: chromium.executablePath() });
const ok = (n, c, i = '') => console.log(`${c ? 'PASS' : 'FAIL'}  ${n}${i ? '  — ' + i : ''}`);
const B = 'http://localhost:4202/#/';
const mk = async (w, h) => { const ctx = await b.newContext({ viewport: { width: w, height: h } }); await ctx.addInitScript(() => sessionStorage.setItem('lagi-intro-seen', '1')); return ctx.newPage(); };
const d = await mk(1440, 900), m = await mk(390, 844);
// 1 + 6: AGAIN
await d.goto(B + 'again?p=lagi-royal-blue-fleece-pullover&m=live'); await d.waitForTimeout(1800);
const top = await d.evaluate(() => document.querySelector('[data-testid=live-stage]').getBoundingClientRect().top);
ok('F1 desktop: the fitting stage starts within the first screen (top < 700px of 900)', top < 700, `top=${Math.round(top)}px`);
await d.screenshot({ path: '/tmp/lagi-fix-again-d.png' });
await m.goto(B + 'again?p=lagi-royal-blue-fleece-pullover&m=live'); await m.waitForTimeout(1800);
const mt = await m.evaluate(() => ({ top: document.querySelector('[data-testid=live-stage]').getBoundingClientRect().top, tabs: [...document.querySelectorAll('[role=tab]')].map((t) => Math.round(t.getBoundingClientRect().height)) }));
ok('F1b phone: the stage starts within the first screen (top < 760px of 844)', mt.top < 760, `top=${Math.round(mt.top)}px`);
ok('F6 phone: the three tabs are one line each (no wrapping)', mt.tabs.every((h) => h < 50), mt.tabs.join(','));
await m.screenshot({ path: '/tmp/lagi-fix-again-m.png' });
// 2: shop on phone
await m.goto(B + 'discover'); await m.waitForTimeout(1800);
const xs = await m.evaluate(() => [...document.querySelectorAll('[data-testid=shop-grid] li')].slice(0, 4).map((l) => Math.round(l.getBoundingClientRect().left)));
ok('F2 phone shop: two products per row', new Set(xs).size === 2, xs.join(','));
await m.screenshot({ path: '/tmp/lagi-fix-shop-m.png' });
// 3: help button clear of the buy bar
await m.goto(B + 'product/lagi-royal-blue-fleece-pullover'); await m.waitForTimeout(2000);
const gap = await m.evaluate(() => { const h = document.querySelector('[data-testid=help-float]').getBoundingClientRect(); const bars = [...document.querySelectorAll('div')].filter((e) => getComputedStyle(e).position === 'fixed' && e.getBoundingClientRect().bottom >= innerHeight - 1 && e.getBoundingClientRect().height > 40 && e !== document.querySelector('[data-testid=help-float]')); const bar = bars.sort((a, c) => c.getBoundingClientRect().height - a.getBoundingClientRect().height)[0]; return { helpBottom: Math.round(h.bottom), barTop: bar ? Math.round(bar.getBoundingClientRect().top) : null }; });
ok('F3 phone: a visible gap (8px or more) between the help button and the buy bar', gap.barTop !== null && gap.barTop - gap.helpBottom >= 8, JSON.stringify(gap));
await m.screenshot({ path: '/tmp/lagi-fix-product-m.png' });
// 4: empty cart
await m.goto(B + 'cart'); await m.waitForTimeout(1200);
ok('F4 empty cart: a clear message and a button to the shop', /비어 있어요/.test(await m.locator('body').innerText()) && await m.getByTestId('cart-empty-shop').isVisible());
await m.screenshot({ path: '/tmp/lagi-fix-cart-m.png' });
// 5: WHY progress line moves
await d.goto(B + 'why'); await d.waitForTimeout(1800);
const w0 = await d.evaluate(() => document.querySelector('.sticky div[class*=bg-black]')?.firstElementChild?.style.width);
await d.mouse.wheel(0, 1500); await d.waitForTimeout(800);
const w1 = await d.evaluate(() => document.querySelector('.sticky div[class*=bg-black]')?.firstElementChild?.style.width);
ok('F5 WHY desktop: a "Scroll" cue and a progress line that fills while scrolling', /Scroll/.test(await d.locator('body').innerText()) && parseFloat(w1) > parseFloat(w0), `${w0} -> ${w1}`);
await d.screenshot({ path: '/tmp/lagi-fix-why-d.png' });
await b.close();
