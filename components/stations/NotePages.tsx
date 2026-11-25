'use client';
/* 筆記本的其他頁（設計分析 5.3 彈窗降級、11.4 操作說明進筆記本）：以前都是畫面中央的彈窗（解鎖滑鼠、鋪黑幕），現在寫在紙上。
   NotebookPage：Esc 筆記本往上翻一頁（Pause.tsx 依 g.nb.pg 換成這裡）——help 手繪鍵位圖（觸控與鍵盤自動切換）、delMe／logout 確認頁、
     conflict／cflKeep／cflLoad 雲端存檔衝突（另一台裝置有較新的進度：留哪一份？）。
   TitleNote：主選單沒有筆記本，同樣的頁寫在一張貼在選單欄上的紙（Title.tsx 依 g.title.pg 換成這裡）——help、saves 選存檔、del／new／full／fullDel 確認頁、雲端存檔衝突。
   確認頁＝紙上打勾（危險的事才要）＋蓋章。按鈕帶 data-act（cfTick、cfStamp、nbPage、tPage）由 game.js 處理；
   蓋章之後等印章動畫跑完才真的去做、翻到這頁的前 0.6 秒（打勾後 0.4 秒）蓋章不算，都在 game.js 的 cfStamp。樣式在 app/menus.css 的最後一段。 */
import type { ReactNode } from 'react';
import { G } from './game';

/* ---------- 打勾＋蓋章（工作電腦的事業合約 Branch.tsx 也用） ---------- */
export function Tick({ children }: { children: ReactNode }) {
  const cf = G().cf, on = !!cf?.ok;
  return (
    <button type="button" className={`nb-row cf-tick${on ? ' on' : ''}`} data-act="cfTick" aria-pressed={on} disabled={!!cf?.done}>
      <i className="nb-check" aria-hidden="true" /><b>{children}</b>
    </button>
  );
}
// 印章：還沒打勾時躺在紙上（淡、寫著「先打勾」）；可以蓋時立起來；蓋下去之後紙上留一個紅色的章（mark）
export function Stamp({ k, label, mark, need }: { k: string; label: string; mark: string; need?: boolean }) {
  const cf = G().cf, ready = !need || !!cf?.ok, done = !!cf?.done;
  return (
    <>
      <button type="button" className={`cf-stamp${ready ? ' ready' : ''}${done ? ' down' : ''}`} data-act="cfStamp" data-k={k} disabled={!ready || done} aria-label={ready ? label : `${label}（先打勾）`}>
        <i className="cf-grip" aria-hidden="true" /><span className="cf-face">{ready ? label : '先打勾'}</span>
      </button>
      {done && <i className="cf-mark" aria-hidden="true"><b>{mark}</b><small>{new Date().getMonth() + 1}.{new Date().getDate()}</small></i>}
    </>
  );
}
// 一張確認頁：標題、說明、（危險的事）打勾、翻回去／蓋章
function Confirm({ k, title, tick, stamp, mark, back, children }: { k: string; title: string; tick?: string; stamp: string; mark: string; back: ReactNode; children: ReactNode }) {
  const done = !!G().cf?.done;
  return (
    <div className={`cf${done ? ' done' : ''}`}>
      <h3 className="cf-h">{title}</h3>
      <div className="cf-b">{children}</div>
      {tick && <Tick>{tick}</Tick>}
      <div className="cf-acts">{back}<Stamp k={k} label={stamp} mark={mark} need={!!tick} /></div>
    </div>
  );
}
const Back = ({ act, k = '', id, children }: { act: string; k?: string; id?: number; children: ReactNode }) => (
  <button type="button" className="nb-btn nb-first cf-back" data-act={act} data-k={k} data-id={id} disabled={!!G().cf?.done}>{children}</button>
);

