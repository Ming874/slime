'use client';
/* 允許名單管理（管理員專用）：新增／移除可以登入的信箱與網域、設定管理員。
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

export default function AdminApp() {
  const [state, setState] = useState<'loading' | 'ok' | 'login' | 'forbidden' | 'error'>('loading');
  const [errMsg, setErrMsg] = useState('');
  const [me, setMe] = useState<User | null>(null);
  const [myEmail, setMyEmail] = useState('');
  const [list, setList] = useState<Entry[]>([]);
  const [players, setPlayers] = useState(0);
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
      const [m, r] = await Promise.all([api<{ user: User }>('GET', '/api/me'), api<{ list: Entry[]; me: string; players: number }>('GET', '/api/admin/allow')]);
      if (m.status === 401 || r.status === 401) return setState('login');
      if (r.status === 403) return setState('forbidden');
      if (!r.ok) { setErrMsg(r.body.error || '伺服器暫時無法使用'); return setState('error'); }
      setMe(m.body.user); setList(r.body.list || []); setMyEmail(r.body.me || ''); setPlayers(r.body.players || 0);
      setState('ok');
    } catch { setErrMsg('連不上伺服器，請確認網路後重新整理頁面。'); setState('error'); }
  }, []);
  useEffect(() => { void load(); }, [load]);

  const stats = useMemo(() => ({
    total: list.length,
    admins: list.filter((x) => x.admin).length,
    domains: list.filter((x) => kindOf(x.entry) !== 'email').length,
  }), [list]);

  return (
    <>
      <header className="top">
        <div className="wrap">
          <div className="brand">
            <span className="blob" aria-hidden="true" />
            <div style={{ minWidth: 0 }}><div className="kicker">SQUISH LAB</div><div className="ttl">允許名單管理</div></div>
          </div>
          {me && (
            <div className="me" title={me.name}>
              <span className="av" style={{ '--h': hue(me.name) } as React.CSSProperties}>{[...me.name][0]}</span>
              <div><b>{me.name}</b><small>管理員</small></div>
            </div>
          )}
          <a className="btn ghost" href="/"><Icon name="back" /><span className="back-txt">回到遊戲</span></a>
        </div>
      </header>

      <main className="wrap">
        {state === 'loading' && <Skeleton />}
        {state === 'login' && <Gate icon="login" title="請先登入" text="回到遊戲用 Google 登入後，再從暫停選單的「管理允許名單」進來。" action={<a className="btn primary" href="/">回到遊戲登入</a>} />}
        {state === 'forbidden' && <Gate icon="lock" title="只有管理員可以使用" text="如果你需要管理名單，請其他管理員把你設為管理員。" action={<a className="btn ghost" href="/">回到遊戲</a>} />}
        {state === 'error' && <Gate icon="alert" title="讀取失敗" text={errMsg} action={<button className="btn primary" onClick={() => location.reload()}>重新整理</button>} />}
        {state === 'ok' && (
          <>
            <div className="hello">
              <div>
                <h1>誰可以進月光谷</h1>
                <p>名單上的 Google 帳號才能登入遊戲；移出名單的人下一次操作就會被登出，存檔會保留。</p>
              </div>
            </div>
            <section className="stats" aria-label="名單統計">
              <Stat icon="list" label="名單項目" n={stats.total} c="var(--acc)" />
              <Stat icon="shield" label="管理員" n={stats.admins} c="var(--warn)" />
              <Stat icon="school" label="開放的網域" n={stats.domains} c="var(--acc2)" />
              <Stat icon="users" label="登入過的玩家" n={players} c="var(--good)" />
            </section>
            <div className="layout">
              <AddPanel list={list} ask={ask} toast={toast} onDone={load} />
              <ListPanel list={list} myEmail={myEmail} ask={ask} toast={toast} onDone={load} />
            </div>
          </>
        )}
      </main>

      {dialog && <ConfirmDialog d={dialog} close={(ok) => { dialog.resolve(ok); setDialog(null); }} />}
      <div className="toasts" aria-live="polite">
        {toasts.map((t) => (
          <div key={t.id} className={`toast${t.err ? ' err' : ''}${t.out ? ' out' : ''}`}><Icon name={t.err ? 'alert' : 'check'} />{t.text}</div>
        ))}
      </div>
    </>
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
                  {x.note && <span className="note"><Icon name="tag" />{x.note}</span>}
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
