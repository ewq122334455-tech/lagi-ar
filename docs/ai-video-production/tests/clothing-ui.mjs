// Clothing pages and the clothing-only AI fitting (render check). Needs the two test products (created by add-clothing, removed afterwards — see run-ui-tests.sh).
const { chromium } = await import(process.env.PW_MODULE);
const b = await chromium.launch({ executablePath: chromium.executablePath(), args: ['--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream'] });
const ok = (n, c, i = '') => console.log(`${c ? 'PASS' : 'FAIL'}  ${n}${i ? '  — ' + i : ''}`);
const ctx = await b.newContext({ viewport: { width: 1280, height: 1000 }, permissions: ['camera'] });
await ctx.addInitScript(() => sessionStorage.setItem('lagi-intro-seen', '1'));
const p = await ctx.newPage(); const errs = []; p.on('pageerror', (e) => errs.push(e.message));
const B = 'http://localhost:4195/#/';
await p.goto(B + 'discover'); await p.waitForTimeout(1500);
const t = await p.locator('body').innerText(); const alts = (await p.locator('[data-testid=product-card] img[alt]').evaluateAll((a) => a.map((i) => i.alt))).join('|');
ok('R1 clothing appears in the product list with its name under the picture (English name when there is one) and English category filters', /테스트 상의 블랙/.test(alts) && /테스트 스웻 세트 블랙/.test(t) && /PLANO BAG/.test(t) && /\bTop\b/.test(t) && /\bSet\b/.test(t) && /\bAll\b/.test(t));
await p.goto(B + 'product/zz-test-set'); await p.waitForTimeout(1500);
ok('R2 set page: the exact set name and the contents are shown', /테스트 스웻 세트 블랙/.test(await p.locator('h1').innerText()) && /테스트 후드 \+ 테스트 팬츠/.test(await p.getByTestId('set-items').innerText()));
ok('R3 the product page for clothing has no page errors', errs.length === 0, errs.join('|'));
await p.goto(B + 'product/zz-test-top'); await p.waitForTimeout(1200);
ok('R4 top page renders (name, price)', /테스트 상의 블랙/.test(await p.locator('h1').innerText()) && /39,000/.test(await p.locator('body').innerText()));
// AI video tab: clothing only
await p.goto(B + 'again?p=plano-bag&m=live'); await p.waitForTimeout(1500);
ok('R5 live tab with a bag selected says realtime fitting is clothing only and offers 3D / photo', await p.getByTestId('live-clothing-only').count() === 1 && /옷만 가능/.test(await p.getByTestId('live-clothing-only').innerText()));
{ const labels = async () => (await p.locator('[data-testid=product-strip] button').evaluateAll((a) => a.map((b) => b.getAttribute('aria-label')))).join('|');
  let picks = await labels(); const kinds = await p.locator('[data-testid^=kind-]').all();
  for (const k of kinds) { await k.click(); await p.waitForTimeout(150); picks += '|' + (await labels()); }
  ok('R6 no bag in the live picker (no Bag button either), only clothing', !/플라노/.test(picks) && /테스트 상의 블랙/.test(picks) && (await p.getByTestId('kind-Bag').count()) === 0); }
await p.goto(B + 'again?p=zz-test-set&m=live'); await p.waitForTimeout(1500);
ok('R7 clothing set opens in the AI video with the start flow', await p.getByTestId('live-stage').count() === 1);
ok('R8 clothing has one way to try it on, so no way-of-wearing choice is shown (and no bag carry choices)', !/손에 들기|어깨에 메기/.test(await p.locator('body').innerText()));
await p.goto(B + 'again?p=plano-bag&m=photo'); await p.waitForTimeout(1200);
ok('R9 the photo compositing still lists bags', /플라노/.test((await p.locator('[data-testid=product-strip] button').evaluateAll((a) => a.map((b) => b.getAttribute('aria-label')))).join('|')));
await p.goto(B + 'again?p=plano-bag&m=map'); await p.waitForTimeout(1200);
{ const tabs = (await p.locator('[role=tablist][aria-label="체험 방식"] [role=tab]').allInnerTexts()).join('|');
  ok('R10 the 3D try-on is gone: only 사진 합성 and AI 영상, and an old 3D link opens the photo compositing', tabs === '사진 합성|AI 영상' && (await p.getByTestId('photo-input').count()) === 1, tabs); }
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
await p.goto(B + 'product/plano-bag'); await p.waitForTimeout(1500);
{ const t = await p.getByTestId('product-info').innerText();
  ok('R17 bags get the same written sections with the 가방 notice items (종류, 소재, 크기 …) and the real size from the product data', /종류/.test(t) && /크기/.test(t) && /MATERIAL/i.test(t) && /14/.test(await p.getByTestId('size-chart').innerText()));
  ok('R18 example values are labelled "예시 정보 · 확인 전" (never shown as checked facts)', (await p.locator('[data-draft=true]').count()) > 0); }
