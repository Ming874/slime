'use client';
/* 筆記本的「地圖」頁（設計分析 9.2）：月光谷的手繪地圖，Esc 筆記本的第二頁（M 直接翻到這裡）。
   淡彩、等高線、小徑、山洞畫在 canvas（public/game/map.js 的 nmDraw）；貼紙、地名、鉛筆圈是疊在上面的 DOM，字用手寫字型。右邊（窄螢幕在下面）是圖例與「走過幾成」。
   排版照地圖實際的寬度算（layout）：手機上地圖只有三百多 px，字有最小字級，相對大很多，固定的位置會疊在一起，所以——
   - 貼紙的名字寫在預設的那一邊，會碰到別的貼紙、鉛筆圈或地圖邊緣就換一邊；
   - 地名（map.js 的 NM_REGIONS）每區有幾個位置，照順序挑第一個不碰到貼紙、名字、星星、「往大城市」、標題與別的地名的，全部都碰到就不寫（字不被擋、不被裁）；
   - 鉛筆圈（朝向的小箭頭畫在圈裡）蓋到地標貼紙時（例如剛出生在工坊門口）改成圈住那張貼紙，箭頭貼在圈外，名字往外讓開。
   小秘密的星星沒有字：滑過或點一下才在旁邊寫出名字（手機也點得到）。翻到這一頁（NMAP.seq 換號）時鉛筆圈重畫一次，窄螢幕把自己的位置捲進畫面。 */
import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { G, type MapView } from './game';

// 地標貼紙的小圖（24×24，一面一個顏色）：工坊、森林巨樹、燈塔、火山口、冰晶塔
const ART: Record<string, ReactNode> = {
  home: <><path d="M6 11h12v9H6z" fill="#fde7c3" /><path d="M3 12l9-8 9 8z" fill="#e2674f" /><path d="M10.5 14.5h3V20h-3z" fill="#8b5e3c" /><path d="M15 6.5h2v3.2l-2-1.7z" fill="#a8483a" /></>,
  tree: <><path d="M11 13h2.2v7.5H11z" fill="#8b5e3c" /><circle cx="12" cy="10" r="7" fill="#4fae6c" /><circle cx="9.6" cy="7.8" r="2.6" fill="#7fd296" /></>,
  light: <><path d="M6.5 20h11v1.6h-11z" fill="#8a7b6e" /><path d="M9 20l1.2-12h3.6L15 20z" fill="#fff" /><path d="M9.6 14.5h4.8l.35 3H9.25zM10.05 10.2h3.9l.2 2.2h-4.3z" fill="#d8493c" /><path d="M9.8 5h4.4v3H9.8z" fill="#fde047" /><path d="M9 5l3-2.6L15 5z" fill="#c2453a" /></>,
  crater: <><circle cx="9" cy="4.5" r="2" fill="#d9d4cf" /><circle cx="12.5" cy="3.4" r="1.6" fill="#e7e3df" /><path d="M2.5 20.5L9 8.5h6l6.5 12z" fill="#8a6a5c" /><path d="M9 8.5h6l-1 2h-4z" fill="#f97316" /><path d="M11 10.5h2l-.4 5h-1.2z" fill="#fb923c" /></>,
  ice: <><path d="M12 2.5l3 6.5-.8 11.5H9.8L9 9z" fill="#c8ecfd" /><path d="M12 2.5l3 6.5-.8 11.5H12z" fill="#9fd6f3" /><path d="M5 9.5l2.6 2.4.4 8.6H5.6L4.4 12z" fill="#b5e1f7" /><path d="M19 8l.9 4-1.3 8.5h-2.2l.3-9.4z" fill="#a7dbf5" /></>,
};
const STAR = 'M10 1.6l2.6 5.3 5.8.8-4.2 4.1 1 5.8L10 14.9l-5.2 2.7 1-5.8L1.6 7.7l5.8-.8z';
// 星星的顏色：各區的主色，但比地上的淡彩深、彩度高（淡藍的雪地上用薰衣草紫、沙灘與小湖上用深一點的海藍，綠地上用深綠），白邊之外也一眼看得到
const ZC: Record<string, string> = { forest: '#3f9f58', plain: '#3f9f58', coast: '#2b7fd4', volcano: '#e8743b', snow: '#7c6fe6' };
// 每張貼紙固定歪一點（同一張每次都一樣）
const tilt = (id: string, a = 9) => { let h = 0; for (const c of id) h = (h * 31 + c.charCodeAt(0)) | 0; return ((h % 1000) / 1000) * a; };
const cl = (a: number, v: number, b: number) => Math.min(b, Math.max(a, v));

