'use strict';
/* ============================================================
   史萊姆捏捏工坊  —  捕捉 → 加工 → 裝飾 → 銷售(直播/網站) → 升級
   純前端：Canvas 2D + WebAudio，無需任何外部資源
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
// mix>0 往白色混、<0 往黑色混
function rgba(h, a = 1, mix = 0) {
  const [r, g, b] = hex2rgb(h), m = mix >= 0 ? 255 : 0, w = Math.abs(mix);
  return `rgba(${Math.round(r + (m - r) * w)},${Math.round(g + (m - g) * w)},${Math.round(b + (m - b) * w)},${a})`;
}
function seeded(seed) { let s = seed * 9301 + 49297; return () => (s = (s * 9301 + 49297) % 233280) / 233280; }
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

/* ---------- 資料 ---------- */
const ZONES = [
  { id: 'forest', name: '🌲 森林', cost: 0, bg: ['#cfeec0', '#5fa86a'], deco: ['🌲', '🌳', '🍄', '🌼'] },
  { id: 'coast', name: '🏖 海岸', cost: 400, bg: ['#bfe6ff', '#e8d9a8'], deco: ['🐚', '🌴', '⛵', '🦀'] },
  { id: 'volcano', name: '🌋 火山', cost: 1500, bg: ['#ffb38a', '#6b3a3a'], deco: ['🌋', '🔥', '🪨', '💥'] },
  { id: 'snow', name: '❄️ 雪原', cost: 3500, bg: ['#e8f6ff', '#9ec8e8'], deco: ['⛄', '❄️', '🌨', '🏔'] },
];
const RAR = [null, { n: '普通', c: '#a9a2cf' }, { n: '優良', c: '#7df0c8' }, { n: '稀有', c: '#ff8fc7' }, { n: '傳說', c: '#ffd36b' }];
const SPECIES = [
  { id: 'grass', name: '青草史萊姆', zone: 'forest', color: '#7ddc7a', rar: 1, price: 12, w: 10 },
  { id: 'honey', name: '蜂蜜史萊姆', zone: 'forest', color: '#ffc247', rar: 2, price: 22, w: 4 },
  { id: 'salt', name: '海鹽史萊姆', zone: 'coast', color: '#6fc3ff', rar: 1, price: 14, w: 10 },
  { id: 'coral', name: '珊瑚史萊姆', zone: 'coast', color: '#ff8fa3', rar: 3, price: 38, w: 3 },
  { id: 'lava', name: '熔岩史萊姆', zone: 'volcano', color: '#ff6a3d', rar: 2, price: 28, w: 8 },
  { id: 'obsid', name: '黑曜史萊姆', zone: 'volcano', color: '#8a5fd0', rar: 3, price: 50, w: 3 },
  { id: 'ice', name: '冰晶史萊姆', zone: 'snow', color: '#bfeaff', rar: 2, price: 30, w: 8 },
  { id: 'aurora', name: '極光史萊姆', zone: 'snow', color: '#9ef0d0', color2: '#c79bff', rar: 4, price: 90, w: 1 },
];
const SP = Object.fromEntries(SPECIES.map(s => [s.id, s]));
const DECO = {
  heart: { e: '❤️', v: .04, pack: 'base' }, star: { e: '⭐', v: .04, pack: 'base' }, flower: { e: '🌸', v: .05, pack: 'base' },
  strawberry: { e: '🍓', v: .07, pack: 'sweet' }, cherry: { e: '🍒', v: .07, pack: 'sweet' }, cake: { e: '🍰', v: .08, pack: 'sweet' },
  cat: { e: '🐱', v: .10, pack: 'cute' }, bunny: { e: '🐰', v: .10, pack: 'cute' }, ribbon: { e: '🎀', v: .10, pack: 'cute' },
  gem: { e: '💎', v: .16, pack: 'gem' }, crown: { e: '👑', v: .18, pack: 'gem' }, sparkle: { e: '✨', v: .14, pack: 'gem' },
  rainbow: { e: '🌈', v: .22, pack: 'sky' }, unicorn: { e: '🦄', v: .25, pack: 'sky' }, cloud: { e: '☁️', v: .18, pack: 'sky' },
};
const PACKS = { sweet: { name: '甜點裝飾包', cost: 200 }, cute: { name: '萌寵裝飾包', cost: 500 }, gem: { name: '寶石裝飾包', cost: 1500 }, sky: { name: '夢幻裝飾包', cost: 3000 } };
const UPS = {
  net: { name: '🕸 捕捉網', desc: '每次採集多得 1 份凝膠', base: 120, max: 4 },
  knife: { name: '🔪 精準刀具', desc: '加工的甜蜜區更寬', base: 150, max: 5 },
  cap: { name: '📦 庫存倉', desc: '庫存上限 +6', base: 100, max: 5 },
  shelf: { name: '🗄 網站貨架', desc: '網站貨架 +2 格', base: 200, max: 5 },
  gear: { name: '🎥 直播設備', desc: '直播基礎觀眾 +15%', base: 250, max: 5 },
  farm: { name: '🌱 史萊姆牧場', desc: '每 12 秒自動產出凝膠（可再生養殖）', base: 300, max: 5 },
};
const NAMES = ['小布丁', '軟糖控', '捏捏狂人', 'ASMR愛好者', '夜貓子', '蛋糕星人', '阿宅', 'Mochi', '果凍妹', '路過的人', '史萊姆粉', '雲朵', '薄荷', '咪咪', '大叔'];
const CHAT_CRUNCH = ['喀滋喀滋～好療癒', '這個聲音太爽了', '耳朵懷孕', '再捏一次！！', '好酥好脆', '我要睡著了 😴', '這顏色好美', '手感看起來超棒', '連擊連擊！', '哇啊啊'];
const CHAT_IDLE = ['晚安～', '第一次來，好可愛', '主播聲音好好聽', '今天有什麼新貨？', '想要那個顏色', '上架了嗎', '看著就解壓', '捏捏捏捏捏'];
const CHAT_EXPENSIVE = ['有點貴耶…', '價格能再便宜一點嗎', '錢包在哭泣'];
const REVIEWS = { 5: ['超酥脆！回購！', '聲音太療癒了', '完美，五星推薦'], 4: ['不錯，酥脆度很好', '包裝可愛', '值得'], 3: ['普通，還行', '價格普通', '有點軟'], 2: ['不太酥脆…', '有點貴', '期待落差'], 1: ['不脆，貴，失望', '品質不行', '不會再買'] };
const REG_NAMES = ['小綠', '阿花', '暖暖', '大叔', '貓店長', '莓莓', '阿山', '雪兒'];
const BRANCHES = {
  factory: { name: '🏭 自家工廠', desc: '雇用員工自動量產。重視產能與成本管理：員工會持續領薪水。' },
  corp: { name: '🏢 企業合作', desc: '承接大公司的訂單。收入穩定，但必須符合品質與期限，失敗會損失信譽。' },
  shop: { name: '🏪 溫馨小店', desc: '經營實體小店。著重顧客關係：記住常客喜好，培養熟客與小費。' },
};

/* ---------- 存檔狀態 ---------- */
const SAVE_KEY = 'slime_squish_v1';
function fresh() {
  return {
    money: 60, fans: 0, earned: 0, gel: {}, stock: [], web: [], price: { live: {}, web: {} },
    zones: ['forest'], packs: ['base'], up: { net: 0, knife: 0, cap: 0, shelf: 0, gear: 0, farm: 0 },
    codex: {}, rate: [4, 4, 5], reviews: [], branch: null, workers: 0, auto: 0, rep: 0,
    contracts: [], regulars: {}, customers: [], nextId: 1, last: Date.now(), done: false, sound: true, seen: false, sales: 0,
  };
}
function load() {
  try { const o = JSON.parse(localStorage.getItem(SAVE_KEY)); if (o) return Object.assign(fresh(), o, { up: Object.assign(fresh().up, o.up) }); } catch (e) { }
  return null;
}
let S = load() || fresh();
let saveTimer = 0;
function save() { S.last = Date.now(); try { localStorage.setItem(SAVE_KEY, JSON.stringify(S)); } catch (e) { } }

/* ---------- 經濟公式 ---------- */
const trend = { sp: null, t: 0 };
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
// 簡易需求曲線：價格 = 合理價 → 0.75；2 倍 → 0；半價 → 1.12
const demand = (price, f) => clamp(1.5 - 0.75 * price / Math.max(1, f), 0, 1.3);
const demandLabel = d => d > 0.95 ? ['🔥 熱賣', '#ff9a6b'] : d > 0.55 ? ['👍 穩定', '#7df0c8'] : d > 0.2 ? ['😐 冷淡', '#a9a2cf'] : ['❄️ 滯銷', '#6fc3ff'];
function unlockedSpecies() { return SPECIES.filter(s => S.zones.includes(s.zone)); }
function addMoney(n) { S.money += n; if (n > 0) S.earned += n; }
function makeProduct(spId, crisp) {
  const p = { id: S.nextId++, sp: spId, crisp, dur: 100, deco: [], cracks: [] };
  const c = S.codex[spId] || (S.codex[spId] = { seen: true, made: 0 }); c.made++;
  return p;
}

