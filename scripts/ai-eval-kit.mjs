#!/usr/bin/env node
/**
 * AI photo-fitting EVALUATION KIT builder. It makes NO network call and spends NOTHING: it only gathers what a person
 * needs to judge real generations side by side — the original product picture, the cut-out (once it exists), the
 * person photo, the exact V1 / V2 / V2+surface-photos prompts the Worker would send, and the generated results
 * (once scripts/ai-fitting-ab.mjs has produced them) — into one folder with a blind rating sheet (rate.html).
 *
 *   node scripts/ai-eval-kit.mjs --out kit --products plano-bag,daily-tote,modular-bag-s --styles hand,shoulder \
 *        [--person photo.jpg --consent "who agreed, when"] [--cutouts dir] [--results ab-out] [--arms v1,v2,v2faces]
 *
 * Without --results the sheet shows the inputs and prompts and waits for results. Only VERIFIED products with a local image
 * are accepted (the 8 real ones today); sample and placeholder products are refused.
 */
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import sharp from 'sharp';

const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i > 0 && process.argv[i + 1] && !process.argv[i + 1].startsWith('--') ? process.argv[i + 1] : d; };
const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const PUB = path.join(ROOT, 'public');
const out = path.resolve(arg('out', 'ai-eval-kit'));
const styles = arg('styles', 'hand').split(',');
const arms = arg('arms', 'v1,v2,v2faces').split(',');
const personFile = arg('person', '');
const consent = arg('consent', '');
const cutDir = arg('cutouts', '');
const resDir = arg('results', '');
const STYLE = { hand: 'held by the handles in one hand, arm relaxed at the side', shoulder: 'with the handles resting on one shoulder', crossbody: 'worn cross-body with the strap across the chest' };
const ARM_LABEL = { v1: 'V1 프롬프트(현재 운영)', v2: 'V2 프롬프트(제품 사실·보존 지시)', v2faces: 'V2 + 실물 표면 사진 참조' };

if (personFile && !consent) { console.error('--consent "<who agreed, when>" is required together with --person (a photo of a person).'); process.exit(3); }
if (personFile && !fs.existsSync(personFile)) { console.error('person photo not found: ' + personFile); process.exit(2); }

// the Worker's own prompt builders and the client's own product facts, bundled for node (no network)
const tmp = fs.mkdtempSync(path.join(ROOT, 'node_modules', '.ai-eval-'));
fs.writeFileSync(path.join(tmp, 'entry.ts'), `export { buildPrompt, buildPromptV2 } from '${ROOT}/server/tryon-worker/src/index';\nexport { productFacts } from '${ROOT}/src/tryon/aiTryOn';\n`);
execFileSync('npx', ['esbuild', path.join(tmp, 'entry.ts'), '--bundle', '--format=esm', '--platform=node', `--alias:@=${ROOT}/src`, '--define:import.meta.env.VITE_TRYON_API_URL="x"', '--define:import.meta.env.VITE_AI_API_BASE="x"', `--outfile=${path.join(tmp, 'entry.mjs')}`, '--log-level=error'], { cwd: ROOT, stdio: 'inherit' });
const { buildPrompt, buildPromptV2, productFacts } = await import(path.join(tmp, 'entry.mjs'));
fs.rmSync(tmp, { recursive: true, force: true });

const manifest = JSON.parse(fs.readFileSync(path.join(PUB, 'products', 'manifest.json'), 'utf8'));
const allIds = manifest.products.map((p) => (typeof p === 'string' ? p : p.id));
const wanted = arg('products', 'plano-bag,daily-tote,modular-bag-s').split(',');
const real = [];
for (const id of wanted) {
  if (!allIds.includes(id)) { console.error(`unknown product: ${id}`); process.exit(2); }
  const p = JSON.parse(fs.readFileSync(path.join(PUB, 'products', id, 'product.json'), 'utf8'));
  if (p.sample || p.name?.status !== 'VERIFIED' || p.price?.status !== 'VERIFIED' || !p.images?.length) { console.error(`refused: ${id} is a sample/placeholder product (not VERIFIED, or has no image)`); process.exit(2); }
  real.push(p);
}

