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
const CAVE_UA = Array.from({ length: 8 }, () => new THREE.Vector4(0, 0, 0, 0)), CAVE_UB = Array.from({ length: 8 }, () => new THREE.Vector4(0, 0, 0, 0)); // 沒用到的格子 w＝0（terrainMat 直接跳過；Vector4 預設 w＝1 會被當成原點的一個洞口去檢查）
// 每個洞的主題：岩石底色、洞裡的霧、環境光、發光痕跡（＝那一區的主色，4.4）、粒子、環境音
// ak＝烘焙時環境光的倍率、exp＝洞裡多加的曝光：熔岩隧道和月光洞窟的岩石很暗，不補光的話整條通道幾乎全黑、看不出牆的形狀
// trail2／trailA＝地上發光痕跡的顏色與不透明度（冰洞的地面很亮，痕跡用飽和一點的藍、淡一點，才看得出是光而不是白漆）
const CAVE_THEME = {
  sea: { rock: '#4d6f80', rock2: '#7aa3b3', wet: '#2f4f5e', fog: '#0b1d29', amb: '#5b7f95', light: '#cdeeff', trail: '#5EC2E8', glow: '#bfe9ff', far: 30, hemi: '#9fd8ff', hemiG: '#16303f', part: 'drip', pc: '#bfe9ff' },
  lava: { rock: '#574540', rock2: '#7a5646', wet: '#33261f', fog: '#2a1610', amb: '#7d6860', ak: 1.5, exp: .3, light: '#ffd0a0', trail: '#E8743B', glow: '#ffb27a', far: 28, hemi: '#ffb27a', hemiG: '#2a120b', part: 'spark', pc: '#ffae5c' },
  ice: { rock: '#8db3cf', rock2: '#d3ecfb', wet: '#6d93b3', fog: '#13263a', amb: '#7fa3c4', light: '#e8f6ff', trail: '#BFE3F5', trail2: '#6cc4ee', trailA: .6, glow: '#eaf6ff', far: 34, hemi: '#d6ecff', hemiG: '#2b3f5c', part: 'glint', pc: '#f0f9ff' },
  moon: { rock: '#48436c', rock2: '#665e9c', wet: '#2e2a52', fog: '#16132e', amb: '#57529a', ak: 1.9, exp: .35, light: '#c7d2fe', trail: '#a78bfa', glow: '#d8ccff', far: 32, hemi: '#b8c6ff', hemiG: '#141233', part: 'mote', pc: '#ddd6fe' },
};
// 洞壁的層次（全部烘進頂點色，不多一個三角形）：
// lam／sk＝岩層的厚度與明暗差、tints＝每一層偏一點的色調；vein＝礦脈（nv 條，vg＝自己會微微發光）；
// wetH＝牆腳濕潤的高度、gloss＝濕岩面朝上的那幾面反光多亮；seep＝幾道從上面滲下來的濕痕（腳下會有一灘水）
const CAVE_SURF = {
  sea: { lam: .62, sk: .18, tints: ['#ffffff', '#e2eff4', '#eef0ea'], vein: '#f1f8f4', vk: .62, nv: 5, wetH: 1.25, gloss: .5, glossC: '#cdefff', seep: 6, alg: '#3d6f60', tide: '#e8f2ec' },
  lava: { lam: .8, sk: .26, tints: ['#ffffff', '#c9b2a8', '#ffe1cc'], vein: '#2e1e2a', vk: .55, nv: 5, wetH: 0, gloss: 0, seep: 0, soot: .72 },
  ice: { lam: .55, sk: .2, tints: ['#ffffff', '#d4ecff', '#b3d4f0'], vein: '#ffffff', vk: .75, nv: 7, wetH: .9, gloss: .55, glossC: '#ffffff', seep: 3 },
  moon: { lam: .9, sk: .2, tints: ['#ffffff', '#e2dcff', '#cfd9ff'], vein: '#6fb4dc', vk: .2, nv: 4, vg: true, wetH: 1.1, gloss: .45, glossC: '#d8d0ff', seep: 3 },
};
/* 四個山洞（03 的比較表）。座標是「基礎單位」（世界座標＝基礎單位×K），在洞自己的方向上：
   u＝從月光谷中心往外、v＝沿山脊橫向；d 是 u 的方向。a＝內側洞口、b＝外側洞口（月光洞窟是死路，沒有 b）。
   pts 是洞裡的控制點：[u, v, 半寬(公尺), 高度(公尺), 地面落差(公尺)]；hall 是大廳那一點的索引。
   管子沿曲線掃出來，彎道內側的牆離曲線不能超過轉彎半徑（否則會往回摺）：大廳的 U 形迴轉用一段半圓（pts[5]～pts[7] 在同一個圓上），
   兩條腿之間要留夠寬，迴轉半徑才會接近大廳的半寬（7.1） */
const CAVE_DEF = [
  { id: 'sea', name: '海蝕洞', to: 'coast', gate: 'coast', th: 'sea', d: [1, 0], a: [45.2, 0], aw: 2.6, ah: 5.2, b: [63.8, 2.4], bw: 2.7, bh: 5.4, hall: 6,
    pts: [[52.2, 4.2, 1.8, 4, -.6], [50.6, 10, 1.5, 3.6, -1], [52.8, 15.5, 1.5, 3.6, -1.4], [50.8, 21, 1.5, 3.6, -1.7], [52, 27, 1.6, 3.8, -2], [53.32, 31.78, 4.2, 7.5, -2.4], [56.5, 33.1, 6.8, 11, -2.8], [59.68, 31.78, 4.8, 8.5, -2.6], [61, 24, 2.2, 4.6, -1.9], [58.8, 16.5, 2.2, 4.6, -1.4], [60.2, 10.8, 2.3, 4.6, -.9], [59.6, 6.6, 2.4, 4.8, -.5]],
    mural: '潮汐', slime: 'saltc' },
  { id: 'lava', name: '熔岩隧道', to: 'volcano', gate: 'volcano', th: 'lava', d: [0, -1], a: [45.2, 0], aw: 2.6, ah: 5.2, b: [63.8, -2.4], bw: 2.7, bh: 5.4, hall: 6,
    pts: [[52, -4.5, 1.9, 4.2, -.5], [50.4, -10.5, 1.8, 4.2, -.8], [52.6, -16.5, 1.8, 4.4, -1], [50.8, -22.5, 1.8, 4.4, -1.1], [52.2, -28.4, 2, 4.6, -1], [53.49, -31.71, 4, 8.5, -.6], [56.6, -33, 6.2, 12.5, -.3], [59.71, -31.71, 4.4, 9.5, -.6], [61, -23, 2, 4.6, -1.2], [58.8, -15, 2, 4.6, -1], [60.2, -9.5, 2.2, 4.8, -.8], [59.7, -6, 2.2, 4.8, -.5]],
    mural: '保暖衣', slime: 'charc' },
  { id: 'ice', name: '冰洞', to: 'snow', coat: true, th: 'ice', d: [-1, 0], a: [45.2, 0], aw: 2.6, ah: 5.2, b: [63.8, 2.4], bw: 2.7, bh: 5.4, hall: 6,
    pts: [[51.8, 5, 1.8, 4, -.6], [50.4, 11, 1.6, 3.8, -1], [52.6, 16.8, 1.6, 3.8, -1.2], [50.8, 22.6, 1.7, 4, -1.4], [52.4, 28, 1.8, 4.2, -1.5], [53.63, 30.97, 4.4, 8.5, -1.6], [56.6, 32.2, 6.4, 10.5, -1.8], [59.57, 30.97, 4.4, 8, -1.5], [60.8, 20, 2.2, 4.6, -1.2], [58.8, 12.5, 2.2, 4.6, -1], [60, 8.4, 2.3, 4.8, -.7], [59.7, 5.6, 2.3, 4.8, -.4]],
    mural: '月光洞窟', slime: 'frostb' },
  { id: 'moon', name: '月光洞窟', dead: true, night: true, th: 'moon', d: [0, 1], a: [45.2, -7], aw: 1.05, ah: 3.1, hall: 6,
    pts: [[50.8, -6.4, 1, 3, -.6], [52.8, -2.6, 1.1, 3.2, -1.1], [52.2, 3, 1.2, 3.4, -1.6], [54.4, 7.4, 1.6, 3.8, -2], [57, 8.2, 3.8, 7.5, -2.4], [59.8, 7.4, 8.6, 12, -2.8], [62.6, 6.6, 9.2, 12.5, -2.8], [65, 6, 5.6, 9, -2.8]],
    mural: '空島', slime: 'moon' },
];
// 壁畫：大廳裡的線索（下一道謎題），拍照後存進手帳（06）
const CAVE_MURAL = {
  sea: { t: '海蝕洞的壁畫', txt: '四顆石頭在浪裡一顆接一顆亮起：第一顆像火焰，最後一顆像初春的嫩草。', next: '潮汐石陣' },
  lava: { t: '熔岩隧道的壁畫', txt: '一個裹著厚外套的人走進結冰的洞口，寒氣在他身邊散開；洞口旁畫著大城市的屋頂。', next: '雪原的寒氣' }, // 雪原只要保暖衣（大城市的武器店），不用解謎
  ice: { t: '冰洞的壁畫', txt: '月光谷南方的山壁上有一道裂縫，月亮升起的時候，裂縫裡透出紫色的光。', next: '月光洞窟' },
  moon: { t: '湖邊的石碑', txt: '「月亮最近的地方，有一座漂在雲上的島。帶著月光凝膠的人，會被月光接引。」', next: '空島的傳說（第 5 堂）' },
};
const CAVES = [], CV = { c: null, i: 0, s: 0, l: 0, k: 0, mode: 'out', dir: 1, raw: false, exp: 1, flash: 0, lift: 0, f0: null, scanN: 0, far: 0 };
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
    const d = Math.sqrt(bd), w = c.Wd[bi], sv = q.head ? c.S[bi] : c.L - c.S[bi], wt = (1 - smooth(w + 1.2, w + 6.5, d)) * smooth(1.9, 3.6, sv), top = (c.Y[bi] + c.Hh[bi] + 2.4) / K;
    if (h < top) h += (top - h) * wt;
  }
  return h;
}

