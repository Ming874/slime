'use client';
/* 大城市商店（型錄）與網購（工作電腦）：每樣商品一張卡片，有插圖、價格吊牌、等級刻度，
   買過或滿級會蓋章。購買按鈕帶 data-act（buyOwn／buyUp／buyPack），由 game.js 扣錢、加設備。 */
import { G } from './game';
import { Pips, ShopArt } from './Art';

const INTRO: Record<string, string> = {
  mach: '加工機器與機器升級。買了才會出現在基地的產線上，每台機器對應一道加工流程。',
  gear: '直播設備、裝飾桌與裝飾零件。',
  mall: '倉儲、網站伺服器與生活用品。',
  arms: '武器與防具。保暖衣是進入雪原的必備品；長劍目前只供收藏，之後會派上用場。',
  eshop: '加工機器、裝飾桌、直播設備與各種升級，下單後直接宅配到中央平地。武器店的商品要到大城市購買。',
};

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
  const g = G(), S = g.S, kind = INTRO[g.tab] ? g.tab : 'mall', eshop = kind === 'eshop';
  const owns = Object.keys(g.OWN).filter((k) => (eshop ? ['mach', 'gear'].includes(g.OWN[k].shop) : g.OWN[k].shop === kind));
  const ups = eshop ? [...g.SHOP_UPS.mach, ...g.SHOP_UPS.gear, ...g.SHOP_UPS.mall] : g.SHOP_UPS[kind] || [];
  const packs = kind === 'gear' || eshop ? Object.keys(g.PACKS) : [];
  const buy = eshop ? '立即購買' : '購買';

  return (
    <div className={`rx-shop${eshop ? ' rx-eshop' : ''}`} data-kind={kind}>
      {eshop && (
        <div className="rx-eshop-bar" aria-hidden="true">
          <span className="rx-search">搜尋機器、設備、零件…</span>
          <span className="rx-ship">全館免運・中央平地當天到貨</span>
        </div>
      )}
      <div className="rx-shop-intro">
        <p>{INTRO[kind]}</p>
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
              desc={<span className="rx-decos">{items.map((d) => <span key={d.n}><i className="rx-dot" style={{ background: d.c }} />{d.n}</span>)}</span>}
              price={has ? null : pk.cost} act="buyPack" label={has ? '已擁有' : poor ? '錢不夠' : buy} disabled={has || poor}
              stamp={has ? '已購買' : undefined} state={has ? 'owned' : poor ? 'poor' : ''} />;
          })}
        </div></section>
      )}
    </div>
  );
}
