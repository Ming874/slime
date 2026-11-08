'use strict';
/* ============================================================
   史萊姆捏捏工坊 SQUISH LAB（3D 版）
   捕捉 → 加工(機器產線) → 裝飾 → 銷售(直播/網站) → 升級
   Three.js r158（vendor/three.min.js）+ WebAudio 自製擬音
   ============================================================ */

/* ---------- helpers ---------- */
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const rnd = (a, b) => a + Math.random() * (b - a);
const pick = a => a[Math.floor(Math.random() * a.length)];
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const fmt = n => '¥' + Math.round(n).toLocaleString('en-US');
const PI2 = Math.PI * 2;
function hex2rgb(h) { h = h.replace('#', ''); return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)]; }
function rgba(h, a = 1, mix = 0) {
  const [r, g, b] = hex2rgb(h), m = mix >= 0 ? 255 : 0, w = Math.abs(mix);
  return `rgba(${Math.round(r + (m - r) * w)},${Math.round(g + (m - g) * w)},${Math.round(b + (m - b) * w)},${a})`;
}
function seeded(seed) { let s = (seed * 9301 + 49297) % 233280; return () => (s = (s * 9301 + 49297) % 233280) / 233280; }
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const dot = c => `<i class="dot" style="background:${c}"></i>`;

/* ---------- 資料 ---------- */
const ZONES = [
  { id: 'forest', name: '森林', cost: 0, bg: '#0d2626', ground: '#1d4d3c', acc: '#34d399' },
  { id: 'coast', name: '海岸', cost: 400, bg: '#0b2238', ground: '#b9a77a', acc: '#38bdf8' },
  { id: 'volcano', name: '火山', cost: 1500, bg: '#1f0d10', ground: '#2b1c1c', acc: '#f97316' },
  { id: 'snow', name: '雪原', cost: 3500, bg: '#14243a', ground: '#dbe7f3', acc: '#bae6fd' },
];
const RAR = [null, { n: '普通', c: '#8b9bb0' }, { n: '優良', c: '#34d399' }, { n: '稀有', c: '#e879f9' }, { n: '傳說', c: '#fbbf24' }];
const SPECIES = [
  { id: 'grass', name: '青草史萊姆', zone: 'forest', color: '#6ee7a8', rar: 1, price: 12, w: 10 },
  { id: 'honey', name: '蜂蜜史萊姆', zone: 'forest', color: '#fbbf24', rar: 2, price: 22, w: 4 },
  { id: 'salt', name: '海鹽史萊姆', zone: 'coast', color: '#38bdf8', rar: 1, price: 14, w: 10 },
  { id: 'coral', name: '珊瑚史萊姆', zone: 'coast', color: '#fb7185', rar: 3, price: 38, w: 3 },
  { id: 'lava', name: '熔岩史萊姆', zone: 'volcano', color: '#f97316', rar: 2, price: 28, w: 8 },
  { id: 'obsid', name: '黑曜史萊姆', zone: 'volcano', color: '#8b5cf6', rar: 3, price: 50, w: 3 },
  { id: 'ice', name: '冰晶史萊姆', zone: 'snow', color: '#bae6fd', rar: 2, price: 30, w: 8 },
  { id: 'aurora', name: '極光史萊姆', zone: 'snow', color: '#34d399', color2: '#a78bfa', rar: 4, price: 90, w: 1 },
];
const SP = Object.fromEntries(SPECIES.map(s => [s.id, s]));
const short = id => SP[id].name.replace('史萊姆', '');
/* 3D 幾何裝飾（不使用表情符號） */
const DECO = {
  bead: { n: '珍珠', v: .04, pack: 'base', c: '#f1f5f9' },
  cube: { n: '方塊', v: .04, pack: 'base', c: '#94a3b8' },
  ring: { n: '圓環', v: .05, pack: 'base', c: '#e879f9' },
  cone: { n: '錐體', v: .07, pack: 'metal', c: '#cbd5e1', metal: 1 },
  disc: { n: '圓盤', v: .07, pack: 'metal', c: '#fbbf24', metal: 1 },
  pyramid: { n: '角錐', v: .08, pack: 'metal', c: '#f59e0b', metal: 1 },
  gem: { n: '寶石', v: .10, pack: 'glass', c: '#38bdf8' },
  crystal: { n: '晶柱', v: .10, pack: 'glass', c: '#a78bfa' },
  star: { n: '星晶', v: .10, pack: 'glass', c: '#fde047' },
  orb: { n: '光球', v: .16, pack: 'neon', c: '#22d3ee', glow: 1 },
  knot: { n: '扭結', v: .18, pack: 'neon', c: '#fb7185', glow: 1 },
  drop: { n: '水滴', v: .14, pack: 'neon', c: '#34d399', glow: 1 },
  dodeca: { n: '稜鏡', v: .22, pack: 'prism', c: '#e879f9', metal: 1 },
  helix: { n: '螺旋', v: .25, pack: 'prism', c: '#818cf8', glow: 1 },
  halo: { n: '光環', v: .18, pack: 'prism', c: '#fbbf24', glow: 1 },
};
const PACKS = { metal: { name: '金屬零件包', cost: 200 }, glass: { name: '水晶零件包', cost: 500 }, neon: { name: '霓虹零件包', cost: 1500 }, prism: { name: '稜鏡零件包', cost: 3000 } };
const UPS = {
  net: { name: '採集吸取器', desc: '每次採集多得 1 份凝膠', base: 120, max: 4 },
  slicer: { name: '切片機', desc: '切片步驟的甜蜜區更寬', base: 150, max: 5, mach: 1 },
  coater: { name: '糖晶滾筒機', desc: '裹糖晶步驟的甜蜜區更寬', base: 180, max: 5, mach: 1 },
  dryer: { name: '乾燥烘箱', desc: '乾燥步驟的甜蜜區更寬', base: 210, max: 5, mach: 1 },
  cap: { name: '倉儲貨架', desc: '庫存上限 +6', base: 100, max: 5 },
  shelf: { name: '網站伺服器', desc: '網站貨架 +2 格', base: 200, max: 5 },
  gear: { name: '直播燈光設備', desc: '直播基礎觀眾 +15%', base: 250, max: 5 },
  farm: { name: '養殖槽', desc: '每 12 秒自動產出凝膠（可再生養殖）', base: 300, max: 5 },
};
const NAMES = ['小布丁', '軟糖控', '捏捏狂人', 'ASMR愛好者', '夜貓子', '蛋糕星人', '阿宅', 'Mochi', '果凍妹', '路過的人', '史萊姆粉', '雲朵', '薄荷', '咪咪', '大叔'];
const CHAT_CRUNCH = ['喀滋喀滋，好療癒', '這個聲音太爽了', '耳朵好舒服', '再捏一次！', '好酥好脆', '我要睡著了', '這顏色好美', '手感看起來超棒', '連擊連擊！', '哇啊啊'];
const CHAT_IDLE = ['晚安', '第一次來，好可愛', '主播聲音好好聽', '今天有什麼新貨？', '想要那個顏色', '上架了嗎', '看著就解壓', '捏捏捏捏捏'];
const CHAT_EXPENSIVE = ['有點貴耶…', '價格能再便宜一點嗎', '錢包在哭泣'];
const REVIEWS = { 5: ['超酥脆！回購！', '聲音太療癒了', '完美，五星推薦'], 4: ['不錯，酥脆度很好', '包裝精緻', '值得'], 3: ['普通，還行', '價格普通', '有點軟'], 2: ['不太酥脆…', '有點貴', '期待落差'], 1: ['不脆，貴，失望', '品質不行', '不會再買'] };
const REG_NAMES = ['小綠', '阿花', '暖暖', '大叔', '貓店長', '莓莓', '阿山', '雪兒'];
const BRANCHES = {
  factory: { name: '自家工廠', desc: '雇用員工、架設機械手臂自動量產。重視產能與成本管理：員工會持續領薪水。' },
  corp: { name: '企業合作', desc: '承接大公司的訂單。收入穩定，但必須符合品質與期限，失敗會損失信譽。' },
  shop: { name: '溫馨小店', desc: '經營實體小店。著重顧客關係：記住常客喜好，培養熟客與小費。' },
};

/* ---------- 存檔 ---------- */
const SAVE_KEY = 'slime_squish_v2';
function fresh() {
  return {
    money: 60, fans: 0, earned: 0, gel: {}, stock: [], web: [], price: { live: {}, web: {} },
    zones: ['forest'], packs: ['base'], up: { net: 0, slicer: 0, coater: 0, dryer: 0, cap: 0, shelf: 0, gear: 0, farm: 0 },
    codex: {}, rate: [4, 4, 5], reviews: [], branch: null, workers: 0, auto: 0, rep: 0,
    contracts: [], regulars: {}, customers: [], nextId: 1, last: Date.now(), done: false, sound: true, seen: false, sales: 0,
  };
}
function load() {
  try { const o = JSON.parse(localStorage.getItem(SAVE_KEY)); if (o) return Object.assign(fresh(), o, { up: Object.assign(fresh().up, o.up) }); } catch (e) { }
  return null;
}
let S = load() || fresh();
function save() { S.last = Date.now(); try { localStorage.setItem(SAVE_KEY, JSON.stringify(S)); } catch (e) { } }

/* ---------- 經濟公式 ---------- */
const trend = { sp: null };
const cap = () => 8 + S.up.cap * 6;
const slots = () => 4 + S.up.shelf * 2;
const effCrisp = p => p.crisp * (0.35 + 0.65 * p.dur / 100);
const decoBonus = p => p.deco.reduce((a, d) => a + (DECO[d.k] ? DECO[d.k].v : 0), 0);
const CH = { live: 1.4, web: 0.9, shop: 1.25, corp: 1.5 };
function fair(p, ch) {
  const sp = SP[p.sp];
  return sp.price * (0.4 + 1.1 * effCrisp(p)) * (1 + decoBonus(p)) * (trend.sp === p.sp ? 1.35 : 1) * (CH[ch] || 1);
}
const defPrice = (spId, ch) => Math.round(SP[spId].price * 1.28 * CH[ch]);
const getPrice = (ch, spId) => S.price[ch][spId] ?? defPrice(spId, ch);
const demand = (price, f) => clamp(1.5 - 0.75 * price / Math.max(1, f), 0, 1.3);
const demandLabel = d => d > 0.95 ? ['熱賣', '#fb923c'] : d > 0.55 ? ['穩定', '#34d399'] : d > 0.2 ? ['冷淡', '#8b9bb0'] : ['滯銷', '#38bdf8'];
const unlockedSpecies = () => SPECIES.filter(s => S.zones.includes(s.zone));
function addMoney(n) { S.money += n; if (n > 0) S.earned += n; }
function discover(id) { if (!S.codex[id]) S.codex[id] = { seen: true, made: 0 }; }
function makeProduct(spId, crisp) {
  const p = { id: S.nextId++, sp: spId, crisp, dur: 100, deco: [], cracks: [] };
  discover(spId); S.codex[spId].made++; return p;
}

/* ---------- 音效（WebAudio 自製擬音） ---------- */
let AC = null, NB = null, master = null;
function audio() {
  if (!AC) {
    AC = new (window.AudioContext || window.webkitAudioContext)();
    master = AC.createGain(); master.gain.value = 0.9; master.connect(AC.destination);
    NB = AC.createBuffer(1, AC.sampleRate, AC.sampleRate);
    const d = NB.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  }
  if (AC.state === 'suspended') AC.resume();
  return AC;
}
function noise(ac, t, dur, f, q, vol, type = 'bandpass', rate = 1) {
  const src = ac.createBufferSource(); src.buffer = NB; src.playbackRate.value = rate;
  const fl = ac.createBiquadFilter(); fl.type = type; fl.frequency.value = f; fl.Q.value = q;
  const g = ac.createGain(); g.gain.setValueAtTime(0.0001, t);
  g.gain.linearRampToValueAtTime(vol, t + 0.003); g.gain.exponentialRampToValueAtTime(0.0008, t + dur);
  src.connect(fl); fl.connect(g); g.connect(master); src.start(t, Math.random() * 0.5, dur + 0.05);
}
function tone(f, t0, len, vol, type = 'sine') {
  const ac = AC, o = ac.createOscillator(), g = ac.createGain(); o.type = type; o.frequency.value = f;
  g.gain.setValueAtTime(0.0001, t0); g.gain.linearRampToValueAtTime(vol, t0 + 0.01); g.gain.exponentialRampToValueAtTime(0.0008, t0 + len);
  o.connect(g); g.connect(master); o.start(t0); o.stop(t0 + len + 0.05);
}
const sfx = {
  crunch(power = 1, crisp = 0.8) {
    if (!S.sound) return; const ac = audio(), t = ac.currentTime;
    const n = 3 + Math.floor(Math.random() * (2 + 4 * crisp));
    for (let i = 0; i < n; i++) noise(ac, t + i * rnd(0.006, 0.03), rnd(0.03, 0.09), rnd(1800, 7000) * (0.7 + crisp * 0.5), rnd(0.8, 3), rnd(0.25, 0.6) * power, 'bandpass', rnd(0.7, 1.5));
    noise(ac, t, 0.12, rnd(300, 600), 0.7, 0.25 * power, 'lowpass');
  },
  squish(s = 0.5) { if (!S.sound) return; const ac = audio(); noise(ac, ac.currentTime, rnd(0.08, 0.16), rnd(400, 900), 1.5, 0.18 * s, 'lowpass', rnd(.6, 1)); },
  pop() { if (!S.sound) return; const t = audio().currentTime; [660, 880, 1320].forEach((f, i) => tone(f, t + i * 0.07, 0.25, 0.16)); },
  tick() { if (!S.sound) return; const ac = audio(); noise(ac, ac.currentTime, 0.05, 2500, 2, 0.2); },
  machine(i) {
    if (!S.sound) return; const ac = audio(), t = ac.currentTime;
    if (i === 0) { noise(ac, t, 0.08, 5000, 4, 0.35, 'highpass'); tone(180, t, 0.08, 0.08, 'square'); }
    else if (i === 1) { noise(ac, t, 0.25, 1200, 1, 0.12); tone(90, t, 0.25, 0.1, 'sawtooth'); }
    else { noise(ac, t, 0.35, 600, 0.7, 0.18, 'lowpass'); tone(60, t, 0.3, 0.1, 'triangle'); }
  },
};