fs.mkdirSync(out, { recursive: true });
const rng = (seed) => () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
const rand = rng(Number(arg('seed', '20260101')));
const shuffle = (a) => { const b = [...a]; for (let i = b.length - 1; i > 0; i--) { const j = Math.floor(rand() * (i + 1)); [b[i], b[j]] = [b[j], b[i]]; } return b; };

// dominant colours of a reference picture (ignoring white/transparent), 5 bits per channel
async function palette(file) {
  const { data } = await sharp(file).resize(96, 96, { fit: 'inside' }).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const bins = new Map();
  for (let i = 0; i < data.length; i += 4) {
    if (data[i + 3] < 200) continue;
    const [r, g, b] = [data[i], data[i + 1], data[i + 2]];
    if (r > 235 && g > 235 && b > 235) continue;
    const k = ((r >> 3) << 10) | ((g >> 3) << 5) | (b >> 3);
    const e = bins.get(k) ?? { n: 0, r: 0, g: 0, b: 0 }; e.n++; e.r += r; e.g += g; e.b += b; bins.set(k, e);
  }
  const total = [...bins.values()].reduce((a, e) => a + e.n, 0) || 1;
  return [...bins.values()].sort((a, b) => b.n - a.n).slice(0, 6).map((e) => ({ rgb: [Math.round(e.r / e.n), Math.round(e.g / e.n), Math.round(e.b / e.n)], share: e.n / total }));
}
async function presence(file, pal) {
  const { data } = await sharp(file).resize(160, 160, { fit: 'inside' }).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  const n = data.length / 3;
  return pal.map((c) => { let hit = 0; for (let i = 0; i < data.length; i += 3) if (Math.hypot(data[i] - c.rgb[0], data[i + 1] - c.rgb[1], data[i + 2] - c.rgb[2]) < 45) hit++; return +(hit / n).toFixed(4); });
}

