'use strict';
/* 火山：地形多元化與場景細節（登記方式見 regions.js）。內容都包在 IIFE 裡，避免和別的檔案撞名
   範圍：z < −66 且 |x| < −z − 12（基礎單位，×K＝世界座標）。原本是一片幾乎全平的深色地面＋一座完美的圓錐，道具均勻撒滿，走到哪裡都一樣；這裡讓它有幾個記得住的地方：
   - 西南「六角台地」：玄武岩柱圍出的台地，三面是一階一階的柱子斷崖（柱高像管風琴一樣起伏，幾處柱頂長著夜裡發光的螢光苔），東面一條柱頂踏階的坡道走上去，台頂有石堆與耐旱的小植物
   - 西邊「熔岩丘」：五顆灰色、麵包一樣鼓起來的小丘，頂上裂開、裂縫透著紅光（和西邊原有的兩個噴口組成一片）
   - 南坡「冷卻的熔岩流」：從火山南坡流下來，在平地上停成兩個舌狀前緣（繩狀紋路、前緣的裂縫還在發紅），停在熔岩管旁邊（熔岩管就是它留下的）
   - 東南「噴氣孔區」：硫磺結晶池、原有噴口周圍長出黃色結晶、兩座小火山錐（大的有缺口可以走進去，火山口裡睡著熔岩史萊姆）；夜裡噴口燒出藍色火焰（彩蛋）
   - 東北「熔岩河」：山腰的小噴口 → 有天然堤岸的熔岩河 → 山腳的熔岩湖（只當光源：用碰撞擋住，不能踩）
   - 西北「火山灰平原」：灰白的沙丘，一串史萊姆跳過的小圓印通到一朵倔強的小花（彩蛋）
   - 火山本體加放射狀的稜與溝、上半部紅褐色的火山渣；東西兩側幾座和緩的丘陵（東邊丘頂立著頂著蓋石的岩柱）；原有的岩漿池加一圈結殼的岩石（原本像貼在地上的貼紙）
   - 隨機的石頭、枯樹、黑曜石不再均勻撒滿：用低頻雜訊挖出幾塊空地，剩下的聚成一叢一叢，走起來有疏有密
   熔岩隧道出口、小徑、謎題、噴口、岩漿池、溫泉、黑曜石林、熔岩管、火山口都不動（KEEP 保護區內地形修改淡到 0），區域邊界 6 單位內也淡到 0，不留接縫。
   地形網格每格約 1.8 公尺（LOW 2.5），所以地形只做大的形狀（台地、熔岩舌、錐、堤岸、沙丘），柱子、繩紋、結晶這些細節交給物件。
   效能：物件依材質合併（nookKit），每區一組交給 cullChunks 剔除；發光的部分（熔岩裂縫、結晶、小花、螢光苔）全區合併成兩個網格；只有台地與東邊的大東西投影；粒子與藍色火焰只在附近、需要時才更新 */