/* ---------- Toast / Modal ---------- */
function toast(msg) {
  const d = document.createElement('div'); d.className = 'toast'; d.textContent = msg; $('#toasts').appendChild(d);
  setTimeout(() => d.remove(), 2200);
  while ($('#toasts').children.length > 4) $('#toasts').firstChild.remove();
}
function modal(html, btns = [{ t: '好' }]) {
  $('#mbox').innerHTML = html + '<div class="row" id="mbtns"></div>';
  btns.forEach(b => {
    const e = document.createElement('button'); e.className = 'btn' + (b.ghost ? ' ghost' : ''); e.textContent = b.t;
    e.onclick = () => { $('#modal').hidden = true; b.f && b.f(); }; $('#mbtns').appendChild(e);
  });
  $('#modal').hidden = false;
}

/* ============================================================
   Three.js 共用工具
   ============================================================ */
const RAY = new THREE.Raycaster();
function makeEnv(r) {
  const pm = new THREE.PMREMGenerator(r), es = new THREE.Scene();
  const g = new THREE.SphereGeometry(30, 32, 16), p = g.attributes.position, cols = [];
  const c1 = new THREE.Color('#05080d'), c2 = new THREE.Color('#2b4a66'), t = new THREE.Color();
  for (let i = 0; i < p.count; i++) { t.copy(c1).lerp(c2, clamp(p.getY(i) / 30 * .8 + .4, 0, 1)); cols.push(t.r, t.g, t.b); }
  g.setAttribute('color', new THREE.Float32BufferAttribute(cols, 3));
  es.add(new THREE.Mesh(g, new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.BackSide })));
  const panel = (w, h, x, y, z, s) => { const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ color: new THREE.Color(s, s, s), side: THREE.DoubleSide })); m.position.set(x, y, z); m.lookAt(0, 0, 0); es.add(m); };
  panel(14, 7, -14, 14, 10, 5); panel(8, 4, 16, 8, 6, 3); panel(22, 3, 0, 20, -6, 2.5); panel(6, 6, 0, 4, 22, 1.2);
  const tex = pm.fromScene(es, 0.03).texture; pm.dispose(); return tex;
}
function makeView(cv, bg, fov = 38) {
  const r = new THREE.WebGLRenderer({ canvas: cv, antialias: true, powerPreference: 'high-performance' });
  r.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  r.toneMapping = THREE.ACESFilmicToneMapping; r.toneMappingExposure = 1.05;
  const scene = new THREE.Scene(); scene.background = new THREE.Color(bg); scene.environment = makeEnv(r);
  const cam = new THREE.PerspectiveCamera(fov, 1, 0.1, 200);
  const v = { r, scene, cam, cv, w: 0, h: 0 };
  v.resize = () => { const b = cv.getBoundingClientRect(); if (!b.width) return; r.setSize(b.width, b.height, false); cam.aspect = b.width / b.height; cam.updateProjectionMatrix(); v.w = b.width; v.h = b.height; };
  v.cast = (x, y, objs, rec = false) => {
    const b = cv.getBoundingClientRect();
    RAY.setFromCamera(new THREE.Vector2((x - b.left) / b.width * 2 - 1, -((y - b.top) / b.height) * 2 + 1), cam);
    return RAY.intersectObjects(objs, rec);
  };
  v.project = p => { const q = p.clone().project(cam); return { x: (q.x * .5 + .5) * v.w, y: (-q.y * .5 + .5) * v.h }; };
  v.render = () => r.render(scene, cam);
  return v;
}
const std = (c, o = {}) => new THREE.MeshStandardMaterial(Object.assign({ color: c, roughness: .5, metalness: .2 }, o));
function mesh(geo, mat, x = 0, y = 0, z = 0, parent) { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); if (parent) parent.add(m); return m; }
const box = (w, h, d, mat, x, y, z, p) => mesh(new THREE.BoxGeometry(w, h, d), mat, x, y, z, p);
const cyl = (rt, rb, h, seg, mat, x, y, z, p) => mesh(new THREE.CylinderGeometry(rt, rb, h, seg), mat, x, y, z, p);
function basicLights(scene, k = 1) {
  scene.add(new THREE.HemisphereLight(0xcfe8ff, 0x0b1220, 0.6 * k));
  const dl = new THREE.DirectionalLight(0xffffff, 2.2 * k); dl.position.set(3, 7, 5); scene.add(dl); return dl;
}
let shadowTex = null;
function blobShadow(r, parent, y = 0.01) {
  if (!shadowTex) {
    const c = document.createElement('canvas'); c.width = c.height = 128; const g = c.getContext('2d');
    const gr = g.createRadialGradient(64, 64, 0, 64, 64, 64); gr.addColorStop(0, 'rgba(0,0,0,.55)'); gr.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = gr; g.fillRect(0, 0, 128, 128);
    shadowTex = new THREE.CanvasTexture(c);
  }
  const m = new THREE.Mesh(new THREE.PlaneGeometry(r * 2, r * 2), new THREE.MeshBasicMaterial({ map: shadowTex, transparent: true, depthWrite: false }));
  m.rotation.x = -Math.PI / 2; m.position.y = y; parent.add(m); return m;
}

/* ---------- 酥脆捏捏（圓角凝膠方塊，可頂點形變） ---------- */
function makeJelly(seg = 18) {
  const geo = new THREE.BoxGeometry(2, 2, 2, seg, seg, seg), pos = geo.attributes.position, n = pos.count;
  const base = new Float32Array(n * 3), nor = new Float32Array(n * 3), IN = .7, RR = .3, map = new Map();
  for (let i = 0; i < n; i++) {
    const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i);
    const cx = clamp(x, -IN, IN), cy = clamp(y, -IN, IN), cz = clamp(z, -IN, IN);
    let dx = x - cx, dy = y - cy, dz = z - cz; const l = Math.hypot(dx, dy, dz) || 1; dx /= l; dy /= l; dz /= l;
    const bx = cx + dx * RR, by = cy + dy * RR, bz = cz + dz * RR;
    base[i * 3] = bx; base[i * 3 + 1] = by; base[i * 3 + 2] = bz; nor[i * 3] = dx; nor[i * 3 + 1] = dy; nor[i * 3 + 2] = dz;
    pos.setXYZ(i, bx, by, bz);
    const key = Math.round(bx * 500) + ',' + Math.round(by * 500) + ',' + Math.round(bz * 500);
    if (!map.has(key)) map.set(key, []); map.get(key).push(i);
  }
  geo.setAttribute('color', new THREE.Float32BufferAttribute(new Float32Array(n * 3), 3));
  geo.computeVertexNormals();
  const mat = new THREE.MeshPhysicalMaterial({
    color: 0xffffff, vertexColors: true, roughness: .16, metalness: 0, transmission: .55, thickness: 1.5, ior: 1.42,
    clearcoat: 1, clearcoatRoughness: .06, attenuationDistance: 2.2, attenuationColor: new THREE.Color('#ffffff'), envMapIntensity: 1.2,
  });
  const m = new THREE.Mesh(geo, mat);
  const cv = document.createElement('canvas'); cv.width = cv.height = 512;
  const tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.SRGBColorSpace;
  const ov = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 }));
  ov.raycast = () => { };
  const group = new THREE.Group(); group.add(m, ov);
  const dg = new THREE.Group(); group.add(dg);
  return { group, mesh: m, ov, geo, base, nor, off: new Float32Array(n), vel: new Float32Array(n), groups: [...map.values()].filter(a => a.length > 1), cv, tex, dg, decoMeshes: [], n, sp: null };
}
function jellyColors(J, sp) {
  if (J.sp === sp.id) return; J.sp = sp.id;
  const col = J.geo.attributes.color, c1 = new THREE.Color(sp.color), c2 = new THREE.Color(sp.color2 || sp.color), wh = new THREE.Color('#ffffff'), t = new THREE.Color();
  for (let i = 0; i < J.n; i++) {
    const x = J.base[i * 3], y = J.base[i * 3 + 1];
    t.copy(c1).lerp(c2, clamp((x + y) / 4 + .5, 0, 1)).lerp(wh, clamp(y * .12 + .05, 0, .2));
    col.setXYZ(i, t.r, t.g, t.b);
  }
  col.needsUpdate = true; J.mesh.material.attenuationColor.set(sp.color);
}
function jellyTexture(J, p) {
  const g = J.cv.getContext('2d'); g.clearRect(0, 0, 512, 512); const rd = seeded(p.id + 7);
  for (let i = 0; i < 260; i++) { const s = 1 + rd() * 2.6; g.fillStyle = `rgba(255,255,255,${.2 + rd() * .6})`; g.fillRect(rd() * 512, rd() * 512, s, s); }
  g.strokeStyle = 'rgba(255,255,255,.9)'; g.lineWidth = 2.2; g.lineCap = 'round'; g.shadowColor = '#fff'; g.shadowBlur = 5;
  p.cracks.forEach(cr => { g.beginPath(); for (let i = 0; i < cr.length; i += 2) { const x = cr[i] * 512, y = (1 - cr[i + 1]) * 512; i ? g.lineTo(x, y) : g.moveTo(x, y); } g.stroke(); });
  g.shadowBlur = 0; J.tex.needsUpdate = true;
}
function decoGeo(k) {
  switch (k) {
    case 'bead': return new THREE.SphereGeometry(.2, 24, 16);
    case 'cube': { const g = new THREE.BoxGeometry(.32, .32, .32); return g; }
    case 'ring': { const g = new THREE.TorusGeometry(.2, .065, 14, 32); g.rotateX(Math.PI / 2); return g; }
    case 'cone': return new THREE.ConeGeometry(.18, .45, 28);
    case 'disc': return new THREE.CylinderGeometry(.26, .26, .07, 36);
    case 'pyramid': return new THREE.ConeGeometry(.27, .38, 4);
    case 'gem': return new THREE.OctahedronGeometry(.25);
    case 'crystal': return new THREE.CylinderGeometry(.12, .12, .5, 6);
    case 'star': return new THREE.IcosahedronGeometry(.24, 0);
    case 'orb': return new THREE.SphereGeometry(.18, 24, 16);
    case 'knot': return new THREE.TorusKnotGeometry(.15, .05, 80, 10);
    case 'drop': { const g = new THREE.SphereGeometry(.18, 24, 16); g.scale(1, 1.4, 1); return g; }
    case 'dodeca': return new THREE.DodecahedronGeometry(.25);
    case 'helix': return new THREE.TorusKnotGeometry(.14, .04, 100, 10, 2, 5);
    case 'halo': { const g = new THREE.TorusGeometry(.26, .03, 10, 48); g.rotateX(Math.PI / 2); return g; }
  }
  return new THREE.SphereGeometry(.2);
}
function decoMat(k) {
  const d = DECO[k];
  return new THREE.MeshPhysicalMaterial({
    color: d.c, roughness: d.metal ? .22 : .3, metalness: d.metal ? .9 : .1, clearcoat: 1,
    emissive: d.glow ? d.c : '#000000', emissiveIntensity: d.glow ? .9 : 0,
    transmission: d.pack === 'glass' ? .5 : 0, thickness: .5,
  });
}
function jellyDeco(J, p) {
  J.decoMeshes.forEach(m => { J.dg.remove(m); m.geometry.dispose(); m.material.dispose(); });
  J.decoMeshes = p ? p.deco.map((d, i) => { const m = new THREE.Mesh(decoGeo(d.k), decoMat(d.k)); m.userData.idx = i; J.dg.add(m); return m; }) : [];
}
function syncDeco(J, p, t) {
  if (!p) return;
  J.decoMeshes.forEach((m, i) => { const d = p.deco[i]; if (!d) return; m.position.set(d.x, 1.0 + .17 * d.s, d.z); m.scale.setScalar(d.s); m.rotation.y = d.r + (DECO[d.k].glow ? t * .6 : 0); });
}
/* 頂點彈簧形變：hit 為局部座標、s 為按壓力道 */
function jellyDeform(J, dt, hit, s) {
  let e = 0; const { base, nor, off, vel, n } = J, pos = J.geo.attributes.position;
  for (let i = 0; i < n; i++) {
    let tg = 0;
    if (hit) { const dx = base[i * 3] - hit.x, dy = base[i * 3 + 1] - hit.y, dz = base[i * 3 + 2] - hit.z; tg = -s * .5 * Math.exp(-(dx * dx + dy * dy + dz * dz) / .45) - s * .03; }
    vel[i] += (tg - off[i]) * 200 * dt; vel[i] *= Math.exp(-7 * dt); off[i] += vel[i] * dt;
    e += Math.abs(vel[i]) + Math.abs(off[i]);
  }
  if (e < 1e-3 && !hit) { if (!J.rest) { off.fill(0); vel.fill(0); } else return; J.rest = true; } else J.rest = false;
  for (let i = 0; i < n; i++) pos.setXYZ(i, base[i * 3] + nor[i * 3] * off[i], base[i * 3 + 1] + nor[i * 3 + 1] * off[i], base[i * 3 + 2] + nor[i * 3 + 2] * off[i]);
  pos.needsUpdate = true; J.geo.computeVertexNormals();
  const nm = J.geo.attributes.normal;
  for (const g of J.groups) { let x = 0, y = 0, z = 0; for (const i of g) { x += nm.getX(i); y += nm.getY(i); z += nm.getZ(i); } const l = Math.hypot(x, y, z) || 1; for (const i of g) nm.setXYZ(i, x / l, y / l, z / l); }
  nm.needsUpdate = true;
}

