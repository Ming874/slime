'use strict';
/* ============================================================
   筆記本裡的手繪地圖（設計分析 9.2）：Esc 筆記本的「地圖」那一頁。排版、貼紙、地名、鉛筆圈在 components/stations/NoteMap.tsx（DOM，字用手寫字型、不會被裁），
   這裡負責「走過哪裡」與紙上的淡彩、等高線、小徑、山洞（canvas）。
   - 範圍：月光谷整張（基礎單位 x −172～172、z −172～92：四區＋中央平地＋南山）。大城市不畫，只在谷口畫一個「往大城市」的箭頭
   - 切成 32×32 格，走過的格子才畫出來；存成 128 bytes 的位元圖（S.map，base64 172 字，存檔多 181 bytes）。舊存檔沒有這個欄位＝一張白紙，
     第一次走動時先補上工坊附近、找過的小秘密與走過的山洞口（nmSeed）
   - 走得進去的格子：玩家 9 公尺內才算走過；山脊、高山、海這些走不進去的格子：看得到就算（40 公尺內），所以站在山腳就畫得出山。
     只畫和腳下那一格連在一起的（隔著沒走過的平地看到的遠山先不畫，紙上才不會有一塊塊浮在白紙上的碎山）
   - 畫法：淡彩依區域色與高度（向西北打光、顏料有濃淡）、鉛筆等高線（先模糊再取，平地不會冒出一堆小圈圈）、高山畫成一個個小山形、小徑是棕色虛線；
     走過的範圍邊緣跟著雜訊彎彎曲曲、顏料在邊上積得深一點，像水彩暈開的邊。山洞（走過的）畫成紫灰色的點線
   地形是靜態的：淡彩底與線稿第一次用到時算一次（世界載入後趁閒置一小段一小段先算好，手機上也不會卡一下），之後只在走過的範圍或山洞變了的時候重算「走過的範圍」那一層（約 9 萬個點）。
   這個檔案在 game.js 之前載入：最上層只放資料與函式，用到的 game.js 全域（H、K、S、P、W、LMS、CAVES…）都在函式被呼叫時才讀。
   ============================================================ */
const NMAP = {
  x0: -172, z0: -172, w: 344, h: 264, n: 32, // 基礎單位（世界座標＝基礎單位×K）
  FW: 344, FH: 264, CW: 1032, CH: 792, // 淡彩的取樣（每個基礎單位一點）、畫布（×3）
  bits: new Uint8Array(128), s: null, walk: null, base: null, noise: null, lines: null, peaks: null, fld: null, seq: 0, eggAt: {}, eggW: null, prep: null,
};
// 找到的小秘密貼在哪裡（基礎單位）：各區場景的位置（game.js 的 NOOK 與 region-*.js 的場景），不另外存進存檔。場景裡有按 E 的東西（W.inter）的，以場景上的位置為準（nmEggPos），
// 場景檔搬動了也跟得上；這張表給沒有可以按的東西的（看天空、走過去就觸發的）。新加的小秘密兩邊都沒有的話，貼在這一輪找到它的地方
const NM_EGGS = {
  forest_frog: [-23, -13.5], forest_note: [-28.4, -17.1], forest_ring: [-20, 21.5], forest_picnic: [20, -21], forest_log: [6, 32], forest_rock: [-30, 6.2], forest_star: [-36, -6],
  plain_scope: [29.3, -25.6], plain_hammock: [-11.2, -27.3], plain_stones: [37.8, 23],
  coast_crab: [130.4, -30.2], coast_bottle: [121.7, 38], coast_arch: [133.2, -56], coast_conch: [98, 6.6], coast_nest: [131, -92.5], coast_glow: [108.5, -65], coast_swing: [119.8, 73], coast_prints: [110.6, 89], coast_chime: [102.5, -34.2],
  volcano_onsen: [-55, -112], volcano_tamago: [-50, -107.5], volcano_mirror: [54, -104], volcano_tube: [18, -88], volcano_bluefire: [32, -82], volcano_flower: [-50.5, -145.5],
  snow_fish: [-138, -41], snow_igloo: [-128.4, -45.6], snow_turn: [-141.5, -33.5], snow_icicle: [-155.9, 34.1], snow_aurora: [-102, -42], snow_owl: [-112.4, -84.6], snow_hare: [-104.6, 33.4],
};
// 地名（基礎單位，字的中心）：每區幾個可以寫字的地方，照順序挑。第一個在大家一定會走的路旁邊（洞口出來往地標的路、工坊北邊、往計程車的路），
// 走到那裡就寫得上去；字底下有走過、看過的格子才寫（nmLabelOK），字不會孤零零寫在白紙上。
// 真正寫在哪一個由 NoteMap.tsx 決定：照地圖實際的大小量，會碰到貼紙、貼紙的名字、星星、「往大城市」、標題或別的地名就換下一個（手機上字相對大，常常會換），全部都碰到就不寫
const NM_REGIONS = [
  { id: 'plain', t: '中央平地', c: [[0, -28], [-26, -41], [0, -55], [-28, 36]] },
  { id: 'volcano', t: '火山', c: [[-24, -84], [26, -69], [0, -156], [40, -150]] },
  { id: 'coast', t: '海岸', c: [[88, -13], [84, 24], [78, -52], [86, 52]] },
  { id: 'snow', t: '雪原', c: [[-80, -16], [-72, -16], [-80, 18], [-100, -62], [-118, 62]] },
  { id: 'south', t: '南山', c: [[34, 72], [-62, 74], [44, 82]] },
];
// 地標貼紙：工坊一開始就在；其他四個在 LMS（game.js 的 buildLandmarks3）。lb＝名字寫在貼紙的哪一邊（避開地圖邊緣與旁邊的貼紙）
const NM_LM = { home: { name: '工坊', lb: 'r' }, tree: { name: '森林巨樹', lb: 'b' }, light: { name: '燈塔', lb: 'l' }, crater: { name: '火山口', lb: 'b' }, ice: { name: '冰晶塔', lb: 'b' } };
// 各區場景檔裡的水面（region-*.js 的區域變數讀不到，照抄位置；基礎單位）：海岸的海角小湖
const NM_WATER = [{ x: 108.5, z: -65, r: 8.4, d: 1, wob: .1 }];
const nmCW = () => NMAP.w / NMAP.n, nmCH = () => NMAP.h / NMAP.n;