/* ---------- 曲線：控制點 → 向心 Catmull-Rom → 每 0.5 公尺取樣 ---------- */
// 洞口直段的盡頭 E（方向 h）用一段圓弧（半徑≈2 倍半寬）轉向第一個控制點，再直直接過去（基礎單位）。
// 控制點太靠近直段（側向偏太多、或幾乎就在直段延長線上而緊接著要急轉）就不用它，改轉向下一個點：原本這裡會出現小於半寬的急彎，牆往回摺
function caveFillet(E, h, pts, w0, h0) {
  const n = [-h[1], h[0]];
  for (let k = 0; k < pts.length - 1; k++) {
    const P = pts[k], ru = P[0] - E[0], rv = P[1] - E[1], f = ru * h[0] + rv * h[1], l = ru * n[0] + rv * n[1], al = Math.abs(l), wm = (w0 + P[2]) / 2, Rd = 2 * wm / K;
    if (f <= 0) continue; // 在直段後面
    if (al < .2) { if (f < Rd * 1.5) continue; return { arc: [], used: k }; } // 在直段的延長線上：太近就丟掉，夠遠就直直走過去
    const Rf = (f * f + l * l) / (2 * al); if (Rf < 1.3 * wm / K) continue; // 和直段相切、又通過 P 的圓太小：轉不過去
    const R = Math.min(Rd, Rf), sg = Math.sign(l), cx = E[0] + n[0] * R * sg, cz = E[1] + n[1] * R * sg, a0 = Math.atan2(E[1] - cz, E[0] - cx);
    const aT = Math.atan2(P[1] - cz, P[0] - cx) - sg * Math.acos(clamp(R / Math.hypot(P[0] - cx, P[1] - cz), -1, 1)); // 從 P 畫到圓的切點
    let sw = aT - a0; while (sg * sw < 0) sw += sg * 2 * Math.PI; if (Math.abs(sw) > 2 * Math.PI) sw -= sg * 2 * Math.PI;
    // 對準 P 之後還要在 P 轉向下一個點：轉角大於 40° 就不用 P（離直段最近的兩個點才這樣丟）
    const N2 = pts[k + 1], ox = N2[0] - P[0], oz = N2[1] - P[1];
    if (k < 2 && (-Math.sin(aT) * sg * ox + Math.cos(aT) * sg * oz) / Math.hypot(ox, oz) < Math.cos(.7)) continue;
    const m = Math.ceil(Math.abs(sw) / .4), arcL = R * Math.abs(sw), tot = arcL + Math.hypot(P[0] - cx - R * Math.cos(aT), P[1] - cz - R * Math.sin(aT)), arc = [];
    for (let j = 1; j <= m; j++) { if (j === m && tot - arcL < .3) break; const a = a0 + sw * j / m, fr = arcL * j / m / tot; arc.push([cx + R * Math.cos(a), cz + R * Math.sin(a), w0 + (P[2] - w0) * fr, h0 + (P[3] - h0) * fr, P[4] * fr]); }
    return { arc, used: k };
  }
  return { arc: [], used: 0 };
}
function cavePath(def) {
  const W2 = caveLocal(def), L0b = CAVE_L0 / K, Ma = def.a, Q = [];
  const add = (u, v, w, h, fy) => { const [x, z] = W2(u, v); Q.push([x * K, z * K, w, h, fy]); };
  // 入口：直段（多留半個單位，地形挖洞的那 6.4 公尺一定是直的）→ 圓弧 → 控制點
  const Ea = [Ma[0] + L0b + .5, Ma[1]], fa = caveFillet(Ea, [1, 0], def.pts, def.aw, def.ah);
  add(Ma[0], Ma[1], def.aw, def.ah, 0); add(Ma[0] + L0b, Ma[1], def.aw, def.ah, 0); add(Ea[0], Ea[1], def.aw, def.ah, 0); fa.arc.forEach(p => add(...p));
  let pts = def.pts.slice(fa.used);
  if (!def.dead) { // 出口：從外側洞口倒著做一樣的圓弧，再反過來接上（洞口方向仍由最後一個控制點決定，不變）
    const [eu, ev] = def.eUV, B = def.b, Eb = [B[0] - eu * (L0b + .5), B[1] - ev * (L0b + .5)], fb = caveFillet(Eb, [-eu, -ev], pts.slice().reverse(), def.bw, def.bh);
    pts.slice(0, pts.length - fb.used).forEach(p => add(...p)); fb.arc.reverse().forEach(p => add(...p));
    add(Eb[0], Eb[1], def.bw, def.bh, 0); add(B[0] - eu * L0b, B[1] - ev * L0b, def.bw, def.bh, 0); add(B[0], B[1], def.bw, def.bh, 0);
  } else pts.forEach(p => add(...p));
  // 向心 Catmull-Rom（節點間距＝弦長的平方根）：控制點間距不均勻時也不會打結、不會衝過頭；兩端用反射的虛擬點，洞口直段保持筆直
  const QP = [Q[0].map((v, j) => 2 * v - Q[1][j]), ...Q, Q[Q.length - 1].map((v, j) => 2 * v - Q[Q.length - 2][j])], dense = [], NS = 24;
  const kn = (a, b) => Math.max(1e-4, Math.sqrt(Math.hypot(b[0] - a[0], b[1] - a[1]))), lp = (a, b, ta, tb, t) => a.map((v, j) => ((tb - t) * v + (t - ta) * b[j]) / (tb - ta));
  for (let i = 1; i < QP.length - 2; i++) {
    const p0 = QP[i - 1], p1 = QP[i], p2 = QP[i + 1], p3 = QP[i + 2], t1 = kn(p0, p1), t2 = t1 + kn(p1, p2), t3 = t2 + kn(p2, p3);
    for (let k = 0; k < NS; k++) { const t = t1 + (t2 - t1) * k / NS, A1 = lp(p0, p1, 0, t1, t), A2 = lp(p1, p2, t1, t2, t), A3 = lp(p2, p3, t2, t3, t); dense.push(lp(lp(A1, A2, 0, t2, t), lp(A2, A3, t1, t3, t), t1, t2, t)); }
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
  // 曲率（±1 公尺內切線轉的角度÷弧長；正＝往 +n＝(−TZ, TX) 那側彎）：管子依它決定圈距
  c.KA = A(); for (let i = 0; i < n; i++) { const a = Math.max(0, i - 2), b = Math.min(n - 1, i + 2); let d = Math.atan2(c.TZ[b], c.TX[b]) - Math.atan2(c.TZ[a], c.TX[a]); d -= Math.round(d / (2 * Math.PI)) * 2 * Math.PI; c.KA[i] = d / Math.max(1e-6, c.S[b] - c.S[a]); }
  caveSides(c);
  // 地面：入口高度 → 出口高度（直段保持水平）＋各點的落差
  const y0 = def.ma.y * K, y1 = def.dead ? y0 : def.mb.y * K;
  for (let i = 0; i < n; i++) { const s = c.S[i]; c.Y[i] = y0 + (y1 - y0) * smooth(CAVE_L0, c.L - CAVE_L0, s) + c.FY[i] * (1 - smooth(CAVE_L0 - 2, CAVE_L0, Math.min(s, c.dead ? 1e9 : c.L - s))); }
  c.y0 = y0; c.y1 = y1;
  // 大廳中心：離 hall 控制點最近的取樣；大廳的地面整平（潮池、冰面、地下湖都是水平的圓，地面有坡度就會切到它們或浮在半空）
  { const [hx, hz] = W2(def.pts[def.hall][0], def.pts[def.hall][1]); let bd = 1e9; for (let i = 0; i < n; i++) { const d = Math.hypot(c.X[i] - hx * K, c.Z[i] - hz * K); if (d < bd) { bd = d; c.hallI = i; } } }
  { const s0 = c.S[c.hallI], hw = c.Wd[c.hallI], hy = c.Y[c.hallI]; for (let i = 0; i < n; i++) c.Y[i] += (hy - c.Y[i]) * (1 - smooth(hw * .9, hw * 1.6, Math.abs(c.S[i] - s0))); }
  c.sIn = CAVE_IN; c.ends = [{ s: 0, i: 0, x: c.X[0], z: c.Z[0] }]; if (!c.dead) c.ends.push({ s: c.L, i: n - 1, x: c.X[n - 1], z: c.Z[n - 1] });
  return c;
}
// 每一側的牆最多能離曲線多遠：從取樣點往 ±n 推出去，一旦推過了曲率中心（或碰到另一段曲線），離曲線最近的就不再是自己，牆在這裡會往回摺。
// 牆只放到這個「可及距離」的 0.8 倍（再留 12% 給凹凸），沿曲線平滑後存成 c.WL／c.WR＝左（−n）／右（+n）兩側實際的半寬（7.1）
function caveSides(c) {
  const n = c.n, X = c.X, Z = c.Z, e = 30, ex = [X[0] - c.TX[0] * e, Z[0] - c.TZ[0] * e, X[n - 1] + c.TX[n - 1] * e, Z[n - 1] + c.TZ[n - 1] * e]; // 兩端往外延伸：曲線的端點不算「另一段」
  const seg = (x, z, x0, z0, x1, z1) => { const sx = x1 - x0, sz = z1 - z0, t = clamp(((x - x0) * sx + (z - z0) * sz) / (sx * sx + sz * sz || 1e-9), 0, 1), dx = x - x0 - sx * t, dz = z - z0 - sz * t; return dx * dx + dz * dz; };
  const near = (x, z) => { let b = Math.min(seg(x, z, ex[0], ex[1], X[0], Z[0]), seg(x, z, X[n - 1], Z[n - 1], ex[2], ex[3])); for (let j = 0; j < n - 1; j++) { const d = seg(x, z, X[j], Z[j], X[j + 1], Z[j + 1]); if (d < b) b = d; } return Math.sqrt(b); };
  const D = [new Float32Array(n), new Float32Array(n)]; // 每一側要比原本的半寬縮多少
  for (let i = 0; i < n; i++) for (let sd = 0; sd < 2; sd++) {
    const sg = sd ? 1 : -1, nx = -c.TZ[i] * sg, nz = c.TX[i] * sg, ok = l => near(X[i] + nx * l, Z[i] + nz * l) > l * .97 - .02, need = c.Wd[i] * 1.12 / .8;
    if (ok(need)) continue; let r = 0; while (r + .25 < need && ok(r + .25)) r += .25; let hi = r + .25; for (let it = 0; it < 6; it++) { const m = (r + hi) / 2; if (ok(m)) r = m; else hi = m; }
    D[sd][i] = c.Wd[i] - r * .8 / 1.12;
  }
  // 縮的量沿曲線平滑：先取 ±2 公尺內的最大值、再取平均（結果不會少於原本要縮的量），內側的牆才是一條順的曲線；不用縮的地方維持原本的半寬
  const W = D.map(Dv => { const m = Dv.map((_, i) => { let v = 0; for (let j = Math.max(0, i - 4); j <= Math.min(n - 1, i + 4); j++) v = Math.max(v, Dv[j]); return v; }); return Float32Array.from(Dv, (_, i) => { let t = 0, k = 0; for (let j = Math.max(0, i - 4); j <= Math.min(n - 1, i + 4); j++) { t += m[j]; k++; } return c.Wd[i] - t / k; }); });
  c.WL = W[0]; c.WR = W[1];
}
const caveW = (c, i, l) => (l < 0 ? c.WL : c.WR)[i]; // 第 i 個取樣、l 那一側的實際半寬
const caveFloorE = () => LOW ? .65 : .743; // 斷面上平地的邊緣（caveProfile 依弧長取點：14 點時在 0.743 倍半寬，LOW 的 8 點時在 0.65 倍），再往外就是牆腳的斜面
const caveLavaL = (c, i) => -(caveFloorE() * c.WL[i] - .42); // 熔岩溝的中心：左側平地的邊緣往內 0.42 公尺（溝寬 0.7，整條都在平地上，不會埋進牆腳的斜面）
const caveLakeR = c => Math.min(c.Wd[c.hallI] * .55, 5.2, c.hall.r - .5); // 月光地下湖的半徑（湖心＝大廳的中心）
// 月光洞窟湖邊的石碑：大廳就在死路的盡頭，湖心離最後一圈只有 3.5 公尺，湖伸進了洞底的圓頂。原本石碑沿著洞軸的法線擺在最後一圈（0.55 倍半寬），
// 靠大廳那一頭站在湖裡、正面腳下的晶體泡在水裡，背後和牆之間又留了一條走得進去的縫。改成從湖心往原本那一點的方向、站在湖岸外 0.62 公尺，正面對著湖心：
// 底座與晶體都在岸上，背後靠著牆腳（走不進去），從大廳走進來看得到正面
function caveStele(c, i, side) { const d = .55 * caveW(c, i, side), h = c.hall, dx = c.X[i] - c.TZ[i] * side * d - h.x, dz = c.Z[i] + c.TX[i] * side * d - h.z, dl = Math.hypot(dx, dz) || 1, R = caveLakeR(c) + .62; return { x: h.x + dx / dl * R, z: h.z + dz / dl * R }; }
// 查詢：最近的取樣（從上一次的位置附近找）→ 投影到線段上，算出沿曲線的距離 s、橫向距離 l、地面高度
const CQ = { s: 0, l: 0, y: 0, w: 0, h: 0, i: 0, nx: 0, nz: 0, cx: 0, cz: 0 };
function caveQ(c, x, z, i0) {
  const n = c.n, X = c.X, Z = c.Z, a = i0 == null ? 0 : Math.max(0, i0 - 30), b = i0 == null ? n - 1 : Math.min(n - 1, i0 + 30); let bi = a, bd = 1e18;
  for (let i = a; i <= b; i++) { const dx = x - X[i], dz = z - Z[i], d = dx * dx + dz * dz; if (d < bd) { bd = d; bi = i; } }
  const j = bi > 0 && (bi === n - 1 || (x - X[bi]) * c.TX[bi] + (z - Z[bi]) * c.TZ[bi] < 0) ? bi - 1 : bi;
  const sx = X[j + 1] - X[j], sz = Z[j + 1] - Z[j], sl = Math.hypot(sx, sz) || 1e-6, ux = sx / sl, uz = sz / sl;
  let t = ((x - X[j]) * ux + (z - Z[j]) * uz) / sl; const tc = clamp(t, 0, 1); if (j > 0 && j < n - 2) t = tc;
  CQ.i = bi; CQ.s = c.S[j] + t * sl; CQ.nx = -uz; CQ.nz = ux; CQ.cx = X[j] + sx * tc; CQ.cz = Z[j] + sz * tc;
  CQ.l = (x - CQ.cx) * CQ.nx + (z - CQ.cz) * CQ.nz; const sw = CQ.l < 0 ? c.WL : c.WR; // w＝人所在那一側的實際半寬（彎道內側比較窄）
  CQ.y = c.Y[j] + (c.Y[j + 1] - c.Y[j]) * tc; CQ.w = sw[j] + (sw[j + 1] - sw[j]) * tc; CQ.h = c.Hh[j] + (c.Hh[j + 1] - c.Hh[j]) * tc;
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
  const T = c.T, ak = T.ak || .72, r = T.amb.r * ak, g = T.amb.g * ak, b = T.amb.b * ak; let R = r, G2 = g, B = b;
  const add = (col, k) => { R += col.r * k; G2 += col.g * k; B += col.b * k; };
  add(c.lightA, 1.25 * Math.exp(-s / 6.5)); if (!c.dead) add(c.lightB, 1.35 * Math.exp(-(c.L - s) / 7));
  for (const sh of c.shafts) { const d = Math.hypot(x - sh.x, z - sh.z); add(sh.col, sh.k * Math.exp(-d * d / (sh.r * sh.r)) * (yn < .15 ? 1.2 : .75)); }
  for (const m of c.moss) { const d2 = (x - m.x) ** 2 + (y - m.y) ** 2 + (z - m.z) ** 2; if (d2 < 30) add(c.mossC, .75 * Math.exp(-d2 / 3.2)); }
  for (const p of c.spots) { const d2 = (x - p.x) ** 2 + (y - p.y) ** 2 + (z - p.z) ** 2; if (d2 < p.r * p.r * 6) add(p.col, p.k * Math.exp(-d2 / (p.r * p.r))); } // 局部的光（壁畫、熔岩小池、蘑菇角落）：不加光源，烘進牆與小物件
  // 熔岩溝：近處很亮，再加一層照得比較遠的暖光（整條隧道都看得出牆的形狀）
  if (c.lava) { const q = caveQ(c, x, z, null); if (q.s > c.lava.s0 - 3 && q.s < c.lava.s1 + 3) { const d = Math.hypot(q.l - caveLavaL(c, q.i), (y - q.y) * 1.5), e = smooth(c.lava.s0 - 3, c.lava.s0, q.s) * (1 - smooth(c.lava.s1, c.lava.s1 + 3, q.s)); add(c.lavaC, e * (.8 * Math.exp(-d * d / 3.2) + .3 * Math.exp(-d * d / 18))); } }
  const k = 1.06 - .38 * yn; out.setRGB(R * k, G2 * k, B * k); return out;
}
// 管子：先算每一圈的頂點（位置＋烘焙的光），再拆成一個一個三角面、每面一個顏色——和月光谷其他低多邊形的東西一樣看得到稜角
const caveHash = (a, b) => { const v = Math.sin(a * 127.1 + b * 311.7) * 43758.5453; return v - Math.floor(v); };
function caveTube(c, i0, i1, N, mask) {
  // 圈距：彎道外側每一圈前進 (1+κw)·Δs，越彎、越寬的地方圈就越密，外側的牆最長 2 公尺（LOW 3 公尺）一段，不會被拉成一大片；直的地方維持 1.5 公尺（LOW 2.5 公尺）
  const prof = caveProfile(N), base = (LOW ? 2.5 : 1.5) / CAVE_STEP, edge = (LOW ? 3 : 2) / CAVE_STEP, rings = [i0];
  for (let i = i0; i < i1;) { const g = 1 + Math.abs(c.KA[i]) * Math.max(c.WL[i], c.WR[i]); i = Math.min(i1, i + clamp(Math.floor(edge / g + 1e-6), 1, base)); rings.push(i); }
  const R = rings.length, VP = new Float32Array(R * N * 3), VB = new Float32Array(R * N * 3), VT = new Float32Array(R * N * 3), VY = new Float32Array(R * N), VL = new Float32Array(R * N), RC = new Float32Array(R * 3), RS = new Float32Array(R), RY = new Float32Array(R);
  const tc = new THREE.Color(), base0 = new THREE.Color(), rk = c.T.rockC, rk2 = c.T.rock2C, wet = c.T.wetC, sh0 = c.shafts[0], pit = mask === 2 ? c.icePit : null;
  rings.forEach((si, ri) => {
    const s = c.S[si], cx = c.X[si], cz = c.Z[si], nx = -c.TZ[si], nz = c.TX[si], wl = c.WL[si], wr = c.WR[si], h = c.Hh[si], fy = c.Y[si], lv = new Float32Array(N * 2);
    RC[ri * 3] = cx; RC[ri * 3 + 1] = fy + h * .45; RC[ri * 3 + 2] = cz; RS[ri] = s; RY[ri] = fy;
    const jit = smooth(CAVE_L0 - 1, CAVE_L0 + 3, Math.min(s, c.dead ? 1e9 : c.L - s)); // 洞口直段不加凹凸：和地形挖的洞剛好吻合
    prof.forEach(([px, py], k) => {
      const w = px < 0 ? wl : wr, floor = py < .02, nn = vnoise(s * .45 + k * 3.1, k * .7, 31) - .5, nn2 = vnoise(s * 1.3, k * 1.9, 37) - .5;
      let amp = floor ? 0 : (.2 * Math.min(w, h * .6) * nn + .09 * nn2) * jit;
      if (sh0 && py > .8) amp *= smooth(sh0.r * .5, sh0.r * .5 + 2.5, Math.hypot(cx + nx * px * w - sh0.x, cz + nz * px * w - sh0.z)); // 光柱的天窗周圍洞頂是平順的，天窗才是完整的圓
      const len = Math.hypot(px, py - .45) || 1, ox = px / len, oy = (py - .45) / len;
      const lx = px * w + ox * amp, ly = floor ? 0 : py * h + oy * amp * .6;
      const x = cx + nx * lx, z = cz + nz * lx, y = fy + ly, o = (ri * N + k) * 3; VP[o] = x; VP[o + 1] = y; VP[o + 2] = z; VY[ri * N + k] = ly; VL[ri * N + k] = lx; lv[k * 2] = lx; lv[k * 2 + 1] = ly;
      base0.copy(rk).lerp(rk2, clamp(.5 + nn * 1.6 + py * .25, 0, 1)); if (floor) base0.lerp(wet, .45);
      const ao = (floor ? 1 : 1 + nn * .7 * jit) * (py < .16 && Math.abs(px) > .8 ? .72 : 1); // 凹處暗、凸處亮、牆角陰影
      // 底色與光分開記：每一面先算岩層、礦脈、濕潤（改的是底色），最後才乘上光、加上濕岩面的反光
      caveLight(c, s, x, y, z, py, tc); VB[o] = base0.r; VB[o + 1] = base0.g; VB[o + 2] = base0.b; VT[o] = tc.r * ao; VT[o + 1] = tc.g * ao; VT[o + 2] = tc.b * ao;
    });
    // 每一圈的斷面（相對於曲線的 l、y）記下來：小物件、鐘乳石、壁畫、死路的圓頂都依實際的牆面擺放
    const rs = c.rings || (c.rings = []); if (!rs.length || rs[rs.length - 1].i !== si) rs.push({ i: si, s, v: lv });
  });
  const th = c.th, T = (R - 1) * N * 2 + (th === 'lava' ? (R - 1) * N : 0), pos = new Float32Array(T * 9), col = new Float32Array(T * 9); // 熔岩另外留空間給裂縫條（月光洞窟的紫水晶改成立體的晶簇，在 caveProps）
  const SF = c.SF, glowL = caveCol('#ff8a3d'), deepB = caveCol('#6fb7ff'), frost = caveCol('#f4faff'), tint = new THREE.Color(), fc2 = new THREE.Color(), alb = new THREE.Color(), lit = new THREE.Color(), gk = 1.28 / (1.28 + (c.T.exp || 0)), hs = c.S[c.hallI], hwH = c.Wd[c.hallI];
  const A = new THREE.Vector3(), B = new THREE.Vector3(), C = new THREE.Vector3(), E1 = new THREE.Vector3(), E2 = new THREE.Vector3(), Nn = new THREE.Vector3(), fc = new THREE.Color(), M = new THREE.Vector3(); let o = 0;
  const put = (a, b, d, col3) => { for (const v of [a, b, d]) { pos[o] = v.x; pos[o + 1] = v.y; pos[o + 2] = v.z; col[o] = col3.r; col[o + 1] = col3.g; col[o + 2] = col3.b; o += 3; } };
  const avg3 = (V, ia, ib, ic, out) => out.setRGB((V[ia * 3] + V[ib * 3] + V[ic * 3]) / 3, (V[ia * 3 + 1] + V[ib * 3 + 1] + V[ic * 3 + 1]) / 3, (V[ia * 3 + 2] + V[ib * 3 + 2] + V[ic * 3 + 2]) / 3);
  const inPit = v => (v.x - pit.x) ** 2 + (v.z - pit.z) ** 2 < pit.r * pit.r;
  // LOW（pit.any）：碰到坑口這個圓的地面三角形都挖掉，挖空的範圍一定包住整個圓。原本要三個頂點都在圓裡，LOW 的地面一圈只有三個頂點、三角形又大，
  // 圓要放大到整個平地才挖得出一小塊，坑口（挖空範圍裡最大的圓）只剩 0.47 公尺，冰柱的倒影一根都長不出來
  const segD = (a, b) => { const ex = b.x - a.x, ez = b.z - a.z, t = clamp(((pit.x - a.x) * ex + (pit.z - a.z) * ez) / (ex * ex + ez * ez || 1), 0, 1); return Math.hypot(a.x + ex * t - pit.x, a.z + ez * t - pit.z); };
  const touchPit = (a, b, d) => { const s1 = (b.x - a.x) * (pit.z - a.z) - (b.z - a.z) * (pit.x - a.x), s2 = (d.x - b.x) * (pit.z - b.z) - (d.z - b.z) * (pit.x - b.x), s3 = (a.x - d.x) * (pit.z - d.z) - (a.z - d.z) * (pit.x - d.x); return (s1 >= 0 && s2 >= 0 && s3 >= 0) || (s1 <= 0 && s2 <= 0 && s3 <= 0) || Math.min(segD(a, b), segD(b, d), segD(d, a)) < pit.r; };
  // 一格（同一圈到下一圈之間的四邊形，兩個三角形）共用的資料：岩層、潮線、礦脈、濕潤、反光都看整格，兩個三角形才不會一亮一暗排成鋸齒
  const Q = { y: 0, y0: 0, y1: 0, yr: 0, sf: 0, lr: 0, flr: false, hz: 0, N: new THREE.Vector3() }, QA = new THREE.Vector3(), QB = new THREE.Vector3();
  const quad = (a, b, cc, d, r, k) => {
    let y = 0, y0 = 1e9, y1 = -1e9, yr = 0, l = 0, fl = true; for (const v of [a, b, cc, d]) { const wy = VP[v * 3 + 1]; y += wy; y0 = Math.min(y0, wy); y1 = Math.max(y1, wy); yr += VY[v]; l += VL[v]; if (VY[v] >= .01) fl = false; }
    Q.y = y / 4; Q.y0 = y0 - RY[r]; Q.y1 = y1 - RY[r]; Q.yr = yr / 4; Q.lr = l / 4; Q.sf = (RS[r] + RS[r + 1]) / 2; Q.flr = fl; Q.hz = caveHash(Q.sf * 1.31 + k * 7.7, k * 2.9 + r * .37);
    QA.fromArray(VP, cc * 3).sub(E1.fromArray(VP, a * 3)); QB.fromArray(VP, d * 3).sub(E2.fromArray(VP, b * 3)); Q.N.crossVectors(QA, QB).normalize();
    const mx = (VP[a * 3] + VP[cc * 3]) / 2, mz = (VP[a * 3 + 2] + VP[cc * 3 + 2]) / 2; if (Q.N.x * (RC[r * 3] - mx) + Q.N.y * (RC[r * 3 + 1] - Q.y) + Q.N.z * (RC[r * 3 + 2] - mz) < 0) Q.N.negate();
  };
  const tri = (ia, ib, ic, r, k) => {
    A.fromArray(VP, ia * 3); B.fromArray(VP, ib * 3); C.fromArray(VP, ic * 3);
    if (pit && VY[ia] < .01 && VY[ib] < .01 && VY[ic] < .01 && (pit.any ? touchPit(A, B, C) : inPit(A) && inPit(B) && inPit(C))) { pit.cut.push(A.x, A.z, B.x, B.z, C.x, C.z); return; } // 冰面底下的坑：地面挖空（坑是 caveHall 另外做的碗）；挖掉的範圍記下來，霜邊要蓋住它的直邊
    Nn.crossVectors(E1.subVectors(B, A), E2.subVectors(C, A)); const area = Nn.length() / 2; Nn.normalize();
    const mx = (A.x + B.x + C.x) / 3, my = (A.y + B.y + C.y) / 3, mz = (A.z + B.z + C.z) / 3; if (Nn.x * (RC[r * 3] - mx) + Nn.y * (RC[r * 3 + 1] - my) + Nn.z * (RC[r * 3 + 2] - mz) < 0) Nn.negate();
    const yr = (VY[ia] + VY[ib] + VY[ic]) / 3, hz = caveHash(c.S[rings[r]] * 1.7 + k, k * 3.3 + o * .001), sf = Q.sf, side = Q.lr < 0 ? -1 : 1, flr = Q.flr, wall = !flr && Q.N.y > -.5;
    const si = rings[r], hh = c.Hh[si], ww = side < 0 ? c.WL[si] : c.WR[si];
    avg3(VB, ia, ib, ic, alb); avg3(VT, ia, ib, ic, lit);
    let sh = th === 'ice' ? .86 + .14 * Nn.y + (hz - .5) * .1 : .76 + .24 * Nn.y + (hz - .5) * .14, deco = 0, wk = 0, vk = 0, vc = null;
    // ① 岩層：依世界高度一層一層（帶一點起伏，不是死板的水平線），每層的明暗、色調略有不同
    if (!flr) { const b = Math.floor((Q.y + .35 * Math.sin(sf * .061 + side) + .12 * Math.sin(sf * .29 + side * 2)) / SF.lam), bh = caveHash(b * 1.37 + .5, 7.1 + side * .3); alb.multiply(SF.tintC[bh < .55 ? 0 : bh < .8 ? 1 : 2]).multiplyScalar(1 - SF.sk / 2 + SF.sk * bh); }
    // ② 每個洞自己的底色
    if (th === 'sea') {
      const tide = 1.35 + .22 * Math.sin(sf * .09) + .1 * Math.sin(sf * .31);
      if (flr) alb.lerp(SF.sandC, .38 * Math.max(smooth(16, 5, sf), smooth(c.L - 16, c.L - 5, sf), 1 - smooth(hwH * .6, hwH * 1.4, Math.abs(sf - hs))) * (.55 + .45 * Q.hz)); // 洞口與大廳的地上積了沙
      else if (wall) { if (Q.y1 <= tide) alb.lerp(SF.algC, .26 * (1 - Q.yr / tide)); else alb.lerp(SF.tideC, Q.y0 >= tide ? .05 : .16); } // 潮間帶：潮線以下帶一點藻綠、潮線那一圈與以上乾一點、泛著鹽白
    } else if (th === 'lava') {
      if (flr) { if (Q.hz > .7) alb.lerp(SF.ashC, .3); } else if (Q.yr > hh * .55) alb.multiplyScalar(1 - .28 * SF.soot * smooth(hh * .55, hh * .9, Q.yr)); // 地上一塊塊火山灰；洞頂被燻黑
      if (yr > .25 && yr < 1.6 && Math.abs(Nn.y) < .45 && hz > .9 && area > .15 && A.distanceTo(B) < 2.2) deco = 1; // 牆上偶爾一道發紅的裂縫
    } else if (th === 'ice') {
      if (flr) { if (Q.hz > .55) alb.lerp(frost, .4); } // 地上一塊塊結霜（其他是透明的冰）
      else { const kb = smooth(1.6, 2.8, Q.yr); if (kb > 0) alb.lerp(fc2.copy(alb).multiply(tint.copy(deepB).lerp(frost, 1 - .5 * smooth(2.2, 6, Q.yr))).multiplyScalar(1.15), kb); } // 往上漸漸透出外面的藍光
    } else if (flr && Q.hz > .93) alb.lerp(SF.veinC, .12); // 月光洞窟：地上零星的螢光苔
    // ③ 礦脈：斜斜穿過牆面的幾條線，線經過的那幾格換成礦脈的顏色（旁邊的格淡淡沾一點）
    if (wall) for (const v of c.veins) { if (v.side !== side || sf < v.s0 || sf > v.s1) continue; const yl = v.y0 + v.k * (sf - v.s0) + v.a * Math.sin(sf * v.f + v.p), d = Math.abs(yl - Q.y) / ((Q.y1 - Q.y0) / 2 + .02); if (d > 1.15) continue; const q = (d < .62 ? 1 : .3) * Math.min(1, (sf - v.s0) / 1.5, (v.s1 - sf) / 1.5); if (q > vk) { vk = q; vc = v.c; } }
    if (vk > 0 && !SF.vg) alb.lerp(vc, SF.vk * vk);
    // ④ 濕潤：牆腳一段（高度沿洞起伏）、靠牆的地面、幾道從上面滲下來的濕痕——底色變深、偏濕的色調
    if (SF.wetH > 0) {
      const wh = SF.wetH * (.75 + .5 * vnoise(sf * .13, side * 3 + 1, 53));
      wk = flr ? (th === 'ice' ? 0 : .22 * smooth(.5, .95, Math.abs(Q.lr) / ww)) : Q.N.y > -.3 ? smooth(wh, wh * .3, Q.yr) : 0;
      for (const sp of c.seeps) if (sp.side === side && Math.abs(sf - sp.s) < sp.w && (flr ? th !== 'ice' && Math.abs(Q.lr) > ww * .45 : Q.yr < hh * .8)) wk = Math.max(wk, (1 - Math.abs(sf - sp.s) / sp.w) * (flr ? .35 : 1));
      if (wk > 0) alb.lerp(fc2.copy(c.T.wetC).lerp(alb, .45), .4 * wk).multiplyScalar(1 - .18 * wk);
    }
    fc.copy(alb).multiply(lit).multiplyScalar(sh);
    if (vk > 0 && SF.vg) fc.lerp(fc2.copy(vc).multiplyScalar(gk * (.5 + .3 * hz)), SF.vk * vk); // 會發光的礦脈（月光洞窟）：淡淡的，不跟著環境光走
    // ⑤ 濕岩面的反光：整格朝向「站在通道中間的人」又朝上的（牆腳的斜面最明顯）亮一點，低多邊形的一面一色就有濕亮的感覺（地面不加：一格亮一格暗會變成棋盤）
    if (wk > .05 && SF.gloss > 0 && !flr) { const qx = RC[r * 3] - mx, qy = RY[r] + 1.6 - Q.y, qz = RC[r * 3 + 2] - mz, el = Math.hypot(qx, qy, qz) || 1, hx = qx / el, hy = qy / el + 1, hq = qz / el, hl = Math.hypot(hx, hy, hq), sp = Math.pow(Math.max(0, (Q.N.x * hx + Q.N.y * hy + Q.N.z * hq) / hl), 3); fc.add(fc2.copy(SF.glossCC).multiplyScalar(SF.gloss * sp * wk * (lit.r + lit.g + lit.b) * .3)); }
    put(A, B, C, fc);
    if (deco === 1) { // 裂縫：沿著三角形的一條邊、很細的一道發光條（往洞裡浮 4 公分：熔岩的熱氣會讓遠處的頂點晃動，太貼牆會一下子被牆蓋住）
      M.addVectors(A, B).multiplyScalar(.5); E1.copy(C).sub(M).multiplyScalar(.07).add(M).addScaledVector(Nn, .04); const a2 = E2.copy(A).lerp(B, .2).addScaledVector(Nn, .04), b2 = M.copy(B).lerp(A, .2).addScaledVector(Nn, .04);
      put(a2, b2, E1, fc2.copy(glowL).multiplyScalar(.65 * gk));
    }
  };
  for (let r = 0; r < R - 1; r++) for (let k = 0; k < N; k++) { const k1 = (k + 1) % N, a = r * N + k, b = (r + 1) * N + k, cc = (r + 1) * N + k1, d = r * N + k1; quad(a, b, cc, d, r, k); tri(a, b, d, r, k); tri(b, cc, d, r, k); }
  const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.BufferAttribute(pos.slice(0, o), 3)); geo.setAttribute('color', new THREE.BufferAttribute(col.slice(0, o), 3)); geo.computeBoundingSphere();
  const m = new THREE.Mesh(geo, c.mat); m.layers.mask = mask; m.userData.rings = rings; return m;
}
// 某個 s 的實際斷面：前後兩圈的斷面（l, y）內插（caveTube 建好之後才有）
const CAVE_SL = new Float32Array(64);
function caveSlice(c, s) {
  const R = c.rings; let a = 0, b = R.length - 1; while (b - a > 1) { const m = (a + b) >> 1; if (R[m].s <= s) a = m; else b = m; }
  const r0 = R[a], r1 = R[b], t = clamp((s - r0.s) / Math.max(1e-6, r1.s - r0.s), 0, 1), n = r0.v.length; for (let k = 0; k < n; k++) CAVE_SL[k] = r0.v[k] + (r1.v[k] - r0.v[k]) * t; return n / 2;
}
// 斷面上 l 這條垂直線碰到的最高點（top：實際的洞頂）或最低點（地面、牆腳的斜面），都是離地面的高度
function caveVert(c, s, l, top) { const N = caveSlice(c, s), v = CAVE_SL; let best = top ? -1e9 : 1e9; for (let k = 0; k < N; k++) { const k1 = (k + 1) % N, l0 = v[k * 2], l1 = v[k1 * 2]; if (l0 === l1 || (l0 - l) * (l1 - l) > 0) continue; const y = v[k * 2 + 1] + (v[k1 * 2 + 1] - v[k * 2 + 1]) * (l - l0) / (l1 - l0); if (top ? y > best : y < best) best = y; } return Math.abs(best) > 1e8 ? 0 : best; }
const caveCeil = (c, s, l) => caveVert(c, s, l, true);
// (l, y) 在不在實際斷面的多邊形裡（空氣裡）；y 是離曲線地面的高度。caveVert 在斷面外面（牆裡）找不到交點會回 0，分不出「平地」和「牆裡」，要用這個
function caveIn(c, s, l, y) { const N = caveSlice(c, s), v = CAVE_SL; let ins = false; for (let k = 0, j = N - 1; k < N; j = k++) { const lk = v[k * 2], yk = v[k * 2 + 1], lj = v[j * 2], yj = v[j * 2 + 1]; if ((yk > y) !== (yj > y) && l < (lj - lk) * (y - yk) / (yj - yk) + lk) ins = !ins; } return ins; }
// 實際的牆面（離曲線的橫向距離）：高度 y、side（±1）那一側
function caveWallL(c, s, side, y) { const N = caveSlice(c, s), v = CAVE_SL; let best = 0; for (let k = 0; k < N; k++) { const k1 = (k + 1) % N, y0 = v[k * 2 + 1], y1 = v[k1 * 2 + 1]; if (y0 === y1 || (y0 - y) * (y1 - y) > 0) continue; const l = v[k * 2] + (v[k1 * 2] - v[k * 2]) * (y - y0) / (y1 - y0); if (l * side > best * side) best = l; } return best; }
// 死路的盡頭：管子最後一圈（含凹凸）往外收成一個圓頂（不是一片平面），和洞壁一樣一面一個顏色
function caveCap(c, N, mask) {
  const si = c.n - 1, cx = c.X[si], cz = c.Z[si], tx = c.TX[si], tz = c.TZ[si], nx = -tz, nz = tx, h = c.Hh[si], fy = c.Y[si], K2 = 4, tc = new THREE.Color(), lv = c.rings[c.rings.length - 1].v, wm = Math.max(c.WL[si], c.WR[si]);
  const ring = (k2) => { const f = Math.cos(k2 / K2 * Math.PI / 2), out = Math.sin(k2 / K2 * Math.PI / 2) * Math.min(wm, h) * .7; return Array.from({ length: N }, (_, k) => { const l = lv[k * 2], y = lv[k * 2 + 1], yy = y < .01 ? 0 : (y - h * .45) * f + h * .45; return [cx + nx * l * f + tx * out, fy + Math.max(0, yy), cz + nz * l * f + tz * out]; }); };
  const R = Array.from({ length: K2 + 1 }, (_, k2) => ring(k2)), pos = [], col = [], base = new THREE.Color(), A = new THREE.Vector3(), B = new THREE.Vector3(), C = new THREE.Vector3(), E1 = new THREE.Vector3(), E2 = new THREE.Vector3(), Nn = new THREE.Vector3();
  const tri = (a, b, d) => { A.set(a[0], a[1], a[2]); B.set(b[0], b[1], b[2]); C.set(d[0], d[1], d[2]); Nn.crossVectors(E1.subVectors(B, A), E2.subVectors(C, A)).normalize(); const mx = (A.x + B.x + C.x) / 3, my = (A.y + B.y + C.y) / 3, mz = (A.z + B.z + C.z) / 3; if (Nn.x * (cx - tx * 2 - mx) + Nn.y * (fy + h * .45 - my) + Nn.z * (cz - tz * 2 - mz) < 0) Nn.negate(); caveLight(c, c.L, mx, my, mz, clamp((my - fy) / h, 0, 1), tc); const hz = caveHash(mx, mz); base.copy(c.T.rockC).lerp(c.T.rock2C, clamp(.35 + (hz - .5) * .9 + (my - fy) / h * .25, 0, 1)); const k = (.76 + .24 * Nn.y) * (.93 + hz * .14); for (const v of [A, B, C]) { pos.push(v.x, v.y, v.z); col.push(base.r * tc.r * k, base.g * tc.g * k, base.b * tc.b * k); } };
  for (let k2 = 0; k2 < K2; k2++) for (let k = 0; k < N; k++) { const k1 = (k + 1) % N; tri(R[k2][k], R[k2 + 1][k], R[k2][k1]); tri(R[k2 + 1][k], R[k2 + 1][k1], R[k2][k1]); }
  const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3)); geo.computeBoundingSphere();
  const m = new THREE.Mesh(geo, c.mat); m.layers.mask = mask; m.userData.cap = true; return m;
}
// 檢查：相鄰兩圈的同一個斷面點沿著切線往回走＝牆往回摺（7.1）；有的話在主控台警告，改控制點時一眼就看得到
function caveCheck(c) {
  const R = c.rings; let bad = 0;
  for (let r = 0; r + 1 < R.length; r++) {
    const a = R[r], b = R[r + 1], tx = c.TX[a.i] + c.TX[b.i], tz = c.TZ[a.i] + c.TZ[b.i];
    for (let k = 0; k < a.v.length / 2; k++) {
      const la = a.v[k * 2], lb = b.v[k * 2], dx = c.X[b.i] - c.TZ[b.i] * lb - c.X[a.i] + c.TZ[a.i] * la, dz = c.Z[b.i] + c.TX[b.i] * lb - c.Z[a.i] - c.TX[a.i] * la;
      if (dx * tx + dz * tz <= 0 && ++bad < 4) console.warn(`[山洞] ${c.def.name} s=${a.s.toFixed(1)} 第 ${k} 個斷面點往回摺：控制點的彎太急了`);
    }
  }
  c.foldN = bad; return bad;
}
// 地上一道淡淡的發光痕跡，顏色＝那一區的主色，一路帶到出口（4.4）
// 貼圖的一個週期＝1.6 公尺 × 0.26 公尺，畫布 128×20：一個貼圖像素在地上差不多是正方形，畫上去的圓點在地上才是圓的（兩顆，間隔 0.8 公尺）；
// 圓點在條帶邊緣之前就淡到 0（不會被切成硬邊的長條），再開非等向過濾，遠處的點不會糊成一條線
function caveTrail(c) {
  const pos = [], uv = [], idx = [], hw = .13; let k = 0;
  for (let i = 0; i < c.n; i += 2) { const x = c.X[i], z = c.Z[i], nx = -c.TZ[i], nz = c.TX[i], y = c.Y[i] + .035, sOff = (vnoise(c.S[i] * .2, 3, 41) - .5) * .5 * smooth(8, 14, c.S[i]); pos.push(x + nx * (sOff - hw), y, z + nz * (sOff - hw), x + nx * (sOff + hw), y, z + nz * (sOff + hw)); uv.push(c.S[i] / 1.6, 0, c.S[i] / 1.6, 1); if (k) idx.push(2 * k - 2, 2 * k - 1, 2 * k, 2 * k - 1, 2 * k + 1, 2 * k); k++; }
  const tex = caveTex('trail2', 128, 20, (g, w, h) => { for (const cx of [w * .25, w * .75]) { const r = g.createRadialGradient(cx, h / 2, 0, cx, h / 2, 8.5); r.addColorStop(0, 'rgba(255,255,255,1)'); r.addColorStop(.45, 'rgba(255,255,255,.7)'); r.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = r; g.fillRect(cx - 9, 0, 18, h); } }).clone();
  tex.wrapS = THREE.RepeatWrapping; tex.anisotropy = Math.min(LOW ? 4 : 8, W.r.capabilities.getMaxAnisotropy()); tex.needsUpdate = true;
  const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); geo.setIndex(idx);
  const m = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color: caveCol(c.T.trail2 || c.T.trail), map: tex, transparent: true, opacity: c.T.trailA || .8, depthWrite: false, blending: THREE.AdditiveBlending, fog: false }));
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
// 粒子：每一顆自己決定怎麼動（md），整個洞合成一組、一次繪製；位置在 GPU 上依時間計算，不必每格畫面更新
// 0 水滴（掛在鐘乳石尖端慢慢長大，再照重力落下，越掉越快、拉成長條）、1 水花（同一滴水落地那一刻往外濺的小水珠，和水滴同一個相位）、
// 2 火星（往上飄、左右晃、閃爍著淡出）、3 閃光（原地閃一下）、4 微塵（慢慢漂）、5 螢光蟲（繞著小圈慢慢飛、一明一暗）、6 熱氣（一大團很淡的光，往上飄、散開）
const CAVE_PM = { drip: 0, splash: 1, spark: 2, glint: 3, mote: 4, fly: 5, heat: 6 };
function caveParticles(c, list) {
  const n = list.length, pos = new Float32Array(n * 3), pa = new Float32Array(n * 4), pb = new Float32Array(n * 4), an = new Float32Array(n);
  list.forEach((p, i) => { pos[i * 3] = p.x; pos[i * 3 + 1] = p.y; pos[i * 3 + 2] = p.z; pa[i * 4] = p.ph; pa[i * 4 + 1] = p.rt; pa[i * 4 + 2] = p.h; pa[i * 4 + 3] = p.md; pb[i * 4] = p.c.r; pb[i * 4 + 1] = p.c.g; pb[i * 4 + 2] = p.c.b; pb[i * 4 + 3] = p.sz; an[i] = p.an || 0; });
  const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.BufferAttribute(pos, 3)); geo.setAttribute('pa', new THREE.BufferAttribute(pa, 4)); geo.setAttribute('pb', new THREE.BufferAttribute(pb, 4)); geo.setAttribute('an', new THREE.BufferAttribute(an, 1)); geo.computeBoundingSphere();
  const mat = new THREE.ShaderMaterial({
    uniforms: { t: W.wind, sz: { value: LOW ? 34 : 46 } },
    vertexShader: 'attribute vec4 pa; attribute vec4 pb; attribute float an; uniform float t; uniform float sz; varying vec3 vC; varying float vA; varying float vS;\n' +
      'void main(){ vec3 p = position; float ph = pa.x, rt = pa.y, h = pa.z, m = pa.w, a = 1.0, k = 1.0; vS = 1.0;\n' +
      ' if (m < 1.5) { float P = 1.0 / rt, tf = sqrt(2.0 * h / 9.8), T = fract(t * rt + ph) * P, T1 = P - 0.35;\n' +
      '   if (m < 0.5) { float T0 = T1 - tf; if (T < T0) { float g = T / T0; k = 0.35 + 0.65 * g; a = 0.3 + 0.7 * g; } else if (T < T1) { float u = T - T0; p.y -= 4.9 * u * u; vS = 1.0 + 2.2 * u / tf; } else a = 0.0; }\n' +
      '   else { float u = (T - T1) / 0.35; if (u < 0.0) a = 0.0; else { p.x += cos(an) * 0.17 * u; p.z += sin(an) * 0.17 * u; p.y += 0.7 * u * (1.0 - u); a = 1.0 - u; k = 0.75; } } }\n' +
      ' else if (m < 2.5) { float f = fract(t * rt + ph); p.y += f * h; p.x += sin(t * 1.7 + ph * 40.0) * 0.35 * f; p.z += cos(t * 1.3 + ph * 30.0) * 0.35 * f; a = (1.0 - f) * smoothstep(0.0, 0.08, f) * (0.75 + 0.25 * sin(t * 23.0 + ph * 50.0)); }\n' +
      ' else if (m < 3.5) { a = pow(max(0.0, sin(t * 2.2 * rt + ph * 60.0)), 12.0); }\n' +
      ' else if (m < 4.5) { p.y += sin(t * 0.4 + ph * 20.0) * h * 0.5; p.x += sin(t * 0.23 + ph * 9.0) * 0.6; p.z += cos(t * 0.19 + ph * 7.0) * 0.4; a = 0.45 + 0.55 * sin(t * 1.1 + ph * 30.0); }\n' +
      ' else if (m < 5.5) { p += vec3(sin(t * 0.31 * rt + ph * 7.0) * 0.8 + sin(t * 0.83 + ph * 3.0) * 0.2, sin(t * 0.53 * rt + ph * 11.0) * 0.3 * h + sin(t * 1.7 + ph * 5.0) * 0.05, cos(t * 0.27 * rt + ph * 5.0) * 0.8); a = 0.12 + 0.88 * smoothstep(0.3, 0.9, 0.5 + 0.5 * sin(t * 0.9 * rt + ph * 40.0)); }\n' +
      ' else { float f = fract(t * rt + ph); p.y += f * h; p.x += sin(t * 0.6 + ph * 9.0) * 0.25 * f; p.z += cos(t * 0.5 + ph * 7.0) * 0.25 * f; a = sin(f * 3.14159) * 0.3; k = 2.2 + 2.6 * f; }\n' +
      ' vA = a; vC = pb.rgb; vec4 mv = modelViewMatrix * vec4(p, 1.0); gl_PointSize = min(sz * pb.w * k * (0.6 + ph * 0.6) / -mv.z, 64.0); gl_Position = projectionMatrix * mv; }',
    fragmentShader: 'varying vec3 vC; varying float vA; varying float vS; void main(){ vec2 d = gl_PointCoord - 0.5; d.x *= vS; float r = 1.0 - smoothstep(0.1, 0.5, length(d)); gl_FragColor = vec4(vC * r * vA, 1.0); }',
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
  });
  const pts = new THREE.Points(geo, mat); pts.layers.mask = 2; pts.frustumCulled = false; return pts;
}
// 每個洞的粒子：滴水落在真的鐘乳石底下、火星從熔岩溝與熔岩小池冒出來、閃光在冰晶尖端、螢光蟲繞著蘑菇飛、光柱裡飄著微塵
function caveParticleList(c, rd) {
  const out = [], th = c.th, H_ = c.hallI, hy = c.hall.y, hh = c.Hh[H_], Q = LOW ? .42 : 1, r = (a, b) => a + rd() * (b - a), C = caveCol, M = CAVE_PM, pk = a => a[Math.min(a.length - 1, Math.floor(rd() * a.length))];
  const P = (x, y, z, md, h, cl, sz = 1, rt = 1, ph = rd(), an = 0) => out.push({ x, y, z, md, h, c: cl, sz, rt, ph, an });
  const rand = (sA, sB, lf) => { const s = r(sA, sB), i = clamp(Math.round(s / CAVE_STEP), 0, c.n - 1), f = r(-lf, lf), q = caveAtR(c, s, f * caveW(c, i, f)); return { x: q.x, y: q.y, z: q.z, i }; };
  // 水滴與落地的水花
  const dc = C({ sea: '#cdefff', ice: '#eaf7ff', moon: '#d8d0ff' }[th] || '#ffffff'), ns = LOW ? 2 : 3;
  (c.drips || []).forEach(d => { const ph = rd(), rt = 1 / r(2.8, 6); P(d.x, d.y, d.z, M.drip, d.h, dc, .75, rt, ph); for (let k = 0; k < ns; k++) P(d.x, d.fy + .02, d.z, M.splash, d.h, dc, .55, rt, ph, k / ns * Math.PI * 2 + rd()); });
  // 光柱裡的微塵：天窗照下來的那一錐光裡，慢慢飄
  const sh = c.shafts[0]; if (sh && sh.top) for (let k = 0; k < 26 * Q; k++) { const f = r(.1, .85), y = hy + f * (sh.top - hy), rr = sh.r * (1.05 - .73 * f) * .75 * Math.sqrt(rd()), a = r(0, 6.28); P(sh.x + Math.cos(a) * rr, y, sh.z + Math.sin(a) * rr, th === 'ice' ? M.glint : M.mote, .6, sh.col.clone().multiplyScalar(.75), .6, r(.6, 1.2)); }
  if (th === 'sea') {
    for (let k = 0; k < 18 * Q; k++) { const a = r(0, 6.28), d = Math.sqrt(rd()) * c.pool.r; P(c.pool.x + Math.cos(a) * d, hy + r(.08, .5), c.pool.z + Math.sin(a) * d, M.glint, 0, C('#7df9ff'), .6, r(.5, 1)); } // 潮池上一閃一閃的夜光藻
    for (let k = 0; k < 24 * Q; k++) { const p = rand(CAVE_L0 + 2, c.L - CAVE_L0 - 2, .8); P(p.x, p.y + r(.6, c.Hh[p.i] * .8), p.z, M.mote, .7, C('#9fd8f0').multiplyScalar(.7), .7); } // 通道裡的水氣
  } else if (th === 'lava') {
    for (let k = 0; k < 70 * Q; k++) { const s = r(c.lava.s0, c.lava.s1), i = clamp(Math.round(s / CAVE_STEP), 0, c.n - 1), q = caveAtR(c, s, caveLavaL(c, i) + r(-.22, .22)); P(q.x, q.y + .05, q.z, M.spark, r(1.2, 3), C(pk(['#ffae5c', '#ff8a3d', '#ffd166'])), r(.7, 1.1), 1 / r(4, 8)); } // 熔岩溝冒出來的火星
    for (let k = 0; k < 30 * Q; k++) { const a = r(0, 6.28), d = Math.sqrt(rd()) * c.hall.r * .5; P(c.hall.x + Math.cos(a) * d, hy + .2, c.hall.z + Math.sin(a) * d, M.spark, hh * r(.5, .9), C(pk(['#ffae5c', '#ffd166'])), r(.8, 1.2), 1 / r(5, 9)); } // 大廳中央的熱氣把火星帶上去
    for (let k = 0; k < 10 * Q; k++) { const s = r(c.lava.s0, c.lava.s1), i = clamp(Math.round(s / CAVE_STEP), 0, c.n - 1), q = caveAtR(c, s, caveLavaL(c, i)); P(q.x, q.y + .1, q.z, M.heat, r(1, 2), C('#ff8a3d').multiplyScalar(.45), r(1.2, 1.7), 1 / r(5, 8)); } // 熔岩溝上的熱氣
    const mg = c.magma; if (mg) { for (let k = 0; k < 18 * Q; k++) { const a = r(0, 6.28), d = Math.sqrt(rd()) * mg.r * .7; P(mg.x + Math.cos(a) * d, mg.y + .05, mg.z + Math.sin(a) * d, M.spark, r(.8, 2.4), C(pk(['#ffd166', '#ffae5c'])), r(.8, 1.2), 1 / r(2.5, 5)); } for (let k = 0; k < 6 * Q + 2; k++) P(mg.x + r(-.15, .15), mg.y + .1, mg.z + r(-.15, .15), M.heat, r(1.2, 2.2), C('#ff7a2e').multiplyScalar(.5), r(1.3, 1.8), 1 / r(4, 7)); }
  } else if (th === 'ice') {
    (c.glints || []).forEach(g => P(g.x, g.y, g.z, M.glint, 0, C(pk(['#ffffff', '#c7f4ff', '#ffe4f3'])), r(.8, 1.3), r(.45, 1.1))); // 冰晶尖端的閃光
    for (let k = 0; k < 16 * Q; k++) { const near = rd() < .5, p = rand(near ? 1 : c.L - 13, near ? 13 : c.L - 1, .8); P(p.x, p.y + r(.5, 2.6), p.z, M.mote, 1, C('#f4fbff').multiplyScalar(.7), .65); } // 洞口吹進來的雪花
  } else if (th === 'moon') {
    (c.worms || []).forEach(g => P(g.x, g.y, g.z, M.glint, 0, C('#8ff5ff'), .8, r(.35, .8))); // 洞頂的螢光蟲：像星空一樣慢慢閃
    (c.glints || []).forEach(g => P(g.x, g.y, g.z, M.glint, 0, C('#e9d5ff'), .9, r(.4, .9))); // 紫水晶的閃光
    const fly = (x, y, z) => P(x, y, z, M.fly, r(.6, 1.2), C(pk(['#d9f99d', '#a7f3d0', '#fde68a'])), r(.8, 1.15), r(.6, 1.2));
    (c.flies || []).forEach(f => fly(f.x, f.y, f.z));
    if (c.lake) for (let k = 0; k < 16 * Q; k++) { const a = r(0, 6.28), d = c.lake.r + r(.3, 2.5); fly(c.lake.x + Math.cos(a) * d, hy + r(.4, 1.6), c.lake.z + Math.sin(a) * d); } // 湖邊飛來飛去的螢光蟲
    for (let k = 0; k < 40 * Q; k++) { const p = rand(CAVE_L0, c.L - 2, .8); P(p.x, p.y + r(.6, c.Hh[p.i] * .75), p.z, M.mote, .8, C(c.T.pc), .9); } // 月光微塵
  }
  return out;
}
// 水窪：滴水底下、滲水腳下、小潮池（caveProps 決定位置）合併成一個網格（一次繪製）
function cavePuddles(c) {
  const L = c.puddles; if (!L || !L.length) return;
  if (c.lake) { L.length = 0; return; } // 月光洞窟：併進湖的網格會用到湖的深藍色，遠看像地上破了幾個黑洞——不放水窪，滴水直接濺在岩石上
  const pg = L.map(p => { const g = new THREE.CircleGeometry(p.r, p.k ? 22 : 14); g.rotateX(-Math.PI / 2); g.translate(p.x, p.y, p.z); return g; });
  const pm = new THREE.Mesh(mergeGeos(pg), caveWaterMat('#5cb0cc', '#123a4c', false)); pm.layers.mask = 3; pm.renderOrder = 1; c.g.add(pm);
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
    else if (id === 'lava') { // 雪原的線索：裹著厚外套的人走向結冰的洞口，寒氣往兩旁散開；左邊是大城市的屋頂（保暖衣在城裡買）
      g.strokeStyle = ink; g.fillStyle = ink; [[40, 190, 34], [78, 150, 30], [112, 205, 36], [150, 170, 28]].forEach(([x, y, bw]) => { g.strokeRect(x, y, bw, 262 - y); for (let yy = y + 16; yy < 246; yy += 24) g.fillRect(x + bw / 2 - 4, yy, 8, 8); });
      g.beginPath(); g.arc(400, 262, 78, Math.PI, 0); g.stroke(); g.strokeStyle = '#bae6fd'; for (let k = 0; k < 6; k++) { const a = Math.PI * (1 + (k + .5) / 6), x = 400 + Math.cos(a) * 78, y = 262 + Math.sin(a) * 78; g.beginPath(); g.moveTo(x, y); g.lineTo(x, y + 16 + (k % 2) * 12); g.stroke(); }
      dot(262, 150, 16, ink); g.fillStyle = ochre; g.beginPath(); g.moveTo(244, 172); g.lineTo(280, 172); g.lineTo(292, 234); g.lineTo(232, 234); g.closePath(); g.fill(); g.strokeStyle = ink; g.beginPath(); g.moveTo(250, 234); g.lineTo(244, 272); g.moveTo(274, 234); g.lineTo(286, 272); g.stroke();
      g.strokeStyle = '#bae6fd'; [[322, 152, -1], [322, 226, 1]].forEach(([x, y, sg]) => { g.beginPath(); g.moveTo(x, y); g.quadraticCurveTo(x - 18, y + sg * 22, x - 40, y + sg * 10); g.stroke(); });
      g.strokeStyle = ochre; g.beginPath(); for (let x = 40; x <= 470; x += 10) g.lineTo(x, 285 + Math.sin(x * .08) * 6); g.stroke(); }
    else if (id === 'ice') { g.strokeStyle = ink; g.beginPath(); g.moveTo(20, 280); g.lineTo(140, 120); g.lineTo(230, 200); g.lineTo(330, 90); g.lineTo(492, 280); g.stroke(); g.strokeStyle = '#c4b5fd'; g.lineWidth = 9; g.beginPath(); g.moveTo(300, 150); g.lineTo(292, 190); g.lineTo(304, 225); g.lineTo(296, 262); g.stroke(); g.lineWidth = 7; dot(410, 70, 34, ink); dot(426, 60, 30, '#7b6a56'); g.fillStyle = '#c4b5fd'; g.globalAlpha = .35; g.beginPath(); g.arc(298, 205, 46, 0, 6.3); g.fill(); g.globalAlpha = 1; }
    else { g.strokeStyle = ink; dot(256, 80, 40, ink); g.beginPath(); g.ellipse(256, 200, 150, 40, 0, 0, 6.3); g.stroke(); g.beginPath(); g.moveTo(150, 205); g.quadraticCurveTo(256, 300, 362, 205); g.stroke(); g.strokeStyle = '#c4b5fd'; for (let k = 0; k < 4; k++) { g.beginPath(); g.moveTo(230 + k * 18, 125); g.lineTo(222 + k * 18, 170); g.stroke(); } }
    g.strokeStyle = 'rgba(40,28,18,.5)'; g.lineWidth = 10; g.strokeRect(5, 5, w - 10, h - 10);
  });
}

