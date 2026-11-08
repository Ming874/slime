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
// 只有內容真的改變時才重繪 DOM，避免點擊被吞掉、輸入框被覆蓋
function setHTML(el, h) { if (el && el._h !== h) { el._h = h; el.innerHTML = h; } }
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
  slicer: { name: '切片機升級', desc: '切片的判定範圍更寬', base: 150, max: 5, mach: 1, need: 'slicer' },
  coater: { name: '糖晶滾筒機升級', desc: '綠色控速區間更寬', base: 180, max: 5, mach: 1, need: 'coater' },
  dryer: { name: '乾燥烘箱升級', desc: '目標溫度區間更寬', base: 210, max: 5, mach: 1, need: 'dryer' },
  cap: { name: '倉儲貨架', desc: '庫存上限 +6', base: 100, max: 5 },
  shelf: { name: '網站伺服器', desc: '網站貨架 +2 格', base: 200, max: 5 },
  gear: { name: '直播燈光設備', desc: '直播基礎觀眾 +15%', base: 250, max: 5, need: 'live' },
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
    pos: null, hb: 0, sens: 1, q: null, own: {},
  };
}
// 讀檔時修正壞掉或過舊的資料，避免任何一筆異常資料讓遊戲當掉
function sanitize(o) {
  const s = Object.assign(fresh(), o, { up: Object.assign(fresh().up, o.up) });
  const arr = v => Array.isArray(v) ? v : [], obj = v => (v && typeof v === 'object' && !Array.isArray(v)) ? v : {};
  for (const k in s.up) { if (!UPS[k]) delete s.up[k]; else s.up[k] = clamp(Math.floor(+s.up[k] || 0), 0, UPS[k].max); }
  ['money', 'fans', 'earned', 'workers', 'auto', 'rep', 'sales'].forEach(k => { s[k] = +s[k]; if (!isFinite(s[k]) || s[k] < 0) s[k] = 0; });
  const fixP = p => { p.crisp = clamp(+p.crisp || .5, 0, 1); p.dur = clamp(isFinite(+p.dur) ? +p.dur : 100, 0, 100); p.deco = arr(p.deco).filter(d => d && DECO[d.k]).slice(0, 6); p.cracks = arr(p.cracks).filter(Array.isArray).slice(-30); return p; };
  const okP = p => p && typeof p === 'object' && SP[p.sp] && isFinite(+p.id);
  s.stock = arr(s.stock).filter(okP).map(fixP); s.web = arr(s.web).filter(okP).map(fixP);
  const ids = new Set(); let maxId = 0;
  for (const p of [...s.stock, ...s.web]) { p.id = Math.floor(+p.id); if (ids.has(p.id)) p.id = -1; else ids.add(p.id); maxId = Math.max(maxId, p.id); }
  s.nextId = Math.max(Math.floor(+s.nextId) || 1, maxId + 1); for (const p of [...s.stock, ...s.web]) if (p.id < 0) p.id = s.nextId++;
  s.gel = Object.fromEntries(Object.entries(obj(s.gel)).filter(([k, v]) => SP[k] && +v >= 0).map(([k, v]) => [k, Math.floor(+v)]));
  s.zones = [...new Set(['forest', ...arr(s.zones).filter(z => ZONES.some(x => x.id === z))])];
  s.packs = [...new Set(['base', ...arr(s.packs).filter(k => PACKS[k])])];
  s.price = { live: Object.assign({}, obj(obj(s.price).live)), web: Object.assign({}, obj(obj(s.price).web)) };
  s.codex = obj(s.codex); s.regulars = obj(s.regulars);
  s.rate = arr(s.rate).filter(n => n >= 1 && n <= 5).slice(-40); if (!s.rate.length) s.rate = [4, 4, 5];
  s.reviews = arr(s.reviews).filter(v => v && REVIEWS[v.s]).slice(0, 8);
  s.contracts = arr(s.contracts).filter(c => c && (c.sp === 'any' || SP[c.sp]) && isFinite(+c.dl));
  s.customers = arr(s.customers).filter(c => c && SP[c.sp] && isFinite(+c.dl));
  if (s.branch && !BRANCHES[s.branch]) s.branch = null;
  if (s.pos && !(Number.isFinite(s.pos.x) && Number.isFinite(s.pos.z) && Number.isFinite(s.pos.yaw))) s.pos = null;
  s.hb = clamp(Math.floor(+s.hb) || 0, 0, 8); s.sens = clamp(Math.floor(+s.sens) || 0, 0, 2);
  if (s.mk && !(SP[s.mk.sp] && s.mk.step >= 0 && s.mk.step < 3 && Array.isArray(s.mk.prec) && s.mk.prec.length === s.mk.step)) s.mk = null;
  return s;
}
function load() {
  try { const o = JSON.parse(localStorage.getItem(SAVE_KEY)); if (o && typeof o === 'object') return sanitize(o); } catch (e) { console.warn('存檔讀取失敗，將開始新遊戲', e); }
  return null;
}
let S = load() || fresh(), resetting = false; if (!S.own) S.own = {};
let NOSAVE = false;
function save() { if (NOSAVE || resetting) return; S.last = Date.now(); if (P) S.pos = { x: P.x, z: P.z, yaw: P.yaw }; try { localStorage.setItem(SAVE_KEY, JSON.stringify(S)); } catch (e) { } }

/* ---------- 經濟公式 ---------- */
const trend = { sp: null };
const cap = () => 8 + S.up.cap * 6;
const slots = () => 4 + S.up.shelf * 2;
const effCrisp = p => p.crisp * (0.35 + 0.65 * p.dur / 100);
const decoBonus = p => p.deco.reduce((a, d) => a + (DECO[d.k] ? DECO[d.k].v : 0), 0);
const CH = { live: 1.4, web: 0.9, shop: 1.25, corp: 1.5 };
const priceOf = (p, ch) => p.crude ? 10 : getPrice(ch, p.sp);
function fair(p, ch) { if (p.crude) return 12; const sp = SP[p.sp]; return sp.price * (0.4 + 1.1 * effCrisp(p)) * (1 + decoBonus(p)) * (trend.sp === p.sp ? 1.35 : 1) * (CH[ch] || 1); }
const defPrice = (spId, ch) => Math.round(SP[spId].price * 1.28 * CH[ch]);
const getPrice = (ch, spId) => S.price[ch][spId] ?? defPrice(spId, ch);
const demand = (price, f) => clamp(1.5 - 0.75 * price / Math.max(1, f), 0, 1.3);
const demandLabel = d => d > 0.95 ? ['熱賣', '#fb923c'] : d > 0.55 ? ['穩定', '#34d399'] : d > 0.2 ? ['冷淡', '#8b9bb0'] : ['滯銷', '#38bdf8'];
const unlockedSpecies = () => SPECIES.filter(s => S.zones.includes(s.zone));
function addMoney(n) { S.money += n; if (n > 0) S.earned += n; }
function discover(id) { if (!S.codex[id]) S.codex[id] = { seen: true, made: 0 }; }
function makeProduct(spId, crisp, crude) { const p = { id: S.nextId++, sp: spId, crisp, dur: 100, deco: [], cracks: [] }; if (crude) p.crude = true; discover(spId); S.codex[spId].made++; return p; }

