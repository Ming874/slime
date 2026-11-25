'use client';
/* 背包（手帳的右頁）：縫線口袋裡的凝膠與捏捏、貼著紙膠帶的說明便條、裝備清單、夾著迴紋針的探索日誌。
   點格子＝data-act="hb"（game.js 把它放到快捷列並重繪）。 */
import type { CSSProperties } from 'react';
import { createPortal } from 'react-dom';
import { G, pct, prodName, type InvItem } from './game';
import { SlimeArt } from './Art';
import { PaperView } from './Paper';
import { GradeStamp } from './Items';

export default function Inventory() {
  const g = G(), S = g.S, items = g.invItems(), n = Math.max(27, Math.ceil(items.length / 9) * 9);
  const sel = g.invSel ?? S.hb;
  return (
    <div className="rx-inv">
      <div className="rx-inv-main">
        <div className="rx-satchel" aria-label="背包">
          {Array.from({ length: n }, (_, i) => <Slot key={i} it={items[i]} i={i} sel={i === sel} hb={i === S.hb} />)}
        </div>
        <div className="rx-satchel-foot">庫存 {S.stock.length}/{g.cap()} · 凝膠 {Object.values(S.gel).reduce((a, b) => a + b, 0)} 份</div>
      </div>
      <div className="rx-inv-side">
        <Detail it={items[sel]} hb={S.hb} />
        <Equip />
      </div>
      <Today />
      <Quest />
      <Eggs />
      <Sketches />
      <Clips />
    </div>
  );
}

// 今天（5.4）：玩家沒在做事時發生的事不再跳字，記在手帳的這一頁——今天的流行色、網站賣了幾件、小店的客人、企業訂單、養殖槽。
// 手寫字、橫線紙；同一類的小事 15 分鐘內併成一行（game.js 的 note），新的在上面，最多列 12 行
function Today() {
  const g = G(), td = g.today?.(), out = g.outbox?.() ?? 0;
  if (!td) return null;
  const sp = g.trend.sp ? g.SP[g.trend.sp] : null, rows = td.log.filter((r) => r.k !== 'trend').slice(-12).reverse();
  const hm = (t: number) => { const d = new Date(t); return `${d.getHours()}:${String(d.getMinutes()).padStart(2, '0')}`; };
  const day = new Date(), wk = '日一二三四五六'[day.getDay()];
  return (
    <div className="rx-today">
      <div className="rx-today-hd"><b>今天</b><span>{day.getMonth() + 1} 月 {day.getDate()} 日（{wk}）</span></div>
      <p className="rx-today-sum">
        {sp && <span className="rx-today-flag"><i style={{ background: sp.color2 ? `linear-gradient(135deg,${sp.color},${sp.color2})` : sp.color }} />流行色：{sp.name}（售價 ×1.35・屋頂的旗子）</span>}
        <span>網站賣出 {td.web} 件{td.inc > 0 ? `，+${g.fmt(td.inc)}` : ''}{out > 0 ? `　出貨箱裡還有 ${out} 個包裹` : ''}</span>
      </p>
      {rows.length ? (
        <ul>{rows.map((r) => <li key={r.t + r.k}><em>{hm(r.t)}</em><i className={`k-${r.k.replace(/Away|Left|Late/, '')}`} aria-hidden="true" /><span>{r.m}</span></li>)}</ul>
      ) : <p className="rx-today-none">今天還很安靜。把捏捏擺上網站貨架，賣出去的會記在這裡。</p>}
    </div>
  );
}

