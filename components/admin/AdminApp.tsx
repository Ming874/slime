'use client';
/* 管理後台（管理員專用）：總覽、允許名單（新增／移除信箱與網域、設定管理員、改備註）、玩家（最後登入、存檔摘要、可疑標記）。
   權限由伺服器檢查（/api/admin/*），這裡只負責顯示與送出。 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { api, type User } from '@/lib/cloud';
import Icon from './Icon';

type Entry = { entry: string; admin: boolean; note: string; addedBy: string; createdAt: number; users: number };
type Kind = 'email' | 'domain' | 'all' | 'bad';
type Token = { v: string; kind: Kind };
type Tab = 'all' | 'admin' | 'email' | 'domain';
type Dialog = { title: string; text: string; ok: string; tone: 'danger' | 'warn'; resolve: (ok: boolean) => void };
type Toast = { id: number; text: string; err?: boolean; out?: boolean };

const EMAIL_RE = /^[^\s@,;<>]+@[a-z0-9.-]+\.[a-z]{2,}$/;
const DOMAIN_RE = /^@[a-z0-9-]+(\.[a-z0-9-]+)+$/;
// 「xxx.edu.tw」（沒有 @）當作網域
function classify(raw: string): Token {
  let v = raw.trim().toLowerCase().replace(/^mailto:/, '');
  if (!v.includes('@') && v !== '*' && /^[a-z0-9-]+(\.[a-z0-9-]+)+$/.test(v)) v = '@' + v;
  const kind: Kind = v === '*' ? 'all' : EMAIL_RE.test(v) ? 'email' : DOMAIN_RE.test(v) ? 'domain' : 'bad';
  return { v, kind };
}
const kindOf = (e: string): Exclude<Kind, 'bad'> => (e === '*' ? 'all' : e.startsWith('@') ? 'domain' : 'email');
const hue = (s: string) => [...s].reduce((h, c) => (h * 31 + c.charCodeAt(0)) % 360, 7);
const fmtDate = (t: number) => { const d = new Date(t); return `${d.getFullYear()}/${d.getMonth() + 1}/${d.getDate()}`; };
const KIND_ICON = { email: 'mail', domain: 'school', all: 'globe', bad: 'alert' } as const;

type Player = {
  id: string; name: string; email: string; createdAt: number; lastLogin: number; flag: string; allowed: boolean; admin: boolean;
  save: { ver: number; updatedAt: number; money?: number; earned?: number; fans?: number; xp?: number; zones?: number; stock?: number; broken?: boolean } | null;
};
type View = 'overview' | 'allow' | 'players';
const VIEWS: { k: View; label: string; icon: string; desc: string }[] = [
  { k: 'overview', label: '總覽', icon: 'sparkle', desc: '名單與玩家的整體狀況' },
  { k: 'allow', label: '允許名單', icon: 'list', desc: '誰可以登入遊戲、誰是管理員' },
  { k: 'players', label: '玩家', icon: 'users', desc: '登入過的玩家與存檔進度' },
];
const ago = (t?: number) => {
  if (!t) return '—';
  const m = Math.round((Date.now() - t) / 60000);
  return m < 1 ? '剛剛' : m < 60 ? `${m} 分鐘前` : m < 1440 ? `${Math.floor(m / 60)} 小時前` : m < 43200 ? `${Math.floor(m / 1440)} 天前` : fmtDate(t);
};
const yen = (n?: number) => '¥' + Math.round(n || 0).toLocaleString('en-US');
const viewOf = (): View => { const h = typeof location !== 'undefined' ? location.hash.slice(1) : ''; return (VIEWS.find((v) => v.k === h)?.k) || 'overview'; };

export default function AdminApp() {
  const [state, setState] = useState<'loading' | 'ok' | 'login' | 'forbidden' | 'error'>('loading');
  const [errMsg, setErrMsg] = useState('');
  const [me, setMe] = useState<User | null>(null);
  const [myEmail, setMyEmail] = useState('');
  const [list, setList] = useState<Entry[]>([]);
  const [users, setUsers] = useState<Player[]>([]);
  const [view, setView] = useState<View>('overview');
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [dialog, setDialog] = useState<Dialog | null>(null);

  const toast = useCallback((text: string, err = false) => {
    const id = Date.now() + Math.random();
    setToasts((t) => [...t.slice(-2), { id, text, err }]);
    setTimeout(() => setToasts((t) => t.map((x) => (x.id === id ? { ...x, out: true } : x))), 3200);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 3500);
  }, []);
  const ask = (d: Omit<Dialog, 'resolve'>) => new Promise<boolean>((resolve) => setDialog({ ...d, resolve }));

  const load = useCallback(async () => {
    try {
      const [m, r, u] = await Promise.all([
        api<{ user: User }>('GET', '/api/me'),
        api<{ list: Entry[]; me: string; players: number }>('GET', '/api/admin/allow'),
        api<{ users: Player[] }>('GET', '/api/admin/users'),
      ]);
      if (m.status === 401 || r.status === 401) return setState('login');
      if (r.status === 403) return setState('forbidden');
      if (!r.ok) { setErrMsg(r.body.error || '伺服器暫時無法使用'); return setState('error'); }
      setMe(m.body.user); setList(r.body.list || []); setMyEmail(r.body.me || ''); setUsers(u.ok ? u.body.users || [] : []);
      setState('ok');
    } catch { setErrMsg('連不上伺服器，請確認網路後重新整理頁面。'); setState('error'); }
  }, []);
  useEffect(() => { void load(); }, [load]);

  // 分頁記在網址的 # 後面，重新整理也會停在同一頁
  useEffect(() => {
    setView(viewOf());
    const on = () => setView(viewOf());
    addEventListener('hashchange', on);
    return () => removeEventListener('hashchange', on);
  }, []);
  const go = (v: View) => { history.replaceState(null, '', '#' + v); setView(v); window.scrollTo({ top: 0 }); };

  const flagged = users.filter((u) => u.flag).length;
  const cur = VIEWS.find((v) => v.k === view)!;
  const common = { ask, toast, onDone: load };

  return (
    <div className="adm">
      <aside className="side">
        <div className="brand">
          <span className="blob" aria-hidden="true" />
          <div style={{ minWidth: 0 }}><div className="kicker">SQUISH LAB</div><div className="ttl">管理後台</div></div>
        </div>
        <nav className="nav" aria-label="後台分頁">
          {VIEWS.map((v) => (
            <button key={v.k} type="button" className={view === v.k ? 'on' : ''} aria-current={view === v.k ? 'page' : undefined} onClick={() => go(v.k)}>
              <Icon name={v.icon} /><span>{v.label}</span>
              {v.k === 'allow' && state === 'ok' && <em>{list.length}</em>}
              {v.k === 'players' && state === 'ok' && <em className={flagged ? 'warn' : ''}>{flagged ? `${flagged} 可疑` : users.length}</em>}
            </button>
          ))}
        </nav>
        <div className="side-foot">
          {me && (
            <div className="me" title={me.name}>
              <span className="av" style={{ '--h': hue(me.name) } as React.CSSProperties}>{[...me.name][0]}</span>
              <div><b>{me.name}</b><small>管理員</small></div>
            </div>
          )}
          <a className="btn ghost" href="/"><Icon name="back" /><span>回到遊戲</span></a>
        </div>
      </aside>

      <main className="main">
        {state === 'loading' && <Skeleton />}
        {state === 'login' && <Gate icon="login" title="請先登入" text="回到遊戲用 Google 登入後，再從暫停選單的「管理後台」進來。" action={<a className="btn primary" href="/">回到遊戲登入</a>} />}
        {state === 'forbidden' && <Gate icon="lock" title="只有管理員可以使用" text="如果你需要管理名單，請其他管理員把你設為管理員。" action={<a className="btn ghost" href="/">回到遊戲</a>} />}
        {state === 'error' && <Gate icon="alert" title="讀取失敗" text={errMsg} action={<button className="btn primary" onClick={() => location.reload()}>重新整理</button>} />}
        {state === 'ok' && (
          <>
            <div className="hello">
              <div><h1>{cur.label}</h1><p>{cur.desc}</p></div>
              <button type="button" className="btn ghost sm" onClick={() => void load().then(() => toast('已重新整理'))}><Icon name="clock" />重新整理</button>
            </div>
            {view === 'overview' && <Overview list={list} users={users} go={go} {...common} />}
            {view === 'allow' && (
              <div className="layout">
                <AddPanel list={list} {...common} />
                <ListPanel list={list} myEmail={myEmail} {...common} />
              </div>
            )}
            {view === 'players' && <Players users={users} {...common} />}
          </>
        )}
      </main>

      {dialog && <ConfirmDialog d={dialog} close={(ok) => { dialog.resolve(ok); setDialog(null); }} />}
      <div className="toasts" aria-live="polite">
        {toasts.map((t) => (
          <div key={t.id} className={`toast${t.err ? ' err' : ''}${t.out ? ' out' : ''}`}><Icon name={t.err ? 'alert' : 'check'} />{t.text}</div>
        ))}
      </div>
    </div>
  );
}

function Stat({ icon, label, n, c }: { icon: string; label: string; n: number; c: string }) {
  return (
    <div className="stat" style={{ '--c': c } as React.CSSProperties}>
      <div className="lbl"><Icon name={icon} />{label}</div>
      <div className="num">{n.toLocaleString('en-US')}</div>
    </div>
  );
}

function Gate({ icon, title, text, action }: { icon: string; title: string; text: string; action: React.ReactNode }) {
  return (
    <section className="panel gate">
      <div className="ic"><Icon name={icon} /></div>
      <h2>{title}</h2>
      <p>{text}</p>
      {action}
    </section>
  );
}

function Skeleton() {
  return (
    <div style={{ paddingTop: 40 }}>
      <div className="stats">{[0, 1, 2, 3].map((i) => <div key={i} className="skel" style={{ height: 84 }} />)}</div>
      <div className="skel" style={{ height: 320 }} />
    </div>
  );
}

/* ---------- 新增：信箱／網域標籤輸入 ---------- */
type Common = { ask: (d: Omit<Dialog, 'resolve'>) => Promise<boolean>; toast: (t: string, err?: boolean) => void; onDone: () => Promise<void> };
function AddPanel({ list, ask, toast, onDone }: { list: Entry[] } & Common) {
  const [tokens, setTokens] = useState<Token[]>([]);
  const [text, setText] = useState('');
  const [role, setRole] = useState<'player' | 'admin'>('player');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const existing = useMemo(() => new Set(list.map((x) => x.entry)), [list]);

  const commit = (raw: string) => {
    const parts = raw.split(/[\s,;，、；]+/).filter(Boolean);
    if (!parts.length) return;
    setTokens((cur) => {
      const seen = new Set(cur.map((t) => t.v)), next = [...cur];
      for (const p of parts) { const t = classify(p); if (!seen.has(t.v)) { seen.add(t.v); next.push(t); } }
      return next;
    });
  };
  const onKey = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (['Enter', ',', 'Tab', ' '].includes(e.key) && text.trim()) { e.preventDefault(); commit(text); setText(''); }
    else if (e.key === 'Enter') e.preventDefault();
    else if (e.key === 'Backspace' && !text && tokens.length) setTokens((t) => t.slice(0, -1));
  };
  const onChange = (v: string) => { if (/[\s,;，、；]/.test(v)) { commit(v); setText(''); } else setText(v); };

  const all = text.trim() ? [...tokens, classify(text)] : tokens;
  const bad = all.filter((t) => t.kind === 'bad');
  const good = all.filter((t) => t.kind !== 'bad');
  const dup = good.filter((t) => existing.has(t.v));
  const nonEmailAdmin = role === 'admin' && good.some((t) => t.kind !== 'email');

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (text.trim()) { commit(text); setText(''); }
    if (bad.length) return toast(`有 ${bad.length} 筆格式不正確，請先修正或移除紅色的項目`, true);
    if (!good.length) return toast('請先輸入信箱或網域', true);
    if (good.some((t) => t.kind === 'all') && !(await ask({ title: '開放所有 Google 帳號？', text: '加入「*」之後，任何 Google 帳號都能登入遊戲，不再需要名單。', ok: '開放', tone: 'warn' }))) return;
    if (role === 'admin' && !(await ask({ title: `把 ${good.filter((t) => t.kind === 'email').length} 個帳號設為管理員？`, text: '管理員可以新增、移除名單，也能把別人設成管理員。', ok: '設為管理員', tone: 'warn' }))) return;
    setBusy(true);
    try {
      const r = await api<{ added: number }>('POST', '/api/admin/allow', { entries: good.map((t) => t.v).join('\n'), note, admin: role === 'admin' });
      if (!r.ok) return toast(r.body.error || '加入失敗', true);
      toast(`已加入 ${r.body.added} 筆`);
      setTokens([]); setText(''); setNote(''); setRole('player');
      await onDone();
    } catch { toast('連不上伺服器，請稍後再試', true); }
    finally { setBusy(false); }
  }

  return (
    <section className="panel add" aria-labelledby="addTitle">
      <div className="panel-hd">
        <h2 id="addTitle"><Icon name="addUser" />新增可以登入的帳號</h2>
        <p>輸入後按 Enter 或逗號；整份名單可以直接貼上。</p>
      </div>
      <form className="panel-bd" onSubmit={submit} autoComplete="off" noValidate>
        <div className="field">
          <label className="lbl2" htmlFor="tokIn">信箱或網域</label>
          <div className="tokens" onClick={() => input.current?.focus()}>
            {tokens.map((t) => (
              <span key={t.v} className={`chip ${t.kind === 'email' ? '' : t.kind === 'domain' ? 'dom' : t.kind}${existing.has(t.v) ? ' dup' : ''}`} title={t.kind === 'bad' ? '格式不正確' : existing.has(t.v) ? '已經在名單上' : undefined}>
                <Icon name={KIND_ICON[t.kind]} /><span>{t.v}</span>
                <button type="button" aria-label={`移除 ${t.v}`} onClick={(e) => { e.stopPropagation(); setTokens((x) => x.filter((y) => y.v !== t.v)); }}><Icon name="x" /></button>
              </span>
            ))}
            <input id="tokIn" ref={input} type="text" inputMode="email" spellCheck={false} autoCapitalize="off" value={text}
              placeholder={tokens.length ? '' : 'student01@gmail.com 或 @xxx.edu.tw'}
              onChange={(e) => onChange(e.target.value)} onKeyDown={onKey}
              onBlur={() => { if (text.trim()) { commit(text); setText(''); } }}
              onPaste={(e) => { const v = e.clipboardData.getData('text'); if (/[\s,;，、；]/.test(v.trim())) { e.preventDefault(); commit(text + v); setText(''); } }} />
          </div>
          <div className="tok-hint" aria-live="polite">
            {all.length === 0 ? '可以是完整信箱、@學校網域，或 *（所有 Google 帳號）'
              : <>
                  {good.length > 0 && <span className="ok">{good.length} 筆可以加入</span>}
                  {dup.length > 0 && <span className="w">{good.length ? '・' : ''}{dup.length} 筆已在名單（會更新備註與權限）</span>}
                  {bad.length > 0 && <span className="bad">{good.length || dup.length ? '・' : ''}{bad.length} 筆格式不正確</span>}
                </>}
          </div>
        </div>
        <div className="field">
          <span className="lbl2" id="roleLbl">權限</span>
          <div className="roles" role="radiogroup" aria-labelledby="roleLbl">
            <button type="button" className="role" role="radio" aria-checked={role === 'player'} onClick={() => setRole('player')}>
              <Icon name="user" /><span><b>玩家</b><small>可以登入遊戲</small></span>
            </button>
            <button type="button" className="role admin" role="radio" aria-checked={role === 'admin'} onClick={() => setRole('admin')}>
              <Icon name="shield" /><span><b>管理員</b><small>還能管理這份名單</small></span>
            </button>
          </div>
          {nonEmailAdmin && <div className="tok-hint"><span className="w">網域和 * 只能是玩家，會以玩家身分加入</span></div>}
        </div>
        <div className="field">
          <label className="lbl2" htmlFor="note">備註（選填）</label>
          <input className="txt" id="note" maxLength={40} placeholder="例如：三年二班、助教" value={note} onChange={(e) => setNote(e.target.value)} />
        </div>
        <button className="btn primary block submit" type="submit" disabled={busy || all.length === 0}>
          {busy ? '加入中…' : good.length ? `加入名單（${good.length}）` : '加入名單'}
        </button>
        <div className="tips">
          <div className="tip"><Icon name="mail" /><span><code>someone@gmail.com</code> 只開放這一個帳號</span></div>
          <div className="tip"><Icon name="school" /><span><code>@xxx.edu.tw</code> 開放整個學校網域（只能是玩家）</span></div>
          <div className="tip"><Icon name="globe" /><span><code>*</code> 開放所有 Google 帳號，請小心使用</span></div>
        </div>
      </form>
    </section>
  );
}

