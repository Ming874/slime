// 史萊姆捏捏工坊的伺服器：Google 登入（OAuth 2.0 授權碼＋PKCE）與玩家雲端存檔（SQLite）。
// 正式站：Caddy 提供網站檔案（Next.js 靜態匯出的 out/），把 /api/ 轉過來（見 Caddyfile、start.sh）。
// 本機：npm run dev 時由 next dev 提供頁面；npm start（SERVE_STATIC=1）時這裡也順便提供 out/ 的檔案。
// 沒有外部套件，只用 Node 內建模組（node:sqlite 需要 Node 22.13 以上）。
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { DatabaseSync } from 'node:sqlite';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const env = process.env;
const PORT = Number(env.PORT || 8778);
const HOST = env.HOST || '127.0.0.1';
// 網站對外網址：Google 回呼網址、Cookie 要不要加 Secure 都看這個。正式站是 https://slime.iosoftware.ai
const PUBLIC_URL = (env.PUBLIC_URL || `http://localhost:${PORT}`).replace(/\/+$/, '');
const SECURE = PUBLIC_URL.startsWith('https://');
const REDIRECT_URI = `${PUBLIC_URL}/api/auth/google/callback`;
const DATA = path.resolve(env.DATA_DIR || path.join(ROOT, 'data'));
const SERVE_STATIC = env.SERVE_STATIC === '1';
const STATIC_DIR = path.resolve(env.STATIC_DIR || path.join(ROOT, 'out'));
const GOOGLE = {
  clientId: env.GOOGLE_CLIENT_ID || '',
  clientSecret: env.GOOGLE_CLIENT_SECRET || '', // 用戶端密碼：只放在伺服器的設定，不能出現在網頁或 git
  authUrl: env.GOOGLE_AUTH_URL || 'https://accounts.google.com/o/oauth2/v2/auth', // 測試時換成假的
  tokenUrl: env.GOOGLE_TOKEN_URL || 'https://oauth2.googleapis.com/token',
};
const GOOGLE_ISSUERS = new Set(['https://accounts.google.com', 'accounts.google.com']);

// 允許名單存在資料庫，由管理員在 /admin.html 管理。ADMIN_EMAILS（逗號分隔）裡的信箱每次啟動都會確保是管理員，
// 名單被改壞時也救得回來。信箱寫在伺服器設定（.env／Zeabur），不寫進 git
const ADMIN_EMAILS = (env.ADMIN_EMAILS || '').split(',').map((s) => s.trim().toLowerCase()).filter(Boolean);

const DAY = 24 * 3600e3;
const SESSION_MS = 30 * DAY; // 30 天內不用重新登入（每天有玩就往後延）
const ARCHIVE_MS = 30 * DAY; // 沒被選上的存檔保留 30 天
const MAX_SAVE = 1_000_000; // 單一存檔上限（字元）
const NAME_MAX = 12; // 暱稱長度上限，與遊戲裡的玩家名稱相同
const KEEP_SNAPSHOTS = 7;

if (!GOOGLE.clientId || !GOOGLE.clientSecret) console.warn('警告：沒有設定 GOOGLE_CLIENT_ID／GOOGLE_CLIENT_SECRET，沒有人能登入。');
if (!ADMIN_EMAILS.length) console.warn('提醒：沒有設定 ADMIN_EMAILS，只能用資料庫裡已有的管理員管理允許名單。');