/* ---------- 存檔：128 bytes 的位元圖 ⇄ base64 ---------- */
function nmEnc(b) { let s = ''; for (let i = 0; i < b.length; i++) s += String.fromCharCode(b[i]); return btoa(s); }
function nmDec(s, b) { b.fill(0); if (!s) return b; try { const t = atob(s); if (t.length === b.length) for (let i = 0; i < b.length; i++) b[i] = t.charCodeAt(i); } catch (e) { } return b; }
// 讀檔時檢查（sanitize）：格式不對、或一格都沒走過就當成白紙
function nmSan(v) { if (typeof v !== 'string' || !/^[A-Za-z0-9+/]{171}=$/.test(v)) return ''; const b = nmDec(v, new Uint8Array(128)); return b.some(x => x) ? nmEnc(b) : ''; }
// 目前存檔的位元圖（S 換了、讀了雲端存檔都會自己跟著換）
function nmBits() { const s = S.map || ''; if (NMAP.s !== s) { nmDec(s, NMAP.bits); NMAP.s = s; } return NMAP.bits; }
const nmHas = (b, i, j) => i >= 0 && j >= 0 && i < NMAP.n && j < NMAP.n && (b[(j * NMAP.n + i) >> 3] >> ((j * NMAP.n + i) & 7) & 1) === 1;
const nmCell = (xb, zb) => [Math.floor((xb - NMAP.x0) / nmCW()), Math.floor((zb - NMAP.z0) / nmCH())];
const nmSeenAt = (xb, zb) => { const [i, j] = nmCell(xb, zb); return nmHas(nmBits(), i, j); };
// 矩形（基礎單位）裡有沒有走過、看過的格子
function nmAny(b, xa, za, xb, zb) { const [i0, j0] = nmCell(xa, za), [i1, j1] = nmCell(xb, zb); for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) if (nmHas(b, i, j)) return true; return false; }
// 地名寫不寫得上去：字底下（桌機的字大約每個字 15 個基礎單位寬、12 高；上下多半格，路就在字的旁邊也算）有畫上的格子。
// 只是附近有一小塊（例如找到小秘密時補上的那一小塊）不算，字不會離畫上的地方老遠
const nmLabelOK = (b, t, x, z) => nmAny(b, x - t.length * 7.6, z - 6 - nmCH() / 2, x + t.length * 7.6, z + 6 + nmCH() / 2);
// 走過的山洞：穿過去的洞（caves.js 的 caveLeave 記在 S.cave.seen）；死路的洞（月光洞窟）走進去再出來也記在那裡，
// 改版前就走過的，拍過洞裡的壁畫（S.cave.mural）也算；正在走的洞一定畫
const nmCaveSeen = c => c === CV.c || !!(S.cave && ((S.cave.seen && S.cave.seen[c.id]) || (c.dead && S.cave.mural && S.cave.mural[c.id])));

