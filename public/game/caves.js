'use strict';
/* ============================================================
   第 4 堂：區域之間的路——山洞（7.1–7.3、4.1–4.4、05、06）
   地形是一張高度圖（一個位置只有一個高度），挖不出「山裡面的空間」，所以山洞是另外做的模型：
   - 每個洞是一條曲線：洞口 → 窄道 → 大廳 → 出口。沿曲線每隔一段做一圈斷面，接成低面數的管子；
     地面高度與牆壁碰撞都用「離這條曲線多遠」來算（7.2），不必做碰撞模型。
   - 洞口那一段是直的：地形材質在這段管子的斷面裡 discard（terrainMat 的 uCvA／uCvB），山壁上就出現真的洞口；
     洞口前的地形整平成小平台、洞口後方墊高成山壁（caveShape，接在 H0 最後）。
   - 走進洞口 CAVE_IN 公尺之後，鏡頭只畫第 1、2 層（山洞、手、燈、出口的亮光），外面的地形、植被、雲、天空整個不畫（7.3）。
     圖層：0＝外面的世界、1＝山洞、2＝只在洞裡看得到的出口亮光。洞口兩段同時在 0 和 1，從外面看得到洞口裡面。
   - 光照烘進頂點顏色（洞口天光、大廳光柱、苔蘚、熔岩溝、出口那一區的主色），發光的東西用自發光材質，不加點光源（7.2）。
   這個檔案在 game.js 之前載入：最上層只放資料與函式，用到的 game.js 全域（H、K、W、P、S…）都在函式被呼叫時才讀。
   ============================================================ */

const CAVE_L0 = 6; // 洞口直段（公尺）：地形在這段挖洞
const CAVE_IN = 15; // 走進洞口幾公尺之後只畫山洞
const CAVE_STEP = .5; // 曲線取樣間距（公尺）
const CAVE_UA = Array.from({ length: 8 }, () => new THREE.Vector4()), CAVE_UB = Array.from({ length: 8 }, () => new THREE.Vector4());
// 每個洞的主題：岩石底色、洞裡的霧、環境光、發光痕跡（＝那一區的主色，4.4）、粒子、環境音
const CAVE_THEME = {
  sea: { rock: '#4d6f80', rock2: '#7aa3b3', wet: '#2f4f5e', fog: '#0b1d29', amb: '#5b7f95', light: '#cdeeff', trail: '#5EC2E8', glow: '#bfe9ff', far: 30, hemi: '#9fd8ff', hemiG: '#16303f', part: 'drip', pc: '#bfe9ff' },
  lava: { rock: '#4a3b36', rock2: '#6a4c40', wet: '#2b211e', fog: '#1d0f0a', amb: '#76625a', light: '#ffd0a0', trail: '#E8743B', glow: '#ffb27a', far: 28, hemi: '#ffb27a', hemiG: '#2a120b', part: 'spark', pc: '#ffae5c' },
  ice: { rock: '#8db3cf', rock2: '#d3ecfb', wet: '#6d93b3', fog: '#13263a', amb: '#7fa3c4', light: '#e8f6ff', trail: '#BFE3F5', glow: '#eaf6ff', far: 34, hemi: '#d6ecff', hemiG: '#2b3f5c', part: 'glint', pc: '#f0f9ff' },
  moon: { rock: '#3e3a5e', rock2: '#5d5689', wet: '#29264a', fog: '#0c0a1c', amb: '#4d4880', light: '#c7d2fe', trail: '#a78bfa', glow: '#d8ccff', far: 32, hemi: '#b8c6ff', hemiG: '#141233', part: 'mote', pc: '#ddd6fe' },
};
/* 四個山洞（03 的比較表）。座標是「基礎單位」（世界座標＝基礎單位×K），在洞自己的方向上：
   u＝從月光谷中心往外、v＝沿山脊橫向；d 是 u 的方向。a＝內側洞口、b＝外側洞口（月光洞窟是死路，沒有 b）。
   pts 是洞裡的控制點：[u, v, 半寬(公尺), 高度(公尺), 地面落差(公尺)]；hall 是大廳那一點的索引 */
const CAVE_DEF = [
  { id: 'sea', name: '海蝕洞', to: 'coast', gate: 'coast', th: 'sea', d: [1, 0], a: [45.2, 0], aw: 2.6, ah: 5.2, b: [63.8, 2.4], bw: 2.7, bh: 5.4, hall: 6,
    pts: [[52.2, 4.2, 1.8, 4, -.6], [50.6, 10, 1.5, 3.6, -1], [52.8, 15.5, 1.5, 3.6, -1.4], [50.8, 21, 1.5, 3.6, -1.7], [52.6, 26.5, 1.6, 3.8, -2], [54.8, 31, 4.2, 7.5, -2.4], [57.4, 32.2, 6.8, 11, -2.8], [59.8, 29, 4.8, 8.5, -2.6], [60.4, 22.5, 2.2, 4.6, -1.9], [58.8, 16.5, 2.2, 4.6, -1.4], [60.2, 10.8, 2.3, 4.6, -.9], [59.6, 6.6, 2.4, 4.8, -.5]],
    mural: '潮汐', slime: 'saltc' },
  { id: 'lava', name: '熔岩隧道', to: 'volcano', gate: 'volcano', th: 'lava', d: [0, -1], a: [45.2, 0], aw: 2.6, ah: 5.2, b: [63.8, -2.4], bw: 2.7, bh: 5.4, hall: 6,
    pts: [[52, -4.5, 1.9, 4.2, -.5], [50.4, -10.5, 1.8, 4.2, -.8], [52.6, -16.5, 1.8, 4.4, -1], [50.8, -22.5, 1.8, 4.4, -1.1], [52.8, -28, 2, 4.6, -1], [55.4, -31.5, 4, 8.5, -.6], [58, -32.2, 6.2, 12.5, -.3], [60, -28.4, 4.4, 9.5, -.6], [60.4, -21.5, 2, 4.6, -1.2], [58.8, -15, 2, 4.6, -1], [60.2, -9.5, 2.2, 4.8, -.8], [59.7, -6, 2.2, 4.8, -.5]],
    mural: '熔岩柱', slime: 'charc' },
  { id: 'ice', name: '冰洞', to: 'snow', coat: true, th: 'ice', d: [-1, 0], a: [45.2, 0], aw: 2.6, ah: 5.2, b: [63.8, 2.4], bw: 2.7, bh: 5.4, hall: 6,
    pts: [[51.8, 5, 1.8, 4, -.6], [50.4, 11, 1.6, 3.8, -1], [52.6, 16.8, 1.6, 3.8, -1.2], [50.8, 22.6, 1.7, 4, -1.4], [53, 28, 1.8, 4.2, -1.5], [55.6, 30.8, 4.4, 8.5, -1.6], [58, 30, 6.4, 10.5, -1.8], [59.8, 25.4, 4.4, 8, -1.5], [60.2, 18.5, 2.2, 4.6, -1.2], [58.8, 12.5, 2.2, 4.6, -1], [60, 8.4, 2.3, 4.8, -.7], [59.7, 5.6, 2.3, 4.8, -.4]],
    mural: '月光洞窟', slime: 'frostb' },
  { id: 'moon', name: '月光洞窟', dead: true, night: true, th: 'moon', d: [0, 1], a: [45.2, -7], aw: 1.05, ah: 3.1, hall: 6,
    pts: [[50.8, -6.4, 1, 3, -.6], [52.8, -2.6, 1.1, 3.2, -1.1], [52.2, 3, 1.2, 3.4, -1.6], [54.4, 7.4, 1.6, 3.8, -2], [57, 8.6, 3.8, 7.5, -2.4], [59.8, 7.4, 8.6, 12, -2.8], [62.6, 6.6, 9.2, 12.5, -2.8], [65, 6, 5.6, 9, -2.8]],
    mural: '空島', slime: 'moon' },
];
// 壁畫：大廳裡的線索（下一道謎題），拍照後存進手帳（06）
const CAVE_MURAL = {
  sea: { t: '海蝕洞的壁畫', txt: '四顆石頭在浪裡一顆接一顆亮起：第一顆像火焰，最後一顆像初春的嫩草。', next: '潮汐石陣' },
  lava: { t: '熔岩隧道的壁畫', txt: '一排四根石柱：最左邊結著冰，最右邊開著海底的花。', next: '四座熔岩柱' },
  ice: { t: '冰洞的壁畫', txt: '月光谷南方的山壁上有一道裂縫，月亮升起的時候，裂縫裡透出紫色的光。', next: '月光洞窟' },
  moon: { t: '湖邊的石碑', txt: '「月亮最近的地方，有一座漂在雲上的島。帶著月光凝膠的人，會被月光接引。」', next: '空島的傳說（第 5 堂）' },
};
const CAVES = [], CV = { c: null, i: 0, s: 0, l: 0, k: 0, mode: 'out', dir: 1, raw: false, exp: 1, flash: 0, lift: 0, f0: null, scanN: 0 };
let CAVE_M = null; const CAVE_SEC = []; // 洞口（基礎單位）與洞口兩段的範圍：地形整平與墊高用

/* ---------- 洞口：在建地形之前就要知道（caveShape 在 H0 裡被呼叫） ---------- */
function caveLocal(def) { const [dx, dz] = def.d; return (u, v) => [dx * u - dz * v, dz * u + dx * v]; }
function cavePrep() {
  if (CAVE_M) return CAVE_M; CAVE_M = [];
  CAVE_DEF.forEach(def => {
    const W2 = caveLocal(def), [ax, az] = W2(def.a[0], def.a[1]);
    def.ma = { x: ax, z: az, dx: def.d[0], dz: def.d[1], w: def.aw, h: def.ah, def };
    if (!def.dead) {
      const last = def.pts[def.pts.length - 1], du = def.b[0] - last[0], dv = def.b[1] - last[1], dl = Math.hypot(du, dv), eu = du / dl, ev = dv / dl;
      const [bx, bz] = W2(def.b[0], def.b[1]), [ex, ez] = W2(def.b[0] - eu, def.b[1] - ev), ox = bx - ex, oz = bz - ez, ol = Math.hypot(ox, oz);
      def.eUV = [eu, ev]; def.mb = { x: bx, z: bz, dx: -ox / ol, dz: -oz / ol, w: def.bw, h: def.bh, def };
    }
    [def.ma, def.mb].forEach(m => { if (!m) return; CV.raw = true; m.y = H0(m.x, m.z); CV.raw = false; CAVE_M.push(m); });
    // 曲線先算好：洞口兩段（各 34 公尺）上方的山體要比洞頂高，從洞口那一段看進去不會看到地形穿進洞裡
    const c = def.path = cavePath(def), secs = [[0, c.n - 1, 1]]; if (!c.dead) secs.push([0, c.n - 1, -1]);
    secs.forEach(([a, b, d]) => { let i0 = a, i1 = b; if (d > 0) { i1 = Math.min(b, Math.round(34 / CAVE_STEP)); } else { i0 = Math.max(a, c.n - 1 - Math.round(34 / CAVE_STEP)); } let x0 = 1e9, x1 = -1e9, z0 = 1e9, z1 = -1e9, wm = 0; for (let i = i0; i <= i1; i++) { x0 = Math.min(x0, c.X[i]); x1 = Math.max(x1, c.X[i]); z0 = Math.min(z0, c.Z[i]); z1 = Math.max(z1, c.Z[i]); wm = Math.max(wm, c.Wd[i]); } const m = wm + 7; CAVE_SEC.push({ c, i0, i1, head: d > 0, x0: x0 - m, x1: x1 + m, z0: z0 - m, z1: z1 + m }); });
  });
  return CAVE_M;
}
// 接在 H0 最後（基礎單位）：洞口前整平成小平台；洞口後方墊高成山壁，讓管子從山壁鑽進去
function caveShape(x, z, h) {
  if (CV.raw) return h; const ms = cavePrep();
  for (const m of ms) {
    const rx = x - m.x, rz = z - m.z; if (rx * rx + rz * rz > 400) continue;
    const t = rx * m.dx + rz * m.dz, l = Math.abs(rz * m.dx - rx * m.dz), wb = m.w / K, hb = m.h / K;
    const wa = smooth(-7, -3.5, t) * (1 - smooth(.35, .9, t)) * (1 - smooth(wb + 1.2, wb + 3.4, l));
    h += (m.y - h) * wa;
  }
  const xw = x * K, zw = z * K;
  for (const q of CAVE_SEC) {
    if (xw < q.x0 || xw > q.x1 || zw < q.z0 || zw > q.z1) continue; const c = q.c; let bi = q.i0, bd = 1e18;
    for (let i = q.i0; i <= q.i1; i++) { const dx = xw - c.X[i], dz = zw - c.Z[i], d = dx * dx + dz * dz; if (d < bd) { bd = d; bi = i; } }
    const d = Math.sqrt(bd), w = c.Wd[bi], sv = q.head ? c.S[bi] : c.L - c.S[bi], wt = (1 - smooth(w + 1.2, w + 6.5, d)) * smooth(.4, 2.2, sv), top = (c.Y[bi] + c.Hh[bi] + 2.4) / K;
    if (h < top) h += (top - h) * wt;
  }
  return h;
}

