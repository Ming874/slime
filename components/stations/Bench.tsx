'use client';
/* 手作台：桌上一排凝膠罐（依數量裝滿），選一罐、按下手工捏製。第一個捏捏做好時，奶奶的便條從凝膠罐那排底下滑出來（.rx-gift）。
   說明只留步驟列一行（前 10 分鐘的文字預算 11.1）：「要 2 份凝膠、做出來值 ¥10」都在步驟裡，更值錢的產線交給奶奶便條上的塗鴉。
   捏製進度條 #benchBar 由 game.js 計時；這裡在捏製中換一條新的進度條並用動畫填滿。 */
import { useEffect, useRef } from 'react';
import { G } from './game';
import { SlimeArt } from './Art';
import { PaperView } from './Paper';

export default function Bench() {
  const g = G(), S = g.S, sel = g.M.sp, busy = g.BN.busy, have = sel ? S.gel[sel] || 0 : 0, gift = g.BN.gift && g.paperOf ? g.paperOf('gift') : null;
  // 便條滑出來（rx-gift-in 播完）之後捲到看得見整張：手機橫放時介面只有 270 px 高，塗鴉「北邊的產線 ↑」和署名原本落在可見範圍下面。
  // 等動畫播完而不是固定幾毫秒：介面還在從手上拿起來（還沒排版）時捲不動，動畫也要等介面出現才開始播；減少動態沒有動畫，靠 1.5 秒的備用
  const giftRef = useRef<HTMLDivElement>(null), hasGift = !!gift;
  useEffect(() => {
    const el = giftRef.current; if (!hasGift || !el) return;
    const go = () => el.scrollIntoView({ block: 'nearest', behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
    const onEnd = (e: AnimationEvent) => { if (e.animationName === 'rx-gift-in') go(); };
    el.addEventListener('animationend', onEnd); const t = setTimeout(go, 1500);
    return () => { el.removeEventListener('animationend', onEnd); clearTimeout(t); };
  }, [hasGift]);
  return (
    <div className="rx-bench">
      <div className="rx-jars">
        {g.unlockedSpecies().map((s) => {
          const n = S.gel[s.id] || 0;
          return (
            <button key={s.id} type="button" className={`rx-jar${sel === s.id ? ' on' : ''}${n < 2 ? ' low' : ''}`} data-act="pickSp" data-id={s.id}>
              <span className="rx-jar-glass"><i style={{ height: `${Math.min(100, n * 10)}%`, background: s.color }} /><span className="rx-jar-lid" /></span>
              <b>{g.short(s.id)}</b><small>凝膠 {n}</small>
            </button>
          );
        })}
      </div>
      {/* 奶奶的便條滑到捏製區旁邊（窄的時候在上面）：不把捏製按鈕擠到看不見的地方 */}
      <div className={`rx-bench-row${gift ? ' has-gift' : ''}`}>
      <div className="rx-craft">
        <div className="rx-steps" aria-hidden="true">
          <span>取 2 份凝膠</span><i>→</i><span>揉捏成形</span><i>→</i><span>粗製捏捏 ¥10</span>
        </div>
        {sel && <div className="rx-craft-preview"><SlimeArt kind="gel" color={g.SP[sel].color} color2={g.SP[sel].color2} size={46} /><SlimeArt kind="gel" color={g.SP[sel].color} color2={g.SP[sel].color2} size={46} /><i>＋</i><SlimeArt kind="prod" color={g.SP[sel].color} color2={g.SP[sel].color2} size={56} /></div>}
        <div className="tbar" style={{ height: 10 }}><i id="benchBar" key={busy ? 'busy' : 'idle'} className={busy ? 'rx-run' : ''} /></div>
        <button type="button" className="btn big" style={{ width: '100%' }} data-act="benchMake" aria-label={busy ? undefined : '手工捏製（消耗 2 份凝膠）'} disabled={busy || have < 2}>{busy ? '捏製中…' : have < 2 ? '凝膠不夠' : '手工捏製'}</button>
        <small className="rx-dim">庫存 {S.stock.length}/{g.cap()}</small>
      </div>
      {gift && <div className="rx-gift" ref={giftRef} aria-live="polite"><PaperView p={gift} live /></div>}
      </div>
    </div>
  );
}
