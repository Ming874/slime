// 伺服器整合測試：用假的 Google（token 端點）跑完整的登入流程（含 PKCE），再測允許名單、管理員、存檔版本衝突與刪除資料。
// 執行：npm test（不會連到真的 Google，也不會動到 data/）
import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { DatabaseSync } from 'node:sqlite';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const CLIENT_ID = 'test-client.apps.googleusercontent.com';
const SECRET = 'test-secret';
const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');

// ---------- 假的 Google：授權碼＝要登入的信箱；換 token 時檢查用戶端密碼與 PKCE ----------
const challenges = new Map(); // code → { challenge, nonce }
const google = http.createServer((req, res) => {
  let body = '';
  req.on('data', (c) => (body += c));
  req.on('end', () => {
    const p = new URLSearchParams(body), code = p.get('code'), c = challenges.get(code);
    const verifierOk = c && crypto.createHash('sha256').update(p.get('code_verifier') || '').digest('base64url') === c.challenge;
    if (p.get('client_secret') !== SECRET || !verifierOk || p.get('grant_type') !== 'authorization_code') {
      res.writeHead(400, { 'content-type': 'application/json' });
      return res.end(JSON.stringify({ error: 'invalid_grant' }));
    }
    const [email, name = 'Test Student'] = code.split('|');
    const claims = { iss: 'https://accounts.google.com', aud: CLIENT_ID, sub: 'sub-' + email, email, email_verified: !email.startsWith('unverified'), name, given_name: name, nonce: c.nonce, exp: Math.floor(Date.now() / 1000) + 3600, iat: Math.floor(Date.now() / 1000) };
    res.writeHead(200, { 'content-type': 'application/json' });
    res.end(JSON.stringify({ id_token: `${b64({ alg: 'RS256' })}.${b64(claims)}.sig` }));
  });
});
await new Promise((r) => google.listen(0, '127.0.0.1', r));

// ---------- 啟動伺服器 ----------
const DATA = fs.mkdtempSync(path.join(os.tmpdir(), 'slime-test-'));
const PORT = 20000 + Math.floor(Math.random() * 20000);
const BASE = `http://127.0.0.1:${PORT}`;
const srv = spawn(process.execPath, ['--disable-warning=ExperimentalWarning', path.join(HERE, 'server.js')], {
  env: {
    ...process.env, PORT: String(PORT), HOST: '127.0.0.1', PUBLIC_URL: BASE, DATA_DIR: DATA, SERVE_STATIC: '1',
    GOOGLE_CLIENT_ID: CLIENT_ID, GOOGLE_CLIENT_SECRET: SECRET, ADMIN_EMAILS: 'admin@test.dev, Boss@Test.dev',
    GOOGLE_AUTH_URL: 'https://google.invalid/auth', GOOGLE_TOKEN_URL: `http://127.0.0.1:${google.address().port}/token`,
  },
  stdio: ['ignore', 'pipe', 'pipe'],
});
let log = '';
srv.stdout.on('data', (d) => (log += d));
srv.stderr.on('data', (d) => (log += d));
for (let i = 0; i < 50; i++) {
  try { if ((await fetch(BASE + '/api/health')).ok) break; } catch { /* 還沒起來 */ }
  await new Promise((r) => setTimeout(r, 100));
}
test.after(() => { srv.kill(); google.close(); fs.rmSync(DATA, { recursive: true, force: true }); });