/* ---------- 音效（WebAudio 自製擬音，無外部素材） ---------- */
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
const sfx = {
  // 每次酥脆聲由 3~7 個隨機音高/頻段的碎裂顆粒疊加，避免聽覺疲乏
  crunch(power = 1, crisp = 0.8) {
    if (!S.sound) return; const ac = audio(), t = ac.currentTime;
    const n = 3 + Math.floor(Math.random() * (2 + 4 * crisp));
    for (let i = 0; i < n; i++) {
      const st = t + i * rnd(0.006, 0.03);
      noise(ac, st, rnd(0.03, 0.09), rnd(1800, 7000) * (0.7 + crisp * 0.5), rnd(0.8, 3), rnd(0.25, 0.6) * power, 'bandpass', rnd(0.7, 1.5));
    }
    noise(ac, t, 0.12, rnd(300, 600), 0.7, 0.25 * power, 'lowpass');
  },
  squish(s = 0.5) {
    if (!S.sound) return; const ac = audio(), t = ac.currentTime;
    noise(ac, t, rnd(0.08, 0.16), rnd(400, 900), 1.5, 0.18 * s, 'lowpass', rnd(.6, 1));
  },
  pop() {
    if (!S.sound) return; const ac = audio(), t = ac.currentTime;
    [660, 880, 1320].forEach((f, i) => {
      const o = ac.createOscillator(), g = ac.createGain(); o.type = 'sine'; o.frequency.value = f;
      g.gain.setValueAtTime(0.0001, t + i * 0.07); g.gain.linearRampToValueAtTime(0.18, t + i * 0.07 + 0.01); g.gain.exponentialRampToValueAtTime(0.0008, t + i * 0.07 + 0.25);
      o.connect(g); g.connect(master); o.start(t + i * 0.07); o.stop(t + i * 0.07 + 0.3);
    });
  },
  tick() {
    if (!S.sound) return; const ac = audio(), t = ac.currentTime;
    noise(ac, t, 0.05, 2500, 2, 0.2);
  },
  good() { sfx.pop(); },
};

/* ---------- Toast / Modal ---------- */
function toast(msg) {
  const d = document.createElement('div'); d.className = 'toast'; d.textContent = msg; $('#toasts').appendChild(d);
  setTimeout(() => d.remove(), 2200);
  while ($('#toasts').children.length > 4) $('#toasts').firstChild.remove();
}
function modal(html, btns = [{ t: '好', f: null }]) {
  $('#mbox').innerHTML = html + '<div class="row" id="mbtns"></div>';
  btns.forEach(b => {
    const e = document.createElement('button'); e.className = 'btn' + (b.ghost ? ' ghost' : ''); e.textContent = b.t;
    e.onclick = () => { $('#modal').hidden = true; b.f && b.f(); }; $('#mbtns').appendChild(e);
  });
  $('#modal').hidden = false;
}

/* ============================================================
   捏捏渲染器（半寫實：半透明凝膠、光澤、糖晶、裂紋、混合形變）
   形變以「頂點偏移彈簧」模擬，無即時軟體物理。
   ============================================================ */
function newBlob() { const N = 56; return { N, off: new Float32Array(N), vel: new Float32Array(N) }; }
function drawProduct(c, p, cx, cy, R, blob, t) {
  const sp = SP[p.sp], N = 56, n = 3.4, pts = [];
  for (let i = 0; i < N; i++) {
    const a = i / N * PI2, co = Math.cos(a), si = Math.sin(a);
    const rr = R / Math.pow(Math.pow(Math.abs(co), n) + Math.pow(Math.abs(si), n), 1 / n);
    const off = blob ? blob.off[i] : 0, w = Math.sin(t * 2 + i * 0.7) * 0.006;
    const r = rr * (1 + off + w);
    pts.push([cx + co * r, cy + si * r]);
  }
  const path = () => {
    c.beginPath();
    const m = (a, b) => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
    let s = m(pts[N - 1], pts[0]); c.moveTo(s[0], s[1]);
    for (let i = 0; i < N; i++) { const e = m(pts[i], pts[(i + 1) % N]); c.quadraticCurveTo(pts[i][0], pts[i][1], e[0], e[1]); }
    c.closePath();
  };
  // 陰影
  c.save(); c.fillStyle = 'rgba(0,0,0,.28)'; c.beginPath(); c.ellipse(cx, cy + R * 1.08, R * 0.95, R * 0.16, 0, 0, PI2); c.fill(); c.restore();
  // 本體（半透明）
  let g;
  if (sp.color2) { g = c.createLinearGradient(cx - R, cy - R, cx + R, cy + R); g.addColorStop(0, rgba(sp.color, .9, .25)); g.addColorStop(.5, rgba(sp.color2, .85)); g.addColorStop(1, rgba(sp.color, .9, -.1)); }
  else { g = c.createRadialGradient(cx - R * .35, cy - R * .4, R * .1, cx, cy, R * 1.25); g.addColorStop(0, rgba(sp.color, .88, .5)); g.addColorStop(.55, rgba(sp.color, .8)); g.addColorStop(1, rgba(sp.color, .92, -.28)); }
  path(); c.fillStyle = g; c.fill();
  c.save(); path(); c.clip();
  // 糖晶（以 id 為種子固定位置）
  const rd = seeded(p.id + 7);
  for (let i = 0; i < 38; i++) {
    const a = rd() * PI2, r = Math.sqrt(rd()) * R * .85, s = .6 + rd() * 1.8;
    c.fillStyle = `rgba(255,255,255,${.25 + rd() * .5})`; c.fillRect(cx + Math.cos(a) * r, cy + Math.sin(a) * r, s, s);
  }
  // 內部暗部 / 透光
  const g2 = c.createLinearGradient(cx, cy - R, cx, cy + R); g2.addColorStop(0, 'rgba(255,255,255,.35)'); g2.addColorStop(.45, 'rgba(255,255,255,0)'); g2.addColorStop(1, rgba(sp.color, .35, -.5));
  c.fillStyle = g2; c.fillRect(cx - R * 1.3, cy - R * 1.3, R * 2.6, R * 2.6);
  // 光澤
  c.save(); c.translate(cx - R * .42, cy - R * .5); c.rotate(-.6);
  const g3 = c.createRadialGradient(0, 0, 0, 0, 0, R * .42); g3.addColorStop(0, 'rgba(255,255,255,.75)'); g3.addColorStop(1, 'rgba(255,255,255,0)');
  c.fillStyle = g3; c.beginPath(); c.ellipse(0, 0, R * .42, R * .18, 0, 0, PI2); c.fill(); c.restore();
  // 裂紋（耐久度越低越多）
  c.strokeStyle = 'rgba(255,255,255,.7)'; c.lineWidth = 1.2; c.lineCap = 'round';
  p.cracks.forEach(cr => { c.beginPath(); for (let i = 0; i < cr.length; i += 2) { const x = cx + cr[i] * R, y = cy + cr[i + 1] * R; i ? c.lineTo(x, y) : c.moveTo(x, y); } c.stroke(); });
  c.restore();
  path(); c.strokeStyle = rgba(sp.color, .75, .6); c.lineWidth = 2; c.stroke();
  // 裝飾
  p.deco.forEach(d => {
    c.save(); c.translate(cx + d.x * R, cy + d.y * R); c.rotate(d.r); c.font = `${Math.round(R * .38 * d.s)}px serif`; c.textAlign = 'center'; c.textBaseline = 'middle';
    c.shadowColor = 'rgba(0,0,0,.35)'; c.shadowBlur = 4; c.fillText(DECO[d.k].e, 0, 0); c.restore();
  });
}