// ---------- 資料庫 ----------
fs.mkdirSync(DATA, { recursive: true });
// 有設 DATA_DIR（正式站）卻沒有掛上 volume：資料只在容器裡，重新部署就會不見
if (env.DATA_DIR) {
  let mounted = false;
  try { mounted = fs.statSync(DATA).dev !== fs.statSync(path.parse(DATA).root).dev; } catch { /* 當作沒掛 */ }
  if (!mounted) console.warn(`警告：${DATA} 不是掛載的永久磁碟，重新部署後存檔會遺失。請在平台上把 volume 掛到 ${DATA}。`);
}
const DB_FILE = path.join(DATA, 'slime.db');
const db = new DatabaseSync(DB_FILE);
db.exec(`
  PRAGMA journal_mode = WAL;
  PRAGMA foreign_keys = ON;
  PRAGMA busy_timeout = 5000;
  -- 玩家：只存 Google 帳號編號、email、暱稱與時間。id 是我們自己的隨機編號，刪除資料後重新登入會是新帳號
  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    sub TEXT NOT NULL UNIQUE,
    email TEXT NOT NULL,
    name TEXT NOT NULL,
    created_at INTEGER NOT NULL,
    last_login INTEGER NOT NULL,
    flag TEXT -- 存檔數字沒通過合理性檢查的原因（排行榜只採用 flag 是空的玩家）
  );
  -- 登入通行證：只存 token 的 SHA-256，資料庫外流也不能拿來登入
  CREATE TABLE IF NOT EXISTS sessions (
    key TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    expires_at INTEGER NOT NULL
  );
  -- 目前的存檔：ver 每存一次加 1，別台裝置拿著舊版號來存會被擋下（避免覆蓋新進度）。
  -- device 是瀏覽器自己產生的隨機編號：同一台裝置連續存檔（例如關頁面時）不算衝突
  CREATE TABLE IF NOT EXISTS saves (
    user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    ver INTEGER NOT NULL,
    data TEXT NOT NULL,
    updated_at INTEGER NOT NULL,
    device TEXT NOT NULL DEFAULT '',
    ok INTEGER NOT NULL DEFAULT 1
  );
  -- 被換掉的存檔（玩家選了另一份、開新遊戲）：保留 30 天，需要時可以手動救回
  CREATE TABLE IF NOT EXISTS archived_saves (
    id INTEGER PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    data TEXT NOT NULL,
    reason TEXT NOT NULL,
    created_at INTEGER NOT NULL,
    expires_at INTEGER NOT NULL
  );
  -- 允許名單：entry 是完整信箱（someone@gmail.com）、整個網域（@school.edu.tw）或 *（所有 Google 帳號）；
  -- 管理員一定是完整信箱
  CREATE TABLE IF NOT EXISTS allow (
    entry TEXT PRIMARY KEY,
    admin INTEGER NOT NULL DEFAULT 0,
    note TEXT NOT NULL DEFAULT '',
    added_by TEXT NOT NULL DEFAULT '',
    created_at INTEGER NOT NULL
  );
  CREATE INDEX IF NOT EXISTS sessions_user ON sessions(user_id);
  CREATE INDEX IF NOT EXISTS archived_user ON archived_saves(user_id);
`);
const q = {
  userBySub: db.prepare('SELECT * FROM users WHERE sub = ?'),
  userById: db.prepare('SELECT * FROM users WHERE id = ?'),
  addUser: db.prepare('INSERT INTO users (id, sub, email, name, created_at, last_login) VALUES (?, ?, ?, ?, ?, ?)'),
  touchUser: db.prepare('UPDATE users SET email = ?, last_login = ? WHERE id = ?'),
  rename: db.prepare('UPDATE users SET name = ? WHERE id = ?'),
  flag: db.prepare('UPDATE users SET flag = ? WHERE id = ? AND flag IS NULL'),
  delUser: db.prepare('DELETE FROM users WHERE id = ?'),
  addSession: db.prepare('INSERT INTO sessions (key, user_id, expires_at) VALUES (?, ?, ?)'),
  session: db.prepare('SELECT * FROM sessions WHERE key = ?'),
  extendSession: db.prepare('UPDATE sessions SET expires_at = ? WHERE key = ?'),
  delSession: db.prepare('DELETE FROM sessions WHERE key = ?'),
  save: db.prepare('SELECT * FROM saves WHERE user_id = ?'),
  putSave: db.prepare('INSERT INTO saves (user_id, ver, data, updated_at, device, ok) VALUES (?, ?, ?, ?, ?, ?) ON CONFLICT(user_id) DO UPDATE SET ver = excluded.ver, data = excluded.data, updated_at = excluded.updated_at, device = excluded.device, ok = excluded.ok'),
  archive: db.prepare('INSERT INTO archived_saves (user_id, data, reason, created_at, expires_at) VALUES (?, ?, ?, ?, ?)'),
  purge: db.prepare('DELETE FROM archived_saves WHERE expires_at < ?'),
  purgeSessions: db.prepare('DELETE FROM sessions WHERE expires_at < ?'),
  allowMatch: db.prepare("SELECT entry, admin FROM allow WHERE entry IN (?, ?, '*')"),
  allowList: db.prepare('SELECT a.*, (SELECT COUNT(*) FROM users u WHERE u.email = a.entry OR (a.entry LIKE \'@%\' AND u.email LIKE \'%\' || a.entry) OR a.entry = \'*\') AS users FROM allow a ORDER BY a.admin DESC, a.entry'),
  allowGet: db.prepare('SELECT * FROM allow WHERE entry = ?'),
  allowAdd: db.prepare('INSERT INTO allow (entry, admin, note, added_by, created_at) VALUES (?, ?, ?, ?, ?) ON CONFLICT(entry) DO UPDATE SET admin = excluded.admin, note = excluded.note'),
  allowDel: db.prepare('DELETE FROM allow WHERE entry = ?'),
  adminCount: db.prepare('SELECT COUNT(*) AS n FROM allow WHERE admin = 1'),
};
const tx = (f) => {
  db.exec('BEGIN IMMEDIATE');
  try { const r = f(); db.exec('COMMIT'); return r; } catch (e) { db.exec('ROLLBACK'); throw e; }
};

