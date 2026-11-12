#!/usr/bin/env node
/**
 * Compares on-device bench results (the JSON from `?bench=1`: copy / download / saved by device-test-server).
 *   node scripts/compare-bench.mjs bench-results/*.json
 *   node scripts/compare-bench.mjs all-runs.json        (the "저장된 전체 복사" array)
 * Groups by device + product and puts V1 / V2 / V3 side by side. Missing values stay empty — nothing is guessed.
 * Criteria are the proposals in docs/ai-fitting-upgrade/DEVICE-TEST-PROCEDURE.md.
 */
import fs from 'node:fs';
const runs = process.argv.slice(2).flatMap((f) => { const j = JSON.parse(fs.readFileSync(f, 'utf8')); return Array.isArray(j) ? j : [j]; }).filter((r) => r?.meta);
if (!runs.length) { console.error('usage: compare-bench.mjs <result.json…>'); process.exit(2); }
const parse = (r) => { const [engine, product] = String(r.meta.label ?? '').split(' '); return { engine, product, device: r.meta.device ?? r.meta.ua?.slice(0, 40) ?? '?' }; };
const groups = new Map();
for (const r of runs) { const p = parse(r); const k = `${p.device} | ${p.product}`; (groups.get(k) ?? groups.set(k, {}).get(k))[p.engine] = r; }
const f = (v, d = 1) => (v === null || v === undefined ? '—' : typeof v === 'number' ? v.toFixed(d) : String(v));
const metrics = [
  ['측정 시간(s)', 'seconds', 0, ''],
  ['FPS 앞 3분의1', 'fpsFirstThird', 1, ''],
  ['FPS 뒤 3분의1', 'fpsLastThird', 1, '≥24'],
  ['FPS 하락(%)', 'fpsDropPct', 1, '≤15'],
  ['감지 ms 앞', 'detectMsFirstThird', 1, ''],
  ['감지 ms 뒤', 'detectMsLastThird', 1, '≤앞×1.3'],
  ['최저 1% FPS', 'worstFps1pctLow', 1, '≥12'],
  ['50ms 초과 프레임', 'longFramesTotal', 0, ''],
  ['가방 표시 프레임(%)', 'framesDrawnPct', 1, ''],
  ['추적 성공 프레임(%)', 'framesTrackedPct', 1, ''],
  ['유실 횟수', 'lossEvents', 0, ''],
  ['유실 평균(ms)', 'lossMeanMs', 0, ''],
  ['유실 중 표시(ms)', 'lossDrawnMsMean', 0, ''],
  ['복귀 시 최대 이동(px/frame)', 'recoverStepPxMax', 1, ''],
  ['배터리 %/분', 'batteryPctPerMin', 2, '+0.3p 이내'],
];
for (const [k, g] of groups) {
  console.log(`\n## ${k}`);
  const t = [['지표', 'V1', 'V2', 'V3', '기준(제안)'], ...metrics.map(([n, key, d, crit]) => [n, ...['v1', 'v2', 'v3'].map((e) => f(g[e]?.[key], d)), crit])];
  const w = t[0].map((_, i) => Math.max(...t.map((r) => String(r[i]).length)));
  for (const r of t) console.log('| ' + r.map((c, i) => String(c).padEnd(w[i])).join(' | ') + ' |');
  const missing = ['v1', 'v2', 'v3'].filter((e) => !g[e]);
  if (missing.length) console.log(`(결과 없음: ${missing.join(', ')} — 비교 불가, 추정하지 않음)`);
  const short = ['v1', 'v2', 'v3'].filter((e) => g[e] && g[e].seconds < 240);
  if (short.length) console.log(`(주의: ${short.join(', ')}는 4분 미만 — 열 제한(FPS 하락) 판단 불가)`);
}