/* ---------- 走得進去的地方（基礎單位，不管解鎖了沒）：山脊、區域之間的分隔山、南山、外圈的高山、海都不算 ---------- */
function nmOK(x, z) {
  const ax = Math.abs(x), az = Math.abs(z), r = Math.max(ax, az);
  if (r < 49) return true; if (r <= 60 || r > 166 || Math.abs(ax - az) < 9 || (z > 0 && az > ax)) return false;
  return !(x > 128 && H(x * K, z * K) < -1.2);
}
// 每一格是不是「走得進去」：16 個取樣點有 5 個以上走得進去就算（只算一次）
function nmWalk() {
  if (NMAP.walk) return NMAP.walk; const n = NMAP.n, cw = nmCW(), ch = nmCH(), w = new Uint8Array(n * n);
  for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) { let c = 0; for (let a = 0; a < 4; a++) for (let b = 0; b < 4; b++) if (nmOK(NMAP.x0 + (i + (a + .5) / 4) * cw, NMAP.z0 + (j + (b + .5) / 4) * ch)) c++; w[j * n + i] = c >= 5 ? 1 : 0; }
  return (NMAP.walk = w);
}
/* ---------- 走過的格子：每秒一次（game.js 的 loop） ---------- */
// 基礎單位的一點：走得進去的格子 rw 公尺內、走不進去的 rs 公尺內都畫上——但只畫和腳下那一格連得起來的（八個方向，經過範圍內或已經畫上的格子）：
// 站在火山口看得到外圈的高山，可是中間的平地還沒走過，那幾格高山就先不畫，不會變成一塊塊浮在白紙上的碎山
function nmMark(b, xb, zb, rw, rs) {
  const n = NMAP.n, cw = nmCW(), ch = nmCH(), wk = nmWalk(), [pi, pj] = nmCell(xb, zb), di = Math.ceil(rs / K / cw), dj = Math.ceil(rs / K / ch);
  const ci = clamp(pi, 0, n - 1), cj = clamp(pj, 0, n - 1), W2 = 2 * di + 1, vis = new Uint8Array(W2 * (2 * dj + 1)); let add = 0;
  const has = k => (b[k >> 3] >> (k & 7) & 1) === 1;
  const near = (i, j) => { const k = j * n + i, ax = NMAP.x0 + i * cw, az = NMAP.z0 + j * ch, dx = Math.max(ax - xb, 0, xb - ax - cw), dz = Math.max(az - zb, 0, zb - az - ch); return Math.hypot(dx, dz) * K <= (wk[k] ? rw : rs); };
  if (!near(ci, cj)) return 0; // 站在地圖外面（往大城市的路上）離邊上那一格太遠
  const q = [ci, cj]; vis[dj * W2 + di] = 1;
  while (q.length) {
    const j = q.pop(), i = q.pop(), k = j * n + i; if (!has(k)) { b[k >> 3] |= 1 << (k & 7); add++; }
    for (let b2 = -1; b2 <= 1; b2++) for (let a = -1; a <= 1; a++) {
      const ii = i + a, jj = j + b2; if (ii < 0 || jj < 0 || ii >= n || jj >= n || Math.abs(ii - ci) > di || Math.abs(jj - cj) > dj) continue;
      const v = (jj - cj + dj) * W2 + ii - ci + di; if (vis[v]) continue;
      if (near(ii, jj)) { vis[v] = 1; q.push(ii, jj); } else if (has(jj * n + ii)) { vis[v] = 1; q.push(ii, jj); } // 已經畫上的格子也能連過去（不再重畫）
    }
  }
  return add;
}
// 白紙（新遊戲、改版前的舊存檔）：工坊附近、找過的小秘密、走過的山洞兩頭先畫上（都是確定去過的地方）
function nmSeed(b) {
  let add = nmMark(b, 0, 0, 30, 40);
  for (const id of S.eggs || []) { const p = nmEggPos(id); if (p) add += nmMark(b, p[0], p[1], 9, 30); }
  if (typeof CAVES !== 'undefined') for (const c of CAVES) if (c !== CV.c && nmCaveSeen(c)) { add += nmMark(b, c.X[0] / K, c.Z[0] / K, 9, 30); if (!c.def.dead) add += nmMark(b, c.X[c.n - 1] / K, c.Z[c.n - 1] / K, 9, 30); }
  return add;
}
function nmStep() {
  if (!W.ready || TITLE.on || !P || INTRO.on || RIDE.on || CV.c || inCity()) return; // 開場、搭車、山洞裡（在山的底下）、大城市都不算
  const b = nmBits(); let add = S.map ? 0 : nmSeed(b); add += nmMark(b, P.x / K, P.z / K, 9, 40);
  if (add) { S.map = NMAP.s = nmEnc(b); if (GUI.kind === 'pause' && tab === 'map') ui('map'); }
}
// 找到小秘密：沒登記位置的（新加的）記住這一輪找到它的地方
function nmEgg(id) { if (!nmEggPos(id) && P && !inCity()) NMAP.eggAt[id] = [P.x / K, P.z / K]; }
// 小秘密在地圖上的位置（基礎單位）：場景裡按 E 的東西（W.inter，同一個小秘密有好幾個就取中間）＞ NM_EGGS ＞ 這一輪找到它的地方。場景蓋好後算一次
function nmEggPos(id) {
  if (!NMAP.eggW && W.ready && Array.isArray(W.inter)) {
    const acc = {}, v = new THREE.Vector3();
    for (const it of W.inter) if (it && it.hit && typeof it.id === 'string' && EGGS.has(it.id)) { it.hit.getWorldPosition(v); const a = acc[it.id] || (acc[it.id] = [0, 0, 0]); a[0] += v.x / K; a[1] += v.z / K; a[2]++; }
    NMAP.eggW = {}; for (const id in acc) NMAP.eggW[id] = [acc[id][0] / acc[id][2], acc[id][1] / acc[id][2]];
  }
  return (NMAP.eggW && NMAP.eggW[id]) || NM_EGGS[id] || NMAP.eggAt[id] || null;
}

