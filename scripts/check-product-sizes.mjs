#!/usr/bin/env node
/**
 * Product size consistency check (no network, nothing generated): for every product in the manifest it compares
 *   - the product's real dimensions (product.json `dimensions`, cm) with the 3D model's (`model3d`, cm; the renderer converts cm → m),
 *   - each 3D face texture's picture proportions with the face it is mapped onto,
 * and says plainly which products have no data to check. It can show that the DATA agrees with itself; it cannot show
 * that either number is the true size of the physical product — that needs a measurement (a ruler photo/video).
 *   node scripts/check-product-sizes.mjs [--json out.json]
 */
import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';
const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..', 'public');
const manifest = JSON.parse(fs.readFileSync(path.join(ROOT, 'products', 'manifest.json'), 'utf8'));
const ids = manifest.products.map((p) => (typeof p === 'string' ? p : p.id));
const pct = (a, b) => (a && b ? Math.abs(a - b) / b : null);
const rows = [];
for (const id of ids) {
  const p = JSON.parse(fs.readFileSync(path.join(ROOT, 'products', id, 'product.json'), 'utf8'));
  const real = !p.sample && p.name?.status === 'VERIFIED' && p.price?.status === 'VERIFIED' && p.images?.length;
  const d = p.dimensions ?? {};
  const m = p.model3d;
  const r = { id, real: !!real, dims: d.widthCm ? `${d.widthCm}×${d.heightCm ?? '?'}×${d.depthCm ?? '?'}` : null, model: m ? `${m.widthCm}×${m.heightCm}×${m.depthCm} (손잡이 ${m.handleCm})` : null, issues: [], notes: [] };
  if (!real) { r.notes.push(p.sample ? '샘플 상품(사이트에 노출되지 않음)' : '검증되지 않은 자리표시 상품'); rows.push(r); continue; }
  if (!d.widthCm) r.issues.push('상품 치수(product.json dimensions)가 없음');
  if (!m) r.issues.push('3D 모델 없음(실시간 착용 불가)');
  if (m) {
    for (const [k, a, b] of [['폭', m.widthCm, d.widthCm], ['높이', m.heightCm, d.heightCm], ['깊이', m.depthCm, d.depthCm]]) {
      const e = pct(a, b);
      if (b == null) r.notes.push(`상품 ${k} 데이터 없음`);
      else if (e > 0.1) r.issues.push(`3D ${k} ${a}cm ≠ 상품 ${k} ${b}cm (${(e * 100).toFixed(0)}% 차이)`);
    }
    // faces: picture proportions vs the face's proportions
    const faces = m.faces ?? m.textures ?? {};
    const want = { front: [m.widthCm, m.heightCm], back: [m.widthCm, m.heightCm], left: [m.depthCm, m.heightCm], right: [m.depthCm, m.heightCm], side: [m.depthCm, m.heightCm], top: [m.widthCm, m.depthCm], bottom: [m.widthCm, m.depthCm] };
    for (const [face, rel] of Object.entries(faces)) {
      if (!rel || !want[face]) continue;
      const f = path.join(ROOT, rel);
      if (!fs.existsSync(f)) { r.issues.push(`텍스처 ${face} 파일 없음: ${rel}`); continue; }
      const meta = await sharp(f).metadata();
      const aspect = meta.width / meta.height, target = want[face][0] / want[face][1];
      const e = Math.abs(aspect - target) / target;
      r.notes.push(`${face}: 사진 비율 ${aspect.toFixed(2)} ↔ 면 비율 ${target.toFixed(2)} (${(e * 100).toFixed(0)}%)`);
      if (e > 0.25) r.issues.push(`텍스처 ${face}의 가로세로비가 면과 ${(e * 100).toFixed(0)}% 다름(늘어나 보일 수 있음)`);
    }
    if (m.type === 'box' && m.openTop && !m.faces?.back) r.notes.push('뒷면·옆면 텍스처가 없어 단색(bodyColor)으로 대체됨');
    if (m.type === 'tote' && m.textures) { /* four views present */ }
    if (m.type !== 'pouch' && m.handleCm > m.heightCm) r.issues.push('손잡이 높이가 본체 높이보다 큼'); // a pouch's "handle" is its cord, which may be longer than the body
  }
  r.status = r.issues.length ? '확인 필요' : '데이터 일관';
  rows.push(r);
}
const show = rows.filter((r) => r.real);
console.log(`실제 제품 ${show.length}개(검증됨) / 샘플·자리표시 ${rows.length - show.length}개\n`);
for (const r of show) {
  console.log(`## ${r.id} — ${r.status}`);
  console.log(`   상품 치수 ${r.dims ?? '없음'} / 3D ${r.model ?? '없음'}`);
  for (const i of r.issues) console.log(`   ! ${i}`);
  for (const n of r.notes) console.log(`   · ${n}`);
}
console.log('\n[한계] 위 비교는 데이터끼리의 일관성입니다. 실물의 진짜 크기는 자·기준물이 찍힌 사진/영상으로만 확인됩니다.');
const out = process.argv.indexOf('--json');
if (out > 0) fs.writeFileSync(process.argv[out + 1], JSON.stringify(rows, null, 1));