// 名單項目格式：完整信箱、@網域、或 *
const EMAIL_RE = /^[^\s@,;<>]+@[a-z0-9.-]+\.[a-z]{2,}$/;
const DOMAIN_RE = /^@[a-z0-9-]+(\.[a-z0-9-]+)+$/;
const normEntry = (s) => {
  const e = String(s || '').trim().toLowerCase();
  return e === '*' || EMAIL_RE.test(e) || DOMAIN_RE.test(e) ? e : '';
};
// 回傳 null＝不能登入；{ admin } 只有完整信箱的項目能給管理員權限
function access(email) {
  const rows = q.allowMatch.all(email, email.slice(email.lastIndexOf('@')));
  if (!rows.length) return null;
  return { admin: rows.some((r) => r.entry === email && r.admin === 1) };
}
for (const e of ADMIN_EMAILS) {
  if (!EMAIL_RE.test(e)) { console.warn(`ADMIN_EMAILS 裡的「${e}」不是完整信箱，略過`); continue; }
  const cur = q.allowGet.get(e);
  if (!cur || !cur.admin) q.allowAdd.run(e, 1, cur?.note || '', 'ADMIN_EMAILS', Date.now());
}

// 清掉過期的通行證與保留存檔；每天用 VACUUM INTO 留一份一致的快照（資料庫開著時直接複製檔案可能拿到寫到一半的內容），
// 每天的 volume 備份會把 backups/ 一起帶走
const SNAP_DIR = path.join(DATA, 'backups');
function housekeeping() {
  const now = Date.now();
  try { q.purge.run(now); q.purgeSessions.run(now); } catch (e) { console.error('清理失敗', e); }
  try {
    fs.mkdirSync(SNAP_DIR, { recursive: true });
    const file = path.join(SNAP_DIR, `slime-${new Date(now).toISOString().slice(0, 10)}.db`);
    if (!fs.existsSync(file)) {
      db.prepare('VACUUM INTO ?').run(file);
      const old = fs.readdirSync(SNAP_DIR).filter((f) => /^slime-\d{4}-\d{2}-\d{2}\.db$/.test(f)).sort().slice(0, -KEEP_SNAPSHOTS);
      for (const f of old) fs.rmSync(path.join(SNAP_DIR, f), { force: true });
    }
  } catch (e) { console.error('資料庫快照失敗', e); }
}
housekeeping();
setInterval(housekeeping, 3600e3).unref();

