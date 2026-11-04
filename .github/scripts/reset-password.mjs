// Sets a new password for one member account, run by the repository owner from GitHub Actions.
// Reads RESET_EMAIL and RESET_PASSWORD from repository secrets (masked in logs), hashes the password
// the same way the Worker does (PBKDF2-SHA256, 100k iterations, 16-byte salt) and writes the account
// back to the USERS KV namespace. The account's id, name and orders are kept.
import { execFileSync } from 'node:child_process';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const email = (process.env.RESET_EMAIL ?? '').trim().toLowerCase();
const password = process.env.RESET_PASSWORD ?? '';
const fail = (msg) => {
  console.error(`::error::${msg}`);
  process.exit(1);
};
if (!email) fail('RESET_EMAIL 시크릿이 비어 있습니다.');
if (password.length < 8) fail('RESET_PASSWORD는 8자 이상이어야 합니다.');

const wrangler = (...args) => execFileSync('npx', ['--yes', 'wrangler@4', ...args], { encoding: 'utf8', cwd: 'server/tryon-worker', stdio: ['ignore', 'pipe', 'pipe'] });

const listed = wrangler('kv', 'namespace', 'list');
const namespaces = JSON.parse(listed.slice(listed.indexOf('['), listed.lastIndexOf(']') + 1));
const users = namespaces.find((n) => /USERS/i.test(n.title));
if (!users) fail('회원 저장소(USERS)를 찾지 못했습니다.');

let raw;
try {
  raw = wrangler('kv', 'key', 'get', `user:${email}`, '--namespace-id', users.id, '--remote', '--text');
} catch {
  fail('이 이메일로 가입한 계정이 없습니다. 시크릿의 이메일을 확인해 주세요.');
}
const user = JSON.parse(raw.slice(raw.indexOf('{'), raw.lastIndexOf('}') + 1));

const salt = crypto.randomBytes(16).toString('hex');
user.salt = salt;
user.hash = crypto.pbkdf2Sync(password, Buffer.from(salt, 'hex'), 100_000, 32, 'sha256').toString('hex');

const file = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'reset-')), 'user.json');
fs.writeFileSync(file, JSON.stringify(user));
wrangler('kv', 'key', 'put', `user:${email}`, '--path', file, '--namespace-id', users.id, '--remote');
fs.rmSync(file);
console.log('비밀번호를 새로 설정했습니다. 이제 RESET_PASSWORD 시크릿을 지워 주세요.');