// 洞壁的層次與小景點要在建洞壁之前決定（洞壁的頂點色要用）：礦脈、滲水的濕痕、局部的光（壁畫、熔岩小池、蘑菇角落）、小景點的位置
function caveDecor(c, def, rd) {
  const th = def.th, sf = CAVE_SURF[th], L = c.L, H_ = c.hallI, hs = c.S[H_], hw = c.Wd[H_], r = (a, b) => a + rd() * (b - a), iOf = s => clamp(Math.round(s / CAVE_STEP), 0, c.n - 1);
  c.SF = Object.assign({}, sf, { tintC: sf.tints.map(caveCol), veinC: caveCol(sf.vein), glossCC: caveCol(sf.glossC || '#ffffff'), sandC: caveCol('#cdbb8f'), tideC: caveCol(sf.tide || '#ffffff'), algC: caveCol(sf.alg || '#ffffff'), ashC: caveCol('#54443e') });
  const sA = CAVE_L0 + 3, sB = c.dead ? L - 3 : L - CAVE_L0 - 3;
  // 礦脈：兩側交錯，長 7～16 公尺，高度在 0.6～2.4 公尺（大廳的牆高，可以到 3.6）之間慢慢起伏
  c.veins = []; for (let k = 0; k < sf.nv; k++) { const s0 = r(sA, sB - 9), big = Math.abs(s0 - hs) < hw * 1.5; c.veins.push({ side: k % 2 ? 1 : -1, s0, s1: Math.min(sB, s0 + r(7, 16)), y0: c.Y[iOf(s0)] + r(.6, big ? 3.6 : 2.4), k: r(-.12, .12), a: r(.1, .32), f: r(.25, .7), p: r(0, 6), c: th === 'moon' && k % 2 ? caveCol('#9b87e8') : c.SF.veinC }); }
  // 滲水：從上面滲下來的濕痕（避開大廳正中央；腳下的一灘水在 caveProps）
  c.seeps = []; for (let k = 0; k < sf.seep; k++) { let s = r(sA + 2, sB - 2); if (Math.abs(s - hs) < hw * .5) s += hw * (k % 2 ? 1 : -1); c.seeps.push({ s, side: rd() < .5 ? -1 : 1, w: r(.45, .85) }); }
  // 小景點：入口到大廳、大廳到出口之間各一個（月光洞窟很短，只有一個），擺在比較寬的那一側；熔岩溝在左邊，熔岩隧道的都放右邊
  c.vig = (c.dead ? [hs * .45] : [hs * .42, hs + (L - hs) * .55]).map((s, k) => { const i = iOf(s); return { s, k, side: th === 'lava' ? 1 : c.WR[i] >= c.WL[i] ? 1 : -1 }; });
  c.spots = [];
  // 壁畫附近的牆被照亮一點（原本是一片疊加的光暈，多一次繪製；改烘進牆的頂點色）
  { const i = Math.min(c.n - 1, H_ + Math.round(hw * .5 / CAVE_STEP)), moon = def.id === 'moon', side = moon ? -1 : c.WR[i] >= c.WL[i] ? 1 : -1, l = side * .85 * caveW(c, i, side), st = moon ? caveStele(c, i, side) : { x: c.X[i] - c.TZ[i] * l, z: c.Z[i] + c.TX[i] * l }; c.spots.push({ x: st.x, y: c.Y[i] + 1.7, z: st.z, r: 2.3, k: moon ? .35 : .45, col: caveCol(c.T.light) }); }
  const spot = (v, lf, y, rr, k, col) => { const i = iOf(v.s), l = v.side * lf * caveW(c, i, v.side); c.spots.push({ x: c.X[i] - c.TZ[i] * l, y: c.Y[i] + y, z: c.Z[i] + c.TX[i] * l, r: rr, k, col: caveCol(col) }); };
  if (th === 'lava') spot(c.vig[0], caveFloorE() * .62, .4, 2.2, 1.1, '#ff7a2e'); // 熔岩小池照亮旁邊的牆
  if (th === 'moon') spot(c.vig[0], .8, .5, 2, .7, '#5eead4'); // 螢光蘑菇照亮的牆角
}
// 壁畫石板的擺法：大廳的牆腳是一大片斜坡（大廳高 10 公尺以上，斷面的斜面也跟著高到 2 公尺），直立貼著最遠的牆面，石板下半部就被斜坡蓋住。
// 在牆前面試幾種「左右轉一點、往後靠一點」的角度：石框上每一點都要在牆前面 5 公分以上，挑背後的縫最小、又最直立的；縫用背板補滿
function caveMuralPose(c, i, side) {
  const wx = -c.TZ[i] * side, wz = c.TX[i] * side, tx = c.TX[i], tz = c.TZ[i], yc = 1.75, hw2 = 1.55, hh2 = 1.05, M = .05; // 石框的一半（比壁畫 2.7×1.7 大一圈）
  const gap = (x, y, z) => { const q = caveQ(c, x, z, i); return (caveWallL(c, q.s, side, y - q.y) - q.l) * side; }; // 這一點到後面的牆還有多遠（負的＝在牆裡）
  let best = null;
  for (let a = -.4; a <= .401; a += .1) for (let ln = 0; ln <= .501; ln += .1) {
    const ca = Math.cos(a), sa = Math.sin(a), ux = wx * ca + tx * sa, uz = wz * ca + tz * sa, rx = tx * ca - wx * sa, rz = tz * ca - wz * sa, sl = Math.sin(ln), cl = Math.cos(ln), pts = []; // u＝往牆裡、r＝沿著牆
    for (let fu = -1; fu <= 1.001; fu += 1 / 3) for (let fv = -1; fv <= 1.001; fv += 2 / 3) { const v = yc + fv * hh2; pts.push([rx * fu * hw2 + ux * v * sl, v * cl, rz * fu * hw2 + uz * v * sl]); } // 石框上的點（相對於底部中心）
    const at = (d, p) => gap(c.X[i] + ux * d + p[0], c.Y[i] + p[1], c.Z[i] + uz * d + p[2]), ok = d => pts.every(p => at(d, p) >= M);
    let lo = 0, hi = caveW(c, i, side) * 1.1; if (!ok(lo)) continue; for (let it = 0; it < 10; it++) { const m = (lo + hi) / 2; if (ok(m)) lo = m; else hi = m; } // 底部中心沿 u 往牆推到最遠
    let sum = 0, mx = 0; pts.forEach(p => { const g2 = at(lo, p); sum += g2; mx = Math.max(mx, g2); });
    const cost = sum / pts.length + ln * .35 + Math.abs(a) * .25;
    if (!best || cost < best.cost) best = { cost, x: c.X[i] + ux * lo, y: c.Y[i], z: c.Z[i] + uz * lo, yaw: Math.atan2(-ux, -uz), lean: ln, back: clamp(mx + .3, .36, 1.8), yc };
  }
  return best || { x: c.X[i], y: c.Y[i], z: c.Z[i], yaw: Math.atan2(-wx, -wz), lean: 0, back: .36, yc };
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
    const rd = seeded(101 + di * 17), H_ = c.hallI, hy = c.Y[H_], hw = c.Wd[H_], hh = c.Hh[H_];
    // 大廳：U 形迴轉內側的牆比較近，房間的中心往外側偏一點（潮池、冰面、光柱都放在房間的中心）；hr＝中心到平地邊緣的距離
    const fe = caveFloorE(), ho = (c.WR[H_] - c.WL[H_]) / 2 * fe, hx = c.X[H_] - c.TZ[H_] * ho, hz = c.Z[H_] + c.TX[H_] * ho; c.hall = { x: hx, z: hz, y: hy, o: ho, r: fe * (c.WL[H_] + c.WR[H_]) / 2 };
    // 光柱（大廳頂上的洞）
    c.shafts = def.th === 'lava' ? [] : [{ x: hx, z: hz, r: hw * .55, k: def.th === 'moon' ? .9 : 1.15, col: caveCol(def.th === 'moon' ? '#c7d2fe' : def.th === 'ice' ? '#e0f2fe' : '#fff3d6') }];
    // 苔蘚：窄道與大廳邊緣的幾叢（光照烘進牆上；每叢可以摘，06）
    c.moss = []; const mossS = [c.sIn - 2, (c.sIn + c.S[H_]) / 2, c.S[H_] - hw * .6, c.dead ? c.L - 6 : (c.S[H_] + c.L) / 2 - 6];
    mossS.forEach((s, mi) => { const i = Math.min(c.n - 1, Math.max(0, Math.round(s / CAVE_STEP))), side = mi % 2 ? 1 : -1, w = caveW(c, i, side) * .9; c.moss.push({ x: c.X[i] + -c.TZ[i] * side * w, z: c.Z[i] + c.TX[i] * side * w, y: c.Y[i] + .35, i, side, s: c.S[i] }); });
    // 熔岩溝：左側平地邊緣一條發光的溝（只是光源，不能踩、也不扣血，4.2）
    if (def.th === 'lava') c.lava = { s0: CAVE_L0 + 8, s1: c.L - CAVE_L0 - 8 };
    // 冰洞大廳：冰面底下挖一個坑（只把平地中間那一塊地面挖空，坑本身是 caveHall 做的碗），冰柱的倒影就在冰面底下（4.3）；
    // LOW 的斷面只有 8 點、地面只有中間和兩邊三個頂點：改成碰到坑口的三角形都挖掉（any，見 caveTube），坑口和桌機一樣大（1.6 公尺）
    if (def.th === 'ice') c.icePit = { x: hx, z: hz, r: LOW ? Math.min(1.6, c.hall.r - .8) : Math.max(1.5, c.hall.r - .7), d: 2.6, cut: [], any: LOW };
    caveDecor(c, def, seeded(303 + di * 29)); // 岩層、礦脈、滲水、局部的光、小景點：建洞壁之前先決定（洞壁的頂點色要用）
    c.mat = new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.DoubleSide });
    if (def.th === 'lava') { c.mat.onBeforeCompile = sh => { sh.uniforms.uHt = W.wind; sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nuniform float uHt;').replace('#include <begin_vertex>', '#include <begin_vertex>\n{ vec4 hwp = modelMatrix * vec4(position, 1.0); float hd = distance(hwp.xyz, cameraPosition); transformed.xz += vec2(sin(uHt * 2.3 + position.y * 2.7 + position.x * 0.7), cos(uHt * 1.9 + position.y * 2.1 + position.z * 0.7)) * 0.08 * smoothstep(7.0, 24.0, hd); }'); }; c.mat.customProgramCacheKey = () => 'caveHeat'; }
    const iIn = Math.round((c.sIn + 4) / CAVE_STEP), iOut = c.dead ? c.n - 1 : Math.round((c.L - c.sIn - 4) / CAVE_STEP);
    c.rings = []; c.g.add(caveTube(c, 0, Math.min(iIn, c.n - 1), N, 3));
    if (c.dead) { c.g.add(caveTube(c, iIn, c.n - 1, N, 2)); c.g.add(caveCap(c, N, 2)); }
    else { c.g.add(caveTube(c, iIn, iOut, N, 2)); c.g.add(caveTube(c, iOut, c.n - 1, N, 3)); }
    caveCheck(c);
    c.g.add(caveTrail(c));
    // 出口的亮光：從洞裡看出去是一圈亮光（只在第 2 層，走近洞口、外面的世界打開時就換成真的景色）
    c.glows = [];
    c.ends.forEach((e, k) => {
      const i = e.i, d = k ? -1 : 1, col = k ? c.lightB : c.lightA, m = new THREE.Mesh(new THREE.CircleGeometry(1, 28), new THREE.MeshBasicMaterial({ color: col.clone().multiplyScalar(1.6), map: glowTex(), transparent: true, depthWrite: false, fog: false, blending: THREE.AdditiveBlending }));
      m.position.set(c.X[i] - c.TX[i] * d * .6, c.Y[i] + c.Hh[i] * .45, c.Z[i] - c.TZ[i] * d * .6); m.lookAt(m.position.x + c.TX[i] * d, m.position.y, m.position.z + c.TZ[i] * d); m.scale.set(c.Wd[i] * 2.2, c.Hh[i] * 1.15, 1);
      m.layers.mask = 4; m.renderOrder = 3; c.g.add(m); c.glows.push(m);
    });
    // 光柱網格：天窗貼在實際的洞頂下面一點（洞頂有凹凸，固定高度的天窗會被切成一角）
    c.shafts.slice(0, LOW ? 1 : 2).forEach(sh => {
      const s0 = c.S[H_], rh = sh.r * .36, top = hy + Math.min(...[[0, 0], [rh, 0], [-rh, 0], [0, rh], [0, -rh]].map(([ds, dl]) => caveCeil(c, s0 + ds, c.hall.o + dl))) - .06, len = top - hy;
      const m = new THREE.Mesh(new THREE.CylinderGeometry(sh.r * .32, sh.r * 1.05, len, 18, 1, true), caveShaftMat(sh.col, def.th === 'moon' ? .55 : .42));
      m.position.set(sh.x, top - len / 2, sh.z); m.layers.mask = 2; m.renderOrder = 4; c.g.add(m); sh.m = m; sh.top = top; sh.rh = rh;
      // 天窗：月光洞窟的天窗日夜換色，自己一個網格；其他洞的天窗顏色不變，併進小物件（少一次繪製）
      if (def.th === 'moon') { const hole = new THREE.Mesh(new THREE.CircleGeometry(rh, 20), new THREE.MeshBasicMaterial({ color: sh.col.clone().multiplyScalar(1.4), fog: false })); hole.rotation.x = Math.PI / 2; hole.position.set(sh.x, top, sh.z); hole.layers.mask = 2; c.g.add(hole); sh.hole = hole; }
    });
    caveHall(c, def, rd);
    // 壁畫：靠在大廳外側牆上的一塊石板（月光洞窟是湖邊的石碑）；石框、背板、底座、岩石都合併在 caveProps
    { const i = Math.min(c.n - 1, H_ + Math.round(hw * .5 / CAVE_STEP)), moon = def.id === 'moon', side = moon ? -1 : c.WR[i] >= c.WL[i] ? 1 : -1, g = new THREE.Group();
      let yc = 1.45, back = .36;
      if (moon) { const st = caveStele(c, i, side); g.position.set(st.x, c.Y[i], st.z); g.lookAt(c.hall.x, c.Y[i], c.hall.z); }
      else { const P0 = caveMuralPose(c, i, side); yc = P0.yc; back = P0.back; g.position.set(P0.x, P0.y, P0.z); g.rotation.set(-P0.lean, P0.yaw, 0, 'YXZ'); }
      const face = new THREE.Mesh(new THREE.PlaneGeometry(2.7, 1.7), new THREE.MeshBasicMaterial({ map: caveMuralTex(def.id), color: moon ? '#cdbfaa' : '#ddd0bb' })); face.position.set(0, yc, .03); g.add(face); // 原本前面疊一片發光的光暈（多一次繪製）：改成石板本身亮一點、四周的牆烘進光
      caveSetLayers(g, 2); c.g.add(g); g.updateMatrixWorld(true); c.muralAt = { g, moon, i, side, yc, back };
      // 互動框：石碑前面人最近站到正面前 0.46 公尺（碰撞），框的前緣收到 0.35，眼睛才不會在框裡面（射線從框裡打出去打不到）
      const hit = moon ? hitBox(2.8, 2, .5, 0, yc - .1, .1, g) : hitBox(2.8, 2, .6, 0, yc - .1, .3, g); hit.layers.mask = 3; addInter(hit, 'cave', 'mural:' + def.id, CAVE_MURAL[def.id].t, { cave: c });
      // 月光洞窟湖邊的石碑：底座是一條線段＋半徑的碰撞（caveSlide），人與史萊姆都不會穿過去；蓋住整個底座（前緣 0.25、後緣 −0.65），背後到牆腳不留縫
      if (moon) { const a = g.localToWorld(new THREE.Vector3(-1.5, 0, -.3)), b = g.localToWorld(new THREE.Vector3(1.5, 0, -.3)); c.obst = [{ ax: a.x, az: a.z, bx: b.x, bz: b.z, r: .55 }]; } }
    caveProps(c, def, rd);
    cavePuddles(c);
    // 苔蘚的互動（每叢一個看不見的碰撞箱）
    c.moss.forEach((m, k) => { const hit = new THREE.Mesh(new THREE.SphereGeometry(.7, 6, 4), new THREE.MeshBasicMaterial({ visible: false })); hit.position.set(m.x, m.y + .1, m.z); hit.layers.mask = 3; c.g.add(hit); addInter(hit, 'cave', 'moss:' + def.id + ':' + k, '發光苔蘚', { cave: c }); });
    c.g.add(caveParticles(c, caveParticleList(c, rd)));
    if (def.th === 'sea') caveCrabs(c, seeded(77 + di));
    caveMouth(c, def, 0); if (!c.dead) caveMouth(c, def, 1);
    CAVES.push(c);
  });
  // 地形挖洞：每個洞口直段一組（terrainMat 讀 CAVE_UA／CAVE_UB）
  let u = 0; CAVES.forEach(c => c.ends.forEach(e => { if (u >= 8) return; const i = e.i, d = e.s ? -1 : 1; CAVE_UA[u].set(c.X[i], (e.s ? c.y1 : c.y0), c.Z[i], CAVE_L0 + .4); CAVE_UB[u].set(c.TX[i] * d, c.TZ[i] * d, c.Wd[i], c.Hh[i]); u++; }));
  // 燈光與第一人稱的手：每一層都要看得到
  [W.sun, W.hemi].forEach(l => { if (l) l.layers.mask = 7; });
}
// 大廳的看點：潮池與水光、熱氣與火星光帶、冰柱與倒影、月光地下湖（都放在 c.hall＝房間的中心）
function caveHall(c, def, rd) {
  const H_ = c.hallI, { x: hx, z: hz, y: hy } = c.hall, hw = c.Wd[H_], hh = c.Hh[H_]; c.hallItems = []; // [幾何, 顏色, 矩陣, 發光]：併進 caveProps 的小物件網格
  if (def.th === 'sea') {
    const pr = Math.min(hw * .5, c.hall.r - .6), pool = new THREE.Mesh(new THREE.CircleGeometry(pr, 36), caveWaterMat('#7dd3fc', '#0e3a4d', false)); pool.rotation.x = -Math.PI / 2; pool.position.set(hx, hy + .04, hz); pool.layers.mask = 2; pool.renderOrder = 1; c.g.add(pool); c.pool = { x: hx, z: hz, r: pr - .2 };
    // 頂上晃動的水光（潮池反射上去的光紋，4.1）
    const R = hw * .95, cau = new THREE.Mesh(new THREE.CircleGeometry(R, 32), new THREE.ShaderMaterial({ uniforms: { t: W.wind, c: { value: new THREE.Color('#a5ecff') } },
      vertexShader: 'varying vec2 vP; void main(){ vP = position.xy; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
      fragmentShader: 'uniform float t; uniform vec3 c; varying vec2 vP; float h(vec2 p){ return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); } float n(vec2 p){ vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f); return mix(mix(h(i), h(i + vec2(1, 0)), f.x), mix(h(i + vec2(0, 1)), h(i + vec2(1, 1)), f.x), f.y); } void main(){ vec2 p = vP * 0.8; float a = n(p + vec2(t * 0.31, t * 0.22)), b = n(p * 1.37 - vec2(t * 0.27, -t * 0.29) + 4.0); float k = pow(max(0.0, 1.0 - abs(a - b) * 2.3), 6.0); float f = 1.0 - smoothstep(0.35, 1.0, length(vP) / ' + R.toFixed(2) + '); gl_FragColor = vec4(c * k * f * 0.6, 1.0); }',
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide }));
    cau.rotation.x = Math.PI / 2; cau.position.set(hx, hy + hh * .84, hz); cau.layers.mask = 2; c.g.add(cau);
    // 退潮留下的小水窪：在滴水底下、滲水腳下（caveProps 決定位置，cavePuddles 合併成一個網格）
  } else if (def.th === 'lava') {
    // 熔岩溝：左側平地邊緣的一條發光帶（貼著地面，不再埋進牆腳的斜面）
    const pos = [], uv = [], idx = []; let k = 0;
    for (let s = c.lava.s0; s <= c.lava.s1; s += 1) { const i = Math.round(s / CAVE_STEP), lc = caveLavaL(c, i), nx = -c.TZ[i], nz = c.TX[i], l0 = lc - .35, l1 = lc + .35, y = c.Y[i] + .03; pos.push(c.X[i] + nx * l0, y, c.Z[i] + nz * l0, c.X[i] + nx * l1, y, c.Z[i] + nz * l1); uv.push(s / 3, 0, s / 3, 1); if (k) idx.push(2 * k - 2, 2 * k - 1, 2 * k, 2 * k - 1, 2 * k + 1, 2 * k); k++; }
    const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); geo.setIndex(idx);
    const mat = new THREE.ShaderMaterial({ uniforms: { t: W.wind }, vertexShader: 'varying vec2 vU; void main(){ vU = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
      fragmentShader: 'uniform float t; varying vec2 vU; float h(vec2 p){ return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); } float n(vec2 p){ vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f); return mix(mix(h(i), h(i + vec2(1, 0)), f.x), mix(h(i + vec2(0, 1)), h(i + vec2(1, 1)), f.x), f.y); } void main(){ vec2 p = vec2(vU.x * 3.0 - t * 0.35, vU.y * 2.0); float a = n(p * 1.7) * 0.6 + n(p * 4.3 + 7.0) * 0.4; float e = smoothstep(0.0, 0.25, vU.y) * smoothstep(1.0, 0.75, vU.y); vec3 c = mix(vec3(0.55, 0.06, 0.02), vec3(1.0, 0.62, 0.12), smoothstep(0.35, 0.8, a)); c += vec3(1.0, 0.9, 0.5) * pow(a, 5.0) * 1.5; gl_FragColor = vec4(c * (0.45 + 0.75 * e), 1.0); }' });
    const m = new THREE.Mesh(geo, mat); m.layers.mask = 2; c.g.add(m);
    // 熱氣往上：大廳中央一道淡淡的橘色光帶（火星由粒子帶上去）
    const haze = new THREE.Mesh(new THREE.CylinderGeometry(hw * .35, hw * .55, hh * .95, 16, 1, true), caveShaftMat('#ff9a4d', .16)); haze.position.set(hx, hy + hh * .47, hz); haze.layers.mask = 2; c.g.add(haze);
  } else if (def.th === 'ice') {
    // 冰面蓋住整個坑。地面挖掉的是一整塊一整塊的三角形，邊是直的（LOW 更明顯）：量出挖空範圍裡最大的圓（碗口開在這個圓上）與最外圈，
    // 中間那一段用一圈結霜的冰蓋住，透過冰面看下去，坑口就是圓的（4.3）。冰柱、倒影、霜邊、碗都併進小物件網格（不多繪製）
    const P = c.icePit, s0 = c.S[H_], cut = P.cut, it = c.hallItems; let rIn = 1e9, rOut = 0;
    const inCut = (x, z) => { for (let t = 0; t < cut.length; t += 6) { const ax = cut[t], az = cut[t + 1], bx = cut[t + 2], bz = cut[t + 3], cx = cut[t + 4], cz = cut[t + 5], d1 = (x - bx) * (az - bz) - (ax - bx) * (z - bz), d2 = (x - cx) * (bz - cz) - (bx - cx) * (z - cz), d3 = (x - ax) * (cz - az) - (cx - ax) * (z - az); if (!((d1 < 0 || d2 < 0 || d3 < 0) && (d1 > 0 || d2 > 0 || d3 > 0))) return true; } return false; };
    for (let t = 0; t < cut.length; t += 2) rOut = Math.max(rOut, Math.hypot(cut[t] - P.x, cut[t + 1] - P.z));
    for (let a = 0; a < 72; a++) { const ca = Math.cos(a / 72 * Math.PI * 2), sa = Math.sin(a / 72 * Math.PI * 2); let rr = 0; while (rr < rOut && inCut(P.x + ca * (rr + .04), P.z + sa * (rr + .04))) rr += .04; rIn = Math.min(rIn, rr); }
    if (!cut.length) rIn = rOut = 0; P.rIn = Math.max(0, rIn - .05); P.rOut = rOut + .1;
    const ice = new THREE.Mesh(new THREE.CircleGeometry(Math.max(P.r + 1.1, P.rOut + .7), 40), new THREE.MeshBasicMaterial({ color: '#a9d6f2', transparent: true, opacity: .58, depthWrite: false }));
    ice.rotation.x = -Math.PI / 2; ice.position.set(hx, hy + .02, hz); ice.layers.mask = 2; ice.renderOrder = 1; c.g.add(ice); // renderOrder 1：永遠比發光痕跡（2）先畫，兩片半透明的面不會互相蓋來蓋去
    if (P.rIn > .3) {
      const rb = P.rIn, d = P.d * clamp(rb / 2.4, .6, 1), mid = rb + (P.rOut - rb) * .45, flat = g => g.rotateX(-Math.PI / 2);
      it.push([new THREE.LatheGeometry([[0, -d], [rb * .5, -d * .9], [rb * .85, -d * .5], [rb, 0]].map(([x, y]) => new THREE.Vector2(x, y)), LOW ? 10 : 18), caveCol('#2c5a7c'), M4(hx, hy, hz)]); // 碗
      // 霜邊：內圈白、外圈淡藍，接回地面。兩圈的交界與外緣都隨角度起伏（外緣只往外長，一定蓋得住挖空的直邊），不是兩個正圓疊成的標靶
      const jit = (g, fn) => { const p = g.attributes.position; for (let v = 0; v < p.count; v++) { const x = p.getX(v), y = p.getY(v), rr = Math.hypot(x, y), a = Math.atan2(y, x), r2 = fn(rr, a); p.setXY(v, x / (rr || 1) * r2, y / (rr || 1) * r2); } return g; };
      const Jm = a => mid + .14 * Math.sin(a * 5 + 1.3) + .08 * Math.sin(a * 11 + .4), Jo = a => P.rOut * (1.03 + .07 * (1 + Math.sin(a * 4 + 2.1)) + .05 * (1 + Math.sin(a * 9 + .7))), sg = LOW ? 24 : 48;
      it.push([flat(jit(new THREE.RingGeometry(rb - .02, mid, sg, 1), (rr, a) => rr > (rb + mid) / 2 ? Jm(a) : rr)), caveCol('#eef7ff'), M4(hx, hy + .014, hz)], [flat(jit(new THREE.RingGeometry(mid - .01, P.rOut, sg, 1), (rr, a) => rr > (mid + P.rOut) / 2 ? Jo(a) : Jm(a) - .01)), caveCol('#d5eaf8'), M4(hx, hy + .012, hz)]);
    }
    for (let k = 0; k < (LOW ? 9 : 16); k++) {
      let s = s0 + (rd() - .5) * hw * 1.4, lf = (rd() - .5) * 1.5, l = lf * caveW(c, clamp(Math.round(s / CAVE_STEP), 0, c.n - 1), lf);
      if (k < 3 && P.rIn > .9) { const a = rd() * 6.28, d2 = Math.sqrt(rd()) * P.rIn * .6, q0 = caveQ(c, P.x + Math.cos(a) * d2, P.z + Math.sin(a) * d2, H_); s = q0.s; l = q0.l; } // 前三根掛在坑的正上方：冰面底下看得到倒影
      const i = clamp(Math.round(s / CAVE_STEP), 0, c.n - 1), q = caveAtR(c, s, l), sw = .16 + rd() * .14;
      const ceil = caveCeil(c, s, l), len = Math.min(1.4 + rd() * 2, ceil - 2.4), top = q.y + ceil + .1; if (len < .4) continue;
      it.push([new THREE.ConeGeometry(1, 1, 6), caveCol('#e6f6ff'), M4(q.x, top - len / 2, q.z, Math.PI, rd() * 3, 0, sw, len, sw), 2]); (c.tips || (c.tips = [])).push({ s, l, x: q.x, y: top - len - .03, z: q.z, ice: 1 });
      const dp = Math.hypot(q.x - P.x, q.z - P.z); if (dp < P.rIn - .35) { const rl = Math.min(len * .8, P.d * .8); it.push([new THREE.ConeGeometry(1, 1, 6), caveCol('#2c5a7c').lerp(caveCol('#5d8fb5'), .55), M4(q.x, hy - .03 - rl / 2, q.z, 0, rd() * 3, 0, .2, rl, .2), 2]); } // 倒影：冰面下一根往上的錐（隔著半透明的冰看，和原本半透明的倒影一樣）
    }
  } else if (def.th === 'moon') {
    const R = caveLakeR(c), lake = new THREE.Mesh(new THREE.CircleGeometry(R, 48), caveWaterMat('#a5b4fc', '#0f1035', true));
    lake.rotation.x = -Math.PI / 2; lake.position.set(hx, hy + .05, hz); lake.layers.mask = 2; lake.renderOrder = 1; c.g.add(lake); c.lake = { x: hx, z: hz, r: R, m: lake };
    // 洞頂的螢光蟲：一點一點慢慢閃（像星空，月光洞窟的大廳），貼在實際的洞頂下；和其他粒子合併成一組（caveParticleList）
    c.worms = []; for (let k = 0; k < (LOW ? 50 : 120); k++) { const s = clamp(c.S[H_] + (rd() - .5) * hw * 2.2, 0, c.L), i = clamp(Math.round(s / CAVE_STEP), 0, c.n - 1), lf = (rd() - .5) * 1.6, l = lf * caveW(c, i, lf) * .9, q = caveAtR(c, s, l); c.worms.push({ x: q.x, y: q.y + caveCeil(c, s, l) - .12, z: q.z }); }
  }
}
// 曲線上 s、橫向 l 的位置：用前後兩圈斷面內插（和洞壁網格、caveSlice 一致；彎道上直接用最近的取樣點會差幾公分，貼牆的小東西就浮起來或埋進去）
function caveAtR(c, s, l) {
  const R = c.rings; let a = 0, b = R.length - 1; while (b - a > 1) { const m = (a + b) >> 1; if (R[m].s <= s) a = m; else b = m; }
  const ia = R[a].i, ib = R[b].i, t = clamp((s - R[a].s) / Math.max(1e-6, R[b].s - R[a].s), 0, 1), u = 1 - t;
  return { x: (c.X[ia] - c.TZ[ia] * l) * u + (c.X[ib] - c.TZ[ib] * l) * t, z: (c.Z[ia] + c.TX[ia] * l) * u + (c.Z[ib] + c.TX[ib] * l) * t, y: c.Y[ia] * u + c.Y[ib] * t, nx: -(c.TZ[ia] * u + c.TZ[ib] * t), nz: c.TX[ia] * u + c.TX[ib] * t };
}
// 洞裡的小東西：每個洞一種個性。全部合併成一個網格（1 次繪製），光照一樣烘進頂點顏色。
// 每一個都貼著實際的岩面擺（地面、牆腳斜面、牆、洞頂；位置用前後兩圈斷面內插），底部再往岩石裡埋一點點：不會浮在半空，也不會整個埋掉
function caveStarGeo() {
  const sh = new THREE.Shape(); for (let k = 0; k <= 10; k++) { const a = k / 10 * Math.PI * 2 + Math.PI / 2, r = k % 2 ? .42 : 1; k ? sh.lineTo(Math.cos(a) * r, Math.sin(a) * r) : sh.moveTo(Math.cos(a) * r, Math.sin(a) * r); }
  const g = new THREE.ExtrudeGeometry(sh, { depth: .35, bevelEnabled: false }); g.rotateX(-Math.PI / 2); return g;
}
function caveProps(c, def, rd) {
  const G0 = caveProps.G || (caveProps.G = { rock: new THREE.IcosahedronGeometry(1, 0), cone: new THREE.ConeGeometry(1, 1, 5), cone6: new THREE.ConeGeometry(1, 1, 6), oct: new THREE.OctahedronGeometry(1, 0), ico: new THREE.IcosahedronGeometry(1, 0), hex: new THREE.CylinderGeometry(1, 1, 1, 6), cyl: new THREE.CylinderGeometry(1, 1, 1, 5), sph: new THREE.SphereGeometry(1, 7, 4), box: new THREE.BoxGeometry(1, 1, 1), star: caveStarGeo(), dome: new THREE.SphereGeometry(1, 8, 3, 0, Math.PI * 2, 0, Math.PI / 2), disc: new THREE.CircleGeometry(1, 9).rotateX(-Math.PI / 2), disc16: new THREE.CircleGeometry(1, 16).rotateX(-Math.PI / 2), barn: new THREE.CylinderGeometry(.42, 1, 1, 4, 1, false), stem: new THREE.CylinderGeometry(1, 1, 1, 5, 1, true), cap: new THREE.SphereGeometry(1, 7, 2, 0, Math.PI * 2, 0, Math.PI / 2), shell: new THREE.SphereGeometry(1, 9, 3, 0, Math.PI * 2, 0, Math.PI / 2), shelf: new THREE.CylinderGeometry(1, 1, 1, 7, 1, false, 0, Math.PI) });
  const th = def.th, T = c.T, items = [], L = c.L, dead = c.dead, LQ = LOW ? .4 : 1, r = (a, b) => a + rd() * (b - a), pk = a => a[Math.min(a.length - 1, Math.floor(rd() * a.length))], col = caveCol;
  const iOf = s => clamp(Math.round(clamp(s, 0, L) / CAVE_STEP), 0, c.n - 1), UP = new THREE.Vector3(0, 1, 0), QA = new THREE.Quaternion(), QB = new THREE.Quaternion();
  // atL：沿曲線 s、橫向 l 公尺、離地 yr；at：橫向用比例 lf（−1～1，乘上那一側的實際半寬，彎道內側比較窄）
  const atL = (s, l, yr) => { s = clamp(s, 0, L); const i = iOf(s), q = caveAtR(c, s, l); return { s, i, l, w: caveW(c, i, l), h: c.Hh[i], x: q.x, y: q.y + yr, z: q.z, nx: q.nx, nz: q.nz, ry: Math.atan2(c.TX[i], c.TZ[i]) }; };
  const at = (s, lf, yr) => atL(s, lf * caveW(c, iOf(s), lf), yr);
  // 依實際的斷面擺：floorY＝那個橫向位置的地面（牆腳是斜面）；ground＝地面上的點（往下埋 emb）；onWall＝貼在高度 y 的牆面上（往洞裡 inset 公尺，負的＝埋進牆裡）；
  // wallN＝那一點牆面朝洞裡的法線（牆腳的斜面朝上、拱頂朝下）；out＝擋路的東西推到玩家走得到的範圍外（caveSlide 的界線）
  const floorY = p => caveVert(c, p.s, p.l, false), ground = (s, l, emb = 0) => { const p = atL(s, l, 0); p.y += floorY(p) - emb; return p; };
  const groundXZ = (x, z, emb = 0) => { const q = caveQ(c, x, z, null); return ground(q.s, q.l, emb); };
  const onWall = (s, side, y, inset) => { const wl = caveWallL(c, clamp(s, 0, L), side, y); return atL(s, (wl * side > .1 ? wl : side * caveW(c, iOf(s), side) * .9) - side * inset, y); }; // 那個高度碰不到牆（比洞頂還高）就退回半寬的 0.9 倍
  const wallN = (p, side, y) => { const a = Math.abs(caveWallL(c, p.s, side, y + .12)), b = Math.abs(caveWallL(c, p.s, side, Math.max(.01, y - .12))); return new THREE.Vector3(-side * p.nx, (a - b) / .24, -side * p.nz).normalize(); };
  const out = (p, side, m) => { let lm = Math.max(Math.abs(p.l), Math.max(.15, p.w * .84 - .35) + m), q = Math.abs(p.l) >= lm ? p : atL(p.s, side * lm, 0); for (let t = 0; t < 16 && lm > .3 && !caveIn(c, q.s, q.l, .36); t++) { lm -= .15; q = atL(p.s, side * lm, 0); } return q; }; // 擋路的東西推到界線外；那裡若已經爬上牆腳斜面（地面 > 35 公分，低畫質的斷面斜面從 0.65 倍半寬就開始）、或整個在牆裡（牆面往裡凸的地方；原本只看地面高度，牆裡找不到地面會當成 0，冰洞、月光洞窟各有一顆大石頭整顆埋在牆裡）就往中間退，石頭才會坐在牆腳、不會黏在牆上
  // mute：這一個不放（引數照樣算完，亂數的順序不變，後面每一個東西的位置都和原本一樣）；wet：在湖面、潮池的水面範圍裡（潮池的網格比碰撞大 0.2 公尺）
  // onRock：ground 找到的是真的地面（往上 3 公分是空氣；牆面往裡凸、橫向超出斷面的地方 caveVert 找不到地面會當成 0，東西就整個埋在牆裡）
  const onRock = p => caveIn(c, p.s, p.l, caveVert(c, p.s, p.l, false) + .03);
  let mute = false; const wet = (p, m = 0) => !!((c.lake && Math.hypot(p.x - c.lake.x, p.z - c.lake.z) < c.lake.r + m) || (c.pool && Math.hypot(p.x - c.pool.x, p.z - c.pool.z) < c.pool.r + .2 + m));
  const add = (geo, cl, p, rx, ry, rz, sx, sy = sx, sz = sx, glow = false, dec = 0) => { if (!mute) items.push([geo, cl, M4(p.x, p.y, p.z, rx, ry, rz, sx, sy, sz), glow, p.i, dec]); };
  // 沿方向 d 長出來的東西（晶柱、藤壺、冰筍、冰柱）：底部在 p、往岩石裡埋 emb；gh＝幾何的半高（八面體 1、圓柱與圓錐 0.5）
  const grow = (geo, gh, cl, p, d, len, rad, glow = false, emb = .05) => { QA.setFromUnitVectors(UP, d).multiply(QB.setFromAxisAngle(UP, rd() * 6)); if (!mute) items.push([geo, cl, new THREE.Matrix4().compose(new THREE.Vector3(p.x + d.x * (len / 2 - emb), p.y + d.y * (len / 2 - emb), p.z + d.z * (len / 2 - emb)), QA.clone(), new THREE.Vector3(rad, len / 2 / gh, rad)), glow, p.i, 0]); };
  // 平貼在岩面上的東西（苔蘚、淡菜）：扁的那一軸對著法線 n，一半埋在岩面裡
  const flat = (geo, cl, p, n, sx, sy, sz, glow = false) => { QA.setFromUnitVectors(UP, n).multiply(QB.setFromAxisAngle(UP, rd() * 6)); if (!mute) items.push([geo, cl, new THREE.Matrix4().compose(new THREE.Vector3(p.x, p.y, p.z), QA.clone(), new THREE.Vector3(sx, sy, sz)), glow, p.i, 0]); };
  // 地上的薄片（沙地、焦黑的地面）：每個頂點各自貼齊地面再墊高 2.2 公分（地面沿曲線有坡度，水平的薄片會被地面吃掉一邊）；半徑夾在平地裡面
  const decal = (cl, s, lf, R1, R2) => { const i = iOf(s), w = caveW(c, i, lf), fe = caveFloorE() - .05, k = Math.min(1, (fe * w - .1) / Math.max(R1, R2)), mx = fe * w - Math.max(R1, R2) * k; add(G0.disc, cl, atL(s, clamp(lf * w, -mx, mx), 0), 0, rd() * 3, 0, R1 * k, 1, R2 * k, false, .022); };
  const rockC = () => T.rockC.clone().lerp(T.rock2C, rd() * .6).multiplyScalar(r(.8, 1.15));
  const s0 = CAVE_L0 + 1.2, s1 = dead ? L - 1 : L - CAVE_L0 - 1.2, hallS = c.S[c.hallI], hw = c.Wd[c.hallI], fe = caveFloorE(), hp = { s: hallS, i: c.hallI };
  const tips = c.tips || (c.tips = []), glints = c.glints = [], flies = c.flies = [], pud = c.puddles = [];
  const mu = c.muralAt, nearMural = (s, side, m = 2.4) => !!mu && !mu.moon && side === mu.side && Math.abs(s - c.S[mu.i]) < m, nearVig = (s, m = 3.5) => c.vig.some(v => Math.abs(v.s - s) < m);
  // 一叢晶簇（像晶洞裡的晶簇）：一根大的站在中間，其他的從同一個根部往洞裡、往兩旁散開成半個扇形；
  // 根部在牆腳（斜面上也可以），每一根各自貼著自己那一點的岩面、順著岩面的法線長出來，底部整個埋進岩石裡——斜面上不會一邊埋著、一邊懸空（原本冰洞大廳、紫水晶有幾根浮在牆前）
  const cluster = (geo, gh, s, side, lf, n, len0, rad0, colF, glow, gl = 0) => {
    const p0 = out(at(s, side * lf, 0), side, .15), i = p0.i, ix = -side * p0.nx, iz = -side * p0.nz, tx = c.TX[i], tz = c.TZ[i], fan = r(1.9, 2.6);
    for (let j = 0; j < n; j++) {
      const big = j === 0, a = big ? r(-.3, .3) : ((j - 1) / Math.max(1, n - 2) - .5) * fan + r(-.18, .18), fx = ix * Math.cos(a) + tx * Math.sin(a), fz = iz * Math.cos(a) + tz * Math.sin(a);
      const off = big ? 0 : rad0 * r(.6, 1.1) + r(0, .08), p = groundXZ(p0.x + fx * off, p0.z + fz * off), fy = floorY(p), nrm = fy > .03 ? wallN(p, side, fy) : UP;
      const len = len0 * (big ? 1 : r(.38, .75)), rad = rad0 * (big ? 1 : r(.5, .8)), tl = big ? r(.05, .2) : r(.4, .8);
      const d = new THREE.Vector3(fx * Math.sin(tl), Math.cos(tl), fz * Math.sin(tl)).addScaledVector(nrm, .45).normalize();
      grow(geo, gh, colF(j), p, d, len, rad, glow, rad * 1.1 + .03);
      if (rd() < gl) glints.push({ x: p.x + d.x * len * .78, y: p.y + d.y * len * .78, z: p.z + d.z * len * .78 });
    }
  };
  // 共通：牆腳的大石頭（腳邊有崩落的碎石）、鐘乳石（尖端記下來，會滴水）、石筍
  for (let s = s0; s < s1; s += r(2.25, 3.55) / LQ) {
    for (const side of [-1, 1]) {
      if (rd() < .5 || nearMural(s, side) || c.vig.some(v => v.side === side && Math.abs(v.s - s) < 2.6) || (th === 'lava' && side < 0 && s > c.lava.s0 - 2 && s < c.lava.s1 + 2)) continue; let p = at(s + r(-.6, .6), side * r(.8, .93), 0); const k = clamp(p.w / 2, .45, 1.7) * r(.26, .55); p = out(p, side, k * 1.15); p.y += floorY(p); // 熔岩溝那一側不放大石頭（會壓在發光的溝上）
      add(G0.rock, rockC(), p, rd() * 3, rd() * 3, rd() * 3, k * 1.2, k * r(.45, .85), k);
      for (let j = 0; j < (LOW ? 1 : 2); j++) { const g = ground(p.s + r(-1.3, 1.3) * k, p.l - side * r(.9, 1.6) * k), sz = r(.04, .1); g.y += sz * .08; mute = wet(g) || !onRock(g); add(G0.oct, rockC().multiplyScalar(.88), g, r(-.2, .2), rd() * 3, r(-.2, .2), sz, sz * r(.3, .55), sz * r(.8, 1.1)); mute = false; } // 腳邊崩落的碎石：扁扁地躺在地上（落在水面、牆裡的不放）
    }
    // 鐘乳石／冰柱：根部嵌進實際的洞頂（拱頂是斜的，粗的嵌深一點），尖端留在頭頂 2.2 公尺以上
    if (rd() < (th === 'ice' ? .95 : .6)) { const p = at(s, r(-.55, .55), 0), ceil = caveCeil(c, p.s, p.l), len = Math.min(th === 'ice' ? r(.6, 2.2) : r(.35, 1.4), ceil - 2.2), wd = th === 'ice' ? r(.07, .16) : r(.09, .2); if (len > .25) { p.y += ceil + .06 + wd * 1.2 - len / 2; add(th === 'ice' ? G0.cone6 : G0.cone, th === 'ice' ? T.rock2C.clone().lerp(col('#ffffff'), .5) : rockC().multiplyScalar(.85), p, Math.PI, rd() * 3, 0, wd, len, wd); tips.push({ s: p.s, l: p.l, x: p.x, y: p.y - len / 2 - .02, z: p.z }); } }
    if (rd() < .22) { const side = rd() < .5 ? -1 : 1, p = out(at(s, side * r(.55, .8), 0), side, .2), len = r(.3, .9); p.y += floorY(p) + len / 2 - .05; add(G0.cone, rockC(), p, 0, rd() * 3, 0, r(.1, .2), len, r(.1, .2)); }
  }
  // 碎石堆：每隔一段才有一小堆（有疏有密，不是平均撒滿），多半靠在牆腳
  for (let s = s0 + r(0, 5); s < s1; s += r(6.5, 12) / LQ) { if (nearVig(s, 2.5)) continue; const side = rd() < .5 ? -1 : 1, l0 = side * r(.3, .72) * caveW(c, iOf(s), side), n = LOW ? 3 : Math.floor(r(4, 8) * (th === 'ice' ? .6 : 1)); for (let j = 0; j < n; j++) { const g = ground(s + r(-.65, .65), l0 + r(-.35, .35)), sz = r(.035, .1) * (j ? 1 : 1.6); g.y += sz * .08; mute = wet(g); add(G0.oct, rockC().multiplyScalar(r(.8, .95)), g, r(-.2, .2), rd() * 3, r(-.2, .2), sz, sz * r(.3, .5), sz * r(.8, 1.2)); mute = false; } } // 落在湖面、潮池裡的不放（原本有幾顆泡在月光湖的水面下、尖角冒出來）
  // 苔蘚（會發光，可以摘）：一片片貼在牆腳的岩面上
  c.moss.forEach(m => { for (let k = 0; k < (LOW ? 4 : 11); k++) { const yy = r(.06, 1), p = onWall(m.s + r(-.6, .6), m.side, yy, -.02), sz = r(.07, .16); flat(G0.oct, c.mossC.clone().multiplyScalar(r(1, 1.35)), p, wallN(p, m.side, yy), sz, r(.03, .06), sz * r(.8, 1.2), true); } });
  // 壁畫的石框與背板（背板一直延伸到地面與牆：石板往後靠、離牆有縫的地方都補滿）；月光洞窟是一座石碑
  if (mu) { const g = mu.g, M = new THREE.Matrix4(), push = (geo, cl, lx, ly, lz, sx, sy, sz, rx = 0, ry = 0, rz = 0) => items.push([geo, cl, M.copy(g.matrixWorld).multiply(M4(lx, ly, lz, rx, ry, rz, sx, sy, sz)).clone(), false, mu.i, 0]);
    if (mu.moon) { push(G0.box, T.rockC.clone().multiplyScalar(1.1), 0, 1.45, -.27, 3.05, 2.2, .5); push(G0.box, T.rockC.clone().multiplyScalar(.9), 0, .22, -.2, 3.4, .44, .9); for (let k = 0; k < 6; k++) push(G0.oct, col('#b9a6ff'), r(-1.6, 1.6), .2, r(.2, .42), .1, r(.3, .6), .1, 0, rd() * 3, r(-.3, .3)); } // 腳下的晶體：底座前緣到湖岸之間（石碑站在岸外 0.62 公尺，晶體不會泡在水裡）
    else { const yc = mu.yc, bk = mu.back, top = yc + 1.05; push(G0.box, T.rockC.clone().multiplyScalar(.85), 0, (top - .45) / 2, -.02 - bk / 2, 3.1, top + .45, bk); for (let k = 0; k < 12; k++) { const a = k / 12 * Math.PI * 2; push(G0.rock, rockC(), Math.cos(a) * 1.62, yc + Math.sin(a) * 1.12, -.05, r(.22, .38), r(.18, .3), .25, rd() * 3, rd() * 3, 0); } }
  }
  c.hallItems.forEach(([g, cl, m, glow]) => items.push([g, cl, m, glow || false, c.hallI, 0])); // 大廳的碗、霜邊、冰柱與倒影（caveHall）
  // 天窗（月光洞窟以外）：顏色照舊、不受光照，併進小物件
  c.shafts.forEach(sh => { if (!sh.hole && sh.top != null) items.push([new THREE.CircleGeometry(sh.rh, 20).rotateX(Math.PI / 2), sh.col.clone().multiplyScalar(1.6), M4(sh.x, sh.top, sh.z), 2, c.hallI, 0]); });
  if (th === 'sea') {
    // 藤壺：一小片一小片長在潮線附近的牆上，每顆都順著牆面的法線長出來（小火山的形狀）。底部就在牆面上、只埋三成的高度：
    // 原本底部先往牆裡 1.5 公分、再埋 2 公分，矮的那幾顆（2～6 公分高）整顆在牆裡，大約三分之一看不見，藤壺群看起來比設計的稀
    for (let s = s0; s < s1; s += r(5, 9) / LQ) { const side = rd() < .5 ? -1 : 1; if (nearMural(s, side)) continue; const sc = s + r(-.5, .5), yc = r(.4, 1.3); for (let k = 0; k < (LOW ? 2 : 5); k++) { const yy = yc + r(-.25, .25), p = onWall(sc + r(-.45, .45), side, yy, 0), sz = r(.035, .07), cl = col(pk(['#c9c2b2', '#bdb5a4', '#d6cfbf'])), ln = sz * r(.8, 1.1); grow(G0.barn, .5, cl, p, wallN(p, side, yy), ln, sz, false, ln * .3); } }
    // 貝殼：三五個一堆，在牆腳
    for (let k = 0; k < 7 * LQ; k++) { const s = r(s0, s1), side = rd() < .5 ? -1 : 1, l0 = side * r(.4, .7) * caveW(c, iOf(s), side); for (let j = 0; j < 3; j++) { const cl = col(pk(['#f5d0c5', '#fde4cf', '#e7d9c7', '#fbcfe8'])), g = ground(s + r(-.4, .4), l0 + r(-.25, .25)); mute = !onRock(g); add(G0.ico, cl, g, 0, rd() * 3, 0, r(.06, .11), r(.025, .045), r(.06, .1)); mute = false; } } // 落在牆裡的不放（牆面往裡凸的地方，ground 找不到地面）
    for (let k = 0; k < 6 * LQ; k++) decal(col('#b4c2bd'), r(s0, s1), r(-.55, .55), r(.4, .8), r(.3, .6)); // 沙地：淡淡的濕沙
    // 潮池邊的礁石：大小不一、有疏有密（不是排成正圓的一圈）
    const pr = c.pool.r, py = c.hall.y;
    for (let k = 0, a = r(0, 6), nR = LOW ? 13 : 22, da = 6.28 / nR; k < nR; k++) { a += da * r(.6, 1.4); const big = rd() < .3, d = pr + .22 + r(-.08, .22) + (big ? .12 : 0), sz = big ? r(.38, .58) : r(.2, .36); add(G0.rock, rockC().multiplyScalar(.85), Object.assign({ x: c.pool.x + Math.cos(a) * d, y: py + .02, z: c.pool.z + Math.sin(a) * d }, hp), rd() * 3, rd() * 3, 0, sz, sz * r(.45, .65), sz * r(.8, 1.1)); }
    for (let k = 0; k < (LOW ? 3 : 6); k++) { const a = rd() * Math.PI * 2, d = pr + r(.7, 1.7), x = c.pool.x + Math.cos(a) * d, z = c.pool.z + Math.sin(a) * d, q = caveQ(c, x, z, c.hallI); mute = !caveIn(c, q.s, q.l, .04); add(G0.star, col(pk(['#fb923c', '#f472b6', '#facc15'])), Object.assign({ x, y: py + .004, z }, hp), 0, rd() * 6, 0, r(.13, .2), .4, r(.13, .2), true); mute = false; } // 海星：趴在沙上（平平的一片：落在牆腳斜面上的不放，原本有兩顆埋在斜面裡）
    for (let g = 0; g < (LOW ? 2 : 3); g++) { const a0 = r(0, 6.28); for (let k = 0; k < (LOW ? 2 : 3); k++) { const a = a0 + r(-.3, .3), d = pr + r(.4, 1), x = c.pool.x + Math.cos(a) * d, z = c.pool.z + Math.sin(a) * d, cl = col(pk(['#fb7185', '#fdba74', '#f9a8d4'])), hgt = r(.25, .6); add(G0.cyl, cl, Object.assign({ x, y: py + hgt / 2 - .01, z }, hp), r(-.3, .3), 0, r(-.3, .3), .04, hgt, .04, true); add(G0.ico, cl, Object.assign({ x, y: py + hgt, z }, hp), 0, 0, 0, .07, .07, .07, true); } } // 珊瑚：三叢
    for (const [sa, sb] of [[CAVE_L0 * .3, c.sIn], [L - c.sIn, L - CAVE_L0 * .3]]) for (let k = 0; k < 10 * LQ; k++) { const p = at(r(sa, sb), r(-.8, .8), 0), len = r(.5, 1.3); p.y += caveCeil(c, p.s, p.l) + .1 - len / 2; add(G0.box, col(['#4d7c3a', '#6b8f4e', '#3f6b4a'][k % 3]), p, r(-.1, .1), p.ry + r(-.5, .5), r(-.15, .15), .05, len, .14); } // 洞口的海草：從實際的洞頂垂下來
    // 小景點一：牆腳一個退潮留下的小潮池（水面和其他水窪合併；靠牆那半圈的礁石大、靠路那半圈小），邊上有海葵與海星，小螃蟹住在這裡
    { const v = c.vig[0], i = iOf(v.s), w = caveW(c, i, v.side), R = Math.min(.72, fe * w * .4), l = v.side * (fe * w - R - .06), q = ground(v.s, l); c.tide = { x: q.x, z: q.z, y: q.y, r: R, s: v.s, i };
      pud.push({ x: q.x, z: q.z, y: q.y + .03, r: R, k: 1 });
      for (let k = 0, nR = LOW ? 7 : 10; k < nR; k++) { const a = k / nR * Math.PI * 2 + r(-.2, .2), d = R + r(.03, .12), x = q.x + Math.cos(a) * d, z = q.z + Math.sin(a) * d, p = groundXZ(x, z), sz = r(.08, .15) * ((p.l - l) * v.side > 0 ? 1.3 : .7); add(G0.rock, rockC(), p, rd() * 3, rd() * 3, 0, sz * 1.2, sz * .6, sz); }
      const anem = (x, z, cl) => { const p = groundXZ(x, z); add(G0.cyl, cl, { x: p.x, y: p.y + .04, z: p.z, i }, 0, 0, 0, .05, .1, .05, true); for (let t = 0, nt = LOW ? 4 : 7; t < nt; t++) { const a = t / nt * Math.PI * 2, d = new THREE.Vector3(Math.cos(a) * .6, 1, Math.sin(a) * .6).normalize(); grow(G0.cone, .5, cl.clone().multiplyScalar(1.1), { x: p.x + Math.cos(a) * .03, y: p.y + .08, z: p.z + Math.sin(a) * .03, i }, d, .13, .016, true, 0); } };
      for (let k = 0; k < 3; k++) { const a = Math.atan2(q.z - c.Z[i], q.x - c.X[i]) + r(-1.4, 1.4), d = R + r(.15, .3); anem(q.x + Math.cos(a) * d, q.z + Math.sin(a) * d, col(pk(['#fb7185', '#f472b6', '#fdba74']))); }
      { const a = r(0, 6.28), p = groundXZ(q.x + Math.cos(a) * (R + .45), q.z + Math.sin(a) * (R + .45)); add(G0.star, col('#fb923c'), { x: p.x, y: p.y + .004, z: p.z, i }, 0, rd() * 6, 0, .16, .4, .16, true); }
      for (let k = 0; k < (LOW ? 3 : 6); k++) { const a = r(0, 6.28), p = groundXZ(q.x + Math.cos(a) * (R + r(.3, .9)), q.z + Math.sin(a) * (R + r(.3, .9))); mute = !onRock(p); add(G0.ico, col(pk(['#f5d0c5', '#fde4cf', '#fbcfe8'])), p, 0, rd() * 3, 0, r(.05, .09), .03, r(.05, .08)); mute = false; } } // 貝殼：落在牆裡的不放
    // 小景點二：牆腳一個大大的貝殼，微微張開，裡面躺著一顆會發光的珍珠
    { const v = c.vig[1], i = iOf(v.s), w = caveW(c, i, v.side), p = ground(v.s, v.side * (fe * w - .38)), F = new THREE.Matrix4().compose(new THREE.Vector3(p.x, p.y, p.z), new THREE.Quaternion().setFromAxisAngle(UP, Math.atan2(-v.side * p.nx, -v.side * p.nz)), new THREE.Vector3(1, 1, 1)), L4 = (m) => F.clone().multiply(m), hinge = new THREE.Matrix4();
      (c.obst || (c.obst = [])).push({ ax: p.x, az: p.z, bx: p.x, bz: p.z, r: .45 }); // 人與史萊姆繞開它
      items.push([G0.shell, col('#f3d7f5'), L4(M4(0, .2, 0, Math.PI, 0, 0, .5, .2, .4)), false, i, 0]); // 下殼（倒過來的半球＝碗）
      hinge.makeTranslation(0, .2, -.38).multiply(new THREE.Matrix4().makeRotationX(-.55)).multiply(new THREE.Matrix4().makeTranslation(0, 0, .38)); items.push([G0.shell, col('#f8e3fb'), L4(hinge.multiply(M4(0, 0, 0, 0, 0, 0, .5, .16, .4))), false, i, 0]); // 上殼：繞著靠牆那一邊的鉸鏈打開
      items.push([G0.sph, col('#fdf4ff'), L4(M4(0, .24, .04, 0, 0, 0, .085, .085, .085)), true, i, 0]); glints.push({ x: p.x, y: p.y + .3, z: p.z, big: 1 }); // 珍珠
      for (let k = 0; k < 4; k++) { const a = r(0, 6.28), g = groundXZ(p.x + Math.cos(a) * r(.6, 1), p.z + Math.sin(a) * r(.6, 1)); mute = !onRock(g); add(G0.ico, col(pk(['#f5d0c5', '#fde4cf', '#fbcfe8'])), g, 0, rd() * 3, 0, r(.05, .09), .03, r(.05, .08)); mute = false; } }
  } else if (th === 'lava') {
    for (let k = 0; k < 26 * LQ; k++) { const s = k < 14 ? hallS + r(-hw, hw) : r(s0, s1), side = rd() < .5 ? -1 : 1; if (nearMural(s, side) || nearVig(s, 2)) continue; const hgt0 = Math.abs(s - hallS) < hw * 1.1 ? r(1.2, 4.2) : r(.6, 2), rr = r(.22, .42), p = out(at(s, side * r(.72, .9), 0), side, rr - .05), hgt = Math.min(hgt0, caveCeil(c, p.s, p.l) - .6); if (hgt < .3) continue; p.y += floorY(p) + hgt / 2 - .1; add(G0.hex, col('#3b2b27').multiplyScalar(r(.85, 1.15)), p, r(-.06, .06), rd(), r(-.06, .06), rr, hgt, rr); } // 玄武岩柱：靠牆站，不擋路
    for (let k = 0; k < 18 * LQ; k++) { const p = at(r(s0, s1), (rd() < .5 ? -1 : 1) * r(.45, .8), .1); p.y += floorY(p); add(G0.oct, col('#2d1f3d'), p, r(-.5, .5), rd() * 3, r(-.5, .5), r(.06, .12), r(.2, .45), r(.06, .12)); } // 黑曜石碎片
    for (let s = c.lava.s0; s < c.lava.s1; s += r(1.5, 2.8) / LQ) { const i = iOf(s), p = ground(s, caveLavaL(c, i) + (rd() < .5 ? -1 : 1) * r(.4, .55), -.03); add(G0.ico, col(rd() < .5 ? '#ff8a3d' : '#ffb35c'), p, rd() * 3, rd() * 3, 0, r(.07, .14), r(.05, .09), r(.07, .14), true); } // 熔岩溝邊的餘燼石
    for (let k = 0; k < 6 * LQ; k++) decal(col('#4a3631'), r(s0, s1), r(-.1, .5), r(.35, .7), r(.3, .55)); // 焦黑的地面（避開左邊的熔岩溝；原本黑得像地上破洞）
    // 硫磺結晶：大廳的牆上、牆腳一小叢一小叢
    for (let k = 0; k < (LOW ? 3 : 6); k++) { const side = rd() < .5 ? -1 : 1, s = hallS + r(-hw, hw) * .7; if (nearMural(s, side)) continue; const yy = r(.3, 1.1); for (let j = 0; j < 3; j++) { const y2 = yy + r(-.12, .12), p = onWall(s + r(-.2, .2), side, y2, -.02); grow(G0.oct, 1, col(pk(['#eab308', '#ca8a04', '#facc15'])), p, wallN(p, side, y2), r(.1, .22), r(.035, .06)); } }
    // 小景點一：右邊牆腳一個冒泡的熔岩小池（發光的熔岩面、一圈結了硬殼的黑岩、往外裂開的發光細縫；火星與熱氣從這裡冒出來，人會繞開它）
    { const v = c.vig[0], i = iOf(v.s), w = caveW(c, i, v.side), R = Math.min(.45, fe * w * .3), l = v.side * (fe * w - R - .12), q = ground(v.s, l); c.magma = { x: q.x, y: q.y, z: q.z, r: R };
      (c.obst || (c.obst = [])).push({ ax: q.x, az: q.z, bx: q.x, bz: q.z, r: R + .15 });
      items.push([G0.disc16, col('#ff7a2e'), M4(q.x, q.y + .03, q.z, 0, r(0, 3), 0, R, 1, R), 2, i, 0], [G0.disc, col('#ffd166'), M4(q.x, q.y + .036, q.z, 0, r(0, 3), 0, R * .5, 1, R * .42), 2, i, 0]);
      for (let k = 0; k < 11; k++) { const a = k / 11 * Math.PI * 2 + r(-.15, .15), d = R + r(.03, .1), p = groundXZ(q.x + Math.cos(a) * d, q.z + Math.sin(a) * d), sz = r(.12, .22); add(G0.rock, col('#2b211d').multiplyScalar(r(.9, 1.25)), p, rd() * 3, rd() * 3, 0, sz * 1.15, sz * .55, sz); }
      // 裂縫：從池邊往外、一折一折變細（兩段平躺的細錐，原本是一條條直直的發光棒）；每段順著兩端的地面（小池在牆腳，往外的裂縫會爬上斜面，水平的錐會整段插進斜面裡）
      for (let k = 0; k < 5; k++) { let a = k / 5 * 6.28 + r(-.4, .4), x = q.x + Math.cos(a) * (R + .06), z = q.z + Math.sin(a) * (R + .06), rr = .04; for (let j = 0; j < 2; j++) { const len = r(.25, .5) * (j ? .8 : 1), p0 = groundXZ(x, z, .012), p1 = groundXZ(x + Math.cos(a) * len, z + Math.sin(a) * len, .012), d = new THREE.Vector3(p1.x - p0.x, p1.y - p0.y, p1.z - p0.z), dl = d.length() || 1; mute = !onRock(p0) || !onRock(p1); grow(G0.cone, .5, col(j ? '#ff7a2e' : '#ffa54d'), p0, d.divideScalar(dl), dl, rr, 2, 0); mute = false; x += Math.cos(a) * len * .92; z += Math.sin(a) * len * .92; a += r(-.7, .7); rr *= .62; } } }
    // 小景點二：靠牆一排排六角形的玄武岩柱，最裡面最高、往外一階一階變矮（像管風琴）；腳下一叢硫磺結晶
    { const v = c.vig[1], i = iOf(v.s), w = caveW(c, i, v.side), n = LOW ? 6 : 12;
      for (let k = 0; k < n; k++) { const row = k % 3, col3 = (k / 3) | 0, p0 = atL(v.s + (col3 - (n / 3 - 1) / 2) * .4 + row * .2, v.side * (fe * w + .15 - row * .34), 0), hgt = Math.min(r(2.2, 2.9) - row * .7 - Math.abs(col3 - 1.5) * .15, caveCeil(c, p0.s, p0.l) - .4); if (hgt < .3) continue; p0.y += floorY(p0) + hgt / 2 - .12; add(G0.hex, col('#3b2b27').multiplyScalar(r(.88, 1.12)), p0, 0, p0.ry + Math.PI / 6, 0, .2, hgt, .2); }
      { const lo = v.side * (fe * w + .15 - 2 * .34), a = atL(v.s - (n / 3 - 1) / 2 * .4, lo, 0), b = atL(v.s + (n / 3 - 1) / 2 * .4 + .4, lo, 0); (c.obst || (c.obst = [])).push({ ax: a.x, az: a.z, bx: b.x, bz: b.z, r: .28 }); } // 最外排一條碰撞：人與史萊姆繞開柱子
      cluster(G0.oct, 1, v.s + 1.6, v.side, .6, LOW ? 3 : 5, .32, .06, () => col(pk(['#facc15', '#fde047'])), true); }
  } else if (th === 'ice') {
    // 冰晶簇：靠牆，每一根各自貼地、往洞裡散開；有的尖端會閃（粒子）
    const nC = Math.round(22 * LQ); for (let k = 0; k < nC; k++) { const s = k < nC * .45 ? hallS + r(-hw, hw) : r(s0, s1), side = rd() < .5 ? -1 : 1; if (nearMural(s, side) || nearVig(s, 2.5)) continue; const glow = rd() < .3; cluster(G0.oct, 1, s, side, r(.62, .88), LOW ? 3 : Math.floor(r(3, 6)), r(.5, 1.15), r(.08, .14), () => glow ? col('#a5f3fc') : col(pk(['#d7f0ff', '#e8f6ff', '#c9e6fb'])), glow, .45); }
    for (const [sa, sb] of [[0, c.sIn * .7], [L - c.sIn * .7, L]]) for (let k = 0; k < (LOW ? 7 : 9); k++) { const p = at(r(sa, sb), (rd() < .5 ? -1 : 1) * r(.4, .9), 0); p.y += floorY(p); add(G0.dome, col('#f4f9ff'), p, 0, rd() * 3, 0, r(.5, 1.1), r(.15, .35), r(.4, .9)); } // 洞口的雪堆
    for (let k = 0; k < 14 * LQ; k++) { const side = rd() < .5 ? -1 : 1, yy = r(.5, 2.6), p = onWall(r(s0, s1), side, yy, -.012), sz = r(.04, .08); flat(G0.oct, col('#eef8ff'), p, wallN(p, side, yy), sz, sz * .3, sz * r(.7, 1)); } // 凍在冰裡的氣泡：扁扁的一顆貼在牆面裡
    // 小景點一：冰瀑——一道從拱頂順著牆面流下來、凍住的瀑布：一片貼著牆的冰，一欄一欄往下流、越下面鼓得越厚（兩邊與上緣埋進牆裡，看得出是從牆裡流出來的），
    // 腳下凍成一灘長長的冰。原本是一整排從拱頂垂下來的冰柱，下面的牆往外凸，整排看起來浮在通道中間
    { const v = c.vig[0], i = iOf(v.s), side = v.side, w = caveW(c, i, side), nc = LOW ? 6 : 10, nr = LOW ? 4 : 7, span = 1.35, G = [];
      for (let a = 0; a < nc; a++) { const f = (a / (nc - 1) - .5) * 2, sa = v.s + f * span, top = 2.95 - f * f * .95 + (a % 2 ? -.14 : .05), e = 1 - f * f, row = [];
        for (let b = 0; b < nr; b++) { const t = b / (nr - 1), y = top * (1 - t) + .02 * t, bl = b === 0 || a === 0 || a === nc - 1 ? -.04 : (.025 + .2 * e * Math.pow(t, .7)) * (a % 2 ? .75 : 1); row.push(onWall(sa, side, y, bl)); }
        G.push(row); }
      for (let a = 0; a < nc - 1; a++) { const pos = []; for (let b = 0; b < nr - 1; b++) { const A = G[a][b], B = G[a + 1][b], C2 = G[a + 1][b + 1], D = G[a][b + 1]; pos.push(A.x, A.y, A.z, B.x, B.y, B.z, D.x, D.y, D.z, B.x, B.y, B.z, C2.x, C2.y, C2.z, D.x, D.y, D.z); }
        const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); items.push([g, col(pk(['#8ac4ec', '#a2d2f2', '#b4dcf5', '#96cbef', '#c0e2f7'])), new THREE.Matrix4(), true, i, 0]); } // 自己帶一點光：在一樣是淺藍的冰牆前面看得出是一道冰瀑
      for (let k = 0; k < (LOW ? 3 : 6); k++) { const a = 1 + Math.floor(rd() * (nc - 2)), b = 1 + Math.floor(rd() * (nr - 2)), p = G[a][b]; glints.push({ x: p.x + side * p.nx * -.03, y: p.y, z: p.z + side * p.nz * -.03 }); } // 冰面上一閃一閃
      const q = ground(v.s, side * (fe * w - .45)); add(G0.disc16, col('#d4ecfd'), q, 0, q.ry, 0, .5, 1, span + .2, false, .02); add(G0.disc, col('#ffffff'), ground(v.s + .3, side * (fe * w - .5)), 0, q.ry + .2, 0, .12, 1, .5, false, .026); } // 結冰的水：沿著牆腳長長一灘，再一道白色的反光
    // 小景點二：冰筍林——地上長出來的冰筍，有高有矮；最高的一根和頭上的冰柱快要接在一起
    { const v = c.vig[1], n = LOW ? 4 : 8;
      for (let k = 0; k < n; k++) { const p0 = out(at(v.s + r(-1.8, 1.8), v.side * r(.5, .85), 0), v.side, .1), p = ground(p0.s, p0.l), big = k === 0, len = big ? Math.min(2.2, caveCeil(c, p.s, p.l) - 1.1) : r(.35, 1.5); grow(G0.cone6, .5, col(pk(['#e6f6ff', '#d3ecfb', '#bfe3f5'])), p, new THREE.Vector3(r(-.08, .08), 1, r(-.08, .08)).normalize(), len, len * r(.11, .18), false, .04); if (rd() < .5) glints.push({ x: p.x, y: p.y + len * .85, z: p.z });
        if (big) { const cy = p.y - floorY(p) + caveCeil(c, p.s, p.l), l2 = Math.max(.4, cy - p.y - len - .5); add(G0.cone6, col('#eef8ff'), { x: p.x, y: cy + .08 - l2 / 2, z: p.z, i: p.i }, Math.PI, rd() * 3, 0, .16, l2 + .1, .16); } } }
  } else if (th === 'moon') {
    const lk = c.lake, ly = c.hall.y, tab = (c.obst || [])[0], nearTab = (x, z, m) => tab && Math.hypot(x - (tab.ax + tab.bx) / 2, z - (tab.az + tab.bz) / 2) < 1.7 + m;
    for (let k = 0, a = r(0, 6), nR = LOW ? 16 : 26, da = 6.28 / nR; k < nR; k++) { a += da * r(.6, 1.4); const big = rd() < .25, d = lk.r + .18 + r(-.05, .2) + (big ? .1 : 0), sz = big ? r(.36, .55) : r(.2, .36), x = lk.x + Math.cos(a) * d, z = lk.z + Math.sin(a) * d, q = caveQ(c, x, z, c.hallI), fv = q.s < L ? caveVert(c, q.s, q.l, false) : 0, fy = fv > 0 && caveIn(c, q.s, q.l, fv + .03) ? fv : 0; add(G0.rock, col('#4c4775').multiplyScalar(r(.8, 1.1)), Object.assign({ x, y: ly + .03 + fy, z }, hp), rd() * 3, rd() * 3, 0, sz, sz * r(.45, .62), sz * r(.8, 1.1)); } // 湖邊的石頭：大小不一、有疏有密；湖岸碰到牆腳斜面的地方坐在斜面上（LOW 的斜面從 0.65 倍半寬就開始，原本有一顆整個埋在斜面裡）
    // 紫水晶簇：每一根各自貼地（原本整叢共用一個高度，斜面上的幾根浮在半空）；原本平貼在牆上的三角形晶面拿掉了
    const amet = () => col(pk(['#a78bfa', '#8b5cf6', '#c4b5fd']));
    for (let k = 0; k < 14 * LQ; k++) { const s = k < 8 * LQ ? hallS + r(-hw, hw) * .9 : r(s0, s1), side = rd() < .5 ? -1 : 1, p = at(s, side * .8, 0); if (nearTab(p.x, p.z, .5) || nearVig(s, 2)) continue; cluster(G0.oct, 1, s, side, r(.62, .9), LOW ? 3 : 5, r(.6, 1.3), r(.07, .13), amet, true, .35); }
    // 發光蘑菇：一家一家長（一朵大的、旁邊幾朵小的），多半在湖邊與牆腳；不再沿著湖排成一整圈
    const shroom = (p, hgt, cr, cl) => { add(G0.stem, col('#e7e5f5'), { x: p.x, y: p.y + hgt / 2 - .01, z: p.z, i: p.i }, r(-.08, .08), 0, r(-.08, .08), Math.max(.016, cr * .24), hgt, Math.max(.016, cr * .24), true); add(G0.cap, cl, { x: p.x, y: p.y + hgt - .015, z: p.z, i: p.i }, 0, rd() * 3, 0, cr, cr * r(.55, .75), cr, true); };
    const family = (x, z, big, cl0) => { const p = groundXZ(x, z), cl = col(cl0 || (rd() < .55 ? '#67e8f9' : '#f0abfc')); mute = wet(p, .05); shroom(p, big, big * .42, cl); if (!mute) flies.push({ x: p.x, y: p.y + big + .3, z: p.z }); for (let k = 0, n = LOW ? 2 : Math.floor(r(2, 5)); k < n; k++) { const a = r(0, 6.28), d = r(.13, .38), q = groundXZ(x + Math.cos(a) * d, z + Math.sin(a) * d), h2 = big * r(.3, .65); mute = wet(q, .05); shroom(q, h2, h2 * r(.4, .55), cl.clone().lerp(col('#ffffff'), r(0, .3))); } mute = false; }; // 保險：落在湖面上的那一朵不放
    // 湖伸進了洞底的圓頂：落點超過死路最後一圈的換到湖的對岸。原本 groundXZ 把超過的 s 夾回最後一圈，整家蘑菇沿著洞軸滑回湖面上，像從水裡長出來
    for (let k = 0; k < (LOW ? 3 : 6); k++) { const a = r(0, 6.28), d = lk.r + r(.8, 2.4); let x = lk.x + Math.cos(a) * d, z = lk.z + Math.sin(a) * d; if (caveQ(c, x, z, c.hallI).s > L - .9) { x = 2 * lk.x - x; z = 2 * lk.z - z; } const q = caveQ(c, x, z, c.hallI); if (nearTab(x, z, .3) || q.s > L - .9 || Math.abs(q.l) > q.w * fe - .3) continue; family(x, z, r(.22, .36)); }
    for (let k = 0; k < (LOW ? 2 : 5); k++) { const s = r(s0 + 2, s1 - 2), side = rd() < .5 ? -1 : 1, p = out(at(s, side * .75, 0), side, .05); if (nearTab(p.x, p.z, .3) || nearVig(s, 2.5)) continue; family(p.x, p.z, r(.16, .28)); } // 通道的牆腳也有幾家
    // 月光花：細細的花莖上一朵小星星，一小片一小片長在湖邊；腳下一圈葉子（遠遠看，花才不像浮在半空）。和蘑菇一樣，那一片超過死路的最後一圈就換到湖的對岸
    for (let k = 0; k < (LOW ? 2 : 4); k++) { let a0 = r(0, 6.28); const d0 = lk.r + r(1.2, 3); if (caveQ(c, lk.x + Math.cos(a0) * d0, lk.z + Math.sin(a0) * d0, c.hallI).s > L - .9) a0 += Math.PI; for (let j = 0; j < 4; j++) { const a = a0 + r(-.25, .25), d = d0 + r(-.3, .3), x = lk.x + Math.cos(a) * d, z = lk.z + Math.sin(a) * d; if (nearTab(x, z, 0) || caveQ(c, x, z, c.hallI).s > L - .5) continue; const p = groundXZ(x, z), hgt = r(.08, .16); add(G0.oct, col('#3f8f74'), { x: p.x, y: p.y + .006, z: p.z, i: p.i }, 0, rd() * 3, 0, .07, .014, .07); add(G0.stem, col('#6ee7b7'), { x: p.x, y: p.y + hgt / 2, z: p.z, i: p.i }, 0, 0, 0, .012, hgt, .012, true); add(G0.oct, col(pk(['#fef3c7', '#e9d5ff'])), { x: p.x, y: p.y + hgt + .015, z: p.z, i: p.i }, 0, rd() * 3, 0, .06, .025, .06, true); } }
    // 小景點：螢光蘑菇角落——牆腳三家蘑菇、牆上幾朵層層疊疊的層孔菌，螢光蟲在這裡飛
    { const v = c.vig[0], i = iOf(v.s);
      for (let k = 0; k < 3; k++) { const p = out(at(v.s + (k - 1) * .9 + r(-.2, .2), v.side * r(.7, .85), 0), v.side, .02); family(p.x, p.z, r(.28, .45), k === 1 ? '#5eead4' : null); }
      // 層孔菌：兩小叢、每叢兩三朵一層疊一層，都在蘑菇家族的正上方、膝蓋到腰的高度（原本一朵一朵從 0.35 排到 1.5 公尺，又薄又亮，看起來像一排貼紙浮在牆前）
      for (let g = 0; g < 2; g++) { const sg = v.s + (g ? .55 : -.75) + r(-.15, .15), y0 = r(.3, .5); for (let k = 0; k < (LOW ? 2 : 3); k++) { const yy = y0 + k * r(.13, .18), p = onWall(sg + r(-.12, .12), v.side, yy, -.05), n = wallN(p, v.side, yy), rr = r(.13, .2) * (1 - k * .15); add(G0.shelf, col(pk(['#2dd4bf', '#5eead4', '#22d3ee'])), p, 0, Math.atan2(-n.z, n.x), 0, rr, .075, rr, true); } }
      for (let k = 0; k < (LOW ? 4 : 10); k++) { const p = at(v.s + r(-2, 2), v.side * r(.1, .7), 0); flies.push({ x: p.x, y: p.y + r(.4, 1.8), z: p.z }); } }
  }
  // 滴水：從幾根鐘乳石的尖端（彼此隔 3 公尺以上）；海蝕洞、月光洞窟的一部分滴水底下有一灘水，冰洞的結成冰（腳下的地面記下來，粒子會在那裡濺起水花）
  const nD = Math.floor(({ sea: 24, ice: 11, moon: 9, lava: 0 })[th] * (LOW ? .45 : 1)), drips = c.drips = [], cand = tips.slice();
  for (let k = cand.length - 1; k > 0; k--) { const j = Math.floor(rd() * (k + 1)); [cand[k], cand[j]] = [cand[j], cand[k]]; }
  const onWater = (x, z) => [c.pool, c.lake].find(o => o && Math.hypot(x - o.x, z - o.z) < o.r + .1);
  for (const t of cand) {
    if (drips.length >= nD) break; if (drips.some(d => Math.abs(d.s - t.s) < 3)) continue;
    const wt = onWater(t.x, t.z), fy = wt ? c.hall.y + .05 : ground(t.s, t.l).y, h = t.y - fy; if (h < 1.2) continue; drips.push({ x: t.x, y: t.y, z: t.z, s: t.s, fy, h });
    const i = iOf(t.s), w = caveW(c, i, t.l), pr = r(.3, .62); if (wt || Math.abs(t.l) > fe * w - pr - .05 || rd() < .4) continue;
    // 結冰的小水窪（一道反光）；冰坑的坑口上面只有冰面，水窪會浮在坑上：不放（引數照樣算，亂數順序不變）
    if (th === 'ice') { const a = [G0.disc16, col('#cdeaff'), M4(t.x, fy + .02, t.z, 0, r(0, 3), 0, pr, 1, pr * r(.75, 1)), false, i, 0], b = [G0.disc, col('#f4fbff'), M4(t.x + pr * .2, fy + .024, t.z, 0, r(0, 3), 0, pr * .4, 1, pr * .2), false, i, 0]; if (!(c.icePit && Math.hypot(t.x - c.icePit.x, t.z - c.icePit.z) < (c.icePit.rIn || 0) + pr)) items.push(a, b); }
    else pud.push({ x: t.x, z: t.z, y: fy + .03, r: pr });
  }
  c.seeps.forEach(sp => { const i = iOf(sp.s), w = caveW(c, i, sp.side), pr = Math.min(.55, fe * w * .35), q = ground(sp.s, sp.side * (fe * w - pr - .05)); if (th === 'ice') items.push([G0.disc16, col('#cdeaff'), M4(q.x, q.y + .02, q.z, 0, r(0, 3), 0, pr, 1, pr * .8), false, i, 0]); else if (th !== 'lava' && !onWater(q.x, q.z)) pud.push({ x: q.x, z: q.z, y: q.y + .03, r: pr }); }); // 滲水的腳下
  // 烘焙：每一面依它的位置算光（和洞壁同一套）乘上自己的顏色；自己會發光的東西不受光照（glow＝2：顏色照給的，不依法線明暗）
  const A = new THREE.Vector3(), B = new THREE.Vector3(), C = new THREE.Vector3(), E1 = new THREE.Vector3(), E2 = new THREE.Vector3(), N = new THREE.Vector3(), tc = new THREE.Color(), base = new THREE.Color(), gk = 1.28 / (1.28 + (T.exp || 0));
  const bake = (list, mask) => {
    if (!list.length) return; let tot = 0; const gs = list.map(([g0, cl, m, glow, hi, dec]) => {
      const g = g0.index ? g0.toNonIndexed() : g0.clone(); g.applyMatrix4(m); tot += g.attributes.position.count;
      if (dec) { const p = g.attributes.position; for (let v = 0; v < p.count; v++) p.setY(v, caveQ(c, p.getX(v), p.getZ(v), hi).y + dec); }
      return [g, cl, glow, hi];
    });
    const pos = new Float32Array(tot * 3), cl = new Float32Array(tot * 3); let o = 0;
    gs.forEach(([g, col3, glow, hi]) => {
      const p = g.attributes.position.array; base.copy(col3);
      for (let t = 0; t + 8 < p.length; t += 9) {
        A.fromArray(p, t); B.fromArray(p, t + 3); C.fromArray(p, t + 6); N.crossVectors(E1.subVectors(B, A), E2.subVectors(C, A)).normalize();
        let rr, gg, bb;
        if (glow === 2) { rr = base.r * gk; gg = base.g * gk; bb = base.b * gk; }
        else if (glow) { const k = (.92 + .18 * N.y + .2 * (caveHash(t * .37, o * .001) - .5)) * gk; rr = base.r * k; gg = base.g * k; bb = base.b * k; } // 自己會發光的東西：扣掉這個洞多加的曝光，顏色才不會被沖淡；每一面亮度差一點，晶體才看得出稜角
        else { const cx = (A.x + B.x + C.x) / 3, cy = (A.y + B.y + C.y) / 3, cz = (A.z + B.z + C.z) / 3, q = caveQ(c, cx, cz, hi); caveLight(c, q.s, cx, cy, cz, clamp((cy - q.y) / q.h, 0, 1), tc); const k = .66 + .34 * N.y; rr = base.r * tc.r * k; gg = base.g * tc.g * k; bb = base.b * tc.b * k; }
        for (let v = 0; v < 3; v++) { pos[o] = p[t + v * 3]; pos[o + 1] = p[t + v * 3 + 1]; pos[o + 2] = p[t + v * 3 + 2]; cl[o] = rr; cl[o + 1] = gg; cl[o + 2] = bb; o += 3; }
      }
      g.dispose();
    });
    const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.BufferAttribute(pos, 3)); geo.setAttribute('color', new THREE.BufferAttribute(cl, 3)); geo.computeBoundingSphere();
    const m = new THREE.Mesh(geo, c.mat); m.layers.mask = mask; c.g.add(m); c.propTris = (c.propTris || 0) + tot / 3;
  };
  bake(items, 2); // 洞口兩段與深處合併成一個網格（兩者本來就在同一個圖層，分開只是多一次繪製）
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
      const q = caveQ(c, nx, nz, e.i); if (q.s < -1.2 || q.s > c.L + 1.2 || Math.abs(q.l) > q.w * .95) continue;
      const dir = e.s ? -1 : 1, why = caveBlock(c, dir); if (why) { if (why !== true) barrierMsg(why); return false; } // true＝擋住了，但由世界回應（不跳字）
      caveEnter(c, dir); return caveSlide(c, caveQ(c, nx, nz, e.i), nx, nz);
    }
    return undefined;
  }
  const c = CV.c, q = caveQ(c, nx, nz, CV.i);
  if (q.s < -1.6 || q.s > c.L + 1.6) { caveLeave(q.s > c.L ? 1 : 0); return undefined; }
  if (q.s > CV.far) CV.far = q.s; // 走到多深（死路的洞要走到裡面才算走過）
  return caveSlide(c, q, nx, nz);
}
function caveSlide(c, q, nx, nz) {
  // 走路界線：除了半寬，也看實際斷面在腰部與眼睛高度的牆（低畫質的斷面只有 8 個點，牆腳斜面在眼睛高度比半寬近），鏡頭才不會穿出牆
  let lim = Math.max(.15, q.w * .84 - P.r);
  if (c.rings && c.rings.length > 1) { const side = Math.sign(q.l) || 1, w1 = Math.abs(caveWallL(c, q.s, side, 1)), w2 = Math.abs(caveWallL(c, q.s, side, (P.eye || 1.62) + .15)), wm = Math.min(w1 || 1e9, w2 || 1e9); if (wm < 1e8) lim = Math.max(.15, Math.min(lim, wm - .42)); }
  if (Math.abs(q.l) > lim) { const k = (Math.abs(q.l) - lim) * Math.sign(q.l); nx -= q.nx * k; nz -= q.nz * k; }
  if (c.dead) { const e = caveEndClamp(c, nx, nz); if (e) { nx = e.x; nz = e.z; } } // 死路的盡頭：原本走進圓頂 1.6 公尺就被當成走出洞，人會跑到山頂上
  for (const o of [c.lake, c.pool]) { if (!o) continue; const dx = nx - o.x, dz = nz - o.z, d = Math.hypot(dx, dz), R = o.r + P.r * .6; if (d < R && d > 1e-4) { nx = o.x + dx / d * R; nz = o.z + dz / d * R; } }
  if (c.obst) for (const o of c.obst) { const q = caveObstQ(o, nx, nz), R = o.r + P.r * .6; if (q.d < R && q.d > 1e-4) { nx = q.cx + (nx - q.cx) / q.d * R; nz = q.cz + (nz - q.cz) / q.d * R; } } // 石碑、熔岩小池、玄武岩柱（線段＋半徑）
  P.x = nx; P.z = nz; const q2 = caveQ(c, nx, nz, q.i); CV.i = q2.i; CV.s = q2.s; CV.l = q2.l; return true;
}
// 死路盡頭的圓頂（caveCap）往外只收 0.7 倍的半寬：過了最後一圈，走得到的地方也收成半個橢圓，最多再往前 1.4 公尺
// （caveMove 在盡頭外 1.6 公尺會當成走出洞口、改用外面的地形高度——那裡是山頂）；沒超過最後一圈回傳 null
const CAVE_EC = { x: 0, z: 0 };
function caveEndClamp(c, x, z) {
  const i = c.n - 1, j = Math.max(0, i - 4), ax = c.X[i] - c.X[j], az = c.Z[i] - c.Z[j], al = Math.hypot(ax, az) || 1, tx = ax / al, tz = az / al; // 最後 2 公尺的方向
  let f = (x - c.X[i]) * tx + (z - c.Z[i]) * tz; if (f <= 0) return null;
  let l = -(x - c.X[i]) * tz + (z - c.Z[i]) * tx; const D = .7 * Math.min(Math.max(c.WL[i], c.WR[i]), c.Hh[i]), lat = Math.max(.15, (l < 0 ? c.WL[i] : c.WR[i]) * .84 - P.r);
  f = Math.min(f, Math.max(.2, Math.min(D - .6, 1.4))); const lm = lat * Math.sqrt(Math.max(0, 1 - (f / D) ** 2)); l = clamp(l, -lm, lm);
  CAVE_EC.x = c.X[i] + tx * f - tz * l; CAVE_EC.z = c.Z[i] + tz * f + tx * l; return CAVE_EC;
}
// 線段障礙物（ax,az）—（bx,bz）上離 (x, z) 最近的點與距離
const CAVE_OQ = { cx: 0, cz: 0, d: 0 };
function caveObstQ(o, x, z) { const ex = o.bx - o.ax, ez = o.bz - o.az, e2 = ex * ex + ez * ez, t = e2 > 1e-6 ? clamp(((x - o.ax) * ex + (z - o.az) * ez) / e2, 0, 1) : 0; CAVE_OQ.cx = o.ax + ex * t; CAVE_OQ.cz = o.az + ez * t; CAVE_OQ.d = Math.hypot(x - CAVE_OQ.cx, z - CAVE_OQ.cz); return CAVE_OQ; }
function caveBlock(c, dir) {
  const def = c.def; if (dir < 0) return '';
  // 能量門與寒氣不再跳字（11.2）：門上封印石沒亮的凹槽閃兩下、洞口凍得發抖的小雪人打個大噴嚏（game.js 的 gateBump／coldBump）
  if (def.gate && !S.zones.includes(def.gate)) { gateBump(def.gate); return true; }
  if (def.coat && !S.own.coat) { coldBump(); return true; }
  if (def.night && DN.night < .5) return '岩壁上有一道細細的裂縫，白天看起來只是岩石……也許夜裡再來看看？';
  return '';
}
function caveEnter(c, dir) { CV.c = c; CV.dir = dir; CV.i = dir > 0 ? 0 : c.n - 1; CV.mossT = 0; CV.far = 0; }
function caveLeave(side) {
  const c = CV.c; CV.c = null; CV.s = 0; if (!c) return;
  if (!c.dead && side === 1 && CV.dir === 1) { // 從月光谷走到新區域
    S.cave = S.cave || {}; S.cave.seen = S.cave.seen || {};
    const first = !S.cave.seen[c.id]; S.cave.seen[c.id] = 1; save();
    CV.flash = 1; if (first) CV.lift = 1.4; // 地名字卡：CV.c 一清掉，下一格 envStep 就換區（game.js 的 zoneArrive；第一次 2.5 秒、之後 1 秒）
  } else if (!c.dead && side === 0 && CV.dir === -1) { S.cave = S.cave || {}; (S.cave.seen = S.cave.seen || {})[c.id] = 1; CV.flash = .7; }
  else if (c.dead && side === 0 && CV.far > c.L * .6 && !(S.cave && S.cave.seen && S.cave.seen[c.id])) { S.cave = S.cave || {}; (S.cave.seen = S.cave.seen || {})[c.id] = 1; save(); } // 死路的洞（月光洞窟）走進去再出來也算走過：筆記本的地圖（map.js）才畫得出這條洞
}
function caveG(x, z) { const c = CV.c; if (!c) return H(x, z); const q = caveQ(c, x, z, CV.i); return q.s < -1.7 || q.s > c.L + 1.7 || Math.abs(q.l) > q.w + 1 ? H(x, z) : q.y; }
// 走過的洞：按住奔跑會稍微加速（快速通行，2.3）；冰洞的地面比較滑（只影響停下來的距離）
function caveSpeed(run) { return CV.c && run && S.cave && S.cave.seen && S.cave.seen[CV.c.id] ? 1.3 : 1; }
function caveSlip() { return CV.c && CV.c.th === 'ice' && CV.k > .3 ? .22 : 1; }
function caveSurface() { return CV.c ? (CV.c.puddles && CV.c.puddles.some(p => Math.hypot(P.x - p.x, P.z - p.z) < p.r + .15) ? 'splash' : CV.c.th === 'ice' ? 'ice' : 'rock') : null; }

