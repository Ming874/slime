'use client';
/* 事業（工作電腦）：選擇事業道路，或管理自家工廠／企業合作訂單／溫馨小店的顧客。
   選道路不跳確認彈窗（5.3）：按「選擇這條路」，那張卡翻成一張合約（g.brPick），勾「想好了」再蓋章才算數（game.js 的 cfStamp → branchCommit）。
   工廠的 3D 畫布 #facWrap 由 game.js 切換顯示；倒數計時（data-dl、data-dlbar）由 game.js 每秒更新。 */
import { G, type Product } from './game';
import { SlimeArt } from './Art';
import { Empty } from './Items';
import { Stamp, Tick } from './NotePages';

type Contract = { id: number; sp: string; cut: string | null; n: number; min: number; reward: number; dl: number };
type Customer = { id: number; name: string; sp: string; min: number; dl: number };
type BranchState = { branch: string | null; workers: number; auto: number; rep: number; contracts: Contract[]; customers: Customer[]; regulars: Record<string, number> };
type BranchGame = {
  BRANCHES: Record<string, { name: string; desc: string }>; branchReady: () => boolean;
  contractItems: (c: Contract) => Product[]; shopItem: (c: Customer) => Product | undefined; shopPrice: (c: Customer, p: Product) => number;
};

const ICON: Record<string, string> = { factory: '🏭', corp: '🏢', shop: '🏡' };
const hue = (s: string) => [...s].reduce((h, c) => (h * 31 + c.charCodeAt(0)) % 360, 3);

export default function Branch() {
  const g = G(), S = g.S as typeof g.S & BranchState, x = g as unknown as BranchGame;
  if (!S.branch) {
    const ready = x.branchReady(), pick = ready ? g.brPick || '' : '';
    return (
      <div className="rx-branch">
        <div className="rx-branch-hd"><b>選擇你的事業道路</b><small>一旦選擇就無法更改，玩法和收入方式都不一樣。</small></div>
        <div className="rx-paths">
          {Object.entries(x.BRANCHES).map(([k, b]) => pick === k ? (
            <article key={k} className={`rx-path p-${k} rx-contract`} aria-label={`${b.name}的合約`}>
              <b className="rx-ct-hd">事業合約</b>
              <p>我決定走「<b>{b.name}</b>」這條路。</p>
              <small className="rx-ct-desc">{b.desc}</small>
              <Tick>想好了，選了就不能改</Tick>
              <div className="cf-acts"><button type="button" className="nb-btn cf-back" data-act="brBack" disabled={!!g.cf?.done}>再想想</button><Stamp k="branch" label="蓋章簽約" mark="簽約" need /></div>
            </article>
          ) : (
            <article key={k} className={`rx-path p-${k}${pick ? ' dim' : ''}`}>
              <span className="rx-path-ic" aria-hidden="true">{ICON[k]}</span>
              <b>{b.name}</b>
              <p>{b.desc}</p>
              <button type="button" className="btn" data-act="chooseBranch" data-k={k} disabled={!ready || !!g.cf?.done}>選擇這條路</button>
            </article>
          ))}
        </div>
        {!ready && <p className="rx-note-line">需要累積營收 <b>¥2,500</b> 且粉絲 <b>60</b> 才能做出選擇（目前 {g.fmt(S.earned)}、粉絲 {Math.floor(S.fans)}）。</p>}
      </div>
    );
  }
  if (S.branch === 'factory') return <Factory />;
  if (S.branch === 'corp') return <Corp />;
  return <Shop />;
}

function Factory() {
  const g = G(), S = g.S as typeof g.S & BranchState;
  const hc = Math.round(400 * Math.pow(1.5, S.workers)), ac = Math.round(600 * Math.pow(1.8, S.auto)), gel = Object.values(S.gel).reduce((a, b) => a + b, 0);
  return (
    <div className="rx-branch">
      <div className="rx-branch-hd"><b>🏭 自家工廠</b><small>每位員工操作一台機械手臂，每 12 秒用 2 份凝膠做 1 個捏捏（品質看自動化等級），員工每分鐘領薪 ¥3。凝膠不足或庫存滿時停工。</small></div>
      <div className="rx-kpis">
        <div className="rx-kpi"><small>機械手臂／員工</small><b>{S.workers}<span className="rx-dim"> / 12</span></b></div>
        <div className="rx-kpi"><small>薪資</small><b>{g.fmt(S.workers * 3)}<span className="rx-dim">/分</span></b></div>
        <div className="rx-kpi"><small>自動化</small><b>Lv {S.auto}<span className="rx-dim"> · 品質 {Math.round((0.55 + 0.05 * S.auto) * 100)}%</span></b></div>
        <div className="rx-kpi"><small>原料／庫存</small><b>{gel}<span className="rx-dim"> 份 · {S.stock.length}/{g.cap()}</span></b></div>
      </div>
      <div className="rx-branch-acts">
        <button type="button" className="btn" data-act="hire" disabled={S.money < hc || S.workers >= 12}>增設手臂並雇用 {g.fmt(hc)}</button>
        <button type="button" className="btn ghost" data-act="auto" disabled={S.money < ac || S.auto >= 8}>升級自動化 {g.fmt(ac)}</button>
      </div>
      {gel < 2 && S.workers > 0 && <p className="rx-warn-line">凝膠不足，工廠停工中：去採集史萊姆或升級養殖槽。</p>}
    </div>
  );
}

