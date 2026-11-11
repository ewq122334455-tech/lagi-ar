import { chromium } from 'playwright-core';
import fs from 'node:fs';
const P = '/tmp/claude-0/-home-user-lagi-ar/fa4cf5bc-42af-5652-8686-a3b6f4e33b80/scratchpad/aiq/photos/';
const B = process.env.BASE || 'http://localhost:4190/';
const R = []; const ok = (n, c, i = '') => { R.push(c); console.log(`${c ? 'PASS' : 'FAIL'}  ${n}${i ? '  — ' + i : ''}`); };
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
const errs = [];
const dataUrl = (f) => 'data:image/jpeg;base64,' + fs.readFileSync(P + f).toString('base64');
async function session(answer) {
  const c = await b.newContext({ viewport: { width: 1280, height: 900 } }); await c.addInitScript(() => sessionStorage.setItem('lagi-intro-seen', '1'));
  const p = await c.newPage(); p.on('pageerror', (e) => errs.push(e.message));
  let posts = 0;
  await p.route('https://lagi-tryon.lagi-official.workers.dev/', (r) => { if (r.request().method() !== 'POST') return r.continue(); posts++; return r.fulfill({ contentType: 'application/json', body: JSON.stringify({ image: dataUrl(answer) }) }); });
  await p.goto(B + '#/again?p=plano-bag&m=photo'); await p.waitForTimeout(1200);
  return { p, c, posts: () => posts };
}
// 1. photo notes
{ const { p, c } = await session('edited.jpg');
  for (const [f, want] of [['normal.jpg', null], ['dark.jpg', '어둡'], ['blurry.jpg', '흐릿'], ['small.jpg', '작습니다']]) {
    await p.getByTestId('photo-input').setInputFiles(P + f); await p.waitForTimeout(900);
    const t = await p.getByTestId('photo-issues').innerText().catch(() => '');
    ok(`photo ${f}: ${want ? 'note "' + want + '"' : 'no note'}`, want ? t.includes(want) : t === '', t.replace(/\n/g, ' | '));
  }
  ok('notes never disable the run button (consent still the only gate)', await p.getByRole('button', { name: /AI 이미지 합성/ }).isDisabled(), 'disabled only until consent');
  await c.close(); }
// 2. result notes
for (const [answer, want, label] of [['normal.jpg', '거의 바뀌지', 'unchanged answer'], ['other.jpg', '많이 다릅니다', 'different scene'], ['edited.jpg', null, 'edited (bag added)']]) {
  const { p, c, posts } = await session(answer);
  await p.getByTestId('photo-input').setInputFiles(P + 'normal.jpg'); await p.waitForTimeout(700);
  await p.getByLabel(/한 번 전송되는 것에 동의/).check(); await p.getByRole('button', { name: /AI 이미지 합성/ }).click();
  await p.getByTestId('ai-result').waitFor({ timeout: 20000 }).catch(() => {}); await p.waitForTimeout(900);
  const t = await p.getByTestId('result-issues').innerText().catch(() => '');
  ok(`result: ${label} → ${want ? 'note' : 'no note'}`, want ? t.includes(want) : t === '', t.replace(/\n/g, ' | ') || '(none)');
  ok(`result: ${label}: only ONE paid request was made (the check does not retry on its own)`, posts() === 1, `requests ${posts()}`);
  await c.close();
}
ok('no page errors', errs.length === 0, errs.join(' | '));
console.log(`\n${R.filter(Boolean).length} pass / ${R.filter((x) => !x).length} fail`);
await b.close();
