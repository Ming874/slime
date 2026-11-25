'use client';
/* 工作電腦的網購（電腦的「網購」分頁）：每樣商品一張卡片，有插圖、價格吊牌、等級刻度，買過或滿級會蓋章。
   購買按鈕帶 data-act（buyOwn／buyUp／buyPack），由 game.js 扣錢、加設備。
   大城市的四間店不再用型錄：走進店裡拿起來看、到櫃台結帳（game.js 的 WARE）；保暖衣、長劍只在武器店買得到，所以這裡只列機器、設備、升級與零件包。 */
import { G } from './game';
import { Pips, ShopArt } from './Art';

const INTRO = '下單後，箱子會綁著氣球從大城市飛來，降落在擺放的位置。保暖衣、長劍要到大城市的武器店買。';

// 說明文字裡的 **粗體**
const rich = (t: string) => t.split(/\*\*([^*]+)\*\*/g).map((x, i) => (i % 2 ? <b key={i}>{x}</b> : x));

type CardProps = { k: string; art: React.ReactNode; name: string; desc: React.ReactNode; price: number | null; act: string; label: string; disabled: boolean; stamp?: string; state?: string; extra?: React.ReactNode };
function Card({ k, art, name, desc, price, act, label, disabled, stamp, state, extra }: CardProps) {
  const g = G();
  return (
    <article className={`rx-prod${state ? ' ' + state : ''}`}>
      <div className="rx-prod-pic">{art}</div>
      <div className="rx-prod-body">
        <h4>{name}</h4>
        {extra}
        <p>{desc}</p>
      </div>
      <div className="rx-prod-buy">
        {price != null && <span className="rx-price">{g.fmt(price)}</span>}
        <button type="button" className="btn sm" data-act={act} data-k={k} disabled={disabled}>{label}</button>
      </div>
      {stamp && <span className="rx-stamp">{stamp}</span>}
    </article>
  );
}

export default function Shop() {
  const g = G(), S = g.S;
  const owns = Object.keys(g.OWN).filter((k) => ['mach', 'gear'].includes(g.OWN[k].shop));
  const ups = [...g.SHOP_UPS.mach, ...g.SHOP_UPS.gear, ...g.SHOP_UPS.mall];
  const packs = Object.keys(g.PACKS);
  const buy = '立即購買';

  return (
    <div className="rx-shop rx-eshop">
      <div className="rx-eshop-bar" aria-hidden="true">
        <span className="rx-search">搜尋機器、設備、零件…</span>
        <span className="rx-ship">氣球宅配・關上電腦就降落</span>
      </div>
      <div className="rx-shop-intro">
        <p>{INTRO}</p>
        <span className="rx-wallet">錢包 <b>{g.fmt(S.money)}</b></span>
      </div>

      {owns.length > 0 && (
        <section><h3>設備</h3><div className="rx-prods">
          {owns.map((k) => {
            const o = g.OWN[k], has = !!S.own[k], poor = S.money < o.cost;
            return <Card key={k} k={k} art={<ShopArt k={k} />} name={o.name} desc={rich(o.desc)} price={has ? null : o.cost}
              act="buyOwn" label={has ? '已擁有' : poor ? '錢不夠' : buy} disabled={has || poor} stamp={has ? '已購買' : undefined} state={has ? 'owned' : poor ? 'poor' : ''} />;
          })}
        </div></section>
      )}

      {ups.length > 0 && (
        <section><h3>升級</h3><div className="rx-prods">
          {ups.map((k) => {
            const u = g.UPS[k], lv = S.up[k] || 0, max = lv >= u.max, need = !!u.need && !S.own[u.need], cost = g.upCost(k), poor = S.money < cost;
            const left = k === 'farm' && lv > 0 ? g.farmLeft() : 0;
            return <Card key={k} k={k} art={<ShopArt k={k} />} name={u.name}
              extra={<div className="rx-lv"><Pips lv={lv} max={u.max} /><small>Lv {lv}/{u.max}</small></div>}
              desc={<>{need ? `需要先購買${g.OWN[u.need!].name}` : u.desc}{k === 'farm' && lv > 0 && <span className="rx-dim">　下次收集 {g.fmtSec(left)}</span>}</>}
              price={max ? null : cost} act="buyUp" label={max ? '已滿級' : need ? '尚未解鎖' : poor ? '錢不夠' : '升級'}
              disabled={max || need || poor} stamp={max ? '滿級' : undefined} state={max ? 'owned' : need ? 'locked' : poor ? 'poor' : ''} />;
          })}
        </div></section>
      )}

      {packs.length > 0 && (
        <section><h3>裝飾零件包</h3><div className="rx-prods">
          {packs.map((k) => {
            const pk = g.PACKS[k], has = S.packs.includes(k), poor = S.money < pk.cost, items = Object.values(g.DECO).filter((d) => d.pack === k);
            return <Card key={k} k={k} art={<ShopArt k={k} packColors={items.map((d) => d.c)} />} name={pk.name}
              desc={<span className="rx-decos">{items.map((d) => <span key={d.n}><i className="rx-dot" style={{ background: d.c }} />{d.n}</span>)}<small>每個零件讓售價 {g.packPct(k)}</small></span>}
              price={has ? null : pk.cost} act="buyPack" label={has ? '已擁有' : poor ? '錢不夠' : buy} disabled={has || poor}
              stamp={has ? '已購買' : undefined} state={has ? 'owned' : poor ? 'poor' : ''} />;
          })}
        </div></section>
      )}
    </div>
  );
}