// 大小（px）都跟著地圖寬度 W：排版要先知道東西多大才排得開，所以在這裡算，再用 CSS 變數交給 app/menus.css（.nm-map）
function sizes(W: number) {
  return {
    st: cl(24, W * 0.054, 38), // 地標貼紙的直徑
    fn: cl(12, W * 0.025, 17), // 貼紙的名字、「往大城市」
    fl: cl(15, W * 0.034, 24), // 地名
    fe: cl(14, W * 0.03, 21), // 小秘密的星星
    me: cl(10.5, W * 0.0215, 15), // 鉛筆圈的半徑
    ft: cl(18, W * 0.046, 32), // 標題「月光谷」
    fN: cl(12, W * 0.024, 17), // 「北」
    ga: cl(18, W * 0.038, 26), // 往大城市的箭頭寬（高是 2.2 倍）
  };
}
type Box = { l: number; t: number; r: number; b: number };
const hit = (a: Box, b: Box, pad = 2) => a.l < b.r + pad && b.l < a.r + pad && a.t < b.b + pad && b.t < a.b + pad;
const around = (x: number, y: number, w: number, h: number): Box => ({ l: x - w / 2, t: y - h / 2, r: x + w / 2, b: y + h / 2 });
type Side = 'r' | 'l' | 'b' | 't';
const SIDES: Side[] = ['r', 'l', 'b', 't'];