/* ---------- 手繪鍵位圖 ---------- */
function K({ children, w }: { children: ReactNode; w?: number }) {
  return <kbd className="km-k" style={w ? { minWidth: `${w}em` } : undefined}>{children}</kbd>;
}
function Mouse() {
  return (
    <svg className="km-mouse" viewBox="0 0 70 64" aria-hidden="true">
      <path d="M22 14c0-6 6-10 13-10s13 4 13 10v24c0 9-6 16-13 16s-13-7-13-16z" />
      <path d="M22 24h26M35 4v20" />
      <path d="M23 23v-9c0-5 5-9 11-9v18z" className="km-hl" />
      <path d="M14 22c-6 5-6 15 0 20M10 38l4 4 3-5M56 22c6 5 6 15 0 20M60 38l-4 4-3-5" className="km-arrow" />
    </svg>
  );
}
function KeyboardMap() {
  return (
    <div className="km-grid">
      <section className="km-g">
        <h4 className="km-h">走路</h4>
        <div className="km-wasd" aria-label="W A S D"><K>W</K><K>A</K><K>S</K><K>D</K></div>
        <ul className="km-l">
          <li><K w={3.4}>Shift</K><span>按著＝跑（史萊姆會早一點發現你）</span></li>
          <li><K w={5}>空白鍵</K><span>跳一下</span></li>
          <li><K>C</K><span>按著＝躡手躡腳，怕生的史萊姆比較不會發現</span></li>
        </ul>
      </section>
      <section className="km-g">
        <h4 className="km-h">看、捏</h4>
        <div className="km-row"><Mouse /><span>動滑鼠＝轉頭看<small>點一下畫面就會鎖住滑鼠</small></span></div>
        <ul className="km-l">
          <li><K>E</K><i>或</i><K w={2.6}>左鍵</K><span>捏史萊姆、用工作站、看線索（按住連續捏）</span></li>
          <li><K>1</K><i>～</i><K>9</K><span>換手上拿的東西（也可以轉滾輪）</span></li>
        </ul>
      </section>
      <section className="km-g">
        <h4 className="km-h">手帳、筆記本</h4>
        <ul className="km-l">
          <li><K>I</K><i>／</i><K w={2.6}>Tab</K><span>工坊手帳：背包、圖鑑、收起來的紙</span></li>
          <li><K w={2.6}>Esc</K><span>這本筆記本</span></li>
          <li><K>M</K><span>筆記本裡的手繪地圖（走過的地方才畫上去）</span></li>
          <li><i>按住</i><K w={2.6}>Tab</K><span>畫面上的錢、粉絲、目標全部攤開</span></li>
          <li><K w={2.6}>Alt</K><span>暫時放開滑鼠（遊戲不會停）</span></li>
        </ul>
      </section>
    </div>
  );
}
// 觸控：橫拿的手機，畫上搖桿、滑動與右下的按鈕（位置和 HUD 一樣），旁邊用號碼對照
function TouchMap() {
  const n = (x: number, y: number, i: number) => <g className="km-num"><circle cx={x} cy={y} r="8" /><text x={x} y={y + 4}>{i}</text></g>;
  const rows: [string, string][] = [['左半邊拖曳', '走路'], ['右半邊滑動', '轉頭看；點一下東西也能用'], ['手掌', '捏史萊姆、用工作站（按住連續捏）'], ['箭頭', '跳一下'], ['閃電', '跑'], ['腳印', '躡手躡腳，怕生的史萊姆比較不會發現'], ['右上角', '工坊手帳、這本筆記本']];
  return (
    <div className="km-touch">
      <svg className="km-phone" viewBox="0 0 300 150" aria-hidden="true">
        <rect x="6" y="6" width="288" height="138" rx="22" />
        <rect x="18" y="16" width="264" height="118" rx="10" className="km-scr" />
        <circle cx="62" cy="96" r="24" /><circle cx="68" cy="90" r="10" className="km-hl" />
        <path d="M128 58c24-14 56-14 80 0M199 50l9 8-11 4" className="km-arrow" />
        {/* 右下的按鈕和 HUD 一樣的位置與圖示（game/dom.html 的 #touch）：手掌（大）、箭頭、閃電、腳印 */}
        <circle cx="254" cy="106" r="15" className="km-hl" /><path transform="translate(244.4 96.4) scale(.8)" d="M9 11V5a1.5 1.5 0 013 0v5M12 10V4a1.5 1.5 0 013 0v6M15 10V6a1.5 1.5 0 013 0v7c0 4-2.5 7-6 7s-5-2-6.5-4.5L4 13a1.5 1.5 0 012.5-1.5L9 14" />
        <circle cx="219" cy="114" r="10" /><path transform="translate(212.4 107.4) scale(.55)" d="M12 19V6M6 11l6-6 6 6" />
        <circle cx="258" cy="72" r="10" /><path transform="translate(251.4 65.4) scale(.55)" d="M13 4l-3 7h5l-4 9" />
        <circle cx="222" cy="80" r="10" /><path transform="translate(215.4 73.4) scale(.55)" d="M8 3c-1.7 0-2.5 2-2.5 4.5S6.6 12 8 12s2.3-2 2.3-4.5S9.7 3 8 3zM16 8c-1.6 0-2.4 2-2.4 4.3s.9 4.2 2.4 4.2 2.4-1.9 2.4-4.2S17.6 8 16 8z" />
        <rect x="244" y="22" width="13" height="11" rx="3" /><rect x="261" y="22" width="13" height="11" rx="3" />
        {n(30, 66, 1)}{n(168, 36, 2)}{n(278, 126, 3)}{n(200, 128, 4)}{n(278, 56, 5)}{n(202, 66, 6)}{n(234, 40, 7)}
      </svg>
      <ol className="km-legend">
        {rows.map(([a, b], i) => <li key={i}><b className="km-n">{i + 1}</b><span><em>{a}</em>＝{b}</span></li>)}
      </ol>
    </div>
  );
}
export function KeyMap() {
  const g = G(), net = !!g.NET?.on;
  return (
    <div className="km">
      {g.TOUCH ? <TouchMap /> : <KeyboardMap />}
      <p className="km-tip"><b>小撇步</b>準心外圈的三格是採集進度：每一下抓穩約 0.3 秒，連續「完美」會多 1 份凝膠。</p>
      {net && <p className="km-tip friend"><b>和朋友一起</b>巨型史萊姆要兩個人一起捏；拿著凝膠對準朋友就能送給他。</p>}
    </div>
  );
}

