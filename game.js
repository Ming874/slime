'use strict';
/* ============================================================
   史萊姆捏捏工坊 SQUISH LAB — 3D 開放世界版
   第一人稱自由探索：採集 → 工坊加工 → 裝飾 → 直播/網站銷售 → 升級
   介面參考 Minecraft 的玩家操作設計（準心、快捷列、背包、工作站介面）
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
const smooth = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
const TOUCH = matchMedia('(pointer:coarse)').matches || ('ontouchstart' in window && navigator.maxTouchPoints > 0);
const LOW = TOUCH || Math.min(screen.width, screen.height) < 700;
if (TOUCH) document.body.classList.add('touch');

/* ---------- 資料 ---------- */
const ZONES = [
  { id: 'forest', name: '森林', acc: '#34d399' },
  { id: 'coast', name: '海岸', acc: '#38bdf8' },
  { id: 'volcano', name: '火山', acc: '#f97316' },
  { id: 'snow', name: '雪原', acc: '#bae6fd' },
];
const RAR = [null, { n: '普通', c: '#cbd5e1' }, { n: '優良', c: '#34d399' }, { n: '稀有', c: '#e879f9' }, { n: '傳說', c: '#fbbf24' }];
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
const DECO = {
  bead: { n: '珍珠', v: .04, pack: 'base', c: '#f1f5f9' }, cube: { n: '方塊', v: .04, pack: 'base', c: '#94a3b8' }, ring: { n: '圓環', v: .05, pack: 'base', c: '#e879f9' },
  cone: { n: '錐體', v: .07, pack: 'metal', c: '#cbd5e1', metal: 1 }, disc: { n: '圓盤', v: .07, pack: 'metal', c: '#fbbf24', metal: 1 }, pyramid: { n: '角錐', v: .08, pack: 'metal', c: '#f59e0b', metal: 1 },
  gem: { n: '寶石', v: .10, pack: 'glass', c: '#38bdf8' }, crystal: { n: '晶柱', v: .10, pack: 'glass', c: '#a78bfa' }, star: { n: '星晶', v: .10, pack: 'glass', c: '#fde047' },
  orb: { n: '光球', v: .16, pack: 'neon', c: '#22d3ee', glow: 1 }, knot: { n: '扭結', v: .18, pack: 'neon', c: '#fb7185', glow: 1 }, drop: { n: '水滴', v: .14, pack: 'neon', c: '#34d399', glow: 1 },
  dodeca: { n: '稜鏡', v: .22, pack: 'prism', c: '#e879f9', metal: 1 }, helix: { n: '螺旋', v: .25, pack: 'prism', c: '#818cf8', glow: 1 }, halo: { n: '光環', v: .18, pack: 'prism', c: '#fbbf24', glow: 1 },
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
  boots: { name: '輕量跑鞋', desc: '移動速度 +10%', base: 160, max: 3 },
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
const SAVE_KEY = 'slime_world_v1';
function fresh() {
  return {
    money: 60, fans: 0, earned: 0, gel: {}, stock: [], web: [], price: { live: {}, web: {} },
    zones: ['forest'], packs: ['base'], up: Object.fromEntries(Object.keys(UPS).map(k => [k, 0])),
    codex: {}, rate: [4, 4, 5], reviews: [], branch: null, workers: 0, auto: 0, rep: 0,
    contracts: [], regulars: {}, customers: [], nextId: 1, last: Date.now(), done: false, sound: true, seen: false, sales: 0,
    pos: null, hb: 0, sens: 1, q: null,
  };
}
function load() {
  try { const o = JSON.parse(localStorage.getItem(SAVE_KEY)); if (o) return Object.assign(fresh(), o, { up: Object.assign(fresh().up, o.up) }); } catch (e) { }
  return null;
}
let S = load() || fresh();
function save() { S.last = Date.now(); if (P) S.pos = { x: P.x, z: P.z, yaw: P.yaw }; try { localStorage.setItem(SAVE_KEY, JSON.stringify(S)); } catch (e) { } }

/* ---------- 經濟公式 ---------- */
const trend = { sp: null };
const cap = () => 8 + S.up.cap * 6;
const slots = () => 4 + S.up.shelf * 2;
const effCrisp = p => p.crisp * (0.35 + 0.65 * p.dur / 100);
const decoBonus = p => p.deco.reduce((a, d) => a + (DECO[d.k] ? DECO[d.k].v : 0), 0);
const CH = { live: 1.4, web: 0.9, shop: 1.25, corp: 1.5 };
function fair(p, ch) { const sp = SP[p.sp]; return sp.price * (0.4 + 1.1 * effCrisp(p)) * (1 + decoBonus(p)) * (trend.sp === p.sp ? 1.35 : 1) * (CH[ch] || 1); }
const defPrice = (spId, ch) => Math.round(SP[spId].price * 1.28 * CH[ch]);
const getPrice = (ch, spId) => S.price[ch][spId] ?? defPrice(spId, ch);
const demand = (price, f) => clamp(1.5 - 0.75 * price / Math.max(1, f), 0, 1.3);
const demandLabel = d => d > 0.95 ? ['熱賣', '#fb923c'] : d > 0.55 ? ['穩定', '#34d399'] : d > 0.2 ? ['冷淡', '#8b9bb0'] : ['滯銷', '#38bdf8'];
const unlockedSpecies = () => SPECIES.filter(s => S.zones.includes(s.zone));
function addMoney(n) { S.money += n; if (n > 0) S.earned += n; }
function discover(id) { if (!S.codex[id]) S.codex[id] = { seen: true, made: 0 }; }
function makeProduct(spId, crisp) { const p = { id: S.nextId++, sp: spId, crisp, dur: 100, deco: [], cracks: [] }; discover(spId); S.codex[spId].made++; return p; }

/* ---------- 音效 ---------- */
let AC = null, NB = null, master = null;
function audio() {
  if (!AC) {
    AC = new (window.AudioContext || window.webkitAudioContext)();
    master = AC.createGain(); master.gain.value = 0.9; master.connect(AC.destination);
    NB = AC.createBuffer(1, AC.sampleRate, AC.sampleRate); const d = NB.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  }
  if (AC.state === 'suspended') AC.resume(); return AC;
}
function noise(ac, t, dur, f, q, vol, type = 'bandpass', rate = 1) {
  const src = ac.createBufferSource(); src.buffer = NB; src.playbackRate.value = rate;
  const fl = ac.createBiquadFilter(); fl.type = type; fl.frequency.value = f; fl.Q.value = q;
  const g = ac.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(vol, t + 0.003); g.gain.exponentialRampToValueAtTime(0.0008, t + dur);
  src.connect(fl); fl.connect(g); g.connect(master); src.start(t, Math.random() * 0.5, dur + 0.05);
}
function tone(f, t0, len, vol, type = 'sine') {
  const o = AC.createOscillator(), g = AC.createGain(); o.type = type; o.frequency.value = f;
  g.gain.setValueAtTime(0.0001, t0); g.gain.linearRampToValueAtTime(vol, t0 + 0.01); g.gain.exponentialRampToValueAtTime(0.0008, t0 + len);
  o.connect(g); g.connect(master); o.start(t0); o.stop(t0 + len + 0.05);
}
const sfx = {
  crunch(power = 1, crisp = 0.8) {
    if (!S.sound) return; const ac = audio(), t = ac.currentTime, n = 3 + Math.floor(Math.random() * (2 + 4 * crisp));
    for (let i = 0; i < n; i++) noise(ac, t + i * rnd(0.006, 0.03), rnd(0.03, 0.09), rnd(1800, 7000) * (0.7 + crisp * 0.5), rnd(0.8, 3), rnd(0.25, 0.6) * power, 'bandpass', rnd(0.7, 1.5));
    noise(ac, t, 0.12, rnd(300, 600), 0.7, 0.25 * power, 'lowpass');
  },
  squish(s = 0.5) { if (!S.sound) return; const ac = audio(); noise(ac, ac.currentTime, rnd(0.08, 0.16), rnd(400, 900), 1.5, 0.18 * s, 'lowpass', rnd(.6, 1)); },
  pop() { if (!S.sound) return; const t = audio().currentTime; [660, 880, 1320].forEach((f, i) => tone(f, t + i * 0.07, 0.25, 0.16)); },
  tick() { if (!S.sound) return; const ac = audio(); noise(ac, ac.currentTime, 0.05, 2500, 2, 0.2); },
  step() { if (!S.sound) return; const ac = audio(); noise(ac, ac.currentTime, .06, rnd(300, 600), 1, .05, 'lowpass'); },
  open() { if (!S.sound) return; const t = audio().currentTime; tone(520, t, .12, .08, 'triangle'); tone(780, t + .06, .15, .08, 'triangle'); },
  machine(i) {
    if (!S.sound) return; const ac = audio(), t = ac.currentTime;
    if (i === 0) { noise(ac, t, 0.08, 5000, 4, 0.35, 'highpass'); tone(180, t, 0.08, 0.08, 'square'); }
    else if (i === 1) { noise(ac, t, 0.25, 1200, 1, 0.12); tone(90, t, 0.25, 0.1, 'sawtooth'); }
    else { noise(ac, t, 0.35, 600, 0.7, 0.18, 'lowpass'); tone(60, t, 0.3, 0.1, 'triangle'); }
  },
};

/* ---------- 訊息紀錄 / 對話框 ---------- */
function toast(msg) {
  const box = $('#log'), d = document.createElement('div'); d.className = 'logl'; d.textContent = msg; box.appendChild(d);
  setTimeout(() => d.classList.add('old'), 6000); setTimeout(() => d.remove(), 6700);
  while (box.children.length > 6) box.firstChild.remove();
}
function modal(html, btns = [{ t: '好' }]) {
  $('#mbox').innerHTML = html + '<div class="row" id="mbtns"></div>';
  btns.forEach(b => {
    const e = document.createElement('button'); e.className = 'btn' + (b.ghost ? ' ghost' : ''); e.textContent = b.t;
    e.onclick = () => { $('#modal').hidden = true; b.f && b.f(); if (!GUI.kind) lockMouse(); }; $('#mbtns').appendChild(e);
  });
  unlockMouse(); $('#modal').hidden = false;
}

/* ============================================================
   Three.js 共用工具
   ============================================================ */
const RAY = new THREE.Raycaster();
function makeEnv(r) {
  const pm = new THREE.PMREMGenerator(r), es = new THREE.Scene();
  const g = new THREE.SphereGeometry(30, 32, 16), p = g.attributes.position, cols = [];
  const c1 = new THREE.Color('#05080d'), c2 = new THREE.Color('#3b5d7d'), t = new THREE.Color();
  for (let i = 0; i < p.count; i++) { t.copy(c1).lerp(c2, clamp(p.getY(i) / 30 * .8 + .4, 0, 1)); cols.push(t.r, t.g, t.b); }
  g.setAttribute('color', new THREE.Float32BufferAttribute(cols, 3));
  es.add(new THREE.Mesh(g, new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.BackSide })));
  const panel = (w, h, x, y, z, s) => { const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ color: new THREE.Color(s, s, s), side: THREE.DoubleSide })); m.position.set(x, y, z); m.lookAt(0, 0, 0); es.add(m); };
  panel(14, 7, -14, 14, 10, 5); panel(8, 4, 16, 8, 6, 3); panel(22, 3, 0, 20, -6, 2.5); panel(6, 6, 0, 4, 22, 1.2);
  const tex = pm.fromScene(es, 0.03).texture; pm.dispose(); return tex;
}
function makeView(cv, bg, fov = 38) {
  const r = new THREE.WebGLRenderer({ canvas: cv, antialias: true, powerPreference: 'high-performance', preserveDrawingBuffer: true });
  r.setPixelRatio(Math.min(window.devicePixelRatio || 1, LOW ? 1.5 : 2)); r.toneMapping = THREE.ACESFilmicToneMapping; r.toneMappingExposure = 1.05;
  const scene = new THREE.Scene(); scene.background = new THREE.Color(bg); scene.environment = makeEnv(r);
  const cam = new THREE.PerspectiveCamera(fov, 1, 0.1, 200);
  const v = { r, scene, cam, cv, w: 0, h: 0 };
  v.resize = () => { const b = cv.getBoundingClientRect(); if (!b.width) return; r.setSize(b.width, b.height, false); cam.aspect = b.width / b.height; cam.updateProjectionMatrix(); v.w = b.width; v.h = b.height; };
  v.cast = (x, y, objs, rec = false) => { const b = cv.getBoundingClientRect(); RAY.far = Infinity; RAY.setFromCamera(new THREE.Vector2((x - b.left) / b.width * 2 - 1, -((y - b.top) / b.height) * 2 + 1), cam); return RAY.intersectObjects(objs, rec); };
  v.render = () => r.render(scene, cam);
  return v;
}
const std = (c, o = {}) => new THREE.MeshStandardMaterial(Object.assign({ color: c, roughness: .5, metalness: .2 }, o));
const glow = c => new THREE.MeshStandardMaterial({ color: c, emissive: c, emissiveIntensity: 1, roughness: .4 });
function mesh(geo, mat, x = 0, y = 0, z = 0, parent) { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); if (parent) parent.add(m); return m; }
const box = (w, h, d, mat, x, y, z, p) => mesh(new THREE.BoxGeometry(w, h, d), mat, x, y, z, p);
const cyl = (rt, rb, h, seg, mat, x, y, z, p) => mesh(new THREE.CylinderGeometry(rt, rb, h, seg), mat, x, y, z, p);
function basicLights(scene, k = 1) { scene.add(new THREE.HemisphereLight(0xcfe8ff, 0x0b1220, 0.6 * k)); const dl = new THREE.DirectionalLight(0xffffff, 2.2 * k); dl.position.set(3, 7, 5); scene.add(dl); return dl; }
let shadowTex = null;
function blobShadow(r, parent, y = 0.01) {
  if (!shadowTex) {
    const c = document.createElement('canvas'); c.width = c.height = 128; const g = c.getContext('2d');
    const gr = g.createRadialGradient(64, 64, 0, 64, 64, 64); gr.addColorStop(0, 'rgba(0,0,0,.5)'); gr.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = gr; g.fillRect(0, 0, 128, 128);
    shadowTex = new THREE.CanvasTexture(c);
  }
  const m = new THREE.Mesh(new THREE.PlaneGeometry(r * 2, r * 2), new THREE.MeshBasicMaterial({ map: shadowTex, transparent: true, depthWrite: false }));
  m.rotation.x = -Math.PI / 2; m.position.y = y; parent.add(m); return m;
}
function disposeTree(o) { o.traverse(c => { if (c.geometry) c.geometry.dispose(); if (c.material) (Array.isArray(c.material) ? c.material : [c.material]).forEach(m => m.dispose()); }); }
const hashN = (x, z, s) => { const h = Math.sin(x * 127.1 + z * 311.7 + s * 74.7) * 43758.5453; return h - Math.floor(h); };
function vnoise(x, z, s) {
  const xi = Math.floor(x), zi = Math.floor(z), xf = x - xi, zf = z - zi, u = xf * xf * (3 - 2 * xf), v = zf * zf * (3 - 2 * zf);
  const a = hashN(xi, zi, s), b = hashN(xi + 1, zi, s), c = hashN(xi, zi + 1, s), d = hashN(xi + 1, zi + 1, s);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}
function fbm(x, z, s) { let t = 0, a = .5, f = 1; for (let i = 0; i < 4; i++) { t += a * vnoise(x * f, z * f, s + i * 13); f *= 2; a *= .5; } return t; }
function jit(g, amt, s) {
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i), z = p.getZ(i), kx = Math.round(x * 40), ky = Math.round(y * 40), kz = Math.round(z * 40);
    const k = 1 + (hashN(kx + ky * .37, kz, s) - .5) * amt;
    p.setXYZ(i, x * k, y + (hashN(kz, kx + ky * .53, s + 1) - .5) * amt * .4, z * k);
  }
  g.computeVertexNormals(); return g;
}
const M4 = (x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0, sx = 1, sy = sx, sz = sx) => new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, ry, rz)), new THREE.Vector3(sx, sy, sz));
/* 把多個零件合併成單一幾何（帶頂點色），供 InstancedMesh 大量擺放 */
function mergeParts(parts) {
  const gs = []; let total = 0;
  for (const [g0, c, m] of parts) {
    const g = g0.index ? g0.toNonIndexed() : g0.clone(); if (m) g.applyMatrix4(m);
    if (g.attributes.uv) g.deleteAttribute('uv'); g.computeVertexNormals(); gs.push([g, new THREE.Color(c)]); total += g.attributes.position.count;
  }
  const pos = new Float32Array(total * 3), nor = new Float32Array(total * 3), col = new Float32Array(total * 3); let o = 0;
  gs.forEach(([g, c]) => { const n = g.attributes.position.count; pos.set(g.attributes.position.array, o * 3); nor.set(g.attributes.normal.array, o * 3); for (let i = 0; i < n; i++) { col[(o + i) * 3] = c.r; col[(o + i) * 3 + 1] = c.g; col[(o + i) * 3 + 2] = c.b; } o += n; g.dispose(); });
  const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.BufferAttribute(pos, 3)); geo.setAttribute('normal', new THREE.BufferAttribute(nor, 3)); geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  return geo;
}
function instances(geo, mat, list, shadow = true) {
  const im = new THREE.InstancedMesh(geo, mat, Math.max(1, list.length)), m = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), v = new THREE.Vector3(), sc = new THREE.Vector3();
  list.forEach((o, i) => { e.set(o.rx || 0, o.ry || 0, o.rz || 0); q.setFromEuler(e); v.set(o.x, o.y, o.z); sc.set(o.s * (o.sx || 1), o.s * (o.sy || 1), o.s * (o.sz || 1)); m.compose(v, q, sc); im.setMatrixAt(i, m); if (o.c) im.setColorAt(i, o.c); });
  im.count = list.length; im.castShadow = shadow && !LOW; im.receiveShadow = true; im.frustumCulled = false; return im;
}
function textSprite(txt, color = '#e6edf5', sub = '') {
  const c = document.createElement('canvas'); c.width = 512; c.height = 160; const g = c.getContext('2d');
  g.fillStyle = 'rgba(10,14,20,.78)'; const r = 30; g.beginPath(); g.roundRect ? g.roundRect(8, 8, 496, 144, r) : g.rect(8, 8, 496, 144); g.fill();
  g.strokeStyle = color; g.lineWidth = 4; g.stroke();
  g.fillStyle = color; g.font = 'bold 60px "Noto Sans TC","Microsoft JhengHei",sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(txt, 256, sub ? 64 : 80);
  if (sub) { g.fillStyle = '#8b9bb0'; g.font = '34px "Noto Sans TC","Microsoft JhengHei",sans-serif'; g.fillText(sub, 256, 118); }
  const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace;
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, depthWrite: false, fog: false })); s.scale.set(2.4, .75, 1); return s;
}

