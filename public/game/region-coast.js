'use strict';
/* ============================================================
   海岸：地形多元化與場景細節（登記方式見 regions.js）。內容都包在 IIFE 裡，避免和別的檔案撞名
   原本整片海岸是平的沙地，同一種棕櫚樹與石頭均勻撒滿，走到哪裡看起來都一樣。現在由北往南分成幾段（座標是基礎單位）：
   - 北：海角台地（玫瑰色的層狀沙岩、頂上綠草，和後面土黃色的分隔山脈分得開；靠海那半邊隆起一個圓頂；南緣西段是長長的緩坡、走得上去，東邊與東南邊是海崖），
     頂上是圓形石砌觀景台、望遠鏡、一排被海風吹彎的樹；外海一排海蝕柱，海鳥繞著飛
   - 海角腳下：海邊的小湖（碗形湖底＋自己的水面），粉紅色的水鳥單腳站在淺水裡、岸邊蘆葦；夜裡湖水有夜光藻，踩進水裡會亮起一圈
   - 岩拱南北兩側、海角崖腳：礁岩帶（平平的濕岩、海藻、藤壺、海星；夜裡海葵會發光）
   - 中：漂流木營火（夜裡點著）、燈塔北邊兩排舊碼頭的殘樁；西南棕櫚林裡一座圓圓的草丘，丘頂兩棵椰子樹之間掛著吊床
   - 南：三道和海岸平行的沙丘（迎風面緩、背風面陡，沿線斷成一個個沙包，缺口走得過去）、海灘草、防沙籬、沙丘頂的吊椅、一串小腳印
   - 整條海岸：高潮線上一段一段被沖上岸的海藻堆、夜裡發藍光的浪花與泡沫光點
   - 棕櫚林有疏有密（regionAvoid 留出空地），浪打得到的沙灘只留零星幾叢
   不動的地方：海蝕洞出口、小徑、紙條與潮汐石、燈塔、既有的小場景（keepOut：內圈完全不動，往外慢慢恢復），也不在那裡放東西
   效能：靜態物件合併成遠景一組（岩石、碼頭、海藻堆；不投影）、北中南近景各一組（只用平面材質：一面一個顏色，也省掉每段一組平滑材質）、
     夜裡發光的小東西整條海岸一組（不投影），交給 cullChunks；會動的東西各一個網格、離太遠就不更新也不畫；LOW 減量
   ============================================================ */