// ---------- 存檔合理性檢查（防作弊） ----------
// 遊戲裡所有收入都經過 addMoney：money 增加時 earned（累計收入）一起增加，所以
// 1) 手上的錢不會超過「開局 ¥60＋累計收入」；2) 累計收入每分鐘增加的量有上限。
// 不擋存檔（玩家照樣能玩），只把帳號標記起來；之後做排行榜時只採用沒被標記的玩家。
const START_MONEY = 60;
const EARN_PER_MIN = 5000; // 每分鐘最多賺 ¥5,000（正常玩大約是這個的十分之一以下）
const EARN_BURST = 5000; // 離線結算等一次進帳的寬限
const EARN_MAX = 1e9;
function plausibility(prev, prevAt, next, now) {
  const n = (v) => (Number.isFinite(+v) ? +v : 0);
  const money = n(next.money), earned = n(next.earned);
  if (money > START_MONEY + earned + 1) return `手上的錢 ${Math.round(money)} 超過累計收入 ${Math.round(earned)}`;
  if (earned > EARN_MAX) return `累計收入 ${Math.round(earned)} 不合理`;
  if (prev) {
    const mins = Math.max(1, (now - prevAt) / 60e3), gain = earned - n(prev.earned);
    if (gain > EARN_BURST + EARN_PER_MIN * mins) return `${mins.toFixed(1)} 分鐘內收入增加 ${Math.round(gain)}`;
  }
  return '';
}

// ---------- 小工具 ----------
const sha256 = (s) => crypto.createHash('sha256').update(s).digest('hex');
const rand = (n = 32) => crypto.randomBytes(n).toString('base64url');
const sameText = (a, b) => typeof a === 'string' && typeof b === 'string' && a.length === b.length && crypto.timingSafeEqual(Buffer.from(a), Buffer.from(b));
const readCookie = (req, name) => new RegExp(`(?:^|;\\s*)${name}=([A-Za-z0-9_.-]{20,400})`).exec(req.headers.cookie || '')?.[1];
const cookie = (name, value, maxAgeSec, cookiePath = '/') => `${name}=${value}; HttpOnly; SameSite=Lax; Path=${cookiePath}; Max-Age=${maxAgeSec}${SECURE ? '; Secure' : ''}`;
// 暱稱：去掉控制字元與前後空白，最多 12 個字（以字元計，emoji 不會被切半）
const cleanName = (s) => [...String(s ?? '').replace(/[\p{C}<>]/gu, '').trim()].slice(0, NAME_MAX).join('').trim();
const pubUser = (u) => ({ id: u.id, name: u.name, ...(u.admin ? { admin: true } : {}) }); // 不把 email 送到遊戲畫面上

class HttpError extends Error {
  constructor(status, message) { super(message); this.status = status; }
}
function send(res, code, body, headers = {}) {
  const json = typeof body === 'string' ? body : JSON.stringify(body);
  res.writeHead(code, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', 'x-content-type-options': 'nosniff', ...headers });
  res.end(json);
}
const redirect = (res, location, cookies = []) => {
  res.writeHead(302, { location, 'cache-control': 'no-store', ...(cookies.length ? { 'set-cookie': cookies } : {}) });
  res.end();
};
// 收原始位元組再一次解碼：逐段轉字串會把切在段落中間的中文字弄壞
const readBody = (req, limit) =>
  new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    req.on('data', (c) => {
      size += c.length;
      if (size > limit) { reject(new HttpError(413, '存檔太大')); req.destroy(); } else chunks.push(c);
    });
    req.on('error', reject);
    req.on('end', () => {
      try { const t = Buffer.concat(chunks).toString('utf8'); resolve(t ? JSON.parse(t) : {}); } catch { reject(new HttpError(400, '資料格式錯誤')); }
    });
  });