function Slot({ it, i, sel, hb }: { it?: InvItem; i: number; sel: boolean; hb: boolean }) {
  const g = G();
  const sp = it ? g.SP[it.t === 'gel' ? it.sp : it.p.sp] : null;
  const title = it && sp ? (it.t === 'gel' ? `${sp.name}凝膠 × ${it.n}` : `${sp.name}捏捏`) : `空格 ${i + 1}`;
  return (
    <button type="button" className={`rx-slot${sel ? ' sel' : ''}${hb ? ' hb' : ''}${it ? '' : ' empty'}`} data-act="hb" data-i={i} title={title} aria-label={title}>
      {i < 9 && <span className="rx-k">{i + 1}</span>}
      {it && sp && <SlimeArt kind={it.t === 'gel' ? 'gel' : 'prod'} color={sp.color} color2={sp.color2} cut={it.t === 'prod' ? it.p.cut : undefined} />}
      {it?.t === 'gel' && <span className="rx-n">{it.n}</span>}
      {it?.t === 'prod' && !it.p.crude && <span className={`rx-sgr g${g.gradeOf(it.p).g}`}>{g.gradeOf(it.p).g}</span>}
      {it?.t === 'prod' && <span className="rx-dur"><i style={{ width: `${it.p.dur}%`, background: it.p.dur > 50 ? '#34d399' : it.p.dur > 20 ? '#fbbf24' : '#fb7185' }} /></span>}
    </button>
  );
}

function Meter({ label, v, color }: { label: string; v: number; color: string }) {
  return (
    <div className="rx-meter"><span>{label}</span><span className="rx-bar"><i style={{ width: `${Math.round(v * 100)}%`, background: color }} /></span><b>{pct(v)}</b></div>
  );
}

function Detail({ it, hb }: { it?: InvItem; hb: number }) {
  const g = G(), S = g.S;
  if (!it) {
    return (
      <div className="rx-detail">
        <b className="rx-detail-ttl">背包</b>
        <p>凝膠與捏捏都會收在這裡。點一下格子看看內容，也會把它放到快捷列。</p>
        <p className="rx-dim">庫存 {S.stock.length}/{g.cap()}</p>
      </div>
    );
  }
  if (it.t === 'gel') {
    const sp = g.SP[it.sp];
    return (
      <div className="rx-detail">
        <div className="rx-detail-hd"><SlimeArt kind="gel" color={sp.color} color2={sp.color2} size={64} /><div><b className="rx-detail-ttl">{sp.name}凝膠</b><span className="rx-dim">× {it.n} 份</span></div></div>
        <p>帶到工坊的加工產線，每 2 份可做成 1 個酥脆捏捏；手作台也能捏出粗製捏捏。</p>
        <p className="rx-dim">點擊格子可放到快捷列第 {hb + 1} 格選取。</p>
      </div>
    );
  }
  const p = it.p, sp = g.SP[p.sp], cut = p.cut ? g.CUTS[p.cut] : null;
  return (
    <div className="rx-detail">
      <div className="rx-detail-hd">
        <SlimeArt kind="prod" color={sp.color} color2={sp.color2} cut={p.cut} size={64} />
        <div><b className="rx-detail-ttl">{prodName(g, p)}捏捏</b><span className="rx-dim">{cut ? `${cut.n}切 · ` : ''}{p.deco.length ? `裝飾 ${p.deco.length} 個` : '無裝飾'}</span></div>
      </div>
      <Meter label="酥脆" v={g.effCrisp(p)} color="#f59e0b" />
      <Meter label="耐久" v={p.dur / 100} color={p.dur > 50 ? '#34d399' : p.dur > 20 ? '#fbbf24' : '#fb7185'} />
      <p className="rx-detail-pr"><GradeStamp p={p} big /><span><span>直播 <b>{g.fmt(g.priceOf(p, 'live'))}</b>{p.played || p.dur < 100 ? '・捏過了，網站不收' : <>・網站 <b>{g.fmt(g.priceOf(p, 'web'))}</b></>}</span><small>{g.priceWhy(p, 'live')}{p.dur < 100 && !p.crude ? `（等級看做好時的酥脆 ${pct(p.crisp)}）` : ''}</small></span></p>
      <p>可到裝飾桌加上零件（售價再提高），或到直播台／工作電腦販售。拿在手上{g.TOUCH ? '長按手掌' : '按住 E '}可以捏一捏：捏過會變軟（耐久掉了賣得比較慢），也不能上架網站了；等級章看做好時的酥脆，不會變。</p>
      <p className="rx-dim">點擊格子可放到快捷列第 {hb + 1} 格選取。</p>
    </div>
  );
}

