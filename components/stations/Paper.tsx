'use client';
/* 手上的紙（game.js 的 PAPER）：3D 的紙飛到手上、舉到眼前、攤開，停在和 #gwin 完全重合的位置後由這裡接手。
   3D 只畫底色與裝飾，字在 2D 接手後才用墨水一行一行寫出來（.ink：#gui.shown 之後才跑動畫）；讀過或減少動態時直接寫好（.now）。
   PaperView 也用在手作台的便條（Bench.tsx）、手機印出來的收據（Live.tsx）與手帳的剪貼區（Inventory.tsx）。
   奶奶的筆記（gn）是便條的一種：筆記本撕下來的一頁，右上頁碼、左下一個小塗鴉（和字一起用墨水畫出來），找到時蓋上小秘密的章（stamp）。
   塗鴉與章排在字下面的同一排（.pp-gn-ft，不用絕對定位）：手機橫拿時字多一行也只是把這一排往下推，章不會蓋到簽名、塗鴉不會壓到字。 */
import type { CSSProperties, ReactNode } from 'react';
import { G, type PaperData, type Rcpt } from './game';

export default function Paper() {
  const p = G().paper?.();
  if (!p) return null;
  return <PaperView key={p.seq} p={p} live hint={p.hint} />; // seq：每拿一次換一個元素，墨水動畫重新開始
}

const L = (i: number) => ({ '--i': i }) as CSSProperties;
// 明信片的短句照逗號（與署名的全形空白）分段、每段不從中間斷：窄的時候在「，」後面換行，不會剩「了。」一兩個字自己一行
const ph = (t: string) => t.replace(/([，、；　])/g, '$1\u0000').split('\u0000').map((c, i) => <span key={i} className="pp-ph">{c}</span>);