// ---------- 登入通行證 ----------
function startSession(userId) {
  const token = rand(32);
  q.addSession.run(sha256(token), userId, Date.now() + SESSION_MS);
  return cookie('slime_sid', token, SESSION_MS / 1000);
}
// 回傳 { user, key, refresh }；refresh 是要重新發給瀏覽器的 Cookie（期限往後延的時候）
function currentUser(req) {
  const token = readCookie(req, 'slime_sid');
  if (!token) return null;
  const key = sha256(token), s = q.session.get(key), now = Date.now();
  if (!s) return null;
  if (s.expires_at < now) { q.delSession.run(key); return null; }
  const user = q.userById.get(s.user_id);
  if (!user) return null;
  // 每個請求都重新看名單：被移出名單的人，下一個請求就登不進來
  const acc = access(user.email);
  if (!acc) return null;
  user.admin = acc.admin;
  let refresh = null;
  if (now + SESSION_MS - s.expires_at > DAY) { // 一天最多延一次，不會每個請求都寫資料庫
    q.extendSession.run(now + SESSION_MS, key);
    refresh = cookie('slime_sid', token, SESSION_MS / 1000);
  }
  return { user, key, refresh };
}

// ---------- Google 登入 ----------
// 開始：產生 state（防偽造回呼）、PKCE 的 code_verifier、nonce（綁定這次的 id_token），存在只給 /api/auth/ 用的 Cookie，導向 Google
function startGoogle(res) {
  if (!GOOGLE.clientId || !GOOGLE.clientSecret) return redirect(res, '/?login=config');
  const state = rand(24), verifier = rand(48), nonce = rand(24);
  const challenge = crypto.createHash('sha256').update(verifier).digest('base64url');
  const p = new URLSearchParams({
    client_id: GOOGLE.clientId, redirect_uri: REDIRECT_URI, response_type: 'code', scope: 'openid email profile',
    state, nonce, code_challenge: challenge, code_challenge_method: 'S256', prompt: 'select_account',
  });
  redirect(res, `${GOOGLE.authUrl}?${p}`, [cookie('slime_oauth', `${state}.${verifier}.${nonce}`, 600, '/api/auth/')]);
}
// 從 Google 回來：核對 state → 用授權碼＋code_verifier＋用戶端密碼換 id_token → 檢查名單 → 發登入通行證
async function googleCallback(req, res, url) {
  const [state, verifier, nonce] = (readCookie(req, 'slime_oauth') || '').split('.');
  const clear = cookie('slime_oauth', '', 0, '/api/auth/');
  const back = (code) => redirect(res, `/?login=${code}`, [clear]);
  if (url.searchParams.get('error')) return back('cancelled');
  if (!state || !verifier || !nonce || !sameText(url.searchParams.get('state') || '', state)) return back('expired');
  const code = url.searchParams.get('code');
  if (!code || code.length > 2048) return back('failed');

  let claims;
  try {
    const r = await fetch(GOOGLE.tokenUrl, {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ code, client_id: GOOGLE.clientId, client_secret: GOOGLE.clientSecret, redirect_uri: REDIRECT_URI, grant_type: 'authorization_code', code_verifier: verifier }),
      signal: AbortSignal.timeout(10e3),
    });
    const j = await r.json().catch(() => ({}));
    if (!r.ok || typeof j.id_token !== 'string') throw new Error(`token ${r.status} ${j.error || ''}`);
    // id_token 是伺服器直接透過 HTTPS 向 Google 拿的，依 OpenID Connect 規範可以不驗簽章，只核對內容
    claims = JSON.parse(Buffer.from(j.id_token.split('.')[1] || '', 'base64url').toString('utf8'));
  } catch (e) {
    console.error(new Date().toISOString(), 'Google 換發 token 失敗', e.message);
    return back('failed');
  }
  const now = Date.now() / 1000;
  const aud = Array.isArray(claims.aud) ? claims.aud : [claims.aud];
  if (!GOOGLE_ISSUERS.has(claims.iss) || !aud.includes(GOOGLE.clientId) || !(claims.exp > now - 60) || !sameText(String(claims.nonce || ''), nonce) || typeof claims.sub !== 'string' || !claims.sub) {
    console.error(new Date().toISOString(), 'Google id_token 內容不符');
    return back('failed');
  }
  const email = String(claims.email || '').toLowerCase();
  if (claims.email_verified !== true || !/^[^\s@]+@[^\s@]+$/.test(email)) return back('unverified');
  if (!access(email)) {
    console.log(new Date().toISOString(), `不在允許名單：${email}`);
    return back('denied');
  }
  const t = Date.now();
  let user = q.userBySub.get(claims.sub);
  if (user) q.touchUser.run(email, t, user.id);
  else {
    // 暱稱預設用 Google 名字，之後可以自己改
    const name = cleanName(claims.given_name || claims.name) || cleanName(email.split('@')[0]) || '玩家';
    user = { id: rand(12), name };
    q.addUser.run(user.id, claims.sub, email, name, t, t);
  }
  console.log(new Date().toISOString(), `登入：${user.id}`);
  redirect(res, '/', [clear, startSession(user.id)]);
}