/* ---------- 碎屑粒子 ---------- */
function makeCrumbs(scene, N = 200) {
  const geo = new THREE.BufferGeometry(), pos = new Float32Array(N * 3).fill(-50), col = new Float32Array(N * 3);
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3)); geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  const pts = new THREE.Points(geo, new THREE.PointsMaterial({ size: .07, vertexColors: true, transparent: true, depthWrite: false }));
  pts.frustumCulled = false; scene.add(pts);
  const C = { pts, pos, col, vel: new Float32Array(N * 3), life: new Float32Array(N), k: 0, N };
  C.emit = (p, n, color) => {
    const c = new THREE.Color(color), w = new THREE.Color('#ffffff');
    for (let j = 0; j < n; j++) {
      const i = C.k = (C.k + 1) % N; C.life[i] = 1;
      C.pos[i * 3] = p.x; C.pos[i * 3 + 1] = p.y; C.pos[i * 3 + 2] = p.z;
      C.vel[i * 3] = rnd(-2, 2); C.vel[i * 3 + 1] = rnd(1, 4); C.vel[i * 3 + 2] = rnd(-.5, 2.5);
      const cc = Math.random() < .5 ? w : c.clone().lerp(w, .4); C.col[i * 3] = cc.r; C.col[i * 3 + 1] = cc.g; C.col[i * 3 + 2] = cc.b;
    }
    geo.attributes.color.needsUpdate = true;
  };
  C.update = dt => {
    for (let i = 0; i < N; i++) {
      if (C.life[i] <= 0) continue; C.life[i] -= dt * 1.2; C.vel[i * 3 + 1] -= 9 * dt;
      C.pos[i * 3] += C.vel[i * 3] * dt; C.pos[i * 3 + 1] += C.vel[i * 3 + 1] * dt; C.pos[i * 3 + 2] += C.vel[i * 3 + 2] * dt;
      if (C.pos[i * 3 + 1] < 0.02) { C.pos[i * 3 + 1] = 0.02; C.vel[i * 3] *= .6; C.vel[i * 3 + 2] *= .6; C.vel[i * 3 + 1] *= -.2; }
      if (C.life[i] <= 0) C.pos[i * 3 + 1] = -50;
    }
    geo.attributes.position.needsUpdate = true;
  };
  return C;
}

/* ============================================================
   舞台（裝飾桌 / 直播間），延遲初始化 WebGL
   ============================================================ */
function makeStage(cv, mode) {
  const st = { cv, mode, ready: false, p: null, shown: undefined, t: 0, ptr: null, sel: -1, drag: null, spin: null, onCrunch: null, onSel: null, sq: 0, sqv: 0, flash: 0, hit: new THREE.Vector3() };
  st.init = () => {
    if (st.ready) return true;
    try { st.v = makeView(cv, mode === 'squeeze' ? '#0c0a18' : '#0b1220', 36); } catch (e) { toast('此裝置不支援 WebGL'); return false; }
    const sc = st.v.scene, cam = st.v.cam; st.dl = basicLights(sc);
    sc.fog = new THREE.Fog(sc.background.getHex(), 12, 30);
    const floor = cyl(3.2, 3.4, .3, 72, std('#111a27', { roughness: .3, metalness: .7 }), 0, -.15, 0, sc);
    const ring = mesh(new THREE.TorusGeometry(3.25, .035, 8, 120), new THREE.MeshBasicMaterial({ color: '#22d3ee' }), 0, .01, 0, sc); ring.rotation.x = Math.PI / 2;
    blobShadow(1.6, sc, .005);
    if (mode === 'squeeze') {
      cam.position.set(0, 3.3, 8.4); st.look = new THREE.Vector3(0, 1.1, 0);
      const wall = box(16, 8, .2, std('#0f0d1f', { roughness: .8 }), 0, 4, -5, sc); void wall;
      st.neon = [['#22d3ee', -4.2], ['#818cf8', -2.8], ['#e879f9', 2.8], ['#fbbf24', 4.2]].map(([c, x]) => box(.12, 5.5, .12, new THREE.MeshBasicMaterial({ color: c }), x, 3.2, -4.8, sc));
      const hz = box(9, .08, .08, new THREE.MeshBasicMaterial({ color: '#818cf8' }), 0, 6.2, -4.8, sc); void hz;
      // 直播設備：補光環燈與攝影機
      const rl = mesh(new THREE.TorusGeometry(.6, .05, 12, 48), new THREE.MeshBasicMaterial({ color: '#f8fafc' }), -4.3, 2.6, -1, sc); rl.lookAt(0, 1, 0);
      cyl(.04, .04, 2.6, 8, std('#334155', { metalness: .8 }), -4.3, 1.3, -1, sc);
      const camBody = new THREE.Group(); camBody.position.set(4.3, 2.2, -.8); sc.add(camBody);
      box(.7, .45, .5, std('#1e293b', { metalness: .6, roughness: .3 }), 0, 0, 0, camBody);
      const lens = cyl(.16, .2, .35, 24, std('#0f172a', { metalness: .9, roughness: .15 }), 0, 0, .4, camBody); lens.rotation.x = Math.PI / 2;
      mesh(new THREE.SphereGeometry(.04, 8, 8), new THREE.MeshBasicMaterial({ color: '#fb7185' }), .25, .15, .26, camBody);
      camBody.lookAt(0, 1, 0); cyl(.04, .04, 2.2, 8, std('#334155', { metalness: .8 }), 4.3, 1.1, -.8, sc);
      st.pl = new THREE.PointLight('#e879f9', 6, 10); st.pl.position.set(0, 3, -2); sc.add(st.pl);
    } else {
      cam.position.set(0, 4.8, 5.6); st.look = new THREE.Vector3(0, .9, 0);
      const grid = new THREE.GridHelper(30, 30, '#1e293b', '#141c28'); grid.position.y = -.3; sc.add(grid);
    }
    void floor;
    st.J = makeJelly(18); st.J.group.position.y = 1; sc.add(st.J.group);
    st.C = makeCrumbs(sc);
    const sel = mesh(new THREE.TorusGeometry(.3, .015, 8, 48), new THREE.MeshBasicMaterial({ color: '#22d3ee' }), 0, 0, 0, st.J.dg); sel.rotation.x = Math.PI / 2; sel.visible = false; st.selRing = sel;
    bind(); st.ready = true; st.resize(); return true;
  };
  st.resize = () => { if (st.init()) st.v.resize(); };
  st.set = p => { if (st.p !== p) { st.p = p; st.sel = -1; st.ptr = null; } };
  st.rebuildDeco = () => { if (st.ready) jellyDeco(st.J, st.p); };
  function apply() {
    st.shown = st.p; const J = st.J; J.group.visible = !!st.p;
    if (!st.p) { jellyDeco(J, null); return; }
    jellyColors(J, SP[st.p.sp]); jellyTexture(J, st.p); jellyDeco(J, st.p); J.group.rotation.y = mode === 'decor' ? 0 : 0;
  }
  function bind() {
    const tgt = cv;
    tgt.addEventListener('pointerdown', e => {
      e.preventDefault(); if (!st.p) return; try { tgt.setPointerCapture(e.pointerId); } catch (_) { }
      if (mode === 'squeeze') {
        const h = st.v.cast(e.clientX, e.clientY, [st.J.mesh]);
        if (h.length) { st.ptr = { s: 0, fired: false, px: e.clientX, py: e.clientY, lx: e.clientX, ly: e.clientY }; setHit(h[0]); sfx.squish(); }
      } else {
        const h = st.v.cast(e.clientX, e.clientY, st.J.decoMeshes);
        if (h.length) { st.sel = h[0].object.userData.idx; st.drag = true; }
        else { st.sel = -1; st.spin = { x: e.clientX, r: st.J.group.rotation.y }; }
        st.onSel && st.onSel();
      }
    });
    tgt.addEventListener('pointermove', e => {
      if (st.ptr) { st.ptr.px = e.clientX; st.ptr.py = e.clientY; const h = st.v.cast(e.clientX, e.clientY, [st.J.mesh]); if (h.length) setHit(h[0]); }
      if (st.drag && st.sel >= 0 && st.p) {
        const b = cv.getBoundingClientRect(); RAY.setFromCamera(new THREE.Vector2((e.clientX - b.left) / b.width * 2 - 1, -((e.clientY - b.top) / b.height) * 2 + 1), st.v.cam);
        const pt = new THREE.Vector3(); if (RAY.ray.intersectPlane(new THREE.Plane(new THREE.Vector3(0, 1, 0), -2), pt)) {
          const l = st.J.group.worldToLocal(pt), d = st.p.deco[st.sel]; d.x = clamp(l.x, -.8, .8); d.z = clamp(l.z, -.8, .8);
        }
      }
      if (st.spin) st.J.group.rotation.y = st.spin.r + (e.clientX - st.spin.x) * .01;
    });
    const up = () => { st.ptr = null; st.drag = null; st.spin = null; };
    tgt.addEventListener('pointerup', up); tgt.addEventListener('pointercancel', up);
  }
  function setHit(h) { st.hit.copy(st.J.mesh.worldToLocal(h.point.clone())); st.ptr.uv = h.uv ? h.uv.clone() : new THREE.Vector2(.5, .5); st.ptr.world = h.point.clone(); }
  st.crunchAt = () => {
    const p = st.p, q = st.ptr; if (!p || !q) return;
    if (p.dur <= 0) { sfx.squish(1); return; }
    const eff = effCrisp(p); sfx.crunch(.6 + eff * .6, eff); if (navigator.vibrate) navigator.vibrate(12);
    p.dur = Math.max(0, p.dur - 2.2);
    let u = q.uv.x, v = q.uv.y, a = rnd(0, PI2); const cr = [u, v];
    for (let k = 0; k < 4; k++) { a += rnd(-.8, .8); const l = rnd(.03, .08); u += Math.cos(a) * l; v += Math.sin(a) * l; cr.push(u, v); }
    p.cracks.push(cr); if (p.cracks.length > 30) p.cracks.shift(); jellyTexture(st.J, p);
    st.C.emit(q.world, Math.round(8 + eff * 14), SP[p.sp].color); st.flash = 1;
    st.onCrunch && st.onCrunch(st, eff);
  };
  st.step = dt => {
    if (!st.ready) return; dt = Math.min(dt, .033); st.t += dt;
    if (st.shown !== st.p) apply();
    const J = st.J; let s = 0;
    if (st.ptr) {
      const q = st.ptr; s = q.s = Math.min(1, q.s + dt * 5);
      if (s > .7 && !q.fired) { q.fired = true; q.lx = q.px; q.ly = q.py; st.crunchAt(); }
      else if (q.fired && Math.hypot(q.px - q.lx, q.py - q.ly) > 45) { q.lx = q.px; q.ly = q.py; st.crunchAt(); }
    }
    if (st.p) {
      jellyDeform(J, dt, st.ptr ? st.hit : null, s);
      st.sqv += ((st.ptr ? s * .1 : 0) - st.sq) * 160 * dt; st.sqv *= Math.exp(-9 * dt); st.sq += st.sqv * dt;
      J.group.scale.set(1 + st.sq * .5, 1 - st.sq, 1 + st.sq * .5); J.group.position.y = 1 - st.sq;
      if (mode === 'squeeze' && !st.ptr) J.group.rotation.y = Math.sin(st.t * .5) * .25;
      syncDeco(J, st.p, st.t);
      const sd = st.p.deco[st.sel]; st.selRing.visible = mode === 'decor' && !!sd;
      if (sd) st.selRing.position.set(sd.x, 1.01, sd.z), st.selRing.scale.setScalar(sd.s);
    }
    st.C.update(dt);
    st.flash = Math.max(0, st.flash - dt * 4);
    st.dl.intensity = 2.2 + st.flash * 1.5;
    if (st.pl) { const h = mode === 'squeeze' ? L.hype : 0; st.pl.intensity = 4 + h * .12 + st.flash * 6; st.neon.forEach((n, i) => n.scale.y = .6 + .4 * (h / 100) + Math.sin(st.t * 3 + i) * .05); }
    const cam = st.v.cam; cam.position.x = Math.sin(st.t * .25) * .35; cam.lookAt(st.look);
    st.v.render();
  };
  return st;
}

/* ============================================================
   捕捉場景（3D 生態區）
   ============================================================ */
