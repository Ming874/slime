/* 雲端存檔：
   - 登入後先把這台電腦的進度和雲端進度對齊（reconcile），再載入 game.js（遊戲照舊從 localStorage 讀寫進度）。
     雲端還沒有存檔 → 自動上傳；兩邊不同又分不出新舊 → 讓玩家選，沒選的那份在伺服器保留 30 天。
   - 遊戲每次存檔會呼叫 SlimeCloud.sync()；有變動就每 30 秒上傳一次，買東西、做完加工、關閉頁面時馬上傳。
   - 存檔帶版本號：別台裝置存過較新的進度時伺服器回 409，問玩家「另一台有較新進度，要載入嗎？」
   game.js 透過 window.SlimeCloud 使用這裡的功能（sync、resetLocal、status、rename、logout、deleteMe、user、frozen）。 */

export type User = { id: string; name: string; admin?: boolean };
export type CloudSave = { ver: number; data: string; updatedAt: number; device: string };
type Meta = { owner?: string; ver?: number; dirty?: boolean; fresh?: boolean };
type Btn = { t: string; ghost?: boolean; red?: boolean; f?: () => void };
export type Chooser = (local: string, cloud: string, mine: boolean) => Promise<boolean>;

declare global {
  interface Window {
    SlimeCloud?: typeof cloud;
    modal?: (html: string, btns: Btn[]) => void; // game.js 的對話框
    toast?: (msg: string) => void; // game.js 的訊息
    __slimeBoot?: boolean;
  }
}

const SAVE_KEY = 'slime_world_v1'; // 與 game.js 相同
const META_KEY = 'slime_cloud_v1'; // 這台電腦上的進度屬於誰、同步到雲端第幾版、有沒有還沒上傳的變動
const DEVICE_KEY = 'slime_device'; // 這個瀏覽器的隨機編號：同一台裝置連續存檔不算衝突
const SYNC_MS = 30e3;

const ls = {
  get: (k: string) => { try { return localStorage.getItem(k); } catch { return null; } },
  set: (k: string, v: string) => { try { localStorage.setItem(k, v); return true; } catch { return false; } },
  del: (k: string) => { try { localStorage.removeItem(k); } catch { /* 無痕模式等 */ } },
};
const getMeta = (): Meta => { try { const m = JSON.parse(ls.get(META_KEY) || 'null'); if (m && typeof m === 'object') return m; } catch { /* 壞掉當作沒有 */ } return {}; };
const setMeta = (m: Meta) => ls.set(META_KEY, JSON.stringify(m));
let DEVICE = '';
function device() {
  if (DEVICE) return DEVICE;
  DEVICE = ls.get(DEVICE_KEY) || '';
  if (!DEVICE) { const a = new Uint8Array(12); crypto.getRandomValues(a); DEVICE = [...a].map((x) => x.toString(16).padStart(2, '0')).join(''); ls.set(DEVICE_KEY, DEVICE); }
  return DEVICE;
}

export const fmtTime = (t?: number) => { if (!t) return '—'; const d = new Date(t); return `${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`; };
export function summary(data: string) {
  try {
    const o = JSON.parse(data);
    return `${fmtTime(o.last)} 存檔 · ¥${Math.round(+o.money || 0).toLocaleString('en-US')} · 粉絲 ${Math.floor(+o.fans || 0)} · 區域 ${Array.isArray(o.zones) ? o.zones.length : 1}/4`;
  } catch { return '（存檔讀不出來）'; }
}
export const lastOf = (data: string) => { try { return +JSON.parse(data).last || 0; } catch { return 0; } };

export type ApiResult<T = Record<string, unknown>> = { status: number; ok: boolean; body: T & { error?: string } };
export async function api<T = Record<string, unknown>>(method: string, url: string, body?: unknown, keepalive?: boolean): Promise<ApiResult<T>> {
  const opt: RequestInit = { method, credentials: 'same-origin', cache: 'no-store', headers: { 'x-slime': '1' } };
  if (body !== undefined) { (opt.headers as Record<string, string>)['content-type'] = 'application/json'; opt.body = JSON.stringify(body); }
  if (keepalive) opt.keepalive = true;
  const r = await fetch(url, opt);
  let j = {} as T & { error?: string };
  try { j = await r.json(); } catch { /* 沒有內容 */ }
  return { status: r.status, ok: r.ok, body: j };
}