/* ---------- 每格畫面：圖層、霧、光、出口的亮光、音樂 ---------- */
const CAVE_TC = new THREE.Color(), CAVE_TC2 = new THREE.Color();
function caveEnv(dt) {
  if (!CAVES.length || !P) return;
  // 主選單的環繞鏡頭不受玩家位置影響；順便記下「標題還在畫」與鏡頭的地面投影（天色跟著鏡頭），第一格先預熱開場會用到的著色器
  if (TITLE.on) {
    const cp = W.cam.position, e = INTRO.env || (INTRO.env = { x: 0, y: 0, z: 0, yaw: 0 }); INTRO.titleAt = performance.now(); e.x = cp.x; e.z = cp.z; e.y = H(cp.x, cp.z); IPV[5].set(0, 0, -1).applyQuaternion(W.cam.quaternion); e.yaw = Math.atan2(-IPV[5].x, -IPV[5].z); if (!INTRO.warm) introPrewarm();
    if (CV.mode !== 'out') { CV.mode = 'out'; W.cam.layers.mask = 1; CAVES.forEach(o => { o.g.visible = true; }); } return;
  }
  // 開場：先算好穿越機這一格的位置，山洞的霧、光、圖層、曝光跟著它（R），玩家自己的山洞狀態（CV.c、CV.s、CV.dir）不動
  if (INTRO.on) introAdvance(dt);
  const R = INTRO.on ? INTRO.v : CV;
  // 讀檔或傳送之後人在洞裡（例如存檔時正在洞裡）：找出是哪個洞（山脊上走不到，人在洞的範圍裡一定是在洞裡）；
  // 舊存檔的位置在洞壁外一點點（洞的曲線改過）、頭上又是山體，就拉回洞裡
  if (!INTRO.on && !CV.c && (++CV.scanN % 20 === 0 || CV.scanNow)) { let h = caveAt(P.x, P.z); if (!h) for (const c of CAVES) { const q = caveQ(c, P.x, P.z, null); if (q.s > 3 && q.s < c.L - 3 && Math.abs(q.l) < q.w + 2.5 && H(P.x, P.z) > q.y + q.h) { const k = (Math.abs(q.l) - Math.max(.15, q.w * .84 - P.r)) * Math.sign(q.l); P.x -= q.nx * k; P.z -= q.nz * k; h = { c, q: Object.assign({}, caveQ(c, P.x, P.z, q.i)) }; break; } } if (h) { caveEnter(h.c, h.q.s < h.c.L / 2 ? 1 : -1); CV.i = h.q.i; CV.s = h.q.s; P.y = h.q.y; P.vy = 0; if (CV.scanNow) P.camY = P.y; } CV.scanNow = 0; }
  if (CV.c && !INTRO.on) { const q = caveQ(CV.c, P.x, P.z, CV.i); if (q.s < -3 || q.s > CV.c.L + 3 || Math.abs(q.l) > q.w + 3) { CV.c = null; } }
  const c = R.c, s = R.s; let k = 0, mode = 'out';
  if (c) { k = smooth(1.5, c.sIn, s) * (c.dead ? 1 : 1 - smooth(c.L - c.sIn, c.L - 1.5, s)); mode = s > c.sIn && (c.dead || s < c.L - c.sIn) ? 'deep' : 'mouth'; }
  CV.k = k;
  if (mode !== CV.mode || c !== CV.visC) { // 換到另一個洞但模式沒變（例如從一個洞的深處傳送到另一個洞的深處）也要重算
    CV.mode = mode; CV.visC = c; W.cam.layers.mask = mode === 'deep' ? 6 : mode === 'mouth' ? 3 : 1;
    CAVES.forEach(o => { o.g.visible = mode === 'out' || o === c; }); // 在洞裡（含洞口那段）只畫目前這個洞
    if (W.sun && !LOW) W.sun.castShadow = mode !== 'deep';
    W.cam.children.forEach(ch => ch.traverse(o => { o.layers.mask = 7; })); if (W.goo && W.goo.im) W.goo.im.layers.mask = 7;
  }
  // 手上的東西（第一人稱的手、拿出來的筆記本／手機／手帳）是之後才建的：在洞裡每隔幾格補上圖層，洞深處也看得到
  if (mode !== 'out' && (CV.lyN = (CV.lyN || 0) + 1) % 12 === 0) W.cam.children.forEach(ch => ch.traverse(o => { o.layers.mask = 7; }));
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
  let ex = 1 + (.28 + ((T && T.exp) || 0)) * k;
  if (c && !c.dead) { const toEnd = R.dir > 0 ? c.L - s : s; ex += .55 * smooth(24, 3, toEnd) * (mode === 'deep' || toEnd < c.sIn ? 1 : 0); }
  if (CV.flash > 0) { CV.flash = Math.max(0, CV.flash - dt * .6); ex += .5 * CV.flash * CV.flash; }
  W.r.toneMappingExposure += (ex - W.r.toneMappingExposure) * Math.min(1, dt * 4);
  // 出口時鏡頭稍微抬起（第一次，2.3）
  if (CV.lift > 0 && !INTRO.on) { CV.lift = Math.max(0, CV.lift - dt); if (!GUI.kind) P.pitch += (.12 - P.pitch) * Math.min(1, dt * 1.6) * smooth(0, .5, CV.lift); }
  // 動畫：發光痕跡往出口流動、出口亮光在走近時淡出、月光洞窟
  for (const o of CAVES) {
    if (o.trailTex) o.trailTex.offset.x = -W.t * .45 * (o === c ? R.dir : 1);
    if (o !== c && mode !== 'out') continue;
    o.glows.forEach((g, j) => { const e = o.ends[j], d = o === c ? Math.abs((e.s || 0) - s) : 99; g.material.opacity = smooth(4, 16, d) * (1 - .55 * DN.night); });
    if (o.mat) { const nk = DN.night * (o.dead ? .3 : 1); o.mat.color.setRGB(1 - .3 * nk, 1 - .27 * nk, 1 - .15 * nk); } // 月光洞窟只在夜裡開，不再額外調暗
  }
  for (const o of CAVES) if (o.crabs) caveCrabStep(o, dt); // 小螃蟹：只有人在這個洞、離牠們 32 公尺內才動
  caveMoonStep(dt);
}
// 月光洞窟：夜裡裂縫透出淡紫色的光；湖面的月亮只在夜晚出現，天亮時慢慢淡去（5.3）
function caveMoonStep(dt) {
  const c = CAVES.find(o => o.id === 'moon'); if (!c) return; const n = DN.night;
  if (c.lake) { const u = c.lake.m.material.uniforms.mk; u.value += (n - u.value) * Math.min(1, dt * .5); }
  if (c.crack) { c.crack.material.opacity = .15 + .85 * n; c.crack.visible = true; if (c.plug) c.plug.visible = n < .5 && CV.c !== c && !(INTRO.on && INTRO.via === c); } // 天亮時人還在洞裡：洞口不封起來（5.3 出口一直開著）；開場穿過這個洞時整段都不封
  c.shafts.forEach(sh => { if (sh.m) sh.m.material.uniforms.k.value = .15 + .5 * n; if (sh.hole) sh.hole.material.color.set(n > .5 ? '#c7d2fe' : '#3b3f66'); });
}
// 洞裡的配樂：進洞時淡出、換成環境音；出洞時新區域的主題曲淡入（2.2）
function caveMusic() { return 1 - .92 * CV.k; }
function caveAmb() {
  const R = INTRO.on ? INTRO.v : CV; if (!R.c || CV.k < .3) return false; const t = AC.currentTime, th = R.c.th; // 開場時聽的是穿越機所在的洞
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
// 奶奶的筆記（6.1）：海蝕洞大廳前、熔岩隧道窄道那叢發光苔蘚旁各一張，放在一塊平頂的石頭上；紙由 game.js 的 gnBuild 擺（要等洞建好才知道洞裡的座標）。
// 都放在平地上（斷面 0.743 倍半寬以內是平的；熔岩溝在左側，苔蘚那張在右側），y＝洞的地面、ry＝紙的上緣朝著洞的深處（從洞口走進來看是正的）、c＝石頭的顏色（那個洞的岩石）
function caveGnSpots() {
  const at = (c, s, f, id) => { const i = clamp(Math.round(s / CAVE_STEP), 0, c.n - 1), l = f * caveW(c, i, f < 0 ? -1 : 1), x = c.X[i] - c.TZ[i] * l, z = c.Z[i] + c.TX[i] * l; return { id, x, z, y: caveQ(c, x, z, i).y, ry: Math.atan2(-c.TX[i], -c.TZ[i]) + (f < 0 ? -.35 : .35), cave: c, ped: 'rock', c: '#' + c.T.rockC.clone().lerp(new THREE.Color('#5a5a5a'), .55).getHexString() }; }; // 洞壁的岩石色偏灰一點：紙的材質吃洞裡的半球光（海蝕洞偏藍），原色會比洞壁鮮豔
  const free = (c, s0, f, id) => { for (const ds of [0, -1, 1, -2, 2, -3, 3, -4, 4]) { const p = at(c, s0 + ds, f, id); if (!(c.obst || []).some(o => caveObstQ(o, p.x, p.z).d < o.r + .9)) return p; } return at(c, s0, f, id); }; // 洞裡原本的石筍、熔岩小池、柱子旁邊讓開一點
  const out = [], sea = CAVES.find(c => c.id === 'sea'), lava = CAVES.find(c => c.id === 'lava');
  if (sea) { const H_ = sea.hallI, side = sea.WR[H_] >= sea.WL[H_] ? 1 : -1; out.push(free(sea, sea.S[H_] - sea.Wd[H_] * .8, -side * .42, 'gn7')); } // 壁畫在大廳外側的牆，紙在另一邊
  if (lava && lava.moss[1]) { const m = lava.moss[1]; out.push(free(lava, m.s - 1.2, m.side * .45, 'gn8')); }
  return out;
}
// 存檔：山洞的進度（走過哪些洞、拍過的壁畫、苔蘚）
function caveSan(o) {
  const obj = v => (v && typeof v === 'object' && !Array.isArray(v)) ? v : {}, ids = CAVE_DEF.map(d => d.id), pickIds = v => Object.fromEntries(Object.entries(obj(v)).filter(([k, x]) => ids.includes(k) && x).map(([k, x]) => [k, Math.max(1, Math.floor(+x) || 1)]));
  const c = obj(o), m = obj(c.moss);
  return { seen: pickIds(c.seen), mural: pickIds(c.mural), moss: { d: Math.floor(+m.d) || 0, n: Object.fromEntries(Object.entries(obj(m.n)).filter(([k]) => ids.includes(k)).map(([k, v]) => [k, clamp(Math.floor(+v) || 0, 0, 3)])) }, mossN: clamp(Math.floor(+c.mossN) || 0, 0, 9999) };
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
    if (c.lake) for (let k = 0; k < max; k++) { let a = k / max * Math.PI * 2 + .7; const d = c.lake.r + 1.4, at = a => [c.lake.x + Math.cos(a) * d, c.lake.z + Math.sin(a) * d], bad = ([x, z]) => caveQ(c, x, z, null).s > c.L - 1 || (c.obst || []).some(o => caveObstQ(o, x, z).d < o.r + 1); for (let t = 0; t < 8 && bad(at(a)); t++) a -= .45; spots.push(at(a)); } // 月光史萊姆：湖邊（原本有一隻生在石碑上、洞底的圓頂裡，動不了）
    else { const hs = c.S[c.hallI], hw = c.Wd[c.hallI]; [.3, .5, .74].slice(0, max).forEach((f, k) => { let s = c.sIn + 4 + f * (c.L - 2 * c.sIn - 8); if (Math.abs(s - hs) < hw * .5) s = hs + (k % 2 ? 1 : -1) * hw * .75; // 避開大廳中央的光柱
        for (const m of c.moss) if (Math.abs(m.s - s) < 3) s += 4; const i = clamp(Math.round(s / CAVE_STEP), 0, c.n - 1), lf = (k % 2 ? .3 : -.3) * caveW(c, i, k % 2 ? 1 : -1); spots.push([c.X[i] - c.TZ[i] * lf, c.Z[i] + c.TX[i] * lf]); }); }
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
  if (c.obst) for (const o of c.obst) if (caveObstQ(o, nx, nz).d < o.r + .4) ok = false;
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

/* ---------- 海蝕洞的小螃蟹：繞著潮池與小潮池橫著走、停一下、舉舉鉗子；有人大步靠近就沿著池邊衝開、鑽進沙裡躲一會兒（潛行慢慢靠近就不會嚇到） ---------- */
function caveCrabGeo() {
  const P = [], sh = '#f97316', dk = '#ea580c', cl = '#fb923c', bx = new THREE.BoxGeometry(1, 1, 1);
  // 三角形省著用（一隻約 200 面）：殼、腳（每邊兩隻）、手臂、鉗子、眼柄、眼睛
  const ball = (w, h) => new THREE.SphereGeometry(1, w, h);
  P.push([ball(7, 3), sh, M4(0, .06, 0, 0, 0, 0, .13, .06, .1)], [new THREE.CircleGeometry(1, 7).rotateX(Math.PI / 2), dk, M4(0, .03, 0, 0, 0, 0, .11, 1, .085)]); // 殼、肚子
  for (const s of [-1, 1]) {
    for (let k = 0; k < 2; k++) P.push([bx, dk, M4(s * .14, .035, -.03 + k * .06, 0, 0, -s * .5, .1, .02, .022)]); // 腳（往外、往下斜）
    P.push([bx, sh, M4(s * .09, .062, .1, 0, -s * .6, 0, .02, .02, .08)], [ball(5, 3), cl, M4(s * .12, .07, .15, 0, 0, 0, .045, .035, .052)]); // 手臂、鉗子
    P.push([new THREE.CylinderGeometry(.008, .008, .05, 3, 1, true), sh, M4(s * .035, .11, .07)], [new THREE.SphereGeometry(.021, 5, 3), '#ffffff', M4(s * .035, .14, .07)], [new THREE.SphereGeometry(.011, 4, 2), '#1f2937', M4(s * .035, .145, .087)]); // 眼柄、眼睛
  }
  // 一面一個顏色、依法線明暗（洞裡的光由每一隻的 instanceColor 乘上去：大廳亮、通道暗）
  const A = new THREE.Vector3(), B = new THREE.Vector3(), C = new THREE.Vector3(), N = new THREE.Vector3(), E1 = new THREE.Vector3(), E2 = new THREE.Vector3(), cc = new THREE.Color(), pos = [], col = [];
  P.forEach(([g0, h, m]) => { const g = (g0.index ? g0.toNonIndexed() : g0.clone()).applyMatrix4(m), p = g.attributes.position.array; cc.set(h); for (let t = 0; t + 8 < p.length; t += 9) { A.fromArray(p, t); B.fromArray(p, t + 3); C.fromArray(p, t + 6); N.crossVectors(E1.subVectors(B, A), E2.subVectors(C, A)).normalize(); const k = .66 + .34 * N.y; for (let v = 0; v < 9; v++) pos.push(p[t + v]); for (let v = 0; v < 3; v++) col.push(cc.r * k, cc.g * k, cc.b * k); } g.dispose(); });
  const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3)); geo.computeBoundingSphere(); return geo;
}
function caveCrabs(c, rd) {
  const n = LOW ? 3 : 6, nt = c.tide ? (LOW ? 1 : 2) : 0, r = (a, b) => a + rd() * (b - a), fe = caveFloorE(), list = [], tc = new THREE.Color();
  const im = new THREE.InstancedMesh(caveCrabGeo(), c.mat, n); im.instanceMatrix.setUsage(THREE.DynamicDrawUsage); im.layers.mask = 2; im.frustumCulled = false;
  for (let k = 0; k < n; k++) {
    const tide = k >= n - nt, o = tide ? c.tide : c.pool, h = { o, r0: o.r + (tide ? .12 : .35), r1: tide ? o.r + .9 : Math.min(c.hall.r - .3, o.r + 2.2) }, cr = { h, a: 0, d: h.r0, st: 0, t: r(0, 3), ta: 0, td: 0, sp: 0, dig: 0, wave: 0, face: rd() < .65 ? 0 : Math.PI, sc: r(.85, 1.2), i: c.hallI, x: 0, y: 0, z: 0, s: 0 };
    for (let t = 0; t < 12; t++) { cr.a = r(0, 6.28); cr.d = r(h.r0, h.r1); const q = caveQ(c, o.x + Math.cos(cr.a) * cr.d, o.z + Math.sin(cr.a) * cr.d, null); if (Math.abs(q.l) < q.w * fe - .3) break; }
    const q = caveQ(c, o.x + Math.cos(cr.a) * cr.d, o.z + Math.sin(cr.a) * cr.d, null); cr.i = q.i; caveLight(c, q.s, o.x, q.y + .1, o.z, .02, tc); im.setColorAt(k, tc.lerp(WHITE3, .32)); list.push(cr); // 光照之外帶一點自己的顏色：暗的通道裡也看得出是橘色的小螃蟹
  }
  c.g.add(im); c.crabs = { im, list }; caveCrabStep(c, 0, true);
}
const WHITE3 = new THREE.Color(1, 1, 1), CRAB_M = new THREE.Matrix4(), CRAB_Q = new THREE.Quaternion(), CRAB_E = new THREE.Euler(), CRAB_V = new THREE.Vector3(), CRAB_S = new THREE.Vector3();
function caveCrabStep(c, dt, force) {
  const C = c.crabs; if (!C) return; const R = INTRO.on ? INTRO.v : CV, here = !!force || (R.c === c && C.list.some(k => Math.abs(k.s - R.s) < 32)); // 不在這個洞、或離螃蟹都很遠：不算也不畫
  C.im.visible = here; if (!here) return;
  const fe = caveFloorE(), calm = INTRO.on || force, sneak = !!(P && P.sneak);
  C.list.forEach((k, j) => {
    const h = k.h, o = h.o, dp = calm ? 99 : Math.hypot(P.x - k.x, P.z - k.z), okAt = (a, d) => { const q = caveQ(c, o.x + Math.cos(a) * d, o.z + Math.sin(a) * d, k.i); return Math.abs(q.l) < q.w * fe - .3; };
    if (k.st < 2 && dp < (sneak ? 1.1 : 2.4)) { // 嚇一跳：沿著池邊往遠離人的那一邊衝開（繞著池子走，不會穿過水面）
      let da = k.a - Math.atan2(P.z - o.z, P.x - o.x); da -= Math.round(da / (Math.PI * 2)) * Math.PI * 2;
      k.ta = k.a + Math.sign(da || 1) * rnd(1.6, 2.6) / k.d; k.td = clamp(k.d + rnd(-.1, .4), h.r0, h.r1); if (!okAt(k.ta, k.td)) { k.ta = k.a + (k.ta - k.a) * .4; k.td = k.d; }
      k.st = 2; k.sp = 2.1; if (performance.now() - (C.fx || 0) > 1200) { C.fx = performance.now(); fx3(new THREE.Vector3(k.x, k.y + .35, k.z), '！', '#fdba74'); }
    }
    if (k.st === 0) { k.t -= dt; if (k.t <= 0) { if (Math.random() < .3) { k.wave = 1.3; k.t = rnd(1.5, 3); } else { k.t = 1; for (let t = 0; t < 6; t++) { const ta = k.a + rnd(-1.1, 1.1) * Math.min(1, 1.5 / k.d), td = rnd(h.r0, h.r1); if (okAt(ta, td)) { k.ta = ta; k.td = td; k.st = 1; k.sp = rnd(.22, .4); break; } } } } } // 舉舉鉗子，或沿著池邊橫著走一小段
    else if (k.st === 3) { k.t -= dt; if (k.t <= 0 && dp > 3.2) { k.st = 0; k.t = rnd(1, 2.5); } } // 躲在沙裡：人走遠了才出來
    else { const da = k.ta - k.a, dd = k.td - k.d, arc = Math.hypot(da * k.d, dd); if (arc < .02) { if (k.st === 2) { k.st = 3; k.t = rnd(2.5, 4.5); } else { k.st = 0; k.t = rnd(1.2, 4); } } else { const f = Math.min(1, k.sp * dt / arc); k.a += da * f; k.d += dd * f; } }
    k.wave = Math.max(0, k.wave - dt); k.dig = clamp(k.dig + (k.st === 3 ? dt * 3 : -dt * 1.2), 0, 1);
    k.x = o.x + Math.cos(k.a) * k.d; k.z = o.z + Math.sin(k.a) * k.d; const q = caveQ(c, k.x, k.z, k.i); k.i = q.i; k.s = q.s; k.y = q.y;
    // 姿勢：臉朝著池外（或池裡），往側邊走；走路時左右晃、小小地顛；舉鉗子時整隻往後仰；躲起來時沉進沙裡、壓扁
    const walk = k.st === 1 || k.st === 2, wob = walk ? Math.sin(W.t * (k.st === 2 ? 30 : 16) + j) * .12 : 0, lift = k.wave > 0 ? Math.sin(Math.min(1, k.wave) * Math.PI) : 0;
    CRAB_E.set(-lift * .35, Math.atan2(Math.cos(k.a), Math.sin(k.a)) + k.face, wob, 'YXZ');
    CRAB_M.compose(CRAB_V.set(k.x, k.y - k.dig * .09 + (walk ? Math.abs(Math.sin(W.t * 18 + j)) * .012 : 0), k.z), CRAB_Q.setFromEuler(CRAB_E), CRAB_S.set(k.sc, k.sc * (1 - k.dig * .55), k.sc)); C.im.setMatrixAt(j, CRAB_M);
  });
  C.im.instanceMatrix.needsUpdate = true;
}