/* ---------- 酥脆捏捏（裝飾桌／直播台的特寫用） ---------- */
function makeJelly(seg = 18, world = false) {
  const geo = new THREE.BoxGeometry(2, 2, 2, seg, seg, seg), pos = geo.attributes.position, n = pos.count;
  const base = new Float32Array(n * 3), nor = new Float32Array(n * 3), IN = .7, RR = .3, map = new Map();
  for (let i = 0; i < n; i++) {
    const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i), cx = clamp(x, -IN, IN), cy = clamp(y, -IN, IN), cz = clamp(z, -IN, IN);
    let dx = x - cx, dy = y - cy, dz = z - cz; const l = Math.hypot(dx, dy, dz) || 1; dx /= l; dy /= l; dz /= l;
    const bx = cx + dx * RR, by = cy + dy * RR, bz = cz + dz * RR;
    base[i * 3] = bx; base[i * 3 + 1] = by; base[i * 3 + 2] = bz; nor[i * 3] = dx; nor[i * 3 + 1] = dy; nor[i * 3 + 2] = dz; pos.setXYZ(i, bx, by, bz);
    const key = Math.round(bx * 500) + ',' + Math.round(by * 500) + ',' + Math.round(bz * 500); if (!map.has(key)) map.set(key, []); map.get(key).push(i);
  }
  geo.setAttribute('color', new THREE.Float32BufferAttribute(new Float32Array(n * 3), 3)); geo.computeVertexNormals();
  const mat = world ? new THREE.MeshPhysicalMaterial({ color: 0xffffff, vertexColors: true, roughness: .12, clearcoat: 1, transparent: true, opacity: .9 })
    : new THREE.MeshPhysicalMaterial({ color: 0xffffff, vertexColors: true, roughness: .16, metalness: 0, transmission: .55, thickness: 1.5, ior: 1.42, clearcoat: 1, clearcoatRoughness: .06, attenuationDistance: 2.2, attenuationColor: new THREE.Color('#ffffff'), envMapIntensity: 1.2 });
  const m = new THREE.Mesh(geo, mat);
  const cv = document.createElement('canvas'); cv.width = cv.height = 512; const tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.SRGBColorSpace;
  const ov = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 })); ov.raycast = () => { };
  const group = new THREE.Group(); group.add(m, ov); const dg = new THREE.Group(); group.add(dg);
  return { group, mesh: m, ov, geo, base, nor, off: new Float32Array(n), vel: new Float32Array(n), groups: [...map.values()].filter(a => a.length > 1), cv, tex, dg, decoMeshes: [], n, sp: null };
}
function jellyColors(J, sp) {
  if (J.sp === sp.id) return; J.sp = sp.id;
  const col = J.geo.attributes.color, c1 = new THREE.Color(sp.color), c2 = new THREE.Color(sp.color2 || sp.color), wh = new THREE.Color('#ffffff'), t = new THREE.Color();
  for (let i = 0; i < J.n; i++) { const x = J.base[i * 3], y = J.base[i * 3 + 1]; t.copy(c1).lerp(c2, clamp((x + y) / 4 + .5, 0, 1)).lerp(wh, clamp(y * .12 + .05, 0, .2)); col.setXYZ(i, t.r, t.g, t.b); }
  col.needsUpdate = true; if (J.mesh.material.attenuationColor) J.mesh.material.attenuationColor.set(sp.color);
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
    case 'cube': return new THREE.BoxGeometry(.32, .32, .32);
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
  return new THREE.MeshPhysicalMaterial({ color: d.c, roughness: d.metal ? .22 : .3, metalness: d.metal ? .9 : .1, clearcoat: 1, emissive: d.glow ? d.c : '#000000', emissiveIntensity: d.glow ? .9 : 0, transmission: d.pack === 'glass' ? .5 : 0, thickness: .5 });
}
function jellyDeco(J, p) {
  J.decoMeshes.forEach(m => { J.dg.remove(m); m.geometry.dispose(); m.material.dispose(); });
  J.decoMeshes = p ? p.deco.map((d, i) => { const m = new THREE.Mesh(decoGeo(d.k), decoMat(d.k)); m.userData.idx = i; J.dg.add(m); return m; }) : [];
}
function syncDeco(J, p, t) { if (!p) return; J.decoMeshes.forEach((m, i) => { const d = p.deco[i]; if (!d) return; m.position.set(d.x, 1.0 + .17 * d.s, d.z); m.scale.setScalar(d.s); m.rotation.y = d.r + (DECO[d.k].glow ? t * .6 : 0); }); }
function jellyDeform(J, dt, hit, s) {
  let e = 0; const { base, nor, off, vel, n } = J, pos = J.geo.attributes.position;
  for (let i = 0; i < n; i++) {
    let tg = 0;
    if (hit) { const dx = base[i * 3] - hit.x, dy = base[i * 3 + 1] - hit.y, dz = base[i * 3 + 2] - hit.z; tg = -s * .5 * Math.exp(-(dx * dx + dy * dy + dz * dz) / .45) - s * .03; }
    vel[i] += (tg - off[i]) * 200 * dt; vel[i] *= Math.exp(-7 * dt); off[i] += vel[i] * dt; e += Math.abs(vel[i]) + Math.abs(off[i]);
  }
  if (e < 1e-3 && !hit) { if (!J.rest) { off.fill(0); vel.fill(0); } else return; J.rest = true; } else J.rest = false;
  for (let i = 0; i < n; i++) pos.setXYZ(i, base[i * 3] + nor[i * 3] * off[i], base[i * 3 + 1] + nor[i * 3 + 1] * off[i], base[i * 3 + 2] + nor[i * 3 + 2] * off[i]);
  pos.needsUpdate = true; J.geo.computeVertexNormals();
  const nm = J.geo.attributes.normal;
  for (const g of J.groups) { let x = 0, y = 0, z = 0; for (const i of g) { x += nm.getX(i); y += nm.getY(i); z += nm.getZ(i); } const l = Math.hypot(x, y, z) || 1; for (const i of g) nm.setXYZ(i, x / l, y / l, z / l); }
  nm.needsUpdate = true;
}
function makeCrumbs(scene, N = 200) {
  const geo = new THREE.BufferGeometry(), pos = new Float32Array(N * 3).fill(-50), col = new Float32Array(N * 3);
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3)); geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  const pts = new THREE.Points(geo, new THREE.PointsMaterial({ size: .07, vertexColors: true, transparent: true, depthWrite: false })); pts.frustumCulled = false; scene.add(pts);
  const C = { pts, pos, col, vel: new Float32Array(N * 3), life: new Float32Array(N), k: 0, N };
  C.emit = (p, n, color) => {
    const c = new THREE.Color(color), w = new THREE.Color('#ffffff');
    for (let j = 0; j < n; j++) {
      const i = C.k = (C.k + 1) % N; C.life[i] = 1; C.pos[i * 3] = p.x; C.pos[i * 3 + 1] = p.y; C.pos[i * 3 + 2] = p.z;
      C.vel[i * 3] = rnd(-2, 2); C.vel[i * 3 + 1] = rnd(1, 4); C.vel[i * 3 + 2] = rnd(-.5, 2.5);
      const cc = Math.random() < .5 ? w : c.clone().lerp(w, .4); C.col[i * 3] = cc.r; C.col[i * 3 + 1] = cc.g; C.col[i * 3 + 2] = cc.b;
    }
    geo.attributes.color.needsUpdate = true;
  };
  C.update = (dt, floor = .02) => {
    for (let i = 0; i < N; i++) {
      if (C.life[i] <= 0) continue; C.life[i] -= dt * 1.2; C.vel[i * 3 + 1] -= 9 * dt;
      C.pos[i * 3] += C.vel[i * 3] * dt; C.pos[i * 3 + 1] += C.vel[i * 3 + 1] * dt; C.pos[i * 3 + 2] += C.vel[i * 3 + 2] * dt;
      if (C.pos[i * 3 + 1] < floor) { C.pos[i * 3 + 1] = floor; C.vel[i * 3] *= .6; C.vel[i * 3 + 2] *= .6; C.vel[i * 3 + 1] *= -.2; }
      if (C.life[i] <= 0) C.pos[i * 3 + 1] = -50;
    }
    geo.attributes.position.needsUpdate = true;
  };
  return C;
}
/* 特寫舞台（裝飾桌／直播台），延遲初始化 */
function makeStage(cv, mode) {
  const st = { cv, mode, ready: false, p: null, shown: undefined, t: 0, ptr: null, sel: -1, drag: null, spin: null, onCrunch: null, onSel: null, sq: 0, sqv: 0, flash: 0, hit: new THREE.Vector3() };
  st.init = () => {
    if (st.ready) return true;
    try { st.v = makeView(cv, mode === 'squeeze' ? '#0c0a18' : '#0b1220', 36); } catch (e) { toast('此裝置不支援 WebGL'); return false; }
    const sc = st.v.scene, cam = st.v.cam; st.dl = basicLights(sc); sc.fog = new THREE.Fog(sc.background.getHex(), 12, 30);
    cyl(3.2, 3.4, .3, 72, std('#111a27', { roughness: .3, metalness: .7 }), 0, -.15, 0, sc);
    const ring = mesh(new THREE.TorusGeometry(3.25, .035, 8, 120), new THREE.MeshBasicMaterial({ color: '#22d3ee' }), 0, .01, 0, sc); ring.rotation.x = Math.PI / 2;
    blobShadow(1.6, sc, .005);
    if (mode === 'squeeze') {
      cam.position.set(0, 3.3, 8.4); st.look = new THREE.Vector3(0, 1.1, 0);
      box(16, 8, .2, std('#0f0d1f', { roughness: .8 }), 0, 4, -5, sc);
      st.neon = [['#22d3ee', -4.2], ['#818cf8', -2.8], ['#e879f9', 2.8], ['#fbbf24', 4.2]].map(([c, x]) => box(.12, 5.5, .12, new THREE.MeshBasicMaterial({ color: c }), x, 3.2, -4.8, sc));
      box(9, .08, .08, new THREE.MeshBasicMaterial({ color: '#818cf8' }), 0, 6.2, -4.8, sc);
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
    st.J = makeJelly(18); st.J.group.position.y = 1; sc.add(st.J.group); st.C = makeCrumbs(sc);
    const sel = mesh(new THREE.TorusGeometry(.3, .015, 8, 48), new THREE.MeshBasicMaterial({ color: '#22d3ee' }), 0, 0, 0, st.J.dg); sel.rotation.x = Math.PI / 2; sel.visible = false; st.selRing = sel;
    bind(); st.ready = true; st.resize(); return true;
  };
  st.resize = () => { if (st.init()) st.v.resize(); };
  st.set = p => { if (st.p !== p) { st.p = p; st.sel = -1; st.ptr = null; } };
  st.rebuildDeco = () => { if (st.ready) jellyDeco(st.J, st.p); };
  function apply() { st.shown = st.p; const J = st.J; J.group.visible = !!st.p; if (!st.p) { jellyDeco(J, null); return; } jellyColors(J, SP[st.p.sp]); jellyTexture(J, st.p); jellyDeco(J, st.p); }
  function bind() {
    cv.addEventListener('pointerdown', e => {
      e.preventDefault(); if (!st.p) return; try { cv.setPointerCapture(e.pointerId); } catch (_) { }
      if (mode === 'squeeze') { const h = st.v.cast(e.clientX, e.clientY, [st.J.mesh]); if (h.length) { st.ptr = { s: 0, fired: false, px: e.clientX, py: e.clientY, lx: e.clientX, ly: e.clientY }; setHit(h[0]); sfx.squish(); } }
      else { const h = st.v.cast(e.clientX, e.clientY, st.J.decoMeshes); if (h.length) { st.sel = h[0].object.userData.idx; st.drag = true; } else { st.sel = -1; st.spin = { x: e.clientX, r: st.J.group.rotation.y }; } st.onSel && st.onSel(); }
    });
    cv.addEventListener('pointermove', e => {
      if (st.ptr) { st.ptr.px = e.clientX; st.ptr.py = e.clientY; const h = st.v.cast(e.clientX, e.clientY, [st.J.mesh]); if (h.length) setHit(h[0]); }
      if (st.drag && st.sel >= 0 && st.p) {
        const b = cv.getBoundingClientRect(); RAY.setFromCamera(new THREE.Vector2((e.clientX - b.left) / b.width * 2 - 1, -((e.clientY - b.top) / b.height) * 2 + 1), st.v.cam);
        const pt = new THREE.Vector3(); if (RAY.ray.intersectPlane(new THREE.Plane(new THREE.Vector3(0, 1, 0), -2), pt)) { const l = st.J.group.worldToLocal(pt), d = st.p.deco[st.sel]; d.x = clamp(l.x, -.8, .8); d.z = clamp(l.z, -.8, .8); }
      }
      if (st.spin) st.J.group.rotation.y = st.spin.r + (e.clientX - st.spin.x) * .01;
    });
    const up = () => { st.ptr = null; st.drag = null; st.spin = null; };
    cv.addEventListener('pointerup', up); cv.addEventListener('pointercancel', up);
  }
  function setHit(h) { st.hit.copy(st.J.mesh.worldToLocal(h.point.clone())); st.ptr.uv = h.uv ? h.uv.clone() : new THREE.Vector2(.5, .5); st.ptr.world = h.point.clone(); }
  st.crunchAt = () => {
    const p = st.p, q = st.ptr; if (!p || !q) return; if (p.dur <= 0) { sfx.squish(1); return; }
    const eff = effCrisp(p); sfx.crunch(.6 + eff * .6, eff); if (navigator.vibrate) navigator.vibrate(12); p.dur = Math.max(0, p.dur - 2.2);
    let u = q.uv.x, v = q.uv.y, a = rnd(0, PI2); const cr = [u, v];
    for (let k = 0; k < 4; k++) { a += rnd(-.8, .8); const l = rnd(.03, .08); u += Math.cos(a) * l; v += Math.sin(a) * l; cr.push(u, v); }
    p.cracks.push(cr); if (p.cracks.length > 30) p.cracks.shift(); jellyTexture(st.J, p);
    st.C.emit(q.world, Math.round(8 + eff * 14), SP[p.sp].color); st.flash = 1; st.onCrunch && st.onCrunch(st, eff);
  };
  st.step = dt => {
    if (!st.ready) return; dt = Math.min(dt, .033); st.t += dt; if (st.shown !== st.p) apply();
    const J = st.J; let s = 0;
    if (st.ptr) { const q = st.ptr; s = q.s = Math.min(1, q.s + dt * 5); if (s > .7 && !q.fired) { q.fired = true; q.lx = q.px; q.ly = q.py; st.crunchAt(); } else if (q.fired && Math.hypot(q.px - q.lx, q.py - q.ly) > 45) { q.lx = q.px; q.ly = q.py; st.crunchAt(); } }
    if (st.p) {
      jellyDeform(J, dt, st.ptr ? st.hit : null, s);
      st.sqv += ((st.ptr ? s * .1 : 0) - st.sq) * 160 * dt; st.sqv *= Math.exp(-9 * dt); st.sq += st.sqv * dt;
      J.group.scale.set(1 + st.sq * .5, 1 - st.sq, 1 + st.sq * .5); J.group.position.y = 1 - st.sq;
      if (mode === 'squeeze' && !st.ptr) J.group.rotation.y = Math.sin(st.t * .5) * .25;
      syncDeco(J, st.p, st.t); const sd = st.p.deco[st.sel]; st.selRing.visible = mode === 'decor' && !!sd; if (sd) { st.selRing.position.set(sd.x, 1.01, sd.z); st.selRing.scale.setScalar(sd.s); }
    }
    st.C.update(dt); st.flash = Math.max(0, st.flash - dt * 4); st.dl.intensity = 2.2 + st.flash * 1.5;
    if (st.pl) { const h = L.hype; st.pl.intensity = 4 + h * .12 + st.flash * 6; st.neon.forEach((n, i) => n.scale.y = .6 + .4 * (h / 100) + Math.sin(st.t * 3 + i) * .05); }
    const cam = st.v.cam; cam.position.x = Math.sin(st.t * .25) * .35; cam.lookAt(st.look); st.v.render();
  };
  return st;
}

/* ============================================================
   開放世界：地形
   中央森林（工坊所在）被一圈山脊環繞，東／北／西各有一個隘口，
   隘口被能量門封住，需解開前一區的謎題才能通過。
   ============================================================ */
const ZONE3D = {
  forest: { top: '#5ea7d6', fog: '#cfe6dc', sun: '#fff1d0', hemiS: '#d8f0ff', hemiG: '#2d4a2f', pal: ['#5a9a4c', '#3f7f45', '#5b7a50', '#707468', '#e2e8f0'] },
  coast: { top: '#3f9fe0', fog: '#d4ecf8', sun: '#fff6e0', hemiS: '#e0f4ff', hemiG: '#6b6247', pal: ['#e3d09a', '#79ad62', '#4f8a4f', '#8b9096', '#e2e8f0'] },
  volcano: { top: '#2a0f12', fog: '#6b3324', sun: '#ffb27a', hemiS: '#ff9a6b', hemiG: '#140a08', pal: ['#3d2c27', '#2e221e', '#231a18', '#161112', '#4a332b'] },
  snow: { top: '#7fa9d8', fog: '#e3edf7', sun: '#ffffff', hemiS: '#eef6ff', hemiG: '#8aa0b8', pal: ['#f3f7fb', '#e5edf6', '#d7e3f0', '#7f8c9e', '#ffffff'] },
};
const BIOMES = ['forest', 'coast', 'volcano', 'snow'];
function biomeW(x, z) {
  const c = smooth(44, 60, x), v = smooth(44, 60, -z), s = smooth(44, 60, -x), f = Math.max(0, 1 - c - v - s), t = f + c + v + s;
  return [f / t, c / t, v / t, s / t];
}
const domBiome = (x, z) => { const w = biomeW(x, z); return BIOMES[w.indexOf(Math.max(...w))]; };
function H(x, z) {
  const ax = Math.abs(x), az = Math.abs(z), r = Math.max(ax, az);
  let h = (fbm(x * .045, z * .045, 3) - .45) * 3.2 + (vnoise(x * .2, z * .2, 11) - .5) * .35;
  const fl = 1 - smooth(16, 26, Math.hypot(x, z)); h = h * (1 - fl) + .25 * fl;
  let ridge = Math.exp(-((r - 54) ** 2) / 34) * (13 + fbm(x * .07, z * .07, 5) * 9);
  const pass = ax > az ? Math.exp(-(z * z) / 16) : (z < 0 ? Math.exp(-(x * x) / 16) : 0);
  ridge *= 1 - pass * .97; h += ridge;
  h += smooth(108, 128, r) * (18 + fbm(x * .03, z * .03, 8) * 24);
  const sea = smooth(84, 100, x); h = h * (1 - sea) - 2.8 * sea;
  const vn = smooth(60, 80, -z), vd = Math.hypot(x, z + 96); h += Math.max(0, 28 * (1 - vd / 30)) * vn; if (vd < 4.5) h -= (4.5 - vd) * 2.2 * vn;
  h += smooth(60, 80, -x) * fbm(x * .06, z * .06, 21) * 7;
  return h;
}
const WS_R = 16.3, WS_Y = .45;
function G(x, z) { const h = H(x, z); return Math.hypot(x, z) < WS_R ? Math.max(h, WS_Y) : h; }

const W = { ready: false, anim: [], inter: [], t: 0, cols: new Map(), gates: {}, slimes: [], puz: [] };
function addCol(c) {
  const x0 = c.box ? c.box[0] : c.x - c.r, x1 = c.box ? c.box[2] : c.x + c.r, z0 = c.box ? c.box[1] : c.z - c.r, z1 = c.box ? c.box[3] : c.z + c.r;
  for (let i = Math.floor(x0 / 8); i <= Math.floor(x1 / 8); i++) for (let j = Math.floor(z0 / 8); j <= Math.floor(z1 / 8); j++) { const k = i + ',' + j; if (!W.cols.has(k)) W.cols.set(k, []); W.cols.get(k).push(c); }
  return c;
}
function colsNear(x, z) { const out = new Set(), i0 = Math.floor(x / 8), j0 = Math.floor(z / 8); for (let i = i0 - 1; i <= i0 + 1; i++) for (let j = j0 - 1; j <= j0 + 1; j++) { const a = W.cols.get(i + ',' + j); if (a) a.forEach(c => out.add(c)); } return out; }

function initWorld() {
  if (W.ready) return true;
  const cv = $('#worldCv');
  try { W.r = new THREE.WebGLRenderer({ canvas: cv, antialias: !LOW, powerPreference: 'high-performance' }); } catch (e) { modal('<h2>無法啟動 3D</h2><p>你的瀏覽器或裝置不支援 WebGL，請改用較新的 Chrome、Edge 或 Safari。</p>'); return false; }
  W.r.setPixelRatio(Math.min(window.devicePixelRatio || 1, LOW ? 1.25 : 1.75)); W.r.toneMapping = THREE.ACESFilmicToneMapping; W.r.toneMappingExposure = 1;
  if (!LOW) { W.r.shadowMap.enabled = true; W.r.shadowMap.type = THREE.PCFSoftShadowMap; }
  const sc = W.scene = new THREE.Scene(); sc.background = new THREE.Color('#cfe6dc'); sc.fog = new THREE.Fog('#cfe6dc', 45, LOW ? 120 : 165); sc.environment = makeEnv(W.r);
  W.cam = new THREE.PerspectiveCamera(72, 1, .08, 450); W.cam.rotation.order = 'YXZ';
  W.hemi = new THREE.HemisphereLight('#d8f0ff', '#2d4a2f', 1); sc.add(W.hemi);
  W.sun = new THREE.DirectionalLight('#fff3d6', 2.6); W.sun.castShadow = !LOW; sc.add(W.sun); sc.add(W.sun.target);
  if (!LOW) { const sh = W.sun.shadow; sh.mapSize.set(2048, 2048); Object.assign(sh.camera, { left: -34, right: 34, top: 34, bottom: -34, near: 1, far: 140 }); sh.bias = -.0004; sh.normalBias = .05; sh.camera.updateProjectionMatrix(); }
  // 天空（漸層 shader）
  W.sky = new THREE.Mesh(new THREE.SphereGeometry(400, 32, 16), new THREE.ShaderMaterial({
    uniforms: { top: { value: new THREE.Color('#5ea7d6') }, bot: { value: new THREE.Color('#cfe6dc') } }, side: THREE.BackSide, depthWrite: false, fog: false,
    vertexShader: 'varying float vh; void main(){ vh = normalize(position).y; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
    fragmentShader: 'uniform vec3 top; uniform vec3 bot; varying float vh; void main(){ gl_FragColor = vec4(mix(bot, top, smoothstep(0.0, 0.45, vh)), 1.0);\n#include <tonemapping_fragment>\n#include <colorspace_fragment>\n}',
  })); W.sky.renderOrder = -1; sc.add(W.sky);
  buildTerrain(); buildWater(); buildProps(); buildWorkshop(); buildVolcanoFx(); buildGates(); buildPuzzles(); buildParticles(); buildClouds();
  initPlayer(); spawnAllSlimes(); resizeWorld(); bindInput(); W.ready = true; return true;
}
function buildTerrain() {
  const N = LOW ? 150 : 210, size = 280, geo = new THREE.PlaneGeometry(size, size, N, N); geo.rotateX(-Math.PI / 2);
  const p = geo.attributes.position, n = p.count, hs = new Float32Array(n), row = N + 1, cell = size / N;
  for (let i = 0; i < n; i++) { hs[i] = H(p.getX(i), p.getZ(i)); p.setY(i, hs[i]); }
  const pal = BIOMES.map(b => ZONE3D[b].pal.map(c => new THREE.Color(c))), cols = new Float32Array(n * 3), c = new THREE.Color(), t = new THREE.Color(), wet = new THREE.Color('#a8956a');
  for (let i = 0; i < n; i++) {
    const ix = i % row, iz = (i / row) | 0, x = p.getX(i), z = p.getZ(i), h = hs[i];
    const sl = (Math.abs(hs[iz * row + Math.min(row - 1, ix + 1)] - hs[iz * row + Math.max(0, ix - 1)]) + Math.abs(hs[Math.min(row - 1, iz + 1) * row + ix] - hs[Math.max(0, iz - 1) * row + ix])) / (2 * cell);
    const w = biomeW(x, z); let r = 0, g = 0, b = 0;
    for (let k = 0; k < 4; k++) {
      if (w[k] < .01) continue; const P = pal[k];
      t.copy(P[0]).lerp(P[1], smooth(.6, 3.5, h)).lerp(P[2], smooth(5, 12, h)).lerp(P[3], smooth(.7, 1.5, sl)).lerp(P[4], smooth(16, 24, h));
      if (k === 1) t.lerp(wet, smooth(-.1, -1.2, h));
      r += t.r * w[k]; g += t.g * w[k]; b += t.b * w[k];
    }
    c.setRGB(r, g, b).multiplyScalar(.88 + vnoise(x * .7, z * .7, 7) * .24);
    cols[i * 3] = c.r; cols[i * 3 + 1] = c.g; cols[i * 3 + 2] = c.b;
  }
  geo.setAttribute('color', new THREE.BufferAttribute(cols, 3)); geo.computeVertexNormals();
  const m = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: .95, metalness: 0 })); m.receiveShadow = true; W.scene.add(m);
}
function buildWater() {
  const geo = new THREE.PlaneGeometry(220, 300, LOW ? 30 : 60, LOW ? 40 : 80), m = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ color: '#0e7490', roughness: .08, metalness: .2, transparent: true, opacity: .9 }));
  m.rotation.x = -Math.PI / 2; m.position.set(180, -.9, 0); m.receiveShadow = true; W.scene.add(m);
  const wp = geo.attributes.position, base = Float32Array.from(wp.array);
  W.anim.push((dt, t) => { if (P.x < 40) return; for (let i = 0; i < wp.count; i++) { const x = base[i * 3], y = base[i * 3 + 1]; wp.setZ(i, Math.sin(x * .3 + t * 1.2) * .1 + Math.cos(y * .4 + t * .9) * .1); } wp.needsUpdate = true; geo.computeVertexNormals(); });
}
/* 植被與岩石：每種道具合併成單一幾何後以 InstancedMesh 大量擺放 */
function buildProps() {
  const rd = seeded(77), lists = {}, push = (k, o) => (lists[k] = lists[k] || []).push(o);
  const avoid = (x, z) => {
    if (Math.hypot(x, z) < 24) return true;
    if (Math.abs(z) < 10 && Math.abs(Math.abs(x) - 54) < 9) return true;
    if (Math.abs(x) < 10 && Math.abs(z + 54) < 9) return true;
    return PUZ_SPOTS.some(([px, pz]) => Math.hypot(x - px, z - pz) < 4.5);
  };
  const tries = LOW ? 2600 : 4200;
  for (let i = 0; i < tries; i++) {
    const x = (rd() - .5) * 250, z = (rd() - .5) * 250, h = H(x, z); if (h < -.3 || h > 26 || avoid(x, z)) continue;
    const sl = Math.abs(H(x + 1, z) - H(x - 1, z)) + Math.abs(H(x, z + 1) - H(x, z - 1)); if (sl > 1.5) continue;
    const b = domBiome(x, z), s = .75 + rd() * .8, ry = rd() * 6.28, k = rd(), o = { x, y: h - .12 - sl * .3, z, s, ry };
    let col = 0;
    if (b === 'forest') { if (k < .45) { push('pine', o); col = .35; } else if (k < .72) { push('broad', o); col = .35; } else if (k < .86) push('bush', o); else if (k < .95) { push('rockF', o); col = .8; } else push('shroom', o); }
    else if (b === 'coast') { if (k < .45) { push('palm', o); col = .3; } else if (k < .7) { push('rockF', o); col = .8; } else push('bushC', o); }
    else if (b === 'volcano') { if (k < .45) { push('rockV', o); col = .8; } else if (k < .7) { push('dead', o); col = .25; } else push('obsid', o); }
    else { if (k < .55) { push('pineS', o); col = .35; } else if (k < .75) { push('rockS', o); col = .8; } else push('ice', o); }
    if (col && Math.max(Math.abs(x), Math.abs(z)) < 110) addCol({ x, z, r: col * s + .1 });
  }
  const flatM = new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: .85, metalness: 0 });
  const cone = (r, h, y, c, sd) => [jit(new THREE.ConeGeometry(r, h, 9, 3), .22, sd), c, M4(0, y, 0)];
  const G_ = {
    pine: () => mergeParts([[new THREE.CylinderGeometry(.12, .2, 1.3, 8), '#5b4030', M4(0, .65, 0)], cone(1.15, 1.7, 1.45, '#2f6b3f', 1), cone(.9, 1.45, 2.25, '#3d8a4f', 2), cone(.62, 1.2, 2.95, '#2f6b3f', 3)]),
    pineS: () => mergeParts([[new THREE.CylinderGeometry(.12, .2, 1.3, 8), '#5b4030', M4(0, .65, 0)], cone(1.15, 1.7, 1.45, '#2c5a46', 1), cone(1.0, .7, 1.75, '#f8fafc', 4), cone(.9, 1.45, 2.25, '#356a52', 2), cone(.78, .6, 2.55, '#f8fafc', 5), cone(.62, 1.2, 2.95, '#2c5a46', 3), cone(.5, .55, 3.25, '#f8fafc', 6)]),
    broad: () => mergeParts([[new THREE.CylinderGeometry(.13, .22, 1.8, 8), '#5b4030', M4(0, .9, 0)], ...[[0, 2.4, 0, 1.1], [.6, 2.1, .2, .8], [-.55, 2.15, -.1, .85], [.1, 2.9, -.3, .75]].map(([x, y, z, s], i) => [jit(new THREE.IcosahedronGeometry(.9, 1), .35, i + 80), i % 2 ? '#4c9440' : '#62a84b', M4(x, y, z, 0, 0, 0, s)])]),
    bush: () => mergeParts([[0, .35, 0, .6], [.4, .3, .1, .45], [-.35, .28, -.1, .5]].map(([x, y, z, s], i) => [jit(new THREE.IcosahedronGeometry(.9, 1), .3, i + 90), i ? '#4f9a45' : '#3f8a3d', M4(x, y, z, 0, 0, 0, s)])),
    bushC: () => mergeParts([0, 1, 2, 3, 4].map(i => [new THREE.ConeGeometry(.06, .7, 3), '#a3a35a', M4(Math.cos(i * 1.3) * .15, .35, Math.sin(i * 1.3) * .15, Math.cos(i) * .3, 0, Math.sin(i) * .3)])),
    rockF: () => mergeParts([[jit(new THREE.DodecahedronGeometry(1, 1), .45, 5), '#7a7f78', M4(0, .3, 0, 0, 0, 0, 1, .65, 1)], [jit(new THREE.DodecahedronGeometry(.5, 0), .4, 6), '#8b9089', M4(.8, .1, .3)]]),
    rockV: () => mergeParts([[jit(new THREE.DodecahedronGeometry(1, 1), .55, 7), '#2a2220', M4(0, .4, 0, 0, 0, 0, 1, .85, 1)], [new THREE.TetrahedronGeometry(.6), '#3a2c28', M4(.9, .2, 0, .4, .2, 0)]]),
    rockS: () => mergeParts([[jit(new THREE.DodecahedronGeometry(1, 1), .45, 8), '#7f8c9e', M4(0, .3, 0, 0, 0, 0, 1, .65, 1)], [new THREE.SphereGeometry(.85, 12, 6, 0, PI2, 0, Math.PI / 2), '#f8fafc', M4(0, .55, 0, 0, 0, 0, 1.05, .4, 1.05)]]),
    shroom: () => mergeParts([[new THREE.CylinderGeometry(.07, .09, .4, 8), '#f5efe6', M4(0, .2, 0)], [new THREE.SphereGeometry(.28, 14, 7, 0, PI2, 0, Math.PI / 2), '#e5484d', M4(0, .38, 0)], [new THREE.CylinderGeometry(.05, .07, .28, 8), '#f5efe6', M4(.35, .14, .1)], [new THREE.SphereGeometry(.18, 12, 6, 0, PI2, 0, Math.PI / 2), '#e5484d', M4(.35, .27, .1)], ...[0, 1, 2, 3, 4].map(k => [new THREE.SphereGeometry(.04, 6, 4), '#ffffff', M4(Math.cos(k * 1.3) * .16, .5, Math.sin(k * 1.3) * .16)])]),
    palm: () => { const parts = []; let x = 0, y = 0; for (let i = 0; i < 8; i++) { const a = -.6 * i / 8 * .35; parts.push([new THREE.CylinderGeometry(.11, .14, .55, 8), i % 2 ? '#8b6b4a' : '#7a5c3e', M4(x, y + .27, 0, 0, 0, a)]); x += Math.sin(-a) * .5; y += .52; }
      for (let k = 0; k < 8; k++) { const l = new THREE.SphereGeometry(1, 8, 4); l.scale(.24, .035, 1.25); l.translate(0, 0, 1.1); parts.push([l, k % 2 ? '#2f9e57' : '#3fb76a', M4(x, y + .1, 0, .5, k / 8 * PI2, 0)]); }
      for (let k = 0; k < 3; k++) parts.push([new THREE.SphereGeometry(.11, 8, 6), '#5b3a1f', M4(x + Math.cos(k * 2) * .15, y - .05, Math.sin(k * 2) * .15)]); return mergeParts(parts); },
    dead: () => mergeParts([[new THREE.CylinderGeometry(.08, .16, 2, 6), '#2b211d', M4(0, 1, 0)], ...[0, 1, 2].map(k => [new THREE.CylinderGeometry(.03, .06, .9, 5), '#2b211d', M4(Math.cos(k * 2.1) * .35, 1.5 + k * .25, Math.sin(k * 2.1) * .35, Math.sin(k * 2.1) * .9, 0, -Math.cos(k * 2.1) * .9)])]),
  };
  Object.keys(G_).forEach(k => { if (lists[k]) W.scene.add(instances(G_[k](), flatM, lists[k])); });
  if (lists.obsid) { const g = mergeParts([0, 1, 2].map(i => [new THREE.OctahedronGeometry(.45), '#3b1d5e', M4(Math.cos(i * 2) * .3, .6, Math.sin(i * 2) * .3, rnd(-.4, .4), i, rnd(-.4, .4), .6, 1.7 + i * .3, .6)])); W.scene.add(instances(g, new THREE.MeshPhysicalMaterial({ vertexColors: true, roughness: .06, metalness: .3, clearcoat: 1, flatShading: true }), lists.obsid)); }
  if (lists.ice) { const g = mergeParts([0, 1, 2, 3].map(i => [new THREE.OctahedronGeometry(.4), '#bae6fd', M4(Math.cos(i * 1.6) * .3, .5, Math.sin(i * 1.6) * .3, rnd(-.4, .4), i, rnd(-.4, .4), .5, 1.5 + i * .25, .5)])); W.scene.add(instances(g, new THREE.MeshPhysicalMaterial({ vertexColors: true, roughness: .05, clearcoat: 1, transparent: true, opacity: .85, emissive: '#7dd3fc', emissiveIntensity: .2, flatShading: true }), lists.ice)); }
  // 草叢與花（成片分布）
  const grass = [], flowers = [], gc = [new THREE.Color('#4f9a45'), new THREE.Color('#8cc265'), new THREE.Color('#9a9a55'), new THREE.Color('#cfc47a')];
  const fcol = ['#f9a8d4', '#fde68a', '#ffffff', '#c4b5fd', '#fca5a5'].map(c => new THREE.Color(c));
  for (let i = 0; i < (LOW ? 170 : 340); i++) {
    const cx = (rd() - .5) * 220, cz = (rd() - .5) * 220, b = domBiome(cx, cz); if (b === 'volcano' || b === 'snow') continue;
    for (let j = 0; j < (LOW ? 14 : 22); j++) {
      const x = cx + (rd() - .5) * 7, z = cz + (rd() - .5) * 7, h = H(x, z); if (h < .05 || h > 6 || Math.hypot(x, z) < WS_R + 1) continue; if (Math.abs(H(x + .8, z) - H(x - .8, z)) + Math.abs(H(x, z + .8) - H(x, z - .8)) > .5) continue;
      const c = b === 'coast' ? gc[2].clone().lerp(gc[3], rd()) : gc[0].clone().lerp(gc[1], rd());
      grass.push({ x, y: h, z, s: .8 + rd() * .7, ry: rd() * 6.28, rx: (rd() - .5) * .4, c });
      if (b === 'forest' && rd() < .09) flowers.push({ x: x + .2, y: h, z, s: .8 + rd() * .5, ry: rd() * 6, c: pick(fcol) });
    }
  }
  const blade = new THREE.ConeGeometry(.05, .45, 3, 1); blade.translate(0, .22, 0);
  W.scene.add(instances(blade, new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: .9, side: THREE.DoubleSide }), grass, false));
  const fg = mergeParts([[new THREE.CylinderGeometry(.012, .012, .34, 4), '#3f7f45', M4(0, .17, 0)], [new THREE.IcosahedronGeometry(.08, 0), '#ffffff', M4(0, .36, 0)]]);
  W.scene.add(instances(fg, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: .6, flatShading: true }), flowers, false));
}
function buildVolcanoFx() {
  const y = H(0, -96) + .3, lava = mesh(new THREE.CircleGeometry(4.6, 32), new THREE.MeshBasicMaterial({ color: '#fb923c' }), 0, y, -96, W.scene); lava.rotation.x = -Math.PI / 2;
  const smokeG = new THREE.IcosahedronGeometry(2, 1), smokeM = new THREE.MeshStandardMaterial({ color: '#3f3a3a', roughness: 1, transparent: true, opacity: .5, flatShading: true }), puffs = [];
  for (let i = 0; i < 12; i++) { const m = mesh(smokeG, smokeM, 0, y, -96, W.scene); m.userData.o = i / 12; puffs.push(m); }
  const pools = [], rd = seeded(5);
  for (let i = 0; i < 9; i++) {
    const x = (rd() - .5) * 80, z = -62 - rd() * 18; if (Math.hypot(x, z + 96) < 33) continue; const hy = H(x, z) + .05, r = 1.2 + rd() * 1.4;
    const a = mesh(new THREE.CircleGeometry(r, 28), new THREE.MeshBasicMaterial({ color: '#ea580c' }), x, hy, z, W.scene); a.rotation.x = -Math.PI / 2;
    const b = mesh(new THREE.CircleGeometry(r * .6, 24), new THREE.MeshBasicMaterial({ color: '#fde047' }), x, hy + .01, z, W.scene); b.rotation.x = -Math.PI / 2; pools.push(b);
  }
  W.anim.push((dt, t) => { pools.forEach((b, i) => b.scale.setScalar(.85 + Math.sin(t * 2 + i) * .15)); puffs.forEach(m => { const k = (t * .04 + m.userData.o) % 1; m.position.set(Math.sin(k * 6 + m.userData.o * 9) * 3 + k * 8, y + 2 + k * 30, -96 + k * 4); m.scale.setScalar(.6 + k * 3); }); });
}
function buildClouds() {
  const cg = new THREE.IcosahedronGeometry(1, 1), cm = new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 1, flatShading: true, transparent: true, opacity: .92, fog: false }), clouds = [], rd = seeded(9);
  for (let i = 0; i < (LOW ? 10 : 18); i++) { const g = new THREE.Group(); for (let k = 0; k < 5; k++) { const m = mesh(cg, cm, (k - 2) * 1.6 + rd() - .5, rd() * .6, rd() * 1.6 - .8, g); m.scale.set(1.6 + rd(), 1 + rd() * .6, 1.3); } g.position.set((rd() - .5) * 300, 40 + rd() * 20, (rd() - .5) * 300); g.scale.setScalar(2 + rd() * 2.5); W.scene.add(g); clouds.push(g); }
  W.anim.push(dt => clouds.forEach(c => { c.position.x += dt * 1.2; if (c.position.x > 160) c.position.x = -160; }));
}
let dotTexC = null;
function dotTex() {
  if (dotTexC) return dotTexC; const c = document.createElement('canvas'); c.width = c.height = 64; const g = c.getContext('2d');
  const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32); gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(.4, 'rgba(255,255,255,.6)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = gr; g.fillRect(0, 0, 64, 64); return dotTexC = new THREE.CanvasTexture(c);
}
/* 環境粒子：依玩家所在生態區切換（花粉／火星／雪花） */
function buildParticles() {
  const n = LOW ? 220 : 420, geo = new THREE.BufferGeometry(), pos = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) { pos[i * 3] = rnd(-25, 25); pos[i * 3 + 1] = rnd(0, 14); pos[i * 3 + 2] = rnd(-25, 25); }
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const mat = new THREE.PointsMaterial({ size: .14, map: dotTex(), color: '#fef08a', transparent: true, depthWrite: false, blending: THREE.AdditiveBlending });
  const pts = new THREE.Points(geo, mat); pts.frustumCulled = false; W.scene.add(pts);
  const K = { forest: ['float', '#fef08a', .13, THREE.AdditiveBlending], coast: ['float', '#ffffff', .08, THREE.AdditiveBlending], volcano: ['rise', '#fb923c', .16, THREE.AdditiveBlending], snow: ['fall', '#ffffff', .18, THREE.NormalBlending] };
  let cur = '';
  W.anim.push((dt, t) => {
    const b = domBiome(P.x, P.z); if (b !== cur) { cur = b; mat.color.set(K[b][1]); mat.size = K[b][2]; mat.blending = K[b][3]; mat.needsUpdate = true; }
    const kind = K[b][0]; pts.position.set(Math.floor(P.x / 50) * 50, G(P.x, P.z), Math.floor(P.z / 50) * 50);
    for (let i = 0; i < n; i++) {
      const k = i * 3;
      if (kind === 'float') { pos[k] += Math.sin(t * .6 + i) * dt * .3; pos[k + 1] += Math.cos(t * .5 + i * 1.3) * dt * .2; }
      else if (kind === 'rise') { pos[k + 1] += dt * (1 + (i % 5) * .3); pos[k] += Math.sin(t * 2 + i) * dt * .4; if (pos[k + 1] > 14) pos[k + 1] = 0; }
      else { pos[k + 1] -= dt * (1 + (i % 4) * .25); pos[k] += Math.sin(t + i) * dt * .5; if (pos[k + 1] < 0) pos[k + 1] = 14; }
      const lx = pos[k] + pts.position.x - P.x, lz = pos[k + 2] + pts.position.z - P.z;
      if (lx > 25) pos[k] -= 50; if (lx < -25) pos[k] += 50; if (lz > 25) pos[k + 2] -= 50; if (lz < -25) pos[k + 2] += 50;
    }
    geo.attributes.position.needsUpdate = true;
  });
}