function Corp() {
  const g = G(), S = g.S as typeof g.S & BranchState, x = g as unknown as BranchGame;
  return (
    <div className="rx-branch">
      <div className="rx-branch-hd"><b>🏢 企業合作</b><small>大公司定期釋出訂單，報酬約為行情價 ×1.5，但要在期限內交付夠酥脆的商品。逾期會損失信譽。</small></div>
      <div className="rx-kpis">
        <div className="rx-kpi"><small>企業信譽</small><b>{S.rep}</b></div>
        <div className="rx-kpi"><small>承接中</small><b>{S.contracts.length}<span className="rx-dim"> / 3</span></b></div>
      </div>
      {S.contracts.length ? S.contracts.map((c) => {
        const ok = x.contractItems(c), sp = c.sp === 'any' ? null : g.SP[c.sp], cut = c.cut ? g.CUTS[c.cut] : null;
        return (
          <article key={c.id} className="rx-order">
            <SlimeArt kind="prod" color={sp?.color || '#94a3b8'} color2={sp?.color2} cut={c.cut || undefined} size={56} />
            <div className="rx-order-body">
              <b>{sp ? sp.name : '任意種類'}{cut && `（${cut.n}切）`} × {c.n}</b>
              <small>酥脆 ≥ {Math.round(c.min * 100)}%・剩餘 <b data-dl={c.dl} /></small>
              <div className="rx-order-prog"><span className="rx-bar"><i style={{ width: `${Math.min(1, ok.length / c.n) * 100}%` }} /></span><small>符合的庫存 {ok.length}/{c.n}</small></div>
            </div>
            <div className="rx-order-pay">
              <b>{g.fmt(c.reward)}</b><small>企業訂單</small>
              <button type="button" className="btn sm" data-act="deliver" data-id={c.id} disabled={ok.length < c.n}>交貨</button>
            </div>
          </article>
        );
      }) : <Empty>目前沒有訂單，請稍候…</Empty>}
    </div>
  );
}

function Shop() {
  const g = G(), S = g.S as typeof g.S & BranchState, x = g as unknown as BranchGame, regs = Object.values(S.regulars).filter((v) => v >= 5).length;
  return (
    <div className="rx-branch">
      <div className="rx-branch-hd"><b>🏡 溫馨小店</b><small>顧客會上門指定想要的種類。滿足熟客可以累積好感，熟客出價更高還會給小費；等太久會失望離開。</small></div>
      <div className="rx-kpis">
        <div className="rx-kpi"><small>熟客（好感 ≥ 5）</small><b>{regs}</b></div>
        <div className="rx-kpi"><small>店裡的客人</small><b>{S.customers.length}</b></div>
      </div>
      {S.customers.length ? S.customers.map((c) => {
        const ok = x.shopItem(c), aff = S.regulars[c.name] || 0, sp = g.SP[c.sp];
        return (
          <article key={c.id} className="rx-customer">
            <span className="rx-avatar" style={{ background: `hsl(${hue(c.name)} 65% 68%)` }}>{[...c.name][0]}</span>
            <div className="rx-customer-body">
              <div className="rx-customer-hd"><b>{c.name}</b>{aff >= 5 && <span className="tag">熟客</span>}<span className="rx-hearts" aria-label={`好感 ${aff}`}>{Array.from({ length: 5 }, (_, i) => <i key={i} className={i < Math.min(5, aff) ? 'on' : ''} />)}</span></div>
              <div className="rx-want"><SlimeArt kind="prod" color={sp.color} color2={sp.color2} size={30} /><span>想要 <b>{sp.name}</b>・酥脆 ≥ {Math.round(c.min * 100)}%</span></div>
              <div className="meter2 rx-patience"><i data-dlbar={c.dl} /></div>
            </div>
            <button type="button" className="btn sm" data-act="serve" data-id={c.id} disabled={!ok}>{ok ? `出貨 ${g.fmt(x.shopPrice(c, ok))}` : '沒有符合的商品'}</button>
          </article>
        );
      }) : <Empty>店裡暫時沒有客人…</Empty>}
    </div>
  );
}