const trials = [];
const personOut = personFile ? 'person/person' + path.extname(personFile) : null;
if (personFile) { fs.mkdirSync(path.join(out, 'person'), { recursive: true }); fs.copyFileSync(personFile, path.join(out, personOut)); }
const results = resDir && fs.existsSync(path.join(resDir, 'results.json')) ? JSON.parse(fs.readFileSync(path.join(resDir, 'results.json'), 'utf8')) : [];
for (const p of real) {
  const dir = path.join(out, 'products', p.id); fs.mkdirSync(dir, { recursive: true });
  const origRel = p.images[0];
  fs.copyFileSync(path.join(PUB, origRel), path.join(dir, 'original' + path.extname(origRel)));
  const original = `products/${p.id}/original${path.extname(origRel)}`;
  let cutout = null;
  if (cutDir) { const c = fs.readdirSync(cutDir).find((f) => f.startsWith(p.id + '.')); if (c) { fs.copyFileSync(path.join(cutDir, c), path.join(dir, 'cutout' + path.extname(c))); cutout = `products/${p.id}/cutout${path.extname(c)}`; } }
  const faces = [];
  const m = p.model3d; const fl = m ? [m.faces?.front, m.textures?.front, m.faces?.back, m.textures?.back, m.faces?.left ?? m.faces?.right, m.textures?.side].filter(Boolean) : [];
  for (const rel of [...new Set(fl)].slice(0, 3)) { fs.mkdirSync(path.join(dir, 'faces'), { recursive: true }); fs.copyFileSync(path.join(PUB, rel), path.join(dir, 'faces', path.basename(rel))); faces.push(`products/${p.id}/faces/${path.basename(rel)}`); }
  const d = p.dimensions ?? {};
  const base = { productName: p.name.value, category: p.category?.value ?? undefined, size: d.widthCm ? `W${d.widthCm * 10} × H${(d.heightCm ?? 0) * 10} × D${(d.depthCm ?? 0) * 10} mm` : undefined, facts: productFacts(p) };
  const pal = await palette(path.join(out, cutout ?? original));
  for (const style of styles) {
    const req = { ...base, style: STYLE[style] ?? style };
    const prompts = { v1: buildPrompt(req, true), v2: buildPromptV2(req, true, 0), v2faces: buildPromptV2(req, true, faces.length) };
    const perm = shuffle(arms);
    const runsHere = [...new Set(results.filter((r) => r.p === p.id && r.s === style).map((r) => r.r))].sort();
    for (const run of runsHere.length ? runsHere : [0]) {
      const outs = {};
      for (const arm of arms) {
        const r = results.find((x) => x.p === p.id && x.s === style && x.v === arm && x.r === run && x.file);
        if (!r) continue;
        const src = path.isAbsolute(r.file) ? r.file : path.join(resDir, path.basename(r.file));
        if (!fs.existsSync(src)) continue;
        fs.mkdirSync(path.join(out, 'results'), { recursive: true });
        const rel = `results/${p.id}-${style}-${arm}-${run}${path.extname(src)}`;
        fs.copyFileSync(src, path.join(out, rel));
        const pres = await presence(path.join(out, rel), pal);
        let change = null;
        if (personFile) { const [a, b] = await Promise.all([sharp(path.join(out, rel)).resize(64, 64, { fit: 'fill' }).greyscale().raw().toBuffer(), sharp(personFile).rotate().resize(64, 64, { fit: 'fill' }).greyscale().raw().toBuffer()]); let s2 = 0; for (let i = 0; i < a.length; i++) s2 += Math.abs(a[i] - b[i]); change = +(s2 / a.length / 255).toFixed(3); }
        outs[arm] = { file: rel, paletteShare: pres, meanChangeVsPerson: change };
      }
      trials.push({ id: `${p.id}|${style}|${run}`, product: p.id, name: p.name.value, style, run, original, cutout, faces, person: personOut, palette: pal, prompts, perm, outs });
    }
  }
}
const kit = { id: 'kit-' + Date.now(), built: new Date().toISOString(), arms, armLabel: ARM_LABEL, consent: personFile ? consent : null, trials, note: 'No generation was made by this kit. Automatic numbers (palette share, change vs person) are weak heuristics; the human rating is the evaluation.' };
fs.writeFileSync(path.join(out, 'manifest.json'), JSON.stringify(kit, null, 1));