/* ---------- 音效 ---------- */
let AC = null, NB = null, master = null;
function audio() {
  if (!AC) {
    AC = new (window.AudioContext || window.webkitAudioContext)();
    const comp = AC.createDynamicsCompressor(); comp.threshold.value = -16; comp.knee.value = 12; comp.ratio.value = 4; comp.attack.value = .003; comp.release.value = .2; comp.connect(AC.destination);
    master = AC.createGain(); master.gain.value = 0.9; master.connect(comp);
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
  coin() { if (!S.sound) return; const t = audio().currentTime; tone(1318.5, t, .12, .1, 'triangle'); tone(1975.5, t + .07, .3, .1, 'triangle'); },
  level() { if (!S.sound) return; const t = audio().currentTime; [523.25, 659.25, 783.99, 1046.5].forEach((f, i) => tone(f, t + i * .07, .28, .09, 'triangle')); },
  perfect() { if (!S.sound) return; const t = audio().currentTime; tone(1046.5, t, .2, .08); tone(1568, t + .08, .4, .08); },
  bad() { if (!S.sound) return; const t = audio().currentTime; tone(240, t, .2, .07, 'triangle'); },
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
// 彈窗佇列：同時觸發多個彈窗時依序顯示，不會互相覆蓋
const MQ = []; let mOpen = false;
function modal(html, btns = [{ t: '好' }]) { MQ.push({ html, btns }); if (!mOpen) nextModal(); }
function nextModal() {
  const m = MQ.shift();
  if (!m) { mOpen = false; $('#modal').hidden = true; if (!GUI.kind) lockMouse(); return; }
  mOpen = true; $('#mbox').innerHTML = m.html + '<div class="row" id="mbtns"></div>';
  m.btns.forEach(b => {
    const e = document.createElement('button'); e.className = 'btn' + (b.ghost ? ' ghost' : '') + (b.red ? ' red' : ''); e.textContent = b.t;
    e.onclick = () => { mOpen = false; $('#modal').hidden = true; try { b.f && b.f(); } finally { if (!mOpen) nextModal(); } }; $('#mbtns').appendChild(e);
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
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, depthWrite: false, fog: false, transparent: true })); s.scale.set(2.4, .75, 1); W.labels.push(s); return s;
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
function makeCrumbs(scene, N = 200, size = .07) {
  const geo = new THREE.BufferGeometry(), pos = new Float32Array(N * 3).fill(-50), col = new Float32Array(N * 3);
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3)); geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  const pts = new THREE.Points(geo, new THREE.PointsMaterial({ size, vertexColors: true, transparent: true, depthWrite: false })); pts.frustumCulled = false; scene.add(pts);
  const C = { pts, pos, col, vel: new Float32Array(N * 3), life: new Float32Array(N), k: 0, N };
  C.emit = (p, n, color, sym) => {
    const c = new THREE.Color(color), w = new THREE.Color('#ffffff');
    for (let j = 0; j < n; j++) {
      const i = C.k = (C.k + 1) % N; C.life[i] = 1; C.pos[i * 3] = p.x; C.pos[i * 3 + 1] = p.y; C.pos[i * 3 + 2] = p.z;
        C.vel[i * 3] = rnd(-2, 2); C.vel[i * 3 + 1] = rnd(1, 4); C.vel[i * 3 + 2] = sym ? rnd(-2, 2) : rnd(-.5, 2.5);
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
function popAt(wrap, cx, cy, txt, col) {
  if (!wrap) return; const b = wrap.getBoundingClientRect(), e = document.createElement('div'); e.className = 'popw'; e.textContent = txt; e.style.color = col;
  e.style.left = (cx - b.left + rnd(-34, 34)) + 'px'; e.style.top = (cy - b.top - rnd(12, 40)) + 'px'; wrap.appendChild(e); setTimeout(() => e.remove(), 800);
  const all = wrap.querySelectorAll('.popw'); if (all.length > 5) all[0].remove();
}
/* 特寫舞台（裝飾桌／直播台），延遲初始化 */
function makeStage(cv, mode) {
  const st = { cv, mode, ready: false, p: null, shown: undefined, t: 0, ptr: null, sel: -1, drag: null, spin: null, onCrunch: null, onSel: null, onFlat: null, sq: 0, sqv: 0, flash: 0, hit: new THREE.Vector3() };
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
      if (mode === 'squeeze') { if (st.watch) return; const h = st.v.cast(e.clientX, e.clientY, [st.J.mesh]); if (h.length) { st.ptr = { s: 0, fired: false, over: true, px: e.clientX, py: e.clientY, lx: e.clientX, ly: e.clientY }; setHit(h[0]); sfx.squish(); } }
      else { const h = st.v.cast(e.clientX, e.clientY, st.J.decoMeshes); if (h.length) { st.sel = h[0].object.userData.idx; st.drag = true; } else { st.sel = -1; st.spin = { x: e.clientX, r: st.J.group.rotation.y }; } st.onSel && st.onSel(); }
    });
    cv.addEventListener('pointermove', e => {
      if (st.ptr) { st.ptr.px = e.clientX; st.ptr.py = e.clientY; const h = st.v.cast(e.clientX, e.clientY, [st.J.mesh]); st.ptr.over = h.length > 0; if (h.length) setHit(h[0]); }
      if (st.drag && st.sel >= 0 && st.p) {
        const b = cv.getBoundingClientRect(); RAY.setFromCamera(new THREE.Vector2((e.clientX - b.left) / b.width * 2 - 1, -((e.clientY - b.top) / b.height) * 2 + 1), st.v.cam);
        const pt = new THREE.Vector3(); if (RAY.ray.intersectPlane(new THREE.Plane(new THREE.Vector3(0, 1, 0), -2), pt)) { const l = st.J.group.worldToLocal(pt), d = st.p.deco[st.sel]; d.x = clamp(l.x, -.8, .8); d.z = clamp(l.z, -.8, .8); }
      }
      if (st.spin) st.J.group.rotation.y = st.spin.r + (e.clientX - st.spin.x) * .01;
    });
    // 快速點一下也要能捏出聲音（原本按住不到 0.14 秒不會觸發）
    cv.addEventListener('pointerup', () => { if (st.ptr && !st.ptr.fired && mode === 'squeeze') st.crunchAt(); if (st.drag) save(); st.ptr = null; st.drag = null; st.spin = null; });
    cv.addEventListener('pointercancel', () => { st.ptr = null; st.drag = null; st.spin = null; });
  }
  function setHit(h) { st.hit.copy(st.J.mesh.worldToLocal(h.point.clone())); st.ptr.uv = h.uv ? h.uv.clone() : new THREE.Vector2(.5, .5); st.ptr.world = h.point.clone(); }
  st.crunchAt = () => {
    const p = st.p, q = st.ptr; if (!p || !q) return;
    if (p.dur <= 0) { sfx.squish(1); popAt(cv.parentElement, q.px, q.py, '扁扁…', '#94a3b8'); st.onFlat && st.onFlat(); return; }
    if (mode === 'squeeze') popAt(cv.parentElement, q.px, q.py, pick(['喀滋', '咔嚓', '啵滋', '喀啦', '酥～']), pick(['#fde047', '#22d3ee', '#f0abfc', '#ffffff']));
    const eff = effCrisp(p); sfx.crunch(.6 + eff * .6, eff); if (navigator.vibrate) navigator.vibrate(12); p.dur = Math.max(0, p.dur - 2.2); p.played = true;
    let u = q.uv.x, v = q.uv.y, a = rnd(0, PI2); const cr = [u, v];
    for (let k = 0; k < 4; k++) { a += rnd(-.8, .8); const l = rnd(.03, .08); u += Math.cos(a) * l; v += Math.sin(a) * l; cr.push(u, v); }
    p.cracks.push(cr); if (p.cracks.length > 30) p.cracks.shift(); jellyTexture(st.J, p);
    st.C.emit(q.world, Math.round(8 + eff * 14), SP[p.sp].color); st.flash = 1; st.onCrunch && st.onCrunch(st, eff, { uv: [q.uv.x, q.uv.y], hit: [st.hit.x, st.hit.y, st.hit.z], cr });
  };
  st.remoteCrunch = m => {
    const p = st.p; if (!p || !st.ready) return; const hit = new THREE.Vector3(...m.hit); st.rem = { hit, t: .22 };
    if (m.cr) { p.cracks.push(m.cr); if (p.cracks.length > 30) p.cracks.shift(); jellyTexture(st.J, p); }
    p.dur = Math.max(0, p.dur - 2.2); sfx.crunch(.6 + m.eff * .6, m.eff); st.C.emit(st.J.mesh.localToWorld(hit.clone()), Math.round(8 + m.eff * 14), SP[p.sp].color); st.flash = 1;
  };
  st.step = dt => {
    if (!st.ready) return; dt = Math.min(dt, .033); st.t += dt; if (st.shown !== st.p) apply();
    const J = st.J; let s = 0;
    if (st.ptr) { const q = st.ptr; s = q.s = q.over ? Math.min(1, q.s + dt * 5) : Math.max(0, q.s - dt * 6); if (q.over && s > .7 && !q.fired) { q.fired = true; q.lx = q.px; q.ly = q.py; st.crunchAt(); } else if (q.over && q.fired && Math.hypot(q.px - q.lx, q.py - q.ly) > 45) { q.lx = q.px; q.ly = q.py; st.crunchAt(); } }
    if (st.rem) { st.rem.t -= dt; s = Math.max(s, .8); if (st.rem.t <= 0) st.rem = null; }
    if (st.p) {
      const pressing = (st.ptr && st.ptr.over) || st.rem;
      jellyDeform(J, dt, st.ptr && st.ptr.over ? st.hit : (st.rem ? st.rem.hit : null), s);
      st.sqv += ((pressing ? s * .1 : 0) - st.sq) * 160 * dt; st.sqv *= Math.exp(-9 * dt); st.sq += st.sqv * dt;
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
const K = 1.6, CITY = { x: 4000, z: 0 }, kk = ([x, z]) => [x * K, z * K];
const inCity = (x = P ? P.x : 0) => x > 1500;
function biomeW(x, z) { return biomeW0(x / K, z / K); }
function biomeW0(x, z) {
  const c = smooth(44, 60, x), v = smooth(44, 60, -z), s = smooth(44, 60, -x), f = Math.max(0, 1 - c - v - s), t = f + c + v + s;
  return [f / t, c / t, v / t, s / t];
}
const domBiome = (x, z) => { const w = biomeW(x, z); return BIOMES[w.indexOf(Math.max(...w))]; };
function H(x, z) { if (x > 1500) return 0; return H0(x / K, z / K) * K; }
function H0(x, z) {
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
const WS_R = 16, WS_Y = .4;
function G(x, z) { return H(x, z); }

const W = { ready: false, anim: [], inter: [], t: 0, cols: new Map(), gates: {}, slimes: [], puz: [], labels: [], sid: 0, spawned: new Set(), mirror: false };
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
  const sc = W.scene = new THREE.Scene(); sc.background = new THREE.Color('#cfe6dc'); sc.fog = new THREE.Fog('#cfe6dc', 60, LOW ? 150 : 220); sc.environment = makeEnv(W.r);
  W.cam = new THREE.PerspectiveCamera(72, 1, .08, 700); W.cam.rotation.order = 'YXZ';
  W.hemi = new THREE.HemisphereLight('#d8f0ff', '#2d4a2f', 1); sc.add(W.hemi);
  W.sun = new THREE.DirectionalLight('#fff3d6', 2.6); W.sun.castShadow = !LOW; sc.add(W.sun); sc.add(W.sun.target);
  if (!LOW) { const sh = W.sun.shadow; sh.mapSize.set(2048, 2048); Object.assign(sh.camera, { left: -34, right: 34, top: 34, bottom: -34, near: 1, far: 140 }); sh.bias = -.0004; sh.normalBias = .05; sh.camera.updateProjectionMatrix(); }
  // 天空（漸層 shader）
  W.sky = new THREE.Mesh(new THREE.SphereGeometry(600, 32, 16), new THREE.ShaderMaterial({
    uniforms: { top: { value: new THREE.Color('#5ea7d6') }, bot: { value: new THREE.Color('#cfe6dc') } }, side: THREE.BackSide, depthWrite: false, fog: false,
    vertexShader: 'varying float vh; void main(){ vh = normalize(position).y; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
    fragmentShader: 'uniform vec3 top; uniform vec3 bot; varying float vh; void main(){ gl_FragColor = vec4(mix(bot, top, smoothstep(0.0, 0.45, vh)), 1.0);\n#include <tonemapping_fragment>\n#include <colorspace_fragment>\n}',
  })); W.sky.renderOrder = -1; sc.add(W.sky);
  buildTerrain(); buildWater(); buildProps(); buildWorkshop(); buildCity(); buildVolcanoFx(); buildGates(); buildPuzzles(); buildParticles(); buildClouds();
  W.C = makeCrumbs(sc, 180, .14);
  initPlayer(); spawnAllSlimes(); resizeWorld(); bindInput(); W.ready = true; return true;
}
function buildTerrain() {
  const N = LOW ? 190 : 260, size = 280 * K, geo = new THREE.PlaneGeometry(size, size, N, N); geo.rotateX(-Math.PI / 2);
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
  const geo = new THREE.PlaneGeometry(220 * K, 300 * K, LOW ? 30 : 60, LOW ? 40 : 80), m = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ color: '#0e7490', roughness: .08, metalness: .2, transparent: true, opacity: .9 }));
  m.rotation.x = -Math.PI / 2; m.position.set(180 * K, -.9 * K, 0); m.receiveShadow = true; W.scene.add(m);
  const wp = geo.attributes.position, base = Float32Array.from(wp.array);
  W.anim.push((dt, t) => { if (P.x < 40 * K || inCity()) return; for (let i = 0; i < wp.count; i++) { const x = base[i * 3], y = base[i * 3 + 1]; wp.setZ(i, Math.sin(x * .3 + t * 1.2) * .1 + Math.cos(y * .4 + t * .9) * .1); } wp.needsUpdate = true; geo.computeVertexNormals(); });
}
/* 植被與岩石：每種道具合併成單一幾何後以 InstancedMesh 大量擺放 */
function buildProps() {
  const rd = seeded(77), lists = {}, push = (k, o) => (lists[k] = lists[k] || []).push(o);
  const avoid = (x, z) => {
    if (Math.hypot(x, z) < 26) return true;
    if (Math.abs(z) < 10 * K && Math.abs(Math.abs(x) - 54 * K) < 9 * K) return true;
    if (Math.abs(x) < 10 * K && Math.abs(z + 54 * K) < 9 * K) return true;
    return PUZ_SPOTS.some(([px, pz]) => Math.hypot(x - px, z - pz) < 4.5);
  };
  const tries = LOW ? 6000 : 10500;
  for (let i = 0; i < tries; i++) {
    const x = (rd() - .5) * 250 * K, z = (rd() - .5) * 250 * K, h = H(x, z); if (h < -.3 || h > 26 * K || avoid(x, z)) continue;
    const sl = Math.abs(H(x + 1, z) - H(x - 1, z)) + Math.abs(H(x, z + 1) - H(x, z - 1)); if (sl > 1.5) continue;
    const b = domBiome(x, z), s = .75 + rd() * .8, ry = rd() * 6.28, k = rd(), o = { x, y: h - .12 - sl * .3, z, s, ry };
    let col = 0;
    if (b === 'forest') { if (k < .45) { push('pine', o); col = .35; } else if (k < .72) { push('broad', o); col = .35; } else if (k < .86) push('bush', o); else if (k < .95) { push('rockF', o); col = .8; } else push('shroom', o); }
    else if (b === 'coast') { if (k < .45) { push('palm', o); col = .3; } else if (k < .7) { push('rockF', o); col = .8; } else push('bushC', o); }
    else if (b === 'volcano') { if (k < .45) { push('rockV', o); col = .8; } else if (k < .7) { push('dead', o); col = .25; } else push('obsid', o); }
    else { if (k < .55) { push('pineS', o); col = .35; } else if (k < .75) { push('rockS', o); col = .8; } else push('ice', o); }
    if (col && Math.max(Math.abs(x), Math.abs(z)) < 110 * K) addCol({ x, z, r: col * s + .1 });
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
  for (let i = 0; i < (LOW ? 420 : 820); i++) {
    const cx = (rd() - .5) * 220 * K, cz = (rd() - .5) * 220 * K, b = domBiome(cx, cz); if (b === 'volcano' || b === 'snow') continue;
    for (let j = 0; j < (LOW ? 14 : 22); j++) {
      const x = cx + (rd() - .5) * 7, z = cz + (rd() - .5) * 7, h = H(x, z); if (h < .05 || h > 6 * K || Math.hypot(x, z) < 20) continue; if (Math.abs(H(x + .8, z) - H(x - .8, z)) + Math.abs(H(x, z + .8) - H(x, z - .8)) > .5) continue;
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
  const VZ = -96 * K, y = H(0, VZ) + .3, lava = mesh(new THREE.CircleGeometry(4.6 * K, 32), new THREE.MeshBasicMaterial({ color: '#fb923c' }), 0, y, VZ, W.scene); lava.rotation.x = -Math.PI / 2;
  const smokeG = new THREE.IcosahedronGeometry(2, 1), smokeM = new THREE.MeshStandardMaterial({ color: '#3f3a3a', roughness: 1, transparent: true, opacity: .5, flatShading: true }), puffs = [];
  for (let i = 0; i < 12; i++) { const m = mesh(smokeG, smokeM, 0, y, VZ, W.scene); m.userData.o = i / 12; puffs.push(m); }
  const pools = [], rd = seeded(5);
  for (let i = 0; i < 9; i++) {
    const x = (rd() - .5) * 80 * K, z = (-62 - rd() * 18) * K; if (Math.hypot(x, z - VZ) < 33 * K) continue; const hy = H(x, z) + .05, r = 1.2 + rd() * 1.4;
    const a = mesh(new THREE.CircleGeometry(r, 28), new THREE.MeshBasicMaterial({ color: '#ea580c' }), x, hy, z, W.scene); a.rotation.x = -Math.PI / 2;
    const b = mesh(new THREE.CircleGeometry(r * .6, 24), new THREE.MeshBasicMaterial({ color: '#fde047' }), x, hy + .01, z, W.scene); b.rotation.x = -Math.PI / 2; pools.push(b);
  }
  W.anim.push((dt, t) => { pools.forEach((b, i) => b.scale.setScalar(.85 + Math.sin(t * 2 + i) * .15)); puffs.forEach(m => { const k = (t * .04 + m.userData.o) % 1; m.position.set(Math.sin(k * 6 + m.userData.o * 9) * 3 + k * 8, y + 2 + k * 30, VZ + k * 4); m.scale.setScalar(.6 + k * 3); }); });
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
  const g = new THREE.Group(); W.scene.add(g); W.ws = g; W.slotCol = {}; W.slotMark = {}; W.slotInter = {};
  const at = (o, [x, z], ry = 0) => { o.position.set(x, G(x, z), z); o.rotation.y = ry; g.add(o); return o; };
  const dark = std('#1e293b', { metalness: .6, roughness: .4 }), white = std('#e2e8f0', { roughness: .35 }), steel = std('#94a3b8', { metalness: .9, roughness: .2 }), wood = std('#a07850', { roughness: .8 }), woodD = std('#6b4d33', { roughness: .85 });
  const label = (txt, c, sub, x, y, z) => { const sp = textSprite(txt, c, sub); sp.position.set(x, y, z); g.add(sp); return sp; };
  // 工作電腦（戶外桌與遮陽傘）
  const pc = at(new THREE.Group(), BASE.pc);
  box(2.4, .1, 1.1, white, 0, .95, 0, pc); [-1.1, 1.1].forEach(x => box(.08, .95, 1, dark, x, .47, 0, pc));
  box(1.5, .9, .06, dark, 0, 1.55, -.3, pc); cyl(.05, .08, .35, 10, dark, 0, 1.12, -.3, pc);
  const sc = document.createElement('canvas'); sc.width = 512; sc.height = 300; const sg = sc.getContext('2d');
  sg.fillStyle = '#0b1220'; sg.fillRect(0, 0, 512, 300); sg.fillStyle = '#22d3ee'; sg.font = 'bold 34px sans-serif'; sg.fillText('SQUISH SHOP', 24, 50);
  sg.fillStyle = '#334155'; for (let i = 0; i < 3; i++) sg.fillRect(24 + i * 160, 80, 140, 150); sg.fillStyle = '#34d399'; for (let i = 0; i < 3; i++) sg.fillRect(24 + i * 160, 240, 140, 30);
  const stx = new THREE.CanvasTexture(sc); stx.colorSpace = THREE.SRGBColorSpace;
  mesh(new THREE.PlaneGeometry(1.4, .8), new THREE.MeshBasicMaterial({ map: stx }), 0, 1.55, -.265, pc);
  box(.9, .03, .3, dark, 0, 1.02, .15, pc);
  const chair = new THREE.Group(); chair.position.set(0, 0, .9); pc.add(chair); cyl(.3, .3, .08, 20, dark, 0, .55, 0, chair); box(.55, .6, .06, dark, 0, .9, .28, chair); cyl(.04, .04, .5, 8, steel, 0, .28, 0, chair);
  cyl(.04, .04, 2.6, 8, steel, 1.4, 1.3, .1, pc); mesh(new THREE.ConeGeometry(1.7, .6, 12, 1, true), std('#22d3ee', { side: THREE.DoubleSide, roughness: .6 }), 1.4, 2.7, .1, pc);
  addCol({ box: [BASE.pc[0] - 1.3, BASE.pc[1] - .7, BASE.pc[0] + 1.3, BASE.pc[1] + .5] });
  addInter(hitBox(2.6, 2.2, 1.6, 0, 1.1, 0, pc), 'station', 'pc', '工作電腦'); label('工作電腦', '#818cf8', '把捏捏上架到網站販售', BASE.pc[0], pc.position.y + 3.4, BASE.pc[1]);
  // 手作台
  const bn = at(new THREE.Group(), BASE.bench);
  box(2.2, .12, 1.2, wood, 0, .9, 0, bn); [[-1, -.5], [1, -.5], [-1, .5], [1, .5]].forEach(([x, z]) => box(.1, .9, .1, woodD, x, .45, z, bn));
  box(.9, .04, .6, std('#f5efe6', { roughness: .7 }), -.3, .98, 0, bn);
  mesh(new THREE.SphereGeometry(.22, 16, 8, 0, PI2, Math.PI / 2, Math.PI / 2), std('#cbd5e1', { side: THREE.DoubleSide }), .6, 1.18, -.1, bn);
  mesh(new THREE.SphereGeometry(.16, 14, 10), new THREE.MeshPhysicalMaterial({ color: '#6ee7a8', roughness: .1, clearcoat: 1 }), .6, 1.02, -.1, bn).scale.y = .5;
  const pin = cyl(.05, .05, .7, 12, woodD, -.3, 1.06, 0, bn); pin.rotation.z = Math.PI / 2;
  addCol({ x: BASE.bench[0], z: BASE.bench[1], r: 1.2 }); addInter(hitBox(2.4, 2, 1.6, 0, 1, 0, bn), 'station', 'bench', '手作台'); label('手作台', '#fbbf24', '手工做出粗製捏捏', BASE.bench[0], bn.position.y + 3, BASE.bench[1]);
  // 加工產線（買了哪台才出現哪台）
  const line = at(new THREE.Group(), BASE.line); W.lineG = line; buildLine(line);
  W.slotCol.line = { box: [BASE.line[0] - 7.8, BASE.line[1] - 1.2, BASE.line[0] + 9.3, BASE.line[1] + 1.2] };
  W.slotInter.line = addInter(hitBox(17.5, 3.2, 3.2, .7, 1.6, 0, line), 'station', 'line', '加工產線');
  W.slotMark.line = slotMark(g, BASE.line, '加工產線空地', '到大城市機械行購買機器', 7);
  // 裝飾桌
  const dt = at(new THREE.Group(), BASE.decor, .5); W.decorG = dt;
  box(2.6, .12, 1.5, white, 0, .95, 0, dt); [[-1.2, -.65], [1.2, -.65], [-1.2, .65], [1.2, .65]].forEach(([x, z]) => box(.08, .95, .08, dark, x, .47, z, dt));
  cyl(.5, .55, .1, 32, steel, 0, 1.06, 0, dt);
  const sample = makeJelly(6, true); sample.group.scale.setScalar(.28); sample.group.position.set(0, 1.4, 0); sample.ov.visible = false; jellyColors(sample, SP.honey); dt.add(sample.group); W.sample = sample.group;
  [['#e879f9', -.8], ['#22d3ee', -.55], ['#fbbf24', .75]].forEach(([c, x]) => mesh(new THREE.OctahedronGeometry(.08), glow(c), x, 1.1, .4, dt));
  W.slotCol.decor = { x: BASE.decor[0], z: BASE.decor[1], r: 1.5 };
  W.slotInter.decor = addInter(hitBox(3, 2, 2, 0, 1, 0, dt), 'station', 'decor', '裝飾桌');
  W.slotMark.decor = slotMark(g, BASE.decor, '裝飾桌空地', '到大城市器材行購買', 2);
  // 直播台
  const lv = at(new THREE.Group(), BASE.live, -.5); W.liveG = lv;
  cyl(1.6, 1.7, .18, 40, dark, 0, .09, 0, lv); const lr = mesh(new THREE.TorusGeometry(1.62, .03, 6, 60), glow('#e879f9'), 0, .19, 0, lv); lr.rotation.x = Math.PI / 2;
  cyl(.35, .4, .9, 24, white, 0, .63, 0, lv);
  const lj = makeJelly(6, true); lj.group.scale.setScalar(.3); lj.group.position.set(0, 1.4, 0); lj.ov.visible = false; jellyColors(lj, SP.grass); lv.add(lj.group); W.liveSample = lj.group;
  box(3.6, 3, .12, std('#0f0d1f', { roughness: .8 }), 0, 1.6, -1.8, lv);
  W.neon = [['#22d3ee', -1.4], ['#818cf8', -.5], ['#e879f9', .5], ['#fbbf24', 1.4]].map(([c, x]) => box(.08, 2.4, .06, glow(c), x, 1.6, -1.72, lv));
  const rl = mesh(new THREE.TorusGeometry(.45, .04, 10, 40), glow('#f8fafc'), -1.4, 1.9, 1.2, lv); rl.rotation.y = .6;
  cyl(.03, .03, 1.9, 8, steel, -1.4, .95, 1.2, lv);
  const camG = new THREE.Group(); camG.position.set(1.4, 1.5, 1.4); lv.add(camG); box(.45, .3, .35, dark, 0, 0, 0, camG);
  const lens = cyl(.1, .13, .25, 16, std('#0f172a', { metalness: .9, roughness: .15 }), 0, 0, -.28, camG); lens.rotation.x = Math.PI / 2; camG.rotation.y = -2.4;
  W.recLed = mesh(new THREE.SphereGeometry(.035, 8, 6), new THREE.MeshBasicMaterial({ color: '#fb7185' }), .16, .1, -.18, camG);
  W.slotCol.live = { x: BASE.live[0], z: BASE.live[1], r: 1.8 };
  W.slotInter.live = addInter(hitBox(3.6, 2.6, 3.6, 0, 1.3, 0, lv), 'station', 'live', '直播台');
  W.slotMark.live = slotMark(g, BASE.live, '直播台空地', '到大城市器材行購買直播設備', 2.2);
  // 計程車（出生點左邊）
  const tx = at(makeTaxi('#facc15', true), BASE.taxi, Math.PI / 2);
  addCol({ box: [BASE.taxi[0] - 1, BASE.taxi[1] - 2, BASE.taxi[0] + 1, BASE.taxi[1] + 2] });
  addInter(hitBox(4.2, 2.2, 2, 0, 1, 0, tx), 'station', 'taxi', '計程車'); label('計程車', '#facc15', '前往大城市購買設備', BASE.taxi[0], tx.position.y + 3, BASE.taxi[1]);
  g.traverse(o => { if (o.isMesh && o.material.visible !== false) { o.castShadow = !LOW; o.receiveShadow = true; } });
  refreshBase();
}
function buildLine(G0) {
  const dark = std('#1e293b', { metalness: .7, roughness: .35 }), steel = std('#94a3b8', { metalness: .9, roughness: .2 }), panel = std('#334155', { metalness: .5, roughness: .4 });
  const LP = W.lineParts = { belt: new THREE.Group(), m: [new THREE.Group(), new THREE.Group(), new THREE.Group()] }; G0.add(LP.belt); LP.m.forEach(m => G0.add(m)); const B = LP.belt;
  box(15, .35, 1.7, dark, 0, .45, 0, B); box(15, .08, 1.5, std('#0b0f17', { roughness: .9 }), 0, .66, 0, B); [-.9, .9].forEach(z => box(15, .12, .1, steel, 0, .72, z, B));
  MK.rollers = []; for (let i = 0; i < 14; i++) { const r = cyl(.14, .14, 1.8, 12, steel, -6.5 + i, .45, 0, B); r.rotation.x = Math.PI / 2; MK.rollers.push(r); }
  [-6.8, -2.3, 2.3, 6.8].forEach(x => [-.7, .7].forEach(z => box(.15, .3, .15, dark, x, .15, z, B)));
  MK.belt = []; for (let i = 0; i < 30; i++) MK.belt.push(box(.06, .02, 1.4, std('#22d3ee', { emissive: '#22d3ee', emissiveIntensity: .25 }), -7.25 + i * .5, .71, 0, B));
  const leds = (x, par) => { const a = []; for (let i = 0; i < 5; i++) a.push(box(.14, .08, .04, new THREE.MeshBasicMaterial({ color: '#1e293b' }), x - .36 + i * .18, .3, 1.21, par)); return a; };
  MK.leds = [];
  const A = LP.m[0], x0 = MX[0]; [-1, 1].forEach(s => [-1.05, 1.05].forEach(z => box(.22, 2.6, .22, dark, x0 + s * .9, 1.3, z, A)));
  box(2.2, .3, 2.4, panel, x0, 2.65, 0, A); box(1.2, .5, .8, dark, x0, 3.05, 0, A);
  MK.blades = [-.35, 0, .35].map(dx => box(.04, .7, 1.5, steel, x0 + dx, 2.1, 0, A)); box(1, .55, .1, panel, x0, .3, 1.15, A); MK.leds[0] = leds(x0, A);
  const Bm = LP.m[1], x1 = MX[1]; MK.drum = new THREE.Group(); MK.drum.position.set(x1, 1.25, 0); Bm.add(MK.drum);
  const glass = mesh(new THREE.CylinderGeometry(.95, .95, 2, 32, 1, true), new THREE.MeshStandardMaterial({ color: '#c7f9ff', transparent: true, opacity: .28, roughness: .05, side: THREE.DoubleSide }), 0, 0, 0, MK.drum); glass.rotation.z = Math.PI / 2;
  for (let i = 0; i < 6; i++) { const a = i / 6 * PI2, vb = box(1.9, .04, .25, steel, 0, Math.cos(a) * .82, Math.sin(a) * .82, MK.drum); vb.rotation.x = -a; }
  [-1, 1].forEach(s => { const r = mesh(new THREE.TorusGeometry(.97, .06, 10, 40), steel, x1 + s, 1.25, 0, Bm); r.rotation.y = Math.PI / 2; box(.2, 1.2, .2, dark, x1 + s, .6, -.9, Bm); box(.2, 1.2, .2, dark, x1 + s, .6, .9, Bm); });
  const hop = mesh(new THREE.ConeGeometry(.6, .9, 4, 1, true), std('#334155', { side: THREE.DoubleSide }), x1, 2.85, 0, Bm); hop.rotation.x = Math.PI;
  MK.sugar = []; for (let i = 0; i < 14; i++) MK.sugar.push(box(.05, .05, .05, new THREE.MeshBasicMaterial({ color: '#ffffff' }), x1 + rnd(-.15, .15), 2.4, rnd(-.15, .15), Bm));
  box(1, .55, .1, panel, x1, .3, 1.15, Bm); MK.leds[1] = leds(x1, Bm);
  const Cm = LP.m[2], x2 = MX[2]; box(2.6, .5, 2.2, panel, x2, 2.3, 0, Cm); [-1, 1].forEach(s => box(2.6, 1.6, .2, dark, x2, 1.25, s, Cm));
  MK.heat = [-.6, 0, .6].map(dz => { const h = cyl(.05, .05, 2.3, 10, new THREE.MeshStandardMaterial({ color: '#7c2d12', emissive: '#fb923c', emissiveIntensity: .2 }), x2, 1.95, dz, Cm); h.rotation.z = Math.PI / 2; return h; });
  cyl(.5, .5, .2, 24, dark, x2, 2.65, 0, Cm); MK.fan = new THREE.Group(); MK.fan.position.set(x2, 2.8, 0); Cm.add(MK.fan); for (let i = 0; i < 4; i++) { const bl = box(.75, .03, .16, steel, 0, 0, 0, MK.fan); bl.rotation.y = i * Math.PI / 4; }
  box(1, .55, .1, panel, x2, .3, 1.15, Cm); MK.leds[2] = leds(x2, Cm);
  MK.tank = cyl(.55, .55, 1.8, 28, new THREE.MeshStandardMaterial({ color: '#6ee7a8', emissive: '#6ee7a8', emissiveIntensity: .25, roughness: .15, transparent: true, opacity: .85 }), -7.4, 1.5, -1.6, B);
  cyl(.6, .6, .12, 28, steel, -7.4, .6, -1.6, B); cyl(.6, .6, .12, 28, steel, -7.4, 2.45, -1.6, B);
  const pipe = cyl(.07, .07, 1.6, 10, steel, -7.0, 2.5, -.8, B); pipe.rotation.x = Math.PI / 2.6;
  MK.turn = cyl(.9, 1, .2, 36, std('#111827', { metalness: .8, roughness: .2 }), 8.2, .1, 0, B);
  const tr = mesh(new THREE.TorusGeometry(.95, .025, 8, 60), glow('#22d3ee'), 8.2, .21, 0, B); tr.rotation.x = Math.PI / 2;
  MK.J = makeJelly(8, true); MK.J.group.scale.setScalar(.42); MK.J.group.position.set(-6.4, 1.14, 0); MK.J.ov.visible = false; G0.add(MK.J.group);
}
function lineStep(dt) {
  if (!MK.J) return; MK.t += dt; const t = MK.t, act = i => (M.active && M.step === i && M.phase === 'run') || MK.pulse[i] > 0, run = i => M.active && M.step === i && M.phase === 'run';
  MK.pulse = MK.pulse.map(p => Math.max(0, p - dt));
  MK.blades.forEach((b, k) => b.position.y = MK.pulse[0] > 0 ? 1.55 + .45 * Math.cos(MK.pulse[0] * 25 + k * .9) : run(0) ? 2.0 : 2.1);
  MK.drum.rotation.x += dt * (run(1) ? 1 + (MK.drumSpd || 0) * 12 : act(1) ? 5 : .3);
  MK.sugar.forEach((s, i) => { s.visible = act(1); if (s.visible) s.position.y = 2.4 - ((t * 1.6 + i / 14) % 1) * 1.4; });
  const hot = act(2), heatK = run(2) ? .3 + (MK.heatLv || 0) * 3 : (hot ? 2.2 + Math.sin(t * 12) * .6 : .2); MK.heat.forEach(h => h.material.emissiveIntensity = heatK); MK.fan.rotation.y += dt * (hot ? 14 : 1.2);
  MK.leds.forEach((row, i) => { const lv = S.up[MKEY[i]], on = act(i); row.forEach((l, k) => l.material.color.set(k < lv ? (on ? '#34d399' : '#22d3ee') : '#1e293b')); });
  const moving = M.active || MK.bx < 7.9; MK.rollers.forEach(r => r.rotation.y += dt * (moving ? 3 : 0));
  MK.belt.forEach(b => { b.position.x += dt * (moving ? .8 : 0); if (b.position.x > 7.4) b.position.x -= 15; });
  const J = MK.J, spId = M.active ? M.sp : (M.last ? M.last.sp : M.sp);
  J.group.visible = ownAny() && (M.active || !!M.last); if (spId) { jellyColors(J, SP[spId]); MK.tank.material.color.set(SP[spId].color); MK.tank.material.emissive.set(SP[spId].color); }
  const tx = M.active ? MX[M.step] : (M.last ? 8.2 : -6.4); MK.bx += (tx - MK.bx) * Math.min(1, dt * 3); const onTurn = !M.active && M.last && MK.bx > 7.6;
  J.group.position.set(MK.bx + (M.active && act(M.step) ? Math.sin(t * 40) * .01 : 0), onTurn ? 1.15 + Math.sin(t * 2) * .05 : 1.14, 0);
  J.group.rotation.y = onTurn ? t * .8 : 0; MK.turn.rotation.y = t * .8; J.group.scale.set(.42, .42 * (M.active && M.step >= 1 ? .92 : 1), .42);
  if (W.sample) W.sample.rotation.y = t * .6; if (W.liveSample) { W.liveSample.rotation.y = -t * .4; W.liveSample.position.y = 1.4 + Math.sin(t * 2) * .04; }
  if (W.neon) W.neon.forEach((n, i) => n.scale.y = .7 + .3 * Math.abs(Math.sin(t * 1.5 + i))); if (W.recLed) W.recLed.visible = L.on ? Math.sin(t * 6) > 0 : false;
}

/* ============================================================
   能量門與探索謎題
   ============================================================ */
const GATES = { coast: { x: 54 * K, z: 0, ax: 'x', title: '破碎的古地圖' }, volcano: { x: 0, z: -54 * K, ax: 'z', title: '潮汐石陣' }, snow: { x: -54 * K, z: 0, ax: 'x', title: '四座熔岩柱' } };
const QUEST = {
  coast: { from: 'forest', title: '破碎的古地圖', need: 2, hint: '森林各處藏著 5 片古地圖碎片，只有靠近時才會微微發光。集齊後，到東方能量門前的古地圖石台，把地圖拼回原狀。' },
  volcano: { from: 'coast', title: '潮汐石陣', need: 4, hint: '海灘上散落著 3 張被撕碎的紙條。拼湊出完整的謎語後，依序點亮六顆潮汐石中的四顆，順序錯了會重來。' },
  snow: { from: 'volcano', title: '四座熔岩柱', need: 4, hint: '火山腳下的石碑刻著一道邏輯謎題。推理出四根熔岩柱該有的顏色，西方之門才會開啟。' },
};
const FRAG_SPOTS = [[-34, 30], [38, -34], [-14, -42], [22, 38], [-41, -16]].map(kk), ALTAR = kk([44, 5]), NOTES = [[66, 22], [81, -4], [71, -32]].map(kk);
const TIDE_SPOTS = [[63, -15], [66.5, -18], [70, -15], [73.5, -18], [77, -15], [80.5, -18]].map(kk), TABLET = kk([-16, -63]), PILLARS = [[-10, -67], [-3.5, -69], [3.5, -69], [10, -67]].map(kk);
const PUZ_SPOTS = [...FRAG_SPOTS, ALTAR, ...NOTES, ...TIDE_SPOTS, TABLET, ...PILLARS];
const TIDE = [{ c: '#ef4444', n: '紅' }, { c: '#f97316', n: '橘' }, { c: '#facc15', n: '黃' }, { c: '#22c55e', n: '綠' }, { c: '#3b82f6', n: '藍' }, { c: '#a855f7', n: '紫' }];
const TIDE_ORDER = [1, 4, 0, 3], TIDE_LAYOUT = [3, 0, 5, 1, 4, 2];
const PILLAR = ['ice', 'grass', 'salt', 'coral', 'lava', 'honey'], PILLAR_ANS = [0, 1, 2, 3];
const NOTE_TXT = ['……當潮水退去，第一個醒來的，是熔岩史萊姆身上燃燒的顏色……', '……第二個，是海鹽史萊姆的顏色；第三個，是彩虹最外圈的那一道……', '……最後醒來的，是青草史萊姆的顏色。其餘的石頭，千萬不要碰。'];
const TABLET_TXT = '寒冰之心立於最左，<br>海底之花守在最右。<br>海鹽從不與寒冰比鄰，<br>剩下的那一根，長出初春的嫩草。';
function qState() {
  if (!S.q) S.q = {}; const q = S.q; q.frags = q.frags || []; q.notes = q.notes || []; q.tide = q.tide || []; q.read = q.read || {};
  if (!q.pil || q.pil.length !== 4) q.pil = [4, 4, 4, 4]; if (!q.map || q.map.length !== 9) q.map = [1, 3, 2, 0, 1, 2, 3, 1, 2]; return q;
}
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
    if (S.zones.includes(k)) return; const d = GATES[k], g = new THREE.Group(), y = H(d.x, d.z); g.position.set(d.x, y, d.z); g.scale.setScalar(K); if (d.ax === 'z') g.rotation.y = Math.PI / 2; W.scene.add(g);
    const rockM = std('#475569', { flatShading: true, roughness: .9 });
    [-7.5, 7.5].forEach(o => { const r = mesh(jit(new THREE.CylinderGeometry(1, 1.4, 9, 7, 3), .25, o + 3), rockM, 0, 4, o, g); r.castShadow = !LOW; });
    const mat = new THREE.MeshBasicMaterial({ color: '#a78bfa', map: gateTex, transparent: true, opacity: .55, side: THREE.DoubleSide, depthWrite: false, blending: THREE.AdditiveBlending });
    const wall = mesh(new THREE.PlaneGeometry(14, 8), mat, 0, 4, 0, g); wall.rotation.y = Math.PI / 2;
    const run = textSprite('能量門', '#c4b5fd', '需解開：' + d.title); run.position.set(0, 9.2, 0); g.add(run);
    const col = addCol({ box: d.ax === 'x' ? [d.x - K, -8 * K, d.x + K, 8 * K] : [-8 * K, d.z - K, 8 * K, d.z + K] });
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
  if (S.zones.includes(k)) return; S.zones.push(k); save(); sfx.pop(); setTimeout(() => sfx.pop(), 250); openGate(k); if (!W.mirror) spawnZone(k);
  const z = ZONES.find(z => z.id === k), dir = { coast: '東', volcano: '北', snow: '西' }[k];
  const txt = { coast: '古地圖重新拼合，石台發出光芒，東方山脊的能量門應聲碎裂。', volcano: '四顆潮汐石依序亮起，海面退潮，北方山脊的能量門隨之消散。', snow: '四根熔岩柱的光芒交會，冰冷的風從西方山脊吹來，雪原的入口出現了。' }[k];
  modal(`<h2>發現新區域：${z.name}</h2><p>${txt}</p><p>${dir}方的能量門已經開啟，新的史萊姆正在等你。指南針上的黃色標記會指引方向。</p>`, [{ t: '出發' }]);
  toast(`發現新區域：${z.name}`); renderQuest();
}
function buildPuzzles() {
  const q = qState(), W0 = W.scene;
  const add = (obj, pz, name, r = 1) => { const h = mesh(new THREE.SphereGeometry(r, 8, 6), new THREE.MeshBasicMaterial({ visible: false }), 0, 0, 0, obj); const it = addInter(h, 'puzzle', pz.type, name, { pz, obj }); W.puz.push(it); return it; };
  if (!S.zones.includes('coast')) {
    FRAG_SPOTS.forEach(([x, z], i) => {
      if (q.frags.includes(i)) return; const g = new THREE.Group(); g.position.set(x, H(x, z) + .08, z); W0.add(g);
      const shape = new THREE.Shape([new THREE.Vector2(-.4, -.3), new THREE.Vector2(.35, -.4), new THREE.Vector2(.45, .25), new THREE.Vector2(-.1, .4), new THREE.Vector2(-.45, .1)]);
      const m = mesh(new THREE.ExtrudeGeometry(shape, { depth: .03, bevelEnabled: false }), new THREE.MeshStandardMaterial({ color: '#e9d8a6', emissive: '#fbbf24', emissiveIntensity: .03, side: THREE.DoubleSide, flatShading: true, roughness: .85 }), 0, 0, 0, g);
      m.rotation.set(-Math.PI / 2 + .2, 0, i * 1.3); g.userData.frag = m; add(g, { type: 'frag', i }, '古地圖碎片', .9);
    });
    const al = new THREE.Group(); al.position.set(ALTAR[0], H(...ALTAR), ALTAR[1]); W0.add(al);
    const stoneM = std('#78716c', { flatShading: true, roughness: .95 });
    cyl(.9, 1.1, .9, 8, stoneM, 0, .45, 0, al); box(1.6, .12, 1.6, stoneM, 0, .96, 0, al);
    al.userData.plate = box(1.3, .03, 1.3, new THREE.MeshStandardMaterial({ color: '#e9d8a6', emissive: '#fbbf24', emissiveIntensity: .2 }), 0, 1.03, 0, al);
    const lb = textSprite('古地圖石台', '#fde68a', '集齊 5 片碎片後拼回地圖'); lb.position.set(0, 2.6, 0); al.add(lb);
    addCol({ x: ALTAR[0], z: ALTAR[1], r: 1.2 }); add(al, { type: 'altar' }, '古地圖石台', 1.3);
  }
  if (!S.zones.includes('volcano')) {
    NOTES.forEach(([x, z], i) => {
      if (q.notes.includes(i)) return; const g = new THREE.Group(); g.position.set(x, H(x, z) + .02, z); W0.add(g);
      box(.5, .01, .36, std('#fef3c7', { roughness: .9 }), 0, .02, 0, g).rotation.y = i; mesh(new THREE.DodecahedronGeometry(.12), std('#94a3b8', { flatShading: true }), .1, .1, .05, g);
      add(g, { type: 'note', i }, '被撕碎的紙條', .8);
    });
    TIDE_LAYOUT.forEach((ci, i) => {
      const [x, z] = TIDE_SPOTS[i], g = new THREE.Group(); g.position.set(x, H(x, z), z); W0.add(g);
      const stn = mesh(jit(new THREE.DodecahedronGeometry(.7, 1), .25, i + 5), std('#64748b', { flatShading: true, roughness: .9 }), 0, .5, 0, g); stn.scale.set(1, 1.3, 1); stn.castShadow = !LOW;
      g.userData.gem = mesh(new THREE.OctahedronGeometry(.25), new THREE.MeshStandardMaterial({ color: TIDE[ci].c, emissive: TIDE[ci].c, emissiveIntensity: q.tide.includes(ci) ? 1.8 : .15, roughness: .2 }), 0, 1.55, 0, g);
      addCol({ x, z, r: .8 }); add(g, { type: 'tide', c: ci, g }, '潮汐石', 1.2);
    });
  }
  if (!S.zones.includes('snow')) {
    const t = new THREE.Group(); t.position.set(TABLET[0], H(...TABLET), TABLET[1]); t.rotation.y = .5; W0.add(t);
    box(1.3, 1.7, .3, std('#57534e', { flatShading: true, roughness: .95 }), 0, .85, 0, t); box(1.0, 1.2, .02, new THREE.MeshStandardMaterial({ color: '#1c1917', emissive: '#f97316', emissiveIntensity: .4 }), 0, .95, .16, t);
    addCol({ x: TABLET[0], z: TABLET[1], r: .8 }); add(t, { type: 'tablet' }, '古老的石碑', 1.2);
    PILLARS.forEach(([x, z], i) => {
      const g = new THREE.Group(); g.position.set(x, H(x, z), z); W0.add(g);
      mesh(new THREE.CylinderGeometry(.45, .55, 2.6, 6), std('#1c1917', { flatShading: true, roughness: .8 }), 0, 1.3, 0, g);
      mesh(new THREE.CylinderGeometry(.48, .48, .12, 6), glow('#ea580c'), 0, .8, 0, g);
      const cr = mesh(new THREE.OctahedronGeometry(.32), new THREE.MeshStandardMaterial({ color: '#fff', emissive: '#fff', emissiveIntensity: .7, roughness: .2 }), 0, 2.95, 0, g); cr.scale.y = 1.4; g.userData.cr = cr;
      setPillar(g, q.pil[i]); addCol({ x, z, r: .7 }); add(g, { type: 'pillar', i, g }, `熔岩柱（第 ${i + 1} 根）`, 1.4);
    });
  }
  W.anim.push((dt, t) => W.puz.forEach((it, i) => {
    const o = it.obj, d = Math.hypot(o.position.x - P.x, o.position.z - P.z);
    if (it.pz.type === 'frag') o.userData.frag.material.emissiveIntensity = d < 14 ? .3 + (Math.sin(t * 3 + i) + 1) * .35 * (1 - d / 14) : .03;
    if (it.pz.type === 'pillar') o.userData.cr.rotation.y = t;
    if (it.pz.type === 'tide' && !qState().tide.includes(it.pz.c)) o.userData.gem.material.emissiveIntensity = .15 + (Math.sin(t * 2 + i) + 1) * .1;
    if (it.pz.type === 'altar') o.userData.plate.material.emissiveIntensity = qState().frags.length >= 5 ? .5 + Math.sin(t * 3) * .3 : .1;
  }));
}
function setPillar(g, v) { const c = SP[PILLAR[v]].color; g.userData.cr.material.color.set(c); g.userData.cr.material.emissive.set(c); }
function removePuz(it) { W.scene.remove(it.obj); W.puz = W.puz.filter(x => x !== it); W.inter = W.inter.filter(x => x !== it); }
function puzzleTap(it) {
  const q = qState(), pz = it.pz; sfx.tick();
  const zoneOf = { frag: 'coast', altar: 'coast', note: 'volcano', tide: 'volcano', tablet: 'snow', pillar: 'snow' }[pz.type];
  if (!questReady(zoneOf) && pz.type !== 'tablet') { const Q = QUEST[zoneOf]; return toast(`${it.name}被一股力量封印著……先用${ZONES.find(z => z.id === Q.from).name}的史萊姆做出 ${Q.need} 個捏捏（目前 ${madeIn(Q.from)}）。`); }
  if (pz.type === 'frag') {
    if (!q.frags.includes(pz.i)) q.frags.push(pz.i); fx3(it.obj.position.clone().setY(it.obj.position.y + 1), `古地圖碎片 ${q.frags.length}/5`, '#fde68a');
    removePuz(it); sfx.pop(); save(); renderQuest(); toast(q.frags.length >= 5 ? '五片碎片都找到了！到東方能量門前的古地圖石台把地圖拼回原狀。' : `取得古地圖碎片（${q.frags.length}/5）`);
  } else if (pz.type === 'altar') openAltar();
  else if (pz.type === 'note') {
    if (!q.notes.includes(pz.i)) q.notes.push(pz.i); removePuz(it); sfx.pop(); save(); renderQuest();
    modal(`<h2>撕碎的紙條（${q.notes.length}/3）</h2><div class="riddle">${NOTE_TXT[pz.i]}</div><p class="small" style="color:var(--sub)">收集到的紙條可以在背包的探索日誌重新閱讀。</p>`);
  } else if (pz.type === 'tide') {
    if (q.notes.length < 3) return toast('潮汐石毫無反應……也許要先弄清楚紙條上的完整謎語。');
    q.tide.push(pz.c); pz.g.userData.gem.material.emissiveIntensity = 1.8;
    if (!q.tide.every((c, i) => c === TIDE_ORDER[i])) { q.tide = []; sfx.squish(1); toast('潮汐石的光一起熄滅了……順序不對。'); W.puz.forEach(p => p.pz.type === 'tide' && (p.pz.g.userData.gem.material.emissiveIntensity = .15)); }
    else if (q.tide.length === TIDE_ORDER.length) setTimeout(() => discoverZone('volcano'), 500); else sfx.machine(0);
    save(); renderQuest();
  } else if (pz.type === 'tablet') {
    q.read.tablet = true; save(); renderQuest();
    modal(`<h2>古老的石碑</h2><div class="riddle">${TABLET_TXT}</div><p class="small" style="color:var(--sub)">四根熔岩柱由左到右排列（面向北方）。點擊熔岩柱可以切換頂端晶石的顏色，每種顏色都屬於一種史萊姆。</p>`);
  } else if (pz.type === 'pillar') {
    if (!q.read.tablet) return toast('熔岩柱燙得無法靠近……也許附近有什麼線索。');
    q.pil[pz.i] = (q.pil[pz.i] + 1) % PILLAR.length; setPillar(pz.g, q.pil[pz.i]); sfx.machine(2); save();
    if (q.pil.every((v, i) => v === PILLAR_ANS[i])) setTimeout(() => discoverZone('snow'), 500);
  }
}
function questTarget() {
  const k = nextQuest(); if (!k || !S.zones.includes(QUEST[k].from)) return null; const q = qState();
  if (k === 'coast') return q.frags.length >= 5 ? { x: ALTAR[0], z: ALTAR[1], n: '古地圖石台' } : null;
  if (k === 'volcano') return q.notes.length >= 3 ? { x: TIDE_SPOTS[2][0], z: TIDE_SPOTS[2][1], n: '潮汐石陣' } : null;
  if (k === 'snow') return q.read.tablet ? { x: 0, z: PILLARS[1][1], n: '熔岩柱' } : null;
  return null;
}
function renderQuest() {
  const el = $('#questBox'); if (!el) return; const k = nextQuest(), q = qState();
  if (!k) { el.innerHTML = '<b>探索日誌</b><div class="small" style="color:var(--sub);margin-top:4px">你已經發現了月光谷的所有區域。</div>'; return; }
  const Q = QUEST[k], ready = questReady(k), made = madeIn(Q.from); let prog = '';
  if (k === 'coast') prog = `<div class="qprog">${[0, 1, 2, 3, 4].map(i => `<i class="${q.frags.includes(i) ? 'on' : ''}"></i>`).join('')}</div><div class="small" style="margin-top:4px">古地圖碎片 ${q.frags.length}/5</div>`;
  if (k === 'volcano') prog = `<div class="small" style="margin-top:6px">紙條 ${q.notes.length}/3</div>` + q.notes.slice().sort().map(i => `<div class="riddle" style="font-size:13px;margin-top:4px">${NOTE_TXT[i]}</div>`).join('');
  if (k === 'snow' && q.read.tablet) prog = `<div class="riddle" style="font-size:13px;margin-top:6px">${TABLET_TXT}</div>`;
  el.innerHTML = `<b>探索日誌：${Q.title}</b><div class="small" style="color:var(--sub);margin-top:4px;line-height:1.6">${Q.hint}${ready ? '' : `<br>（線索目前被封印：先用${ZONES.find(z => z.id === Q.from).name}的史萊姆做出 ${Q.need} 個捏捏，目前 ${made}/${Q.need}）`}</div>${prog}`;
}

/* ============================================================
   史萊姆（細緻模型：水滴身體、內核、氣泡、眼睛、嘴巴、腮紅、底部滴落、品種特徵）
   ============================================================ */
let SLIME_GEO = null; const SCACHE = {};
function surf(x, y, z) { const l = Math.hypot(x, y, z) || 1; x /= l; y /= l; z /= l; if (y < 0) { y *= .2; x *= 1.06; z *= 1.06; } else { const t = Math.max(0, (y - .6) / .4), p = 1 - t * t * .3; x *= p; z *= p; y = y * .92 + t * t * t * .12; } return new THREE.Vector3(x, y, z); }
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
    const w = mesh(new THREE.SphereGeometry(.2, 22, 16), R.white, s * .3, .44, .78, eyes); w.scale.set(.9, 1.1, .45);
    const ir = mesh(new THREE.SphereGeometry(.15, 20, 14), R.iris, s * .3, .42, .83, eyes); ir.scale.set(.9, 1.05, .4);
    const pu = mesh(new THREE.SphereGeometry(.085, 14, 10), R.pupil, s * .3, .41, .87, eyes); pu.scale.set(.9, 1.05, .4);
    mesh(new THREE.SphereGeometry(.048, 10, 8), R.hl, s * .3 + .05, .5, .9, eyes); mesh(new THREE.SphereGeometry(.024, 8, 6), R.hl, s * .3 - .045, .35, .9, eyes);
    const ck = mesh(new THREE.CircleGeometry(.11, 20), R.blush, s * .56, .26, .74, face); ck.scale.set(1.3, .8, 1); ck.lookAt(s * 1.9, .26, 2.6);
  });
  const smile = mesh(new THREE.TorusGeometry(.055, .017, 8, 16, Math.PI), R.mouth, 0, .27, .91, face); smile.rotation.z = Math.PI;
  // 底部滴落
  if (!LOW) for (let i = 0; i < 3; i++) { const a = rnd(0, PI2), d = mesh(new THREE.SphereGeometry(.07, 10, 8), R.drip, Math.cos(a) * 1.02, -.02, Math.sin(a) * 1.02, body); d.scale.set(1, .6, 1); }
  // 品種特徵
  const F = new THREE.Group(); body.add(F); g.userData.feat = F;
  const m = (c, o = {}) => new THREE.MeshStandardMaterial(Object.assign({ color: c, roughness: .4 }, o));
  if (sp.id === 'grass') {
    const st = mesh(new THREE.CylinderGeometry(.025, .035, .32, 8), m('#3f7f45'), 0, 1.17, 0, F); void st;
    [-1, 1].forEach(s => { const l = mesh(new THREE.SphereGeometry(.2, 12, 8), m('#4ade80', { flatShading: true }), s * .17, 1.34, 0, F); l.scale.set(1, .18, .5); l.rotation.z = s * -.5; });
  } else if (sp.id === 'honey') {
    const hm = m('#f59e0b', { roughness: .1, transparent: true, opacity: .9 });
    for (let i = 0; i < 5; i++) { const a = i / 5 * PI2 + .3, d = onSurf(F, new THREE.SphereGeometry(.1, 10, 8), hm, [Math.cos(a) * .7, .7, Math.sin(a) * .7], .02); d.scale.set(.9, 2.2, .9); }
    const comb = mesh(new THREE.CylinderGeometry(.2, .2, .07, 6), m('#d97706', { flatShading: true }), .15, 1.0, -.05, F); comb.rotation.set(.3, 0, -.4);
    mesh(new THREE.CylinderGeometry(.14, .14, .08, 6), m('#fbbf24', { emissive: '#f59e0b', emissiveIntensity: .3 }), .15, 1.02, -.05, F).rotation.set(.3, 0, -.4);
  } else if (sp.id === 'salt') {
    const sm = m('#f8fafc', { roughness: .15, flatShading: true });
    for (let i = 0; i < 6; i++) { const a = i * 1.1, c = onSurf(F, new THREE.BoxGeometry(.11, .11, .11), sm, [Math.cos(a) * .45, .9, Math.sin(a) * .45], 0); c.rotation.set(rnd(0, 3), rnd(0, 3), rnd(0, 3)); }
  } else if (sp.id === 'coral') {
    const cm = m('#f472b6', { roughness: .5 }), tip = m('#fbcfe8');
    [[-.2, 0], [.18, .1], [0, -.2]].forEach(([x, z], i) => { const h = .35 + i * .08, b = mesh(new THREE.CylinderGeometry(.04, .06, h, 8), cm, x, .97 + h / 2, z, F); b.rotation.set(z * 1.5, 0, -x * 1.5); mesh(new THREE.SphereGeometry(.065, 10, 8), tip, x - x * .6, 1.0 + h, z - z * .4, F); });
  } else if (sp.id === 'lava') {
    const lm = glow('#fb923c'); for (let i = 0; i < 6; i++) { const a = rnd(0, PI2), c = onSurf(F, new THREE.BoxGeometry(.02, .02, .28), lm, [Math.cos(a), rnd(.1, .7), Math.sin(a)], 0); c.rotateY(rnd(0, 3)); }
    for (let i = 0; i < 4; i++) { const a = rnd(0, PI2), c = onSurf(F, new THREE.SphereGeometry(.16, 8, 6), m('#431407', { flatShading: true, roughness: .9 }), [Math.cos(a) * .6, .8, Math.sin(a) * .6], -.04); c.scale.set(1, .3, 1); }
    const fl = mesh(new THREE.ConeGeometry(.13, .4, 12), new THREE.MeshBasicMaterial({ color: '#fde047', transparent: true, opacity: .85, blending: THREE.AdditiveBlending, depthWrite: false }), 0, 1.27, 0, F); g.userData.flame = fl;
  } else if (sp.id === 'obsid') {
    const om = new THREE.MeshPhysicalMaterial({ color: '#2e1065', roughness: .05, metalness: .3, clearcoat: 1, flatShading: true });
    [[0, .9, -.4, 1.2], [.35, .7, -.55, .9], [-.35, .7, -.55, .9], [0, .5, -.85, .7]].forEach(([x, y, z, s]) => { const c = onSurf(F, new THREE.OctahedronGeometry(.16), om, [x, y, z], .1); c.scale.set(s * .7, s * 2, s * .7); });
  } else if (sp.id === 'ice') {
    const im = new THREE.MeshPhysicalMaterial({ color: '#e0f2fe', roughness: .05, clearcoat: 1, transparent: true, opacity: .85, emissive: '#7dd3fc', emissiveIntensity: .25 });
    for (let i = 0; i < 6; i++) { const a = i / 6 * PI2; const c = onSurf(F, new THREE.ConeGeometry(.07, .35, 6), im, [Math.cos(a) * .55, .85, Math.sin(a) * .55], .12); c.scale.y = .8 + (i % 2) * .5; }
  } else if (sp.id === 'aurora') {
    const orb = new THREE.Group(); orb.position.y = .7; body.add(orb); g.userData.orbit = orb;
    ['#22d3ee', '#a78bfa', '#34d399', '#f0abfc'].forEach((c, i) => mesh(new THREE.SphereGeometry(.06, 10, 8), glow(c), Math.cos(i / 4 * PI2) * 1.25, Math.sin(i * 2) * .2, Math.sin(i / 4 * PI2) * 1.25, orb));
    cyl(.015, .015, .35, 6, m('#c4b5fd'), 0, 1.22, 0, F); mesh(new THREE.OctahedronGeometry(.08), glow('#fde047'), 0, 1.44, 0, F);
  }
  if (sp.rar >= 3) { const halo = mesh(new THREE.TorusGeometry(.32, .03, 10, 40), new THREE.MeshBasicMaterial({ color: sp.rar >= 4 ? '#fde047' : '#f0abfc' }), 0, 1.7, 0, g); halo.rotation.x = Math.PI / 2; g.userData.halo = halo; }
  blobShadow(1.05, g, .03);
  g.userData.body = body; g.userData.eyes = eyes; body.userData.slimeRoot = g; return g;
}
function zoneSpawn(zid) {
  for (let k = 0; k < 80; k++) {
    let x, z;
    if (zid === 'forest') { x = rnd(-44, 44) * K; z = rnd(-44, 44) * K; if (Math.hypot(x, z) < 22) continue; }
    else if (zid === 'coast') { x = rnd(62, 82) * K; z = rnd(-38, 38) * K; }
    else if (zid === 'volcano') { x = rnd(-40, 40) * K; z = rnd(-60, -76) * K; if (Math.hypot(x, z + 96 * K) < 33 * K) continue; }
    else { x = rnd(-62, -96) * K; z = rnd(-38, 38) * K; }
    const h = H(x, z); if (h < 0 || h > 10 * K) continue; return [x, z];
  }
  return [0, 30];
}
function spawnSlime(zid, home) {
  const list = SPECIES.filter(s => s.zone === zid); let r = Math.random() * list.reduce((a, s) => a + s.w, 0), sp = list[0];
  for (const s of list) { if ((r -= s.w) <= 0) { sp = s; break; } }
  const [hx, hz] = home || zoneSpawn(zid), m = slimeMesh(sp);
  const sl = { id: ++W.sid, sc: rnd(.66, .86), sp, m, zid, hx, hz, x: hx + rnd(-3, 3), z: hz + rnd(-3, 3), vx: 0, vz: 0, ph: rnd(0, 6), hits: 0, cool: 0, sq: 0, blink: rnd(1, 4), yaw: rnd(0, 6), turn: rnd(1, 4), flee: 0 };
  m.scale.setScalar(sl.sc); m.userData.body.userData.sl = sl; W.scene.add(m); W.slimes.push(sl); return sl;
}
function spawnZone(zid) { if (W.spawned.has(zid)) return; W.spawned.add(zid); const n = LOW ? 14 : 22; for (let i = 0; i < n; i++) spawnSlime(zid); }
function spawnAllSlimes() { S.zones.forEach(spawnZone); }
function slimeStep(dt, t) {
  W.slimes.forEach(s => {
    const dx = s.x - P.x, dz = s.z - P.z, dist = Math.hypot(dx, dz); s.m.visible = dist < 60; if (!s.m.visible) return;
    s.ph += dt * 3; let vx = s.vx, vz = s.vz;
    if (s.mirror) { const k = Math.min(1, dt * 8); vx = (s.tx - s.x) * 4; vz = (s.tz - s.z) * 4; s.x += (s.tx - s.x) * k; s.z += (s.tz - s.z) * k; s.sq = Math.max(0, s.sq - dt * 3); } else {
    s.turn -= dt;
    if (s.turn < 0) { s.turn = rnd(1.5, 4); const a = Math.atan2(s.hz - s.z, s.hx - s.x) + rnd(-1.5, 1.5), far = Math.hypot(s.hx - s.x, s.hz - s.z) > 9; const sp = Math.random() < .3 ? 0 : rnd(.4, .9); s.vx = Math.cos(far ? Math.atan2(s.hz - s.z, s.hx - s.x) : a) * sp; s.vz = Math.sin(far ? Math.atan2(s.hz - s.z, s.hx - s.x) : a) * sp; }
    if (s.flee > 0) { s.flee -= dt; vx = dx / (dist || 1) * 2.5; vz = dz / (dist || 1) * 2.5; }
    const nx = s.x + vx * dt, nz = s.z + vz * dt, nh = H(nx, nz);
    if (nh > -.1 && Math.abs(nh - H(s.x, s.z)) < .5 && Math.hypot(nx, nz) > WS_R + 1) { s.x = nx; s.z = nz; } else s.turn = 0;
    s.cool = Math.max(0, s.cool - dt); s.sq = Math.max(0, s.sq - dt * 3); }
    const ph = Math.abs(Math.sin(s.ph)), cool = s.cool > 0, moving = Math.hypot(vx, vz) > .05, hop = cool || !moving ? Math.abs(Math.sin(s.ph * .5)) * .05 : ph * .45, b = s.m.userData.body;
    s.happy = Math.max(0, (s.happy || 0) - dt); s.m.position.set(s.x, G(s.x, s.z), s.z); b.position.y = hop + .02 + (s.happy > 0 ? Math.sin(s.happy / .6 * Math.PI) * .9 : 0);
    const k = cool ? .75 : 1, wob = Math.sin(t * 5 + s.ph) * .02;
    b.scale.set(.95 * k * (1 + s.sq * .25 + wob), .85 * k * (1 - s.sq * .3 - wob + (moving && !cool ? ph * .06 - (1 - ph) * .08 : 0)), .95 * k * (1 + s.sq * .25 + wob));
    b.material.opacity = cool ? .5 : .88;
    const want = dist < 7 ? Math.atan2(-dx, -dz) : (moving ? Math.atan2(vx, vz) : s.yaw); let d = want - s.yaw; d = Math.atan2(Math.sin(d), Math.cos(d)); s.yaw += d * Math.min(1, dt * 4); s.m.rotation.y = s.yaw;
    s.blink -= dt; s.m.userData.eyes.scale.y = s.blink < .12 ? .15 : (cool ? .35 : 1); if (s.blink < 0) s.blink = rnd(2, 5);
    const u = s.m.userData; if (u.halo) { u.halo.rotation.z = t; u.halo.position.y = 1.7 + hop + Math.sin(t * 2) * .05; }
    if (u.flame) { u.flame.scale.set(1 + Math.sin(t * 13 + s.ph) * .15, 1 + Math.sin(t * 9 + s.ph) * .3, 1); }
    if (u.orbit) u.orbit.rotation.y = t * 1.5;
  });
}
function slimeHitCore(sl) { if (sl.cool > 0) return { res: 'shy' }; sl.hits++; sl.sq = 1; sl.flee = .35; if (sl.hits >= 3) { sl.cool = 6; sl.hits = 0; sl.happy = .6; return { res: 'harvest' }; } return { res: 'hit', hits: sl.hits }; }
function hitSlime(sl) { if (sl.mirror) { netSend({ t: 'hit', id: sl.id }); sl.sq = 1; sfx.squish(.5); return; } applyHit(sl, slimeHitCore(sl)); }
function applyHit(sl, r) {
  const top = sl.m.position.clone().setY(sl.m.position.y + 1.6);
  if (r.res === 'shy') { fx3(top, '害羞中…', '#cbd5e1'); return; }
  sfx.squish(.8); if (navigator.vibrate) navigator.vibrate(8);
  if (r.res === 'harvest') { sl.happy = .6; const n = 1 + S.up.net; S.gel[sl.sp.id] = (S.gel[sl.sp.id] || 0) + n; discover(sl.sp.id); fx3(top, `+${n} ${short(sl.sp.id)}凝膠`, sl.sp.color, 'big'); sfx.pop(); if (W.C) { W.cFloor = sl.m.position.y + .05; W.C.emit(sl.m.position.clone().setY(sl.m.position.y + .9), 26, sl.sp.color, true); } toast(`採集到 ${n} 份${SP[sl.sp.id].name}凝膠`); renderHotbar(true); }
  else fx3(top, `${short(sl.sp.id)} ${r.hits}/3`, RAR[sl.sp.rar].c);
}