/* ---------- 曲線：控制點 → Catmull-Rom → 每 0.5 公尺取樣 ---------- */
function cavePath(def) {
  const W2 = caveLocal(def), L0b = CAVE_L0 / K, p0 = def.pts[0], Q = [];
  const add = (u, v, w, h, fy) => { const [x, z] = W2(u, v); Q.push([x * K, z * K, w, h, fy]); };
  add(def.a[0], def.a[1], def.aw, def.ah, 0); add(def.a[0] + L0b, def.a[1], def.aw, def.ah, 0); add(def.a[0] + L0b + 1.8, def.a[1], (def.aw + p0[2]) / 2, (def.ah + p0[3]) / 2, p0[4] * .4);
  def.pts.forEach(p => add(...p));
  if (!def.dead) { const [eu, ev] = def.eUV, l = def.pts[def.pts.length - 1]; add(def.b[0] - eu * (L0b + 1.8), def.b[1] - ev * (L0b + 1.8), (def.bw + l[2]) / 2, (def.bh + l[3]) / 2, l[4] * .4); add(def.b[0] - eu * L0b, def.b[1] - ev * L0b, def.bw, def.bh, 0); add(def.b[0], def.b[1], def.bw, def.bh, 0); }
  const dense = [], NS = 24;
  for (let i = 0; i < Q.length - 1; i++) {
    const a = Q[Math.max(0, i - 1)], b = Q[i], c = Q[i + 1], d = Q[Math.min(Q.length - 1, i + 2)];
    for (let k = 0; k < NS; k++) { const t = k / NS, t2 = t * t, t3 = t2 * t; dense.push(b.map((_, j) => .5 * (2 * b[j] + (-a[j] + c[j]) * t + (2 * a[j] - 5 * b[j] + 4 * c[j] - d[j]) * t2 + (-a[j] + 3 * b[j] - 3 * c[j] + d[j]) * t3))); }
  }
  dense.push(Q[Q.length - 1].slice());
  const acc = [0]; for (let i = 1; i < dense.length; i++) acc.push(acc[i - 1] + Math.hypot(dense[i][0] - dense[i - 1][0], dense[i][1] - dense[i - 1][1]));
  const L = acc[acc.length - 1], n = Math.floor(L / CAVE_STEP) + 1, A = k => new Float32Array(n);
  const c = { def, id: def.id, th: def.th, dead: !!def.dead, L, n, X: A(), Z: A(), Y: A(), Wd: A(), Hh: A(), S: A(), TX: A(), TZ: A(), FY: A() };
  let j = 0;
  for (let i = 0; i < n; i++) {
    const s = Math.min(L, i * CAVE_STEP); while (j < acc.length - 2 && acc[j + 1] < s) j++;
    const f = (s - acc[j]) / Math.max(1e-6, acc[j + 1] - acc[j]), p = dense[j], q = dense[j + 1], mix = k => p[k] + (q[k] - p[k]) * f;
    c.X[i] = mix(0); c.Z[i] = mix(1); c.Wd[i] = mix(2); c.Hh[i] = mix(3); c.FY[i] = mix(4); c.S[i] = s;
  }
  c.L = c.S[n - 1];
  for (let i = 0; i < n; i++) { const a = Math.max(0, i - 1), b = Math.min(n - 1, i + 1), tx = c.X[b] - c.X[a], tz = c.Z[b] - c.Z[a], tl = Math.hypot(tx, tz) || 1; c.TX[i] = tx / tl; c.TZ[i] = tz / tl; }
  // 地面：入口高度 → 出口高度（直段保持水平）＋各點的落差
  const y0 = def.ma.y * K, y1 = def.dead ? y0 : def.mb.y * K;
  for (let i = 0; i < n; i++) { const s = c.S[i]; c.Y[i] = y0 + (y1 - y0) * smooth(CAVE_L0, c.L - CAVE_L0, s) + c.FY[i] * (1 - smooth(CAVE_L0 - 2, CAVE_L0, Math.min(s, c.dead ? 1e9 : c.L - s))); }
  c.y0 = y0; c.y1 = y1;
  // 大廳中心：離 hall 控制點最近的取樣
  { const [hx, hz] = W2(def.pts[def.hall][0], def.pts[def.hall][1]); let bd = 1e9; for (let i = 0; i < n; i++) { const d = Math.hypot(c.X[i] - hx * K, c.Z[i] - hz * K); if (d < bd) { bd = d; c.hallI = i; } } }
  c.sIn = CAVE_IN; c.ends = [{ s: 0, i: 0, x: c.X[0], z: c.Z[0] }]; if (!c.dead) c.ends.push({ s: c.L, i: n - 1, x: c.X[n - 1], z: c.Z[n - 1] });
  return c;
}
// 查詢：最近的取樣（從上一次的位置附近找）→ 投影到線段上，算出沿曲線的距離 s、橫向距離 l、地面高度
const CQ = { s: 0, l: 0, y: 0, w: 0, h: 0, i: 0, nx: 0, nz: 0, cx: 0, cz: 0 };
function caveQ(c, x, z, i0) {
  const n = c.n, X = c.X, Z = c.Z, a = i0 == null ? 0 : Math.max(0, i0 - 30), b = i0 == null ? n - 1 : Math.min(n - 1, i0 + 30); let bi = a, bd = 1e18;
  for (let i = a; i <= b; i++) { const dx = x - X[i], dz = z - Z[i], d = dx * dx + dz * dz; if (d < bd) { bd = d; bi = i; } }
  const j = bi > 0 && (bi === n - 1 || (x - X[bi]) * c.TX[bi] + (z - Z[bi]) * c.TZ[bi] < 0) ? bi - 1 : bi;
  const sx = X[j + 1] - X[j], sz = Z[j + 1] - Z[j], sl = Math.hypot(sx, sz) || 1e-6, ux = sx / sl, uz = sz / sl;
  let t = ((x - X[j]) * ux + (z - Z[j]) * uz) / sl; const tc = clamp(t, 0, 1); if (j > 0 && j < n - 2) t = tc;
  CQ.i = bi; CQ.s = c.S[j] + t * sl; CQ.nx = -uz; CQ.nz = ux; CQ.cx = X[j] + sx * tc; CQ.cz = Z[j] + sz * tc;
  CQ.l = (x - CQ.cx) * CQ.nx + (z - CQ.cz) * CQ.nz;
  CQ.y = c.Y[j] + (c.Y[j + 1] - c.Y[j]) * tc; CQ.w = c.Wd[j] + (c.Wd[j + 1] - c.Wd[j]) * tc; CQ.h = c.Hh[j] + (c.Hh[j + 1] - c.Hh[j]) * tc;
  return CQ;
}