/* ============================================================
   工坊：產線機器、裝飾桌、直播台、工作電腦
   ============================================================ */
const STEPS = ['切片', '裹糖晶', '乾燥'], MKEY = ['slicer', 'coater', 'dryer'], MX = [-4, 0, 4];
const MK = { pulse: [0, 0, 0], bx: -6.4, t: 0 };
function addInter(hit, kind, id, name, extra = {}) { hit.material = hit.material || new THREE.MeshBasicMaterial(); hit.material.visible = false; const it = Object.assign({ hit, kind, id, name }, extra); hit.userData.it = it; W.inter.push(it); return it; }
function hitBox(w, h, d, x, y, z, parent) { return box(w, h, d, new THREE.MeshBasicMaterial({ visible: false }), x, y, z, parent); }
function buildWorkshop() {
  const g = new THREE.Group(); W.scene.add(g); W.ws = g;
  const dark = std('#1e293b', { metalness: .6, roughness: .4 }), white = std('#e2e8f0', { roughness: .35 }), steel = std('#94a3b8', { metalness: .9, roughness: .2 });
  // 平台與地面燈環
  const plat = cyl(WS_R, WS_R + .4, .44, 72, std('#273244', { roughness: .55, metalness: .3 }), 0, WS_Y - .22, 0, g); plat.receiveShadow = true;
  const ring = mesh(new THREE.TorusGeometry(WS_R - .4, .06, 8, 140), glow('#22d3ee'), 0, WS_Y + .01, 0, g); ring.rotation.x = Math.PI / 2;
  for (let i = 0; i < 6; i++) { const t = mesh(new THREE.TorusGeometry(6 + i * 1.6, .015, 4, 90), new THREE.MeshBasicMaterial({ color: '#334155' }), 0, WS_Y + .005, 0, g); t.rotation.x = Math.PI / 2; }
  // 天棚
  [[-12, -10], [12, -10], [-12, 0], [12, 0], [-12, 9], [12, 9]].forEach(([x, z]) => { cyl(.16, .16, 5.6, 12, white, x, WS_Y + 2.8, z, g); addCol({ x, z, r: .35 }); });
  box(25, .35, 20.5, white, 0, WS_Y + 5.75, -.5, g);
  [-6, -2, 2, 6].forEach(z => box(22, .06, .25, glow('#e0f2fe'), 0, WS_Y + 5.55, z, g));
  box(25.2, .12, .2, glow('#22d3ee'), 0, WS_Y + 5.95, 9.75, g);
  // 1) 加工產線
  const line = new THREE.Group(); line.position.set(0, WS_Y, -6.5); g.add(line); buildLine(line);
  addCol({ box: [-7.8, -7.7, 9.3, -5.3] }); addCol({ x: -7.4, z: -8.1, r: .8 });
  addInter(hitBox(17.5, 3.2, 3.2, .7, 1.6, 0, line), 'station', 'line', '加工產线'.replace('线', '線'));
  const lb = textSprite('加工產線', '#22d3ee', '捕捉的凝膠在這裡加工'); lb.position.set(0, WS_Y + 4.3, -6.5); g.add(lb);
  // 2) 裝飾桌
  const dt = new THREE.Group(); dt.position.set(-9, WS_Y, 3.5); dt.rotation.y = .5; g.add(dt);
  box(2.6, .12, 1.5, white, 0, .95, 0, dt); [[-1.2, -.65], [1.2, -.65], [-1.2, .65], [1.2, .65]].forEach(([x, z]) => box(.08, .95, .08, dark, x, .47, z, dt));
  cyl(.5, .55, .1, 32, steel, 0, 1.06, 0, dt);
  const sample = makeJelly(6, true); sample.group.scale.setScalar(.28); sample.group.position.set(0, 1.4, 0); sample.ov.visible = false; jellyColors(sample, SP.honey); dt.add(sample.group); W.sample = sample.group;
  [['#e879f9', -.8], ['#22d3ee', -.55], ['#fbbf24', .75]].forEach(([c, x]) => mesh(new THREE.OctahedronGeometry(.08), glow(c), x, 1.1, .4, dt));
  cyl(.06, .1, .05, 12, dark, .95, 1.03, -.45, dt); const arm = cyl(.025, .025, .8, 8, steel, .95, 1.42, -.45, dt); arm.rotation.z = .3;
  const shade = mesh(new THREE.ConeGeometry(.2, .25, 20, 1, true), std('#334155', { side: THREE.DoubleSide }), .8, 1.85, -.45, dt); shade.rotation.z = .5;
  mesh(new THREE.SphereGeometry(.07, 10, 8), glow('#fef3c7'), .76, 1.78, -.45, dt);
  addCol({ x: -9, z: 3.5, r: 1.5 }); addInter(hitBox(3, 2, 2, 0, 1, 0, dt), 'station', 'decor', '裝飾桌');
  const db = textSprite('裝飾桌', '#e879f9', '替捏捏加上裝飾零件'); db.position.set(-9, WS_Y + 3, 3.5); g.add(db);
  // 3) 直播台
  const lv = new THREE.Group(); lv.position.set(9, WS_Y, 3.5); lv.rotation.y = -.5; g.add(lv);
  cyl(1.6, 1.7, .18, 40, dark, 0, .09, 0, lv); const lr = mesh(new THREE.TorusGeometry(1.62, .03, 6, 60), glow('#e879f9'), 0, .19, 0, lv); lr.rotation.x = Math.PI / 2;
  cyl(.35, .4, .9, 24, white, 0, .63, 0, lv);
  const lj = makeJelly(6, true); lj.group.scale.setScalar(.3); lj.group.position.set(0, 1.4, 0); lj.ov.visible = false; jellyColors(lj, SP.grass); lv.add(lj.group); W.liveSample = lj.group;
  box(3.6, 3, .12, std('#0f0d1f', { roughness: .8 }), 0, 1.6, -1.8, lv);
  W.neon = [['#22d3ee', -1.4], ['#818cf8', -.5], ['#e879f9', .5], ['#fbbf24', 1.4]].map(([c, x]) => box(.08, 2.4, .06, glow(c), x, 1.6, -1.72, lv));
  const rl = mesh(new THREE.TorusGeometry(.45, .04, 10, 40), glow('#f8fafc'), -1.4, 1.9, 1.2, lv); rl.lookAt(lv.localToWorld(new THREE.Vector3(0, 1.4, 0)));
  cyl(.03, .03, 1.9, 8, steel, -1.4, .95, 1.2, lv);
  const camG = new THREE.Group(); camG.position.set(1.4, 1.5, 1.4); lv.add(camG); box(.45, .3, .35, dark, 0, 0, 0, camG); const lens = cyl(.1, .13, .25, 16, std('#0f172a', { metalness: .9, roughness: .15 }), 0, 0, -.28, camG); lens.rotation.x = Math.PI / 2;
  W.recLed = mesh(new THREE.SphereGeometry(.035, 8, 6), new THREE.MeshBasicMaterial({ color: '#fb7185' }), .16, .1, -.18, camG); camG.lookAt(9, WS_Y + 1.4, 3.5);
  [[-.25, 0], [.25, 0], [0, .3]].forEach(([x, z]) => { const l = cyl(.02, .02, 1.5, 6, steel, 1.4 + x, .75, 1.4 + z, lv); l.rotation.z = x; });
  addCol({ x: 9, z: 3.5, r: 1.8 }); addInter(hitBox(3.6, 2.6, 3.6, 0, 1.3, 0, lv), 'station', 'live', '直播台');
  const lvb = textSprite('直播台', '#fb7185', '開直播、捏捏、販售'); lvb.position.set(9, WS_Y + 3.6, 3.5); g.add(lvb);
  // 4) 工作電腦
  const pc = new THREE.Group(); pc.position.set(0, WS_Y, 6); g.add(pc);
  box(2.6, .1, 1.1, white, 0, .95, 0, pc); [[-1.2, 0], [1.2, 0]].forEach(([x]) => box(.08, .95, 1, dark, x, .47, 0, pc));
  box(1.6, .95, .06, dark, 0, 1.6, -.3, pc); cyl(.05, .08, .4, 10, dark, 0, 1.15, -.3, pc);
  const sc = document.createElement('canvas'); sc.width = 512; sc.height = 300; const sg = sc.getContext('2d');
  sg.fillStyle = '#0b1220'; sg.fillRect(0, 0, 512, 300); sg.fillStyle = '#22d3ee'; sg.font = 'bold 34px sans-serif'; sg.fillText('SQUISH LAB', 24, 50);
  sg.strokeStyle = '#34d399'; sg.lineWidth = 4; sg.beginPath(); [0, 1, 2, 3, 4, 5, 6, 7].forEach(i => sg.lineTo(30 + i * 60, 240 - Math.sin(i * .9) * 40 - i * 14)); sg.stroke();
  sg.fillStyle = '#818cf8'; [0, 1, 2, 3].forEach(i => sg.fillRect(330 + i * 40, 160 - i * 22, 26, 80 + i * 22));
  const st = new THREE.CanvasTexture(sc); st.colorSpace = THREE.SRGBColorSpace;
  mesh(new THREE.PlaneGeometry(1.5, .85), new THREE.MeshBasicMaterial({ map: st }), 0, 1.6, -.265, pc).rotation.y = 0;
  box(.9, .03, .3, dark, 0, 1.02, .15, pc);
  const chair = new THREE.Group(); chair.position.set(0, 0, .9); pc.add(chair); cyl(.3, .3, .08, 20, dark, 0, .55, 0, chair); box(.55, .6, .06, dark, 0, .9, .28, chair); cyl(.04, .04, .5, 8, steel, 0, .28, 0, chair);
  addCol({ box: [-1.4, 5.4, 1.4, 6.6] }); addInter(hitBox(2.8, 2.2, 1.6, 0, 1.1, 0, pc), 'station', 'pc', '工作電腦');
  const pb = textSprite('工作電腦', '#818cf8', '網站、升級、事業、圖鑑'); pb.position.set(0, WS_Y + 3.1, 6); g.add(pb);
  // 凝膠儲槽（裝飾）
  [[-13.2, -4, '#6ee7a8'], [-13.2, -1.5, '#fbbf24'], [13.2, -4, '#38bdf8'], [13.2, -1.5, '#fb7185']].forEach(([x, z, c]) => {
    cyl(.6, .6, .15, 24, dark, x, WS_Y + .08, z, g); mesh(new THREE.CylinderGeometry(.55, .55, 2.2, 24, 1, true), new THREE.MeshStandardMaterial({ color: '#ffffff', transparent: true, opacity: .25, roughness: .05, side: THREE.DoubleSide }), x, WS_Y + 1.25, z, g);
    cyl(.5, .5, 1.6, 24, new THREE.MeshStandardMaterial({ color: c, emissive: c, emissiveIntensity: .35, roughness: .2, transparent: true, opacity: .85 }), x, WS_Y + .95, z, g); cyl(.6, .6, .15, 24, steel, x, WS_Y + 2.4, z, g); addCol({ x, z, r: .7 });
  });
  // 入口招牌
  const sign = new THREE.Group(); sign.position.set(0, G(0, 18.5), 18.5); W.scene.add(sign);
  [-3.2, 3.2].forEach(x => { cyl(.12, .12, 3.4, 12, dark, x, 1.7, 0, sign); addCol({ x, z: 18.5, r: .3 }); });
  const sc2 = document.createElement('canvas'); sc2.width = 1024; sc2.height = 200; const s2 = sc2.getContext('2d');
  s2.fillStyle = '#0b1220'; s2.fillRect(0, 0, 1024, 200); s2.fillStyle = '#22d3ee'; s2.font = 'bold 84px Inter,sans-serif'; s2.textAlign = 'center'; s2.fillText('SQUISH LAB', 512, 105); s2.fillStyle = '#cbd5e1'; s2.font = '44px "Noto Sans TC","Microsoft JhengHei",sans-serif'; s2.fillText('史萊姆捏捏工坊', 512, 170);
  const t2 = new THREE.CanvasTexture(sc2); t2.colorSpace = THREE.SRGBColorSpace;
  box(6.8, 1.4, .14, dark, 0, 3.1, 0, sign); mesh(new THREE.PlaneGeometry(6.6, 1.3), new THREE.MeshBasicMaterial({ map: t2 }), 0, 3.1, .08, sign);
  g.traverse(o => { if (o.isMesh && o.material.visible !== false) { o.castShadow = !LOW; o.receiveShadow = true; } });
}
function buildLine(G0) {
  const dark = std('#1e293b', { metalness: .7, roughness: .35 }), steel = std('#94a3b8', { metalness: .9, roughness: .2 }), panel = std('#334155', { metalness: .5, roughness: .4 });
  box(15, .35, 1.7, dark, 0, .45, 0, G0); box(15, .08, 1.5, std('#0b0f17', { roughness: .9 }), 0, .66, 0, G0); [-.9, .9].forEach(z => box(15, .12, .1, steel, 0, .72, z, G0));
  MK.rollers = []; for (let i = 0; i < 14; i++) { const r = cyl(.14, .14, 1.8, 12, steel, -6.5 + i, .45, 0, G0); r.rotation.x = Math.PI / 2; MK.rollers.push(r); }
  [-6.8, -2.3, 2.3, 6.8].forEach(x => [-.7, .7].forEach(z => box(.15, .3, .15, dark, x, .15, z, G0)));
  MK.belt = []; for (let i = 0; i < 30; i++) MK.belt.push(box(.06, .02, 1.4, std('#22d3ee', { emissive: '#22d3ee', emissiveIntensity: .25 }), -7.25 + i * .5, .71, 0, G0));
  const leds = x => { const a = []; for (let i = 0; i < 5; i++) a.push(box(.14, .08, .04, new THREE.MeshBasicMaterial({ color: '#1e293b' }), x - .36 + i * .18, .3, 1.21, G0)); return a; };
  MK.leds = [];
  const x0 = MX[0]; [-1, 1].forEach(s => [-1.05, 1.05].forEach(z => box(.22, 2.6, .22, dark, x0 + s * .9, 1.3, z, G0)));
  box(2.2, .3, 2.4, panel, x0, 2.65, 0, G0); box(1.2, .5, .8, dark, x0, 3.05, 0, G0);
  MK.blades = [-.35, 0, .35].map(dx => box(.04, .7, 1.5, steel, x0 + dx, 2.1, 0, G0)); box(1, .55, .1, panel, x0, .3, 1.15, G0); MK.leds[0] = leds(x0);
  const x1 = MX[1]; MK.drum = new THREE.Group(); MK.drum.position.set(x1, 1.25, 0); G0.add(MK.drum);
  const glass = mesh(new THREE.CylinderGeometry(.95, .95, 2, 32, 1, true), new THREE.MeshStandardMaterial({ color: '#c7f9ff', transparent: true, opacity: .28, roughness: .05, side: THREE.DoubleSide }), 0, 0, 0, MK.drum); glass.rotation.z = Math.PI / 2;
  for (let i = 0; i < 6; i++) { const a = i / 6 * PI2, vb = box(1.9, .04, .25, steel, 0, Math.cos(a) * .82, Math.sin(a) * .82, MK.drum); vb.rotation.x = -a; }
  [-1, 1].forEach(s => { const r = mesh(new THREE.TorusGeometry(.97, .06, 10, 40), steel, x1 + s, 1.25, 0, G0); r.rotation.y = Math.PI / 2; box(.2, 1.2, .2, dark, x1 + s, .6, -.9, G0); box(.2, 1.2, .2, dark, x1 + s, .6, .9, G0); });
  const hop = mesh(new THREE.ConeGeometry(.6, .9, 4, 1, true), std('#334155', { side: THREE.DoubleSide }), x1, 2.85, 0, G0); hop.rotation.x = Math.PI;
  MK.sugar = []; for (let i = 0; i < 14; i++) MK.sugar.push(box(.05, .05, .05, new THREE.MeshBasicMaterial({ color: '#ffffff' }), x1 + rnd(-.15, .15), 2.4, rnd(-.15, .15), G0));
  box(1, .55, .1, panel, x1, .3, 1.15, G0); MK.leds[1] = leds(x1);
  const x2 = MX[2]; box(2.6, .5, 2.2, panel, x2, 2.3, 0, G0); [-1, 1].forEach(s => box(2.6, 1.6, .2, dark, x2, 1.25, s, G0));
  MK.heat = [-.6, 0, .6].map(dz => { const h = cyl(.05, .05, 2.3, 10, new THREE.MeshStandardMaterial({ color: '#7c2d12', emissive: '#fb923c', emissiveIntensity: .2 }), x2, 1.95, dz, G0); h.rotation.z = Math.PI / 2; return h; });
  cyl(.5, .5, .2, 24, dark, x2, 2.65, 0, G0); MK.fan = new THREE.Group(); MK.fan.position.set(x2, 2.8, 0); G0.add(MK.fan); for (let i = 0; i < 4; i++) { const bl = box(.75, .03, .16, steel, 0, 0, 0, MK.fan); bl.rotation.y = i * Math.PI / 4; }
  box(1, .55, .1, panel, x2, .3, 1.15, G0); MK.leds[2] = leds(x2);
  MK.tank = cyl(.55, .55, 1.8, 28, new THREE.MeshStandardMaterial({ color: '#6ee7a8', emissive: '#6ee7a8', emissiveIntensity: .25, roughness: .15, transparent: true, opacity: .85 }), -7.4, 1.5, -1.6, G0);
  cyl(.6, .6, .12, 28, steel, -7.4, .6, -1.6, G0); cyl(.6, .6, .12, 28, steel, -7.4, 2.45, -1.6, G0);
  const pipe = cyl(.07, .07, 1.6, 10, steel, -7.0, 2.5, -.8, G0); pipe.rotation.x = Math.PI / 2.6;
  MK.turn = cyl(.9, 1, .2, 36, std('#111827', { metalness: .8, roughness: .2 }), 8.2, .1, 0, G0);
  const tr = mesh(new THREE.TorusGeometry(.95, .025, 8, 60), glow('#22d3ee'), 8.2, .21, 0, G0); tr.rotation.x = Math.PI / 2;
  MK.J = makeJelly(8, true); MK.J.group.scale.setScalar(.42); MK.J.group.position.set(-6.4, 1.14, 0); MK.J.ov.visible = false; G0.add(MK.J.group);
}
function lineStep(dt) {
  MK.t += dt; const t = MK.t, act = i => (M.active && M.step === i) || MK.pulse[i] > 0;
  MK.pulse = MK.pulse.map(p => Math.max(0, p - dt));
  MK.blades.forEach((b, k) => b.position.y = act(0) ? 1.55 + .45 * Math.cos(t * 10 + k * .9) : 2.1);
  MK.drum.rotation.x += dt * (act(1) ? 5 : .3);
  MK.sugar.forEach((s, i) => { s.visible = act(1); if (s.visible) s.position.y = 2.4 - ((t * 1.6 + i / 14) % 1) * 1.4; });
  const hot = act(2); MK.heat.forEach(h => h.material.emissiveIntensity = hot ? 2.2 + Math.sin(t * 12) * .6 : .2); MK.fan.rotation.y += dt * (hot ? 14 : 1.2);
  MK.leds.forEach((row, i) => { const lv = S.up[MKEY[i]], on = act(i); row.forEach((l, k) => l.material.color.set(k < lv ? (on ? '#34d399' : '#22d3ee') : '#1e293b')); });
  const moving = M.active || MK.bx < 7.9; MK.rollers.forEach(r => r.rotation.y += dt * (moving ? 3 : 0));
  MK.belt.forEach(b => { b.position.x += dt * (moving ? .8 : 0); if (b.position.x > 7.4) b.position.x -= 15; });
  const J = MK.J, spId = M.active ? M.sp : (M.last ? M.last.sp : M.sp);
  J.group.visible = M.active || !!M.last; if (spId) { jellyColors(J, SP[spId]); MK.tank.material.color.set(SP[spId].color); MK.tank.material.emissive.set(SP[spId].color); }
  const tx = M.active ? MX[M.step] : (M.last ? 8.2 : -6.4); MK.bx += (tx - MK.bx) * Math.min(1, dt * 3); const onTurn = !M.active && M.last && MK.bx > 7.6;
  J.group.position.set(MK.bx + (M.active && act(M.step) ? Math.sin(t * 40) * .01 : 0), onTurn ? 1.15 + Math.sin(t * 2) * .05 : 1.14, 0);
  J.group.rotation.y = onTurn ? t * .8 : 0; MK.turn.rotation.y = t * .8; J.group.scale.set(.42, .42 * (M.active && M.step >= 1 ? .92 : 1), .42);
  if (W.sample) W.sample.rotation.y = t * .6; if (W.liveSample) { W.liveSample.rotation.y = -t * .4; W.liveSample.position.y = 1.4 + Math.sin(t * 2) * .04; }
  if (W.neon) W.neon.forEach((n, i) => n.scale.y = .7 + .3 * Math.abs(Math.sin(t * 1.5 + i))); if (W.recLed) W.recLed.visible = L.on ? Math.sin(t * 6) > 0 : false;
}