// ---------- API ----------
const PUBLIC_HOST = new URL(PUBLIC_URL).host;
async function api(req, res, url) {
  const route = `${req.method} ${url.pathname}`;
  if (route === 'GET /api/health') return send(res, 200, { ok: true });
  if (route === 'GET /api/auth/google') return startGoogle(res);
  if (route === 'GET /api/auth/google/callback') return googleCallback(req, res, url);

  if (req.method !== 'GET') {
    // 會改資料的請求要帶自訂標頭，而且要來自同一個網站（擋 CSRF）
    if (req.headers['x-slime'] !== '1') return send(res, 403, { error: '請求來源不正確' });
    const origin = req.headers.origin;
    if (origin && origin !== 'null') {
      let host = '';
      try { host = new URL(origin).host; } catch { /* 當作別的網站 */ }
      if (host !== PUBLIC_HOST && host !== req.headers.host) return send(res, 403, { error: '請求來源不正確' });
    }
  }

  const me = currentUser(req);
  if (!me) return send(res, 401, { error: '請先登入' });
  const { user } = me;
  const out = (code, body) => send(res, code, body, me.refresh ? { 'set-cookie': me.refresh } : {});

  if (route === 'GET /api/me') return out(200, { user: pubUser(user) });

  if (route === 'PATCH /api/me') {
    const b = await readBody(req, 4096);
    const name = cleanName(b.name);
    if (!name) return out(400, { error: '暱稱不能是空的' });
    q.rename.run(name, user.id);
    return out(200, { user: pubUser({ ...user, name }) });
  }

  if (route === 'POST /api/logout') {
    q.delSession.run(me.key);
    return send(res, 200, {}, { 'set-cookie': cookie('slime_sid', '', 0) });
  }

  // 刪除我的資料：帳號、存檔、保留的存檔、所有裝置的登入通行證一起刪掉（外鍵 ON DELETE CASCADE）
  if (route === 'DELETE /api/me') {
    q.delUser.run(user.id);
    console.log(new Date().toISOString(), `刪除帳號：${user.id}`);
    return send(res, 200, {}, { 'set-cookie': cookie('slime_sid', '', 0) });
  }

  if (route === 'GET /api/save') {
    const s = q.save.get(user.id);
    return out(200, { save: s ? { ver: s.ver, data: s.data, updatedAt: s.updated_at, device: s.device } : null });
  }

  // 存檔：base 是這台裝置上次同步到的版號。和伺服器上的版號不同＝別台裝置存過較新的進度 → 回 409，讓玩家選。
  // force（玩家選了這台的進度、開新遊戲）時照存，被換掉的那份保留 30 天
  if (route === 'PUT /api/save') {
    const b = await readBody(req, MAX_SAVE * 3);
    const data = b.data, base = Number(b.base) || 0;
    const device = /^[A-Za-z0-9_-]{8,40}$/.test(b.device || '') ? b.device : '';
    const force = ['choose_local', 'conflict_local', 'new_game'].includes(b.force) ? b.force : '';
    let parsed;
    try { parsed = typeof data === 'string' && data.length <= MAX_SAVE ? JSON.parse(data) : null; } catch { /* 下面處理 */ }
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return out(400, { error: '存檔格式不正確' });
    const r = tx(() => {
      const cur = q.save.get(user.id), now = Date.now();
      if (cur && cur.ver !== base && !force && !(device && cur.device === device)) return { conflict: cur };
      // 收入成長只和同一條進度比：開新遊戲、選了這台電腦上登入前的舊進度時，雲端那份是另一條進度，不能拿來比
      let prev = null;
      try { prev = cur && force !== 'new_game' && force !== 'choose_local' ? JSON.parse(cur.data) : null; } catch { /* 舊存檔壞了就不比 */ }
      const why = plausibility(prev, cur?.updated_at || 0, parsed, now);
      if (why) q.flag.run(`${new Date(now).toISOString()} ${why}`, user.id);
      if (cur && force && cur.data !== data) q.archive.run(user.id, cur.data, force, now, now + ARCHIVE_MS);
      const ver = (cur?.ver || 0) + 1;
      q.putSave.run(user.id, ver, data, now, device, why ? 0 : 1);
      return { ver, updatedAt: now, why };
    });
    if (r.conflict) return out(409, { error: '另一台裝置有較新的進度', ver: r.conflict.ver, updatedAt: r.conflict.updated_at });
    if (r.why) console.log(new Date().toISOString(), `存檔數字可疑（${user.id}）：${r.why}`);
    return out(200, { ver: r.ver, updatedAt: r.updatedAt });
  }

  // 玩家沒選的那份（這台電腦上的舊進度）也傳上來保留 30 天
  if (route === 'POST /api/save/keep') {
    const b = await readBody(req, MAX_SAVE * 3);
    if (typeof b.data !== 'string' || !b.data || b.data.length > MAX_SAVE) return out(400, { error: '存檔格式不正確' });
    const reason = ['choose_cloud', 'conflict_cloud'].includes(b.reason) ? b.reason : 'kept';
    const now = Date.now();
    q.archive.run(user.id, b.data, reason, now, now + ARCHIVE_MS);
    return out(200, {});
  }

  // ---------- 管理員：允許名單 ----------
  if (url.pathname.startsWith('/api/admin/')) {
    if (!user.admin) return out(403, { error: '只有管理員可以使用' });
    if (route === 'GET /api/admin/allow') {
      const rows = q.allowList.all().map((r) => ({ entry: r.entry, admin: r.admin === 1, note: r.note, addedBy: r.added_by, createdAt: r.created_at, users: r.users }));
      return out(200, { list: rows, me: user.email, players: db.prepare('SELECT COUNT(*) AS n FROM users').get().n });
    }
    // 一次可以貼很多個（換行、逗號、空白分隔）；admin 只套用在完整信箱上
    if (route === 'POST /api/admin/allow') {
      const b = await readBody(req, 1e5);
      const raw = String(b.entries || '').split(/[\s,;，、]+/).filter(Boolean);
      if (raw.length > 500) return out(400, { error: '一次最多加入 500 個' });
      const bad = raw.filter((x) => !normEntry(x));
      if (!raw.length || bad.length) return out(400, { error: bad.length ? `格式不正確：${bad.slice(0, 5).join('、')}（要是完整信箱、@網域 或 *）` : '請輸入信箱或網域' });
      const note = String(b.note || '').replace(/[\p{C}<>]/gu, '').trim().slice(0, 40);
      const added = tx(() => raw.map(normEntry).map((e) => {
        const admin = b.admin === true && EMAIL_RE.test(e) ? 1 : 0, cur = q.allowGet.get(e);
        q.allowAdd.run(e, admin || cur?.admin || 0, note || cur?.note || '', user.email, cur?.created_at || Date.now());
        return e;
      }));
      console.log(new Date().toISOString(), `允許名單新增（${user.id}）：${added.length} 筆`);
      return out(200, { added: added.length });
    }
    // 改權限：{ entry, admin }；不能拿掉最後一位管理員，也不能拿掉自己的
    if (route === 'PATCH /api/admin/allow') {
      const b = await readBody(req, 4096);
      const e = normEntry(b.entry), cur = e && q.allowGet.get(e);
      if (!cur) return out(404, { error: '名單裡沒有這一筆' });
      const admin = b.admin === true;
      if (admin && !EMAIL_RE.test(e)) return out(400, { error: '網域和 * 不能設成管理員' });
      if (!admin && cur.admin && e === user.email) return out(400, { error: '不能拿掉自己的管理員權限' });
      q.allowAdd.run(e, admin ? 1 : 0, cur.note, cur.added_by, cur.created_at);
      return out(200, {});
    }
    if (route === 'DELETE /api/admin/allow') {
      const e = normEntry(url.searchParams.get('entry')), cur = e && q.allowGet.get(e);
      if (!cur) return out(404, { error: '名單裡沒有這一筆' });
      if (e === user.email) return out(400, { error: '不能把自己移出名單' });
      if (cur.admin && q.adminCount.get().n <= 1) return out(400, { error: '至少要留一位管理員' });
      q.allowDel.run(e); // 已經登入的人下一個請求就會被擋（currentUser 每次都重看名單）
      console.log(new Date().toISOString(), `允許名單移除（${user.id}）：${e}`);
      return out(200, {});
    }
  }

  return out(404, { error: '找不到這個功能' });
}