/* ---------- 建模 ---------- */
// 斷面（正規化）：平的地面、直立的牆、拱形的頂；洞口直段的地形挖洞用同一個形狀（terrainMat）
function caveProfile(N) {
  const P0 = [[0, 0], [.86, 0], [1, .12], [1, .4]]; for (let i = 1; i <= 12; i++) { const a = i / 12 * Math.PI; P0.push([Math.cos(a), .4 + .6 * Math.sin(a)]); } P0.push([-1, .12], [-.86, 0], [0, 0]);
  const acc = [0]; for (let i = 1; i < P0.length; i++) acc.push(acc[i - 1] + Math.hypot(P0[i][0] - P0[i - 1][0], P0[i][1] - P0[i - 1][1]));
  const T = acc[acc.length - 1], out = []; let j = 0;
  for (let k = 0; k < N; k++) { const s = k / N * T; while (j < acc.length - 2 && acc[j + 1] < s) j++; const f = (s - acc[j]) / (acc[j + 1] - acc[j]); out.push([P0[j][0] + (P0[j + 1][0] - P0[j][0]) * f, P0[j][1] + (P0[j + 1][1] - P0[j][1]) * f]); }
  return out;
}
const caveCol = (h) => new THREE.Color(h);
function caveTex(key, w, h, draw) {
  const C = caveTex.c || (caveTex.c = {}); if (C[key]) return C[key];
  const cv = document.createElement('canvas'); cv.width = w; cv.height = h; draw(cv.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; return (C[key] = t);
}
const glowTex = () => caveTex('glow', 128, 128, (g, w) => { const r = g.createRadialGradient(w / 2, w / 2, 0, w / 2, w / 2, w / 2); r.addColorStop(0, 'rgba(255,255,255,1)'); r.addColorStop(.35, 'rgba(255,255,255,.55)'); r.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = r; g.fillRect(0, 0, w, w); });
function caveSetLayers(o, mask) { o.traverse(c => { c.layers.mask = mask; }); return o; }

// 一個洞的光：環境＋洞口天光＋光柱＋苔蘚＋熔岩溝＋出口那一區的主色；回傳亮度乘上顏色後寫進 out
function caveLight(c, s, x, y, z, yn, out) {
  const T = c.T, r = T.amb.r * .72, g = T.amb.g * .72, b = T.amb.b * .72; let R = r, G2 = g, B = b;
  const add = (col, k) => { R += col.r * k; G2 += col.g * k; B += col.b * k; };
  add(c.lightA, 1.25 * Math.exp(-s / 6.5)); if (!c.dead) add(c.lightB, 1.35 * Math.exp(-(c.L - s) / 7));
  for (const sh of c.shafts) { const d = Math.hypot(x - sh.x, z - sh.z); add(sh.col, sh.k * Math.exp(-d * d / (sh.r * sh.r)) * (yn < .15 ? 1.2 : .75)); }
  for (const m of c.moss) { const d2 = (x - m.x) ** 2 + (y - m.y) ** 2 + (z - m.z) ** 2; if (d2 < 30) add(c.mossC, .75 * Math.exp(-d2 / 3.2)); }
  if (c.lava) { const q = caveQ(c, x, z, null); if (q.s > c.lava.s0 && q.s < c.lava.s1) { const d = Math.hypot(q.l - c.lava.l * q.w, (y - q.y) * 1.5); add(c.lavaC, .8 * Math.exp(-d * d / 3.2)); } }
  const k = 1.06 - .38 * yn; out.setRGB(R * k, G2 * k, B * k); return out;
}
// 管子：先算每一圈的頂點（位置＋烘焙的光），再拆成一個一個三角面、每面一個顏色——和月光谷其他低多邊形的東西一樣看得到稜角
const caveHash = (a, b) => { const v = Math.sin(a * 127.1 + b * 311.7) * 43758.5453; return v - Math.floor(v); };
function caveTube(c, i0, i1, N, mask) {
  const prof = caveProfile(N), step = Math.max(1, Math.round((LOW ? 2.4 : 1.5) / CAVE_STEP)), rings = [];
  for (let i = i0; i < i1; i += step) rings.push(i); if (rings[rings.length - 1] !== i1) rings.push(i1);
  const R = rings.length, VP = new Float32Array(R * N * 3), VC = new Float32Array(R * N * 3), VY = new Float32Array(R * N), RC = new Float32Array(R * 3);
  const tc = new THREE.Color(), base = new THREE.Color(), rk = c.T.rockC, rk2 = c.T.rock2C, wet = c.T.wetC;
  rings.forEach((si, ri) => {
    const s = c.S[si], cx = c.X[si], cz = c.Z[si], nx = -c.TZ[si], nz = c.TX[si], w = c.Wd[si], h = c.Hh[si], fy = c.Y[si] - (c.drop ? c.drop(s) : 0);
    RC[ri * 3] = cx; RC[ri * 3 + 1] = fy + h * .45; RC[ri * 3 + 2] = cz;
    const jit = smooth(CAVE_L0 - 1, CAVE_L0 + 3, Math.min(s, c.dead ? 1e9 : c.L - s)); // 洞口直段不加凹凸：和地形挖的洞剛好吻合
    prof.forEach(([px, py], k) => {
      const floor = py < .02, nn = vnoise(s * .45 + k * 3.1, k * .7, 31) - .5, nn2 = vnoise(s * 1.3, k * 1.9, 37) - .5, amp = floor ? 0 : (.2 * Math.min(w, h * .6) * nn + .09 * nn2) * jit;
      const len = Math.hypot(px, py - .45) || 1, ox = px / len, oy = (py - .45) / len;
      const lx = px * w + ox * amp, ly = floor ? (k % 2 ? .015 : 0) : py * h + oy * amp * .6;
      const x = cx + nx * lx, z = cz + nz * lx, y = fy + ly, o = (ri * N + k) * 3; VP[o] = x; VP[o + 1] = y; VP[o + 2] = z; VY[ri * N + k] = y - c.Y[si];
      base.copy(rk).lerp(rk2, clamp(.5 + nn * 1.6 + py * .25, 0, 1)); if (floor) base.lerp(wet, .45);
      const ao = (floor ? 1 : 1 + nn * .7 * jit) * (py < .16 && Math.abs(px) > .8 ? .72 : 1); // 凹處暗、凸處亮、牆角陰影
      caveLight(c, s, x, y, z, py, tc); VC[o] = base.r * tc.r * ao; VC[o + 1] = base.g * tc.g * ao; VC[o + 2] = base.b * tc.b * ao;
    });
  });
  const T = (R - 1) * N * 2, pos = new Float32Array(T * 9), col = new Float32Array(T * 9), th = c.th;
  const salt = caveCol('#e3f3f8'), glowL = caveCol('#ff8a3d'), vein = caveCol('#effaff'), deepB = caveCol('#6fb7ff'), amet = caveCol('#cdbdff');
  const A = new THREE.Vector3(), B = new THREE.Vector3(), C = new THREE.Vector3(), E1 = new THREE.Vector3(), E2 = new THREE.Vector3(), Nn = new THREE.Vector3(), fc = new THREE.Color(); let o = 0;
  const tri = (ia, ib, ic, r, k) => {
    A.fromArray(VP, ia * 3); B.fromArray(VP, ib * 3); C.fromArray(VP, ic * 3); Nn.crossVectors(E1.subVectors(B, A), E2.subVectors(C, A)).normalize();
    const mx = (A.x + B.x + C.x) / 3, my = (A.y + B.y + C.y) / 3, mz = (A.z + B.z + C.z) / 3; if (Nn.x * (RC[r * 3] - mx) + Nn.y * (RC[r * 3 + 1] - my) + Nn.z * (RC[r * 3 + 2] - mz) < 0) Nn.negate();
    const yr = (VY[ia] + VY[ib] + VY[ic]) / 3, hz = caveHash(c.S[rings[r]] * 1.7 + k, k * 3.3 + o * .001);
    fc.setRGB((VC[ia * 3] + VC[ib * 3] + VC[ic * 3]) / 3, (VC[ia * 3 + 1] + VC[ib * 3 + 1] + VC[ic * 3 + 1]) / 3, (VC[ia * 3 + 2] + VC[ib * 3 + 2] + VC[ic * 3 + 2]) / 3);
    let sh = .76 + .24 * Nn.y + (hz - .5) * .14;
    // 紋理都用「乘上去」的方式，跟著烘焙的明暗走；只有熔岩裂縫和紫水晶本身會發光
    if (th === 'sea') { const f = (yr / .55) % 1; if (yr > .25 && yr < 3.2 && f < .16) { fc.multiply(salt).multiplyScalar(1.45); } } // 一層層的水痕
    else if (th === 'lava') { if (Math.floor(yr / .7) % 2) sh *= .86; if (yr > .25 && yr < 1.6 && Math.abs(Nn.y) < .45 && hz > .94) { fc.lerp(glowL, .32); sh = 1; } } // 岩層、牆上偶爾一道發紅的裂縫
    else if (th === 'ice') { if (hz > .8) fc.multiply(vein).multiplyScalar(1.35); if (yr > 2.2) fc.multiply(deepB.clone().lerp(vein, 1 - .5 * smooth(2.2, 6, yr))).multiplyScalar(1.15); sh = .86 + .14 * Nn.y + (hz - .5) * .1; } // 冰脈、透出外面的藍光
    else if (hz > .955 && yr > .4) { fc.lerp(amet, .45); sh = 1.25; } // 月光洞窟：紫水晶
    fc.multiplyScalar(sh);
    for (const v of [A, B, C]) { pos[o] = v.x; pos[o + 1] = v.y; pos[o + 2] = v.z; col[o] = fc.r; col[o + 1] = fc.g; col[o + 2] = fc.b; o += 3; }
  };
  for (let r = 0; r < R - 1; r++) for (let k = 0; k < N; k++) { const k1 = (k + 1) % N, a = r * N + k, b = (r + 1) * N + k, cc = (r + 1) * N + k1, d = r * N + k1; tri(a, b, d, r, k); tri(b, cc, d, r, k); }
  const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.BufferAttribute(pos, 3)); geo.setAttribute('color', new THREE.BufferAttribute(col, 3)); geo.computeBoundingSphere();
  const m = new THREE.Mesh(geo, c.mat); m.layers.mask = mask; m.userData.rings = rings; return m;
}
// 死路的盡頭：最後一圈往外收成一個圓頂（不是一片平面），和洞壁一樣一面一個顏色
function caveCap(c, N, mask) {
  const prof = caveProfile(N), si = c.n - 1, cx = c.X[si], cz = c.Z[si], tx = c.TX[si], tz = c.TZ[si], nx = -tz, nz = tx, w = c.Wd[si], h = c.Hh[si], fy = c.Y[si], K2 = 4, tc = new THREE.Color();
  const ring = (k2) => prof.map(([px, py]) => { const f = Math.cos(k2 / K2 * Math.PI / 2), out = Math.sin(k2 / K2 * Math.PI / 2) * Math.min(w, h) * .7, yy = py < .02 ? 0 : (py * h - h * .45) * f + h * .45; return [cx + nx * px * w * f + tx * out, fy + Math.max(0, yy), cz + nz * px * w * f + tz * out, py]; });
  const R = Array.from({ length: K2 + 1 }, (_, k2) => ring(k2)), pos = [], col = [], base = c.T.rockC.clone(), A = new THREE.Vector3(), B = new THREE.Vector3(), C = new THREE.Vector3(), E1 = new THREE.Vector3(), E2 = new THREE.Vector3(), Nn = new THREE.Vector3();
  const tri = (a, b, d) => { A.set(a[0], a[1], a[2]); B.set(b[0], b[1], b[2]); C.set(d[0], d[1], d[2]); Nn.crossVectors(E1.subVectors(B, A), E2.subVectors(C, A)).normalize(); const mx = (A.x + B.x + C.x) / 3, my = (A.y + B.y + C.y) / 3, mz = (A.z + B.z + C.z) / 3; if (Nn.x * (cx - tx * 2 - mx) + Nn.y * (fy + h * .45 - my) + Nn.z * (cz - tz * 2 - mz) < 0) Nn.negate(); caveLight(c, c.L, mx, my, mz, clamp((my - fy) / h, 0, 1), tc); const k = (.76 + .24 * Nn.y) * (.93 + caveHash(mx, mz) * .14); for (const v of [A, B, C]) { pos.push(v.x, v.y, v.z); col.push(base.r * tc.r * k, base.g * tc.g * k, base.b * tc.b * k); } };
  for (let k2 = 0; k2 < K2; k2++) for (let k = 0; k < N; k++) { const k1 = (k + 1) % N; tri(R[k2][k], R[k2 + 1][k], R[k2][k1]); tri(R[k2 + 1][k], R[k2 + 1][k1], R[k2][k1]); }
  const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3)); geo.computeBoundingSphere();
  const m = new THREE.Mesh(geo, c.mat); m.layers.mask = mask; return m;
}
// 地上一道淡淡的發光痕跡，顏色＝那一區的主色，一路帶到出口（4.4）
function caveTrail(c) {
  const pos = [], uv = [], idx = [], hw = .11; let k = 0;
  for (let i = 0; i < c.n; i += 2) { const x = c.X[i], z = c.Z[i], nx = -c.TZ[i], nz = c.TX[i], y = c.Y[i] + .035, sOff = (vnoise(c.S[i] * .2, 3, 41) - .5) * .5 * smooth(8, 14, c.S[i]); pos.push(x + nx * (sOff - hw), y, z + nz * (sOff - hw), x + nx * (sOff + hw), y, z + nz * (sOff + hw)); uv.push(c.S[i] / 1.6, 0, c.S[i] / 1.6, 1); if (k) idx.push(2 * k - 2, 2 * k - 1, 2 * k, 2 * k - 1, 2 * k + 1, 2 * k); k++; }
  const tex = caveTex('trail', 64, 16, (g, w, h) => { const r = g.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, h * .9); r.addColorStop(0, 'rgba(255,255,255,1)'); r.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = r; g.fillRect(0, 0, w, h); }).clone();
  tex.wrapS = THREE.RepeatWrapping; tex.needsUpdate = true;
  const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); geo.setIndex(idx);
  const m = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color: c.T.trailC, map: tex, transparent: true, opacity: .75, depthWrite: false, blending: THREE.AdditiveBlending, fog: false }));
  m.layers.mask = 2; m.renderOrder = 2; c.trailTex = tex; return m;
}
// 光柱：半透明的錐形網格（每個洞最多 2 個，LOW 1 個），越靠近洞頂越亮，邊緣淡出
function caveShaftMat(color, k) {
  return new THREE.ShaderMaterial({
    uniforms: { c: { value: new THREE.Color(color) }, k: { value: k }, t: W.wind },
    vertexShader: 'varying vec2 vU; varying vec3 vN; varying vec3 vV; void main(){ vU = uv; vec4 wp = modelMatrix * vec4(position, 1.0); vN = normalize(mat3(modelMatrix) * normal); vV = normalize(cameraPosition - wp.xyz); gl_Position = projectionMatrix * viewMatrix * wp; }',
    fragmentShader: 'uniform vec3 c; uniform float k; uniform float t; varying vec2 vU; varying vec3 vN; varying vec3 vV; void main(){ float e = pow(abs(dot(normalize(vN), normalize(vV))), 1.6); float f = smoothstep(0.0, 0.35, vU.y) * (0.3 + 0.7 * vU.y); float fl = 0.82 + 0.18 * sin(t * 0.9 + vU.x * 25.0) * sin(t * 0.37 + vU.y * 4.0); gl_FragColor = vec4(c * k * e * f * fl, 1.0); }',
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
  });
}
// 粒子（水滴、火星、冰晶閃光、月光微塵）：位置在 GPU 上依時間計算，不必每格畫面更新
function caveParticles(c, list, mode0, col0, szK = 1) {
  const n = list.length, pos = new Float32Array(n * 3), ph = new Float32Array(n), hh = new Float32Array(n);
  list.forEach((p, i) => { pos[i * 3] = p.x; pos[i * 3 + 1] = p.y; pos[i * 3 + 2] = p.z; ph[i] = Math.random(); hh[i] = p.h; });
  const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.BufferAttribute(pos, 3)); geo.setAttribute('ph', new THREE.BufferAttribute(ph, 1)); geo.setAttribute('hh', new THREE.BufferAttribute(hh, 1)); geo.computeBoundingSphere();
  const mode = { drip: 0, spark: 1, glint: 2, mote: 3 }[mode0 || c.T.part];
  const mat = new THREE.ShaderMaterial({
    uniforms: { t: W.wind, c: { value: new THREE.Color(col0 || c.T.pc) }, m: { value: mode }, sz: { value: (LOW ? 34 : 46) * szK } },
    vertexShader: 'attribute float ph; attribute float hh; uniform float t; uniform float m; uniform float sz; varying float vA; void main(){ vec3 p = position; float a = 1.0;\n' +
      ' if (m < 0.5) { float f = fract(t * 0.35 + ph); p.y -= f * hh; a = smoothstep(0.0, 0.1, f) * (1.0 - smoothstep(0.85, 1.0, f)); }\n' +
      ' else if (m < 1.5) { float f = fract(t * 0.16 + ph); p.y += f * hh; p.x += sin(t * 1.7 + ph * 40.0) * 0.35 * f; p.z += cos(t * 1.3 + ph * 30.0) * 0.35 * f; a = (1.0 - f) * smoothstep(0.0, 0.08, f); }\n' +
      ' else if (m < 2.5) { a = pow(max(0.0, sin(t * 2.2 + ph * 60.0)), 12.0); }\n' +
      ' else { p.y += sin(t * 0.4 + ph * 20.0) * hh * 0.5; p.x += sin(t * 0.23 + ph * 9.0) * 0.6; a = 0.45 + 0.55 * sin(t * 1.1 + ph * 30.0); }\n' +
      ' vA = a; vec4 mv = modelViewMatrix * vec4(p, 1.0); gl_PointSize = sz * (0.6 + ph * 0.6) / -mv.z; gl_Position = projectionMatrix * mv; }',
    fragmentShader: 'uniform vec3 c; varying float vA; void main(){ vec2 d = gl_PointCoord - 0.5; float r = 1.0 - smoothstep(0.1, 0.5, length(d)); gl_FragColor = vec4(c * r * vA, 1.0); }',
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
  });
  const pts = new THREE.Points(geo, mat); pts.layers.mask = 2; pts.frustumCulled = false; return pts;
}
// 水面（潮池、月光地下湖、小水窪）：漣漪＋反光，月光湖中央倒映月亮
function caveWaterMat(col, deep, moon) {
  return new THREE.ShaderMaterial({
    uniforms: { t: W.wind, c: { value: new THREE.Color(col) }, d: { value: new THREE.Color(deep) }, moon: { value: moon ? 1 : 0 }, mk: { value: 0 } },
    vertexShader: 'varying vec2 vP; varying vec3 vW; void main(){ vP = position.xy; vec4 wp = modelMatrix * vec4(position, 1.0); vW = wp.xyz; gl_Position = projectionMatrix * viewMatrix * wp; }',
    fragmentShader: 'uniform float t; uniform vec3 c; uniform vec3 d; uniform float moon; uniform float mk; varying vec2 vP; varying vec3 vW; float hh(vec2 p){ return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); } float nn(vec2 p){ vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f); return mix(mix(hh(i), hh(i + vec2(1, 0)), f.x), mix(hh(i + vec2(0, 1)), hh(i + vec2(1, 1)), f.x), f.y); }\n' +
      'void main(){ float r = length(vP); float w = nn(vP * 1.3 + vec2(t * 0.25, -t * 0.18)) * 0.6 + nn(vP * 3.1 - vec2(t * 0.4, t * 0.3)) * 0.4; float ring = 0.5 + 0.5 * sin(r * 5.0 - t * 1.6); vec3 col = mix(d, c, 0.35 + 0.4 * w); col += c * pow(w, 6.0) * 0.9; float fr = pow(1.0 - abs(normalize(cameraPosition - vW).y), 3.0); col += vec3(0.6, 0.7, 0.9) * fr * 0.25;\n' +
      ' if (moon > 0.5) { float mr = length(vP + vec2(sin(t * 0.7) * 0.05, cos(t * 0.6) * 0.05) * (1.0 + w)); float disc = 1.0 - smoothstep(0.75, 0.95, mr + (w - 0.5) * 0.25); col += vec3(1.0, 0.97, 0.88) * disc * 1.6 * mk + vec3(0.75, 0.7, 1.0) * exp(-mr * mr * 0.25) * 0.5 * mk * ring; }\n' +
      ' gl_FragColor = vec4(col, 0.92); }',
    transparent: true, depthWrite: false,
  });
}
// 壁畫：畫在一塊靠著洞壁的石板上（四種線索各自的圖案）
function caveMuralTex(id) {
  return caveTex('mural_' + id, 512, 320, (g, w, h) => {
    const gr = g.createLinearGradient(0, 0, w, h); gr.addColorStop(0, '#8c7a66'); gr.addColorStop(1, '#6c5b4a'); g.fillStyle = gr; g.fillRect(0, 0, w, h);
    g.globalAlpha = .25; for (let i = 0; i < 160; i++) { g.fillStyle = i % 2 ? '#4b3d30' : '#b3a38f'; g.fillRect((i * 97) % w, (i * 61) % h, 3 + (i % 7), 2); } g.globalAlpha = 1;
    g.lineWidth = 7; g.lineCap = 'round'; g.lineJoin = 'round'; const ink = '#f3e3c4', ochre = '#e0a458';
    const dot = (x, y, r, c) => { g.fillStyle = c; g.beginPath(); g.arc(x, y, r, 0, 6.3); g.fill(); };
    if (id === 'sea') { g.strokeStyle = ink; for (let k = 0; k < 3; k++) { g.beginPath(); for (let x = 40; x <= 470; x += 10) g.lineTo(x, 230 + k * 22 + Math.sin(x * .05 + k) * 9); g.stroke(); } const C = ['#f97316', null, null, '#22c55e']; [0, 1, 2, 3].forEach(i => { const x = 110 + i * 100; g.strokeStyle = ink; g.beginPath(); g.arc(x, 150, 30, 0, 6.3); g.stroke(); if (C[i]) dot(x, 150, 22, C[i]); else { g.fillStyle = ink; g.font = '700 40px serif'; g.textAlign = 'center'; g.fillText('?', x, 164); } g.fillStyle = ink; g.font = '700 30px serif'; g.textAlign = 'center'; g.fillText(['一', '二', '三', '四'][i], x, 95); }); }
    else if (id === 'lava') { [0, 1, 2, 3].forEach(i => { const x = 110 + i * 100; g.strokeStyle = ink; g.strokeRect(x - 26, 90, 52, 170); if (i === 0) { g.strokeStyle = '#bae6fd'; for (let k = 0; k < 5; k++) { g.beginPath(); g.moveTo(x - 20 + k * 10, 90); g.lineTo(x - 15 + k * 10, 120); g.stroke(); } } if (i === 3) { g.strokeStyle = '#fb7185'; for (let k = 0; k < 6; k++) { const a = k / 6 * 6.28; g.beginPath(); g.moveTo(x, 70); g.lineTo(x + Math.cos(a) * 22, 70 + Math.sin(a) * 22); g.stroke(); } } }); g.strokeStyle = ochre; g.beginPath(); for (let x = 40; x <= 470; x += 10) g.lineTo(x, 285 + Math.sin(x * .08) * 6); g.stroke(); }
    else if (id === 'ice') { g.strokeStyle = ink; g.beginPath(); g.moveTo(20, 280); g.lineTo(140, 120); g.lineTo(230, 200); g.lineTo(330, 90); g.lineTo(492, 280); g.stroke(); g.strokeStyle = '#c4b5fd'; g.lineWidth = 9; g.beginPath(); g.moveTo(300, 150); g.lineTo(292, 190); g.lineTo(304, 225); g.lineTo(296, 262); g.stroke(); g.lineWidth = 7; dot(410, 70, 34, ink); dot(426, 60, 30, '#7b6a56'); g.fillStyle = '#c4b5fd'; g.globalAlpha = .35; g.beginPath(); g.arc(298, 205, 46, 0, 6.3); g.fill(); g.globalAlpha = 1; }
    else { g.strokeStyle = ink; dot(256, 80, 40, ink); g.beginPath(); g.ellipse(256, 200, 150, 40, 0, 0, 6.3); g.stroke(); g.beginPath(); g.moveTo(150, 205); g.quadraticCurveTo(256, 300, 362, 205); g.stroke(); g.strokeStyle = '#c4b5fd'; for (let k = 0; k < 4; k++) { g.beginPath(); g.moveTo(230 + k * 18, 125); g.lineTo(222 + k * 18, 170); g.stroke(); } }
    g.strokeStyle = 'rgba(40,28,18,.5)'; g.lineWidth = 10; g.strokeRect(5, 5, w - 10, h - 10);
  });
}