// ---------- 小工具 ----------
const cookieOf = (res, name) => (res.headers.getSetCookie?.() || []).map((c) => c.split(';')[0]).find((c) => c.startsWith(name + '='))?.slice(name.length + 1);
async function login(email, { tamperState = false } = {}) {
  const start = await fetch(BASE + '/api/auth/google', { redirect: 'manual' });
  assert.equal(start.status, 302);
  const loc = new URL(start.headers.get('location'));
  assert.equal(loc.origin + loc.pathname, 'https://google.invalid/auth');
  assert.equal(loc.searchParams.get('code_challenge_method'), 'S256');
  assert.equal(loc.searchParams.get('response_type'), 'code');
  assert.equal(loc.searchParams.get('redirect_uri'), BASE + '/api/auth/google/callback');
  const oauth = cookieOf(start, 'slime_oauth');
  assert.ok(oauth);
  assert.match(start.headers.getSetCookie().join(), /HttpOnly; SameSite=Lax; Path=\/api\/auth\//);
  challenges.set(email, { challenge: loc.searchParams.get('code_challenge'), nonce: loc.searchParams.get('nonce') });
  const state = tamperState ? 'x' + loc.searchParams.get('state') : loc.searchParams.get('state');
  const cb = await fetch(`${BASE}/api/auth/google/callback?code=${encodeURIComponent(email)}&state=${state}`, { redirect: 'manual', headers: { cookie: `slime_oauth=${oauth}` } });
  assert.equal(cb.status, 302);
  return { location: cb.headers.get('location'), sid: cookieOf(cb, 'slime_sid'), setCookie: cb.headers.getSetCookie().join('\n') };
}
const client = (sid) => async (method, url, body, headers = {}) => {
  const r = await fetch(BASE + url, { method, headers: { cookie: `slime_sid=${sid}`, 'x-slime': '1', ...(body ? { 'content-type': 'application/json' } : {}), ...headers }, body: body && JSON.stringify(body) });
  return { status: r.status, body: await r.json().catch(() => ({})) };
};
const saveData = (o) => JSON.stringify({ money: 60, earned: 0, last: Date.now(), ...o });

let admin, student;

test('沒登入：/api/me 回 401', async () => {
  assert.equal((await fetch(BASE + '/api/me')).status, 401);
});

test('ADMIN_EMAILS 的管理員可以登入，通行證是 HttpOnly Cookie', async () => {
  const r = await login('admin@test.dev');
  assert.equal(r.location, '/');
  assert.ok(r.sid);
  assert.match(r.setCookie, /slime_sid=[^;]+; HttpOnly; SameSite=Lax; Path=\/; Max-Age=2592000/);
  admin = client(r.sid);
  const me = await admin('GET', '/api/me');
  assert.equal(me.status, 200);
  assert.equal(me.body.user.admin, true);
  assert.equal(me.body.user.email, undefined, '畫面用的資料不含 email');
  // 大寫寫的 ADMIN_EMAILS 也算
  assert.equal((await login('boss@test.dev')).location, '/');
});

test('不在名單、取消登入、state 不符、信箱沒驗證都登不進來', async () => {
  assert.equal((await login('stranger@gmail.com')).location, '/?login=denied');
  assert.equal((await login('admin@test.dev', { tamperState: true })).location, '/?login=expired');
  const cancel = await fetch(`${BASE}/api/auth/google/callback?error=access_denied&state=x`, { redirect: 'manual' });
  assert.equal(cancel.headers.get('location'), '/?login=cancelled');
});

test('管理員加入網域與信箱；非管理員不能用管理功能', async () => {
  const bad = await admin('POST', '/api/admin/allow', { entries: 'not-an-email' });
  assert.equal(bad.status, 400);
  const add = await admin('POST', '/api/admin/allow', { entries: '@school.test\nfriend@gmail.com, unverified@school.test', note: '三年二班' });
  assert.equal(add.status, 200);
  assert.equal(add.body.added, 3);
  const r = await login('kid@school.test|陳小明同學超級長的名字ABCDEFG');
  assert.equal(r.location, '/');
  student = client(r.sid);
  const me = await student('GET', '/api/me');
  assert.equal(me.body.user.admin, undefined);
  assert.equal([...me.body.user.name].length, 12, '暱稱最多 12 個字');
  assert.equal((await student('GET', '/api/admin/allow')).status, 403);
  assert.equal((await login('unverified@school.test')).location, '/?login=unverified');
  const list = await admin('GET', '/api/admin/allow');
  const dom = list.body.list.find((x) => x.entry === '@school.test');
  assert.equal(dom.note, '三年二班');
  assert.equal(dom.users, 1);
  // 網域不能設成管理員
  assert.equal((await admin('PATCH', '/api/admin/allow', { entry: '@school.test', admin: true })).status, 400);
});

test('改暱稱', async () => {
  const r = await student('PATCH', '/api/me', { name: '  <b>小明</b>\u0000  ' });
  assert.equal(r.status, 200);
  assert.equal(r.body.user.name, 'b小明/b');
  assert.equal((await student('PATCH', '/api/me', { name: '   ' })).status, 400);
});

test('擋 CSRF：沒有自訂標頭或來自別的網站', async () => {
  assert.equal((await student('PUT', '/api/save', { base: 0, data: saveData() }, { 'x-slime': '' })).status, 403);
  assert.equal((await student('PUT', '/api/save', { base: 0, data: saveData() }, { origin: 'https://evil.example' })).status, 403);
});

test('存檔版本：舊裝置不能覆蓋新進度；同一台裝置連續存檔不算衝突；選了的那份換掉時另一份保留', async () => {
  assert.equal((await student('GET', '/api/save')).body.save, null);
  let r = await student('PUT', '/api/save', { base: 0, data: saveData({ earned: 100, money: 160 }), device: 'deviceAAAA' });
  assert.equal(r.status, 200);
  assert.equal(r.body.ver, 1);
  r = await student('PUT', '/api/save', { base: 1, data: saveData({ earned: 200 }), device: 'deviceAAAA' });
  assert.equal(r.body.ver, 2);
  // 另一台裝置還拿著版號 1 → 409
  r = await student('PUT', '/api/save', { base: 1, data: saveData({ earned: 150 }), device: 'deviceBBBB' });
  assert.equal(r.status, 409);
  assert.equal(r.body.ver, 2);
  // 同一台裝置（A）拿舊版號存（例如關頁面時的請求比較晚到）→ 照存
  r = await student('PUT', '/api/save', { base: 1, data: saveData({ earned: 210 }), device: 'deviceAAAA' });
  assert.equal(r.status, 200);
  assert.equal(r.body.ver, 3);
  // B 選擇「保留這台的進度」→ 照存，A 的那份保留 30 天
  r = await student('PUT', '/api/save', { base: 1, data: saveData({ earned: 220 }), device: 'deviceBBBB', force: 'conflict_local' });
  assert.equal(r.body.ver, 4);
  assert.equal((await student('POST', '/api/save/keep', { data: saveData({ earned: 1 }), reason: 'choose_cloud' })).status, 200);
  const s = await student('GET', '/api/save');
  assert.equal(JSON.parse(s.body.save.data).earned, 220);
  assert.equal(s.body.save.device, 'deviceBBBB');
  const db = new DatabaseSync(path.join(DATA, 'slime.db'), { readOnly: true });
  const reasons = db.prepare('SELECT reason FROM archived_saves ORDER BY id').all().map((x) => x.reason);
  db.close();
  assert.deepEqual(reasons, ['conflict_local', 'choose_cloud']);
  // 格式不對
  assert.equal((await student('PUT', '/api/save', { base: 4, data: '[1,2]' })).status, 400);
  assert.equal((await student('PUT', '/api/save', { base: 4, data: 'x'.repeat(1_000_001) })).status, 400);
});

test('存檔數字不合理：照存但標記帳號', async () => {
  const flag = () => { const db = new DatabaseSync(path.join(DATA, 'slime.db'), { readOnly: true }); const f = db.prepare("SELECT flag FROM users WHERE email = 'kid@school.test'").get().flag; db.close(); return f; };
  assert.equal(flag(), null);
  const r = await student('PUT', '/api/save', { base: 4, data: saveData({ earned: 900000, money: 900000 }), device: 'deviceBBBB' });
  assert.equal(r.status, 200);
  assert.match(flag(), /分鐘內收入增加/);
});

test('管理員移除名單項目：已登入的人下一個請求就被擋；不能移除自己、不能少於一位管理員', async () => {
  assert.equal((await admin('DELETE', '/api/admin/allow?entry=admin%40test.dev')).status, 400);
  assert.equal((await admin('PATCH', '/api/admin/allow', { entry: 'admin@test.dev', admin: false })).status, 400);
  assert.equal((await admin('DELETE', '/api/admin/allow?entry=%40school.test')).status, 200);
  assert.equal((await student('GET', '/api/me')).status, 401);
  assert.equal((await admin('PATCH', '/api/admin/allow', { entry: 'boss@test.dev', admin: false })).status, 200);
  assert.equal((await admin('DELETE', '/api/admin/allow?entry=boss%40test.dev')).status, 200);
  const list = (await admin('GET', '/api/admin/allow')).body.list;
  assert.deepEqual(list.filter((x) => x.admin).map((x) => x.entry), ['admin@test.dev']);
});

test('刪除我的資料：帳號、存檔、保留的存檔、通行證都刪掉', async () => {
  await admin('POST', '/api/admin/allow', { entries: '@school.test' });
  const s = client((await login('kid@school.test')).sid);
  assert.ok((await s('GET', '/api/save')).body.save, '重新加入名單後存檔還在');
  assert.equal((await s('DELETE', '/api/me')).status, 200);
  assert.equal((await s('GET', '/api/me')).status, 401);
  const db = new DatabaseSync(path.join(DATA, 'slime.db'), { readOnly: true });
  const n = (t) => db.prepare(`SELECT COUNT(*) AS n FROM ${t} WHERE user_id NOT IN (SELECT id FROM users)`).get().n;
  assert.equal(db.prepare("SELECT COUNT(*) AS n FROM users WHERE email = 'kid@school.test'").get().n, 0);
  assert.equal(n('saves') + n('archived_saves') + n('sessions'), 0);
  db.close();
});

test('登出', async () => {
  const s = client((await login('friend@gmail.com')).sid);
  assert.equal((await s('GET', '/api/me')).status, 200);
  assert.equal((await s('POST', '/api/logout', {})).status, 200);
  assert.equal((await s('GET', '/api/me')).status, 401);
});

test('本機模式提供網站檔案，但不提供伺服器程式與設定', async () => {
  assert.equal((await fetch(BASE + '/')).status, 200);
  assert.equal((await fetch(BASE + '/admin')).status, 200);
  assert.equal((await fetch(BASE + '/server/server.js')).status, 404);
  assert.equal((await fetch(BASE + '/.env')).status, 404);
});

test('每天的資料庫快照', () => {
  assert.ok(fs.readdirSync(path.join(DATA, 'backups')).some((f) => /^slime-\d{4}-\d{2}-\d{2}\.db$/.test(f)), log);
});
