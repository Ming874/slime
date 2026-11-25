'use strict';
/* 雪原：地形多元化與場景細節（登記方式見 regions.js）。內容都包在 IIFE 裡，避免和別的檔案撞名
   地形（regionTerrain，基礎單位）：
   - 北：東南東的風吹出一道道雪丘（迎風面緩、背風面陡，稜線有連續的雪簷、谷底是風蝕的藍冰）；西北的山壁流下一條冰河（冰舌、冰裂縫、冰崖、冰洞口、兩側與前緣的冰磧），
     冰河的融水結成一條小河，一路流進冰湖
   - 小徑盡頭的北邊：一座四周是斷崖的觀景台地，只有東南側一條雪坡上得去
   - 南：冰瀑的水潭流出一條結冰的小河，切出一道溪谷；中段兩座岩丘夾成深谷，谷頂架著一道天然的冰橋；小河的盡頭是一個結冰的小水窪；
     溪谷南岸是守林人的小屋，再往南一座小丘上立著幾根岩柱
   - 所有起伏在區域邊界、冰洞口前、小徑兩側淡到 0；冰晶塔、冰湖營地、冰瀑附近不動
   植被：原本整區均勻撒滿的雪松、雪叢、岩石、冰晶，改由這裡依「林子—空地」的節奏擺（buildProps 用 regionAvoid 讓出整區）
   場景：路口的雪原導覽圖、台地上的石堆／長椅／彩旗／望遠鏡、風蝕蘑菇岩與歪樹上的貓頭鷹、冰河的冰洞口與警告牌、冰橋與崖頂的雪唇、
   守林人小屋（煙囪冒煙、夜裡窗戶亮）、岩柱群、雪兔的窩（雪下露出的大石頭、一串腳印、怕生的雪兔）、冰晶花（夜裡發光）；
   夜裡天上有極光，冰面映著極光的顏色
   效能：零件合併成少數網格（平面材質分北南兩組、冰與夜光整區一組，見 splitKit），植被用 scatter（分區；桌機遠近兩種精細度、LOW 只用低面數）；
   動畫都在 regionStep 裡做距離剔除 */