function buildCaves() {
  if (CAVES.length) return; cavePrep();
  const sc = W.scene, N = LOW ? 8 : 14;
  CAVE_DEF.forEach((def, di) => {
    const c = def.path, T = c.T = Object.assign({}, CAVE_THEME[def.th]);
    T.rockC = caveCol(T.rock); T.rock2C = caveCol(T.rock2); T.wetC = caveCol(T.wet); T.amb = caveCol(T.amb); T.trailC = caveCol(T.trail);
    c.lightA = caveCol(PALETTE.forest.light).multiplyScalar(1.1); c.lightB = caveCol(def.to ? PALETTE[def.to].light : '#ffffff').lerp(caveCol(def.to ? PALETTE[def.to].main : '#fff'), .25);
    c.mossC = caveCol(def.th === 'lava' ? '#ffb86b' : def.th === 'ice' ? '#a5f3fc' : '#86efac'); c.lavaC = caveCol('#ff7a2e');
    c.g = new THREE.Group(); c.g.name = 'cave:' + def.id; sc.add(c.g);
    const rd = seeded(101 + di * 17), H_ = c.hallI, hx = c.X[H_], hz = c.Z[H_], hy = c.Y[H_], hw = c.Wd[H_], hh = c.Hh[H_];
    // 光柱（大廳頂上的洞）
    c.shafts = def.th === 'lava' ? [] : [{ x: hx, z: hz, r: hw * .55, k: def.th === 'moon' ? .9 : 1.15, col: caveCol(def.th === 'moon' ? '#c7d2fe' : def.th === 'ice' ? '#e0f2fe' : '#fff3d6') }];
    // 苔蘚：窄道與大廳邊緣的幾叢（光照烘進牆上；每叢可以摘，06）
    c.moss = []; const mossS = [c.sIn - 2, (c.sIn + c.S[H_]) / 2, c.S[H_] - hw * .6, c.dead ? c.L - 6 : (c.S[H_] + c.L) / 2 - 6];
    mossS.forEach((s, mi) => { const i = Math.min(c.n - 1, Math.max(0, Math.round(s / CAVE_STEP))), side = mi % 2 ? 1 : -1, w = c.Wd[i] * .9; c.moss.push({ x: c.X[i] + -c.TZ[i] * side * w, z: c.Z[i] + c.TX[i] * side * w, y: c.Y[i] + .35, i, side, s: c.S[i] }); });
    // 熔岩溝：牆邊一條發光的溝（只是光源，不能踩、也不扣血，4.2）
    if (def.th === 'lava') c.lava = { s0: CAVE_L0 + 8, s1: c.L - CAVE_L0 - 8, l: -.78 };
    // 冰洞大廳：地面往下挖，鋪一層半透明的冰面，冰柱的倒影就在冰面底下（4.3）
    if (def.th === 'ice') { const s0 = c.S[H_]; c.drop = s => 2.6 * smooth(hw * 1.1, hw * .55, Math.abs(s - s0)); c.iceS = s0; }
    c.mat = new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.DoubleSide });
    if (def.th === 'lava') { c.mat.onBeforeCompile = sh => { sh.uniforms.uHt = W.wind; sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nuniform float uHt;').replace('#include <begin_vertex>', '#include <begin_vertex>\n{ vec4 hwp = modelMatrix * vec4(position, 1.0); float hd = distance(hwp.xyz, cameraPosition); transformed.xz += vec2(sin(uHt * 2.3 + position.y * 2.7 + position.x * 0.7), cos(uHt * 1.9 + position.y * 2.1 + position.z * 0.7)) * 0.08 * smoothstep(7.0, 24.0, hd); }'); }; c.mat.customProgramCacheKey = () => 'caveHeat'; }
    const iIn = Math.round((c.sIn + 4) / CAVE_STEP), iOut = c.dead ? c.n - 1 : Math.round((c.L - c.sIn - 4) / CAVE_STEP);
    c.g.add(caveTube(c, 0, Math.min(iIn, c.n - 1), N, 3));
    if (c.dead) { c.g.add(caveTube(c, iIn, c.n - 1, N, 2)); c.g.add(caveCap(c, N, 2)); }
    else { c.g.add(caveTube(c, iIn, iOut, N, 2)); c.g.add(caveTube(c, iOut, c.n - 1, N, 3)); }
    c.g.add(caveTrail(c));
    // 出口的亮光：從洞裡看出去是一圈亮光（只在第 2 層，走近洞口、外面的世界打開時就換成真的景色）
    c.glows = [];
    c.ends.forEach((e, k) => {
      const i = e.i, d = k ? -1 : 1, col = k ? c.lightB : c.lightA, m = new THREE.Mesh(new THREE.CircleGeometry(1, 28), new THREE.MeshBasicMaterial({ color: col.clone().multiplyScalar(1.6), map: glowTex(), transparent: true, depthWrite: false, fog: false, blending: THREE.AdditiveBlending }));
      m.position.set(c.X[i] - c.TX[i] * d * .6, c.Y[i] + c.Hh[i] * .45, c.Z[i] - c.TZ[i] * d * .6); m.lookAt(m.position.x + c.TX[i] * d, m.position.y, m.position.z + c.TZ[i] * d); m.scale.set(c.Wd[i] * 2.2, c.Hh[i] * 1.15, 1);
      m.layers.mask = 4; m.renderOrder = 3; c.g.add(m); c.glows.push(m);
    });
    // 光柱網格
    c.shafts.slice(0, LOW ? 1 : 2).forEach(sh => {
      const top = hy + hh * .97, len = hh * .97, m = new THREE.Mesh(new THREE.CylinderGeometry(sh.r * .32, sh.r * 1.05, len, 18, 1, true), caveShaftMat(sh.col, def.th === 'moon' ? .55 : .42));
      m.position.set(sh.x, top - len / 2, sh.z); m.layers.mask = 2; m.renderOrder = 4; c.g.add(m); sh.m = m;
      const hole = new THREE.Mesh(new THREE.CircleGeometry(sh.r * .36, 20), new THREE.MeshBasicMaterial({ color: sh.col.clone().multiplyScalar(1.4), fog: false })); hole.rotation.x = Math.PI / 2; hole.position.set(sh.x, top + .02, sh.z); hole.layers.mask = 2; c.g.add(hole); sh.hole = hole;
    });
    caveHall(c, def, rd);
    // 壁畫：嵌在大廳牆上的一塊石板（月光洞窟是湖邊的石碑）；石框、底座、苔蘚、岩石都合併在 caveProps
    { const i = Math.min(c.n - 1, H_ + Math.round(hw * .5 / CAVE_STEP)), side = def.th === 'sea' ? 1 : -1, w = c.Wd[i], nx = -c.TZ[i] * side, nz = c.TX[i] * side, moon = def.id === 'moon', f = moon ? .55 : .84;
      const g = new THREE.Group(); g.position.set(c.X[i] + nx * w * f, c.Y[i], c.Z[i] + nz * w * f); g.lookAt(g.position.x - nx, g.position.y, g.position.z - nz);
      const face = new THREE.Mesh(new THREE.PlaneGeometry(2.7, 1.7), new THREE.MeshBasicMaterial({ map: caveMuralTex(def.id), color: '#cdbfaa' })); face.position.set(0, moon ? 1.45 : 1.65, .03); face.rotation.x = -.06; g.add(face);
      const glow = new THREE.Mesh(new THREE.PlaneGeometry(3.6, 2.6), new THREE.MeshBasicMaterial({ color: T.light, map: glowTex(), transparent: true, opacity: .3, depthWrite: false, blending: THREE.AdditiveBlending })); glow.position.set(0, moon ? 1.45 : 1.65, .25); g.add(glow);
      caveSetLayers(g, 2); c.g.add(g); g.updateMatrixWorld(true); c.muralAt = { g, moon, i };
      const hit = hitBox(2.8, 2, .6, 0, 1.55, .3, g); hit.layers.mask = 3; addInter(hit, 'cave', 'mural:' + def.id, CAVE_MURAL[def.id].t, { cave: c }); }
    caveProps(c, def, rd);
    // 苔蘚的互動（每叢一個看不見的碰撞箱）
    c.moss.forEach((m, k) => { const hit = new THREE.Mesh(new THREE.SphereGeometry(.7, 6, 4), new THREE.MeshBasicMaterial({ visible: false })); hit.position.set(m.x, m.y + .1, m.z); hit.layers.mask = 3; c.g.add(hit); addInter(hit, 'cave', 'moss:' + def.id + ':' + k, '發光苔蘚', { cave: c }); });
    caveParticles && c.g.add(caveParticles(c, caveParticleList(c, rd)));
    caveMouth(c, def, 0); if (!c.dead) caveMouth(c, def, 1);
    CAVES.push(c);
  });
  // 地形挖洞：每個洞口直段一組（terrainMat 讀 CAVE_UA／CAVE_UB）
  let u = 0; CAVES.forEach(c => c.ends.forEach(e => { if (u >= 8) return; const i = e.i, d = e.s ? -1 : 1; CAVE_UA[u].set(c.X[i], (e.s ? c.y1 : c.y0), c.Z[i], CAVE_L0 + .4); CAVE_UB[u].set(c.TX[i] * d, c.TZ[i] * d, c.Wd[i], c.Hh[i]); u++; }));
  // 燈光與第一人稱的手：每一層都要看得到
  [W.sun, W.hemi].forEach(l => { if (l) l.layers.mask = 7; });
}
function caveParticleList(c, rd) {
  const out = [], n = LOW ? 60 : 140, H_ = c.hallI;
  for (let k = 0; k < n; k++) {
    const inHall = k < n * .6, s = inHall ? c.S[H_] + (rd() - .5) * c.Wd[H_] * 1.6 : CAVE_L0 + rd() * (c.L - CAVE_L0 * 2), i = clamp(Math.round(s / CAVE_STEP), 0, c.n - 1), w = c.Wd[i], h = c.Hh[i], l = (rd() - .5) * 2 * w * .8;
    const x = c.X[i] - c.TZ[i] * l, z = c.Z[i] + c.TX[i] * l, y0 = c.Y[i];
    if (c.T.part === 'drip') out.push({ x, y: y0 + h * .9, z, h: h * .9 });
    else if (c.T.part === 'spark') out.push({ x, y: y0 + .2, z, h: h * (inHall ? 1 : .6) });
    else if (c.T.part === 'glint') out.push({ x, y: y0 + rd() * h * .9, z, h: 0 });
    else out.push({ x, y: y0 + .6 + rd() * h * .7, z, h: .8 });
  }
  return out;
}
// 大廳的看點：潮池與水光、熱氣與火星光帶、冰柱與倒影、月光地下湖
function caveHall(c, def, rd) {
  const H_ = c.hallI, hx = c.X[H_], hz = c.Z[H_], hy = c.Y[H_], hw = c.Wd[H_], hh = c.Hh[H_];
  if (def.th === 'sea') {
    const pool = new THREE.Mesh(new THREE.CircleGeometry(hw * .5, 36), caveWaterMat('#7dd3fc', '#0e3a4d', false)); pool.rotation.x = -Math.PI / 2; pool.position.set(hx, hy + .04, hz); pool.layers.mask = 2; pool.renderOrder = 1; c.g.add(pool); c.pool = { x: hx, z: hz, r: hw * .5 - .2 };
    // 頂上晃動的水光（潮池反射上去的光紋，4.1）
    const R = hw * .95, cau = new THREE.Mesh(new THREE.CircleGeometry(R, 32), new THREE.ShaderMaterial({ uniforms: { t: W.wind, c: { value: new THREE.Color('#a5ecff') } },
      vertexShader: 'varying vec2 vP; void main(){ vP = position.xy; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
      fragmentShader: 'uniform float t; uniform vec3 c; varying vec2 vP; float h(vec2 p){ return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); } float n(vec2 p){ vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f); return mix(mix(h(i), h(i + vec2(1, 0)), f.x), mix(h(i + vec2(0, 1)), h(i + vec2(1, 1)), f.x), f.y); } void main(){ vec2 p = vP * 0.8; float a = n(p + vec2(t * 0.31, t * 0.22)), b = n(p * 1.37 - vec2(t * 0.27, -t * 0.29) + 4.0); float k = pow(max(0.0, 1.0 - abs(a - b) * 2.3), 6.0); float f = 1.0 - smoothstep(0.35, 1.0, length(vP) / ' + R.toFixed(2) + '); gl_FragColor = vec4(c * k * f * 0.6, 1.0); }',
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide }));
    cau.rotation.x = Math.PI / 2; cau.position.set(hx, hy + hh * .84, hz); cau.layers.mask = 2; c.g.add(cau);
    // 退潮留下的小水窪（踩過會濺起水花）
    c.puddles = []; for (let s = CAVE_L0 + 4; s < c.L - CAVE_L0 - 4; s += rnd(7, 11)) { if (Math.abs(s - c.S[H_]) < hw * 1.2) continue; const i = Math.round(s / CAVE_STEP), l = (rd() - .5) * c.Wd[i] * .8; c.puddles.push({ x: c.X[i] - c.TZ[i] * l, z: c.Z[i] + c.TX[i] * l, y: c.Y[i] + .03, r: rnd(.45, .8) }); }
    const pg = c.puddles.map(p => { const g = new THREE.CircleGeometry(p.r, 14); g.rotateX(-Math.PI / 2); g.translate(p.x, p.y, p.z); return g; });
    if (pg.length) { const geo = mergeGeos(pg), pm = new THREE.Mesh(geo, caveWaterMat('#3f86a3', '#0b2230', false)); pm.layers.mask = 3; pm.renderOrder = 1; c.g.add(pm); }
  } else if (def.th === 'lava') {
    // 熔岩溝：沿牆的一條發光帶
    const pos = [], uv = [], idx = []; let k = 0;
    for (let s = c.lava.s0; s <= c.lava.s1; s += 1) { const i = Math.round(s / CAVE_STEP), w = c.Wd[i], nx = -c.TZ[i], nz = c.TX[i], l0 = c.lava.l * w - .35, l1 = c.lava.l * w + .35, y = c.Y[i] + .06; pos.push(c.X[i] + nx * l0, y, c.Z[i] + nz * l0, c.X[i] + nx * l1, y, c.Z[i] + nz * l1); uv.push(s / 3, 0, s / 3, 1); if (k) idx.push(2 * k - 2, 2 * k - 1, 2 * k, 2 * k - 1, 2 * k + 1, 2 * k); k++; }
    const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); geo.setIndex(idx);
    const mat = new THREE.ShaderMaterial({ uniforms: { t: W.wind }, vertexShader: 'varying vec2 vU; void main(){ vU = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
      fragmentShader: 'uniform float t; varying vec2 vU; float h(vec2 p){ return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); } float n(vec2 p){ vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f); return mix(mix(h(i), h(i + vec2(1, 0)), f.x), mix(h(i + vec2(0, 1)), h(i + vec2(1, 1)), f.x), f.y); } void main(){ vec2 p = vec2(vU.x * 3.0 - t * 0.35, vU.y * 2.0); float a = n(p * 1.7) * 0.6 + n(p * 4.3 + 7.0) * 0.4; float e = smoothstep(0.0, 0.25, vU.y) * smoothstep(1.0, 0.75, vU.y); vec3 c = mix(vec3(0.55, 0.06, 0.02), vec3(1.0, 0.62, 0.12), smoothstep(0.35, 0.8, a)); c += vec3(1.0, 0.9, 0.5) * pow(a, 5.0) * 1.5; gl_FragColor = vec4(c * (0.45 + 0.75 * e), 1.0); }' });
    const m = new THREE.Mesh(geo, mat); m.layers.mask = 2; c.g.add(m);
    // 熱氣往上：大廳中央一道淡淡的橘色光帶（火星由粒子帶上去）
    const haze = new THREE.Mesh(new THREE.CylinderGeometry(hw * .35, hw * .55, hh * .95, 16, 1, true), caveShaftMat('#ff9a4d', .16)); haze.position.set(hx, hy + hh * .47, hz); haze.layers.mask = 2; c.g.add(haze);
  } else if (def.th === 'ice') {
    const s0 = c.iceS, list = [], refl = [], ice = new THREE.Mesh(new THREE.CircleGeometry(hw * .95, 40), new THREE.MeshBasicMaterial({ color: '#bfe1f7', transparent: true, opacity: .74, depthWrite: false }));
    ice.rotation.x = -Math.PI / 2; ice.position.set(hx, hy + .02, hz); ice.layers.mask = 2; ice.renderOrder = 2; c.g.add(ice);
    for (let k = 0; k < (LOW ? 9 : 16); k++) { const a = rd() * 6.283, r = Math.sqrt(rd()) * hw * .8, x = hx + Math.cos(a) * r, z = hz + Math.sin(a) * r, len = rnd(1.4, 3.4), top = hy + hh * .95; list.push({ x, y: top - len / 2, z, s: rnd(.16, .3), sy: len / (rnd(.16, .3)), rx: Math.PI }); refl.push({ x, y: hy - .02 - len / 2 * .8, z, s: .22, sy: len * .8 / .22 }); }
    const im = new THREE.MeshBasicMaterial({ color: '#e6f6ff' }), a = instances(new THREE.ConeGeometry(1, 1, 6), im, list, false), b = instances(new THREE.ConeGeometry(1, 1, 6), new THREE.MeshBasicMaterial({ color: '#5d8fb5', transparent: true, opacity: .55 }), refl, false);
    a.layers.mask = 2; b.layers.mask = 2; c.g.add(a, b);
  } else if (def.th === 'moon') {
    const R = Math.min(hw * .55, 5.2), lake = new THREE.Mesh(new THREE.CircleGeometry(R, 48), caveWaterMat('#a5b4fc', '#0f1035', true));
    lake.rotation.x = -Math.PI / 2; lake.position.set(hx, hy + .05, hz); lake.layers.mask = 2; lake.renderOrder = 1; c.g.add(lake); c.lake = { x: hx, z: hz, r: R, m: lake };
    // 洞頂的螢光蟲：一點一點慢慢閃（像星空，月光洞窟的大廳）
    const gw = []; for (let k = 0; k < (LOW ? 50 : 120); k++) { const s = c.S[H_] + (rd() - .5) * hw * 2.2, i = clamp(Math.round(s / CAVE_STEP), 0, c.n - 1), lf = (rd() - .5) * 1.6; gw.push({ x: c.X[i] - c.TZ[i] * lf * c.Wd[i] * .9, y: c.Y[i] + c.Hh[i] * (.97 - .38 * lf * lf), z: c.Z[i] + c.TX[i] * lf * c.Wd[i] * .9, h: 0 }); }
    c.g.add(caveParticles(c, gw, 'glint', '#8ff5ff', .8));
  }
}
// 洞裡的小東西：每個洞一種個性。全部合併成「洞口兩段」與「深處」兩個網格（各 1 次繪製），光照一樣烘進頂點顏色
function caveStarGeo() {
  const sh = new THREE.Shape(); for (let k = 0; k <= 10; k++) { const a = k / 10 * Math.PI * 2 + Math.PI / 2, r = k % 2 ? .42 : 1; k ? sh.lineTo(Math.cos(a) * r, Math.sin(a) * r) : sh.moveTo(Math.cos(a) * r, Math.sin(a) * r); }
  const g = new THREE.ExtrudeGeometry(sh, { depth: .35, bevelEnabled: false }); g.rotateX(-Math.PI / 2); return g;
}
function caveProps(c, def, rd) {
  const G0 = caveProps.G || (caveProps.G = { rock: new THREE.IcosahedronGeometry(1, 0), cone4: new THREE.ConeGeometry(1, 1, 4), cone: new THREE.ConeGeometry(1, 1, 5), cone6: new THREE.ConeGeometry(1, 1, 6), oct: new THREE.OctahedronGeometry(1, 0), ico: new THREE.IcosahedronGeometry(1, 0), hex: new THREE.CylinderGeometry(1, 1, 1, 6), cyl: new THREE.CylinderGeometry(1, 1, 1, 5), sph: new THREE.SphereGeometry(1, 7, 4), box: new THREE.BoxGeometry(1, 1, 1), star: caveStarGeo(), dome: new THREE.SphereGeometry(1, 8, 3, 0, Math.PI * 2, 0, Math.PI / 2), disc: new THREE.CircleGeometry(1, 9).rotateX(-Math.PI / 2) });
  const th = def.th, T = c.T, near = [], deep = [], L = c.L, dead = c.dead, LQ = LOW ? .4 : 1, r = (a, b) => a + rd() * (b - a);
  const at = (s, lf, yr) => { s = clamp(s, 0, L); const i = clamp(Math.round(s / CAVE_STEP), 0, c.n - 1), w = c.Wd[i]; return { s, i, w, h: c.Hh[i], x: c.X[i] - c.TZ[i] * lf * w, y: c.Y[i] + yr, z: c.Z[i] + c.TX[i] * lf * w, ry: Math.atan2(c.TX[i], c.TZ[i]) }; };
  const add = (geo, col, p, rx, ry, rz, sx, sy = sx, sz = sx, glow = false) => ((p.s < c.sIn + 3 || (!dead && p.s > L - c.sIn - 3)) ? near : deep).push([geo, col, M4(p.x, p.y, p.z, rx, ry, rz, sx, sy, sz), glow, p.i]);
  const rockC = () => T.rockC.clone().lerp(T.rock2C, rd() * .6).multiplyScalar(r(.8, 1.15));
  const s0 = CAVE_L0 + 1.2, s1 = dead ? L - 1 : L - CAVE_L0 - 1.2, hallS = c.S[c.hallI], hw = c.Wd[c.hallI], inHall = s => Math.abs(s - hallS) < hw * 1.1;
  // 共通：牆腳的大石頭、地上的碎石、鐘乳石與石筍
  for (let s = s0; s < s1; s += r(2, 3.2) / LQ) {
    for (const side of [-1, 1]) { if (rd() < .45) continue; const p = at(s + r(-.6, .6), side * r(.8, .93), 0), k = clamp(p.w / 2, .45, 1.7) * r(.26, .55); add(G0.rock, rockC(), p, rd() * 3, rd() * 3, rd() * 3, k * 1.2, k * r(.45, .85), k); }
    for (let k = 0; k < (LOW ? 0 : 2); k++) { const p = at(s + r(-1, 1), r(-.75, .75), .02); add(G0.oct, rockC().multiplyScalar(.9), p, rd() * 3, rd() * 3, 0, r(.05, .13), r(.03, .07), r(.05, .12)); }
    if (rd() < (th === 'ice' ? .95 : .6)) { const p = at(s, r(-.65, .65), 0); p.y += p.h * r(.86, .95) - (inHall(s) ? 0 : .1); const len = th === 'ice' ? r(.6, 2.2) : r(.35, 1.4), wd = th === 'ice' ? r(.07, .16) : r(.09, .2); p.y -= len / 2; add(th === 'ice' ? G0.cone6 : G0.cone, th === 'ice' ? T.rock2C.clone().lerp(caveCol('#ffffff'), .5) : rockC().multiplyScalar(.85), p, Math.PI, rd() * 3, 0, wd, len, wd); }
    if (rd() < .22) { const p = at(s, (rd() < .5 ? -1 : 1) * r(.55, .8), 0), len = r(.3, .9); p.y += len / 2; add(G0.cone, rockC(), p, 0, rd() * 3, 0, r(.1, .2), len, r(.1, .2)); }
  }
  // 苔蘚（會發光，可以摘）
  c.moss.forEach(m => { for (let k = 0; k < (LOW ? 6 : 11); k++) { const p = { s: m.s, i: m.i, x: m.x + r(-.5, .5) * Math.abs(c.TX[m.i]) + r(-.25, .25), y: m.y + r(-.35, .6), z: m.z + r(-.5, .5) * Math.abs(c.TZ[m.i]) + r(-.25, .25) }; add(G0.oct, c.mossC.clone().multiplyScalar(r(1, 1.35)), p, rd() * 3, rd() * 3, 0, r(.07, .16), r(.04, .09), r(.07, .16), true); } });
  // 壁畫的石框（月光洞窟是一座石碑）
  if (c.muralAt) { const g = c.muralAt.g, M = new THREE.Matrix4(), push = (geo, col, lx, ly, lz, sx, sy, sz, rx = 0, ry = 0, rz = 0) => { M.copy(g.matrixWorld).multiply(M4(lx, ly, lz, rx, ry, rz, sx, sy, sz)); deep.push([geo, col, M.clone(), false, c.muralAt.i]); };
    if (c.muralAt.moon) { push(G0.box, T.rockC.clone().multiplyScalar(1.1), 0, 1.45, -.27, 3.05, 2.2, .5); push(G0.box, T.rockC.clone().multiplyScalar(.9), 0, .22, -.2, 3.4, .44, .9); for (let k = 0; k < 6; k++) push(G0.oct, caveCol('#b9a6ff'), r(-1.6, 1.6), .2, r(.2, .6), .1, r(.3, .6), .1, 0, rd() * 3, r(-.3, .3)); }
    else { push(G0.box, T.rockC.clone().multiplyScalar(.85), 0, 1.65, -.2, 3.1, 2.1, .36); for (let k = 0; k < 12; k++) { const a = k / 12 * Math.PI * 2; push(G0.rock, rockC(), Math.cos(a) * 1.62, 1.65 + Math.sin(a) * 1.12, -.05, r(.22, .38), r(.18, .3), .25, rd() * 3, rd() * 3, 0); } }
  }
  if (th === 'sea') {
    for (let s = s0; s < s1; s += r(5, 8) / LQ) { const side = rd() < .5 ? -1 : 1; for (let k = 0; k < (LOW ? 2 : 5); k++) { const p = at(s + r(-.6, .6), side * r(.86, .95), r(.3, 1.3)); add(G0.cone4, caveCol(['#d8d0bf', '#cfc6b4', '#e7dfcf'][k % 3]), p, -Math.PI / 2 * side * .9, p.ry, 0, r(.04, .08), r(.05, .11), r(.04, .08)); } } // 藤壺
    for (let k = 0; k < 16 * LQ; k++) { const p = at(r(s0, s1), (rd() < .5 ? -1 : 1) * r(.5, .85), .03); add(G0.ico, caveCol(['#f5d0c5', '#fde4cf', '#e7d9c7', '#fbcfe8'][k % 4]), p, 0, rd() * 3, 0, r(.06, .12), r(.025, .05), r(.06, .1)); } // 貝殼
    for (let k = 0; k < 10 * LQ; k++) { const p = at(r(s0, s1), r(-.6, .6), .015); add(G0.disc, caveCol('#cdbb8f'), p, 0, rd() * 3, 0, r(.5, 1.1), 1, r(.4, .9)); } // 沙地
    const pr = c.pool ? c.pool.r : 3; for (let k = 0; k < 18; k++) { const a = k / 18 * Math.PI * 2 + r(-.1, .1), p = { s: hallS, i: c.hallI, x: c.pool.x + Math.cos(a) * (pr + .25), y: c.Y[c.hallI] + .05, z: c.pool.z + Math.sin(a) * (pr + .25) }; add(G0.rock, rockC().multiplyScalar(.85), p, rd() * 3, rd() * 3, 0, r(.25, .45), r(.14, .24), r(.22, .4)); }
    for (let k = 0; k < 6; k++) { const a = rd() * Math.PI * 2, p = { s: hallS, i: c.hallI, x: c.pool.x + Math.cos(a) * (pr + r(.6, 1.6)), y: c.Y[c.hallI] + .03, z: c.pool.z + Math.sin(a) * (pr + r(.6, 1.6)) }; add(G0.star, caveCol(['#fb923c', '#f472b6', '#facc15'][k % 3]), p, 0, rd() * 6, 0, r(.13, .2), .4, r(.13, .2), true); } // 海星
    for (let k = 0; k < 9; k++) { const a = rd() * Math.PI * 2, d = pr + r(.4, 1.2), x = c.pool.x + Math.cos(a) * d, z = c.pool.z + Math.sin(a) * d, col = caveCol(['#fb7185', '#fdba74', '#f9a8d4'][k % 3]), hgt = r(.25, .6); add(G0.cyl, col, { s: hallS, i: c.hallI, x, y: c.Y[c.hallI] + hgt / 2, z }, r(-.3, .3), 0, r(-.3, .3), .04, hgt, .04, true); add(G0.ico, col, { s: hallS, i: c.hallI, x, y: c.Y[c.hallI] + hgt, z }, 0, 0, 0, .07, .07, .07, true); } // 珊瑚
    for (const [sa, sb] of [[CAVE_L0 * .3, c.sIn], [L - c.sIn, L - CAVE_L0 * .3]]) for (let k = 0; k < 10 * LQ; k++) { const p = at(r(sa, sb), r(-.8, .8), 0), len = r(.5, 1.3); p.y += p.h * .9 - len / 2; add(G0.box, caveCol(['#4d7c3a', '#6b8f4e', '#3f6b4a'][k % 3]), p, r(-.1, .1), p.ry + r(-.5, .5), r(-.15, .15), .05, len, .14); } // 洞口的海草
  } else if (th === 'lava') {
    for (let k = 0; k < 26 * LQ; k++) { const s = inHall(hallS) && k < 14 ? hallS + r(-hw, hw) : r(s0, s1), p = at(s, (rd() < .5 ? -1 : 1) * r(.72, .9), 0), hgt = inHall(s) ? r(1.2, 4.2) : r(.6, 2), rr = r(.22, .42); p.y += hgt / 2; add(G0.hex, caveCol('#3b2b27').multiplyScalar(r(.85, 1.15)), p, r(-.06, .06), rd(), r(-.06, .06), rr, hgt, rr); } // 玄武岩柱
    for (let k = 0; k < 18 * LQ; k++) { const p = at(r(s0, s1), (rd() < .5 ? -1 : 1) * r(.45, .8), .1); add(G0.oct, caveCol('#2d1f3d'), p, r(-.5, .5), rd() * 3, r(-.5, .5), r(.06, .12), r(.2, .45), r(.06, .12)); } // 黑曜石碎片
    for (let s = c.lava.s0; s < c.lava.s1; s += r(1.4, 2.6) / LQ) { const p = at(s, c.lava.l * r(.92, 1.05) + .18, .08); add(G0.ico, caveCol(rd() < .5 ? '#ff8a3d' : '#ffb35c'), p, rd() * 3, rd() * 3, 0, r(.07, .14), r(.05, .09), r(.07, .14), true); } // 熔岩溝邊的餘燼石
    for (let k = 0; k < 8 * LQ; k++) { const p = at(r(s0, s1), r(-.4, .5), .012); add(G0.disc, caveCol('#2a1d1a'), p, 0, rd() * 3, 0, r(.5, 1), 1, r(.4, .8)); } // 焦黑的地面
    for (let k = 0; k < 5; k++) { const p = at(hallS + r(-hw, hw) * .6, (rd() < .5 ? -1 : 1) * r(.6, .85), r(.2, 2)); add(G0.oct, caveCol('#facc15'), p, r(-.4, .4), rd() * 3, 0, .07, .16, .07, true); } // 硫磺結晶
  } else if (th === 'ice') {
    for (let k = 0; k < 22 * LQ; k++) { const s = k < 10 ? hallS + r(-hw, hw) : r(s0, s1), side = rd() < .5 ? -1 : 1, p = at(s, side * r(.6, .9), r(0, .4)), glow = rd() < .3; for (let j = 0; j < 4; j++) add(G0.oct, glow ? caveCol('#a5f3fc') : caveCol('#d7f0ff'), { s: p.s, i: p.i, x: p.x + r(-.25, .25), y: p.y + r(0, .3), z: p.z + r(-.25, .25) }, r(-.5, .5), rd() * 3, r(-.5, .5), r(.07, .15), r(.25, .6), r(.07, .15), glow); } // 冰晶簇
    for (const [sa, sb] of [[0, c.sIn * .7], [L - c.sIn * .7, L]]) for (let k = 0; k < 9; k++) { const p = at(r(sa, sb), (rd() < .5 ? -1 : 1) * r(.4, .9), 0); add(G0.dome, caveCol('#f4f9ff'), p, 0, rd() * 3, 0, r(.5, 1.1), r(.15, .35), r(.4, .9)); } // 洞口的雪堆
    for (let k = 0; k < 24 * LQ; k++) { const p = at(r(s0, s1), (rd() < .5 ? -1 : 1) * r(.82, .97), r(.4, 3)); add(G0.oct, caveCol('#f8fdff'), p, 0, rd() * 3, 0, r(.04, .09), r(.04, .09), r(.04, .09), true); } // 凍在冰裡的氣泡
  } else if (th === 'moon') {
    const lk = c.lake, ly = c.Y[c.hallI];
    for (let k = 0; k < 24; k++) { const a = k / 24 * Math.PI * 2 + r(-.08, .08), p = { s: hallS, i: c.hallI, x: lk.x + Math.cos(a) * (lk.r + .2), y: ly + .04, z: lk.z + Math.sin(a) * (lk.r + .2) }; add(G0.rock, caveCol('#4c4775').multiplyScalar(r(.8, 1.1)), p, rd() * 3, rd() * 3, 0, r(.25, .45), r(.12, .22), r(.22, .42)); }
    for (let k = 0; k < 14 * LQ; k++) { const s = k < 8 ? hallS + r(-hw, hw) * .9 : r(s0, s1), p = at(s, (rd() < .5 ? -1 : 1) * r(.62, .9), 0); for (let j = 0; j < 5; j++) add(G0.oct, caveCol(rd() < .5 ? '#c4b5fd' : '#a78bfa'), { s: p.s, i: p.i, x: p.x + r(-.3, .3), y: p.y + r(.1, .4), z: p.z + r(-.3, .3) }, r(-.45, .45), rd() * 3, r(-.45, .45), r(.06, .13), r(.25, .7), r(.06, .13), true); } // 紫水晶
    for (let k = 0; k < 16 * LQ; k++) { const a = rd() * Math.PI * 2, d = lk.r + r(.7, 2.6), x = lk.x + Math.cos(a) * d, z = lk.z + Math.sin(a) * d, hgt = r(.12, .32), col = caveCol(rd() < .55 ? '#67e8f9' : '#f0abfc'), q = { s: hallS, i: c.hallI }; add(G0.cyl, caveCol('#e7e5f5'), Object.assign({ x, y: ly + hgt / 2, z }, q), 0, 0, 0, .025, hgt, .025, true); add(G0.dome, col, Object.assign({ x, y: ly + hgt - .01, z }, q), 0, 0, 0, r(.07, .14), r(.05, .09), r(.07, .14), true); } // 會發光的小蘑菇
    for (let k = 0; k < 12 * LQ; k++) { const a = rd() * Math.PI * 2, d = lk.r + r(1.2, 3.4), q = { s: hallS, i: c.hallI, x: lk.x + Math.cos(a) * d, y: ly + .12, z: lk.z + Math.sin(a) * d }; add(G0.oct, caveCol('#fdfcff'), q, 0, rd() * 3, 0, .05, .05, .05, true); } // 月光花
  }
  const A = new THREE.Vector3(), B = new THREE.Vector3(), C = new THREE.Vector3(), E1 = new THREE.Vector3(), E2 = new THREE.Vector3(), N = new THREE.Vector3(), tc = new THREE.Color(), base = new THREE.Color();
  const bake = (list, mask) => {
    if (!list.length) return; let tot = 0; const gs = list.map(([g0, col, m, glow, hi]) => { const g = g0.index ? g0.toNonIndexed() : g0.clone(); g.applyMatrix4(m); tot += g.attributes.position.count; return [g, col, glow, hi]; });
    const pos = new Float32Array(tot * 3), cl = new Float32Array(tot * 3); let o = 0;
    gs.forEach(([g, col, glow, hi]) => {
      const p = g.attributes.position.array; base.copy(col);
      for (let t = 0; t + 8 < p.length; t += 9) {
        A.fromArray(p, t); B.fromArray(p, t + 3); C.fromArray(p, t + 6); N.crossVectors(E1.subVectors(B, A), E2.subVectors(C, A)).normalize();
        let rr, gg, bb;
        if (glow) { const k = 1.05 + .2 * N.y; rr = base.r * k; gg = base.g * k; bb = base.b * k; }
        else { const cx = (A.x + B.x + C.x) / 3, cy = (A.y + B.y + C.y) / 3, cz = (A.z + B.z + C.z) / 3, q = caveQ(c, cx, cz, hi); caveLight(c, q.s, cx, cy, cz, clamp((cy - q.y) / q.h, 0, 1), tc); const k = .66 + .34 * N.y; rr = base.r * tc.r * k; gg = base.g * tc.g * k; bb = base.b * tc.b * k; }
        for (let v = 0; v < 3; v++) { pos[o] = p[t + v * 3]; pos[o + 1] = p[t + v * 3 + 1]; pos[o + 2] = p[t + v * 3 + 2]; cl[o] = rr; cl[o + 1] = gg; cl[o + 2] = bb; o += 3; }
      }
      g.dispose();
    });
    const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.BufferAttribute(pos, 3)); geo.setAttribute('color', new THREE.BufferAttribute(cl, 3)); geo.computeBoundingSphere();
    const m = new THREE.Mesh(geo, c.mat); m.layers.mask = mask; c.g.add(m); c.propTris = (c.propTris || 0) + tot / 3;
  };
  bake(near, 2); bake(deep, 2);
}
function mergeGeos(list) {
  let n = 0; const ps = [], ix = []; list.forEach(g => { const p = g.attributes.position, id = g.index; for (let i = 0; i < p.count; i++) ps.push(p.getX(i), p.getY(i), p.getZ(i)); if (id) for (let i = 0; i < id.count; i++) ix.push(id.getX(i) + n); n += p.count; g.dispose(); });
  const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.Float32BufferAttribute(ps, 3)); geo.setIndex(ix); geo.computeBoundingSphere(); return geo;
}
// 洞口：岩石拱門＋告示牌（能量門、寒氣、月光洞窟的裂縫在 game.js 的 buildGates）
function caveMouth(c, def, k) {
  const i = k ? c.n - 1 : 0, d = k ? -1 : 1, tx = c.TX[i] * d, tz = c.TZ[i] * d, nx = -tz, nz = tx, x0 = c.X[i], z0 = c.Z[i], y0 = c.Y[i], w = c.Wd[i], h = c.Hh[i], rd = seeded(7 + k * 3 + c.n);
  const parts = [], rc = caveCol(c.T.rock).lerp(caveCol('#857a6c'), .62), geo = new THREE.DodecahedronGeometry(1, 0);
  // 沿著斷面外緣堆一圈石頭（從洞口往裡 0～2 公尺），把管子的邊緣和地形的切口蓋住
  // 兩圈互相重疊的石頭（內圈貼著洞口、外圈更大），頂上壓一塊楣石：從外面看是一個實心的岩石拱門
  const prof = caveProfile(28).filter(([, py]) => py > .04), sc = def.dead ? .7 : 1;
  prof.forEach(([px, py], j) => { for (let t = -.25; t < 2.2; t += .8) { const r = rnd(.55, .9) * sc, ox = px * (w + r * .45), oy = py * (h + r * .35); parts.push([geo, rc.clone().multiplyScalar(.78 + rd() * .3), M4(x0 + nx * ox + tx * t, y0 + oy, z0 + nz * ox + tz * t, rd() * 3, rd() * 3, rd() * 3, r * 1.2, r, r * 1.15)]); } });
  prof.filter((_, j) => j % 2 === 0).forEach(([px, py]) => { const r = rnd(.9, 1.4) * sc, ox = px * (w + r * 1.15), oy = py * (h + r * .9); parts.push([geo, rc.clone().multiplyScalar(.72 + rd() * .3), M4(x0 + nx * ox + tx * rnd(.2, 1.4), y0 + oy - r * .2, z0 + nz * ox + tz * rnd(.2, 1.4), rd() * 3, rd() * 3, rd() * 3, r * 1.25, r * .95, r * 1.2)]); });
  parts.push([geo, rc.clone().multiplyScalar(.8), M4(x0 + tx * .5, y0 + h + .55 * sc, z0 + tz * .5, .1, Math.atan2(nx, nz), 0, (w + 1) * sc, .75 * sc, 1.1 * sc)]); // 楣石
  for (let s = -1; s <= 1; s += 2) parts.push([geo, rc.clone().multiplyScalar(.85), M4(x0 + nx * s * (w + 1.3) - tx * .3, y0 + .5, z0 + nz * s * (w + 1.3) - tz * .3, 0, rd() * 3, 0, 1.4 * sc, 1.05 * sc, 1.25 * sc)]);
  const lip = prof.filter(([, py]) => py > .72), cone = new THREE.ConeGeometry(1, 1, 6), sph = new THREE.SphereGeometry(1, 6, 4), bx = new THREE.BoxGeometry(1, 1, 1);
  if (def.th === 'ice') lip.forEach(([px, py]) => { for (let t = -.1; t < 1.4; t += .7) { const len = rnd(.5, 1.6), x = x0 + nx * px * w * .96 + tx * t, z = z0 + nz * px * w * .96 + tz * t; parts.push([cone, '#e3f4ff', M4(x, y0 + py * h - len / 2 + .1, z, Math.PI, 0, 0, rnd(.08, .16), len, rnd(.08, .16))]); } }); // 冰柱
  if (def.th === 'ice') prof.filter(([, py]) => py > .5).forEach(([px, py]) => parts.push([sph, '#f6fbff', M4(x0 + nx * px * (w + .9) + tx * .6, y0 + py * (h + .9) + .25, z0 + nz * px * (w + .9) + tz * .6, 0, rd() * 3, 0, rnd(.6, 1), rnd(.18, .3), rnd(.6, 1))])); // 雪
  if (def.th === 'sea') { for (let k = 0; k < 26; k++) { const [px, py] = prof[Math.floor(rd() * prof.length)], o = w + rnd(.3, .9); parts.push([k % 3 ? cone : sph, ['#e8e1d2', '#d6ccb8', '#f3d9cf'][k % 3], M4(x0 + nx * px * o - tx * rnd(0, .4), y0 + py * (h + .5), z0 + nz * px * o - tz * rnd(0, .4), rd() * 3, rd() * 3, rd() * 3, rnd(.06, .12), rnd(.06, .14), rnd(.06, .12))]); }
    lip.forEach(([px, py]) => { const len = rnd(.6, 1.3); parts.push([bx, ['#4d7c3a', '#6b8f4e'][Math.floor(rd() * 2)], M4(x0 + nx * px * w * .95 - tx * .2, y0 + py * h - len / 2 + .15, z0 + nz * px * w * .95 - tz * .2, 0, Math.atan2(tx, tz) + rnd(-.4, .4), rnd(-.1, .1), .06, len, .16)]); }); } // 貝殼、藤壺、海草
  if (def.th === 'lava') for (let k = 0; k < 10; k++) { const [px, py] = prof[Math.floor(rd() * prof.length)]; parts.push([sph, '#2b211d', M4(x0 + nx * px * (w + .5) - tx * .2, y0 + py * (h + .4), z0 + nz * px * (w + .5) - tz * .2, 0, 0, 0, rnd(.3, .6), rnd(.2, .35), rnd(.3, .6))]); } // 燻黑的岩石
  if (def.th === 'moon') for (let k = 0; k < 9; k++) { const [px, py] = prof[Math.floor(rd() * prof.length)]; parts.push([new THREE.OctahedronGeometry(1, 0), ['#a78bfa', '#c4b5fd'][k % 2], M4(x0 + nx * px * (w + .35) - tx * .3, y0 + py * (h + .3), z0 + nz * px * (w + .35) - tz * .3, rnd(-.4, .4), rd() * 3, rnd(-.4, .4), rnd(.07, .13), rnd(.25, .5), rnd(.07, .13))]); } // 裂縫邊的紫水晶
  const arch = new THREE.Mesh(mergeParts(parts), new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: .95, metalness: 0 })); arch.castShadow = !LOW; arch.receiveShadow = true; arch.layers.mask = 1; c.g.add(arch);
  // 月光洞窟的裂縫：白天一塊岩石擋著，看起來只是岩壁；夜裡岩石淡去，裂縫深處透出淡紫色的光（5.1）
  if (def.night) {
    const plug = new THREE.Mesh(new THREE.BoxGeometry(w * 2.3, h * 1.05, .5), new THREE.MeshStandardMaterial({ color: rc.clone().multiplyScalar(.9), flatShading: true, roughness: 1 }));
    plug.position.set(x0 + tx * 1.1, y0 + h * .5, z0 + tz * 1.1); plug.rotation.y = Math.atan2(tx, tz); plug.layers.mask = 3; c.g.add(plug); c.plug = plug;
    const crack = new THREE.Mesh(new THREE.PlaneGeometry(w * 1.6, h * .95), new THREE.MeshBasicMaterial({ color: '#b9a6ff', map: glowTex(), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false }));
    crack.position.set(x0 + tx * 3.2, y0 + h * .5, z0 + tz * 3.2); crack.rotation.y = Math.atan2(tx, tz) + Math.PI; crack.layers.mask = 3; crack.renderOrder = 3; c.g.add(crack); c.crack = crack;
  }
  // 告示牌：洞名、通往哪裡、快速通行（2.3）
  if (def.dead) return;
  const to = k ? '月光谷中央平地' : ZONES.find(z => z.id === def.to).name, sx = x0 + nx * (w + 2.6) - tx * 2.2, sz = z0 + nz * (w + 2.6) - tz * 2.2, g = new THREE.Group(); g.position.set(sx, H(sx, sz), sz); g.rotation.y = Math.atan2(-tx, -tz); c.g.add(g);
  // 柱子立在板子兩側外面、稍微往後：任何角度看過去，字都不會被柱子擋住；字留邊界，不會被裁掉
  const tex = artTex(640, 256, (gg, ww, hh) => { woodBoard(gg, ww, hh); artText(gg, def.name, ww / 2, 90, 72, '#fde68a', ww - 90); artText(gg, '往' + to + ' →', ww / 2, 158, 46, '#fef3c7', ww - 90); artText(gg, '走過的洞：按住奔跑會更快', ww / 2, 220, 32, '#d6f5e3', ww - 90); });
  const post = std('#6b4d33', { roughness: .9 }), sm = new THREE.MeshStandardMaterial({ map: tex, roughness: .85 }), wood = woodMat('#8b6544');
  cyl(.07, .09, 2.3, 7, post, -1.08, 1.15, -.05, g); cyl(.07, .09, 2.3, 7, post, 1.08, 1.15, -.05, g); box(2, .8, .06, [wood, wood, wood, wood, sm, sm], 0, 1.75, 0, g);
  box(2.24, .07, .07, post, 0, 2.17, -.05, g); // 頂上的橫木把兩根柱子接起來
  caveSetLayers(g, 1); addCol({ x: sx, z: sz, r: .5 });
}