/* ============================================================
   開場：穿越機（FPV 空拍機）——從現在的畫面一路飛進玩家的眼睛（每次進入遊戲都播，任意鍵略過）
   - 起點是上一格畫出來的鏡頭（標題的環繞鏡頭：位置、方向、速度都接著飛）；開機直接開始時是某個洞口外，黑幕淡入
   - 終點：最後一格剛好是玩家的眼睛與視線（P.x、P.camY＋P.eye、P.z；P.yaw、P.pitch），接回第一人稱時一格都不跳
   - 路線一定穿過一條山洞：人在哪一區就從那一區的洞飛出來，人在洞裡就沿著那條洞飛到身邊；可以選的時候用「時間＋懲罰」挑
   - 整條路線在 introStart 先算成一張表（每 0.5 公尺一筆：位置、時間、速度、在哪個洞的哪裡），播放時照時間查表；
     方向＝看路線前方的點＋轉彎傾斜＋一點抖動，經過角速度限制（不會急甩），最後 2 秒慢慢轉成玩家的視線
   - 只有跨 4 公里去大城市、或從標題直接飛到山脊外時，才在畫面完全被遮住（雲裡、出口的白光）的那幾格換位置
   - 開場期間不動玩家自己的山洞狀態（CV）：穿越機在哪個洞放在 INTRO.v，caveEnv 用它決定霧、光、圖層、曝光
   ============================================================ */