const F = { zone: 'forest', slimes: [], t: 0, rot: 0, v: null, props: null, bodyGeo: null };
function initField() {
  if (F.v) return true;
  try { F.v = makeView($('#fieldCv'), '#0d2626', 42); } catch (e) { toast('此裝置不支援 WebGL'); return false; }
  const sc = F.v.scene; basicLights(sc, 1.1); sc.fog = new THREE.Fog('#0d2626', 14, 34);
  F.v.cam.position.set(0, 8.5, 11); F.v.cam.lookAt(0, 0, 0);
  F.ground = mesh(new THREE.CircleGeometry(40, 64), std('#1d4d3c', { roughness: .95, metalness: 0 }), 0, 0, 0, sc); F.ground.rotation.x = -Math.PI / 2;
  const g = new THREE.SphereGeometry(1, 36, 22), p = g.attributes.position;
  for (let i = 0; i < p.count; i++) { const y = p.getY(i); if (y < 0) p.setY(i, y * .2); }
  g.computeVertexNormals(); F.bodyGeo = g;
  // 採集吸取機（固定設施）
  const mach = new THREE.Group(); mach.position.set(-6.2, 0, -3.4); sc.add(mach); F.mach = mach;
  box(1.6, 1.2, 1.2, std('#1e293b', { metalness: .7, roughness: .3 }), 0, .6, 0, mach);
  F.tank = cyl(.45, .45, 1.4, 28, new THREE.MeshPhysicalMaterial({ color: '#6ee7a8', transmission: .6, roughness: .1, thickness: .6, clearcoat: 1 }), 0, 1.9, 0, mach);
  cyl(.5, .5, .1, 28, std('#334155', { metalness: .8 }), 0, 1.2, 0, mach); cyl(.5, .5, .1, 28, std('#334155', { metalness: .8 }), 0, 2.62, 0, mach);
  const hose = mesh(new THREE.TorusGeometry(1.2, .08, 10, 40, Math.PI * .8), std('#475569', { roughness: .6 }), 1.1, .6, .4, mach); hose.rotation.set(Math.PI / 2, 0, Math.PI);
  F.led = mesh(new THREE.SphereGeometry(.07, 10, 10), new THREE.MeshBasicMaterial({ color: '#22d3ee' }), .55, 1, .61, mach);
  buildZone(); fillField(); return true;
}
function disposeTree(o) { o.traverse(c => { if (c.geometry) c.geometry.dispose(); if (c.material) c.material.dispose(); }); }
function buildZone() {
  if (!F.v) return; const sc = F.v.scene, z = ZONES.find(z => z.id === F.zone);
  if (F.props) { sc.remove(F.props); disposeTree(F.props); }
  sc.background.set(z.bg); sc.fog.color.set(z.bg); F.ground.material.color.set(z.ground);
  const G = F.props = new THREE.Group(); sc.add(G); const rd = seeded(z.id.length * 97 + 3);
  const spot = () => { for (; ;) { const x = (rd() - .5) * 32, zz = -16 + rd() * 22; if (Math.abs(x) > 7.5 || zz < -5.5) return [x, zz]; } };
  const flat = (c, o = {}) => std(c, Object.assign({ flatShading: true, roughness: .8, metalness: 0 }, o));
  for (let i = 0; i < 26; i++) {
    const [x, zz] = spot(), s = .7 + rd() * .9, g = new THREE.Group(); g.position.set(x, 0, zz); g.scale.setScalar(s); g.rotation.y = rd() * 6; G.add(g);
    if (z.id === 'forest') { if (rd() < .75) { cyl(.12, .16, .8, 6, flat('#3f2e22'), 0, .4, 0, g); mesh(new THREE.ConeGeometry(.8, 1.6, 7), flat('#1f7a55'), 0, 1.5, 0, g); mesh(new THREE.ConeGeometry(.6, 1.2, 7), flat('#2a9d6c'), 0, 2.2, 0, g); } else mesh(new THREE.DodecahedronGeometry(.5), flat('#4b5563'), 0, .3, 0, g); }
    else if (z.id === 'coast') { if (rd() < .5) mesh(new THREE.DodecahedronGeometry(.6), flat('#64748b'), 0, .3, 0, g); else { cyl(.1, .14, 2.2, 6, flat('#8b6b4a'), 0, 1.1, 0, g); for (let k = 0; k < 5; k++) { const l = box(1.1, .05, .3, flat('#16a34a'), Math.cos(k * 1.26) * .5, 2.2, Math.sin(k * 1.26) * .5, g); l.rotation.y = -k * 1.26; l.rotation.z = -.4; } } }
    else if (z.id === 'volcano') { mesh(new THREE.DodecahedronGeometry(.6), flat('#1c1917'), 0, .35, 0, g); if (rd() < .3) { const lv = mesh(new THREE.CircleGeometry(.9, 20), new THREE.MeshBasicMaterial({ color: '#f97316' }), 1, .02, 0, g); lv.rotation.x = -Math.PI / 2; } }
    else { if (rd() < .5) { const c = mesh(new THREE.OctahedronGeometry(.5), new THREE.MeshPhysicalMaterial({ color: '#bae6fd', transmission: .7, roughness: .05, thickness: .5 }), 0, .7, 0, g); c.scale.set(.6, 1.6, .6); } else mesh(new THREE.ConeGeometry(.7, 1.8, 7), flat('#e2e8f0'), 0, .9, 0, g); }
  }
  if (z.id === 'coast') { const sea = mesh(new THREE.PlaneGeometry(80, 20), std('#0e7490', { roughness: .1, metalness: .3 }), 0, .03, -22, G); sea.rotation.x = -Math.PI / 2; }
  if (z.id === 'volcano') { const vo = mesh(new THREE.ConeGeometry(7, 7, 9, 1, true), flat('#292524'), 4, 3.5, -22, G); void vo; const top = mesh(new THREE.CircleGeometry(1.2, 18), new THREE.MeshBasicMaterial({ color: '#fb923c' }), 4, 6.3, -22, G); top.rotation.x = -Math.PI / 2; const pl = new THREE.PointLight('#f97316', 40, 30); pl.position.set(4, 7, -20); G.add(pl); }
}
function slimeMesh(sp) {
  const g = new THREE.Group();
  const mat = new THREE.MeshPhysicalMaterial({ color: sp.color, roughness: .12, clearcoat: 1, clearcoatRoughness: .05, transparent: true, opacity: .93, sheen: .5, sheenColor: new THREE.Color('#ffffff'), emissive: sp.color2 || '#000000', emissiveIntensity: sp.color2 ? .35 : 0 });
  const body = new THREE.Mesh(F.bodyGeo, mat); body.scale.set(.9, .8, .9); g.add(body);
  const eye = new THREE.MeshStandardMaterial({ color: '#0b1020', roughness: .2 }), hl = new THREE.MeshBasicMaterial({ color: '#ffffff' });
  [-1, 1].forEach(s => { mesh(new THREE.SphereGeometry(.09, 12, 10), eye, s * .26, .42, .72, body); mesh(new THREE.SphereGeometry(.03, 8, 6), hl, s * .26 + .03, .46, .8, body); });
  const smile = mesh(new THREE.TorusGeometry(.1, .02, 6, 14, Math.PI), eye, 0, .3, .78, body); smile.rotation.z = Math.PI;
  blobShadow(1, g, .01);
  g.userData.body = body; body.userData.root = g; return g;
}
function spawnSlime() {
  const list = SPECIES.filter(s => s.zone === F.zone); let r = Math.random() * list.reduce((a, s) => a + s.w, 0), sp = list[0];
  for (const s of list) { if ((r -= s.w) <= 0) { sp = s; break; } }
  const m = slimeMesh(sp), sl = { sp, m, x: rnd(-5.5, 5.5), z: rnd(-3, 3.5), vx: rnd(-.6, .6), vz: rnd(-.3, .3), ph: rnd(0, 6), hits: 0, cool: 0, sq: 0 };
  m.userData.body.userData.sl = sl; F.v.scene.add(m); return sl;
}
function removeSlime(sl) { F.v.scene.remove(sl.m); sl.m.traverse(c => { if (c.material && c.geometry !== F.bodyGeo) c.geometry.dispose(); }); }
function fillField() { if (!F.v) return; F.slimes.forEach(removeSlime); F.slimes = []; for (let i = 0; i < 6; i++) F.slimes.push(spawnSlime()); }
function fx3(pos, txt, color = '#fff') {
  const p = F.v.project(pos), d = document.createElement('div'); d.className = 'fx'; d.textContent = txt; d.style.left = p.x + 'px'; d.style.top = p.y + 'px'; d.style.color = color;
  $('#fxl').appendChild(d); setTimeout(() => d.remove(), 1000);
}
function harvest(sl) {
  const n = 1 + S.up.net; S.gel[sl.sp.id] = (S.gel[sl.sp.id] || 0) + n; discover(sl.sp.id);
  sl.cool = 5; sl.hits = 0; fx3(sl.m.position.clone().setY(1.8), `+${n} ${short(sl.sp.id)}凝膠`, sl.sp.color); sfx.pop(); renderGelBar();
  F.tank.material.color.set(sl.sp.color); F.pump = 1;
}
$('#fieldCv').addEventListener('pointerdown', e => {
  e.preventDefault(); if (!F.v) return;
  const h = F.v.cast(e.clientX, e.clientY, F.slimes.map(s => s.m.userData.body)); if (!h.length) return;
  const sl = h[0].object.userData.sl; if (!sl) return;
  if (sl.cool > 0) { fx3(sl.m.position.clone().setY(1.6), '害羞中…', '#8b9bb0'); return; }
  sl.hits++; sl.sq = 1; sfx.squish(.8); if (navigator.vibrate) navigator.vibrate(8);
  if (sl.hits >= 3) harvest(sl); else fx3(sl.m.position.clone().setY(1.6), `${short(sl.sp.id)} ${sl.hits}/3`, RAR[sl.sp.rar].c);
});
function fieldStep(dt) {
  if (!F.v) return; F.t += dt; F.rot += dt;
  F.slimes.forEach(s => {
    s.ph += dt * 3; s.x += s.vx * dt; s.z += s.vz * dt;
    if (s.x < -6 || s.x > 6) s.vx *= -1; if (s.z < -3.2 || s.z > 4) s.vz *= -1;
    s.x = clamp(s.x, -6, 6); s.z = clamp(s.z, -3.2, 4);
    if (Math.random() < dt * .3) { s.vx = rnd(-.7, .7); s.vz = rnd(-.35, .35); }
    s.cool = Math.max(0, s.cool - dt); s.sq = Math.max(0, s.sq - dt * 3);
    const ph = Math.abs(Math.sin(s.ph)), cool = s.cool > 0, hop = cool ? 0 : ph * .45, b = s.m.userData.body;
    s.m.position.set(s.x, 0, s.z); b.position.y = hop + .02;
    const k = cool ? .75 : 1; b.scale.set(.9 * k * (1 + s.sq * .25), .8 * k * (1 - s.sq * .3 + (cool ? 0 : (1 - ph) * -.08 + ph * .06)), .9 * k * (1 + s.sq * .25));
    b.material.opacity = cool ? .55 : .93; b.rotation.y = Math.atan2(s.vx, 4) * .5;
  });
  if (F.rot > 25) { F.rot = 0; const i = Math.floor(Math.random() * F.slimes.length); removeSlime(F.slimes[i]); F.slimes[i] = spawnSlime(); }
  F.pump = Math.max(0, (F.pump || 0) - dt); F.tank.scale.y = 1 + Math.sin(F.t * 20) * .03 * F.pump; F.led.material.color.set(F.pump > 0 ? '#34d399' : (Math.sin(F.t * 3) > 0 ? '#22d3ee' : '#0e7490'));
  F.v.cam.position.x = Math.sin(F.t * .15) * 1.2; F.v.cam.lookAt(0, 0, 0);
  F.v.render();
}

/* ============================================================
   加工產線（3D 機器）
   ============================================================ */