/* ---------- 紙上的淡彩（靜態，只算一次）：顏色、高度、雜訊 ---------- */
const NM_PAL = { forest: [172, 210, 156], coast: [236, 222, 172], volcano: [196, 168, 154], snow: [226, 236, 247] };
// 一列一列算（more() 回傳 false 就先停，下次從停下的地方接著算）：先算高度（多一圈，給打光用），再算顏色；算完回傳 true
function nmPrepRows(more) {
  if (NMAP.base) return true;
  const { FW, FH, x0, z0 } = NMAP, R = FW + 2;
  const st = NMAP.prep || (NMAP.prep = { j: -1, hs: new Float32Array((FW + 2) * (FH + 2)), col: new Uint8ClampedArray(FW * FH * 3), nz: new Float32Array(FW * FH), color: false,
    water: [...NOOK_DIG.filter(p => p.keep && (p.d || p.dig)), ...NM_WATER] }); // 池塘、潮池、溫泉、冰湖、冰瀑下的水潭、海角腳下的小湖
  const { hs, col, nz, water } = st, c = [0, 0, 0], mix = (d, t) => { c[0] += (d[0] - c[0]) * t; c[1] += (d[1] - c[1]) * t; c[2] += (d[2] - c[2]) * t; };
  while (!st.color) { // 高度：j = −1～FH
    const j = st.j; for (let i = -1; i <= FW; i++) { const x = x0 + i + .5, z = z0 + j + .5; hs[(j + 1) * R + i + 1] = H(x * K, z * K); }
    if (++st.j > FH) { st.color = true; st.j = 0; } if (!more()) return false;
  }
  while (st.j < FH) {
    const j = st.j;
    for (let i = 0; i < FW; i++) {
      const x = x0 + i + .5, z = z0 + j + .5, h = hs[(j + 1) * R + i + 1], w = biomeW0(x, z), k = j * FW + i, ok = nmOK(x, z);
      c[0] = c[1] = c[2] = 0; BIOMES.forEach((b, q) => { const p = NM_PAL[b]; c[0] += p[0] * w[q]; c[1] += p[1] * w[q]; c[2] += p[2] * w[q]; });
      if (!ok) { const mt = smooth(3, 22, h); mix([182, 170, 152], mt * .55); mix([250, 250, 252], smooth(34, 52, h) * .8); } // 走不進去的高山：偏灰褐，山頂一點雪
      else if (h > 20) mix([174, 132, 116], smooth(20, 46, h) * .45); // 火山錐：越高越紅褐
      if (x > 128 && h < -1.2) { const t = smooth(-1.2, -2.8, h); c[0] = 168 - 40 * t; c[1] = 210 - 28 * t; c[2] = 236 - 8 * t; } // 海：越深越藍
      for (const p of water) { const dx = x - p.x, dz = z - p.z; if (dx * dx + dz * dz < p.r * p.r * 1.5 && Math.hypot(dx, dz) < nookR(p, Math.atan2(dz, dx)) * 1.04) { const frozen = p.d === 0; c[0] = frozen ? 210 : 150; c[1] = frozen ? 230 : 202; c[2] = frozen ? 245 : 232; } }
      // 向西北打光：朝西北的坡亮、朝東南的坡暗（每個基礎單位的高度差，公尺）
      const gx = hs[(j + 1) * R + i + 2] - hs[(j + 1) * R + i], gz = hs[(j + 2) * R + i + 1] - hs[j * R + i + 1], sh = clamp(1 + .045 * (gx + gz), .74, 1.14);
      // 水彩的濃淡：大塊的顏料不均＋細細的紙紋
      const v = 1 + (vnoise(x * .055, z * .055, 77) - .5) * .16 + (vnoise(x * .31, z * .31, 78) - .5) * .07;
      col[k * 3] = c[0] * sh * v; col[k * 3 + 1] = c[1] * sh * v; col[k * 3 + 2] = c[2] * sh * v;
      nz[k] = (vnoise(x * .085, z * .085, 91) - .5) * .62 + (vnoise(x * .27, z * .27, 92) - .5) * .2; // 走過範圍的邊緣：彎彎曲曲
    }
    if (++st.j < FH && !more()) return false;
  }
  NMAP.noise = nz; NMAP.base = { col, hs, R }; NMAP.prep = null; return true;
}
// 第一次翻到地圖時還沒算完：剩下的一次算完
function nmPrep() { if (!NMAP.base) nmPrepRows(() => true); return NMAP.base; }