/* ---------- 移動：在洞裡用曲線算地面與牆壁（tryMove 一開始先問這裡） ---------- */
// 回傳 true/false＝洞裡已處理；undefined＝不在洞裡，照一般地形走
function caveMove(dx, dz) {
  if (!CAVES.length) return undefined; const nx = P.x + dx, nz = P.z + dz;
  if (!CV.c) {
    for (const c of CAVES) for (const e of c.ends) {
      if (Math.abs(nx - e.x) > 10 || Math.abs(nz - e.z) > 10) continue;
      const q = caveQ(c, nx, nz, e.i); if (q.s < 0 || q.s > c.L || Math.abs(q.l) > q.w * .95) continue;
      const dir = e.s ? -1 : 1, why = caveBlock(c, dir); if (why) { barrierMsg(why); return false; }
      caveEnter(c, dir); return caveSlide(c, caveQ(c, nx, nz, e.i), nx, nz);
    }
    return undefined;
  }
  const c = CV.c, q = caveQ(c, nx, nz, CV.i);
  if (q.s < 0 || q.s > c.L) { caveLeave(q.s > c.L ? 1 : 0); return undefined; }
  return caveSlide(c, q, nx, nz);
}
function caveSlide(c, q, nx, nz) {
  const lim = Math.max(.15, q.w * .84 - P.r);
  if (Math.abs(q.l) > lim) { const k = (Math.abs(q.l) - lim) * Math.sign(q.l); nx -= q.nx * k; nz -= q.nz * k; }
  for (const o of [c.lake, c.pool]) { if (!o) continue; const dx = nx - o.x, dz = nz - o.z, d = Math.hypot(dx, dz), R = o.r + P.r * .6; if (d < R && d > 1e-4) { nx = o.x + dx / d * R; nz = o.z + dz / d * R; } }
  P.x = nx; P.z = nz; const q2 = caveQ(c, nx, nz, q.i); CV.i = q2.i; CV.s = q2.s; CV.l = q2.l; return true;
}
function caveBlock(c, dir) {
  const def = c.def; if (dir < 0) return '';
  if (def.gate && !S.zones.includes(def.gate)) return ({ coast: '東方', volcano: '北方' }[def.gate] || '') + '能量門還封著：解開「' + GATES[def.gate].title + '」才能通過。';
  if (def.coat && !S.own.coat) return '刺骨的寒氣從冰洞裡吹出來……沒有保暖衣進不去。' + (armsOpen() ? '到大城市的武器店買一件吧。' : '升到 Lv ' + ARMS_LV + ' 後，大城市會開設武器店。');
  if (def.night && DN.night < .5) return '岩壁上有一道細細的裂縫，白天看起來只是岩石……也許夜裡再來看看？';
  return '';
}
function caveEnter(c, dir) { CV.c = c; CV.dir = dir; CV.i = dir > 0 ? 0 : c.n - 1; CV.mossT = 0; }
function caveLeave(side) {
  const c = CV.c; CV.c = null; CV.s = 0; if (!c) return;
  if (!c.dead && side === 1 && CV.dir === 1) { // 從月光谷走到新區域
    S.cave = S.cave || {}; S.cave.seen = S.cave.seen || {};
    const first = !S.cave.seen[c.id]; S.cave.seen[c.id] = 1; save();
    CV.flash = 1; if (first) { CV.lift = 1.4; W.quietZone = true; const z = ZONES.find(z => z.id === c.def.to); caveReveal(z.name, { sea: '穿過海蝕洞，白色沙灘與燈塔就在眼前', lava: '走出熔岩隧道，冒煙的火山口就在北方', ice: '走出冰洞，雪原的丘陵一片銀白' }[c.id] || ''); }
  } else if (!c.dead && side === 0 && CV.dir === -1) { S.cave = S.cave || {}; (S.cave.seen = S.cave.seen || {})[c.id] = 1; CV.flash = .7; }
}
function caveG(x, z) { const c = CV.c; if (!c) return H(x, z); const q = caveQ(c, x, z, CV.i); return q.s < -.2 || q.s > c.L + .2 || Math.abs(q.l) > q.w + 1 ? H(x, z) : q.y; }
// 走過的洞：按住奔跑會稍微加速（快速通行，2.3）；冰洞的地面比較滑（只影響停下來的距離）
function caveSpeed(run) { return CV.c && run && S.cave && S.cave.seen && S.cave.seen[CV.c.id] ? 1.3 : 1; }
function caveSlip() { return CV.c && CV.c.th === 'ice' && CV.k > .3 ? .22 : 1; }
function caveSurface() { return CV.c ? (CV.c.puddles && CV.c.puddles.some(p => Math.hypot(P.x - p.x, P.z - p.z) < p.r + .15) ? 'splash' : CV.c.th === 'ice' ? 'ice' : 'rock') : null; }