// 排版：所有位置都換成 px（地圖左上角是 0,0）
function layout(v: MapView, W: number) {
  const z = sizes(W), H = (W * v.h) / v.w, px = (p: { x: number; y: number }) => [(p.x / 100) * W, (p.y / 100) * H] as const;
  const inside = (b: Box, m = 2) => b.l >= m && b.t >= m && b.r <= W - m && b.b <= H - m;
  // 固定不動的：標題、北、往大城市（箭頭與字；字寫在箭頭左邊，右邊留給南山）
  const fixed: Box[] = [
    { l: W * 0.02, t: H * 0.025, r: W * 0.02 + 3 * z.ft * 1.32, b: H * 0.025 + z.ft },
    { l: W * 0.98 - Math.max(z.fN, W * 0.02), t: H * 0.02, r: W * 0.98, b: H * 0.02 + W * 0.02 * 1.375 + 1 + z.fN },
  ];
  let gate = null as null | { x: number; y: number; tx: number; ty: number };
  if (v.gate) {
    const [x, y] = px(v.gate), tx = x - z.ga * 0.45, ty = y + z.ga * 0.8;
    gate = { x, y, tx, ty };
    fixed.push({ l: x - z.ga / 2, t: y, r: x + z.ga / 2, b: y + z.ga * 2.2 }, { l: tx - 4 * z.fn, t: ty, r: tx, b: ty + z.fn });
  }
  const st = v.stickers.map((s) => { const [x, y] = px(s); return { ...s, px: x, py: y, disk: around(x, y, z.st + 4, z.st + 4) }; });
  // 鉛筆圈：蓋到某張貼紙的話，改成圈住那張貼紙（圈的半徑比貼紙大一點），箭頭貼在圈外
  let me = null as null | { x: number; y: number; R: number; A: number; rot: number; at: string | null; city: boolean };
  if (v.me) {
    const [x, y] = px(v.me); let best = null as null | (typeof st)[number], bd = Infinity;
    for (const s of st) { const d = Math.hypot(s.px - x, s.py - y); if (d < z.st / 2 + 4 + z.me && d < bd) { best = s; bd = d; } } // 圈會碰到貼紙
    const R = best ? z.st / 2 + 4 : z.me;
    me = { x: best ? best.px : x, y: best ? best.py : y, R, A: best ? Math.max(6, R * 0.5) : 0, rot: v.me.rot, at: best ? best.id : null, city: false };
  } else if (v.city && gate) me = { x: gate.x, y: gate.y + z.ga * 2.2 + z.me - 2, R: z.me, A: 0, rot: 0, at: null, city: true }; // 在大城市：圈在箭頭的尖端
  const meBox = me ? around(me.x, me.y, 2 * (me.R + me.A) + 2, 2 * (me.R + me.A) + 2) : null;
  // 小秘密的星星：整顆留在地圖裡（貼在最邊上的會往裡挪一點）
  const eggs = v.eggs.map((e) => { const [x, y] = px(e); return { ...e, px: cl(z.fe / 2 + 1, x, W - z.fe / 2 - 1), py: cl(z.fe / 2 + 1, y, H - z.fe / 2 - 1) }; });
  const eggBoxes = eggs.map((e) => around(e.px, e.py, z.fe * 1.3, z.fe * 1.3)); // 星星歪了最多 20°，外框大三成
  // 貼紙的名字：預設那一邊碰到東西就換一邊；寫在星星上面字不會被擋，但星星會被蓋住，所以也盡量找沒有星星的一邊
  const names: Record<string, { side: Side; off: number }> = {}, nameBoxes: Box[] = [];
  for (const s of st) {
    const tw = s.name.length * z.fn * 1.06, th = z.fn * 1.1, here = me && me.at === s.id, off = here ? me!.R + me!.A + 3 : z.st / 2 + 6;
    const box = (sd: Side): Box => sd === 'r' ? { l: s.px + off, t: s.py - th / 2, r: s.px + off + tw, b: s.py + th / 2 } : sd === 'l' ? { l: s.px - off - tw, t: s.py - th / 2, r: s.px - off, b: s.py + th / 2 }
      : sd === 'b' ? { l: s.px - tw / 2, t: s.py + off - 1, r: s.px + tw / 2, b: s.py + off - 1 + th } : { l: s.px - tw / 2, t: s.py - off + 1 - th, r: s.px + tw / 2, b: s.py - off + 1 };
    const order = [s.lb as Side, ...SIDES.filter((x) => x !== s.lb)];
    const ok = (sd: Side) => { const b = box(sd); return inside(b) && !fixed.some((f) => hit(b, f)) && !st.some((o) => o.id !== s.id && hit(b, o.disk)) && !nameBoxes.some((n) => hit(b, n)) && !(meBox && !here && hit(b, meBox, 1)); };
    const side = order.find((sd) => ok(sd) && !eggBoxes.some((e) => hit(box(sd), e, 0))) ?? order.find(ok) ?? (s.lb as Side);
    names[s.id] = { side, off }; nameBoxes.push(box(side));
  }
  // 地名：照順序挑第一個什麼都不碰的位置；只碰到鉛筆圈的位置當備用；都不行就不寫
  const labels: { id: string; t: string; x: number; y: number }[] = [], lbBoxes: Box[] = [];
  for (const r of v.labels) {
    const w = r.t.length * z.fl * 1.3 - z.fl * 0.3, h = z.fl; let soft = null as null | { x: number; y: number; b: Box };
    let pick = null as null | { x: number; y: number; b: Box };
    for (const c of r.c) {
      const [x, y] = px(c), b = around(x, y, w, h);
      if (!inside(b, 3) || fixed.some((f) => hit(b, f, 3)) || st.some((s) => hit(b, s.disk, 3)) || nameBoxes.some((n) => hit(b, n, 3)) || eggBoxes.some((e) => hit(b, e)) || lbBoxes.some((l) => hit(b, l, 6))) continue;
      if (meBox && hit(b, meBox, 1)) { soft = soft || { x, y, b }; continue; }
      pick = { x, y, b }; break;
    }
    pick = pick || soft; if (!pick) continue;
    labels.push({ id: r.id, t: r.t, x: pick.x, y: pick.y }); lbBoxes.push(pick.b);
  }
  return { z, H, gate, me, st, names, eggs, labels };
}