/* ---------- 線稿（靜態，只畫一次）：等高線、海岸線、小徑（高山的小山形每次跟著走過的範圍畫，nmPeaks） ---------- */
function nmLines() {
  if (NMAP.lines) return NMAP.lines; const { hs, R } = nmPrep(), { FW, FH, CW, CH, x0, z0 } = NMAP, sx = CW / NMAP.w, sy = CH / NMAP.h;
  const cv = document.createElement('canvas'); cv.width = CW; cv.height = CH; const g = cv.getContext('2d'); g.lineCap = g.lineJoin = 'round';
  const px = x => (x - x0) * sx, py = z => (z - z0) * sy;
  // 等高線：每 2 個基礎單位取一點、模糊兩次，再用 marching squares 取 4 公尺一條（每 5 條加粗）；海岸線另外用藍色鉛筆
  const S2 = 2, GW = Math.floor(FW / S2) + 1, GH = Math.floor(FH / S2) + 1; let gh = new Float32Array(GW * GH);
  for (let j = 0; j < GH; j++) for (let i = 0; i < GW; i++) gh[j * GW + i] = hs[(Math.min(FH, j * S2) + 1) * R + Math.min(FW, i * S2) + 1];
  for (let p = 0; p < 2; p++) { const t = new Float32Array(gh.length); for (let j = 0; j < GH; j++) for (let i = 0; i < GW; i++) { let s = 0, n = 0; for (let b = -1; b <= 1; b++) for (let a = -1; a <= 1; a++) { const ii = i + a, jj = j + b; if (ii < 0 || jj < 0 || ii >= GW || jj >= GH) continue; s += gh[jj * GW + ii]; n++; } t[j * GW + i] = s / n; } gh = t; }
  const thin = new Path2D(), bold = new Path2D(), shore = new Path2D(), gx = i => px(x0 + i * S2), gz = j => py(z0 + j * S2);
  const seg = (P, L, a, b, c, d, i, j) => { // 一格裡 L 這條線的線段（四個角 a 左上、b 右上、c 右下、d 左下）
    const e = [], t = (u, v) => (L - u) / (v - u);
    if ((a > L) !== (b > L)) e.push([gx(i + t(a, b)), gz(j)]); if ((b > L) !== (c > L)) e.push([gx(i + 1), gz(j + t(b, c))]);
    if ((d > L) !== (c > L)) e.push([gx(i + t(d, c)), gz(j + 1)]); if ((a > L) !== (d > L)) e.push([gx(i), gz(j + t(a, d))]);
    for (let q = 0; q + 1 < e.length; q += 2) { P.moveTo(e[q][0], e[q][1]); P.lineTo(e[q + 1][0], e[q + 1][1]); }
  };
  for (let j = 0; j < GH - 1; j++) for (let i = 0; i < GW - 1; i++) {
    const a = gh[j * GW + i], b = gh[j * GW + i + 1], c = gh[(j + 1) * GW + i + 1], d = gh[(j + 1) * GW + i], lo = Math.min(a, b, c, d), hi = Math.max(a, b, c, d);
    for (let L = Math.ceil(lo / 4) * 4 || 4; L <= hi; L += 4) if (L > 0) seg(L % 20 ? thin : bold, L, a, b, c, d, i, j);
    if (x0 + i * S2 > 126 && lo < -1 && hi > -1) seg(shore, -1, a, b, c, d, i, j);
  }
  g.strokeStyle = 'rgba(96,78,62,.3)'; g.lineWidth = 1.3; g.stroke(thin); g.strokeStyle = 'rgba(96,78,62,.46)'; g.lineWidth = 1.9; g.stroke(bold);
  g.strokeStyle = 'rgba(58,112,160,.7)'; g.lineWidth = 2; g.stroke(shore);
  // 海浪：海上幾道短短的波紋
  g.strokeStyle = 'rgba(58,112,160,.45)'; g.lineWidth = 1.5; { const r = seeded(31); for (let n = 0; n < 60; n++) { const x = 142 + r() * 28, z = z0 + r() * 262; if (H(x * K, z * K) > -1.6) continue; const X = px(x), Y = py(z); g.beginPath(); g.moveTo(X - 8, Y); g.quadraticCurveTo(X - 4, Y - 4, X, Y); g.quadraticCurveTo(X + 4, Y - 4, X + 8, Y); g.stroke(); } }
  // 高山：抖動的格子上一座座圓頭的小山（越高越大、很高的山頂有雪）；只放在走不進去的高處，矮的山脊交給等高線。
  // 這裡只記下位置，畫在 nmPeaks：山腳那一格畫上了才畫、而且整座畫（線稿會被走過的範圍裁掉，放在線稿裡的話邊上的山會被切成半座）
  const pk = [], r = seeded(57);
  for (let z = z0 + 5; z < z0 + NMAP.h; z += 10) for (let x = x0 + 5; x < x0 + NMAP.w; x += 12.5) {
    const xx = x + (r() - .5) * 6, zz = z + (r() - .5) * 5, h = H(xx * K, zz * K); if (nmOK(xx, zz) || h < 11 || (xx > 128 && h < 0)) continue;
    pk.push([xx, zz, h, r()]);
  }
  NMAP.peaks = pk.sort((a, b) => a[1] - b[1]); // 由上往下畫，前面的山蓋住後面的
  // 小徑：中央平地往三個洞口、洞口外通往各區（game.js 的 PATH_LINES，世界座標）
  g.setLineDash([9, 7]); g.strokeStyle = 'rgba(146,98,58,.8)'; g.lineWidth = 2.6;
  for (const l of PATH_LINES) { const p = crPts(l, 6); g.beginPath(); p.forEach(([x, z], n) => n ? g.lineTo(px(x / K), py(z / K)) : g.moveTo(px(x / K), py(z / K))); g.stroke(); }
  g.setLineDash([]);
  return (NMAP.lines = cv);
}