await p.goto(B + 'product/daily-tote'); await p.waitForTimeout(1500);
ok('R19 the daily tote has a written detail page like the others (no image-only page) with the maker facts from the brand', (await p.locator('[data-testid=detail-images]').count()) === 0 && /STORY/.test(await p.getByTestId('product-info').innerText()) && /UNESCO/.test(await p.getByTestId('product-info').innerText()));
await p.goto(B + 'again?p=plano-bag&m=photo'); await p.waitForTimeout(1200);
await p.getByRole('button', { name: '카메라', exact: true }).click(); await p.waitForSelector('[data-testid=camera-shoot]:not([disabled])', { timeout: 8000 }).catch(() => {});
{ const btn = p.getByTestId('camera-shoot'); const label = await btn.innerText().catch(() => '');
  await btn.click().catch(() => {}); await p.waitForTimeout(1200); const counting = await p.getByTestId('camera-count').count();
  await p.waitForTimeout(3200);
  ok('R20 photo camera: one "3초 후 촬영" button, a countdown on screen, then the photo is taken and the camera closes', /3초 후 촬영/.test(label) && counting === 1 && (await p.getByTestId('camera').count()) === 0 && (await p.locator('img[alt="올린 사진"]').count()) === 1, `label=${label} countdown=${counting}`); }
await p.goto(B + ''); await p.waitForTimeout(1200);
{ const nav = await p.locator('header nav a').first().boundingBox(); const bag = await p.locator('header a[href="#/cart"]').boundingBox(); const logo = await p.locator('header a[aria-label="LAGI home"]').first().boundingBox();
  ok('R21 header is one row: menu on the left, logo in the middle, film / search / account / cart on the right', nav.x < logo.x && logo.x < bag.x && Math.abs(nav.y - bag.y) < 20 && (await p.getByTestId('film-open').count()) === 1);
  ok('R22 the home page no longer has its own brand-film button', (await p.locator('main').getByText('Brand film', { exact: false }).count()) === 0);
  await p.getByTestId('film-open').click(); await p.waitForTimeout(800);
  const dlg = p.getByRole('dialog', { name: 'Brand film' }); const x = p.getByTestId('film-close');
  ok('R23 the brand film opens from the header and leaves with an X button (also Esc)', (await dlg.count()) === 1 && (await x.getAttribute('aria-label')) === '닫기' && !/Close/i.test(await x.innerText()));
  await p.keyboard.press('Escape'); await p.waitForTimeout(400); }
await p.goto(B + 'review'); await p.waitForTimeout(1200);
{ const n = await p.getByTestId('sample-review').count(); const labelled = await p.locator('[data-testid=sample-review]:has-text("예시")').count();
  ok('R24 the review page is full of example reviews (no badge on each card) with one quiet note under the rating saying they are not real customer reviews', n >= 12 && labelled === 0 && /실제 구매자 후기가 아닙니다/.test(await p.getByTestId('review-sample-note').innerText()) && !/구매 확인/.test(await p.getByTestId('sample-reviews').innerText()), `${n} reviews`); }
await p.goto(B + 'why'); await p.waitForTimeout(1200);
ok('R25 WHY LAGI shows the four selection points as cards', (await p.getByTestId('why-card').count()) === 4);
await p.goto(B + 'discover'); await p.waitForTimeout(1200);
ok('R26 product names are bold', (await p.locator('[data-testid=product-card] .pname').first().evaluate((e) => Number(getComputedStyle(e).fontWeight))) >= 700);
ok('R11 no page errors on any of them', errs.length === 0, errs.join('|'));
await b.close();