export function PaperView({ p, live, hint }: { p: PaperData; live?: boolean; hint?: number | boolean }) {
  const ink = live && !p.rev && !p.rm ? ' ink' : ' now';
  const cls = `pp pp-${p.v}${p.gift ? ' pp-gift' : ''}${p.torn ? ' pp-torn' : ''}${p.gn ? ' pp-gn' : ''}${ink}`;
  const tip = hint ? <div className="pp-hint" style={{ opacity: typeof hint === 'number' ? hint : 1 }}>{p.touch ? '點一下收進手帳' : `E 收進手帳・走開就收起來${p.v === 'postcard' ? '・空白鍵翻面' : ''}`}</div> : null;
  let body: ReactNode = null;
  if (p.v === 'letter') {
    body = (
      <>
        <i className="pp-seal" aria-hidden="true" />
        <div className="pp-date">{p.day} 月光谷</div>
        <div className="pp-txt">
          {p.head && <p className="pp-l pp-head" style={L(0)}>{p.head}</p>}
          {p.b.map((t, i) => <p key={i} className="pp-l" style={L(i + 1)}>{t}</p>)}
          {p.sig && <p className="pp-l pp-sig" style={L(p.b.length + 1)}>{p.sig}</p>}
        </div>
        <Clover />
      </>
    );
  } else if (p.v === 'note') {
    body = (
      <>
        <i className="pp-tape" aria-hidden="true" />
        {p.gn && p.pg > 0 && <div className="pp-pg" aria-hidden="true">第 {p.pg} 頁</div>}
        <div className="pp-txt">
          {p.b.map((t, i) => <p key={i} className="pp-l" style={L(i)}>{p.gn ? ph(t) : t}</p>)}{/* 奶奶的筆記和明信片一樣照逗號分段：窄的手機上「滑一滑，」不會斷成「滑／一滑，」 */}
          {p.sig && <p className="pp-l pp-sig" style={L(p.b.length)}>{p.sig}</p>}
        </div>
        {p.gift && <div className="pp-doodle pp-l" style={L(p.b.length + 1)} aria-hidden="true"><Slicer /><span>北邊的產線 ↑</span></div>}
        {p.gn ? (
          <div className="pp-gn-ft">
            {p.dd ? <div className="pp-doodle pp-l" style={L(p.b.length + 1)} aria-hidden="true"><Doodle k={p.dd} /></div> : <i />}
            {p.stamp && <span className="pp-egg">{p.stamp}</span>}
          </div>
        ) : p.stamp && <span className="pp-egg">{p.stamp}</span>}
      </>
    );
  } else if (p.v === 'postcard') {
    const img = G().postcardImg?.(p.zone) || '';
    body = (
      <>
        <div className={`pp-card${p.flip ? ' flip' : ''}`}>
          <div className="pp-back">
            <div className="pp-txt">
              {p.b.map((t, i) => <p key={i} className="pp-l" style={L(i)}>{ph(t)}</p>)}
              {p.sig && <p className="pp-l pp-sig" style={L(p.b.length)}>{ph(p.sig)}</p>}
            </div>
            <div className="pp-stamp" style={{ '--acc': p.acc } as CSSProperties} aria-hidden="true"><Mark z={p.zone} /><small>{p.zoneName}</small></div>
            <div className="pp-pmark" aria-hidden="true"><b>月光谷</b><span>{p.day.replace('/', '.')}</span></div>
            <div className="pp-addr" aria-label={`寄給 ${p.who}`}><span>月光谷 奶奶的工坊</span><span>{p.who} 收</span><span /></div>
          </div>
          <div className="pp-front" aria-hidden={!p.flip}>{img && <img src={img} alt={`${p.zoneName}的風景`} draggable={false} />}</div>
        </div>
        {p.rm && !p.flip && img && <img className="pp-thumb" src={img} alt="" aria-hidden="true" draggable={false} />}{/* 減少動態：不翻面也看得到正面的畫（左上角夾一張小縮圖） */}
        {(p.touch || !live) && <button type="button" className="pp-flipbtn" data-act={live ? 'paperFlip' : 'clipFlip'}>翻面</button>}
      </>
    );
  } else if (p.v === 'receipt') {
    body = <Receipt d={p.d || { n: 0, inc: 0, tip: 0, fan: 0, sec: 0, t: 0 }} />;
  } else if (p.v === 'flyer') {
    // 武器店的傳單：亮黃紙、紅白斜紋邊（CSS）、大標、戴頭盔的騎士史萊姆、兩個價格吊牌（「｜」左邊是吊牌上的大字）、底下的路怎麼走
    body = (
      <div className="pp-fl-in">
        <p className="pp-l pp-fl-hd" style={L(0)}>{p.head.split('　').map((t, i) => <span key={i}>{t}</span>)}</p>
        <div className="pp-fl-hero" aria-hidden="true"><Knight /></div>
        {p.b.map((t, i) => { const [a, b] = t.split('｜'); return <p key={i} className="pp-l pp-fl-tag" style={L(i + 1)}><b>{a}</b>{b && <span>{b}</span>}</p>; })}
        <p className="pp-l pp-fl-ft" style={L(p.b.length + 1)}>{p.sig} <i aria-hidden="true">→</i></p>
      </div>
    );
  }
  return <div className={cls} role="dialog" aria-label={p.name}>{body}{tip}</div>;
}

function Receipt({ d }: { d: Rcpt }) {
  const g = G(), t = new Date(d.t || Date.now()), p2 = (n: number) => String(n).padStart(2, '0'), m = Math.floor(d.sec / 60);
  return (
    <>
      <div className="pp-rc-hd pp-l" style={L(0)}>
        <i className="pp-rc-logo" aria-hidden="true" /><b>SQUISH LIVE</b>
        <small>{t.getFullYear()}/{p2(t.getMonth() + 1)}/{p2(t.getDate())} {p2(t.getHours())}:{p2(t.getMinutes())}</small>
      </div>
      <p className="pp-l pp-rc-row" style={L(1)}><span>直播時長</span><b>{m}:{p2(d.sec % 60)}</b></p>
      <hr className="pp-rc-cut" />
      <p className="pp-l pp-rc-row" style={L(2)}><span>售出</span><b>{d.n} 件</b></p>
      <p className="pp-l pp-rc-row" style={L(3)}><span>銷售收入</span><b>{g.fmt(d.inc)}</b></p>
      <p className="pp-l pp-rc-row" style={L(4)}><span>觀眾斗內</span><b>{g.fmt(d.tip)}</b></p>
      <p className="pp-l pp-rc-row" style={L(5)}><span>新粉絲</span><b>+{d.fan}</b></p>
      <hr className="pp-rc-cut" />
      <p className="pp-l pp-rc-row pp-rc-sum" style={L(6)}><span>合計</span><b>{g.fmt(d.inc + d.tip)}</b></p>
      <p className="pp-l pp-rc-thx" style={L(7)}>謝謝收看 ♡ 下次見</p>
      <i className="pp-rc-bar" aria-hidden="true" />
    </>
  );
}