/* ============================================================
   能量門與探索謎題
   ============================================================ */
const GATES = { coast: { x: 54, z: 0, ax: 'x', title: '散落的地圖碎片' }, volcano: { x: 0, z: -54, ax: 'z', title: '潮汐石陣' }, snow: { x: -54, z: 0, ax: 'x', title: '三座熔岩柱' } };
const QUEST = {
  coast: { from: 'forest', title: '散落的地圖碎片', need: 1, hint: '森林裡藏著 3 片發光的地圖碎片，找齊後東邊的能量門就會開啟。留意遠方的微光。' },
  volcano: { from: 'coast', title: '潮汐石陣', need: 3, hint: '海灘上的漂流瓶夾著一張紙條。讀完後，依照謎語點亮海邊的四顆潮汐石，北方之門就會開啟。' },
  snow: { from: 'volcano', title: '三座熔岩柱', need: 3, hint: '熔岩柱旁的石碑刻著古老的文字。點擊熔岩柱可以改變頂端晶石的顏色，西方之門將會開啟。' },
};
const FRAG_SPOTS = [[-32, 30], [38, -34], [-12, -42]], BOTTLE = [72, 16], TIDE_SPOTS = [[66, -18], [70, -18], [74, -18], [78, -18]], TABLET = [-16, -63], PILLARS = [[-6, -67], [0, -69], [6, -67]];
const PUZ_SPOTS = [...FRAG_SPOTS, BOTTLE, ...TIDE_SPOTS, TABLET, ...PILLARS];
const TIDE = [{ c: '#ef4444' }, { c: '#facc15' }, { c: '#22c55e' }, { c: '#3b82f6' }], PILLAR = ['ice', 'grass', 'coral', 'lava'];
function qState() { if (!S.q) S.q = { frags: [], tide: [], pil: [3, 3, 3], read: {} }; return S.q; }
const madeIn = zid => SPECIES.filter(s => s.zone === zid).reduce((a, s) => a + (S.codex[s.id] ? S.codex[s.id].made : 0), 0);
const questReady = k => madeIn(QUEST[k].from) >= QUEST[k].need;
const nextQuest = () => Object.keys(QUEST).find(k => !S.zones.includes(k));
let gateTex = null;
function buildGates() {
  if (!gateTex) {
    const c = document.createElement('canvas'); c.width = c.height = 128; const g = c.getContext('2d'); g.strokeStyle = 'rgba(255,255,255,.9)'; g.lineWidth = 3;
    for (let i = 0; i <= 128; i += 32) { g.beginPath(); g.moveTo(i, 0); g.lineTo(i - 64, 128); g.stroke(); g.beginPath(); g.moveTo(i, 0); g.lineTo(i + 64, 128); g.stroke(); }
    gateTex = new THREE.CanvasTexture(c); gateTex.wrapS = gateTex.wrapT = THREE.RepeatWrapping; gateTex.repeat.set(4, 2);
  }
  Object.keys(GATES).forEach(k => {
    if (S.zones.includes(k)) return; const d = GATES[k], g = new THREE.Group(), y = H(d.x, d.z); g.position.set(d.x, y, d.z); if (d.ax === 'z') g.rotation.y = Math.PI / 2; W.scene.add(g);
    const rockM = std('#475569', { flatShading: true, roughness: .9 });
    [-7.5, 7.5].forEach(o => { const r = mesh(jit(new THREE.CylinderGeometry(1, 1.4, 9, 7, 3), .25, o + 3), rockM, 0, 4, o, g); r.castShadow = !LOW; });
    const mat = new THREE.MeshBasicMaterial({ color: '#a78bfa', map: gateTex, transparent: true, opacity: .55, side: THREE.DoubleSide, depthWrite: false, blending: THREE.AdditiveBlending });
    const wall = mesh(new THREE.PlaneGeometry(14, 8), mat, 0, 4, 0, g); wall.rotation.y = Math.PI / 2;
    const run = textSprite('能量門', '#c4b5fd', '需解開：' + d.title); run.position.set(0, 9.2, 0); g.add(run);
    const col = addCol({ box: d.ax === 'x' ? [d.x - 1, -8, d.x + 1, 8] : [-8, d.z - 1, 8, d.z + 1] });
    const it = addInter(hitBox(1, 8, 14, 0, 4, 0, g), 'gate', k, '能量門');
    W.gates[k] = { g, mat, col, it, fade: 0 };
  });
  W.anim.push((dt, t) => { if (gateTex) gateTex.offset.y = t * .3; Object.keys(W.gates).forEach(k => { const gt = W.gates[k]; if (gt.fade > 0) { gt.fade -= dt; gt.mat.opacity = .55 * Math.max(0, gt.fade); if (gt.fade <= 0) { W.scene.remove(gt.g); delete W.gates[k]; } } else gt.mat.opacity = .45 + Math.sin(t * 2) * .1; }); });
}
function openGate(k) {
  const gt = W.gates[k]; if (!gt) return; gt.fade = 1.5;
  for (const arr of W.cols.values()) { const i = arr.indexOf(gt.col); if (i >= 0) arr.splice(i, 1); }
  W.inter = W.inter.filter(it => it !== gt.it);
}
function discoverZone(k) {
  if (S.zones.includes(k)) return; S.zones.push(k); save(); sfx.pop(); setTimeout(() => sfx.pop(), 250); openGate(k); spawnZone(k);
  const z = ZONES.find(z => z.id === k), dir = { coast: '東', volcano: '北', snow: '西' }[k];
  const txt = { coast: '地圖碎片拼在一起，指出森林盡頭有一條通往大海的小徑。', volcano: '潮汐石依序亮起，海面退潮，北方山脊的能量門隨之消散。', snow: '三根熔岩柱的光芒交會，冰冷的風從西方山脊吹來，雪原的入口出現了。' }[k];
  modal(`<h2>發現新區域：${z.name}</h2><p>${txt}</p><p>${dir}方的能量門已經開啟，新的史萊姆正在等你。指南針上的黃色標記會指引方向。</p>`, [{ t: '出發' }]);
  toast(`發現新區域：${z.name}`); renderQuest();
}
function buildPuzzles() {
  const q = qState(), W0 = W.scene;
  const add = (obj, pz, name, r = 1) => { const h = mesh(new THREE.SphereGeometry(r, 8, 6), new THREE.MeshBasicMaterial({ visible: false }), 0, 0, 0, obj); const it = addInter(h, 'puzzle', pz.type, name, { pz, obj }); W.puz.push(it); return it; };
  // 森林：地圖碎片（附淡淡光柱）
  const fragM = new THREE.MeshStandardMaterial({ color: '#fde68a', emissive: '#fbbf24', emissiveIntensity: 1.3, side: THREE.DoubleSide, flatShading: true });
  FRAG_SPOTS.forEach(([x, z], i) => {
    if (q.frags.includes(i) || S.zones.includes('coast')) return; const g = new THREE.Group(); g.position.set(x, H(x, z) + 1, z); W0.add(g);
    const shape = new THREE.Shape([new THREE.Vector2(-.4, -.3), new THREE.Vector2(.35, -.4), new THREE.Vector2(.45, .25), new THREE.Vector2(-.1, .4), new THREE.Vector2(-.45, .1)]);
    g.userData.spin = mesh(new THREE.ExtrudeGeometry(shape, { depth: .05, bevelEnabled: false }), fragM, 0, 0, 0, g);
    mesh(new THREE.CylinderGeometry(.25, .25, 7, 12, 1, true), new THREE.MeshBasicMaterial({ color: '#fde68a', transparent: true, opacity: .13, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }), 0, 3, 0, g);
    add(g, { type: 'frag', i }, '發光的地圖碎片', 1.1);
  });
  // 海岸：漂流瓶＋潮汐石
  if (!S.zones.includes('volcano')) {
    const b = new THREE.Group(); b.position.set(BOTTLE[0], H(...BOTTLE) + .15, BOTTLE[1]); b.rotation.set(0, .6, Math.PI / 2.3); W0.add(b);
    const gm = new THREE.MeshStandardMaterial({ color: '#86efac', transparent: true, opacity: .7, roughness: .05 });
    mesh(new THREE.CylinderGeometry(.16, .16, .55, 16), gm, 0, 0, 0, b); mesh(new THREE.CylinderGeometry(.06, .1, .2, 12), gm, 0, .36, 0, b); mesh(new THREE.CylinderGeometry(.05, .05, .08, 10), std('#a07850'), 0, .48, 0, b);
    mesh(new THREE.CylinderGeometry(.09, .09, .3, 10), std('#fef3c7', { emissive: '#fef3c7', emissiveIntensity: .4 }), 0, 0, 0, b);
    add(b, { type: 'bottle' }, '漂流瓶', .9);
    const order = [2, 0, 3, 1];
    order.forEach((ci, i) => {
      const [x, z] = TIDE_SPOTS[i], g = new THREE.Group(); g.position.set(x, H(x, z), z); W0.add(g);
      const stn = mesh(jit(new THREE.DodecahedronGeometry(.7, 1), .25, i + 5), std('#64748b', { flatShading: true, roughness: .9 }), 0, .5, 0, g); stn.scale.set(1, 1.3, 1); stn.castShadow = !LOW;
      g.userData.gem = mesh(new THREE.OctahedronGeometry(.25), new THREE.MeshStandardMaterial({ color: TIDE[ci].c, emissive: TIDE[ci].c, emissiveIntensity: .15, roughness: .2 }), 0, 1.55, 0, g);
      addCol({ x, z, r: .8 }); add(g, { type: 'tide', c: ci, g }, '潮汐石', 1.2);
    });
  }
  // 火山：石碑＋熔岩柱
  if (!S.zones.includes('snow')) {
    const t = new THREE.Group(); t.position.set(TABLET[0], H(...TABLET), TABLET[1]); t.rotation.y = .5; W0.add(t);
    box(1.3, 1.7, .3, std('#57534e', { flatShading: true, roughness: .95 }), 0, .85, 0, t); box(1.0, 1.2, .02, new THREE.MeshStandardMaterial({ color: '#1c1917', emissive: '#f97316', emissiveIntensity: .4 }), 0, .95, .16, t);
    addCol({ x: TABLET[0], z: TABLET[1], r: .8 }); add(t, { type: 'tablet' }, '古老的石碑', 1.2);
    PILLARS.forEach(([x, z], i) => {
      const g = new THREE.Group(); g.position.set(x, H(x, z), z); W0.add(g);
      mesh(new THREE.CylinderGeometry(.45, .55, 2.6, 6), std('#1c1917', { flatShading: true, roughness: .8 }), 0, 1.3, 0, g);
      mesh(new THREE.CylinderGeometry(.48, .48, .12, 6), glow('#ea580c'), 0, .8, 0, g);
      const cr = mesh(new THREE.OctahedronGeometry(.32), new THREE.MeshStandardMaterial({ color: '#fff', emissive: '#fff', emissiveIntensity: .7, roughness: .2 }), 0, 2.95, 0, g); cr.scale.y = 1.4; g.userData.cr = cr;
      setPillar(g, q.pil[i]); addCol({ x, z, r: .7 }); add(g, { type: 'pillar', i, g }, `熔岩柱 ${['左', '中', '右'][i]}`, 1.4);
    });
  }
  W.anim.push((dt, t) => W.puz.forEach((it, i) => {
    const o = it.obj; if (it.pz.type === 'frag') { o.userData.spin.rotation.y = t * 1.5 + i; o.userData.spin.position.y = Math.sin(t * 2 + i) * .15; }
    if (it.pz.type === 'pillar') o.userData.cr.rotation.y = t;
    if (it.pz.type === 'tide' && !qState().tide.includes(it.pz.c)) o.userData.gem.material.emissiveIntensity = .15 + (Math.sin(t * 2 + i) + 1) * .12;
  }));
}
function setPillar(g, v) { const c = SP[PILLAR[v]].color; g.userData.cr.material.color.set(c); g.userData.cr.material.emissive.set(c); }
function removePuz(it) { W.scene.remove(it.obj); W.puz = W.puz.filter(x => x !== it); W.inter = W.inter.filter(x => x !== it); }
function puzzleTap(it) {
  const q = qState(), pz = it.pz; sfx.tick();
  const zoneOf = { frag: 'coast', bottle: 'volcano', tide: 'volcano', tablet: 'snow', pillar: 'snow' }[pz.type];
  if (!questReady(zoneOf) && pz.type !== 'bottle' && pz.type !== 'tablet') {
    const Q = QUEST[zoneOf]; return toast(`${it.name}被一股力量封印著……先用${ZONES.find(z => z.id === Q.from).name}的史萊姆做出 ${Q.need} 個捏捏（目前 ${madeIn(Q.from)}）。`);
  }
  if (pz.type === 'frag') {
    if (!q.frags.includes(pz.i)) q.frags.push(pz.i); fx3(it.obj.position.clone().setY(it.obj.position.y + 1), `地圖碎片 ${q.frags.length}/3`, '#fde68a');
    removePuz(it); sfx.pop(); save(); renderQuest(); toast(`取得地圖碎片（${q.frags.length}/3）`);
    if (q.frags.length >= 3) setTimeout(() => discoverZone('coast'), 600);
  } else if (pz.type === 'bottle') {
    q.read.bottle = true; save(); renderQuest();
    modal(`<h2>漂流瓶裡的紙條</h2><div class="riddle">當潮水退去，石頭會依序醒來。<br>先喚醒夕陽，再喚醒正午的太陽，<br>接著是森林，最後是深海。</div><p class="small" style="color:var(--sub)">點擊漂流瓶附近的四顆潮汐石，依照謎語的順序點亮它們。順序錯了會重來。</p>`);
  } else if (pz.type === 'tide') {
    q.tide.push(pz.c); pz.g.userData.gem.material.emissiveIntensity = 1.8;
    if (!q.tide.every((c, i) => c === i)) { q.tide = []; sfx.squish(1); toast('石頭的光熄滅了……順序似乎不對'); W.puz.forEach(p => p.pz.type === 'tide' && (p.pz.g.userData.gem.material.emissiveIntensity = .15)); }
    else if (q.tide.length === 4) setTimeout(() => discoverZone('volcano'), 500); else sfx.machine(0);
    save(); renderQuest();
  } else if (pz.type === 'tablet') {
    q.read.tablet = true; save(); renderQuest();
    modal(`<h2>古老的石碑</h2><div class="riddle">左柱化為寒冰之心，<br>中柱長出初春的嫩草，<br>右柱綻放海底的花。<br>三色並立之時，西方之門將開。</div><p class="small" style="color:var(--sub)">點擊熔岩柱可以切換頂端晶石的顏色。這些顏色都和某種史萊姆有關，可以翻翻圖鑑。</p>`);
  } else if (pz.type === 'pillar') {
    q.pil[pz.i] = (q.pil[pz.i] + 1) % 4; setPillar(pz.g, q.pil[pz.i]); sfx.machine(2); save();
    if (q.pil[0] === 0 && q.pil[1] === 1 && q.pil[2] === 2) setTimeout(() => discoverZone('snow'), 500);
  }
}
function questTarget() {
  const k = nextQuest(); if (!k) return null; const q = qState();
  if (!S.zones.includes(QUEST[k].from)) return null;
  if (k === 'coast') { const i = [0, 1, 2].find(i => !q.frags.includes(i)); return i == null ? null : { x: FRAG_SPOTS[i][0], z: FRAG_SPOTS[i][1], n: '地圖碎片' }; }
  if (k === 'volcano') return q.read.bottle ? { x: 72, z: -18, n: '潮汐石' } : { x: BOTTLE[0], z: BOTTLE[1], n: '漂流瓶' };
  if (k === 'snow') return q.read.tablet ? { x: 0, z: -68, n: '熔岩柱' } : { x: TABLET[0], z: TABLET[1], n: '石碑' };
}
function renderQuest() {
  const el = $('#questBox'); if (!el) return; const k = nextQuest(), q = qState();
  if (!k) { el.innerHTML = '<b>探索日誌</b><div class="small" style="color:var(--sub);margin-top:4px">你已經發現了月光谷的所有區域。</div>'; return; }
  const Q = QUEST[k], ready = questReady(k), made = madeIn(Q.from);
  let prog = '';
  if (k === 'coast') prog = `<div class="qprog">${[0, 1, 2].map(i => `<i class="${q.frags.includes(i) ? 'on' : ''}"></i>`).join('')}</div>`;
  if (k === 'volcano') prog = `<div class="qprog">${[0, 1, 2, 3].map(i => `<i class="${i < q.tide.length ? 'on' : ''}"></i>`).join('')}</div>`;
  el.innerHTML = `<b>探索日誌：${Q.title}</b><div class="small" style="color:var(--sub);margin-top:4px;line-height:1.6">${Q.hint}${ready ? '' : `<br>（線索目前被封印：先用${ZONES.find(z => z.id === Q.from).name}的史萊姆做出 ${Q.need} 個捏捏，目前 ${made}/${Q.need}）`}</div>${prog}`;
}