const INTRO = { on: false, t: 0, v: { c: null, s: 0, i: 0, dir: 1 }, env: null, titleAt: -1e9, warm: 0, force: null, seed: null, via: null, hum: null, ray: null };
const IPS = .5, ipv = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z), IPUP = ipv(0, 1, 0), IPM = new THREE.Matrix4(), IPE = new THREE.Euler(0, 0, 0, 'YXZ');
const IPQ = Array.from({ length: 5 }, () => new THREE.Quaternion()), IPV = Array.from({ length: 6 }, () => new THREE.Vector3()), IPC = new THREE.Color(), IPC2 = new THREE.Color();
const ihf = (c, i) => Math.min(c.Hh[i] * .45, 2.6); // 在洞裡飛的高度（離地）
const itp = (c, s) => { const i = clamp(Math.round(s / CAVE_STEP), 0, c.n - 1); return ipv(c.X[i], c.Y[i] + ihf(c, i), c.Z[i]); };
const ismo = x => { x = clamp(x, 0, 1); return x * x * x * (x * (x * 6 - 15) + 10); }; // smootherstep：頭尾的速度、加速度都是 0
const ipLocked = c => !!((c.def.gate && !S.zones.includes(c.def.gate)) || (c.def.coat && !S.own.coat));
const ipBack = (L, k = 3) => { const n = L.length, a = L[n - 1].p, b = L[Math.max(0, n - 1 - k)].p, d = a.clone().sub(b); return d.lengthSq() > 1e-8 ? d.normalize() : null; }; // 一段路最後的方向

/* ---------- 路線的積木（全部在 introStart 時算好） ---------- */
// 洞口：e＝0 平地那側、1 區域那側；o＝往洞外、nr＝橫向、tail＝洞口往裡 4 公尺（曲線在洞口和洞軸共線）
function ipMouth(c, e) { const i = e ? c.n - 1 : 0, k = e ? 1 : -1, o = ipv(c.TX[i] * k, 0, c.TZ[i] * k).normalize(); return { i, m: itp(c, e ? c.L : 0), o, nr: ipv(-o.z, 0, o.x), tail: itp(c, e ? c.L - 4 : 4) }; }
// 向心 Catmull-Rom（alpha 0.5：控制點忽遠忽近也不會打結）
function ipCmr(a, b, c, d, u) {
  const t1 = Math.sqrt(Math.max(1e-6, a.distanceTo(b))), t2 = t1 + Math.sqrt(Math.max(1e-6, b.distanceTo(c))), t3 = t2 + Math.sqrt(Math.max(1e-6, c.distanceTo(d))), t = t1 + (t2 - t1) * u;
  const L = (p, q, ta, tb) => p.clone().multiplyScalar((tb - t) / (tb - ta)).addScaledVector(q, (t - ta) / (tb - ta)), A1 = L(a, b, 0, t1), A2 = L(b, c, t1, t2), A3 = L(c, d, t2, t3);
  return L(L(A1, A2, 0, t2), L(A2, A3, t1, t3), t1, t2);
}
// 控制點 → 曲線 → 每 0.5 公尺重新取樣；head／tail 是頭尾的虛擬點，決定端點的切線
function ipCR(ctrl, head, tail) {
  const n = ctrl.length, Q = [head || ctrl[0].clone().multiplyScalar(2).sub(ctrl[1]), ...ctrl, tail || ctrl[n - 1].clone().multiplyScalar(2).sub(ctrl[n - 2])], raw = [];
  for (let i = 1; i < Q.length - 2; i++) { const m = Math.max(4, Math.ceil(Q[i].distanceTo(Q[i + 1]) / .15)); for (let k = 0; k < m; k++) raw.push(ipCmr(Q[i - 1], Q[i], Q[i + 1], Q[i + 2], k / m)); }
  raw.push(ctrl[n - 1].clone()); const out = [raw[0]]; let acc = 0, need = IPS;
  for (let i = 1; i < raw.length; i++) { const a = raw[i - 1], b = raw[i], l = a.distanceTo(b); while (l > 1e-9 && acc + l >= need) { out.push(a.clone().lerp(b, (need - acc) / l)); need += IPS; } acc += l; }
  const last = ctrl[n - 1]; if (out.length > 1 && out[out.length - 1].distanceTo(last) < .2) out[out.length - 1] = last.clone(); else out.push(last.clone()); return out;
}
// 地面（離地檢查用）：海面也算地面；大城市是平的
const ipGround = (x, z) => x > 1500 ? 0 : x > 200 ? Math.max(H(x, z), -1.1) : H(x, z);
// 洞口直段的走廊（地形在這裡挖空，H 是山體的高度）：離地檢查不算這裡
function ipCorr(x, z) {
  for (const c of CAVES) for (const e of c.ends) { if (Math.abs(x - e.x) > 14 || Math.abs(z - e.z) > 14) continue; const q = caveQ(c, x, z, e.i); if (Math.abs(q.l) < q.w && (e.s ? q.s > c.L - CAVE_L0 - 2 && q.s < c.L + 2 : q.s > -2 && q.s < CAVE_L0 + 2)) return true; }
  return false;
}
let IPCLR = null; // 減少動態時空中段貼著地面飛（2 公尺），不要一出洞就爬高
// 空中段：依地形墊高到 H＋9（LOW 7）公尺，離錨點 fa／fb 公尺內淡掉（最少離地 1 公尺）；先取「帳篷形」最大值再平均，讓高度提前慢慢升起
function ipAir(pts, fa = 26, fb = 26) {
  const n = pts.length, clr = IPCLR != null ? IPCLR : LOW ? 7 : 9, rise = new Float32Array(n), w = new Float32Array(n), tent = new Float32Array(n), R = 60, A = 24; fa = Math.max(.5, fa); fb = Math.max(.5, fb);
  for (let i = 0; i < n; i++) { const p = pts[i]; w[i] = smooth(0, fa, i * IPS) * smooth(0, fb, (n - 1 - i) * IPS); if (p.x > 1500 || !ipCorr(p.x, p.z)) rise[i] = Math.max(0, ipGround(p.x, p.z) + Math.max(1, clr * w[i]) - p.y); }
  for (let i = 0; i < n; i++) { let m = 0; for (let j = Math.max(0, i - R); j <= Math.min(n - 1, i + R); j++) m = Math.max(m, rise[j] * (1 - Math.abs(j - i) / (R + 1))); tent[i] = m; }
  const long = n * IPS > 80; // 長的空中段、離地 12 公尺以上：飛快一點（34 m/s）
  return pts.map((p, i) => { let s = 0, k = 0; for (let j = Math.max(0, i - A); j <= Math.min(n - 1, i + A); j++) { s += tent[j]; k++; } p.y += Math.max(s / k * w[i], rise[i]); return { p, c: null, s: 0, sd: 1, hi: long && p.x < 1500 && p.y - ipGround(p.x, p.z) > 12 }; });
}
// 洞壁實際的形狀：管子是低面數的（LOW 每圈只有 8 個點、2.4 公尺一圈），轉角的弦會切進標稱的斷面裡。
// 從建好的管子網格取出這個 s 前後兩圈的頂點，內插成斷面多邊形；點離每一邊不到 mg 公尺（或在外面）就往斷面中心推
function ipPolyDist(P, x, y) { let inside = false, md = 1e9; for (let i = 0, j = P.length - 1; i < P.length; j = i++) { const xi = P[i][0], yi = P[i][1], xj = P[j][0], yj = P[j][1]; if ((yi > y) !== (yj > y) && x < (xj - xi) * (y - yi) / (yj - yi) + xi) inside = !inside; const ex = xi - xj, ey = yi - yj, L2 = ex * ex + ey * ey, t = L2 > 0 ? clamp(((x - xj) * ex + (y - yj) * ey) / L2, 0, 1) : 0; md = Math.min(md, Math.hypot(x - xj - ex * t, y - yj - ey * t)); } return inside ? md : -md; }
// 把一個點推回實際的洞壁裡面（離牆 mg 公尺以上）：斷面直接用洞壁建模時存下的每一圈（c.rings → caveSlice），
// 彎道加密、冰洞挖坑之後也對得上
function ipInside(c, s, p, mg = .4) {
  if (!c.rings || c.rings.length < 2) return p; const i = clamp(Math.round(s / CAVE_STEP), 0, c.n - 1), N = caveSlice(c, s), poly = [];
  for (let k = 0; k < N; k++) poly.push([CAVE_SL[k * 2], CAVE_SL[k * 2 + 1]]);
  const cx = c.X[i], cz = c.Z[i], tx = c.TX[i], tz = c.TZ[i], nx = -tz, nz = tx, y0 = c.Y[i];
  const along = (p.x - cx) * tx + (p.z - cz) * tz; let lx = (p.x - cx) * nx + (p.z - cz) * nz, ly = p.y - y0; const cy = c.Hh[i] * .45;
  for (let it = 0; it < 16 && ipPolyDist(poly, lx, ly) < mg; it++) { lx += (0 - lx) * .2; ly += (cy - ly) * .2; }
  p.x = cx + nx * lx + tx * along; p.z = cz + nz * lx + tz * along; p.y = y0 + ly; return p;
}
// 洞裡：沿中心線（離地 ihf），±3 公尺移動平均把折角削圓；橫向不超過「半寬−0.7」，高度在地面＋0.6 到洞頂−0.4 之間，再確認離實際的洞壁 0.4 公尺以上
function ipTube(c, s0, s1) {
  const dir = s1 >= s0 ? 1 : -1, len = Math.abs(s1 - s0), n = Math.max(2, Math.ceil(len / IPS - 1e-6) + 1), ss = [], raw = [];
  for (let k = 0; k < n; k++) { const s = s0 + dir * Math.min(k * IPS, len); ss.push(s); raw.push(itp(c, s)); }
  const R = 6; return raw.map((p, k) => {
    let x = 0, y = 0, z = 0, m = 0; for (let j = Math.max(0, k - R); j <= Math.min(n - 1, k + R); j++) { x += raw[j].x; y += raw[j].y; z += raw[j].z; m++; }
    const q = ipv(x / m, y / m, z / m), e = Math.min(k, n - 1 - k) / R; if (e < 1) q.lerp(p, 1 - e);
    const i = clamp(Math.round(ss[k] / CAVE_STEP), 0, c.n - 1), nx = -c.TZ[i], nz = c.TX[i], l = (q.x - c.X[i]) * nx + (q.z - c.Z[i]) * nz, lim = Math.max(0, c.Wd[i] - .7);
    if (Math.abs(l) > lim) { const d = (Math.abs(l) - lim) * Math.sign(l); q.x -= nx * d; q.z -= nz * d; }
    q.y = clamp(q.y, c.Y[i] + .6, c.Y[i] + c.Hh[i] - .4); ipInside(c, ss[k], q); return { p: q, c, s: ss[k], sd: dir };
  });
}
// 洞裡的一段曲線（落地、繞湖）：每一筆都標上在哪個洞的哪裡（洞口外的算在洞外；死路的洞底那頭一律算在洞裡）；
// 曲線轉彎時會往外鼓：在洞裡的點夾回離牆 0.45 公尺、離地 0.65 到洞頂 −0.45 之間（玩家站得到的地方本來就在這裡面）
function ipInCave(c, pts, head, tail, sd) {
  let i0 = null; const E = pts[pts.length - 1]; return ipCR(pts, head, tail).map(p => {
    const q = caveQ(c, p.x, p.z, i0); i0 = q.i; const inside = q.s > 0 && (c.dead || q.s < c.L), s = Math.min(q.s, c.L);
    if (inside) { const lim = Math.max(0, q.w - .45); if (Math.abs(q.l) > lim) { const d = (Math.abs(q.l) - lim) * Math.sign(q.l); p.x -= q.nx * d; p.z -= q.nz * d; } p.y = clamp(p.y, q.y + .65, q.y + q.h - .45); if (p.distanceTo(E) > 1.5 && s < c.L - .5) ipInside(c, s, p); } // 眼睛旁邊不動（玩家站得到的地方就是對的）
    return { p, c: inside ? c : null, s, sd };
  });
}
// 把幾段接起來（去掉重複的接點；換位置、迴轉的那一筆保留）
function ipJoin(...legs) { const out = []; for (const L of legs) L.forEach((q, k) => { if (k === 0 && out.length && !q.cut && !q.piv && out[out.length - 1].p.distanceTo(q.p) < .3) return; out.push(q); }); return out; }
// 標題的環繞鏡頭（上一格畫出來的樣子）
function ipTitle() { const cam = W.cam, q = cam.quaternion.clone(), fwd = ipv(0, 0, -1).applyQuaternion(q).setY(0); if (fwd.lengthSq() < 1e-6) fwd.set(0, 0, -1); return { p: cam.position.clone(), q, fwd: fwd.normalize(), fov: cam.fov }; }
function ipRoof() { if (ipRoof.y == null) { try { ipRoof.y = W.cottage ? new THREE.Box3().setFromObject(W.cottage).max.y : 10; } catch (e) { ipRoof.y = 10; } if (!isFinite(ipRoof.y)) ipRoof.y = 10; } return ipRoof.y; }
// 從標題起飛：先沿著原本的視線往工坊滑出去（不原地掉頭）；目標在身後（差超過 110°）就繞工坊飛一段弧，高度在屋頂上 6 公尺以上
function ipTakeoff(st, to) {
  const p1 = st.p.clone().addScaledVector(st.fwd, 7).add(ipv(0, 1.2, 0)), pts = [st.p.clone(), p1], dir = to.clone().sub(st.p).setY(0).normalize();
  if (Math.acos(clamp(dir.dot(st.fwd), -1, 1)) > 1.92) {
    const a0 = Math.atan2(p1.x, p1.z), a1 = Math.atan2(to.x, to.z); let da = a1 - a0; while (da > Math.PI) da -= 2 * Math.PI; while (da < -Math.PI) da += 2 * Math.PI;
    const m = Math.max(2, Math.ceil(Math.abs(da) / .8)), y = Math.max(p1.y, ipRoof() + 6); for (let k = 1; k < m; k++) { const a = a0 + da * k / m; pts.push(ipv(Math.sin(a) * 26, y, Math.cos(a) * 26)); }
  }
  return pts;
}
// 穿雲的爬升：從 p 沿水平方向 h 以約 30° 爬升，最後一點就是雲裡換位置的地方
const ipClimb = (p, h, dy = 20) => [p.clone().addScaledVector(h, 10).add(ipv(0, dy * .2, 0)), p.clone().addScaledVector(h, 21).add(ipv(0, dy * .58, 0)), p.clone().addScaledVector(h, 31).add(ipv(0, dy, 0))];
// 玩家的眼睛：E＝位置、Qp＝方向、d＝視線、f＝水平前方
function ipEye() {
  const yaw = P.yaw, pt = P.pitch, E = ipv(P.x, P.camY + P.eye, P.z), Qp = new THREE.Quaternion().setFromEuler(IPE.set(pt, yaw, 0, 'YXZ'));
  return { E, Qp, d: ipv(-Math.sin(yaw) * Math.cos(pt), Math.sin(pt), -Math.cos(yaw) * Math.cos(pt)), f: ipv(-Math.sin(yaw), 0, -Math.cos(yaw)), yaw, pitch: pt };
}
// 落地：L2＝玩家背後 11 公尺、高 3 公尺 → L1＝沿視線往回 3.5 公尺 → 眼睛；迎面而來（轉角 > 120°）就先繞到背後。
// rot：背後被擋住時把「背後」轉個角度；top：從正上方 6 公尺降下來
function ipLandPts(from, eye, rot = 0, top = false) {
  const { E, d, f } = eye, to = E.clone().sub(from).setY(0), th = to.lengthSq() > 1e-6 ? Math.acos(clamp(to.normalize().dot(f), -1, 1)) : 0, pts = [];
  if (top) { pts.push(E.clone().addScaledVector(f, -2.5).add(ipv(0, 6, 0)), E.clone().addScaledVector(f, -.9).add(ipv(0, 1.8, 0)), E.clone()); return { pts, th, tan: E.clone().sub(pts[1]).normalize() }; }
  const fb = f.clone().applyAxisAngle(IPUP, rot);
  if (th > 2.094) { const nr = ipv(-f.z, 0, f.x), sd = Math.sign(nr.dot(from.clone().sub(E))) || 1; pts.push(E.clone().addScaledVector(fb, -17).addScaledVector(nr, 10 * sd).add(ipv(0, 6, 0))); }
  pts.push(E.clone().addScaledVector(fb, -11).add(ipv(0, 3, 0)), E.clone().addScaledVector(d, -3.5), E.clone()); return { pts, th, tan: d.clone() };
}
// 從外面對準洞口飛進去：冷開場從洞口外上空俯衝；從標題直接飛過去；穿雲後從 sky 那點俯衝。最後 16 公尺和洞軸共線
function ipGuideIn(c, e, from) {
  const M = ipMouth(c, e), m = M.m, o = M.o, mn = c.dead, Q3 = m.clone().addScaledVector(o, 4).add(ipv(0, mn ? 0 : .2, 0)), Q2 = m.clone().addScaledVector(o, 16).add(ipv(0, mn ? 2.5 : 3.5, 0));
  let pts, head = null, fa = 26;
  if (from.sky) { pts = [from.sky, Q2, Q3, m]; head = from.sky.clone().addScaledVector(from.dir, -4); fa = 6; }
  else if (from.title) { const Q1 = m.clone().addScaledVector(o, 30).add(ipv(0, mn ? 7 : 8, 0)); pts = [...ipTakeoff(from.title, Q1), Q1, Q2, Q3, m]; head = from.title.p.clone().addScaledVector(from.title.fwd, -4); fa = 10; }
  else pts = [mn ? m.clone().addScaledVector(o, 36).add(ipv(0, 10, 0)) : m.clone().addScaledVector(o, 44).addScaledVector(M.nr, 8).add(ipv(0, 14, 0)), Q2, Q3, m];
  const out = ipAir(ipCR(pts, head, M.tail), fa, 26); out[out.length - 1].mouth = 1; return out;
}
// 從洞口出來：洞口 → 外 6 公尺 → 外 15 公尺 → 落地
function ipExit(c, e, eye, rot = 0, top = false) {
  const M = ipMouth(c, e), m = M.m, o = M.o, X2 = m.clone().addScaledVector(o, 15).add(ipv(0, 2.5, 0)), L = ipLandPts(X2, eye, rot, top);
  const air = ipAir(ipCR([m, m.clone().addScaledVector(o, 6).add(ipv(0, .3, 0)), X2, ...L.pts], M.tail, eye.E.clone().addScaledVector(L.tan, 4)), 20, 10);
  return { air, th: L.th, tan: L.tan, X2 };
}