/* ---------- 舞台（共用於裝飾、直播） ---------- */
function makeStage(cv, mode) {
  const st = { cv, ctx: cv.getContext('2d'), mode, blob: newBlob(), p: null, w: 0, h: 0, R: 60, ptr: null, parts: [], rings: [], sel: -1, drag: null, onCrunch: null, onSel: null, t: 0 };
  st.resize = () => {
    const r = cv.getBoundingClientRect(); if (!r.width) return;
    const d = Math.min(window.devicePixelRatio || 1, 2); cv.width = r.width * d; cv.height = r.height * d;
    st.ctx.setTransform(d, 0, 0, d, 0, 0); st.w = r.width; st.h = r.height; st.R = Math.min(r.width, r.height) * 0.3;
  };
  st.set = p => { if (st.p !== p) { st.p = p; st.blob = newBlob(); st.sel = -1; st.parts = []; st.ptr = null; } };
  const pos = e => { const r = cv.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top }; };
  cv.addEventListener('pointerdown', e => {
    e.preventDefault(); if (!st.p) return; const q = pos(e), cx = st.w / 2, cy = st.h / 2;
    try { cv.setPointerCapture(e.pointerId); } catch (_) { }
    if (st.mode === 'squeeze') {
      if (Math.hypot(q.x - cx, q.y - cy) < st.R * 1.35) { st.ptr = { x: q.x, y: q.y, s: 0, fired: false, lx: q.x, ly: q.y }; sfx.squish(); }
    } else {
      st.drag = null; const ds = st.p.deco;
      for (let i = ds.length - 1; i >= 0; i--) {
        const d = ds[i]; if (Math.hypot(q.x - (cx + d.x * st.R), q.y - (cy + d.y * st.R)) < st.R * .22 * d.s + 12) { st.sel = i; st.drag = { ox: q.x - (cx + d.x * st.R), oy: q.y - (cy + d.y * st.R) }; break; }
      }
      if (!st.drag) st.sel = -1; st.onSel && st.onSel();
    }
  });
  cv.addEventListener('pointermove', e => {
    const q = pos(e);
    if (st.ptr) { st.ptr.x = q.x; st.ptr.y = q.y; }
    if (st.drag && st.sel >= 0 && st.p) { const d = st.p.deco[st.sel]; d.x = clamp((q.x - st.drag.ox - st.w / 2) / st.R, -1.15, 1.15); d.y = clamp((q.y - st.drag.oy - st.h / 2) / st.R, -1.15, 1.15); }
  });
  const up = () => { st.ptr = null; st.drag = null; };
  cv.addEventListener('pointerup', up); cv.addEventListener('pointercancel', up);
  st.crunchAt = (x, y) => {
    const p = st.p; if (!p) return;
    if (p.dur <= 0) { sfx.squish(1); return; }
    const eff = effCrisp(p), R = st.R, cx = st.w / 2, cy = st.h / 2;
    sfx.crunch(0.6 + eff * 0.6, eff); if (navigator.vibrate) navigator.vibrate(12);
    p.dur = Math.max(0, p.dur - 2.2);
    let rx = (x - cx) / R, ry = (y - cy) / R, a = rnd(0, PI2); const cr = [rx, ry];
    for (let k = 0; k < 4; k++) { a += rnd(-.8, .8); const l = rnd(.08, .2); rx += Math.cos(a) * l; ry += Math.sin(a) * l; cr.push(rx, ry); }
    p.cracks.push(cr); if (p.cracks.length > 26) p.cracks.shift();
    const col = SP[p.sp].color, cnt = Math.round(6 + eff * 10);
    for (let i = 0; i < cnt; i++) st.parts.push({ x, y, vx: rnd(-170, 170), vy: rnd(-280, -60), l: 1, sz: rnd(2, 5), col: Math.random() < .5 ? rgba(col, 1, .5) : '#fff', r: rnd(0, 6) });
    st.rings.push({ x, y, t: 0 });
    st.onCrunch && st.onCrunch(st, eff);
  };
  st.update = dt => {
    dt = Math.min(dt, 0.033); st.t += dt; const b = st.blob, N = b.N, cx = st.w / 2, cy = st.h / 2;
    let pa = 0, s = 0;
    if (st.ptr) {
      const q = st.ptr; s = q.s = Math.min(1, q.s + dt * 5);
      pa = (Math.atan2(q.y - cy, q.x - cx) + PI2) % PI2;
      if (s > 0.7 && !q.fired) { q.fired = true; q.lx = q.x; q.ly = q.y; st.crunchAt(q.x, q.y); }
      else if (q.fired && Math.hypot(q.x - q.lx, q.y - q.ly) > 45) { q.lx = q.x; q.ly = q.y; st.crunchAt(q.x, q.y); }
    }
    for (let i = 0; i < N; i++) {
      let tg = 0;
      if (st.ptr) { let da = Math.abs(i / N * PI2 - pa); if (da > Math.PI) da = PI2 - da; tg = -Math.exp(-da * da / 0.4) * s * 0.3 - s * 0.03; }
      b.vel[i] += (tg - b.off[i]) * 220 * dt; b.vel[i] *= Math.exp(-8 * dt); b.off[i] += b.vel[i] * dt;
    }
    st.parts = st.parts.filter(q => { q.vy += 900 * dt; q.x += q.vx * dt; q.y += q.vy * dt; q.l -= dt * 1.3; q.r += dt * 8; return q.l > 0; });
    st.rings = st.rings.filter(q => (q.t += dt) < .45);
  };
  st.draw = () => {
    const c = st.ctx; c.clearRect(0, 0, st.w, st.h); const cx = st.w / 2, cy = st.h / 2;
    if (!st.p) { c.fillStyle = '#a9a2cf'; c.font = '15px sans-serif'; c.textAlign = 'center'; c.fillText(st.mode === 'squeeze' ? '請從下方庫存選一個捏捏上台' : '請從下方選擇要裝飾的捏捏', cx, cy); return; }
    drawProduct(c, st.p, cx, cy, st.R, st.blob, st.t);
    if (st.mode === 'decor' && st.sel >= 0 && st.p.deco[st.sel]) {
      const d = st.p.deco[st.sel]; c.save(); c.strokeStyle = '#7df0c8'; c.setLineDash([5, 4]); c.lineWidth = 2; c.beginPath(); c.arc(cx + d.x * st.R, cy + d.y * st.R, st.R * .22 * d.s + 8, 0, PI2); c.stroke(); c.restore();
    }
    st.rings.forEach(q => { c.strokeStyle = `rgba(255,255,255,${.7 * (1 - q.t / .45)})`; c.lineWidth = 2; c.beginPath(); c.arc(q.x, q.y, 8 + q.t * 120, 0, PI2); c.stroke(); });
    st.parts.forEach(q => { c.save(); c.globalAlpha = clamp(q.l, 0, 1); c.translate(q.x, q.y); c.rotate(q.r); c.fillStyle = q.col; c.fillRect(-q.sz / 2, -q.sz / 2, q.sz, q.sz * .7); c.restore(); });
  };
  return st;
}

/* ============================================================
   捕捉場景
   ============================================================ */