function Equip() {
  const g = G(), S = g.S, ship = g.ship ?? [];
  const row = (has: boolean, name: string, note: string) => (
    <li className={has ? 'on' : ''}><i className="rx-check" aria-hidden="true" /><span>{name}</span><small>{has ? '已擁有' : note}</small></li>
  );
  return (
    <div className="rx-equip">
      <b>裝備</b>
      <ul>
        {row(!!S.own.coat, '保暖衣', '大城市武器店')}
        {row(!!S.own.sword, '長劍', '大城市武器店')}
      </ul>
      {ship.length > 0 && (
        <>
          <b className="rx-ship-hd">宅配中</b>
          <ul className="rx-ship-list">
            {ship.map((e) => <li key={e.k}><span>{g.OWN[e.k]?.name}</span><small>{e.via === 'web' ? '關上電腦就降落' : '回到中央平地就降落'}</small></li>)}
          </ul>
        </>
      )}
    </div>
  );
}

// 月光谷的小秘密（彩蛋，登記與發現在 game.js 的 regEgg／foundEgg）：找到的寫名字，還沒找到的只給一句提示
const EGG_ZONE: Record<string, string> = { home: '工坊', forest: '中央平地', coast: '海岸', volcano: '火山', snow: '雪原', cave: '山洞', city: '大城市' };
function Eggs() {
  const list = G().eggs?.() ?? [];
  if (!list.length) return null;
  const n = list.filter((e) => e.found).length;
  return (
    <div className="rx-eggs">
      <div className="rx-eggs-hd"><b>月光谷的小秘密</b><span>已找到 {n} / {list.length}</span></div>
      <ul>
        {list.map((e) => (
          <li key={e.id} className={e.found ? 'on' : ''}>
            <i className="rx-egg-ic" aria-hidden="true">{e.found ? '✦' : '?'}</i>
            <span className="rx-egg-tx">
              <b>{e.found ? e.name : '？？？'}</b>
              {!e.found && e.hint && <small>{e.hint}</small>}
            </span>
            <em>{EGG_ZONE[e.id.split('_')[0]] ?? ''}</em>
          </li>
        ))}
      </ul>
    </div>
  );
}

// 收到的信與明信片（手上的紙收起來的地方）：迷你的紙交錯旋轉、貼一條紙膠帶，新的貼紅色「新」；點一下就在手帳中央抽出來重讀，再點一下或按 E 放回
const CLIP_R = (id: string) => { let h = 0; for (const c of id) h = (h * 31 + c.charCodeAt(0)) % 997; return (h % 9) - 4; };
function Clips() {
  // 只有手帳開著時才把重讀的紙畫進 #gwin：#gwin 是所有介面共用的框，換成別的介面時不能留著；旅行速寫另外一區（Sketches），抽出來看也走這裡
  const g = G(), list = (g.papers?.() ?? []).filter((c) => c.v !== 'sketch'), ci = g.kind === 'inv' ? g.clip?.() ?? -1 : -1, cur = ci >= 0 ? g.paperAt?.(ci) : null;
  const host = typeof document !== 'undefined' ? document.getElementById('gwin') : null;
  const view = cur && host ? createPortal(
    <div className="rx-clipview" data-act="clipClose" role="dialog" aria-label={`重讀：${cur.name}`} data-v={cur.v}>
      <div className="rx-clipview-in"><PaperView p={cur} /></div>
      <small className="rx-clipview-tip">{cur.touch ? '點一下放回' : '點一下或按 E 放回'}</small>
    </div>, host) : null;
  if (!list.length) return view;
  return (
    <div className="rx-clips">
      <div className="rx-clips-hd"><b>收到的信與明信片</b><span>{list.length} 張</span></div>
      <div className="rx-clip-row">
        {list.map((c) => (
          <button key={c.i} type="button" className={`rx-clip v-${c.v}${c.gift ? ' gift' : ''}${c.torn ? ' torn' : ''}${c.gn ? ' gn' : ''}${c.isNew ? ' new' : ''}`} data-act="clipOpen" data-k={c.i} style={{ '--r': `${CLIP_R(c.id + c.t)}deg` } as CSSProperties} aria-label={`重讀：${c.name}`}>
            <span className="rx-clip-p" aria-hidden="true">{c.v === 'postcard' && g.postcardImg ? <img src={g.postcardImg(c.zone)} alt="" draggable={false} /> : <i />}</span>
            <small>{c.name.split('：').map((t, i, a) => <span key={i}>{t}{i < a.length - 1 ? '：' : ''}</span>)}</small>{/* 「奶奶的筆記：發光的苔蘚」：冒號前後各自一段、整段換行，不會斷成「發／光的苔蘚」 */}
            {c.isNew && <em>新</em>}
          </button>
        ))}
      </div>
      {view}
    </div>
  );
}

