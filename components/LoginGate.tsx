'use client';
/* 進遊戲前的畫面：確認 Google 登入 → 對齊雲端存檔（必要時讓玩家選一份）→ 依序載入 Three.js、PeerJS、game.js。
   game.js 準備好會發出 slime:ready，這裡再把載入畫面淡出。 */
import { useEffect, useRef, useState } from 'react';
import { api, cloud, forgetOldKey, lastOf, reconcile, startSync, summary, type User } from '@/lib/cloud';

const LOGIN_MSG: Record<string, string> = {
  denied: '這個 Google 帳號不在允許名單。請改用學校的 Google 帳號，或請老師把你加進名單。',
  cancelled: '已取消登入。',
  expired: '登入逾時，請再按一次「用 Google 登入」。',
  unverified: '這個 Google 帳號的信箱還沒驗證，請換一個帳號。',
  failed: 'Google 登入失敗，請稍後再試一次。',
  config: '伺服器還沒設定好 Google 登入，請通知老師。',
};

type Pick = { local: string; cloud: string; mine: boolean; done: (useLocal: boolean) => void };
type View =
  | { k: 'boot'; text: string }
  | { k: 'login'; msg: string }
  | { k: 'pick'; pick: Pick }
  | { k: 'error'; msg: string }
  | { k: 'gone' };

function loadScript(src: string) {
  return new Promise<void>((resolve, reject) => {
    const s = document.createElement('script');
    s.src = src; s.async = false; // 依加入順序執行：game.js 一開始就要用到 THREE
    s.onload = () => resolve(); s.onerror = () => reject(new Error(src));
    document.body.appendChild(s);
  });
}

export default function LoginGate({ scripts }: { scripts: string[] }) {
  const [view, setView] = useState<View>({ k: 'boot', text: '正在確認登入…' });
  const [fading, setFading] = useState(false);
  const vendors = useRef<Promise<unknown> | null>(null);

  useEffect(() => {
    const onReady = () => { setFading(true); setTimeout(() => setView({ k: 'gone' }), 520); };
    window.addEventListener('slime:ready', onReady);
    const off = () => window.removeEventListener('slime:ready', onReady);
    if (window.__slimeBoot) return off; // React 開發模式會執行兩次 effect；遊戲只能載入一次
    window.__slimeBoot = true;
    window.SlimeCloud = cloud;
    forgetOldKey();
    // Three.js、PeerJS 先在背景下載執行，登入的同時就準備好
    vendors.current = Promise.all(scripts.slice(0, -1).map(loadScript));

    (async () => {
      const code = new URLSearchParams(location.search).get('login');
      if (code) history.replaceState(null, '', location.pathname + location.hash);
      let r;
      try { r = await api<{ user: User }>('GET', '/api/me'); } catch { return setView({ k: 'error', msg: '連不上伺服器，請確認網路後重新整理頁面。' }); }
      if (r.status === 401) return setView({ k: 'login', msg: (code && LOGIN_MSG[code]) || '' });
      if (!r.ok) return setView({ k: 'error', msg: '伺服器暫時無法使用，請稍後重新整理頁面。' });
      cloud.user = r.body.user;
      setView({ k: 'boot', text: '正在讀取雲端存檔…' });
      try {
        await reconcile((local, cloudData, mine) => new Promise<boolean>((done) => {
          setView({ k: 'pick', pick: { local, cloud: cloudData, mine, done: (v) => { setView({ k: 'boot', text: '正在套用存檔…' }); done(v); } } });
        }));
      } catch (e) {
        console.warn(e);
        return setView({ k: 'error', msg: '讀取雲端存檔失敗，請重新整理頁面再試一次。' });
      }
      setView({ k: 'boot', text: '正在生成月光谷…' });
      try {
        await vendors.current;
        await loadScript(scripts[scripts.length - 1]);
      } catch { return setView({ k: 'error', msg: '遊戲載入失敗，請重新整理頁面。' }); }
      startSync();
    })();
    return off;
  }, [scripts]);

  if (view.k === 'gone') return null;
  if (view.k === 'boot') {
    return (
      <div id="boot" className={fading ? 'out' : ''}>
        <div className="bootc"><div className="spin" /><div>{view.text}</div></div>
      </div>
    );
  }
  return (
    <div id="login">
      <div className="login-card">
        <div className="lslime" aria-hidden="true"><i /><i /><em /><em /></div>
        <div className="lshadow" aria-hidden="true" />
        <div className="lkicker">SQUISH LAB</div>
        <h1>史萊姆捏捏工坊</h1>
        <p className="lsub">走進月光谷，採集、加工、直播你的酥脆捏捏</p>
        {view.k === 'login' && (
          <>
            <a className="btn big gbtn" id="loginBtn" href="/api/auth/google">
              <GoogleLogo />用 Google 登入
            </a>
            <p className="lnote">換電腦、換手機都能接著玩：進度會存在雲端。</p>
            <div className="lmsg" role="alert">{view.msg}</div>
          </>
        )}
        {view.k === 'pick' && <SavePicker pick={view.pick} />}
        {view.k === 'error' && (
          <>
            <div className="lmsg" role="alert">{view.msg}</div>
            <button className="btn big" type="button" onClick={() => location.reload()} style={{ width: '100%' }}>重新整理</button>
          </>
        )}
        <a className="lpriv" href="/privacy" target="_blank" rel="noopener">隱私權政策</a>
      </div>
    </div>
  );
}

// 兩邊的進度不同：這台電腦（登入前的進度，或沒上傳的新進度） vs 雲端存檔
function SavePicker({ pick }: { pick: Pick }) {
  const newer = lastOf(pick.local) >= lastOf(pick.cloud) ? 'local' : 'cloud';
  const card = (k: 'local' | 'cloud', title: string, data: string) => (
    <button type="button" className="lpick" onClick={() => pick.done(k === 'local')}>
      <b>{title}{k === newer && <span className="lnew">較新</span>}</b>
      <span>{summary(data)}</span>
      <em>用這份</em>
    </button>
  );
  return (
    <div>
      <h2 className="lptitle">要用哪一份進度？</h2>
      <p className="lnote">{pick.mine ? '這台電腦有還沒上傳的進度，另一台裝置也存過新的進度。' : '這台電腦裡有登入前的進度，雲端也有你的存檔。'}</p>
      {card('local', '這台電腦', pick.local)}
      {card('cloud', '雲端存檔', pick.cloud)}
      <p className="lnote">沒選的那份會在伺服器保留 30 天。</p>
    </div>
  );
}

function GoogleLogo() {
  return (
    <svg className="glogo" viewBox="0 0 48 48" aria-hidden="true">
      <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
      <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
      <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z" />
      <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
    </svg>
  );
}