(() => {
  const sm = (a, b, x) => { const t = x <= a ? 0 : x >= b ? 1 : (x - a) / (b - a); return t * t * (3 - 2 * t); };
  const wa = a => ((a + Math.PI) % (2 * Math.PI) + 2 * Math.PI) % (2 * Math.PI) - Math.PI; // 角度差包成 −π～π
  const pk = (a, rd) => a[Math.floor(rd() * a.length) % a.length];
  // 控制點（基礎單位）→ 每 step 取一點的 Catmull-Rom 曲線，附累積長度與外框（near 查最近點用）
  function crv(pts, step) {
    const P = [];
    for (let i = 0; i < pts.length - 1; i++) {
      const p0 = pts[Math.max(0, i - 1)], p1 = pts[i], p2 = pts[i + 1], p3 = pts[Math.min(pts.length - 1, i + 2)], n = Math.max(2, Math.ceil(Math.hypot(p2[0] - p1[0], p2[1] - p1[1]) / step));
      for (let k = 0; k < n; k++) { const t = k / n, t2 = t * t, t3 = t2 * t; P.push([0, 1].map(j => .5 * (2 * p1[j] + (-p0[j] + p2[j]) * t + (2 * p0[j] - 5 * p1[j] + 4 * p2[j] - p3[j]) * t2 + (-p0[j] + 3 * p1[j] - 3 * p2[j] + p3[j]) * t3))); }
    }
    P.push(pts[pts.length - 1].slice());
    const S = [0]; for (let i = 1; i < P.length; i++) S.push(S[i - 1] + Math.hypot(P[i][0] - P[i - 1][0], P[i][1] - P[i - 1][1]));
    const xs = P.map(p => p[0]), zs = P.map(p => p[1]);
    return { P, S, L: S[S.length - 1], x0: Math.min(...xs), x1: Math.max(...xs), z0: Math.min(...zs), z1: Math.max(...zs) };
  }
  // 最近點：l＝到曲線的距離、s＝沿線位置（0～1）
  function near(c, x, z) {
    let best = 1e18, bs = 0;
    for (let i = 0; i < c.P.length - 1; i++) { const a = c.P[i], b = c.P[i + 1], dx = b[0] - a[0], dz = b[1] - a[1], L2 = dx * dx + dz * dz || 1e-9; let t = ((x - a[0]) * dx + (z - a[1]) * dz) / L2; t = t < 0 ? 0 : t > 1 ? 1 : t; const px = a[0] + dx * t - x, pz = a[1] + dz * t - z, d = px * px + pz * pz; if (d < best) { best = d; bs = c.S[i] + t * Math.sqrt(L2); } }
    return { l: Math.sqrt(best), s: bs / c.L };
  }
  const inBox = (c, x, z, m) => x > c.x0 - m && x < c.x1 + m && z > c.z0 - m && z < c.z1 + m;
  // 曲線上 s（0～1）的位置與順流方向
  function along(c, s) {
    const d = s * c.L; let i = 0; while (i < c.S.length - 2 && c.S[i + 1] < d) i++;
    const a = c.P[i], b = c.P[i + 1], L = c.S[i + 1] - c.S[i] || 1, k = Math.max(0, Math.min(1, (d - c.S[i]) / L));
    return { x: a[0] + (b[0] - a[0]) * k, z: a[1] + (b[1] - a[1]) * k, tx: (b[0] - a[0]) / L, tz: (b[1] - a[1]) / L };
  }

  /* ---------- 地形：每個場景的形狀（基礎單位） ---------- */
  // 六角台地：外緣半徑隨角度起伏（不是正圓）；ra＝坡道方向（朝小徑盡頭），坡度 0.4
  const PA = { x: -17, z: -82, top: 2.4, ra: -.26 }, paR = a => 6 + .9 * Math.sin(3 * a + .7) + .45 * Math.sin(5 * a + 2.1) + .25 * Math.sin(7 * a + .3);
  const PA_RR = paR(PA.ra), PA_U = [Math.cos(PA.ra), Math.sin(PA.ra)];
  const rampH = u => PA.top - .4 * Math.max(0, u - PA_RR + .3);
  function plat(x, z, h) {
    const dx = x - PA.x, dz = z - PA.z; if (dx * dx + dz * dz > 240) return h;
    const d = Math.hypot(dx, dz), R = paR(Math.atan2(dz, dx)), w = 1 - sm(R - .2, R + 1.3, d); let t = h + (PA.top - h) * w; // 斷崖 2 公尺內降到地面（坡度約 2，爬不上去，外面用柱子蓋住）
    const u = dx * PA_U[0] + dz * PA_U[1], v = Math.abs(dz * PA_U[0] - dx * PA_U[1]);
    if (u > 0 && v < 3.1) { const rw = (1 - sm(1.9, 3, v)) * (1 - sm(PA_RR + 6, PA_RR + 6.6, u)); t = Math.max(t, h + (rampH(u) - h) * rw); }
    return t;
  }
  // 熔岩流：沿中心線的一條舌頭，山坡上薄（0.45）、平地上厚（0.9），尾端分成兩個圓圓的前緣
  const FL = crv([[3.2, -118.6], [5.2, -112], [7.4, -105], [8.6, -99.6], [7, -95.8]], .5), FLOB = [[6.7, -93.6, 3], [2.3, -95.4, 2.6]];
  const flW = s => 2.1 + 1.1 * s;
  function flowT(x, z, q) {
    let t = 0;
    if (q) { const w = flW(q.s), T = (.45 + .45 * sm(.62, .92, q.s)) * sm(0, .12, q.s); t = T * (1 - sm(w - 1, w + .15, q.l)) * (.86 + .14 * Math.max(0, 1 - (q.l / w) ** 2)); }
    for (const [lx, lz, lr] of FLOB) { const d = Math.hypot(x - lx, z - lz); if (d < lr + .2) t = Math.max(t, .9 * (1 - sm(lr - 1, lr + .15, d)) * (.88 + .12 * Math.max(0, 1 - (d / lr) ** 2))); }
    return t;
  }
  // 噴氣孔區：硫磺池（先整平一塊，再挖碗；水面比 0 低，史萊姆不會生在水裡）與兩座小火山錐（br＝缺口方向，缺口地面從火山口底緩緩降到山腳）
  const SU = { x: 36.5, z: -80.5, lv: .1, r: 2.3 }, suR = a => SU.r * (1 + .1 * Math.sin(a * 3 + 1) + .05 * Math.sin(a * 5 + 2));
  const CC = [{ x: 45.5, z: -87.5, rb: 7.2, hc: 3.3, rt: 2.5, fl: 1.3, rf: 1.4, br: 2.48 }, { x: 52, z: -77, rb: 4.6, hc: 2, rt: 1.4, fl: 1.2, rf: .6 }];
  function coneAdd(c, x, z) {
    const dx = x - c.x, dz = z - c.z, d = Math.hypot(dx, dz); if (d >= c.rb) return 0;
    let a = d > c.rt ? c.hc * Math.pow(1 - (d - c.rt) / (c.rb - c.rt), 1.35) : c.fl + (c.hc - c.fl) * sm(c.rf, c.rt, d);
    if (c.br != null) { const ux = Math.cos(c.br), uz = Math.sin(c.br), u = dx * ux + dz * uz, v = Math.abs(dz * ux - dx * uz); if (u > 0) { const hb = c.fl * (1 - sm(c.rf, c.rb, u)), wb = (1 - sm(.95, 1.75, v)) * sm(c.rf * .4, c.rf + .3, u); if (hb < a) a += (hb - a) * wb; } }
    return a;
  }
  function fum(x, z, h) {
    if (x < 27 || x > 58 || z < -96 || z > -71) return h;
    const dx = x - SU.x, dz = z - SU.z, d = Math.hypot(dx, dz);
    if (d < 6.5) { h += (SU.lv - h) * (1 - sm(4, 6.4, d)); const rr = suR(Math.atan2(dz, dx)); if (d < rr) { const u = d / rr; h = SU.lv - .57 + .55 * u * u; } }
    for (const c of CC) h += coneAdd(c, x, z);
    return h;
  }
  // 熔岩河：從火山口往東北（RU）的山腰流下來，RN 是左右擺動的方向；湖在山腳（半徑 35 左右，在史萊姆的生成範圍外）
  const RU = [.85, -.53], RN = [.53, .85];
  const RV = crv([[20, 0], [22.6, .7], [25.2, -.35], [27.8, .45], [30.4, -.15], [32.4, 0]].map(([r, l]) => [RU[0] * r + RN[0] * l, -130 + RU[1] * r + RN[1] * l]), .5);
  const LK = { x: RU[0] * 35.4, z: -130 + RU[1] * 35.4, r: 3.3, lv: .45 }, lkR = a => LK.r * (1 + .08 * Math.sin(a * 3 + .5) + .05 * Math.sin(a * 5 + 1.7)), HEAD = RV.P[0];
  function river(x, z, h, q) {
    if (x < 12 || x > 38 || z < -155 || z > -133) return h;
    { const d = Math.hypot(x - HEAD[0], z - HEAD[1]); if (d < 2.2) h += 1.1 * (1 - sm(.5, 2.1, d)); } // 山腰的小噴口（hornito）
    if (q && q.l < 3) h += -.22 * (1 - sm(.6, 1.1, q.l)) + .38 * sm(.9, 1.5, q.l) * (1 - sm(1.9, 2.8, q.l)); // 河床挖低、兩側天然堤岸
    const dx = x - LK.x, dz = z - LK.z, d = Math.hypot(dx, dz);
    if (d < LK.r + 3.2) { const rr = lkR(Math.atan2(dz, dx)); h += (LK.lv - h) * (1 - sm(rr + .9, rr + 2.8, d)); if (d < rr + .25) { const u = d / (rr + .25); h = LK.lv - .65 + .6 * u * u; } } // 湖底比 0 低：史萊姆不會生在湖裡
    return h;
  }
  // 火山灰平原：橢圓範圍裡的沙丘（AS.a 是風吹的方向），整片略為墊高（原本這裡比 0 低，史萊姆生不出來）
  const AS = { x: -48, z: -146, a: .6, ru: 17, rv: 12 }, AS_C = Math.cos(AS.a), AS_S = Math.sin(AS.a);
  function ashW(x, z) { const dx = x - AS.x, dz = z - AS.z; if (dx * dx + dz * dz > 420) return 0; const u = dx * AS_C + dz * AS_S, v = dz * AS_C - dx * AS_S; return (1 - sm(.68, 1, Math.hypot(u / AS.ru, v / AS.rv))) * sm(37, 41, Math.hypot(x, z + 130)); }
  function dune(x, z) { const dx = x - AS.x, dz = z - AS.z, u = dx * AS_C + dz * AS_S, v = dz * AS_C - dx * AS_S; return Math.pow(Math.sin(u * .78 + 1.1 * Math.sin(v * .21 + 1.3)) * .5 + .5, 1.5); }
  // 火山本體：13 道放射狀的稜（稜線尖、溝底圓），熔岩流與熔岩河經過的地方不做
  const ribQ = (x, z, rc) => { const a = Math.atan2(z + 130, x); return .5 + .5 * Math.cos(13 * a + 1.8 * Math.sin(3 * a + rc * .11) + rc * .04); };
  function ribs(x, z, qf, qr) {
    const rc = Math.hypot(x, z + 130); if (rc < 10 || rc > 35) return 0;
    const A = .5 * sm(10, 16, rc) * (1 - sm(28, 35, rc)), q = ribQ(x, z, rc);
    return A * (q * q - .38) * (qf ? 1 - (1 - sm(flW(qf.s) - .3, flW(qf.s) + 2.2, qf.l)) * sm(0, .12, qf.s) : 1) * (qr ? sm(2.4, 4.4, qr.l) : 1);
  }
  // 東西兩側的丘陵：[x, z, 半徑, 高度]（最陡約 0.5，史萊姆照樣生得出來）；東邊的丘頂立著幾根風化的岩柱（遠遠就看得到的剪影）
  const HL = [[72, -118, 9, 3], [83, -131, 7, 2.2], [64, -141, 6.5, 1.8], [-72, -127, 8, 2.4]];
  const PIL = [[70.5, -116, 8.5, .95], [74.6, -120.2, 6.2, .8], [68.4, -121.4, 4.6, .7], [77.2, -114.2, 3.8, .62], [83.6, -130.4, 5.4, .78]]; // [x, z, 高（公尺）, 底半徑（公尺）]
  // 西邊的熔岩丘（tumulus）：結了殼的熔岩被底下還在流的熔岩頂起來，鼓成一顆顆麵包一樣的小丘，頂上裂開、裂縫裡還透著紅光（夜裡從台地上看是一串發亮的裂紋）
  // [x, z, 長半徑, 短半徑, 高, 長軸方向]；最陡約 1.3×高÷短半徑 ≈ 0.49（走得上去，史萊姆照樣生得出來）；避開西邊的兩個噴口與岩漿池、溫泉
  const TU = [[-44, -99.5, 5.2, 4, 1.5, .5], [-36.5, -106, 4.2, 3.4, 1.25, -.4], [-48.5, -90.5, 4, 3.1, 1.15, 1.2], [-28.5, -101, 3.6, 2.8, 1, .2], [-41, -113, 3.2, 2.6, .9, -1]];
  const tuUV = (t, x, z) => { const dx = x - t[0], dz = z - t[1], c = Math.cos(t[5]), s = Math.sin(t[5]); return [(dx * c + dz * s) / t[2], (dz * c - dx * s) / t[3]]; }; // 丘的本地座標（長軸 u、短軸 v，邊緣＝1）
  const tuH = (t, x, z) => { const [u, v] = tuUV(t, x, z), q = u * u + v * v; return q < 1 ? t[4] * Math.pow(1 - q, 1.5) : 0; };
  const inTU = (x, z) => x > -55 && x < -22 && z > -119 && z < -84;

  /* ---------- 保護區：這些地方的地形不動 ---------- */
  let KEEP = null, VENTS = null, POOLS = null, PATH = null;
  function prep() {
    if (KEEP) return;
    // 噴口與岩漿池是 game.js 用固定種子隨機放的（buildSteam、buildVolcanoFx）：照同樣的步驟重算位置（基礎單位）
    const r1 = seeded(13); VENTS = [];
    for (let i = 0; i < 40 && VENTS.length < 9; i++) { const x = (r1() - .5) * 80, z = -66 - r1() * 70; if (Math.hypot(x, z + 130) < 42 || Math.abs(x) > -z - 14) continue; VENTS.push([x, z]); }
    const r2 = seeded(5); POOLS = [];
    for (let i = 0; i < 16; i++) { const x = (r2() - .5) * 90, z = -64 - r2() * 80; if (Math.hypot(x, z + 130) < 40 || Math.abs(x) > -z - 12) continue; POOLS.push([x, z, (1.2 + r2() * 1.4) / K]); }
    PATH = crPts(PATH_LINES[2], 10).map(([x, z]) => [x / K, z / K]);
    // [x, z, r0, r1]：r0 內完全不動、r1 外照新地形。熔岩隧道出口、溫泉、黑曜石林、熔岩管、火山口、噴口、岩漿池、小徑旁的警告牌與石堆、熔岩柱謎題
    KEEP = [[-2.4, -63.8, 10.5, 14], [-55, -112, 7.5, 11], [54, -104, 8.5, 12], [18, -88, 6.5, 9], [0, -130, 9.5, 12.5],
      ...VENTS.map(([x, z]) => [x, z, 2, 4.5]), ...POOLS.map(([x, z, r]) => [x, z, r + .9, r + 2.8]),
      ...[trailAt(2, 22, 1, 3.8), trailAt(2, 40, -1, 4)].filter(Boolean).map(s => [s.x / K, s.z / K, 2, 4]), ...PILLARS.map(([x, z]) => [x / K, z / K, 3, 5])];
  }
  const edgeM = (x, z) => sm(66, 72, -z) * sm(0, 6, -z - 12 - Math.abs(x)) * (1 - sm(156, 162, -z));
  function keepM(x, z) {
    let m = edgeM(x, z); if (m <= 0) return 0;
    for (const k of KEEP) { const dx = x - k[0], dz = z - k[1], d2 = dx * dx + dz * dz; if (d2 >= k[3] * k[3]) continue; m *= sm(k[2], k[3], Math.sqrt(d2)); if (m <= 0) return 0; }
    if (x > -10 && x < 7 && z > -93) { // 小徑兩側 2.2 單位內不動（坡度維持原樣）
      let d = 1e9; for (let i = 0; i < PATH.length - 1; i++) { const a = PATH[i], b = PATH[i + 1], dx = b[0] - a[0], dz = b[1] - a[1], L2 = dx * dx + dz * dz || 1e-9, t = Math.max(0, Math.min(1, ((x - a[0]) * dx + (z - a[1]) * dz) / L2)); d = Math.min(d, Math.hypot(a[0] + dx * t - x, a[1] + dz * t - z)); }
      m *= sm(2.2, 5, d);
    }
    return m;
  }
  regionTerrain((x, z, h) => {
    if (z > -64 || z < -164 || Math.abs(x) > -z - 10) return h;
    prep(); const m = keepM(x, z); if (m <= 0) return h;
    const qf = inBox(FL, x, z, 5) ? near(FL, x, z) : null, qr = inBox(RV, x, z, 5) ? near(RV, x, z) : null;
    let t = plat(x, z, h);
    t += flowT(x, z, qf);
    t = fum(x, z, t);
    t = river(x, z, t, qr);
    const aw = ashW(x, z); if (aw > 0) t += aw * (.45 + .85 * dune(x, z));
    t += ribs(x, z, qf, qr);
    for (const [hx, hz, r, a] of HL) { const d2 = (x - hx) ** 2 + (z - hz) ** 2; if (d2 < r * r) t += a * (1 - d2 / (r * r)) ** 2; }
    if (inTU(x, z)) for (const tu of TU) t += tuH(tu, x, z);
    return h + (t - h) * m;
  });
  // 隨機道具的疏密：原本石頭、枯樹、黑曜石在整片火山均勻撒滿，走到哪裡都一樣亂；用低頻雜訊挖出幾塊空地（邊緣用雜湊打散，不是一刀切），剩下的自然聚成一叢一叢
  const sparse = (x, z) => vnoise(x * .05, z * .05, 83) < .38 + .24 * hashN(Math.round(x * 3), Math.round(z * 3), 5);
  // 隨機的石頭、枯樹不要長在這些場景裡（場景自己會放東西）
  regionAvoid((wx, wz) => {
    const x = wx / K, z = wz / K; if (z > -66 || Math.abs(x) > -z - 10) return false; prep();
    { const dx = x - PA.x, dz = z - PA.z; if (dx * dx + dz * dz < 200) { if (Math.hypot(dx, dz) < paR(Math.atan2(dz, dx)) + 2.6) return true; const u = dx * PA_U[0] + dz * PA_U[1], v = Math.abs(dz * PA_U[0] - dx * PA_U[1]); if (u > 0 && u < PA_RR + 7.6 && v < 3.6) return true; } }
    if (inBox(FL, x, z, 5)) { const q = near(FL, x, z); if (q.l < flW(q.s) + 1.4) return true; }
    if (FLOB.some(([lx, lz, lr]) => Math.hypot(x - lx, z - lz) < lr + 1.4)) return true;
    if (Math.hypot(x - SU.x, z - SU.z) < 7.2 || CC.some(c => Math.hypot(x - c.x, z - c.z) < c.rb + .6)) return true;
    if ((inBox(RV, x, z, 4) && near(RV, x, z).l < 3.4) || Math.hypot(x - LK.x, z - LK.z) < LK.r + 3.4) return true;
    if (ashW(x, z) > .05 || PIL.some(([px, pz]) => Math.hypot(x - px, z - pz) < 2.2)) return true;
    if (inTU(x, z) && TU.some(t => { const [u, v] = tuUV(t, x, z); return u * u + v * v < 1.4; })) return true;
    if (HL.some(([hx, hz, r]) => (x - hx) ** 2 + (z - hz) ** 2 < r * r * .75)) return true; // 丘陵上清空：岩柱與乾草立在乾淨的坡上，遠看才是一個剪影，不是一堆雜物
    if (POOLS.some(([px, pz, r]) => Math.hypot(x - px, z - pz) < r + 1.3)) return true;
    return z < -68 && Math.abs(x) < -z - 14 && sparse(x, z);
  });

  /* ---------- 地表顏色：直接改地形網格的頂點色（不加繪製呼叫）；只動這一區的頂點，權重和地形一樣在邊界淡到 0 ---------- */
  function paint() {
    const tm = W.terrain && W.terrain[0]; if (!tm) return;
    const g = tm.geometry, P3 = g.attributes.position, C = g.attributes.color, N3 = g.attributes.normal, o = new THREE.Color(), t = new THREE.Color(), u = new THREE.Color();
    // 火山的天光與太陽都是橘色的：想看起來是「灰」的東西（火山灰、玄武岩、熔岩流）要挑偏冷的顏色，照下來才不會變成一片咖啡色
    const PC = Object.fromEntries(Object.entries({
      coneUp: '#6a3d2f', coneRidge: '#7c4a37', coneVal: '#3e2c27', coneLow: '#3d302c', coneStreak: '#5a5658',
      ash: '#9c9ca6', ashDark: '#73727c', plat: '#55525a', platSoil: '#5e5044', cliff: '#2a282e',
      flow: '#2c2a36', flowEdge: '#1d1b24', levee: '#2b2524',
      sulf: '#b99a42', sulfPale: '#ddd09a', sulfOut: '#6c5d3c', cinder: '#6c3829', cinderTop: '#84482f', cinderIn: '#3b231e', hill: '#4e4a3a',
    }).map(([k, v]) => [k, new THREE.Color(v)]));
    const to = (c, w, n) => { if (w > .002) o.lerp(t.copy(c).multiplyScalar(n), Math.min(1, w)); };
    for (let i = 0; i < P3.count; i++) {
      const x = P3.getX(i) / K, z = P3.getZ(i) / K; if (z > -64 || z < -164 || Math.abs(x) > -z - 10) continue;
      const e = edgeM(x, z); if (e <= 0) continue;
      const km = keepM(x, z), ny = N3.getY(i), n = .9 + .2 * vnoise(x * 1.3, z * 1.3, 61);
      o.setRGB(C.getX(i), C.getY(i), C.getZ(i));
      // 火山本體：上半部紅褐色的火山渣、稜線亮一點、溝底暗一點，下半部幾道淺色的火山灰條紋
      const rc = Math.hypot(x, z + 130);
      if (rc < 38) {
        const q = ribQ(x, z, rc), a = Math.atan2(z + 130, x), st = sm(.8, .97, .5 + .5 * Math.cos(7 * a + 2.3 * Math.sin(2 * a) + rc * .07)) * sm(18, 26, rc);
        u.copy(PC.coneLow).lerp(PC.coneUp, 1 - sm(15, 26, rc)).lerp(q > .5 ? PC.coneRidge : PC.coneVal, Math.abs(q - .5) * 1.2 * sm(10, 16, rc)).lerp(PC.coneStreak, st * .7);
        to(u, sm(8.5, 11, rc) * (1 - sm(33, 38, rc)) * .92 * km, n);
      }
      for (const [hx, hz, r] of HL) { const d2 = (x - hx) ** 2 + (z - hz) ** 2; if (d2 < r * r) to(PC.hill, (1 - d2 / (r * r)) ** 2 * .55 * km, n); }
      const aw = ashW(x, z); if (aw > 0) to(u.copy(PC.ashDark).lerp(PC.ash, dune(x, z)), aw * .95 * km, n);
      // 六角台地：台頂灰褐（夾一點土色），斷崖（陡的地方）很暗
      { const dx = x - PA.x, dz = z - PA.z; if (dx * dx + dz * dz < 240) { const d = Math.hypot(dx, dz), R = paR(Math.atan2(dz, dx)), uu = dx * PA_U[0] + dz * PA_U[1], vv = Math.abs(dz * PA_U[0] - dx * PA_U[1]);
        const w = Math.max(1 - sm(R - .3, R + 1.5, d), uu > 0 ? (1 - sm(1.9, 3.1, vv)) * (1 - sm(PA_RR + 6, PA_RR + 6.8, uu)) : 0);
        to(u.copy(PC.plat).lerp(PC.platSoil, sm(.55, .75, vnoise(x * .45, z * .45, 67))), w * km, n); to(PC.cliff, w * (1 - sm(.55, .85, ny)) * km, n); } }
      // 熔岩流：近乎黑色帶一點紫，邊緣更暗
      if (inBox(FL, x, z, 5) || FLOB.some(([lx, lz, lr]) => Math.hypot(x - lx, z - lz) < lr + 1)) { const q = inBox(FL, x, z, 5) ? near(FL, x, z) : null, T = flowT(x, z, q); if (T > .01) { const w = sm(.02, .2, T); to(PC.flow, w * km, n); to(PC.flowEdge, w * (1 - sm(.6, .88, ny)) * .8 * km, n); } }
      // 熔岩丘：灰色的硬殼（比周圍的地面冷、亮一點，遠遠就看得出一顆一顆），丘頂裂開的地方暗下去
      if (inTU(x, z)) for (const tu of TU) { const [uu, vv] = tuUV(tu, x, z), q = uu * uu + vv * vv; if (q < 1.25) { to(u.copy(PC.plat).lerp(PC.ash, .25), (1 - sm(.7, 1.2, q)) * .92 * km, n); to(PC.flowEdge, (1 - sm(0, .25, q)) * .55 * km, n); } }
      // 熔岩河的堤岸與熔岩湖的湖岸：深色
      if (inBox(RV, x, z, 4)) { const q = near(RV, x, z); to(PC.levee, (1 - sm(2.2, 3.2, q.l)) * km, n); }
      { const d = Math.hypot(x - LK.x, z - LK.z); if (d < LK.r + 4) to(PC.levee, (1 - sm(LK.r + 1.6, LK.r + 3.2, d)) * km, n); }
      // 小火山錐：紅褐色的火山渣，越高越紅；火山口裡面暗
      for (const c of CC) { const d = Math.hypot(x - c.x, z - c.z); if (d < c.rb + .6) { const a = coneAdd(c, x, z) / c.hc; to(u.copy(PC.cinder).lerp(PC.cinderTop, sm(.4, .9, a)).lerp(PC.cinderIn, d < c.rt ? 1 - sm(c.rf, c.rt, d) : 0), (1 - sm(c.rb * .72, c.rb + .4, d)) * km, n); } }
      // 硫磺：噴口與硫磺池周圍一圈黃（中心偏白），往外變成暗黃褐；噴口保護區裡也要上色，所以只看區域邊界
      { let ws = 0, wp = 0; for (const [vx, vz] of VENTS) if (vx > 20 && vz > -100) { const d = Math.hypot(x - vx, z - vz), r = 3.1 * (.8 + .4 * vnoise(x * .6, z * .6, 71)); ws = Math.max(ws, 1 - sm(r * .4, r, d)); wp = Math.max(wp, 1 - sm(.5, 1.6, d)); }
        { const d = Math.hypot(x - SU.x, z - SU.z), r = 5.4 * (.85 + .3 * vnoise(x * .5, z * .5, 73)); ws = Math.max(ws, 1 - sm(r * .5, r, d)); wp = Math.max(wp, 1 - sm(SU.r * 1.05, SU.r * 1.6, d)); }
        if (ws > 0) to(u.copy(PC.sulfOut).lerp(PC.sulf, sm(.2, .7, ws)).lerp(PC.sulfPale, wp * .8), ws * e, n); }
      C.setXYZ(i, o.r, o.g, o.b);
    }
    C.needsUpdate = true;
  }

  /* ---------- 物件 ---------- */
  // 六角柱：側面與頂面分開上色（底不封），非索引幾何＋頂點色（合併時沿用自己的顏色）；rot 是第一個角的方向
  function hexCol(r, h, cs, ct, rot = 0) {
    const p = [], c = [], A = [0, 1, 2, 3, 4, 5].map(k => [Math.cos(rot + k * Math.PI / 3) * r, Math.sin(rot + k * Math.PI / 3) * r]), S = new THREE.Color(cs), T = new THREE.Color(ct);
    const v = (x, y, z, k) => { p.push(x, y, z); c.push(k.r, k.g, k.b); };
    for (let k = 0; k < 6; k++) { const [x0, z0] = A[k], [x1, z1] = A[(k + 1) % 6]; v(x0, 0, z0, S); v(x1, h, z1, S); v(x1, 0, z1, S); v(x0, 0, z0, S); v(x0, h, z0, S); v(x1, h, z1, S); }
    for (let k = 1; k < 5; k++) { v(A[0][0], h, A[0][1], T); v(A[k + 1][0], h, A[k + 1][1], T); v(A[k][0], h, A[k][1], T); }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(p, 3)); g.setAttribute('color', new THREE.Float32BufferAttribute(c, 3)); return g;
  }
  const SIDE = ['#3d3b43', '#47444d', '#35333b', '#4e4a52'], CAP = ['#77717a', '#69646e', '#837c84', '#706a74']; // 玄武岩：偏冷的灰（在橘色的光下才是灰色）
  // 耐旱植物：0 一叢乾草、1 長著小花的墊狀植物、2 兩三朵小火焰花（都很小，合併進各區的網格）
  function plant(kt, M, wx, wz, k, s, rd) {
    const B = M4(wx, H(wx, wz) - .02, wz, 0, rd() * 6.28, 0, s), add = (geo, col, m) => kt.add(M.flat, geo, col, B.clone().multiply(m));
    if (k === 0) for (let i = 0; i < 6; i++) add(new THREE.ConeGeometry(.026, .34 + (i % 3) * .08, 3), i % 2 ? '#b8a75e' : '#9d904f', M4(Math.cos(i * 1.1) * .07, .16, Math.sin(i * 1.1) * .07, Math.cos(i * 2.3) * .32, 0, Math.sin(i * 2.3) * .32));
    else if (k === 1) { add(new THREE.SphereGeometry(.24, 7, 3, 0, PI2, 0, Math.PI / 2), '#5f8d47', M4(0, -.02, 0, 0, 0, 0, 1, .55, 1)); for (let i = 0; i < 6; i++) add(new THREE.TetrahedronGeometry(.045), i % 2 ? '#f9a8d4' : '#fef3c7', M4(Math.cos(i * 1.05) * .13, .11, Math.sin(i * 1.05) * .13, i, i * 2, 0)); }
    else for (let i = 0; i < 3; i++) { const px = (i - 1) * .13, pz = (i % 2) * .09, h = .22 + i * .06; add(new THREE.CylinderGeometry(.009, .013, h, 3), '#4d7c3a', M4(px, h / 2, pz)); for (let p = 0; p < 5; p++) add(new THREE.TetrahedronGeometry(.04), i === 1 ? '#f97316' : '#fb7185', M4(px + Math.cos(p * 1.26) * .04, h + .01, pz + Math.sin(p * 1.26) * .04, p, p * 2, 0, 1, .55, 1)); add(new THREE.TetrahedronGeometry(.022), '#fde047', M4(px, h + .03, pz)); }
  }
  // 一顆壓扁的深色岩石（rk 是 game.js 的低面數隨機岩石）
  // LOW：小石頭改用八面體（8 個三角形，十二面體是 36 個）；石頭一多，三角形大半都在這裡
  const rock = (kt, M, x, z, s, col, seed, rd, sink = .25, sy = .65) => kt.add(M.flat, LOW && s < .34 ? jit(new THREE.OctahedronGeometry(1, 0), .38, seed) : rk(seed), col, M4(x, H(x, z) - s * sink, z, rd() * .4, rd() * 6.28, rd() * .3, s * 1.15, s * sy, s));
  // 熔岩的貼圖：橘紅底、亮黃色的流紋、深色的結殼（沿 v 重複；捲動貼圖就像在流）
  function lavaTex() {
    const c = document.createElement('canvas'); c.width = 128; c.height = 256; const g = c.getContext('2d'), r = seeded(77);
    g.fillStyle = '#df4f1b'; g.fillRect(0, 0, 128, 256); g.lineCap = 'round';
    for (let k = 0; k < 6; k++) { const x0 = 10 + k * 21 + r() * 6, amp = 4 + r() * 6, ph = r() * 6.28; g.strokeStyle = k % 2 ? '#ffae3a' : '#ffd36a'; g.lineWidth = 3 + r() * 4; g.beginPath(); for (let y = 0; y <= 256; y += 8) { const x = x0 + Math.sin(y / 256 * PI2 * 2 + ph) * amp; y ? g.lineTo(x, y) : g.moveTo(x, y); } g.stroke(); }
    for (let k = 0; k < 9; k++) {
      const cx = 12 + r() * 104, cy = r() * 256, s = 8 + r() * 13, n = 5 + Math.floor(r() * 3), pts = [...Array(n)].map((_, i) => [Math.cos(i / n * PI2) * s * (.7 + r() * .5), Math.sin(i / n * PI2) * s * (.6 + r() * .5)]);
      for (const oy of [-256, 0, 256]) { g.beginPath(); pts.forEach(([px, py], i) => i ? g.lineTo(cx + px, cy + py + oy) : g.moveTo(cx + px, cy + py + oy)); g.closePath(); g.fillStyle = '#4a1d12'; g.fill(); g.strokeStyle = '#ff9a3c'; g.lineWidth = 2.5; g.stroke(); }
    }
    const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t;
  }
  // 粒子（蒸氣、火星）：src＝[[x, y, z, 半徑]]，每顆從某個源頭升起、慢慢淡出；只在附近時才更新與繪製
  function puffs(src, n, o) {
    const g = new THREE.BufferGeometry(), p = new Float32Array(n * 3), col = new Float32Array(n * 4), L = [...Array(n)].map((_, i) => ({ k: i / n, s: i % src.length, a: Math.random() * PI2, r: Math.random() }));
    g.setAttribute('position', new THREE.BufferAttribute(p, 3)); g.setAttribute('color', new THREE.BufferAttribute(col, 4));
    const pts = new THREE.Points(g, new THREE.PointsMaterial({ size: o.size, map: dotTex(), vertexColors: true, transparent: true, depthWrite: false, blending: o.add ? THREE.AdditiveBlending : THREE.NormalBlending }));
    pts.frustumCulled = false; pts.visible = false; W.scene.add(pts); const C3 = new THREE.Color(o.col);
    return { pts, step(dt, op) {
      for (let i = 0; i < n; i++) {
        const q = L[i], S = src[q.s]; q.k += dt * o.v; if (q.k > 1) { q.k -= 1; q.a = Math.random() * PI2; q.r = Math.random(); }
        p[i * 3] = S[0] + Math.cos(q.a) * q.r * S[3] + Math.sin(q.k * 5 + i) * q.k * o.sway; p[i * 3 + 1] = S[1] + q.k * o.rise; p[i * 3 + 2] = S[2] + Math.sin(q.a) * q.r * S[3] + Math.cos(q.k * 4 + i) * q.k * o.sway;
        col[i * 4] = C3.r; col[i * 4 + 1] = C3.g; col[i * 4 + 2] = C3.b; col[i * 4 + 3] = Math.sin(q.k * Math.PI) * op;
      }
      g.attributes.position.needsUpdate = true; g.attributes.color.needsUpdate = true;
    } };
  }

  const V = {}; // 每格更新要用到的東西（regionStep）
  function build() {
    prep(); paint();
    const M = nookMats(), rd = seeded(4517), c00 = W.chunks.length;
    // 各區一組合併網格（cullChunks 依距離剔除）；LOW 只分南北兩組，繪製呼叫少一點
    const KT = {}, kit = k => { const key = LOW ? 'all' : k; return KT[key] || (KT[key] = nookKit()); }, gk = nookKit();
    const FAR = { sw: 170, s: 150, se: 150, ne: 160, nw: 130, all: 999 }, Q = LOW ? .55 : 1; // LOW 整區一組（少一兩個繪製呼叫），由霧與視錐剔除

    /* ---- 六角台地 ---- */
    {
      const kt = kit('sw'), top = PA.top * K, [ux, uz] = PA_U, nx = -uz, nz = ux, ra = Math.atan2(uz, ux);
      const col = (x, z, r, y0, y1, solid, rot) => { kt.add(M.flat, hexCol(r, y1 - y0, pk(SIDE, rd), pk(CAP, rd), rot == null ? rd() * 1.05 : rot), null, M4(x, y0, z)); if (solid) addCol({ x, z, r: r * .92 }); };
      // 斷崖：沿外緣三排柱子，外排越低（一階一階）；最內排比台頂高一點，像一圈矮牆（有碰撞，不會一腳踩空），坡道那段留空
      // 柱高沿著外緣緩緩起伏（像管風琴），再加一點隨機：全隨機的話遠看是一排鋸齒，像柵欄
      const tops = [];
      [[.05, .12, .7, 1], [.62, -1.6, -.9, 0], [1.18, -3, -2.25, 1]].forEach(([o, lo, hi, solid]) => {
        for (let a = -Math.PI; a < Math.PI;) {
          const rho = paR(a) + o, r = .4 + rd() * .14;
          if (Math.abs(wa(a - PA.ra)) > .34) {
            const x = (PA.x + Math.cos(a) * rho) * K, z = (PA.z + Math.sin(a) * rho) * K, y0 = Math.min(H(x, z), H(x + Math.cos(a) * 1.7, z + Math.sin(a) * 1.7)) - .45, y1 = Math.max(y0 + .5, top + lo + (hi - lo) * (.12 + .62 * (.5 + .5 * Math.sin(a * 4 + o * 5)) + .26 * rd()));
            col(x, z, r, y0, y1, solid); if (o > .5) tops.push([x, z, y1, a, r]);
          }
          a += (r * 1.8 + .05) / (rho * K);
        }
      });
      // 螢光苔：斷崖的柱頂上幾叢，集中在五個方向（朝隧道出口、朝小徑盡頭、朝火山、西南、西北），不是每根都有；白天是淡淡的青綠色，夜裡發光，台地夜裡才不是一整片黑牆
      const MOSS = [.9, .3, -.8, 2.3, -2.4];
      tops.forEach(([x, z, y, a, r]) => {
        if (!MOSS.some(m => Math.abs(wa(a - m)) < .24) || rd() < .35) return;
        for (let i = 0, n = rd() < .5 ? 2 : 1; i < n; i++) { const s = (.13 + rd() * .1) * (i ? .7 : 1), ox = (rd() - .5) * r * .9, oz = (rd() - .5) * r * .9; gk.add(M.night, new THREE.SphereGeometry(1, 6, 3, 0, PI2, 0, Math.PI / 2), pk(['#2fb38f', '#45c79e', '#2a9d84'], rd), M4(x + ox, y - .01, z + oz, 0, rd() * 6, 0, s * 1.3, s * .55, s)); }
      });
      // 台頂外圈兩排柱頂（和地面齊平），看起來整座台地都是柱子撐起來的
      [.52, 1.04].forEach(o => { for (let a = -Math.PI; a < Math.PI;) { const rho = paR(a) - o, r = .42 + rd() * .1, x = (PA.x + Math.cos(a) * rho) * K, z = (PA.z + Math.sin(a) * rho) * K, y = H(x, z); col(x, z, r, y - .35, y + .03 + rd() * .06, 0); a += (r * 1.8 + .05) / (rho * K); } });
      // 台頂中間只有幾小片柱頂露出土面（不鋪滿，疏密有致）：中間一塊、周圍六塊挑幾塊
      (LOW ? [] : [[-.8, 2.3], [2.3, -.9], [-.3, -2.9]]).forEach(([px, pz]) => { const cx = (PA.x + px) * K, cz = (PA.z + pz) * K, r = .45; [[0, 0], ...[0, 1, 2, 3, 4, 5].filter(() => rd() < .7).map(k => [Math.cos(Math.PI / 6 + k * Math.PI / 3) * r * 1.74, Math.sin(Math.PI / 6 + k * Math.PI / 3) * r * 1.74])].forEach(([ox, oz]) => { const x = cx + ox, z = cz + oz, y = H(x, z); col(x, z, r, y - .3, y + .02 + rd() * .1, 0, 0); }); });
      // 坡道：交錯排列的柱頂當踏階（每塊的下坡邊緣露出一點，看起來一階一階）；兩側一排排往下的柱子當扶手
      for (let i = 0, u = PA_RR - .9; u < PA_RR + 6.4; u += .45, i++) for (let v = -1.82 + (i % 2) * .26; v <= 1.83; v += .52) { const x = (PA.x + ux * u + nx * v) * K, z = (PA.z + uz * u + nz * v) * K, y = H(x, z); col(x, z, .47, y - .5, y + .07, 0, ra); }
      [-1, 1].forEach(sd => { for (let u = PA_RR - .2; u < PA_RR + 6.3; u += .55) [[2.25, .3, .85, 1], [2.8, -.6, .05, 0]].slice(0, LOW ? 1 : 2).forEach(([v, lo, hi, solid]) => { const x = (PA.x + ux * u + nx * v * sd) * K, z = (PA.z + uz * u + nz * v * sd) * K, foot = H(x + nx * sd * 1.3, z + nz * sd * 1.3) - .4; col(x, z, .38 + rd() * .1, foot, Math.max(foot + .45, rampH(u) * K + lo + rd() * (hi - lo)), solid); }); });
      // 倒下的兩截柱子、北邊崖頂朝火山口的小石堆、台頂幾叢耐旱植物
      [[1.4, -2.2, .4], [-1.8, 1.2, 2.1]].forEach(([px, pz, ry]) => { const x = (PA.x + px) * K, z = (PA.z + pz) * K; kt.add(M.flat, hexCol(.34, 1.5, pk(SIDE, rd), pk(CAP, rd)), null, M4(x, H(x, z) + .24, z, 0, ry, Math.PI / 2).multiply(M4(0, -.75, 0))); });
      { const a = Math.atan2(-130 - PA.z, -PA.x), rho = paR(a) - 1.9, x = (PA.x + Math.cos(a) * rho) * K, z = (PA.z + Math.sin(a) * rho) * K; let y = H(x, z); [[.42, .16], [.33, .15], [.25, .13], [.17, .11]].forEach(([r, h], i) => { kt.add(M.flat, rk(560 + i), i % 2 ? '#5f5c66' : '#75717b', M4(x + (i % 2 - .5) * .05, y + h / 2, z, 0, i, 0, r, h * .85, r * .9)); y += h; }); addCol({ x, z, r: .45 }); }
      [[0, 0, 1], [2.4, 1.6, 0], [-2.3, -1.2, 2], [1.2, -3.4, 1], [-3.2, 1.9, 0], [3.4, -1, 2], [-1, 3.3, 1]].slice(0, LOW ? 4 : 7).forEach(([px, pz, k]) => { for (let j = 0; j < 2; j++) plant(kt, M, (PA.x + px) * K + (rd() - .5) * 1.4, (PA.z + pz) * K + (rd() - .5) * 1.4, (k + j) % 3, .9 + rd() * .5, rd); });
    }

    /* ---- 熔岩丘：頂上沿長軸裂開（大的再多一道橫裂），裂縫透出紅光，兩邊是翻起來的硬殼；丘腳長了幾叢乾草和小花 ---- */
    {
      const kt = kit('sw'), lips = ['#2b2931', '#34313a', '#3a3640'], lamp = ['#ff5a1f', '#ff7a2e', '#ffa040'];
      TU.forEach((t, j) => {
        const c = Math.cos(t[5]), s = Math.sin(t[5]), at = (u, v) => [(t[0] + c * u * t[2] - s * v * t[3]) * K, (t[1] + s * u * t[2] + c * v * t[3]) * K];
        [[-.62, .6, 0], ...(t[2] > 3 ? [[-.42, .38, 1]] : [])].forEach(([a, b, cross]) => {
          const n = Math.max(3, Math.round((b - a) * (cross ? t[3] : t[2]) * K / .5)), ry = cross ? -Math.atan2(c, -s) : -t[5];
          for (let i = 0; i < n; i++) {
            const f = a + (b - a) * (i + .5) / n, w = .07 * Math.sin(f * 9 + j * 2), [x, z] = cross ? at(w, f) : at(f, w), y = H(x, z), nx = cross ? c : -s, nz = cross ? s : c;
            gk.add(M.lamp, new THREE.BoxGeometry(.55 + rd() * .2, .07, .14 + rd() * .08), pk(lamp, rd), M4(x, y + .02, z, 0, ry + (rd() - .5) * .35, 0));
            [-1, 1].forEach(sd => { if (rd() < (LOW ? .4 : .8)) rock(kt, M, x + nx * sd * (.24 + rd() * .06), z + nz * sd * (.24 + rd() * .06), .16 + rd() * .1, pk(lips, rd), 1000 + (i * 2 + j * 17 + (sd > 0)) % 40, rd, .05, .5); });
          }
        });
        for (let i = 0; i < (LOW ? 1 : 2); i++) { const a = rd() * PI2, [x, z] = at(Math.cos(a) * 1.05, Math.sin(a) * 1.05); plant(kt, M, x, z, (i + j) % 3, .9 + rd() * .4, rd); }
      });
    }

    /* ---- 冷卻的熔岩流 ---- */
    {
      // 熔岩流表面偏冷的深灰紫（地面上色見 paint），繩紋比表面亮一點才看得出一條一條；前緣的岩塊更暗
      const kt = kit('s'), rp = ['#4a4652', '#55505e', '#423f4a'], dark = ['#2b2931', '#34313a', '#25232a'], lamp = ['#ff5a1f', '#ff7a2e', '#ffa040'];
      const rope = pts => { const c = new THREE.CatmullRomCurve3(pts.map(([x, z]) => new THREE.Vector3(x, H(x, z) + .03, z))); kt.add(M.flat, new THREE.TubeGeometry(c, LOW ? 6 : 10, .07 + rd() * .03, LOW ? 3 : 4, false), pk(rp, rd)); };
      const inLobe = (x, z, skip) => FLOB.some(([lx, lz, lr], j) => j !== skip && Math.hypot(x - lx, z - lz) < lr - .35);
      // 繩狀紋路：橫過熔岩流的弧（中間往下游凸），平地上的比較密
      for (let s = .16; s < .975; s += (s < .62 ? .06 : .03) / Q) { const p = along(FL, s), w = flW(s), nx = -p.tz, nz = p.tx, pts = []; for (let k = 0; k <= 6; k++) { const lam = k / 3 - 1, l = lam * w * .72, off = -lam * lam * w * .3 + (rd() - .5) * .08; pts.push([(p.x + nx * l + p.tx * off) * K, (p.z + nz * l + p.tz * off) * K]); } rope(pts); }
      // 兩個前緣：同心的弧形繩紋、前緣一圈結殼的岩塊，岩塊之間的縫還在發紅
      FLOB.forEach(([lx, lz, lr], j) => {
        const E = FL.P[FL.P.length - 1], a0 = Math.atan2(lz - E[1], lx - E[0]);
        [.42, .6, .78].forEach(f => { const pts = []; for (let k = 0; k <= 8; k++) { const a = a0 + (k / 8 - .5) * 2.4; pts.push([(lx + Math.cos(a) * lr * f) * K, (lz + Math.sin(a) * lr * f) * K]); } rope(pts); });
        for (let a = a0 - 1.6; a < a0 + 1.6; a += .95 / (lr * K)) {
          const bx = lx + Math.cos(a) * lr, bz = lz + Math.sin(a) * lr; if (inLobe(bx, bz, j) || near(FL, bx, bz).l < flW(1) - .6) continue;
          const x = bx * K, z = bz * K; rock(kt, M, x, z, .24 + rd() * .2, pk(dark, rd), 600 + Math.floor(rd() * 40), rd, .2, .55);
          if (rd() < .6) { const cx = (lx + Math.cos(a + .1) * (lr + .22)) * K, cz = (lz + Math.sin(a + .1) * (lr + .22)) * K; gk.add(M.lamp, new THREE.BoxGeometry(.6 + rd() * .55, .07, .12), pk(lamp, rd), M4(cx, H(cx, cz) + .03, cz, 0, -a + Math.PI / 2 + (rd() - .5) * .4, 0)); }
        }
      });
      // 平地上那段的兩側邊緣：岩塊與發紅的縫；山坡上的只放零星幾塊
      [-1, 1].forEach(sd => { for (let s = .2; s < .97; s += (s < .62 ? .1 : .045) / Q) { const p = along(FL, s), l = (flW(s) + .05) * sd, bx = p.x - p.tz * l, bz = p.z + p.tx * l; if (inLobe(bx, bz, -1)) continue; const x = bx * K, z = bz * K; rock(kt, M, x, z, .22 + rd() * .22, pk(dark, rd), 640 + Math.floor(rd() * 40), rd, .2, .55); if (s > .62 && rd() < .45) gk.add(M.lamp, new THREE.BoxGeometry(.5 + rd() * .45, .06, .1), pk(lamp, rd), M4(x + p.tx * .5, H(x + p.tx * .5, z + p.tz * .5) + .02, z + p.tz * .5, 0, Math.atan2(-p.tz, p.tx) + (rd() - .5) * .5, 0)); } });
      // 中間還沒完全冷掉的地方：幾道發紅的裂縫與擠出來的熔岩小丘
      for (let i = 0; i < 9; i++) { const s = .7 + rd() * .28, p = along(FL, s), l = (rd() - .5) * flW(s), x = (p.x - p.tz * l) * K, z = (p.z + p.tx * l) * K; gk.add(M.lamp, new THREE.BoxGeometry(.8 + rd() * .6, .05, .09), pk(lamp, rd), M4(x, H(x, z) + .03, z, 0, Math.atan2(-p.tz, p.tx) + Math.PI / 2 + (rd() - .5) * .8, 0)); if (i % 3 === 0) rock(kt, M, x + .4, z + .3, .3, '#25232a', 680 + i, rd, .1, .5); }
      // 比較老的上游那段，縫裡已經長出幾叢小草和小花
      for (let i = 0; i < (LOW ? 3 : 6); i++) { const s = .3 + rd() * .4, p = along(FL, s), l = (flW(s) - .6) * (i % 2 ? 1 : -1), x = (p.x - p.tz * l) * K, z = (p.z + p.tx * l) * K; plant(kt, M, x, z, i % 3, .8 + rd() * .4, rd); }
    }

    /* ---- 噴氣孔區：硫磺池、噴口的硫磺結晶、兩座小火山錐 ---- */
    {
      const kt = kit('se'), sv = VENTS.filter(([x, z]) => x > 20 && z > -100), yel = ['#facc15', '#fde047', '#eab308', '#fbbf24'], scoria = ['#6e3a2a', '#5a3024', '#7d4430'];
      const crystal = (x, z, s) => { const y = H(x, z); for (let k = 0; k < (LOW ? 3 : 4); k++) gk.add(M.night, new THREE.OctahedronGeometry(.08 + rd() * .06, 0), k === 3 && rd() < .4 ? '#f59e0b' : pk(yel, rd), M4(x + (rd() - .5) * .32 * s, y + .05, z + (rd() - .5) * .32 * s, (rd() - .5) * .6, rd() * 3, (rd() - .5) * .6, .8 * s, (1.3 + rd()) * s, .8 * s)); };
      const crust = (x, z, s, c) => kt.add(M.flat, new THREE.CircleGeometry(1, 7).rotateX(-Math.PI / 2), c, M4(x, H(x, z) + .015, z, 0, rd() * 6.28, 0, s * (.7 + rd() * .6), 1, s * (.5 + rd() * .5)));
      sv.forEach(([bx, bz]) => { const x0 = bx * K, z0 = bz * K; for (let i = 0; i < 7; i++) { const a = i / 7 * PI2 + rd() * .5, r = 1.1 + rd() * .6; crystal(x0 + Math.cos(a) * r, z0 + Math.sin(a) * r, .8 + rd() * .5); if (i % 2) crust(x0 + Math.cos(a + .4) * (r + .5), z0 + Math.sin(a + .4) * (r + .5), .35 + rd() * .3, rd() < .5 ? '#e8d47c' : '#d6bb52'); } });
      // 硫磺池：乳白帶綠的藍色池水，池邊的石頭頂上結著黃色的硫磺
      const px = SU.x * K, pz = SU.z * K, wy = (SU.lv - .12) * K, rf = a => suR(a) * K;
      kt.add(M.water, nookDisc(px, wy, pz, a => rf(a) * 1.03, ['#4cc9c0', '#cfe39a']), null);
      for (let i = 0; i < 15; i++) { const a = i / 15 * PI2 + rd() * .2, r = rf(a) * (1.06 + rd() * .1), x = px + Math.cos(a) * r, z = pz + Math.sin(a) * r, s = .26 + rd() * .3; rock(kt, M, x, z, s, i % 3 ? '#4a3f37' : '#5a4b3c', 720 + i, rd, .15, .6); if (i % 2 === 0) kt.add(M.flat, new THREE.SphereGeometry(s * .55, 7, 3, 0, PI2, 0, Math.PI / 2), '#e8c547', M4(x, H(x, z) + s * .2, z, 0, 0, 0, 1.3, .3, 1.1)); if (i % 3 === 1) crystal(x + Math.cos(a) * .5, z + Math.sin(a) * .5, .9); }
      for (let i = 0; i < 9; i++) { const a = rd() * PI2, r = rf(a) * (1.4 + rd() * 1.2); crust(px + Math.cos(a) * r, pz + Math.sin(a) * r, .45 + rd() * .5, rd() < .5 ? '#eadb93' : '#d9c464'); }
      // 大火山錐：山腰撒著紅褐色的火山渣、山腳幾顆火山彈；火山口底是發紅的餘燼，三隻熔岩史萊姆擠在一起睡覺（一隻餘燼色的在旁邊）
      CC.forEach((c, ci) => {
        const cx = c.x * K, cz = c.z * K;
        for (let i = 0; i < Math.round((ci ? 16 : 40) * Q); i++) { const a = rd() * PI2, r = (c.rt + .5 + rd() * (c.rb - c.rt - 1)) * K; if (c.br != null && Math.abs(wa(a - c.br)) < .32) continue; rock(kt, M, cx + Math.cos(a) * r, cz + Math.sin(a) * r, .1 + rd() * .16, pk(scoria, rd), 760 + i, rd, .2, .7); }
        for (let i = 0; i < (ci ? 2 : 5); i++) { const a = rd() * PI2, r = (c.rb + .2 + rd() * 1.5) * K; rock(kt, M, cx + Math.cos(a) * r, cz + Math.sin(a) * r, .35 + rd() * .3, '#3a2a26', 800 + i, rd, .3, .85); }
        const fy = H(cx, cz); for (let i = 0; i < (ci ? 4 : 10); i++) { const a = rd() * PI2, r = rd() * c.rf * K * .8; gk.add(M.lamp, new THREE.CircleGeometry(.1 + rd() * .12, 5).rotateX(-Math.PI / 2), pk(['#ff6a1f', '#ff8a3d', '#ffb347'], rd), M4(cx + Math.cos(a) * r, H(cx + Math.cos(a) * r, cz + Math.sin(a) * r) + .025, cz + Math.sin(a) * r)); }
        if (!ci) { [[-.45, .15, .62, '#fb923c'], [.3, -.35, .55, '#fb923c'], [.25, .45, .5, '#f97316'], [-.2, -.75, .42, '#ff7a59']].forEach(([ox, oz, s, cl], i) => { const x = cx + ox * K, z = cz + oz * K; gk.add(M.night, toyGeo(cl, true), null, M4(x, H(x, z) - .02, z, 0, Math.atan2(-ox, -oz) + (i - 1.5) * .5, 0, s)); }); V.nest = [cx, fy, cz]; }
      });
      // 噴口與硫磺池：夜裡燒出的藍色火焰（硫磺燃燒）；白天看不到（不畫）
      // 火焰從噴口的石頭中間冒出來（石頭約 0.5 公尺高，所以底部墊高），一個噴口四簇
      const fl = []; sv.forEach(([bx, bz]) => { for (let k = 0; k < 4; k++) { const a = k / 4 * PI2 + rd() * .8, r = .12 + rd() * .32; fl.push({ x: bx * K + Math.cos(a) * r, z: bz * K + Math.sin(a) * r, s: .95 + rd() * .5, p: rd() * 9, y0: .22 }); } });
      for (let k = 0; k < 4; k++) { const a = k / 4 * PI2 + .6, r = rf(a) * 1.12; fl.push({ x: px + Math.cos(a) * r, z: pz + Math.sin(a) * r, s: .6 + rd() * .3, p: rd() * 9, y0: .03 }); }
      fl.forEach(f => { f.y = H(f.x, f.z) + f.y0; });
      // 火焰是兩層水滴形（半球底＋圓錐尖），疊加混色：外層深藍、內層淡藍，看起來是一團柔柔的光，不是冰晶
      const tear = (r, h, c, y) => [[new THREE.SphereGeometry(r, 8, 4, 0, PI2, Math.PI / 2, Math.PI / 2), c, M4(0, y, 0, 0, 0, 0, 1, .75, 1)], [new THREE.ConeGeometry(r, h, 8, 1, true), c, M4(0, y + h / 2, 0)]];
      const fg = mergeParts([...tear(.24, .62, '#12307f', .2), ...tear(.13, .4, '#2f6fd6', .17)]);
      const fim = new THREE.InstancedMesh(fg, new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false, side: THREE.DoubleSide }), fl.length);
      fim.frustumCulled = false; fim.visible = false; W.scene.add(fim); V.blue = { im: fim, fl, x: px, z: pz };
      // 蒸氣：硫磺池與兩座火山錐的火山口（原有的噴口自己有蒸氣）
      V.steam = puffs([[px, wy + .1, pz, rf(0) * .8], [px, wy + .1, pz, rf(0) * .8], ...CC.map(c => [c.x * K, H(c.x * K, c.z * K) + .2, c.z * K, c.rf * K * .6])], LOW ? 16 : 30, { size: 2.2, col: '#f4f1ea', v: .13, rise: 4.2, sway: .5 });
      V.steamAt = [px, pz];
      // 東邊的丘陵上：零星的乾草與墊狀植物
      HL.filter(([x]) => x > 0).forEach(([hx, hz, r], j) => { for (let i = 0; i < (LOW ? 2 : 4); i++) { const a = rd() * PI2, d = rd() * r * .6; plant(kt, M, (hx + Math.cos(a) * d) * K, (hz + Math.sin(a) * d) * K, (i + j) % 2, .9 + rd() * .5, rd); } });
      // 丘頂的岩柱（hoodoo）：底粗、中段一鼓一縮、頂下細細的脖子撐著一塊寬寬的硬蓋石，整根微微歪向一邊；岩層只有一深一淺兩種、偶爾一道淺色帶
      // （原本是等比例往上收細＋四色輪流的條紋，遠看像一根根工廠煙囪）；最高那根的蓋石上長了一小叢草
      PIL.forEach(([bx, bz, h, r0], j) => {
        const x = bx * K, z = bz * K, g = H(x, z), la = rd() * PI2, lean = .025 + rd() * .03, n = Math.max(3, Math.round(h / 1.15));
        const rf = f => r0 * (1 - .42 * f + .13 * Math.sin(f * 7.2 + j * 1.7)) * (1 - .38 * sm(.72, 1, f)); // 高度比例 → 半徑
        let y = g - .3, ox = 0, oz = 0;
        for (let k = 0; k < n; k++) {
          const f0 = k / n, f1 = (k + 1) / n, sh = (h + .3) / n;
          kt.add(M.flat, jit(new THREE.CylinderGeometry(rf(f1), rf(f0), sh + .04, 7, 1), .1, 950 + j * 9 + k), k % 3 === 2 ? '#6e4e3f' : k % 2 ? '#523a33' : '#5c4239', M4(x + ox, y, z + oz, 0, k * .9, 0).multiply(M4(0, sh / 2, 0)));
          y += sh; ox += Math.cos(la) * lean * sh; oz += Math.sin(la) * lean * sh;
        }
        const rc = rf(1) * 2.3 + .12;
        kt.add(M.flat, jit(new THREE.CylinderGeometry(rc * .82, rc, .42, 7), .16, 990 + j), '#3a3034', M4(x + ox, y + .17, z + oz, (rd() - .5) * .16, rd() * 6, (rd() - .5) * .16));
        kt.add(M.flat, jit(new THREE.CylinderGeometry(rc * .45, rc * .75, .22, 7), .2, 995 + j), '#453a3c', M4(x + ox, y + .48, z + oz, 0, rd() * 6, 0));
        if (!j) for (let i = 0; i < 6; i++) kt.add(M.flat, new THREE.ConeGeometry(.03, .32 + (i % 3) * .08, 3), i % 2 ? '#8fae5a' : '#a9b86a', M4(x + ox + Math.cos(i * 1.1) * .12, y + .7, z + oz + Math.sin(i * 1.1) * .12, Math.cos(i * 2.3) * .3, 0, Math.sin(i * 2.3) * .3));
        addCol({ x, z, r: r0 + .05 });
      });
    }

    /* ---- 熔岩河與熔岩湖 ---- */
    {
      const kt = kit('ne'), dark = ['#2a2220', '#33292a', '#231d1c'], lamp = ['#ff5a1f', '#ff7a2e', '#ffa040'], tex = lavaTex(), hw = .95 * K;
      // 河面：沿中心線的帶子（略高於挖低的河床，兩邊壓在堤岸底下）；湖面：一個圓盤，v 從河口往外增加，貼圖捲動時像熔岩從河口往外推
      const pos = [], uvs = [], idx = [], N = Math.ceil(RV.L * K / .7);
      for (let i = 0; i <= N; i++) { const p = along(RV, i / N), x = p.x * K, z = p.z * K, y = H(x, z) + .14, v = i / N * RV.L * K / 4; pos.push(x - p.tz * hw, y, z + p.tx * hw, x + p.tz * hw, y, z - p.tx * hw); uvs.push(0, v, 1, v); if (i) { const a = (i - 1) * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); } }
      const E = RV.P[RV.P.length - 1], ex = E[0] * K, ez = E[1] * K, v0 = RV.L * K / 4, lx = LK.x * K, lz = LK.z * K, ly = (LK.lv - .2) * K, b0 = pos.length / 3, SEG = 30;
      pos.push(lx, ly, lz); uvs.push(.5, v0 + Math.hypot(lx - ex, lz - ez) / 4);
      for (let k = 0; k <= SEG; k++) { const a = k / SEG * PI2, r = (lkR(a) + .05) * K, x = lx + Math.cos(a) * r, z = lz + Math.sin(a) * r; pos.push(x, ly, z); uvs.push(.5 + ((x - ex) * RN[0] + (z - ez) * RN[1]) / (4 * hw), v0 + Math.hypot(x - ex, z - ez) / 4); if (k) idx.push(b0, b0 + k + 1, b0 + k); }
      const lg = new THREE.BufferGeometry(); lg.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); lg.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2)); lg.setIndex(idx); lg.computeBoundingSphere();
      const lm = new THREE.MeshBasicMaterial({ map: tex, toneMapped: false, side: THREE.DoubleSide }), lava = new THREE.Mesh(lg, lm); chunkObj(lava, 260, false); V.lava = { tex, m: lm };
      // 堤岸上的結殼岩塊、緊貼河面兩側的發紅縫隙
      [-1, 1].forEach(sd => { for (let s = .03; s < .97; s += 1.3 / (RV.L * K) / Q) { const p = along(RV, s), l = (1.3 + rd() * .25) * sd, x = (p.x - p.tz * l) * K, z = (p.z + p.tx * l) * K; rock(kt, M, x, z, .28 + rd() * .26, pk(dark, rd), 820 + Math.floor(rd() * 40), rd, .25, .6); if (rd() < .5) { const l2 = 1.02 * sd, x2 = (p.x - p.tz * l2) * K, z2 = (p.z + p.tx * l2) * K; gk.add(M.lamp, new THREE.BoxGeometry(.06, .04, .6 + rd() * .5), pk(lamp, rd), M4(x2, H(x2, z2) + .1, z2, 0, Math.atan2(p.tx, p.tz), 0)); } } });
      // 山腰的小噴口：一座濺出來的小錐，口子發著光，旁邊黏著一團團凝固的熔岩
      { const hx = HEAD[0] * K, hz = HEAD[1] * K, hy = H(hx, hz); kt.add(M.flat, jit(new THREE.CylinderGeometry(.5, 1.25, 1.5, 8, 2, true), .12, 31), '#2c2322', M4(hx, hy + .4, hz)); kt.add(M.flat, new THREE.RingGeometry(.3, .55, 8).rotateX(-Math.PI / 2), '#3a2c28', M4(hx, hy + 1.15, hz)); gk.add(M.lamp, new THREE.CircleGeometry(.32, 8).rotateX(-Math.PI / 2), '#ffc04d', M4(hx, hy + 1.12, hz));
        for (let i = 0; i < 9; i++) { const a = rd() * PI2, r = 1.1 + rd() * 1.2; rock(kt, M, hx + Math.cos(a) * r, hz + Math.sin(a) * r, .18 + rd() * .2, '#2a2120', 860 + i, rd, .2, .6); } addCol({ x: hx, z: hz, r: 1.3 }); V.head = [hx, hy + 1.2, hz]; }
      // 湖岸一圈岩塊（岩塊之間的縫發紅）、湖面上漂著幾塊深色的結殼
      for (let k = 0, n = Math.round(30 * Q); k < n; k++) { const a = k / n * PI2 + rd() * .1, r = (lkR(a) + .22) * K, x = lx + Math.cos(a) * r, z = lz + Math.sin(a) * r; rock(kt, M, x, z, .28 + rd() * .3, pk(dark, rd), 880 + k, rd, .2, .62); if (k % 2) { const r2 = (lkR(a + .1) + .04) * K; gk.add(M.lamp, new THREE.BoxGeometry(.06, .04, .55), pk(lamp, rd), M4(lx + Math.cos(a + .1) * r2, ly + .03, lz + Math.sin(a + .1) * r2, 0, -a - .1, 0)); } }
      for (let i = 0; i < 5; i++) { const a = rd() * PI2, r = rd() * LK.r * .65 * K; kt.add(M.flat, jit(new THREE.CylinderGeometry(1, 1, .1, 6), .2, 900 + i), '#3b2219', M4(lx + Math.cos(a) * r, ly + .03, lz + Math.sin(a) * r, 0, rd() * 6, 0, .5 + rd() * .5, 1, .4 + rd() * .4)); }
      // 不能踩：沿河每 0.9 公尺一個碰撞圓（堤岸頂還站得到）、整個湖一個
      for (let s = 0; s <= 1.0001; s += .9 / (RV.L * K)) { const p = along(RV, Math.min(1, s)); addCol({ x: p.x * K, z: p.z * K, r: 1.25 * K }); }
      addCol({ x: lx, z: lz, r: (LK.r + .22) * K });
      V.embers = puffs([[lx, ly, lz, LK.r * K * .8], [lx, ly, lz, LK.r * K * .8], [...V.head, .3]], LOW ? 16 : 32, { size: .55, col: '#ffb056', v: .1, rise: 7, sway: 1.2, add: true });
      V.lakeAt = [lx, lz];
    }

    /* ---- 火山灰平原：小圓印通到一朵倔強的小花 ---- */
    {
      const kt = kit('nw'), fx = (AS.x - 2.5) * K, fz = (AS.z + .5) * K;
      // 史萊姆一跳一跳留下的圓印：從平原東南邊（靠火山腳）彎彎曲曲地通到小花旁邊
      for (let i = 0; i < 24; i++) { const t = i / 23, bx = -35.5 + (AS.x - 2.5 + 35.5) * t + 2.4 * Math.sin(t * Math.PI * 2.2), bz = -139.5 + (AS.z + .5 + 139.5) * t + 1.6 * Math.sin(t * Math.PI * 3.1 + .5), x = bx * K + (i % 2 - .5) * .25, z = bz * K; if (Math.hypot(x - fx, z - fz) < 1.2) continue; kt.add(M.flat, new THREE.CircleGeometry(.22, 9).rotateX(-Math.PI / 2), '#4a4850', M4(x, H(x, z) + .015, z, 0, rd() * 3, 0, 1, 1, .78 + rd() * .2)); }
      // 小花：一圈綠葉＋三朵橘紅色的花（夜裡會微微發光，比較好找）
      { const y = H(fx, fz); for (let k = 0; k < 6; k++) gk.add(M.night, new THREE.SphereGeometry(.12, 6, 3, 0, PI2, 0, Math.PI / 2), k % 2 ? '#4f9a45' : '#3f8a3d', M4(fx + Math.cos(k * 1.05) * .13, y - .01, fz + Math.sin(k * 1.05) * .13, 0, -k * 1.05, 0, 1.4, .3, .6));
        [[0, 0, .3], [.11, .07, .24], [-.09, .08, .2]].forEach(([ox, oz, h], i) => { gk.add(M.night, new THREE.CylinderGeometry(.01, .014, h, 4), '#4d7c3a', M4(fx + ox, y + h / 2, fz + oz)); for (let p = 0; p < 5; p++) gk.add(M.night, new THREE.SphereGeometry(.045, 6, 4), i ? '#fb7185' : '#fb923c', M4(fx + ox + Math.cos(p * 1.26) * .045, y + h + .01, fz + oz + Math.sin(p * 1.26) * .045, 0, -p * 1.26, .5, 1, .45, .7)); gk.add(M.night, new THREE.SphereGeometry(.024, 6, 4), '#fde047', M4(fx + ox, y + h + .03, fz + oz)); });
        V.flower = [fx, y, fz]; }
      // 被曬白的枯樹、半埋在灰裡的幾顆火山彈（頂上積著灰）
      { const x = (AS.x - 8) * K, z = (AS.z - 3.5) * K, y = H(x, z), c = '#cfc6bb'; kt.add(M.flat, new THREE.CylinderGeometry(.11, .2, 2.6, 6), c, M4(x, y + 1.2, z, .05, 0, .08)); [[.9, 1.9, .2], [-.7, 2.2, -.1], [.2, 2.5, .6]].forEach(([bx, by, bz]) => kt.seg(M.flat, new THREE.Vector3(x + bx * .15, y + by - .6, z + bz * .15), new THREE.Vector3(x + bx, y + by, z + bz), .05, c, 5, .03)); addCol({ x, z, r: .25 }); }
      [[5, -4, .7], [-4, 3.5, .55], [9, 2, .45], [-10, -1, .6]].forEach(([ox, oz, s], i) => { const x = (AS.x + ox) * K, z = (AS.z + oz) * K; rock(kt, M, x, z, s, '#3a383f', 920 + i, rd, .35, .8); kt.add(M.flat, new THREE.SphereGeometry(s * .8, 7, 3, 0, PI2, 0, Math.PI / 2), '#a7a6ae', M4(x, H(x, z) + s * .25, z, 0, 0, 0, 1.2, .35, 1)); });
      for (let i = 0; i < 3; i++) plant(kt, M, (AS.x + (rd() - .5) * 14) * K, (AS.z + (rd() - .5) * 9) * K, 0, .8 + rd() * .3, rd);
      // 西邊的丘陵上也長一點乾草
      HL.filter(([x]) => x < 0).forEach(([hx, hz, r]) => { for (let i = 0; i < (LOW ? 2 : 4); i++) { const a = rd() * PI2, d = rd() * r * .6; plant(kt, M, (hx + Math.cos(a) * d) * K, (hz + Math.sin(a) * d) * K, i % 2, .9 + rd() * .5, rd); } });
    }

    /* ---- 原有的岩漿池：加一圈結殼的岩石，平平的圓片才不像貼紙 ---- */
    POOLS.forEach(([bx, bz, br], j) => {
      const kt = kit(bx < 0 ? 'sw' : 'se'), cx = bx * K, cz = bz * K, R = br * K, n = Math.round(PI2 * R / .62);
      for (let k = 0; k < n; k++) { const a = k / n * PI2 + rd() * .2, r = R * (1 + rd() * .12) + .08, x = cx + Math.cos(a) * r, z = cz + Math.sin(a) * r; rock(kt, M, x, z, .2 + rd() * .2, pk(['#2a2220', '#33292a', '#3a2c28'], rd), 940 + (k + j * 7) % 50, rd, .2, .6); }
      for (let k = 0; k < 3; k++) { const a = rd() * PI2, r = R + .5 + rd() * .4, x = cx + Math.cos(a) * r, z = cz + Math.sin(a) * r; gk.add(M.lamp, new THREE.BoxGeometry(.5 + rd() * .5, .03, .05), '#ff6a1f', M4(x, H(x, z) + .02, z, 0, -a + (rd() - .5) * .3, 0)); }
    });

    // 只有台地（柱子）與東邊（岩柱、火山錐）投影；熔岩流的繩紋、河岸的石塊、灰原上的小東西都貼著地面，投影只是多畫一次陰影貼圖
    Object.entries(KT).forEach(([k, kt]) => { const c0 = W.chunks.length; kt.done(FAR[k]); if (k === 's' || k === 'ne' || k === 'nw') W.chunks.slice(c0).forEach(o => { o.userData.shadow = false; o.castShadow = false; }); });
    gk.done(260);
    V.chunks = W.chunks.slice(c00); V.chunks.forEach(o => { o.userData.far0 = o.userData.far; });

    /* ---- 彩蛋 ---- */
    regEgg('volcano_bluefire', '夜裡的藍色火焰', '火山東南邊冒著硫磺煙的地方，天黑以後去看看。');
    regEgg('volcano_flower', '灰裡的小花', '火山北邊的灰色平原上，有一串小小的圓印……跟著走到盡頭，低頭看看。');
  }
  regionBuild(build);

  /* ---------- 每格更新：熔岩流動、蒸氣與火星、夜裡的藍色火焰、彩蛋（離得遠就不算） ---------- */
  let zzT = 0, fQ = null, fS = null;
  regionStep((dt, t) => {
    if (!P || !V.lava) return;
    // 在中央平地（山脊圍住的那塊）時，這一區的東西都被山脊擋住、一個像素也看不到，但 cullChunks 只看距離，照樣每格送去畫：直接當成超出距離
    const cam = W.cam.position, hid = Math.max(Math.abs(cam.x), Math.abs(cam.z)) < 44 * K && cam.y < 20 && !CV.c;
    if (hid !== V.hid) { V.hid = hid; V.chunks.forEach(o => { o.userData.far = hid ? -1 : o.userData.far0; }); }
    const away = inCity() || CV.c || P.z > -48 * K;
    if (!away) V.lava.tex.offset.y = (V.lava.tex.offset.y - dt * .07) % 1;
    const sd = away ? 1e9 : Math.hypot(V.steamAt[0] - P.x, V.steamAt[1] - P.z), ld = away ? 1e9 : Math.hypot(V.lakeAt[0] - P.x, V.lakeAt[1] - P.z);
    V.steam.pts.visible = sd < (LOW ? 70 : 110); if (V.steam.pts.visible) V.steam.step(dt, .3 + DN.night * .08);
    V.embers.pts.visible = ld < (LOW ? 60 : 100); if (V.embers.pts.visible) V.embers.step(dt, .75 + DN.night * .25);
    // 藍色火焰：只在夜裡、離噴氣孔區 90 公尺（LOW 55）內才畫，每簇各自閃動
    const B = V.blue, bd = away ? 1e9 : Math.hypot(B.x - P.x, B.z - P.z), on = DN.night > .04 && bd < (LOW ? 55 : 90); B.im.visible = on;
    if (on) {
      B.im.material.opacity = Math.min(1, DN.night * 1.2) * .85;
      if (!fQ) { fQ = new THREE.Quaternion(); fS = new THREE.Vector3(); }
      B.fl.forEach((f, i) => { const k = .72 + .2 * Math.sin(t * 11 + f.p) + .12 * Math.sin(t * 23 + f.p * 2), s = f.s * (.6 + DN.night * .4), w = s * (1.15 - k * .25); tmpM.compose(tmpV.set(f.x, f.y, f.z), fQ.setFromAxisAngle(UP, f.p + t * .6), fS.set(w, s * k, w)); B.im.setMatrixAt(i, tmpM); }); // 火苗變高時變細一點，像在跳
      B.im.instanceMatrix.needsUpdate = true;
      if (DN.night > .65 && bd < 40) for (const f of B.fl) { const dx = f.x - P.x, dz = f.z - P.z, d = Math.hypot(dx, dz); if (d < 6 && (-Math.sin(P.yaw) * dx - Math.cos(P.yaw) * dz) / (d || 1) > .8) { eggHit('volcano_bluefire', '硫磺在夜裡燒出藍色的火焰……像有人在地上點了一盞一盞的小藍燈。'); break; } }
    }
    // 火山錐裡睡覺的熔岩史萊姆：靠近時冒出 Zzz
    if (!away && V.nest && Math.hypot(V.nest[0] - P.x, V.nest[2] - P.z) < 7 && (zzT -= dt) < 0) { zzT = 2.6; fx3(new THREE.Vector3(V.nest[0], V.nest[1] + 1, V.nest[2]), 'Zzz', '#fdba74'); }
    // 灰裡的小花：走到旁邊、低頭看
    if (!away && V.flower && P.pitch < -.45 && Math.hypot(V.flower[0] - P.x, V.flower[2] - P.z) < 2.6) eggHit('volcano_flower', '灰裡開著一朵小小的花，花瓣上還有一點火山灰，卻開得好用力。');
  });
})();