const STEPS = ['切片', '裹糖晶', '乾燥'];
const MKEY = ['slicer', 'coater', 'dryer'];
const MX = [-4, 0, 4];
const M = { sp: null, step: -1, pos: 0, dir: 1, spd: 1, c: .5, prec: [], active: false, last: null };
const MK = { v: null, pulse: [0, 0, 0], bx: -6.4, t: 0 };
function zoneHalf(step) { return 0.12 + 0.03 * S.up[MKEY[step]]; }
function initMake() {
  if (MK.v) return true;
  try { MK.v = makeView($('#makeCv'), '#0b1220', 34); } catch (e) { toast('此裝置不支援 WebGL'); return false; }
  const sc = MK.v.scene, cam = MK.v.cam; basicLights(sc, 1.5); sc.fog = new THREE.Fog('#0b1220', 22, 42);
  const fill = new THREE.DirectionalLight('#a5f3fc', 1.2); fill.position.set(-6, 4, 8); sc.add(fill);
  cam.position.set(0, 6, 17); cam.lookAt(0, 1, 0);
  const floor = mesh(new THREE.PlaneGeometry(60, 30), std('#0f172a', { roughness: .4, metalness: .5 }), 0, 0, 0, sc); floor.rotation.x = -Math.PI / 2;
  const grid = new THREE.GridHelper(40, 40, '#1e293b', '#152033'); grid.position.y = .005; sc.add(grid);
  box(30, 7, .3, std('#0d1524', { roughness: .9 }), 0, 3.5, -4, sc);
  [-8, -2.5, 2.5, 8].forEach(x => box(.08, 5, .08, new THREE.MeshBasicMaterial({ color: '#1e3a5f' }), x, 3, -3.8, sc));
  const dark = std('#1e293b', { metalness: .7, roughness: .35 }), steel = std('#94a3b8', { metalness: .9, roughness: .2 }), panel = std('#334155', { metalness: .5, roughness: .4 });
  // 輸送帶
  box(15, .35, 1.7, dark, 0, .45, 0, sc); box(15, .08, 1.5, std('#0b0f17', { roughness: .9 }), 0, .66, 0, sc);
  [-.9, .9].forEach(z => box(15, .12, .1, steel, 0, .72, z, sc));
  MK.rollers = []; for (let i = 0; i < 14; i++) { const r = cyl(.14, .14, 1.8, 14, steel, -6.5 + i, .45, 0, sc); r.rotation.x = Math.PI / 2; MK.rollers.push(r); }
  [-6.8, -2.3, 2.3, 6.8].forEach(x => [-.7, .7].forEach(z => box(.15, .3, .15, dark, x, .15, z, sc)));
  MK.belt = []; for (let i = 0; i < 30; i++) MK.belt.push(box(.06, .02, 1.4, std('#22d3ee', { emissive: '#22d3ee', emissiveIntensity: .25 }), -7.25 + i * .5, .71, 0, sc));
  const leds = (x, z) => { const a = []; for (let i = 0; i < 5; i++) a.push(box(.14, .08, .04, new THREE.MeshBasicMaterial({ color: '#1e293b' }), x - .36 + i * .18, .3, z, sc)); return a; };
  MK.leds = [];
  // 1) 切片機：門型框架＋三片刀
  const x0 = MX[0]; [-1, 1].forEach(s => box(.22, 2.6, .22, dark, x0 + s * .9, 1.3, -1.05, sc)); [-1, 1].forEach(s => box(.22, 2.6, .22, dark, x0 + s * .9, 1.3, 1.05, sc));
  box(2.2, .3, 2.4, panel, x0, 2.65, 0, sc); box(1.2, .5, .8, dark, x0, 3.05, 0, sc);
  MK.blades = [-.35, 0, .35].map(dx => box(.04, .7, 1.5, steel, x0 + dx, 2.1, 0, sc));
  box(1, .55, .1, panel, x0, .3, 1.15, sc); MK.leds[0] = leds(x0, 1.21);
  // 2) 糖晶滾筒機：透明滾筒＋葉片＋料斗
  const x1 = MX[1]; MK.drum = new THREE.Group(); MK.drum.position.set(x1, 1.25, 0); sc.add(MK.drum);
  const glass = mesh(new THREE.CylinderGeometry(.95, .95, 2, 32, 1, true), new THREE.MeshPhysicalMaterial({ color: '#c7f9ff', transmission: .85, roughness: .05, thickness: .2, side: THREE.DoubleSide, transparent: true, opacity: .55 }), 0, 0, 0, MK.drum); glass.rotation.z = Math.PI / 2;
  for (let i = 0; i < 6; i++) { const a = i / 6 * PI2, vb = box(1.9, .04, .25, steel, 0, Math.cos(a) * .82, Math.sin(a) * .82, MK.drum); vb.rotation.x = -a; }
  [-1, 1].forEach(s => { const r = mesh(new THREE.TorusGeometry(.97, .06, 10, 40), steel, x1 + s * 1, 1.25, 0, sc); r.rotation.y = Math.PI / 2; box(.2, 1.2, .2, dark, x1 + s * 1, .6, -.9, sc); box(.2, 1.2, .2, dark, x1 + s * 1, .6, .9, sc); });
  const hop = mesh(new THREE.ConeGeometry(.6, .9, 4, 1, true), panel, x1, 2.85, 0, sc); hop.rotation.x = Math.PI; hop.material.side = THREE.DoubleSide;
  MK.sugar = []; for (let i = 0; i < 14; i++) MK.sugar.push(mesh(new THREE.BoxGeometry(.05, .05, .05), new THREE.MeshBasicMaterial({ color: '#ffffff' }), x1 + rnd(-.15, .15), 2.4, rnd(-.15, .15), sc));
  box(1, .55, .1, panel, x1, .3, 1.15, sc); MK.leds[1] = leds(x1, 1.21);
  // 3) 乾燥烘箱：隧道＋加熱管＋風扇
  const x2 = MX[2]; box(2.6, .5, 2.2, panel, x2, 2.3, 0, sc); [-1, 1].forEach(s => box(2.6, 1.6, .2, dark, x2, 1.25, s * 1.0, sc));
  MK.heat = [-.6, 0, .6].map(dz => { const h = cyl(.05, .05, 2.3, 10, new THREE.MeshStandardMaterial({ color: '#7c2d12', emissive: '#fb923c', emissiveIntensity: .2 }), x2, 1.95, dz, sc); h.rotation.z = Math.PI / 2; return h; });
  cyl(.5, .5, .2, 24, dark, x2, 2.65, 0, sc);
  MK.fan = new THREE.Group(); MK.fan.position.set(x2, 2.8, 0); sc.add(MK.fan); for (let i = 0; i < 4; i++) { const bl = box(.75, .03, .16, steel, 0, 0, 0, MK.fan); bl.rotation.y = i * Math.PI / 4 * 2 / 2 + i * Math.PI / 4; }
  MK.heatLight = new THREE.PointLight('#fb923c', 0, 4); MK.heatLight.position.set(x2, 1.4, 0); sc.add(MK.heatLight);
  box(1, .55, .1, panel, x2, .3, 1.15, sc); MK.leds[2] = leds(x2, 1.21);
  // 原料槽（左）與成品台（右）
  MK.tank = cyl(.55, .55, 1.8, 28, new THREE.MeshPhysicalMaterial({ color: '#6ee7a8', transmission: .5, roughness: .1, thickness: .8, clearcoat: 1 }), -7.4, 1.5, -1.6, sc);
  cyl(.6, .6, .12, 28, steel, -7.4, .6, -1.6, sc); cyl(.6, .6, .12, 28, steel, -7.4, 2.45, -1.6, sc);
  const pipe = cyl(.07, .07, 1.6, 10, steel, -7.0, 2.5, -.8, sc); pipe.rotation.x = Math.PI / 2.6;
  MK.turn = cyl(.9, 1, .2, 36, std('#111827', { metalness: .8, roughness: .2 }), 8.2, .1, 0, sc);
  const tr = mesh(new THREE.TorusGeometry(.95, .025, 8, 60), new THREE.MeshBasicMaterial({ color: '#22d3ee' }), 8.2, .21, 0, sc); tr.rotation.x = Math.PI / 2;
  MK.machLight = new THREE.PointLight('#22d3ee', 3, 8); MK.machLight.position.set(0, 3.5, 2); sc.add(MK.machLight);
  // 產線上的凝膠方塊
  MK.J = makeJelly(8); MK.J.group.scale.setScalar(.42); MK.J.group.position.set(-6.4, 1.14, 0); MK.J.ov.visible = false; sc.add(MK.J.group);
  return true;
}
function makeStep(dt) {
  if (!MK.v) return; MK.t += dt; const t = MK.t;
  const act = i => (M.active && M.step === i) || MK.pulse[i] > 0;
  MK.pulse = MK.pulse.map(p => Math.max(0, p - dt));
  MK.blades.forEach((b, k) => b.position.y = act(0) ? 1.55 + .45 * Math.cos(t * 10 + k * .9) : 2.1);
  MK.drum.rotation.x += dt * (act(1) ? 5 : .3);
  MK.sugar.forEach((s, i) => { s.visible = act(1); if (s.visible) { s.position.y = 2.4 - ((t * 1.6 + i / 14) % 1) * 1.4; } });
  const hot = act(2); MK.heat.forEach(h => h.material.emissiveIntensity = hot ? 2 + Math.sin(t * 12) * .6 : .2); MK.heatLight.intensity = hot ? 8 : 0;
  MK.fan.rotation.y += dt * (hot ? 14 : 1.2);
  MK.leds.forEach((row, i) => { const lv = S.up[MKEY[i]], on = act(i); row.forEach((l, k) => l.material.color.set(k < lv ? (on ? '#34d399' : '#22d3ee') : '#1e293b')); });
  const moving = M.active || MK.bx < 7.9; MK.rollers.forEach(r => r.rotation.y += dt * (moving ? 3 : 0));
  MK.belt.forEach(b => { b.position.x += dt * (moving ? .8 : 0); if (b.position.x > 7.4) b.position.x -= 15; });
  // 方塊
  const J = MK.J, spId = M.active ? M.sp : (M.last ? M.last.sp : M.sp);
  J.group.visible = M.active || !!M.last;
  if (spId) { jellyColors(J, SP[spId]); MK.tank.material.color.set(SP[spId].color); }
  const tx = M.active ? MX[M.step] : (M.last ? 8.2 : -6.4);
  MK.bx += (tx - MK.bx) * Math.min(1, dt * 3); const onTurn = !M.active && M.last && MK.bx > 7.6;
  J.group.position.set(MK.bx + (M.active && act(M.step) ? Math.sin(t * 40) * .01 : 0), onTurn ? 1.15 + Math.sin(t * 2) * .05 : 1.14, 0);
  J.group.rotation.y = onTurn ? t * .8 : 0; MK.turn.rotation.y = t * .8;
  const sq = M.active && M.step >= 1 ? .92 : 1; J.group.scale.set(.42, .42 * sq, .42);
  const dist = clamp(12 * 2.6 / Math.max(.5, MK.v.cam.aspect), 12, 28);
  MK.v.cam.position.set(.6 + Math.sin(t * .2) * .6, 2.6 + dist * .16, dist); MK.v.cam.lookAt(.6, 1.3, 0);
  MK.v.render();
}
function startMake() {
  const sp = M.sp; if (!sp || (S.gel[sp] || 0) < 2) return toast('凝膠不足（需要 2 份）');
  if (S.stock.length >= cap()) return toast('庫存已滿，請先銷售或擴充倉儲貨架');
  S.gel[sp] -= 2; M.step = 0; M.prec = []; M.active = true; M.last = null; MK.bx = -6.4; nextStep(); renderGelBar(); renderMake();
}
function nextStep() { M.pos = 0; M.dir = 1; M.spd = 0.9 + 0.4 * M.step; M.c = rnd(.3, .7); }
function stopBar() {
  if (!M.active) return; const d = Math.abs(M.pos - M.c), w = zoneHalf(M.step);
  const pr = d <= w ? 0.85 + 0.15 * (1 - d / w) : Math.max(0, 0.85 * (1 - (d - w) / 0.4));
  M.prec.push(pr); sfx.machine(M.step); MK.pulse[M.step] = .7;
  toast(`${STEPS[M.step]}：${pr > .95 ? '完美' : pr > .8 ? '很好' : pr > .5 ? '普通' : '偏了'}（${Math.round(pr * 100)}%）`);
  M.step++;
  if (M.step >= 3) {
    M.active = false; const avg = M.prec.reduce((a, b) => a + b, 0) / 3, crisp = 0.15 + 0.85 * avg;
    const p = makeProduct(M.sp, crisp); S.stock.push(p); M.last = p; save(); setTimeout(() => sfx.pop(), 350);
  } else nextStep();
  renderMake();
}
function swatch(sp) { return sp.color2 ? `linear-gradient(135deg,${sp.color},${sp.color2})` : `radial-gradient(circle at 30% 30%,${rgba(sp.color, 1, .6)},${sp.color})`; }
function renderMake() {
  $('#machLegend').innerHTML = MKEY.map((k, i) => `<span class="mlg">${STEPS[i]} · ${UPS[k].name}<span class="lv">${[0, 1, 2, 3, 4].map(j => `<i class="${j < S.up[k] ? 'on' : ''}"></i>`).join('')}</span></span>`).join('');
  $('#gelPick').innerHTML = unlockedSpecies().map(s => `<button class="zbtn ${M.sp === s.id ? 'on' : ''}" data-act="pickSp" data-id="${s.id}" ${M.active ? 'disabled' : ''}>${dot(s.color)}${short(s.id)}<br><small>凝膠 ${S.gel[s.id] || 0}</small></button>`).join('');
  const mini = $('#mini');
  if (M.active) {
    const half = zoneHalf(M.step);
    mini.innerHTML = `<div class="steps">${STEPS.map((s, i) => `<span class="${i === M.step ? 'on' : i < M.step ? 'done' : ''}">${i + 1}. ${s}</span>`).join('')}</div>
    <div class="bar"><div class="zone" style="left:${(M.c - half) * 100}%;width:${half * 200}%"></div><div class="cur" id="mcur"></div></div>
    <button class="btn big" style="width:100%" data-act="stopBar">停機（或按空白鍵）</button>`;
  } else {
    mini.innerHTML = `<div class="row"><div class="grow small">${M.sp ? `已選：<b>${SP[M.sp].name}</b>　消耗 2 凝膠` : '請先選擇要加工的凝膠'}<br>庫存 ${S.stock.length}/${cap()}</div>
    <button class="btn" data-act="startMake" ${!M.sp || (S.gel[M.sp] || 0) < 2 ? 'disabled' : ''}>啟動產線</button></div>`;
  }
  const r = $('#makeResult');
  if (M.last && !M.active) {
    const p = M.last, pct = Math.round(p.crisp * 100);
    r.innerHTML = `<div class="card item" style="cursor:default"><div class="sw" style="background:${swatch(SP[p.sp])};width:56px;height:56px"></div>
      <div class="grow"><b>${SP[p.sp].name} · 酥脆捏捏</b><br>酥脆度 <b style="color:var(--warn)">${pct}%</b>　${pct >= 90 ? '極品' : pct >= 70 ? '優良' : '再接再厲'}<br>
      <small style="color:var(--sub)">合理價約 ${fmt(fair(p, 'live'))}（直播）</small><div class="row" style="margin-top:8px"><button class="btn sm" data-act="goDecor" data-id="${p.id}">去裝飾</button><button class="btn sm ghost" data-act="tab" data-tab="live">去直播</button></div></div></div>`;
  } else r.innerHTML = '';
}

/* ============================================================
   庫存卡片
   ============================================================ */
function itemHTML(p, act, selId, extra = '') {
  const sp = SP[p.sp];
  return `<div class="card item ${selId === p.id ? 'sel' : ''}" data-act="${act}" data-id="${p.id}">
    <div class="sw" style="background:${swatch(sp)}"></div>
    <div><div class="nm">${short(p.sp)}</div>
    <div class="meta">酥脆 ${Math.round(effCrisp(p) * 100)}% · 耐久 ${Math.round(p.dur)}%</div>
    <div class="meta">${p.deco.length ? '裝飾 ' + p.deco.length : '無裝飾'} · 約 ${fmt(fair(p, 'live'))}${extra}</div></div></div>`;
}
const stockById = id => S.stock.find(p => p.id === +id);

/* ============================================================
   裝飾
   ============================================================ */
