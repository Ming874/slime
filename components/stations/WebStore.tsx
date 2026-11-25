'use client';
/* 工作電腦裡的「網路商店」後台與「本週限定」訂單頁。 */
import { G, stars } from './game';
import { SlimeArt } from './Art';
import { Empty, PriceList, ProdTile } from './Items';

const hue = (s: string) => [...s].reduce((h, c) => (h * 31 + c.charCodeAt(0)) % 360, 11);

export function WebStore() {
  const g = G(), S = g.S, r = g.rating(), slots = g.slots();
  return (
    <div className="rx-web">
      <div className="rx-kpis">
        <div className="rx-kpi"><small>店鋪評分</small><b><span className="stars">{stars(r)}</span> {r.toFixed(1)}</b></div>
        <div className="rx-kpi"><small>粉絲</small><b>{Math.floor(S.fans).toLocaleString()}</b></div>
        <div className="rx-kpi"><small>貨架</small><b>{S.web.length}/{slots}</b><span className="rx-bar"><i style={{ width: `${(S.web.length / Math.max(1, slots)) * 100}%` }} /></span></div>
        <div className="rx-kpi"><small>評價</small><b>{S.reviews.length}</b></div>
      </div>
      <p className="rx-note-line">不直播也會有客人上門（離線最多 30 分鐘）；單價低一點，但會留下評價。</p>

      <h3>架上商品 <small>點一下下架</small></h3>
      <div className="rx-tiles">
        {S.web.length ? S.web.map((p) => <ProdTile key={p.id} p={p} act="unlist" ch="web" />) : <Empty>貨架空空如也，從下方上架商品。</Empty>}
      </div>

      <h3>庫存 <small>點一下上架</small></h3>
      <div className="rx-tiles">
        {S.stock.length ? S.stock.map((p) => <ProdTile key={p.id} p={p} act="list" ch="web" extra={p.played || p.dur < 100 ? '捏過了，不能上架' : undefined} />) : <Empty>背包裡沒有捏捏。</Empty>}
      </div>

      <details className="rx-fold"><summary>網站價目表</summary><PriceList ch="web" /></details>

      <h3>最新評價</h3>
      <div className="rx-reviews">
        {S.reviews.length ? S.reviews.map((v, i) => (
          <div className="rx-review" key={i}>
            <span className="rx-av" style={{ '--h': hue(v.who) } as React.CSSProperties}>{[...v.who][0]}</span>
            <div><b>{v.who}</b> <span className="stars">{'★'.repeat(v.s)}</span><p>{v.t}</p><small>{v.sp}</small></div>
          </div>
        )) : <Empty>還沒有評價。商品賣出後，顧客會在這裡留言。</Empty>}
      </div>
    </div>
  );
}

export function Weekly() {
  const g = G(), S = g.S;
  const left = (g.weekNo() + 1) * g.WEEK_MS - 3 * 864e5 - Date.now(), d = Math.floor(left / 864e5), h = Math.floor((left % 864e5) / 36e5);
  return (
    <div className="rx-weekly">
      <div className="rx-weekly-hd">
        <div><b>本週限定訂單</b><p className="rx-note-line">每週輪替的限時訂單，報酬比平常高很多。每張訂單每週只能完成一次。</p></div>
        <span className="rx-countdown">剩 {d} 天 {h} 小時</span>
      </div>
      {g.weeklyOrders().map((o) => {
        const done = S.wk.done.includes(o.id), ok = g.wkItems(o), sp = g.SP[o.sp], cut = o.cut ? g.CUTS[o.cut] : null;
        return (
          <article key={o.id} className={`rx-order${done ? ' done' : ''}`}>
            <SlimeArt kind="prod" color={sp.color} color2={sp.color2} cut={o.cut || undefined} size={60} />
            <div className="rx-order-body">
              <b>{sp.name}{cut && `（${cut.n}切）`} × {o.n}</b>
              <small>酥脆 ≥ {Math.round(o.min * 100)}%</small>
              <div className="rx-order-prog"><span className="rx-bar"><i style={{ width: `${Math.min(1, ok.length / o.n) * 100}%` }} /></span><small>符合的庫存 {ok.length}/{o.n}</small></div>
            </div>
            <div className="rx-order-pay">
              <b>{g.fmt(o.reward)}</b><small>粉絲 +{o.fans}</small>
              <button type="button" className="btn sm" data-act="wkDeliver" data-id={o.id} disabled={done || ok.length < o.n}>{done ? '本週已完成' : '交貨'}</button>
            </div>
            {done && <span className="rx-stamp">已完成</span>}
          </article>
        );
      })}
    </div>
  );
}
