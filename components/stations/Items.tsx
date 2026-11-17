/* 共用：捏捏卡片、空狀態、定價選擇 */
import { G, pct, prodName, type Product } from './game';
import { SlimeArt } from './Art';

// 一個捏捏：點下去執行 act（上架、下架、放上展示台…，由 game.js 處理）
export function ProdTile({ p, act, extra, sel }: { p: Product; act: string; extra?: string; sel?: boolean }) {
  const g = G(), sp = g.SP[p.sp], cut = p.cut ? g.CUTS[p.cut] : null;
  return (
    <button type="button" className={`rx-tile${sel ? ' sel' : ''}`} data-act={act} data-id={p.id}>
      <SlimeArt kind="prod" color={sp.color} color2={sp.color2} cut={p.cut} size={52} />
      <span className="rx-tile-body">
        <b>{prodName(g, p)}{cut && <small style={{ color: cut.col }}> {cut.n}</small>}</b>
        <span>酥脆 {pct(g.effCrisp(p))} · 耐久 {Math.round(p.dur)}%</span>
        <span>{p.deco.length ? `裝飾 ${p.deco.length}` : '無裝飾'} · 約 {g.fmt(g.fair(p, 'live'))}</span>
        {extra && <em>{extra}</em>}
      </span>
    </button>
  );
}

export function Empty({ children }: { children: React.ReactNode }) {
  return <div className="rx-empty">{children}</div>;
}

// 定價三選一（便宜／合理／高價）：按鈕帶 data-act="tier"，由 game.js 記下選擇
export function PriceTiers({ ch }: { ch: string }) {
  const g = G(), S = g.S, list = g.SPECIES.filter((s) => S.codex[s.id]);
  if (!list.length) return <Empty>尚未收集任何史萊姆。</Empty>;
  return (
    <div className="rx-tiers">
      <p className="rx-note-line">選一種定價策略就好。實際售價還會隨切法、裝飾與流行色調整（以酥脆 80% 估算）。</p>
      {list.map((s) => {
        const cur = g.tierOf(ch, s.id), f = g.fair({ sp: s.id, crisp: 0.8, dur: 100, deco: [] }, ch), hot = g.trend.sp === s.id, tm = hot ? 1.35 : 1;
        return (
          <div className="prow2" key={s.id}>
            <span className="nm"><i className="rx-dot" style={{ background: s.color }} />{s.name}{hot && <span className="tag">流行</span>}</span>
            <div className="seg">
              {g.TIER.map((t, i) => {
                const pr = Math.max(1, Math.round(g.defPrice(s.id, ch) * t.m * tm));
                return (
                  <button key={t.n} type="button" className={i === cur ? 'on' : ''} data-act="tier" data-ch={ch} data-sp={s.id} data-k={i}>
                    <b>{t.n}</b><small>每件約 {g.fmt(pr)}<br />{g.speedTxt(g.demand(pr, f))}</small>
                  </button>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}