const decorSt = makeStage($('#decorCv'), 'decor');
const D = { id: null };
decorSt.onSel = () => renderDecorTools();
function renderDecor() {
  const p = stockById(D.id) || null; if (!p) D.id = null; decorSt.set(p);
  $('#decorStock').innerHTML = S.stock.length ? S.stock.map(q => itemHTML(q, 'decoSel', D.id)).join('') : '<div class="empty">庫存是空的，先到「加工」做一個吧。</div>';
  renderDecorTools();
}
function renderDecorTools() {
  const p = decorSt.p, box_ = $('#decoTools');
  if (!p) { box_.innerHTML = '<div class="empty">選擇捏捏後即可擺放裝飾零件（拖曳零件移動、拖曳空白處旋轉）。</div>'; return; }
  const pal = Object.keys(DECO).map(k => `<button data-act="addDeco" data-k="${k}" ${S.packs.includes(DECO[k].pack) ? '' : 'disabled title="到「升級」解鎖"'}>${dot(DECO[k].c)}${DECO[k].n}</button>`).join('');
  const d = p.deco[decorSt.sel];
  box_.innerHTML = `<div class="small">裝飾 ${p.deco.length}/6　加成 <b style="color:var(--warn)">+${Math.round(decoBonus(p) * 100)}%</b> 售價與人氣</div><div class="pal">${pal}</div>` +
    (d ? `<div class="small">縮放</div><input type="range" min="0.5" max="2" step="0.05" value="${d.s}" data-r="s"><div class="small">旋轉</div><input type="range" min="-3.14" max="3.14" step="0.05" value="${d.r}" data-r="r">
    <div class="row" style="margin-top:6px"><button class="btn sm red" data-act="delDeco">移除此零件</button></div>` : '<div class="hint">點選捏捏上的零件可調整大小、旋轉或移除。</div>') +
    `<div class="row" style="margin-top:6px"><button class="btn sm ghost" data-act="photo">拍照模式（下載圖片）</button></div>`;
}
document.addEventListener('input', e => {
  const r = e.target.dataset && e.target.dataset.r; if (!r) return; const p = decorSt.p; if (!p) return; const d = p.deco[decorSt.sel]; if (d) d[r] = +e.target.value;
});

/* ============================================================
   直播
   ============================================================ */
const liveSt = makeStage($('#liveCv'), 'squeeze');
const L = { on: false, hype: 0, viewers: 0, combo: 0, lastC: 0, stageId: null, saleT: 0, req: null, reqT: 18, chatT: 0 };
function chat(who, txt, cls) {
  const bx = $('#chat'); const d = document.createElement('div'); d.innerHTML = `<b>${esc(who)}</b>：${esc(txt)}`; bx.appendChild(d);
  while (bx.children.length > 40) bx.firstChild.remove(); bx.scrollTop = bx.scrollHeight;
  if (tab === 'live' && (Math.random() < 0.45 || cls === 'dm')) {
    const dm = document.createElement('div'); dm.className = 'dmk'; dm.textContent = txt; dm.style.top = rnd(0, 75) + '%'; dm.style.color = pick(['#fff', '#fbbf24', '#22d3ee', '#e879f9']);
    $('#danmaku').appendChild(dm); setTimeout(() => dm.remove(), 7200);
  }
}
liveSt.onCrunch = () => {
  if (!L.on) return; const now = performance.now();
  L.combo = now - L.lastC < 1200 ? L.combo + 1 : 1; L.lastC = now;
  L.hype = Math.min(100, L.hype + 5 + Math.min(L.combo, 20) * .4);
  if (Math.random() < .4) chat(pick(NAMES), pick(CHAT_CRUNCH));
  if (Math.random() < .05 * clamp(L.viewers / 30, .3, 2)) {
    const n = Math.round(rnd(5, 30) * (1 + L.combo / 10)); addMoney(n); S.fans += 0.3; sfx.tick();
    const e = document.createElement('div'); e.className = 'don'; e.textContent = `${pick(NAMES)} 斗內 ${fmt(n)}`; $('#donate').appendChild(e); setTimeout(() => e.remove(), 3000);
    while ($('#donate').children.length > 3) $('#donate').firstChild.remove();
  }
  renderTop();
};
function renderLive() {
  if (L.stageId && !stockById(L.stageId)) L.stageId = null;
  liveSt.set(stockById(L.stageId) || null);
  $('#liveStock').innerHTML = S.stock.length ? S.stock.map(q => itemHTML(q, 'stageSel', L.stageId)).join('') : '<div class="empty">庫存是空的，先去「加工」做捏捏。</div>';
  $('#livePrice').innerHTML = priceTable('live');
  $('#btnLive').textContent = L.on ? '結束直播' : '開始直播';
  updateLiveHUD();
}
function updateLiveHUD() {
  $('#liveBadge').textContent = L.on ? 'LIVE' : 'OFF AIR'; $('#liveBadge').className = 'badge' + (L.on ? ' on' : '');
  $('#liveViewers').textContent = Math.round(L.viewers) + ' 觀眾';
  $('#hypeBar').style.width = L.hype + '%'; $('#comboTxt').textContent = L.combo > 2 && L.on ? `${L.combo} 連擊` : '';
  const p = liveSt.p;
  $('#stageInfo').innerHTML = p ? `上台：<b>${SP[p.sp].name}</b>　酥脆 ${Math.round(effCrisp(p) * 100)}%　耐久 ${Math.round(p.dur)}%<br>售價 <b>${fmt(getPrice('live', p.sp))}</b>（合理價 ${fmt(fair(p, 'live'))}）` : '尚未選擇捏捏（按住捏捏擠壓，可滑動連續捏）';
  $('#reqBox').innerHTML = L.req && L.on ? `<span class="reqb">觀眾指定：${L.req.text}　剩 ${Math.ceil(L.req.t)}s　（成交 ×1.8）</span>` : '';
}
function reqMatch(p) { return L.req && (L.req.kind === 'sp' ? p.sp === L.req.sp : effCrisp(p) >= .7); }
function liveSale(p) {
  let price = getPrice('live', p.sp), bonus = 1;
  if (reqMatch(p)) { bonus = 1.8; L.req = null; S.fans += 3; chat('系統', '指定任務完成！限時銷售成交！', 'dm'); }
  const gain = price * bonus; addMoney(gain); S.sales++; S.fans += 1 + L.hype / 30;
  S.stock = S.stock.filter(q => q !== p); sfx.pop();
  chat(pick(NAMES), `買了${short(p.sp)}捏捏！${fmt(gain)}`, 'dm'); toast(`直播成交 +${fmt(gain)}`);
  const next = S.stock.slice().sort((a, b) => (reqMatch(b) - reqMatch(a)) || (effCrisp(b) - effCrisp(a)))[0]; L.stageId = next ? next.id : null;
  renderLive(); renderTop(); save();
}
function updateLive(dt) {
  const p = liveSt.p;
  if (L.on) {
    L.hype = Math.max(0, L.hype - 3 * dt); if (performance.now() - L.lastC > 1500) L.combo = 0;
    const tgt = (12 + S.fans * 0.8) * (1 + .15 * S.up.gear) * (.4 + L.hype / 60) * (p ? 1 : .5);
    L.viewers += (tgt - L.viewers) * dt * .8;
    L.saleT += dt;
    if (L.saleT >= 1.5) {
      L.saleT = 0;
      if (p) {
        const f = fair(p, 'live'), d0 = demand(getPrice('live', p.sp), f), d = d0 * (reqMatch(p) ? 1.6 : 1);
        if (d0 < .2 && Math.random() < .3) chat(pick(NAMES), pick(CHAT_EXPENSIVE));
        if (Math.random() < clamp(L.viewers / 60, 0, 1) * d * .45 * (.4 + L.hype / 80)) liveSale(p);
      }
    }
    L.chatT -= dt; if (L.chatT <= 0) { L.chatT = rnd(1.5, 4) / clamp(L.viewers / 20, .5, 4); chat(pick(NAMES), pick(CHAT_IDLE)); }
    if (L.req) { L.req.t -= dt; if (L.req.t <= 0) { L.req = null; chat('系統', '指定任務已結束', 'dm'); } }
    else {
      L.reqT -= dt;
      if (L.reqT <= 0) {
        L.reqT = rnd(25, 40); const us = unlockedSpecies();
        if (Math.random() < .6) { const sp = pick(us); L.req = { kind: 'sp', sp: sp.id, t: 40, text: `要「${sp.name}」` }; } else L.req = { kind: 'cr', t: 40, text: '要酥脆度 ≥ 70% 的' };
        chat('系統', '新的觀眾指定：' + L.req.text, 'dm');
      }
    }
  } else { L.hype = Math.max(0, L.hype - 10 * dt); L.viewers = Math.max(0, L.viewers - dt * 10); L.combo = 0; L.req = null; }
}

/* ============================================================
   定價表
   ============================================================ */
function priceTable(ch) {
  const list = SPECIES.filter(s => S.codex[s.id]); if (!list.length) return '<div class="empty">尚未收集任何史萊姆。</div>';
  return list.map(s => {
    const f = fair({ sp: s.id, crisp: .8, dur: 100, deco: [] }, ch), l = demandLabel(demand(getPrice(ch, s.id), f));
    return `<div class="prow"><span class="nm">${dot(s.color)}${s.name}${trend.sp === s.id ? ' <span class="tag">流行</span>' : ''}<br><small style="color:var(--sub)">基準合理價 ${fmt(f)}</small></span>
      <input type="number" min="1" max="99999" value="${getPrice(ch, s.id)}" data-price="${ch}" data-sp="${s.id}"><span class="dem" style="color:${l[1]}">${l[0]}</span></div>`;
  }).join('');
}
document.addEventListener('change', e => {
  const t = e.target; if (!t.dataset || !t.dataset.price) return; S.price[t.dataset.price][t.dataset.sp] = clamp(Math.round(+t.value) || 1, 1, 99999); save();
  t.dataset.price === 'live' ? renderLive() : renderWeb();
});

/* ============================================================
   網站
   ============================================================ */
const rating = () => { const a = S.rate.slice(-20); return a.reduce((x, y) => x + y, 0) / a.length; };
function webTick() {
  if (!S.web.length) return null;
  if (Math.random() > clamp(0.25 + S.fans / 400 + (rating() - 3) * .1, .05, .9)) return null;
  const p = pick(S.web), f = fair(p, 'web'), price = getPrice('web', p.sp);
  if (Math.random() > demand(price, f) * .7) return null;
  addMoney(price); S.sales++; S.fans += .3; S.web = S.web.filter(q => q !== p);
  const stars = clamp(Math.round(1 + 2.2 * effCrisp(p) + 1.8 * clamp(f / price, 0, 1.3)), 1, 5);
  S.rate.push(stars); if (S.rate.length > 40) S.rate.shift();
  S.reviews.unshift({ s: stars, t: pick(REVIEWS[stars]), who: pick(NAMES), sp: SP[p.sp].name }); S.reviews.length = Math.min(S.reviews.length, 8);
  return { price, stars };
}
function renderWeb() {
  const r = rating();
  $('#webInfo').innerHTML = `<div class="row"><div class="grow">店鋪評分 <b class="stars">${'★'.repeat(Math.round(r))}${'☆'.repeat(5 - Math.round(r))}</b> ${r.toFixed(1)}　粉絲 ${Math.floor(S.fans)}</div><div class="small">貨架 ${S.web.length}/${slots()}</div></div>`;
  $('#webShelf').innerHTML = S.web.length ? S.web.map(p => itemHTML(p, 'unlist', null, ` · 售 ${fmt(getPrice('web', p.sp))}`)).join('') : '<div class="empty">貨架空空如也，從下方上架商品。</div>';
  $('#webStock').innerHTML = S.stock.length ? S.stock.map(p => itemHTML(p, 'list', null)).join('') : '<div class="empty">庫存是空的。</div>';
  $('#webPrice').innerHTML = priceTable('web');
  $('#reviews').innerHTML = S.reviews.length ? S.reviews.map(v => `<div><span class="stars">${'★'.repeat(v.s)}</span> ${esc(v.who)}：${esc(v.t)} <small style="color:var(--sub)">（${v.sp}）</small></div>`).join('') : '尚無評價';
}

/* ============================================================
   升級
   ============================================================ */
const upCost = k => Math.round(UPS[k].base * Math.pow(1.7, S.up[k]));
const lvBar = (lv, max) => `<span class="lv">${Array.from({ length: max }, (_, j) => `<i class="${j < lv ? 'on' : ''}"></i>`).join('')}</span>`;
function renderUp() {
  const row = k => {
    const u = UPS[k], lv = S.up[k], max = lv >= u.max;
    return `<div class="card up"><div class="info"><b>${u.name}</b>${lvBar(lv, u.max)}<div class="small" style="color:var(--sub)">${u.desc}</div></div>
      <button class="btn sm" data-act="buyUp" data-k="${k}" ${max || S.money < upCost(k) ? 'disabled' : ''}>${max ? '已滿級' : fmt(upCost(k))}</button></div>`;
  };
  let h = '<h3>產線機器</h3>' + Object.keys(UPS).filter(k => UPS[k].mach).map(row).join('');
  h += '<h3>設施</h3>' + Object.keys(UPS).filter(k => !UPS[k].mach).map(row).join('');
  h += '<h3>裝飾零件包</h3>' + Object.keys(PACKS).map(k => {
    const has = S.packs.includes(k), pk = PACKS[k], items = Object.values(DECO).filter(d => d.pack === k).map(d => dot(d.c) + d.n).join('　');
    return `<div class="card up"><div class="info"><b>${pk.name}</b><div class="small" style="color:var(--sub)">${items}</div></div>
      <button class="btn sm" data-act="buyPack" data-k="${k}" ${has || S.money < pk.cost ? 'disabled' : ''}>${has ? '已擁有' : fmt(pk.cost)}</button></div>`;
  }).join('');
  $('#upList').innerHTML = h;
}

/* ============================================================
   中期三線
   ============================================================ */
