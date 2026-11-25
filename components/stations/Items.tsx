/* 共用：捏捏卡片、等級章、空狀態、價目表 */
import { G, pct, prodName, type Product } from './game';
import { SlimeArt } from './Art';

const CH_NAME: Record<string, string> = { live: '直播', web: '網站', shop: '小店' };

// 等級章（第 7.1 節）：看做好時的酥脆（蓋了章就不變，捏過只會變軟），S ×1.5、A ×1.2、B ×1、C ×0.8；粗製的固定 ¥10、不分等級，不蓋章
export function GradeStamp({ p, big }: { p: Product; big?: boolean }) {
  const g = G(), r = g.gradeOf(p);
  if (p.crude) return null;
  return <span className={`rx-gr g${r.g}${big ? ' big' : ''}`} aria-label={`${r.g} 級，售價 ×${r.m}`} title={`${r.g} 級（做好時酥脆 ${pct(p.crisp)}）：售價 ×${r.m}`}>{r.g}</span>;
}

// 一個捏捏：點下去執行 act（上架、下架、放上展示台…，由 game.js 處理）；ch＝第三行標哪個通路的售價（預設直播）
// 捏過的捏捏網站不收：網站頁的庫存改標它在直播能賣多少
export function ProdTile({ p, act, extra, sel, ch = 'live' }: { p: Product; act: string; extra?: string; sel?: boolean; ch?: string }) {
  const g = G(), sp = g.SP[p.sp], cut = p.cut ? g.CUTS[p.cut] : null;
  const c = ch === 'web' && (p.played || p.dur < 100) ? 'live' : ch;
  return (
    <button type="button" className={`rx-tile${sel ? ' sel' : ''}`} data-act={act} data-id={p.id}>
      <SlimeArt kind="prod" color={sp.color} color2={sp.color2} cut={p.cut} size={52} />
      <span className="rx-tile-body">
        <b>{prodName(g, p)}{cut && <small style={{ color: cut.col }}> {cut.n}</small>}</b>
        <span>酥脆 {pct(g.effCrisp(p))} · 耐久 {Math.round(p.dur)}%</span>
        <span>{p.deco.length ? `裝飾 ${p.deco.length}` : '無裝飾'} · {CH_NAME[c] || ''} <b className="rx-tile-pr">{g.fmt(g.priceOf(p, c))}</b></span>
        {extra && <em>{extra}</em>}
      </span>
      <GradeStamp p={p} />
    </button>
  );
}

export function Empty({ children }: { children: React.ReactNode }) {
  return <div className="rx-empty">{children}</div>;
}

// 價目表（取代原本的定價三選一）：每種史萊姆、每個等級的厚塊售價；流行色已經算進去
export function PriceList({ ch }: { ch: string }) {
  const g = G(), S = g.S, list = g.SPECIES.filter((s) => S.codex[s.id]), grades = [...g.GRADES].reverse();
  if (!list.length) return <Empty>尚未收集任何史萊姆。</Empty>;
  const at = (sp: string, min: number) => g.priceOf({ id: 0, sp, crisp: Math.max(min, 0.3), dur: 100, deco: [], cut: 'thick', cq: 0.7 }, ch);
  // 說明裡的倍數照 game.js 的數字算：薄片、造型切是「厚塊的幾倍」（切法倍率都是絕對值，厚塊本身 ×0.9）；裝飾零件的範圍看 DECO
  const rel = (k: string) => `${+(g.CUTS[k].pm / g.CUTS.thick.pm).toFixed(2)}`, dv = Object.values(g.DECO).map((d) => Math.round(d.v * 100));
  return (
    <div className="rx-plist">
      <p className="rx-note-line">售價看成品的等級（做好時的酥脆，捏過也不變）：{g.GRADES.map((r) => `${r.g}${r.min ? ` ≥ ${Math.round(r.min * 100)}%` : ''} ×${r.m}`).join('、')}。下表是厚塊、沒有裝飾的價錢{ch === 'live' ? '（夜行種已含直播燈下的 ×1.15）' : ''}；薄片是厚塊的 {rel('thin')} 倍、星形與愛心 {rel('star')} 倍，每個裝飾零件再 +{Math.min(...dv)}%～{Math.max(...dv)}%。</p>
      <div className="rx-plist-row hd"><span className="nm">種類</span>{grades.map((r) => <span key={r.g} className={`rx-gr g${r.g}`}>{r.g}</span>)}</div>
      {list.map((s) => {
        const hot = g.trend.sp === s.id;
        return (
          <div className="rx-plist-row" key={s.id}>
            <span className="nm" title={s.name}><i className="rx-dot" style={{ background: s.color }} />{g.short(s.id)}{hot && <span className="tag">流行</span>}</span>
            {grades.map((r) => <b key={r.g}>{g.fmt(at(s.id, r.min))}</b>)}
          </div>
        );
      })}
    </div>
  );
}