// 高山的小山形：山腳那一格走過、看過的才畫，整座畫上去（g＝頁面上的畫布，座標和線稿一樣）
function nmPeaks(g, col, b) {
  const { FW, FH, x0, z0, CW, CH } = NMAP, sx = CW / NMAP.w, sy = CH / NMAP.h; g.lineCap = g.lineJoin = 'round';
  for (const [x, z, h, q] of NMAP.peaks || []) {
    const [ci, cj] = nmCell(x, z); if (!nmHas(b, ci, cj)) continue;
    const X = (x - x0) * sx, Y = (z - z0) * sy, s = 17 + Math.min(h, 64) * .26 + q * 5, i = clamp(Math.round(x - x0), 0, FW - 1), j = clamp(Math.round(z - z0), 0, FH - 1), k = (j * FW + i) * 3;
    const w = s * .66, bt = Y + s * .32, tx = X + (q - .5) * s * .16, ty = Y - s * .5, rr = s * .12; // 底的半寬、底線、山頂（圓頭的半徑）
    const shape = () => { g.beginPath(); g.moveTo(X - w, bt); g.lineTo(tx - rr, ty + rr * 1.1); g.quadraticCurveTo(tx, ty - rr * .5, tx + rr, ty + rr * 1.1); g.lineTo(X + w, bt); };
    g.fillStyle = `rgb(${col[k]},${col[k + 1]},${col[k + 2]})`; shape(); g.closePath(); g.fill(); // 用底下的淡彩把後面的山與等高線蓋掉
    if (h > 40) { const y = ty + s * .34; g.save(); shape(); g.closePath(); g.clip(); g.fillStyle = 'rgba(255,255,255,.92)'; g.beginPath(); g.moveTo(X - w, ty - s); g.lineTo(X + w, ty - s); g.lineTo(X + w, y); g.lineTo(tx + s * .14, y + s * .07); g.lineTo(tx, y - s * .04); g.lineTo(tx - s * .14, y + s * .08); g.lineTo(X - w, y); g.closePath(); g.fill(); g.restore(); }
    g.fillStyle = 'rgba(104,86,72,.22)'; g.beginPath(); g.moveTo(tx + rr * .2, ty + rr * .1); g.quadraticCurveTo(tx + rr * .9, ty + rr * .1, tx + rr, ty + rr * 1.1); g.lineTo(X + w, bt); g.lineTo(X + w * .1, bt); g.closePath(); g.fill(); // 東南面的影子
    g.strokeStyle = 'rgba(84,70,58,.7)'; g.lineWidth = 2; shape(); g.stroke();
  }
}

