'use client';
/* 裝飾桌：庫存列（選一個捏捏來裝飾）、零件盤、選中零件的大小與旋轉。
   3D 預覽 #decorCv 仍由 game.js 負責；滑桿帶 data-r，由 game.js 的 input 事件即時套用。 */
import { G, type Product } from './game';
import { Empty, ProdTile } from './Items';

type DecoPiece = { k: string; s: number; r: number };
type DecorGame = { D: { id: number | null }; decorSel: { p: (Product & { deco: DecoPiece[] }) | null; sel: number }; decoBonus: (p: Product) => number };

export function DecorStock() {
  const g = G(), S = g.S, D = (g as unknown as DecorGame).D;
  if (!S.stock.length) return <Empty>背包裡沒有捏捏，先到加工產線做一個吧。</Empty>;
  return <div className="rx-strip">{S.stock.map((p) => <ProdTile key={p.id} p={p} act="decoSel" sel={D.id === p.id} />)}</div>;
}

export function DecoTools() {
  const g = G(), S = g.S, x = g as unknown as DecorGame, p = x.decorSel.p, sel = x.decorSel.sel;
  if (!p) return <Empty>選擇捏捏後即可擺放裝飾零件（拖曳零件移動、拖曳空白處旋轉）。</Empty>;
  const d = p.deco[sel], bonus = Math.round(x.decoBonus(p) * 100), packName = (k: string) => g.PACKS[k]?.name || '';
  return (
    <div className="rx-decotools">
      <div className="rx-deco-hd">
        <b>零件 {p.deco.length}/6</b>
        <span className="rx-deco-meter" aria-hidden="true">{Array.from({ length: 6 }, (_, i) => <i key={i} className={i < p.deco.length ? 'on' : ''} />)}</span>
        <em>售價與人氣 +{bonus}%</em>
      </div>
      <div className="rx-palette">
        {Object.entries(g.DECO).map(([k, dc]) => {
          // 苔光（第 4 堂）不是零件包：在山洞裡摘到幾份就能放幾個
          const cave = dc.pack === 'cave', moss = (S as { cave?: { mossN?: number } }).cave?.mossN || 0, has = cave ? moss > 0 : S.packs.includes(dc.pack);
          return (
            <button key={k} type="button" className={`rx-part${has ? '' : ' locked'}`} data-act="addDeco" data-k={k} disabled={!has || p.deco.length >= 6}
              title={cave ? (has ? `加上${dc.n}（還有 ${moss} 份）` : '到山洞裡摘發光苔蘚，就能做成苔光') : has ? `加上${dc.n}` : `需要${packName(dc.pack)}（工作電腦的網購／器材行）`} style={{ '--pc': dc.c } as React.CSSProperties}>
              <i aria-hidden="true" /><span>{dc.n}{cave ? ` ×${moss}` : ''}</span>
            </button>
          );
        })}
      </div>
      {d ? (
        <div className="rx-deco-edit" key={sel}>
          <div className="rx-deco-edit-hd"><b>選中：{g.DECO[d.k]?.n || '零件'}</b><button type="button" className="btn sm red" data-act="delDeco">移除</button></div>
          <label className="rx-range"><span>大小</span><input type="range" min="0.5" max="2" step="0.05" defaultValue={d.s} data-r="s" /></label>
          <label className="rx-range"><span>旋轉</span><input type="range" min="-3.14" max="3.14" step="0.05" defaultValue={d.r} data-r="r" /></label>
        </div>
      ) : <p className="rx-note-line">點選捏捏上的零件，可以調整大小、旋轉或移除。</p>}
      <button type="button" className="btn sm ghost" data-act="photo">拍照（下載圖片）</button>
    </div>
  );
}