(() => {
  /* ---------- 位置（基礎單位；世界座標＝基礎單位×K） ---------- */
  const CAVE = [-63.8, -2.4]; // 冰洞外側洞口：前後 10 單位內不動地形、不放東西
  // 南：冰瀑的水潭 → 溪谷 → 深谷（冰橋）→ 小水窪
  const CREEK = [[-155.6, 40.2], [-150, 44.5], [-143.5, 49.5], [-136, 54.5], [-128, 58.5], [-120.5, 61.5], [-114, 63], [-107, 64], [-100.5, 66.5], [-96.5, 70]];
  const BED = [2.5, .95], POND = { x: -94.5, z: 72, r: 3.6 }, GORGE = { x: -114, z: 63 }, KNOLL = [{ x: -112.7, z: 56 }, { x: -115.3, z: 70 }];
  const CABIN = { x: -104, z: 76.5 }, SPIRE = { x: -124, z: 89 }; // 小屋在深谷出口與小水窪之間的南岸
  // 北：冰河（冰舌前緣、往上游的方向）、融水小河、雪丘、觀景台地與雪坡
  const GLA = { x: -150, z: -77, dx: -.989, dz: -.141 };
  const STREAM = [[-148.6, -76.6], [-146.3, -74.2], [-145, -68], [-144.6, -61.5], [-142.9, -55.5], [-141, -49.4]], SBED = [4.1, 1.38];
  const MESA = { x: -102, z: -42, top: 11.5 }, RAMP = { ax: -89.5, az: -25.5, bx: -99, bz: -35.5 };
  // 風從東南東往西北西吹：背風的陡坡朝西北、背著太陽，從台地看過去一道道雪丘的陰影很清楚
  const WIND = Math.PI + .3, DUNE_L = 17.5, MUSH = { x: -116, z: -80 }, OWL = { x: -112.4, z: -84.6 };
  const TOWER = [-112, -8], SIGN = { x: -91.8, z: 4.6 };
  // 小路盡頭和深谷之間的空地：雪下露出幾塊大石頭，石頭腳下是雪兔的窩，一串腳印從東邊的林子跳過來
  const HARE = { x: -104.6, z: 33.4, fx: .93, fz: -.37, from: [-90.5, 27.6] }; // 窩的入口、洞口朝向（往東南東，對著跳過來的腳印）
  // 已有的東西：附近的地形不動（[x, z, 內半徑, 外半徑]：冰晶塔、冰湖、冰屋、雪人一家、冰瀑的水潭、敲得到的冰柱大石頭）
  const KEEP = [[-112, -8, 9, 14], [-138, -41, 10.5, 13.5], [-128.4, -45.6, 4, 7], [-141.5, -33.5, 3.5, 6.5], [-158.4, 38.6, 4.5, 6.5], [-156.8, 33.6, 3.5, 6]];
  const SNOWMEN = [[-78, 10], [-96, -18], [-118, 24], [-136, -6], [-70, -26]]; // game.js 立在雪原的五個雪人

  /* ---------- 小工具（這個檔案比 game.js 先載入，game.js 的全域都在函式被呼叫時才用） ---------- */
  const c01 = v => v < 0 ? 0 : v > 1 ? 1 : v, sm = (a, b, x) => { const t = c01((x - a) / (b - a)); return t * t * (3 - 2 * t); };
  const segD = (x, z, ax, az, bx, bz) => { const dx = bx - ax, dz = bz - az, t = c01(((x - ax) * dx + (z - az) * dz) / (dx * dx + dz * dz)); return Math.hypot(x - ax - dx * t, z - az - dz * t); };
  // 折線：先用 game.js 的 Catmull-Rom 圓滑，再存成線段（距離查詢用）
  function poly(pts) {
    const n = pts.length - 1, S = new Float64Array(n * 6); let L = 0, x0 = 1e9, x1 = -1e9, z0 = 1e9, z1 = -1e9;
    for (let i = 0; i < n; i++) { const [ax, az] = pts[i], [bx, bz] = pts[i + 1], dx = bx - ax, dz = bz - az, l = Math.hypot(dx, dz) || 1e-6; S.set([ax, az, dx, dz, l, L], i * 6); L += l; }
    for (const [x, z] of pts) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); z0 = Math.min(z0, z); z1 = Math.max(z1, z); }
    return { pts, S, n, L, x0, x1, z0, z1 };
  }
  const NR = { d: 1e9, s: 0, t: 0 }; // 最近點：距離 d、沿線長度 s、t < 0＝在起點的後面
  function near(P, x, z, pad) {
    NR.d = 1e9; if (x < P.x0 - pad || x > P.x1 + pad || z < P.z0 - pad || z > P.z1 + pad) return NR;
    const S = P.S; let bd = 1e18;
    for (let i = 0; i < P.n; i++) {
      const k = i * 6, ax = S[k], az = S[k + 1], dx = S[k + 2], dz = S[k + 3], l = S[k + 4], tr = ((x - ax) * dx + (z - az) * dz) / (l * l), t = c01(tr), px = ax + dx * t, pz = az + dz * t, d = (x - px) ** 2 + (z - pz) ** 2;
      if (d < bd) { bd = d; NR.s = S[k + 5] + l * t; NR.t = i === 0 ? tr : 1; }
    }
    NR.d = Math.sqrt(bd); return NR;
  }

  /* ---------- 地形 ---------- */
  let TR = null, RAW = false; // RAW：算「改之前」的高度（小屋平台要對齊原本的地面）
  function trInit() {
    const b = pts => poly(crPts(pts, 8));
    TR = { creek: b(CREEK), stream: b(STREAM), path: poly(crPts(PATH_LINES[5], 8).map(([x, z]) => [x / K, z / K])) };
    RAW = true; try { TR.cabinY = H0(CABIN.x, CABIN.z); } finally { RAW = false; }
  }
  // 冰河：u＝從冰舌前緣往上游的距離、v＝橫向（中線微微彎），w＝冰面的權重、t＝冰面高度、m＝冰磧（兩側與前緣的碎石堤）
  const GL = { u: 0, v: 0, W: 7, w: 0, t: 0, m: 0 }, GW = uu => 8.6 + uu * .07; // 冰舌的半寬（往上游慢慢變寬）
  function glac(x, z) {
    GL.w = GL.m = 0; if (x > -134 || z < -100 || z > -54) return GL;
    const rx = x - GLA.x, rz = z - GLA.z, u = rx * GLA.dx + rz * GLA.dz, v = -rx * GLA.dz + rz * GLA.dx, uu = Math.max(0, u);
    const vv = Math.abs(v - 2.2 * Math.sin(uu * .09) * sm(0, 8, uu)), Wd = GW(uu);
    GL.u = u; GL.v = vv; GL.W = Wd;
    GL.w = sm(-1.8, .3, u) * (1 - sm(Wd - .3, Wd + 2.4, vv));
    GL.t = 7.8 + 25 * Math.pow(uu / 36, 1.8) + 1.9 * Math.max(0, 1 - (vv / Wd) ** 2);
    GL.m = 1.3 * Math.exp(-((vv - Wd - 1.8) ** 2) / 1.4) * sm(-1, 3, u) * (1 - sm(20, 30, u)) + 1.05 * Math.exp(-((u + 6) ** 2) / 3) * (1 - sm(Wd + .5, Wd + 4, vv));
    return GL;
  }
  // 雪丘：沿風向的鋸齒波（迎風面 76% 緩緩爬升、背風面 24% 陡降，最陡約 0.97，走得上去），稜線隨雜訊彎成新月形，高度也一段高一段低
  const CW = Math.cos(WIND), SW = Math.sin(WIND), DT = { t: 0, a: 0 }, CREST = .76;
  const duneWarp = (x, z, c) => 3.2 * Math.sin(c * .105 + 1.3) + 5 * (vnoise(x * .03, z * .03, 61) - .5); // 稜線的彎曲
  function duneT(x, z) {
    const s = x * CW + z * SW, c = -x * SW + z * CW, f = (s + duneWarp(x, z, c)) / DUNE_L;
    DT.t = f - Math.floor(f); DT.a = 2.6 * (.6 + .4 * vnoise(c * .05, s * .02, 63)); return DT;
  }
  const duneW = (x, z) => sm(51, 62, -z) * sm(88, 97, -x) * (1 - sm(148, 157, -x));
  function dune(x, z) {
    const w = duneW(x, z); if (w <= 0) return 0; const { t, a } = duneT(x, z);
    const p = t < CREST ? Math.sin(Math.PI / 2 * t / CREST) ** 2 : Math.cos(Math.PI / 2 * (t - CREST) / (1 - CREST)) ** 2;
    return w * a * (p - .47);
  }
  // 觀景台地：不規則的圓、頂上微微隆起、邊緣是斷崖（崖腳有一圈碎石坡）；東南側一條雪坡從地面接到台地頂
  const mesaR = a => 8.6 + 1.1 * Math.sin(3 * a + .7) + .7 * Math.sin(5 * a + 2.1) + .35 * Math.sin(9 * a + 1);
  function mesa(x, z, h) {
    const dx = x - MESA.x, dz = z - MESA.z, d = Math.hypot(dx, dz); let y = h;
    if (d < 17) {
      const R = mesaR(Math.atan2(dz, dx)), t = c01((d - R) / 2.6), top = MESA.top + .45 * Math.max(0, 1 - (d / R) ** 2) + .25 * (vnoise(x * .3, z * .3, 75) - .5);
      y = h + Math.max(0, top - h) * (1 - Math.pow(t, 1.6));
      y += 1.1 * sm(R + 1.6, R + 2.8, d) * (1 - sm(R + 3, R + 7, d));
    }
    const ux = RAMP.bx - RAMP.ax, uz = RAMP.bz - RAMP.az, L2 = ux * ux + uz * uz, t = ((x - RAMP.ax) * ux + (z - RAMP.az) * uz) / L2;
    if (t > -.2 && t < 1.15) {
      const tc = c01(t), lat = Math.abs((x - RAMP.ax) * uz - (z - RAMP.az) * ux) / Math.sqrt(L2), sw = 2 + 2.6 * (1 - tc);
      if (lat < 1.9 + sw) { const tg = h + (MESA.top - .05 - h) * tc, w = (1 - sm(1.9, 1.9 + sw, lat)) * sm(-.2, 0, t); y = Math.max(y, h + (tg - h) * w); }
    }
    return y;
  }
  // 南邊：深谷兩側的岩丘 → 小屋的平台 → 溪谷（從平台旁邊切過去，平台不會蓋到溪床）→ 小水窪 → 岩柱的小丘
  function south(x, z, h) {
    for (const k of KNOLL) { const dx = x - k.x, dz = z - k.z, q = Math.hypot((dx * .983 + dz * .182) / 11, (-dx * .182 + dz * .983) / 8); if (q < 1) h += 4.8 * (1 - sm(0, 1, q)) * (.85 + .3 * vnoise(x * .2, z * .2, 71)); }
    const cd = Math.hypot(x - CABIN.x, z - CABIN.z); if (cd < 9.5) h += (TR.cabinY - h) * (1 - sm(5.5, 9.5, cd));
    const n = near(TR.creek, x, z, 14);
    if (n.d < 14) {
      const s = n.s, bed = BED[0] + (BED[1] - BED[0]) * s / TR.creek.L, fl = bed + .32, g = 1 - sm(8, 14, Math.hypot(x - GORGE.x, z - GORGE.z));
      const Wf = 3.4 - 1.1 * g, Ws = (2 + 5 * sm(0, 12, s)) * (1 - g) + 1.3 * g, d = n.d;
      let tg = d < 1.15 ? bed + (fl - bed) * sm(.55, 1.15, d) : d < Wf ? fl : fl + (h - fl) * sm(Wf, Wf + Ws, d);
      tg = h + (tg - h) * sm(3.5, 7, Math.hypot(x + 156.8, z - 33.6)); // 冰柱大石頭的地面不動
      h = Math.min(h, tg);
    }
    const pd = Math.hypot(x - POND.x, z - POND.z); if (pd < POND.r + 5) h = Math.min(h, pd < POND.r ? BED[1] : BED[1] + (h - BED[1]) * sm(POND.r, POND.r + 5, pd));
    if (cd < 6.5) h += (TR.cabinY - h) * (1 - sm(3.7, 6.5, cd)); // 溪谷的岸坡會切到平台的東北角（門廊浮在半空）：小屋腳下再整平一次
    const sd = Math.hypot(x - SPIRE.x, z - SPIRE.z); if (sd < 11) h += 2.4 * (1 - sm(0, 11, sd)) * (.8 + .4 * vnoise(x * .15, z * .15, 73));
    return h;
  }
  // 冰河的融水小河：溪床從冰舌前緣一路往下降到冰湖；起點後面（冰崖腳）只挖一個小小的冰洞口
  function stream(x, z, h) {
    const n = near(TR.stream, x, z, 5), d = n.d * (n.t < 0 ? 3 : 1); if (d >= 4.2) return h;
    const bed = SBED[0] + (SBED[1] - SBED[0]) * n.s / TR.stream.L;
    return Math.min(h, d < 1 ? bed + .22 * sm(.45, 1, d) : bed + .22 + Math.max(0, h - bed - .22) * sm(1, 3.8, d));
  }
  // 冰洞口：小河起點前面的冰崖腳，往冰崖裡挖一個平底的凹槽，放得下冰洞（拱、裡面藍色的洞壁、上面蓋冰的圓頂，見 glacierScene）。
  // 原本拱擺在冰崖的半腰（比河床高 3 公尺）、斜斜地對著冰崖，拱裡塞滿了冰崖面與冰舌，只剩右上角一條細細的深藍月牙
  const CAVM = { x: STREAM[0][0] - GLA.dx * .6, z: STREAM[0][1] - GLA.dz * .6, nx: -GLA.dx, nz: -GLA.dz, hw: 2.4, dp: 2.6, fl: SBED[0] + .12 }; // 拱的中心、朝外（正對冰崖面）、凹槽半寬與深、洞底高（基礎單位）
  const caveAB = (x, z) => { const rx = x - CAVM.x, rz = z - CAVM.z; return [-(rx * CAVM.nx + rz * CAVM.nz), rx * CAVM.nz - rz * CAVM.nx]; }; // [往冰崖裡多深, 橫向（往右為正）]
  function caveNotch(x, z, h) {
    const [a, b] = caveAB(x, z); if (a < -1.5 || a > CAVM.dp + .8 || Math.abs(b) > CAVM.hw + .8) return h;
    const k = (1 - sm(CAVM.hw, CAVM.hw + .7, Math.abs(b))) * (1 - sm(CAVM.dp, CAVM.dp + .7, a)) * sm(-1.5, -.7, a); // 洞壁要陡：地形網格一格 1.8 公尺（LOW 2.5），凹槽比洞大一格，斜的格子才不會穿進洞裡
    return Math.min(h, h + (CAVM.fl - h) * k);
  }
  function terrain(x, z, h0) {
    if (RAW || x > -64 || Math.abs(z) > -x - 10) return h0;
    if (!TR) trInit();
    let h = h0; const g = glac(x, z);
    if (z < -50 && x < -86) h += dune(x, z) * (1 - g.w);
    if (g.w > 0 || g.m > 0) { h += g.m; h += (g.t - h) * g.w; }
    h = mesa(x, z, h);
    if (z > 24) h = south(x, z, h);
    let keep = 1; for (const [kx, kz, r0, r1] of KEEP) { const d = Math.hypot(x - kx, z - kz); if (d < r1) keep *= sm(r0, r1, d); }
    h = h0 + (h - h0) * keep;
    if (z < -44 && x < -136) h = caveNotch(x, z, stream(x, z, h));
    // 區域邊界、冰洞口、小徑：淡到 0（小徑兩側 3 單位內完全不動，坡度維持原樣）
    let m = sm(66, 74, -x) * sm(0, 9, -x - 12 - Math.abs(z)) * sm(10, 15, Math.hypot(x - CAVE[0], z - CAVE[1]));
    if (m > 0 && x > -104 && Math.abs(z) < 14) m *= sm(3, 8, near(TR.path, x, z, 9).d);
    return h0 + (h - h0) * m;
  }
  regionTerrain(terrain);
  // 整區的隨機植被改由下面依節奏擺（世界座標）
  regionAvoid((x, z) => { const bx = x / K, bz = z / K; return bx < -64 && Math.abs(bz) < -bx - 8; });

  /* ---------- 場景佔用的地方（基礎單位）：不長隨機的樹與石頭 ---------- */
  function taken(x, z) {
    if (Math.hypot(x - MESA.x, z - MESA.z) < mesaR(Math.atan2(z - MESA.z, x - MESA.x)) + 2.2) return true; // 台地頂與斷崖（崖腳的碎石坡可以有石頭）
    if (segD(x, z, RAMP.ax, RAMP.az, RAMP.bx, RAMP.bz) < 3.6) return true;
    if (glac(x, z).w > .02) return true;
    { const [ca, cb] = caveAB(x, z); if (ca > -2.5 && ca < CAVM.dp + 1 && Math.abs(cb) < CAVM.hw + 1.5) return true; } // 冰洞口的凹槽與洞口前
    if (near(TR.stream, x, z, 3).d < 2.8) return true;
    const cn = near(TR.creek, x, z, 5); if (cn.d < (Math.hypot(x - GORGE.x, z - GORGE.z) < 14 ? 4.4 : 3.3)) return true;
    if (Math.hypot(x - POND.x, z - POND.z) < POND.r + 2.4) return true;
    if (Math.hypot(x - CABIN.x, z - CABIN.z) < 7.5 || Math.hypot(x - SPIRE.x, z - SPIRE.z) < 6.5) return true;
    if (Math.hypot(x - HARE.x + HARE.fx * 1.5, z - HARE.z + HARE.fz * 1.5) < 5 || segD(x, z, HARE.x, HARE.z, HARE.from[0], HARE.from[1]) < 1.6) return true; // 雪兔的窩與腳印
    if (Math.hypot(x - MUSH.x, z - MUSH.z) < 4.5 || Math.hypot(x - OWL.x, z - OWL.z) < 2.5 || Math.hypot(x - SIGN.x, z - SIGN.z) < 3.5) return true;
    return false;
  }
  function veto(x, z) {
    if (x > -66 || Math.abs(z) > -x - 11) return true;
    if (Math.hypot(x - CAVE[0], z - CAVE[1]) < 13) return true;
    if (x > -104 && Math.abs(z) < 14 && near(TR.path, x, z, 6).d < 4.2) return true;
    if (nookAvoid(x * K, z * K) || Math.hypot(x - TOWER[0], z - TOWER[1]) < 8.5 || segD(x, z, -94, 1, -107, -5.5) < 3.2) return true; // 冰晶塔與「小徑盡頭看向塔」的視線
    for (const [sx, sz] of SNOWMEN) if (Math.hypot(x - sx, z - sz) < 2.6) return true;
    return taken(x, z);
  }

  /* ---------- 植被：林子—空地的節奏 ---------- */
  // 一定要有的林子 [x, z, 半徑, 密度]：洞口外小徑兩側、塔西邊、溪谷兩岸、小屋後面的雪林；其餘由低頻雜訊長出一片片林子
  const GROVES = [[-76.5, -9.5, 5.5, 1], [-80, 8.5, 6, 1], [-77, -14, 8, .85], [-83, 13, 9, .9], [-88, 29, 11, .8], [-127, 10, 11, .85], [-146, -10, 11, .8], [-150, 14, 9, .7], [-87, -42, 7, .55], [-150, -38, 7, .6], [-126, -58, 6, .45],
    [-146, 58, 9, 1], [-139, 43, 7, .9], [-126, 49, 7, .85], [-124, 74, 8, .95], [-104, 55, 8, .9], [-103, 80, 7, .8], [-141, 83, 12, .9], [-153, 70, 9, .9], [-136, 102, 12, .78], [-151, 106, 11, .75], [-112, 101, 9, .7], [-98, 90, 6, .6]];
  function dens(x, z) {
    let g = sm(.44, .66, fbm(x * .028, z * .028, 87)) * .8;
    for (const [gx, gz, r, k] of GROVES) { const d = Math.hypot(x - gx, z - gz); if (d < r) g = Math.max(g, k * (1 - sm(r * .45, r, d))); }
    if (z < -50) g *= .22; // 風吹雪丘：風太大，樹很少
    return Math.max(g, .035); // 空地上偶爾一棵
  }
  function vegGeo(LQ) {
    // 近處版本 8 邊×2 段（原本 9×3）：一棵少四成的面，看起來一樣是低多邊形；森林谷地的林子很密，近處完整版本的三角形是預算的大頭
    const cone = (r, h, y, c, sd) => [LQ ? new THREE.ConeGeometry(r, h, 6, 1) : jit(new THREE.ConeGeometry(r, h, 8, 2), .22, sd), c, M4(0, y, 0)];
    const blob = (x, y, z, s, c, sd, sy = s, d = 1) => [jit(new THREE.IcosahedronGeometry(.9, LQ ? 0 : d), LQ ? .18 : .3, sd), c, M4(x, y, z, 0, 0, 0, s, sy, s)];
    return {
      pine: mergeParts([[new THREE.CylinderGeometry(.12, .2, 1.3, LQ ? 5 : 8), '#5b4030', M4(0, .65, 0)], cone(1.15, 1.7, 1.45, '#2c5a46', 1), cone(1.0, .7, 1.75, '#f8fafc', 4), cone(.9, 1.45, 2.25, '#356a52', 2), cone(.78, .6, 2.55, '#f8fafc', 5), cone(.62, 1.2, 2.95, '#2c5a46', 3), cone(.5, .55, 3.25, '#f8fafc', 6)]),
      rock: mergeParts([[jit(new THREE.DodecahedronGeometry(1, LQ ? 0 : 1), .45, 8), '#7f8c9e', M4(0, .3, 0, 0, 0, 0, 1, .65, 1)], [new THREE.SphereGeometry(.85, LQ ? 7 : 12, LQ ? 3 : 6, 0, PI2, 0, Math.PI / 2), '#f8fafc', M4(0, .55, 0, 0, 0, 0, 1.05, .4, 1.05)]]),
      bush: mergeParts([...[[0, .35, 0, .6], [.4, .3, .1, .45], [-.35, .28, -.1, .5]].map(([x, y, z, s], i) => blob(x, y, z, s, '#2c5a46', i + 160)), ...[[0, .62, 0, .52], [.4, .5, .1, .38], [-.35, .48, -.1, .42]].map(([x, y, z, s], i) => blob(x, y, z, s, '#f8fafc', i + 170, s * .45, 0))]), // 雪蓋用最粗的二十面體
    };
  }
  // 雪松的碰撞半徑：玩家貼著樹幹（或卡在兩棵樹之間）時，鏡頭不能鑽進樹冠、也不能貼在樹冠上（整個畫面變成深綠色）。
  // 大棵的雪松最下面一層樹冠剛好在眼睛的高度、半徑快兩公尺，原本的 0.72×s 讓鏡頭停在樹冠表面上或鑽進去；改成「站著時眼睛高度（坡地的上下方）的樹冠半徑」再留 0.3 公尺
  const PINE_C = [[1.15, 1.7, 1.45], [1, .7, 1.75], [.9, 1.45, 2.25], [.78, .6, 2.55], [.62, 1.2, 2.95], [.5, .55, 3.25]]; // vegGeo 的樹冠：[底半徑, 高, 中心高]
  const crownR = y => { let R = 0; for (const [r, h, c] of PINE_C) { const f = (c + h / 2 - y) / h; if (f > 0 && f <= 1) R = Math.max(R, r * f); } return R; };
  function pineR(s, sy, sl) {
    let R = 0; for (const d of [-.6, 0, .6]) R = Math.max(R, crownR((1.62 + .12 + sl * .3 + d * sl) / (s * sy))); // 樹埋進地面 0.12＋坡度×0.3；站在坡的上下方眼睛高低差約 ±0.6×坡度
    return Math.max(.72 * s + .05, R * s * 1.11 + .3 - .35); // 1.11：jit 讓樹冠外擴 11%；0.35：玩家半徑（潛行時眼睛低、會在樹冠底下，看得到樹幹，沒關係）
  }
  function vegetation() {
    const rd = seeded(5150), L = { pine: [], bush: [], rock: [], ice: [] }, tries = LOW ? 5600 : 9400;
    // 雪松、石頭彼此的最小間距：seeded 是線性同餘亂數，連續取的 (x, z) 落在格子上，會出現一批批間距剛好 0.63、1.07 公尺的「雙頭樹」（兩個樹頂長在一起）。
    // 間距用樹冠（石頭）大小算：兩棵雪松至少隔「兩個樹冠底半徑的一半」，林子的密度幾乎不變，只拿掉擠成一團的
    const SP = new Map(), crowded = (X, Z, q0) => { const gx = Math.floor(X / 4), gz = Math.floor(Z / 4); for (let a = -1; a <= 1; a++) for (let b = -1; b <= 1; b++) { const l = SP.get((gx + a) + ',' + (gz + b)); if (l) for (const q of l) if (Math.hypot(X - q[0], Z - q[1]) < q0 + q[2]) return true; } return false; };
    for (let i = 0; i < tries; i++) {
      const x = -66 - rd() * 98, z = (rd() - .5) * 300, k = rd(), r1 = rd(), r2 = rd(), r3 = rd(); if (veto(x, z)) continue;
      const g = dens(x, z); if (r1 > g) continue;
      const X = x * K, Z = z * K, h = H(X, Z), sl = Math.abs(H(X + 1, Z) - H(X - 1, Z)) + Math.abs(H(X, Z + 1) - H(X, Z - 1)); if (h < -.2 || h > 24 * K || sl > 1.25) continue;
      const dT = Math.hypot(x - TOWER[0], z - TOWER[1]);
      let type = k < .6 ? 'pine' : k < .8 ? 'bush' : k < .93 ? 'rock' : 'ice';
      if (z > 38) type = k < .76 ? 'pine' : k < .94 ? 'bush' : 'rock';
      if (dT < 30) type = k < .45 ? 'pine' : k < .62 ? 'bush' : k < .76 ? 'rock' : 'ice';
      if (z < -50) type = k < .3 ? 'pine' : k < .62 ? 'rock' : k < .85 ? 'ice' : 'bush';
      if (type === 'pine' && g < .5 && r2 < .3) type = 'bush'; // 林子邊緣多一些矮雪叢
      if (type === 'pine' && sl > .9) type = 'rock';
      const s = (.72 + r3 * .8) * (type === 'pine' ? .85 + .35 * g : 1), o = { x: X, y: h - .12 - sl * .3, z: Z, s, ry: r2 * 6.28 };
      { const v = .84 + rd() * .26, w = (rd() - .5) * .1; o.c = new THREE.Color(v * (1 + w), v, v * (1 - w * 1.6)); }
      if (type === 'pine' || type === 'rock') { // 間距檢查放在顏色的亂數之後：被擋掉的那棵不影響後面每一棵的亂數（其餘的位置、大小、顏色都和原本一樣）
        o.sy = (type === 'pine' ? .92 : .8) + r1 * .5; const r = type === 'pine' ? pineR(s, o.sy, sl) : .7 * s + .05, q0 = (type === 'pine' ? .575 : .5) * s; if (crowded(X, Z, q0)) continue;
        const kk = Math.floor(X / 4) + ',' + Math.floor(Z / 4); if (!SP.has(kk)) SP.set(kk, []); SP.get(kk).push([X, Z, q0]);
        addCol(type === 'pine' ? { x: X, z: Z, r, k: 'prop', tree: 1 } : { x: X, z: Z, r, k: 'prop' });
      }
      L[type].push(o);
    }
    // LOW（手機、不投影）：近處也用低面數版本、不分遠近兩組（近處的區塊每種植被少一次繪製，三角形也少很多）
    const GL0 = vegGeo(true), G = LOW ? GL0 : vegGeo(false), flatM = new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: .85, metalness: 0 }), o = k => LOW ? {} : { lo: GL0[k] };
    scatter(G.pine, windMat(new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: .85, metalness: 0 }), .0045), L.pine, true, o('pine'));
    scatter(G.bush, flatM, L.bush, true, o('bush')); scatter(G.rock, rockMat(), L.rock, true, o('rock'));
    return L; // 冰晶不另外用一種材質撒（每個區塊多一次繪製）：併進場景零件的冰材質（見 crystals）
  }

  // 冰晶：一叢四根，和小河、冰河同一種冰材質（夜裡朝上的面映著極光）
  function crystals(kt, IC, list) {
    const rr = seeded(5151), ig = mergeParts([0, 1, 2, 3].map(i => [new THREE.OctahedronGeometry(.4), ['#bae6fd', '#d4f0fe', '#a5dcf8', '#c7eafc'][i], M4(Math.cos(i * 1.6) * .3, .5, Math.sin(i * 1.6) * .3, (rr() - .5) * .8, i, (rr() - .5) * .8, .5, 1.5 + i * .25, .5)]));
    for (const o of list) kt.add(IC, ig, null, M4(o.x, o.y, o.z, 0, o.ry, 0, o.s));
  }

  /* ---------- 材質 ---------- */
  // 不透明的冰（冰河、小河、水窪、冰橋）：夜裡朝上的冰面映著極光的顏色（綠到紫的光帶慢慢飄過），不加光源
  function iceMat() {
    const m = new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: .16, metalness: .04, envMapIntensity: 1.25 });
    m.onBeforeCompile = sh => {
      sh.uniforms.uNight = NIGHT_U; sh.uniforms.uT = W.wind;
      sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vAW;').replace('#include <begin_vertex>', '#include <begin_vertex>\nvAW = (modelMatrix * vec4(transformed, 1.0)).xyz;');
      sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nuniform float uNight;\nuniform float uT;\nvarying vec3 vAW;')
        .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
          { vec3 aN = inverseTransformDirection(normal, viewMatrix); float aB = sin(vAW.x * 0.045 + vAW.z * 0.02 + uT * 0.12) * 0.5 + 0.5;
            float aS = smoothstep(0.35, 0.95, sin(vAW.z * 0.07 - vAW.x * 0.025 + uT * 0.2 + aB * 2.0) * 0.5 + 0.5);
            totalEmissiveRadiance += mix(vec3(0.2, 0.95, 0.65), vec3(0.62, 0.45, 1.0), aB) * aS * uNight * 0.34 * smoothstep(0.5, 0.9, aN.y); }`);
    };
    m.customProgramCacheKey = () => 'snowIce'; m.userData.shadow = false; return m;
  }

  /* ---------- 幾何小工具 ---------- */
  // 曲面：rows[i][j] = [x, y, z, r, g, b]（世界座標），相鄰兩列之間鋪三角形；每個三角形都朝上（法線朝下就翻面）
  function surf(rows) {
    const pos = [], col = [];
    const tri = (a, b, c) => { if ((b[2] - a[2]) * (c[0] - a[0]) - (b[0] - a[0]) * (c[2] - a[2]) < 0) { const t = b; b = c; c = t; } for (const q of [a, b, c]) { pos.push(q[0], q[1], q[2]); col.push(q[3], q[4], q[5]); } };
    for (let i = 0; i < rows.length - 1; i++) for (let j = 0; j < rows[i].length - 1; j++) { const A = rows[i][j], B = rows[i][j + 1], C = rows[i + 1][j], D = rows[i + 1][j + 1]; tri(A, B, C); tri(C, B, D); }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3)); return g;
  }
  // 不一定朝上的曲面（雪簷、冰拱、岩壁頂的雪唇）：rows[i][j] = [x, y, z, r, g, b]，ins[i]＝這一列「裡面」的一點，每個三角形都朝外（背對 ins）
  function band(rows, ins) {
    const pos = [], col = [];
    const tri = (a, b, c, o) => { const ux = b[0] - a[0], uy = b[1] - a[1], uz = b[2] - a[2], vx = c[0] - a[0], vy = c[1] - a[1], vz = c[2] - a[2], nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
      if (nx * (a[0] + b[0] + c[0] - 3 * o[0]) + ny * (a[1] + b[1] + c[1] - 3 * o[1]) + nz * (a[2] + b[2] + c[2] - 3 * o[2]) < 0) { const t = b; b = c; c = t; }
      for (const q of [a, b, c]) { pos.push(q[0], q[1], q[2]); col.push(q[3], q[4], q[5]); } };
    for (let i = 0; i < rows.length - 1; i++) { const o = ins[i].map((v, k) => (v + ins[i + 1][k]) / 2); for (let j = 0; j < rows[i].length - 1; j++) { const A = rows[i][j], B = rows[i][j + 1], C = rows[i + 1][j], D = rows[i + 1][j + 1]; tri(A, B, C, o); tri(C, B, D, o); } }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3)); return g;
  }
  // 沿著折線（基礎單位）鋪一條冰帶：橫向 offs（基礎單位）、離地 lift(o)、顏色 colf(o, s)
  function ribbon(pts, offs, lift, colf) {
    const rows = [], c = new THREE.Color();
    for (let i = 0; i < pts.length; i++) {
      const p = pts[i], q = pts[Math.min(pts.length - 1, i + 1)], o = pts[Math.max(0, i - 1)], tx = q[0] - o[0], tz = q[1] - o[1], tl = Math.hypot(tx, tz) || 1, nx = -tz / tl, nz = tx / tl;
      rows.push(offs.map(f => { const X = (p[0] + nx * f) * K, Z = (p[1] + nz * f) * K; colf(f, i / (pts.length - 1), c); return [X, H(X, Z) + lift(f), Z, c.r, c.g, c.b]; }));
    }
    return surf(rows);
  }
  const ROCKC = ['#8d99aa', '#7f8c9e', '#9aa6b5', '#86929f'];
  // 一顆積雪的石頭（世界座標）
  function snowRock(kt, M, X, Z, s, seed, rdm, cap = true) {
    const y = H(X, Z); kt.add(M.flat, rk(seed), ROCKC[seed % 4], M4(X, y + s * .15, Z, rdm() * .5, rdm() * 6, 0, s * (1 + rdm() * .4), s * (.55 + rdm() * .3), s));
    if (cap) kt.add(M.flat, new THREE.SphereGeometry(s * .85, 7, 3, 0, PI2, 0, Math.PI / 2), '#f8fafc', M4(X, y + s * .42, Z, 0, rdm() * 6, 0, 1.05, .38, .95));
  }
  // 冰晶花：一撮細細的冰晶（夜裡發光的材質），n 朵散在半徑 r 公尺內；四角、不封口（這麼細看不出差別，三角形只要三分之一）
  const FLOWER_C = ['#a5f3fc', '#c4b5fd', '#e0f2fe', '#99f6e4'];
  function flowers(kt, mat, X, Z, n, rdm, r = 1.3) {
    for (let i = 0; i < n; i++) {
      const a = rdm() * PI2, d = Math.sqrt(rdm()) * r, x = X + Math.cos(a) * d, z = Z + Math.sin(a) * d, y = H(x, z) - .03, k = 3 + Math.floor(rdm() * 3), s = .7 + rdm() * .6, c = FLOWER_C[(i + Math.floor(rdm() * 2)) % 4];
      for (let j = 0; j < k; j++) {
        const h = (.2 + rdm() * .22) * s, m = M4(x, y, z, 0, j / k * PI2 + rdm(), .18 + rdm() * .4);
        kt.add(mat, new THREE.CylinderGeometry(.026, .042, h, 4, 1, true).translate(0, h / 2, 0), c, m); kt.add(mat, new THREE.ConeGeometry(.026, .08, 4, 1, true).translate(0, h + .04, 0), '#f0fdff', m);
      }
    }
  }

  /* ---------- 北：冰河 ---------- */
  const gPt = (u, vn) => { const uu = Math.max(0, u), v = 2.2 * Math.sin(uu * .09) * sm(0, 8, uu) + vn * GW(uu); return [GLA.x + u * GLA.dx - v * GLA.dz, GLA.z + u * GLA.dz + v * GLA.dx]; };
  function glacierScene(kt, M, IC, GLOW, rdm) {
    // 冰舌：沿冰河鋪一層冰（頂點取樣地形高度＋0.1），邊緣與冰崖腳塞進地面以下，不會有浮在空中的邊；
    // 顏色：越陡越藍、冰崖前緣最藍，上游一塊塊白色的積雪
    const NU = LOW ? 26 : 40, NV = LOW ? 12 : 18, U0 = -2.3, U1 = 37, rows = [], c = new THREE.Color(), cT = new THREE.Color('#e1f2fc'), cB = new THREE.Color('#a6d6f2'), cD = new THREE.Color('#78bce8'), cS = new THREE.Color('#f7fbfe');
    for (let i = 0; i <= NU; i++) {
      const u = U0 + (U1 - U0) * i / NU, row = [];
      for (let j = 0; j <= NV; j++) {
        const vn = (j / NV * 2 - 1) * 1.04, [x, z] = gPt(u, vn), X = x * K, Z = z * K, edge = j === 0 || j === NV || i === 0, sl = Math.abs(H(X + .8, Z) - H(X - .8, Z)) + Math.abs(H(X, Z + .8) - H(X, Z - .8));
        c.copy(cT).lerp(cB, c01(sl * .5) * .9 + (1 - Math.abs(vn)) * .06).lerp(cD, u < .4 ? .6 : 0).lerp(cS, sm(.56, .66, vnoise(x * .22, z * .22, 83)) * sm(4, 9, u) * .85).multiplyScalar(.95 + .1 * vnoise(x * .4, z * .4, 81));
        row.push([X, H(X, Z) + (edge ? -.35 : .1), Z, c.r, c.g, c.b]);
      }
      rows.push(row);
    }
    kt.add(IC, surf(rows), null);
    // 冰裂縫：橫過冰舌的一道道深藍裂口（中間深、兩邊翹起淡藍的冰唇），越往上游越密；冰崖前面幾道縱向的裂口
    const CRV = [[3.8, -.5, .42], [6.4, -.74, .1], [7.1, .28, .76], [9.6, -.62, .58], [12.2, -.8, .02], [12.9, .16, .74], [15.4, -.55, .6], [18.2, -.75, .3], [18.9, .34, .7], [21.6, -.6, .62], [24.6, -.72, .2], [25.3, .25, .66], [28.4, -.55, .5], [31.4, -.6, .44]];
    const lip = new THREE.Color('#d6eefc'), deep = new THREE.Color('#1f5f8f'), crack = (pts, wmax, along) => { // along：裂口順著流向（寬度改在橫向）
      const rr = pts.map(([u, vn], k) => { const w = .06 + wmax * Math.sin(Math.PI * k / (pts.length - 1)); return [-w, 0, w].map((o, j) => { const [x, z] = along ? gPt(u, vn + o / GW(u)) : gPt(u + o, vn), X = x * K, Z = z * K, cc = j === 1 ? deep : lip; return [X, H(X, Z) + (j === 1 ? .11 : .18), Z, cc.r, cc.g, cc.b]; }); });
      kt.add(IC, surf(rr), null);
    };
    CRV.forEach(([u0, a, b], ci) => crack(Array.from({ length: 11 }, (_, k) => { const vn = a + (b - a) * k / 10; return [u0 + 1.3 * (1 - vn * vn) + .25 * Math.sin(k * 1.7 + ci), vn]; }), .38));
    [[-.62, .8], [-.3, 1], [.36, .9], [.66, .7]].forEach(([vn, du]) => crack(Array.from({ length: 6 }, (_, k) => [.5 + k * du, vn + Math.sin(k * 1.3) * .03]), .2, true)); // 冰崖前面縱向的裂口
    // 冰崖前緣：一排傾斜、大小不一的冰塊（中間留給冰洞口）；中段的冰瀑：冰面碎成一塊塊的冰塔
    for (let i = 0; i < (LOW ? 9 : 15); i++) {
      const vn0 = -.95 + 1.9 * (i + rdm() * .5) / (LOW ? 9 : 15); if (Math.abs(vn0) < .24) continue;
      const vn = Math.sign(vn0) * (.44 + (Math.abs(vn0) - .24) * .72); // 往兩邊擠：中間讓出冰洞的凹槽（亂數的取法不變，後面的零件位置都不動）
      const [x, z] = gPt(-.6 + rdm() * 1.6, vn), X = x * K, Z = z * K, s = 1.1 + rdm() * 1.4;
      kt.add(IC, jit(new THREE.BoxGeometry(1.4, 2.2, 1.3, 2, 2, 2), .25, 900 + i), ['#d9f0fd', '#b4e0f8', '#9dd3f4'][i % 3], M4(X, H(X, Z) + .5 * s, Z, (rdm() - .5) * .5, rdm() * 3, (rdm() - .5) * .5, s, s * (.8 + rdm() * .6), s));
    }
    for (let i = 0; i < (LOW ? 8 : 16); i++) {
      const [x, z] = gPt(13 + rdm() * 8, (rdm() * 2 - 1) * .8), X = x * K, Z = z * K, s = .8 + rdm() * 1;
      kt.add(IC, jit(new THREE.BoxGeometry(1.5, 1.8, 1.4, 2, 2, 2), .3, 940 + i), ['#e6f5fe', '#c2e6f9'][i % 2], M4(X, H(X, Z) + .35 * s, Z, (rdm() - .5) * .6, rdm() * 3, (rdm() - .5) * .6, s * 1.2, s, s));
    }
    // 冰洞口：融水從冰崖腳的冰洞裡流出來。拱正對冰崖面、立在凹槽口（地形見 caveNotch），拱頂積著雪、垂著冰柱；
    // 拱裡是往冰崖裡凹進去的洞壁（鏡像的四分之一球，只畫內壁）：洞口淺藍、越裡面越深，最裡面一個更暗的洞口往裡延伸；外面蓋一個冰的圓頂，把凹槽的頂蓋住
    { const X = CAVM.x * K, Z = CAVM.z * K, ry = Math.atan2(CAVM.nx, CAVM.nz), a = kt.at(X, Z, 0, ry, CAVM.fl * K - .25);
      a(IC, new THREE.TorusGeometry(3, .8, 6, 16, Math.PI), '#b4e0f8', 0, 0, 0, 0, 0, 0, 1, 1.05, 1.3);
      a(M.flat, new THREE.TorusGeometry(3, .55, 5, 16, Math.PI * .6), '#f8fafc', 0, .45, 0, 0, 0, Math.PI * .2, 1, 1.05, 1.1);
      const wall = new THREE.SphereGeometry(1, 14, 7, 0, Math.PI, 0, Math.PI / 2), wp = wall.attributes.position, wc = new Float32Array(wp.count * 3), c0 = new THREE.Color('#7fc3ec'), c1 = new THREE.Color('#2a6ca3'), c2 = new THREE.Color('#0d2c47'), cc = new THREE.Color();
      for (let i = 0; i < wp.count; i++) { cc.copy(c0).lerp(c1, sm(.05, .55, wp.getZ(i))).lerp(c2, sm(.5, .95, wp.getZ(i)) * (1 - .3 * wp.getY(i))); wc[i * 3] = cc.r; wc[i * 3 + 1] = cc.g; wc[i * 3 + 2] = cc.b; }
      wall.setAttribute('color', new THREE.Float32BufferAttribute(wc, 3)); a(M.flat, wall, null, 0, .2, .3, 0, 0, 0, 2.05, 2.25, -2.7); // z 縮放取負號：往冰崖裡、而且鏡像後只看得到內壁
      a(M.flat, new THREE.CircleGeometry(1, 14, 0, Math.PI), '#071a2b', .15, .2, -2.25, 0, 0, 0, .95, 1.25, 1); // 最裡面往裡延伸的暗洞
      a(IC, new THREE.SphereGeometry(1, 12, 6, 0, Math.PI, 0, Math.PI / 2), '#a3d8f5', 0, -.15, .2, 0, Math.PI, 0, 3.7, 3.05, 4.1); // 外面的冰圓頂（從冰河上面看是一個冰包，洞壁從外面看不見）
      for (let k = 0; k < 8; k++) { const th = (k + .5) / 8 * Math.PI, l = .4 + (k % 3) * .25; a(IC, new THREE.ConeGeometry(.1, l, 5), '#e6f7ff', Math.cos(th) * 2.25, Math.sin(th) * 2.25 * 1.05 - l / 2, .1, Math.PI, 0, 0); }
      const tx = CAVM.nz, tz = -CAVM.nx; addCol({ x: X - CAVM.nx * .5, z: Z - CAVM.nz * .5, r: 2.05 }); [-1, 1].forEach(sd => addCol({ x: X + tx * 3 * sd, z: Z + tz * 3 * sd, r: .85 })); } // 站在拱前面看得到洞裡，走不進去
    // 兩側與前緣的冰磧：一叢一叢、大小不一的積雪石頭（不是排成一列）
    for (let g = 0; g < (LOW ? 8 : 14); g++) {
      const side = g % 2 ? 1 : -1, u0 = -1 + rdm() * 24, n = 2 + Math.floor(rdm() * 3);
      for (let i = 0; i < n; i++) { const u = u0 + (rdm() - .5) * 3, uu = Math.max(0, u), vn = side * (1 + (1.6 + (rdm() - .3) * 1.6) / GW(uu)), [x, z] = gPt(u, vn); snowRock(kt, M, x * K, z * K, .5 + rdm() * (i ? .6 : 1.1), 1000 + g * 4 + i, rdm, rdm() < .75); }
    }
    for (let i = 0; i < (LOW ? 6 : 10); i++) { const [x, z] = gPt(-6 + (rdm() - .5) * 1.5, (rdm() * 2 - 1) * 1.2); if (near(TR.stream, x, z, 3).d < 2.4) continue; snowRock(kt, M, x * K, z * K, .45 + rdm() * .8, 1100 + i, rdm); }
    // 融水結成的小河：從冰洞口流到冰湖（中間透藍、兩岸結著白霜）
    const sp = crPts(STREAM, 6), cA = new THREE.Color('#9fd2f0'), cE = new THREE.Color('#e4f3fc');
    kt.add(IC, ribbon(sp, [-1, -.5, 0, .5, 1], f => Math.abs(f) > .9 ? .03 : .07, (f, s, cc) => cc.copy(cA).lerp(cE, Math.abs(f) ** 1.5).multiplyScalar(.96 + .08 * Math.sin(s * 40))), null);
    // 警告牌（字在 signs() 的貼圖上）、河邊的冰晶花
    { const X = -142.8 * K, Z = -72.6 * K, a = kt.at(X, Z, 0, Math.PI / 2 - .25); a(M.flat, new THREE.CylinderGeometry(.06, .07, 1.7, 6), '#6b4d33', 0, .85, -.08); a(M.flat, new THREE.BoxGeometry(1.16, .62, .06), '#7d5c3a', 0, 1.35, 0); a(M.flat, new THREE.BoxGeometry(1.24, .1, .2), '#f8fafc', 0, 1.71, 0); addCol({ x: X, z: Z, r: .2 }); SIGNS.push({ X, Z, y: H(X, Z) + 1.35, ry: Math.PI / 2 - .25, w: 1.06, h: .53, uv: [0, 640, 512, 896], off: .045 }); }
    flowers(kt, GLOW, -141.6 * K, -66.2 * K, LOW ? 5 : 9, rdm); flowers(kt, GLOW, -140 * K, -58.8 * K, LOW ? 4 : 7, rdm);
  }

  /* ---------- 北：風吹雪丘、風蝕蘑菇岩、歪樹上的貓頭鷹 ---------- */
  function duneScene(kt, M, IC, GLOW, rdm) {
    const RW = -WIND; // 繞 y 轉 RW 之後，局部的 +x 就是順風的方向（風往 (cos WIND, sin WIND) 吹）
    // 風蝕蘑菇岩：底座被風削細，頂上一大塊帽岩頂著雪；背風面拖著一條長長的雪尾巴
    { const X = MUSH.x * K, Z = MUSH.z * K, a = kt.at(X, Z, -.2, RW);
      a(M.flat, rk(1200), '#7f8c9e', 0, .3, 0, 0, 0, 0, 1.7, .8, 1.5);
      a(M.flat, jit(new THREE.CylinderGeometry(.62, .95, 1.6, 7, 2), .14, 1201), '#8b97a7', 0, 1.3, 0); a(M.flat, jit(new THREE.CylinderGeometry(1.05, .6, 1.1, 7, 1), .14, 1202), '#768293', 0, 2.55, 0);
      a(M.flat, rk(1203, 1), '#7b8796', 0, 3.4, 0, .15, .4, 0, 2.6, .95, 2.3); a(M.flat, new THREE.SphereGeometry(2.35, 10, 4, 0, PI2, 0, Math.PI / 2), '#f8fafc', 0, 3.85, 0, 0, 0, 0, 1.05, .32, 1);
      a(M.flat, new THREE.SphereGeometry(1, 10, 4, 0, PI2, 0, Math.PI / 2), '#eef4fa', 3.2, -.05, 0, 0, 0, 0, 3.6, .55, 1.3); // 背風面的雪尾巴（風往 +x 吹）
      addCol({ x: X, z: Z, r: 1.5 }); }
    // 被風吹歪的雪松，樹枝上蹲著一隻打瞌睡的小貓頭鷹（頭另外做，會轉過來看你）
    { const X = OWL.x * K, Z = OWL.z * K, y = H(X, Z) - .1, a = kt.at(X, Z, 0, RW, y);
      a(M.flat, new THREE.CylinderGeometry(.12, .22, 2.4, 7), '#5b4030', 0, 1.1, 0, 0, 0, -.28);
      [[1.3, 2.3, .35], [1.0, 2.9, .5], [.75, 3.4, .65]].forEach(([r, yy, ox], i) => { a(M.flat, jit(new THREE.ConeGeometry(r, 1.3, 8, 2), .2, 1210 + i), i % 2 ? '#356a52' : '#2c5a46', ox, yy, 0, 0, 0, -.32, 1.25, 1, .9); a(M.flat, new THREE.ConeGeometry(r * .82, .5, 8), '#f8fafc', ox - .12, yy + .42, 0, 0, 0, -.32, 1.15, 1, .85); });
      a(M.flat, new THREE.CylinderGeometry(.045, .07, 1.2, 5), '#5b4030', -.55, 1.95, .1, 0, 0, 1.25); // 往上風伸出的樹枝（貓頭鷹站在這裡）
      addCol({ x: X, z: Z, r: .3, tree: 1 });
      const bp = new THREE.Vector3(-1.05, 2.12, .1).applyAxisAngle(new THREE.Vector3(0, 1, 0), RW), bx = X + bp.x, bz = Z + bp.z, by = y + bp.y, face = Math.atan2(MESA.x - OWL.x, MESA.z - OWL.z); // 面向台地（大家從那邊走過來）
      const b = kt.at(bx, bz, 0, face, by);
      b(M.flat, new THREE.SphereGeometry(.17, 10, 8), '#f1ede4', 0, .16, 0, 0, 0, 0, 1, 1.15, .95); b(M.flat, new THREE.SphereGeometry(.1, 8, 6), '#d8cfc0', 0, .12, .08, 0, 0, 0, 1.1, 1.3, .6);
      [-1, 1].forEach(s => b(M.flat, new THREE.SphereGeometry(.09, 8, 6), '#d6cbbb', s * .14, .16, -.02, 0, 0, 0, .55, 1.2, 1)); // 翅膀
      [-1, 1].forEach(s => b(M.flat, new THREE.ConeGeometry(.025, .07, 4), '#f59e0b', s * .05, .0, .08, .3, 0, 0)); // 爪子
      const head = new THREE.Mesh(nookMerge([[new THREE.SphereGeometry(.15, 10, 8), '#f4f0e8'], ...[-1, 1].flatMap(s => [[new THREE.SphereGeometry(.052, 8, 6), '#ffffff', M4(s * .062, .02, .12, 0, 0, 0, 1, 1, .5)], [new THREE.TorusGeometry(.03, .009, 4, 10, Math.PI), '#1f2937', M4(s * .062, .018, .148, 0, 0, Math.PI)], [new THREE.ConeGeometry(.035, .1, 4), '#e8e1d4', M4(s * .085, .15, 0, 0, 0, -s * .35)]]), [new THREE.ConeGeometry(.022, .06, 4), '#f59e0b', M4(0, -.015, .15, Math.PI / 2 + .3, 0, 0)]], true), M.flat);
      head.position.set(bx, by + .43, bz); head.rotation.y = face; chunkObj(head, 45, false, [bx, bz, 1]); OWLH.m = head; OWLH.x = bx; OWLH.y = by + .43; OWLH.z = bz; OWLH.base = face; }
    const dunesOK = (x, z) => !(Math.abs(z) > -x - 14 || duneW(x, z) < .55 || glac(x, z).w > 0 || glac(x, z).m > .2 || near(TR.stream, x, z, 4).d < 3.5 || Math.hypot(x - MESA.x, z - MESA.z) < mesaR(Math.atan2(z - MESA.z, x - MESA.x)) + 4 || Math.hypot(x - MUSH.x, z - MUSH.z) < 3.5 || Math.hypot(x - OWL.x, z - OWL.z) < 2);
    // 一道道雪丘的稜線與谷底：第 k 道、frac（0＝谷底、CREST＝稜線）、沿稜線的座標 c → 基礎單位的 [x, z]（稜線隨雜訊彎，用迭代找回來）
    const duneAt = (k, frac, c) => { let x = 0, z = 0; for (let it = 0, s = (k + frac) * DUNE_L; it < 4; it++) { x = s * CW - c * SW; z = s * SW + c * CW; s = (k + frac) * DUNE_L - duneWarp(x, z, c); } return [x, z]; };
    const UX = -CW * K, UZ = -SW * K, hAt = (x, z, o) => H(x * K - UX * o, z * K - UZ * o); // o＞0＝往下風（背風面）走 o 個基礎單位
    // 雪簷：沿著每一道稜線連續的一條（不是一段一段擺），迎風面平順接上稜線、背風面翹出一圈雪唇，雪唇底下是一條背光的藍影：
    // 從冰河、冰湖那邊往東看，一道道稜線就是一條條彎彎的影子；只在地形網格真的有稜線的地方做（稜線比背風面高出 0.3 公尺以上）
    // 顏色貼近地形的雪色（太白的話從上面看像一條路），只有雪唇的邊與底下的影子跳出來
    const cS = new THREE.Color('#dfe8f2'), cC = new THREE.Color('#e8eef6'), cL = new THREE.Color('#d6e1ee'), cU = new THREE.Color('#a9bfd8'), DC = LOW ? 1.6 : 1.05;
    const PROF = [[-1, .03, 0, cS], [-.45, .11, 0, cS], [0, .22, 1, cC], [.55, .17, 1, cC], [.95, -.05, 1, cL], [.8, -.32, 1, cU], [.42, -.28, 0, cU]]; // [往下風幾單位, 高, 0＝貼地形／1＝對稜線高, 顏色]
    for (let k = 5; k <= 10; k++) {
      let run = [];
      const flush = () => { if (run.length >= 4) kt.add(M.flat, band(run.map(r => r.row), run.map(r => r.in)), null); run = []; };
      for (let c = 0; c <= 116; c += DC) {
        const [x, z] = duneAt(k, CREST, c);
        if (x > -90 || x < -156 || !dunesOK(x, z) || duneW(x, z) < .6) { flush(); continue; }
        const hc = Math.max(hAt(x, z, -.4), hAt(x, z, 0), hAt(x, z, .3));
        if (hc - hAt(x, z, 1.3) < .3 || hc - hAt(x, z, -1.8) < .05) { flush(); continue; }
        run.push({ row: PROF.map(([o, dy, rel, col]) => [x * K - UX * o, (rel ? hc : hAt(x, z, o)) + dy, z * K - UZ * o, col.r, col.g, col.b]), in: [x * K - UX * .3, hc - .5, z * K - UZ * .3] });
      }
      flush();
    }
    // 谷底的風蝕冰面：風把谷底的雪吹走，露出一片片磨亮的藍冰（從台地往下看，白色的稜線和藍色的谷底一道一道交錯；夜裡映著極光）
    const gA = new THREE.Color('#aad4f0'), gE = new THREE.Color('#d3e6f5');
    for (let k = 6; k <= 11; k++) {
      let rows = [];
      const flush = () => { if (rows.length >= 3) kt.add(IC, surf(rows), null); rows = []; };
      for (let c = 0; c <= 116; c += DC * 1.2) {
        const [x, z] = duneAt(k, 0, c), pn = vnoise(c * .09, k * 3.1, 93);
        if (x > -92 || x < -154 || !dunesOK(x, z) || duneW(x, z) < .75 || pn < .42 || hAt(x, z, 4) - hAt(x, z, 0) < .35) { flush(); continue; }
        const w = .5 + 1.9 * sm(.42, .66, pn); // 兩端收窄成尖尖的一片
        rows.push([0, .12, .5, .85, 1].map((f, j) => { const o = f * w - .35, X = x * K - UX * o, Z = z * K - UZ * o, cc = j === 0 || j === 4 ? gE : gA, e = .96 + .06 * Math.sin(c * 2.3 + j); return [X, H(X, Z) + (j === 0 || j === 4 ? .025 : .05), Z, cc.r * e, cc.g * e, cc.b * e]; }));
      }
      flush();
    }
    flowers(kt, GLOW, (MUSH.x + 2.6) * K, (MUSH.z - 3) * K, LOW ? 4 : 7, rdm, 1.1);
  }
  // 雪丘的地面顏色：谷底與背風面是一道藍紫的影子，迎風面往稜線慢慢變白。照亮的白雪明暗差很小，而從台地、從迎風面看過去背風面都藏在稜線後面，
  // 只靠光影的話整片就是平滑的白坡（只有往東南東看才分得出來）；先把影子染進地面，任何方向看過去都是一道白、一道藍交錯。只改地形網格的頂點色：不多繪製、不多三角形
  function duneTint() {
    const g = W.terrain && W.terrain[0] && W.terrain[0].geometry; if (!g || !g.attributes.color) return;
    // 頂點色是線性空間，照亮的雪又被色調映射壓在最亮的那一段：要減這麼多才看得出來（最深處 sRGB 約 #a9bde4，偏藍紫、不灰不髒）
    const p = g.attributes.position, col = g.attributes.color, SH = [.62, .5, .19], TRO = .88, LEE = .62;
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i) / K, z = p.getZ(i) / K; if (z > -50 || x > -87 || x < -158) continue;
      let w = duneW(x, z); if (w <= .01) continue;
      const gl = glac(x, z); w *= (1 - gl.w) * (1 - sm(.15, .6, gl.m)) * sm(0, 9, -x - 12 - Math.abs(z)); // 冰河、冰磧、區域邊界：沒有雪丘
      const md = Math.hypot(x - MESA.x, z - MESA.z); if (md < 20) w *= sm(mesaR(Math.atan2(z - MESA.z, x - MESA.x)) + 1.2, mesaR(Math.atan2(z - MESA.z, x - MESA.x)) + 3.5, md); // 台地的斷崖與碎石坡
      w *= sm(4, 7, segD(x, z, RAMP.ax, RAMP.az, RAMP.bx, RAMP.bz)) * sm(1.6, 4, near(TR.stream, x, z, 5).d); // 雪坡、融水小河
      for (const [kx, kz, r0, r1] of KEEP) { const d = Math.hypot(x - kx, z - kz); if (d < r1) w *= sm(r0, r1, d); }
      if (w < .02) continue;
      const { t, a } = duneT(x, z);
      // 影子：谷底最深，沿著整個迎風面一路淡到稜線（從台地、從迎風面看過去，稜線後面露出來的是下一道迎風面的中上段，只染谷底的話根本看不到）；
      // 背風的陡坡本來就背光，染淡一點（從背風面看過去才不會整片深藍）
      const s = (t < CREST ? TRO * Math.pow(1 - t / CREST, .6) : sm(CREST, CREST + .035, t) * (LEE + (TRO - LEE) * (t - CREST) / (1 - CREST))) * w * (.55 + .45 * a / 2.6);
      if (s < .005) continue;
      col.setXYZ(i, col.getX(i) * (1 - SH[0] * s), col.getY(i) * (1 - SH[1] * s), col.getZ(i) * (1 - SH[2] * s));
    }
    col.needsUpdate = true;
  }

  /* ---------- 中：觀景台地、路口的導覽圖、小徑的雪地標竿、冰晶塔旁的冰晶花 ---------- */
  function mesaScene(kt, M, GLOW, rdm) {
    const P = (x, z) => [x * K, z * K];
    // 石堆（最上面插著一面小紅旗）
    { const [X, Z] = P(-107.6, -43.6), y = H(X, Z); let yy = y; [[.75, .32], [.62, .3], [.5, .27], [.4, .24], [.3, .2], [.22, .16]].forEach(([r, hh], i) => { kt.add(M.flat, rk(1300 + i), ROCKC[i % 4], M4(X + (rdm() - .5) * .1, yy + hh * .5, Z + (rdm() - .5) * .1, 0, rdm() * 6, 0, r, hh, r * .9)); yy += hh * .82; });
      kt.seg(M.flat, new THREE.Vector3(X, yy - .1, Z), new THREE.Vector3(X + .03, yy + .9, Z), .018, '#6b4d33', 5); kt.add(M.flat, new THREE.ConeGeometry(.16, .34, 3), '#ef4444', M4(X + .03, yy + .72, Z + .17, Math.PI / 2, 0, 0, 1, 1, .2)); addCol({ x: X, z: Z, r: .75 }); }
    // 長椅（面向西邊：冰河、冰湖、冰晶塔都在眼前）＋一盞小提燈
    { const [X, Z] = P(-106.3, -39.4), a = kt.at(X, Z, 0, -Math.PI / 2);
      a(M.flat, new THREE.BoxGeometry(1.7, .08, .48), '#a07850', 0, .48, 0); a(M.flat, new THREE.BoxGeometry(1.7, .42, .06), '#8b6544', 0, .8, .23, .15, 0, 0); [-.7, .7].forEach(x => { a(M.flat, new THREE.BoxGeometry(.08, .48, .42), '#5b4030', x, .24, 0); a(M.flat, new THREE.BoxGeometry(.08, .52, .06), '#5b4030', x, .72, .24, .15, 0, 0); });
      a(M.flat, new THREE.BoxGeometry(1.74, .07, .52), '#f8fafc', 0, .555, 0); addCol({ x: X, z: Z, r: .85 });
      const [lx, lz] = P(-106, -37.8), b = kt.at(lx, lz); b(M.flat, new THREE.CylinderGeometry(.04, .05, 1.3, 6), '#334155', 0, .65, 0); b(M.flat, new THREE.BoxGeometry(.05, .05, .32), '#334155', 0, 1.27, .14); b(M.flat, new THREE.BoxGeometry(.22, .06, .22), '#1e293b', 0, 1.2, .3); b(M.lamp, new THREE.BoxGeometry(.15, .2, .15), '#ffd27a', 0, 1.06, .3); b(M.flat, new THREE.BoxGeometry(.2, .03, .2), '#1e293b', 0, .95, .3); addCol({ x: lx, z: lz, r: .15 }); }
    // 望遠鏡：對著冰河
    { const [X, Z] = P(-104.6, -47), y = H(X, Z), aim = Math.atan2(-150 * K - X, -77 * K - Z), a = kt.at(X, Z, 0, aim, y), top = new THREE.Vector3(X, y + 1.12, Z);
      [0, 2.1, 4.2].forEach(t => kt.seg(M.flat, new THREE.Vector3(X + Math.sin(t) * .42, y - .05, Z + Math.cos(t) * .42), top, .028, '#5b4030', 5, .02));
      a(M.flat, new THREE.CylinderGeometry(.07, .09, .75, 10), '#b45309', 0, 1.22, .05, Math.PI / 2 - .12, 0, 0); a(M.flat, new THREE.CylinderGeometry(.1, .1, .06, 10), '#facc15', 0, 1.25, .42, Math.PI / 2 - .12, 0, 0);
      addCol({ x: X, z: Z, r: .75 }); } // 鏡筒往前伸出 0.45 公尺、只比眼睛低 0.4：碰撞半徑 0.35 的話走過去鏡頭會貼上鏡筒（整個畫面一塊橘色）
    // 彩旗：兩根竿子之間一條垂下來的繩子，掛著一排三角旗
    { const A = new THREE.Vector3(-99.2 * K, 0, -47.6 * K), B = new THREE.Vector3(-96.6 * K, 0, -40.2 * K);
      A.y = H(A.x, A.z) + 2.4; B.y = H(B.x, B.z) + 2.4; [A, B].forEach(p => { kt.seg(M.flat, new THREE.Vector3(p.x, p.y - 2.45, p.z), new THREE.Vector3(p.x, p.y + .1, p.z), .05, '#6b4d33', 6); addCol({ x: p.x, z: p.z, r: .15 }); });
      const FC = ['#ef4444', '#facc15', '#38bdf8', '#22c55e', '#a855f7', '#f97316', '#ec4899', '#14b8a6', '#eab308'], N = 10, pts = [];
      for (let i = 0; i <= N; i++) { const f = i / N; pts.push(new THREE.Vector3().lerpVectors(A, B, f).add(new THREE.Vector3(0, -Math.sin(Math.PI * f) * .55, 0))); }
      for (let i = 0; i < N; i++) { kt.seg(M.flat, pts[i], pts[i + 1], .012, '#e2e8f0', 3); if (i === 0) continue; const p = pts[i], d = new THREE.Vector3().subVectors(pts[i + 1], pts[i - 1]); kt.add(M.flat, new THREE.ConeGeometry(.17, .42, 3), FC[i % FC.length], M4(p.x, p.y - .23, p.z, 0, Math.atan2(d.x, d.z) + Math.PI / 2, Math.PI, 1, 1, .15)); } }
    // 台地邊緣的雪石頭、頂上一棵小雪松
    for (let i = 0; i < (LOW ? 6 : 10); i++) { const a = rdm() * PI2, R = mesaR(a) - .9; if (Math.abs(wrapA(a - Math.atan2(RAMP.bz - MESA.z, RAMP.bx - MESA.x))) < .4) continue; const x = MESA.x + Math.cos(a) * R, z = MESA.z + Math.sin(a) * R; snowRock(kt, M, x * K, z * K, .35 + rdm() * .5, 1320 + i, rdm); }
    { const [X, Z] = P(-99.6, -36.8), a = kt.at(X, Z, -.1); a(M.flat, new THREE.CylinderGeometry(.08, .13, .9, 6), '#5b4030', 0, .45, 0); [[.8, 1.1, .95], [.6, .95, 1.5], [.42, .8, 1.95]].forEach(([r, h, y], i) => { a(M.flat, jit(new THREE.ConeGeometry(r, h, 8, 2), .2, 1330 + i), '#2c5a46', 0, y, 0); a(M.flat, new THREE.ConeGeometry(r * .8, h * .38, 8), '#f8fafc', 0, y + h * .3, 0); }); addCol({ x: X, z: Z, r: .5, tree: 1 }); }
    flowers(kt, GLOW, -104 * K, -36.4 * K, LOW ? 3 : 6, rdm, 1);
  }
  function centerScene(kt, M, GLOW, rdm) {
    // 路口的導覽圖：兩根柱子、木框、遮雨的小屋頂（積著雪）；圖面在 signs() 的貼圖上
    { const X = SIGN.x * K, Z = SIGN.z * K, ry = 1.91, a = kt.at(X, Z, -.05, ry);
      [-1.18, 1.18].forEach(x => { a(M.flat, new THREE.CylinderGeometry(.08, .1, 3.2, 7), '#5b4030', x, 1, -.2); addCol({ x: X + Math.cos(ry) * x, z: Z - Math.sin(ry) * x, r: .18 }); }); // 柱子往地下多埋 0.6 公尺：路口有一點坡
      a(M.flat, new THREE.BoxGeometry(2.42, 1.56, .08), '#6b4d33', 0, 1.58, -.06); a(M.flat, new THREE.BoxGeometry(2.8, .1, .7), '#4a3424', 0, 2.48, -.1, .1, 0, 0); a(M.flat, new THREE.BoxGeometry(2.82, .14, .66), '#f8fafc', 0, 2.58, -.12, .1, 0, 0);
      SIGNS.push({ X, Z, y: H(X, Z) - .05 + 1.58, ry, w: 2.3, h: 1.44, uv: [0, 0, 1024, 640], off: 0 });
      // 旁邊的雪燈：雪堆成的小燈籠，夜裡從洞口透出暖光
      const b = kt.at(X + Math.sin(ry) * .6 + Math.cos(ry) * 1.9, Z + Math.cos(ry) * .6 - Math.sin(ry) * 1.9, -.05, ry);
      b(M.flat, new THREE.SphereGeometry(.42, 9, 5, 0, PI2, 0, Math.PI / 2), '#f1f5f9', 0, 0, 0, 0, 0, 0, 1, 1.25, 1); b(M.flat, new THREE.SphereGeometry(.2, 8, 5), '#f8fafc', 0, .6, 0); b(M.lamp, new THREE.CircleGeometry(.13, 10), '#ffc970', 0, .24, .41); }
    // 小徑旁的雪地標竿：紅白相間，告訴你路在哪裡（洞口外 18 公尺之後才有）
    [[19, 1], [28, -1], [37, 1], [46, -1]].forEach(([arc, side]) => { const s = trailAt(5, arc, side, 2.9); if (!s) return; const a = kt.at(s.x, s.z, -.1, s.face); [0, 1, 2, 3].forEach(k => a(M.flat, new THREE.CylinderGeometry(.04, .045, .36, 6), k % 2 ? '#f8fafc' : '#dc2626', 0, .18 + k * .36, 0)); a(M.flat, new THREE.SphereGeometry(.16, 7, 4, 0, PI2, 0, Math.PI / 2), '#f8fafc', 0, -.02, 0, 0, 0, 0, 1, .5, 1); addCol({ x: s.x, z: s.z, r: .1 }); });
    // 冰晶塔腳下幾撮冰晶花
    [[2.2, 11], [3.3, 10.5], [4.4, 12.5], [5.4, 10]].forEach(([a, r]) => flowers(kt, GLOW, (TOWER[0] + Math.cos(a) * r / K) * K, (TOWER[1] + Math.sin(a) * r / K) * K, LOW ? 4 : 7, rdm, 1.4));
  }

  /* ---------- 南：結冰的小河、深谷與冰橋、小水窪 ---------- */
  function creekScene(kt, M, IC, GLOW, rdm) {
    const cp = crPts(CREEK, 6), cA = new THREE.Color('#9fd2f0'), cE = new THREE.Color('#e4f3fc');
    kt.add(IC, ribbon(cp, [-1.08, -.6, 0, .6, 1.08], f => Math.abs(f) > 1 ? .03 : .07, (f, s, c) => c.copy(cA).lerp(cE, Math.abs(f / 1.08) ** 1.5).multiplyScalar(.96 + .08 * Math.sin(s * 50))), null);
    // 小水窪：中心透藍、岸邊結白霜
    const PX = POND.x * K, PZ = POND.z * K, py = BED[1] * K + .05, pr = a => POND.r * K * (1.03 + .07 * Math.sin(3 * a + 1) + .04 * Math.sin(5 * a));
    kt.add(IC, nookDisc(PX, py, PZ, pr, ['#86c9ee', '#d6eefb'], LOW ? 24 : 36, 2), null);
    for (let i = 0; i < 7; i++) { const a = i / 7 * PI2 + rdm() * .5, r = pr(a) + .5 + rdm() * .6; snowRock(kt, M, PX + Math.cos(a) * r, PZ + Math.sin(a) * r, .25 + rdm() * .3, 1400 + i, rdm); }
    flowers(kt, GLOW, PX + 3.2, PZ - 4.4, LOW ? 5 : 9, rdm); flowers(kt, GLOW, PX - 4.8, PZ + 2.2, LOW ? 4 : 7, rdm);
    // 天然的冰橋：深谷兩岸岩壁頂之間一道冰拱。斷面是有稜角的扁橢圓（兩端粗、中間細），頂上蓋一層下垂的雪，底下垂著冰柱；底下可以沿著冰河走過去。
    // 橋面走得上去（regionWalkStrip，腳步聲是薄雪底下的冰）：原本拱的兩端是一個切口、頂面比崖頂高 1.5 公尺，兩端改成順著拱的方向再往外伸、往下埋進崖頂的雪坡，
    // 從崖頂踩著雪就走上橋背。橋上的邊緣擋人（只擋腳在橋面高度的人，看不見的細柱），底下的人照樣沿著冰河走過去，在拱底下跳起來頭會撞到拱底
    { const tx = .983, tz = .182, nx = -tz, nz = tx, ends = [-1, 1].map(s => { const X = (GORGE.x + nx * s * 4.1) * K, Z = (GORGE.z + nz * s * 4.1) * K; return new THREE.Vector3(X, H(X, Z) - .3, Z); });
      const mid = new THREE.Vector3().addVectors(ends[0], ends[1]).multiplyScalar(.5); mid.y = Math.max(ends[0].y, ends[1].y) + .55;
      const cv = new THREE.QuadraticBezierCurve3(ends[0], mid, ends[1]), N = LOW ? 10 : 16, SG = 8, up = new THREE.Vector3(0, 1, 0), sd = seeded(1440), jt = Array.from({ length: (N + 1) * SG }, () => .9 + sd() * .2);
      // 拱的中心線：控制點在兩端的正中間，水平方向對 t 是均勻的（t＝0 北端～1 南端，t 超出 0～1＝往外伸的那段）。往外伸的長度 EX（北端崖頂比較緩、伸長一點）、
      // 一邊順著端點的切線、一邊再往下埋 DIVE，伸出去的那頭整個埋進雪坡裡，看不到切口；斷面在 0～1 以外維持端點的大小
      const Lh = Math.hypot(ends[1].x - ends[0].x, ends[1].z - ends[0].z), y0 = ends[0].y, y1 = mid.y, y2 = ends[1].y, EX = [3.2 / Lh, 2.4 / Lh], DIVE = .35, c01t = t => Math.min(1, Math.max(0, t));
      const cy = t => t < 0 ? y0 + 2 * (y1 - y0) * t + DIVE * t / EX[0] : t > 1 ? y2 + 2 * (y2 - y1) * (t - 1) - DIVE * (t - 1) / EX[1] : (1 - t) ** 2 * y0 + 2 * t * (1 - t) * y1 + t * t * y2;
      const cP = t => t >= 0 && t <= 1 ? cv.getPoint(t) : new THREE.Vector3(ends[0].x + (ends[1].x - ends[0].x) * t, cy(t), ends[0].z + (ends[1].z - ends[0].z) * t);
      const sec = t => { const e = 1 - Math.sin(Math.PI * c01t(t)); return [1.15 + 1.2 * e, .6 + .95 * e]; }; // 斷面的半寬、半高
      const cA = new THREE.Color('#e4f5fe'), cB = new THREE.Color('#b9e2f8'), cD = new THREE.Color('#8ccbf0'), cW = new THREE.Color('#f8fafc'), cc = new THREE.Color(), ice = [], cap = [], ins = [];
      for (const [u, i] of [[-EX[0], 0], ...Array.from({ length: N + 1 }, (_, i) => [i / N, i]), [1 + EX[1], N]]) { // 兩頭往外伸的那一圈用端點的斷面（一樣的稜角）
        const p = cP(u), T = cv.getTangent(c01t(u)), S = new THREE.Vector3().crossVectors(T, up).normalize(), U = new THREE.Vector3().crossVectors(S, T).normalize(), [w, h] = sec(u);
        const at = (th, k, dy) => p.clone().addScaledVector(S, Math.cos(th) * w * k).addScaledVector(U, Math.sin(th) * h * k + dy);
        ice.push(Array.from({ length: SG + 1 }, (_, j) => { const th = j / SG * PI2 - Math.PI / 2, q = at(th, jt[i * SG + j % SG], 0), sn = Math.sin(th); cc.copy(sn < -.3 ? cD : sn < .4 ? cB : cA); return [q.x, q.y, q.z, cc.r, cc.g, cc.b]; }));
        cap.push([.08, .22, .38, .5, .62, .78, .92].map((f, j) => { const q = at(f * Math.PI, j === 0 || j === 6 ? 1.04 : 1.1, j === 0 || j === 6 ? -.06 : .1); return [q.x, q.y, q.z, cW.r, cW.g, cW.b]; }));
        ins.push([p.x, p.y, p.z]);
      }
      kt.add(IC, band(ice, ins), null); kt.add(M.flat, band(cap, ins), null);
      for (let i = 1; i < 12; i++) { const u = i / 12, p = cv.getPoint(u), hh = .6 + .95 * (1 - Math.sin(Math.PI * u)), l = .35 + ((i * 7) % 5) * .13; kt.add(IC, new THREE.ConeGeometry(.08, l, 5), '#e6f7ff', M4(p.x + (rdm() - .5) * .5, p.y - hh * .8 - l / 2, p.z + (rdm() - .5) * .4, Math.PI, 0, 0)); }
      ends.forEach((e, k) => { for (let j = 0; j < 3; j++) kt.add(IC, jit(new THREE.BoxGeometry(1, 1, 1, 2, 2, 2), .3, 1450 + k * 3 + j), ['#dff3ff', '#c4e7fa'][j % 2], M4(e.x + (rdm() - .5) * 1.4, e.y + .1 + rdm() * .3, e.z + (rdm() - .5) * 1.4, rdm(), rdm() * 3, rdm(), 1 + rdm() * .6)); }); // 拱腳的冰塊（原本的碰撞會擋住橋頭，拿掉；拱身的實心交給 regionWalk 的頂面、底面）
      // 走得上去的表面：頂面＝雪蓋（斷面放大 1.1 倍的橢圓再高 0.1），底面＝冰拱（冰塊的稜角最多外擴 1.1 倍）；拱有坡度的地方斷面是斜的，垂直方向要除以切線的水平分量
      const cosT = t => { const q = c01t(t), dy = 2 * (1 - q) * (y1 - y0) + 2 * q * (y2 - y1); return Lh / Math.hypot(Lh, dy); };
      const arc = (t, s) => { const [w, h] = sec(t), W = 1.1 * w, r = 1 - (s / W) ** 2; return r < 0 ? null : 1.1 * h * Math.sqrt(r) / cosT(t); };
      const top = (t, s) => { const a = arc(t, s); return a == null ? null : cy(t) + a + .1 / cosT(t); }, bot = (t, s) => { const a = arc(t, s); return a == null ? null : cy(t) - a; };
      const A = cP(-EX[0]), B = cP(1 + EX[1]), tt = t => -EX[0] + t * (1 + EX[0] + EX[1]);
      regionWalkStrip(A.x, A.z, B.x, B.z, 1.1 * 2.35, (t, s) => top(tt(t), s), 'snowice', (t, s) => bot(tt(t), s));
      // 橋上的邊緣：每 0.45 公尺一根看不見的細柱，人的中心最多走到冰拱半寬的八成（拱中間身體剛好到雪蓋邊上），不會一不小心從冰拱的圓背滑下深谷；
      // 只擋腳在橋面附近的人（yr），橋底下沿著冰河走的人照樣過去；兩頭底下就是崖頂雪地的那段不擋，可以從旁邊走下橋
      const lx = -(ends[1].z - ends[0].z) / Lh, lz = (ends[1].x - ends[0].x) / Lh;
      for (let k = 0, n = Math.ceil(Lh / .45); k <= n; k++) { const t = k / n, y = top(t, 0), o = .8 * sec(t)[0] + .45, px = ends[0].x + (ends[1].x - ends[0].x) * t, pz = ends[0].z + (ends[1].z - ends[0].z) * t;
        [-1, 1].forEach(e => { const x = px + lx * o * e, z = pz + lz * o * e; if (H(x, z) < y - 1.2) addCol({ x, z, r: .1, yr: [y - 1.2, y + 3] }); }); } }
    // 深谷兩側的岩壁頂：一道往谷裡翹出去的雪唇（沿著真正的崖頂，從溪床往外找到坡度變緩的地方），冰柱掛在雪唇底下，不會浮在半空
    { const cS = new THREE.Color('#f6f9fc'), cL = new THREE.Color('#e3ecf5'), cU = new THREE.Color('#b8cce0');
      [-1, 1].forEach(sd => {
        let rows = [], ins = [];
        const flush = () => { if (rows.length >= 3) kt.add(M.flat, band(rows, ins), null); rows = []; ins = []; };
        for (let i = 0; i < cp.length; i++) {
          const p = cp[i], q = cp[Math.min(cp.length - 1, i + 1)], o = cp[Math.max(0, i - 1)], ttx = q[0] - o[0], ttz = q[1] - o[1], tl = Math.hypot(ttx, ttz) || 1, nx = -ttz / tl * sd, nz = ttx / tl * sd;
          if (Math.hypot(p[0] - GORGE.x, p[1] - GORGE.z) > 9) { flush(); continue; }
          // 崖頂＝爬過最陡的那段之後、坡度第一次降到最陡的四成以下的地方（岩丘本身還會一直緩緩往上）
          const hO = d => H((p[0] + nx * d) * K, (p[1] + nz * d) * K), h0 = hO(1.6); let rim = 0, mx = 0;
          for (let d = 2; d < 6.5; d += .25) { const r = hO(d + .5) - hO(d); mx = Math.max(mx, r); if (mx > 1.6 && hO(d) - h0 > 3 && r < mx * .4) { rim = d; break; } }
          if (!rim) { flush(); continue; }
          const hr = Math.max(hO(rim), hO(rim + .3)), P3 = (d, y, c) => [(p[0] + nx * d) * K, y, (p[1] + nz * d) * K, c.r, c.g, c.b];
          rows.push([P3(rim + 1.1, hO(rim + 1.1) + .03, cS), P3(rim + .2, hr + .14, cS), P3(rim - .62, hr + .02, cL), P3(rim - .52, hr - .26, cU), P3(rim - .05, hO(rim - .05) - .3, cU)]);
          ins.push([(p[0] + nx * (rim + .2)) * K, hr - .5, (p[1] + nz * (rim + .2)) * K]);
          if (i % 2 === 0) for (let k = 0; k < 2; k++) { // 冰柱：掛在雪唇底下，長度不超過下面岩壁的一半
            const d = rim - .52 - k * .05, lx = p[0] + nx * d + (rdm() - .5) * .5 * -nz, lz = p[1] + nz * d + (rdm() - .5) * .5 * nx, gap = hr - .2 - H(lx * K, lz * K), l = Math.min(.45 + rdm() * .8, gap * .5);
            if (l > .2) kt.add(IC, new THREE.ConeGeometry(.07 + rdm() * .05, l, 5), '#e2f4fe', M4(lx * K, hr - .2 - l / 2, lz * K, Math.PI, 0, 0));
          }
        }
        flush();
      });
    }
    flowers(kt, GLOW, (GORGE.x - 1.2) * K, (GORGE.z + 2.1) * K, LOW ? 4 : 7, rdm, 1); flowers(kt, GLOW, (GORGE.x + 4.5) * K, (GORGE.z - 2) * K, LOW ? 3 : 6, rdm, 1);
    for (let i = 0; i < (LOW ? 6 : 10); i++) { const s = 20 + rdm() * 50, n = Math.floor(s / 70 * (cp.length - 1)), p = cp[Math.min(cp.length - 1, n)], q = cp[Math.min(cp.length - 1, n + 1)], tx = q[0] - p[0], tz = q[1] - p[1], tl = Math.hypot(tx, tz) || 1, sd = rdm() < .5 ? -1 : 1, o = 1.6 + rdm() * 1.2;
      snowRock(kt, M, (p[0] - tz / tl * o * sd) * K, (p[1] + tx / tl * o * sd) * K, .3 + rdm() * .4, 1460 + i, rdm); }
  }

  /* ---------- 南：守林人小屋（原木牆、積雪的屋頂、石頭煙囪、門上的花圈、暖暖的窗、柴堆、雪燈） ---------- */
  /* ---------- 中南：雪下露出的大石頭、雪兔的窩與一串腳印（雪兔怕生：走近就躲進窩裡，躡手躡腳才看得到牠） ---------- */
  const HR = { m: null, x: 0, y: 0, z: 0, ry: 0, hx: 0, hz: 0, hide: 0, want: 0, away: 0 };
  function hareScene(kt, M, GLOW, rdm) {
    const fx = HARE.fx, fz = HARE.fz, ry = Math.atan2(fx, fz), hx = HARE.x * K, hz = HARE.z * K, F = (r, f) => [hx + fz * r + fx * f, hz - fx * r + fz * f]; // F(往右, 往前) 公尺
    // 大石頭在洞口後面（底下埋在雪裡、頂上積雪），旁邊兩顆、前面兩顆小的
    [[0, -2, 1.25], [-2.1, -1.2, .9], [1.9, -1.5, .75], [2.5, 1.2, .36], [-2.3, 1.1, .3]].forEach(([r, f, sz], i) => { const [x, z] = F(r, f); snowRock(kt, M, x, z, sz, 1700 + i, rdm); if (sz > .5) addCol({ x, z, r: sz }); });
    // 洞口：石頭腳下一個雪堆，前面一個往後仰的深色洞、外面圍一圈雪，洞口前是被扒出來的雪
    { const a = kt.at(hx, hz, 0, ry); a(M.flat, new THREE.SphereGeometry(.7, 9, 4, 0, PI2, 0, Math.PI / 2), '#eef3f8', 0, -.04, -.45, 0, 0, 0, 1.15, .75, .9);
      a(M.flat, new THREE.CircleGeometry(.27, 12), '#27303f', 0, .2, .14, -.3, 0, 0, 1.1, .85, 1); a(M.flat, new THREE.TorusGeometry(.3, .09, 5, 12, Math.PI), '#f4f8fc', 0, .2, .16, -.3, 0, 0, 1.1, .9, 1);
      a(M.flat, new THREE.SphereGeometry(.5, 8, 3, 0, PI2, 0, Math.PI / 2), '#eef3f8', 0, -.02, .55, 0, 0, 0, 1.2, .2, .7); }
    // 腳印：從東邊的林子一路跳到洞口（每一跳：前面兩個並排的長後腳、後面一前一後兩個小前腳），彎彎曲曲
    const [x0, z0] = HARE.from, dx = HARE.x + fx * .5 - x0, dz = HARE.z + fz * .5 - z0, L = Math.hypot(dx, dz), ux = dx / L, uz = dz / L, n = Math.floor(L * K / 1.3), disc = new THREE.CircleGeometry(1, 7).rotateX(-Math.PI / 2);
    for (let i = 1; i < n; i++) {
      const u = i / n, w = 1.5 * Math.sin(u * Math.PI * 2.1) * (1 - u * .6), bx = (x0 + dx * u - uz * w) * K, bz = (z0 + dz * u + ux * w) * K, u2 = Math.min(1, u + .01), w2 = 1.5 * Math.sin(u2 * Math.PI * 2.1) * (1 - u2 * .6);
      const tx = (x0 + dx * u2 - uz * w2) * K - bx, tz = (z0 + dz * u2 + ux * w2) * K - bz, tl = Math.hypot(tx, tz) || 1, ax = tx / tl, az = tz / tl, h = H(bx, bz) + .035, hr = Math.atan2(ax, az);
      [[.15, .07, .04, .1], [.15, -.07, .04, .1], [-.1, .015, .035, .04], [-.24, -.015, .035, .04]].forEach(([f, l, r, e]) => kt.add(M.flat, disc, '#c5d3e3', M4(bx + ax * f + az * l, h, bz + az * f - ax * l, 0, hr, 0, r, 1, e)));
    }
    { const [ax, az] = F(-1.6, .2), [bx, bz] = F(1.4, -.2); flowers(kt, GLOW, ax, az, LOW ? 3 : 5, rdm, .6); flowers(kt, GLOW, bx, bz, LOW ? 2 : 4, rdm, .5); }
    // 雪兔：白色圓滾滾的身體、長耳朵（裡面粉紅）、黑眼睛、粉紅鼻子、小尾巴；坐在洞口前面望著腳印來的方向（會跟著你轉頭、躲進洞裡）
    const ear = s => [[new THREE.SphereGeometry(1, 8, 6), '#f8fafc', M4(s * .055, .6, .12, -.25, 0, s * .2, .045, .19, .032)], [new THREE.SphereGeometry(1, 8, 6), '#f9c5dc', M4(s * .055, .6, .145, -.25, 0, s * .2, .026, .15, .012)]];
    const g = nookMerge([[new THREE.SphereGeometry(.22, 12, 9), '#f8fafc', M4(0, .2, -.02, 0, 0, 0, 1, .9, 1.2)], ...[-1, 1].map(s => [new THREE.SphereGeometry(.15, 10, 8), '#f1f5f9', M4(s * .11, .14, -.1, 0, 0, 0, .8, 1, 1.15)]),
      [new THREE.SphereGeometry(.14, 12, 9), '#f8fafc', M4(0, .4, .17)], ...ear(-1), ...ear(1), ...[-1, 1].flatMap(s => [[new THREE.SphereGeometry(.024, 6, 5), '#1f2937', M4(s * .075, .43, .28)], [new THREE.SphereGeometry(.045, 6, 5), '#f8fafc', M4(s * .05, .03, .24, 0, 0, 0, 1, .7, 1.4)]]),
      [new THREE.SphereGeometry(.02, 6, 5), '#f9a8d4', M4(0, .39, .31)], [new THREE.SphereGeometry(.065, 8, 6), '#ffffff', M4(0, .2, -.29)]], true);
    const m = HR.m = new THREE.Mesh(g, M.soft); HR.hx = hx + fx * .62; HR.hz = hz + fz * .62; HR.x = HR.hx; HR.z = HR.hz; HR.y = H(HR.hx, HR.hz) - .02; HR.ry = ry; HR.base = ry;
    m.position.set(HR.x, HR.y, HR.z); m.rotation.y = ry; chunkObj(m, 40, false, [HR.hx, HR.hz, 1.5]);
  }

  const SMOKE = { x: 0, y: 0, z: 0 };
  function cabinScene(kt, M, GLOW, rdm) {
    const X = CABIN.x * K, Z = CABIN.z * K, Y = H(X, Z), a = kt.at(X, Z, 0, 0, Y), W2 = 2.3, D2 = 1.8, LR = .19, NL = 6, WH = .3 + NL * .36;
    a(M.flat, new THREE.BoxGeometry(W2 * 2 + .5, .4, D2 * 2 + .5), '#7b8796', 0, .1, 0);
    for (let i = 0; i < NL; i++) {
      const y = .45 + i * .36, c = i % 2 ? '#8b5e3c' : '#7a5234';
      [-1, 1].forEach(s => {
        a(M.flat, new THREE.CylinderGeometry(LR, LR, W2 * 2 + .55, 7), c, 0, y, s * D2, 0, 0, Math.PI / 2);
        a(M.flat, new THREE.CylinderGeometry(LR, LR, D2 * 2 + .55, 7), c, s * W2, y + .18, 0, Math.PI / 2, 0, 0);
        [-1, 1].forEach(t => { a(M.flat, new THREE.CylinderGeometry(LR * .92, LR * .92, .02, 7), '#d9b38c', t * (W2 + .28), y, s * D2, 0, 0, Math.PI / 2); a(M.flat, new THREE.CylinderGeometry(LR * .92, LR * .92, .02, 7), '#d9b38c', s * W2, y + .18, t * (D2 + .28), Math.PI / 2, 0, 0); });
      });
    }
    // 屋頂：屋脊沿著 z（山牆在前後），厚厚的雪蓋在上面、屋簷垂著冰柱
    const RH = 1.5, th = Math.atan2(RH, W2 + .45), sl = Math.hypot(W2 + .45, RH) + .1;
    [-1, 1].forEach(s => {
      a(M.flat, new THREE.BoxGeometry(sl, .16, D2 * 2 + .9), '#4a3424', s * (W2 + .45) / 2, WH + RH / 2 + .05, 0, 0, 0, -s * th);
      a(M.flat, new THREE.BoxGeometry(sl + .06, .3, D2 * 2 + 1), '#f8fafc', s * (W2 + .45) / 2 + s * Math.sin(th) * .22, WH + RH / 2 + .05 + Math.cos(th) * .22, 0, 0, 0, -s * th);
      a(M.flat, new THREE.CylinderGeometry(.17, .17, D2 * 2 + 1, 7), '#f8fafc', s * (W2 + .5), WH - .02, 0, Math.PI / 2, 0, 0);
      for (let k = 0; k < 7; k++) { const l = .22 + ((k * 5 + (s > 0 ? 2 : 0)) % 4) * .1; a(IC_REF.m, new THREE.ConeGeometry(.05, l, 5), '#e6f7ff', s * (W2 + .55), WH - .15 - l / 2, -D2 - .3 + k * (D2 * 2 + .6) / 6, Math.PI, 0, 0); }
      a(M.flat, new THREE.CylinderGeometry(1, 1, .3, 3), '#8b5e3c', 0, WH + .5, s * D2, -Math.PI / 2, 0, 0, (W2 * 2 + .1) / 1.732, 1, RH / 1.5); // 前後的山牆（三角形）
    });
    // 前面（北，面向小河）：門與花圈、窗、山牆上的圓窗、門口的小平台與提燈；招牌的字在 signs() 的貼圖上
    a(M.flat, new THREE.BoxGeometry(.95, 1.8, .12), '#5b3a24', -.7, 1.02, -D2 - .14); a(M.flat, new THREE.SphereGeometry(.045, 6, 4), '#d4a017', -.38, 1.0, -D2 - .23);
    a(M.flat, new THREE.TorusGeometry(.2, .06, 5, 12), '#2f6b3f', -.7, 1.5, -D2 - .24); [-1, 1].forEach(s => a(M.flat, new THREE.SphereGeometry(.05, 6, 4), '#ef4444', -.7 + s * .05, 1.33, -D2 - .27));
    const win = (x, y, z, ry) => { const b = kt.at(X + x, Z + z, 0, ry, Y); b(M.flat, new THREE.BoxGeometry(.86, .76, .12), '#5b3a24', 0, y, 0); b(M.lamp, new THREE.BoxGeometry(.68, .58, .04), '#ffd98a', 0, y, -.05); b(M.flat, new THREE.BoxGeometry(.04, .58, .05), '#5b3a24', 0, y, -.08); b(M.flat, new THREE.BoxGeometry(.68, .04, .05), '#5b3a24', 0, y, -.08); b(M.flat, new THREE.BoxGeometry(.96, .1, .26), '#f8fafc', 0, y - .42, -.06); };
    win(1.15, 1.35, -D2 - .12, 0); win(W2 + .14, 1.35, .3, -Math.PI / 2);
    a(M.lamp, new THREE.CircleGeometry(.24, 12), '#ffd98a', 0, WH + .55, -D2 - .16, 0, Math.PI, 0); a(M.flat, new THREE.TorusGeometry(.25, .04, 4, 12), '#5b3a24', 0, WH + .55, -D2 - .17);
    // 招牌立在門前的小路旁（不掛在門廊下，從遠處走來也不會被門廊的屋頂擋住）
    { const sx = X - 2.2, sz = Z - D2 - 2.7, b = kt.at(sx, sz, -.05, Math.PI); [-.5, .5].forEach(x => b(M.flat, new THREE.CylinderGeometry(.05, .06, 1.45, 6), '#6b4d33', x, .72, -.08)); b(M.flat, new THREE.BoxGeometry(1.3, .4, .06), '#7a5234', 0, 1.22, 0); b(M.flat, new THREE.BoxGeometry(1.36, .08, .14), '#f8fafc', 0, 1.46, 0);
      SIGNS.push({ X: sx, Z: sz, y: H(sx, sz) - .05 + 1.22, ry: Math.PI, w: 1.2, h: .32, uv: [512, 640, 1024, 776], off: .045 }); addCol({ x: sx, z: sz, r: .3 }); }
    a(M.flat, new THREE.BoxGeometry(2.6, .14, 1.3), '#9c7a52', -.2, .32, -D2 - .75);
    [-1.4, 1].forEach(x => a(M.flat, new THREE.CylinderGeometry(.06, .07, 2.05, 6), '#6b4d33', x, 1.3, -D2 - 1.3));
    a(M.flat, new THREE.BoxGeometry(2.8, .1, 1.45), '#4a3424', -.2, 2.36, -D2 - .72, -.22, 0, 0); a(M.flat, new THREE.BoxGeometry(2.86, .16, 1.42), '#f8fafc', -.2, 2.47, -D2 - .74, -.22, 0, 0);
    a(M.flat, new THREE.BoxGeometry(.04, .3, .04), '#334155', .6, 2.13, -D2 - 1.2); a(M.flat, new THREE.BoxGeometry(.22, .3, .22), '#334155', .6, 1.86, -D2 - 1.2); a(M.lamp, new THREE.BoxGeometry(.15, .22, .15), '#ffd27a', .6, 1.86, -D2 - 1.2);
    // 石頭煙囪（從右邊屋頂穿出來），煙從頂上冒出來（regionStep）
    a(M.flat, new THREE.BoxGeometry(.72, 2.6, .72), '#8a8f98', 1.25, WH + .95, .85); a(M.flat, new THREE.BoxGeometry(.88, .16, .88), '#5d636b', 1.25, WH + 2.3, .85); a(M.flat, new THREE.BoxGeometry(.8, .14, .8), '#f8fafc', 1.25, WH + 2.42, .85);
    SMOKE.x = X + 1.25; SMOKE.y = Y + WH + 2.45; SMOKE.z = Z + .85;
    // 西邊屋簷下的柴堆、劈柴的木樁與斧頭、靠在東牆的紅色雪板、牆腳的雪堆
    for (let r = 0; r < 3; r++) for (let c = 0; c < 4 - r; c++) { const x = -W2 - .42 - c * .27 - r * .135, y = .32 + r * .24; a(M.flat, new THREE.CylinderGeometry(.13, .13, 1.15, 6), c % 2 ? '#8b5e3c' : '#7a5234', x, y, .1, Math.PI / 2, 0, 0); a(M.flat, new THREE.CylinderGeometry(.11, .11, .02, 6), '#e0c08f', x, y, -.49, Math.PI / 2, 0, 0); }
    a(M.flat, new THREE.CylinderGeometry(.32, .36, .5, 8), '#7a5234', -3.4, .25, -1.7); a(M.flat, new THREE.CylinderGeometry(.3, .3, .02, 8), '#d9b38c', -3.4, .51, -1.7);
    a(M.flat, new THREE.CylinderGeometry(.025, .03, .75, 5), '#8b5e3c', -3.3, .78, -1.7, 0, 0, -.45); a(M.flat, new THREE.BoxGeometry(.24, .14, .04), '#9ca3af', -3.48, .56, -1.7, 0, 0, -.45);
    [-.18, .18].forEach(dz => a(M.flat, new THREE.BoxGeometry(.09, 1.8, .03), '#dc2626', W2 + .33, .92, 1.1 + dz, 0, 0, .14));
    [[2.9, 1.3], [-3.1, 1.6], [1.1, 2.6], [-1.4, 2.5], [3.1, -1.1]].forEach(([x, z], i) => a(M.flat, new THREE.SphereGeometry(.7, 8, 4, 0, PI2, 0, Math.PI / 2), '#f1f5f9', x, -.05, z, 0, i * 1.3, 0, 1.4, .35 + rdm() * .1, .8)); // 牆腳的雪堆（門前不放）
    addCol({ box: [X - W2 - .35, Z - D2 - .35, X + W2 + .35, Z + D2 + .35] }); addCol({ box: [X - W2 - 1.3, Z - .55, X - W2, Z + .7] });
    [[-1.4, -D2 - 1.3], [1, -D2 - 1.3], [-3.4, -1.7]].forEach(([x, z], i) => addCol({ x: X + x, z: Z + z, r: i < 2 ? .12 : .4 }));
    // 從小屋走到河邊的雪燈
    [[-.3, -3.6], [-.8, -6.1], [-.1, -8.3]].forEach(([dx, dz]) => { const b = kt.at(X + dx * K, Z + dz * K); b(M.flat, new THREE.SphereGeometry(.34, 9, 5, 0, PI2, 0, Math.PI / 2), '#f1f5f9', 0, 0, 0, 0, 0, 0, 1, 1.2, 1); b(M.flat, new THREE.SphereGeometry(.16, 8, 5), '#f8fafc', 0, .48, 0); b(M.lamp, new THREE.CircleGeometry(.1, 10), '#ffc970', 0, .2, -.33, 0, Math.PI, 0); });
    flowers(kt, GLOW, X + 2.6, Z - 4.2, LOW ? 3 : 5, rdm, .9);
  }

  /* ---------- 南：岩柱群（小丘上幾根被風雪削出來的岩柱：一塊塊圓鈍的大石頭疊上去，每一層都積著雪） ---------- */
  function spireScene(kt, M, rdm) {
    const SP = [[0, 0, 14, 2.4, 5], [4, 2.2, 9.5, 1.75, 4], [-3.6, 2.8, 11, 1.9, 4], [2.2, -3.7, 7.5, 1.5, 3], [-2.6, -3.3, 6, 1.35, 3]]; // [dx, dz（公尺）, 高, 底半徑, 幾塊]
    SP.forEach(([dx, dz, hh, r, n], i) => {
      const x = SPIRE.x * K + dx, z = SPIRE.z * K + dz; let yy = H(x, z) - .5, rr = r, ox = 0, oz = 0;
      for (let k = 0; k < n; k++) {
        const sh = hh / n * (1.12 - k * .08), s = seeded(1500 + i * 10 + k);
        kt.add(M.flat, rk(1500 + i * 10 + k, 1), ROCKC[(k + i) % 4], M4(x + ox, yy + sh * .5, z + oz, (s() - .5) * .2, s() * 6, (s() - .5) * .2, rr, sh * .58, rr * (.85 + s() * .2)));
        kt.add(M.flat, new THREE.SphereGeometry(rr * .82, 8, 3, 0, PI2, 0, Math.PI / 2), '#f8fafc', M4(x + ox, yy + sh * .93, z + oz, 0, s() * 6, 0, 1, .32, .95)); // 每一塊頂上的雪
        yy += sh * .9; rr *= .7 + rdm() * .12; ox += (rdm() - .5) * .45; oz += (rdm() - .5) * .45;
      }
      kt.add(M.flat, new THREE.ConeGeometry(rr * .9, rr * 1.8, 7), '#f8fafc', M4(x + ox, yy + rr * .5, z + oz));
      addCol({ x, z, r: r + .15 });
    });
    for (let i = 0; i < (LOW ? 6 : 11); i++) { const a = rdm() * PI2, d = 6.5 + rdm() * 4.5; snowRock(kt, M, SPIRE.x * K + Math.cos(a) * d, SPIRE.z * K + Math.sin(a) * d, .45 + rdm() * .8, 1560 + i, rdm); }
  }

  /* ---------- 告示牌上的字：一張貼圖（導覽圖、冰裂縫警告牌、小屋招牌），所有字面合併成一個網格 ---------- */
  const SIGNS = [];
  const mapXY = (x, z) => [512 - z * 3.2, 365 + (x + 118) * 3.2]; // 導覽圖：面向西看圖，上＝西、右＝北
  function drawAtlas(g) {
    const F = s => '700 ' + s + 'px ' + ART_FONT, lab = (t, x, y, s = 30, c = '#24384c') => { g.font = F(s); g.lineJoin = 'round'; g.lineWidth = s / 4.5; g.strokeStyle = '#fffdf6'; g.strokeText(t, x, y); g.fillStyle = c; g.fillText(t, x, y); };
    const P = (x, z) => mapXY(x, z), path = (pts, close) => { g.beginPath(); pts.forEach(([x, z], i) => { const [px, py] = P(x, z); i ? g.lineTo(px, py) : g.moveTo(px, py); }); if (close) g.closePath(); };
    // 導覽圖（0,0)–(1024,640)
    g.save(); woodBoard(g, 1024, 640); g.fillStyle = '#f5eedd'; g.beginPath(); g.roundRect ? g.roundRect(34, 118, 956, 490, 18) : g.rect(34, 118, 956, 490); g.fill();
    g.save(); g.beginPath(); g.rect(34, 118, 956, 490); g.clip();
    g.fillStyle = '#e3eef8'; path([[-66, -54], [-162, -150], [-162, 150], [-66, 54]], true); g.fill();
    // 山：對角線的分隔山脈與西邊的大山
    const mtn = (x, z, s) => { const [px, py] = P(x, z); g.fillStyle = '#9fb0c4'; g.beginPath(); g.moveTo(px - s, py + s * .7); g.lineTo(px, py - s * .9); g.lineTo(px + s, py + s * .7); g.fill(); g.fillStyle = '#ffffff'; g.beginPath(); g.moveTo(px - s * .38, py - s * .25); g.lineTo(px, py - s * .9); g.lineTo(px + s * .38, py - s * .25); g.fill(); };
    for (let k = 0; k <= 9; k++) { const f = k / 9, x = -70 - f * 90; mtn(x, -(-x - 4), 20); mtn(x, -x - 4, 20); }
    for (let z = -140; z <= 140; z += 22) mtn(-168, z, 22);
    // 風吹雪丘：一道道彎彎的線
    g.strokeStyle = '#a9bfd6'; g.lineWidth = 4; g.lineCap = 'round'; for (let k = 0; k < 9; k++) { const x = -100 - (k % 3) * 14, z = -64 - Math.floor(k / 3) * 15; const [px, py] = P(x, z); g.beginPath(); g.arc(px, py + 16, 20, -Math.PI * .8, -Math.PI * .2); g.stroke(); }
    // 冰河與融水小河、冰湖
    g.fillStyle = '#bfe3f5'; g.strokeStyle = '#7fb8dc'; g.lineWidth = 3; path([[-149, -70], [-176, -71], [-182, -82], [-176, -93], [-149, -85]], true); g.fill(); g.stroke();
    g.strokeStyle = '#ffffff'; g.lineWidth = 3; [[-156, -74, -156, -82], [-163, -73, -163, -84], [-170, -73, -170, -86]].forEach(([x1, z1, x2, z2]) => { path([[x1, z1], [x2, z2]]); g.stroke(); });
    g.strokeStyle = '#6fb3e0'; g.lineWidth = 6; path(crPts(STREAM, 4)); g.stroke(); path(crPts(CREEK, 4)); g.stroke();
    g.fillStyle = '#9fd2f0'; g.beginPath(); { const [px, py] = P(-138, -41); g.ellipse(px, py, 25, 21, 0, 0, PI2); } g.fill();
    { const [px, py] = P(POND.x, POND.z); g.beginPath(); g.arc(px, py, 11, 0, PI2); g.fill(); }
    { const [px, py] = P(-158.4, 38.6); g.fillStyle = '#bfe3f5'; g.fillRect(px - 26, py - 6, 26, 12); }
    // 觀景台地、岩柱、小樹
    { const [px, py] = P(MESA.x, MESA.z); g.fillStyle = '#b9a48a'; g.beginPath(); g.ellipse(px, py, 30, 27, 0, 0, PI2); g.fill(); g.fillStyle = '#f8fafc'; g.beginPath(); g.ellipse(px, py - 3, 24, 21, 0, 0, PI2); g.fill(); const [rx, ry] = P(RAMP.ax, RAMP.az); g.strokeStyle = '#b9a48a'; g.lineWidth = 7; g.beginPath(); g.moveTo(rx, ry); g.lineTo(px - 5, py + 8); g.stroke(); }
    { const [px, py] = P(SPIRE.x, SPIRE.z); g.fillStyle = '#8a96a8'; [[-12, 16, 26], [0, 22, 36], [12, 16, 30]].forEach(([dx, w, h]) => { g.beginPath(); g.moveTo(px + dx - w / 2, py + 12); g.lineTo(px + dx, py + 12 - h); g.lineTo(px + dx + w / 2, py + 12); g.fill(); }); }
    const tree = (x, z) => { const [px, py] = P(x, z); g.fillStyle = '#3f7a5c'; g.beginPath(); g.moveTo(px - 8, py + 8); g.lineTo(px, py - 11); g.lineTo(px + 8, py + 8); g.fill(); };
    [[-146, 58], [-139, 46], [-126, 72], [-104, 56], [-141, 84], [-153, 70], [-136, 102], [-127, 10], [-146, -10], [-83, 13], [-77, -14], [-150, 14], [-151, 106], [-112, 101]].forEach(([x, z]) => { tree(x, z); tree(x - 3, z + 5); });
    // 冰晶塔、冰屋、小屋、冰橋、冰瀑、冰洞
    { const [px, py] = P(TOWER[0], TOWER[1]); g.fillStyle = '#7cc6ee'; g.beginPath(); g.moveTo(px - 9, py + 10); g.lineTo(px - 6, py - 14); g.lineTo(px, py - 26); g.lineTo(px + 6, py - 14); g.lineTo(px + 9, py + 10); g.fill(); }
    { const [px, py] = P(-128.4, -45.6); g.fillStyle = '#ffffff'; g.beginPath(); g.arc(px, py, 9, Math.PI, 0); g.fill(); }
    { const [px, py] = P(CABIN.x, CABIN.z); g.fillStyle = '#8b5e3c'; g.fillRect(px - 11, py - 4, 22, 14); g.fillStyle = '#f8fafc'; g.beginPath(); g.moveTo(px - 15, py - 3); g.lineTo(px, py - 17); g.lineTo(px + 15, py - 3); g.fill(); g.fillStyle = '#ffd98a'; g.fillRect(px + 2, py, 5, 5); }
    { const [px, py] = P(GORGE.x, GORGE.z); g.strokeStyle = '#7fc4ec'; g.lineWidth = 6; g.beginPath(); g.arc(px, py + 8, 15, Math.PI * 1.1, Math.PI * 1.9); g.stroke(); }
    { const [px, py] = P(CAVE[0], CAVE[1]); g.fillStyle = '#4b5563'; g.beginPath(); g.arc(px, py + 6, 15, Math.PI, 0); g.fill(); g.fillStyle = '#111827'; g.beginPath(); g.arc(px, py + 6, 8, Math.PI, 0); g.fill(); }
    // 小徑（虛線）與「你在這裡」
    g.strokeStyle = '#a0764a'; g.lineWidth = 6; g.setLineDash([12, 10]); path(crPts(PATH_LINES[5].map(([x, z]) => [x / K, z / K]), 4)); g.stroke(); g.setLineDash([]);
    { const [px, py] = P(SIGN.x, SIGN.z); g.fillStyle = '#ef4444'; g.strokeStyle = '#ffffff'; g.lineWidth = 4; g.beginPath(); g.arc(px, py, 11, 0, PI2); g.fill(); g.stroke(); lab('你在這裡', px - 88, py + 34, 30, '#b91c1c'); }
    // 地名
    const L = [['冰洞', CAVE[0] + 5, CAVE[1] - 9], ['冰晶塔', TOWER[0] - 3, TOWER[1] - 15], ['冰湖營地', -138 - 13, -41 + 1], ['冰河', -170, -100], ['觀景台地', MESA.x + 12, MESA.z - 2], ['風吹雪丘', -124, -104],
      ['冰瀑', -150, 30], ['雪林谷', -147, 63], ['守林人小屋', CABIN.x - 13, CABIN.z], ['冰橋', GORGE.x + 9, GORGE.z - 1], ['小水窪', POND.x + 10, POND.z + 3], ['岩柱群', SPIRE.x - 15, SPIRE.z + 3]];
    g.textAlign = 'center'; L.forEach(([t, x, z]) => { const [px, py] = P(x, z); lab(t, px, py); });
    g.restore();
    // 標題、北方的箭頭
    artText(g, '雪原導覽圖', 512, 88, 66, '#e0f2fe', 600);
    g.fillStyle = '#f5eedd'; g.beginPath(); g.arc(930, 70, 34, 0, PI2); g.fill(); g.fillStyle = '#ef4444'; g.beginPath(); g.moveTo(962, 70); g.lineTo(918, 56); g.lineTo(918, 84); g.fill(); lab('北', 912, 81, 30, '#b91c1c');
    g.restore();
    // 冰裂縫警告牌（0,640)–(512,896)
    g.save(); g.translate(0, 640); woodBoard(g, 512, 256); g.fillStyle = '#facc15'; g.fillRect(26, 26, 460, 204); g.strokeStyle = '#1f2937'; g.lineWidth = 10; g.strokeRect(34, 34, 444, 188);
    g.fillStyle = '#1f2937'; g.beginPath(); g.moveTo(96, 74); g.lineTo(136, 146); g.lineTo(56, 146); g.closePath(); g.fill(); g.fillStyle = '#facc15'; g.fillRect(92, 96, 8, 28); g.fillRect(92, 130, 8, 8);
    g.textAlign = 'center'; g.font = F(76); g.fillStyle = '#b91c1c'; g.fillText('冰裂縫', 300, 140, 300); g.font = F(42); g.fillStyle = '#1f2937'; g.fillText('危險！不要靠近', 256, 204, 420); g.restore();
    // 小屋的招牌（512,640)–(1024,776)
    g.save(); g.translate(512, 640); woodBoard(g, 512, 136); g.textAlign = 'center'; artText(g, '守林人小屋', 256, 92, 72, '#fef3c7', 470); g.restore();
  }
  function signs() {
    if (!SIGNS.length) return;
    const tx = artTex(1024, 1024, drawAtlas), pos = [], nor = [], uv = [], idx = [], m = new THREE.Matrix4(), v = new THREE.Vector3(), n = new THREE.Vector3();
    SIGNS.forEach(s => {
      m.compose(new THREE.Vector3(s.X, s.y, s.Z), new THREE.Quaternion().setFromEuler(new THREE.Euler(0, s.ry, 0)), new THREE.Vector3(1, 1, 1)); n.set(0, 0, 1).transformDirection(m);
      const [x0, y0, x1, y1] = s.uv, u0 = x0 / 1024, u1 = x1 / 1024, v0 = 1 - y1 / 1024, v1 = 1 - y0 / 1024, o = pos.length / 3;
      [[-1, -1, u0, v0], [1, -1, u1, v0], [1, 1, u1, v1], [-1, 1, u0, v1]].forEach(([a, b, uu, vv]) => { v.set(a * s.w / 2, b * s.h / 2, s.off).applyMatrix4(m); pos.push(v.x, v.y, v.z); nor.push(n.x, n.y, n.z); uv.push(uu, vv); });
      idx.push(o, o + 1, o + 2, o, o + 2, o + 3);
    });
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); g.setIndex(idx);
    const mesh = new THREE.Mesh(g, new THREE.MeshStandardMaterial({ map: tx, roughness: .85 })); mesh.receiveShadow = true; chunkObj(mesh, 160, false);
  }

  /* ---------- 夜空的極光（跟著鏡頭走，像畫在天上一樣沒有視差）＋冰湖上的倒影 ---------- */
  const AU = { m: null, U: null, r: null };
  function aurora() {
    const pos = [], uv = [], idx = [];
    // [中心方位角, 弧寬, 距離, 底部高度, 高度]：主要在西北的天空，一條從頭頂斜斜掠過
    [[-2.55, 1.15, 300, 150, 150], [-1.95, .8, 270, 175, 120], [-3.05, .75, 330, 140, 130], [-2.3, .5, 170, 150, 95]].forEach(([a0, span, R, y0, hh], ci) => {
      const N = 48, o = pos.length / 3;
      for (let i = 0; i <= N; i++) { const u = i / N, a = a0 + (u - .5) * span, r = R + Math.sin(u * 9 + ci) * 22 + Math.sin(u * 23 + ci * 2) * 7, x = Math.cos(a) * r, z = Math.sin(a) * r; pos.push(x, y0, z, x, y0 + hh, z); uv.push(u, 0, u, 1); }
      for (let i = 0; i < N; i++) { const k = o + i * 2; idx.push(k, k + 1, k + 2, k + 1, k + 3, k + 2); }
    });
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); g.setIndex(idx);
    AU.U = { uT: W.wind, uK: { value: 0 } };
    const mat = new THREE.ShaderMaterial({ uniforms: AU.U, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, fog: false,
      vertexShader: 'uniform float uT; varying vec2 vUv; void main(){ vUv = uv; vec3 p = position; p.x += sin(uv.x * 12.0 + uT * 0.35) * 9.0 * uv.y; p.z += cos(uv.x * 9.0 + uT * 0.27) * 9.0 * uv.y; gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0); }',
      fragmentShader: 'uniform float uT; uniform float uK; varying vec2 vUv; void main(){ float y = vUv.y, x = vUv.x; float rays = (0.55 + 0.45 * sin(x * 70.0 + sin(x * 11.0 + uT * 0.5) * 4.0 + uT * 0.8)) * (0.7 + 0.3 * sin(x * 23.0 - uT * 0.6)); float body = smoothstep(0.0, 0.1, y) * (1.0 - smoothstep(0.3, 1.0, y)), edge = smoothstep(0.0, 0.03, y) * (1.0 - smoothstep(0.03, 0.22, y)); float ends = smoothstep(0.0, 0.14, x) * (1.0 - smoothstep(0.86, 1.0, x)) * (0.6 + 0.4 * sin(x * 5.0 + uT * 0.15)); vec3 c = mix(vec3(0.3, 1.0, 0.7), vec3(0.72, 0.5, 1.0), smoothstep(0.2, 0.85, y)); gl_FragColor = vec4(c, (body * 0.42 + edge * 0.5) * rays * ends * uK); }' });
    AU.m = new THREE.Mesh(g, mat); AU.m.frustumCulled = false; AU.m.visible = false; AU.m.renderOrder = 1; W.scene.add(AU.m);
    if (LOW) return;
    // 冰湖的倒影：冰面上一層會飄動的極光色（只在夜裡、只在冰湖附近畫）
    const p = NOOK_DIG[5], [cx, cz] = kk([p.x, p.z]);
    const rg = nookDisc(cx, p.w * K + .05, cz, a => nookR(p, a) * K * .97, ['#000000', '#000000'], 40, 2);
    const rm = new THREE.ShaderMaterial({ uniforms: AU.U, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
      vertexShader: 'varying vec2 vW; void main(){ vW = (modelMatrix * vec4(position, 1.0)).xz; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
      fragmentShader: 'uniform float uT; uniform float uK; varying vec2 vW; void main(){ float b = sin(vW.x * 0.09 + vW.y * 0.05 + uT * 0.2) * 0.5 + 0.5, s = smoothstep(0.25, 0.95, sin(vW.y * 0.16 - vW.x * 0.07 + uT * 0.35 + b * 2.5) * 0.5 + 0.5); gl_FragColor = vec4(mix(vec3(0.25, 1.0, 0.7), vec3(0.7, 0.5, 1.0), b), s * 0.3 * uK); }' });
    AU.r = new THREE.Mesh(rg, rm); AU.r.visible = false; W.scene.add(AU.r); AU.rx = cx; AU.rz = cz;
  }

  /* ---------- 煙囪的煙 ---------- */
  const SM = { pts: null, life: null, n: 0 };
  function smoke() {
    if (LOW) return; const n = SM.n = 12, g = new THREE.BufferGeometry(), pos = new Float32Array(n * 3), col = new Float32Array(n * 4);
    SM.life = Float32Array.from({ length: n }, (_, i) => i / n); g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('color', new THREE.BufferAttribute(col, 4));
    // 煙飄的範圍固定在煙囪上方：給一個包圍球讓視角背對煙囪時被剔除（不然整區任何地方往哪看都多一次繪製）
    g.boundingSphere = new THREE.Sphere(new THREE.Vector3(SMOKE.x + 1.5, SMOKE.y + 3.5, SMOKE.z + .5), 6);
    SM.pts = new THREE.Points(g, new THREE.PointsMaterial({ size: 1.5, map: dotTex(), vertexColors: true, transparent: true, depthWrite: false })); SM.pts.visible = false; W.scene.add(SM.pts);
  }

  /* ---------- 地面的小碎石、小雪堆：冰面、小屋、岩柱腳下這些地方清掉（buildDetails 不看 regionAvoid） ---------- */
  function clearSmall() {
    const cab = [CABIN.x * K - 3.4, CABIN.z * K - 3.4, CABIN.x * K + 3.4, CABIN.z * K + 2.8];
    const bad = (X, Z) => { const x = X / K, z = Z / K; if (x > -66 || Math.abs(z) > -x - 8) return false;
      if (X > cab[0] && X < cab[2] && Z > cab[1] && Z < cab[3]) return true;
      return near(TR.creek, x, z, 2).d < 1.5 || near(TR.stream, x, z, 2).d < 1.4 || Math.hypot(x - POND.x, z - POND.z) < POND.r + .4 || glac(x, z).w > .25 || (([ca, cb]) => ca > -1.5 && ca < CAVM.dp + 1 && Math.abs(cb) < CAVM.hw + 1)(caveAB(x, z)) || Math.hypot(x - SPIRE.x, z - SPIRE.z) < 3.5 || Math.hypot(x - MUSH.x, z - MUSH.z) < 2 || Math.hypot(x - SIGN.x, z - SIGN.z) < 1.8; };
    const zero = new THREE.Matrix4().makeScale(0, 0, 0);
    for (const c of W.chunks) {
      if (!c.isInstancedMesh || c.userData.pair || c.userData.terrain || c.userData.snowVeg) continue; const u = c.userData;
      if (u.x1 / K < -170 || u.x0 / K > -64) continue; const a = c.instanceMatrix.array; let hit = false;
      for (let i = 0; i < c.count; i++) if (bad(a[i * 16 + 12], a[i * 16 + 14])) { c.setMatrixAt(i, zero); hit = true; }
      if (hit) c.instanceMatrix.needsUpdate = true;
    }
  }

  /* ---------- 建置 ---------- */
  // 場景零件（和 nookKit 一樣的介面）：平面材質的零件最多（小屋、岩柱、台地上的東西…）又投影，依位置分成北、南兩組各自被視錐剔除
  // （整區合成一組的話包圍球蓋住整個雪原，站在南邊森林往南看也要畫北邊整組，三角形 +25%）；冰與夜光的零件三角形少，整區合成一組省繪製呼叫
  function splitKit(zCut, whole) {
    const ks = [nookKit(), nookKit(), nookKit()], c = new THREE.Vector3();
    const add = (mat, geo, col, m) => { if (whole.includes(mat)) return ks[2].add(mat, geo, col, m); let z; if (m) z = m.elements[14]; else { geo.computeBoundingBox(); z = geo.boundingBox.getCenter(c).z; } ks[z / K < zCut ? 0 : 1].add(mat, geo, col, m); };
    const at = (x, z, dy = 0, ry = 0, y, s = 1) => { const B = M4(x, y == null ? H(x, z) + dy : y, z, 0, ry, 0, s); return (mat, geo, col, px = 0, py = 0, pz = 0, rx = 0, ry2 = 0, rz = 0, sx = 1, sy = sx, sz = sx) => add(mat, geo, col, B.clone().multiply(M4(px, py, pz, rx, ry2, rz, sx, sy, sz))); };
    const seg = (mat, a, b, r, col, n = 5, r1 = r) => { const d = new THREE.Vector3().subVectors(b, a), L = d.length(); add(mat, new THREE.CylinderGeometry(r1, r, L, n), col, new THREE.Matrix4().compose(new THREE.Vector3().addVectors(a, b).multiplyScalar(.5), new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.normalize()), new THREE.Vector3(1, 1, 1))); };
    return { add, at, seg, done: far => ks.forEach(k => k.done(far)) };
  }
  const OWLH = { m: null, x: 0, y: 0, z: 0, base: 0, yaw: 0 }, IC_REF = { m: null };
  function build() {
    if (!TR) trInit();
    // 零件分北南兩組、每組只有三種材質（平面、冰、夜光）：提燈、窗戶改用夜光材質（白天不亮、夜裡亮），冰晶併進冰材質（原本最差視角多 8 次以上繪製）
    const M = Object.assign({}, nookMats()), IC = IC_REF.m = iceMat(), GLOW = M.night, rdm = seeded(6060); M.lamp = M.night;
    const n0 = W.chunks.length, L = vegetation(); for (let i = n0; i < W.chunks.length; i++) W.chunks[i].userData.snowVeg = true;
    clearSmall(); duneTint();
    regEgg('snow_aurora', '台地上的極光', '晴朗的夜裡，爬上雪原的觀景台地，抬頭看看天空。');
    regEgg('snow_owl', '歪樹上的貓頭鷹', '風吹雪丘那裡有一棵被風吹歪的樹，樹枝上好像有誰在打瞌睡。');
    regEgg('snow_hare', '雪兔的窩', '雪地上有一串小小的腳印。雪兔很怕生，要躡手躡腳地靠近。');
    const kt = splitKit(15, [IC, GLOW]);
    glacierScene(kt, M, IC, GLOW, rdm); duneScene(kt, M, IC, GLOW, rdm); mesaScene(kt, M, GLOW, rdm); centerScene(kt, M, GLOW, rdm);
    creekScene(kt, M, IC, GLOW, rdm); cabinScene(kt, M, GLOW, rdm); spireScene(kt, M, rdm); hareScene(kt, M, GLOW, rdm); crystals(kt, IC, L.ice);
    const c0 = W.chunks.length; kt.done(300);
    for (let i = c0; i < W.chunks.length; i++) if (W.chunks[i].material === GLOW) { W.chunks[i].userData.shadow = false; W.chunks[i].castShadow = false; } // 冰晶花、提燈太小，不必進陰影貼圖（少一次繪製）
    signs(); aurora(); smoke();
  }
  regionBuild(build);

  /* ---------- 每格：極光、煙、貓頭鷹轉頭、彩蛋（玩家遠離就不算） ---------- */
  let eggT = 0;
  function step(dt, t) {
    if (!P || !W.cam) return;
    const cam = W.cam.position, cbx = cam.x / K, out = inCity(cam.x) || (typeof CV !== 'undefined' && CV.c);
    if (AU.m) {
      // 強度還要乘上鏡頭所在的雪原權重（天色混合用的同一個 biomeW）：只看 x 的話，火山西半部（例如 (−72, −108)）的夜空也會掛滿極光；翻過分隔山脈才慢慢出現
      const k = out || cbx > -52 ? 0 : DN.night * sm(-52, -68, cbx) * sm(.45, .85, biomeW(cam.x, cam.z)[3]); AU.m.visible = k > .01;
      if (AU.m.visible) { AU.U.uK.value = k; AU.m.position.set(cam.x, 0, cam.z); }
      if (AU.r) AU.r.visible = AU.m.visible && Math.hypot(cam.x - AU.rx, cam.z - AU.rz) < 140;
    }
    if (SM.pts) {
      const d = Math.hypot(cam.x - SMOKE.x, cam.z - SMOKE.z), on = !out && d < 120; SM.pts.visible = on;
      if (on) { const pos = SM.pts.geometry.attributes.position.array, col = SM.pts.geometry.attributes.color.array;
        for (let i = 0; i < SM.n; i++) { let l = SM.life[i] += dt * .11; if (l > 1) l = SM.life[i] = l - 1; pos[i * 3] = SMOKE.x + Math.sin(l * 4 + i) * l * .7 + l * 2.2; pos[i * 3 + 1] = SMOKE.y + l * 7; pos[i * 3 + 2] = SMOKE.z + Math.cos(l * 3 + i) * l * .6 + l * .8; col[i * 4] = col[i * 4 + 1] = col[i * 4 + 2] = .9 - DN.night * .35; col[i * 4 + 3] = Math.sin(l * Math.PI) * (.42 - .12 * l); }
        SM.pts.geometry.attributes.position.needsUpdate = SM.pts.geometry.attributes.color.needsUpdate = true; }
    }
    if (out) return;
    const px = P.x, pz = P.z;
    // 貓頭鷹：你靠近時慢慢轉頭看你
    if (OWLH.m && Math.abs(px - OWLH.x) < 30 && Math.abs(pz - OWLH.z) < 30) {
      const dd = Math.hypot(px - OWLH.x, pz - OWLH.z), want = dd < 14 ? wrapA(Math.atan2(px - OWLH.x, pz - OWLH.z) - OWLH.base) : 0;
      OWLH.yaw += clamp(wrapA(clamp(want, -1.9, 1.9) - OWLH.yaw), -dt * 1.6, dt * 1.6); OWLH.m.rotation.y = OWLH.base + OWLH.yaw;
    }
    // 雪兔：沒躡手躡腳地走近（6.5 公尺內）就躲進窩裡，你走遠（12 公尺外）一會兒才探出來；平常輕輕呼吸、抽動鼻子、轉頭看你
    if (HR.m && Math.abs(px - HR.hx) < 40 && Math.abs(pz - HR.hz) < 40) {
      const d = Math.hypot(px - HR.hx, pz - HR.hz), scared = d < 6.5 && !P.sneak || d < 2;
      if (scared) { HR.want = 1; HR.away = 0; } else if (HR.want && d > 12 && (HR.away += dt) > 3) HR.want = 0;
      HR.hide += clamp(HR.want - HR.hide, -dt * 1.2, dt * 4); HR.hide = clamp(HR.hide, 0, 1); const k = HR.hide * HR.hide * (3 - 2 * HR.hide);
      const look = d < 16 && !HR.want ? clamp(wrapA(Math.atan2(px - HR.hx, pz - HR.hz) - HR.base), -1.2, 1.2) : 0; HR.ry += clamp(wrapA(HR.base + look - HR.ry), -dt * 2.5, dt * 2.5);
      HR.x = HR.hx - HARE.fx * .6 * k; HR.z = HR.hz - HARE.fz * .6 * k; // 往洞裡鑽：退回洞口、沉到地面以下
      HR.m.position.set(HR.x, HR.y - .75 * k, HR.z); HR.m.rotation.y = HR.ry; HR.m.scale.set(1, 1 + Math.sin(t * 2.6) * .025 * (1 - k), 1);
    }
    if ((eggT -= dt) > 0) return; eggT = .3;
    if (Math.hypot(px / K - MESA.x, pz / K - MESA.z) < 8 && P.y > (MESA.top - 1.2) * K && DN.night > .7 && P.pitch > .3) eggHit('snow_aurora', '台地上的夜空好近，極光像窗簾一樣輕輕飄動。');
    if (HR.m && !HR.hide && P.sneak && Math.hypot(px - HR.x, pz - HR.z) < 4.5 && eggHit('snow_hare', '雪兔抖了抖長耳朵，沒發現你。好想摸摸那團軟軟的毛……')) fx3(new THREE.Vector3(HR.x, HR.y + .8, HR.z), '♥', '#fbcfe8');
    if (OWLH.m) { const vx = OWLH.x - px, vz = OWLH.z - pz, d = Math.hypot(vx, vz); if (d < 10 && d > .5 && (-Math.sin(P.yaw) * vx - Math.cos(P.yaw) * vz) / d > .93 && eggHit('snow_owl', '歪樹的樹枝上，一隻圓滾滾的小貓頭鷹眨了眨眼睛。')) fx3(new THREE.Vector3(OWLH.x, OWLH.y + .4, OWLH.z), '♪', '#fde68a'); }
  }
  regionStep(step);
})();
