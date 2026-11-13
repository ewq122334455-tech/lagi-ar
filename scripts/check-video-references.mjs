#!/usr/bin/env node
// For each real product: is its first image a usable AI-video reference? (size, background, 3D, dimensions). No network.
import fs from 'node:fs'; import path from 'node:path'; import sharp from 'sharp';
const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..', 'public', 'products');
const rows = [];
for (const id of fs.readdirSync(root)) {
  const pj = path.join(root, id, 'product.json'); if (!fs.existsSync(pj)) continue;
  const j = JSON.parse(fs.readFileSync(pj, 'utf8')); const imgs = j.images ?? [];
  const row = { id, name: j.name?.value, category: j.category?.value, status: j.status ?? j.name?.status, images: imgs.length, dims: j.dimensions?.widthCm ? `${j.dimensions.widthCm}x${j.dimensions.heightCm}x${j.dimensions.depthCm}` : null, has3d: !!j.model3d, notes: [] };
  const first = imgs[0] && path.join(root, id, imgs[0].replace(/^.*products\/[^/]+\//, ''));
  if (!first || !fs.existsSync(first)) { row.notes.push('이미지 파일 없음'); row.usable = false; rows.push(row); continue; }
  const m = await sharp(first).metadata(); row.size = `${m.width}x${m.height}`;
  const { data, info } = await sharp(first).resize(64, 64, { fit: 'fill' }).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  const px = (x, y) => { const i = (y * 64 + x) * 3; return Math.min(data[i], data[i + 1], data[i + 2]); };
  const corners = [px(1, 1), px(62, 1), px(1, 62), px(62, 62)]; row.whiteBg = corners.every((v) => v > 215);
  if (Math.min(m.width, m.height) < 600) row.notes.push('해상도 낮음(<600px)');
  if (!row.whiteBg) row.notes.push('배경이 흰색이 아님 → 컷아웃 단계(Gemini 1회)가 필요');
  if (!row.dims) row.notes.push('치수 없음');
  row.usable = true; rows.push(row);
}
console.log(JSON.stringify(rows, null, 1));