const html = String.raw`<!doctype html><html lang="ko"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>AI 합성 평가표</title>
<style>
body{font:14px/1.5 system-ui,sans-serif;margin:0;background:#101318;color:#e8ebf0;padding:16px}
h1{font-size:20px;margin:0 0 4px} .sub{color:#9aa4b5;margin-bottom:12px}
.card{background:#181d25;border:1px solid #2a3140;border-radius:8px;padding:12px;margin-bottom:14px}
.row{display:flex;flex-wrap:wrap;gap:10px;align-items:flex-start} img{max-width:100%;border-radius:4px;background:#000}
.col{flex:1 1 220px;min-width:0} .col img{width:100%} .lab{font-weight:600;margin:4px 0}
table{border-collapse:collapse;width:100%} td,th{padding:3px 6px;text-align:center;border-bottom:1px solid #2a3140} td:first-child,th:first-child{text-align:left}
button{background:#2b6cf0;color:#fff;border:0;border-radius:6px;padding:6px 12px;cursor:pointer} button.g{background:#2a3140}
.muted{color:#9aa4b5} details{margin:6px 0} pre{white-space:pre-wrap;background:#0d1015;padding:8px;border-radius:6px}
</style>
<h1>AI 사진 합성 평가표</h1>
<div class="sub" id="sub"></div>
<div style="margin-bottom:12px"><button id="reveal" class="g">정답 공개(어느 칸이 어느 방식인지)</button> <button id="dl">평가 결과 JSON 내려받기</button> <span class="muted" id="saved"></span></div>
<div id="sum" class="card" hidden></div>
<div id="trials"></div>
<script>
const KIT=__KIT__;
const CRIT=[['shape','제품 형태·실루엣'],['logo','로고·글자'],['color','색'],['handle','손잡이·끈 구조'],['material','소재 질감'],['person','인물 보존'],['natural','합성 자연스러움(손 접촉·그림자)'],['frame','구도 유지']];
const KEY='lagi-eval-'+KIT.id; let R={}; try{R=JSON.parse(localStorage.getItem(KEY)||'{}')}catch(e){}
let revealed=false;
const save=()=>{try{localStorage.setItem(KEY,JSON.stringify(R));document.getElementById('saved').textContent='저장됨 '+new Date().toLocaleTimeString()}catch(e){}};
document.getElementById('sub').textContent='제품 '+new Set(KIT.trials.map(t=>t.product)).size+'개 · 평가 항목 '+KIT.trials.length+'건 · 1(나쁨)~5(좋음). 칸 이름은 무작위(A/B/C)라 어느 방식인지 모른 채 평가합니다. '+(KIT.consent?'인물 사진 동의: '+KIT.consent:'인물 사진 없음(결과가 생기면 --person과 함께 다시 만드세요)');
function trialHtml(t){
  const arms=t.perm; const labels=['A','B','C','D','E'];
  let h='<div class="card"><b>'+t.name+'</b> · '+t.style+(t.run?' · 반복 '+t.run:'')+'<div class="row" style="margin:8px 0">';
  h+='<div class="col"><div class="lab">원본 제품 사진</div><img src="'+t.original+'"></div>';
  h+='<div class="col"><div class="lab">컷아웃(AI가 다시 그린 참조)</div>'+(t.cutout?'<img src="'+t.cutout+'">':'<div class="muted">아직 없음 — <code>pregenerate-cutouts.mjs --save</code> 후 <code>--cutouts</code></div>')+'</div>';
  h+='<div class="col"><div class="lab">인물 입력</div>'+(t.person?'<img src="'+t.person+'">':'<div class="muted">없음</div>')+'</div>';
  if(t.faces.length) h+='<div class="col"><div class="lab">실물 표면 사진(참조용)</div>'+t.faces.map(f=>'<img src="'+f+'" style="margin-bottom:4px">').join('')+'</div>';
  h+='</div><div class="row">';
  arms.forEach((arm,i)=>{const o=t.outs[arm];h+='<div class="col"><div class="lab">'+labels[i]+(revealed?' = '+KIT.armLabel[arm]:'')+'</div>'+(o?'<img src="'+o.file+'">':'<div class="muted" style="padding:40px 0">생성 결과 없음</div>')+(revealed&&o?'<div class="muted">기준색 포함 '+o.paletteShare.map(x=>(x*100).toFixed(0)+'%').join('/')+(o.meanChangeVsPerson!=null?' · 인물 사진과의 평균 차이 '+o.meanChangeVsPerson:'')+'</div>':'')+'</div>'});
  h+='</div><table><tr><th>항목</th>'+arms.map((a,i)=>'<th>'+labels[i]+'</th>').join('')+'</tr>';
  CRIT.forEach(([k,n])=>{h+='<tr><td>'+n+'</td>'+arms.map((a)=>{const id=t.id+'|'+a+'|'+k;let s='';for(let v=1;v<=5;v++)s+='<label><input type="radio" name="'+id+'" data-id="'+id+'" value="'+v+'"'+(R[id]==v?' checked':'')+(t.outs[a]?'':' disabled')+'>'+v+'</label> ';return '<td>'+s+'</td>'}).join('')+'</tr>'});
  h+='<tr><td>제3의 손/추가 인체 생김</td>'+arms.map(a=>{const id=t.id+'|'+a+'|extra';return '<td><input type="checkbox" data-flag="'+id+'"'+(R[id]?' checked':'')+(t.outs[a]?'':' disabled')+'></td>'}).join('')+'</tr></table>';
  h+='<details><summary>프롬프트 보기'+(revealed?'':' (정답 공개 후)')+'</summary>'+(revealed?arms.map(a=>'<div class="lab">'+KIT.armLabel[a]+'</div><pre>'+t.prompts[a].replace(/</g,'&lt;')+'</pre>').join(''):'')+'</details>';
  h+='<textarea data-note="'+t.id+'" rows="2" style="width:100%;background:#0d1015;color:#e8ebf0;border:1px solid #2a3140;border-radius:6px" placeholder="메모">'+(R['note|'+t.id]||'')+'</textarea></div>';
  return h}
function render(){document.getElementById('trials').innerHTML=KIT.trials.map(trialHtml).join('');
  document.querySelectorAll('input[type=radio]').forEach(e=>e.onchange=()=>{R[e.dataset.id]=Number(e.value);save()});
  document.querySelectorAll('input[data-flag]').forEach(e=>e.onchange=()=>{R[e.dataset.flag]=e.checked;save()});
  document.querySelectorAll('textarea[data-note]').forEach(e=>e.oninput=()=>{R['note|'+e.dataset.note]=e.value;save()});
  summary()}
function summary(){const el=document.getElementById('sum');if(!revealed){el.hidden=true;return}el.hidden=false;
  let h='<b>방식별 평균 (사람이 매긴 점수)</b><table><tr><th>방식</th>'+CRIT.map(c=>'<th>'+c[1]+'</th>').join('')+'<th>제3의 손</th><th>평가 수</th></tr>';
  KIT.arms.forEach(a=>{h+='<tr><td>'+KIT.armLabel[a]+'</td>'+CRIT.map(([k])=>{const v=KIT.trials.map(t=>R[t.id+'|'+a+'|'+k]).filter(x=>x);return '<td>'+(v.length?(v.reduce((x,y)=>x+y,0)/v.length).toFixed(2):'–')+'</td>'}).join('')+'<td>'+KIT.trials.filter(t=>R[t.id+'|'+a+'|extra']).length+'</td><td>'+KIT.trials.filter(t=>CRIT.some(([k])=>R[t.id+'|'+a+'|'+k])).length+'</td></tr>'});
  el.innerHTML=h+'</table><div class="muted">점수 차이가 작거나 평가 수가 적으면 우열을 말할 수 없습니다. 두 사람 이상이 평가하고 결과 JSON을 합쳐 보세요.</div>'}
document.getElementById('reveal').onclick=()=>{revealed=!revealed;render()};
document.getElementById('dl').onclick=()=>{const b=new Blob([JSON.stringify({kit:KIT.id,ratings:R,perm:Object.fromEntries(KIT.trials.map(t=>[t.id,t.perm]))},null,1)],{type:'application/json'});const a=document.createElement('a');a.href=URL.createObjectURL(b);a.download='lagi-eval-ratings.json';a.click()};
render();
</script></html>`;
fs.writeFileSync(path.join(out, 'rate.html'), html.replace('__KIT__', JSON.stringify(kit).replace(/</g, '\\u003c')));
fs.writeFileSync(path.join(out, 'README.txt'), `AI 합성 평가 키트\n\nrate.html 을 브라우저로 열어 평가합니다(서버 불필요).\n결과가 없으면: scripts/ai-fitting-ab.mjs 를 승인·동의 후 실행 → --results <그 폴더>로 이 키트를 다시 만드세요.\n이 키트는 생성도, 네트워크 호출도 하지 않았습니다.\n`);
console.log(`kit: ${out}\n  trials ${trials.length} (products ${real.length} × styles ${styles.length}${results.length ? '' : ', no generated results yet'})\n  open ${path.join(out, 'rate.html')}`);