const F = { zone: 'forest', slimes: [], fx: [], t: 0, rot: 0, w: 0, h: 0, cv: $('#fieldCv'), farm: 0 };
F.ctx = F.cv.getContext('2d');
function resizeField() {
  const r = F.cv.getBoundingClientRect(); if (!r.width) return; const d = Math.min(devicePixelRatio || 1, 2);
  F.cv.width = r.width * d; F.cv.height = r.height * d; F.ctx.setTransform(d, 0, 0, d, 0, 0); F.w = r.width; F.h = r.height;
}
function spawnSlime() {
  const list = SPECIES.filter(s => s.zone === F.zone); let tot = list.reduce((a, s) => a + s.w, 0), r = Math.random() * tot, sp = list[0];
  for (const s of list) { if ((r -= s.w) <= 0) { sp = s; break; } }
  return { sp, x: rnd(.12, .88), y: rnd(.42, .88), vx: rnd(-.04, .04), ph: rnd(0, 6), hits: 0, cool: 0, sq: 0 };
}
function fillField() { F.slimes = []; for (let i = 0; i < 6; i++) F.slimes.push(spawnSlime()); }
fillField();
function harvest(sl) {
  const n = 1 + S.up.net; S.gel[sl.sp.id] = (S.gel[sl.sp.id] || 0) + n;
  if (!S.codex[sl.sp.id]) S.codex[sl.sp.id] = { seen: true, made: 0 };
  sl.cool = 5; sl.hits = 0; F.fx.push({ x: sl.x, y: sl.y, txt: `+${n} 凝膠`, t: 0 }); sfx.pop(); renderGelBar();
}
$('#fieldCv').addEventListener('pointerdown', e => {
  e.preventDefault(); const r = F.cv.getBoundingClientRect(), x = e.clientX - r.left, y = e.clientY - r.top;
  let best = null, bd = 1e9;
  F.slimes.forEach(sl => { const rad = Math.min(F.w, F.h) * .09, dx = x - sl.x * F.w, dy = y - (sl.y * F.h - rad * .5), d = Math.hypot(dx, dy); if (d < rad * 1.4 && d < bd) { best = sl; bd = d; } });
  if (!best) return;
  if (best.cool > 0) { F.fx.push({ x: best.x, y: best.y, txt: '害羞中…', t: 0 }); return; }
  best.hits++; best.sq = 1; sfx.squish(.8); if (navigator.vibrate) navigator.vibrate(8);
  if (best.hits >= 3) harvest(best); else F.fx.push({ x: best.x, y: best.y, txt: '·'.repeat(best.hits), t: 0 });
});
function updateField(dt) {
  F.t += dt; F.rot += dt;
  F.slimes.forEach(s => { s.ph += dt * 3; s.x += s.vx * dt; if (s.x < .08 || s.x > .92) s.vx *= -1; s.cool = Math.max(0, s.cool - dt); s.sq = Math.max(0, s.sq - dt * 3); if (Math.random() < dt * .3) s.vx = rnd(-.05, .05); });
  if (F.rot > 25) { F.rot = 0; F.slimes[Math.floor(Math.random() * F.slimes.length)] = spawnSlime(); }
  F.fx = F.fx.filter(f => (f.t += dt) < 1);
}
function drawField() {
  const c = F.ctx, w = F.w, h = F.h; if (!w) return; const z = ZONES.find(z => z.id === F.zone);
  const g = c.createLinearGradient(0, 0, 0, h); g.addColorStop(0, z.bg[0]); g.addColorStop(1, z.bg[1]); c.fillStyle = g; c.fillRect(0, 0, w, h);
  c.font = `${Math.round(h * .12)}px serif`; c.textAlign = 'center';
  const rd = seeded(z.id.length * 31); for (let i = 0; i < 9; i++) c.fillText(z.deco[i % 4], rd() * w, h * (.18 + rd() * .22));
  F.slimes.slice().sort((a, b) => a.y - b.y).forEach(s => {
    const rad = Math.min(w, h) * .09, x = s.x * w, ph = Math.abs(Math.sin(s.ph)), hop = s.cool > 0 ? 0 : ph * rad * .35;
    const y = s.y * h - hop, sqx = 1 + s.sq * .25 + (s.cool > 0 ? -.1 : 0), sqy = 1 - s.sq * .25 - (s.cool > 0 ? .15 : 0) + (s.cool > 0 ? 0 : ph * .08);
    c.save(); c.fillStyle = 'rgba(0,0,0,.2)'; c.beginPath(); c.ellipse(x, s.y * h + 2, rad * .9, rad * .22, 0, 0, PI2); c.fill();
    c.translate(x, y); c.scale(sqx, sqy); c.globalAlpha = s.cool > 0 ? .6 : 1;
    const col = s.sp.color; let gr = c.createRadialGradient(-rad * .3, -rad * 1.1, rad * .1, 0, -rad * .5, rad * 1.4);
    gr.addColorStop(0, rgba(col, .95, .55)); gr.addColorStop(.6, rgba(col, .9)); gr.addColorStop(1, rgba(s.sp.color2 || col, .95, -.25));
    c.fillStyle = gr; c.beginPath(); c.moveTo(-rad, 0); c.bezierCurveTo(-rad, -rad * 1.5, rad, -rad * 1.5, rad, 0); c.quadraticCurveTo(0, rad * .25, -rad, 0); c.fill();
    c.strokeStyle = rgba(col, .8, .6); c.lineWidth = 1.5; c.stroke();
    c.fillStyle = 'rgba(255,255,255,.7)'; c.beginPath(); c.ellipse(-rad * .4, -rad * 1.0, rad * .22, rad * .1, -.6, 0, PI2); c.fill();
    c.fillStyle = '#2a1f3d'; c.beginPath(); c.arc(-rad * .32, -rad * .5, rad * .1, 0, PI2); c.arc(rad * .32, -rad * .5, rad * .1, 0, PI2); c.fill();
    c.fillStyle = '#fff'; c.beginPath(); c.arc(-rad * .29, -rad * .53, rad * .035, 0, PI2); c.arc(rad * .35, -rad * .53, rad * .035, 0, PI2); c.fill();
    c.strokeStyle = '#2a1f3d'; c.lineWidth = 1.5; c.beginPath(); c.arc(0, -rad * .35, rad * .12, .2, Math.PI - .2); c.stroke();
    c.restore();
    if (s.hits > 0 && s.cool <= 0) { c.fillStyle = '#fff'; c.fillRect(x - rad, y + rad * .2, rad * 2, 4); c.fillStyle = '#7df0c8'; c.fillRect(x - rad, y + rad * .2, rad * 2 * s.hits / 3, 4); }
    const rr = RAR[s.sp.rar]; c.font = '11px sans-serif'; c.fillStyle = rr.c; c.fillText(rr.n, x, y - rad * 1.6);
  });
  F.fx.forEach(f => { c.globalAlpha = 1 - f.t; c.fillStyle = '#fff'; c.font = 'bold 15px sans-serif'; c.strokeStyle = '#000a'; c.lineWidth = 3; c.strokeText(f.txt, f.x * w, f.y * h - 50 - f.t * 40); c.fillText(f.txt, f.x * w, f.y * h - 50 - f.t * 40); c.globalAlpha = 1; });
}

/* ============================================================
   加工小遊戲
   ============================================================ */
const STEPS = ['🔪 切片', '🍬 裹糖晶', '🔥 乾燥'];
const M = { sp: null, step: -1, pos: 0, dir: 1, spd: 1, c: .5, prec: [], active: false, last: null };
function zoneHalf() { return 0.12 + 0.03 * S.up.knife; }
function startMake() {
  const sp = M.sp; if (!sp || (S.gel[sp] || 0) < 2) return toast('凝膠不足（需要 2 份）');
  if (S.stock.length >= cap()) return toast('庫存已滿，請先銷售或擴充庫存倉');
  S.gel[sp] -= 2; M.step = 0; M.prec = []; M.active = true; M.last = null; nextStep(); renderGelBar(); renderMake();
}
function nextStep() { M.pos = 0; M.dir = 1; M.spd = 0.9 + 0.4 * M.step; M.c = rnd(.3, .7); }
function stopBar() {
  if (!M.active) return; const d = Math.abs(M.pos - M.c), w = zoneHalf();
  const pr = d <= w ? 0.85 + 0.15 * (1 - d / w) : Math.max(0, 0.85 * (1 - (d - w) / 0.4));
  M.prec.push(pr); sfx.crunch(.5 + pr * .5, pr); toast(`${STEPS[M.step]}：${pr > .95 ? '完美！' : pr > .8 ? '很好' : pr > .5 ? '普通' : '歪了…'}`);
  M.step++;
  if (M.step >= 3) {
    M.active = false; const avg = M.prec.reduce((a, b) => a + b, 0) / 3, crisp = 0.15 + 0.85 * avg;
    const p = makeProduct(M.sp, crisp); S.stock.push(p); M.last = p; save(); sfx.good();
  } else nextStep();
  renderMake();
}
function renderMake() {
  const list = unlockedSpecies();
  $('#gelPick').innerHTML = list.map(s => `<button class="zbtn ${M.sp === s.id ? 'on' : ''}" data-act="pickSp" data-id="${s.id}" ${M.active ? 'disabled' : ''}>
    <span style="color:${s.color}">●</span> ${s.name.replace('史萊姆', '')}<br><small>凝膠 ${S.gel[s.id] || 0}</small></button>`).join('');
  const mini = $('#mini');
  if (M.active) {
    const half = zoneHalf();
    mini.innerHTML = `<div class="steps">${STEPS.map((s, i) => `<span class="${i === M.step ? 'on' : i < M.step ? 'done' : ''}">${s}</span>`).join('')}</div>
    <div class="bar" id="mbar"><div class="zone" style="left:${(M.c - half) * 100}%;width:${half * 200}%"></div><div class="cur" id="mcur"></div></div>
    <button class="btn big" style="width:100%" data-act="stopBar">停！（或按空白鍵）</button>`;
  } else {
    mini.innerHTML = `<div class="row"><div class="grow small">${M.sp ? `已選：<b>${SP[M.sp].name}</b>　消耗 2 凝膠` : '請先選擇要加工的凝膠'}<br>庫存 ${S.stock.length}/${cap()}</div>
    <button class="btn" data-act="startMake" ${!M.sp || (S.gel[M.sp] || 0) < 2 ? 'disabled' : ''}>開始加工</button></div>`;
  }
  const r = $('#makeResult');
  if (M.last && !M.active) {
    const p = M.last, pct = Math.round(p.crisp * 100);
    r.innerHTML = `<div class="card row"><canvas id="resCv" width="140" height="140" style="width:110px;height:110px"></canvas>
      <div class="grow"><b>${SP[p.sp].name}・酥脆捏捏</b><br>酥脆度 <b style="color:var(--gold)">${pct}%</b>　${pct >= 90 ? '🌟 極品！' : pct >= 70 ? '👍 優良' : '再接再厲'}<br>
      <small>合理價約 ${fmt(fair(p, 'live'))}（直播）</small><div class="row" style="margin-top:8px"><button class="btn sm" data-act="goDecor" data-id="${p.id}">🎀 去裝飾</button><button class="btn sm ghost" data-act="tab" data-tab="live">📺 去直播</button></div></div></div>`;
    const cv = $('#resCv'); if (cv) { const c = cv.getContext('2d'); c.clearRect(0, 0, 140, 140); drawProduct(c, p, 70, 66, 44, null, 0); }
  } else r.innerHTML = '';
}