// ---------- 本機測試用：提供 out/ 的網站檔案（正式站由 Caddy 負責） ----------
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8', '.txt': 'text/plain; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png', '.ico': 'image/x-icon', '.woff2': 'font/woff2' };
function serveStatic(req, res, url) {
  if (!['GET', 'HEAD'].includes(req.method)) return send(res, 405, { error: 'method not allowed' });
  let rel;
  try { rel = decodeURIComponent(url.pathname); } catch { return send(res, 400, { error: 'bad request' }); }
  // 與 Caddy 的 try_files 相同：/admin → admin.html、/ → index.html
  const tries = rel.endsWith('/') ? [rel + 'index.html'] : [rel, rel + '.html', rel + '/index.html'];
  for (const t of tries) {
    const file = path.join(STATIC_DIR, t);
    if (rel.includes('\0') || !file.startsWith(STATIC_DIR + path.sep)) break; // 不能跑出 out/
    let st;
    try { st = fs.statSync(file); } catch { continue; }
    if (!st.isFile()) continue;
    const cache = t.startsWith('/_next/static/') ? 'public, max-age=31536000, immutable' : 'no-cache';
    const type = /^\/(apple-icon|icon\d*)$/.test(t) ? 'image/png' : t.endsWith('.webmanifest') ? 'application/manifest+json' : TYPES[path.extname(file)] || 'application/octet-stream';
    res.writeHead(200, { 'content-type': type, 'cache-control': cache });
    return res.end(req.method === 'HEAD' ? undefined : fs.readFileSync(file));
  }
  const nf = path.join(STATIC_DIR, '404.html');
  if (fs.existsSync(nf)) { res.writeHead(404, { 'content-type': TYPES['.html'], 'cache-control': 'no-cache' }); return res.end(fs.readFileSync(nf)); }
  send(res, 404, { error: 'not found' });
}

const server = http.createServer(async (req, res) => {
  let url;
  try { url = new URL(req.url, 'http://x'); } catch { return send(res, 400, { error: 'bad request' }); }
  try {
    if (url.pathname.startsWith('/api/')) return await api(req, res, url);
    if (SERVE_STATIC) return serveStatic(req, res, url);
    send(res, 404, { error: 'not found' });
  } catch (e) {
    if (e instanceof HttpError) return res.headersSent || send(res, e.status, { error: e.message });
    console.error(new Date().toISOString(), req.method, url.pathname, e);
    if (!res.headersSent) send(res, 500, { error: '伺服器錯誤，請稍後再試' });
  }
});
server.headersTimeout = 20e3;
server.requestTimeout = 60e3;
server.listen(PORT, HOST, () => console.log(`史萊姆捏捏工坊伺服器：http://${HOST}:${PORT}（對外網址 ${PUBLIC_URL}${SERVE_STATIC ? '，含網站檔案' : ''}）`));
const stop = () => { server.close(); try { db.close(); } catch { /* 已關閉 */ } process.exit(0); };
process.on('SIGTERM', stop);
process.on('SIGINT', stop);