/* ---------- 每格畫面：圖層、霧、光、出口的亮光、音樂 ---------- */
const CAVE_TC = new THREE.Color(), CAVE_TC2 = new THREE.Color();
function caveEnv(dt) {
  if (!CAVES.length || !P) return;
  if (INTRO.on) { if (INTRO.inCave) { CV.c = INTRO.c; CV.s = INTRO.s; CV.i = INTRO.i || 0; CV.dir = -1; } else CV.c = null; } // 開場：山洞的霧、光、圖層跟著穿越機走
  if (TITLE.on) { if (CV.mode !== 'out') { CV.mode = 'out'; W.cam.layers.mask = 1; CAVES.forEach(o => { o.g.visible = true; }); } return; } // 主選單的環繞鏡頭不受玩家位置影響
  // 讀檔或傳送之後人在洞裡（例如存檔時正在洞裡）：找出是哪個洞
  if (!INTRO.on && !CV.c && (++CV.scanN % 20 === 0 || CV.scanNow)) for (const c of CAVES) { const q = caveQ(c, P.x, P.z, null); if (q.s > .3 && q.s < c.L - .3 && Math.abs(q.l) < q.w * .9) { caveEnter(c, q.s < c.L / 2 ? 1 : -1); CV.i = q.i; CV.s = q.s; P.y = q.y; P.vy = 0; break; } } // 山脊上走不到，人在洞的範圍裡一定是在洞裡
  if (CV.c && !INTRO.on) { const q = caveQ(CV.c, P.x, P.z, CV.i); if (q.s < -3 || q.s > CV.c.L + 3 || Math.abs(q.l) > q.w + 3) { CV.c = null; } }
  const c = CV.c, s = CV.s; let k = 0, mode = 'out';
  if (c) { k = smooth(1.5, c.sIn, s) * (c.dead ? 1 : 1 - smooth(c.L - c.sIn, c.L - 1.5, s)); mode = s > c.sIn && (c.dead || s < c.L - c.sIn) ? 'deep' : 'mouth'; }
  CV.k = k;
  if (mode !== CV.mode) {
    CV.mode = mode; W.cam.layers.mask = mode === 'deep' ? 6 : mode === 'mouth' ? 3 : 1;
    CAVES.forEach(o => { o.g.visible = mode === 'out' || o === c; }); // 在洞裡（含洞口那段）只畫目前這個洞
    if (W.sun && !LOW) W.sun.castShadow = mode !== 'deep';
    W.cam.children.forEach(ch => ch.traverse(o => { o.layers.mask = 7; })); if (W.goo && W.goo.im) W.goo.im.layers.mask = 7;
  }
  const T = c ? c.T : CV.lastT;
  if (k > .001 && T) {
    CV.lastT = T; const f = W.scene.fog; if (!CV.f0) CV.f0 = [f.near, f.far];
    f.color.copy(ENVC[0]).lerp(CAVE_TC.set(T.fog), k); W.scene.background.copy(f.color);
    f.near = CV.f0[0] + (3 - CV.f0[0]) * k; f.far = CV.f0[1] + (T.far * 1.35 - CV.f0[1]) * k;
    W.sun.intensity *= 1 - .9 * k; W.hemi.intensity += (.95 - W.hemi.intensity) * k; W.hemi.color.lerp(CAVE_TC.set(T.hemi), k); W.hemi.groundColor.lerp(CAVE_TC2.set(T.hemiG), k);
  } else if (CV.f0) { const f = W.scene.fog; f.near = CV.f0[0]; f.far = CV.f0[1]; CV.f0 = null; applyQuality(); }
  // 手（第一人稱）的環境反射：洞裡變暗（不換環境貼圖，避免重新編譯著色器）
  if (Math.abs((CV.envK || 0) - k) > .01) { CV.envK = k; W.cam.traverse(o => { const m = o.material; if (m && 'envMapIntensity' in m) m.envMapIntensity = 1 - .85 * k; }); }
  // 曝光：洞裡眼睛適應黑暗；快到出口時越走越亮，走出去的一瞬間豁然開朗，再慢慢回到正常
  let ex = 1 + .28 * k;
  if (c && !c.dead) { const toEnd = CV.dir > 0 ? c.L - s : s; ex += .55 * smooth(24, 3, toEnd) * (mode === 'deep' || toEnd < c.sIn ? 1 : 0); }
  if (CV.flash > 0) { CV.flash = Math.max(0, CV.flash - dt * .6); ex += .5 * CV.flash * CV.flash; }
  W.r.toneMappingExposure += (ex - W.r.toneMappingExposure) * Math.min(1, dt * 4);
  // 出口時鏡頭稍微抬起（第一次，2.3）
  if (CV.lift > 0 && !INTRO.on) { CV.lift = Math.max(0, CV.lift - dt); if (!GUI.kind) P.pitch += (.12 - P.pitch) * Math.min(1, dt * 1.6) * smooth(0, .5, CV.lift); }
  // 動畫：發光痕跡往出口流動、出口亮光在走近時淡出、月光洞窟
  for (const o of CAVES) {
    if (o.trailTex) o.trailTex.offset.x = -W.t * .45 * (o === c ? CV.dir : 1);
    if (o !== c && mode !== 'out') continue;
    o.glows.forEach((g, j) => { const e = o.ends[j], d = o === c ? Math.abs((e.s || 0) - s) : 99; g.material.opacity = smooth(4, 16, d) * (1 - .55 * DN.night); });
    if (o.mat) o.mat.color.setRGB(1 - .3 * DN.night, 1 - .27 * DN.night, 1 - .15 * DN.night);
  }
  caveMoonStep(dt);
}
// 月光洞窟：夜裡裂縫透出淡紫色的光；湖面的月亮只在夜晚出現，天亮時慢慢淡去（5.3）
function caveMoonStep(dt) {
  const c = CAVES.find(o => o.id === 'moon'); if (!c) return; const n = DN.night;
  if (c.lake) { const u = c.lake.m.material.uniforms.mk; u.value += (n - u.value) * Math.min(1, dt * .5); }
  if (c.crack) { c.crack.material.opacity = .15 + .85 * n; c.crack.visible = true; if (c.plug) c.plug.visible = n < .5 && CV.c !== c; } // 天亮時人還在洞裡：洞口不封起來（5.3 出口一直開著）
  c.shafts.forEach(sh => { if (sh.m) sh.m.material.uniforms.k.value = .15 + .5 * n; if (sh.hole) sh.hole.material.color.set(n > .5 ? '#c7d2fe' : '#3b3f66'); });
}
// 洞裡的配樂：進洞時淡出、換成環境音；出洞時新區域的主題曲淡入（2.2）
function caveMusic() { return 1 - .92 * CV.k; }
function caveAmb() {
  if (!CV.c || CV.k < .3) return false; const t = AC.currentTime, th = CV.c.th;
  if (th === 'sea') { swell(t, rnd(3, 4.5), 380, 1.2, .05); swell(t + rnd(.25, .4), rnd(2.5, 3.5), 300, 1, .025); AMB.t = rnd(3, 4.5); }
  else if (th === 'lava') { swell(t, rnd(2.5, 3.5), 70, .9, .085); if (Math.random() < .5) for (let i = 0; i < 3; i++) sweep(rnd(90, 160), rnd(50, 70), t + i * rnd(.08, .2), .12, .02); AMB.t = rnd(2, 3.2); }
  else if (th === 'ice') { const f = rnd(1500, 2600); tone(f, t, .08, .03); tone(f * 1.01, t + .19, .07, .012); tone(f * .99, t + .38, .06, .005); AMB.t = rnd(.9, 2.2); }
  else { swell(t, rnd(4, 6), 320, 3, .012, 'bandpass'); if (Math.random() < .3) tone(rnd(900, 1300), t + 1, .5, .006); AMB.t = rnd(4, 6); }
  return true;
}
// 指南針在洞裡只顯示「出口方向」一個標記（指向前方 12 公尺的曲線上，不會穿過岩壁指錯路，4.4）
function caveAhead() {
  const c = CV.c; if (!c) return null; const dir = c.dead ? (CV.s > c.L - 10 ? -1 : 1) : CV.dir, s = clamp(CV.s + dir * 12, 0, c.L), i = Math.round(s / CAVE_STEP);
  const left = dir > 0 ? c.L - CV.s : CV.s, name = c.dead ? (dir > 0 ? '地下湖' : '出口') : '出口';
  return { x: c.X[i], z: c.Z[i], d: Math.max(0, Math.round(left)), name, col: c.T.trail };
}

