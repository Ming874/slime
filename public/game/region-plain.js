'use strict';
/* 中央平地（森林）與南方山景：地形多元化與場景細節（登記方式見 regions.js）。內容都包在 IIFE 裡，避免和別的檔案撞名
   - 地形（基礎單位；只動 max(|x|,|z|) < 42、離中心 17 以外）：東北的岩層方山（7 m，四面斷崖＋往西北一條緩坡）、西北的白樺丘、西南的苔石丘、
     東南從南面山壁的瀑布流下來的小溪（瀑布潭 → 溪谷（小木橋底下一段淺灘）→ 溪尾小水潭），和幾座緩緩的小丘。
     小徑、小場景、地標、謎題、山洞口與月光裂縫、計程車走廊附近都淡到 0，區域邊界（42）也淡到 0，不留接縫
   - 隨機的樹與石頭（buildProps）：溪、方山和周圍一圈草地、白樺丘、苔石丘與幾片林間空地不長，樹林成群、空地留白，這些地方改放這裡設計好的東西
   - 場景物件：每一塊（東北、西北、西南、東南）分成大物件、細節兩個網格交給 cullChunks（手機合成一個）；風吹、夜光、遠處細節縮小都寫在頂點屬性裡
     （同一個材質），不加光源。南面山壁只放物件（瀑布、山壁中段與山脊頂的松樹線、山腳的岩脈與樹叢），不動地形
   - 會動的：溪上的蜻蜓、白天花叢上的蝴蝶（各一個 InstancedMesh，離開中央平地就不畫）；夜裡小徑邊、溪岸、白樺丘東坡、方山崖腳有夜光鈴蘭與蘑菇 */