/* ---------- 落地前的障礙物（屋簷、樹、大城市的房子、朋友的頭像） ---------- */
// 第 0 層、不透明、沒被遊戲藏起來的網格；道具區塊、地標、大城市這些「依鏡頭距離」藏起來的，不管現在藏不藏都算；地形另外用 H 算
function ipObs(cx, cz, r) {
  const out = [], keep = new Set([...W.chunks, W.city, ...(typeof LMS !== 'undefined' ? LMS.flatMap(L => L.near) : [])]), V = IPV[0], lay = INTRO.ray.layers, walk = o => {
    if (o === W.sky || o === W.cam || (o.userData && o.userData.terrain)) return; if (!o.visible && !keep.has(o)) return;
    if ((o.isMesh || o.isInstancedMesh) && o.layers.test(lay)) { const m = o.material; if (m && !Array.isArray(m) && m.visible !== false && !(m.transparent && m.opacity < .6) && !m.isShaderMaterial) {
      const g = o.geometry; if (o.isInstancedMesh) { if (!o.boundingSphere) o.computeBoundingSphere(); } else if (g && !g.boundingSphere) g.computeBoundingSphere();
      const bs = o.isInstancedMesh ? o.boundingSphere : g && g.boundingSphere; if (bs) { V.copy(bs.center).applyMatrix4(o.matrixWorld); const sc = o.matrixWorld.getMaxScaleOnAxis(); if (Math.hypot(V.x - cx, V.z - cz) < r + bs.radius * sc) out.push(o); } } }
    for (const ch of o.children) walk(ch);
  };
  W.scene.updateMatrixWorld(); walk(W.scene); AV.forEach(a => { if (a.hb) out.push(a.hb); }); return out;
}
// 一串點之間有幾段被東西擋著（每 2.5 公尺打一條射線）；all＝全部數完，否則碰到第一段就停
function ipBlocked(pts, i0, objs, all) {
  if (!objs.length) return 0; const ray = INTRO.ray, V = IPV[1]; let n = 0;
  for (let i = Math.max(0, i0); i < pts.length - 1; i += 5) { const a = pts[i], b = pts[Math.min(pts.length - 1, i + 5)], l = V.copy(b).sub(a).length(); if (l < 1e-3) continue; ray.set(a, V.divideScalar(l)); ray.near = 0; ray.far = l + .25; if (ray.intersectObjects(objs, false).length) { n++; if (!all) return n; } }
  return n;
}
// 大城市的障礙物高度圖：合併過的大網格一條射線就要好幾毫秒，所以第一次用到時把三角形攤成每 0.5 公尺一格的「最高點」h（1 公尺一格時店面的牆會吃掉門口那一整排，貼著騎樓飛不進來）（屋簷、騎樓也算實心，寧可繞開）
// 和「最低點」lo（貼地的路面、路緣不算）：雨遮、騎樓底下是空的（lo 以下），眼睛就在雨遮下時要靠它分出「從底下鑽進來」和「穿過雨遮」
function ipCityHF() {
  if (ipCityHF.m) return ipCityHF.m; const r = .5, x0 = CITY.x - 96, z0 = CITY.z - 72, nx = 384, nz = 300, h = new Float32Array(nx * nz), lo = new Float32Array(nx * nz).fill(1e9), A = IPV[0], B = IPV[1], C = IPV[2], M = new THREE.Matrix4(), lay = INTRO.ray.layers;
  const tri = () => { const ax = Math.max(0, Math.floor((Math.min(A.x, B.x, C.x) - x0) / r)), bx = Math.min(nx - 1, Math.floor((Math.max(A.x, B.x, C.x) - x0) / r)), az = Math.max(0, Math.floor((Math.min(A.z, B.z, C.z) - z0) / r)), bz = Math.min(nz - 1, Math.floor((Math.max(A.z, B.z, C.z) - z0) / r)), y = Math.max(A.y, B.y, C.y), yl = y > .4 ? Math.min(A.y, B.y, C.y) : 1e9; for (let j = az; j <= bz; j++) for (let i = ax; i <= bx; i++) { const k = j * nx + i; if (h[k] < y) h[k] = y; if (lo[k] > yl) lo[k] = yl; } };
  W.city.updateMatrixWorld(true);
  W.city.traverse(o => {
    if (!(o.isMesh || o.isInstancedMesh) || !o.layers.test(lay)) return; const m = o.material; if (!m || Array.isArray(m) || m.visible === false || (m.transparent && m.opacity < .6) || m.isShaderMaterial) return;
    const g = o.geometry, pa = g && g.attributes.position; if (!pa) return; const ix = g.index, nt = ix ? ix.count / 3 : pa.count / 3, cnt = o.isInstancedMesh ? o.count : 1;
    for (let k = 0; k < cnt; k++) { if (o.isInstancedMesh) { o.getMatrixAt(k, M); M.premultiply(o.matrixWorld); } else M.copy(o.matrixWorld);
      for (let t = 0; t < nt; t++) { const a = ix ? ix.getX(t * 3) : t * 3, b = ix ? ix.getX(t * 3 + 1) : t * 3 + 1, c = ix ? ix.getX(t * 3 + 2) : t * 3 + 2; A.fromBufferAttribute(pa, a).applyMatrix4(M); B.fromBufferAttribute(pa, b).applyMatrix4(M); C.fromBufferAttribute(pa, c).applyMatrix4(M); tri(); } }
  });
  return (ipCityHF.m = { r, x0, z0, nx, nz, h, lo });
}
// 大城市的一段路有幾筆會撞到東西：離眼睛 near 公尺外，整欄最高點以下都算實心；near 以內只算真的落在東西上下範圍（lo－0.3～h＋0.7）裡的點——
// 玩家可能站在雨遮底下（那一格的最高點在頭頂上），以前這一圈整個不算，最後幾公尺從頭頂直直降下來穿過雨遮也挑得中。
// 眼睛自己那一格如果眼睛就在範圍裡（貼著牆、柱子，半公尺一格分不出來），那一格不算
// npc：居民落地時可能站的位置（ipCityNpc）；離眼睛 8 公尺內、頭頂（2.25 公尺）以下、離他們不到 0.75 公尺的點也算撞到
function ipCityHits(L, E, near = 2.5, npc) {
  const m = ipCityHF(), cell = p => { const i = Math.floor((p.x - m.x0) / m.r), j = Math.floor((p.z - m.z0) / m.r); return i >= 0 && j >= 0 && i < m.nx && j < m.nz ? j * m.nx + i : -1; }, ke = cell(E), eIn = ke >= 0 && E.y > m.lo[ke] - .3 && E.y < m.h[ke] + .7; let n = 0;
  for (const q of L) { const p = q.p; if (p.x < 1500) continue; const k = cell(p); if (k < 0) continue; const r = Math.hypot(p.x - E.x, p.z - E.z); if (r >= near) { if (p.y < m.h[k] + .7) n++; } else if (!(eIn && k === ke) && p.y > m.lo[k] - .3 && p.y < m.h[k] + .7) n++;
    if (npc && r < 8 && p.y < 2.25 && npc.some(a => Math.hypot(p.x - a[0], p.z - a[1]) < .75)) n++; }
  return n;
}
// 從側面沿騎樓飛進來的路線（sideLeg）專用：離眼睛 near～25 公尺這段，貼著東西（旁邊一格、0.5 公尺內）在它上下範圍裡飛過也記一筆「擦過」。
// 不算撞到，只用來在幾條側面路線之間挑離牆遠的：隔壁店的立面、凸出的招牌從畫面一側整片蓋過來一瞬間，看起來就像差點撞上
function ipCityGraze(L, E, near) {
  const m = ipCityHF(); let n = 0;
  for (const q of L) {
    const p = q.p; if (p.x < 1500) continue; const r = Math.hypot(p.x - E.x, p.z - E.z); if (r < near || r > 25) continue;
    const i0 = Math.floor((p.x - m.x0) / m.r), j0 = Math.floor((p.z - m.z0) / m.r); let g = false;
    for (let dj = -1; dj <= 1 && !g; dj++) for (let di = -1; di <= 1; di++) { const i = i0 + di, j = j0 + dj; if (i < 0 || j < 0 || i >= m.nx || j >= m.nz) continue; const k = j * m.nx + i; if (p.y < m.h[k] + .3 && p.y > m.lo[k] - .3) { g = true; break; } }
    if (g) n++;
  }
  return n;
}
// 大城市的居民不做碰撞、照固定路線走（buildNPCs）：從現在的位置往前推，走到玩家面前 2.4 公尺會停下來等，所以人行道上的落點前後常常站著一個人。
// 回傳 [t0, t1] 秒之間他們可能站的位置（世界座標，只留眼睛 9 公尺內的）；定點的居民就是原地
function ipCityNpc(E, t0, t1) {
  const out = []; if (!W.npcs) return out; const ex = E.x - CITY.x, ez = E.z - CITY.z, dt = .25;
  for (const n of W.npcs) {
    if (!n.route) { out.push([n.x, n.z]); continue; }
    const R = n.route, seg = R.map((a, i) => { const b = R[(i + 1) % R.length]; return [a, b, Math.hypot(b[0] - a[0], b[1] - a[1])]; }), L0 = seg.reduce((a, g) => a + g[2], 0);
    const at = s => { s = ((s % L0) + L0) % L0; for (const [a, b, d] of seg) { if (s <= d) return [a[0] + (b[0] - a[0]) * s / d, a[1] + (b[1] - a[1]) * s / d, Math.atan2(b[0] - a[0], b[1] - a[1])]; s -= d; } return [R[0][0], R[0][1], 0]; };
    let s = n.s, wait = n.stop, x = n.x, z = n.z, yaw = n.yaw, halt = false;
    for (let t = 0; t <= t1; t += dt) {
      if (!halt) { if (wait > 0) wait -= dt; else { s += n.v * dt; const q = at(s); x = q[0]; z = q[1]; yaw = q[2] + (n.v < 0 ? Math.PI : 0); } const dx = ex - x, dz = ez - z; if (Math.hypot(dx, dz) < 2.4 && Math.cos(Math.atan2(dx, dz) - yaw) > .2) halt = true; }
      if (t >= t0) out.push([x, z]);
    }
  }
  return out.filter(([x, z]) => Math.hypot(x - ex, z - ez) < 9).map(([x, z]) => [x + CITY.x, z + CITY.z]);
}
// 幾個候選的落地段，挑第一個沒撞到東西的（大城市用高度圖、山谷用射線；whole＝整段都檢查，否則只看最後 20 公尺）；都撞到就取撞最少的
function ipPick(cands, eye, whole) {
  const city = eye.E.x > 1500, objs = city ? null : ipObs(eye.E.x, eye.E.z, 32); let best = null;
  for (const mk of cands) { const L = mk(), pts = L.map(q => q.p), n = city ? ipCityHits(L, eye.E, L.near || 2.5, eye.npc) : ipBlocked(pts, whole ? 0 : pts.length - 41, objs, true); if (!n) return L; if (!best || n < best.n) best = { L, n }; }
  return best.L;
}
// 落地前最後 20 公尺：被擋住就依序改從 ±25°、±50° 的背後進來，再不行就從正上方降下來
function ipSafeLand(build, eye, whole) { return ipPick([0, .44, -.44, .87, -.87].map(r => () => build(r, false)).concat([() => build(0, true)]), eye, whole); }

/* ---------- 時間表 ---------- */
// 目標速度 → 轉彎限速（4 rad/s ÷ 曲率）→ 接近停點限速（4＋0.7×距離）→ 加減速（前後兩趟）→ ±5 筆平滑 → 積分；
// 停下來的最後幾公尺用三次 ease-out（最後一格速度、加速度都是 0）；迴轉後的那段從靜止用 smootherstep 起步再停下
function ipTime(R, k) {
  const S = R.pts, n = S.length, D = new Float32Array(n), v = new Float32Array(n), V = new Float32Array(n), Kc = new Float32Array(n), T = new Float32Array(n), segs = [];
  for (let i = 1; i < n; i++) D[i] = D[i - 1] + (S[i].piv ? 1e-3 : S[i].cut ? IPS : Math.max(1e-3, S[i].p.distanceTo(S[i - 1].p)));
  const brk = [0]; for (let i = 1; i < n; i++) if (S[i].cut || S[i].piv) brk.push(i); brk.push(n);
  for (let r = 0; r + 1 < brk.length; r++) {
    const a = brk[r], b = brk[r + 1] - 1, run = i => clamp(i, a, b);
    // 水平曲率（有正負，左轉為正）：±4 公尺的方向差
    for (let i = a; i <= b; i++) { const p0 = S[run(i - 8)].p, p1 = S[i].p, p2 = S[run(i + 8)].p, ux = p1.x - p0.x, uz = p1.z - p0.z, wx = p2.x - p1.x, wz = p2.z - p1.z, l1 = Math.hypot(ux, uz), l2 = Math.hypot(wx, wz); if (l1 > .3 && l2 > .3) Kc[i] = Math.atan2(uz * wx - ux * wz, ux * wx + uz * wz) / ((l1 + l2) / 2); }
    if (S[a].piv) { // 迴轉：原地轉 180°，接著從靜止慢慢飛到眼睛
      T[a] = T[a - 1] + R.pivT; segs.push({ kind: 'pivot', i0: a - 1, i1: a, t0: T[a - 1], dur: R.pivT });
      const len = Math.max(.01, D[b] - D[a]), dur = R.goT; segs.push({ kind: 'go', i0: a, i1: b, t0: T[a], dur, D0: D[a], len, fin: 1 });
      for (let i = a + 1; i <= b; i++) { const f = (D[i] - D[a]) / len; let lo = 0, hi = 1; for (let it = 0; it < 30; it++) { const mid = (lo + hi) / 2; if (ismo(mid) < f) lo = mid; else hi = mid; } const u = (lo + hi) / 2; T[i] = T[a] + dur * u; V[i] = len * 30 * u * u * (1 - u) * (1 - u) / dur; }
      continue;
    }
    for (let i = a; i <= b; i++) {
      const q = S[i]; let t;
      if (q.c) { const j = clamp(Math.round(q.s / CAVE_STEP), 0, q.c.n - 1), w = q.c.Wd[j]; t = R.rm ? 8 : w > 3.5 ? 14 : w > 2.4 ? 23 : q.c.dead ? 20 : 28; }
      else t = R.rm ? 10 : q.hi ? 34 : 30;
      if (Kc[i]) t = Math.min(t, 4 / Math.abs(Kc[i])); t *= k; if (q.vmax) t = Math.min(t, q.vmax);
      if (R.rm) { const p0 = S[run(i - 8)].p, p2 = S[run(i + 8)].p, hz = Math.hypot(p2.x - p0.x, p2.z - p0.z), dy = Math.abs(p2.y - p0.y); if (dy > .05) t = Math.min(t, Math.max(1.2, 2 * Math.max(hz, .5) / dy)); } // 減少動態：垂直速度 ≤ 2 m/s
      v[i] = t;
    }
    const stop = R.stops.find(o => o.i === b);
    if (stop) for (let i = a; i <= b; i++) v[i] = Math.min(v[i], (4 + .7 * (D[b] - D[i])) * k); // 接近停點：4＋0.7×距離（也是「非落地段的速度」，跟著 k）
    v[a] = r === 0 ? R.v0 : (V[a - 1] || v[a]); // 起點速度：標題 1.2、冷開場 18；換位置不改速度
    for (let i = a + 1; i <= b; i++) { const ac = R.title && D[i] < 11 ? 8 : 14; v[i] = Math.min(v[i], Math.sqrt(v[i - 1] * v[i - 1] + 2 * ac * (D[i] - D[i - 1]))); }
    let iS = b;
    if (stop) { while (iS > a && D[b] - D[iS] < stop.S) iS--; const Se = D[b] - D[iS]; v[iS] = Math.min(v[iS], 3 * Se / stop.min); for (let i = iS - 1; i >= a; i--) v[i] = Math.min(v[i], Math.sqrt(v[i + 1] * v[i + 1] + 2 * 12 * (D[i + 1] - D[i]))); }
    for (let i = a; i <= iS; i++) { let s = 0, m = 0; for (let j = Math.max(a, i - 5); j <= Math.min(iS, i + 5); j++) { s += v[j]; m++; } V[i] = Math.min(v[i] * 1.15 + .5, s / m); }
    V[a] = v[a]; if (stop) V[iS] = v[iS];
    T[a] = r === 0 ? 0 : T[a - 1] + (S[a].cut.hold || .15);
    for (let i = a + 1; i <= iS; i++) T[i] = T[i - 1] + (D[i] - D[i - 1]) / Math.max(.5, (V[i - 1] + V[i]) / 2);
    if (stop && iS < b) { const Se = D[b] - D[iS], dur = clamp(3 * Se / Math.max(.3, V[iS]), stop.min, stop.max); segs.push({ kind: 'stop', i0: iS, i1: b, t0: T[iS], dur, D0: D[iS], len: Se, fin: stop.fin }); for (let i = iS + 1; i <= b; i++) { const u = 1 - Math.cbrt(Math.max(0, 1 - (D[i] - D[iS]) / Se)); T[i] = T[iS] + dur * u; V[i] = 3 * Se * (1 - u) * (1 - u) / dur; } }
  }
  return { D, V, K: Kc, T, segs, Tend: T[n - 1] };
}
// 算好時間表，總長超過上限（桌機 15 秒、LOW 13 秒、減少動態 7.5 秒）時把速度乘上 k 再算（最多 1.3 倍；從標題起飛又要繞到背後的長路線才放寬到 1.45）；再整理遮罩、事件
function ipFinal(R) {
  const lim = R.rm ? 7.5 : LOW ? 13 : 15; let k = 1, tm = ipTime(R, 1); for (let it = 0; it < 5 && tm.Tend > lim && k < 1.45; it++) { k = Math.min(it < 3 ? 1.3 : 1.45, k * (1 + (tm.Tend / lim - 1) * 1.6)); tm = ipTime(R, k); } R.k = k;
  Object.assign(R, tm); const n = R.pts.length;
  for (let i = 0; i < n; i++) { const p = R.pts[i].p; if (!isFinite(p.x + p.y + p.z + R.T[i] + R.V[i])) throw new Error('開場路線有 NaN'); }
  // 每一段（被換位置、迴轉分開）的最後一筆：看前方的點超過時沿那裡的方向延伸
  R.LE = new Int32Array(n); let e = n - 1; for (let i = n - 1; i >= 0; i--) { R.LE[i] = e; if ((R.pts[i].cut || R.pts[i].piv) && i > 0) e = i - 1; }
  R.tanAt = i => { if (i === n - 1) return R.endTan.clone().normalize(); const a = R.pts[Math.max(0, i - 2)].p, b = R.pts[i].p, t = b.clone().sub(a); return t.lengthSq() > 1e-8 ? t.normalize() : ipv(0, 0, -1); };
  const pre = R.segs.find(g => g.kind === 'stop' && !g.fin), fin = R.segs.find(g => g.kind === 'stop' && g.fin); R.tLand = pre ? pre.t0 : fin ? fin.t0 : R.Tend; // 落地段（迴轉的路線從減速停下開始算）
  R.masks = []; R.cuts = [];
  for (let i = 1; i < n; i++) { const q = R.pts[i]; if (!q.cut) continue; const c = q.cut, t0 = R.T[i - 1], t1 = R.T[i], ra = c.riseFrom != null ? R.T[c.riseFrom] : t0 - (c.rise || .55);
    R.masks.push({ a: Math.min(ra, t0 - .05), b: t0, c: t1, d: t1 + (c.fall || .6), op: 1, col: c.col }); R.cuts.push({ tm: (t0 + t1) / 2, i, done: 0, reset: !!c.reset, col: c.col }); }
  R.mk.forEach(m => { const t = m.i != null ? R.T[m.i] : m.t; R.masks.push({ a: t + m.a, b: t + m.b, c: t + m.c, d: t + m.d, op: m.op, col: m.col }); });
  R.evs = []; R.pts.forEach((q, i) => { if (q.ev) R.evs.push({ t: R.T[i], k: q.ev }); }); R.evs.sort((a, b) => a.t - b.t);
  R.cost = R.Tend; return R;
}

/* ---------- 規劃：人在哪、走哪條路 ---------- */
// 人在不在某個洞裡（和 caveEnv 的掃描同一個條件）：回傳 { c, q }（q 是複本）或 null
function caveAt(x, z, tol = .9) { for (const c of CAVES) { const q = caveQ(c, x, z, null); if (q.s > .3 && q.s < c.L - .3 && Math.abs(q.l) < q.w * tol) return { c, q: Object.assign({}, q) }; } return null; }
// 判斷玩家在哪一類地方，並把玩家的山洞狀態（CV）、高度設好（人在洞裡時 P.y 用洞的地面，不是山體）
function introResolve() {
  let kind, moved = false;
  if (inCity(P.x)) { const x = clamp(P.x, CITY.x - 70, CITY.x + 70), z = clamp(P.z, CITY.z - 30, CITY.z + 44); moved = x !== P.x || z !== P.z; P.x = x; P.z = z; CV.c = null; kind = 'city'; } // 舊存檔可能在可走範圍外
  else {
    let hit = caveAt(P.x, P.z);
    if (!hit && CV.c) { const q = caveQ(CV.c, P.x, P.z, CV.i); if (q.s > -1.6 && q.s < CV.c.L + 1.6 && Math.abs(q.l) < q.w + 1) hit = { c: CV.c, q: Object.assign({}, q) }; } // 正站在洞口上：維持原本的狀態
    if (!hit && caveRegion(P.x, P.z) === 'south') { hit = caveAt(P.x, P.z, 1.05); if (!hit || !hit.c.dead) { hit = null; P.x = 0; P.z = 16; P.yaw = 0; P.pitch = -.08; moved = true; } } // 南方山上（舊存檔）：回出生點
    if (hit) { const { c, q } = hit; if (CV.c !== c) caveEnter(c, q.s < c.L / 2 ? 1 : -1); CV.i = q.i; CV.s = q.s; CV.l = q.l; kind = c.dead ? 'moon' : 'tube'; }
    else { CV.c = null; kind = caveRegion(P.x, P.z); if (kind === 'south') kind = 'plain'; }
  }
  P.y = G(P.x, P.z, P.y); P.camY = P.y; P.vy = P.vx = P.vz = 0; P.dip = P.dipV = 0; P.roll = 0; P.eye = IN.sneak ? 1.18 : 1.62; if (moved) save(); // 帶著 initPlayer 算好的腳的高度：存在橋上的還是站在橋面
  return kind;
}
function introPlan() {
  const I = INTRO, kind = introResolve(), rm = !!RM(), st = performance.now() - I.titleAt < 250 ? ipTitle() : null, eye = ipEye(), F = I.force || {}, rnd = I.seed != null ? seeded(I.seed) : Math.random;
  const open = CAVES.filter(c => !c.dead), byId = k => typeof k === 'number' ? CAVES[k] : CAVES.find(c => c.id === k), C = [], hold = LOW ? .2 : .15, from = st ? { title: st } : { cold: 1 };
  I.ray = I.ray || new THREE.Raycaster(); I.ray.camera = W.cam; if (kind === 'city') eye.npc = rm ? ipCityNpc(eye.E, 3, 8) : ipCityNpc(eye.E, 8, 15); // 落地前幾秒居民可能站的地方（城市開場約 11～14 秒）
  const route = o => Object.assign({ pts: [], stops: [], mk: [], endTan: eye.d.clone(), th: 0, via: null, v0: st ? 1.2 : rm ? 8 : 18, title: !!st, rm, pivT: 2.3, goT: 2.6, kind }, o);
  const push = (R, pen = 0) => { if (!R) return; try { ipFinal(R); } catch (e) { console.warn(e); return; } R.cost += pen + (R.Tend > (rm ? 7.5 : LOW ? 13 : 15) + .5 ? 10 : 0); C.push(R); }; // 超過總長上限的路線盡量不選
  const land = (pts, S = 8) => ({ i: pts.length - 1, S, fin: 1, min: rm ? 2.6 : 1.6, max: 5 });
  // 開機直接開始：黑幕 0.6 秒淡掉；白天的月光洞窟：進裂縫前疊一層淡淡的白光（縫裡透出的光）
  const finish = R => { if (!st) R.mk.push({ t: 0, a: 0, b: 0, c: 0, d: .6, op: 1, col: '#000' }); if (R.via && R.via.dead && DN.night < .5) { const i = R.pts.findIndex(q => q.mouth); if (i > 0) R.mk.push({ i, a: -.4, b: -.2, c: .1, d: .45, op: .15, col: '#ffffff' }); } return R; };
  // 從標題到區域那側的洞口：起飛 → 爬升進雲裡（遮罩全滿）→ 換到那個洞口外上空 → 俯衝進洞
  const cloudIn = c => {
    const M = ipMouth(c, 1), h = M.o.clone().negate(), p1 = st.p.clone().addScaledVector(st.fwd, 8).add(ipv(0, 1.5, 0)), climb = ipAir(ipCR([st.p.clone(), p1, ...ipClimb(p1, h)], st.p.clone().addScaledVector(st.fwd, -4), null), 10, .5);
    const dir = ipBack(climb), A2 = M.m.clone().addScaledVector(M.o, 16).add(ipv(0, 3.5, 0)), S0 = A2.clone().addScaledVector(h, -16).add(ipv(0, 7, 0)), g = ipGuideIn(c, 1, { sky: S0, dir });
    g[0].cut = { hold, rise: .55, fall: .6, col: 'cloud' }; g[0].ev = 'cloud'; return { legs: [climb, g], turn0: Math.acos(clamp(h.dot(st.fwd), -1, 1)) };
  };
  // 出洞落地（挑沒被擋住的那一種）：選中的那段身上帶著它的轉角與終點切線（X）
  const exitL = (c, e, whole) => ipSafeLand((rot, top) => { const x = ipExit(c, e, eye, rot, top); x.air.X = x; return x.air; }, eye, whole);
  // 平地：從區域那側的洞口往裡飛（s：L→0），從平地那側出來、落在眼睛
  const plainRoute = c => {
    const ci = st ? cloudIn(c) : { legs: [ipGuideIn(c, 1, from)], turn0: 0 }, tube = ipTube(c, c.L, 0); tube[tube.length - 1].ev = 'flash';
    const L = exitL(c, 0), X = L.X, pts = ipJoin(...ci.legs, tube, L);
    const R = finish(route({ pts, via: c, th: X.th, endTan: X.tan, turn0: ci.turn0 })); R.stops.push(land(pts)); return R;
  };
  // 區域（洞外）：從平地那側的洞口往外飛（s：0→L）；出口離玩家太遠（> 150 公尺）就出洞後爬進雲裡、換到玩家附近上空
  const regionRoute = c => {
    const g = ipGuideIn(c, 0, from), tube = ipTube(c, 0, c.L), M = ipMouth(c, 1); tube[tube.length - 1].ev = 'flash';
    const X2 = M.m.clone().addScaledVector(M.o, 15).add(ipv(0, 2.5, 0)), L2 = eye.E.clone().addScaledVector(eye.f, -11).add(ipv(0, 3, 0)); let pts, X = null;
    if (X2.distanceTo(L2) > 150) {
      const h = L2.clone().sub(M.m).setY(0).normalize(), hm = h.clone().add(M.o).normalize(), X1 = M.m.clone().addScaledVector(M.o, 6).add(ipv(0, .3, 0)), Xb = M.m.clone().addScaledVector(M.o, 14).add(ipv(0, 1.5, 0)), C1 = Xb.clone().addScaledVector(hm, 13).add(ipv(0, 6, 0));
      const climb = ipAir(ipCR([M.m, X1, Xb, C1, C1.clone().addScaledVector(h, 14).add(ipv(0, 9, 0)), C1.clone().addScaledVector(h, 26).add(ipv(0, 18, 0))], M.tail, null), 20, .5);
      const dir = ipBack(climb), S0 = L2.clone().addScaledVector(h, -40).add(ipv(0, 30, 0));
      const leg2 = ipSafeLand((rot, top) => { const L = ipLandPts(S0, eye, rot, top), A = ipAir(ipCR([S0, ...L.pts], S0.clone().addScaledVector(dir, -4), eye.E.clone().addScaledVector(L.tan, 4)), 6, 10); A.X = L; return A; }, eye); X = leg2.X;
      leg2[0].cut = { hold, rise: .55, fall: .6, col: 'cloud' }; leg2[0].ev = 'cloud'; pts = ipJoin(g, tube, climb, leg2);
    } else { const L = exitL(c, 1); X = L.X; pts = ipJoin(g, tube, L); }
    const R = finish(route({ pts, via: c, th: X.th, endTan: X.tan })); R.stops.push(land(pts)); return R;
  };
  // 洞裡落地：沿洞飛到玩家前 9 公尺，最後從中心線滑到眼睛（洞裡用 6 公尺停下）；dir＝飛行方向（s 增加為 +1）
  const caveLand = (c, sp, dir, sFrom, inDir) => {
    const s9 = clamp(sp - dir * 9, 0, c.L), i = clamp(Math.round(sp / CAVE_STEP), 0, c.n - 1), ax = ipv(c.TX[i] * dir, 0, c.TZ[i] * dir).normalize(), E = eye.E;
    const tube = (dir > 0 ? s9 > sFrom + 1 : s9 < sFrom - 1) ? ipTube(c, sFrom, s9) : [], start = tube.length ? tube[tube.length - 1].p.clone() : itp(c, sFrom), s4 = sp - dir * 4, mid = [], last = E.clone().addScaledVector(ax, -1.5);
    if (s4 > .5 && s4 < c.L - .5 && (s4 - (tube.length ? s9 : sFrom)) * dir > .8) { const p = itp(c, s4); p.y -= .4; mid.push(p); }
    const pts = [start, ...mid]; if (last.distanceTo(start) > 1.2) pts.push(last); pts.push(E.clone());
    const din = tube.length > 3 ? ipBack(tube) : inDir || ax, tail = ipInCave(c, pts, start.clone().addScaledVector(din, -4), E.clone().addScaledVector(ax, 4), dir);
    return { legs: [tube, tail], ax };
  };
  // 洞裡：從背後那端進來（正常），或從前面那端進來、飛過頭 8 公尺、停下、原地轉 180°、再往前 8 公尺落地
  const tubeRoutes = (c, sp, face) => {
    const out = [];
    if (!(c.dead && face < 0)) { // 死路看向洞口時，背後是洞底，沒有洞口可以進
      const dir = face, e = dir > 0 ? 0 : 1, sE = dir > 0 ? 0 : c.L, ci = st && e === 1 ? cloudIn(c) : { legs: [ipGuideIn(c, e, from)] }, M = ipMouth(c, e);
      const L = caveLand(c, sp, dir, sE, M.o.clone().negate()), pts = ipJoin(...ci.legs, ...L.legs), R = finish(route({ pts, via: c, endTan: L.ax })); R.stops.push(land(pts, 6)); out.push([R, 0]);
    }
    if (!c.dead || face < 0) {
      const dir = c.dead ? 1 : -face, e = dir > 0 ? 0 : 1, sE = dir > 0 ? 0 : c.L, sPast = clamp(sp + dir * 8, 1, c.L - (c.dead ? 2 : 1));
      if (Math.abs(sPast - sp) > 3 && !(st && e === 1)) {
        const A = ipJoin(ipGuideIn(c, e, from), ipTube(c, sE, sPast)), Pp = A[A.length - 1].p.clone(), i = clamp(Math.round(sp / CAVE_STEP), 0, c.n - 1), ax = ipv(-c.TX[i] * dir, 0, -c.TZ[i] * dir).normalize(), p4 = itp(c, sp + dir * 4); p4.y -= .4;
        const B = ipInCave(c, [Pp, ...(Math.abs(sPast - sp) > 6 ? [p4] : []), eye.E.clone().addScaledVector(ax, -1.5), eye.E.clone()], Pp.clone().addScaledVector(ax, -4), eye.E.clone().addScaledVector(ax, 4), -dir);
        B[0].piv = 1; const pts = ipJoin(A, B), R = finish(route({ pts, via: c, endTan: ax })); R.stops.push({ i: A.length - 1, S: 6, min: 1.2, max: 5 });
        R.pivSgn = Math.sign(ipv(c.TX[i] * dir, 0, c.TZ[i] * dir).cross(eye.f).y) || 1; out.push([R, 1]);
      }
    }
    return out;
  };
  // 月光洞窟的大廳、看向洞口：繞著地下湖飛半圈（飛過湖面的月亮倒影）到玩家背後再落地
  const lakeRoute = c => {
    const lk = c.lake, hs = c.S[c.hallI], y0 = c.Y[c.hallI] + 3, E = eye.E, s0 = Math.max(c.sIn + 2, hs - lk.r - 5), tb = ipTube(c, 0, s0), A = ipJoin(ipGuideIn(c, 0, from), tb), P0 = A[A.length - 1].p;
    const ang = (x, z) => Math.atan2(x - lk.x, z - lk.z), wrap = a => { while (a > Math.PI) a -= 2 * Math.PI; while (a < -Math.PI) a += 2 * Math.PI; return a; };
    const a0 = ang(P0.x, P0.z), B = E.clone().addScaledVector(eye.f, -5.5).add(ipv(0, 1.2, 0)); let da = wrap(ang(B.x, B.z) - a0); const dp = wrap(ang(E.x, E.z) - a0);
    if (Math.sign(dp) === Math.sign(da) && Math.abs(dp) < Math.abs(da)) da -= Math.sign(da) * 2 * Math.PI; // 走不經過玩家的那一邊
    const m = Math.max(2, Math.ceil(Math.abs(da) / .75)), pts = [P0.clone()];
    for (let k = 1; k < m; k++) { const a = a0 + da * k / m, p = ipv(lk.x + Math.sin(a) * 6.2, y0, lk.z + Math.cos(a) * 6.2), q = caveQ(c, p.x, p.z, null); if (q.s > c.L - 1.5) continue; if (Math.abs(q.l) > q.w - 1) { const sc = (q.w - 1) / Math.abs(q.l); p.x = q.cx + q.nx * q.l * sc; p.z = q.cz + q.nz * q.l * sc; } pts.push(p); }
    const qb = caveQ(c, B.x, B.z, null); if (qb.s < c.L - 1 && Math.abs(qb.l) < qb.w - .8) pts.push(B); pts.push(E.clone().addScaledVector(eye.d, -2.5), E.clone());
    const L = ipInCave(c, pts, P0.clone().addScaledVector(ipBack(tb) || ipv(1, 0, 0), -4), E.clone().addScaledVector(eye.d, 4), 1), all = ipJoin(A, L), R = finish(route({ pts: all, via: c })); R.stops.push(land(all, 6)); return R;
  };
  // 大城市：從平地飛進一條洞往外，在區域那側出口的白光裡換到大城市主街上空，沿街降到玩家背後
  const cityRoute = c => {
    const g = ipGuideIn(c, 0, from), tube = ipTube(c, 0, c.L), M = ipMouth(c, 1), sg = M.o.x >= 0 ? 1 : -1, sd = ipv(sg, 0, 0); tube[tube.length - 1].ev = 'flash';
    // 主街上空 22 公尺 → 被擋住就抬高到 30、改從廣場上空進來、換個角度從背後進來，最後才從玩家正上方降下來（取撞到最少的）
    const leg2 = (alt, rot) => { if (alt === 4) return sideLeg(rot); const top = alt === 3, S0 = top ? ipv(eye.E.x, 34, eye.E.z).addScaledVector(eye.f, -8) : alt === 2 ? ipv(CITY.x, 26, CITY.z + 26) : ipv(clamp(eye.E.x - 50 * sg, CITY.x - 60, CITY.x + 60), alt ? 30 : 22, CITY.z + 2), L = ipLandPts(S0, eye, rot, top), ctrl = alt ? [S0, ...L.pts] : [S0, S0.clone().addScaledVector(sd, 22).add(ipv(0, -3, 0)), ...L.pts]; return { X: L, B: ipAir(ipCR(ctrl, top ? null : S0.clone().addScaledVector(sd, -4), eye.E.clone().addScaledVector(L.tan, 4)), 4, 6) }; };
    // 背後是牆、頭上是雨遮（例如醫院門口）：背後與頭頂都進不來，改沿著騎樓（街的方向）從左或右、在雨遮底下平平地飛進來，最後 2 秒轉成玩家的視線。
    // ipAir 平常會把最後 6 公尺以外墊到 9 公尺高、只能在最後幾公尺陡降，所以這一段把離地壓到 1 公尺（城市是平的，障礙物交給高度圖），雨遮附近 7 公尺內用上下範圍判斷。
    // 居民沿著人行道中線走、走到玩家面前 2.4 公尺會停下來等：低段先走「貼牆的那一道」（離人行道中線 1 公尺以上、比頭頂高一點），離眼睛 k1 公尺才往眼睛靠，不從他們的臉旁邊擦過去。
    // v＝[往東或往西, 低段往街心偏多少（負的＝貼牆，從行道樹與牆之間鑽過去）, 低段比眼睛高多少, 從多高的地方開始降時往街心偏多少（避開路燈、行道樹那一排）, k1（0＝離眼睛 3 公尺就開始靠）]
    const sideLeg = ([sx, fo, hb, fa, k1]) => { const E = eye.E, sv = ipv(sx, 0, 0), fs = ipv(0, 0, Math.sign(CITY.z + 2 - E.z) || 1), at = (k, a, y) => E.clone().addScaledVector(sv, k).addScaledVector(fs, a).add(ipv(0, y, 0));
      const pts = k1 ? [at(16, fo + fa, 5.5), at(8, fo, hb), at(k1, fo, hb * .5), at(1.3, fo * .4, hb * .12), E.clone()] : [at(16, fo + fa, 5.5), at(8, fo, hb), at(3, fo * .3, hb * .3), E.clone()];
      const A = pts[0], S0 = ipv(clamp(A.x + sx * 16, CITY.x - 64, CITY.x + 64), 22, CITY.z + 2), X = { pts, th: Math.PI / 2, tan: E.clone().sub(pts[pts.length - 2]).normalize() }, c0 = IPCLR; IPCLR = 1;
      try { return { X, B: ipAir(ipCR([S0, ...pts], S0.clone().addScaledVector(A.clone().sub(S0).normalize(), -4), E.clone().addScaledVector(X.tan, 4)), 4, 6), near: 7 }; } finally { IPCLR = c0; } };
    const SIDE = [[-1, .8, 0, 3.2], [-1, .8, 1.5, 3.2], [.6, .8, 0, 3.2], [.5, .75, 2.5, 0], [-.7, .4, 2.5, 0], [.5, .4, 2.5, 0], [.5, .4, 0, 0], [-.7, .4, 0, 0], [.6, .8, 2.5, 3.2], [.6, .8, 3.5, 3.2], [.6, .4, 3.5, 0]].flatMap(v => [[4, [1, ...v]], [4, [-1, ...v]]]);
    // 撞到一筆算 1000：先比撞到幾筆；從側面進來的路線再加上「擦過」幾筆（ipCityGraze），挑離牆最遠的那條（其他路線照舊，沒撞到就直接用）
    let best = null; for (const [alt, rot] of [[0, 0], [1, 0], [2, 0], [0, .44], [0, -.44], [1, .87], [1, -.87], [3, 0], ...SIDE]) { const o = leg2(alt, rot); o.n = ipCityHits(o.B, eye.E, o.near, eye.npc) * 1000 + (alt === 4 ? ipCityGraze(o.B, eye.E, o.near) : 0); if (!best || o.n < best.n) best = o; if (!o.n) break; }
    let B = best.B; const X = best.X;
    B[0].cut = { hold, riseFrom: Math.max(0, g.length + tube.length - 2 - Math.round(14 / IPS)), fall: .7, col: 'city:' + c.def.to };
    const pts = ipJoin(g, tube, B), R = finish(route({ pts, via: c, endTan: X.tan, city: 1 })); R.stops.push(land(pts)); return R;
  };
  // 減少動態：每一類只留最後「從洞口滑出來」那一段，空中貼著地面飛；從標題先淡到霧色、在起點淡入；
  // 離玩家遠就在洞口再淡一次、從玩家背後 20 公尺開始；洞裡背後沒地方（死路的洞底）就沿著視線往回退一點直接滑進眼睛
  const rmRoute = () => {
    const lead = legs => { if (!st) return legs; const a = { p: st.p.clone(), c: null, s: 0, sd: 1, vmax: 1.2 }, b = { p: st.p.clone().addScaledVector(st.fwd, .7), c: null, s: 0, sd: 1, vmax: 1.2 }; legs[0][0].cut = { hold, rise: .45, fall: .5, col: 'fog', reset: 1 }; return [[a, b], ...legs]; };
    // 背後 20 公尺（被擋住就近一點、換個角度）；背後是牆（大城市騎樓、醫院雨遮下）就從左右兩側、沿著牆平平地滑進來（最後一段不從視線後方進，雨遮附近 7 公尺內用上下範圍判斷）
    const behind = () => {
      const L = ipPick([0, .44, -.44, .87, -.87, 1.57, -1.57].flatMap(rot => [20, 12].map(bk => () => { const fb = eye.f.clone().applyAxisAngle(IPUP, rot), side = Math.abs(rot) > 1, P0 = eye.E.clone().addScaledVector(fb, -bk).add(ipv(0, side ? .3 : 1, 0)), tn = side ? fb : eye.d;
        const A = ipAir(ipCR([P0, eye.E.clone().addScaledVector(fb, -bk * .45).add(ipv(0, side ? .15 : .5, 0)), eye.E.clone().addScaledVector(tn, side ? -1.4 : -2.5), eye.E.clone()], P0.clone().addScaledVector(fb, -4), eye.E.clone().addScaledVector(tn, 4)), 4, 4); if (side) A.near = 7; return A; })), eye, true);
      L[0].cut = { hold, rise: .45, fall: .45, col: 'fog', reset: 1 }; return L;
    };
    if (kind === 'tube' || kind === 'moon') {
      const c = CV.c, sp = CV.s, i = clamp(Math.round(sp / CAVE_STEP), 0, c.n - 1), face = (eye.f.x * c.TX[i] + eye.f.z * c.TZ[i]) >= 0 ? 1 : -1, s0 = clamp(sp - face * (c.dead ? 10 : 14), .5, c.L - (c.dead ? 1.5 : .5));
      if ((sp - s0) * face >= 6) { const dir = face, L = caveLand(c, sp, dir, s0, ipv(c.TX[i] * dir, 0, c.TZ[i] * dir)), pts = ipJoin(...lead(L.legs.filter(l => l.length))), R = finish(route({ pts, via: c, endTan: L.ax })); R.stops.push(land(pts, 6)); return R; }
      // 背後沒地方：沿著視線往回退（找退得最遠、整段都在洞裡的距離），直直滑進眼睛
      const ok = b => { for (let k = 1; k <= 4; k++) { const p = eye.E.clone().addScaledVector(eye.d, -b * k / 4), q = caveQ(c, p.x, p.z, null); if (q.s < .5 || q.s > c.L - .5 || Math.abs(q.l) > q.w - .6 || p.y < q.y + .7 || p.y > q.y + q.h - .5) return false; } return true; };
      const b = [8, 6, 4.5, 3.2, 2.2].find(ok) || 1.6, P0 = eye.E.clone().addScaledVector(eye.d, -b), L = ipInCave(c, [P0, eye.E.clone().addScaledVector(eye.d, -b / 2), eye.E.clone()], P0.clone().addScaledVector(eye.d, -4), eye.E.clone().addScaledVector(eye.d, 4), face);
      const pts = ipJoin(...lead([L])), R = finish(route({ pts, via: c })); R.stops.push(land(pts, Math.min(6, b * .75))); return R;
    }
    if (kind === 'city') { const c = open[Math.floor(rnd() * open.length)], B = behind(), pts = ipJoin(...lead([ipTube(c, 14, 0), B])), R = finish(route({ pts, via: c, city: 1, turnT: B.near ? 3.2 : 0 })); R.stops.push(land(pts, 6)); return R; } // 從側面滑進來：減少動態的轉速上限 45°/s，提早開始轉向視線
    const e = kind === 'plain' ? 0 : 1, c = e ? open.find(o => o.def.to === kind) : open.map(o => { const m = ipMouth(o, 0).m; return [o, m.distanceTo(eye.E) + (m.clone().sub(eye.E).setY(0).normalize().dot(eye.f) > .3 ? 80 : 0)]; }).sort((a, b) => a[1] - b[1])[0][0];
    const t = e ? ipTube(c, c.L - 14, c.L) : ipTube(c, 14, 0), M = ipMouth(c, e);
    // 玩家就在洞口附近、高度也差不多才直接飛過去（整段檢查障礙物）；不然在洞口淡出、從背後 20 公尺開始（垂直速度有上限，下坡太陡會飛很久）
    if (M.m.distanceTo(eye.E) > 32 || Math.abs(M.m.y - eye.E.y) > 4) { const pts = ipJoin(...lead([t, behind()])), R = finish(route({ pts, via: c })); R.stops.push(land(pts, 6)); return R; }
    const L = exitL(c, e, true), pts = ipJoin(...lead([t, L])), R = finish(route({ pts, via: c, endTan: L.X.tan })); R.stops.push(land(pts, 6)); return R;
  };
  if (rm) { IPCLR = 2; try { push(rmRoute()); } finally { IPCLR = null; } }
  else if (kind === 'plain') for (const c of (F.cave != null ? [byId(F.cave)] : open)) { const R = plainRoute(c); push(R, (R.th > 2.094 ? 3 : 0) + (ipLocked(c) ? 1.5 : 0) + (st ? 1.5 * R.turn0 / Math.PI : 0) + rnd() * 1.2); }
  else if (kind === 'coast' || kind === 'volcano' || kind === 'snow') push(regionRoute(open.find(o => o.def.to === kind)));
  else if (kind === 'tube' || kind === 'moon') {
    const c = CV.c, sp = CV.s, i = clamp(Math.round(sp / CAVE_STEP), 0, c.n - 1), face = (eye.f.x * c.TX[i] + eye.f.z * c.TZ[i]) >= 0 ? 1 : -1;
    if (c.dead && face < 0 && sp >= 40 && c.lake && F.entry == null) push(lakeRoute(c));
    else tubeRoutes(c, sp, face).forEach(([R, piv]) => { if (F.entry != null && F.entry !== piv) return; push(R, piv ? 1 : 0); });
  }
  else if (kind === 'city') { const c = F.cave != null ? byId(F.cave) : st ? open.map(o => [o, ipMouth(o, 0).m.clone().sub(st.p).setY(0).normalize().dot(st.fwd)]).sort((a, b) => b[1] - a[1])[0][0] : open[Math.floor(rnd() * open.length)]; push(cityRoute(c)); }
  if (!C.length) return null;
  const R = C.reduce((a, b) => b.cost < a.cost ? b : a); R.eye = eye; R.st = st; return R;
}