(() => {
  const sq = v => v * v;
  const segD = (x, z, a, b) => { const dx = b[0] - a[0], dz = b[1] - a[1], t = clamp(((x - a[0]) * dx + (z - a[1]) * dz) / (dx * dx + dz * dz || 1), 0, 1); return Math.hypot(x - a[0] - dx * t, z - a[1] - dz * t); };
  const polyD = (x, z, L) => { let d = 1e9; for (let i = 1; i < L.length; i++) d = Math.min(d, segD(x, z, L[i - 1], L[i])); return d; };

  /* ---------- 地形（基礎單位；H0 在小場景挖池塘與山洞口整平之前呼叫） ---------- */
  // 不能動的地方：[x, z, 內半徑, 外半徑]，內半徑以內完全不動。game.js 的常數在函式第一次被呼叫時才讀（這個檔案比 game.js 早載入）
  let PR = null;
  function prot() {
    if (PR) return PR; const b = ([x, z]) => [x / K, z / K];
    PR = { path: crPts(PATH_LINES[4], 8).map(b), pts: [[63.8, 2.4, 14, 20]] };
    [...NOTES, ...TIDE_SPOTS].forEach(p => PR.pts.push([...b(p), 4, 8]));
    PR.pts.push([...NOOK.conch, 4, 8], [...NOOK.tide, 9.5, 14], [...NOOK.boat, 6, 10], [...NOOK.arch, 7, 11], [...b(LM_POS.light), 15, 21]);
    return PR;
  }
  function keepOut(x, z) {
    const p = prot(); let w = 1;
    for (const [px, pz, r0, r1] of p.pts) { const d2 = sq(x - px) + sq(z - pz); if (d2 < r1 * r1) w = Math.min(w, smooth(r0, r1, Math.sqrt(d2))); }
    if (x < 114 && z > -14 && z < 16) w = Math.min(w, smooth(5, 9, polyD(x, z, p.path))); // 小徑兩側 5 單位內不動（坡度維持原樣）
    return w;
  }
  // 南段沙丘：一片沿南北拉長的沙包，排成靠海（矮）、中間（高）、靠山（中）三列，彼此之間留出走得過去的低窪。
  // [x, z, 高, 半長, 迎風（東）寬, 背風（西）寬, 長軸偏轉]；風從海上來：靠海那面緩、背風那面陡（最陡約 0.5，史萊姆也走得上去）
  const DUNE = [[126.2, 55, 1.1, 5, 4.2, 3.2, .15], [125.4, 66.5, 1.4, 5.5, 4.4, 3.2, -.1], [126.6, 78, 1, 4.5, 4, 3, .2], [125.6, 91, 1.3, 5, 4.2, 3.2, -.05], [126.4, 102, .9, 4, 3.8, 3, .1],
    [117.2, 58.5, 2.3, 7, 7, 4.6, .2], [118.6, 72.5, 3, 8, 7.5, 5, -.12], [116.8, 86.5, 2.5, 7, 7, 4.8, .15], [120.2, 99, 1.8, 5.5, 6, 4.2, -.1],
    [106, 57, 1.9, 6.5, 6, 4.4, -.2], [108.2, 69.5, 2.3, 7, 6.2, 4.6, .1], [104.5, 80.5, 1.5, 5.5, 5.5, 4, .25], [96.5, 60.5, 1.3, 5, 5, 3.6, .3], [97.5, 71, 1.1, 4.5, 4.5, 3.4, -.2]];
  function dune(x, z) {
    if (z < 44 || z > 112 || x < 88 || x > 136) return 0;
    let D = 0;
    for (const [X, Z, A, L, ww, wl, th] of DUNE) {
      const dx = x - X, dz = z - Z; if (dx > 18 || dx < -14 || dz > 22 || dz < -22) continue;
      const su = dx * Math.sin(th) + dz * Math.cos(th), sc = dx * Math.cos(th) - dz * Math.sin(th), h = A * Math.exp(-sq(su / L) - sq(sc / (sc > 0 ? ww : wl)));
      if (h > D) D = h;
    }
    return D * smooth(44, 52, z) * (1 + .06 * Math.sin(x * .7 + z * .4));
  }
  // 西南棕櫚林裡的小丘：圓圓的，最陡約 0.3
  const KN = [86, 38];
  const knoll = (x, z) => { const d2 = sq(x - KN[0]) + sq((z - KN[1]) * 1.15); return d2 > 900 ? 0 : 2.6 * Math.exp(-d2 / 72) * (1 + .1 * Math.sin(x * .4 + z * .3)); };
  // 海角腳下的小湖：那裡原本就有一塊低窪，挖成碗、裝水（水面比海面高一點，和海之間隔著一道沙堤）
  const LG = { x: 108.5, z: -65, r: 8.4, w: -.62, d: .74, b: 3.2 };
  const lagR = a => LG.r * (1 + .13 * Math.sin(a * 2 + .6) + .07 * Math.sin(a * 3 + 2.1)) * (1 + .24 * sq(Math.sin(a)));
  function lagoon(x, z, h) {
    const dx = x - LG.x, dz = z - LG.z, d2 = dx * dx + dz * dz; if (d2 > sq(LG.r * 1.6 + LG.b)) return h;
    const d = Math.sqrt(d2), R = lagR(Math.atan2(dz, dx));
    if (d < R) { const u = d / R; return LG.w - LG.d + (LG.d + .08) * u * u; }
    const e = LG.w + .08, s = smooth(R, R + LG.b, d); return Math.max(e + (h - e) * s, LG.w + .05 * s); // 岸邊一圈不低於水面：水不會「漏」到岸上
  }
  // 北邊的海角台地：ce＝海崖線（往東就是海）、zs＝南緣、ws＝南緣的坡寬（西段 15＝緩坡走得上去，東段收成 2.4＝斷崖）
  const headCE = z => 136.6 + 2 * Math.sin(z * .23 + 1.2) + 1.1 * Math.sin(z * .53 + .4);
  const headZS = x => -78.5 - 4.5 * smooth(114, 130, x) + 1.3 * Math.sin(x * .31 + .7);
  function headFp(x, z) {
    if (z > -72 || x < 96 || x > 146) return 0;
    // 東南角往裡收成圓角：崖腳平台到沙灘之間留一條寬一點的路（原本只剩貼著水邊窄窄一條，從平台南端斜斜走向沙灘會被陡坡擋住）
    return smooth(0, 1.9, headCE(z) - 3.4 * sq(smooth(-90, -83.5, z)) - x) * smooth(0, 15 - 12.6 * smooth(116, 128, x), headZS(x) - z) * smooth(97, 104, x);
  }
  // 台地頂的高度：越往東北越高，靠海那一半再隆起一個圓圓的頂（約高 3.5 公尺）。原本整片一樣高、緊貼著後面的分隔山脈，從海上看只像山腳的一層平台；
  // 現在海角自己有一個圓頂、和山之間留一道淺淺的凹，輪廓才分得出來。觀景台那一小塊整平（石砌平台放在上面不會一邊懸空）
  const headTop = (x, z) => 5.4 + 1.3 * smooth(112, 132, x) + 2.2 * Math.exp(-(sq(x - 130) + sq(z + 104) * .8) / 170);
  const headH = (x, z) => { const k = smooth(1.8, 3.2, Math.hypot(x - LOOK[0], z - LOOK[1])); return headTop(LOOK[0], LOOK[1]) + (headTop(x, z) - headTop(LOOK[0], LOOK[1]) + (vnoise(x * .21, z * .21, 91) - .5) * .6) * k; };
  // 海蝕平台：海崖腳下一圈平平的濕岩（海浪把崖腳削平留下來的），從海角北端一路接到南邊的沙灘，外緣才掉進深海。
  // 原本崖腳直接是深海（玩家走不進比 −2.2 公尺深的水），從崖上摔下去會被困在崖面上；現在沿著平台就走得回沙灘
  const shelfX = z => headCE(z) + 4.4 + 1.3 * Math.sin(z * .37 + 1.1) + .8 * Math.sin(z * .83 + .2); // 平台外緣
  function shelf(x, z, h) {
    if (z > -62 || x < 128) return h;
    const w = (1 - smooth(-.5, 2.6, x - shelfX(z))) * (1 - smooth(-74, -63, z)); if (w <= 0) return h;
    const top = -.8 + (vnoise(x * .42, z * .42, 93) - .5) * .32 - .1 * smooth(-1.5, 0, x - shelfX(z)); // 濕岩的高度：水面（−0.9）上下一點點，凹下去的地方積成小水窪
    return top > h ? h + (top - h) * w : h; // 只往上補：崖面與沙灘都不動
  }
  // 各種地形乘上淡出權重：k＝保護區、區域邊界（x 67～74 淡入、和分隔山脈之間留 2～10 單位）；海角只往上補，和分隔山脈自然接上
  function eff(x, z) {
    if (x < 66 || x > 160 || Math.abs(z) > x - 9) return null;
    const k = keepOut(x, z); if (k <= 0) return null;
    const m = x - Math.abs(z) - 12, e = smooth(67, 74, x) * smooth(2, 10, m) * k, b = smooth(-3, 5, m);
    return { k, b, d: dune(x, z) * e, n: knoll(x, z) * e, f: headFp(x, z) * k * b };
  }
  regionTerrain((x, z, h) => {
    const s = eff(x, z); if (!s) return h;
    h += s.d + s.n;
    if (z < -48 && z > -84 && x > 90 && x < 128) h += (lagoon(x, z, h) - h) * s.k;
    if (s.f > 0) h += s.f * Math.max(0, headH(x, z) - h);
    if (x > 128 && z < -62) h += (shelf(x, z, h) - h) * s.k * s.b;
    return h;
  });

  /* ---------- 場景的位置（基礎單位；regionAvoid 在 buildProps 時就要用，那時還沒建場景） ---------- */
  const LOOK = [129.6, -92.2], TRAIL = [[112, -76.6], [113.6, -83], [115.6, -89.6], [121, -94], [127.4, -92.9]];
  const SIGN = [[124.2, -95.2], [110.1, -76.2]], FIRE = [114, -13], DRIFT = [104.5, -35], NEST = [110.6, 90.4], PRINTS = [[131.4, 83.6], [124.6, 86.2], [117.8, 88.4], [111.8, 90.2]];
  const FENCES = [[[129.6, 51.6], [129.2, 58.2]], [[129, 63.4], [129.2, 70]], [[111.4, 61.2], [112.8, 66.6]], [[129.4, 88.2], [129, 94.6]]];
  let SWING = null; // 吊椅：中間那道沙丘在 z 64～84 之間的最高點
  const swingAt = () => SWING || (SWING = (() => { let b = [118, 74], best = -1; for (let z = 64; z <= 84; z += .5) for (let x = 108; x < 128; x += .25) { const d = dune(x, z); if (d > best) { best = d; b = [x, z]; } } return b; })());
  const inScene = (x, z) => Math.hypot(x - FIRE[0], z - FIRE[1]) < 6.5 || Math.hypot(x - DRIFT[0], z - DRIFT[1]) < 5.5 || (x > 125 && Math.abs(z - 25.75) < 3.2) || polyD(x, z, PRINTS) < 2 || Math.hypot(x - NEST[0], z - NEST[1]) < 3.5
    || Math.hypot(x - swingAt()[0], z - swingAt()[1]) < 4 || polyD(x, z, TRAIL) < 2.2 || Math.hypot(x - LOOK[0], z - LOOK[1]) < 6 || FENCES.some(f => polyD(x, z, f) < 1.4);
  regionAvoid((xw, zw) => {
    const x = xw / K, z = zw / K; if (x < 64 || x > 400 || Math.abs(z) > x - 8) return false;
    const s = eff(x, z);
    if (s && (s.d > .3 || s.f > .12 || s.n > 1.2)) return true; // 沙丘上、海角台地上、小丘頂不長隨機的樹（各自有自己的植物）
    if (Math.hypot(x - LG.x, z - LG.z) < lagR(Math.atan2(z - LG.z, x - LG.x)) + 3.5 || inScene(x, z)) return true;
    // 疏密：低頻雜訊決定哪裡是林子、哪裡是空地；浪打得到的沙灘只留零星幾叢
    const n = vnoise(x * .055, z * .055, 83) * .7 + vnoise(x * .17, z * .17, 84) * .3;
    return n < (x > 126 ? .68 : .42);
  });

  /* ---------- 地表顏色：buildTerrain 依高度上色（越高越綠），沙丘會被染成草坡、海崖是灰色。這裡只重畫海岸自己的頂點 ---------- */
  function recolor() {
    const f = HF, g = W.terrain && W.terrain[0] && W.terrain[0].geometry; if (!f || !g) return;
    const ca = g.attributes.color, a = ca.array, hs = f.hs, R = f.row, cs = f.cell, half = f.half, c = new THREE.Color(), t = new THREE.Color(), C = s => new THREE.Color(s);
    const SW = C('#ecd8a3'), SL = C('#d3b680'), SC = C('#f7ebc5'), MD = C('#6fa955'), MD2 = C('#86b85c'), MD3 = C('#559a4b'), MS = C('#b9b585'), CL = C('#dfa38b'), CL2 = C('#c98571'), CW = C('#7a5249'), TR = C('#b59c74'), LF = C('#9ccbb3'), LW = C('#c4b083'), SR = C('#8c8274'), SR2 = C('#7a7064'), SA = C('#5f8048'), SP = C('#d9a3a0');
    const ix0 = Math.max(1, Math.floor((64 * K + half) / cs)), ix1 = Math.min(R - 2, Math.ceil((165 * K + half) / cs)), iz0 = Math.max(1, Math.floor((-125 * K + half) / cs)), iz1 = Math.min(R - 2, Math.ceil((125 * K + half) / cs));
    for (let j = iz0; j <= iz1; j++) for (let i = ix0; i <= ix1; i++) {
      const x = (i * cs - half) / K, z = (j * cs - half) / K, s = eff(x, z); if (!s) continue;
      const v = j * R + i, h = hs[v] / K, sl = (Math.abs(hs[v + 1] - hs[v - 1]) + Math.abs(hs[v + R] - hs[v - R])) / (2 * cs); let ch = false;
      c.fromArray(a, v * 3);
      if (s.d > .04) { // 沙丘：背風面暖一點、坡頂最淡
        const gx = dune(x + .7, z) - dune(x - .7, z);
        t.copy(SW).lerp(SL, smooth(-.02, .25, gx)).lerp(SC, smooth(.5, .95, s.d / 3) * .7); c.lerp(t, smooth(.04, .45, s.d)); ch = true;
      }
      if (s.f > .02) { // 海角：崖面是玫瑰色的沙岩（和後面土黃色的分隔山脈分得開；一層層的紋路由地表材質畫，見 coastTerrainPatch）、崖腳是濕岩、台地頂是一片綠油油的海邊草地
        // 崖面的頂點色只隨高度慢慢變（原本每 1.7 公尺換一次深淺：陡坡上一格頂點就跨好幾層，近看糊成一條條直的色帶）
        const cliff = smooth(.75, 1.5, sl);
        if (cliff > 0) { t.copy(CL2).lerp(CL, smooth(.5, 5, h)).lerp(CW, 1 - smooth(-.6, .8, h)); c.lerp(t, cliff * Math.min(1, s.f * 4)); }
        const top = smooth(.25, .75, s.f) * (1 - cliff); if (top > 0) { const nv = vnoise(x * .35, z * .35, 97); t.copy(MD).lerp(nv > .5 ? MD2 : MD3, Math.abs(nv - .5) * 1.6).lerp(MS, smooth(.66, .82, vnoise(x * .16 + 3, z * .16, 98)) * .35); c.lerp(t, top); } // 草地裡偶爾一塊乾草與沙土
        ch = true;
      }
      if (x > 128 && z < -62 && h < -.25 && sl < 1.1) { // 海蝕平台：濕濕的深色岩面，水線附近長一片片海藻、偶爾一塊粉紅色的石灰藻
        const sw = (1 - smooth(-.5, 2.6, x - shelfX(z))) * (1 - smooth(-74, -63, z)) * s.k * s.b;
        if (sw > .05) { const nv = vnoise(x * .5, z * .5, 96); t.copy(nv > .5 ? SR : SR2).lerp(SA, smooth(.55, .8, vnoise(x * .33 + 7, z * .33, 99)) * (1 - smooth(.08, .3, Math.abs(h + .88)))).lerp(SP, smooth(.8, .9, vnoise(x * .6, z * .6 + 4, 94)) * .8); c.lerp(t, Math.min(1, sw * 1.4)); ch = true; }
      }
      const td = polyD(x, z, TRAIL); if (td < 1.8) { c.lerp(TR, (1 - smooth(.45, 1.6, td)) * .8); ch = true; } // 上海角的小路：只是踩出來的顏色
      const ld = Math.hypot(x - LG.x, z - LG.z); if (ld < 17) { const lr = lagR(Math.atan2(z - LG.z, x - LG.x)); if (ld < lr + 2.6) { c.lerp(ld < lr ? LF : LW, ld < lr ? .55 : (1 - smooth(lr + .6, lr + 2.6, ld)) * .5); ch = true; } } // 湖底淺綠沙、岸邊一圈濕沙
      if (ch) c.toArray(a, v * 3);
    }
    ca.needsUpdate = true;
  }

  /* ---------- 共用 ---------- */
  let M = null, FM = null, NM = null, kG = null; // nookMats()、不投影的平面材質（遠景岩石）、夜裡發光的材質（LOW 用平面材質代替：每組少一次繪製，夜裡還有浪花、小湖與火焰在亮）
  const G = k => kG || k; // 發光的小東西放進整條海岸共用的那一組（LOW 沒有這組：和所在區段的平面材質合併）
  const DYN = { swA: 0 }; // 會動的東西
  const SAND = ['#b8a68f', '#a39077', '#c2b29b', '#ad9a80']; // 和岩拱同一組沙岩色
  const HR = ['#c98d78', '#b77a67', '#d4a08b', '#c08470']; // 海角的玫瑰色沙岩：崖腳的落石、台地上露出來的岩塊、靠海角那幾根海蝕柱（靠岩拱的兩根還是岩拱的沙岩色）
  const UP = new THREE.Vector3(0, 1, 0), tv = new THREE.Vector3(), tv2 = new THREE.Vector3(), tm = new THREE.Matrix4(), tq = new THREE.Quaternion(), te = new THREE.Euler(), ts = new THREE.Vector3(1, 1, 1);
  // 兩點之間的一根棍子（零件格式 [幾何, 顏色, 矩陣]，給 nookMerge／mergeParts 用）
  const stick = (a, b, r, col, n = 5, r1 = r) => { const d = new THREE.Vector3().subVectors(b, a), L = d.length(); return [new THREE.CylinderGeometry(r1, r, L, n), col, new THREE.Matrix4().compose(a.clone().add(b).multiplyScalar(.5), new THREE.Quaternion().setFromUnitVectors(UP, d.normalize()), new THREE.Vector3(1, 1, 1))]; };
  const V = (x, y, z) => new THREE.Vector3(x, y, z);
  const MY = (x, y, z, rx, ry, s = 1) => new THREE.Matrix4().compose(V(x, y, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, ry, 0, 'YXZ')), V(s, s, s)); // 先傾斜、再轉向（葉子、牌子）
  // 貼著地面擺的東西：依地形法線傾斜（腳印、鋪石、小花）
  function onGround(x, z, ry, s, dy = 0, sy = s) {
    const e = .45, n = tv.set(H(x - e, z) - H(x + e, z), 2 * e, H(x, z - e) - H(x, z + e)).normalize();
    const q = new THREE.Quaternion().setFromUnitVectors(UP, n).multiply(new THREE.Quaternion().setFromAxisAngle(UP, ry));
    return new THREE.Matrix4().compose(V(x, H(x, z) + dy, z), q, V(s, sy, s));
  }
  const lowAt = (x, z, r) => Math.min(H(x, z), H(x + r, z), H(x - r, z), H(x, z + r), H(x, z - r)); // 腳下最低的地方：石頭放在斜坡上才不會一邊懸空
  // 區域內的局部座標：原點 (x, y, z)、往 face 方向是 +z
  const local = (x, y, z, face) => { const s = Math.sin(face), c = Math.cos(face); return (lx, ly, lz) => V(x + lx * c + lz * s, y + ly, z - lx * s + lz * c); };

  /* ---------- 海蝕柱與鳥窩 ---------- */
  const NESTP = new THREE.Vector3();
  function stacks(kF, kN, rd) {
    // [x, z（基礎單位）, 露出水面幾公尺, 粗細（公尺）]：由北往南越來越矮，最南邊兩根只剩一點點露出水面
    [[143, -103, 13, 2.4], [147.6, -94.5, 9.5, 2], [141.4, -85.2, 7, 1.8], [149, -80, 4.5, 1.5], [142.6, -71.6, 2.8, 1.2], [146.6, -66, 1.6, 1]].forEach(([bx, bz, ht, w], si) => {
      const x = bx * K, z = bz * K, gy = H(x, z), top = WATER_Y + ht; let y = gy + w * .5, yT = y;
      for (let i = 0; y < top - w * .25; y += w * .8, i++) { const s = w * (1 - Math.min(i, 6) * .03) * (.9 + rd() * .18); yT = y + s * .78; kF.add(FM, rk(600 + si * 20 + i), (si < 4 ? HR : SAND)[(i + si) % 4], M4(x + (rd() - .5) * w * .3, y, z + (rd() - .5) * w * .3, rd(), rd() * 6, rd(), s, s * .82, s * 1.08)); }
      if (ht > 3) kF.add(FM, new THREE.SphereGeometry(w * .9, 8, 3, 0, PI2, 0, Math.PI / 2), '#6f9a52', M4(x, yT - w * .22, z, 0, si, 0, 1, .4, 1)); // 頂上一頂草帽
      kF.add(FM, new THREE.TorusGeometry(w * 1.02, .2, 4, 12), '#3f6b3a', M4(x, WATER_Y + .05, z, Math.PI / 2)); // 水線一圈海藻
      for (let k = 0; k < 4; k++) { const a = k * 1.7 + si, r = w * (1.25 + rd() * .5), s = .3 + rd() * .5, px = x + Math.cos(a) * r, pz = z + Math.sin(a) * r, g = lowAt(px, pz, s); if (g < WATER_Y - 1) continue; kF.add(FM, rk(650 + si * 5 + k), '#8b8272', M4(px, g + s * .3, pz, rd(), rd() * 6, rd(), s * 1.3, s * .65, s)); } // 腳邊的碎石：只放在淺的地方、坐在海底上
      if (si === 0) { // 最高那根頂上的鳥窩：一圈樹枝、三顆淡藍色的蛋、趴著打盹的海鳥。只有用海角的望遠鏡才看得清楚
        const ny = yT - w * .22 + w * .9 * .4 - .06; NESTP.set(x, ny + .25, z); const a = (px, py, pz, ...r) => M4(x + px, ny + py, z + pz, ...r);
        kN.add(M.flat, new THREE.TorusGeometry(.38, .13, 5, 12), '#8b6b4a', a(0, .08, 0, Math.PI / 2));
        for (let k = 0; k < 7; k++) kN.add(M.flat, new THREE.CylinderGeometry(.025, .025, .6, 4), '#6b5038', a(Math.cos(k) * .38, .14, Math.sin(k) * .38, Math.PI / 2, k * .9, .3));
        [[-.1, .06], [.08, .1], [.02, -.1]].forEach(([px, pz]) => kN.add(M.flat, new THREE.SphereGeometry(.075, 8, 6), '#cfe8f3', a(px - .12, .12, pz, 0, 0, 0, 1, 1.25, 1)));
        kN.add(M.flat, new THREE.SphereGeometry(.24, 10, 8), '#f8fafc', a(.16, .26, 0, 0, 0, 0, 1.35, .85, 1)); kN.add(M.flat, new THREE.SphereGeometry(.13, 10, 8), '#f8fafc', a(.42, .38, 0));
        kN.add(M.flat, new THREE.ConeGeometry(.035, .14, 5), '#f59e0b', a(.58, .37, 0, 0, 0, -Math.PI / 2)); [-1, 1].forEach(s => { kN.add(M.flat, new THREE.BoxGeometry(.4, .04, .14), '#94a3b8', a(.1, .3, s * .17, s * .25, 0, 0)); kN.add(M.flat, new THREE.TorusGeometry(.03, .008, 3, 8, Math.PI), '#1f2937', a(.5, .43, s * .065, 0, Math.PI / 2, Math.PI)); });
      }
    });
  }
  /* ---------- 礁岩帶、崖腳的落石 ---------- */
  function reef(kF, kN, rd) {
    // 礁岩比原本高一點、顏色淺一點（從沙灘看過去原本只是水邊幾塊扁扁的綠色），水線一圈亮綠的海藻、有些頂上一片粉紅色的石灰藻；海角腳下那一區是海角的玫瑰色沙岩
    const RC = ['#948a7c', '#a09584', '#857c70'], zones = [[128, 141, -76, -61.5, 1], [129.5, 140, -51.5, -40, 0], [132, 144, -120, -78, 1]], n = LOW ? 14 : 24;
    zones.forEach(([x0, x1, z0, z1, north], zi) => {
      for (let i = 0; i < n; i++) {
        const bx = x0 + rd() * (x1 - x0), bz = z0 + rd() * (z1 - z0), x = bx * K, z = bz * K, g0 = H(x, z); if (g0 > WATER_Y + .6 || g0 < WATER_Y - .5 || H(x - 1.2, z) > g0 + 1.5) continue; // 崖面上不放
        if (Math.hypot(bx - NOOK.arch[0], bz - NOOK.arch[1]) < 5.5 || Math.hypot(bx - NOOK.tide[0], bz - NOOK.tide[1]) < 9.5) continue;
        const s = .55 + rd() * 1, y = lowAt(x, z, s * 1.2) + s * .16, ry = rd() * 6, top = y + s * .42; // 坐在海底（或沙上），頂面露出水面一點
        kF.add(FM, rk(700 + i + zi * 40), (zi === 2 ? HR : RC)[i % 3], M4(x, y, z, (rd() - .5) * .2, ry, (rd() - .5) * .2, s * 1.45, s * .42, s));
        const wl = Math.max(WATER_Y + .02, y - s * .1); if (wl < top - .08) kF.add(FM, new THREE.SphereGeometry(s * 1.02, 7, 2, 0, PI2, 0, Math.PI / 2), i % 2 ? '#6f9a4a' : '#5f8c44', M4(x, wl, z, 0, ry, 0, 1.45, .2, 1.05)); // 水線一圈海藻
        if (i % 3 === 0) kF.add(FM, new THREE.SphereGeometry(s * .5, 6, 2, 0, PI2, 0, Math.PI / 2), '#e9a3ae', M4(x - s * .2, top - .05, z + s * .1, 0, ry, 0, 1.3, .18, 1)); // 粉紅色的石灰藻
        if (!north) continue; // 下面是近景小東西：只放在北段（南段的近景組不要被拉大範圍）
        for (let k = 0; k < 3; k++) if (rd() < .5) kN.add(M.flat, new THREE.ConeGeometry(.05, .07, 5), '#e7e5e4', M4(x + Math.cos(k * 2 + i) * s * .7, top - .03, z + Math.sin(k * 2 + i) * s * .5)); // 藤壺
        if (rd() < .38) { const c = ['#fb7185', '#f97316', '#c084fc'][i % 3]; for (let k = 0; k < 5; k++) kN.add(M.flat, new THREE.SphereGeometry(.09, 6, 4), c, M4(x + Math.cos(k * 1.257) * .13, top, z + Math.sin(k * 1.257) * .13, 0, -k * 1.257, 0, 2.2, .45, 1)); } // 海星
        if (rd() < .3) { const c = rd() < .5 ? '#f472b6' : '#5eead4', ax = x + s * .5, az = z - s * .3; G(kN).add(NM, new THREE.CylinderGeometry(.06, .08, .1, 8), c, M4(ax, top + .01, az)); for (let k = 0; k < 7; k++) G(kN).add(NM, new THREE.ConeGeometry(.014, .11, 4), c, M4(ax + Math.cos(k) * .045, top + .1, az + Math.sin(k) * .045, Math.sin(k) * .5, 0, -Math.cos(k) * .5)); } // 海葵：夜裡發光
      }
    });
    // 海角的崖腳：沿著海崖與東南的崖壁落下的大石頭，一半泡在水裡
    for (let bz = -111; bz < -80; bz += 1.5 + rd() * 1.5) { const bx = headCE(bz) + 1.2 + rd() * 2.2, x = bx * K, z = bz * K, s = .5 + rd() * 1.1, g = lowAt(x, z, s); if (g > WATER_Y + 1.2 || g < WATER_Y - 1.6 || H(x, z) - g > s) continue; kF.add(FM, rk(760 + Math.round(bz * 3)), HR[Math.round(bz) & 3], M4(x, g + s * .3, z, rd(), rd() * 6, rd(), s * 1.2, s * .8, s)); }
    for (let bx = 123; bx < 136; bx += 1.4 + rd() * 1.2) { const bz = headZS(bx) + 2.6 + rd() * 2, x = bx * K, z = bz * K, s = .35 + rd() * .8, g = lowAt(x, z, s * 1.2); if (g > 2.5 || H(x, z) - g > s * .35) continue; kF.add(FM, rk(800 + Math.round(bx * 3)), HR[Math.round(bx) & 3], M4(x, g + s * .3, z, rd(), rd() * 6, rd(), s * 1.2, s * .8, s)); }
  }

  /* ---------- 海角觀景台：鋪石、面海的長椅、望遠鏡、崖邊的繩欄、被海風吹彎的樹、告示牌、野花 ---------- */
  function lookout(kN, rd) {
    const [cx, cz] = [LOOK[0] * K, LOOK[1] * K], PV = ['#ddd0b6', '#cfc1a6', '#d8cab0', '#c7b89c'], TOP = H(cx, cz) + .12; // 平台台面（地形在這裡整平了，見 headH）
    // 圓形的石砌平台：矮矮的一圈收邊石牆，台面是一圈圈切得整整齊齊的扇形石板、石板之間是深一點的灰縫，正中間嵌一顆薄荷綠的羅盤星（原本是 34 塊大小不一、歪七扭八疊在一起的石片，像一堆碎石）
    kN.add(M.flat, new THREE.CylinderGeometry(2.45, 2.56, .5, 20), '#9d917c', M4(cx, TOP - .25, cz));
    const tile = (r0, r1, n, ph, segs) => { for (let i = 0; i < n; i++) { const ga = .07 / ((r0 + r1) / 2), a0 = ph + i / n * PI2; kN.add(M.flat, new THREE.RingGeometry(r0 + .035, r1 - .035, segs, 1, a0 + ga / 2, PI2 / n - ga).rotateX(-Math.PI / 2), PV[(i + segs) % 4], M4(cx, TOP + .012, cz)); } };
    tile(.62, 1.45, 6, .3, 2); tile(1.45, 2.33, 11, 0, 3);
    kN.add(M.flat, new THREE.CircleGeometry(.6, 12).rotateX(-Math.PI / 2), PV[2], M4(cx, TOP + .012, cz));
    { const st = new THREE.Shape(); for (let k = 0; k < 8; k++) { const a = k / 8 * PI2, r = k % 2 ? .1 : .42; st[k ? 'lineTo' : 'moveTo'](Math.cos(a) * r, Math.sin(a) * r); } kN.add(M.flat, new THREE.ShapeGeometry(st).rotateX(-Math.PI / 2), '#5aa89f', M4(cx, TOP + .02, cz)); } // 羅盤星：四個尖角對著東西南北
    // 長椅：兩塊石墩上架一塊漂流木板，面向外海
    { const b = local(cx - .4, TOP, cz + 1.3, Math.PI / 2 - .2); [-.65, .65].forEach(o => kN.add(M.flat, rk(820 + (o > 0 ? 1 : 0)), '#9a9488', M4(...b(o, .18, 0).toArray(), .2, 0, .1, .24, .24, .2)));
      kN.add(M.flat, new THREE.BoxGeometry(1.7, .09, .42), '#b39874', new THREE.Matrix4().compose(b(0, .44, 0), new THREE.Quaternion().setFromEuler(te.set(0, Math.PI / 2 - .2, 0)), ts)); addCol({ x: cx - .4, z: cz + 1.3, r: .55 }); }
    // 望遠鏡：薄荷綠的投幣式雙筒，對著最高的那根海蝕柱
    const tx = cx + 1.35, tz = cz - .35, ty = TOP + .012, face = Math.atan2(NESTP.x - tx, NESTP.z - tz), L = local(tx, ty, tz, face), q = new THREE.Quaternion().setFromEuler(te.set(0, face, 0)), at = (p, rx = 0) => new THREE.Matrix4().compose(p, q.clone().multiply(new THREE.Quaternion().setFromEuler(te.set(rx, 0, 0))), ts);
    kN.add(M.flat, new THREE.CylinderGeometry(.24, .28, .08, 10), '#4a8f87', at(L(0, .04, 0))); kN.add(M.flat, new THREE.CylinderGeometry(.065, .095, 1, 10), '#5aa89f', at(L(0, .55, 0)));
    kN.add(M.flat, new THREE.BoxGeometry(.1, .2, .08), '#4a8f87', at(L(0, 1.08, 0))); kN.add(M.flat, new THREE.BoxGeometry(.13, .17, .1), '#e2b65b', at(L(0, .78, .09)));
    kN.add(M.flat, new THREE.CylinderGeometry(.13, .15, .52, 12), '#5fbfb3', at(L(0, 1.24, .04), Math.PI / 2 - .1)); kN.add(M.flat, new THREE.TorusGeometry(.14, .028, 5, 14), '#e2b65b', at(L(0, 1.265, .3), -.1)); kN.add(M.flat, new THREE.CylinderGeometry(.11, .11, .03, 10), '#1e3a4a', at(L(0, 1.267, .31), Math.PI / 2 - .1));
    [-1, 1].forEach(s => kN.add(M.flat, new THREE.CylinderGeometry(.035, .04, .1, 8), '#1f2937', at(L(s * .055, 1.2, -.24), Math.PI / 2 - .1)));
    addCol({ x: tx, z: tz, r: .32 }); SCOPE_HEAD.copy(L(0, 1.24, .04)); const hb = hitBox(.6, .6, .6, tx, ty + 1.2, tz); W.scene.add(hb);
    addInter(hb, 'nook', 'coast_scope', '看看望遠鏡', { act() { if (SC.on) return scopeOff(); scopeOn(); try { sfx.tick(); } catch (e) { } bark(SELF, '望遠鏡裡，外海的海蝕柱看得好清楚。'); } });
    // 繩欄：沿著觀景台前面那一段崖邊；柱子之間也放碰撞，不會一腳踩出崖外
    { let prev = null; for (let bz = LOOK[1] - 3.4; bz <= LOOK[1] + 3.5; bz += .95) { const x = (headCE(bz) - 2.1) * K, z = bz * K, y = H(x, z), p = V(x, y + .85, z); kN.add(M.flat, new THREE.CylinderGeometry(.05, .06, .95, 6), '#7a5a3c', M4(x, y + .42, z)); if (prev) { const mid = prev.clone().lerp(p, .5); mid.y -= .16; kN.add(M.flat, ...stick(prev, mid, .018, '#d6c7a5', 4)); kN.add(M.flat, ...stick(mid, p, .018, '#d6c7a5', 4)); for (let k = 0; k < 3; k++) { const o = prev.clone().lerp(p, k / 3); addCol({ x: o.x, z: o.z, r: .32 }); } } prev = p; } }
    // 被海風吹彎的樹：樹幹一節一節往陸地那邊彎、越上面越細，樹冠壓扁成一把往陸地歪的傘
    // 觀景台旁三棵；靠海那一側的圓頂上再一小片，從海上看，海角頂上有一排歪向陸地的樹（後面的山上沒有），輪廓才認得出來
    [[-3.4, -3.6, .85], [-5.4, 1.9, 1.05], [-1.2, -4.8, .7]].map(([ox, oz, s], i) => [LOOK[0] + ox, LOOK[1] + oz, s, Math.PI + (i - 1) * .25])
      .concat([[131.5, -104.5, 1, -1.75], [128.6, -108.6, .85, -1.4], [131.8, -99.5, .8, -1.9], [126.4, -103.2, .95, -1.6], [134, -106.8, .7, -1.7]].slice(0, LOW ? 2 : 5)).forEach(([bx, bz, s, lean], i) => {
      const x = bx * K, z = bz * K, y = H(x, z) - .1, dx = Math.sin(lean), dz = Math.cos(lean); let p = V(x, y, z);
      const SEG = [[.05, .8], [.18, .75], [.35, .65], [.5, .5], [.62, .4], [.7, .3]];
      SEG.forEach(([o, hgt], k) => { const n = p.clone().add(V(dx * o * s, hgt * s, dz * o * s)), r0 = .19 * s * (1 - k / SEG.length * .62), r1 = .19 * s * (1 - (k + 1) / SEG.length * .62); kN.add(M.flat, ...stick(p, n, r0, k % 2 ? '#5e4630' : '#6b5038', 6, r1)); p = n; });
      [[.1, .05, 1.2, 0], [-.55, -.18, .85, .5], [.75, -.05, .8, -.4], [.3, .3, .78, .2], [-.2, .12, .7, -.6]].forEach(([o, oy, r, side], k) => kN.add(M.flat, jit(new THREE.IcosahedronGeometry(1, 0), .22, 840 + i * 5 + k), ['#4e8a4a', '#5b9a52', '#3f7a44'][(k + i) % 3], M4(p.x + dx * (o + .35) * s - dz * side * s, p.y + oy * s, p.z + dz * (o + .35) * s + dx * side * s, 0, k * 1.3, 0, r * s * 1.3, r * s * .5, r * s * 1.05)));
      addCol({ x, z, r: .3 * s });
    });
    // 石堆（小路走到頂的地方）與野花
    { const x = (TRAIL[3][0] + 1) * K, z = (TRAIL[3][1] - 1.6) * K; let y = H(x, z); [[.36, .2], [.3, .18], [.24, .16], [.17, .13], [.11, .1]].forEach(([r, h], i) => { kN.add(M.flat, rk(860 + i), i % 2 ? '#a3a8a1' : '#8b918a', M4(x + (i % 2 - .5) * .05, y + h / 2, z, 0, i, 0, r, h * .8, r * .9)); y += h; }); addCol({ x, z, r: .35 }); }
    const FL = [['#facc15', '#fef9c3'], ['#f8fafc', '#fde047'], ['#f9a8d4', '#fdf2f8'], ['#c4b5fd', '#f5f3ff']];
    for (let i = 0, n = 0; i < 200 && n < (LOW ? 16 : 32); i++) {
      const bx = 112 + rd() * 26, bz = -114 + rd() * 30, s = eff(bx, bz); if (!s || s.f < .85 || Math.hypot(bx - LOOK[0], bz - LOOK[1]) < 2.6 || polyD(bx, bz, TRAIL) < 1.2) continue;
      const x = bx * K, z = bz * K; if (Math.abs(H(x + .6, z) - H(x - .6, z)) + Math.abs(H(x, z + .6) - H(x, z - .6)) > .5) continue; n++;
      const [pc, cc] = FL[n % 4];
      for (let k = 0; k < 8; k++) { const r = .08 + (k % 4) * .07, fx = x + Math.cos(k * 2.4 + n) * r, fz = z + Math.sin(k * 2.4 + n) * r, fy = H(fx, fz), hh = .09 + (k % 3) * .04; kN.add(M.flat, new THREE.CylinderGeometry(.007, .01, hh, 3), '#5b8f3e', M4(fx, fy + hh / 2, fz)); kN.add(M.flat, new THREE.CircleGeometry(.034, 5), pc, M4(fx, fy + hh + .005, fz, -Math.PI / 2 + .25, k, 0)); kN.add(M.flat, new THREE.CircleGeometry(.012, 4), cc, M4(fx, fy + hh + .012, fz, -Math.PI / 2 + .25, k, 0)); }
    }
    // 台地上的灌木叢與露出來的岩塊（一叢一叢，不要平均撒）
    for (let i = 0, n = 0; i < 160 && n < (LOW ? 9 : 16); i++) {
      const bx = 110 + rd() * 28, bz = -116 + rd() * 30, s = eff(bx, bz); if (!s || s.f < .97 || Math.hypot(bx - LOOK[0], bz - LOOK[1]) < 4 || polyD(bx, bz, TRAIL) < 1.8 || vnoise(bx * .2, bz * .2, 870) < .45) continue; n++;
      const x = bx * K, z = bz * K, y = H(x, z); if (y - lowAt(x, z, 1.2) > .35) { n--; continue; } // 斜坡上不放
      if (n % 3) { [[0, 0, .55], [.5, .15, .4], [-.4, -.2, .42]].forEach(([ox, oz, r], k) => kN.add(M.flat, jit(new THREE.IcosahedronGeometry(1, 0), .25, 880 + n * 3 + k), ['#5f8f4a', '#6c9c52', '#557f43'][(k + n) % 3], M4(x + ox, lowAt(x + ox, z + oz, r) + r * .3, z + oz, 0, k + n, 0, r, r * .75, r))); addCol({ x, z, r: .5 }); }
      else { const s0 = .5 + rd() * .5; kN.add(M.flat, rk(900 + n), HR[n & 3], M4(x, y + s0 * .15, z, rd(), rd() * 6, rd() * .3, s0 * 1.4, s0 * .7, s0)); kN.add(M.flat, rk(920 + n), HR[(n + 1) & 3], M4(x + s0 * 1.1, y + s0 * .05, z + .3, rd(), rd() * 6, 0, s0 * .6, s0 * .4, s0 * .55)); addCol({ x, z, r: s0 * .9 }); }
    }
  }
  // 告示牌兩面：海角上的「海角觀景台」與小路起點的指路牌，畫在同一張貼圖上、合成一個網格（只多一次繪製）
  function signs(kN) {
    const wood = '#7d5c3a', post = '#5b4030';
    const tex = artTex(512, 512, (g, w) => {
      g.save(); woodBoard(g, w, 300); g.restore(); artText(g, '海角觀景台', w / 2, 118, 84, '#a5f3fc', w - 56); g.fillStyle = '#4a3220'; g.fillRect(60, 150, w - 120, 3); artText(g, '燈塔 · 海蝕柱 · 海邊的小湖', w / 2, 228, 40, '#fef3c7', w - 60);
      g.save(); g.translate(0, 316); woodBoard(g, w, 196); g.restore(); artText(g, '往海角觀景台 ↑', w / 2, 316 + 118, 60, '#a5f3fc', w - 50);
    });
    const parts = [], pos = [], uv = [], idx = [];
    const quad = (o, ux, vy, w, h, v0, v1) => { const i = pos.length / 3; [[-1, 0], [1, 0], [1, 1], [-1, 1]].forEach(([a, b]) => { pos.push(o.x + ux.x * a * w / 2, o.y + b * h, o.z + ux.z * a * w / 2); uv.push((a + 1) / 2, v0 + (v1 - v0) * b); }); idx.push(i, i + 1, i + 2, i, i + 2, i + 3); };
    // [位置（基礎單位）, 牌子面向（往哪裡讀）, 寬, 高, 貼圖的 v 範圍]
    [[SIGN[0], Math.atan2(TRAIL[3][0] - SIGN[0][0], TRAIL[3][1] - SIGN[0][1]), 1.6, .94, 212 / 512, 1], [SIGN[1], Math.atan2(-.3, 1), 1.1, .42, 0, 196 / 512]].forEach(([[bx, bz], face, w, h, v0, v1], si) => {
      const x = bx * K, z = bz * K, y = H(x, z) - .05, L = local(x, y, z, face), ux = V(Math.cos(face), 0, -Math.sin(face)), top = si ? 1.25 : 1.55;
      [-1, 1].forEach(s => { const p = L(s * (w / 2 + .02), 0, -.06); kN.add(M.flat, new THREE.CylinderGeometry(.06, .075, top + h + .1, 7), post, M4(p.x, y + (top + h) / 2, p.z)); addCol({ x: p.x, z: p.z, r: .12 }); });
      const b = L(0, 0, -.05); kN.add(M.flat, new THREE.BoxGeometry(w + .08, h + .08, .06), wood, new THREE.Matrix4().compose(V(b.x, y + top + h / 2, b.z), new THREE.Quaternion().setFromEuler(te.set(0, face, 0)), ts));
      if (!si) kN.add(M.flat, new THREE.BoxGeometry(w + .4, .07, .4), '#4a3424', new THREE.Matrix4().compose(V(b.x, y + top + h + .12, b.z - Math.cos(face) * .06), new THREE.Quaternion().setFromEuler(te.set(.12, face, 0, 'YXZ')), ts)); // 小屋頂
      const o = L(0, 0, -.015); quad(V(o.x, y + top, o.z), ux, null, w, h, v0, v1);
    });
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); g.setIndex(idx); g.computeVertexNormals();
    const m = new THREE.Mesh(g, new THREE.MeshStandardMaterial({ map: tex, roughness: .85 })); m.receiveShadow = true; chunkObj(m, 60, false);
  }

  /* ---------- 海邊的小湖：水面（夜光藻）、蘆葦、浮葉、粉紅色的水鳥、半泡在水裡的漂流木 ---------- */
  function lagoonMat() {
    const U = { uNight: { value: 0 }, uP: { value: new THREE.Vector3(0, 0, 0) } };
    const m = new THREE.MeshStandardMaterial({ vertexColors: true, transparent: true, opacity: .84, roughness: .08, metalness: .05, envMapIntensity: .55, depthWrite: false });
    m.onBeforeCompile = sh => {
      Object.assign(sh.uniforms, { uWind: W.wind, uNight: U.uNight, uP: U.uP });
      sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec2 vWq;').replace('#include <begin_vertex>', '#include <begin_vertex>\nvWq = (modelMatrix * vec4(transformed, 1.0)).xz;');
      sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nuniform float uWind;\nuniform float uNight;\nuniform vec3 uP;\nvarying vec2 vWq;\n' + GLSL_DETAIL)
        .replace('#include <normal_fragment_maps>', `#include <normal_fragment_maps>
          float wq = (tN(vWq * 1.6 + vec2(uWind * 0.3, uWind * 0.2)) + tN(vWq * 3.7 - vec2(uWind * 0.25, uWind * 0.37)) * 0.5) * 0.045;
          normal = tPerturb(-vViewPosition, normal, vec2(dFdx(wq), dFdy(wq)));`)
        .replace('#include <color_fragment>', '#include <color_fragment>\ndiffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.02, 0.09, 0.16), 0.8 * uNight); diffuseColor.a = mix(diffuseColor.a, 0.95, uNight);') // 夜裡湖水變成深藍、不透明一點（湖底的淺色沙透上來會發白），夜光藻才看得出來
        .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
          totalEmissiveRadiance += vColor.rgb * 0.16 * (1.0 - uNight); // 白天自己帶一點湖水色；夜裡不要亮得像白天
          // 夜光藻：一顆顆會呼吸的藍綠色光點（遠處也至少一兩個像素大，不會整片消失）；玩家在水裡走動時，腳邊亮起一圈（uP.z＝涉水的程度）
          vec2 lq = vWq * 1.6, lci = floor(lq), lcf = fract(lq) - 0.5 - (vec2(tH(lci + 3.1), tH(lci + 7.7)) - 0.5) * 0.5; float lh = tH(lci), lfw = length(fwidth(lq));
          float ltw = max(0.0, 0.35 + 0.65 * sin(uWind * (1.2 + lh * 2.0) + lh * 40.0)), lr = clamp(lfw * 0.6, 0.05 + lh * 0.04, 0.2), ll = length(lcf);
          float ldot = step(0.7, lh) * ((1.0 - smoothstep(lr * 0.5, lr, ll)) + exp(-ll * ll / (lr * lr * 5.0)) * 0.25) * ltw * (1.0 - 0.7 * smoothstep(0.2, 0.6, lfw)); // 斜看、遠看時格子會被拉長：光點不再放大，改成淡一點
          float lpd = distance(vWq, uP.xy), lring = exp(-lpd * lpd * 0.3) * uP.z, lsw = tN(vWq * 1.3 + vec2(uWind * 0.2, -uWind * 0.15));
          totalEmissiveRadiance += vec3(0.25, 0.85, 1.0) * uNight * (ldot * (1.3 + lring * 2.5) + lring * (0.35 + lsw * 0.5) + smoothstep(0.55, 0.9, lsw) * 0.1);`);
    };
    m.customProgramCacheKey = () => 'coastLagoon'; m.userData.U = U; return m;
  }
  function flamingoGeo() {
    const p = [], pk = '#f9a8c9', dk = '#f472b6', lt = '#fbc4d8';
    p.push([new THREE.SphereGeometry(.2, 10, 8), pk, M4(0, .1, -.02, 0, 0, 0, 1, .82, 1.45)], [new THREE.ConeGeometry(.09, .22, 6), dk, M4(0, .15, -.3, -Math.PI / 2 - .35, 0, 0)]);
    [-1, 1].forEach(s => p.push([new THREE.SphereGeometry(.15, 8, 6), dk, M4(s * .1, .14, -.06, 0, 0, 0, .55, .7, 1.4)]));
    const N = [V(0, .2, .22), V(0, .42, .33), V(0, .6, .24), V(0, .76, .27), V(0, .86, .36)]; for (let i = 1; i < N.length; i++) p.push(stick(N[i - 1], N[i], .042, lt, 6, .038)); // S 形的脖子
    p.push([new THREE.SphereGeometry(.075, 10, 8), lt, M4(0, .9, .38)], [new THREE.ConeGeometry(.034, .14, 6), '#fde7ef', M4(0, .86, .48, Math.PI / 2 + .6, 0, 0)], [new THREE.ConeGeometry(.022, .06, 6), '#1f2937', M4(0, .815, .53, Math.PI / 2 + .95, 0, 0)]);
    [-1, 1].forEach(s => p.push([new THREE.SphereGeometry(.013, 5, 4), '#1f2937', M4(s * .055, .92, .41)]));
    p.push(stick(V(0, -.02, -.02), V(.03, -.27, -.15), .018, '#f48fb1', 5), stick(V(.03, -.27, -.15), V(.03, -.18, .06), .016, '#f48fb1', 5)); // 縮起來的那隻腳（「4」字形）
    return nookMerge(p, true);
  }
  function lagoonScene(kN, rd) {
    const cx = LG.x * K, cz = LG.z * K, wy = LG.w * K, rf = a => lagR(a) * K, U = lagoonMat();
    const wm = new THREE.Mesh(nookDisc(cx, wy, cz, a => rf(a) * 1.05, ['#13707e', '#6fcdbd'], 56, 3), U); chunkObj(wm, LOW ? 72 : 110, false); DYN.lagU = U.userData.U;
    // 西岸、北岸的蘆葦（一叢一叢，中間留空）、浮在水面的小圓葉
    for (let a = 1.7; a < 4.6; a += .2 + rd() * .12) {
      if (vnoise(a * 2.3, 1.7, 501) < .38 || (LOW && rd() < .5)) continue;
      const r = rf(a) * (.9 + rd() * .1), x = cx + Math.cos(a) * r, z = cz + Math.sin(a) * r, g = Math.max(H(x, z), wy - .35);
      for (let k = 0; k < 7; k++) { const h = 1 + (k % 3) * .28 + rd() * .2, ox = x + Math.cos(k * 1.7) * .16, oz = z + Math.sin(k * 1.7) * .16; kN.add(M.flat, new THREE.CylinderGeometry(.012, .022, h, 4), k % 2 ? '#7c8c3a' : '#6b8f3a', M4(ox, g + h / 2, oz, Math.cos(k) * .1, 0, Math.sin(k) * .1)); if (k % 3 === 0) kN.add(M.flat, new THREE.CylinderGeometry(.036, .036, .22, 6), '#6b4423', M4(ox + Math.sin(k) * .05, g + h - .1, oz)); }
    }
    for (let i = 0; i < (LOW ? 8 : 16); i++) { const a = 2.2 + rd() * 1.7, r = rf(a) * (.45 + rd() * .4), x = cx + Math.cos(a) * r, z = cz + Math.sin(a) * r; for (let k = 0; k < 3; k++) kN.add(M.flat, new THREE.CircleGeometry(.16 + k * .03, 7), k % 2 ? '#7fbf5a' : '#6aab4c', M4(x + Math.cos(k * 2.1 + i) * .2, wy + .02 + k * .002, z + Math.sin(k * 2.1 + i) * .2, -Math.PI / 2, 0, i + k)); if (i % 4 === 0) kN.add(M.flat, new THREE.SphereGeometry(.06, 8, 5), '#fdf2f8', M4(x, wy + .07, z, 0, 0, 0, 1, .6, 1)); }
    // 東岸沙堤上半泡在水裡的漂流木、幾顆貝殼
    { const a = -.25, r = rf(a), x = cx + Math.cos(a) * r, z = cz + Math.sin(a) * r; kN.add(M.flat, ...stick(V(x + 1.2, H(x + 1.2, z + .4) + .12, z + .4), V(x - 1, wy - .12, z - .3), .17, '#b3a596', 7, .13)); kN.add(M.flat, ...stick(V(x + .4, H(x + .4, z + .2) + .25, z + .1), V(x + .9, H(x + .4, z) + .75, z - .5), .05, '#a39684', 5)); }
    for (let i = 0; i < 12; i++) { const a = rd() * PI2, r = rf(a) + .8 + rd() * 2.2, x = cx + Math.cos(a) * r, z = cz + Math.sin(a) * r; kN.add(M.flat, new THREE.SphereGeometry(.07, 7, 4, 0, PI2, 0, Math.PI / 2), ['#fde7d6', '#fbcfe8', '#fed7aa'][i % 3], M4(x, H(x, z) - .005, z, 0, rd() * 6, 0, 1, .5, 1.3)); }
    // 粉紅色的水鳥：單腳站在西北邊的淺水裡（腳在近景組、身體是會動的 InstancedMesh）
    const fl = []; for (const [a0, r0] of [[2.5, .78], [2.85, .83], [3.3, .74]]) { const r = rf(a0) * r0, x = cx + Math.cos(a0) * r, z = cz + Math.sin(a0) * r, g = H(x, z); fl.push({ x, y: g + 1, z, g, ry: rd() * 6, ph: rd() * 9 }); }
    fl.forEach(f => { kN.add(M.flat, ...stick(V(f.x, f.g - .05, f.z), V(f.x, f.y - .03, f.z), .022, '#f48fb1', 6)); kN.add(M.flat, new THREE.SphereGeometry(.032, 6, 5), '#f48fb1', M4(f.x, f.g + .55, f.z)); });
    if (LOW) fl.forEach(f => kN.add(M.flat, flamingoGeo(), null, M4(f.x, f.y, f.z, 0, f.ry, 0)));
    else { const im = new THREE.InstancedMesh(flamingoGeo(), M.soft, fl.length); im.instanceMatrix.setUsage(THREE.DynamicDrawUsage); im.frustumCulled = false; fl.forEach((f, i) => im.setMatrixAt(i, M4(f.x, f.y, f.z, 0, f.ry, 0))); chunkObj(im, 70, false, [cx, cz, 16]); DYN.fl = im; DYN.fls = fl; }
    // 彩蛋「會發光的小湖」的引子（10.3）：南岸一塊平石頭上擺著一罐顏色不太對勁的水（亮青色，夜裡自己發光）、靠著一支小撈網，
    // 岸邊濕沙上沾著幾點青色的光點——有人從湖裡舀了夜光藻回來看。罐子裡的水與光點進夜光那組，其餘進近景組（不多一次繪製）。
    // LOW 沒有夜光那組（NM＝平面材質，夜裡是一團深藍）：這罐水和光點自己一組、用會發光的材質，只在 45 公尺內畫——LOW 走到小湖邊才多 1 次繪製
    { const a = 1.25, r = rf(a) + 1.1, x = cx + Math.cos(a) * r, z = cz + Math.sin(a) * r, y = H(x, z), kJ = LOW ? nookKit() : G(kN), JM = LOW ? M.night : NM;
      kN.add(M.flat, rk(905), '#9a9f98', M4(x, y + .06, z, 0, .4, 0, .42, .16, .36));
      kJ.add(JM, new THREE.CylinderGeometry(.13, .12, .28, 10), '#22d3ee', M4(x + .05, y + .36, z));
      kN.add(M.flat, new THREE.TorusGeometry(.125, .02, 4, 12), '#e0f2fe', M4(x + .05, y + .5, z, Math.PI / 2)); kN.add(M.flat, new THREE.CylinderGeometry(.1, .095, .06, 8), '#a16207', M4(x + .05, y + .53, z));
      kN.add(M.flat, ...stick(V(x - .25, y, z + .3), V(x - .1, y + .95, z - .05), .018, '#a07850', 5)); kN.add(M.flat, new THREE.TorusGeometry(.13, .014, 4, 12), '#e7e5e4', M4(x - .08, y + 1.05, z - .1, .3, 0, .25));
      for (let i = 0; i < 9; i++) { const b = a + (i - 4) * .09, rr = rf(b) + .15 + (i % 3) * .2, px = cx + Math.cos(b) * rr, pz = cz + Math.sin(b) * rr; kJ.add(JM, new THREE.SphereGeometry(.035 + (i % 2) * .015, 6, 4), i % 2 ? '#67e8f9' : '#22d3ee', M4(px, H(px, pz) + .01, pz, 0, 0, 0, 1, .4, 1)); }
      if (LOW) kJ.done(45); }
  }

  /* ---------- 漂流木營火（夜裡點著）、吊床小丘、舊碼頭的殘樁 ---------- */
  function fireScene(kM, rd) {
    const x0 = FIRE[0] * K, z0 = FIRE[1] * K, y0 = H(x0, z0), DW = ['#b5a998', '#a89b88', '#c2b6a3'];
    kM.add(M.flat, new THREE.CylinderGeometry(.55, .62, .05, 10), '#3b3633', M4(x0, y0 + .02, z0));
    for (let i = 0; i < 10; i++) { const a = i / 10 * PI2, s = .15 + rd() * .08; kM.add(M.flat, rk(880 + i), i % 2 ? '#8b8478' : '#9a9387', M4(x0 + Math.cos(a) * .72, y0 + s * .45, z0 + Math.sin(a) * .72, rd(), rd() * 6, 0, s * 1.2, s, s)); }
    for (let i = 0; i < 6; i++) { const a = i / 6 * PI2 + .3, f = V(x0 + Math.cos(a) * .42, y0 + .02, z0 + Math.sin(a) * .42), m = f.clone().lerp(V(x0, y0 + .78, z0), .55), tp = V(x0 + Math.cos(a) * .04, y0 + .78, z0 + Math.sin(a) * .04); kM.add(M.flat, ...stick(f, m, .045, DW[i % 3], 5)); kM.add(M.flat, ...stick(m, tp, .04, '#3a302a', 5)); }
    for (let i = 0; i < 6; i++) G(kM).add(NM, new THREE.OctahedronGeometry(.07, 0), i % 2 ? '#ff7a2a' : '#ffb347', M4(x0 + Math.cos(i * 1.3) * .2, y0 + .06, z0 + Math.sin(i * 1.3) * .2, i, i * 2, 0, 1, .6, 1)); // 炭火：夜裡發光
    addCol({ x: x0, z: z0, r: .85 });
    // 圍成半圈的三根漂流木（坐的地方），旁邊一堆撿來的木頭、一只小水壺、排在木頭上的貝殼
    [[-2.1, .5], [-.4, 2.3], [-2.2, -1.7]].forEach(([dx, dz], i) => {
      const x = x0 + dx, z = z0 + dz, a = Math.atan2(dz, dx) + Math.PI / 2, ex = Math.cos(a) * .85, ez = Math.sin(a) * .85, y = Math.min(H(x, z), H(x + ex, z + ez), H(x - ex, z - ez)) + .16; // 沿著圓的切線擺、兩端都貼著沙
      kM.add(M.flat, ...stick(V(x - ex, y, z - ez), V(x + ex, y, z + ez), .2, DW[i], 8, .18)); [-1, 1].forEach(s => kM.add(M.flat, new THREE.CircleGeometry(.17, 8), '#d8cbb5', new THREE.Matrix4().compose(V(x + ex * s * 1.005, y, z + ez * s * 1.005), new THREE.Quaternion().setFromUnitVectors(V(0, 0, 1), V(ex * s, 0, ez * s).normalize()), ts)));
      for (let k = -1; k <= 1; k++) addCol({ x: x + ex * k * .8, z: z + ez * k * .8, r: .28 });
      if (i === 1) [-.35, 0, .35].forEach((o, k) => kM.add(M.flat, new THREE.SphereGeometry(.06, 7, 4, 0, PI2, 0, Math.PI / 2), ['#fbcfe8', '#fde7d6', '#fed7aa'][k], M4(x + ex * o, y + .19, z + ez * o, 0, k, 0, 1, .5, 1.3)));
    });
    { const x = x0 - 1.4, z = z0 - 2.9, y = H(x, z); for (let r = 0; r < 3; r++) for (let i = 0; i < 4 - r; i++) kM.add(M.flat, new THREE.CylinderGeometry(.08, .09, 1.3 - r * .15, 6), DW[(i + r) % 3], M4(x + (i - (3 - r) / 2) * .19, y + .09 + r * .15, z, Math.PI / 2, 0, .3 + i * .06)); addCol({ x, z, r: .6 }); }
    { const x = x0 + 1.05, z = z0 - .55, y = H(x, z); kM.add(M.flat, rk(890), '#8b918a', M4(x, y + .07, z, 0, 0, 0, .26, .12, .24)); kM.add(M.flat, new THREE.SphereGeometry(.15, 12, 8), '#5fbfb3', M4(x, y + .3, z, 0, 0, 0, 1, .82, 1)); kM.add(M.flat, new THREE.CylinderGeometry(.04, .06, .14, 6), '#5fbfb3', M4(x + .15, y + .34, z, 0, 0, -1)); kM.add(M.flat, new THREE.TorusGeometry(.1, .012, 4, 10, Math.PI), '#334155', M4(x, y + .4, z)); }
    // 火焰：三片加法混色的錐體，只有黃昏與夜裡出現（regionStep 讓它跳動）
    const glow = new THREE.RingGeometry(.001, 2.6, 28, 3).rotateX(-Math.PI / 2), gp = glow.attributes.position, gc = new Float32Array(gp.count * 3), oc = new THREE.Color('#8a3a10');
    for (let i = 0; i < gp.count; i++) { const k = sq(1 - Math.min(1, Math.hypot(gp.getX(i), gp.getZ(i)) / 2.6)) * .55; gc.set([oc.r * k, oc.g * k, oc.b * k], i * 3); } glow.setAttribute('color', new THREE.BufferAttribute(gc, 3)); glow.deleteAttribute('uv');
    const fg = nookMerge([[new THREE.ConeGeometry(.3, .85, 7, 1, true), '#c2410c', M4(0, .42, 0)], [new THREE.ConeGeometry(.2, .6, 6, 1, true), '#ea580c', M4(.08, .3, .05)], [new THREE.ConeGeometry(.13, .42, 6, 1, true), '#d97706', M4(-.06, .22, -.04)], [glow, null, M4(0, -.02, 0)]]);
    const fm = new THREE.Mesh(fg, new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, opacity: .8, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false, side: THREE.DoubleSide })); fm.position.set(x0, y0 + .05, z0); fm.visible = false; W.scene.add(fm); DYN.fire = fm; // 火焰＋地上一圈暖光（不加光源）
  }
  // 椰子樹（只有兩棵，直接合併進近景組）：一節一節的樹幹往外歪、八片垂下來的葉子、三顆椰子
  function palm(kt, x, z, lean, ry, hgt, rd) {
    let p = V(x, H(x, z) - .15, z); const dx = Math.sin(ry), dz = Math.cos(ry), pts = [p];
    for (let i = 0; i < 7; i++) { const n = p.clone().add(V(dx * lean * (.12 + i * .05), hgt / 7, dz * lean * (.12 + i * .05))); kt.add(M.flat, ...stick(p, n, .17 - i * .01, i % 2 ? '#8b6b4a' : '#7a5c3e', 7, .16 - i * .01)); pts.push(n); p = n; }
    for (let k = 0; k < 8; k++) { const l = new THREE.SphereGeometry(1, 6, 3); l.scale(.24, .04, 1.3); l.translate(0, 0, 1.15); kt.add(M.flat, l, k % 2 ? '#2f9e57' : '#3fb76a', MY(p.x, p.y + .08, p.z, .45 + (k % 3) * .12 + rd() * .1, k / 8 * PI2 + rd() * .3)); }
    for (let k = 0; k < 3; k++) kt.add(M.flat, new THREE.SphereGeometry(.13, 7, 5), '#5b3a1f', M4(p.x + Math.cos(k * 2) * .17, p.y - .08, p.z + Math.sin(k * 2) * .17));
    addCol({ x, z, r: .26, tree: 1 }); return pts;
  }
  function knollScene(kM, rd) {
    // 兩棵椰子樹往外歪，中間掛一張條紋吊床，一隻小史萊姆在裡面睡午覺（吊床連同史萊姆一起慢慢晃）
    const A0 = [(KN[0] - 1.25) * K, (KN[1] - .45) * K], B0 = [(KN[0] + 1.25) * K, (KN[1] + .45) * K], dir = Math.atan2(B0[0] - A0[0], B0[1] - A0[1]);
    const pa = palm(kM, A0[0], A0[1], .55, dir + Math.PI, 5.2, rd), pb = palm(kM, B0[0], B0[1], .5, dir, 4.8, rd);
    const A = pa[2].clone().lerp(pa[3], .3), B = pb[2].clone().lerp(pb[3], .3); A.y = B.y = Math.min(A.y, B.y); // 兩個掛點一樣高，吊床才不會歪
    const L = Math.hypot(B.x - A.x, B.z - A.z), mid = A.clone().lerp(B, .5), yaw = Math.atan2(-(B.z - A.z), B.x - A.x), sag = .62, e = L / 2 - .45;
    const pos = [], col = [], idx = [], NU = 14, NV = 6, CS = ['#f9a8d4', '#fde68a', '#a5f3fc', '#fef3c7'].map(c => new THREE.Color(c));
    for (let side = 0; side < 2; side++) for (let i = 0; i <= NU; i++) for (let j = 0; j <= NV; j++) {
      const u = i / NU, v = j / NV * 2 - 1, w = .48 * Math.pow(Math.sin(Math.PI * u), .6) + .05, y = -sag * 4 * u * (1 - u) * (.35 + .65 * (1 - v * v * .3)) - .18 + .1 * v * v - side * .015;
      pos.push(-e + 2 * e * u, y, v * w); const c = CS[Math.floor((v + 1) / 2 * 5.999) % 4]; col.push(c.r, c.g, c.b);
    }
    const S = (NU + 1) * (NV + 1); for (let side = 0; side < 2; side++) for (let i = 0; i < NU; i++) for (let j = 0; j < NV; j++) { const a = side * S + i * (NV + 1) + j, b = a + NV + 1; if (side) idx.push(a, a + 1, b, b, a + 1, b + 1); else idx.push(a, b, a + 1, b, b + 1, a + 1); }
    const fab = new THREE.BufferGeometry(); fab.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); fab.setAttribute('color', new THREE.Float32BufferAttribute(col, 3)); fab.setIndex(idx); fab.computeVertexNormals();
    const parts = [[fab, null]];
    [-1, 1].forEach(s => [-.05, .05].forEach(o => parts.push(stick(V(s * L / 2, 0, 0), V(s * e, -.2, o), .012, '#d6c7a5', 4))));
    parts.push([toyGeo('#fbcfe8', true), null, M4(.1, -sag - .02, 0, -1.25, Math.PI / 2, 0, .62)]);
    const hg = new THREE.Group(); hg.position.copy(mid); hg.rotation.order = 'YXZ'; hg.rotation.y = yaw; const hm = new THREE.Mesh(nookMerge(parts, true), M.soft); hm.castShadow = false; hg.add(hm);
    if (LOW) { hg.updateMatrixWorld(true); kM.add(M.flat, hm.geometry, null, hm.matrixWorld.clone()); } else { chunkObj(hg, 60, false, [mid.x, mid.z, 4]); DYN.ham = hg; }
    addCol({ x: mid.x, z: mid.z, r: .55 });
    // 樹下一顆椰子、一片掉下來的葉子
    { const x = mid.x + .9, z = mid.z + 1.2; kM.add(M.flat, new THREE.SphereGeometry(.14, 7, 5), '#5b3a1f', M4(x, H(x, z) + .1, z)); const l = new THREE.SphereGeometry(1, 6, 3); l.scale(.22, .03, 1.2); kM.add(M.flat, l, '#8a9a4a', M4(x - 1.5, H(x - 1.5, z - .4) + .04, z - .4, 0, .9, 0)); }
  }
  /* ---------- 燈塔的岩岬：從燈塔的岩石小島往東北伸進海裡的一串圓石，越往外越矮、越泡在浪裡；最外面那塊上立著一根紅白小航標，夜裡亮著 ---------- */
  function lightPoint(kF, kM, rd) {
    const A = [130.6, 12.6], B = [137.6, 16.6], n = LOW ? 8 : 12, RC = ['#6b6f68', '#7c7f76', '#5f625c', '#868a80']; let end = null; // 基礎單位；和燈塔小島同一組灰石色
    for (let i = 0; i < n; i++) {
      const t = i / (n - 1), bx = A[0] + (B[0] - A[0]) * t + (rd() - .5) * 1.2, bz = A[1] + (B[1] - A[1]) * t + (rd() - .5) * 1.6 + Math.sin(t * 6) * .5, x = bx * K, z = bz * K;
      const s = (2 - t * 1.1) * (.85 + rd() * .3), g = lowAt(x, z, s), top = Math.max(g + s * 1.1, WATER_Y + (1.5 - t * 1.05) * (.8 + rd() * .4)), y0 = g - s * .35, hy = (top - y0) / 2; // 深一點的地方石頭長高一點，頂面才露得出水面
      kF.add(FM, rk(960 + i), RC[i % 4], M4(x, y0 + hy, z, rd() * .4, rd() * 6, rd() * .4, s * 1.2, hy, s));
      if (g < WATER_Y + .4) kF.add(FM, new THREE.SphereGeometry(s * 1.05, 8, 2, 0, PI2, 0, Math.PI / 2), '#4f7a3f', M4(x, WATER_Y - .03, z, 0, i, 0, 1.2, .16, 1.05)); // 吃水線一圈海藻
      if (i % 3 === 1) kF.add(FM, new THREE.SphereGeometry(s * .62, 7, 2, 0, PI2, 0, Math.PI / 2), '#6f8f56', M4(x, top - .08, z, 0, i, 0, 1.15, .28, .9)); // 頂上一頂苔
      if (i % 2 === 0) for (let k = 0; k < 3; k++) { const p = rd() * PI2, r = s * (1.3 + rd() * .5), px = x + Math.cos(p) * r, pz = z + Math.sin(p) * r, ss = .25 + rd() * .35, pg = lowAt(px, pz, ss); if (pg < WATER_Y - .9) continue; kF.add(FM, rk(980 + i * 3 + k), RC[(i + k) % 4], M4(px, pg + ss * .3, pz, rd(), rd() * 6, rd(), ss * 1.3, ss * .7, ss)); } // 腳邊的小碎石
      if (g > WATER_Y - 1) addCol({ x, z, r: s * .95 }); // 走得到的那幾塊才擋
      if (i === 2) [[.4, .2, '#fb7185'], [-.3, -.35, '#f97316']].forEach(([ox, oz, c], k) => { for (let j = 0; j < 5; j++) kM.add(M.flat, new THREE.SphereGeometry(.09, 6, 4), c, M4(x + ox * s + Math.cos(j * 1.257) * .13, top - .03, z + oz * s + Math.sin(j * 1.257) * .13, 0, -j * 1.257 - k, 0, 2.2, .45, 1)); }); // 兩隻海星
      end = { x, z, top };
    }
    // 航標：細細的紅白條紋柱、頂上一盞小燈（夜裡發光）、一圈小欄杆
    const { x, z, top } = end, y = top - .12;
    for (let k = 0; k < 4; k++) kM.add(M.flat, new THREE.CylinderGeometry(.1, .11, .42, 8), k % 2 ? '#f4efe6' : '#d14b3c', M4(x, y + .21 + k * .42, z));
    kM.add(M.flat, new THREE.CylinderGeometry(.26, .26, .05, 10), '#2f3a48', M4(x, y + 1.7, z)); G(kM).add(NM, new THREE.CylinderGeometry(.16, .16, .26, 8), '#ffd36b', M4(x, y + 1.86, z)); kM.add(M.flat, new THREE.ConeGeometry(.19, .2, 8), '#d14b3c', M4(x, y + 2.05, z));
    for (let k = 0; k < 6; k++) kM.add(M.flat, new THREE.CylinderGeometry(.012, .012, .2, 3), '#2f3a48', M4(x + Math.cos(k * 1.047) * .24, y + 1.8, z + Math.sin(k * 1.047) * .24));
    kM.add(M.flat, new THREE.TorusGeometry(.24, .012, 3, 12), '#2f3a48', M4(x, y + 1.9, z, Math.PI / 2));
  }
  /* ---------- 漂流木堆：一棵連根被沖上岸、曬得發白的大樹，壓著幾根小一點的漂流木；根上卡著一顆橘色浮球、綁著一串貝殼風鈴，樹幹上趴著一隻小螃蟹 ---------- */
  function driftScene(kM, rd) {
    const x0 = DRIFT[0] * K, z0 = DRIFT[1] * K, face = .55, L = (lx, lz, dy = 0) => { const p = local(x0, 0, z0, face)(lx, 0, lz); p.y = H(p.x, p.z) + dy; return p; }, DW = ['#dcc39c', '#cdb08a', '#e6d3b3', '#c1a27c'];
    // 主幹：根那頭架在根團上、往樹梢慢慢低下去；兩根折斷的枝椏
    const R0 = L(-3.4, 0, .7), T0 = L(3.6, .2, .26), seg = 5; let prev = R0;
    for (let k = 1; k <= seg; k++) { const p = R0.clone().lerp(T0, k / seg); p.y = Math.max(p.y, H(p.x, p.z) + .24 - k * .01); kM.add(M.flat, ...stick(prev, p, .44 - (k - 1) * .06, DW[k % 4], 8, .44 - k * .06)); prev = p; }
    [[.35, .6, .9], [.62, -.7, .7]].forEach(([t, side, l], k) => { const b = R0.clone().lerp(T0, t), d = local(0, 0, 0, face)(side, 0, .5); kM.add(M.flat, ...stick(b, b.clone().add(V(d.x * l, .5 + k * .2, d.z * l)), .09, DW[(k + 2) % 4], 6, .05)); });
    // 根團：一圈往外翹、末端越來越細的根
    { const sd = local(0, 0, 0, face)(1, 0, 0), bk = local(0, 0, 0, face)(0, 0, -1); // 根：從斷面往四周散開、往後彎、末端垂到沙上，一節比一節細
      for (let k = 0; k < 10; k++) { const a = k / 10 * PI2 + rd() * .35, r = V(sd.x * Math.sin(a), Math.cos(a) * .9, sd.z * Math.sin(a)), l = .8 + rd() * .35; let p = R0.clone().add(r.clone().multiplyScalar(.2));
        [[.45, .12, 0, .15], [.4, .25, -.12, .1], [.3, .32, -.22, .06]].forEach(([o, b, dy, rr], j) => { const n = p.clone().add(r.clone().multiplyScalar(o * l)).add(bk.clone().multiplyScalar(b)).add(V(0, dy, 0)); n.y = Math.max(n.y, H(n.x, n.z) + .03); kM.add(M.flat, ...stick(p, n, rr, DW[(k + j) % 4], 5, rr * .6)); p = n; }); } }
    kM.add(M.flat, new THREE.IcosahedronGeometry(.4, 1), '#a88c69', M4(R0.x, R0.y, R0.z, .3, face, .2, .75, 1, .9)); // 根團中間一團糾成一塊的根與乾掉的泥
    // 第二根漂流木斜靠在主幹上、第三根橫躺在沙上；一小堆細枝
    { const a = L(-.6, 2.3, .15), b = R0.clone().lerp(T0, .45).add(V(0, .42, 0)); kM.add(M.flat, ...stick(a, b, .19, DW[2], 7, .15)); kM.add(M.flat, new THREE.CircleGeometry(.18, 7), '#e9dfcc', new THREE.Matrix4().compose(a.clone().add(b.clone().sub(a).normalize().multiplyScalar(-.01)), new THREE.Quaternion().setFromUnitVectors(V(0, 0, 1), a.clone().sub(b).normalize()), ts)); }
    { const a = L(1.2, -1.6, .15), b = L(3.6, -.9, .13); kM.add(M.flat, ...stick(a, b, .16, DW[3], 7, .13)); }
    for (let k = 0; k < 6; k++) { const a = L(1.6 + k * .18, 1.1 + (k % 2) * .3, .04), b = a.clone().add(V(Math.cos(k * 1.9) * .9, .35 + (k % 3) * .12, Math.sin(k * 1.9) * .9)); kM.add(M.flat, ...stick(a, b, .035, DW[k % 4], 4, .02)); }
    // 根上卡著的橘色浮球（一段麻繩垂下來）
    { const p = R0.clone().add(local(0, 0, 0, face)(-.2, 0, -.75)).add(V(0, .35, 0)); kM.add(M.flat, new THREE.SphereGeometry(.24, 12, 9), '#fb923c', M4(p.x, p.y, p.z)); kM.add(M.flat, new THREE.TorusGeometry(.245, .025, 5, 16), '#fef3c7', M4(p.x, p.y, p.z, Math.PI / 2)); kM.add(M.flat, ...stick(p.clone().add(V(0, -.24, 0)), V(p.x + .15, H(p.x + .15, p.z + .3) + .02, p.z + .3), .012, '#d6c7a5', 3)); }
    // 小螃蟹：趴在主幹中段，兩隻大螯舉起來
    { const p = R0.clone().lerp(T0, .62), cy = p.y + .3, f = face + Math.PI / 2, C = local(p.x, cy, p.z, f);
      kM.add(M.flat, new THREE.SphereGeometry(.11, 10, 7), '#f97316', M4(...C(0, .02, 0).toArray(), 0, f, 0, 1.3, .55, 1));
      [-1, 1].forEach(s => { const e = C(s * .045, .1, .07); kM.add(M.flat, new THREE.CylinderGeometry(.008, .008, .07, 3), '#ea580c', M4(e.x, e.y - .03, e.z)); kM.add(M.flat, new THREE.SphereGeometry(.022, 6, 5), '#1f2937', M4(e.x, e.y + .01, e.z));
        const c = C(s * .17, .07, .07); kM.add(M.flat, new THREE.SphereGeometry(.055, 8, 6), '#fb923c', M4(c.x, c.y, c.z, 0, f, s * .5, 1, .75, .8));
        for (let j = 0; j < 3; j++) { const l0 = C(s * .1, 0, -.04 + j * .045), l1 = C(s * .2, -.07, -.06 + j * .05); kM.add(M.flat, ...stick(l0, l1, .012, '#ea580c', 3)); } }); }
    // 根團上翹起一根歪歪的根，有人在上面綁了一串貝殼與海玻璃做成的風鈴
    const W0 = R0.clone().add(V(0, .25, 0)), W1 = W0.clone().add(local(0, 0, 0, face)(-.25, 0, -.55)).add(V(0, 1.5, 0)), W2 = W1.clone().add(local(0, 0, 0, face)(.5, 0, .1)).add(V(0, .25, 0));
    kM.add(M.flat, ...stick(W0, W1, .13, DW[1], 6, .08)); kM.add(M.flat, ...stick(W1, W2, .07, DW[3], 5, .035));
    const CH = W1.clone().lerp(W2, .55), cb = local(0, 0, 0, face)(1, 0, 0); kM.add(M.flat, ...stick(CH.clone().add(V(-cb.x * .32, -.06, -cb.z * .32)), CH.clone().add(V(cb.x * .32, -.06, cb.z * .32)), .025, '#a0764c', 5)); // 小橫木
    [-.26, 0, .26].forEach((o, k) => { const top = CH.clone().add(V(cb.x * o, -.06, cb.z * o)), len = .55 + k % 2 * .15, bot = top.clone().add(V(0, -len, 0)); kM.add(M.flat, ...stick(top, bot, .006, '#d6c7a5', 3));
      for (let j = 0; j < 3; j++) { const p = top.clone().lerp(bot, (j + 1) / 3); if (j === 1) G(kM).add(NM, new THREE.OctahedronGeometry(.045, 0), ['#7fd6c2', '#a5f3fc', '#86efac'][k], M4(p.x, p.y, p.z, 0, k + j, 0, 1, 1.5, .5)); else kM.add(M.flat, new THREE.SphereGeometry(.055, 8, 4, 0, PI2, 0, Math.PI / 2), ['#fbcfe8', '#fde7d6', '#fed7aa'][(k + j) % 3], M4(p.x, p.y, p.z, Math.PI / 2, k + j, 0, 1, .5, 1.3)); } });
    // 沙上幾片會在夜裡發光的海玻璃、幾顆貝殼
    for (let k = 0; k < 7; k++) { const p = L(-2.4 + rd() * 5.5, -2.6 + rd() * 1.6, .02); G(kM).add(NM, new THREE.OctahedronGeometry(.045, 0), ['#7fd6c2', '#a5f3fc', '#bfdbfe', '#86efac'][k % 4], M4(p.x, p.y, p.z, rd(), rd() * 6, 0, 1.3, .5, 1)); }
    for (let k = 0; k < 5; k++) { const p = L(-2 + rd() * 5, 1.2 + rd() * 1.8, 0); kM.add(M.flat, new THREE.SphereGeometry(.07, 7, 4, 0, PI2, 0, Math.PI / 2), ['#fbcfe8', '#fde7d6', '#fed7aa'][k % 3], M4(p.x, p.y - .005, p.z, 0, rd() * 6, 0, 1, .5, 1.3)); }
    // 碰撞：沿著主幹、斜靠的那根
    for (let k = 0; k <= 4; k++) { const p = R0.clone().lerp(T0, k / 4); addCol({ x: p.x, z: p.z, r: k ? .4 : .9 }); }
    const hb = hitBox(.9, .9, .9, CH.x, CH.y - .35, CH.z); W.scene.add(hb);
    addInter(hb, 'nook', 'coast_chime', '搖搖風鈴', { act() { [1568, 1976, 2349, 1760].forEach((f, i) => setTimeout(() => nkSfx.bell(f, .5), i * 140)); eggHit('coast_chime', '有人用貝殼和海玻璃串成風鈴，掛在漂流木的根上，叮叮噹噹的。'); } });
  }
  function piles(kF, kM, rd) {
    // 兩排木樁從濕沙一路插進海裡；有的斷了只剩短短一截、有的歪了；靠岸的四對還留著橫木、斜撐和幾片橋面；幾根頂上停著海鷗
    const tops = [], first = [];
    PILE_ROWS.forEach((zr, ri) => {
      for (let bx = 127.6, i = 0; bx < 152; bx += 1.9, i++) {
        if (hashN(i, ri, 3) < .15 && i > 3) continue;
        const x = (bx + (rd() - .5) * .25) * K, z = (zr + (rd() - .5) * .2) * K, g = H(x, z), brk = i > 3 && hashN(i, ri, 5) < .3, top = Math.max(g + (i < 4 ? 1.5 : .5), WATER_Y + (brk ? .3 + rd() * .5 : 2.8 + rd() * .5 - i * .05)); // 靠岸那幾對最高（從沙灘看得出是一座碼頭），往外越來越矮
        const len = top - g + .6, r0 = .22 + rd() * .05, rx = (rd() - .5) * (brk ? .25 : .1), rz = (rd() - .5) * (brk ? .25 : .1), geo = new THREE.CylinderGeometry(r0 * .9, r0, len, 7, 6), p = geo.attributes.position, cl = new Float32Array(p.count * 3), c = new THREE.Color();
        for (let k = 0; k < p.count; k++) { const wy = g - .6 + (p.getY(k) + len / 2); c.set(wy < WATER_Y - .15 ? '#3f3a30' : wy < WATER_Y + .4 ? '#4d6b3a' : wy > top - .1 ? '#d6c09c' : k % 3 ? '#957d63' : '#857057'); cl.set([c.r, c.g, c.b], k * 3); } // 泡水的地方深色、浪打的那一段長海藻、上面是曬淡的灰褐色木頭（深色的話從沙灘看過去只是一團黑影）、斷口是淡色的木頭
        geo.setAttribute('color', new THREE.BufferAttribute(cl, 3)); kF.add(FM, geo, null, M4(x, g - .6 + len / 2, z, rx, 0, rz));
        if (!brk) tops.push(V(x - Math.sin(rz) * len / 2, top, z + Math.sin(rx) * len / 2));
        if (i < 4) first[ri * 4 + i] = { x, z, top };
        if (g > WATER_Y - .75) addCol({ x, z, r: r0 + .05 });
      }
    });
    for (let i = 0; i < 4; i++) { const a = first[i], b = first[4 + i]; if (!a || !b) continue; const y = Math.min(a.top, b.top) - .22;
      kF.add(FM, ...stick(V(a.x, y, a.z), V(b.x, y, b.z), .09, '#7d6650', 5)); if (i % 2) kF.add(FM, ...stick(V(a.x, Math.max(H(a.x, a.z), WATER_Y) + .3, a.z), V(b.x, y - .1, b.z), .055, '#6e5a46', 5));
      if (i < 3) for (let k = 0; k < 3; k++) if (hashN(i, k, 17) > .35) { const t = (k + .5) / 3, px = a.x + (first[i + 1] ? (first[i + 1].x - a.x) * t : t * 1.9 * K), pz = (a.z + b.z) / 2; kF.add(FM, new THREE.BoxGeometry(.5, .07, (b.z - a.z) + .5), k % 2 ? '#b0936e' : '#a0825f', M4(px, y + .12, pz, 0, (hashN(i, k, 19) - .5) * .2, (hashN(i, k, 23) - .5) * .12)); } } // 靠岸那段還剩幾片橋面
    [1, 4, 7, 10].forEach(i => { const p = tops[i % tops.length]; if (!p) return; kM.add(M.flat, new THREE.SphereGeometry(.15, 10, 8), '#f8fafc', M4(p.x, p.y + .14, p.z, 0, i, 0, 1.35, .85, 1)); kM.add(M.flat, new THREE.SphereGeometry(.09, 10, 8), '#f8fafc', M4(p.x + Math.cos(i) * .16, p.y + .27, p.z - Math.sin(i) * .16)); kM.add(M.flat, new THREE.ConeGeometry(.024, .1, 5), '#f59e0b', M4(p.x + Math.cos(i) * .27, p.y + .26, p.z - Math.sin(i) * .27, 0, i, -Math.PI / 2)); kM.add(M.flat, new THREE.BoxGeometry(.24, .03, .26), '#94a3b8', M4(p.x, p.y + .2, p.z, 0, i, 0)); });
  }
  const PILE_ROWS = [24.6, 26.9];

  /* ---------- 沙丘：防沙籬、吊椅、海邊的牽牛花、一串小腳印和睡在沙窩裡的小史萊姆 ---------- */
  function duneScene(kS, rd) {
    const SL = ['#a58a6a', '#b89c78', '#9b8162'];
    FENCES.forEach(([a, b], fi) => {
      const ax = a[0] * K, az = a[1] * K, bx = b[0] * K, bz = b[1] * K, L = Math.hypot(bx - ax, bz - az), nx = (bz - az) / L, nz = -(bx - ax) / L; let prev = null;
      for (let d = 0; d <= L; d += .17) {
        const t = d / L, zig = Math.sin(d * .9 + fi) * .25, x = ax + (bx - ax) * t + nx * zig, z = az + (bz - az) * t + nz * zig, g = H(x, z), sk = hashN(fi, Math.round(d * 10), 11);
        if (sk < .08) continue; // 掉了幾片
        const h = .78 + (Math.round(d / .17) % 2) * .14 + (sk - .5) * .1, lean = (sk - .5) * .12;
        if (sk > .95) { kS.add(M.flat, new THREE.BoxGeometry(.065, h, .02), SL[fi % 3], M4(x + nx * .3, lowAt(x + nx * .3, z + nz * .3, h / 2) + .02, z + nz * .3, Math.PI / 2 - .1, Math.atan2(bx - ax, bz - az), 0)); continue; } // 倒在沙上的一片
        kS.add(M.flat, new THREE.BoxGeometry(.065, h, .02), SL[(Math.round(d * 6) + fi) % 3], M4(x, g + h / 2 - .22, z, lean, Math.atan2(bx - ax, bz - az) + Math.PI / 2, lean * .5));
        const p = V(x, g, z); if (prev) [.12, .42].forEach(o => kS.add(M.flat, ...stick(V(prev.x, prev.y + o, prev.z), V(p.x, p.y + o, p.z), .008, '#57534e', 3))); prev = p;
      }
    });
    // 吊椅：沙丘頂上兩組漂流木 A 字架＋橫樑（曬白的暖色木頭，綁繩的地方纏著麻繩），下面掛一張有靠背的小長椅（會晃的部分另外一個網格）；橫樑下一串夜裡會亮的浮球
    { const [sbx, sbz] = swingAt(), x = sbx * K, z = sbz * K, gy = H(x, z), face = Math.PI / 2 - .15, L = local(x, gy, z, face), DW = ['#c4b096', '#b9a386', '#cdbba1'], BY = 2.6;
      [-1.2, 1.2].forEach((o, k) => [-.85, .85].forEach((f, j) => { const foot = L(o, 0, f); foot.y = H(foot.x, foot.z) - .15; const top = L(o + (j - .5) * .06, BY + .08, 0), mid = foot.clone().lerp(top, .5).add(V((k - .5) * .05, 0, (j - .5) * .04)); kS.add(M.flat, ...stick(foot, mid, .1, DW[(k + j) % 3], 6, .09)); kS.add(M.flat, ...stick(mid, top, .09, DW[(k + j + 1) % 3], 6, .075)); addCol({ x: foot.x, z: foot.z, r: .15 }); }));
      kS.add(M.flat, ...stick(L(-1.45, BY + .14, 0), L(1.45, BY + .14, 0), .11, '#b8a385', 7));
      { const FC = ['#f9a8d4', '#fde68a', '#a5f3fc', '#c4b5fd', '#86efac', '#fdba74'], gp = []; for (let k = 0; k <= 8; k++) { const o = -1.15 + k / 8 * 2.3; gp.push(L(o, BY + .05 - .32 * (1 - sq(o / 1.15)), .16)); } for (let k = 1; k < gp.length; k++) kS.add(M.flat, ...stick(gp[k - 1], gp[k], .01, '#d6c7a5', 3)); for (let k = 1; k < 8; k++) G(kS).add(NM, new THREE.SphereGeometry(.075, 8, 6), FC[k % 6], M4(gp[k].x, gp[k].y - .07, gp[k].z)); } // 橫樑下掛一串彩色浮球：夜裡像一串小燈泡亮起來
      [-1.2, 1.2].forEach(o => kS.add(M.flat, new THREE.CylinderGeometry(.14, .14, .16, 7), '#d6c7a5', new THREE.Matrix4().compose(L(o, BY + .12, 0), new THREE.Quaternion().setFromEuler(te.set(0, face, Math.PI / 2, 'YXZ')), ts)));
      const RP = '#d6c7a5', seat = mergeParts([stick(V(-.42, 0, 0), V(-.46, -1.7, .12), .016, RP, 4), stick(V(-.42, 0, 0), V(-.46, -1.32, -.2), .016, RP, 4), stick(V(.42, 0, 0), V(.46, -1.7, .12), .016, RP, 4), stick(V(.42, 0, 0), V(.46, -1.32, -.2), .016, RP, 4),
        [new THREE.BoxGeometry(1.02, .07, .4), '#b08d64', M4(0, -1.75, 0)], [new THREE.BoxGeometry(1.02, .34, .05), '#a07850', M4(0, -1.5, -.21, -.18, 0, 0)], [new THREE.BoxGeometry(.86, .07, .32), '#f9a8d4', M4(0, -1.69, .01)], [new THREE.BoxGeometry(.06, .3, .4), '#8b6b4a', M4(-.5, -1.62, 0)], [new THREE.BoxGeometry(.06, .3, .4), '#8b6b4a', M4(.5, -1.62, 0)]]);
      const sg = new THREE.Group(), sp = L(0, BY + .04, 0); sg.position.copy(sp); sg.rotation.order = 'YXZ'; sg.rotation.y = face;
      if (LOW) { sg.updateMatrixWorld(true); kS.add(M.flat, seat, null, sg.matrixWorld.clone()); } else { sg.add(new THREE.Mesh(seat, M.flat)); chunkObj(sg, 60, false, [x, z, 2]); DYN.sw = sg; } // LOW：不晃，少一次繪製
      addCol({ x, z, r: .5 }); const hb = hitBox(1.1, .8, .7, x, gy + .95, z); W.scene.add(hb);
      addInter(hb, 'nook', 'coast_swing', '坐上吊椅晃一晃', { act() { DYN.swA = Math.max(DYN.swA, .72); if (S.sound) { try { const ac = audio(), t0 = ac.currentTime; noise(ac, t0, .7, 420, .7, .05, 'lowpass', .5); tone(392, t0 + .05, .5, .02, 'triangle'); } catch (e) { } } eggHit('coast_swing', '海風把吊椅推得好高，好像要飛到海上了。'); } }); }
    // 海邊的牽牛花：貼著沙丘下緣爬的圓葉子，中間開幾朵平平的粉紅色五瓣小花
    for (let i = 0, n = 0; i < 300 && n < (LOW ? 9 : 18); i++) {
      const bx = 94 + rd() * 38, bz = 50 + rd() * 54, s = eff(bx, bz); if (!s || s.d < .2 || s.d > 1.2 || inScene(bx, bz)) continue; n++;
      for (let k = 0; k < 9; k++) { const r = .15 + k * .09, x = bx * K + Math.cos(k * 1.9 + n) * r, z = bz * K + Math.sin(k * 1.9 + n) * r; kS.add(M.flat, new THREE.CircleGeometry(.085, 6), k % 2 ? '#4d8a3c' : '#5c9a44', onGround(x, z, k, 1, .02).multiply(M4(0, 0, 0, -Math.PI / 2)));
        if (k % 3 === 1) { const m = onGround(x + .07, z + .04, k, 1, .045); kS.add(M.flat, new THREE.CircleGeometry(.06, 5), k % 2 ? '#f9a8d4' : '#f472b6', m.clone().multiply(M4(0, 0, 0, -Math.PI / 2))); kS.add(M.flat, new THREE.CircleGeometry(.02, 5), '#fdf2f8', m.clone().multiply(M4(0, .006, 0, -Math.PI / 2))); } }
    }
    // 小腳印：圓圓的一個接一個，從浪邊翻過沙丘，一路通到沙窩
    const pts = crPts(PRINTS.map(([x, z]) => [x * K, z * K]), 10); let acc = 0, side = 1;
    for (let i = 1; i < pts.length; i++) { const [ax, az] = pts[i - 1], [bx, bz] = pts[i], d = Math.hypot(bx - ax, bz - az); acc += d; if (acc < .55) continue; acc = 0; side = -side; const nx = -(bz - az) / d, nz = (bx - ax) / d, x = bx + nx * .07 * side, z = bz + nz * .07 * side; kS.add(M.flat, new THREE.CircleGeometry(.08, 8), '#c9b385', onGround(x, z, Math.atan2(bx - ax, bz - az), 1, .015).multiply(M4(0, 0, 0, -Math.PI / 2, 0, 0, 1, 1.3, 1))); }
    { const x = NEST[0] * K, z = NEST[1] * K, y = H(x, z); kS.add(M.flat, new THREE.TorusGeometry(.75, .16, 5, 14), '#e2cf9e', M4(x, y - .03, z, Math.PI / 2, 0, 0, 1, 1, .5)); kS.add(LOW ? M.flat : M.toy, toyGeo('#bfe9ff', true), null, M4(x, y - .06, z, 0, -2.2, 0, .7)); kS.add(M.flat, new THREE.SphereGeometry(.09, 9, 5, 0, PI2, 0, Math.PI / 2), '#fbcfe8', M4(x + Math.sin(-2.2) * .3, y + .12, z + Math.cos(-2.2) * .3, -.4, 0, 0, 1, .55, 1.25)); }
  }

  /* ---------- 整條海岸：高潮線上的漂流物、海灘草、夜裡發藍光的浪花 ---------- */
  // 高潮線上被浪推上岸的海藻：地表材質本來就畫了一條漲潮線（一團團海草與碎貝殼），這裡只在幾段放看得出立體的海藻堆——
  // 一團攤得扁扁的深橄欖色海藻，幾條細長的褐綠色葉帶被浪推得大致順著海岸線躺著（不是往四面張開，不然像一隻趴著的小動物），偶爾夾著一顆貝殼；
  // 成群、間距不規則（原本每 0.55 單位一組十字交叉的細板，看起來像一排模型飛機）。放進遠景那組（不投影、不多一次繪製）；LOW 只靠地表材質那條線
  function wrack(kF) {
    if (LOW) return; const r = seeded(733), KC = ['#4f5a2b', '#5a5f2c', '#46552c'], LC = ['#6d6a34', '#5c6a30', '#7a6a38', '#4f5e2c'];
    for (let bz = -106, n = 0; bz <= 106; bz += 2.6 + r() * 3.4, n++) {
      if (vnoise(bz * .08, 3.3, 401) < .45) continue; // 一段一段：中間留下長長的乾淨沙灘
      let bx = 150; for (; bx > 112; bx -= .2) if (H(bx * K, bz * K) > WATER_Y + .3) break; if (bx <= 112) continue;
      for (let i = 0, m = 1 + Math.floor(r() * 2.6); i < m; i++) {
        const x = (bx - .4 - r() * 1.1) * K, z = (bz + (r() - .5) * 2.4) * K, y = H(x, z);
        if (y > WATER_Y + 1.1 || H(x - 1.5, z) > y + 1.2 || nookWet(x, z) || inScene(x / K, z / K) || [[LM_POS.light, 8.5], [nw('boat'), 4.5], [nw('arch'), 5], [nw('tide'), 8]].some(([p, rr]) => Math.hypot(x - p[0], z - p[1]) < rr * K)) continue; // 崖腳、潮池、場景、燈塔的岩島、小船與岩拱旁不放
        const s = .75 + r() * .6, base = onGround(x, z, (r() - .5) * .5, 1, -.02); // 長軸大致順著海岸線（z 方向）
        [[0, 0, 1], [(r() - .5) * .2, (r() - .5) * .3, .65]].forEach(([ox, oz, k], j) => kF.add(FM, jit(new THREE.IcosahedronGeometry(1, 0), .5, 1500 + n * 3 + i + j * 7), KC[(n + i + j) % 3], base.clone().multiply(M4(ox * s, 0, oz * s, 0, j * 1.3, 0, .24 * s * k, .05 * s * k, .36 * s * k)))); // 兩團糾在一起的海藻
        for (let k = 0; k < 6; k++) { const a = (r() - .5) * .5 + (k % 2) * Math.PI, l = (.22 + r() * .2) * s, o = (k - 2.5) * .045 * s; kF.add(FM, new THREE.CircleGeometry(1, 6), LC[(k + i) % 4], base.clone().multiply(new THREE.Matrix4().compose(V(o + Math.sin(a) * l * .35, .028 + k * .003, Math.cos(a) * l * .35), new THREE.Quaternion().setFromEuler(new THREE.Euler(-Math.PI / 2, a, 0, 'YXZ')), V((.025 + r() * .012) * s, l, 1)))); } // 細細的葉帶：大致平行、從那一團裡伸出來一點（不交叉成十字，不然像翅膀）
        if (r() < .35) kF.add(FM, new THREE.SphereGeometry(.06, 6, 2, 0, PI2, 0, Math.PI / 2), ['#fbe3d0', '#f9c4d2', '#fed7aa'][i % 3], base.clone().multiply(M4(.22 * s, .005, -.1 * s, 0, 1, 0, 1, .55, 1.3)));
      }
    }
  }
  // 草叢：沙丘上是偏黃的海灘草，海角台地上是綠一點的草（buildProps 的草只長在 9.6 公尺以下，台地頂上原本光禿禿的）
  function tufts() {
    const r = seeded(811), fG = LOW ? [32, 50] : [52, 78], sand = [], north = [], t0 = new THREE.Color(1.15, 1.08, .7), t1 = new THREE.Color(1.3, 1.15, .62), g0 = new THREE.Color(1, 1, 1), g1 = new THREE.Color(1.1, 1.06, .78);
    for (let i = 0; i < (LOW ? 900 : 2400); i++) {
      const bx = 92 + r() * 42, bz = 46 + r() * 62, s = eff(bx, bz); if (!s || s.d < .3) continue;
      if (vnoise(bx * .32, bz * .32, 812) < .42 || r() > smooth(.3, 1.4, s.d) || inScene(bx, bz)) continue; // 一叢一叢；越高的沙丘越密
      const x = bx * K, z = bz * K, y = H(x, z); if (y < .05) continue;
      sand.push({ x, y: y - .03, z, s: .7 + r() * .7, ry: r() * 6.28, rx: (r() - .5) * .25, c: t0.clone().lerp(t1, r()) });
    }
    for (let i = 0; i < (LOW ? 0 : 30); i++) { const a = r() * PI2, d = 3.6 + r() * 3.5, bx = DRIFT[0] + Math.cos(a) * d, bz = DRIFT[1] + Math.sin(a) * d * .7, x = bx * K, z = bz * K; if (vnoise(bx * .6, bz * .6, 814) < .4) continue; north.push({ x, y: H(x, z) - .03, z, s: 1.1 + r() * .5, sy: 1.5, ry: r() * 6.28, rx: (r() - .5) * .25, c: t0.clone().lerp(t1, r()) }); } // 漂流木堆旁邊一叢叢的海灘草
    for (let i = 0; i < (LOW ? 0 : 420); i++) { // 小湖南邊那片開闊的沙灘：零零星星幾群海灘草
      const bx = 97 + r() * 28, bz = -58 + r() * 36, x = bx * K, z = bz * K; if (vnoise(bx * .22, bz * .22, 815) < .62 || r() > .5 || inScene(bx, bz) || polyD(bx, bz, TRAIL) < 2) continue;
      const y = H(x, z); if (y < WATER_Y + .25 || Math.hypot(bx - LG.x, bz - LG.z) < lagR(Math.atan2(bz - LG.z, bx - LG.x)) + 1.5) continue;
      north.push({ x, y: y - .03, z, s: 1 + r() * .5, sy: 1.5, ry: r() * 6.28, rx: (r() - .5) * .25, c: t0.clone().lerp(t1, r()) });
    }
    for (let i = 0; i < (LOW ? 1300 : 3400); i++) {
      const bx = 106 + r() * 34, bz = -118 + r() * 40, s = eff(bx, bz); if (!s || s.f < .55 || vnoise(bx * .28, bz * .28, 813) < .36 || inScene(bx, bz)) continue;
      const x = bx * K, z = bz * K, y = H(x, z); if (Math.abs(H(x + .8, z) - H(x - .8, z)) + Math.abs(H(x, z + .8) - H(x, z - .8)) > .7) continue; // 崖面上不長
      north.push({ x, y: y - .02, z, s: .75 + r() * .6, ry: r() * 6.28, rx: (r() - .5) * .3, c: g0.clone().lerp(g1, r()) });
    }
    // 南段沙丘照區塊分組；北段（海角台地的草、小湖南邊與漂流木旁的海灘草）用同一種草叢、拉高一點當海灘草，整片一組（原本分成三組、在海角上常常同時畫兩三次）
    const gm = windMat(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: .85, side: THREE.DoubleSide }), .42, true, fG), far = fG[1] + 2;
    scatter(tuftGeo(7, .9, 5), gm, sand, false, { cell: 130, far }); scatter(tuftGeo(5, .5, 3), gm, north, false, { cell: 1e4, far });
  }
  // 地表材質的兩處修補（找不到原本那一行就什麼都不做）：
  // 1. 火山裂縫用的是 GLSL 版的生態區權重（tBiome），少了 biomeW0 的對角分隔：海岸北段（z < −60）被當成一半火山，夜裡沙灘與海角的草坡上會亮起一條條岩漿裂縫。
  //    只在海岸範圍裡把裂縫關掉：在原本那一行後面多乘一個遮罩
  // 2. 海角的崖面：岩層一定畫得出來（原本有些地方的岩層強度只有三成，近看只剩一片糊糊的直條紋），每一層是玫瑰色沙岩、奶油色、偶爾一層赭紅，
  //    層頂積的是一撮撮綠草（不是沙）；後面的分隔山脈照舊是土黃色，海角從海上看才分得出來
  function coastTerrainPatch() {
    const m = W.terrain && W.terrain[0] && W.terrain[0].material, k = K.toFixed(2);
    if (!m || !m.onBeforeCompile || m.userData.coastPatch) return; m.userData.coastPatch = true; const prev = m.onBeforeCompile;
    const LAVA = 'float vk = tB.z * soil * smoothstep(0.45, 0.68, tN(wp * 0.06 + 11.0));', BAND = 'vec3 band = mix(mix(mix(bA, bB, step(0.5, bh0)), bC, step(0.84, bh0)), mix(mix(bA, bB, step(0.5, bh)), bC, step(0.84, bh)), smoothstep(0.0, 0.14, lyf));';
    const COV = 'vec3 covC = tB.x * vec3(0.09, 0.23, 0.055) + tB.y * vec3(0.62, 0.45, 0.22) + tB.z * vec3(0.11, 0.09, 0.08) + tB.w * vec3(0.9, 0.93, 0.98);';
    const STK = 'float tStk = smoothstep(0.6, 0.8, tN(vec2(ru * 1.3, lyi * 7.13))) * smoothstep(0.1, 0.9, lyf);';
    m.onBeforeCompile = (sh, r) => {
      prev.call(m, sh, r); let f = sh.fragmentShader;
      if (f.includes(LAVA)) f = f.replace(LAVA, LAVA + `\n        { vec2 cq = wp / ${k}; vk *= 1.0 - smoothstep(56.0, 64.0, cq.x) * smoothstep(-2.0, 6.0, cq.x - abs(cq.y) - 10.0); } // 海岸沒有岩漿裂縫（region-coast.js）`);
      if (f.includes(BAND) && f.includes(COV) && f.includes(STK)) f = f.replace(BAND, BAND + `\n          vec2 hq = wp / ${k}; float cHk = smoothstep(100.0, 110.0, hq.x) * (1.0 - smoothstep(-81.0, -77.0, hq.y)) * smoothstep(5.0, 10.0, hq.x - abs(hq.y) - 12.0) * (1.0 - smoothstep(15.5, 19.0, vWP.y)); // 海角（region-coast.js；比台地頂高的地方是後面的山，不算）
          if (cHk > 0.0) { vec3 cA = vec3(1.0), cB = vec3(1.06, 1.42, 1.58), cC = vec3(0.88, 0.7, 0.64);
            band = mix(band, mix(mix(mix(cA, cB, step(0.55, bh0)), cC, step(0.86, bh0)), mix(mix(cA, cB, step(0.55, bh)), cC, step(0.86, bh)), smoothstep(0.0, 0.1, lyf)), cHk); strK = mix(strK, 1.0, cHk); }`)
        .replace(STK, STK + ' tStk *= 1.0 - 0.8 * cHk;').replace(COV, COV + ' covC = mix(covC, vec3(0.14, 0.32, 0.08), cHk); tCov *= mix(1.0, 0.6 * smoothstep(0.86, 0.93, lyf), cHk);'); // 海角：往下流的水痕淡掉（近看才不會是一條條直的色帶），層頂的草只長成細細一條
      sh.fragmentShader = f;
    };
  }
  function ribbon() {
    // 沿著海岸線（每個 z 從海上往陸地找第一個高過水面的點）一條寬約 3.5 公尺的帶子；白天不畫，夜裡浪花一陣一陣發藍光
    const pts = []; for (let bz = -114; bz <= 114; bz += 1.25) { let bx = 168; for (; bx > 100; bx -= .25) if (H(bx * K, bz * K) > WATER_Y) break; if (bx > 100) pts.push([bx * K, bz * K]); }
    for (let k = 0; k < 2; k++) for (let i = 1; i < pts.length - 1; i++) pts[i][0] = pts[i][0] * .5 + (pts[i - 1][0] + pts[i + 1][0]) * .25; // 抹平：崖腳與沙灘之間不要鋸齒
    const n = pts.length, pos = new Float32Array(n * 6), uv = new Float32Array(n * 4), idx = []; let acc = 0;
    for (let i = 0; i < n; i++) {
      const [x, z] = pts[i]; if (i) acc += Math.hypot(x - pts[i - 1][0], z - pts[i - 1][1]);
      const a = pts[Math.max(0, i - 1)], b = pts[Math.min(n - 1, i + 1)], tx = b[0] - a[0], tz = b[1] - a[1], tl = Math.hypot(tx, tz) || 1; let nx = tz / tl, nz = -tx / tl; if (nx < 0) { nx = -nx; nz = -nz; }
      const y = WATER_Y + .16; pos.set([x - nx * .7, y, z - nz * .7, x + nx * 3, y, z + nz * 3], i * 6); uv.set([acc, 0, acc, 1], i * 4);
      if (i) { const o = (i - 1) * 2; idx.push(o, o + 2, o + 1, o + 1, o + 2, o + 3); }
    }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('uv', new THREE.BufferAttribute(uv, 2)); g.setIndex(idx);
    const m = new THREE.Mesh(g, new THREE.ShaderMaterial({ uniforms: { uT: W.wind, uN: { value: 0 } }, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
      vertexShader: 'varying vec2 vU; varying float vD; void main(){ vU = uv; vec4 mv = modelViewMatrix * vec4(position, 1.0); vD = -mv.z; gl_Position = projectionMatrix * mv; }',
      fragmentShader: `uniform float uT; uniform float uN; varying vec2 vU; varying float vD;
        float h1(float n){ return fract(sin(n) * 43758.5453); }
        void main(){
          float u = vU.x, v = vU.y;
          float wv = pow(0.5 + 0.5 * sin(v * 6.0 - uT * 1.1 + sin(u * 0.05) * 3.0 + sin(u * 0.013 + uT * 0.2) * 4.0), 3.0);
          // 泡沫的光點：一格一顆、邊緣柔和的圓點，慢慢亮起又暗下（原本是整格一下亮一下滅，看起來像一塊塊青色的方形貼紙）；遠處的光點小於一個像素會閃爍，淡掉
          vec2 sq = vec2(u * 1.5, v * 6.0), sc = floor(sq); float sh = h1(sc.x + sc.y * 57.0); vec2 sf = fract(sq) - 0.5 - (vec2(fract(sh * 13.1), fract(sh * 5.7)) - 0.5) * 0.35;
          float sp = step(0.86, fract(sh * 7.3)) * pow(max(0.0, sin(uT * (0.7 + sh) + sh * 40.0)), 4.0) * (1.0 - smoothstep(0.08, 0.3, length(sf))) * (1.0 - smoothstep(25.0, 60.0, vD));
          float a = smoothstep(0.0, 0.25, v) * (1.0 - smoothstep(0.5, 1.0, v)) * uN * (0.55 + 0.45 * sin(u * 0.09 + uT * 0.35)) * (1.0 - smoothstep(90.0, 170.0, vD));
          gl_FragColor = vec4((vec3(0.3, 0.85, 1.0) * (wv * 0.7 + 0.04) + vec3(0.55, 0.92, 1.0) * sp * 0.8) * a, 1.0);
        }` }));
    m.frustumCulled = false; m.visible = false; m.renderOrder = 2; W.scene.add(m); DYN.rib = m;
  }
  function birds() {
    // 繞著海蝕柱飛的海鳥（和 buildFauna 的海鷗同一種翅膀），離遠了就不畫
    if (LOW) return; const n = 6, im = new THREE.InstancedMesh(wingGeo(.62, .4, '#f8fafc', '#94a3b8'), flapMat(5, .55), n); im.frustumCulled = false; im.instanceMatrix.setUsage(THREE.DynamicDrawUsage); im.visible = false; W.scene.add(im); DYN.birds = im;
  }

  /* ---------- 望遠鏡：鏡頭轉向望遠鏡對著的那根海蝕柱、拉近視野；對準鳥窩就算找到 ----------
     湊上去看的時候：近裁面推到鏡筒前面（望遠鏡自己的鏡筒與手不會擋在畫面下半）、畫面四周一圈暗暗的圓形鏡框，像是真的從目鏡看出去 */
  const SC = { on: false, x: 0, z: 0, t: 0, near: .08, yaw: 0, pitch: 0, el: null }, SCOPE_HEAD = new THREE.Vector3();
  function scopeVig(on) {
    let el = SC.el;
    if (!el) { const cv = document.getElementById('worldCv'); if (!cv || !cv.parentNode) return; el = SC.el = document.createElement('div'); el.setAttribute('aria-hidden', 'true'); el.style.cssText = 'position:absolute;inset:0;pointer-events:none;opacity:0;transition:opacity .45s ease;background:radial-gradient(circle at 50% 50%,rgba(6,18,24,0) 0,rgba(6,18,24,0) 33vmin,rgba(6,18,24,.5) 42vmin,rgba(6,18,24,.92) 52vmin)'; cv.parentNode.insertBefore(el, cv.nextSibling); void el.offsetWidth; } // 先排版一次，第一次打開也會淡入
    el.style.opacity = on ? '1' : '0';
  }
  function scopeOn() {
    const cp = W.cam.position; Object.assign(SC, { on: true, x: P.x, z: P.z, t: 0, near: W.cam.near, yaw: Math.atan2(-(NESTP.x - cp.x), -(NESTP.z - cp.z)), pitch: Math.atan2(NESTP.y - cp.y, Math.hypot(NESTP.x - cp.x, NESTP.z - cp.z)) });
    W.fov0 = 26; W.cam.near = clamp(cp.distanceTo(SCOPE_HEAD) + .45, .08, 2.6); W.cam.updateProjectionMatrix(); scopeVig(true);
  }
  function scopeOff() { if (!SC.on) return; SC.on = false; W.fov0 = innerWidth / innerHeight < 1 ? 80 : 72; W.cam.near = SC.near; W.cam.updateProjectionMatrix(); scopeVig(false); } // 和 resizeWorld 一樣的預設視角
  function scopeStep(dt) {
    if (!SC.on) return; SC.t += dt;
    if (Math.hypot(P.x - SC.x, P.z - SC.z) > .35 || GUI.kind || SC.t > 40) return scopeOff(); // 一走動、打開介面就放下望遠鏡
    if (SC.t < 1) { const k = Math.min(1, dt * 5); P.yaw += wrapA(SC.yaw - P.yaw) * k; P.pitch += (SC.pitch - P.pitch) * k; } // 先轉向望遠鏡對著的地方，之後可以自己轉頭看
    W.cam.getWorldDirection(tv); tv2.copy(NESTP).sub(W.cam.position).normalize();
    if (SC.t > .8 && tv.dot(tv2) > Math.cos(.06)) eggHit('coast_nest', '海蝕柱頂端的鳥窩裡有三顆淡藍色的蛋，海鳥媽媽正在打盹。');
  }

  /* ---------- 建置 ---------- */
  regionBuild(() => {
    M = nookMats(); FM = M.flat.clone(); FM.userData = { shadow: false };
    // 夜裡發光的小東西（海葵、炭火、海玻璃、航標燈、浮球）都很小：不投影、整條海岸合成一個網格（原本北中南各一組、各自還多一次陰影繪製）
    if (LOW) NM = M.flat; else { NM = M.night.clone(); NM.onBeforeCompile = M.night.onBeforeCompile; NM.customProgramCacheKey = M.night.customProgramCacheKey; NM.userData = { smooth: true, shadow: false }; }
    regEgg('coast_nest', '海蝕柱上的鳥窩', '北邊海角的觀景台有一座望遠鏡，往外海看看。');
    regEgg('coast_glow', '會發光的小湖', '夜裡到海角腳下的小湖踩踩水。');
    regEgg('coast_swing', '沙丘上的吊椅', '南邊沙丘頂上有一張吊椅，坐上去晃一晃吧。');
    regEgg('coast_prints', '沙上的小腳印', '南邊沙灘上有一串圓圓的小腳印，跟著走走看。');
    regEgg('coast_chime', '漂流木上的風鈴', '小湖南邊的沙灘上有一棵連根被沖上岸的大樹，根上好像掛著什麼。');
    recolor();
    const rd = seeded(4242), kF = nookKit(), kN = nookKit(), kM = nookKit(), kS = nookKit(); kG = LOW ? null : nookKit();
    stacks(kF, kN, rd); reef(kF, kN, rd); lookout(kN, rd); signs(kN); lagoonScene(kN, rd);
    fireScene(kM, rd); knollScene(kM, rd); piles(kF, kM, rd); lightPoint(kF, kM, rd); driftScene(kM, rd); duneScene(kS, rd); wrack(kF);
    kF.done(330); kN.done(LOW ? 72 : 100); kM.done(LOW ? 78 : 110); kS.done(LOW ? 78 : 115); if (kG) kG.done(330); // LOW 的霧從 70 公尺就開始：小東西在那之外本來就看不清楚
    tufts(); ribbon(); birds(); coastTerrainPatch();
  });

  /* ---------- 每格更新（離太遠直接跳過） ---------- */
  regionStep((dt, t) => {
    if (!M || !P) return;
    const city = inCity(), px = P.x / K, pz = P.z / K, on = !city && px > 50, nite = DN.night + (DN.dusk + DN.dawn) * .25;
    if (DYN.rib) { DYN.rib.visible = on && nite > .03; if (DYN.rib.visible) DYN.rib.material.uniforms.uN.value = Math.min(1, nite); }
    if (!on) { if (DYN.birds) DYN.birds.visible = false; if (DYN.fire) DYN.fire.visible = false; scopeOff(); return; }
    scopeStep(dt);
    // 小湖：夜光藻、涉水、水鳥
    const ld = Math.hypot(px - LG.x, pz - LG.z);
    if (DYN.lagU) DYN.lagU.uNight.value = DN.night;
    if (DYN.lagU && ld < 60) {
      const u = DYN.lagU;
      const wet = ld < lagR(Math.atan2(pz - LG.z, px - LG.x)) && H(P.x, P.z) < LG.w * K - .05 ? 1 : 0, mv = Math.hypot(P.vx || 0, P.vz || 0) > .6 ? 1 : .35;
      u.uP.value.x = P.x; u.uP.value.y = P.z; u.uP.value.z += (wet * mv - u.uP.value.z) * Math.min(1, dt * 3);
      if (wet && mv > .9 && DN.night > .55) { DYN.wade = (DYN.wade || 0) + dt; if (DYN.wade > 1.6) eggHit('coast_glow', '每踩一步，湖水就亮起一圈藍藍的光點。'); }
      if (DYN.fl && ld < 44) { // 水鳥：偶爾低頭理羽毛、平常輕輕晃
        DYN.fls.forEach((f, i) => { const c = (t + f.ph) % 9, dip = c < 1.6 ? Math.sin(c / 1.6 * Math.PI) * .75 : 0; te.set(dip + Math.sin(t * .8 + f.ph) * .04, f.ry + Math.sin(t * .23 + i) * .3, Math.sin(t * .6 + f.ph) * .03, 'YXZ'); tq.setFromEuler(te); tm.compose(tv.set(f.x, f.y, f.z), tq, ts); DYN.fl.setMatrixAt(i, tm); });
        DYN.fl.instanceMatrix.needsUpdate = true;
      }
    }
    // 海鳥
    if (DYN.birds) { const b = DYN.birds, d = Math.hypot(px - 145, pz + 92); b.visible = d < 110; if (b.visible) { for (let i = 0; i < b.count; i++) { const a = t * (.16 + (i % 3) * .04) * (i % 2 ? 1 : -1) + i * 2.3, r = 9 + (i % 3) * 5, cx = (144 + (i % 2) * 3) * K, cz = (-97 + (i % 3) * 4) * K, y = WATER_Y + 15 + (i % 3) * 3.5 + Math.sin(t * .6 + i) * 1.5; te.set(0, (i % 2 ? -a : -a + Math.PI), .35 * (i % 2 ? 1 : -1), 'XYZ'); tq.setFromEuler(te); tm.compose(tv.set(cx + Math.cos(a) * r, y, cz + Math.sin(a) * r), tq, ts); b.setMatrixAt(i, tm); } b.instanceMatrix.needsUpdate = true; } }
    // 營火：黃昏與夜裡才點著
    if (DYN.fire) { const f = DYN.fire, d = Math.hypot(px - FIRE[0], pz - FIRE[1]); f.visible = d < 55 && DN.night + DN.dusk * .7 > .3; if (f.visible) { f.scale.set(1 + Math.sin(t * 13) * .07, .9 + Math.sin(t * 9.3) * .13 + Math.sin(t * 23) * .05, 1 + Math.cos(t * 11) * .07); f.rotation.y = t * .8; } }
    // 吊椅：平常被海風吹得輕輕晃，坐上去之後晃得很高、慢慢停下來
    if (DYN.sw) { const [sx, sz] = swingAt(); if (Math.hypot(px - sx, pz - sz) < 40) { DYN.swA *= Math.exp(-dt * .35); DYN.sw.rotation.x = Math.sin(t * 1.9) * (DYN.swA + .04) + Math.sin(t * .7) * .015; } }
    // 吊床
    if (DYN.ham && Math.hypot(px - KN[0], pz - KN[1]) < 40) DYN.ham.rotation.x = Math.sin(t * 1.05) * .06 + Math.sin(t * 2.3) * .015;
    // 沙窩裡的小史萊姆
    if (Math.hypot(px - NEST[0], pz - NEST[1]) < 1.7) eggHit('coast_prints', '跟著小腳印走到底，原來是一隻抱著貝殼睡著的小史萊姆。');
  });

  /* ============================================================
     9.1「30 秒一個地點」補點（只新增、不動上面的場景）
     用走路速度實際走過小徑與常走的路線（海蝕洞出口 → 燈塔、海角觀景台、南邊沙丘、海岸南端…），記下每個地點出現的時間：
     - 從南邊的沙丘（吊椅、小腳印、沙窩）往回走向棕櫚林小丘，沿著靠山那一側的沙丘後面有 20 幾秒、到海岸南端那一段超過 30 秒沒有新東西。
       在靠山那一排沙丘的背風處補一個小地點：有人堆到一半的沙堡（四座小塔、護城河、貝殼裝飾、插在頂上的小紅旗），旁邊倒扣著粉紅色的小桶、插著一把小鏟子，
       還有一支插在沙裡、被海風吹得一直轉的彩色風車（從沙丘頂上遠遠就看得到它在轉）
     - 從洞口往北、沿著小湖西邊走上海角台地的北半邊，過了小湖之後有將近 30 秒（近距離算 40 幾秒）沒有新東西。
       在台地頂的北邊補一個放風箏的地方：草地上插著一根木樁、繞著線的線軸、一條摺好的格子野餐墊，一只彩色的菱形風箏被風吹得高高的、
       拖著一串蝴蝶結尾巴在海崖外輕輕晃（風箏在木樁往海那一側：走上台地時一直在正前方，走到木樁旁邊也不用抬頭）；
       上台地之前貼著山壁的那段草坡（從小湖走到觀景台牌子之間）只有草和岩壁：山壁腳下補一塊突出來的岩台，上面站著一隻小山羊，你走過去時牠會轉頭看你
     效能：每個地點不動的零件一個網格、會動的（風車葉片、風箏連線、山羊的頭）一個網格（離開 60～150 公尺就不動），各兩次繪製；不投影、不加光源；LOW 照樣有。
     風箏用既有的夜光材質（nookMats().night）：夜裡在台地上空還看得到一只微微發亮的風箏
     ============================================================ */
  const CASTLE = { x: 96.5, z: 75.5, wheel: null, a: 0 }, KITE = { x: 130.5, z: -106.5, m: null }, GOAT = { x: 100.3, z: -85.1, head: null, face: 0, yaw: 0 }; // GOAT：山壁腳下（基礎座標），岩台再往山壁裡面一點
  // 在中央平地（山脊圍住的那塊）時，這些東西都被山脊擋住、一個像素也看不到，但 cullChunks 只看距離：直接當成超出距離（同火山的 V.hid）
  const paceHide = list => { const c = W.cam && W.cam.position; if (!c) return; const h = Math.max(Math.abs(c.x), Math.abs(c.z)) < 44 * K && c.y < 20 && !(typeof CV !== 'undefined' && CV.c);
    if (h !== list.h) { list.h = h; list.forEach(o => { o.userData.far = h ? -1 : o.userData.far0; }); } };
  const PACE = [];
  regionBuild(() => {
    const c00 = W.chunks.length, kt = nookKit(), rd = seeded(9201), x0 = CASTLE.x * K, z0 = CASTLE.z * K, y0 = H(x0, z0) - .02, face = Math.atan2(64.6 - CASTLE.x, 2.4 - CASTLE.z) + .5; // 城門大概朝著從洞口過來的方向
    const a = kt.at(x0, z0, 0, face, y0, 1.25), SA = ['#d4b47c', '#cba873', '#dcbf8a', '#c59f68']; // 整座放大 1.25 倍（玩具尺寸太小，遠看只是一團沙）；沙堡是用濕沙堆的，比四周的乾沙深一階才分得出來
    // 沙堡蓋在沙丘背風的斜坡上（直徑 4 公尺內高低差將近半公尺）：只有沙堡本體（底座以上）用同一個高度，旁邊的零件各自貼著自己腳下的沙
    // （原本全部共用一個高度：粉紅小桶、桶形小塔與護城河整個埋進沙裡、浴巾和草帽在下坡那側浮起來 15 公分）
    const B = M4(x0, y0, z0, 0, face, 0, 1.25), tv = new THREE.Vector3(), gy = (px, pz, r = 0) => { tv.set(px, 0, pz).applyMatrix4(B); return ((r ? lowAt(tv.x, tv.z, r * 1.25) : H(tv.x, tv.z)) - y0) / 1.25; }; // 本地 (px, pz) 腳下的沙換回本地單位，加在 a() 的 py 上（r：取周圍最低的地方，放在斜坡上不懸空）
    const drape = (geo, col, px, py, pz, rx = 0, ry = 0, rz = 0, sx = 1, sy = sx, sz = sx, skirt) => { // 攤在沙上的東西（護城河、浴巾、帽沿、淺坑）：每個頂點各自貼著地形，py＝離沙面多高；skirt：只把本地 y 低於它的頂點（底座的下緣）壓進沙裡
      const g = geo.index ? geo.toNonIndexed() : geo, p = g.attributes.position, lo = skirt == null ? null : Array.from({ length: p.count }, (_, i) => p.getY(i) < skirt);
      g.applyMatrix4(B.clone().multiply(M4(px, py, pz, rx, ry, rz, sx, sy, sz)));
      for (let i = 0; i < p.count; i++) { const h = H(p.getX(i), p.getZ(i)); if (!lo) p.setY(i, p.getY(i) - y0 + h); else if (lo[i]) p.setY(i, h - .06); }
      kt.add(FM, g, col, null); };
    drape(new THREE.CylinderGeometry(1.15, 1.4, .34, 14), '#d8bb85', 0, .1, 0, 0, 0, 0, 1, 1, 1, 0); // 沙堆起來的底座：頂面是平的、下緣順著斜坡埋進沙裡（上坡那側也還露出十幾公分）
    drape(new THREE.RingGeometry(1.36, 1.72, 28, 1).rotateX(-Math.PI / 2), '#bd9d6a', 0, .02, 0); // 一圈挖出來的護城河（濕濕的深色沙，貼著斜坡）
    { const mo = new THREE.TorusGeometry(1.82, .1, 4, 28); mo.rotateX(Math.PI / 2); drape(mo, '#d8bb85', 0, .01, 0, 0, 0, 0, 1, 1, .5); } // 挖出來的沙堆在河外側，一道矮矮的沙埂
    a(FM, new THREE.CylinderGeometry(.46, .52, .62, 8), SA[0], 0, .58, 0); a(FM, new THREE.BoxGeometry(.24, .32, .06), '#a8916a', 0, .42, .5); // 主塔與城門
    for (let k = 0; k < 8; k += 2) a(FM, new THREE.BoxGeometry(.14, .13, .12), SA[1], Math.cos(k / 8 * PI2) * .41, .95, Math.sin(k / 8 * PI2) * .41, 0, -k / 8 * PI2, 0); // 塔頂的城垛
    [[.85, .85], [-.85, .85], [.85, -.85], [-.85, -.85]].forEach(([x, z], i) => { const h = .45 + (i % 2) * .12; a(FM, new THREE.CylinderGeometry(.2, .24, h, 7), SA[(i + 2) % 4], x * .8, .18 + h / 2, z * .8); if (i !== 3) a(FM, new THREE.ConeGeometry(.26, .32, 7), SA[3], x * .8, .2 + h + .14, z * .8); }); // 四座小塔（最後一座還沒堆好頂）
    a(FM, new THREE.BoxGeometry(1.1, .2, .2), SA[2], 0, .3, .62, 0, 0, 0); // 城門前的矮牆
    for (let k = 0; k < 10; k++) { const t = k / 10 * PI2 + .2; a(FM, new THREE.SphereGeometry(.06, 6, 3, 0, PI2, 0, Math.PI / 2), ['#fbcfe8', '#fde7d6', '#fed7aa', '#e0f2fe'][k % 4], Math.cos(t) * 1.2, .26, Math.sin(t) * 1.2, -Math.PI / 2 + .3, t, 0, 1, 1, .5); } // 底座邊上一圈貝殼
    kt.seg(FM, new THREE.Vector3(x0, y0 + 1.1, z0), new THREE.Vector3(x0, y0 + 1.95, z0), .015, '#f8fafc', 4); kt.add(FM, new THREE.ConeGeometry(.19, .46, 3), '#ef4444', M4(x0 + .21, y0 + 1.8, z0, 0, 0, -Math.PI / 2, 1, 1, .2)); // 頂上的小紅旗
    // 倒扣的粉紅色小桶（旁邊還有一座剛倒出來的桶形小塔）、插在沙裡的黃色小鏟子：各自坐在自己腳下的沙上，略略壓進去一點
    { const bx = 1.75, bz = -.35, g = gy(bx, bz, .14) - .03, g2 = gy(bx - .1, bz + .55, .14) - .03; a(FM, new THREE.CylinderGeometry(.17, .22, .32, 10), '#f472b6', bx, .16 + g, bz); a(FM, new THREE.CylinderGeometry(.23, .23, .04, 10), '#ec4899', bx, .02 + g, bz); a(FM, new THREE.TorusGeometry(.19, .012, 4, 10, Math.PI), '#fdf2f8', bx, .2 + g, bz, 0, .4, Math.PI);
      a(FM, new THREE.CylinderGeometry(.17, .22, .3, 10), SA[1], bx - .1, .14 + g2, bz + .55); }
    { const sx = -1.6, sz = .6, g = gy(sx, sz - .05) - .04; a(FM, new THREE.BoxGeometry(.2, .03, .24), '#facc15', sx, .12 + g, sz, -.9, .3, 0); a(FM, new THREE.CylinderGeometry(.02, .02, .5, 5), '#fde68a', sx, .38 + g, sz - .1, -.6, .3, 0); }
    drape(new THREE.CircleGeometry(.55, 10), '#c9ad7c', -1.2, .02, -1.1, -Math.PI / 2, 0, 0, 1, .7, 1); // 挖沙挖出來的一個淺坑
    // 攤在旁邊的藍白條紋浴巾（每條沿長邊分 5 段，順著斜坡攤平）、上面一頂繫著粉紅緞帶的草帽（帽沿也貼著浴巾）；堆沙堡的人去海邊玩水了
    { const tx = -1.9, tz = -1.6, c = Math.cos(.35), s = Math.sin(.35); for (let k = 0; k < 6; k++) { const o = (k - 2.5) * .24; drape(new THREE.BoxGeometry(.24, .02, 1.3, 1, 1, 5), k % 2 ? '#f8fafc' : '#38bdf8', tx + c * o, .025, tz - s * o, 0, .35, 0); }
      const hx = tx + .1, hz = tz - .25, g = gy(hx, hz); drape(new THREE.CylinderGeometry(.3, .32, .03, 12), '#f5d08a', hx, .055, hz); a(FM, new THREE.SphereGeometry(.15, 10, 5, 0, PI2, 0, Math.PI / 2), '#eec170', hx, .065 + g, hz); a(FM, new THREE.CylinderGeometry(.152, .152, .045, 12), '#f472b6', hx, .09 + g, hz);
      // 插在浴巾邊上的粉紅白條紋海灘傘（沙堡本身是沙色、遠看認不出來；一把彩色的傘從沙丘頂上、靠山那條路上遠遠就看得到）
      const ux = tx - .75, uz = tz + .55, ug = gy(ux, uz) - .12; a(FM, new THREE.CylinderGeometry(.025, .025, 1.95, 5), '#f8fafc', ux, ug + .97, uz, .1, 0, -.12);
      for (let k = 0; k < 8; k++) a(FM, new THREE.ConeGeometry(1.05, .38, 2, 1, false, k / 8 * PI2, PI2 / 8), k % 2 ? '#fdf2f8' : '#f472b6', ux + .13, ug + 2.03, uz + .11, .1, 0, -.12); // 傘面順著傘柱的斜度
      a(FM, new THREE.SphereGeometry(.05, 6, 4), '#f472b6', ux + .15, ug + 2.22, uz + .13); addCol({ x: tv.set(ux, 0, uz).applyMatrix4(B).x, z: tv.z, r: .12 }); }
    addCol({ x: x0, z: z0, r: 1.7 });
    // 風車：細細的白棍子插在沙裡，四片葉子對著海（東邊）吹來的風
    const wx = x0 + Math.sin(face + 1.9) * 2.6, wz = z0 + Math.cos(face + 1.9) * 2.6, wy = lowAt(wx, wz, .2);
    kt.add(FM, new THREE.CylinderGeometry(.02, .026, 1.65, 5), '#f8fafc', M4(wx, wy + .74, wz)); kt.add(FM, new THREE.SphereGeometry(.05, 6, 4), '#facc15', M4(wx + .06, wy + 1.52, wz)); addCol({ x: wx, z: wz, r: .12 });
    kt.done(LOW ? 80 : 110);
    const bl = ['#f9a8d4', '#7dd3fc', '#fde68a', '#86efac'], parts = [];
    for (let k = 0; k < 4; k++) { const t = new THREE.BufferGeometry(); t.setAttribute('position', new THREE.Float32BufferAttribute([0, 0, 0, 0, .03, .4, 0, .31, .31, 0, 0, 0, 0, .31, .31, 0, .03, .4], 3)); parts.push([t, bl[k], M4(0, 0, 0, k / 4 * PI2, 0, 0)]); } // 一片葉子正反兩面（三角形）；葉子 40 公分（原本 26 公分，從路上遠遠看只是一個小點）
    const wm = new THREE.Mesh(nookMerge(parts), FM); wm.position.set(wx + .08, wy + 1.52, wz); wm.castShadow = false; chunkObj(wm, 70, false, [wx, wz, 1]); CASTLE.wheel = wm;

    // 海角台地北邊放風箏的地方：木樁、線軸、摺好的野餐墊（不動的零件，一個網格）
    { const kx = KITE.x * K, kz = KITE.z * K, ky = lowAt(kx, kz, .5), kk2 = nookKit();
      kk2.add(FM, new THREE.CylinderGeometry(.05, .03, .5, 5), '#8b6544', M4(kx, ky + .18, kz)); kk2.add(FM, new THREE.CylinderGeometry(.1, .1, .14, 10), '#f8fafc', M4(kx + .45, ky + .1, kz + .2, Math.PI / 2, .5, 0)); [-1, 1].forEach(s => kk2.add(FM, new THREE.CylinderGeometry(.15, .15, .025, 10), '#b45309', M4(kx + .45 + s * .07 * Math.cos(.5), ky + .1, kz + .2 - s * .07 * Math.sin(.5), Math.PI / 2, .5, 0)));
      kk2.add(FM, ...stick(V(kx + .45, ky + .12, kz + .2), V(kx, ky + .4, kz), .006, '#f8fafc', 3)); // 線軸到木樁的線
      const bx = kx - 1.3, bz = kz + 1.1, by = lowAt(bx, bz, .6); kk2.add(FM, new THREE.BoxGeometry(1.1, .08, .7), '#f9a8d4', M4(bx, by + .04, bz, 0, .3, 0)); kk2.add(FM, new THREE.BoxGeometry(1.12, .02, .12), '#fdf2f8', M4(bx, by + .09, bz, 0, .3, 0)); kk2.add(FM, new THREE.BoxGeometry(.12, .02, .72), '#fdf2f8', M4(bx, by + .09, bz, 0, .3, 0));
      kk2.add(FM, new THREE.BoxGeometry(.3, .2, .22), '#c08457', M4(bx + .25, by + .18, bz - .1, 0, .6, 0)); kk2.add(FM, new THREE.TorusGeometry(.12, .015, 4, 10, Math.PI), '#8b5e34', M4(bx + .25, by + .28, bz - .1, 0, .6, 0)); // 小籃子
      addCol({ x: kx, z: kz, r: .15 }); kk2.done(LOW ? 90 : 120);
      // 風箏（連同線一起一個網格，原點在木樁：整組繞著木樁輕輕晃，線就一直接在木樁上）。台地上的風順著背後的山壁往海那邊吹，風箏飛在台地東邊的海崖外、海的上空：
      // 從小湖那邊走上台地，風箏一直在正前方的天上（後面是天空和海）；走到木樁旁邊，不用抬頭就看得到風箏和往上拉的那條線
      // （原本飛在木樁上方 17 公尺、偏向陸地那一側：遠遠看是一個小點，真的走到木樁旁邊時剛好在頭頂、超出畫面，只看得到一條細線）
      const KX = 15.5, KY = 11, KZ = -5, kc = ['#f472b6', '#fde047', '#60a5fa', '#34d399'], pp = [];
      const tri = (a, b, c, col) => { const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute([...a, ...b, ...c, ...a, ...c, ...b], 3)); pp.push([g, col]); }; // 正反兩面
      const dl = Math.hypot(KX, KZ), dx = KX / dl, dz = KZ / dl, sx = -dz, sz = dx, KS = 2, at = (u, v, w = 0) => [KX + (sx * u + dx * w) * KS, KY + v * KS, KZ + (sz * u + dz * w) * KS]; // 風箏面：u＝左右、v＝上下、w＝順風（正對著木樁）；放大 2 倍（高 3.5 公尺）：從台地下的草坡看過去才不會只剩一個點；站在木樁旁仰角約 30 度，還在畫面裡
      const top = at(0, .75), bot = at(0, -1), lf = at(-.55, 0), rt = at(.55, 0), mid = at(0, 0, -.12);
      tri(top, lf, mid, kc[0]); tri(top, mid, rt, kc[1]); tri(mid, lf, bot, kc[2]); tri(mid, bot, rt, kc[3]);
      pp.push(stick(V(...top), V(...bot), .018, '#334155', 3), stick(V(...lf), V(...rt), .018, '#334155', 3), stick(V(0, .4, 0), V(...at(0, -.2, -.05)), .012, '#f8fafc', 3)); // 骨架、風箏線
      let p0 = V(...bot); for (let k = 1; k <= 6; k++) { const p1 = V(...at(Math.sin(k * 1.3) * .25, -1 - k * .5, k * .28)); pp.push(stick(p0, p1, .008, '#f8fafc', 3)); if (k % 2 === 0 || k === 5) pp.push([new THREE.BoxGeometry(.05, .24, .32), kc[k % 4], new THREE.Matrix4().makeRotationY(Math.atan2(sx, sz)).multiply(new THREE.Matrix4().makeRotationZ(.3)).setPosition(p1)]); p0 = p1; } // 蝴蝶結尾巴（往下風拖）
      const km = new THREE.Mesh(nookMerge(pp), M.night); km.position.set(kx, ky, kz); km.castShadow = false; chunkObj(km, 160, false, [kx + KX / 2, kz + KZ / 2, 10]); KITE.m = km; } // 夜光漆：天黑以後風箏和線微微亮著（同一個網格，換成既有的夜光材質，不多一次繪製）
    // 上海角那段草坡的山壁腳下：一塊從山壁突出來的岩台（頂上長著草和粉紅色的海石竹），一隻白色小山羊站在上面看著小湖（不動的零件一個網格、頭一個網格）
    { const fx = GOAT.x * K, fz = GOAT.z * K, fy = H(fx, fz), e = .6, gx = H(fx + e, fz) - H(fx - e, fz), gz = H(fx, fz + e) - H(fx, fz - e), gl = Math.hypot(gx, gz) || 1, ux = gx / gl, uz = gz / gl; // u：往山壁上面的方向
      const face = Math.atan2(-ux, -uz), T = fy + 1.05, cx = fx + ux * .7, cz = fz + uz * .7, kg = nookKit(), a = kg.at(cx, cz, 0, face, T), ag = kg.at(cx, cz, 0, face, T, 1.2), RC = ['#c99a72', '#b98a66', '#d6aa82']; GOAT.face = face; // 本地 +z＝面向小湖（下坡）
      a(FM, new THREE.CylinderGeometry(1.35, 1.75, 2.3, 8), RC[0], 0, -1.15, 0, 0, .3, 0, 1, 1, .85); a(FM, new THREE.CylinderGeometry(1.3, 1.35, .07, 8), '#8cbf6a', 0, .02, 0, 0, .3, 0, 1, 1, .85); // 又寬又矮的岩台（離地 1 公尺、後半截埋在山壁裡；窄高的話遠看像一根柱子）與頂上的草皮
      [[1.25, -.55, .55, 9411], [-1.3, -.7, .45, 9412]].forEach(([lx, ly, r, sd]) => a(FM, rk(sd), RC[2], lx, ly, -.2, .2, sd, 0, r, r * .8, r)); // 岩台兩側長出來的大石頭，輪廓才不會是一個圓柱
      const LM = M4(cx, 0, cz, 0, face, 0); [[.9, .75, .42, .2, RC[1]], [-.75, 1.05, .28, .1, RC[2]]].forEach(([lx, lz, r, dy, c], i) => { tv.set(lx, 0, lz).applyMatrix4(LM); kg.add(FM, new THREE.DodecahedronGeometry(r, 0), c, M4(tv.x, H(tv.x, tv.z) + dy, tv.z, .3, .8 + i, 0, 1, .68, 1)); }); // 腳下兩塊墊腳的石頭（山羊是這樣跳上去的），各自坐在自己腳下的地上
      const W2 = '#f7f3ea', LG = '#e9e2d4', gp = (geo, col, x, y, z, rx = 0, ry = 0, rz = 0, sx = 1, sy = sx, sz = sx) => ag(FM, geo, col, x, y + .05, z + .2, rx, ry, rz, sx, sy, sz); // 山羊（放大 1.2 倍，二十幾公尺外也認得出來）站在岩台靠外的那半邊
      gp(new THREE.SphereGeometry(.3, 8, 6), W2, 0, .55, 0, 0, 0, 0, .88, .82, 1.35); gp(new THREE.CylinderGeometry(.1, .13, .34, 6), W2, 0, .77, .32, .55, 0, 0); gp(new THREE.ConeGeometry(.05, .14, 4), W2, 0, .71, -.42, -.9, 0, 0); // 身體、脖子、短尾巴
      [[.13, .23], [-.13, .23], [.13, -.24], [-.13, -.24]].forEach(([x, z]) => { gp(new THREE.CylinderGeometry(.06, .05, .36, 5), LG, x, .22, z); gp(new THREE.CylinderGeometry(.045, .05, .06, 5), '#6b5e55', x, .03, z); }); // 四條腿與小蹄子
      [[-.55, .1, -.3], [.6, .08, -.45], [.6, .07, .45]].forEach(([x, y, z], i) => { a(FM, new THREE.SphereGeometry(.12, 6, 3, 0, PI2, 0, Math.PI / 2), '#6fae5c', x, y, z, 0, 0, 0, 1, .7, 1); for (let k = 0; k < 5; k++) a(FM, new THREE.IcosahedronGeometry(.035, 0), k % 2 ? '#f9a8d4' : '#f472b6', x + Math.cos(k * 1.3 + i) * .07, y + .08 + (k % 2) * .02, z + Math.sin(k * 1.3 + i) * .07); }); // 岩台上的海石竹
      for (let i = 0; i < 3; i++) { const t = face + 1.1 + i * 1.6, x = fx - ux * 1.2 + Math.sin(t) * 1.4, z = fz - uz * 1.2 + Math.cos(t) * 1.4, y = H(x, z); kg.add(FM, new THREE.SphereGeometry(.14, 6, 3, 0, PI2, 0, Math.PI / 2), '#6fae5c', M4(x, y - .02, z, 0, 0, 0, 1, .7, 1)); for (let k = 0; k < 6; k++) kg.add(FM, new THREE.IcosahedronGeometry(.04, 0), k % 2 ? '#f9a8d4' : '#ec4899', M4(x + Math.cos(k * 1.1) * .08, y + .07 + (k % 2) * .03, z + Math.sin(k * 1.1) * .08)); } // 山壁腳下幾叢海石竹
      addCol({ x: cx, z: cz, r: 1.45 }); kg.done(LOW ? 70 : 100);
      // 山羊的頭（會動，單獨一個網格）：樞紐在脖子頂端；有人走近就轉頭看著他，沒人的時候慢慢左右看、嚼東西
      const hp = [], h = (geo, col, x, y, z, rx = 0, ry = 0, rz = 0, sx = 1, sy = sx, sz = sx) => hp.push([geo, col, M4(x, y, z, rx, ry, rz, sx, sy, sz)]);
      h(new THREE.SphereGeometry(.15, 8, 6), W2, 0, .04, .1, 0, 0, 0, .85, .9, 1.25); h(new THREE.BoxGeometry(.15, .12, .14), '#efe8db', 0, -.02, .25); h(new THREE.BoxGeometry(.07, .035, .02), '#f9a8d4', 0, .01, .325); // 頭、口鼻、粉紅鼻頭
      [-1, 1].forEach(s => { h(new THREE.SphereGeometry(.024, 6, 4), '#1f2937', s * .085, .08, .17); h(new THREE.ConeGeometry(.033, .24, 5), '#a8a29e', s * .06, .2, .0, -.55, 0, s * -.12); h(new THREE.BoxGeometry(.15, .04, .07), '#efe7da', s * .16, .07, .03, 0, 0, s * .45); h(new THREE.SphereGeometry(.03, 6, 4), '#fecdd3', s * .09, -.01, .2, 0, 0, 0, 1, .6, .4); }); // 眼睛、往後彎的角、垂垂的耳朵、腮紅
      h(new THREE.ConeGeometry(.035, .12, 4), '#e2dacb', 0, -.13, .2, Math.PI, 0, 0); // 山羊鬍
      const hm = new THREE.Mesh(nookMerge(hp), FM); tv.set(0, .96, .6).applyMatrix4(M4(cx, T, cz, 0, face, 0, 1.2)); hm.position.copy(tv); hm.scale.setScalar(1.2); hm.rotation.order = 'YXZ'; hm.rotation.y = face; hm.castShadow = false;
      chunkObj(hm, 60, false, [tv.x, tv.z, 1]); GOAT.head = hm; }
    PACE.push(...W.chunks.slice(c00)); PACE.forEach(o => { o.userData.far0 = o.userData.far; });
  });
  regionStep((dt, t) => {
    paceHide(PACE);
    const w = CASTLE.wheel; if (w && w.visible) { CASTLE.a += dt * (4.5 + 2 * Math.sin(t * .4) + Math.sin(t * 1.3)); w.rotation.x = CASTLE.a; } // 海風一陣一陣：時快時慢（cullChunks 沒畫它的時候就不轉）
    const g = GOAT.head; if (g && g.visible) { const dx = P.x - g.position.x, dz = P.z - g.position.z, d = Math.hypot(dx, dz); let y = Math.sin(t * .23) * .5 + Math.sin(t * .61) * .2; // 山羊：慢慢左右看
      if (d < 22) { let r = Math.atan2(dx, dz) - GOAT.face; r = Math.atan2(Math.sin(r), Math.cos(r)); y = Math.max(-1.1, Math.min(1.1, r)); } // 有人走近：轉頭看著他（脖子轉不過去的角度就停在最旁邊）
      GOAT.yaw += (y - GOAT.yaw) * Math.min(1, dt * 2.2); g.rotation.y = GOAT.face + GOAT.yaw; g.rotation.x = d < 22 ? -.08 : .12 + Math.max(0, Math.sin(t * 3.1)) * .06; } // 沒人的時候低頭嚼東西
    const k = KITE.m; if (k && k.visible) { k.rotation.set(Math.sin(t * .53) * .06 + Math.sin(t * 1.7) * .015, Math.sin(t * .21) * .08, Math.sin(t * .71) * .05 + Math.sin(t * 2.3) * .012); } // 風箏繞著木樁慢慢畫八字、一陣風來抖一下
  });
})();