/* ============================================================
   玩家（第一人稱）與輸入
   ============================================================ */
let P = null;
const KEYS = new Set(), IN = { joy: null, jx: 0, jy: 0, run: false, look: null, drag: null };
const SENS = [.0016, .0025, .0038], SENS_N = ['低', '中', '高'];
function initPlayer() {
  const sp = S.pos && isFinite(S.pos.x) && isFinite(S.pos.z) ? S.pos : { x: 0, z: 16, yaw: 0 };
  P = { x: sp.x, z: sp.z, y: G(sp.x, sp.z), vy: 0, yaw: sp.yaw || 0, pitch: -.08, ground: true, r: .35, eye: 1.62, camY: G(sp.x, sp.z), bob: 0, stepT: 0 };
}
const locked = () => document.pointerLockElement === $('#worldCv');
function lockMouse() { if (TOUCH || GUI.kind || TITLE.on || CHAT.open || !$('#modal').hidden) return; try { const r = $('#worldCv').requestPointerLock(); if (r && r.catch) r.catch(() => { }); } catch (e) { } }
function unlockMouse() { if (locked()) { W.unlockByUs = true; document.exitPointerLock(); } }
function bindInput() {
  const cv = $('#worldCv');
  addEventListener('keydown', e => {
    if (e.target.tagName === 'INPUT') return;
    const k = e.code; if (!$('#modal').hidden || TITLE.on) return;
    if (k === 'Escape') { if (GUI.kind) closeGui(); else openGui('pause'); return; }
    if ((k === 'KeyT' || k === 'Enter') && NET.on && !GUI.kind) { e.preventDefault(); openChat(); return; }
    if (k === 'KeyI' || k === 'Tab') { e.preventDefault(); GUI.kind === 'inv' ? closeGui() : openGui('inv'); return; }
    if (GUI.kind) {
      if (GUI.kind === 'line' && M.active) { if (k === 'Space') { e.preventDefault(); if (!e.repeat) { makeAction('tap'); makeAction('hold', true); } } if (k === 'ArrowLeft' || k === 'KeyA') M.kdir = -1; if (k === 'ArrowRight' || k === 'KeyD') M.kdir = 1; }
      if (k === 'KeyE' && GUI.kind !== 'line' && !e.repeat) closeGui(); return;
    }
    KEYS.add(k); if (k === 'Space') e.preventDefault();
    if (k === 'KeyE' || k === 'KeyF') act();
    if (/^Digit[1-9]$/.test(k)) { S.hb = +k.slice(5) - 1; renderHotbar(true); }
  });
  addEventListener('keyup', e => { KEYS.delete(e.code); if (e.code === 'Space') makeAction('hold', false); if (['ArrowLeft', 'KeyA', 'ArrowRight', 'KeyD'].includes(e.code)) M.kdir = 0; });
  addEventListener('blur', () => KEYS.clear());
  cv.addEventListener('contextmenu', e => e.preventDefault());
  cv.addEventListener('wheel', e => { if (GUI.kind) return; S.hb = (S.hb + (e.deltaY > 0 ? 1 : 8)) % 9; renderHotbar(true); }, { passive: true });
  document.addEventListener('pointerlockchange', () => {
    $('#startHint').hidden = locked() || TOUCH || !!GUI.kind || TITLE.on;
    if (!locked() && !GUI.kind && !TOUCH && !W.unlockByUs && !TITLE.on && !CHAT.open && $('#modal').hidden) openGui('pause');
    W.unlockByUs = false;
  });
  document.addEventListener('mousemove', e => { if (!locked() || GUI.kind) return; const s = SENS[S.sens]; P.yaw -= e.movementX * s; P.pitch = clamp(P.pitch - e.movementY * s, -1.5, 1.5); });
  cv.addEventListener('pointerdown', e => {
    try { audio(); } catch (_) { }
    if (GUI.kind || TITLE.on) return;
    if (e.pointerType === 'touch') return;
    if (e.pointerType === 'mouse') {
      if (locked()) { if (e.button === 0 || e.button === 2) act(); return; }
      IN.drag = { x: e.clientX, y: e.clientY, moved: 0, id: e.pointerId }; lockMouse(); return;
    }
    // 觸控：左下半部為搖桿，其他區域拖曳轉視角、輕點互動
    const w = innerWidth, h = innerHeight;
    if (!IN.joy && e.clientX < w * .45 && e.clientY > h * .4) { IN.joy = { id: e.pointerId, x0: e.clientX, y0: e.clientY }; const jb = $('#joyBase'); jb.style.left = (e.clientX - 60) + 'px'; jb.style.top = (e.clientY - 60) + 'px'; jb.classList.add('on'); }
    else if (!IN.look) IN.look = { id: e.pointerId, x: e.clientX, y: e.clientY, sx: e.clientX, sy: e.clientY, t: performance.now(), moved: 0 };
  });
  bindTouch(cv);
  addEventListener('pointermove', e => {
    if (e.pointerType === 'touch') return;
    if (IN.joy && e.pointerId === IN.joy.id) { let dx = e.clientX - IN.joy.x0, dy = e.clientY - IN.joy.y0; const l = Math.hypot(dx, dy), m = 50; if (l > m) { dx *= m / l; dy *= m / l; } IN.jx = dx / m; IN.jy = dy / m; $('#joyKnob').style.transform = `translate(${dx}px,${dy}px)`; }
    if (IN.look && e.pointerId === IN.look.id) { const dx = e.clientX - IN.look.x, dy = e.clientY - IN.look.y; IN.look.x = e.clientX; IN.look.y = e.clientY; IN.look.moved += Math.abs(dx) + Math.abs(dy); const s = SENS[S.sens] * 2.2; P.yaw -= dx * s; P.pitch = clamp(P.pitch - dy * s, -1.5, 1.5); }
    if (IN.drag && e.pointerId === IN.drag.id && !locked()) { const s = SENS[S.sens] * 1.6, dx = e.movementX || 0, dy = e.movementY || 0; IN.drag.moved += Math.abs(dx) + Math.abs(dy); P.yaw -= dx * s; P.pitch = clamp(P.pitch - dy * s, -1.5, 1.5); }
  });
  const up = e => {
    if (e.pointerType === 'touch') return;
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
  if (h1 < -1.3) return false;
  const ux = dx / d, uz = dz / d, ha = G(P.x + ux * .7, P.z + uz * .7);
  if ((ha - h0) / .7 > 1.7 && ha > P.y + .7) return false;
  for (const c of colsNear(nx, nz)) {
    if (c.box) { const [x0, z0, x1, z1] = c.box, cx = clamp(nx, x0, x1), cz = clamp(nz, z0, z1), ddx = nx - cx, ddz = nz - cz, l = Math.hypot(ddx, ddz); if (l < P.r) { if (l < 1e-4) return false; nx = cx + ddx / l * P.r; nz = cz + ddz / l * P.r; } }
    else { const ddx = nx - c.x, ddz = nz - c.z, l = Math.hypot(ddx, ddz), R = c.r + P.r; if (l < R) { if (l < 1e-4) return false; nx = c.x + ddx / l * R; nz = c.z + ddz / l * R; } }
  }
  if (inCity(nx)) { if (Math.abs(nx - CITY.x) > 58 || Math.abs(nz - CITY.z) > 30) return false; }
  else if (Math.max(Math.abs(nx), Math.abs(nz)) > 125 * K) return false;
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
// 產線特寫鏡頭：放在天棚下方（原本在屋頂上方，畫面被屋頂整片擋住），
// 並依畫面比例拉遠，讓整條產線出現在下方介面之上的區域
function lineViewPose() {
  const vf = W.cam.fov * Math.PI / 180, dist = clamp(9.6 / (Math.tan(vf / 2) * W.cam.aspect), 8, 19), ly = W.lineG ? W.lineG.position.y : WS_Y, lz = W.lineG ? W.lineG.position.z : -8, y = ly + 4.7;
  const p = new THREE.Vector3(.4, y, lz + dist), pitch = Math.atan2(y - (ly + 1.5), dist) + vf * .24;
  return { p, t: p.clone().add(new THREE.Vector3(0, -Math.sin(pitch), -Math.cos(pitch))) };
}
function cameraStep(dt) {
  const cam = W.cam;
  if (GUI.kind === 'line') {
    const v = lineViewPose(), q = new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().lookAt(v.p, v.t, new THREE.Vector3(0, 1, 0)));
    cam.position.lerp(v.p, Math.min(1, dt * 4)); cam.quaternion.slerp(q, Math.min(1, dt * 4)); W.camAway = true; return;
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
  W.inter.forEach(it => { if (it.off) return; const p = it.hit.getWorldPosition(new THREE.Vector3()); if (Math.hypot(p.x - P.x, p.z - P.z) < 14) objs.push(it.hit); });
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
  else if (t.type === 'station') { const id = t.it.id; if (id === 'taxi') taxiAsk(); else if (id.startsWith('shop:')) openGui('shop', id.slice(5)); else if (id === 'altar') openAltar(); else openGui(id); }
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
function fx3(pos, txt, color = '#fff', cls = '') {
  const q = pos.clone().project(W.cam); if (q.z > 1) return;
  const d = document.createElement('div'); d.className = 'fx ' + cls; d.textContent = txt; d.style.left = (q.x * .5 + .5) * innerWidth + 'px'; d.style.top = (-q.y * .5 + .5) * innerHeight + 'px'; d.style.color = color;
  $('#fxl').appendChild(d); setTimeout(() => d.remove(), 1100);
}
function objective() {
  const gel = unlockedSpecies().some(s => (S.gel[s.id] || 0) >= 2);
  if (inCity()) {
    if (!ownAny()) return { t: '購買第一台機器', d: S.money >= OWN.slicer.cost ? '到路北側的「機械行」購買切片機。' : `切片機要 ${fmt(OWN.slicer.cost)}（目前 ${fmt(S.money)}），錢不夠就先回去多賺一點。`, x: CITY.x - 18, z: CITY.z - 13, c: '#22d3ee' };
    return { t: '逛逛大城市', d: '機械行、生活百貨、器材行都在路的北側。買完後搭計程車回月光谷。', x: CITY.x + 7, z: CITY.z + 11, c: '#facc15' };
  }
  if (!S.stock.length && !gel && !S.sales) return { t: '採集凝膠', d: '靠近史萊姆，對準後' + (TOUCH ? '點擊' : '按 E 或左鍵') + ' 3 次，收集至少 2 份凝膠。' };
  if (!S.stock.length && !S.sales) return { t: '手作第一個捏捏', d: '回到中央平地，使用「手作台」做出粗製捏捏。', x: BASE.bench[0], z: BASE.bench[1], c: '#fbbf24' };
  if (!S.sales) return { t: '上架到網站', d: '到「工作電腦」把沒玩過的捏捏上架到網站，等顧客下單。', x: BASE.pc[0], z: BASE.pc[1], c: '#818cf8' };
  if (!ownAny()) return { t: '存錢買機器', d: `存到 ${fmt(OWN.slicer.cost)} 後，搭出生點左邊的計程車到大城市購買切片機（目前 ${fmt(S.money)}）。`, x: BASE.taxi[0], z: BASE.taxi[1], c: '#facc15' };
  const k = nextQuest(), qt = questTarget();
  if (k) return { t: QUEST[k].title, d: questReady(k) ? (qt ? `前往${qt.n}。` : QUEST[k].hint) : `先用${ZONES.find(z => z.id === QUEST[k].from).name}的史萊姆做出 ${QUEST[k].need} 個捏捏（${madeIn(QUEST[k].from)}/${QUEST[k].need}）。`, x: qt && qt.x, z: qt && qt.z, c: '#c4b5fd' };
  return { t: '開設夢想捏捏博物館', d: '累積粉絲與營收，到工作電腦的圖鑑頁完成夢想。' };
}
let objSig = '';
function renderObjective() {
  const o = objective(), s = o.t + o.d; W.obj = o; if (s === objSig) return; objSig = s;
  $('#objective').innerHTML = `<b>目前目標</b>${esc(o.t)}<div style="color:#cbd5e1;font-size:12px">${esc(o.d)}</div>`;
}
let cmpSig = '';
function renderCompass() {
  const el = $('#cmpStrip'), w = el.clientWidth || 300, range = Math.PI * .75, items = [], o0 = W.obj;
  const sig = `${P.yaw.toFixed(3)}|${Math.round(P.x * 2)}|${Math.round(P.z * 2)}|${w}|${o0 && o0.x}|${o0 && o0.z}|${S.zones.length}`; if (sig === cmpSig) return; cmpSig = sig;
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
  $('#btnSound').textContent = '音效：' + (S.sound ? '開' : '關'); $('#btnSens').textContent = '靈敏度：' + SENS_N[S.sens];
}
function pickTrend() { trend.sp = pick(unlockedSpecies()).id; renderTop(); toast('流行色更新：' + SP[trend.sp].name + '（售價 ×1.35）'); }

/* ============================================================
   介面視窗（工作站 / 背包 / 選單）
   ============================================================ */
const GUI = { kind: null };
const GUIS = {
  line: { t: '加工產線', tabs: ['make'] }, decor: { t: '裝飾桌', tabs: ['decor'] }, live: { t: '直播台', tabs: ['live'] },
  pc: { t: '工作電腦', tabs: ['web', 'branch', 'codex'] }, bench: { t: '手作台', tabs: ['bench'] }, shop: { t: '大城市', tabs: ['mach', 'gear', 'mall'] }, mapg: { t: '古地圖石台', tabs: ['mapg'] }, inv: { t: '背包', tabs: ['inv', 'codex'] }, pause: { t: '選單', tabs: ['pause'] },
};
const TABN = { bench: '手作', mach: '機械行', gear: '器材行', mall: '生活百貨', mapg: '拼回地圖', make: '加工', decor: '裝飾', live: '直播', web: '網路商店', up: '升級', branch: '事業', codex: '圖鑑', inv: '背包', pause: '選單' };
let tab = '';
function openGui(kind, sec) {
  const g = GUIS[kind]; if (!g) return; unlockMouse(); GUI.kind = kind; sfx.open(); save(); if (kind === 'pause') S.savedAt = Date.now();
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
const PANEL = { mach: 'up', gear: 'up', mall: 'up' };
function showSec(sec) { tab = sec; $$('.panel').forEach(p => p.classList.toggle('on', p.id === 'p-' + (PANEL[sec] || sec))); renderGuiTabs(); RENDER[sec](); $('#gbody').scrollTop = 0; }
function closeGui() {
  if (!GUI.kind) return; if (GUI.kind === 'line' && M.active) { toast('產線還在運轉，請先完成這一輪加工。'); return; }
  if (L.watch) stopWatch();
  GUI.kind = null; tab = ''; $('#gui').hidden = true; $$('.panel').forEach(p => p.classList.remove('on')); save();
  renderHotbar(true); lockMouse(); $('#startHint').hidden = locked() || TOUCH;
}
function refresh() { if (GUI.kind && tab) RENDER[tab](); renderTop(); renderHotbar(); }

/* ---------- 加工：三台機器各有不同的操作流程 ---------- */
const M = { sp: null, step: -1, active: false, phase: '', pt: 0, g: null, scores: [], last: null, hold: false, kdir: 0 };
const MG = [
  { name: '切片', how: '游標由左往右掃過，經過每條切割線時按「切」。', key: '空白鍵' },
  { name: '裹糖晶', how: '按住讓滾筒加速、放開會減速，讓指針停在綠色區間越久越好。', key: '按住空白鍵' },
  { name: '乾燥', how: '拖曳火力旋鈕，讓它跟上不斷移動的黃色目標溫度。', key: '← → 或 A D' },
];
const lvlOf = i => S.up[MKEY[i]];
function startMake() {
  if (!ownAny()) return toast('還沒有任何加工機器，先搭計程車到大城市的機械行購買');
  const sp = M.sp; if (!sp || (S.gel[sp] || 0) < 2) return toast('凝膠不足（需要 2 份）');
  if (S.stock.length >= cap()) return toast('庫存已滿，請先銷售或升級倉儲貨架');
  S.gel[sp] -= 2; M.steps = [0, 1, 2].filter(i => S.own[MKEY[i]]); M.si = 0; M.step = M.steps[0]; M.scores = [null, null, null];
  M.active = true; M.last = null; MK.bx = -6.4; beginStep(); renderHotbar(true); renderMake();
}
function beginStep() {
  M.phase = 'ready'; M.pt = 1.4; M.hold = false; M.kdir = 0; const lv = lvlOf(M.step);
  if (M.step === 0) { const marks = []; for (let i = 0; i < 4; i++) marks.push(.15 + i * .22 + rnd(-.04, .04)); M.g = { t: 0, dur: 3.6, marks, hit: marks.map(() => null), tol: .045 + .012 * lv }; }
  else if (M.step === 1) { const w = .2 + .035 * lv, c = rnd(.45, .7); M.g = { t: 0, dur: 5, thr: 0, v: 0, inz: 0, lo: c - w / 2, hi: c + w / 2 }; }
  else M.g = { t: 0, dur: 5.5, knob: .5, err: 0, n: 0, tw: .07 + .015 * lv, seed: rnd(0, 10) };
}
const dryTarget = g => clamp(.5 + .28 * Math.sin(g.t * .9 + g.seed) + .12 * Math.sin(g.t * 2.3 + g.seed * 2), .08, .92);
function makeAction(kind, val) {
  if (!M.active) return; if (kind === 'hold') { M.hold = val; const b = $('#mgHold'); if (b) b.classList.toggle('on', !!val); return; }
  if (M.phase !== 'run') return; const g = M.g;
  if (M.step === 0 && kind === 'tap') {
    const pos = g.t / g.dur; let best = -1, bd = 1; g.marks.forEach((m, i) => { if (g.hit[i] == null) { const d = Math.abs(pos - m); if (d < bd) { bd = d; best = i; } } });
    MK.pulse[0] = .25; sfx.machine(0);
    if (best >= 0 && bd < g.tol * 2.2) { g.hit[best] = clamp(1 - Math.max(0, bd - g.tol * .4) / (g.tol * 1.8), 0, 1); } else sfx.squish(.4);
  }
  if (M.step === 2 && kind === 'knob') g.knob = clamp(val, 0, 1);
}
function makeTick(dt) {
  if (!M.active) return; const g = M.g;
  if (M.phase === 'ready') { M.pt -= dt; if (M.pt <= 0) { M.phase = 'run'; renderMake(); } return; }
  g.t += dt;
  if (M.step === 0) { const pos = g.t / g.dur; g.marks.forEach((m, i) => { if (g.hit[i] == null && pos > m + g.tol * 2.2) g.hit[i] = 0; }); }
  if (M.step === 1) { g.thr = clamp(g.thr + (M.hold ? 1.15 : -.95) * dt, 0, 1); g.v += (g.thr - g.v) * Math.min(1, dt * 2.5); if (g.v >= g.lo && g.v <= g.hi) g.inz += dt; MK.drumSpd = g.v; }
  if (M.step === 2) { g.knob = clamp(g.knob + M.kdir * dt * .9, 0, 1); g.err += Math.max(0, Math.abs(g.knob - dryTarget(g)) - g.tw * .5) * dt; g.n += dt; MK.heatLv = g.knob; }
  if (g.t >= g.dur) finishStep(); else updMakeUI();
}
function finishStep() {
  const g = M.g; let sc;
  if (M.step === 0) sc = g.hit.reduce((a, b) => a + (b || 0), 0) / g.marks.length;
  else if (M.step === 1) sc = clamp(g.inz / (g.dur * .8), 0, 1);
  else sc = clamp(1 - (g.err / Math.max(g.n, .01)) / .25, 0, 1);
  M.scores[M.step] = sc; sfx.machine(M.step); MK.pulse[M.step] = .7; M.hold = false; M.kdir = 0;
  toast(`${MG[M.step].name}：${sc > .9 ? '完美' : sc > .7 ? '很好' : sc > .45 ? '普通' : '失手了'}（${Math.round(sc * 100)}%）`);
  M.si++;
  if (M.si >= M.steps.length) {
    M.active = false; const avg = M.scores.reduce((a, b) => a + (b || 0), 0) / 3, p = makeProduct(M.sp, 0.15 + 0.85 * avg);
    S.stock.push(p); M.last = p; save(); setTimeout(() => sfx.pop(), 350); renderHotbar(true); renderQuest();
  } else { M.step = M.steps[M.si]; beginStep(); }
  renderMake();
}
function updMakeUI() {
  const g = M.g; if (!g) return; const tb = $('#mgTime'); if (tb) tb.style.width = clamp(g.t / g.dur, 0, 1) * 100 + '%';
  if (M.step === 0) { const c = $('#mgCur'); if (c) c.style.left = clamp(g.t / g.dur, 0, 1) * 100 + '%'; $$('#mgTrack .mark').forEach((m, i) => m.className = 'mark' + (g.hit[i] == null ? '' : g.hit[i] > .3 ? ' ok' : ' bad')); }
  if (M.step === 1) { const n = $('#mgNeedle'); if (n) n.style.left = g.v * 100 + '%'; }
  if (M.step === 2) { const t = $('#mgTgt'), k = $('#mgKnob'), x = dryTarget(g); if (t) { t.style.left = (x - g.tw) * 100 + '%'; t.style.width = g.tw * 200 + '%'; } if (k) k.style.left = g.knob * 100 + '%'; }
}
function swatch(sp) { return sp.color2 ? `linear-gradient(135deg,${sp.color},${sp.color2})` : `radial-gradient(circle at 30% 30%,${rgba(sp.color, 1, .6)},${sp.color})`; }
function renderMake() {
  $('#machLegend').hidden = M.active; $('#gelPick').hidden = M.active;
  $('#machLegend').innerHTML = MKEY.map((k, i) => `<span class="mlg">${STEPS[i]} · ${UPS[k].name}<span class="lv">${[0, 1, 2, 3, 4].map(j => `<i class="${j < S.up[k] ? 'on' : ''}"></i>`).join('')}</span></span>`).join('');
  $('#gelPick').innerHTML = unlockedSpecies().map(s => `<button class="zbtn ${M.sp === s.id ? 'on' : ''}" data-act="pickSp" data-id="${s.id}" ${M.active ? 'disabled' : ''}>${dot(s.color)}${short(s.id)}<br><small>凝膠 ${S.gel[s.id] || 0}</small></button>`).join('');
  const mini = $('#mini');
  if (M.active) {
    const g = M.g, st = `<div class="steps">${STEPS.map((x, i) => { const own = S.own[MKEY[i]], done = M.scores[i] != null && i !== M.step; return `<span class="${!own ? 'off' : i === M.step ? 'on' : done ? 'done' : ''}">${i + 1}. ${x}${!own ? '（未購買）' : done ? ' ' + Math.round(M.scores[i] * 100) + '%' : ''}</span>`; }).join('')}</div>`;
    const how = `<div class="mghow"><b>${UPS[MKEY[M.step]].name}</b>：${MG[M.step].how}${TOUCH ? '' : `<span style="color:var(--sub)">（${MG[M.step].key}）</span>`}${M.phase === 'ready' ? '<span class="ready">準備…</span>' : ''}</div>`;
    let body = '';
    if (M.step === 0) body = `<div class="track" id="mgTrack">${g.marks.map(m => `<i class="mark" style="left:${m * 100}%"></i>`).join('')}<i class="cur" id="mgCur" style="left:0"></i></div><button class="btn big" style="width:100%" data-mg="tap">切！</button>`;
    else if (M.step === 1) body = `<div class="gauge"><div class="gz" style="left:${g.lo * 100}%;width:${(g.hi - g.lo) * 100}%"></div><i class="needle" id="mgNeedle" style="left:0"></i></div><div class="tbar"><i id="mgTime"></i></div><button class="btn big hold" style="width:100%" id="mgHold" data-mg="hold">按住加速</button>`;
    else body = `<div class="track dry" id="mgDry"><div class="tgt" id="mgTgt"></div><div class="knob" id="mgKnob" style="left:50%"></div></div><div class="tbar"><i id="mgTime"></i></div><div class="hint" style="margin:0">左右拖曳火力旋鈕${TOUCH ? '' : '，或按 ← →'}</div>`;
    mini.innerHTML = st + how + body; updMakeUI();
  } else mini.innerHTML = `<div class="row"><div class="grow small">${M.sp ? `已選：<b>${SP[M.sp].name}</b>　消耗 2 凝膠` : '請先選擇要加工的凝膠'}<br><span style="color:var(--sub)">${ownAny() ? '已擁有：' + MKEY.filter(k => S.own[k]).map(k => UPS[k].name).join('、') + '。缺少的機器步驟以 0 分計算。' : '尚未購買任何機器。'}庫存 ${S.stock.length}/${cap()}</span></div><button class="btn" data-act="startMake" ${!M.sp || (S.gel[M.sp] || 0) < 2 ? 'disabled' : ''}>啟動產線</button></div>`;
  const r = $('#makeResult');
  if (M.last && !M.active) { const p = M.last, pct = Math.round(p.crisp * 100); r.innerHTML = `<div class="card item" style="cursor:default"><div class="sw" style="background:${swatch(SP[p.sp])};width:52px;height:52px"></div><div class="grow"><b>${SP[p.sp].name} · 酥脆捏捏</b><br>酥脆度 <b style="color:var(--warn)">${pct}%</b>　${pct >= 90 ? '極品' : pct >= 70 ? '優良' : '再接再厲'}<br><small style="color:var(--sub)">已放入背包。可拿到裝飾桌加工，或到直播台販售。</small></div></div>`; }
  else r.innerHTML = '';
}
// 加工小遊戲的指標操作
(() => {
  const mini = document.getElementById('mini');
  const knobAt = e => { const t = $('#mgDry'); if (!t) return; const b = t.getBoundingClientRect(); makeAction('knob', (e.clientX - b.left) / b.width); };
  mini.addEventListener('pointerdown', e => {
    const el = e.target.closest('[data-mg]'), dry = e.target.closest('#mgDry');
    if (el && el.dataset.mg === 'tap') { e.preventDefault(); makeAction('tap'); }
    if (el && el.dataset.mg === 'hold') { e.preventDefault(); try { el.setPointerCapture(e.pointerId); } catch (_) { } makeAction('hold', true); }
    if (dry) { e.preventDefault(); try { dry.setPointerCapture(e.pointerId); } catch (_) { } M.dragKnob = true; knobAt(e); }
  });
  mini.addEventListener('pointermove', e => { if (M.dragKnob) knobAt(e); });
  const up = () => { if (M.hold) makeAction('hold', false); M.dragKnob = false; };
  mini.addEventListener('pointerup', up); mini.addEventListener('pointercancel', up); mini.addEventListener('lostpointercapture', up);
})();

/* ---------- 庫存卡片 ---------- */
function itemHTML(p, act, selId, extra = '') {
  const sp = SP[p.sp];
  return `<div class="card item ${selId === p.id ? 'sel' : ''}" data-act="${act}" data-id="${p.id}"><div class="sw" style="background:${swatch(sp)}"></div><div><div class="nm">${p.crude ? '粗製' : ''}${short(p.sp)}</div><div class="meta">酥脆 ${Math.round(effCrisp(p) * 100)}% · 耐久 ${Math.round(p.dur)}%</div><div class="meta">${p.deco.length ? '裝飾 ' + p.deco.length : '無裝飾'} · 約 ${fmt(fair(p, 'live'))}${extra}</div></div></div>`;
}
const stockById = id => S.stock.find(p => p.id === +id);

/* ---------- 裝飾 ---------- */
const decorSt = makeStage($('#decorCv'), 'decor'); const D = { id: null };
decorSt.onSel = () => renderDecorTools();
function renderDecor() {
  if (!stockById(D.id)) D.id = S.stock.length ? S.stock[0].id : null;
  const p = stockById(D.id) || null; decorSt.set(p); setTimeout(decorSt.resize, 0);
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
const L = { on: false, hype: 0, viewers: 0, combo: 0, lastC: 0, stageId: null, saleT: 0, req: null, reqT: 18, chatT: 0, watch: null, rv: new Set() };
function chat(who, txt, cls) {
  const bx = $('#chat'), d = document.createElement('div'); d.innerHTML = `<b>${esc(who)}</b>：${esc(txt)}`; bx.appendChild(d); while (bx.children.length > 40) bx.firstChild.remove(); bx.scrollTop = bx.scrollHeight;
  if (tab === 'live' && (Math.random() < 0.45 || cls === 'dm')) { const dm = document.createElement('div'); dm.className = 'dmk'; dm.textContent = txt; dm.style.top = rnd(0, 75) + '%'; dm.style.color = pick(['#fff', '#fbbf24', '#22d3ee', '#e879f9']); $('#danmaku').appendChild(dm); setTimeout(() => dm.remove(), 7200); }
}
liveSt.onCrunch = (st, eff, info) => {
  if (L.watch || !L.on) return;
  if (NET.on && info) netEmit({ t: 'lcr', uv: info.uv, hit: info.hit, cr: info.cr, eff }); const now = performance.now(); L.combo = now - L.lastC < 1200 ? L.combo + 1 : 1; L.lastC = now; L.hype = Math.min(100, L.hype + 5 + Math.min(L.combo, 20) * .4);
  if (Math.random() < .4) chat(pick(NAMES), pick(CHAT_CRUNCH));
  if (Math.random() < .05 * clamp(L.viewers / 30, .3, 2)) { const n = Math.round(rnd(5, 30) * (1 + L.combo / 10)); addMoney(n); S.fans += 0.3; sfx.coin(); if (L.ss) L.ss.tips += n; const e = document.createElement('div'); e.className = 'don'; e.textContent = `${pick(NAMES)} 斗內 ${fmt(n)}`; $('#donate').appendChild(e); setTimeout(() => e.remove(), 3000); while ($('#donate').children.length > 3) $('#donate').firstChild.remove(); }
  renderTop();
};
const bestStock = () => S.stock.slice().sort((a, b) => ((b.dur > 0) - (a.dur > 0)) || (effCrisp(b) - effCrisp(a)))[0];
liveSt.onFlat = () => { const now = performance.now(); if (now - (L.flatWarn || 0) > 4000) { L.flatWarn = now; toast('這個捏捏已經被捏扁了，換一個上台吧'); } };
function renderLive() {
  const others = NET.on ? [...NET.players.entries()].filter(([id, p]) => id !== NET.me && p.live && p.live.on) : [];
  $('#liveOthers').innerHTML = others.length ? `<div class="card small row wrap"><span>其他玩家正在直播：</span>${others.map(([id, p]) => `<button class="btn sm ${L.watch && L.watch.id === id ? '' : 'ghost'}" data-act="watch" data-id="${esc(id)}">${esc(p.name)}（${p.live.viewers} 觀眾）</button>`).join('')}</div>` : '';
  const w = !!L.watch; liveSt.watch = w; $('#watchBar').hidden = !w; $('#liveOwn').hidden = w; $('#livePriceFold').hidden = w;
  if (w) { liveSt.set(L.watch.p); setTimeout(liveSt.resize, 0); updateLiveHUD(); return; }
  if (!stockById(L.stageId)) { const b = bestStock(); L.stageId = b ? b.id : null; } liveSt.set(stockById(L.stageId) || null); setTimeout(liveSt.resize, 0);
  $('#liveStock').innerHTML = S.stock.length ? S.stock.map(q => itemHTML(q, 'stageSel', L.stageId)).join('') : '<div class="empty">背包裡沒有捏捏，先到加工產線做一個。</div>';
  if (!$('#livePrice').contains(document.activeElement)) setHTML($('#livePrice'), priceTable('live'));
  $('#btnLive').textContent = L.on ? '結束直播' : '開始直播'; $('#btnLive').classList.toggle('red', L.on); updateLiveHUD();
}
function updateLiveHUD() {
  if (L.watch) { const pl = NET.players.get(L.watch.id), lv = pl && pl.live; $('#liveBadge').textContent = 'LIVE'; $('#liveBadge').className = 'badge on'; $('#liveViewers').textContent = `${L.watch.name} 的直播 · ${lv ? lv.viewers : 0} 觀眾`; $('#hypeBar').style.width = (lv ? lv.hype : 0) + '%'; $('#comboTxt').textContent = ''; $('#reqBox').innerHTML = L.watch.p ? '' : '<span class="reqb">等待主播畫面…</span>'; return; }
  $('#liveBadge').textContent = L.on ? 'LIVE' : 'OFF AIR'; $('#liveBadge').className = 'badge' + (L.on ? ' on' : '');
  $('#liveViewers').textContent = Math.round(L.viewers) + ' 觀眾'; $('#hypeBar').style.width = L.hype + '%'; $('#comboTxt').textContent = L.combo > 2 && L.on ? `${L.combo} 連擊` : '';
  const p = liveSt.p;
  $('#stageInfo').innerHTML = p ? `上台：<b>${SP[p.sp].name}</b>　酥脆 ${Math.round(effCrisp(p) * 100)}%　耐久 ${Math.round(p.dur)}%<br>售價 <b>${fmt(priceOf(p, 'live'))}</b>（合理價 ${fmt(fair(p, 'live'))}）` : '從下方選一個捏捏上台，按住它擠壓、滑動連續捏';
  $('#reqBox').innerHTML = L.req && L.on ? `<span class="reqb">觀眾指定：${L.req.text}　剩 ${Math.ceil(L.req.t)}s　（成交 ×1.8）</span>` : '';
}
function reqMatch(p) { return L.req && (L.req.kind === 'sp' ? p.sp === L.req.sp : effCrisp(p) >= .7); }
function liveSale(p) {
  let price = priceOf(p, 'live'), bonus = 1;
  if (reqMatch(p)) { bonus = 1.8; L.req = null; S.fans += 3; chat('系統', '指定任務完成！限時銷售成交！', 'dm'); }
  const gain = price * bonus; addMoney(gain); S.sales++; S.fans += 1 + L.hype / 30; S.stock = S.stock.filter(q => q !== p); sfx.coin();
  if (L.ss) { L.ss.sales++; L.ss.income += gain; }
  if (tab === 'live') popAt($('#liveWrap'), innerWidth / 2, $('#liveWrap').getBoundingClientRect().top + 70, `成交！${fmt(gain)}`, '#34d399');
  chat(pick(NAMES), `買了${short(p.sp)}捏捏！${fmt(gain)}`, 'dm'); toast(`直播成交 +${fmt(gain)}`);
  const next = S.stock.slice().sort((a, b) => (reqMatch(b) - reqMatch(a)) || ((b.dur > 0) - (a.dur > 0)) || (effCrisp(b) - effCrisp(a)))[0]; L.stageId = next ? next.id : null;
  if (!next) toast('背包裡的捏捏賣光了！回加工產線補貨吧');
  if (tab === 'live') renderLive(); renderTop(); renderHotbar(); save(); liveBroadcast();
}
function updateLive(dt) {
  const p = stockById(L.stageId);
  if (L.on) {
    L.hype = Math.max(0, L.hype - 3 * dt); if (performance.now() - L.lastC > 1500) L.combo = 0;
    const tgt = (12 + S.fans * 0.8) * (1 + .15 * S.up.gear) * (.4 + L.hype / 60) * (p ? 1 : .5) + L.rv.size * 15; L.viewers += (tgt - L.viewers) * dt * .8; L.saleT += dt;
    if (L.saleT >= 1.5) { L.saleT = 0; if (p) { const f = fair(p, 'live'), d0 = demand(priceOf(p, 'live'), f), d = d0 * (reqMatch(p) ? 1.6 : 1); if (d0 < .2 && Math.random() < .3) chat(pick(NAMES), pick(CHAT_EXPENSIVE)); if (Math.random() < clamp(L.viewers / 60, 0, 1) * d * .45 * (.4 + L.hype / 80)) liveSale(p); } }
    L.chatT -= dt; if (L.chatT <= 0) { L.chatT = rnd(1.5, 4) / clamp(L.viewers / 20, .5, 4); chat(pick(NAMES), pick(CHAT_IDLE)); }
    if (L.req) { L.req.t -= dt; if (L.req.t <= 0) { L.req = null; chat('系統', '指定任務已結束', 'dm'); } }
    else { L.reqT -= dt; if (L.reqT <= 0) { L.reqT = rnd(25, 40); if (Math.random() < .6) { const has = [...new Set(S.stock.map(p => p.sp))], id = has.length && Math.random() < .7 ? pick(has) : pick(unlockedSpecies()).id; L.req = { kind: 'sp', sp: id, t: 40, text: `要「${SP[id].name}」` }; } else L.req = { kind: 'cr', t: 40, text: '要酥脆度 ≥ 70% 的' }; chat('系統', '新的觀眾指定：' + L.req.text, 'dm'); } }
  } else { L.hype = Math.max(0, L.hype - 10 * dt); L.viewers = Math.max(0, L.viewers - dt * 10); L.combo = 0; L.req = null; }
}

function toggleLive() {
  if (!L.on) {
    if (!S.stock.length) { sfx.bad(); return toast('背包裡沒有捏捏，先到加工產線做一個吧'); }
    if (!stockById(L.stageId)) L.stageId = bestStock().id;
    L.on = true; L.ss = { sales: 0, income: 0, tips: 0, fans: S.fans, t0: Date.now() }; L.reqT = Math.min(L.reqT, 14);
    chat('系統', '直播開始！歡迎大家', 'dm'); sfx.level(); if (!S.tipLive) { S.tipLive = true; toast('按住捏捏擠壓、滑動或連續點擊，連擊越多熱度越高'); }
  } else {
    L.on = false; const ss = L.ss; L.ss = null; chat('系統', '直播結束，感謝收看', 'dm');
    if (ss && (ss.sales || ss.tips || Date.now() - ss.t0 > 15000)) modal(`<h2>本場直播回顧</h2><div class="sumg"><div><b>${ss.sales}</b><span>售出件數</span></div><div><b>${fmt(ss.income)}</b><span>銷售收入</span></div><div><b>${fmt(ss.tips)}</b><span>觀眾斗內</span></div><div><b>+${Math.floor(S.fans - ss.fans)}</b><span>新增粉絲</span></div></div><p class="small" style="color:var(--sub);text-align:center">直播時長 ${Math.max(1, Math.round((Date.now() - ss.t0) / 1000))} 秒</p>`);
    else toast('直播結束');
  }
  renderLive(); save();
}

/* ---------- 定價 ---------- */
function priceTable(ch) {
  const list = SPECIES.filter(s => S.codex[s.id]); if (!list.length) return '<div class="empty">尚未收集任何史萊姆。</div>';
  return list.map(s => { const f = fair({ sp: s.id, crisp: .8, dur: 100, deco: [] }, ch), l = demandLabel(demand(getPrice(ch, s.id), f));
    return `<div class="prow"><span class="nm">${dot(s.color)}${s.name}${trend.sp === s.id ? ' <span class="tag">流行</span>' : ''}<br><small style="color:var(--sub)">基準合理價 ${fmt(f)}</small></span><input type="number" min="1" max="99999" value="${getPrice(ch, s.id)}" data-price="${ch}" data-sp="${s.id}"><span class="dem" style="color:${l[1]}">${l[0]}</span></div>`; }).join('');
}
document.addEventListener('change', e => { const t = e.target; if (!t.dataset || !t.dataset.price) return; S.price[t.dataset.price][t.dataset.sp] = clamp(Math.round(+t.value) || 1, 1, 99999); save(); t.blur(); t.dataset.price === 'live' ? renderLive() : renderWeb(); });

/* ---------- 網站 ---------- */
const rating = () => { const a = S.rate.slice(-20); return a.reduce((x, y) => x + y, 0) / a.length; };
function webTick() {
  if (!S.web.length || Math.random() > clamp(0.25 + S.fans / 400 + (rating() - 3) * .1, .05, .9)) return null;
  const p = pick(S.web), f = fair(p, 'web'), price = priceOf(p, 'web'); if (Math.random() > demand(price, f) * .7) return null;
  addMoney(price); S.sales++; S.fans += .3; S.web = S.web.filter(q => q !== p);
  const stars = clamp(Math.round(1 + 2.2 * effCrisp(p) + 1.8 * clamp(f / price, 0, 1.3)), 1, 5); S.rate.push(stars); if (S.rate.length > 40) S.rate.shift();
  S.reviews.unshift({ s: stars, t: pick(REVIEWS[stars]), who: pick(NAMES), sp: SP[p.sp].name }); S.reviews.length = Math.min(S.reviews.length, 8); return { price, stars };
}
function renderWeb() {
  const r = rating();
  setHTML($('#webInfo'), `<div class="row"><div class="grow">店鋪評分 <b class="stars">${'★'.repeat(Math.round(r))}${'☆'.repeat(5 - Math.round(r))}</b> ${r.toFixed(1)}　粉絲 ${Math.floor(S.fans)}</div><div class="small">貨架 ${S.web.length}/${slots()}</div></div>`);
  setHTML($('#webShelf'), S.web.length ? S.web.map(p => itemHTML(p, 'unlist', null, ` · 售 ${fmt(priceOf(p, 'web'))}`)).join('') : '<div class="empty">貨架空空如也，從下方上架商品。</div>');
  setHTML($('#webStock'), S.stock.length ? S.stock.map(p => itemHTML(p, 'list', null, p.played || p.dur < 100 ? ' · 已玩過，不能上架' : '')).join('') : '<div class="empty">背包裡沒有捏捏。</div>');
  if (!$('#webPrice').contains(document.activeElement)) setHTML($('#webPrice'), priceTable('web'));
  setHTML($('#reviews'), S.reviews.length ? S.reviews.map(v => `<div><span class="stars">${'★'.repeat(v.s)}</span> ${esc(v.who)}：${esc(v.t)} <small style="color:var(--sub)">（${esc(v.sp)}）</small></div>`).join('') : '尚無評價');
}

/* ---------- 升級 ---------- */
const upCost = k => Math.round(UPS[k].base * Math.pow(1.7, S.up[k]));
const lvBar = (lv, max) => `<span class="lv">${Array.from({ length: max }, (_, j) => `<i class="${j < lv ? 'on' : ''}"></i>`).join('')}</span>`;
function renderUp() {
  const row = k => { const u = UPS[k], lv = S.up[k], max = lv >= u.max; return `<div class="card up"><div class="info"><b>${u.name}</b>${lvBar(lv, u.max)}<div class="small" style="color:var(--sub)">${u.desc}</div></div><button class="btn sm" data-act="buyUp" data-k="${k}" ${max || S.money < upCost(k) ? 'disabled' : ''}>${max ? '已滿級' : fmt(upCost(k))}</button></div>`; };
  let h = '<h3>產線機器</h3>' + Object.keys(UPS).filter(k => UPS[k].mach).map(row).join('') + '<h3>設施與裝備</h3>' + Object.keys(UPS).filter(k => !UPS[k].mach).map(row).join('');
  h += '<h3>裝飾零件包</h3>' + Object.keys(PACKS).map(k => { const has = S.packs.includes(k), pk = PACKS[k], items = Object.values(DECO).filter(d => d.pack === k).map(d => dot(d.c) + d.n).join('　'); return `<div class="card up"><div class="info"><b>${pk.name}</b><div class="small" style="color:var(--sub)">${items}</div></div><button class="btn sm" data-act="buyPack" data-k="${k}" ${has || S.money < pk.cost ? 'disabled' : ''}>${has ? '已擁有' : fmt(pk.cost)}</button></div>`; }).join('');
  setHTML($('#upList'), h);
}

/* ---------- 中期三線 ---------- */
const BT = { fac: 0, ct: 0, sc: 0 };
const branchReady = () => !S.branch && S.earned >= 2500 && S.fans >= 60;
function checkBranch() {
  if (branchReady() && !S.seen_branch) { S.seen_branch = true; modal(`<h2>工坊的轉捩點</h2><p>你的捏捏已經小有名氣，累積營收 ${fmt(S.earned)}、粉絲 ${Math.floor(S.fans)}。<br>三條道路擺在眼前，玩法與劇情都不同（一旦選擇就無法更改）：</p><p>${Object.values(BRANCHES).map(b => `<b>${b.name}</b>：${b.desc}`).join('<br><br>')}</p><p>到工坊的「工作電腦 → 事業」做出選擇。</p>`); }
}
const fmtSec = s => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
function tickTimers() {
  const now = Date.now();
  $$('[data-dl]').forEach(e => { e.textContent = fmtSec(Math.max(0, Math.ceil((+e.dataset.dl - now) / 1000))); });
  $$('[data-dlbar]').forEach(e => { e.style.width = clamp((+e.dataset.dlbar - now) / 450, 0, 100).toFixed(1) + '%'; });
}
function renderBranch() { renderBranch0(); tickTimers(); }
function renderBranch0() {
  const bx = { set innerHTML(h) { setHTML($('#branchBody'), h); } }, fw = $('#facWrap'), showFac = S.branch === 'factory';
  if (fw.hidden === showFac) { fw.hidden = !showFac; if (showFac) setTimeout(() => { initFac(); FAC.v && FAC.v.resize(); }, 0); }
  if (!S.branch) { bx.innerHTML = `<h2>選擇你的事業道路</h2><div class="bgroup">${Object.keys(BRANCHES).map(k => `<div class="card"><b>${BRANCHES[k].name}</b><div class="small" style="color:var(--sub);margin:6px 0">${BRANCHES[k].desc}</div><button class="btn" data-act="chooseBranch" data-k="${k}" ${branchReady() ? '' : 'disabled'}>選擇此道路</button></div>`).join('')}</div>${branchReady() ? '' : '<div class="hint">需要累積營收 ¥2,500 且粉絲 60 才能做出選擇。</div>'}`; return; }
  if (S.branch === 'factory') {
    const hc = Math.round(400 * Math.pow(1.5, S.workers)), ac = Math.round(600 * Math.pow(1.8, S.auto));
    bx.innerHTML = `<h2>自家工廠</h2><div class="hint">每位員工操作一台機械手臂，每 12 秒自動消耗 2 凝膠製作 1 個捏捏（品質取決於自動化等級），並持續領薪（每人 ¥3/分鐘）。凝膠不足或庫存滿時停工。</div>
    <div class="card"><div>員工／機械手臂 <b>${S.workers}</b>　薪資 ${fmt(S.workers * 3)}/分<br>自動化 Lv${S.auto}（品質 ${Math.round((0.55 + 0.05 * S.auto) * 100)}%）</div><div class="row wrap" style="margin-top:8px"><button class="btn sm" data-act="hire" ${S.money < hc || S.workers >= 12 ? 'disabled' : ''}>增設手臂並雇用 ${fmt(hc)}</button><button class="btn sm ghost" data-act="auto" ${S.money < ac || S.auto >= 8 ? 'disabled' : ''}>升級自動化 ${fmt(ac)}</button></div></div>
    <div class="card small">庫存 ${S.stock.length}/${cap()}　凝膠合計 ${Object.values(S.gel).reduce((a, b) => a + b, 0)}</div>`;
  } else if (S.branch === 'corp') {
    bx.innerHTML = `<h2>企業合作</h2><div class="hint">大公司定期釋出訂單，報酬約為合理價 ×1.5，但需在期限內交付足夠品質的商品。逾期會損失信譽。</div><div class="card small">企業信譽 <b>${S.rep}</b>　承接中 ${S.contracts.length}/3</div>` +
      (S.contracts.length ? S.contracts.map(c => { const ok = contractItems(c); return `<div class="card"><b>${c.sp === 'any' ? '任意種類' : SP[c.sp].name}</b> × ${c.n}　酥脆 ≥ ${Math.round(c.min * 100)}%<br>報酬 <b style="color:var(--warn)">${fmt(c.reward)}</b>　剩餘 <b data-dl="${c.dl}"></b><div class="row" style="margin-top:6px"><span class="small grow">符合庫存 ${ok.length}/${c.n}</span><button class="btn sm" data-act="deliver" data-id="${c.id}" ${ok.length < c.n ? 'disabled' : ''}>交貨</button></div></div>`; }).join('') : '<div class="empty">目前沒有訂單，請稍候…</div>');
  } else {
    bx.innerHTML = `<h2>溫馨小店</h2><div class="hint">顧客會上門指定想要的種類。滿足熟客可累積好感度，熟客會給更高價與小費。顧客等太久會失望離開。</div><div class="card small">熟客 ${Object.values(S.regulars).filter(v => v >= 5).length} 位（好感 ≥ 5）</div>` +
      (S.customers.length ? S.customers.map(c => { const ok = shopItem(c), aff = S.regulars[c.name] || 0; return `<div class="card"><b>${esc(c.name)}</b> ${aff >= 5 ? '<span class="tag">熟客</span>' : ''} <small style="color:var(--sub)">好感 ${aff}</small><br>想要：<b>${SP[c.sp].name}</b>　酥脆 ≥ ${Math.round(c.min * 100)}%<div class="meter2" style="margin:6px 0"><i data-dlbar="${c.dl}"></i></div><button class="btn sm" data-act="serve" data-id="${c.id}" ${ok ? '' : 'disabled'}>${ok ? `出貨 ${fmt(shopPrice(c, ok))}` : '背包沒有符合商品'}</button></div>`; }).join('') : '<div class="empty">店裡暫時沒有客人…</div>');
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
function chooseBranch(k) {
  if (S.branch || !branchReady() || !BRANCHES[k]) return; const b = BRANCHES[k];
  modal(`<h2>選擇「${b.name}」？</h2><p>${b.desc}</p><p class="small" style="color:var(--sub)">選擇後無法更改。</p>`, [{ t: '再想想', ghost: true }, { t: '確定選擇', f: () => { if (S.branch || !branchReady()) return; S.branch = k; save(); sfx.level(); renderGuiTabs(); renderBranch(); toast('已選擇：' + b.name); } }]);
}

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
const RENDER = { bench: renderBench, mach: () => renderShop('mach'), gear: () => renderShop('gear'), mall: () => renderShop('mall'), mapg: renderMapGame, make: renderMake, decor: renderDecor, live: renderLive, web: renderWeb, up: renderUp, branch: renderBranch, codex: renderCodex, inv: renderInv, pause: renderPause };

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
    case 'pickSp': M.sp = id; M.last = null; tab === 'bench' ? renderBench() : renderMake(); break;
    case 'startMake': startMake(); break;
    case 'decoSel': D.id = +id; renderDecor(); break;
    case 'addDeco': { const p = decorSt.p; if (!p) return; if (p.deco.length >= 6) return toast('最多 6 個零件'); p.deco.push({ k, x: rnd(-.45, .45), z: rnd(-.45, .45), s: 1, r: 0 }); decorSt.sel = p.deco.length - 1; decorSt.rebuildDeco(); sfx.tick(); renderDecorTools(); save(); break; }
    case 'delDeco': { const p = decorSt.p; if (p && decorSt.sel >= 0) { p.deco.splice(decorSt.sel, 1); decorSt.sel = -1; decorSt.rebuildDeco(); renderDecorTools(); save(); } break; }
    case 'photo': { if (!decorSt.ready) return; decorSt.selRing.visible = false; decorSt.v.render(); const a2 = document.createElement('a'); a2.download = 'squish-lab.png'; a2.href = decorSt.cv.toDataURL('image/png'); a2.click(); toast('已儲存圖片'); break; }
    case 'toggleLive': toggleLive(); setTimeout(liveBroadcast, 50); break;
    case 'stageSel': L.stageId = +id; renderLive(); liveBroadcast(); break;
    case 'watch': startWatch(id); break;
    case 'unwatch': stopWatch(); renderLive(); break;
    case 'lchatSend': sendLiveChat(); break;
    case 'donate': donate(); break;
    case 'chat': openChat(); break;
    case 'saveNow': save(); S.savedAt = Date.now(); toast('遊戲已儲存'); renderPause(); break;
    case 'toTitle': save(); netLeave(true); showTitle(); break;
    case 'netLeave': netLeave(); renderPause(); break;
    case 'tContinue': startPlay(); break;
    case 'tNew': if (localStorage.getItem(SAVE_KEY)) modal('<h2>開始新遊戲？</h2><p>目前的存檔會被清除，無法復原。</p>', [{ t: '取消', ghost: true }, { t: '確定', f: newGame }]); else newGame(); break;
    case 'tMulti': $('#titleMain').hidden = true; $('#titleMp').hidden = false; $('#mpName').value = S.name || ''; break;
    case 'tBack': $('#titleMain').hidden = false; $('#titleMp').hidden = true; break;
    case 'mpHost': netHost(); break;
    case 'mpJoin': netJoin($('#mpCode').value); break;
    case 'list': { const p = stockById(id); if (!p) return; if (p.played || p.dur < 100) return toast('玩過的捏捏不能上架到網站，只能在直播或其他通路販售'); if (S.web.length >= slots()) return toast('貨架已滿，請升級網站伺服器'); S.stock = S.stock.filter(q => q !== p); S.web.push(p); renderWeb(); renderHotbar(); save(); break; }
    case 'unlist': { const p = S.web.find(q => q.id === +id); if (!p) return; if (S.stock.length >= cap()) return toast('庫存已滿'); S.web = S.web.filter(q => q !== p); S.stock.push(p); renderWeb(); renderHotbar(); save(); break; }
    case 'buyOwn': buyOwn(k); break;
    case 'benchMake': benchMake(); break;
    case 'taxiGo': taxiRide(); break;
    case 'mapRot': mapRotate(+el.dataset.i); break;
    case 'buyUp': { if (!UPS[k]) return; const c = upCost(k); if (S.money < c || S.up[k] >= UPS[k].max || (UPS[k].need && !S.own[UPS[k].need])) return; S.money -= c; S.up[k]++; sfx.level(); toast(`${UPS[k].name} 升到 Lv${S.up[k]}`); (PANEL[tab] ? renderShop(tab) : renderUp()); renderTop(); save(); break; }
    case 'buyPack': { const pk = PACKS[k]; if (!pk || S.packs.includes(k) || S.money < pk.cost) return; S.money -= pk.cost; S.packs.push(k); sfx.level(); toast(`已解鎖${pk.name}`); (PANEL[tab] ? renderShop(tab) : renderUp()); renderTop(); save(); break; }
    case 'chooseBranch': chooseBranch(k); break;
    case 'hire': { const c = Math.round(400 * Math.pow(1.5, S.workers)); if (S.money >= c) { S.money -= c; S.workers++; renderBranch(); renderTop(); save(); } break; }
    case 'auto': { const c = Math.round(600 * Math.pow(1.8, S.auto)); if (S.money >= c) { S.money -= c; S.auto++; renderBranch(); renderTop(); save(); } break; }
    case 'deliver': { const c = S.contracts.find(x => x.id === +id); if (!c) return; const it = contractItems(c); if (it.length < c.n) return; S.stock = S.stock.filter(p => !it.includes(p)); S.contracts = S.contracts.filter(x => x !== c); addMoney(c.reward); S.rep++; S.fans += 2; sfx.pop(); toast(`交貨完成 +${fmt(c.reward)}`); refresh(); save(); break; }
    case 'serve': { const c = S.customers.find(x => x.id === +id); if (!c) return; const p = shopItem(c); if (!p) return; const pr = shopPrice(c, p), aff = S.regulars[c.name] || 0, tip = aff >= 5 ? Math.round(pr * .15) : 0; S.stock = S.stock.filter(q => q !== p); S.customers = S.customers.filter(x => x !== c); S.regulars[c.name] = aff + 1; addMoney(pr + tip); S.fans += 1; sfx.pop(); toast(`${c.name} 滿意離開 +${fmt(pr + tip)}${tip ? '（含小費）' : ''}`); refresh(); save(); break; }
    case 'finish': finish(); break;
    case 'sound': S.sound = !S.sound; renderTop(); save(); if (TITLE.on) renderTitle(); break;
    case 'sens': S.sens = (S.sens + 1) % 3; renderTop(); save(); break;
    case 'help': showHelp(); break;
    case 'home': P.x = 0; P.z = 16; P.y = G(0, 16); P.yaw = 0; closeGui(); toast('已傳送回中央平地入口'); break;
    case 'reset': modal('<h2>重置存檔？</h2><p>所有進度將被清除，無法復原。</p>', [{ t: '取消', ghost: true }, { t: '確定重置', f: newGame }]); break;
  }
});
// 加工的「停機」用 pointerdown 觸發：比 click 少一個放開手指的延遲，計時更準
function showHelp() {
  const keys = TOUCH
    ? '<div class="keys"><kbd>左下</kbd><span>拖曳虛擬搖桿移動</span><kbd>右側</kbd><span>滑動轉動視角，輕點物件即可互動</span><kbd>手掌</kbd><span>對準準心的物件互動（採集、使用工作站）</span><kbd>箭頭</kbd><span>跳躍</span><kbd>閃電</kbd><span>切換奔跑</span><kbd>右上</kbd><span>背包、選單</span></div>'
    : '<div class="keys"><kbd>WASD</kbd><span>移動</span><kbd>滑鼠</kbd><span>環顧四周（點擊畫面鎖定滑鼠）</span><kbd>E / 左鍵</kbd><span>互動：採集史萊姆、使用工作站、調查線索</span><kbd>空白鍵</kbd><span>跳躍（加工時為停機）</span><kbd>Shift</kbd><span>奔跑</span><kbd>1–9 / 滾輪</kbd><span>選擇快捷列</span><kbd>I / Tab</kbd><span>背包與探索日誌</span><kbd>Esc</kbd><span>關閉介面／選單</span></div>';
  modal(`<h2>操作說明</h2>${keys}<p class="small" style="color:var(--sub);margin-top:10px">遊戲循環：採集凝膠 → 工坊加工 → 裝飾 → 直播或網站販售 → 升級。山脊上的能量門要解開前一區的謎題才會開啟。</p>`);
}
function showIntro() {
  S.seen = true; save();
  modal(`<h2>歡迎來到月光谷</h2><p>月光谷的史萊姆誕生於月光與露水交融之處。你繼承了奶奶留下的一塊空地和一台舊電腦，要從零開始，把史萊姆的可再生凝膠做成世上最療癒的酥脆捏捏。</p>
  <p><b>怎麼玩</b>：在森林裡自由走動，對準史萊姆採集凝膠；回到中央平地，用手作台做出粗製捏捏，再用工作電腦把它們掛到網站上賣（一個 ¥10）。存到錢後，搭出生點左邊的計程車到大城市，購買加工機器、裝飾桌與直播設備。</p>
  <p><b>探索</b>：森林被山脊環繞，東、北、西三座能量門通往海岸、火山與雪原。尋找線索、解開謎題，就能發現新區域。左上角會顯示目前目標，指南針會標出方向。</p>`, [{ t: '操作說明', ghost: true, f: showHelp }, { t: '開始探索' }]);
}

/* ============================================================
   主選單（開始畫面）
   ============================================================ */
const TITLE = { on: false };
function fmtTime(t) { if (!t) return '—'; const d = new Date(t); return `${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`; }
function renderTitle() {
  const has = !!localStorage.getItem(SAVE_KEY) && S.seen;
  $('#titleMain').innerHTML = (has ? `<button class="btn big" data-act="tContinue">繼續遊戲</button>` : `<button class="btn big" data-act="tContinue">開始遊戲</button>`) +
    (has ? `<button class="btn big ghost" data-act="tNew">新遊戲</button>` : '') +
    `<button class="btn big ghost" data-act="tMulti">多人遊戲</button>
     <div class="row"><button class="btn ghost grow" data-act="help">操作說明</button><button class="btn ghost grow" data-act="sound" id="tSound">音效：${S.sound ? '開' : '關'}</button></div>`;
  $('#titleFoot').innerHTML = has ? `存檔：${fmtTime(S.last)} · ${fmt(S.money)} · 粉絲 ${Math.floor(S.fans)} · 已發現區域 ${S.zones.length}/4` : '月光谷正在等待新的工坊主人';
  $('#titleMain').hidden = false; $('#titleMp').hidden = true;
}
function showTitle() {
  if (GUI.kind) { GUI.kind = null; tab = ''; $('#gui').hidden = true; $$('.panel').forEach(p => p.classList.remove('on')); }
  if (L.watch) L.watch = null; L.on = false; M.active = false;
  unlockMouse(); TITLE.on = true; document.body.classList.add('titleon'); $('#title').hidden = false; $('#startHint').hidden = true; renderTitle();
}
function startPlay() {
  TITLE.on = false; document.body.classList.remove('titleon'); $('#title').hidden = true;
  $('#startHint').hidden = TOUCH || locked(); W.camAway = false; toast('歡迎來到月光谷。左上角是目前目標。');
  if (!S.seen) showIntro();
}
function newGame() { NOSAVE = true; netLeave(true); localStorage.removeItem(SAVE_KEY); sessionStorage.setItem('squish_autostart', '1'); location.reload(); }
function titleStep(dt) {
  W.t += dt; slimeStep(dt, W.t); lineStep(dt); W.anim.forEach(f => f(dt, W.t)); envStep(dt);
  const a = W.t * .04; W.cam.position.set(Math.sin(a) * 30, 13 + Math.sin(W.t * .1) * 2, Math.cos(a) * 30); W.cam.lookAt(0, 2.5, 0);
  W.r.render(W.scene, W.cam);
}
function renderPause() {
  renderTop();
  $('#saveInfo').textContent = '上次儲存：' + fmtTime(S.last) + '　（按 Esc、切換畫面、開關介面時都會自動儲存）';
  $('#pauseNet').innerHTML = NET.on ? `<div class="card small"><b>多人房間 ${esc(NET.room)}</b>${NET.host ? '（你是房主）' : ''}<br>把房間代碼分享給朋友，就能一起玩。<div style="margin:6px 0;color:var(--sub)">${[...NET.players.values()].map(p => `${dot(p.color || '#22d3ee')}${esc(p.name || '玩家')}${p.live && p.live.on ? ' · 直播中' : ''}`).join('<br>')}</div><button class="btn sm red" data-act="netLeave">離開房間</button></div>` : '';
}

/* ============================================================
   聊天（多人）
   ============================================================ */
const CHAT = { open: false };
function openChat() {
  if (!NET.on || CHAT.open) return; CHAT.open = true; unlockMouse(); KEYS.clear();
  const bar = $('#chatBar'), inp = $('#chatIn'); bar.hidden = false; inp.value = ''; setTimeout(() => inp.focus(), 30);
}
function closeChat() { CHAT.open = false; $('#chatBar').hidden = true; $('#chatIn').blur(); lockMouse(); $('#startHint').hidden = TOUCH || locked() || !!GUI.kind; }
$('#chatIn').addEventListener('keydown', e => {
  e.stopPropagation();
  if (e.key === 'Enter') { const t = $('#chatIn').value.trim(); if (t) { netEmit({ t: 'chat', text: t.slice(0, 60) }); toast(`${NET.name}：${t.slice(0, 60)}`); } closeChat(); }
  if (e.key === 'Escape') closeChat();
});
$('#lchatIn').addEventListener('keydown', e => { e.stopPropagation(); if (e.key === 'Enter') sendLiveChat(); });

/* ============================================================
   多人連線（PeerJS 點對點；房主為權威端，負責史萊姆模擬與訊息轉發）
   ============================================================ */
const NET = { on: false, host: false, peer: null, conns: new Map(), hc: null, room: '', me: '', name: '', color: '', players: new Map(), sendT: 0 };
const PCOL = ['#22d3ee', '#f472b6', '#a78bfa', '#fbbf24', '#34d399', '#fb923c', '#60a5fa'];
const setMp = t => { const el = $('#mpStatus'); if (el) el.textContent = t; };
function prepName() {
  const n = ($('#mpName').value || S.name || '').trim().slice(0, 12) || ('玩家' + Math.floor(100 + Math.random() * 900));
  S.name = n; NET.name = n; NET.color = PCOL[[...n].reduce((a, c) => a + c.charCodeAt(0), 0) % PCOL.length]; save(); return n;
}
function peerErr(e) {
  const m = { 'unavailable-id': '房間代碼重複，請再試一次', 'peer-unavailable': '找不到這個房間，請確認代碼', network: '網路連線失敗', 'server-error': '連線伺服器無法使用，請稍後再試', 'browser-incompatible': '這個瀏覽器不支援多人連線' }[e && e.type] || ('連線錯誤：' + (e && e.type || '未知'));
  setMp(m); toast(m);
}
function netHost() {
  if (!window.Peer) return setMp('多人模組載入失敗'); netLeave(true); prepName();
  const code = Array.from({ length: 5 }, () => 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'[Math.floor(Math.random() * 31)]).join('');
  setMp('建立房間中…'); const peer = new Peer('squishlab-' + code.toLowerCase(), { debug: 0 }); NET.peer = peer;
  peer.on('open', id => { NET.on = true; NET.host = true; NET.room = code; NET.me = id; NET.players.set(id, Object.assign(myState(), { id })); setMp('房間已建立：' + code); afterNet(); toast(`房間已建立，代碼 ${code}，分享給朋友一起玩`); });
  peer.on('connection', c => {
    c.on('open', () => NET.conns.set(c.peer, c));
    c.on('data', d => { try { hostRecv(c.peer, d); } catch (err) { console.error(err); } });
    c.on('close', () => dropPlayer(c.peer)); c.on('error', () => dropPlayer(c.peer));
  });
  peer.on('error', e => { peerErr(e); if (!NET.on) netLeave(true); });
  peer.on('disconnected', () => { try { peer.reconnect(); } catch (_) { } });
}
function netJoin(code) {
  code = String(code || '').trim().toUpperCase(); if (code.length < 4) return setMp('請輸入房間代碼');
  if (!window.Peer) return setMp('多人模組載入失敗'); netLeave(true); prepName(); setMp('連線中…');
  const peer = new Peer({ debug: 0 }); NET.peer = peer;
  peer.on('open', id => {
    NET.me = id; const c = peer.connect('squishlab-' + code.toLowerCase(), { reliable: true }); NET.hc = c;
    const to = setTimeout(() => { if (!NET.on) { setMp('找不到房間或連線逾時'); netLeave(true); } }, 15000);
    c.on('open', () => { clearTimeout(to); NET.on = true; NET.host = false; NET.room = code; c.send(Object.assign(myState(), { t: 'hello' })); setMp('已加入房間 ' + code); afterNet(); });
    c.on('data', d => { try { clientRecv(d); } catch (err) { console.error(err); } });
    c.on('close', () => { if (NET.on) { toast('與房主的連線中斷，已切換為單人模式'); netLeave(true); } });
  });
  peer.on('error', e => { peerErr(e); if (!NET.on) netLeave(true); });
}
function afterNet() { $('#btnChat').hidden = false; renderNetChip(); if (TITLE.on) startPlay(); }
function netLeave(silent) {
  const was = NET.on; if (was && L.on) { L.on = false; }
  try { if (NET.peer) NET.peer.destroy(); } catch (_) { }
  NET.peer = null; NET.on = false; NET.host = false; NET.hc = null; NET.conns.clear(); NET.players.clear(); L.rv.clear(); L.watch = null;
  AV.forEach(a => W.scene && W.scene.remove(a.g)); AV.clear(); if (W.liveTag) W.liveTag.visible = false;
  if (W.mirror) { W.slimes.forEach(s => W.scene.remove(s.m)); W.slimes = []; W.mirror = false; W.spawned.clear(); spawnAllSlimes(); }
  $('#btnChat').hidden = true; if (CHAT.open) closeChat(); renderNetChip();
  if (was && !silent) toast('已離開多人房間');
}
function renderNetChip() { const el = $('#sNet'); el.hidden = !NET.on; if (NET.on) el.textContent = `房間 ${NET.room} · ${Math.max(1, NET.players.size)} 人`; }
const netSend = m => { if (!NET.on) return; if (NET.host) hostRecv(NET.me, m); else if (NET.hc && NET.hc.open) NET.hc.send(m); };
function netEmit(m) { if (!NET.on) return; m.from = NET.me; m.name = NET.name; if (NET.host) bcast(m); else if (NET.hc && NET.hc.open) NET.hc.send(m); }
function bcast(m, except) { NET.conns.forEach((c, id) => { if (id !== except && c.open) { try { c.send(m); } catch (_) { } } }); }
function myState() {
  const p = stockById(L.stageId);
  return { t: 'st', name: NET.name, color: NET.color, x: +(P ? P.x : 0).toFixed(2), y: +(P ? P.y : 0).toFixed(2), z: +(P ? P.z : 0).toFixed(2), yaw: +(P ? P.yaw : 0).toFixed(2), zones: S.zones, live: L.on ? { on: true, hype: Math.round(L.hype), viewers: Math.round(L.viewers), sp: p ? p.sp : null } : null };
}
function hostRecv(id, m) {
  if (!m || typeof m !== 'object') return;
  if (m.t === 'hello' || m.t === 'st') {
    const isNew = !NET.players.has(id); NET.players.set(id, Object.assign(NET.players.get(id) || {}, m, { id }));
    (m.zones || []).forEach(z => { if (ZONES.some(q => q.id === z) && !W.spawned.has(z)) spawnZone(z); });
    if (m.t === 'hello' && isNew && id !== NET.me) { const c = NET.conns.get(id); if (c) c.send({ t: 'welcome', room: NET.room }); const j = { t: 'join', name: m.name, from: id }; onNet(j); bcast(j, id); }
    return;
  }
  if (m.t === 'hit') { const sl = W.slimes.find(s => s.id === m.id), c = NET.conns.get(id); if (sl && c) c.send(Object.assign({ t: 'hitr', id: m.id }, slimeHitCore(sl))); return; }
  bcast(m, id); onNet(m);
}
function clientRecv(m) {
  if (!m || typeof m !== 'object') return;
  if (m.t === 'ps') { NET.players = new Map(Object.entries(m.p)); return; }
  if (m.t === 'sl') { mirrorSlimes(m.a); return; }
  if (m.t === 'hitr') { const sl = W.slimes.find(s => s.id === m.id); if (sl) applyHit(sl, m); return; }
  if (m.t === 'welcome') { toast(`已加入房間 ${m.room}`); return; }
  onNet(m);
}
function dropPlayer(id) {
  NET.conns.delete(id); const p = NET.players.get(id); NET.players.delete(id); L.rv.delete(id);
  if (p) { const m = { t: 'leave', name: p.name, from: id }; onNet(m); bcast(m); }
}
/* 每個節點收到的事件（除了發送者本人） */
function onNet(m) {
  switch (m.t) {
    case 'chat': toast(`${m.name}：${m.text}`); break;
    case 'join': toast(`${m.name} 加入了房間`); break;
    case 'leave': toast(`${m.name} 離開了房間`); if (L.watch && L.watch.id === m.from) { stopWatch(true); toast('主播已離開'); if (tab === 'live') renderLive(); } break;
    case 'lprod': if (L.watch && L.watch.id === m.from) { L.watch.p = m.p ? Object.assign({}, m.p, { deco: m.p.deco || [], cracks: (m.p.cracks || []).map(c => c.slice()) }) : null; if (tab === 'live') renderLive(); } break;
    case 'lcr': if (L.watch && L.watch.id === m.from && tab === 'live') liveSt.remoteCrunch(m); break;
    case 'lchat': if (m.to === NET.me && L.on) { chat(m.name, m.text, 'dm'); S.fans += .2; } else if (L.watch && L.watch.id === m.to && tab === 'live') chat(m.name, m.text, 'dm'); break;
    case 'don': if (m.to === NET.me) { addMoney(m.amt); S.fans += 1; toast(`${m.name} 在直播中斗內你 ${fmt(m.amt)}`); chat(m.name, `斗內 ${fmt(m.amt)}！`, 'dm'); renderTop(); } else if (L.watch && L.watch.id === m.to) chat(m.name, `斗內 ${fmt(m.amt)}！`, 'dm'); break;
    case 'watch': if (m.to === NET.me) { if (m.on) { L.rv.add(m.from); toast(`${m.name} 正在看你的直播`); chat('系統', `${m.name} 進入了直播間`, 'dm'); liveBroadcast(); } else L.rv.delete(m.from); } break;
    case 'lreq': if (m.to === NET.me) liveBroadcast(); break;
  }
}
function netTick(dt) {
  if (!NET.on) return; NET.sendT += dt; if (NET.sendT < .1) return; NET.sendT = 0;
  const st = myState();
  if (NET.host) {
    NET.players.set(NET.me, Object.assign(st, { id: NET.me }));
    bcast({ t: 'ps', p: Object.fromEntries(NET.players) });
    if (NET.conns.size) bcast({ t: 'sl', a: W.slimes.map(s => [s.id, SPECIES.indexOf(s.sp), +s.x.toFixed(2), +s.z.toFixed(2), s.cool > 0 ? 1 : 0, s.hits, s.sq > .5 ? 1 : 0, Math.round(s.sc * 100), s.happy > 0 ? 1 : 0]) });
  } else if (NET.hc && NET.hc.open) NET.hc.send(st);
}
function mirrorSlimes(a) {
  if (!W.mirror) { W.slimes.forEach(s => W.scene.remove(s.m)); W.slimes = []; W.mirror = true; }
  const byId = new Map(W.slimes.map(s => [s.id, s])), seen = new Set();
  a.forEach(([id, si, x, z, cool, hits, sq, sc, happy]) => {
    seen.add(id); let s = byId.get(id);
    if (!s) { const sp = SPECIES[si] || SPECIES[0], m = slimeMesh(sp); s = { id, sp, m, mirror: true, x, z, tx: x, tz: z, ph: rnd(0, 6), hits: 0, cool: 0, sq: 0, blink: rnd(1, 4), yaw: 0, sc: sc / 100, vx: 0, vz: 0 }; m.scale.setScalar(s.sc); m.userData.body.userData.sl = s; W.scene.add(m); W.slimes.push(s); }
    s.tx = x; s.tz = z; s.cool = cool ? 1 : 0; s.hits = hits; if (sq) s.sq = 1; if (happy && !(s.happy > 0)) s.happy = .6;
  });
  W.slimes = W.slimes.filter(s => { if (seen.has(s.id)) return true; W.scene.remove(s.m); return false; });
}

/* ---------- 其他玩家的角色 ---------- */
const AV = new Map();
function avatarMesh(color) {
  const g = new THREE.Group(), bodyM = new THREE.MeshStandardMaterial({ color, roughness: .45 }), skin = new THREE.MeshStandardMaterial({ color: '#fde2cf', roughness: .6 }), dark = new THREE.MeshStandardMaterial({ color: '#1e293b', roughness: .3 });
  const body = mesh(new THREE.SphereGeometry(.42, 20, 14), bodyM, 0, .72, 0, g); body.scale.set(1, 1.15, .9);
  mesh(new THREE.SphereGeometry(.36, 22, 16), skin, 0, 1.45, 0, g);
  const hat = mesh(new THREE.SphereGeometry(.385, 20, 10, 0, PI2, 0, Math.PI / 2), bodyM, 0, 1.5, 0, g); hat.scale.set(1, .8, 1);
  mesh(new THREE.SphereGeometry(.09, 10, 8), new THREE.MeshStandardMaterial({ color: '#ffffff' }), 0, 1.82, 0, g);
  [-1, 1].forEach(s => {
    mesh(new THREE.SphereGeometry(.055, 10, 8), dark, s * .13, 1.43, -.32, g);
    mesh(new THREE.SphereGeometry(.018, 6, 4), new THREE.MeshBasicMaterial({ color: '#fff' }), s * .13 + .02, 1.46, -.37, g);
    const ck = mesh(new THREE.CircleGeometry(.055, 12), new THREE.MeshBasicMaterial({ color: '#fb7185', transparent: true, opacity: .55 }), s * .21, 1.35, -.29, g); ck.rotation.y = Math.PI + s * .6;
    mesh(new THREE.SphereGeometry(.13, 12, 10), bodyM, s * .2, .14, 0, g);
    const arm = mesh(new THREE.SphereGeometry(.11, 10, 8), bodyM, s * .45, .8, 0, g); arm.scale.set(.8, 1.3, .8);
  });
  mesh(new THREE.BoxGeometry(.42, .46, .24), new THREE.MeshPhysicalMaterial({ color, transparent: true, opacity: .75, roughness: .1, clearcoat: 1 }), 0, .85, .38, g);
  g.traverse(o => { if (o.isMesh) o.castShadow = !LOW; }); blobShadow(.6, g, .03); return g;
}
function avatarsStep(dt) {
  if (!NET.on) return; const seen = new Set(); let liveName = null;
  NET.players.forEach((p, id) => {
    if (id === NET.me || p.x == null) return; seen.add(id); let a = AV.get(id);
    if (!a) {
      const g = avatarMesh(p.color || '#22d3ee'), tag = textSprite(p.name || '玩家', p.color || '#22d3ee'); tag.position.y = 2.3; tag.scale.set(1.8, .56, 1); g.add(tag);
      const lt = textSprite('LIVE 直播中', '#fb7185'); lt.position.y = 2.85; lt.scale.set(1.7, .53, 1); lt.visible = false; g.add(lt);
      g.position.set(p.x, p.y, p.z); W.scene.add(g); a = { g, lt, x: p.x, y: p.y, z: p.z, yaw: p.yaw, wasLive: false, bob: 0 }; AV.set(id, a);
    }
    const k = Math.min(1, dt * 10), ox = a.x, oz = a.z; a.x += (p.x - a.x) * k; a.y += (p.y - a.y) * k; a.z += (p.z - a.z) * k;
    let d = p.yaw - a.yaw; d = Math.atan2(Math.sin(d), Math.cos(d)); a.yaw += d * k;
    const sp = Math.hypot(a.x - ox, a.z - oz) / Math.max(dt, 1e-3); a.bob += dt * (sp > .4 ? 10 : 0);
    a.g.position.set(a.x, a.y + Math.abs(Math.sin(a.bob)) * .09, a.z); a.g.rotation.y = a.yaw;
    const live = !!(p.live && p.live.on); a.lt.visible = live; if (live) { liveName = p.name; a.lt.position.y = 2.85 + Math.sin(W.t * 3) * .06; }
    if (live && !a.wasLive) toast(`${p.name} 開始直播了！到工坊的直播台可以觀看`); a.wasLive = live;
  });
  AV.forEach((a, id) => { if (!seen.has(id)) { W.scene.remove(a.g); AV.delete(id); } });
  if (liveName && W.liveTagName !== liveName) { if (W.liveTag) W.scene.remove(W.liveTag); W.liveTag = textSprite('直播中：' + liveName, '#fb7185', '走近直播台即可觀看'); W.liveTag.position.set(9, WS_Y + 4.8, 3.5); W.liveTag.scale.set(3.2, 1, 1); W.scene.add(W.liveTag); W.liveTagName = liveName; }
  if (W.liveTag) W.liveTag.visible = !!liveName; if (!liveName) W.liveTagName = null;
}

/* ---------- 直播同步：觀看、留言、斗內 ---------- */
function liveBroadcast() {
  if (!NET.on || !L.on) return; const p = stockById(L.stageId);
  netEmit({ t: 'lprod', p: p ? { id: p.id, sp: p.sp, crisp: p.crisp, dur: p.dur, deco: p.deco, cracks: p.cracks } : null });
}
function startWatch(id) {
  const pl = NET.players.get(id); if (!pl) return; if (L.watch) stopWatch(true);
  if (L.on) { L.on = false; toast('已結束你自己的直播，開始觀看'); }
  L.watch = { id, name: pl.name || '玩家', p: null }; $('#chat').innerHTML = '';
  netEmit({ t: 'watch', to: id, on: true }); netEmit({ t: 'lreq', to: id }); chat('系統', `正在觀看 ${L.watch.name} 的直播`, 'dm'); renderLive();
}
function stopWatch(quiet) { if (!L.watch) return; netEmit({ t: 'watch', to: L.watch.id, on: false }); L.watch = null; liveSt.watch = false; if (!quiet) chat('系統', '已離開直播間', 'dm'); }
function sendLiveChat() {
  const inp = $('#lchatIn'), t = inp.value.trim(); if (!t || !L.watch) return; inp.value = '';
  netEmit({ t: 'lchat', to: L.watch.id, text: t.slice(0, 40) }); chat(NET.name, t.slice(0, 40), 'dm');
}
function donate() {
  if (!L.watch) return; if (S.money < 20) return toast('資金不足');
  S.money -= 20; netEmit({ t: 'don', to: L.watch.id, amt: 20 }); chat(NET.name, '斗內 ¥20！', 'dm'); sfx.tick(); renderTop(); save();
}
function renderLiveOthersOnly() {
  const others = [...NET.players.entries()].filter(([id, p]) => id !== NET.me && p.live && p.live.on);
  $('#liveOthers').innerHTML = others.length ? `<div class="card small row wrap"><span>其他玩家正在直播：</span>${others.map(([id, p]) => `<button class="btn sm ${L.watch && L.watch.id === id ? '' : 'ghost'}" data-act="watch" data-id="${esc(id)}">${esc(p.name)}（${p.live.viewers} 觀眾）</button>`).join('')}</div>` : '';
  if (L.watch && !others.some(([id]) => id === L.watch.id)) { stopWatch(true); toast('主播已結束直播'); renderLive(); }
}

/* ============================================================
   基地、計程車、大城市、商店、手作台、古地圖拼圖、觸控
   ============================================================ */
const BASE = { line: [0, -9], decor: [-11, 1], live: [11, 1], pc: [4.5, 7], bench: [-4.5, 7], taxi: [-9, 15] };
const OWN = {
  slicer: { name: '切片機', cost: 200, shop: 'mach', desc: '加工產線的第一台機器（節奏切片）。購買後產線會出現在中央平地。' },
  coater: { name: '糖晶滾筒機', cost: 450, shop: 'mach', desc: '幫捏捏裹上糖晶，提高酥脆度（按住控速）。' },
  dryer: { name: '乾燥烘箱', cost: 800, shop: 'mach', desc: '烘乾定型，品質再升一級（拖曳控溫）。' },
  decor: { name: '裝飾桌', cost: 350, shop: 'gear', desc: '在捏捏上擺放裝飾零件，提高售價與人氣。' },
  live: { name: '直播設備組', cost: 600, shop: 'gear', desc: '補光環燈、攝影機與舞台。可以開直播販售捏捏。' },
};
const SHOP_UPS = { mach: ['slicer', 'coater', 'dryer'], gear: ['gear'], mall: ['cap', 'shelf', 'boots', 'net', 'farm'] };
function ownAny() { return !!(S.own.slicer || S.own.coater || S.own.dryer); }
function slotMark(parent, [x, z], t, sub, r) {
  const m = new THREE.Group(); m.position.set(x, G(x, z) + .04, z); parent.add(m);
  const ring = mesh(new THREE.RingGeometry(r - .1, r, 56), new THREE.MeshBasicMaterial({ color: '#cbd5e1', transparent: true, opacity: .55, side: THREE.DoubleSide, depthWrite: false }), 0, 0, 0, m); ring.rotation.x = -Math.PI / 2;
  const s = textSprite(t, '#cbd5e1', sub); s.position.y = 2.2; m.add(s); return m;
}
function refreshBase() {
  if (!W.lineParts) return; const o = S.own, anyM = ownAny();
  W.lineParts.belt.visible = anyM; W.lineParts.m.forEach((g, i) => g.visible = !!o[MKEY[i]]);
  W.decorG.visible = !!o.decor; W.liveG.visible = !!o.live;
  const show = { line: anyM, decor: !!o.decor, live: !!o.live };
  Object.keys(show).forEach(k => { W.slotMark[k].visible = !show[k]; W.slotInter[k].off = !show[k]; if (show[k] && !W.slotCol[k].added) { addCol(W.slotCol[k]); W.slotCol[k].added = true; } });
}
function makeTaxi(color = '#facc15', sign = true) {
  const g = new THREE.Group(), yel = std(color, { roughness: .35, metalness: .3 }), dk = std('#111827', { roughness: .3, metalness: .4 }), gl = std('#1e3a5f', { roughness: .08, metalness: .6 }), wh = std('#e5e7eb', { metalness: .6, roughness: .3 });
  box(3.9, .62, 1.7, yel, 0, .72, 0, g); box(2.1, .6, 1.56, yel, -.2, 1.32, 0, g);
  [-.79, .79].forEach(z => box(1.9, .4, .02, gl, -.2, 1.36, z, g)); box(.02, .42, 1.42, gl, .86, 1.34, 0, g); box(.02, .42, 1.42, gl, -1.26, 1.34, 0, g);
  if (sign) box(3.92, .1, 1.72, dk, 0, .92, 0, g);
  [[1.25, .82], [-1.25, .82], [1.25, -.82], [-1.25, -.82]].forEach(([x, z]) => { const w = cyl(.36, .36, .26, 20, dk, x, .36, z, g); w.rotation.x = Math.PI / 2; const h = cyl(.18, .18, .27, 12, wh, x, .36, z, g); h.rotation.x = Math.PI / 2; });
  [-.55, .55].forEach(z => { box(.05, .14, .3, glow('#fef9c3'), 1.96, .78, z, g); box(.05, .12, .26, glow('#ef4444'), -1.96, .8, z, g); });
  if (sign) {
    const c = document.createElement('canvas'); c.width = 256; c.height = 96; const x = c.getContext('2d'); x.fillStyle = '#fef08a'; x.fillRect(0, 0, 256, 96); x.fillStyle = '#111827'; x.font = 'bold 64px Inter,sans-serif'; x.textAlign = 'center'; x.fillText('TAXI', 128, 72);
    const tt = new THREE.CanvasTexture(c); tt.colorSpace = THREE.SRGBColorSpace;
    box(.75, .28, .32, new THREE.MeshStandardMaterial({ map: tt, emissive: '#fef08a', emissiveIntensity: .4, emissiveMap: tt }), -.2, 1.76, 0, g);
  }
  g.traverse(o => { if (o.isMesh) o.castShadow = !LOW; });
  return g;
}
/* ---------- 大城市 ---------- */
function buildCity() {
  const g = new THREE.Group(); g.position.set(CITY.x, 0, CITY.z); W.scene.add(g); W.city = g;
  const asph = std('#3b4250', { roughness: .95 }), walk = std('#a3a8b0', { roughness: .9 }), wline = new THREE.MeshBasicMaterial({ color: '#f1f5f9' }), ylw = new THREE.MeshBasicMaterial({ color: '#facc15' });
  const flat = (geo, mat, x, y, z) => { const m = mesh(geo, mat, x, y, z, g); m.rotation.x = -Math.PI / 2; m.receiveShadow = true; return m; };
  flat(new THREE.PlaneGeometry(300, 240), walk, 0, -.02, 0); flat(new THREE.PlaneGeometry(300, 14), asph, 0, .005, 0);
  for (let x = -140; x < 140; x += 6) if (Math.abs(x) > 14) flat(new THREE.PlaneGeometry(3, .25), ylw, x, .02, 0);
  for (let z = -6; z <= 6; z += 1.3) [-11, 11].forEach(x => flat(new THREE.PlaneGeometry(3.2, .6), wline, x, .02, z));
  const winTex = (() => { const c = document.createElement('canvas'); c.width = 64; c.height = 128; const x = c.getContext('2d'); x.fillStyle = '#1f2937'; x.fillRect(0, 0, 64, 128); for (let i = 0; i < 4; i++) for (let j = 0; j < 8; j++) { x.fillStyle = Math.random() < .5 ? '#fde68a' : '#475569'; x.fillRect(4 + i * 15, 4 + j * 15.5, 10, 11); } const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping; return t; })();
  const bld = (x, z, w, d, h, col, solid = true) => {
    const t = winTex.clone(); t.needsUpdate = true; t.repeat.set(Math.max(1, Math.round(w / 4)), Math.max(1, Math.round(h / 7)));
    const b = box(w, h, d, new THREE.MeshStandardMaterial({ color: col, map: t, emissive: '#ffffff', emissiveMap: t, emissiveIntensity: .22, roughness: .7 }), x, h / 2, z, g);
    b.castShadow = !LOW; b.receiveShadow = true; if (solid) addCol({ box: [CITY.x + x - w / 2, CITY.z + z - d / 2, CITY.x + x + w / 2, CITY.z + z + d / 2] }); return b;
  };
  const rd = seeded(31), cols = ['#64748b', '#475569', '#94a3b8', '#7c8aa0', '#5b6b80', '#a1a1aa'];
  [-46, -34, 34, 46].forEach(x => bld(x, -21, 11, 14, 12 + rd() * 14, pick(cols)));
  for (let x = -60; x <= 60; x += 13) bld(x + rd() * 3, -42 - rd() * 8, 11, 14, 18 + rd() * 30, pick(cols));
  for (let x = -60; x <= 60; x += 13) { if (Math.abs(x) < 10) continue; bld(x + rd() * 2, 24, 11, 12, 10 + rd() * 20, pick(cols)); }
  for (let i = 0; i < 26; i++) { const a = i / 26 * PI2, r = 110 + rd() * 30; bld(Math.cos(a) * r, Math.sin(a) * r, 14, 14, 30 + rd() * 50, pick(cols), false); }
  // 商店（路北側）
  const shop = (id, x, w, col, name, sub, accent) => {
    const b = bld(x, -20, w, 12, 8, col); b.material.emissiveIntensity = .12;
    mesh(new THREE.PlaneGeometry(w - 2.4, 3.2), new THREE.MeshStandardMaterial({ color: '#7dd3fc', emissive: '#7dd3fc', emissiveIntensity: .35, roughness: .1 }), x, 1.9, -13.94, g);
    box(w - 1, .18, 1.8, std(accent, { roughness: .6 }), x, 3.75, -13.2, g).rotation.x = .18;
    const c = document.createElement('canvas'); c.width = 512; c.height = 128; const t = c.getContext('2d'); t.fillStyle = '#0b1220'; t.fillRect(0, 0, 512, 128); t.fillStyle = accent; t.font = 'bold 64px "Noto Sans TC","Microsoft JhengHei",sans-serif'; t.textAlign = 'center'; t.fillText(name, 256, 86);
    const tx = new THREE.CanvasTexture(c); tx.colorSpace = THREE.SRGBColorSpace; mesh(new THREE.PlaneGeometry(w - 2, 2), new THREE.MeshBasicMaterial({ map: tx }), x, 5.6, -13.9, g);
    const hb = hitBox(w - 2, 3.4, 2.2, x, 1.7, -12.6, g); addInter(hb, 'station', 'shop:' + id, name);
    const lb = textSprite(name, accent, sub); lb.position.set(x, 9.2, -13.5); g.add(lb);
  };
  shop('mach', -18, 12, '#334155', '機械行', '加工機器與升級', '#22d3ee');
  shop('mall', 0, 13, '#475569', '生活百貨', '倉儲、網路、跑鞋', '#34d399');
  shop('gear', 18, 12, '#3f3f63', '器材行', '直播設備、裝飾桌', '#e879f9');
  // 路燈、行道樹、長椅
  const pole = std('#334155', { metalness: .7, roughness: .4 }), leaf = std('#4c9440', { flatShading: true }), pot = std('#57534e');
  for (let x = -52; x <= 52; x += 13) [-8.6, 8.6].forEach(z => { if (Math.abs(x) < 5) return; cyl(.08, .1, 5, 8, pole, x, 2.5, z, g); box(1.1, .12, .3, glow('#fef9c3'), x + .4 * Math.sign(-z), 5, z - .4 * Math.sign(z), g); });
  for (let x = -45.5; x <= 45.5; x += 13) [-10.5, 10.5].forEach(z => { if (Math.abs(x) < 8) return; cyl(.7, .6, .6, 12, pot, x, .3, z, g); mesh(jit(new THREE.IcosahedronGeometry(1.1, 1), .3, x), leaf, x, 2, z, g); cyl(.1, .14, 1.2, 6, std('#5b4030'), x, 1, z, g); addCol({ x: CITY.x + x, z: CITY.z + z, r: .8 }); });
  // 停放的車與計程車招呼站
  [[-30, 4.5, '#ef4444'], [26, -4.5, '#3b82f6'], [40, 4.5, '#e5e7eb']].forEach(([x, z, c]) => { const car = makeTaxi(c, false); car.position.set(x, 0, z); g.add(car); addCol({ box: [CITY.x + x - 2, CITY.z + z - 1, CITY.x + x + 2, CITY.z + z + 1] }); });
  const tx = makeTaxi('#facc15', true); tx.position.set(7, 0, 12); g.add(tx); addCol({ box: [CITY.x + 5, CITY.z + 11, CITY.x + 9, CITY.z + 13] });
  addInter(hitBox(4.2, 2.2, 2, 7, 1, 12, g), 'station', 'taxi', '計程車');
  const tl = textSprite('計程車招呼站', '#facc15', '回到月光谷'); tl.position.set(7, 3.4, 12); g.add(tl);
}
function taxiAsk() {
  const toCity = !inCity();
  modal(`<h2>${toCity ? '前往大城市' : '回到月光谷'}</h2><p>${toCity ? '大城市裡有機械行、器材行與生活百貨，可以購買加工機器、直播設備與各種升級。' : '搭計程車回到月光谷的中央平地。'}</p>`, [{ t: '取消', ghost: true }, { t: '出發', f: taxiRide }]);
}
function taxiRide() {
  const toCity = !inCity(), f = $('#fade'); f.textContent = toCity ? '計程車駛向大城市…' : '計程車駛回月光谷…'; f.hidden = false; requestAnimationFrame(() => f.classList.add('on')); sfx.open();
  setTimeout(() => {
    if (toCity) { P.x = CITY.x; P.z = CITY.z + 10; } else { P.x = BASE.taxi[0] + 3; P.z = BASE.taxi[1]; }
    P.yaw = 0; P.pitch = -.05; P.y = G(P.x, P.z); P.camY = P.y; P.vy = 0; W.camAway = false; save();
  }, 700);
  setTimeout(() => { f.classList.remove('on'); setTimeout(() => f.hidden = true, 500); toast(toCity ? '抵達大城市。機械行、生活百貨、器材行都在路的北側。' : '回到月光谷。'); }, 1500);
}
/* ---------- 商店 ---------- */
function buyOwn(k) {
  const o = OWN[k]; if (!o || S.own[k]) return; if (S.money < o.cost) return toast('資金不足');
  S.money -= o.cost; S.own[k] = true; sfx.pop(); refreshBase(); renderShop(tab); renderTop(); save(); toast(`已購買${o.name}，已經送到月光谷的中央平地`);
}
function renderShop(kind) {
  const intro = { mach: '加工機器與機器升級。買了才會出現在基地的產線上，每台機器對應一道加工流程。', gear: '直播設備、裝飾桌與裝飾零件。', mall: '倉儲、網站伺服器與生活用品。' }[kind];
  let h = `<div class="hint">${intro}　目前資金 <b style="color:var(--warn)">${fmt(S.money)}</b></div>`;
  const owns = Object.keys(OWN).filter(k => OWN[k].shop === kind);
  if (owns.length) h += '<h3>設備</h3>' + owns.map(k => { const o = OWN[k], has = S.own[k]; return `<div class="card up"><div class="info"><b>${o.name}</b>${has ? ' <span class="tag">已擁有</span>' : ''}<div class="small" style="color:var(--sub)">${o.desc}</div></div><button class="btn sm" data-act="buyOwn" data-k="${k}" ${has || S.money < o.cost ? 'disabled' : ''}>${has ? '已擁有' : fmt(o.cost)}</button></div>`; }).join('');
  const ups = SHOP_UPS[kind] || [];
  if (ups.length) h += '<h3>升級</h3>' + ups.map(k => { const u = UPS[k], lv = S.up[k], max = lv >= u.max, need = u.need && !S.own[u.need]; return `<div class="card up"><div class="info"><b>${u.name}</b>${lvBar(lv, u.max)}<div class="small" style="color:var(--sub)">${need ? '需要先購買' + OWN[u.need].name : u.desc}</div></div><button class="btn sm" data-act="buyUp" data-k="${k}" ${max || need || S.money < upCost(k) ? 'disabled' : ''}>${max ? '已滿級' : fmt(upCost(k))}</button></div>`; }).join('');
  if (kind === 'gear') h += '<h3>裝飾零件包</h3>' + Object.keys(PACKS).map(k => { const has = S.packs.includes(k), pk = PACKS[k], items = Object.values(DECO).filter(d => d.pack === k).map(d => dot(d.c) + d.n).join('　'); return `<div class="card up"><div class="info"><b>${pk.name}</b><div class="small" style="color:var(--sub)">${items}</div></div><button class="btn sm" data-act="buyPack" data-k="${k}" ${has || S.money < pk.cost ? 'disabled' : ''}>${has ? '已擁有' : fmt(pk.cost)}</button></div>`; }).join('');
  $('#upList').innerHTML = h;
}
/* ---------- 手作台 ---------- */
const BN = { busy: false };
function renderBench() {
  if (!M.sp || !unlockedSpecies().some(s => s.id === M.sp)) M.sp = (unlockedSpecies().find(s => (S.gel[s.id] || 0) >= 2) || unlockedSpecies()[0]).id;
  $('#benchBody').innerHTML = `<div class="hint">手作台只能做出<b>粗製捏捏</b>：品質最低，固定售價 ¥10。想做出更酥脆、更值錢的捏捏，要搭計程車到大城市購買加工機器。</div>
  <div class="row wrap">${unlockedSpecies().map(s => `<button class="zbtn ${M.sp === s.id ? 'on' : ''}" data-act="pickSp" data-id="${s.id}">${dot(s.color)}${short(s.id)}<br><small>凝膠 ${S.gel[s.id] || 0}</small></button>`).join('')}</div>
  <div class="card"><div class="tbar" style="height:10px"><i id="benchBar"></i></div><button class="btn big" style="width:100%" data-act="benchMake" ${BN.busy || (S.gel[M.sp] || 0) < 2 ? 'disabled' : ''}>${BN.busy ? '捏製中…' : '手工捏製（消耗 2 份凝膠）'}</button><div class="small" style="color:var(--sub);margin-top:6px">庫存 ${S.stock.length}/${cap()}</div></div>`;
}
function benchMake() {
  if (BN.busy) return; const sp = M.sp; if (!sp || (S.gel[sp] || 0) < 2) return toast('凝膠不足（需要 2 份）'); if (S.stock.length >= cap()) return toast('庫存已滿');
  S.gel[sp] -= 2; BN.busy = true; renderBench(); sfx.squish(1); const bar = $('#benchBar'); if (bar) { bar.style.transition = 'width 1.4s linear'; requestAnimationFrame(() => requestAnimationFrame(() => bar.style.width = '100%')); }
  setTimeout(() => { BN.busy = false; const p = makeProduct(sp, .15, true); S.stock.push(p); sfx.pop(); toast(`做好了一個粗製${short(sp)}捏捏（售價 ¥10）`); save(); renderHotbar(true); renderQuest(); if (tab === 'bench') renderBench(); }, 1450);
}
/* ---------- 古地圖拼圖 ---------- */
function openAltar() {
  const q = qState(); if (!questReady('coast')) return toast('石台被一股力量封印著……');
  if (q.frags.length < 5) return toast(`石台上刻著地圖的輪廓，但你只有 ${q.frags.length}/5 片碎片。`);
  openGui('mapg');
}
let MAPIMG = null;
function mapImage() {
  if (MAPIMG) return MAPIMG; const c = document.createElement('canvas'); c.width = c.height = 450; const g = c.getContext('2d'), rd = seeded(42);
  g.fillStyle = '#e9d8a6'; g.fillRect(0, 0, 450, 450); for (let i = 0; i < 900; i++) { g.fillStyle = `rgba(120,90,40,${rd() * .08})`; g.fillRect(rd() * 450, rd() * 450, 3, 3); }
  g.fillStyle = '#4d7c4a'; for (let i = 0; i < 30; i++) { const x = 30 + rd() * 190, y = 70 + rd() * 330; g.beginPath(); g.moveTo(x, y - 14); g.lineTo(x - 9, y + 6); g.lineTo(x + 9, y + 6); g.fill(); }
  g.strokeStyle = '#7c6a4a'; g.lineWidth = 3; for (let i = 0; i < 6; i++) { const y = 40 + i * 70; g.beginPath(); g.moveTo(270, y); g.lineTo(287, y - 22); g.lineTo(304, y); g.stroke(); }
  g.fillStyle = '#7fb3c8'; g.beginPath(); g.moveTo(360, 0); for (let y = 0; y <= 450; y += 30) g.lineTo(360 + Math.sin(y * .05) * 14, y); g.lineTo(450, 450); g.lineTo(450, 0); g.fill();
  g.strokeStyle = '#5b9bb5'; g.lineWidth = 7; g.beginPath(); g.moveTo(0, 330); g.bezierCurveTo(120, 300, 160, 400, 260, 360); g.bezierCurveTo(320, 340, 340, 380, 380, 370); g.stroke();
  g.setLineDash([10, 8]); g.strokeStyle = '#8b2e1f'; g.lineWidth = 4; g.beginPath(); g.moveTo(80, 230); g.bezierCurveTo(160, 150, 220, 250, 287, 225); g.lineTo(340, 200); g.lineTo(395, 120); g.stroke(); g.setLineDash([]);
  g.strokeStyle = '#b91c1c'; g.lineWidth = 6; g.beginPath(); g.moveTo(383, 108); g.lineTo(407, 132); g.moveTo(407, 108); g.lineTo(383, 132); g.stroke();
  g.fillStyle = '#3f2e1e'; g.font = 'bold 32px "Noto Sans TC","Microsoft JhengHei",serif'; g.fillText('森林', 80, 165); g.fillText('海岸', 362, 262); g.font = 'bold 26px serif'; g.fillText('N', 30, 46);
  g.strokeStyle = '#3f2e1e'; g.lineWidth = 3; g.beginPath(); g.moveTo(39, 98); g.lineTo(39, 56); g.lineTo(31, 67); g.moveTo(39, 56); g.lineTo(47, 67); g.stroke();
  g.strokeStyle = '#7c5a3a'; g.lineWidth = 8; g.strokeRect(4, 4, 442, 442);
  return MAPIMG = c.toDataURL('image/jpeg', .85);
}
function renderMapGame() {
  const q = qState();
  $('#mapBody').innerHTML = `<div class="hint">點擊地圖碎片可以旋轉 90°。把九塊碎片都轉回正確的方向（文字要是正的、河流與路徑要連起來），地圖就會重新拼合。</div>
  <div class="mapgrid" style="--mapimg:url(${mapImage()})">${q.map.map((r, i) => `<button class="mtile" data-act="mapRot" data-i="${i}" style="background-position:${(i % 3) * 50}% ${Math.floor(i / 3) * 50}%;transform:rotate(${r * 90}deg)" aria-label="碎片 ${i + 1}"></button>`).join('')}</div>`;
}
function mapRotate(i) {
  const q = qState(); if (q.map.every(r => r === 0)) return; q.map[i] = (q.map[i] + 1) % 4; sfx.tick(); save(); renderMapGame();
  if (q.map.every(r => r === 0)) { sfx.pop(); toast('地圖拼好了！'); setTimeout(() => { closeGui(); discoverZone('coast'); }, 700); }
}
/* ---------- 手機：觸控轉視角 ---------- */
function bindTouch(cv) {
  const jb = $('#joyBase'), jk = $('#joyKnob');
  cv.addEventListener('touchstart', e => {
    if (GUI.kind || TITLE.on) return; e.preventDefault(); try { audio(); } catch (_) { }
    for (const t of e.changedTouches) {
      const x = t.clientX, y = t.clientY;
      if (!IN.joy && x < innerWidth * .45 && y > innerHeight * .4) { IN.joy = { id: t.identifier, x0: x, y0: y }; jb.style.left = (x - 60) + 'px'; jb.style.top = (y - 60) + 'px'; jb.classList.add('on'); }
      else if (!IN.look) IN.look = { id: t.identifier, x, y, sx: x, sy: y, t: performance.now(), moved: 0 };
    }
  }, { passive: false });
  cv.addEventListener('touchmove', e => {
    e.preventDefault();
    for (const t of e.changedTouches) {
      if (IN.joy && t.identifier === IN.joy.id) { let dx = t.clientX - IN.joy.x0, dy = t.clientY - IN.joy.y0; const l = Math.hypot(dx, dy), m = 50; if (l > m) { dx *= m / l; dy *= m / l; } IN.jx = dx / m; IN.jy = dy / m; jk.style.transform = `translate(${dx}px,${dy}px)`; }
      if (IN.look && t.identifier === IN.look.id) { const dx = t.clientX - IN.look.x, dy = t.clientY - IN.look.y; IN.look.x = t.clientX; IN.look.y = t.clientY; IN.look.moved += Math.abs(dx) + Math.abs(dy); const s = SENS[S.sens] * 2.4; P.yaw -= dx * s; P.pitch = clamp(P.pitch - dy * s, -1.5, 1.5); }
    }
  }, { passive: false });
  const end = e => {
    for (const t of e.changedTouches) {
      if (IN.joy && t.identifier === IN.joy.id) { IN.joy = null; IN.jx = IN.jy = 0; jk.style.transform = ''; jb.classList.remove('on'); }
      if (IN.look && t.identifier === IN.look.id) { const L0 = IN.look; IN.look = null; if (e.type === 'touchend' && L0.moved < 12 && performance.now() - L0.t < 350 && !GUI.kind) actAt(L0.sx, L0.sy); }
    }
  };
  cv.addEventListener('touchend', end); cv.addEventListener('touchcancel', end);
}

/* ---------- 主迴圈 ---------- */
let lastT = performance.now(), secAcc = 0, webAcc = 0, farmAcc = 0, trendAcc = 0, saveAcc = 0, hudN = 0, pickN = 0;
const tmpC = new THREE.Color(), tmpC2 = new THREE.Color(), tmpV = new THREE.Vector3();
function envStep(dt) {
  const w = biomeW(P.x, P.z), fog = new THREE.Color(0, 0, 0), top = new THREE.Color(0, 0, 0), sun = new THREE.Color(0, 0, 0), hs = new THREE.Color(0, 0, 0), hg = new THREE.Color(0, 0, 0);
  BIOMES.forEach((b, i) => { const Z = ZONE3D[b]; fog.add(tmpC.set(Z.fog).multiplyScalar(w[i])); top.add(tmpC.set(Z.top).multiplyScalar(w[i])); sun.add(tmpC.set(Z.sun).multiplyScalar(w[i])); hs.add(tmpC.set(Z.hemiS).multiplyScalar(w[i])); hg.add(tmpC.set(Z.hemiG).multiplyScalar(w[i])); });
  const k = Math.min(1, dt * 2); W.scene.fog.color.lerp(fog, k); W.scene.background.copy(W.scene.fog.color); W.sky.material.uniforms.bot.value.lerp(fog, k); W.sky.material.uniforms.top.value.lerp(top, k);
  W.sun.color.lerp(sun, k); W.hemi.color.lerp(hs, k); W.hemi.groundColor.lerp(hg, k); W.sun.intensity = 2.6 - w[2] * .9;
  W.sky.position.copy(W.cam.position); W.sun.position.set(P.x + 30, P.y + 55, P.z + 22); W.sun.target.position.set(P.x, P.y, P.z);
  const zid = inCity() ? 'city' : domBiome(P.x, P.z); if (zid !== W.zoneNow) { const prev = W.zoneNow; W.zoneNow = zid; if (prev) toast(zid === 'city' ? '抵達大城市' : `進入${ZONES.find(z => z.id === zid).name}`); if (S.zones.includes(zid)) (S.seenZone = S.seenZone || {})[zid] = true; }
}
function worldStep(dt) {
  W.t += dt; if (!GUI.kind) playerStep(dt);
  slimeStep(dt, W.t); lineStep(dt); W.anim.forEach(f => f(dt, W.t)); envStep(dt); cameraStep(dt); avatarsStep(dt);
  if (W.C) W.C.update(dt, W.cFloor || 0);
  for (const s of W.labels) { s.getWorldPosition(tmpV); const o = GUI.kind === 'line' ? 0 : smooth(2.4, 5, tmpV.distanceTo(W.cam.position)); s.material.opacity = o; s.visible = o > .02; }
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
  if (secAcc >= 1) { secAcc = 0; checkBranch(); renderTop(); renderXP(); renderObjective(); renderHotbar(); renderNetChip(); if (tab === 'live' && NET.on) renderLiveOthersOnly(); const ae = document.activeElement; if (!(ae && ae.tagName === 'INPUT') && tab === 'branch') renderBranch(); if (PANEL[tab]) renderShop(tab); }
  if (saveAcc > 5) { saveAcc = 0; save(); }
  try {
    const g = GUI.kind;
    if (W.ready && TITLE.on) titleStep(dt);
    else if (W.ready && (!g || g === 'line')) { worldStep(dt); renderCompass(); }
    netTick(dt);
    if (M.active) makeTick(dt);
    if (tab === 'decor') decorSt.step(dt);
    else if (tab === 'live') { liveSt.step(dt); if (!L.watch) { $('#hypeBar').style.width = L.hype + '%'; $('#liveViewers').textContent = Math.round(L.viewers) + ' 觀眾'; } if (++hudN % 15 === 0) updateLiveHUD(); }
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
if (initWorld()) { renderHotbar(true); renderXP(); renderObjective(); renderQuest(); $('#startHint').innerHTML = '<b>點擊畫面開始</b><br>WASD 移動 · 滑鼠環顧 · E 互動 · I 背包 · Esc 選單'; }
{ const bt = $('#boot'); if (bt && !bt.hidden) { bt.classList.add('out'); setTimeout(() => { bt.hidden = true; bt.classList.remove('out'); }, 520); } }
addEventListener('beforeunload', save); addEventListener('pagehide', save);
let hiddenAt = 0;
document.addEventListener('visibilitychange', () => {
  if (document.hidden) { hiddenAt = Date.now(); save(); return; }
  if (!hiddenAt) return; const el = Math.min((Date.now() - hiddenAt) / 1000, 1800); hiddenAt = 0; lastT = performance.now(); if (el < 8 || !S.web.length) return;
  let gain = 0, n = 0; for (let i = 0; i < Math.floor(el / 4) && S.web.length; i++) { const r = webTick(); if (r) { gain += r.price; n++; } }
  if (n) { toast(`離開期間網站賣出 ${n} 件，+${fmt(gain)}`); sfx.coin(); renderTop(); renderHotbar(); }
});
if (sessionStorage.getItem('squish_autostart')) { sessionStorage.removeItem('squish_autostart'); startPlay(); } else showTitle();
requestAnimationFrame(loop);
