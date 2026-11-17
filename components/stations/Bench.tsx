'use client';
/* 手作台：桌上一排凝膠罐（依數量裝滿），選一罐、按下手工捏製。
   捏製進度條 #benchBar 由 game.js 計時；這裡在捏製中換一條新的進度條並用動畫填滿。 */
import { G } from './game';
import { SlimeArt } from './Art';

export default function Bench() {
  const g = G(), S = g.S, sel = g.M.sp, busy = g.BN.busy, have = sel ? S.gel[sel] || 0 : 0;
  return (
    <div className="rx-bench">
      <p className="rx-note-line">手作台只能做出<b>粗製捏捏</b>：品質最低，固定售價 ¥10。想做出更酥脆、更值錢的捏捏，要用中央平地北邊的加工產線（機器可以在工作電腦網購）。</p>
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
      <div className="rx-craft">
        <div className="rx-steps" aria-hidden="true">
          <span>取 2 份凝膠</span><i>→</i><span>揉捏成形</span><i>→</i><span>粗製捏捏</span>
        </div>
        {sel && <div className="rx-craft-preview"><SlimeArt kind="gel" color={g.SP[sel].color} color2={g.SP[sel].color2} size={46} /><SlimeArt kind="gel" color={g.SP[sel].color} color2={g.SP[sel].color2} size={46} /><i>＋</i><SlimeArt kind="prod" color={g.SP[sel].color} color2={g.SP[sel].color2} size={56} /></div>}
        <div className="tbar" style={{ height: 10 }}><i id="benchBar" key={busy ? 'busy' : 'idle'} className={busy ? 'rx-run' : ''} /></div>
        <button type="button" className="btn big" style={{ width: '100%' }} data-act="benchMake" disabled={busy || have < 2}>{busy ? '捏製中…' : have < 2 ? '凝膠不足（需要 2 份）' : '手工捏製（消耗 2 份凝膠）'}</button>
        <small className="rx-dim">庫存 {S.stock.length}/{g.cap()}</small>
      </div>
    </div>
  );
}
