'use strict';
/* ============================================================
   月光谷的主線（設計分析 6.2）：三幕的觸發條件表，和第二幕「月光回來」的全部內容。
   和 regions.js 一樣在 game.js 之前載入：最上層只宣告，用到 game.js 的全域（S、W、P、SP、H…）都在函式被呼叫時才讀。
   game.js 只有幾個掛勾：fresh()／sanitize 的 S.moon（moonSan）、makeProduct 的 moonMade、手帳的 PAPERS.moon（MOON_PAGE）與 PAPER_IDS 白名單、
   開發者工具的 devMoon；配樂讓位直接壓 MUS.duck（musicStep 每格往 1 拉回去，演出期間這裡每格再壓下來）。

   三幕的觸發條件（每一幕的結尾都是世界裡看得到的變化，不靠文字）
   第一幕「工坊醒來」（現有，不動）
     開始：新存檔；手作台上奶奶的信（S.letter）。
     過程：照片牆的前 6 個里程碑各修好小屋一處（REPAIRS／PHOTO_EVT：第一個捏捏、第一台機器、第一次直播、來到海岸、來到火山、來到雪原）。
     結尾：6 處都修好，小屋變回奶奶那時候的樣子。存檔＝S.photos。
   第二幕「月光回來」（這個檔案）
     開始：一開始就在；和第一幕平行，不必等第一幕。古代遺跡四周立著四根石柱，柱頂的石頭是暗的；柱身刻著那一區的記號（浪、山、雪花、月牙），
           刻記號的那一面朝著那一區（東＝海岸、北＝火山、西＝雪原、南＝月光洞窟的裂縫）。
     過程：海岸／火山／雪原：那一區第一次做出稀有（rar ≥ 3）的捏捏；月光洞窟：第一次做出月光史萊姆的捏捏——月光凝膠是最後一根的鑰匙
           （月光史萊姆只在夜裡的月光洞窟湖邊出現；圖鑑上算森林，只點亮月光那一根）。產線、手作台、工廠做的都算（看 S.codex[種類].made）。
           做好的那一刻（在手作台、產線之類的介面裡做好的，等介面關掉、回到自己的眼睛）：一顆那一區顏色的光點從手心飛過山谷、落在那根柱頂，
           石頭亮起來、一道細光柱、低沉的鐘聲（四根的音高合起來是 F 大調的和弦）。古代遺跡的名牌被柱頂的石頭擋到時畫在石頭上面（signStep）。
           在山洞、城市、車上做好（工廠）就不飛光點，石頭直接亮。
     結尾：四根都亮之後的第一個夜晚——玩家在中央平地（不在山洞、城市、車上，也沒有開著工作站、直播、對話），夜晚還剩 25 秒以上；錯過就等下一夜。
           四顆石頭的光聚到遺跡上空、月光從天上落下來，再從遺跡劃一道弧線飛過山谷落在森林巨樹的樹頂，巨樹從樹頂開始開滿花、花瓣飄下來
           （約 20 秒、有配樂；鏡頭不被搶走，玩家可以自由走動）。之後巨樹一直開著花、夜裡微微發光、偶爾飄下花瓣；遠景剪影也帶一點粉紅。
           演完從口袋拿出手帳的一頁（PAPERS.moon），記下這一夜（夾著一片花瓣、畫著四根柱子和開花的樹）。
     存檔：S.moon = { l: 四根亮了哪幾根（位元：1 海岸、2 火山、4 雪原、8 月光洞窟）, b: 0／1 巨樹開過花 }。
           讀檔時依 S.codex 補亮該亮的柱子（不演光點）；四根都亮的舊存檔，下一個夜晚照樣開花。開過花卻還沒收進手帳（演到一半關掉）就直接補收。
   第三幕「月光祭」（還沒做，只先定條件）
     開始：夢想清單完成（GOAL：製作過所有種類、粉絲 800、累積營收 ¥40,000）而且第二幕已經開過花（S.moon.b）。
     過程：下一個黃昏，聊過 3 次以上的城市居民（S.npc[id].n ≥ 3）搭計程車來工坊，展示場變成小市集；巨樹下掛燈籠。
     結尾：在照片牆前拍一張大合照（取代現在 finish() 的彈窗）；之後開「收藏家」目標（設計分析 12.4）。存檔預定 S.fest。

   效能：四根石柱（含柱頂的石頭與記號）合併成一個網格，石頭的亮度是頂點屬性＋uniform（一次繪製）；光暈、光點、聚光的粒子是同一組 Points；
   光柱、月光的弧線、花、花瓣都是 InstancedMesh，沒在用的時候 count＝0（不繪製，但開機就編譯好著色器，演出時不卡）。不加光源。
   ============================================================ */

/* ---------- 存檔與判定（game.js 讀檔、做好捏捏時呼叫） ---------- */
const MOON = { light: null, dev: null }; // 世界建好後由下面的 IIFE 填入
const MOON_Z = ['coast', 'volcano', 'snow', 'moon']; // 四根石柱：存檔位元的順序
// 這種史萊姆的捏捏點亮哪一根（−1＝不點）：月光洞窟的史萊姆（月光凝膠）是最後一根的鑰匙；其他看區域＋稀有度
function moonKey(sp) { const s = SP[sp]; if (!s) return -1; if (s.cave === 'moon') return 3; return s.rar >= 3 ? MOON_Z.indexOf(s.zone) : -1; }
function moonBits(codex) { let b = 0; for (const s of SPECIES) { const c = codex && codex[s.id], k = moonKey(s.id); if (k >= 0 && c && c.made > 0) b |= 1 << k; } return b; }
// 讀檔：只留合法的位元，再依圖鑑補亮（改版前做過稀有捏捏的存檔，柱子一開始就是亮的）
function moonSan(o, codex) { o = o && typeof o === 'object' ? o : {}; const l = Math.floor(+o.l); return { l: (l >= 0 && l <= 15 ? l : 0) | moonBits(codex), b: o.b ? 1 : 0 }; } // 0～15 以外（負數、太大、不是數字）都當作 0：-1 & 15 會變成「四根都亮」
// makeProduct 每做好一個捏捏呼叫一次：這一根第一次亮 → 記下來（呼叫端會存檔），世界裡飛光點、敲鐘
function moonMade(sp) {
  const k = moonKey(sp); if (k < 0 || !S.moon) return; const bit = 1 << k; if (S.moon.l & bit) return;
  S.moon.l |= bit; if (MOON.light) MOON.light(k, true);
}
function moonDev() { if (MOON.dev) MOON.dev(); } // 暫停選單的開發者工具：點亮下一根／四根都亮了就直接演一次開花
// 手帳的一頁：巨樹開花那一夜，從口袋拿出來、墨水一行一行寫上去（Paper.tsx 依 id 畫四根柱子、月光的弧線、開花的樹，角落夾一片花瓣）
const MOON_PAGE = { v: 'note', name: '月光回來的夜晚', b: ['四根石柱都亮起來的那一夜，', '月光從遺跡飛過山谷，', '落在巨樹上，開了滿樹的花。'], sig: '夾一片花瓣當作紀念' };