// 旅行速寫（第一次到一區時，換區的地名字卡收進手帳的那一頁，game.js 的 zcShow）：速寫本的一頁一頁，照第一次去的順序；點一下在手帳中央抽出來看（和剪貼區共用 clipOpen）
function Sketches() {
  const g = G(), list = (g.papers?.() ?? []).filter((c) => c.v === 'sketch').reverse();
  if (!list.length) return null;
  return (
    <div className="rx-sketches">
      <div className="rx-clips-hd"><b>旅行速寫</b><span>{list.length} / {Object.keys(g.ZSK ?? {}).length || 5} 頁</span></div>
      <div className="rx-clip-row">
        {list.map((c) => {
          const nm = g.ZSK?.[c.zone]?.name ?? c.name;
          return (
            <button key={c.i} type="button" className={`rx-clip v-sketch${c.isNew ? ' new' : ''}`} data-act="clipOpen" data-k={c.i} style={{ '--r': `${CLIP_R(c.id + c.t) * .6}deg` } as CSSProperties} aria-label={`看看速寫：${nm}`}>
              <span className="rx-clip-p" aria-hidden="true" dangerouslySetInnerHTML={{ __html: g.skSvg?.(c.zone) ?? '' }} />
              <small>{nm}</small>
              {c.isNew && <em>新</em>}
            </button>
          );
        })}
      </div>
    </div>
  );
}

// 探索日誌：下一個要解開的區域與線索（內容規則在 game.js 的 QUEST）
function Quest() {
  const g = G(), k = g.nextQuest(), q = g.qState();
  if (!k) return <div className="rx-quest"><b>探索日誌</b><p>你已經發現了月光谷的所有區域。</p></div>;
  const Q = g.QUEST[k], ready = g.questReady(k), made = g.madeIn(Q.from), from = g.ZONES.find((z) => z.id === Q.from)?.name;
  return (
    <div className="rx-quest">
      <b>探索日誌：{Q.title}</b>
      <p dangerouslySetInnerHTML={{ __html: Q.hint }} />
      {!ready && <p className="rx-dim">線索目前被封印：先用{from}的史萊姆做出 {Q.need} 個捏捏，目前 {made}/{Q.need}。</p>}
      {k === 'coast' && (
        <>
          <div className="qprog">{[0, 1, 2, 3, 4].map((i) => <i key={i} className={q.frags.includes(i) ? 'on' : ''} />)}</div>
          <p className="rx-dim">古地圖碎片 {q.frags.length}/5</p>
        </>
      )}
      {k === 'volcano' && ready && (
        <>
          <p className="rx-dim">紙條 {q.notes.length}/3　已點亮 {q.tide.length}/4</p>
          <div dangerouslySetInnerHTML={{ __html: g.tideStepsHTML() + g.hintBlock('tide') }} />
        </>
      )}
      {k === 'snow' && ready && q.read.tablet && (
        <>
          <div className="riddle rx-verse-sm" dangerouslySetInnerHTML={{ __html: g.TABLET_TXT }} />
          <p className="rx-dim">已滿足 {g.cluesDone()}/4 條線索</p>
          <div dangerouslySetInnerHTML={{ __html: g.pillarExtra() + g.hintBlock('pillar') }} />
        </>
      )}
    </div>
  );
}
