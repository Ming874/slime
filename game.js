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
  const fixPr = o => Object.fromEntries(Object.entries(obj(o)).filter(([k, v]) => SP[k] && isFinite(+v) && +v >= 1).map(([k, v]) => [k, clamp(Math.round(+v), 1, 99999)]));
  s.price = { live: fixPr(obj(s.price).live), web: fixPr(obj(s.price).web) };
  s.codex = obj(s.codex); s.regulars = obj(s.regulars);
  s.rate = arr(s.rate).filter(n => n >= 1 && n <= 5).slice(-40); if (!s.rate.length) s.rate = [4, 4, 5];
  s.reviews = arr(s.reviews).filter(v => v && REVIEWS[v.s]).slice(0, 8);
  s.contracts = arr(s.contracts).filter(c => c && (c.sp === 'any' || SP[c.sp]) && isFinite(+c.dl));
  s.customers = arr(s.customers).filter(c => c && SP[c.sp] && isFinite(+c.dl));
  if (s.branch && !BRANCHES[s.branch]) s.branch = null;
  if (s.pos && !(Number.isFinite(s.pos.x) && Number.isFinite(s.pos.z) && Number.isFinite(s.pos.yaw))) s.pos = null;
  s.hb = clamp(Math.floor(+s.hb) || 0, 0, 8); s.sens = clamp(Math.floor(+s.sens) || 0, 0, 2);
  // 已購買的設備：只保留有效項目；改版前（設備內建）的舊存檔自動補發
  const OWN_KEYS = ['slicer', 'coater', 'dryer', 'decor', 'live'];
  if (!o.own || typeof o.own !== 'object') { s.own = {}; if (o.seen && ((+o.sales || 0) > 0 || Object.values(obj(o.codex)).some(c => c && c.made > 0))) { OWN_KEYS.forEach(k => s.own[k] = true); s.ownMigrated = true; } }
  else s.own = Object.fromEntries(Object.entries(o.own).filter(([k, v]) => OWN_KEYS.includes(k) && v).map(([k]) => [k, true]));
  if (s.mk && !(SP[s.mk.sp] && s.mk.step >= 0 && s.mk.step < 3 && Array.isArray(s.mk.prec) && s.mk.prec.length === s.mk.step)) s.mk = null;
  return s;
}
function load() {
  try { const o = JSON.parse(localStorage.getItem(SAVE_KEY)); if (o && typeof o === 'object') return sanitize(o); } catch (e) { console.warn('存檔讀取失敗，將開始新遊戲', e); }
  return null;
}
let S = load() || fresh(), resetting = false; if (!S.own) S.own = {};
let NOSAVE = false, saveWarned = false;
const lsGet = k => { try { return localStorage.getItem(k); } catch (e) { return null; } };
function save() { if (NOSAVE || resetting) return; S.last = Date.now(); if (P) S.pos = { x: P.x, z: P.z, yaw: P.yaw }; try { localStorage.setItem(SAVE_KEY, JSON.stringify(S)); saveWarned = false; } catch (e) { if (!saveWarned) { saveWarned = true; setTimeout(() => toast('無法儲存進度：瀏覽器的儲存空間已滿或被停用（無痕模式？）'), 0); } } }

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
    const Ctx = window.AudioContext || window.webkitAudioContext; if (!Ctx) throw new Error('no audio');
    AC = new Ctx();
    const comp = AC.createDynamicsCompressor(); comp.threshold.value = -16; comp.knee.value = 12; comp.ratio.value = 4; comp.attack.value = .003; comp.release.value = .2; comp.connect(AC.destination);
    master = AC.createGain(); master.gain.value = 0.9; master.connect(comp);
    NB = AC.createBuffer(1, AC.sampleRate, AC.sampleRate); const d = NB.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  }
  if (AC.state === 'suspended') { const r = AC.resume(); if (r && r.catch) r.catch(() => { }); } return AC;
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
function sweep(f0, f1, t0, len, vol, type = 'sine') {
  const o = AC.createOscillator(), g = AC.createGain(); o.type = type; o.frequency.setValueAtTime(f0, t0); o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t0 + len);
  g.gain.setValueAtTime(0.0001, t0); g.gain.linearRampToValueAtTime(vol, t0 + 0.01); g.gain.exponentialRampToValueAtTime(0.0008, t0 + len);
  o.connect(g); g.connect(master); o.start(t0); o.stop(t0 + len + 0.05);
}
const sfx = {
  crunch(power = 1, crisp = 0.8) {
    if (!S.sound) return; const ac = audio(), t = ac.currentTime, n = 3 + Math.floor(Math.random() * (2 + 4 * crisp));
    for (let i = 0; i < n; i++) noise(ac, t + i * rnd(0.006, 0.03), rnd(0.03, 0.09), rnd(1800, 7000) * (0.7 + crisp * 0.5), rnd(0.8, 3), rnd(0.25, 0.6) * power, 'bandpass', rnd(0.7, 1.5));
    noise(ac, t, 0.12, rnd(300, 600), 0.7, 0.25 * power, 'lowpass');
  },
  squish(s = 0.5, pitch = 1) {
    if (!S.sound) return; const ac = audio(), t = ac.currentTime; noise(ac, t, rnd(0.08, 0.16), rnd(400, 900) * pitch, 1.5, 0.18 * s, 'lowpass', rnd(.6, 1) * pitch);
    sweep(rnd(260, 320) * pitch, 120 * pitch, t, .12, .05 * s); noise(ac, t + .03, .05, 2400 * pitch, 2, .04 * s, 'bandpass');
  },
  boing(pitch = 1, v = 1) { if (!S.sound || v <= .02) return; const ac = audio(), t = ac.currentTime; sweep(380 * pitch, 150 * pitch, t, .14, .045 * v); noise(ac, t, .07, 600 * pitch, 1, .05 * v, 'lowpass'); },
  notice(v = 1) { if (!S.sound) return; const t = audio().currentTime; tone(1180, t, .06, .025 * v, 'triangle'); tone(1760, t + .05, .09, .025 * v, 'triangle'); },
  collect() { if (!S.sound) return; const t = audio().currentTime; sweep(300, 900, t, .12, .06); tone(1568, t + .08, .18, .04, 'triangle'); },
  jump() { if (!S.sound) return; const ac = audio(); noise(ac, ac.currentTime, .12, 700, .7, .04, 'lowpass'); },
  land(k = .5, kind = 'grass') { if (!S.sound) return; const ac = audio(); noise(ac, ac.currentTime, .16, 180, .8, .08 + k * .14, 'lowpass'); sfx.step(kind, 1.2 + k); },
  pop() { if (!S.sound) return; const t = audio().currentTime; [660, 880, 1320].forEach((f, i) => tone(f, t + i * 0.07, 0.25, 0.16)); },
  tick() { if (!S.sound) return; const ac = audio(); noise(ac, ac.currentTime, 0.05, 2500, 2, 0.2); },
  // 腳步聲依地面材質變化：草地／泥土小徑／沙灘／岩石／雪地／城市柏油
  step(kind = 'grass', v = 1) {
    if (!S.sound) return; const ac = audio(), t = ac.currentTime;
    if (kind === 'snow') { for (let i = 0; i < 3; i++) noise(ac, t + i * .018, .05, rnd(900, 1800), 1.2, .045 * v, 'bandpass'); noise(ac, t, .09, 400, .8, .04 * v, 'lowpass'); }
    else if (kind === 'sand') noise(ac, t, .13, rnd(1200, 1800), .6, .05 * v, 'bandpass', .7);
    else if (kind === 'rock' || kind === 'city') { noise(ac, t, .04, kind === 'city' ? 2600 : 1400, 2.5, .07 * v, 'bandpass'); noise(ac, t, .06, 180, 1, .06 * v, 'lowpass'); }
    else if (kind === 'dirt') { noise(ac, t, .07, rnd(500, 800), .9, .07 * v, 'lowpass'); noise(ac, t + .01, .04, 2200, 1.5, .02 * v, 'bandpass'); }
    else { noise(ac, t, .06, rnd(300, 600), 1, .05 * v, 'lowpass'); noise(ac, t, .08, rnd(3000, 5000), 1.2, .016 * v, 'bandpass'); }
  },
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

for (const k of Object.keys(sfx)) { const f = sfx[k]; sfx[k] = (...a) => { try { f(...a); } catch (e) { } }; }
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
function makeView(cv, bg, fov = 38, keep = false) {
  const r = new THREE.WebGLRenderer({ canvas: cv, antialias: true, powerPreference: 'high-performance', preserveDrawingBuffer: keep });
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
// 從場景移除並釋放 GPU 資源（含名牌貼圖），同時從名牌清單移除，避免每幀還在計算已刪除的物件
function dropObj(o) {
  if (!o) return; if (o.parent) o.parent.remove(o); const gone = new Set();
  o.traverse(c => {
    if (c.isSprite) gone.add(c); else if (c.geometry && !c.userData.shared) c.geometry.dispose();
    if (c.material && !c.userData.shared) (Array.isArray(c.material) ? c.material : [c.material]).forEach(m => { if (c.userData.ownTex && m.map) m.map.dispose(); m.dispose(); });
  });
  if (gone.size && W.labels) W.labels = W.labels.filter(l => !gone.has(l));
}
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
function mergeParts(parts, smoothN = false) {
  const gs = []; let total = 0;
  for (const [g0, c, m] of parts) {
    const g = g0.index ? g0.toNonIndexed() : g0.clone(); if (m) g.applyMatrix4(m);
    if (g.attributes.uv) g.deleteAttribute('uv'); if (!smoothN) g.computeVertexNormals(); gs.push([g, new THREE.Color(c)]); total += g.attributes.position.count;
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
  tex.anisotropy = 4; tex.generateMipmaps = true; tex.minFilter = THREE.LinearMipmapLinearFilter;
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, depthWrite: false, fog: false, transparent: true })); s.scale.set(2.4, .75, 1); s.userData.ownTex = true; W.labels.push(s); return s;
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
    try { st.v = makeView(cv, mode === 'squeeze' ? '#0c0a18' : '#0b1220', 36, mode === 'decor'); } catch (e) { toast('此裝置不支援 WebGL'); return false; }
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
// 精確高度（只在建地形網格時使用）
function Hx(x, z) { if (x > 1500) return 0; return H0(x / K, z / K) * K; }
/* 執行期高度：直接取樣地形網格（與畫面上的三角面完全一致，且只要幾次陣列讀取）。
   原本每次都重算多層雜訊，且與網格線性內插的結果有落差：小石子會浮在山坡上、腳會陷進地面。 */
let HF = null;
function H(x, z) {
  if (x > 1500) return 0; const f = HF; if (!f) return Hx(x, z);
  const fx = (x + f.half) / f.cell, fz = (z + f.half) / f.cell, i = Math.floor(fx), j = Math.floor(fz);
  if (i < 0 || j < 0 || i >= f.n || j >= f.n) return Hx(x, z);
  const u = fx - i, v = fz - j, r = f.row, h = f.hs, a = h[j * r + i], b = h[(j + 1) * r + i], d = h[j * r + i + 1];
  // PlaneGeometry 的對角線由 (i, j+1) 連到 (i+1, j)
  if (u + v <= 1) return a + (d - a) * u + (b - a) * v;
  const c = h[(j + 1) * r + i + 1]; return c + (b - c) * (1 - u) + (d - c) * (1 - v);
}
function H0(x, z) {
  const ax = Math.abs(x), az = Math.abs(z), r = Math.max(ax, az);
  let h = (fbm(x * .045, z * .045, 3) - .45) * 3.2 + (vnoise(x * .2, z * .2, 11) - .5) * .35;
  const fl = 1 - smooth(16, 26, Math.hypot(x, z)); h = h * (1 - fl) + .25 * fl;
  let ridge = Math.exp(-((r - 54) ** 2) / 34) * (13 + fbm(x * .07, z * .07, 5) * 9);
  const pass = ax > az ? Math.exp(-(z * z) / 16) : (z < 0 ? Math.exp(-(x * x) / 16) : 0);
  ridge *= 1 - pass * .97; h += ridge;
  h += smooth(160, 182, r) * (18 + fbm(x * .03, z * .03, 8) * 24);
  // 各區之間的分隔山脈（沿對角線），讓海岸、火山、雪原各自獨立
  const outer = smooth(56, 68, r), dg = (ax - az) / 1.4142;
  h += Math.exp(-(dg * dg) / 50) * outer * (22 + fbm(x * .05, z * .05, 17) * 14);
  // 南方沒有隘口，整片是高山
  if (z > 0 && az > ax) h += smooth(56, 72, az) * (20 + fbm(x * .04, z * .04, 19) * 18);
  // 海岸：沙灘更寬，海在更東邊
  const sea = smooth(128, 144, x); h = h * (1 - sea) - 2.8 * sea;
  // 火山：主峰移到更北邊並加大
  const vn = smooth(62, 84, -z), vd = Math.hypot(x, z + 130); h += Math.max(0, 34 * (1 - vd / 36)) * vn; if (vd < 5) h -= (5 - vd) * 2.4 * vn;
  // 雪原：起伏更大的丘陵
  h += smooth(62, 84, -x) * fbm(x * .05, z * .05, 21) * 10;
  return h;
}
const WS_R = 16, WS_Y = .4;
function G(x, z) { return H(x, z); }

/* 天空環境光（IBL）：用和天空相同的漸層＋太陽烘焙成 PMREM。
   原本開放世界用的是攝影棚式的暗色環境圖，金屬、水面、史萊姆反射出的是一片深藍黑色，與晴朗的天空不符。
   切換生態區時（天空顏色改變）重新烘焙，間隔至少 1.5 秒 */
function skyEnv(force) {
  const top = W.sky.material.uniforms.top.value, bot = W.sky.material.uniforms.bot.value, gnd = W.hemi.groundColor;
  const sig = [top, bot, gnd].map(c => c.getHexString()).join('');
  if (!force && (sig === W.envSig || performance.now() - (W.envT || 0) < 1500)) return;
  W.envSig = sig; W.envT = performance.now();
  if (!W.envScene) {
    W.pmrem = new THREE.PMREMGenerator(W.r); W.envScene = new THREE.Scene();
    W.envMat = new THREE.ShaderMaterial({
      uniforms: { top: { value: new THREE.Color() }, bot: { value: new THREE.Color() }, gnd: { value: new THREE.Color() }, sunDir: { value: SUN_D }, k: { value: .72 } }, side: THREE.BackSide, depthWrite: false,
      vertexShader: 'varying vec3 vd; void main(){ vd = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
      fragmentShader: 'uniform vec3 top; uniform vec3 bot; uniform vec3 gnd; uniform vec3 sunDir; uniform float k; varying vec3 vd; void main(){ vec3 d = normalize(vd); vec3 c = d.y >= 0.0 ? mix(bot, top, smoothstep(0.0, 0.45, d.y)) : mix(bot * 0.8, gnd * 1.6, smoothstep(0.0, 0.3, -d.y)); float s = max(dot(d, sunDir), 0.0); c += vec3(1.0, 0.93, 0.8) * (pow(s, 900.0) * 40.0 + pow(s, 30.0) * 0.4) * smoothstep(-0.05, 0.05, d.y); gl_FragColor = vec4(c * k, 1.0); }',
    });
    W.envScene.add(new THREE.Mesh(new THREE.SphereGeometry(10, 32, 16), W.envMat));
  }
  const u = W.envMat.uniforms; u.top.value.copy(top); u.bot.value.copy(bot); u.gnd.value.copy(gnd);
  const rt = W.pmrem.fromScene(W.envScene, 0, .1, 50); if (W.envRT) W.envRT.dispose(); W.envRT = rt; W.scene.environment = rt.texture;
}
const W = { ready: false, anim: [], inter: [], t: 0, wind: { value: 0 }, chunks: [], cullN: 0, cols: new Map(), gates: {}, slimes: [], puz: [], labels: [], sid: 0, spawned: new Set(), mirror: false };
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
  DRS.base = Math.min(window.devicePixelRatio || 1, LOW ? 1.25 : 1.75); W.r.setPixelRatio(DRS.base); W.r.toneMapping = THREE.ACESFilmicToneMapping; W.r.toneMappingExposure = 1;
  cv.addEventListener('webglcontextlost', () => { W.lost = true; toast('顯示資源被系統暫時回收，正在恢復畫面…'); });
  cv.addEventListener('webglcontextrestored', () => { W.lost = false; try { W.envSig = ''; skyEnv(true); } catch (e) { } }); // 環境光貼圖要重新烘焙，否則反射一片黑
  if (!LOW) { W.r.shadowMap.enabled = true; W.r.shadowMap.type = THREE.PCFSoftShadowMap; }
  const sc = W.scene = new THREE.Scene(); sc.background = new THREE.Color('#cfe6dc'); sc.fog = new THREE.Fog('#cfe6dc', 70, LOW ? 170 : 260);
  W.cam = new THREE.PerspectiveCamera(72, 1, .08, 700); W.cam.rotation.order = 'YXZ';
  W.hemi = new THREE.HemisphereLight('#d8f0ff', '#2d4a2f', .55); sc.add(W.hemi);
  W.sun = new THREE.DirectionalLight('#fff3d6', 2.6); W.sun.castShadow = !LOW; sc.add(W.sun); sc.add(W.sun.target);
  if (!LOW) { const sh = W.sun.shadow; sh.mapSize.set(SH_RES, SH_RES); Object.assign(sh.camera, { left: -SH_EXT, right: SH_EXT, top: SH_EXT, bottom: -SH_EXT, near: 1, far: 140 }); sh.bias = -.0004; sh.normalBias = .05; sh.camera.updateProjectionMatrix(); }
  // 天空（漸層 shader）
  W.sky = new THREE.Mesh(new THREE.SphereGeometry(600, 32, 16), new THREE.ShaderMaterial({
    uniforms: { top: { value: new THREE.Color('#5ea7d6') }, bot: { value: new THREE.Color('#cfe6dc') }, sunDir: { value: new THREE.Vector3(30, 55, 22).normalize() } }, side: THREE.BackSide, depthWrite: false, fog: false,
    vertexShader: 'varying vec3 vd; void main(){ vd = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
    fragmentShader: 'uniform vec3 top; uniform vec3 bot; uniform vec3 sunDir; varying vec3 vd; void main(){ vec3 d = normalize(vd); vec3 c = mix(bot, top, smoothstep(0.0, 0.45, d.y)); float s = max(dot(d, sunDir), 0.0); c += vec3(1.0, 0.93, 0.78) * (pow(s, 700.0) * 3.5 + pow(s, 48.0) * 0.28 + pow(s, 6.0) * 0.07) * smoothstep(-0.05, 0.05, d.y); c += (fract(sin(dot(gl_FragCoord.xy, vec2(12.9898, 78.233))) * 43758.5453) - 0.5) / 160.0; gl_FragColor = vec4(c, 1.0);\n#include <tonemapping_fragment>\n#include <colorspace_fragment>\n}',
  })); W.sky.renderOrder = -1; sc.add(W.sky);
  buildTerrain(); buildWater(); buildProps(); buildLandmarks(); buildFauna(); buildWorkshop(); buildCity(); buildVolcanoFx(); buildGates(); buildPuzzles(); buildParticles(); buildClouds();
  W.goo = makeGoo(sc); skyEnv(true);
  initPlayer(); spawnAllSlimes(); resizeWorld(); bindInput(); W.ready = true; return true;
}
/* ---------- 小徑：烘焙成遮罩（地表著色、道具避讓、腳步聲共用） ---------- */
const MAP_SIZE = 370 * K, PMR = 512, PMASK = new Float32Array(PMR * PMR); let PATH_TEX = null;
const PATH_LINES = [
  [[11, 0], [20, 2.5], [32, -1.5], [44, 1], [54, 0], [64, 2], [76, -2.5], [92, 0], [104, 3]],
  [[0, -11], [-2.5, -22], [2, -34], [-1, -46], [0, -54], [-1, -60], [-6, -63.5]],
  [[-1, -60], [4, -72], [-2, -86]],
  [[-11, 0], [-21, -2.5], [-33, 2], [-45, -1], [-54, 0], [-65, 2], [-78, -2], [-94, 1]],
].map(l => l.map(kk));
const GIANT = kk([30, 22]), RUINS = kk([-28, -28]);
function crPts(pts, n = 6) {
  const out = [];
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[Math.max(0, i - 1)], p1 = pts[i], p2 = pts[i + 1], p3 = pts[Math.min(pts.length - 1, i + 2)];
    for (let k = 0; k < n; k++) { const t = k / n, t2 = t * t, t3 = t2 * t; out.push([0, 1].map(j => .5 * (2 * p1[j] + (-p0[j] + p2[j]) * t + (2 * p0[j] - 5 * p1[j] + 4 * p2[j] - p3[j]) * t2 + (-p0[j] + 3 * p1[j] - 3 * p2[j] + p3[j]) * t3))); }
  }
  out.push(pts[pts.length - 1]); return out;
}
function bakePaths() {
  if (PATH_TEX) return; const cell = MAP_SIZE / PMR, half = MAP_SIZE / 2;
  const seg = (ax, az, bx, bz, w) => {
    const i0 = Math.max(0, Math.floor((Math.min(ax, bx) - w - 1 + half) / cell)), i1 = Math.min(PMR - 1, Math.ceil((Math.max(ax, bx) + w + 1 + half) / cell));
    const j0 = Math.max(0, Math.floor((Math.min(az, bz) - w - 1 + half) / cell)), j1 = Math.min(PMR - 1, Math.ceil((Math.max(az, bz) + w + 1 + half) / cell));
    const dx = bx - ax, dz = bz - az, L2 = dx * dx + dz * dz || 1;
    for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) {
      const px = (i + .5) * cell - half, pz = (j + .5) * cell - half, t = clamp(((px - ax) * dx + (pz - az) * dz) / L2, 0, 1), d = Math.hypot(px - ax - dx * t, pz - az - dz * t);
      const ww = w * (.8 + vnoise(px * .2, pz * .2, 47) * .45), v = 1 - smooth(ww * .5, ww, d), k = j * PMR + i; if (v > PMASK[k]) PMASK[k] = v;
    }
  };
  const line = (pts, w) => { for (let i = 0; i < pts.length - 1; i++) seg(pts[i][0], pts[i][1], pts[i + 1][0], pts[i + 1][1], w); };
  PATH_LINES.forEach(l => line(crPts(l), 1.35));
  line(Array.from({ length: 73 }, (_, i) => [Math.cos(i / 72 * PI2) * 18.5, Math.sin(i / 72 * PI2) * 18.5]), 1.4);
  line(crPts([[-3, 16.5], [-6, 14.5], [-8.6, 12.4]]), 1); line([[0, 15], [0, 18.5]], 1.1);
  line(crPts([[GIANT[0] - 22, GIANT[1] - 30], [GIANT[0] - 8, GIANT[1] - 12], [GIANT[0] - 2, GIANT[1] - 3]].map(([x, z]) => [x, z])), .9);
  const u8 = new Uint8Array(PMR * PMR); for (let i = 0; i < u8.length; i++) u8[i] = Math.round(PMASK[i] * 255);
  PATH_TEX = new THREE.DataTexture(u8, PMR, PMR, THREE.RedFormat, THREE.UnsignedByteType); PATH_TEX.magFilter = PATH_TEX.minFilter = THREE.LinearFilter; PATH_TEX.needsUpdate = true;
}
function onPath(x, z) {
  const half = MAP_SIZE / 2, fx = (x + half) / MAP_SIZE * PMR - .5, fz = (z + half) / MAP_SIZE * PMR - .5, i = Math.floor(fx), j = Math.floor(fz);
  if (i < 0 || j < 0 || i >= PMR - 1 || j >= PMR - 1) return 0; const u = fx - i, v = fz - j, k = j * PMR + i;
  return (PMASK[k] * (1 - u) + PMASK[k + 1] * u) * (1 - v) + (PMASK[k + PMR] * (1 - u) + PMASK[k + PMR + 1] * u) * v;
}
/* 地表細節：世界座標雜訊（草地明暗、乾草斑塊、細碎顆粒）＋小徑泥土 */
const GLSL_HASH2 = 'float tH(vec2 p){ vec3 p3 = fract(vec3(p.xyx) * 0.1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y) * p3.z); }\nfloat tN(vec2 p){ vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f); return mix(mix(tH(i), tH(i + vec2(1.0, 0.0)), f.x), mix(tH(i + vec2(0.0, 1.0)), tH(i + vec2(1.0, 1.0)), f.x), f.y); }';
/* 共用的 GLSL：雜訊、生態區權重（與 biomeW0 相同）、以螢幕空間導數做凹凸（不需要貼圖） */
const GLSL_DETAIL = GLSL_HASH2 + `
float tFbm(vec2 p) { return tN(p) * 0.5 + tN(p * 2.03 + 17.1) * 0.3 + tN(p * 4.01 + 31.7) * 0.2; }
vec4 tBiome(vec2 p) { p /= ${K.toFixed(2)}; float c = smoothstep(44.0, 60.0, p.x), v = smoothstep(44.0, 60.0, -p.y), s = smoothstep(44.0, 60.0, -p.x); float f = max(0.0, 1.0 - c - v - s); return vec4(f, c, v, s) / (f + c + v + s); }
vec3 tPerturb(vec3 sp, vec3 n, vec2 dh) { vec3 sx = dFdx(sp), sy = dFdy(sp), r1 = cross(sy, n), r2 = cross(n, sx); float det = dot(sx, r1); vec3 g = sign(det) * (dh.x * r1 + dh.y * r2); return normalize(abs(det) * n - g); }
`;
const WATER_Y = -.9 * K;
/* 地表材質：
   - 草地：多層草叢明暗、細碎凹凸
   - 陡坡：沿高度的岩層紋理、裂縫與凹凸
   - 小徑：泥土＋散落的小石子
   - 海岸：沙紋、浪打濕的深色沙灘（較光亮）、水下的焦散光紋
   - 雪原：會隨視角閃爍的冰晶；火山：在地面裂縫中隱隱發光的岩漿 */
function terrainMat() {
  const m = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: .95, metalness: 0 });
  if (!LOW) m.defines = { T_HQ: '' };
  m.onBeforeCompile = sh => {
    sh.uniforms.uPath = { value: PATH_TEX }; sh.uniforms.uTime = W.wind;
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nattribute vec3 dirt;\nvarying vec3 vDirt;\nvarying vec3 vWP;\nvarying vec3 vWN;').replace('#include <begin_vertex>', '#include <begin_vertex>\nvDirt = dirt; vWP = position; vWN = normal;');
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nuniform sampler2D uPath;\nuniform float uTime;\nvarying vec3 vDirt;\nvarying vec3 vWP;\nvarying vec3 vWN;\n' + GLSL_DETAIL)
      .replace('#include <color_fragment>', `#include <color_fragment>
        vec2 wp = vWP.xz; float n1 = tN(wp * 0.85), n2 = tN(wp * 3.3), n3 = tN(wp * 0.11 + 7.0), n4 = tN(wp * 11.0);
        float tDist = distance(vWP, cameraPosition), tNear = 1.0 - smoothstep(28.0, 70.0, tDist);
        vec4 tB = tBiome(wp); float rockK = smoothstep(0.17, 0.42, 1.0 - clamp(normalize(vWN).y, 0.0, 1.0)), soil = 1.0 - rockK;
        diffuseColor.rgb *= 0.87 + 0.15 * n1 + 0.07 * n2 + 0.05 * n4;
        diffuseColor.rgb = mix(diffuseColor.rgb, diffuseColor.rgb * vec3(1.1, 1.05, 0.84), smoothstep(0.58, 0.8, n3) * 0.4);
        // 草叢：較暗的叢生區與被曬淡的斑塊
        float clump = tFbm(wp * 0.42), grassK = (tB.x + tB.y * 0.5) * soil * smoothstep(-0.5, 0.8, vWP.y);
        diffuseColor.rgb *= mix(1.0, 0.84 + 0.3 * clump, grassK);
        diffuseColor.rgb = mix(diffuseColor.rgb, diffuseColor.rgb * vec3(1.12, 1.08, 0.8), smoothstep(0.62, 0.78, tN(wp * 0.23 + 3.0)) * grassK * 0.35);
        float tHt = (n4 - 0.5) * 0.012 * soil + (n2 - 0.5) * 0.03 * soil + (clump - 0.5) * 0.08 * grassK;
        // 岩壁：岩層＋裂縫（用兩個斜向平面取樣，避免垂直面上的雜訊被拉長）
        float rn = tN(vec2(wp.x + wp.y, vWP.y * 1.4) * 0.8) * 0.5 + tN(vec2(wp.x - wp.y, vWP.y * 1.4) * 0.8 + 9.0) * 0.5;
        float strata = sin(vWP.y * 2.3 + rn * 5.0 + tN(wp * 0.07) * 4.0);
        float rf = tFbm(vec2(wp.x + wp.y, vWP.y * 1.2) * 1.7);
        diffuseColor.rgb *= mix(1.0, 0.86 + 0.08 * strata + 0.14 * rn + 0.1 * rf, rockK);
        tHt += rockK * (strata * 0.06 + (rn - 0.5) * 0.22 + (rf - 0.5) * 0.08);
        // 小徑
        float pm = texture2D(uPath, wp / ${MAP_SIZE.toFixed(2)} + 0.5).r;
        float pe = smoothstep(0.05, 0.3, pm) * (1.0 - smoothstep(0.45, 0.8, pm)), pathK = smoothstep(0.22, 0.6, pm);
        diffuseColor.rgb = mix(diffuseColor.rgb, vDirt * (0.82 + 0.2 * n2 + 0.1 * n4), pathK * 0.93);
        diffuseColor.rgb *= 1.0 - pe * 0.14;
        vec2 pc = floor(wp * 5.0), pf = fract(wp * 5.0) - 0.5 - (vec2(tH(pc + 3.1), tH(pc + 7.3)) - 0.5) * 0.45; float ph = tH(pc);
        float peb = step(0.74, ph) * (1.0 - smoothstep(0.02, 0.19, length(pf * vec2(1.0, 1.3))));
        diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.3, 0.28, 0.25) * (0.75 + 0.6 * ph), peb * pathK * 0.85);
        tHt += pathK * (peb * 0.035 - n2 * 0.02 - grassK * 0.0);
        // 海岸：沙紋與潮濕沙灘
        float beach = tB.y * soil * (1.0 - smoothstep(1.4, 2.8, vWP.y));
        float rip = sin(dot(wp, vec2(0.8, 0.6)) * 4.4 + tN(wp * 0.35) * 6.0 + n2 * 1.5);
        diffuseColor.rgb *= 1.0 + beach * rip * 0.035; tHt += beach * rip * 0.02;
        float wet = tB.y * (1.0 - smoothstep(${(WATER_Y + .05).toFixed(2)}, ${(WATER_Y + .75).toFixed(2)}, vWP.y));
        diffuseColor.rgb *= mix(1.0, 0.66, wet);
        // 火山：地面裂縫透出岩漿光
        // 兩層粗細不同、斷斷續續的岩漿裂縫，只出現在部分區域
        float vk = tB.z * soil * smoothstep(0.45, 0.68, tN(wp * 0.06 + 11.0));
        float emb = ((1.0 - smoothstep(0.0, 0.03, abs(tN(wp * 0.33 + 3.0) - 0.5))) * smoothstep(0.3, 0.55, tN(wp * 1.7 + 5.0))
                  + (1.0 - smoothstep(0.0, 0.025, abs(tN(wp * 1.1 + 8.0) - 0.5))) * smoothstep(0.45, 0.7, tN(wp * 2.3 + 1.0)) * 0.7) * vk;
        diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.07, 0.045, 0.04), emb * 0.85); tHt -= emb * 0.05;
        vec3 tGlow = vec3(1.0, 0.32, 0.05) * emb * (0.5 + 0.4 * sin(uTime * 1.6 + wp.x * 0.3 + wp.y * 0.2));
        // 雪原：柔和起伏
        tHt += tB.w * soil * (tN(wp * 0.9) - 0.5) * 0.06;
        #ifdef T_HQ
          // 雪地冰晶閃光（隨相機移動而閃爍）
          vec2 gc = floor(wp * 20.0); float gh = tH(gc), tw = fract(gh * 37.0 + dot(normalize(cameraPosition - vWP), vec3(9.1, 4.3, 7.7)));
          tGlow += vec3(1.0, 0.98, 0.94) * tB.w * soil * step(0.965, gh) * smoothstep(0.82, 1.0, tw) * (1.0 - smoothstep(0.25, 0.4, length(fract(wp * 20.0) - 0.5))) * (1.0 - smoothstep(12.0, 40.0, tDist)) * 2.2;
          // 淺水區的焦散光紋
          float dep = ${WATER_Y.toFixed(2)} - vWP.y, ck = tB.y * smoothstep(0.05, 0.5, dep) * (1.0 - smoothstep(1.5, 5.0, dep));
          vec2 cp = wp * 0.85; float ca = tN(cp + vec2(uTime * 0.33, uTime * 0.21)), cb = tN(cp * 1.37 - vec2(uTime * 0.27, uTime * 0.3) + 5.0);
          tGlow += vec3(0.7, 1.0, 0.92) * pow(max(0.0, 1.0 - abs(ca - cb) * 2.2), 7.0) * ck * 0.45;
        #endif
        tHt *= tNear;`)
      .replace('#include <roughnessmap_fragment>', `#include <roughnessmap_fragment>
        roughnessFactor = mix(roughnessFactor, 0.34, wet); roughnessFactor = mix(roughnessFactor, 0.7, tB.w * soil * 0.7);`)
      .replace('#include <normal_fragment_maps>', `#include <normal_fragment_maps>
        #ifdef T_HQ
          normal = tPerturb(-vViewPosition, normal, vec2(dFdx(tHt), dFdy(tHt)));
        #endif`)
      .replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\ntotalEmissiveRadiance += tGlow;');
  };
  m.customProgramCacheKey = () => 'terrain3'; return m;
}
/* 風：草、花、蕨類、樹冠依高度擺動（每株相位不同） */
/* 遠處縮小淡出：草、花、碎石這類小物件在 fade[0]～fade[1] 公尺之間縮進地面，
   超過就整塊不畫（原本整張地圖的草叢都在繪製，遠處只有幾個像素卻佔掉大量三角面） */