/* ============================================================
   庫存卡片
   ============================================================ */
function swatch(sp) { return sp.color2 ? `linear-gradient(135deg,${sp.color},${sp.color2})` : `radial-gradient(circle at 30% 30%,${rgba(sp.color, 1, .6)},${sp.color})`; }
function itemHTML(p, act, selId, extra = '') {
  const sp = SP[p.sp];
  return `<div class="card item ${selId === p.id ? 'sel' : ''}" data-act="${act}" data-id="${p.id}">
    <div class="sw" style="background:${swatch(sp)}"></div>
    <div><div class="nm">${sp.name.replace('史萊姆', '')}</div>
    <div class="meta">酥脆 ${Math.round(effCrisp(p) * 100)}% · 耐久 ${Math.round(p.dur)}%</div>
    <div class="meta">${p.deco.map(d => DECO[d.k].e).join('') || '無裝飾'} · 約 ${fmt(fair(p, 'live'))}${extra}</div></div></div>`;
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
  const p = decorSt.p, box = $('#decoTools');
  if (!p) { box.innerHTML = '<div class="empty">選擇捏捏後即可擺放裝飾（拖曳移動）。</div>'; return; }
  const pal = Object.keys(DECO).map(k => `<button data-act="addDeco" data-k="${k}" ${S.packs.includes(DECO[k].pack) ? '' : 'disabled title="到「升級」解鎖"'}>${DECO[k].e}</button>`).join('');
  const d = p.deco[decorSt.sel];
  box.innerHTML = `<div class="small">裝飾 ${p.deco.length}/6　加成 <b style="color:var(--gold)">+${Math.round(decoBonus(p) * 100)}%</b> 售價與人氣</div><div class="pal">${pal}</div>` +
    (d ? `<div class="small">縮放</div><input type="range" min="0.5" max="2" step="0.05" value="${d.s}" data-r="s"><div class="small">旋轉</div><input type="range" min="-3.14" max="3.14" step="0.05" value="${d.r}" data-r="r">
    <div class="row" style="margin-top:6px"><button class="btn sm red" data-act="delDeco">移除此裝飾</button></div>` : '<div class="hint">點選捏捏上的裝飾可調整大小、旋轉或移除。</div>') +
    `<div class="row" style="margin-top:6px"><button class="btn sm" data-act="photo">📸 拍照模式（下載圖片）</button></div>`;
}
document.addEventListener('input', e => {
  const r = e.target.dataset && e.target.dataset.r; if (!r) return; const p = decorSt.p; if (!p) return; const d = p.deco[decorSt.sel]; if (d) d[r] = +e.target.value;
});

/* ============================================================
   直播
   ============================================================ */
const liveSt = makeStage($('#liveCv'), 'squeeze');
const L = { on: false, hype: 0, viewers: 0, combo: 0, lastC: 0, stageId: null, saleT: 0, req: null, reqT: 18, chatT: 0, trendT: 0 };
function chat(who, txt, cls) {
  const box = $('#chat'); const d = document.createElement('div'); d.innerHTML = `<b>${esc(who)}</b>：${esc(txt)}`; box.appendChild(d);
  while (box.children.length > 40) box.firstChild.remove(); box.scrollTop = box.scrollHeight;
  if (Math.random() < 0.45 || cls === 'dm') {
    const dm = document.createElement('div'); dm.className = 'dmk'; dm.textContent = txt; dm.style.top = rnd(0, 75) + '%'; dm.style.color = pick(['#fff', '#ffd36b', '#7df0c8', '#ff8fc7']);
    $('#danmaku').appendChild(dm); setTimeout(() => dm.remove(), 7200);
  }
}
liveSt.onCrunch = (st, eff) => {
  if (!L.on) return; const now = performance.now();
  L.combo = now - L.lastC < 1200 ? L.combo + 1 : 1; L.lastC = now;
  L.hype = Math.min(100, L.hype + 5 + Math.min(L.combo, 20) * .4);
  if (Math.random() < .4) chat(pick(NAMES), pick(CHAT_CRUNCH));
  if (Math.random() < .05 * clamp(L.viewers / 30, .3, 2)) {
    const n = Math.round(rnd(5, 30) * (1 + L.combo / 10)); addMoney(n); S.fans += 0.3; sfx.tick();
    const e = document.createElement('div'); e.className = 'don'; e.textContent = `🎁 ${pick(NAMES)} 打賞 ${fmt(n)}`; $('#donate').appendChild(e); setTimeout(() => e.remove(), 3000);
    while ($('#donate').children.length > 3) $('#donate').firstChild.remove();
  }
  renderTop();
};
function renderLive() {
  if (L.stageId && !stockById(L.stageId)) L.stageId = null;
  liveSt.set(stockById(L.stageId) || null);
  $('#liveStock').innerHTML = S.stock.length ? S.stock.map(q => itemHTML(q, 'stageSel', L.stageId)).join('') : '<div class="empty">庫存是空的，先去「加工」做捏捏。</div>';
  $('#livePrice').innerHTML = priceTable('live');
  $('#btnLive').textContent = L.on ? '⏹ 結束直播' : '🔴 開始直播';
  updateLiveHUD();
}
function updateLiveHUD() {
  $('#liveBadge').textContent = L.on ? '● LIVE' : 'OFF AIR'; $('#liveBadge').className = 'badge' + (L.on ? ' on' : '');
  $('#liveViewers').textContent = '👁 ' + Math.round(L.viewers);
  $('#hypeBar').style.width = L.hype + '%'; $('#comboTxt').textContent = L.combo > 2 && L.on ? `🔥 ${L.combo} 連擊` : '';
  const p = liveSt.p;
  $('#stageInfo').innerHTML = p ? `上台：<b>${SP[p.sp].name}</b>　酥脆 ${Math.round(effCrisp(p) * 100)}%　耐久 ${Math.round(p.dur)}%<br>售價 <b>${fmt(getPrice('live', p.sp))}</b>（合理價 ${fmt(fair(p, 'live'))}）` : '尚未選擇捏捏';
  const rb = $('#reqBox');
  if (L.req && L.on) { rb.innerHTML = `<span class="reqb">🎯 觀眾指定：${L.req.text}　⏱ ${Math.ceil(L.req.t)}s　（成交 ×1.8）</span>`; } else rb.innerHTML = '';
}
function reqMatch(p) { return L.req && (L.req.kind === 'sp' ? p.sp === L.req.sp : effCrisp(p) >= .7); }
function liveSale(p) {
  let price = getPrice('live', p.sp), bonus = 1;
  if (reqMatch(p)) { bonus = 1.8; L.req = null; S.fans += 3; chat('系統', '🎯 指定任務完成！限時銷售成交！', 'dm'); }
  const gain = price * bonus; addMoney(gain); S.sales++; S.fans += 1 + L.hype / 30;
  S.stock = S.stock.filter(q => q !== p); sfx.pop();
  chat(pick(NAMES), `買了${SP[p.sp].name.replace('史萊姆', '')}捏捏！${fmt(gain)}`, 'dm'); toast(`📺 直播成交 +${fmt(gain)}`);
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
        const prob = clamp(L.viewers / 60, 0, 1) * d * .45 * (.4 + L.hype / 80); if (Math.random() < prob) liveSale(p);
      }
    }
    L.chatT -= dt; if (L.chatT <= 0) { L.chatT = rnd(1.5, 4) / clamp(L.viewers / 20, .5, 4); chat(pick(NAMES), pick(CHAT_IDLE)); }
    if (L.req) { L.req.t -= dt; if (L.req.t <= 0) { L.req = null; chat('系統', '指定任務已結束', 'dm'); } }
    else { L.reqT -= dt; if (L.reqT <= 0) { L.reqT = rnd(25, 40); const us = unlockedSpecies(); if (Math.random() < .6) { const sp = pick(us); L.req = { kind: 'sp', sp: sp.id, t: 40, text: `要「${sp.name}」` }; } else L.req = { kind: 'cr', t: 40, text: '要酥脆度 ≥ 70% 的' }; chat('系統', '🎯 新的觀眾指定：' + L.req.text, 'dm'); } }
  } else { L.hype = Math.max(0, L.hype - 10 * dt); L.viewers = Math.max(0, L.viewers - dt * 10); L.combo = 0; L.req = null; }
}

/* ============================================================
   定價表（直播 / 網站共用）
   ============================================================ */
