#!/usr/bin/env node
/**
 * Creates server/tryon-worker/.dev.vars for the Level 2 smoke test, with the safe values from docs/ai-video-production/SMOKE-TEST.md.
 * Run it in YOUR OWN terminal, on the machine that will run the test:
 *
 *   node scripts/rt-smoke-setup.mjs            # asks for the Decart TEST key (hidden input), generates ADMIN_TOKEN
 *   node scripts/rt-smoke-setup.mjs --no-key   # writes everything except the key (add it later by running the line above)
 *
 * The key and the admin token are NEVER printed, logged or sent anywhere. The file is created with mode 600 and is git-ignored.
 * Existing DECART_API_KEY / ADMIN_TOKEN values in an existing file are kept. This script makes no network call.
 */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import readline from 'node:readline';

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const file = path.join(root, 'server', 'tryon-worker', '.dev.vars');
const parse = (t) => Object.fromEntries(t.split('\n').filter((l) => l.includes('=') && !l.startsWith('#')).map((l) => [l.slice(0, l.indexOf('=')).trim(), l.slice(l.indexOf('=') + 1).trim()]));
const old = fs.existsSync(file) ? parse(fs.readFileSync(file, 'utf8')) : {};
let key = old.DECART_API_KEY ?? '';
const withGemini = process.argv.includes('--gemini');
let gemini = old.GEMINI_API_KEY ?? '';

function askHidden(q) {
  return new Promise((resolve) => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout, terminal: true });
    rl._writeToOutput = (s) => { if (s.includes(q)) process.stdout.write(s); }; // show the question, never the typed characters
    rl.question(q, (a) => { rl.close(); process.stdout.write('\n'); resolve(a.trim()); });
  });
}

if (!key && !process.argv.includes('--no-key')) {
  if (!process.stdin.isTTY) { console.log('No terminal for hidden input. Run this in your own terminal, or use --no-key and add the key later.'); process.exit(2); }
  key = await askHidden('Decart TEST API key (input is hidden, never shown or saved elsewhere): ');
  if (!key || /\s/.test(key) || key.length < 12) { console.log('That does not look like an API key. Nothing was written.'); process.exit(3); }
}

if (withGemini && !gemini) {
  if (!process.stdin.isTTY) { console.log('No terminal for hidden input. Run this in your own terminal.'); process.exit(2); }
  gemini = await askHidden('Gemini TEST API key (input is hidden, never shown or saved elsewhere): ');
  if (!gemini || /\s/.test(gemini) || gemini.length < 12) { console.log('That does not look like an API key. Nothing was written.'); process.exit(3); }
}
const lines = [
  '# Level 2 smoke test (local only, git-ignored). Do not paste this file anywhere.',
  `DECART_API_KEY=${key}`,
  'ALLOWED_ORIGINS=http://localhost:5173',
  'REALTIME_SESSION_SECONDS=10',
  `REALTIME_DAILY_SESSIONS=${withGemini ? 4 : 2}`,
  ...(withGemini ? ['REALTIME_PER_IP_DAILY=4'] : []),
  'REALTIME_MAX_CONCURRENT=1',
  ...(gemini ? [`GEMINI_API_KEY=${gemini}`, 'TRYON_DAILY_UNITS_SITE=8', 'TRYON_DAILY_UNITS_PER_IP=8'] : []),
  `ADMIN_TOKEN=${old.ADMIN_TOKEN && old.ADMIN_TOKEN.length >= 16 ? old.ADMIN_TOKEN : crypto.randomBytes(24).toString('hex')}`,
  '',
];
fs.mkdirSync(path.dirname(file), { recursive: true });
fs.writeFileSync(file, lines.join('\n'), { mode: 0o600 });
fs.chmodSync(file, 0o600);
console.log(`Wrote ${path.relative(root, file)} (mode 600).`);
console.log(`  DECART_API_KEY : ${key ? 'set (not shown)' : 'NOT SET — run again without --no-key in your own terminal'}`);
console.log('  ADMIN_TOKEN    : generated (not shown). Read it for the usage check with:');
console.log("    export ADMIN_TOKEN=$(grep '^ADMIN_TOKEN=' server/tryon-worker/.dev.vars | cut -d= -f2-)");
console.log(`  GEMINI_API_KEY : ${gemini ? 'set (not shown); Gemini units capped at 8 per day' : 'not set (Gemini stays off)'}`);
console.log('  Not written on purpose: REALTIME_MODEL, TRYON_QUOTA, REALTIME_DISABLED.');