/* ---------- 世界裡的東西：四根石柱、光點、光柱、月光的弧線、花、花瓣、鐘聲與配樂 ---------- */
(() => {
  const RAD = 5.6, ORB_Y = 8.2; // 石柱離遺跡中心多遠；月光聚在遺跡上空多高（古代遺跡的名牌在 5.6 m，光球底下要比牌子高，字才不會被蓋住）
  const DIR = [[1, 0], [0, -1], [-1, 0], [0, 1]]; // 從遺跡中心往那一區：東（海岸）、北（火山）、西（雪原）、南（月光洞窟的裂縫）
  const HEX = ['#38bdf8', '#fb923c', '#d6efff', '#c4b5fd'], NOTE = [48, 53, 57, 60]; // 石頭的顏色；鐘聲（C3、F3、A3、C4：四根一起是 F 大調）
  let NB = 230, NPET = 120, NMOTE = 90; // 花、花瓣、聚光的粒子（手機在 build 裡減少：LOW 在 game.js，這裡載入時還讀不到）
  const IX = { orb: 4, crown: 5, wisp: 6, mote: 13 }; // Points 的編號：0～3 光暈、4 遺跡上空的光球、5 樹頂的光、6～12 光點與拖尾、13 起聚光的粒子
  const ST = { b: null, lit: [0, 0, 0, 0], fl: [0, 0, 0, 0], q: [], qt: 0, wisp: null, pulse: null, show: null, calm: 99, bloom: 0, duck: 1, petAcc: 0, tint: false }; // q／qt：等著飛的光點、介面關掉之後過了多久
  const _v = new THREE.Vector3(), _v2 = new THREE.Vector3(), _q = new THREE.Quaternion(), _s = new THREE.Vector3(), _m = new THREE.Matrix4(), _c = new THREE.Color(), UP = new THREE.Vector3(0, 1, 0);
  const bez = (o, a, c, b, u) => { const w = 1 - u; return o.set(w * w * a.x + 2 * w * u * c.x + u * u * b.x, w * w * a.y + 2 * w * u * c.y + u * u * b.y, w * w * a.z + 2 * w * u * c.z + u * u * b.z); };
  const backOut = u => u <= 0 ? 0 : u >= 1 ? 1 : 1 + 2.7 * Math.pow(u - 1, 3) + 1.7 * Math.pow(u - 1, 2); // 花彈出來時稍微大一點再縮回去
  // 同一個形狀的幾層（裡面細而亮、外面粗而淡）合併成一個帶頂點色的網格：加法混色疊起來中間亮、邊緣柔，不是一根實心的白棒子
  const layered = (gs, ks) => {
    let n = 0; const ng = gs.map(g => { const q = g.index ? g.toNonIndexed() : g; n += q.attributes.position.count; return q; });
    const pos = new Float32Array(n * 3), uv = new Float32Array(n * 2), col = new Float32Array(n * 3); let o = 0;
    ng.forEach((g, i) => { const c = g.attributes.position.count; pos.set(g.attributes.position.array, o * 3); uv.set(g.attributes.uv.array, o * 2); col.fill(ks[i], o * 3, (o + c) * 3); o += c; });
    const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.BufferAttribute(pos, 3)); geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2)); geo.setAttribute('color', new THREE.BufferAttribute(col, 3)); return geo;
  };
  const canTex = (w, h, f) => { const c = document.createElement('canvas'); c.width = w; c.height = h; f(c.getContext('2d'), w, h); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t; };

  regionBuild(build);
  regionStep(step);
  MOON.light = light; MOON.dev = dev; MOON.st = ST; // st：給測試與主控台看演出進度

  // ---------- 石柱的材質：一面一個顏色的石頭；石頭與記號（aGl＝[第幾根, 發光的比重]）沒亮時是暗暗的那一區顏色，亮了自己發光（夜裡更亮） ----------
  function pillarMat(U) {
    const m = new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: .85, metalness: 0 });
    m.onBeforeCompile = sh => {
      sh.uniforms.uLit = U.lit; sh.uniforms.uNight = U.night;
      sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nattribute vec2 aGl;\nuniform vec4 uLit;\nvarying vec2 vG;')
        .replace('#include <begin_vertex>', '#include <begin_vertex>\nvG = vec2(aGl.x < -0.5 ? 0.0 : dot(uLit, vec4(equal(vec4(aGl.x), vec4(0.0, 1.0, 2.0, 3.0)))), aGl.y);');
      sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nuniform float uNight;\nvarying vec2 vG;')
        .replace('#include <color_fragment>', '#include <color_fragment>\nif (vG.y > 0.0) diffuseColor.rgb *= mix(0.4, 1.0, clamp(vG.x, 0.0, 1.0));')
        .replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\ntotalEmissiveRadiance += vColor.rgb * vG.x * vG.y * (0.35 + 0.95 * uNight);');
    };
    m.customProgramCacheKey = () => 'moonPillar'; return m;
  }
  // 柱身的記號（F＝刻記號那一面，+z 朝外）：海岸＝兩道浪、火山＝冒煙的山、雪原＝雪花、月光洞窟＝月牙
  function emblem(k, put, F) {
    const E = (g, m) => put(g, HEX[k], F.clone().multiply(m), k, .6);
    if (k === 0) [-1, 1].forEach(s => E(new THREE.TorusGeometry(.075, .026, 4, 8, Math.PI), M4(s * .08, -.03, 0)));
    else if (k === 1) { E(new THREE.ConeGeometry(.15, .2, 3), M4(0, -.02, 0, 0, 0, 0, 1, 1, .35)); E(new THREE.SphereGeometry(.04, 5, 3), M4(.04, .14, 0)); }
    else if (k === 2) [0, 1, 2].forEach(i => E(new THREE.BoxGeometry(.26, .035, .03), M4(0, 0, 0, 0, 0, i * Math.PI / 3)));
    else E(new THREE.TorusGeometry(.1, .032, 4, 10, Math.PI * 1.2), M4(0, 0, 0, 0, 0, Math.PI * .4));
  }
  // 巨樹的樹冠（buildLandmarks 的 7 團、每團 IcosahedronGeometry(1, 1)＝240 個頂點，放大 1.9 倍）：量每一團的範圍，挑露在外面的面（不在別團裡面）放花
  function canopyOf(L0) {
    const can = L0 && L0.near.find(o => o.isMesh && o.material && typeof o.material.customProgramCacheKey === 'function' && /^wind/.test(o.material.customProgramCacheKey()));
    if (!can) return null; const pa = can.geometry.attributes.position, nb = pa.count / 240; if (!nb || nb !== Math.floor(nb)) return null;
    const blobs = [];
    for (let bi = 0; bi < nb; bi++) { const mn = new THREE.Vector3(1e9, 1e9, 1e9), mx = new THREE.Vector3(-1e9, -1e9, -1e9); for (let i = bi * 240; i < bi * 240 + 240; i++) { _v.fromBufferAttribute(pa, i); mn.min(_v); mx.max(_v); } blobs.push({ c: mn.clone().add(mx).multiplyScalar(.5), e: mx.clone().sub(mn).multiplyScalar(.5) }); }
    const faces = [], a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3();
    for (let f = 0; f < pa.count / 3; f++) {
      a.fromBufferAttribute(pa, f * 3); b.fromBufferAttribute(pa, f * 3 + 1); c.fromBufferAttribute(pa, f * 3 + 2); const bi = Math.floor(f * 3 / 240), p = a.clone().add(b).add(c).divideScalar(3);
      const n = b.clone().sub(a).cross(c.clone().sub(a)).normalize(); if (n.dot(_v.copy(p).sub(blobs[bi].c)) < 0) n.negate();
      if (blobs.some((o, j) => j !== bi && _v.copy(p).sub(o.c).divide(o.e).length() < .93)) continue; faces.push({ p, n });
    }
    let top = blobs[0]; blobs.forEach(o => { if (o.c.y + o.e.y > top.c.y + top.e.y) top = o; });
    return { can, faces, hitL: new THREE.Vector3(top.c.x, top.c.y + top.e.y * .55, top.c.z) };
  }

  function build() {
    if (!S.moon) S.moon = moonSan(null, S.codex); if (LOW) { NB = 130; NPET = 60; NMOTE = 40; }
    const sc = W.scene, [rx, rz] = RUINS, ry = H(rx, rz) - .1, rd = seeded(4242), col = HEX.map(h => new THREE.Color(h)), moonC = new THREE.Color('#dfe6ff');
    // ---- 四根石柱：底座、略帶起伏的柱身、那一區顏色的環帶、柱頭、托著石頭的小石盆與四顆石珠、底座上一團苔蘚、柱頂的石頭、內外兩面的記號 ----
    const parts = [], gl = [], tops = [];
    const put = (g, c, m, k = -1, w = 0) => { parts.push([g, c, m]); gl.push([g.index ? g.index.count : g.attributes.position.count, k, w]); };
    DIR.forEach(([dx, dz], k) => {
      const px = rx + dx * RAD, pz = rz + dz * RAD, py = H(px, pz) - .08, base = new THREE.Matrix4().makeTranslation(px, py, pz).multiply(new THREE.Matrix4().makeRotationY(Math.atan2(dx, dz)));
      const T = (...a) => base.clone().multiply(M4(...a)), stone = ['#a8a29e', '#9ca3af', '#a39e98', '#a5a1a8'][k];
      put(new THREE.CylinderGeometry(.66, .76, .32, 8), '#8b9096', T(0, .16, 0, 0, .2));
      put(jit(new THREE.CylinderGeometry(.34, .4, 1.5, 8, 2), .05, 60 + k), stone, T(0, 1.07, 0, 0, .2));
      put(new THREE.CylinderGeometry(.415, .415, .13, 8), HEX[k], T(0, 1.5, 0, 0, .2), k, .45);
      put(new THREE.CylinderGeometry(.52, .38, .26, 8), '#9ca3af', T(0, 1.95, 0, 0, .2));
      put(new THREE.CylinderGeometry(.36, .25, .14, 8), '#8f8a84', T(0, 2.15, 0, 0, .2));
      for (let i = 0; i < 4; i++) { const a = i / 4 * PI2 + .6; put(new THREE.SphereGeometry(.075, 6, 4), '#8f8a84', T(Math.cos(a) * .3, 2.25, Math.sin(a) * .3)); } // 石盆邊上四顆圓圓的石珠扶著石頭
      put(new THREE.SphereGeometry(.32, 6, 3, 0, PI2, 0, Math.PI / 2), '#5b8f3e', T(.4, .3, -.25, 0, 0, 0, 1, .4, .8));
      put(new THREE.IcosahedronGeometry(.25, 0), HEX[k], T(0, 2.5, 0, rd(), rd() * 3, 0, 1, 1.3, 1), k, 1);
      [1, -1].forEach(f => emblem(k, put, T(0, 1.0, f * .385, 0, f > 0 ? 0 : Math.PI, 0)));
      tops.push(new THREE.Vector3(px, py + 2.5, pz)); addCol({ x: px, z: pz, r: .62 });
    });
    const geo = mergeParts(parts), ag = new Float32Array(geo.attributes.position.count * 2); let o = 0;
    gl.forEach(([n, k, w]) => { for (let i = 0; i < n; i++) { ag[(o + i) * 2] = k; ag[(o + i) * 2 + 1] = w; } o += n; });
    geo.setAttribute('aGl', new THREE.BufferAttribute(ag, 2));
    const U = { lit: { value: new THREE.Vector4() }, night: { value: 0 } }, pm = mesh(geo, pillarMat(U), 0, 0, 0, sc); pm.castShadow = pm.receiveShadow = !LOW;
    // ---- 光暈、光點、聚光的粒子：同一組 Points（每點自己的大小，公尺；加法混色、不寫深度） ----
    const N = IX.mote + NMOTE, gp = new Float32Array(N * 3), gc = new Float32Array(N * 3), gs = new Float32Array(N), gg = new THREE.BufferGeometry();
    gg.setAttribute('position', new THREE.BufferAttribute(gp, 3).setUsage(THREE.DynamicDrawUsage)); gg.setAttribute('aCol', new THREE.BufferAttribute(gc, 3).setUsage(THREE.DynamicDrawUsage)); gg.setAttribute('aSz', new THREE.BufferAttribute(gs, 1).setUsage(THREE.DynamicDrawUsage));
    let pmax = 256; try { const g = W.r.getContext(), r = g.getParameter(g.ALIASED_POINT_SIZE_RANGE); if (r && r[1]) pmax = Math.min(512, r[1]); } catch (e) { }
    const gm = new THREE.ShaderMaterial({
      uniforms: { uScale: { value: 400 }, uMax: { value: pmax } }, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
      vertexShader: 'attribute vec3 aCol; attribute float aSz; uniform float uScale; uniform float uMax; varying vec3 vC;\nvoid main(){ vC = aCol; vec4 mv = modelViewMatrix * vec4(position, 1.0);\n if (aSz <= 0.0) { gl_Position = vec4(2.0, 2.0, 2.0, 1.0); gl_PointSize = 0.0; return; }\n gl_PointSize = clamp(aSz * uScale / max(0.3, -mv.z), 1.0, uMax); gl_Position = projectionMatrix * mv; }',
      fragmentShader: 'varying vec3 vC;\nvoid main(){ float r = length(gl_PointCoord - 0.5) * 2.0; if (r > 1.0) discard; float a = 1.0 - r; gl_FragColor = vec4(vC * (a * a * 0.55 + a * 0.35 + smoothstep(0.35, 0.0, r) * 0.8), 1.0);\n#include <colorspace_fragment>\n}',
    });
    gg.boundingSphere = new THREE.Sphere(new THREE.Vector3(rx, ry + 3, rz), RAD + 3); // 平常只有四個光暈：背對遺跡時不畫；光點與演出飛過整個山谷時關掉剔除（step）
    const pts = new THREE.Points(gg, gm); pts.visible = false; sc.add(pts);
    // ---- 光柱（柱子亮起時的一道細光、開花時從天上落下的月光）與月光的弧線：各一個單一實例的 InstancedMesh，平常 count＝0 ----
    const addM = (map, c) => new THREE.MeshBasicMaterial({ map, color: c, vertexColors: true, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, forceSinglePass: true, fog: false, toneMapped: false });
    const grad = canTex(4, 128, (g, w, h) => { const gr = g.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, '#000'); gr.addColorStop(.5, '#3a3a3a'); gr.addColorStop(.9, '#fff'); gr.addColorStop(1, '#fff'); g.fillStyle = gr; g.fillRect(0, 0, w, h); }); // 上淡下亮（圓柱 uv 的 y：底＝0）
    const colM = addM(grad, '#ffffff'), colIM = new THREE.InstancedMesh(layered([1, .55, .25].map(r => new THREE.CylinderGeometry(r, r, 1, 16, 1, true).translate(0, .5, 0)), [.18, .35, .6]), colM, 1); colIM.count = 0; colIM.frustumCulled = false; sc.add(colIM);
    // ---- 巨樹：樹冠上露在外面的面放花（和樹冠同一個位置、同樣放大，風吹的擺動也照 windMat 的公式）、飄落的花瓣 ----
    const L0 = typeof LMS !== 'undefined' ? LMS.find(l => l.id === 'tree') : null, cp = canopyOf(L0), orb = new THREE.Vector3(rx, ry + ORB_Y, rz);
    let hit = null, bim = null, bmat = null, bl = [], bw = [], beamIM = null, beamM = null, flowT = null, curve = null, pim = null, petM = null, tx = 0, tz = 0;
    if (cp) {
      const can = cp.can; can.updateMatrixWorld(true); hit = can.localToWorld(cp.hitL.clone()); tx = can.position.x; tz = can.position.z;
      // 一朵花：五片微微翹起的花瓣＋花心（約 58 個三角形；樹冠放大 1.9 倍後直徑約 1 公尺，遠遠看得出是一朵一朵的花）
      const petals = []; for (let k = 0; k < 5; k++) { const a = k / 5 * PI2; petals.push([new THREE.SphereGeometry(1, 5, 2), '#ffffff', M4(Math.cos(a) * .15, .03, Math.sin(a) * .15, 0, -a, .35, .18, .045, .12)]); }
      petals.push([new THREE.OctahedronGeometry(.075, 0), '#ffe9a8', M4(0, .07, 0)]);
      bmat = new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: .65, metalness: 0, emissive: new THREE.Color('#ffb3d9'), emissiveIntensity: 0 });
      bmat.onBeforeCompile = sh => { // 跟著樹冠擺：windMat 的公式（樹冠不是 InstancedMesh，wIp＝0；高度用這朵花在樹冠座標的 y）
        sh.uniforms.uWind = W.wind; sh.uniforms.uWAmp = { value: .0007 };
        sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nuniform float uWind;\nuniform float uWAmp;').replace('#include <project_vertex>', `vec4 mvPosition = vec4(transformed, 1.0);
          #ifdef USE_INSTANCING
            mvPosition = instanceMatrix * mvPosition; float wH = max(instanceMatrix[3][1], 0.0);
          #else
            float wH = 0.0;
          #endif
          float wS = sin(uWind * 1.6) * 0.7 + sin(uWind * 3.7) * 0.3; mvPosition.x += (wS + 0.35) * uWAmp * wH * wH; mvPosition.z += cos(uWind * 1.3) * uWAmp * 0.5 * wH * wH;
          mvPosition = modelViewMatrix * mvPosition; gl_Position = projectionMatrix * mvPosition;`);
      };
      bmat.customProgramCacheKey = () => 'moonBloom';
      bim = new THREE.InstancedMesh(mergeParts(petals), bmat, NB); bim.position.copy(can.position); bim.scale.copy(can.scale); bim.castShadow = false; bim.receiveShadow = !LOW;
      if (!can.geometry.boundingSphere) can.geometry.computeBoundingSphere(); bim.boundingSphere = can.geometry.boundingSphere.clone(); bim.boundingSphere.radius += .6;
      const pal = ['#ffc4e1', '#ffa8d2', '#ffd9ec', '#fff0f7', '#f9c4ff', '#ff9fcb'].map(h => new THREE.Color(h)), cand = cp.faces.filter(f => f.n.y > -.25 || rd() < .45);
      for (let i = cand.length - 1; i > 0; i--) { const j = Math.floor(rd() * (i + 1)); [cand[i], cand[j]] = [cand[j], cand[i]]; }
      const far = Math.max(1, ...cand.map(f => f.p.distanceTo(cp.hitL)));
      cand.slice(0, NB).forEach((f, i) => {
        const q = new THREE.Quaternion().setFromUnitVectors(UP, f.n).multiply(new THREE.Quaternion().setFromAxisAngle(UP, rd() * PI2)), p = f.p.clone().addScaledVector(f.n, .06);
        bl.push({ p, q, s: .8 + rd() * .45, d: f.p.distanceTo(cp.hitL) / far * 2.8 + rd() * .5 }); bw.push(can.localToWorld(p.clone())); bim.setColorAt(i, pal[i % pal.length]);
      });
      bim.count = 0; if (bim.instanceColor) bim.instanceColor.needsUpdate = true; sc.add(bim); L0.near.push(bim); // 跟著巨樹一起遠近切換（120 公尺外只畫剪影）
      // 月光的弧線：遺跡上空 → 越過山谷中央（最高約 40 m）→ 樹頂；流動的光紋（貼圖往前捲）、三層的光（裡亮外淡）
      const mid = orb.clone().lerp(hit, .5); mid.y += 55; curve = new THREE.QuadraticBezierCurve3(orb.clone(), mid, hit.clone());
      flowT = canTex(128, 4, (g, w, h) => { for (let x = 0; x < w; x++) { const v = Math.round(255 * (.42 + .58 * Math.pow(.5 + .5 * Math.sin(x / w * PI2), 3))); g.fillStyle = `rgb(${v},${v},${v})`; g.fillRect(x, 0, 1, h); } });
      flowT.wrapS = THREE.RepeatWrapping; flowT.repeat.set(10, 1);
      // 弧線依進度只畫到前面一段：alphaMap 是左白右黑的一條（夾在邊緣），offset 往左移＝露出來的部分往樹那頭長（三層的 uv 都是沿著弧線 0→1，一起長）
      const rev = canTex(256, 1, (g, w) => { const gr = g.createLinearGradient(0, 0, w, 0); gr.addColorStop(0, '#fff'); gr.addColorStop(.47, '#fff'); gr.addColorStop(.5, '#000'); gr.addColorStop(1, '#000'); g.fillStyle = gr; g.fillRect(0, 0, w, 1); });
      rev.colorSpace = THREE.NoColorSpace;
      beamM = addM(flowT, '#ffffff'); beamM.alphaMap = rev; beamIM = new THREE.InstancedMesh(layered([.6, .3, .13].map(r => new THREE.TubeGeometry(curve, LOW ? 48 : 80, r, 8, false)), [.15, .3, .7]), beamM, 1); beamIM.count = 0; beamIM.frustumCulled = false; sc.add(beamIM);
      // 花瓣：小小的橢圓，邊落邊翻；位置在世界座標（每格只寫還在飄的那幾片）
      const pg = new THREE.CircleGeometry(1, 6); pg.scale(.1, .15, 1);
      petM = new THREE.MeshStandardMaterial({ color: '#ffffff', side: THREE.DoubleSide, roughness: .8, metalness: 0, emissive: new THREE.Color('#ffc6e6'), emissiveIntensity: 0 });
      pim = new THREE.InstancedMesh(pg, petM, NPET); pim.count = 0; pim.boundingSphere = new THREE.Sphere(new THREE.Vector3(tx, hit.y * .5, tz), 34); // 花瓣只在巨樹附近飄：背對巨樹就不畫
      pim.castShadow = false; pim.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      for (let i = 0; i < NPET; i++) pim.setColorAt(i, pal[(i * 7) % pal.length]); if (pim.instanceColor) pim.instanceColor.needsUpdate = true; sc.add(pim);
    } else console.warn('月光回來：找不到巨樹的樹冠，花與月光的弧線先不做');
    ST.b = { pm, U, pts, gm, gg, gp, gc, gs, tops, col, moonC, pinkC: new THREE.Color('#ffd9ef'), orb, hit, curve, colIM, colM, beamIM, beamM, flowT, bim, bmat, bl, bw, pim, petM, pets: [], tx, tz, rx, rz, L0,
      gather: tops.map(t => new THREE.Vector3(t.x * .7 + orb.x * .3, orb.y + 1.8, t.z * .7 + orb.z * .3)),
      occ: [...tops.map(t => [new THREE.Vector3(t.x - .58, t.y - .75, t.z - .58), new THREE.Vector3(t.x + .58, t.y + .4, t.z + .58)]), ...((W.ruinsSign && W.ruinsSign.userData.occ) || [])] }; // 會擋住遺跡名牌的東西（盒子）：柱頭＋石盆＋石頭（離地 1.75～2.9 m）、北側的拱門（game.js）
    if (W.ruinsSign) W.ruinsSign.renderOrder = 5; // 名牌在光暈、光球、光柱、月光的弧線（都是 0）之後才畫：加法混色的光只會在牌子後面，不會把字洗白
    for (let k = 0; k < 4; k++) ST.lit[k] = (S.moon.l >> k) & 1;
    if (S.moon.b) { bloomSet(1); if (!hasPaper('moon')) S.papers.push({ id: 'moon', t: Date.now() }); } // 開過花卻還沒收進手帳（演到一半關掉）：直接補收
  }

  // ---------- 一根柱子亮起來：有人在看（在戶外）就從手邊飛一顆光點過去，到了才亮、敲鐘；否則直接亮 ----------
  function light(k, show) {
    if (!ST.b) return;
    if (!(show && W.ready && P && !TITLE.on && !INTRO.on && !RIDE.on && !CV.c && !inCity())) { ST.lit[k] = 1; return; }
    if (!ST.q.includes(k) && !(ST.wisp && ST.wisp.k === k)) ST.q.push(k);
  }
  // 光點從手心出發（看得到手就是手心，否則是畫面右下手的位置）：不從畫面正中央冒出一大團白光
  function wispGo(k) {
    const b = ST.b, cam = W.cam, s = typeof VM !== 'undefined' && VM.palm && VM.g && VM.g.visible ? VM.palm.getWorldPosition(new THREE.Vector3()) : cam.localToWorld(new THREE.Vector3(.28, -.24, -.7)), e = b.tops[k], d = s.distanceTo(e);
    const c = s.clone().lerp(e, .5); c.y = Math.max(s.y, e.y) + clamp(d * .35, 4, 36);
    ST.wisp = { k, s, c, e, t: 0, T: clamp(d / 20, 2, 6) }; ST.calm = 0; chime(s);
  }
  function wispStep(dt) {
    const w = ST.wisp; w.t += dt; if (w.t < w.T) return;
    ST.wisp = null; ST.lit[w.k] = 1; ST.fl[w.k] = 1; ST.calm = 0; bell(NOTE[w.k], 1, w.e); if (!ST.show) ST.pulse = { k: w.k, t: 0 };
  }
  // 等著飛的光點：做好的那一刻多半在介面裡（手作台的桌墊、產線、拿著紙、暫停選單…，和手上的紙同一套 paperBusy），光點飛在介面後面就看不到
  // 「做好捏捏 → 柱子亮」的關係；所以先排著，等介面關掉、鏡頭回到眼睛 0.5 秒後才從手心飛出去。已經走進山洞、城市、上了車：不飛了，柱子直接亮（step 下一格補亮）
  function wispWait(dt) {
    if (!W.ready || TITLE.on || RIDE.on || CV.c || inCity()) { ST.q.length = 0; ST.qt = 0; return; }
    if ((typeof paperBusy === 'function' ? paperBusy() : !!GUI.kind) || (typeof PAPER !== 'undefined' && PAPER.q.length)) { ST.qt = 0; return; } // 有紙排著要拿出來（教學、收據…）：讓紙先，讀完收起來再飛
    if ((ST.qt += dt) > .5) { ST.qt = 0; wispGo(ST.q.shift()); }
  }
  // 柱子亮起的那一下：石頭上方一道細光柱往上長、慢慢淡掉
  function pulseStep(dt) {
    const p = ST.pulse, b = ST.b; p.t += dt; if (p.t > 3.2 || ST.show) { b.colIM.count = 0; ST.pulse = null; return; }
    const g = smooth(0, .5, p.t); setCol(b.tops[p.k], .45 + .3 * (1 - g), 20 * g, b.col[p.k], (1 - smooth(.6, 3.2, p.t)) * .75);
  }
  function setCol(pos, r, h, c, k) {
    const b = ST.b; b.colIM.count = 1; _m.compose(pos, _q.identity(), _s.set(r, Math.max(.01, h), r)); b.colIM.setMatrixAt(0, _m); b.colIM.instanceMatrix.needsUpdate = true; b.colM.color.copy(c).multiplyScalar(k);
  }

  // ---------- 開花：四根都亮之後的第一個夜晚 ----------
  const valley = () => W.ready && !!P && !TITLE.on && !INTRO.on && !RIDE.on && !CV.c && !inCity() && W.zoneNow === 'forest';
  const canShow = () => S.moon.l === 15 && !S.moon.b && !!ST.b.curve && !ST.wisp && !ST.q.length && ST.calm > 4 && DN.phase === 'night' && DN.t < 515 && valley() && !GUI.kind && !M.active && !L.on && !(typeof TK !== 'undefined' && TK.on);
  function startShow() {
    const b = ST.b; ST.show = { t: 0, boost: 0, orb: 0, gather: 0, flow: 0, reveal: 0, crown: 0, flash: 0, bloomed: false, grown: false }; ST.pulse = null; bloomSet(0); // 花在演出裡才開
    [0, 1, 2, 3].forEach(k => bell(NOTE[k], .8, b.tops[k], k * .42)); showMusic();
  }
  // 時間軸（秒）：0 四顆石頭變亮、光從四根柱子聚到遺跡上空 → 2 月光從天上落到光球 → 5 光從遺跡劃一道弧線飛過山谷 → 9 落在樹頂、巨樹從樹頂開始開花（約 4 秒開滿）、花瓣飄下
  // → 15 光柱與弧線淡掉 → 22 結束，從口袋拿出手帳的一頁
  function showStep(dt) {
    const s = ST.show, b = ST.b; s.t += dt; const t = s.t;
    s.boost = 1.1 * smooth(0, 1.4, t) * (1 - smooth(16, 20, t)); s.orb = 2.4 * smooth(1.5, 4.5, t) * (1 - smooth(15, 19.5, t));
    s.gather = smooth(0, .6, t) * (1 - smooth(4.2, 5.2, t)); s.flow = smooth(4.8, 5.6, t) * (1 - smooth(15, 19, t)); s.reveal = ease3(clamp((t - 5) / 4, 0, 1));
    s.crown = t < 8.6 ? 0 : 9 * smooth(8.6, 9.1, t) * Math.exp(-Math.max(0, t - 9.1) * 1.3) + 3 * smooth(9, 9.5, t) * (1 - smooth(14, 19, t));
    s.flash = t < 9 ? 0 : 1.4 * Math.exp(-(t - 9) * 1.1); // crown：月光落在樹頂那一下亮一大團，之後留一團淡淡的光；flash：花剛開時自己亮一下
    ST.duck = 1 - .72 * smooth(0, 1.5, t) * (1 - smooth(19, 22, t)); // 平常的配樂讓位給開花的曲子
    const cf = smooth(2, 2.6, t) * (1 - smooth(15, 19, t));
    if (cf > .001) { const h = 70 * smooth(2, 4.2, t); setCol(_v2.set(b.orb.x, b.orb.y + 70 - h, b.orb.z), 1.3, h, b.moonC, .42 * cf); } else b.colIM.count = 0;
    const bf = smooth(5, 5.3, t) * (1 - smooth(15.5, 19.5, t));
    if (bf > .001 && s.reveal > 0) { b.beamIM.count = 1; b.beamM.alphaMap.offset.x = .5 - s.reveal; b.beamM.color.copy(b.moonC).multiplyScalar(bf * .6); b.flowT.offset.x -= dt * .9; } else b.beamIM.count = 0;
    if (t >= 9 && !s.bloomed) { s.bloomed = true; S.moon.b = 1; saveCloud(); tint(); } // 開花那一刻就記進存檔：之後關掉也不會重演一次
    if (s.bloomed && !s.grown) s.grown = bloomGrow(t - 9);
    if (t > 22) { ST.show = null; ST.duck = 1; ST.calm = 0; b.colIM.count = 0; b.beamIM.count = 0; bloomSet(1); try { openPaper(PAPERS.moon, null, { soft: true }); } catch (e) { console.error(e); } }
  }
  // 每朵花依「離樹頂多遠」的延遲彈出來；全部開完回傳 true
  function bloomGrow(bt) {
    const b = ST.b; if (!b.bim) return true; let all = true;
    b.bl.forEach((o, i) => { const u = clamp((bt - o.d) / .7, 0, 1); if (u < 1) all = false; _m.compose(o.p, o.q, _s.setScalar(o.s * backOut(u) + 1e-4)); b.bim.setMatrixAt(i, _m); });
    b.bim.count = b.bl.length; b.bim.instanceMatrix.needsUpdate = true; if (all) ST.bloom = 1; return all;
  }
  function bloomSet(on) {
    const b = ST.b; ST.bloom = on ? 1 : 0; if (!b.bim) return;
    if (!on) { b.bim.count = 0; return; } bloomGrow(99); tint();
  }
  function tint() { const b = ST.b; if (ST.tint || !b.L0) return; ST.tint = true; b.L0.col.lerp(new THREE.Color('#e9a3cb'), .4); } // 遠景剪影帶一點粉紅（landmarkStep 每格用這個顏色）

  // ---------- 花瓣：開花時一口氣飄下來；之後夜裡在巨樹附近偶爾飄幾片（白天不飄） ----------
  function petalStep(dt, t, away) {
    const b = ST.b; if (!b.pim) return; const cam = W.cam.position, d = Math.hypot(cam.x - b.tx, cam.z - b.tz);
    if (away || d > 140) { if (b.pim.count) b.pim.count = 0; b.pets.length = 0; return; }
    const want = ST.show && ST.show.t > 9.2 ? NPET : ST.bloom && d < 90 ? Math.round(NPET * .22 * smooth(.3, .9, DN.night)) : 0;
    ST.petAcc += dt * (ST.show ? 60 : 2.5); while (ST.petAcc >= 1 && b.pets.length < want) { ST.petAcc -= 1; b.pets.push(petal()); } if (b.pets.length >= want) ST.petAcc = 0;
    if (!b.pets.length) { if (b.pim.count) b.pim.count = 0; return; }
    let n = 0;
    for (let i = b.pets.length - 1; i >= 0; i--) {
      const p = b.pets[i]; p.y -= p.vy * (.7 + .3 * Math.sin(t * 3 + p.ph)) * dt; p.x += (.35 + Math.sin(t * .7 + p.ph) * .5) * dt; p.z += Math.cos(t * .9 + p.ph * 2) * .35 * dt; p.a += p.sp * dt;
      if (p.y < p.gy) { b.pets.splice(i, 1); continue; }
      _m.compose(_v.set(p.x, p.y, p.z), _q.setFromAxisAngle(p.ax, p.a), _s.setScalar(smooth(p.gy, p.gy + .4, p.y))); b.pim.setMatrixAt(n++, _m);
    }
    b.pim.count = n; b.pim.instanceMatrix.needsUpdate = true;
  }
  function petal() {
    const b = ST.b, w = b.bw[Math.floor(Math.random() * b.bw.length)], x = w.x + rnd(-.4, .4), z = w.z + rnd(-.4, .4);
    return { x, y: w.y - rnd(0, .3), z, gy: H(x, z) + .03, vy: rnd(.7, 1.2), ph: rnd(0, PI2), ax: new THREE.Vector3(rnd(-1, 1), rnd(-1, 1), rnd(-1, 1)).normalize(), a: rnd(0, PI2), sp: rnd(1.5, 4) };
  }

  // ---------- Points：光暈、光點與拖尾、光球、樹頂的光、聚光的粒子（每格整組重寫，約 100 點） ----------
  function glowStep(t, nite) {
    const b = ST.b, s = ST.show, gp = b.gp, gc = b.gc, gs = b.gs; gs.fill(0);
    const P3 = (i, v, c, k, sz) => { gp[i * 3] = v.x; gp[i * 3 + 1] = v.y; gp[i * 3 + 2] = v.z; gc[i * 3] = c.r * k; gc[i * 3 + 1] = c.g * k; gc[i * 3 + 2] = c.b * k; gs[i] = sz; };
    for (let k = 0; k < 4; k++) if (ST.lit[k] > 0) P3(k, b.tops[k], b.col[k], (.4 + .5 * nite) * (1 + ST.fl[k]), (.85 + .85 * nite) * (1 + .08 * Math.sin(t * 1.7 + k * 2)) * (1 + ST.fl[k] * 1.4 + (s ? s.boost * .6 : 0)));
    const w = ST.wisp;
    if (w) { // 離鏡頭近的時候跟著距離縮小（最大約占 10° 視角）：剛離開手心時是手上一顆小小的光，不是蓋住準星的一大團
      const u = Math.min(1, w.t / w.T), cp = W.cam.position;
      for (let j = 0; j < 7; j++) { const uj = u - j * .022; if (uj < 0) break; bez(_v, w.s, w.c, w.e, ease3(uj)); P3(IX.wisp + j, _v, b.col[w.k], (j ? 1 : 1.5) * (1 - j / 8), (j ? 1 : 1.6) * (1 - j / 7.5) * (1 + .15 * Math.sin(t * 14)) * clamp(_v.distanceTo(cp) / 9, .06, 1)); }
    }
    if (!s) return;
    if (s.orb > .01) P3(IX.orb, b.orb, b.moonC, 1, s.orb * (1 + .08 * Math.sin(t * 5)));
    if (s.crown > .01 && b.hit) P3(IX.crown, b.hit, b.pinkC, 1, s.crown);
    for (let j = 0; j < NMOTE; j++) {
      const h = (j * .618034) % 1, i = IX.mote + j;
      if (s.gather > .01) { const k = j % 4, u = (s.t * .55 + h) % 1; bez(_v, b.tops[k], b.gather[k], b.orb, u); _c.copy(b.col[k]).lerp(b.moonC, u); P3(i, _v, _c, 1, .34 * s.gather * Math.sqrt(Math.sin(Math.PI * u))); }
      else if (s.flow > .01 && b.curve) { const u = ((s.t - 5) * .16 + h) % 1; if (u > s.reveal) continue; b.curve.getPoint(u, _v); _v.x += Math.sin(t * 2 + j * 1.7) * .45; _v.y += Math.cos(t * 2.3 + j * 1.3) * .45; _v.z += Math.sin(t * 1.7 + j * 2.1) * .45; P3(i, _v, b.moonC, .9, .8 * s.flow); }
    }
  }

  // ---------- 古代遺跡的名牌（game.js，遺跡正中央 5.6 m 高）：四根柱子圍著它，沿著柱子的方向走近時（約 6～8 m）柱頂的石頭正好擋在牌子前面；北側斷掉的拱門也會 ----------
  // 牌子上的字不能被擋：從鏡頭往牌子上有字的範圍（「古代遺跡」與底下一行小字，約 1.7×0.5 m）的 5×3 個點拉線，有一條穿過這些東西（各用一個盒子估，寧可估大）時，牌子不做深度測試、畫在它們上面；
  // 沒擋到的時候照常做深度測試（樹、手、拿著的紙還是在牌子前面）。牌子在光暈、光柱之後才畫（build 的 renderOrder），加法混色的光不會把字洗白
  const SEG = [0, 1], SGV = [-.28, 0, .24]; // 線段穿過盒子的那一段（slab 法，每格重用）；牌子上有字的三排高度
  const slab = (o, d, lo, hi) => { if (Math.abs(d) < 1e-9) return o >= lo && o <= hi; let u = (lo - o) / d, w = (hi - o) / d; if (u > w) { const s = u; u = w; w = s; } if (u > SEG[0]) SEG[0] = u; if (w < SEG[1]) SEG[1] = w; return SEG[0] <= SEG[1]; };
  function signStep(cam) {
    const lb = W.ruinsSign; if (!lb) return; let over = false;
    if (lb.visible) {
      const p = lb.position, rl = Math.hypot(p.x - cam.x, p.z - cam.z) || 1, rx = -(p.z - cam.z) / rl, rz = (p.x - cam.x) / rl; // 牌子面向鏡頭：右＝水平、垂直於視線
      for (let i = 0; i < 15 && !over; i++) {
        const h = (i % 5 - 2) * .43, x = p.x + rx * h - cam.x, y = p.y + SGV[Math.floor(i / 5)] - cam.y, z = p.z + rz * h - cam.z; // 牌子 2.4×0.75 m，字在左右 ±0.85、上 0.24～下 0.28 m 之間
        for (const [a, c] of ST.b.occ) { SEG[0] = 0; SEG[1] = 1; if (slab(cam.x, x, a.x, c.x) && slab(cam.y, y, a.y, c.y) && slab(cam.z, z, a.z, c.z)) { over = true; break; } }
      }
    }
    if (lb.material.depthTest === over) lb.material.depthTest = !over;
  }

  // ---------- 每一格 ----------
  function step(dt, t) {
    const b = ST.b; if (!b || !P) return;
    for (let k = 0; k < 4; k++) { const on = (S.moon.l >> k) & 1, wait = ST.q.includes(k) || (ST.wisp && ST.wisp.k === k); ST.lit[k] = on && !wait ? 1 : 0; ST.fl[k] = Math.max(0, ST.fl[k] - dt / 1.6); } // 讀檔補亮、開發者工具：沒在等光點的直接亮
    ST.calm += dt; if (ST.wisp) wispStep(dt); else if (ST.q.length) wispWait(dt);
    if (ST.pulse) pulseStep(dt);
    if (ST.show) showStep(dt); else if (canShow()) startShow();
    const nite = DN.night, sb = ST.show ? ST.show.boost : 0, away = inCity() || !!CV.c, cam = W.cam.position;
    const lk = k => ST.lit[k] * (1 + ST.fl[k] * 1.6 + sb); b.U.night.value = nite; b.U.lit.value.set(lk(0), lk(1), lk(2), lk(3));
    const on = !away && (!!ST.show || !!ST.wisp || (S.moon.l > 0 && Math.hypot(cam.x - b.rx, cam.z - b.rz) < 230));
    b.pts.visible = on; b.pts.frustumCulled = !ST.show && !ST.wisp;
    if (on) { glowStep(t, nite); b.gm.uniforms.uScale.value = W.r.domElement.height / (2 * Math.tan(W.cam.fov * Math.PI / 360)); ['position', 'aCol', 'aSz'].forEach(k => { b.gg.attributes[k].needsUpdate = true; }); }
    signStep(cam);
    petalStep(dt, t, away);
    if (b.bmat && (ST.bloom || ST.show)) { const k = .16 + .32 * nite + (ST.show ? ST.show.flash : 0); b.bmat.emissiveIntensity = k; b.petM.emissiveIntensity = k * .8; } // 花白天也帶一點自己的粉紅（不然側面背光的花看起來是灰紫色），夜裡微微發光
    if (ST.duck < 1 && typeof MUS !== 'undefined') MUS.duck = Math.min(MUS.duck, ST.duck);
  }

  // ---------- 聲音：鐘聲（基音＋低八度的嗡聲＋幾個不和諧的泛音，像真的鐘）、光點出發的叮、開花的曲子；都走內建配樂的殘響 ----------
  function aOut(v, ms) {
    const ac = audio(); if (ac.state !== 'running') return null; const g = ac.createGain(); g.gain.value = v; g.connect(genBus().out);
    setTimeout(() => { try { g.disconnect(); } catch (e) { } }, ms); return g;
  }
  function bell(m, v, pos, when = 0) {
    if (!S.sound) return;
    try {
      const d = pos ? pos.distanceTo(W.cam.position) : 0, out = aOut(.12 * v * clamp(1.25 - d / 150, .35, 1) * (S.vol ? S.vol.sfx : .9), 9000 + when * 1000); if (!out) return; // 越遠越小聲，整個山谷都聽得到
      const ac = AC, t0 = ac.currentTime + .02 + when, f = mtof(m);
      [[.5, .55, 6.5], [1, 1, 5], [1.19, .3, 2.8], [1.5, .2, 2.4], [2, .32, 3.2], [2.52, .14, 1.6], [3.01, .09, 1.1], [4.2, .05, .6]].forEach(([r, a, dd]) => {
        const o = ac.createOscillator(), g = ac.createGain(); o.frequency.value = f * r; g.gain.setValueAtTime(.0001, t0); g.gain.linearRampToValueAtTime(a, t0 + .006); g.gain.exponentialRampToValueAtTime(.0004, t0 + dd);
        o.connect(g); g.connect(out); o.start(t0); o.stop(t0 + dd + .05);
      });
      gNoise(out, t0, .09, 1100, .8, .2, 'lowpass'); // 敲下去的那一下
    } catch (e) { console.warn('月光回來的聲音', e); } // 沒有 WebAudio 之類：不出聲就好，不影響演出
  }
  function chime() { if (!S.sound) return; try { const out = aOut(.9 * (S.vol ? S.vol.sfx : .9), 5000); if (!out) return; const t0 = AC.currentTime + .02; INST.bell(out, t0, 84, .05); INST.bell(out, t0 + .11, 91, .035); INST.musicbox(out, t0 + .22, 96, .025); } catch (e) { console.warn('月光回來的聲音', e); } }
  // 開花的曲子（約 21 秒，F 大調，和森林的配樂同調）：前段卡林巴琴輕輕的分解和弦；9 秒樹頂開花時鐘琴一串往上、音樂盒唱主旋律；最後回到 F 和弦
  function showMusic() {
    try {
      const out = aOut((S.vol ? S.vol.music : .6) * 1.5, 30000); if (!out) return; const t0 = AC.currentTime + .05;
      [[0, [53, 57, 60, 64], 4.5, .02], [4.5, [50, 57, 60, 65], 4.5, .02], [9, [46, 53, 58, 62, 65], 4.5, .024], [13.5, [48, 55, 60, 64, 67], 4, .024], [17.5, [41, 53, 57, 60, 65], 4.5, .026]]
        .forEach(([s, ns, d, v]) => gPad(out, t0 + s, ns, d, { type: 'triangle', cut: 1600, v }));
      [[0, [65, 69, 72, 76]], [4.5, [62, 65, 69, 72]], [9, [70, 74, 77, 81]], [13.5, [72, 76, 79, 84]], [17.5, [65, 69, 72, 77]]].forEach(([s, ch], ci) => {
        const n = ci < 2 ? 9 : 8; for (let i = 0; i < n; i++) INST.kalimba(out, t0 + s + i * .5, ch[[0, 1, 2, 3, 2, 1, 3, 2, 0][i]] + (ci >= 2 && i % 4 === 3 ? 12 : 0), (ci < 2 ? .022 + i * .002 : .032) * (ci === 4 ? 1 - i / 10 : 1));
      });
      [77, 81, 84, 89, 93].forEach((m, i) => INST.bell(out, t0 + 9 + i * .12, m, .045));
      [[9.6, 81], [10.2, 84], [10.8, 89], [12, 88], [12.45, 86], [12.9, 84], [13.9, 86], [14.35, 84], [14.8, 81], [15.8, 79], [16.25, 81], [16.7, 77], [18, 84], [18.5, 89]].forEach(([s, m]) => INST.musicbox(out, t0 + s, m, .06));
      gBass(out, t0 + 9, 46, 4, .05); gBass(out, t0 + 13.5, 48, 3.5, .05); gBass(out, t0 + 17.5, 41, 4, .06); INST.bell(out, t0 + 18, 77, .05); INST.bell(out, t0 + 18.6, 84, .04);
    } catch (e) { console.warn('月光回來的聲音', e); } // 沒有 WebAudio 之類：不出聲就好，不影響演出
  }

  // ---------- 開發者工具（暫停選單）：點亮下一根；四根都亮了就把時間撥到入夜、直接演一次開花（可以重演） ----------
  function dev() {
    if (typeof isDev === 'function' && !isDev()) return toast('只有開發測試帳號可以使用');
    if (!ST.b) return;
    if (S.moon.l !== 15) { const k = [0, 1, 2, 3].find(i => !(S.moon.l & (1 << i))); S.moon.l |= 1 << k; light(k, true); } // 光點排著，等選單關掉才從手心飛出去（wispWait）
    else if (!ST.show && ST.b.curve) { S.moon.b = 0; bloomSet(0); ST.q.length = 0; ST.wisp = null; W.dnOff = (W.dnOff || 0) + (((372 - DN.t) % DAY_LEN) + DAY_LEN) % DAY_LEN; if (GUI.kind) closeGui(); startShow(); } // 先收起選單：演出不在選單後面開始
    saveCloud(); if (GUI.kind === 'pause') ui('pause'); // 選單還開著（點亮了一根）才重繪按鈕上的 n/4
  }
})();
