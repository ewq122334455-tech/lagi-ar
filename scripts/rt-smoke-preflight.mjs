#!/usr/bin/env node
/**
 * Preflight for the FIRST real Decart session. It sends NOTHING and spends NOTHING: it checks that your local setup is
 * safe for one short paid test and prints the exact cost. Run it first.
 *   node scripts/rt-smoke-preflight.mjs [--seconds 10] [--fast]
 */
import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';
const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i > 0 ? process.argv[i + 1] : d; };
const seconds = Math.min(20, Math.max(10, Number(arg('seconds', '10'))));
const fast = process.argv.includes('--fast');
const rate = 0.02 * (fast ? 2 : 1); // Decart pricing page: lucy-2.6 / lucy-vton-3.6 realtime 720p $0.02/s, fast mode 2x ($0.04/s)
const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const vars = path.join(root, 'server', 'tryon-worker', '.dev.vars');
const out = [];
const ok = (n, c, i = '') => out.push(`${c ? 'OK  ' : 'FIX '} ${n}${i ? '  — ' + i : ''}`);
const v = fs.existsSync(vars) ? Object.fromEntries(fs.readFileSync(vars, 'utf8').split('\n').filter((l) => l.includes('=') && !l.startsWith('#')).map((l) => [l.slice(0, l.indexOf('=')).trim(), l.slice(l.indexOf('=') + 1).trim().replace(/^"|"$/g, '')])) : {};
ok('server/tryon-worker/.dev.vars exists (local only, git-ignored)', fs.existsSync(vars), 'create it with the lines shown below');
ok('DECART_API_KEY set (a TEST key from a separate Decart project, never the production key)', !!v.DECART_API_KEY && v.DECART_API_KEY.length > 12);
ok('GEMINI_API_KEY NOT set (the smoke test needs no Gemini; a set key lets "real design" cut-outs spend Gemini units)', !v.GEMINI_API_KEY);
ok('ALLOWED_ORIGINS is localhost only', /^http:\/\/localhost:\d+$/.test(v.ALLOWED_ORIGINS ?? ''), v.ALLOWED_ORIGINS ?? 'not set');
ok('REALTIME_SESSION_SECONDS is 10..20', Number(v.REALTIME_SESSION_SECONDS) >= 10 && Number(v.REALTIME_SESSION_SECONDS) <= 20, v.REALTIME_SESSION_SECONDS ?? 'not set (default 20)');
ok('REALTIME_DAILY_SESSIONS is 2 or less for the smoke test', Number(v.REALTIME_DAILY_SESSIONS) > 0 && Number(v.REALTIME_DAILY_SESSIONS) <= 2, v.REALTIME_DAILY_SESSIONS ?? 'not set (default 100)');
ok('REALTIME_MAX_CONCURRENT is 1', v.REALTIME_MAX_CONCURRENT === '1', v.REALTIME_MAX_CONCURRENT ?? 'not set (default 3)');
ok('TRYON_QUOTA is not "unmetered" next to a real key', v.TRYON_QUOTA !== 'unmetered', 'the Worker refuses unmetered unless every origin is localhost');
ok('REALTIME_MODEL is empty (default lucy-2.6) or one of lucy-vton-3.6 / lucy-vton-3.5', !v.REALTIME_MODEL || ['lucy-vton-3.6', 'lucy-vton-3.5', 'lucy-2.6'].includes(v.REALTIME_MODEL), v.REALTIME_MODEL ?? 'default lucy-2.6');
ok('REALTIME_DISABLED is not "1" (kill switch off for the test)', v.REALTIME_DISABLED !== '1');
ok('ADMIN_TOKEN set (needed to read /admin/usage after the run)', (v.ADMIN_TOKEN ?? '').length >= 16, 'at least 16 characters');
// The reference product photo: real LAGI Daily Tote, big enough, plain background (Decart: clean garment shot, white/plain background, at least 512x512).
const tote = path.join(root, 'public', 'products', 'daily-tote', 'images', 'main.jpg');
if (fs.existsSync(tote)) {
  const m = await sharp(tote).metadata();
  const { data } = await sharp(tote).resize(64, 64, { fit: 'fill' }).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  const px = (x, y) => Math.min(data[(y * 64 + x) * 3], data[(y * 64 + x) * 3 + 1], data[(y * 64 + x) * 3 + 2]);
  ok('reference photo public/products/daily-tote/images/main.jpg: at least 512 px and plain white background', Math.min(m.width, m.height) >= 512 && [px(1, 1), px(62, 1), px(1, 62), px(62, 62)].every((c) => c > 215), `${m.width}x${m.height}`);
} else ok('reference photo public/products/daily-tote/images/main.jpg exists', false);
console.log('--- PREFLIGHT (nothing was sent) ---');
console.log(out.join('\n'));
const per = seconds * rate;
console.log(`\nOne session: ${seconds} s x USD ${rate}/s (${fast ? 'FAST mode, 2x' : 'standard speed'}) = USD ${per.toFixed(2)}.`);
console.log(`Worst case for this Worker config (a visitor is allowed ${v.REALTIME_DAILY_SESSIONS ?? 100} session(s) a day): USD ${(per * Number(v.REALTIME_DAILY_SESSIONS ?? 100)).toFixed(2)}.`);
console.log('The price is Decart\'s published rate (docs.platform.decart.ai/getting-started/pricing). Decart bills "active generation" seconds; the Worker cannot see them, so check Decart\'s usage page afterwards.');
const bad = out.filter((l) => l.startsWith('FIX')).length;
console.log(bad ? `\n${bad} item(s) to fix before a paid test.` : '\nAll safe-setup checks pass. A paid test still needs your explicit go-ahead.');
console.log('\nserver/tryon-worker/.dev.vars should contain:\nDECART_API_KEY=<test key>\nALLOWED_ORIGINS=http://localhost:5173\nREALTIME_SESSION_SECONDS=10\nREALTIME_DAILY_SESSIONS=2\nREALTIME_MAX_CONCURRENT=1\nADMIN_TOKEN=<any long random string>');
process.exit(bad ? 1 : 0);