/* ---------- 互動：壁畫、苔蘚 ---------- */
function caveLabel(t, key) {
  const id = t.it.id;
  if (id.startsWith('mural:')) { const m = CAVE_MURAL[id.slice(6)], got = S.cave && S.cave.mural && S.cave.mural[id.slice(6)]; return `${key}${got ? '再看一次' : '拍下'}${m.t}`; }
  if (id.startsWith('moss:')) { const left = caveMossLeft(t.it.cave); return left > 0 ? `${key}摘下發光苔蘚（今天這個洞還能摘 ${left} 次）` : '發光苔蘚　<span style="color:var(--sub)">今天摘夠了，明天再來</span>'; }
  return '';
}
const caveDay = () => Math.floor((Date.now() - new Date().getTimezoneOffset() * 6e4) / 864e5);
function caveMossLeft(c) { const m = (S.cave && S.cave.moss) || {}; return m.d === caveDay() ? Math.max(0, 3 - (m.n && m.n[c.id] || 0)) : 3; }
function caveAct(it) {
  const id = it.id; S.cave = S.cave || {};
  if (id.startsWith('mural:')) {
    const k = id.slice(6), m = CAVE_MURAL[k], first = !(S.cave.mural && S.cave.mural[k]); (S.cave.mural = S.cave.mural || {})[k] = Date.now();
    if (first) { gainXP(15, '拍下壁畫'); sfx.pop(); save(); }
    modal(`<h2>${m.t}</h2><div class="riddle" style="text-align:left">${m.txt}</div><p class="small" style="color:var(--sub)">${first ? '已經拍照存進手帳（背包的探索日誌）。' : '手帳裡已經有這張照片了。'}這是「${m.next}」的線索。</p>`, [{ t: '收進手帳' }]);
    if (typeof renderQuest === 'function') renderQuest(); return;
  }
  if (id.startsWith('moss:')) {
    const c = it.cave; if (caveMossLeft(c) <= 0) return toast('這叢苔蘚今天摘夠了，留一些讓它繼續發光吧。明天再來。');
    const m = S.cave.moss && S.cave.moss.d === caveDay() ? S.cave.moss : (S.cave.moss = { d: caveDay(), n: {} }); m.n[c.id] = (m.n[c.id] || 0) + 1;
    S.cave.mossN = (S.cave.mossN || 0) + 1; sfx.collect(); gainXP(3, '摘發光苔蘚'); save();
    toast(`摘到一小撮「苔光」（共 ${S.cave.mossN} 份）：放在捏捏上會微微發光，到裝飾桌試試看`);
  }
}
// 存檔：山洞的進度（走過哪些洞、拍過的壁畫、苔蘚）
function caveSan(o) {
  const obj = v => (v && typeof v === 'object' && !Array.isArray(v)) ? v : {}, ids = CAVE_DEF.map(d => d.id), pickIds = v => Object.fromEntries(Object.entries(obj(v)).filter(([k, x]) => ids.includes(k) && x).map(([k, x]) => [k, Math.max(1, Math.floor(+x) || 1)]));
  const c = obj(o), m = obj(c.moss);
  return { seen: pickIds(c.seen), mural: pickIds(c.mural), moss: { d: Math.floor(+m.d) || 0, n: Object.fromEntries(Object.entries(obj(m.n)).filter(([k]) => ids.includes(k)).map(([k, v]) => [k, clamp(Math.floor(+v) || 0, 0, 3)])) }, mossN: clamp(Math.floor(+c.mossN) || 0, 0, 9999) };
}
// 第一次走出山洞：區名大字浮現（2.3）
function caveReveal(title, sub) {
  let el = document.getElementById('zoneTitle'); if (!el) { el = document.createElement('div'); el.id = 'zoneTitle'; el.setAttribute('aria-live', 'polite'); el.innerHTML = '<small></small><b></b><span></span>'; (document.getElementById('hud') || document.body).appendChild(el); }
  el.querySelector('small').textContent = '發現新區域'; el.querySelector('b').textContent = title; el.querySelector('span').textContent = sub;
  el.classList.remove('on'); void el.offsetWidth; el.classList.add('on'); clearTimeout(el._t); el._t = setTimeout(() => el.classList.remove('on'), 4200);
}

// 洞裡的腳步帶回音：同一個腳步聲，延遲 0.13、0.27 秒各再響一次、越來越小（不用即時運算的殘響，7.2）
function caveEcho(kind, v) { setTimeout(() => sfx.step(kind, v * .32), 130); setTimeout(() => sfx.step(kind, v * .13), 270); }
// 目標在山的另一邊：引導先走到山洞口；人在洞裡就引導到前方的曲線上
function caveRegion(x, z) { if (inCity(x)) return 'city'; const ox = x / K, oz = z / K, ax = Math.abs(ox), az = Math.abs(oz); if (Math.max(ax, az) < 50) return 'plain'; return ax >= az ? (ox > 0 ? 'coast' : 'snow') : (oz < 0 ? 'volcano' : 'south'); }
function caveRoute(tx, tz) {
  if (tx == null || !CAVES.length || inCity(tx) || inCity()) return null; const to = caveRegion(tx, tz);
  if (CV.c) { const c = CV.c; if (c.dead) return null; const far = to === c.def.to, s = clamp(CV.s + (far ? 1 : -1) * 14, 0, c.L), i = Math.round(s / CAVE_STEP); return { x: c.X[i], z: c.Z[i], n: c.def.name + (far ? '出口' : '入口'), cave: c }; }
  const me = caveRegion(P.x, P.z); if (me === to || to === 'south' || me === 'south') return null;
  if (me === 'plain') { const c = CAVES.find(o => o.def.to === to); return c ? { x: c.X[0] - c.TX[0] * 2.5, z: c.Z[0] - c.TZ[0] * 2.5, n: c.def.name, cave: c } : null; }
  const c = CAVES.find(o => o.def.to === me), i = c ? c.n - 1 : 0; return c ? { x: c.X[i] + c.TX[i] * 2.5, z: c.Z[i] + c.TZ[i] * 2.5, n: c.def.name, cave: c } : null;
}