/* ---------- 上傳 ---------- */
const SY = { busy: null as Promise<void> | null, again: false, paused: false, at: 0, err: '', soon: 0 as ReturnType<typeof setTimeout> | 0, timer: 0 as ReturnType<typeof setInterval> | 0 };
function saved(r: ApiResult<{ ver: number }>, data: string) {
  const cur = getMeta();
  setMeta({ owner: cur.owner, ver: r.body.ver, dirty: ls.get(SAVE_KEY) !== data });
  SY.at = Date.now(); SY.err = '';
}
function failed(r: ApiResult<{ ver: number; updatedAt: number }>) {
  if (r.status === 409) return conflict(r.body);
  if (r.status === 401) { SY.paused = true; SY.err = '登入已失效，請重新整理頁面再登入，進度先存在這台電腦'; return; }
  SY.err = (r.body.error || '雲端存檔失敗') + '，稍後會再試';
}
async function push(force?: string): Promise<void> {
  if (SY.paused && !force) return;
  if (SY.busy) { SY.again = true; return SY.busy; }
  SY.busy = (async () => {
    const m = getMeta(), data = ls.get(SAVE_KEY);
    if (!cloud.user || !data || m.owner !== cloud.user.id || (!m.dirty && !force)) return;
    try {
      const r = await api<{ ver: number; updatedAt: number }>('PUT', '/api/save', { base: m.ver || 0, data, device: device(), force: force || (m.fresh ? 'new_game' : undefined) });
      if (r.ok) saved(r, data); else failed(r);
    } catch { SY.err = '連不上伺服器，進度先存在這台電腦，稍後會再試'; }
  })();
  try { await SY.busy; } finally { SY.busy = null; if (SY.again) { SY.again = false; void push(); } }
}
// 關閉頁面／切到背景：用 keepalive 讓請求在頁面關掉後也能送完（上限 64KB；太大就用一般請求盡量送）。
// 沒送到也沒關係：進度還在這台電腦，下次開遊戲時會補傳
function pushLeave() {
  const m = getMeta(), data = ls.get(SAVE_KEY);
  if (SY.paused || SY.busy || !cloud.user || !data || m.owner !== cloud.user.id || !m.dirty) return;
  const body = { base: m.ver || 0, data, device: device(), force: m.fresh ? 'new_game' : undefined };
  if (JSON.stringify(body).length > 60000) { void push(); return; }
  SY.busy = api<{ ver: number; updatedAt: number }>('PUT', '/api/save', body, true)
    .then((r) => { if (r.ok) saved(r, data); else failed(r); })
    .catch(() => { /* 下次再傳 */ })
    .finally(() => { SY.busy = null; });
}

/* ---------- 另一台裝置有較新的進度 ---------- */
function conflict(b: { updatedAt?: number }) {
  if (SY.paused) return;
  SY.paused = true;
  const html = `<h2>另一台裝置有較新的進度</h2><p>你在別的電腦或手機上玩過（雲端存檔時間 ${fmtTime(b.updatedAt)}）。要載入較新的進度嗎？</p><p class="small" style="color:var(--sub)">沒選的那份會在伺服器保留 30 天。</p>`;
  const keepHere = async () => { SY.paused = false; const m = getMeta(); setMeta({ ...m, dirty: true }); await push('conflict_local'); };
  const btns: Btn[] = [{ t: '保留這台的進度', ghost: true, f: () => void keepHere() }, { t: '載入較新進度', f: () => void loadCloud() }];
  if (typeof window.modal === 'function') window.modal(html, btns);
  else if (confirm('另一台裝置有較新的進度，要載入嗎？\n（沒選的那份會在伺服器保留 30 天）')) void loadCloud(); else void keepHere();
}
async function loadCloud() {
  cloud.frozen = true; // game.js 的 save() 看到就不再寫 localStorage，重新整理時不會蓋掉剛載入的進度
  try {
    const r = await api<{ save: CloudSave | null }>('GET', '/api/save');
    if (!r.ok || !r.body.save) throw new Error('讀取失敗');
    const local = ls.get(SAVE_KEY);
    if (local && local !== r.body.save.data) await api('POST', '/api/save/keep', { data: local, reason: 'conflict_cloud' }).catch(() => null);
    ls.set(SAVE_KEY, r.body.save.data); setMeta({ owner: cloud.user!.id, ver: r.body.save.ver });
    try { sessionStorage.setItem('squish_autostart', '1'); } catch { /* 無痕模式 */ }
    location.reload();
  } catch {
    cloud.frozen = false; SY.paused = false;
    window.toast?.('載入雲端進度失敗，請稍後再試');
  }
}