const FADE_V = '\n#ifdef USE_INSTANCING\n  transformed *= 1.0 - smoothstep(uFade.x, uFade.y, distance(vec2(instanceMatrix[3][0], instanceMatrix[3][2]), cameraPosition.xz));\n#endif\n';
function fadeMat(m, fade) {
  m.onBeforeCompile = sh => {
    sh.uniforms.uFade = { value: new THREE.Vector2(fade[0], fade[1]) };
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nuniform vec2 uFade;').replace('#include <begin_vertex>', '#include <begin_vertex>' + FADE_V);
  };
  m.customProgramCacheKey = () => 'fade'; return m;
}
function windMat(m, amp, noFlip = false, fade = null) {
  m.onBeforeCompile = sh => {
    if (noFlip) sh.fragmentShader = sh.fragmentShader.replace('#include <normal_fragment_begin>', '#include <normal_fragment_begin>\nnormal = normalize(vNormal);');
    sh.uniforms.uWind = W.wind; sh.uniforms.uWAmp = { value: amp }; sh.uniforms.uFade = { value: new THREE.Vector2(...(fade || [1e6, 1e6 + 1])) };
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nuniform float uWind;\nuniform float uWAmp;\nuniform vec2 uFade;').replace('#include <begin_vertex>', `#include <begin_vertex>
      #ifdef USE_INSTANCING
        vec2 wIp = vec2(instanceMatrix[3][0], instanceMatrix[3][2]);
      #else
        vec2 wIp = vec2(0.0);
      #endif
      float wH = max(position.y, 0.0);
      float wS = sin(uWind * 1.6 + wIp.x * 0.31 + wIp.y * 0.23) * 0.7 + sin(uWind * 3.7 + wIp.x * 1.3 - wIp.y * 0.9) * 0.3;
      transformed.x += (wS + 0.35) * uWAmp * wH * wH; transformed.z += cos(uWind * 1.3 + wIp.y * 0.37 + wIp.x * 0.11) * uWAmp * 0.5 * wH * wH;` + (fade ? FADE_V : ''));
  };
  m.customProgramCacheKey = () => 'wind' + (noFlip ? 'n' : '') + (fade ? 'f' : ''); return m;
}
/* 依區塊分組的 InstancedMesh：視錐剔除＋距離剔除＋遠近兩種精細度（LOD）
   opt.lo：遠處改用的低面數幾何；opt.far：最遠繪製距離；opt.cell：區塊大小
   原本每種道具都以 120m 大區塊整塊繪製到 260m 外、且整塊都投射陰影，三角面高達百萬以上 */
function scatter(geo, mat, list, shadow = true, opt = {}) {
  if (!list || !list.length) return; const cell = opt.cell || (LOW ? 110 : 96), groups = new Map();
  list.forEach(o => { const k = Math.floor(o.x / cell) + ',' + Math.floor(o.z / cell); if (!groups.has(k)) groups.set(k, []); groups.get(k).push(o); });
  groups.forEach(l => {
    // 有 LOD 時：im 放遠景低面數版本，pair 放近景完整版本；每株依自己與玩家的距離分配到其中一個（逐株 LOD）
    const im = instances(opt.lo || geo, mat, l, opt.lo ? false : shadow); im.frustumCulled = true; im.computeBoundingSphere();
    let x0 = Infinity, z0 = Infinity, x1 = -Infinity, z1 = -Infinity; for (const o of l) { x0 = Math.min(x0, o.x); x1 = Math.max(x1, o.x); z0 = Math.min(z0, o.z); z1 = Math.max(z1, o.z); }
    const m = 3, u = Object.assign(im.userData, { x0: x0 - m, z0: z0 - m, x1: x1 + m, z1: z1 + m, far: opt.far || Infinity, shadow: im.castShadow });
    if (opt.lo) {
      const hi = instances(geo, mat, l, shadow); hi.frustumCulled = true; hi.computeBoundingSphere(); hi.count = 0; W.scene.add(hi);
      Object.assign(u, { pair: hi, near: false, sig: -1, mats: im.instanceMatrix.array.slice(), cols: im.instanceColor ? im.instanceColor.array.slice() : null, n: l.length });
    }
    W.scene.add(im); W.chunks.push(im);
  });
}
// 逐株 LOD：近處的樹木／岩石移到完整模型（並投射陰影），其餘留在低面數模型
function lodSplit(c, at, near) {
  const u = c.userData, hi = u.pair, n = u.n, M = u.mats, C = u.cols;
  if (!near) { if (!u.near) return; u.near = false; u.sig = -1; c.instanceMatrix.array.set(M); if (C) c.instanceColor.array.set(C); c.count = n; hi.count = 0; c.instanceMatrix.needsUpdate = true; if (C) c.instanceColor.needsUpdate = true; return; }
  const r2 = LOD_D * LOD_D; let sig = 0, nh = 0;
  for (let i = 0; i < n; i++) { const dx = M[i * 16 + 12] - at.x, dz = M[i * 16 + 14] - at.z; if (dx * dx + dz * dz < r2) { sig = (sig * 31 + i + 1) % 1e9; nh++; } }
  if (u.near && sig === u.sig) return; u.near = true; u.sig = sig;
  const hm = hi.instanceMatrix.array, lm = c.instanceMatrix.array, hc = hi.instanceColor && hi.instanceColor.array, lc = C && c.instanceColor.array; let a = 0, b = 0;
  for (let i = 0; i < n; i++) {
    const dx = M[i * 16 + 12] - at.x, dz = M[i * 16 + 14] - at.z, h = dx * dx + dz * dz < r2, j = h ? a++ : b++;
    (h ? hm : lm).set(M.subarray(i * 16, i * 16 + 16), j * 16); if (C) (h ? hc : lc).set(C.subarray(i * 3, i * 3 + 3), j * 3);
  }
  hi.count = a; c.count = b; hi.instanceMatrix.needsUpdate = c.instanceMatrix.needsUpdate = true; if (C) hi.instanceColor.needsUpdate = c.instanceColor.needsUpdate = true;
}
function tuftGeo(n = 5, h = .5, seed = 1) {
  const rd = seeded(seed), pos = [], col = [], nor = [], idx = [], base = new THREE.Color('#3f7a35'), tip = new THREE.Color('#b9e27e'), c = new THREE.Color();
  for (let b = 0; b < n; b++) {
    const a = b / n * PI2 + rd() * .6, lean = .2 + rd() * .3, hh = h * (.65 + rd() * .55), w = .042, dx = Math.cos(a), dz = Math.sin(a), px = -dz * w, pz = dx * w, o = pos.length / 3;
    for (let l = 0; l < 3; l++) {
      const t = l / 2, y = hh * t, off = lean * t * t * hh + .02, ww = 1 - t * .8; c.copy(base).lerp(tip, t * t * .7 + t * .3);
      if (l < 2) { pos.push(dx * off + px * ww, y, dz * off + pz * ww, dx * off - px * ww, y, dz * off - pz * ww); col.push(c.r, c.g, c.b, c.r, c.g, c.b); nor.push(dx * .3, 1, dz * .3, dx * .3, 1, dz * .3); }
      else { pos.push(dx * off, y, dz * off); col.push(c.r, c.g, c.b); nor.push(dx * .3, 1, dz * .3); }
    }
    idx.push(o, o + 1, o + 2, o + 1, o + 3, o + 2, o + 2, o + 3, o + 4);
  }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3)); g.setIndex(idx); g.normalizeNormals(); return g;
}
function flowerGeo(pc, cc, shape) {
  const parts = [[new THREE.CylinderGeometry(.012, .016, .36, 4), '#3f7f45', M4(0, .18, 0)], [new THREE.ConeGeometry(.045, .14, 3), '#4f9a45', M4(.04, .1, 0, 0, 0, -.8)]];
  if (shape === 'daisy') { for (let i = 0; i < 7; i++) parts.push([new THREE.SphereGeometry(.05, 6, 4), pc, M4(Math.cos(i / 7 * PI2) * .055, .37, Math.sin(i / 7 * PI2) * .055, 0, -i / 7 * PI2, 0, 1, .28, .5)]); parts.push([new THREE.SphereGeometry(.032, 6, 4), cc, M4(0, .385, 0, 0, 0, 0, 1, .6, 1)]); }
  else if (shape === 'tulip') parts.push([new THREE.CylinderGeometry(.055, .03, .11, 6, 1, true), pc, M4(0, .41, 0)], [new THREE.SphereGeometry(.04, 6, 4), pc, M4(0, .37, 0)]);
  else parts.push([new THREE.ConeGeometry(.045, .09, 5, 1, true), pc, M4(0, .34, 0, Math.PI, 0, 0)], [new THREE.ConeGeometry(.04, .08, 5, 1, true), pc, M4(.05, .3, 0, Math.PI, 0, .5)], [new THREE.ConeGeometry(.035, .07, 5, 1, true), pc, M4(-.03, .27, .03, Math.PI, 0, -.4)]);
  return mergeParts(parts);
}
function buildVolcanoFx() {
  const VZ = -130 * K, y = H(0, VZ) + .3, lava = mesh(new THREE.CircleGeometry(5 * K, 32), new THREE.MeshBasicMaterial({ color: '#fb923c' }), 0, y, VZ, W.scene); lava.rotation.x = -Math.PI / 2;
  const smokeG = new THREE.IcosahedronGeometry(2, 1), smokeM = new THREE.MeshStandardMaterial({ color: '#3f3a3a', roughness: 1, transparent: true, opacity: .5, flatShading: true }), puffs = [];
  for (let i = 0; i < 12; i++) { const m = mesh(smokeG, smokeM, 0, y, VZ, W.scene); m.userData.o = i / 12; puffs.push(m); }
  // 岩漿池：外圈與內圈各用一個 InstancedMesh（原本 32 個獨立網格）
  const pools = [], rd = seeded(5);
  for (let i = 0; i < 16; i++) {
    const x = (rd() - .5) * 90 * K, z = (-64 - rd() * 80) * K; if (Math.hypot(x, z - VZ) < 40 * K || Math.abs(x) > -z - 12 * K) continue; pools.push({ x, y: H(x, z) + .05, z, r: 1.2 + rd() * 1.4 });
  }
  const pg = new THREE.CircleGeometry(1, 28).rotateX(-Math.PI / 2), outer = new THREE.InstancedMesh(pg, new THREE.MeshBasicMaterial({ color: '#ea580c' }), pools.length), inner = new THREE.InstancedMesh(pg, new THREE.MeshBasicMaterial({ color: '#fde047' }), pools.length);
  pools.forEach((p, i) => { outer.setMatrixAt(i, tmpM.makeScale(p.r, 1, p.r).setPosition(p.x, p.y, p.z)); inner.setMatrixAt(i, tmpM.makeScale(p.r * .6, 1, p.r * .6).setPosition(p.x, p.y + .01, p.z)); }); [outer, inner].forEach(m => { m.frustumCulled = false; W.scene.add(m); });
  W.anim.push((dt, t) => { if (P.z < -40 * K) { pools.forEach((p, i) => { const s = p.r * .6 * (.85 + Math.sin(t * 2 + i) * .15); inner.setMatrixAt(i, tmpM.makeScale(s, 1, s).setPosition(p.x, p.y + .01, p.z)); }); inner.instanceMatrix.needsUpdate = true; } puffs.forEach(m => { const k = (t * .04 + m.userData.o) % 1; m.position.set(Math.sin(k * 6 + m.userData.o * 9) * 3 + k * 8, y + 2 + k * 30, VZ + k * 4); m.scale.setScalar(.6 + k * 3); }); });
}
function buildTerrain() {
  bakePaths();
  const N = LOW ? 240 : 330, size = MAP_SIZE, geo = new THREE.PlaneGeometry(size, size, N, N); geo.rotateX(-Math.PI / 2);
  const p = geo.attributes.position, n = p.count, hs = new Float32Array(n), row = N + 1, cell = size / N;
  for (let i = 0; i < n; i++) { hs[i] = Hx(p.getX(i), p.getZ(i)); p.setY(i, hs[i]); }
  HF = { hs, n: N, row, cell, half: size / 2 };
  const pal = BIOMES.map(b => ZONE3D[b].pal.map(c => new THREE.Color(c))), cols = new Float32Array(n * 3), dirt = new Float32Array(n * 3), c = new THREE.Color(), t = new THREE.Color(), wet = new THREE.Color('#a8956a');
  const DIRT = ['#9a7a55', '#d9c08f', '#4a3a33', '#c3cedc'].map(x => new THREE.Color(x)), moss = new THREE.Color('#4f7a3a');
  for (let i = 0; i < n; i++) {
    const ix = i % row, iz = (i / row) | 0, x = p.getX(i), z = p.getZ(i), h = hs[i];
    const sl = (Math.abs(hs[iz * row + Math.min(row - 1, ix + 1)] - hs[iz * row + Math.max(0, ix - 1)]) + Math.abs(hs[Math.min(row - 1, iz + 1) * row + ix] - hs[Math.max(0, iz - 1) * row + ix])) / (2 * cell);
    const w = biomeW(x, z); let r = 0, g = 0, b = 0, dr = 0, dg = 0, db = 0;
    for (let k = 0; k < 4; k++) {
      if (w[k] < .01) continue; const P = pal[k];
      t.copy(P[0]).lerp(P[1], smooth(.6, 3.5, h)).lerp(P[2], smooth(5, 12, h)).lerp(P[3], smooth(.7, 1.5, sl)).lerp(P[4], smooth(16, 24, h));
      if (k === 0) t.lerp(moss, smooth(.5, .9, sl) * (1 - smooth(1.2, 1.6, sl)) * .5);
      if (k === 1) t.lerp(wet, smooth(-.1, -1.2, h));
      r += t.r * w[k]; g += t.g * w[k]; b += t.b * w[k]; dr += DIRT[k].r * w[k]; dg += DIRT[k].g * w[k]; db += DIRT[k].b * w[k];
    }
    c.setRGB(r, g, b).multiplyScalar(.88 + vnoise(x * .7, z * .7, 7) * .24);
    cols[i * 3] = c.r; cols[i * 3 + 1] = c.g; cols[i * 3 + 2] = c.b; dirt[i * 3] = dr; dirt[i * 3 + 1] = dg; dirt[i * 3 + 2] = db;
  }
  geo.setAttribute('color', new THREE.BufferAttribute(cols, 3)); geo.setAttribute('dirt', new THREE.BufferAttribute(dirt, 3)); geo.computeVertexNormals();
  /* 切成 T×T 塊共用同一份頂點資料（只各自有索引）：視野外、霧外的地形塊不繪製。
     原本整片 21 萬個三角形不論看向哪裡都全部畫出 */
  const mat = terrainMat(), T = LOW ? 6 : 8; W.terrain = [];
  for (let ty = 0; ty < T; ty++) for (let tx = 0; tx < T; tx++) {
    const i0 = Math.round(tx * N / T), i1 = Math.round((tx + 1) * N / T), j0 = Math.round(ty * N / T), j1 = Math.round((ty + 1) * N / T), ids = [];
    let y0 = Infinity, y1 = -Infinity;
    for (let j = j0; j < j1; j++) for (let i = i0; i < i1; i++) { const a = i + row * j, b = i + row * (j + 1), c = i + 1 + row * (j + 1), d = i + 1 + row * j; ids.push(a, b, d, b, c, d); }
    for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) { const h = hs[j * row + i]; if (h < y0) y0 = h; if (h > y1) y1 = h; }
    const tg = new THREE.BufferGeometry(); for (const k in geo.attributes) tg.setAttribute(k, geo.attributes[k]); tg.setIndex(ids);
    const x0 = i0 * cell - size / 2, x1 = i1 * cell - size / 2, z0 = j0 * cell - size / 2, z1 = j1 * cell - size / 2;
    tg.boundingBox = new THREE.Box3(new THREE.Vector3(x0, y0, z0), new THREE.Vector3(x1, y1, z1)); tg.boundingSphere = tg.boundingBox.getBoundingSphere(new THREE.Sphere());
    const m = new THREE.Mesh(tg, mat); m.receiveShadow = true; Object.assign(m.userData, { x0, z0, x1, z1, far: Infinity, shadow: false, terrain: true }); W.scene.add(m); W.chunks.push(m); W.terrain.push(m);
  }
}
/* 海水：GPU 波浪、依水深漸層（淺灘透綠→深海藍）、岸邊白色浪花 */
function buildWater() {
  const WW = 180 * K, WH = 400 * K, cx = 215 * K, wy = -.9 * K, R = 96, RZ = 192, dd = new Uint8Array(R * RZ);
  for (let j = 0; j < RZ; j++) for (let i = 0; i < R; i++) { const x = cx - WW / 2 + (i + .5) / R * WW, z = -WH / 2 + (j + .5) / RZ * WH; dd[j * R + i] = Math.round(clamp((wy - H(x, z)) / 6, 0, 1) * 255); }
  const dt = new THREE.DataTexture(dd, R, RZ, THREE.RedFormat, THREE.UnsignedByteType); dt.magFilter = dt.minFilter = THREE.LinearFilter; dt.needsUpdate = true;
  const geo = new THREE.PlaneGeometry(WW, WH, LOW ? 40 : 72, LOW ? 88 : 160); geo.rotateX(-Math.PI / 2);
  const mat = new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: .06, metalness: .1, transparent: true, envMapIntensity: 1.1 });
  mat.onBeforeCompile = sh => {
    Object.assign(sh.uniforms, { uWind: W.wind, uDepth: { value: dt }, uBox: { value: new THREE.Vector4(cx - WW / 2, -WH / 2, WW, WH) } });
    const wave = 'float wv(vec2 p){ return 0.11 * sin(p.x * 0.3 + uWind * 1.2) + 0.09 * cos(p.y * 0.4 + uWind * 0.9) + 0.045 * sin((p.x + p.y) * 0.9 + uWind * 2.1) + 0.02 * sin(p.x * 2.1 - p.y * 1.7 + uWind * 3.3); }';
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nuniform float uWind;\nvarying vec2 vWxz;\n' + wave)
      .replace('#include <beginnormal_vertex>', 'vec2 wq = (modelMatrix * vec4(position, 1.0)).xz; float w0 = wv(wq); vec3 objectNormal = normalize(vec3(-(wv(wq + vec2(0.1, 0.0)) - w0) * 10.0, 1.0, -(wv(wq + vec2(0.0, 0.1)) - w0) * 10.0)); vWxz = wq;')
      .replace('#include <begin_vertex>', 'vec3 transformed = position; transformed.y += w0;');
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nuniform float uWind;\nuniform sampler2D uDepth;\nuniform vec4 uBox;\nvarying vec2 vWxz;\n' + GLSL_DETAIL)
      .replace('#include <normal_fragment_maps>', `#include <normal_fragment_maps>
        // 細碎漣漪：兩層反向流動的雜訊做法線擾動，反射的天空與太陽光會碎成粼粼波光
        float wq1 = tN(vWxz * 1.25 + vec2(uWind * 0.45, uWind * 0.3)), wq2 = tN(vWxz * 2.9 - vec2(uWind * 0.38, uWind * 0.52)), wq3 = tN(vWxz * 6.3 + vec2(uWind * 0.9, -uWind * 0.7));
        float wht = (wq1 + wq2 * 0.5 + wq3 * 0.18) * 0.07 * (1.0 - smoothstep(25.0, 110.0, length(vViewPosition)));
        normal = tPerturb(-vViewPosition, normal, vec2(dFdx(wht), dFdy(wht)));`)
      .replace('#include <color_fragment>', `#include <color_fragment>
        float dp = texture2D(uDepth, (vWxz - uBox.xy) / uBox.zw).r * 6.0;
        vec3 wc = mix(vec3(0.36, 0.86, 0.78), vec3(0.03, 0.33, 0.52), smoothstep(0.0, 2.6, dp));
        wc = mix(wc, vec3(0.02, 0.18, 0.36), smoothstep(2.6, 6.0, dp));
        float fo = (1.0 - smoothstep(0.0, 0.3, dp)) + smoothstep(0.82, 1.0, sin(dp * 13.0 - uWind * 2.2) * 0.5 + 0.5) * (1.0 - smoothstep(0.15, 1.1, dp)) * 0.85;
        fo *= 0.65 + 0.5 * tN(vWxz * 1.8 + uWind * 0.4);
        float sp = smoothstep(0.86, 0.95, tN(vWxz * 4.0 + vec2(uWind * 0.7, -uWind * 0.5))) * 0.35;
        diffuseColor.rgb = mix(wc, vec3(0.97, 0.99, 1.0), clamp(fo, 0.0, 1.0)) + sp;
        diffuseColor.a = clamp(mix(0.5, 0.93, smoothstep(0.0, 1.6, dp)) + fo * 0.5, 0.0, 1.0);`);
  };
  mat.customProgramCacheKey = () => 'water3';
  const m = new THREE.Mesh(geo, mat); m.position.set(cx, wy, 0); m.receiveShadow = true; W.scene.add(m);
}
/* 岩石材質：世界座標雜訊讓每塊岩石的明暗不重複；朝上的面依生態區長出苔蘚、積沙、火山灰或積雪 */
function rockMat() {
  const m = new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: .88, metalness: 0 });
  m.onBeforeCompile = sh => {
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vPW;').replace('#include <begin_vertex>', '#include <begin_vertex>\n#ifdef USE_INSTANCING\n  vPW = (modelMatrix * instanceMatrix * vec4(transformed, 1.0)).xyz;\n#else\n  vPW = (modelMatrix * vec4(transformed, 1.0)).xyz;\n#endif');
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nvarying vec3 vPW;\n' + GLSL_DETAIL)
      .replace('#include <normal_fragment_maps>', `#include <normal_fragment_maps>
        { vec3 wn = inverseTransformDirection(normal, viewMatrix); float rn = tN(vPW.xz * 2.3 + vPW.y * 1.9) * 0.6 + tN(vPW.xy * 5.1 + vPW.z * 3.0) * 0.4;
          diffuseColor.rgb *= 0.8 + 0.36 * rn;
          vec4 b = tBiome(vPW.xz); float top = smoothstep(0.42, 0.85, wn.y) * smoothstep(0.38, 0.62, tN(vPW.xz * 1.6 + 4.0) * 0.8 + wn.y * 0.3);
          vec3 cap = b.x * vec3(0.22, 0.4, 0.15) + b.y * vec3(0.76, 0.7, 0.54) + b.z * vec3(0.17, 0.14, 0.13) + b.w * vec3(0.94, 0.96, 1.0);
          diffuseColor.rgb = mix(diffuseColor.rgb, cap * (0.85 + 0.25 * rn), top * (0.6 + 0.35 * b.w)); }`);
  };
  m.customProgramCacheKey = () => 'rock'; return m;
}
/* 植被與岩石：每種道具合併成單一幾何後以 InstancedMesh 分區擺放（含風擺、地面碎石、花草） */
function buildProps() {
  const rd = seeded(77), rc = seeded(991), lists = {}, push = (k, o) => (lists[k] = lists[k] || []).push(o);
  const avoid = (x, z) => {
    if (Math.hypot(x, z) < 26) return true;
    if (Math.abs(z) < 10 * K && Math.abs(Math.abs(x) - 54 * K) < 9 * K) return true;
    if (Math.abs(x) < 10 * K && Math.abs(z + 54 * K) < 9 * K) return true;
    if (onPath(x, z) > .12) return true;
    if (Math.hypot(x - GIANT[0], z - GIANT[1]) < 9 || Math.hypot(x - RUINS[0], z - RUINS[1]) < 9) return true;
    return PUZ_SPOTS.some(([px, pz]) => Math.hypot(x - px, z - pz) < 4.5);
  };
  const tries = LOW ? 11000 : 20000;
  for (let i = 0; i < tries; i++) {
    const x = (rd() - .5) * 350 * K, z = (rd() - .5) * 350 * K, h = H(x, z); if (h < -.3 || h > 26 * K || avoid(x, z)) continue;
    const sl = Math.abs(H(x + 1, z) - H(x - 1, z)) + Math.abs(H(x, z + 1) - H(x, z - 1)); if (sl > 1.5) continue;
    const b = domBiome(x, z), s = .75 + rd() * .8, ry = rd() * 6.28, k = rd(), o = { x, y: h - .12 - sl * .3, z, s, ry };
    { const v = .84 + rc() * .26, w = (rc() - .5) * .1; o.c = new THREE.Color(v * (1 + w), v, v * (1 - w * 1.6)); } // 每株明暗與色相略有不同
    let col = 0;
    if (b === 'forest') { if (k < .34) { push('pine', o); col = .2; } else if (k < .52) { push('broad', o); col = .2; } else if (k < .62) { push('birch', o); col = .15; } else if (k < .72) push('bush', o); else if (k < .78) push('berry', o); else if (k < .84) { push('rockM', o); col = .7; } else if (k < .88) push('shroom', o); else if (k < .91) push('mushC', o); else if (k < .94) { push('log', Object.assign(o, { s: .8 + rd() * .4 })); col = .5; } else if (k < .96) { push('stump', o); col = .45; } else push('fern', o); }
    else if (b === 'coast') { if (k < .4) { push('palm', o); col = .15; } else if (k < .6) { push('rockF', o); col = .7; } else if (k < .78) push('bushC', o); else if (h < 1.6 * K && h > -.1) push('drift', Object.assign(o, { s: .7 + rd() * .5 })); else push('bushC', o); }
    else if (b === 'volcano') { if (k < .34) { push('rockV', o); col = .7; } else if (k < .52) { push('dead', o); col = .15; } else if (k < .72) push('obsid', o); else if (k < .88) { push('basalt', Object.assign(o, { s: .6 + rd() * .6 })); col = .7; } else push('crack', Object.assign(o, { y: h + .03, s: .8 + rd() * 1.2 })); }
    else { if (k < .45) { push('pineS', o); col = .2; } else if (k < .62) { push('rockS', o); col = .7; } else if (k < .78) push('ice', o); else push('snowBush', o); }
    if (col && Math.max(Math.abs(x), Math.abs(z)) < 176 * K) addCol({ x, z, r: col * o.s + .05, k: 'prop' });
  }
  const flatM = new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: .85, metalness: 0 }), stoneM = rockMat();
  const treeM = windMat(new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: .85, metalness: 0 }), .0045);
  const bushM = windMat(new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: .85, metalness: 0 }), .05);
  const fernM = windMat(new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: .8, side: THREE.DoubleSide }), .14);
  // LQ=true 時產生遠景用的低面數版本（同樣的外形、約 1/5～1/10 的三角面）
  let LQ = false; const lod = fn => { LQ = true; try { return fn(); } finally { LQ = false; } };
  const cone = (r, h, y, c, sd) => [LQ ? new THREE.ConeGeometry(r, h, 6, 1) : jit(new THREE.ConeGeometry(r, h, 9, 3), .22, sd), c, M4(0, y, 0)];
  const blob = (x, y, z, s, c, sd, sy = s) => [jit(new THREE.IcosahedronGeometry(.9, LQ ? 0 : 1), LQ ? .18 : .3, sd), c, M4(x, y, z, 0, 0, 0, s, sy, s)];
  const G_ = {
    pine: [() => mergeParts([[new THREE.CylinderGeometry(.12, .2, 1.3, LQ ? 5 : 8), '#5b4030', M4(0, .65, 0)], cone(1.15, 1.7, 1.45, '#2f6b3f', 1), cone(.9, 1.45, 2.25, '#3d8a4f', 2), cone(.62, 1.2, 2.95, '#2f6b3f', 3)]), treeM],
    pineS: [() => mergeParts([[new THREE.CylinderGeometry(.12, .2, 1.3, LQ ? 5 : 8), '#5b4030', M4(0, .65, 0)], cone(1.15, 1.7, 1.45, '#2c5a46', 1), cone(1.0, .7, 1.75, '#f8fafc', 4), cone(.9, 1.45, 2.25, '#356a52', 2), cone(.78, .6, 2.55, '#f8fafc', 5), cone(.62, 1.2, 2.95, '#2c5a46', 3), cone(.5, .55, 3.25, '#f8fafc', 6)]), treeM],
    broad: [() => mergeParts([[new THREE.CylinderGeometry(.13, .22, 1.8, LQ ? 5 : 8), '#5b4030', M4(0, .9, 0)], [new THREE.CylinderGeometry(.05, .08, .9, LQ ? 5 : 6), '#5b4030', M4(.35, 1.75, .1, 0, 0, -.7)], ...[[0, 2.4, 0, 1.1], [.6, 2.1, .2, .8], [-.55, 2.15, -.1, .85], [.1, 2.9, -.3, .75], [-.2, 2.6, .5, .6]].map(([x, y, z, s], i) => blob(x, y, z, s, i % 2 ? '#4c9440' : '#62a84b', i + 80))]), treeM],
    birch: [() => mergeParts([[new THREE.CylinderGeometry(.09, .14, 3.3, LQ ? 5 : 8), '#ece8e1', M4(0, 1.65, 0)], ...[.45, .95, 1.5, 2.05, 2.6].map((y, i) => [new THREE.CylinderGeometry(.143 - y * .016, .146 - y * .016, .06 + (i % 2) * .04, 8), '#3f3a36', M4(0, y, 0, 0, i, 0)]), ...[[0, 3.5, 0, 1], [.5, 3.0, .3, .72], [-.5, 3.1, -.2, .8], [.1, 4.0, -.2, .6]].map(([x, y, z, s], i) => blob(x, y, z, s, i % 2 ? '#a3d977' : '#86c45a', i + 120, s * .9))]), treeM],
    bush: [() => mergeParts([[0, .35, 0, .6], [.4, .3, .1, .45], [-.35, .28, -.1, .5]].map(([x, y, z, s], i) => blob(x, y, z, s, i ? '#4f9a45' : '#3f8a3d', i + 90))), bushM],
    berry: [() => mergeParts([...[[0, .4, 0, .62], [.38, .32, .12, .45], [-.32, .3, -.1, .5]].map(([x, y, z, s], i) => blob(x, y, z, s, i ? '#3f8a3d' : '#357a35', i + 150)), ...[...Array(10)].map((_, i) => { const a = i * 2.4, r = .42 + (i % 3) * .1; return [new THREE.IcosahedronGeometry(.055, 0), i % 3 ? '#dc2626' : '#7c3aed', M4(Math.cos(a) * r, .3 + (i % 4) * .12, Math.sin(a) * r)]; })]), bushM],
    bushC: [() => mergeParts([0, 1, 2, 3, 4, 5, 6].map(i => [new THREE.ConeGeometry(.05, .8 + (i % 3) * .2, 3), i % 2 ? '#a3a35a' : '#b5b06a', M4(Math.cos(i * 1.3) * .15, .4, Math.sin(i * 1.3) * .15, Math.cos(i) * .35, 0, Math.sin(i) * .35)])), fernM],
    fern: [() => mergeParts([...Array(8)].map((_, i) => { const l = new THREE.ConeGeometry(.1, 1, 4, 1); l.scale(1, 1, .22); l.translate(0, .5, 0); return [l, i % 2 ? '#3f8f4a' : '#4ea65a', M4(0, 0, 0, 0, i / 8 * PI2 + .2, .95 + (i % 3) * .12)]; })), fernM],
    rockF: [() => mergeParts([[jit(new THREE.DodecahedronGeometry(1, LQ ? 0 : 1), .45, 5), '#7a7f78', M4(0, .3, 0, 0, 0, 0, 1, .65, 1)], [jit(new THREE.DodecahedronGeometry(.5, 0), .4, 6), '#8b9089', M4(.8, .1, .3)]]), stoneM],
    rockM: [() => mergeParts([[jit(new THREE.DodecahedronGeometry(1, LQ ? 0 : 1), .45, 5), '#7a7f78', M4(0, .3, 0, 0, 0, 0, 1, .65, 1)], [jit(new THREE.SphereGeometry(.85, LQ ? 6 : 9, LQ ? 3 : 5, 0, PI2, 0, Math.PI / 2), .3, 9), '#5b8f3e', M4(-.05, .55, 0, 0, 0, 0, 1, .32, 1)], [jit(new THREE.DodecahedronGeometry(.5, 0), .4, 6), '#8b9089', M4(.8, .1, .3)]]), stoneM],
    rockV: [() => mergeParts([[jit(new THREE.DodecahedronGeometry(1, LQ ? 0 : 1), .55, 7), '#2a2220', M4(0, .4, 0, 0, 0, 0, 1, .85, 1)], [new THREE.TetrahedronGeometry(.6), '#3a2c28', M4(.9, .2, 0, .4, .2, 0)]]), stoneM],
    rockS: [() => mergeParts([[jit(new THREE.DodecahedronGeometry(1, LQ ? 0 : 1), .45, 8), '#7f8c9e', M4(0, .3, 0, 0, 0, 0, 1, .65, 1)], [new THREE.SphereGeometry(.85, LQ ? 7 : 12, LQ ? 3 : 6, 0, PI2, 0, Math.PI / 2), '#f8fafc', M4(0, .55, 0, 0, 0, 0, 1.05, .4, 1.05)]]), stoneM],
    shroom: [() => mergeParts([[new THREE.CylinderGeometry(.07, .09, .4, LQ ? 5 : 8), '#f5efe6', M4(0, .2, 0)], [new THREE.SphereGeometry(.28, 14, 7, 0, PI2, 0, Math.PI / 2), '#e5484d', M4(0, .38, 0)], [new THREE.CylinderGeometry(.05, .07, .28, LQ ? 5 : 8), '#f5efe6', M4(.35, .14, .1)], [new THREE.SphereGeometry(.18, 12, 6, 0, PI2, 0, Math.PI / 2), '#e5484d', M4(.35, .27, .1)], ...[0, 1, 2, 3, 4].map(k => [new THREE.SphereGeometry(.04, 6, 4), '#ffffff', M4(Math.cos(k * 1.3) * .16, .5, Math.sin(k * 1.3) * .16)])]), flatM],
    mushC: [() => mergeParts([[0, 0, .3], [.18, .08, .22], [-.12, .15, .18], [.05, -.17, .15]].flatMap(([x, z, s], i) => [[new THREE.CylinderGeometry(s * .18, s * .24, s * .9, 7), '#f1e7d6', M4(x, s * .45, z)], [new THREE.SphereGeometry(s * .6, 10, 6, 0, PI2, 0, Math.PI / 2), i % 2 ? '#b7794a' : '#c98f5a', M4(x, s * .85, z, 0, 0, 0, 1, .7, 1)]])), flatM],
    log: [() => mergeParts([[new THREE.CylinderGeometry(.28, .32, 3, LQ ? 5 : 9), '#6b4d33', M4(0, .26, 0, 0, 0, Math.PI / 2)], [new THREE.CylinderGeometry(.25, .25, .02, LQ ? 5 : 9), '#c8a27a', M4(1.51, .26, 0, 0, 0, Math.PI / 2)], [new THREE.CylinderGeometry(.29, .29, .02, LQ ? 5 : 9), '#c8a27a', M4(-1.51, .26, 0, 0, 0, Math.PI / 2)], [jit(new THREE.SphereGeometry(.3, 8, 5, 0, PI2, 0, Math.PI / 2), .2, 140), '#5b8f3e', M4(.3, .46, 0, 0, 0, 0, 1.7, .35, .9)], [new THREE.CylinderGeometry(.05, .08, .6, LQ ? 5 : 6), '#5b4030', M4(-.6, .58, .12, .5, 0, .3)], [new THREE.SphereGeometry(.07, 8, 6, 0, PI2, 0, Math.PI / 2), '#e5484d', M4(-1.1, .5, .15)]]), flatM],
    stump: [() => mergeParts([[new THREE.CylinderGeometry(.42, .5, .55, LQ ? 5 : 10), '#6b4d33', M4(0, .27, 0)], [new THREE.CylinderGeometry(.4, .4, .02, LQ ? 5 : 10), '#c8a27a', M4(0, .56, 0)], [new THREE.CylinderGeometry(.22, .22, .025, LQ ? 5 : 10), '#a07850', M4(0, .565, 0)], ...[0, 1, 2, 3].map(i => [new THREE.ConeGeometry(.12, .5, 5), '#5b4030', M4(Math.cos(i * 1.6) * .45, .08, Math.sin(i * 1.6) * .45, Math.sin(i * 1.6) * 1.2, 0, -Math.cos(i * 1.6) * 1.2)])]), flatM],
    palm: [() => { const parts = []; let x = 0, y = 0; for (let i = 0; i < 8; i++) { const a = -.6 * i / 8 * .35; if (!LQ || i % 2 === 0) parts.push([new THREE.CylinderGeometry(.11, .14, LQ ? 1.07 : .55, LQ ? 5 : 8), i % 2 ? '#8b6b4a' : '#7a5c3e', M4(x + (LQ ? Math.sin(-a) * .25 : 0), y + (LQ ? .53 : .27), 0, 0, 0, a)]); x += Math.sin(-a) * .5; y += .52; }
      for (let k = 0; k < 9; k++) { const l = new THREE.SphereGeometry(1, LQ ? 4 : 8, LQ ? 2 : 4); l.scale(.24, .035, 1.25); l.translate(0, 0, 1.1); parts.push([l, k % 2 ? '#2f9e57' : '#3fb76a', M4(x, y + .1, 0, .5 + (k % 3) * .1, k / 9 * PI2, 0)]); }
      for (let k = 0; k < 3; k++) parts.push([new THREE.SphereGeometry(.11, LQ ? 4 : 8, LQ ? 3 : 6), '#5b3a1f', M4(x + Math.cos(k * 2) * .15, y - .05, Math.sin(k * 2) * .15)]); return mergeParts(parts); }, treeM],
    dead: [() => mergeParts([[new THREE.CylinderGeometry(.08, .16, 2, LQ ? 5 : 6), '#2b211d', M4(0, 1, 0)], ...[0, 1, 2].map(k => [new THREE.CylinderGeometry(.03, .06, .9, 5), '#2b211d', M4(Math.cos(k * 2.1) * .35, 1.5 + k * .25, Math.sin(k * 2.1) * .35, Math.sin(k * 2.1) * .9, 0, -Math.cos(k * 2.1) * .9)])]), flatM],
    drift: [() => mergeParts([[new THREE.CylinderGeometry(.09, .13, 2.2, LQ ? 5 : 6), '#a8a29e', M4(0, .1, 0, 0, .3, Math.PI / 2 - .05)], [new THREE.CylinderGeometry(.05, .07, .8, 5), '#b8b2ac', M4(.5, .2, .25, .5, 0, Math.PI / 2 - .7)]]), flatM],
    basalt: [() => mergeParts([...Array(7)].flatMap((_, i) => { const h = .8 + ((i * 37) % 10) / 10 * 1.8, a = i / 7 * PI2, r = i ? .58 : 0; return [[new THREE.CylinderGeometry(.3, .32, h, LQ ? 4 : 6, 1, LQ), i % 2 ? '#27272a' : '#3f3f46', M4(Math.cos(a) * r, h / 2, Math.sin(a) * r)], [new THREE.CylinderGeometry(.29, .29, .03, LQ ? 3 : 6), '#57534e', M4(Math.cos(a) * r, h + .01, Math.sin(a) * r)]]; })), stoneM],
    snowBush: [() => mergeParts([...[[0, .35, 0, .6], [.4, .3, .1, .45], [-.35, .28, -.1, .5]].map(([x, y, z, s], i) => blob(x, y, z, s, '#2c5a46', i + 160)), ...[[0, .62, 0, .52], [.4, .5, .1, .38], [-.35, .48, -.1, .42]].map(([x, y, z, s], i) => blob(x, y, z, s, '#f8fafc', i + 170, s * .45))]), flatM],
  };
  // 樹木與岩石：近處完整模型、遠處低面數模型（cullChunks 依距離切換）
  Object.keys(G_).forEach(k => { if (lists[k]) scatter(G_[k][0](), G_[k][1], lists[k], true, { lo: lod(G_[k][0]) }); });
  if (lists.obsid) { const g = mergeParts([0, 1, 2].map(i => [new THREE.OctahedronGeometry(.45), '#3b1d5e', M4(Math.cos(i * 2) * .3, .6, Math.sin(i * 2) * .3, rnd(-.4, .4), i, rnd(-.4, .4), .6, 1.7 + i * .3, .6)])); scatter(g, new THREE.MeshPhysicalMaterial({ vertexColors: true, roughness: .06, metalness: .3, clearcoat: 1, flatShading: true }), lists.obsid); }
  if (lists.ice) { const g = mergeParts([0, 1, 2, 3].map(i => [new THREE.OctahedronGeometry(.4), '#bae6fd', M4(Math.cos(i * 1.6) * .3, .5, Math.sin(i * 1.6) * .3, rnd(-.4, .4), i, rnd(-.4, .4), .5, 1.5 + i * .25, .5)])); scatter(g, new THREE.MeshPhysicalMaterial({ vertexColors: true, roughness: .05, clearcoat: 1, transparent: true, opacity: .85, emissive: '#7dd3fc', emissiveIntensity: .2, flatShading: true }), lists.ice); }
  if (lists.crack) { const g = new THREE.CircleGeometry(1, 7); g.rotateX(-Math.PI / 2); g.scale(1.6, 1, .22); scatter(g, new THREE.MeshBasicMaterial({ color: '#fb923c', toneMapped: false }), lists.crack, false); }
  // 草叢與花（成片分布）、沙灘草、地面碎石、貝殼與海星
  const grass = [], flowers = { daisyW: [], daisyP: [], tulipR: [], tulipY: [], bell: [] }, fkeys = Object.keys(flowers), dune = [], pebbles = [], shells = [], stars = [], reeds = [];
  const gTint = [new THREE.Color(1, 1, 1), new THREE.Color(.82, 1.02, .78), new THREE.Color(1.12, 1.06, .72), new THREE.Color(1.25, 1.12, .6)];
  for (let i = 0; i < (LOW ? 1100 : 2600); i++) {
    const cx = (rd() - .5) * 300 * K, cz = (rd() - .5) * 300 * K, b = domBiome(cx, cz); if (b === 'volcano' || b === 'snow') continue;
    const patchF = rd() < .25 ? pick(fkeys) : null;
    for (let j = 0; j < (LOW ? 16 : 28); j++) {
      const x = cx + (rd() - .5) * 7, z = cz + (rd() - .5) * 7, h = H(x, z); if (h < .05 || h > 6 * K || Math.hypot(x, z) < 17 || onPath(x, z) > .35) continue; if (Math.abs(H(x + .8, z) - H(x - .8, z)) + Math.abs(H(x, z + .8) - H(x, z - .8)) > .5) continue;
      const c = b === 'coast' ? gTint[2].clone().lerp(gTint[3], rd()) : gTint[0].clone().lerp(gTint[1], rd());
      grass.push({ x, y: h - .02, z, s: .8 + rd() * .7, ry: rd() * 6.28, rx: (rd() - .5) * .3, c });
      if (b === 'forest' && rd() < (patchF ? .2 : .05)) flowers[patchF || pick(fkeys)].push({ x: x + .2, y: h, z, s: .8 + rd() * .6, ry: rd() * 6 });
    }
  }
  // 中央平地周圍也長一點草與花，讓基地不再光禿
  for (let i = 0; i < (LOW ? 500 : 1100); i++) {
    const a = rd() * PI2, r = 20 + rd() * 9, x = Math.cos(a) * r, z = Math.sin(a) * r; if (onPath(x, z) > .3) continue; const h = H(x, z);
    grass.push({ x, y: h - .02, z, s: .7 + rd() * .6, ry: rd() * 6.28, c: gTint[0].clone().lerp(gTint[1], rd()) });
    if (rd() < .07) flowers[pick(fkeys)].push({ x, y: h, z, s: .8 + rd() * .5, ry: rd() * 6 });
  }
  const pcol = { forest: ['#8b8f88', '#6b6f68'], coast: ['#d6c7a5', '#a8a29e'], volcano: ['#2b2522', '#4a3a33'], snow: ['#94a3b8', '#cbd5e1'] };
  for (let i = 0; i < (LOW ? 1200 : 3000); i++) {
    const x = (rd() - .5) * 340 * K, z = (rd() - .5) * 340 * K, h = H(x, z); if (h < -.4 || h > 24 * K) continue; const b = domBiome(x, z);
    pebbles.push({ x, y: h - .02, z, s: .5 + rd() * 1.1, ry: rd() * 6, rx: rd(), c: new THREE.Color(pick(pcol[b])) });
    if (b === 'coast' && h < 1.4 * K && h > -.5) { if (rd() < .3) (rd() < .6 ? shells : stars).push({ x: x + 1, y: H(x + 1, z) + .01, z, s: .8 + rd() * .6, ry: rd() * 6, c: new THREE.Color(pick(['#fde7d6', '#fbcfe8', '#fed7aa', '#fb923c', '#f9a8d4'])) }); if (rd() < .35) dune.push({ x: x - 1, y: H(x - 1, z), z, s: 1.1 + rd() * .8, ry: rd() * 6, c: gTint[3].clone() }); }
    if (b === 'coast' && h > -1.3 && h < .2 && rd() < .5) reeds.push({ x, y: h - .05, z, s: .8 + rd() * .5, ry: rd() * 6 });
  }
  const fG = LOW ? [32, 50] : [52, 78], fS = LOW ? [22, 34] : [34, 52], small = r => ({ cell: LOW ? 64 : 44, far: r[1] + 2 });
  const grassM = windMat(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: .85, side: THREE.DoubleSide }), .42, true, fG);
  scatter(tuftGeo(5, .5, 3), grassM, grass, false, small(fG)); scatter(tuftGeo(7, .9, 5), grassM, dune, false, small(fG));
  const flowerM = windMat(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: .6, flatShading: true, side: THREE.DoubleSide }), .3, false, fG);
  const FG = { daisyW: ['#f8fafc', '#facc15', 'daisy'], daisyP: ['#f9a8d4', '#fde68a', 'daisy'], tulipR: ['#ef4444', '', 'tulip'], tulipY: ['#facc15', '', 'tulip'], bell: ['#a78bfa', '', 'bell'] };
  fkeys.forEach(k => scatter(flowerGeo(...FG[k]), flowerM, flowers[k], false, small(fG)));
  scatter(jit(new THREE.DodecahedronGeometry(.12, 0), .5, 31), fadeMat(new THREE.MeshStandardMaterial({ roughness: .9, flatShading: true }), fG), pebbles, false, small(fG));
  scatter(mergeParts([[new THREE.ConeGeometry(.09, .17, 8), '#ffffff', M4(0, .05, 0, Math.PI / 2, 0, 0)], [new THREE.TorusGeometry(.055, .024, 6, 10), '#f1f1f1', M4(0, .05, .07)]]), fadeMat(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: .5 }), fS), shells, false, small(fS));
  { const sh = new THREE.Shape(); for (let i = 0; i < 10; i++) { const r = i % 2 ? .05 : .16, a = i / 10 * PI2; i ? sh.lineTo(Math.cos(a) * r, Math.sin(a) * r) : sh.moveTo(Math.cos(a) * r, Math.sin(a) * r); } const g = new THREE.ExtrudeGeometry(sh, { depth: .025, bevelEnabled: true, bevelThickness: .012, bevelSize: .012, bevelSegments: 1 }); g.rotateX(-Math.PI / 2); g.deleteAttribute('uv'); scatter(g, fadeMat(new THREE.MeshStandardMaterial({ roughness: .7 }), fS), stars, false, small(fS)); }
  const reedM = windMat(new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: .8, side: THREE.DoubleSide }), .14, false, fG);
  scatter(mergeParts([...Array(7)].map((_, i) => { const h = 1.2 + (i % 3) * .25; return [new THREE.CylinderGeometry(.012, .02, h, 4), '#7c8c3a', M4(Math.cos(i * 1.7) * .14, h / 2, Math.sin(i * 1.7) * .14, Math.cos(i) * .08, 0, Math.sin(i) * .08)]; }).concat([0, 2, 4].map(i => [new THREE.CylinderGeometry(.035, .035, .22, 6), '#6b4423', M4(Math.cos(i * 1.7) * .14 + Math.sin(i) * .1, 1.15 + (i % 3) * .25, Math.sin(i * 1.7) * .14)]))), reedM, reeds, false, small(fG));
}
/* 雲：所有雲團合併成一個 InstancedMesh（原本約 150 個獨立網格＝150 次繪製呼叫） */
function buildClouds() {
  const cg = new THREE.IcosahedronGeometry(1, 2), cm = new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 1, emissive: '#dbeafe', emissiveIntensity: .25, transparent: true, opacity: .94, fog: false }), clouds = [], rd = seeded(9);
  let total = 0;
  for (let i = 0; i < (LOW ? 12 : 24); i++) {
    const n = 5 + Math.floor(rd() * 4), p = [];
    for (let k = 0; k < n; k++) { const px = (k - n / 2) * 1.3 + rd() - .5, py = rd() * .7, pz = rd() * 1.8 - .9, s = 1.1 + rd() * 1.1 - Math.abs(k - n / 2) * .12; p.push([px, py, pz, s * 1.4, s * (.8 + rd() * .35), s * 1.15]); }
    clouds.push({ x: (rd() - .5) * 560, y: 42 + rd() * 26, z: (rd() - .5) * 560, s: 2.2 + rd() * 2.6, v: .8 + rd() * .9, p, o: total }); total += n;
  }
  const im = new THREE.InstancedMesh(cg, cm, total); im.frustumCulled = false; im.instanceMatrix.setUsage(THREE.DynamicDrawUsage); W.scene.add(im);
  const a = im.instanceMatrix.array;
  const put = c => c.p.forEach(([px, py, pz, sx, sy, sz], k) => { const j = (c.o + k) * 16; a.fill(0, j, j + 16); a[j] = sx * c.s; a[j + 5] = sy * c.s; a[j + 10] = sz * c.s; a[j + 12] = c.x + px * c.s; a[j + 13] = c.y + py * c.s; a[j + 14] = c.z + pz * c.s; a[j + 15] = 1; });
  clouds.forEach(put); im.instanceMatrix.needsUpdate = true;
  W.anim.push(dt => { clouds.forEach(c => { c.x += dt * 1.2 * c.v; if (c.x > 280) c.x = -280; put(c); }); im.instanceMatrix.needsUpdate = true; });
}
/* ============================================================
   地標：中央廣場（石板環道、路燈、長椅、路標）、巨木、古代遺跡、雪人、蒸氣噴口
   ============================================================ */
function buildLandmarks() {
  const sc = W.scene, flatM = new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: .85 }), smoothM = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: .75 });
  const glowM = new THREE.MeshBasicMaterial({ color: '#fde68a', toneMapped: false });
  // 路燈：廣場一圈＋沿著森林小徑
  const lamps = [], benches = [];
  [28, 62, 152, 208, 242, 298, 332].forEach(d => { const a = d * Math.PI / 180, x = Math.cos(a) * 20.6, z = Math.sin(a) * 20.6; if (Math.hypot(x + 9, z - 15) < 3.5) return; lamps.push({ x, y: H(x, z), z, s: 1, ry: Math.atan2(-Math.cos(a), -Math.sin(a)) }); });
  [[12, 21.8], [168, 21.8], [192, 21.8], [348, 21.8]].forEach(([d, r]) => { const a = d * Math.PI / 180, x = Math.cos(a) * r, z = Math.sin(a) * r; benches.push({ x, y: H(x, z), z, s: 1, ry: Math.atan2(-Math.cos(a), -Math.sin(a)) }); addCol({ x, z, r: .7 }); });
  PATH_LINES.forEach(l => { const pts = crPts(l, 10); let acc = 0, side = 1; for (let i = 1; i < pts.length; i++) { const [ax, az] = pts[i - 1], [bx, bz] = pts[i], d = Math.hypot(bx - ax, bz - az); acc += d; if (acc < 15) continue; acc = 0; if (Math.max(Math.abs(bx), Math.abs(bz)) > 50 * K) continue; const nx = -(bz - az) / d, nz = (bx - ax) / d, x = bx + nx * 2 * side, z = bz + nz * 2 * side; lamps.push({ x, y: H(x, z), z, s: 1, ry: Math.atan2(-nx * side, -nz * side) }); side = -side; } });
  lamps.forEach(o => addCol({ x: o.x, z: o.z, r: .2 }));
  const lampG = mergeParts([[new THREE.CylinderGeometry(.07, .1, 2.6, 8), '#334155', M4(0, 1.3, 0)], [new THREE.CylinderGeometry(.2, .24, .1, 8), '#1e293b', M4(0, .05, 0)], [new THREE.BoxGeometry(.06, .06, .5), '#334155', M4(0, 2.5, .2)], [new THREE.ConeGeometry(.22, .16, 8), '#1e293b', M4(0, 2.62, .45)], [new THREE.CylinderGeometry(.02, .02, .14, 6), '#334155', M4(0, 2.48, .45)]]);
  scatter(lampG, flatM, lamps); scatter(new THREE.SphereGeometry(.12, 12, 8).translate(0, 2.38, .45), glowM, lamps, false);
  scatter(mergeParts([[new THREE.BoxGeometry(1.6, .08, .45), '#a07850', M4(0, .48, 0)], [new THREE.BoxGeometry(1.6, .4, .06), '#8b6544', M4(0, .78, -.22, -.15, 0, 0)], ...[-.65, .65].flatMap(x => [[new THREE.BoxGeometry(.08, .48, .4), '#334155', M4(x, .24, 0)], [new THREE.BoxGeometry(.08, .5, .06), '#334155', M4(x, .7, -.22, -.15, 0, 0)]])]), flatM, benches);
  // 廣場路標：指向三個隘口
  const signTex = (txt, sub, c) => { const cv = document.createElement('canvas'); cv.width = 256; cv.height = 96; const g = cv.getContext('2d'); g.fillStyle = '#8b6544'; g.fillRect(0, 0, 256, 96); g.fillStyle = '#7a5838'; for (let i = 0; i < 6; i++) g.fillRect(0, i * 16 + 6, 256, 2); g.fillStyle = c; g.font = 'bold 40px "Noto Sans TC","Microsoft JhengHei",sans-serif'; g.textAlign = 'center'; g.fillText(txt, 128, 48); g.fillStyle = '#fef3c7'; g.font = '24px "Noto Sans TC",sans-serif'; g.fillText(sub, 128, 82); const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; return t; };
  [[21.5, 2.5, '東 · 海岸', '沿小徑直走到能量門', '#7dd3fc', 0], [2.5, -21.5, '北 · 火山', '沿小徑直走到能量門', '#fdba74', -Math.PI / 2], [-21.5, -2.5, '西 · 雪原', '沿小徑直走到能量門', '#e0f2fe', Math.PI]].forEach(([x, z, t, s, c, a]) => {
    const g = new THREE.Group(); g.position.set(x, H(x, z), z); g.rotation.y = -a; sc.add(g); addCol({ x, z, r: .25 });
    cyl(.07, .09, 2.2, 8, std('#6b4d33', { roughness: .9 }), 0, 1.1, 0, g);
    const sm = new THREE.MeshStandardMaterial({ map: signTex(t, s, c), roughness: .8 }), wd = std('#8b6544', { roughness: .85 });
    const b = box(.06, .5, 1.3, [sm, sm, wd, wd, wd, wd], 0, 1.75, .45, g); b.castShadow = !LOW;
  });
  // 巨木（月光谷的守護樹）：粗壯樹幹、板根、枝幹與會發光的月光果實
  {
    const [x, z] = GIANT, y = H(x, z) - .2, parts = [[new THREE.CylinderGeometry(.8, 1.35, 8, 12, 4), '#5b4030', M4(0, 4, 0)]];
    for (let i = 0; i < 7; i++) { const a = i / 7 * PI2; parts.push([new THREE.ConeGeometry(.45, 2.4, 5), '#4a3424', M4(Math.cos(a) * 1.1, .5, Math.sin(a) * 1.1, Math.sin(a) * 1.15, 0, -Math.cos(a) * 1.15)]); }
    [[1.6, 6.6, .4, -.9], [-1.5, 7, -.3, .85], [.2, 7.4, 1.5, .1]].forEach(([bx, by, bz, r]) => parts.push([new THREE.CylinderGeometry(.22, .4, 3.4, 8), '#5b4030', M4(bx * .55, by - .8, bz * .55, bz * .5, 0, r)]));
    const tree = mesh(jit(mergeParts(parts), .06, 77), flatM, x, y, z, sc); tree.castShadow = tree.receiveShadow = !LOW;
    const can = []; [[0, 10.2, 0, 3.4], [2.6, 9, .6, 2.6], [-2.5, 9.3, -.5, 2.7], [.4, 9.4, 2.6, 2.5], [-.6, 9.1, -2.6, 2.4], [1.4, 11.5, -1.2, 2.2], [-1.3, 11.3, 1.4, 2.1]].forEach(([cx, cy, cz, s], i) => can.push([jit(new THREE.IcosahedronGeometry(1, 1), .3, 200 + i), ['#3f8a3d', '#4c9a45', '#2f7a3a'][i % 3], M4(cx, cy, cz, 0, i, 0, s, s * .8, s)]));
    const cm = mesh(mergeParts(can), windMat(new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: .85 }), .0007), x, y, z, sc); cm.castShadow = !LOW;
    const fruits = mesh(mergeParts([...Array(14)].map((_, i) => { const a = i * 2.39, r = 2.3 + (i % 4) * .55; return [new THREE.SphereGeometry(.17, 10, 8), i % 2 ? '#a5f3fc' : '#e0f2fe', M4(Math.cos(a) * r, 7.1 + (i % 3) * .4, Math.sin(a) * r)]; }), true), new THREE.MeshBasicMaterial({ vertexColors: true, toneMapped: false }), x, y, z, sc);
    W.anim.push((dt, t) => { fruits.position.y = y + Math.sin(t * 1.2) * .06; });
    addCol({ x, z, r: 1.6 }); const lb = textSprite('月光巨木', '#a5f3fc', '傳說月光從這裡灑落'); lb.position.set(x, y + 13.6, z); sc.add(lb);
  }
  // 古代遺跡：石柱、斷裂的拱門、散落石塊與苔蘚
  {
    const [x, z] = RUINS, y = H(x, z) - .1, parts = [], stone = ['#9ca3af', '#8b9096', '#a8a29e'];
    [[-2.4, -1.6, 4], [2.4, -1.6, 4], [-2.4, 1.8, 2.1], [2.2, 2, 3.2]].forEach(([px, pz, h], i) => { parts.push([new THREE.CylinderGeometry(.42, .5, h, 8), stone[i % 3], M4(px, h / 2, pz)], [new THREE.BoxGeometry(1.2, .3, 1.2), '#78716c', M4(px, .15, pz)], [new THREE.SphereGeometry(.45, 8, 4, 0, PI2, 0, Math.PI / 2), '#5b8f3e', M4(px, h, pz, 0, 0, 0, 1.05, .4, 1.05)]); addCol({ x: x + px, z: z + pz, r: .6 }); });
    parts.push([new THREE.BoxGeometry(6, .55, .9), '#a8a29e', M4(0, 4.25, -1.6)], [new THREE.BoxGeometry(2.4, .5, .85), '#9ca3af', M4(1.2, .3, 3.4, .1, .5, .25)], [new THREE.BoxGeometry(.9, .7, .8), '#8b9096', M4(-1, .35, .4, 0, .7, 0)], [new THREE.BoxGeometry(.6, .5, .6), '#a8a29e', M4(3.6, .25, -.2, .3, .2, .2)]);
    const rm = mesh(jit(mergeParts(parts), .03, 55), flatM, x, y, z, sc); rm.castShadow = rm.receiveShadow = !LOW;
    const rune = mesh(new THREE.PlaneGeometry(4.6, .22), new THREE.MeshBasicMaterial({ color: '#67e8f9', transparent: true, opacity: .7, toneMapped: false }), x, y + 4.25, z - 1.14, sc);
    W.anim.push((dt, t) => { rune.material.opacity = .45 + Math.sin(t * 1.5) * .25; });
    const lb = textSprite('古代遺跡', '#cbd5e1', '刻著看不懂的月光文字'); lb.position.set(x, y + 5.6, z); sc.add(lb);
  }
  // 雪原的雪人
  { const g = mergeParts([[new THREE.SphereGeometry(.55, 14, 10), '#f8fafc', M4(0, .5, 0)], [new THREE.SphereGeometry(.4, 14, 10), '#f1f5f9', M4(0, 1.2, 0)], [new THREE.SphereGeometry(.28, 12, 9), '#f8fafc', M4(0, 1.75, 0)], [new THREE.ConeGeometry(.05, .25, 8), '#f97316', M4(0, 1.75, .35, Math.PI / 2, 0, 0)], ...[-1, 1].map(s => [new THREE.SphereGeometry(.035, 6, 5), '#111827', M4(s * .1, 1.84, .24)]), ...[0, 1, 2].map(i => [new THREE.SphereGeometry(.035, 6, 5), '#111827', M4(0, 1.05 + i * .14, .385 - i * .02)]), [new THREE.TorusGeometry(.28, .07, 8, 18), '#ef4444', M4(0, 1.5, 0, Math.PI / 2, 0, 0)], [new THREE.BoxGeometry(.12, .4, .06), '#ef4444', M4(.15, 1.35, .26, 0, 0, .2)], ...[-1, 1].map(s => [new THREE.CylinderGeometry(.025, .03, .9, 5), '#5b4030', M4(s * .62, 1.38, 0, 0, 0, s * 1.1)]), [new THREE.CylinderGeometry(.2, .22, .3, 12), '#1f2937', M4(0, 2.05, 0)], [new THREE.CylinderGeometry(.3, .3, .03, 14), '#1f2937', M4(0, 1.91, 0)]], true);
    const list = [[-78, 10], [-96, -18], [-118, 24], [-136, -6], [-70, -26]].map(kk).map(([x, z]) => ({ x, y: H(x, z) - .05, z, s: 1, ry: Math.atan2(-x, -z) + rnd(-.4, .4) })); list.forEach(o => addCol({ x: o.x, z: o.z, r: .55 })); scatter(g, smoothM, list); }
  buildSteam();
}
/* 火山的蒸氣噴口：每個噴口一團緩緩上升、膨脹、淡出的蒸氣 */
function buildSteam() {
  const rd = seeded(13), vents = [];
  for (let i = 0; i < 40 && vents.length < 9; i++) { const x = (rd() - .5) * 80 * K, z = (-66 - rd() * 70) * K; if (Math.hypot(x, z + 130 * K) < 42 * K || Math.abs(x) > -z - 14 * K) continue; vents.push([x, H(x, z), z]); }
  if (!vents.length) return; const per = LOW ? 6 : 10, n = vents.length * per, geo = new THREE.BufferGeometry(), pos = new Float32Array(n * 3), col = new Float32Array(n * 4), life = new Float32Array(n);
  for (let i = 0; i < n; i++) life[i] = (i % per) / per;
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3)); geo.setAttribute('color', new THREE.BufferAttribute(col, 4));
  const pts = new THREE.Points(geo, new THREE.PointsMaterial({ size: 3.2, map: dotTex(), vertexColors: true, transparent: true, depthWrite: false })); pts.frustumCulled = false; W.scene.add(pts);
  scatter(mergeParts([...Array(6)].map((_, i) => [jit(new THREE.DodecahedronGeometry(.4, 0), .4, 60 + i), i % 2 ? '#1c1917' : '#292524', M4(Math.cos(i) * .7, .1, Math.sin(i) * .7)]).concat([[new THREE.CircleGeometry(.45, 10).rotateX(-Math.PI / 2), '#f97316', M4(0, .06, 0)]])), new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: .9, emissive: '#7c2d12', emissiveIntensity: .25 }), vents.map(([x, y, z]) => ({ x, y, z, s: 1, ry: rd() * 6 })));
  W.anim.push(dt => {
    if (P.z > -40 * K || inCity()) { pts.visible = false; return; } pts.visible = true;
    for (let i = 0; i < n; i++) {
      life[i] += dt * .22; if (life[i] > 1) life[i] -= 1; const v = vents[(i / per) | 0], l = life[i], k = i * 3;
      pos[k] = v[0] + Math.sin(l * 6 + i) * l * 1.2; pos[k + 1] = v[1] + .3 + l * 7; pos[k + 2] = v[2] + Math.cos(l * 5 + i) * l * 1.2;
      const a = Math.sin(l * Math.PI) * .38; col[i * 4] = col[i * 4 + 1] = col[i * 4 + 2] = .92; col[i * 4 + 3] = a;
    }
    geo.attributes.position.needsUpdate = true; geo.attributes.color.needsUpdate = true;
  });
}
/* ============================================================
   小動物：森林與海岸的蝴蝶、海岸上空盤旋的海鷗（翅膀拍動在著色器中計算）
   ============================================================ */
function flapMat(speed, amp) {
  const m = new THREE.MeshStandardMaterial({ vertexColors: true, side: THREE.DoubleSide, roughness: .7 });
  m.onBeforeCompile = sh => {
    sh.uniforms.uWind = W.wind; sh.uniforms.uFlap = { value: new THREE.Vector2(speed, amp) };
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nuniform float uWind;\nuniform vec2 uFlap;').replace('#include <begin_vertex>', `#include <begin_vertex>
      float fPh = instanceMatrix[3][0] * 1.7 + instanceMatrix[3][2] * 2.3;
      float fA = (sin(uWind * uFlap.x + fPh) * 0.5 + 0.35) * uFlap.y;
      transformed = vec3(position.x * cos(fA), abs(position.x) * sin(fA) + position.y, position.z);`);
  };
  m.customProgramCacheKey = () => 'flap'; return m;
}
function wingGeo(span, len, cIn, cOut) {
  const pos = [], col = [], a = new THREE.Color(cIn), b = new THREE.Color(cOut);
  [-1, 1].forEach(s => { const v = [[0, 0, -len * .35], [s * span, 0, -len * .55], [s * span * 1.05, 0, len * .25], [s * span * .45, 0, len * .55], [0, 0, len * .3]]; for (let i = 1; i < 4; i++) { [v[0], v[i], v[i + 1]].forEach((p, j) => { pos.push(...p); const c = (j === 0 ? a : b); col.push(c.r, c.g, c.b); }); } });
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3)); g.computeVertexNormals(); return g;
}
function buildFauna() {
  const NB = LOW ? 14 : 30, bf = new THREE.InstancedMesh(wingGeo(.16, .2, '#ffffff', '#f1f5f9'), flapMat(16, 1.25), NB), cols = ['#fde047', '#f9a8d4', '#a5f3fc', '#fdba74', '#c4b5fd', '#ffffff', '#86efac'];
  bf.frustumCulled = false; bf.instanceMatrix.setUsage(THREE.DynamicDrawUsage); W.scene.add(bf);
  const B = Array.from({ length: NB }, (_, i) => { bf.setColorAt(i, new THREE.Color(cols[i % cols.length])); return { x: 0, y: -50, z: 0, tx: 0, tz: 0, t: 0, ph: rnd(0, 6), on: false }; }); bf.instanceColor.needsUpdate = true;
  const NG = LOW ? 4 : 8, gull = new THREE.InstancedMesh(wingGeo(.75, .45, '#f8fafc', '#94a3b8'), flapMat(5, .55), NG); gull.frustumCulled = false; W.scene.add(gull);
  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), v = new THREE.Vector3(), s1 = new THREE.Vector3(1, 1, 1), Z = new THREE.Matrix4().makeScale(0, 0, 0);
  const okAt = (x, z) => { const b = domBiome(x, z), h = H(x, z); return (b === 'forest' || b === 'coast') && h > .1 && h < 8 * K && Math.hypot(x, z) > 12; };
  W.anim.push((dt, t) => {
    const city = inCity();
    B.forEach((b, i) => {
      const far = Math.hypot(b.x - P.x, b.z - P.z) > 38;
      if (!b.on || far) { b.on = false; if (city) { bf.setMatrixAt(i, Z); return; } const a = rnd(0, PI2), r = rnd(8, 30), x = P.x + Math.cos(a) * r, z = P.z + Math.sin(a) * r; if (!okAt(x, z)) { bf.setMatrixAt(i, Z); return; } Object.assign(b, { x, z, y: H(x, z) + rnd(.6, 2), tx: x, tz: z, t: 0, on: true }); }
      b.t -= dt; if (b.t < 0) { b.t = rnd(1.5, 4); b.tx = b.x + rnd(-5, 5); b.tz = b.z + rnd(-5, 5); if (!okAt(b.tx, b.tz)) { b.tx = b.x; b.tz = b.z; } }
      const dx = b.tx - b.x, dz = b.tz - b.z, d = Math.hypot(dx, dz) || 1, sp = Math.min(1.6, d) * dt; b.x += dx / d * sp + Math.sin(t * 3 + b.ph) * dt * .6; b.z += dz / d * sp + Math.cos(t * 2.6 + b.ph) * dt * .6;
      const gy = H(b.x, b.z); b.y += ((gy + .8 + Math.sin(t * 1.3 + b.ph) * .5) - b.y) * Math.min(1, dt * 2) + Math.sin(t * 9 + b.ph) * dt * .5;
      e.set(Math.sin(t * 4 + b.ph) * .2, Math.atan2(dx, dz), 0); q.setFromEuler(e); m.compose(v.set(b.x, b.y, b.z), q, s1); bf.setMatrixAt(i, m);
    });
    bf.instanceMatrix.needsUpdate = true;
    const cx = 108 * K, cz = 0;
    for (let i = 0; i < NG; i++) { const a = t * (.12 + (i % 3) * .03) + i * 2.1, r = 26 + (i % 4) * 9, y = 24 + (i % 3) * 5 + Math.sin(t * .5 + i) * 2; e.set(0, -a, .35); q.setFromEuler(e); m.compose(v.set(cx + Math.cos(a) * r, y, cz + Math.sin(a) * r), q, s1); gull.setMatrixAt(i, city ? Z : m); }
    gull.instanceMatrix.needsUpdate = true;
  });
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
/* 把群組裡不會動的零件依材質合併成單一網格（工坊原本將近 200 個小網格，每個都是一次繪製呼叫） */
function mergeStatic(group, skip = new Set()) {
  const by = new Map();
  group.children.slice().forEach(m => {
    if (!m.isMesh || m.isInstancedMesh || skip.has(m) || m.children.length || m.userData.it || Array.isArray(m.material)) return;
    const mt = m.material; if (mt.visible === false || mt.map || mt.transparent) return;
    const k = mt.uuid + (m.castShadow ? 's' : '') + (m.receiveShadow ? 'r' : ''); if (!by.has(k)) by.set(k, []); by.get(k).push(m);
  });
  by.forEach(list => {
    if (list.length < 2) return; const gs = list.map(m => { m.updateMatrix(); const g = m.geometry.index ? m.geometry.toNonIndexed() : m.geometry.clone(); g.applyMatrix4(m.matrix); return g; });
    let n = 0; gs.forEach(g => n += g.attributes.position.count); const pos = new Float32Array(n * 3), nor = new Float32Array(n * 3); let o = 0;
    gs.forEach(g => { pos.set(g.attributes.position.array, o * 3); nor.set(g.attributes.normal.array, o * 3); o += g.attributes.position.count; g.dispose(); });
    const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.BufferAttribute(pos, 3)); geo.setAttribute('normal', new THREE.BufferAttribute(nor, 3)); geo.computeBoundingSphere();
    const mm = new THREE.Mesh(geo, list[0].material); mm.castShadow = list[0].castShadow; mm.receiveShadow = list[0].receiveShadow; group.add(mm);
    list.forEach(m => { group.remove(m); m.geometry.dispose(); });
  });
}
function hitBox(w, h, d, x, y, z, parent) { return box(w, h, d, new THREE.MeshBasicMaterial({ visible: false }), x, y, z, parent); }
/* 木紋：依世界座標產生年輪狀的條紋（桌面、桌腳、擀麵棍） */
function woodMat(c) {
  const m = std(c, { roughness: .78, metalness: 0 });
  m.onBeforeCompile = sh => {
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vPW;').replace('#include <begin_vertex>', '#include <begin_vertex>\nvPW = (modelMatrix * vec4(transformed, 1.0)).xyz;');
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nvarying vec3 vPW;\n' + GLSL_HASH2)
      .replace('#include <color_fragment>', `#include <color_fragment>
        float wg = sin((vPW.x * 1.3 + tN(vPW.xz * vec2(0.6, 7.0)) * 2.4 + tN(vec2(vPW.y * 4.0, vPW.z * 9.0)) * 0.8) * 26.0);
        diffuseColor.rgb *= 0.86 + 0.1 * wg + 0.12 * tN(vec2(vPW.x * 2.0, vPW.z * 30.0 + vPW.y * 30.0));`);
  };
  m.customProgramCacheKey = () => 'wood'; return m;
}
function buildWorkshop() {
  const g = new THREE.Group(); W.scene.add(g); W.ws = g; W.slotCol = {}; W.slotMark = {}; W.slotInter = {};
  const at = (o, [x, z], ry = 0) => { o.position.set(x, G(x, z), z); o.rotation.y = ry; g.add(o); return o; };
  const dark = brushed(std('#1e293b', { metalness: .6, roughness: .4 })), white = std('#e2e8f0', { roughness: .35 }), steel = brushed(std('#94a3b8', { metalness: .9, roughness: .2 })), wood = woodMat('#a07850'), woodD = woodMat('#6b4d33');
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
  W.neon.forEach(n => MK.dyn.add(n));
  [pc, chair, bn, dt, lv, camG, tx, W.lineParts.belt, ...W.lineParts.m].forEach(o => mergeStatic(o, MK.dyn));
  refreshBase();
}
/* 金屬髮絲紋：沿水平方向的細紋改變粗糙度與明暗，反射天空時有拉絲金屬的質感 */
function brushed(m) {
  m.onBeforeCompile = sh => {
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vPW;').replace('#include <begin_vertex>', '#include <begin_vertex>\nvPW = (modelMatrix * vec4(transformed, 1.0)).xyz;');
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nvarying vec3 vPW;\n' + GLSL_HASH2)
      .replace('#include <roughnessmap_fragment>', `#include <roughnessmap_fragment>
        float brs = tN(vec2((vPW.x + vPW.z) * 0.6, vPW.y * 55.0)) * 0.7 + tN(vec2((vPW.x - vPW.z) * 0.9, vPW.y * 140.0)) * 0.3;
        roughnessFactor = clamp(roughnessFactor * (0.7 + 0.6 * brs), 0.04, 1.0); diffuseColor.rgb *= 0.9 + 0.2 * brs;`);
  };
  m.customProgramCacheKey = () => 'brushed'; return m;
}
function buildLine(G0) {
  const dark = brushed(std('#243247', { metalness: .65, roughness: .38 })), steel = brushed(std('#a3b1c2', { metalness: .9, roughness: .22 })), panel = brushed(std('#3a4a60', { metalness: .5, roughness: .42 }));
  const LP = W.lineParts = { belt: new THREE.Group(), m: [new THREE.Group(), new THREE.Group(), new THREE.Group()] }; G0.add(LP.belt); LP.m.forEach(m => G0.add(m)); const B = LP.belt;
  box(15, .35, 1.7, dark, 0, .45, 0, B); box(15, .08, 1.5, std('#0b0f17', { roughness: .9 }), 0, .66, 0, B); [-.9, .9].forEach(z => box(15, .12, .1, steel, 0, .72, z, B));
  MK.rollers = []; for (let i = 0; i < 14; i++) { const r = cyl(.14, .14, 1.8, 12, steel, -6.5 + i, .45, 0, B); r.rotation.x = Math.PI / 2; MK.rollers.push(r); }
  [-6.8, -2.3, 2.3, 6.8].forEach(x => [-.7, .7].forEach(z => box(.15, .3, .15, dark, x, .15, z, B)));
  // 輸送帶刻線、指示燈、糖晶都改成 InstancedMesh（原本各自是獨立網格，共 70 多次繪製呼叫）
  MK.beltX = Array.from({ length: 30 }, (_, i) => -7.25 + i * .5); MK.belt = new THREE.InstancedMesh(new THREE.BoxGeometry(.06, .02, 1.4), std('#22d3ee', { emissive: '#22d3ee', emissiveIntensity: .25 }), 30); B.add(MK.belt);
  const leds = (x, par) => { const im = new THREE.InstancedMesh(new THREE.BoxGeometry(.14, .08, .04), new THREE.MeshBasicMaterial({ color: '#ffffff' }), 5), m = new THREE.Matrix4(); for (let i = 0; i < 5; i++) { im.setMatrixAt(i, m.makeTranslation(x - .36 + i * .18, .3, 1.21)); im.setColorAt(i, new THREE.Color('#1e293b')); } im.userData.sig = ''; par.add(im); return im; };
  MK.leds = [];
  const A = LP.m[0], x0 = MX[0]; [-1, 1].forEach(s => [-1.05, 1.05].forEach(z => box(.22, 2.6, .22, dark, x0 + s * .9, 1.3, z, A)));
  box(2.2, .3, 2.4, panel, x0, 2.65, 0, A); box(1.2, .5, .8, dark, x0, 3.05, 0, A);
  MK.blades = [-.35, 0, .35].map(dx => box(.04, .7, 1.5, steel, x0 + dx, 2.1, 0, A)); box(1, .55, .1, panel, x0, .3, 1.15, A); MK.leds[0] = leds(x0, A);
  const Bm = LP.m[1], x1 = MX[1]; MK.drum = new THREE.Group(); MK.drum.position.set(x1, 1.25, 0); Bm.add(MK.drum);
  const glass = mesh(new THREE.CylinderGeometry(.95, .95, 2, 32, 1, true), new THREE.MeshStandardMaterial({ color: '#c7f9ff', transparent: true, opacity: .28, roughness: .05, side: THREE.DoubleSide }), 0, 0, 0, MK.drum); glass.rotation.z = Math.PI / 2;
  for (let i = 0; i < 6; i++) { const a = i / 6 * PI2, vb = box(1.9, .04, .25, steel, 0, Math.cos(a) * .82, Math.sin(a) * .82, MK.drum); vb.rotation.x = -a; }
  [-1, 1].forEach(s => { const r = mesh(new THREE.TorusGeometry(.97, .06, 10, 40), steel, x1 + s, 1.25, 0, Bm); r.rotation.y = Math.PI / 2; box(.2, 1.2, .2, dark, x1 + s, .6, -.9, Bm); box(.2, 1.2, .2, dark, x1 + s, .6, .9, Bm); });
  const hop = mesh(new THREE.ConeGeometry(.6, .9, 4, 1, true), std('#334155', { side: THREE.DoubleSide }), x1, 2.85, 0, Bm); hop.rotation.x = Math.PI;
  MK.sugarP = Array.from({ length: 14 }, () => [x1 + rnd(-.15, .15), rnd(-.15, .15)]); MK.sugar = new THREE.InstancedMesh(new THREE.BoxGeometry(.05, .05, .05), new THREE.MeshBasicMaterial({ color: '#ffffff' }), 14); MK.sugar.frustumCulled = false; Bm.add(MK.sugar);
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
  MK.belt.frustumCulled = false; MK.dyn = new Set([...MK.blades, ...MK.heat, MK.tank, MK.turn]);
}
function lineStep(dt) {
  if (!MK.J) return; MK.t += dt; const t = MK.t, act = i => (M.active && M.step === i && M.phase === 'run') || MK.pulse[i] > 0, run = i => M.active && M.step === i && M.phase === 'run';
  MK.pulse = MK.pulse.map(p => Math.max(0, p - dt));
  MK.blades.forEach((b, k) => b.position.y = MK.pulse[0] > 0 ? 1.55 + .45 * Math.cos(MK.pulse[0] * 25 + k * .9) : run(0) ? 2.0 : 2.1);
  MK.drum.rotation.x += dt * (run(1) ? 1 + (MK.drumSpd || 0) * 12 : act(1) ? 5 : .3);
  MK.sugar.visible = act(1); if (MK.sugar.visible) { MK.sugarP.forEach(([x, z], i) => MK.sugar.setMatrixAt(i, tmpM.makeTranslation(x, 2.4 - ((t * 1.6 + i / 14) % 1) * 1.4, z))); MK.sugar.instanceMatrix.needsUpdate = true; }
  const hot = act(2), heatK = run(2) ? .3 + (MK.heatLv || 0) * 3 : (hot ? 2.2 + Math.sin(t * 12) * .6 : .2); MK.heat.forEach(h => h.material.emissiveIntensity = heatK); MK.fan.rotation.y += dt * (hot ? 14 : 1.2);
  MK.leds.forEach((im, i) => { const lv = S.up[MKEY[i]], on = act(i), sig = lv + (on ? 'a' : 'b'); if (im.userData.sig === sig) return; im.userData.sig = sig; for (let k = 0; k < 5; k++) im.setColorAt(k, tmpC.set(k < lv ? (on ? '#34d399' : '#22d3ee') : '#1e293b')); im.instanceColor.needsUpdate = true; });
  const moving = M.active || MK.bx < 7.9;
  if (moving || !MK.beltInit) { MK.beltInit = true; MK.beltX.forEach((x, i) => { x += dt * (moving ? .8 : 0); if (x > 7.4) x -= 15; MK.beltX[i] = x; MK.belt.setMatrixAt(i, tmpM.makeTranslation(x, .71, 0)); }); MK.belt.instanceMatrix.needsUpdate = true; }
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
  W.anim.push((dt, t) => { if (gateTex) gateTex.offset.y = t * .3; Object.keys(W.gates).forEach(k => { const gt = W.gates[k]; if (gt.fade > 0) { gt.fade -= dt; gt.mat.opacity = .55 * Math.max(0, gt.fade); if (gt.fade <= 0) { dropObj(gt.g); delete W.gates[k]; } } else gt.mat.opacity = .45 + Math.sin(t * 2) * .1; }); });
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
  // 解開後（或正在開門的 0.5 秒內）再點不會打亂狀態
  if (S.zones.includes(zoneOf) || W.solving === zoneOf) return toast('這道謎題已經解開了。');
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
    else if (q.tide.length === TIDE_ORDER.length) { W.solving = 'volcano'; setTimeout(() => discoverZone('volcano'), 500); } else sfx.machine(0);
    save(); renderQuest();
  } else if (pz.type === 'tablet') {
    q.read.tablet = true; save(); renderQuest();
    modal(`<h2>古老的石碑</h2><div class="riddle">${TABLET_TXT}</div><p class="small" style="color:var(--sub)">四根熔岩柱由左到右排列（面向北方）。點擊熔岩柱可以切換頂端晶石的顏色，每種顏色都屬於一種史萊姆。</p>`);
  } else if (pz.type === 'pillar') {
    if (!q.read.tablet) return toast('熔岩柱燙得無法靠近……也許附近有什麼線索。');
    q.pil[pz.i] = (q.pil[pz.i] + 1) % PILLAR.length; setPillar(pz.g, q.pil[pz.i]); sfx.machine(2); save();
    if (q.pil.every((v, i) => v === PILLAR_ANS[i])) { W.solving = 'snow'; setTimeout(() => discoverZone('snow'), 500); }
  }
}
function questTarget() {
  const k = nextQuest(); if (!k || !S.zones.includes(QUEST[k].from)) return null; const q = qState();
  const nearest = (list, have, n, h) => { let b = null, bd = 1e9; list.forEach(([x, z], i) => { if (have.includes(i)) return; const d = Math.hypot(x - P.x, z - P.z); if (d < bd) { bd = d; b = { x, z, n, h }; } }); return b; };
  if (k === 'coast') return q.frags.length >= 5 ? { x: ALTAR[0], z: ALTAR[1], n: '古地圖石台', h: '對準石台' + (TOUCH ? '點擊' : '按 E') + '，把古地圖拼回原狀。' } : nearest(FRAG_SPOTS, q.frags, '古地圖碎片', '碎片就落在附近的地上，靠近時會微微發光，對準後' + (TOUCH ? '點擊' : '按 E') + '撿起。');
  if (k === 'volcano') return q.notes.length >= 3 ? { x: TIDE_SPOTS[2][0], z: TIDE_SPOTS[2][1], n: '潮汐石陣', h: '依照紙條上的謎語，依序點亮四顆潮汐石。順序錯了會重來。' } : nearest(NOTES, q.notes, '撕碎的紙條', '紙條壓在附近地上的小石頭下，對準後' + (TOUCH ? '點擊' : '按 E') + '撿起。');
  if (k === 'snow') return q.read.tablet ? { x: 0, z: PILLARS[1][1], n: '熔岩柱', h: '依照石碑上的謎題，點擊熔岩柱切換頂端晶石的顏色。' } : { x: TABLET[0], z: TABLET[1], n: '古老的石碑', h: '對準石碑' + (TOUCH ? '點擊' : '按 E') + '，閱讀上面的古文。' };
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
   史萊姆（高畫質版）
   身體為單一網格＋自訂著色器：
   - 軟體形變：擠壓／伸展（體積守恆）、慣性傾斜、落地攤開、受擊凹陷與漣漪、表面緩慢流動
   - 程序化臉部：眨眼、開心／驚訝／睡著表情、瞳孔追視玩家、嘴型、腮紅（會跟著身體一起變形）
   - 內部：核心光暈與上升氣泡（光線求交，不需額外繪製）
   - 光影：菲涅耳邊光、背光次表面散射、清漆反射；各品種有自己的花紋（蜜糖滴落、熔岩裂紋、冰霜、極光帶…）
   行為：跳躍移動（蓄力→起跳→落地回彈）、注意到玩家、好奇靠近、稀有種怕生逃跑（潛行可接近）、休息打盹、表情泡泡
   ============================================================ */
const SL_H = 1.22;
let SLIME_GEO = null; const SCACHE = {};
// 史萊姆外形：圓潤軟糖頂＋略為外擴、帶不規則波紋的黏液裙邊；底部在 y=0
function surf(x, y, z) {
  const l = Math.hypot(x, y, z) || 1; x /= l; y /= l; z /= l;
  const rho = Math.hypot(x, z), a = Math.atan2(z, x);
  let R, Y;
  if (y >= 0) { Y = .22 + y; R = rho * 1.06 * (1 - .1 * y * y); } else { Y = .22 + y * .22; R = rho * 1.06; }
  const lw = y < 0 ? 1 : Math.max(0, 1 - y * 3);
  R *= 1 + .035 * lw * (Math.sin(a * 5 + 1.3) * .6 + Math.sin(a * 3 - .7) * .4);
  return new THREE.Vector3(rho > 1e-6 ? x / rho * R : 0, Y, rho > 1e-6 ? z / rho * R : 0);
}
function slimeGeo() {
  if (SLIME_GEO) return SLIME_GEO;
  const g = new THREE.SphereGeometry(1, LOW ? 40 : 64, LOW ? 28 : 44), p = g.attributes.position, nr = g.attributes.normal, e = .004;
  const d = new THREE.Vector3(), t1 = new THREE.Vector3(), t2 = new THREE.Vector3(), up = new THREE.Vector3(0, 1, 0), ax = new THREE.Vector3(1, 0, 0);
  // 法線以解析方式計算（避免球體接縫處的光影斷層）
  for (let i = 0; i < p.count; i++) {
    d.set(p.getX(i), p.getY(i), p.getZ(i)).normalize();
    t1.crossVectors(d, Math.abs(d.y) < .95 ? up : ax).normalize(); t2.crossVectors(d, t1);
    const s0 = surf(d.x, d.y, d.z), sa = surf(d.x + t1.x * e, d.y + t1.y * e, d.z + t1.z * e).sub(s0), sb = surf(d.x + t2.x * e, d.y + t2.y * e, d.z + t2.z * e).sub(s0);
    const n = sa.cross(sb).normalize(); if (n.dot(d) < 0) n.negate();
    p.setXYZ(i, s0.x, s0.y, s0.z); nr.setXYZ(i, n.x, n.y, n.z);
  }
  g.computeBoundingBox(); g.boundingSphere = new THREE.Sphere(new THREE.Vector3(0, .6, 0), 1.8);
  return SLIME_GEO = g;
}
// 各品種的配色與花紋
const SLOOK = {
  grass: { pat: 0, c2: '#d9f99d', deep: '#15803d', iris: '#166534', rim: '#d1fae5', core: '#fef9c3' },
  honey: { pat: 1, c2: '#e8890c', deep: '#b45309', iris: '#78350f', rim: '#fef3c7', core: '#fffbeb' },
  salt: { pat: 2, c2: '#e0f2fe', deep: '#0369a1', iris: '#0c4a6e', rim: '#e0f2fe', core: '#ffffff' },
  coral: { pat: 3, c2: '#ffe4e6', deep: '#be123c', iris: '#881337', rim: '#ffe4e6', core: '#fff1f2' },
  lava: { pat: 4, c2: '#fde047', deep: '#9a3412', iris: '#431407', rim: '#fed7aa', core: '#fde047' },
  obsid: { pat: 5, c2: '#c4b5fd', deep: '#2e1065', iris: '#7c3aed', rim: '#ddd6fe', core: '#f0abfc' },
  ice: { pat: 6, c2: '#ffffff', deep: '#38bdf8', iris: '#075985', rim: '#ffffff', core: '#f0f9ff' },
  aurora: { pat: 7, c2: '#a78bfa', deep: '#0f766e', iris: '#4c1d95', rim: '#f5d0fe', core: '#f0abfc' },
};
/* ---------- 著色器 ---------- */
const SL_DEFORM = `
uniform float uT;
uniform vec4 uSq;
uniform vec4 uDent;
uniform vec4 uRip;
vec3 slDeform(vec3 p) {
  float h = clamp(p.y / 1.22, 0.0, 1.0);
  vec3 n = normalize(vec3(p.x, (p.y - 0.5) * 1.15, p.z) + vec3(0.0, 1e-4, 0.0));
  float d = distance(p, uDent.xyz);
  float dent = uDent.w * exp(-d * d * 3.5);
  float ra = uRip.x;
  float rip = uRip.y * sin(d * 10.0 - ra * 17.0) * exp(-d * 1.4) * smoothstep(0.0, 0.05, ra);
  float flow = uRip.z * (sin(p.x * 3.1 + uT * 1.7 + uRip.w) * sin(p.z * 2.7 - uT * 1.3 + uRip.w) + 0.6 * sin(p.y * 4.3 - uT * 2.1 + uRip.w * 2.0));
  p += n * (rip - dent + flow * h);
  float sy = uSq.x;
  float sxz = inversesqrt(max(sy, 0.3));
  p.y *= sy;
  p.xz *= sxz * (1.0 + uSq.w * (1.0 - smoothstep(0.0, 0.4, h)));
  p.xz += uSq.yz * h * h;
  return p;
}
`;
const SL_FRAG = `
uniform float uT;
uniform vec3 uC1;
uniform vec3 uC2;
uniform vec3 uC3;
uniform vec3 uLine;
uniform vec3 uIris;
uniform vec3 uRimC;
uniform vec3 uSSS;
uniform vec3 uCoreC;
uniform vec3 uCam;
uniform vec4 uFace;
uniform vec4 uFace2;
uniform vec4 uCore;
uniform vec4 uMisc;
uniform vec4 uBub[4];
varying vec3 vRest;
float slH(vec3 p) { p = fract(p * 0.3183099 + vec3(0.71, 0.113, 0.419)); p *= 17.0; return fract(p.x * p.y * p.z * (p.x + p.y + p.z)); }
float slN(vec3 x) {
  vec3 i = floor(x); vec3 f = fract(x); f = f * f * (3.0 - 2.0 * f);
  float a = slH(i), b = slH(i + vec3(1.0, 0.0, 0.0)), c = slH(i + vec3(0.0, 1.0, 0.0)), d = slH(i + vec3(1.0, 1.0, 0.0));
  float e = slH(i + vec3(0.0, 0.0, 1.0)), f1 = slH(i + vec3(1.0, 0.0, 1.0)), g = slH(i + vec3(0.0, 1.0, 1.0)), h = slH(i + vec3(1.0, 1.0, 1.0));
  return mix(mix(mix(a, b, f.x), mix(c, d, f.x), f.y), mix(mix(e, f1, f.x), mix(g, h, f.x), f.y), f.z);
}
vec2 slVor(vec3 x) {
  vec3 p = floor(x); vec3 f = fract(x); float d1 = 8.0, d2 = 8.0;
  for (int k = -1; k <= 1; k++) for (int j = -1; j <= 1; j++) for (int i = -1; i <= 1; i++) {
    vec3 b = vec3(float(i), float(j), float(k));
    vec3 r = b - f + vec3(slH(p + b), slH(p + b + 11.3), slH(p + b + 27.1));
    float dd = dot(r, r);
    if (dd < d1) { d2 = d1; d1 = dd; } else if (dd < d2) { d2 = dd; }
  }
  return vec2(sqrt(d1), sqrt(d2));
}
float slEll(vec2 p, vec2 r) { float k0 = length(p / r); float k1 = length(p / (r * r)); return k0 * (k0 - 1.0) / max(k1, 1e-4); }
float slFill(float d, float w) { return 1.0 - smoothstep(-w, w, d); }
float slCurve(vec2 q, float k, float hw, float th) {
  float y = k * (q.x * q.x - hw * hw * 0.5);
  float dc = abs(q.y - y) / sqrt(1.0 + 4.0 * k * k * q.x * q.x);
  return length(vec2(max(abs(q.x) - hw, 0.0), dc)) - th;
}
void slFace(vec2 f, float w, inout vec3 c, inout float m) {
  float blink = uFace.x, happy = uFace.y, sur = uFace.z, slp = uFace.w;
  vec2 look = uFace2.xy; float mo = uFace2.z, bl = uFace2.w;
  for (int i = 0; i < 2; i++) {
    float s = i == 0 ? -1.0 : 1.0;
    vec2 q = (f - vec2(s * 0.47, 0.485)) / vec2(0.11, 0.055);
    float b = (1.0 - smoothstep(0.15, 1.0, length(q))) * bl;
    c = mix(c, vec3(1.0, 0.42, 0.56), b * 0.65);
  }
  float closed = clamp(max(max(blink, slp), happy), 0.0, 1.0);
  float open = 1.0 - closed;
  float hk = clamp(happy / max(closed, 0.001), 0.0, 1.0);
  for (int i = 0; i < 2; i++) {
    float s = i == 0 ? -1.0 : 1.0;
    vec2 q = f - vec2(s * 0.285, 0.645 + sur * 0.015);
    vec2 er = vec2(0.118, 0.148) * (1.0 + sur * 0.16);
    if (open > 0.04) {
      float oy = max(open, 0.06);
      vec2 qe = vec2(q.x, q.y / oy);
      float dS = slEll(qe, er);
      float sc = slFill(dS, w);
      float ol = slFill(dS - 0.02, w);
      vec2 qi = qe - look * vec2(0.042, 0.036);
      float ir = 0.088 * (1.0 - sur * 0.3);
      float li = length(qi);
      float iris = slFill(li - ir, w) * sc;
      float pu = slFill(li - ir * (0.5 - sur * 0.12), w) * sc;
      vec3 ic = mix(uIris * 0.5, min(uIris * 1.5 + 0.15, vec3(1.0)), smoothstep(ir, -ir, qi.y));
      ic = mix(ic, uIris * 0.28, smoothstep(ir * 0.62, ir, li) * 0.85);
      vec3 ec = mix(uLine, vec3(0.97, 0.985, 1.0), sc);
      ec = mix(ec, ec * vec3(0.8, 0.85, 0.95), sc * (1.0 - iris) * smoothstep(0.0, er.y, qe.y) * 0.6);
      ec = mix(ec, ic, iris);
      ec = mix(ec, vec3(0.02, 0.025, 0.05), pu);
      float h1 = slFill(length(qi - vec2(-0.032, 0.038)) - 0.03, w) * sc;
      float h2 = slFill(length(qi - vec2(0.03, -0.035)) - 0.014, w) * sc;
      ec = mix(ec, vec3(1.0), max(h1, h2 * 0.85));
      float a = ol * smoothstep(0.04, 0.22, open);
      c = mix(c, ec, a); m = max(m, a);
    }
    float cw = smoothstep(0.72, 0.97, closed);
    if (cw > 0.0) {
      float k = mix(5.5, -7.5, hk);
      float a = slFill(slCurve(q - vec2(0.0, -0.01), k, 0.105, 0.0165), w) * cw;
      c = mix(c, uLine, a); m = max(m, a);
    }
  }
  vec2 mq = f - vec2(0.0, 0.468);
  float lineA = 1.0 - smoothstep(0.12, 0.3, mo);
  if (lineA > 0.0) {
    float k = 7.0 + happy * 4.0 - sur * 10.0;
    float a = slFill(slCurve(mq, k, 0.058 + happy * 0.012, 0.0115), w) * lineA;
    c = mix(c, uLine, a); m = max(m, a);
  }
  float fillA = smoothstep(0.1, 0.3, mo);
  if (fillA > 0.0) {
    vec2 r = vec2(mix(0.07 + happy * 0.022, 0.042, sur), 0.014 + 0.06 * mo);
    vec2 q = mq - vec2(0.0, -r.y * 0.55);
    float d = slEll(q, r);
    d = mix(d, max(d, q.y - r.y * 0.3), happy * (1.0 - sur));
    float a = slFill(d, w) * fillA;
    float ol = slFill(d - 0.013, w) * fillA;
    vec3 mc = vec3(0.24, 0.035, 0.08);
    float tg = 1.0 - smoothstep(0.75, 1.05, length((q - vec2(0.0, -r.y * 0.72)) / vec2(r.x * 0.72, r.y * 0.62)));
    mc = mix(mc, vec3(0.98, 0.44, 0.55), tg * 0.95);
    c = mix(c, uLine, ol); c = mix(c, mc, a); m = max(m, ol);
  }
}
`;
const SL_COLOR = `
vec3 slP = vRest; float slHn = clamp(slP.y / 1.22, 0.0, 1.0); float slAng = atan(slP.z, slP.x);
vec3 slC = mix(uC3, uC1, smoothstep(0.0, 0.8, slHn));
slC = mix(slC, min(uC1 * 1.2 + 0.1, vec3(1.0)), smoothstep(0.5, 1.0, slHn) * 0.35);
vec3 slPe = vec3(0.0); float slPr = 0.0; float slFm = 0.0; float slPat = uMisc.x;
if (slPat < 0.5) {
  float n = slN(slP * 6.0 + 3.0);
  slC = mix(slC, uC3 * 0.95, smoothstep(0.6, 0.7, n) * 0.3);
  slC = mix(slC, uC2, smoothstep(0.74, 0.8, slN(slP * 13.0)) * 0.3 * slHn);
} else if (slPat < 1.5) {
  float dr = 0.84 - 0.3 * pow(max(0.0, 0.55 * sin(slAng * 6.0 + 1.3) + 0.45 * sin(slAng * 11.0 + 0.4)), 3.0) - 0.06 * slN(vec3(slAng * 3.0, 0.5, 1.0));
  float g = smoothstep(dr - 0.025, dr + 0.012, slHn);
  slC = mix(slC, uC2, g * 0.9); slPr -= g * 0.14; slPe += uC2 * g * 0.06;
  slC = mix(slC, vec3(1.0, 0.95, 0.7), smoothstep(0.7, 0.75, slN(slP * 11.0)) * 0.2 * (1.0 - g));
} else if (slPat < 2.5) {
  vec3 cp = floor(slP * 26.0); float s = slH(cp);
  float sp = step(0.93, s) * smoothstep(0.38, 0.0, length(fract(slP * 26.0) - 0.5)) * (0.5 + 0.5 * sin(uT * 3.0 + s * 40.0));
  slPe += vec3(1.0) * sp * 1.3; slC = mix(slC, uC2, smoothstep(0.7, 0.98, slHn) * 0.35);
} else if (slPat < 3.5) {
  float n = slN(slP * 4.5 + 7.0); float sp = smoothstep(0.64, 0.68, n); float ring = smoothstep(0.59, 0.63, n) - sp;
  slC = mix(slC, uC2, sp * 0.85); slC = mix(slC, uC3, ring * 0.45);
} else if (slPat < 4.5) {
#ifdef SLIME_LOW
  float slE = 1.0 - smoothstep(0.0, 0.06, abs(slN(slP * 3.4) - 0.5));
#else
  vec2 v = slVor(slP * 3.4 + vec3(0.0, uT * 0.05, 0.0)); float slE = 1.0 - smoothstep(0.02, 0.12, v.y - v.x);
#endif
  float crust = smoothstep(0.32, 0.75, slHn + slN(slP * 3.0) * 0.3);
  slC = mix(slC, vec3(0.16, 0.07, 0.05), crust * (1.0 - slE) * 0.85);
  slPe += mix(vec3(1.0, 0.32, 0.04), vec3(1.0, 0.85, 0.3), slE) * slE * (0.85 + 0.45 * sin(uT * 3.0 + slP.x * 4.0)) * (0.35 + crust);
  slPr += crust * 0.4;
} else if (slPat < 5.5) {
  vec3 cp = floor(slP * 20.0); float s = slH(cp);
  float sp = step(0.9, s) * smoothstep(0.4, 0.0, length(fract(slP * 20.0) - 0.5));
  slPe += mix(vec3(0.75, 0.55, 1.0), vec3(1.0), s) * sp * (0.6 + 0.4 * sin(uT * 2.0 + s * 30.0));
  slPr -= 0.12;
} else if (slPat < 6.5) {
  float fr = smoothstep(0.45, 0.85, slN(slP * 7.0) * 0.6 + slHn * 0.75);
  slC = mix(slC, vec3(0.95, 0.98, 1.0), fr * 0.7); slPr += fr * 0.3;
#ifndef SLIME_LOW
  vec2 v = slVor(slP * 4.0); float edge = 1.0 - smoothstep(0.0, 0.05, v.y - v.x);
  slC = mix(slC, vec3(1.0), edge * 0.35 * (1.0 - fr));
#endif
} else {
  float b = slP.y * 2.6 + sin(slAng * 2.0 + uT * 0.8) * 0.35 + uT * 0.25;
  float t = fract(b); vec3 a3 = vec3(0.13, 0.83, 0.93);
  vec3 ac = t < 0.333 ? mix(uC1, uC2, t * 3.0) : (t < 0.666 ? mix(uC2, a3, (t - 0.333) * 3.0) : mix(a3, uC1, (t - 0.666) * 3.0));
  slC = mix(slC, ac, 0.75); slPe += ac * 0.12;
}
slC = mix(slC, vec3(dot(slC, vec3(0.3, 0.59, 0.11))), uMisc.w * 0.45);
vec2 slF = vec2(atan(slP.x, slP.z) * 0.95, slP.y);
float slW = max(length(fwidth(slF)), 1e-4) * 0.75;
if (slP.z > 0.2 && abs(slF.x) < 0.7 && slF.y > 0.3 && slF.y < 0.88) slFace(slF, slW, slC, slFm);
diffuseColor.rgb = slC;
`;
const SL_LIGHT = `
vec3 slRd = normalize(vRest - uCam);
float slCore = 0.0;
{
  vec3 cr = vec3(0.4, 0.3, 0.4) * uCore.y; vec3 o = (vRest - vec3(0.0, 0.52, -0.05)) / cr; vec3 d = slRd / cr;
  float A = dot(d, d), B = dot(o, d), C = dot(o, o) - 1.0, D = B * B - A * C;
  if (D > 0.0) { float s = sqrt(D); float t0 = max((-B - s) / A, 0.0), t1 = (-B + s) / A; if (t1 > t0) slCore = clamp((t1 - t0) * sqrt(A) * 0.5, 0.0, 1.0); }
}
float slBub = 0.0;
#ifndef SLIME_LOW
for (int i = 0; i < 4; i++) {
  vec4 b = uBub[i]; float ph = fract(b.y + uT * (0.05 + 0.02 * float(i)));
  vec3 c = vec3(b.x + sin(uT * 1.3 + float(i)) * 0.03, 0.14 + ph * 0.75, b.z);
  float r = b.w * smoothstep(0.0, 0.12, ph) * smoothstep(1.0, 0.82, ph);
  vec3 oc = vRest - c; float bb = dot(oc, slRd), cc = dot(oc, oc) - r * r, hh = bb * bb - cc;
  if (hh > 0.0 && -bb - sqrt(hh) > 0.0) { float q = sqrt(max(dot(oc, oc) - bb * bb, 0.0)) / max(r, 1e-4); slBub += smoothstep(0.5, 1.0, q) * 0.6 + smoothstep(0.3, 0.0, length(vec2(q * 0.7 - 0.35, 0.0))) * 0.15; }
}
#endif
float slIn = 1.0 - slFm;
vec3 slV = normalize(vViewPosition);
float slFr = pow(1.0 - clamp(dot(normal, slV), 0.0, 1.0), 3.0);
outgoingLight += uCoreC * uCore.x * slCore * slCore * slIn;
outgoingLight += vec3(0.85, 0.95, 1.0) * slBub * 0.45 * slIn;
outgoingLight += uRimC * slFr * (0.2 + uMisc.z * 1.4) * slIn;
vec3 slR = reflect(-slV, normal); float slSp = pow(max(dot(slR, normalize(vec3(-0.42, 0.78, 0.46))), 0.0), 70.0); float slSp2 = pow(max(dot(slR, normalize(vec3(0.55, 0.35, 0.75))), 0.0), 24.0);
outgoingLight += vec3(1.0) * (smoothstep(0.25, 0.6, slSp) * 0.9 + slSp2 * 0.12) * (1.0 - slFm * 0.7);
#if NUM_DIR_LIGHTS > 0
  vec3 slL = directionalLights[0].direction;
  float slTr = pow(clamp(dot(slV, -(slL + normal * 0.4)), 0.0, 1.0), 3.0);
  outgoingLight += uSSS * directionalLights[0].color * slTr * 0.5 * slIn;
#endif
outgoingLight += uSSS * (0.16 + 0.12 * slCore) * (1.0 - slFr * 0.6) * slIn + uC1 * uMisc.z * 0.06;
outgoingLight = mix(outgoingLight, outgoingLight * normalize(uC1 + 0.05) * 1.6, 0.22 * slIn);
diffuseColor.a = clamp(mix(uMisc.y, 1.0, slFr * 0.8 + slCore * 0.3 + slFm), 0.0, 1.0);
`;
function slimeMat(U) {
  const m = new THREE.MeshPhysicalMaterial({ color: 0xffffff, roughness: .18, metalness: 0, clearcoat: .8, clearcoatRoughness: .08, transparent: true, envMapIntensity: .5 });
  if (LOW) m.defines = { SLIME_LOW: '' };
  m.onBeforeCompile = sh => {
    Object.assign(sh.uniforms, U);
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\n' + SL_DEFORM + '\nvarying vec3 vRest;')
      .replace('#include <beginnormal_vertex>', `vec3 slP0 = slDeform(position); vec3 slN0 = normalize(normal);
        vec3 slTa = normalize(abs(slN0.y) < 0.95 ? cross(slN0, vec3(0.0, 1.0, 0.0)) : cross(slN0, vec3(1.0, 0.0, 0.0))); vec3 slTb = cross(slN0, slTa);
        vec3 objectNormal = normalize(cross(slDeform(position + slTa * 0.02) - slP0, slDeform(position + slTb * 0.02) - slP0));
        if (dot(objectNormal, slN0) < 0.0) objectNormal = -objectNormal; vRest = position;`)
      .replace('#include <begin_vertex>', 'vec3 transformed = slP0;');
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\n' + SL_FRAG)
      .replace('#include <color_fragment>', '#include <color_fragment>\n' + SL_COLOR)
      .replace('#include <roughnessmap_fragment>', '#include <roughnessmap_fragment>\nroughnessFactor = mix(clamp(roughnessFactor + slPr, 0.04, 1.0), 0.32, slFm * 0.5);')
      .replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\ntotalEmissiveRadiance += slPe * (1.0 - slFm);')
      .replace('#include <opaque_fragment>', SL_LIGHT + '\n#include <opaque_fragment>');
  };
  m.customProgramCacheKey = () => 'slimeJelly2';
  return m;
}
function slimeDepthMat(U) {
  const m = new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking });
  m.onBeforeCompile = sh => {
    Object.assign(sh.uniforms, { uT: U.uT, uSq: U.uSq, uDent: U.uDent, uRip: U.uRip });
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\n' + SL_DEFORM).replace('#include <begin_vertex>', 'vec3 transformed = slDeform(position);');
  };
  m.customProgramCacheKey = () => 'slimeDepth2';
  return m;
}
/* ---------- 品種配件（每種合併成 1～2 個網格，跟著身體擠壓與傾斜） ---------- */
function sPos(dir, out = 0) { const p = surf(dir[0], dir[1], dir[2]), n = new THREE.Vector3(dir[0], dir[1], dir[2]).normalize(); return { p: p.addScaledVector(n, out), n }; }
function MQn(p, n, sx = 1, sy = sx, sz = sx, spin = 0) {
  const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), n); if (spin) q.multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), spin));
  return new THREE.Matrix4().compose(p, q, new THREE.Vector3(sx, sy, sz));
}
function slimeFeat(sp, F, ud) {
  const R = SCACHE[sp.id] || (SCACHE[sp.id] = {}), once = (k, fn) => R[k] || (R[k] = fn());
  const add = (geoK, gfn, matK, mfn, x = 0, y = 0, z = 0) => { const m = mesh(once(geoK, gfn), once(matK, mfn), x, y, z, F); m.castShadow = !LOW; return m; };
  const phys = o => () => new THREE.MeshPhysicalMaterial(Object.assign({ vertexColors: true, roughness: .3, clearcoat: 1, clearcoatRoughness: .15 }, o));
  if (sp.id === 'grass') {
    ud.sprout = add('g', () => mergeParts([[new THREE.CylinderGeometry(.022, .032, .3, 8).translate(0, .15, 0), '#3f7f45'],
      ...[-1, 1].map(s => { const l = new THREE.SphereGeometry(1, 14, 8); l.scale(.17, .028, .08); l.translate(.15, 0, 0); return [l, s < 0 ? '#4ade80' : '#22c55e', M4(0, .27, 0, s * .15, s < 0 ? Math.PI : 0, .45)]; }),
      [new THREE.SphereGeometry(.036, 10, 8), '#bbf7d0', M4(0, .305, 0)]], true), 'gm', phys({ roughness: .45, clearcoat: .3 }), 0, SL_H - .04, 0);
  } else if (sp.id === 'honey') {
    const T = M4(.22, 1.1, -.1, .25, .3, -.42);
    add('g', () => mergeParts([[new THREE.CylinderGeometry(.17, .17, .075, 6), '#f59e0b', T],
      ...[[0, 0], [.075, .043], [-.075, .043], [0, -.086], [.075, -.043], [-.075, -.043], [0, .086]].map(([x, z]) => [new THREE.CylinderGeometry(.034, .034, .078, 6), '#b45309', T.clone().multiply(M4(x, .002, z))])], true), 'gm', phys({ roughness: .25 }));
  } else if (sp.id === 'salt') {
    add('g', () => mergeParts([[0, 1, 0, .13, 1], [.27, .9, .1, .09, .6], [-.22, .93, -.14, .1, 1.3], [.06, .88, -.3, .08, 2.1], [-.13, .92, .24, .075, .4], [.18, .95, -.18, .06, 2.7]].map(([x, y, z, s, r], i) => {
      const o = sPos([x, y, z], s * .25); return [new THREE.BoxGeometry(1, 1, 1), i % 2 ? '#e0f2fe' : '#f8fafc', MQn(o.p, o.n, s, s * 1.35, s, r)];
    }), true), 'gm', phys({ roughness: .06, emissive: '#bae6fd', emissiveIntensity: .18 }));
  } else if (sp.id === 'coral') {
    add('g', () => {
      const parts = [], V = (x, y, z) => new THREE.Vector3(x, y, z);
      [[-.2, -.06, .36, 1], [.18, .1, .44, -1], [.02, -.24, .3, 1]].forEach(([x, z, h, s]) => {
        const b = sPos([x, 1, z], -.02), n = V(x * 1.6, 1, z * 1.6).normalize();
        parts.push([new THREE.CylinderGeometry(.03, .046, h, 8).translate(0, h / 2, 0), '#f472b6', MQn(b.p, n)]);
        const mid = b.p.clone().addScaledVector(n, h * .55), n2 = n.clone().add(V(s * .9, .1, -s * .3)).normalize();
        parts.push([new THREE.CylinderGeometry(.02, .03, h * .5, 7).translate(0, h * .25, 0), '#ec4899', MQn(mid, n2)]);
        parts.push([new THREE.SphereGeometry(.055, 10, 8), '#fbcfe8', M4(...b.p.clone().addScaledVector(n, h).toArray())]);
        parts.push([new THREE.SphereGeometry(.042, 10, 8), '#fbcfe8', M4(...mid.clone().addScaledVector(n2, h * .5).toArray())]);
      });
      return mergeParts(parts, true);
    }, 'gm', phys({ roughness: .55, clearcoat: .4 }));
  } else if (sp.id === 'lava') {
    const fl = new THREE.Group(); fl.position.set(0, SL_H + .02, 0); F.add(fl); ud.flame = fl;
    mesh(once('fo', () => new THREE.ConeGeometry(.17, .55, 18).translate(0, .24, 0)), once('fom', () => new THREE.MeshBasicMaterial({ color: '#fb923c', transparent: true, opacity: .7, blending: THREE.AdditiveBlending, depthWrite: false })), 0, 0, 0, fl);
    mesh(once('fi', () => new THREE.ConeGeometry(.09, .32, 14).translate(0, .15, 0)), once('fim', () => new THREE.MeshBasicMaterial({ color: '#fde047', transparent: true, opacity: .95, blending: THREE.AdditiveBlending, depthWrite: false })), 0, 0, 0, fl);
  } else if (sp.id === 'obsid') {
    add('g', () => mergeParts([[0, .85, -.5, 1.25], [.38, .65, -.62, .95], [-.38, .65, -.62, .95], [0, .4, -.92, .75], [.22, .95, -.12, .6], [-.25, .9, -.2, .5]].map(([x, y, z, s], i) => {
      const o = sPos([x, y, z], s * .1); return [new THREE.OctahedronGeometry(.16), i % 2 ? '#4c1d95' : '#2e1065', MQn(o.p, o.n, s * .62, s * 2.1, s * .62, i)];
    }), true), 'gm', phys({ roughness: .05, metalness: .35, emissive: '#4c1d95', emissiveIntensity: .3, flatShading: true }));
  } else if (sp.id === 'ice') {
    add('g', () => mergeParts([...Array(7)].map((_, i) => {
      const a = i / 7 * PI2, r = i % 2 ? .45 : .56, o = sPos([Math.cos(a) * r, .85, Math.sin(a) * r], .1), s = i % 2 ? .75 : 1.1;
      return [new THREE.ConeGeometry(.065, .36, 6), i % 2 ? '#e0f2fe' : '#bae6fd', MQn(o.p, o.n, s, s, s, a)];
    }).concat([[new THREE.ConeGeometry(.085, .5, 6), '#f0f9ff', M4(0, SL_H + .2, 0)]]), true), 'gm', phys({ roughness: .04, emissive: '#7dd3fc', emissiveIntensity: .3, flatShading: true }));
  } else if (sp.id === 'aurora') {
    add('g', () => mergeParts([[new THREE.CylinderGeometry(.014, .02, .36, 6), '#c4b5fd', M4(0, SL_H + .16, 0)], [new THREE.OctahedronGeometry(.085), '#fde047', M4(0, SL_H + .4, 0, .3, .5, 0)]], true), 'gm', () => new THREE.MeshBasicMaterial({ vertexColors: true }));
    ud.orbit = add('o', () => mergeParts(['#22d3ee', '#a78bfa', '#34d399', '#f0abfc'].map((c, i) => [new THREE.SphereGeometry(.06, 10, 8), c, M4(Math.cos(i / 4 * PI2) * 1.3, Math.sin(i * 2) * .18, Math.sin(i / 4 * PI2) * 1.3)]), true), 'om', () => new THREE.MeshBasicMaterial({ vertexColors: true }), 0, .75, 0);
    ud.orbit.castShadow = false;
  }
  if (sp.rar >= 3) {
    ud.halo = mesh(once('h', () => new THREE.TorusGeometry(.3, .026, 10, 48).rotateX(Math.PI / 2)), once('hm', () => new THREE.MeshBasicMaterial({ color: sp.rar >= 4 ? '#fde047' : '#f0abfc' })), 0, SL_H + .45, 0, F);
  }
}
function slimeMesh(sp) {
  const L0 = SLOOK[sp.id] || SLOOK.grass, g = new THREE.Group(), col = new THREE.Color(sp.color), C = k => new THREE.Color(k);
  const c1 = col.clone().offsetHSL(rnd(-.012, .012), rnd(-.04, .04), rnd(-.025, .025));
  const U = {
    uT: { value: 0 }, uSq: { value: new THREE.Vector4(1, 0, 0, 0) }, uDent: { value: new THREE.Vector4(0, .7, 1, 0) }, uRip: { value: new THREE.Vector4(9, 0, .012, rnd(0, 6)) },
    uC1: { value: c1 }, uC2: { value: C(L0.c2) }, uC3: { value: C(L0.deep) }, uLine: { value: C(L0.deep).multiplyScalar(.3) }, uIris: { value: C(L0.iris) },
    uRimC: { value: C(L0.rim).lerp(c1, .45) }, uSSS: { value: c1.clone().multiplyScalar(.7) }, uCoreC: { value: C(L0.core) }, uCam: { value: new THREE.Vector3(0, 2, 5) },
    uFace: { value: new THREE.Vector4() }, uFace2: { value: new THREE.Vector4(0, 0, 0, .5) }, uCore: { value: new THREE.Vector4(sp.rar >= 3 ? .9 : .55, 1, 0, 0) },
    uMisc: { value: new THREE.Vector4(L0.pat, .88, 0, 0) },
    uBub: { value: [0, 1, 2, 3].map(() => new THREE.Vector4(rnd(-.35, .35), Math.random(), rnd(-.3, .25), rnd(.035, .075))) },
  };
  const body = new THREE.Mesh(slimeGeo(), slimeMat(U)); body.castShadow = !LOW; body.receiveShadow = !LOW; if (!LOW) body.customDepthMaterial = slimeDepthMat(U); g.add(body);
  const F = new THREE.Group(); F.matrixAutoUpdate = false; body.add(F);
  const ud = { body, U, F };
  slimeFeat(sp, F, ud);
  ud.shadow = blobShadow(1.1, g, .03); ud.shadow.renderOrder = -1;
  body.userData.slimeRoot = g; Object.assign(g.userData, ud); return g;
}
/* ---------- 表情泡泡 ---------- */
const EMO = {};
function emoTex(k) {
  if (EMO[k]) return EMO[k];
  const c = document.createElement('canvas'); c.width = c.height = 128; const g = c.getContext('2d');
  const bubble = () => { g.beginPath(); g.arc(64, 54, 44, 0, PI2); g.moveTo(48, 90); g.lineTo(60, 120); g.lineTo(80, 90); g.closePath(); };
  g.lineJoin = 'round'; bubble(); g.lineWidth = 10; g.strokeStyle = 'rgba(15,23,42,.85)'; g.stroke(); g.fillStyle = '#ffffff'; bubble(); g.fill();
  g.textAlign = 'center'; g.textBaseline = 'middle';
  if (k === 'bang') { g.fillStyle = '#f59e0b'; g.beginPath(); g.roundRect ? g.roundRect(56, 22, 16, 44, 8) : g.rect(56, 22, 16, 44); g.fill(); g.beginPath(); g.arc(64, 80, 8.5, 0, PI2); g.fill(); }
  else if (k === 'q') { g.fillStyle = '#3b82f6'; g.font = '900 70px Inter,"Noto Sans TC",sans-serif'; g.fillText('?', 64, 58); }
  else if (k === 'heart') { g.fillStyle = '#f43f5e'; g.beginPath(); g.moveTo(64, 84); g.bezierCurveTo(26, 60, 30, 26, 52, 28); g.bezierCurveTo(60, 29, 64, 36, 64, 40); g.bezierCurveTo(64, 36, 68, 29, 76, 28); g.bezierCurveTo(98, 26, 102, 60, 64, 84); g.fill(); g.fillStyle = '#ffffff99'; g.beginPath(); g.ellipse(50, 42, 7, 5, -.6, 0, PI2); g.fill(); }
  else if (k === 'zz') { g.fillStyle = '#6366f1'; g.font = '900 46px Inter,sans-serif'; g.fillText('Z', 52, 62); g.font = '900 30px Inter,sans-serif'; g.fillText('z', 82, 38); }
  else if (k === 'note') { g.fillStyle = '#a855f7'; g.beginPath(); g.ellipse(52, 76, 13, 10, -.4, 0, PI2); g.fill(); g.fillRect(61, 26, 7, 50); g.beginPath(); g.moveTo(68, 26); g.quadraticCurveTo(92, 34, 84, 56); g.quadraticCurveTo(84, 42, 68, 42); g.fill(); }
  else if (k === 'sweat') { g.fillStyle = '#38bdf8'; g.beginPath(); g.moveTo(64, 20); g.quadraticCurveTo(88, 52, 82, 70); g.arc(64, 68, 18, .1, Math.PI - .1); g.quadraticCurveTo(40, 52, 64, 20); g.fill(); g.fillStyle = '#ffffffb0'; g.beginPath(); g.ellipse(57, 60, 4, 8, .3, 0, PI2); g.fill(); }
  else if (k === 'star') { g.fillStyle = '#fbbf24'; g.beginPath(); for (let i = 0; i < 10; i++) { const r = i % 2 ? 16 : 36, a = -Math.PI / 2 + i * Math.PI / 5; g.lineTo(64 + Math.cos(a) * r, 56 + Math.sin(a) * r); } g.closePath(); g.fill(); }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return EMO[k] = t;
}
function emote(s, k, dur = 1.7) {
  let e = s.emo;
  if (!e) { const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: emoTex(k), transparent: true, depthWrite: false, fog: false })); sp.renderOrder = 3; s.m.add(sp); e = s.emo = { sp, t: 0, dur: 0, k }; }
  if (e.k !== k) { e.sp.material.map = emoTex(k); e.k = k; }
  e.t = 0; e.dur = dur; e.sp.visible = true;
}
function emoteStep(s, dt) {
  const e = s.emo; if (!e || !e.sp.visible) return; e.t += dt;
  const a = Math.min(1, e.t / .18), pop = a < 1 ? .3 + .7 * a + .35 * Math.sin(a * Math.PI) : 1;
  e.sp.scale.setScalar(.7 * pop); e.sp.material.opacity = clamp((e.dur - e.t) / .3, 0, 1);
  e.sp.position.set(0, SL_H * s.sqY + .6 + s.air / s.sc + Math.sin(e.t * 4) * .03, 0);
  if (e.t >= e.dur) e.sp.visible = false;
}
const emoteOn = s => s.emo && s.emo.sp.visible;
/* ---------- 黏液粒子（受擊飛濺、落地成小水窪、採集時飛進手裡） ---------- */
function makeGoo(scene) {
  const N = LOW ? 90 : 180, geo = new THREE.IcosahedronGeometry(1, 1), mat = new THREE.MeshPhysicalMaterial({ roughness: .12, clearcoat: 1, clearcoatRoughness: .08, emissive: '#ffffff', emissiveIntensity: .05 });
  const im = new THREE.InstancedMesh(geo, mat, N); im.instanceMatrix.setUsage(THREE.DynamicDrawUsage); im.frustumCulled = false;
  const Z = new THREE.Matrix4().makeScale(0, 0, 0), c = new THREE.Color('#ffffff');
  for (let i = 0; i < N; i++) { im.setMatrixAt(i, Z); im.setColorAt(i, c); } scene.add(im);
  const ps = Array.from({ length: N }, () => ({ life: 0 })), m = new THREE.Matrix4(), q = new THREE.Quaternion(), v = new THREE.Vector3(), sc = new THREE.Vector3(), eu = new THREE.Euler();
  const G0 = { im, k: 0, any: false, got: 0 };
  G0.emit = (pos, n, color, o = {}) => {
    const gy = o.gy ?? pos.y - 1;
    for (let j = 0; j < n; j++) {
      const i = G0.k = (G0.k + 1) % N, p = ps[i], a = rnd(0, PI2), sp = o.speed ?? rnd(1, 2.8);
      Object.assign(p, { x: pos.x + rnd(-.08, .08), y: pos.y + rnd(-.05, .1), z: pos.z + rnd(-.08, .08), vx: Math.cos(a) * sp + (o.dx || 0), vy: o.up ?? rnd(2.2, 4.8), vz: Math.sin(a) * sp + (o.dz || 0), s: o.size ?? rnd(.045, .1), life: 1, max: rnd(1.1, 1.7), gy, mode: o.collect ? 1 : 0, delay: o.collect ? .18 + j * .04 : 0, spl: 0, rx: rnd(0, 6), ry: rnd(0, 6) });
      im.setColorAt(i, c.set(color).offsetHSL(0, rnd(-.05, .05), rnd(-.06, .14)));
    }
    im.instanceColor.needsUpdate = true; G0.any = true;
  };
  G0.update = (dt, tgt) => {
    if (!G0.any) return; let alive = 0;
    for (let i = 0; i < N; i++) {
      const p = ps[i]; if (p.life <= 0) continue;
      let sx = 1, sy = 1;
      if (p.mode === 1 && (p.delay -= dt) <= 0 && tgt) {
        const dx = tgt.x - p.x, dy = tgt.y - p.y, dz = tgt.z - p.z, d = Math.hypot(dx, dy, dz) || 1, k = 26 + Math.max(0, -p.delay) * 30;
        p.vx += dx / d * k * dt; p.vy += dy / d * k * dt; p.vz += dz / d * k * dt; const dmp = Math.exp(-dt * 5); p.vx *= dmp; p.vy *= dmp; p.vz *= dmp;
        if (d < .22 || p.delay < -1.6) { p.life = 0; G0.got++; im.setMatrixAt(i, Z); continue; }
      } else if (!p.spl) {
        p.vy -= 14 * dt;
        if (p.y + p.vy * dt <= p.gy + p.s * .3 && p.mode === 0) { p.spl = 1; p.y = p.gy + .01; p.vx = p.vy = p.vz = 0; }
      }
      p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt;
      if (p.spl) { p.life -= dt / p.max * 1.6; sx = 1.5 + (1 - p.life) * .6; sy = .22; }
      else if (p.mode === 0) { p.life -= dt / p.max * .35; const sp = Math.hypot(p.vx, p.vy, p.vz); sy = 1 + Math.min(.6, sp * .06); sx = 1 / Math.sqrt(sy); }
      const k = p.s * Math.min(1, p.life * 3); eu.set(p.spl ? 0 : p.rx, p.ry, 0); q.setFromEuler(eu);
      m.compose(v.set(p.x, p.y, p.z), q, sc.set(k * sx, k * sy, k * sx)); im.setMatrixAt(i, p.life > 0 ? m : Z); if (p.life > 0) alive++;
    }
    im.instanceMatrix.needsUpdate = true; if (!alive) G0.any = false;
    const got = G0.got; G0.got = 0; return got;
  };
  return G0;
}
/* ---------- 生成 ---------- */
function zoneSpawn(zid) {
  for (let k = 0; k < 80; k++) {
    let x, z;
    if (zid === 'forest') { x = rnd(-44, 44) * K; z = rnd(-44, 44) * K; if (Math.hypot(x, z) < 22) continue; }
    else if (zid === 'coast') { x = rnd(62, 124) * K; z = rnd(-50, 50) * K; if (Math.abs(z) > x - 12 * K) continue; }
    else if (zid === 'volcano') { x = rnd(-50, 50) * K; z = rnd(-62, -155) * K; if (Math.hypot(x, z + 130 * K) < 40 * K || Math.abs(x) > -z - 12 * K) continue; }
    else { x = rnd(-62, -160) * K; z = rnd(-50, 50) * K; if (Math.abs(z) > -x - 12 * K) continue; }
    const h = H(x, z); if (h < 0 || h > 10 * K) continue; return [x, z];
  }
  return [0, 30];
}
function newSlime(sp, m, o) {
  return Object.assign({
    sp, m, U: m.userData.U, x: 0, z: 0, vx: 0, vz: 0, yaw: rnd(0, 6), ph: rnd(0, 6), hits: 0, cool: 0, sq: 0, happy: 0, blink: rnd(1, 4), turn: rnd(.3, 3), flee: 0,
    air: 0, vy: 0, hvx: 0, hvz: 0, crouch: 0, rest: rnd(0, .5), sqY: 1, sqV: 0, lx: 0, lz: 0, lvx: 0, lvz: 0, spread: 0, dent: 0, dentV: 0, rip: 9, ripA: 0,
    sur: 0, hap: 0, slp: 0, mouth: 0, lookX: 0, lookY: 0, lkx: 0, lky: 0, lookT: 0, hov: 0, noticed: false, emo: null, wSpd: 0, wa: 0,
    pers: sp.rar >= 3 ? 'shy' : (Math.random() < .32 ? 'curious' : 'calm'), lastHit: 0, perf: 0, zzT: rnd(0, 2),
  }, o);
}
function spawnSlime(zid, home) {
  const list = SPECIES.filter(s => s.zone === zid); let r = Math.random() * list.reduce((a, s) => a + s.w, 0), sp = list[0];
  for (const s of list) { if ((r -= s.w) <= 0) { sp = s; break; } }
  const [hx, hz] = home || zoneSpawn(zid), m = slimeMesh(sp);
  const sl = newSlime(sp, m, { id: ++W.sid, sc: rnd(.66, .86), zid, hx, hz, x: hx + rnd(-3, 3), z: hz + rnd(-3, 3) });
  m.scale.setScalar(sl.sc); m.userData.body.userData.sl = sl; W.scene.add(m); W.slimes.push(sl); return sl;
}
function spawnZone(zid) { if (W.spawned.has(zid)) return; W.spawned.add(zid); const n = LOW ? 18 : 28; for (let i = 0; i < n; i++) spawnSlime(zid); }
function spawnAllSlimes() { S.zones.forEach(spawnZone); }
/* ---------- 行為與動畫 ---------- */
function moveSlime(s, dx, dz) {
  const nx = s.x + dx, nz = s.z + dz, nh = H(nx, nz);
  if (nh > -.1 && Math.abs(nh - H(s.x, s.z)) < .5 && Math.hypot(nx, nz) > WS_R + 1) { s.x = nx; s.z = nz; return true; }
  s.turn = 0; s.wa += Math.PI * rnd(.6, 1.4); s.hvx *= -.25; s.hvz *= -.25; return false;
}
const slPitch = s => clamp(1.25 - (s.sc - .66) * 1.6, .85, 1.3) * ({ lava: .82, obsid: .78, ice: 1.15, salt: 1.08, aurora: 1.1 }[s.sp.id] || 1);
let boingT = 0;
function slimeStep(dt, t) {
  boingT -= dt; const cam = W.cam.position, sneak = !!(P && P.sneak), running = !!(P && P.running && Math.hypot(P.vx || 0, P.vz || 0) > 5);
  W.slimes.forEach(s => {
    if (!s.mirror) { s.cool = Math.max(0, s.cool - dt); if (s.hits > 0 && (s.since = (s.since || 0) + dt) > 10) { s.hits = 0; s.perf = 0; } }
    s.sq = Math.max(0, s.sq - dt * 3); s.happy = Math.max(0, s.happy - dt);
    const dx = s.x - P.x, dz = s.z - P.z, dist = Math.hypot(dx, dz); s.m.visible = dist < 62;
    if (!s.m.visible) { s.noticed = false; s.flee = 0; return; }
    const cool = s.cool > 0, ud = s.m.userData, U = s.U;
    let wx = 0, wz = 0, spd = 0;
    // ---- 注意到玩家（潛行時很難被發現；奔跑時很遠就會被發現） ----
    const nR = (sneak ? 3 : running ? 11 : 7) * (s.sp.rar >= 4 ? 1.3 : 1);
    if (!TITLE.on && !cool && dist < nR && !s.noticed) {
      s.noticed = true; s.sur = Math.max(s.sur, .7);
      if (s.pers === 'shy' && !sneak) emote(s, 'sweat'); else if (s.pers === 'curious') emote(s, 'q', 1.3); else if (Math.random() < .45) emote(s, 'bang', 1.1);
      if (dist < 10) sfx.notice(1 - dist / 10);
    } else if (s.noticed && dist > nR + 5) s.noticed = false;
    if (!s.mirror) {
      s.turn -= dt; s.flee = Math.max(0, s.flee - dt);
      if (cool) { s.wSpd = 0; }
      else if (s.flee > 0 || (s.noticed && s.pers === 'shy' && !sneak && dist < nR + 2)) {
        if (s.flee <= 0) s.flee = rnd(2.2, 3.2);
        wx = dx / (dist || 1); wz = dz / (dist || 1); spd = 3.2;
        const hd = Math.hypot(s.hx - s.x, s.hz - s.z); if (hd > 16) { wx = wx * .35 + (s.hx - s.x) / hd * .65; wz = wz * .35 + (s.hz - s.z) / hd * .65; const l = Math.hypot(wx, wz) || 1; wx /= l; wz /= l; }
      } else if (s.noticed && s.pers === 'curious' && !running) {
        if (dist > 2.7) { wx = -dx / dist; wz = -dz / dist; spd = 1.15; }
        else if (!s.air && !s.crouch && s.rest <= 0 && Math.random() < dt * .35) { s.hopInPlace = true; if (!emoteOn(s)) emote(s, Math.random() < .55 ? 'heart' : 'note'); }
      } else {
        if (s.turn < 0) { s.turn = rnd(1.5, 4.5); const far = Math.hypot(s.hx - s.x, s.hz - s.z) > 9; s.wa = far ? Math.atan2(s.hz - s.z, s.hx - s.x) + rnd(-.4, .4) : rnd(0, PI2); s.wSpd = Math.random() < .35 ? 0 : rnd(.5, 1); }
        if (s.wSpd) { wx = Math.cos(s.wa); wz = Math.sin(s.wa); spd = s.wSpd; }
      }
    } else {
      // 鏡像（多人連線的客戶端）：位置由房主決定，只在本地做跳躍動畫
      const mx = s.tx - s.x, mz = s.tz - s.z, k = Math.min(1, dt * 6), ml = Math.hypot(mx, mz); s.x += mx * k; s.z += mz * k;
      if (ml > .04) { wx = mx / ml; wz = mz / ml; spd = 1; }
    }
    // ---- 跳躍移動：蓄力 → 起跳（伸長）→ 落地（壓扁、攤開、餘震） ----
    const GR = 12;
    if (s.air > 0) {
      s.vy -= GR * dt; s.air += s.vy * dt;
      if (!s.mirror && (s.hvx || s.hvz)) moveSlime(s, s.hvx * dt, s.hvz * dt);
      if (s.air <= 0) {
        const imp = Math.min(1.4, -s.vy / 4.5); s.air = 0; s.vy = 0; s.sqV -= 3.3 * imp; s.spread += .2 * imp; s.lvx += s.hvx * .45; s.lvz += s.hvz * .45;
        s.rest = s.flee > 0 ? rnd(.03, .1) : rnd(.12, .55); s.hvx = s.hvz = 0; s.hopInPlace = false;
        if (dist < 9 && boingT <= 0 && !TITLE.on) { sfx.boing(slPitch(s), (1 - dist / 9) * imp); boingT = .06; }
      }
    } else {
      s.rest -= dt;
      if (s.crouch > 0) {
        s.crouch -= dt;
        if (s.crouch <= 0) {
          const big = s.flee > 0 ? 1.12 : 1; s.vy = (s.hopInPlace ? 3.3 : rnd(3.4, 4.2)) * big; s.air = .001;
          const air = 2 * s.vy / GR, hs = s.hopInPlace ? 0 : spd * (air + .4) / air; s.hvx = wx * hs; s.hvz = wz * hs;
          s.sqV += 3.2; s.lvx -= s.hvx * .3; s.lvz -= s.hvz * .3;
        }
      } else if ((spd > 0 || s.hopInPlace) && s.rest <= 0 && !cool) s.crouch = s.flee > 0 ? .07 : .13;
    }
    // ---- 朝向 ----
    let want = s.yaw;
    if (spd > 0 && !s.hopInPlace) want = Math.atan2(wx, wz); else if (s.noticed || dist < 6) want = Math.atan2(-dx, -dz);
    let dy = want - s.yaw; dy = Math.atan2(Math.sin(dy), Math.cos(dy)); s.yaw += dy * Math.min(1, dt * (s.air > 0 ? 2.5 : 6));
    // ---- 彈簧：擠壓、傾斜、凹陷 ----
    let sqT = 1 + (cool ? Math.sin(t * 1.6 + s.ph) * .035 - .08 : Math.sin(t * 2.4 + s.ph) * .02);
    if (s.crouch > 0) sqT = .74; else if (s.air > 0) sqT = 1 + clamp(s.vy * .035, -.05, .14);
    const n = Math.max(1, Math.ceil(dt / .016)), h = dt / n;
    for (let i = 0; i < n; i++) {
      s.sqV += ((sqT - s.sqY) * 150 - s.sqV * 8) * h; s.sqY += s.sqV * h;
      s.lvx += (-s.lx * 95 - s.lvx * 6.5) * h; s.lx += s.lvx * h; s.lvz += (-s.lz * 95 - s.lvz * 6.5) * h; s.lz += s.lvz * h;
      s.dentV += (-s.dent * 120 - s.dentV * 9) * h; s.dent += s.dentV * h;
    }
    s.sqY = clamp(s.sqY, .55, 1.5); s.lx = clamp(s.lx, -.45, .45); s.lz = clamp(s.lz, -.45, .45); s.dent = clamp(s.dent, -.12, .3);
    s.spread *= Math.exp(-dt * 6); s.rip += dt; s.ripA *= Math.exp(-dt * 2.5);
    // ---- 表情 ----
    s.sur = Math.max(0, s.sur - dt * 2); s.hap = Math.max(0, s.hap - dt); s.slp += ((cool ? 1 : 0) - s.slp) * Math.min(1, dt * 3);
    s.blink -= dt; const bl = s.blink < .13 ? 1 - Math.abs(s.blink - .065) / .065 : 0; if (s.blink < 0) s.blink = Math.random() < .2 ? .2 : rnd(1.8, 5);
    const c = Math.cos(s.yaw), sn = Math.sin(s.yaw), gy = G(s.x, s.z), by = s.air / s.sc - .03;
    const vx = cam.x - s.x, vz = cam.z - s.z, vl = Math.hypot(vx, vz) || 1, lxL = c * vx - sn * vz;
    s.lookT -= dt;
    if ((s.noticed || dist < 6) && !cool) { s.lkx = clamp(lxL / vl * 1.6, -1, 1); s.lky = clamp((cam.y - gy - (.65 + by) * s.sc) / vl * 1.2, -1, 1); }
    else if (s.lookT < 0) { s.lookT = rnd(.7, 2.4); s.lkx = rnd(-.8, .8); s.lky = rnd(-.5, .35); }
    const lk = Math.min(1, dt * 12); s.lookX += (s.lkx - s.lookX) * lk; s.lookY += (s.lky - s.lookY) * lk;
    const mT = s.hap > 0 ? .95 : s.sur > .35 ? .85 : (s.flee > 0 ? .5 : (s.noticed && s.pers === 'curious' ? .3 : 0)); s.mouth += (mT - s.mouth) * Math.min(1, dt * 10);
    s.hov += ((TARGET && TARGET.sl === s ? 1 : 0) - s.hov) * Math.min(1, dt * 10);
    if (cool && (s.zzT -= dt) < 0) { s.zzT = rnd(2.2, 3.2); if (dist < 25) emote(s, 'zz', 1.8); }
    // ---- 寫入著色器 ----
    const lnx = c * s.lx - sn * s.lz, lnz = sn * s.lx + c * s.lz;
    U.uT.value = t; U.uSq.value.set(s.sqY, lnx, lnz, s.spread + (cool ? .06 : .02)); U.uDent.value.w = s.dent; U.uRip.value.x = s.rip; U.uRip.value.y = s.ripA;
    U.uFace.value.set(bl, clamp(s.hap / .35, 0, 1), clamp(s.sur, 0, 1), s.slp); U.uFace2.value.set(s.lookX, s.lookY, s.mouth, .42 + clamp(s.hap, 0, 1) * .5 + s.hov * .15);
    U.uMisc.value.y = cool ? .74 : .88; U.uMisc.value.z = s.hov; U.uMisc.value.w = s.slp;
    const cx = vx / s.sc, cy = (cam.y - gy) / s.sc - by, cz = vz / s.sc; U.uCam.value.set(c * cx - sn * cz, cy, sn * cx + c * cz);
    s.m.position.set(s.x, gy, s.z); s.m.rotation.y = s.yaw; ud.body.position.y = by;
    const sxz = 1 / Math.sqrt(Math.max(s.sqY, .3)); ud.F.matrix.set(sxz, lnx / SL_H, 0, 0, 0, s.sqY, 0, 0, 0, lnz / SL_H, sxz, 0, 0, 0, 0, 1); ud.F.matrixWorldNeedsUpdate = true;
    const sh = ud.shadow, k = Math.max(.45, 1 - s.air * .5); sh.scale.setScalar(k * (1 + s.spread * .8) * sxz); sh.material.opacity = clamp(1 - s.air * .9, .25, 1);
    if (ud.sprout) ud.sprout.rotation.set(Math.sin(t * 1.7 + s.ph) * .08 + lnz * .8, 0, Math.sin(t * 2.3 + s.ph) * .1 - lnx * .8);
    if (ud.flame) ud.flame.scale.set(1 + Math.sin(t * 13 + s.ph) * .14, 1 + Math.sin(t * 9 + s.ph) * .28 + (s.hap > 0 ? .5 : 0), 1 + Math.cos(t * 11 + s.ph) * .14);
    if (ud.orbit) ud.orbit.rotation.y = t * 1.5;
    if (ud.halo) { ud.halo.rotation.y = t; ud.halo.position.y = SL_H + .45 + Math.sin(t * 2 + s.ph) * .05; }
    emoteStep(s, dt);
  });
}
/* ---------- 受擊 ---------- */
function slimeHitCore(sl) { if (sl.cool > 0) return { res: 'shy' }; sl.hits++; sl.sq = 1; sl.since = 0; if (sl.hits >= 3) { sl.cool = 6; sl.hits = 0; sl.happy = .6; return { res: 'harvest' }; } return { res: 'hit', hits: sl.hits }; }
function slimeReact(sl, local, kind) {
  const dx = sl.x - P.x, dz = sl.z - P.z, d = Math.hypot(dx, dz) || 1, U = sl.U;
  if (local) U.uDent.value.set(local.x, local.y, local.z, U.uDent.value.w); else U.uDent.value.set(0, .75, .95, U.uDent.value.w);
  sl.noticed = true;
  if (kind === 'shy') { sl.dentV += 1.4; sl.sqV -= 1.2; sl.rip = 0; sl.ripA = .02; sl.sur = .45; if (!emoteOn(sl)) emote(sl, 'zz', 1.4); return; }
  sl.dentV += 3.6; sl.rip = 0; sl.ripA = .05; sl.sqV -= 3.4; sl.lvx += dx / d * 1.8; sl.lvz += dz / d * 1.8; sl.sur = 1;
  if (kind === 'harvest') { sl.hap = 1.6; sl.sur = 0; if (!(sl.air > 0)) { sl.vy = 4.5; sl.air = .001; sl.hvx = sl.hvz = 0; sl.sqV += 4; } emote(sl, 'heart'); }
  else if (!(sl.air > 0)) { sl.vy = 2; sl.air = .001; if (!sl.mirror) { sl.hvx = dx / d * 1.4; sl.hvz = dz / d * 1.4; } }
}
function hitSlime(sl, pt) {
  const now = performance.now() / 1000, gap = now - (sl.lastHit || 0); sl.lastHit = now;
  sl.perf = sl.hits > 0 && sl.cool <= 0 && gap > .24 && gap < .46 ? (sl.perf || 0) + 1 : 0;
  const local = pt ? sl.m.userData.body.worldToLocal(pt.clone()) : null;
  if (sl.mirror) { netSend({ t: 'hit', id: sl.id }); slimeReact(sl, local, sl.cool > 0 ? 'shy' : 'hit'); sl.sq = 1; sfx.squish(.6, slPitch(sl)); splashAt(sl, pt, 6); return; }
  applyHit(sl, slimeHitCore(sl), local, pt);
}
function splashAt(sl, pt, n) {
  if (!W.goo) return; const p = pt ? pt.clone() : sl.m.position.clone().setY(sl.m.position.y + .7 * sl.sc), dx = sl.x - P.x, dz = sl.z - P.z, d = Math.hypot(dx, dz) || 1;
  W.goo.emit(p, n, sl.sp.color, { gy: sl.m.position.y + .02, dx: -dx / d * .8, dz: -dz / d * .8 });
}
function applyHit(sl, r, local, pt, remote) {
  const top = sl.m.position.clone().setY(sl.m.position.y + (SL_H + .35) * sl.sc);
  if (r.res === 'shy') { if (!remote) slimeReact(sl, local, 'shy'); fx3(top, `休息中，${Math.max(1, Math.ceil(sl.cool || 0))} 秒後恢復`, '#93c5fd'); sfx.squish(.35, slPitch(sl) * .9); ringPulse('cool'); return; }
  if (!remote) { slimeReact(sl, local, r.res); splashAt(sl, pt, r.res === 'harvest' ? 12 : 7); sfx.squish(.85, slPitch(sl)); }
  if (navigator.vibrate) navigator.vibrate(r.res === 'harvest' ? [10, 30, 14] : 8);
  const perfect = sl.perf > 0;
  if (r.res === 'harvest') {
    const bonus = sl.perf >= 2 ? 1 : 0, n = 1 + S.up.net + bonus; sl.happy = .6; S.gel[sl.sp.id] = (S.gel[sl.sp.id] || 0) + n; discover(sl.sp.id);
    fx3(top, `+${n} ${short(sl.sp.id)}凝膠`, sl.sp.color, 'big'); sfx.pop();
    if (bonus) { setTimeout(() => fx3(top.clone().setY(top.y + .5), '完美節奏！額外 +1', '#f0abfc', 'big'), 220); sfx.perfect(); if (!emoteOn(sl) || sl.emo.k !== 'star') emote(sl, 'star'); }
    if (W.goo) W.goo.emit(sl.m.position.clone().setY(sl.m.position.y + .7 * sl.sc), 3 + n * 3, sl.sp.color, { collect: true, size: .07, up: 3.5, speed: 1.2 });
    toast(`採集到 ${n} 份${SP[sl.sp.id].name}凝膠${bonus ? '（完美節奏加成）' : ''}`); renderHotbar(true); sl.perf = 0;
    if (!S.tipRhythm) { S.tipRhythm = true; setTimeout(() => toast('小技巧：每一下之間抓穩節奏（約 0.3 秒）連續捏，三下都完美可多得 1 份凝膠'), 1500); }
  } else { fx3(top, `${short(sl.sp.id)} ${r.hits}/3${perfect ? ' 完美！' : ''}`, perfect ? '#f0abfc' : RAR[sl.sp.rar].c); if (perfect) sfx.perfect(); }
  ringPulse(perfect ? 'perf' : 'hit');
}

/* ============================================================
   玩家（第一人稱）與輸入
   ============================================================ */
let P = null;
const KEYS = new Set(), IN = { joy: null, jx: 0, jy: 0, run: false, sneak: false, look: null, drag: null, hold: false, holdE: false, holdT: .55 };
const SENS = [.0016, .0025, .0038], SENS_N = ['低', '中', '高'];
function initPlayer() {
  let sp = S.pos && isFinite(S.pos.x) && isFinite(S.pos.z) ? S.pos : { x: 0, z: 16, yaw: 0 };
  if (!inCity(sp.x) && !regionOK(sp.x, sp.z)) sp = { x: 0, z: 16, yaw: 0 };
  P = { x: sp.x, z: sp.z, y: G(sp.x, sp.z), vy: 0, vx: 0, vz: 0, yaw: sp.yaw || 0, pitch: -.08, ground: true, r: .35, eye: 1.62, camY: G(sp.x, sp.z), bob: 0, stepT: 0, coy: 0, jb: 0, sneak: false, running: false, dip: 0, dipV: 0, roll: 0 };
}
// 腳下的地面材質（決定腳步聲）
function surfaceAt(x, z) {
  if (inCity(x)) return 'city'; if (onPath(x, z) > .5) return 'dirt';
  const b = domBiome(x, z); if (b === 'snow') return 'snow'; if (b === 'volcano') return 'rock'; if (b === 'coast' && H(x, z) < 1.5 * K) return 'sand'; return 'grass';
}
const locked = () => document.pointerLockElement === $('#worldCv');
let HINT0 = '';
function showFreeHint() { const h = $('#startHint'); if (!HINT0) HINT0 = h.innerHTML; h.innerHTML = '<b>滑鼠已解鎖（遊戲繼續進行）</b><br>按 Alt 或點擊畫面回到操控'; h.hidden = false; }
function restoreHint() { if (HINT0) $('#startHint').innerHTML = HINT0; }
function lockMouse() { if (TOUCH || GUI.kind || TITLE.on || CHAT.open || !$('#modal').hidden) return; try { const r = $('#worldCv').requestPointerLock(); if (r && r.catch) r.catch(() => { }); } catch (e) { } }
function unlockMouse() { if (locked()) { W.unlockByUs = true; document.exitPointerLock(); } }
function bindInput() {
  const cv = $('#worldCv');
  addEventListener('keydown', e => {
    if (e.target.tagName === 'INPUT') return;
    const k = e.code; if (!$('#modal').hidden || TITLE.on) return;
    if (k === 'Escape') { if (GUI.kind) closeGui(); else openGui('pause'); return; }
    // Alt：暫時解鎖滑鼠但不暫停遊戲；再按一次 Alt 或點擊畫面就回到操控
    if (k === 'AltLeft' || k === 'AltRight') { e.preventDefault(); if (GUI.kind || TOUCH) return; if (locked()) { W.altFree = true; unlockMouse(); showFreeHint(); } else { W.altFree = false; lockMouse(); } return; }
    if ((k === 'KeyT' || k === 'Enter') && NET.on && !GUI.kind) { e.preventDefault(); openChat(); return; }
    if (k === 'KeyI' || k === 'Tab') { e.preventDefault(); GUI.kind === 'inv' ? closeGui() : openGui('inv'); return; }
    if (GUI.kind) {
      if (GUI.kind === 'line' && M.active) { if (k === 'Space') { e.preventDefault(); if (!e.repeat) { makeAction('tap'); makeAction('hold', true); } } if (k === 'ArrowLeft' || k === 'KeyA') M.kdir = -1; if (k === 'ArrowRight' || k === 'KeyD') M.kdir = 1; }
      if (k === 'KeyE' && GUI.kind !== 'line' && !e.repeat) closeGui(); return;
    }
    KEYS.add(k); if (k === 'Space') { e.preventDefault(); if (!e.repeat) jump(); }
    if ((k === 'KeyE' || k === 'KeyF') && !e.repeat) { act(); IN.holdE = true; IN.holdT = .55; }
    if (/^Digit[1-9]$/.test(k)) { S.hb = +k.slice(5) - 1; renderHotbar(true); }
  });
  addEventListener('keyup', e => { KEYS.delete(e.code); if (e.code === 'Space') makeAction('hold', false); if (e.code === 'KeyE' || e.code === 'KeyF') IN.holdE = false; if (['ArrowLeft', 'KeyA', 'ArrowRight', 'KeyD'].includes(e.code)) M.kdir = 0; });
  addEventListener('blur', () => { KEYS.clear(); IN.hold = IN.holdE = false; });
  cv.addEventListener('contextmenu', e => e.preventDefault());
  cv.addEventListener('wheel', e => { if (GUI.kind) return; S.hb = (S.hb + (e.deltaY > 0 ? 1 : 8)) % 9; renderHotbar(true); }, { passive: true });
  addEventListener('keyup', e => { if (e.code === 'AltLeft' || e.code === 'AltRight') e.preventDefault(); });
  document.addEventListener('pointerlockchange', () => {
    if (locked()) { W.altFree = false; restoreHint(); }
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
      if (locked()) { if (e.button === 0 || e.button === 2) { act(); IN.hold = true; IN.holdT = .55; } return; }
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
    if (e.pointerType === 'mouse') IN.hold = false;
    if (e.pointerType === 'touch') return;
    if (IN.joy && e.pointerId === IN.joy.id) { IN.joy = null; IN.jx = IN.jy = 0; $('#joyKnob').style.transform = ''; $('#joyBase').classList.remove('on'); }
    if (IN.look && e.pointerId === IN.look.id) { const L0 = IN.look; IN.look = null; if (L0.moved < 12 && performance.now() - L0.t < 350 && !GUI.kind) actAt(L0.sx, L0.sy); }
    if (IN.drag && e.pointerId === IN.drag.id) { const d = IN.drag; IN.drag = null; if (d.moved < 6 && !locked() && !GUI.kind) actAt(d.x, d.y); }
  };
  addEventListener('pointerup', up); addEventListener('pointercancel', up);
  $('#btnJump').addEventListener('pointerdown', e => { e.preventDefault(); e.stopPropagation(); jump(); });
  $('#btnAct').addEventListener('pointerdown', e => { e.preventDefault(); e.stopPropagation(); try { audio(); } catch (_) { } act(); IN.hold = true; IN.holdT = .55; });
  ['pointerup', 'pointercancel', 'pointerleave'].forEach(ev => $('#btnAct').addEventListener(ev, () => { IN.hold = false; }));
  $('#btnRun').addEventListener('pointerdown', e => { e.preventDefault(); e.stopPropagation(); IN.run = !IN.run; if (IN.run) { IN.sneak = false; $('#btnSneak').classList.remove('on'); } $('#btnRun').classList.toggle('on', IN.run); });
  $('#btnSneak').addEventListener('pointerdown', e => { e.preventDefault(); e.stopPropagation(); IN.sneak = !IN.sneak; if (IN.sneak) { IN.run = false; $('#btnRun').classList.remove('on'); } $('#btnSneak').classList.toggle('on', IN.sneak); });
  addEventListener('resize', resizeWorld);
}
// 跳躍緩衝：落地前 0.15 秒內按下也會跳；離開地面 0.12 秒內仍可起跳（土狼時間）
function jump() { if (P) P.jb = .15; }
/* 區域保護：山脊只能從隘口通過；山脊外只能進入已解鎖的區域；火山口不能進入 */
function regionOK(x, z) {
  const ox = x / K, oz = z / K, ax = Math.abs(ox), az = Math.abs(oz), r = Math.max(ax, az);
  if (Math.hypot(ox, oz + 130) < 5.3) return false;
  if (r < 49) return true;
  const ew = ax >= az, side = ew ? (ox > 0 ? 'coast' : 'snow') : (oz < 0 ? 'volcano' : null), lateral = ew ? az : ax;
  if (r <= 58) return !!side && lateral < 7;
  if (Math.abs(ax - az) < 9) return false;
  return !!side && S.zones.includes(side);
}
function tryMove(dx, dz) {
  let nx = P.x + dx, nz = P.z + dz; const h0 = G(P.x, P.z), h1 = G(nx, nz), d = Math.hypot(dx, dz) || 1e-6;
  if (h1 < -2.2) return false;
  const ux = dx / d, uz = dz / d, ha = G(P.x + ux * .7, P.z + uz * .7);
  if ((ha - h0) / .7 > 1.1) return false;
  if (!inCity(nx) && !regionOK(nx, nz) && regionOK(P.x, P.z)) return false;
  for (const c of colsNear(nx, nz)) {
    if (c.box) { const [x0, z0, x1, z1] = c.box, cx = clamp(nx, x0, x1), cz = clamp(nz, z0, z1), ddx = nx - cx, ddz = nz - cz, l = Math.hypot(ddx, ddz); if (l < P.r) { if (l < 1e-4) return false; nx = cx + ddx / l * P.r; nz = cz + ddz / l * P.r; } }
    else { const ddx = nx - c.x, ddz = nz - c.z, l = Math.hypot(ddx, ddz), R = c.r + P.r; if (l < R) { if (l < 1e-4) return false; nx = c.x + ddx / l * R; nz = c.z + ddz / l * R; } }
  }
  if (inCity(nx)) { if (Math.abs(nx - CITY.x) > 58 || Math.abs(nz - CITY.z) > 30) return false; }
  else if (Math.max(Math.abs(nx), Math.abs(nz)) > 178 * K) return false;
  P.x = nx; P.z = nz; return true;
}
function playerStep(dt) {
  let f = 0, s = 0;
  if (!GUI.kind) {
    if (KEYS.has('KeyW') || KEYS.has('ArrowUp')) f += 1; if (KEYS.has('KeyS') || KEYS.has('ArrowDown')) f -= 1;
    if (KEYS.has('KeyD') || KEYS.has('ArrowRight')) s += 1; if (KEYS.has('KeyA') || KEYS.has('ArrowLeft')) s -= 1;
    if (IN.jx || IN.jy) { f = -IN.jy; s = IN.jx; }
    if (KEYS.has('Space')) P.jb = Math.max(P.jb, .05);
  }
  const l = Math.hypot(f, s); if (l > 1) { f /= l; s /= l; }
  // 潛行（按住 C／觸控潛行鍵）：較慢、視角降低、腳步輕，怕生的史萊姆不容易察覺
  P.sneak = !GUI.kind && (KEYS.has('KeyC') || IN.sneak);
  const run = !P.sneak && (KEYS.has('ShiftLeft') || KEYS.has('ShiftRight') || IN.run) && !!(f || s); P.running = run;
  const spd = (P.sneak ? 2.2 : run ? 7.5 : 4.3) * (1 + .1 * S.up.boots);
  const sy = Math.sin(P.yaw), cy = Math.cos(P.yaw), wx = (-sy * f + cy * s) * spd, wz = (-cy * f - sy * s) * spd;
  // 加速度與摩擦：起步與停下都有一點慣性，空中轉向較弱
  const acc = (P.ground ? ((f || s) ? 34 : 26) : 7) * dt; let ex = wx - P.vx, ez = wz - P.vz; const el = Math.hypot(ex, ez); if (el > acc && el > 1e-6) { ex *= acc / el; ez *= acc / el; }
  P.vx += ex; P.vz += ez; if (Math.abs(P.vx) < 1e-3) P.vx = 0; if (Math.abs(P.vz) < 1e-3) P.vz = 0;
  if (P.vx && !tryMove(P.vx * dt, 0)) P.vx = 0; if (P.vz && !tryMove(0, P.vz * dt)) P.vz = 0;
  P.jb = Math.max(0, P.jb - dt); P.coy = P.ground ? .12 : Math.max(0, P.coy - dt);
  if (P.jb > 0 && P.coy > 0) { P.vy = P.sneak ? 5.6 : 7.2; P.ground = false; P.coy = 0; P.jb = 0; sfx.jump(); }
  const vy0 = P.vy; P.vy -= 22 * dt; P.y += P.vy * dt; const g = G(P.x, P.z);
  if (P.y <= g) { if (!P.ground && vy0 < -3.5) { const k = clamp((-vy0 - 3.5) / 10, 0, 1); P.dipV -= 1.4 + k * 3.2; sfx.land(k, surfaceAt(P.x, P.z)); } P.y = g; P.vy = 0; P.ground = true; }
  else if (P.y - g > .25) P.ground = false;
  const hsp = Math.hypot(P.vx, P.vz), moving = hsp > .6 && P.ground; P.bob += moving ? dt * hsp * 2.1 : 0;
  if (moving) { P.stepT -= dt * hsp / 4.3; if (P.stepT < 0) { P.stepT = .42; sfx.step(surfaceAt(P.x, P.z), P.sneak ? .35 : run ? 1.2 : 1); } }
  P.eye += ((P.sneak ? 1.18 : 1.62) - P.eye) * Math.min(1, dt * 10);
  P.dipV += (-P.dip * 160 - P.dipV * 14) * dt; P.dip = clamp(P.dip + P.dipV * dt, -.35, .2);
  P.camY += (P.y - P.camY) * Math.min(1, dt * 18);
}
// 產線特寫鏡頭：放在天棚下方（原本在屋頂上方，畫面被屋頂整片擋住），
// 並依畫面比例拉遠，讓整條產線出現在下方介面之上的區域
function lineViewPose() {
  const vf = W.cam.fov * Math.PI / 180, dist = clamp(9.6 / (Math.tan(vf / 2) * W.cam.aspect), 8, 19), ly = W.lineG ? W.lineG.position.y : WS_Y, lz = W.lineG ? W.lineG.position.z : -8, y = ly + 4.7;
  const p = new THREE.Vector3(.4, y, lz + dist), pitch = Math.atan2(y - (ly + 1.5), dist) + vf * .24;
  return { p, t: p.clone().add(new THREE.Vector3(0, -Math.sin(pitch), -Math.cos(pitch))) };
}
const camT = new THREE.Vector3();
function cameraStep(dt) {
  const cam = W.cam;
  if (GUI.kind === 'line') {
    const v = lineViewPose(), q = new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().lookAt(v.p, v.t, new THREE.Vector3(0, 1, 0)));
    cam.position.lerp(v.p, Math.min(1, dt * 4)); cam.quaternion.slerp(q, Math.min(1, dt * 4)); W.camAway = true; return;
  }
  // 頭部晃動：上下＋左右輕擺；側移時鏡頭微微傾斜；落地時鏡頭下沉回彈；奔跑時視野加寬
  const hsp = Math.hypot(P.vx, P.vz), mv = P.ground ? clamp(hsp / 4.3, 0, 1.4) : 0, bob = Math.abs(Math.sin(P.bob)) * .05 * mv - .025 * mv, side = Math.sin(P.bob) * .025 * mv;
  const cy = Math.cos(P.yaw), sy = Math.sin(P.yaw), target = camT.set(P.x + cy * side, P.camY + P.eye + bob + P.dip, P.z - sy * side);
  if (W.camAway) { cam.position.lerp(target, Math.min(1, dt * 6)); if (cam.position.distanceTo(target) < .05) W.camAway = false; } else cam.position.copy(target);
  const lat = P.vx * cy - P.vz * sy; P.roll += ((-lat * .0045 + Math.sin(P.bob) * .004 * mv) - P.roll) * Math.min(1, dt * 8);
  cam.rotation.set(P.pitch, P.yaw, P.roll, 'YXZ');
  const fov = (W.fov0 || 72) + (P.running && hsp > 5 ? 7 : 0) - (P.sneak ? 4 : 0); if (Math.abs(cam.fov - fov) > .02) { cam.fov += (fov - cam.fov) * Math.min(1, dt * 6); cam.updateProjectionMatrix(); }
}
function resizeWorld() { if (!W.r) return; const w = innerWidth, h = innerHeight; W.r.setSize(w, h, false); W.cam.aspect = w / h; W.fov0 = w / h < 1 ? 80 : 72; W.cam.fov = W.fov0; W.cam.updateProjectionMatrix(); }

/* ---------- 準心目標與互動 ---------- */
let TARGET = null;
function pickAt(ndcX, ndcY) {
  RAY.setFromCamera(new THREE.Vector2(ndcX, ndcY), W.cam); RAY.far = 7.5;
  const objs = [];
  W.slimes.forEach(s => { if (s.m.visible && Math.hypot(s.x - P.x, s.z - P.z) < 9) objs.push(s.m.userData.body); });
  W.inter.forEach(it => { if (it.off) return; const p = it.wp || (it.wp = it.hit.getWorldPosition(new THREE.Vector3())); if (Math.hypot(p.x - P.x, p.z - P.z) < 14) objs.push(it.hit); }); // 互動物件都是固定的，位置算一次即可
  const h = RAY.intersectObjects(objs, false); RAY.far = Infinity; if (!h.length) return null;
  const o = h[0].object; if (o.userData.sl) return { type: 'slime', sl: o.userData.sl, d: h[0].distance, pt: h[0].point.clone() };
  const it = o.userData.it; if (!it) return null; if (it.kind === 'station' && h[0].distance > 5.5) return null; return { type: it.kind, it, d: h[0].distance };
}
function targetLabel(t) {
  if (!t) return '';
  const key = TOUCH ? '' : '<kbd>E</kbd>';
  if (t.type === 'slime') {
    const s = t.sl, sneakKey = TOUCH ? '潛行鍵' : '按住 C';
    const st = s.cool > 0 ? ` · 休息中 ${Math.ceil(s.cool)} 秒` : s.flee > 0 ? ` · <span style="color:#7dd3fc">逃跑中！${sneakKey}潛行靠近</span>` : ` · 採集 ${s.hits}/3`;
    const tip = s.cool <= 0 && !s.flee && s.pers === 'shy' && !P.sneak ? ` · <span style="color:#7dd3fc">怕生</span>` : s.cool <= 0 && s.pers === 'curious' && s.noticed ? ' · <span style="color:#f9a8d4">好奇</span>' : '';
    return `${key}${s.sp.name} <span style="color:${RAR[s.sp.rar].c}">${RAR[s.sp.rar].n}</span>${st}${tip}`;
  }
  if (t.type === 'station') return `${key}使用${t.it.name}`;
  if (t.type === 'gate') return `能量門 · 需解開「${GATES[t.it.id].title}」`;
  if (t.type === 'puzzle') return `${key}${t.it.name}`;
  return '';
}
function act() { if (GUI.kind || !W.ready) return; VM.swing = .35; doAct(TARGET); }
function actAt(x, y) { VM.swing = .35; const t = pickAt(x / innerWidth * 2 - 1, -(y / innerHeight) * 2 + 1); doAct(t); }
function doAct(t) {
  if (!t) return;
  if (t.type === 'slime') hitSlime(t.sl, t.pt);
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
    if (!ownAny()) return { t: '購買第一台機器', d: S.money >= OWN.slicer.cost ? '到路北側的「機械行」購買切片機。' : `切片機要 ${fmt(OWN.slicer.cost)}（目前 ${fmt(S.money)}），錢不夠就先回去多賺一點。`, x: CITY.x - 18, z: CITY.z - 13, c: '#22d3ee', n: '機械行', here: '對準機械行的店門' + (TOUCH ? '點擊' : '按 E') + '，購買切片機。' };
    return { t: '逛逛大城市', d: '機械行、生活百貨、器材行都在路的北側。買完後搭計程車回月光谷。', x: CITY.x + 7, z: CITY.z + 11, c: '#facc15', n: '計程車招呼站', here: '對準計程車' + (TOUCH ? '點擊' : '按 E') + '，回到月光谷。' };
  }
  if (!S.stock.length && !gel && !S.sales) return { t: '採集凝膠', d: '靠近史萊姆，對準後' + (TOUCH ? '點擊' : '按 E 或左鍵') + ' 3 次，收集至少 2 份凝膠。', track: 'slime', c: '#6ee7a8' };
  if (!S.stock.length && !S.sales) return { t: '手作第一個捏捏', d: '回到中央平地，使用「手作台」做出粗製捏捏。', x: BASE.bench[0], z: BASE.bench[1], c: '#fbbf24', n: '手作台', here: '對準手作台' + (TOUCH ? '點擊' : '按 E') + '，用 2 份凝膠做出粗製捏捏。' };
  if (!S.sales) return { t: '上架到網站', d: '到「工作電腦」把沒玩過的捏捏上架到網站，等顧客下單。', x: BASE.pc[0], z: BASE.pc[1], c: '#818cf8', n: '工作電腦', here: '對準工作電腦' + (TOUCH ? '點擊' : '按 E') + '，在「網路商店」把捏捏上架。' };
  if (!ownAny()) return { t: '存錢買機器', d: `存到 ${fmt(OWN.slicer.cost)} 後，搭出生點左邊的計程車到大城市購買切片機（目前 ${fmt(S.money)}）。`, x: BASE.taxi[0], z: BASE.taxi[1], c: '#facc15', n: '計程車', here: '對準計程車' + (TOUCH ? '點擊' : '按 E') + '，前往大城市。' };
  const k = nextQuest(), qt = questTarget();
  if (k) return { t: QUEST[k].title, d: questReady(k) ? (qt ? `前往${qt.n}。` : QUEST[k].hint) : `先用${ZONES.find(z => z.id === QUEST[k].from).name}的史萊姆做出 ${QUEST[k].need} 個捏捏（${madeIn(QUEST[k].from)}/${QUEST[k].need}）。`, x: qt && qt.x, z: qt && qt.z, c: '#c4b5fd', n: qt && qt.n, here: qt && qt.h };
  return { t: '開設夢想捏捏博物館', d: '累積粉絲與營收，到工作電腦的圖鑑頁完成夢想。' };
}
let objSig = '';
function renderObjective() {
  let o = objective(); let tx = o.x, tz = o.z;
  if (o.track === 'slime') { let bd = 1e9; W.slimes.forEach(sl => { if (sl.cool > 0) return; const d = Math.hypot(sl.x - P.x, sl.z - P.z); if (d < bd) { bd = d; tx = sl.x; tz = sl.z; } }); }
  const key = o.t + '|' + (o.n || o.track || ''), same = tx != null && inCity(tx) === inCity(), dist = same ? Math.hypot(tx - P.x, tz - P.z) : 1e9;
  if (W.arrKey !== key) { W.arrKey = key; W.arr = false; }
  if (!W.arr && dist < 8) { W.arr = true; if (o.n) { toast(`已抵達${o.n}`); sfx.tick(); } }
  else if (W.arr && dist > 12) W.arr = false;
  if (W.arr) o = Object.assign({}, o, { d: o.track === 'slime' ? `對準史萊姆' + (TOUCH ? '點擊' : '按 E') + ' 3 次採集凝膠。` : (o.here || `已抵達${o.n || '目標地點'}，對準它' + (TOUCH ? '點擊' : '按 E') + '使用。`), t: o.n ? `${o.t}（已抵達${o.n}）` : o.t, arrived: true });
  const s = o.t + o.d; W.obj = o; if (s === objSig) return; objSig = s;
  $('#objective').classList.toggle('arrived', !!o.arrived); $('#objective').innerHTML = `<b>${o.arrived ? '下一步' : '目前目標'}</b>${esc(o.t)}<div style="color:#cbd5e1;font-size:12px">${esc(o.d)}</div>`;
}
/* 目標引導標記：在畫面上標出目標位置與距離；不在畫面內時貼齊邊緣並以箭頭指出方向；靠近 8 公尺內自動隱藏 */
const WPV = new THREE.Vector3(), WP_HIDE = 8;
function waypointStep() {
  if ((W.objT = (W.objT || 0) + 1) % 15 === 0) renderObjective();
  let el = $('#wp');
  if (!el) { el = document.createElement('div'); el.id = 'wp'; el.hidden = true; el.innerHTML = '<svg class="wpi" viewBox="0 0 24 24"><path d="M12 1l2.4 6.2L20.5 4l-2.6 6.3L23 12l-5.1 1.7 2.6 6.3-6.1-3.2L12 23l-2.4-6.2L3.5 20l2.6-6.3L1 12l5.1-1.7L3.5 4l6.1 3.2z"/></svg><b></b><i class="wpa"></i>'; $('#hud').appendChild(el); }
  const o = W.obj; let tx = null, tz = null;
  if (o && o.track === 'slime') { let bd = 1e9; W.slimes.forEach(s => { if (s.cool > 0) return; const d = Math.hypot(s.x - P.x, s.z - P.z); if (d < bd) { bd = d; tx = s.x; tz = s.z; } }); }
  else if (o && o.x != null) { tx = o.x; tz = o.z; }
  if (tx == null || GUI.kind || TITLE.on || inCity(tx) !== inCity()) { el.hidden = true; return; }
  const dist = Math.hypot(tx - P.x, tz - P.z); if (dist < WP_HIDE) { el.hidden = true; return; }
  WPV.set(tx, G(tx, tz) + 1.8, tz).project(W.cam);
  const vw = innerWidth, vh = innerHeight, behind = WPV.z > 1; let sx = (WPV.x * .5 + .5) * vw, sy = (-WPV.y * .5 + .5) * vh;
  if (behind) { sx = vw - sx; sy = vh - sy; }
  const mx = 56, mt = 90, mb = 130, off = behind || sx < mx || sx > vw - mx || sy < mt || sy > vh - mb;
  let ang = 0;
  if (off) {
    const cx = vw / 2, cy = vh / 2; let dx = sx - cx, dy = sy - cy; if (Math.abs(dx) + Math.abs(dy) < 1) dy = 1;
    const kx = (vw / 2 - mx) / Math.max(Math.abs(dx), 1e-6), ky = (dy < 0 ? cy - mt : vh - mb - cy) / Math.max(Math.abs(dy), 1e-6), k = Math.min(kx, ky);
    sx = cx + dx * k; sy = cy + dy * k; ang = Math.atan2(dy, dx) * 180 / Math.PI + 90;
  }
  el.hidden = false; el.classList.toggle('off', off); el.style.transform = `translate(${sx.toFixed(1)}px,${sy.toFixed(1)}px)`; el.style.setProperty('--wpc', o.c || '#fde047');
  const txt = dist >= 1000 ? (dist / 1000).toFixed(1) + 'km' : Math.round(dist) + 'm'; if (el.dataset.t !== txt) { el.dataset.t = txt; el.querySelector('b').textContent = txt; }
  if (off) el.querySelector('.wpa').style.transform = `translate(-50%,-50%) rotate(${ang.toFixed(0)}deg) translateY(-25px)`;
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
  setHTML($('#machLegend'), MKEY.map((k, i) => `<span class="mlg">${STEPS[i]} · ${UPS[k].name}<span class="lv">${[0, 1, 2, 3, 4].map(j => `<i class="${j < S.up[k] ? 'on' : ''}"></i>`).join('')}</span></span>`).join(''));
  setHTML($('#gelPick'), unlockedSpecies().map(s => `<button class="zbtn ${M.sp === s.id ? 'on' : ''}" data-act="pickSp" data-id="${s.id}" ${M.active ? 'disabled' : ''}>${dot(s.color)}${short(s.id)}<br><small>凝膠 ${S.gel[s.id] || 0}</small></button>`).join(''));
  const mini = $('#mini');
  if (M.active) {
    const g = M.g, st = `<div class="steps">${STEPS.map((x, i) => { const own = S.own[MKEY[i]], done = M.scores[i] != null && i !== M.step; return `<span class="${!own ? 'off' : i === M.step ? 'on' : done ? 'done' : ''}">${i + 1}. ${x}${!own ? '（未購買）' : done ? ' ' + Math.round(M.scores[i] * 100) + '%' : ''}</span>`; }).join('')}</div>`;
    const how = `<div class="mghow"><b>${UPS[MKEY[M.step]].name}</b>：${MG[M.step].how}${TOUCH ? '' : `<span style="color:var(--sub)">（${MG[M.step].key}）</span>`}${M.phase === 'ready' ? '<span class="ready">準備…</span>' : ''}</div>`;
    let body = '';
    if (M.step === 0) body = `<div class="track" id="mgTrack">${g.marks.map(m => `<i class="mark" style="left:${m * 100}%"></i>`).join('')}<i class="cur" id="mgCur" style="left:0"></i></div><button class="btn big" style="width:100%" data-mg="tap">切！</button>`;
    else if (M.step === 1) body = `<div class="gauge"><div class="gz" style="left:${g.lo * 100}%;width:${(g.hi - g.lo) * 100}%"></div><i class="needle" id="mgNeedle" style="left:0"></i></div><div class="tbar"><i id="mgTime"></i></div><button class="btn big hold" style="width:100%" id="mgHold" data-mg="hold">按住加速</button>`;
    else body = `<div class="track dry" id="mgDry"><div class="tgt" id="mgTgt"></div><div class="knob" id="mgKnob" style="left:50%"></div></div><div class="tbar"><i id="mgTime"></i></div><div class="hint" style="margin:0">左右拖曳火力旋鈕${TOUCH ? '' : '，或按 ← →'}</div>`;
    setHTML(mini, st + how + body); updMakeUI();
  } else setHTML(mini, `<div class="row"><div class="grow small">${M.sp ? `已選：<b>${SP[M.sp].name}</b>　消耗 2 凝膠` : '請先選擇要加工的凝膠'}<br><span style="color:var(--sub)">${ownAny() ? '已擁有：' + MKEY.filter(k => S.own[k]).map(k => UPS[k].name).join('、') + '。缺少的機器步驟以 0 分計算。' : '尚未購買任何機器。'}庫存 ${S.stock.length}/${cap()}</span></div><button class="btn" data-act="startMake" ${!M.sp || (S.gel[M.sp] || 0) < 2 ? 'disabled' : ''}>啟動產線</button></div>`);
  const r = $('#makeResult');
  if (M.last && !M.active) { const p = M.last, pct = Math.round(p.crisp * 100); setHTML(r, `<div class="card item" style="cursor:default"><div class="sw" style="background:${swatch(SP[p.sp])};width:52px;height:52px"></div><div class="grow"><b>${SP[p.sp].name} · 酥脆捏捏</b><br>酥脆度 <b style="color:var(--warn)">${pct}%</b>　${pct >= 90 ? '極品' : pct >= 70 ? '優良' : '再接再厲'}<br><small style="color:var(--sub)">已放入背包。可拿到裝飾桌加工，或到直播台販售。</small></div></div>`); }
  else setHTML(r, '');
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
  if (NET.on && info && L.rv.size) netEmit({ t: 'lcr', hit: info.hit, cr: info.cr, eff }); // 沒有觀眾時不必廣播
  const now = performance.now(); L.combo = now - L.lastC < 1200 ? L.combo + 1 : 1; L.lastC = now; L.hype = Math.min(100, L.hype + 5 + Math.min(L.combo, 20) * .4);
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
    case 'toTitle': if (M.active) { S.gel[M.sp] = (S.gel[M.sp] || 0) + 2; M.active = false; M.g = null; toast('產線中斷，已退回 2 份凝膠'); } save(); netLeave(true); showTitle(); break;
    case 'netLeave': netLeave(); renderPause(); break;
    case 'tContinue': startPlay(); break;
    case 'tNew': if (lsGet(SAVE_KEY)) modal('<h2>開始新遊戲？</h2><p>目前的存檔會被清除，無法復原。</p>', [{ t: '取消', ghost: true }, { t: '確定', f: newGame }]); else newGame(); break;
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
    ? '<div class="keys"><kbd>左下</kbd><span>拖曳虛擬搖桿移動</span><kbd>右側</kbd><span>滑動轉動視角，輕點物件即可互動</span><kbd>手掌</kbd><span>對準準心的物件互動（採集、使用工作站），按住可連續捏</span><kbd>箭頭</kbd><span>跳躍</span><kbd>閃電</kbd><span>切換奔跑</span><kbd>腳印</kbd><span>切換潛行：腳步變輕，靠近怕生的稀有史萊姆</span><kbd>右上</kbd><span>背包、選單</span></div>'
    : '<div class="keys"><kbd>WASD</kbd><span>移動</span><kbd>滑鼠</kbd><span>環顧四周（點擊畫面鎖定滑鼠）</span><kbd>E / 左鍵</kbd><span>互動：採集史萊姆、使用工作站、調查線索（按住可連續捏）</span><kbd>空白鍵</kbd><span>跳躍（加工時為停機）</span><kbd>Shift</kbd><span>奔跑（史萊姆會更早發現你）</span><kbd>C（按住）</kbd><span>潛行：腳步變輕，怕生的稀有史萊姆不容易察覺</span><kbd>1–9 / 滾輪</kbd><span>選擇快捷列</span><kbd>I / Tab</kbd><span>背包與探索日誌</span><kbd>Alt</kbd><span>暫時放開滑鼠（遊戲不暫停），再按一次或點擊畫面回到操控</span><kbd>Esc</kbd><span>關閉介面／選單</span></div>';
  modal(`<h2>操作說明</h2>${keys}<p class="small" style="color:var(--sub);margin-top:10px">採集技巧：準心外圈的三格代表採集進度。每一下之間抓穩約 0.3 秒的節奏，連續「完美」可以多得 1 份凝膠。稀有史萊姆很怕生，會逃跑，要潛行慢慢靠近。<br>遊戲循環：採集凝膠 → 工坊加工 → 裝飾 → 直播或網站販售 → 升級。山脊上的能量門要解開前一區的謎題才會開啟。</p>`);
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
  const has = !!lsGet(SAVE_KEY) && S.seen;
  $('#titleMain').innerHTML = (has ? `<button class="btn big" data-act="tContinue">繼續遊戲</button>` : `<button class="btn big" data-act="tContinue">開始遊戲</button>`) +
    (has ? `<button class="btn big ghost" data-act="tNew">新遊戲</button>` : '') +
    `<button class="btn big ghost" data-act="tMulti">多人遊戲</button>
     <div class="row"><button class="btn ghost grow" data-act="help">操作說明</button><button class="btn ghost grow" data-act="sound" id="tSound">音效：${S.sound ? '開' : '關'}</button></div>`;
  $('#titleFoot').innerHTML = has ? `存檔：${fmtTime(S.last)} · ${fmt(S.money)} · 粉絲 ${Math.floor(S.fans)} · 已發現區域 ${S.zones.length}/4 · 設備 ${Object.keys(S.own || {}).length}/5` : '月光谷正在等待新的工坊主人';
  $('#titleMain').hidden = false; $('#titleMp').hidden = true;
}
function showTitle() {
  if (GUI.kind) { GUI.kind = null; tab = ''; $('#gui').hidden = true; $$('.panel').forEach(p => p.classList.remove('on')); }
  if (L.watch) L.watch = null; L.on = false; M.active = false;
  unlockMouse(); TITLE.on = true; if (VM.g) VM.g.visible = false; IN.hold = IN.holdE = false; document.body.classList.add('titleon'); $('#title').hidden = false; $('#startHint').hidden = true; renderTitle();
}
function startPlay() {
  if (S.ownMigrated) { S.ownMigrated = false; save(); setTimeout(() => toast('偵測到改版前的存檔：已補發你原本擁有的加工機器、裝飾桌與直播設備'), 900); }
  TITLE.on = false; document.body.classList.remove('titleon'); $('#title').hidden = true;
  $('#startHint').hidden = TOUCH || locked(); W.camAway = false; toast('歡迎來到月光谷。左上角是目前目標。');
  if (!S.seen) showIntro();
}
function newGame() { NOSAVE = true; netLeave(true); try { localStorage.removeItem(SAVE_KEY); sessionStorage.setItem('squish_autostart', '1'); } catch (e) { } location.reload(); }
function titleStep(dt) {
  W.t += dt; W.wind.value = W.t; if (++W.cullN % 8 === 0 || W.cullN === 1) cullChunks(W.cam.position); slimeStep(dt, W.t); lineStep(dt); W.anim.forEach(f => f(dt, W.t)); envStep(dt);
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
const NET = { on: false, host: false, peer: null, conns: new Map(), hc: null, room: '', me: '', name: '', color: '', players: new Map(), last: new Map(), hostLast: 0, joinTo: 0, rcT: 0, rcN: 0, warned: false, retry: 0, retryT: 0 };
const PCOL = ['#22d3ee', '#f472b6', '#a78bfa', '#fbbf24', '#34d399', '#fb923c', '#60a5fa'];
const NET_TIMEOUT = 30000, SL_RANGE = 90, MAX_PEERS = 7;
// 多給幾組 STUN 讓 NAT 打洞更容易成功；TURN 沿用 PeerJS 公共中繼（對稱式 NAT／行動網路的備援）
const PEER_OPT = { debug: 0, config: { iceServers: [{ urls: ['stun:stun.l.google.com:19302', 'stun:stun1.l.google.com:19302'] }, { urls: 'stun:stun.cloudflare.com:3478' }, { urls: ['turn:eu-0.turn.peerjs.com:3478', 'turn:us-0.turn.peerjs.com:3478'], username: 'peerjs', credential: 'peerjsp' }], sdpSemantics: 'unified-plan' } };
const setMp = t => { const el = $('#mpStatus'); if (el) el.textContent = t; };
/* ---------- 收到的資料一律先檢查：對方可能是舊版本、資料損毀或刻意送出惡意內容 ---------- */
const nStr = (v, n) => typeof v === 'string' ? v.slice(0, n) : '';
const nNum = (v, a, b, d = 0) => { v = +v; return Number.isFinite(v) ? clamp(v, a, b) : d; };
const nCol = v => typeof v === 'string' && /^#[0-9a-f]{6}$/i.test(v) ? v : '#22d3ee';
const nCrack = c => Array.isArray(c) ? c.slice(0, 12).map(v => nNum(v, -1, 2)) : null;
function nPlayer(m) {
  const lv = m.live && typeof m.live === 'object' && m.live.on ? { on: true, hype: Math.round(nNum(m.live.hype, 0, 100)), viewers: Math.round(nNum(m.live.viewers, 0, 1e6)), sp: SP[m.live.sp] ? m.live.sp : null } : null;
  return { name: nStr(m.name, 12) || '玩家', color: nCol(m.color), x: nNum(m.x, -1e4, 1e4), y: nNum(m.y, -100, 500), z: nNum(m.z, -1e4, 1e4), yaw: nNum(m.yaw, -1e3, 1e3), live: lv, held: typeof m.held === 'string' && /^[pg][0-7]$/.test(m.held) ? m.held : '' };
}
function nProd(p) {
  if (!p || typeof p !== 'object' || !SP[p.sp]) return null;
  const deco = (Array.isArray(p.deco) ? p.deco : []).filter(d => d && DECO[d.k]).slice(0, 6).map(d => ({ k: d.k, x: nNum(d.x, -1, 1), z: nNum(d.z, -1, 1), s: nNum(d.s, .3, 2.5, 1), r: nNum(d.r, -7, 7) }));
  return { id: Math.floor(nNum(p.id, 0, 1e9)), sp: p.sp, crisp: nNum(p.crisp, 0, 1, .5), dur: nNum(p.dur, 0, 100, 100), deco, cracks: (Array.isArray(p.cracks) ? p.cracks : []).slice(-30).map(nCrack).filter(Boolean) };
}
// 可以由房主轉發的事件與欄位（白名單）：其他欄位一律丟棄，發送者身分由房主蓋上
const RELAY = {
  chat: m => ({ t: 'chat', text: nStr(m.text, 60) }),
  lprod: m => ({ t: 'lprod', p: nProd(m.p) }),
  lcr: m => ({ t: 'lcr', hit: [0, 1, 2].map(i => nNum(Array.isArray(m.hit) ? m.hit[i] : 0, -2, 3)), cr: nCrack(m.cr), eff: nNum(m.eff, 0, 1) }),
  lchat: m => ({ t: 'lchat', to: nStr(m.to, 64), text: nStr(m.text, 40) }),
  don: m => ({ t: 'don', to: nStr(m.to, 64), amt: Math.round(nNum(m.amt, 1, 20, 20)) }),
  watch: m => ({ t: 'watch', to: nStr(m.to, 64), on: !!m.on }),
  lreq: m => ({ t: 'lreq', to: nStr(m.to, 64) }),
};
const netClean = m => RELAY[m.t] ? RELAY[m.t](m) : null;
function prepName() {
  const n = ($('#mpName').value || S.name || '').trim().slice(0, 12) || ('玩家' + Math.floor(100 + Math.random() * 900));
  S.name = n; NET.name = n; NET.color = PCOL[[...n].reduce((a, c) => a + c.charCodeAt(0), 0) % PCOL.length]; save(); return n;
}
function peerErr(e) {
  const m = { 'unavailable-id': '房間代碼重複，請再試一次', 'peer-unavailable': '找不到這個房間，請確認代碼（房主可能已離開）', network: '網路連線失敗，請檢查網路後再試', 'server-error': '連線伺服器暫時無法使用，請稍後再試', 'socket-error': '連線伺服器中斷，請稍後再試', 'socket-closed': '連線伺服器中斷，請稍後再試', 'browser-incompatible': '這個瀏覽器不支援多人連線', 'webrtc': '點對點連線失敗（網路可能阻擋 WebRTC）' }[e && e.type] || ('連線錯誤：' + (e && e.type || '未知'));
  setMp(m); toast(m);
}
// 與 PeerJS 信令伺服器斷線時自動重連（已連上的玩家不受影響，但新玩家要靠它才能加入）
function keepSignal(peer) {
  clearTimeout(NET.rcT);
  NET.rcT = setTimeout(() => {
    if (NET.peer !== peer || peer.destroyed || !peer.disconnected) { NET.rcN = 0; return; }
    try { peer.reconnect(); } catch (_) { } NET.rcN++; keepSignal(peer);
  }, Math.min(15000, 1500 * Math.pow(1.6, NET.rcN)));
}
function netHost(tries = 0) {
  if (!window.Peer) return setMp('多人模組載入失敗');
  if (!tries) { netLeave(true); NET.retry = 0; prepName(); }
  const code = Array.from({ length: 5 }, () => 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'[Math.floor(Math.random() * 31)]).join('');
  setMp(tries ? '房間代碼重複，重新產生中…' : '建立房間中…');
  const peer = new Peer('squishlab-' + code.toLowerCase(), PEER_OPT); NET.peer = peer;
  peer.on('open', id => {
    if (NET.peer !== peer) return;
    NET.on = true; NET.host = true; NET.room = code; NET.me = id; NET.rcN = 0; NET.warned = false;
    NET.players.set(id, Object.assign(nPlayer(myState()), { id })); setMp('房間已建立：' + code); afterNet(); toast(`房間已建立，代碼 ${code}，分享給朋友一起玩`);
  });
  peer.on('connection', c => {
    if (NET.peer !== peer) { try { c.close(); } catch (_) { } return; }
    c.on('open', () => {
      if (NET.peer !== peer) return;
      if (NET.conns.size >= MAX_PEERS) { try { c.send({ t: 'full' }); } catch (_) { } setTimeout(() => { try { c.close(); } catch (_) { } }, 400); return; }
      NET.conns.set(c.peer, c); NET.last.set(c.peer, Date.now());
    });
    c.on('data', d => { if (NET.conns.get(c.peer) !== c) return; try { hostRecv(c.peer, d); } catch (err) { console.error(err); } });
    const drop = () => { if (NET.conns.get(c.peer) === c) dropPlayer(c.peer); };
    c.on('close', drop); c.on('error', drop);
  });
  peer.on('error', e => {
    if (NET.peer !== peer) return;
    if (e && e.type === 'unavailable-id' && !NET.on && tries < 4) { NET.peer = null; try { peer.destroy(); } catch (_) { } return netHost(tries + 1); }
    if (NET.on) {
      // 房間已開：信令伺服器的錯誤不影響正在遊玩的玩家，只提示一次
      if (e && e.type === 'peer-unavailable') return;
      if (!NET.warned) { NET.warned = true; toast('與連線伺服器中斷，正在自動重連（已在房間的玩家不受影響）'); }
      if (peer.disconnected && !peer.destroyed) keepSignal(peer); return;
    }
    peerErr(e); netLeave(true);
  });
  peer.on('disconnected', () => { if (NET.peer === peer && !peer.destroyed) keepSignal(peer); });
}
/* 意外斷線（不是對方主動離開）時自動重新加入同一個房間，最多 3 次 */
function netLost(msg) {
  const code = NET.room, again = !NET.host && code && NET.retry < 3; netLeave(true);
  if (!again) { NET.retry = 0; toast(msg + '，已切換為單人模式'); return; }
  NET.retry++; toast(`${msg}，正在重新連線（第 ${NET.retry} 次）…`); NET.retryT = setTimeout(() => netJoin(code, true), 1500 * NET.retry);
}
function netJoin(code, auto = false) {
  code = String(code || '').trim().toUpperCase().replace(/[^A-Z0-9]/g, ''); if (code.length < 4) return setMp('請輸入房間代碼');
  if (!window.Peer) return setMp('多人模組載入失敗'); netLeave(true); if (!auto) NET.retry = 0; prepName(); setMp(auto ? '重新連線中…' : '連線中…');
  const peer = new Peer(PEER_OPT); NET.peer = peer;
  const fail = msg => {
    if (NET.peer !== peer || NET.on) return; clearTimeout(NET.joinTo);
    if (auto && NET.retry < 3) { netLeave(true); NET.retry++; setMp(`重新連線失敗，稍後再試（第 ${NET.retry} 次）…`); NET.retryT = setTimeout(() => netJoin(code, true), 2000 * NET.retry); return; }
    NET.retry = 0; setMp(msg); toast(msg); netLeave(true);
  };
  NET.joinTo = setTimeout(() => fail('連線逾時：找不到房間，或雙方網路阻擋了點對點連線'), 20000);
  peer.on('open', id => {
    if (NET.peer !== peer) return; NET.me = id; setMp('正在連線房主…');
    const c = peer.connect('squishlab-' + code.toLowerCase(), { reliable: true }); NET.hc = c;
    c.on('open', () => {
      if (NET.peer !== peer) return; clearTimeout(NET.joinTo);
      NET.on = true; NET.host = false; NET.room = code; NET.hostLast = Date.now(); NET.rcN = 0; if (auto) toast('已重新連上房間 ' + code); NET.retry = 0;
      try { c.send(Object.assign(myState(), { t: 'hello' })); } catch (_) { }
      setMp('已加入房間 ' + code); afterNet();
    });
    c.on('data', d => { if (NET.peer !== peer) return; try { clientRecv(d); } catch (err) { console.error(err); } });
    c.on('close', () => { if (NET.peer !== peer) return; if (NET.on) netLost('與房主的連線中斷'); else fail('無法與房主建立連線'); });
    c.on('error', () => fail('無法與房主建立點對點連線'));
  });
  peer.on('error', e => {
    if (NET.peer !== peer) return;
    if (NET.on) { if (peer.disconnected && !peer.destroyed) keepSignal(peer); return; } // 已連上房主後，信令錯誤不影響遊戲
    clearTimeout(NET.joinTo); peerErr(e); netLeave(true);
  });
  peer.on('disconnected', () => { if (NET.peer === peer && NET.on && !peer.destroyed) keepSignal(peer); });
}
function afterNet() { $('#btnChat').hidden = false; renderNetChip(); if (TITLE.on) startPlay(); }
function netLeave(silent) {
  const was = NET.on;
  // 主動通知對方，房主／玩家不必等到連線逾時才發現
  if (was) { try { if (NET.host) bcast({ t: 'bye' }); else if (NET.hc && NET.hc.open) NET.hc.send({ t: 'bye' }); } catch (_) { } }
  clearTimeout(NET.joinTo); clearTimeout(NET.rcT); clearTimeout(NET.retryT); NET.rcN = 0;
  const peer = NET.peer, wasHost = NET.host; NET.peer = null;
  if (peer) { const kill = () => { try { peer.destroy(); } catch (_) { } }; if (was) setTimeout(kill, 200); else kill(); }
  NET.on = false; NET.host = false; NET.hc = null; NET.conns.clear(); NET.last.clear(); NET.players.clear(); L.rv.clear(); L.watch = null;
  AV.forEach(a => dropObj(a.g)); AV.clear(); if (W.liveTag) { dropObj(W.liveTag); W.liveTag = null; W.liveTagName = null; }
  if (W.ready) {
    if (W.mirror) { W.slimes.forEach(dropSlime); W.slimes = []; W.mirror = false; W.spawned.clear(); spawnAllSlimes(); }
    else if (wasHost) {
      // 房主收掉為其他玩家生成、自己還沒解鎖區域的史萊姆
      W.slimes = W.slimes.filter(s => { if (S.zones.includes(s.zid)) return true; dropSlime(s); return false; });
      [...W.spawned].forEach(z => { if (!S.zones.includes(z)) W.spawned.delete(z); });
    }
  }
  $('#btnChat').hidden = true; if (CHAT.open) closeChat(); renderNetChip();
  if (was && !silent) toast('已離開多人房間');
}
function renderNetChip() { const el = $('#sNet'); el.hidden = !NET.on; if (NET.on) el.textContent = `房間 ${NET.room} · ${Math.max(1, NET.players.size)} 人`; }
const netSend = m => { if (!NET.on) return; if (NET.host) hostRecv(NET.me, m); else if (NET.hc && NET.hc.open) { try { NET.hc.send(m); } catch (_) { } } };
function netEmit(m) { if (!NET.on) return; m.from = NET.me; m.name = NET.name; if (NET.host) bcast(m); else if (NET.hc && NET.hc.open) { try { NET.hc.send(m); } catch (_) { } } }
// 對方網路太慢時先跳過即時資料，避免訊息越積越多、延遲越來越大
const backlog = c => (c.bufferSize || 0) > 40 || (c.dataChannel && c.dataChannel.bufferedAmount > 262144);
function bcast(m, except, rt) { NET.conns.forEach((c, id) => { if (id !== except && c.open && !(rt && backlog(c))) { try { c.send(m); } catch (_) { } } }); }
function myState() {
  const p = stockById(L.stageId);
  return { t: 'st', name: NET.name, color: NET.color, x: +(P ? P.x : 0).toFixed(2), y: +(P ? P.y : 0).toFixed(2), z: +(P ? P.z : 0).toFixed(2), yaw: +(P ? P.yaw : 0).toFixed(2), zones: S.zones, live: L.on ? { on: true, hype: Math.round(L.hype), viewers: Math.round(L.viewers), sp: p ? p.sp : null } : null, held: P ? heldKey() : '' };
}
function hostRecv(id, m) {
  if (!m || typeof m !== 'object' || typeof m.t !== 'string') return;
  const remote = id !== NET.me, pl = NET.players.get(id);
  if (remote) NET.last.set(id, Date.now());
  if (m.t === 'hello' || m.t === 'st') {
    const st = Object.assign(pl || {}, nPlayer(m), { id }); NET.players.set(id, st);
    if (Array.isArray(m.zones)) m.zones.slice(0, 8).forEach(z => { if (ZONES.some(q => q.id === z) && !W.spawned.has(z)) spawnZone(z); });
    if (!pl && remote) { const c = NET.conns.get(id); if (c && c.open) { try { c.send({ t: 'welcome', room: NET.room }); } catch (_) { } } const j = { t: 'join', name: st.name, from: id }; onNet(j); bcast(j, id); renderNetChip(); }
    return;
  }
  if (!pl) return; // 還沒打招呼的連線不處理任何事件
  if (m.t === 'bye') { dropPlayer(id); return; }
  if (m.t === 'hit') {
    // 只接受玩家附近的史萊姆，避免遠端亂打整張地圖
    const sl = W.slimes.find(s => s.id === m.id), c = NET.conns.get(id);
    if (sl && c && c.open && Math.hypot(sl.x - pl.x, sl.z - pl.z) < 14) { const r = slimeHitCore(sl); try { c.send(Object.assign({ t: 'hitr', id: sl.id }, r)); } catch (_) { } slimeReact(sl, null, r.res); }
    return;
  }
  const out = netClean(m); if (!out) return;
  out.from = id; out.name = remote ? pl.name : NET.name;
  bcast(out, id); if (remote) onNet(out);
}
function clientRecv(m) {
  if (!m || typeof m !== 'object' || typeof m.t !== 'string') return;
  NET.hostLast = Date.now();
  switch (m.t) {
    case 'ps': {
      if (!m.p || typeof m.p !== 'object') return; const mp = new Map();
      Object.keys(m.p).slice(0, MAX_PEERS + 2).forEach(id => { const v = m.p[id]; if (v && typeof v === 'object') mp.set(id, Object.assign(nPlayer(v), { id })); });
      NET.players = mp; return;
    }
    case 'sl': if (Array.isArray(m.a)) mirrorSlimes(m.a); return;
    case 'hitr': { const sl = W.slimes.find(s => s.id === m.id); if (sl && ['shy', 'hit', 'harvest'].includes(m.res)) applyHit(sl, { res: m.res, hits: Math.round(nNum(m.hits, 0, 3)) }, null, null, true); return; }
    case 'welcome': toast(`已加入房間 ${nStr(m.room, 8)}`); return;
    case 'full': NET.retry = 0; setMp('房間人數已滿'); toast('房間人數已滿，無法加入'); netLeave(true); return;
    case 'bye': NET.retry = 0; toast('房主已關閉房間，已切換為單人模式'); netLeave(true); return;
    case 'join': case 'leave': onNet({ t: m.t, name: nStr(m.name, 12) || '玩家', from: nStr(m.from, 64) }); return;
  }
  const c = netClean(m); if (!c) return; c.from = nStr(m.from, 64); c.name = nStr(m.name, 12) || '玩家'; onNet(c);
}
function dropPlayer(id) {
  const c = NET.conns.get(id); NET.conns.delete(id); NET.last.delete(id); const p = NET.players.get(id); NET.players.delete(id); L.rv.delete(id);
  if (c) { try { c.close(); } catch (_) { } }
  if (p) { const m = { t: 'leave', name: p.name, from: id }; onNet(m); bcast(m); renderNetChip(); }
}
/* 每個節點收到的事件（除了發送者本人） */
function onNet(m) {
  switch (m.t) {
    case 'chat': if (m.text) toast(`${m.name}：${m.text}`); break;
    case 'join': toast(`${m.name} 加入了房間`); break;
    case 'leave': toast(`${m.name} 離開了房間`); if (L.watch && L.watch.id === m.from) { stopWatch(true); toast('主播已離開'); if (tab === 'live') renderLive(); } break;
    case 'lprod': if (L.watch && L.watch.id === m.from) { L.watch.p = m.p; if (tab === 'live') renderLive(); } break;
    case 'lcr': if (L.watch && L.watch.id === m.from && tab === 'live') liveSt.remoteCrunch(m); break;
    case 'lchat': if (!m.text) break; if (m.to === NET.me && L.on) { chat(m.name, m.text, 'dm'); S.fans += .2; } else if (L.watch && L.watch.id === m.to && tab === 'live') chat(m.name, m.text, 'dm'); break;
    case 'don': if (m.to === NET.me && L.on && L.rv.has(m.from)) { addMoney(m.amt); S.fans += 1; toast(`${m.name} 在直播中斗內你 ${fmt(m.amt)}`); chat(m.name, `斗內 ${fmt(m.amt)}！`, 'dm'); renderTop(); } else if (L.watch && L.watch.id === m.to) chat(m.name, `斗內 ${fmt(m.amt)}！`, 'dm'); break;
    case 'watch': if (m.to === NET.me) { if (m.on) { if (!L.rv.has(m.from)) { L.rv.add(m.from); toast(`${m.name} 正在看你的直播`); chat('系統', `${m.name} 進入了直播間`, 'dm'); } liveBroadcast(); } else L.rv.delete(m.from); } break;
    case 'lreq': if (m.to === NET.me) liveBroadcast(); break;
  }
}
/* 網路節拍：用計時器而非畫面更新，分頁切到背景時心跳也不會停 */
let netSlT = 0;
function netTick() {
  if (!NET.on) return; const now = Date.now();
  if (NET.host) {
    for (const [id, t] of NET.last) if (now - t > NET_TIMEOUT) { toast('有玩家長時間沒有回應，已移出房間'); dropPlayer(id); }
    NET.players.set(NET.me, Object.assign(nPlayer(myState()), { id: NET.me }));
    if (!NET.conns.size) return;
    const ps = {}; NET.players.forEach((p, id) => { ps[id] = { name: p.name, color: p.color, x: p.x, y: p.y, z: p.z, yaw: p.yaw, live: p.live, held: p.held }; });
    bcast({ t: 'ps', p: ps }, null, true);
    // 每位玩家只收到自己附近的史萊姆（原本整張地圖上百隻、每秒廣播 10 次）
    NET.conns.forEach((c, id) => {
      const pl = NET.players.get(id); if (!c.open || !pl || backlog(c)) return; const a = [];
      for (const s of W.slimes) if (Math.abs(s.x - pl.x) < SL_RANGE && Math.abs(s.z - pl.z) < SL_RANGE) a.push([s.id, SPECIES.indexOf(s.sp), Math.round(s.x * 50) / 50, Math.round(s.z * 50) / 50, Math.round(s.cool * 10) / 10, s.hits, s.sq > .5 ? 1 : 0, Math.round(s.sc * 100), s.happy > 0 ? 1 : 0]);
      try { c.send({ t: 'sl', a }); } catch (_) { }
    });
  } else {
    if (now - NET.hostLast > NET_TIMEOUT) { netLost('房主長時間沒有回應'); return; }
    if (NET.hc && NET.hc.open && !backlog(NET.hc)) { try { NET.hc.send(myState()); } catch (_) { } }
  }
}
setInterval(() => { try { netTick(); } catch (e) { console.error(e); } }, 100);
function dropSlime(s) {
  W.scene.remove(s.m); const ud = s.m.userData;
  ud.body.material.dispose(); if (ud.body.customDepthMaterial) ud.body.customDepthMaterial.dispose();
  ud.shadow.geometry.dispose(); ud.shadow.material.dispose(); if (s.emo) s.emo.sp.material.dispose();
  if (TARGET && TARGET.sl === s) TARGET = null;
}
function mirrorSlimes(a) {
  if (!W.ready) return;
  if (!W.mirror) { W.slimes.forEach(dropSlime); W.slimes = []; W.mirror = true; }
  const byId = new Map(W.slimes.map(s => [s.id, s])), now = performance.now();
  for (const e of a.slice(0, 600)) {
    if (!Array.isArray(e)) continue; const [id, si, x, z, cool, hits, sq, sc, happy] = e;
    if (!Number.isFinite(id) || !Number.isFinite(x) || !Number.isFinite(z)) continue;
    let s = byId.get(id);
    if (!s) { const sp = (Number.isInteger(si) && SPECIES[si]) || SPECIES[0], m = slimeMesh(sp); s = newSlime(sp, m, { id, mirror: true, x, z, tx: x, tz: z, hx: x, hz: z, sc: nNum(sc, 40, 120, 76) / 100 }); m.scale.setScalar(s.sc); m.userData.body.userData.sl = s; W.scene.add(m); W.slimes.push(s); byId.set(id, s); }
    s.seenT = now; s.tx = x; s.tz = z; s.cool = nNum(cool, 0, 60); s.hits = Math.round(nNum(hits, 0, 3));
    if (sq && s.sq < .3) { s.sq = 1; slimeReact(s, null, 'hit'); }
    if (happy && !(s.happy > 0)) { s.happy = .6; s.hap = 1.4; slimeReact(s, null, 'harvest'); }
  }
  // 走出範圍的史萊姆先保留幾秒（來回走動不必一直重建），太久沒更新才釋放記憶體
  W.slimes = W.slimes.filter(s => { if (now - (s.seenT || 0) < 4000) return true; dropSlime(s); return false; });
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
    if (a.heldKey !== (p.held || '')) {
      a.heldKey = p.held || ''; if (a.hm) { dropObj(a.hm); a.hm = null; }
      if (a.heldKey) { const sp = SPECIES[+a.heldKey.slice(1)] || SPECIES[0], mat = new THREE.MeshPhysicalMaterial({ color: sp.color, roughness: .12, clearcoat: 1, transparent: true, opacity: .9 });
        a.hm = mesh(a.heldKey[0] === 'p' ? new THREE.BoxGeometry(.2, .2, .2) : new THREE.SphereGeometry(.11, 14, 10), mat, .42, .95, -.3, a.g); }
    }
    const k = Math.min(1, dt * 10), ox = a.x, oz = a.z; a.x += (p.x - a.x) * k; a.y += (p.y - a.y) * k; a.z += (p.z - a.z) * k;
    let d = p.yaw - a.yaw; d = Math.atan2(Math.sin(d), Math.cos(d)); a.yaw += d * k;
    const sp = Math.hypot(a.x - ox, a.z - oz) / Math.max(dt, 1e-3); a.bob += dt * (sp > .4 ? 10 : 0);
    a.g.position.set(a.x, a.y + Math.abs(Math.sin(a.bob)) * .09, a.z); a.g.rotation.y = a.yaw;
    const live = !!(p.live && p.live.on); a.lt.visible = live; if (live) { liveName = p.name; a.lt.position.y = 2.85 + Math.sin(W.t * 3) * .06; }
    if (live && !a.wasLive) toast(`${p.name} 開始直播了！到工坊的直播台可以觀看`); a.wasLive = live;
  });
  AV.forEach((a, id) => { if (!seen.has(id)) { dropObj(a.g); AV.delete(id); } });
  if (liveName && W.liveTagName !== liveName) { if (W.liveTag) dropObj(W.liveTag); W.liveTag = textSprite('直播中：' + liveName, '#fb7185', '走近直播台即可觀看'); W.liveTag.position.set(9, WS_Y + 4.8, 3.5); W.liveTag.scale.set(3.2, 1, 1); W.scene.add(W.liveTag); W.liveTagName = liveName; }
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
  if (!L.watch) return; const pl = NET.players.get(L.watch.id); if (!pl || !pl.live || !pl.live.on) return toast('主播目前沒有在直播，無法斗內'); if (S.money < 20) return toast('資金不足');
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
  // 每秒都會重繪：內容沒變就不動 DOM，否則按鈕按下到放開之間被替換，點擊會被吞掉
  setHTML($('#upList'), h);
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

/* ============================================================
   第一人稱手持：快捷列選到捏捏或凝膠時，畫面右下角顯示拿在手上
   ============================================================ */
const VM = { g: null, key: '', swing: 0 };
function initViewModel() {
  if (W.cam.parent !== W.scene) W.scene.add(W.cam);
  const g = VM.g = new THREE.Group(); W.cam.add(g); g.position.set(.36, -.27, -.78); g.scale.setScalar(.72);
  const skin = new THREE.MeshStandardMaterial({ color: '#f5c9a8', roughness: .6 }), sleeve = new THREE.MeshStandardMaterial({ color: '#22d3ee', roughness: .55 });
  const arm = new THREE.Group(); arm.rotation.set(-.3, .3, .12); g.add(arm);
  const fd = new THREE.Vector3(.3, -.55, .78).normalize(), fore = mesh(new THREE.CylinderGeometry(.045, .06, .9, 14), sleeve, fd.x * .48, -.06 + fd.y * .48, .02 + fd.z * .48, arm); fore.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), fd);
  const hand = mesh(new THREE.SphereGeometry(.06, 16, 12), skin, 0, -.05, .02, arm); hand.scale.set(1.15, .75, 1.3);
  mesh(new THREE.SphereGeometry(.024, 10, 8), skin, -.06, -.025, -.01, arm).scale.set(1, 1.7, 1);
  VM.hold = new THREE.Group(); VM.hold.position.set(0, .02, -.01); arm.add(VM.hold);
  VM.J = makeJelly(6, true); VM.J.ov.visible = false; VM.J.group.scale.setScalar(.065); VM.J.group.position.y = .04; VM.hold.add(VM.J.group);
  VM.gel = mesh(new THREE.SphereGeometry(.065, 20, 14), new THREE.MeshPhysicalMaterial({ color: '#6ee7a8', roughness: .1, clearcoat: 1, transparent: true, opacity: .88 }), 0, .03, 0, VM.hold); VM.gel.scale.set(1, .72, 1);
  g.traverse(o => { if (o.isMesh) { o.castShadow = false; o.receiveShadow = false; o.frustumCulled = false; } });
  g.visible = false;
}
function heldKey() { const it = held(); return it ? (it.t === 'prod' ? 'p' : 'g') + SPECIES.indexOf(SP[it.t === 'prod' ? it.p.sp : it.sp]) : ''; }
function viewModelStep(dt) {
  if (!VM.g) initViewModel();
  const it = held(), show = !!it && !GUI.kind && !TITLE.on; VM.g.visible = show; if (!show) { VM.key = ''; return; }
  const key = it.t === 'prod' ? 'p' + it.p.id : 'g' + it.sp;
  if (key !== VM.key) { VM.key = key; VM.swing = Math.max(VM.swing, .35); const sp = SP[it.t === 'prod' ? it.p.sp : it.sp]; VM.J.group.visible = it.t === 'prod'; VM.gel.visible = it.t === 'gel'; if (it.t === 'prod') jellyColors(VM.J, sp); else VM.gel.material.color.set(sp.color); }
  VM.swing = Math.max(0, VM.swing - dt * 2.2);
  const mv = P.ground ? clamp(Math.hypot(P.vx, P.vz) / 4.3, 0, 1.4) : 0;
  const bx = Math.sin(P.bob * .5) * .012 * mv, by = Math.abs(Math.cos(P.bob * .5)) * .014 * mv, sw = Math.sin(VM.swing / .35 * Math.PI);
  // 手上的凝膠會隨走路、揮動與吸收凝膠而 Q 彈晃動
  VM.jv = (VM.jv || 0) + ((-(VM.j || 0)) * 220 - (VM.jv || 0) * 9) * dt + (by * 40 + sw * 4) * dt; VM.j = clamp((VM.j || 0) + VM.jv * dt, -.35, .35);
  VM.g.position.set(.36 + bx, -.27 - by - sw * .05 - (P.sneak ? .03 : 0), -.78 + sw * .04); VM.g.rotation.set(sw * .45, 0, -sw * .2 + P.roll * 2);
  VM.J.group.rotation.y += dt * .7; VM.gel.rotation.y += dt * .7; VM.gel.scale.set(1 - VM.j * .5, .72 * (1 + VM.j), 1 - VM.j * .5);
}
/* ---------- 準心環：對準史萊姆時顯示採集進度（3 格）或休息倒數 ---------- */
function initRing() {
  const r = $('#ring'); if (!r || r._init) return; r._init = true;
  const arc = (a0, a1) => { const p = a => [24 + 19 * Math.cos(a), 24 + 19 * Math.sin(a)], [x0, y0] = p(a0), [x1, y1] = p(a1); return `M${x0.toFixed(2)} ${y0.toFixed(2)}A19 19 0 0 1 ${x1.toFixed(2)} ${y1.toFixed(2)}`; };
  r.innerHTML = [0, 1, 2].map(i => { const c = -Math.PI / 2 + i * PI2 / 3 - PI2 / 3; return `<path class="seg" d="${arc(c - .9, c + .9)}"/>`; }).join('') + '<circle class="cool" cx="24" cy="24" r="19" pathLength="100"/>';
}
function renderRing() {
  const r = $('#ring'); if (!r) return; initRing(); const t = TARGET, on = !!(t && t.type === 'slime') && !GUI.kind; r.classList.toggle('on', on); if (!on) { r._sig = ''; return; }
  const s = t.sl, sig = s.cool > 0 ? 'c' + Math.ceil(s.cool * 5) : 'h' + s.hits + (s.flee > 0 ? 'f' : ''); if (r._sig === sig) return; r._sig = sig;
  $$('#ring .seg').forEach((e, i) => e.setAttribute('class', 'seg' + (s.cool > 0 ? ' off' : i < s.hits ? ' f' : '')));
  const cc = $('#ring .cool'); cc.style.strokeDasharray = s.cool > 0 ? `${(s.cool / 6 * 100).toFixed(1)} 100` : '0 100'; r.classList.toggle('flee', s.flee > 0);
}
function ringPulse(k) { const r = $('#ring'); if (!r) return; r.classList.remove('hit', 'perf', 'cool'); void r.offsetWidth; r.classList.add(k); r._sig = ''; }

/* ---------- 動態解析度：掉幀時自動降低渲染解析度，穩定後再慢慢調回（弱顯卡／手機不再卡頓） ---------- */
const DRS = { base: 1, k: 1, acc: 0, n: 0, good: 0, bad: 0, wait: 5, skip: 4 };
function drsStep(dt) {
  if (!W.r || document.hidden) return;
  if (DRS.skip > 0) { DRS.skip -= dt; return; } // 剛載入時著色器編譯會造成短暫卡頓，不列入計算
  DRS.acc += dt; DRS.n++; if (DRS.acc < 1) return;
  const ms = DRS.acc / DRS.n * 1000; DRS.acc = 0; DRS.n = 0; let k = DRS.k;
  // 連續 2 秒掉幀才降解析度（單次卡頓不算）；恢復等待時間上限 20 秒
  if (ms > 25 && k > .55) { if (++DRS.bad >= 2) { DRS.bad = 0; k = Math.max(.55, k * .85); DRS.good = 0; DRS.wait = Math.min(20, DRS.wait * 1.3); } }
  else if (ms < 18.5 && k < 1) { DRS.bad = 0; if (++DRS.good >= DRS.wait) { DRS.good = 0; k = Math.min(1, k * 1.1); } }
  else { DRS.good = 0; DRS.bad = 0; }
  if (k !== DRS.k) { DRS.k = k; W.r.setPixelRatio(DRS.base * k); W.r.setSize(innerWidth, innerHeight, false); }
}
/* ---------- 主迴圈 ---------- */
let lastT = performance.now(), secAcc = 0, webAcc = 0, farmAcc = 0, trendAcc = 0, saveAcc = 0, hudN = 0, pickN = 0;
const tmpC = new THREE.Color(), tmpC2 = new THREE.Color(), tmpV = new THREE.Vector3(), tmpM = new THREE.Matrix4();
const ENVC = [0, 1, 2, 3, 4].map(() => new THREE.Color());
const SUN_D = new THREE.Vector3(30, 55, 22).normalize(), SUN_R = new THREE.Vector3().crossVectors(SUN_D, new THREE.Vector3(0, 1, 0)).normalize(), SUN_U = new THREE.Vector3().crossVectors(SUN_R, SUN_D).normalize();
const SH_EXT = 34, SH_RES = 2048, shC = new THREE.Vector3();
function envStep(dt) {
  const w = biomeW(P.x, P.z), [fog, top, sun, hs, hg] = ENVC.map(c => c.setRGB(0, 0, 0));
  BIOMES.forEach((b, i) => { const Z = ZONE3D[b]; fog.add(tmpC.set(Z.fog).multiplyScalar(w[i])); top.add(tmpC.set(Z.top).multiplyScalar(w[i])); sun.add(tmpC.set(Z.sun).multiplyScalar(w[i])); hs.add(tmpC.set(Z.hemiS).multiplyScalar(w[i])); hg.add(tmpC.set(Z.hemiG).multiplyScalar(w[i])); });
  const k = Math.min(1, dt * 2); W.scene.fog.color.lerp(fog, k); W.scene.background.copy(W.scene.fog.color); W.sky.material.uniforms.bot.value.lerp(fog, k); W.sky.material.uniforms.top.value.lerp(top, k);
  W.sun.color.lerp(sun, k); W.hemi.color.lerp(hs, k); W.hemi.groundColor.lerp(hg, k); W.sun.intensity = 2.6 - w[2] * .9; skyEnv();
  W.sky.position.copy(W.cam.position);
  // 陰影範圍往視線前方偏移（身後的陰影用不到），並對齊陰影貼圖的像素格：走動時陰影邊緣不再閃爍、游移
  const fx = P.x - Math.sin(P.yaw) * 10, fz = P.z - Math.cos(P.yaw) * 10, tx = SH_EXT * 2 / SH_RES;
  shC.set(fx, P.y, fz); const a = Math.round(shC.dot(SUN_R) / tx) * tx, b = Math.round(shC.dot(SUN_U) / tx) * tx, c = shC.dot(SUN_D);
  shC.copy(SUN_R).multiplyScalar(a).addScaledVector(SUN_U, b).addScaledVector(SUN_D, c);
  W.sun.target.position.copy(shC); W.sun.position.copy(shC).addScaledVector(SUN_D, 66);
  const zid = inCity() ? 'city' : domBiome(P.x, P.z); if (zid !== W.zoneNow) { const prev = W.zoneNow; W.zoneNow = zid; if (prev) toast(zid === 'city' ? '抵達大城市' : `進入${ZONES.find(z => z.id === zid).name}`); if (S.zones.includes(zid)) (S.seenZone = S.seenZone || {})[zid] = true; }
}
// 距離剔除：超出霧距的道具區塊不繪製（大城市時整片山谷都不畫）
const LOD_D = LOW ? 30 : 50, SHADOW_D = 52; // 50m 涵蓋整個陰影範圍（含視線前方偏移），遠角的樹也有陰影
function cullChunks(at = P) {
  const fogFar = (W.scene.fog ? W.scene.fog.far : 260) + 12, city = inCity(at.x);
  for (const c of W.chunks) {
    const u = c.userData, dx = Math.max(u.x0 - at.x, 0, at.x - u.x1), dz = Math.max(u.z0 - at.z, 0, at.z - u.z1), d = Math.hypot(dx, dz);
    c.visible = !city && d < Math.min(u.far, fogFar); if (u.pair) u.pair.visible = c.visible; if (!c.visible) continue;
    if (u.pair) lodSplit(c, at, d < LOD_D);
    else c.castShadow = u.shadow && d < SHADOW_D; // 只有陰影範圍附近的區塊才進陰影貼圖
  }
}
function worldStep(dt) {
  W.t += dt; W.wind.value = W.t; if (!GUI.kind) playerStep(dt);
  if (++W.cullN % 8 === 0 || W.cullN === 1) cullChunks();
  slimeStep(dt, W.t); lineStep(dt); W.anim.forEach(f => f(dt, W.t)); envStep(dt); cameraStep(dt); viewModelStep(dt); avatarsStep(dt);
  if (W.goo) { const got = W.goo.update(dt, W.cam.localToWorld(tmpV.set(.3, -.26, -.72))); if (got) { VM.jv = (VM.jv || 0) + 2.5 * got; VM.swing = Math.max(VM.swing, .12); if (performance.now() - (W.colT || 0) > 90) { W.colT = performance.now(); sfx.collect(); } } }
  for (const s of W.labels) { s.getWorldPosition(tmpV); const o = GUI.kind === 'line' ? 0 : smooth(2.4, 5, tmpV.distanceTo(W.cam.position)); s.material.opacity = o; s.visible = o > .02; }
  if (!GUI.kind && ++pickN % 3 === 0) { TARGET = pickAt(0, 0); const lbl = targetLabel(TARGET); setHTML($('#prompt'), lbl); $('#cross').classList.toggle('on', !!TARGET); renderRing(); }
  else if (GUI.kind) { setHTML($('#prompt'), ''); if (TARGET) { TARGET = null; renderRing(); } }
  // 按住互動鍵連續捏（節奏較慢，想拿「完美節奏」要自己抓拍點）
  if ((IN.hold || IN.holdE) && !GUI.kind) { IN.holdT -= dt; if (IN.holdT <= 0) { IN.holdT = .55; if (TARGET && TARGET.type === 'slime') act(); } }
  if (W.sneakUI !== !!P.sneak) { W.sneakUI = !!P.sneak; $('#vig').classList.toggle('on', W.sneakUI); $('#btnSneak').classList.toggle('on', W.sneakUI); if (W.sneakUI && !S.tipSneak) { S.tipSneak = true; toast('潛行中：腳步變輕，怕生的稀有史萊姆比較不會發現你'); } }
  W.r.render(W.scene, W.cam);
}
function loop(now) {
  const dt = clamp((now - lastT) / 1000, 0, .1); lastT = Math.max(lastT, now);
  trendAcc += dt; if (trendAcc > 90) { trendAcc = 0; pickTrend(); }
  farmAcc += dt; if (S.up.farm > 0 && farmAcc >= 12 / S.up.farm) { farmAcc = 0; const sp = pick(unlockedSpecies()); S.gel[sp.id] = (S.gel[sp.id] || 0) + 1; discover(sp.id); if (tab === 'make' && !M.active) renderMake(); }
  webAcc += dt; if (webAcc >= 4) { webAcc = 0; const r = webTick(); if (r) { toast(`網站成交 +${fmt(r.price)}　${'★'.repeat(r.stars)}`); renderTop(); if (tab === 'web') renderWeb(); } }
  branchTick(dt); updateLive(dt);
  secAcc += dt; saveAcc += dt;
  if (secAcc >= 1) { secAcc = 0; checkBranch(); renderTop(); renderXP(); renderObjective(); renderHotbar(); renderNetChip(); if (tab === 'live' && NET.on) renderLiveOthersOnly(); const ae = document.activeElement; if (!(ae && ae.tagName === 'INPUT') && tab === 'branch') renderBranch(); if (PANEL[tab]) renderShop(tab); }
  if (saveAcc > 5) { saveAcc = 0; save(); }
  try {
    const g = GUI.kind;
    if (W.lost) { /* 顯示資源遺失期間暫停繪製，恢復後自動繼續 */ }
    else if (W.ready && TITLE.on) { titleStep(dt); drsStep(dt); }
    else if (W.ready && (!g || g === 'line')) { worldStep(dt); renderCompass(); drsStep(dt); }
    if (W.ready) waypointStep();
    else DRS.acc = DRS.n = 0;
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
if (initWorld()) { renderHotbar(true); renderXP(); renderObjective(); renderQuest(); $('#startHint').innerHTML = '<b>點擊畫面開始</b><br>WASD 移動 · 滑鼠環顧 · E／左鍵 互動（可按住）<br>Shift 奔跑 · C 潛行 · 空白鍵 跳躍 · I 背包 · Esc 選單'; }
{ const bt = $('#boot'); if (bt && !bt.hidden) { bt.classList.add('out'); setTimeout(() => { bt.hidden = true; bt.classList.remove('out'); }, 520); } }
addEventListener('beforeunload', save); addEventListener('pagehide', () => { save(); if (NET.on) netLeave(true); });
let hiddenAt = 0;
document.addEventListener('visibilitychange', () => {
  if (document.hidden) { hiddenAt = Date.now(); save(); return; }
  if (!hiddenAt) return; const el = Math.min((Date.now() - hiddenAt) / 1000, 1800); hiddenAt = 0; lastT = performance.now(); DRS.skip = 2; DRS.acc = DRS.n = 0; if (el < 8 || !S.web.length) return;
  let gain = 0, n = 0; for (let i = 0; i < Math.floor(el / 4) && S.web.length; i++) { const r = webTick(); if (r) { gain += r.price; n++; } }
  if (n) { toast(`離開期間網站賣出 ${n} 件，+${fmt(gain)}`); sfx.coin(); renderTop(); renderHotbar(); }
});
let autoStart = false; try { autoStart = !!sessionStorage.getItem('squish_autostart'); sessionStorage.removeItem('squish_autostart'); } catch (e) { }
if (autoStart) startPlay(); else showTitle();
requestAnimationFrame(loop);
