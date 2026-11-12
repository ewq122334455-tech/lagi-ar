#!/usr/bin/env node
/**
 * Deploy gate for the AI Worker's configuration. Exit code 1 = DO NOT DEPLOY.
 *   node scripts/check-worker-config.mjs [server/tryon-worker/wrangler.toml …]
 * Checks (production file by default):
 *  - the meter can never be switched off: no TRYON_QUOTA var, no "unmetered" anywhere in the file;
 *  - the cost counter exists: a QUOTA Durable Object binding for QuotaCounter AND a migration that creates it
 *    (without them every paid call is refused — safe, but the feature would be dead);
 *  - cost caps, when set, are positive numbers within sane bounds;
 *  - ALLOWED_ORIGINS has no wildcard and no localhost; staging placeholders (STAGING-ORIGIN) are not deployed.
 * A line-based reader is enough for our wrangler.toml; it is not a full TOML parser.
 */
import fs from 'node:fs';
const files = process.argv.slice(2).length ? process.argv.slice(2) : ['server/tryon-worker/wrangler.toml'];
let bad = 0;
const fail = (f, m) => { console.log(`FAIL  ${f}: ${m}`); bad++; };
for (const f of files) {
  const raw = fs.readFileSync(f, 'utf8');
  const lines = raw.split('\n').map((l) => l.replace(/\s+#.*$/, '').trimEnd()).filter((l) => l.trim() && !l.trim().startsWith('#'));
  const text = lines.join('\n');
  if (/TRYON_QUOTA/i.test(text) || /unmetered/i.test(text)) fail(f, 'TRYON_QUOTA / "unmetered" must never appear in a deployed Worker config');
  if (!/\[\[durable_objects\.bindings\]\][\s\S]*?name\s*=\s*"QUOTA"[\s\S]*?class_name\s*=\s*"QuotaCounter"/.test(text)) fail(f, 'missing the QUOTA Durable Object binding (class QuotaCounter)');
  if (!/\[\[migrations\]\][\s\S]*?new_sqlite_classes\s*=\s*\[[^\]]*"QuotaCounter"/.test(text)) fail(f, 'no migration creates QuotaCounter');
  for (const [k, max] of [['TRYON_DAILY_UNITS_SITE', 5000], ['TRYON_DAILY_UNITS_PER_IP', 200], ['REALTIME_DAILY_SESSIONS', 2000]]) {
    const m = new RegExp(`^${k}\\s*=\\s*"([^"]*)"`, 'm').exec(text);
    if (m) { const v = Number(m[1]); if (!Number.isFinite(v) || v <= 0 || v > max) fail(f, `${k}="${m[1]}" must be a number between 1 and ${max}`); }
  }
  const o = /^ALLOWED_ORIGINS\s*=\s*"([^"]*)"/m.exec(text);
  if (!o) fail(f, 'ALLOWED_ORIGINS is not set');
  else {
    for (const origin of o[1].split(',').map((x) => x.trim())) {
      if (/\*/.test(origin)) fail(f, `wildcard origin "${origin}"`);
      if (/localhost|127\.0\.0\.1|\[::1\]/.test(origin)) fail(f, `local origin "${origin}" in a deployed config`);
      if (/STAGING-ORIGIN|example\.com|\.example/.test(origin)) fail(f, `placeholder origin "${origin}" — fill in the real staging origin first`);
      if (!/^https:\/\//.test(origin)) fail(f, `origin "${origin}" is not https`);
    }
  }
  if (/STAGING-ORIGIN/.test(text)) fail(f, 'STAGING-ORIGIN placeholder still present');
  if (!bad) console.log(`PASS  ${f}`);
}
process.exit(bad ? 1 : 0);