/* ---------- 登入後：對齊這台電腦與雲端的進度 ---------- */
export async function reconcile(choose: Chooser) {
  const uid = cloud.user!.id;
  let m = getMeta(), local = ls.get(SAVE_KEY);
  // 這台電腦上的進度是別的帳號留下的（共用電腦）：不拿來用
  if (m.owner && m.owner !== uid) { ls.del(SAVE_KEY); local = null; m = {}; }
  const mine = m.owner === uid;
  const r = await api<{ save: CloudSave | null }>('GET', '/api/save');
  if (!r.ok) throw new Error('讀取存檔失敗 ' + r.status);
  const sv = r.body.save;

  if (!local) {
    if (mine && m.fresh) return void setMeta({ owner: uid, ver: sv ? sv.ver : 0, fresh: true }); // 剛按了「新遊戲」
    if (sv) ls.set(SAVE_KEY, sv.data);
    return void setMeta({ owner: uid, ver: sv ? sv.ver : 0 });
  }
  if (mine && m.fresh) { setMeta({ owner: uid, ver: m.ver || 0, dirty: true, fresh: true }); return push(); }
  if (!sv) { setMeta({ owner: uid, ver: 0, dirty: true }); return push(); } // 雲端還沒有存檔：自動上傳
  if (sv.data === local) return void setMeta({ owner: uid, ver: sv.ver });
  // 雲端最新的一份就是這台存的，或版號沒變：這台的進度比較新，直接上傳
  if (mine && (sv.ver === m.ver || sv.device === device())) { setMeta({ owner: uid, ver: sv.ver, dirty: true }); return push(); }
  // 別台裝置玩過、這台沒有新的變動：直接用雲端較新的進度
  if (mine && !m.dirty) { ls.set(SAVE_KEY, sv.data); return void setMeta({ owner: uid, ver: sv.ver }); }
  // 兩邊都有不同的進度：讓玩家選
  if (await choose(local, sv.data, mine)) {
    setMeta({ owner: uid, ver: sv.ver, dirty: true });
    await push(mine ? 'conflict_local' : 'choose_local');
  } else {
    await api('POST', '/api/save/keep', { data: local, reason: mine ? 'conflict_cloud' : 'choose_cloud' }).catch(() => null);
    ls.set(SAVE_KEY, sv.data); setMeta({ owner: uid, ver: sv.ver });
  }
}

export function startSync() {
  if (!SY.timer) SY.timer = setInterval(() => void push(), SYNC_MS);
}

/* ---------- 給 game.js 用 ---------- */
export const cloud = {
  user: null as User | null,
  frozen: false,
  // 遊戲每次寫完 localStorage 就呼叫：'now'＝馬上上傳（買東西、做完加工），'leave'＝頁面要關了
  sync(how?: 'now' | 'leave') {
    if (!cloud.user || cloud.frozen) return;
    const m = getMeta();
    if (m.owner !== cloud.user.id) return;
    if (!m.dirty) { m.dirty = true; setMeta(m); }
    if (how === 'now') { clearTimeout(SY.soon); SY.soon = setTimeout(() => void push(), 800); }
    else if (how === 'leave') pushLeave();
  },
  // 開新遊戲：雲端那份等第一次存檔時換掉（伺服器會保留舊的 30 天）
  // 換成另一個存檔：這台的進度換了，之後第一次存檔會上傳到雲端
  swapLocal() { const m = getMeta(); setMeta({ owner: m.owner, ver: m.ver || 0, dirty: true }); },
  resetLocal() { const m = getMeta(); setMeta({ owner: m.owner, ver: m.ver || 0, fresh: true }); },
  status() {
    if (SY.err) return SY.err;
    if (SY.paused) return '等待你選擇要用哪一份進度';
    const m = getMeta();
    if (SY.busy) return '正在上傳到雲端…';
    if (m.dirty) return SY.at ? `上次同步 ${fmtTime(SY.at)}，新的進度 30 秒內自動上傳` : '新的進度 30 秒內自動上傳';
    return SY.at ? `已同步到雲端（${fmtTime(SY.at)}）` : '已同步到雲端';
  },
  async rename(name: string) {
    const r = await api<{ user: User }>('PATCH', '/api/me', { name });
    if (!r.ok) throw new Error(r.body.error || '更改暱稱失敗');
    cloud.user = r.body.user; return cloud.user.name;
  },
  // 登出：先把最新進度傳上去。傳不上去（離線）時回傳 false，讓遊戲先問玩家；force＝仍要登出（進度留在這台電腦，下次同一帳號登入再上傳）
  async logout(force?: boolean) {
    cloud.frozen = true;
    await push().catch(() => null);
    const clean = !getMeta().dirty;
    if (!clean && !force) { cloud.frozen = false; return false; }
    try { await api('POST', '/api/logout', {}); } catch { /* 離線也照樣登出這台 */ }
    if (clean) { ls.del(SAVE_KEY); ls.del(META_KEY); }
    location.replace('/');
    return true;
  },
  // 刪除我的資料：伺服器上的帳號、存檔、保留的存檔一起刪掉，這台電腦上的進度也清掉
  async deleteMe() {
    cloud.frozen = true; SY.paused = true;
    let r: ApiResult | null = null;
    try { r = await api('DELETE', '/api/me', {}); } catch { /* 下面處理 */ }
    if (!r || !r.ok) { cloud.frozen = false; SY.paused = false; throw new Error((r && r.body.error) || '連不上伺服器，請稍後再試'); }
    ls.del(SAVE_KEY); ls.del(META_KEY);
    location.replace('/');
  },
};

export function forgetOldKey() { ls.del('slime_auth_v1'); } // 舊的遊玩金鑰已經不用了