/* ============================================================
   史萊姆（細緻模型：水滴身體、內核、氣泡、眼睛、嘴巴、腮紅、底部滴落、品種特徵）
   ============================================================ */
let SLIME_GEO = null; const SCACHE = {};
function surf(x, y, z) { const l = Math.hypot(x, y, z) || 1; x /= l; y /= l; z /= l; if (y < 0) { y *= .22; x *= 1.04; z *= 1.04; } else { const t = Math.max(0, (y - .5) / .5), p = 1 - t * t * .5; x *= p; z *= p; y += t * t * t * .32; } return new THREE.Vector3(x, y, z); }
function slimeGeo() {
  if (SLIME_GEO) return SLIME_GEO; const g = new THREE.SphereGeometry(1, LOW ? 32 : 44, LOW ? 22 : 30), p = g.attributes.position;
  for (let i = 0; i < p.count; i++) { const v = surf(p.getX(i), p.getY(i), p.getZ(i)); p.setXYZ(i, v.x, v.y, v.z); }
  g.computeVertexNormals(); return SLIME_GEO = g;
}
function spRes(sp) {
  if (SCACHE[sp.id]) return SCACHE[sp.id];
  const c = new THREE.Color(sp.color), dk = c.clone().multiplyScalar(.55);
  return SCACHE[sp.id] = {
    core: new THREE.MeshStandardMaterial({ color: sp.color2 || sp.color, emissive: sp.color2 || sp.color, emissiveIntensity: .5, roughness: .4 }),
    bub: new THREE.MeshStandardMaterial({ color: '#ffffff', transparent: true, opacity: .35, roughness: .1, depthWrite: false }),
    white: new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: .25 }), iris: new THREE.MeshStandardMaterial({ color: dk, roughness: .2 }),
    pupil: new THREE.MeshStandardMaterial({ color: '#0b1020', roughness: .15 }), hl: new THREE.MeshBasicMaterial({ color: '#ffffff' }),
    mouth: new THREE.MeshStandardMaterial({ color: '#3b0d1a', roughness: .5 }), tongue: new THREE.MeshStandardMaterial({ color: '#fb7185', roughness: .5 }),
    blush: new THREE.MeshBasicMaterial({ color: '#fb7185', transparent: true, opacity: .5, depthWrite: false }),
    drip: new THREE.MeshPhysicalMaterial({ color: sp.color, roughness: .1, clearcoat: 1, transparent: true, opacity: .85 }),
  };
}
function onSurf(parent, geo, mat, dir, out = 0, scale = 1) {
  const p = surf(...dir), n = new THREE.Vector3(...dir).normalize(); const m = mesh(geo, mat, p.x + n.x * out, p.y + n.y * out, p.z + n.z * out, parent);
  m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), n); m.scale.setScalar(scale); return m;
}
function slimeMesh(sp) {
  const g = new THREE.Group(), R = spRes(sp);
  const body = new THREE.Mesh(slimeGeo(), new THREE.MeshPhysicalMaterial({ color: sp.color, roughness: .1, clearcoat: 1, clearcoatRoughness: .05, transparent: true, opacity: .88, sheen: .5, sheenColor: new THREE.Color('#ffffff'), emissive: sp.color, emissiveIntensity: .06 }));
  body.scale.set(.95, .85, .95); body.castShadow = !LOW; g.add(body);
  const core = mesh(new THREE.SphereGeometry(.42, 20, 14), R.core, 0, .42, -.08, body); core.scale.set(1, .8, 1);
  if (!LOW) for (let i = 0; i < 5; i++) mesh(new THREE.SphereGeometry(.05 + Math.random() * .05, 10, 8), R.bub, rnd(-.45, .45), rnd(.2, .8), rnd(-.4, .3), body);
  // 臉
  const face = new THREE.Group(); body.add(face); const eyes = new THREE.Group(); face.add(eyes);
  [-1, 1].forEach(s => {
    const w = mesh(new THREE.SphereGeometry(.16, 20, 14), R.white, s * .28, .52, .74, eyes); w.scale.set(1, 1.18, .55);
    const ir = mesh(new THREE.SphereGeometry(.105, 16, 12), R.iris, s * .27, .5, .8, eyes); ir.scale.set(1, 1.1, .5);
    const pu = mesh(new THREE.SphereGeometry(.062, 12, 10), R.pupil, s * .27, .5, .84, eyes); pu.scale.set(1, 1.1, .5);
    mesh(new THREE.SphereGeometry(.03, 8, 6), R.hl, s * .27 + .04, .56, .87, eyes); mesh(new THREE.SphereGeometry(.015, 6, 4), R.hl, s * .27 - .03, .46, .87, eyes);
    const ck = mesh(new THREE.CircleGeometry(.09, 18), R.blush, s * .5, .34, .78, face); ck.lookAt(s * 1.7, .34, 2.6);
  });
  const mo = mesh(new THREE.SphereGeometry(.075, 14, 10), R.mouth, 0, .32, .9, face); mo.scale.set(1.2, .7, .4);
  const tg = mesh(new THREE.SphereGeometry(.04, 10, 8), R.tongue, 0, .29, .93, face); tg.scale.set(1.2, .6, .5);
  // 底部滴落
  if (!LOW) for (let i = 0; i < 3; i++) { const a = rnd(0, PI2), d = mesh(new THREE.SphereGeometry(.07, 10, 8), R.drip, Math.cos(a) * 1.02, -.02, Math.sin(a) * 1.02, body); d.scale.set(1, .6, 1); }
  // 品種特徵
  const F = new THREE.Group(); body.add(F); g.userData.feat = F;
  const m = (c, o = {}) => new THREE.MeshStandardMaterial(Object.assign({ color: c, roughness: .4 }, o));
  if (sp.id === 'grass') {
    const st = mesh(new THREE.CylinderGeometry(.025, .035, .32, 8), m('#3f7f45'), 0, 1.45, 0, F); void st;
    [-1, 1].forEach(s => { const l = mesh(new THREE.SphereGeometry(.2, 12, 8), m('#4ade80', { flatShading: true }), s * .17, 1.62, 0, F); l.scale.set(1, .18, .5); l.rotation.z = s * -.5; });
  } else if (sp.id === 'honey') {
    const hm = m('#f59e0b', { roughness: .1, transparent: true, opacity: .9 });
    for (let i = 0; i < 5; i++) { const a = i / 5 * PI2 + .3, d = onSurf(F, new THREE.SphereGeometry(.1, 10, 8), hm, [Math.cos(a) * .7, .7, Math.sin(a) * .7], .02); d.scale.set(.9, 2.2, .9); }
    const comb = mesh(new THREE.CylinderGeometry(.2, .2, .07, 6), m('#d97706', { flatShading: true }), .15, 1.28, -.05, F); comb.rotation.set(.3, 0, -.4);
    mesh(new THREE.CylinderGeometry(.14, .14, .08, 6), m('#fbbf24', { emissive: '#f59e0b', emissiveIntensity: .3 }), .15, 1.3, -.05, F).rotation.set(.3, 0, -.4);
  } else if (sp.id === 'salt') {
    const sm = m('#f8fafc', { roughness: .15, flatShading: true });
    for (let i = 0; i < 6; i++) { const a = i * 1.1, c = onSurf(F, new THREE.BoxGeometry(.11, .11, .11), sm, [Math.cos(a) * .45, .9, Math.sin(a) * .45], 0); c.rotation.set(rnd(0, 3), rnd(0, 3), rnd(0, 3)); }
  } else if (sp.id === 'coral') {
    const cm = m('#f472b6', { roughness: .5 }), tip = m('#fbcfe8');
    [[-.2, 0], [.18, .1], [0, -.2]].forEach(([x, z], i) => { const h = .35 + i * .08, b = mesh(new THREE.CylinderGeometry(.04, .06, h, 8), cm, x, 1.25 + h / 2, z, F); b.rotation.set(z * 1.5, 0, -x * 1.5); mesh(new THREE.SphereGeometry(.065, 10, 8), tip, x - x * .6, 1.28 + h, z - z * .4, F); });
  } else if (sp.id === 'lava') {
    const lm = glow('#fb923c'); for (let i = 0; i < 6; i++) { const a = rnd(0, PI2), c = onSurf(F, new THREE.BoxGeometry(.02, .02, .28), lm, [Math.cos(a), rnd(.1, .7), Math.sin(a)], 0); c.rotateY(rnd(0, 3)); }
    for (let i = 0; i < 4; i++) { const a = rnd(0, PI2), c = onSurf(F, new THREE.SphereGeometry(.16, 8, 6), m('#431407', { flatShading: true, roughness: .9 }), [Math.cos(a) * .6, .8, Math.sin(a) * .6], -.04); c.scale.set(1, .3, 1); }
    const fl = mesh(new THREE.ConeGeometry(.13, .4, 12), new THREE.MeshBasicMaterial({ color: '#fde047', transparent: true, opacity: .85, blending: THREE.AdditiveBlending, depthWrite: false }), 0, 1.55, 0, F); g.userData.flame = fl;
  } else if (sp.id === 'obsid') {
    const om = new THREE.MeshPhysicalMaterial({ color: '#2e1065', roughness: .05, metalness: .3, clearcoat: 1, flatShading: true });
    [[0, .9, -.4, 1.2], [.35, .7, -.55, .9], [-.35, .7, -.55, .9], [0, .5, -.85, .7]].forEach(([x, y, z, s]) => { const c = onSurf(F, new THREE.OctahedronGeometry(.16), om, [x, y, z], .1); c.scale.set(s * .7, s * 2, s * .7); });
  } else if (sp.id === 'ice') {
    const im = new THREE.MeshPhysicalMaterial({ color: '#e0f2fe', roughness: .05, clearcoat: 1, transparent: true, opacity: .85, emissive: '#7dd3fc', emissiveIntensity: .25 });
    for (let i = 0; i < 6; i++) { const a = i / 6 * PI2; const c = onSurf(F, new THREE.ConeGeometry(.07, .35, 6), im, [Math.cos(a) * .55, .85, Math.sin(a) * .55], .12); c.scale.y = .8 + (i % 2) * .5; }
  } else if (sp.id === 'aurora') {
    const orb = new THREE.Group(); orb.position.y = .7; body.add(orb); g.userData.orbit = orb;
    ['#22d3ee', '#a78bfa', '#34d399', '#f0abfc'].forEach((c, i) => mesh(new THREE.SphereGeometry(.06, 10, 8), glow(c), Math.cos(i / 4 * PI2) * 1.25, Math.sin(i * 2) * .2, Math.sin(i / 4 * PI2) * 1.25, orb));
    cyl(.015, .015, .35, 6, m('#c4b5fd'), 0, 1.5, 0, F); mesh(new THREE.OctahedronGeometry(.08), glow('#fde047'), 0, 1.72, 0, F);
  }
  if (sp.rar >= 3) { const halo = mesh(new THREE.TorusGeometry(.32, .03, 10, 40), new THREE.MeshBasicMaterial({ color: sp.rar >= 4 ? '#fde047' : '#f0abfc' }), 0, 2.0, 0, g); halo.rotation.x = Math.PI / 2; g.userData.halo = halo; }
  blobShadow(1.05, g, .03);
  g.userData.body = body; g.userData.eyes = eyes; body.userData.slimeRoot = g; return g;
}
function zoneSpawn(zid) {
  for (let k = 0; k < 80; k++) {
    let x, z;
    if (zid === 'forest') { x = rnd(-44, 44); z = rnd(-44, 44); if (Math.hypot(x, z) < WS_R + 4) continue; }
    else if (zid === 'coast') { x = rnd(62, 82); z = rnd(-38, 38); }
    else if (zid === 'volcano') { x = rnd(-40, 40); z = rnd(-60, -76); if (Math.hypot(x, z + 96) < 33) continue; }
    else { x = rnd(-62, -96); z = rnd(-38, 38); }
    const h = H(x, z); if (h < 0 || h > 10) continue; return [x, z];
  }
  return [0, 25];
}
function spawnSlime(zid, home) {
  const list = SPECIES.filter(s => s.zone === zid); let r = Math.random() * list.reduce((a, s) => a + s.w, 0), sp = list[0];
  for (const s of list) { if ((r -= s.w) <= 0) { sp = s; break; } }
  const [hx, hz] = home || zoneSpawn(zid), m = slimeMesh(sp);
  const sl = { sp, m, zid, hx, hz, x: hx + rnd(-3, 3), z: hz + rnd(-3, 3), vx: 0, vz: 0, ph: rnd(0, 6), hits: 0, cool: 0, sq: 0, blink: rnd(1, 4), yaw: rnd(0, 6), turn: rnd(1, 4), flee: 0 };
  m.userData.body.userData.sl = sl; W.scene.add(m); W.slimes.push(sl); return sl;
}
function spawnZone(zid) { const n = LOW ? 6 : 9; for (let i = 0; i < n; i++) spawnSlime(zid); }
function spawnAllSlimes() { S.zones.forEach(spawnZone); }
function slimeStep(dt, t) {
  W.slimes.forEach(s => {
    const dx = s.x - P.x, dz = s.z - P.z, dist = Math.hypot(dx, dz); s.m.visible = dist < 60; if (!s.m.visible) return;
    s.ph += dt * 3; s.turn -= dt;
    if (s.turn < 0) { s.turn = rnd(1.5, 4); const a = Math.atan2(s.hz - s.z, s.hx - s.x) + rnd(-1.5, 1.5), far = Math.hypot(s.hx - s.x, s.hz - s.z) > 9; const sp = Math.random() < .3 ? 0 : rnd(.4, .9); s.vx = Math.cos(far ? Math.atan2(s.hz - s.z, s.hx - s.x) : a) * sp; s.vz = Math.sin(far ? Math.atan2(s.hz - s.z, s.hx - s.x) : a) * sp; }
    let vx = s.vx, vz = s.vz; if (s.flee > 0) { s.flee -= dt; vx = dx / (dist || 1) * 2.5; vz = dz / (dist || 1) * 2.5; }
    const nx = s.x + vx * dt, nz = s.z + vz * dt, nh = H(nx, nz);
    if (nh > -.1 && Math.abs(nh - H(s.x, s.z)) < .5 && Math.hypot(nx, nz) > WS_R + 1) { s.x = nx; s.z = nz; } else s.turn = 0;
    s.cool = Math.max(0, s.cool - dt); s.sq = Math.max(0, s.sq - dt * 3);
    const ph = Math.abs(Math.sin(s.ph)), cool = s.cool > 0, moving = Math.hypot(vx, vz) > .05, hop = cool || !moving ? Math.abs(Math.sin(s.ph * .5)) * .05 : ph * .45, b = s.m.userData.body;
    s.m.position.set(s.x, G(s.x, s.z), s.z); b.position.y = hop + .02;
    const k = cool ? .75 : 1, wob = Math.sin(t * 5 + s.ph) * .02;
    b.scale.set(.95 * k * (1 + s.sq * .25 + wob), .85 * k * (1 - s.sq * .3 - wob + (moving && !cool ? ph * .06 - (1 - ph) * .08 : 0)), .95 * k * (1 + s.sq * .25 + wob));
    b.material.opacity = cool ? .5 : .88;
    const want = dist < 7 ? Math.atan2(-dx, -dz) : (moving ? Math.atan2(vx, vz) : s.yaw); let d = want - s.yaw; d = Math.atan2(Math.sin(d), Math.cos(d)); s.yaw += d * Math.min(1, dt * 4); s.m.rotation.y = s.yaw;
    s.blink -= dt; s.m.userData.eyes.scale.y = s.blink < .12 ? .15 : (cool ? .35 : 1); if (s.blink < 0) s.blink = rnd(2, 5);
    const u = s.m.userData; if (u.halo) { u.halo.rotation.z = t; u.halo.position.y = 2.0 + hop + Math.sin(t * 2) * .05; }
    if (u.flame) { u.flame.scale.set(1 + Math.sin(t * 13 + s.ph) * .15, 1 + Math.sin(t * 9 + s.ph) * .3, 1); }
    if (u.orbit) u.orbit.rotation.y = t * 1.5;
  });
}
function hitSlime(sl) {
  const top = sl.m.position.clone().setY(sl.m.position.y + 2);
  if (sl.cool > 0) { fx3(top, '害羞中…', '#cbd5e1'); return; }
  sl.hits++; sl.sq = 1; sl.flee = .35; sfx.squish(.8); if (navigator.vibrate) navigator.vibrate(8);
  if (sl.hits >= 3) {
    const n = 1 + S.up.net; S.gel[sl.sp.id] = (S.gel[sl.sp.id] || 0) + n; discover(sl.sp.id); sl.cool = 6; sl.hits = 0;
    fx3(top, `+${n} ${short(sl.sp.id)}凝膠`, sl.sp.color); sfx.pop(); toast(`採集到 ${n} 份${SP[sl.sp.id].name}凝膠`); renderHotbar(true);
  } else fx3(top, `${short(sl.sp.id)} ${sl.hits}/3`, RAR[sl.sp.rar].c);
}