// 左下的壓花四葉草、便條上的小切片機、郵票上的地標：手繪線條（不用圖檔）
function Clover() {
  return (
    <svg className="pp-clover" viewBox="0 0 40 40" aria-hidden="true">
      {[0, 90, 180, 270].map((r) => <path key={r} d="M20 20c-2-6-9-8-10-3-1 4 4 6 10 3z" transform={`rotate(${r} 20 20)`} />)}
      <path d="M20 21c1 6 3 10 6 13" fill="none" />
    </svg>
  );
}
function Slicer() {
  return (
    <svg className="pp-slicer" viewBox="0 0 64 44" aria-hidden="true">
      <path d="M6 34h52M10 34l2-14h40l2 14M22 20V8h20v12M30 8V4h4v4M16 40a3 3 0 106 0M42 40a3 3 0 106 0" />
      <path d="M26 26l12-4" className="pp-red" />
    </svg>
  );
}
// 奶奶的筆記左下角的小塗鴉（每個撇步一個）：深色是鉛筆線、紅色（.pp-red）是奶奶用紅筆圈起來的重點
function Doodle({ k }: { k: string }) {
  let d: ReactNode = null;
  if (k === 'slice') d = <><path d="M4 36h56" /><circle cx="10" cy="40" r="3" /><circle cx="54" cy="40" r="3" /><path d="M14 36c0-11 6-17 13-17s13 6 13 17M22 28v1M32 28v1" /><path className="pp-red" d="M27 5v31" strokeDasharray="3 3" /><path d="M46 14l5 4-5 4M53 14l5 4-5 4" /></>; // 輸送帶上的史萊姆、紅色虛線的刀口、忽快忽慢
  else if (k === 'live') d = <><rect x="6" y="4" width="22" height="36" rx="4" /><path d="M11 31c0-6 3-9 6-9s6 3 6 9zM15 27v.5M19 27v.5M14 36h6" /><path className="pp-red" d="M41 23c-3-3-7-1-5 3l5 5 5-5c2-4-2-6-5-3zM53 9c-2-2-5-1-4 2l4 4 4-4c1-3-2-4-4-2z" /><path d="M32 30q3-1 4-4" /></>; // 手機裡的捏捏、飄起來的愛心
  else if (k === 'beat') d = <><path d="M2 36c0-8 4-12 8-12s8 4 8 12zM24 36c0-6 4-9 8-9s8 3 8 9zM46 36c0-4 4-6 8-6s8 2 8 6z" /><path className="pp-red" d="M7 13l3 3 3-3M29 16l3 3 3-3M51 19l3 3 3-3" /><text x="8" y="45">1</text><text x="30" y="45">2</text><text x="52" y="45">3</text></>; // 一下、一下、一下
  else if (k === 'tiptoe') d = <><ellipse cx="6" cy="39" rx="2.4" ry="3.4" /><ellipse cx="14" cy="32" rx="2.4" ry="3.4" /><ellipse cx="22" cy="38" rx="2.4" ry="3.4" /><ellipse cx="30" cy="31" rx="2.4" ry="3.4" /><path d="M40 37c0-8 4-12 10-12s10 4 10 12zM44 31q1.5 1.5 3 0M52 31q1.5 1.5 3 0" /><path className="pp-red" d="M56 9h5l-5 6h5" /></>; // 躡手躡腳的腳印、沒發現你的史萊姆
  else if (k === 'moon') d = <><path d="M17 5a11 11 0 1 0 11 16a9 9 0 1 1-11-16z" /><path className="pp-red" d="M35 7v6M32 10h6M27 30v4M25 32h4" /><path d="M36 39c0-8 5-12 11-12s11 4 11 12zM42 33v1M51 33v1" /><path className="pp-red" d="M47 22v-4M37 27l-3-2M57 27l3-2" /></>; // 月亮、星星、發光的史萊姆
  else if (k === 'mitten') d = <><path d="M8 41V20a9 9 0 0 1 18 0v6l4-3a3 3 0 0 1 4 4l-8 8v6zM8 36h18" /><path className="pp-red" d="M48 8v22M38.5 13.5l19 11M38.5 24.5l19-11" /></>; // 手套與雪花
  else if (k === 'curl') d = <><circle cx="22" cy="28" r="12" /><path d="M16 25l3 2-3 2M28 25l-3 2 3 2" /><path className="pp-red" d="M38 10c-2 3-3 6-1 7s3-1 1-7z" /><path d="M62 34H44M48 30l-4 4 4 4" /></>; // 縮成一團、冒汗、從旁邊慢慢靠近
  else if (k === 'moss') d = <><path d="M8 41c2-10 6-18 14-24M12 31c-4-1-6-4-6-7 4 0 6 3 6 7zM16 23c-3-2-4-5-3-8 3 1 5 4 3 8zM18 33c4-2 7-1 9 2-4 2-7 1-9-2z" /><path d="M38 39c0-7 4-10 10-10s10 3 10 10zM44 34v1M52 34v1" /><path className="pp-red" d="M26 9v.5M31 15v.5M48 16v7M44.5 19.5h7" /></>; // 發光的苔蘚、身上亮亮的捏捏
  return <svg className="pp-dd" viewBox="0 0 64 46" aria-hidden="true">{d}</svg>;
}
function Knight() {
  return (
    <svg className="pp-knight" viewBox="0 0 120 100" aria-hidden="true">
      <ellipse cx="58" cy="93" rx="36" ry="5" fill="#92400e26" />
      <path d="M22 90c0-30 15-50 36-50s36 20 36 50z" fill="#86efac" stroke="#3b2f2a" strokeWidth="2.5" strokeLinejoin="round" />
      <path d="M30 80c2-14 8-24 16-28" fill="none" stroke="#ffffff99" strokeWidth="4" strokeLinecap="round" />
      <circle cx="47" cy="72" r="4" fill="#3b2f2a" /><circle cx="69" cy="72" r="4" fill="#3b2f2a" />
      <ellipse cx="40" cy="80" rx="5" ry="3" fill="#fb7185aa" /><ellipse cx="76" cy="80" rx="5" ry="3" fill="#fb7185aa" />
      <path d="M53 80q5 5 10 0" fill="none" stroke="#3b2f2a" strokeWidth="2.2" strokeLinecap="round" />
      <path d="M27 60c0-20 13-31 31-31s31 11 31 31z" fill="#cbd5e1" stroke="#3b2f2a" strokeWidth="2.5" strokeLinejoin="round" />
      <path d="M27 60h62M58 30v30" fill="none" stroke="#3b2f2a" strokeWidth="2" />
      <path d="M58 30c-3-13 7-23 20-22-7 4-9 11-7 19z" fill="#ef4444" stroke="#3b2f2a" strokeWidth="2" strokeLinejoin="round" />
      <path d="M104 30l-6 44M93 66l13 3M97 74l-2 9" fill="none" stroke="#3b2f2a" strokeWidth="2.5" strokeLinecap="round" />
      <path d="M104 30l-6 44" fill="none" stroke="#e2e8f0" strokeWidth="1.2" />
    </svg>
  );
}
function Mark({ z }: { z: string }) {
  if (z === 'coast') return <svg viewBox="0 0 40 48" aria-hidden="true"><path d="M14 44l3-30h6l3 30zM13 14h14l-7-8z" /><path d="M16 22h8M15 30h10M14 38h12" className="pp-red" /></svg>;
  if (z === 'volcano') return <svg viewBox="0 0 40 48" aria-hidden="true"><path d="M3 44l13-26h8l13 26z" /><path d="M17 18c-2-6 2-9 0-14M23 18c2-5-1-8 2-12" className="pp-red" /></svg>;
  return <svg viewBox="0 0 40 48" aria-hidden="true"><path d="M12 44V16l4-6 4 6v28M22 44V22l4-6 4 6v22M6 44V28l3-4 3 4" /></svg>;
}