const BT = { fac: 0, ct: 0, sc: 0 };
const branchReady = () => !S.branch && S.earned >= 2500 && S.fans >= 60;
function checkBranch() {
  $('#navBranch').hidden = !(S.branch || branchReady());
  if (branchReady() && !S.seen_branch) {
    S.seen_branch = true;
    modal(`<h2>工坊的轉捩點</h2><p>你的捏捏已經小有名氣，累積營收 ${fmt(S.earned)}、粉絲 ${Math.floor(S.fans)}。<br>三條道路擺在眼前，玩法與劇情都不同（一旦選擇就無法更改）：</p>
    <p>${Object.values(BRANCHES).map(b => `<b>${b.name}</b>：${b.desc}`).join('<br><br>')}</p><p>請到下方「事業」頁籤做出選擇。</p>`);
  }
}
function renderBranch() {
  const bx = $('#branchBody'), fw = $('#facWrap');
  const showFac = S.branch === 'factory'; if (fw.hidden === showFac) { fw.hidden = !showFac; if (showFac) setTimeout(() => { initFac(); FAC.v && FAC.v.resize(); }, 0); }
  if (!S.branch) {
    bx.innerHTML = `<h2>選擇你的事業道路</h2><div class="bgroup">${Object.keys(BRANCHES).map(k => `<div class="card"><b>${BRANCHES[k].name}</b><div class="small" style="color:var(--sub);margin:6px 0">${BRANCHES[k].desc}</div>
      <button class="btn" data-act="chooseBranch" data-k="${k}">選擇此道路</button></div>`).join('')}</div>`;
    return;
  }
  if (S.branch === 'factory') {
    const hc = Math.round(400 * Math.pow(1.5, S.workers)), ac = Math.round(600 * Math.pow(1.8, S.auto));
    bx.innerHTML = `<h2>自家工廠</h2><div class="hint">每位員工操作一台機械手臂，每 12 秒自動消耗 2 凝膠製作 1 個捏捏（品質取決於自動化等級），並持續領薪（每人 ¥3/分鐘）。凝膠不足或庫存滿時停工，請用養殖槽維持凝膠供應。</div>
    <div class="card"><div class="row"><div class="grow">員工／機械手臂 <b>${S.workers}</b>　薪資 ${fmt(S.workers * 3)}/分<br>自動化 Lv${S.auto}（品質 ${Math.round((0.55 + 0.05 * S.auto) * 100)}%）</div></div>
    <div class="row" style="margin-top:8px"><button class="btn sm" data-act="hire" ${S.money < hc || S.workers >= 12 ? 'disabled' : ''}>增設手臂並雇用 ${fmt(hc)}</button>
    <button class="btn sm ghost" data-act="auto" ${S.money < ac || S.auto >= 8 ? 'disabled' : ''}>升級自動化 ${fmt(ac)}</button></div></div>
    <div class="card small">庫存 ${S.stock.length}/${cap()}　凝膠合計 ${Object.values(S.gel).reduce((a, b) => a + b, 0)}</div>`;
  } else if (S.branch === 'corp') {
    bx.innerHTML = `<h2>企業合作</h2><div class="hint">大公司定期釋出訂單，報酬約為合理價 ×1.5，但需在期限內交付足夠品質的商品。逾期會損失信譽（信譽越高，要求與報酬都越高）。</div>
    <div class="card small">企業信譽 <b>${S.rep}</b>　承接中 ${S.contracts.length}/3</div>` +
      (S.contracts.length ? S.contracts.map(c => {
        const ok = contractItems(c); return `<div class="card"><b>${c.sp === 'any' ? '任意種類' : SP[c.sp].name}</b> × ${c.n}　酥脆 ≥ ${Math.round(c.min * 100)}%<br>報酬 <b style="color:var(--warn)">${fmt(c.reward)}</b>　剩餘 ${Math.max(0, Math.ceil((c.dl - Date.now()) / 1000))} 秒
        <div class="row" style="margin-top:6px"><span class="small grow">符合庫存 ${ok.length}/${c.n}</span><button class="btn sm" data-act="deliver" data-id="${c.id}" ${ok.length < c.n ? 'disabled' : ''}>交貨</button></div></div>`;
      }).join('') : '<div class="empty">目前沒有訂單，請稍候…</div>');
  } else {
    bx.innerHTML = `<h2>溫馨小店</h2><div class="hint">顧客會上門指定想要的種類。記住熟客並滿足他們，可累積好感度，熟客會給更高價與小費。顧客等太久會失望離開。</div>
    <div class="card small">熟客 ${Object.values(S.regulars).filter(v => v >= 5).length} 位　（好感 ≥ 5 為熟客）</div>` +
      (S.customers.length ? S.customers.map(c => {
        const ok = shopItem(c), aff = S.regulars[c.name] || 0; return `<div class="card"><b>${esc(c.name)}</b> ${aff >= 5 ? '<span class="tag">熟客</span>' : ''} <small style="color:var(--sub)">好感 ${aff}</small><br>想要：<b>${SP[c.sp].name}</b>　酥脆 ≥ ${Math.round(c.min * 100)}%
        <div class="meter2" style="margin:6px 0"><i style="width:${clamp((c.dl - Date.now()) / 450, 0, 100)}%"></i></div>
        <button class="btn sm" data-act="serve" data-id="${c.id}" ${ok ? '' : 'disabled'}>${ok ? `出貨 ${fmt(shopPrice(c, ok))}` : '庫存無符合商品'}</button></div>`;
      }).join('') : '<div class="empty">店裡暫時沒有客人…</div>');
  }
}
function contractItems(c) { return S.stock.filter(p => (c.sp === 'any' || p.sp === c.sp) && effCrisp(p) >= c.min).sort((a, b) => effCrisp(a) - effCrisp(b)).slice(0, c.n); }
function shopItem(c) { return S.stock.filter(p => p.sp === c.sp && effCrisp(p) >= c.min).sort((a, b) => effCrisp(a) - effCrisp(b))[0]; }
function shopPrice(c, p) { return fair(p, 'shop') * (1 + Math.min(S.regulars[c.name] || 0, 10) * .02); }
function branchTick(dt) {
  if (S.branch === 'factory' && S.workers > 0) {
    if (S.money > 0) S.money = Math.max(0, S.money - S.workers * .05 * dt);
    BT.fac += dt * S.workers / 12; FAC.working = false;
    while (BT.fac >= 1) {
      BT.fac -= 1; if (S.stock.length >= cap()) break;
      const sp = Object.keys(S.gel).filter(k => S.gel[k] >= 2).sort((a, b) => S.gel[b] - S.gel[a])[0]; if (!sp) break;
      S.gel[sp] -= 2; S.stock.push(makeProduct(sp, clamp(0.55 + 0.05 * S.auto + rnd(-.05, .05), .2, 1))); renderGelBar(); FAC.lastSp = sp;
    }
    FAC.working = S.stock.length < cap() && Object.values(S.gel).some(v => v >= 2);
  }
  if (S.branch === 'corp') {
    const now = Date.now();
    S.contracts = S.contracts.filter(c => { if (now > c.dl) { S.rep = Math.max(0, S.rep - 1); toast('訂單逾期，企業信譽 -1'); return false; } return true; });
    BT.ct += dt;
    if (BT.ct > 20 && S.contracts.length < 3) {
      BT.ct = 0; const us = unlockedSpecies(), n = 2 + Math.floor(Math.random() * 3), any = Math.random() < .4, sp = any ? 'any' : pick(us).id, min = clamp(.35 + .05 * S.rep + rnd(0, .15), .3, .9);
      const base = any ? us.reduce((a, s) => a + s.price, 0) / us.length : SP[sp].price;
      S.contracts.push({ id: S.nextId++, sp, n, min, reward: Math.round(n * base * (0.4 + 1.1 * (min + .1)) * 1.5 * (1 + S.rep * .05)), dl: now + 240000 }); toast('收到新的企業訂單');
    }
  }
  if (S.branch === 'shop') {
    const now = Date.now(); S.customers = S.customers.filter(c => { if (now > c.dl) { S.regulars[c.name] = Math.max(0, (S.regulars[c.name] || 0) - 1); toast(`${c.name} 等太久離開了`); return false; } return true; });
    BT.sc += dt;
    if (BT.sc > 10 && S.customers.length < 3) {
      BT.sc = 0; const reg = Object.keys(S.regulars).filter(k => S.regulars[k] >= 3), name = reg.length && Math.random() < .5 ? pick(reg) : pick(REG_NAMES);
      if (!S.customers.some(c => c.name === name)) { S.customers.push({ id: S.nextId++, name, sp: pick(unlockedSpecies()).id, min: rnd(.3, .7), dl: now + 45000 }); toast(`${name} 來店了`); }
    }
  }
}
function chooseBranch(k) { S.branch = k; save(); checkBranch(); renderBranch(); toast('已選擇：' + BRANCHES[k].name); }

/* ---------- 工廠 3D（機械手臂產線） ---------- */
const FAC = { v: null, built: -1, arms: [], blocks: [], t: 0, working: false };
function initFac() {
  if (FAC.v) return;
  try { FAC.v = makeView($('#facCv'), '#0b1220', 36); } catch (e) { return; }
  const sc = FAC.v.scene; basicLights(sc); sc.fog = new THREE.Fog('#0b1220', 18, 40);
  FAC.v.cam.position.set(0, 5.5, 10.5); FAC.v.cam.lookAt(0, .8, 0);
  const fl = mesh(new THREE.PlaneGeometry(60, 30), std('#0f172a', { roughness: .4, metalness: .5 }), 0, 0, 0, sc); fl.rotation.x = -Math.PI / 2;
  const grid = new THREE.GridHelper(40, 40, '#1e293b', '#152033'); grid.position.y = .005; sc.add(grid);
  const dark = std('#1e293b', { metalness: .7, roughness: .35 });
  box(18, .35, 1.6, dark, 0, .45, 1, sc); box(18, .06, 1.4, std('#0b0f17'), 0, .65, 1, sc);
  FAC.mats = SPECIES.map(s => new THREE.MeshPhysicalMaterial({ color: s.color, roughness: .15, clearcoat: 1, transmission: .3, thickness: .4 }));
  for (let i = 0; i < 12; i++) { const b = box(.42, .42, .42, FAC.mats[i % 3], -9 + i * 1.5, .9, 1, sc); FAC.blocks.push(b); }
  FAC.root = new THREE.Group(); sc.add(FAC.root);
}
function buildFac() {
  const n = Math.min(S.workers, 12); FAC.built = S.workers; FAC.root.children.slice().forEach(c => { FAC.root.remove(c); disposeTree(c); }); FAC.arms = [];
  const dark = std('#1e293b', { metalness: .7, roughness: .35 }), orange = std('#f97316', { metalness: .4, roughness: .35 }), steel = std('#94a3b8', { metalness: .9, roughness: .2 });
  for (let i = 0; i < n; i++) {
    const x = -7.5 + (n > 1 ? i * 15 / (n - 1) : 7.5), g = new THREE.Group(); g.position.set(x, 0, -.6); FAC.root.add(g);
    cyl(.4, .5, .3, 20, dark, 0, .15, 0, g);
    const yaw = new THREE.Group(); yaw.position.y = .3; g.add(yaw); cyl(.18, .22, .8, 16, orange, 0, .4, 0, yaw);
    const sh = new THREE.Group(); sh.position.y = .85; yaw.add(sh); mesh(new THREE.SphereGeometry(.2, 16, 12), steel, 0, 0, 0, sh);
    box(.18, 1.2, .18, orange, 0, .6, 0, sh);
    const el = new THREE.Group(); el.position.y = 1.2; sh.add(el); mesh(new THREE.SphereGeometry(.15, 14, 10), steel, 0, 0, 0, el);
    box(.14, .9, .14, orange, 0, .45, 0, el); box(.3, .08, .3, steel, 0, .92, 0, el);
    const led = mesh(new THREE.SphereGeometry(.08, 10, 8), new THREE.MeshBasicMaterial({ color: '#34d399' }), .35, .35, .3, g);
    FAC.arms.push({ yaw, sh, el, led, ph: i * .7 });
  }
}
function facStep(dt) {
  if (!FAC.v) return; if (FAC.built !== S.workers) buildFac(); FAC.t += dt; const t = FAC.t, w = FAC.working;
  FAC.arms.forEach(a => {
    const k = w ? 1 : .1; a.yaw.rotation.y = Math.sin(t * 1.5 * k + a.ph) * .9; a.sh.rotation.x = .5 + Math.sin(t * 2 * k + a.ph) * .35; a.el.rotation.x = .9 + Math.cos(t * 2 * k + a.ph) * .4;
    a.led.material.color.set(w ? '#34d399' : (Math.sin(t * 4) > 0 ? '#fbbf24' : '#78350f'));
  });
  FAC.blocks.forEach((b, i) => { b.visible = S.workers > 0; b.position.x += dt * (w ? 1.2 : 0); if (b.position.x > 9) { b.position.x -= 18; b.material = FAC.mats[(i + Math.floor(t)) % FAC.mats.length]; } b.rotation.y += dt * (w ? 1 : 0); });
  FAC.v.cam.position.x = Math.sin(t * .2) * 1.5; FAC.v.cam.lookAt(0, .8, 0); FAC.v.render();
}

/* ============================================================
   圖鑑與終局
   ============================================================ */
