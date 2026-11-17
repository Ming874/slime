'use strict';
/* 登入與雲端存檔：
   1. 一進遊戲先確認 Google 登入（登入通行證是 HttpOnly Cookie，網頁程式讀不到）；沒登入就顯示「用 Google 登入」。
   2. 登入後先把這台電腦的進度和雲端進度對齊，再載入 game.js（遊戲照舊從 localStorage 讀寫進度）。
      雲端還沒有存檔 → 自動上傳；兩邊不同又分不出新舊 → 讓玩家選，沒選的那份在伺服器保留 30 天。
   3. 遊戲每次存檔會呼叫 SlimeCloud.sync()；有變動就每 30 秒上傳一次，買東西、做完加工、關閉頁面時馬上傳。
      存檔帶版本號：別台裝置存過較新的進度時伺服器回 409，問玩家「另一台有較新進度，要載入嗎？」 */
(function () {
  const SAVE_KEY = 'slime_world_v1'; // 與 game.js 相同
  const META_KEY = 'slime_cloud_v1'; // { owner: 帳號編號, ver: 已同步到雲端第幾版, dirty: 有沒上傳的變動, fresh: 剛開新遊戲 }
  const DEVICE_KEY = 'slime_device'; // 這個瀏覽器的隨機編號：同一台裝置連續存檔不算衝突
  const SYNC_MS = 30e3;
  // 版本號由 index.html 的 gate.js?v= 帶入並傳給 game.js；部署建置時（Dockerfile）自動換成檔案內容雜湊，就不會拿到 CDN／瀏覽器裡的舊檔
  const VER = (() => { try { return new URL(document.currentScript.src).searchParams.get('v') || ''; } catch (e) { return ''; } })();
  const $ = id => document.getElementById(id);
  const ls = {
    get: k => { try { return localStorage.getItem(k); } catch (e) { return null; } },
    set: (k, v) => { try { localStorage.setItem(k, v); return true; } catch (e) { return false; } },
    del: k => { try { localStorage.removeItem(k); } catch (e) { } },
  };
  const getMeta = () => { try { const m = JSON.parse(ls.get(META_KEY)); if (m && typeof m === 'object') return m; } catch (e) { } return {}; };
  const setMeta = m => ls.set(META_KEY, JSON.stringify(m));
  const DEVICE = ls.get(DEVICE_KEY) || (() => { const a = new Uint8Array(12); crypto.getRandomValues(a); const d = [...a].map(x => x.toString(16).padStart(2, '0')).join(''); ls.set(DEVICE_KEY, d); return d; })();
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const fmtTime = t => { if (!t) return '—'; const d = new Date(t); return `${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`; };
  ls.del('slime_auth_v1'); // 舊的遊玩金鑰已經不用了

  async function api(method, url, body, keepalive) {
    const opt = { method, credentials: 'same-origin', cache: 'no-store', headers: { 'x-slime': '1' } };
    if (body !== undefined) { opt.headers['content-type'] = 'application/json'; opt.body = JSON.stringify(body); }
    if (keepalive) opt.keepalive = true;
    const r = await fetch(url, opt);
    let j = {}; try { j = await r.json(); } catch (e) { }
    return { status: r.status, ok: r.ok, body: j };
  }

  /* ---------- 登入畫面 ---------- */
  const LOGIN_MSG = {
    denied: '這個 Google 帳號不在允許名單。請改用學校的 Google 帳號，或請老師把你加進名單。',
    cancelled: '已取消登入。',
    expired: '登入逾時，請再按一次「用 Google 登入」。',
    unverified: '這個 Google 帳號的信箱還沒驗證，請換一個帳號。',
    failed: 'Google 登入失敗，請稍後再試一次。',
    config: '伺服器還沒設定好 Google 登入，請通知老師。',
  };
  function showBoot(text) { const b = $('boot'); b.hidden = false; $('bootTxt').textContent = text; }
  function showCard(view, text) {
    $('boot').hidden = true; $('login').hidden = false;
    $('loginGo').hidden = view !== 'go'; $('loginPick').hidden = view !== 'pick';
    $('loginMsg').textContent = text || '';
  }
  function fail(text) {
    showCard('pick', text);
    $('loginPick').innerHTML = '<button class="btn big" type="button" id="loginRetry">重新整理</button>';
    $('loginRetry').onclick = () => location.reload();
  }

  let started = false;
  function start() {
    if (started) return; started = true;
    const box = $('login');
    if (!box.hidden) { box.classList.add('out'); setTimeout(() => { box.hidden = true; box.classList.remove('out'); }, 450); }
    showBoot('正在生成月光谷…');
    const s = document.createElement('script'); s.src = 'game.js' + (VER ? '?v=' + encodeURIComponent(VER) : '');
    s.onerror = () => fail('遊戲載入失敗，請重新整理頁面');
    document.body.appendChild(s);
    setInterval(() => push(), SYNC_MS);
  }

  /* ---------- 選存檔（電腦裡的舊進度 vs 雲端、兩台裝置各自玩過） ---------- */
  function summary(data) {
    try {
      const o = JSON.parse(data);
      return `${fmtTime(o.last)} 存檔 · ¥${Math.round(+o.money || 0).toLocaleString('en-US')} · 粉絲 ${Math.floor(+o.fans || 0)} · 區域 ${Array.isArray(o.zones) ? o.zones.length : 1}/4`;
    } catch (e) { return '（存檔讀不出來）'; }
  }
  const lastOf = data => { try { return +JSON.parse(data).last || 0; } catch (e) { return 0; } };
  function choose(local, cloud, mine) {
    return new Promise(done => {
      const newer = lastOf(local) >= lastOf(cloud) ? 'local' : 'cloud';
      const card = (k, title, data) => `<button type="button" class="lpick" data-k="${k}"><b>${title}${k === newer ? '<span class="lnew">較新</span>' : ''}</b><span>${esc(summary(data))}</span><em>用這份</em></button>`;
      $('loginPick').innerHTML = `<h2 class="lptitle">要用哪一份進度？</h2>
        <p class="lnote">${mine ? '這台電腦有還沒上傳的進度，另一台裝置也存過新的進度。' : '這台電腦裡有登入前的進度，雲端也有你的存檔。'}</p>
        ${card('local', '這台電腦', local)}${card('cloud', '雲端存檔', cloud)}
        <p class="lnote">沒選的那份會在伺服器保留 30 天。</p>`;
      showCard('pick');
      $('loginPick').querySelectorAll('[data-k]').forEach(b => { b.onclick = () => { showBoot('正在套用存檔…'); done(b.dataset.k === 'local'); }; });
    });
  }

  /* ---------- 登入後：對齊這台電腦與雲端的進度 ---------- */
  async function reconcile() {
    const uid = CLOUD.user.id;
    let m = getMeta(), local = ls.get(SAVE_KEY);
    // 這台電腦上的進度是別的帳號留下的（共用電腦）：不拿來用
    if (m.owner && m.owner !== uid) { ls.del(SAVE_KEY); local = null; m = {}; }
    const mine = m.owner === uid;
    const r = await api('GET', '/api/save');
    if (!r.ok) throw new Error('讀取存檔失敗 ' + r.status);
    const sv = r.body.save; // { ver, data, updatedAt, device } 或 null

    if (!local) {
      if (mine && m.fresh) return setMeta({ owner: uid, ver: sv ? sv.ver : 0, fresh: true }); // 剛按了「新遊戲」
      if (sv) ls.set(SAVE_KEY, sv.data);
      return setMeta({ owner: uid, ver: sv ? sv.ver : 0 });
    }
    if (mine && m.fresh) { setMeta({ owner: uid, ver: m.ver || 0, dirty: true, fresh: true }); return push(); }
    if (!sv) { setMeta({ owner: uid, ver: 0, dirty: true }); return push(); } // 雲端還沒有存檔：自動上傳
    if (sv.data === local) return setMeta({ owner: uid, ver: sv.ver });
    // 雲端最新的一份就是這台存的，或版號沒變：這台的進度比較新，直接上傳
    if (mine && (sv.ver === m.ver || sv.device === DEVICE)) { setMeta({ owner: uid, ver: sv.ver, dirty: true }); return push(); }
    // 別台裝置玩過、這台沒有新的變動：直接用雲端較新的進度
    if (mine && !m.dirty) { ls.set(SAVE_KEY, sv.data); return setMeta({ owner: uid, ver: sv.ver }); }
    // 兩邊都有不同的進度：讓玩家選
    if (await choose(local, sv.data, mine)) {
      setMeta({ owner: uid, ver: sv.ver, dirty: true });
      await push(mine ? 'conflict_local' : 'choose_local');
    } else {
      await api('POST', '/api/save/keep', { data: local, reason: mine ? 'conflict_cloud' : 'choose_cloud' }).catch(() => { });
      ls.set(SAVE_KEY, sv.data); setMeta({ owner: uid, ver: sv.ver });
    }
  }

  /* ---------- 上傳 ---------- */
  const SY = { busy: null, again: false, paused: false, at: 0, err: '', soon: 0 };
  function saved(r, data) {
    const cur = getMeta();
    setMeta({ owner: cur.owner, ver: r.body.ver, dirty: ls.get(SAVE_KEY) !== data });
    SY.at = Date.now(); SY.err = '';
  }
  function failed(r) {
    if (r.status === 409) return conflict(r.body);
    if (r.status === 401) { SY.paused = true; SY.err = '登入已失效，請重新整理頁面再登入，進度先存在這台電腦'; return; }
    SY.err = (r.body.error || '雲端存檔失敗') + '，稍後會再試';
  }
  async function push(force) {
    if (SY.paused && !force) return;
    if (SY.busy) { SY.again = true; return SY.busy; }
    SY.busy = (async () => {
      const m = getMeta(), data = ls.get(SAVE_KEY);
      if (!CLOUD.user || !data || m.owner !== CLOUD.user.id || (!m.dirty && !force)) return;
      try {
        const r = await api('PUT', '/api/save', { base: m.ver || 0, data, device: DEVICE, force: force || (m.fresh ? 'new_game' : undefined) });
        r.ok ? saved(r, data) : failed(r);
      } catch (e) { SY.err = '連不上伺服器，進度先存在這台電腦，稍後會再試'; }
    })();
    try { await SY.busy; } finally { SY.busy = null; if (SY.again) { SY.again = false; push(); } }
  }
  // 關閉頁面／切到背景：用 keepalive 讓請求在頁面關掉後也能送完（上限 64KB；太大就用一般請求盡量送）。
  // 沒送到也沒關係：進度還在這台電腦，下次開遊戲時會補傳
  function pushLeave() {
    const m = getMeta(), data = ls.get(SAVE_KEY);
    if (SY.paused || SY.busy || !CLOUD.user || !data || m.owner !== CLOUD.user.id || !m.dirty) return;
    const body = { base: m.ver || 0, data, device: DEVICE, force: m.fresh ? 'new_game' : undefined };
    if (JSON.stringify(body).length > 60000) return void push();
    SY.busy = api('PUT', '/api/save', body, true).then(r => { r.ok ? saved(r, data) : failed(r); }).catch(() => { }).finally(() => { SY.busy = null; });
  }

  /* ---------- 另一台裝置有較新的進度 ---------- */
  function conflict(b) {
    if (SY.paused) return;
    SY.paused = true;
    const html = `<h2>另一台裝置有較新的進度</h2><p>你在別的電腦或手機上玩過（雲端存檔時間 ${fmtTime(b.updatedAt)}）。要載入較新的進度嗎？</p><p class="small" style="color:var(--sub)">沒選的那份會在伺服器保留 30 天。</p>`;
    const keepHere = async () => { SY.paused = false; const m = getMeta(); setMeta({ ...m, dirty: true }); await push('conflict_local'); };
    const btns = [{ t: '保留這台的進度', ghost: true, f: keepHere }, { t: '載入較新進度', f: loadCloud }];
    if (typeof window.modal === 'function') window.modal(html, btns);
    else if (confirm('另一台裝置有較新的進度，要載入嗎？\n（沒選的那份會在伺服器保留 30 天）')) loadCloud(); else keepHere();
  }
  async function loadCloud() {
    CLOUD.frozen = true; // game.js 的 save() 看到就不再寫 localStorage，重新整理時不會蓋掉剛載入的進度
    try {
      const r = await api('GET', '/api/save');
      if (!r.ok || !r.body.save) throw new Error('讀取失敗');
      const local = ls.get(SAVE_KEY);
      if (local && local !== r.body.save.data) await api('POST', '/api/save/keep', { data: local, reason: 'conflict_cloud' }).catch(() => { });
      ls.set(SAVE_KEY, r.body.save.data); setMeta({ owner: CLOUD.user.id, ver: r.body.save.ver });
      try { sessionStorage.setItem('squish_autostart', '1'); } catch (e) { }
      location.reload();
    } catch (e) {
      CLOUD.frozen = false; SY.paused = false;
      if (typeof window.toast === 'function') window.toast('載入雲端進度失敗，請稍後再試');
    }
  }

  /* ---------- 給 game.js 用 ---------- */
  const CLOUD = window.SlimeCloud = {
    user: null,
    frozen: false,
    // 遊戲每次寫完 localStorage 就呼叫：'now'＝馬上上傳（買東西、做完加工），'leave'＝頁面要關了
    sync(how) {
      if (!CLOUD.user || CLOUD.frozen) return;
      const m = getMeta();
      if (m.owner !== CLOUD.user.id) return;
      if (!m.dirty) { m.dirty = true; setMeta(m); }
      if (how === 'now') { clearTimeout(SY.soon); SY.soon = setTimeout(() => push(), 800); }
      else if (how === 'leave') pushLeave();
    },
    // 開新遊戲：雲端那份等第一次存檔時換掉（伺服器會保留舊的 30 天）
    resetLocal() { const m = getMeta(); setMeta({ owner: m.owner, ver: m.ver || 0, fresh: true }); },
    status() {
      if (SY.err) return SY.err;
      if (SY.paused) return '等待你選擇要用哪一份進度';
      const m = getMeta();
      if (SY.busy) return '正在上傳到雲端…';
      if (m.dirty) return SY.at ? `上次同步 ${fmtTime(SY.at)}，新的進度 30 秒內自動上傳` : '新的進度 30 秒內自動上傳';
      return SY.at ? `已同步到雲端（${fmtTime(SY.at)}）` : '已同步到雲端';
    },
    async rename(name) {
      const r = await api('PATCH', '/api/me', { name });
      if (!r.ok) throw new Error(r.body.error || '更改暱稱失敗');
      CLOUD.user = r.body.user; return CLOUD.user.name;
    },
    // 登出：先把最新進度傳上去。傳不上去（離線）時回傳 false，讓遊戲先問玩家；force＝仍要登出（進度留在這台電腦，下次同一帳號登入再上傳）
    async logout(force) {
      CLOUD.frozen = true;
      await push().catch(() => { });
      const clean = !getMeta().dirty;
      if (!clean && !force) { CLOUD.frozen = false; return false; }
      try { await api('POST', '/api/logout', {}); } catch (e) { }
      if (clean) { ls.del(SAVE_KEY); ls.del(META_KEY); }
      location.replace('/');
      return true;
    },
    // 刪除我的資料：伺服器上的帳號、存檔、保留的存檔一起刪掉，這台電腦上的進度也清掉
    async deleteMe() {
      CLOUD.frozen = true; SY.paused = true;
      let r = null;
      try { r = await api('DELETE', '/api/me', {}); } catch (e) { }
      if (!r || !r.ok) { CLOUD.frozen = false; SY.paused = false; throw new Error((r && r.body.error) || '連不上伺服器，請稍後再試'); }
      ls.del(SAVE_KEY); ls.del(META_KEY);
      location.replace('/');
    },
  };

  /* ---------- 開始 ---------- */
  (async () => {
    const code = new URLSearchParams(location.search).get('login');
    if (code) history.replaceState(null, '', location.pathname + location.hash);
    showBoot('正在確認登入…');
    let r;
    try { r = await api('GET', '/api/me'); } catch (e) { return fail('連不上伺服器，請確認網路後重新整理頁面。'); }
    if (r.status === 401) return showCard('go', LOGIN_MSG[code] || '');
    if (!r.ok) return fail('伺服器暫時無法使用，請稍後重新整理頁面。');
    CLOUD.user = r.body.user;
    try { await reconcile(); } catch (e) { console.warn(e); return fail('讀取雲端存檔失敗，請重新整理頁面再試一次。'); }
    start();
  })();
})();