function priceTable(ch) {
  const list = SPECIES.filter(s => S.codex[s.id]); if (!list.length) return '<div class="empty">尚未收集任何史萊姆。</div>';
  return list.map(s => {
    const ref = { sp: s.id, crisp: .8, dur: 100, deco: [] }, f = fair(ref, ch), d = demand(getPrice(ch, s.id), f), l = demandLabel(d);
    return `<div class="prow"><span class="nm"><span style="color:${s.color}">●</span> ${s.name}${trend.sp === s.id ? ' 🔥' : ''}<br><small style="color:var(--sub)">基準合理價 ${fmt(f)}</small></span>
      <input type="number" min="1" max="99999" value="${getPrice(ch, s.id)}" data-price="${ch}" data-sp="${s.id}"><span class="dem" style="color:${l[1]}">${l[0]}</span></div>`;
  }).join('');
}
document.addEventListener('change', e => {
  const t = e.target; if (!t.dataset || !t.dataset.price) return; S.price[t.dataset.price][t.dataset.sp] = clamp(Math.round(+t.value) || 1, 1, 99999); save();
  t.dataset.price === 'live' ? renderLive() : renderWeb();
});

/* ============================================================
   網站（被動銷售）
   ============================================================ */
const rating = () => { const a = S.rate.slice(-20); return a.reduce((x, y) => x + y, 0) / a.length; };
function webTick() {
  if (!S.web.length) return null;
  const prob = clamp(0.25 + S.fans / 400 + (rating() - 3) * .1, .05, .9); if (Math.random() > prob) return null;
  const p = pick(S.web), f = fair(p, 'web'), price = getPrice('web', p.sp), d = demand(price, f);
  if (Math.random() > d * .7) return null;
  addMoney(price); S.sales++; S.fans += .3; S.web = S.web.filter(q => q !== p);
  const eff = effCrisp(p), stars = clamp(Math.round(1 + 2.2 * eff + 1.8 * clamp(f / price, 0, 1.3)), 1, 5);
  S.rate.push(stars); if (S.rate.length > 40) S.rate.shift();
  const rv = { s: stars, t: pick(REVIEWS[stars]), who: pick(NAMES), sp: SP[p.sp].name }; S.reviews.unshift(rv); S.reviews.length = Math.min(S.reviews.length, 8);
  return { price, stars };
}
function renderWeb() {
  const r = rating();
  $('#webInfo').innerHTML = `<div class="row"><div class="grow">店鋪評分 <b class="stars">${'★'.repeat(Math.round(r))}${'☆'.repeat(5 - Math.round(r))}</b> ${r.toFixed(1)}　粉絲 ⭐${Math.floor(S.fans)}</div><div class="small">貨架 ${S.web.length}/${slots()}</div></div>`;
  $('#webShelf').innerHTML = S.web.length ? S.web.map(p => itemHTML(p, 'unlist', null, ` · 賣 ${fmt(getPrice('web', p.sp))}`)).join('') : '<div class="empty">貨架空空如也，從下方上架商品。</div>';
  $('#webStock').innerHTML = S.stock.length ? S.stock.map(p => itemHTML(p, 'list', null)).join('') : '<div class="empty">庫存是空的。</div>';
  $('#webPrice').innerHTML = priceTable('web');
  $('#reviews').innerHTML = S.reviews.length ? S.reviews.map(v => `<div><span class="stars">${'★'.repeat(v.s)}</span> ${esc(v.who)}：${esc(v.t)} <small style="color:var(--sub)">（${v.sp}）</small></div>`).join('') : '尚無評價';
}

/* ============================================================
   升級 / 解鎖
   ============================================================ */
const upCost = k => Math.round(UPS[k].base * Math.pow(1.7, S.up[k]));
function renderUp() {
  let h = Object.keys(UPS).map(k => {
    const u = UPS[k], lv = S.up[k], max = lv >= u.max;
    return `<div class="card up"><div class="info"><b>${u.name}</b> <span class="tag">Lv ${lv}/${u.max}</span><div class="small" style="color:var(--sub)">${u.desc}</div></div>
      <button class="btn sm" data-act="buyUp" data-k="${k}" ${max || S.money < upCost(k) ? 'disabled' : ''}>${max ? '已滿級' : fmt(upCost(k))}</button></div>`;
  }).join('');
  h += '<h3>裝飾包</h3>' + Object.keys(PACKS).map(k => {
    const has = S.packs.includes(k), pk = PACKS[k], em = Object.values(DECO).filter(d => d.pack === k).map(d => d.e).join('');
    return `<div class="card up"><div class="info"><b>${pk.name}</b> ${em}<div class="small" style="color:var(--sub)">稀有裝飾提供更高的售價加成</div></div>
      <button class="btn sm" data-act="buyPack" data-k="${k}" ${has || S.money < pk.cost ? 'disabled' : ''}>${has ? '已擁有' : fmt(pk.cost)}</button></div>`;
  }).join('');
  $('#upList').innerHTML = h;
}

/* ============================================================
   中期三線：工廠 / 企業合作 / 小店
   ============================================================ */