const RING = 'M-2 -11.2C6.5-12.4 11.6-6 11.3 1.2 11 8.6 4.6 12.3-1.6 11.6-8.4 10.9-12 5-11.2-1.8-10.4-8.6-4.2-12.6 3.4-10.9'; // 半徑約 11.4 的手畫圓（座標全是絕對值，可以整條等比放大）
// 鉛筆圈：一筆畫的圓，頭尾多畫一點（像手畫的一樣沒有接好）＋朝向：尾巴凹進去的實心小箭頭（R＝圈的半徑，px）。
// 平常箭頭畫在圈裡（畫在圈外、朝東北的時候整個像「♂」）；圈住地標貼紙時圈裡是貼紙，箭頭改貼在圈外（A＝圈外箭頭的長）
function Me({ R, A, rot, city, out }: { R: number; A: number; rot: number; city: boolean; out: boolean }) {
  const s = R / 11.4, S = Math.ceil(R + (out ? A : 0) + 4), w = A * 0.62;
  const arrow = out ? `M${-w} ${-(R + 1.6)}L0 ${-(R + A + 1)}L${w} ${-(R + 1.6)}L0 ${-(R + 1.6 + A * 0.3)}z` : `M0 ${-R * 0.62}L${R * 0.44} ${R * 0.46}L0 ${R * 0.2}L${-R * 0.44} ${R * 0.46}z`;
  return (
    <svg viewBox={`${-S} ${-S} ${2 * S} ${2 * S}`} style={{ width: 2 * S, height: 2 * S }} aria-hidden="true">
      <path className="o" pathLength={100} d={RING.replace(/-?\d*\.?\d+/g, (n) => (parseFloat(n) * s).toFixed(2))} />
      {!city && <g style={{ transform: `rotate(${rot}deg)` }}><path className="a" d={arrow} /></g>}
    </svg>
  );
}