/* ---------- 雲端存檔衝突（lib/cloud.ts 的 conflict → game.js 的 cloudConflict）：以前是畫面中央的彈窗，一鍵就把這台的進度換掉 ----------
   conflict＝兩個選項；選一個翻到那份的確認頁。換掉這台進度的那邊（cflLoad）要先打勾。act＝翻頁用的 data-act（筆記本 nbPage、主選單 tPage） */
function CloudPage({ pg, act }: { pg: string; act: string }) {
  const g = G(), c = g.cfl, t = g.fmtTime(c?.at);
  if (!c) return <p className="rx-tn-sub">已經選好了，雲端照常同步。</p>;
  if (pg === 'cflKeep') {
    return (
      <Confirm k="cflKeep" title="留這台的進度？" stamp="蓋章留下" mark="留下" back={<Back act={act} k="conflict">← 先不要</Back>}>
        <p className="cf-what">{c.here}</p>
        <p className="cf-s">雲端上另一台裝置的進度（{t} 存檔）會收起來，在伺服器保留 30 天。</p>
      </Confirm>
    );
  }
  if (pg === 'cflLoad') {
    return (
      <Confirm k="cflLoad" title="換成另一台的進度？" tick="我知道這台電腦的進度會換掉" stamp="蓋章載入" mark="載入" back={<Back act={act} k="conflict">← 先不要</Back>}>
        <p>這台電腦的進度會換成另一台裝置 {t} 存的那份，頁面會重新整理。</p>
        <p className="cf-s">換掉的這一份（{c.here}）在伺服器保留 30 天。</p>
      </Confirm>
    );
  }
  return (
    <div className="cf">
      <h3 className="cf-h">另一台裝置有較新的進度</h3>
      <div className="cf-b"><p>你在別的電腦或手機上玩過（雲端存檔時間 {t}）。要留哪一份？選好之前，這台的進度先不上傳。</p></div>
      <div className="cf-picks">
        <button type="button" className="nb-row cf-pick cl" data-act={act} data-k="cflKeep"><b>留這台的進度</b><em>選這份 →</em><small>{c.here}</small></button>
        <button type="button" className="nb-row cf-pick cl" data-act={act} data-k="cflLoad"><b>換成另一台的進度</b><em>選這份 →</em><small>{t} 存檔</small></button>
      </div>
      <div className="cf-acts"><Back act={act}>{act === 'nbPage' ? '← 之後再選，翻回選單' : '← 之後再選'}</Back></div>
    </div>
  );
}
const CLOUD_PG = /^(conflict|cflKeep|cflLoad)$/;