/* ---------- 畫在筆記本上（NoteMap.tsx 每次重繪都呼叫；走過的範圍或山洞沒變就直接用上次畫好的） ---------- */
function nmDraw(cv) {
  if (!cv || !W.ready) return; const { CW, CH, FW, FH } = NMAP; if (cv.width !== CW || cv.height !== CH) { cv.width = CW; cv.height = CH; cv._nmSig = ''; } // 改大小會清空畫布
  const caves = typeof CAVES === 'undefined' ? [] : CAVES.filter(nmCaveSeen), sig = nmEnc(nmBits()) + caves.map(c => c.def.id).join();
  if (cv._nmSig === sig) return; cv._nmSig = sig; // 走過的範圍與山洞都沒變：畫布上已經是這一張
  const { col } = nmPrep(), nz = NMAP.noise, b = nmBits(), n = NMAP.n, lines = nmLines();
  if (!NMAP.fld) { NMAP.fld = document.createElement('canvas'); NMAP.fld.width = FW; NMAP.fld.height = FH; }
  // 走過的範圍：格子中心的 0／1 雙線性內插＋雜訊，取 0.5 附近的一段當邊緣；邊緣內側顏料積深一點
  const fg = NMAP.fld.getContext('2d'), im = fg.createImageData(FW, FH), d = im.data, cv0 = new Float32Array(n * n);
  for (let k = 0; k < n * n; k++) cv0[k] = (b[k >> 3] >> (k & 7)) & 1;
  const at = (i, j) => cv0[clamp(j, 0, n - 1) * n + clamp(i, 0, n - 1)];
  for (let j = 0; j < FH; j++) { const fy = (j + .5) / FH * n - .5, j0 = Math.floor(fy), ty = fy - j0;
    for (let i = 0; i < FW; i++) {
      const fx = (i + .5) / FW * n - .5, i0 = Math.floor(fx), tx = fx - i0, k = j * FW + i;
      const v = (at(i0, j0) * (1 - tx) + at(i0 + 1, j0) * tx) * (1 - ty) + (at(i0, j0 + 1) * (1 - tx) + at(i0 + 1, j0 + 1) * tx) * ty + nz[k];
      const m = smooth(.4, .6, v); if (m <= 0) { d[k * 4 + 3] = 0; continue; }
      const e = 1 - .2 * smooth(.48, .6, v) * (1 - smooth(.62, .84, v));
      d[k * 4] = col[k * 3] * e; d[k * 4 + 1] = col[k * 3 + 1] * e; d[k * 4 + 2] = col[k * 3 + 2] * e; d[k * 4 + 3] = m * 212;
    }
  }
  fg.putImageData(im, 0, 0);
  // 直接畫在頁面的畫布上（不多留一張整頁大小的畫布）：先放線稿、用走過的範圍裁掉外面，再把淡彩墊在線稿底下
  const o = cv.getContext('2d'); o.save(); o.clearRect(0, 0, CW, CH); o.imageSmoothingEnabled = true; o.imageSmoothingQuality = 'high';
  o.drawImage(lines, 0, 0); o.globalCompositeOperation = 'destination-in'; o.drawImage(NMAP.fld, 0, 0, CW, CH); o.globalCompositeOperation = 'destination-over'; o.drawImage(NMAP.fld, 0, 0, CW, CH); o.restore();
  nmPeaks(o, col, b);
  // 山洞：走過的（和正在走的）才畫，紫灰色的點線＋兩頭的洞口（山洞在山的底下，不受走過的範圍影響）
  const sx = CW / NMAP.w, sy = CH / NMAP.h, px = x => (x / K - NMAP.x0) * sx, py = z => (z / K - NMAP.z0) * sy;
  o.lineCap = 'round'; o.lineJoin = 'round';
  for (const c of caves) {
    o.setLineDash([1, 7]); o.strokeStyle = 'rgba(88,74,150,.85)'; o.lineWidth = 3.2; o.beginPath();
    for (let i = 0; i < c.n; i += 2) i ? o.lineTo(px(c.X[i]), py(c.Z[i])) : o.moveTo(px(c.X[i]), py(c.Z[i])); o.lineTo(px(c.X[c.n - 1]), py(c.Z[c.n - 1])); o.stroke(); o.setLineDash([]);
    for (const e of c.def.dead ? [0] : [0, c.n - 1]) { // 洞口：一個小拱門，開口朝著洞外
      const k = e ? Math.max(0, e - 6) : Math.min(c.n - 1, 6), X = px(c.X[e]), Y = py(c.Z[e]), a = Math.atan2(py(c.Z[e]) - py(c.Z[k]), px(c.X[e]) - px(c.X[k]));
      o.save(); o.translate(X, Y); o.rotate(a + Math.PI / 2); o.fillStyle = 'rgba(60,52,96,.75)'; o.strokeStyle = 'rgba(60,52,96,.9)'; o.lineWidth = 1.8;
      o.beginPath(); o.arc(0, 2, 7, Math.PI, 0); o.lineTo(7, 4); o.lineTo(-7, 4); o.closePath(); o.stroke(); o.beginPath(); o.arc(0, 3, 3.6, Math.PI, 0); o.closePath(); o.fill(); o.restore();
    }
  }
}
// 世界載入後、玩家還在走路時先把淡彩底與線稿算好（第一次翻到地圖不卡）
// 淡彩底一次算完要 25 毫秒（手機上可能 100 毫秒，會卡一下），所以每次閒置只算幾毫秒；線稿（約 10 毫秒）等淡彩算完再一次畫好
function nmWarm() {
  const later = f => window.requestIdleCallback ? requestIdleCallback(f, { timeout: 3000 }) : setTimeout(() => f(null), 200);
  const f = dl => {
    try {
      const t0 = performance.now(), cap = dl && !dl.didTimeout ? clamp(dl.timeRemaining() - 1, 2, 8) : 5; // 這一次最多算幾毫秒
      if (!nmPrepRows(() => performance.now() - t0 < cap)) return later(f);
      nmWalk(); if (!NMAP.lines) later(() => { try { nmLines(); } catch (e) { console.error('地圖預先計算失敗', e); } });
    } catch (e) { console.error('地圖預先計算失敗', e); }
  };
  later(f);
}

