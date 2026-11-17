'use strict';
/* 允許名單管理（管理員專用）：新增／移除可以登入的信箱與網域、設定管理員。
   權限由伺服器檢查（/api/admin/*），這個頁面只負責顯示與送出。 */
(function () {
  const $ = id => document.getElementById(id);
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const fmtDate = t => { const d = new Date(t); return `${d.getFullYear()}/${d.getMonth() + 1}/${d.getDate()}`; };
  let LIST = [], ME = '';

  async function api(method, url, body) {
    const opt = { method, credentials: 'same-origin', cache: 'no-store', headers: { 'x-slime': '1' } };
    if (body !== undefined) { opt.headers['content-type'] = 'application/json'; opt.body = JSON.stringify(body); }
    const r = await fetch(url, opt);
    let j = {}; try { j = await r.json(); } catch (e) { }
    return { status: r.status, ok: r.ok, body: j };
  }
  function gate(html) { $('app').hidden = true; $('gate').hidden = false; $('gate').innerHTML = html; }

  async function load() {
    let r;
    try { r = await api('GET', '/api/admin/allow'); } catch (e) { return gate('<h2>連不上伺服器</h2><div class="sub">請確認網路後重新整理頁面。</div>'); }
    if (r.status === 401) return gate('<h2>請先登入</h2><div class="sub">回到遊戲用 Google 登入後，再從暫停選單的「管理允許名單」進來。</div><div class="row"><a class="btn" href="/">回到遊戲登入</a></div>');
    if (r.status === 403) return gate('<h2>只有管理員可以使用</h2><div class="sub">如果你需要管理名單，請請其他管理員把你設為管理員。</div>');
    if (!r.ok) return gate(`<h2>讀取失敗</h2><div class="sub">${esc(r.body.error || '伺服器暫時無法使用')}</div>`);
    LIST = r.body.list || []; ME = r.body.me || '';
    $('gate').hidden = true; $('app').hidden = false;
    render();
  }

  function kind(e) { return e === '*' ? '所有 Google 帳號' : e.startsWith('@') ? '網域' : '信箱'; }
  function render() {
    const f = $('filter').value.trim().toLowerCase();
    const rows = LIST.filter(x => !f || x.entry.includes(f) || (x.note || '').toLowerCase().includes(f));
    $('count').textContent = `（${LIST.length} 筆，管理員 ${LIST.filter(x => x.admin).length} 位）`;
    $('list').innerHTML = rows.length ? rows.map(x => {
      const isEmail = !x.entry.startsWith('@') && x.entry !== '*', self = x.entry === ME;
      const tags = (x.admin ? '<span class="tag admin">管理員</span>' : '') + (isEmail ? '' : `<span class="tag dom">${kind(x.entry)}</span>`) + (self ? '<span class="tag">你</span>' : '');
      const meta = [x.note && esc(x.note), `已登入過 ${x.users} 人`, `${fmtDate(x.createdAt)} 由 ${esc(x.addedBy || '—')} 加入`].filter(Boolean).join(' · ');
      const acts = (isEmail && !self ? `<button class="btn ghost sm" data-role="${esc(x.entry)}" data-admin="${x.admin ? 0 : 1}">${x.admin ? '取消管理員' : '設為管理員'}</button>` : '') +
        (self ? '' : `<button class="btn red sm" data-del="${esc(x.entry)}">移除</button>`);
      return `<div class="item"><div class="who">${esc(x.entry)}${tags}</div><div class="meta">${meta}</div><div class="acts">${acts}</div></div>`;
    }).join('') : `<div class="empty">${LIST.length ? '沒有符合搜尋的項目' : '名單是空的'}</div>`;
  }

  $('filter').addEventListener('input', render);

  $('addForm').addEventListener('submit', async e => {
    e.preventDefault();
    const msg = $('addMsg'), btn = $('addBtn');
    msg.className = 'msg'; msg.textContent = '';
    const entries = $('entries').value.trim();
    if (!entries) { msg.className = 'msg err'; msg.textContent = '請輸入信箱或網域'; return; }
    btn.disabled = true;
    try {
      const r = await api('POST', '/api/admin/allow', { entries, note: $('note').value, admin: $('asAdmin').checked });
      if (!r.ok) { msg.className = 'msg err'; msg.textContent = r.body.error || '加入失敗'; return; }
      msg.className = 'msg ok'; msg.textContent = `已加入 ${r.body.added} 筆`;
      $('entries').value = ''; $('asAdmin').checked = false;
      await load();
    } catch (err) { msg.className = 'msg err'; msg.textContent = '連不上伺服器，請稍後再試'; }
    finally { btn.disabled = false; }
  });

  $('list').addEventListener('click', async e => {
    const del = e.target.closest('[data-del]'), role = e.target.closest('[data-role]');
    const out = $('listMsg'); out.textContent = '';
    try {
      if (del) {
        const entry = del.dataset.del;
        if (!confirm(`把「${entry}」移出名單？\n符合這一筆的人（已經登入的也一樣）之後就不能進遊戲，他們的存檔會保留。`)) return;
        const r = await api('DELETE', '/api/admin/allow?entry=' + encodeURIComponent(entry));
        if (!r.ok) out.textContent = r.body.error || '移除失敗';
        await load();
      } else if (role) {
        const r = await api('PATCH', '/api/admin/allow', { entry: role.dataset.role, admin: role.dataset.admin === '1' });
        if (!r.ok) out.textContent = r.body.error || '更改失敗';
        await load();
      }
    } catch (err) { out.textContent = '連不上伺服器，請稍後再試'; }
  });

  load();
})();