(() => {
  const sm = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
  // 點到折線的距離（同一套單位）
  const segDist = (px, pz, L) => { let best = 1e18; for (let i = 0; i < L.length - 1; i++) { const ax = L[i][0], az = L[i][1], dx = L[i + 1][0] - ax, dz = L[i + 1][1] - az, l2 = dx * dx + dz * dz || 1, t = Math.max(0, Math.min(1, ((px - ax) * dx + (pz - az) * dz) / l2)), ex = px - ax - dx * t, ez = pz - az - dz * t, d = ex * ex + ez * ez; if (d < best) best = d; } return Math.sqrt(best); };

  /* ---------- 不能動的地方（基礎單位）：[x, z, 內圈（完全不動）, 外圈（完全生效）] ---------- */
  const KEEP = [
    [-23, -13.5, 9, 12], [-28.6, -17.2, 3.2, 5.5], [-20, 21.5, 6, 8.5], [20, -21, 7.5, 10], [6, 32, 6, 8.5], [-30, 6.2, 3, 5], // 池塘、柳樹、蘑菇圈、野餐、倒木、像史萊姆的石頭
    [30, 22, 7, 9.5], [-28, -28, 8, 10.5],                                                                                  // 森林巨樹、古代遺跡
    [45, 0, 12, 14.5], [0, -45, 12, 14.5], [-45, 0, 12, 14.5], [7, 45, 12, 14.5],                                          // 三個內側洞口、月光洞窟的裂縫（規定 10，多留一點）
    [-34, 30, 2.2, 4], [38, -34, 2.2, 4], [-14, -42, 2.2, 4], [22, 38, 2.2, 4], [-41, -16, 2.2, 4],                        // 古地圖碎片
  ];
  // 計程車路線（另一組在做，規格 V_OUT 換成基礎單位）：花島西側的招呼站 → 往西南的碎石路 → 南面山腳的隧道口；花島本身另一段。左右各 8 公尺不要動（基礎單位 5，再多留一點）
  const TAXI_L = [[[-12.25, 11.9], [-12.25, 14.4], [-11.75, 17.5], [-11.8, 21.6], [-14.5, 27.75], [-18.1, 33.1], [-20.5, 37.8], [-21.1, 41.25], [-21.1, 45.5]], [[-8.75, 9.4], [-8.75, 17.5]]];
  const taxiD = (x, z) => Math.min(segDist(x, z, TAXI_L[0]), segDist(x, z, TAXI_L[1]));
  let PATHS = null; // 中央平地的小徑（基礎單位）：往三個洞口＋往巨樹
  const paths = () => PATHS || (PATHS = [PATH_LINES[0], PATH_LINES[1], PATH_LINES[3], [[GIANT[0] - 22, GIANT[1] - 30], [GIANT[0] - 8, GIANT[1] - 12], [GIANT[0] - 2, GIANT[1] - 3]]].map(l => crPts(l, 6).map(([x, z]) => [x / K, z / K])));
  function maskAt(x, z) { // 0＝不能動、1＝完全生效
    const r = Math.max(Math.abs(x), Math.abs(z)); let m = (1 - sm(39.5, 41.8, r)) * sm(17.5, 23, Math.hypot(x, z)); if (m <= 0) return 0;
    for (const [kx, kz, r0, r1] of KEEP) { const dx = x - kx, dz = z - kz; if (dx * dx + dz * dz < r1 * r1) { m *= sm(r0, r1, Math.hypot(dx, dz)); if (m <= 0) return 0; } }
    if (x < -2 && z > 3) { m *= sm(5.6, 8.6, taxiD(x, z)); if (m <= 0) return 0; }
    for (const L of paths()) { m *= sm(2.2, 4.6, segDist(x, z, L)); if (m <= 0) return 0; }
    return m;
  }

  /* ---------- 地形特徵 ---------- */
  // 小丘：[x, z, 高（公尺）, 寬（基礎單位）]；最陡的地方約 0.25，走得上去、史萊姆也生得出來
  const HILLS = [
    [-10.5, -30.5, 2.0, 4.5], [-18, -35.5, 1.7, 4], [-5.5, -26.5, 1.3, 3.2], // 西北：白樺丘
    [11.5, -32.5, 1.6, 4.5], [15, 28.5, 1.4, 4], [-29, 35, 1.3, 3.8], [-37.5, -32, 1.5, 3.5], [37.5, -16, 1.3, 3.5], // 各處緩緩的小丘
    [-35.5, 18.5, 3.4, 4.6], // 西南：苔石丘（從西邊小徑看得到坡頂的疊石柱和老樹）
  ];
  // 東北的觀景台地（平頂的方山）：頂面半徑 r、高 top（公尺）；四周是斷崖（1.8 單位內降到地面，坡度遠大於玩家爬得上的 1.1），
  // 只有往西北 (dx, dz) 一條長 len、半寬 w 的緩坡（最陡約 0.55）：從東邊小徑看是一整面岩壁，從北邊小徑看得到上去的路
  const PLAT = { x: 31, z: -28, r: 4.2, top: 7, dx: -.8, dz: -.6, len: 11.5, w: 2.2, cl: 1.6 };
  function platF(x, z) { // 0～1：1＝頂面
    const dx = x - PLAT.x, dz = z - PLAT.z, d = Math.hypot(dx, dz); if (d > PLAT.r + PLAT.len + 2) return 0;
    const a = Math.atan2(dz, dx), R = PLAT.r * (1 + .09 * Math.sin(a * 3 + 1.3) + .05 * Math.sin(a * 5 + .4)), fc = 1 - sm(0, PLAT.cl, d - R);
    const L = Math.hypot(PLAT.dx, PLAT.dz), ux = PLAT.dx / L, uz = PLAT.dz / L, u = dx * ux + dz * uz, v = Math.abs(dz * ux - dx * uz);
    return Math.max(fc, u > 0 ? (1 - sm(R - .6, R + PLAT.len, u)) * (1 - sm(PLAT.w, PLAT.w + 1.6, v)) : 0);
  }
  // 東南的小溪：從南面山壁的瀑布潭往北，繞過巨樹東邊，流進溪尾的小水潭（基礎單位；水面高度 s 是世界公尺）
  const CREEK = [[31.6, 38.2], [32.4, 35.8], [34.3, 33.0], [36.6, 30.1], [37.9, 26.6], [38.0, 22.6], [37.1, 19.2], [35.6, 16.6]];
  const POOL = { x: 31.4, z: 38.6, r: 2.25, s: -.8, wob: .1 }, TAIL = { x: 34.6, z: 14.6, r: 2.6, s: -1.1, wob: .12 };
  let CK = null;
  function creekPts() { // 中線每 0.25 單位一點：[x, z, 0～1 的位置]
    if (CK) return CK; const p = crPts(CREEK, 12); let L = 0; const a = [[p[0][0], p[0][1], 0]];
    for (let i = 1; i < p.length; i++) { L += Math.hypot(p[i][0] - p[i - 1][0], p[i][1] - p[i - 1][1]); a.push([p[i][0], p[i][1], L]); }
    a.forEach(q => { q[2] /= L; }); return (CK = { p: a, L });
  }
  const creekW = t => .92 + .18 * Math.sin(t * 9.4 + 1) + .1 * Math.sin(t * 23 + 2); // 溪的半寬（基礎單位），寬窄有變化
  const poolR = (p, a) => p.r * (1 + p.wob * Math.sin(a * 3 + p.x) * (.7 + .3 * Math.sin(a * 5 + p.z)));
  // 到水邊的距離 sd（基礎單位，負數＝在水裡）、該處的水面 s、正規化寬度 w、深度 D
  function water(x, z) {
    let best = { sd: 1e9, s: 0, w: 1, D: .5, t: 0 };
    for (const p of [POOL, TAIL]) { const dx = x - p.x, dz = z - p.z, d = Math.hypot(dx, dz), sd = d - poolR(p, Math.atan2(dz, dx)); if (sd < best.sd) best = { sd, s: p.s, w: p.r, D: .8, t: p === POOL ? 0 : 1 }; }
    const C = creekPts().p; let bd = 1e18, bt = 0;
    for (let i = 0; i < C.length - 1; i++) {
      const ax = C[i][0], az = C[i][1], dx = C[i + 1][0] - ax, dz = C[i + 1][1] - az, l2 = dx * dx + dz * dz || 1, t = Math.max(0, Math.min(1, ((x - ax) * dx + (z - az) * dz) / l2)), ex = x - ax - dx * t, ez = z - az - dz * t, d = ex * ex + ez * ez;
      if (d < bd) { bd = d; bt = C[i][2] + (C[i + 1][2] - C[i][2]) * t; }
    }
    const w = creekW(bt), sd = Math.sqrt(bd) - w;
    if (sd < best.sd) best = { sd, s: POOL.s + (TAIL.s - POOL.s) * bt, w, D: .5 - .48 * Math.exp(-(((bt - BR.t) / .028) ** 2)), t: bt }; // 小木橋底下是一段淺淺的淺灘：走過橋的時候腳下（地形）只比橋面低一點
    return best;
  }
  const nearCreek = (x, z) => x > 26 && x < 43 && z > 9 && z < 43;
  const BR = { t: .44 }; // 小木橋在小溪的哪裡（0＝瀑布潭、1＝溪尾小水潭）
  // 溪谷的剖面（世界公尺）：水裡是碗狀的溪床，岸邊略高於水面，往外以 0.32 的坡度回到原本的地面（只往下挖，岸太低的地方補高一點）
  function carve(hw, q) {
    const sd = q.sd * K, w = q.w * K, s = q.s;
    const hT = sd >= 0 ? s + .14 + .32 * sd : s + .14 - (.18 + q.D) * sm(0, w * .7, -sd);
    let h = Math.min(hw, hT); if (sd > .2 && sd < 3.2) h = Math.max(h, s + .1 + .08 * sd); return h;
  }
  regionTerrain((x, z, h) => {
    const r = Math.max(Math.abs(x), Math.abs(z)); if (r >= 42 || x * x + z * z < 300) return h;
    let hw = h * K; const m = maskAt(x, z);
    if (m > 0) {
      let add = 0; for (const [cx, cz, A, s] of HILLS) { const d2 = (x - cx) ** 2 + (z - cz) ** 2; if (d2 < 9 * s * s) add += A * Math.exp(-d2 / (2 * s * s)); }
      hw += add * m;
      const f = platF(x, z) * m; if (f > 0) hw += (PLAT.top - hw) * f;
    }
    if (nearCreek(x, z)) { const q = water(x, z); if (q.sd < 6) { const k = 1 - sm(40.2, 41.9, r); if (k > 0) hw += (carve(hw, q) - hw) * k; } }
    return hw / K;
  });

  /* ---------- 隨機的樹與石頭：這些地方不長（世界座標） ---------- */
  const ZONES = [[-10.5, -30.5, 7.5], [-18, -35.5, 6], [-5.5, -26.5, 4.2], [-35.5, 18.5, 6.5]]; // 白樺丘、苔石丘（基礎單位：x, z, 半徑）
  const clearing = (x, z) => fbm(x * .05 + 3.1, z * .05 - 1.7, 61) < .37; // 林間空地：低頻雜訊挖出幾片大小不一的草地（約四分之一；再多就變成一整片空草原）
  regionAvoid((x, z) => {
    const bx = x / K, bz = z / K, r = Math.max(Math.abs(bx), Math.abs(bz)); if ((bx - SNOW.x) ** 2 + (bz - SNOW.z) ** 2 < 25) return true; if (r > 41.6) return false;
    if (nearCreek(bx, bz) && water(bx, bz).sd < 2.6) return true;
    if (platF(bx, bz) > .02 || (bx - PLAT.x) ** 2 + (bz - PLAT.z) ** 2 < 121) return true; // 台地和周圍一圈草地：隨機的樹會把整座方山擋住
    for (const [cx, cz, rr] of ZONES) if ((bx - cx) ** 2 + (bz - cz) ** 2 < rr * rr) return true;
    return clearing(bx, bz);
  });

  /* ============================================================
     場景物件
     ============================================================ */
  // 共用材質：solid＝一面一個顏色的低多邊形（風吹的幅度、夜光強度、物件中心都寫在頂點屬性 aFx，整塊只要一次繪製）；
  // water＝溪水、水潭、瀑布（沿著水流方向移動的白色水紋；aSpd＝流速，負數是彩虹：不流動、只在白天看得到）
  let MT = null;
  function mats() {
    if (MT) return MT;
    const U = { value: 0 }, FADE = { value: new THREE.Vector2(...(LOW ? [30, 46] : [46, 70])) }, solid = new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: .86, metalness: 0 });
    solid.onBeforeCompile = sh => {
      sh.uniforms.uWind = W.wind; sh.uniforms.uNight = U;
      sh.uniforms.uFade = FADE;
      sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nattribute vec4 aFx;\nattribute vec2 aB;\nuniform float uWind;\nuniform vec2 uFade;\nvarying float vGlow;').replace('#include <begin_vertex>', `#include <begin_vertex>
        vGlow = aFx.y;
        if (aFx.x > 0.0) { float wS = sin(uWind * 1.6 + aFx.z * 0.31 + aFx.w * 0.23) * 0.7 + sin(uWind * 3.7 + aFx.z * 1.3 - aFx.w * 0.9) * 0.3;
          transformed.x += (wS + 0.35) * aFx.x; transformed.z += cos(uWind * 1.3 + aFx.w * 0.37 + aFx.z * 0.11) * aFx.x * 0.5; }
        if (aB.y > 0.5) transformed = mix(vec3(aFx.z, aB.x, aFx.w), transformed, 1.0 - smoothstep(uFade.x, uFade.y, distance(aFx.zw, cameraPosition.xz)));`); // aB.y＝小東西：遠了就往自己的底部 (aFx.z, aB.x, aFx.w) 縮小（同 fadeMat）
      sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nuniform float uNight;\nvarying float vGlow;')
        .replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\ntotalEmissiveRadiance += vColor.rgb * vGlow * (0.05 + uNight * 1.3);');
    };
    solid.customProgramCacheKey = () => 'plainSolid';
    const water = new THREE.MeshStandardMaterial({ vertexColors: true, transparent: true, roughness: .07, metalness: .1, depthWrite: false, side: THREE.DoubleSide, forceSinglePass: true }); // 雙面透明材質預設會分兩次畫（多一次繪製），水面不需要
    water.onBeforeCompile = sh => {
      sh.uniforms.uWind = W.wind; sh.uniforms.uNight = U;
      sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nattribute float aSpd;\nvarying vec2 vFl;\nvarying float vSpd;').replace('#include <begin_vertex>', '#include <begin_vertex>\nvFl = uv; vSpd = aSpd;');
      sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nuniform float uWind;\nuniform float uNight;\nvarying vec2 vFl;\nvarying float vSpd;\n' + GLSL_DETAIL)
        .replace('#include <color_fragment>', `#include <color_fragment>
          float wRb = step(vSpd, -0.5), wA = tN(vec2(vFl.x * 4.0, vFl.y * 0.9 - uWind * vSpd)), wB = tN(vec2(vFl.x * 9.0 + 3.0, vFl.y * 1.9 - uWind * vSpd * 1.35));
          float foam = smoothstep(0.6, 0.86, wA * 0.6 + wB * 0.4) * (1.0 - wRb) * clamp(abs(vSpd) * 0.4 + 0.3, 0.0, 1.0);
          diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.96, 0.99, 1.0), foam * 0.8);
          diffuseColor.a = min(1.0, diffuseColor.a + foam * 0.25) * (1.0 - wRb * uNight);`)
        .replace('#include <normal_fragment_maps>', `#include <normal_fragment_maps>
          float wq = (wA + wB * 0.5) * 0.05 * (1.0 - wRb); normal = tPerturb(-vViewPosition, normal, vec2(dFdx(wq), dFdy(wq)));`)
        // 水自己帶一點光（和池塘一樣），夜裡流動的白色水紋映著月光
        .replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\ntotalEmissiveRadiance += diffuseColor.rgb * (0.2 + wRb * 0.5) + vec3(0.55, 0.7, 0.9) * foam * uNight * 0.45;');
    };
    water.customProgramCacheKey = () => 'plainWater';
    return (MT = { U, solid, water });
  }
  // 零件收集器（世界座標）：add(幾何, 顏色 或 (面法線 nx,ny,nz, 面中心 cx,cy,cz, 面編號) → 顏色, 矩陣, { sw 風吹（×離地高度²，同 windMat）, by 地面高度, ax/az 物件中心（同一棵樹一起擺）, gl 夜光 })
  function kit(fd = 0) {
    const parts = []; let nv = 0;
    const add = (geo, col, m, o = {}) => { const g = geo.index ? geo.toNonIndexed() : geo; if (g !== geo) geo.dispose(); if (m) g.applyMatrix4(m); parts.push([g, col, fd && !o.fd ? Object.assign({}, o, { fd }) : o]); nv += g.attributes.position.count; };
    const done = (mat, far, shadow) => {
      if (!nv) return null;
      const pos = new Float32Array(nv * 3), nor = new Float32Array(nv * 3), col = new Float32Array(nv * 3), fx = new Float32Array(nv * 4), fb = new Float32Array(nv * 2), c = new THREE.Color(), e1 = new THREE.Vector3(), e2 = new THREE.Vector3(), n = new THREE.Vector3(); let o = 0;
      for (const [g, cl, op0] of parts) {
        const p = g.attributes.position.array, k = p.length / 3, fixed = typeof cl === 'function' ? null : new THREE.Color(cl); pos.set(p, o * 3);
        let op = op0; if (op.ax == null) { let x0 = 1e9, x1 = -1e9, z0 = 1e9, z1 = -1e9, y0 = 1e9; for (let v = 0; v < p.length; v += 3) { x0 = Math.min(x0, p[v]); x1 = Math.max(x1, p[v]); y0 = Math.min(y0, p[v + 1]); z0 = Math.min(z0, p[v + 2]); z1 = Math.max(z1, p[v + 2]); } op = Object.assign({ by: y0 }, op, { ax: (x0 + x1) / 2, az: (z0 + z1) / 2 }); } // 沒有物件中心的零件（岩石、落葉）：用自己的外框中心與底部
        for (let v = 0; v < k; v++) { fb[(o + v) * 2] = op.by || 0; fb[(o + v) * 2 + 1] = op.fd || 0; }
        for (let f = 0; f < k; f += 3) {
          const i = f * 3; e1.set(p[i + 3] - p[i], p[i + 4] - p[i + 1], p[i + 5] - p[i + 2]); e2.set(p[i + 6] - p[i], p[i + 7] - p[i + 1], p[i + 8] - p[i + 2]); n.crossVectors(e1, e2).normalize();
          const fc = fixed || c.set(cl(n.x, n.y, n.z, (p[i] + p[i + 3] + p[i + 6]) / 3, (p[i + 1] + p[i + 4] + p[i + 7]) / 3, (p[i + 2] + p[i + 5] + p[i + 8]) / 3, f / 3));
          for (let v = f; v < f + 3; v++) { const j = (o + v) * 3, hh = Math.max(0, p[v * 3 + 1] - (op.by || 0)); col[j] = fc.r; col[j + 1] = fc.g; col[j + 2] = fc.b; nor[j] = n.x; nor[j + 1] = n.y; nor[j + 2] = n.z; fx.set([op.sw ? op.sw * hh * hh : 0, op.gl || 0, op.ax || 0, op.az || 0], (o + v) * 4); }
        }
        o += k; g.dispose();
      }
      const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.BufferAttribute(pos, 3)); geo.setAttribute('normal', new THREE.BufferAttribute(nor, 3)); geo.setAttribute('color', new THREE.BufferAttribute(col, 3)); geo.setAttribute('aFx', new THREE.BufferAttribute(fx, 4)); geo.setAttribute('aB', new THREE.BufferAttribute(fb, 2));
      geo.computeBoundingBox(); geo.computeBoundingSphere(); parts.length = 0; nv = 0;
      const m = new THREE.Mesh(geo, mat); m.receiveShadow = true; m.userData.plain = 1; return chunkObj(m, far, shadow);
    };
    return { add, done, n: () => nv };
  }
  // 在 (x, z) 擺一個物件：回傳 put(幾何, 顏色, 本地位置、旋轉、縮放, 覆寫選項)；本地 y＝離地高度，o.s 整個物件一起縮放
  function obj(k, x, z, o = {}) {
    const y = o.y != null ? o.y : H(x, z) + (o.dy || 0), B = M4(x, y, z, o.rx || 0, o.ry || 0, 0, o.s || 1), op = { sw: o.sw || 0, by: y, ax: x, az: z, gl: o.gl || 0 };
    return (geo, col, px = 0, py = 0, pz = 0, rx = 0, ry = 0, rz = 0, sx = 1, sy = sx, sz = sx, oo) => k.add(geo, col, B.clone().multiply(M4(px, py, pz, rx, ry, rz, sx, sy, sz)), oo ? Object.assign({}, op, oo) : op);
  }
  const blob = (s, d = 0) => jit(d ? new THREE.IcosahedronGeometry(1, 1) : new THREE.DodecahedronGeometry(1, 0), .3, s);
  // 岩石：朝上的面長苔、其餘每一面深淺不同（一面一個顏色）；sink＝埋進地面的比例
  const STONE = ['#8d948c', '#7f877f', '#9aa09a'];
  function rock(k, x, z, s, o = {}) {
    const seed = o.seed != null ? o.seed : Math.floor(hashN(x, z, 3) * 9973), base = new THREE.Color(o.c || STONE[seed % 3]), dark = base.clone().multiplyScalar(.84), lite = base.clone().multiplyScalar(1.08), moss = new THREE.Color(o.moss || '#6a9a4a'), mt = o.mt != null ? o.mt : .62;
    const y = (o.y != null ? o.y : H(x, z)) - s * (o.sink != null ? o.sink : .3);
    k.add(rk(seed, o.d || 0), (nx, ny, nz, cx, cy, cz, fi) => ny > mt ? moss : fi % 3 === 1 ? dark : fi % 3 === 2 ? lite : base, M4(x, y, z, o.rx || 0, o.ry != null ? o.ry : seed % 6.28, o.rz || 0, s * (o.sx || 1.15), s * (o.sy || .74), s * (o.sz || 1)));
    if (o.col !== false && s > .5) addCol({ x, z, r: s * (o.cr || .8) });
  }
  // 白樺：白色樹幹上一圈一圈的黑色橫紋、淡黃綠（或秋天的金黃）圓樹冠
  function birch(k, x, z, s, seed, gold) {
    const rd = seeded(seed), h = 3.3 + rd() * 1.4, a = obj(k, x, z, { s, ry: rd() * 6.28, sw: .0045, dy: -.1 }), C = gold ? ['#f3c84b', '#e9b13a', '#f8da6b'] : ['#a9d86b', '#8fc95a', '#c4e283'];
    // 樹皮的黑紋：一格（兩個三角形）一起上色，一圈裡只有相鄰的一兩格是黑的，才像白樺橫向的短紋（逐三角形上色會變成菱格）
    a(new THREE.CylinderGeometry(.09, .14, h, 6, 11), (nx, ny, nz, cx, cy, cz, fi) => { if (fi >= 132) return '#f2ede4'; const q = fi >> 1, col = Math.floor(q / 11), row = q % 11, r0 = hashN(row, seed, 5); return row > 0 && row < 10 && r0 < .62 && (col - Math.floor(r0 * 97) % 6 + 6) % 6 < 1 + (r0 < .2 ? 1 : 0) ? '#463e38' : '#f2ede4'; }, 0, h / 2, 0);
    a(new THREE.CylinderGeometry(.03, .05, .8, 4), '#f2ede4', .25, h * .7, .05, 0, 0, -.8);
    [[0, h + .2, 0, 1.05, 1], [.55, h - .4, .3, .74, 0], [-.5, h - .25, -.3, .8, 0], [.1, h + .8, -.15, .6, 0]].forEach(([px, py, pz, bs, d], i) => a(blob(seed * 7 + i, d), C[i % 3], px, py, pz, 0, i, 0, bs, bs * .9, bs));
    addCol({ x, z, r: .18 * s + .05, tree: 1 });
  }
  // 圓樹冠的闊葉樹（溪邊、山腳）
  function roundTree(k, x, z, s, seed, C = ['#5aa64b', '#4c9a45', '#6cb556']) {
    const rd = seeded(seed), h = 2.1 + rd() * .8, a = obj(k, x, z, { s, ry: rd() * 6.28, sw: .0045, dy: -.1 });
    a(new THREE.CylinderGeometry(.13, .22, h, 6), '#6b4d33', 0, h / 2, 0); a(new THREE.CylinderGeometry(.05, .08, .9, 5), '#6b4d33', .3, h * .82, .1, 0, 0, -.7);
    [[0, h + .55, 0, 1.25, 1], [.75, h + .2, .3, .9, 0], [-.7, h + .3, -.2, .95, 0], [.15, h + 1.1, -.35, .8, 0]].forEach(([px, py, pz, bs, d], i) => a(blob(seed * 5 + i, d), C[i % 3], px, py, pz, 0, i, 0, bs, bs * .85, bs));
    addCol({ x, z, r: .24 * s, tree: 1 });
  }
  // 松樹：三層圓錐，山脊上的帶一點雪
  function pine(k, x, z, s, seed, snow, col = true) {
    const rd = seeded(seed), a = obj(k, x, z, { s, ry: rd() * 6.28, sw: .0045, dy: -.15 }), G = ['#2f6b3f', '#3d8a4f', '#356f45'];
    a(new THREE.CylinderGeometry(.1, .17, 1.2, 5), '#5b4030', 0, .6, 0);
    [[1.05, 1.5, 1.3], [.82, 1.3, 2.05], [.58, 1.1, 2.7]].forEach(([r, hh, y], i) => { a(new THREE.ConeGeometry(r, hh, 7), G[i], 0, y, 0, 0, i * .4, 0); if (snow) a(new THREE.ConeGeometry(r * .8, hh * .4, 7), '#f4f8fb', 0, y + hh * .32, 0, 0, i * .4 + .2, 0); });
    if (col) addCol({ x, z, r: .2 * s, tree: 1 });
  }
  function shrub(k, x, z, s, seed, berry) {
    const a = obj(k, x, z, { s, ry: seed, sw: .05, dy: -.05 }), C = ['#4f9a45', '#3f8a3d', '#5aa64e'];
    [[0, .38, 0, .62], [.42, .3, .12, .46], [-.36, .3, -.12, .5]].forEach(([px, py, pz, bs], i) => a(blob(seed + i), C[i], px, py, pz, 0, i, 0, bs, bs * .82, bs));
    if (berry) for (let i = 0; i < 6; i++) a(new THREE.IcosahedronGeometry(.06, 0), berry, Math.cos(i * 2.4) * .45, .35 + (i % 3) * .14, Math.sin(i * 2.4) * .45);
  }
  function fern(k, x, z, s, seed, gl = 0) {
    const a = obj(k, x, z, { s, ry: seed, sw: .14, dy: -.02, gl });
    for (let i = 0; i < 7; i++) { const l = new THREE.ConeGeometry(.11, 1, 3, 1, true); l.translate(0, .5, 0); a(l, gl ? (i % 2 ? '#3fa58e' : '#4f9fb0') : (i % 2 ? '#3f8f4a' : '#52a75c'), 0, 0, 0, 0, i / 7 * PI2 + .3, 1 + (i % 3) * .12, 1, .9 + (i % 2) * .2, .25); }
  }
  function reeds(k, x, z, s, seed, y) {
    const a = obj(k, x, z, { s, y, sw: .12 });
    for (let i = 0; i < 6; i++) { const h = 1.05 + (i % 3) * .25, an = i * 1.7 + seed; a(new THREE.ConeGeometry(.03, h, 3, 1, true), i % 2 ? '#7c8c3a' : '#8fa048', Math.cos(an) * .16, h / 2, Math.sin(an) * .16, Math.cos(i) * .08, 0, Math.sin(i) * .08); if (i % 3 === 0) a(new THREE.CylinderGeometry(.04, .04, .22, 5), '#6b4423', Math.cos(an) * .16 + Math.sin(i) * .04, h - .1, Math.sin(an) * .16); }
  }
  // 一叢花（同一叢一兩種顏色，遠看才是一片一片的色塊）
  const FLW = new THREE.IcosahedronGeometry(1, 0);
  function flowers(k, x, z, n, rad, cols, seed) {
    const rd = seeded(seed);
    for (let i = 0; i < n; i++) {
      const a0 = rd() * 6.28, r = Math.sqrt(rd()) * rad, fx = x + Math.cos(a0) * r, fz = z + Math.sin(a0) * r; if (onPath(fx, fz) > .05) continue;
      const h = .17 + rd() * .15, a = obj(k, fx, fz, { ry: rd() * 6.28, sw: .3, dy: -.02, gl: cols.gl || 0 });
      a(new THREE.CylinderGeometry(.012, .016, h, 3, 1, true), '#4f8a3f', 0, h / 2, 0, 0, 0, 0, 1, 1, 1, { gl: 0 });
      a(FLW.clone(), cols[i % cols.length], 0, h, 0, (rd() - .5) * .5, rd() * 2, 0, .1, .05, .1); // 扁扁的二十面體當花冠：平視時不會只剩一根莖
      a(new THREE.CircleGeometry(.036, 4), cols.c || '#fbbf24', 0, h + .046, 0, -Math.PI / 2, 0, 0);
    }
  }
  function shroom(k, x, z, s, cap, gl = 0) {
    const a = obj(k, x, z, { s, dy: -.01, gl });
    a(new THREE.CylinderGeometry(.045, .06, .26, 5, 1, true), '#f3ece0', 0, .13, 0, 0, 0, 0, 1, 1, 1, { gl: gl * .12 });
    a(new THREE.SphereGeometry(.15, 7, 3, 0, PI2, 0, Math.PI / 2), cap, 0, .24, 0, 0, 0, 0, 1, .72, 1);
  }
  // 落葉：貼在地面的小菱形
  function leaves(k, x, z, rad, n, cols, seed) {
    const rd = seeded(seed);
    for (let i = 0; i < n; i++) { const a0 = rd() * 6.28, r = Math.sqrt(rd()) * rad, lx = x + Math.cos(a0) * r, lz = z + Math.sin(a0) * r; if (onPath(lx, lz) > .1) continue; k.add(new THREE.CircleGeometry(.09 + rd() * .05, 4), cols[i % cols.length], M4(lx, H(lx, lz) + .03, lz, -Math.PI / 2 + (rd() - .5) * .3, 0, rd() * 6.28, 1, .62, 1)); }
  }
  // 兩點之間的一根圓木（倒木、樹根、欄杆）
  function seg(k, a, b, r, col, n = 6, r1 = r, o) { const d = new THREE.Vector3().subVectors(b, a), L = d.length(); k.add(new THREE.CylinderGeometry(r1, r, L, n), col, new THREE.Matrix4().compose(new THREE.Vector3().addVectors(a, b).multiplyScalar(.5), new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.normalize()), new THREE.Vector3(1, 1, 1)), o); }
  const V3 = (x, y, z) => new THREE.Vector3(x, y, z);
  const GLOWC = ['#38bdf8', '#818cf8', '#2dd4bf', '#c084fc']; // 夜光蘑菇的菇傘

  // 東西能不能擺在這裡（世界座標）：不壓小徑、不進小場景、不擋洞口與裂縫、不碰計程車走廊、不和既有的樹石重疊
  const KEEP_OBJ = [[45, 0, 12], [0, -45, 12], [-45, 0, 12], [7, 45, 11.5], [30, 22, 6], [-28, -28, 7], ...KEEP.filter(q => q[2] === 2.2).map(q => [q[0], q[1], 2.6])];
  function okAt(x, z, r = .8, wet = false) {
    const bx = x / K, bz = z / K;
    for (let a = 0; a < 5; a++) if (onPath(a ? x + Math.cos(a * 1.571) * r : x, a ? z + Math.sin(a * 1.571) * r : z) > .03) return false;
    if (nookAvoid(x, z) || (bx < -2 && bz > 3 && taxiD(bx, bz) < 6.3)) return false;
    for (const [kx, kz, r0] of KEEP_OBJ) if ((bx - kx) ** 2 + (bz - kz) ** 2 < (r0 + r / K) ** 2) return false;
    if (!wet && nearCreek(bx, bz) && water(bx, bz).sd < r / K + .12) return false;
    for (const c of colsNear(x, z)) { const d = c.box ? Math.hypot(x - clamp(x, c.box[0], c.box[2]), z - clamp(z, c.box[1], c.box[3])) : Math.hypot(x - c.x, z - c.z) - c.r; if (d < r) return false; }
    return true;
  }
  const flat = (x, z, r = 1) => Math.abs(H(x + r, z) - H(x - r, z)) + Math.abs(H(x, z + r) - H(x, z - r)) < .9 * r; // 坡度不大

  /* ---------- 東南：瀑布、瀑布潭、小溪、溪尾小水潭 ---------- */
  const WF = { x: 31.4, z0: 39.9, z1: 53.3, lips: [49.4, 46.6] }; // 瀑布（基礎單位）：從山脊頂的缺口一路沿著山壁流進瀑布潭，中途兩道岩階
  const wfx = z => WF.x + .22 * Math.sin(z * .8 + 1);
  const wfW = z => 1 + 1.05 * sm(53.3, 47.5, z) - .55 * sm(46.5, 43.5, z) + .3 * sm(41.2, 39.9, z); // 瀑布的半寬（公尺）：山壁上那段要寬，從工坊遠遠就看得到；山腳那段收成一道急流，進潭前再散開
  const wfLift = z => .3 + WF.lips.reduce((a, zl) => a + .55 * Math.exp(-(((z - zl) / .32) ** 2)), 0); // 水面離山壁的高度（岩階處把水推出去）
  function buildWater(wk) {
    const P = [], C = [], UV = [], SP = [], I = []; let n = 0; const c = new THREE.Color();
    const v = (x, y, z, col, a, u, w, sp) => { c.set(col); P.push(x, y, z); C.push(c.r, c.g, c.b, a); UV.push(u, w); SP.push(sp); return n++; };
    const ribbon = secs => { for (let i = 0; i < secs.length - 1; i++) { const A = secs[i], B = secs[i + 1]; for (let j = 0; j < A.length - 1; j++) I.push(A[j], B[j], A[j + 1], A[j + 1], B[j], B[j + 1]); } };
    // 兩個水潭：中心深、岸邊淺
    for (const p of [POOL, TAIL]) {
      const cx = p.x * K, cz = p.z * K, c0 = v(cx, p.s, cz, '#1f6a7c', .9, cx * .25, cz * .25, .12), RING = 30, rows = [];
      for (const k of [.55, 1.04]) { const row = []; for (let i = 0; i <= RING; i++) { const a = i / RING * PI2, R = poolR(p, a) * K * k, x = cx + Math.cos(a) * R, z = cz + Math.sin(a) * R; row.push(v(x, p.s, z, k < 1 ? '#2c8494' : '#7ccbc8', k < 1 ? .86 : .6, x * .25, z * .25, .12)); } rows.push(row); }
      for (let i = 0; i < RING; i++) I.push(c0, rows[0][i + 1], rows[0][i]); ribbon([rows[1], rows[0]]); // 外圈由外往內接，三角形和中間的扇形同一面朝上（共用頂點的法線才不會互相抵消）
    }
    // 小溪：沿中線一段一段往下游，寬度跟著 creekW；兩端淡出，疊在水潭上不會一塊特別深
    { const Cp = creekPts().p, secs = []; let acc = 0;
      for (let i = 0; i < Cp.length; i += 2) {
        const [x, z, t] = Cp[i], j0 = Math.max(0, i - 2), j1 = Math.min(Cp.length - 1, i + 2), fx = Cp[j1][0] - Cp[j0][0], fz = Cp[j1][1] - Cp[j0][1], fl = Math.hypot(fx, fz) || 1, rx = fz / fl, rz = -fx / fl;
        if (i) acc += Math.hypot(x - Cp[i - 2][0], z - Cp[i - 2][1]) * K;
        const hw = (creekW(t) + .22) * K, s = POOL.s + (TAIL.s - POOL.s) * t + .015, X = x * K, Z = z * K, fade = sm(0, .05, t) * (1 - sm(.95, 1, t));
        secs.push([-1, -.45, 0, .45, 1].map(u => v(X + rx * hw * u, s, Z + rz * hw * u, Math.abs(u) > .9 ? '#7ccbc8' : u ? '#3592a0' : '#25788c', (Math.abs(u) > .9 ? .55 : .88) * fade, (u + 1) / 2, acc, .9))); // 中間深、兩岸淺
      }
      ribbon(secs); }
    // 瀑布：從山脊頂往下，貼著山壁（每一點都在地面之上），越往下越寬；最下面淡進瀑布潭
    { const secs = []; let acc = 0, prev = null;
      for (let z = WF.z1; z >= WF.z0 - 1e-6; z -= .12) {
        const hw = wfW(z), X = wfx(z) * K, Z = z * K, L = wfLift(z), cy = Math.max(H(X, Z) + L, POOL.s + .03);
        if (prev) acc += Math.hypot(X - prev[0], cy - prev[1], Z - prev[2]); prev = [X, cy, Z];
        const end = sm(WF.z0, WF.z0 + .6, z);
        secs.push([-1, -.5, 0, .5, 1].map(u => { const x = X + u * hw; return v(x, Math.max(H(x, Z) + L * (1 - .3 * Math.abs(u)), POOL.s + .03), Z, Math.abs(u) > .7 ? '#bfe9f0' : '#e2f6f9', (Math.abs(u) > .7 ? .62 : .9) * end, (u + 1) / 2, acc, 3.2); }));
      }
      ribbon(secs); }
    // 彩虹：瀑布潭上方的水霧裡，白天淡淡的一道（只有從北邊、平地這一側看得到正面）
    { const cx = WF.x * K, cz = 41.4 * K, cy = .6, R0 = 4.2, B = ['#f87171', '#fb923c', '#fde047', '#86efac', '#7dd3fc', '#a78bfa'], N = 24, rows = [];
      for (let b = 0; b <= B.length; b++) { const row = [], r = R0 + b * .16; for (let i = 0; i <= N; i++) { const a = .18 * Math.PI + i / N * .64 * Math.PI, e = Math.sin(i / N * Math.PI); row.push(v(cx + Math.cos(a) * r, cy + Math.sin(a) * r, cz, B[Math.min(B.length - 1, b)], .42 * e * e, 0, 0, -1)); } rows.push(row); }
      for (let b = 0; b < B.length; b++) for (let i = 0; i < N; i++) { const a0 = rows[b][i], a1 = rows[b][i + 1], b0 = rows[b + 1][i], b1 = rows[b + 1][i + 1]; I.push(a0, b0, a1, a1, b0, b1); } }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3)); g.setAttribute('color', new THREE.Float32BufferAttribute(C, 4)); g.setAttribute('uv', new THREE.Float32BufferAttribute(UV, 2)); g.setAttribute('aSpd', new THREE.Float32BufferAttribute(SP, 1)); g.setIndex(I); g.computeVertexNormals(); g.computeBoundingSphere();
    const m = new THREE.Mesh(g, wk); m.renderOrder = 1; m.userData.plain = 1; return chunkObj(m, 230, false);
  }
  function buildCreek(ks, kf) {
    const rd = seeded(311), PK = POOL.x * K, PZ = POOL.z * K;
    // 瀑布兩側的濕岩石（越下面越大）、岩階下的白色水花、源頭的岩縫
    for (let z = 41; z < 46.6; z += .62) {
      const hw = wfW(z) / K, k = (z - 41) / 5.6;
      [-1, 1].forEach(sd => { if (rd() < .15) return; const x = (wfx(z) + sd * (hw + .3 + rd() * .35)) * K, Z = (z + (rd() - .5) * .3) * K; rock(ks, x, Z, .75 + (1 - k) * .45 + rd() * .3, { c: '#7a817a', moss: '#5d8f45', sink: .4, col: false, mt: .6 }); });
    }
    WF.lips.forEach((zl, i) => { // 岩階下的白色水花
      for (let j = 0; j < 4; j++) { const x = (wfx(zl - .4) + (j - 1.5) * .3) * K, z = (zl - .42) * K; const y = H(x, z) + wfLift(zl - .42) + .05; ks.add(blob(900 + i * 9 + j), '#f4fbff', M4(x, y, z, 0, j, 0, .32 + (j % 2) * .1, .2, .3), { sw: .5, by: y - .3, ax: x, az: z }); }
    });
    [[-.75, .1], [.7, -.1], [0, .7]].forEach(([dx, dz], i) => rock(ks, (wfx(WF.z1) + dx) * K, (WF.z1 + dz) * K, .9 + i * .1, { c: '#a3aaa8', moss: '#eef2f6', sink: .35, col: false, mt: .5 })); // 源頭：雪線上的岩縫
    // 瀑布潭：落水處的水花、岸邊圓石、西岸一塊可以坐的大平石、東岸夜裡發光的蘑菇與蕨類、蘆葦
    for (let j = 0; j < 7; j++) { const a = j / 7 * PI2, r = .35 + (j % 3) * .25, x = WF.x * K + Math.cos(a) * r * 1.4, z = (WF.z0 + .5) * K + Math.sin(a) * r; ks.add(blob(930 + j), '#f4fbff', M4(x, POOL.s + .06, z, 0, j, 0, .45 - (j % 3) * .08, .22, .42), { sw: .5, by: POOL.s - .3, ax: x, az: z }); }
    for (let i = 0; i < 13; i++) { const a = i / 13 * PI2 + rd() * .3; if (Math.abs(wrapA(a - Math.PI / 2)) < .55) continue; const R = poolR(POOL, a) * K + .2 + rd() * .4, x = PK + Math.cos(a) * R, z = PZ + Math.sin(a) * R; rock(ks, x, z, .32 + rd() * .3, { sink: .35, col: false, mt: .85 }); }
    { const a = Math.PI + .15, R = poolR(POOL, a) * K + 1.5, x = PK + Math.cos(a) * R, z = PZ + Math.sin(a) * R; rock(ks, x, z, 1.15, { sy: .45, sink: .25, seed: 77, moss: '#7aa85a', mt: .7 }); }
    for (let i = 0; i < 6; i++) { const a = -.7 + i * .28 + rd() * .1, R = poolR(POOL, a) * K + 1 + rd() * 1.2, x = PK + Math.cos(a) * R, z = PZ + Math.sin(a) * R; shroom(kf, x, z, 1 + rd() * .5, GLOWC[i % 4], 1); }
    for (let i = 0; i < 7; i++) { const a = 2.3 + i * .55 + rd() * .2, R = poolR(POOL, a) * K + 1.3 + rd() * 1.4, x = PK + Math.cos(a) * R, z = PZ + Math.sin(a) * R; if (okAt(x, z, .3)) fern(kf, x, z, .7 + rd() * .3, i * 3, i % 3 ? 0 : .7); }
    { const a = -2.1, R = poolR(POOL, a) * K + .3; reeds(kf, PK + Math.cos(a) * R, PZ + Math.sin(a) * R, 1, 3, POOL.s - .15); }
    const Cp = creekPts().p; let run = 0;
    // 小木橋：一座平平的木板橋（橋下是淺灘，見 water() 的 D），兩邊有欄杆（碰撞），兩頭各墊兩塊石頭
    { const i = Math.round(Cp.length * BR.t), [x, z, t] = Cp[i], fx = Cp[i + 3][0] - Cp[i - 3][0], fz = Cp[i + 3][1] - Cp[i - 3][1], fl = Math.hypot(fx, fz), ux = fx / fl, uz = fz / fl, rx = uz, rz = -ux;
      const s = POOL.s + (TAIL.s - POOL.s) * t, X = x * K, Z = z * K, Ls = (creekW(t) + 1.15) * K, y = s + .16, ry = Math.atan2(-rz, rx), PL = ['#b08458', '#a07850', '#c09068'];
      Object.assign(BR, { X, Z, rx, rz, Ls, y });
      for (let u = -Ls, n = 0; u <= Ls; u += .32, n++) ks.add(new THREE.BoxGeometry(.29, .07, 1.5), PL[n % 3], M4(X + rx * u, Math.max(y, H(X + rx * u, Z + rz * u) + .05) - .035 + (n % 2) * .008, Z + rz * u, 0, ry + (hashN(n, 3, 7) - .5) * .04, 0));
      [-1, 1].forEach(e => {
        ks.add(new THREE.BoxGeometry(2 * Ls + .3, .13, .13), '#7a5a3c', M4(X + ux * e * .55, y - .14, Z + uz * e * .55, 0, ry, 0));
        let prev = null;
        for (const k of [-.97, -.33, .33, .97]) { const px = X + rx * Ls * k + ux * e * .78, pz = Z + rz * Ls * k + uz * e * .78, p = V3(px, Math.max(y, H(px, pz)), pz); seg(ks, V3(px, p.y - .25, pz), V3(px, p.y + .8, pz), .055, '#6b4d33', 6); if (prev) { seg(ks, V3(prev.x, prev.y + .74, prev.z), V3(px, p.y + .74, pz), .04, '#8b6544', 6); seg(ks, V3(prev.x, prev.y + .4, prev.z), V3(px, p.y + .4, pz), .03, '#8b6544', 5); } prev = p; }
        for (let u = -Ls; u <= Ls; u += .45) addCol({ x: X + rx * u + ux * e * .8, z: Z + rz * u + uz * e * .8, r: .1 }); // 欄杆：走在橋上不會從旁邊穿出去
        [-1, 1].forEach(sd => rock(ks, X + rx * sd * (Ls + .25) + ux * e * .95, Z + rz * sd * (Ls + .25) + uz * e * .95, .42, { sink: .4, col: false, mt: .8, seed: 880 + (e + 1) * 2 + (sd + 1) / 2 }));
      }); }
    // 溪岸：水邊的石頭（三五顆一組）、彎道內側的蘆葦、稍遠一點的蕨類與藍色小花
    for (let i = 8; i < Cp.length - 8; i += 3) {
      const [x, z, t] = Cp[i], fx = Cp[i + 3][0] - Cp[i - 3][0], fz = Cp[i + 3][1] - Cp[i - 3][1], fl = Math.hypot(fx, fz), rx = fz / fl, rz = -fx / fl, w = creekW(t), bend = (Cp[i + 3][0] - 2 * x + Cp[i - 3][0]) * rx + (Cp[i + 3][1] - 2 * z + Cp[i - 3][1]) * rz;
      run = (run + 1) % 7; if (run > 4 || Math.abs(t - BR.t) < .05) continue; // 小木橋兩頭留空
      [-1, 1].forEach(sd => {
        const sX = (x + rx * sd * (w + .12 + rd() * .2)) * K, sZ = (z + rz * sd * (w + .12 + rd() * .2)) * K; if (rd() < .6) rock(ks, sX, sZ, .22 + rd() * .26, { sink: .4, col: false, seed: i * 2 + (sd > 0 ? 1 : 0), mt: 1.1, c: ['#a7aca4', '#959b93', '#b6bab2'][i % 3] });
        if (bend * sd > .01 && rd() < .45) { const s = POOL.s + (TAIL.s - POOL.s) * t; reeds(kf, (x + rx * sd * (w - .1)) * K, (z + rz * sd * (w - .1)) * K, .85 + rd() * .3, i, s - .2); }
        if (bend * sd > .012 && rd() < .6) { // 彎道內側的小沙洲：順著水流的淺色長橢圓，上面幾顆白色、灰色的小卵石
          const s = POOL.s + (TAIL.s - POOL.s) * t, gx = (x + rx * sd * (w + .12)) * K, gz = (z + rz * sd * (w + .12)) * K, rz0 = Math.atan2(-fz, fx), L = .9 + rd() * .5;
          kf.add(new THREE.CircleGeometry(1, 8), i % 2 ? '#d6c8a4' : '#cdbf9b', M4(gx, Math.max(H(gx, gz), s + .03) + .03, gz, -Math.PI / 2, 0, rz0, L, .45 + rd() * .15, 1));
          for (let j = 0; j < 4; j++) { const u = (rd() - .5) * 1.4 * L, px = gx + fx / fl * u + rx * sd * (rd() - .5) * .4, pz = gz + fz / fl * u + rz * sd * (rd() - .5) * .4, r = .06 + rd() * .07; kf.add(new THREE.DodecahedronGeometry(r, 0), j % 2 ? '#e7e5e4' : '#a8a29e', M4(px, Math.max(H(px, pz), s + .03) + r * .4, pz, rd(), rd() * 3, 0, 1, .6, 1)); }
        }
        const fX = (x + rx * sd * (w + 1.1 + rd() * 1.4)) * K, fZ = (z + rz * sd * (w + 1.1 + rd() * 1.4)) * K; if (rd() < .3 && okAt(fX, fZ, .4)) fern(kf, fX, fZ, .65 + rd() * .35, i + sd);
      });
    }
    [[.3, -1], [.55, 1], [.68, -1], [.82, 1]].forEach(([tt, sd], j) => { const i = Math.round(Cp.length * tt), [x, z, t] = Cp[i], fx = Cp[i + 3][0] - Cp[i - 3][0], fz = Cp[i + 3][1] - Cp[i - 3][1], fl = Math.hypot(fx, fz), o = creekW(t) + .9, X = (x + fz / fl * sd * o) * K, Z = (z - fx / fl * sd * o) * K; if (okAt(X, Z, .5)) glowBells(kf, X, Z, LOW ? 4 : 6, 330 + j); }); // 溪岸的夜光鈴蘭：夜裡沿著水邊一叢一叢亮著
    // 倒在溪上的一根老木頭（苔蘚、兩朵小蘑菇）：兩頭架在岸上
    { const i = Math.round(Cp.length * .22), [x, z, t] = Cp[i], fx = Cp[i + 3][0] - Cp[i - 3][0], fz = Cp[i + 3][1] - Cp[i - 3][1], fl = Math.hypot(fx, fz), rx = fz / fl, rz = -fx / fl, L = (creekW(t) + 1.5) * K;
      const ax = x * K - rx * L, az = z * K - rz * L, bx = x * K + rx * L, bz = z * K + rz * L, a = V3(ax, H(ax, az) + .22, az), b = V3(bx, H(bx, bz) + .3, bz);
      seg(ks, a, b, .3, '#6b4d33', 8, .27); [[a, -.1], [b, .1]].forEach(([p]) => ks.add(new THREE.CircleGeometry(.29, 8), '#c8a27a', new THREE.Matrix4().lookAt(p, a === p ? b : a, V3(0, 1, 0)).setPosition(p)));
      for (let j = 0; j < 3; j++) { const k = .25 + j * .25, p = a.clone().lerp(b, k); ks.add(new THREE.SphereGeometry(.33, 7, 3, 0, PI2, 0, Math.PI / 2), '#5b8f3e', M4(p.x, p.y + .2, p.z, 0, Math.atan2(rx, rz), 0, .9, .32, 1.6)); }
      [.62, .7].forEach((k, j) => { const p = a.clone().lerp(b, k), m = obj(kf, p.x + (j - .5) * .12, p.z, { y: p.y + .22, s: .7 - j * .2 }); m(new THREE.CylinderGeometry(.045, .06, .2, 5, 1, true), '#f3ece0', 0, .1, 0); m(new THREE.SphereGeometry(.15, 7, 3, 0, PI2, 0, Math.PI / 2), '#e5484d', 0, .19, 0, 0, 0, 0, 1, .72, 1); }); // 木頭背上的兩朵小紅菇
      for (let j = 0; j <= 6; j++) { const p = a.clone().lerp(b, j / 6); addCol({ x: p.x, z: p.z, r: .38 }); } }
    // 踏腳石：巨樹東邊，五顆平平的大石頭橫過溪面（站上去的時候會走過溪床，石頭是給眼睛看的路線）
    STEP.list = [];
    { const i = Math.round(Cp.length * .58), [x, z, t] = Cp[i], fx = Cp[i + 3][0] - Cp[i - 3][0], fz = Cp[i + 3][1] - Cp[i - 3][1], fl = Math.hypot(fx, fz), rx = fz / fl, rz = -fx / fl, s = POOL.s + (TAIL.s - POOL.s) * t;
      Object.assign(STEP, { x: x * K, z: z * K, rx, rz, w: creekW(t) * K });
      [-1.9, -.95, 0, .95, 1.9].forEach((o, j) => { const X = x * K + rx * o + rz * (j % 2 ? .18 : -.12), Z = z * K + rz * o - rx * (j % 2 ? .18 : -.12); rock(ks, X, Z, .48, { y: Math.max(H(X, Z) - .05, s - .05), sy: .32, sink: 0, col: false, moss: '#9aa09a', mt: .9, seed: 600 + j }); }); } // 石面高出水面約 10 公分
    // 溪邊的樹：大多在東岸（西岸是巨樹的地方），三五棵成群
    [[.08, 1, 2.8], [.16, 1, 3.4], [.36, 1, 2.6], [.47, 1, 3.6], [.74, 1, 2.6], [.86, -1, 3], [.27, -1, 3.2], [.93, 1, 3.2]].forEach(([tt, side, off], j) => {
      const i = Math.min(Cp.length - 4, Math.max(3, Math.round(Cp.length * tt))), [x, z, t] = Cp[i], fx = Cp[i + 3][0] - Cp[i - 3][0], fz = Cp[i + 3][1] - Cp[i - 3][1], fl = Math.hypot(fx, fz), rx = fz / fl, rz = -fx / fl;
      const e = rx < 0 ? -1 : 1, X = (x + rx * e * side * (creekW(t) + off)) * K, Z = (z + rz * e * side * (creekW(t) + off)) * K; // side 1＝東岸（x 較大的一側）
      if (Math.max(Math.abs(X), Math.abs(Z)) / K < 41 && okAt(X, Z, 1.2) && [-1, 1].every(e => Math.hypot(X - BR.X - BR.rx * BR.Ls * e, Z - BR.Z - BR.rz * BR.Ls * e) > 2.6 * K)) { if (j % 3 === 2) pine(ks, X, Z, 1 + rd() * .2, 70 + j); else roundTree(ks, X, Z, .95 + rd() * .3, 50 + j, j % 2 ? ['#5aa64b', '#4c9a45', '#6cb556'] : ['#6fb35a', '#5fa64f', '#82c46a']); }
    });
    // 溪邊草地的花：藍色勿忘我、白色雛菊、粉紅色
    [[34.8, 27.5, ['#93c5fd', '#bfdbfe']], [33.2, 36.6, ['#f8fafc', '#fef9c3']], [40, 19.5, ['#f9a8d4', '#fbcfe8']], [33.5, 21.5, ['#c4b5fd', '#ddd6fe']]].forEach(([x, z, c], j) => { if (!LOW || j % 2 === 0) flowers(kf, x * K, z * K, LOW ? 9 : 16, 2.2, c, 70 + j); });
    // 溪尾小水潭：睡蓮與一朵蓮花、岸邊圓石、蘆葦、樹樁椅、三隻黃色小鴨
    { const cx = TAIL.x * K, cz = TAIL.z * K, wy = TAIL.s;
      for (let i = 0; i < 6; i++) { const a = rd() * PI2, r = (.25 + rd() * .5) * poolR(TAIL, a) * K, s = .28 + rd() * .22; kf.add(new THREE.CylinderGeometry(s, s, .03, 10, 1, false, .35, PI2 - .7), ['#3f8f45', '#5aa64e', '#6dbb5c'][i % 3], M4(cx + Math.cos(a) * r, wy + .02, cz + Math.sin(a) * r, 0, rd() * PI2, 0)); }
      { const x = cx - 1.2, z = cz + .8; for (let k = 0; k < 6; k++) { const b = k / 6 * PI2; kf.add(new THREE.SphereGeometry(.06, 6, 4), k % 2 ? '#f9a8d4' : '#fdf2f8', M4(x + Math.cos(b) * .06, wy + .09, z + Math.sin(b) * .06, 0, -b, .65, 2.1, .7, 1)); } kf.add(new THREE.SphereGeometry(.04, 6, 4), '#facc15', M4(x, wy + .11, z)); }
      for (let i = 0; i < 11; i++) { const a = i / 11 * PI2 + rd() * .3, R = poolR(TAIL, a) * K + .15 + rd() * .45, x = cx + Math.cos(a) * R, z = cz + Math.sin(a) * R; if (water(x / K, z / K).sd < -.05 && Math.abs(wrapA(a - Math.atan2(Cp[Cp.length - 1][1] - TAIL.z, Cp[Cp.length - 1][0] - TAIL.x))) < .5) continue; rock(ks, x, z, .28 + rd() * .3, { sink: .35, col: false, mt: .85 }); }
      [[-2.3, 1.6], [1.4, -2.2]].forEach(([a, k]) => { const R = poolR(TAIL, a) * K * .92; reeds(kf, cx + Math.cos(a) * R, cz + Math.sin(a) * R, 1.05, k * 3, wy - .2); });
      { const a = Math.PI + .5, R = poolR(TAIL, a) * K + 1.6, x = cx + Math.cos(a) * R, z = cz + Math.sin(a) * R, s = obj(ks, x, z, { dy: -.05 }); s(new THREE.CylinderGeometry(.36, .42, .5, 9), '#7a5a3c', 0, .25, 0); s(new THREE.CylinderGeometry(.35, .35, .02, 9), '#c8a27a', 0, .51, 0); s(new THREE.CylinderGeometry(.2, .2, .025, 9), '#a07850', 0, .515, 0); addCol({ x, z, r: .45 }); }
      // 小鴨：一隻大的帶兩隻小的排成一列，跟著水波輕輕晃
      const duck = (x, z, s, ry) => { const d = obj(kf, x, z, { y: wy, s, ry, sw: .35 }); d(new THREE.SphereGeometry(.2, 8, 6), '#fde047', 0, .1, 0, 0, 0, 0, 1, .72, 1.3); d(new THREE.SphereGeometry(.12, 8, 6), '#fde047', 0, .3, .17); d(new THREE.ConeGeometry(.045, .12, 6), '#fb923c', 0, .28, .32, Math.PI / 2); d(new THREE.ConeGeometry(.06, .14, 4), '#facc15', 0, .17, -.27, -2.2); [-1, 1].forEach(e => d(new THREE.SphereGeometry(.022, 5, 4), '#1f2937', e * .075, .33, .26)); };
      duck(cx + .9, cz - .5, 1, -2.4); duck(cx + 1.45, cz - .05, .58, -2.2); duck(cx + 1.9, cz + .35, .55, -2.5);
    }
  }
  const STEP = { list: [] }; // 踏腳石的位置（彩蛋：從一岸踩到另一岸）
  const SNOW = { x: 17.5, z: 54 }; // 山脊頂的雪地小家族（基礎單位）：從台地的望遠鏡看過去，視線剛好擦過巨樹樹冠的西邊

  /* ---------- 南面山壁：山脊上的松樹線、山壁下緣的岩脈、山腳的樹與灌木（只放物件，不動地形） ---------- */
  function buildSouthFace(kSE, kSW) {
    const rd = seeded(421), kAt = x => x > 0 ? kSE : kSW, crack = (x, z) => Math.hypot(x - 7, z - 45) < 11.2, wfZone = (x, z) => Math.abs(x - WF.x) < 3.3 && z > 39, taxi = (x, z) => x > -29.5 && x < -10.5 && z < 47.5; // 計程車隧道口的頭牆＋翼牆約 x −28～−12
    // 山脊頂：三五棵一群的雪松，群與群之間留空
    for (let x = -40; x <= 40; x += LOW ? 3.4 : 2.4) {
      if (vnoise(x * .22, 3.7, 5) < .4) continue;
      for (let j = 0; j < (rd() < .5 ? 2 : 1); j++) { const bx = x + (rd() - .5) * 1.6, bz = 53.6 + rd() * 2.2; if (crack(bx, bz) || wfZone(bx, bz) || Math.hypot(bx - SNOW.x, bz - SNOW.z) < 4.5) continue; const X = bx * K, Z = bz * K; if (okAt(X, Z, 1)) pine(kAt(bx), X, Z, 1.05 + rd() * .5, 1000 + x * 7 + j, true, false); } // 雪地小家族旁邊不種樹（望遠鏡要看得到）
    }
    // 山脊頂的雪地小家族：三隻雪白的小史萊姆排排坐、看著山谷（從平地看只是三個小白點，要用台地上的望遠鏡才看得清楚；夜裡會微微發光）
    { let zt = SNOW.z, ht = -1e9; for (let zz = 52; zz < 56.5; zz += .1) { const h = H(SNOW.x * K, zz * K); if (h > ht) { ht = h; zt = zz; } } // 坐在稜線靠山谷這一側：從台地看過去不會被稜線擋住下半身
      const X = SNOW.x * K, Z = (zt - .45) * K, y = H(X, Z); Object.assign(SNOW, { X, Z, Y: y });
      [[-1.5, 0, 1.4], [0, .3, 1.1], [1.3, .05, .9]].forEach(([dx, dz, sc], i) => { const a = obj(kSE, X + dx, Z + dz, { s: sc, ry: Math.PI + (i - 1) * .25, dy: -.14, gl: .45 });
        a(new THREE.SphereGeometry(.5, 10, 7), i === 1 ? '#e0f2fe' : '#f8fafc', 0, .34, 0, 0, 0, 0, 1, .72, 1); a(new THREE.SphereGeometry(.1, 6, 4), '#ffffff', -.17, .55, .3, 0, 0, 0, 1.3, .8, .6);
        [-1, 1].forEach(e => { a(new THREE.SphereGeometry(.055, 6, 4), '#1f2937', e * .15, .43, .43, 0, 0, 0, 1, 1.25, .6, { gl: 0 }); a(new THREE.SphereGeometry(.06, 6, 4), '#fda4af', e * .27, .35, .4, 0, 0, 0, 1, .55, .35); }); });
      const f = obj(kSE, X + 2.5, Z + .4, { dy: -.1, s: 1.3 }); f(new THREE.CylinderGeometry(.025, .03, 1.5, 4), '#6b4d33', 0, .75, 0); f(new THREE.CylinderGeometry(.3, .3, .02, 3), '#ef4444', .26, 1.32, 0, Math.PI / 2, 0, 0, 1, 1, .55);
    } // 山脊本來就是白的，不另外墊雪堆（平放或順著坡傾斜，從台地仰望都像一片浮在半空的白盤子）
    // 山壁中段的松樹線（約 11～15 m 的等高線上，三五棵一群，比山脊頂的小）。山壁本身的橫紋就是岩層，不另外貼岩板：
    // 陡壁上的岩板不管平放還是順著坡躺，遠看都像黏在牆上的盤子。月光裂縫、瀑布、計程車隧道口附近都不放
    const zAt = (x, y) => { for (let z = 44; z < 54; z += .1) if (H(x * K, z * K) >= y) return z; return null; };
    for (let x = -38; x <= 38; x += LOW ? 3.2 : 2.2) {
      if (vnoise(x * .19, 7.7, 29) < .5) continue; const bx = x + (rd() - .5) * 1.2, bz = zAt(bx, 11.5 + rd() * 3.5); if (bz == null || crack(bx, bz) || wfZone(bx, bz) || taxi(bx, 44)) continue;
      pine(kAt(bx), bx * K, bz * K, .7 + rd() * .25, 1700 + Math.round(x * 5), rd() < .35, false);
    }
    // 山壁下緣的岩脈：兩三塊半埋的大岩石（顏色接近山壁），讓平地和山壁的交界不是一條直線
    for (let i = 0; i < (LOW ? 4 : 7); i++) {
      const bx = -38.5 + (i + .2 + rd() * .6) * (77 / (LOW ? 4 : 7)), bz = 44.4 + rd() * 1.4; if (crack(bx, bz) || wfZone(bx, bz) || taxi(bx, bz)) continue; const k = kAt(bx);
      [[0, 0, 1.9 + rd() * .5], [1.7, -.55, 1.15], [-1.4, -.4, .9]].forEach(([dx, dz, sz], j) => { if (j === 2 && rd() < .5) return; rock(k, (bx + dx) * K, (bz + dz) * K, sz, { sy: .85, sink: .5, col: false, mt: .55, c: ['#8a8f86', '#7e847b', '#959a91'][j] }); });
    }
    // 山腳：樹、灌木與大石頭成群，接住平地的草地
    for (let x = -40; x <= 40; x += LOW ? 2.6 : 1.8) {
      const n = vnoise(x * .16, 9.1, 7); if (n < .38) continue;
      const bx = x + (rd() - .5) * 1.2, bz = 42.6 + rd() * 2.6; if (crack(bx, bz) || wfZone(bx, bz) || taxi(bx, bz)) continue;
      const X = bx * K, Z = bz * K, k = kAt(bx), r = rd(); if (!okAt(X, Z, 1)) continue;
      if (r < .3) roundTree(k, X, Z, 1 + rd() * .35, 1300 + Math.round(x * 3)); else if (r < .5) pine(k, X, Z, 1.05 + rd() * .35, 1400 + Math.round(x * 3)); else if (r < .82) shrub(k, X, Z, 1 + rd() * .5, 1500 + Math.round(x * 3), rd() < .3 ? '#dc2626' : null); else rock(k, X, Z, .8 + rd() * .6, { mt: .5 });
    }
  }

  /* ---------- 東北：觀景台地 ---------- */
  const SCOPE = { on: 0, t: 0, fov: 72 };
  function buildPlateau(ks, kf) {
    const rd = seeded(511), CX = PLAT.x * K, CZ = PLAT.z * K, top = PLAT.top, L = Math.hypot(PLAT.dx, PLAT.dz), ra = Math.atan2(PLAT.dz / L, PLAT.dx / L);
    const Rw = a => PLAT.r * (1 + .09 * Math.sin(a * 3 + 1.3) + .05 * Math.sin(a * 5 + .4)) * K, at = (a, d) => [CX + Math.cos(a) * d, CZ + Math.sin(a) * d];
    // 斷崖：三層橫向的岩層（崖頂的淺沙色、崖腰的灰色、崖腳的大石頭），扁平的石板順著崖壁的切線排，遠看是一圈一圈的地層；
    // 頂上一圈矮石頭當作邊（有碰撞，不會一腳踩空）、崖腳外的碎石（緩坡那一側都不放）
    const tan = a => Math.atan2(-Math.cos(a), -Math.sin(a)), BAND = [['#cdbd9f', '#c2b192'], ['#a89f91', '#9c9385'], ['#aca393', '#9f968a', '#b6ad9e']]; // 苔只長在最平的頂面（mt 高），岩層才不會被切成一塊一塊的綠斑
    for (let a = 0; a < PI2; a += .3) {
      const g = Math.abs(wrapA(a - ra)); if (g < .6) continue;
      const aa = a + (rd() - .5) * .1, R = Rw(aa);
      { const [x, z] = at(aa, R + .3); rock(ks, x, z, 1.3 + rd() * .25, { y: top - .65, sink: 0, col: false, c: BAND[0][Math.round(a * 7) % 2], moss: '#7aa85a', mt: .86, sx: 1.6, sy: .45, sz: 1, ry: tan(aa) }); }
      { const [x, z] = at(aa + .15, R + .95); rock(ks, x, z, 1.45 + rd() * .3, { sink: .2, col: false, c: BAND[1][Math.round(a * 5) % 2], moss: '#6f9e4c', mt: .9, sx: 1.5, sy: .8, sz: .9, ry: tan(aa + .15) }); }
      if (g > .8 && Math.round(a / .3) % 2) { const [x, z] = at(aa + .05, R + 2.3); rock(ks, x, z, 1.3 + rd() * .45, { sink: .3, col: false, c: BAND[2][Math.round(a * 3) % 3], moss: '#6f9e4c', mt: .75, sx: 1.2, sy: .85, ry: tan(aa) }); }
      if (g > .8 && (aa < 1.9 || aa > 3.1)) { const [xr, zr] = at(aa + .08, R - .5); rock(ks, xr, zr, .42 + rd() * .15, { sink: .4, mt: .7, cr: .9, c: BAND[0][1] }); }
      const [x2, z2] = at(aa + .15, R + 4.2 + rd() * 1.6); if (okAt(x2, z2, .7)) rock(ks, x2, z2, .55 + rd() * .5, { sink: .3, c: BAND[2][Math.round(a * 11) % 3] });
      if (rd() < .45) { const [x3, z3] = at(aa - .1, R + 5.6 + rd() * 2); if (okAt(x3, z3, .5)) rock(ks, x3, z3, .3 + rd() * .25, { sink: .25, col: false, c: BAND[1][0] }); }
    }
    // 緩坡上的一條踏石小路（交錯的扁平石頭），兩旁零星的黃花
    for (let u = PLAT.r * .55 + PLAT.len; u > PLAT.r * .4; u -= .85) { const j = Math.round(u * 3) % 2 ? .25 : -.25, x = (PLAT.x + PLAT.dx / L * u - PLAT.dz / L * j) * K, z = (PLAT.z + PLAT.dz / L * u + PLAT.dx / L * j) * K; rock(kf, x, z, .38, { sy: .22, sink: .35, col: false, moss: '#a3a89f', mt: .95, c: '#b4b8ae' }); }
    [[-2.6, .62], [2.7, .5], [-2.9, .3], [2.5, .78]].forEach(([v, f], j) => { const u = PLAT.r + PLAT.len * f, x = (PLAT.x + PLAT.dx / L * u - PLAT.dz / L * v) * K, z = (PLAT.z + PLAT.dz / L * u + PLAT.dx / L * v) * K; flowers(kf, x, z, LOW ? 6 : 10, 1.3, ['#fde047', '#fef08a'], 520 + j); });
    // 頂上：面向平地的長椅與一盞小燈、望向瀑布的望遠鏡、一棵孤松、石堆、一段木欄杆、野花
    const P = (bx, bz) => [(PLAT.x + bx) * K, (PLAT.z + bz) * K];
    { const [x, z] = P(-2.3, .3), f = Math.atan2(-x, -z), b = obj(ks, x, z, { ry: f, dy: -.02 }); // 面向工坊
      b(new THREE.BoxGeometry(1.5, .08, .44), '#a07850', 0, .46, 0); b(new THREE.BoxGeometry(1.5, .34, .06), '#8b6544', 0, .76, -.2, -.14); [-.62, .62].forEach(px => { b(new THREE.BoxGeometry(.08, .46, .4), '#6b4d33', px, .23, 0); b(new THREE.BoxGeometry(.08, .5, .06), '#6b4d33', px, .7, -.21, -.14); }); addCol({ x, z, r: .75 }); }
    { const [x, z] = P(-2.7, 1.25), l = obj(ks, x, z, { dy: -.02 }); l(new THREE.CylinderGeometry(.05, .07, 1.6, 6), '#4a3424', 0, .8, 0); l(new THREE.BoxGeometry(.3, .05, .3), '#3f2a1c', 0, 1.62, 0); l(new THREE.BoxGeometry(.2, .26, .2), '#ffd27a', 0, 1.78, 0, 0, 0, 0, 1, 1, 1, { gl: 1.2 }); l(new THREE.ConeGeometry(.22, .16, 4), '#3f2a1c', 0, 1.98, 0, 0, Math.PI / 4, 0); addCol({ x, z, r: .15 }); }
    { const [x, z] = P(-1.75, 2.35), tx = SNOW.x * K, tz = SNOW.z * K, ry = Math.atan2(tx - x, tz - z), t = obj(ks, x, z, { dy: -.02 }); SCOPE.x = x; SCOPE.z = z;
      t(new THREE.CylinderGeometry(.22, .3, .12, 8), '#64748b', 0, .06, 0); t(new THREE.CylinderGeometry(.06, .08, 1.05, 6), '#475569', 0, .6, 0); t(new THREE.SphereGeometry(.1, 8, 6), '#334155', 0, 1.14, 0);
      const s = obj(ks, x, z, { dy: 1.2, ry }); s(new THREE.CylinderGeometry(.09, .12, .62, 10), '#f97316', 0, 0, .05, Math.PI / 2 - .12); s(new THREE.CylinderGeometry(.125, .125, .06, 10), '#fde68a', 0, .04, .34, Math.PI / 2 - .12); s(new THREE.CylinderGeometry(.05, .06, .14, 8), '#1f2937', 0, -.03, -.3, Math.PI / 2 - .12); s(new THREE.CylinderGeometry(.13, .13, .04, 10), '#fb923c', 0, .02, .18, Math.PI / 2 - .12);
      addCol({ x, z, r: .3 });
      addInter(hitBox(.8, 1.6, .8, x, H(x, z) + .9, z, W.scene), 'nook', 'plain_scope', '看看望遠鏡', { act: scopeAct }); }
    { const [x, z] = P(1.7, -1.5); pine(ks, x, z, 1.25, 530); leaves(kf, x, z, 1.4, LOW ? 6 : 12, ['#b08a5a', '#8b6b47'], 531); }
    { const [x, z] = P(2.55, .9); let y = 0; [[.42, .14], [.34, .13], [.27, .12], [.2, .1], [.13, .09]].forEach(([r, h], i) => { rock(ks, x + (i % 2 - .5) * .04, z, r * 1.1, { y: H(x, z) + y + h * .45, sx: 1, sy: h / r * .9, sink: 0, col: false, mt: .8, seed: 540 + i }); y += h; }); addCol({ x, z, r: .4 }); }
    { const r = PLAT.r - .32; let prev = null; for (let a = 1.95; a <= 3.1; a += .23) { const [x, z] = at(a, Rw(a) * (r / PLAT.r)), p = V3(x, H(x, z), z), s = obj(ks, x, z, { dy: -.05 }); s(new THREE.CylinderGeometry(.06, .07, .85, 5), '#6b4d33', 0, .42, 0); if (prev) { seg(ks, V3(prev.x, prev.y + .72, prev.z), V3(p.x, p.y + .72, p.z), .035, '#8b6544', 5); seg(ks, V3(prev.x, prev.y + .4, prev.z), V3(p.x, p.y + .4, p.z), .03, '#8b6544', 5); } addCol({ x, z, r: .12 }); prev = p; } }
    [[0, -.8, ['#fde047', '#ffffff'], 6], [-.6, 1.4, ['#f9a8d4', '#ffffff'], 5], [1.6, 1.3, ['#c4b5fd', '#fde047'], 5]].forEach(([bx, bz, c, n], j) => { const [x, z] = P(bx, bz); flowers(kf, x, z, LOW ? n : n * 2, 1.1, c, 560 + j); });
    [[-3.2, 7.4], [2.4, 7.6], [6.4, 5]].forEach(([bx, bz], j) => { const [x, z] = P(bx, bz); if (okAt(x, z, .6)) glowBells(kf, x, z, LOW ? 4 : 7, 580 + j); }); // 南面崖腳：夜裡從東邊小徑看過來，岩壁下一排小亮點
    // 台地北邊與東邊的山腳：比較高的松樹群，從平地看台地才有背景（緩坡在西北，不擋路）
    [[2, -7.2], [5.6, -5.6], [7.4, -2], [6.6, 2.8]].forEach(([bx, bz], j) => { const [x, z] = P(bx, bz); if (okAt(x, z, 1.2)) pine(ks, x, z, 1.25 + rd() * .3, 570 + j); });
  }
  function scopeAct() {
    if (SCOPE.on) return; const tx = SNOW.X, tz = SNOW.Z, ty = SNOW.Y + .6; // 瀑布正好在巨樹後面，改看山脊上的小家族
    Object.assign(SCOPE, { on: 1, t: 0, fov: W.fov0 || 72, px: P.x, pz: P.z, yaw: Math.atan2(-(tx - P.x), -(tz - P.z)), pitch: Math.atan2(ty - (P.y + 1.6), Math.hypot(tx - P.x, tz - P.z)), said: false });
    sfx.tick && sfx.tick();
  }
  function scopeStep(dt) {
    if (!SCOPE.on) return; SCOPE.t += dt; const t = SCOPE.t;
    if (Math.hypot(P.x - SCOPE.px, P.z - SCOPE.pz) > .8 || GUI.kind || t > 6) { W.fov0 = SCOPE.fov; SCOPE.on = 0; return; } // 走開、打開介面或看夠了：恢復視野
    if (t < 1) { const k = Math.min(1, dt * 5); P.yaw += wrapA(SCOPE.yaw - P.yaw) * k; P.pitch += (SCOPE.pitch - P.pitch) * k; }
    W.fov0 = SCOPE.fov + (7 - SCOPE.fov) * smooth(0, .9, t) * (1 - smooth(5.2, 6, t));
    if (t > 1.3 && !SCOPE.said) { SCOPE.said = true; const msg = DN.night < .4 ? '望遠鏡裡，山脊頂上有三隻雪白的小史萊姆排排坐，正看著山谷！' : '山脊頂上亮著三個小小的光點……是三隻雪白的小史萊姆在發光！'; if (!eggHit('plain_scope', msg)) bark(SELF, msg); }
  }

  /* ---------- 西北：白樺丘 ---------- */
  const HAM = { on: 0, t: 0 };
  function buildBirch(ks, kf) {
    const rd = seeded(611), GROVES = [[-10.5, -30.5, 4.6, LOW ? 6 : 10], [-18, -35.5, 3.8, LOW ? 4 : 7], [-5.5, -26.5, 2.6, LOW ? 3 : 5]];
    const L = ['#f6d365', '#f4a742', '#e8b23a', '#d9a066'];
    GROVES.forEach(([gx, gz, R, n], gi) => {
      let placed = 0;
      for (let tr = 0; tr < n * 6 && placed < n; tr++) {
        const a = rd() * PI2, r = Math.sqrt(rd()) * R, x = (gx + Math.cos(a) * r) * K, z = (gz + Math.sin(a) * r) * K; if (!okAt(x, z, 1.25)) continue;
        const gold = rd() < .3; birch(ks, x, z, .9 + rd() * .35, 620 + gi * 40 + placed, gold); placed++;
        leaves(kf, x, z, 2.1, LOW ? 5 : 11, gold ? L : [L[0], L[3], '#c9d86b'], 700 + gi * 40 + placed);
        if (rd() < .5) { const fa = rd() * PI2; if (okAt(x + Math.cos(fa) * 1.3, z + Math.sin(fa) * 1.3, .3)) fern(kf, x + Math.cos(fa) * 1.3, z + Math.sin(fa) * 1.3, .75 + rd() * .3, gi * 9 + placed); }
      }
    });
    // 苔蘚岩、白色的小蘑菇、夜裡亮起來的月光花（淡藍、淡紫）
    [[-14.6, -28.4, 1.1], [-7.2, -33.6, .8], [-21.2, -33.2, .9], [-13.4, -37.8, .7]].forEach(([bx, bz, s], j) => { const x = bx * K, z = bz * K; if (okAt(x, z, s)) rock(ks, x, z, s, { d: 1, sink: .35, mt: .45, seed: 640 + j }); });
    [[-12.2, -33.4], [-16.6, -31.2], [-8.4, -29.2], [-19.4, -37.4]].forEach(([bx, bz], j) => { const x = bx * K, z = bz * K; if (!okAt(x, z, .8)) return; const c = j % 2 ? ['#dbeafe', '#c4b5fd'] : ['#e0f2fe', '#bae6fd']; c.gl = 1; c.c = '#fef9c3'; flowers(kf, x, z, LOW ? 5 : 9, .9, c, 650 + j); });
    for (let i = 0; i < (LOW ? 4 : 8); i++) { const a = rd() * PI2, r = 2 + rd() * 4, x = (-12 + Math.cos(a) * r) * K, z = (-32 + Math.sin(a) * r) * K; if (okAt(x, z, .25)) shroom(kf, x, z, .7 + rd() * .4, i % 3 ? '#f5efe6' : '#d6a46a'); }
    [[-5.8, -27.6], [-7.2, -32], [-4.6, -30]].forEach(([bx, bz], j) => { const x = bx * K, z = bz * K; if (okAt(x, z, .6)) glowBells(kf, x, z, LOW ? 4 : 7, 640 + j); }); // 面向北邊小徑的東坡：夜裡從路上看得到
    // 吊床：掛在兩棵白樺之間，彩色條紋的布往下垂
    { const A = V3(-12.9 * K, 0, -27.6 * K), B = V3(-9.5 * K, 0, -27.0 * K); A.y = H(A.x, A.z); B.y = H(B.x, B.z);
      birch(ks, A.x, A.z, 1, 690); birch(ks, B.x, B.z, 1.05, 691, true);
      const N = 12, d = new THREE.Vector3().subVectors(B, A), len = d.length(), C = ['#ef4444', '#fde047', '#38bdf8'];
      for (let i = 0; i < N; i++) { const k0 = i / N, k1 = (i + 1) / N, p0 = A.clone().lerp(B, k0), p1 = A.clone().lerp(B, k1), s0 = Math.sin(Math.PI * k0) * .55, s1 = Math.sin(Math.PI * k1) * .55; p0.y += 1.25 - s0; p1.y += 1.25 - s1; if (i === 0 || i === N - 1) { seg(ks, i ? p1 : p0, (i ? p1 : p0).clone().setY((i ? p1 : p0).y + .25), .015, '#e7e5e4', 4); } const m = p0.clone().add(p1).multiplyScalar(.5), q = new THREE.Quaternion().setFromUnitVectors(V3(0, 0, 1), p1.clone().sub(p0).normalize()); ks.add(new THREE.BoxGeometry(.85, .03, p0.distanceTo(p1) + .01), C[Math.floor(i / 2) % 3], new THREE.Matrix4().compose(m, q, V3(1, 1, 1))); }
      const mid = A.clone().lerp(B, .5); HAM.x = mid.x; HAM.z = mid.z; HAM.y = mid.y; addCol({ x: mid.x, z: mid.z, r: .5 });
      addInter(hitBox(len * .7, .8, 1, mid.x, mid.y + .9, mid.z, W.scene), 'nook', 'plain_hammock', '躺上吊床', { act: hamAct }).hit.rotation.y = Math.atan2(-d.z, d.x); // 盒子的長邊對齊兩棵樹的連線
    }
  }
  function hamAct() { if (HAM.on) return; Object.assign(HAM, { on: 1, t: 0, px: P.x, pz: P.z }); if (S.sound) { try { const t = audio().currentTime; tone(523, t, .3, .03, 'triangle'); tone(659, t + .12, .35, .03, 'triangle'); } catch (e) { } } }
  function hamStep(dt) {
    if (!HAM.on) return; HAM.t += dt; const t = HAM.t;
    if (Math.hypot(P.x - HAM.px, P.z - HAM.pz) > .8 || GUI.kind || t > 4.5) { HAM.on = 0; return; }
    if (t < 2.6) { P.pitch += (.95 - P.pitch) * Math.min(1, dt * 2.5); P.roll = Math.sin(t * 2.2) * .03; } // 躺下來看天空，輕輕晃
    if (t > 1.4 && !HAM.said) { HAM.said = true; eggHit('plain_hammock', '躺在吊床上晃呀晃……白樺葉子之間的天空好藍。'); }
  }

  /* ---------- 西南：苔石丘（疊石柱、老樹、夜光蘑菇） ---------- */
  function buildKnoll(ks, kf) {
    const rd = seeded(711), KX = -35.5, KZ = 18.5, P = (bx, bz) => [(KX + bx) * K, (KZ + bz) * K];
    // 疊石柱：圓圓扁扁的石頭一顆一顆往上疊，每顆頂上長一點苔
    [[.4, -.9, 6], [-2.1, 1.2, 5], [2, 1.8, 4], [-.6, 3.2, 3]].forEach(([bx, bz, n], j) => {
      const [x, z] = P(bx, bz); let r = 1.5 - j * .12, y = Math.min(H(x, z), H(x + r * .7, z), H(x - r * .7, z), H(x, z + r * .7), H(x, z - r * .7)) - .15; // 底石坐在周圍最低的地面：坡上不會有一邊懸空
      for (let i = 0; i < n; i++) { const h = r * (.62 + rd() * .12), g = jit(new THREE.IcosahedronGeometry(1, 1), .18, 720 + j * 9 + i), c = new THREE.Color(['#9ca3a0', '#8b928e', '#a8aea9'][(i + j) % 3]), dk = c.clone().multiplyScalar(.86);
        ks.add(g, (nx, ny, nz, cx, cy, cz, fi) => ny > .72 ? '#6a9a4a' : fi % 4 === 1 ? dk : c, M4(x + (rd() - .5) * .12, y + h * .5, z + (rd() - .5) * .12, (rd() - .5) * .12, rd() * 6, (rd() - .5) * .12, r, h * .5, r * (.9 + rd() * .15))); y += h * .9; r *= .8 + rd() * .06; }
      addCol({ x, z, r: 1.15 - j * .1 });
    });
    // 老樹：彎彎的樹幹、隆起的樹根、深綠的大樹冠
    { const [x, z] = P(-2.9, -1.9), y = H(x, z) - .1, pts = [V3(x, y, z), V3(x + .3, y + 1.4, z - .1), V3(x - .2, y + 2.6, z + .3), V3(x + .5, y + 3.6, z + .2)];
      for (let i = 0; i < 3; i++) seg(ks, pts[i], pts[i + 1], .34 - i * .07, '#5b4636', 7, .27 - i * .06, { sw: .004, by: y, ax: x, az: z });
      seg(ks, pts[2], V3(x - 1.3, y + 3.3, z - .4), .12, '#5b4636', 5, .08, { sw: .004, by: y, ax: x, az: z });
      for (let i = 0; i < 5; i++) { const a = i / 5 * PI2 + .4, e = V3(x + Math.cos(a) * 1.35, H(x + Math.cos(a) * 1.35, z + Math.sin(a) * 1.35) - .1, z + Math.sin(a) * 1.35); seg(ks, V3(x + Math.cos(a) * .2, y + .45, z + Math.sin(a) * .2), e, .1, '#5b4636', 5, .2); }
      [[.5, 4.4, .2, 1.5, 1], [-.6, 4.1, .6, 1.15, 0], [1.3, 3.9, -.3, 1.1, 0], [-1.3, 3.6, -.4, 1, 0], [.2, 5.1, -.2, .95, 0]].forEach(([px, py, pz, s, d], i) => ks.add(blob(760 + i, d), ['#3f7f3a', '#4a8f42', '#356f33'][i % 3], M4(x + px, y + py, z + pz, 0, i, 0, s, s * .82, s), { sw: .004, by: y, ax: x, az: z }));
      addCol({ x, z, r: .45, tree: 1 }); }
    // 大苔石、蕨類、苔蘚地毯、夜光蘑菇（藍、紫，成群長在北面陰涼處）
    [[3.4, -1.6, 1.2], [-3.6, 2.6, .9], [2.6, 3.8, .8], [-1.2, -3.6, .7], [4.4, 1.6, .6]].forEach(([bx, bz, s], j) => { const [x, z] = P(bx, bz); if (okAt(x, z, s * .8)) rock(ks, x, z, s, { d: 1, sink: .32, mt: .42, seed: 780 + j }); });
    for (let i = 0; i < (LOW ? 7 : 14); i++) { const a = rd() * PI2, r = 2.8 + rd() * 3, [x, z] = P(Math.cos(a) * r, Math.sin(a) * r); if (okAt(x, z, .35)) fern(kf, x, z, .75 + rd() * .4, 790 + i); }
    for (let i = 0; i < (LOW ? 4 : 7); i++) { const a = rd() * PI2, r = 1 + rd() * 3.5, [x, z] = P(Math.cos(a) * r, Math.sin(a) * r); kf.add(new THREE.CircleGeometry(.7 + rd() * .5, 7), i % 2 ? '#5b8f3e' : '#4f8436', M4(x, H(x, z) + .03, z, -Math.PI / 2, 0, rd() * 6, 1, .7, 1)); }
    [[-2.2, -4.2], [.8, -4.4], [-4.4, -1.2], [3.6, -3.8], [-4, 4.4]].forEach(([bx, bz], j) => { for (let i = 0; i < (LOW ? 2 : 4); i++) { const [x, z] = P(bx + (rd() - .5) * 1.4, bz + (rd() - .5) * 1.4); if (okAt(x, z, .2)) shroom(kf, x, z, .9 + rd() * .6, GLOWC[(i + j) % 4], 1); } });
  }

  /* ---------- 山腳（北、東、西三面）：大石頭＋灌木＋蕨類，三五個一群，接住平地和山壁 ---------- */
  function buildFoot(kits) {
    const rd = seeded(811), kq = (x, z) => kits[(x > 0 ? 'e' : 'w') + (z > 0 ? 's' : 'n')];
    const sides = [[t => [t, -39.6]], [t => [39.6, t]], [t => [-39.6, t]]];
    sides.forEach(([f], si) => {
      for (let t = -38; t <= 38; t += LOW ? 4.2 : 3) {
        if (vnoise(t * .2 + si * 7, si * 3.3, 13) < .45) continue;
        const [bx0, bz0] = f(t + (rd() - .5) * 1.5), inward = si === 0 ? [0, 1] : si === 1 ? [-1, 0] : [1, 0], dd = rd() * 1.4, bx = bx0 + inward[0] * dd, bz = bz0 + inward[1] * dd;
        if (si === 1 && bz > 8) continue; // 東邊南段是小溪的地方
        const x = bx * K, z = bz * K, k = kq(bx, bz); if (!okAt(x, z, 1.4)) continue;
        rock(k.s, x, z, 1 + rd() * .8, { mt: .5 });
        for (let j = 0; j < 2; j++) { const a = rd() * PI2, r = 1.5 + rd() * 1.2, sx = x + Math.cos(a) * r, sz = z + Math.sin(a) * r; if (!okAt(sx, sz, .7)) continue; if (j === 0 || rd() < .4) shrub(k.s, sx, sz, .85 + rd() * .45, Math.round(t * 13) + j + si * 100, rd() < .25 ? '#7c3aed' : null); else rock(k.s, sx, sz, .4 + rd() * .3, { col: false }); }
        if (!LOW) for (let j = 0; j < 2; j++) { const a = rd() * PI2, r = 1.2 + rd() * 2, fx = x + Math.cos(a) * r, fz = z + Math.sin(a) * r; if (okAt(fx, fz, .35)) fern(k.f, fx, fz, .7 + rd() * .35, Math.round(t * 7) + j); }
      }
    });
  }
  // 林間空地的花：一片一種顏色、片與片至少隔 7 單位（疏密有致）；白色與淡藍色那幾片是月光花，夜裡會亮。花叢的位置記下來給蝴蝶用
  const MEAD = [];
  function buildMeadows(kits) {
    const rd = seeded(911), PAL = [['#fde047', '#fef08a'], ['#f9a8d4', '#fbcfe8'], ['#c4b5fd', '#a78bfa'], ['#ffffff', '#e0f2fe'], ['#fb923c', '#fdba74'], ['#93c5fd', '#bfdbfe']];
    PAL[3].gl = PAL[5].gl = .9; PAL[3].c = PAL[5].c = '#fef9c3';
    let n = 0; const got = [];
    for (let i = 0; i < 500 && n < (LOW ? 8 : 16); i++) {
      const bx = (rd() - .5) * 76, bz = (rd() - .5) * 76, r = Math.max(Math.abs(bx), Math.abs(bz)); if (r > 37 || Math.hypot(bx, bz) < 19 || !clearing(bx, bz)) continue;
      if (got.some(([gx, gz]) => (gx - bx) ** 2 + (gz - bz) ** 2 < 49)) continue;
      const x = bx * K, z = bz * K; if (!okAt(x, z, 2) || !flat(x, z, 1.5)) continue;
      const rad = 1.8 + rd(); flowers(kits[(bx > 0 ? 'e' : 'w') + (bz > 0 ? 's' : 'n')].f, x, z, LOW ? 8 : 15, rad, PAL[n % PAL.length], 920 + n); got.push([bx, bz]); MEAD.push([x, z, rad]); n++;
    }
  }
  // 夜光鈴蘭：細莖上垂著一串小鈴鐺，白天是淡淡的顏色，天黑後亮起來（自發光，不加光源）
  const BELL = ['#22d3ee', '#a78bfa', '#34d399', '#60a5fa']; // 顏色要飽和：自發光會把淡色洗成一片白
  function glowBells(k, x, z, n, seed) {
    const rd = seeded(seed), c = BELL[seed % BELL.length];
    for (let i = 0; i < n; i++) {
      const a0 = rd() * PI2, r = Math.sqrt(rd()) * .55, bx = x + Math.cos(a0) * r, bz = z + Math.sin(a0) * r, h = .34 + rd() * .22, lean = (rd() - .5) * .5, a = obj(k, bx, bz, { ry: rd() * PI2, sw: .25, dy: -.02 });
      a(new THREE.CylinderGeometry(.01, .014, h, 3, 1, true), '#4f8a3f', 0, h / 2, 0, 0, 0, lean);
      const tx = -Math.sin(lean) * h, ty = Math.cos(lean) * h;
      [[0, 0], [.09, -.1], [-.08, -.19]].forEach(([dx, dy], j) => { if (j && rd() < .3) return; const r = .07 - j * .01; a(new THREE.SphereGeometry(r, 6, 3, 0, PI2, 0, 1.95), c, tx + dx, ty + dy - r * .9, 0, 0, rd() * 2, 0, 1, 1.3, 1, { gl: 1 }); }); // 圓頂、下緣微微外翻的小鈴鐺
      if (i % 2 === 0) a(new THREE.ConeGeometry(.05, .3, 3, 1, true), '#5aa64e', .05, .15, 0, 0, 0, -.35, 1, 1, .3);
    }
  }
  // 沿著小徑：每隔 5～8 單位在路邊（左右交錯、偶爾跳過）放一叢夜光鈴蘭或一圈夜光蘑菇，夜裡走在路上一叢一叢亮著
  function buildPathGlow(kits) {
    const rd = seeded(951), kq = (x, z) => kits[(x > 0 ? 'e' : 'w') + (z > 0 ? 's' : 'n')].f; let n = 0;
    paths().forEach((L, li) => {
      let acc = 0, next = 4 + rd() * 4, side = li % 2 ? 1 : -1;
      for (let i = 1; i < L.length; i++) {
        const [x0, z0] = L[i - 1], [x1, z1] = L[i], d = Math.hypot(x1 - x0, z1 - z0); acc += d; if (acc < next) continue;
        acc = 0; next = 5 + rd() * 3; side = -side; if (vnoise(x1 * .3, z1 * .3, 17) < .22) continue;
        const ux = (x1 - x0) / (d || 1), uz = (z1 - z0) / (d || 1), off = 2.9 + rd() * .8, bx = x1 - uz * side * off, bz = z1 + ux * side * off;
        if (Math.hypot(bx, bz) < 19 || Math.max(Math.abs(bx), Math.abs(bz)) > 37) continue;
        const X = bx * K, Z = bz * K; if (!okAt(X, Z, .7)) continue;
        if (n++ % 3 === 2) for (let j = 0; j < (LOW ? 3 : 5); j++) { const a = j / 5 * PI2 + rd(), r = .35 + rd() * .5; shroom(kq(bx, bz), X + Math.cos(a) * r, Z + Math.sin(a) * r, .7 + rd() * .5, GLOWC[(j + n) % 4], 1); }
        else glowBells(kq(bx, bz), X, Z, LOW ? 4 : 7, 960 + n);
      }
    });
  }

  /* ---------- 會動的：溪上的蜻蜓 ---------- */
  let DF = null;
  function buildDragonflies() {
    const N = LOW ? 3 : 5, g = mergeParts([[new THREE.CylinderGeometry(.018, .012, .34, 5), '#0ea5e9', M4(0, 0, -.02, Math.PI / 2)], [new THREE.SphereGeometry(.035, 6, 4), '#0369a1', M4(0, 0, .15)], ...[-1, 1].flatMap(s => [[new THREE.PlaneGeometry(.2, .05), '#e0f2fe', M4(s * .1, .005, .06, -Math.PI / 2)], [new THREE.PlaneGeometry(.17, .045), '#dbeafe', M4(s * .09, .005, -.01, -Math.PI / 2)]])]);
    const im = new THREE.InstancedMesh(g, flapMat(34, .7), N); im.instanceMatrix.setUsage(THREE.DynamicDrawUsage); im.frustumCulled = false; im.visible = false; W.scene.add(im);
    ['#0ea5e9', '#ef4444', '#22c55e', '#a855f7', '#f59e0b'].slice(0, N).forEach((c, i) => im.setColorAt(i, new THREE.Color(c)));
    const Cp = creekPts().p, L = Array.from({ length: N }, (_, i) => ({ x: 0, y: 0, z: 0, tx: 0, ty: 0, tz: 0, t: 0, ph: i * 1.7, ry: 0 }));
    const pickT = d => { const q = Cp[Math.floor(Math.random() * Cp.length)], s = POOL.s + (TAIL.s - POOL.s) * q[2]; d.tx = q[0] * K + (Math.random() - .5) * 2; d.tz = q[1] * K + (Math.random() - .5) * 2; d.ty = s + .5 + Math.random() * .8; d.t = 1.2 + Math.random() * 2.2; };
    L.forEach(d => { pickT(d); d.x = d.tx; d.y = d.ty; d.z = d.tz; });
    DF = { im, L, pickT, m: new THREE.Matrix4(), q: new THREE.Quaternion(), e: new THREE.Euler(), v: new THREE.Vector3(), s: new THREE.Vector3(1, 1, 1) };
  }
  function dfStep(dt, t) {
    const D = DF; if (!D) return; const near = Math.hypot(P.x - 35.5 * K, P.z - 27 * K) < 55 && !inCity() && !CV.c; D.im.visible = near; if (!near) return;
    D.L.forEach((d, i) => {
      d.t -= dt; if (d.t < 0) D.pickT(d);
      const dx = d.tx - d.x, dz = d.tz - d.z, dy = d.ty - d.y, l = Math.hypot(dx, dz); // 停在半空中、突然衝到下一個點（蜻蜓的飛法）
      const k = Math.min(1, dt * (l > .3 ? 3.2 : 1)); d.x += dx * k; d.z += dz * k; d.y += dy * k + Math.sin(t * 7 + d.ph) * dt * .08;
      if (l > .05) d.ry += wrapA(Math.atan2(dx, dz) - d.ry) * Math.min(1, dt * 8);
      D.e.set(0, d.ry, 0); D.q.setFromEuler(D.e); D.m.compose(D.v.set(d.x, d.y, d.z), D.q, D.s); D.im.setMatrixAt(i, D.m);
    });
    D.im.instanceMatrix.needsUpdate = true;
  }
  // 白天在花叢上飛的蝴蝶：離玩家最近的三片花叢，每片分到兩三隻，繞著花叢忽高忽低地飛（晚上、在山洞或城市裡不畫）
  let BF = null;
  function buildButterflies() {
    if (!MEAD.length) return; const N = LOW ? 4 : 8, im = new THREE.InstancedMesh(wingGeo(.15, .19, '#ffffff', '#f8fafc'), flapMat(15, 1.2), N);
    im.instanceMatrix.setUsage(THREE.DynamicDrawUsage); im.frustumCulled = false; im.visible = false; W.scene.add(im);
    ['#fde047', '#f9a8d4', '#a5f3fc', '#fdba74', '#c4b5fd', '#ffffff', '#86efac', '#fca5a5'].slice(0, N).forEach((c, i) => im.setColorAt(i, new THREE.Color(c)));
    BF = { im, near: [], scan: 0, L: Array.from({ length: N }, (_, i) => ({ p: null, x: 0, y: 0, z: 0, tx: 0, tz: 0, t: 0, ph: i * 2.3 })), m: new THREE.Matrix4(), q: new THREE.Quaternion(), e: new THREE.Euler(), v: new THREE.Vector3(), s: new THREE.Vector3(1, 1, 1), Z: new THREE.Matrix4().makeScale(0, 0, 0) };
  }
  function bfStep(dt, t) {
    const B = BF; if (!B) return; const on = DN.night < .45 && !CV.c;
    if ((B.scan -= dt) < 0) { B.scan = 1; B.near = MEAD.filter(([x, z]) => Math.hypot(x - P.x, z - P.z) < 36).sort((a, b) => Math.hypot(a[0] - P.x, a[1] - P.z) - Math.hypot(b[0] - P.x, b[1] - P.z)).slice(0, 3); }
    B.im.visible = on && B.near.length > 0; if (!B.im.visible) return;
    B.L.forEach((b, i) => {
      const p = B.near[i % B.near.length];
      if (b.p !== p) { b.p = p; const a = Math.random() * PI2; b.x = b.tx = p[0] + Math.cos(a) * p[2]; b.z = b.tz = p[1] + Math.sin(a) * p[2]; b.y = H(b.x, b.z) + .7; b.t = 0; }
      if ((b.t -= dt) < 0) { b.t = 1.2 + Math.random() * 2.4; const a = Math.random() * PI2, r = Math.random() * (p[2] + .8); b.tx = p[0] + Math.cos(a) * r; b.tz = p[1] + Math.sin(a) * r; }
      const dx = b.tx - b.x, dz = b.tz - b.z, d = Math.hypot(dx, dz) || 1, sp = Math.min(1.4, d) * dt; b.x += dx / d * sp + Math.sin(t * 3 + b.ph) * dt * .5; b.z += dz / d * sp + Math.cos(t * 2.6 + b.ph) * dt * .5;
      b.y += ((H(b.x, b.z) + .55 + Math.sin(t * 1.3 + b.ph) * .35) - b.y) * Math.min(1, dt * 2) + Math.sin(t * 9 + b.ph) * dt * .4;
      B.e.set(Math.sin(t * 4 + b.ph) * .2, Math.atan2(dx, dz), 0); B.q.setFromEuler(B.e); B.m.compose(B.v.set(b.x, b.y, b.z), B.q, B.s); B.im.setMatrixAt(i, B.m);
    });
    B.im.instanceMatrix.needsUpdate = true;
  }
  // 踏腳石彩蛋：在踏腳石附近從一岸走到另一岸
  function stepStep() {
    if (!STEP.rx) return; const lx = P.x - STEP.x, lz = P.z - STEP.z, along = lx * STEP.rx + lz * STEP.rz, off = Math.abs(-lx * STEP.rz + lz * STEP.rx);
    if (off > 1.6 || Math.abs(along) > STEP.w + 2.5) { STEP.side = 0; return; }
    if (Math.abs(along) > STEP.w + .6) { const s = Math.sign(along); if (STEP.side && s === -STEP.side) eggHit('plain_stones', '踩著石頭過溪……一顆、兩顆、三顆，鞋子沒有濕！'); STEP.side = s; }
  }

  regionBuild(() => {
    const M = mats(), q = () => ({ s: kit(), f: LOW ? null : kit(1) }), kits = { en: q(), wn: q(), ws: q(), es: q() };
    Object.values(kits).forEach(k => { if (!k.f) k.f = Object.assign({}, k.s, { add: (g, c, m, o = {}) => k.s.add(g, c, m, Object.assign({}, o, { fd: 1 })) }); }); // 手機：細節和大物件合併成同一個網格（少一次繪製），細節照樣標記成遠了要縮小
    regEgg('plain_scope', '山脊上的雪地小家族', '東北的台地上有一架望遠鏡，對準了南邊的山脊頂。');
    regEgg('plain_hammock', '白樺林的吊床', '西北的白樺丘上，有人在兩棵樹之間掛了一張吊床。');
    regEgg('plain_stones', '踩石頭過溪', '巨樹東邊的小溪上有一排踏腳石。');
    buildWater(M.water);
    buildCreek(kits.es.s, kits.es.f);
    buildSouthFace(kits.es.s, kits.ws.s);
    buildPlateau(kits.en.s, kits.en.f);
    buildBirch(kits.wn.s, kits.wn.f);
    buildKnoll(kits.ws.s, kits.ws.f);
    buildFoot({ en: kits.en, wn: kits.wn, ws: kits.ws, es: kits.es });
    buildMeadows({ en: kits.en, wn: kits.wn, ws: kits.ws, es: kits.es });
    buildPathGlow({ en: kits.en, wn: kits.wn, ws: kits.ws, es: kits.es });
    Object.values(kits).forEach(k => { k.s.done(M.solid, 260, true); if (!LOW) k.f.done(M.solid, 75, false); });
    buildDragonflies(); buildButterflies();
  });
  regionStep((dt, t) => {
    if (!P) return; if (MT) MT.U.value = DN.night;
    const bx = P.x / K, bz = P.z / K; if (inCity() || Math.max(Math.abs(bx), Math.abs(bz)) > 60) { if (DF) DF.im.visible = false; if (BF) BF.im.visible = false; return; } // 不在中央平地附近（或在城市）：什麼都不用算，蟲子也不畫
    dfStep(dt, t); bfStep(dt, t); scopeStep(dt); hamStep(dt); stepStep();
  });
})();