export default function NoteMap() {
  const g = G(), v = g.mapView?.(), cv = useRef<HTMLCanvasElement>(null), box = useRef<HTMLDivElement>(null), me = useRef<HTMLSpanElement>(null), seq = v?.seq ?? 0;
  const [W, setW] = useState(0);
  // 地圖的寬度：第一次畫之前量一次（不會先閃一下排錯的版面），之後跟著畫面大小
  useLayoutEffect(() => {
    const el = box.current; if (!el) return; const f = () => setW(el.clientWidth); f();
    const ro = new ResizeObserver(f); ro.observe(el); return () => ro.disconnect();
  }, [!!v]);
  useEffect(() => { if (cv.current) g.mapDraw?.(cv.current); });
  // 翻到這一頁：窄螢幕（地圖比頁面高）把自己的位置捲進畫面；showSec 畫完會把頁面捲回最上面，所以等下一格再捲
  useEffect(() => { const id = requestAnimationFrame(() => me.current?.scrollIntoView({ block: 'center', inline: 'nearest' })); return () => cancelAnimationFrame(id); }, [seq, W > 0]);
  if (!v) return null;
  const L = W > 0 ? layout(v, W) : null, z = L?.z;
  const at = L?.me?.at ? L.st.find((s) => s.id === L.me!.at) : null;
  const where = v.city ? '我在大城市' : v.cave ? '我在山洞裡' : at ? `我在${at.name}旁邊` : '我在這裡';
  const vars = z && ({ '--st': `${z.st}px`, '--fn': `${z.fn}px`, '--fl': `${z.fl}px`, '--fe': `${z.fe}px`, '--ft': `${z.ft}px`, '--fN': `${z.fN}px`, '--ga': `${z.ga}px` } as CSSProperties);
  return (
    <div className="nm">
      <div ref={box} className="nm-map" style={{ aspectRatio: `${v.w} / ${v.h}`, ...vars }}>
        <canvas ref={cv} width={v.cw} height={v.ch} role="img" aria-label={`月光谷的手繪地圖：走過 ${v.pct}%`} />
        {L && z && <>
          <b className="nm-title" aria-hidden="true">月光谷</b>
          <span className="nm-north" aria-hidden="true"><svg viewBox="0 0 16 22"><path d="M8 20V3M3 8l5-5.5L13 8" /></svg>北</span>
          {L.gate && (
            <span className="nm-gate" style={{ left: L.gate.x, top: L.gate.y }} aria-hidden="true">
              <svg viewBox="0 0 20 44"><path d="M10 2c-1 9 1 19 0 34M4 29l6 8 6-8" /></svg><b style={{ right: L.gate.x - L.gate.tx, top: L.gate.ty - L.gate.y }}>往大城市</b>
            </span>
          )}
          {L.eggs.map((e) => (
            <i key={e.id} className={`nm-egg${e.px > W * 0.72 ? ' end' : ''}`} style={{ left: e.px, top: e.py, '--r': `${tilt(e.id, 40) - 20}deg` } as CSSProperties} data-n={e.name} tabIndex={0} aria-label={`小秘密：${e.name}`}>
              <svg viewBox="0 0 20 20" aria-hidden="true"><path d={STAR} fill={ZC[e.zone] || '#fbbf24'} /></svg>
            </i>
          ))}
          {L.labels.map((l) => <span key={l.id} className="nm-lb" style={{ left: l.x, top: l.y }} aria-hidden="true">{l.t}</span>)}
          {L.st.map((s) => {
            const n = L.names[s.id], o = n.off;
            const nb: CSSProperties = n.side === 'r' ? { left: o, top: 0, transform: 'translateY(-50%)' } : n.side === 'l' ? { right: o, top: 0, transform: 'translateY(-50%)' }
              : n.side === 'b' ? { top: o - 1, left: 0, transform: 'translateX(-50%)' } : { bottom: o - 1, left: 0, transform: 'translateX(-50%)' };
            return (
              <span key={s.id} className="nm-st" style={{ left: s.px, top: s.py, '--r': `${tilt(s.id) - 4.5}deg` } as CSSProperties} title={s.name}>
                <svg viewBox="0 0 24 24" aria-hidden="true">{ART[s.kind]}</svg><b style={nb}>{s.name}</b>
              </span>
            );
          })}
          {L.me && (
            <span ref={me} key={seq} className={`nm-me${L.me.city ? ' city' : ''}`} style={{ left: L.me.x, top: L.me.y }} title={where}>
              <Me R={L.me.R} A={L.me.A} rot={L.me.rot} city={L.me.city} out={!!L.me.at} />
            </span>
          )}
        </>}
      </div>
      <aside className="nm-side">
        <h3 className="nb-h">我的地圖</h3>
        <p className="nm-pct">走過 <b>{v.pct}%</b> <span>的月光谷</span></p>
        <ul className="nm-key">
          <li><svg className="k k-me" viewBox="-20 -20 40 40" aria-hidden="true"><circle r="10" /><path d="M0-6.2L4.4 4.6 0 2-4.4 4.6z" /></svg>{where}</li>
          <li><i className="k k-path" aria-hidden="true" />小徑</li>
          <li><i className="k k-cave" aria-hidden="true" />走過的山洞</li>
          <li><svg className="k k-st" viewBox="0 0 24 24" aria-hidden="true">{ART.home}</svg>地標 {v.lmN}/{v.lmT}</li>
          <li><svg className="k k-egg" viewBox="0 0 20 20" aria-hidden="true"><path d={STAR} fill="#fbbf24" /></svg>小秘密 {v.eggN}/{v.eggT}</li>
        </ul>
        <p className="nm-tip">空白的地方還沒去過，走過就會畫上去。</p>
        {!v.touch && <p className="nm-tip"><kbd>M</kbd> 隨時翻到這一頁</p>}
      </aside>
    </div>
  );
}