const GOAL = { species: 8, fans: 800, earned: 40000 };
function renderCodex() {
  const made = SPECIES.filter(s => S.codex[s.id] && S.codex[s.id].made > 0).length;
  const g = [['製作過所有種類', made, GOAL.species], ['粉絲數', Math.floor(S.fans), GOAL.fans], ['累積營收', Math.floor(S.earned), GOAL.earned]];
  const ok = g.every(x => x[1] >= x[2]);
  let h = `<div class="card"><b>終局目標：開設「夢想捏捏博物館」</b><div class="small" style="color:var(--sub);margin:4px 0 8px">讓全世界都聽見史萊姆的酥脆聲。</div>` +
    g.map(x => `<div class="small">${x[0]}　${x[1].toLocaleString()} / ${x[2].toLocaleString()}</div><div class="meter2" style="margin:3px 0 7px"><i style="width:${clamp(x[1] / x[2] * 100, 0, 100)}%"></i></div>`).join('') +
    `<button class="btn" data-act="finish" ${ok && !S.done ? '' : 'disabled'}>${S.done ? '已達成' : '完成夢想'}</button></div><h3>史萊姆圖鑑</h3><div class="grid">`;
  h += SPECIES.map(s => { const c = S.codex[s.id]; return `<div class="card item" style="cursor:default"><div class="sw" style="background:${c ? swatch(s) : '#1e293b'}"></div><div><div class="nm">${c ? s.name : '？？？'}</div><div class="meta">${ZONES.find(z => z.id === s.zone).name} · <span style="color:${RAR[s.rar].c}">${RAR[s.rar].n}</span></div><div class="meta">${c ? `已製作 ${c.made} 個` : '尚未發現'}</div></div></div>`; }).join('') + '</div>';
  $('#codexBody').innerHTML = h;
}
function finish() {
  S.done = true; save();
  const txt = { factory: '你的工廠日夜運轉，月光谷的酥脆聲成為了全世界的背景音樂。', corp: '你與大企業攜手，把史萊姆捏捏帶進每個人的辦公桌，成為解壓文化的代名詞。', shop: '你的小店成了鎮上的溫暖角落，熟客們帶著笑容與酥脆聲度過每個日子。' }[S.branch || 'shop'];
  modal(`<h2>夢想捏捏博物館開幕</h2><p>${txt}</p><p>你是真正的史萊姆捏捏大師。你可以繼續遊玩，享受酥脆的療癒時光。</p>`);
}

/* ============================================================
   頂欄 / 捕捉 UI
   ============================================================ */
function renderZones() {
  $('#zones').innerHTML = ZONES.map(z => { const un = S.zones.includes(z.id); return `<button class="zbtn ${F.zone === z.id ? 'on' : ''} ${un ? '' : 'lock'}" data-act="zone" data-id="${z.id}">${dot(z.acc)}${z.name}<br><small>${un ? '已解鎖' : '解鎖 ' + fmt(z.cost)}</small></button>`; }).join('');
}
function renderGelBar() {
  const h = SPECIES.filter(s => S.gel[s.id]).map(s => `<span class="chip">${dot(s.color)}${short(s.id)} ×${S.gel[s.id]}</span>`).join('');
  $('#gelBar').innerHTML = h || '<span class="small" style="color:var(--sub)">背包還沒有凝膠，快去採集吧！</span>';
}
function renderTop() {
  $('#sMoney').textContent = fmt(S.money); $('#sFans').textContent = '粉絲 ' + Math.floor(S.fans);
  const t = trend.sp ? SP[trend.sp] : null; $('#sTrend').innerHTML = t ? `流行 ${dot(t.color)}${short(trend.sp)} ×1.35` : '流行 —';
  $('#btnSound').classList.toggle('off', !S.sound);
}
function pickTrend() { trend.sp = pick(unlockedSpecies()).id; renderTop(); toast('流行色更新：' + SP[trend.sp].name); }

/* ============================================================
   分頁 / 事件
   ============================================================ */
let tab = 'catch';
const RENDER = {
  catch() { renderZones(); renderGelBar(); setTimeout(() => { initField() && F.v.resize(); }, 0); },
  make() { renderMake(); setTimeout(() => { initMake() && MK.v.resize(); }, 0); },
  decor() { renderDecor(); setTimeout(decorSt.resize, 0); },
  live() { renderLive(); setTimeout(liveSt.resize, 0); },
  web: renderWeb, up: renderUp, branch: renderBranch, codex: renderCodex,
};
function showTab(t) {
  tab = t; $$('.panel').forEach(p => p.classList.toggle('on', p.id === 'p-' + t)); $$('#nav button').forEach(b => b.classList.toggle('on', b.dataset.tab === t));
  RENDER[t](); $('main').scrollTop = 0;
}
function refresh() { RENDER[tab](); renderTop(); }
document.addEventListener('click', e => {
  const el = e.target.closest('[data-act]'); if (!el) return; const a = el.dataset.act, id = el.dataset.id, k = el.dataset.k;
  try { audio(); } catch (_) { }
  switch (a) {
    case 'tab': showTab(el.dataset.tab); break;
    case 'zone': {
      const z = ZONES.find(z => z.id === id);
      if (!S.zones.includes(id)) { if (S.money < z.cost) return toast('資金不足'); S.money -= z.cost; S.zones.push(id); toast('已解鎖 ' + z.name); }
      F.zone = id; buildZone(); fillField(); refresh(); save(); break;
    }
    case 'pickSp': M.sp = id; M.last = null; renderMake(); break;
    case 'startMake': startMake(); break;
    case 'stopBar': stopBar(); break;
    case 'goDecor': D.id = +id; showTab('decor'); break;
    case 'decoSel': D.id = +id; renderDecor(); break;
    case 'addDeco': {
      const p = decorSt.p; if (!p) return; if (p.deco.length >= 6) return toast('最多 6 個零件');
      p.deco.push({ k, x: rnd(-.45, .45), z: rnd(-.45, .45), s: 1, r: 0 }); decorSt.sel = p.deco.length - 1; decorSt.rebuildDeco(); sfx.tick(); renderDecorTools(); save(); break;
    }
    case 'delDeco': { const p = decorSt.p; if (p && decorSt.sel >= 0) { p.deco.splice(decorSt.sel, 1); decorSt.sel = -1; decorSt.rebuildDeco(); renderDecorTools(); save(); } break; }
    case 'photo': {
      if (!decorSt.ready) return; decorSt.selRing.visible = false; decorSt.v.render();
      const a2 = document.createElement('a'); a2.download = 'squish-lab.png'; a2.href = decorSt.cv.toDataURL('image/png'); a2.click(); toast('已儲存圖片'); break;
    }
    case 'toggleLive': L.on = !L.on; if (L.on) { chat('系統', '直播開始！歡迎大家', 'dm'); if (!liveSt.p) toast('先從庫存選一個捏捏上台'); } else toast('直播結束'); renderLive(); break;
    case 'stageSel': L.stageId = +id; renderLive(); break;
    case 'list': { const p = stockById(id); if (!p) return; if (S.web.length >= slots()) return toast('貨架已滿，請升級網站伺服器'); S.stock = S.stock.filter(q => q !== p); S.web.push(p); renderWeb(); save(); break; }
    case 'unlist': { const p = S.web.find(q => q.id === +id); if (!p) return; if (S.stock.length >= cap()) return toast('庫存已滿'); S.web = S.web.filter(q => q !== p); S.stock.push(p); renderWeb(); save(); break; }
    case 'buyUp': { const c = upCost(k); if (S.money < c || S.up[k] >= UPS[k].max) return; S.money -= c; S.up[k]++; sfx.pop(); renderUp(); renderTop(); save(); break; }
    case 'buyPack': { const c = PACKS[k].cost; if (S.money < c) return; S.money -= c; S.packs.push(k); sfx.pop(); renderUp(); renderTop(); save(); break; }
    case 'chooseBranch': chooseBranch(k); break;
    case 'hire': { const c = Math.round(400 * Math.pow(1.5, S.workers)); if (S.money >= c) { S.money -= c; S.workers++; renderBranch(); renderTop(); save(); } break; }
    case 'auto': { const c = Math.round(600 * Math.pow(1.8, S.auto)); if (S.money >= c) { S.money -= c; S.auto++; renderBranch(); renderTop(); save(); } break; }
    case 'deliver': {
      const c = S.contracts.find(x => x.id === +id); if (!c) return; const it = contractItems(c); if (it.length < c.n) return;
      S.stock = S.stock.filter(p => !it.includes(p)); S.contracts = S.contracts.filter(x => x !== c); addMoney(c.reward); S.rep++; S.fans += 2; sfx.pop(); toast(`交貨完成 +${fmt(c.reward)}`); refresh(); save(); break;
    }
    case 'serve': {
      const c = S.customers.find(x => x.id === +id); if (!c) return; const p = shopItem(c); if (!p) return; const pr = shopPrice(c, p), aff = S.regulars[c.name] || 0, tip = aff >= 5 ? Math.round(pr * .15) : 0;
      S.stock = S.stock.filter(q => q !== p); S.customers = S.customers.filter(x => x !== c); S.regulars[c.name] = aff + 1; addMoney(pr + tip); S.fans += 1; sfx.pop();
      toast(`${c.name} 滿意離開 +${fmt(pr + tip)}${tip ? '（含小費）' : ''}`); refresh(); save(); break;
    }
    case 'finish': finish(); break;
    case 'sound': S.sound = !S.sound; renderTop(); save(); break;
    case 'help': showIntro(); break;
    case 'reset': modal('<h2>重置存檔？</h2><p>所有進度將被清除，無法復原。</p>', [{ t: '取消', ghost: true }, { t: '確定重置', f: () => { localStorage.removeItem(SAVE_KEY); location.reload(); } }]); break;
  }
});
document.addEventListener('keydown', e => { if (e.code === 'Space' && tab === 'make' && M.active) { e.preventDefault(); stopBar(); } });

function showIntro() {
  S.seen = true; save();
  modal(`<h2>歡迎來到月光谷</h2>
  <p>月光谷的史萊姆誕生於月光與露水交融之處。你繼承了奶奶留下的捏捏工坊，要用機器產線把史萊姆的可再生凝膠，做成世上最療癒的酥脆捏捏。</p>
  <p><b>核心循環</b>：捕捉 → 加工 → 裝飾 → 銷售（直播／網站）→ 收益 → 升級機器與解鎖。</p>
  <p><b>5 分鐘</b>：採集凝膠、啟動產線做出第一個捏捏、上直播捏出人氣並賣掉它。<br><b>1 小時</b>：解鎖新生態區、升級機器與設備、經營網站被動收入、在中期選擇工廠／企業／小店之路。</p>
  <p><b>終局</b>：製作所有種類、累積粉絲與營收，開設「夢想捏捏博物館」。</p>
  <p class="small" style="color:var(--sub)">操作：點擊史萊姆採集；產線運轉時按「停機」；直播時按住捏捏擠壓，可滑動連續捏；裝飾時拖曳零件、拖曳空白處旋轉。手機可直接觸控，並有震動回饋。</p>`, [{ t: '開始遊戲' }]);
}

/* ---------- 主迴圈 ---------- */
let lastT = performance.now(), secAcc = 0, webAcc = 0, farmAcc = 0, trendAcc = 0, saveAcc = 0, hudN = 0;
function loop(now) {
  const dt = Math.min((now - lastT) / 1000, .1); lastT = now;
  trendAcc += dt; if (trendAcc > 90) { trendAcc = 0; pickTrend(); }
  farmAcc += dt;
  if (S.up.farm > 0 && farmAcc >= 12 / S.up.farm) {
    farmAcc = 0; const sp = pick(unlockedSpecies()); S.gel[sp.id] = (S.gel[sp.id] || 0) + 1; discover(sp.id);
    if (tab === 'catch') renderGelBar(); if (tab === 'make' && !M.active) renderMake();
  }
  webAcc += dt; if (webAcc >= 4) { webAcc = 0; const r = webTick(); if (r) { toast(`網站成交 +${fmt(r.price)}　${'★'.repeat(r.stars)}`); renderTop(); if (tab === 'web') renderWeb(); } }
  branchTick(dt); updateLive(dt);
  secAcc += dt; saveAcc += dt;
  if (secAcc >= 1) { secAcc = 0; checkBranch(); renderTop(); const ae = document.activeElement; if (!(ae && ae.tagName === 'INPUT') && tab === 'branch') renderBranch(); }
  if (saveAcc > 5) { saveAcc = 0; save(); }
  try {
    if (tab === 'catch') fieldStep(dt);
    else if (tab === 'make') {
      if (M.active) { M.pos += M.dir * M.spd * dt; if (M.pos > 1) { M.pos = 1; M.dir = -1; } if (M.pos < 0) { M.pos = 0; M.dir = 1; } const cur = $('#mcur'); if (cur) cur.style.left = M.pos * 100 + '%'; }
      makeStep(dt);
    }
    else if (tab === 'decor') decorSt.step(dt);
    else if (tab === 'live') { liveSt.step(dt); $('#hypeBar').style.width = L.hype + '%'; $('#liveViewers').textContent = Math.round(L.viewers) + ' 觀眾'; if (++hudN % 15 === 0) updateLiveHUD(); }
    else if (tab === 'branch' && S.branch === 'factory') facStep(dt);
  } catch (err) { console.error(err); }
  requestAnimationFrame(loop);
}

/* ---------- 離線結算 ---------- */
function offlineCatchUp() {
  const el = Math.min((Date.now() - S.last) / 1000, 1800); if (el < 8 || !S.web.length) return;
  let gain = 0, n = 0; for (let i = 0; i < Math.floor(el / 4); i++) { const before = S.earned; if (webTick()) { gain += S.earned - before; n++; } }
  if (n) setTimeout(() => toast(`離線期間網站賣出 ${n} 件，+${fmt(gain)}`), 600);
}

/* ---------- 啟動 ---------- */
window.addEventListener('resize', () => { F.v && F.v.resize(); MK.v && MK.v.resize(); decorSt.ready && decorSt.v.resize(); liveSt.ready && liveSt.v.resize(); FAC.v && FAC.v.resize(); });
offlineCatchUp(); pickTrend(); renderTop(); checkBranch();
M.sp = (unlockedSpecies().find(s => S.gel[s.id]) || {}).id || null;
showTab('catch');
if (!S.seen) showIntro();
window.addEventListener('beforeunload', save);
requestAnimationFrame(loop);
