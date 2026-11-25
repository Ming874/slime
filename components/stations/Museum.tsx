'use client';
/* 展示場：四座展台，作品在聚光燈下輕輕浮動，底下有黃銅名牌；參觀朋友：房間裡其他玩家的展示場。 */
import { G, pct, prodName } from './game';
import { SlimeArt } from './Art';
import { Empty, GradeStamp, ProdTile } from './Items';

export function Museum() {
  const g = G(), S = g.S, fpm = S.show.reduce((a, p) => a + g.effCrisp(p), 0) * 0.004 * 60;
  return (
    <div className="rx-museum">
      <p className="rx-note-line">
        把得意的作品放上展示台，展示中的作品會持續吸引參觀者（目前每分鐘約 <b>+{fpm.toFixed(1)}</b> 粉絲）
        {g.NET.on ? '，房間裡的朋友也能來「參觀朋友」分頁按讚。' : '。多人連線時，朋友可以來參觀並按讚。'}
      </p>
      <div className="rx-pedestals">
        {[0, 1, 2, 3].map((i) => {
          const p = S.show[i];
          if (!p) return <div key={i} className="rx-exhibit empty"><span className="rx-stand" /><span className="rx-plaque">展台 {i + 1}・空著</span></div>;
          const sp = g.SP[p.sp], cut = p.cut ? g.CUTS[p.cut] : null;
          return (
            <button key={p.id} type="button" className="rx-exhibit" data-act="unshow" data-id={p.id} title="點一下收回">
              <span className="rx-spot" />
              <span className="rx-float"><SlimeArt kind="prod" color={sp.color} color2={sp.color2} cut={p.cut} size={74} /></span>
              <span className="rx-stand" />
              <span className="rx-plaque"><b>{prodName(g, p)}{cut ? `・${cut.n}` : ''}</b><small>酥脆 {pct(g.effCrisp(p))}{p.deco.length ? `・裝飾 ${p.deco.length}` : ''}</small><small>估價 {g.fmt(g.priceOf(p, 'live'))}</small></span>
              <GradeStamp p={p} />
            </button>
          );
        })}
      </div>
      <h3>從背包放上展示台 <small>{S.show.length}/4</small></h3>
      <div className="rx-tiles">
        {S.stock.length ? S.stock.map((p) => <ProdTile key={p.id} p={p} act="show" />) : <Empty>背包裡沒有捏捏。</Empty>}
      </div>
    </div>
  );
}

export function Visit() {
  const g = G(), now = Date.now(), likeT = g.likeT();
  const others = [...g.NET.players.entries()].filter(([id]) => id !== g.NET.me);
  if (!others.length) return <Empty>房間裡還沒有其他玩家。</Empty>;
  return (
    <div className="rx-visit">
      {others.map(([id, p]) => {
        const show = p.show || [], canLike = show.length > 0 && now - (likeT[id] || 0) > 60000;
        return (
          <article className="rx-friend" key={id}>
            <b><i className="rx-dot" style={{ background: p.color }} />{p.name} 的展示場</b>
            <div className="rx-friend-show">
              {show.length ? show.map((x, i) => {
                const sp = g.SP[x.sp];
                return <span key={i} className="rx-mini"><SlimeArt kind="prod" color={sp.color} color2={sp.color2} cut={x.cut} size={40} /><small>{g.short(x.sp)}{x.cut ? `・${g.CUTS[x.cut].n}` : ''}<br />酥脆 {x.cr}%</small></span>;
              }) : <span className="rx-dim">還沒有擺出作品</span>}
            </div>
            <button type="button" className="btn sm" data-act="like" data-id={id} disabled={!canLike}>按讚（對方粉絲 +2）</button>
          </article>
        );
      })}
    </div>
  );
}