const branchReady = () => !S.branch && S.earned >= 2500 && S.fans >= 60;
function checkBranch() {
  $('#navBranch').hidden = !(S.branch || branchReady());
  if (branchReady() && !S.seen_branch) {
    S.seen_branch = true;
    modal(`<h2>🌟 工坊的轉捩點</h2><p>你的捏捏已經小有名氣，累積營收 ${fmt(S.earned)}、粉絲 ${Math.floor(S.fans)}。<br>三條道路擺在眼前，它們的玩法與劇情都不同（一旦選擇就無法更改）：</p>
    <p>${Object.values(BRANCHES).map(b => `<b>${b.name}</b>：${b.desc}`).join('<br><br>')}</p><p>請到下方「事業」頁籤做出選擇。</p>`);
  }
}
function renderBranch() {
  const box = $('#branchBody');
  if (!S.branch) {
    box.innerHTML = `<h2>選擇你的事業道路</h2><div class="bgroup">${Object.keys(BRANCHES).map(k => `<div class="card"><b>${BRANCHES[k].name}</b><div class="small" style="color:var(--sub);margin:6px 0">${BRANCHES[k].desc}</div>
      <button class="btn" data-act="chooseBranch" data-k="${k}">選擇此道路</button></div>`).join('')}</div>`;
    return;
  }
  if (S.branch === 'factory') {
    const hc = Math.round(400 * Math.pow(1.5, S.workers)), ac = Math.round(600 * Math.pow(1.8, S.auto));
    box.innerHTML = `<h2>🏭 自家工廠</h2><div class="hint">員工每 12 秒自動消耗 2 凝膠製作 1 個捏捏（品質取決於自動化等級），並持續領薪（每人 ¥3/分鐘）。凝膠不足或庫存滿時停工。請用牧場維持凝膠供應。</div>
    <div class="card"><div class="row"><div class="grow">員工 <b>${S.workers}</b> 人　薪資 ${fmt(S.workers * 3)}/分<br>自動化 Lv${S.auto}（品質 ${Math.round((0.55 + 0.05 * S.auto) * 100)}%）</div></div>
    <div class="row" style="margin-top:8px"><button class="btn sm" data-act="hire" ${S.money < hc || S.workers >= 12 ? 'disabled' : ''}>雇用員工 ${fmt(hc)}</button>
    <button class="btn sm" data-act="auto" ${S.money < ac || S.auto >= 8 ? 'disabled' : ''}>升級自動化 ${fmt(ac)}</button></div></div>
    <div class="card small">庫存 ${S.stock.length}/${cap()}　凝膠合計 ${Object.values(S.gel).reduce((a, b) => a + b, 0)}</div>`;
  } else if (S.branch === 'corp') {
    box.innerHTML = `<h2>🏢 企業合作</h2><div class="hint">大公司定期釋出訂單，報酬約為合理價 ×1.5，但需在期限內交付足夠品質的商品。逾期會損失信譽（信譽越高，要求與報酬都越高）。</div>
    <div class="card small">企業信譽 <b>${S.rep}</b>　承接中 ${S.contracts.length}/3</div>` +
      (S.contracts.length ? S.contracts.map(c => {
        const ok = contractItems(c); return `<div class="card"><b>${c.sp === 'any' ? '任意種類' : SP[c.sp].name}</b> × ${c.n}　酥脆 ≥ ${Math.round(c.min * 100)}%<br>報酬 <b style="color:var(--gold)">${fmt(c.reward)}</b>　剩餘 ${Math.max(0, Math.ceil((c.dl - Date.now()) / 1000))} 秒
        <div class="row" style="margin-top:6px"><span class="small grow">符合庫存 ${ok.length}/${c.n}</span><button class="btn sm" data-act="deliver" data-id="${c.id}" ${ok.length < c.n ? 'disabled' : ''}>交貨</button></div></div>`;
      }).join('') : '<div class="empty">目前沒有訂單，請稍候…</div>');
  } else {
    box.innerHTML = `<h2>🏪 溫馨小店</h2><div class="hint">顧客會上門指定想要的種類。記住熟客並滿足他們，可累積好感度，熟客會給更高價與小費。顧客等太久會失望離開。</div>
    <div class="card small">常客 ${Object.values(S.regulars).filter(v => v >= 5).length} 位　（好感≥5 為熟客）</div>` +
      (S.customers.length ? S.customers.map(c => {
        const ok = shopItem(c), aff = S.regulars[c.name] || 0; return `<div class="card"><b>${esc(c.name)}</b> ${aff >= 5 ? '💖熟客' : ''} <small style="color:var(--sub)">好感 ${aff}</small><br>想要：<b>${SP[c.sp].name}</b>　酥脆 ≥ ${Math.round(c.min * 100)}%
        <div class="meter2" style="margin:6px 0"><i style="width:${clamp((c.dl - Date.now()) / 450, 0, 100)}%"></i></div>
        <button class="btn sm" data-act="serve" data-id="${c.id}" ${ok ? '' : 'disabled'}>${ok ? `出貨 ${fmt(shopPrice(c, ok))}` : '庫存無符合商品'}</button></div>`;
      }).join('') : '<div class="empty">店裡暫時沒有客人…</div>');
  }
}
function contractItems(c) { return S.stock.filter(p => (c.sp === 'any' || p.sp === c.sp) && effCrisp(p) >= c.min).sort((a, b) => effCrisp(a) - effCrisp(b)).slice(0, c.n); }
function shopItem(c) { return S.stock.filter(p => p.sp === c.sp && effCrisp(p) >= c.min).sort((a, b) => effCrisp(a) - effCrisp(b))[0]; }
function shopPrice(c, p) { const aff = S.regulars[c.name] || 0; return fair(p, 'shop') * (1 + Math.min(aff, 10) * .02); }
function branchTick(dt) {
  if (S.branch === 'factory' && S.workers > 0) {
    if (S.money > 0) S.money = Math.max(0, S.money - S.workers * .05 * dt);
    F.fac = (F.fac || 0) + dt * S.workers / 12;
    while (F.fac >= 1) {
      F.fac -= 1; if (S.stock.length >= cap()) break;
      const sp = Object.keys(S.gel).filter(k => S.gel[k] >= 2).sort((a, b) => S.gel[b] - S.gel[a])[0]; if (!sp) break;
      S.gel[sp] -= 2; S.stock.push(makeProduct(sp, clamp(0.55 + 0.05 * S.auto + rnd(-.05, .05), .2, 1))); renderGelBar();
    }
  }
  if (S.branch === 'corp') {
    const now = Date.now();
    S.contracts = S.contracts.filter(c => { if (now > c.dl) { S.rep = Math.max(0, S.rep - 1); toast('⚠ 訂單逾期，企業信譽 -1'); return false; } return true; });
    F.ct = (F.ct || 0) + dt;
    if (F.ct > 20 && S.contracts.length < 3) {
      F.ct = 0; const us = unlockedSpecies(), n = 2 + Math.floor(Math.random() * 3), any = Math.random() < .4, sp = any ? 'any' : pick(us).id, min = clamp(.35 + .05 * S.rep + rnd(0, .15), .3, .9);
      const ref = { sp: any ? 'grass' : sp, crisp: min + .1, dur: 100, deco: [] }, base = any ? unlockedSpecies().reduce((a, s) => a + s.price, 0) / unlockedSpecies().length : SP[sp].price;
      const reward = Math.round(n * base * (0.4 + 1.1 * (min + .1)) * 1.5 * (1 + S.rep * .05)); void ref;
      S.contracts.push({ id: S.nextId++, sp, n, min, reward, dl: now + 240000 }); toast('🏢 收到新的企業訂單');
    }
  }
  if (S.branch === 'shop') {
    const now = Date.now(); S.customers = S.customers.filter(c => { if (now > c.dl) { S.regulars[c.name] = Math.max(0, (S.regulars[c.name] || 0) - 1); toast(`😞 ${c.name} 等太久離開了`); return false; } return true; });
    F.sc = (F.sc || 0) + dt;
    if (F.sc > 10 && S.customers.length < 3) {
      F.sc = 0; const reg = Object.keys(S.regulars).filter(k => S.regulars[k] >= 3), name = reg.length && Math.random() < .5 ? pick(reg) : pick(REG_NAMES);
      if (!S.customers.some(c => c.name === name)) { S.customers.push({ id: S.nextId++, name, sp: pick(unlockedSpecies()).id, min: rnd(.3, .7), dl: now + 45000 }); toast(`🔔 ${name} 來了`); }
    }
  }
}
function chooseBranch(k) { S.branch = k; save(); checkBranch(); renderBranch(); toast('已選擇：' + BRANCHES[k].name); }

/* ============================================================
   圖鑑與終局目標
   ============================================================ */
const GOAL = { species: 8, fans: 800, earned: 40000 };
function renderCodex() {
  const made = SPECIES.filter(s => S.codex[s.id] && S.codex[s.id].made > 0).length;
  const g = [['製作過所有種類', made, GOAL.species], ['粉絲數', Math.floor(S.fans), GOAL.fans], ['累積營收', Math.floor(S.earned), GOAL.earned]];
  const ok = g.every(x => x[1] >= x[2]);
  let h = `<div class="card"><b>🏆 終局目標：開設「夢想捏捏博物館」</b><div class="small" style="color:var(--sub);margin:4px 0 8px">讓全世界都聽見史萊姆的酥脆聲。</div>` +
    g.map(x => `<div class="small">${x[0]}　${x[1].toLocaleString()} / ${x[2].toLocaleString()}</div><div class="meter2" style="margin:3px 0 7px"><i style="width:${clamp(x[1] / x[2] * 100, 0, 100)}%"></i></div>`).join('') +
    `<button class="btn" data-act="finish" ${ok && !S.done ? '' : 'disabled'}>${S.done ? '已達成 🎉' : '完成夢想'}</button></div><h3>史萊姆圖鑑</h3><div class="grid">`;
  h += SPECIES.map(s => { const c = S.codex[s.id]; return `<div class="card item" style="cursor:default"><div class="sw" style="background:${c ? swatch(s) : '#222'}"></div><div><div class="nm">${c ? s.name : '？？？'}</div><div class="meta">${ZONES.find(z => z.id === s.zone).name} · <span style="color:${RAR[s.rar].c}">${RAR[s.rar].n}</span></div><div class="meta">${c ? `已製作 ${c.made} 個` : '尚未發現'}</div></div></div>`; }).join('') + '</div>';
  $('#codexBody').innerHTML = h;
}
function finish() {
  S.done = true; save();
  const txt = { factory: '你的工廠日夜運轉，「月光谷」的酥脆聲成為了全世界的背景音樂。', corp: '你與大企業攜手，把史萊姆捏捏帶進每個人的辦公桌，成為解壓文化的代名詞。', shop: '你的小店成了鎮上的溫暖角落，熟客們帶著笑容與酥脆聲度過每個日子。' }[S.branch || 'shop'];
  modal(`<h2>🎉 夢想捏捏博物館開幕！</h2><p>${txt}</p><p>你是真正的史萊姆捏捏大師。你可以繼續遊玩，享受酥脆的療癒時光。</p>`);
}

/* ============================================================
   捕捉頁 UI / 頂欄
   ============================================================ */
function renderZones() {
  $('#zones').innerHTML = ZONES.map(z => { const un = S.zones.includes(z.id); return `<button class="zbtn ${F.zone === z.id ? 'on' : ''} ${un ? '' : 'lock'}" data-act="zone" data-id="${z.id}">${z.name}<br><small>${un ? '已解鎖' : '🔒 ' + fmt(z.cost)}</small></button>`; }).join('');
}
function renderGelBar() {
  const h = SPECIES.filter(s => S.gel[s.id]).map(s => `<span class="chip"><span style="color:${s.color}">●</span> ${s.name.replace('史萊姆', '')} ×${S.gel[s.id]}</span>`).join('');
  $('#gelBar').innerHTML = h || '<span class="small" style="color:var(--sub)">背包還沒有凝膠，快去採集吧！</span>';
}
function renderTop() {
  $('#sMoney').textContent = '💰 ' + fmt(S.money); $('#sFans').textContent = '⭐ ' + Math.floor(S.fans);
  const t = trend.sp ? SP[trend.sp] : null; $('#sTrend').innerHTML = t ? `🔥 <span style="color:${t.color}">●</span> ${t.name.replace('史萊姆', '')} ×1.35` : '🔥 —';
  $('#btnSound').textContent = S.sound ? '🔊' : '🔇';
}
function pickTrend() { const us = unlockedSpecies(); trend.sp = pick(us).id; renderTop(); toast('🔥 流行色更新：' + SP[trend.sp].name); }