/* ---------- 播放 ---------- */
// 照時間查表：位置寫進 out；回傳 { i（取樣）, d（沿路線距離）, v（速度）, seg（正在哪一段解析式的區段） }
const IPCUR = { i: 0, d: 0, v: 0, seg: null };
function ipAt(R, t, out) {
  const S = R.pts, T = R.T, D = R.D, n = S.length; let d = null, v = 0, seg = null;
  for (const g of R.segs) if (t >= g.t0 && t <= g.t0 + g.dur) { const u = (t - g.t0) / g.dur; seg = g; if (g.kind === 'pivot') { d = D[g.i0]; v = 0; } else if (g.kind === 'stop') { d = g.D0 + g.len * (1 - (1 - u) ** 3); v = 3 * g.len * (1 - u) ** 2 / g.dur; } else { d = g.D0 + g.len * ismo(u); v = g.len * 30 * u * u * (1 - u) * (1 - u) / g.dur; } break; }
  if (d != null) { let lo = 0, hi = n - 1; while (hi - lo > 1) { const m = (lo + hi) >> 1; if (D[m] <= d) lo = m; else hi = m; } const f = clamp((d - D[lo]) / Math.max(1e-6, D[hi] - D[lo]), 0, 1); out.copy(S[lo].p).lerp(S[hi].p, S[hi].cut ? 0 : f); IPCUR.i = f > .5 && !S[hi].cut && !S[hi].piv ? hi : lo; IPCUR.d = d; IPCUR.v = v; IPCUR.seg = seg; return IPCUR; }
  if (t >= T[n - 1]) { out.copy(S[n - 1].p); IPCUR.i = n - 1; IPCUR.d = D[n - 1]; IPCUR.v = 0; IPCUR.seg = null; return IPCUR; }
  let lo = 0, hi = n - 1; while (hi - lo > 1) { const m = (lo + hi) >> 1; if (T[m] <= t) lo = m; else hi = m; }
  // 兩筆之間速度線性變化（等加速度）：走過的距離用 v0·τ＋a·τ²/2，速度在每一筆之間都是連續的
  const dt0 = Math.max(1e-6, T[hi] - T[lo]), tau = clamp(t - T[lo], 0, dt0), v0 = R.V[lo], v1 = R.V[hi], vs = v0 + v1, g = tau / dt0, f = vs > 1e-3 && !S[hi].cut ? clamp((v0 * tau + (v1 - v0) * tau * g / 2) / (vs * dt0 / 2), 0, 1) : g; v = v0 + (v1 - v0) * g;
  if (S[hi].cut) { // 換位置：遮罩全滿的那段時間裡，前半沿著前一段的方向、後半沿著下一段的方向（看不到，但速度不斷）
    const tm = (T[lo] + T[hi]) / 2; if (t < tm) out.copy(S[lo].p).addScaledVector(R.tanAt(lo), R.V[lo] * (t - T[lo])); else { const b = S[Math.min(n - 1, hi + 2)].p.clone().sub(S[hi].p); out.copy(S[hi].p).addScaledVector(b.lengthSq() > 1e-8 ? b.normalize() : b, -R.V[hi] * (T[hi] - t)); }
    IPCUR.i = t < tm ? lo : hi; IPCUR.d = t < tm ? D[lo] : D[hi]; IPCUR.v = v; IPCUR.seg = null; return IPCUR;
  }
  out.copy(S[lo].p).lerp(S[hi].p, f); IPCUR.i = f > .5 ? hi : lo; IPCUR.d = D[lo] + (D[hi] - D[lo]) * f; IPCUR.v = v; IPCUR.seg = null; return IPCUR;
}
// 看前方的點：沿路線往前 la 公尺；超過這一段的盡頭就沿盡頭的方向延伸（不會看到雲另一頭、或迴轉之後的路）
function ipLook(R, i, d, la, out) {
  const S = R.pts, D = R.D, e = R.LE[i], dl = d + la;
  if (dl >= D[e]) return out.copy(S[e].p).addScaledVector(R.tanAt(e), dl - D[e]);
  let lo = i, hi = e; while (hi - lo > 1) { const m = (lo + hi) >> 1; if (D[m] <= dl) lo = m; else hi = m; }
  return out.copy(S[lo].p).lerp(S[hi].p, clamp((dl - D[lo]) / Math.max(1e-6, D[hi] - D[lo]), 0, 1));
}
// 四元數 → 旋轉向量（軸×角，取短的那一邊）
function ipRotVec(q, out) { let x = q.x, y = q.y, z = q.z, w = q.w; if (w < 0) { x = -x; y = -y; z = -z; w = -w; } const s = Math.sqrt(x * x + y * y + z * z); if (s < 1e-9) return out.set(0, 0, 0); const a = 2 * Math.atan2(s, w); return out.set(x / s * a, y / s * a, z / s * a); }
// 角速度限制：目標轉速＝目標本身的轉動（前饋）＋誤差／0.15 秒，限制在 wmax 以內；轉速的變化每秒最多 900°（不會急甩）
function ipTurn(I, qt, dt, wmax) {
  const fw = ipRotVec(IPQ[0].copy(qt).multiply(IPQ[1].copy(I.qt).invert()), IPV[2]).multiplyScalar(1 / Math.max(dt, 1e-3)), fl = fw.length(); if (fl > wmax * 1.5) fw.multiplyScalar(wmax * 1.5 / fl);
  fw.addScaledVector(ipRotVec(IPQ[0].copy(qt).multiply(IPQ[1].copy(I.q).invert()), IPV[3]), 1 / .15); const wl = fw.length(); if (wl > wmax) fw.multiplyScalar(wmax / wl);
  fw.sub(I.w); const al = fw.length(), am = 15.7 * dt; if (al > am) fw.multiplyScalar(am / al); I.w.add(fw);
  const a = I.w.length() * dt; if (a > 1e-8) I.q.premultiply(IPQ[0].setFromAxisAngle(IPV[3].copy(I.w).normalize(), a)).normalize(); I.qt.copy(qt);
}
// 這一格的目標方向：看前方＋轉彎傾斜＋抖動；迴轉時原地轉；最後 2 秒轉成玩家的視線、最後 0.8 秒鎖定
function ipTarget(I, dt, out) {
  const R = I.R, t = I.t, cur = I.cur, v = cur.v, ff = I.rate > 1.01, T = R.Tend, pv = cur.seg && cur.seg.kind === 'pivot' ? cur.seg : null;
  if (pv) out.copy(I.qPiv0).premultiply(IPQ[2].setFromAxisAngle(IPUP, Math.PI * ismo((t - pv.t0) / pv.dur) * (R.pivSgn || 1)));
  else {
    const la = clamp(.4 * v, 1, 12) * (ff ? 1 + .5 * (I.rate - 1) : 1), look = ipLook(R, cur.i, cur.d, la, IPV[4]);
    if (look.distanceTo(I.pos) > .05) { IPM.lookAt(I.pos, look, IPUP); out.setFromRotationMatrix(IPM); } else out.copy(I.qLook);
    I.qLook.copy(out); if (cur.seg && cur.seg.kind === 'stop' && !cur.seg.fin) I.qPiv0.copy(out);
    const kb = R.rm ? 0 : (LOW ? .6 : 1) / (ff ? I.rate : 1), bank = clamp(.3 * (R.K[cur.i] || 0) * v, -.45, .45) * kb * (1 - smooth(T - 2, T - 1.2, t));
    I.roll += (bank - I.roll) * Math.min(1, dt / .2);
    const sh = R.rm || LOW || ff ? 0 : .006 * Math.min(1, v / 25) * (1 - smooth(T - 2.4, T - 1.5, t));
    out.multiply(IPQ[2].setFromEuler(IPE.set(Math.sin(t * 31) * sh, Math.sin(t * 27 + 1) * sh, I.roll + Math.sin(t * 23) * sh * 1.5, 'YXZ')));
  }
  const tw = R.turnT || 2, w = ismo((t - (T - tw)) / (tw - .8)); if (t >= T - .8) out.copy(I.Qp); else if (w > 0) out.slerp(I.Qp, w); // turnT：從側面進來要轉 90° 的那幾種提早開始轉
  return out;
}
// 遮罩顏色：雲＝白混一點霧色（夜裡偏霧色）、大城市＝那一區的光色混白、霧＝目前的霧色
function ipMaskCol(k) {
  const f = W.scene.fog.color;
  if (k === 'cloud') return IPC.set('#ffffff').lerp(f, .15 + .6 * DN.night);
  if (k === 'fog') return IPC.copy(f);
  if (k && k.startsWith('city:')) return IPC.set(PALETTE[k.slice(5)] ? PALETTE[k.slice(5)].light : '#ffffff').lerp(IPC2.set('#ffffff'), .5);
  return IPC.set(k || '#ffffff');
}
function ipMask(op, col) { const el = document.getElementById('introFade'); if (!el) return; const o = op < .002 ? '0' : op.toFixed(3); if (el.style.opacity !== o) el.style.opacity = o; if (col && op > .002) { const c = col[0] === '#' ? col : '#' + ipMaskCol(col).getHexString(); if (el._c !== c) { el._c = c; el.style.background = c; } } }
// 略過的快轉倍率：0.3 秒內升上去、進落地段前降回 1、路線轉得急時自動放慢（鏡頭轉速不超過 240°/s）
function ipRate(I, dt) {
  const f = I.ff; if (!f) return 1; f.rt += dt; const left = I.R.tLand - I.t; if (left <= 0) return 1;
  let r = Math.min(1 + (f.r - 1) * smooth(0, .3, f.rt), 1 + (f.r - 1) * smooth(0, .3 * f.r, left)); const turn = Math.abs((I.R.K[I.cur.i] || 0) * (I.cur.v || 0));
  if (turn > .01) r = Math.min(r, 4.19 / turn); return Math.max(1, r);
}
const ipKick = () => (INTRO.R && INTRO.R.rm) ? 0 : W.cam.aspect < 1 ? (LOW ? 8 : 12) : (LOW ? 12 : 22); // 高速時視野加寬多少（直式少一點）
function ipFovT(I) { const T = I.R.Tend, f0 = W.fov0 || 72; return I.t >= T - 1.4 ? f0 : f0 + ipKick() * clamp(((I.cur.v || 0) - 6) / 20, 0, 1); }
// 穿越機目前在哪個洞、地面投影（caveEnv、envStep 用）
function ipEnv(I) {
  const a = I.R.pts[I.cur.i], v = I.v;
  if (a && a.c) { v.c = a.c; v.s = clamp(a.s, -2, a.c.L + 2); v.i = clamp(Math.round(v.s / CAVE_STEP), 0, a.c.n - 1); v.dir = a.sd || 1; } else v.c = null;
  const e = I.env || (I.env = { x: 0, y: 0, z: 0, yaw: 0 }); e.x = I.pos.x; e.z = I.pos.z; e.y = v.c ? v.c.Y[v.i] : ipGround(I.pos.x, I.pos.z); IPV[5].set(0, 0, -1).applyQuaternion(W.cam.quaternion); e.yaw = Math.atan2(-IPV[5].x, -IPV[5].z);
}

/* ---------- 開場：開始、每格、略過、結束 ---------- */
function introStart(done) {
  const I = INTRO; if (I.on) return true; if (!W.ready || !CAVES.length || !P) return false;
  let R = null; try { R = introPlan(); } catch (e) { console.warn('開場路線算不出來，直接開始', e); R = null; }
  if (!R) return false;
  const st = R.st, cam = W.cam;
  Object.assign(I, { on: true, R, t: 0, dt: 0, done, rate: 1, ff: null, fj: null, skip: false, skipped: false, adv: false, frame: 0, roll: 0, lastOp: st ? 0 : 1, cutNow: 0, evI: 0, outOn: false, hint: false, tk: 0, jump: false, cutJ: false,
    yaw0: P.yaw, pitch0: P.pitch, Qp: R.eye.Qp.clone(), E: R.eye.E.clone(), via: R.via, pos: R.pts[0].p.clone(), w: ipv(), q: new THREE.Quaternion(), qt: new THREE.Quaternion(), qLook: new THREE.Quaternion(), qPiv0: new THREE.Quaternion(), cur: { i: 0, d: 0, v: R.v0, seg: null } });
  ipEnv(I);
  // 起點的方向：從標題接過來就是上一格的鏡頭；冷開場直接看著路線
  ipTarget(I, 1 / 60, I.qt); I.q.copy(st ? st.q : I.qt); I.qLook.copy(I.qt); I.qPiv0.copy(I.qt);
  I.fov = st ? st.fov : (W.fov0 || 72) + ipKick() * clamp((R.v0 - 6) / 20, 0, 1);
  document.body.classList.remove('intro-out', 'intro-done'); document.body.classList.add('intro'); if (VM.g) VM.g.visible = false;
  let el = document.getElementById('introSkip'); if (!el) { el = document.createElement('div'); el.id = 'introSkip'; document.body.appendChild(el); } el.textContent = TOUCH ? '點一下略過' : '按任意鍵略過'; el.hidden = true;
  let fd = document.getElementById('introFade'); if (!fd) { fd = document.createElement('div'); fd.id = 'introFade'; document.body.appendChild(fd); } fd.classList.remove('on'); ipMask(I.lastOp, st ? null : '#000');
  // 開場期間吃掉輸入：遊戲本身收不到（不會開選單、互動、聊天、鎖滑鼠、建搖桿）；彈窗與介面裡的照常
  I.onKey = e => {
    if (!I.on) return; const tg = e.target; if (tg && tg.closest && tg.closest('#modal, #gui, .rx')) return;
    e.stopImmediatePropagation(); if (e.type === 'pointerdown') { try { audio(); } catch (_) { } }
    if (e.type === 'touchstart' && tg && tg.id === 'worldCv' && e.cancelable) e.preventDefault();
    if (e.type === 'keydown') { if (/^(Space|Tab|Arrow)/.test(e.code)) e.preventDefault(); if (e.repeat || /^(Shift|Control|Alt|Meta)/.test(e.code)) return; }
    if (I.t >= .35 && !I.skipped) I.skip = true;
  };
  ['keydown', 'pointerdown', 'touchstart'].forEach(k => addEventListener(k, I.onKey, { capture: true, passive: false }));
  // 開機直接開始、著色器還沒預熱：在黑幕底下同步編譯（兩種陰影狀態），第一次進洞深處才不會卡一下
  if (!st && I.warm < 2) { const m0 = cam.layers.mask, sh = W.sun && W.sun.castShadow; try { cam.layers.mask = 7; W.r.compile(W.scene, cam); if (!LOW && sh) { W.sun.castShadow = false; W.r.compile(W.scene, cam); } } catch (e) { } if (W.sun) W.sun.castShadow = sh; cam.layers.mask = m0; I.warm = 2; }
  introSound(true); return true;
}
// 這一格的時間與位置（caveEnv 一開始就先算，霧、圖層才會和這一格的位置一致）
function introAdvance(dt) {
  const I = INTRO; if (!I.on || I.adv) return; I.adv = true; I.frame++; if (I.frame <= 2) dt = Math.min(dt, 1 / 60); I.dt = dt;
  if (I.skip) { I.skip = false; introSkipNow(); }
  I.rate = ipRate(I, dt); let t = Math.min(I.R.Tend, I.t + dt * I.rate);
  // 略過的淡跳：遮罩全滿、保持兩格之後才跳
  const fj = I.fj; if (fj) { fj.rt += dt; if (!fj.done && fj.rt >= fj.up && I.lastOp >= .98 && ++fj.n >= 2) { fj.done = true; fj.rt2 = -2 / 60; t = Math.max(t, fj.to); I.R.cuts.forEach(g => { if (g.tm < t) g.done = 1; }); while (I.evI < I.R.evs.length && I.R.evs[I.evI].t < t) I.evI++; I.jump = true; I.cutNow = 2; } } // 跳過的那段：換位置、閃光、風切聲都不補放
  // 換位置那一格前後都要被遮住：上一格的遮罩還沒滿就先停在切換前
  for (const g of I.R.cuts) if (!g.done && t >= g.tm) { if (I.lastOp < .98) t = g.tm - 1e-4; else { g.done = 1; I.cutNow = 2; I.jump = I.jump || g.reset; I.cutJ = true; } break; }
  I.t = t; Object.assign(I.cur, ipAt(I.R, t, I.pos)); ipEnv(I);
  if (I.cutJ || I.jump) { cullChunks(I.pos); W.sky.position.copy(I.pos); }
}
function introStep(dt) {
  const I = INTRO; if (!I.on) return; introAdvance(dt); dt = I.dt; I.adv = false;
  const R = I.R, cam = W.cam, t = I.t, T = R.Tend;
  P.yaw = I.yaw0; P.pitch = I.pitch0; // 開場期間滑鼠動了也不算：終點的視線不會跑掉
  if (!isFinite(I.pos.x + I.pos.y + I.pos.z)) { console.warn('開場位置不是數字，直接結束'); return introEnd(); }
  // 方向（換位置的那格維持原本的方向；減少動態與略過的淡跳在遮罩後直接對準新的路線）
  ipTarget(I, dt, IPQ[3]);
  if (I.jump) { I.q.copy(IPQ[3]); I.qt.copy(IPQ[3]); I.w.set(0, 0, 0); I.fov = ipFovT(I); }
  else { // 角速度上限：平常 150°/s、從標題起飛的前 1.5 秒 90°/s、最後 3 秒 100°/s（中間平順過渡，不會突然煞住）、略過快轉時最多 240°/s、減少動態 45°/s
    let wm = R.rm ? 45 : 150 - (R.title ? 60 * (1 - smooth(1.5, 1.9, t)) : 0) - 50 * smooth(T - 3.4, T - 3, t); if (!R.rm && I.rate > 1.01) wm += 90 * clamp((I.rate - 1) / .5, 0, 1); ipTurn(I, IPQ[3], dt, wm * Math.PI / 180);
  }
  I.jump = false; I.cutJ = false;
  // 視野：跟著速度變寬，每秒最多變 40°，最後 1.4 秒回到平常
  I.fov += clamp(ipFovT(I) - I.fov, -40 * dt, 40 * dt);
  // 遮罩
  let op = 0, col = null; for (const m of R.masks) { const o = m.op * (t < m.a ? 0 : t < m.b ? smooth(m.a, m.b, t) : t <= m.c ? 1 : t < m.d ? 1 - smooth(m.c, m.d, t) : 0); if (o > op) { op = o; col = m.col; } }
  const fj = I.fj; if (fj) { let o; if (!fj.done) o = smooth(0, fj.up, fj.rt); else { fj.rt2 += dt; o = 1 - smooth(0, .35, fj.rt2); if (fj.rt2 > .36) I.fj = null; } if (o >= op) { op = o; col = 'fog'; } }
  if (I.cutNow > 0) { op = 1; I.cutNow--; if (!col) col = 'fog'; }
  ipMask(op, col); I.lastOp = op;
  // 事件：出洞的閃光與風切聲、穿雲
  while (I.evI < R.evs.length && R.evs[I.evI].t <= t) { const k = R.evs[I.evI++].k; if (k === 'flash') { CV.flash = 1.1; introWhoosh(1); } else if (k === 'cloud') { introWhoosh(.8); introWind(); } }
  if (R.title && !I.tk && t > .3) { I.tk = 1; introWhoosh(.4); }
  // 嗡嗡聲：速度越快音調越高，最後 1.6 秒淡掉
  if (I.hum) { try { const ac = AC, va = Math.min(28, I.cur.v * I.rate), f0 = Math.min(260, 150 + 4 * va), g = .012 * smooth(0, .8, t) * (1 - smooth(T - 1.6, T, t)), h = I.hum; h.o1.frequency.setTargetAtTime(f0, ac.currentTime, .05); h.o2.frequency.setTargetAtTime(f0 * 1.016, ac.currentTime, .05); h.f.frequency.setTargetAtTime(230 + 10 * va, ac.currentTime, .05); h.g.gain.setTargetAtTime(g, ac.currentTime, .05); } catch (e) { } }
  // 畫面元素：略過提示 0.6 秒後出現；最後 0.8 秒黑邊收回
  if (!I.hint && t > .6 && !I.skipped) { I.hint = true; const el = document.getElementById('introSkip'); if (el) el.hidden = false; }
  if (!I.outOn && t >= T - .8) { I.outOn = true; document.body.classList.add('intro-out'); }
  DRS.skip = Math.max(DRS.skip || 0, 1); // 開場期間動態解析度不計時
  // 寫進鏡頭（凍僵時最後 0.8 秒用和 cameraStep 一樣的發抖公式疊上去，接手時零誤差；減少動態時兩邊都不抖）
  cam.position.copy(I.pos); cam.quaternion.copy(I.q);
  if (S.frozen && !RM()) { const k = smooth(T - .8, T, t); if (k > 0) { cam.position.x += Math.sin(W.t * 47) * .014 * k; cam.position.y += Math.cos(W.t * 53) * .014 * k; cam.quaternion.multiply(IPQ[4].setFromAxisAngle(IPV[5].set(0, 0, 1), Math.sin(W.t * 41) * .012 * k)); } }
  if (Math.abs(cam.fov - I.fov) > .005) { cam.fov = I.fov; cam.updateProjectionMatrix(); }
  if (t >= T) introEnd();
}
// 略過：剩下不多就快轉（同一條路線、完全連續），太遠、還有換位置沒發生、或減少動態就淡出→跳到落地前→淡入
function introSkipNow() {
  const I = INTRO, R = I.R; if (!I.on || I.skipped) return; I.skipped = true; const el = document.getElementById('introSkip'); if (el) el.hidden = true; introWhoosh(.5);
  const left = R.tLand - I.t; if (left <= 0) return;
  const pend = R.cuts.some(g => !g.done && g.tm > I.t), rs = clamp(left / .8, 1, 8); let est = 0;
  if (!R.rm && !pend && left <= 6) { let tt = I.t, rt = 0; const p = IPV[0]; while (tt < R.tLand && est < 9) { const cur = ipAt(R, tt, p), turn = Math.abs((R.K[cur.i] || 0) * cur.v); let r = Math.min(1 + (rs - 1) * smooth(0, .3, rt), 1 + (rs - 1) * smooth(0, .3 * rs, R.tLand - tt)); if (turn > .01) r = Math.min(r, 4.19 / turn); tt += Math.max(1, r) / 60; rt += 1 / 60; est += 1 / 60; } }
  if (R.rm || pend || left > 6 || est + (R.Tend - R.tLand) > 3.7) I.fj = { rt: 0, n: 0, done: false, up: R.rm ? .3 : .2, to: Math.max(I.t, R.rm ? R.Tend - 1.2 : R.tLand - .9) }; // 減少動態：0.3 秒淡到落地的最後 1.2 秒
  else I.ff = { r: rs, rt: 0 };
}
function introEnd() {
  const I = INTRO; if (!I.on) return; I.on = false;
  I.res = I.E && I.q ? { dp: I.pos.distanceTo(I.E), deg: I.q.angleTo(I.Qp) * 180 / Math.PI } : null; // 收尾前的殘差（測試用：應該 < 0.1°）
  const cam = W.cam; if (I.E && isFinite(I.E.x)) { cam.position.copy(I.E); cam.quaternion.copy(I.Qp); if (S.frozen && !RM()) { cam.position.x += Math.sin(W.t * 47) * .014; cam.position.y += Math.cos(W.t * 53) * .014; cam.quaternion.multiply(IPQ[4].setFromAxisAngle(IPV[5].set(0, 0, 1), Math.sin(W.t * 41) * .012)); } }
  cam.fov = W.fov0 || 72; cam.updateProjectionMatrix(); P.yaw = I.yaw0; P.pitch = I.pitch0;
  ['keydown', 'pointerdown', 'touchstart'].forEach(k => removeEventListener(k, I.onKey, { capture: true }));
  introSound(false); const el = document.getElementById('introSkip'); if (el) el.hidden = true; ipMask(0);
  const b = document.body; b.classList.remove('intro', 'intro-out'); b.classList.add('intro-done'); clearTimeout(I.doneT); I.doneT = setTimeout(() => b.classList.remove('intro-done'), 650);
  I.v.c = null; I.R = null; I.fj = I.ff = null; W.camAway = false; cullChunks(P); VM.swing = Math.max(VM.swing || 0, .3);
  const done = I.done; I.done = null; if (done) done();
}
// 標題第一格先把著色器編好（compileAsync：不擋住畫面）：現在的陰影狀態＋洞深處關掉陰影的狀態；LOW 沒有陰影只要一種
function introPrewarm() {
  const I = INTRO; if (I.warm || !W.r || !W.r.compileAsync) return; I.warm = 1; const cam = W.cam; if (!VM.g) initViewModel(); // 手（蒙皮＋逐頂點粗糙度，只有它用的著色器）先建好一起編譯：開場結束手第一次出現時不卡
  const run = () => { const m0 = cam.layers.mask; try { cam.layers.mask = 7; return W.r.compileAsync(W.scene, cam); } catch (e) { return Promise.resolve(); } finally { cam.layers.mask = m0; } };
  run().then(() => { const sh = W.sun && W.sun.castShadow; if (LOW || !sh || INTRO.on) return; W.sun.castShadow = false; try { return run(); } finally { W.sun.castShadow = sh; } }).then(() => { I.warm = 2; }, () => { I.warm = 2; });
}
// 聲音：小小的螺旋槳嗡嗡聲（速度越快音調越高）＋進出洞口的風切聲、穿雲的風聲
function introSound(on) {
  try {
    if (!S.sound) return; const ac = audio(); if (on && !INTRO.hum) { const o1 = ac.createOscillator(), o2 = ac.createOscillator(), f = ac.createBiquadFilter(), g = ac.createGain(); o1.type = o2.type = 'sawtooth'; o1.frequency.value = 150; o2.frequency.value = 152.4; f.type = 'lowpass'; f.frequency.value = 230; f.Q.value = 2; g.gain.value = 0; o1.connect(f); o2.connect(f); f.connect(g); g.connect(master); o1.start(); o2.start(); INTRO.hum = { o1, o2, f, g }; }
    else if (!on && INTRO.hum) { const h = INTRO.hum; INTRO.hum = null; h.g.gain.setTargetAtTime(0, ac.currentTime, .15); setTimeout(() => { try { h.o1.stop(); h.o2.stop(); h.g.disconnect(); } catch (e) { } }, 900); }
  } catch (e) { }
}
function introWhoosh(k = 1) { try { if (!S.sound) return; const ac = audio(), t = ac.currentTime; noise(ac, t, .9 * k + .2, 700, .8, .05 * k, 'bandpass', .8); noise(ac, t + .1, .6 * k + .1, 1800, 1.2, .025 * k, 'bandpass', 1.3); } catch (e) { } }
function introWind() { try { if (!S.sound) return; const ac = audio(), t = ac.currentTime; noise(ac, t, 1.6, 420, .5, .035, 'lowpass', .5); } catch (e) { } }