/* ---------- 洞穴史萊姆（06）：只在暗處出現，被手電筒般的視線照到會慢慢縮起來，要從側面靠近 ---------- */
function caveSpawnSlimes() {
  CAVES.forEach(c => {
    const sp = SPECIES.find(s => s.cave === c.id); if (!sp || c.slimes) return; c.slimes = 0; const max = LOW ? 2 : 3, spots = [];
    if (c.lake) for (let k = 0; k < max; k++) { const a = k / max * Math.PI * 2 + .7, d = c.lake.r + 1.4; spots.push([c.lake.x + Math.cos(a) * d, c.lake.z + Math.sin(a) * d]); } // 月光史萊姆：湖邊
    else { const hs = c.S[c.hallI], hw = c.Wd[c.hallI]; [.3, .5, .74].slice(0, max).forEach((f, k) => { let s = c.sIn + 4 + f * (c.L - 2 * c.sIn - 8); if (Math.abs(s - hs) < hw * .5) s = hs + (k % 2 ? 1 : -1) * hw * .75; // 避開大廳中央的光柱
        for (const m of c.moss) if (Math.abs(m.s - s) < 3) s += 4; const i = clamp(Math.round(s / CAVE_STEP), 0, c.n - 1), lf = (k % 2 ? .3 : -.3) * c.Wd[i]; spots.push([c.X[i] - c.TZ[i] * lf, c.Z[i] + c.TX[i] * lf]); }); }
    spots.forEach(([x, z]) => {
      const m = slimeMesh(sp), sl = newSlime(sp, m, { id: ++W.sid, sc: rnd(.58, .72), zid: 'cave:' + c.id, hx: x, hz: z, x, z, cave: c, ci: 0, shrink: 0, pers: 'calm' });
      sl.ci = caveQ(c, x, z, null).i; m.scale.setScalar(sl.sc); m.userData.body.userData.sl = sl; caveSetLayers(m, 3); W.scene.add(m); W.slimes.push(sl); c.slimes++;
    });
  });
}
function caveSlimeMove(s, dx, dz) {
  const c = s.cave, nx = s.x + dx, nz = s.z + dz, q = caveQ(c, nx, nz, s.ci);
  let ok = q.s > c.sIn - 4 && q.s < (c.dead ? c.L - 2 : c.L - c.sIn + 4) && Math.abs(q.l) < q.w * .62;
  for (const o of [c.lake, c.pool]) if (o && Math.hypot(nx - o.x, nz - o.z) < o.r + .5) ok = false;
  if (ok) { s.x = nx; s.z = nz; s.ci = q.i; return true; }
  s.turn = 0; s.wa += Math.PI * rnd(.6, 1.4); s.hvx *= -.25; s.hvz *= -.25; return false;
}
function caveSlimeY(s) { return caveQ(s.cave, s.x, s.z, s.ci).y; }
const CAVE_FWD = new THREE.Vector3();
function caveSlimeStep(s, dt, dist) {
  // 視線正對著（畫面中央附近、12 公尺內）就慢慢縮起來；轉開視線或從側面靠近就會放鬆
  W.cam.getWorldDirection(CAVE_FWD); const vx = s.x - W.cam.position.x, vz = s.z - W.cam.position.z, vl = Math.hypot(vx, vz) || 1, look = (CAVE_FWD.x * vx + CAVE_FWD.z * vz) / vl / (Math.hypot(CAVE_FWD.x, CAVE_FWD.z) || 1);
  const lit = dist < 12 && look > .96 && s.cool <= 0 ? (1 - dist / 12) * 1.6 + .55 : 0;
  s.shrink = clamp((s.shrink || 0) + (lit > 0 ? lit * dt * .85 : -dt * .9), 0, 1);
  if (s.shrink > .7 && !s.curlFx) { s.curlFx = true; if (!emoteOn(s)) emote(s, 'sweat', 1.2); } else if (s.shrink < .3) s.curlFx = false;
  s.m.scale.setScalar(s.sc * (1 - .42 * s.shrink)); if (s.shrink > .2) { s.wSpd = 0; s.rest = Math.max(s.rest, .2); }
}

/* ============================================================
   開場：穿越機（FPV 空拍機）視角穿過一條山洞，進到月光谷中央平地（每次進入遊戲都播，任意鍵略過）
   A 從某一區的洞口外俯衝進洞 → B 沿著山洞曲線高速穿梭（轉彎時機身傾斜，大廳放慢）→ C 從平地那側衝出、拉高掠過樹梢 → 接回第一人稱
   ============================================================ */
const INTRO = { on: false, t: 0, c: null, s: 0, inCave: false, done: null, skip: false, pos: new THREE.Vector3(), q: new THREE.Quaternion(), roll: 0, hum: null };
const IV = [new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3()], IM = new THREE.Matrix4(), IUP = new THREE.Vector3(0, 1, 0), IQ = new THREE.Quaternion(), IE = new THREE.Euler(0, 0, 0, 'YXZ');
function introStart(done) {
  const pool = CAVES.filter(c => !c.dead); if (!pool.length || !W.ready) return false;
  const c = pool[Math.floor(Math.random() * pool.length)], n = c.n - 1, ox = c.TX[n], oz = c.TZ[n], nx = -oz, nz = ox, ex = c.X[n], ez = c.Z[n], ey = c.Y[n] + c.Hh[n] * .42;
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  // 終點：玩家的眼睛（在大城市或離平地太遠時，最後用白光轉場）
  const eye = new THREE.Vector3(P.x, (CV.c ? caveG(P.x, P.z) : G(P.x, P.z)) + (P.eye || 1.62), P.z), m0 = new THREE.Vector3(c.X[0], c.Y[0] + c.Hh[0] * .42, c.Z[0]), far = eye.distanceTo(m0) > 140;
  const o0 = new THREE.Vector3(-c.TX[0], 0, -c.TZ[0]), toEye = far ? new THREE.Vector3(-m0.x, 0, -m0.z).normalize() : eye.clone().sub(m0).setY(0).normalize();
  const C2 = m0.clone().addScaledVector(o0, 14).add(IV[0].set(0, 4.5, 0)), C3 = m0.clone().addScaledVector(o0, 24).addScaledVector(toEye, 12).add(IV[0].set(0, 11, 0));
  const fin = far ? C3.clone().addScaledVector(toEye, 26).setY(C3.y - 4) : eye.clone();
  Object.assign(INTRO, { on: true, t: 0, c, s: c.L, inCave: false, done, skip: false, far, reduce, roll: 0, flashDone: false,
    A: [new THREE.Vector3(ex + ox * 46 + nx * 9, ey + 15, ez + oz * 46 + nz * 9), new THREE.Vector3(ex + ox * 18 + nx * 2, ey + 4, ez + oz * 18 + nz * 2), new THREE.Vector3(ex + ox * 4, ey + .4, ez + oz * 4), new THREE.Vector3(ex - ox * 3, ey, ez - oz * 3)],
    C: [m0.clone(), C2, C3, fin], dA: reduce ? 1.2 : 2.3, dC: reduce ? 2 : 3.3, eye });
  // B 段的時間：沿曲線積分速度（窄道快、大廳慢）
  INTRO.sT = []; let acc = 0; for (let i = n; i >= 0; i--) { INTRO.sT[i] = acc; acc += CAVE_STEP / introSpeed(c, i); } INTRO.dB = acc;
  document.body.classList.add('intro'); if (VM.g) VM.g.visible = false;
  let el = document.getElementById('introSkip'); if (!el) { el = document.createElement('div'); el.id = 'introSkip'; document.body.appendChild(el); }
  el.textContent = TOUCH ? '點一下略過' : '按任意鍵略過'; el.hidden = false;
  INTRO.onKey = e => { if (INTRO.on && INTRO.t > .25) INTRO.skip = true; };
  ['keydown', 'pointerdown', 'touchstart'].forEach(k => addEventListener(k, INTRO.onKey, { passive: true }));
  // 開場會一路看到平常不同時出現的東西：先把著色器編譯好，第一次看到山洞時才不會卡一下（設計分析 13.2 第 6 點）
  try { const m0 = W.cam.layers.mask; W.cam.layers.mask = 7; W.r.compile(W.scene, W.cam); W.cam.layers.mask = m0; } catch (e) { }
  introSound(true); return true;
}
function introSpeed(c, i) { const w = c.Wd[i]; return w > 3.5 ? 12 : w > 2.4 ? 20 : 25; } // 公尺／秒
const crV = (a, b, c2, d, t, out) => out.set(0, 0, 0).addScaledVector(b, 2).addScaledVector(IV[3].copy(c2).sub(a), t).addScaledVector(IV[3].copy(a).multiplyScalar(2).addScaledVector(b, -5).addScaledVector(c2, 4).sub(d), t * t).addScaledVector(IV[3].copy(b).multiplyScalar(3).sub(a).addScaledVector(c2, -3).add(d), t * t * t).multiplyScalar(.5);
function introCurve(pts, t, out) { const n = pts.length - 1, f = clamp(t, 0, 1) * n, i = Math.min(n - 1, Math.floor(f)); return crV(pts[Math.max(0, i - 1)], pts[i], pts[i + 1], pts[Math.min(n, i + 2)], f - i, out); }
function introStep(dt) {
  const I = INTRO, c = I.c, cam = W.cam; if (I.skip && I.t < I.dA + I.dB) { I.t = I.dA + I.dB + I.dC * .55; I.skip = false; I.inCave = false; }
  I.t += dt; DRS.skip = Math.max(DRS.skip || 0, 1); const tA = I.dA, tB = tA + I.dB, tC = tB + I.dC; // 開場期間動態解析度不計時 let look = IV[1], pos = I.pos, fov = 96, bank = 0;
  if (I.t < tA) { // A：從洞口外俯衝進洞
    const u = smooth(0, 1, I.t / tA) * .55 + I.t / tA * .45; introCurve(I.A, u, pos); introCurve(I.A, Math.min(1, u + .06), look); I.inCave = false;
    if (I.t / tA > .8 && !I.inCave) { I.s = c.L; }
  } else if (I.t < tB) { // B：在洞裡沿著曲線穿梭
    const tt = I.t - tA; let i = c.n - 1; while (i > 0 && I.sT[i - 1] < tt) i--; const j = Math.max(0, i - 1), f = clamp((tt - I.sT[i]) / Math.max(1e-4, I.sT[j] - I.sT[i]), 0, 1);
    const x = c.X[i] + (c.X[j] - c.X[i]) * f, z = c.Z[i] + (c.Z[j] - c.Z[i]) * f, y = c.Y[i] + (c.Y[j] - c.Y[i]) * f, h = c.Hh[i] + (c.Hh[j] - c.Hh[i]) * f, w = c.Wd[i];
    const wv = Math.sin(I.t * 1.7) * Math.min(.35, w * .18); pos.set(x - c.TZ[i] * wv, y + Math.min(h * .45, 2.6) + Math.sin(I.t * 2.3) * .12, z + c.TX[i] * wv);
    const k = Math.max(0, i - 16); look.set(c.X[k], c.Y[k] + Math.min(c.Hh[k] * .42, 2.4), c.Z[k]);
    const k2 = Math.max(0, i - 8), turn = Math.atan2(c.TX[i] * c.TZ[k2] - c.TZ[i] * c.TX[k2], c.TX[i] * c.TX[k2] + c.TZ[i] * c.TZ[k2]); bank = clamp(-turn * 1.6, -.5, .5);
    I.inCave = true; I.s = c.S[i] + (c.S[j] - c.S[i]) * f; I.i = i;
  } else { // C：衝出洞口、拉高掠過樹梢，最後接回玩家的眼睛
    if (I.inCave) { I.inCave = false; CV.flash = 1.1; introWhoosh(); }
    const u = clamp((I.t - tB) / I.dC, 0, 1), e = u < .5 ? u * 1.15 : .575 + (u - .5) * .85; introCurve(I.C, e, pos); introCurve(I.C, Math.min(1, e + .07), look); fov = 96 - 24 * smooth(.45, 1, u);
    if (u > .72 && !I.far) { IE.set(P.pitch, P.yaw, 0); IQ.setFromEuler(IE); }
  }
  // 朝向：看著前方的點，加上轉彎傾斜與一點高頻抖動（穿越機的手感）
  IM.lookAt(pos, look, IUP); const q = IV[2]; I.q.setFromRotationMatrix(IM); I.roll += (bank - I.roll) * Math.min(1, dt * 5);
  const sh = I.reduce ? 0 : .006 * (I.t < tB ? 1 : .4); I.q.multiply(IQ.setFromEuler(IE.set(Math.sin(I.t * 31) * sh, Math.sin(I.t * 27 + 1) * sh, I.roll + Math.sin(I.t * 23) * sh * 1.5)));
  const u = (I.t - tB) / I.dC;
  if (I.t >= tB && u > .72 && !I.far) { IE.set(P.pitch, P.yaw, 0); IQ.setFromEuler(IE); I.q.slerp(IQ, smooth(.72, 1, u)); }
  cam.position.copy(pos); cam.quaternion.copy(I.q); if (Math.abs(cam.fov - fov) > .05) { cam.fov = fov; cam.updateProjectionMatrix(); }
  if (I.far && u > .82 && !I.flashDone) { I.flashDone = true; introFade(); }
  if (I.hum) { const sp = I.t < tA ? 18 : I.t < tB ? 22 : 14; I.hum.f.frequency.value = 150 + sp * 4 + Math.sin(I.t * 9) * 6; I.hum.g.gain.value = .012 * (1 - smooth(.6, 1, Math.max(0, u))); }
  if (I.t >= tC) introEnd();
}
function introEnd() {
  const I = INTRO; if (!I.on) return; I.on = false; document.body.classList.remove('intro'); const el = document.getElementById('introSkip'); if (el) el.hidden = true;
  ['keydown', 'pointerdown', 'touchstart'].forEach(k => removeEventListener(k, I.onKey));
  introSound(false); CV.c = null; CV.scanNow = 1; W.cam.fov = W.fov0 || 72; W.cam.updateProjectionMatrix();
  const done = I.done; I.done = null; if (done) done(); W.camAway = !I.far; // 從開場最後的位置平順回到玩家視角
}
function introFade() { let el = document.getElementById('introFade'); if (!el) { el = document.createElement('div'); el.id = 'introFade'; document.body.appendChild(el); } el.classList.remove('on'); void el.offsetWidth; el.classList.add('on'); }
// 聲音：小小的螺旋槳嗡嗡聲（速度越快音調越高）＋進出洞口的風切聲
function introSound(on) {
  try {
    if (!S.sound) return; const ac = audio(); if (on && !INTRO.hum) { const o1 = ac.createOscillator(), o2 = ac.createOscillator(), f = ac.createBiquadFilter(), g = ac.createGain(); o1.type = o2.type = 'sawtooth'; o1.frequency.value = 220; o2.frequency.value = 223.5; f.type = 'lowpass'; f.frequency.value = 230; f.Q.value = 2; g.gain.value = 0; o1.connect(f); o2.connect(f); f.connect(g); g.connect(master); o1.start(); o2.start(); INTRO.hum = { o1, o2, f, g }; introWhoosh(); }
    else if (!on && INTRO.hum) { const h = INTRO.hum; INTRO.hum = null; h.g.gain.setTargetAtTime(0, ac.currentTime, .15); setTimeout(() => { try { h.o1.stop(); h.o2.stop(); h.g.disconnect(); } catch (e) { } }, 900); }
  } catch (e) { }
}
function introWhoosh() { try { if (!S.sound) return; const ac = audio(), t = ac.currentTime; noise(ac, t, .9, 700, .8, .05, 'bandpass', .8); noise(ac, t + .1, .6, 1800, 1.2, .025, 'bandpass', 1.3); } catch (e) { } }