/* ============================================================
   玩家（第一人稱）與輸入
   ============================================================ */
let P = null;
const KEYS = new Set(), IN = { joy: null, jx: 0, jy: 0, run: false, look: null, drag: null };
const SENS = [.0016, .0025, .0038], SENS_N = ['低', '中', '高'];
function initPlayer() {
  const sp = S.pos || { x: 0, z: 31, yaw: 0 };
  P = { x: sp.x, z: sp.z, y: G(sp.x, sp.z), vy: 0, yaw: sp.yaw, pitch: -.08, ground: true, r: .35, eye: 1.62, camY: G(sp.x, sp.z), bob: 0, stepT: 0 };
}
const locked = () => document.pointerLockElement === $('#worldCv');
function lockMouse() { if (TOUCH || GUI.kind || !$('#modal').hidden) return; try { const r = $('#worldCv').requestPointerLock(); if (r && r.catch) r.catch(() => { }); } catch (e) { } }
function unlockMouse() { if (locked()) { W.unlockByUs = true; document.exitPointerLock(); } }
function bindInput() {
  const cv = $('#worldCv');
  addEventListener('keydown', e => {
    if (e.target.tagName === 'INPUT') return;
    const k = e.code; if (!$('#modal').hidden) return;
    if (k === 'Escape') { if (GUI.kind) closeGui(); return; }
    if (k === 'KeyI' || k === 'Tab') { e.preventDefault(); GUI.kind === 'inv' ? closeGui() : openGui('inv'); return; }
    if (GUI.kind) { if (k === 'Space' && GUI.kind === 'line' && M.active) { e.preventDefault(); stopBar(); } if (k === 'KeyE' && GUI.kind !== 'line') closeGui(); return; }
    KEYS.add(k); if (k === 'Space') e.preventDefault();
    if (k === 'KeyE' || k === 'KeyF') act();
    if (/^Digit[1-9]$/.test(k)) { S.hb = +k.slice(5) - 1; renderHotbar(true); }
  });
  addEventListener('keyup', e => KEYS.delete(e.code));
  addEventListener('blur', () => KEYS.clear());
  cv.addEventListener('contextmenu', e => e.preventDefault());
  cv.addEventListener('wheel', e => { if (GUI.kind) return; S.hb = (S.hb + (e.deltaY > 0 ? 1 : 8)) % 9; renderHotbar(true); }, { passive: true });
  document.addEventListener('pointerlockchange', () => {
    $('#startHint').hidden = locked() || TOUCH || !!GUI.kind;
    if (!locked() && !GUI.kind && !TOUCH && !W.unlockByUs && $('#modal').hidden) openGui('pause');
    W.unlockByUs = false;
  });
  document.addEventListener('mousemove', e => { if (!locked() || GUI.kind) return; const s = SENS[S.sens]; P.yaw -= e.movementX * s; P.pitch = clamp(P.pitch - e.movementY * s, -1.5, 1.5); });
  cv.addEventListener('pointerdown', e => {
    try { audio(); } catch (_) { }
    if (GUI.kind) return;
    if (e.pointerType === 'mouse') {
      if (locked()) { if (e.button === 0 || e.button === 2) act(); return; }
      IN.drag = { x: e.clientX, y: e.clientY, moved: 0, id: e.pointerId }; lockMouse(); return;
    }
    // 觸控：左下半部為搖桿，其他區域拖曳轉視角、輕點互動
    const w = innerWidth, h = innerHeight;
    if (!IN.joy && e.clientX < w * .45 && e.clientY > h * .4) { IN.joy = { id: e.pointerId, x0: e.clientX, y0: e.clientY }; const jb = $('#joyBase'); jb.style.left = (e.clientX - 60) + 'px'; jb.style.top = (e.clientY - 60) + 'px'; jb.classList.add('on'); }
    else if (!IN.look) IN.look = { id: e.pointerId, x: e.clientX, y: e.clientY, sx: e.clientX, sy: e.clientY, t: performance.now(), moved: 0 };
  });
  addEventListener('pointermove', e => {
    if (IN.joy && e.pointerId === IN.joy.id) { let dx = e.clientX - IN.joy.x0, dy = e.clientY - IN.joy.y0; const l = Math.hypot(dx, dy), m = 50; if (l > m) { dx *= m / l; dy *= m / l; } IN.jx = dx / m; IN.jy = dy / m; $('#joyKnob').style.transform = `translate(${dx}px,${dy}px)`; }
    if (IN.look && e.pointerId === IN.look.id) { const dx = e.clientX - IN.look.x, dy = e.clientY - IN.look.y; IN.look.x = e.clientX; IN.look.y = e.clientY; IN.look.moved += Math.abs(dx) + Math.abs(dy); const s = SENS[S.sens] * 2.2; P.yaw -= dx * s; P.pitch = clamp(P.pitch - dy * s, -1.5, 1.5); }
    if (IN.drag && e.pointerId === IN.drag.id && !locked()) { const s = SENS[S.sens] * 1.6, dx = e.movementX || 0, dy = e.movementY || 0; IN.drag.moved += Math.abs(dx) + Math.abs(dy); P.yaw -= dx * s; P.pitch = clamp(P.pitch - dy * s, -1.5, 1.5); }
  });
  const up = e => {
    if (IN.joy && e.pointerId === IN.joy.id) { IN.joy = null; IN.jx = IN.jy = 0; $('#joyKnob').style.transform = ''; $('#joyBase').classList.remove('on'); }
    if (IN.look && e.pointerId === IN.look.id) { const L0 = IN.look; IN.look = null; if (L0.moved < 12 && performance.now() - L0.t < 350 && !GUI.kind) actAt(L0.sx, L0.sy); }
    if (IN.drag && e.pointerId === IN.drag.id) { const d = IN.drag; IN.drag = null; if (d.moved < 6 && !locked() && !GUI.kind) actAt(d.x, d.y); }
  };
  addEventListener('pointerup', up); addEventListener('pointercancel', up);
  $('#btnJump').addEventListener('pointerdown', e => { e.preventDefault(); e.stopPropagation(); jump(); });
  $('#btnAct').addEventListener('pointerdown', e => { e.preventDefault(); e.stopPropagation(); try { audio(); } catch (_) { } act(); });
  $('#btnRun').addEventListener('pointerdown', e => { e.preventDefault(); e.stopPropagation(); IN.run = !IN.run; $('#btnRun').classList.toggle('on', IN.run); });
  addEventListener('resize', resizeWorld);
}
function jump() { if (P.ground) { P.vy = 7.2; P.ground = false; } }
function tryMove(dx, dz) {
  let nx = P.x + dx, nz = P.z + dz; const h0 = G(P.x, P.z), h1 = G(nx, nz), d = Math.hypot(dx, dz) || 1e-6;
  if (h1 < -.6) return false;
  if (h1 - h0 > d * 1.15 && h1 > P.y + .35) return false;
  for (const c of colsNear(nx, nz)) {
    if (c.box) { const [x0, z0, x1, z1] = c.box, cx = clamp(nx, x0, x1), cz = clamp(nz, z0, z1), ddx = nx - cx, ddz = nz - cz, l = Math.hypot(ddx, ddz); if (l < P.r) { if (l < 1e-4) return false; nx = cx + ddx / l * P.r; nz = cz + ddz / l * P.r; } }
    else { const ddx = nx - c.x, ddz = nz - c.z, l = Math.hypot(ddx, ddz), R = c.r + P.r; if (l < R) { if (l < 1e-4) return false; nx = c.x + ddx / l * R; nz = c.z + ddz / l * R; } }
  }
  if (Math.max(Math.abs(nx), Math.abs(nz)) > 125) return false;
  P.x = nx; P.z = nz; return true;
}
function playerStep(dt) {
  let f = 0, s = 0;
  if (!GUI.kind) {
    if (KEYS.has('KeyW') || KEYS.has('ArrowUp')) f += 1; if (KEYS.has('KeyS') || KEYS.has('ArrowDown')) f -= 1;
    if (KEYS.has('KeyD') || KEYS.has('ArrowRight')) s += 1; if (KEYS.has('KeyA') || KEYS.has('ArrowLeft')) s -= 1;
    if (IN.jx || IN.jy) { f = -IN.jy; s = IN.jx; }
    if (KEYS.has('Space')) jump();
  }
  const l = Math.hypot(f, s); if (l > 1) { f /= l; s /= l; }
  const run = KEYS.has('ShiftLeft') || KEYS.has('ShiftRight') || IN.run, spd = (run ? 7.5 : 4.3) * (1 + .1 * S.up.boots);
  const sy = Math.sin(P.yaw), cy = Math.cos(P.yaw), dx = (-sy * f + cy * s) * spd * dt, dz = (-cy * f - sy * s) * spd * dt;
  if (dx || dz) { tryMove(dx, 0); tryMove(0, dz); }
  P.vy -= 22 * dt; P.y += P.vy * dt; const g = G(P.x, P.z);
  if (P.y <= g) { P.y = g; P.vy = 0; P.ground = true; } else if (P.y - g > .25) P.ground = false;
  const moving = (f || s) && P.ground; P.bob += moving ? dt * (run ? 13 : 9) : 0;
  if (moving) { P.stepT -= dt; if (P.stepT < 0) { P.stepT = run ? .3 : .42; sfx.step(); } }
  P.camY += (P.y - P.camY) * Math.min(1, dt * 18);
}
const LINE_VIEW = { p: new THREE.Vector3(0, WS_Y + 7.5, 6.5), t: new THREE.Vector3(0, WS_Y - 1.6, -6.5) };
function cameraStep(dt) {
  const cam = W.cam;
  if (GUI.kind === 'line') {
    const q = new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().lookAt(LINE_VIEW.p, LINE_VIEW.t, new THREE.Vector3(0, 1, 0)));
    cam.position.lerp(LINE_VIEW.p, Math.min(1, dt * 4)); cam.quaternion.slerp(q, Math.min(1, dt * 4)); W.camAway = true; return;
  }
  const bob = Math.sin(P.bob) * .045, target = new THREE.Vector3(P.x, P.camY + P.eye + bob, P.z);
  if (W.camAway) { cam.position.lerp(target, Math.min(1, dt * 6)); if (cam.position.distanceTo(target) < .05) W.camAway = false; } else cam.position.copy(target);
  cam.rotation.set(P.pitch, P.yaw, 0, 'YXZ');
}
function resizeWorld() { if (!W.r) return; const w = innerWidth, h = innerHeight; W.r.setSize(w, h, false); W.cam.aspect = w / h; W.cam.fov = w / h < 1 ? 80 : 72; W.cam.updateProjectionMatrix(); }

/* ---------- 準心目標與互動 ---------- */
let TARGET = null;
function pickAt(ndcX, ndcY) {
  RAY.setFromCamera(new THREE.Vector2(ndcX, ndcY), W.cam); RAY.far = 7.5;
  const objs = [];
  W.slimes.forEach(s => { if (s.m.visible && Math.hypot(s.x - P.x, s.z - P.z) < 9) objs.push(s.m.userData.body); });
  W.inter.forEach(it => { const p = it.hit.getWorldPosition(new THREE.Vector3()); if (Math.hypot(p.x - P.x, p.z - P.z) < 14) objs.push(it.hit); });
  const h = RAY.intersectObjects(objs, false); RAY.far = Infinity; if (!h.length) return null;
  const o = h[0].object; if (o.userData.sl) return { type: 'slime', sl: o.userData.sl, d: h[0].distance };
  const it = o.userData.it; if (!it) return null; if (it.kind === 'station' && h[0].distance > 5.5) return null; return { type: it.kind, it, d: h[0].distance };
}
function targetLabel(t) {
  if (!t) return '';
  const key = TOUCH ? '' : '<kbd>E</kbd>';
  if (t.type === 'slime') { const s = t.sl; return `${key}${s.sp.name} <span style="color:${RAR[s.sp.rar].c}">${RAR[s.sp.rar].n}</span>${s.cool > 0 ? ' · 害羞中' : ` · 採集 ${s.hits}/3`}`; }
  if (t.type === 'station') return `${key}使用${t.it.name}`;
  if (t.type === 'gate') return `能量門 · 需解開「${GATES[t.it.id].title}」`;
  if (t.type === 'puzzle') return `${key}${t.it.name}`;
  return '';
}
function act() { if (GUI.kind || !W.ready) return; doAct(TARGET); }
function actAt(x, y) { const t = pickAt(x / innerWidth * 2 - 1, -(y / innerHeight) * 2 + 1); doAct(t); }
function doAct(t) {
  if (!t) return;
  if (t.type === 'slime') hitSlime(t.sl);
  else if (t.type === 'station') openGui(t.it.id);
  else if (t.type === 'puzzle') puzzleTap(t.it);
  else if (t.type === 'gate') { const k = t.it.id; toast(`能量門封住了去路。解開「${GATES[k].title}」才能通過。按 I 開啟背包查看探索日誌。`); }
}

/* ============================================================
   HUD：快捷列、指南針、目標、浮字
   ============================================================ */
function invItems() { return [...SPECIES.filter(s => S.gel[s.id] > 0).map(s => ({ t: 'gel', sp: s.id, n: S.gel[s.id] })), ...S.stock.map(p => ({ t: 'prod', p }))]; }
function slotHTML(it, i, sel) {
  if (!it) return `<div class="slot ${sel ? 'sel' : ''}" data-act="hb" data-i="${i}">${i < 9 ? `<span class="k">${i + 1}</span>` : ''}</div>`;
  const sp = SP[it.t === 'gel' ? it.sp : it.p.sp], bg = sp.color2 ? `linear-gradient(135deg,${sp.color},${sp.color2})` : `radial-gradient(circle at 35% 30%,${rgba(sp.color, 1, .55)},${sp.color})`;
  const extra = it.t === 'gel' ? `<span class="n">${it.n}</span>` : `<span class="dur"><i style="width:${it.p.dur}%;background:${it.p.dur > 50 ? '#34d399' : it.p.dur > 20 ? '#fbbf24' : '#fb7185'}"></i></span>`;
  return `<div class="slot ${sel ? 'sel' : ''}" data-act="hb" data-i="${i}" title="${it.t === 'gel' ? sp.name + '凝膠' : sp.name + '捏捏'}">${i < 9 ? `<span class="k">${i + 1}</span>` : ''}<div class="ico ${it.t === 'prod' ? 'prod' : ''}" style="background:${bg}"></div>${extra}</div>`;
}
let hbSig = '';
function renderHotbar(force) {
  const items = invItems(); S.hb = clamp(S.hb, 0, 8);
  const sig = S.hb + '|' + items.map(it => it.t === 'gel' ? it.sp + it.n : it.p.id + ':' + Math.round(it.p.dur)).join(',');
  if (!force && sig === hbSig) return; hbSig = sig;
  $('#hotbar').innerHTML = Array.from({ length: 9 }, (_, i) => slotHTML(items[i], i, i === S.hb)).join('');
}
const held = () => invItems()[S.hb] || null;
function fx3(pos, txt, color = '#fff') {
  const q = pos.clone().project(W.cam); if (q.z > 1) return;
  const d = document.createElement('div'); d.className = 'fx'; d.textContent = txt; d.style.left = (q.x * .5 + .5) * innerWidth + 'px'; d.style.top = (-q.y * .5 + .5) * innerHeight + 'px'; d.style.color = color;
  $('#fxl').appendChild(d); setTimeout(() => d.remove(), 1100);
}
function objective() {
  const gel = unlockedSpecies().some(s => (S.gel[s.id] || 0) >= 2);
  if (!S.stock.length && !gel && !S.sales) return { t: '採集凝膠', d: '靠近史萊姆，對準後' + (TOUCH ? '點擊' : '按 E 或左鍵') + ' 3 次，收集至少 2 份凝膠。' };
  if (!S.stock.length && !S.sales) return { t: '加工第一個捏捏', d: '回到工坊，使用「加工產線」。', x: 0, z: -6.5, c: '#22d3ee' };
  if (!S.sales) return { t: '開直播賣出', d: '走到「直播台」，開直播並擠壓捏捏累積人氣。', x: 9, z: 3.5, c: '#fb7185' };
  const k = nextQuest(), qt = questTarget();
  if (k) return { t: QUEST[k].title, d: questReady(k) ? (qt ? `前往${qt.n}。` : QUEST[k].hint) : `先用${ZONES.find(z => z.id === QUEST[k].from).name}的史萊姆做出 ${QUEST[k].need} 個捏捏（${madeIn(QUEST[k].from)}/${QUEST[k].need}）。`, x: qt && qt.x, z: qt && qt.z, c: '#c4b5fd' };
  return { t: '開設夢想捏捏博物館', d: '累積粉絲與營收，到工作電腦的圖鑑頁完成夢想。' };
}
let objSig = '';
function renderObjective() {
  const o = objective(), s = o.t + o.d; W.obj = o; if (s === objSig) return; objSig = s;
  $('#objective').innerHTML = `<b>目前目標</b>${esc(o.t)}<div style="color:#cbd5e1;font-size:12px">${esc(o.d)}</div>`;
}
function renderCompass() {
  const el = $('#cmpStrip'), w = el.clientWidth || 300, range = Math.PI * .75, items = [];
  const put = (ang, html, cls, color) => { let r = Math.atan2(Math.sin(ang - P.yaw), Math.cos(ang - P.yaw)); if (Math.abs(r) > range / 2) return; items.push(`<span class="cmk ${cls}" style="left:${(.5 - r / range) * w}px;${color ? 'color:' + color : ''}">${html}</span>`); };
  [['北', 0], ['西', Math.PI / 2], ['南', Math.PI], ['東', -Math.PI / 2]].forEach(([n, a]) => put(a, n, 'dir'));
  for (let a = 0; a < 24; a++) if (a % 6) put(a / 24 * PI2, '', 'tick');
  const bearing = (x, z) => Math.atan2(-(x - P.x), -(z - P.z));
  put(bearing(0, 0), '', 'pin', '#22d3ee');
  const o = W.obj; if (o && o.x != null) put(bearing(o.x, o.z), '', 'pin', o.c || '#c4b5fd');
  Object.keys(GATES).forEach(k => { if (S.zones.includes(k) && !S.seenZone?.[k]) put(bearing(GATES[k].x * 1.4, GATES[k].z * 1.4), '', 'pin', '#fbbf24'); });
  el.innerHTML = items.join('');
}
const FAN_LV = [0, 10, 30, 60, 120, 250, 500, 800, 1500, 3000];
function renderXP() {
  const f = S.fans; let lv = 0; while (lv < FAN_LV.length - 1 && f >= FAN_LV[lv + 1]) lv++;
  const a = FAN_LV[lv], b = FAN_LV[Math.min(lv + 1, FAN_LV.length - 1)], pct = b > a ? (f - a) / (b - a) * 100 : 100;
  $('#xpbar i').style.width = clamp(pct, 0, 100) + '%'; $('#xpbar span').textContent = lv;
}
function renderTop() {
  $('#sMoney').textContent = fmt(S.money); $('#sFans').textContent = '粉絲 ' + Math.floor(S.fans);
  const t = trend.sp ? SP[trend.sp] : null; $('#sTrend').innerHTML = t ? `流行 ${dot(t.color)}${short(trend.sp)} ×1.35` : '流行 —';
  $('#btnSound').textContent = '音效：' + (S.sound ? '開' : '關'); $('#btnSens').textContent = '視角靈敏度：' + SENS_N[S.sens];
}
function pickTrend() { trend.sp = pick(unlockedSpecies()).id; renderTop(); toast('流行色更新：' + SP[trend.sp].name + '（售價 ×1.35）'); }

/* ============================================================
   介面視窗（工作站 / 背包 / 選單）
   ============================================================ */
const GUI = { kind: null };
const GUIS = {
  line: { t: '加工產線', tabs: ['make'] }, decor: { t: '裝飾桌', tabs: ['decor'] }, live: { t: '直播台', tabs: ['live'] },
  pc: { t: '工作電腦', tabs: ['web', 'up', 'branch', 'codex'] }, inv: { t: '背包', tabs: ['inv', 'codex'] }, pause: { t: '選單', tabs: ['pause'] },
};
const TABN = { make: '加工', decor: '裝飾', live: '直播', web: '網路商店', up: '升級', branch: '事業', codex: '圖鑑', inv: '背包', pause: '選單' };
let tab = '';
function openGui(kind, sec) {
  const g = GUIS[kind]; if (!g) return; unlockMouse(); GUI.kind = kind; sfx.open();
  const it = held();
  if (kind === 'line' && it && it.t === 'gel' && !M.active) { M.sp = it.sp; M.last = null; }
  if (kind === 'line' && !M.sp) M.sp = (unlockedSpecies().find(s => (S.gel[s.id] || 0) >= 2) || {}).id || null;
  if (kind === 'decor' && it && it.t === 'prod') D.id = it.p.id;
  if (kind === 'live' && it && it.t === 'prod' && !stockById(L.stageId)) L.stageId = it.p.id;
  $('#gui').hidden = false; $('#gui').classList.toggle('sheet', kind === 'line'); $('#gtitle').textContent = g.t; $('#startHint').hidden = true;
  showSec(sec || g.tabs[0]);
}
function guiTabs() { const g = GUIS[GUI.kind]; return g.tabs.filter(t => t !== 'branch' || S.branch || branchReady()); }
function renderGuiTabs() { const tabs = guiTabs(); $('#gtabs').innerHTML = tabs.length > 1 ? tabs.map(t => `<button class="${t === tab ? 'on' : ''}" data-act="sec" data-sec="${t}">${TABN[t]}${t === 'branch' && !S.branch ? ' ●' : ''}</button>`).join('') : ''; }
function showSec(sec) { tab = sec; $$('.panel').forEach(p => p.classList.toggle('on', p.id === 'p-' + sec)); renderGuiTabs(); RENDER[sec](); $('#gbody').scrollTop = 0; }
function closeGui() {
  if (!GUI.kind) return; if (GUI.kind === 'line' && M.active) { toast('產線還在運轉，請先完成這一輪加工。'); return; }
  GUI.kind = null; tab = ''; $('#gui').hidden = true; $$('.panel').forEach(p => p.classList.remove('on'));
  renderHotbar(true); lockMouse(); $('#startHint').hidden = locked() || TOUCH;
}
function refresh() { if (GUI.kind && tab) RENDER[tab](); renderTop(); renderHotbar(); }