/* ---------- 名單 ---------- */
function ListPanel({ list, myEmail, ask, toast, onDone }: { list: Entry[]; myEmail: string } & Common) {
  const [q, setQ] = useState('');
  const [tab, setTab] = useState<Tab>('all');
  const [busy, setBusy] = useState('');
  const counts = {
    all: list.length,
    admin: list.filter((x) => x.admin).length,
    email: list.filter((x) => kindOf(x.entry) === 'email').length,
    domain: list.filter((x) => kindOf(x.entry) !== 'email').length,
  };
  const f = q.trim().toLowerCase();
  const rows = list.filter((x) =>
    (tab === 'all' || (tab === 'admin' ? x.admin : tab === 'email' ? kindOf(x.entry) === 'email' : kindOf(x.entry) !== 'email')) &&
    (!f || x.entry.includes(f) || (x.note || '').toLowerCase().includes(f)));

  async function setAdmin(x: Entry) {
    if (!x.admin && !(await ask({ title: `把 ${x.entry} 設為管理員？`, text: '管理員可以新增、移除名單，也能把別人設成管理員。', ok: '設為管理員', tone: 'warn' }))) return;
    setBusy(x.entry);
    try {
      const r = await api('PATCH', '/api/admin/allow', { entry: x.entry, admin: !x.admin });
      if (!r.ok) toast(r.body.error || '更改失敗', true); else toast(x.admin ? `已取消 ${x.entry} 的管理員權限` : `${x.entry} 現在是管理員`);
      await onDone();
    } catch { toast('連不上伺服器，請稍後再試', true); }
    finally { setBusy(''); }
  }
  async function remove(x: Entry) {
    const k = kindOf(x.entry);
    const who = k === 'all' ? '所有 Google 帳號（*）' : k === 'domain' ? `整個 ${x.entry} 網域` : x.entry;
    if (!(await ask({ title: `移除 ${who}？`, text: '符合這一筆的人之後就不能進遊戲（已經登入的也一樣），他們的存檔會保留。', ok: '移除', tone: 'danger' }))) return;
    setBusy(x.entry);
    try {
      const r = await api('DELETE', '/api/admin/allow?entry=' + encodeURIComponent(x.entry));
      if (!r.ok) toast(r.body.error || '移除失敗', true); else toast(`已移除 ${x.entry}`);
      await onDone();
    } catch { toast('連不上伺服器，請稍後再試', true); }
    finally { setBusy(''); }
  }

  const TABS: [Tab, string][] = [['all', '全部'], ['admin', '管理員'], ['email', '信箱'], ['domain', '網域']];
  return (
    <section className="panel" aria-labelledby="listTitle">
      <div className="list-hd">
        <h2 id="listTitle"><Icon name="list" />目前名單</h2>
        <label className="search"><Icon name="search" /><input type="search" placeholder="搜尋信箱、網域或備註" aria-label="搜尋名單" value={q} onChange={(e) => setQ(e.target.value)} /></label>
      </div>
      <div className="tabs" role="tablist">
        {TABS.map(([k, n]) => (
          <button key={k} type="button" role="tab" className="tab" aria-selected={tab === k} onClick={() => setTab(k)}>{n}<em>{counts[k]}</em></button>
        ))}
      </div>
      <div className="rows">
        {rows.length === 0 && (
          <div className="empty"><Icon name="search" /><div>{list.length ? '沒有符合的項目' : '名單是空的，從左邊加入第一筆吧'}</div></div>
        )}
        {rows.map((x) => {
          const k = kindOf(x.entry), self = x.entry === myEmail;
          return (
            <div className="row" key={x.entry}>
              <div className={`av${k === 'email' ? '' : ' ' + (k === 'domain' ? 'dom' : 'all')}`} style={{ '--h': hue(x.entry) } as React.CSSProperties}>
                {k === 'email' ? x.entry[0].toUpperCase() : <Icon name={k === 'domain' ? 'school' : 'globe'} />}
              </div>
              <div className="who">
                <div className="entry">
                  {x.entry}
                  {x.admin && <span className="pill admin"><Icon name="shield" />管理員</span>}
                  {k === 'domain' && <span className="pill dom">整個網域</span>}
                  {k === 'all' && <span className="pill all">所有人</span>}
                  {self && <span className="pill you">你</span>}
                </div>
                <div className="meta">
                  <NoteEdit x={x} toast={toast} onDone={onDone} />
                  <span><Icon name="users" />登入過 {x.users} 人</span>
                  <span><Icon name="clock" />{fmtDate(x.createdAt)}・{x.addedBy === 'ADMIN_EMAILS' ? '伺服器設定' : x.addedBy || '—'}</span>
                </div>
              </div>
              <div className="acts">
                {k === 'email' && (
                  <button type="button" className="sw" role="switch" aria-checked={x.admin} disabled={self || busy === x.entry}
                    title={self ? '不能更改自己的權限' : undefined} onClick={() => void setAdmin(x)}>
                    <i />管理員
                  </button>
                )}
                {!self && <button type="button" className="icon-btn" aria-label={`移除 ${x.entry}`} disabled={busy === x.entry} onClick={() => void remove(x)}><Icon name="trash" /></button>}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

function ConfirmDialog({ d, close }: { d: Dialog; close: (ok: boolean) => void }) {
  const ok = useRef<HTMLButtonElement>(null);
  const closeRef = useRef(close);
  closeRef.current = close;
  useEffect(() => {
    ok.current?.focus();
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') closeRef.current(false); };
    addEventListener('keydown', onKey);
    return () => removeEventListener('keydown', onKey);
  }, []);
  return (
    <div className="dlg-back" onClick={(e) => { if (e.target === e.currentTarget) close(false); }}>
      <div className="dlg-box" role="alertdialog" aria-modal="true" aria-labelledby="dlgTitle" aria-describedby="dlgText">
        <div className="dlg">
          <div className={`ic${d.tone === 'warn' ? ' w' : ''}`}><Icon name={d.tone === 'warn' ? 'shield' : 'trash'} /></div>
          <h3 id="dlgTitle">{d.title}</h3>
          <p id="dlgText">{d.text}</p>
          <div className="btns">
            <button type="button" className="btn ghost" onClick={() => close(false)}>取消</button>
            <button type="button" ref={ok} className={`btn ${d.tone === 'warn' ? 'primary' : 'danger'}`} onClick={() => close(true)}>{d.ok}</button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ---------- 名單備註：點一下直接改，Enter 或離開輸入框就存 ---------- */
function NoteEdit({ x, toast, onDone }: { x: Entry } & Pick<Common, 'toast' | 'onDone'>) {
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);
  const save = async (v: string) => {
    setEditing(false);
    if (v.trim() === (x.note || '')) return;
    setBusy(true);
    try {
      const r = await api('PATCH', '/api/admin/allow', { entry: x.entry, note: v });
      if (!r.ok) toast(r.body.error || '更改備註失敗', true); else toast('備註已更新');
      await onDone();
    } catch { toast('連不上伺服器，請稍後再試', true); }
    finally { setBusy(false); }
  };
  if (editing) {
    return (
      <input className="note-in" autoFocus defaultValue={x.note} maxLength={40} placeholder="備註（例如：三年二班）" aria-label={`${x.entry} 的備註`}
        onBlur={(e) => void save(e.target.value)}
        onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); if (e.key === 'Escape') setEditing(false); }} />
    );
  }
  return (
    <button type="button" className={`note-btn${x.note ? '' : ' empty'}`} onClick={() => setEditing(true)} disabled={busy} title="點一下修改備註">
      <Icon name="tag" />{x.note || '加備註'}
    </button>
  );
}

/* ---------- 總覽 ---------- */
function Overview({ list, users, go, ask, toast, onDone }: { list: Entry[]; users: Player[]; go: (v: View) => void } & Common) {
  const week = Date.now() - 7 * 864e5, active = users.filter((u) => u.lastLogin > week).length, flagged = users.filter((u) => u.flag);
  const recent = users.slice(0, 6), blocked = users.filter((u) => !u.allowed).length;
  return (
    <>
      <section className="stats" aria-label="整體統計">
        <Stat icon="list" label="名單項目" n={list.length} c="var(--acc)" />
        <Stat icon="users" label="登入過的玩家" n={users.length} c="var(--good)" />
        <Stat icon="clock" label="7 天內有玩" n={active} c="var(--acc2)" />
        <Stat icon="alert" label="存檔數字可疑" n={flagged.length} c={flagged.length ? 'var(--red)' : 'var(--sub)'} />
      </section>
      <div className="ov-grid">
        <section className="panel">
          <div className="list-hd"><h2><Icon name="clock" />最近登入</h2><button type="button" className="btn ghost sm" onClick={() => go('players')}>全部玩家<Icon name="chevron" /></button></div>
          <div className="rows">
            {recent.length ? recent.map((u) => (
              <div className="row" key={u.id}>
                <div className="av" style={{ '--h': hue(u.name) } as React.CSSProperties}>{[...u.name][0]}</div>
                <div className="who"><div className="entry">{u.name}{u.admin && <span className="pill admin"><Icon name="shield" />管理員</span>}</div><div className="meta"><span>{u.email}</span></div></div>
                <div className="ov-right"><b>{ago(u.lastLogin)}</b><small>{u.save ? `${yen(u.save.money)}・粉絲 ${Math.floor(u.save.fans || 0)}` : '還沒有存檔'}</small></div>
              </div>
            )) : <div className="empty"><Icon name="users" /><div>還沒有玩家登入過</div></div>}
          </div>
        </section>
        <section className="panel">
          <div className="list-hd"><h2><Icon name="alert" />需要注意</h2></div>
          <div className="rows">
            {flagged.map((u) => <FlagRow key={u.id} u={u} ask={ask} toast={toast} onDone={onDone} />)}
            {blocked > 0 && (
              <div className="row"><div className="av all"><Icon name="lock" /></div><div className="who"><div className="entry">{blocked} 位玩家已不在名單</div><div className="meta"><span>他們登不進來，存檔仍保留</span></div></div>
                <button type="button" className="btn ghost sm" onClick={() => go('players')}>查看</button></div>
            )}
            {!flagged.length && !blocked && <div className="empty"><Icon name="check" /><div>一切正常，沒有需要處理的帳號</div></div>}
          </div>
        </section>
      </div>
    </>
  );
}

function FlagRow({ u, ask, toast, onDone }: { u: Player } & Common) {
  const [busy, setBusy] = useState(false);
  const clear = async () => {
    if (!(await ask({ title: `清除 ${u.name} 的可疑標記？`, text: `原因：${u.flag}。確認是正常遊玩後再清除，之後排行榜會採用這位玩家的數字。`, ok: '清除標記', tone: 'warn' }))) return;
    setBusy(true);
    try {
      const r = await api('POST', '/api/admin/users/clear-flag', { id: u.id });
      if (!r.ok) toast(r.body.error || '清除失敗', true); else toast(`已清除 ${u.name} 的標記`);
      await onDone();
    } catch { toast('連不上伺服器，請稍後再試', true); }
    finally { setBusy(false); }
  };
  return (
    <div className="row">
      <div className="av" style={{ '--h': hue(u.name) } as React.CSSProperties}>{[...u.name][0]}</div>
      <div className="who"><div className="entry">{u.name}<span className="pill flag"><Icon name="alert" />可疑</span></div><div className="meta"><span>{u.flag.replace(/^\S+\s/, '')}</span></div></div>
      <button type="button" className="btn ghost sm" disabled={busy} onClick={() => void clear()}>清除標記</button>
    </div>
  );
}

/* ---------- 玩家 ---------- */
type PTab = 'all' | 'flag' | 'blocked' | 'admin';
type PSort = 'login' | 'money' | 'earned' | 'fans';
function Players({ users, ask, toast, onDone }: { users: Player[] } & Common) {
  const [q, setQ] = useState('');
  const [tab, setTab] = useState<PTab>('all');
  const [sort, setSort] = useState<PSort>('login');
  const counts = { all: users.length, flag: users.filter((u) => u.flag).length, blocked: users.filter((u) => !u.allowed).length, admin: users.filter((u) => u.admin).length };
  const f = q.trim().toLowerCase();
  const val = (u: Player) => (sort === 'login' ? u.lastLogin : sort === 'money' ? u.save?.money || 0 : sort === 'earned' ? u.save?.earned || 0 : u.save?.fans || 0);
  const rows = users
    .filter((u) => (tab === 'all' || (tab === 'flag' ? !!u.flag : tab === 'blocked' ? !u.allowed : u.admin)) && (!f || u.name.toLowerCase().includes(f) || u.email.includes(f)))
    .sort((a, b) => val(b) - val(a));
  const TABS: [PTab, string][] = [['all', '全部'], ['flag', '可疑'], ['blocked', '已移出名單'], ['admin', '管理員']];
  const SORTS: [PSort, string][] = [['login', '最後登入'], ['earned', '累計營收'], ['money', '資金'], ['fans', '粉絲']];
  return (
    <section className="panel">
      <div className="list-hd">
        <h2><Icon name="users" />玩家 <span className="sub">{users.length} 位</span></h2>
        <label className="search"><Icon name="search" /><input type="search" placeholder="搜尋暱稱或信箱" aria-label="搜尋玩家" value={q} onChange={(e) => setQ(e.target.value)} /></label>
      </div>
      <div className="tabs" role="tablist">
        {TABS.map(([k, n]) => <button key={k} type="button" role="tab" className="tab" aria-selected={tab === k} onClick={() => setTab(k)}>{n}<em>{counts[k]}</em></button>)}
        <span className="sort">排序
          <select value={sort} onChange={(e) => setSort(e.target.value as PSort)} aria-label="排序">{SORTS.map(([k, n]) => <option key={k} value={k}>{n}</option>)}</select>
        </span>
      </div>
      <div className="tbl-wrap">
        <table className="tbl">
          <thead><tr><th>玩家</th><th>最後登入</th><th className="num">資金</th><th className="num">累計營收</th><th className="num">粉絲</th><th className="col-z">區域</th><th>狀態</th><th aria-label="操作" /></tr></thead>
          <tbody>
            {rows.map((u) => (
              <tr key={u.id} className={u.allowed ? '' : 'off'}>
                <td><div className="pl"><span className="av sm" style={{ '--h': hue(u.name) } as React.CSSProperties}>{[...u.name][0]}</span><div><b>{u.name}</b><small>{u.email}</small></div></div></td>
                <td><span title={new Date(u.lastLogin).toLocaleString('zh-TW')}>{ago(u.lastLogin)}</span><small>加入 {fmtDate(u.createdAt)}</small></td>
                <td className="num">{u.save ? yen(u.save.money) : '—'}</td>
                <td className="num">{u.save ? yen(u.save.earned) : '—'}</td>
                <td className="num">{u.save ? Math.floor(u.save.fans || 0).toLocaleString() : '—'}</td>
                <td className="col-z">{u.save ? <span className="zones">{[0, 1, 2, 3].map((i) => <i key={i} className={i < (u.save!.zones || 0) ? 'on' : ''} />)}</span> : '—'}</td>
                <td className="st">
                  {u.admin && <span className="pill admin"><Icon name="shield" />管理員</span>}
                  {!u.allowed && <span className="pill off">已移出名單</span>}
                  {u.flag && <span className="pill flag" title={u.flag}><Icon name="alert" />可疑</span>}
                  {u.allowed && !u.flag && !u.admin && <span className="pill ok">正常</span>}
                </td>
                <td>{u.flag && <FlagClear u={u} ask={ask} toast={toast} onDone={onDone} />}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {!rows.length && <div className="empty"><Icon name="search" /><div>{users.length ? '沒有符合的玩家' : '還沒有玩家登入過'}</div></div>}
      </div>
    </section>
  );
}

function FlagClear({ u, ask, toast, onDone }: { u: Player } & Common) {
  const [busy, setBusy] = useState(false);
  return (
    <button type="button" className="btn ghost sm" disabled={busy} onClick={async () => {
      if (!(await ask({ title: `清除 ${u.name} 的可疑標記？`, text: `原因：${u.flag}。確認是正常遊玩後再清除。`, ok: '清除標記', tone: 'warn' }))) return;
      setBusy(true);
      try { const r = await api('POST', '/api/admin/users/clear-flag', { id: u.id }); if (!r.ok) toast(r.body.error || '清除失敗', true); else toast(`已清除 ${u.name} 的標記`); await onDone(); }
      catch { toast('連不上伺服器，請稍後再試', true); } finally { setBusy(false); }
    }}>清除標記</button>
  );
}