/* ---------- 給 NoteMap.tsx 的資料：位置都是地圖寬高的百分比（貼紙、星星、地名、鉛筆圈怎麼排開由 NoteMap.tsx 照實際大小決定） ---------- */
function nmView() {
  const b = nmBits(), wk = nmWalk(), n = NMAP.n, at = (xb, zb) => ({ x: (xb - NMAP.x0) / NMAP.w * 100, y: (zb - NMAP.z0) / NMAP.h * 100 });
  let tot = 0, got = 0; for (let k = 0; k < n * n; k++) if (wk[k]) { tot++; if (nmHas(b, k % n, Math.floor(k / n))) got++; } // 走過幾成：只算走得進去的格子
  const lm = [{ id: 'home', x: 0, z: 0 }, ...LMS.map(l => ({ id: l.id, x: l.x / K, z: l.z / K }))].filter(l => NM_LM[l.id]);
  const stickers = lm.filter(l => l.id === 'home' || nmSeenAt(l.x, l.z)).map(l => ({ id: l.id, kind: l.id, name: NM_LM[l.id].name, lb: NM_LM[l.id].lb, ...at(l.x, l.z) }));
  const valley = [...EGGS.values()].filter(e => !e.id.startsWith('city_')), found = valley.filter(e => S.eggs.includes(e.id));
  const eggs = found.map(e => { const p = nmEggPos(e.id); return p && { id: e.id, name: e.name, zone: e.id.split('_')[0], ...at(p[0], p[1]) }; }).filter(Boolean);
  const city = inCity(), cave = !!(typeof CV !== 'undefined' && CV.c), T = TAXI.V, gate = at(T.x / K, T.z / K);
  const me = city || !P ? null : { ...at(P.x / K, P.z / K), rot: -P.yaw * 180 / Math.PI };
  return {
    w: NMAP.w, h: NMAP.h, cw: NMAP.CW, ch: NMAP.CH, seq: NMAP.seq, pct: tot ? Math.round(got / tot * 100) : 0, me, city, cave,
    gate: nmSeenAt(T.x / K, T.z / K) || city || (S.rideN || 0) > 0 ? gate : null,
    // 地名：寫得上去的那幾個位置（照順序）；一個都沒有的區域不寫
    labels: NM_REGIONS.map(r => ({ id: r.id, t: r.t, c: r.c.filter(([x, z]) => nmLabelOK(b, r.t, x, z)).map(([x, z]) => at(x, z)) })).filter(r => r.c.length),
    stickers, eggs, eggN: found.length, eggT: valley.length, lmN: stickers.length, lmT: lm.length, touch: TOUCH,
  };
}