/* ---------- 加工 ---------- */
const M = { sp: null, step: -1, pos: 0, dir: 1, spd: 1, c: .5, prec: [], active: false, last: null };
function zoneHalf(step) { return 0.12 + 0.03 * S.up[MKEY[step]]; }
function startMake() {
  const sp = M.sp; if (!sp || (S.gel[sp] || 0) < 2) return toast('凝膠不足（需要 2 份）');
  if (S.stock.length >= cap()) return toast('庫存已滿，請先銷售或升級倉儲貨架');
  S.gel[sp] -= 2; M.step = 0; M.prec = []; M.active = true; M.last = null; MK.bx = -6.4; nextStep(); renderHotbar(true); renderMake();
}
function nextStep() { M.pos = 0; M.dir = 1; M.spd = 0.9 + 0.4 * M.step; M.c = rnd(.3, .7); }
function stopBar() {
  if (!M.active) return; const d = Math.abs(M.pos - M.c), w = zoneHalf(M.step);
  const pr = d <= w ? 0.85 + 0.15 * (1 - d / w) : Math.max(0, 0.85 * (1 - (d - w) / 0.4));
  M.prec.push(pr); sfx.machine(M.step); MK.pulse[M.step] = .7;
  toast(`${STEPS[M.step]}：${pr > .95 ? '完美' : pr > .8 ? '很好' : pr > .5 ? '普通' : '偏了'}（${Math.round(pr * 100)}%）`); M.step++;
  if (M.step >= 3) { M.active = false; const avg = M.prec.reduce((a, b) => a + b, 0) / 3, p = makeProduct(M.sp, 0.15 + 0.85 * avg); S.stock.push(p); M.last = p; save(); setTimeout(() => sfx.pop(), 350); renderHotbar(true); renderQuest(); }
  else nextStep();
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
    <button class="btn big" style="width:100%" data-act="stopBar">停機${TOUCH ? '' : '（空白鍵）'}</button>`;
  } else mini.innerHTML = `<div class="row"><div class="grow small">${M.sp ? `已選：<b>${SP[M.sp].name}</b>　消耗 2 凝膠` : '請先選擇要加工的凝膠'}<br><span style="color:var(--sub)">庫存 ${S.stock.length}/${cap()}</span></div><button class="btn" data-act="startMake" ${!M.sp || (S.gel[M.sp] || 0) < 2 ? 'disabled' : ''}>啟動產線</button></div>`;
  const r = $('#makeResult');
  if (M.last && !M.active) { const p = M.last, pct = Math.round(p.crisp * 100); r.innerHTML = `<div class="card item" style="cursor:default"><div class="sw" style="background:${swatch(SP[p.sp])};width:52px;height:52px"></div><div class="grow"><b>${SP[p.sp].name} · 酥脆捏捏</b><br>酥脆度 <b style="color:var(--warn)">${pct}%</b>　${pct >= 90 ? '極品' : pct >= 70 ? '優良' : '再接再厲'}<br><small style="color:var(--sub)">已放入背包。可拿到裝飾桌加工，或到直播台販售。</small></div></div>`; }
  else r.innerHTML = '';
}

/* ---------- 庫存卡片 ---------- */
function itemHTML(p, act, selId, extra = '') {
  const sp = SP[p.sp];
  return `<div class="card item ${selId === p.id ? 'sel' : ''}" data-act="${act}" data-id="${p.id}"><div class="sw" style="background:${swatch(sp)}"></div><div><div class="nm">${short(p.sp)}</div><div class="meta">酥脆 ${Math.round(effCrisp(p) * 100)}% · 耐久 ${Math.round(p.dur)}%</div><div class="meta">${p.deco.length ? '裝飾 ' + p.deco.length : '無裝飾'} · 約 ${fmt(fair(p, 'live'))}${extra}</div></div></div>`;
}
const stockById = id => S.stock.find(p => p.id === +id);

/* ---------- 裝飾 ---------- */
const decorSt = makeStage($('#decorCv'), 'decor'); const D = { id: null };
decorSt.onSel = () => renderDecorTools();
function renderDecor() {
  const p = stockById(D.id) || null; if (!p) D.id = null; decorSt.set(p); setTimeout(decorSt.resize, 0);
  $('#decorStock').innerHTML = S.stock.length ? S.stock.map(q => itemHTML(q, 'decoSel', D.id)).join('') : '<div class="empty">背包裡沒有捏捏，先到加工產線做一個吧。</div>';
  renderDecorTools();
}
function renderDecorTools() {
  const p = decorSt.p, b = $('#decoTools');
  if (!p) { b.innerHTML = '<div class="empty">選擇捏捏後即可擺放裝飾零件（拖曳零件移動、拖曳空白處旋轉）。</div>'; return; }
  const pal = Object.keys(DECO).map(k => `<button data-act="addDeco" data-k="${k}" ${S.packs.includes(DECO[k].pack) ? '' : 'disabled title="到工作電腦的升級頁解鎖"'}>${dot(DECO[k].c)}${DECO[k].n}</button>`).join('');
  const d = p.deco[decorSt.sel];
  b.innerHTML = `<div class="small">裝飾 ${p.deco.length}/6　加成 <b style="color:var(--warn)">+${Math.round(decoBonus(p) * 100)}%</b> 售價與人氣</div><div class="pal">${pal}</div>` +
    (d ? `<div class="small">縮放</div><input type="range" min="0.5" max="2" step="0.05" value="${d.s}" data-r="s"><div class="small">旋轉</div><input type="range" min="-3.14" max="3.14" step="0.05" value="${d.r}" data-r="r"><div class="row" style="margin-top:6px"><button class="btn sm red" data-act="delDeco">移除此零件</button></div>` : '<div class="hint">點選捏捏上的零件可調整大小、旋轉或移除。</div>') +
    `<div class="row" style="margin-top:6px"><button class="btn sm ghost" data-act="photo">拍照（下載圖片）</button></div>`;
}
document.addEventListener('input', e => { const r = e.target.dataset && e.target.dataset.r; if (!r) return; const p = decorSt.p; if (!p) return; const d = p.deco[decorSt.sel]; if (d) d[r] = +e.target.value; });

/* ---------- 直播 ---------- */
const liveSt = makeStage($('#liveCv'), 'squeeze');
const L = { on: false, hype: 0, viewers: 0, combo: 0, lastC: 0, stageId: null, saleT: 0, req: null, reqT: 18, chatT: 0 };
function chat(who, txt, cls) {
  const bx = $('#chat'), d = document.createElement('div'); d.innerHTML = `<b>${esc(who)}</b>：${esc(txt)}`; bx.appendChild(d); while (bx.children.length > 40) bx.firstChild.remove(); bx.scrollTop = bx.scrollHeight;
  if (tab === 'live' && (Math.random() < 0.45 || cls === 'dm')) { const dm = document.createElement('div'); dm.className = 'dmk'; dm.textContent = txt; dm.style.top = rnd(0, 75) + '%'; dm.style.color = pick(['#fff', '#fbbf24', '#22d3ee', '#e879f9']); $('#danmaku').appendChild(dm); setTimeout(() => dm.remove(), 7200); }
}
liveSt.onCrunch = () => {
  if (!L.on) return; const now = performance.now(); L.combo = now - L.lastC < 1200 ? L.combo + 1 : 1; L.lastC = now; L.hype = Math.min(100, L.hype + 5 + Math.min(L.combo, 20) * .4);
  if (Math.random() < .4) chat(pick(NAMES), pick(CHAT_CRUNCH));
  if (Math.random() < .05 * clamp(L.viewers / 30, .3, 2)) { const n = Math.round(rnd(5, 30) * (1 + L.combo / 10)); addMoney(n); S.fans += 0.3; sfx.tick(); const e = document.createElement('div'); e.className = 'don'; e.textContent = `${pick(NAMES)} 斗內 ${fmt(n)}`; $('#donate').appendChild(e); setTimeout(() => e.remove(), 3000); while ($('#donate').children.length > 3) $('#donate').firstChild.remove(); }
  renderTop();
};
function renderLive() {
  if (L.stageId && !stockById(L.stageId)) L.stageId = null; liveSt.set(stockById(L.stageId) || null); setTimeout(liveSt.resize, 0);
  $('#liveStock').innerHTML = S.stock.length ? S.stock.map(q => itemHTML(q, 'stageSel', L.stageId)).join('') : '<div class="empty">背包裡沒有捏捏，先到加工產線做一個。</div>';
  $('#livePrice').innerHTML = priceTable('live'); $('#btnLive').textContent = L.on ? '結束直播' : '開始直播'; updateLiveHUD();
}
function updateLiveHUD() {
  $('#liveBadge').textContent = L.on ? 'LIVE' : 'OFF AIR'; $('#liveBadge').className = 'badge' + (L.on ? ' on' : '');
  $('#liveViewers').textContent = Math.round(L.viewers) + ' 觀眾'; $('#hypeBar').style.width = L.hype + '%'; $('#comboTxt').textContent = L.combo > 2 && L.on ? `${L.combo} 連擊` : '';
  const p = liveSt.p;
  $('#stageInfo').innerHTML = p ? `上台：<b>${SP[p.sp].name}</b>　酥脆 ${Math.round(effCrisp(p) * 100)}%　耐久 ${Math.round(p.dur)}%<br>售價 <b>${fmt(getPrice('live', p.sp))}</b>（合理價 ${fmt(fair(p, 'live'))}）` : '從下方選一個捏捏上台，按住它擠壓、滑動連續捏';
  $('#reqBox').innerHTML = L.req && L.on ? `<span class="reqb">觀眾指定：${L.req.text}　剩 ${Math.ceil(L.req.t)}s　（成交 ×1.8）</span>` : '';
}
function reqMatch(p) { return L.req && (L.req.kind === 'sp' ? p.sp === L.req.sp : effCrisp(p) >= .7); }
function liveSale(p) {
  let price = getPrice('live', p.sp), bonus = 1;
  if (reqMatch(p)) { bonus = 1.8; L.req = null; S.fans += 3; chat('系統', '指定任務完成！限時銷售成交！', 'dm'); }
  const gain = price * bonus; addMoney(gain); S.sales++; S.fans += 1 + L.hype / 30; S.stock = S.stock.filter(q => q !== p); sfx.pop();
  chat(pick(NAMES), `買了${short(p.sp)}捏捏！${fmt(gain)}`, 'dm'); toast(`直播成交 +${fmt(gain)}`);
  const next = S.stock.slice().sort((a, b) => (reqMatch(b) - reqMatch(a)) || (effCrisp(b) - effCrisp(a)))[0]; L.stageId = next ? next.id : null;
  if (tab === 'live') renderLive(); renderTop(); renderHotbar(); save();
}
function updateLive(dt) {
  const p = stockById(L.stageId);
  if (L.on) {
    L.hype = Math.max(0, L.hype - 3 * dt); if (performance.now() - L.lastC > 1500) L.combo = 0;
    const tgt = (12 + S.fans * 0.8) * (1 + .15 * S.up.gear) * (.4 + L.hype / 60) * (p ? 1 : .5); L.viewers += (tgt - L.viewers) * dt * .8; L.saleT += dt;
    if (L.saleT >= 1.5) { L.saleT = 0; if (p) { const f = fair(p, 'live'), d0 = demand(getPrice('live', p.sp), f), d = d0 * (reqMatch(p) ? 1.6 : 1); if (d0 < .2 && Math.random() < .3) chat(pick(NAMES), pick(CHAT_EXPENSIVE)); if (Math.random() < clamp(L.viewers / 60, 0, 1) * d * .45 * (.4 + L.hype / 80)) liveSale(p); } }
    L.chatT -= dt; if (L.chatT <= 0) { L.chatT = rnd(1.5, 4) / clamp(L.viewers / 20, .5, 4); chat(pick(NAMES), pick(CHAT_IDLE)); }
    if (L.req) { L.req.t -= dt; if (L.req.t <= 0) { L.req = null; chat('系統', '指定任務已結束', 'dm'); } }
    else { L.reqT -= dt; if (L.reqT <= 0) { L.reqT = rnd(25, 40); if (Math.random() < .6) { const sp = pick(unlockedSpecies()); L.req = { kind: 'sp', sp: sp.id, t: 40, text: `要「${sp.name}」` }; } else L.req = { kind: 'cr', t: 40, text: '要酥脆度 ≥ 70% 的' }; chat('系統', '新的觀眾指定：' + L.req.text, 'dm'); } }
  } else { L.hype = Math.max(0, L.hype - 10 * dt); L.viewers = Math.max(0, L.viewers - dt * 10); L.combo = 0; L.req = null; }
}

/* ---------- 定價 ---------- */
function priceTable(ch) {
  const list = SPECIES.filter(s => S.codex[s.id]); if (!list.length) return '<div class="empty">尚未收集任何史萊姆。</div>';
  return list.map(s => { const f = fair({ sp: s.id, crisp: .8, dur: 100, deco: [] }, ch), l = demandLabel(demand(getPrice(ch, s.id), f));
    return `<div class="prow"><span class="nm">${dot(s.color)}${s.name}${trend.sp === s.id ? ' <span class="tag">流行</span>' : ''}<br><small style="color:var(--sub)">基準合理價 ${fmt(f)}</small></span><input type="number" min="1" max="99999" value="${getPrice(ch, s.id)}" data-price="${ch}" data-sp="${s.id}"><span class="dem" style="color:${l[1]}">${l[0]}</span></div>`; }).join('');
}
document.addEventListener('change', e => { const t = e.target; if (!t.dataset || !t.dataset.price) return; S.price[t.dataset.price][t.dataset.sp] = clamp(Math.round(+t.value) || 1, 1, 99999); save(); t.dataset.price === 'live' ? renderLive() : renderWeb(); });

/* ---------- 網站 ---------- */
const rating = () => { const a = S.rate.slice(-20); return a.reduce((x, y) => x + y, 0) / a.length; };
function webTick() {
  if (!S.web.length || Math.random() > clamp(0.25 + S.fans / 400 + (rating() - 3) * .1, .05, .9)) return null;
  const p = pick(S.web), f = fair(p, 'web'), price = getPrice('web', p.sp); if (Math.random() > demand(price, f) * .7) return null;
  addMoney(price); S.sales++; S.fans += .3; S.web = S.web.filter(q => q !== p);
  const stars = clamp(Math.round(1 + 2.2 * effCrisp(p) + 1.8 * clamp(f / price, 0, 1.3)), 1, 5); S.rate.push(stars); if (S.rate.length > 40) S.rate.shift();
  S.reviews.unshift({ s: stars, t: pick(REVIEWS[stars]), who: pick(NAMES), sp: SP[p.sp].name }); S.reviews.length = Math.min(S.reviews.length, 8); return { price, stars };
}
function renderWeb() {
  const r = rating();
  $('#webInfo').innerHTML = `<div class="row"><div class="grow">店鋪評分 <b class="stars">${'★'.repeat(Math.round(r))}${'☆'.repeat(5 - Math.round(r))}</b> ${r.toFixed(1)}　粉絲 ${Math.floor(S.fans)}</div><div class="small">貨架 ${S.web.length}/${slots()}</div></div>`;
  $('#webShelf').innerHTML = S.web.length ? S.web.map(p => itemHTML(p, 'unlist', null, ` · 售 ${fmt(getPrice('web', p.sp))}`)).join('') : '<div class="empty">貨架空空如也，從下方上架商品。</div>';
  $('#webStock').innerHTML = S.stock.length ? S.stock.map(p => itemHTML(p, 'list', null)).join('') : '<div class="empty">背包裡沒有捏捏。</div>';
  $('#webPrice').innerHTML = priceTable('web');
  $('#reviews').innerHTML = S.reviews.length ? S.reviews.map(v => `<div><span class="stars">${'★'.repeat(v.s)}</span> ${esc(v.who)}：${esc(v.t)} <small style="color:var(--sub)">（${v.sp}）</small></div>`).join('') : '尚無評價';
}

/* ---------- 升級 ---------- */
const upCost = k => Math.round(UPS[k].base * Math.pow(1.7, S.up[k]));
const lvBar = (lv, max) => `<span class="lv">${Array.from({ length: max }, (_, j) => `<i class="${j < lv ? 'on' : ''}"></i>`).join('')}</span>`;
function renderUp() {
  const row = k => { const u = UPS[k], lv = S.up[k], max = lv >= u.max; return `<div class="card up"><div class="info"><b>${u.name}</b>${lvBar(lv, u.max)}<div class="small" style="color:var(--sub)">${u.desc}</div></div><button class="btn sm" data-act="buyUp" data-k="${k}" ${max || S.money < upCost(k) ? 'disabled' : ''}>${max ? '已滿級' : fmt(upCost(k))}</button></div>`; };
  let h = '<h3>產線機器</h3>' + Object.keys(UPS).filter(k => UPS[k].mach).map(row).join('') + '<h3>設施與裝備</h3>' + Object.keys(UPS).filter(k => !UPS[k].mach).map(row).join('');
  h += '<h3>裝飾零件包</h3>' + Object.keys(PACKS).map(k => { const has = S.packs.includes(k), pk = PACKS[k], items = Object.values(DECO).filter(d => d.pack === k).map(d => dot(d.c) + d.n).join('　'); return `<div class="card up"><div class="info"><b>${pk.name}</b><div class="small" style="color:var(--sub)">${items}</div></div><button class="btn sm" data-act="buyPack" data-k="${k}" ${has || S.money < pk.cost ? 'disabled' : ''}>${has ? '已擁有' : fmt(pk.cost)}</button></div>`; }).join('');
  $('#upList').innerHTML = h;
}

/* ---------- 中期三線 ---------- */
const BT = { fac: 0, ct: 0, sc: 0 };
const branchReady = () => !S.branch && S.earned >= 2500 && S.fans >= 60;
function checkBranch() {
  if (branchReady() && !S.seen_branch) { S.seen_branch = true; modal(`<h2>工坊的轉捩點</h2><p>你的捏捏已經小有名氣，累積營收 ${fmt(S.earned)}、粉絲 ${Math.floor(S.fans)}。<br>三條道路擺在眼前，玩法與劇情都不同（一旦選擇就無法更改）：</p><p>${Object.values(BRANCHES).map(b => `<b>${b.name}</b>：${b.desc}`).join('<br><br>')}</p><p>到工坊的「工作電腦 → 事業」做出選擇。</p>`); }
}
function renderBranch() {
  const bx = $('#branchBody'), fw = $('#facWrap'), showFac = S.branch === 'factory';
  if (fw.hidden === showFac) { fw.hidden = !showFac; if (showFac) setTimeout(() => { initFac(); FAC.v && FAC.v.resize(); }, 0); }
  if (!S.branch) { bx.innerHTML = `<h2>選擇你的事業道路</h2><div class="bgroup">${Object.keys(BRANCHES).map(k => `<div class="card"><b>${BRANCHES[k].name}</b><div class="small" style="color:var(--sub);margin:6px 0">${BRANCHES[k].desc}</div><button class="btn" data-act="chooseBranch" data-k="${k}" ${branchReady() ? '' : 'disabled'}>選擇此道路</button></div>`).join('')}</div>${branchReady() ? '' : '<div class="hint">需要累積營收 ¥2,500 且粉絲 60 才能做出選擇。</div>'}`; return; }
  if (S.branch === 'factory') {
    const hc = Math.round(400 * Math.pow(1.5, S.workers)), ac = Math.round(600 * Math.pow(1.8, S.auto));
    bx.innerHTML = `<h2>自家工廠</h2><div class="hint">每位員工操作一台機械手臂，每 12 秒自動消耗 2 凝膠製作 1 個捏捏（品質取決於自動化等級），並持續領薪（每人 ¥3/分鐘）。凝膠不足或庫存滿時停工。</div>
    <div class="card"><div>員工／機械手臂 <b>${S.workers}</b>　薪資 ${fmt(S.workers * 3)}/分<br>自動化 Lv${S.auto}（品質 ${Math.round((0.55 + 0.05 * S.auto) * 100)}%）</div><div class="row wrap" style="margin-top:8px"><button class="btn sm" data-act="hire" ${S.money < hc || S.workers >= 12 ? 'disabled' : ''}>增設手臂並雇用 ${fmt(hc)}</button><button class="btn sm ghost" data-act="auto" ${S.money < ac || S.auto >= 8 ? 'disabled' : ''}>升級自動化 ${fmt(ac)}</button></div></div>
    <div class="card small">庫存 ${S.stock.length}/${cap()}　凝膠合計 ${Object.values(S.gel).reduce((a, b) => a + b, 0)}</div>`;
  } else if (S.branch === 'corp') {
    bx.innerHTML = `<h2>企業合作</h2><div class="hint">大公司定期釋出訂單，報酬約為合理價 ×1.5，但需在期限內交付足夠品質的商品。逾期會損失信譽。</div><div class="card small">企業信譽 <b>${S.rep}</b>　承接中 ${S.contracts.length}/3</div>` +
      (S.contracts.length ? S.contracts.map(c => { const ok = contractItems(c); return `<div class="card"><b>${c.sp === 'any' ? '任意種類' : SP[c.sp].name}</b> × ${c.n}　酥脆 ≥ ${Math.round(c.min * 100)}%<br>報酬 <b style="color:var(--warn)">${fmt(c.reward)}</b>　剩餘 ${Math.max(0, Math.ceil((c.dl - Date.now()) / 1000))} 秒<div class="row" style="margin-top:6px"><span class="small grow">符合庫存 ${ok.length}/${c.n}</span><button class="btn sm" data-act="deliver" data-id="${c.id}" ${ok.length < c.n ? 'disabled' : ''}>交貨</button></div></div>`; }).join('') : '<div class="empty">目前沒有訂單，請稍候…</div>');
  } else {
    bx.innerHTML = `<h2>溫馨小店</h2><div class="hint">顧客會上門指定想要的種類。滿足熟客可累積好感度，熟客會給更高價與小費。顧客等太久會失望離開。</div><div class="card small">熟客 ${Object.values(S.regulars).filter(v => v >= 5).length} 位（好感 ≥ 5）</div>` +
      (S.customers.length ? S.customers.map(c => { const ok = shopItem(c), aff = S.regulars[c.name] || 0; return `<div class="card"><b>${esc(c.name)}</b> ${aff >= 5 ? '<span class="tag">熟客</span>' : ''} <small style="color:var(--sub)">好感 ${aff}</small><br>想要：<b>${SP[c.sp].name}</b>　酥脆 ≥ ${Math.round(c.min * 100)}%<div class="meter2" style="margin:6px 0"><i style="width:${clamp((c.dl - Date.now()) / 450, 0, 100)}%"></i></div><button class="btn sm" data-act="serve" data-id="${c.id}" ${ok ? '' : 'disabled'}>${ok ? `出貨 ${fmt(shopPrice(c, ok))}` : '背包沒有符合商品'}</button></div>`; }).join('') : '<div class="empty">店裡暫時沒有客人…</div>');
  }
}
function contractItems(c) { return S.stock.filter(p => (c.sp === 'any' || p.sp === c.sp) && effCrisp(p) >= c.min).sort((a, b) => effCrisp(a) - effCrisp(b)).slice(0, c.n); }
function shopItem(c) { return S.stock.filter(p => p.sp === c.sp && effCrisp(p) >= c.min).sort((a, b) => effCrisp(a) - effCrisp(b))[0]; }
function shopPrice(c, p) { return fair(p, 'shop') * (1 + Math.min(S.regulars[c.name] || 0, 10) * .02); }
function branchTick(dt) {
  if (S.branch === 'factory' && S.workers > 0) {
    if (S.money > 0) S.money = Math.max(0, S.money - S.workers * .05 * dt); BT.fac += dt * S.workers / 12;
    while (BT.fac >= 1) { BT.fac -= 1; if (S.stock.length >= cap()) break; const sp = Object.keys(S.gel).filter(k => S.gel[k] >= 2).sort((a, b) => S.gel[b] - S.gel[a])[0]; if (!sp) break; S.gel[sp] -= 2; S.stock.push(makeProduct(sp, clamp(0.55 + 0.05 * S.auto + rnd(-.05, .05), .2, 1))); }
    FAC.working = S.stock.length < cap() && Object.values(S.gel).some(v => v >= 2);
  }
  if (S.branch === 'corp') {
    const now = Date.now(); S.contracts = S.contracts.filter(c => { if (now > c.dl) { S.rep = Math.max(0, S.rep - 1); toast('訂單逾期，企業信譽 -1'); return false; } return true; }); BT.ct += dt;
    if (BT.ct > 20 && S.contracts.length < 3) { BT.ct = 0; const us = unlockedSpecies(), n = 2 + Math.floor(Math.random() * 3), any = Math.random() < .4, sp = any ? 'any' : pick(us).id, min = clamp(.35 + .05 * S.rep + rnd(0, .15), .3, .9), base = any ? us.reduce((a, s) => a + s.price, 0) / us.length : SP[sp].price; S.contracts.push({ id: S.nextId++, sp, n, min, reward: Math.round(n * base * (0.4 + 1.1 * (min + .1)) * 1.5 * (1 + S.rep * .05)), dl: now + 240000 }); toast('收到新的企業訂單（工作電腦 → 事業）'); }
  }
  if (S.branch === 'shop') {
    const now = Date.now(); S.customers = S.customers.filter(c => { if (now > c.dl) { S.regulars[c.name] = Math.max(0, (S.regulars[c.name] || 0) - 1); toast(`${c.name} 等太久離開了`); return false; } return true; }); BT.sc += dt;
    if (BT.sc > 10 && S.customers.length < 3) { BT.sc = 0; const reg = Object.keys(S.regulars).filter(k => S.regulars[k] >= 3), name = reg.length && Math.random() < .5 ? pick(reg) : pick(REG_NAMES); if (!S.customers.some(c => c.name === name)) { S.customers.push({ id: S.nextId++, name, sp: pick(unlockedSpecies()).id, min: rnd(.3, .7), dl: now + 45000 }); toast(`${name} 來店了（工作電腦 → 事業）`); } }
  }
}
const FAC = { v: null, built: -1, arms: [], blocks: [], t: 0, working: false };
function initFac() {
  if (FAC.v) return; try { FAC.v = makeView($('#facCv'), '#0b1220', 36); } catch (e) { return; }
  const sc = FAC.v.scene; basicLights(sc); sc.fog = new THREE.Fog('#0b1220', 18, 40); FAC.v.cam.position.set(0, 5.5, 10.5); FAC.v.cam.lookAt(0, .8, 0);
  const fl = mesh(new THREE.PlaneGeometry(60, 30), std('#0f172a', { roughness: .4, metalness: .5 }), 0, 0, 0, sc); fl.rotation.x = -Math.PI / 2;
  const grid = new THREE.GridHelper(40, 40, '#1e293b', '#152033'); grid.position.y = .005; sc.add(grid);
  const dark = std('#1e293b', { metalness: .7, roughness: .35 }); box(18, .35, 1.6, dark, 0, .45, 1, sc); box(18, .06, 1.4, std('#0b0f17'), 0, .65, 1, sc);
  FAC.mats = SPECIES.map(s => new THREE.MeshPhysicalMaterial({ color: s.color, roughness: .15, clearcoat: 1 }));
  for (let i = 0; i < 12; i++) FAC.blocks.push(box(.42, .42, .42, FAC.mats[i % 3], -9 + i * 1.5, .9, 1, sc));
  FAC.root = new THREE.Group(); sc.add(FAC.root);
}
function buildFac() {
  const n = Math.min(S.workers, 12); FAC.built = S.workers; FAC.root.children.slice().forEach(c => { FAC.root.remove(c); disposeTree(c); }); FAC.arms = [];
  const dark = std('#1e293b', { metalness: .7, roughness: .35 }), orange = std('#f97316', { metalness: .4, roughness: .35 }), steel = std('#94a3b8', { metalness: .9, roughness: .2 });
  for (let i = 0; i < n; i++) {
    const x = -7.5 + (n > 1 ? i * 15 / (n - 1) : 7.5), g = new THREE.Group(); g.position.set(x, 0, -.6); FAC.root.add(g); cyl(.4, .5, .3, 20, dark, 0, .15, 0, g);
    const yaw = new THREE.Group(); yaw.position.y = .3; g.add(yaw); cyl(.18, .22, .8, 16, orange, 0, .4, 0, yaw);
    const sh = new THREE.Group(); sh.position.y = .85; yaw.add(sh); mesh(new THREE.SphereGeometry(.2, 16, 12), steel, 0, 0, 0, sh); box(.18, 1.2, .18, orange, 0, .6, 0, sh);
    const el = new THREE.Group(); el.position.y = 1.2; sh.add(el); mesh(new THREE.SphereGeometry(.15, 14, 10), steel, 0, 0, 0, el); box(.14, .9, .14, orange, 0, .45, 0, el); box(.3, .08, .3, steel, 0, .92, 0, el);
    FAC.arms.push({ yaw, sh, el, led: mesh(new THREE.SphereGeometry(.08, 10, 8), new THREE.MeshBasicMaterial({ color: '#34d399' }), .35, .35, .3, g), ph: i * .7 });
  }
}
function facStep(dt) {
  if (!FAC.v) return; if (FAC.built !== S.workers) buildFac(); FAC.t += dt; const t = FAC.t, w = FAC.working;
  FAC.arms.forEach(a => { const k = w ? 1 : .1; a.yaw.rotation.y = Math.sin(t * 1.5 * k + a.ph) * .9; a.sh.rotation.x = .5 + Math.sin(t * 2 * k + a.ph) * .35; a.el.rotation.x = .9 + Math.cos(t * 2 * k + a.ph) * .4; a.led.material.color.set(w ? '#34d399' : (Math.sin(t * 4) > 0 ? '#fbbf24' : '#78350f')); });
  FAC.blocks.forEach((b, i) => { b.visible = S.workers > 0; b.position.x += dt * (w ? 1.2 : 0); if (b.position.x > 9) { b.position.x -= 18; b.material = FAC.mats[(i + Math.floor(t)) % FAC.mats.length]; } b.rotation.y += dt * (w ? 1 : 0); });
  FAC.v.cam.position.x = Math.sin(t * .2) * 1.5; FAC.v.cam.lookAt(0, .8, 0); FAC.v.render();
}
function chooseBranch(k) { S.branch = k; save(); renderGuiTabs(); renderBranch(); toast('已選擇：' + BRANCHES[k].name); }

/* ---------- 圖鑑 / 背包 ---------- */
const GOAL = { species: 8, fans: 800, earned: 40000 };
function renderCodex() {
  const made = SPECIES.filter(s => S.codex[s.id] && S.codex[s.id].made > 0).length, g = [['製作過所有種類', made, GOAL.species], ['粉絲數', Math.floor(S.fans), GOAL.fans], ['累積營收', Math.floor(S.earned), GOAL.earned]], ok = g.every(x => x[1] >= x[2]);
  let h = `<div class="card"><b>終局目標：開設「夢想捏捏博物館」</b><div class="small" style="color:var(--sub);margin:4px 0 8px">探索月光谷的所有區域，讓全世界都聽見史萊姆的酥脆聲。</div>` + g.map(x => `<div class="small">${x[0]}　${x[1].toLocaleString()} / ${x[2].toLocaleString()}</div><div class="meter2" style="margin:3px 0 7px"><i style="width:${clamp(x[1] / x[2] * 100, 0, 100)}%"></i></div>`).join('') + `<button class="btn" data-act="finish" ${ok && !S.done ? '' : 'disabled'}>${S.done ? '已達成' : '完成夢想'}</button></div><h3>史萊姆圖鑑</h3><div class="grid">`;
  h += SPECIES.map(s => { const c = S.codex[s.id]; return `<div class="card item" style="cursor:default"><div class="sw" style="background:${c ? swatch(s) : '#1e293b'}"></div><div><div class="nm">${c ? s.name : '？？？'}</div><div class="meta">${ZONES.find(z => z.id === s.zone).name} · <span style="color:${RAR[s.rar].c}">${RAR[s.rar].n}</span></div><div class="meta">${c ? `已製作 ${c.made} 個` : (S.zones.includes(s.zone) ? '尚未發現' : '區域未開放')}</div></div></div>`; }).join('') + '</div>';
  $('#codexBody').innerHTML = h;
}
function finish() { S.done = true; save(); const txt = { factory: '你的工廠日夜運轉，月光谷的酥脆聲成為了全世界的背景音樂。', corp: '你與大企業攜手，把史萊姆捏捏帶進每個人的辦公桌，成為解壓文化的代名詞。', shop: '你的小店成了鎮上的溫暖角落，熟客們帶著笑容與酥脆聲度過每個日子。' }[S.branch || 'shop']; modal(`<h2>夢想捏捏博物館開幕</h2><p>${txt}</p><p>你是真正的史萊姆捏捏大師。你可以繼續遊玩，享受酥脆的療癒時光。</p>`); }
let invSel = null;
function renderInv() {
  const items = invItems(), n = Math.max(27, Math.ceil(items.length / 9) * 9);
  $('#invGrid').innerHTML = Array.from({ length: n }, (_, i) => slotHTML(items[i], i, i === S.hb)).join('');
  const it = items[invSel ?? S.hb];
  $('#invInfo').innerHTML = it ? (it.t === 'gel' ? `<b>${SP[it.sp].name}凝膠</b> × ${it.n}<br><span style="color:var(--sub)">帶到工坊的加工產線，每 2 份可做成 1 個酥脆捏捏。</span>` : `<b>${SP[it.p.sp].name} · 酥脆捏捏</b><br>酥脆 ${Math.round(effCrisp(it.p) * 100)}% · 耐久 ${Math.round(it.p.dur)}% · 裝飾 ${it.p.deco.length} · 合理價約 ${fmt(fair(it.p, 'live'))}<br><span style="color:var(--sub)">可到裝飾桌加上零件，或到直播台／工作電腦販售。</span>`) + `<div class="small" style="margin-top:6px;color:var(--sub)">點擊格子可放到快捷列第 ${S.hb + 1} 格選取。</div>` : `<span style="color:var(--sub)">背包：凝膠與捏捏都會顯示在這裡。庫存 ${S.stock.length}/${cap()}</span>`;
  renderQuest();
}
const RENDER = { make: renderMake, decor: renderDecor, live: renderLive, web: renderWeb, up: renderUp, branch: renderBranch, codex: renderCodex, inv: renderInv, pause: renderTop };

/* ---------- 點擊事件 ---------- */
document.addEventListener('click', e => {
  const el = e.target.closest('[data-act]'); if (!el) return; const a = el.dataset.act, id = el.dataset.id, k = el.dataset.k;
  try { audio(); } catch (_) { }
  switch (a) {
    case 'sec': showSec(el.dataset.sec); break;
    case 'closeGui': closeGui(); break;
    case 'inv': GUI.kind === 'inv' ? closeGui() : openGui('inv'); break;
    case 'pause': GUI.kind === 'pause' ? closeGui() : openGui('pause'); break;
    case 'hb': { const i = +el.dataset.i; if (GUI.kind === 'inv') { invSel = i; if (i < 9) S.hb = i; renderInv(); } else S.hb = i; renderHotbar(true); break; }
    case 'pickSp': M.sp = id; M.last = null; renderMake(); break;
    case 'startMake': startMake(); break;
    case 'stopBar': stopBar(); break;
    case 'decoSel': D.id = +id; renderDecor(); break;
    case 'addDeco': { const p = decorSt.p; if (!p) return; if (p.deco.length >= 6) return toast('最多 6 個零件'); p.deco.push({ k, x: rnd(-.45, .45), z: rnd(-.45, .45), s: 1, r: 0 }); decorSt.sel = p.deco.length - 1; decorSt.rebuildDeco(); sfx.tick(); renderDecorTools(); save(); break; }
    case 'delDeco': { const p = decorSt.p; if (p && decorSt.sel >= 0) { p.deco.splice(decorSt.sel, 1); decorSt.sel = -1; decorSt.rebuildDeco(); renderDecorTools(); save(); } break; }
    case 'photo': { if (!decorSt.ready) return; decorSt.selRing.visible = false; decorSt.v.render(); const a2 = document.createElement('a'); a2.download = 'squish-lab.png'; a2.href = decorSt.cv.toDataURL('image/png'); a2.click(); toast('已儲存圖片'); break; }
    case 'toggleLive': L.on = !L.on; if (L.on) { chat('系統', '直播開始！歡迎大家', 'dm'); if (!liveSt.p) toast('先從下方選一個捏捏上台'); } else toast('直播結束'); renderLive(); break;
    case 'stageSel': L.stageId = +id; renderLive(); break;
    case 'list': { const p = stockById(id); if (!p) return; if (S.web.length >= slots()) return toast('貨架已滿，請升級網站伺服器'); S.stock = S.stock.filter(q => q !== p); S.web.push(p); renderWeb(); renderHotbar(); save(); break; }
    case 'unlist': { const p = S.web.find(q => q.id === +id); if (!p) return; if (S.stock.length >= cap()) return toast('庫存已滿'); S.web = S.web.filter(q => q !== p); S.stock.push(p); renderWeb(); renderHotbar(); save(); break; }
    case 'buyUp': { const c = upCost(k); if (S.money < c || S.up[k] >= UPS[k].max) return; S.money -= c; S.up[k]++; sfx.pop(); renderUp(); renderTop(); save(); break; }
    case 'buyPack': { const c = PACKS[k].cost; if (S.money < c) return; S.money -= c; S.packs.push(k); sfx.pop(); renderUp(); renderTop(); save(); break; }
    case 'chooseBranch': chooseBranch(k); break;
    case 'hire': { const c = Math.round(400 * Math.pow(1.5, S.workers)); if (S.money >= c) { S.money -= c; S.workers++; renderBranch(); renderTop(); save(); } break; }
    case 'auto': { const c = Math.round(600 * Math.pow(1.8, S.auto)); if (S.money >= c) { S.money -= c; S.auto++; renderBranch(); renderTop(); save(); } break; }
    case 'deliver': { const c = S.contracts.find(x => x.id === +id); if (!c) return; const it = contractItems(c); if (it.length < c.n) return; S.stock = S.stock.filter(p => !it.includes(p)); S.contracts = S.contracts.filter(x => x !== c); addMoney(c.reward); S.rep++; S.fans += 2; sfx.pop(); toast(`交貨完成 +${fmt(c.reward)}`); refresh(); save(); break; }
    case 'serve': { const c = S.customers.find(x => x.id === +id); if (!c) return; const p = shopItem(c); if (!p) return; const pr = shopPrice(c, p), aff = S.regulars[c.name] || 0, tip = aff >= 5 ? Math.round(pr * .15) : 0; S.stock = S.stock.filter(q => q !== p); S.customers = S.customers.filter(x => x !== c); S.regulars[c.name] = aff + 1; addMoney(pr + tip); S.fans += 1; sfx.pop(); toast(`${c.name} 滿意離開 +${fmt(pr + tip)}${tip ? '（含小費）' : ''}`); refresh(); save(); break; }
    case 'finish': finish(); break;
    case 'sound': S.sound = !S.sound; renderTop(); save(); break;
    case 'sens': S.sens = (S.sens + 1) % 3; renderTop(); save(); break;
    case 'help': showHelp(); break;
    case 'home': P.x = 0; P.z = 31; P.y = G(0, 31); P.yaw = 0; closeGui(); toast('已傳送回工坊入口'); break;
    case 'reset': modal('<h2>重置存檔？</h2><p>所有進度將被清除，無法復原。</p>', [{ t: '取消', ghost: true }, { t: '確定重置', f: () => { localStorage.removeItem(SAVE_KEY); S = fresh(); P = null; location.reload(); } }]); break;
  }
});
function showHelp() {
  const keys = TOUCH
    ? '<div class="keys"><kbd>左下</kbd><span>拖曳虛擬搖桿移動</span><kbd>右側</kbd><span>滑動轉動視角，輕點物件即可互動</span><kbd>手掌</kbd><span>對準準心的物件互動（採集、使用工作站）</span><kbd>箭頭</kbd><span>跳躍</span><kbd>閃電</kbd><span>切換奔跑</span><kbd>右上</kbd><span>背包、選單</span></div>'
    : '<div class="keys"><kbd>WASD</kbd><span>移動</span><kbd>滑鼠</kbd><span>環顧四周（點擊畫面鎖定滑鼠）</span><kbd>E / 左鍵</kbd><span>互動：採集史萊姆、使用工作站、調查線索</span><kbd>空白鍵</kbd><span>跳躍（加工時為停機）</span><kbd>Shift</kbd><span>奔跑</span><kbd>1–9 / 滾輪</kbd><span>選擇快捷列</span><kbd>I / Tab</kbd><span>背包與探索日誌</span><kbd>Esc</kbd><span>關閉介面／選單</span></div>';
  modal(`<h2>操作說明</h2>${keys}<p class="small" style="color:var(--sub);margin-top:10px">遊戲循環：採集凝膠 → 工坊加工 → 裝飾 → 直播或網站販售 → 升級。山脊上的能量門要解開前一區的謎題才會開啟。</p>`);
}
function showIntro() {
  S.seen = true; save();
  modal(`<h2>歡迎來到月光谷</h2><p>月光谷的史萊姆誕生於月光與露水交融之處。你繼承了奶奶留下的捏捏工坊，要把史萊姆的可再生凝膠，做成世上最療癒的酥脆捏捏。</p>
  <p><b>怎麼玩</b>：在森林裡自由走動，對準史萊姆採集凝膠；回到中央的工坊，走到工作站前使用它們：加工產線、裝飾桌、直播台、工作電腦。</p>
  <p><b>探索</b>：森林被山脊環繞，東、北、西三座能量門通往海岸、火山與雪原。尋找線索、解開謎題，就能發現新區域。左上角會顯示目前目標，指南針會標出方向。</p>`, [{ t: '操作說明', ghost: true, f: showHelp }, { t: '開始探索' }]);
}

/* ---------- 主迴圈 ---------- */
let lastT = performance.now(), secAcc = 0, webAcc = 0, farmAcc = 0, trendAcc = 0, saveAcc = 0, hudN = 0, pickN = 0;
const tmpC = new THREE.Color(), tmpC2 = new THREE.Color();
function envStep(dt) {
  const w = biomeW(P.x, P.z), fog = new THREE.Color(0, 0, 0), top = new THREE.Color(0, 0, 0), sun = new THREE.Color(0, 0, 0), hs = new THREE.Color(0, 0, 0), hg = new THREE.Color(0, 0, 0);
  BIOMES.forEach((b, i) => { const Z = ZONE3D[b]; fog.add(tmpC.set(Z.fog).multiplyScalar(w[i])); top.add(tmpC.set(Z.top).multiplyScalar(w[i])); sun.add(tmpC.set(Z.sun).multiplyScalar(w[i])); hs.add(tmpC.set(Z.hemiS).multiplyScalar(w[i])); hg.add(tmpC.set(Z.hemiG).multiplyScalar(w[i])); });
  const k = Math.min(1, dt * 2); W.scene.fog.color.lerp(fog, k); W.scene.background.copy(W.scene.fog.color); W.sky.material.uniforms.bot.value.lerp(fog, k); W.sky.material.uniforms.top.value.lerp(top, k);
  W.sun.color.lerp(sun, k); W.hemi.color.lerp(hs, k); W.hemi.groundColor.lerp(hg, k); W.sun.intensity = 2.6 - w[2] * .9;
  W.sky.position.copy(W.cam.position); W.sun.position.set(P.x + 30, P.y + 55, P.z + 22); W.sun.target.position.set(P.x, P.y, P.z);
  const zid = domBiome(P.x, P.z); if (zid !== W.zoneNow) { const prev = W.zoneNow; W.zoneNow = zid; if (prev) toast(`進入${ZONES.find(z => z.id === zid).name}`); }
}
function worldStep(dt) {
  W.t += dt; if (!GUI.kind) playerStep(dt);
  slimeStep(dt, W.t); lineStep(dt); W.anim.forEach(f => f(dt, W.t)); envStep(dt); cameraStep(dt);
  if (!GUI.kind && ++pickN % 3 === 0) { TARGET = pickAt(0, 0); const lbl = targetLabel(TARGET); $('#prompt').innerHTML = lbl; $('#cross').classList.toggle('on', !!TARGET); }
  else if (GUI.kind) { $('#prompt').innerHTML = ''; }
  W.r.render(W.scene, W.cam);
}
function loop(now) {
  const dt = Math.min((now - lastT) / 1000, .1); lastT = now;
  trendAcc += dt; if (trendAcc > 90) { trendAcc = 0; pickTrend(); }
  farmAcc += dt; if (S.up.farm > 0 && farmAcc >= 12 / S.up.farm) { farmAcc = 0; const sp = pick(unlockedSpecies()); S.gel[sp.id] = (S.gel[sp.id] || 0) + 1; discover(sp.id); if (tab === 'make' && !M.active) renderMake(); }
  webAcc += dt; if (webAcc >= 4) { webAcc = 0; const r = webTick(); if (r) { toast(`網站成交 +${fmt(r.price)}　${'★'.repeat(r.stars)}`); renderTop(); if (tab === 'web') renderWeb(); } }
  branchTick(dt); updateLive(dt);
  secAcc += dt; saveAcc += dt;
  if (secAcc >= 1) { secAcc = 0; checkBranch(); renderTop(); renderXP(); renderObjective(); renderHotbar(); const ae = document.activeElement; if (!(ae && ae.tagName === 'INPUT') && tab === 'branch') renderBranch(); }
  if (saveAcc > 5) { saveAcc = 0; save(); }
  try {
    const g = GUI.kind;
    if (W.ready && (!g || g === 'line')) { worldStep(dt); renderCompass(); }
    if (tab === 'make' && M.active) { M.pos += M.dir * M.spd * dt; if (M.pos > 1) { M.pos = 1; M.dir = -1; } if (M.pos < 0) { M.pos = 0; M.dir = 1; } const cur = $('#mcur'); if (cur) cur.style.left = M.pos * 100 + '%'; }
    if (tab === 'decor') decorSt.step(dt);
    else if (tab === 'live') { liveSt.step(dt); $('#hypeBar').style.width = L.hype + '%'; $('#liveViewers').textContent = Math.round(L.viewers) + ' 觀眾'; if (++hudN % 15 === 0) updateLiveHUD(); }
    else if (tab === 'branch' && S.branch === 'factory') facStep(dt);
  } catch (err) { console.error(err); }
  requestAnimationFrame(loop);
}
function offlineCatchUp() {
  const el = Math.min((Date.now() - S.last) / 1000, 1800); if (el < 8 || !S.web.length) return;
  let gain = 0, n = 0; for (let i = 0; i < Math.floor(el / 4); i++) { const before = S.earned; if (webTick()) { gain += S.earned - before; n++; } }
  if (n) setTimeout(() => toast(`離線期間網站賣出 ${n} 件，+${fmt(gain)}`), 800);
}

/* ---------- 啟動 ---------- */
offlineCatchUp(); trend.sp = pick(unlockedSpecies()).id; renderTop();
if (initWorld()) {
  renderHotbar(true); renderXP(); renderObjective(); renderQuest();
  $('#startHint').innerHTML = '<b>點擊畫面開始</b><br>WASD 移動 · 滑鼠環顧 · E 互動 · I 背包 · Esc 選單'; $('#startHint').hidden = TOUCH;
  toast('歡迎來到月光谷。左上角是目前目標。');
}
if (!S.seen) showIntro();
addEventListener('beforeunload', save);
requestAnimationFrame(loop);