/* ---------- Esc 筆記本的其他頁 ---------- */
export function NotebookPage() {
  const pg = G().nb?.pg || '';
  const back = <Back act="nbPage">← 先不要，翻回去</Back>;
  if (CLOUD_PG.test(pg)) return <div className="nb-page"><CloudPage pg={pg} act="nbPage" /></div>;
  if (pg === 'help') {
    return (
      <div className="nb-page nb-help">
        <div className="nb-pg-top"><Back act="nbPage">← 翻回選單</Back><span className="nb-pgno" aria-hidden="true">p.1</span></div>
        <KeyMap />
      </div>
    );
  }
  if (pg === 'delMe') {
    return (
      <div className="nb-page">
        <Confirm k="delMe" title="真的要刪除我的資料？" tick="我知道刪除之後沒辦法復原" stamp="蓋章刪除" mark="刪除" back={back}>
          <p>會刪掉伺服器上的帳號、遊戲進度與保留中的存檔，所有裝置都會登出，這台電腦上的進度也會清掉。</p>
        </Confirm>
      </div>
    );
  }
  if (pg === 'logout') {
    return (
      <div className="nb-page">
        <Confirm k="logout" title="進度還沒傳到雲端" stamp="蓋章登出" mark="登出" back={back}>
          <p>現在連不上伺服器。這時候登出的話，新的進度會留在這台電腦；下次用同一個帳號在這台電腦登入時再上傳。</p>
        </Confirm>
      </div>
    );
  }
  return null;
}

/* ---------- 主選單：貼在選單欄上的一張紙 ---------- */
export function TitleNote() {
  const g = G(), t = g.title, pg = t.pg || '', saves = g.saves?.() || [], cur = saves.find((s) => s.slot === (t.slot || 0));
  let title = '', back: ReactNode = <Back act="tPage">← 回主選單</Back>, body: ReactNode = null;
  if (pg === 'help') {
    title = '怎麼玩'; body = <KeyMap />;
  } else if (pg === 'saves') {
    title = '選一本存檔';
    body = (
      <>
        <p className="rx-tn-sub">共 {saves.length}/{g.MAX_SAVES ?? 3} 本。只有目前這本會同步到雲端。</p>
        <div className="sv-list" dangerouslySetInnerHTML={{ __html: saves.map((s) => s.html).join('') }} />
      </>
    );
  } else if (pg === 'del' && cur) {
    title = ''; body = (
      <Confirm k="tDel" title="撕掉這本存檔？" tick="我知道撕掉就找不回來" stamp="蓋章刪除" mark="刪除" back={<Back act="tPage" k="saves">← 先不要</Back>}>
        <p className="cf-what">{cur.label}</p>
      </Confirm>
    );
    back = null;
  } else if (pg === 'new') {
    title = ''; back = null; body = (
      <Confirm k="tNew" title="開始新遊戲？" stamp="蓋章開始" mark="開始" back={<Back act="tPage">← 先不要</Back>}>
        <p>目前的進度會另外收起來（存檔 {saves.length}/{g.MAX_SAVES ?? 3}），之後可以從「繼續遊戲」選回來。</p>
      </Confirm>
    );
  } else if (pg === 'full') {
    title = `存檔已滿（${saves.length}/${g.MAX_SAVES ?? 3}）`;
    body = (
      <>
        <p className="rx-tn-sub">要先撕掉一本，才能開始新遊戲。撕掉之後沒辦法復原。</p>
        <div className="cf-picks">
          {saves.map((s) => <button key={s.slot} type="button" className="nb-row cf-pick" data-act="tPage" data-k="fullDel" data-id={s.slot}><b>{s.slot === 0 ? '目前這本・' : ''}{s.label}</b><small>撕掉這本</small></button>)}
        </div>
      </>
    );
  } else if (CLOUD_PG.test(pg)) {
    title = ''; back = null; body = <CloudPage pg={pg} act="tPage" />;
  } else if (pg === 'fullDel' && cur) {
    title = ''; back = null; body = (
      <Confirm k="tFullDel" title="撕掉這本、開始新遊戲？" tick="我知道撕掉就找不回來" stamp="蓋章刪除並開始" mark="刪除" back={<Back act="tPage" k="full">← 先不要</Back>}>
        <p className="cf-what">{cur.label}</p>
      </Confirm>
    );
  } else {
    body = <p className="rx-tn-sub">這一頁已經不見了。</p>;
  }
  return (
    <section className={`rx-tnote${pg === 'saves' ? ' saves' : ''}`} aria-label={title || '確認'}>
      <i className="rx-tn-tape" aria-hidden="true" />
      {(title || back) && <header className="rx-tn-hd">{title && <b>{title}</b>}{back}</header>}
      {body}
    </section>
  );
}