/* ============================================================
   分頁 / 事件
   ============================================================ */
let tab = 'catch';
const RENDER = { catch() { renderZones(); renderGelBar(); setTimeout(resizeField, 0); }, make: renderMake, decor() { renderDecor(); setTimeout(decorSt.resize, 0); }, live() { renderLive(); setTimeout(liveSt.resize, 0); }, web: renderWeb, up: renderUp, branch: renderBranch, codex: renderCodex };
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
      F.zone = id; fillField(); refresh(); save(); break;
    }
    case 'pickSp': M.sp = id; M.last = null; renderMake(); break;
    case 'startMake': startMake(); break;
    case 'stopBar': stopBar(); break;
    case 'goDecor': D.id = +id; showTab('decor'); break;
    case 'decoSel': D.id = +id; renderDecor(); break;
    case 'addDeco': { const p = decorSt.p; if (!p) return; if (p.deco.length >= 6) return toast('最多 6 個裝飾'); p.deco.push({ k, x: rnd(-.4, .4), y: rnd(-.4, .4), s: 1, r: 0 }); decorSt.sel = p.deco.length - 1; sfx.tick(); renderDecorTools(); save(); break; }
    case 'delDeco': { const p = decorSt.p; if (p && decorSt.sel >= 0) { p.deco.splice(decorSt.sel, 1); decorSt.sel = -1; renderDecorTools(); save(); } break; }
    case 'photo': { const cv = $('#decorCv'), a2 = document.createElement('a'); a2.download = 'slime-squish.png'; a2.href = cv.toDataURL('image/png'); a2.click(); toast('📸 已儲存圖片'); break; }
    case 'toggleLive': L.on = !L.on; if (L.on) { chat('系統', '直播開始！歡迎大家～', 'dm'); if (!liveSt.p) toast('先從庫存選一個捏捏上台'); } else toast('直播結束'); renderLive(); break;
    case 'stageSel': L.stageId = +id; renderLive(); break;
    case 'list': { const p = stockById(id); if (!p) return; if (S.web.length >= slots()) return toast('貨架已滿，請升級網站貨架'); S.stock = S.stock.filter(q => q !== p); S.web.push(p); renderWeb(); save(); break; }
    case 'unlist': { const p = S.web.find(q => q.id === +id); if (!p) return; if (S.stock.length >= cap()) return toast('庫存已滿'); S.web = S.web.filter(q => q !== p); S.stock.push(p); renderWeb(); save(); break; }
    case 'buyUp': { const c = upCost(k); if (S.money < c || S.up[k] >= UPS[k].max) return; S.money -= c; S.up[k]++; sfx.pop(); renderUp(); renderTop(); save(); break; }
    case 'buyPack': { const c = PACKS[k].cost; if (S.money < c) return; S.money -= c; S.packs.push(k); sfx.pop(); renderUp(); renderTop(); save(); break; }
    case 'chooseBranch': chooseBranch(k); break;
    case 'hire': { const c = Math.round(400 * Math.pow(1.5, S.workers)); if (S.money >= c) { S.money -= c; S.workers++; renderBranch(); renderTop(); save(); } break; }
    case 'auto': { const c = Math.round(600 * Math.pow(1.8, S.auto)); if (S.money >= c) { S.money -= c; S.auto++; renderBranch(); renderTop(); save(); } break; }
    case 'deliver': {
      const c = S.contracts.find(x => x.id === +id); if (!c) return; const it = contractItems(c); if (it.length < c.n) return;
      S.stock = S.stock.filter(p => !it.includes(p)); S.contracts = S.contracts.filter(x => x !== c); addMoney(c.reward); S.rep++; S.fans += 2; sfx.pop(); toast(`🏢 交貨完成 +${fmt(c.reward)}`); refresh(); save(); break;
    }
    case 'serve': {
      const c = S.customers.find(x => x.id === +id); if (!c) return; const p = shopItem(c); if (!p) return; const pr = shopPrice(c, p), aff = S.regulars[c.name] || 0, tip = aff >= 5 ? Math.round(pr * .15) : 0;
      S.stock = S.stock.filter(q => q !== p); S.customers = S.customers.filter(x => x !== c); S.regulars[c.name] = aff + 1; addMoney(pr + tip); S.fans += 1; sfx.pop();
      toast(`🏪 ${c.name} 滿意離開 +${fmt(pr + tip)}${tip ? '（含小費）' : ''}`); refresh(); save(); break;
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
  modal(`<h2>🫧 歡迎來到月光谷</h2>
  <p>月光谷的史萊姆誕生於月光與露水交融之處。你繼承了奶奶留下的小小捏捏工坊，要把史萊姆的可再生凝膠，做成世上最療癒的酥脆捏捏。</p>
  <p><b>核心循環</b>：捕捉 → 加工 → 裝飾 → 銷售（直播／網站）→ 收益 → 升級解鎖。</p>
  <p><b>5 分鐘</b>：採集凝膠、做出第一個捏捏、上直播捏出人氣並賣掉它。<br><b>1 小時</b>：解鎖新生態區、擴充裝飾與設備、經營網站被動收入、在中期選擇工廠／企業／小店之路。</p>
  <p><b>終局</b>：製作所有種類、累積粉絲與營收，開設「夢想捏捏博物館」。</p>
  <p><small>操作：點擊採集；加工時按「停」；直播時按住／點擊捏捏（可滑動連續捏）。手機可直接觸控，並有震動回饋。</small></p>`, [{ t: '開始遊戲' }]);
}

/* ---------- 主迴圈 ---------- */
let lastT = performance.now(), secAcc = 0, webAcc = 0, farmAcc = 0, trendAcc = 0;
function loop(now) {
  const dt = Math.min((now - lastT) / 1000, .1); lastT = now;
  // 世界模擬
  trendAcc += dt; if (trendAcc > 90) { trendAcc = 0; pickTrend(); }
  farmAcc += dt; if (S.up.farm > 0 && farmAcc >= 12 / S.up.farm) { farmAcc = 0; const sp = pick(unlockedSpecies()); S.gel[sp.id] = (S.gel[sp.id] || 0) + 1; if (!S.codex[sp.id]) S.codex[sp.id] = { seen: true, made: 0 }; if (tab === 'catch' || tab === 'make') { renderGelBar(); if (tab === 'make' && !M.active) renderMake(); } }
  webAcc += dt; if (webAcc >= 4) { webAcc = 0; const r = webTick(); if (r) { toast(`🛒 網站成交 +${fmt(r.price)}　${'★'.repeat(r.stars)}`); renderTop(); if (tab === 'web') renderWeb(); } }
  branchTick(dt); updateLive(dt);
  secAcc += dt; saveTimer += dt;
  if (secAcc >= 1) { secAcc = 0; checkBranch(); renderTop(); const ae = document.activeElement; if (!(ae && ae.tagName === 'INPUT') && tab === 'branch') renderBranch(); if (tab === 'live') updateLiveHUD(); }
  if (saveTimer > 5) { saveTimer = 0; save(); }
  // 繪製
  if (tab === 'catch') { updateField(dt); drawField(); }
  if (tab === 'decor') { decorSt.update(dt); decorSt.draw(); }
  if (tab === 'live') { liveSt.update(dt); liveSt.draw(); $('#hypeBar').style.width = L.hype + '%'; $('#liveViewers').textContent = '👁 ' + Math.round(L.viewers); updateLiveInfoLight(); }
  if (tab === 'make' && M.active) {
    M.pos += M.dir * M.spd * dt; if (M.pos > 1) { M.pos = 1; M.dir = -1; } if (M.pos < 0) { M.pos = 0; M.dir = 1; }
    const cur = $('#mcur'); if (cur) cur.style.left = M.pos * 100 + '%';
  }
  requestAnimationFrame(loop);
}
let infoT = 0;
function updateLiveInfoLight() { if (++infoT % 15 === 0) updateLiveHUD(); }

/* ---------- 離線結算（網站） ---------- */
function offlineCatchUp() {
  const el = Math.min((Date.now() - S.last) / 1000, 1800); if (el < 8 || !S.web.length) return;
  let gain = 0, n = 0; for (let i = 0; i < Math.floor(el / 4); i++) { const before = S.earned; if (webTick()) { gain += S.earned - before; n++; } }
  if (n) setTimeout(() => toast(`🛒 離線期間網站賣出 ${n} 件，+${fmt(gain)}`), 600);
}

/* ---------- 啟動 ---------- */
window.addEventListener('resize', () => { resizeField(); decorSt.resize(); liveSt.resize(); });
offlineCatchUp(); pickTrend(); renderTop(); checkBranch(); showTab('catch'); M.sp = (unlockedSpecies().find(s => S.gel[s.id]) || {}).id || null;
if (!S.seen) showIntro();
window.addEventListener('beforeunload', save);
requestAnimationFrame(loop);
