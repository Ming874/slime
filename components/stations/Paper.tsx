'use client';
/* 手上的紙（game.js 的 PAPER）：3D 的紙飛到手上、舉到眼前、攤開，停在和 #gwin 完全重合的位置後由這裡接手。
   3D 只畫底色與裝飾，字在 2D 接手後才用墨水一行一行寫出來（.ink：#gui.shown 之後才跑動畫）；讀過或減少動態時直接寫好（.now）。
   PaperView 也用在手作台的便條（Bench.tsx）、手機印出來的收據（Live.tsx）與手帳的剪貼區（Inventory.tsx）。 */
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
  const cls = `pp pp-${p.v}${p.gift ? ' pp-gift' : ''}${p.torn ? ' pp-torn' : ''}${ink}`;
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
        <div className="pp-txt">
          {p.b.map((t, i) => <p key={i} className="pp-l" style={L(i)}>{t}</p>)}
          {p.sig && <p className="pp-l pp-sig" style={L(p.b.length)}>{p.sig}</p>}
        </div>
        {p.gift && <div className="pp-doodle pp-l" style={L(p.b.length + 1)} aria-hidden="true"><Slicer /><span>北邊的產線 ↑</span></div>}
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
