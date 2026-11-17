#!/usr/bin/env node
/**
 * Same-input model comparison helper. Both models must see the IDENTICAL camera input, so this converts one clip you recorded
 * (a person holding the product) into a looping fake camera and opens Chrome on the AI-video page with it.
 *
 *   node scripts/rt-compare-launch.mjs --clip my-clip.mp4 [--product daily-tote] [--pipe A|B|C|D|DC] [--provider gemini|fal] [--dry-run]
 *
 * The same clip + product + a different --pipe is the like-for-like comparison (the pipeline sets the realtime model, so the Worker
 * does not have to be restarted between runs):
 *   A Gemini-redrawn cut-out + vton-3.6 | B original photo + vton-3.6 (default) | C Extreme Precision + vton-3.6
 *   D original photo + lucy-2.6        | DC Extreme Precision + lucy-2.6
 *
 * It starts nothing paid by itself: the session only starts when YOU click start in the page (each run is one paid session).
 * Needs ffmpeg (brew install ffmpeg) and Google Chrome. Conversion: 1280x720, 30 fps, y4m (Chrome's fake-camera format).
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync, spawn } from 'node:child_process';
const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i > 0 ? process.argv[i + 1] : d; };
const clip = arg('clip');
const product = arg('product', 'daily-tote');
const pipe = arg('pipe');
const provider = arg('provider');
if (pipe && !/^(A|B|C|D|DC)$/i.test(pipe)) { console.log('--pipe must be A, B, C, D or DC'); process.exit(2); }
const dry = process.argv.includes('--dry-run');
if (!clip || !fs.existsSync(clip)) { console.log('usage: node scripts/rt-compare-launch.mjs --clip <video file> [--product daily-tote] [--dry-run]'); process.exit(2); }
const out = path.join(os.tmpdir(), `lagi-compare-${path.basename(clip, path.extname(clip))}.y4m`);
const ff = ['-y', '-i', clip, '-vf', 'scale=1280:720:force_original_aspect_ratio=increase,crop=1280:720,fps=30', '-pix_fmt', 'yuv420p', '-t', '20', out];
const chromePaths = ['/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', '/usr/bin/google-chrome', '/opt/pw-browsers/chromium-1194/chrome-linux/chrome'];
const chrome = chromePaths.find((p) => fs.existsSync(p));
const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'lagi-compare-profile-'));
const url = `http://localhost:5173/#/again?p=${product}&m=live${pipe ? `&pipe=${pipe.toUpperCase()}` : ''}${provider ? `&provider=${provider}` : ''}`;
const flags = ['--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream', `--use-file-for-fake-video-capture=${out}`, `--user-data-dir=${profile}`, '--no-first-run', url];
console.log('1) convert :', 'ffmpeg', ff.join(' '));
console.log('2) open    :', chrome ?? '(Chrome not found)', flags.join(' '));
console.log('The page needs the Worker (port 8787) and `VITE_TRYON_API_URL=http://localhost:8787 npm run dev` running, as in SMOKE-TEST.md.');
if (dry) { console.log('(dry run: nothing converted or opened)'); process.exit(0); }
const r = spawnSync('ffmpeg', ff, { stdio: 'inherit' });
if (r.status !== 0) { console.log('ffmpeg failed or is not installed (brew install ffmpeg).'); process.exit(3); }
if (!chrome) { console.log('Google Chrome not found.'); process.exit(4); }
spawn(chrome, flags, { detached: true, stdio: 'ignore' }).unref();
console.log('Chrome opened with the clip as its camera. Tick consent, then click start ONCE.');
