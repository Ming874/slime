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
  { id: 'aurora', name: '極光史萊姆', zone: 'snow', color: '#34d399', color2: '#a78bfa', rar: 4, price: 90, w: 1, night: true },
  // 夜行種類：只在夜晚出現（白天躲起來）；做出來的捏捏帶微光，直播售價小幅加成
  { id: 'glowgrass', name: '螢光青草史萊姆', zone: 'forest', color: '#a3f7b5', rar: 3, price: 42, w: 3, night: true, look: 'grass' },
  { id: 'nightcoral', name: '夜光珊瑚史萊姆', zone: 'coast', color: '#c4b5fd', rar: 3, price: 46, w: 2, night: true, look: 'coral' },
  { id: 'ember', name: '餘燼熔岩史萊姆', zone: 'volcano', color: '#ff7a59', rar: 3, price: 52, w: 2, night: true, look: 'lava' },
  // 洞穴史萊姆（第 4 堂 06）：只住在山洞的暗處，每個洞同時最多 3 隻；不會在野外出現（w: 0）。價格在各區普通與稀有種之間
  { id: 'saltc', name: '鹽晶史萊姆', zone: 'coast', color: '#d9f1fb', rar: 3, price: 26, w: 0, cave: 'sea', look: 'salt' },
  { id: 'charc', name: '炭火史萊姆', zone: 'volcano', color: '#6b4438', rar: 3, price: 39, w: 0, cave: 'lava', look: 'lava' },
  { id: 'frostb', name: '霜鈴史萊姆', zone: 'snow', color: '#e3f1ff', rar: 3, price: 48, w: 0, cave: 'ice', look: 'ice' },
  // 月光史萊姆：只在夜晚的月光洞窟湖邊出現，身體半透明、跟著月光明暗；做成的捏捏帶柔和的光（夜行種，直播加成）
  { id: 'moonl', name: '月光史萊姆', zone: 'forest', color: '#e4dcff', color2: '#a5b4fc', rar: 4, price: 44, w: 0, cave: 'moon', night: true, look: 'aurora' },
];
const SP = Object.fromEntries(SPECIES.map(s => [s.id, s]));
const HOSPITAL_FEE = 20; // 醫院診療費
const WARM_MAX = 600; // 雪原體溫：每次進入雪原有 10 分鐘（秒）
// 切法：marks 切幾刀、tol 判定寬度倍率、pm 售價倍率、wear 直播時的耐久消耗倍率、th 切片厚度
const CUTS = {
  thick: { n: '厚塊', marks: 3, tol: 1.45, pm: .9, wear: .7, th: .26, col: '#22d3ee', desc: '容易切準・耐久高' },
  thin: { n: '薄片', marks: 6, tol: .72, pm: 1.35, wear: 1.3, th: .1, col: '#a5f3fc', desc: '很難切準・價格高' },
  star: { n: '星形', marks: 4, tol: 1, pm: 1.2, wear: 1, th: .16, col: '#fde047', shape: 'star', desc: '造型切・觀眾最愛' },
  heart: { n: '愛心', marks: 4, tol: 1, pm: 1.2, wear: 1, th: .16, col: '#f9a8d4', shape: 'heart', desc: '造型切・觀眾最愛' },
};
const cutMul = p => (p.cut && CUTS[p.cut] ? CUTS[p.cut].pm * (.92 + .16 * (p.cq || 0)) : 1) * (p.wonky ? .6 : 1);
const wearOf = p => p.cut && CUTS[p.cut] ? CUTS[p.cut].wear : 1;
const short = id => SP[id].name.replace('史萊姆', '');
const DECO = {
  bead: { n: '珍珠', v: .04, pack: 'base', c: '#f1f5f9' }, cube: { n: '方塊', v: .04, pack: 'base', c: '#94a3b8' }, ring: { n: '圓環', v: .05, pack: 'base', c: '#e879f9' },
  cone: { n: '錐體', v: .07, pack: 'metal', c: '#cbd5e1', metal: 1 }, disc: { n: '圓盤', v: .07, pack: 'metal', c: '#fbbf24', metal: 1 }, pyramid: { n: '角錐', v: .08, pack: 'metal', c: '#f59e0b', metal: 1 },
  gem: { n: '寶石', v: .10, pack: 'glass', c: '#38bdf8' }, crystal: { n: '晶柱', v: .10, pack: 'glass', c: '#a78bfa' }, star: { n: '星晶', v: .10, pack: 'glass', c: '#fde047' },
  orb: { n: '光球', v: .16, pack: 'neon', c: '#22d3ee', glow: 1 }, knot: { n: '扭結', v: .18, pack: 'neon', c: '#fb7185', glow: 1 }, drop: { n: '水滴', v: .14, pack: 'neon', c: '#34d399', glow: 1 },
  dodeca: { n: '稜鏡', v: .22, pack: 'prism', c: '#e879f9', metal: 1 }, helix: { n: '螺旋', v: .25, pack: 'prism', c: '#818cf8', glow: 1 }, halo: { n: '光環', v: .18, pack: 'prism', c: '#fbbf24', glow: 1 },
  // 苔光（第 4 堂 06）：山洞裡摘的發光苔蘚，放在捏捏上會微微發光；不是零件包，每放一個用掉一份（S.cave.mossN）
  moss: { n: '苔光', v: .12, pack: 'cave', c: '#86efac', glow: 1 },
};
const PACKS = { metal: { name: '金屬零件包', cost: 200 }, glass: { name: '水晶零件包', cost: 500 }, neon: { name: '霓虹零件包', cost: 1500 }, prism: { name: '稜鏡零件包', cost: 3000 } };
const UPS = {
  net: { name: '採集吸取器', desc: '裝在手腕上，每一級每次採集多得 1 份凝膠', base: 120, max: 4 },
  slicer: { name: '切片機升級', desc: '切片的判定範圍更寬', base: 150, max: 5, mach: 1, need: 'slicer' },
  coater: { name: '糖晶滾筒機升級', desc: '綠色控速區間更寬', base: 180, max: 5, mach: 1, need: 'coater' },
  dryer: { name: '乾燥烘箱升級', desc: '目標溫度區間更寬', base: 210, max: 5, mach: 1, need: 'dryer' },
  cap: { name: '倉儲貨架', desc: '工坊的倉儲貨架多一層，庫存上限 +6', base: 100, max: 5 },
  shelf: { name: '網站伺服器', desc: '網站貨架 +2 格（滿 5 格多一層）', base: 200, max: 5 },
  gear: { name: '直播燈光設備', desc: '舞台旁多一支燈，直播基礎觀眾 +15%', base: 250, max: 5, need: 'live' },
  farm: { name: '養殖槽', desc: '每 30 分鐘自動收集一批凝膠（每級 +4 份，離線也會累積）', base: 300, max: 5 },
  boots: { name: '輕量跑鞋', desc: '移動速度 +10%，奔跑時視野更寬、出現速度線', base: 160, max: 3 },
};
const NAMES = ['小布丁', '軟糖控', '捏捏狂人', 'ASMR愛好者', '夜貓子', '蛋糕星人', '阿宅', 'Mochi', '果凍妹', '路過的人', '史萊姆粉', '雲朵', '薄荷', '咪咪', '大叔'];
const CHAT_CRUNCH = ['喀滋喀滋，好療癒', '這個聲音太爽了', '耳朵好舒服', '再捏一次！', '好酥好脆', '我要睡著了', '這顏色好美', '手感看起來超棒', '連擊連擊！', '哇啊啊'];
const CHAT_IDLE = ['晚安', '第一次來，好可愛', '主播聲音好好聽', '今天有什麼新貨？', '想要那個顏色', '上架了嗎', '看著就解壓', '捏捏捏捏捏'];
// {sp} 正在捏的種類、{cut} 切法、{combo} 連擊數、{name} 主播名字
const CHAT_T = {
  crunch: ['{sp}的聲音好脆！', '這個{cut}切面好亮', '{combo} 連擊！{name}手好快', '{name}再捏一次{sp}！', '喀滋喀滋，{sp}好療癒', '{combo} 連擊了耶，停不下來', '{name}的捏捏聲是全站最好聽的', '{sp}的顏色在燈下好漂亮', '{cut}切的手感看起來超棒', '{combo} 連擊！{sp}要被捏扁了', '戴耳機聽{sp}真的會睡著', '{name}今天手感很好喔'],
  idle: ['{name}晚安～', '第一次來，{sp}好可愛', '今天是{sp}專場嗎', '{name}今天有什麼新貨？', '想看{name}捏{sp}', '{sp}還有貨嗎', '{name}的工坊越來越大了', '剛下班，來聽{sp}紓壓', '上次買的{sp}超讚', '{cut}切的有賣嗎'],
};
function liveLine(kind) {
  const p = stockById(L.stageId), v = { sp: p ? short(p.sp) : '捏捏', cut: p && p.cut ? CUTS[p.cut].n : '', combo: L.combo, name: (NET.on && NET.name) || S.name || '主播' };
  const pool = [...CHAT_T[kind], ...(kind === 'crunch' ? CHAT_CRUNCH : CHAT_IDLE)].filter(t => (!t.includes('{cut}') || v.cut) && (!t.includes('{combo}') || L.combo >= 3)), now = Date.now(); L.said = L.said || new Map();
  for (let k = 0; k < 10; k++) { const t = pick(pool).replace(/\{(\w+)\}/g, (_, x) => v[x]); if (now - (L.said.get(t) || 0) > 300000) { L.said.set(t, now); return t; } }
  return null;
}
const CHAT_EXPENSIVE = ['有點貴耶…', '價格能再便宜一點嗎', '錢包在哭泣'];
const REVIEWS = { 5: ['超酥脆！回購！', '聲音太療癒了', '完美，五星推薦'], 4: ['不錯，酥脆度很好', '包裝精緻', '值得'], 3: ['普通，還行', '價格普通', '有點軟'], 2: ['不太酥脆…', '有點貴', '期待落差'], 1: ['不脆，貴，失望', '品質不行', '不會再買'] };
const REG_NAMES = ['小綠', '阿花', '暖暖', '大叔', '貓店長', '莓莓', '阿山', '雪兒'];
const BRANCHES = {
  factory: { name: '自家工廠', desc: '雇用員工、架設機械手臂自動量產。重視產能與成本管理：員工會持續領薪水。' },
  corp: { name: '企業合作', desc: '承接大公司的訂單。收入穩定，但必須符合品質與期限，失敗會損失信譽。' },
  shop: { name: '溫馨小店', desc: '經營實體小店。著重顧客關係：記住常客喜好，培養熟客與小費。' },
};

/* ---------- 存檔 ---------- */
/* ---------- 玩家頭像：幾種史萊姆讓玩家挑（暫停選單、主選單、存檔選擇都會顯示） ---------- */
const AVATARS = [
  { id: 'mint', n: '薄荷', c: '#6ee7b7', d: '#10b981', e: 'smile' },
  { id: 'sky', n: '天空', c: '#7dd3fc', d: '#0284c7', e: 'happy' },
  { id: 'peach', n: '蜜桃', c: '#fda4af', d: '#e11d48', e: 'wink' },
  { id: 'lemon', n: '檸檬', c: '#fde047', d: '#ca8a04', e: 'open' },
  { id: 'grape', n: '葡萄', c: '#c4b5fd', d: '#7c3aed', e: 'sleepy' },
  { id: 'ember', n: '熔岩', c: '#fb923c', d: '#c2410c', e: 'cool' },
  { id: 'frost', n: '雪球', c: '#e0f2fe', d: '#60a5fa', e: 'shy' },
  { id: 'glow', n: '螢光', c: '#a7f3d0', d: '#059669', e: 'star' },
];
const avatarOf = id => AVATARS.find(a => a.id === id) || AVATARS[0];
const NPC_IDS = ['yun', 'chen', 'zhe', 'mei', 'jie', 'lin', 'yu', 'leo', 'kai', 'wang', 'zhang', 'anna'];
// 宅配（氣球木箱）的機器與四間店：sanitize 在存檔區就要用，所以放在這裡（OWN、SHOPS 在後面才宣告，讀檔時還在暫時死區）
const SHIP_KEYS = ['slicer', 'coater', 'dryer', 'decor', 'live'], SHOP_IDS = ['mach', 'mall', 'gear', 'arms'];
const SAVE_KEY = 'slime_world_v1';
function fresh() {
  return {
    money: 60, fans: 0, xp: 0, earned: 0, gel: {}, stock: [], web: [], price: { live: {}, web: {} },
    zones: ['forest'], packs: ['base'], up: Object.fromEntries(Object.keys(UPS).map(k => [k, 0])),
    codex: {}, rate: [4, 4, 5], reviews: [], branch: null, workers: 0, auto: 0, rep: 0,
    contracts: [], regulars: {}, tier: { live: {}, web: {} }, customers: [], nextId: 1, last: Date.now(), done: false, sound: true, seen: false, sales: 0,
    pos: null, hb: 0, sens: 1, q: null, own: {}, photos: [], cafe: { d: 0, done: false }, mkt: { w: 0, got: [] }, liveBest: 0, vol: { music: .6, sfx: .9 }, quality: 'auto', warm: WARM_MAX, frozen: false, tutDone: false, lineMade: false, farmT: 0, cut: 'thick', cutN: 0, show: [], wk: { w: 0, done: [] }, npc: {}, avatar: 'mint', cave: { seen: {}, mural: {}, moss: { d: 0, n: {} }, mossN: 0 },
    eggs: [], // 找到的「月光谷的小秘密」（彩蛋 id，依發現順序）
    rideN: 0, // 搭過幾趟計程車（前 3 趟提示「按住開快一點」）
    ship: [], // 付了錢、還沒演的到貨（氣球木箱）：[{ k, via: 'city'|'web', at }]；東西付錢那一刻就算擁有
    wish: {}, // 錢不夠時店員「幫你留著」的商品：{ 't:k': 次數 }（吊牌貼 ♡）
    shopSeen: {}, // 進過哪幾間店（第一次的招呼兼教學）
  };
}
// 讀檔時修正壞掉或過舊的資料，避免任何一筆異常資料讓遊戲當掉
function sanitize(o) {
  const s = Object.assign(fresh(), o, { up: Object.assign(fresh().up, o.up) });
  const arr = v => Array.isArray(v) ? v : [], obj = v => (v && typeof v === 'object' && !Array.isArray(v)) ? v : {};
  for (const k in s.up) { if (!UPS[k]) delete s.up[k]; else s.up[k] = clamp(Math.floor(+s.up[k] || 0), 0, UPS[k].max); }
  ['money', 'fans', 'earned', 'workers', 'auto', 'rep', 'sales'].forEach(k => { s[k] = +s[k]; if (!isFinite(s[k]) || s[k] < 0) s[k] = 0; });
  const fixP = p => { p.crisp = clamp(+p.crisp || .5, 0, 1); p.dur = clamp(isFinite(+p.dur) ? +p.dur : 100, 0, 100); p.deco = arr(p.deco).filter(d => d && DECO[d.k]).slice(0, 6); p.cracks = arr(p.cracks).filter(Array.isArray).slice(-30); if (CUTS[p.cut]) p.cq = clamp(+p.cq || 0, 0, 1); else { delete p.cut; delete p.cq; } if (p.wonky) p.wonky = true; else delete p.wonky; return p; };
  const okP = p => p && typeof p === 'object' && SP[p.sp] && isFinite(+p.id);
  s.stock = arr(s.stock).filter(okP).map(fixP); s.web = arr(s.web).filter(okP).map(fixP); s.show = arr(s.show).filter(okP).map(fixP).slice(0, 4);
  const ids = new Set(); let maxId = 0;
  for (const p of [...s.stock, ...s.web, ...s.show]) { p.id = Math.floor(+p.id); if (ids.has(p.id)) p.id = -1; else ids.add(p.id); maxId = Math.max(maxId, p.id); }
  s.nextId = Math.max(Math.floor(+s.nextId) || 1, maxId + 1); for (const p of [...s.stock, ...s.web, ...s.show]) if (p.id < 0) p.id = s.nextId++;
  s.gel = Object.fromEntries(Object.entries(obj(s.gel)).filter(([k, v]) => SP[k] && +v >= 0).map(([k, v]) => [k, Math.floor(+v)]));
  s.zones = [...new Set(['forest', ...arr(s.zones).filter(z => ZONES.some(x => x.id === z))])];
  s.packs = [...new Set(['base', ...arr(s.packs).filter(k => PACKS[k])])];
  const fixPr = o => Object.fromEntries(Object.entries(obj(o)).filter(([k, v]) => SP[k] && isFinite(+v) && +v >= 1).map(([k, v]) => [k, clamp(Math.round(+v), 1, 99999)]));
  s.price = { live: fixPr(obj(s.price).live), web: fixPr(obj(s.price).web) };
  // 定價三選一：舊存檔依原本的價格換算成最接近的等級
  const fixT = (o, ch) => { const r = {}; Object.entries(obj(o)).forEach(([k, v]) => { if (SP[k] && [0, 1, 2].includes(+v)) r[k] = +v; }); Object.entries(s.price[ch]).forEach(([k, v]) => { if (r[k] == null) { const q = v / (SP[k].price * 1.28 * ({ live: 1.4, web: .9 })[ch]); r[k] = q < .9 ? 0 : q > 1.17 ? 2 : 1; } }); return r; };
  s.tier = { live: fixT(obj(s.tier).live, 'live'), web: fixT(obj(s.tier).web, 'web') };
  s.codex = obj(s.codex); s.regulars = obj(s.regulars);
  s.rate = arr(s.rate).filter(n => n >= 1 && n <= 5).slice(-40); if (!s.rate.length) s.rate = [4, 4, 5];
  s.reviews = arr(s.reviews).filter(v => v && REVIEWS[v.s]).slice(0, 8);
  s.contracts = arr(s.contracts).filter(c => c && (c.sp === 'any' || SP[c.sp]) && isFinite(+c.dl)); s.contracts.forEach(c => { if (!CUTS[c.cut]) c.cut = null; });
  s.customers = arr(s.customers).filter(c => c && SP[c.sp] && isFinite(+c.dl));
  if (s.branch && !BRANCHES[s.branch]) s.branch = null;
  if (s.pos && !(Number.isFinite(s.pos.x) && Number.isFinite(s.pos.z) && Number.isFinite(s.pos.yaw))) s.pos = null;
  if (!('xp' in o)) s.xp = Math.round((+o.fans || 0) * 2 + (+o.sales || 0) * 2); s.xp = Math.max(0, Math.floor(+s.xp) || 0);
  s.hb = clamp(Math.floor(+s.hb) || 0, 0, 8); s.sens = clamp(Math.floor(+s.sens) || 0, 0, 2);
  // 已購買的設備：只保留有效項目；改版前（設備內建）的舊存檔自動補發
  const OWN_KEYS = ['slicer', 'coater', 'dryer', 'decor', 'live', 'coat', 'sword'], OLD_OWN = ['slicer', 'coater', 'dryer', 'decor', 'live'];
  if (!o.own || typeof o.own !== 'object') { s.own = {}; if (o.seen && ((+o.sales || 0) > 0 || Object.values(obj(o.codex)).some(c => c && c.made > 0))) { OLD_OWN.forEach(k => s.own[k] = true); s.ownMigrated = true; } }
  else s.own = Object.fromEntries(Object.entries(o.own).filter(([k, v]) => OWN_KEYS.includes(k) && v).map(([k]) => [k, true]));
  // 已經解鎖雪原的舊存檔：補發保暖衣，避免被突然擋在雪原外面
  if (s.zones.includes('snow') && !s.own.coat) { s.own.coat = true; s.coatMigrated = true; }
  if (s.own.coat && !s.zones.includes('snow')) s.zones.push('snow'); // 雪原改成「有保暖衣就能去」，不再需要解謎
  // 宅配、想買、進過的店：只留合法項目（未知的、沒擁有的、重複的到貨單都丟掉，最多 5 筆）；舊存檔沒有這些欄位就是空的
  { const ks = new Set(); s.ship = arr(o.ship).filter(e => e && SHIP_KEYS.includes(e.k) && s.own[e.k] && !ks.has(e.k) && ks.add(e.k)).slice(0, 5).map(e => ({ k: e.k, via: e.via === 'web' ? 'web' : 'city', at: +e.at || 0 })); }
  const wareOK = id => { const [t, k, x] = String(id).split(':'); return x == null && (t === 'own' ? OWN_KEYS.includes(k) : t === 'up' ? !!UPS[k] : t === 'pack' ? !!PACKS[k] : false); };
  s.wish = Object.fromEntries(Object.entries(obj(o.wish)).filter(([id, v]) => wareOK(id) && +v > 0).slice(0, 3).map(([id, v]) => [id, clamp(Math.floor(+v), 1, 99)]));
  s.shopSeen = Object.fromEntries(Object.entries(obj(o.shopSeen)).filter(([k, v]) => SHOP_IDS.includes(k) && v).map(([k]) => [k, 1]));
  s.cafe = { d: Math.floor(+obj(s.cafe).d) || 0, done: !!obj(s.cafe).done }; s.mkt = { w: Math.floor(+obj(s.mkt).w) || 0, got: arr(obj(s.mkt).got).filter(x => typeof x === 'string').slice(0, 6) }; s.liveBest = Math.max(0, Math.floor(+s.liveBest) || 0);
  s.photos = arr(s.photos).filter(p => p && typeof p.k === 'string' && typeof p.txt === 'string').slice(0, 12).map(p => ({ k: p.k.slice(0, 20), txt: p.txt.slice(0, 24), sp: SP[p.sp] ? p.sp : null, t: +p.t || 0 }));
  const vo = obj(o.vol); s.vol = { music: clamp(isFinite(+vo.music) ? +vo.music : .6, 0, 1), sfx: clamp(isFinite(+vo.sfx) ? +vo.sfx : .9, 0, 1) }; if (!['auto', 'high', 'low'].includes(s.quality)) s.quality = 'auto';
  s.warm = clamp(isFinite(+s.warm) ? +s.warm : WARM_MAX, 0, WARM_MAX); s.frozen = !!s.frozen;
  // 改版前的存檔：已經做過東西就視為完成教學；有機器的視為用過產線
  if (!('tutDone' in o)) s.tutDone = !!o.seen && ((+o.sales || 0) > 0 || arr(o.stock).length > 0 || Object.values(obj(o.codex)).some(c => c && c.made > 0));
  if (!('lineMade' in o)) s.lineMade = !!(s.own.slicer || s.own.coater || s.own.dryer) && s.tutDone;
  s.npc = Object.fromEntries(Object.entries(obj(s.npc)).filter(([k, v]) => NPC_IDS.includes(k) && v && typeof v === 'object').map(([k, v]) => [k, { n: Math.max(0, Math.floor(+v.n) || 0), seen: arr(v.seen).filter(x => typeof x === 'string' && x.length < 20).slice(-60) }]));
  if (!AVATARS.some(a => a.id === s.avatar)) s.avatar = 'mint';
  // 彩蛋：舊存檔沒有這個欄位就是空清單；只留合法的 id（大城市的彩蛋也存在這裡，所以不依登記表過濾）
  s.eggs = [...new Set(arr(s.eggs).filter(k => typeof k === 'string' && /^[\w-]{1,48}$/.test(k)))].slice(0, 300);
  s.tipTalk = clamp(Math.floor(+s.tipTalk) || 0, 0, 9); // 前兩次對話在泡泡下方提示「E 繼續・走開就結束」（talk.js）
  s.rideN = clamp(Math.floor(+s.rideN) || 0, 0, 99999);
  s.wk = { w: Math.floor(+obj(s.wk).w) || 0, done: arr(obj(s.wk).done).filter(Number.isFinite).slice(0, 10) };
  s.tutDone = !!s.tutDone; s.lineMade = !!s.lineMade; if (!CUTS[s.cut]) s.cut = 'thick'; s.cutN = Math.max(0, Math.floor(+s.cutN) || 0);
  s.farmT = Math.max(0, +s.farmT || 0); if (s.farmT > Date.now()) s.farmT = Date.now();
  if (s.mk && !(SP[s.mk.sp] && s.mk.step >= 0 && s.mk.step < 3 && Array.isArray(s.mk.prec) && s.mk.prec.length === s.mk.step)) s.mk = null;
  s.cave = caveSan(o.cave); // 山洞：走過哪些洞、拍過的壁畫、苔蘚（caves.js）
  return s;
}
function load() {
  try { const o = JSON.parse(localStorage.getItem(SAVE_KEY)); if (o && typeof o === 'object') return sanitize(o); } catch (e) { console.warn('存檔讀取失敗，將開始新遊戲', e); }
  return null;
}
let S = load() || fresh(), resetting = false; if (!S.own) S.own = {};
// 暱稱跟著 Google 帳號（預設是 Google 名字，可以在暫停選單改）
if (window.SlimeCloud && SlimeCloud.user) S.name = SlimeCloud.user.name;
let NOSAVE = false, saveWarned = false;
const lsGet = k => { try { return localStorage.getItem(k); } catch (e) { return null; } };
// 雲端存檔（gate.js 的 SlimeCloud）：每次存檔都通知；'now'＝馬上上傳（買東西、做完加工），'leave'＝頁面要關了
const cloud = how => { try { if (window.SlimeCloud) SlimeCloud.sync(how); } catch (e) { } };
function saveCloud() { save(); cloud('now'); }
function save() { if (NOSAVE || resetting || (window.SlimeCloud && SlimeCloud.frozen)) return; S.last = Date.now(); if (P) S.pos = RIDE.on && RIDE.safe ? RIDE.safe : { x: P.x, z: P.z, yaw: P.yaw }; try { localStorage.setItem(SAVE_KEY, JSON.stringify(S)); saveWarned = false; cloud(); } catch (e) { if (!saveWarned) { saveWarned = true; setTimeout(() => toast('無法儲存進度：瀏覽器的儲存空間已滿或被停用（無痕模式？）'), 0); } } } // 搭車中存安全的站位（換邊前＝上車的地方、換邊後＝目的地的下車處），重新整理不會卡在山裡

/* ---------- 經濟公式 ---------- */
const trend = { sp: null };
const cap = () => 8 + S.up.cap * 6;
const slots = () => 4 + S.up.shelf * 2;
const effCrisp = p => p.crisp * (0.35 + 0.65 * p.dur / 100);
const decoBonus = p => p.deco.reduce((a, d) => a + (DECO[d.k] ? DECO[d.k].v : 0), 0);
const CH = { live: 1.4, web: 0.9, shop: 1.25, corp: 1.5 };
const priceOf = (p, ch) => p.crude ? 10 : Math.max(1, Math.round(getPrice(ch, p.sp) * cutMul(p)));
function fair(p, ch) { if (p.crude) return 12; const sp = SP[p.sp]; return sp.price * (0.4 + 1.1 * effCrisp(p)) * (1 + decoBonus(p)) * (trend.sp === p.sp ? 1.35 : 1) * (CH[ch] || 1) * cutMul(p) * (SP[p.sp].night && ch === 'live' ? 1.15 : 1); }
const defPrice = (spId, ch) => Math.round(SP[spId].price * 1.28 * CH[ch]);
const TIER = [{ n: '便宜', m: .8 }, { n: '合理', m: 1 }, { n: '高價', m: 1.35 }];
const tierOf = (ch, spId) => (S.tier && S.tier[ch] && S.tier[ch][spId] != null) ? S.tier[ch][spId] : 1;
const getPrice = (ch, spId) => Math.max(1, Math.round(defPrice(spId, ch) * TIER[tierOf(ch, spId)].m * (trend.sp === spId ? 1.35 : 1)));
const speedTxt = d => d > .85 ? '賣得很快' : d > .65 ? '賣得普通' : '賣得比較慢';
const demand = (price, f) => clamp(1.5 - 0.75 * price / Math.max(1, f), 0, 1.3);
const demandLabel = d => d > 0.95 ? ['熱賣', '#fb923c'] : d > 0.55 ? ['穩定', '#34d399'] : d > 0.2 ? ['冷淡', '#8b9bb0'] : ['滯銷', '#38bdf8'];
const unlockedSpecies = () => SPECIES.filter(s => S.zones.includes(s.zone));
function addMoney(n) { S.money += n; if (n > 0) S.earned += n; }
function discover(id) { if (!S.codex[id]) { S.codex[id] = { seen: true, made: 0 }; if (typeof gainXP === 'function' && S.seen) gainXP(10, '發現新種類'); } }
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
/* ============================================================
   配樂與環境音（第 3 堂 08）
   音樂檔放在 public/music/，曲目清單與授權寫在 public/music/tracks.json；授權確認、檔案放進去之前不播音樂，只有環境音。
   清單格式：{ "base": { "src": "base.mp3", "lo": "base-96k.mp3", "title": "曲名", "author": "作者", "license": "CC0", "url": "原始頁面" }, ... }
   鍵：base（基地／森林）、coast、volcano、snow、city、night（或 base_night 等各區夜間版）、museum
   ============================================================ */
const MUS = { list: null, els: {}, g: {}, want: '', duck: 1 };
try { fetch('/music/tracks.json', { cache: 'no-cache' }).then(r => r.ok ? r.json() : null).then(j => { if (j && typeof j === 'object') MUS.list = j; }).catch(() => { }); } catch (e) { }
function musicWant() {
  const L0 = MUS.list; if (!L0) return '';
  const has = k => !!(L0[k] && L0[k].src), pk = (...ks) => ks.find(has) || '';
  const z = TITLE.on ? 'forest' : (W.zoneNow || 'forest'), nite = DN.night > .55;
  if (z === 'city') return nite ? pk('city_night', 'night', 'city') : pk('city', 'base');
  const base = z === 'forest' ? 'base' : z;
  return nite ? pk(base + '_night', 'night', base, 'base') : pk(base, 'base');
}
function musicEl(k) {
  if (MUS.els[k]) return MUS.els[k];
  const t = MUS.list[k], el = new Audio(); el.src = '/music/' + (LOW && t.lo ? t.lo : t.src); el.loop = true; el.preload = 'none'; el.crossOrigin = 'anonymous';
  const ac = audio(), g = ac.createGain(); g.gain.value = 0; ac.createMediaElementSource(el).connect(g); g.connect(ac.destination);
  el.addEventListener('error', () => { MUS.list[k] = null; }); // 檔案不見：之後就不再試
  MUS.els[k] = el; MUS.g[k] = { node: g, v: 0 }; return el;
}
function musicStep(dt) {
  if (!AC || AC.state !== 'running') return; // 瀏覽器規定：玩家第一次點畫面之後才能出聲
  if (master) master.gain.value = .9 * (S.vol ? S.vol.sfx : .9) / .9;
  const want = musicWant(); MUS.want = want;
  MUS.duck += ((L.on ? .3 : GUI.kind === 'line' ? .55 : RIDE.on ? (RIDE.k > .5 ? .2 : .5) : TK.on ? .85 : 1) - MUS.duck) * Math.min(1, dt * 2); // 直播時音樂自動降低，讓捏捏聲更清楚；跟人說話時也輕輕降一點（talk.js）；坐計程車時壓低，鑽進隧道再低一點（換區的交叉淡入在隧道裡幾乎聽不到）
  const vol = (S.vol ? S.vol.music : .6) * MUS.duck * caveMusic(); // 進山洞時配樂淡出（第 4 堂 2.2）
  if (want && !MUS.els[want]) { try { musicEl(want); } catch (e) { MUS.list[want] = null; } }
  // 走到別區附近時先開始下載那一區的曲子（串流，不必整首下載完）
  if (MUS.list && !TITLE.on && P && (W.preT = (W.preT || 0) - dt) <= 0) { W.preT = 2; const w = biomeW(P.x, P.z); BIOMES.forEach((b, i) => { const k = b === 'forest' ? 'base' : b; if (w[i] > .12 && MUS.list[k] && MUS.list[k].src && !MUS.els[k]) { try { const el = musicEl(k); el.preload = 'auto'; el.load(); } catch (e) { } } }); }
  genMusic(dt, want ? '' : genKey(), vol); // 這一區沒有音樂檔就播內建配樂
  for (const k in MUS.els) {
    const el = MUS.els[k], gg = MUS.g[k]; gg.v = k === want ? Math.min(1, gg.v + dt / 2.5) : Math.max(0, gg.v - dt / 2.5); // 換區時 2.5 秒交叉淡入淡出
    gg.node.gain.value = Math.sin(gg.v * Math.PI / 2) * vol;
    if (gg.v > 0 && el.paused) { const r = el.play(); if (r && r.catch) r.catch(() => { }); }
    if (gg.v <= 0 && !el.paused) el.pause();
  }
}
/* ---------- 內建配樂（程式即時合成）：每一區一首輕柔的曲子，白天／夜晚有不同編制 ----------
   沒有放音樂檔（public/music/tracks.json）的區域就用這裡的曲子，換區時一樣 2.5 秒交叉淡入淡出。
   全部用 WebAudio 合成：沒有版權問題、不用下載、離線也能播。曲子由「和弦進行＋樂句產生器」組成：
   每 8 小節重新寫一段 A A' B A'' 的旋律，所以聽起來像有編曲、又不會一直重複同一段。 */
const mtof = m => 440 * Math.pow(2, (m - 69) / 12);
const SONGS = {
  // 森林：F 大調，午後陽光；卡林巴琴分解和弦＋木琴旋律＋很輕的沙鈴
  base: { bpm: 72, swing: .04, cut: 2600, rev: .32,
    ch: [[41, [57, 60, 64, 67]], [38, [57, 60, 62, 65]], [46, [57, 58, 62, 65]], [36, [55, 60, 62, 67]], [45, [55, 60, 64, 67]], [38, [57, 60, 64, 65]], [43, [58, 62, 65, 67]], [36, [55, 60, 65, 67]]],
    sc: [65, [0, 2, 4, 7, 9]], lo: 65, hi: 84, mel: 'marimba', arp: 'kalimba', arpP: [0, 2, 1, 3, 2, 1, 3, 2], pad: { type: 'triangle', cut: 900, v: .022 }, bass: [0, 10], shaker: .012, dens: .55 },
  // 海岸：A 大調，海風與巴薩諾瓦的律動；尼龍弦旋律、電鋼琴切分和弦、沙鈴十六分音符
  coast: { bpm: 84, swing: .08, cut: 3200, rev: .28,
    ch: [[45, [56, 61, 64, 69]], [42, [57, 61, 64, 66]], [38, [57, 61, 62, 66]], [40, [57, 59, 62, 64]], [45, [56, 61, 64, 69]], [37, [56, 59, 61, 64]], [47, [57, 59, 62, 66]], [40, [56, 59, 62, 64]]],
    sc: [69, [0, 2, 4, 7, 9]], lo: 66, hi: 86, mel: 'pluck', comp: [0, 6, 10], pad: { type: 'sine', cut: 1400, v: .016 }, bass: [0, 6, 8, 14], shaker: .016, sh16: true, dens: .6 },
  // 火山：D 多利安，溫暖帶點神祕；低沉長音、木琴低音域旋律、很輕的手鼓
  volcano: { bpm: 64, swing: 0, cut: 1800, rev: .38,
    ch: [[38, [53, 57, 60, 64]], [40, [55, 59, 62, 64]], [41, [53, 57, 59, 64]], [38, [53, 57, 62, 64]], [45, [55, 60, 64, 67]], [48, [55, 59, 60, 64]], [43, [55, 59, 62, 67]], [38, [53, 57, 62, 64]]],
    sc: [62, [0, 2, 3, 5, 7, 9, 10]], lo: 57, hi: 76, mel: 'marimba', pad: { type: 'sawtooth', cut: 520, v: .02 }, drone: true, bass: [0], drum: [0, 7, 10], dens: .42 },
  // 雪原：E 大調（利底亞色彩），音樂盒＋鐘琴，空氣感的長音，沒有打擊樂
  snow: { bpm: 60, swing: 0, cut: 4200, rev: .45, bars: 2,
    ch: [[40, [56, 59, 63, 66]], [37, [56, 59, 63, 64]], [45, [56, 61, 63, 64]], [47, [59, 61, 63, 66]]],
    sc: [76, [0, 2, 4, 7, 9]], lo: 74, hi: 93, mel: 'musicbox', arp: 'bell', arpP: [3, -1, 2, -1, 1, -1, 2, -1], pad: { type: 'triangle', cut: 2400, v: .014 }, bass: [0], dens: .5 },
  // 大城市：C 大調 lo-fi，窗邊咖啡店；電鋼琴和弦、輕鼓、黑膠底噪
  city: { bpm: 78, swing: .12, cut: 2200, rev: .22,
    ch: [[36, [59, 62, 64, 67]], [45, [55, 59, 60, 64]], [38, [57, 60, 64, 65]], [43, [53, 57, 59, 64]]],
    sc: [72, [0, 2, 4, 7, 9]], lo: 67, hi: 84, mel: 'epiano', comp: [0, 6], compLong: true, pad: { type: 'sine', cut: 900, v: .01 }, bass: [0, 10], kit: true, crackle: true, dens: .45 },
};
const GEN = { on: {}, bus: null };
function genBus() {
  if (GEN.bus) return GEN.bus; const ac = AC;
  const out = ac.createGain(), lp = ac.createBiquadFilter(), comp = ac.createDynamicsCompressor(), rev = ac.createConvolver(), wet = ac.createGain();
  lp.type = 'lowpass'; lp.frequency.value = 3000; lp.Q.value = .4; comp.threshold.value = -20; comp.ratio.value = 3; comp.attack.value = .01; comp.release.value = .3;
  // 殘響：程式產生 3.2 秒、越後面越暗的雜訊脈衝響應
  const len = Math.floor(ac.sampleRate * 3.2), ir = ac.createBuffer(2, len, ac.sampleRate);
  for (let c = 0; c < 2; c++) { const d = ir.getChannelData(c); let lpv = 0; for (let i = 0; i < len; i++) { const k = i / len, a = .55 - .45 * k; lpv = lpv * a + (Math.random() * 2 - 1) * (1 - a); d[i] = lpv * Math.pow(1 - k, 2.4) * (i < ac.sampleRate * .012 ? i / (ac.sampleRate * .012) : 1); } }
  rev.buffer = ir; wet.gain.value = .3;
  out.connect(lp); lp.connect(comp); lp.connect(rev); rev.connect(wet); wet.connect(comp); comp.connect(ac.destination);
  return GEN.bus = { out, lp, wet };
}
// ---- 樂器 ----
function gEnv(t, a, peak, dur, rel = .3) { const g = AC.createGain(); g.gain.setValueAtTime(.0001, t); g.gain.linearRampToValueAtTime(peak, t + a); g.gain.setTargetAtTime(.0001, t + a, Math.max(.02, dur / 4)); g.gain.setTargetAtTime(0, t + a + dur, rel / 4); return g; }
function gFM(dst, t, m, v, o) {
  const f = mtof(m), car = AC.createOscillator(), mod = AC.createOscillator(), mg = AC.createGain(), amp = gEnv(t, o.a || .004, v, o.d, o.r || .4);
  car.frequency.value = f; mod.frequency.value = f * o.ratio; mg.gain.setValueAtTime(f * o.idx, t); mg.gain.setTargetAtTime(f * (o.idx2 || 0), t, o.id);
  mod.connect(mg); mg.connect(car.frequency); car.connect(amp); amp.connect(dst);
  const end = t + o.d * 2.2 + 1; car.start(t); mod.start(t); car.stop(end); mod.stop(end);
}
const INST = {
  kalimba: (d, t, m, v) => gFM(d, t, m, v, { ratio: 5.1, idx: 1.4, id: .03, d: 1.3 }),
  marimba: (d, t, m, v) => gFM(d, t, m, v, { ratio: 4, idx: 1.1, id: .025, d: .7 }),
  pluck: (d, t, m, v) => gFM(d, t, m, v, { ratio: 1, idx: 2.6, idx2: .2, id: .05, d: 1.1 }),
  epiano: (d, t, m, v, len = 1.6) => gFM(d, t, m, v, { ratio: 1, idx: 1.6, idx2: .25, id: .18, d: len }),
  bell: (d, t, m, v) => gFM(d, t, m, v, { ratio: 3.5, idx: 1.2, idx2: .1, id: .25, d: 2.4 }),
  musicbox: (d, t, m, v) => gFM(d, t, m, v, { ratio: 4, idx: .9, id: .04, d: 1.8 }),
};
function gPad(dst, t, notes, dur, P) {
  const f = AC.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = P.cut; f.Q.value = .5; f.connect(dst);
  const g = AC.createGain(); g.gain.setValueAtTime(.0001, t); g.gain.linearRampToValueAtTime(P.v, t + Math.min(1.6, dur * .4)); g.gain.setValueAtTime(P.v, t + dur * .75); g.gain.linearRampToValueAtTime(.0001, t + dur + 1.4); g.connect(f);
  notes.forEach(m => [-6, 6].forEach(c => { const o = AC.createOscillator(); o.type = P.type; o.frequency.value = mtof(m); o.detune.value = c; o.connect(g); o.start(t); o.stop(t + dur + 1.6); }));
}
function gBass(dst, t, m, dur, v) {
  const o = AC.createOscillator(), o2 = AC.createOscillator(), f = AC.createBiquadFilter(), g = gEnv(t, .02, v, dur, .25); o.type = 'sine'; o2.type = 'triangle'; o.frequency.value = mtof(m); o2.frequency.value = mtof(m + 12);
  const g2 = AC.createGain(); g2.gain.value = .25; f.type = 'lowpass'; f.frequency.value = 420; o.connect(f); o2.connect(g2); g2.connect(f); f.connect(g); g.connect(dst); o.start(t); o2.start(t); o.stop(t + dur + .5); o2.stop(t + dur + .5);
}
function gNoise(dst, t, dur, freq, q, v, type = 'bandpass') {
  const src = AC.createBufferSource(); src.buffer = NB; const fl = AC.createBiquadFilter(); fl.type = type; fl.frequency.value = freq; fl.Q.value = q;
  const g = AC.createGain(); g.gain.setValueAtTime(.0001, t); g.gain.linearRampToValueAtTime(v, t + .004); g.gain.exponentialRampToValueAtTime(.0005, t + dur);
  src.connect(fl); fl.connect(g); g.connect(dst); src.start(t, Math.random() * .5, dur + .05);
}
function gKick(dst, t, v, f0 = 110, f1 = 45, dur = .28) { const o = AC.createOscillator(), g = gEnv(t, .003, v, dur * .5, .1); o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(f1, t + dur * .6); o.connect(g); g.connect(dst); o.start(t); o.stop(t + dur + .2); }
// ---- 旋律產生器：2 小節一句，8 小節一段 A A' B A'' ----
const RHY = [[0, 4, 6, 8, 12, 16, 22, 24], [0, 6, 8, 14, 16, 20, 24], [2, 4, 8, 12, 18, 20, 24, 28], [0, 8, 10, 12, 16, 24], [0, 3, 6, 8, 16, 19, 22, 24], [4, 6, 8, 16, 18, 20, 24]];
function genPhrase(S0, dens) {
  const r = pick(RHY), notes = []; let deg = Math.floor(rnd(1, 5));
  r.forEach((st, i) => { if (i && Math.random() > dens + .25) return; deg = clamp(deg + pick([-2, -1, -1, 0, 1, 1, 2]), 0, 9); notes.push({ st, deg, len: (r[i + 1] != null ? r[i + 1] - st : 8) }); });
  if (notes.length) notes[notes.length - 1].len = Math.max(notes[notes.length - 1].len, 6); return notes;
}
function degPitch(S0, deg, chord) {
  const [root, iv] = S0.sc; let m = root + iv[((deg % iv.length) + iv.length) % iv.length] + 12 * Math.floor(deg / iv.length);
  while (m > S0.hi) m -= 12; while (m < S0.lo) m += 12; return m;
}
function snapChord(m, chord) { const pcs = chord[1].map(n => n % 12); let best = m, bd = 99; for (let d = -3; d <= 3; d++) if (pcs.includes(((m + d) % 12 + 12) % 12) && Math.abs(d) < bd) { bd = Math.abs(d); best = m + d; } return best; }
function genStep(st, t, step, nite) {
  const S0 = SONGS[st.k], bars = S0.bars || 1, spb = 16 * bars, bar = Math.floor(st.n / 16), cIdx = Math.floor(bar / bars) % S0.ch.length, chord = S0.ch[cIdx], d = st.g, q = 60 / S0.bpm / 4, inBar = st.n % 16;
  const v = nite ? .7 : 1, dens = S0.dens * (nite ? .6 : 1);
  if (st.n % spb === 0) { gPad(d, t, chord[1], q * spb, S0.pad); if (S0.drone) gBass(d, t, chord[0], q * spb, .05); }
  if (S0.bass && S0.bass.includes(inBar) && !(S0.drone && inBar === 0)) gBass(d, t, chord[0] + (inBar >= 8 && S0.bass.length > 2 && st.k === 'coast' ? 7 : 0), q * (S0.bass.length > 2 ? 3 : 6), .07 * v);
  if (S0.arp && inBar % 2 === 0 && (bars === 1 || st.n % 32 < 16 || Math.random() < .5)) { const ix = S0.arpP[inBar / 2]; if (ix >= 0 && Math.random() < (nite ? .55 : .85)) INST[S0.arp](d, t, chord[1][ix % 4] + 12, (inBar % 8 === 0 ? .05 : .035) * v); }
  if (S0.comp && S0.comp.includes(inBar) && Math.random() < .9) chord[1].forEach((m, i) => INST.epiano(d, t + i * .012, m, .022 * v, S0.compLong ? q * 10 : q * 3));
  if (S0.shaker && (S0.sh16 || inBar % 2 === 1)) gNoise(d, t, .05, 7000, 1.2, S0.shaker * (inBar % 4 === 2 ? 1.4 : 1) * v * rnd(.7, 1.1), 'highpass');
  if (S0.drum && S0.drum.includes(inBar)) gKick(d, t, .06 * v, 160, 90, .35);
  if (S0.kit) { if (inBar === 0 || inBar === 10) gKick(d, t, .11 * v); if (inBar === 4 || inBar === 12) gNoise(d, t, .16, 1900, .8, .035 * v); if (inBar % 2 === 0) gNoise(d, t, .03, 9000, 1, .012 * v * (inBar % 4 ? .6 : 1), 'highpass'); }
  if (S0.crackle && Math.random() < .35) gNoise(d, t + rnd(0, q), .01, rnd(2000, 6000), 2, rnd(.004, .012));
  // 旋律：每 8 小節寫新的一段
  const ph = Math.floor(st.n / 32) % 4, at = st.n % 32;
  if (st.n % 128 === 0 || !st.A) { st.A = genPhrase(S0, dens); st.B = genPhrase(S0, dens); st.rest = Math.random() < .3 ? Math.floor(rnd(0, 4)) : -1; }
  if (ph === st.rest) return;
  const src = ph === 2 ? st.B : st.A, sh = ph === 1 ? 1 : ph === 3 ? -1 : 0;
  for (const nt of src) if (nt.st === at) { let m = degPitch(S0, nt.deg + sh, chord); if (at % 8 === 0) m = snapChord(m, chord); INST[S0.mel](d, t + rnd(0, .012), m, (at % 8 === 0 ? .07 : .055) * v * rnd(.85, 1)); }
}
// 每格畫面排程未來 0.3 秒內的音符；分頁切到背景時畫面更新停止，音樂也自然停下，回來時從現在接著播
function genMusic(dt, key, vol) {
  if (!AC || !NB) return; const ac = AC, now = ac.currentTime, nite = DN.night > .55, bus = key || Object.keys(GEN.on).length ? genBus() : null; if (!bus) return;
  bus.lp.frequency.value += ((nite ? 1800 : (SONGS[key] || SONGS.base).cut) - bus.lp.frequency.value) * Math.min(1, dt);
  bus.wet.gain.value += (((SONGS[key] || SONGS.base).rev + (nite ? .12 : 0)) - bus.wet.gain.value) * Math.min(1, dt);
  if (key && !GEN.on[key]) { const g = ac.createGain(); g.gain.value = 0; g.connect(bus.out); GEN.on[key] = { k: key, g, v: 0, n: 0, next: now + .1 }; }
  for (const k in GEN.on) {
    const st = GEN.on[k]; st.v = k === key ? Math.min(1, st.v + dt / 2.5) : Math.max(0, st.v - dt / 2.5); st.g.gain.value = Math.sin(st.v * Math.PI / 2) * vol * 1.6;
    if (st.v <= 0 && k !== key) { const g = st.g; setTimeout(() => { try { g.disconnect(); } catch (e) { } }, 4000); delete GEN.on[k]; continue; }
    const S0 = SONGS[k], q = 60 / S0.bpm / 4;
    if (st.next < now - .15) st.next = now + .05; // 卡頓或剛從背景回來：不補播，直接從現在開始
    while (st.next < now + .3) { try { if (vol > .001) genStep(st, st.next, st.n, nite); } catch (e) { } st.n++; st.next += q * (st.n % 2 ? 1 + S0.swing : 1 - S0.swing); }
  }
}
const genKey = () => { const z = TITLE.on ? 'forest' : (W.zoneNow || 'forest'); return z === 'forest' ? 'base' : SONGS[z] ? z : 'base'; };
// 環境音：程式合成（不需要音樂檔），白天鳥叫、夜裡蟲鳴、海浪、火山低鳴、雪原的風、城市車流
function swell(t, dur, f, q, vol, type = 'lowpass') {
  const ac = AC, src = ac.createBufferSource(); src.buffer = NB; src.loop = true; src.playbackRate.value = rnd(.7, 1.1);
  const fl = ac.createBiquadFilter(); fl.type = type; fl.frequency.value = f; fl.Q.value = q;
  const g = ac.createGain(); g.gain.setValueAtTime(.0001, t); g.gain.linearRampToValueAtTime(vol, t + dur * .45); g.gain.linearRampToValueAtTime(.0001, t + dur);
  src.connect(fl); fl.connect(g); g.connect(master); src.start(t); src.stop(t + dur + .05);
}
const AMB = { t: 1 };
function ambStep(dt) {
  if (!AC || AC.state !== 'running' || !S.sound || TITLE.on || !P || GUI.kind === 'live') return;
  if (RIDE.on && RIDE.shut) return; // 坐在計程車裡、車門關著：聽不到外面的鳥叫（下車開門那一刻恢復）
  if ((AMB.t -= dt) > 0) return; if (caveAmb()) return; const t = AC.currentTime, z = W.zoneNow || 'forest', nite = DN.night > .5;
  if (z === 'forest') {
    if (!nite) { const f = rnd(2400, 3600); for (let i = 0, n = 2 + Math.floor(rnd(0, 3)); i < n; i++) sweep(f * rnd(.9, 1.1), f * rnd(1.2, 1.5), t + i * .13, .09, .012); AMB.t = rnd(2.5, 6); }
    else { for (let i = 0; i < 6; i++) tone(4300, t + i * .055, .03, .006, 'triangle'); AMB.t = rnd(.7, 1.6); }
  } else if (z === 'coast') { swell(t, rnd(3.5, 5), 520, .7, .05); if (!nite && Math.random() < .25) sweep(1500, 900, t + 1, .35, .01, 'triangle'); AMB.t = rnd(3.5, 5.5); }
  else if (z === 'volcano') { swell(t, rnd(2.5, 4), 85, .8, .07); AMB.t = rnd(3, 5); }
  else if (z === 'snow') { swell(t, rnd(3.5, 5.5), rnd(380, 650), .9, .035, 'bandpass'); AMB.t = rnd(3, 5); }
  else if (z === 'city') { swell(t, rnd(2, 3.5), 260, .7, .025); AMB.t = rnd(2.5, 4.5); }
  else AMB.t = 3;
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
    else if (kind === 'ice') { noise(ac, t, .035, rnd(3200, 4200), 3, .05 * v, 'bandpass'); tone(rnd(1800, 2400), t, .05, .01 * v, 'triangle'); noise(ac, t, .05, 220, 1, .04 * v, 'lowpass'); }
    else if (kind === 'splash') { noise(ac, t, .16, rnd(900, 1500), .7, .08 * v, 'bandpass', 1.2); noise(ac, t + .03, .1, 3000, 1.2, .03 * v, 'highpass'); }
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
  if (RIDE.on) { RIDE.tq.push(msg); if (RIDE.tq.length > 3) RIDE.tq.shift(); return; } // 搭車中畫面上不跳字，下車後每 600 ms 補一則（rideEnd）
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
  return { group, mesh: m, ov, geo, base, nor, base0: base.slice(), off: new Float32Array(n), vel: new Float32Array(n), groups: [...map.values()].filter(a => a.length > 1), cv, tex, dg, decoMeshes: [], n, sp: null, shape: '' };
}
function jellyColors(J, sp) {
  J.lastSp = sp; if (J.sp === sp.id) return; J.sp = sp.id;
  const col = J.geo.attributes.color, c1 = new THREE.Color(sp.color), c2 = new THREE.Color(sp.color2 || sp.color), wh = new THREE.Color('#ffffff'), t = new THREE.Color();
  for (let i = 0; i < J.n; i++) { const x = J.base[i * 3], y = J.base[i * 3 + 1]; t.copy(c1).lerp(c2, clamp((x + y) / 4 + .5, 0, 1)).lerp(wh, clamp(y * .12 + .05, 0, .2)); col.setXYZ(i, t.r, t.g, t.b); }
  col.needsUpdate = true; if (J.mesh.material.attenuationColor) J.mesh.material.attenuationColor.set(sp.color);
  if (J.mesh.material.emissive) { J.mesh.material.emissive.set(sp.night ? sp.color : '#000000'); J.mesh.material.emissiveIntensity = sp.night ? .35 : 0; }
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
    case 'moss': { const g = new THREE.IcosahedronGeometry(.2, 1); g.scale(1, .55, 1); return g; } // 一小團軟軟的苔蘚
  }
  return new THREE.SphereGeometry(.2);
}
function decoMat(k) {
  const d = DECO[k];
  return new THREE.MeshPhysicalMaterial({ color: d.c, roughness: d.metal ? .22 : .3, metalness: d.metal ? .9 : .1, clearcoat: 1, emissive: d.glow ? d.c : '#000000', emissiveIntensity: d.glow ? (k === 'moss' ? .55 : .9) : 0, transmission: d.pack === 'glass' ? .5 : 0, thickness: .5 });
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
  function apply() { st.shown = st.p; const J = st.J; J.group.visible = !!st.p; if (!st.p) { jellyDeco(J, null); return; } jellyColors(J, SP[st.p.sp]); jellyTexture(J, st.p); jellyDeco(J, st.p); jellyCut(J, st.p); }
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
    const eff = effCrisp(p); sfx.crunch(.6 + eff * .6, eff); if (navigator.vibrate) navigator.vibrate(12); p.dur = Math.max(0, p.dur - 2.2 * wearOf(p)); p.played = true;
    let u = q.uv.x, v = q.uv.y, a = rnd(0, PI2); const cr = [u, v];
    for (let k = 0; k < 4; k++) { a += rnd(-.8, .8); const l = rnd(.03, .08); u += Math.cos(a) * l; v += Math.sin(a) * l; cr.push(u, v); }
    p.cracks.push(cr); if (p.cracks.length > 30) p.cracks.shift(); jellyTexture(st.J, p);
    st.C.emit(q.world, Math.round(8 + eff * 14), SP[p.sp].color); st.flash = 1; st.onCrunch && st.onCrunch(st, eff, { uv: [q.uv.x, q.uv.y], hit: [st.hit.x, st.hit.y, st.hit.z], cr });
  };
  st.remoteCrunch = m => {
    const p = st.p; if (!p || !st.ready) return; const hit = new THREE.Vector3(...m.hit); st.rem = { hit, t: .22 };
    if (m.cr) { p.cracks.push(m.cr); if (p.cracks.length > 30) p.cracks.shift(); jellyTexture(st.J, p); }
    p.dur = Math.max(0, p.dur - 2.2 * wearOf(p)); sfx.crunch(.6 + m.eff * .6, m.eff); st.C.emit(st.J.mesh.localToWorld(hit.clone()), Math.round(8 + m.eff * 14), SP[p.sp].color); st.flash = 1;
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
   中央森林（工坊所在）被一圈山脊環繞。第 4 堂起山脊不再留筆直的隘口：東／北／西各有一條山洞穿過山脊（public/game/caves.js），
   能量門移到內側洞口，需解開前一區的謎題才能通過；南方山壁有一道只在夜裡開放的裂縫（月光洞窟）。
   ============================================================ */
const DAY_LEN = 600, DN = { t: 0, night: 0, dusk: 0, dawn: 0, phase: 'day', p: 0 };
const DN_PHASE = { day: '白天', dusk: '黃昏', night: '夜晚', dawn: '黎明' };
// 時間不存檔：同一間教室看到同一個天色，多人連線也不用同步（W.dnOff 只給測試用）
function dnUpdate() {
  const t = ((Date.now() / 1000 + (W.dnOff || 0)) % DAY_LEN + DAY_LEN) % DAY_LEN, sm = x => x * x * (3 - 2 * x);
  DN.t = t; DN.p = t / DAY_LEN;
  DN.night = t < 300 ? 0 : t < 360 ? sm((t - 300) / 60) : t < 540 ? 1 : 1 - sm((t - 540) / 60);
  DN.dusk = t >= 300 && t < 360 ? Math.sin(Math.PI * (t - 300) / 60) : 0; DN.dawn = t >= 540 ? Math.sin(Math.PI * (t - 540) / 60) : 0;
  const ph = t < 300 ? 'day' : t < 360 ? 'dusk' : t < 540 ? 'night' : 'dawn';
  if (ph !== DN.phase) { const prev = DN.phase; DN.phase = ph; if (W.ready && !TITLE.on && prev) { if (ph === 'dusk') toast('夜晚快到了，夜行史萊姆要出來了'); else if (ph === 'night') toast('夜晚來臨：史萊姆身上發著微光，夜行種類出現了'); else if (ph === 'dawn') toast('天快亮了，夜行史萊姆要躲回去了'); } }
  NIGHT_U.value = DN.night;
}
const NIGHT_U = { value: 0 }; // 所有史萊姆共用：夜裡身上發光（自發光材質，不加光源）
const DNC = { fog: new THREE.Color('#1c2650'), top: new THREE.Color('#0a1130'), sun: new THREE.Color('#b8c6ff'), hs: new THREE.Color('#4b5b9a'), hg: new THREE.Color('#141a33'),
  duskFog: new THREE.Color('#e9a07a'), duskTop: new THREE.Color('#6b4c93'), duskSun: new THREE.Color('#ffb27a'), dawnFog: new THREE.Color('#f2b9c8'), dawnTop: new THREE.Color('#7a8fd0'), dawnSun: new THREE.Color('#ffd2c2') };
/* 區域色票（第 3 堂 2.3）：主色決定地面與遠山，強調色只給史萊姆、工作站與地標；之後新增區域先在這裡加一列 */
const PALETTE = {
  forest: { main: '#7CC47F', sub: '#C9B48A', light: '#FFE7A8', mark: '森林巨樹' },
  coast: { main: '#5EC2E8', sub: '#F2DFB0', light: '#FFF6E0', mark: '燈塔' },
  volcano: { main: '#E8743B', sub: '#5B4A44', light: '#FFB27A', mark: '冒煙的火山口' },
  snow: { main: '#BFE3F5', sub: '#F4F8FB', light: '#EAF4FF', mark: '冰晶塔' },
  city: { main: '#8A96A8', sub: '#F2C14E', light: '#FFF1D0', mark: '鐘塔' },
  night: { main: '#26325C', sub: '#C7D2FE', light: '#B8C6FF', mark: '月亮' },
};
const ZONE3D = {
  forest: { top: '#5ea7d6', fog: '#cfe6dc', sun: PALETTE.forest.light, hemiS: '#d8f0ff', hemiG: '#36405e', pal: ['#68ad69', '#4c8a52', '#5f7d58', '#707468', '#e2e8f0'] },
  coast: { top: '#3f9fe0', fog: '#d4ecf8', sun: PALETTE.coast.light, hemiS: '#e0f4ff', hemiG: '#5a5870', pal: ['#e3d09a', '#79ad62', '#4f8a4f', '#8b9096', '#e2e8f0'] },
  volcano: { top: '#2a0f12', fog: '#6b3324', sun: '#ffb27a', hemiS: '#ff9a6b', hemiG: '#140a08', pal: ['#3d2c27', '#2e221e', '#231a18', '#161112', '#4a332b'] },
  snow: { top: '#7fa9d8', fog: '#e3edf7', sun: PALETTE.snow.light, hemiS: '#eef6ff', hemiG: '#8a96c0', pal: ['#f3f7fb', '#e5edf6', '#d7e3f0', '#7f8c9e', '#ffffff'] },
};
const BIOMES = ['forest', 'coast', 'volcano', 'snow'];
const K = 1.6, CITY = { x: 4000, z: 0 }, kk = ([x, z]) => [x * K, z * K];
const inCity = (x = P ? P.x : 0) => x > 1500;
function biomeW(x, z) { return biomeW0(x / K, z / K); }
function biomeW0(x, z) {
  // 依方位分區（對角線的分隔山脈為界），避免雪原北半部、海岸北半部被判成火山
  const ax = Math.abs(x), az = Math.abs(z), c = smooth(44, 60, x) * smooth(-8, 8, x - az), v = smooth(44, 60, -z) * smooth(-8, 8, -z - ax), s = smooth(44, 60, -x) * smooth(-8, 8, -x - az), f = Math.max(0, 1 - c - v - s), t = f + c + v + s;
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
/* 小場景的地形雕塑（H0 最後呼叫 nookH）：放在 H0 前面，任何時候算高度都已經初始化好了；場景本身在「小場景與彩蛋」段落 */
// 地形雕塑：w 水面（或整平）高度、d 碗深（0＝整平）、dig 整平時再往下挖（冰面下留空間給魚）、b 外圍過渡寬度、wob 岸線起伏、keep 外圍不低於水面（裝水的才要）
const NOOK_DIG = [
  { x: -23, z: -13.5, r: 5, w: -.66, d: .45, b: 2.5, wob: .1, keep: 1 },        // 0 睡蓮池塘
  { x: 129.4, z: -24.2, r: 2.2, w: -.34, d: .32, b: 1, wob: .14, keep: 1 },       // 1-3 潮池
  { x: 131.2, z: -30.4, r: 2.6, w: -.48, d: .34, b: 1.2, wob: .14, keep: 1 },
  { x: 129.2, z: -36.4, r: 1.9, w: .1, d: .3, b: 1, wob: .14, keep: 1 },
  { x: -55, z: -112, r: 3.6, w: -.28, d: .5, b: 1.6, wob: .08, keep: 1 },        // 4 溫泉
  { x: -138, z: -41, r: 7, w: 1.32, d: 0, dig: .1, b: 2.6, wob: .06, keep: 1 },   // 5 冰湖
  { x: -158.4, z: 38.6, r: 2.6, w: 2.74, d: 0, dig: .06, b: 1.4, wob: .1, keep: 1 }, // 6 冰瀑下的水潭
  { x: -128.4, z: -45.6, r: 2, w: 2.45, d: 0, b: 1.6 },                           // 7 冰屋地基
  { x: -141.5, z: -33.5, r: 1.8, w: 2.05, d: 0, b: 1.6 },                         // 8 雪人一家
];
// 岸線半徑（基礎單位）：兩個不同頻率的起伏，池塘不會是正圓
const nookR = (p, a) => p.r * (1 + (p.wob || 0) * Math.sin(a * 3 + p.x) * (.7 + .3 * Math.sin(a * 5 + p.z)));
function nookH(x, z, h) {
  for (const p of NOOK_DIG) {
    const dx = x - p.x, dz = z - p.z, R = p.r * (1 + (p.wob || 0)) + p.b; if (dx * dx + dz * dz > R * R) continue;
    const d = Math.hypot(dx, dz), rr = nookR(p, Math.atan2(dz, dx));
    if (d < rr) { const u = d / rr; h = p.d ? p.w - p.d + (p.d + .08) * u * u : p.w - (p.dig || 0) * (1 - smooth(.75, 1, u)); }
    else { const e = p.d ? p.w + .08 : p.w, s = smooth(rr, rr + p.b, d); h = e + (h - e) * s; if (p.keep) h = Math.max(h, p.w + .04 * s); }
  }
  return h;
}
/* ---------- 計程車與月光隧道：資料（谷口的地形雕塑 taxiShape 在 H0 裡呼叫，所以數字放在 H0 前面；程式在「計程車與月光隧道」段落） ----------
   兩根一模一樣的直管：月光谷那根在南面山腳（谷口），城市那根在大街西端盡頭。車子在月光谷那根往山裡開到 u＝15（第 3 盞燈正下方），
   換到城市那根的 u＝15、車頭反過來往外開——等於繞 (u＝15, 橫向 0) 轉 180°。管子裡 u∈[0, 30] 對這一點點對稱、鏡頭只畫第 3 層（管子、車、車內）、
   球形霧 14 m，所以換邊那一格不管往哪裡看都一模一樣。月光谷是世界座標；城市是相對 CITY 的座標（公尺）。 */
const TAXI = {
  V: { x: -32, y: -.6, z: 72.8, dx: 0, dz: 1 }, // 谷口：洞口面的路面中心、往山裡的方向（往南）
  C: { x: -84, y: .04, z: 0, dx: -1, dz: 0 }, // 城市洞口（相對 CITY）：往西；原點抬高 4 cm，管子地板蓋過柏油（.005）與標線（.02）
  U: 15, LEN: 36, HW: 4.4, WALL: 2.6, TOP: 5.8, DEEP: 6, LAMP: [3, 9, 15, 21, 27, 33],
  vStand: [-19.6, 19, -Math.PI / 2], vDrop: [-8.9, 20, Math.PI / 2], vOut: [-7.05, 20.75], vLook: [0, 8], // [x, z, 車的 rotation.y]：上車處車頭朝南、下車處車頭朝北（右門朝東對著工坊）
  cStand: [-28.5, -5.4, Math.PI], cDrop: [-24, 5.4, 0], cOut: [-24.75, 7.55], cOutF: [-27.75, -7.55], cLook: [0, 26], cHosp: [-34, -12.6], // 醫院門口（右門＝北側人行道）、咖啡館前
  E: [-.62, 1.32, .36], M: [-.62, 1.2, .92], D: [-.62, 1.5, 1.55], // 後座的眼睛、門檻、門外（車的本地座標：+x 車頭、+z 右側；z 乘上哪一側 s）
};
const TNL = { raw: false, A: new THREE.Vector4(-32, -.6, 72.8, 6.4), B: new THREE.Vector4(0, 1, 4.6, 6) }; // terrainMat 在谷口挖洞的範圍（比管子大 0.2 m，地形不會和管壁打架）
// 搭車的狀態（toast、save、keydown 都會讀，所以也放在前面）。ph：board（上車）→ drive（兩段路）→ wait（到站但介面開著）→ alight（下車）
const RIDE = { on: false, dir: '', ph: '', t: 0, t0: 0, legs: null, li: 0, rate: 1, hk: new Map(), ffT: 0, cab: null, side: 1, ly: .1, lp: -.05, lastYaw: 0, sus: null, head: null, k: 0, u: -99, f0: null, safe: null, stand: null, frozen: false, tq: [], said: {}, evs: [], fz: null, log: null, shut: false, cv: null, held: false, out: false, snap: 0, fast: 0 };
// 接在 H0 的 nookH 之後（基礎單位，先換成世界座標再比）：谷口前 16 m 整平到路面高度、管子上方墊土（權重同 caveShape），從谷口看進去不會看到地形穿進管子
function taxiShape(x, z, h) {
  if (TNL.raw) return h; const V = TAXI.V, xw = x * K - V.x, zw = z * K - V.z, u = xw * V.dx + zw * V.dz, v = Math.abs(xw * V.dz - zw * V.dx);
  if (u < -21 || u > 47 || v > 18) return h;
  h += (V.y / K - h) * smooth(-20, -16, u) * (1 - smooth(0, 1.5, u)) * (1 - smooth(7, 11, v));
  const top = (V.y + TAXI.TOP + 2.4) / K, wt = (1 - smooth(5.6, 10.9, v)) * smooth(1.9, 3.6, u) * (1 - smooth(40, 46, u)); if (h < top) h += (top - h) * wt;
  return h;
}
function H0(x, z) {
  const ax = Math.abs(x), az = Math.abs(z), r = Math.max(ax, az);
  let h = (fbm(x * .045, z * .045, 3) - .45) * 3.2 + (vnoise(x * .2, z * .2, 11) - .5) * .35;
  const fl = 1 - smooth(16, 26, Math.hypot(x, z)); h = h * (1 - fl) + .25 * fl;
  // 山脊是完整的一圈（第 4 堂：隘口改成山洞，從中央平地再也看不穿到下一區）
  const ridge = Math.exp(-((r - 54) ** 2) / 34) * (13 + fbm(x * .07, z * .07, 5) * 9); h += ridge;
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
  // 小場景的地形：池塘與溫泉挖出碗、冰湖與冰屋整平（只動場景附近，見 NOOK_DIG）
  h = nookH(x, z, h);
  h = taxiShape(x, z, h); // 月光隧道的谷口（計程車鑽進南面山腳）
  // 山洞口：洞口前整平成小平台、洞口後方墊高成山壁（caves.js 的 caveShape）
  if (typeof caveShape === 'function') h = caveShape(x, z, h);
  return h;
}
const WS_R = 16, WS_Y = .4;
function G(x, z) { if (CV.c) return caveG(x, z); const T = TAXI.V, u = (x - T.x) * T.dx + (z - T.z) * T.dz; if (u > -.3 && u < TAXI.LEN && Math.abs((x - T.x) * T.dz - (z - T.z) * T.dx) < TAXI.HW) return T.y; return H(x, z); } // 玩家腳下：在山洞裡用山洞自己的地面；月光隧道的洞口裡是管子的地板（地形在那裡被挖掉了，H 還是山坡的高度）

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
  W.r.localClippingEnabled = true; // 切片時史萊姆本體在切口處截斷（只有設了 clippingPlanes 的材質受影響）
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
    uniforms: { top: { value: new THREE.Color('#5ea7d6') }, bot: { value: new THREE.Color('#cfe6dc') }, sunDir: { value: new THREE.Vector3(30, 55, 22).normalize() }, night: NIGHT_U }, side: THREE.BackSide, depthWrite: false, fog: false,
    vertexShader: 'varying vec3 vd; void main(){ vd = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
    fragmentShader: 'uniform vec3 top; uniform vec3 bot; uniform vec3 sunDir; uniform float night; varying vec3 vd; float h3(vec3 p){ return fract(sin(dot(p, vec3(12.9898, 78.233, 37.719))) * 43758.5453); } void main(){ vec3 d = normalize(vd); vec3 c = mix(bot, top, smoothstep(0.0, 0.45, d.y)); float s = max(dot(d, sunDir), 0.0); vec3 sc = mix(vec3(1.0, 0.93, 0.78), vec3(0.78, 0.84, 1.0), night); c += sc * (pow(s, 700.0) * 3.5 * (1.0 - night * 0.3) + pow(s, 48.0) * 0.28 * (1.0 - night * 0.5) + pow(s, 6.0) * 0.07 * (1.0 - night)) * smoothstep(-0.05, 0.05, d.y); float st = step(0.9965, h3(floor(d * 230.0))) * night * smoothstep(0.03, 0.3, d.y); c += vec3(0.85, 0.9, 1.0) * st; c += (fract(sin(dot(gl_FragCoord.xy, vec2(12.9898, 78.233))) * 43758.5453) - 0.5) / 160.0; gl_FragColor = vec4(c, 1.0);\n#include <tonemapping_fragment>\n#include <colorspace_fragment>\n}',
  })); W.sky.renderOrder = -1; sc.add(W.sky);
  buildTerrain(); buildCaves(); buildWater(); buildProps(); buildLandmarks(); buildFauna(); buildWorkshop(); buildCity(); buildTunnel(); buildVolcanoFx(); buildGates(); buildPuzzles(); buildParticles(); buildClouds();
  W.goo = makeGoo(sc); skyEnv(true);
  initPlayer(); spawnAllSlimes(); resizeWorld(); bindInput(); applyQuality(true); taxiWarm(); W.ready = true; return true;
}
/* ---------- 小徑：烘焙成遮罩（地表著色、道具避讓、腳步聲共用） ---------- */
const MAP_SIZE = 370 * K, PMR = 512, PMASK = new Float32Array(PMR * PMR); let PATH_TEX = null;
// 0、1、3 是中央平地通往三個山洞內側洞口的路（路標沿著這三條立）；其餘是洞口外側通往各區的路
const PATH_LINES = [
  [[11, 0], [20, 2.5], [32, -1.5], [40, .6], [44.6, 0]],
  [[0, -11], [-2.5, -22], [2, -34], [-.6, -41], [0, -44.6]],
  [[-2.4, -64.6], [0, -72], [-2, -86]],
  [[-11, 0], [-21, -2.5], [-33, 2], [-40, -.6], [-44.6, 0]],
  [[64.6, 2.4], [70, 1.5], [78, -2.5], [92, 0], [104, 3]],
  [[-64.6, -2.4], [-70, -1], [-78, -2], [-94, 1]],
  [[-2.4, -64.6], [-8, -64.8], [-12.5, -63.8]],
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
  line(crPts([[-3, 16.5], [-5.6, 18.6], [-7.6, 20.2]]), 1); line([[0, 15], [0, 18.5]], 1.1); // 出生點到計程車下車處的小支線
  // 計程車的碎石路（去程、回程兩條）與空車繞花島北端開回站位的路：道具自動避開、走上去是泥土聲
  { const L = taxiLegs(), pts = (l, ok) => { const a = []; for (let i = 0; i < l.n; i += 4) if (ok(l.Z[i])) a.push([l.X[i], l.Z[i]]); a.push([l.X[l.n - 1], l.Z[l.n - 1]]); return a; }, out = z => z < TAXI.V.z + 2;
    line(pts(L[1], out).filter(p => out(p[1])), 3.4); line(pts(L[5], out).filter(p => out(p[1])), 3.4); line(pts(L[6], () => true), 2.8); }
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
    sh.uniforms.uPath = { value: PATH_TEX }; sh.uniforms.uTime = W.wind; sh.uniforms.uCvA = { value: CAVE_UA }; sh.uniforms.uCvB = { value: CAVE_UB }; sh.uniforms.uTnA = { value: TNL.A }; sh.uniforms.uTnB = { value: TNL.B };
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nattribute vec3 dirt;\nvarying vec3 vDirt;\nvarying vec3 vWP;\nvarying vec3 vWN;').replace('#include <begin_vertex>', '#include <begin_vertex>\nvDirt = dirt; vWP = position; vWN = normal;');
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nuniform sampler2D uPath;\nuniform float uTime;\nuniform vec4 uCvA[8];\nuniform vec4 uCvB[8];\nuniform vec4 uTnA;\nuniform vec4 uTnB;\nvarying vec3 vDirt;\nvarying vec3 vWP;\nvarying vec3 vWN;\n' + GLSL_DETAIL)
      .replace('#include <color_fragment>', `#include <color_fragment>
        // 山洞口：在洞口直段的斷面裡不畫地形（uCvA＝洞口地面中心＋直段長度、uCvB＝往洞裡的方向＋半寬＋高度；斷面形狀同 caves.js 的 caveProfile）
        for (int ci = 0; ci < 8; ci++) { vec4 ca = uCvA[ci]; if (ca.w <= 0.0) continue; vec4 cb = uCvB[ci]; vec2 cr = vWP.xz - ca.xz; float ct = dot(cr, cb.xy); if (ct < 0.0 || ct > ca.w) continue;
          float cl = abs(dot(cr, vec2(-cb.y, cb.x))), cy = (vWP.y - ca.y) / cb.w; if (cy < -0.03 || cy > 0.985) continue;
          float cf = cy < 0.12 ? 0.86 + cy / 0.12 * 0.14 : cy < 0.4 ? 1.0 : sqrt(max(0.0, 1.0 - pow((cy - 0.4) / 0.6, 2.0))); if (cl < cb.z * cf * 0.97) discard; }
        // 月光隧道的谷口：同一種挖法（斷面同 tubeGeo：直牆到 0.45、上面橢圓拱；uTnA＝洞口地面中心＋挖多深、uTnB＝往山裡的方向＋半寬＋高度）
        { vec2 tr = vWP.xz - uTnA.xz; float tt = dot(tr, uTnB.xy); if (tt >= 0.0 && tt <= uTnA.w) { float tl = abs(dot(tr, vec2(-uTnB.y, uTnB.x))), ty = (vWP.y - uTnA.y) / uTnB.w;
          if (ty > -0.03 && ty < 0.985) { float tf = ty < 0.45 ? 1.0 : sqrt(max(0.0, 1.0 - pow((ty - 0.45) / 0.55, 2.0))); if (tl < uTnB.z * tf) discard; } } }
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
        float lyr = vWP.y / 1.8 + rn * 0.35, lyf = fract(lyr), lyi = floor(lyr);
        float ledge = smoothstep(0.86, 0.97, lyf), under = 1.0 - smoothstep(0.0, 0.14, lyf), bandT = 0.9 + 0.14 * fract(sin(lyi * 12.9898) * 43758.5453);
        diffuseColor.rgb *= mix(1.0, bandT * (1.0 + ledge * 0.2) * (1.0 - under * 0.3), rockK);
        diffuseColor.rgb = mix(diffuseColor.rgb, diffuseColor.rgb * vec3(0.84, 0.87, 1.08), under * rockK);
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
  m.customProgramCacheKey = () => 'terrain4'; return m;
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
    sh.uniforms.uWind = W.wind; sh.uniforms.uWAmp = { value: amp }; sh.uniforms.uBump = W.bumpU || (W.bumpU = { value: new THREE.Vector4(1e9, 1e9, 0, 0) }); sh.uniforms.uFade = { value: new THREE.Vector2(...(fade || [1e6, 1e6 + 1])) };
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nuniform float uWind;\nuniform float uWAmp;\nuniform vec2 uFade;\nuniform vec4 uBump;').replace('#include <begin_vertex>', `#include <begin_vertex>
      #ifdef USE_INSTANCING
        vec2 wIp = vec2(instanceMatrix[3][0], instanceMatrix[3][2]);
      #else
        vec2 wIp = vec2(0.0);
      #endif
      float wH = max(position.y, 0.0);
      float wS = sin(uWind * 1.6 + wIp.x * 0.31 + wIp.y * 0.23) * 0.7 + sin(uWind * 3.7 + wIp.x * 1.3 - wIp.y * 0.9) * 0.3;
      transformed.x += (wS + 0.35) * uWAmp * wH * wH; transformed.z += cos(uWind * 1.3 + wIp.y * 0.37 + wIp.x * 0.11) * uWAmp * 0.5 * wH * wH;
      float bK = uBump.z * (1.0 - smoothstep(0.4, 1.6, length(wIp - uBump.xy)));
      transformed.x += sin(uWind * 19.0) * bK * wH * 0.055 * uBump.w; transformed.z += cos(uWind * 16.0 + 1.3) * bK * wH * 0.055 * uBump.w;` + (fade ? FADE_V : ''));
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
    if (Math.abs(z) < 10 * K && Math.abs(Math.abs(x) - 54 * K) < 14 * K) return true;
    if (Math.abs(x) < 10 * K && Math.abs(z + 54 * K) < 14 * K) return true;
    if (Math.abs(x - 7 * K) < 8 * K && Math.abs(z - 46 * K) < 8 * K) return true; // 月光洞窟的裂縫
    if (onPath(x, z) > .12) return true;
    if (Math.hypot(x - GIANT[0], z - GIANT[1]) < 9 || Math.hypot(x - RUINS[0], z - RUINS[1]) < 9) return true;
    if (nookAvoid(x, z)) return true; // 小場景（池塘、冰屋、岩拱…）裡不長隨機的樹和石頭
    return PUZ_SPOTS.some(([px, pz]) => Math.hypot(x - px, z - pz) < 4.5);
  };
  const tries = LOW ? 11000 : 20000;
  for (let i = 0; i < tries; i++) {
    const x = (rd() - .5) * 350 * K, z = (rd() - .5) * 350 * K, h = H(x, z); if (h < -.3 || h > 26 * K || avoid(x, z)) continue;
    const sl = Math.abs(H(x + 1, z) - H(x - 1, z)) + Math.abs(H(x, z + 1) - H(x, z - 1)); if (sl > 1.5) continue;
    const b = domBiome(x, z), s = .75 + rd() * .8, ry = rd() * 6.28, k = rd(), o = { x, y: h - .12 - sl * .3, z, s, ry };
    { const v = .84 + rc() * .26, w = (rc() - .5) * .1; o.c = new THREE.Color(v * (1 + w), v, v * (1 - w * 1.6)); } // 每株明暗與色相略有不同
    let col = 0, tree = 0;
    if (b === 'forest') { if (k < .34) { push('pine', o); col = .72; tree = 1; } else if (k < .52) { push('broad', o); col = 1.1; tree = 1; } else if (k < .62) { push('birch', o); col = .22; tree = 1; } else if (k < .72) push('bush', o); else if (k < .78) push('berry', o); else if (k < .84) { push('rockM', o); col = .7; } else if (k < .88) push('shroom', o); else if (k < .91) push('mushC', o); else if (k < .94) { push('log', Object.assign(o, { s: .8 + rd() * .4 })); col = .5; } else if (k < .96) { push('stump', o); col = .45; } else push('fern', o); }
    else if (b === 'coast') { if (k < .4) { push('palm', o); col = .22; tree = 1; } else if (k < .6) { push('rockF', o); col = .7; } else if (k < .78) push('bushC', o); else if (h < 1.6 * K && h > -.1) push('drift', Object.assign(o, { s: .7 + rd() * .5 })); else push('bushC', o); }
    else if (b === 'volcano') { if (k < .34) { push('rockV', o); col = .7; } else if (k < .52) { push('dead', o); col = .15; } else if (k < .72) push('obsid', o); else if (k < .88) { push('basalt', Object.assign(o, { s: .6 + rd() * .6 })); col = .7; } else push('crack', Object.assign(o, { y: h + .03, s: .8 + rd() * 1.2 })); }
    else { if (k < .45) { push('pineS', o); col = .72; tree = 1; } else if (k < .62) { push('rockS', o); col = .7; } else if (k < .78) push('ice', o); else push('snowBush', o); }
    if (col && Math.max(Math.abs(x), Math.abs(z)) < 176 * K) addCol({ x, z, r: col * o.s + .05, k: 'prop', tree });
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
  [grass, dune, pebbles, shells, stars, reeds, ...Object.values(flowers)].forEach(nookClear); // 水面、冰面、倒木與冰屋裡面不要冒出草叢
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
  const signTex = (txt, sub, c) => artTex(512, 244, (g, w, h) => { woodBoard(g, w, h); artText(g, txt, w / 2, 112, 92, c, w - 44); artText(g, sub, w / 2, 198, 50, '#fef3c7', w - 44); });
  [[21.5, 2.5, '東 · 海岸', '沿小徑直走到能量門', '#7dd3fc', 0], [2.5, -21.5, '北 · 火山', '沿小徑直走到能量門', '#fdba74', -Math.PI / 2], [-21.5, -2.5, '西 · 雪原', '需要保暖衣才能進入', '#e0f2fe', Math.PI]].forEach(([x, z, t, s, c, a]) => {
    const g = new THREE.Group(); g.position.set(x, H(x, z), z); g.rotation.y = -a; sc.add(g); addCol({ x, z, r: .25 });
    cyl(.07, .09, 2.2, 8, std('#6b4d33', { roughness: .9 }), 0, 1.1, 0, g);
    const sm = new THREE.MeshStandardMaterial({ map: signTex(t, s, c), roughness: .8 }), wd = std('#8b6544', { roughness: .85 });
    const b = box(.07, .62, 1.3, [sm, sm, wd, wd, wd, wd], 0, 1.72, .74, g); b.castShadow = !LOW;
    [1.94, 1.5].forEach(y => box(.11, .06, .26, std('#3f3f46', { metalness: .6, roughness: .4 }), 0, y, .12, g)); // 把看板固定在柱子上的鐵片
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
  buildSteam(); buildLandmarks3(); buildSignposts();
}
function buildSignposts() {
  const sc = W.scene, wood = woodMat('#8b6544'), post = std('#6b4d33', { roughness: .9 }), lampM = new THREE.MeshStandardMaterial({ color: '#fff3c4', emissive: '#ffd27a', emissiveIntensity: .4 }); (W.lampMats = W.lampMats || []).push(lampM);
  const ends = { 0: ['海蝕洞', '#7dd3fc', [45 * K, 0]], 1: ['熔岩隧道', '#fdba74', [0, -45 * K]], 3: ['冰洞', '#e0f2fe', [-45 * K, 0]] };
  Object.keys(ends).forEach(li => {
    const [name, col, goal] = ends[li], pts = crPts(PATH_LINES[li], 10); let acc = 0, next = 26;
    for (let i = 1; i < pts.length; i++) {
      const [ax, az] = pts[i - 1], [bx, bz] = pts[i], d = Math.hypot(bx - ax, bz - az); acc += d; if (acc < next) continue; next += 30;
      const dist = Math.round(Math.hypot(goal[0] - bx, goal[1] - bz)); if (dist < 12) break;
      const nx = -(bz - az) / d, nz = (bx - ax) / d, x = bx + nx * 2.4, z = bz + nz * 2.4, y = H(x, z), g = new THREE.Group(); g.position.set(x, y, z); g.rotation.y = Math.atan2(bx - ax, bz - az); sc.add(g);
      const tx = artTex(512, 192, (c, w, h) => { woodBoard(c, w, h); artText(c, '往' + name + ' →', w / 2, 92, 72, col, w - 40); artText(c, '還有 ' + dist + ' 公尺', w / 2, 160, 46, '#fef3c7', w - 40); });
      const sm = new THREE.MeshStandardMaterial({ map: tx, roughness: .85 });
      cyl(.07, .09, 2.3, 7, post, -.75, 1.15, 0, g); box(1.3, .5, .06, [wood, wood, wood, wood, sm, sm], 0, 1.85, 0, g);
      box(.04, .3, .04, post, .5, 2.2, 0, g); mesh(new THREE.BoxGeometry(.16, .2, .16), lampM, .5, 2.42, 0, g);
      addCol({ x, z, r: .2 });
    }
  });
}
/* 第 3 堂 03：四個地標。每個至少 25 公尺、剪影就認得出來、各有一個會動的部分。
   遠景版是一張不受霧影響的單色剪影（幾十個面），走近 120 公尺內才換成完整模型（3.2） */
const LMS = [];
const LM_POS = { tree: GIANT, light: kk([126, 10]), crater: [0, -130 * K], ice: kk([-112, -8]) };
function silMat() { return new THREE.MeshBasicMaterial({ color: '#334155', fog: false, transparent: true, opacity: .92 }); }
// 地標旁的介紹告示牌：站著就看得到的高度；按 E 可以讀完整介紹
const INFO = {
  tree: { t: '月光巨木', c: '#a5f3fc', l: ['月光谷最古老的樹，樹齡超過一千年', '傳說月光從枝葉之間灑落', '夜裡樹洞會亮起溫暖的光'], more: '老人們說，奶奶年輕時常在這棵樹下捏史萊姆。夜晚樹下會出現發光的螢光青草史萊姆，天亮就躲起來了。' },
  light: { t: '東方海角燈塔', c: '#fca5a5', l: ['守護海岸的紅白燈塔', '夜裡光束每六秒掃過一圈', '迷路時跟著光走就對了'], more: '燈塔已經亮了一百多年。漲潮時，燈光會照亮潮汐石陣；夜裡的海邊偶爾能找到夜光珊瑚史萊姆。' },
  ice: { t: '冰晶塔', c: '#bae6fd', l: ['西方丘陵上三根巨大的冰晶', '晴天時會反射耀眼的陽光', '雪原非常寒冷，記得穿保暖衣'], more: '冰晶塔從來不會融化。據說在極光出現的夜晚，冰晶會發出淡淡的歌聲，極光史萊姆就是被歌聲吸引來的。' },
};
function infoBoard(k, lx, lz, dist) {
  const I = INFO[k], a0 = Math.atan2(-lx, -lz); let x = lx, z = lz;
  // 從地標往中央平地的方向找一塊平地
  for (const da of [0, .35, -.35, .7, -.7]) { const tx = lx + Math.sin(a0 + da) * dist, tz = lz + Math.cos(a0 + da) * dist, sl = Math.abs(H(tx + 1, tz) - H(tx - 1, tz)) + Math.abs(H(tx, tz + 1) - H(tx, tz - 1)); x = tx; z = tz; if (sl < 1.2) break; }
  const g = new THREE.Group(); g.position.set(x, H(x, z) - .05, z); g.rotation.y = a0; W.scene.add(g);
  const post = std('#5b4030', { roughness: .9 }), wood = std('#7d5c3a', { roughness: .85 });
  const tx = artTex(640, 400, (c, w, h) => { woodBoard(c, w, h); artText(c, I.t, w / 2, 96, 76, I.c, w - 60); c.fillStyle = '#4a3220'; c.fillRect(70, 122, w - 140, 3); I.l.forEach((s, i) => artText(c, s, w / 2, 190 + i * 66, 40, '#fef3c7', w - 60)); });
  const sm = new THREE.MeshStandardMaterial({ map: tx, roughness: .85 });
  [-1.08, 1.08].forEach(s => cyl(.08, .1, 2.4, 7, post, s, 1.2, 0, g));
  box(2, 1.25, .08, [wood, wood, wood, wood, sm, wood], 0, 1.55, 0, g).castShadow = !LOW;
  const roof = box(2.5, .08, .6, std('#4a3424', { roughness: .9 }), 0, 2.38, 0, g); roof.rotation.x = .12;
  addCol({ x: x + Math.cos(a0) * 1.08, z: z - Math.sin(a0) * 1.08, r: .2 }); addCol({ x: x - Math.cos(a0) * 1.08, z: z + Math.sin(a0) * 1.08, r: .2 });
  addInter(hitBox(2.2, 1.6, .7, 0, 1.5, .2, g), 'station', 'info:' + k, I.t + '的告示牌');
}
// 告示牌的補充故事：木牌上方攤開一張牛皮紙便條（talk.js），E 翻頁、走開就收起
function infoAct(it, k) { const I = INFO[k]; if (I) talk(signWho(it, I), [I.more]); }
function buildLandmarks3() {
  const sc = W.scene;
  const addLM = (id, name, zone, x, z, near, far, col) => { far.position.set(x, 0, z); sc.add(far); far.visible = false; LMS.push({ id, name, zone, x, z, near, far, col: new THREE.Color(col) }); };
  // 森林巨樹：把月光巨木放大到約 25 公尺，夜裡樹洞亮起暖光
  {
    const [x, z] = LM_POS.tree, y = H(x, z) - .2, near = sc.children.filter(o => o.isMesh && Math.hypot(o.position.x - x, o.position.z - z) < .1 && o.position.y > y - 1 && o.position.y < y + 1.5);
    near.forEach(o => o.scale.multiplyScalar(1.9));
    const lb = sc.children.find(o => o.isSprite && Math.hypot(o.position.x - x, o.position.z - z) < .1); if (lb) dropObj(lb);
    const face = Math.atan2(-x, -z), hol = new THREE.Group(); hol.position.set(x, y, z); hol.rotation.y = face; sc.add(hol);
    const hm = new THREE.MeshBasicMaterial({ color: '#ffb347', transparent: true, opacity: .15, toneMapped: false }); const h = mesh(new THREE.CircleGeometry(.85, 18), hm, 0, 3.4, 2.15, hol); h.scale.y = 1.35;
    W.anim.push(() => { hm.opacity = .12 + DN.night * .85; });
    near.push(hol); addCol({ x, z, r: 2.8 });
    const f = new THREE.Group(), m = silMat(); mesh(new THREE.CylinderGeometry(1.6, 2.6, 15, 6), m, 0, 7.5, 0, f); mesh(new THREE.IcosahedronGeometry(9, 0), m, 0, 20, 0, f).scale.y = .7;
    addLM('tree', '森林巨樹', 'forest', x, z, near, f, '#3f6b47'); infoBoard('tree', x, z, 7.5);
  }
  // 海岸燈塔：岩石小島上的紅白條紋塔身、拱門與小窗、托架撐起的瞭望台與欄杆、玻璃燈室（窗框、菲涅耳透鏡）、銅綠圓頂與風向標；
  // 旁邊有守塔人的小屋、伸進海裡的木棧橋與一艘小船。夜裡窗戶亮起暖光，光束掃過時燈室會閃一下
  {
    const [x, z] = LM_POS.light, y = H(x, z) - .3, g = new THREE.Group(); g.position.set(x, y, z); sc.add(g);
    const flatV = new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: .9 }), smoothV = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: .55 });
    const metalV = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: .35, metalness: .6 });
    const winM = new THREE.MeshStandardMaterial({ color: '#1f2a3a', emissive: '#ffc46b', emissiveIntensity: .05, roughness: .3 });
    // 岩石小島＋八角石台＋石階
    const rock = [], rc = ['#6b6f68', '#7c7f76', '#5f625c', '#868a80'];
    for (let i = 0; i < 13; i++) { const a = i / 13 * PI2 + (i % 3) * .2, r = 4.6 + (i % 4) * .7, s0 = 1.5 + (i * 37 % 10) / 10; rock.push([jit(new THREE.DodecahedronGeometry(1, 0), .25, 300 + i), rc[i % 4], M4(Math.cos(a) * r, .2 + (i % 2) * .4, Math.sin(a) * r, i, i * 2, 0, s0, s0 * .75, s0)]); }
    rock.push([jit(new THREE.CylinderGeometry(4.8, 6.2, 3, 11, 2), .35, 3), '#6b6f68', M4(0, 1, 0)]);
    for (let i = 0; i < 9; i++) { const a = i * 2.3; rock.push([new THREE.SphereGeometry(.7, 6, 4, 0, PI2, 0, Math.PI / 2), i % 2 ? '#5d7f4a' : '#6f8f56', M4(Math.cos(a) * (4.4 + i % 3), 2.35, Math.sin(a) * (4.4 + i % 3), 0, 0, 0, 1.3, .35, 1)]); }
    rock.push([new THREE.CylinderGeometry(3.25, 3.55, 1.2, 8), '#a29c90', M4(0, 3.1, 0, 0, Math.PI / 8)], [new THREE.CylinderGeometry(3.45, 3.45, .16, 8), '#8d877c', M4(0, 3.74, 0, 0, Math.PI / 8)]);
    for (let i = 0; i < 4; i++) rock.push([new THREE.BoxGeometry(1.5, .32, .7), '#9a9488', M4(-3.6 - i * .55, 3.25 - i * .4, 0)]);
    const rm = mesh(mergeParts(rock), flatV, 0, 0, 0, g); rm.castShadow = rm.receiveShadow = !LOW;
    // 塔身：六段紅白條紋（平滑著色、32 邊），段與段之間有一圈深色收邊
    const B0 = 3.8, BH = 3.4, NB = 6, rAt = h => 2.75 - (h - B0) / (BH * NB) * .95, tw = [];
    for (let i = 0; i < NB; i++) { const h0 = B0 + i * BH; tw.push([new THREE.CylinderGeometry(rAt(h0 + BH), rAt(h0), BH, 32, 1, true), i % 2 ? '#f4efe6' : '#d14b3c', M4(0, h0 + BH / 2, 0)]); if (i) tw.push([new THREE.TorusGeometry(rAt(h0) + .02, .07, 6, 40), '#7a2a22', M4(0, h0, 0, Math.PI / 2)]); }
    const TOP = B0 + BH * NB, rT = rAt(TOP);
    tw.push([new THREE.CylinderGeometry(rT, rT, .3, 32), '#d14b3c', M4(0, TOP + .15, 0)]);
    const tm = mesh(mergeParts(tw, true), smoothV, 0, 0, 0, g); tm.castShadow = !LOW;
    // 拱門、門燈、螺旋排列的小窗（窗台＋窗框）
    const trim = [], face = Math.PI; // 門朝西（陸地那一側）
    const onWall = (h, a, out = 0) => { const r = rAt(h) + out; return [Math.cos(a) * r, h, Math.sin(a) * r]; };
    { const [dx, , dz] = onWall(B0, face, -.05); trim.push([new THREE.BoxGeometry(.25, 2.1, 1.3), '#5b3a29', M4(dx, B0 + 1.05, dz)], [new THREE.CylinderGeometry(.65, .65, .25, 16, 1, false, 0, Math.PI), '#5b3a29', M4(dx, B0 + 2.1, dz, 0, 0, Math.PI / 2)], [new THREE.BoxGeometry(.32, .14, 1.6), '#e7e2d8', M4(dx - .05, B0 + 2.85, dz)]); }
    const wins = [];
    for (let i = 0; i < 5; i++) { const h = B0 + 4.4 + i * 3.6, a = face + i * 2.1, [wx, , wz] = onWall(h, a), ry = -a; wins.push([new THREE.BoxGeometry(.2, .9, .5), '#ffffff', M4(wx, h, wz, 0, ry)]); trim.push([new THREE.BoxGeometry(.26, .12, .78), '#e7e2d8', M4(wx, h - .52, wz, 0, ry)], [new THREE.BoxGeometry(.24, .12, .66), '#2f3a48', M4(wx, h + .5, wz, 0, ry)]); }
    { const [lx, , lz] = onWall(B0 + 2.6, face, .15); trim.push([new THREE.BoxGeometry(.2, .2, .2), '#1f2937', M4(lx, B0 + 2.6, lz)]); wins.push([new THREE.BoxGeometry(.22, .26, .22), '#ffffff', M4(lx + .02, B0 + 2.35, lz)]); }
    mesh(mergeParts(trim), flatV, 0, 0, 0, g); mesh(mergeParts(wins), winM, 0, 0, 0, g);
    // 瞭望台：托架、平台、欄杆
    const gal = [], GY = TOP + .3;
    for (let i = 0; i < 16; i++) { const a = i / 16 * PI2; gal.push([new THREE.BoxGeometry(.75, .55, .18), '#2f3a48', M4(Math.cos(a) * (rT + .25), GY - .4, Math.sin(a) * (rT + .25), 0, -a, 0)]); }
    gal.push([new THREE.CylinderGeometry(rT + 1.05, rT + .85, .3, 40), '#2f3a48', M4(0, GY - .05, 0)]);
    const RR = rT + .95; for (let i = 0; i < 36; i++) { const a = i / 36 * PI2; gal.push([new THREE.CylinderGeometry(.035, .035, .95, 5), '#1f2937', M4(Math.cos(a) * RR, GY + .55, Math.sin(a) * RR)]); }
    gal.push([new THREE.TorusGeometry(RR, .055, 6, 64), '#1f2937', M4(0, GY + 1.02, 0, Math.PI / 2)], [new THREE.TorusGeometry(RR, .03, 5, 64), '#1f2937', M4(0, GY + .55, 0, Math.PI / 2)]);
    // 燈室：底座、窗框、圓頂、通風球、避雷針、風向標
    const LY = GY + .1, LH = 2.4, LR = 1.35;
    gal.push([new THREE.CylinderGeometry(LR + .1, LR + .2, .6, 24), '#d14b3c', M4(0, LY + .3, 0)]);
    for (let i = 0; i < 10; i++) { const a = i / 10 * PI2; gal.push([new THREE.BoxGeometry(.07, LH, .07), '#1f2937', M4(Math.cos(a) * LR, LY + .6 + LH / 2, Math.sin(a) * LR)]); }
    gal.push([new THREE.TorusGeometry(LR, .05, 5, 40), '#1f2937', M4(0, LY + .6 + LH * .5, 0, Math.PI / 2)], [new THREE.CylinderGeometry(LR + .25, LR + .1, .18, 24), '#1f2937', M4(0, LY + .6 + LH + .09, 0)]);
    const RY = LY + .6 + LH + .18;
    gal.push([new THREE.SphereGeometry(LR + .2, 24, 10, 0, PI2, 0, Math.PI / 2), '#3f7f73', M4(0, RY, 0, 0, 0, 0, 1, .78, 1)], [new THREE.SphereGeometry(.28, 12, 8), '#3f7f73', M4(0, RY + (LR + .2) * .78 + .2, 0)]);
    gal.push([new THREE.CylinderGeometry(.03, .04, 1.6, 5), '#1f2937', M4(0, RY + (LR + .2) * .78 + 1, 0)], [new THREE.ConeGeometry(.08, .3, 6), '#1f2937', M4(0, RY + (LR + .2) * .78 + 1.9, 0)]);
    const gm = mesh(mergeParts(gal, true), metalV, 0, 0, 0, g); gm.castShadow = !LOW;
    const vane = new THREE.Group(); vane.position.set(0, RY + (LR + .2) * .78 + 1.55, 0); g.add(vane);
    mesh(mergeParts([[new THREE.BoxGeometry(1.1, .05, .05), '#1f2937'], [new THREE.ConeGeometry(.1, .28, 4), '#1f2937', M4(.62, 0, 0, 0, 0, -Math.PI / 2)], [new THREE.BoxGeometry(.04, .32, .38), '#1f2937', M4(-.55, 0, 0)]], true), metalV, 0, 0, 0, vane);
    mesh(new THREE.CylinderGeometry(LR - .03, LR - .03, LH, 24, 1, true), new THREE.MeshPhysicalMaterial({ color: '#e0f2fe', transparent: true, opacity: .28, roughness: .04, clearcoat: 1, side: THREE.DoubleSide, depthWrite: false }), 0, LY + .6 + LH / 2, 0, g);
    const lampY = LY + .6 + LH / 2, lensM = new THREE.MeshBasicMaterial({ color: '#fff3c4', toneMapped: false });
    const lens = mesh(new THREE.CylinderGeometry(.55, .55, 1.3, 8), new THREE.MeshStandardMaterial({ color: '#fde68a', emissive: '#ffd27a', emissiveIntensity: .8, flatShading: true, roughness: .1, metalness: .3 }), 0, lampY, 0, g);
    mesh(new THREE.SphereGeometry(.32, 12, 8), lensM, 0, lampY, 0, g);
    addCol({ x, z, r: 5.6 });
    // 守塔人小屋（陸地那一側）：白牆、紅瓦、煙囪、窗戶與門前的救生圈
    const near = [g];
    {
      const hx = x - 10, hz = z + 5, hy = H(hx, hz) - .1, hg = new THREE.Group(); hg.position.set(hx, hy, hz); hg.rotation.y = -.35; sc.add(hg); near.push(hg);
      const hp = [[new THREE.BoxGeometry(4.6, .5, 3.6), '#8d877c', M4(0, .1, 0)], [new THREE.BoxGeometry(4.2, 2.6, 3.2), '#f1ece2', M4(0, 1.6, 0)], [new THREE.CylinderGeometry(2.25, 2.25, 4.6, 3, 1, false, Math.PI / 2), '#c2453a', M4(0, 3.55, 0, 0, 0, Math.PI / 2, .55, 1, 1)], [new THREE.BoxGeometry(.6, 1.6, .6), '#a29c90', M4(1.2, 4.2, -.6)], [new THREE.BoxGeometry(.75, .15, .75), '#7c7f76', M4(1.2, 5.05, -.6)], [new THREE.BoxGeometry(.9, 1.7, .1), '#5b3a29', M4(-.8, 1.15, 1.62)], [new THREE.BoxGeometry(1.3, .1, .8), '#5b3a29', M4(-.8, 2.15, 1.85, -.3, 0, 0)]];
      hp.push([new THREE.TorusGeometry(.32, .09, 8, 18), '#ef4444', M4(.9, 1.6, 1.64)]);
      const hm = mesh(mergeParts(hp), flatV, 0, 0, 0, hg); hm.castShadow = hm.receiveShadow = !LOW;
      mesh(mergeParts([[new THREE.BoxGeometry(.9, .8, .08), '#fff', M4(1.0, 2.1, 1.62)], [new THREE.BoxGeometry(.08, .8, .9), '#fff', M4(2.12, 1.8, 0)], [new THREE.BoxGeometry(.08, .8, .9), '#fff', M4(-2.12, 1.8, 0)]]), winM, 0, 0, 0, hg);
      addCol({ box: [hx - 2.6, hz - 2.6, hx + 2.6, hz + 2.6] });
      const lb = textSprite('守塔人小屋', '#fde68a', '燈塔每 6 秒轉一圈'); lb.position.set(0, 6.4, 0); hg.add(lb);
    }
    // 木棧橋：從燈塔岩岸伸進海裡，木樁一路插到海床；旁邊繫著一艘會隨浪起伏的小船
    {
      const wy = -.9 * K, dy = wy + 1.1, z0 = z - 7.5, x0 = x + 4, len = 18, pp = [];
      for (let i = 0; i < len / .5; i++) pp.push([new THREE.BoxGeometry(.42, .1, 2), i % 3 ? '#9a7652' : '#8b6544', M4(x0 + i * .5, dy, z0, 0, (i * 13 % 7 - 3) * .006, 0)]);
      for (let i = 0; i <= len; i += 3) [-1.05, 1.05].forEach(o => { const px = x0 + i, pz = z0 + o, gy = H(px, pz); pp.push([new THREE.CylinderGeometry(.13, .15, dy - gy + 1.4, 7), '#5b4030', M4(px, (dy + 1 + gy - .4) / 2, pz)]); });
      pp.push([new THREE.BoxGeometry(len, .07, .07), '#5b4030', M4(x0 + len / 2, dy + .85, z0 - 1.05)], [new THREE.BoxGeometry(len, .07, .07), '#5b4030', M4(x0 + len / 2, dy + .85, z0 + 1.05)]);
      const pm = mesh(mergeParts(pp), flatV, 0, 0, 0, sc); pm.castShadow = pm.receiveShadow = !LOW; near.push(pm);
      const boat = new THREE.Group(); boat.position.set(x0 + 12, wy + .15, z0 - 2.6); boat.rotation.y = .12; sc.add(boat); near.push(boat);
      const hull = new THREE.SphereGeometry(1, 16, 8, 0, PI2, Math.PI / 2, Math.PI / 2);
      mesh(mergeParts([[hull, '#f4efe6', M4(0, .45, 0, 0, 0, 0, 2.1, .6, .8)], [new THREE.TorusGeometry(1, .06, 5, 32), '#2f6f9a', M4(0, .45, 0, Math.PI / 2, 0, 0, 2.1, .8, 1)], [new THREE.BoxGeometry(.25, .06, 1.4), '#8b6544', M4(-.4, .4, 0)], [new THREE.BoxGeometry(.25, .06, 1.2), '#8b6544', M4(.7, .4, 0)], [new THREE.BoxGeometry(2.4, .05, .08), '#c8a26b', M4(.2, .5, .5, 0, .2, .15)]], true), smoothV, 0, 0, 0, boat);
      W.anim.push((dt, t) => { if (!boat.visible) return; boat.position.y = wy + .15 + Math.sin(t * 1.3) * .08; boat.rotation.z = Math.sin(t * 1.1) * .05; boat.rotation.x = Math.sin(t * .9 + 1) * .04; });
    }
    // 光束：加法混色的長三角錐，尾端漸暗；每個方向的長度預先算到「碰到地形」為止，不會穿過山
    const LAMP_H = y + lampY, beam = new THREE.Group(); beam.position.set(x, LAMP_H, z); sc.add(beam);
    const BL = 150, bg = new THREE.ConeGeometry(9, BL, 20, 10, true); bg.translate(0, -BL / 2, 0);
    { const pa = bg.attributes.position, cl = new Float32Array(pa.count * 3); for (let i = 0; i < pa.count; i++) { const u = -pa.getY(i) / BL, k = smooth(0, .04, u) * Math.pow(1 - u, 1.6); cl[i * 3] = cl[i * 3 + 1] = cl[i * 3 + 2] = k; } bg.setAttribute('color', new THREE.BufferAttribute(cl, 3)); }
    bg.rotateZ(Math.PI / 2);
    const bm = new THREE.MeshBasicMaterial({ color: '#fff6d6', vertexColors: true, transparent: true, opacity: .1, fog: false, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide });
    const b1 = mesh(bg, bm, 0, 0, 0, beam), b2 = mesh(bg, bm, 0, 0, 0, beam); b2.rotation.y = Math.PI;
    const NA = 240, reach = new Float32Array(NA);
    for (let i = 0; i < NA; i++) {
      const a = i / NA * PI2, cx = Math.cos(a), cz = -Math.sin(a); let d = 5;
      for (; d < BL; d += 1.2) if (H(x + cx * d, z + cz * d) > LAMP_H - .045 * d) break;
      reach[i] = Math.max(6, d);
    }
    const reachAt = a => { const f = ((a % PI2) + PI2) % PI2 / PI2 * NA, i = Math.floor(f) % NA, j = (i + 1) % NA, u = f - Math.floor(f); return reach[i] + (reach[j] - reach[i]) * u; };
    const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: dotTex(), color: '#fff1c2', transparent: true, depthWrite: false, fog: false, blending: THREE.AdditiveBlending })); halo.position.set(x, LAMP_H, z); halo.scale.setScalar(7); sc.add(halo);
    W.anim.push((dt, t) => {
      const city = inCity(); beam.visible = halo.visible = !city; if (city) return;
      const a = (t % 6) / 6 * PI2; beam.rotation.y = a;
      b1.scale.setScalar(reachAt(a) / BL); b2.scale.setScalar(reachAt(a + Math.PI) / BL);
      const nite = DN.night + (DN.dusk + DN.dawn) * .35; bm.opacity = .03 + nite * .2;
      winM.emissiveIntensity = .05 + DN.night * 1.6 + (DN.dusk + DN.dawn) * .5;
      vane.rotation.y = Math.sin(t * .23) * .6 + Math.sin(t * 1.7) * .08;
      // 光束正對玩家時燈室閃一下（看得到燈的時候才算）
      const cp = W.cam.position, vx = cp.x - x, vz = cp.z - z, vl = Math.hypot(vx, vz) || 1, face1 = Math.max(0, (Math.cos(a) * vx - Math.sin(a) * vz) / vl), face2 = Math.max(0, (-Math.cos(a) * vx + Math.sin(a) * vz) / vl);
      const flash = Math.pow(Math.max(face1, face2), 24), seen = vl < reachAt(Math.atan2(-vz, vx)) + 2 ? 1 : .15;
      halo.material.opacity = (.12 + nite * .55 + flash * (.35 + nite * .6) * seen); halo.scale.setScalar(6 + flash * 6 * seen);
    });
    const f = new THREE.Group(), m = silMat(); mesh(new THREE.CylinderGeometry(1.6, 2.7, 24, 8), m, 0, B0 + 12, 0, f); mesh(new THREE.CylinderGeometry(2.6, 2.6, .4, 8), m, 0, TOP + .3, 0, f); mesh(new THREE.CylinderGeometry(1.4, 1.4, 2.6, 8), m, 0, TOP + 1.8, 0, f); mesh(new THREE.SphereGeometry(1.5, 8, 4, 0, PI2, 0, Math.PI / 2), m, 0, TOP + 3.1, 0, f);
    f.children.forEach(c => c.position.y += y);
    addLM('light', '燈塔', 'coast', x, z, near, f, '#c2453a'); infoBoard('light', x, z, 9);
  }
  // 火山口：持續冒出慢慢上升的煙柱，夜裡口緣透出橘光
  {
    const [x, z] = LM_POS.crater, y = H(x, z), rimY = H(x + 5.6 * K, z) - .6;
    const rimM = new THREE.MeshBasicMaterial({ color: '#ff8a3d', transparent: true, opacity: .35, toneMapped: false }); const rim = mesh(new THREE.TorusGeometry(5.6 * K, .45, 6, 48), rimM, x, rimY, z, sc); rim.rotation.x = Math.PI / 2;
    const puffG = new THREE.IcosahedronGeometry(1, 0), puffM = new THREE.MeshStandardMaterial({ color: '#5b5452', emissive: '#ff6a1f', emissiveIntensity: .12, flatShading: true, roughness: 1, transparent: true, opacity: .55 }), puffs = [];
    const NP = LOW ? 8 : 14; for (let i = 0; i < NP; i++) { const p = mesh(puffG, puffM, x, y, z, sc); p.userData.o = i / NP; p.userData.a = rnd(0, 6.28); puffs.push(p); }
    W.anim.push((dt, t) => {
      rimM.opacity = .25 + DN.night * .6 + Math.sin(t * 1.3) * .05;
      if (inCity()) return; for (const p of puffs) { const k = (t * .045 + p.userData.o) % 1, s = 3 + k * 11; p.position.set(x + Math.sin(p.userData.a + t * .2) * k * 6, y + 6 + k * 70, z + Math.cos(p.userData.a) * k * 4); p.scale.setScalar(s); p.rotation.y = t * .1 + p.userData.a; }
      puffM.opacity = .5;
    });
    const f = new THREE.Group(), m = silMat(); const plume = mesh(new THREE.CylinderGeometry(14, 4, 70, 8, 1, true), m, 0, y + 40, 0, f); plume.material.side = THREE.DoubleSide;
    // 火星：從火山口慢慢往上飄、閃爍後熄滅；夜裡更亮。煙柱底部被熔岩映成橘色
    const NE = LOW ? 50 : 120, eg = new THREE.BufferGeometry(), ep = new Float32Array(NE * 3), ed = [...Array(NE)].map(() => ({ a: rnd(0, PI2), r: rnd(0, 5 * K), k: Math.random(), v: rnd(.05, .12) }));
    eg.setAttribute('position', new THREE.BufferAttribute(ep, 3));
    const emM = new THREE.PointsMaterial({ size: .9, map: dotTex(), color: '#ffb056', transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false }), embers = new THREE.Points(eg, emM); embers.frustumCulled = false; sc.add(embers);
    const glowP = new THREE.Sprite(new THREE.SpriteMaterial({ map: dotTex(), color: '#ff7a2e', transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false })); glowP.position.set(x, rimY + 6, z); glowP.scale.set(26, 16, 1); sc.add(glowP);
    W.anim.push((dt, t) => {
      if (!embers.visible) return;
      ed.forEach((o, i) => { o.k += o.v * dt; if (o.k > 1) { o.k = 0; o.a = rnd(0, PI2); o.r = rnd(0, 5 * K); } const k = o.k; ep[i * 3] = x + Math.cos(o.a + k * 2) * (o.r + k * 6); ep[i * 3 + 1] = rimY + 1 + k * 34; ep[i * 3 + 2] = z + Math.sin(o.a + k * 2) * (o.r + k * 6); });
      eg.attributes.position.needsUpdate = true; emM.opacity = .55 + DN.night * .45 + Math.sin(t * 7) * .1;
      glowP.material.opacity = .18 + DN.night * .5 + Math.sin(t * 1.3) * .05;
      puffM.emissiveIntensity = .12 + DN.night * .35;
    });
    addLM('crater', '火山口', 'volcano', x, z, [...puffs, rim, embers, glowP], f, '#5b4a44');
  }
  // 雪原冰晶塔：雪丘上一簇六角冰晶（主晶柱＋十幾根大小不一、向外傾斜的晶柱），內部有淡藍的光核，
  // 周圍飄著閃爍的冰晶粉；太陽照到時會閃一下亮光，夜裡整座微微發光
  {
    const [x, z] = LM_POS.ice, y = H(x, z) - .5, g = new THREE.Group(); g.position.set(x, y, z); sc.add(g);
    const iceM = new THREE.MeshPhysicalMaterial({ color: '#ffffff', emissive: '#38bdf8', emissiveIntensity: .16, roughness: .06, metalness: .08, clearcoat: 1, clearcoatRoughness: .05, flatShading: true, transparent: true, opacity: .94, vertexColors: true });
    const crystal = (r, h) => { const c = new THREE.CylinderGeometry(r, r * 1.08, h, 6).translate(0, h / 2, 0), t = new THREE.ConeGeometry(r, r * 2.2, 6).translate(0, h + r * 1.1, 0); return [c, t]; };
    const cs = [], add = (px, pz, r, h, tx, tz, col) => crystal(r, h).forEach(geo => cs.push([geo, col, M4(px, -.4, pz, tx, (px * 7 + pz * 3) % 6, tz)]));
    add(0, 0, 2.3, 17, 0, 0, '#8fd3f4');
    [[3, 1.4, 1.5, 11, -.28, .22], [-2.8, -1.6, 1.6, 12.5, .3, -.25], [1.2, -3, 1.2, 9, .35, .2], [-1.6, 2.9, 1.1, 8.5, -.3, -.3], [4.2, -1.8, .9, 6, .5, .4], [-4.3, .8, .9, 6.5, -.15, -.5], [2.2, 3.8, .7, 4.5, -.55, .3], [-3.4, -3.9, .75, 5, .45, -.45], [5.2, 1.6, .55, 3.2, -.2, .7], [-.6, -4.8, .6, 3.6, .7, .05], [.4, 5, .5, 3, -.75, -.1]].forEach(([px, pz, r, h, tx, tz], i) => add(px, pz, r, h, tx, tz, ['#a9def6', '#7cc6ee', '#c4ebfb'][i % 3]));
    const cm = mesh(mergeParts(cs), iceM, 0, 0, 0, g); cm.castShadow = !LOW;
    const snowP = [[new THREE.SphereGeometry(1, 16, 8, 0, PI2, 0, Math.PI / 2), '#f6f9fc', M4(0, -.6, 0, 0, 0, 0, 7.5, 1.6, 7)]];
    for (let i = 0; i < 9; i++) { const a = i * 2.2, r = 6 + (i % 3); snowP.push([jit(new THREE.IcosahedronGeometry(1, 0), .3, 500 + i), i % 2 ? '#eef4fa' : '#dfe9f3', M4(Math.cos(a) * r, -.2, Math.sin(a) * r, 0, i, 0, 1.2 + (i % 3) * .4, .6, 1.1)]); }
    const sm = mesh(mergeParts(snowP, true), new THREE.MeshStandardMaterial({ vertexColors: true, roughness: .9 }), 0, 0, 0, g); sm.receiveShadow = true;
    const core = mesh(new THREE.OctahedronGeometry(1.2, 0), new THREE.MeshBasicMaterial({ color: '#a5f3fc', transparent: true, opacity: .5, toneMapped: false, depthWrite: false, blending: THREE.AdditiveBlending }), 0, 8, 0, g); core.scale.y = 2.4;
    // 冰晶粉：繞著塔慢慢盤旋上升、閃爍
    const NS = LOW ? 40 : 90, sg = new THREE.BufferGeometry(), sp = new Float32Array(NS * 3), sd = [...Array(NS)].map((_, i) => ({ a: rnd(0, PI2), r: rnd(3, 9), h: rnd(0, 20), v: rnd(.3, .8) }));
    sg.setAttribute('position', new THREE.BufferAttribute(sp, 3));
    const sparkM = new THREE.PointsMaterial({ size: .28, map: dotTex(), color: '#e0f7ff', transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }), spark = new THREE.Points(sg, sparkM); spark.frustumCulled = false; g.add(spark);
    addCol({ x, z, r: 5.5 });
    W.anim.push((dt, t) => {
      if (!g.visible) return;
      const gl = Math.max(0, Math.sin(t * .9)) ** 24 * (1 - DN.night); iceM.emissiveIntensity = .16 + gl * 1.4 + DN.night * .5;
      core.material.opacity = .25 + DN.night * .45 + Math.sin(t * 1.7) * .08; core.rotation.y = t * .3;
      sd.forEach((o, i) => { o.h += o.v * dt; if (o.h > 20) o.h = 0; const a = o.a + t * .15 * o.v; sp[i * 3] = Math.cos(a) * o.r; sp[i * 3 + 1] = o.h; sp[i * 3 + 2] = Math.sin(a) * o.r; }); sg.attributes.position.needsUpdate = true;
      sparkM.opacity = .45 + DN.night * .45 + Math.sin(t * 5) * .1;
    });
    const f = new THREE.Group(), m = silMat(); [[0, 0, 2.3, 17, 0, 0], [3, 1.4, 1.5, 11, -.28, .22], [-2.8, -1.6, 1.6, 12.5, .3, -.25]].forEach(([px, pz, r, h, tx, tz]) => { const c = mesh(new THREE.CylinderGeometry(r, r, h, 6).translate(0, h / 2, 0), m, px, y, pz, f); c.rotation.set(tx, 0, tz); const tip = mesh(new THREE.ConeGeometry(r, r * 2.2, 6).translate(0, h + r * 1.1, 0), m, px, y, pz, f); tip.rotation.set(tx, 0, tz); });
    addLM('ice', '冰晶塔', 'snow', x, z, [g], f, '#9cc9e4'); infoBoard('ice', x, z, 8.5);
  }
  W.anim.push(() => landmarkStep());
  buildNooks(); // 各區的小場景、彩蛋、小徑沿途的東西與地面細節
}
// 遠近切換：120 公尺外只畫剪影（顏色跟著霧與天色走，夜裡更暗）
function landmarkStep() {
  const c = W.cam.position, city = inCity(INTRO.on || TITLE.on ? c.x : undefined), fogC = W.scene.fog.color; // 標題與開場：看鏡頭在哪（存檔在大城市時，穿越山谷的那段地標照樣在）
  if (W.city) W.city.visible = city; if (W.mktOpen) { const o = mktOpenNow(); W.mktOpen.visible = o; W.mktShut.visible = !o; }
  for (const L of LMS) {
    const far = !city && Math.hypot(L.x - c.x, L.z - c.z) > 120; L.near.forEach(o => { o.visible = !city && !far; }); L.far.visible = far;
    if (far) { const m = L.far.children[0].material; m.color.copy(fogC).lerp(L.col, .42 - DN.night * .12); }
  }
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
  const n = LOW ? 220 : 420, geo = new THREE.BufferGeometry(), pos = new Float32Array(n * 3), ph = new Float32Array(n);
  for (let i = 0; i < n; i++) { pos[i * 3] = rnd(-25, 25); pos[i * 3 + 1] = rnd(0, 14); pos[i * 3 + 2] = rnd(-25, 25); ph[i] = rnd(0, 6.28); }
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3)); geo.setAttribute('ph', new THREE.BufferAttribute(ph, 1));
  // 每顆粒子自己的相位：螢火蟲一閃一閃（不是點光源，只是發亮的點）
  const U = { map: { value: dotTex() }, col: { value: new THREE.Color('#fef08a') }, size: { value: .14 }, time: { value: 0 }, blink: { value: 0 }, op: { value: 1 }, scale: { value: 300 } };
  const mat = new THREE.ShaderMaterial({ uniforms: U, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    vertexShader: 'attribute float ph; uniform float size; uniform float time; uniform float blink; uniform float scale; varying float vA; void main(){ vec4 mv = modelViewMatrix * vec4(position, 1.0); float b = pow(max(0.0, sin(time * 1.7 + ph * 3.0)), 3.0); vA = mix(1.0, 0.08 + b, blink); gl_PointSize = size * scale / -mv.z * mix(1.0, 0.7 + b * 0.6, blink); gl_Position = projectionMatrix * mv; }',
    fragmentShader: 'uniform sampler2D map; uniform vec3 col; uniform float op; varying float vA; void main(){ vec4 t = texture2D(map, gl_PointCoord); gl_FragColor = vec4(col, t.a * op * vA); }' });
  const pts = new THREE.Points(geo, mat); pts.frustumCulled = false; W.scene.add(pts); W.parts = pts;
  // 種類：[動作, 顏色, 大小, 混合, 閃爍, 不透明度]
  const K = { pollen: ['drift', '#fff3c4', .1, THREE.NormalBlending, 0, .75], firefly: ['float', '#ffd75e', .3, THREE.AdditiveBlending, 1, 1], coast: ['float', '#ffffff', .08, THREE.AdditiveBlending, 0, .9],
    volcano: ['rise', '#fb923c', .16, THREE.AdditiveBlending, 0, 1], snow: ['fall', '#ffffff', .18, THREE.NormalBlending, 0, .9] };
  let cur = '';
  W.anim.push((dt, t) => {
    const b = domBiome(P.x, P.z), nite = DN.night > .3, key = inCity() ? '' : b === 'forest' ? (nite ? 'firefly' : 'pollen') : b === 'coast' ? (nite ? 'firefly' : 'coast') : b;
    pts.visible = !!key && !QL.noParts; if (!pts.visible) return;
    if (key !== cur) { cur = key; const k = K[key]; U.col.value.set(k[1]); U.size.value = k[2]; mat.blending = k[3]; U.blink.value = k[4]; U.op.value = k[5]; mat.needsUpdate = true; }
    U.time.value = t; U.scale.value = innerHeight * .5;
    const kind = K[key][0]; pts.position.set(Math.floor(P.x / 50) * 50, G(P.x, P.z), Math.floor(P.z / 50) * 50);
    for (let i = 0; i < n; i++) {
      const k = i * 3;
      if (kind === 'float') { pos[k] += Math.sin(t * .6 + i) * dt * .3; pos[k + 1] += Math.cos(t * .5 + i * 1.3) * dt * .2; }
      else if (kind === 'drift') { pos[k] += (.25 + Math.sin(t * .4 + i) * .2) * dt; pos[k + 1] -= dt * (.08 + (i % 3) * .04); pos[k + 2] += Math.cos(t * .3 + i) * dt * .15; if (pos[k + 1] < 0) pos[k + 1] = 14; }
      else if (kind === 'rise') { pos[k + 1] += dt * (1 + (i % 5) * .3); pos[k] += Math.sin(t * 2 + i) * dt * .4; if (pos[k + 1] > 14) pos[k + 1] = 0; }
      else { pos[k + 1] -= dt * (1 + (i % 4) * .25); pos[k] += Math.sin(t + i) * dt * .5; if (pos[k + 1] < 0) pos[k + 1] = 14; }
      const lx = pos[k] + pts.position.x - P.x, lz = pos[k + 2] + pts.position.z - P.z;
      if (lx > 25) pos[k] -= 50; if (lx < -25) pos[k] += 50; if (lz > 25) pos[k + 2] -= 50; if (lz < -25) pos[k + 2] += 50;
    }
    geo.attributes.position.needsUpdate = true;
  });
}
/* 夜裡亮起來的東西：城市窗戶與招牌、路燈（只改既有材質的亮度，不加光源） */
function nightLights() {
  const n = DN.night, k = Math.round(n * 20); if (k === W.nlK) return; W.nlK = k;
  (W.cityWin || []).forEach(m => { m.emissiveIntensity = .12 + n * .85; });
  (W.lampMats || []).forEach(m => { m.emissiveIntensity = .4 + n * 1.6; });
}

/* ============================================================
   小場景與彩蛋（月光谷的小秘密）
   各區 2～4 個有記憶點的小場景（地形小雕塑＋道具＋一點故事），和要靠觀察、時間、動作才找得到的彩蛋。
   - 地形：H0 最後呼叫 nookH（池塘挖碗、冰湖整平），只動場景附近的點；NOOK_DIG 與 nookH 放在 H0 前面
   - 道具：每個場景依材質合併成少數幾個網格（nookKit），交給 cullChunks 做距離／霧剔除（chunkObj）
   - 彩蛋：regEgg 登記、foundEgg 發現（存在 S.eggs）；大城市那邊也用這兩個全域函式（id 以 city_ 開頭）
   NOOK 與 NOOK_DIG 是基礎單位（×K＝世界座標）；42 < max(|x|,|z|) < 66 的山脊帶不放任何東西
   ============================================================ */
const NOOK = {
  pond: [-23, -13.5], willow: [-28.6, -17.2], ring: [-20, 21.5], picnic: [20, -21], log: [6, 32], rock: [-30, 6.2],
  tide: [130.4, -30.2], boat: [122, 38], arch: [133.2, -56], conch: [98, 6.6],
  spring: [-55, -112], obsid: [54, -104], tube: [18, -88],
  lake: [-138, -41], igloo: [-128.4, -45.6], snowmen: [-141.5, -33.5], falls: [-158.4, 38.6], icicle: [-156.8, 33.6],
};
const nw = k => kk(NOOK[k]);
// 隨機散布的樹木、岩石不要長在場景裡（世界座標、半徑）；水面上的草叢另外用 nookWet 清掉
const NOOK_CLEAR = [['pond', 10.5], ['willow', 3], ['ring', 7], ['picnic', 6], ['log', 6], ['rock', 2.4], ['tide', 12], ['boat', 6], ['arch', 7.5], ['conch', 2.2], ['spring', 9], ['obsid', 11], ['tube', 10], ['lake', 16], ['igloo', 6], ['snowmen', 4.5], ['falls', 7], ['icicle', 4]].map(([k, r]) => [...nw(k), r]);
NOOK_CLEAR.push([-165.5 * K, 38.6 * K, 9]); // 冰瀑整條斜坡
NOOK_CLEAR.push([-14.25, 21, 9.5], [-32, 64, 12]); // 計程車：花島與空車繞島的路、谷口前（世界座標）
const nookAvoid = (x, z) => NOOK_CLEAR.some(([cx, cz, r]) => (x - cx) ** 2 + (z - cz) ** 2 < r * r);
const nookWet = (x, z) => NOOK_DIG.some(p => { const dx = x / K - p.x, dz = z / K - p.z; return dx * dx + dz * dz < (nookR(p, Math.atan2(dz, dx)) + .4) ** 2; })
  || [['log', 4.5], ['igloo', 3.4], ['tube', 6.5]].some(([k, r]) => { const [cx, cz] = nw(k); return (x - cx) ** 2 + (z - cz) ** 2 < r * r; });
function nookClear(l) { let j = 0; for (const o of l) if (!nookWet(o.x, o.z)) l[j++] = o; l.length = j; }

/* ---------- 彩蛋：登記與發現 ---------- */
const EGGS = new Map(); // id → { id, name, hint }，依登記順序顯示在手帳
function regEgg(id, name, hint) {
  if (typeof id !== 'string' || !id) return null;
  if (!EGGS.has(id)) EGGS.set(id, { id, name: String(name || id), hint: String(hint || '') });
  return EGGS.get(id);
}
// 第一次發現才算：蓋一個章「✦ 小秘密 n/28」＋叮叮聲＋一點經驗，存進存檔；回傳是否第一次
function foundEgg(id) {
  if (!S || typeof id !== 'string' || !id) return false; if (!Array.isArray(S.eggs)) S.eggs = [];
  if (S.eggs.includes(id)) return false; S.eggs.push(id);
  const e = EGGS.get(id), n = S.eggs.filter(k => EGGS.has(k)).length;
  tkStamp(id, '✦ 小秘密 ' + n + '/' + EGGS.size, e ? e.name : id); // 章蓋在旁白的想法雲、正在讀的紙或說話的人的泡泡上，不再跳左下角的長句（talk.js）
  if (S.sound) { try { const t = audio().currentTime; [1318.5, 1568, 2093, 2637].forEach((f, i) => tone(f, t + i * .075, .4, .045, 'triangle')); } catch (er) { } }
  gainXP(8, '發現小秘密'); save(); ui('inv'); return true;
}
// 場景觸發：還沒找到的話，先在畫面下方冒一朵自己的想法雲說出場景裡發生了什麼，再算發現（章蓋在這朵雲上）
function eggHit(id, msg) { if (!S || (Array.isArray(S.eggs) && S.eggs.includes(id))) return false; if (msg) bark(SELF, msg, { egg: id }); return foundEgg(id); }
const eggList = () => [...EGGS.values()].map(e => ({ id: e.id, name: e.name, hint: e.hint, found: !!(S.eggs && S.eggs.includes(e.id)) }));

/* ---------- 共用：材質、合併、交給 cullChunks ---------- */
const NK = { list: [], vy: 0, jumped: false, look: 0, star: null, starT: -1, starCd: 0, m: new THREE.Matrix4(), q: new THREE.Quaternion(), e: new THREE.Euler(), v: new THREE.Vector3(), s: new THREE.Vector3() };
const wrapA = a => ((a + Math.PI) % PI2 + PI2) % PI2 - Math.PI;
// 每個場景登記一個「靠近才跑」的更新函式（距離 r 以外完全不算）
function nkReg(x, z, r, fn) { NK.list.push({ x, z, r, fn }); }
// 交給 cullChunks：超過 far 公尺或在霧外就不畫、只有玩家附近才投射陰影（與 scatter 的道具同一套規則）。b＝[x, z, 半徑]（會動的群組用）
function chunkObj(o, far = 150, shadow = true, b) {
  if (!o.parent) W.scene.add(o); const u = o.userData;
  if (b) Object.assign(u, { x0: b[0] - b[2], z0: b[1] - b[2], x1: b[0] + b[2], z1: b[1] + b[2] });
  else { const bb = new THREE.Box3().setFromObject(o); Object.assign(u, { x0: bb.min.x, z0: bb.min.z, x1: bb.max.x, z1: bb.max.z }); }
  u.far = far; u.shadow = shadow && !LOW; o.castShadow = u.shadow; W.chunks.push(o); return o;
}
// 和 mergeParts 一樣把零件合併成一個帶頂點色的幾何；顏色給 null＝沿用零件自己的頂點色（水面、冰面、野餐墊的格紋）
function nookMerge(parts, keepN) {
  const gs = []; let n = 0;
  for (const [g0, c, m] of parts) {
    const g = g0.index ? g0.toNonIndexed() : g0.clone(); if (m) g.applyMatrix4(m);
    if (!keepN || !g.attributes.normal || (m && m.determinant() < 0)) g.computeVertexNormals(); // 鏡像過的零件（內壁）法線要重算才會朝內
    gs.push([g, c == null ? null : new THREE.Color(c)]); n += g.attributes.position.count;
  }
  const pos = new Float32Array(n * 3), nor = new Float32Array(n * 3), col = new Float32Array(n * 3); let o = 0;
  for (const [g, c] of gs) {
    const k = g.attributes.position.count, ca = g.attributes.color; pos.set(g.attributes.position.array, o * 3); nor.set(g.attributes.normal.array, o * 3);
    for (let i = 0; i < k; i++) { const j = (o + i) * 3; if (c) { col[j] = c.r; col[j + 1] = c.g; col[j + 2] = c.b; } else if (ca) { col[j] = ca.getX(i); col[j + 1] = ca.getY(i); col[j + 2] = ca.getZ(i); } else col[j] = col[j + 1] = col[j + 2] = 1; }
    o += k; g.dispose();
  }
  const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.BufferAttribute(pos, 3)); geo.setAttribute('normal', new THREE.BufferAttribute(nor, 3)); geo.setAttribute('color', new THREE.BufferAttribute(col, 3)); return geo;
}
// 一個場景的零件收集器（世界座標）。at(x, z, 離地, 轉向, 指定高度, 縮放) 回傳在那個位置擺零件的函式；seg 在兩點之間放一根棍子（樹枝、釣竿、雪人手臂）；done() 依材質各合併成一個網格
function nookKit() {
  const by = new Map(), add = (mat, geo, col, m) => { if (!by.has(mat)) by.set(mat, []); by.get(mat).push([geo, col, m]); };
  const at = (x, z, dy = 0, ry = 0, y, s = 1) => { const B = M4(x, y == null ? H(x, z) + dy : y, z, 0, ry, 0, s); return (mat, geo, col, px = 0, py = 0, pz = 0, rx = 0, ry2 = 0, rz = 0, sx = 1, sy = sx, sz = sx) => add(mat, geo, col, B.clone().multiply(M4(px, py, pz, rx, ry2, rz, sx, sy, sz))); };
  const seg = (mat, a, b, r, col, n = 5, r1 = r) => { const d = new THREE.Vector3().subVectors(b, a), L = d.length(); add(mat, new THREE.CylinderGeometry(r1, r, L, n), col, new THREE.Matrix4().compose(new THREE.Vector3().addVectors(a, b).multiplyScalar(.5), new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.normalize()), new THREE.Vector3(1, 1, 1))); };
  const done = (far = 150) => { by.forEach((parts, mat) => { const m = new THREE.Mesh(nookMerge(parts, !!mat.userData.smooth), mat); m.receiveShadow = !mat.transparent && !mat.userData.noRecv; chunkObj(m, far, mat.userData.shadow !== false); }); by.clear(); };
  return { add, at, seg, done };
}
// 水面／冰面：兩圈以上的頂點，顏色由中心往岸邊變淺；rf(角度)＝岸線半徑（世界座標）；cf(x, z, 0～1, color) 可以自己上色
function nookDisc(cx, y, cz, rf, cols, seg = 40, rings = 2, cf) {
  const g = new THREE.RingGeometry(.001, 1, seg, rings).rotateX(-Math.PI / 2), p = g.attributes.position, col = new Float32Array(p.count * 3), c = new THREE.Color(), C = cols && cols.map(x => new THREE.Color(x));
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), z = p.getZ(i), r = Math.hypot(x, z), R = rf(Math.atan2(z, x)), wx = cx + x * R, wz = cz + z * R; p.setXYZ(i, wx, y, wz);
    if (cf) cf(wx, wz, r, c); else c.copy(C[0]).lerp(C[1], r); col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b;
  }
  g.deleteAttribute('uv'); g.setAttribute('color', new THREE.BufferAttribute(col, 3)); return g;
}
// 裝飾用的小史萊姆（不是可以捏的那種）：身體顏色 col（instanceColor 會再乘上去），sleepy＝閉著眼睛睡覺
function toyGeo(col = '#ffffff', sleepy = false) {
  const p = [[new THREE.SphereGeometry(.5, 16, 12), col, M4(0, .36, 0, 0, 0, 0, 1, .74, 1)], [new THREE.SphereGeometry(.1, 8, 6), '#ffffff', M4(-.17, .58, .3, 0, 0, 0, 1.3, .8, .6)]];
  [-1, 1].forEach(s => {
    p.push(sleepy ? [new THREE.TorusGeometry(.055, .015, 4, 10, Math.PI), '#1f2937', M4(s * .15, .45, .452, 0, 0, Math.PI)] : [new THREE.SphereGeometry(.055, 8, 6), '#1f2937', M4(s * .15, .45, .44, 0, 0, 0, 1, 1.25, .6)]);
    p.push([new THREE.SphereGeometry(.06, 8, 5), '#fb7185', M4(s * .27, .37, .41, 0, 0, 0, 1, .55, .35)]);
  });
  return nookMerge(p, true);
}
// 所有場景共用的材質（每種一份）：flat 平面著色、soft 平滑、night 夜裡自己發光（蘑菇、晶石）、lamp 永遠亮（火、燈、燭光）、warm 室內暖光（不吃陰影）、water、ice、obs 黑曜石、tree 會隨風擺
function nookMats() {
  if (W.nk) return W.nk;
  const U = { value: 0 }, glowOn = (m, k, key) => { m.onBeforeCompile = sh => { sh.uniforms.uNight = U; sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nuniform float uNight;').replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\ntotalEmissiveRadiance += vColor.rgb * ' + k + ';'); }; m.customProgramCacheKey = () => key; return m; };
  const sm = m => { m.userData.smooth = true; return m; }, ns = m => { m.userData.shadow = false; return m; };
  const water = new THREE.MeshStandardMaterial({ vertexColors: true, transparent: true, opacity: .72, roughness: .05, metalness: .1, depthWrite: false });
  water.onBeforeCompile = sh => { // 細碎漣漪：兩層反向流動的雜訊擾動法線，反射的天空會碎成波光（與海水同一招，便宜很多）
    sh.uniforms.uWind = W.wind;
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec2 vWq;').replace('#include <begin_vertex>', '#include <begin_vertex>\nvWq = (modelMatrix * vec4(transformed, 1.0)).xz;');
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nuniform float uWind;\nvarying vec2 vWq;\n' + GLSL_DETAIL).replace('#include <normal_fragment_maps>', `#include <normal_fragment_maps>
      float wq = (tN(vWq * 1.6 + vec2(uWind * 0.35, uWind * 0.22)) + tN(vWq * 3.7 - vec2(uWind * 0.3, uWind * 0.41)) * 0.5) * 0.06;
      normal = tPerturb(-vViewPosition, normal, vec2(dFdx(wq), dFdy(wq)));`)
      // 水自己帶一點顏色的光：火山橘紅的天光下，溫泉的藍才不會被染成黃綠色
      .replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\ntotalEmissiveRadiance += vColor.rgb * 0.22;');
  };
  water.customProgramCacheKey = () => 'nkWater';
  return W.nk = {
    U, water: ns(water),
    flat: new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: .85, metalness: 0 }),
    soft: sm(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: .5, metalness: 0 })),
    night: sm(glowOn(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: .45, metalness: 0 }), '(0.06 + uNight * 1.25)', 'nkNight')),
    toy: sm(glowOn(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: .22, metalness: 0 }), '(uNight * 0.7)', 'nkToy')),
    lamp: ns(new THREE.MeshBasicMaterial({ vertexColors: true, toneMapped: false })),
    warm: Object.assign(new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: .9, metalness: 0, emissive: '#7a4f1f', emissiveIntensity: .5 }), { userData: { noRecv: true } }),
    ice: ns(new THREE.MeshPhysicalMaterial({ vertexColors: true, roughness: .06, metalness: .05, clearcoat: 1, clearcoatRoughness: .06, transparent: true, opacity: .86, flatShading: true })),
    obs: new THREE.MeshPhysicalMaterial({ vertexColors: true, roughness: .07, metalness: .35, clearcoat: 1, clearcoatRoughness: .05, flatShading: true }),
    tree: windMat(new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: .85, metalness: 0 }), .0045),
  };
}
const rk = (s, d = 0) => jit(new THREE.DodecahedronGeometry(1, d), .38, s); // 一顆隨機起伏的低面數岩石
// 小音效（彩蛋用）：呱、鈴聲、回音、海螺
const nkSfx = {
  ribbit() { if (!S.sound) return; try { const ac = audio(), t = ac.currentTime; for (let i = 0; i < 2; i++) { sweep(420, 230, t + i * .12, .08, .035, 'square'); noise(ac, t + i * .12, .06, 650, 1.6, .03, 'bandpass'); } } catch (e) { } },
  bell(f, v = 1) { if (!S.sound) return; try { const t = audio().currentTime; tone(f, t, 1.4, .06 * v); tone(f * 2.01, t, .7, .022 * v); tone(f * 3.02, t, .35, .01 * v, 'triangle'); } catch (e) { } },
  echo() { if (!S.sound) return; try { const ac = audio(), t = ac.currentTime; for (let i = 0; i < 4; i++) { sweep(520, 300, t + i * .34, .2, .05 * Math.pow(.5, i), 'triangle'); noise(ac, t + i * .34, .18, 900, 1, .02 * Math.pow(.5, i), 'bandpass'); } } catch (e) { } },
  conch(k = 0) { if (!S.sound) return; try { const ac = audio(), t = ac.currentTime; noise(ac, t, 1.1, 380 + k * 60, .8, .07, 'lowpass', .6); tone(196 * (1 + k * .25), t + .05, 1, .04, 'triangle'); } catch (e) { } },
};
/* ---------- 森林（中央平地）：睡蓮池塘與老柳樹、蘑菇圈、花海野餐、空心倒木、像史萊姆的石頭、流星 ---------- */
function nookPond(M) {
  const kt = nookKit(), p = NOOK_DIG[0], [cx, cz] = kk([p.x, p.z]), wy = p.w * K, rf = a => nookR(p, a) * K, rd = seeded(41);
  regEgg('forest_frog', '跟著跳的青蛙', '池塘睡蓮上的小青蛙很愛學人，在牠面前做點什麼吧。');
  regEgg('forest_note', '樹洞裡的小紙條', '池塘邊那棵老柳樹的樹洞裡，好像夾著一張紙。');
  kt.add(M.water, nookDisc(cx, wy, cz, a => rf(a) * 1.03, ['#2a6657', '#7cc4a4']), null);
  const pad = (x, z, s, c) => kt.add(M.flat, new THREE.CylinderGeometry(s, s, .03, 12, 1, false, .35, PI2 - .7), c, M4(x, wy + .025, z, 0, rd() * PI2, 0));
  const lotus = (x, z) => { for (let k = 0; k < 7; k++) { const b = k / 7 * PI2; kt.add(M.flat, new THREE.SphereGeometry(.06, 7, 5), k % 2 ? '#f9a8d4' : '#fdf2f8', M4(x + Math.cos(b) * .06, wy + .09, z + Math.sin(b) * .06, 0, -b, .65, 2.1, .7, 1)); } kt.add(M.flat, new THREE.SphereGeometry(.04, 7, 5), '#facc15', M4(x, wy + .11, z)); };
  for (let i = 0; i < (LOW ? 8 : 13); i++) { const a = rd() * PI2, r = (.18 + rd() * .62) * rf(a), x = cx + Math.cos(a) * r, z = cz + Math.sin(a) * r; pad(x, z, .3 + rd() * .32, ['#3f8f45', '#5aa64e', '#6dbb5c'][i % 3]); if (i % 4 === 1) lotus(x + .08, z - .05); }
  // 青蛙坐的那片大睡蓮（靠東邊的小木棧）
  const fa = .15, fx = cx + Math.cos(fa) * rf(fa) * .6, fz = cz + Math.sin(fa) * rf(fa) * .6; pad(fx, fz, .5, '#4d9a46');
  // 岸邊的石頭（半埋）、踏腳石、香蒲
  for (let i = 0; i < 11; i++) { const a = i / 11 * PI2 + rd() * .4, r = rf(a) * (1.04 + rd() * .16), x = cx + Math.cos(a) * r, z = cz + Math.sin(a) * r, s = .28 + rd() * .42; kt.add(M.flat, rk(60 + i), rd() < .5 ? '#8b918a' : '#737a72', M4(x, H(x, z) - s * .2, z, rd(), rd() * 6, rd() * .3, s * 1.25, s * .7, s)); }
  [1.12, .93, .76].forEach((k, i) => { const a = 1.75, x = cx + Math.cos(a) * rf(a) * k, z = cz + Math.sin(a) * rf(a) * k; kt.add(M.flat, rk(80 + i), '#9aa09a', M4(x, wy - .12, z, 0, i, 0, .42, .3, .36)); });
  [2.7, 3.5, 4.3].forEach(a0 => { for (let k = 0; k < (LOW ? 4 : 7); k++) { const a = a0 + (rd() - .5) * .4, r = rf(a) * (.92 + rd() * .16), x = cx + Math.cos(a) * r, z = cz + Math.sin(a) * r, y = Math.max(H(x, z), wy - .25), h = 1 + rd() * .8; kt.add(M.flat, new THREE.CylinderGeometry(.012, .02, h, 4), '#6f8f3a', M4(x, y + h / 2, z)); if (k % 2 === 0) kt.add(M.flat, new THREE.CylinderGeometry(.04, .04, .22, 6), '#6b4423', M4(x, y + h - .05, z)); else kt.add(M.flat, new THREE.ConeGeometry(.05, h * .8, 3), '#7fa04a', M4(x + .05, y + h * .4, z, 0, k, .12, 1, 1, .3)); } });
  // 東岸的小木棧＋奶奶的長椅
  { const a = 0, x = cx + Math.cos(a) * rf(a) * 1.06, z = cz, y = Math.max(H(x, z), wy + .3), w = kt.at(x, z, 0, -Math.PI / 2, y);
    for (let i = 0; i < 11; i++) w(M.flat, new THREE.BoxGeometry(1.1, .06, .26), i % 2 ? '#9a7652' : '#8b6544', 0, .02, i * .28 - .1);
    [0, 1.4, 2.7].forEach(pz => [-.5, .5].forEach(px => w(M.flat, new THREE.CylinderGeometry(.06, .07, 1.4, 6), '#5b4030', px, -.6, pz)));
    const ex = cx + Math.cos(.9) * rf(.9) * 1.35, ez = cz + Math.sin(.9) * rf(.9) * 1.35, b = kt.at(ex, ez, 0, Math.atan2(cx - ex, cz - ez)); // 面向池塘
    b(M.flat, new THREE.BoxGeometry(1.4, .07, .42), '#a07850', 0, .46, 0); b(M.flat, new THREE.BoxGeometry(1.4, .32, .06), '#8b6544', 0, .74, -.2, -.12); [-.58, .58].forEach(px => b(M.flat, new THREE.BoxGeometry(.07, .46, .38), '#6b4d33', px, .23, 0));
    b(M.flat, new THREE.SphereGeometry(.09, 10, 8), '#fca5a5', .35, .55, .05, 0, 0, 0, 1, .7, 1); // 椅子上一顆紅蘋果（奶奶留的）
  }
  kt.done(100);
  // 老柳樹：垂下來的枝條會隨風擺；樹洞朝著池塘，裡面夾著奶奶的紙條
  { const [x, z] = nw('willow'), y = H(x, z) - .1, face = Math.atan2(cx - x, cz - z), parts = [];
    parts.push([new THREE.CylinderGeometry(.26, .4, 2.3, 9), '#6b5040', M4(0, 1.15, 0, .05, 0, -.07)], [new THREE.CylinderGeometry(.17, .25, 1.7, 8), '#6b5040', M4(.12, 2.8, .05, -.08, 0, .18)], [new THREE.CylinderGeometry(.06, .1, 1.3, 6), '#6b5040', M4(-.5, 3, .2, .3, 0, .8)]);
    [[0, 3.8, 0, 1.6], [.95, 3.45, .4, 1.1], [-.85, 3.55, -.3, 1.2], [.2, 4.1, -.85, 1], [-.3, 4, .9, 1]].forEach(([bx, by, bz, s], i) => parts.push([jit(new THREE.IcosahedronGeometry(1, 1), .25, 300 + i), i % 2 ? '#8fbf5a' : '#a3cf6a', M4(bx, by, bz, 0, i, 0, s * 1.15, s * .6, s * 1.15)]));
    for (let i = 0; i < (LOW ? 20 : 34); i++) { const a = i / (LOW ? 20 : 34) * PI2 + rd() * .2, r = 1.35 + rd() * .75, l = 1.3 + rd() * 1.2; parts.push([new THREE.BoxGeometry(.08, l, .025), i % 3 ? '#9ccc65' : '#b5d97a', M4(Math.cos(a) * r, 3.4 - l / 2, Math.sin(a) * r, 0, -a, 0)]); }
    parts.push([new THREE.SphereGeometry(.24, 10, 8), '#24180e', M4(0, 1.25, .3, 0, 0, 0, .75, 1, .32)], [new THREE.BoxGeometry(.14, .1, .02), '#fff3c4', M4(.02, 1.2, .37, 0, 0, .15)], [new THREE.SphereGeometry(.3, 8, 5, 0, PI2, 0, Math.PI / 2), '#5b8f3e', M4(-.15, .02, .3, 0, 0, 0, 1.4, .4, 1)]);
    const tm = new THREE.Mesh(mergeParts(parts), M.tree); tm.position.set(x, y, z); tm.rotation.y = face; tm.receiveShadow = true; chunkObj(tm, 140, true); addCol({ x, z, r: .5, tree: 1 });
    const hb = hitBox(.7, .7, .6, 0, 1.22, .35, tm);
    addInter(hb, 'nook', 'forest_note', '看看樹洞', { act(it) { talk(noteWho('奶奶的紙條', { src: it }), [{ t: '池塘的小青蛙最愛學人跳，跳給牠看看吧。', sig: '——奶奶' }], { egg: 'forest_note' }); foundEgg('forest_note'); } }); // 紙條拿在手上讀（talk.js），章蓋在紙上
  }
  // 睡蓮上的小青蛙：你跳，牠也跳；連跳三次就是好朋友了
  const frog = new THREE.Mesh(nookMerge([[new THREE.SphereGeometry(.1, 10, 8), '#4ade80', M4(0, .07, 0, 0, 0, 0, 1, .7, 1.25)], [new THREE.SphereGeometry(.07, 8, 6), '#d9f99d', M4(0, .05, .05, 0, 0, 0, 1, .6, 1.1)], ...[-1, 1].flatMap(s => [[new THREE.SphereGeometry(.036, 8, 6), '#4ade80', M4(s * .05, .135, .06)], [new THREE.SphereGeometry(.02, 6, 5), '#111827', M4(s * .056, .145, .085)], [new THREE.SphereGeometry(.05, 8, 6), '#22c55e', M4(s * .085, .04, -.07, 0, 0, 0, .8, .55, 1.3)], [new THREE.SphereGeometry(.025, 6, 5), '#22c55e', M4(s * .07, .02, .11)]])], true), M.soft);
  frog.position.set(fx, wy + .04, fz); chunkObj(frog, 60, false, [fx, fz, 1]);
  const fr = { hop: 0, n: 0, last: -9, ry: 0 };
  nkReg(fx, fz, 30, (dt, t, d) => {
    if (NK.jumped && d < 11) {
      fr.n = t - fr.last < 4 ? fr.n + 1 : 1; fr.last = t; fr.hop = .55; nkSfx.ribbit(); fx3(new THREE.Vector3(fx, wy + .7, fz), fr.n >= 3 ? '呱呱呱！' : '呱！', '#86efac');
      if (fr.n >= 3) eggHit('forest_frog', '青蛙跟著你一起跳了三下，看起來超開心。');
    }
    if (fr.hop > 0) { fr.hop = Math.max(0, fr.hop - dt); const k = 1 - fr.hop / .55; frog.position.y = wy + .04 + Math.sin(Math.PI * k) * .42; frog.rotation.y = fr.ry + k * PI2; frog.scale.set(1, 1, 1); }
    else { frog.position.y = wy + .04; fr.ry += wrapA(Math.atan2(P.x - fx, P.z - fz) - fr.ry) * Math.min(1, dt * 3); frog.rotation.y = fr.ry; const b = 1 + Math.max(0, Math.sin(t * 2.4)) ** 8 * .25; frog.scale.set(1, 1, b); } // 喉嚨一鼓一鼓
  });
}
function nookRing(M) {
  const kt = nookKit(), [cx, cz] = nw('ring'), y0 = H(cx, cz), rd = seeded(52);
  regEgg('forest_ring', '月光下的蘑菇圈', '森林西南邊有一圈蘑菇，聽說月亮出來時會變得很熱鬧。');
  const caps = ['#ff8fab', '#ffd6a5', '#caffbf', '#a0c4ff', '#ffc6ff', '#fdffb6'];
  for (let i = 0; i < 14; i++) {
    const a = i / 14 * PI2 + rd() * .18, r = 2.5 + rd() * .35, x = cx + Math.cos(a) * r, z = cz + Math.sin(a) * r, y = H(x, z), s = .5 + rd() * .7;
    kt.add(M.flat, new THREE.CylinderGeometry(.05 * s, .075 * s, .44 * s, 7), '#f5efe6', M4(x, y + .2 * s, z, (rd() - .5) * .2, 0, (rd() - .5) * .2));
    kt.add(M.night, new THREE.SphereGeometry(.21 * s, 12, 6, 0, PI2, 0, Math.PI / 2), caps[i % 6], M4(x, y + .4 * s, z, 0, 0, 0, 1, .72, 1));
    if (s > .8) for (let k = 0; k < 3; k++) kt.add(M.night, new THREE.SphereGeometry(.03 * s, 6, 4), '#ffffff', M4(x + Math.cos(k * 2.1 + a) * .1 * s, y + .5 * s, z + Math.sin(k * 2.1 + a) * .1 * s));
  }
  // 圈中央的小樹樁舞台、圈內的三葉草
  kt.add(M.flat, new THREE.CylinderGeometry(.34, .4, .3, 10), '#7a5a3c', M4(cx, y0 + .1, cz)); kt.add(M.flat, new THREE.CylinderGeometry(.32, .32, .02, 10), '#c8a27a', M4(cx, y0 + .26, cz));
  kt.add(M.flat, new THREE.CylinderGeometry(.2, .2, .025, 10), '#a07850', M4(cx, y0 + .265, cz));
  for (let i = 0; i < (LOW ? 10 : 22); i++) { const a = rd() * PI2, r = .6 + rd() * 1.6, x = cx + Math.cos(a) * r, z = cz + Math.sin(a) * r, y = H(x, z); for (let k = 0; k < 3; k++) kt.add(M.flat, new THREE.SphereGeometry(.05, 6, 4), k ? '#4f9a45' : '#5fae52', M4(x + Math.cos(k * 2.1) * .05, y + .05, z + Math.sin(k * 2.1) * .05, 0, 0, 0, 1, .25, 1)); }
  kt.done(85);
  // 夜裡出來跳舞的五隻小史萊姆（同一個 InstancedMesh）
  const N = 5, im = new THREE.InstancedMesh(toyGeo(), M.toy, N); im.instanceMatrix.setUsage(THREE.DynamicDrawUsage); im.frustumCulled = false; im.visible = false;
  ['#6ee7b7', '#f9a8d4', '#fde047', '#93c5fd', '#c4b5fd'].forEach((c, i) => im.setColorAt(i, new THREE.Color(c)));
  chunkObj(im, 55, false, [cx, cz, 3]); let noteT = 0; // 繪製距離比下面的更新半徑短：白天藏起來時不會被 cullChunks 又打開
  nkReg(cx, cz, 60, (dt, t, d) => {
    const on = smooth(.45, .75, DN.night); im.visible = on > .01; if (!im.visible) return;
    for (let i = 0; i < N; i++) {
      const a = t * .55 + i / N * PI2, hop = Math.abs(Math.sin(t * 3.4 + i * 1.3)), sq = 1 - hop, s = .3 * on, x = cx + Math.cos(a) * 1.25, z = cz + Math.sin(a) * 1.25;
      NK.m.compose(NK.v.set(x, H(x, z) + hop * .32 * on, z), NK.q.setFromEuler(NK.e.set(0, -a + Math.sin(t * 2 + i) * .4, 0)), NK.s.set(s * (1 + .22 * sq), s * (1 - .22 * sq), s * (1 + .22 * sq))); im.setMatrixAt(i, NK.m);
    }
    im.instanceMatrix.needsUpdate = true;
    if (on > .9 && d < 9) { if ((noteT -= dt) < 0) { noteT = .9; fx3(new THREE.Vector3(cx + rnd(-1, 1), y0 + 1.1, cz + rnd(-1, 1)), pick(['♪', '♫', '♪']), pick(['#f9a8d4', '#fde047', '#a5f3fc'])); } eggHit('forest_ring', '蘑菇圈亮了起來，小史萊姆們手牽手跳著月光舞。'); }
  });
}
function nookPicnic(M) {
  const kt = nookKit(), [bx, bz] = nw('picnic'), yaw = .35, rd = seeded(63);
  regEgg('forest_picnic', '黃昏的野餐', '花海裡有一張野餐墊。黃昏時，在上面蹲下來休息一下吧。');
  // 紅白格紋野餐墊：每個頂點都貼著地面（地面有一點起伏）
  { const g = new THREE.PlaneGeometry(2.4, 1.8, 8, 6).rotateX(-Math.PI / 2).toNonIndexed(), p = g.attributes.position, col = new Float32Array(p.count * 3), cr = Math.cos(yaw), sr = Math.sin(yaw), A = new THREE.Color('#e5484d'), B = new THREE.Color('#fff4e6');
    for (let f = 0; f < p.count; f += 3) { const lx = (p.getX(f) + p.getX(f + 1) + p.getX(f + 2)) / 3, lz = (p.getZ(f) + p.getZ(f + 1) + p.getZ(f + 2)) / 3, c = (Math.floor((lx + 1.2) / .3) + Math.floor((lz + .9) / .3)) % 2 ? A : B; for (let k = 0; k < 3; k++) col.set([c.r, c.g, c.b], (f + k) * 3); }
    for (let i = 0; i < p.count; i++) { const lx = p.getX(i), lz = p.getZ(i), x = bx + lx * cr + lz * sr, z = bz - lx * sr + lz * cr, edge = Math.max(Math.abs(lx) / 1.2, Math.abs(lz) / .9); p.setXYZ(i, x, H(x, z) + .04 - smooth(.85, 1, edge) * .025 + Math.sin(lx * 9 + lz * 7) * .006, z); }
    g.setAttribute('color', new THREE.BufferAttribute(col, 3)); kt.add(M.flat, g, null); }
  const a = kt.at(bx, bz, .04, yaw);
  // 籐籃（半開的蓋子、提把、露出來的餐巾）、盤子與三明治、蘋果、保溫瓶、杯子、蜂蜜罐、草帽、翻開的書
  a(M.flat, new THREE.CylinderGeometry(.24, .2, .24, 12), '#c4935a', -.75, .12, -.45); a(M.flat, new THREE.TorusGeometry(.235, .025, 5, 14), '#a8743f', -.75, .24, -.45, Math.PI / 2);
  a(M.flat, new THREE.TorusGeometry(.2, .018, 5, 12, Math.PI), '#a8743f', -.75, .25, -.45); a(M.flat, new THREE.CylinderGeometry(.25, .25, .03, 12), '#b98450', -.6, .33, -.45, 0, 0, .9);
  a(M.flat, new THREE.BoxGeometry(.18, .08, .16), '#e5484d', -.8, .27, -.4, .3, .4, .2);
  a(M.flat, new THREE.CylinderGeometry(.17, .15, .02, 14), '#f8fafc', .1, .02, .1);
  [[.05, .12, .2], [.16, .05, -.3]].forEach(([px, pz, r], i) => { a(M.flat, new THREE.CylinderGeometry(.1, .1, .06, 3), '#f3d9a4', px, .06, pz, 0, r + i, 0); a(M.flat, new THREE.CylinderGeometry(.103, .103, .015, 3), '#65a30d', px, .065, pz, 0, r + i, 0); });
  [[.55, -.3], [.65, -.18], [.5, -.12]].forEach(([px, pz], i) => { a(M.flat, new THREE.SphereGeometry(.07, 10, 8), i === 1 ? '#facc15' : '#dc2626', px, .07, pz); a(M.flat, new THREE.CylinderGeometry(.006, .008, .05, 4), '#5b4030', px, .15, pz); });
  a(M.flat, new THREE.CylinderGeometry(.07, .07, .34, 12), '#3b82f6', .75, .17, .45); a(M.flat, new THREE.CylinderGeometry(.075, .075, .07, 12), '#cbd5e1', .75, .37, .45);
  [[.45, .5], [.58, .62]].forEach(([px, pz]) => a(M.flat, new THREE.CylinderGeometry(.05, .04, .09, 10), '#f8fafc', px, .045, pz));
  a(M.flat, new THREE.CylinderGeometry(.06, .06, .12, 10), '#f59e0b', -.25, .06, .55); a(M.flat, new THREE.CylinderGeometry(.065, .065, .03, 10), '#a16207', -.25, .135, .55);
  a(M.flat, new THREE.CylinderGeometry(.34, .34, .02, 18), '#e9cf8f', .95, .03, -.55); a(M.flat, new THREE.SphereGeometry(.17, 12, 6, 0, PI2, 0, Math.PI / 2), '#e2c27a', .95, .03, -.55); a(M.flat, new THREE.TorusGeometry(.17, .02, 5, 16), '#f472b6', .95, .06, -.55, Math.PI / 2);
  [-1, 1].forEach(s => a(M.flat, new THREE.BoxGeometry(.2, .015, .28), s < 0 ? '#fef3c7' : '#fde68a', -.3 + s * .1, .02 + (s > 0 ? .01 : 0), -.1, 0, .3, s * .12));
  // 遮蔭的大樹，樹枝上卡著一個風箏（誰的呢？）
  { const tx = bx + Math.cos(yaw) * 3.3 + .6, tz = bz - Math.sin(yaw) * 3.3 - 1.2, ty = H(tx, tz) - .1, t = kt.at(tx, tz, -.1);
    t(M.flat, new THREE.CylinderGeometry(.2, .34, 2.6, 9), '#5b4030', 0, 1.3, 0); kt.seg(M.flat, new THREE.Vector3(tx, ty + 2.2, tz), new THREE.Vector3(tx - .9, ty + 3.2, tz + .4), .07, '#5b4030', 6, .1);
    [[0, 3.4, 0, 1.5], [.9, 3.1, .3, 1.1], [-.9, 3.2, -.2, 1.15], [.2, 3.9, -.6, 1], [-.4, 3.8, .7, .95], [.6, 3.7, .7, .9]].forEach(([px, py, pz, s], i) => t(M.flat, jit(new THREE.IcosahedronGeometry(1, 1), .28, 400 + i), ['#4c9a45', '#62a84b', '#57a04a'][i % 3], px, py, pz, 0, i, 0, s, s * .82, s));
    t(M.flat, new THREE.BoxGeometry(.55, .55, .02), '#f472b6', -1.2, 3.25, .9, 0, .5, Math.PI / 4); t(M.flat, new THREE.BoxGeometry(.04, .78, .025), '#fde047', -1.2, 3.25, .91, 0, .5, Math.PI / 4);
    for (let i = 0; i < 4; i++) t(M.flat, new THREE.BoxGeometry(.1, .05, .02), i % 2 ? '#38bdf8' : '#fde047', -1.38 + i * .04, 2.75 - i * .22, .95, 0, .5, i * .4);
    addCol({ x: tx, z: tz, r: .45, tree: 1 }); }
  kt.done(100);
  // 花海：一束一束（同一個幾何裡三朵不同的花）成片長在野餐墊周圍，隨風擺
  const fm = windMat(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: .6, flatShading: true, side: THREE.DoubleSide }), .3, false, LOW ? [32, 50] : [52, 78]);
  // 一束＝五朵不同顏色的花：花頭是兩個交錯的三角形（六角星形的花瓣）＋花心，只有二十幾個面；花頭比一般野花大，遠看才會是一片花海
  const bunch = mergeParts([[0, 0, '#f9a8d4'], [.17, .08, '#ffffff'], [-.11, .14, '#fde047'], [.06, -.16, '#c4b5fd'], [-.16, -.07, '#fb7185']].flatMap(([x, z, c], i) => { const h = .2 + (i % 3) * .07, tl = (i % 2 - .5) * .5; return [[new THREE.CylinderGeometry(.012, .016, h, 3, 1, true), '#4f8a3f', M4(x, h / 2, z)], [new THREE.ConeGeometry(.04, .16, 3, 1, true), '#5aa04a', M4(x + .04, .07, z, 0, i, -.7, 1, 1, .3)], [new THREE.CircleGeometry(.075, 3), c, M4(x, h, z, -Math.PI / 2 + tl, 0, i)], [new THREE.CircleGeometry(.075, 3), c, M4(x, h + .002, z, -Math.PI / 2 + tl, 0, i + Math.PI / 3)], [new THREE.CircleGeometry(.03, 5), '#fbbf24', M4(x, h + .006, z, -Math.PI / 2 + tl, 0, 0)]]; }));
  const BL = [];
  for (let i = 0; i < (LOW ? 90 : 220); i++) { const a = rd() * PI2, r = 1.8 + Math.sqrt(rd()) * 8, x = bx + Math.cos(a) * r, z = bz + Math.sin(a) * r; if (Math.hypot(x - bx, z - bz) < 2 || onPath(x, z) > .2) continue; BL.push({ x, y: H(x, z) - .02, z, s: .9 + rd() * .5, ry: rd() * 6 }); }
  scatter(bunch, fm, BL, false, { cell: 44, far: 80 });
  let sit = 0;
  nkReg(bx, bz, 12, (dt, t, d) => {
    sit = d < 1.25 && P.sneak && DN.dusk > .05 ? sit + dt : 0;
    if (sit > 1.2) eggHit('forest_picnic', '在野餐墊上坐下來看夕陽，風裡有花香……好放鬆。');
  });
}
function nookLog(M) {
  const kt = nookKit(), [cx, cz] = nw('log'), L = 6.5, R1 = 1.25, R0 = 1.02, y = H(cx, cz) + R0 - .14, rd = seeded(71);
  regEgg('forest_log', '鑽過空心倒木', '森林南邊躺著一根空心的大倒木，從一頭鑽到另一頭看看？');
  kt.add(M.flat, jit(new THREE.CylinderGeometry(R1, R1 * 1.05, L, 14, 3, true), .05, 7), '#6b4d33', M4(cx, y, cz, 0, 0, Math.PI / 2));
  kt.add(M.flat, new THREE.CylinderGeometry(R0, R0, L, 14, 1, true), '#a8835c', M4(cx, y, cz, 0, 0, Math.PI / 2, 1, 1, -1)); // 內壁：鏡像讓面朝內
  [-1, 1].forEach(s => { kt.add(M.flat, new THREE.RingGeometry(R0, R1 * (s > 0 ? 1.05 : 1), 14), '#c8a27a', M4(cx + s * L / 2, y, cz, 0, s * Math.PI / 2, 0)); kt.add(M.flat, new THREE.TorusGeometry((R0 + R1) / 2, .015, 3, 20), '#a07850', M4(cx + s * (L / 2 + .005), y, cz, 0, s * Math.PI / 2, 0)); });
  // 背上的苔蘚、側面的層孔菌、兩頭的小蘑菇與蕨葉
  for (let i = 0; i < 4; i++) kt.add(M.flat, new THREE.SphereGeometry(.45, 8, 5, 0, PI2, 0, Math.PI / 2), i % 2 ? '#5b8f3e' : '#4f7f36', M4(cx - 2.2 + i * 1.4 + rd() * .4, y + R1 - .1, cz + (rd() - .5) * .4, 0, rd() * 6, 0, 1.5, .35, .9));
  [[-1.4, .4], [-.9, .1], [1.6, .55]].forEach(([px, py]) => kt.add(M.flat, new THREE.CylinderGeometry(.2, .2, .04, 10, 1, false, 0, Math.PI), '#e7c9a0', M4(cx + px, y + py, cz + R1 * .98, 0, -Math.PI / 2, 0))); // 半圓朝外長出來
  [[-L / 2 - .4, .6], [L / 2 + .5, -.7], [L / 2 + .3, .9]].forEach(([px, pz], i) => { const x = cx + px, z = cz + pz, gy = H(x, z); kt.add(M.flat, new THREE.CylinderGeometry(.04, .05, .22, 6), '#f5efe6', M4(x, gy + .1, z)); kt.add(M.flat, new THREE.SphereGeometry(.13, 10, 5, 0, PI2, 0, Math.PI / 2), i % 2 ? '#c98f5a' : '#e5484d', M4(x, gy + .2, z, 0, 0, 0, 1, .7, 1)); });
  // 倒木裡面：鋪著葉子的小窩、三顆橡實，還有一隻睡著的小史萊姆
  const my = H(cx, cz);
  kt.add(M.flat, new THREE.CylinderGeometry(.55, .6, .06, 10), '#c2884a', M4(cx, my + .03, cz, 0, 0, 0, 1.4, 1, .9));
  [[.5, .25], [.62, .1], [.45, -.05]].forEach(([px, pz]) => { kt.add(M.flat, new THREE.SphereGeometry(.05, 8, 6), '#a16207', M4(cx + px, my + .08, cz + pz, 0, 0, 0, 1, 1.2, 1)); kt.add(M.flat, new THREE.CylinderGeometry(.045, .05, .03, 8), '#78350f', M4(cx + px, my + .13, cz + pz)); });
  kt.done(85);
  const sl = new THREE.Mesh(toyGeo('#86efac', true), M.toy); sl.position.set(cx - .15, my + .05, cz); sl.rotation.y = Math.PI / 2; sl.scale.setScalar(.6); chunkObj(sl, 50, false, [cx, cz, 1]);
  addCol({ box: [cx - L / 2, cz + .82, cx + L / 2, cz + R1 + .1] }); addCol({ box: [cx - L / 2, cz - R1 - .1, cx + L / 2, cz - .82] });
  const st = { side: 0 }; let zz = 0;
  nkReg(cx, cz, 30, (dt, t, d) => {
    sl.scale.y = .6 * (1 + Math.sin(t * 1.6) * .05);
    const lx = P.x - cx, lz = P.z - cz;
    if (Math.abs(lx) < L / 2 - .5 && Math.abs(lz) < .8) { if (!st.side) st.side = Math.sign(st.lx || lx); }
    else if (st.side && Math.abs(lx) > L / 2 + .2 && Math.abs(lz) < 1.3) { if (Math.sign(lx) === -st.side) eggHit('forest_log', '鑽過倒木的時候，裡面有一隻小史萊姆睡得好熟，連翻身都沒有。'); st.side = 0; }
    else if (Math.abs(lx) > L / 2 + 1.5 || Math.abs(lz) > 1.6) st.side = 0;
    st.lx = lx;
    if (d < 4.5 && (zz -= dt) < 0) { zz = 2.2; fx3(new THREE.Vector3(cx - .15, my + .75, cz), 'Zzz', '#a7f3d0'); }
  });
}
function nookRock(M) {
  const [x, z] = nw('rock'), y = H(x, z) - .1, g = new THREE.Group(); g.position.set(x, y, z); g.rotation.y = Math.PI; W.scene.add(g);
  regEgg('forest_rock', '長得像史萊姆的石頭', '往雪原的小徑旁，有一塊圓得很可疑的石頭。');
  // 身體用有稜角的石頭（平面著色），只有眼睛圓圓亮亮的：遠看是石頭，靠近才覺得「咦？」
  const body = new THREE.Mesh(nookMerge([[jit(new THREE.IcosahedronGeometry(.85, 2), .05, 9), '#8f9aa4', M4(0, .62, 0, 0, 0, 0, 1.05, .8, .95)], [jit(new THREE.SphereGeometry(.88, 12, 4, 0, PI2, 0, .85), .05, 10), '#6b9a4e', M4(0, .62, 0, 0, 0, 0, 1.05, .8, .95)], [new THREE.SphereGeometry(.08, 8, 6), '#f0abfc', M4(-.42, .52, .68, 0, 0, 0, 1, .55, .4)], [new THREE.SphereGeometry(.08, 8, 6), '#f0abfc', M4(.42, .52, .68, 0, 0, 0, 1, .55, .4)], [new THREE.ConeGeometry(.05, .2, 4), '#65a30d', M4(.1, 1.36, 0, 0, 0, -.4, 1, 1, .4)], [new THREE.ConeGeometry(.05, .18, 4), '#84cc16', M4(-.04, 1.34, 0, 0, 0, .5, 1, 1, .4)]]), M.flat);
  const eyes = new THREE.Mesh(nookMerge([-1, 1].map(s => [new THREE.SphereGeometry(.075, 10, 8), '#273038', M4(s * .24, .72, .73, 0, 0, 0, 1, 1.35, .5)]), true), M.soft);
  g.add(body, eyes); body.castShadow = !LOW; chunkObj(g, 75, false, [x, z, 1.2]); addCol({ x, z, r: .85 });
  const st = { wob: 0, blink: 0 };
  addInter(hitBox(1.8, 1.4, 1.6, 0, .7, 0, g), 'nook', 'forest_rock', '摸摸這塊圓石頭', { act() { st.wob = 1; st.blink = .25; sfx.boing(1.25, .9); if (!eggHit('forest_rock', '……這真的是石頭吧？它好像對你眨了眨眼。')) fx3(new THREE.Vector3(x, y + 1.8, z), '……？', '#cbd5e1'); } });
  nkReg(x, z, 25, (dt, t) => {
    st.wob = Math.max(0, st.wob - dt * 1.6); st.blink = Math.max(0, st.blink - dt);
    const w = Math.sin(st.wob * 14) * st.wob * .12; g.scale.set(1 + w, 1 - w + Math.sin(t * 1.1) * .008, 1 + w);
    eyes.scale.y = st.blink > 0 ? .12 : 1;
  });
}
// 流星：晴朗的夜裡在中央平地抬頭看天空幾秒，就會有一顆劃過去
function starStep(dt) {
  NK.starCd = Math.max(0, NK.starCd - dt);
  const r = Math.max(Math.abs(P.x), Math.abs(P.z)) / K;
  NK.look = r < 42 && DN.night > .7 && P.pitch > .5 && !GUI.kind ? NK.look + dt : 0;
  if (NK.look > 3 && NK.starT < 0 && !NK.starCd) {
    if (!NK.star) {
      const c = document.createElement('canvas'); c.width = 256; c.height = 16; const g = c.getContext('2d'), gr = g.createLinearGradient(0, 0, 256, 0); gr.addColorStop(0, 'rgba(255,255,255,0)'); gr.addColorStop(.85, 'rgba(220,235,255,.8)'); gr.addColorStop(1, 'rgba(255,255,255,1)');
      g.fillStyle = gr; g.beginPath(); g.moveTo(0, 8); g.lineTo(248, 3); g.arc(248, 8, 5, -Math.PI / 2, Math.PI / 2); g.closePath(); g.fill();
      const tx = new THREE.CanvasTexture(c); tx.colorSpace = THREE.SRGBColorSpace;
      NK.star = new THREE.Sprite(new THREE.SpriteMaterial({ map: tx, transparent: true, depthWrite: false, fog: false, blending: THREE.AdditiveBlending, rotation: -.35 })); NK.star.renderOrder = 2; W.scene.add(NK.star);
    }
    // 出現當下的視線方向當作基準（之後轉頭，流星還是留在天上同一個地方）
    NK.starT = 0; NK.starCd = 18; const q = W.cam.quaternion; NK.sb = [new THREE.Vector3(0, 0, -1).applyQuaternion(q), new THREE.Vector3(1, 0, 0).applyQuaternion(q), new THREE.Vector3(0, 1, 0).applyQuaternion(q), W.cam.position.clone()];
  }
  if (NK.starT < 0) { if (NK.star) NK.star.visible = false; return; }
  NK.starT += dt; const k = NK.starT / 1.1, [bf, br, bu, b0] = NK.sb;
  if (k >= 1) { NK.starT = -1; NK.star.visible = false; eggHit('forest_star', '咻——一顆流星劃過夜空。趕快許個願吧！'); return; }
  // 從視線左上往右下劃過：移動方向（右 140、下 50）與 sprite 的旋轉角度一致
  NK.star.visible = true; NK.star.position.copy(b0).addScaledVector(bf, 260).addScaledVector(br, -70 + k * 140).addScaledVector(bu, 35 - k * 50);
  NK.star.scale.set(46, 2.2, 1); NK.star.material.opacity = Math.sin(Math.PI * k) * 1.2;
}
/* ---------- 海岸：潮池與寄居蟹、擱淺的小船（瓶中信）、海蝕岩拱、大海螺 ---------- */
function nookTide(M) {
  const kt = nookKit(), rd = seeded(91), crabs = [];
  regEgg('coast_crab', '害羞的寄居蟹', '潮池邊的小貝殼會走路？放輕腳步慢慢靠近看看。');
  [1, 2, 3].forEach(pi => {
    const p = NOOK_DIG[pi], [cx, cz] = kk([p.x, p.z]), wy = p.w * K, rf = a => nookR(p, a) * K;
    kt.add(M.water, nookDisc(cx, wy, cz, a => rf(a) * 1.03, ['#0f5f80', '#6fd3cf']), null);
    // 圍成一圈的礁石（靠海那側比較大，擋住浪），石頭上有藤壺與海藻
    const n = 9 + pi;
    for (let i = 0; i < n; i++) {
      const a = i / n * PI2 + rd() * .3, sea = Math.max(0, Math.cos(a)), r = rf(a) * (1.06 + rd() * .1 + sea * .08), x = cx + Math.cos(a) * r, z = cz + Math.sin(a) * r, s = .3 + rd() * .26 + sea * .3, y = Math.max(H(x, z), wy - .2);
      kt.add(M.flat, rk(120 + pi * 20 + i), ['#7b8591', '#8d96a0', '#6f7884'][i % 3], M4(x, y + s * .15, z, rd(), rd() * 6, rd() * .4, s * 1.2, s * .8, s));
      if (i % 4 === 1) { const c = ['#fb7185', '#f97316', '#c084fc'][(i + pi) % 3]; for (let k = 0; k < 5; k++) kt.add(M.flat, new THREE.SphereGeometry(.06, 6, 4), c, M4(x + Math.cos(k * 1.257) * .09, y + s * .72, z + Math.sin(k * 1.257) * .09, 0, -k * 1.257, 0, 2.2, .45, 1)); } // 趴在礁石上曬太陽的海星
      if (i % 2 === 0) kt.add(M.flat, new THREE.SphereGeometry(s * .7, 7, 4, 0, PI2, 0, Math.PI / 2), '#4d6b3c', M4(x, y + s * .62, z, 0, 0, 0, 1, .35, 1));
      for (let k = 0; k < 3; k++) kt.add(M.flat, new THREE.ConeGeometry(.04, .05, 5), '#e7e5e4', M4(x + Math.cos(k * 2 + i) * s * .8, y + s * .25 + k * .05, z + Math.sin(k * 2 + i) * s * .8));
    }
    // 池底：海星、海葵、小貝殼、一叢叢海草
    const bed = (x, z) => Math.min(H(x, z), wy - .05) + .02;
    for (let i = 0; i < 2 + (pi % 2); i++) { const a = rd() * PI2, r = rf(a) * (.55 + rd() * .3), x = cx + Math.cos(a) * r, z = cz + Math.sin(a) * r, c = ['#fb7185', '#f97316', '#c084fc'][(i + pi) % 3]; for (let k = 0; k < 5; k++) kt.add(M.flat, new THREE.SphereGeometry(.07, 6, 4), c, M4(x + Math.cos(k * 1.257) * .1, bed(x, z), z + Math.sin(k * 1.257) * .1, 0, -k * 1.257, 0, 2.2, .45, 1)); }
    for (let i = 0; i < 3; i++) { const a = rd() * PI2, r = rf(a) * (.6 + rd() * .3), x = cx + Math.cos(a) * r, z = cz + Math.sin(a) * r, y = bed(x, z); kt.add(M.flat, new THREE.CylinderGeometry(.05, .07, .1, 8), '#f472b6', M4(x, y + .05, z)); for (let k = 0; k < 6; k++) kt.add(M.flat, new THREE.ConeGeometry(.012, .09, 4), '#fbcfe8', M4(x + Math.cos(k) * .035, y + .13, z + Math.sin(k) * .035, Math.sin(k) * .5, 0, -Math.cos(k) * .5)); }
    for (let i = 0; i < 4; i++) { const a = rd() * PI2, r = rf(a) * (.3 + rd() * .5), x = cx + Math.cos(a) * r, z = cz + Math.sin(a) * r, y = bed(x, z); for (let k = 0; k < 3; k++) kt.add(M.flat, new THREE.BoxGeometry(.04, .3 + k * .08, .01), '#3f6b3a', M4(x + k * .03, y + .15, z, 0, k * 1.1, (k - 1) * .25)); }
    crabs.push(...[0, 1].slice(0, pi === 2 ? 2 : 1).map(k => ({ hx: cx + Math.cos(k * 3 + pi) * rf(0) * 1.6, hz: cz + Math.sin(k * 3 + pi) * rf(0) * 1.6, a: rd() * PI2, r: 1.1 + rd() * .6, sp: (rd() < .5 ? -1 : 1) * (.25 + rd() * .15), hide: 0, wave: 0, pause: 0 })));
  });
  // 沙灘上的貝殼與漂流木
  const [tx, tz] = nw('tide');
  for (let i = 0; i < 10; i++) { const x = tx + rnd(-9, 4), z = tz + rnd(-11, 11); if (nookWet(x, z)) continue; kt.add(M.flat, new THREE.SphereGeometry(.07, 8, 5, 0, PI2, 0, Math.PI / 2), pick(['#fde7d6', '#fbcfe8', '#fed7aa']), M4(x, H(x, z), z, 0, rd() * 6, 0, 1, .5, 1.3)); }
  kt.seg(M.flat, new THREE.Vector3(tx - 6, H(tx - 6, tz + 5) + .1, tz + 5), new THREE.Vector3(tx - 3.6, H(tx - 3.6, tz + 6) + .12, tz + 6), .09, '#a8a29e', 6, .07);
  kt.done(100);
  // 寄居蟹：沿著潮池繞小圈走，有人大步靠近就縮進殼裡；潛行慢慢靠近，牠會探出頭來揮揮鉗子
  const cg = nookMerge([[new THREE.SphereGeometry(.1, 10, 8), '#f5e6c8', M4(0, .11, -.03)], [new THREE.ConeGeometry(.075, .15, 8), '#e8c89a', M4(0, .17, -.09, -.9, 0, 0)], [new THREE.TorusGeometry(.07, .018, 5, 12), '#d6b98c', M4(0, .12, -.02, 0, Math.PI / 2, 0)], [new THREE.SphereGeometry(.055, 8, 6), '#ef4444', M4(0, .06, .07)], ...[-1, 1].flatMap(s => [[new THREE.CylinderGeometry(.008, .008, .07, 4), '#ef4444', M4(s * .025, .12, .1)], [new THREE.SphereGeometry(.014, 6, 4), '#111827', M4(s * .025, .16, .1)], [new THREE.SphereGeometry(.035, 7, 5), '#dc2626', M4(s * .06, .05, .12, 0, 0, 0, 1, .7, 1.3)], [new THREE.CylinderGeometry(.008, .008, .09, 4), '#ef4444', M4(s * .07, .03, .02, 0, 0, s * 1.1)], [new THREE.CylinderGeometry(.008, .008, .09, 4), '#ef4444', M4(s * .07, .03, -.02, 0, 0, s * 1.1)]])], true);
  const im = new THREE.InstancedMesh(cg, M.soft, crabs.length); im.instanceMatrix.setUsage(THREE.DynamicDrawUsage); im.frustumCulled = false; chunkObj(im, 60, false, [tx, tz, 14]);
  nkReg(tx, tz, 45, (dt, t) => {
    crabs.forEach((c, i) => {
      const cx = c.hx + Math.cos(c.a) * c.r, cz = c.hz + Math.sin(c.a) * c.r, d = Math.hypot(P.x - cx, P.z - cz);
      if (d < 3.2 && !P.sneak && c.hide <= 0 && c.wave <= 0) { c.hide = 3.5; fx3(new THREE.Vector3(cx, H(cx, cz) + .6, cz), '！', '#fca5a5'); }
      if (d < 1.6 && P.sneak && c.hide <= 0 && c.wave <= 0) { c.wave = 2; fx3(new THREE.Vector3(cx, H(cx, cz) + .6, cz), '♡', '#f9a8d4'); eggHit('coast_crab', '寄居蟹從殼裡探出頭，對你揮了揮鉗子。'); }
      c.hide -= dt; c.wave -= dt; c.pause -= dt;
      if (c.hide <= 0 && c.wave <= 0) { if (c.pause < -3 - (i % 3)) c.pause = 1 + (i % 2); if (c.pause <= 0) c.a += c.sp * dt / c.r; }
      const yaw = Math.atan2(-Math.sin(c.a) * c.sp, Math.cos(c.a) * c.sp), hid = c.hide > 0, hop = c.wave > 0 ? Math.abs(Math.sin(c.wave * 9)) * .08 : 0;
      NK.m.compose(NK.v.set(cx, H(cx, cz) - (hid ? .06 : 0) + hop, cz), NK.q.setFromEuler(NK.e.set(hid ? .25 : 0, c.wave > 0 ? Math.atan2(P.x - cx, P.z - cz) : yaw + Math.PI / 2 * Math.sign(c.sp), 0)), NK.s.set(1, 1, 1)); im.setMatrixAt(i, NK.m);
    });
    im.instanceMatrix.needsUpdate = true;
  });
}
function nookBoat(M) {
  const kt = nookKit(), [bx, bz] = nw('boat'), yaw = .6;
  regEgg('coast_bottle', '瓶中信', '北邊沙灘上那艘擱淺的小船裡，好像有東西在反光。');
  const SINK = .15, a = kt.at(bx, bz, -SINK, yaw), s = kt.at(bx, bz, 0, yaw), tilt = .55, hull = new THREE.SphereGeometry(1, 18, 8, 0, PI2, Math.PI / 2, Math.PI / 2);
  // 船身側躺、半埋在沙裡（外殼褪色的藍、白色腰線、內側木板、斷掉的桅杆與破帆）；a＝船身的座標（往下埋一點）、s＝旁邊沙地上的東西
  a(M.flat, new THREE.CylinderGeometry(.045, .06, 1.5, 6), '#7a5a3c', 0, .75, .1, tilt, 0, 0); a(M.flat, new THREE.BoxGeometry(1.05, .85, .02), '#f1ede4', .55, .92, .2, tilt + .25, 0, .12); a(M.flat, new THREE.BoxGeometry(1.06, .14, .025), '#e5484d', .55, 1.1, .29, tilt + .25, 0, .12);
  a(M.soft, hull, '#5b84a0', 0, .6, 0, tilt, 0, 0, 2.1, .62, .82); a(M.flat, new THREE.TorusGeometry(1, .05, 5, 36), '#f1f5f9', 0, .6, 0, Math.PI / 2 + tilt, 0, 0, 2.1, .82, 1);
  a(M.flat, new THREE.SphereGeometry(.97, 16, 7, 0, PI2, Math.PI / 2, Math.PI / 2), '#8b6544', 0, .6, 0, tilt, 0, 0, -2.04, .58, .78); // 內側：鏡像
  [[-.5, 1.1], [.7, .9]].forEach(([px, w]) => a(M.flat, new THREE.BoxGeometry(.24, .06, w * 1.3), '#a07850', px, .55, -.08, tilt));
  s(M.flat, new THREE.BoxGeometry(.9, .05, .18), '#7a5a3c', 1.9, .03, 1.2, 0, .7, .06); // 斷掉的木板
  s(M.flat, new THREE.CylinderGeometry(.035, .035, 2, 6), '#a07850', -.6, .04, 1.5, 0, .2, Math.PI / 2); s(M.flat, new THREE.BoxGeometry(.5, .03, .18), '#a07850', -1.65, .04, 1.7, 0, .2, 0); // 船槳
  s(M.flat, new THREE.TorusGeometry(.22, .05, 6, 16), '#d6c7a5', 1.2, .04, -1.3, Math.PI / 2); s(M.flat, new THREE.TorusGeometry(.15, .045, 6, 14), '#d6c7a5', 1.2, .11, -1.3, Math.PI / 2); // 一捲繩子
  s(M.flat, new THREE.BoxGeometry(.5, .4, .45), '#9a7652', -1.7, .17, -1.1, 0, .4, 0); s(M.flat, new THREE.BoxGeometry(.52, .04, .47), '#7a5a3c', -1.7, .38, -1.1, 0, .4, 0);
  // 船頭（船身最高的一端）停著一隻海鷗
  { const gx = 1.85, gy = .82, gz = 0; a(M.soft, new THREE.SphereGeometry(.15, 10, 8), '#f8fafc', gx, gy, gz, 0, 0, 0, 1.4, .9, 1); a(M.soft, new THREE.SphereGeometry(.09, 10, 8), '#f8fafc', gx + .17, gy + .12, gz); a(M.flat, new THREE.ConeGeometry(.025, .1, 5), '#f59e0b', gx + .29, gy + .11, gz, 0, 0, -Math.PI / 2); a(M.flat, new THREE.BoxGeometry(.26, .03, .1), '#94a3b8', gx - .05, gy + .06, gz + .11, .3); a(M.flat, new THREE.BoxGeometry(.26, .03, .1), '#94a3b8', gx - .05, gy + .06, gz - .11, -.3); [-1, 1].forEach(k => a(M.soft, new THREE.SphereGeometry(.012, 5, 4), '#111827', gx + .23, gy + .15, gz + k * .05)); }
  // 瓶子（綠玻璃、軟木塞、裡面捲著一張紙）躺在船底最低的地方
  const BX = -.35, BY = .19, BZ = -.27, bp = new THREE.Vector3(BX, BY, BZ).applyAxisAngle(new THREE.Vector3(0, 1, 0), yaw).add(new THREE.Vector3(bx, H(bx, bz) - SINK, bz)), br = -Math.PI / 2 + .15;
  a(M.soft, new THREE.CylinderGeometry(.06, .06, .2, 10), '#34d399', BX, BY, BZ, 0, 0, br); a(M.soft, new THREE.CylinderGeometry(.025, .035, .08, 8), '#34d399', BX + .14, BY + .02, BZ, 0, 0, br); a(M.flat, new THREE.CylinderGeometry(.026, .026, .04, 6), '#a16207', BX + .19, BY + .03, BZ, 0, 0, br); a(M.flat, new THREE.CylinderGeometry(.03, .03, .13, 6), '#fef3c7', BX, BY, BZ, 0, 0, br);
  kt.done(130);
  const glint = new THREE.Sprite(new THREE.SpriteMaterial({ map: dotTex(), color: '#ecfeff', transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0 })); glint.position.copy(bp).add(new THREE.Vector3(0, .08, 0)); chunkObj(glint, 45, false, [bp.x, bp.z, 1]);
  addCol({ x: bx, z: bz, r: 1.5 });
  const hb = hitBox(.6, .5, .6, bp.x, bp.y, bp.z); W.scene.add(hb);
  addInter(hb, 'nook', 'coast_bottle', '撿起瓶子看看', { act(it) { talk(noteWho('瓶中信', { src: it }), [{ t: '撿到這封信的人：月光谷的史萊姆捏起來，是全世界最療癒的聲音。', sig: '——一個路過的水手' }], { egg: 'coast_bottle' }); foundEgg('coast_bottle'); } }); // 信拿在手上讀
  nkReg(bp.x, bp.z, 45, (dt, t) => { const k = (t % 4.5) / 4.5, f = Math.max(0, Math.sin(k * Math.PI * 6)) * (k < .33 ? 1 : 0); glint.material.opacity = f * .9; glint.scale.setScalar(.25 + f * .45); });
}
function nookArch(M) {
  const kt = nookKit(), [cx, cz] = nw('arch'), rd = seeded(97), top = Math.max(H(cx - 3.8, cz), H(cx + 3.8, cz)) + 5;
  regEgg('coast_arch', '岩拱裡的夕陽', '黃昏時，走到南邊海岸那座岩拱底下看看海。');
  const sand = ['#b8a68f', '#a39077', '#c2b29b', '#ad9a80'];
  // 兩根岩柱（一根踩在沙灘、一根站在淺海裡，從海底一路疊上來）＋拱頂；水線一圈綠色海藻，頂上停著兩隻海鷗
  [-1, 1].forEach(s => { const lx = cx + s * 3.8, gy = H(lx, cz); for (let i = 0, y = gy + .5; y < top; i++, y += 1.2) { const sz = 1.6 - Math.min(i, 4) * .08; kt.add(M.flat, rk(200 + i + (s > 0 ? 10 : 0)), sand[(i + (s > 0 ? 1 : 0)) % 4], M4(lx + (rd() - .5) * .3, y, cz + (rd() - .5) * .3, rd(), rd() * 6, rd(), sz, sz * .95, sz * 1.1)); }
    kt.add(M.flat, new THREE.TorusGeometry(1.45, .22, 5, 14), '#3f6b3a', M4(lx, Math.max(gy, -.9 * K) + .25, cz, Math.PI / 2)); addCol({ x: lx, z: cz, r: 1.5 }); });
  for (let i = 0; i <= 8; i++) { const a = .2 + i / 8 * (Math.PI - .4), x = cx - Math.cos(a) * 3.8, y = top - .4 + Math.sin(a) * 2.4; kt.add(M.flat, rk(230 + i), sand[i % 4], M4(x, y, cz + (rd() - .5) * .25, rd(), rd() * 6, rd(), 1.25 + rd() * .25, 1 + rd() * .2, 1.35)); }
  [[-1.2, .3], [.9, -.2]].forEach(([px, pz]) => { const x = cx + px, y = top + 3.15; kt.add(M.soft, new THREE.SphereGeometry(.15, 10, 8), '#f8fafc', M4(x, y, cz + pz, 0, 0, 0, 1.4, .9, 1)); kt.add(M.soft, new THREE.SphereGeometry(.09, 10, 8), '#f8fafc', M4(x + .17, y + .12, cz + pz)); kt.add(M.flat, new THREE.ConeGeometry(.025, .1, 5), '#f59e0b', M4(x + .29, y + .11, cz + pz, 0, 0, -Math.PI / 2)); kt.add(M.flat, new THREE.BoxGeometry(.26, .03, .1), '#94a3b8', M4(x - .05, y + .06, cz + pz + .1, .3)); });
  for (let i = 0; i < 7; i++) { const x = cx + rnd(-6, 6), z = cz + rnd(-5, 5), s = .3 + rd() * .6; if (Math.abs(x - cx) < 2.6 && Math.abs(z - cz) < 2) continue; kt.add(M.flat, rk(250 + i), sand[i % 4], M4(x, H(x, z) + s * .1, z, rd(), rd() * 6, 0, s * 1.2, s * .7, s)); }
  kt.done(240);
  nkReg(cx, cz, 10, () => { if (Math.abs(P.x - cx) < 2.6 && Math.abs(P.z - cz) < 2 && DN.dusk > .05) eggHit('coast_arch', '從岩拱望出去，整片海都被夕陽染成了橘色。'); });
}
function nookConch(M) {
  const kt = nookKit(), [x, z] = nw('conch'), a = kt.at(x, z, 0, -.5, undefined, 1.7); // 整組放大 1.7 倍：從小徑上一眼就看得到
  regEgg('coast_conch', '會唱歌的大海螺', '海岸小徑旁有一個大海螺，多吹幾次會怎樣呢？');
  a(M.flat, rk(260), '#8b918a', 0, .12, 0, 0, .3, 0, 1, .38, .8);
  // 大海螺：螺身＋尖塔＋幾圈螺紋＋粉紅色的開口
  a(M.soft, new THREE.SphereGeometry(.22, 14, 10), '#f5e6c8', 0, .55, 0, 0, 0, 0, 1.5, 1, 1); a(M.soft, new THREE.ConeGeometry(.17, .38, 12), '#ead6b5', -.42, .58, 0, 0, 0, Math.PI / 2);
  [-.18, -.3, -.42].forEach((px, i) => a(M.flat, new THREE.TorusGeometry(.17 - i * .04, .018, 5, 14), '#d6b98c', px, .57, 0, 0, Math.PI / 2, 0));
  a(M.soft, new THREE.CylinderGeometry(.2, .07, .24, 14, 1, true), '#fbcfe8', .3, .55, 0, 0, 0, -Math.PI / 2 + .2); a(M.soft, new THREE.SphereGeometry(.12, 10, 8), '#f9a8d4', .2, .54, .05, 0, 0, 0, 1, .8, .6);
  kt.done(90); addCol({ x, z, r: 1.3 });
  const st = { n: 0, last: -9 }, MEL = [523.25, 659.25, 783.99, 1046.5], hb = hitBox(2, 1.3, 1.6, x, H(x, z) + .9, z); W.scene.add(hb);
  addInter(hb, 'nook', 'coast_conch', '吹吹大海螺', { act() {
    const t = W.t; st.n = t - st.last < 6 ? st.n + 1 : 1; st.last = t; nkSfx.conch(st.n - 1); fx3(new THREE.Vector3(x, H(x, z) + 1.8, z), st.n >= 3 ? '♪♫♪' : '嗚——', '#a5f3fc');
    if (st.n >= 3) { st.n = 0; MEL.forEach((f, i) => setTimeout(() => nkSfx.bell(f, .8), 350 + i * 180)); setTimeout(() => eggHit('coast_conch', '大海螺唱出了一小段旋律，像是海浪在哼歌。'), 1100); }
  } });
}
/* ---------- 火山：溫泉（溫泉蛋）、黑曜石尖柱林（鏡子裡的倒影）、冷卻的熔岩管（回音） ---------- */
function nookSpring(M) {
  const kt = nookKit(), p = NOOK_DIG[4], [cx, cz] = kk([p.x, p.z]), wy = p.w * K, rf = a => nookR(p, a) * K, rd = seeded(101);
  regEgg('volcano_onsen', '泡溫泉', '火山西邊有個冒著熱氣的池子，走進去泡一下吧。');
  regEgg('volcano_tamago', '溫泉蛋', '溫泉旁吊著一個竹籃……放進去以後，要有耐心等一下下。');
  kt.add(M.water, nookDisc(cx, wy, cz, a => rf(a) * 1.03, ['#1f9fc0', '#a6e6ef']), null); // 帶一點乳白的藍：在火山的橘色天光下才不會變成黃綠色
  // 池邊的黑色玄武岩（水線上結了一圈黃色硫磺），一段竹籬笆
  for (let i = 0; i < 16; i++) { const a = i / 16 * PI2 + rd() * .25, r = rf(a) * (1.05 + rd() * .12), x = cx + Math.cos(a) * r, z = cz + Math.sin(a) * r, s = .35 + rd() * .4, y = Math.max(H(x, z), wy); kt.add(M.flat, rk(300 + i), i % 3 ? '#3a3533' : '#4a4442', M4(x, y + s * .05, z, rd(), rd() * 6, rd() * .3, s * 1.3, s * .75, s)); if (i % 3 === 0) kt.add(M.flat, new THREE.SphereGeometry(s * .5, 7, 4, 0, PI2, 0, Math.PI / 2), '#e8c547', M4(x, y + s * .1, z, 0, 0, 0, 1.4, .22, 1.1)); }
  { const a0 = 3.6; for (let i = 0; i < 9; i++) { const a = a0 + i * .09, r = rf(a) * 1.4, x = cx + Math.cos(a) * r, z = cz + Math.sin(a) * r; kt.add(M.flat, new THREE.CylinderGeometry(.05, .05, 1.3 + (i % 2) * .15, 6), '#a3b86c', M4(x, H(x, z) + .65, z)); }
    const x0 = cx + Math.cos(a0) * rf(a0) * 1.4, z0 = cz + Math.sin(a0) * rf(a0) * 1.4, a1 = a0 + .72, x1 = cx + Math.cos(a1) * rf(a1) * 1.4, z1 = cz + Math.sin(a1) * rf(a1) * 1.4;
    [.45, 1.05].forEach(h => kt.seg(M.flat, new THREE.Vector3(x0, H(x0, z0) + h, z0), new THREE.Vector3(x1, H(x1, z1) + h, z1), .03, '#8a9a58', 5)); }
  // 竹架子吊著裝蛋的籃子（伸到水面上）
  const ta = .9, tx = cx + Math.cos(ta) * rf(ta) * .95, tz = cz + Math.sin(ta) * rf(ta) * .95, ox = cx + Math.cos(ta) * rf(ta) * 1.35, oz = cz + Math.sin(ta) * rf(ta) * 1.35, oy = H(ox, oz);
  kt.seg(M.flat, new THREE.Vector3(ox - .4, oy, oz + .3), new THREE.Vector3(ox, oy + 1.4, oz), .032, '#a3b86c', 6); kt.seg(M.flat, new THREE.Vector3(ox + .4, oy, oz - .3), new THREE.Vector3(ox, oy + 1.4, oz), .032, '#a3b86c', 6);
  kt.seg(M.flat, new THREE.Vector3(ox, oy + 1.36, oz), new THREE.Vector3(tx, wy + .95, tz), .026, '#a3b86c', 6); kt.seg(M.flat, new THREE.Vector3(tx, wy + .95, tz), new THREE.Vector3(tx, wy + .2, tz), .006, '#e7e5e4', 4);
  kt.add(M.flat, new THREE.CylinderGeometry(.2, .15, .2, 10, 1, true), '#c4935a', M4(tx, wy + .1, tz)); kt.add(M.flat, new THREE.TorusGeometry(.2, .02, 4, 12), '#a8743f', M4(tx, wy + .2, tz, Math.PI / 2));
  [[.06, .03], [-.06, .04], [0, -.07]].forEach(([px, pz]) => kt.add(M.flat, new THREE.SphereGeometry(.055, 8, 6), '#fdf6e3', M4(tx + px, wy + .17, tz + pz, 0, 0, 0, 1, 1.25, 1)));
  // 木桶與水勺、疊好的毛巾
  { const a = 2.1, x = cx + Math.cos(a) * rf(a) * 1.3, z = cz + Math.sin(a) * rf(a) * 1.3, y = H(x, z); kt.add(M.flat, new THREE.CylinderGeometry(.22, .19, .3, 12), '#a07850', M4(x, y + .15, z)); kt.add(M.flat, new THREE.TorusGeometry(.215, .015, 4, 14), '#4b5563', M4(x, y + .25, z, Math.PI / 2)); kt.seg(M.flat, new THREE.Vector3(x - .1, y + .2, z), new THREE.Vector3(x + .35, y + .55, z + .1), .015, '#d6b98c', 4); kt.add(M.flat, new THREE.CylinderGeometry(.06, .05, .08, 8), '#d6b98c', M4(x - .12, y + .2, z));
    kt.add(M.flat, new THREE.BoxGeometry(.4, .08, .28), '#fbcfe8', M4(x + .55, y + .05, z - .3, 0, .3, 0)); kt.add(M.flat, new THREE.BoxGeometry(.38, .07, .26), '#f8fafc', M4(x + .55, y + .13, z - .3, 0, .4, 0)); }
  // 「♨ 溫泉」小木牌
  // 立在池子靠小徑那一側、牌面朝外：走過來先看到牌子，池子在牌子後面。柱子與木板併進場景網格（柱子在板子背面），
  // 字是貼在板子正面的一張貼圖（只有一個網格；六面不同材質的箱子會變成六次繪製）
  { const a = .3, x = cx + Math.cos(a) * rf(a) * 1.55, z = cz + Math.sin(a) * rf(a) * 1.55, y = H(x, z), f = Math.atan2(Math.cos(a), Math.sin(a)), b = kt.at(x, z, 0, f);
    b(M.flat, new THREE.CylinderGeometry(.05, .06, 1.4, 6), '#6b4d33', 0, .7, -.08); b(M.flat, new THREE.BoxGeometry(.8, .62, .05), '#7d5c3a', 0, 1.45, 0);
    const tx2 = artTex(256, 200, (c, w, h) => { woodBoard(c, w, h); artText(c, '♨', w / 2, 108, 92, '#fb923c', w - 40); artText(c, '溫泉', w / 2, 172, 46, '#fef3c7', w - 40); });
    const pm = new THREE.Mesh(new THREE.PlaneGeometry(.8, .62), new THREE.MeshStandardMaterial({ map: tx2, roughness: .85 })); pm.position.set(x + Math.sin(f) * .032, y + 1.45, z + Math.cos(f) * .032); pm.rotation.y = f; chunkObj(pm, 70, false, [x, z, 1]); addCol({ x, z, r: .15 }); }
  kt.done(130);
  // 泡在溫泉裡的熔岩史萊姆（頭上頂著一條小毛巾），與慢慢升起的熱氣
  const ba = 4.6, bxp = cx + Math.cos(ba) * rf(ba) * .55, bzp = cz + Math.sin(ba) * rf(ba) * .55;
  const bath = new THREE.Mesh(nookMerge([[toyGeo('#fb923c', true), null], [new THREE.BoxGeometry(.32, .06, .24), '#f8fafc', M4(0, .74, 0, 0, .3, .1)]], true), M.toy); bath.position.set(bxp, wy - .17, bzp); bath.rotation.y = Math.atan2(cx - bxp, cz - bzp) + .4; bath.scale.setScalar(.6); chunkObj(bath, 60, false, [bxp, bzp, 1]);
  const NS = LOW ? 18 : 34, sg = new THREE.BufferGeometry(), sp = new Float32Array(NS * 3), sl = [...Array(NS)].map((_, i) => ({ a: rnd(0, PI2), r: rnd(0, 1) * 4.2, k: i / NS }));
  sg.setAttribute('position', new THREE.BufferAttribute(sp, 3));
  const steam = new THREE.Points(sg, new THREE.PointsMaterial({ size: 2.4, map: dotTex(), color: '#f1f5f9', transparent: true, opacity: .2, depthWrite: false })); steam.frustumCulled = false; chunkObj(steam, 90, false, [cx, cz, 6]);
  const egg = { t0: -1 }, hb = hitBox(.6, .6, .6, tx, wy + .15, tz); W.scene.add(hb);
  addInter(hb, 'nook', 'volcano_tamago', '把蛋放進竹籃', { act() {
    if (egg.t0 < 0) { egg.t0 = W.t; toast('把蛋放進溫泉裡……要等一下下才會好。'); fx3(new THREE.Vector3(tx, wy + .9, tz), '咕嘟咕嘟', '#fde68a'); return; }
    const left = Math.ceil(40 - (W.t - egg.t0)); if (left > 0) { toast(`還沒好，再等 ${left} 秒左右。`); return; }
    egg.t0 = -1; sfx.pop(); fx3(new THREE.Vector3(tx, wy + .9, tz), '熟了！', '#fde68a'); if (!eggHit('volcano_tamago', '溫泉蛋煮好了！蛋白軟嫩、蛋黃濃稠，好香。')) toast('又煮好一顆溫泉蛋，熱呼呼的。');
  } });
  nkReg(cx, cz, 70, (dt, t, d) => {
    for (let i = 0; i < NS; i++) { const o = sl[i]; o.k += dt * .16; if (o.k > 1) { o.k -= 1; o.a = rnd(0, PI2); o.r = Math.sqrt(Math.random()) * 4.2; } sp[i * 3] = cx + Math.cos(o.a) * o.r + Math.sin(o.k * 5 + i) * .4; sp[i * 3 + 1] = wy + .2 + o.k * 3.2; sp[i * 3 + 2] = cz + Math.sin(o.a) * o.r; }
    sg.attributes.position.needsUpdate = true; steam.material.opacity = .14 + DN.night * .06;
    bath.position.y = wy - .17 + Math.sin(t * 1.3) * .025;
    if (d < rf(Math.atan2(P.z - cz, P.x - cx)) * .8) eggHit('volcano_onsen', '泡進溫泉裡……好暖和，連腳趾都放鬆了。');
  });
}
function nookObsidian(M) {
  const kt = nookKit(), [cx, cz] = nw('obsid'), rd = seeded(113), face = Math.atan2(4 * K - cx, -72 * K - cz); // 鏡面朝小徑來的方向
  regEgg('volcano_mirror', '黑曜石裡的倒影', '火山東邊的黑曜石林裡，有一塊磨得像鏡子的石頭，站到它正前方照照看。');
  // 尖柱：六角柱＋尖頂，高高低低、有的歪向一邊；柱腳長出會在夜裡發光的紫色晶簇
  const spire = (x, z, r, h, tx, tz) => { const y = H(x, z) - .3, m = M4(x, y, z, tx, rd() * 6, tz); kt.add(M.obs, new THREE.CylinderGeometry(r * .92, r, h, 6).translate(0, h / 2, 0), rd() < .5 ? '#1c1626' : '#2a2140', m); kt.add(M.obs, new THREE.ConeGeometry(r * .92, r * 1.8, 6).translate(0, h + r * .9, 0), '#3b2d5c', m); };
  for (let i = 0; i < (LOW ? 12 : 18); i++) { const a = i / (LOW ? 12 : 18) * PI2 + rd() * .35, r = 3.4 + rd() * 6.5, x = cx + Math.cos(a) * r, z = cz + Math.sin(a) * r; if (Math.abs(wrapA(Math.atan2(x - cx, z - cz) - face)) < .45 && r < 7) continue; spire(x, z, .3 + rd() * .45, 2 + rd() * 6.5, (rd() - .5) * .45, (rd() - .5) * .45); }
  for (let i = 0; i < 9; i++) { const a = rd() * PI2, r = 2.5 + rd() * 7, x = cx + Math.cos(a) * r, z = cz + Math.sin(a) * r, y = H(x, z); for (let k = 0; k < 4; k++) kt.add(M.night, new THREE.OctahedronGeometry(.12 + rd() * .1, 0), k % 2 ? '#a855f7' : '#c084fc', M4(x + (rd() - .5) * .4, y + .12, z + (rd() - .5) * .4, rd(), rd(), rd(), .7, 1.8, .7)); }
  for (let i = 0; i < 22; i++) { const a = rd() * PI2, r = rd() * 10, x = cx + Math.cos(a) * r, z = cz + Math.sin(a) * r; kt.add(M.obs, new THREE.TetrahedronGeometry(.1 + rd() * .12), '#1c1626', M4(x, H(x, z) + .04, z, rd() * 3, rd() * 3, 0)); }
  // 鏡石：一塊寬大的黑曜石板，正面磨得發亮
  const mx = cx, mz = cz, my = H(mx, mz) - .1, mm = M4(mx, my, mz, 0, face, 0);
  kt.add(M.obs, jit(new THREE.BoxGeometry(1.9, 3, .55, 2, 3, 1), .06, 5).translate(0, 1.5, 0), '#120e1a', mm);
  kt.add(M.obs, new THREE.BoxGeometry(1.5, 2.3, .02).translate(0, 1.65, .29), '#0b0911', mm);
  kt.done(200); addCol({ x: mx, z: mz, r: 1 });
  // 鏡子裡的「倒影」：一張害羞的史萊姆臉（站在正前方、面對它一下子才會慢慢浮現）
  const c = document.createElement('canvas'); c.width = c.height = 256; const g = c.getContext('2d');
  const gr = g.createRadialGradient(128, 150, 6, 128, 150, 120); gr.addColorStop(0, 'rgba(216,180,254,.55)'); gr.addColorStop(1, 'rgba(216,180,254,0)'); g.fillStyle = gr; g.fillRect(0, 0, 256, 256);
  g.fillStyle = 'rgba(233,213,255,.85)'; g.beginPath(); g.moveTo(40, 200); g.bezierCurveTo(36, 120, 80, 70, 128, 70); g.bezierCurveTo(176, 70, 220, 120, 216, 200); g.quadraticCurveTo(128, 226, 40, 200); g.fill();
  g.fillStyle = '#2e1065'; [96, 160].forEach(x => { g.beginPath(); g.ellipse(x, 142, 10, 14, 0, 0, PI2); g.fill(); }); g.strokeStyle = '#2e1065'; g.lineWidth = 5; g.lineCap = 'round'; g.beginPath(); g.arc(128, 160, 16, .25 * Math.PI, .75 * Math.PI); g.stroke();
  g.fillStyle = 'rgba(244,114,182,.6)'; [74, 182].forEach(x => { g.beginPath(); g.ellipse(x, 168, 15, 8, 0, 0, PI2); g.fill(); });
  const ft = new THREE.CanvasTexture(c); ft.colorSpace = THREE.SRGBColorSpace;
  const fm = new THREE.MeshBasicMaterial({ map: ft, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false });
  const fp = new THREE.Mesh(new THREE.PlaneGeometry(1.3, 1.3), fm); fp.position.set(mx + Math.sin(face) * .32, my + 1.7, mz + Math.cos(face) * .32); fp.rotation.y = face; chunkObj(fp, 40, false, [mx, mz, 1]);
  let stare = 0;
  nkReg(mx, mz, 30, (dt, t, d) => {
    const nx = Math.sin(face), nz = Math.cos(face), ox = P.x - mx, oz = P.z - mz, front = (ox * nx + oz * nz) / (Math.hypot(ox, oz) || 1), look = (-Math.sin(P.yaw) * -ox - Math.cos(P.yaw) * -oz) / (Math.hypot(ox, oz) || 1);
    stare = d < 4 && front > .55 && look > .85 ? stare + dt : Math.max(0, stare - dt * 2);
    fm.opacity = smooth(.4, 1.6, stare) * (.75 + Math.sin(t * 2) * .1);
    if (stare > 1.8) eggHit('volcano_mirror', '黑曜石映出來的……怎麼是一張害羞的史萊姆臉？');
  });
}
function nookTube(M) {
  const kt = nookKit(), [cx, cz] = nw('tube'), L = 11, R1 = 2.6, R0 = 2.05, y = H(cx, cz) + .3, rd = seeded(127);
  regEgg('volcano_tube', '熔岩管的回音', '在冷卻的熔岩管裡跳一下，聽聽看。');
  kt.add(M.flat, jit(new THREE.CylinderGeometry(R1, R1 * 1.08, L, 16, 4, true), .1, 9), '#4a3a34', M4(cx, y, cz, 0, 0, Math.PI / 2));
  kt.add(M.flat, jit(new THREE.CylinderGeometry(R0, R0, L, 16, 4, true), .05, 11), '#5a463c', M4(cx, y, cz, 0, 0, Math.PI / 2, 1, 1, -1)); // 內壁
  [-1, 1].forEach(s => { kt.add(M.flat, jit(new THREE.RingGeometry(R0, R1 * 1.08, 16, 1), .08, 13), '#6b5246', M4(cx + s * L / 2, y, cz, 0, s * Math.PI / 2, 0));
    [.5, 2.2].forEach(a => kt.add(M.lamp, new THREE.TorusGeometry((R0 + R1) / 2, .04, 3, 8, .7), '#d9541e', M4(cx + s * (L / 2 + .07), y, cz, 0, s * Math.PI / 2, a))); }); // 洞口邊緣還在發紅的裂縫
  // 洞口崩落的石塊、內壁一道道還帶著餘溫的裂縫、垂下來的熔岩鐘乳石、深處發光的晶簇
  for (let i = 0; i < 10; i++) { const s = i % 2 ? 1 : -1, x = cx + s * (L / 2 + .4 + rd() * 1.6), z = cz + (rd() - .5) * 5, sz = .3 + rd() * .5; kt.add(M.flat, rk(330 + i), '#3f3a38', M4(x, H(x, z) + sz * .2, z, rd(), rd() * 6, 0, sz * 1.2, sz * .8, sz)); }
  for (let i = 0; i < 7; i++) { const a = .5 + rd() * 2.1, x = cx - L / 2 + 1 + rd() * (L - 2); kt.add(M.lamp, new THREE.BoxGeometry(1.2 + rd() * 1.4, .035, .035), '#b4441a', M4(x, y + Math.sin(a) * (R0 - .03), cz + Math.cos(a) * (R0 - .03), a, 0, 0)); }
  for (let i = 0; i < 6; i++) { const x = cx - L / 2 + 1.5 + i * 1.6, h = .15 + rd() * .2, dz = (rd() < .5 ? -1 : 1) * (.5 + rd() * .5); kt.add(M.flat, new THREE.ConeGeometry(.07, h, 5), '#3a2c28', M4(x, y + Math.sqrt(R0 * R0 - dz * dz) - h / 2 + .03, cz + dz, Math.PI, 0, 0)); }
  const my = H(cx, cz); for (let k = 0; k < 6; k++) kt.add(M.lamp, new THREE.OctahedronGeometry(.1 + rd() * .08, 0), k % 2 ? '#fb923c' : '#fdba74', M4(cx + 1.2 + (rd() - .5) * .5, my + .12, cz - 1.25 + (rd() - .5) * .4, rd(), rd(), 0, .7, 1.8, .7));
  kt.done(110);
  const sl = new THREE.Mesh(toyGeo('#ff7a59', true), M.toy); sl.position.set(cx + .6, my + .02, cz - 1.15); sl.rotation.y = -.3; sl.scale.setScalar(.55); chunkObj(sl, 50, false, [cx, cz, 2]);
  addCol({ box: [cx - L / 2, cz + 1.8, cx + L / 2, cz + R1 + .3] }); addCol({ box: [cx - L / 2, cz - R1 - .3, cx + L / 2, cz - 1.8] });
  let zz = 0;
  nkReg(cx, cz, 30, (dt, t, d) => {
    const inside = Math.abs(P.x - cx) < L / 2 - .3 && Math.abs(P.z - cz) < 1.8;
    if (inside && NK.jumped) { nkSfx.echo(); fx3(new THREE.Vector3(P.x, P.y + 2.2, P.z), '哈囉——囉——囉——', '#fdba74'); eggHit('volcano_tube', '熔岩管把你的聲音一路傳到了好遠好遠。'); }
    if (d < 5 && (zz -= dt) < 0) { zz = 2.4; fx3(new THREE.Vector3(sl.position.x, my + .8, sl.position.z), 'Zzz', '#fdba74'); }
    sl.scale.y = .55 * (1 + Math.sin(t * 1.5) * .05);
  });
}
/* ---------- 雪原：冰湖釣客的營地（冰屋、雪人一家、冰下的魚）、冰柱瀑布（冰柱音階） ---------- */
function nookLake(M) {
  const kt = nookKit(), p = NOOK_DIG[5], [cx, cz] = kk([p.x, p.z]), iy = p.w * K + .03, rf = a => nookR(p, a) * K, rd = seeded(141);
  regEgg('snow_fish', '冰下的魚', '在結冰的湖面上連跳幾下，冰底下好像有誰在看你。');
  regEgg('snow_igloo', '冰屋裡的午睡', '冰湖邊有一間小冰屋，輕輕走進去看看。');
  regEgg('snow_turn', '會轉頭的雪人', '冰湖邊的雪人一家，最小的那個好像會偷看人？背對它一下再回頭。');
  // 冰面：中心偏藍、岸邊偏白，加上一塊塊被風吹出來的霜
  const c0 = new THREE.Color('#5ea9d6'), c1 = new THREE.Color('#c2e3f4'), cw = new THREE.Color('#ffffff');
  kt.add(M.ice, nookDisc(cx, iy, cz, a => rf(a) * 1.02, null, LOW ? 40 : 56, LOW ? 3 : 5, (x, z, r, c) => c.copy(c0).lerp(c1, smooth(.25, 1, r)).lerp(cw, smooth(.55, .8, fbm(x * .3, z * .3, 9)) * .45)), null);
  for (let i = 0; i < 9; i++) { const a = rd() * PI2, r = rf(a) * (.2 + rd() * .7), x = cx + Math.cos(a) * r, z = cz + Math.sin(a) * r; kt.add(M.soft, new THREE.SphereGeometry(.6 + rd() * .9, 10, 6), '#f8fafc', M4(x, iy - .02, z, 0, rd() * 6, 0, 1, .05, .6 + rd() * .5)); }
  // 冰釣洞：深藍的水、一圈碎冰、小板凳、釣竿與釣線、裝著魚的水桶
  const [hx, hz] = kk([-136.2, -43]);
  kt.add(M.flat, new THREE.CircleGeometry(.5, 18).rotateX(-Math.PI / 2), '#12324f', M4(hx, iy + .012, hz));
  for (let i = 0; i < 9; i++) { const a = i / 9 * PI2; kt.add(M.flat, rk(360 + i), '#dbeafe', M4(hx + Math.cos(a) * .62, iy + .04, hz + Math.sin(a) * .62, rd(), rd() * 6, 0, .18, .09, .14)); }
  const st = kt.at(hx + .95, hz + .55, 0, -2.2, iy); st(M.flat, new THREE.CylinderGeometry(.2, .2, .05, 10), '#8b6544', 0, .42, 0); [0, 2.1, 4.2].forEach(a => st(M.flat, new THREE.CylinderGeometry(.025, .025, .42, 5), '#6b4d33', Math.cos(a) * .13, .2, Math.sin(a) * .13));
  kt.seg(M.flat, new THREE.Vector3(hx + .9, iy + .5, hz + .45), new THREE.Vector3(hx + .1, iy + 1.35, hz + .05), .02, '#7c5a3a', 5, .012); kt.seg(M.flat, new THREE.Vector3(hx + .1, iy + 1.35, hz + .05), new THREE.Vector3(hx + .05, iy - .3, hz + .02), .004, '#e2e8f0', 3);
  kt.add(M.flat, new THREE.CylinderGeometry(.16, .13, .28, 10), '#64748b', M4(hx + 1.05, iy + .14, hz - .45)); kt.add(M.flat, new THREE.ConeGeometry(.07, .14, 4), '#fb923c', M4(hx + 1.05, iy + .32, hz - .45, 0, 0, Math.PI, 1.2, 1, .4));
  // 冰屋：雪磚一層層堆成圓頂（外面亮白、裡面點著燭光很暖），入口通道朝向湖面
  const [ix, iz] = nw('igloo'), face = Math.atan2(cx - ix, cz - iz), gy = NOOK_DIG[7].w * K, a = kt.at(ix, iz, 0, face, gy), R = 2.7, GAP = .62; // GAP：門洞左右各留多少弧度
  // 下面兩層在入口方向（區域 +z，SphereGeometry 的 φ＝π/2）留一個門洞；上面兩層是完整的圓頂
  const band = (mat, r, t0, t1, col, mir, n = 3) => { const open = t1 > .8, g = new THREE.SphereGeometry(r, 20, n, open ? Math.PI / 2 + GAP : 0, open ? PI2 - GAP * 2 : PI2, t0, t1 - t0); a(mat, g, col, 0, -.05, 0, 0, 0, 0, mir ? -1 : 1, 1, 1); };
  [[0, .38], [.38, .76], [.76, 1.15], [1.15, Math.PI / 2]].forEach(([t0, t1], i) => { band(M.soft, R, t0, t1, i % 2 ? '#e6edf5' : '#f8fafc'); band(M.warm, R - .12, t0, t1, '#cfdbe8', true, 2); }); // 外牆＋內壁（鏡像）
  for (let i = 0; i < 3; i++) { const th = .38 * (i + 1), low = i === 2; a(M.flat, new THREE.TorusGeometry(R * Math.sin(th) + .01, .025, 3, 32, low ? PI2 - GAP * 2 : PI2), '#cbd5e1', 0, R * Math.cos(th) - .05, 0, Math.PI / 2, 0, low ? Math.PI / 2 + GAP : 0); }
  const TW = 1.25, TL = 1.6, TZ = R - .8;
  [-1, 1].forEach(s => { a(M.soft, new THREE.BoxGeometry(.3, .62, TL), '#f1f5f9', s * (TW + .15), .26, TZ + TL / 2); a(M.warm, new THREE.BoxGeometry(.05, .62, TL), '#cfdbe8', s * (TW - .02), .26, TZ + TL / 2); });
  a(M.soft, new THREE.CylinderGeometry(TW + .3, TW + .3, TL, 14, 1, true, Math.PI / 2, Math.PI), '#f1f5f9', 0, .57, TZ + TL / 2, Math.PI / 2, 0, 0);
  a(M.warm, new THREE.CylinderGeometry(TW, TW, TL, 14, 1, true, Math.PI / 2, Math.PI), '#cfdbe8', 0, .57, TZ + TL / 2, Math.PI / 2, 0, 0, -1, 1, 1);
  // 屋裡：毛毯、蓋著小被子睡覺的冰晶史萊姆、蠟燭、馬克杯
  a(M.warm, new THREE.CylinderGeometry(1.3, 1.3, .03, 18), '#c08457', 0, .02, -.2); a(M.warm, new THREE.BoxGeometry(.7, .14, .45), '#f9a8d4', -.25, .09, -.75);
  a(M.warm, new THREE.CylinderGeometry(.05, .05, .2, 8), '#fef9c3', .7, .12, -.3); a(M.lamp, new THREE.ConeGeometry(.03, .09, 6), '#fbbf24', .7, .27, -.3);
  a(M.warm, new THREE.CylinderGeometry(.06, .055, .11, 10), '#ef4444', .55, .07, .1); a(M.warm, new THREE.TorusGeometry(.035, .01, 4, 8), '#ef4444', .62, .08, .1);
  // 營火、雪橇與提燈、從冰屋走到冰釣洞的腳印
  const fpos = new THREE.Vector3(-3.3, 0, 1.2).applyAxisAngle(new THREE.Vector3(0, 1, 0), face).add(new THREE.Vector3(ix, 0, iz)), fyy = H(fpos.x, fpos.z); addCol({ x: fpos.x, z: fpos.z, r: .55 });
  for (let i = 0; i < 8; i++) { const b = i / 8 * PI2; kt.add(M.flat, rk(380 + i), '#6b7280', M4(fpos.x + Math.cos(b) * .5, fyy + .06, fpos.z + Math.sin(b) * .5, 0, b, 0, .16, .12, .14)); }
  [0, 1, 2].forEach(i => kt.add(M.flat, new THREE.CylinderGeometry(.05, .05, .7, 6), '#6b4d33', M4(fpos.x, fyy + .1, fpos.z, 0, i * 1.05, Math.PI / 2 - .25)));
  kt.add(M.lamp, new THREE.ConeGeometry(.2, .45, 7), '#f97316', M4(fpos.x, fyy + .32, fpos.z)); kt.add(M.lamp, new THREE.ConeGeometry(.11, .3, 6), '#fde047', M4(fpos.x + .03, fyy + .3, fpos.z));
  const sd = new THREE.Vector3(3.1, 0, 1.5).applyAxisAngle(new THREE.Vector3(0, 1, 0), face).add(new THREE.Vector3(ix, 0, iz)), s2 = kt.at(sd.x, sd.z, 0, face + 1.4); addCol({ x: sd.x, z: sd.z, r: .55 });
  [-1, 1].forEach(s => { s2(M.flat, new THREE.BoxGeometry(1.4, .05, .05), '#991b1b', 0, .06, s * .3); s2(M.flat, new THREE.TorusGeometry(.14, .025, 4, 8, Math.PI / 2), '#991b1b', .7, .2, s * .3); });
  [-.45, -.1, .25].forEach(px => s2(M.flat, new THREE.BoxGeometry(.24, .05, .72), '#b45309', px, .2, 0));
  s2(M.flat, new THREE.BoxGeometry(.18, .22, .18), '#334155', -.3, .35, 0); s2(M.lamp, new THREE.BoxGeometry(.12, .14, .12), '#fde68a', -.3, .36, 0);
  { const from = new THREE.Vector3(0, 0, TZ + TL + .3).applyAxisAngle(new THREE.Vector3(0, 1, 0), face).add(new THREE.Vector3(ix, 0, iz)), to = new THREE.Vector3(hx + .7, 0, hz + .6), n = 14, dir = Math.atan2(to.x - from.x, to.z - from.z);
    for (let i = 0; i < n; i++) { const k = i / (n - 1), x = from.x + (to.x - from.x) * k + Math.cos(dir) * (i % 2 ? .13 : -.13), z = from.z + (to.z - from.z) * k - Math.sin(dir) * (i % 2 ? .13 : -.13); kt.add(M.flat, new THREE.SphereGeometry(.07, 6, 4), '#a9bfd4', M4(x, Math.max(H(x, z), iy) + .005, z, 0, dir, 0, 1, .12, 1.6)); } }
  // 雪人一家：爸爸戴高帽、媽媽戴紅毛帽，最小的那個的頭另外做（會偷偷轉頭）
  const [sx, sz] = nw('snowmen'), sf = Math.atan2(cx - sx, cz - sz), sy0 = NOOK_DIG[8].w * K;
  const man = (ox, s, hat, scarf, head = true) => { const b = kt.at(sx + Math.cos(sf) * ox, sz - Math.sin(sf) * ox, 0, sf, sy0); b(M.soft, new THREE.SphereGeometry(.6 * s, 16, 12), '#f8fafc', 0, .5 * s, 0); b(M.soft, new THREE.SphereGeometry(.44 * s, 16, 12), '#f1f5f9', 0, 1.25 * s, 0); b(M.flat, new THREE.TorusGeometry(.33 * s, .07 * s, 6, 16), scarf, 0, 1.55 * s, 0, Math.PI / 2); b(M.flat, new THREE.BoxGeometry(.13 * s, .4 * s, .05 * s), scarf, .16 * s, 1.36 * s, .3 * s, 0, 0, .2);
    [0, 1, 2].forEach(i => b(M.flat, new THREE.SphereGeometry(.035 * s, 6, 5), '#111827', 0, (1.1 + i * .13) * s, (.43 - i * .02) * s)); [-1, 1].forEach(k => kt.seg(M.flat, new THREE.Vector3(sx + Math.cos(sf) * (ox + k * .4 * s), sy0 + 1.3 * s, sz - Math.sin(sf) * (ox + k * .4 * s)), new THREE.Vector3(sx + Math.cos(sf) * (ox + k * 1 * s), sy0 + 1.75 * s, sz - Math.sin(sf) * (ox + k * 1 * s)), .025, '#5b4030', 5));
    if (!head) return; b(M.soft, new THREE.SphereGeometry(.32 * s, 16, 12), '#f8fafc', 0, 1.82 * s, 0); [-1, 1].forEach(k => b(M.flat, new THREE.SphereGeometry(.035 * s, 6, 5), '#111827', k * .1 * s, 1.9 * s, .28 * s)); b(M.flat, new THREE.ConeGeometry(.05 * s, .28 * s, 8), '#f97316', 0, 1.82 * s, .42 * s, Math.PI / 2);
    if (hat === 'top') { b(M.flat, new THREE.CylinderGeometry(.21 * s, .23 * s, .34 * s, 14), '#1f2937', 0, 2.22 * s, 0); b(M.flat, new THREE.CylinderGeometry(.34 * s, .34 * s, .03 * s, 16), '#1f2937', 0, 2.07 * s, 0); b(M.flat, new THREE.CylinderGeometry(.235 * s, .235 * s, .06 * s, 14), '#b91c1c', 0, 2.12 * s, 0); }
    else { b(M.soft, new THREE.SphereGeometry(.3 * s, 14, 6, 0, PI2, 0, Math.PI / 2), hat, 0, 1.98 * s, 0); b(M.soft, new THREE.SphereGeometry(.08 * s, 8, 6), '#ffffff', 0, 2.3 * s, 0); } };
  man(-1.3, 1.15, 'top', '#2563eb'); man(0, 1, '#ef4444', '#16a34a'); man(1.1, .72, null, '#f59e0b', false);
  kt.done(150);
  // 小雪人的頭（藍色毛帽、紅臉頰），中心點在頭的正中央
  const s = .72, hx2 = sx + Math.cos(sf) * 1.1, hz2 = sz - Math.sin(sf) * 1.1, hy2 = sy0 + 1.82 * s;
  const head = new THREE.Mesh(nookMerge([[new THREE.SphereGeometry(.32 * s, 16, 12), '#f8fafc'], ...[-1, 1].flatMap(k => [[new THREE.SphereGeometry(.035 * s, 6, 5), '#111827', M4(k * .1 * s, .08 * s, .28 * s)], [new THREE.SphereGeometry(.05 * s, 6, 5), '#fda4af', M4(k * .19 * s, -.02 * s, .24 * s, 0, 0, 0, 1, .6, .5)]]), [new THREE.ConeGeometry(.05 * s, .28 * s, 8), '#f97316', M4(0, 0, .42 * s, Math.PI / 2)], [new THREE.SphereGeometry(.3 * s, 14, 6, 0, PI2, 0, Math.PI / 2), '#60a5fa', M4(0, .16 * s, 0)], [new THREE.TorusGeometry(.29 * s, .04 * s, 5, 16), '#93c5fd', M4(0, .17 * s, 0, Math.PI / 2)], [new THREE.SphereGeometry(.08 * s, 8, 6), '#ffffff', M4(0, .48 * s, 0)]], true), M.soft);
  head.position.set(hx2, hy2, hz2); head.rotation.y = sf; head.castShadow = !LOW; chunkObj(head, 90, false, [hx2, hz2, 1]);
  [[-1.3, .7], [0, .6], [1.1, .45]].forEach(([ox, r]) => addCol({ x: sx + Math.cos(sf) * ox, z: sz - Math.sin(sf) * ox, r }));
  // 冰屋的牆：一圈碰撞圓，入口那一側留空；通道兩側也擋起來
  for (let i = 0; i < 18; i++) { const b = i / 18 * PI2; if (Math.abs(wrapA(b)) < .5) continue; const lx = Math.sin(b) * (R - .1), lz = Math.cos(b) * (R - .1); addCol({ x: ix + lx * Math.cos(face) + lz * Math.sin(face), z: iz - lx * Math.sin(face) + lz * Math.cos(face), r: .4 }); }
  [-1, 1].forEach(sg => [TZ + .3, TZ + TL - .2].forEach(lz => { const lx = sg * (TW + .2); addCol({ x: ix + lx * Math.cos(face) + lz * Math.sin(face), z: iz - lx * Math.sin(face) + lz * Math.cos(face), r: .3 }); }));
  // 冰屋裡睡午覺的冰晶史萊姆
  const nap = new THREE.Mesh(toyGeo('#bae6fd', true), M.toy), np = new THREE.Vector3(-.25, 0, -.95).applyAxisAngle(new THREE.Vector3(0, 1, 0), face);
  nap.position.set(ix + np.x, gy + .05, iz + np.z); nap.rotation.y = face; nap.scale.setScalar(.6); chunkObj(nap, 50, false, [ix, iz, 3]);
  // 冰下的魚：平常在湖裡繞大圈，連跳三下就會游過來圍著你
  const fg = nookMerge([[new THREE.SphereGeometry(.13, 8, 5), '#1e3a5f', M4(0, 0, 0, 0, 0, 0, 1, .28, 2.4)], [new THREE.ConeGeometry(.12, .2, 3), '#1e3a5f', M4(0, 0, -.38, -Math.PI / 2, 0, 0, 1, .25, 1)]], true);
  const fish = new THREE.InstancedMesh(fg, M.flat, 3); fish.instanceMatrix.setUsage(THREE.DynamicDrawUsage); fish.frustumCulled = false; chunkObj(fish, 70, false, [cx, cz, 12]);
  const F = [0, 1, 2].map(i => ({ a: i * 2.1, r: 4 + i * 1.6, sp: .35 + i * .08 })), fy = p.w * K - .07, sm = { yaw: 0 }, jump = { n: 0, last: -9, come: 0 };
  let zz = 0;
  nkReg(cx, cz, 60, (dt, t, d) => {
    const onIce = d < rf(Math.atan2(P.z - cz, P.x - cx)) * .92;
    if (onIce && NK.jumped) { jump.n = t - jump.last < 6 ? jump.n + 1 : 1; jump.last = t; if (jump.n >= 3) { jump.come = 9; eggHit('snow_fish', '冰底下的魚群游了過來，隔著冰面好奇地看著你。'); } }
    jump.come -= dt; const near = jump.come > 0 && onIce;
    F.forEach((f, i) => {
      f.a += f.sp * dt * (near ? 3 : 1) / (near ? 1 : f.r * .25); const ox = near ? P.x : cx, oz = near ? P.z : cz, rr = near ? .9 + i * .35 : f.r;
      const x = ox + Math.cos(f.a) * rr, z = oz + Math.sin(f.a) * rr, yaw = Math.atan2(-Math.sin(f.a), Math.cos(f.a));
      NK.m.compose(NK.v.set(x, fy, z), NK.q.setFromEuler(NK.e.set(0, yaw + Math.sin(t * 6 + i) * .15, 0)), NK.s.set(1, 1, 1)); fish.setMatrixAt(i, NK.m);
    });
    fish.instanceMatrix.needsUpdate = true;
    // 冰屋：走進去就看得到在睡午覺的史萊姆
    const dIg = Math.hypot(P.x - ix, P.z - iz); nap.scale.y = .6 * (1 + Math.sin(t * 1.4) * .05);
    if (dIg < 1.9) eggHit('snow_igloo', '冰屋裡出乎意料地暖和，一隻冰晶史萊姆蓋著小被子，睡得正香。');
    if (dIg < 4 && (zz -= dt) < 0) { zz = 2.3; fx3(new THREE.Vector3(nap.position.x, gy + .9, nap.position.z), 'Zzz', '#bae6fd'); }
    // 小雪人：沒被盯著看的時候，偷偷把頭轉向你；被你看著就不動
    const ds = Math.hypot(P.x - hx2, P.z - hz2), toP = wrapA(Math.atan2(P.x - hx2, P.z - hz2) - sf), vx = hx2 - P.x, vz = hz2 - P.z, look = (-Math.sin(P.yaw) * vx - Math.cos(P.yaw) * vz) / (Math.hypot(vx, vz) || 1);
    if (look < .45) sm.yaw += clamp(wrapA((ds < 18 ? clamp(toP, -2.6, 2.6) : 0) - sm.yaw), -dt * 1.5, dt * 1.5);
    head.rotation.y = sf + sm.yaw;
    if (look > .9 && ds < 15 && Math.abs(wrapA(toP - sm.yaw)) < .35 && Math.abs(sm.yaw) > .9 && eggHit('snow_turn', '……剛剛那個小雪人，是不是轉頭看了你一眼？')) fx3(new THREE.Vector3(hx2, hy2 + .5, hz2), '？！', '#bae6fd');
  });
}
function nookFalls(M) {
  const kt = nookKit(), z0 = NOOK.falls[1] * K, rd = seeded(151);
  regEgg('snow_icicle', '冰柱音階', '西邊懸崖結冰的瀑布下，有一排冰柱，每一根都敲敲看。');
  // 冰瀑：沿著山坡往下的一片冰，中間鼓起幾道冰柱的紋路；頂端的岩唇垂著冰錐
  { const NX = 24, NZ = 8, x0 = -171.4 * K, x1 = -160.6 * K, pos = [], col = [], cA = new THREE.Color('#dff3ff'), cB = new THREE.Color('#6fbbe6'), c = new THREE.Color();
    const V = (i, j) => { const u = i / NX, v = j / NZ - .5, x = x0 + (x1 - x0) * u, w = (3 + 2 * u) * K, z = z0 + v * w, bul = (Math.cos(v * Math.PI) * .4 + Math.sin(j * 1.9 + i * .35) * .07) * (1 - Math.abs(v) * 1.7); c.copy(cA).lerp(cB, (j % 2) * .55 + .25 * Math.sin(i * .8 + j)); return [x, H(x, z) + .22 + bul, z, c.r, c.g, c.b]; };
    for (let i = 0; i < NX; i++) for (let j = 0; j < NZ; j++) { const A = V(i, j), B = V(i, j + 1), C = V(i + 1, j), D = V(i + 1, j + 1); [A, B, C, C, B, D].forEach(q => { pos.push(q[0], q[1], q[2]); col.push(q[3], q[4], q[5]); }); }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3)); kt.add(M.ice, g, null);
    for (let i = 0; i < 12; i++) { const z = z0 + (rd() - .5) * 2.2 * K, x = x0 + .2, y = H(x, z), l = .5 + rd() * .9; kt.add(M.ice, new THREE.ConeGeometry(.08 + rd() * .06, l, 6), '#dff4ff', M4(x + .25, y - .1 - l / 2 + .3, z, Math.PI, 0, 0)); }
    for (let i = 0; i < 7; i++) { const z = z0 + (i / 6 - .5) * 3.4 * K, x = x0 - .8, y = H(x, z); kt.add(M.flat, rk(400 + i), '#7f8c9e', M4(x, y, z, rd(), rd() * 6, 0, .9 + rd() * .5, .7, .9)); kt.add(M.soft, new THREE.SphereGeometry(.9, 10, 5, 0, PI2, 0, Math.PI / 2), '#f8fafc', M4(x, y + .35, z, 0, 0, 0, 1.1, .35, 1)); } }
  // 瀑布下結冰的水潭
  { const p = NOOK_DIG[6], [cx, cz] = kk([p.x, p.z]), rf = a => nookR(p, a) * K;
    kt.add(M.ice, nookDisc(cx, p.w * K + .03, cz, a => rf(a) * 1.02, ['#5ea9d6', '#c8e6f5'], 32, 2), null);
    for (let i = 0; i < 8; i++) { const a = i / 8 * PI2 + rd() * .4, r = rf(a) * 1.15, x = cx + Math.cos(a) * r, z = cz + Math.sin(a) * r, s = .3 + rd() * .35; kt.add(M.flat, rk(420 + i), '#8492a6', M4(x, H(x, z), z, rd(), rd() * 6, 0, s * 1.2, s * .7, s)); kt.add(M.soft, new THREE.SphereGeometry(s, 8, 4, 0, PI2, 0, Math.PI / 2), '#f8fafc', M4(x, H(x, z) + s * .45, z, 0, 0, 0, 1.15, .4, 1.05)); } }
  // 掛著冰柱的大岩石：上面一塊突出的石板，冰柱從石板邊緣垂下來（敲得到的高度）
  const [bx, bz] = nw('icicle'), by = H(bx, bz), b = kt.at(bx, bz, 0, 0, by);
  b(M.flat, rk(440), '#7f8c9e', -.6, 1.1, 0, .2, .5, 0, 1.5, 1.3, 1.5); b(M.flat, jit(new THREE.BoxGeometry(2.8, .38, 2.2, 3, 1, 3), .08, 3), '#8a97a8', .2, 2.45, 0); b(M.soft, new THREE.BoxGeometry(2.7, .1, 2.1), '#f8fafc', .2, 2.68, 0);
  kt.done(200); addCol({ x: bx - .6, z: bz, r: 1.5 });
  const IC = [1.05, .8, 1.25, .9, 1.15], NT = [523.25, 587.33, 659.25, 783.99, 880], ig = nookMerge([[new THREE.ConeGeometry(.1, 1, 7).rotateX(Math.PI).translate(0, -.5, 0), '#e0f7ff']], true);
  const ice = new THREE.InstancedMesh(ig, M.ice, 5); ice.instanceMatrix.setUsage(THREE.DynamicDrawUsage); chunkObj(ice, 60, false, [bx, bz, 3]);
  const top = by + 2.26, ex = bx + 1.45, wob = [0, 0, 0, 0, 0], tap = [-99, -99, -99, -99, -99];
  const put = (i, t) => { NK.m.compose(NK.v.set(ex, top, bz + (i - 2) * .42), NK.q.setFromEuler(NK.e.set(Math.sin(t * 31 + i) * wob[i] * .12, 0, Math.sin(t * 27 + i) * wob[i] * .12)), NK.s.set(1, IC[i], 1)); ice.setMatrixAt(i, NK.m); ice.instanceMatrix.needsUpdate = true; };
  IC.forEach((l, i) => { put(i, 0); const hb = hitBox(.32, l, .32, ex, top - l / 2, bz + (i - 2) * .42); W.scene.add(hb);
    addInter(hb, 'nook', 'snow_icicle', '敲敲冰柱', { act() { const t = W.t; nkSfx.bell(NT[i]); wob[i] = 1; tap[i] = t; fx3(new THREE.Vector3(ex, top + .4, bz + (i - 2) * .42), '♪', '#bae6fd'); if (tap.every(v => t - v < 15)) { tap.fill(-99); NT.forEach((f, k) => setTimeout(() => nkSfx.bell(f, .7), 300 + k * 150)); setTimeout(() => eggHit('snow_icicle', '五根冰柱叮叮噹噹，連成了一段好聽的音階。'), 1100); } } }); });
  nkReg(bx, bz, 30, (dt, t) => { for (let i = 0; i < 5; i++) if (wob[i] > 0) { wob[i] = Math.max(0, wob[i] - dt * 1.5); put(i, t); } });
}
/* ---------- 小徑沿途：每段路都有一兩個小東西可以看（信箱、史萊姆地藏、柴堆、漁網、警告牌、雪地提燈…）＋路邊的石頭 ---------- */
// 沿著 PATH_LINES 第 li 條走 arc 公尺、往左（side=1）或右偏 off 公尺的位置，與面向小徑的角度
function trailAt(li, arc, side, off) {
  const pts = crPts(PATH_LINES[li], 10); let acc = 0;
  for (let i = 1; i < pts.length; i++) {
    const [ax, az] = pts[i - 1], [bx, bz] = pts[i], d = Math.hypot(bx - ax, bz - az); if (acc + d < arc && i < pts.length - 1) { acc += d; continue; }
    const k = clamp((arc - acc) / d, 0, 1), px = ax + (bx - ax) * k, pz = az + (bz - az) * k, nx = -(bz - az) / d * side, nz = (bx - ax) / d * side;
    return { x: px + nx * off, z: pz + nz * off, face: Math.atan2(-nx, -nz) };
  }
  return null;
}
function buildTrails(M) {
  // 每一區各自合併成一組網格（整張地圖只用一組的話，包圍盒太大，cullChunks 永遠剔除不掉）
  const kits = {}, kitAt = (x, z) => { const k = Math.max(Math.abs(x), Math.abs(z)) / K < 42 ? 'plain' : domBiome(x, z); return kits[k] || (kits[k] = nookKit()); }, rd = seeded(171), band = (x, z) => { const r = Math.max(Math.abs(x), Math.abs(z)) / K; return r > 41 && r < 68.5; };
  const free = (x, z, r) => { for (const c of colsNear(x, z)) { const d = c.box ? Math.hypot(x - clamp(x, c.box[0], c.box[2]), z - clamp(z, c.box[1], c.box[3])) : Math.hypot(x - c.x, z - c.z) - c.r; if (d < r) return false; } return !nookAvoid(x, z) && !band(x, z); };
  const ITEM = {
    mailbox(a) { a(M.flat, new THREE.BoxGeometry(.1, 1.1, .1), '#6b4d33', 0, .55, -.1); a(M.flat, new THREE.BoxGeometry(.34, .3, .5), '#dc2626', 0, 1.2, -.05); a(M.flat, new THREE.CylinderGeometry(.17, .17, .5, 10, 1, false, 0, Math.PI), '#dc2626', 0, 1.35, -.05, Math.PI / 2, 0, Math.PI / 2); a(M.flat, new THREE.BoxGeometry(.03, .22, .06), '#facc15', .19, 1.4, -.15); a(M.flat, new THREE.BoxGeometry(.03, .06, .14), '#facc15', .19, 1.5, -.08); a(M.flat, new THREE.BoxGeometry(.2, .12, .02), '#fef3c7', 0, 1.24, .21); return .4; },
    pots(a) { [[-.35, 0, .3, '#f472b6'], [.1, .15, .24, '#fde047'], [.45, -.1, .28, '#a78bfa']].forEach(([x, z, r, c]) => { a(M.flat, new THREE.CylinderGeometry(r, r * .78, r * 1.1, 10), '#c2703d', x, r * .55, z); a(M.flat, new THREE.CylinderGeometry(r * .92, r * .92, .03, 10), '#5b4030', x, r * 1.1, z); for (let k = 0; k < 5; k++) a(M.soft, new THREE.SphereGeometry(.06, 6, 4), k % 2 ? c : '#ffffff', x + Math.cos(k * 1.26) * r * .45, r * 1.25, z + Math.sin(k * 1.26) * r * .45); }); return .7; },
    jizo(a) { a(M.flat, rk(500), '#9ca3af', 0, .12, 0, 0, 0, 0, .5, .2, .45); a(M.soft, new THREE.SphereGeometry(.32, 14, 10), '#a8b0b8', 0, .55, 0, 0, 0, 0, 1, .82, .95); [-1, 1].forEach(s => a(M.soft, new THREE.SphereGeometry(.035, 8, 6), '#4b5563', s * .1, .63, .28)); a(M.flat, new THREE.CylinderGeometry(.27, .33, .16, 10, 1, true, -.9, 1.8), '#dc2626', 0, .44, .02); a(M.soft, new THREE.SphereGeometry(.07, 8, 6), '#6ee7a8', .3, .3, .25); a(M.flat, new THREE.CylinderGeometry(.08, .06, .05, 10), '#e7e5e4', .3, .25, .25); [-.32, .36].forEach(x => a(M.soft, new THREE.SphereGeometry(.05, 6, 4), '#fde047', x, .27, .18)); return .45; },
    cairn(a) { let y = 0; [[.42, .14], [.34, .13], [.27, .12], [.2, .1], [.13, .09]].forEach(([r, h], i) => { a(M.flat, rk(510 + i), i % 2 ? '#8b918a' : '#a3a8a1', (i % 2 - .5) * .04, y + h / 2, 0, 0, i, 0, r, h * .8, r * .9); y += h; }); return .45; },
    birdhouse(a) { a(M.flat, new THREE.BoxGeometry(.09, 1.7, .09), '#6b4d33', 0, .85, 0); a(M.flat, new THREE.BoxGeometry(.32, .32, .3), '#fde68a', 0, 1.85, 0); a(M.flat, new THREE.CylinderGeometry(.26, .26, .42, 3, 1), '#b45309', 0, 2.08, 0, Math.PI / 2, 0, 0, 1, 1, .62); a(M.flat, new THREE.CylinderGeometry(.06, .06, .02, 10), '#3f2a1c', 0, 1.88, .16, Math.PI / 2); a(M.soft, new THREE.SphereGeometry(.07, 8, 6), '#60a5fa', .12, 2.3, .05, 0, 0, 0, 1.3, 1, 1); a(M.flat, new THREE.ConeGeometry(.015, .05, 4), '#f59e0b', .21, 2.31, .05, 0, 0, -Math.PI / 2); return .3; },
    woodpile(a) { for (let r = 0; r < 3; r++) for (let i = 0; i < 4 - r; i++) a(M.flat, new THREE.CylinderGeometry(.13, .13, 1.1, 8), r % 2 ? '#8b6544' : '#7a5a3c', (i - (3 - r) / 2) * .27, .13 + r * .23, 0, Math.PI / 2, 0, 0); for (let i = 0; i < 4 - 0; i++) a(M.flat, new THREE.CircleGeometry(.12, 8), '#d6b98c', (i - 1.5) * .27, .13, .56); a(M.flat, new THREE.CylinderGeometry(.25, .2, .3, 10), '#c4935a', .9, .15, .1); return .8; },
    barrow(a) { a(M.flat, new THREE.BoxGeometry(.7, .28, .5), '#64748b', 0, .45, 0, 0, 0, .1); a(M.flat, new THREE.CylinderGeometry(.16, .16, .06, 12), '#1f2937', .45, .16, 0, Math.PI / 2); [-1, 1].forEach(s => a(M.flat, new THREE.BoxGeometry(.9, .04, .04), '#8b6544', -.35, .5, s * .2, 0, 0, .15)); [[-.1, 0], [.15, .08], [.05, -.12]].forEach(([x, z], i) => { a(M.soft, new THREE.SphereGeometry(.15, 10, 8), '#f97316', x, .7, z, 0, 0, 0, 1, .8, 1); a(M.flat, new THREE.CylinderGeometry(.015, .02, .08, 5), '#4d7c0f', x, .84, z); }); return .7; },
    net(a) { [-1.1, 1.1].forEach(x => a(M.flat, new THREE.CylinderGeometry(.05, .06, 1.9, 6), '#8b6544', x, .95, 0)); a(M.flat, new THREE.CylinderGeometry(.03, .03, 2.3, 5), '#8b6544', 0, 1.82, 0, 0, 0, Math.PI / 2); for (let i = 0; i < 7; i++) a(M.flat, new THREE.BoxGeometry(.012, 1.1, .012), '#94a3b8', -.9 + i * .3, 1.25, .02, 0, 0, Math.sin(i) * .06); for (let i = 0; i < 4; i++) a(M.flat, new THREE.BoxGeometry(1.9, .012, .012), '#94a3b8', 0, .8 + i * .3, .02); [-.6, .4].forEach(x => a(M.soft, new THREE.SphereGeometry(.12, 10, 8), '#f97316', x, 1.62, .08)); return 1.2; },
    crabpot(a) { [[0, 0], [.6, .1], [.3, .55]].forEach(([x, y], i) => { a(M.flat, new THREE.BoxGeometry(.55, .4, .5), i % 2 ? '#7c8a5a' : '#6b7a4d', x, .2 + y * .75, i === 2 ? .05 : 0); a(M.flat, new THREE.BoxGeometry(.58, .03, .53), '#4b5563', x, .41 + y * .75, i === 2 ? .05 : 0); }); a(M.soft, new THREE.SphereGeometry(.15, 10, 8), '#ef4444', -.55, .15, .25); a(M.soft, new THREE.SphereGeometry(.12, 10, 8), '#f8fafc', -.7, .12, -.15); return .7; },
    warn(a) { a(M.flat, new THREE.BoxGeometry(.08, 1.3, .08), '#4b5563', 0, .65, -.08); a(M.flat, new THREE.CylinderGeometry(.46, .46, .05, 3), '#facc15', 0, 1.45, 0, Math.PI / 2, 0, 0); a(M.flat, new THREE.CylinderGeometry(.36, .36, .052, 3), '#1f2937', 0, 1.45, 0, Math.PI / 2, 0, 0); a(M.flat, new THREE.CylinderGeometry(.3, .3, .054, 3), '#facc15', 0, 1.45, 0, Math.PI / 2, 0, 0); a(M.flat, new THREE.BoxGeometry(.06, .2, .02), '#1f2937', 0, 1.49, .03); a(M.flat, new THREE.BoxGeometry(.06, .06, .02), '#1f2937', 0, 1.33, .03); return .3; },
    cairnV(a) { let y = 0; [[.45, .2], [.36, .18], [.28, .16], [.2, .14]].forEach(([r, h], i) => { a(M.flat, new THREE.CylinderGeometry(r * .9, r, h, 6), i % 2 ? '#27272a' : '#3f3f46', 0, y + h / 2, 0, 0, i * .4, 0); y += h; }); a(M.lamp, new THREE.OctahedronGeometry(.08, 0), '#fb923c', 0, y + .06, 0); return .45; },
    scarf(a) { [-1, 0, 1].forEach(i => a(M.flat, new THREE.CylinderGeometry(.06, .07, 1.1, 6), '#6b4d33', i * 1.1, .55, 0)); [.4, .85].forEach(y => a(M.flat, new THREE.BoxGeometry(2.3, .07, .05), '#8b6544', 0, y, 0)); [-1, 0, 1].forEach(i => a(M.soft, new THREE.SphereGeometry(.1, 8, 5, 0, PI2, 0, Math.PI / 2), '#f8fafc', i * 1.1, 1.1, 0, 0, 0, 0, 1, .6, 1)); a(M.flat, new THREE.TorusGeometry(.09, .04, 5, 10), '#ef4444', 1.1, .95, 0, Math.PI / 2); a(M.flat, new THREE.BoxGeometry(.1, .4, .03), '#ef4444', 1.18, .75, .06, 0, 0, .15); return 1.3; },
    lantern(a) { a(M.flat, new THREE.BoxGeometry(.1, 1.9, .1), '#334155', 0, .95, 0); a(M.flat, new THREE.BoxGeometry(.5, .06, .06), '#334155', .2, 1.85, 0); a(M.flat, new THREE.BoxGeometry(.24, .3, .24), '#1f2937', .4, 1.58, 0); a(M.lamp, new THREE.BoxGeometry(.18, .22, .18), '#fde68a', .4, 1.58, 0); a(M.flat, new THREE.ConeGeometry(.2, .14, 4), '#1f2937', .4, 1.8, 0, 0, Math.PI / 4, 0); a(M.soft, new THREE.SphereGeometry(.12, 8, 4, 0, PI2, 0, Math.PI / 2), '#f8fafc', .4, 1.86, 0, 0, 0, 0, 1, .5, 1); return .3; },
    snowslime(a) { a(M.soft, new THREE.SphereGeometry(.55, 16, 12), '#f8fafc', 0, .36, 0, 0, 0, 0, 1, .72, 1); [-1, 1].forEach(s => { a(M.soft, new THREE.SphereGeometry(.05, 8, 6), '#1f2937', s * .17, .45, .47); a(M.soft, new THREE.SphereGeometry(.06, 8, 5), '#fda4af', s * .3, .34, .43, 0, 0, 0, 1, .55, .35); }); a(M.flat, new THREE.ConeGeometry(.08, .22, 3), '#16a34a', .05, .8, 0, 0, 0, -.3, 1, 1, .4); a(M.flat, new THREE.ConeGeometry(.07, .2, 3), '#22c55e', -.08, .78, 0, 0, 0, .4, 1, 1, .4); return .6; },
  };
  const SPOTS = [[0, 12, 1, 4.2, 'mailbox'], [0, 25, -1, 4.4, 'pots'], [1, 14, -1, 4.2, 'jizo'], [1, 30, 1, 4.4, 'birdhouse'], [1, 44, -1, 4.2, 'cairn'], [3, 13, 1, 4.4, 'woodpile'], [3, 38, 1, 4.6, 'barrow'],
    [0, 110, -1, 4.2, 'net'], [0, 130, 1, 4.4, 'crabpot'], [2, 22, 1, 3.8, 'warn'], [2, 40, -1, 4, 'cairnV'], [3, 102, 1, 4.2, 'scarf'], [3, 114, -1, 4.4, 'lantern'], [3, 128, 1, 4.6, 'snowslime']];
  SPOTS.forEach(([li, arc, side, off, k]) => {
    for (let tr = 0; tr < 5; tr++) { const s = trailAt(li, arc + tr * 3, side, off); if (!s || !free(s.x, s.z, 1.3)) continue; const r = ITEM[k](kitAt(s.x, s.z).at(s.x, s.z, -.02, s.face)); addCol({ x: s.x, z: s.z, r }); break; }
  });
  // 火山小徑：熱氣噴口旁插著一根烤得金黃的棉花糖
  { const [vx, vz] = kk([2.7, -74.4]), x = vx + 1, z = vz + .6, y = H(x, z), kt = kitAt(x, z); kt.seg(M.flat, new THREE.Vector3(x, y, z), new THREE.Vector3(x - .5, y + .75, z - .25), .012, '#a16207', 4); kt.add(M.soft, new THREE.CylinderGeometry(.055, .055, .11, 10), '#f6d39b', M4(x - .52, y + .8, z - .26, 0, 0, .6)); }
  // 史萊姆出沒注意（中央平地往海岸的路上）：菱形牌＋下面的字牌畫在同一張貼圖（透明處鏤空），只有一個網格；
  // 柱子與背板放進小徑的合併網格、在牌面後面，牌面上什麼都不擋，字只在正面
  { const s = [0, 3, 6, 9].map(o => trailAt(0, 38 + o, 1, 4.6)).find(q => q && free(q.x, q.z, 1.2));
    if (s) { const y = H(s.x, s.z) - .02, b = kitAt(s.x, s.z).at(s.x, s.z, -.02, s.face);
      const tx = artTex(256, 384, (c, w) => { c.fillStyle = '#facc15'; c.strokeStyle = '#1f2937'; c.lineWidth = 12; c.beginPath(); c.moveTo(128, 8); c.lineTo(248, 128); c.lineTo(128, 248); c.lineTo(8, 128); c.closePath(); c.fill(); c.stroke();
        c.fillStyle = '#1f2937'; c.beginPath(); c.moveTo(78, 150); c.bezierCurveTo(74, 98, 102, 76, 128, 76); c.bezierCurveTo(154, 76, 182, 98, 178, 150); c.quadraticCurveTo(128, 162, 78, 150); c.fill();
        c.fillStyle = '#facc15'; [110, 146].forEach(x => { c.beginPath(); c.arc(x, 118, 7, 0, PI2); c.fill(); }); artText(c, '小心', w / 2, 196, 34, '#1f2937', 120);
        c.fillStyle = '#f8fafc'; c.fillRect(14, 290, w - 28, 88); c.strokeStyle = '#1f2937'; c.lineWidth = 8; c.strokeRect(18, 294, w - 36, 80); c.fillStyle = '#1f2937'; c.font = '800 42px "Noto Sans TC","Microsoft JhengHei",sans-serif'; c.textBaseline = 'middle'; c.fillText('史萊姆出沒', w / 2, 336, w - 64); });
      b(M.flat, new THREE.CylinderGeometry(.04, .04, 2.2, 8), '#64748b', 0, 1.1, -.07); b(M.flat, new THREE.BoxGeometry(.62, .62, .02), '#94a3b8', 0, 1.92, 0, 0, 0, Math.PI / 4); b(M.flat, new THREE.BoxGeometry(.78, .3, .02), '#94a3b8', 0, 1.196, 0);
      const pm = new THREE.Mesh(new THREE.PlaneGeometry(.9, 1.35), new THREE.MeshStandardMaterial({ map: tx, alphaTest: .5, roughness: .7 }));
      pm.position.set(s.x + Math.sin(s.face) * .022, y + 1.695, s.z + Math.cos(s.face) * .022); pm.rotation.y = s.face; chunkObj(pm, 90, false, [s.x, s.z, 1]); addCol({ x: s.x, z: s.z, r: .15 }); } }
  Object.values(kits).forEach(k => k.done(110));
  // 路邊的小石頭：三五顆一組、隔一段留空（不是均勻灑），各區顏色不同
  const edge = [], ec = { forest: ['#9ca3af', '#a8a29e'], coast: ['#e7dcc4', '#cbbf9f'], volcano: ['#3f3f46', '#27272a'], snow: ['#cbd5e1', '#e2e8f0'] };
  PATH_LINES.forEach((l, li) => { const pts = crPts(l, 10); let acc = 0, run = 0, gap = 0;
    for (let i = 1; i < pts.length; i++) { const [ax, az] = pts[i - 1], [bx, bz] = pts[i], d = Math.hypot(bx - ax, bz - az); acc += d; if (acc < 2.2) continue; acc = 0;
      if (gap > 0) { gap--; continue; } if (++run > 3 + (i % 3)) { run = 0; gap = 2 + (i % 4); continue; }
      [-1, 1].forEach(s => { if (rd() < .35) return; const nx = -(bz - az) / d * s, nz = (bx - ax) / d * s, o = 2.5 + rd() * .7, x = bx + nx * o, z = bz + nz * o; if (band(x, z) || Math.hypot(x, z) < 26 || nookAvoid(x, z)) return; const b = domBiome(x, z); edge.push({ x, y: H(x, z) - .04, z, s: .7 + rd() * .7, ry: rd() * 6, rx: rd() * .4, c: new THREE.Color(pick(ec[b])) }); }); } });
  scatter(jit(new THREE.DodecahedronGeometry(.2, 0), .4, 33), fadeMat(new THREE.MeshStandardMaterial({ roughness: .9, flatShading: true }), LOW ? [32, 50] : [52, 78]), edge, false, { cell: LOW ? 64 : 44, far: (LOW ? 50 : 78) + 2 });
}
/* ---------- 地面細節與疏密節奏：成叢出現、叢與叢之間留空；四區各一種小物組合，靠近區域入口的地方混一點前一區的東西（交界不會一刀切） ---------- */
function buildDetails(M) {
  const rd = seeded(191), fG = LOW ? [32, 50] : [52, 78], sm = { cell: LOW ? 64 : 44, far: fG[1] + 2 };
  // 每組只有幾十個面：平貼地面的小圓片（三葉草、落葉、海玻璃）比立體小球便宜很多，遠處本來就看不出差別
  const dome = (r, c, x, z, sy, sz = 1) => [new THREE.SphereGeometry(r, 6, 2, 0, PI2, 0, Math.PI / 2), c, M4(x, -.02, z, 0, 0, 0, 1, sy, sz)], flat = (r, n, c, x, y, z, rz = 0) => [new THREE.CircleGeometry(r, n), c, M4(x, y, z, -Math.PI / 2, 0, rz)];
  const C = {
    forest: mergeParts([...[0, 1, 2].map(k => flat(.06, 5, '#4f9a45', Math.cos(k * 2.1) * .06, .02, Math.sin(k * 2.1) * .06, k)), [new THREE.CylinderGeometry(.015, .02, .08, 4, 1, true), '#f5efe6', M4(.22, .04, .05)], [new THREE.SphereGeometry(.05, 6, 2, 0, PI2, 0, Math.PI / 2), '#c98f5a', M4(.22, .08, .05)], [new THREE.CylinderGeometry(.012, .015, .05, 4, 1, true), '#f5efe6', M4(.28, .025, .1)], [new THREE.SphereGeometry(.035, 6, 2, 0, PI2, 0, Math.PI / 2), '#e5484d', M4(.28, .05, .1)], flat(.07, 4, '#d97706', -.2, .012, .15, .7), flat(.06, 4, '#eab308', -.12, .012, -.2, 2)]),
    coast: mergeParts([...[0, 1, 2].map(k => [new THREE.PlaneGeometry(.035, .26 + k * .06), '#3f6b3a', M4(k * .04, .12, 0, 0, k * 1.2, (k - 1) * .3)]), [new THREE.OctahedronGeometry(.035, 0), '#5eead4', M4(.2, .02, .12)], [new THREE.OctahedronGeometry(.03, 0), '#fbbf24', M4(-.15, .02, .18)], dome(.05, '#fde7d6', .12, -.16, .5, 1.3), [new THREE.TetrahedronGeometry(.07), '#a8a29e', M4(-.2, .02, -.1, 1, 2, 0)]]),
    volcano: mergeParts([dome(.28, '#57534e', 0, 0, .32, .8), ...[0, 1, 2].map(k => [new THREE.OctahedronGeometry(.05, 0), '#facc15', M4(.32 + k * .05, .04 + k * .02, .1 - k * .06, k, k, 0, .7, 1.6, .7)]), [new THREE.TetrahedronGeometry(.07), '#1c1917', M4(-.3, .03, .12, 1, 2, 0)], [new THREE.TetrahedronGeometry(.05), '#292524', M4(-.22, .02, -.2, 2, 1, 0)]]),
    snow: mergeParts([dome(.35, '#f8fafc', 0, 0, .3, .75), ...[0, 1, 2, 3].map(k => [new THREE.ConeGeometry(.015, .3 + k * .04, 3, 1, true), k % 2 ? '#dbeafe' : '#c7d8e8', M4(.35 + Math.cos(k * 1.6) * .06, .14, .1 + Math.sin(k * 1.6) * .06, Math.cos(k) * .2, 0, Math.sin(k) * .2)]), [new THREE.OctahedronGeometry(.07, 0), '#bae6fd', M4(-.3, .05, .15, 0, 0, 0, .6, 1.5, .6)]]),
    edgeS: mergeParts([...[0, 1, 2].map(k => [new THREE.ConeGeometry(.02, .3 + k * .05, 3, 1, true), '#5f9a4a', M4(Math.cos(k * 2.1) * .05, .15, Math.sin(k * 2.1) * .05, Math.cos(k) * .25, 0, Math.sin(k) * .25)]), dome(.12, '#f8fafc', .12, .05, .35, .8)]),
    edgeV: mergeParts([...[0, 1, 2, 3].map(k => [new THREE.ConeGeometry(.018, .28 + k * .04, 3), k % 2 ? '#a3895a' : '#8d7650', M4(Math.cos(k * 1.6) * .05, .14, Math.sin(k * 1.6) * .05, Math.cos(k) * .3, 0, Math.sin(k) * .3)]), [new THREE.CylinderGeometry(.03, .04, .35, 5), '#1c1917', M4(.18, .1, -.05, 0, 0, 1.2)]]),
  };
  const L = { forest: [], coast: [], volcano: [], snow: [], edgeS: [], edgeV: [] }, N = LOW ? 150 : 330;
  // 先決定「叢」的中心（彼此至少隔一段距離），每叢 3～6 個，留出空地
  const cs = [];
  for (let i = 0; i < N * 6 && cs.length < N; i++) {
    const x = (rd() - .5) * 340 * K, z = (rd() - .5) * 340 * K, r = Math.max(Math.abs(x), Math.abs(z)) / K; if ((r > 41 && r < 66) || r > 165 || Math.hypot(x, z) < 26) continue;
    if (cs.some(([px, pz]) => (px - x) ** 2 + (pz - z) ** 2 < 100)) continue; const h = H(x, z); if (h < -.3 || h > 22 * K) continue; cs.push([x, z]);
  }
  cs.forEach(([x0, z0]) => {
    const b = domBiome(x0, z0), r = Math.max(Math.abs(x0), Math.abs(z0)) / K, n = 3 + Math.floor(rd() * 4);
    // 區域入口附近（離山脊不遠）：雪原混著帶雪的綠草、火山混著乾枯的草，越往裡面越少
    const edge = b === 'snow' && r < 82 && rd() < (82 - r) / 16 ? 'edgeS' : b === 'volcano' && r < 82 && rd() < (82 - r) / 16 ? 'edgeV' : b;
    for (let k = 0; k < n; k++) {
      const x = x0 + (rd() - .5) * 5, z = z0 + (rd() - .5) * 5, h = H(x, z); const rr = Math.max(Math.abs(x), Math.abs(z)) / K; if ((rr > 41.5 && rr < 68) || onPath(x, z) > .3 || nookAvoid(x, z) || h < -.35 || h > 22 * K) continue;
      if (Math.abs(H(x + .7, z) - H(x - .7, z)) + Math.abs(H(x, z + .7) - H(x, z - .7)) > .9) continue;
      L[edge].push({ x, y: h - .01, z, s: .8 + rd() * .6, ry: rd() * 6 });
    }
  });
  const dm = fadeMat(new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: .85, side: THREE.DoubleSide }), fG);
  Object.keys(L).forEach(k => scatter(C[k], dm, L[k], false, sm));
}
/* ---------- 建置與每幀更新 ---------- */
function buildNooks() {
  const M = nookMats();
  nookPond(M); nookRing(M); nookPicnic(M); nookLog(M); nookRock(M);
  regEgg('forest_star', '對流星許願', '晴朗的夜裡，在中央平地抬頭看天空久一點。');
  nookTide(M); nookBoat(M); nookArch(M); nookConch(M);
  nookSpring(M); nookObsidian(M); nookTube(M);
  nookLake(M); nookFalls(M);
  buildTrails(M); buildDetails(M);
  W.anim.push(nookStep);
}
function nookStep(dt, t) {
  if (!P || inCity()) return;
  NK.jumped = P.vy > 4 && NK.vy <= 4; NK.vy = P.vy;
  if (W.nk) W.nk.U.value = DN.night;
  for (const n of NK.list) { const d = Math.hypot(n.x - P.x, n.z - P.z); if (d < n.r) n.fn(dt, t, d); }
  starStep(dt);
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
const ART_FONT = '"LXGW WenKai TC","Slime Hand","Kaiti TC","DFKai-SB","BiauKai","Noto Serif TC",serif'; // 粗體子集沒有的字由完整的手寫子集補上
// 先用備用字型畫，字型載入後再重畫一次（CanvasTexture 標記更新）
function artTex(w, h, draw) {
  const cv = document.createElement('canvas'); cv.width = w; cv.height = h; const g = cv.getContext('2d'), tx = new THREE.CanvasTexture(cv); tx.colorSpace = THREE.SRGBColorSpace; tx.anisotropy = 4;
  const paint = () => { g.clearRect(0, 0, w, h); g.textAlign = 'center'; g.textBaseline = 'alphabetic'; draw(g, w, h); tx.needsUpdate = true; }; paint();
  // 兩個字型（粗體子集、完整的手寫子集）都載入後再畫一次，告示牌上的字才不會停在系統字型
  try { if (document.fonts) { const need = ['700 32px "LXGW WenKai TC"', '400 32px "Slime Hand"'].filter(f => !document.fonts.check(f, '月')); if (need.length) Promise.all(need.map(f => document.fonts.load(f, '月'))).then(paint, () => { }); } } catch (e) { }
  return tx;
}
// 木板底紋：直條木紋、邊框、釘子
function woodBoard(g, w, h) {
  const gr = g.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, '#9c774f'); gr.addColorStop(1, '#7d5c3a'); g.fillStyle = gr; g.fillRect(0, 0, w, h);
  g.globalAlpha = .18; g.fillStyle = '#4a3220'; for (let i = 0; i < h; i += h / 6) g.fillRect(0, i, w, 2); for (let i = 0; i < 40; i++) g.fillRect((i * 97) % w, (i * 53) % h, 18 + (i % 5) * 9, 1.5); g.globalAlpha = 1;
  g.strokeStyle = '#4a3220'; g.lineWidth = Math.max(4, w / 70); g.strokeRect(g.lineWidth / 2, g.lineWidth / 2, w - g.lineWidth, h - g.lineWidth);
  g.fillStyle = '#3b2a1a'; [[14, 14], [w - 14, 14], [14, h - 14], [w - 14, h - 14]].forEach(([x, y]) => { g.beginPath(); g.arc(x, y, 4, 0, 6.3); g.fill(); });
}
function artText(g, txt, x, y, size, color, max) { g.font = '700 ' + size + 'px ' + ART_FONT; g.lineJoin = 'round'; g.lineWidth = size / 7; g.strokeStyle = '#2b1b0e'; g.strokeText(txt, x, y, max); g.fillStyle = color; g.fillText(txt, x, y, max); }
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
  W.slotMark.line = slotMark(g, BASE.line, '加工產線空地', '工作電腦網購或大城市機械行', 7);
  // 裝飾桌
  const dt = at(new THREE.Group(), BASE.decor, .5); W.decorG = dt;
  box(2.6, .12, 1.5, white, 0, .95, 0, dt); [[-1.2, -.65], [1.2, -.65], [-1.2, .65], [1.2, .65]].forEach(([x, z]) => box(.08, .95, .08, dark, x, .47, z, dt));
  cyl(.5, .55, .1, 32, steel, 0, 1.06, 0, dt);
  const sample = makeJelly(6, true); sample.group.scale.setScalar(.28); sample.group.position.set(0, 1.4, 0); sample.ov.visible = false; jellyColors(sample, SP.honey); dt.add(sample.group); W.sample = sample.group;
  [['#e879f9', -.8], ['#22d3ee', -.55], ['#fbbf24', .75]].forEach(([c, x]) => mesh(new THREE.OctahedronGeometry(.08), glow(c), x, 1.1, .4, dt));
  W.slotCol.decor = { x: BASE.decor[0], z: BASE.decor[1], r: 1.5 };
  W.slotInter.decor = addInter(hitBox(3, 2, 2, 0, 1, 0, dt), 'station', 'decor', '裝飾桌');
  W.slotMark.decor = slotMark(g, BASE.decor, '裝飾桌空地', '工作電腦網購或大城市器材行', 2);
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
  W.slotCol.live = { x: BASE.live[0], z: BASE.live[1], r: .55 }; // 只擋住中央的展示柱，舞台本身可以站上去
  W.slotInter.live = addInter(hitBox(3.6, 2.6, 3.6, 0, 1.3, 0, lv), 'station', 'live', '直播台');
  W.slotMark.live = slotMark(g, BASE.live, '直播台空地', '工作電腦網購或大城市器材行', 2.2);
  // 計程車招呼站（出生點左邊的花島）：車子加在場景、不加在工坊群組——它會載你開走、空車再自己開回來（計程車與月光隧道）
  W.taxiV = makeCab(false); W.scene.add(W.taxiV); cabPark(W.taxiV); buildCabInner(); W.taxiV.add(INNER.g); taxiIsland();
  g.traverse(o => { if (o.isMesh && o.material.visible !== false) { o.castShadow = !LOW; o.receiveShadow = true; } });
  W.neon.forEach(n => MK.dyn.add(n));
  [pc, chair, bn, dt, lv, camG, W.lineParts.belt, ...W.lineParts.m].forEach(o => mergeStatic(o, MK.dyn));
  buildRacks(g); buildCottage(g); refreshBase();
}
/* 金屬髮絲紋：沿水平方向的細紋改變粗糙度與明暗，反射天空時有拉絲金屬的質感 */
/* 網站貨架（拿著捏捏按 E 直接上架）與倉儲貨架：層數與格數跟著升級變多，上面擺的就是真的商品 */
const miniMat = id => (W.miniMat = W.miniMat || {})[id] || (W.miniMat[id] = new THREE.MeshPhysicalMaterial({ color: SP[id].color, roughness: .15, clearcoat: 1 }));
/* 奶奶的舊工坊（第 3 堂 06）：小屋把手作台與工作電腦收進去、產線在北側工棚、裝飾桌在西邊花棚。
   只做「外殼加一面牆打開」（像娃娃屋），零件依顏色合併成少數網格 */
const REPAIRS = [['first', '左邊的窗戶'], ['machine', '右邊的窗戶'], ['firstlive', '屋頂的破洞'], ['coast', '另一塊屋頂瓦片'], ['volcano', '門口的招牌'], ['snow', '煙囪']];
function buildCottage(g) {
  const flat = new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: .85 });
  const wall = '#e9dcc0', beam = '#8b6544', roofC = '#b5573f', parts = [], cg = new THREE.Group(); g.add(cg); W.cottage = cg;
  const zb = 4.6, zf = 9.4, xw = 6.2, wh = 3.2, cz = (zb + zf) / 2, dep = zf - zb;
  // 後牆（中間有門洞，可以穿過小屋往北走）＋兩側牆（各有一扇窗）
  parts.push([new THREE.BoxGeometry(xw - 1.1, wh, .2), wall, M4(-(xw + 1.1) / 2, wh / 2, zb)], [new THREE.BoxGeometry(xw - 1.1, wh, .2), wall, M4((xw + 1.1) / 2, wh / 2, zb)], [new THREE.BoxGeometry(2.2, .8, .2), wall, M4(0, wh - .4, zb)]);
  [-1, 1].forEach(s => { parts.push([new THREE.BoxGeometry(.2, 1.1, dep), wall, M4(s * xw, .55, cz)], [new THREE.BoxGeometry(.2, wh - 2.2, dep), wall, M4(s * xw, 2.2 + (wh - 2.2) / 2, cz)], [new THREE.BoxGeometry(.2, 1.1, dep / 2 - .65), wall, M4(s * xw, 1.65, zb + (dep / 2 - .65) / 2)], [new THREE.BoxGeometry(.2, 1.1, dep / 2 - .65), wall, M4(s * xw, 1.65, zf - (dep / 2 - .65) / 2)]); });
  // 木頭骨架與屋頂（兩片斜屋頂在屋脊交會）
  [[-xw, zb], [xw, zb], [-xw, zf], [xw, zf]].forEach(([x, z]) => parts.push([new THREE.BoxGeometry(.3, wh + .1, .3), beam, M4(x, wh / 2, z)]));
  parts.push([new THREE.BoxGeometry(xw * 2 + .3, .25, .3), beam, M4(0, wh, zf)], [new THREE.BoxGeometry(xw * 2 + .3, .25, .3), beam, M4(0, wh, zb)]);
  const ra = .55, rl = dep / 2 / Math.cos(ra) + .5;
  [-1, 1].forEach(s => parts.push([new THREE.BoxGeometry(xw * 2 + 1, .18, rl), roofC, M4(0, wh + Math.tan(ra) * dep / 4 + .1, cz + s * dep / 4, s * ra, 0, 0)]));
  parts.push([new THREE.BoxGeometry(xw * 2 + 1.1, .22, .3), '#7c3d2c', M4(0, wh + Math.tan(ra) * dep / 2 + .1, cz)]);
  // 山牆（三角形）
  [-1, 1].forEach(s => { const tri = new THREE.Shape([new THREE.Vector2(-dep / 2, 0), new THREE.Vector2(dep / 2, 0), new THREE.Vector2(0, Math.tan(ra) * dep / 2)]); const tg = new THREE.ExtrudeGeometry(tri, { depth: .2, bevelEnabled: false }); tg.rotateY(Math.PI / 2); parts.push([tg, wall, M4(s * xw - .1, wh, cz)]); });
  const house = mesh(mergeParts(parts), flat, 0, G(0, cz), 0, cg); house.castShadow = house.receiveShadow = !LOW;
  // 牆的碰撞（門洞與正面開著）
  addCol({ box: [-xw - .1, zb - .15, -1.1, zb + .15] }); addCol({ box: [1.1, zb - .15, xw + .1, zb + .15] });
  [-1, 1].forEach(s => addCol({ box: [s * xw - .15, zb, s * xw + .15, zf] }));
  // 會被修好的地方：破窗／好窗、屋頂破洞／新瓦、招牌、煙囪
  const y0 = G(0, cz), R0 = W.repair = {};
  const glass = new THREE.MeshPhysicalMaterial({ color: '#cfe8ff', transparent: true, opacity: .45, roughness: .05 }), plank = woodMat('#6b4d33'), hole = std('#2b2522', { roughness: 1 });
  [-1, 1].forEach((s, i) => { const win = new THREE.Group(); win.position.set(s * xw, y0 + 1.65, cz); cg.add(win);
    const fixed = new THREE.Group(); win.add(fixed); mesh(new THREE.PlaneGeometry(1.3, 1.1), glass, s * .11, 0, 0, fixed).rotation.y = s * Math.PI / 2; box(.24, .08, 1.36, std(beam), 0, 0, 0, fixed); box(.24, 1.16, .08, std(beam), 0, 0, 0, fixed);
    const broken = new THREE.Group(); win.add(broken); [.5, -.5].forEach(r => { const p = box(.08, .16, 1.6, plank, s * .14, 0, 0, broken); p.rotation.x = r; });
    R0[REPAIRS[i][0]] = { fixed, broken }; });
  const roofY = y0 + wh + Math.tan(ra) * dep / 4 + .25;
  [[-3, 'firstlive'], [2.6, 'coast']].forEach(([x, k]) => { const rp = new THREE.Group(); rp.position.set(x, roofY, cz + dep / 4); rp.rotation.x = ra; cg.add(rp); const fixed = box(1.5, .06, 1.1, std('#c96a4f', { flatShading: true }), 0, .04, 0, rp), broken = box(1.3, .05, .9, hole, 0, .03, 0, rp); R0[k] = { fixed, broken }; });
  { const sgn = new THREE.Group(); sgn.position.set(0, y0 + wh + .65, zf + .05); cg.add(sgn); const tx = artTex(1024, 256, (x, w, h) => { woodBoard(x, w, h); artText(x, '奶奶的史萊姆工坊', w / 2, 170, 120, '#fef3c7', w - 60); });
    const fixed = mesh(new THREE.PlaneGeometry(3.4, .85), new THREE.MeshStandardMaterial({ map: tx, roughness: .8 }), 0, 0, 0, sgn), broken = mesh(new THREE.PlaneGeometry(3.4, .85), new THREE.MeshStandardMaterial({ map: tx, roughness: .9, color: '#6b6b6b' }), 0, -.35, 0, sgn); broken.rotation.z = .35; R0.volcano = { fixed, broken }; }
  { const ch = new THREE.Group(); ch.position.set(4, y0 + wh + 1.2, cz - 1); cg.add(ch); const fixed = new THREE.Group(); ch.add(fixed); box(.8, 2, .8, std('#8a5a44', { flatShading: true }), 0, .5, 0, fixed); box(.95, .18, .95, std('#5b3a2c'), 0, 1.55, 0, fixed);
    const smokeM = new THREE.MeshBasicMaterial({ color: '#e5e7eb', transparent: true, opacity: .35, depthWrite: false }), puffs = [0, 1, 2].map(i => mesh(new THREE.IcosahedronGeometry(.25, 0), smokeM, 0, 1.8, 0, fixed));
    W.anim.push((dt, t) => { if (!fixed.visible) return; puffs.forEach((p, i) => { const k = (t * .3 + i / 3) % 1; p.position.set(Math.sin(t + i) * .2, 1.8 + k * 2.4, k * .4); p.scale.setScalar(.6 + k * 1.8); }); smokeM.opacity = .35; });
    const broken = box(.8, .7, .8, std('#6b5a50', { flatShading: true }), 0, -.15, 0, ch); R0.snow = { fixed, broken }; }
  // 照片牆（後牆內側，手作台上方）：最多 12 張，用同一張圖集
  { const c = document.createElement('canvas'); c.width = 512; c.height = 384; W.photoCv = c; const tx = new THREE.CanvasTexture(c); tx.colorSpace = THREE.SRGBColorSpace; W.photoTx = tx;
    const board = mesh(new THREE.PlaneGeometry(3.6, 2.7 * .75), new THREE.MeshStandardMaterial({ map: tx, roughness: .9 }), -3.65, y0 + 2.05, zb + .12, cg); board.scale.set(1, 1, 1);
    const lb = textSprite('照片牆', '#fde68a', '工坊的回憶'); lb.position.set(-3.65, y0 + 3.4, zb + .4); lb.scale.set(1.6, .5, 1); cg.add(lb); drawPhotos(); }
  // 工棚：產線上方的屋頂（夠高，加工時的鏡頭不會被擋住）
  { const sp = [], lx = BASE.line[0], lz = BASE.line[1];
    [[-8.4, -1.9], [9.9, -1.9], [-8.4, 1.9], [9.9, 1.9], [.75, -1.9], [.75, 1.9]].forEach(([x, z]) => sp.push([new THREE.BoxGeometry(.28, 5.6, .28), beam, M4(x, 2.8, z)]));
    sp.push([new THREE.BoxGeometry(19, .18, 2.6), '#7c8a96', M4(.75, 5.95, -1.15, .22, 0, 0)], [new THREE.BoxGeometry(19, .18, 2.6), '#7c8a96', M4(.75, 5.95, 1.15, -.22, 0, 0)], [new THREE.BoxGeometry(18.8, .22, .25), beam, M4(.75, 5.6, -1.9)], [new THREE.BoxGeometry(18.8, .22, .25), beam, M4(.75, 5.6, 1.9)]);
    const shed = mesh(mergeParts(sp), flat, lx, G(lx, lz), lz, g); shed.castShadow = !LOW; W.shed = shed; }
  // 花棚：裝飾桌上方的木頭棚架與花
  { const ap = [], [dx, dz] = BASE.decor;
    [[-1.6, -1.2], [1.6, -1.2], [-1.6, 1.2], [1.6, 1.2]].forEach(([x, z]) => ap.push([new THREE.BoxGeometry(.16, 2.9, .16), beam, M4(x, 1.45, z)]));
    for (let i = 0; i < 7; i++) ap.push([new THREE.BoxGeometry(.12, .12, 3), beam, M4(-1.5 + i * .5, 2.95, 0)]);
    [[-1.6, 1], [1.6, -1], [-1.6, -1.2], [1.6, 1.2]].forEach(([x, z], i) => ap.push([new THREE.BoxGeometry(.7, .3, .4), '#8b5a3c', M4(x, .15, z)]));
    const rd = seeded(9); for (let i = 0; i < 22; i++) ap.push([new THREE.IcosahedronGeometry(.13, 0), ['#f9a8d4', '#fde68a', '#c4b5fd', '#86efac'][i % 4], M4(-1.5 + rd() * 3, 3.05, -1.4 + rd() * 2.8)]);
    const arb = mesh(mergeParts(ap), flat, dx, G(dx, dz), dz, g); arb.rotation.y = .5; arb.castShadow = !LOW; }
  // 一開始就依目前的照片決定哪些地方已修好（不要等第一次 photoCheck，否則會有一瞬間新舊兩塊招牌同時出現）
  for (const [k] of REPAIRS) { const r = R0[k]; if (!r) continue; const ok = (S.photos || []).some(p => p.k === k); r.fixed.visible = ok; r.broken.visible = !ok; }
}
// 照片牆的圖集：4×3 格，每張是一個史萊姆的色塊加標題
function drawPhotos() {
  const c = W.photoCv; if (!c) return; const x = c.getContext('2d'); x.fillStyle = '#a0784f'; x.fillRect(0, 0, 512, 384); x.fillStyle = '#8b6544'; for (let i = 0; i < 40; i++) x.fillRect(Math.random() * 512, Math.random() * 384, 18, 3);
  for (let i = 0; i < 12; i++) {
    const px = 10 + (i % 4) * 126, py = 10 + Math.floor(i / 4) * 124, p = S.photos[i]; x.save(); x.translate(px + 58, py + 56); x.rotate(((i * 37) % 7 - 3) * .02);
    x.fillStyle = p ? '#fafaf9' : '#00000018'; x.fillRect(-56, -54, 112, 108); if (p) { const sp = p.sp ? SP[p.sp] : null, col = sp ? sp.color : '#94a3b8';
      const gr = x.createLinearGradient(0, -48, 0, 24); gr.addColorStop(0, '#bfe3f5'); gr.addColorStop(1, '#a7d7a0'); x.fillStyle = gr; x.fillRect(-50, -48, 100, 72);
      x.fillStyle = col; x.beginPath(); x.ellipse(0, 4, 26, 20, 0, Math.PI, 0); x.lineTo(26, 16); x.lineTo(-26, 16); x.fill(); x.fillStyle = '#1e293b'; x.beginPath(); x.arc(-8, 2, 3, 0, 6.3); x.arc(8, 2, 3, 0, 6.3); x.fill();
      x.fillStyle = '#334155'; x.font = 'bold 13px "Noto Sans TC","Microsoft JhengHei",sans-serif'; x.textAlign = 'center'; x.fillText(p.txt.length > 8 ? p.txt.slice(0, 8) : p.txt, 0, 42); }
    x.fillStyle = '#ef4444'; x.beginPath(); x.arc(0, -50, 4, 0, 6.3); x.fill(); x.restore();
  }
  if (W.photoTx) W.photoTx.needsUpdate = true;
}
// 里程碑：自動拍照貼上照片牆，前 6 個里程碑順便把小屋修好一處
const PHOTO_EVT = [
  ['first', '第一個捏捏', () => Object.keys(S.codex).find(k => S.codex[k] && S.codex[k].made > 0)],
  ['machine', '第一台機器', () => ownAny() && 'grass'],
  ['sale', '第一筆訂單', () => S.sales > 0 && 'honey'],
  ['firstlive', '第一次直播', () => L.on && 'coral'],
  ['best90', '第一個極品捏捏', () => { const p = [...S.stock, ...S.web, ...S.show].find(p => p.crisp >= .9); return p && p.sp; }],
  ['live100', '百人直播', () => L.on && L.viewers >= 100 && 'aurora'],
  ['coast', '來到海岸', () => S.zones.includes('coast') && 'salt'],
  ['volcano', '來到火山', () => S.zones.includes('volcano') && 'lava'],
  ['snow', '來到雪原', () => S.zones.includes('snow') && 'ice'],
  ['night', '第一隻夜行史萊姆', () => SPECIES.filter(s => s.night).map(s => s.id).find(k => S.codex[k] && S.codex[k].made > 0)],
  ['show', '展示場開張', () => S.show.length > 0 && S.show[0].sp],
  ['museum', '夢想捏捏博物館', () => S.done && 'aurora'],
];
function photoCheck() {
  if (!W.repair) return; const quiet = !W.photoInit; W.photoInit = true; let changed = false;
  for (const [k, txt, f] of PHOTO_EVT) { if (S.photos.some(p => p.k === k) || S.photos.length >= 12) continue; const sp = f(); if (!sp) continue; S.photos.push({ k, txt, sp: SP[sp] ? sp : null, t: Date.now() }); changed = true;
    if (!quiet) { const ri = REPAIRS.findIndex(r => r[0] === k); toast('照片牆多了一張：' + txt + (ri >= 0 ? '　奶奶的小屋修好了' + REPAIRS[ri][1] + '（' + REPAIRS.filter(r => S.photos.some(p => p.k === r[0])).length + '/' + REPAIRS.length + '）' : '')); } }
  if (changed || quiet) { drawPhotos(); for (const [k] of REPAIRS) { const r = W.repair[k]; if (!r) continue; const ok = S.photos.some(p => p.k === k); r.fixed.visible = ok; r.broken.visible = !ok; } if (changed) save(); }
}
function buildRacks(g) {
  const mk = (pos, id, name, col, sub) => {
    const o = new THREE.Group(); o.position.set(pos[0], G(pos[0], pos[1]), pos[1]); g.add(o); const dyn = new THREE.Group(); o.add(dyn);
    addCol({ box: [pos[0] - 1.25, pos[1] - .45, pos[0] + 1.25, pos[1] + .45] }); addInter(hitBox(2.5, 2.6, 1.1, 0, 1.3, 0, o), 'station', id, name);
    const lb = textSprite(name, col, sub); lb.position.set(pos[0], o.position.y + 3.6, pos[1]); g.add(lb); return dyn;
  };
  W.shelfDyn = mk(BASE.shelf, 'shelf', '網站貨架', '#818cf8', '拿著捏捏按 E 直接上架');
  W.rackDyn = mk(BASE.rack, 'rack', '倉儲貨架', '#94a3b8', '背包裡的捏捏都收在這');
  W.upG = new THREE.Group(); W.scene.add(W.upG);
  // 展示場：擺出得意作品，會慢慢吸引粉絲；多人時朋友可以來參觀按讚
  const MX0 = 13.4, ped = std('#e2e8f0', { roughness: .35 }), trim = std('#fbbf24', { metalness: .6, roughness: .3 }); W.musJ = [];
  [-3.5, -5, -6.5, -8].forEach(z => { const y = G(MX0, z); cyl(.42, .5, 1, 18, ped, MX0, y + .5, z, g); cyl(.46, .46, .05, 18, trim, MX0, y + 1.02, z, g);
    const J = makeJelly(6, true); J.ov.visible = false; J.group.scale.setScalar(.3); J.group.position.set(MX0, y + 1.36, z); J.group.visible = false; g.add(J.group); W.musJ.push(J); addCol({ x: MX0, z, r: .5 }); });
  addInter(hitBox(1.6, 2.2, 6.4, MX0, G(MX0, -5.75) + 1.1, -5.75, g), 'station', 'museum', '展示場');
  W.musLabel = textSprite(S.done ? '夢想捏捏博物館' : '展示場', '#fbbf24', '擺出得意作品，朋友可以來參觀'); W.musLabel.position.set(MX0, G(MX0, -5.75) + 3.2, -5.75); g.add(W.musLabel);
}
function rackFrame(dyn, tiers, gap, mat, matD) {
  dyn.children.slice().forEach(c => { dyn.remove(c); if (c.geometry && !c.userData.shared) c.geometry.dispose(); });
  const h = .25 + tiers * gap; [-1.1, 1.1].forEach(x => [-.32, .32].forEach(z => box(.07, h, .07, matD, x, h / 2, z, dyn)));
  for (let i = 0; i < tiers; i++) box(2.3, .05, .7, mat, 0, .25 + i * gap, 0, dyn);
  box(2.3, .05, .7, mat, 0, h, 0, dyn);
}
function refreshProps() {
  if (!W.shelfDyn) return;
  const sig = [S.show.map(p => p.id).join(), S.web.map(p => p.sp).join(), slots(), S.stock.map(p => p.sp).join(), cap(), S.up.gear, S.up.farm, S.own.live ? 1 : 0].join('|'); if (sig === W.propSig) return; W.propSig = sig;
  const wood = W.rackWood || (W.rackWood = woodMat('#b08a5e')), woodD = W.rackWoodD || (W.rackWoodD = woodMat('#6b4d33')), steel = W.rackSteel || (W.rackSteel = std('#64748b', { metalness: .7, roughness: .35 }));
  const mini = W.miniGeo || (W.miniGeo = new THREE.BoxGeometry(.26, .2, .26));
  // 網站貨架：每層 5 格，伺服器升級會多出新的一層
  W.musJ.forEach((J, i) => { const p = S.show[i]; J.group.visible = !!p; if (p) { jellyColors(J, SP[p.sp]); jellyCut(J, p); jellyDeco(J, p); syncDeco(J, p, 0); } });
  const ws = slots(), wt = Math.ceil(ws / 5); rackFrame(W.shelfDyn, wt, .52, wood, woodD);
  for (let i = 0; i < ws; i++) { const x = -.88 + (i % 5) * .44, y = .25 + Math.floor(i / 5) * .52; const p = S.web[i]; if (p) mesh(mini, miniMat(p.sp), x, y + .13, 0, W.shelfDyn).userData.shared = true; else box(.26, .01, .26, steel, x, y + .03, 0, W.shelfDyn); }
  // 倉儲貨架：層數 = 1 + 倉儲升級等級
  const tiers = 1 + S.up.cap, per = Math.ceil(cap() / tiers); rackFrame(W.rackDyn, tiers, .42, steel, steel);
  S.stock.slice(0, cap()).forEach((p, i) => { const t = Math.floor(i / per), k = i % per; mesh(mini, miniMat(p.sp), -.95 + k * (1.9 / Math.max(1, per - 1)), .25 + t * .42 + .13, 0, W.rackDyn).userData.shared = true; });
  // 直播燈光設備：每一級在舞台旁多一支燈
  W.upG.children.slice().forEach(dropObj); const steel2 = std('#64748b', { metalness: .7, roughness: .35 });
  if (S.own.live) for (let i = 0; i < S.up.gear; i++) { const a = -2.3 + i * .45 + (i > 1 ? 1.9 : 0), x = BASE.live[0] + Math.cos(a) * 2.4, z = BASE.live[1] + Math.sin(a) * 2.4, y = G(x, z), c = ['#22d3ee', '#e879f9', '#fbbf24', '#34d399', '#818cf8'][i]; cyl(.04, .05, 2.3, 8, steel2, x, y + 1.15, z, W.upG); const hd = box(.34, .22, .22, std('#1e293b', { metalness: .6 }), x, y + 2.35, z, W.upG); hd.lookAt(BASE.live[0], y + 1, BASE.live[1]); mesh(new THREE.CircleGeometry(.09, 16), glow(c), 0, 0, .115, hd); }
  // 養殖槽：每一級多一座看得見的養殖槽，裡面是正在長大的凝膠
  for (let i = 0; i < S.up.farm; i++) { const x = BASE.farm[0] + i * 1.3, z = BASE.farm[1], y = G(x, z), sp = unlockedSpecies()[i % unlockedSpecies().length];
    cyl(.5, .55, .16, 20, steel2, x, y + .08, z, W.upG); mesh(new THREE.CylinderGeometry(.42, .42, 1.3, 20, 1, true), new THREE.MeshPhysicalMaterial({ color: '#e0f2fe', transparent: true, opacity: .25, roughness: .05, side: THREE.DoubleSide }), x, y + .81, z, W.upG);
    const lq = cyl(.38, .38, .7, 20, new THREE.MeshPhysicalMaterial({ color: sp.color, emissive: sp.color, emissiveIntensity: .25, transparent: true, opacity: .85, roughness: .1 }), x, y + .52, z, W.upG); lq.userData.bob = i; cyl(.46, .46, .1, 20, steel2, x, y + 1.5, z, W.upG); }
  if (S.up.farm > 0) { const lb = textSprite('養殖槽', '#6ee7a8', '每 30 分鐘自動收集'); lb.position.set(BASE.farm[0] + (S.up.farm - 1) * .65, G(BASE.farm[0], BASE.farm[1]) + 2.6, BASE.farm[1]); W.upG.add(lb); }
}
function shelfAct() {
  const it = held();
  if (!it || it.t !== 'prod') return openGui('pc', 'web');
  const p = it.p; if (p.played || p.dur < 100) return toast('玩過的捏捏不能上架到網站，可以拿去直播賣');
  if (S.web.length >= slots()) return toast('貨架滿了，升級「網站伺服器」可以多一層');
  S.stock = S.stock.filter(q => q !== p); S.web.push(p); sfx.pop(); objSig = ''; renderHotbar(true); save();
  toast(`已上架${short(p.sp)}捏捏（售價 ${fmt(priceOf(p, 'web'))}），等顧客下單`);
}
/* 站上舞台就開直播，走下舞台就結束（只結束「站上去自動開始」的那一場） */
function stageStep() {
  if (!S.own.live || !P || GUI.kind || TITLE.on || inCity() || L.watch) { return; }
  const d = Math.hypot(P.x - BASE.live[0], P.z - BASE.live[1]);
  if (d < 1.65 && !W.onStage) {
    W.onStage = true; if (L.on) return;
    if (!S.stock.length) { toast('站上舞台了，但背包裡沒有捏捏可以直播'); return; }
    toggleLive(); L.auto = true; toast('站上舞台，直播開始！對準舞台' + (TOUCH ? '點擊' : '按 E') + '開始捏，走下舞台就會結束直播');
  } else if (d > 2.3 && W.onStage) { W.onStage = false; if (L.on && L.auto) { L.auto = false; toggleLive(); } }
}
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
  MK.blades = [0].map(dx => box(.05, .7, 1.5, steel, x0 + dx, 2.1, 0, A)); // 只有一片刀 box(1, .55, .1, panel, x0, .3, 1.15, A); MK.leds[0] = leds(x0, A);
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
  // 切片時的切口：本體在最後一刀的位置被截斷（clipping plane），截面蓋上一片發亮的切面，切過的部分真的不見了
  MK.clipU = 1.1; MK.clipP = new THREE.Plane(new THREE.Vector3(-1, 0, 0), 1.1); MK.J.mesh.material.clippingPlanes = [MK.clipP];
  { const r = .3, h = .97, sh = new THREE.Shape(); sh.moveTo(-h + r, -h); sh.lineTo(h - r, -h); sh.quadraticCurveTo(h, -h, h, -h + r); sh.lineTo(h, h - r); sh.quadraticCurveTo(h, h, h - r, h); sh.lineTo(-h + r, h); sh.quadraticCurveTo(-h, h, -h, h - r); sh.lineTo(-h, -h + r); sh.quadraticCurveTo(-h, -h, -h + r, -h);
    const cg = new THREE.ShapeGeometry(sh, 4); cg.rotateY(Math.PI / 2); MK.cap = new THREE.Mesh(cg, faceMat(SP.grass, .5)); MK.cap.visible = false; MK.J.group.add(MK.cap); }
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
  const slicing = M.active && M.step === 0 && M.g && !!M.g.marks;
  const tx = slicing ? MX[0] - LT / 2 + LT * (M.phase === 'run' ? slicePos(M.g) : 0) : M.active ? MX[M.step] : (M.last ? 8.2 : -6.4); if (slicing && M.phase === 'run') MK.bx = tx; else MK.bx += (tx - MK.bx) * Math.min(1, dt * 3); const onTurn = !M.active && M.last && MK.bx > 7.6;
  J.group.position.set(MK.bx + (M.active && !slicing && act(M.step) ? Math.sin(t * 40) * .01 : 0), onTurn ? 1.15 + Math.sin(t * 2) * .05 : 1.14, 0);
  J.group.rotation.y = onTurn ? t * .8 : 0; MK.turn.rotation.y = t * .8; MK.sx = (MK.sx || 1) + ((slicing ? 2.4 : 1) - (MK.sx || 1)) * Math.min(1, dt * 5); J.group.scale.set(.42 * MK.sx, .42 * (slicing ? .86 : M.active && M.step >= 1 ? .92 : 1), .42);
  // 切口：切片中停在最後一刀的位置跟著本體走；切完後剩下的那一段慢慢揉回完整的一團
  if (MK.clipP) {
    if (!slicing) MK.clipU += (1.1 - MK.clipU) * Math.min(1, dt * 2.5);
    J.group.updateMatrixWorld(true); MK.clipP.set(tmpV.set(-1, 0, 0), MK.clipU).applyMatrix4(J.group.matrixWorld);
    MK.cap.visible = J.group.visible && MK.clipU < .99; MK.cap.position.x = MK.clipU;
    if (MK.capGlint > 0) { MK.capGlint = Math.max(0, MK.capGlint - dt * 1.8); MK.cap.material.emissiveIntensity = (MK.capBase || 0) + MK.capGlint; }
  }
  jellyCut(J, !M.active && M.last ? M.last : null); cutLinesStep(slicing); if (!MK.pieces) MK.pieces = []; piecesStep(dt); cutFxStep(dt);
  if (W.sample) W.sample.rotation.y = t * .6; if (W.liveSample) { W.liveSample.rotation.y = -t * .4; W.liveSample.position.y = 1.4 + Math.sin(t * 2) * .04; }
  if (W.neon) W.neon.forEach((n, i) => n.scale.y = .7 + .3 * Math.abs(Math.sin(t * 1.5 + i))); if (W.recLed) W.recLed.visible = L.on ? Math.sin(t * 6) > 0 : false;
}

/* ============================================================
   能量門與探索謎題
   ============================================================ */
const GATES = { coast: { x: 45 * K, z: 0, ex: 64 * K, ez: 2.4 * K, title: '破碎的古地圖' }, volcano: { x: 0, z: -45 * K, ex: -2.4 * K, ez: -64 * K, title: '潮汐石陣' } }; // 能量門立在山洞的內側洞口（第 4 堂）
const QUEST = {
  coast: { from: 'forest', title: '破碎的古地圖', need: 2, hint: '森林各處藏著 5 片古地圖碎片，只有靠近時才會微微發光。集齊後，到東方能量門前的古地圖石台，把地圖拼回原狀。' },
  volcano: { from: 'coast', title: '潮汐石陣', need: 4, hint: '海灘上散落著 3 張被撕碎的紙條。拼湊出完整的謎語後，依序點亮六顆潮汐石中的四顆，順序錯了會重來。' },
};
const FRAG_SPOTS = [[-34, 30], [38, -34], [-14, -42], [22, 38], [-41, -16]].map(kk), ALTAR = kk([44, 5]), NOTES = [[66, 22], [81, -4], [71, -32]].map(kk);
const TIDE_SPOTS = [[63, -15], [66.5, -18], [70, -15], [73.5, -18], [77, -15], [80.5, -18]].map(kk), TABLET = kk([-16, -63]), PILLARS = [[-10, -67], [-3.5, -69], [3.5, -69], [10, -67]].map(kk);
const PUZ_SPOTS = [...FRAG_SPOTS, ALTAR, ...NOTES, ...TIDE_SPOTS, TABLET, ...PILLARS];
const TIDE = [{ c: '#ef4444', n: '紅' }, { c: '#f97316', n: '橘' }, { c: '#facc15', n: '黃' }, { c: '#22c55e', n: '綠' }, { c: '#3b82f6', n: '藍' }, { c: '#a855f7', n: '紫' }];
const TIDE_ORDER = [1, 4, 0, 3], TIDE_LAYOUT = [3, 0, 5, 1, 4, 2];
const PILLAR = ['ice', 'grass', 'salt', 'coral', 'lava', 'honey'], PILLAR_ANS = [0, 1, 2, 3];
const NOTE_TXT = ['……第 1 個醒來的，是熔岩史萊姆身上燃燒的顏色……', '……第 2 個，是海鹽史萊姆的顏色；第 3 個，是彩虹最外圈的那一道……', '……第 4 個，也是最後一個，是青草史萊姆的顏色。其餘的石頭，千萬不要碰。'];
// 潮汐石陣的 4 個步驟：n 是這一步的線索寫在第幾張紙條上
const TIDE_STEP = [{ n: 0, t: '熔岩史萊姆身上燃燒的顏色' }, { n: 1, t: '海鹽史萊姆的顏色' }, { n: 1, t: '彩虹最外圈的那一道' }, { n: 2, t: '青草史萊姆的顏色' }];
const PILLAR_HINT_ORDER = [0, 3, 2, 1];
const TABLET_TXT = '寒冰之心立於最左，<br>海底之花守在最右。<br>海鹽從不與寒冰比鄰，<br>剩下的那一根，長出初春的嫩草。';
/* ---------- 火山相關謎題的輔助：線索判定、標籤、提示 ---------- */
const pSp = v => SP[PILLAR[v]];
const ENTER = () => (TOUCH ? '點擊' : '按 E');
function pillarClues(pil) {
  const sp = pil.map(v => PILLAR[v]), at = id => sp.indexOf(id);
  return [
    { t: '四根柱子分別是冰晶、海鹽、珊瑚，以及長出初春嫩草的青草史萊姆，各一根', ok: ['ice', 'salt', 'coral', 'grass'].every(id => sp.filter(x => x === id).length === 1) },
    { t: '寒冰之心（冰晶史萊姆）立在最左邊（第 1 根）', ok: sp[0] === 'ice' },
    { t: '海底之花（珊瑚史萊姆）守在最右邊（第 4 根）', ok: sp[3] === 'coral' },
    { t: '海鹽史萊姆從不與冰晶史萊姆相鄰', ok: at('salt') >= 0 && at('ice') >= 0 && Math.abs(at('salt') - at('ice')) > 1 },
  ];
}
const cluesDone = () => pillarClues(qState().pil).filter(c => c.ok).length;
function pillarExtra() {
  const q = qState(), cl = pillarClues(q.pil);
  return `<div class="clues">${cl.map(c => `<div class="${c.ok ? 'ok' : ''}"><b>${c.ok ? '✓' : '○'}</b><span>${c.t}</span></div>`).join('')}<div class="slots">${q.pil.map((v, i) => `<span>${i + 1}.${dot(pSp(v).color)}${short(PILLAR[v])}</span>`).join('')}</div></div>`;
}
function tideStepsHTML() {
  const q = qState();
  return `<div class="clues">${TIDE_STEP.map((s, i) => { const done = i < q.tide.length, have = q.notes.includes(s.n); return `<div class="${done ? 'ok' : ''}"><b>${done ? '✓' : i + 1}</b><span>${have ? '第 ' + (i + 1) + ' 個醒來：' + esc(s.t) : '第 ' + (i + 1) + ' 個醒來：？？？（還有紙條沒找到）'}${done ? '　→ ' + TIDE[TIDE_ORDER[i]].n + '色' : ''}</span></div>`; }).join('')}</div>`;
}
function questExtra(k) {
  const q = qState();
  if (k === 'volcano' && (q.notes.length || q.tide.length)) return tideStepsHTML();
  if (k === 'snow' && q.read.tablet) return pillarExtra();
  return '';
}
function hintLines(k) {
  const q = qState(), n = q.hints[k], out = [];
  for (let i = 0; i < n; i++) {
    if (k === 'tide') out.push(i === 0 ? '一共要依序點亮 4 顆石頭，另外 2 顆不是答案，千萬不要碰。' : `第 ${i} 步要點亮的是：${TIDE[TIDE_ORDER[i - 1]].n}色的石頭。`);
    else { const p = PILLAR_HINT_ORDER[i]; out.push(`第 ${p + 1} 根應該是：${SP[PILLAR[PILLAR_ANS[p]]].name}。`); }
  }
  return out;
}
function hintBlock(k) {
  const q = qState(), max = k === 'tide' ? 5 : 4, n = q.hints[k], lines = hintLines(k);
  return `<div class="hintbox">${lines.map(l => `<div>提示：${l}</div>`).join('')}<button class="btn sm ghost" data-act="hint" data-k="${k}" ${n >= max ? 'disabled' : ''}>${n >= max ? '提示已全部揭露' : n ? '再給一點提示' : '卡住了？需要提示'}（${n}/${max}）</button></div>`;
}
function giveHint(k) {
  const q = qState(), max = k === 'tide' ? 5 : 4; if (q.hints[k] >= max) return; q.hints[k]++; sfx.pop(); save();
  toast('已揭露一則提示（可在探索日誌重新查看）'); renderQuest(); if (tab === 'riddle') renderRiddle(); objSig = ''; renderObjective();
}
function beam(parent, color, h = 7, r = .2, y = 0) {
  const m = mesh(new THREE.CylinderGeometry(r, r, h, 12, 1, true), new THREE.MeshBasicMaterial({ color, transparent: true, opacity: .16, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }), 0, y + h / 2, 0, parent);
  m.userData.isBeam = true; return m;
}
function putLabel(g, key, txt, color, sub, y, sx = 1.6, sy = .5) {
  if (g.userData[key]) dropObj(g.userData[key]);
  const lb = textSprite(txt, color, sub); lb.position.set(0, y, 0); lb.scale.set(sx, sy, 1); lb.userData.keep = true; g.add(lb); g.userData[key] = lb; return lb;
}
function stoneLabel(g, ci) {
  const step = qState().tide.indexOf(ci);
  if (step >= 0) putLabel(g, 'lab', `第 ${step + 1} 步`, TIDE[ci].c, TIDE[ci].n + '色', 2.55, 1.5, .47); else putLabel(g, 'lab', TIDE[ci].n + '色', TIDE[ci].c, '', 2.45, 1.45, .45);
}
function refreshStones() { W.puz.forEach(p => { if (p.pz.type === 'tide') stoneLabel(p.obj, p.pz.c); }); }
function pillarLabel(g, v, i) { putLabel(g, 'lab', short(PILLAR[v]), pSp(v).color, `第 ${i + 1} 根`, 4.1, 1.7, .53); }
function showPillarBeams() { W.puz.forEach(p => { if (p.pz.type === 'pillar' && !p.obj.userData.beam) p.obj.userData.beam = beam(p.obj, '#fde68a', 6, .28, 3.1); }); }
function volcanoHint(zid) {
  if (false) { W.volHint = true; setTimeout(() => toast('火山腳下有一座發光的石碑，往光柱的方向走，看看上面刻了什麼。'), 700); }
}
function qState() {
  if (!S.q) S.q = {}; const q = S.q; q.frags = q.frags || []; q.notes = q.notes || []; q.tide = q.tide || []; q.read = q.read || {};
  q.hints = q.hints || {}; q.hints.tide = Math.max(0, Math.min(5, +q.hints.tide || 0)); q.hints.pillar = Math.max(0, Math.min(4, +q.hints.pillar || 0));
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
  // 能量門立在山洞的內側洞口裡（第 4 堂）：擋路由 caves.js 的 caveBlock 處理，這裡只有外觀與互動
  Object.keys(GATES).forEach(k => {
    if (S.zones.includes(k)) return; const c = CAVES.find(o => o.def.gate === k); if (!c) return;
    const w = c.Wd[0], h = c.Hh[0], g = new THREE.Group(); g.position.set(c.X[0] + c.TX[0] * 1.4, c.y0, c.Z[0] + c.TZ[0] * 1.4); g.rotation.y = Math.atan2(c.TX[0], c.TZ[0]); W.scene.add(g);
    const rockM = std('#475569', { flatShading: true, roughness: .9 });
    [-1, 1].forEach(o => { const r = mesh(jit(new THREE.CylinderGeometry(.32, .48, h * .95, 7, 3), .25, o + 3), rockM, o * w * .9, h * .47, 0, g); r.castShadow = !LOW; });
    const mat = new THREE.MeshBasicMaterial({ color: '#a78bfa', map: gateTex, transparent: true, opacity: .55, side: THREE.DoubleSide, depthWrite: false, blending: THREE.AdditiveBlending });
    mesh(new THREE.PlaneGeometry(w * 1.85, h * .94), mat, 0, h * .47, 0, g);
    const run = textSprite('能量門', '#c4b5fd', '需解開：' + GATES[k].title); run.position.set(0, h + 1.8, -2.6); g.add(run);
    const it = addInter(hitBox(w * 1.85, h, .6, 0, h / 2, 0, g), 'gate', k, '能量門');
    caveSetLayers(g, 1); W.gates[k] = { g, mat, col: null, it, fade: 0 };
  });
  buildColdWall();
  W.anim.push((dt, t) => { if (gateTex) gateTex.offset.y = t * .3; Object.keys(W.gates).forEach(k => { const gt = W.gates[k]; if (gt.fade > 0) { gt.fade -= dt; gt.mat.opacity = .55 * Math.max(0, gt.fade); if (gt.fade <= 0) { dropObj(gt.g); delete W.gates[k]; } } else gt.mat.opacity = .45 + Math.sin(t * 2) * .1; }); });
}
function openGate(k) {
  const gt = W.gates[k]; if (!gt) return; gt.fade = 1.5;
  for (const arr of W.cols.values()) { const i = arr.indexOf(gt.col); if (i >= 0) arr.splice(i, 1); }
  W.inter = W.inter.filter(it => it !== gt.it);
}
function discoverZone(k, o = {}) { // o.quiet：自己買保暖衣觸發的解鎖不跳彈窗，只留一則 toast
  if (S.zones.includes(k)) return; S.zones.push(k); gainXP(50, '發現新區域'); save(); sfx.pop(); setTimeout(() => sfx.pop(), 250); openGate(k); if (!W.mirror) spawnZone(k);
  const z = ZONES.find(z => z.id === k), dir = { coast: '東', volcano: '北', snow: '西' }[k];
  const txt = { coast: '古地圖重新拼合，石台發出光芒，東方海蝕洞口的能量門應聲碎裂。', volcano: '四顆潮汐石依序亮起，海面退潮，北方熔岩隧道口的能量門隨之消散。', snow: '穿上厚實的保暖衣，從冰洞裡吹出來的刺骨寒氣不再擋住你的去路。' }[k];
  const lmk = { coast: '燈塔', volcano: '冒煙的火山口', snow: '冰晶塔' }[k], cvn = { coast: '海蝕洞', volcano: '熔岩隧道', snow: '冰洞' }[k];
  if (!o.quiet) modal(`<h2>發現新區域：${z.name}</h2><p>${txt}</p>${lmk ? `<p>抬頭找<b>${lmk}</b>：往它的方向走就對了（指南針上也有標示）。</p>` : ''}${k === 'snow' ? `<p>往西走進<b>冰洞</b>，穿過去就是雪原，新的史萊姆正在等你。</p><p><b>雪原極度寒冷：</b>每次進入只有 <b>10 分鐘</b>的體溫（畫面左側的體溫條），歸零就會凍僵——身體發抖、行動變慢。要回<b>大城市的醫院</b>付 ¥20 看醫生才會痊癒。</p>` : `<p>${dir}方的<b>${cvn}</b>已經開啟：穿過山洞就是${z.name}，新的史萊姆正在等你。洞裡地上有一道發光的痕跡會帶你走到出口。</p>`}`, [{ t: '出發' }]);
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
      beam(g, '#fef3c7', 6, .16); add(g, { type: 'note', i }, '被撕碎的紙條', .8);
    });
    TIDE_LAYOUT.forEach((ci, i) => {
      const [x, z] = TIDE_SPOTS[i], g = new THREE.Group(); g.position.set(x, H(x, z), z); W0.add(g);
      const stn = mesh(jit(new THREE.DodecahedronGeometry(.7, 1), .25, i + 5), std('#64748b', { flatShading: true, roughness: .9 }), 0, .5, 0, g); stn.scale.set(1, 1.3, 1); stn.castShadow = !LOW;
      g.userData.gem = mesh(new THREE.OctahedronGeometry(.25), new THREE.MeshStandardMaterial({ color: TIDE[ci].c, emissive: TIDE[ci].c, emissiveIntensity: q.tide.includes(ci) ? 1.8 : .15, roughness: .2 }), 0, 1.55, 0, g);
      addCol({ x, z, r: .8 }); add(g, { type: 'tide', c: ci, g }, `潮汐石（${TIDE[ci].n}色）`, 1.2); stoneLabel(g, ci);
    });
  }
  W.anim.push((dt, t) => W.puz.forEach((it, i) => {
    const o = it.obj, d = Math.hypot(o.position.x - P.x, o.position.z - P.z);
    if (it.pz.type === 'frag') o.userData.frag.material.emissiveIntensity = d < 14 ? .3 + (Math.sin(t * 3 + i) + 1) * .35 * (1 - d / 14) : .03;
    if (it.pz.type === 'pillar') o.userData.cr.rotation.y = t;
    if (it.pz.type === 'tide') {
      const gm = o.userData.gem.material;
      if (o.userData.flash > 0) { o.userData.flash -= dt; gm.emissive.set('#ef4444'); gm.emissiveIntensity = 3 * Math.max(0, o.userData.flash / .6); if (o.userData.flash <= 0) gm.emissive.set(TIDE[it.pz.c].c); }
      else if (!qState().tide.includes(it.pz.c)) gm.emissiveIntensity = .15 + (Math.sin(t * 2 + i) + 1) * .1;
    }
    if (it.pz.type === 'altar') o.userData.plate.material.emissiveIntensity = qState().frags.length >= 5 ? .5 + Math.sin(t * 3) * .3 : .1;
  }));
}
function setPillar(g, v, i) { const c = pSp(v).color; g.userData.cr.material.color.set(c); g.userData.cr.material.emissive.set(c); pillarLabel(g, v, i); }
function removePuz(it) { W.scene.remove(it.obj); W.puz = W.puz.filter(x => x !== it); W.inter = W.inter.filter(x => x !== it); }
function puzzleTap(it) {
  const q = qState(), pz = it.pz; sfx.tick();
  const zoneOf = { frag: 'coast', altar: 'coast', note: 'volcano', tide: 'volcano', tablet: 'snow', pillar: 'snow' }[pz.type];
  // 解開後（或正在開門的 0.5 秒內）再點不會打亂狀態
  if (S.zones.includes(zoneOf) || W.solving === zoneOf) return toast('這道謎題已經解開了。');
  if (!questReady(zoneOf) && pz.type !== 'tablet') { const Q = QUEST[zoneOf]; return toast(`${it.name}被一股力量封印著……先用${ZONES.find(z => z.id === Q.from).name}的史萊姆做出 ${Q.need} 個捏捏（目前 ${madeIn(Q.from)}）。`); }
  const above = (h = 1) => it.obj.position.clone().setY(it.obj.position.y + h);
  if (pz.type === 'frag') {
    if (!q.frags.includes(pz.i)) { q.frags.push(pz.i); gainXP(5); } fx3(above(1), `古地圖碎片 ${q.frags.length}/5`, '#fde68a');
    removePuz(it); sfx.pop(); save(); renderQuest(); toast(q.frags.length >= 5 ? '五片碎片都找到了！到東方能量門前的古地圖石台把地圖拼回原狀。' : `取得古地圖碎片（${q.frags.length}/5）`);
  } else if (pz.type === 'altar') openAltar();
  else if (pz.type === 'note') {
    if (!q.notes.includes(pz.i)) { q.notes.push(pz.i); gainXP(5); } removePuz(it); sfx.pop(); save(); renderQuest(); objSig = ''; renderObjective();
    const all = q.notes.length >= 3; if (W.goo) W.goo.emit(above(1.2), 10, '#fde68a', { collect: true }); // 紙條化成光點飛進手裡，拿在面前讀（完整的謎語在目標面板）
    talk(noteWho('撕碎的紙條 ' + q.notes.length + '/3'), [NOTE_TXT[pz.i]], { end: () => bark(SELF, all ? '謎語拼完整了！照紙條上的順序，去點亮潮汐石吧。' : '還有紙條散在海灘上……找找地上發光的光柱。') });
  } else if (pz.type === 'tide') {
    if (q.notes.length < 3) return toast('潮汐石毫無反應……先把三張紙條都找齊，弄清楚完整的謎語。');
    if (q.tide.includes(pz.c)) return toast('這顆石頭已經亮了。');
    const step = q.tide.length;
    if (pz.c !== TIDE_ORDER[step]) {
      q.tide = []; sfx.squish(1); fx3(above(2.4), '順序不對', '#fb7185'); toast(`第 ${step + 1} 步點錯了，所有石頭的光都熄滅了，請從第 1 步重新開始。`);
      W.puz.forEach(p => { if (p.pz.type === 'tide') p.obj.userData.flash = .6; }); refreshStones(); save(); renderQuest(); renderObjective(); return;
    }
    q.tide.push(pz.c); pz.g.userData.gem.material.emissiveIntensity = 1.8; fx3(above(2.4), `第 ${q.tide.length} 步 ✓`, TIDE[pz.c].c); refreshStones();
    if (q.tide.length === TIDE_ORDER.length) { W.solving = 'volcano'; setTimeout(() => discoverZone('volcano'), 500); } else sfx.machine(0);
    save(); renderQuest(); renderObjective();
  } else if (pz.type === 'tablet') {
    q.read.tablet = true; showPillarBeams(); save(); renderQuest(); objSig = ''; renderObjective(); openGui('riddle');
  } else if (pz.type === 'pillar') {
    if (!q.read.tablet) return toast('熔岩柱燙得無法靠近……先去讀一讀附近石碑上的古文。');
    const before = cluesDone(); q.pil[pz.i] = (q.pil[pz.i] + 1) % PILLAR.length; setPillar(pz.g, q.pil[pz.i], pz.i); sfx.machine(2); save();
    const after = cluesDone(); toast(`第 ${pz.i + 1} 根：${pSp(q.pil[pz.i]).name}（已滿足 ${after}/4 條線索）`);
    if (after > before) { fx3(above(3.4), `線索 ${after}/4 ✓`, '#34d399'); sfx.tick(); }
    renderQuest(); objSig = ''; renderObjective();
    if (q.pil.every((v, i) => v === PILLAR_ANS[i])) { W.solving = 'snow'; setTimeout(() => discoverZone('snow'), 500); }
  }
}
function questTarget() {
  const k = nextQuest(); if (!k || !S.zones.includes(QUEST[k].from)) return null; const q = qState(), E = ENTER();
  const nearest = (list, have, n, h, d) => { let b = null, bd = 1e9; list.forEach(([x, z], i) => { if (have.includes(i)) return; const dd = Math.hypot(x - P.x, z - P.z); if (dd < bd) { bd = dd; b = { x, z, n, h, d }; } }); return b; };
  if (k === 'coast') return q.frags.length >= 5 ? { x: ALTAR[0], z: ALTAR[1], n: '古地圖石台', h: `對準石台${E}，把古地圖拼回原狀。` } : nearest(FRAG_SPOTS, q.frags, '古地圖碎片', `碎片就落在附近的地上，靠近時會微微發光，對準後${E}撿起。`);
  if (k === 'volcano') return q.notes.length >= 3
    ? { x: TIDE_SPOTS[2][0], z: TIDE_SPOTS[2][1], n: '潮汐石陣', h: `對準石頭${E}，依紙條的順序點亮四顆（已點亮 ${q.tide.length}/4）。`, d: `前往潮汐石陣，依序點亮四顆石頭（已點亮 ${q.tide.length}/4）。` }
    : nearest(NOTES, q.notes, '撕碎的紙條', `紙條壓在地上的小石頭下，會發出一道微光。對準後${E}撿起（已找到 ${q.notes.length}/3）。`, `沿著光柱找出海灘上的 3 張紙條（已找到 ${q.notes.length}/3）。`);
  if (k === 'snow') return q.read.tablet
    ? { x: 0, z: PILLARS[1][1], n: '熔岩柱', h: `對準熔岩柱${E}切換晶石的史萊姆種類，上方會顯示名稱；左上角的清單會告訴你哪些線索已滿足。`, d: `依照石碑線索設定四根熔岩柱（已滿足 ${cluesDone()}/4 條線索）。` }
    : { x: TABLET[0], z: TABLET[1], n: '古老的石碑', h: `對準石碑${E}，閱讀上面的古文。`, d: '火山腳下有一座發光的石碑，朝光柱的方向走，去讀一讀。' };
  return null;
}
function renderQuest() { ui('inv'); } // 探索日誌在背包分頁裡（components/stations/Inventory.tsx）

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
  glowgrass: { pat: 0, c2: '#ecfccb', deep: '#0f766e', iris: '#134e4a', rim: '#d9f99d', core: '#fefce8' },
  nightcoral: { pat: 3, c2: '#fbcfe8', deep: '#6d28d9', iris: '#3b0764', rim: '#ede9fe', core: '#fdf4ff' },
  ember: { pat: 4, c2: '#fecaca', deep: '#7f1d1d', iris: '#450a0a', rim: '#fed7aa', core: '#fff7ed' },
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
uniform float uNight;
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
      .replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\ntotalEmissiveRadiance += slPe * (1.0 - slFm) + diffuseColor.rgb * uNight * 0.32;')
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
  if ((sp.look || sp.id) === 'grass') {
    ud.sprout = add('g', () => mergeParts([[new THREE.CylinderGeometry(.022, .032, .3, 8).translate(0, .15, 0), '#3f7f45'],
      ...[-1, 1].map(s => { const l = new THREE.SphereGeometry(1, 14, 8); l.scale(.17, .028, .08); l.translate(.15, 0, 0); return [l, s < 0 ? '#4ade80' : '#22c55e', M4(0, .27, 0, s * .15, s < 0 ? Math.PI : 0, .45)]; }),
      [new THREE.SphereGeometry(.036, 10, 8), '#bbf7d0', M4(0, .305, 0)]], true), 'gm', phys({ roughness: .45, clearcoat: .3 }), 0, SL_H - .04, 0);
  } else if ((sp.look || sp.id) === 'honey') {
    const T = M4(.22, 1.1, -.1, .25, .3, -.42);
    add('g', () => mergeParts([[new THREE.CylinderGeometry(.17, .17, .075, 6), '#f59e0b', T],
      ...[[0, 0], [.075, .043], [-.075, .043], [0, -.086], [.075, -.043], [-.075, -.043], [0, .086]].map(([x, z]) => [new THREE.CylinderGeometry(.034, .034, .078, 6), '#b45309', T.clone().multiply(M4(x, .002, z))])], true), 'gm', phys({ roughness: .25 }));
  } else if ((sp.look || sp.id) === 'salt') {
    add('g', () => mergeParts([[0, 1, 0, .13, 1], [.27, .9, .1, .09, .6], [-.22, .93, -.14, .1, 1.3], [.06, .88, -.3, .08, 2.1], [-.13, .92, .24, .075, .4], [.18, .95, -.18, .06, 2.7]].map(([x, y, z, s, r], i) => {
      const o = sPos([x, y, z], s * .25); return [new THREE.BoxGeometry(1, 1, 1), i % 2 ? '#e0f2fe' : '#f8fafc', MQn(o.p, o.n, s, s * 1.35, s, r)];
    }), true), 'gm', phys({ roughness: .06, emissive: '#bae6fd', emissiveIntensity: .18 }));
  } else if ((sp.look || sp.id) === 'coral') {
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
  } else if ((sp.look || sp.id) === 'lava') {
    const fl = new THREE.Group(); fl.position.set(0, SL_H + .02, 0); F.add(fl); ud.flame = fl;
    mesh(once('fo', () => new THREE.ConeGeometry(.17, .55, 18).translate(0, .24, 0)), once('fom', () => new THREE.MeshBasicMaterial({ color: '#fb923c', transparent: true, opacity: .7, blending: THREE.AdditiveBlending, depthWrite: false })), 0, 0, 0, fl);
    mesh(once('fi', () => new THREE.ConeGeometry(.09, .32, 14).translate(0, .15, 0)), once('fim', () => new THREE.MeshBasicMaterial({ color: '#fde047', transparent: true, opacity: .95, blending: THREE.AdditiveBlending, depthWrite: false })), 0, 0, 0, fl);
  } else if ((sp.look || sp.id) === 'obsid') {
    add('g', () => mergeParts([[0, .85, -.5, 1.25], [.38, .65, -.62, .95], [-.38, .65, -.62, .95], [0, .4, -.92, .75], [.22, .95, -.12, .6], [-.25, .9, -.2, .5]].map(([x, y, z, s], i) => {
      const o = sPos([x, y, z], s * .1); return [new THREE.OctahedronGeometry(.16), i % 2 ? '#4c1d95' : '#2e1065', MQn(o.p, o.n, s * .62, s * 2.1, s * .62, i)];
    }), true), 'gm', phys({ roughness: .05, metalness: .35, emissive: '#4c1d95', emissiveIntensity: .3, flatShading: true }));
  } else if ((sp.look || sp.id) === 'ice') {
    add('g', () => mergeParts([...Array(7)].map((_, i) => {
      const a = i / 7 * PI2, r = i % 2 ? .45 : .56, o = sPos([Math.cos(a) * r, .85, Math.sin(a) * r], .1), s = i % 2 ? .75 : 1.1;
      return [new THREE.ConeGeometry(.065, .36, 6), i % 2 ? '#e0f2fe' : '#bae6fd', MQn(o.p, o.n, s, s, s, a)];
    }).concat([[new THREE.ConeGeometry(.085, .5, 6), '#f0f9ff', M4(0, SL_H + .2, 0)]]), true), 'gm', phys({ roughness: .04, emissive: '#7dd3fc', emissiveIntensity: .3, flatShading: true }));
  } else if ((sp.look || sp.id) === 'aurora') {
    add('g', () => mergeParts([[new THREE.CylinderGeometry(.014, .02, .36, 6), '#c4b5fd', M4(0, SL_H + .16, 0)], [new THREE.OctahedronGeometry(.085), '#fde047', M4(0, SL_H + .4, 0, .3, .5, 0)]], true), 'gm', () => new THREE.MeshBasicMaterial({ vertexColors: true }));
    ud.orbit = add('o', () => mergeParts(['#22d3ee', '#a78bfa', '#34d399', '#f0abfc'].map((c, i) => [new THREE.SphereGeometry(.06, 10, 8), c, M4(Math.cos(i / 4 * PI2) * 1.3, Math.sin(i * 2) * .18, Math.sin(i / 4 * PI2) * 1.3)]), true), 'om', () => new THREE.MeshBasicMaterial({ vertexColors: true }), 0, .75, 0);
    ud.orbit.castShadow = false;
  }
  if (sp.rar >= 3) {
    ud.halo = mesh(once('h', () => new THREE.TorusGeometry(.3, .026, 10, 48).rotateX(Math.PI / 2)), once('hm', () => new THREE.MeshBasicMaterial({ color: sp.rar >= 4 ? '#fde047' : '#f0abfc' })), 0, SL_H + .45, 0, F);
  }
}
function slimeMesh(sp) {
  const L0 = SLOOK[sp.id] || SLOOK[sp.look] || SLOOK.grass, g = new THREE.Group(), col = new THREE.Color(sp.color), C = k => new THREE.Color(k);
  const c1 = col.clone().offsetHSL(rnd(-.012, .012), rnd(-.04, .04), rnd(-.025, .025));
  const U = {
    uT: { value: 0 }, uSq: { value: new THREE.Vector4(1, 0, 0, 0) }, uDent: { value: new THREE.Vector4(0, .7, 1, 0) }, uRip: { value: new THREE.Vector4(9, 0, .012, rnd(0, 6)) },
    uNight: NIGHT_U, uC1: { value: c1 }, uC2: { value: C(L0.c2) }, uC3: { value: C(L0.deep) }, uLine: { value: C(L0.deep).multiplyScalar(.3) }, uIris: { value: C(L0.iris) },
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
  if (!e) { const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: emoTex(k), transparent: true, depthWrite: false, fog: false })); sp.renderOrder = 3; if (s.cave) sp.layers.mask = 3; s.m.add(sp); e = s.emo = { sp, t: 0, dur: 0, k }; }
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
    const h = H(x, z); if (h < 0 || h > 10 * K || !slimeGround(x, z, zid)) continue; return [x, z];
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
  let x0 = hx, z0 = hz; for (let i = 0; i < 6; i++) { const x = hx + rnd(-3, 3), z = hz + rnd(-3, 3); if (slimeGround(x, z, zid)) { x0 = x; z0 = z; break; } }
  const sl = newSlime(sp, m, { id: ++W.sid, sc: rnd(.66, .86), zid, hx, hz, x: x0, z: z0 });
  m.scale.setScalar(sl.sc); m.userData.body.userData.sl = sl; W.scene.add(m); W.slimes.push(sl); return sl;
}
function spawnZone(zid) { if (W.spawned.has(zid)) return; W.spawned.add(zid); const n = LOW ? 18 : 28; for (let i = 0; i < n; i++) spawnSlime(zid); }
function spawnAllSlimes() { S.zones.forEach(spawnZone); spawnStarter(); caveSpawnSlimes(); }
const STARTER = [0, 10.4];
function spawnStarter() {
  if (W.starter && W.slimes.includes(W.starter)) return;
  const sp = SP.grass, m = slimeMesh(sp), [x, z] = STARTER;
  const sl = newSlime(sp, m, { id: ++W.sid, sc: .82, zid: 'forest', hx: x, hz: z, x, z, tut: true, pers: 'calm', yaw: 0 });
  m.scale.setScalar(sl.sc); m.userData.body.userData.sl = sl; W.scene.add(m); W.slimes.push(sl); W.starter = sl;
  if (W.starterLabel) dropObj(W.starterLabel);
  const lb = textSprite('新手史萊姆', '#6ee7a8', '對準牠，捏 3 下'); lb.position.set(x, G(x, z) + 2.2, z); if (!S.tutDone) { W.scene.add(lb); W.starterLabel = lb; }
}
/* ---------- 行為與動畫 ---------- */
// 玩家走得到的地面：坡度不超過玩家能爬的、不在山脊上、在同一區（不會跑到能量門另一邊）
function slimeGround(x, z, zid) {
  const h = H(x, z); if (h < -.1) return false;
  const gx = H(x + .6, z) - H(x - .6, z), gz = H(x, z + .6) - H(x, z - .6); if (Math.hypot(gx, gz) / 1.2 > .75) return false;
  const ox = x / K, oz = z / K, r = Math.max(Math.abs(ox), Math.abs(oz)); if (Math.hypot(ox, oz + 130) < 8) return false;
  if (zid === 'forest') return r < 46; if (r < 61 || Math.abs(Math.abs(ox) - Math.abs(oz)) < 12 || r > 170) return false;
  return domBiome(x, z) === zid;
}
function moveSlime(s, dx, dz) {
  if (s.cave) return caveSlimeMove(s, dx, dz); // 洞穴史萊姆只在洞裡走
  const nx = s.x + dx, nz = s.z + dz, nh = H(nx, nz);
  if (nh > -.1 && Math.abs(nh - H(s.x, s.z)) < .5 && Math.hypot(nx, nz) > WS_R + 1 && (s.tut || s.giant || slimeGround(nx, nz, s.zid) || !slimeGround(s.x, s.z, s.zid))) { s.x = nx; s.z = nz; return true; }
  s.turn = 0; s.wa += Math.PI * rnd(.6, 1.4); s.hvx *= -.25; s.hvz *= -.25; return false;
}
const slPitch = s => clamp(1.25 - (s.sc - .66) * 1.6, .85, 1.3) * ({ lava: .82, obsid: .78, ice: 1.15, salt: 1.08, aurora: 1.1 }[s.sp.id] || 1);
let boingT = 0;
function slimeStep(dt, t) {
  boingT -= dt; const cam = W.cam.position, sneak = !!(P && P.sneak), running = !!(P && P.running && Math.hypot(P.vx || 0, P.vz || 0) > 5);
  W.slimes.forEach(s => {
    if (!s.mirror) { s.cool = Math.max(0, s.cool - dt); if (s.hits > 0 && (s.since = (s.since || 0) + dt) > 10) { s.hits = 0; s.perf = 0; } }
    s.sq = Math.max(0, s.sq - dt * 3); s.happy = Math.max(0, s.happy - dt);
    const dx = s.x - P.x, dz = s.z - P.z, dist = Math.hypot(dx, dz); s.m.visible = dist < 62 && !(s.sp.night && DN.night < .5) && (!s.cave || CV.c === s.cave);
    if (!s.m.visible) { s.noticed = false; s.flee = 0; return; }
    if (s.cave) caveSlimeStep(s, dt, dist); // 被視線正對著會慢慢縮起來（第 4 堂 6.2）
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
      if (s.tut || s.giant) { s.wSpd = 0; s.flee = 0; if (!cool && (s.noticed || dist < 7) && !s.air && !s.crouch && s.rest <= 0 && Math.random() < dt * .3) s.hopInPlace = true; }
      else if (cool) { s.wSpd = 0; }
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
    const c = Math.cos(s.yaw), sn = Math.sin(s.yaw), gy = s.cave ? caveSlimeY(s) : G(s.x, s.z), by = s.air / s.sc - .03;
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
function slimeHitCore(sl, who) {
  if (sl.cool > 0) return { res: 'shy' };
  if (sl.cave && sl.shrink > .7) return { res: 'curl' }; // 洞穴史萊姆縮成一團時捏不到
  if (sl.giant) { // 1.5 秒內要有兩位不同的玩家捏到，才算一下
    const now = performance.now(); (sl.gh = sl.gh || new Map()).set(who || NET.me || 'me', now); sl.sq = 1; sl.since = 0;
    if ([...sl.gh.values()].filter(t => now - t < 1500).length < 2) return { res: 'need2' };
    sl.gh.clear(); sl.hits++; if (sl.hits >= 3) { sl.hits = 0; sl.cool = 45; sl.happy = .6; giantWin(sl); return { res: 'giant' }; } return { res: 'hit', hits: sl.hits };
  } sl.hits++; sl.sq = 1; sl.since = 0; if (sl.hits >= 3) { sl.cool = sl.tut ? 2.5 : 6; sl.hits = 0; sl.happy = .6; return { res: 'harvest' }; } return { res: 'hit', hits: sl.hits }; }
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
  applyHit(sl, slimeHitCore(sl, NET.me), local, pt);
}
function splashAt(sl, pt, n) {
  if (!W.goo) return; const p = pt ? pt.clone() : sl.m.position.clone().setY(sl.m.position.y + .7 * sl.sc), dx = sl.x - P.x, dz = sl.z - P.z, d = Math.hypot(dx, dz) || 1;
  W.goo.emit(p, n, sl.sp.color, { gy: sl.m.position.y + .02, dx: -dx / d * .8, dz: -dz / d * .8 });
}
function applyHit(sl, r, local, pt, remote) {
  const top = sl.m.position.clone().setY(sl.m.position.y + (SL_H + .35) * sl.sc);
  if (r.res === 'need2') { if (!remote) slimeReact(sl, local, 'shy'); fx3(top, '巨型史萊姆要兩個人一起捏！（1.5 秒內）', '#fbbf24'); sfx.squish(.7, .6); return; }
  if (r.res === 'giant') { if (!remote) slimeReact(sl, local, 'harvest'); splashAt(sl, pt, 20); fx3(top, '合力捏開了！', '#f0abfc', 'big'); sfx.perfect(); return; }
  if (r.res === 'curl') { if (!remote) slimeReact(sl, local, 'shy'); fx3(top, '縮成一團了……別一直盯著牠，從側面慢慢靠近', '#c4b5fd'); sfx.squish(.3, slPitch(sl) * 1.1); return; }
  if (r.res === 'shy') { if (!remote) slimeReact(sl, local, 'shy'); fx3(top, `休息中，${Math.max(1, Math.ceil(sl.cool || 0))} 秒後恢復`, '#93c5fd'); sfx.squish(.35, slPitch(sl) * .9); ringPulse('cool'); return; }
  if (!remote) { slimeReact(sl, local, r.res); splashAt(sl, pt, r.res === 'harvest' ? 12 : 7); sfx.squish(.85, slPitch(sl)); }
  if (navigator.vibrate) navigator.vibrate(r.res === 'harvest' ? [10, 30, 14] : 8);
  const perfect = sl.perf > 0;
  if (r.res === 'harvest') {
    W.hitstop = .09;
    const bonus = sl.perf >= 2 ? 1 : 0, n = Math.max(1 + S.up.net + bonus, S.tutDone ? 0 : 2); sl.happy = .6; S.gel[sl.sp.id] = (S.gel[sl.sp.id] || 0) + n; discover(sl.sp.id); gainXP(XP_HARV[sl.sp.rar] + bonus);
    fx3(top, `+${n} ${short(sl.sp.id)}凝膠`, sl.sp.color, 'big'); sfx.pop();
    if (bonus) { setTimeout(() => fx3(top.clone().setY(top.y + .5), '完美節奏！額外 +1', '#f0abfc', 'big'), 220); sfx.perfect(); if (!emoteOn(sl) || sl.emo.k !== 'star') emote(sl, 'star'); }
    if (W.goo) W.goo.emit(sl.m.position.clone().setY(sl.m.position.y + .7 * sl.sc), 3 + n * 3, sl.sp.color, { collect: true, size: .07, up: 3.5, speed: 1.2 });
    toast(`採集到 ${n} 份${SP[sl.sp.id].name}凝膠${bonus ? '（完美節奏加成）' : ''}`); if (!S.tutDone) coachFlash(`凝膠飛進你的手裡了！（+${n}）`, 2600); renderHotbar(true); sl.perf = 0;
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
  if (!inCity(sp.x) && !caveAt(sp.x, sp.z) && (!regionOK(sp.x, sp.z) || coldBlocked(sp.x, sp.z))) sp = { x: 0, z: 16, yaw: 0 }; // 存檔在山洞裡（山脊底下）：保留，開場時再放到洞的地面上
  P = { x: sp.x, z: sp.z, y: G(sp.x, sp.z), vy: 0, vx: 0, vz: 0, yaw: sp.yaw || 0, pitch: -.08, ground: true, r: .35, eye: 1.62, camY: G(sp.x, sp.z), bob: 0, stepT: 0, coy: 0, jb: 0, sneak: false, running: false, dip: 0, dipV: 0, roll: 0 };
}
// 腳下的地面材質（決定腳步聲）
function surfaceAt(x, z) {
  if (CV.c) { const k = caveSurface(); if (k) return k; }
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
    const k = e.code, tg = e.target;
    // 輸入框裡打字不觸發快捷鍵；Esc 例外：文字框先失焦，滑桿（音量）直接關介面，所以 Esc 再按一次一定關得掉選單
    if (tg.tagName === 'INPUT') { if (k !== 'Escape' || !GUI.kind) return; if (tg.type !== 'range' && tg.type !== 'checkbox') { tg.blur(); return; } }
    if (!$('#modal').hidden || TITLE.on) return;
    if (k === 'Escape') { if (GUI.kind) closeGui(); else openGui('pause'); return; }
    // Alt：暫時解鎖滑鼠但不暫停遊戲；再按一次 Alt 或點擊畫面就回到操控
    if (k === 'AltLeft' || k === 'AltRight') { e.preventDefault(); if (GUI.kind || TOUCH) return; if (locked()) { W.altFree = true; unlockMouse(); showFreeHint(); } else { W.altFree = false; lockMouse(); } return; }
    if ((k === 'KeyT' || k === 'Enter') && NET.on && !GUI.kind) { e.preventDefault(); openChat(); return; }
    // Tab 在暫停選單裡留給鍵盤在按鈕之間移動
    if (k === 'KeyI' || (k === 'Tab' && GUI.kind !== 'pause')) { e.preventDefault(); GUI.kind === 'inv' ? closeGui() : openGui('inv'); return; }
    if (GUI.kind) {
      if (GUI.kind === 'line' && M.active) { if (k === 'Space') { e.preventDefault(); if (!e.repeat) { makeAction('tap'); makeAction('hold', true); } } if (k === 'ArrowLeft' || k === 'KeyA') M.kdir = -1; if (k === 'ArrowRight' || k === 'KeyD') M.kdir = 1; }
      if (k === 'KeyE' && GUI.kind !== 'line' && !e.repeat) closeGui(); return;
    }
    if (RIDE.on) { // 搭車中：只收「開快一點」與快捷列；移動鍵不進 KEYS，下車那一刻才不會暴衝
      if (['Space', 'KeyE', 'KeyF', 'Enter'].includes(k)) { e.preventDefault(); if (!e.repeat) RIDE.hk.set(k, performance.now()); }
      else if (/^Digit[1-9]$/.test(k)) { S.hb = +k.slice(5) - 1; renderHotbar(true); }
      return;
    }
    if (TK.cards && (k === 'Digit1' || k === 'Digit2')) { if (!e.repeat) tkPick(+k[5] - 1); return; } // 回話卡舉著時 1、2 是選卡，不切快捷列
    KEYS.add(k); if (k === 'Space') { e.preventDefault(); if (!e.repeat) jump(); }
    if ((k === 'KeyE' || k === 'KeyF') && !e.repeat) { act(); IN.holdE = true; IN.holdT = .55; }
    if (k === 'KeyQ' && !e.repeat && WARE.h && WARE.h.ph === 'read') wareBack(); // Q：把手上的商品放回去
    if (/^Digit[1-9]$/.test(k)) { if (WARE.h) wareBack(true); S.hb = +k.slice(5) - 1; renderHotbar(true); }
  });
  addEventListener('keyup', e => { KEYS.delete(e.code); RIDE.hk.delete(e.code); if (e.code === 'Space') makeAction('hold', false); if (e.code === 'KeyE' || e.code === 'KeyF') IN.holdE = false; if (['ArrowLeft', 'KeyA', 'ArrowRight', 'KeyD'].includes(e.code)) M.kdir = 0; });
  addEventListener('blur', () => { KEYS.clear(); RIDE.hk.clear(); IN.hold = IN.holdE = false; });
  cv.addEventListener('contextmenu', e => e.preventDefault());
  cv.addEventListener('wheel', e => { if (GUI.kind) return; if (WARE.h) wareBack(true); S.hb = (S.hb + (e.deltaY > 0 ? 1 : 8)) % 9; renderHotbar(true); }, { passive: true });
  addEventListener('keyup', e => { if (e.code === 'AltLeft' || e.code === 'AltRight') e.preventDefault(); });
  document.addEventListener('pointerlockchange', () => {
    document.body.classList.toggle('plock', locked()); // 滑鼠鎖住時才顯示右上角的「按 Alt 放開滑鼠」提示（menus.css）
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
      if (locked()) { if (e.button === 0 || e.button === 2) { act(); IN.hold = true; IN.holdT = .55; IN.hT = performance.now(); } return; } // IN.hT：搭車時判斷「上車之後才按下、按住 0.25 秒」＝開快一點
      IN.drag = { x: e.clientX, y: e.clientY, moved: 0, id: e.pointerId }; lockMouse(); return;
    }
    // 觸控：左下半部為搖桿，其他區域拖曳轉視角、輕點互動
    const w = innerWidth, h = innerHeight;
    if (!IN.joy && !RIDE.on && e.clientX < w * .45 && e.clientY > h * .4) { IN.joy = { id: e.pointerId, x0: e.clientX, y0: e.clientY }; const jb = $('#joyBase'); jb.style.left = (e.clientX - 60) + 'px'; jb.style.top = (e.clientY - 60) + 'px'; jb.classList.add('on'); }
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
  addEventListener('resize', () => { resizeWorld(); W.clkLay = ''; });
}
// 跳躍緩衝：落地前 0.15 秒內按下也會跳；離開地面 0.12 秒內仍可起跳（土狼時間）
function jump() { if (P) P.jb = .15; }
/* 區域保護：山脊只能從隘口通過；山脊外只能進入已解鎖的區域；火山口不能進入 */
function regionOK(x, z) {
  const ox = x / K, oz = z / K, ax = Math.abs(ox), az = Math.abs(oz), r = Math.max(ax, az);
  if (Math.hypot(ox, oz + 130) < 5.3) return false;
  if (r < 49) return true;
  const ew = ax >= az, side = ew ? (ox > 0 ? 'coast' : 'snow') : (oz < 0 ? 'volcano' : null);
  if (r <= 60) return false; // 山脊：要走山洞（caves.js），山洞裡不經過這裡的檢查
  if (Math.abs(ax - az) < 9) return false;
  return !!side && S.zones.includes(side);
}
/* 雪原的刺骨寒氣：第 4 堂起改在冰洞入口擋（caves.js 的 caveBlock），這裡只剩洞口的寒氣外觀 */
const coldBlocked = () => false;
function refreshCold() { if (W.coldWall) W.coldWall.visible = !S.own.coat; }
function buildColdWall() {
  const c = CAVES.find(o => o.id === 'ice'); if (!c) return; const wd = c.Wd[0], ht = c.Hh[0], w = new THREE.Group();
  w.position.set(c.X[0] + c.TX[0] * 1.2, c.y0, c.Z[0] + c.TZ[0] * 1.2); w.rotation.y = Math.atan2(c.TX[0], c.TZ[0]); W.scene.add(w); W.coldWall = w;
  mesh(new THREE.PlaneGeometry(wd * 1.9, ht * .95), new THREE.MeshBasicMaterial({ color: '#bae6fd', map: gateTex, transparent: true, opacity: .3, side: THREE.DoubleSide, depthWrite: false, blending: THREE.AdditiveBlending }), 0, ht * .48, 0, w);
  const lb = textSprite('刺骨寒氣', '#bae6fd', '需要保暖衣才能進入'); lb.position.set(0, ht + 1.6, -2.4); lb.scale.set(3.6, 1.12, 1); w.add(lb); caveSetLayers(w, 1); refreshCold();
}
function barrierMsg(msg) { const now = performance.now(); W.barT = W.barT || {}; if (now - (W.barT[msg] || 0) < 4000) return; W.barT[msg] = now; toast(msg); }
function barrierWhy(x, z) {
  const ox = x / K, oz = z / K, ax = Math.abs(ox), az = Math.abs(oz), r = Math.max(ax, az);
  if (Math.hypot(ox, oz + 130) < 5.3) return '火山口裡是滾燙的岩漿，太危險了，靠近不了。';
  const ew = ax >= az, side = ew ? (ox > 0 ? 'coast' : 'snow') : (oz < 0 ? 'volcano' : null);
  if (!side && r > 49) return '南方是陡峭的高山，一層層岩階爬不上去。';
  if (r <= 60 || Math.abs(ax - az) < 9) return '山脊太陡了，爬不上去。沿著小徑走到山洞口（路標會告訴你還有多遠）。';
  if (side && !S.zones.includes(side)) return side === 'snow' ? '刺骨的寒氣：穿上保暖衣才能進雪原（大城市武器店）。' : { coast: '東方能量門還封著：解開「破碎的古地圖」才能前往海岸。', volcano: '北方能量門還封著：解開「潮汐石陣」才能前往火山。' }[side];
  return '前面過不去了。';
}
function bumpTree(c) {
  const u = W.bumpU; if (!u) return; const v = u.value, now = performance.now(), same = v.x === c.x && v.y === c.z;
  if (same && now - (W.bumpT || 0) < 900) { v.z = Math.max(v.z, .5); return; }
  v.set(c.x, c.z, 1, 1 / Math.max(.6, c.r)); W.bumpT = now;
  if (S.sound) { const ac = audio(); noise(ac, ac.currentTime, .35, 2600, .6, .05, 'bandpass'); noise(ac, ac.currentTime + .08, .25, 1800, .6, .035, 'bandpass'); }
}
function tryMove(dx, dz) {
  { const cm = caveMove(dx, dz); if (cm !== undefined) return cm; } // 在山洞裡（或剛走進洞口）：地面與牆壁用山洞的曲線算
  let nx = P.x + dx, nz = P.z + dz; const h0 = G(P.x, P.z), h1 = G(nx, nz), d = Math.hypot(dx, dz) || 1e-6;
  if (h1 < -2.2) return false;
  const ux = dx / d, uz = dz / d, ha = G(P.x + ux * .7, P.z + uz * .7);
  if ((ha - h0) / .7 > 1.1) { const rr = Math.max(Math.abs(nx), Math.abs(nz)) / K; if (!inCity(nx) && rr > 44 && rr < 60) barrierMsg('山脊太陡了，爬不上去。沿著小徑走到山洞口（路標會告訴你還有多遠）。'); return false; }
  if (!inCity(nx) && !regionOK(nx, nz) && regionOK(P.x, P.z)) { if ((ha - h0) / .7 < .8) barrierMsg(barrierWhy(nx, nz)); return false; }
  if (coldBlocked(nx, nz) && !coldBlocked(P.x, P.z)) { const nw = performance.now(); if (!W.coldT || nw - W.coldT > 4000) { W.coldT = nw; toast('刺骨的寒氣擋住了去路……沒有保暖衣無法進入雪原。' + (armsOpen() ? '到大城市的武器店買一件吧。' : '升到 Lv ' + ARMS_LV + ' 後，大城市會開設武器店。')); } return false; }
  for (const c of colsNear(nx, nz)) {
    if (c.box) { const [x0, z0, x1, z1] = c.box, cx = clamp(nx, x0, x1), cz = clamp(nz, z0, z1), ddx = nx - cx, ddz = nz - cz, l = Math.hypot(ddx, ddz); if (l < P.r) { if (c.gate && GATES[c.gate]) barrierMsg({ coast: '東方', volcano: '北方' }[c.gate] + '能量門還封著：解開「' + GATES[c.gate].title + '」才能通過。'); if (c.msg) barrierMsg(c.msg); if (l < 1e-4) return false; nx = cx + ddx / l * P.r; nz = cz + ddz / l * P.r; } }
    else { const ddx = nx - c.x, ddz = nz - c.z, l = Math.hypot(ddx, ddz), R = c.r + P.r; if (l < R) { if (c.tree) bumpTree(c); if (l < 1e-4) return false; nx = c.x + ddx / l * R; nz = c.z + ddz / l * R; } }
  }
  if (inCity(nx) && W.npcs) for (const n of W.npcs) { const ox = CITY.x + n.x, oz = CITY.z + n.z, ddx = nx - ox, ddz = nz - oz, l = Math.hypot(ddx, ddz), RR = .34 * (n.d.kid || 1) + P.r; if (l < RR) { if (l < 1e-4) return false; nx = ox + ddx / l * RR; nz = oz + ddz / l * RR; } }
  { const b = cabBlock(nx, nz, P.r); nx = b[0]; nz = b[1]; } // 計程車會動，不在靜態的碰撞格子裡
  if (inCity(nx)) { const cx = nx - CITY.x, cz = nz - CITY.z; if (Math.abs(cx) > 70 || cz < -30 || cz > 44) { barrierMsg(cx < -70 && Math.abs(cz) < 14 ? '前面是回月光谷的隧道，用走的太遠了，搭計程車吧。' : '這個街區就到這裡了。想回月光谷，到醫院門口搭計程車。'); return false; } }
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
  const spd = (P.sneak ? 2.2 : run ? 7.5 : 4.3) * (1 + .1 * S.up.boots) * (S.frozen ? .5 : 1) * caveSpeed(run);
  const sy = Math.sin(P.yaw), cy = Math.cos(P.yaw), wx = (-sy * f + cy * s) * spd, wz = (-cy * f - sy * s) * spd;
  // 加速度與摩擦：起步與停下都有一點慣性，空中轉向較弱
  const acc = (P.ground ? ((f || s) ? 34 : 26 * caveSlip()) : 7) * dt; let ex = wx - P.vx, ez = wz - P.vz; const el = Math.hypot(ex, ez); if (el > acc && el > 1e-6) { ex *= acc / el; ez *= acc / el; }
  P.vx += ex; P.vz += ez; if (Math.abs(P.vx) < 1e-3) P.vx = 0; if (Math.abs(P.vz) < 1e-3) P.vz = 0;
  if (P.vx && !tryMove(P.vx * dt, 0)) P.vx = 0; if (P.vz && !tryMove(0, P.vz * dt)) P.vz = 0;
  P.jb = Math.max(0, P.jb - dt); P.coy = P.ground ? .12 : Math.max(0, P.coy - dt);
  if (P.jb > 0 && P.coy > 0) { P.vy = P.sneak ? 5.6 : 7.2; P.ground = false; P.coy = 0; P.jb = 0; sfx.jump(); }
  const vy0 = P.vy; P.vy -= 22 * dt; P.y += P.vy * dt; const g = G(P.x, P.z);
  if (P.y <= g) { if (!P.ground && vy0 < -3.5) { const k = clamp((-vy0 - 3.5) / 10, 0, 1); P.dipV -= 1.4 + k * 3.2; sfx.land(k, surfaceAt(P.x, P.z)); } P.y = g; P.vy = 0; P.ground = true; }
  else if (P.y - g > .25) P.ground = false;
  const hsp = Math.hypot(P.vx, P.vz), moving = hsp > .6 && P.ground; P.bob += moving ? dt * hsp * 2.1 : 0;
  if (moving) { P.stepT -= dt * hsp / 4.3; if (P.stepT < 0) { P.stepT = .42; const kd = surfaceAt(P.x, P.z), vv = P.sneak ? .35 : run ? 1.2 : 1; sfx.step(kd, vv); if (CV.k > .4) caveEcho(kd, vv); } }
  P.eye += ((P.sneak ? 1.18 : 1.62) - P.eye) * Math.min(1, dt * 10);
  P.dipV += (-P.dip * 160 - P.dipV * 14) * dt; P.dip = clamp(P.dip + P.dipV * dt, -.35, .2);
  P.camY += (P.y - P.camY) * Math.min(1, dt * 18);
}
// 產線特寫鏡頭：放在天棚下方（原本在屋頂上方，畫面被屋頂整片擋住），
// 並依畫面比例拉遠，讓整條產線出現在下方介面之上的區域
function lineViewPose() {
  const vf = W.cam.fov * Math.PI / 180, focus = M.active, ly = W.lineG ? W.lineG.position.y : WS_Y, lz = W.lineG ? W.lineG.position.z : -8, lx = W.lineG ? W.lineG.position.x : 0;
  const dist = focus ? clamp(3.6 / (Math.tan(vf / 2) * W.cam.aspect), 6.6, 13) : clamp(9.6 / (Math.tan(vf / 2) * W.cam.aspect), 8, 19), y = ly + (focus ? 3.8 : 4.7);
  const p = new THREE.Vector3(focus ? lx + MX[M.step] : .4, y, lz + dist), pitch = Math.atan2(y - (ly + 1.3), dist) + vf * (focus ? .2 : .24);
  return { p, t: p.clone().add(new THREE.Vector3(0, -Math.sin(pitch), -Math.cos(pitch))) };
}
const camT = new THREE.Vector3(), camQ = new THREE.Quaternion(), camE = new THREE.Euler(0, 0, 0, 'YXZ'), UP = new THREE.Vector3(0, 1, 0);
const ease3 = t => t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2, out3 = t => 1 - Math.pow(1 - t, 3), in3 = t => t * t * t;
/* 工作站的「介面表面」：介面會貼在這個面上展開，鏡頭最後正對它（GX 的 face 模式）。
   以點擊範圍（hitBox）的中心為原點：o＝表面中心、n＝表面朝外的方向、w×h＝大小（w:0＝用點擊範圍的寬）。
   n 是 +y 的是桌面類：鏡頭從正上方俯看，畫面的「上」取最接近玩家面向的桌邊。沒列在這裡的工作站用點擊範圍面向玩家的那一面。 */
const SURF = {
  pc: { o: [0, .45, -.27], n: [0, 0, 1], w: 1.5, h: .9, cover: 1 }, // 螢幕（含邊框；介面整個蓋住 3D 螢幕，不露出邊縫）
  bench: { o: [0, -.04, 0], n: [0, 1, 0], w: 2.2, h: 1.2 }, decor: { o: [0, .01, 0], n: [0, 1, 0], w: 2.6, h: 1.5 }, // 桌面
  mapg: { o: [0, 1.045, 0], n: [0, 1, 0], w: 1.3, h: 1.3 }, // 石台上的地圖
  board: { o: [0, .3, .31], n: [0, 0, -1], w: 4.4, h: 2 }, // 公告欄的板面
  shop: { o: [0, .5, -1.3], n: [0, 0, 1], w: 0, h: 3 }, // 店門口的櫥窗
};
function surfOf(it, kind) {
  const hit = it && it.hit; if (!hit || !hit.geometry) return null; hit.updateWorldMatrix(true, false);
  const c = new THREE.Vector3(), q = new THREE.Quaternion(), sc = new THREE.Vector3(); hit.matrixWorld.decompose(c, q, sc);
  const geo = hit.geometry; if (!geo.boundingBox) geo.computeBoundingBox(); const sz = geo.boundingBox.getSize(new THREE.Vector3()).multiply(sc);
  const ax = v => new THREE.Vector3(...v).applyQuaternion(q), lx = ax([1, 0, 0]), lz = ax([0, 0, 1]), toP = new THREE.Vector3(P.x - c.x, 0, P.z - c.z);
  const d = SURF[kind]; let n, w, h, u;
  if (d) { n = ax(d.n); c.add(ax(d.o)); w = d.w || sz.x; h = d.h; }
  else { const fx = Math.abs(lx.dot(toP)) > Math.abs(lz.dot(toP)); n = (fx ? lx : lz).clone(); if (n.dot(toP) < 0) n.negate(); w = fx ? sz.z : sz.x; h = sz.y; c.addScaledVector(n, (fx ? sz.x : sz.z) / 2); }
  if (Math.abs(n.y) > .7) { // 桌面：畫面的「上」＝離玩家最遠的那個桌邊方向
    const fwd = new THREE.Vector3(-Math.sin(P.yaw), 0, -Math.cos(P.yaw)), useZ = Math.abs(lz.dot(fwd)) >= Math.abs(lx.dot(fwd));
    u = (useZ ? lz : lx).clone(); if (u.dot(fwd) < 0) u.negate(); if (!useZ) [w, h] = [h, w];
  } else u = UP.clone();
  return { c, n, u, x: new THREE.Vector3().crossVectors(u, n), w, h, cover: d && d.cover };
}
// 取表面上和介面同比例的一塊（置中）：介面一開始等比例貼在上面，不會被拉扁；cover＝這一塊蓋住整個表面
function fitSurf(S, R) { const a = R.w / R.h; if ((S.w / S.h > a) !== !!S.cover) S.w = S.h * a; else S.h = S.w / a; return S; }
// 鏡頭最後停的位置：正對表面、表面（已裁成介面的比例）剛好等於介面矩形 R，並平移到讓表面中心對準 R 的中心
function facePose(S, R) {
  const cam = W.cam, th = Math.tan(cam.fov * Math.PI / 360), asp = cam.aspect, vw = innerWidth, vh = innerHeight;
  const d = clamp(Math.max(S.w / (2 * th * asp * R.w / vw), S.h / (2 * th * R.h / vh)), .7, 3.2);
  const ncx = (R.x + R.w / 2) / vw * 2 - 1, ncy = 1 - (R.y + R.h / 2) / vh * 2;
  const p = S.c.clone().addScaledVector(S.n, d).addScaledVector(S.x, -ncx * d * th * asp).addScaledVector(S.u, -ncy * d * th);
  return { p, q: new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(S.x, S.u, S.n)) };
}
function cameraStep(dt) {
  const cam = W.cam;
  // 推近工作站：在固定時間內從玩家視角轉到正對介面表面（和介面展開的進度同步，見 faceTrack）
  if (GUI.kind && GX.mode === 'face' && GX.to) { const s = GX.dur ? ease3(clamp(gxE() / GX.dur, 0, 1)) : 1; cam.position.lerpVectors(GX.from.p, GX.to.p, s); cam.quaternion.slerpQuaternions(GX.from.q, GX.to.q, s); W.camAway = true; return; }
  if (W.cottage) W.cottage.visible = GUI.kind !== 'line';
  if (GUI.kind === 'line') {
    const v = lineViewPose(), q = new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().lookAt(v.p, v.t, new THREE.Vector3(0, 1, 0)));
    cam.position.lerp(v.p, Math.min(1, dt * 4)); cam.quaternion.slerp(q, Math.min(1, dt * 4)); W.camAway = true;
    if (W.fovKick > 0) { W.fovKick = Math.max(0, W.fovKick - dt * 16); cam.fov = (W.fov0 || 72) - W.fovKick; cam.updateProjectionMatrix(); }
    if (W.shake > 0) { W.shake = Math.max(0, W.shake - dt * .5); cam.position.x += rnd(-1, 1) * W.shake; cam.position.y += rnd(-1, 1) * W.shake; }
    return;
  }
  // 頭部晃動：上下＋左右輕擺；側移時鏡頭微微傾斜；落地時鏡頭下沉回彈；奔跑時視野加寬
  const hsp = Math.hypot(P.vx, P.vz), mv = P.ground ? clamp(hsp / 4.3, 0, 1.4) : 0, bob = Math.abs(Math.sin(P.bob)) * .05 * mv - .025 * mv, side = Math.sin(P.bob) * .025 * mv;
  const cy = Math.cos(P.yaw), sy = Math.sin(P.yaw), target = camT.set(P.x + cy * side, P.camY + P.eye + bob + P.dip, P.z - sy * side);
  const lat = P.vx * cy - P.vz * sy; P.roll += ((-lat * .0045 + Math.sin(P.bob) * .004 * mv) - P.roll) * Math.min(1, dt * 8);
  if (W.camAway) {
    // 從工作站轉回來：位置與方向一起平順回到玩家視角（剛關掉貼在表面上的介面時，和介面收回的進度同步）
    camQ.setFromEuler(camE.set(P.pitch, P.yaw, P.roll, 'YXZ'));
    if (GX.mode === 'face' && GX.dir < 0 && GX.from) { const s = ease3(clamp(gxE() / GX.dur, 0, 1)); cam.position.lerpVectors(GX.from.p, target, s); cam.quaternion.slerpQuaternions(GX.from.q, camQ, s); }
    else { const k = Math.min(1, dt * 6); cam.position.lerp(target, k); cam.quaternion.slerp(camQ, k); }
    if (cam.position.distanceTo(target) < .05 && cam.quaternion.angleTo(camQ) < .02) W.camAway = false;
    return;
  }
  cam.position.copy(target);
  cam.rotation.set(P.pitch, P.yaw, P.roll, 'YXZ');
  if (S.frozen) { cam.position.x += Math.sin(W.t * 47) * .014; cam.position.y += Math.cos(W.t * 53) * .014; cam.rotation.z += Math.sin(W.t * 41) * .012; }
  const fov = (W.fov0 || 72) + (P.running && hsp > 5 ? 7 + 2.5 * S.up.boots : 0) - (P.sneak ? 4 : 0) - (WARE.h && WARE.h.ph === 'read' && !RM() ? 3 : 0); if (Math.abs(cam.fov - fov) > .02) { cam.fov += (fov - cam.fov) * Math.min(1, dt * 6); cam.updateProjectionMatrix(); }
}
function resizeWorld() { if (!W.r) return; const w = innerWidth, h = innerHeight; W.r.setSize(w, h, false); W.cam.aspect = w / h; W.fov0 = w / h < 1 ? 80 : 72; W.cam.fov = W.fov0; W.cam.updateProjectionMatrix(); }

/* ---------- 準心目標與互動 ---------- */
let TARGET = null;
function pickAt(ndcX, ndcY) {
  RAY.setFromCamera(new THREE.Vector2(ndcX, ndcY), W.cam); RAY.far = 7.5;
  const objs = [];
  W.slimes.forEach(s => { if (s.m.visible && Math.hypot(s.x - P.x, s.z - P.z) < 9) objs.push(s.m.userData.body); });
  W.inter.forEach(it => { if (it.off) return; const p = it.wp || (it.wp = it.hit.getWorldPosition(new THREE.Vector3())); if (Math.hypot(p.x - P.x, p.z - P.z) < 14) objs.push(it.hit); }); // 互動物件都是固定的，位置算一次即可
  AV.forEach(a => { if (a.hb && a.g.visible && Math.hypot(a.x - P.x, a.z - P.z) < 8) objs.push(a.hb); }); // 正在搭車的朋友（頭像藏起來）不能送凝膠
  if (W.npcs && inCity()) W.npcs.forEach(n => { if (Math.hypot(CITY.x + n.x - P.x, CITY.z + n.z - P.z) < 8) objs.push(n.m.hb); });
  const h = RAY.intersectObjects(objs, false); RAY.far = Infinity; if (!h.length) return null;
  const o = h[0].object; if (o.userData.npc) return { type: 'npc', n: o.userData.npc, d: h[0].distance }; if (o.userData.av) return { type: 'avatar', id: o.userData.av, d: h[0].distance }; if (o.userData.sl) return { type: 'slime', sl: o.userData.sl, d: h[0].distance, pt: h[0].point.clone() };
  const it = o.userData.it; if (!it) return null; if (it.kind === 'station' && h[0].distance > 5.5) return null; if ((it.kind === 'ware' || it.kind === 'counter') && h[0].distance > 3.4) return null; return { type: it.kind, it, d: h[0].distance }; // 店裡的商品、櫃台：3.4 m 內才算
}
function targetLabel(t) {
  if (!t) return '';
  const key = TOUCH ? '' : '<kbd>E</kbd>';
  if (t.type === 'slime') {
    const s = t.sl, sneakKey = TOUCH ? '潛行鍵' : '按住 C';
    const st = s.cool > 0 ? ` · 休息中 ${Math.ceil(s.cool)} 秒` : s.flee > 0 ? ` · <span style="color:#7dd3fc">逃跑中！${sneakKey}潛行靠近</span>` : ` · 採集 ${s.hits}/3`;
    const tip = s.cool <= 0 && !s.flee && s.pers === 'shy' && !P.sneak ? ` · <span style="color:#7dd3fc">怕生</span>` : s.cool <= 0 && s.pers === 'curious' && s.noticed ? ' · <span style="color:#f9a8d4">好奇</span>' : '';
    const cav = s.cave && s.cool <= 0 ? (s.shrink > .5 ? ' · <span style="color:#c4b5fd">縮成一團了，轉開視線等牠放鬆</span>' : ' · <span style="color:#c4b5fd">怕被盯著看，從側面靠近</span>') : '';
    return `${key}${s.sp.name} <span style="color:${RAR[s.sp.rar].c}">${RAR[s.sp.rar].n}</span>${st}${tip}${cav}`;
  }
  if (t.type === 'avatar') { const pl = NET.players.get(t.id), h = held(); if (!pl) return ''; return h && h.t === 'gel' ? `${key}送 1 份${short(h.sp)}凝膠給 ${esc(pl.name)}` : `${esc(pl.name)}　<span style="color:var(--sub)">拿著凝膠可以送給對方</span>`; }
  if (t.type === 'npc') return `${key}跟 ${esc(t.n.d.name)} 聊天　<span style="color:var(--sub)">${esc(t.n.d.role)}</span>`;
  if (t.type === 'station' && t.it.label) return key + t.it.label; // 自訂提示文字（addInter 的 extra.label，例如「摸摸橘貓」）
  if (t.type === 'station' && t.it.id.startsWith('info:')) return `${key}閱讀「${INFO[t.it.id.slice(5)].t}」的介紹`;
  if (t.type === 'station') { const h = held(); if (t.it.id === 'shelf' && h && h.t === 'prod') return `${key}把手上的${short(h.p.sp)}捏捏上架`; return `${key}使用${t.it.name}`; }
  if (t.type === 'ware') { const st = wareState(t.it.t, t.it.k); return `${key}拿起來看　${esc(st.name)} ${st.why === 'has' ? '（已購買）' : st.why === 'max' ? '（滿級）' : fmt(st.cost)}`; }
  if (t.type === 'counter') { const n = kpNpc(t.it.shop); return n ? `${key}跟${esc(n.d.name)}聊聊` : ''; }
  if (t.type === 'gate') return `能量門 · 需解開「${GATES[t.it.id].title}」`;
  if (t.type === 'cave') return caveLabel(t, key);
  if (t.type === 'puzzle' || t.type === 'nook') return `${key}${t.it.name}`; // nook：小場景裡可以互動的東西（樹洞、瓶子、冰柱…）
  return '';
}
/* ---------- 新手教學：畫面中央一步一步的提示（對準 → 捏 → 凝膠飛進手裡 → 手作台） ---------- */
const COACH = { flash: '', flashT: 0, sig: '' };
function coachFlash(t, ms = 2500) { COACH.flash = t; COACH.flashT = performance.now() + ms; }
function coachText() {
  if (S.tutDone || TITLE.on || GUI.kind || !W.ready || !P || S.stock.length) return '';
  if (COACH.flashT > performance.now()) return '<span class="st ok">✓</span>' + COACH.flash;
  const E = TOUCH ? '點擊右下的<b>手掌</b>' : '按 <kbd>E</kbd> 或左鍵', hasGel = SPECIES.some(sp => (S.gel[sp.id] || 0) >= 2);
  if (hasGel) return `<span class="st">3</span>走到左前方的「手作台」，對準它${E}<small>用 2 份凝膠捏出你的第一個捏捏</small>`;
  const t = TARGET && TARGET.type === 'slime' ? TARGET.sl : null;
  if (t && t.cool > 0) return '<span class="st">2</span>牠在休息，等幾秒再捏<small>準心外圈會倒數</small>';
  if (t) return `<span class="st">2</span>${E}捏牠（${t.hits}/3）<small>連捏 3 下就能採到凝膠</small>`;
  return `<span class="st">1</span>把準心對準前面的史萊姆<small>${TOUCH ? '在畫面右側滑動轉動視角，左下搖桿移動' : '移動滑鼠轉動視角，WASD 移動'}</small>`;
}
function renderCoach() {
  const h = coachText(); if (h === COACH.sig) return; COACH.sig = h; const el = $('#coach'); if (!el) return;
  el.hidden = !h; if (h) el.innerHTML = h; el.classList.toggle('flash', h.includes('class="st ok"'));
}
/* 第一個捏捏完成：送出切片機，接著才告訴玩家「賣掉 → 買機器」 */
function finishTutorial() {
  if (S.tutDone) return; S.tutDone = true; const gift = !S.own.slicer; S.own.slicer = true; refreshBase(); objSig = ''; if (W.starterLabel) { dropObj(W.starterLabel); W.starterLabel = null; } gainXP(5); save();
  modal(`<h2>第一個捏捏完成！</h2><p>聽到那聲「喀滋」了嗎？這就是捏捏讓人停不下來的地方。</p>${gift ? '<p>奶奶的倉庫裡還留著一台<b>舊切片機</b>，已經幫你裝到中央平地北邊的<b>加工產線</b>上。用機器做的捏捏更酥脆、更值錢。</p>' : ''}<p><b>接下來</b>：把捏捏<b>賣掉</b> → 存錢 → 在<b>工作電腦的「網購」</b>買更多機器。</p>`, [{ t: '好！' }]);
}
function act() { if (RIDE.on || GUI.kind || !W.ready) return; if (TK.on && tkKey(TARGET)) return; if (TARGET && TARGET.type === 'slime') VM.sq = .2; else VM.swing = .35; doAct(TARGET); } // 對話中：E＝繼續（手不揮）；對著別的東西＝先收起再照常互動；搭車中點一下沒有作用（按住＝開快一點，rideStep 判斷）
function actAt(x, y) { if (RIDE.on) return; const t = pickAt(x / innerWidth * 2 - 1, -(y / innerHeight) * 2 + 1); if (TK.on && tkKey(t, true)) return; if (t && t.type === 'slime') VM.sq = .2; else VM.swing = .35; doAct(t, true); }
// tap＝觸控點擊（只認點到的東西）
function doAct(t, tap) {
  if (WARE.h || (t && (t.type === 'ware' || t.type === 'counter'))) return wareAct(t, tap); // 店裡：拿起來看、結帳、放回
  if (!t) return;
  FOCUS = (t.type === 'station' || t.type === 'puzzle') && t.it && t.it.hit ? t.it : null; // 打開介面時鏡頭推近這個物件（surfOf）
  try { doActAt(t); } finally { FOCUS = null; }
}
function doActAt(t) {
  if (t.it && t.it.act) return t.it.act(t.it); // 自訂互動（例如大城市的販賣機、橘貓）
  if (t.type === 'slime') hitSlime(t.sl, t.pt);
  else if (t.type === 'station') { const id = t.it.id; if (id === 'taxi') taxiAsk(); else if (id.startsWith('shop:')) { const sh = id.slice(5); if (sh === 'arms' && !armsOpen()) toast('武器店要 Lv ' + ARMS_LV + ' 才會營業（目前 Lv ' + xpLevel(S.xp) + '，還差 ' + (XP_LV[ARMS_LV] - S.xp) + ' 經驗）。'); else openGui('shop', sh); } else if (id === 'hospital') hospitalAct(); else if (id.startsWith('info:')) infoAct(t.it, id.slice(5)); else if (id === 'cafe') cafeAct(); else if (id === 'market') marketAct(); else if (id === 'board') openGui('board', 'weekly'); else if (id === 'altar') openAltar(); else if (id === 'shelf') shelfAct(); else if (id === 'museum') openGui('museum'); else if (id === 'rack') openGui('inv'); else openGui(id); }
  else if (t.type === 'avatar') giftGel(t.id);
  else if (t.type === 'npc') npcTalk(t.n);
  else if (t.type === 'puzzle') puzzleTap(t.it);
  else if (t.type === 'nook') t.it.act(t.it);
  else if (t.type === 'gate') { const k = t.it.id; toast(`能量門封住了去路。解開「${GATES[k].title}」才能通過。按 I 開啟背包查看探索日誌。`); }
  else if (t.type === 'cave') caveAct(t.it);
}

/* ============================================================
   HUD：快捷列、指南針、目標、浮字
   ============================================================ */
function invItems() { return [...SPECIES.filter(s => S.gel[s.id] > 0).map(s => ({ t: 'gel', sp: s.id, n: S.gel[s.id] })), ...S.stock.map(p => ({ t: 'prod', p }))]; }
const HB_SHAPE = { star: 'M32 4 L39.5 22.5 L59 23.5 L44 36 L49 55 L32 44.5 L15 55 L20 36 L5 23.5 L24.5 22.5 Z', heart: 'M32 56 C14 44 5 33 5 23 C5 14 12 8 20 8 C25 8 29.5 11 32 16 C34.5 11 39 8 44 8 C52 8 59 14 59 23 C59 33 50 44 32 56 Z' };
function slotHTML(it, i, sel) {
  if (!it) return `<div class="slot ${sel ? 'sel' : ''}" data-act="hb" data-i="${i}">${i < 9 ? `<span class="k">${i + 1}</span>` : ''}</div>`;
  const sp = SP[it.t === 'gel' ? it.sp : it.p.sp], bg = sp.color2 ? `linear-gradient(135deg,${sp.color},${sp.color2})` : `radial-gradient(circle at 35% 30%,${rgba(sp.color, 1, .55)},${sp.color})`;
  const extra = it.t === 'gel' ? `<span class="n">${it.n}</span>` : `<span class="dur"><i style="width:${it.p.dur}%;background:${it.p.dur > 50 ? '#34d399' : it.p.dur > 20 ? '#fbbf24' : '#fb7185'}"></i></span>`;
  const shp = it.t === 'prod' && it.p.cut && CUTS[it.p.cut] && CUTS[it.p.cut].shape, ico = shp ? `<div class="ico shape"><svg viewBox="0 0 64 64"><defs><linearGradient id="hg${i}" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${rgba(sp.color, 1, .55)}"/><stop offset="1" stop-color="${sp.color2 || sp.color}"/></linearGradient></defs><path d="${HB_SHAPE[shp]}" fill="url(#hg${i})" stroke="#0004" stroke-width="2" stroke-linejoin="round"/></svg></div>` : `<div class="ico ${it.t === 'prod' ? 'prod' : ''}" style="background:${bg}"></div>`;
  return `<div class="slot ${sel ? 'sel' : ''}" data-act="hb" data-i="${i}" title="${it.t === 'gel' ? sp.name + '凝膠' : sp.name + '捏捏'}">${i < 9 ? `<span class="k">${i + 1}</span>` : ''}${ico}${extra}</div>`;
}
let hbSig = '';
function renderHotbar(force) {
  const items = invItems(); S.hb = clamp(S.hb, 0, 8);
  const sig = S.hb + '|' + items.map(it => it.t === 'gel' ? it.sp + it.n : it.p.id + ':' + Math.round(it.p.dur) + (it.p.cut || '')).join(',');
  if (!force && sig === hbSig) return; hbSig = sig;
  $('#hotbar').innerHTML = Array.from({ length: 9 }, (_, i) => slotHTML(items[i], i, i === S.hb)).join('');
}
const held = () => invItems()[S.hb] || null;
function fx3(pos, txt, color = '#fff', cls = '') {
  const q = pos.clone().project(W.cam); if (q.z > 1) return;
  const d = document.createElement('div'); d.className = 'fx ' + cls; d.textContent = txt; d.style.left = (q.x * .5 + .5) * innerWidth + 'px'; d.style.top = (-q.y * .5 + .5) * innerHeight + 'px'; d.style.color = color;
  $('#fxl').appendChild(d); setTimeout(() => d.remove(), 1100);
}
/* 開啟雪原後缺少保暖衣的指引；沒有這個需求時回傳 null */
function coatObjective() {
  if (!S.zones.includes('volcano') || S.own.coat) return null;
  const E = TOUCH ? '點擊' : '按 E', lv = xpLevel(S.xp), need = XP_LV[ARMS_LV] - S.xp;
  if (!armsOpen()) return { t: '升級解鎖武器店', d: '雪原極度寒冷，需要保暖衣才能進入。大城市的武器店要 Lv ' + ARMS_LV + ' 才營業（目前 Lv ' + lv + '，還差 ' + need + ' 經驗）。多採集、加工、販售可以累積經驗。' };
  const lack = S.money < OWN.coat.cost ? '（要 ' + fmt(OWN.coat.cost) + '，目前 ' + fmt(S.money) + '，還需要賺一點錢）' : '';
  if (inCity()) return { t: '購買保暖衣', d: '到路北側最右邊的「武器店」購買保暖衣' + lack + '。', x: CITY.x + 35, z: CITY.z - 15.6, c: '#f87171', n: '武器店', quiet: 1, here: '走進武器店，把保暖衣拿到櫃台結帳（' + fmt(OWN.coat.cost) + '）。' };
  return { t: '購買保暖衣', d: '雪原在西方，往冰晶塔的方向。要先有保暖衣才能進入：搭出生點左邊的計程車到大城市，到武器店購買' + lack + '。', x: BASE.taxi[0], z: BASE.taxi[1], c: '#facc15', n: '計程車', here: '對準計程車' + E + '，前往大城市的武器店。' };
}
function objective() {
  if (S.frozen) { const E = TOUCH ? '點擊' : '按 E'; return inCity() ? { t: '去醫院看醫生', d: '你凍僵了。到路北側的「醫院」，付診療費 ' + fmt(HOSPITAL_FEE) + '，醫生會讓你立刻痊癒。', x: CITY.x - 34, z: CITY.z - 13, c: '#f87171', n: '醫院', here: '對準醫院的門' + E + '，看醫生。' } : { t: '去醫院看醫生', d: '你凍僵了（發抖、行動變慢）。搭出生點左邊的計程車到大城市的醫院，付診療費 ' + fmt(HOSPITAL_FEE) + ' 看醫生就會好。', x: BASE.taxi[0], z: BASE.taxi[1], c: '#facc15', n: '計程車', here: '對準計程車' + E + '，前往大城市的醫院。' }; }
  const co = coatObjective(); if (co && ownAny()) return co;
  const gel = unlockedSpecies().some(s => (S.gel[s.id] || 0) >= 2);
  if (inCity()) {
    if (!ownAny()) return { t: '購買第一台機器', d: S.money >= OWN.slicer.cost ? '到路北側的「機械行」購買切片機。' : `切片機要 ${fmt(OWN.slicer.cost)}（目前 ${fmt(S.money)}），錢不夠就先回去多賺一點。`, x: CITY.x - 18, z: CITY.z - 15.6, c: '#22d3ee', n: '機械行', quiet: 1, here: '走進機械行，拿起切片機，到櫃台結帳。' };
    return { t: '逛逛大城市', d: '商店在路的北側，走進去就能拿起來看；廣場旁有咖啡館（老闆每天有小訂單）、週末市集與公告欄。買完後到醫院門口的招呼站搭計程車回月光谷。', x: CITY.x + TAXI.cStand[0], z: CITY.z - 7.6, c: '#facc15', n: '計程車招呼站', here: '對準計程車' + (TOUCH ? '點擊' : '按 E') + '，回到月光谷。' };
  }
  if (!S.stock.length && !gel && !S.sales) return { t: '採集凝膠', d: '靠近史萊姆，對準後' + (TOUCH ? '點擊' : '按 E 或左鍵') + ' 3 次，收集至少 2 份凝膠。', track: 'slime', c: '#6ee7a8' };
  if (!S.stock.length && !S.sales) return { t: '手作第一個捏捏', d: '回到中央平地，使用「手作台」做出粗製捏捏。', x: BASE.bench[0], z: BASE.bench[1], c: '#fbbf24', n: '手作台', here: '對準手作台' + (TOUCH ? '點擊' : '按 E') + '，用 2 份凝膠做出粗製捏捏。' };
  if (!S.sales) return { t: '上架到網站', d: S.web.length ? '已經上架了，等顧客下單（第一筆訂單很快就會成交）。' : '拿著捏捏，到工作電腦旁的「網站貨架」把它放上去，等顧客下單。', x: BASE.shelf[0], z: BASE.shelf[1], c: '#818cf8', n: '網站貨架', here: '在快捷列選取捏捏，對準網站貨架' + (TOUCH ? '點擊' : '按 E') + '上架。' };
  if (!ownAny()) return { t: '存錢買機器', d: `存到 ${fmt(OWN.slicer.cost)} 後，在工作電腦的「網購」買切片機（目前 ${fmt(S.money)}）。`, x: BASE.pc[0], z: BASE.pc[1], c: '#818cf8', n: '工作電腦', here: '對準工作電腦' + (TOUCH ? '點擊' : '按 E') + '，在「網購」分頁購買切片機。' };
  if (!S.lineMade) return { t: '用切片機加工', d: gel ? '到中央平地北邊的「加工產線」，用切片機做出酥脆捏捏，比手作的值錢很多。' : '先採集 2 份凝膠，再到中央平地北邊的「加工產線」用切片機加工。', x: gel ? BASE.line[0] : null, z: gel ? BASE.line[1] : null, track: gel ? null : 'slime', c: '#22d3ee', n: gel ? '加工產線' : null, here: '對準加工產線' + (TOUCH ? '點擊' : '按 E') + '，選擇凝膠後啟動產線。' };
  const k = nextQuest(), qt = questTarget();
  if (k) { const ob = { t: QUEST[k].title, d: questReady(k) ? (qt ? (qt.d || `前往${qt.n}。`) : QUEST[k].hint) : `先用${ZONES.find(z => z.id === QUEST[k].from).name}的史萊姆做出 ${QUEST[k].need} 個捏捏（${madeIn(QUEST[k].from)}/${QUEST[k].need}）。`, x: qt && qt.x, z: qt && qt.z, c: '#c4b5fd', n: qt && qt.n, here: qt && qt.h }; if (questReady(k)) ob.extra = questExtra(k); return ob; }
  return { t: '開設夢想捏捏博物館', d: '累積粉絲與營收，到工作電腦的圖鑑頁完成夢想。' };
}
let objSig = '';
function renderObjective() {
  let o = objective(); let tx = o.x, tz = o.z;
  if (o.track === 'slime') { let bd = 1e9; W.slimes.forEach(sl => { if (sl.cool > 0) return; const d = Math.hypot(sl.x - P.x, sl.z - P.z); if (d < bd) { bd = d; tx = sl.x; tz = sl.z; } }); }
  else { const rt = caveRoute(tx, tz); if (rt) { o = Object.assign({}, o, { x: rt.x, z: rt.z, n: rt.n, d: o.d + `（先穿過${rt.cave.def.name}）`, here: `走進${rt.cave.def.name}，沿著地上的發光痕跡走到出口。` }); tx = rt.x; tz = rt.z; } }
  const key = o.t + '|' + (o.n || o.track || ''), same = tx != null && inCity(tx) === inCity(), dist = same ? Math.hypot(tx - P.x, tz - P.z) : 1e9;
  if (W.arrKey !== key) { W.arrKey = key; W.arr = false; }
  if (!W.arr && dist < 8) { W.arr = true; if (o.n && !o.quiet) { toast(`已抵達${o.n}`); sfx.tick(); } } // 走進店頭不跳「已抵達」（店員的招呼就是回饋）
  else if (W.arr && dist > 12) W.arr = false;
  if (W.arr) o = Object.assign({}, o, { d: o.track === 'slime' ? `對準史萊姆${ENTER()} 3 次採集凝膠。` : (o.here || `已抵達${o.n || '目標地點'}，對準它${ENTER()}使用。`), t: o.n ? `${o.t}（已抵達${o.n}）` : o.t, arrived: true });
  const s = o.t + o.d + (o.extra || ''); W.obj = o; if (s === objSig) return; objSig = s;
  $('#objective').classList.toggle('arrived', !!o.arrived);
  $('#objective').innerHTML = `<b>${o.arrived ? '下一步' : '目前目標'}</b>${esc(o.t)}<div style="color:#cbd5e1;font-size:12px">${esc(o.d)}</div>${o.extra || ''}`;
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
  if (tx == null || GUI.kind || TITLE.on || CV.c || inCity(tx) !== inCity()) { el.hidden = true; return; }
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
function renderClock() {
  let el = document.getElementById('dnClock'); if (!el) { el = document.createElement('div'); el.id = 'dnClock'; el.innerHTML = '<i class="dn-ic"></i><span class="dn-bar"><b></b></span><em></em>'; (document.getElementById('hud') || document.body).appendChild(el); }
  const sig = DN.phase + Math.round(DN.p * 200); if (sig === W.clkSig) return; W.clkSig = sig;
  el.className = 'dn-' + DN.phase; el.querySelector('b').style.width = (DN.p * 100).toFixed(1) + '%'; el.querySelector('em').textContent = DN_PHASE[DN.phase];
  el.title = '月光谷的一天 10 分鐘：白天 5、黃昏 1、夜晚 3、黎明 1 分鐘';
  clockLayout(el);
}
// 依序試三個位置：指南針右邊 → 右上按鈕下方 → 指南針下方；選第一個不會蓋到其他 HUD 的位置
function clockLayout(el) {
  const sig = innerWidth + 'x' + innerHeight + (W.ready ? 1 : 0) + (NET.on ? 1 : 0); if (sig === W.clkLay) return;
  const tb = document.getElementById('topbtns'), r0 = tb && tb.getBoundingClientRect(); if (!r0 || !r0.width) return; W.clkLay = sig;
  const avoid = ['topbtns', 'compass', 'cmpDeg', 'stats'].map(id => document.getElementById(id)).filter(e => e && e.offsetParent !== null).map(e => e.getBoundingClientRect()).filter(r => r.width);
  const hit = a => avoid.some(b => a.left < b.right + 4 && a.right > b.left - 4 && a.top < b.bottom + 4 && a.bottom > b.top - 4);
  const cmp = document.getElementById('compass').getBoundingClientRect(), deg = document.getElementById('cmpDeg'), dr = deg && deg.offsetParent !== null ? deg.getBoundingClientRect() : null;
  const tries = [{}, { left: 'auto', right: (innerWidth - r0.right) + 'px', top: (r0.bottom + 6) + 'px' }, { left: (cmp.left + cmp.width / 2) + 'px', top: ((dr && dr.height ? dr.bottom : cmp.bottom) + 6) + 'px', transform: 'translateX(-50%)' }];
  for (const t of tries) { el.style.left = el.style.right = el.style.top = el.style.transform = ''; Object.assign(el.style, t); if (!hit(el.getBoundingClientRect())) return; }
}
function renderCompass() {
  const el = $('#cmpStrip'), w = el.clientWidth || 300, range = Math.PI * .8, items = [], o0 = W.obj;
  const sig = `${P.yaw.toFixed(3)}|${Math.round(P.x * 2)}|${Math.round(P.z * 2)}|${w}|${o0 && o0.x}|${o0 && o0.z}|${S.zones.length}`; if (sig === cmpSig) return; cmpSig = sig;
  const put = (ang, html, cls, color) => { let r = Math.atan2(Math.sin(ang - P.yaw), Math.cos(ang - P.yaw)); if (Math.abs(r) > range / 2) return; items.push(`<span class="cmk ${cls}" style="left:${(.5 - r / range) * w}px;${color ? '--pc:' + color : ''}">${html}</span>`); };
  // 方位：北（紅字）、東西南、四個斜向；刻度每 5 度一格，每 15 度長一點
  [['北', 0, ' n'], ['西', Math.PI / 2, ''], ['南', Math.PI, ''], ['東', -Math.PI / 2, '']].forEach(([n, a, c]) => put(a, n, 'dir' + c));
  [['西北', Math.PI / 4], ['西南', Math.PI * .75], ['東南', -Math.PI * .75], ['東北', -Math.PI / 4]].forEach(([n, a]) => put(a, n, 'dir2'));
  for (let a = 0; a < 72; a++) if (a % 9) put(a / 72 * PI2, '', a % 3 ? 'tick' : 'tick big');
  const bearing = (x, z) => Math.atan2(-(x - P.x), -(z - P.z)), dist = (x, z) => Math.round(Math.hypot(x - P.x, z - P.z));
  const ca = caveAhead();
  if (ca) put(bearing(ca.x, ca.z), `<i></i><b>${ca.name} ${ca.d}m</b>`, 'pin goal', ca.col); // 山洞裡只顯示「出口方向」一個標記（第 4 堂 4.4）
  else {
    put(bearing(0, 0), '<i></i>', 'pin home', '#22d3ee');
    const o = W.obj; if (o && o.x != null) put(bearing(o.x, o.z), `<i></i><b>${dist(o.x, o.z)}m</b>`, 'pin goal', o.c || '#c4b5fd');
    LMS.forEach(L => { const known = S.zones.includes(L.zone); put(bearing(L.x, L.z), `<i></i><b>${known ? L.name : '？'}</b>`, 'pin lm' + (known ? '' : ' unk'), known ? '#e2e8f0' : '#64748b'); });
    Object.keys(GATES).forEach(k => { if (S.zones.includes(k) && !S.seenZone?.[k]) put(bearing(GATES[k].ex, GATES[k].ez), '<i></i>', 'pin gate', '#fbbf24'); });
  }
  el.innerHTML = items.join('');
  const deg = Math.round(((-P.yaw * 180 / Math.PI) % 360 + 360) % 360) % 360, dn = ['北', '東北', '東', '東南', '南', '西南', '西', '西北'][Math.round(deg / 45) % 8];
  const dg = $('#cmpDeg'); if (dg) dg.textContent = `${dn} ${String(deg).padStart(3, '0')}°`;
}
/* ---------- 經驗值與等級（與粉絲無關） ---------- */
const XP_LV = [0, 20, 50, 100, 180, 300, 480, 720, 1050, 1500, 2100];   // 到達各等級所需的累計經驗，最高 10 級
const XP_HARV = [0, 2, 4, 8, 20];                                         // 採集一次：依史萊姆稀有度
const xpLevel = xp => { let lv = 0; while (lv < XP_LV.length - 1 && xp >= XP_LV[lv + 1]) lv++; return lv; };
function gainXP(n, why) {
  n = Math.round(n); if (!(n > 0) || !S) return;
  const before = xpLevel(S.xp); S.xp += n; const after = xpLevel(S.xp);
  const bar = $('#xpbar'); if (bar) { let em = $('#xpgain'); if (!em) { em = document.createElement('em'); em.id = 'xpgain'; bar.appendChild(em); } em.textContent = '+' + n + ' XP'; em.style.animation = 'none'; void em.offsetWidth; em.style.animation = ''; }
  if (before < ARMS_LV && after >= ARMS_LV) setTimeout(unlockArms, 900);
  if (after > before) { sfx.level && sfx.level(); toast('升級！達到 Lv ' + after + (after >= XP_LV.length - 1 ? '（滿級）' : '')); const sp = bar && bar.querySelector('span'); if (sp) { sp.classList.remove('up'); void sp.offsetWidth; sp.classList.add('up'); } }
  renderXP();
}
function renderXP() {
  const x = S.xp, lv = xpLevel(x), max = lv >= XP_LV.length - 1, a = XP_LV[lv], b = XP_LV[Math.min(lv + 1, XP_LV.length - 1)], pct = max ? 100 : (x - a) / (b - a) * 100;
  $('#xpbar i').style.width = clamp(pct, 0, 100) + '%'; $('#xpbar span').textContent = lv;
  $('#xpbar').title = max ? `Lv ${lv}（滿級）　經驗 ${x}` : `Lv ${lv}　經驗 ${x - a} / ${b - a}（再 ${b - x} 升級）`;
}
function renderTop() {
  $('#sMoney').textContent = fmt(S.money); $('#sFans').textContent = '粉絲 ' + Math.floor(S.fans);
  const t = trend.sp ? SP[trend.sp] : null; $('#sTrend').innerHTML = t ? `流行 ${dot(t.color)}${short(trend.sp)} ×1.35` : '流行 —';
  if (GUI.kind === 'pause') ui('pause'); // 暫停選單（音效、靈敏度、雲端存檔狀態）由 React 重繪
}
const trendPool = () => unlockedSpecies().filter(s => !s.cave || (S.codex[s.id] && S.codex[s.id].made > 0)); // 洞穴史萊姆要先做過才會變成流行色
function pickTrend() { trend.sp = pick(trendPool()).id; renderTop(); toast('流行色更新：' + SP[trend.sp].name + '（售價 ×1.35）'); }

/* ============================================================
   介面視窗（工作站 / 背包 / 選單）
   ============================================================ */
const GUI = { kind: null };
const GUIS = {
  line: { t: '加工產線', tabs: ['make'] }, decor: { t: '裝飾桌', tabs: ['decor'] }, live: { t: '直播台', tabs: ['live'] },
  pc: { t: '工作電腦', tabs: ['web', 'weekly', 'eshop', 'branch', 'codex'] }, museum: { t: '展示場', tabs: ['museum', 'visit'] }, board: { t: '公告欄', tabs: ['weekly'] }, bench: { t: '手作台', tabs: ['bench'] }, shop: { t: '大城市', tabs: ['mach', 'gear', 'mall', 'arms'] }, mapg: { t: '古地圖石台', tabs: ['mapg'] }, riddle: { t: '古老的石碑', tabs: ['riddle'] }, inv: { t: '背包', tabs: ['inv', 'codex'] }, pause: { t: '選單', tabs: ['pause'] },
};
const TABN = { bench: '手作', mach: '機械行', gear: '器材行', mall: '生活百貨', arms: '武器店', eshop: '網購', weekly: '本週限定', museum: '展示台', visit: '參觀朋友', mapg: '拼回地圖', riddle: '石碑', make: '加工', decor: '裝飾', live: '直播', web: '網路商店', up: '升級', branch: '事業', codex: '圖鑑', inv: '背包', pause: '選單' };
let tab = '';
/* 沉浸式介面：每個工作站用一種「道具」呈現（components/StationLayer.tsx 加上外觀與動畫，app/stations.css 是樣式）。
   開關的過場由下面的 GX 控制，#gui[data-mode] 決定是哪一種：
   held＝手持道具（Esc 筆記本、直播手機、背包手帳）：第一人稱的手把 3D 道具拿到眼前，停在和 2D 介面完全重合的位置後 2D 才淡入接手；
         關閉時 2D 先淡出、露出底下同位置的 3D 道具，再由手收回（heldStep）。
   face＝固定在世界裡的工作站：鏡頭在固定時間內轉到正對物件表面，2D 介面一開始貼在那個表面上（CSS matrix3d），
         隨鏡頭推近展開成可以操作的大小；關閉時反過來貼回表面再淡出（faceTrack）。
   card＝其他（沒有對準物件就打開、或系統設定減少動態）：原地淡入。
   介面開著時世界照樣在背後畫、照樣有聲音（loop 降頻），玩家不能移動、準心不互動。 */
const PROP = { line: 'machine', bench: 'mat', decor: 'mat', inv: 'journal', pause: 'notebook', pc: 'monitor', live: 'phone', shop: 'catalog', mapg: 'parchment', riddle: 'tablet', museum: 'vitrine', board: 'cork' };
const HELD = { pause: 1, live: 1, inv: 1 };
const GUI_OUT_MS = 380;
const RM = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
// 時間軸（毫秒）。拿起：舉起、封面翻開、2D 接手、手放下；收起：2D 淡出、手回來、闔上、放下
const HT = { raise: 430, open0: 60, open1: 330, hand: 420, done: 540, end: 800 };
const HC = { fade: 60, hide: 190, up: 150, close0: 250, close1: 420, down0: 130, end: 580 }; // 收起時先拉遠、再闔上、最後放下（近距離翻封面會蓋滿整個畫面）
const GX = { mode: '', kind: '', dir: 0, t0: 0, st: 0, R: null, surf: null, from: null, to: null, dur: 0, fz: null };
const gxE = () => GX.fz != null ? GX.fz : performance.now() - GX.t0; // 過場經過的毫秒；測試時可設 GX.fz 把畫面停在某一刻
let guiHideT = 0, FOCUS = null, bgAcc = 0;
function guiShow(kind) {
  clearTimeout(guiHideT); const g = $('#gui'), was = !g.hidden && !g.classList.contains('closing');
  g.dataset.prop = PROP[kind] || 'card'; g.dataset.kind = kind; g.classList.remove('closing', 'shown', 'dim'); g.hidden = false;
  // 模式要在開場動畫開始前決定（CSS 依 data-mode 關掉會和 3D 過場打架的動畫）
  g.dataset.mode = RM() || !W.ready ? 'card' : HELD[kind] ? 'held' : kind !== 'line' && GUI.focus && GUI.focus.hit ? 'face' : 'card';
  if (!was) { g.classList.remove('opening'); void g.offsetWidth; g.classList.add('opening'); }
  window.dispatchEvent(new CustomEvent('slime:gui', { detail: { open: true, kind, prop: g.dataset.prop } }));
  return was;
}
function guiHide(now) {
  const g = $('#gui'), done = () => { g.hidden = true; g.classList.remove('closing', 'opening'); gxClean(); if (!GUI.kind) $$('.panel').forEach(p => p.classList.remove('on')); };
  window.dispatchEvent(new CustomEvent('slime:gui', { detail: { open: false } }));
  clearTimeout(guiHideT); if (g.contains(document.activeElement)) document.activeElement.blur();
  if (now || RM()) { GX.mode = ''; if (VM.prop) VM.prop.visible = false; return done(); }
  g.classList.remove('opening'); g.classList.add('closing'); guiHideT = setTimeout(done, gxOut());
}
// 介面的版面位置（不含過場用的 transform）
function gwinRect() { const w = $('#gwin'), t = w.style.transform; w.style.transform = 'none'; const r = w.getBoundingClientRect(); w.style.transform = t; return { x: r.left, y: r.top, w: r.width, h: r.height }; }
function gxClean() { const w = $('#gwin'); w.style.transform = w.style.opacity = ''; $('#gui').classList.remove('shown', 'dim'); $('#game').classList.remove('gblur'); }
// 打開（openGui 畫好內容之後呼叫，這時量得到介面的大小）
function gxIn(kind, was) {
  const g = $('#gui'), m = g.dataset.mode; gxClean(); Object.assign(GX, { mode: m === 'card' ? '' : m, kind, dir: 1, st: 0, t0: performance.now(), R: gwinRect(), last: null, c0: null });
  g.style.setProperty('--night', (DN.night || 0).toFixed(2)); // 紙類介面夜裡跟著環境暗一點（stations.css）
  if (m === 'held') { if (was) GX.t0 -= HT.end; } // 從別的介面切過來：道具已經在手上，直接顯示
  else if (m === 'face' && (GX.surf = surfOf(GUI.focus, kind))) {
    fitSurf(GX.surf, GX.R);
    const cam = W.cam; GX.from = { p: cam.position.clone(), q: cam.quaternion.clone() }; GX.to = facePose(GX.surf, GX.R); GX.dur = was ? 0 : 640;
    $('#gwin').style.opacity = 0; faceTrack(0);
  } else { GX.mode = ''; g.dataset.mode = 'card'; g.classList.add('shown'); gxFocus(kind); }
}
// 關閉：開始收回的過場，回傳幾毫秒後藏起 #gui
function gxOut() {
  $('#gui').classList.remove('dim'); $('#game').classList.remove('gblur');
  if (!GX.mode) return GUI_OUT_MS;
  Object.assign(GX, { dir: -1, st: 0, t0: performance.now(), R: gwinRect() });
  if (GX.mode === 'held') { GX.c0 = GX.st < 1 && GX.last ? [...GX.last, 1] : [1, 1, 1, 0]; return HC.hide; } // 還沒舉到眼前就關掉：從目前的位置收回，不跳到眼前
  GX.from = { p: W.cam.position.clone(), q: W.cam.quaternion.clone() }; GX.dur = 460; $('#gui').classList.remove('shown'); return GX.dur;
}
// 過場進行中：世界要用全速重繪（loop）
function gxBusy() { if (!GX.mode) return false; const e = gxE(); return GX.mode === 'held' ? e < (GX.dir > 0 ? HT.end : HC.end) + 30 : e < GX.dur + 30; }
// 暫停選單出現時把焦點放在「回到遊戲」：鍵盤可以直接 Enter 回到遊戲、Tab 移到其他按鈕
function gxFocus(kind) { const f = kind === 'pause' && $('#gwin .rx-resume'); if (f && !$('#gui').contains(document.activeElement)) f.focus({ preventScroll: true }); }
// 每一格（loop，在世界畫完之後）：依時間軸切換 2D 介面的狀態、讓貼在表面上的介面跟著鏡頭
function gxStep() {
  if (!GX.mode) return; const e = gxE(), g = $('#gui');
  if (GX.mode === 'face') return faceTrack(e);
  if (GX.dir > 0) {
    if (GX.st < 1 && e >= HT.hand) { GX.st = 1; g.classList.add('shown'); }
    if (GX.st < 2 && e >= HT.done) {
      GX.st = 2; g.classList.add('dim'); $('#game').classList.toggle('gblur', !LOW && GX.kind !== 'live'); // 手機：看得到後面的世界，不模糊
      gxFocus(GX.kind);
    }
  } else {
    if (GX.st < 1 && e >= HC.fade) { GX.st = 1; g.classList.remove('shown'); }
    if (e >= HC.end) GX.mode = '';
  }
}
/* 貼在工作站表面上的介面：四個角從「物件表面投影在畫面上的位置」漸變到最後的介面矩形（homography → CSS matrix3d） */
function faceTrack(e) {
  const w = $('#gwin'), R = GX.R, s = GX.dur ? clamp(e / GX.dur, 0, 1) : 1, op = GX.dir > 0;
  if (s >= 1) { if (op) { if (GX.st < 1) { GX.st = 1; w.style.transform = w.style.opacity = ''; $('#gui').classList.add('shown'); } } else GX.mode = ''; return; }
  const m = op ? ease3(smooth(.12, 1, s)) : 1 - ease3(smooth(0, .8, s)), a = op ? smooth(0, .28, s) : 1 - smooth(.55, 1, s), Q = surfQuad(GX.surf, R);
  w.style.opacity = a.toFixed(3);
  w.style.transform = Q ? quadCSS(R, Q.map(([x, y], i) => [x + ((i % 3 ? R.w : 0) - x) * m, y + ((i > 1 ? R.h : 0) - y) * m])) : '';
}
// 表面四個角（左上、右上、右下、左下）投影到畫面上、相對於介面左上角的像素位置；有角跑到鏡頭後面就放棄貼附
function surfQuad(S, R) {
  const cam = W.cam, vw = innerWidth, vh = innerHeight, out = [], v = new THREE.Vector3(), vc = new THREE.Vector3(); cam.updateMatrixWorld();
  for (const [a, b] of [[-1, 1], [1, 1], [1, -1], [-1, -1]]) {
    v.copy(S.c).addScaledVector(S.x, a * S.w / 2).addScaledVector(S.u, b * S.h / 2);
    if (vc.copy(v).applyMatrix4(cam.matrixWorldInverse).z > -cam.near * 2) return null;
    v.project(cam); out.push([(v.x + 1) / 2 * vw - R.x, (1 - v.y) / 2 * vh - R.y]);
  }
  return out;
}
// 單位正方形 → 四邊形的投影轉換（Heckbert），再縮放成介面的寬高
function quadCSS(R, Q) {
  const [[x0, y0], [x1, y1], [x2, y2], [x3, y3]] = Q, sx = x0 - x1 + x2 - x3, sy = y0 - y1 + y2 - y3;
  let a = x1 - x0, b = x3 - x0, d = y1 - y0, e = y3 - y0, g = 0, h = 0;
  if (Math.abs(sx) > 1e-6 || Math.abs(sy) > 1e-6) {
    const dx1 = x1 - x2, dx2 = x3 - x2, dy1 = y1 - y2, dy2 = y3 - y2, den = dx1 * dy2 - dx2 * dy1; if (Math.abs(den) < 1e-9) return '';
    g = (sx * dy2 - dx2 * sy) / den; h = (dx1 * sy - sx * dy1) / den; a = x1 - x0 + g * x1; b = x3 - x0 + h * x3; d = y1 - y0 + g * y1; e = y3 - y0 + h * y3;
  }
  const W_ = R.w, H_ = R.h;
  return `matrix3d(${[a / W_, d / W_, 0, g / W_, b / H_, e / H_, 0, h / H_, 0, 0, 1, 0, x0, y0, 0, 1].map(n => +n.toFixed(6)).join(',')})`;
}
function openGui(kind, sec) {
  if (WARE.h) wareBack(true); // 拿著商品打開任何介面：先立刻放回
  const g = GUIS[kind]; if (!g) return; unlockMouse(); GUI.kind = kind; sfx.open(); save(); if (kind === 'pause') S.savedAt = Date.now();
  if (P) P.vx = P.vz = 0; // 停下腳步再拿東西：鏡頭的晃動與側傾回正，手上的道具才對得準 2D 介面
  const it = held();
  if (kind === 'line' && it && it.t === 'gel' && !M.active) { M.sp = it.sp; M.last = null; }
  if (kind === 'line' && !M.sp) M.sp = (unlockedSpecies().find(s => (S.gel[s.id] || 0) >= 2) || {}).id || null;
  if (kind === 'decor' && it && it.t === 'prod') D.id = it.p.id;
  if (kind === 'live' && it && it.t === 'prod' && !stockById(L.stageId)) L.stageId = it.p.id;
  GUI.focus = FOCUS; FOCUS = null; const was = guiShow(kind); $('#gui').classList.toggle('sheet', kind === 'line'); $('#gtitle').textContent = g.t; $('#startHint').hidden = true;
  showSec(sec || g.tabs[0]); gxIn(kind, was);
}
function guiTabs() { const g = GUIS[GUI.kind]; return g.tabs.filter(t => (t !== 'branch' || S.branch || branchReady()) && (t !== 'arms' || armsOpen()) && (t !== 'visit' || NET.on)); }
function renderGuiTabs() { const tabs = guiTabs(); $('#gtabs').innerHTML = tabs.length > 1 ? tabs.map(t => `<button class="${t === tab ? 'on' : ''}" data-act="sec" data-sec="${t}">${TABN[t]}${t === 'branch' && !S.branch ? ' ●' : ''}</button>`).join('') : ''; }
const PANEL = { mach: 'up', gear: 'up', mall: 'up', arms: 'up', eshop: 'up' };
function showSec(sec) { window.dispatchEvent(new CustomEvent('slime:tab', { detail: { kind: GUI.kind, tab: sec, flip: !!tab && tab !== sec } })); tab = sec; $$('.panel').forEach(p => p.classList.toggle('on', p.id === 'p-' + (PANEL[sec] || sec))); renderGuiTabs(); RENDER[sec](); $('#gbody').scrollTop = 0; }
function closeGui() {
  if (!GUI.kind) return; if (GUI.kind === 'line' && M.active) { toast('產線還在運轉，請先完成這一輪加工。'); return; }
  if (L.watch) stopWatch();
  GUI.kind = null; GUI.focus = null; tab = ''; guiHide(); save();
  renderHotbar(true); lockMouse(); $('#startHint').hidden = locked() || TOUCH;
}
function refresh() { if (GUI.kind && tab) RENDER[tab](); renderTop(); renderHotbar(); }

/* ---------- 加工：三台機器各有不同的操作流程 ---------- */
const M = { sp: null, step: -1, active: false, phase: '', pt: 0, g: null, scores: [], last: null, hold: false, kdir: 0 };
const MG = [
  { name: '切片', how: '看著輸送帶上的史萊姆：發光的切割線碰到紅色雷射時下刀。', key: '空白鍵／點擊畫面' },
  { name: '裹糖晶', how: '按住讓滾筒加速、放開會減速，讓指針停在綠色區間越久越好。', key: '按住空白鍵' },
  { name: '乾燥', how: '拖曳火力旋鈕，讓它跟上不斷移動的黃色目標溫度。', key: '← → 或 A D' },
];
const lvlOf = i => S.up[MKEY[i]];
function startMake() {
  if (!ownAny()) return toast('還沒有任何加工機器，到工作電腦的「網購」購買');
  const sp = M.sp; if (!sp || (S.gel[sp] || 0) < 2) return toast('凝膠不足（需要 2 份）');
  if (S.stock.length >= cap()) return toast('庫存已滿，請先銷售或升級倉儲貨架');
  S.gel[sp] -= 2; M.coopDone = null; M.coop = null; M.cut = S.own.slicer ? (CUTS[S.cut] ? S.cut : 'thick') : null; M.steps = [0, 1, 2].filter(i => S.own[MKEY[i]]); M.si = 0; M.step = M.steps[0]; M.scores = [null, null, null];
  M.active = true; M.last = null; MK.bx = -6.4; beginStep(); renderHotbar(true); renderMake();
}
function beginStep() {
  M.phase = 'ready'; M.pt = 1.4; M.hold = false; M.kdir = 0; const lv = lvlOf(M.step);
  if (M.step === 0) {
    // 越熟練判定越寬（最多 +35%）；切過 40 刀之後輸送帶會忽快忽慢
    const C = CUTS[M.cut] || CUTS.thick, k = C.marks, marks = [], skill = 1 + Math.min(.35, (S.cutN || 0) / 150), vary = (S.cutN || 0) >= 40 ? .5 : 0;
    for (let i = 0; i < k; i++) marks.push(.14 + i * .72 / (k - 1) + rnd(-.02, .02));
    M.g = { t: 0, dur: 2.6 + k * .45, marks, hit: marks.map(() => null), tol: (.045 + .012 * lv) * C.tol * skill, vary };
    MK.clipU = 1.1;
    if (vary && !S.tipVary) { S.tipVary = true; toast('你的切片越來越熟練了：輸送帶現在會忽快忽慢，看準了再下刀！'); }
  }
  else if (M.step === 1) { // 指針一開始在正中間；綠色區域放在左半或右半，要按住加速或放手減速才對得上
    const w = .2 + .035 * lv, c = Math.random() < .5 ? rnd(.53 + w / 2, .93 - w / 2) : rnd(.07 + w / 2, .47 - w / 2); M.g = { t: 0, dur: 5, thr: .5, v: .5, inz: 0, lo: c - w / 2, hi: c + w / 2, w, c0: c, ph: rnd(0, 6.28), amp: Math.max(0, Math.min(.16, c - w / 2 - .05, .95 - c - w / 2)) }; M.coop = null; const f = NET.on && P ? nearFriend(8) : null; if (f) { M.coop = f; M.pt = 2.4; netEmit({ t: 'coop', to: f.id, on: true, lo: M.g.lo, hi: M.g.hi }); toast(`${f.name} 在旁邊：裹糖交給朋友來做！`); } }
  else M.g = { t: 0, dur: 5.5, knob: .5, err: 0, n: 0, tw: .07 + .015 * lv, seed: rnd(0, 10) };
}
// 史萊姆在切片機下的位置（0→1）；變速時仍保持單調前進
const slicePos = g => { const u = clamp(g.t / g.dur, 0, 1); return g.vary ? u + g.vary * Math.sin(u * Math.PI * 4) / (Math.PI * 4) : u; };
const LT = 2.4; // 切片時史萊姆經過刀下的行程
const dryTarget = g => clamp(.5 + .28 * Math.sin(g.t * .9 + g.seed) + .12 * Math.sin(g.t * 2.3 + g.seed * 2), .08, .92);
function makeAction(kind, val) {
  if (!M.active) return; if (kind === 'hold') { if (M.coop) return; M.hold = val; const b = $('#mgHold'); if (b) b.classList.toggle('on', !!val); return; }
  if (M.phase !== 'run') return; const g = M.g;
  if (M.step === 0 && kind === 'tap') {
    const pos = slicePos(g); let best = -1, bd = 1; g.marks.forEach((m, i) => { if (g.hit[i] == null) { const d = Math.abs(pos - m); if (d < bd) { bd = d; best = i; } } });
    if (best >= 0 && bd < g.tol * 2.2) { const q = clamp(1 - Math.max(0, bd - g.tol * .4) / (g.tol * 1.8), 0, 1); g.hit[best] = q; g.combo = q > .6 ? (g.combo || 0) + 1 : 0; g.lastQ = q; g.cuts = (g.cuts || 0) + 1; sliceFx(q); } else { g.combo = 0; g.lastQ = -1; g.cuts = (g.cuts || 0) + 1; sliceFx(-1); }
    updMakeUI();
  }
  if (M.step === 2 && kind === 'knob') g.knob = clamp(val, 0, 1);
}
function makeTick(dt) {
  if (!M.active) return; const g = M.g;
  if (M.phase === 'ready') { M.pt -= dt; if (M.pt <= 0) { M.phase = 'run'; renderMake(); } return; }
  if (M.stop > 0) { M.stop -= dt; return; } // 下刀瞬間的停頓
  if (M.slow > 0) { M.slow -= dt; dt *= .35; } // 完美切面後短暫慢動作
  g.t += dt;
  if (M.step === 0) { const pos = slicePos(g); g.marks.forEach((m, i) => { if (g.hit[i] == null && pos > m + g.tol * 2.2) { g.hit[i] = 0; g.combo = 0; ui('make'); updMakeUI(); } }); }
  if (M.step === 1 && M.coop && (M.coopT = (M.coopT || 0) + dt) > .1) { M.coopT = 0; netEmit({ t: 'coopV', to: M.coop.id, v: g.v, lo: g.lo, hi: g.hi }); }
  if (M.step === 1) { const cc = g.c0 + g.amp * Math.sin(g.t * .8 + g.ph); g.lo = cc - g.w / 2; g.hi = cc + g.w / 2; }
  if (M.step === 1) { g.thr = clamp(g.thr + (M.hold ? 1.15 : -.95) * dt, 0, 1); g.v += (g.thr - g.v) * Math.min(1, dt * 2.5); if (g.v >= g.lo && g.v <= g.hi) g.inz += dt; MK.drumSpd = g.v; }
  if (M.step === 2) { g.knob = clamp(g.knob + M.kdir * dt * .9, 0, 1); g.err += Math.max(0, Math.abs(g.knob - dryTarget(g)) - g.tw * .5) * dt; g.n += dt; MK.heatLv = g.knob; }
  if (g.t >= g.dur) finishStep(); else updMakeUI();
}
function finishStep() {
  const g = M.g; let sc;
  if (M.step === 0) sc = g.hit.reduce((a, b) => a + (b || 0), 0) / g.marks.length;
  else if (M.step === 1) sc = clamp(g.inz / (g.dur * .8), 0, 1);
  else sc = clamp(1 - (g.err / Math.max(g.n, .01)) / .25, 0, 1);
  if (M.step === 0) S.cutN = (S.cutN || 0) + g.hit.filter(h => h > .3).length;
  if (M.step === 1 && M.coop) { netEmit({ t: 'coop', to: M.coop.id, on: false, sc }); M.coopDone = M.coop.name; M.coop = null; M.hold = false; }
  M.scores[M.step] = sc; sfx.machine(M.step); MK.pulse[M.step] = .7; M.hold = false; M.kdir = 0;
  toast(`${MG[M.step].name}：${sc > .9 ? '完美' : sc > .7 ? '很好' : sc > .45 ? '普通' : '失手了'}（${Math.round(sc * 100)}%）`);
  M.si++;
  if (M.si >= M.steps.length) {
    M.active = false; const avg = M.scores.reduce((a, b) => a + (b || 0), 0) / 3, p = makeProduct(M.sp, 0.15 + 0.85 * avg);
    if (M.coopDone) { p.crisp = Math.min(1, p.crisp + .05); setTimeout(() => toast(`和 ${M.coopDone} 合作的產線：酥脆度 +5%`), 300); M.coopDone = null; }
    if (M.scores[0] != null && M.cut) { p.cut = M.cut; p.cq = Math.round(M.scores[0] * 100) / 100; if (M.scores[0] < .35) { p.wonky = true; setTimeout(() => toast('切歪了，做出一個「歪歪捏捏」：比較便宜，但有收藏家特別喜歡。凝膠沒有浪費。'), 600); } }
    S.stock.push(p); M.last = p; if (!S.lineMade) { S.lineMade = true; objSig = ''; } gainXP(5 + p.crisp * 10); saveCloud(); setTimeout(() => sfx.pop(), 350); renderHotbar(true); renderQuest();
  } else { M.step = M.steps[M.si]; beginStep(); }
  renderMake();
}
function cutShape(kind, r) {
  const sh = new THREE.Shape();
  if (kind === 'star') { for (let i = 0; i < 10; i++) { const a = Math.PI / 2 + i * Math.PI / 5, rr = i % 2 ? r * .45 : r, x = Math.cos(a) * rr, y = Math.sin(a) * rr; i ? sh.lineTo(x, y) : sh.moveTo(x, y); } sh.closePath(); }
  else { const k = r / 1.05; sh.moveTo(0, -k); sh.bezierCurveTo(.55 * k, -.55 * k, 1.05 * k, -.05 * k, 1 * k, .4 * k); sh.bezierCurveTo(.95 * k, .85 * k, .4 * k, 1 * k, 0, .55 * k); sh.bezierCurveTo(-.4 * k, 1 * k, -.95 * k, .85 * k, -k, .4 * k); sh.bezierCurveTo(-1.05 * k, -.05 * k, -.55 * k, -.55 * k, 0, -k); }
  return sh;
}
// 切面材質：切得越準越平整發亮
const faceMat = (sp, q) => new THREE.MeshPhysicalMaterial({ color: new THREE.Color(sp.color).lerp(new THREE.Color('#ffffff'), .38), roughness: .6 - .52 * q, clearcoat: q, clearcoatRoughness: .3 - .26 * q, emissive: sp.color, emissiveIntensity: .06 + .28 * q, transparent: true, polygonOffset: true, polygonOffsetFactor: -1 });
function sliceFx(q) {
  MK.pulse[0] = .25; sfx.machine(0); MK.laserHit = .15;
  const wp = W.lineG.localToWorld(new THREE.Vector3(MX[0] + .2, 1.3, 0)), sp = SP[M.sp];
  if (q < 0) { sfx.squish(.35); fx3(wp.clone().setY(wp.y + 1.3), '空刀', '#94a3b8'); W.shake = .02; return; }
  M.stop = .07; W.shake = .04 + q * .05; if (navigator.vibrate) navigator.vibrate(q > .9 ? [12, 20, 12] : 10);
  sfx.crunch(.7 + q * .6, .45 + q * .55); if (q > .9) setTimeout(() => sfx.perfect(), 60);
  if (W.goo) W.goo.emit(wp, 5 + Math.round(q * 9), sp.color, { gy: W.lineG.position.y + .72, speed: 1.3, up: 2.6, size: .045 });
  if (W.goo && q > .9) W.goo.emit(wp, 5, '#ffffff', { gy: W.lineG.position.y + .72, speed: .8, up: 3.2, size: .03 });
  spawnSlice(q); slashFx(q);
  if (q > .9) { M.stop = .12; M.slow = .3; W.fovKick = 5; screenFlash('#fff4d0'); } else if (q > .6) W.fovKick = 2.5;
  fx3(wp.clone().setY(wp.y + 1.3), q > .9 ? '完美切面！' : q > .6 ? '很好' : q > .3 ? '有點歪' : '切歪了', q > .9 ? '#f0abfc' : q > .6 ? '#34d399' : '#fbbf24', q > .9 ? 'big' : '');
  const combo = (M.g && M.g.combo) || 0;
  if (combo >= 2) setTimeout(() => fx3(wp.clone().setY(wp.y + 1.8), `${combo} 連斬！`, combo >= 4 ? '#fde047' : '#67e8f9', combo >= 3 ? 'big' : ''), 140);
  ui('make');
}
/* ---------- 切片特效：刀光、衝擊環、火花、畫面閃光（cutFxStep 每格畫面更新，下刀停頓時也照樣播放） ---------- */
const CFX = [];
function addFx(obj, dur, upd) { obj.renderOrder = 12; W.lineG.add(obj); CFX.push({ obj, t: 0, dur, upd }); upd(0); }
const glowMat = (color, opacity) => new THREE.MeshBasicMaterial({ color, transparent: true, opacity, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide });
function slashFx(q) {
  const perfect = q > .9, col = perfect ? '#fde68a' : q > .6 ? '#67e8f9' : '#fda4af', x = MX[0], LOWQ = LOW ? .6 : 1;
  // 刀光：白色刀芯＋彩色光暈，從刀口往下劃過後散開
  [[.05, '#ffffff', 1], [.36, col, .55]].forEach(([w, c, o]) => {
    const geo = new THREE.PlaneGeometry(w, 1.55); geo.translate(0, -.775, 0);
    const m = new THREE.Mesh(geo, glowMat(c, o)); m.position.set(x, 1.95, .02);
    addFx(m, .34, k => { m.scale.set(1 + k * 2.4, Math.min(1, k / .22) || .01, 1); m.material.opacity = o * (k < .3 ? 1 : 1 - (k - .3) / .7); });
  });
  // 衝擊環（完美時多一圈白色）
  (perfect ? [0, .08] : [0]).forEach((delay, j) => {
    const m = new THREE.Mesh(new THREE.RingGeometry(.15, .21, 48), glowMat(j ? '#ffffff' : col, .9)); m.position.set(x, 1.14, .05);
    const dur = .45 + delay;
    addFx(m, dur, k => { const u = Math.max(0, (k * dur - delay) / .45); m.visible = u > 0; m.scale.setScalar(1 + u * (perfect ? 9 : 6)); m.material.opacity = .9 * (1 - u); });
  });
  // 火花：往上噴出、受重力落下（低效能裝置數量減少）
  const n = Math.round((perfect ? 48 : q > .6 ? 28 : 14) * LOWQ), pos = new Float32Array(n * 3), vel = [];
  for (let i = 0; i < n; i++) { pos.set([x, 1.14 + rnd(-.25, .25), rnd(-.2, .2)], i * 3); const a = rnd(0, PI2), sp = rnd(1.5, perfect ? 5.2 : 3.6); vel.push([Math.cos(a) * sp, Math.abs(Math.sin(a)) * sp + 1, rnd(-1, 1)]); }
  const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const pts = new THREE.Points(geo, new THREE.PointsMaterial({ color: perfect ? '#fff7d6' : col, size: perfect ? .09 : .065, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
  let last = 0;
  addFx(pts, .65, k => { const dt = (k - last) * .65; last = k; for (let i = 0; i < n; i++) { vel[i][1] -= 9 * dt; pos[i * 3] += vel[i][0] * dt; pos[i * 3 + 1] += vel[i][1] * dt; pos[i * 3 + 2] += vel[i][2] * dt; } geo.attributes.position.needsUpdate = true; pts.material.opacity = 1 - k * k; });
}
function cutFxStep(dt) {
  for (let i = CFX.length - 1; i >= 0; i--) {
    const f = CFX[i]; f.t += dt; const k = Math.min(1, f.t / f.dur); f.upd(k);
    if (k >= 1) { W.lineG.remove(f.obj); f.obj.geometry.dispose(); f.obj.material.dispose(); CFX.splice(i, 1); }
  }
}
// 完美切面：畫面中央一下柔和的白光（app/station-content.css 的 #cutFlash）
function screenFlash(color) {
  let el = $('#cutFlash'); if (!el) { el = document.createElement('div'); el.id = 'cutFlash'; $('#game').appendChild(el); }
  el.style.setProperty('--fc', color); el.classList.remove('on'); void el.offsetWidth; el.classList.add('on');
}
function spawnSlice(q) {
  // 切下來的那一塊：造型切就是星形／愛心（正面朝向鏡頭），厚塊／薄片就是一片切片；它會從刀口彈起、落在輸送帶上往前送，跟著進下一台機器
  // 本體從刀口截斷：刀口到上一刀（或前端）之間那一段被切下來，剩下的本體就短了這麼多
  const sxw = .42 * (MK.sx || 2.4), uCut = clamp((MX[0] - MK.bx) / sxw, -1, 1), prevU = Math.min(MK.clipU == null ? 1 : MK.clipU, 1), L = clamp((prevU - uCut) * sxw, .06, 2);
  MK.clipU = uCut; MK.capGlint = q > .9 ? 1.6 : q * .8; if (MK.cap) { MK.cap.material.dispose(); MK.cap.material = faceMat(SP[M.sp], q); MK.capBase = MK.cap.material.emissiveIntensity; }
  const C = CUTS[M.cut] || CUTS.thick, sp = SP[M.sp], th = C.shape ? .2 : L, side = new THREE.MeshPhysicalMaterial({ color: sp.color, roughness: .15, clearcoat: 1, transparent: true }), face = faceMat(sp, q);
  let geo; if (C.shape) { geo = new THREE.ExtrudeGeometry(cutShape(C.shape, .5), { depth: th, bevelEnabled: false }); geo.translate(0, C.shape === 'heart' ? -.02 : 0, -th / 2); } else geo = new THREE.BoxGeometry(th, .7, .8);
  const m = new THREE.Mesh(geo, C.shape ? [face, side] : [face, face, side, side, side, side]); m.position.set(MX[0] + .2 + (C.shape ? 0 : th / 2), 1.14, 0); m.castShadow = !LOW; W.lineG.add(m);
  MK.pieces.push({ m, vx: 1.6, vy: 1.6, spin: 7 + rnd(0, 3), rx: 0, land: false, life: 99, th, face, side, base: face.emissiveIntensity, glint: q > .9 ? 1.6 : q * .8, z0: rnd(-.12, .12), coat: 0, h: C.shape ? .27 : .35 });
  while (MK.pieces.length > 7) dropPiece(MK.pieces.shift());
  MK.cutDone = (MK.cutDone || 0) + 1;
}
function dropPiece(p) { W.lineG.remove(p.m); p.m.geometry.dispose(); [].concat(p.m.material).forEach(x => x.dispose()); }
function piecesStep(dt) {
  const n = MK.pieces.length, slicing = M.active && M.step === 0, base = slicing ? Math.max(MK.bx + 1.3, MX[0] + .95) : MK.bx + .85, coating = M.active && M.step === 1 && M.phase === 'run';
  for (let i = n - 1; i >= 0; i--) {
    const p = MK.pieces[i], m = p.m, h = p.h;
    if (p.glint > 0) { p.glint = Math.max(0, p.glint - dt * 1.8); p.face.emissiveIntensity = p.base + p.glint + p.coat * .25; }
    if (!p.land) {
      // 從刀口彈起、翻一圈後落在輸送帶上
      p.vy -= 9.8 * dt; m.position.x += p.vx * dt; m.position.y += p.vy * dt; m.position.z += (p.z0 - m.position.z) * Math.min(1, dt * 6); p.rx += p.spin * dt;
      if (m.position.y <= .71 + h && p.vy < 0) { m.position.y = .71 + h; p.vy = 0; p.land = true; }
    } else {
      // 在輸送帶上：排在史萊姆前面，跟著一起往下一台機器移動（最先切下的排最前面）
      const tx = Math.min(7.1 - (n - 1 - i) * .3, base + (n - 1 - i) * .3), dx = tx - m.position.x;
      m.position.x += Math.sign(dx) * Math.min(Math.abs(dx), dt * 1.8); m.position.y = .71 + h + (Math.abs(dx) > .02 ? Math.abs(Math.sin(MK.t * 14 + i)) * .015 : 0);
      p.rx *= Math.max(0, 1 - dt * 10);
      // 裹糖機運轉時，在滾筒裡的塊也會裹上一層亮晶晶的糖
      if (coating) { p.coat = Math.min(1, p.coat + dt * .6); p.side.clearcoatRoughness = .5 * (1 - p.coat); p.side.emissive && p.side.emissive.set('#ffffff'); p.side.emissiveIntensity = p.coat * .12; }
      if (!M.active) p.life = Math.min(p.life, 3);
    }
    m.rotation.x = p.rx;
    if (p.life < 90) { p.life -= dt; if (p.life < .8) [].concat(m.material).forEach(x => x.opacity = Math.max(0, p.life / .8)); }
    if (p.life <= 0) { dropPiece(p); MK.pieces.splice(i, 1); }
  }
}
// 切割線（跟著史萊姆移動）與刀下的紅色雷射
function cutLinesStep(on) {
  if (!MK.cutL) {
    MK.cutL = Array.from({ length: 6 }, () => { const m = box(.035, .98, 1, new THREE.MeshBasicMaterial({ color: '#22d3ee', transparent: true, opacity: .9, depthWrite: false }), 0, 1.14, 0, W.lineG); m.visible = false; return m; });
    MK.laser = box(.014, 1.3, 1.75, new THREE.MeshBasicMaterial({ color: '#ff3b5c', transparent: true, opacity: .32, depthWrite: false, side: THREE.DoubleSide }), MX[0], 1.42, 0, W.lineG); MK.laser.visible = false;
  }
  MK.laser.visible = !!on; MK.laserHit = Math.max(0, (MK.laserHit || 0) - 1 / 60); MK.laser.material.opacity = .32 + MK.laserHit * 3;
  const g = M.g, C = on ? CUTS[M.cut] || CUTS.thick : null, pos = on && M.phase === 'run' ? slicePos(g) : 0;
  MK.cutL.forEach((m, i) => { m.visible = !!on && i < g.marks.length && g.hit[i] == null; if (!m.visible) return; m.position.x = MK.bx + LT * (.5 - g.marks[i]); const near = Math.abs(pos - g.marks[i]) < g.tol * 1.3; m.material.color.set(near ? '#ffffff' : C.col); m.scale.set(near ? 1.6 : 1, near ? 1.12 : 1, 1); });
}
// 成品上保留的切面（厚塊：一整面；薄片：一層層；星形／愛心：造型面）
// 外形的極座標表：每個角度到星形／愛心外框的距離（用來把圓角方塊變形成圓角的星形／愛心柱）
const SHAPE_R = {};
function shapeRadius(kind) {
  if (SHAPE_R[kind]) return SHAPE_R[kind];
  const pts = cutShape(kind, 1).getPoints(kind === 'star' ? 1 : 24), N = 720, out = new Float32Array(N), cy = kind === 'heart' ? .12 : 0;
  for (let k = 0; k < N; k++) {
    const a = k / N * PI2, dx = Math.cos(a), dy = Math.sin(a); let best = 0;
    for (let i = 0; i < pts.length; i++) { const p = pts[i], q = pts[(i + 1) % pts.length], ex = q.x - p.x, ey = q.y - p.y, den = dx * ey - dy * ex; if (Math.abs(den) < 1e-9) continue; const px = p.x, py = p.y - cy, t = (px * ey - py * ex) / den, u = (px * dy - py * dx) / den; if (t > 0 && u >= 0 && u <= 1) best = Math.max(best, t); }
    out[k] = best || 1;
  }
  return (SHAPE_R[kind] = { r: out, cy });
}
// 把果凍的網格變成指定外形：方塊的水平截面（方形）依角度映射到外框，厚度壓扁一點，像一塊餅乾形狀的果凍
function jellyShape(J, kind) {
  if (J.shape === kind) return; J.shape = kind; const b0 = J.base0, base = J.base, pos = J.geo.attributes.position;
  const S0 = kind ? shapeRadius(kind) : null, R0 = kind === 'heart' ? 1.3 : 1.35, TH = .62;
  for (let i = 0; i < J.n; i++) {
    let x = b0[i * 3], y = b0[i * 3 + 1], z = b0[i * 3 + 2];
    if (S0) { const a = Math.atan2(-z, x), k = Math.floor(((a + PI2) % PI2) / PI2 * 720) % 720, r = Math.pow(Math.abs(x) ** 6 + Math.abs(z) ** 6, 1 / 6), rr = S0.r[k] * R0 * r, ang = a; x = Math.cos(ang) * rr; z = -(Math.sin(ang) * rr + S0.cy * R0 * r); y *= TH; }
    base[i * 3] = x; base[i * 3 + 1] = y; base[i * 3 + 2] = z; pos.setXYZ(i, x, y, z);
  }
  J.geo.computeVertexNormals(); const nn = J.geo.attributes.normal; for (let i = 0; i < J.n; i++) { J.nor[i * 3] = nn.getX(i); J.nor[i * 3 + 1] = nn.getY(i); J.nor[i * 3 + 2] = nn.getZ(i); }
  pos.needsUpdate = true; J.geo.computeBoundingSphere(); J.sp = null; if (J.lastSp) jellyColors(J, J.lastSp);
}
function jellyCut(J, p) {
  jellyShape(J, p && p.cut && CUTS[p.cut] && CUTS[p.cut].shape ? CUTS[p.cut].shape : '');
  const key = p && p.cut && CUTS[p.cut] ? p.cut + (p.wonky ? 'w' : '') + Math.round((p.cq || 0) * 10) + p.sp : '';
  if (J.cutKey === key) return; J.cutKey = key;
  if (J.cutM) { J.group.remove(J.cutM); J.cutM.traverse(o => { if (o.isMesh) { o.geometry.dispose(); o.material.dispose(); } }); J.cutM = null; }
  if (!key) return; const C = CUTS[p.cut], q = p.cq || 0, g = new THREE.Group(), sp = SP[p.sp];
  const add = (geo, x = 0, z = 0) => { geo.rotateX(-Math.PI / 2); const m = new THREE.Mesh(geo, faceMat(sp, q)); m.position.set(x, 1.012, z); g.add(m); };
  if (C.shape) { /* 外形就是造型，不加貼面 */ }
  else if (p.cut === 'thin') [-.48, -.16, .16, .48].forEach(z => add(new THREE.PlaneGeometry(1.3, .26), 0, z));
  else add(new THREE.PlaneGeometry(1.3, 1.3));
  if (p.wonky) { g.rotation.y = .42; g.position.x = .1; g.rotation.z = .05; }
  J.group.add(g); J.cutM = g;
}
function updMakeUI() {
  const g = M.g; if (!g) return; const tb = $('#mgTime'); if (tb) tb.style.width = clamp(g.t / g.dur, 0, 1) * 100 + '%';
  if (M.step === 0) $$('#cutDots i').forEach((d, i) => d.className = g.hit[i] == null ? '' : g.hit[i] > .85 ? 'pf' : g.hit[i] > .3 ? 'ok' : 'bad');
  if (M.step === 1) { const n = $('#mgNeedle'); if (n) n.style.left = g.v * 100 + '%'; const z = document.querySelector('.rx-gauge .gz'); if (z) { z.style.left = g.lo * 100 + '%'; z.style.width = (g.hi - g.lo) * 100 + '%'; } }
  if (M.step === 2) { const t = $('#mgTgt'), k = $('#mgKnob'), x = dryTarget(g); if (t) { t.style.left = (x - g.tw) * 100 + '%'; t.style.width = g.tw * 200 + '%'; } if (k) k.style.left = g.knob * 100 + '%'; }
}
function swatch(sp) { return sp.color2 ? `linear-gradient(135deg,${sp.color},${sp.color2})` : `radial-gradient(circle at 30% 30%,${rgba(sp.color, 1, .6)},${sp.color})`; }
function renderMake() { ui('make'); if (M.active) updMakeUI(); } // 面板由 React 負責（components/stations/Make.tsx）
// 加工小遊戲的指標操作：掛在一直都在的 #p-make 上（裡面的小遊戲元素由 React 畫，會換掉）
(() => {
  const mini = document.getElementById('p-make');
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

(() => {
  const cv = document.getElementById('worldCv'); let sw = null;
  const slicing = () => GUI.kind === 'line' && M.active && M.step === 0;
  cv.addEventListener('pointerdown', e => { if (!slicing()) return; if (e.pointerType === 'mouse') { if (e.button === 0) makeAction('tap'); return; } sw = { x: e.clientX, y: e.clientY, done: false }; });
  cv.addEventListener('pointermove', e => { if (!sw || sw.done || !slicing()) return; const dy = e.clientY - sw.y; if (dy > 26 && Math.abs(e.clientX - sw.x) < dy * 1.2 + 20) { sw.done = true; makeAction('tap'); } });
  ['pointerup', 'pointercancel'].forEach(ev => cv.addEventListener(ev, () => { sw = null; }));
})();
/* ---------- 庫存卡片 ---------- */
function itemHTML(p, act, selId, extra = '') {
  const sp = SP[p.sp];
  return `<div class="card item ${selId === p.id ? 'sel' : ''}" data-act="${act}" data-id="${p.id}"><div class="sw" style="background:${swatch(sp)}"></div><div><div class="nm">${p.wonky ? '歪歪' : ''}${p.crude ? '粗製' : ''}${short(p.sp)}${p.cut ? `<small style="color:${CUTS[p.cut].col}"> ${CUTS[p.cut].n}</small>` : ''}</div><div class="meta">酥脆 ${Math.round(effCrisp(p) * 100)}% · 耐久 ${Math.round(p.dur)}%</div><div class="meta">${p.deco.length ? '裝飾 ' + p.deco.length : '無裝飾'} · 約 ${fmt(fair(p, 'live'))}${extra}</div></div></div>`;
}
const stockById = id => S.stock.find(p => p.id === +id);

/* ---------- 裝飾 ---------- */
const decorSt = makeStage($('#decorCv'), 'decor'); const D = { id: null };
decorSt.onSel = () => renderDecorTools();
function renderDecor() {
  if (!stockById(D.id)) D.id = S.stock.length ? S.stock[0].id : null;
  const p = stockById(D.id) || null; decorSt.set(p); setTimeout(decorSt.resize, 0);
  ui('decor'); // 庫存與工具由 React 畫（components/stations/Decor.tsx）
}
function renderDecorTools() { ui('decor'); } // 裝飾工具由 React 畫（components/stations/Decor.tsx）
// 介面文字不能被選取（CSS 已設 user-select:none；這裡再擋一次拖曳選取、雙擊／三擊、Ctrl+A 與拖曳圖片），輸入框照常
const editable = el => !!(el && el.closest && el.closest('input,textarea,[contenteditable="true"]'));
document.addEventListener('selectstart', e => { if (!editable(e.target)) e.preventDefault(); });
document.addEventListener('dragstart', e => { if (!editable(e.target)) e.preventDefault(); });
document.addEventListener('mousedown', e => { if (e.detail > 1 && !editable(e.target)) e.preventDefault(); });
document.addEventListener('keydown', e => { if ((e.ctrlKey || e.metaKey) && (e.key === 'a' || e.key === 'A') && !editable(document.activeElement)) e.preventDefault(); });
document.addEventListener('input', e => { const vk = e.target.dataset && e.target.dataset.vol; if (vk && S.vol && vk in S.vol) { S.vol[vk] = clamp(+e.target.value / 100, 0, 1); save(); return; } });
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
  if (Math.random() < .4) { const t = liveLine('crunch'); if (t) chat(pick(NAMES), t); }
  if (Math.random() < .05 * clamp(L.viewers / 30, .3, 2)) { const n = Math.round(rnd(5, 30) * (1 + L.combo / 10)); addMoney(n); S.fans += 0.3; sfx.coin(); if (L.ss) L.ss.tips += n; const e = document.createElement('div'); e.className = 'don'; e.textContent = `${pick(NAMES)} 斗內 ${fmt(n)}`; $('#donate').appendChild(e); setTimeout(() => e.remove(), 3000); while ($('#donate').children.length > 3) $('#donate').firstChild.remove(); }
  renderTop();
};
const bestStock = () => S.stock.slice().sort((a, b) => ((b.dur > 0) - (a.dur > 0)) || (effCrisp(b) - effCrisp(a)))[0];
liveSt.onFlat = () => { const now = performance.now(); if (now - (L.flatWarn || 0) > 4000) { L.flatWarn = now; toast('這個捏捏已經被捏扁了，換一個上台吧'); } };
function renderLive() {
  ui('live'); // 其他玩家的直播、庫存、定價由 React 畫（components/stations/Live.tsx）
  const w = !!L.watch; liveSt.watch = w; $('#watchBar').hidden = !w; $('#liveOwn').hidden = w; $('#livePriceFold').hidden = w;
  if (w) { liveSt.set(L.watch.p); setTimeout(liveSt.resize, 0); updateLiveHUD(); return; }
  if (!stockById(L.stageId)) { const b = bestStock(); L.stageId = b ? b.id : null; } liveSt.set(stockById(L.stageId) || null); setTimeout(liveSt.resize, 0);
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
function reqMatch(p) { return L.req && (L.req.kind === 'sp' ? p.sp === L.req.sp : L.req.kind === 'cut' ? p.cut === L.req.cut : effCrisp(p) >= .7); }
function liveSale(p) {
  let price = priceOf(p, 'live'), bonus = 1;
  if (reqMatch(p)) { bonus = 1.8; L.req = null; S.fans += 3; chat('系統', '指定任務完成！限時銷售成交！', 'dm'); }
  const gain = price * bonus; addMoney(gain); S.sales++; S.fans += 1 + L.hype / 30; gainXP(bonus > 1 ? 8 : 4); S.stock = S.stock.filter(q => q !== p); sfx.coin();
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
    if (L.viewers > (S.liveBest || 0)) S.liveBest = Math.round(L.viewers);
    const tgt = (12 + S.fans * 0.8) * (1 + .15 * S.up.gear) * (.4 + L.hype / 60) * (p ? 1 : .5) + L.rv.size * 15; L.viewers += (tgt - L.viewers) * dt * .8; L.saleT += dt;
    if (L.saleT >= 1.5) { L.saleT = 0; if (p) { const f = fair(p, 'live'), d0 = demand(priceOf(p, 'live'), f), d = d0 * (reqMatch(p) ? 1.6 : 1); if (d0 < .2 && Math.random() < .3) chat(pick(NAMES), pick(CHAT_EXPENSIVE)); if (Math.random() < clamp(L.viewers / 60, 0, 1) * d * .45 * (.4 + L.hype / 80)) liveSale(p); } }
    L.chatT -= dt; if (L.chatT <= 0) { L.chatT = rnd(1.5, 4) / clamp(L.viewers / 20, .5, 4); const t = liveLine('idle'); if (t) chat(pick(NAMES), t); }
    if (L.req) { L.req.t -= dt; if (L.req.t <= 0) { L.req = null; chat('系統', '指定任務已結束', 'dm'); } }
    else { L.reqT -= dt; if (L.reqT <= 0) { L.reqT = rnd(25, 40); if (Math.random() < .6) { const has = [...new Set(S.stock.map(p => p.sp))], id = has.length && Math.random() < .7 ? pick(has) : pick(unlockedSpecies()).id; L.req = { kind: 'sp', sp: id, t: 40, text: `要「${SP[id].name}」` }; } else if (S.own.slicer && Math.random() < .5) { const ck = pick(Object.keys(CUTS)); L.req = { kind: 'cut', cut: ck, t: 40, text: `要「${CUTS[ck].n}切」的` }; } else L.req = { kind: 'cr', t: 40, text: '要酥脆度 ≥ 70% 的' }; chat('系統', '新的觀眾指定：' + L.req.text, 'dm'); } }
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
  return '<div class="small" style="color:var(--sub);margin-bottom:6px">選一種定價策略就好。實際售價還會隨切法、裝飾與流行色調整（以酥脆 80% 估算）。</div>' + list.map(s => {
    const cur = tierOf(ch, s.id), f = fair({ sp: s.id, crisp: .8, dur: 100, deco: [] }, ch), tm = trend.sp === s.id ? 1.35 : 1;
    return `<div class="prow2"><span class="nm">${dot(s.color)}${s.name}${trend.sp === s.id ? ' <span class="tag">流行</span>' : ''}</span><div class="seg">${TIER.map((t, i) => { const pr = Math.max(1, Math.round(defPrice(s.id, ch) * t.m * tm)); return `<button class="${i === cur ? 'on' : ''}" data-act="tier" data-ch="${ch}" data-sp="${s.id}" data-k="${i}"><b>${t.n}</b><small>每件約 ${fmt(pr)}<br>${speedTxt(demand(pr, f))}</small></button>`; }).join('')}</div></div>`;
  }).join('');
  return list.map(s => { const f = fair({ sp: s.id, crisp: .8, dur: 100, deco: [] }, ch), l = demandLabel(demand(getPrice(ch, s.id), f));
    return `<div class="prow"><span class="nm">${dot(s.color)}${s.name}${trend.sp === s.id ? ' <span class="tag">流行</span>' : ''}<br><small style="color:var(--sub)">基準合理價 ${fmt(f)}</small></span><input type="number" min="1" max="99999" value="${getPrice(ch, s.id)}" data-price="${ch}" data-sp="${s.id}"><span class="dem" style="color:${l[1]}">${l[0]}</span></div>`; }).join('');
}
document.addEventListener('change', e => { const t = e.target; if (!t.dataset || !t.dataset.price) return; S.price[t.dataset.price][t.dataset.sp] = clamp(Math.round(+t.value) || 1, 1, 99999); save(); t.blur(); t.dataset.price === 'live' ? renderLive() : renderWeb(); });

/* ---------- 網站 ---------- */
const rating = () => { const a = S.rate.slice(-20); return a.reduce((x, y) => x + y, 0) / a.length; };
function webTick() {
  // 前兩筆訂單保證賣出：讓新玩家很快拿到第一筆收入
  const first = S.sales < 2; if (!S.web.length || (!first && Math.random() > clamp(0.25 + S.fans / 400 + (rating() - 3) * .1, .05, .9))) return null;
  const p = pick(S.web), f = fair(p, 'web'), coll = p.wonky && Math.random() < .3; let price = priceOf(p, 'web'); if (!first && !coll && Math.random() > demand(price, f) * .7) return null;
  if (coll) price = Math.round(price / .6 * 1.6); // 收藏家：歪得剛剛好，願意出高價
  addMoney(price); S.sales++; S.fans += .3; gainXP(2); S.web = S.web.filter(q => q !== p);
  const stars = clamp(Math.round(1 + 2.2 * effCrisp(p) + 1.8 * clamp(f / price, 0, 1.3)), 1, 5); S.rate.push(stars); if (S.rate.length > 40) S.rate.shift();
  const cutTxt = p.cut ? (p.cq > .85 ? `${CUTS[p.cut].n}切面平整發亮，好美！` : p.cq < .45 ? '切面有點歪歪的。' : '') : '';
  S.reviews.unshift(coll ? { s: 5, t: '收藏家：歪得剛剛好，收藏了！', who: pick(NAMES), sp: SP[p.sp].name } : { s: stars, t: pick(REVIEWS[stars]) + (cutTxt ? ' ' + cutTxt : ''), who: pick(NAMES), sp: SP[p.sp].name }); S.reviews.length = Math.min(S.reviews.length, 8); return { price, stars };
}
function renderWeb() { ui('web'); } // 畫面改由 React 負責（components/stations/）

/* ---------- 升級 ---------- */
const upCost = k => Math.round(UPS[k].base * Math.pow(1.7, S.up[k]));
const lvBar = (lv, max) => `<span class="lv">${Array.from({ length: max }, (_, j) => `<i class="${j < lv ? 'on' : ''}"></i>`).join('')}</span>`;
function renderUp() { ui('shop'); } // 畫面改由 React 負責（components/stations/）

/* ---------- 展示場 ---------- */
function renderMuseum() { ui('museum'); } // 畫面改由 React 負責（components/stations/）
function renderVisit() { W.likeT = W.likeT || {}; ui('visit'); } // 畫面改由 React 負責（components/stations/）
/* ---------- 本週限定訂單：每週輪替 ---------- */
const WEEK_MS = 7 * 864e5, weekNo = () => Math.floor((Date.now() + 3 * 864e5) / WEEK_MS);
function weeklyOrders() {
  const w = weekNo(), us = unlockedSpecies(), r = seeded(w * 97 + 13), cuts = Object.keys(CUTS);
  return [0, 1, 2].map(i => { const sp = us[Math.floor(r() * us.length)], cut = cuts[Math.floor(r() * cuts.length)], n = i + 1, min = [.55, .65, .75][i];
    return { id: w * 10 + i, sp: sp.id, cut: S.own.slicer ? cut : null, n, min, reward: Math.round(sp.price * 1.28 * 1.4 * n * (2.2 + i * .5)), fans: 4 + i * 3 }; });
}
const wkItems = o => S.stock.filter(p => p.sp === o.sp && (!o.cut || p.cut === o.cut) && effCrisp(p) >= o.min).sort((a, b) => effCrisp(a) - effCrisp(b)).slice(0, o.n);
function renderWeekly() { if (S.wk.w !== weekNo()) S.wk = { w: weekNo(), done: [] }; ui('weekly'); } // 畫面改由 React 負責（components/stations/）
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
  const fw = $('#facWrap'), showFac = S.branch === 'factory';
  if (fw.hidden === showFac) { fw.hidden = !showFac; if (showFac) setTimeout(() => { initFac(); FAC.v && FAC.v.resize(); }, 0); }
  ui('branch'); return; // 內容由 React 畫（components/stations/Branch.tsx）
}
function contractItems(c) { return S.stock.filter(p => (c.sp === 'any' || p.sp === c.sp) && (!c.cut || p.cut === c.cut) && effCrisp(p) >= c.min).sort((a, b) => effCrisp(a) - effCrisp(b)).slice(0, c.n); }
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
    if (BT.ct > 20 && S.contracts.length < 3) { BT.ct = 0; const us = unlockedSpecies(), n = 2 + Math.floor(Math.random() * 3), any = Math.random() < .4, sp = any ? 'any' : pick(us).id, min = clamp(.35 + .05 * S.rep + rnd(0, .15), .3, .9), base = any ? us.reduce((a, s) => a + s.price, 0) / us.length : SP[sp].price; const cut = Math.random() < .35 ? pick(Object.keys(CUTS)) : null; S.contracts.push({ id: S.nextId++, sp, n, min, cut, reward: Math.round(n * base * (0.4 + 1.1 * (min + .1)) * 1.5 * (1 + S.rep * .05) * (cut ? 1.25 : 1)), dl: now + 240000 }); toast('收到新的企業訂單（工作電腦 → 事業）'); }
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
const GOAL = { species: SPECIES.length, fans: 800, earned: 40000 };
function renderCodex() { ui('codex'); } // 畫面改由 React 負責（components/stations/）
function finish() { S.done = true; saveCloud(); if (W.musLabel) { const p = W.musLabel.position.clone(), par = W.musLabel.parent; dropObj(W.musLabel); W.musLabel = textSprite('夢想捏捏博物館', '#fbbf24', '擺出得意作品，朋友可以來參觀'); W.musLabel.position.copy(p); par.add(W.musLabel); } const txt = { factory: '你的工廠日夜運轉，月光谷的酥脆聲成為了全世界的背景音樂。', corp: '你與大企業攜手，把史萊姆捏捏帶進每個人的辦公桌，成為解壓文化的代名詞。', shop: '你的小店成了鎮上的溫暖角落，熟客們帶著笑容與酥脆聲度過每個日子。' }[S.branch || 'shop']; modal(`<h2>夢想捏捏博物館開幕</h2><p>${txt}</p><p>你是真正的史萊姆捏捏大師。你可以繼續遊玩，享受酥脆的療癒時光。</p>`); }
let invSel = null;
function renderInv() { ui('inv'); } // 畫面改由 React 負責（components/stations/）
const RENDER = { bench: renderBench, mach: () => renderShop('mach'), gear: () => renderShop('gear'), mall: () => renderShop('mall'), arms: () => renderShop('arms'), eshop: () => renderShop('eshop'), weekly: renderWeekly, museum: renderMuseum, visit: renderVisit, mapg: renderMapGame, riddle: renderRiddle, make: renderMake, decor: renderDecor, live: renderLive, web: renderWeb, up: renderUp, branch: renderBranch, codex: renderCodex, inv: renderInv, pause: renderPause };

/* ---------- 開發者工具（管理員與管理後台設定的開發測試帳號）：一鍵解鎖全部地圖，方便測試各區 ---------- */
const isDev = () => !!(window.SlimeCloud && SlimeCloud.user && (SlimeCloud.user.dev || SlimeCloud.user.admin));
function devUnlockZones() {
  if (!isDev()) return toast('只有開發測試帳號可以使用');
  const added = [];
  ZONES.forEach(z => { if (S.zones.includes(z.id)) return; S.zones.push(z.id); added.push(z.name); openGate(z.id); if (!W.mirror) spawnZone(z.id); });
  if (!S.own.coat) { S.own.coat = true; added.push('保暖衣'); } refreshCold();
  objSig = ''; renderObjective(); renderQuest(); renderHotbar(true); saveCloud(); sfx.level(); ui('pause');
  toast(added.length ? `已解鎖：${added.join('、')}` : '全部地圖本來就已經解鎖了');
}
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
    case 'tier': { const ch = el.dataset.ch, sp = el.dataset.sp; if (!(ch in S.tier) || !SP[sp]) return; S.tier[ch][sp] = clamp(+k, 0, 2); save(); sfx.tick(); ch === 'live' ? renderLive() : renderWeb(); break; }
    case 'show': { const p = stockById(id); if (!p) return; if (S.show.length >= 4) return toast('展示台最多擺 4 個作品'); S.stock = S.stock.filter(q => q !== p); S.show.push(p); sfx.pop(); renderMuseum(); renderHotbar(true); save(); break; }
    case 'unshow': { const p = S.show.find(q => q.id === +id); if (!p) return; if (S.stock.length >= cap()) return toast('庫存已滿'); S.show = S.show.filter(q => q !== p); S.stock.push(p); renderMuseum(); renderHotbar(true); save(); break; }
    case 'like': { W.likeT = W.likeT || {}; if (Date.now() - (W.likeT[id] || 0) < 60000) return; W.likeT[id] = Date.now(); netEmit({ t: 'like', to: id }); toast('已按讚！'); sfx.tick(); renderVisit(); break; }
    case 'wkDeliver': { if (S.wk.w !== weekNo()) S.wk = { w: weekNo(), done: [] }; const o = weeklyOrders().find(x => x.id === +id); if (!o || S.wk.done.includes(o.id)) return; const it = wkItems(o); if (it.length < o.n) return; S.stock = S.stock.filter(p => !it.includes(p)); addMoney(o.reward); S.fans += o.fans; gainXP(15); S.wk.done.push(o.id); sfx.level(); toast(`本週限定訂單完成 +${fmt(o.reward)}　粉絲 +${o.fans}`); refresh(); save(); break; }
    case 'pickCut': if (CUTS[k] && !M.active) { S.cut = k; renderMake(); save(); } break;
    case 'decoSel': D.id = +id; renderDecor(); break;
    case 'addDeco': { const p = decorSt.p; if (!p) return; if (p.deco.length >= 6) return toast('最多 6 個零件');
      if (DECO[k] && DECO[k].pack === 'cave') { if (!(S.cave && S.cave.mossN > 0)) return toast('還沒有苔光：到山洞裡摘發光苔蘚（每個洞每天 3 次）'); S.cave.mossN--; } p.deco.push({ k, x: rnd(-.45, .45), z: rnd(-.45, .45), s: 1, r: 0 }); decorSt.sel = p.deco.length - 1; decorSt.rebuildDeco(); sfx.tick(); renderDecorTools(); save(); break; }
    case 'delDeco': { const p = decorSt.p; if (p && decorSt.sel >= 0) { const gone = p.deco[decorSt.sel]; if (gone && DECO[gone.k] && DECO[gone.k].pack === 'cave' && S.cave) S.cave.mossN = (S.cave.mossN || 0) + 1; p.deco.splice(decorSt.sel, 1); decorSt.sel = -1; decorSt.rebuildDeco(); renderDecorTools(); save(); } break; }
    case 'photo': { if (!decorSt.ready) return; decorSt.selRing.visible = false; decorSt.v.render(); const a2 = document.createElement('a'); a2.download = 'squish-lab.png'; a2.href = decorSt.cv.toDataURL('image/png'); a2.click(); toast('已儲存圖片'); break; }
    case 'toggleLive': L.auto = false; toggleLive(); setTimeout(liveBroadcast, 50); break;
    case 'stageSel': L.stageId = +id; renderLive(); liveBroadcast(); break;
    case 'watch': startWatch(id); break;
    case 'unwatch': stopWatch(); renderLive(); break;
    case 'lchatSend': sendLiveChat(); break;
    case 'donate': donate(); break;
    case 'chat': openChat(); break;
    case 'acctName': { const C = window.SlimeCloud, inp = $('#acctName'); if (!C || !inp) break; const n = inp.value.trim(); if (!n) { toast('暱稱不能是空的'); break; } C.rename(n).then(name => { S.name = name; save(); toast(`暱稱已改成「${name}」`); renderPause(); }).catch(e => toast(e.message)); break; }
    case 'logout': { const C = window.SlimeCloud; if (!C) break; save(); netLeave(true); C.logout(false).then(ok => { if (!ok) modal('<h2>進度還沒傳到雲端</h2><p>目前連不上伺服器。現在登出的話，新的進度會留在這台電腦，下次用同一個帳號在這台電腦登入時再上傳。</p>', [{ t: '取消', ghost: true }, { t: '仍要登出', red: true, f: () => C.logout(true) }]); }); break; }
    case 'delMe': modal('<h2>刪除我的資料？</h2><p>會刪除你在伺服器上的帳號、遊戲進度與保留中的存檔，所有裝置都會登出，這台電腦上的進度也會清除。<b>刪除後無法復原。</b></p>', [{ t: '取消', ghost: true }, { t: '永久刪除', red: true, f: () => { netLeave(true); window.SlimeCloud.deleteMe().catch(e => toast(e.message)); } }]); break;
    case 'saveNow': saveCloud(); S.savedAt = Date.now(); toast('遊戲已儲存'); renderPause(); break;
    case 'toTitle': if (M.active) { S.gel[M.sp] = (S.gel[M.sp] || 0) + 2; M.active = false; M.g = null; toast('產線中斷，已退回 2 份凝膠'); } saveCloud(); netLeave(true); showTitle(); break;
    case 'netLeave': netLeave(); renderPause(); break;
    case 'tContinue': continueGame(); break;
    case 'tNew': newGameAsk(); break;
    case 'tMulti': TITLE.mp = true; renderTitle(); { const n = $('#mpName'); if (n) n.value = S.name || ''; } break;
    case 'tBack': TITLE.mp = false; renderTitle(); break;
    case 'mpHost': netHost(); break;
    case 'mpJoin': netJoin($('#mpCode').value); break;
    case 'list': { const p = stockById(id); if (!p) return; if (p.played || p.dur < 100) return toast('玩過的捏捏不能上架到網站，只能在直播或其他通路販售'); if (S.web.length >= slots()) return toast('貨架已滿，請升級網站伺服器'); S.stock = S.stock.filter(q => q !== p); S.web.push(p); renderWeb(); renderHotbar(); save(); break; }
    case 'unlist': { const p = S.web.find(q => q.id === +id); if (!p) return; if (S.stock.length >= cap()) return toast('庫存已滿'); S.web = S.web.filter(q => q !== p); S.stock.push(p); renderWeb(); renderHotbar(); save(); break; }
    case 'buyOwn': if (purchase('own', k, 'web')) sfx.pop(); break; // 網購：網頁本身就是回饋（蓋「已購買」章），不跳 toast；大東西關上電腦後綁氣球降落
    case 'benchMake': benchMake(); break;
    case 'mapRot': mapRotate(+el.dataset.i); break;
    case 'hint': giveHint(k); break;
    case 'buyUp': if (purchase('up', k, 'web')) sfx.level(); break;
    case 'buyPack': if (purchase('pack', k, 'web')) sfx.level(); break;
    case 'chooseBranch': chooseBranch(k); break;
    case 'hire': { const c = Math.round(400 * Math.pow(1.5, S.workers)); if (S.money >= c) { S.money -= c; S.workers++; renderBranch(); renderTop(); saveCloud(); } break; }
    case 'auto': { const c = Math.round(600 * Math.pow(1.8, S.auto)); if (S.money >= c) { S.money -= c; S.auto++; renderBranch(); renderTop(); saveCloud(); } break; }
    case 'deliver': { const c = S.contracts.find(x => x.id === +id); if (!c) return; const it = contractItems(c); if (it.length < c.n) return; S.stock = S.stock.filter(p => !it.includes(p)); S.contracts = S.contracts.filter(x => x !== c); addMoney(c.reward); S.rep++; gainXP(8); S.fans += 2; sfx.pop(); toast(`交貨完成 +${fmt(c.reward)}`); refresh(); save(); break; }
    case 'serve': { const c = S.customers.find(x => x.id === +id); if (!c) return; const p = shopItem(c); if (!p) return; const pr = shopPrice(c, p), aff = S.regulars[c.name] || 0, tip = aff >= 5 ? Math.round(pr * .15) : 0; S.stock = S.stock.filter(q => q !== p); S.customers = S.customers.filter(x => x !== c); S.regulars[c.name] = aff + 1; gainXP(4); addMoney(pr + tip); S.fans += 1; sfx.pop(); toast(`${c.name} 滿意離開 +${fmt(pr + tip)}${tip ? '（含小費）' : ''}`); refresh(); save(); break; }
    case 'finish': finish(); break;
    case 'devZones': devUnlockZones(); break;
    case 'sound': S.sound = !S.sound; renderTop(); save(); if (TITLE.on) renderTitle(); break;
    case 'avatar': setAvatar(k); break;
    case 'pickSave': closeModal(); switchSave(+k); break;
    case 'delSave': delSaveAsk(+k); break;
    case 'quality': if (['auto', 'high', 'low'].includes(k)) { S.quality = k; applyQuality(true); save(); ui('pause'); toast('畫質：' + { auto: '自動', high: '高', low: '低' }[k]); } break;
    case 'sens': S.sens = (S.sens + 1) % 3; renderTop(); save(); break;
    case 'help': showHelp(); break;
    case 'home': if (RIDE.on) break; if (inCity()) { closeGui(); setTimeout(() => rideStart('c2v', { seated: true }), HC.fade + 30); } else homeStamp(); break; // 城市：直接坐進招呼站的車走回程；月光谷：筆記本擋著時換位置，不跳 toast
    case 'reset': modal('<h2>重置存檔？</h2><p>所有進度將被清除，無法復原。</p>', [{ t: '取消', ghost: true }, { t: '確定重置', f: newGame }]); break;
  }
});
// 加工的「停機」用 pointerdown 觸發：比 click 少一個放開手指的延遲，計時更準
function creditsHTML() { const L0 = MUS.list; if (!L0) return ''; const a = Object.values(L0).filter(t => t && t.title); return a.length ? '<p class="small" style="color:var(--sub);margin-top:8px"><b>配樂</b>：' + a.map(t => esc(t.title) + ' — ' + esc(t.author || '') + '（' + esc(t.license || '') + '）').join('；') + '</p>' : ''; }
function showHelp() {
  const keys = TOUCH
    ? '<div class="keys"><kbd>左下</kbd><span>拖曳虛擬搖桿移動</span><kbd>右側</kbd><span>滑動轉動視角，輕點物件即可互動</span><kbd>手掌</kbd><span>對準準心的物件互動（採集、使用工作站），按住可連續捏</span><kbd>箭頭</kbd><span>跳躍</span><kbd>閃電</kbd><span>切換奔跑</span><kbd>腳印</kbd><span>切換潛行：腳步變輕，靠近怕生的稀有史萊姆</span><kbd>右上</kbd><span>背包、選單</span></div>'
    : '<div class="keys"><kbd>WASD</kbd><span>移動</span><kbd>滑鼠</kbd><span>環顧四周（點擊畫面鎖定滑鼠）</span><kbd>E / 左鍵</kbd><span>互動：採集史萊姆、使用工作站、調查線索（按住可連續捏）</span><kbd>空白鍵</kbd><span>跳躍（切片時下刀、裹糖時按住加速）</span><kbd>Shift</kbd><span>奔跑（史萊姆會更早發現你）</span><kbd>C（按住）</kbd><span>潛行：腳步變輕，怕生的稀有史萊姆不容易察覺</span><kbd>1–9 / 滾輪</kbd><span>選擇快捷列</span><kbd>I / Tab</kbd><span>背包與探索日誌</span><kbd>Alt</kbd><span>暫時放開滑鼠（遊戲不暫停），再按一次或點擊畫面回到操控</span><kbd>Esc</kbd><span>關閉介面／選單</span></div>';
  modal(`<h2>操作說明</h2>${keys}<p class="small" style="color:var(--sub);margin-top:10px">採集技巧：準心外圈的三格代表採集進度。每一下之間抓穩約 0.3 秒的節奏，連續「完美」可以多得 1 份凝膠。稀有史萊姆很怕生，會逃跑，要潛行慢慢靠近。<br>遊戲循環：採集凝膠 → 工坊加工 → 裝飾 → 直播或網站販售 → 升級。拿著捏捏對準網站貨架就能上架；站上直播舞台就開直播。多人時：巨型史萊姆要兩人一起捏、拿著凝膠對準朋友可以送給對方、朋友站在產線旁會幫你裹糖。山脊上的能量門要解開前一區的謎題才會開啟。</p>`);
}


/* ============================================================
   主選單（開始畫面）
   ============================================================ */
const TITLE = { on: false };
function fmtTime(t) { if (!t) return '—'; const d = new Date(t); return `${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`; }
function renderTitle() { ui('title'); } // 主選單由 React 負責（components/stations/Title.tsx）
function showTitle() {
  rideAbort(); // 搭車中回主選單：人放回安全的站位、兩台車回站位、霧光曝光圖層還原
  if (GUI.kind) { GUI.kind = null; GUI.focus = null; tab = ''; guiHide(true); }
  if (L.watch) L.watch = null; L.on = false; M.active = false;
  unlockMouse(); TITLE.on = true; TITLE.mp = false; if (VM.g) VM.g.visible = false; IN.hold = IN.holdE = false; document.body.classList.add('titleon'); $('#title').hidden = false; $('#startHint').hidden = true; renderTitle();
}
function startPlay() {
  if (S.coatMigrated) { S.coatMigrated = false; save(); setTimeout(() => toast('偵測到你已經開啟雪原：已補發保暖衣（現在雪原需要保暖衣才能進入）'), 1500); }
  if (S.ownMigrated) { S.ownMigrated = false; save(); setTimeout(() => toast('偵測到改版前的存檔：已補發你原本擁有的加工機器、裝飾桌與直播設備'), 900); }
  TITLE.on = false; document.body.classList.remove('titleon'); $('#title').hidden = true;
  if (introStart(playReady)) return; // 第 4 堂：每次進入遊戲先用穿越機視角穿過一條山洞、進到中央平地（caves.js）
  playReady();
}
function playReady() {
  $('#startHint').hidden = TOUCH || locked(); W.camAway = false; toast(S.tutDone ? '歡迎回到月光谷。左上角是目前目標。' : '歡迎來到月光谷！跟著畫面中央的提示一步一步來。');
  if (!S.seen) { S.seen = true; save(); modal('<h2>奶奶的信</h2><div class="riddle" style="text-align:left">親愛的孩子：<br>月光谷那間舊工坊，現在交給你了。窗戶破了、屋頂也缺了幾片瓦，但史萊姆們還在等著被捏。<br>每完成一件事，工坊就會慢慢變回從前的樣子。<br>——奶奶</div>', [{ t: '收下工坊' }]); }
}
function avatarSVG(id) {
  const a = avatarOf(id), g = 'ag' + a.id, E = a.e;
  const eye = (x) => E === 'happy' ? `<path d="M${x - 4} 37q4-5 8 0" stroke="#1e293b" stroke-width="2.6" fill="none" stroke-linecap="round"/>`
    : E === 'sleepy' ? `<path d="M${x - 4} 37h8" stroke="#1e293b" stroke-width="2.6" stroke-linecap="round"/>`
    : E === 'star' ? `<path d="M${x} 31.5l1.6 3.6 3.9.4-2.9 2.6.8 3.8-3.4-2-3.4 2 .8-3.8-2.9-2.6 3.9-.4z" fill="#1e293b"/>`
    : E === 'cool' ? `<rect x="${x - 6}" y="33" width="12" height="6" rx="2.5" fill="#1e293b"/>`
    : `<ellipse cx="${x}" cy="36" rx="3.4" ry="4.2" fill="#1e293b"/><circle cx="${x + 1.2}" cy="34.4" r="1.2" fill="#fff"/>`;
  const eyes = E === 'wink' ? eye(25) + `<path d="M35 37q4-4 8 0" stroke="#1e293b" stroke-width="2.6" fill="none" stroke-linecap="round"/>` : eye(25) + eye(39);
  const mouth = E === 'open' ? '<ellipse cx="32" cy="45" rx="3.6" ry="3" fill="#7f1d1d"/>' : E === 'shy' ? '<path d="M29 45q3 2 6 0" stroke="#1e293b" stroke-width="2.2" fill="none" stroke-linecap="round"/>' : '<path d="M27 43q5 5 10 0" stroke="#1e293b" stroke-width="2.4" fill="none" stroke-linecap="round"/>';
  return `<svg viewBox="0 0 64 64" width="100%" height="100%" aria-hidden="true"><defs><radialGradient id="${g}" cx=".35" cy=".3" r=".8"><stop offset="0" stop-color="#fff" stop-opacity=".85"/><stop offset=".35" stop-color="${a.c}"/><stop offset="1" stop-color="${a.d}"/></radialGradient></defs>`
    + `<ellipse cx="32" cy="56" rx="21" ry="3.5" fill="#0003"/><path d="M9 51C9 30 19 13 32 13s23 17 23 38c0 4-3 6-8 6H17c-5 0-8-2-8-6z" fill="url(#${g})" stroke="${a.d}" stroke-width="1.5"/>`
    + `<ellipse cx="22" cy="23" rx="5" ry="3" fill="#fff" opacity=".55" transform="rotate(-30 22 23)"/>${eyes}${mouth}`
    + `<ellipse cx="19" cy="44" rx="3.6" ry="2.2" fill="#fb7185" opacity=".45"/><ellipse cx="45" cy="44" rx="3.6" ry="2.2" fill="#fb7185" opacity=".45"/></svg>`;
}
function setAvatar(id) {
  if (!AVATARS.some(a => a.id === id)) return; S.avatar = id; if (NET.on) NET.color = avatarOf(id).d; save(); ui('pause'); ui('title'); toast('頭像換成「' + avatarOf(id).n + '史萊姆」');
}
/* ---------- 多存檔：目前的進度（slime_world_v1，會同步到雲端）加上最多 2 個另存的存檔（只存在這台電腦），共 3 個 ---------- */
const MAX_SAVES = 3, slotKey = i => 'slime_slot_v1_' + ((window.SlimeCloud && SlimeCloud.user && SlimeCloud.user.id) || 'local') + '_' + i;
function savesInfo() {
  const parse = raw => { try { const o = JSON.parse(raw); return o && typeof o === 'object' && o.seen ? o : null; } catch (e) { return null; } };
  const out = []; const cur = parse(lsGet(SAVE_KEY)); if (cur) out.push({ slot: 0, o: cur });
  for (let i = 1; i < MAX_SAVES; i++) { const o = parse(lsGet(slotKey(i))); if (o) out.push({ slot: i, o }); }
  return out;
}
const saveLabel = e => { const o = e.o; return 'Lv ' + (xpLevel(Math.max(0, +o.xp || 0)) + 1) + ' · ' + fmt(+o.money || 0) + ' · 粉絲 ' + Math.floor(+o.fans || 0) + ' · ' + fmtTime(o.last); };
const freeSlot = () => { for (let i = 1; i < MAX_SAVES; i++) if (!lsGet(slotKey(i))) return i; return 0; };
// 把存檔 slot 換成目前的進度（0＝目前這份）：目前的進度另存到被換掉的位置，再重新載入遊戲
function switchSave(slot) {
  if (!slot) { startPlay(); return; }
  rideAbort(); save(); const cur = lsGet(SAVE_KEY), pick = lsGet(slotKey(slot)); if (!pick) return;
  NOSAVE = true; netLeave(true);
  try { if (cur) localStorage.setItem(slotKey(slot), cur); else localStorage.removeItem(slotKey(slot)); localStorage.setItem(SAVE_KEY, pick); sessionStorage.setItem('squish_autostart', '1'); } catch (e) { NOSAVE = false; toast('切換存檔失敗'); return; }
  if (window.SlimeCloud) SlimeCloud.swapLocal(); location.reload();
}
function closeModal() { mOpen = false; $('#modal').hidden = true; nextModal(); }
function agoTxt(t) { if (!t) return '—'; const m = Math.floor((Date.now() - t) / 6e4); return m < 1 ? '剛剛' : m < 60 ? m + ' 分鐘前' : m < 1440 ? Math.floor(m / 60) + ' 小時前' : Math.floor(m / 1440) + ' 天前'; }
function saveCardHTML(e) {
  const o = e.o, zs = (Array.isArray(o.zones) ? o.zones : ['forest']).filter(z => ZONES.some(x => x.id === z)), cx = o.codex && typeof o.codex === 'object' ? Object.keys(o.codex).filter(k => SP[k]).length : 0;
  const nm = esc(String(o.name || (window.SlimeCloud && SlimeCloud.user && SlimeCloud.user.name) || '工坊主人').slice(0, 12)), lv = xpLevel(Math.max(0, +o.xp || 0)) + 1;
  return '<div class="sv-card' + (e.slot ? '' : ' cur') + '"><button type="button" class="sv-main" data-act="pickSave" data-k="' + e.slot + '">'
    + '<span class="sv-av">' + avatarSVG(o.avatar) + '</span><span class="sv-body"><span class="sv-hd"><b>' + nm + '</b><span class="sv-lv">Lv ' + lv + '</span>' + (e.slot ? '<span class="sv-tag">這台電腦</span>' : '<span class="sv-tag cur">目前・雲端同步</span>') + '</span>'
    + '<span class="sv-stats"><span><em>資金</em><b class="gold">' + fmt(+o.money || 0) + '</b></span><span><em>粉絲</em><b>' + Math.floor(+o.fans || 0) + '</b></span><span><em>圖鑑</em><b>' + cx + '/' + SPECIES.length + '</b></span><span><em>區域</em><b>' + zs.length + '/' + ZONES.length + '</b></span></span>'
    + '<span class="sv-ft">' + zs.map(z => ZONES.find(x => x.id === z).name).join('・') + '<i>上次遊玩 ' + fmtTime(o.last) + '（' + agoTxt(o.last) + '）</i></span></span><span class="sv-go">' + (e.slot ? '切換' : '繼續') + '</span></button>'
    + (e.slot ? '<button type="button" class="sv-del" data-act="delSave" data-k="' + e.slot + '" aria-label="刪除這個存檔">刪除</button>' : '') + '</div>';
}
function continueGame() {
  const list = savesInfo(); if (list.length < 2) return startPlay();
  modal('<h2>選擇存檔</h2><p class="small" style="color:var(--sub)">共 ' + list.length + '/' + MAX_SAVES + ' 個存檔。目前使用中的那份會同步到雲端，其他存檔只存在這台電腦。</p><div class="sv-list">' + list.map(saveCardHTML).join('') + '</div>', [{ t: '取消', ghost: true }]);
}
function delSaveAsk(slot) {
  const e = savesInfo().find(x => x.slot === slot); if (!slot || !e) return; closeModal();
  modal('<h2>刪除這個存檔？</h2><div class="sv-list">' + saveCardHTML(e).replace(/data-act="[^"]*"/g, '') + '</div><p>刪除後無法復原。</p>', [{ t: '取消', ghost: true, f: continueGame }, { t: '刪除', red: true, f: () => { try { localStorage.removeItem(slotKey(slot)); } catch (er) { } toast('存檔已刪除'); ui('title'); continueGame(); } }]);
}
function newGameAsk() {
  const list = savesInfo(); if (!list.length) return newGame();
  if (list.length < MAX_SAVES) return modal('<h2>開始新遊戲？</h2><p>目前的進度會另存起來（存檔 ' + list.length + '/' + MAX_SAVES + '），之後可以從「繼續遊戲」選回來。</p>', [{ t: '取消', ghost: true }, { t: '開始新遊戲', f: () => newGame(freeSlot()) }]);
  modal('<h2>存檔已滿（3/3）</h2><p>要先刪除一個存檔，才能開始新遊戲。刪除後無法復原。</p>', [...list.map(e => ({ t: '刪除：' + saveLabel(e), red: true, f: () => modal('<h2>確定刪除這個存檔？</h2><p>' + esc(saveLabel(e)) + '</p><p>刪除後無法復原。</p>', [{ t: '取消', ghost: true }, { t: '刪除並開始新遊戲', red: true, f: () => newGame(e.slot ? e.slot : 0) }]) })), { t: '取消', ghost: true }]);
}
function newGame(archiveTo) {
  // archiveTo：把目前的進度另存到這個位置（沒給＝直接丟掉目前進度）。slot 0 以外的位置若已有存檔，會被目前進度取代
  if (archiveTo) { save(); const cur = lsGet(SAVE_KEY); if (cur) { try { localStorage.setItem(slotKey(archiveTo), cur); } catch (e) { toast('存檔空間不足，無法另存目前進度'); return; } } }
  NOSAVE = true; netLeave(true); try { localStorage.removeItem(SAVE_KEY); sessionStorage.setItem('squish_autostart', '1'); } catch (e) { } if (window.SlimeCloud) SlimeCloud.resetLocal(); location.reload(); }
function titleStep(dt) {
  musicStep(dt);
  W.t += dt; W.wind.value = W.t; if (++W.cullN % 8 === 0 || W.cullN === 1) cullChunks(W.cam.position); slimeStep(dt, W.t); lineStep(dt); W.anim.forEach(f => f(dt, W.t)); envStep(dt);
  const a = W.t * .04; W.cam.position.set(Math.sin(a) * 30, 13 + Math.sin(W.t * .1) * 2, Math.cos(a) * 30); W.cam.lookAt(0, 2.5, 0);
  W.r.render(W.scene, W.cam);
}
// 帳號（Google 登入）：改暱稱、登出、刪除我的資料；畫面上不顯示 email
function renderAcct() { ui('pause'); } // 帳號區塊在暫停選單裡（components/stations/Pause.tsx）
function renderPause() { renderTop(); ui('pause'); } // 暫停選單由 React 負責（components/stations/Pause.tsx）

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
  return { name: nStr(m.name, 12) || '玩家', color: nCol(m.color), x: nNum(m.x, -1e4, 1e4), y: nNum(m.y, -100, 500), z: nNum(m.z, -1e4, 1e4), yaw: nNum(m.yaw, -1e3, 1e3), rd: m.rd ? 1 : 0, live: lv, held: typeof m.held === 'string' && /^[pg]\d{1,2}$/.test(m.held) ? m.held : '', show: Array.isArray(m.show) ? m.show.slice(0, 4).filter(x => x && SP[x.sp]).map(x => ({ sp: x.sp, cut: CUTS[x.cut] ? x.cut : null, cr: Math.round(nNum(x.cr, 0, 100)) })) : [] };
}
function nProd(p) {
  if (!p || typeof p !== 'object' || !SP[p.sp]) return null;
  const deco = (Array.isArray(p.deco) ? p.deco : []).filter(d => d && DECO[d.k]).slice(0, 6).map(d => ({ k: d.k, x: nNum(d.x, -1, 1), z: nNum(d.z, -1, 1), s: nNum(d.s, .3, 2.5, 1), r: nNum(d.r, -7, 7) }));
  const o = { id: Math.floor(nNum(p.id, 0, 1e9)), sp: p.sp, crisp: nNum(p.crisp, 0, 1, .5), dur: nNum(p.dur, 0, 100, 100), deco, cracks: (Array.isArray(p.cracks) ? p.cracks : []).slice(-30).map(nCrack).filter(Boolean) };
  if (CUTS[p.cut]) { o.cut = p.cut; o.cq = nNum(p.cq, 0, 1); } if (p.wonky) o.wonky = true; return o;
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
  like: m => ({ t: 'like', to: nStr(m.to, 64) }),
  gift: m => ({ t: 'gift', to: nStr(m.to, 64), sp: SP[m.sp] ? m.sp : null, n: Math.round(nNum(m.n, 1, 5, 1)) }),
  coop: m => ({ t: 'coop', to: nStr(m.to, 64), on: !!m.on, lo: nNum(m.lo, 0, 1), hi: nNum(m.hi, 0, 1, 1), sc: m.sc == null ? null : nNum(m.sc, 0, 1) }),
  coopH: m => ({ t: 'coopH', to: nStr(m.to, 64), h: !!m.h }),
  coopV: m => ({ t: 'coopV', to: nStr(m.to, 64), v: nNum(m.v, 0, 1), lo: nNum(m.lo, 0, 1, -1), hi: nNum(m.hi, 0, 1, -1) }),
};
const netClean = m => RELAY[m.t] ? RELAY[m.t](m) : null;
function prepName() {
  const n = ($('#mpName').value || S.name || '').trim().slice(0, 12) || ('玩家' + Math.floor(100 + Math.random() * 900));
  S.name = n; NET.name = n; NET.color = avatarOf(S.avatar).d; save();
  if (window.SlimeCloud && SlimeCloud.user && SlimeCloud.user.name !== n) SlimeCloud.rename(n).catch(() => { }); // 多人遊戲改的名字也同步成帳號暱稱
  return n;
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
    if (W.giant) { dropSlime(W.giant); W.slimes = W.slimes.filter(q => q !== W.giant); W.giant = null; } coopHide();
    if (W.mirror) { W.slimes.forEach(dropSlime); W.slimes = []; W.mirror = false; W.spawned.clear(); CAVES.forEach(c => { c.slimes = 0; }); spawnAllSlimes(); }
    else if (wasHost) {
      // 房主收掉為其他玩家生成、自己還沒解鎖區域的史萊姆
      W.slimes = W.slimes.filter(s => { if (s.cave || S.zones.includes(s.zid)) return true; dropSlime(s); return false; });
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
  return { t: 'st', name: NET.name, color: NET.color, x: +(P ? P.x : 0).toFixed(2), y: +(P ? P.y : 0).toFixed(2), z: +(P ? P.z : 0).toFixed(2), yaw: +(P ? P.yaw : 0).toFixed(2), rd: RIDE.on ? 1 : 0, zones: S.zones, live: L.on ? { on: true, hype: Math.round(L.hype), viewers: Math.round(L.viewers), sp: p ? p.sp : null } : null, held: P ? heldKey() : '', show: S.show.map(p => ({ sp: p.sp, cut: p.cut || null, cr: Math.round(effCrisp(p) * 100) })) };
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
    if (sl && c && c.open && Math.hypot(sl.x - pl.x, sl.z - pl.z) < 14) { const r = slimeHitCore(sl, id); try { c.send(Object.assign({ t: 'hitr', id: sl.id }, r)); } catch (_) { } slimeReact(sl, null, r.res); }
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
    case 'hitr': { const sl = W.slimes.find(s => s.id === m.id); if (sl && ['shy', 'hit', 'harvest', 'need2', 'giant'].includes(m.res)) applyHit(sl, { res: m.res, hits: Math.round(nNum(m.hits, 0, 3)) }, null, null, true); return; }
    case 'welcome': toast(`已加入房間 ${nStr(m.room, 8)}`); return;
    case 'giant': giantReward(nNum(m.x, -1e4, 1e4), nNum(m.z, -1e4, 1e4)); return;
    case 'full': NET.retry = 0; setMp('房間人數已滿'); toast('房間人數已滿，無法加入'); netLeave(true); return;
    case 'bye': NET.retry = 0; toast('房主已關閉房間，已切換為單人模式'); netLeave(true); return;
    case 'join': case 'leave': onNet({ t: m.t, name: nStr(m.name, 12) || '玩家', from: nStr(m.from, 64) }); return;
  }
  const c = netClean(m); if (!c) return; c.from = nStr(m.from, 64); c.name = nStr(m.name, 12) || '玩家'; onNet(c);
}
/* 房間裡有兩人以上時，房主在森林生成一隻巨型史萊姆 */
const GIANT_SL = [0, 30];
function giantStep() {
  if (NET.on && NET.host && NET.players.size >= 2 && !W.giant && W.ready) {
    const sp = unlockedSpecies().slice().sort((a, b) => b.rar - a.rar)[0], m = slimeMesh(sp), [x, z] = GIANT_SL;
    const sl = newSlime(sp, m, { id: ++W.sid, sc: 2.1, zid: 'forest', hx: x, hz: z, x, z, giant: true, pers: 'calm' }); m.scale.setScalar(sl.sc); m.userData.body.userData.sl = sl; W.scene.add(m); W.slimes.push(sl); W.giant = sl;
    toast('森林裡出現了巨型史萊姆！要兩個人一起捏才捏得動（出生點北方）');
  }
  if (W.giant && (!NET.on || (NET.host && NET.players.size < 2))) { dropSlime(W.giant); W.slimes = W.slimes.filter(s => s !== W.giant); W.giant = null; }
  // 巨型史萊姆頭上的標籤（客戶端看到的是鏡像）
  const g = W.slimes.find(s => s.giant);
  if (g && !W.giantLabel) { W.giantLabel = textSprite('巨型史萊姆', '#fbbf24', '兩個人在 1.5 秒內一起捏'); W.giantLabel.userData.keep = true; W.scene.add(W.giantLabel); }
  if (W.giantLabel) { W.giantLabel.visible = !!g; if (g) W.giantLabel.position.set(g.x, H(g.x, g.z) + 4.4, g.z); }
}
function giantWin(sl) { const m = { t: 'giant', x: sl.x, z: sl.z }; bcast(m); giantReward(sl.x, sl.z); }
function giantReward(x, z) {
  if (!P || Math.hypot(P.x - x, P.z - z) > 14) return;
  const us = unlockedSpecies(), rare = us.slice().sort((a, b) => b.rar - a.rar)[0]; S.gel[rare.id] = (S.gel[rare.id] || 0) + 3; for (let i = 0; i < 3; i++) { const sp = pick(us); S.gel[sp.id] = (S.gel[sp.id] || 0) + 1; }
  discover(rare.id); gainXP(20); sfx.level(); toast(`合力捏開巨型史萊姆！獲得 6 份凝膠（含 3 份${rare.name}）`); renderHotbar(true); save();
}
/* 把手上的凝膠送給朋友（對準朋友按 E） */
function giftGel(id) {
  const h = held(), pl = NET.players.get(id); if (!pl) return;
  if (!h || h.t !== 'gel') return toast('手上拿著凝膠，才能送給' + pl.name);
  S.gel[h.sp]--; netEmit({ t: 'gift', to: id, sp: h.sp, n: 1 }); sfx.pop(); toast(`送給 ${pl.name} 1 份${SP[h.sp].name}凝膠`); renderHotbar(true); save();
}
/* ---------- 雙人產線：朋友站在旁邊時，裹糖這一步交給朋友 ---------- */
const COOP = { on: false, from: '', name: '', lo: 0, hi: 1, v: 0, h: false, last: 0 };
function nearFriend(r) { let best = null, bd = r; NET.players.forEach((p, id) => { if (id === NET.me || p.x == null) return; const d = Math.hypot(p.x - P.x, p.z - P.z); if (d < bd) { bd = d; best = { id, name: p.name }; } }); return best; }
function coopShow(m) {
  Object.assign(COOP, { on: true, from: m.from, name: m.name, lo: m.lo, hi: m.hi, v: 0, h: false, last: Date.now() });
  $('#coopZ').style.left = m.lo * 100 + '%'; $('#coopZ').style.width = (m.hi - m.lo) * 100 + '%'; $('#coopWho').textContent = m.name; $('#coop').hidden = false;
  sfx.open(); toast(`${m.name} 請你幫忙裹糖！按住${TOUCH ? '按鈕' : '空白鍵'}讓指針停在綠色區間`);
}
function coopHide(m) {
  if (!COOP.on) return; COOP.on = false; COOP.h = false; $('#coop').hidden = true;
  if (m && m.sc != null) { gainXP(6); S.fans += 1; toast(`幫 ${COOP.name} 裹糖完成（${Math.round(m.sc * 100)}%），經驗 +6`); }
}
function coopHold(h) { if (!COOP.on || COOP.h === h) return; COOP.h = h; $('#coopBtn').classList.toggle('on', h); netEmit({ t: 'coopH', to: COOP.from, h }); }
addEventListener('keydown', e => { if (COOP.on && e.code === 'Space' && !CHAT.open) { e.preventDefault(); e.stopImmediatePropagation(); if (!e.repeat) coopHold(true); } }, true);
addEventListener('keyup', e => { if (COOP.on && e.code === 'Space') { e.stopImmediatePropagation(); coopHold(false); } }, true);
(() => { const b = document.getElementById('coopBtn'); if (!b) return; b.addEventListener('pointerdown', e => { e.preventDefault(); coopHold(true); }); ['pointerup', 'pointercancel', 'pointerleave'].forEach(ev => b.addEventListener(ev, () => coopHold(false))); })();
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
    case 'gift': if (m.to === NET.me && m.sp) { S.gel[m.sp] = (S.gel[m.sp] || 0) + m.n; discover(m.sp); sfx.pop(); toast(`${m.name} 送你 ${m.n} 份${SP[m.sp].name}凝膠！`); renderHotbar(true); save(); } break;
    case 'coop': if (m.to === NET.me) m.on ? coopShow(m) : coopHide(m); break;
    case 'coopH': if (m.to === NET.me && M.coop && M.coop.id === m.from) M.hold = m.h; break;
    case 'coopV': if (m.to === NET.me && COOP.on && COOP.from === m.from) { COOP.v = m.v; COOP.last = Date.now(); const n = $('#coopN'); if (n) n.style.left = m.v * 100 + '%'; if (m.lo >= 0 && m.hi > m.lo) { const z = $('#coopZ'); if (z) { z.style.left = m.lo * 100 + '%'; z.style.width = (m.hi - m.lo) * 100 + '%'; } } } break;
    case 'like': if (m.to === NET.me) { S.fans += 2; sfx.pop(); toast(`${m.name} 參觀了你的展示場並按讚！粉絲 +2`); } break;
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
    const ps = {}; NET.players.forEach((p, id) => { ps[id] = { name: p.name, color: p.color, x: p.x, y: p.y, z: p.z, yaw: p.yaw, rd: p.rd, live: p.live, held: p.held, show: p.show }; });
    bcast({ t: 'ps', p: ps }, null, true);
    // 每位玩家只收到自己附近的史萊姆（原本整張地圖上百隻、每秒廣播 10 次）
    NET.conns.forEach((c, id) => {
      const pl = NET.players.get(id); if (!c.open || !pl || backlog(c)) return; const a = [];
      for (const s of W.slimes) if (!s.tut && !s.cave && Math.abs(s.x - pl.x) < SL_RANGE && Math.abs(s.z - pl.z) < SL_RANGE) a.push([s.id, SPECIES.indexOf(s.sp), Math.round(s.x * 50) / 50, Math.round(s.z * 50) / 50, Math.round(s.cool * 10) / 10, s.hits, s.sq > .5 ? 1 : 0, Math.round(s.sc * 100), s.happy > 0 ? 1 : 0, s.giant ? 1 : 0]);
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
  if (!W.mirror) { W.slimes.forEach(s => { if (!s.cave) dropSlime(s); }); W.slimes = W.slimes.filter(s => s.cave); W.mirror = true; }
  const byId = new Map(W.slimes.map(s => [s.id, s])), now = performance.now();
  for (const e of a.slice(0, 600)) {
    if (!Array.isArray(e)) continue; const [id, si, x, z, cool, hits, sq, sc, happy, gi] = e;
    if (!Number.isFinite(id) || !Number.isFinite(x) || !Number.isFinite(z)) continue;
    let s = byId.get(id);
    if (!s) { const sp = (Number.isInteger(si) && SPECIES[si]) || SPECIES[0], m = slimeMesh(sp); s = newSlime(sp, m, { id, mirror: true, giant: !!gi, x, z, tx: x, tz: z, hx: x, hz: z, sc: nNum(sc, 40, gi ? 260 : 120, 76) / 100 }); m.scale.setScalar(s.sc); m.userData.body.userData.sl = s; W.scene.add(m); W.slimes.push(s); byId.set(id, s); }
    s.seenT = now; s.tx = x; s.tz = z; s.cool = nNum(cool, 0, 60); s.hits = Math.round(nNum(hits, 0, 3));
    if (sq && s.sq < .3) { s.sq = 1; slimeReact(s, null, 'hit'); }
    if (happy && !(s.happy > 0)) { s.happy = .6; s.hap = 1.4; slimeReact(s, null, 'harvest'); }
  }
  // 走出範圍的史萊姆先保留幾秒（來回走動不必一直重建），太久沒更新才釋放記憶體
  W.slimes = W.slimes.filter(s => { if (s.cave || now - (s.seenT || 0) < 4000) return true; dropSlime(s); return false; });
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
      g.position.set(p.x, p.y, p.z); W.scene.add(g); const hb = hitBox(1, 2, 1, 0, 1, 0, g); hb.userData.av = id; a = { g, lt, hb, x: p.x, y: p.y, z: p.z, yaw: p.yaw, wasLive: false, bob: 0 }; AV.set(id, a);
    }
    if (a.heldKey !== (p.held || '')) {
      a.heldKey = p.held || ''; if (a.hm) { dropObj(a.hm); a.hm = null; }
      if (a.heldKey) { const sp = SPECIES[+a.heldKey.slice(1)] || SPECIES[0], mat = new THREE.MeshPhysicalMaterial({ color: sp.color, roughness: .12, clearcoat: 1, transparent: true, opacity: .9 });
        a.hm = mesh(a.heldKey[0] === 'p' ? new THREE.BoxGeometry(.2, .2, .2) : new THREE.SphereGeometry(.11, 14, 10), mat, .42, .95, -.3, a.g); }
    }
    if (Math.hypot(p.x - a.x, p.z - a.z) > 30) { a.x = p.x; a.y = p.y; a.z = p.z; } // 朋友搭計程車換到另一頭：直接定位，不會「滑過 4 公里」
    a.g.visible = !p.rd; // 正在搭車：頭像在車門邊消失、到站下車時才出現（這一輪不畫別人的計程車）
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
  ui('live');
  if (L.watch && !others.some(([id]) => id === L.watch.id)) { stopWatch(true); toast('主播已結束直播'); renderLive(); }
}

/* ============================================================
   基地、計程車、大城市、商店、手作台、古地圖拼圖、觸控
   ============================================================ */
const BASE = { line: [0, -9], decor: [-11, 1], live: [11, 1], pc: [4.5, 7], bench: [-4.5, 7], taxi: [-19.6, 19], shelf: [8.8, 7.4], rack: [-8.8, 7.4], farm: [-14.4, -4.6] };
const OWN = {
  slicer: { name: '切片機', cost: 200, shop: 'mach', desc: '加工產線的第一台機器：看著輸送帶上的史萊姆下刀切片，可選厚塊、薄片、星形、愛心切法。' },
  coater: { name: '糖晶滾筒機', cost: 450, shop: 'mach', desc: '幫捏捏裹上糖晶，提高酥脆度（按住控速）。' },
  dryer: { name: '乾燥烘箱', cost: 800, shop: 'mach', desc: '烘乾定型，品質再升一級（拖曳控溫）。' },
  decor: { name: '裝飾桌', cost: 350, shop: 'gear', desc: '在捏捏上擺放裝飾零件，提高售價與人氣。' },
  live: { name: '直播設備組', cost: 600, shop: 'gear', desc: '補光環燈、攝影機與舞台。可以開直播販售捏捏。' },
  coat: { name: '保暖衣', cost: 900, shop: 'arms', desc: '厚實的防寒外套。**有了它就能前往雪原**（不需要解謎），沒有保暖衣會被刺骨的寒氣擋住。雪原每次只能待 10 分鐘，凍僵了要來城市的醫院看醫生（診療費 ¥20）。' },
  sword: { name: '長劍', cost: 1200, shop: 'arms', desc: '一把保養良好的長劍。目前只供收藏，之後會派上用場。' },
};
const ARMS_LV = 5, armsOpen = () => xpLevel(S.xp) >= ARMS_LV;
const SHOP_UPS = { mach: ['slicer', 'coater', 'dryer'], gear: ['gear'], mall: ['cap', 'shelf', 'boots', 'net', 'farm'], arms: [] };
function ownAny() { return !!(S.own.slicer || S.own.coater || S.own.dryer); }
/* ---------- 大城市的四間店：走進店頭、拿起來看、拿到櫃台結帳（商品、店員、台詞、規則；建造在 buildShopRoom，演出在 wareStep） ----------
   店頭：商店大樓一樓往內挖 SHOP_D 公尺、高 SHOP_H，跟城市同一個場景（不是新空間，鏡頭不被接管）。
   本地座標：原點＝店面中心、z＝0 是騎樓線（城市 z＝−14）、往店內是 −z。西牆三件大東西、後牆層架放小東西、東邊是櫃台與店員 */
const SHOP_D = 4.6, SHOP_H = 3.6;
const SHOPS = {
  mach: { x: -18, w: 12, kp: 'ade', name: '機械行', col: '#3f4650', floor: '#9aa1a9', wall: '#8fa3b5', ctr: '#4b5563', top: '#a0703f', reg: '#dc2626', big: ['own:slicer', 'own:coater', 'own:dryer'], shelf: ['up:slicer', 'up:coater', 'up:dryer'], desk: [] },
  mall: { x: 0, w: 13, kp: 'su', name: '生活百貨', col: '#f1f5f9', floor: '#eef2f0', wall: '#f8fafc', ctr: '#f8fafc', top: '#ffffff', band: '#10b981', reg: '#334155', big: ['up:cap', 'up:farm', 'up:shelf'], shelf: ['up:boots'], desk: ['up:net'] },
  gear: { x: 18, w: 12, kp: 'guang', name: '器材行', col: '#221d3d', floor: '#241d3f', wall: '#2e1065', ctr: '#111018', top: '#1f1b2e', neon: '#f472b6', reg: '#6d28d9', big: ['own:live', 'own:decor', 'up:gear'], shelf: ['pack:metal', 'pack:glass', 'pack:neon', 'pack:prism'], desk: [] },
  arms: { x: 35, w: 11, kp: 'iron', name: '武器店', col: '#f2e3c6', floor: '#7a5a3a', wall: '#a8a29e', ctr: '#5b3a22', top: '#6b4529', reg: '#57534e', big: ['own:coat'], shelf: ['own:sword'], desk: [] },
};
// 18 字以內的短說明（吊牌卡第二段）
const WARE_DESC = { 'own:slicer': '產線第一台：看準時機下刀切片', 'own:coater': '裹上糖晶，酥脆度再往上', 'own:dryer': '烘乾定型，品質再升一級', 'own:decor': '在捏捏上擺零件，更受歡迎', 'own:live': '環燈＋攝影機＋舞台，開直播', 'own:coat': '穿上就能進雪原（每次 10 分鐘）', 'own:sword': '保養良好的長劍，先收藏著',
  'up:slicer': '刀片組：切片判定更寬', 'up:coater': '新滾筒：綠色區間更寬', 'up:dryer': '溫控線圈：目標區間更寬', 'up:cap': '多一層倉儲架，庫存 +6', 'up:shelf': '網站貨架 +2 格', 'up:farm': '每 30 分鐘自動收凝膠', 'up:boots': '移動速度 +10%', 'up:net': '每次採集多 1 份凝膠', 'up:gear': '舞台燈：直播觀眾 +15%' };
const wareDesc = id => WARE_DESC[id] || (id.startsWith('pack:') ? Object.values(DECO).filter(d => d.pack === id.slice(5)).map(d => d.n).join('・') : '');
// 買到的東西怎麼帶走：機器、裝飾桌、直播設備綁氣球送回工坊（ship）；保暖衣、跑鞋、吸取器當場穿上（wear）；其他包好帶走（bag）
const wareGo = (t, k) => t === 'own' && SHIP_KEYS.includes(k) ? 'ship' : (t === 'own' && k === 'coat') || (t === 'up' && (k === 'boots' || k === 'net')) ? 'wear' : 'bag';
// 四位店員（格式同 NPC_DEF；still＝不走路，腿併進身體少 2 次繪製）
const SHOPKEEP = [
  { id: 'ade', shop: 'mach', still: 1, name: '阿德師', role: '機械行老闆', hair: 'cap', hc: '#3f3f46', cap: '#1e3a5f', skin: '#d9a37c', top: '#3b5b7a', bot: '#374151', acc: 'apron', apron: '#78716c' },
  { id: 'su', shop: 'mall', still: 1, name: '蘇姊', role: '生活百貨店長', hair: 'bun', hc: '#1c1917', skin: '#f1c6a4', top: '#10b981', bot: '#e2e8f0', acc: 'apron', apron: '#ffffff' },
  { id: 'guang', shop: 'gear', still: 1, name: '阿光', role: '器材行老闆', hair: 'short', hc: '#4c1d95', skin: '#e8b48e', top: '#111827', bot: '#1f2937', acc: 'glasses' },
  { id: 'iron', shop: 'arms', still: 1, name: '鐵伯', role: '武器店老闆', hair: 'bald', hc: '#d4d4d8', skin: '#c98b62', top: '#7c2d12', bot: '#3f3f46', acc: 'apron', apron: '#57534e' },
];
// 店員台詞（每句 ≤ 28 字）：pick 拿起時介紹、pay 依去向、poor／poor2 錢不夠、has／max／need 買不了的原因
const KP_LINES = {
  mach: { first: ['少年仔，東西都可以拿起來看，看好拿來櫃台！'], hi: ['來喔，機器都是新的！', '今天要切還是要烘？', '地上有油，走路小心喔。'], pick: { 'own:slicer': '入門就這台，厚塊、薄片、星星、愛心都切得出來。', 'own:coater': '裹一層糖晶，咬下去喀滋更響。', 'own:dryer': '烘乾定型，三台到齊才拚得到滿分。', 'up:slicer': '換這組刀片，判定寬一點，比較不會切歪。', 'up:coater': '滾筒換新軸，綠色區間更寬。', 'up:dryer': '溫控板升級，目標溫度比較好跟。' },
    pay: { ship: '多謝！機器綁氣球送過去，回到工坊就到。', bag: '套件幫你包好，回去就裝上囉！' }, poor: ['還差 ¥{d}，沒關係，我幫你留著。'], poor2: ['賺夠了在工坊的電腦下單也行，一樣送到。'], has: ['你那台還好用嗎？有怪聲再拿來給我看。'], max: ['這已經是最好的了，我這邊沒有更好的啦！'], need: ['這要裝在{n}上，先帶一台回去吧。'], far: ['這邊結帳喔～'], back: ['先幫你放回去囉～'], wish: ['存夠了嗎？'], bye: ['慢走喔！', '路上小心～'] },
  mall: { first: ['歡迎光臨～東西都可以拿起來看，結帳找我喔。'], hi: ['慢慢逛喔。', '今天有新貨到。'], pick: { 'up:cap': '多一層貨架，庫存可以多放六個。', 'up:shelf': '網站多兩格貨架，賣得更快。', 'up:farm': '放著也會長凝膠，你不在也照長。', 'up:boots': '輕量跑鞋，穿上走走看！', 'up:net': '戴在手腕上，每次採集多一份。' },
    pay: { bag: '謝謝惠顧！回到工坊就裝好囉。', wear: '穿起來剛剛好！' }, poor: ['還差 ¥{d}，下次再來沒關係～'], poor2: ['賺夠了在工坊的電腦下單也行喔。'], has: ['你已經有了喔。'], max: ['這已經是最高級的了！'], need: ['要先有{n}才用得到喔。'], far: ['結帳在這邊～'], back: ['我先放回去囉～'], wish: ['存夠了嗎？'], bye: ['謝謝光臨～', '下次見！'] },
  gear: { first: ['哈囉！東西都能拿起來看，結帳在我這～'], hi: ['要開台了嗎？', '今天的光線很適合直播耶。'], pick: { 'own:live': '燈一打、鏡頭一開，觀眾就來了！', 'own:decor': '零件擺上去，你的捏捏會更有個性。', 'up:gear': '多一支燈，基礎觀眾多一成半。', 'pack:metal': '金屬零件，鏡頭下會反光喔。', 'pack:glass': '水晶零件，透透亮亮的。', 'pack:neon': '霓虹零件，晚上直播超吸睛。', 'pack:prism': '稜鏡零件，限量款，超閃！' },
    pay: { ship: '感謝支持！設備綁氣球飛去你的工坊。', bag: '零件包給你，回去拼拼看！' }, poor: ['差 ¥{d}，多開幾場直播就有了！'], poor2: ['電腦網購也買得到，一樣送到喔。'], has: ['你已經有一組了，用得還順嗎？'], max: ['燈已經滿了，再多會太亮啦！'], need: ['要先有{n}，燈才有地方裝喔。'], far: ['這邊結帳喔！'], back: ['我幫你放回去～'], wish: ['存夠了嗎？'], bye: ['掰掰，開台記得叫我！', '下次見～'] },
  arms: { first: ['……東西拿起來看，看好了再拿過來。'], hi: ['嗯，來啦。', '雪原冷，衣服穿暖。'], pick: { 'own:coat': '穿這件，冰洞的寒氣就擋不住你。', 'own:sword': '打了三個月。先掛著欣賞也好。' },
    pay: { wear: '穿上試試……嗯，合身。雪原一次待十分鐘就好。', bag: '好好保養它。' }, poor: ['還差 ¥{d}。不急，我留著。'], poor2: ['還差 ¥{d}。慢慢來。'], has: ['你已經有了。'], max: ['你已經有了。'], need: ['你已經有了。'], far: ['在這裡結帳。'], back: ['放回去了。'], wish: ['錢夠了？'], bye: ['路上小心。'], open: ['開張囉！進來看看。'] },
};
// 一件商品現在的狀態：can＝現在就能買；why＝has（已擁有）｜max（滿級）｜need（缺前置）｜poor（錢不夠，d＝還差多少）
function wareState(t, k) {
  const id = t + ':' + k, o = t === 'own' ? OWN[k] : t === 'up' ? UPS[k] : PACKS[k]; if (!o) return null;
  const st = { id, t, k, name: o.name, go: wareGo(t, k), lv: 0, max: 0, why: '', d: 0, need: '', cost: o.cost };
  if (t === 'own') { if (S.own[k]) st.why = 'has'; }
  else if (t === 'up') { st.lv = S.up[k] || 0; st.max = o.max; st.cost = upCost(k); if (st.lv >= o.max) st.why = 'max'; else if (o.need && !S.own[o.need]) { st.why = 'need'; st.need = OWN[o.need].name; } }
  else if (S.packs.includes(k)) st.why = 'has';
  if (!st.why && S.money < st.cost) { st.why = 'poor'; st.d = Math.ceil(st.cost - S.money); }
  st.can = !st.why; return st;
}
// 付錢：城市櫃台與工作電腦的網購共用同一份規則。付錢那一刻就算擁有（工坊裡的外觀等氣球木箱開箱才出現，S.ship 只是「還沒演的到貨」）
function purchase(t, k, via) {
  const st = wareState(t, k); if (!st || !st.can) return null;
  S.money -= st.cost; delete S.wish[st.id];
  if (t === 'own') { S.own[k] = true; if (SHIP_KEYS.includes(k) && !S.ship.some(e => e.k === k)) S.ship.push({ k, via, at: Date.now() }); refreshBase(); refreshCold(); if (k === 'coat') W.pendZone = 'snow'; }
  else if (t === 'up') S.up[k]++; else S.packs.push(k);
  objSig = ''; renderTop(); tagDirty(); if (GUI.kind === 'pc' && PANEL[tab]) renderShop(tab); saveCloud(); return st.go;
}
function slotMark(parent, [x, z], t, sub, r) {
  const m = new THREE.Group(); m.position.set(x, G(x, z) + .04, z); parent.add(m);
  // 蓋著帆布的木棧板：機器還沒送來的位置（第 3 堂 6.2）
  const pw = Math.min(r * 1.1, 3.4), pd = Math.min(r * .8, 2.2), wood = woodMat('#9a7652'), tarp = std('#7a8a6a', { roughness: .95, flatShading: true });
  for (let i = 0; i < 5; i++) box(pw, .06, pd / 6, wood, 0, .18, -pd / 2 + pd / 12 + i * pd / 5, m); [-pw / 2 + .1, 0, pw / 2 - .1].forEach(px => box(.14, .14, pd, wood, px, .07, 0, m));
  const tp = mesh(jit(new THREE.BoxGeometry(pw * .86, .9, pd * .86, 4, 2, 3), .07, r * 7), tarp, 0, .66, 0, m); tp.scale.y = .9; tp.castShadow = !LOW;
  [-1, 1].forEach(sx => box(.03, .9, .03, std('#c2a36b'), sx * pw * .43, .6, pd * .44, m));
  const ring = mesh(new THREE.RingGeometry(r - .1, r, 56), new THREE.MeshBasicMaterial({ color: '#cbd5e1', transparent: true, opacity: .55, side: THREE.DoubleSide, depthWrite: false }), 0, 0, 0, m); ring.rotation.x = -Math.PI / 2;
  const s = textSprite(t.replace('空地', '（機器還沒送來）'), '#cbd5e1', sub); s.position.y = 2.4; m.add(s); return m;
}
const DELIV = [];
/* 到貨的木箱：從空中落下、四面倒下、東西升起。o.h＝落下高度（預設 7）、o.fall＝落下秒數（預設 .55）、o.bal＝綁著氣球（宅配，搖搖晃晃降落）、
   o.done＝東西升起那一刻呼叫一次。落地之後的時間軸跟原本一樣，只是整段往後平移 fall − .55 */
function deliverFx(group, wx, wz, name, o = {}) {
  const y = G(wx, wz), baseY = group.position.y;
  if (RM()) { group.visible = true; fx3(new THREE.Vector3(wx, y + 3.2, wz), name + ' 到貨！', '#34d399', 'big'); if (o.done) o.done(); return; } // 減少動態：不落下，東西直接在定位出現
  const crate = new THREE.Group(); crate.position.set(wx, y, wz); W.scene.add(crate);
  const cw = woodMat('#b08a5e'), parts = [[0, .9, -.9, 0], [0, .9, .9, 0], [-.9, .9, 0, 1], [.9, .9, 0, 1]].map(([x, yy, z, rot]) => box(rot ? .08 : 1.9, 1.8, rot ? 1.9 : .08, cw, x, yy, z, crate));
  const lid = box(1.9, .08, 1.9, cw, 0, 1.84, 0, crate); group.visible = false;
  const bal = o.bal ? balloons(LOW ? 2 : 3, .9) : null; if (bal) { bal.position.set(0, 1.88, 0); crate.add(bal); }
  DELIV.push({ t: 0, crate, parts, lid, group, baseY, name, wx, wz, y, h: o.h || 7, fall: o.fall || .55, bal, done: o.done });
}
function deliverStep(dt) {
  for (let i = DELIV.length - 1; i >= 0; i--) {
    const d = DELIV[i]; d.t += dt; const F = d.fall, t = d.t - (F - .55); // t：跟原本一樣的時間軸（.55 落地）
    if (d.bal) { const u = clamp(d.t / F, 0, 1); d.crate.position.y = d.y + d.h * (1 - out3(u)); d.crate.position.x = d.wx + .25 * Math.sin(3 * Math.PI * u) * (1 - u); d.crate.rotation.z = .06 * Math.sin(3 * Math.PI * u + .6) * (1 - u); balloonStep(d.bal, d.t, d.landed ? d.t - F : -1); } // 綁著氣球：搖搖晃晃慢慢降落
    else d.crate.position.y = d.y + Math.max(0, d.h * (1 - t / .55)) ** 1.6 * (t < .55 ? 1 : 0); // 從空中落下
    if (t > .55 && !d.landed) { d.landed = true; d.crate.position.x = d.wx; d.crate.rotation.z = 0; sfx.land && sfx.land(.9, 'dirt'); if (W.goo) W.goo.emit(new THREE.Vector3(d.wx, d.y + .2, d.wz), 10, '#c9b48a', { gy: d.y + .02, up: 1.6, speed: 1.6, size: .06 }); if (d.bal) shopSnd.flyAway(); }
    if (t > 1.3) { const k = Math.min(1, (t - 1.3) / .5); d.parts.forEach((p, j) => { const out = [[0, 0, -1], [0, 0, 1], [-1, 0, 0], [1, 0, 0]][j]; p.rotation.set(out[2] * k * 1.5, 0, -out[0] * k * 1.5); p.position.y = .9 - k * .8; }); d.lid.position.y = 1.84 + k * 2; d.lid.rotation.z = k * 1.2; }
    if (t > 1.8) { d.group.visible = true; const k = Math.min(1, (t - 1.8) / .7), e = 1 - (1 - k) ** 3; d.group.position.y = d.baseY + (1 - e) * 1.6 + Math.sin(k * Math.PI) * .15; }
    if (t > 1.8 && !d.lit) { d.lit = true; sfx.pop && sfx.pop(); fx3(new THREE.Vector3(d.wx, d.y + 3.2, d.wz), d.name + ' 到貨！', '#34d399', 'big'); if (d.done) d.done(); }
    if (t > 2.4) d.crate.scale.setScalar(Math.max(.001, 1 - (t - 2.4) / .5));
    if (t > 3) { d.group.position.y = d.baseY; dropObj(d.crate); DELIV.splice(i, 1); }
  }
}
/* 氣球：薄荷、蜜桃、檸檬三色的小史萊姆（壓扁的球＋兩點眼睛＋細繩），一個 InstancedMesh（一次繪製）；原點＝繩子綁住的地方。
   s＝整體大小（木箱 .9、城市裡的小紙盒 .45） */
let BAL_G = null;
function balloons(n, s = 1) {
  if (!BAL_G) {
    const P0 = [[new THREE.SphereGeometry(.36, 14, 10), '#ffffff', M4(0, 1.5, 0, 0, 0, 0, 1, .86, 1)], [new THREE.CylinderGeometry(.006, .006, 1.15, 3), '#e5e7eb', M4(0, .58, 0)], [new THREE.ConeGeometry(.05, .07, 6), '#ffffff', M4(0, 1.18, 0, Math.PI)]];
    [-1, 1].forEach(x => P0.push([new THREE.SphereGeometry(.045, 6, 4), '#1f2937', M4(x * .12, 1.56, .31)])); P0.push([new THREE.TorusGeometry(.05, .012, 4, 8, Math.PI), '#1f2937', M4(0, 1.47, .33, 0, 0, Math.PI)]);
    BAL_G = { geo: mergeParts(P0), mat: new THREE.MeshStandardMaterial({ vertexColors: true, roughness: .35, metalness: 0 }), col: ['#86efac', '#fda4af', '#fde047'].map(c => new THREE.Color(c)) };
  }
  const im = new THREE.InstancedMesh(BAL_G.geo, BAL_G.mat, n); im.userData.shared = true; im.frustumCulled = false; im.castShadow = false; im.userData.n = n; im.userData.s = s;
  for (let i = 0; i < n; i++) im.setColorAt(i, BAL_G.col[i % 3]); balloonStep(im, 0, -1, 1); return im;
}
// k＝充氣進度（0→1，城市裡一顆一顆綁上去）；rel＝鬆開後經過的秒數（−1＝還綁著）：往上飄 3 m/s、1.5 秒內淡掉
function balloonStep(im, t, rel = -1, k = 1) {
  const n = im.userData.n, s = im.userData.s, m = tmpM4 || (tmpM4 = new THREE.Matrix4()), q = new THREE.Quaternion(), e = new THREE.Euler(), v = new THREE.Vector3(), sc = new THREE.Vector3();
  for (let i = 0; i < n; i++) {
    const a = (i - (n - 1) / 2) * .42 + Math.sin(t * 1.7 + i * 2.1) * .06, kk = clamp(k * n - i, 0, 1), up = rel >= 0 ? rel * 3 : 0, f = rel >= 0 ? Math.max(0, 1 - rel / 1.5) : 1;
    e.set(Math.sin(t * 1.3 + i) * .05, 0, a); q.setFromEuler(e); v.set(Math.sin(a) * -.1 * s, up, 0); sc.setScalar(Math.max(.001, s * kk * f)); m.compose(v, q, sc); im.setMatrixAt(i, m);
  }
  im.instanceMatrix.needsUpdate = true;
}
let tmpM4 = null;
// 宅配的落點：產線上那台機器的位置、裝飾桌、直播台
function shipSpot(k) {
  const i = MKEY.indexOf(k); if (i >= 0) { const p = W.lineG.localToWorld(new THREE.Vector3(MX[i], 0, 0)); return [p.x, p.z, W.lineParts.m[i]]; }
  return k === 'decor' ? [BASE.decor[0], BASE.decor[1], W.decorG] : [BASE.live[0], BASE.live[1], W.liveG];
}
const SHIPV = { delay: 1.2, gap: .9, fall: 2.4, h: 16 };
const SHIPS = { t: 0, go: new Set() }; // go：這次遊玩已經在演的到貨（記憶體旗標，不會重放）
/* 月光谷這一半：回到中央平地附近、沒開介面（產線例外，看得到）時，1.2 秒後木箱綁著氣球從落點正上方 16 m 搖搖晃晃降落，之後每箱隔 .9 秒。
   開箱（東西升起）那一刻才從 S.ship 移掉；重新整理或關掉遊戲時還沒演的照樣留著，下次走回來再降落 */
function shipStep(dt) {
  // 保暖衣的雪原解鎖：手上沒拿商品、而且不在任何店頭裡（或已經離開城市）才補上——結帳後馬上搭車離開也不會漏
  if (W.pendZone && !WARE.h && (!inCity() || !SHOP_IDS.some(id => inShop(id, 1.6)) || performance.now() - (W.pendT || 0) > 4000) && W.ready && !TITLE.on) { const z = W.pendZone; W.pendZone = null; discoverZone(z, { quiet: true }); }
  if (!S.ship.length || inCity() || INTRO.on || TITLE.on || !W.ready || CV.c || RIDE.on || (GUI.kind && GUI.kind !== 'line') || Math.hypot(P.x, P.z) > 60) { SHIPS.t = 0; SHIPS.n = 0; return; }
  const e = S.ship.find(x => !SHIPS.go.has(x.k)); if (!e) return;
  SHIPS.t += dt; if (SHIPS.t < (SHIPS.n ? SHIPV.gap : SHIPV.delay)) return; SHIPS.t = 0; SHIPS.n = 1; // 第一箱等 1.2 秒，之後每箱隔 .9 秒
  SHIPS.go.add(e.k); const [x, z, g] = shipSpot(e.k); if (W.slotInter.line && MKEY.includes(e.k)) W.slotInter.line.off = true; // 箱子降落到開箱這段時間產線先不能點（打開時才不會少一台機器）
  deliverFx(g, x, z, OWN[e.k].name, { h: SHIPV.h, fall: SHIPV.fall, bal: true, done: () => { S.ship = S.ship.filter(q => q.k !== e.k); SHIPS.go.delete(e.k); refreshBase(); shipPush(); save(); } });
}
// 開箱那一刻玩家站在新的碰撞範圍裡：往最近的邊推出去
function shipPush() {
  for (const c of colsNear(P.x, P.z)) {
    if (c.box) { const [x0, z0, x1, z1] = c.box; if (P.x > x0 && P.x < x1 && P.z > z0 && P.z < z1) { const d = [P.x - x0, x1 - P.x, P.z - z0, z1 - P.z], m = Math.min(...d), j = d.indexOf(m); if (j === 0) P.x = x0 - .5; else if (j === 1) P.x = x1 + .5; else if (j === 2) P.z = z0 - .5; else P.z = z1 + .5; } }
    else { const dx = P.x - c.x, dz = P.z - c.z, l = Math.hypot(dx, dz); if (l < c.r + P.r && l > 1e-4) { P.x = c.x + dx / l * (c.r + P.r + .5); P.z = c.z + dz / l * (c.r + P.r + .5); } }
  }
}
function refreshBase() {
  if (!W.lineParts) return; const o = S.own, vis = k => !!o[k] && !S.ship.some(e => e.k === k), anyM = MKEY.some(vis); // 還在宅配途中的東西先不出現在工坊
  // 剛買的機器：先不顯示，交給到貨動畫（遊戲載入時不播；宅配中的交給 shipStep）
  const prev = W.prevOwn || null; W.prevOwn = Object.assign({}, o);
  W.lineParts.belt.visible = anyM; W.lineParts.m.forEach((g, i) => g.visible = vis(MKEY[i]));
  W.decorG.visible = vis('decor'); W.liveG.visible = vis('live');
  const show = { line: anyM, decor: vis('decor'), live: vis('live') };
  Object.keys(show).forEach(k => { W.slotMark[k].visible = !show[k]; W.slotInter[k].off = !show[k]; if (show[k] && !W.slotCol[k].added) { addCol(W.slotCol[k]); W.slotCol[k].added = true; } });
  if (MKEY.some(k => SHIPS.go.has(k))) W.slotInter.line.off = true;
  if (prev && W.ready) {
    const nw = k => o[k] && !prev[k] && !S.ship.some(e => e.k === k);
    MKEY.forEach((k, i) => { if (nw(k)) { const p = W.lineG.localToWorld(new THREE.Vector3(MX[i], 0, 0)); deliverFx(W.lineParts.m[i], p.x, p.z, OWN[k].name); } });
    if (nw('decor')) deliverFx(W.decorG, BASE.decor[0], BASE.decor[1], OWN.decor.name);
    if (nw('live')) deliverFx(W.liveG, BASE.live[0], BASE.live[1], OWN.live.name);
  }
}
/* ---------- 計程車：兩頭各一台（月光谷花島西側、城市醫院門口），車內與司機全遊戲一份（INNER），掛在玩家那一頭的車上、換邊時跟著搬 ----------
   本地座標：+x 車頭、+z 右側、y＝0 地面。座艙（x −1.25～.85）不是實心的：底板、腰線以下的門板、A／B／C 柱與車頂，車窗是真的開口；
   兩扇後門是以前緣鉸鏈（x＝−.1）為原點的群組，往外往後開 70°；後窗搖下來了，所以玻璃只有前擋、後擋與前門的窗（一個網格）。
   所有網格在第 0＋3 層：鏡頭鑽進隧道深處只畫第 3 層時，車子、車內、司機照樣看得到。繪製：近 11（車身、燈、燈箱、玻璃、兩扇門＋車內＋司機 4）、遠 6 */
const INNER = { g: null, fu: null, lam: null, who: null, mir: 0 };
let CAB_M = null;
const CAB_W = [[1.25, .82], [1.25, -.82], [-1.25, .82], [-1.25, -.82]]; // 四個輪子（右前、左前、右後、左後）
const cabBox = (a, w, h, d, c, x, y, z, rx = 0, ry = 0, rz = 0) => a.push([new THREE.BoxGeometry(w, h, d), c, M4(x, y, z, rx, ry, rz)]);
const cabQuad = q => { const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute([q[0], q[1], q[2], q[0], q[2], q[3]].flatMap(([x, y]) => [x, y, 0]), 3)); return g; };
function makeCab(city) {
  if (!CAB_M) { // 兩台車共用車身、燈的材質與 TAXI 燈箱的貼圖
    const c = document.createElement('canvas'); c.width = 256; c.height = 96; const x = c.getContext('2d'); x.fillStyle = '#fef08a'; x.fillRect(0, 0, 256, 96); x.fillStyle = '#111827'; x.font = 'bold 64px Inter,sans-serif'; x.textAlign = 'center'; x.fillText('TAXI', 128, 72);
    const tt = new THREE.CanvasTexture(c); tt.colorSpace = THREE.SRGBColorSpace;
    CAB_M = { body: new THREE.MeshStandardMaterial({ vertexColors: true, roughness: .38, metalness: .25 }), lamp: new THREE.MeshBasicMaterial({ vertexColors: true }), tt };
  }
  const g = new THREE.Group(), BP = [], LP = [], GP = [], Y = '#facc15', DK = '#1f2937', B = cabBox;
  // 引擎蓋、行李箱、底板、前後隔板（座艙是空的）
  B(BP, 1.1, .62, 1.7, Y, 1.4, .72, 0); B(BP, .7, .62, 1.7, Y, -1.6, .72, 0); B(BP, 2.1, .1, 1.7, DK, -.2, .3, 0); B(BP, .06, .68, 1.6, DK, .85, .69, 0); B(BP, .06, .68, 1.6, Y, -1.25, .69, 0);
  [-1, 1].forEach(s => {
    B(BP, .95, .68, .06, Y, .375, .69, s * .82); B(BP, .2, .68, .06, Y, -1.15, .69, s * .82); B(BP, .95, .16, .06, DK, -.575, .33, s * .82); // 前門、後輪上方、後門下面的門檻
    B(BP, .07, .74, .07, Y, .675, 1.345, s * .8, 0, 0, .507); B(BP, .09, .65, .07, Y, -.1, 1.345, s * .8); B(BP, .07, .7, .07, Y, -1.125, 1.345, s * .8, 0, 0, -.378); // A、B、C 柱
    [[1.1, 1.4], [.7, -1.6], [.95, .375], [.2, -1.15]].forEach(([w, x]) => B(BP, w, .1, .02, DK, x, .92, s * .86)); // 黑色飾條
    B(BP, .12, .1, .16, Y, .78, 1.12, s * .96); B(BP, .12, .03, .03, '#cbd5e1', .2, .95, s * .87); // 後照鏡、門把
    B(LP, .05, .14, .3, '#fef9c3', 1.96, .78, s * .55); B(LP, .05, .12, .26, '#ef4444', -1.96, .8, s * .55); // 大燈、尾燈
    GP.push([cabQuad([[-.05, 1.05], [.83, 1.05], [.52, 1.63], [-.05, 1.63]]), '#ffffff', M4(0, 0, s * .8)]); // 前門的窗（前緣順著 A 柱）
  });
  B(BP, 1.5, .06, 1.64, Y, -.25, 1.69, 0); B(BP, .02, .16, .7, DK, 1.96, .66, 0); // 車頂、水箱罩
  [1, -1].forEach(s => { B(BP, .02, .1, 1.72, DK, s * 1.96, .92, 0); B(BP, .1, .16, 1.74, '#9ca3af', s * 1.98, .44, 0); B(BP, .02, .12, .34, '#f8fafc', s * 1.99, s > 0 ? .5 : .62, 0); }); // 飾條、保險桿、車牌
  CAB_W.forEach(([x, z]) => BP.push([new THREE.CylinderGeometry(.36, .36, .26, LOW ? 12 : 18), '#111827', M4(x, .36, z, Math.PI / 2)], [new THREE.CylinderGeometry(.19, .19, .27, 10), '#d1d5db', M4(x, .36, z, Math.PI / 2)])); // 輪子（靜止，併進車身）
  B(GP, .02, .72, 1.52, '#ffffff', .675, 1.345, 0, 0, 0, .507); B(GP, .02, .68, 1.52, '#ffffff', -1.125, 1.345, 0, 0, 0, -.378); // 前擋、後擋
  const body = new THREE.Mesh(mergeParts(BP), CAB_M.body), lamp = new THREE.Mesh(mergeParts(LP), CAB_M.lamp);
  const signM = new THREE.MeshStandardMaterial({ map: CAB_M.tt, emissive: '#fef08a', emissiveMap: CAB_M.tt, emissiveIntensity: .9 }), sign = box(.75, .28, .32, signM, -.2, 1.86, 0);
  const glassM = new THREE.MeshStandardMaterial({ color: '#2a4566', roughness: .06, metalness: .5, transparent: true, opacity: .35, depthWrite: false, side: THREE.DoubleSide }), glass = new THREE.Mesh(mergeParts(GP), glassM);
  g.add(body, lamp, sign, glass); body.castShadow = !LOW; body.receiveShadow = true;
  // 後門：外黃內米色、扶手、窗框；鉸鏈在前緣，a＝0 關、1 開（70°）
  const doors = [-1, 1].map(s => {
    const D = [], dg = new THREE.Group(); dg.position.set(-.1, 0, s * .85);
    B(D, .95, .62, .05, Y, -.475, .72, -s * .025); B(D, .9, .55, .03, '#e7dcc6', -.475, .7, -s * .065); B(D, .5, .05, .07, '#cbbf9f', -.5, .78, -s * .1); B(D, .95, .1, .02, DK, -.475, .92, s * .005);
    B(D, .85, .04, .04, DK, -.48, 1.62, -s * .03); B(D, .04, .6, .04, DK, -.92, 1.33, -s * .03); B(D, .12, .03, .03, '#cbd5e1', -.25, .95, s * .02);
    const m = new THREE.Mesh(mergeParts(D), CAB_M.body); m.castShadow = !LOW; dg.add(m); g.add(dg); return { g: dg, s, a: 0, a0: 0, a1: 0, t0: 0, d: 350 };
  });
  const it = addInter(hitBox(4.2, 2.2, 2, 0, 1, 0, g), 'station', 'taxi', '計程車');
  g.traverse(o => { o.layers.mask = 9; });
  g.userData = { city, st: 'park', doors, signM, glassM, glass, it, wx: 0, wz: 0, c: 1, s: 0, lt: 0, leg: null, p: {}, at: 0, next: '', blink: -1e9, hail: false, wave: -1e9 };
  return g;
}
// 車內（米色座椅、儀表板、方向盤、紅色計費表、後照鏡、內飾）與司機福伯：MeshLambert，不受環境貼圖影響（換邊時亮度不會跳）
function buildCabInner() {
  const A = [], B = (w, h, d, c, x, y, z, rx, ry, rz) => cabBox(A, w, h, d, c, x, y, z, rx, ry, rz), SEAT = '#efe3c4', DK = '#3b3f46', TRIM = '#ddd3bb', MAT = '#2f343b';
  [-1, 1].forEach(s => {
    B(.46, .1, .46, SEAT, .3, .5, s * .36); B(.1, .56, .44, SEAT, -.01, .84, s * .36, 0, 0, .1); B(.08, s > 0 ? .12 : .16, .24, SEAT, -.04, s > 0 ? 1.18 : 1.22, s * .36, 0, 0, .1); // 前座：椅背與頭枕比真車矮一點，後座往前看得到路、也看得到福伯的頭
    B(.95, .55, .03, TRIM, .375, .7, s * .775); B(.2, .55, .03, TRIM, -1.15, .7, s * .775); // 前門與後輪上方的內飾
    B(.04, .72, .05, TRIM, .66, 1.345, s * .76, 0, 0, .507); B(.1, .63, .04, TRIM, -.1, 1.345, s * .765); B(.04, .68, .05, TRIM, -1.11, 1.345, s * .76, 0, 0, -.378); // 柱子的內襯
    B(.55, .02, .5, MAT, .38, .36, s * .36); // 腳踏墊
  });
  B(.5, .15, 1.5, SEAT, -.65, .52, 0); B(.12, .7, 1.5, SEAT, -.95, .92, 0, 0, 0, .15); B(.45, .02, 1.3, MAT, -.22, .36, 0); // 後座長椅
  B(.5, .2, .18, DK, .35, .55, 0); B(.3, .3, 1.6, DK, .78, .88, 0); B(.34, .04, 1.62, '#2b2f36', .76, 1.04, 0); // 中央扶手、儀表板
  B(.12, .05, .07, '#b91c1c', .72, 1.075, .1); B(.08, .02, .072, '#fca5a5', .72, 1.08, .1); // 紅色 LED 計費表
  B(.04, .07, .22, DK, .72, 1.52, 0); B(.02, .1, .02, DK, .74, 1.6, 0); B(1.5, .02, 1.6, '#efe8d8', -.25, 1.655, 0); B(.3, .04, 1.6, DK, -1.12, 1.03, 0); // 車內後照鏡、車頂內襯、後擋下的置物板
  B(.3, .05, .05, DK, .72, .88, -.36, 0, 0, -.45); A.push([new THREE.TorusGeometry(.17, .022, 6, LOW ? 12 : 18), '#2b2f36', new THREE.Matrix4().makeRotationY(-Math.PI / 2).premultiply(new THREE.Matrix4().makeRotationZ(-.45)).setPosition(.6, .95, -.36)]); // 方向盤（左前）
  const lam = INNER.lam = new THREE.MeshLambertMaterial({ vertexColors: true }), g = INNER.g = new THREE.Group(); g.add(new THREE.Mesh(mergeParts(A), lam));
  lam.onBeforeCompile = sh => { sh.fragmentShader = sh.fragmentShader.replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\ntotalEmissiveRadiance += diffuseColor.rgb * 0.3;'); }; lam.customProgramCacheKey = () => 'cabLift'; // 車內在車頂的影子裡、背光的椅背會黑成一片：每個面自己亮 30%（固定值，換邊那一格兩邊一樣）
  // 司機福伯：成人比例的居民模型改成坐姿（藏起雙腳、身體往下坐進椅子、雙手往前握方向盤），面向車頭；手機藏起手臂
  const fu = INNER.fu = npcMesh({ id: 'fu', name: '福伯', hair: 'cap', cap: '#1e3a5f', hc: '#9ca3af', skin: '#e8b996', top: '#bfdbfe', bot: '#334155', acc: 'glasses' });
  fu.lL.visible = fu.lR.visible = false; fu.root.remove(fu.hb); fu.body.position.y = -.33; fu.aL.rotation.x = fu.aR.rotation.x = -1.15; if (LOW) fu.aL.visible = fu.aR.visible = false;
  fu.root.position.set(.18, .02, -.36); fu.root.rotation.y = Math.PI / 2; g.add(fu.root);
  g.traverse(o => { o.layers.mask = 9; if (o.isMesh) { o.material = lam; o.castShadow = false; } });
}
// 停回站位（建城、換邊、取消搭車、空車開到了）：車身貼地、門關好、可以再叫車
function cabPark(cab) {
  const u = cab.userData, st = u.city ? TAXI.cStand : TAXI.vStand; u.st = 'park'; u.leg = null; u.next = ''; u.hail = false; u.it.off = false; u.glass.visible = true;
  u.doors.forEach(d => { d.a = d.a0 = d.a1 = 0; d.g.rotation.y = 0; }); placeCab(cab, { x: st[0], z: st[1], hd: st[2] + Math.PI / 2 }, null);
}
// 把車放到路段上的一點：航向、地面（月光谷四個輪子各取一次高度；城市與管子裡是平的）、車身的俯仰與側傾。
// sus＝搭車中的二階彈簧（ω 9、ζ .55；加速度造成的俯仰、彎道往外側傾），null＝直接貼地。減少動態：只動位置、不轉角度
function placeCab(cab, p, sus, dt = 0, acc = 0, alat = 0) {
  const u = cab.userData, ry = p.hd - Math.PI / 2, c = Math.cos(ry), s = Math.sin(ry), T = u.city ? TAXI.C : TAXI.V, hs = [0, 0, 0, 0], rm = RM();
  for (let i = 0; i < 4; i++) { const [lx, lz] = CAB_W[i], x = p.x + lx * c + lz * s, z = p.z - lx * s + lz * c, du = (x - T.x) * T.dx + (z - T.z) * T.dz, dv = Math.abs((x - T.x) * T.dz - (z - T.z) * T.dx); hs[i] = du > -.4 && du < TAXI.LEN && dv < TAXI.HW ? T.y : u.city ? 0 : H(x, z); }
  const y0 = (hs[0] + hs[1] + hs[2] + hs[3]) / 4, pt = rm ? 0 : Math.atan2(hs[0] + hs[1] - hs[2] - hs[3], 5) + .004 * acc, rl = rm ? 0 : clamp(Math.atan2(hs[1] + hs[3] - hs[0] - hs[2], 3.28) - .006 * alat, -.03, .03);
  let y = y0, rx = rl, rz = pt;
  if (sus && dt > 0) { const w2 = 81, dmp = 2 * .55 * 9, k = Math.min(dt, .05); sus.vy += (w2 * (y0 - sus.y) - dmp * sus.vy) * k; sus.y += sus.vy * k; sus.vp += (w2 * (pt - sus.p) - dmp * sus.vp) * k; sus.p += sus.vp * k; sus.vr += (w2 * (rl - sus.r) - dmp * sus.vr) * k; sus.r += sus.vr * k; if (rm) sus.p = sus.r = sus.vp = sus.vr = 0; y = sus.y; rx = sus.r; rz = sus.p; } // 減少動態：車身只動位置、永遠不轉角度
  else if (sus) { sus.y = y0; sus.p = pt; sus.r = rl; sus.vy = sus.vp = sus.vr = 0; }
  cab.position.set(p.x, y, p.z); cab.rotation.set(rx, ry, rz, 'YZX');
  u.wx = p.x + (u.city ? CITY.x : 0); u.wz = p.z + (u.city ? CITY.z : 0); u.c = c; u.s = s; u.it.wp = null; cab.updateMatrixWorld(true);
}
// 會動的車也要擋人（不能放進靜態的碰撞格子）：點轉到車的本地座標，在車身範圍內就沿最近的邊推出去
function cabBlock(nx, nz, r) {
  for (const cab of [W.taxiV, W.taxiC]) {
    if (!cab || cab.userData.city !== inCity(nx)) continue; const u = cab.userData, dx = nx - u.wx, dz = nz - u.wz, lx = dx * u.c - dz * u.s, lz = dx * u.s + dz * u.c, ax = 1.95 + r, az = .85 + r;
    if (Math.abs(lx) >= ax || Math.abs(lz) >= az) continue; let px = lx, pz = lz; if (ax - Math.abs(lx) < az - Math.abs(lz)) px = (lx < 0 ? -1 : 1) * ax; else pz = (lz < 0 ? -1 : 1) * az;
    nx = u.wx + px * u.c + pz * u.s; nz = u.wz - px * u.s + pz * u.c;
  }
  return [nx, nz];
}
// 玩家（或任何一點）在車的哪一側：本地 z 的正負（+1＝右門）
function cabSide(cab, x = P.x, z = P.z) { const u = cab.userData, dx = x - u.wx, dz = z - u.wz; return dx * u.s + dz * u.c < 0 ? -1 : 1; }
// 開關門：a 從目前的角度用 out3 追到目標（delay 毫秒後才開始動）
function cabDoor(cab, s, open, dur = 350, delay = 0) { const d = cab.userData.doors[s < 0 ? 0 : 1]; d.a0 = d.a; d.a1 = open ? 1 : 0; d.t0 = performance.now() + delay; d.d = dur; }
// 月光谷的計程車招呼站：出生點左邊一座小花島（石頭邊、矮樹籬圍著一圈小花），西側一塊木牌「計程車招呼站 → 大城市」，畫著一台小計程車
function taxiIsland() {
  const P0 = [], cx = -14.1, cz = 21.5, R = 2.9, hz = 3.6, rd = seeded(19), per = 4 * hz + PI2 * R;
  const at = (s, k = 0) => { s = ((s % per) + per) % per; let x, z, nx, nz; // 跑道形：右邊直線 → 北端半圓 → 左邊直線 → 南端半圓；k＝往內縮幾公尺
    if (s < 2 * hz) { x = cx + R; z = cz + hz - s; nx = 1; nz = 0; } else if ((s -= 2 * hz) < Math.PI * R) { const a = s / R; nx = Math.cos(a); nz = -Math.sin(a); x = cx + R * nx; z = cz - hz + R * nz; }
    else if ((s -= Math.PI * R) < 2 * hz) { x = cx - R; z = cz - hz + s; nx = -1; nz = 0; } else { const a = (s - 2 * hz) / R; nx = -Math.cos(a); nz = Math.sin(a); x = cx + R * nx; z = cz + hz + R * nz; }
    return [x - nx * k, z - nz * k, nx, nz]; };
  let top = -9; for (let s = 0; s < per; s += 1) { const [x, z] = at(s); top = Math.max(top, H(x, z)); } top += .16;
  const sh = new THREE.Shape(); for (let i = 0; i <= 48; i++) { const [x, z] = at(i / 48 * per, .12); i ? sh.lineTo(x, -z) : sh.moveTo(x, -z); }
  P0.push([new THREE.ShapeGeometry(sh).rotateX(-Math.PI / 2), '#6aa760', M4(0, top, 0)]); // 島上的草
  for (let s = 0, i = 0; s < per; s += .5, i++) { const [x, z, nx, nz] = at(s), y0 = H(x, z) - .08; P0.push([new THREE.BoxGeometry(.46, top + .05 - y0, .2), i % 3 ? '#cfc8b8' : '#bdb5a3', M4(x, (top + .05 + y0) / 2, z, 0, Math.atan2(nx, nz), 0)]); } // 石頭邊
  for (let s = 0, i = 0; s < per; s += .55, i++) { const [x, z] = at(s, .38); P0.push([blobG(.3, i % 5), ['#3f7d3a', '#4a8a40', '#37713a'][i % 3], M4(x, top + .2, z, 0, i, 0, 1, .75, 1)]); } // 矮樹籬
  const FL = ['#f9a8d4', '#fde047', '#ffffff', '#c4b5fd', '#fb7185'];
  for (let s = 0, i = 0; s < per; s += .42, i++) { const [x, z] = at(s, 1.0 + rd() * .25); P0.push([sphG(.09, 6, 4), FL[i % 5], M4(x, top + .18 + rd() * .06, z)], [sphG(.07, 5, 3), '#4c8f45', M4(x + .08, top + .08, z - .06)]); } // 一圈小花
  // 木牌（朝東，車子停在它和花島之間）：兩根柱子＋木板，字畫在另一個貼圖網格
  const sx = -22.4, sz = 19.6, sy = H(sx, sz);
  [-.66, .66].forEach(dz => P0.push([new THREE.BoxGeometry(.1, 2.3, .1), '#6b4d33', M4(sx, sy + 1.15, sz + dz)])); P0.push([new THREE.BoxGeometry(.06, .98, 1.62), '#7d5c3a', M4(sx - .01, sy + 1.72, sz)], [new THREE.BoxGeometry(.16, .06, 1.7), '#5b4330', M4(sx, sy + 2.24, sz)]);
  const m = new THREE.Mesh(mergeParts(P0), new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: .9, metalness: 0 })); m.castShadow = !LOW; m.receiveShadow = true; W.scene.add(m);
  const tex = artTex(512, 290, (g, w, h) => {
    woodBoard(g, w, h); artText(g, '計程車招呼站', w / 2, 92, 60, '#fef3c7', w - 44); artText(g, '→ 大城市', w / 2 + 64, 188, 50, '#fde047', 290);
    g.lineJoin = 'round'; g.lineWidth = 5; g.strokeStyle = '#2b1b0e'; const r = (x, y, ww, hh, c) => { g.fillStyle = c; g.beginPath(); g.roundRect ? g.roundRect(x, y, ww, hh, 9) : g.rect(x, y, ww, hh); g.fill(); g.stroke(); };
    r(70, 172, 80, 30, '#facc15'); r(40, 196, 140, 40, '#facc15'); r(84, 178, 24, 18, '#bfdbfe'); r(114, 178, 24, 18, '#bfdbfe'); r(98, 160, 26, 12, '#fef08a'); // 小計程車
    g.fillStyle = '#1f2937'; [72, 148].forEach(x => { g.beginPath(); g.arc(x, 238, 14, 0, PI2); g.fill(); g.stroke(); });
  });
  const pl = mesh(new THREE.PlaneGeometry(1.52, .86), new THREE.MeshStandardMaterial({ map: tex, roughness: .85, metalness: 0 }), sx + .03, sy + 1.72, sz); pl.rotation.y = Math.PI / 2; W.scene.add(pl);
  addCol({ box: [cx - R, cz - hz, cx + R, cz + hz] }); addCol({ x: cx, z: cz - hz, r: R }); addCol({ x: cx, z: cz + hz, r: R }); addCol({ x: sx, z: sz, r: .8 }); // 跑道形：中間一個方塊、兩端圓形（回程的車從南端圓角外 1 m 多經過）
}
/* ---------- 大城市 ---------- */
function drawShopSign(c, name, accent, locked) {
  const t = c.getContext('2d'); t.fillStyle = '#0b1220'; t.fillRect(0, 0, 512, 128); t.textAlign = 'center';
  t.fillStyle = locked ? '#64748b' : accent; t.font = 'bold 64px "Noto Sans TC","Microsoft JhengHei",sans-serif'; t.fillText(name, 256, locked ? 70 : 86, 470);
  if (locked) { t.fillStyle = '#94a3b8'; t.font = 'bold 34px "Noto Sans TC","Microsoft JhengHei",sans-serif'; t.fillText('Lv ' + ARMS_LV + ' 解鎖營業', 256, 114, 470); }
}
/* 升到 Lv5：武器店開張（重繪招牌與標籤、一則 toast，不跳彈窗）。人在城市、離武器店 60 m 內：鐵捲門 1.6 秒捲上去、鐵伯出來揮手；不在附近就直接是開的 */
function unlockArms() {
  const a = W.armsSign; if (a) { drawShopSign(a.c, a.name, a.accent, false); a.blit(); }
  if (W.armsLabel && W.city) { const p = W.armsLabel.position.clone(); dropObj(W.armsLabel); const lb = textSprite('武器店', '#f87171', '長劍、保暖衣'); lb.position.copy(p); W.city.add(lb); W.armsLabel = lb; }
  sfx.pop && sfx.pop(); toast('大城市的武器店開張了'); objSig = '';
  const A = W.armsShut; if (!A || !A.on) return;
  if (inCity() && Math.hypot(P.x - CITY.x - SHOPS.arms.x, P.z - CITY.z + 14) < 60) { A.t0 = performance.now(); if (!RM()) shopSnd.shutter(); tagDirty('arms:shut'); TAG.t = 1; } else armsGone();
}
/* 大城市的靜態零件：建城時各處把零件丟進 CZ，最後依材質各合併成一個網格——
   det＝頂點色細節（依 x 分西、中、東三塊，看向街道一端時另一端會被視錐剔除）、wood＝木紋、glow＝夜燈（頂點色就是發光顏色）、
   sign＝招牌圖集、glass＝櫥窗玻璃、mark＝路面標線、pool＝路燈下的光暈。
   原本每盞路燈、每棵樹、每條斑馬線都是獨立網格，站在街上一眼望去要三百多次繪製。 */
let CZ = null;
const CZ_L = ['det', 'wood', 'glow', 'sign', 'glass', 'mark', 'pool', 'shopIn', 'tag']; // shopIn＝店頭的店內（自發光）、tag＝吊牌圖集 // CZ 裡的零件清單（sg、dark 是圖集資料，不是清單）
const UBOX = new THREE.BoxGeometry(1, 1, 1), UPLN = new THREE.PlaneGeometry(1, 1), GEOC = {};
const geoC = (k, f) => GEOC[k] || (GEOC[k] = f());
const cylG = (rt, rb, h, s = 8) => geoC(['c', rt, rb, h, s].join(), () => new THREE.CylinderGeometry(rt, rb, h, LOW ? Math.max(5, Math.ceil(s / 2)) : s)); // 手機的圓柱面數減半
const blobG = (r, s = 1) => geoC(['b', r, s].join(), () => jit(new THREE.IcosahedronGeometry(r, LOW || r < .35 ? 0 : 1), .3, s * 7 + 1)); // 小花小葉用 20 面就夠
const sphG = (r, a = 8, b = 6) => geoC(['s', r, a, b].join(), () => new THREE.SphereGeometry(r, a, b));
const rpk = (rd, a) => a[Math.floor(rd() * a.length)];
// 把方塊或平面每一面 0～1 的 UV 換到圖集上的一格；faces＝哪幾面貼圖（方塊的面順序：+x −x +y −y +z −z），其他面貼深色（招牌側邊）
function atlasUV(geo, rect, faces) {
  const uv = geo.attributes.uv, [u0, v0, du, dv] = rect, D = CZ.dark;
  for (let i = 0; i < uv.count; i++) { if (!faces || faces.includes(i >> 2)) uv.setXY(i, u0 + uv.getX(i) * du, v0 + uv.getY(i) * dv); else uv.setXY(i, D[0] + D[2] / 2, D[1] + D[3] / 2); }
  return geo;
}
// 以 (x, z, 朝向 ry) 為原點擺一組零件（本地 +z＝正面）：B 方塊、P 任意幾何、S 招牌（d＝0 是單面平面）、Q 玻璃；L＝放進哪份清單
function cAt(x = 0, z = 0, ry = 0, y = 0) {
  const m0 = M4(x, y, z, 0, ry, 0), T = m => m0.clone().multiply(m);
  return {
    B: (w, h, d, c, px, py, pz, rx = 0, rry = 0, rz = 0, L = 'det') => { CZ[L].push([UBOX, c, T(M4(px, py, pz, rx, rry, rz, w, h, d))]); },
    P: (geo, c, m, L = 'det') => { CZ[L].push([geo, c, T(m || M4())]); },
    S: (w, h, d, rect, px, py, pz, faces = [4], rx = 0, rry = 0, rz = 0) => { CZ.sign.push(atlasUV(d ? UBOX.clone() : UPLN.clone(), rect, d ? faces : null).applyMatrix4(T(M4(px, py, pz, rx, rry, rz, w, h, d || 1)))); },
    Q: (w, h, px, py, pz, rry = 0) => { CZ.glass.push(UPLN.clone().applyMatrix4(T(M4(px, py, pz, 0, rry, 0, w, h, 1)))); },
  };
}
const TC_FONT = '"Noto Sans TC","PingFang TC","Microsoft JhengHei",sans-serif';
// 招牌圖集：所有招牌、櫥窗裡的店內景象、海報、販賣機面板畫在同一張畫布上（一個材質、一次繪製），同一張圖也當自發光貼圖，晚上整條街的招牌一起亮。
// 一列一列往下排（同一列的格子一樣高最省空間）；手機用一半解析度
function cityAtlas() {
  const AW = 1024, AH = 2048, k = LOW ? .5 : 1, cv = document.createElement('canvas'); cv.width = AW * k; cv.height = AH * k;
  const g = cv.getContext('2d'); g.scale(k, k); let x = 0, y = 0, rh = 0;
  return { cv, g, cell(w, h, draw) {
    if (x + w > AW) { x = 0; y += rh; rh = 0; } if (y + h > AH) console.warn('城市招牌圖集放不下了');
    const px = x, py = y; g.save(); g.translate(px, py); g.beginPath(); g.rect(0, 0, w, h); g.clip(); draw(g, w, h); g.restore(); x += w; rh = Math.max(rh, h);
    const r = [(px + 1.5) / AW, 1 - (py + h - 1.5) / AH, (w - 3) / AW, (h - 3) / AH]; r.px = [px, py, w, h]; return r;
  } };
}
// 直立招牌（一個字一行，字的大小依格子算好，不會超出板面）；neon＝深色底＋發光字
function vSign(t, w, h, txt, bg, fg, neon) {
  t.fillStyle = bg; t.fillRect(0, 0, w, h); const ch = [...txt], n = ch.length, fs = Math.min(w * .66, (h - 34) / n * .84);
  t.strokeStyle = neon ? fg : 'rgba(0,0,0,.22)'; t.lineWidth = neon ? 3 : 5; t.strokeRect(6, 6, w - 12, h - 12);
  t.font = '900 ' + fs + 'px ' + TC_FONT; t.textAlign = 'center'; t.textBaseline = 'middle'; t.fillStyle = fg; if (neon) { t.shadowColor = fg; t.shadowBlur = 10; }
  ch.forEach((c, i) => t.fillText(c, w / 2, 17 + (h - 34) * (i + .5) / n, w - 18)); t.shadowBlur = 0;
}
// 橫式店招：店名＋一行小字（fillText 限寬，字不會被裁掉）
function hSign(t, w, h, txt, sub, bg, fg, sc) {
  t.fillStyle = bg; t.fillRect(0, 0, w, h); t.fillStyle = 'rgba(255,255,255,.12)'; t.fillRect(0, 0, w, h * .42); t.strokeStyle = 'rgba(0,0,0,.25)'; t.lineWidth = 4; t.strokeRect(2, 2, w - 4, h - 4);
  t.textAlign = 'center'; t.textBaseline = 'middle'; t.fillStyle = fg; t.font = '900 ' + Math.round(h * (sub ? .44 : .54)) + 'px ' + TC_FONT; t.fillText(txt, w / 2, sub ? h * .4 : h * .53, w - 28);
  if (sub) { t.fillStyle = sc || fg; t.font = '700 ' + Math.round(h * .19) + 'px ' + TC_FONT; t.fillText(sub, w / 2, h * .8, w - 28); }
}
// 櫥窗裡的店內景象（暖色燈光，晚上會亮）：貨架、冰箱、花桶、麵包、書櫃、吧台……
function shopInterior(t, w, h, kind) {
  const gr = t.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, '#fff4da'); gr.addColorStop(1, '#e4c294'); t.fillStyle = gr; t.fillRect(0, 0, w, h);
  const R = (x, y, ww, hh, c) => { t.fillStyle = c; t.fillRect(x, y, ww, hh); }, O = (x, y, rx, ry, c) => { t.fillStyle = c; t.beginPath(); t.ellipse(x, y, rx, ry, 0, 0, PI2); t.fill(); };
  const C = ['#ef4444', '#f59e0b', '#22c55e', '#3b82f6', '#a855f7', '#ec4899', '#14b8a6', '#facc15'];
  for (let i = 0; i < 4; i++) R(18 + i * 62, 4, 40, 5, '#fffdf5'); // 天花板的燈
  if (kind === 'conv' || kind === 'pharm' || kind === 'book' || kind === 'bread') {
    const sh = { conv: '#e5e7eb', pharm: '#f8fafc', book: '#8b5a3c', bread: '#c08552' }[kind], ns = kind === 'conv' ? 2 : 3, sw = kind === 'conv' ? 76 : 76;
    for (let s = 0; s < ns; s++) { const x0 = 8 + s * (sw + 8); R(x0, 26, sw, h - 30, sh);
      for (let r = 0; r < 4; r++) { R(x0, 50 + r * 26, sw, 4, 'rgba(0,0,0,.22)');
        for (let i = 0; i < 7; i++) { const xx = x0 + 4 + i * 10.4, yy = 30 + r * 26;
          if (kind === 'bread') O(xx + 4, yy + 15, 5.5, 4.5, ['#d4a056', '#b7793a', '#e8c07a'][(i + r) % 3]);
          else if (kind === 'book') R(xx, yy + 2, 8, 18, C[(i * 3 + r + s) % 8]);
          else R(xx, yy + 6, 7, 14, kind === 'pharm' ? ['#ffffff', '#86efac', '#bae6fd', '#fde68a'][(i + r + s) % 4] : C[(i * 3 + r + s) % 8]); } } }
    if (kind === 'conv') { R(w - 86, 22, 78, h - 26, '#cbd5e1'); for (let r = 0; r < 5; r++) for (let i = 0; i < 6; i++) R(w - 82 + i * 12.5, 28 + r * 25, 9, 18, C[(i + r * 2) % 8]); R(w - 86, 22, 78, h - 26, 'rgba(186,230,253,.3)'); R(w - 48, 22, 3, h - 26, '#94a3b8'); }
    if (kind === 'pharm') { R(w - 56, 30, 40, 12, '#22c55e'); R(w - 42, 16, 12, 40, '#22c55e'); }
  } else if (kind === 'flower') {
    R(0, h - 34, w, 34, '#8a5a2b'); for (let i = 0; i < 9; i++) { const x = 12 + i * 27, y = h - 50 - (i % 2) * 8; R(x, y + 12, 20, 30, '#64748b');
      for (let k = 0; k < 7; k++) O(x + 3 + (k % 3) * 7, y + 6 - Math.floor(k / 3) * 8, 6, 6, ['#f472b6', '#fb7185', '#facc15', '#f97316', '#a78bfa', '#ffffff'][(i + k) % 6]); R(x + 3, y + 9, 14, 6, '#4c9a45'); }
    for (let i = 0; i < 5; i++) O(26 + i * 50, 30, 16, 12, '#5aa84f');
  } else if (kind === 'home') {
    R(0, 0, 44, h, '#e9d5b7'); R(w - 44, 0, 44, h, '#e9d5b7'); R(80, 60, 96, 6, '#8b5a3c'); O(128, 56, 22, 10, '#fde68a'); O(70, h - 30, 18, 22, '#4c9a45'); R(62, h - 14, 16, 14, '#b45309');
  } else { // 吧台型：珍奶、豆花、咖啡、麵店、甜點
    R(16, 18, w - 32, 50, '#1f2937'); t.fillStyle = '#fde68a'; t.font = '700 12px ' + TC_FONT; t.textAlign = 'left';
    for (let i = 0; i < 6; i++) { R(26 + (i % 3) * 74, 26 + Math.floor(i / 3) * 20, 46, 6, 'rgba(255,255,255,.75)'); R(76 + (i % 3) * 74, 26 + Math.floor(i / 3) * 20, 12, 6, '#fde68a'); }
    R(0, h - 54, w, 54, { tea: '#f59e0b', tofu: '#a16207', cafe: '#6b4423', noodle: '#991b1b', dessert: '#f9a8d4' }[kind] || '#a16207'); R(0, h - 58, w, 6, '#fef3c7');
    for (let i = 0; i < 6; i++) { const x = 24 + i * 38, y = h - 66;
      if (kind === 'tea') { R(x, y - 18, 16, 24, 'rgba(255,255,255,.85)'); R(x + 2, y - 4, 12, 9, '#c08552'); for (let k = 0; k < 3; k++) O(x + 4 + k * 4, y + 2, 2, 2, '#1f1208'); R(x + 9, y - 26, 2, 10, '#ef4444'); }
      else if (kind === 'noodle' || kind === 'tofu') { O(x + 8, y + 2, 13, 6, '#ffffff'); O(x + 8, y, 10, 3, kind === 'tofu' ? '#f5e6c8' : '#b45309'); if (kind === 'noodle') { t.strokeStyle = 'rgba(255,255,255,.7)'; t.lineWidth = 2; t.beginPath(); t.moveTo(x + 5, y - 6); t.quadraticCurveTo(x + 1, y - 14, x + 6, y - 22); t.stroke(); } }
      else { O(x + 8, y - 2, 9, 8, kind === 'dessert' ? C[i % 8] : '#f5e6c8'); R(x, y + 4, 16, 3, '#ffffff'); }
    }
  }
  t.fillStyle = 'rgba(255,255,255,.17)'; t.beginPath(); t.moveTo(w * .18, 0); t.lineTo(w * .36, 0); t.lineTo(w * .14, h); t.lineTo(-w * .04, h); t.fill(); // 玻璃反光
  t.strokeStyle = 'rgba(40,30,20,.45)'; t.lineWidth = 5; t.strokeRect(2.5, 2.5, w - 5, h - 5);
}
// 小綠人（台灣的行人號誌）：fr＝'stand' 站著，數字＝走路的第幾格
function stickman(t, x, y, c, fr, run) {
  t.strokeStyle = c; t.fillStyle = c; t.lineWidth = 6; t.lineCap = 'round'; t.beginPath(); t.arc(x + 22, y + 8, 6.5, 0, PI2); t.fill();
  const st = fr === 'stand', a = st ? 0 : Math.sin(fr / 4 * PI2) * (run ? 1.15 : .75), lean = run ? 4 : 0; t.beginPath();
  t.moveTo(x + 22, y + 17); t.lineTo(x + 22 + lean, y + 34);
  if (st) { t.moveTo(x + 22, y + 19); t.lineTo(x + 13, y + 33); t.moveTo(x + 22, y + 19); t.lineTo(x + 31, y + 33); t.moveTo(x + 22, y + 34); t.lineTo(x + 16, y + 54); t.moveTo(x + 22, y + 34); t.lineTo(x + 28, y + 54); }
  else { t.moveTo(x + 22 + lean * .6, y + 20); t.lineTo(x + 22 + Math.sin(a) * 11, y + 32); t.moveTo(x + 22 + lean * .6, y + 20); t.lineTo(x + 22 - Math.sin(a) * 11, y + 32);
    t.moveTo(x + 22 + lean, y + 34); t.lineTo(x + 22 + lean + Math.sin(a) * 13, y + 54); t.moveTo(x + 22 + lean, y + 34); t.lineTo(x + 22 + lean - Math.sin(a) * 13, y + 54); }
  t.stroke();
}
/* 招牌圖集的內容（依高度一列一列排）：直立招牌、路燈旗、販賣機面板、海報、櫥窗、店招……回傳每一格在圖集上的位置 */
function citySigns(A) {
  const R = { v: {}, ban: [], h: {}, i: {}, shop: {} };
  CZ.dark = A.cell(8, 8, t => { t.fillStyle = '#1f2430'; t.fillRect(0, 0, 8, 8); });
  [['tea', '珍珠奶茶', '#fef3c7', '#b45309'], ['dent', '牙醫診所', '#ffffff', '#1d4ed8'], ['cram', '月光補習班', '#fde047', '#dc2626'], ['bfast', '早餐店', '#fb923c', '#ffffff'], ['fried', '鹹酥雞', '#dc2626', '#fde047'],
    ['pharm', '健康藥局', '#16a34a', '#ffffff'], ['ktv', '卡拉OK', '#1e1b4b', '#f0abfc', 1], ['glass', '眼鏡行', '#1d4ed8', '#ffffff'], ['book', '雲朵書店', '#f5f0e1', '#7c2d12'], ['bread', '麵包店', '#fbcfe8', '#9d174d'],
    ['wash', '洗衣店', '#bae6fd', '#075985'], ['salon', '史萊姆美容院', '#1f1033', '#f472b6', 1], ['class', '捏捏教室', '#bbf7d0', '#166534'], ['gel', '凝膠批發', '#0f766e', '#ccfbf1'], ['beef', '牛肉麵', '#7f1d1d', '#fef3c7'],
    ['inn', '月光民宿', '#1e3a8a', '#fde68a', 1], ['game', '電玩', '#0c0a1e', '#22d3ee', 1], ['coffee', '咖啡', '#5b3a29', '#fde7b0']]
    .forEach(([k, txt, bg, fg, neon]) => { R.v[k] = A.cell(80, 320, (t, w, h) => vSign(t, w, h, txt, bg, fg, neon)); R.v[k].c = neon ? fg : '#fde68a'; });
  [['史萊姆祭', '#f472b6', '#ffffff'], ['捏捏週', '#22d3ee', '#0f172a'], ['月光谷', '#facc15', '#7c2d12'], ['歡迎光臨', '#34d399', '#064e3b']]
    .forEach(([txt, bg, fg]) => R.ban.push(A.cell(80, 320, (t, w, h) => { vSign(t, w, h, txt, bg, fg); t.fillStyle = 'rgba(255,255,255,.5)'; t.beginPath(); t.arc(w / 2, h - 16, 6, 0, PI2); t.fill(); })));
  R.busAd = A.cell(192, 320, (t, w, h) => { const g = t.createLinearGradient(0, 0, 0, h); g.addColorStop(0, '#bbf7d0'); g.addColorStop(1, '#22c55e'); t.fillStyle = g; t.fillRect(0, 0, w, h);
    for (let i = 0; i < 14; i++) { t.fillStyle = 'rgba(255,255,255,.55)'; t.beginPath(); t.arc(20 + (i * 53) % 160, 300 - (i * 37) % 240, 4 + i % 4 * 2, 0, PI2); t.fill(); }
    t.fillStyle = '#16a34a'; t.beginPath(); t.roundRect ? t.roundRect(56, 120, 80, 130, 18) : t.rect(56, 120, 80, 130); t.fill(); t.fillStyle = '#4ade80'; t.fillRect(56, 150, 80, 60); t.fillStyle = '#14532d';
    t.beginPath(); t.arc(82, 176, 6, 0, PI2); t.arc(110, 176, 6, 0, PI2); t.fill(); t.strokeStyle = '#14532d'; t.lineWidth = 3; t.beginPath(); t.arc(96, 186, 8, .2, Math.PI - .2); t.stroke();
    t.textAlign = 'center'; t.fillStyle = '#ffffff'; t.strokeStyle = '#14532d'; t.lineWidth = 5; t.font = '900 30px ' + TC_FONT; t.strokeText('史萊姆汽水', w / 2, 52, w - 20); t.fillText('史萊姆汽水', w / 2, 52, w - 20);
    t.font = '700 16px ' + TC_FONT; t.fillStyle = '#14532d'; t.fillText('Q 彈氣泡・新登場', w / 2, 84, w - 20); t.fillText('全城販賣機限量販售', w / 2, 290, w - 20); });
  R.vend = A.cell(160, 256, (t, w, h) => { t.fillStyle = '#e0f2fe'; t.fillRect(0, 0, w, h); t.fillStyle = '#0ea5e9'; t.fillRect(0, 0, w, 30); t.fillStyle = '#fff'; t.font = '900 19px ' + TC_FONT; t.textAlign = 'center'; t.fillText('冰涼飲料', w / 2, 22, w - 16);
    const cans = ['#a16207', '#facc15', '#d6b48a', '#38bdf8', '#7c2d12', '#4ade80'];
    for (let r = 0; r < 3; r++) for (let i = 0; i < 4; i++) { const x = 12 + i * 36, y = 42 + r * 66, c = cans[(i + r * 4) % 6]; t.fillStyle = c; t.fillRect(x + 4, y, 22, 40); t.fillStyle = 'rgba(255,255,255,.35)'; t.fillRect(x + 7, y + 3, 5, 34);
      if (c === '#4ade80') { t.fillStyle = '#14532d'; t.fillRect(x + 10, y + 16, 3, 4); t.fillRect(x + 18, y + 16, 3, 4); }
      t.fillStyle = '#1f2937'; t.fillRect(x + 2, y + 44, 26, 12); t.fillStyle = '#fde047'; t.font = '700 10px ' + TC_FONT; t.fillText('¥10', x + 15, y + 54); } });
  R.gacha = A.cell(128, 256, (t, w, h) => { t.fillStyle = '#fbcfe8'; t.fillRect(0, 0, w, h); t.fillStyle = '#db2777'; t.font = '900 22px ' + TC_FONT; t.textAlign = 'center'; t.fillText('史萊姆扭蛋', w / 2, 30, w - 12);
    t.fillStyle = 'rgba(255,255,255,.75)'; t.beginPath(); t.arc(w / 2, 104, 50, 0, PI2); t.fill(); ['#6ee7a8', '#fbbf24', '#38bdf8', '#fb7185', '#a78bfa', '#f97316', '#34d399'].forEach((c, i) => { t.fillStyle = c; t.beginPath(); t.arc(w / 2 - 30 + (i % 4) * 20, 88 + Math.floor(i / 4) * 24 + (i % 2) * 6, 11, 0, PI2); t.fill(); });
    t.fillStyle = '#9d174d'; t.fillRect(16, 170, w - 32, 50); t.fillStyle = '#fff'; t.font = '700 15px ' + TC_FONT; t.fillText('一次 ¥30', w / 2, 200, w - 30); t.fillStyle = '#e5e7eb'; t.beginPath(); t.arc(w / 2, 238, 12, 0, PI2); t.fill(); });
  R.neon = A.cell(448, 256, (t, w, h) => { t.fillStyle = '#0b0614'; t.fillRect(0, 0, w, h); t.shadowBlur = 16; t.lineWidth = 7; t.strokeStyle = t.shadowColor = '#f472b6';
    t.beginPath(); t.moveTo(50, 200); t.quadraticCurveTo(46, 70, 130, 60); t.quadraticCurveTo(214, 70, 210, 200); t.closePath(); t.stroke(); t.strokeStyle = t.shadowColor = '#67e8f9';
    t.beginPath(); t.arc(105, 130, 10, 0, PI2); t.moveTo(165, 130); t.arc(155, 130, 10, 0, PI2); t.stroke(); t.beginPath(); t.arc(130, 155, 18, .3, Math.PI - .3); t.stroke();
    t.fillStyle = t.shadowColor = '#fde047'; t.font = '900 64px ' + TC_FONT; t.textAlign = 'center'; t.fillText('喀滋！', 330, 120, 200); t.fillStyle = t.shadowColor = '#f0abfc'; t.font = '900 34px ' + TC_FONT; t.fillText('史萊姆捏捏', 330, 182, 200); t.shadowBlur = 0; });
  R.lost = A.cell(128, 256, (t, w, h) => { t.fillStyle = '#fef9c3'; t.fillRect(0, 0, w, h); t.fillStyle = '#b91c1c'; t.font = '900 24px ' + TC_FONT; t.textAlign = 'center'; t.fillText('尋貓啟事', w / 2, 34, w - 12);
    t.fillStyle = '#fb923c'; t.beginPath(); t.arc(w / 2, 104, 34, 0, PI2); t.fill(); t.beginPath(); t.moveTo(w / 2 - 30, 84); t.lineTo(w / 2 - 22, 58); t.lineTo(w / 2 - 8, 76); t.moveTo(w / 2 + 30, 84); t.lineTo(w / 2 + 22, 58); t.lineTo(w / 2 + 8, 76); t.fill();
    t.fillStyle = '#1c1917'; t.fillRect(w / 2 - 14, 98, 6, 8); t.fillRect(w / 2 + 8, 98, 6, 8); t.fillStyle = '#c2410c'; t.fillRect(w / 2 - 3, 72, 6, 14);
    t.fillStyle = '#44403c'; t.font = '700 13px ' + TC_FONT; ['橘色・胖胖的', '很愛跟人散步', '常在巷口睡午覺', '請摸摸牠的頭'].forEach((s, i) => t.fillText(s, w / 2, 168 + i * 22, w - 12)); });
  R.time = A.cell(128, 256, (t, w, h) => { t.fillStyle = '#f8fafc'; t.fillRect(0, 0, w, h); t.fillStyle = '#0369a1'; t.fillRect(0, 0, w, 40); t.fillStyle = '#fff'; t.font = '900 18px ' + TC_FONT; t.textAlign = 'center'; t.fillText('史萊姆巴士', w / 2, 27, w - 12);
    t.fillStyle = '#0f172a'; t.font = '700 14px ' + TC_FONT; ['月光谷線', '首班 6:00', '末班 23:30', '班距：看心情'].forEach((s, i) => t.fillText(s, w / 2, 76 + i * 34, w - 14)); t.fillStyle = '#16a34a'; t.beginPath(); t.arc(w / 2, 226, 13, 0, PI2); t.fill(); });
  // 第 4～6 列：五間主要商店的店招（512×128）、公告欄、器材行的直播螢幕
  [['mach', '機械行', '#22d3ee'], ['mall', '生活百貨', '#34d399'], ['gear', '器材行', '#e879f9'], ['hospital', '醫院', '#f87171'], ['arms', '武器店', '#f87171']].forEach(([id, name, ac]) => {
    const c = document.createElement('canvas'); c.width = 512; c.height = 128; drawShopSign(c, name, ac, id === 'arms' && !armsOpen()); R.shop[id] = A.cell(512, 128, t => t.drawImage(c, 0, 0)); R.shop[id].c = c; });
  R.board = A.cell(320, 128, (t, w, h) => { t.fillStyle = '#7d5c3a'; t.fillRect(0, 0, w, h); t.fillStyle = '#9c774f'; t.fillRect(6, 6, w - 12, h - 12);
    [['本週限定', '訂單募集中', '#fef3c7'], ['捏捏教室', '週六開課', '#fce7f3'], ['失物招領', '綠色手套', '#e0f2fe'], ['徵求鴿友', '陳伯伯留', '#ecfccb']].forEach(([a, b, c], i) => {
      t.save(); t.translate(44 + i * 77, 64); t.rotate((i - 1.5) * .05); t.fillStyle = c; t.fillRect(-33, -44, 66, 88); t.fillStyle = '#ef4444'; t.beginPath(); t.arc(0, -37, 4, 0, PI2); t.fill();
      t.fillStyle = '#1f2937'; t.textAlign = 'center'; t.font = '900 15px ' + TC_FONT; t.fillText(a, 0, -6, 58); t.font = '700 11px ' + TC_FONT; t.fillText(b, 0, 20, 58); t.restore(); }); });
  R.live = A.cell(192, 128, (t, w, h) => { const g = t.createLinearGradient(0, 0, w, h); g.addColorStop(0, '#7c3aed'); g.addColorStop(1, '#db2777'); t.fillStyle = g; t.fillRect(0, 0, w, h);
    for (let i = 0; i < 9; i++) { const hh = 14 + ((i * 37) % 50); t.fillStyle = i % 2 ? '#f0abfc' : '#67e8f9'; t.fillRect(12 + i * 19, h - 10 - hh, 12, hh); } t.fillStyle = '#fff'; t.font = 'bold 24px Inter,sans-serif'; t.textAlign = 'left'; t.fillText('● LIVE', 12, 32, w - 24); });
  // 第 7、8 列：櫥窗裡的店內景象（192×120）＋公車站牌
  ['conv', 'flower', 'tea', 'pharm', 'bread', 'book', 'cafe', 'noodle', 'home'].forEach(k => R.i[k] = A.cell(192, 120, (t, w, h) => shopInterior(t, w, h, k)));
  R.busSign = A.cell(120, 120, (t, w, h) => { t.fillStyle = '#0369a1'; t.beginPath(); t.arc(w / 2, h / 2, w / 2 - 2, 0, PI2); t.fill(); t.strokeStyle = '#fff'; t.lineWidth = 5; t.stroke(); t.fillStyle = '#fff'; t.textAlign = 'center'; t.font = '900 30px ' + TC_FONT; t.fillText('公車', w / 2, 58, w - 30); t.font = '700 14px ' + TC_FONT; t.fillText('史萊姆巴士', w / 2, 84, w - 34); });
  // 第 9 列起：一般店招（320×80，一列三格）與小牌子
  [['conv', '月光便利商店', '24 小時・歡迎光臨', '#ffffff', '#1d4ed8', '#f59e0b'], ['flower', '小芸花店', '每天都有新鮮的花', '#fdf2f8', '#be185d'], ['tofu', '陳記豆花', '古早味・三十年', '#fef3c7', '#7c2d12'],
    ['tea', '月光珍奶', '全糖・去冰・加珍珠', '#78350f', '#fde68a'], ['pharm', '健康藥局', '健保特約', '#f0fdf4', '#15803d'], ['bread', '捏捏麵包坊', '每天現烤', '#fff7ed', '#c2410c'], ['cafe', '月光咖啡館', 'COFFEE & COCOA', '#3b2618', '#fde7b0'],
    ['noodle', '阿山牛肉麵', '湯頭熬八小時', '#7f1d1d', '#fef3c7'], ['book', '雲朵書店', '二手書・漫畫', '#1e3a8a', '#e0e7ff'], ['salon', '史萊姆美容院', '洗剪吹・護髮', '#1f1033', '#f9a8d4'], ['dessert', '捏捏甜點', '冰品・鬆餅', '#fce7f3', '#9d174d'],
    ['bfast', '早安早餐店', '蛋餅・蘿蔔糕・奶茶', '#fff7ed', '#c2410c'], ['wash', '泡泡洗衣店', '自助洗衣・烘乾', '#ecfeff', '#0e7490']]
    .forEach(([k, txt, sub, bg, fg, stripe]) => R.h[k] = A.cell(320, 80, (t, w, h) => { hSign(t, w, h, txt, sub, bg, fg); if (stripe) { t.fillStyle = stripe; t.fillRect(4, h - 12, w - 8, 4); t.fillStyle = fg; t.fillRect(4, h - 8, w - 8, 4); } }));
  R.street = A.cell(320, 80, (t, w, h) => { t.fillStyle = '#1d4ed8'; t.fillRect(0, 0, w, h); t.strokeStyle = '#fff'; t.lineWidth = 4; t.strokeRect(6, 6, w - 12, h - 12); t.fillStyle = '#fff'; t.textAlign = 'center'; t.font = '900 34px ' + TC_FONT; t.fillText('月光大道', w / 2, 42, w - 36); t.font = '700 15px Inter,sans-serif'; t.fillText('Moonlight Ave.', w / 2, 66, w - 36); });
  R.bike = A.cell(320, 80, (t, w, h) => hSign(t, w, h, '微笑單車', '前 30 分鐘免費', '#f59e0b', '#ffffff'));
  R.park = A.cell(320, 80, (t, w, h) => hSign(t, w, h, '月光小公園', '請愛護花草', '#166534', '#ecfccb'));
  R.statue = A.cell(320, 80, (t, w, h) => hSign(t, w, h, '史萊姆像', '大城市居民共同捐贈', '#57534e', '#fde68a', '#e7e5e4'));
  R.mailG = A.cell(160, 80, (t, w, h) => hSign(t, w, h, '普通郵件', '國內', '#15803d', '#ffffff'));
  R.mailR = A.cell(160, 80, (t, w, h) => hSign(t, w, h, '限時郵件', '國際・快捷', '#b91c1c', '#ffffff'));
  return R;
}
/* 外牆貼圖：一格＝3 公尺寬、3.5 公尺高（4 欄 × 4 層＝12 × 14 公尺）。窗洞統一在每格的 0.6～2.4 公尺寬、0.7～2.9 公尺高
   （立體的窗台、鐵窗、冷氣都照這個位置擺）；另一張只畫亮燈窗戶的貼圖當自發光，晚上亮起來。顏色在合併時用頂點色乘上去，每棟樓色調不同 */
const TW_U = 12, TW_V = 14;
const FSTY = ['glass', 'brick', 'deco', 'ribbon', 'panel', 'tile', 'plaster'];
function facadeTex(k) {
  const N = LOW ? 256 : 512, cv = document.createElement('canvas'), ev = document.createElement('canvas'); cv.width = cv.height = N; ev.width = ev.height = N / 2; // 亮燈貼圖只有色塊，半解析度就夠
  const c = cv.getContext('2d'), e = ev.getContext('2d'), r = seeded(FSTY.indexOf(k) * 7 + 3), rp = a => a[Math.floor(r() * a.length)];
  c.scale(N / 512, N / 512); e.scale(N / 1024, N / 1024); e.fillStyle = '#000'; e.fillRect(0, 0, 512, 512);
  const lit = (x, y, w, h, p) => { if (r() < p) { e.fillStyle = rp(['#ffe9a8', '#fff3cf', '#ffd88a', '#dbeafe', '#fde2c4']); e.fillRect(x, y, w, h); if (r() < .45) { e.fillStyle = 'rgba(0,0,0,.6)'; e.fillRect(x + (r() < .5 ? 0 : w * .55), y, w * .45, h); } } };
  // 一扇窗：外框、玻璃（上方反射天空較亮）、窗簾或百葉、偶爾一盆植物；split：1＝左右兩扇、2＝再加橫框
  const win = (x, y, w, h, fc, split = 1, p = .3) => {
    c.fillStyle = fc; c.fillRect(x - 3, y - 3, w + 6, h + 6);
    const gr = c.createLinearGradient(0, y, 0, y + h); gr.addColorStop(0, '#a9c6dc'); gr.addColorStop(.55, '#4f6b86'); gr.addColorStop(1, '#2a3b4e'); c.fillStyle = gr; c.fillRect(x, y, w, h);
    const q = r(); if (q < .38) { c.fillStyle = rp(['#f5e6c8', '#f9d5d3', '#d4e4f0', '#e8e0f0', '#f0ead6', '#e9d5b7']); const cw = w * (.16 + r() * .22); c.fillRect(x, y, cw, h); c.fillRect(x + w - cw, y, cw, h); }
    else if (q < .55) { c.fillStyle = '#e7e5e4'; const bh = h * (.25 + r() * .6); for (let yy = y; yy < y + bh; yy += 5) c.fillRect(x, yy, w, 3); }
    if (r() < .22) { const px = x + 6 + r() * (w - 22); c.fillStyle = '#b45309'; c.fillRect(px, y + h - 9, 12, 9); c.fillStyle = '#4c9a45'; c.beginPath(); c.arc(px + 6, y + h - 14, 8, 0, PI2); c.fill(); }
    c.save(); c.beginPath(); c.rect(x, y, w, h); c.clip(); c.fillStyle = 'rgba(255,255,255,.15)'; c.beginPath(); c.moveTo(x + w * .3, y); c.lineTo(x + w * .62, y); c.lineTo(x + w * .2, y + h); c.lineTo(x - w * .12, y + h); c.fill(); c.restore();
    c.fillStyle = fc; if (split >= 1) c.fillRect(x + w / 2 - 2, y, 4, h); if (split >= 2) c.fillRect(x, y + h * .38, w, 4);
    lit(x, y, w, h, p);
  };
  const cells = f => { for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) f(i * 128 + 26, j * 128 + 22, i, j); };
  if (k === 'glass') {
    const g = c.createLinearGradient(0, 0, 512, 512); g.addColorStop(0, '#86a9c8'); g.addColorStop(.5, '#46698c'); g.addColorStop(1, '#6189ad'); c.fillStyle = g; c.fillRect(0, 0, 512, 512);
    for (let i = 0; i < 8; i++) for (let j = 0; j < 4; j++) { const x = i * 64, y = j * 128; c.fillStyle = `rgba(${150 + r() * 60 | 0},${190 + r() * 40 | 0},230,${.1 + r() * .18})`; c.fillRect(x + 3, y + 12, 58, 98); lit(x + 3, y + 12, 58, 98, .26); }
    c.strokeStyle = '#ffffff2e'; c.lineWidth = 26; c.beginPath(); c.moveTo(-40, 380); c.lineTo(380, -40); c.stroke(); c.lineWidth = 10; c.beginPath(); c.moveTo(80, 560); c.lineTo(560, 80); c.stroke();
    for (let j = 0; j <= 4; j++) { c.fillStyle = '#3a5068'; c.fillRect(0, j * 128 - 14, 512, 24); c.fillStyle = '#8fa3b8'; c.fillRect(0, j * 128 - 15, 512, 3); } // 每層的樓板帶
    c.fillStyle = '#c7d2de'; for (let i = 0; i <= 8; i++) c.fillRect(i * 64 - 2, 0, 4, 512);
  } else if (k === 'brick') {
    c.fillStyle = '#7f6a5f'; c.fillRect(0, 0, 512, 512);
    for (let y = 0, row = 0; y < 512; y += 8, row++) for (let x = row % 2 ? -9 : 0; x < 512; x += 18) { c.fillStyle = `rgb(${142 + r() * 34 | 0},${62 + r() * 20 | 0},${46 + r() * 16 | 0})`; c.fillRect(x + 1, y + 1, 16, 6); }
    cells((X, Y) => { c.fillStyle = '#6e2f24'; c.fillRect(X - 6, Y - 13, 88, 10); for (let s = 0; s < 11; s++) { c.fillStyle = '#8a3b2d'; c.fillRect(X - 5 + s * 8, Y - 12, 6, 8); }
      c.fillStyle = '#d6cfc4'; c.fillRect(X - 8, Y + 83, 92, 7); c.fillStyle = 'rgba(0,0,0,.25)'; c.fillRect(X - 8, Y + 90, 92, 3); win(X, Y, 76, 80, '#efe9df', 2, .34); });
  } else if (k === 'deco') {
    c.fillStyle = '#dccca5'; c.fillRect(0, 0, 512, 512); c.fillStyle = '#cdbb92'; for (let y = 0; y < 512; y += 32) c.fillRect(0, y, 512, 2);
    cells((X, Y) => { win(X, Y, 34, 80, '#b9a676', 0, .3); win(X + 42, Y, 34, 80, '#b9a676', 0, .3); c.fillStyle = '#b9a676'; c.fillRect(X - 4, Y + 86, 84, 18); c.fillStyle = '#a8955f'; for (let t = 0; t < 5; t++) c.fillRect(X + 2 + t * 16, Y + 89, 8, 12); });
    for (let i = 0; i <= 4; i++) { c.fillStyle = '#c7b68b'; c.fillRect(i * 128 - 10, 0, 20, 512); c.fillStyle = '#e9dcb9'; c.fillRect(i * 128 - 3, 0, 6, 512); }
  } else if (k === 'ribbon') {
    c.fillStyle = '#eef1f4'; c.fillRect(0, 0, 512, 512);
    for (let j = 0; j < 4; j++) { const y = j * 128; c.fillStyle = '#d5dbe2'; c.fillRect(0, y + 110, 512, 6); c.fillStyle = '#2f3e52'; c.fillRect(0, y + 22, 512, 80);
      for (let x = 0; x < 512; x += 32) { c.fillStyle = `rgba(160,200,235,${.1 + r() * .2})`; c.fillRect(x + 2, y + 24, 28, 76); lit(x + 2, y + 24, 28, 76, .3); c.fillStyle = '#a9b6c4'; c.fillRect(x, y + 22, 3, 80); } }
  } else if (k === 'panel') {
    for (let i = 0; i < 8; i++) for (let j = 0; j < 8; j++) { c.fillStyle = (i + j) % 2 ? '#62838a' : '#56757c'; c.fillRect(i * 64, j * 64, 64, 64); }
    cells((X, Y) => win(X, Y, 76, 80, '#d7e0e3', 1, .3));
  } else if (k === 'tile') {
    c.fillStyle = '#cfc6b4'; c.fillRect(0, 0, 512, 512);
    for (let y = 0, row = 0; y < 512; y += 9, row++) for (let x = row % 2 ? -10 : 0; x < 512; x += 20) { c.fillStyle = `hsl(38,${14 + r() * 10 | 0}%,${84 + r() * 8 | 0}%)`; c.fillRect(x + 1, y + 1, 18, 7); }
    for (let j = 0; j < 4; j++) { c.fillStyle = 'rgba(150,110,80,.32)'; c.fillRect(0, j * 128 + 112, 512, 10); }
    cells((X, Y) => { win(X, Y + 4, 76, 76, '#c4ccd4', 1, .3); c.fillStyle = '#b9ae99'; c.fillRect(X - 6, Y + 83, 88, 5); });
  } else {
    c.fillStyle = '#f2ede4'; c.fillRect(0, 0, 512, 512);
    for (let i = 0; i < 260; i++) { c.fillStyle = `rgba(${r() < .5 ? '120,100,80' : '255,255,255'},${.03 + r() * .05})`; c.beginPath(); c.arc(r() * 512, r() * 512, 6 + r() * 26, 0, PI2); c.fill(); }
    for (let j = 0; j < 4; j++) { c.fillStyle = '#e6dfd3'; c.fillRect(0, j * 128 + 116, 512, 8); }
    cells((X, Y) => { const sg = c.createLinearGradient(0, Y + 90, 0, Y + 150); sg.addColorStop(0, 'rgba(90,80,70,.16)'); sg.addColorStop(1, 'rgba(90,80,70,0)'); c.fillStyle = sg; c.fillRect(X + 4 + r() * 40, Y + 90, 10 + r() * 16, 60);
      win(X, Y, 76, 80, '#7a5a43', 2, .32); c.fillStyle = '#e2dbcf'; c.fillRect(X - 8, Y + 83, 92, 6); });
  }
  const mk = cvs => { const t = new THREE.CanvasTexture(cvs); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t; };
  return { map: mk(cv), emi: mk(ev) };
}
// 合併多個帶 UV 的幾何（同一種外牆／同一張圖集）；col＝連頂點色一起合併（每棟樓的色調）
function mergeUV(list, col) {
  const gs = list.map(g => g.index ? g.toNonIndexed() : g); let n = 0; gs.forEach(g => n += g.attributes.position.count);
  const P = new Float32Array(n * 3), N = new Float32Array(n * 3), U = new Float32Array(n * 2), C = col ? new Float32Array(n * 3).fill(1) : null; let o = 0;
  gs.forEach((g, i) => { const c = g.attributes.position.count; P.set(g.attributes.position.array, o * 3); N.set(g.attributes.normal.array, o * 3); U.set(g.attributes.uv.array, o * 2); if (C && g.attributes.color) C.set(g.attributes.color.array, o * 3); o += c; g.dispose(); if (list[i] !== g) list[i].dispose(); });
  const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.BufferAttribute(P, 3)); geo.setAttribute('normal', new THREE.BufferAttribute(N, 3)); geo.setAttribute('uv', new THREE.BufferAttribute(U, 2)); if (C) geo.setAttribute('color', new THREE.BufferAttribute(C, 3)); geo.computeBoundingSphere(); return geo;
}
// 一段塔身：四面牆的 UV 依實際寬高換算（窗戶大小在每棟樓都一樣），從 y0 開始往上接；col＝這棟樓的色調
function towerBox(w, h, d, x, y0, z, col = '#ffffff') {
  const g = new THREE.BoxGeometry(w, h, d), uv = g.attributes.uv, nor = g.attributes.normal, ox = rnd(0, 4) | 0, c = new THREE.Color(col), ca = new Float32Array(uv.count * 3);
  for (let i = 0; i < uv.count; i++) { ca[i * 3] = c.r; ca[i * 3 + 1] = c.g; ca[i * 3 + 2] = c.b; const nx = Math.abs(nor.getX(i)), ny = Math.abs(nor.getY(i)); if (ny > .5) { uv.setXY(i, 0, 0); continue; } const fw = nx > .5 ? d : w; uv.setXY(i, uv.getX(i) * fw / TW_U + ox * .25, (uv.getY(i) * h + y0) / TW_V); }
  g.setAttribute('color', new THREE.BufferAttribute(ca, 3)); g.translate(x, y0 + h / 2, z); return g;
}
/* 一棟樓：外牆（同風格的樓合併成一個網格）、一樓店面、簷口與腰線、窗台／鐵窗／冷氣／雨遮／花箱（近處的樓才放）、頂樓設備、直立招牌。
   正面朝 face（+1＝朝南、−1＝朝北）；vis＝哪幾面放窗戶細節（n／s／e／w）。窗戶位置跟外牆貼圖一致：每 3 公尺一欄、每 3.5 公尺一層。
   直立招牌掛在正面左右兩側，那兩欄的窗戶不放鐵窗、冷氣、雨遮，免得擋到招牌上的字 */
const FACE_N = { n: [0, -1], s: [0, 1], e: [1, 0], w: [-1, 0] };
const DEF_ROOF = { glass: ['crown', 'mast'], deco: ['spire'], brick: ['tank', 'bulk'], tile: ['tank', 'dish'], plaster: ['tank'], ribbon: ['garden'], panel: ['solar', 'bulk'] };
function cityBldg(TB, o) {
  const { x, z, w, d, sty } = o, face = o.face || 1, rd = o.rd, col = o.col || '#ffffff', B = cAt().B, near = o.near && !LOW;
  const cc = { glass: '#cbd5e1', brick: '#d6cfc4', deco: '#efe3c2', ribbon: '#ffffff', panel: '#c9d4d8', tile: '#e8e1d3', plaster: '#ece6dc' }[sty];
  let tiers = [[w, d, o.fl]];
  if (sty === 'glass' && o.fl >= 9) { const a = Math.round(o.fl * .6), b = Math.round(o.fl * .25); tiers = [[w, d, a], [w - 3, d - 3, b], [w - 6, d - 6, o.fl - a - b]]; }
  else if (sty === 'deco' && o.fl >= 9) { const a = Math.round(o.fl * .55), b = Math.round(o.fl * .25); tiers = [[w, d, a], [w - 3, d - 3, b], [w - 6, d - 6, o.fl - a - b]]; }
  else if (sty === 'panel' && o.fl >= 8) { const a = Math.round(o.fl * .7); tiers = [[w, d, a], [w - 3, d, o.fl - a]]; }
  tiers = tiers.filter(t => t[2] > 0 && t[0] > 2 && t[1] > 2); let y = 0;
  tiers.forEach(([tw, td, tf], i) => {
    const th = tf * 3.5, top = y + th, ff = z + face * td / 2; TB[sty].push(towerBox(tw, th, td, x, y, z, col));
    B(tw + .5, .55, td + .5, cc, x, top + .1, z); B(tw + .8, .16, td + .8, cc, x, top + .45, z); // 女兒牆與簷口（兩層）
    if (sty === 'brick' || sty === 'deco' || sty === 'plaster') for (let f = i ? 1 : 2; f < tf; f += sty === 'deco' ? 2 : 3) B(tw + .2, .2, td + .2, cc, x, y + f * 3.5, z); // 腰線
    if (sty === 'panel') [-1, 1].forEach(s => B(.35, th, .35, '#3d5258', x + s * tw / 2, y + th / 2, ff));
    if (sty === 'glass') for (let s = -tw / 2 + 3; s < tw / 2 - .1; s += 3) B(.12, th, .26, '#b6c3d1', x + s, y + th / 2, ff + face * .08); // 帷幕的直向鰭片
    if (sty === 'ribbon') { const bw = o.vs ? tw - 3.6 : tw * .86; for (let f = i ? 1 : 2; f < tf; f++) { B(bw, .16, 1.1, '#f8fafc', x, y + f * 3.5, ff + face * .55); B(bw, .9, .05, '#bfdbfe', x, y + f * 3.5 + .5, ff + face * 1.08); } } // 陽台與玻璃欄杆（有直立招牌時讓出兩側）
    y = top;
  });
  const fz = z + face * d / 2, [rw, rdp] = tiers[tiers.length - 1], vs = o.vs || [];
  B(w + .3, 4.2, d + .3, o.base || '#3a4250', x, 2.1, z); // 一樓（店面層）
  if (o.shop) cityShop(x, fz, w, face, o.shop, rd);
  else { const F = cAt(x, fz + face * .15, face > 0 ? 0 : Math.PI); F.Q(w - 1.4, 2.4, 0, 1.6, .03); F.B(w - .8, .12, 1.4, rpk(rd, ['#b91c1c', '#0f766e', '#a16207', '#1d4ed8', '#7c3aed', '#be185d']), 0, 3.1, .7, .2); }
  if (near) (o.vis || [face > 0 ? 's' : 'n']).forEach(k => {
    const [nx, nz] = FACE_N[k], fw = nx ? d : w, front = nx === 0 && nz === face, cols = Math.floor(fw / 3 + .01);
    const skip = front && vs.length ? new Set(vs.length > 1 ? [0, cols - 1] : [0]) : null; // 直立招牌旁邊那欄空著
    winDet(sty, x + nx * w / 2, z + nz * d / 2, nx, nz, fw, 1, tiers[0][2], rd, k === o.fire, skip, 3);
  });
  vs.forEach((rc, i) => vSignAt(x, fz, w, face, rc, i));
  cityRoof((o.roof || DEF_ROOF[sty]).slice(0, LOW && !o.near ? 1 : 9), x, y, z, rw, rdp, face, rd); // 手機上遠處的樓只放一樣頂樓設備
  if (o.solid) addCol({ box: [CITY.x + x - w / 2, CITY.z + z - d / 2, CITY.x + x + w / 2, CITY.z + z + d / 2] });
}
// 一面牆的窗戶細節（第 f0～f1 層）：窗台、窗楣、鐵窗、雨遮、花箱、冷氣；fire＝這面加逃生梯；skip＝這幾欄在 skipF 層以下不放東西（讓給招牌）
function winDet(sty, cx, cz, nx, nz, fw, f0, f1, rd, fire, skip, skipF) {
  const F = cAt(cx, cz, Math.atan2(nx, nz)), cols = Math.floor(fw / 3 + .01), x0 = -fw / 2 + 1.5;
  for (let f = f0; f < f1; f++) for (let k = 0; k < cols; k++) {
    const sx = x0 + k * 3, y = f * 3.5, q = rd();
    if ((fire && k === 1) || (skip && skip.has(k) && f < skipF)) continue;
    if (sty === 'brick' || sty === 'deco' || sty === 'plaster') { F.B(2.05, .1, .26, '#e2dccf', sx, y + .63, .12); if (sty !== 'plaster') F.B(2, .12, .12, '#d6cfc4', sx, y + 2.98, .06); }
    if (sty === 'tile' || sty === 'plaster') { if (q < .42) cage(F, sx, y, rd); else if (q < .66) F.B(2.1, .05, .62, rpk(rd, ['#5b7c8a', '#8a7f6f', '#b45309', '#d1d5db']), sx, y + 3.14, .3, .3); }
    if ((sty === 'brick' || sty === 'plaster') && q > .82) flowerBox(F, sx, y);
    if (k < cols - 1 && !(skip && skip.has(k + 1) && f < skipF) && sty !== 'glass' && sty !== 'ribbon' && rd() < .3) acUnit(F, sx + 1.5, y + 1.25);
  }
  if (fire) fireEscape(F, x0 + 3, f0, f1);
}
// 鐵窗：外框、直條、上下橫桿、鐵皮雨遮，有時在裡面擺一盆植物
function cage(F, sx, y, rd) {
  const c = rd() < .5 ? '#3f4f46' : '#6b5a4a', y0 = y + .6, y1 = y + 3.02, hh = y1 - y0, ym = (y0 + y1) / 2;
  [-1, 1].forEach(s => { F.B(.05, hh, .05, c, sx + s * .98, ym, .44); F.B(.03, hh, .42, c, sx + s * .98, ym, .22); });
  for (let i = 1; i < 6; i++) F.B(.024, hh, .024, c, sx - .98 + i * .327, ym, .44);
  F.B(2, .05, .46, c, sx, y0, .22); F.B(2, .05, .46, c, sx, y1, .22); F.B(2, .03, .03, c, sx, y0 + .9, .44);
  F.B(2.16, .04, .62, '#9aa5b1', sx, y1 + .12, .27, .28);
  if (rd() < .55) F.P(blobG(.2, 3), '#4c9a45', M4(sx + (rd() - .5) * 1.3, y0 + .22, .24));
}
// 冷氣室外機（掛在兩扇窗之間）
const acUnit = (F, sx, y) => { F.B(.7, .5, .3, '#e9e4da', sx, y, .17); F.B(.42, .34, .02, '#9ca3af', sx - .06, y, .33); F.B(.05, .05, .34, '#78716c', sx - .26, y - .28, .17); F.B(.05, .05, .34, '#78716c', sx + .26, y - .28, .17); };
function flowerBox(F, sx, y) { F.B(1.6, .26, .28, '#8b5a3c', sx, y + .78, .18); for (let i = 0; i < 4; i++) F.P(blobG(.15, i), ['#f472b6', '#fb7185', '#facc15', '#a78bfa'][i], M4(sx - .6 + i * .4, y + 1, .18, 0, 0, 0, 1, .8, 1)); }
// 逃生梯：每層一個鐵格平台＋欄杆，平台之間的樓梯左右交錯
function fireEscape(F, sx, f0, f1) {
  const c = '#3f3f46';
  for (let f = Math.max(1, f0); f < f1; f++) {
    const y = f * 3.5; F.B(4.4, .06, 1.15, c, sx, y + .02, .6); F.B(4.4, .04, .04, c, sx, y + 1, 1.17); F.B(4.4, .04, .04, c, sx, y + .5, 1.17);
    [-2.2, 2.2].forEach(s => F.B(.04, 1, 1.15, c, sx + s, y + .5, .6)); for (let i = -2; i <= 2; i++) F.B(.03, 1, .03, c, sx + i * 1.1, y + .5, 1.17);
    if (f + 1 < f1) F.B(4.6, .05, .5, '#52525b', sx, y + 1.75, .42, 0, 0, (f % 2 ? 1 : -1) * .83);
  }
}
// 直立招牌：二樓起、垂直於牆面，兩面都有字；板子 0.9 × 3.6 公尺（和圖集格子同比例，字不會被拉長）；支架在板子上下緣的外側，不會穿過板面；外緣一條燈條
function vSignAt(x, fz, w, face, rc, i) {
  const F = cAt(x, fz, face > 0 ? 0 : Math.PI), s = (i % 2 ? 1 : -1) * (w / 2 - .45), h = 3.6, y0 = 4.8;
  F.S(.16, h, .9, rc, s, y0 + h / 2, .62, [0, 1]);
  F.B(.05, .05, .62, '#374151', s, y0 - .06, .38); F.B(.05, .05, .62, '#374151', s, y0 + h + .06, .38);
  F.B(.05, h, .05, rc.c || '#fde68a', s, y0 + h / 2, 1.1, 0, 0, 0, 'glow');
}
/* 一樓店面：店招在雨遮上方的招牌帶（雨遮、柱子都不會擋到字）、櫥窗（圖集裡畫好的店內景象，晚上會亮）、門、條紋雨遮，門口依店家擺東西 */
function cityShop(x, fz, w, face, s, rd) {
  const F = cAt(x, fz + face * .15, face > 0 ? 0 : Math.PI), hw = w / 2, dx = s.door != null ? s.door : (hw - 1.5) * (rd() < .5 ? -1 : 1), fr = s.frame || '#374151';
  [-1, 1].forEach(k => F.B(.3, 4.2, .3, s.pil || '#d6d3d1', k * (hw - .15), 2.1, .1));
  if (s.sign) { const sw = Math.min(w - 1.4, 3.6); F.B(w - .6, .95, .22, s.band || '#1f2937', 0, 3.62, .11); F.S(sw, sw / 4, 0, s.sign, 0, 3.62, .25); } else F.B(w - .6, .3, .14, '#64748b', 0, 3.3, .07); // 住家沒有店招，只留一道簷
  const segs = [[-hw + .3, dx - .7], [dx + .7, hw - .3]].filter(([a, b]) => b - a > .6);
  segs.forEach(([a, b]) => { const cx = (a + b) / 2, sw = b - a; F.S(sw, 2.3, 0, s.int, cx, 1.45, .03); F.B(sw + .1, .1, .1, fr, cx, 2.64, .05); F.B(sw + .1, .3, .12, fr, cx, .15, .06); });
  if (!s.auto) { F.B(1.3, 2.75, .1, fr, dx, 1.375, .05); F.Q(1.1, 2.5, dx, 1.3, .11); F.B(.04, .45, .05, '#d4d4d8', dx + .38, 1.2, .14); }
  const n = Math.max(LOW ? 2 : 4, Math.round((w - .7) / (LOW ? 1.1 : .55))), aw = (w - .7) / n; // 條紋雨遮（整個在招牌帶下面；手機條紋寬一倍）
  for (let i = 0; i < n; i++) { const c = s.aw[i % 2], ax = -hw + .35 + aw * (i + .5); F.B(aw + .005, .05, 1.3, c, ax, 2.84, .8, .25); F.B(aw + .005, .2, .03, c, ax, 2.58, 1.44); }
  const [a, b] = segs.length ? segs.reduce((p, q) => (q[1] - q[0] > p[1] - p[0] ? q : p)) : [-1, 1], mid = (a + b) / 2;
  if (s.kind === 'flower') for (let i = 0; i < 5; i++) { const bx = a + .4 + i * (b - a - .8) / 4; F.P(cylG(.2, .16, .4, 8), '#64748b', M4(bx, .2, .95)); for (let k = 0; k < 3; k++) F.P(blobG(.13, i + k), ['#f472b6', '#facc15', '#fb7185', '#a78bfa', '#ffffff'][(i + k) % 5], M4(bx + (k - 1) * .1, .5 + (k % 2) * .08, .95)); F.P(blobG(.16, i), '#4c9a45', M4(bx, .44, .95)); }
  else if (s.kind === 'tea' || s.kind === 'bfast') { F.B(.62, .9, .05, '#1f3a2c', mid, .45, .95, -.22, 0, 0, 'wood'); F.B(.62, .9, .05, '#1f3a2c', mid, .45, 1.25, .22, 0, 0, 'wood'); F.P(cylG(.18, .16, .45, 10), '#a0703f', M4(mid + .9, .23, .9), 'wood'); }
  else if (s.kind === 'tofu' || s.kind === 'noodle') [-.6, .6].forEach(k => { const tx = mid + k * Math.max(1, (b - a) / 3); F.P(cylG(.35, .35, .05, 12), '#a0703f', M4(tx, .72, 1.1), 'wood'); F.P(cylG(.05, .07, .7, 6), '#57534e', M4(tx, .35, 1.1)); [-1, 1].forEach(q => F.P(cylG(.15, .13, .42, 8), '#ef4444', M4(tx + q * .55, .21, 1.1))); });
  else if (s.kind === 'pharm') { const px = hw - .15; F.B(.1, .5, .16, '#22c55e', px, 3.62, .55, 0, 0, 0, 'glow'); F.B(.1, .16, .5, '#22c55e', px, 3.62, .55, 0, 0, 0, 'glow'); F.B(.06, .06, .3, '#374151', px, 3.62, .18); }
  else if (s.kind === 'bread' || s.kind === 'book') { F.B(1.4, .7, .6, '#a0703f', mid, .35, 1.0, 0, 0, 0, 'wood'); for (let i = 0; i < 6; i++) F.B(.18, s.kind === 'book' ? .24 : .1, .14, s.kind === 'book' ? ['#ef4444', '#3b82f6', '#22c55e', '#f59e0b', '#a855f7', '#14b8a6'][i] : '#d4a056', mid - .5 + i * .2, .78 + (s.kind === 'book' ? .05 : 0), 1.0); }
  else if (s.kind === 'conv') [-.32, .32].forEach((k, i) => { F.P(cylG(.22, .2, .78, 10), '#6b7280', M4(b - .5 + k, .39, .85)); F.P(cylG(.24, .24, .08, 10), i ? '#2563eb' : '#16a34a', M4(b - .5 + k, .82, .85)); });
  else if (s.kind === 'home') { F.P(cylG(.2, .15, .35, 8), '#b45309', M4(a + .5, .18, .8)); F.P(blobG(.3, 5), '#4c9a45', M4(a + .5, .58, .8)); }
}
// 頂樓設備：不鏽鋼水塔、樓梯間、鴿舍、屋頂花園（棚架＋串燈）、天線、碟形天線、太陽能板、LED 燈條、尖塔、霓虹看板
function cityRoof(list, x, y, z, w, d, face, rd) {
  const A = cAt(), B = A.B, P = A.P;
  list.forEach(k => {
    const ox = x + (rd() - .5) * Math.max(0, w - 4), oz = z + (rd() - .5) * Math.max(0, d - 4);
    if (k === 'tank') { for (let i = 0, n = rd() < .5 ? 2 : 1; i < n; i++) { const tx = ox + (i - (n - 1) / 2) * 1.8; [-1, 1].forEach(a => [-1, 1].forEach(b => B(.08, 1.2, .08, '#6b7280', tx + a * .55, y + .6, oz + b * .55))); B(1.4, .08, 1.4, '#6b7280', tx, y + 1.2, oz); P(cylG(.68, .68, 1.7, 14), '#d9dde3', M4(tx, y + 2.1, oz)); P(cylG(.7, .7, .08, 14), '#b8bec8', M4(tx, y + 2.98, oz)); P(cylG(.72, .72, .06, 14), '#b8bec8', M4(tx, y + 1.6, oz)); } }
    else if (k === 'bulk') { B(3, 2.6, 2.6, '#a8a29e', ox, y + 1.3, oz); B(3.3, .15, 2.9, '#6b7280', ox, y + 2.65, oz); B(.9, 1.9, .06, '#475569', ox, y + .95, oz + face * 1.31); }
    else if (k === 'coop') { B(3.2, 1.8, 2, '#8b6a4e', ox, y + .9, oz, 0, 0, 0, 'wood'); B(3.4, .1, 2.3, '#64748b', ox, y + 1.95, oz, .12); B(3, 1.2, .04, '#374151', ox, y + 1, oz + 1.02); for (let i = 0; i < 6; i++) B(.03, 1.2, .05, '#9ca3af', ox - 1.4 + i * .56, y + 1, oz + 1.04); B(.8, .06, .4, '#8b6a4e', ox + .8, y + .5, oz + 1.2, 0, 0, 0, 'wood'); }
    else if (k === 'garden') {
      for (let i = 0; i < 3; i++) { const gx = x - w * .3 + i * w * .3; B(w * .22, .45, 1, '#8b5a3c', gx, y + .22, z - d * .3, 0, 0, 0, 'wood'); [-1, 0, 1].forEach(j => P(blobG(.45, i + j + 3), ['#4c9440', '#5fae4f', '#3f7f3a'][(i + j + 3) % 3], M4(gx + j * w * .07, y + .75, z - d * .3))); }
      [-1, 1].forEach(a => [-1, 1].forEach(b => B(.12, 2.4, .12, '#8b6a4e', x + a * w * .3, y + 1.2, z + d * .12 + b * 1.3, 0, 0, 0, 'wood'))); [-1, 1].forEach(b => B(w * .64, .12, .12, '#8b6a4e', x, y + 2.4, z + d * .12 + b * 1.3, 0, 0, 0, 'wood'));
      for (let i = 0; i < 7; i++) B(.08, .08, 2.9, '#a07a58', x - w * .3 + i * w * .1, y + 2.48, z + d * .12, 0, 0, 0, 'wood');
      for (let i = 0; i < 12; i++) { const u = i / 11; B(.1, .1, .1, ['#fde68a', '#fbcfe8', '#bae6fd'][i % 3], x - w * .3 + u * w * .6, y + 2.25 - Math.sin(u * Math.PI) * .3, z + d * .12 + 1.3, 0, 0, 0, 'glow'); }
      B(1.6, .45, .55, '#a0703f', x, y + .23, z + d * .12, 0, 0, 0, 'wood');
    }
    else if (k === 'mast') { B(.25, 7, .25, '#94a3b8', x, y + 3.5, z); B(.5, .5, .5, '#ef4444', x, y + 7.2, z, 0, 0, 0, 'glow'); [2, 4, 5.6].forEach(h => B(1.5 - h * .16, .06, .06, '#94a3b8', x, y + h, z)); }
    else if (k === 'dish') { B(.08, 1, .08, '#6b7280', ox, y + .5, oz); P(sphG(.55, 12, 6), '#e5e7eb', M4(ox, y + 1.15, oz, -.75, rd() * 6, 0, 1, .32, 1)); }
    else if (k === 'solar') for (let i = 0; i < 4; i++) { const sx = x - 2.4 + (i % 2) * 2.4, sz = z + (i < 2 ? -1.6 : 1.6); B(2.2, .06, 1.3, '#1e3a8a', sx, y + .75, sz, .45); B(.06, .7, .06, '#6b7280', sx, y + .35, sz + .4); }
    else if (k === 'crown') { [-1, 1].forEach(s => { B(w + .2, .1, .1, '#93c5fd', x, y + .3, z + s * (d / 2 + .1), 0, 0, 0, 'glow'); B(.1, .1, d + .2, '#93c5fd', x + s * (w / 2 + .1), y + .3, z, 0, 0, 0, 'glow'); }); B(w * .6, 1.2, d * .5, '#64748b', x, y + .9, z); }
    else if (k === 'spire') { P(geoC('spire', () => new THREE.ConeGeometry(1, 7, 4)), '#c9b27a', M4(x, y + 3.6, z, 0, Math.PI / 4, 0, w * .32, 1, w * .32)); P(cylG(.08, .08, 4, 5), '#e5d5a5', M4(x, y + 8.5, z)); B(.3, .3, .3, '#fde68a', x, y + 10.6, z, 0, 0, 0, 'glow'); [-1, 1].forEach(s => { B(w * .64, .08, .08, '#fde68a', x, y + .5, z + s * w * .3, 0, 0, 0, 'glow'); B(.08, .08, w * .64, '#fde68a', x + s * w * .3, y + .5, z, 0, 0, 0, 'glow'); }); }
    else if (k === 'board') { // 屋頂的霓虹看板：腳架在看板後面，正面不擋字
      const F = cAt(x, z + face * (d / 2 - 1.4), face > 0 ? 0 : Math.PI); F.S(7.4, 4.2, .2, CZ.sg.neon, 0, y + 3.6, 0, [4]); F.B(7.6, 4.4, .1, '#1f2937', 0, y + 3.6, -.16);
      [-2.8, 0, 2.8].forEach(px => { F.B(.2, 3.6, .2, '#475569', px, y + 1.8, -.4); F.B(.14, .14, 2.4, '#475569', px, y + 1, -1.3, .9); });
    }
  });
}
function buildTowers(g, rd) {
  const TB = Object.fromEntries(FSTY.map(k => [k, []])), T = o => cityBldg(TB, Object.assign({ rd }, o)), V = CZ.sg.v, H = CZ.sg.h, I = CZ.sg.i;
  // 路北側與商店齊平的兩棟：西＝紅磚（藥局、牙醫、逃生梯）、東＝磁磚公寓（珍奶店、卡拉OK、鐵窗、鴿舍）
  T({ x: -46.5, z: -21, w: 12, d: 14, fl: 7, sty: 'brick', near: 1, vis: ['s', 'w'], fire: 'w', solid: 1, vs: [V.dent, V.cram], shop: { sign: H.pharm, int: I.pharm, aw: ['#16a34a', '#f0fdf4'], kind: 'pharm' }, roof: ['tank', 'bulk', 'dish'] });
  T({ x: 46.5, z: -21, w: 12, d: 14, fl: 8, sty: 'tile', col: '#fff7ed', near: 1, vis: ['s', 'e'], solid: 1, vs: [V.tea, V.ktv], shop: { sign: H.tea, int: I.tea, aw: ['#f59e0b', '#fffbeb'], kind: 'tea' }, roof: ['tank', 'coop'] });
  // 街角：東＝便利商店（自動門在 buildCityFx）、西＝小芸花店與陳記豆花兩間透天厝
  T({ x: 60, z: -20, w: 12, d: 12, fl: 4, sty: 'tile', col: '#eef2ff', near: 1, vis: ['s', 'e', 'w'], solid: 1, vs: [V.glass, V.wash], shop: { sign: H.conv, int: I.conv, aw: ['#2563eb', '#f8fafc'], kind: 'conv', door: 0, auto: 1, band: '#1d4ed8' }, roof: ['tank', 'dish'] });
  T({ x: -63, z: -20, w: 6, d: 12, fl: 3, sty: 'plaster', col: '#fde2e4', near: 1, vis: ['s', 'w'], solid: 1, vs: [V.salon], shop: { sign: H.flower, int: I.flower, aw: ['#ec4899', '#fdf2f8'], kind: 'flower', door: 1.5 }, roof: ['garden'] });
  T({ x: -57, z: -20, w: 6, d: 12, fl: 2, sty: 'plaster', col: '#dcfce7', near: 1, vis: ['s'], solid: 1, shop: { sign: H.tofu, int: I.noodle, aw: ['#a16207', '#fef3c7'], kind: 'tofu', door: -1.5 }, roof: ['tank'] });
  // 北側高樓群（在商店後面，從街上看得到上半段與屋頂）
  const NS = ['glass', 'deco', 'panel', 'glass', 'ribbon', 'deco', 'glass', 'panel', 'brick', 'glass'], NC = ['#ffffff', '#f1f5f9', '#e8f0ff', '#fffdf5', '#f5f3ff'];
  for (let i = 0; i < 10; i++) T({ x: -58.5 + i * 13 + rd() * 1.5, z: -42 - rd() * 8, w: 12, d: rd() < .5 ? 12 : 15, fl: 7 + Math.floor(rd() * 8), sty: NS[i], col: rpk(rd, NC), roof: i === 2 ? ['board', 'solar'] : i === 4 ? ['garden', 'mast'] : null });
  // 廣場南側一整排透天厝（騎樓店面、鐵窗、冷氣、直立招牌）：在可走範圍外 3 公尺，站在廣場上看得清楚。鐘塔與公告欄正後方的兩間不掛直立招牌
  const SR = [[9, 3, 'plaster', '#fef3c7', 'bread', 'bread', ['#c2410c', '#fff7ed'], V.bread], [6, 4, 'tile', '#ffffff', null, 'home', ['#0f766e', '#f0fdfa'], V.wash], [9, 4, 'brick', '#ffffff', 'noodle', 'noodle', ['#991b1b', '#fef2f2'], V.beef],
    [9, 3, 'plaster', '#fde2e4', 'dessert', 'cafe', ['#db2777', '#fdf2f8'], V.class], [6, 5, 'tile', '#f5f5f4', null, 'home', ['#475569', '#f8fafc'], V.cram], [12, 4, 'ribbon', '#ffffff', 'book', 'book', ['#1d4ed8', '#eff6ff'], V.book],
    [9, 3, 'plaster', '#dcfce7', 'salon', 'home', ['#7c3aed', '#faf5ff'], V.salon], [9, 4, 'tile', '#fef9ef', 'bfast', 'cafe', ['#ea580c', '#fff7ed'], null], [9, 3, 'plaster', '#e0f2fe', null, 'home', ['#0369a1', '#f0f9ff'], null],
    [6, 4, 'tile', '#ffffff', 'wash', 'home', ['#0891b2', '#ecfeff'], V.wash], [9, 3, 'brick', '#f5ebe6', 'tofu', 'noodle', ['#a16207', '#fef3c7'], V.bfast], [9, 4, 'plaster', '#ede9fe', 'tea', 'tea', ['#f59e0b', '#fffbeb'], V.tea],
    [6, 5, 'tile', '#fffbeb', null, 'home', ['#64748b', '#f8fafc'], V.dent], [12, 4, 'ribbon', '#f8fafc', 'pharm', 'pharm', ['#16a34a', '#f0fdf4'], V.pharm], [9, 3, 'plaster', '#fef3c7', 'flower', 'flower', ['#ec4899', '#fdf2f8'], V.fried]];
  let sx = -66; SR.forEach(([w, fl, sty, col, sign, int, aw, vsg]) => { const x = sx + w / 2; T({ x, z: 51, w, d: 8, fl, sty, col, face: -1, near: 1, vs: vsg ? [vsg] : null, shop: { sign: sign && H[sign], int: I[int], aw, kind: sign || int } }); sx += w; });
  // 南側後排的高樓（被透天厝擋住下半段，只看得到上面）
  for (let i = 0; i < 10; i++) T({ x: -58.5 + i * 13 + rd() * 1.5, z: 64, w: 12, d: 12, fl: 5 + Math.floor(rd() * 6), sty: ['brick', 'ribbon', 'panel', 'tile', 'deco', 'ribbon', 'brick', 'panel', 'tile', 'brick'][i], col: rpk(rd, NC), face: -1 });
  // 大街往東西兩端延伸出去的樓（走不到，讓街道看起來一直延伸到遠方）；最靠近的那兩棟有完整店面
  [-1, 1].forEach(s => [0, 1, 2].forEach(i => {
    const x = s * (76.5 + i * 13), near = i === 0, st = () => rpk(rd, ['brick', 'tile', 'plaster', 'panel', 'ribbon']), cl = () => rpk(rd, ['#ffffff', '#fde2e4', '#e0f2fe', '#fef3c7', '#ecfccb']);
    // 西端 x＝−89.5、−102.5 這四棟在月光隧道的小山裡：照樣建（cityBldg 裡面會吃 rd，跳過整棟會讓後面的遠景環、街道家具全部換樣子），建完再把它們丟進清單的零件截掉
    const cut = s < 0 && i > 0 ? { tb: FSTY.map(k => TB[k].length), cz: CZ_L.map(k => CZ[k].length) } : null;
    T({ x, z: -21, w: 12, d: 14, fl: 4 + Math.floor(rd() * 7), sty: st(), col: cl(), near, vs: near ? [s > 0 ? V.game : V.inn] : null, shop: near ? { sign: s > 0 ? H.book : H.noodle, int: s > 0 ? I.book : I.noodle, aw: ['#334155', '#f1f5f9'], kind: s > 0 ? 'book' : 'noodle' } : null });
    T({ x, z: 21, w: 12, d: 14, fl: 3 + Math.floor(rd() * 6), sty: st(), col: cl(), face: -1, near, vs: near ? [s > 0 ? V.beef : V.fried] : null, shop: near ? { sign: s > 0 ? H.dessert : H.salon, int: s > 0 ? I.cafe : I.home, aw: ['#be185d', '#fdf2f8'], kind: s > 0 ? 'dessert' : 'home' } : null });
    if (cut) { FSTY.forEach((k, j) => TB[k].splice(cut.tb[j]).forEach(geo => geo.dispose())); CZ_L.forEach((k, j) => { CZ[k].length = cut.cz[j]; }); }
  }));
  FSTY.forEach(k => {
    if (!TB[k].length) return; const t = facadeTex(k), m = new THREE.MeshStandardMaterial({ map: t.map, emissive: '#ffffff', emissiveMap: t.emi, emissiveIntensity: .12, roughness: k === 'glass' ? .25 : .85, metalness: k === 'glass' ? .35 : 0, vertexColors: true });
    (W.cityWin = W.cityWin || []).push(m); const me = mesh(mergeUV(TB[k], true), m, 0, 0, 0, g); me.castShadow = !LOW; me.receiveShadow = true;
  });
}
/* 每間店有自己的門面（不重複）：機械行＝工業風浪板＋捲門＋警示條＋齒輪招牌；生活百貨＝白色柱廊（柱子只到一樓，不擋招牌）＋玻璃帷幕＋旋轉門；
   器材行＝深紫牆面＋粉紅／青色霓虹燈條＋直播螢幕＋喇叭；醫院＝白牆＋藍綠色腰帶＋入口雨遮＋自動門；武器店＝石砌底座＋木構架＋盾牌與雙劍。
   零件都丟進城市的合併清單（細節頂點色、霓虹進夜燈、玻璃進玻璃）。正面在 z = -14 */
// open＝一樓是店頭（四間店）：不放一樓的門、窗、捲門與旋轉門，門楣以上（招牌帶、店名、二樓）全部保留
function shopFront(id, x, w, g, open) {
  const F = -14, A = cAt(), B = A.B, D = (geo, c, m) => A.P(geo, c, m), pane = (pw, ph, px, py, pz = F + .03) => A.Q(pw, ph, px, py, pz);
  const L = x - w / 2, Rr = x + w / 2;
  if (id === 'mach') {
    for (let xx = L + .25; xx < Rr; xx += .5) B(.14, 3.6, .14, '#5b6470', xx, 6, F + .05); // 浪板
    if (open) B(w, .35, .3, '#4b5563', x, 3.78, F + .15); // 捲門拉起來了：收納盒改成全寬
    else { B(w * .56, 3.5, .1, '#a3a9b2', x - w * .18, 1.75, F + .05); for (let yy = .25; yy < 3.5; yy += .28) B(w * .56, .04, .14, '#7b818a', x - w * .18, yy, F + .07); // 捲門
      B(w * .56 + .3, .35, .3, '#4b5563', x - w * .18, 3.6, F + .15); pane(w * .26, 2.2, x + w * .32, 1.9); B(w * .26 + .2, .12, .2, '#4b5563', x + w * .32, .75, F + .1); }
    for (let i = 0, n = Math.round(w / .5); i < n; i++) B(.5, .32, .08, i % 2 ? '#facc15' : '#111827', L + .25 + i * .5, 3.95, F + (open ? .34 : .06)); // 黑黃警示條（店頭：當門楣，貼在收納盒前面）
    B(w + .4, .5, 12.4, '#2b3038', x, 8.2, -20);
    { const gx = Rr - 1.3, gy = 9.4, gz = F + .4; D(new THREE.TorusGeometry(.75, .22, 6, 18), '#22d3ee', M4(gx, gy, gz)); for (let i = 0; i < 8; i++) { const a = i / 8 * PI2; B(.3, .3, .3, '#22d3ee', gx + Math.cos(a) * 1.02, gy + Math.sin(a) * 1.02, gz, 0, 0, a); } B(.4, 1.5, .4, '#2b3038', gx, 8.6, gz); }
  } else if (id === 'mall') {
    if (!open) pane(w - 1, 3.4, x, 1.85); pane(w - 1, 1.1, x, 7.25);
    for (let i = 0; i < 5; i++) B(.55, 3.65, .5, '#ffffff', L + .3 + i * (w - .6) / 4, 1.83, F + .25); // 柱廊（只到一樓）
    B(w + .3, .4, .5, '#10b981', x, 3.85, F + .25); B(w + .6, .55, 12.6, '#10b981', x, 8.25, -20); B(w + .3, .12, .55, '#ffffff', x, 4.12, F + .25);
    [-1, 1].forEach(s => B(.4, 3.6, .3, '#ffffff', x + s * (w / 2 - .2), 6.1, F + .15)); // 二樓兩側的壁柱（在招牌外側）
    if (!open) { D(new THREE.CylinderGeometry(1.05, 1.05, .2, 18), '#e5e7eb', M4(x, 2.75, F + 1)); B(.08, 2.6, 2, '#94a3b8', x, 1.3, F + 1, 0, .6, 0); B(.08, 2.6, 2, '#94a3b8', x, 1.3, F + 1, 0, -.97, 0); // 旋轉門（店頭沒有門，人從柱間走進去）
      mesh(new THREE.CylinderGeometry(1, 1, 2.6, 18, 1, true), new THREE.MeshStandardMaterial({ color: '#bfe3f5', transparent: true, opacity: .35, roughness: .05, side: THREE.DoubleSide }), x, 1.3, F + 1, g); }
    [-1, 1].forEach(s => { B(1.2, .7, .8, '#a8a29e', x + s * (w / 2 - 1.2), .35, F + 1); D(blobG(.6, 7 + s), '#4c9a45', M4(x + s * (w / 2 - 1.2), 1.1, F + 1)); });
  } else if (id === 'gear') {
    if (!open) { pane(w * .42, 2.8, x - w * .24, 1.9); B(1.4, 2.7, .1, '#0f0d1f', x + .15, 1.35, F + .05); }
    const neon = (c, sx, sy, px, py, rz = 0) => B(sx, sy, .08, c, px, py, F + .12, 0, 0, rz, 'glow');
    neon('#e879f9', .12, 7.6, L + .15, 4); neon('#e879f9', .12, 7.6, Rr - .15, 4); neon('#22d3ee', w, .1, x, 7.85); neon('#22d3ee', w, .1, x, 4.15);
    for (let i = 0; i < 6; i++) neon(i % 2 ? '#22d3ee' : '#e879f9', 1.1, .08, L + .9 + i * (w - 1.8) / 5.5, 3.85, i % 2 ? .35 : -.35);
    if (open) { A.S(2.6, 1.75, 0, CZ.sg.live, x + w / 2 - 2.1, 2.55, F - SHOP_D + .09); B(2.85, 2, .06, '#0b0a14', x + w / 2 - 2.1, 2.55, F - SHOP_D + .04); } // 直播螢幕搬到店內後牆（店員身後）
    else { A.S(w * .26, 2.1, 0, CZ.sg.live, x + w * .28, 2.05, F + .08); B(w * .26 + .25, 2.35, .1, '#0b0a14', x + w * .28, 2.05, F + .04); } // 直播螢幕（喇叭在螢幕外側）
    [-1, 1].forEach(s => { const sx = s < 0 ? L + .75 : Rr - .5; B(.7, 1.5, .6, '#111018', sx, .75, F + .5); D(new THREE.CylinderGeometry(.22, .22, .05, 14), '#3f3f46', M4(sx, 1.05, F + .81, Math.PI / 2)); D(new THREE.CylinderGeometry(.14, .14, .05, 12), '#3f3f46', M4(sx, .5, F + .81, Math.PI / 2)); });
    B(w + .4, .5, 12.4, '#15122b', x, 8.2, -20);
  } else if (id === 'hospital') {
    B(w + .2, .45, .15, '#14b8a6', x, 4.15, F + .08); B(w + .2, .12, .15, '#14b8a6', x, 4.5, F + .08);
    pane(2.6, 2.6, x, 1.3); B(.12, 2.8, .14, '#94a3b8', x, 1.4, F + .08); B(2.9, .14, .14, '#94a3b8', x, 2.7, F + .08);
    [-1, 1].forEach(s => { pane(w * .22, 1.6, x + s * w * .3, 2); pane(w * .26, 1.1, x + s * w * .3, 7.3); B(w * .26 + .2, .1, .2, '#cbd5e1', x + s * w * .3, 6.7, F + .1); });
    B(w * .62, .25, 3.4, '#e2e8f0', x, 3.55, F + 1.7); B(w * .62, .2, .08, '#14b8a6', x, 3.55, F + 3.4); [-1, 1].forEach(s => B(.2, 3.45, .2, '#cbd5e1', x + s * w * .29, 1.72, F + 3.2));
    B(w + .4, .5, 12.4, '#e2e8f0', x, 8.2, -20);
    B(.45, 1.3, .25, '#ef4444', x, 7.35, F + .1, 0, 0, 0, 'glow'); B(1.3, .45, .25, '#ef4444', x, 7.35, F + .1, 0, 0, 0, 'glow');
  } else if (id === 'arms') {
    if (open) { B(w + .3, 3.6, 7.5, '#8b8580', x, 1.8, -22.35); [-1, 1].forEach(s => { B(.4, 3.6, 4.7, '#8b8580', x + s * (w / 2 - .05), 1.8, F - 2.25); for (let yy = .55; yy < 3.6; yy += .6) B(.42, .05, .1, '#6b6560', x + s * (w / 2 - .05), yy, F + .11); }); } // 石砌底座只做在後段與兩側（中間是店頭）
    else { B(w + .3, 3.6, 12.3, '#8b8580', x, 1.8, -20); for (let yy = .55; yy < 3.6; yy += .6) B(w + .32, .05, .1, '#6b6560', x, yy, F + .1); for (let i = 0; i < 18; i++) B(.05, .55, .1, '#6b6560', L + .4 + ((i * 1.37) % (w - .8)), .3 + (i % 6) * .6, F + .11); }
    for (let i = 0; i <= 4; i++) B(.28, 4.4, .2, '#4a2f1d', L + .15 + i * (w - .3) / 4, 5.8, F + .1);
    B(w + .2, .3, .22, '#4a2f1d', x, 3.75, F + .1); B(w + .2, .3, .22, '#4a2f1d', x, 7.95, F + .1);
    for (let i = 0; i < 4; i++) { const cx = L + .15 + (i + .5) * (w - .3) / 4, s = i % 2 ? 1 : -1; B(.2, 2.6, .18, '#4a2f1d', cx, 6.9, F + .09, 0, 0, s * .62); }
    if (!open) { B(1.9, 3, .3, '#9a948e', x, 1.5, F + .12); B(1.5, 2.7, .12, '#6b3f22', x, 1.35, F + .2); for (let i = 0; i < 3; i++) for (let j = 0; j < 4; j++) B(.07, .07, .06, '#27272a', x - .45 + i * .45, .5 + j * .6, F + .27);
      pane(2, 1.5, x - w * .3, 2); for (let i = 1; i < 4; i++) B(.05, 1.5, .08, '#27272a', x - w * .3 - 1 + i * .5, 2, F + .08); B(2, .05, .08, '#27272a', x - w * .3, 2, F + .08);
      B(2.4, .12, .9, '#5b3a22', x - w * .3, 3.05, F + .45, -.35); }
    { const sx = open ? x + w / 2 - 2.1 : x + w * .3, sy = open ? 2.55 : 2.1, sz = open ? F - SHOP_D + .12 : F + .3; // 盾牌與雙劍：店頭搬到店內後牆（店員身後） D(new THREE.CylinderGeometry(.85, .85, .14, 20), '#991b1b', M4(sx, sy, sz, Math.PI / 2)); D(new THREE.TorusGeometry(.85, .07, 6, 24), '#d4af37', M4(sx, sy, sz + .05));
      [-.75, .75].forEach(a => { B(.1, 2.2, .05, '#e5e7eb', sx, sy, sz + .12, 0, 0, a); B(.5, .1, .08, '#d4af37', sx - Math.sin(a) * -.75, sy - Math.cos(a) * .75, sz + .14, 0, 0, a); }); }
    [-1, 1].forEach(s => B(.25, .35, .25, '#fbbf24', x + s * (open ? w / 2 - .9 : 1.3), open ? 3.9 : 3.2, F + .35, 0, 0, 0, 'glow')); // 兩盞金燈（店頭：移到門楣）
    B(w + .6, .5, 12.6, '#5b3a22', x, 8.25, -20);
  }
}
/* ---------- 店頭：店內、商品、吊牌、店員的位置（第 6 節） ----------
   店內的零件全部進 CZ.shopIn（一個網格、頂點色自發光，不收陰影、不投影、不加光源：白天明亮，晚上整間店像一個暖色的小盒子）；
   發光的燈管、霓虹、炭火進既有的 CZ.glow；吊牌是另一張圖集 TAG（CZ.tag，一個網格）。被拿走時展示品留在架上，只拿走吊牌與一個縮小樣品 */
function shopInMat() {
  const m = new THREE.MeshStandardMaterial({ vertexColors: true, emissive: '#ffffff', emissiveIntensity: .3, roughness: .8, metalness: 0 });
  m.onBeforeCompile = sh => { sh.fragmentShader = sh.fragmentShader.replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\ntotalEmissiveRadiance *= vColor;'); };
  m.customProgramCacheKey = () => 'cityGlow'; return m; // 跟夜燈同一支著色器（只差亮度）
}
// 商品外觀：[幾何, 顏色, 矩陣, 發光] 清單，原點在底面中心、正面朝 +z。店裡逐件放進 CZ；手上的縮小模型用同一份清單合併一次（wareMini）
function wareParts(id) {
  const A = [], B = (w, h, d, c, x, y, z, rx = 0, ry = 0, rz = 0, gl = 0) => A.push([UBOX, c, M4(x, y, z, rx, ry, rz, w, h, d), gl]), Pg = (geo, c, m, gl = 0) => A.push([geo, c, m, gl]);
  const pallet = () => { for (let i = 0; i < 4; i++) B(.95, .04, .2, '#b08a5e', 0, .1, -.36 + i * .24); [-.4, 0, .4].forEach(x => B(.1, .08, .95, '#8a6a46', x, .04, 0)); };
  const kit = c => [0, 1].forEach(i => { const y = .11 + i * .22, r = i * .25; B(.32, .22, .24, '#c8a878', 0, y, 0, 0, r, 0); B(.33, .05, .25, c, 0, y + .03, 0, 0, r, 0); B(.04, .225, .245, '#a07c4e', 0, y, 0, 0, r, 0); });
  const [t, k] = id.split(':');
  if (id === 'own:slicer') { pallet(); B(.62, .42, .5, '#9ca3af', 0, .33, 0); B(.66, .05, .54, '#6b7280', 0, .56, 0); Pg(cylG(.12, .2, .24, 8), '#22d3ee', M4(-.14, .7, 0)); Pg(cylG(.2, .2, .03, 18), '#e5e7eb', M4(.15, .74, .04, Math.PI / 2, 0, -.5)); Pg(cylG(.05, .05, .04, 8), '#475569', M4(.15, .74, .07, Math.PI / 2)); B(.05, .05, .02, '#22d3ee', .2, .42, .26, 0, 0, 0, 1); }
  else if (id === 'own:coater') { pallet(); [-.3, .3].forEach(x => B(.06, .42, .3, '#6b7280', x, .33, 0)); Pg(cylG(.22, .22, .62, 16), '#f97316', M4(0, .56, 0, 0, 0, Math.PI / 2)); [-.32, .32].forEach(x => Pg(cylG(.18, .18, .03, 14), '#7c2d12', M4(x, .56, 0, 0, 0, Math.PI / 2))); for (let i = 0; i < 7; i++) B(.04, .03, .04, '#ffffff', -.24 + i * .08, .785, (i % 3 - 1) * .05); }
  else if (id === 'own:dryer') { pallet(); B(.6, .56, .5, '#f59e0b', 0, .4, 0); B(.64, .05, .54, '#b45309', 0, .7, 0); B(.3, .2, .02, '#fde047', -.08, .44, .255, 0, 0, 0, 1); B(.36, .26, .015, '#7c2d12', -.08, .44, .25); Pg(cylG(.05, .05, .04, 10), '#e5e7eb', M4(.2, .46, .27, Math.PI / 2)); }
  else if (id === 'own:decor') { B(.8, .05, .5, '#f8fafc', 0, .62, 0); [[-1, -1], [-1, 1], [1, -1], [1, 1]].forEach(([a, b]) => B(.04, .6, .04, '#e2e8f0', a * .36, .3, b * .21)); ['#e879f9', '#38bdf8', '#fbbf24'].forEach((c, i) => Pg(geoC('w:oct', () => new THREE.OctahedronGeometry(.07)), c, M4(-.22 + i * .22, .72, 0, 0, i, 0))); }
  else if (id === 'own:live') { [0, 1, 2].forEach(i => { const a = i / 3 * PI2; Pg(cylG(.015, .015, .95, 5), '#1f2937', M4(Math.sin(a) * .16, .45, Math.cos(a) * .16, Math.cos(a) * .3, 0, -Math.sin(a) * .3)); }); Pg(cylG(.018, .018, .5, 6), '#1f2937', M4(0, 1.05, 0)); Pg(geoC('w:ring', () => new THREE.TorusGeometry(.2, .025, 6, 20)), '#f472b6', M4(0, 1.32, 0), 1); B(.07, .13, .015, '#0f172a', 0, 1.32, .01); }
  else if (t === 'up' && UPS[k] && UPS[k].mach) kit({ slicer: '#22d3ee', coater: '#f97316', dryer: '#facc15' }[k]);
  else if (id === 'up:gear') { kit('#e879f9'); Pg(cylG(.06, .09, .12, 10), '#1f2937', M4(.0, .52, 0, -.5)); B(.08, .03, .02, '#fde68a', 0, .55, .06, 0, 0, 0, 1); }
  else if (id === 'up:cap') { [[-1, -1], [-1, 1], [1, -1], [1, 1]].forEach(([a, b]) => B(.02, .5, .02, '#64748b', a * .18, .25, b * .11)); [.08, .3].forEach(y => B(.38, .015, .24, '#94a3b8', 0, y, 0)); B(.22, .16, .18, '#c8a878', 0, .39, 0); B(.18, .12, .14, '#d6b48a', -.04, .15, 0); }
  else if (id === 'up:shelf') { B(.26, .44, .24, '#1f2937', 0, .22, 0); [0, 1, 2].forEach(i => B(.2, .025, .01, '#22d3ee', 0, .32 - i * .1, .125, 0, 0, 0, 1)); B(.03, .03, .01, '#4ade80', .09, .4, .125, 0, 0, 0, 1); }
  else if (id === 'up:farm') { B(.44, .06, .3, '#64748b', 0, .03, 0); B(.42, .2, .28, '#bae6fd', 0, .16, 0); Pg(blobG(.11, 3), '#4ade80', M4(0, .3, 0, 0, 0, 0, 1.2, .75, 1)); Pg(blobG(.06, 5), '#86efac', M4(.12, .27, .05)); }
  else if (id === 'up:boots') { B(.34, .13, .21, '#f9a8d4', 0, .065, 0); B(.35, .02, .22, '#ec4899', 0, .135, 0); B(.24, .07, .1, '#ffffff', 0, .18, .02, 0, .15, 0); B(.1, .05, .1, '#ffffff', -.08, .23, .01, 0, .15, 0); B(.25, .015, .105, '#22d3ee', 0, .155, .02, 0, .15, 0); }
  else if (id === 'up:net') { B(.3, .3, .24, '#bae6fd', 0, .15, 0); B(.32, .02, .26, '#e0f2fe', 0, .31, 0); B(.12, .05, .08, '#334155', 0, .345, 0); Pg(cylG(.02, .026, .04, 8), '#94a3b8', M4(0, .38, -.01)); [0, 1, 2].forEach(i => B(.012, .01, .012, '#22d3ee', -.03 + i * .03, .372, .03, 0, 0, 0, 1)); }
  else if (t === 'pack') { const cs = Object.values(DECO).filter(d => d.pack === k).map(d => d.c), c0 = cs[0] || '#cbd5e1'; Pg(geoC('w:bag', () => new THREE.SphereGeometry(.13, 12, 8)), c0, M4(0, .12, 0, 0, 0, 0, 1, .95, .85)); Pg(cylG(.05, .08, .07, 8), c0, M4(0, .25, 0)); B(.14, .015, .015, '#78350f', 0, .245, .04); cs.forEach((c, i) => Pg(sphG(.032, 8, 6), c, M4(-.04 + i * .04, .3 + (i % 2) * .02, 0), DECO[Object.keys(DECO).find(x => DECO[x].c === c)].glow ? 1 : 0)); }
  else if (id === 'own:coat') { Pg(cylG(.18, .18, .03, 14), '#44403c', M4(0, .015, 0)); Pg(cylG(.02, .02, .8, 5), '#57534e', M4(0, .4, 0)); Pg(cylG(.22, .2, .64, 12), '#d9733f', M4(0, 1.08, 0)); for (let i = 0; i < 4; i++) Pg(cylG(.225, .225, .015, 12), '#b45309', M4(0, .84 + i * .15, 0)); [-1, 1].forEach(s => Pg(cylG(.06, .07, .5, 8), '#d9733f', M4(s * .26, 1.06, 0, 0, 0, s * .18))); Pg(geoC('w:scarf', () => new THREE.TorusGeometry(.12, .045, 6, 14)), '#fde68a', M4(0, 1.42, 0, Math.PI / 2)); B(.06, .22, .03, '#fde68a', .08, 1.28, .14, 0, 0, -.2); Pg(sphG(.12, 10, 8), '#e7e5e4', M4(0, 1.58, 0)); }
  else if (id === 'own:sword') { B(.9, .045, .012, '#e5e7eb', .1, 0, 0); B(.04, .2, .04, '#d4af37', -.37, 0, 0); Pg(cylG(.018, .018, .2, 6), '#5b3a22', M4(-.49, 0, 0, 0, 0, Math.PI / 2)); Pg(sphG(.03, 6, 4), '#d4af37', M4(-.6, 0, 0)); B(.06, .04, .04, '#5b3a22', -.25, -.05, -.04); B(.06, .04, .04, '#5b3a22', .35, -.05, -.04); }
  return A;
}
// 手上的縮小模型：同一份零件清單合併一次、置中（依 id 快取）
const MINI = {};
function wareMini(id) {
  if (MINI[id]) return MINI[id];
  const geo = mergeParts(wareParts(id).map(([g, c, m]) => [g, c, m])); geo.computeBoundingBox(); const bb = geo.boundingBox, c = bb.getCenter(new THREE.Vector3()), sz = bb.getSize(new THREE.Vector3());
  geo.translate(-c.x, -c.y, -c.z); return MINI[id] = { geo, r: Math.max(Math.hypot(sz.x, sz.z), sz.y) }; // r：轉一圈時最寬的地方（水平對角線）
}
const wareShop = id => SHOP_IDS.find(s => { const h = SHOPS[s]; return h.big.includes(id) || h.shelf.includes(id) || h.desk.includes(id); });
// 店頭的碰撞（城市座標＝CITY＋本地，z＝−14＋本地 z）：後段、兩側牆、櫃台（人走不到櫃台後面）、西牆棧板、層架、生活百貨的柱廊
function shopCols(id) {
  const sh = SHOPS[id], L = sh.x - sh.w / 2, R = sh.x + sh.w / 2, C = (x0, z0, x1, z1) => addCol({ box: [CITY.x + x0, CITY.z + z0, CITY.x + x1, CITY.z + z1] });
  C(L, -26, R, -18.6); C(L, -18.6, L + .3, -14); C(R - .3, -18.6, R, -14);
  C(R - 4.1, -17.0, R - .3, -16.4); C(R - 4.1, -18.6, R - 3.95, -17.0);
  C(L + .3, -18.3, L + 1.8, -14.7); C(L + 2.2, -18.6, R - 4.3, -18.1);
  if (id === 'mall') for (let i = 0; i < 5; i++) addCol({ x: CITY.x + L + .3 + i * (sh.w - .6) / 4, z: CITY.z - 13.75, r: .3 });
}
function buildShopRoom(id, g) {
  const sh = SHOPS[id], w = sh.w, hw = w / 2, D = SHOP_D, H = SHOP_H, T = cAt(sh.x, -14), m0 = M4(sh.x, 0, -14);
  const B = (bw, bh, bd, c, px, py, pz, rx = 0, ry = 0, rz = 0, L = 'shopIn') => T.B(bw, bh, bd, c, px, py, pz, rx, ry, rz, L);
  // 地板、天花板、後牆、兩側內牆（比大樓的面往內一點，不會閃）；天花板兩支日光燈管
  B(w - .6, .02, D, sh.floor, 0, .012, -D / 2); B(w - .6, .02, D, id === 'gear' ? '#1b1530' : '#f5f5f4', 0, H - .012, -D / 2); B(w - .6, H, .02, sh.wall, 0, H / 2, -D + .012);
  [-1, 1].forEach(s => B(.02, H, D, sh.wall, s * (hw - .312), H / 2, -D / 2)); [-1, 1].forEach(s => B(w * .3, .05, .09, '#fff6dc', s * w * .2, H - .06, -D / 2, 0, 0, 0, 'glow'));
  // 後牆層架（三層）＋櫃台＋收銀機與托盤＋結帳墊
  const s0 = -hw + 2.2, s1 = hw - 4.3, sc = (s0 + s1) / 2, sw = s1 - s0, wood = id === 'gear' ? '#2b2440' : id === 'mall' ? '#e2e8f0' : '#8a6a46';
  if (id === 'arms') { B(sw, .08, .2, '#6b4529', sc, 1.15, -4.5); [-1.2, 1.2].forEach(x => B(.08, .18, .16, '#5b3a22', sc + x, 1.22, -4.48)); } // 武器店：牆上木架橫放長劍
  else { [.65, 1.25, 1.85].forEach(y => B(sw, .04, .45, wood, sc, y, -4.3)); [s0, s1].forEach(x => B(.05, 2.05, .45, wood, x, 1.02, -4.3)); B(sw, 2, .02, wood, sc, 1.02, -4.53); }
  const c0 = hw - 4.1, c1 = hw - .3, cc = (c0 + c1) / 2, cw = c1 - c0;
  B(cw, .96, .6, sh.ctr, cc, .48, -2.7); B(cw + .06, .05, .66, sh.top, cc, .985, -2.7); B(.15, 1.0, 1.6, sh.ctr, c0 + .075, .5, -3.8);
  if (sh.band) B(cw + .02, .12, .62, sh.band, cc, .74, -2.7); if (sh.neon) B(cw, .03, .03, sh.neon, cc, 1.0, -2.385, 0, 0, 0, 'glow');
  B(.42, .2, .34, sh.reg, hw - .95, 1.11, -2.82); B(.3, .1, .03, '#0f172a', hw - .95, 1.26, -2.92, -.4); B(.28, .02, .2, '#d6d3d1', hw - .95, 1.02, -2.5); B(.6, .012, .4, '#3f6212', hw - 2.1, 1.016, -2.62);
  if (id === 'mach') { B(w - .7, .014, .12, '#facc15', 0, .026, -.12); for (let x = -hw + .6; x < hw - .4; x += .5) B(.2, .016, .12, '#111827', x, .027, -.12, 0, .5, 0); }
  if (id === 'arms') { B(.5, .3, .26, '#3f3f46', hw - 2.4, 1.15, -4.2); B(.3, .4, .2, '#27272a', hw - 2.4, .82, -4.2); B(.6, .1, .4, '#57534e', hw - 3.3, .35, -4.25); B(.4, .08, .3, '#f97316', hw - 3.3, .43, -4.25, 0, 0, 0, 'glow'); } // 鐵砧＋炭火
  // 商品：西牆三件大東西（棧板／立架，面向店內）、層架、櫃台；每件旁邊一張吊牌
  const put = (wid, px, py, pz, ry) => { const m = M4(px, py, pz, 0, ry, 0); wareParts(wid).forEach(([geo, c, mm, gl]) => T.P(geo, c, m.clone().multiply(mm), gl ? 'glow' : 'shopIn')); };
  const tag = (wid, px, py, pz, ry, rx, tw, th) => {
    const geo = tagUV(UPLN.clone(), tagCell(wid).uv), mm = m0.clone().multiply(M4(px, py, pz, rx, ry, 0, tw, th, 1)); CZ.tag.push(geo.applyMatrix4(mm));
    const p = new THREE.Vector3(), q = new THREE.Quaternion(), s = new THREE.Vector3(); mm.decompose(p, q, s); p.x += CITY.x; p.z += CITY.z; return { p, q, w: tw };
  };
  const inter = (wid, bw, bh, bd, cx, cy, cz, tg) => { const [t, k] = wid.split(':'), it = addInter(hitBox(bw, bh, bd, sh.x + cx, cy, -14 + cz, g), 'ware', 'ware:' + wid, (t === 'own' ? OWN[k] : t === 'up' ? UPS[k] : PACKS[k]).name, { shop: id, wid, t, k, tag: tg }); (W.wareIt = W.wareIt || []).push(it); return it; };
  const nx = Math.sin(1.309), nz = Math.cos(1.309); // 吊牌的法線（面向店內、朝門口偏 15°）
  sh.big.forEach((wid, i) => { const z = -1.2 - 1.3 * i, tx = -hw + 2.05; put(wid, -hw + 1.15, 0, z, Math.PI / 2); B(.04, 1.02, .04, '#6b4d33', tx - nx * .03, .51, z - nz * .03); B(.38, .26, .02, '#8a6a46', tx - nx * .012, 1.15, z - nz * .012, 0, 1.309, 0);
    inter(wid, 1.55, 1.5, 1.1, -hw + 1.45, .75, z, tag(wid, tx, 1.15, z, 1.309, 0, .34, .22)); });
  sh.shelf.forEach((wid, i) => { const x = id === 'arms' ? sc : -hw + 3 + i, y = id === 'arms' ? 1.32 : 1.27; put(wid, x, y, id === 'arms' ? -4.47 : -4.3, 0);
    inter(wid, id === 'arms' ? 1.3 : .8, .62, .6, x, id === 'arms' ? 1.25 : 1.22, -4.25, tag(wid, id === 'arms' ? x + .78 : x, id === 'arms' ? 1.15 : 1.12, id === 'arms' ? -4.38 : -4.04, 0, id === 'arms' ? 0 : -.22, .27, .17)); });
  sh.desk.forEach(wid => { const x = hw - 3.6; put(wid, x, 1.01, -2.72, 0); inter(wid, .6, .5, .5, x, 1.22, -2.7, tag(wid, x, 1.12, -2.39, 0, -.12, .27, .17)); });
  W.counterIt = W.counterIt || {}; W.counterIt[id] = addInter(hitBox(2.9, 1.25, 1.1, sh.x + hw - 1.75, .62, -14 - 2.75, g), 'counter', 'counter:' + id, '櫃台', { shop: id });
  CZ.pool.push([sh.x, -12.2, 5.5]); // 晚上門口地上一圈暖光
  if (id === 'arms') { armsShutter(g, sh, tag); armsInter(!W.armsShut); }
}
// 武器店開張前：吊牌、櫃台的點擊範圍關掉
function armsInter(on) { (W.wareIt || []).forEach(it => { if (it.shop === 'arms') it.off = !on; }); if (W.counterIt && W.counterIt.arms) W.counterIt.arms.off = !on; }
/* 武器店（Lv 5 之前）：鐵捲門拉下（灰色浪板，原點在上緣，開張時往上收進門楣），中間貼一張手寫告示（吊牌圖集的一格）；有碰撞、走不進去 */
function armsShutter(g, sh, tag) {
  const tg = tag('arms:shut', 0, 1.7, .06, 0, 0, .9, .58); if (armsOpen()) return;
  const c = document.createElement('canvas'); c.width = c.height = 64; const x = c.getContext('2d'); x.fillStyle = '#a3a9b2'; x.fillRect(0, 0, 64, 64); x.fillStyle = '#7b818a'; for (let i = 0; i < 64; i += 16) x.fillRect(0, i, 64, 4); x.fillStyle = 'rgba(255,255,255,.18)'; for (let i = 6; i < 64; i += 16) x.fillRect(0, i, 64, 2);
  const tx = new THREE.CanvasTexture(c); tx.wrapS = tx.wrapT = THREE.RepeatWrapping; tx.repeat.set((sh.w - .6) / 1.2, SHOP_H / .5); tx.colorSpace = THREE.SRGBColorSpace;
  const geo = new THREE.PlaneGeometry(sh.w - .6, SHOP_H); geo.translate(0, -SHOP_H / 2, 0);
  const m = mesh(geo, new THREE.MeshStandardMaterial({ map: tx, roughness: .6, metalness: .3, transparent: true }), sh.x, SHOP_H, -13.97, g); m.receiveShadow = true;
  const col = addCol({ box: [CITY.x + sh.x - sh.w / 2, CITY.z - 14.2, CITY.x + sh.x + sh.w / 2, CITY.z - 14] });
  const it = addInter(hitBox(sh.w - .6, SHOP_H, .3, sh.x, SHOP_H / 2, -13.85, g), 'station', 'arms:shut', '武器店', { act: armsShutAct }); Object.defineProperty(it, 'label', { get: () => '鐵伯上山打鐵中・Lv ' + ARMS_LV + ' 開張（目前 Lv ' + xpLevel(S.xp) + '）' });
  W.armsShut = { m, col, it, tg, on: true, t0: 0 };
}
function armsShutAct() { const S0 = W.armsShut; if (!S0 || !S0.on) return; const need = XP_LV[ARMS_LV] - S.xp; fx3(S0.tg.p.clone().setY(2.5), '還差 ' + Math.max(0, need) + ' 經驗', '#fde68a'); sfx.tick && sfx.tick(); }

/* ---------- 吊牌圖集：牛皮紙、左上穿孔、手寫字（一張 1024×640 畫布，每格 200×128；LOW 也不降解析度） ----------
   只在狀態變了才重畫那一格（shopStep 每 .25 秒最多 2 格）；被拿走的那格畫成透明（alphaTest），字型載入後全部重畫 */
const TAG = { cv: null, g: null, tx: null, cells: new Map(), dirty: new Set(), sig: {}, t: 0, st: 0 };
function tagAtlas() {
  if (TAG.cv) return; const c = TAG.cv = document.createElement('canvas'); c.width = 1024; c.height = 640; TAG.g = c.getContext('2d');
  TAG.tx = new THREE.CanvasTexture(c); TAG.tx.colorSpace = THREE.SRGBColorSpace; TAG.tx.anisotropy = 8;
  try { if (document.fonts) { const need = ['700 32px "LXGW WenKai TC"', '400 32px "Slime Hand"'].filter(f => !document.fonts.check(f, '月')); if (need.length) Promise.all(need.map(f => document.fonts.load(f, '月'))).then(() => tagDirty(), () => { }); } } catch (e) { }
}
function tagCell(id) {
  let c = TAG.cells.get(id); if (c) return c; const i = TAG.cells.size, px = 12 + (i % 5) * 200, py = Math.floor(i / 5) * 128;
  c = { px, py, uv: [(px + 2) / 1024, 1 - (py + 126) / 640, 196 / 1024, 124 / 640] }; TAG.cells.set(id, c); TAG.dirty.add(id); return c;
}
function tagUV(geo, [u0, v0, du, dv]) { const a = geo.attributes.uv; for (let i = 0; i < a.count; i++) a.setXY(i, u0 + a.getX(i) * du, v0 + a.getY(i) * dv); return geo; }
// 只做標記（id 省略＝全部）；真的重畫在 tagStep
function tagDirty(id) { if (!TAG.cv) return; if (id) TAG.dirty.add(id); else TAG.cells.forEach((c, k) => TAG.dirty.add(k)); }
const tagSig = id => { const [t, k] = id.split(':'); if (id === 'arms:shut') return String(!!(W.armsShut && W.armsShut.on && !W.armsShut.t0)); const st = wareState(t, k); return [st.why, Math.round(st.d / 10), st.lv, S.wish[id] ? 1 : 0, WARE.h && WARE.h.wid === id ? 1 : 0, W.armsShut && W.armsShut.on && wareShop(id) === 'arms' ? 1 : 0].join(); };
function tagStep(dt) {
  if (!TAG.cv) return; TAG.st += dt; if (TAG.st > 2) { TAG.st = 0; TAG.cells.forEach((c, id) => { const s = tagSig(id); if (TAG.sig[id] !== s) TAG.dirty.add(id); }); } // 每 2 秒比對簽名（錢變了、網站成交）
  TAG.t += dt; if (TAG.t < .25 || !TAG.dirty.size) return; TAG.t = 0; let n = 0;
  for (const id of TAG.dirty) { TAG.dirty.delete(id); tagDraw(id); if (++n >= 2) break; } TAG.tx.needsUpdate = true;
}
const rrect = (g, x, y, w, h, r) => { g.beginPath(); if (g.roundRect) g.roundRect(x, y, w, h, r); else g.rect(x, y, w, h); };
// 紅色圓章（已購買、滿級、已付款）
function inkStamp(g, x, y, r, txt) { g.save(); g.translate(x, y); g.rotate(-.22); g.globalAlpha = .82; g.strokeStyle = '#c0262d'; g.lineWidth = r * .1; g.beginPath(); g.arc(0, 0, r, 0, PI2); g.stroke(); g.lineWidth = r * .04; g.beginPath(); g.arc(0, 0, r * .8, 0, PI2); g.stroke(); g.fillStyle = '#c0262d'; g.font = '700 ' + Math.round(r * (txt.length > 2 ? .5 : .62)) + 'px ' + ART_FONT; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(txt, 0, r * .04, r * 1.6); g.restore(); }
function heartMark(g, x, y, r) { g.save(); g.translate(x, y); g.fillStyle = '#e11d48'; g.beginPath(); g.moveTo(0, r * .9); g.bezierCurveTo(-r * 1.4, -r * .1, -r * .6, -r * 1.1, 0, -r * .35); g.bezierCurveTo(r * .6, -r * 1.1, r * 1.4, -r * .1, 0, r * .9); g.fill(); g.restore(); }
function tagDraw(id) {
  const c = tagCell(id), g = TAG.g; g.clearRect(c.px, c.py, 200, 128); TAG.sig[id] = tagSig(id);
  const shut = W.armsShut && W.armsShut.on;
  g.save(); g.translate(c.px, c.py); g.textAlign = 'left'; g.textBaseline = 'alphabetic';
  if (id === 'arms:shut') { // 武器店未開張的手寫告示
    if (shut && !W.armsShut.t0) { g.fillStyle = '#fef9e7'; rrect(g, 6, 6, 188, 116, 8); g.fill(); g.strokeStyle = '#a8a29e'; g.lineWidth = 2; g.stroke(); g.fillStyle = '#ef4444'; [[18, 16], [182, 16]].forEach(([x, y]) => { g.beginPath(); g.arc(x, y, 5, 0, PI2); g.fill(); });
      g.fillStyle = '#3b2a1a'; g.textAlign = 'center'; g.font = '400 30px "Slime Hand",' + ART_FONT; g.fillText('鐵伯上山打鐵中', 100, 58, 176); g.fillStyle = '#b91c1c'; g.font = '700 32px ' + ART_FONT; g.fillText('Lv ' + ARMS_LV + ' 開張', 100, 104, 176); }
    g.restore(); return;
  }
  if ((WARE.h && WARE.h.wid === id) || (shut && wareShop(id) === 'arms')) { g.restore(); return; } // 被拿走、或武器店還沒開：這格透明
  const [t, k] = id.split(':'), st = wareState(t, k), done = st.why === 'has' || st.why === 'max';
  g.fillStyle = '#e8d3a9'; rrect(g, 4, 4, 192, 120, 10); g.fill(); g.strokeStyle = '#b89a6a'; g.lineWidth = 2; g.stroke();
  g.fillStyle = '#7a5a3a'; g.beginPath(); g.arc(19, 19, 5.5, 0, PI2); g.fill(); g.strokeStyle = '#f5f5f4'; g.lineWidth = 2; g.beginPath(); g.moveTo(19, 19); g.quadraticCurveTo(8, 6, 0, 2); g.stroke(); // 穿孔與棉線
  g.fillStyle = '#3b2a1a'; g.font = '700 30px ' + ART_FONT; g.fillText(st.name, 32, 42, 160);
  if (!done) { g.fillStyle = '#8a2a12'; g.font = '700 36px ' + ART_FONT; const tw = Math.min(118, g.measureText(fmt(st.cost)).width); g.fillText(fmt(st.cost), 18, 86, 118);
    if (st.can) { g.strokeStyle = 'rgba(71,85,105,.75)'; g.lineWidth = 2.2; g.beginPath(); g.ellipse(18 + tw / 2, 74, tw / 2 + 10, 22, -.05, .2, PI2 + .05); g.stroke(); } } // 買得起：鉛筆圈起來
  if (t === 'up') for (let i = 0; i < st.max; i++) { g.fillStyle = i < st.lv ? '#b45309' : 'rgba(120,90,50,.28)'; g.beginPath(); g.arc(144 + i * 11, 76, 4, 0, PI2); g.fill(); }
  const note = st.why === 'poor' ? '還差 ' + fmt(st.d) : st.why === 'need' ? '要先有' + st.need : t === 'up' && !done ? 'Lv ' + st.lv + ' → ' + (st.lv + 1) : '';
  if (note) { g.fillStyle = st.why ? '#57534e' : '#7c5a2a'; g.font = '400 25px "Slime Hand",' + ART_FONT; g.fillText(note, 20, 117, 170); }
  if (done) inkStamp(g, 132, 82, 33, st.why === 'max' ? '滿級' : '已購買');
  if (S.wish[id]) heartMark(g, 180, 24, 11);
  g.restore();
}
// 夜燈材質：頂點色同時是發光的顏色（路燈燈罩、霓虹燈條、串燈、招牌燈條共用一個網格），亮度隨天色調整
function cityGlowMat() {
  const m = new THREE.MeshStandardMaterial({ vertexColors: true, emissive: '#ffffff', emissiveIntensity: .22, roughness: .45 });
  m.onBeforeCompile = sh => { sh.fragmentShader = sh.fragmentShader.replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\ntotalEmissiveRadiance *= vColor;'); };
  m.customProgramCacheKey = () => 'cityGlow'; return m;
}
// 地面：人行道磁磚、柏油路面（重複貼圖）、路緣石、導盲磚；路面標線（斑馬線、雙黃線、白邊線、停止線、「慢」字、人孔蓋）合併成一個網格
function cityGround(g) {
  const flat = (geo, mat, y) => { const m = mesh(geo, mat, 0, y, 0, g); m.rotation.x = -Math.PI / 2; m.receiveShadow = true; return m; };
  const tex = (w, h, rx, ry, draw) => { const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d'), w, h); const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(rx, ry); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; return t; };
  // 人行道：50 公分的方磚（一張貼圖＝2 × 2 公尺），每塊顏色略有不同
  flat(new THREE.PlaneGeometry(300, 240), std('#ffffff', { roughness: .92, metalness: 0, map: tex(256, 256, 150, 120, t => { t.fillStyle = '#8f8a80'; t.fillRect(0, 0, 256, 256);
    for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) { t.fillStyle = `hsl(${30 + Math.random() * 12 | 0},${6 + Math.random() * 5 | 0}%,${66 + Math.random() * 9 | 0}%)`; t.fillRect(i * 64 + 2, j * 64 + 2, 60, 60); for (let k = 0; k < 18; k++) { t.fillStyle = `rgba(${Math.random() < .5 ? '0,0,0' : '255,255,255'},.06)`; t.fillRect(i * 64 + 3 + Math.random() * 54, j * 64 + 3 + Math.random() * 54, 3, 3); } } }) }), -.02);
  // 柏油路：細碎的顆粒、車輪壓出的深色帶、幾塊補過的路面（標線另外畫）
  flat(new THREE.PlaneGeometry(300, 14), std('#ffffff', { roughness: .95, metalness: 0, map: tex(512, 256, 25, 1, t => { t.fillStyle = '#434a57'; t.fillRect(0, 0, 512, 256);
    for (let i = 0; i < 2600; i++) { t.fillStyle = `rgba(${Math.random() < .5 ? '20,22,28' : '160,165,175'},${.08 + Math.random() * .12})`; t.fillRect(Math.random() * 512, Math.random() * 256, 2, 2); }
    [40, 88, 168, 216].forEach(y => { t.fillStyle = 'rgba(15,17,22,.16)'; t.fillRect(0, y - 9, 512, 18); });
    for (let i = 0; i < 3; i++) { t.fillStyle = 'rgba(30,33,40,.35)'; t.fillRect(60 + i * 160, 30 + i * 70, 70, 40); } }) }), .005);
  const B = cAt().B; [-1, 1].forEach(s => B(300, .12, .3, '#a8a29e', 0, .06, s * 7.15)); [-11, 11].forEach(x => [-1, 1].forEach(s => B(3.2, .02, .6, '#facc15', x, .012, s * 7.7))); // 路緣石、導盲磚
  // 標線貼圖：白、黃、「慢」字、人孔蓋圖案（史萊姆浮雕）
  const mc = document.createElement('canvas'); mc.width = 256; mc.height = 128; const m = mc.getContext('2d');
  m.fillStyle = '#f1f5f9'; m.fillRect(0, 0, 32, 32); m.fillStyle = '#facc15'; m.fillRect(0, 32, 32, 32); m.fillStyle = '#20242c'; m.fillRect(0, 64, 32, 32);
  m.fillStyle = '#f1f5f9'; m.font = '900 116px ' + TC_FONT; m.textAlign = 'center'; m.textBaseline = 'middle'; m.fillText('慢', 96, 66, 124);
  const hole = (cx, slime) => { m.fillStyle = '#5b616b'; m.beginPath(); m.arc(cx, 64, 60, 0, PI2); m.fill(); m.strokeStyle = '#3a3f47'; m.lineWidth = 5; m.beginPath(); m.arc(cx, 64, 56, 0, PI2); m.stroke();
    m.strokeStyle = '#4a5058'; m.lineWidth = 3; for (let r = 14; r < 52; r += 12) { m.beginPath(); m.arc(cx, 64, r, 0, PI2); m.stroke(); }
    if (slime) { m.fillStyle = '#7b828d'; m.beginPath(); m.ellipse(cx, 72, 24, 18, 0, Math.PI, 0); m.lineTo(cx + 24, 80); m.lineTo(cx - 24, 80); m.fill(); m.fillStyle = '#3a3f47'; m.fillRect(cx - 10, 62, 5, 7); m.fillRect(cx + 5, 62, 5, 7); } };
  hole(192, true); const mt = new THREE.CanvasTexture(mc); mt.colorSpace = THREE.SRGBColorSpace; mt.anisotropy = 8; W.markTex = mt;
  const cellUV = (px, py, pw, ph) => [px / 256, 1 - (py + ph) / 128, pw / 256, ph / 128]; W.markUV = { white: cellUV(4, 4, 24, 24), yellow: cellUV(4, 36, 24, 24), dark: cellUV(4, 68, 24, 24), slow: cellUV(36, 4, 120, 120), hole: cellUV(130, 2, 124, 124) };
  const mq = (w, d, x, z, k, rz = 0) => { const p = UPLN.clone(), uv = p.attributes.uv, [u0, v0, du, dv] = W.markUV[k]; for (let i = 0; i < 4; i++) uv.setXY(i, u0 + uv.getX(i) * du, v0 + uv.getY(i) * dv); CZ.mark.push(p.applyMatrix4(M4(x, .02, z, -Math.PI / 2, 0, rz, w, d, 1))); };
  [-11, 11].forEach(x => { for (let z = -6; z <= 6; z += 1.3) mq(3.2, .6, x, z, 'white'); });
  [[-150, -13.2], [-8.8, 8.8], [13.2, 150]].forEach(([a, b]) => [-.12, .12].forEach(z => mq(b - a, .1, (a + b) / 2, z, 'yellow')));
  [-1, 1].forEach(s => mq(300, .12, 0, s * 6.55, 'white'));
  [[-14.2, 3.5], [7.8, 3.5], [14.2, -3.5], [-7.8, -3.5]].forEach(([x, z]) => mq(.4, 6.6, x, z, 'white'));
  [[-17.5, 3.4, -1], [4.6, 3.4, -1], [17.5, -3.4, 1], [-4.6, -3.4, 1]].forEach(([x, z, s]) => mq(1.7, 2.7, x, z, 'slow', s * Math.PI / 2));
  [[-34, 2.2], [30, -2.4], [55, 1.8], [-58, -2.6], [-20, -10.6], [36.8, 11.3], [-5.5, 33.5], [58, 26]].forEach(([x, z]) => mq(.9, .9, x, z, 'hole'));
}
// 把建城時收集到的零件依材質合併成網格
function cityMerge(g) {
  const put = (geo, mat, sh = true) => { const m = mesh(geo, mat, 0, 0, 0, g); m.castShadow = sh && !LOW; m.receiveShadow = true; return m; };
  const parts = [[], [], []]; CZ.det.forEach(p => parts[p[2].elements[12] < -24 ? 0 : p[2].elements[12] > 24 ? 2 : 1].push(p));
  parts.forEach(p => p.length && put(mergeParts(p), W.shopDetM));
  if (CZ.wood.length) { const wm = W.cityWoodM || (W.cityWoodM = woodMat('#ffffff')); wm.vertexColors = true; put(mergeParts(CZ.wood), wm); }
  if (CZ.glow.length) put(mergeParts(CZ.glow), W.cityGlowM = cityGlowMat(), false);
  if (CZ.shopIn.length) { const m = put(mergeParts(CZ.shopIn), W.shopInM = shopInMat(), false); m.receiveShadow = false; } // 店內：不收陰影（大樓的影子不會把店裡蓋暗）
  if (CZ.tag.length) { W.tagM = new THREE.MeshStandardMaterial({ map: TAG.tx, emissive: '#ffffff', emissiveMap: TAG.tx, emissiveIntensity: .3, alphaTest: .5, roughness: .9, metalness: 0 }); const m = put(mergeUV(CZ.tag), W.tagM, false); m.receiveShadow = false; W.tagMesh = m; }
  const A = W.cityAtlas, tx = A.tex = new THREE.CanvasTexture(A.cv); tx.colorSpace = THREE.SRGBColorSpace; tx.anisotropy = 8;
  W.citySignM = new THREE.MeshStandardMaterial({ map: tx, emissive: '#ffffff', emissiveMap: tx, emissiveIntensity: .05, roughness: .55, metalness: 0 });
  if (CZ.sign.length) put(mergeUV(CZ.sign), W.citySignM, false);
  if (CZ.glass.length) put(mergeUV(CZ.glass), W.shopGlass || (W.shopGlass = new THREE.MeshStandardMaterial({ color: '#7fb8d6', emissive: '#ffe7b0', emissiveIntensity: .12, roughness: .05, metalness: .4 })), false);
  if (!(W.cityWin || []).includes(W.shopGlass)) (W.cityWin = W.cityWin || []).push(W.shopGlass);
  if (CZ.mark.length) { const mm = put(mergeUV(CZ.mark), new THREE.MeshStandardMaterial({ map: W.markTex, alphaTest: .5, roughness: .7, metalness: 0, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1 }), false); mm.castShadow = false; }
  if (CZ.pool.length) { // 路燈下的光暈：只在晚上出現
    const geos = CZ.pool.map(([x, z, r]) => UPLN.clone().applyMatrix4(M4(x, .035, z, -Math.PI / 2, 0, 0, r, r, 1)));
    W.cityPoolM = new THREE.MeshBasicMaterial({ map: dotTex(), color: '#ffcf7a', transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, fog: false });
    W.cityPool = mesh(mergeUV(geos), W.cityPoolM, 0, 0, 0, g); W.cityPool.renderOrder = 2; W.cityPool.visible = false;
  }
}
// 大城市的彩蛋（登記到共用的彩蛋清單，發現時回報；清單與介面由彩蛋系統負責）
const CITY_EGGS = [
  ['city_cat', '跟屁蟲橘貓', '生活百貨旁的巷口有隻橘貓。慢慢走過去，牠也許會陪你散步。'],
  ['city_soda', '史萊姆汽水', '咖啡館牆邊的販賣機，好像藏著一種很少掉出來的飲料。'],
  ['city_pigeons', '鴿子大起飛', '陳伯伯腳邊的鴿子很膽小，衝過去會怎樣呢？'],
  ['city_screen', '大螢幕上的你', '抬頭看看生活百貨樓頂的大螢幕，說不定會看到熟悉的身影。'],
  ['city_sill', '花箱裡的偷看', '咖啡館二樓的花箱裡，好像有什麼在偷看路人。'],
  ['city_fan', '忠實觀眾', '城裡有位直播迷。等你小有名氣，再去跟他聊聊。'],
  ['city_cuckoo', '鐘塔報時員', '鐘塔每隔五分鐘，會有個小傢伙出來報時。'],
  ['city_manhole', '人孔蓋底下', '廣場步道上有個人孔蓋，晚上縫裡好像有眼睛在發光。'],
  ['city_ding', '歡迎光臨', '街角的便利商店，自動門會跟你打招呼。'],
];
// 發現城市彩蛋：交給共用的彩蛋系統（還沒接上時就只有遊戲裡的反應）；同一個彩蛋這次遊玩只回報一次
function cityEgg(id) { const s = W.cityEggs || (W.cityEggs = new Set()); if (s.has(id)) return; s.add(id); if (typeof foundEgg === 'function') foundEgg(id); }
function buildCity() {
  const g = new THREE.Group(); g.position.set(CITY.x, 0, CITY.z); W.scene.add(g); W.city = g;
  CZ = { det: [], wood: [], glow: [], sign: [], glass: [], mark: [], pool: [], shopIn: [], tag: [] }; const A = W.cityAtlas = cityAtlas(); CZ.sg = citySigns(A); W.cfx = {}; tagAtlas();
  W.shopDetM = W.shopDetM || new THREE.MeshStandardMaterial({ vertexColors: true, roughness: .75, flatShading: true });
  cityGround(g);
  const winTex = (() => { const c = document.createElement('canvas'); c.width = 64; c.height = 128; const x = c.getContext('2d'); x.fillStyle = '#1f2937'; x.fillRect(0, 0, 64, 128); for (let i = 0; i < 4; i++) for (let j = 0; j < 8; j++) { x.fillStyle = Math.random() < .5 ? '#fde68a' : '#475569'; x.fillRect(4 + i * 15, 4 + j * 15.5, 10, 11); } const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping; return t; })();
  const rd = seeded(31), cols = ['#64748b', '#475569', '#94a3b8', '#7c8aa0', '#5b6b80', '#a1a1aa'];
  buildTowers(g, rd);
  // 遠景：一圈簡單的大樓（一次繪製）
  { const n = LOW ? 13 : 26, pos = [], nor = [], uv = [], col = [], idx = []; let base = 0; const cc = new THREE.Color();
    for (let i = 0; i < n; i++) { const a = i / n * PI2, r = 116 + rd() * 30, h = 30 + rd() * 50; if (Math.cos(a) * r < -76 && Math.abs(Math.sin(a) * r) < 75) continue; const bg = new THREE.BoxGeometry(14, h, 14); bg.translate(Math.cos(a) * r, h / 2, Math.sin(a) * r); cc.set(pick(cols)); // 西邊被月光隧道的小山擋住的那幾棟不蓋（r、h 照樣先算，亂數順序不變）
      const P0 = bg.attributes.position, N0 = bg.attributes.normal, U0 = bg.attributes.uv;
      for (let v = 0; v < P0.count; v++) { pos.push(P0.getX(v), P0.getY(v), P0.getZ(v)); nor.push(N0.getX(v), N0.getY(v), N0.getZ(v)); const side = Math.abs(N0.getY(v)) < .5; uv.push(U0.getX(v) * (side ? 3.5 : .1), U0.getY(v) * (side ? h / 7 : .1)); col.push(cc.r, cc.g, cc.b); }
      for (let k = 0; k < bg.index.count; k++) idx.push(bg.index.getX(k) + base); base += P0.count; bg.dispose(); }
    const mg = new THREE.BufferGeometry(); mg.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); mg.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3)); mg.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); mg.setAttribute('color', new THREE.Float32BufferAttribute(col, 3)); mg.setIndex(idx);
    const mm = new THREE.MeshStandardMaterial({ vertexColors: true, map: winTex, emissive: '#ffffff', emissiveMap: winTex, emissiveIntensity: .22, roughness: .7 }); (W.cityWin = W.cityWin || []).push(mm);
    const ring = mesh(mg, mm, 0, 0, 0, g); ring.receiveShadow = true; }
  buildPlaza(g);
  // 商店（路北側）：外牆、門面、招牌都進合併清單；招牌在圖集裡（武器店開張時重畫那一格）
  const shop = (id, x, w, col, name, sub, accent) => {
    const A0 = cAt(), open = !!SHOPS[id];
    if (open) { A0.B(w, 8, 7.4, col, x, 4, -22.3); A0.B(w, 8 - SHOP_H, SHOP_D, col, x, (8 + SHOP_H) / 2, -14 - SHOP_D / 2); [-1, 1].forEach(s => A0.B(.3, SHOP_H, SHOP_D, col, x + s * (w / 2 - .15), SHOP_H / 2, -14 - SHOP_D / 2)); shopCols(id); } // 店頭：後段、門楣以上、兩側牆四塊，一樓中間挖空
    else { A0.B(w, 8, 12, col, x, 4, -20); addCol({ box: [CITY.x + x - w / 2, CITY.z - 26, CITY.x + x + w / 2, CITY.z - 14] }); }
    shopFront(id, x, w, g, open);
    const rc = CZ.sg.shop[id], sw = Math.min(w - 2, 8); A0.S(sw, sw / 4, 0, rc, x, 5.6, -13.7);
    if (id === 'arms') W.armsSign = { c: rc.c, name, accent, x, blit: () => { const [px, py, pw, ph] = rc.px, At = W.cityAtlas; At.g.drawImage(rc.c, px, py, pw, ph); if (At.tex) At.tex.needsUpdate = true; } };
    if (open) buildShopRoom(id, g); else addInter(hitBox(w - 2, 3.4, 2.2, x, 1.7, -12.6, g), 'station', 'hospital', name); // 四間店不再有型錄介面：走進去拿起來看
    const lb = textSprite(name, accent, sub); lb.position.set(x, 9.2, -13.5); g.add(lb); if (id === 'arms') W.armsLabel = lb;
  };
  shop('mach', SHOPS.mach.x, SHOPS.mach.w, SHOPS.mach.col, '機械行', '加工機器與升級', '#22d3ee');
  shop('mall', SHOPS.mall.x, SHOPS.mall.w, SHOPS.mall.col, '生活百貨', '倉儲、網路、跑鞋', '#34d399');
  shop('gear', SHOPS.gear.x, SHOPS.gear.w, SHOPS.gear.col, '器材行', '直播設備、裝飾桌', '#e879f9');
  shop('hospital', -34, 11, '#f8fafc', '醫院', '凍僵了來這裡看醫生', '#f87171');
  shop('arms', SHOPS.arms.x, SHOPS.arms.w, SHOPS.arms.col, '武器店', armsOpen() ? '長劍、保暖衣' : 'Lv 5 解鎖營業', '#f87171');
  // 計程車招呼站在醫院門口（路北側、車頭朝西）；大街西端盡頭是月光隧道的洞口與小山（從廣場往西看一直都看得到回家的路）
  W.taxiC = makeCab(true); g.add(W.taxiC); cabPark(W.taxiC); cityTunnel(g);
  buildStreet(g, rd);
  buildCityFx(g);
  cityMerge(g); CZ = null;
  CITY_EGGS.forEach(e => typeof regEgg === 'function' && regEgg(...e));
}
/* 街道家具：路燈（掛活動旗或吊花籃）、行道樹、長椅、公車站、郵筒、消防栓、垃圾桶、機車、微笑單車、停在路邊的車、廣場花台、
   街角兩座小公園、巷子裡的雜物……全部進合併清單。位置避開居民散步的路線（NPC 不做碰撞，只照固定路線走）。手機少放一點 */
function buildStreet(g, rd) {
  [-52, -39, -26, 26, 39, 52].forEach((x, i) => [-8.6, 8.6].forEach((z, j) => cityLamp(x, z, (i + j) % 2 ? 'flag' : 'flower', (i * 2 + j) % 4)));
  [-45.5, -32.5, -19.5, 19.5, 32.5, 45.5].forEach((x, i) => [-10.5, 10.5].forEach((z, j) => { if (x === -45.5 && z > 0) return; const nx = z < 0 ? { '-19.5': -26.2, '19.5': 26.8, '32.5': null }[x] : undefined; if (nx === null) return; cityTree(Math.abs(x) > 45 && z < 0 ? Math.sign(x) * 41.2 : nx != null ? nx : x, z, 1, i + j * 3); })); // 北側兩端那兩棵讓開，不擋店招；擋在店門口的三棵移到店與店之間（32.5 那棵跟 26.8 太近，不種）
  [[-12.6, 22.4], [12.6, 22.4], [-12.5, 29.8], [12.5, 29.8]].forEach(([x, z], i) => cityTree(x, z, 1.15, i + 7, true)); // 廣場四棵樹（晚上有串燈）
  [[-6.4, 25.2, Math.PI / 2], [6.4, 25.2, -Math.PI / 2], [-3.6, 20.6, 0], [3.6, 20.6, 0]].forEach(([x, z, r]) => cityBench(x, z, r));
  cityPlanter(-5.8, 13.4, 2.2, 1, 1); // 廣場入口的花台（東邊是計程車招呼站）
  [[-7.6, 22.4], [7.6, 22.4], [-7.6, 29.6], [7.6, 29.6]].forEach(([x, z]) => { const T = cAt(x, z); T.P(cylG(.16, .2, .3, 8), '#2f3b46', M4(0, .15, 0)); T.P(cylG(.045, .055, 3, 6), '#2f3b46', M4(0, 1.6, 0)); T.P(cylG(.12, .08, .12, 8), '#c8a24a', M4(0, 3.1, 0)); T.P(sphG(.24, 10, 8), '#fff3c4', M4(0, 3.38, 0), 'glow'); CZ.pool.push([x, z, 4]); addCol({ x: CITY.x + x, z: CITY.z + z, r: .2 }); }); // 廣場的小圓燈
  cityBusStop(-45, 9.2);
  const scoot = (x0, n, z, ry) => { for (let i = 0; i < n; i++) if (!LOW || i % 2 === 0) cityScooter(x0 + i * .8, z, ry + (rd() - .5) * .12, rpk(rd, ['#99f6e4', '#f1f5f9', '#fbcfe8', '#bae6fd', '#fef3c7', '#334155', '#ef4444', '#cbd5e1', '#fde047']), rd() < .18 ? rpk(rd, ['#ef4444', '#f97316', '#16a34a']) : null); };
  scoot(-37.5, 6, -8.3, 0); scoot(-24.2, 4, -8.3, 0); scoot(27.8, 4, -8.3, 0); scoot(34.6, 4, -8.3, 0); scoot(18.6, 4, 8.3, Math.PI); scoot(34, 5, 8.3, Math.PI);
  cityMailbox(-4.6, -9.1, Math.PI, '#15803d', CZ.sg.mailG); cityMailbox(-5.4, -9.1, Math.PI, '#b91c1c', CZ.sg.mailR);
  [[-30.8, -8], [22.2, -8], [-21.5, 8.2], [30, 8.2]].forEach(([x, z]) => cityHydrant(x, z));
  cityBins(-16.5, -9.1, 0); cityBins(15.9, 9.1, Math.PI);
  [[-57, 4.5, 0, '#ef4444'], [26, -4.5, Math.PI, '#3b82f6'], [40, 4.5, 0, '#e5e7eb'], [-55, -4.5, Math.PI, '#fbbf24']].forEach(([x, z, r, c]) => { cityCar(x, z, r, c); addCol({ box: [CITY.x + x - 2, CITY.z + z - 1, CITY.x + x + 2, CITY.z + z + 1] }); });
  cityBikes(58, 9, LOW ? 4 : 6);
  cityParkSE(56.5, 29); cityParkSW(-56.5, 29);
  cityAlley();
}
// 路燈：深綠色燈桿、金色飾環、伸向馬路的燈臂與燈罩（燈罩進夜燈網格）；旗子掛在燈桿外側、支架在旗子上下緣之外，兩面都看得到字
function cityLamp(x, z, kind, v) {
  const s = Math.sign(z), L = cAt(x, z, s > 0 ? Math.PI : 0), pc = '#2f3b46';
  L.B(.34, .3, .34, pc, 0, .15, 0); L.P(cylG(.06, .085, 5.4, 8), pc, M4(0, 2.85, 0)); L.P(cylG(.1, .1, .1, 8), '#c8a24a', M4(0, 3.25, 0)); L.P(cylG(.1, .1, .1, 8), '#c8a24a', M4(0, .62, 0));
  L.B(.07, .07, 1.25, pc, 0, 5.45, .58); L.B(.05, .45, .05, pc, 0, 5.24, .14, -.65);
  L.B(.48, .14, .68, pc, 0, 5.4, 1.15); L.B(.36, .05, .52, '#fff3c4', 0, 5.31, 1.15, 0, 0, 0, 'glow');
  CZ.pool.push([x, z - s * 1.15, 4.6]);
  if (kind === 'flag') { L.S(.02, 1.6, .4, CZ.sg.ban[v], 0, 4.15, .4, [0, 1]); L.B(.035, .035, .52, pc, 0, 5.0, .3); L.B(.035, .035, .52, pc, 0, 3.3, .3); }
  else { L.B(.015, .4, .015, '#44403c', 0, 5.18, .62); L.P(blobG(.28, v + 11), '#4c9a45', M4(0, 4.86, .62)); for (let i = 0; i < 6; i++) { const a = i / 6 * PI2; L.P(sphG(.07, 6, 4), ['#f472b6', '#a78bfa', '#facc15', '#fb7185'][(i + v) % 4], M4(Math.cos(a) * .24, 4.78 + (i % 2) * .1, .62 + Math.sin(a) * .24)); } }
}
// 行道樹：鐵製樹穴蓋板、樹幹、三團樹冠；lights＝樹冠上的串燈（晚上亮）
function cityTree(x, z, s = 1, v = 0, lights) {
  const T = cAt(x, z, v * 1.3), h = 2.25 * s; T.B(1.3, .04, 1.3, '#4b5563', 0, .02, 0); T.B(1.08, .03, 1.08, '#5b4636', 0, .03, 0);
  T.P(cylG(.09 * s, .14 * s, h, 7), '#6b4a33', M4(0, h / 2, 0));
  T.P(blobG(1.15, v % 4), ['#4c9440', '#5a9a46', '#478a3c'][v % 3], M4(0, h + .5 * s, 0, 0, v, 0, s));
  T.P(blobG(.8, v % 4 + 4), ['#5fae4f', '#4c9440', '#66b35a'][v % 3], M4(.55 * s, h + .1 * s, .3 * s, 0, v, 0, s));
  T.P(blobG(.75, v % 4 + 8), '#3f8538', M4(-.5 * s, h + .2 * s, -.35 * s, 0, v, 0, s));
  if (lights && !LOW) for (let i = 0; i < 16; i++) { const a = i * 2.4, r = .9 + (i % 3) * .2; T.B(.08, .08, .08, ['#fde68a', '#fbcfe8', '#bae6fd'][i % 3], Math.cos(a) * r * s, h + (.1 + (i % 5) * .22) * s, Math.sin(a) * r * s, 0, 0, 0, 'glow'); }
  addCol({ x: CITY.x + x, z: CITY.z + z, r: .32 });
}
function cityBench(x, z, ry) {
  const T = cAt(x, z, ry), wd = '#a0703f', ir = '#2f3b46';
  for (let i = 0; i < 3; i++) T.B(1.8, .05, .13, wd, 0, .45, -.17 + i * .16, 0, 0, 0, 'wood');
  for (let i = 0; i < 2; i++) T.B(1.8, .11, .04, wd, 0, .64 + i * .16, -.27, -.12, 0, 0, 'wood');
  [-1, 1].forEach(s => { T.B(.06, .45, .06, ir, s * .78, .22, .12); T.B(.06, .45, .06, ir, s * .78, .22, -.22); T.B(.06, .06, .44, ir, s * .78, .42, -.05); T.B(.06, .5, .05, ir, s * .78, .7, -.29, -.12); T.B(.06, .05, .42, ir, s * .86, .62, -.05); });
  const c = Math.cos(ry), sn = Math.sin(ry); [-.5, .5].forEach(k => addCol({ x: CITY.x + x + c * k, z: CITY.z + z - sn * k, r: .4 }));
}
// 花台：石砌外框、泥土、一叢一叢的花
function cityPlanter(x, z, w, d, v = 0) {
  const T = cAt(x, z); T.B(w, .5, d, '#b7b0a5', 0, .25, 0); T.B(w - .16, .04, d - .16, '#5b4636', 0, .5, 0);
  for (let i = 0; i < Math.round(w * d * 3); i++) { const px = (((i * 37 + v * 13) % 97) / 97 - .5) * (w - .4), pz = (((i * 53 + v * 7) % 89) / 89 - .5) * (d - .4); T.P(blobG(.17, i % 5), i % 3 ? ['#f472b6', '#facc15', '#fb7185', '#a78bfa', '#ffffff'][(i + v) % 5] : '#4c9a45', M4(px, .62 + (i % 2) * .06, pz)); }
  addCol({ box: [CITY.x + x - w / 2, CITY.z + z - d / 2, CITY.x + x + w / 2, CITY.z + z + d / 2] });
}
// 公車站：屋頂、柱子、背板一半是燈箱廣告（史萊姆汽水）一半是玻璃、木頭長椅；站牌圓板放在柱頂上，時刻表貼在柱子正面
function cityBusStop(x, z) {
  const T = cAt(x, z, Math.PI), m = '#94a3b8', sg = CZ.sg;
  [-2.3, 0, 2.3].forEach(px => T.B(.08, 2.6, .08, m, px, 1.3, -.75)); [-2.3, 2.3].forEach(px => T.B(.08, 2.6, .08, m, px, 1.3, .7));
  T.B(4.9, .1, 1.8, '#475569', 0, 2.65, 0); T.B(4.9, .18, .08, '#0ea5e9', 0, 2.62, .88); T.B(4.4, .04, .06, '#fef3c7', 0, 2.56, .78, 0, 0, 0, 'glow');
  T.S(1.02, 1.7, .08, sg.busAd, 1.15, 1.66, -.75, [4, 5]); [-1, 1].forEach(k => { T.B(1.14, .06, .1, '#334155', 1.15, 1.66 + k * .88, -.75); T.B(.06, 1.82, .1, '#334155', 1.15 + k * .54, 1.66, -.75); }); // 燈箱外框（在板面外圍）
  [.31, 1.99].forEach(px => { T.Q(.5, 1.9, px, 1.45, -.75); T.Q(.5, 1.9, px, 1.45, -.75, Math.PI); }); // 燈箱兩側的窄玻璃（不蓋到燈箱）
  T.Q(2.1, 1.9, -1.15, 1.45, -.75); T.Q(2.1, 1.9, -1.15, 1.45, -.75, Math.PI);
  T.B(3.2, .06, .42, '#a0703f', -.55, .47, -.45, 0, 0, 0, 'wood'); [-1.95, .85].forEach(px => T.B(.06, .45, .3, m, px, .22, -.45));
  T.P(cylG(.04, .04, 2.44, 6), '#64748b', M4(2.95, 1.22, .75)); T.S(.62, .62, .04, sg.busSign, 2.95, 2.75, .75, [4, 5]); T.S(.4, .8, 0, sg.time, 2.95, 1.45, .83);
  addCol({ box: [CITY.x + x - 2.45, CITY.z + z + .62, CITY.x + x + 2.45, CITY.z + z + .9] }); addCol({ box: [CITY.x + x - 1.15, CITY.z + z + .3, CITY.x + x + 2.15, CITY.z + z + .65] });
}
// 機車（台灣街頭停滿路邊的那種）：車身、坐墊、踏板、龍頭、後照鏡、輪子；有些後面綁著外送箱
function cityScooter(x, z, ry, c, box) {
  const T = cAt(x, z, ry), dk = '#1f2937';
  T.B(.34, .38, .72, c, 0, .56, -.34); T.B(.3, .1, .6, dk, 0, .8, -.3); T.B(.28, .08, .5, '#475569', 0, .3, .18);
  T.B(.34, .72, .16, c, 0, .62, .44, .22); T.B(.07, .34, .07, '#4b5563', 0, 1.04, .52, .35); T.B(.6, .05, .05, dk, 0, 1.2, .58); T.B(.16, .1, .05, '#fef9c3', 0, .98, .56);
  [-1, 1].forEach(s => T.B(.04, .2, .02, '#6b7280', s * .24, 1.33, .56));
  [-.46, .5].forEach(zz => T.P(cylG(.21, .21, .11, 10), '#111827', M4(0, .21, zz, 0, 0, Math.PI / 2)));
  if (box) T.B(.42, .34, .4, box, 0, 1.05, -.5);
}
// 郵筒：台灣的綠色（普通）與紅色（限時）郵筒，圓頂、投信口、標籤（標籤在投信口下面，不會被擋）
function cityMailbox(x, z, ry, c, rc) {
  const T = cAt(x, z, ry); T.B(.38, .14, .32, '#334155', 0, .07, 0); T.B(.5, .95, .42, c, 0, .62, 0); T.P(cylG(.25, .25, .42, 14), c, M4(0, 1.09, 0, Math.PI / 2));
  T.B(.3, .04, .02, '#111827', 0, 1.0, .215); T.S(.36, .18, 0, rc, 0, .78, .215);
  addCol({ x: CITY.x + x, z: CITY.z + z, r: .32 });
}
function cityHydrant(x, z) { const T = cAt(x, z); T.P(cylG(.13, .15, .58, 10), '#dc2626', M4(0, .29, 0)); T.P(cylG(.14, .14, .08, 10), '#facc15', M4(0, .62, 0)); T.P(sphG(.12, 8, 4), '#dc2626', M4(0, .66, 0)); T.B(.36, .09, .09, '#facc15', 0, .42, 0); T.B(.09, .09, .3, '#facc15', 0, .36, .1); addCol({ x: CITY.x + x, z: CITY.z + z, r: .2 }); }
// 垃圾桶一對：一般垃圾（綠蓋）＋資源回收（藍蓋）
function cityBins(x, z, ry) { const T = cAt(x, z, ry); [[-.3, '#16a34a'], [.3, '#2563eb']].forEach(([px, c]) => { T.P(cylG(.22, .2, .78, 10), '#6b7280', M4(px, .39, 0)); T.P(cylG(.24, .24, .08, 10), c, M4(px, .82, 0)); T.B(.2, .12, .02, c, px, .55, .215); }); addCol({ x: CITY.x + x, z: CITY.z + z, r: .5 }); }
function cityCar(x, z, ry, c) {
  const T = cAt(x, z, ry), dk = '#111827', gl = '#1e3a5f';
  T.B(3.9, .62, 1.7, c, 0, .72, 0); T.B(2.1, .58, 1.56, c, -.2, 1.31, 0); T.B(2.12, .38, 1.58, gl, -.2, 1.34, 0); T.B(3.94, .08, 1.74, '#d1d5db', 0, .46, 0);
  [[1.25, .82], [-1.25, .82], [1.25, -.82], [-1.25, -.82]].forEach(([wx, wz]) => { T.P(cylG(.36, .36, .26, 14), dk, M4(wx, .36, wz, Math.PI / 2)); T.P(cylG(.18, .18, .27, 10), '#e5e7eb', M4(wx, .36, wz, Math.PI / 2)); });
  [-.55, .55].forEach(wz => { T.B(.05, .14, .3, '#fef9c3', 1.96, .78, wz); T.B(.05, .12, .26, '#ef4444', -1.96, .8, wz); });
}
// 微笑單車站：橘黃色停車柱、幾台單車（車籃、坐墊）、刷卡機；站名牌立在兩根柱子之間（柱子在板子兩側外面）
function cityBikes(x, z, n) {
  const T = cAt(x, z, Math.PI), y = '#f59e0b', ring = geoC('wheel', () => new THREE.TorusGeometry(.3, .03, 5, 14)), half = (n - 1) / 2 * .78;
  T.B(n * .78 + .4, .08, .3, '#9ca3af', 0, .04, -.6);
  for (let i = 0; i < n; i++) { const bx = (i - (n - 1) / 2) * .78; T.B(.1, .85, .22, y, bx, .43, -.6); T.B(.12, .12, .12, '#1f2937', bx, .7, -.48);
    if (i % 4 === 3) continue; [-.55, .55].forEach(bz => T.P(ring, '#1f2937', M4(bx, .32, -.05 + bz, 0, Math.PI / 2, 0)));
    T.B(.05, .05, 1, y, bx, .55, -.05, .25); T.B(.05, .45, .05, y, bx, .52, -.35, -.2); T.B(.05, .45, .05, y, bx, .55, .35, .3); T.B(.16, .06, .26, '#1f2937', bx, .82, -.4); T.B(.5, .04, .04, '#374151', bx, .95, .42); T.B(.24, .16, .2, y, bx, .78, .55); }
  const kx = half + .9; T.B(.55, 1.6, .4, y, kx, .8, -.6); T.B(.4, .3, .02, '#0f172a', kx, 1.25, -.39);
  [-1, 1].forEach(s => T.B(.07, 2.3, .07, '#64748b', s * 1.05, 1.15, -.95)); T.B(2.17, .06, .06, '#64748b', 0, 2.33, -.95); T.S(1.9, .475, .04, CZ.sg.bike, 0, 2.05, -.95, [4, 5]);
  addCol({ box: [CITY.x + x - half - 1.3, CITY.z + z - .5, CITY.x + x + half + .5, CITY.z + z + 1.05] });
}
// 東南角的小公園：史萊姆雕像（大城市居民捐贈）、花圃、長椅、史萊姆造型的搖搖椅、四棵樹、入口的園名牌
function cityParkSE(x, z) {
  const T = cAt(x, z, Math.PI); // 雕像面向北邊的大街
  T.B(2.6, .9, 2.6, '#a8a29e', 0, .45, 0); T.B(2.9, .15, 2.9, '#d6d3d1', 0, .97, 0);
  T.P(sphG(1, 16, 12), '#fbbf24', M4(0, 1.95, 0, 0, 0, 0, 1.15, .95, 1.15)); T.P(sphG(.32, 10, 8), '#fde68a', M4(-.45, 2.45, .55)); // 雕像身體與反光
  [-1, 1].forEach(s => { T.P(sphG(.15, 8, 6), '#1c1917', M4(s * .32, 2.15, .95, 0, 0, 0, 1, 1.3, .6)); T.P(sphG(.05, 6, 4), '#ffffff', M4(s * .32 + .05, 2.25, 1.03)); T.P(sphG(.12, 8, 6), '#fb7185', M4(s * .58, 1.95, .82, 0, 0, 0, 1, .6, .5)); });
  T.S(1.5, .375, 0, CZ.sg.statue, 0, .5, 1.31);
  addCol({ box: [CITY.x + x - 1.4, CITY.z + z - 1.4, CITY.x + x + 1.4, CITY.z + z + 1.4] });
  [-1, 1].forEach(s => cityPlanter(x + s * 4.2, z, 1.2, 3, s + 5));
  cityBench(x, z - 5.2, 0); cityBench(x, z + 5.2, Math.PI);
  [[-6.5, -7.5], [6.5, -7.5], [-6.5, 8], [6.5, 8]].forEach(([dx, dz], i) => cityTree(x + dx, z + dz, 1, i + 3));
  { const R = cAt(x + 5, z + 4.6); R.P(cylG(.06, .06, .5, 6), '#6b7280', M4(0, .25, 0)); R.P(sphG(.45, 12, 8), '#6ee7a8', M4(0, .78, 0, 0, 0, 0, 1, .8, 1.2)); [-1, 1].forEach(s => { R.P(sphG(.07, 6, 4), '#1c1917', M4(s * .15, .9, .48)); R.B(.5, .04, .04, '#facc15', 0, 1.05, .25 + s * .05); }); addCol({ x: CITY.x + x + 5, z: CITY.z + z + 4.6, r: .5 }); }
  const S = cAt(x, z - 9.6); [-1, 1].forEach(s => S.B(.1, 1.6, .1, '#6b4a33', s * .95, .8, 0, 0, 0, 0, 'wood')); S.S(1.6, .4, .06, CZ.sg.park, 0, 1.35, 0, [4, 5]);
}
// 西南角的小公園：涼亭（四根柱子、四角攢尖的屋頂）、亭子裡的長椅、四棵樹、花圃
function cityParkSW(x, z) {
  const T = cAt(x, z), wd = '#8b5a3c';
  [-1, 1].forEach(a => [-1, 1].forEach(b => T.B(.22, 2.8, .22, wd, a * 1.8, 1.4, b * 1.8, 0, 0, 0, 'wood')));
  T.B(4.2, .2, 4.2, wd, 0, 2.85, 0, 0, 0, 0, 'wood'); T.P(geoC('roof4', () => new THREE.ConeGeometry(1, 1, 4)), '#b45309', M4(0, 3.55, 0, 0, Math.PI / 4, 0, 3.6, 1.3, 3.6)); T.P(sphG(.16, 8, 6), '#facc15', M4(0, 4.25, 0));
  T.B(4, .12, 4, '#d6d3d1', 0, .06, 0);
  [-1, 1].forEach(s => { T.B(2.8, .06, .4, '#a0703f', 0, .45, s * 1.45, 0, 0, 0, 'wood'); [-1.2, 1.2].forEach(px => T.B(.08, .42, .3, '#6b7280', px, .21, s * 1.45)); addCol({ box: [CITY.x + x - 1.4, CITY.z + z + s * 1.45 - .2, CITY.x + x + 1.4, CITY.z + z + s * 1.45 + .2] }); });
  [-1, 1].forEach(a => [-1, 1].forEach(b => addCol({ x: CITY.x + x + a * 1.8, z: CITY.z + z + b * 1.8, r: .18 })));
  [[-6.5, -7.5], [6.5, -7.5], [-6.5, 8], [6.5, 8]].forEach(([dx, dz], i) => cityTree(x + dx, z + dz, 1.05, i + 1));
  [-1, 1].forEach(s => cityPlanter(x + s * 4.4, z + 4.5, 1.4, 1.4, s + 8));
}
// 巷子裡的生活感：木箱、盆栽、貓碗、靠牆的腳踏車、尋貓啟事（貼在器材行西側牆上）
function cityAlley() {
  const A = cAt(), B = A.B, P = A.P;
  B(.7, .6, .6, '#a0703f', 10.9, .3, -15.7, 0, .2, 0, 'wood'); B(.6, .5, .55, '#b07f4f', 11, .85, -15.8, 0, -.15, 0, 'wood'); addCol({ box: [CITY.x + 10.4, CITY.z - 16.2, CITY.x + 11.4, CITY.z - 15.3] });
  [[7.1, -14.6], [11.5, -14.5]].forEach(([x, z], i) => { P(cylG(.22, .16, .36, 8), '#c2410c', M4(x, .18, z)); P(blobG(.32, i + 20), '#4c9a45', M4(x, .58, z)); });
  P(cylG(.13, .1, .06, 10), '#60a5fa', M4(8, .03, -15.9)); P(cylG(.1, .1, .02, 10), '#a16207', M4(8, .06, -15.9));
  A.S(.55, 1.1, 0, CZ.sg.lost, 11.98, 1.55, -15.3, [4], 0, -Math.PI / 2, 0);
  B(.5, .9, .45, '#6b7280', -9.3, .45, -16.8); B(.52, .08, .47, '#16a34a', -9.3, .94, -16.8); B(.5, .9, .45, '#6b7280', -8.6, .45, -16.8); B(.52, .08, .47, '#2563eb', -8.6, .94, -16.8); addCol({ box: [CITY.x - 9.6, CITY.z - 17.05, CITY.x - 8.3, CITY.z - 16.55] });
  { const T = cAt(-7.1, -17.6, Math.PI / 2 + .1), ring = geoC('wheel', () => new THREE.TorusGeometry(.3, .03, 5, 14)); [-.55, .55].forEach(bz => T.P(ring, '#1f2937', M4(0, .32, bz, 0, Math.PI / 2, 0))); T.B(.05, .05, 1, '#16a34a', 0, .55, 0, .25); T.B(.05, .45, .05, '#16a34a', 0, .52, -.3, -.2); T.B(.16, .06, .26, '#1f2937', 0, .82, -.35); T.B(.5, .04, .04, '#374151', 0, .95, .42); }
  for (let i = 0; i < 3; i++) B(.6, .45, .6, ['#c08552', '#a0703f', '#b98a5a'][i], -26.2 + (i % 2) * .2, .23 + i * .45, -16.5, 0, i * .3, 0, 'wood'); addCol({ box: [CITY.x - 26.6, CITY.z - 16.9, CITY.x - 25.7, CITY.z - 16.1] });
  [[24.05, -17], [24.05, -20.5], [29.45, -18.6]].forEach(([x, z], i) => B(.3, .5, .7, '#e9e4da', x + (i < 2 ? .15 : -.15), 1.6 + i * .7, z));
  [[26.8, -15], [27.6, -15.2]].forEach(([x, z], i) => { P(cylG(.2, .15, .34, 8), '#b45309', M4(x, .17, z)); P(blobG(.28, i + 30), '#5aa84f', M4(x, .52, z)); });
}
/* ---------- 大城市會動的東西與彩蛋 ---------- */
// 城市的小音效（都很輕，有些會隨距離變小）
const cSnd = f => { if (!S.sound) return; try { const ac = audio(); f(ac, ac.currentTime); } catch (e) { } };
const citySnd = {
  meow: (v = 1) => cSnd((ac, t) => { const f = rnd(.9, 1.2); sweep(560 * f, 900 * f, t, .12, .045 * v, 'triangle'); sweep(900 * f, 470 * f, t + .1, .32, .045 * v, 'triangle'); }),
  purr: () => cSnd((ac, t) => { for (let i = 0; i < 12; i++) noise(ac, t + i * .09, .08, 150, 1.2, .06, 'lowpass'); }),
  flap: v => cSnd((ac, t) => { for (let i = 0; i < 14; i++) noise(ac, t + i * .045 + Math.random() * .02, .05, rnd(800, 1500), 1.4, .05 * v, 'bandpass'); }),
  coo: v => cSnd((ac, t) => { sweep(430, 380, t, .22, .02 * v); sweep(380, 430, t + .24, .26, .02 * v); }),
  bell: v => cSnd((ac, t) => { tone(1046.5, t, 1.6, .05 * v); tone(1568, t, 1.1, .02 * v); tone(523.25, t, 1.9, .025 * v); }),
  ding: () => cSnd((ac, t) => { tone(1318.5, t, .55, .06); tone(1046.5, t + .34, .9, .06); }),
  clunk: () => cSnd((ac, t) => { noise(ac, t, .14, 240, 1, .16, 'lowpass'); noise(ac, t + .02, .06, 1300, 2, .05, 'bandpass'); }),
  fizz: () => cSnd((ac, t) => { for (let i = 0; i < 16; i++) noise(ac, t + i * .03, .04, rnd(3000, 6500), 3, .025, 'highpass'); sweep(300, 1300, t, .22, .03); }),
  gurgle: () => cSnd((ac, t) => { for (let i = 0; i < 6; i++) sweep(rnd(140, 220), rnd(260, 420), t + i * .12, .1, .05); }),
  squeak: () => cSnd((ac, t) => { sweep(900, 1600, t, .09, .04, 'triangle'); sweep(1500, 1100, t + .09, .08, .03, 'triangle'); }),
};
// 店裡的聲音（音量跟城市小音效同級、不用 sfx.bad）：門鈴每間店不同
const shopSnd = {
  chime: id => cSnd((ac, t) => { if (id === 'mach') { tone(1318.5, t, .5, .04); tone(987.8, t + .28, .8, .04); } else if (id === 'mall') sweep(1046.5, 784, t, .6, .035); else if (id === 'gear') [659, 880, 1175].forEach((f, i) => tone(f, t + i * .11, .35, .03, 'triangle')); else { noise(ac, t, .06, 1800, 3, .05, 'bandpass'); noise(ac, t + .14, .06, 1800, 3, .04, 'bandpass'); tone(523, t + .05, .5, .03); } }),
  take: () => cSnd((ac, t) => { noise(ac, t, .05, 2400, 1.5, .05, 'bandpass'); sweep(600, 900, t, .06, .02, 'triangle'); }),
  put: () => cSnd((ac, t) => noise(ac, t, .06, 300, 1, .07, 'lowpass')),
  purse: () => { if (S.sound && sfx.squish) sfx.squish(.6, 1.3); },
  coin: i => cSnd((ac, t) => { const k = Math.pow(1.06, i); tone(1318.5 * k, t, .12, .05, 'triangle'); tone(2637 * k, t, .05, .02); }),
  till: () => cSnd((ac, t) => { tone(1318.5, t, .12, .06, 'triangle'); tone(1975.5, t + .07, .3, .05, 'triangle'); noise(ac, t + .05, .18, 800, 1, .05, 'lowpass'); tone(2093, t + .12, .25, .03); }),
  stamp: () => cSnd((ac, t) => noise(ac, t, .08, 160, 1, .12, 'lowpass')),
  wrap: () => cSnd((ac, t) => { for (let i = 0; i < 8; i++) noise(ac, t + i * .038, .03, rnd(3000, 6000), 2, .03, 'bandpass'); }),
  inflate: () => cSnd((ac, t) => sweep(300, 900, t, .18, .03)),
  flyAway: () => cSnd((ac, t) => sweep(600, 1200, t, 1.2, .012)),
  pocket: () => cSnd((ac, t) => { noise(ac, t, .15, 3000, 1.5, .04, 'bandpass'); tone(880, t + .08, .08, .03, 'triangle'); }),
  shake: () => cSnd((ac, t) => noise(ac, t, .08, 1200, 2, .04, 'bandpass')),
  dust: () => cSnd((ac, t) => { noise(ac, t, .12, 600, 1, .05, 'lowpass'); sweep(660, 523, t + .05, .15, .03, 'triangle'); sweep(587, 466, t + .22, .15, .025, 'triangle'); }),
  heart: () => cSnd((ac, t) => sweep(1200, 1800, t, .08, .03, 'triangle')),
  coat: () => cSnd((ac, t) => { noise(ac, t, .25, 1200, 1, .05, 'bandpass'); sweep(300, 120, t + .1, .12, .03); }),
  shutter: () => cSnd((ac, t) => { for (let i = 0; i < 14; i++) noise(ac, t + i * .11, .06, 900, 2, .03, 'bandpass'); }),
};
// 城市裡的表情泡泡（愛心、音符、問號、驚嘆號）：跟史萊姆共用同一組圖，冒出來、晃一晃、淡出
function cityBubble(par, k, y, dur = 1.6) {
  let b = par.userData.bub; if (!b) { b = par.userData.bub = new THREE.Sprite(new THREE.SpriteMaterial({ map: emoTex(k), transparent: true, depthWrite: false, fog: false })); b.renderOrder = 3; par.add(b); }
  b.material.map = emoTex(k); Object.assign(b.userData, { t: 0, dur, y }); b.visible = true; (W.cityBubs = W.cityBubs || new Set()).add(b);
}
function cityBubbleStep(dt) {
  if (W.cityBubs) W.cityBubs.forEach(b => { const u = b.userData; u.t += dt; const a = Math.min(1, u.t / .18), pop = a < 1 ? .3 + .7 * a + .35 * Math.sin(a * Math.PI) : 1; b.scale.setScalar(.42 * pop); b.material.opacity = clamp((u.dur - u.t) / .3, 0, 1); b.position.y = u.y + Math.sin(u.t * 4) * .03; if (u.t >= u.dur) { b.visible = false; W.cityBubs.delete(b); } });
}
const lerpAng = (a, b, k) => a + Math.atan2(Math.sin(b - a), Math.cos(b - a)) * k;
function buildCityFx(g) {
  const F = W.cfx; buildSignals(g); F.vend = buildVend(g); F.cat = buildCat(g); F.pg = buildPigeons(g); F.scr = buildScreen(g); F.sill = buildSill(g); F.hole = buildHole(g); F.door = buildDoors(g);
  W.anim.push((dt, t) => { if (W.city && inCity()) cityStep(dt, t); });
}
// 每一幀（只在大城市）：夜燈亮度、紅綠燈、販賣機、橘貓、鴿子、大螢幕、花箱史萊姆、人孔蓋、自動門、鐘塔報時、表情泡泡
function cityStep(dt, t) {
  const F = W.cfx, n = DN.night, nk = Math.round(n * 40);
  if (nk !== W.cityNK && W.cityGlowM) { W.cityNK = nk; W.cityGlowM.emissiveIntensity = .22 + n * 1.8; W.citySignM.emissiveIntensity = .05 + n * .95; if (W.shopInM) W.shopInM.emissiveIntensity = .3 + n * .35; if (W.tagM) W.tagM.emissiveIntensity = .3 + n * .3; if (W.cityPoolM) { W.cityPoolM.opacity = n * .9; W.cityPool.visible = n > .03; } }
  sigStep(t, F.sig); vendStep(dt, F.vend); catStep(dt, t, F.cat); pigeonStep(dt, t, F.pg); screenStep(dt, t, F.scr); sillStep(dt, t, F.sill); holeStep(dt, t, F.hole); doorStep(dt, F.door); cuckooStep(F.ck); cityBubbleStep(dt); shopStep(dt, t);
}
/* 紅綠燈：兩個路口各兩支號誌桿，有車道燈、行人號誌（台灣的小綠人：綠燈時走路，最後幾秒跑起來、旁邊倒數）與路燈。
   全部燈面共用一張小畫布（一個網格），狀態改變才重畫。月光大道的路名牌掛在廣場那側的桿子旁邊（桿子在牌子外側，牌子後面是廣場，不會擋到商店招牌） */
function buildSignals(g) {
  const cv = document.createElement('canvas'); cv.width = 128; cv.height = 128; const tx = new THREE.CanvasTexture(cv); tx.colorSpace = THREE.SRGBColorSpace;
  const quads = [], q = (u0, du, m) => { const p = UPLN.clone(), uv = p.attributes.uv; for (let i = 0; i < 4; i++) uv.setXY(i, u0 + uv.getX(i) * du, uv.getY(i)); quads.push(p.applyMatrix4(m)); };
  [[-12.9, -7.7, 1], [-9.1, 7.7, -1], [9.1, -7.7, 1], [12.9, 7.7, -1]].forEach(([x, z, s], i) => {
    const T = cAt(x, z), pc = '#5b6673';
    T.B(.3, .3, .3, pc, 0, .15, 0); T.P(cylG(.07, .09, 4.6, 8), pc, M4(0, 2.3, 0));
    T.B(.28, .92, .3, '#1f2937', s * .25, 3.1, 0); q(0, .375, M4(x + s * .4, 3.1, z, 0, s * Math.PI / 2, 0, .2, .76, 1)); // 車道燈（朝來車）
    T.B(.36, .62, .26, '#1f2937', 0, 2.3, s * .2); q(.375, .625, M4(x, 2.3, z + s * .34, 0, s > 0 ? 0 : Math.PI, 0, .3, .5, 1)); // 行人號誌（朝對街）
    T.B(.07, .07, 1.3, pc, 0, 4.55, s * .62); T.B(.46, .14, .6, pc, 0, 4.5, s * 1.25); T.B(.34, .05, .46, '#fff3c4', 0, 4.41, s * 1.25, 0, 0, 0, 'glow'); CZ.pool.push([x, z + s * 1.25, 4.4]);
    addCol({ x: CITY.x + x, z: CITY.z + z, r: .16 });
    if (i === 1) { T.B(1.85, .05, .05, pc, -1.0, 3.98, 0); T.B(.04, .1, .04, pc, -.4, 3.9, 0); T.B(.04, .1, .04, pc, -1.6, 3.9, 0); T.S(1.6, .4, .04, CZ.sg.street, -1.0, 3.62, 0, [4, 5]); }
  });
  mesh(mergeUV(quads), new THREE.MeshBasicMaterial({ map: tx, toneMapped: false }), 0, 0, 0, g);
  W.cfx.sig = { g2: cv.getContext('2d'), tx, k: '' };
}
function sigStep(t, s) {
  if (Math.abs(P.x - CITY.x) > 75) return;
  const c = (performance.now() / 1000) % 32, veh = c < 14 ? 2 : c < 17 ? 1 : 0, ped = c >= 17.5 && c < 31.5 ? (c > 26.5 ? 2 : 1) : 0, cnt = ped ? Math.ceil(31.5 - c) : 0, fr = ped ? Math.floor(t * (ped === 2 ? 9 : 4.5)) % 4 : 0;
  const k = veh + '|' + ped + '|' + fr + '|' + cnt; if (k === s.k) return; s.k = k; const g = s.g2;
  g.fillStyle = '#0b0f14'; g.fillRect(0, 0, 128, 128);
  ['#ef4444', '#f59e0b', '#22c55e'].forEach((col, i) => { const on = i === veh; g.fillStyle = on ? col : '#262b33'; g.beginPath(); g.arc(24, 22 + i * 42, 17, 0, PI2); g.fill(); if (on) { g.fillStyle = 'rgba(255,255,255,.35)'; g.beginPath(); g.arc(19, 16 + i * 42, 6, 0, PI2); g.fill(); } });
  g.fillStyle = '#05070a'; g.fillRect(48, 0, 80, 128); stickman(g, 54, 4, ped ? '#3a1c1c' : '#ef4444', 'stand'); stickman(g, 50, 68, ped ? '#22c55e' : '#123020', ped ? fr : 'stand', ped === 2);
  if (ped) { g.fillStyle = '#22c55e'; g.font = 'bold 20px monospace'; g.textAlign = 'center'; g.fillText(String(cnt), 112, 116); }
  s.tx.needsUpdate = true;
}
/* 咖啡館東側牆邊的販賣機與扭蛋機：投 ¥10 掉一罐飲料；偶爾（還沒喝過的話第 4 罐保底）掉出發光的「史萊姆汽水」 */
const DRINKS = [['月光麥茶', '#a16207', '冰冰涼涼，喝完神清氣爽。'], ['蜂蜜檸檬', '#facc15', '酸酸甜甜，有一點蜂蜜史萊姆的味道。'], ['罐裝奶茶', '#d6b48a', '搖一搖，好像有珍珠卡在罐子裡……'], ['海鹽汽水', '#38bdf8', '有一點點鹹，像海邊吹來的風。'], ['熱可可', '#7c2d12', '咦？販賣機也有熱的！手心暖暖的。']];
function buildVend(g) {
  const x = -21.5, z = 26.2, T = cAt(x, z, Math.PI / 2), sg = CZ.sg;
  T.B(1, 1.85, .72, '#e2e8f0', 0, .925, .36); T.B(1.02, .12, .74, '#0ea5e9', 0, 1.86, .36); T.S(.84, 1.344, 0, sg.vend, 0, 1.13, .725);
  T.B(.6, .2, .06, '#111827', 0, .24, .73); T.B(.5, .14, .02, '#374151', 0, .24, .765); T.B(.5, .03, .02, '#93c5fd', 0, .41, .735, 0, 0, 0, 'glow'); T.B(.08, .14, .02, '#9ca3af', .38, .26, .735);
  T.B(.55, 1.3, .5, '#f472b6', -1.05, .65, .25); T.B(.57, .08, .52, '#db2777', -1.05, 1.34, .25); T.S(.5, 1, 0, sg.gacha, -1.05, .7, .505); // 扭蛋機
  addCol({ box: [CITY.x + x, CITY.z + z - .55, CITY.x + x + .75, CITY.z + z + 1.35] });
  const hb = hitBox(.9, 1.9, 1.1, x + .45, .95, z, g); addInter(hb, 'station', 'city:vend', '販賣機', { act: vendAct, label: '投 ¥10 買一罐飲料' });
  const can = mesh(new THREE.CylinderGeometry(.034, .034, .12, 12), new THREE.MeshStandardMaterial({ color: '#fff', roughness: .3, metalness: .5, emissive: '#000', emissiveIntensity: .9 }), 0, 0, 0, g); can.visible = false;
  return { can, n: 0, busy: 0, t: 0, tx: x + .8, tz: z };
}
function vendAct() {
  const v = W.cfx.vend; if (v.busy > 0) return;
  if (S.money < 10) { sfx.bad && sfx.bad(); return toast('零錢不夠，一罐要 ¥10。'); }
  S.money -= 10; renderTop(); sfx.coin && sfx.coin(); v.n++;
  const had = W.cityEggs && W.cityEggs.has('city_soda'); v.slime = had ? Math.random() < .12 : (v.n >= 4 || Math.random() < .2);
  v.d = v.slime ? null : pick(DRINKS); v.can.material.color.set(v.slime ? '#4ade80' : v.d[1]); v.can.material.emissive.set(v.slime ? '#22c55e' : '#000000');
  v.busy = 1.7; v.t = 0; setTimeout(() => citySnd.clunk(), 420);
}
function vendStep(dt, v) {
  if (v.busy <= 0) return; v.t += dt; v.busy -= dt; const c = v.can, t = v.t;
  if (t < .5) { c.visible = false; return; } c.visible = true;
  if (t < 1.15) { const k = (t - .5) / .65; c.position.set(v.tx + k * .4, .26 + Math.sin(k * Math.PI) * .38, v.tz); c.rotation.set(0, 0, k * 4); c.scale.setScalar(1); }
  else { const k = Math.min(1, (t - 1.15) / .5), cam = W.cam.position; c.position.lerp(tmpV.set(cam.x - CITY.x, cam.y - .35, cam.z - CITY.z), k * .3); c.scale.setScalar(Math.max(.01, 1 - k)); }
  if (v.busy > 0) return; c.visible = false; const p = new THREE.Vector3(CITY.x + v.tx + .3, 1, CITY.z + v.tz);
  if (v.slime) { citySnd.fizz(); fx3(p, '史萊姆汽水！', '#4ade80', 'big'); if (W.goo) W.goo.emit(p, 12, '#4ade80', { gy: .01, up: 2.6, speed: 1.2, size: .05 }); bark(SELF, '喀咚！掉出一罐發光的「史萊姆汽水」。喝一口……QQ 彈彈的，嘴巴裡冒出綠色泡泡。', { egg: 'city_soda' }); cityEgg('city_soda'); } // 自己的想法雲，章蓋在同一朵雲上
  else { sfx.pop && sfx.pop(); bark(SELF, '喀咚！掉出一罐「' + v.d[0] + '」。' + v.d[2]); }
}
/* 橘貓：平常趴在生活百貨與器材行之間的巷口（吐司坐姿），玩家慢慢走近就起身跟著走一小段（跑太快會跟丟），走累了回巷口。
   按 E 摸摸頭會呼嚕。跟著走超過 7 公尺就算發現彩蛋 */
const CAT_HOME = [8.6, -15.2];
function catMesh() {
  const mat = W.npcMat || (W.npcMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: .78, metalness: 0 })), RB = (w, h, d, r) => roundBox(w, h, d, r, LOW ? 1 : 2);
  const o = '#f59e3b', dk = '#c2410c', wh = '#fff7ed', pk = '#f9a8d4', root = new THREE.Group(), body = new THREE.Group(); root.add(body);
  const M = (parts, par) => { const m = new THREE.Mesh(mergeParts(parts, true), mat); m.castShadow = !LOW; par.add(m); return m; };
  M([[RB(.2, .18, .42, .07), o, M4(0, .3, 0)], [RB(.14, .08, .3, .035), wh, M4(0, .235, .02)], ...[-.1, 0, .1].map(z => [RB(.21, .03, .045, .012), dk, M4(0, .385, z - .03)])], body);
  const head = new THREE.Group(); head.position.set(0, .4, .22); body.add(head);
  M([[RB(.2, .16, .16, .06), o, M4(0, .04, .02)], [RB(.1, .06, .05, .022), wh, M4(0, 0, .095)], [RB(.03, .035, .01, .005), dk, M4(0, .115, .085)], [new THREE.BoxGeometry(.022, .014, .01), pk, M4(0, .018, .121)],
    ...[-1, 1].flatMap(s => [[new THREE.ConeGeometry(.045, .09, 4), o, M4(s * .062, .15, .01, 0, Math.PI / 4, -s * .25)], [new THREE.ConeGeometry(.024, .05, 4), pk, M4(s * .06, .145, .025, 0, Math.PI / 4, -s * .25)], [new THREE.BoxGeometry(.028, .038, .01), '#1c1917', M4(s * .048, .05, .1)], [new THREE.BoxGeometry(.01, .01, .01), '#ffffff', M4(s * .048 + .006, .062, .106)]])], head);
  const tail = new THREE.Group(); tail.position.set(0, .34, -.2); body.add(tail);
  M([[new THREE.CylinderGeometry(.03, .035, .22, 6), o, M4(0, .08, -.06, -.6)], [new THREE.CylinderGeometry(.026, .03, .18, 6), dk, M4(0, .22, -.1, -.15)], [new THREE.SphereGeometry(.028, 6, 4), dk, M4(0, .31, -.11)]], tail);
  const leg = (x, z) => [RB(.055, .2, .06, .02), o, M4(x, .1, z)], paw = (x, z) => [RB(.06, .035, .07, .015), wh, M4(x, .018, z + .006)];
  const lA = M([leg(-.055, .14), paw(-.055, .14), leg(.055, -.13), paw(.055, -.13)], body), lB = M([leg(.055, .14), paw(.055, .14), leg(-.055, -.13), paw(-.055, -.13)], body);
  return { root, body, head, tail, lA, lB };
}
function buildCat(g) {
  const m = catMesh(), c = { m, x: CAT_HOME[0], z: CAT_HOME[1], yaw: Math.PI * .85, st: 'sit', ft: 0, fd: 0, rt: 0, cd: 0, walk: 0, ph: 0, lf: 1, found: 0 };
  g.add(m.root); m.root.scale.setScalar(1.2); m.root.position.set(c.x, 0, c.z); m.root.rotation.y = c.yaw;
  c.it = addInter(hitBox(.5, .55, .8, 0, .3, 0, m.root), 'station', 'city:cat', '橘貓', { act: catPet, label: '摸摸橘貓' }); c.it.wp = new THREE.Vector3(CITY.x + c.x, .3, CITY.z + c.z);
  return c;
}
function catFollow(c) { c.st = 'follow'; c.ft = 0; c.fd = 0; citySnd.meow(.8); cityBubble(c.m.root, Math.random() < .5 ? 'q' : 'note', .78, 1.3); }
function catPet() { const c = W.cfx.cat; citySnd.purr(); cityBubble(c.m.root, 'heart', .78, 1.8); fx3(new THREE.Vector3(CITY.x + c.x, .9, CITY.z + c.z), '呼嚕呼嚕～', '#fdba74'); c.cd = 0; if (c.st !== 'follow') catFollow(c); }
// 貓走得到的地方：跟玩家共用碰撞資料（不穿牆、不穿長椅），也不離開街區
function catFree(x, z) {
  if (Math.abs(x) > 69 || z < -29.5 || z > 43.5) return false; const wx = CITY.x + x, wz = CITY.z + z, r = .22, cb = cabBlock(wx, wz, r); if (cb[0] !== wx || cb[1] !== wz) return false; // 計程車（會動，不在碰撞格子裡）
  for (const c of colsNear(wx, wz)) { if (c.box) { const [x0, z0, x1, z1] = c.box; if (wx > x0 - r && wx < x1 + r && wz > z0 - r && wz < z1 + r) return false; } else if (Math.hypot(wx - c.x, wz - c.z) < c.r + r) return false; }
  return true;
}
function catStep(dt, t, c) {
  const px = P.x - CITY.x, pz = P.z - CITY.z, dx = px - c.x, dz = pz - c.z, d = Math.hypot(dx, dz), m = c.m;
  m.root.visible = d < 55; c.it.off = !m.root.visible; if (!m.root.visible) return;
  let tx = null, tz = null, spd = 0; c.cd = Math.max(0, c.cd - dt);
  if (c.st === 'sit' && d < 3 && !P.running && !RIDE.on && c.cd <= 0) catFollow(c); // 經過的計程車（裡面坐著你）不會被橘貓跟
  if (c.st === 'follow') {
    c.ft += dt;
    if (d > 12 || c.ft > 35) { c.st = 'rest'; c.rt = rnd(5, 9); c.cd = 6; if (d < 20) citySnd.meow(.5); }
    else if (d > 1.7) { const sy = Math.sin(P.yaw), cy = Math.cos(P.yaw); tx = px + sy * 1.2 + cy * .55; tz = pz + cy * 1.2 - sy * .55; spd = clamp(d * 1.5, 1.2, 4.9); }
    if (!c.found && c.fd > 7) { c.found = 1; cityEgg('city_cat'); citySnd.meow(1); cityBubble(m.root, 'heart', .78, 2); }
  } else if (c.st === 'rest') { c.rt -= dt; if (c.rt < 0) c.st = 'home'; }
  else if (c.st === 'home') {
    const [hx, hz] = CAT_HOME; if (c.z > -13.6 && Math.abs(c.x - hx) > .7) { tx = hx; tz = -12.6; } else { tx = hx; tz = hz; } spd = 1.6;
    if (Math.hypot(hx - c.x, hz - c.z) < .3) { c.st = 'sit'; c.cd = 4; }
    if (d < 2.4 && !P.running && !RIDE.on && c.cd <= 0) catFollow(c);
  }
  let mv = 0;
  if (tx != null) { const ex = tx - c.x, ez = tz - c.z, l = Math.hypot(ex, ez); if (l > .08) { const s = Math.min(l, spd * dt), nx = c.x + ex / l * s, nz = c.z + ez / l * s, ox = c.x, oz = c.z; if (catFree(nx, nz)) { c.x = nx; c.z = nz; } else if (catFree(nx, c.z)) c.x = nx; else if (catFree(c.x, nz)) c.z = nz; const moved = Math.hypot(c.x - ox, c.z - oz); mv = moved / Math.max(dt, 1e-3); if (c.st === 'follow') c.fd += moved; c.yaw = lerpAng(c.yaw, Math.atan2(ex, ez), Math.min(1, dt * 7)); } }
  else if (c.st !== 'sit' && d < 4) c.yaw = lerpAng(c.yaw, Math.atan2(dx, dz), Math.min(1, dt * 3));
  // 動畫：走路時對角兩組腳前後交替、尾巴翹高；停下來趴成一條吐司，尾巴慢慢甩
  c.walk += ((mv > .2 ? 1 : 0) - c.walk) * Math.min(1, dt * 8); c.ph += dt * (4 + mv * 3.2);
  const sw = Math.sin(c.ph) * .06 * c.walk, loaf = (c.st === 'sit' || c.st === 'rest') && c.walk < .1 ? 1 : 0; c.lf += (loaf - c.lf) * Math.min(1, dt * 4);
  m.lA.position.set(0, Math.max(0, Math.sin(c.ph)) * .025 * c.walk, sw); m.lB.position.set(0, Math.max(0, -Math.sin(c.ph)) * .025 * c.walk, -sw); m.lA.scale.y = m.lB.scale.y = 1 - c.lf * .85;
  m.body.position.y = -c.lf * .16 + Math.abs(Math.cos(c.ph)) * .012 * c.walk;
  m.tail.rotation.x = c.walk > .5 ? -.25 + Math.sin(t * 6) * .1 : -.25 - c.lf * 1.45; m.tail.rotation.z = Math.sin(t * (c.st === 'follow' ? 3 : 1.3)) * (.35 + c.lf * .25); // 趴著時尾巴貼地慢慢甩
  const rel = Math.atan2(Math.sin(Math.atan2(dx, dz) - c.yaw), Math.cos(Math.atan2(dx, dz) - c.yaw)); m.head.rotation.y += ((d < 5 ? clamp(rel, -1, 1) : Math.sin(t * .5) * .3) - m.head.rotation.y) * Math.min(1, dt * 4);
  m.root.position.set(c.x, 0, c.z); m.root.rotation.y = c.yaw; c.it.wp.set(CITY.x + c.x, .3, CITY.z + c.z);
}
/* 鴿群：在陳伯伯腳邊啄麵包屑；玩家跑過去或走得太近，整群一起飛起來，在廣場上空繞幾圈再降落 */
const PG_HOME = [-3.4, 33.6];
const pgSpot = () => { for (let k = 0; k < 20; k++) { const a = rnd(0, PI2), r = rnd(.6, 2.8), x = PG_HOME[0] + Math.cos(a) * r, z = PG_HOME[1] + Math.sin(a) * r; if (Math.hypot(x + 4.6, z - 31.6) > .7 && Math.hypot(x, z - 28) > 4.2) return [x, z]; } return PG_HOME.slice(); };
function buildPigeons(g) {
  const N = LOW ? 7 : 12, mat = W.npcMat || (W.npcMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: .78, metalness: 0 }));
  const geo = mergeParts([[new THREE.SphereGeometry(.12, 8, 6), '#9aa3b2', M4(0, .15, 0, 0, 0, 0, 1, .85, 1.5)], [new THREE.SphereGeometry(.075, 8, 6), '#5f7f73', M4(0, .23, .1)], [new THREE.SphereGeometry(.06, 8, 6), '#7b8494', M4(0, .29, .15)],
    [new THREE.ConeGeometry(.018, .06, 5), '#e5e7eb', M4(0, .285, .21, Math.PI / 2)], [new THREE.BoxGeometry(.1, .02, .14), '#6b7280', M4(0, .16, -.2, .25)], ...[-1, 1].map(s => [new THREE.BoxGeometry(.02, .07, .16), '#6b7280', M4(s * .1, .17, -.02)]),
    ...[-1, 1].map(s => [new THREE.BoxGeometry(.015, .08, .015), '#f87171', M4(s * .04, .04, .02)]), ...[-1, 1].map(s => [new THREE.SphereGeometry(.012, 4, 3), '#111827', M4(s * .04, .3, .19)])], true);
  const im = new THREE.InstancedMesh(geo, mat, N), wing = new THREE.InstancedMesh(wingGeo(.3, .2, '#a3acb9', '#6b7280'), flapMat(20, 1.15), N);
  im.frustumCulled = wing.frustumCulled = false; im.instanceMatrix.setUsage(THREE.DynamicDrawUsage); wing.instanceMatrix.setUsage(THREE.DynamicDrawUsage); im.castShadow = !LOW; g.add(im, wing);
  const col = new THREE.Color(), list = Array.from({ length: N }, (_, i) => { im.setColorAt(i, col.set(i % 5 === 0 ? '#d8c2a6' : i % 4 === 1 ? '#c7ccd4' : '#ffffff')); const [x, z] = pgSpot(); return { x, z, y: 0, yaw: rnd(0, PI2), st: 0, pk: rnd(0, 1.5), peck: 0, hop: 0, t: 0 }; });
  im.instanceColor.needsUpdate = true;
  return { im, wing, list, cd: 0, coo: 3, q: new THREE.Quaternion(), e: new THREE.Euler(), v: new THREE.Vector3(), s: new THREE.Vector3(1, 1, 1), m: new THREE.Matrix4(), Z: new THREE.Matrix4().makeScale(0, 0, 0) };
}
function pigeonStep(dt, t, F) {
  const px = P.x - CITY.x, pz = P.z - CITY.z, d0 = Math.hypot(px - PG_HOME[0], pz - PG_HOME[1]); if (d0 > 70) return;
  F.cd -= dt; let scare = false;
  F.list.forEach(p => { if (p.st === 0) { const d = Math.hypot(px - p.x, pz - p.z); if (d < 1.7 || (P.running && d < 5.5)) scare = true; } });
  if (scare && F.cd <= 0) {
    F.cd = 2; let n = 0; const dir = Math.random() < .5 ? 1 : -1;
    F.list.forEach(p => { if (p.st !== 0) return; p.st = 1; p.t = -rnd(0, .3); p.sx = p.x; p.sz = p.z; p.a = Math.atan2(p.z - 30, p.x + 1); p.r = rnd(6, 11); p.h = rnd(7, 12); p.w = rnd(.8, 1.2) * dir; p.dur = rnd(7, 10); n++; });
    if (n) { citySnd.flap(clamp(1 - d0 / 30, .2, 1)); W.pgScare = performance.now(); cityEgg('city_pigeons'); }
  }
  if (d0 < 9 && (F.coo -= dt) < 0) { F.coo = rnd(3, 7); if (F.list.some(p => p.st === 0)) citySnd.coo(1 - d0 / 9); }
  const { q, e, v, s, m, Z } = F;
  F.list.forEach((p, i) => {
    let pitch = 0, fly = false;
    if (p.st === 0) { // 地上：啄啄、小跳步，離家太遠就轉回來
      p.pk -= dt; if (p.pk < 0) { p.pk = rnd(.4, 1.6); p.peck = .35; if (Math.random() < .35) { p.hop = .3; const hx = PG_HOME[0] - p.x, hz = PG_HOME[1] - p.z; p.yaw = Math.hypot(hx, hz) > 2.6 ? Math.atan2(hx, hz) : p.yaw + rnd(-1.3, 1.3); } }
      if (p.hop > 0) { p.hop -= dt; p.x += Math.sin(p.yaw) * dt * .6; p.z += Math.cos(p.yaw) * dt * .6; }
      if (p.peck > 0) { p.peck -= dt; pitch = Math.sin((.35 - p.peck) / .35 * Math.PI) * .55; } p.y = 0;
    } else if (p.st === 1) { // 飛：先起飛，再繞著廣場盤旋
      p.t += dt; const tt = Math.max(0, p.t), k = smooth(0, 1.4, tt), a = p.a + p.w * tt, cx = -1 + Math.cos(a) * p.r, cz = 30 + Math.sin(a) * p.r;
      const nx = p.sx + (cx - p.sx) * k, nz = p.sz + (cz - p.sz) * k, ny = (p.h + Math.sin(tt * 1.3 + i) * .5) * k; if (tt > 0) p.yaw = Math.atan2(nx - p.x, nz - p.z) || p.yaw; p.x = nx; p.z = nz; p.y = ny; fly = tt > 0;
      if (tt > p.dur) { p.st = 2; p.t = 0; p.sx = p.x; p.sz = p.z; p.sy = p.y; [p.lx, p.lz] = pgSpot(); }
    } else { // 降落：滑翔回地面
      p.t += dt; const k = smooth(0, 2.4, p.t), nx = p.sx + (p.lx - p.sx) * k, nz = p.sz + (p.lz - p.sz) * k; p.yaw = lerpAng(p.yaw, Math.atan2(p.lx - p.sx, p.lz - p.sz), Math.min(1, dt * 4)); p.x = nx; p.z = nz; p.y = p.sy * (1 - k); fly = k < .97; pitch = -.2 * (1 - k);
      if (p.t >= 2.4) { p.st = 0; p.y = 0; p.pk = rnd(.2, 1); }
    }
    e.set(pitch, p.yaw, 0); q.setFromEuler(e); m.compose(v.set(p.x, p.y, p.z), q, s); F.im.setMatrixAt(i, m);
    if (fly) { m.compose(v.set(p.x, p.y + .2, p.z), q, s); F.wing.setMatrixAt(i, m); } else F.wing.setMatrixAt(i, Z);
  });
  F.im.instanceMatrix.needsUpdate = true; F.wing.instanceMatrix.needsUpdate = true;
}
/* 生活百貨樓頂的大螢幕：輪播「歡迎來到大城市」、史萊姆汽水廣告、你的直播精華（還沒直播過就介紹你的工坊）、本週直播排行、尋貓啟事。
   支架、維修走道都在螢幕後面與下方，不擋畫面；只在城市、看得到時重畫 */
const SCR_SEQ = ['hello', 'soda', 'me', 'rank', 'cat', 'me'];
function buildScreen(g) {
  const T = cAt(0, -17.2); T.B(10.7, 6.3, .35, '#1f2937', 0, 12.2, -.22); [-4, 0, 4].forEach(px => { T.B(.3, 3.8, .3, '#475569', px, 10.3, -.72); T.B(.16, .16, 2.6, '#475569', px, 9.5, -1.6, .75); });
  T.B(10.4, .1, .9, '#64748b', 0, 8.98, -.1); T.B(10.7, .08, .08, '#93c5fd', 0, 15.39, -.1, 0, 0, 0, 'glow');
  const k = LOW ? .75 : 1, cv = document.createElement('canvas'); cv.width = 512 * k; cv.height = 288 * k; const tx = new THREE.CanvasTexture(cv); tx.colorSpace = THREE.SRGBColorSpace;
  mesh(new THREE.PlaneGeometry(10, 5.625), new THREE.MeshBasicMaterial({ map: tx, toneMapped: false }), 0, 12.2, -16.98, g);
  const s = { g2: cv.getContext('2d'), tx, k, seg: 0, t: 0, fr: 0, me: 0 }; screenDraw(s, 0); return s;
}
function screenStep(dt, t, s) {
  const px = P.x - CITY.x, pz = P.z - CITY.z; if (pz < -17 || Math.hypot(px, pz + 17) > 110) return;
  s.t += dt; if (s.t > 7) { s.t = 0; s.seg = (s.seg + 1) % SCR_SEQ.length; }
  s.fr -= dt; if (s.fr <= 0) { s.fr = LOW ? .25 : .12; screenDraw(s, t); }
  if (SCR_SEQ[s.seg] === 'me') { tmpV.set(CITY.x, 12.2, CITY.z - 17).project(W.cam); const vis = tmpV.z < 1 && Math.abs(tmpV.x) < .85 && Math.abs(tmpV.y) < .85 && Math.hypot(px, pz + 17) < 80; s.me = vis ? s.me + dt : 0; if (s.me > 1.5) cityEgg('city_screen'); } else s.me = 0;
}
function rankList() { const r = seeded(weekNo() * 7 + 3), list = ['軟糖控', '捏捏狂人', 'Mochi', '雲朵', '史萊姆粉', '夜貓子'].map(n => ({ n, v: Math.round(60 + r() * 380) })); list.push({ n: (S.name || '你') + '（你）', v: S.liveBest || 0, me: 1 }); return list.sort((a, b) => b.v - a.v); }
function screenDraw(s, t) {
  const g = s.g2, seg = SCR_SEQ[s.seg], lt = s.t, nm = S.name || '你', av = avatarOf(S.avatar);
  g.setTransform(s.k, 0, 0, s.k, 0, 0); g.textAlign = 'center'; g.textBaseline = 'middle';
  const bg = (a, b) => { const gr = g.createLinearGradient(0, 0, 0, 288); gr.addColorStop(0, a); gr.addColorStop(1, b); g.fillStyle = gr; g.fillRect(0, 0, 512, 288); };
  const tx = (str, x, y, size, col, w = 460, wt = 900) => { g.font = wt + ' ' + size + 'px ' + TC_FONT; g.fillStyle = col; g.fillText(str, x, y, w); };
  const slime = (x, y, r, col, dk, sq = 1) => { const rx = r / Math.sqrt(sq), ry = r * sq; g.fillStyle = col; g.beginPath(); g.ellipse(x, y - ry, rx, ry, 0, Math.PI, 0); g.lineTo(x + rx, y); g.lineTo(x - rx, y); g.fill(); g.fillStyle = 'rgba(255,255,255,.45)'; g.beginPath(); g.ellipse(x - rx * .4, y - ry * 1.4, rx * .18, ry * .14, -.5, 0, PI2); g.fill(); g.fillStyle = dk; g.beginPath(); g.ellipse(x - rx * .3, y - ry * .8, r * .09, r * .13, 0, 0, PI2); g.ellipse(x + rx * .3, y - ry * .8, r * .09, r * .13, 0, 0, PI2); g.fill(); };
  if (seg === 'hello') {
    const nt = DN.night > .5; bg(nt ? '#1e1b4b' : '#38bdf8', nt ? '#6d28d9' : '#bae6fd');
    g.fillStyle = nt ? '#fef9c3' : '#fde047'; g.beginPath(); g.arc(78, 70, 30, 0, PI2); g.fill(); if (nt) { g.fillStyle = '#1e1b4b'; g.beginPath(); g.arc(92, 62, 26, 0, PI2); g.fill(); }
    tx('歡迎來到大城市', 256, 104, 46, '#ffffff'); const d = new Date(); tx(DN_PHASE[DN.phase] + ' · ' + d.getHours() + ':' + String(d.getMinutes()).padStart(2, '0') + ' · 晴時多雲', 256, 160, 24, '#fef9c3', 440, 700);
    slime(256 + Math.sin(lt * 2) * 140, 262, 26, '#fbbf24', '#78350f', 1 - Math.max(0, Math.sin(lt * 6)) * .2);
  } else if (seg === 'soda') {
    bg('#bbf7d0', '#16a34a'); for (let i = 0; i < 18; i++) { const y = 288 - ((lt * 60 + i * 47) % 300); g.fillStyle = 'rgba(255,255,255,.5)'; g.beginPath(); g.arc(30 + (i * 83) % 460, y, 4 + (i % 4) * 2, 0, PI2); g.fill(); }
    const by = 150 + Math.sin(lt * 3) * 8; g.fillStyle = '#15803d'; g.fillRect(60, by - 80, 90, 160); g.fillStyle = '#4ade80'; g.fillRect(60, by - 40, 90, 80); g.fillStyle = '#d1d5db'; g.fillRect(64, by - 90, 82, 12);
    g.fillStyle = '#14532d'; g.beginPath(); g.arc(90, by - 8, 6, 0, PI2); g.arc(120, by - 8, 6, 0, PI2); g.fill();
    tx('史萊姆汽水', 330, 110, 52, '#ffffff', 300); tx('Q 彈氣泡・新登場', 330, 170, 26, '#14532d', 300, 700); tx('全城販賣機限量販售 ¥10', 330, 220, 20, '#f0fdf4', 300, 700);
  } else if (seg === 'me') {
    const live = S.liveBest > 0; bg(live ? '#312e81' : '#065f46', live ? '#be185d' : '#10b981');
    g.fillStyle = live ? '#ef4444' : '#f59e0b'; g.fillRect(16, 14, live ? 150 : 132, 34); tx(live ? '● 精彩重播' : '新店報報', live ? 91 : 82, 31, 22, '#ffffff', 140);
    tx(live ? nm + ' 的捏捏直播' : '月光谷・' + nm + '的捏捏工坊', 256, 78, 34, '#ffffff', 470);
    const sq = live ? 1 - Math.max(0, Math.sin(lt * 5)) * .38 : 1 - Math.max(0, Math.sin(lt * 4)) * .15; slime(130, 250, 58, av.c, '#1f2937', sq);
    if (live && sq < .72) tx('喀滋！', 130 + Math.sin(lt * 9) * 4, 130, 40, '#fde047', 200);
    if (live) { g.textAlign = 'left'; for (let i = 0; i < 4; i++) { const k = Math.floor(lt * 1.5) + i, y = 132 + i * 30; g.fillStyle = 'rgba(0,0,0,.28)'; g.fillRect(262, y - 13, 234, 26); tx(NAMES[k % NAMES.length] + '：' + CHAT_CRUNCH[(k * 3) % CHAT_CRUNCH.length], 270, y, 15, '#ffffff', 218, 700); } g.textAlign = 'center'; tx('最高 ' + S.liveBest + ' 人同時觀看 · 粉絲 ' + Math.floor(S.fans), 380, 262, 17, '#fde68a', 240, 700); }
    else { tx('奶奶的老工坊重新開張了！', 350, 150, 24, '#ecfdf5', 300, 700); tx('喀滋喀滋，好療癒', 350, 196, 22, '#fde68a', 300, 700); tx('第一次開播，大家都在等你', 350, 240, 18, '#d1fae5', 300, 700); }
  } else if (seg === 'rank') {
    bg('#0b1220', '#1e293b'); tx('本週直播排行', 256, 42, 32, '#f2c14e'); rankList().slice(0, 4).forEach((e, i) => { g.textAlign = 'left'; tx((i + 1) + '. ' + e.n, 80, 100 + i * 46, 26, e.me ? '#34d399' : '#e2e8f0', 280, 700); g.textAlign = 'right'; tx(e.v + ' 人', 432, 100 + i * 46, 26, e.me ? '#34d399' : '#e2e8f0', 140, 700); g.textAlign = 'center'; });
  } else {
    bg('#fef9c3', '#fde68a'); tx('尋貓啟事', 256, 40, 34, '#b91c1c');
    g.fillStyle = '#fb923c'; g.beginPath(); g.arc(120, 168, 62, 0, PI2); g.fill(); g.beginPath(); g.moveTo(66, 130); g.lineTo(78, 82); g.lineTo(104, 112); g.moveTo(174, 130); g.lineTo(162, 82); g.lineTo(136, 112); g.fill();
    g.fillStyle = '#1c1917'; const bl = (Math.floor(lt * 2) % 5) === 0; g.fillRect(92, 158, 10, bl ? 3 : 14); g.fillRect(138, 158, 10, bl ? 3 : 14); g.fillStyle = '#f9a8d4'; g.fillRect(115, 182, 10, 6);
    ['橘色・胖胖的・很黏人', '常在生活百貨旁的巷口睡午覺', '慢慢走過去，牠會陪你散步', '看到牠，請摸摸牠的頭'].forEach((l, i) => tx(l, 352, 102 + i * 40, 20, '#44403c', 300, 700));
  }
  g.fillStyle = 'rgba(0,0,0,.07)'; for (let y = 0; y < 288; y += 4) g.fillRect(0, y, 512, 1);
  s.tx.needsUpdate = true;
}
/* 咖啡館二樓的花箱：一隻蜂蜜史萊姆躲在花裡偷看路人；被你盯著看（準心對準、18 公尺內）就驚嚇地縮回去 */
const CAFE_SILL = [-23.6, 4.5, 23.66]; // 花箱正中央、箱子上緣的高度
function buildSill(g) {
  const m = slimeMesh(SP.honey), sc = .3, ud = m.userData; m.scale.setScalar(sc); m.rotation.y = Math.PI; ud.body.castShadow = false; if (ud.shadow) ud.shadow.visible = false;
  m.position.set(CAFE_SILL[0], CAFE_SILL[1] - .42, CAFE_SILL[2]); g.add(m); m.traverse(o => { if (o.isMesh) o.castShadow = false; });
  const host = new THREE.Group(); host.position.set(CAFE_SILL[0], CAFE_SILL[1] + .62, CAFE_SILL[2] - .05); g.add(host);
  return { m, U: ud.U, sc, host, k: 0, st: 'hide', t: rnd(1, 3), bl: 1, lx: 0, ly: 0, sur: 0 };
}
function sillStep(dt, t, s) {
  const cam = W.cam.position, wx = CITY.x + CAFE_SILL[0], wz = CITY.z + CAFE_SILL[2], vx = cam.x - wx, vz = cam.z - wz, d = Math.hypot(vx, vz); if (d > 60) return;
  s.t -= dt;
  if (s.st === 'hide' && s.t < 0) { s.st = 'peek'; s.t = rnd(2.5, 4.5); }
  else if (s.st === 'peek') {
    W.cam.getWorldDirection(tmpV); const sy = CAFE_SILL[1] + .2, ex = -vx, ey = sy - cam.y, ez = -vz, len = Math.hypot(ex, ey, ez), dot = (tmpV.x * ex + tmpV.y * ey + tmpV.z * ez) / len;
    if (s.k > .6 && len < 18 && dot > .992) { s.st = 'shy'; s.t = rnd(5, 8); s.sur = 1; citySnd.squeak(); cityBubble(s.host, 'bang', 0, 1.3); cityEgg('city_sill'); }
    else if (s.t < 0) { s.st = 'hide'; s.t = rnd(3, 7); }
  } else if (s.st === 'shy' && s.t < 0) { s.st = 'hide'; s.t = rnd(1, 3); }
  s.k += ((s.st === 'peek' ? 1 : 0) - s.k) * Math.min(1, dt * (s.st === 'shy' ? 10 : 3)); s.m.position.y = CAFE_SILL[1] - .42 + s.k * .45; // 探頭時坐上箱子邊緣（從街上往上看也看得到眼睛）
  const U = s.U, sc = s.sc, yaw = Math.PI, c = Math.cos(yaw), sn = Math.sin(yaw), gy = s.m.position.y;
  s.bl -= dt; const bl = s.bl < .13 ? 1 - Math.abs(s.bl - .065) / .065 : 0; if (s.bl < 0) s.bl = rnd(1.5, 4); s.sur = Math.max(0, s.sur - dt * 1.2);
  const vl = d || 1, lxL = c * vx - sn * vz; s.lx += (clamp(lxL / vl * 1.6, -1, 1) - s.lx) * Math.min(1, dt * 8); s.ly += (clamp((cam.y - gy - .65 * sc) / vl * 1.2, -1, 1) - s.ly) * Math.min(1, dt * 8);
  U.uT.value = t; U.uSq.value.set(1 + Math.sin(t * 2.4) * .02 - s.sur * .12, 0, 0, .02); U.uFace.value.set(bl, s.st === 'peek' ? .4 : 0, s.sur, 0); U.uFace2.value.set(s.lx, s.ly, s.sur > .3 ? .85 : 0, .42);
  const cx = vx / sc, cy = (cam.y - gy) / sc, cz = vz / sc; U.uCam.value.set(c * cx - sn * cz, cy, sn * cx + c * cz);
}
/* 廣場步道上的人孔蓋（蓋子上有史萊姆浮雕）：晚上偶爾掀起一條縫，露出一雙發光的眼睛；踩上去會跳一下「咕嚕咕嚕」 */
function buildHole(g) {
  const x = -2.6, z = 15.8, R = W.markUV.hole, D = W.markUV.dark, geo = new THREE.CylinderGeometry(.46, .46, .05, 20), uv = geo.attributes.uv, top = new Set(), gr = geo.groups[1];
  for (let i = gr.start; i < gr.start + gr.count; i++) top.add(geo.index.getX(i));
  for (let i = 0; i < uv.count; i++) { if (top.has(i)) uv.setXY(i, R[0] + uv.getX(i) * R[2], R[1] + uv.getY(i) * R[3]); else uv.setXY(i, D[0] + D[2] / 2, D[1] + D[3] / 2); }
  const cover = mesh(geo, new THREE.MeshStandardMaterial({ map: W.markTex, roughness: .55, metalness: .3 }), x, .025, z, g); cover.receiveShadow = true;
  const pit = mesh(new THREE.CircleGeometry(.47, 20), new THREE.MeshBasicMaterial({ color: '#05070a' }), x, .008, z, g); pit.rotation.x = -Math.PI / 2;
  const eyes = mesh(mergeParts([[sphG(.045), '#fde047', M4(-.09, 0, 0)], [sphG(.045), '#fde047', M4(.09, 0, 0)], [sphG(.02, 6, 4), '#1c1917', M4(-.09, 0, .04)], [sphG(.02, 6, 4), '#1c1917', M4(.09, 0, .04)]], true), new THREE.MeshBasicMaterial({ vertexColors: true }), x, .045, z + .24, g); eyes.visible = false;
  return { x, z, cover, eyes, cd: 0, peek: 0, nt: 3, jump: 0 };
}
function holeStep(dt, t, h) {
  const px = P.x - CITY.x, pz = P.z - CITY.z, d = Math.hypot(px - h.x, pz - h.z); h.cd -= dt;
  if (d < .7 && P.ground && h.cd <= 0) { h.cd = 7; h.jump = 1; h.peek = 2.2; citySnd.gurgle(); const p = new THREE.Vector3(CITY.x + h.x, .12, CITY.z + h.z); if (W.goo) W.goo.emit(p, 8, '#86efac', { gy: .01, up: 2.2, speed: 1.4, size: .05 }); fx3(p.setY(.9), '咕嚕咕嚕？', '#86efac'); cityEgg('city_manhole'); }
  if (DN.night > .5 && h.peek <= 0 && (h.nt -= dt) < 0) { h.nt = rnd(5, 9); h.peek = 1.6; }
  h.peek = Math.max(0, h.peek - dt); h.jump = Math.max(0, h.jump - dt * 1.6);
  const lift = h.jump > 0 ? Math.sin((1 - h.jump) * Math.PI) * .32 : h.peek > 0 ? Math.min(1, h.peek * 4, (1.6 - Math.min(1.6, h.peek)) * 4) * .07 : 0;
  h.cover.position.y = .025 + lift; h.cover.rotation.x = h.jump > 0 ? Math.sin(h.jump * 18) * .06 * h.jump : -lift * 2.4;
  h.eyes.visible = h.peek > 0 && lift > .02 && h.jump <= 0; h.eyes.scale.y = (Math.floor(t * 3) % 7) === 0 ? .15 : 1;
}
// 便利商店的自動門：走到門口就滑開，「叮咚～歡迎光臨」；一直站在門口，店員會探出頭來
function buildDoors(g) {
  const x = 60, z = -13.78, A = cAt(x, -13.85); A.S(2.2, 2.5, 0, CZ.sg.i.conv, 0, 1.3, .012); A.B(2.5, .14, .16, '#cbd5e1', 0, 2.62, .06); [-1, 1].forEach(s => A.B(.12, 2.62, .16, '#cbd5e1', s * 1.19, 1.31, .06));
  const gm = W.shopGlass || (W.shopGlass = new THREE.MeshStandardMaterial({ color: '#7fb8d6', emissive: '#ffe7b0', emissiveIntensity: .12, roughness: .05, metalness: .4 }));
  const leaves = [-1, 1].map(s => mesh(new THREE.BoxGeometry(1.08, 2.45, .04), gm, x + s * .54, 1.26, z, g));
  return { x, leaves, k: 0, near: false, nt: 0, told: false };
}
function doorStep(dt, d) {
  const px = P.x - CITY.x, pz = P.z - CITY.z, near = Math.abs(px - d.x) < 2.2 && pz > -14.6 && pz < -10.6;
  if (near && !d.near) { citySnd.ding(); fx3(new THREE.Vector3(CITY.x + d.x, 2.4, CITY.z - 13.2), '叮咚～歡迎光臨！', '#93c5fd'); cityEgg('city_ding'); }
  d.near = near; d.nt = near ? d.nt + dt : 0; if (d.nt > 2.5 && !d.told) { d.told = true; bark(spotWho('door', '店員', [CITY.x + d.x, 2.7, CITY.z - 13.3], [CITY.x + d.x, 1.7, CITY.z - 13.6]), '歡迎光臨！不好意思，店裡正在補貨，晚一點再來喔～'); } // 店員從門口冒一句話（talk.js）
  d.k += ((near ? 1 : 0) - d.k) * Math.min(1, dt * 5); d.leaves[0].position.x = d.x - .54 - d.k; d.leaves[1].position.x = d.x + .54 + d.k;
}
// 鐘塔報時：每 5 分鐘（真實時間 :00、:05…）鐘面下的小門打開，報時史萊姆滑出來點頭，噹、噹、噹
function cuckooStep(c) {
  if (!c) return; const d = new Date(), mi = d.getMinutes(), se = d.getSeconds() + d.getMilliseconds() / 1000;
  let ph = mi % 5 === 0 && se < 16 ? se : -1; if (W.ckForce) { ph = (performance.now() - W.ckForce) / 1000; if (ph > 16) { W.ckForce = 0; ph = -1; } }
  const open = ph < 0 ? 0 : ph < 1 ? ph : ph < 14 ? 1 : Math.max(0, 1 - (ph - 14) / 1.5), out = ph < 1.2 ? 0 : ph < 2 ? (ph - 1.2) / .8 : ph < 12.5 ? 1 : Math.max(0, 1 - (ph - 12.5) / 1.2);
  c.dl.rotation.y = open * 1.9; c.dr.rotation.y = -open * 1.9; c.fig.visible = out > 0; c.fig.position.z = -1.45 - out * .8;
  c.fig.position.y = 13.04 + (out >= 1 ? Math.abs(Math.sin((ph - 2) * Math.PI * .8)) * .16 : 0); c.fig.rotation.y = Math.PI + (out >= 1 ? Math.sin(ph * 3) * .3 : 0);
  const px = P.x - CITY.x, pz = P.z - CITY.z, dist = Math.hypot(px - 7, pz - 38);
  [3, 5, 7].forEach(k => { if (ph >= k && c.last < k) citySnd.bell(clamp(1 - dist / 80, .1, 1)); }); c.last = ph;
  if (ph > 2 && ph < 12 && dist < 50) { tmpV.set(CITY.x + 7, 13.5, CITY.z + 35.8).project(W.cam); if (tmpV.z < 1 && Math.abs(tmpV.x) < .9 && Math.abs(tmpV.y) < .9) cityEgg('city_cuckoo'); }
}
/* 大城市的中央廣場（第 3 堂 07）：噴泉（頂上坐著一隻小史萊姆）、鐘塔（城市的地標，每 5 分鐘有報時員）、咖啡館、週末市集、公告欄，以及沿固定路線散步的行人。
   石頭、木頭這些不會動的零件都進城市的合併清單 */
const PLAZA = { z: 26 };
function buildPlaza(g) {
  const A = cAt(), B = A.B, P = A.P, stone = '#bdb3a3', dark = '#5b5047', wood = '#8b6544';
  const flat = (geo, mat, x, y, z) => { const m = mesh(geo, mat, x, y, z, g); m.rotation.x = -Math.PI / 2; m.receiveShadow = true; return m; };
  // 鋪面：同心圓排列的石磚，外圈一道深色收邊（一張貼圖）
  { const c = document.createElement('canvas'); c.width = c.height = 512; const t = c.getContext('2d'); t.fillStyle = '#b8ae9e'; t.fillRect(0, 0, 512, 512);
    for (let r = 0; r < 14; r++) { const r0 = r * 17.6, r1 = r0 + 17.6, n = Math.max(6, Math.round(r1 * .36)); for (let i = 0; i < n; i++) { const a0 = i / n * PI2, a1 = (i + 1) / n * PI2; t.fillStyle = `hsl(${32 + Math.random() * 10 | 0},${14 + Math.random() * 8 | 0}%,${77 + Math.random() * 7 | 0}%)`; t.beginPath(); t.arc(256, 256, r1 - 1.2, a0 + .01, a1 - .01); t.arc(256, 256, Math.max(0, r0 + 1.2), a1 - .01, a0 + .01, true); t.fill(); } }
    t.strokeStyle = '#8f8676'; t.lineWidth = 14; t.beginPath(); t.arc(256, 256, 249, 0, PI2); t.stroke();
    const tx = new THREE.CanvasTexture(c); tx.colorSpace = THREE.SRGBColorSpace; tx.anisotropy = 8; flat(new THREE.CircleGeometry(15.2, 64), std('#ffffff', { map: tx, roughness: .92, metalness: 0 }), 0, .03, PLAZA.z); }
  B(6, .02, 13, '#d8cfc0', 0, .015, 13); // 從大街走進廣場的步道
  // 噴泉：水池、壓頂、柱子、上層的盆，頂上坐著一隻小史萊姆（水從牠頭上冒出來）
  { const fz = PLAZA.z + 2; P(cylG(3.4, 3.6, .7, 28), stone, M4(0, .35, fz)); P(cylG(3.62, 3.62, .1, 28), '#d6cfc4', M4(0, .73, fz)); P(cylG(.4, .55, 2, 12), stone, M4(0, 1.6, fz)); P(cylG(1.2, .5, .35, 18), stone, M4(0, 2.7, fz));
    P(sphG(.32, 12, 8), '#6ee7a8', M4(0, 3.0, fz, 0, 0, 0, 1, .8, 1)); [-1, 1].forEach(s => { P(sphG(.045, 6, 4), '#1c1917', M4(s * .11, 3.05, fz - .28)); P(sphG(.05, 6, 4), '#fb7185', M4(s * .2, 2.98, fz - .22)); });
    const water = cyl(3.1, 3.1, .08, 28, new THREE.MeshPhysicalMaterial({ color: '#5ec2e8', roughness: .05, transparent: true, opacity: .8 }), 0, .62, fz, g); addCol({ x: CITY.x, z: CITY.z + fz, r: 3.6 });
    const N = LOW ? 14 : 28, drops = new THREE.InstancedMesh(new THREE.SphereGeometry(.09, 6, 4), new THREE.MeshBasicMaterial({ color: '#dbf4ff' }), N); drops.frustumCulled = false; g.add(drops);
    W.anim.push((dt, t) => { if (!inCity()) return; for (let i = 0; i < N; i++) { const k = (t * .7 + i / N) % 1, a = i / N * PI2 * 3; drops.setMatrixAt(i, tmpM.makeTranslation(Math.cos(a) * k * 2.1, 3.25 + k * 1.4 - k * k * 2.9, fz + Math.sin(a) * k * 2.1)); } drops.instanceMatrix.needsUpdate = true; water.position.y = .62 + Math.sin(t * 2) * .01; }); }
  // 鐘塔：大城市的地標，指針顯示真實時間；基座、轉角壁柱、拱窗、塔頂小尖；北面鐘下有報時小門
  { const cx = 7, cz = PLAZA.z + 12, T = new THREE.Group(); T.position.set(cx, 0, cz); g.add(T); const K = cAt(cx, cz);
    K.B(3.4, 16, 3.4, '#c9b896', 0, 8, 0); K.B(3.8, .4, 3.8, dark, 0, 16.2, 0); K.B(3.6, 3.6, 3.6, '#e8dcc4', 0, 18.2, 0); K.P(geoC('ctroof', () => new THREE.ConeGeometry(3, 3.6, 4)), '#5b6b7f', M4(0, 21.8, 0, 0, Math.PI / 4, 0)); K.P(sphG(.25, 8, 6), '#fde68a', M4(0, 23.7, 0));
    K.B(4.2, .6, 4.2, '#b5a582', 0, .3, 0); K.B(3.9, .3, 3.9, '#a89878', 0, .75, 0); [-1, 1].forEach(a => [-1, 1].forEach(b => K.B(.3, 15, .3, '#b9a67e', a * 1.7, 8.4, b * 1.7)));
    for (let i = 0; i < 4; i++) { const F = cAt(cx, cz, i * Math.PI / 2); (i === 2 ? [4, 8] : [4, 8, 12]).forEach(y => { F.B(.72, 1.5, .06, '#3f3a35', 0, y, 1.7); F.P(cylG(.36, .36, .06, 10), '#3f3a35', M4(0, y + .75, 1.7, Math.PI / 2)); F.B(.9, .1, .2, '#a89878', 0, y - .8, 1.75); });
      F.P(geoC('ring', () => new THREE.TorusGeometry(1.5, .07, 6, 32)), '#d4af37', M4(0, 18.2, 1.82)); }
    const faces = [0, 1, 2, 3].map(i => new THREE.CircleGeometry(1.45, 32).applyMatrix4(M4(cx + Math.sin(i * Math.PI / 2) * 1.82, 18.2, cz + Math.cos(i * Math.PI / 2) * 1.82, 0, i * Math.PI / 2, 0)));
    const fc = document.createElement('canvas'); fc.width = fc.height = 128; const x = fc.getContext('2d'); x.fillStyle = '#fefce8'; x.beginPath(); x.arc(64, 64, 60, 0, 6.3); x.fill(); x.strokeStyle = '#334155'; x.lineWidth = 6; x.stroke(); x.fillStyle = '#334155'; for (let i = 0; i < 12; i++) { const a = i / 12 * 6.283; x.fillRect(64 + Math.sin(a) * 48 - 3, 64 - Math.cos(a) * 48 - 3, 6, 6); }
    const ft = new THREE.CanvasTexture(fc); ft.colorSpace = THREE.SRGBColorSpace; const faceM = new THREE.MeshStandardMaterial({ map: ft, emissive: '#fff7d6', emissiveMap: ft, emissiveIntensity: .1 }); (W.cityWin = W.cityWin || []).push(faceM); mesh(mergeUV(faces), faceM, 0, 0, 0, g);
    const hands = new THREE.InstancedMesh(UBOX, std(dark), 8); hands.frustumCulled = false; g.add(hands);
    W.anim.push(() => { if (!inCity()) return; const d = new Date(), s = d.getSeconds(); if (s === hands.userData.s) return; hands.userData.s = s; const m = d.getMinutes() + s / 60, h = (d.getHours() % 12) + m / 60;
      for (let i = 0; i < 4; i++) { const a = i * Math.PI / 2, base = (zz, ang) => M4(cx + Math.sin(a) * zz, 18.2, cz + Math.cos(a) * zz, 0, a, 0).multiply(M4(0, 0, 0, 0, 0, -ang)); hands.setMatrixAt(i * 2, base(1.86, h / 12 * PI2).multiply(M4(0, .32, 0, 0, 0, 0, .12, .75, .03))); hands.setMatrixAt(i * 2 + 1, base(1.89, m / 60 * PI2).multiply(M4(0, .5, 0, 0, 0, 0, .08, 1.15, .03))); }
      hands.instanceMatrix.needsUpdate = true; });
    // 報時小門（北面、朝廣場）：兩扇木門往外開，報時史萊姆從門裡滑到小平台上
    K.B(1.22, 1.32, .02, '#1c1917', 0, 13.7, -1.705); K.B(1.6, .1, .9, '#d6c7a1', 0, 12.99, -2.15); K.B(1.5, .14, .16, '#a89878', 0, 14.44, -1.77); [-1, 1].forEach(s => K.B(.06, .5, .06, '#a89878', s * .75, 13.25, -2.56)); K.B(1.56, .05, .05, '#a89878', 0, 13.5, -2.56);
    const dm = std('#7c4a2d', { roughness: .7 }), hinge = s => { const h = new THREE.Group(); h.position.set(s * .6, 13.7, -1.73); T.add(h); mesh(new THREE.BoxGeometry(.6, 1.3, .06), dm, -s * .3, 0, 0, h); return h; };
    const fig = new THREE.Mesh(mergeParts([[sphG(.24, 12, 8), '#fbbf24', M4(0, .2, 0, 0, 0, 0, 1, .85, 1)], [sphG(.035, 6, 4), '#1c1917', M4(-.08, .24, .2)], [sphG(.035, 6, 4), '#1c1917', M4(.08, .24, .2)], [sphG(.04, 6, 4), '#fb7185', M4(-.14, .17, .17)], [sphG(.04, 6, 4), '#fb7185', M4(.14, .17, .17)], [cylG(.015, .015, .25, 5), '#78350f', M4(0, .42, 0)], [sphG(.05, 6, 4), '#facc15', M4(0, .56, 0)]], true), W.npcMat || (W.npcMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: .78, metalness: 0 })));
    fig.scale.setScalar(1.5); fig.position.set(0, 13.04, -1.45); fig.visible = false; T.add(fig); W.cfx.ck = { dl: hinge(-1), dr: hinge(1), fig, last: -1 };
    addCol({ box: [CITY.x + cx - 2.1, CITY.z + cz - 2.1, CITY.x + cx + 2.1, CITY.z + cz + 2.1] });
    const lb = textSprite('鐘塔', '#f2c14e', '大城市的中央廣場'); lb.position.set(cx, 24.5, cz); lb.userData.keep = true; g.add(lb); }
  // 咖啡館（兩層樓，正面朝北）：一樓櫥窗與玻璃門、條紋雨遮、招牌帶上的店招；二樓兩扇窗加花箱（東邊那個花箱裡躲著一隻史萊姆）、
  // 電視掛在兩扇窗中間；直立招牌在東側轉角，比雨遮更外側，不會互相擋住
  { const x = -28, z = PLAZA.z - 2, w = 13, h = 6.5, F = cAt(x, z, Math.PI), sg = CZ.sg;
    B(w, h, 8, '#d9b38c', x, h / 2, z + 4); B(w + .4, .3, 8.4, '#8b5a3c', x, h + .15, z + 4); B(w + .1, .5, .1, '#b98d64', x, .25, z - .05);
    [-3.7, 3.7].forEach(px => { F.S(3.6, 2.25, 0, sg.i.cafe, px, 1.5, .03); F.B(3.7, .1, .1, '#5b3a29', px, 2.67, .05); F.B(3.7, .3, .12, '#5b3a29', px, .15, .06); });
    F.B(1.4, 2.7, .1, '#5b3a29', 0, 1.35, .05); F.Q(1.2, 2.45, 0, 1.28, .11);
    for (let i = 0; i < 20; i++) { const c = i % 2 ? '#b45309' : '#fef3c7', ax = -6.2 + .31 + i * .62; F.B(.625, .05, 1.6, c, ax, 2.92, .85, .25); F.B(.625, .2, .03, c, ax, 2.64, 1.62); }
    F.B(9, .9, .2, '#3b2618', 0, 3.62, .1); F.S(3.6, .9, 0, sg.h.cafe, 0, 3.62, .22);
    [-4.4, 4.4].forEach((px, i) => { F.B(1.75, 1.6, .08, '#efe3c8', px, 5.25, .04); F.Q(1.5, 1.4, px, 5.25, .09); F.B(1.6, .45, .6, '#8b5a3c', px, 4.275, .34, 0, 0, 0, 'wood');
      [-.6, -.38, .38, .6].forEach((fx, k) => F.P(blobG(.16, k + i), ['#f472b6', '#facc15', '#a78bfa', '#fb7185'][k], M4(px + fx, 4.6, .34))); [-.5, .5].forEach(fx => F.P(blobG(.18, 6), '#4c9a45', M4(px + fx, 4.52, .3))); });
    F.B(3.2, 2.1, .1, '#111827', 0, 5.1, .05);
    { const s = -6.42, sh = 3, y0 = 3.25; F.S(.16, sh, .75, sg.v.coffee, s, y0 + sh / 2, .55, [0, 1]); F.B(.05, .05, .55, '#374151', s, y0 - .06, .27); F.B(.05, .05, .55, '#374151', s, y0 + sh + .06, .27); F.B(.05, sh, .05, '#fde68a', s, y0 + sh / 2, .96, 0, 0, 0, 'glow'); }
    addCol({ box: [CITY.x + x - w / 2, CITY.z + z, CITY.x + x + w / 2, CITY.z + z + 8] }); addInter(hitBox(w - 1, 3.4, 2.4, x, 1.7, z - 1, g), 'station', 'cafe', '咖啡館');
    const lb = textSprite('咖啡館', '#b45309', '坐下休息・老闆的小訂單'); lb.position.set(x, h + 2.4, z); g.add(lb);
    // 咖啡館外的桌椅（不放陽傘：陽傘會擋到店招）
    [[-31, PLAZA.z - 6], [-25, PLAZA.z - 6]].forEach(([tx, tz]) => { P(cylG(.6, .6, .06, 16), wood, M4(tx, .78, tz), 'wood'); P(cylG(.06, .06, .78, 8), dark, M4(tx, .39, tz)); [-1, 1].forEach(s => { B(.5, .06, .5, wood, tx + s * .9, .45, tz, 0, 0, 0, 'wood'); B(.5, .5, .06, wood, tx + s * .9, .7, tz + .22, 0, 0, 0, 'wood'); }); addCol({ x: CITY.x + tx, z: CITY.z + tz, r: .7 }); });
    // 電視（本週直播排行）：在外框前面
    const c = document.createElement('canvas'); c.width = 256; c.height = 160; W.tvCv = c; const tt = new THREE.CanvasTexture(c); tt.colorSpace = THREE.SRGBColorSpace; W.tvTx = tt;
    const tv = mesh(new THREE.PlaneGeometry(3, 1.9), new THREE.MeshBasicMaterial({ map: tt }), x, 5.1, z - .12, g); tv.rotation.y = Math.PI; drawTV(); }
  // 週末市集：三個攤位；平日蓋著布（開／收兩組各自合併）
  { const mx = 28, mz = PLAZA.z - 4, stripe = (() => { const c = document.createElement('canvas'); c.width = 64; c.height = 8; const x = c.getContext('2d'); for (let i = 0; i < 8; i++) { x.fillStyle = i % 2 ? '#fef3c7' : '#ef4444'; x.fillRect(i * 8, 0, 8, 8); } const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t; })();
    W.mktOpen = new THREE.Group(); W.mktShut = new THREE.Group(); g.add(W.mktOpen, W.mktShut); const cans = [], balls = [], covers = [];
    [-6, 0, 6].forEach((dx, i) => { const x = mx + dx; B(4, .9, 2, wood, x, .45, mz, 0, 0, 0, 'wood'); [-1.8, 1.8].forEach(s => P(cylG(.06, .06, 3, 6), dark, M4(x + s, 1.5, mz - .9)));
      cans.push(new THREE.PlaneGeometry(4.4, 2.4).applyMatrix4(M4(x, 3, mz - .2, -Math.PI / 2 + .35)));
      [0, 1, 2].forEach(j => balls.push([sphG(.3, 10, 8), ['#c4b5fd', '#ff7a59', '#a3f7b5', '#fde047'][(i + j) % 4], M4(x - 1.2 + j * 1.2, 1.15, mz)]));
      covers.push([UBOX, '#7a8a6a', M4(x, 1.1, mz, 0, 0, 0, 4.2, .5, 2.2)]); addCol({ box: [CITY.x + x - 2, CITY.z + mz - 1, CITY.x + x + 2, CITY.z + mz + 1] }); });
    mesh(mergeUV(cans), new THREE.MeshStandardMaterial({ map: stripe, side: THREE.DoubleSide, roughness: .8 }), 0, 0, 0, W.mktOpen);
    mesh(mergeParts(balls, true), new THREE.MeshStandardMaterial({ vertexColors: true, roughness: .2 }), 0, 0, 0, W.mktOpen);
    mesh(mergeParts(covers), new THREE.MeshStandardMaterial({ vertexColors: true, roughness: .95, flatShading: true }), 0, 0, 0, W.mktShut);
    addInter(hitBox(17, 3, 3, mx, 1.5, mz - .5, g), 'station', 'market', '週末市集');
    const lb = textSprite('週末市集', '#f2c14e', '每週六日擺攤，攤位輪替'); lb.position.set(mx, 5, mz); g.add(lb); }
  // 公告欄：和工作電腦「本週限定」是同一份訂單。柱子在板子兩側外面，便條紙畫在圖集裡（朝廣場）
  { const bx = 0, bz = PLAZA.z + 16; [-2.35, 2.35].forEach(s => B(.2, 2.75, .2, wood, bx + s, 1.375, bz, 0, 0, 0, 'wood')); B(4.4, 2, .15, '#7d5c3a', bx, 1.9, bz, 0, 0, 0, 'wood'); B(4.9, .12, .5, '#6b4a33', bx, 3.0, bz, 0, 0, 0, 'wood');
    cAt(bx, bz, Math.PI).S(4.2, 1.68, 0, CZ.sg.board, 0, 1.9, .1);
    addCol({ box: [CITY.x + bx - 2.5, CITY.z + bz - .3, CITY.x + bx + 2.5, CITY.z + bz + .3] }); addInter(hitBox(4.4, 2.6, 1.2, bx, 1.6, bz - .4, g), 'station', 'board', '公告欄');
    const lb = textSprite('公告欄', '#e2e8f0', '本週限定訂單'); lb.position.set(bx, 4, bz); g.add(lb); }
  buildNPCs(g);
}
// 本週直播排行（咖啡館的電視）：其他主播是城市裡的名人，玩家的最高觀眾數也會上榜
function drawTV() {
  const c = W.tvCv; if (!c) return; const x = c.getContext('2d'), list = rankList();
  x.fillStyle = '#0b1220'; x.fillRect(0, 0, 256, 160); x.fillStyle = '#f2c14e'; x.font = 'bold 18px "Noto Sans TC","Microsoft JhengHei",sans-serif'; x.fillText('本週直播排行', 12, 24);
  list.slice(0, 5).forEach((e, i) => { x.fillStyle = e.me ? '#34d399' : '#e2e8f0'; x.font = '15px "Noto Sans TC","Microsoft JhengHei",sans-serif'; x.fillText((i + 1) + '. ' + e.n, 14, 52 + i * 22, 170); x.textAlign = 'right'; x.fillText(e.v + ' 人', 242, 52 + i * 22); x.textAlign = 'left'; });
  if (W.tvTx) W.tvTx.needsUpdate = true;
}
/* ---------- 大城市的居民：有五官、會走路、可以聊天（同一個人說過的話不會重複，全部聊完才重新輪一次）。bye＝走開時的道別、tag＝名牌顏色（預設是上衣顏色） ---------- */
const NPC_DEF = [
  { id: 'yun', name: '小芸', role: '花店店員', bye: '要常來看花喔～', hair: 'long', hc: '#3b2417', skin: '#f3cfb0', top: '#f9a8d4', bot: '#f1f5f9', skirt: '#f472b6', acc: 'apron', r: 0, o: .05,
    lines: ['今天進了一批向日葵，整間店都亮起來了。', '常有客人問我，花和捏捏哪個比較療癒？我都說兩個一起最療癒。', '鐘塔下的噴泉是我最喜歡的地方，下班都會在那裡坐一下。', '你身上有淡淡的青草味，是剛從月光谷過來的嗎？', '我想在店門口擺一個花朵形狀的捏捏，你接受訂做嗎？', '花要每天換水，捏捏也要好好保存才不會變形吧？', '聽說森林裡的月光巨木晚上會發光，好想親眼看看。', '店裡最受歡迎的是滿天星，小小的，就像夜空一樣。', '下雨天客人很少，我就在櫃台後面偷偷捏捏捏。', '你知道嗎？粉紅色的花代表「感謝」，送給幫助過你的人吧。'] },
  { id: 'chen', name: '陳伯伯', role: '退休的老爺爺', bye: '路上小心啊。', hair: 'bald', hc: '#d4d4d8', skin: '#e8b996', top: '#a16207', bot: '#57534e', acc: 'glasses', spot: [-4.6, PLAZA.z + 5.6], slow: 1,
    lines: ['年輕人，我在這座城市住了七十年囉。', '這座鐘塔比我還老，從來沒慢過一分鐘。', '以前月光谷那邊只有你奶奶一間工坊，生意可好了。', '你奶奶年輕時捏的史萊姆，整條街的小孩都搶著要。', '每天早上我都來看噴泉，看水花就覺得年輕了幾歲。', '我的膝蓋不好，走不了遠路，你去雪原的時候替我看看雪吧。', '做事情慢慢來，捏捏也是，急不得。', '咖啡館的熱可可很好喝，但醫生叫我少喝甜的。', '我孫子也很喜歡看捏捏直播，每天晚上都在看。', '有空多回去看看奶奶的工坊，那是很多人的回憶喔。', '這些鴿子都認得我，我每天都帶麵包屑來餵牠們。'] },
  { id: 'zhe', name: '阿哲', role: '上班族', bye: '我、我要去開會了！', tag: '#60a5fa', hair: 'short', hc: '#1c1917', skin: '#f1c7a1', top: '#e2e8f0', bot: '#1e293b', acc: 'tie', tie: '#2563eb', r: 0, o: .55, fast: 1,
    lines: ['抱歉，我在趕下一場會議……好吧，聊一下下。', '我桌上擺了一個捏捏，開會壓力大的時候捏兩下就好了。', '公司樓下的機械行最近在打折，你有看到嗎？', '每天加班，我都快忘記天空是什麼顏色了。', '我老闆說報告要「有手感」，我覺得他其實想要捏捏。', '下班後的鐘塔很美，可惜我總是看不到。', '要是工作也能像捏捏一樣喀滋一聲就完成就好了。', '我在網路商店買過你的捏捏！包裝很用心。', '假日我只想躺著，什麼都不想做。', '有人說直播賺錢很容易，我看是很辛苦吧？'] },
  { id: 'mei', name: '美美', role: '國中生', bye: '掰掰！下次要幫我簽名喔！', tag: '#f9a8d4', hair: 'bun', hc: '#422006', skin: '#f6d2b5', top: '#ffffff', bot: '#1d4ed8', skirt: '#1d4ed8', acc: 'bag', bag: '#f59e0b', r: 1, o: .2, kid: .9,
    lines: ['哇！你就是那個捏捏工坊的主人嗎？可以幫我簽名嗎？', '我們班上大家都在收集史萊姆圖鑑，我還差好多種。', '考試前我都會捏捏捏，聽說可以增加運氣。', '聽說夜晚才會出現的史萊姆會發光，是真的嗎？', '我長大也想開一間工坊！要先存很多錢吧……', '數學好難，捏捏比較簡單。', '我最喜歡粉紅色的捏捏，軟軟的那種。', '學校旁邊的文具店也開始賣捏捏了，不過沒有你的好看。', '你去過火山嗎？會不會很燙？', '下次直播可以捏一個會發光的嗎？我會守著看！'] },
  { id: 'jie', name: '阿傑', role: '外送員', bye: '外送去囉～', hair: 'cap', hc: '#111827', cap: '#16a34a', skin: '#d9a47e', top: '#22c55e', bot: '#334155', acc: 'box', r: 2, o: .1, fast: 1,
    lines: ['外送！啊不是，我在找地址。', '這個城市的路我閉著眼睛都會走。', '最近很多人訂捏捏外送，你的生意應該不錯吧？', '騎車最怕下雨，箱子裡的東西不能濕。', '我送過一箱捏捏去月光谷，聽說是給工坊的客人。', '今天已經送了 32 單，腳好痠。', '咖啡館的老闆給小費最大方。', '我偷偷告訴你，公告欄的訂單常常是城裡的大客戶。', '如果有一天捏捏也能自己走路就好了，我就不用送了。', '外送箱要保持平穩，就像捏捏機器的輸送帶一樣。'] },
  { id: 'lin', name: '林太太', role: '主婦', bye: '記得吃飯喔。', hair: 'curly', hc: '#57534e', skin: '#f0c4a0', top: '#7c3aed', bot: '#44403c', skirt: '#6d28d9', acc: 'bag', bag: '#be123c', r: 2, o: .6, slow: 1,
    lines: ['今天的菜價又漲了，買個菜都要精打細算。', '我家小孩每天都吵著要買捏捏，你那邊有便宜一點的嗎？', '週末的市集東西最新鮮，我每週都會去。', '你看起來沒有好好吃飯喔，年輕人要照顧身體。', '我年輕時也做過手工，捏東西真的很需要耐心。', '鄰居家的小狗好可愛，但牠每次都追著我的購物袋跑。', '醫院的醫生人很好，看病又不貴。', '晚餐要煮什麼呢……每天都在煩惱這件事。', '我把你做的捏捏放在客廳，客人來都會捏一下。', '下雨記得帶傘，這個城市的天氣變得很快。'] },
  { id: 'yu', name: '小宇', role: '小學生', bye: '拜拜～！', hair: 'short', hc: '#292524', skin: '#f5d0b0', top: '#ef4444', bot: '#2563eb', acc: 'bag', bag: '#0ea5e9', r: 1, o: .7, kid: .72,
    lines: ['大哥哥／大姊姊，你會捏史萊姆嗎？好厲害！', '我在噴泉旁邊撿到一枚硬幣，要不要許願？', '我最喜歡的史萊姆是會飛的那種……啊，沒有那種嗎？', '媽媽說我捏太多捏捏，手會變得很有力氣。', '我長大要當史萊姆博士！', '你知道鐘塔裡面住著貓頭鷹嗎？我聽說的。', '下課後我都在廣場跑來跑去。', '我有一個藍色的捏捏，晚上睡覺都抱著它。', '你可以教我怎麼捏嗎？我會很小心的。', '剛剛有一隻鴿子一直看我，牠是不是也想要捏捏？'] },
  { id: 'leo', name: 'Leo', role: '大學生・直播迷', bye: '今晚會開播嗎？我會守著！', hair: 'pony', hc: '#78350f', skin: '#eec3a0', top: '#0f766e', bot: '#1f2937', acc: 'hood', r: 0, o: .82, fan: 1,
    lines: ['我每天晚上都在看捏捏直播，聲音超療癒。', '直播的時候觀眾最喜歡聽「喀滋」那一聲，你知道嗎？', '我報告寫不出來，只好來廣場散步找靈感。', '你的直播排行有上咖啡館的電視嗎？我會去投票！', '我在研究為什麼人會覺得捏東西很舒服，結論是：就是很舒服。', '學校社團想辦捏捏工作坊，你願意來當講師嗎？', '熬夜的時候，捏捏是我最好的朋友。', '直播主要多跟觀眾互動，大家會越來越喜歡你。', '我收藏了 12 個不同顏色的捏捏，排成一排很好看。', '聽說有人捏出過完美的酥脆度，那一定是傳說。'] },
  { id: 'kai', name: '阿凱', role: '街頭吉他手', bye: '♪ 謝謝你停下來聽。', hair: 'long', hc: '#0c0a09', skin: '#d6a07a', top: '#1f2937', bot: '#3f3f46', acc: 'guitar', spot: [-9, PLAZA.z - 6.5], face: [0, 14],
    lines: ['要不要點一首歌？今天的曲子是〈月光谷的夜晚〉。', '我在這裡彈了三年，鐘塔的鐘聲就是我的節拍器。', '音樂和捏捏一樣，都要有節奏感。', '黃昏的時候廣場人最多，我最喜歡那個時候。', '有一天我想把捏捏的聲音放進歌裡。', '我的吉他有點走音，就像我的人生一樣（笑）。', '有人說我彈得很好聽，那我就繼續彈下去。', '如果你在直播，我可以幫你配背景音樂喔。', '夜晚的城市很安靜，彈起來特別有感覺。', '謝謝你停下來聽，這對街頭藝人來說很重要。'] },
  { id: 'wang', name: '王阿姨', role: '市集攤販', bye: '慢走喔，下週見！', hair: 'bun', hc: '#44403c', skin: '#e9b892', top: '#f97316', bot: '#57534e', acc: 'apron', apron: '#fef3c7', spot: [28, PLAZA.z - 1.8], face: [28, 10],
    lines: ['來來來，看看喔！這週的凝膠很漂亮喔！', '我在市集擺攤擺了二十年，什麼客人都見過。', '平日我在家準備貨，週末才出來擺攤。', '你奶奶以前也常來我的攤子買材料。', '做生意最重要的是誠實，東西好客人自然會回來。', '下雨天我就用布把攤子蓋起來，等雨停。', '我的攤子每週輪替不同的稀有凝膠，要常來看看喔。', '今天生意還不錯，阿姨請你喝杯茶。', '年輕人有夢想很好，要一步一步來。', '這些凝膠都是從很遠的地方運來的，很珍貴喔。'] },
  { id: 'zhang', name: '張警官', role: '交通警察', bye: '注意安全！', hair: 'cap', hc: '#111827', cap: '#1e3a8a', skin: '#e2ad85', top: '#1e40af', bot: '#1e3a8a', acc: 'vest', spot: [13.5, -9.4], face: [13.5, 0],
    lines: ['過馬路要走斑馬線喔，注意左右來車。', '這個路口每天早上都很塞。', '我站在這裡十年了，認得這條街上的每一個人。', '計程車招呼站在醫院門口，要回月光谷就去那裡。', '有人說看到史萊姆跑進城裡，結果只是一團綠色塑膠袋。', '晚上巡邏的時候，路燈一盞一盞亮起來，很漂亮。', '安全第一！做捏捏的機器也要注意安全喔。', '不要在街上奔跑，很容易撞到人。', '武器店賣的東西要小心使用，長劍只能收藏喔。', '有任何問題都可以來問我，這是我的工作。'] },
  { id: 'anna', name: '安娜', role: '觀光客', bye: 'Bye bye！', hair: 'pony', hc: '#facc15', skin: '#f8d9c4', top: '#38bdf8', bot: '#a16207', acc: 'camera', r: 1, o: .45,
    lines: ['Hello！我是從很遠的地方來旅行的。', '這座鐘塔好美，我已經拍了一百張照片。', '我聽說附近有一座會發光的森林，在哪裡呢？', '這裡的人都好親切，每個人都跟我打招呼。', '我想帶一個捏捏回國當紀念品，你有推薦的嗎？', '咖啡館的熱可可是我喝過最好喝的！', '我在旅遊書上看到「史萊姆捏捏」，原來這麼受歡迎。', '週末的市集好熱鬧，我買了好多東西。', '我的中文還在學，說錯了請不要笑我。', '下一站我想去看海，聽說東邊有一座燈塔。'] },
];
// 跟狀態有關的話題：時間、天色、市集、玩家的進度。條件不成立的話題不會出現
function npcTopics() {
  const out = [], add = (k, t) => out.push({ k: 'c:' + k, t }), d = new Date(), hh = d.getHours(), zs = S.zones.map(z => ZONES.find(x => x.id === z).name);
  if (DN.night > .5) add('night', '天黑了，月光谷那邊的螢火蟲應該都出來了吧？');
  if (DN.phase === 'dusk') add('dusk', '黃昏的時候，整座鐘塔會被染成橘色，你看！');
  if (DN.phase === 'dawn') add('dawn', '天快亮了，這是城市最安靜的時候。');
  if (DN.phase === 'day') add('day', '今天天氣真好，適合出門走走。');
  add('clock', '現在是 ' + hh + ' 點 ' + String(d.getMinutes()).padStart(2, '0') + ' 分，鐘塔的時間很準的。');
  if (hh < 11 && hh >= 5) add('morning', '早安！一大早就來城裡辦事呀？'); else if (hh >= 22 || hh < 5) add('late', '這麼晚了還沒睡？明天會沒精神喔。');
  if (mktOpenNow()) { const o = marketOffers()[0]; add('mkt', '今天週末市集有擺攤，這週的限定商品是「' + o.t + '」。'); } else add('mktOff', '週末市集只在星期六、日擺攤，平日攤位都蓋著布。');
  if (S.liveBest > 0) add('live', '我看過你的直播！最高有 ' + S.liveBest + ' 個人在看，好厲害。'); else add('nolive', '你還沒開過直播嗎？咖啡館的電視每天都在播直播排行喔。');
  if (S.fans >= 10) add('fans', '聽說你已經有 ' + Math.floor(S.fans) + ' 個粉絲了？說不定我也是其中一個。');
  if (zs.length > 1) add('zones', '你去過' + zs.join('、') + '了？我只在電視上看過。'); else add('zone1', '月光谷外面還有海岸、火山和雪原，聽說都要解開謎題才能去。');
  if (!S.own.coat) add('coat', '雪原冷到骨頭裡，沒有保暖衣根本進不去。' + (armsOpen() ? '武器店就有賣。' : '聽說等你更有名，武器店才會開。'));
  if (S.frozen) add('frozen', '你在發抖耶！快去醫院給醫生看看，只要 ' + HOSPITAL_FEE + ' 塊。');
  const n = Object.keys(S.codex).length; if (n) add('codex', '你的史萊姆圖鑑收集了 ' + n + ' 種？全部有 ' + SPECIES.length + ' 種喔。');
  if (S.cafe.d !== Math.floor(Date.now() / 864e5) || !S.cafe.done) add('cafe', '咖啡館老闆好像在找某種捏捏，去問問看吧。');
  add('board', '廣場南邊的公告欄貼了這週的限定訂單，報酬不錯喔。');
  if (S.money >= 2000) add('rich', '你看起來生意很好，有沒有想過買新的機器？');
  return out;
}
function npcLine(n) {
  const st = S.npc[n.d.id] || (S.npc[n.d.id] = { n: 0, seen: [] });
  if (!st.n) { st.n = 1; return { k: 'hi', t: '你好！我是' + n.d.name + '，' + n.d.role + '。你是月光谷那間工坊的新主人吧？' }; }
  if (n.d.id === 'chen' && W.pgScare && performance.now() - W.pgScare < 25000) { W.pgScare = 0; st.n++; return { k: 'c:pg', t: '哎呀，鴿子都被你嚇飛了！別擔心，牠們繞一圈就會回來吃麵包屑。' }; } // 嚇飛一次說一次（「再聊一句」不會一直重複）
  if (n.d.fan) { const f = fanLine(); if (f) return f; }
  const pool = [...n.d.lines.map((t, i) => ({ k: 'p' + i, t })), ...npcTopics()];
  let left = pool.filter(l => !st.seen.includes(l.k));
  if (!left.length) { st.seen = st.seen.slice(-2); left = pool.filter(l => !st.seen.includes(l.k)); }
  const l = left[Math.floor(Math.random() * left.length)]; st.seen.push(l.k); if (st.seen.length > 60) st.seen = st.seen.slice(-60); st.n++; return l;
}
// 忠實觀眾（Leo）：粉絲夠多（或直播有人看過）他就認出你是那個捏捏主播；之後的話依你的粉絲數變化
function fanLine() {
  const fans = Math.floor(S.fans), known = fans >= 10 || S.liveBest >= 5;
  if (!known) return Math.random() < .35 ? { k: 'f:wait', t: '我最近在找新的捏捏直播主……聽說月光谷有一間新開的工坊，你知道嗎？' } : null;
  if (!W.fanMet) { W.fanMet = true; cityEgg('city_fan'); return { k: 'f:hi', t: '等一下……這個聲音……你是月光谷那個捏捏主播！？我、我是你的觀眾！可以跟你握個手嗎？' }; }
  if (Math.random() < .5) return null;
  const nick = NAMES[(fans + 3) % NAMES.length], L0 = fans < 40 ? ['你現在有 ' + fans + ' 個粉絲，其中一個就是我！', '我每天睡前都會去看你有沒有開播。'] : fans < 150 ? ['留言區那個「' + nick + '」就是我，你有看到嗎？', '你上次直播的喀滋聲，我重播了好幾次。'] : fans < 500 ? ['我把你的直播推薦給全班了，現在大家下課都在聽喀滋聲。', '社團的人說要組團去月光谷朝聖！'] : ['你現在有 ' + fans + ' 個粉絲了耶……我可以說我是最早的那批嗎？', '以前留言區只有幾個人，現在刷都刷不完，好感動。'];
  if (S.liveBest > 0) L0.push('你直播最高有 ' + S.liveBest + ' 個人同時在看，那天我也在！');
  return { k: 'f:x', t: pick(L0) };
}
// 居民：誰在說話，字就從誰頭上冒出來（talk.js）。E＝再聊一句（一次最多 4 句，之後他自己道別）、走開＝再見；不需要任何按鈕
function npcTalk(n) {
  if (n.d.shop) return kpTalk(n.d.shop); // 店員：一句話泡泡（不開對話），拿著商品時由 wareAct 處理
  if (n.d.id === 'wang' && mktOpenNow()) return marketAct(); // 週末王阿姨在顧攤：直接講生意
  const line = () => { const l = npcLine(n); save(); return npcBeat(n, l); };
  talk(npcWho(n), [line()], { more: line, max: 4 });
}
// 圓角方塊：方塊外形但邊角是圓的（參考方塊人，但不要全是硬邊）
function roundBox(w, h, d, r, seg = 2) {
  const g = new THREE.BoxGeometry(w, h, d, seg * 2, seg * 2, seg * 2), p = g.attributes.position, v = new THREE.Vector3(), c = new THREE.Vector3(), hw = w / 2 - r, hh = h / 2 - r, hd = d / 2 - r;
  for (let i = 0; i < p.count; i++) { v.fromBufferAttribute(p, i); c.set(clamp(v.x, -hw, hw), clamp(v.y, -hh, hh), clamp(v.z, -hd, hd)); v.sub(c); const l = v.length(); if (l > 1e-6) v.multiplyScalar(r / l); c.add(v); p.setXYZ(i, c.x, c.y, c.z); }
  g.computeVertexNormals(); return g;
}
// 人物模型（方塊人風格）：方形的頭、身體與手腳都是圓角方塊；五官是平面方塊（眼白＋瞳孔、眉毛、鼻子、嘴巴、腮紅）；
// 頭髮是包住頭頂與後腦的方塊殼。身體、頭、雙手、雙腳分開，走路時手腳擺動、頭轉向玩家
function npcMesh(d) {
  const mat = W.npcMat || (W.npcMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: .78, metalness: 0 }));
  const root = new THREE.Group(), body = new THREE.Group(); root.add(body); const sc = d.kid || 1; body.scale.setScalar(sc);
  const RB = (w, h, dd, r = .03) => roundBox(w, h, dd, r, LOW ? 1 : 2), Bx = (w, h, dd) => new THREE.BoxGeometry(w, h, dd);
  // 身體（含領口、褲頭、配件）
  const tp = [[RB(.46, .58, .26, .05), d.top, M4(0, 1.18, 0)], [RB(.44, .14, .25, .04), d.bot, M4(0, .9, 0)], [RB(.14, .1, .14, .03), d.skin, M4(0, 1.5, 0)]];
  if (d.skirt) tp.push([new THREE.CylinderGeometry(.24, .34, .4, 4, 1), d.skirt, M4(0, .76, 0, 0, Math.PI / 4, 0, 1, 1, .7)]);
  if (d.acc === 'apron') tp.push([Bx(.32, .5, .02), d.apron || '#84cc16', M4(0, 1.02, .14)], [Bx(.04, .3, .02), d.apron || '#84cc16', M4(-.12, 1.32, .135)], [Bx(.04, .3, .02), d.apron || '#84cc16', M4(.12, 1.32, .135)]);
  if (d.acc === 'tie') tp.push([Bx(.06, .32, .02), d.tie, M4(0, 1.26, .135)], [Bx(.12, .06, .03), '#ffffff', M4(0, 1.44, .125)]);
  if (d.acc === 'bag') tp.push([RB(.3, .34, .14, .04), d.bag, M4(0, 1.2, -.2)], [Bx(.04, .3, .02), d.bag, M4(-.14, 1.3, .135)], [Bx(.04, .3, .02), d.bag, M4(.14, 1.3, .135)]);
  if (d.acc === 'box') tp.push([RB(.46, .4, .36, .03), '#f97316', M4(0, 1.25, -.33)], [Bx(.47, .05, .37), '#fff7ed', M4(0, 1.3, -.33)]);
  if (d.acc === 'hood') tp.push([RB(.4, .14, .18, .05), d.top, M4(0, 1.47, -.1)], [Bx(.24, .12, .02), '#115e59', M4(0, 1.05, .135)], [Bx(.02, .16, .02), '#e2e8f0', M4(-.05, 1.36, .135)], [Bx(.02, .16, .02), '#e2e8f0', M4(.05, 1.36, .135)]);
  if (d.acc === 'camera') tp.push([RB(.16, .1, .08, .02), '#1f2937', M4(0, 1.2, .17)], [new THREE.CylinderGeometry(.035, .035, .06, 10), '#0f172a', M4(0, 1.2, .22, Math.PI / 2)], [Bx(.02, .32, .02), '#1f2937', M4(-.08, 1.36, .135, 0, 0, .3)], [Bx(.02, .32, .02), '#1f2937', M4(.08, 1.36, .135, 0, 0, -.3)]);
  if (d.acc === 'vest') tp.push([RB(.48, .44, .28, .05), '#facc15', M4(0, 1.2, 0)], [Bx(.49, .04, .29), '#e2e8f0', M4(0, 1.12, 0)], [Bx(.08, .06, .02), '#d4af37', M4(-.12, 1.35, .145)]);
  if (d.acc === 'guitar') tp.push([RB(.34, .3, .1, .08), '#b45309', M4(.04, 1.02, .2)], [RB(.27, .22, .1, .07), '#b45309', M4(-.03, 1.22, .2)], [Bx(.05, .52, .03), '#451a03', M4(-.2, 1.46, .22, 0, 0, .7)], [new THREE.CylinderGeometry(.04, .04, .01, 10), '#1c1917', M4(0, 1.08, .26, Math.PI / 2)]);
  const legP = s => [[RB(.16, .44, .17, .035), d.skirt ? d.skin : d.bot, M4(s * .11, .66, 0)], [RB(.15, .36, .16, .03), d.skirt ? d.skin : d.bot, M4(s * .11, .28, 0)], [RB(.16, .1, .26, .03), d.skirt ? '#7f1d1d' : '#1f2937', M4(s * .11, .06, .04)]];
  if (d.still) tp.push(...legP(-1), ...legP(1)); // 站在櫃台後面不走路：腿併進身體（少 2 次繪製）
  const torso = new THREE.Mesh(mergeParts(tp, true), mat); torso.castShadow = !LOW; body.add(torso);
  // 頭：方形，臉在 +z 面（z = .16）
  const head = new THREE.Group(); head.position.y = 1.55; body.add(head);
  const fz = .162, hp = [[RB(.32, .32, .32, .045), d.skin, M4(0, .17, 0)], [RB(.04, .08, .06, .015), d.skin, M4(-.165, .15, 0)], [RB(.04, .08, .06, .015), d.skin, M4(.165, .15, 0)]];
  [-1, 1].forEach(s => {
    hp.push([Bx(.075, .06, .01), '#ffffff', M4(s * .07, .17, fz)], [Bx(.036, .06, .012), '#2b1d14', M4(s * .07 + s * .016 * 0, .17, fz + .002)], [Bx(.014, .014, .012), '#ffffff', M4(s * .07 + .008, .188, fz + .004)]);
    hp.push([Bx(.08, .018, .012), d.hc === '#d4d4d8' ? '#a1a1aa' : d.hc, M4(s * .07, .222, fz, 0, 0, s * -.08)]);
    hp.push([Bx(.05, .025, .008), '#f4a4a4', M4(s * .1, .12, fz)]);
  });
  hp.push([RB(.04, .05, .03, .01), d.skin, M4(0, .135, fz + .012)], [Bx(.08, .018, .01), '#9f3f3f', M4(0, .085, fz)], [Bx(.018, .018, .01), '#9f3f3f', M4(-.045, .093, fz)], [Bx(.018, .018, .01), '#9f3f3f', M4(.045, .093, fz)]);
  const hc = d.hc, top = (k = 1) => [RB(.34 * k, .1, .34 * k, .03), hc, M4(0, .3, -.005)], back = (hgt = .2) => [RB(.34, hgt, .06, .02), hc, M4(0, .32 - hgt / 2, -.15)], fringe = () => [Bx(.34, .05, .03), hc, M4(0, .27, .16)];
  if (d.hair === 'short') hp.push(top(), back(), fringe(), [Bx(.03, .12, .3), hc, M4(-.165, .24, -.01)], [Bx(.03, .12, .3), hc, M4(.165, .24, -.01)]);
  if (d.hair === 'long') hp.push(top(), back(.42), fringe(), [Bx(.035, .36, .26), hc, M4(-.168, .14, -.02)], [Bx(.035, .36, .26), hc, M4(.168, .14, -.02)]);
  if (d.hair === 'bun') hp.push(top(), back(), fringe(), [RB(.14, .12, .12, .04), hc, M4(0, .39, -.08)]);
  if (d.hair === 'pony') hp.push(top(), back(), fringe(), [RB(.08, .26, .08, .03), hc, M4(0, .12, -.2, .25)], [Bx(.04, .04, .04), '#f472b6', M4(0, .26, -.18)]);
  if (d.hair === 'curly') { hp.push(top(1.04), back(.24)); for (let i = 0; i < 8; i++) { const a = i / 8 * PI2; hp.push([RB(.09, .09, .09, .03), hc, M4(Math.cos(a) * .15, .3 + (i % 2) * .03, Math.sin(a) * .15 - .02)]); } }
  if (d.hair === 'bald') hp.push([RB(.05, .1, .2, .02), hc, M4(-.17, .2, -.05)], [RB(.05, .1, .2, .02), hc, M4(.17, .2, -.05)], [RB(.3, .1, .05, .02), hc, M4(0, .2, -.165)]);
  if (d.hair === 'cap') hp.push(back(.16), [RB(.35, .12, .35, .03), d.cap, M4(0, .32, -.005)], [Bx(.3, .025, .14), d.cap, M4(0, .27, .22)]);
  if (d.acc === 'glasses') [-1, 1].forEach(s => hp.push([Bx(.09, .012, .012), '#1f2937', M4(s * .07, .205, fz + .008)], [Bx(.09, .012, .012), '#1f2937', M4(s * .07, .135, fz + .008)], [Bx(.012, .08, .012), '#1f2937', M4(s * .07 + s * .045, .17, fz + .008)], [Bx(.012, .08, .012), '#1f2937', M4(s * .07 - s * .045, .17, fz + .008)], [Bx(.03, .01, .01), '#1f2937', M4(0, .18, fz + .008)]));
  const hm = new THREE.Mesh(mergeParts(hp, true), mat); hm.castShadow = !LOW; head.add(hm);
  // 手腳：轉軸在肩膀與髖部
  const limb = (x, y, parts) => { const p = new THREE.Group(); p.position.set(x, y, 0); body.add(p); p.add(new THREE.Mesh(mergeParts(parts, true), mat)); return p; };
  const longS = d.acc === 'tie' || d.acc === 'hood' || d.acc === 'vest', legC = d.skirt ? d.skin : d.bot;
  const arm = s => limb(s * .3, 1.42, [[RB(.13, .3, .14, .035), d.top, M4(0, -.14, 0)], [RB(.12, .26, .13, .03), longS ? d.top : d.skin, M4(0, -.41, 0)], [RB(.11, .1, .12, .03), d.skin, M4(0, -.58, .005)]]);
  const leg = s => limb(s * .11, .86, [[RB(.16, .44, .17, .035), d.skirt ? d.skin : d.bot, M4(0, -.2, 0)], [RB(.15, .36, .16, .03), legC, M4(0, -.58, 0)], [RB(.16, .1, .26, .03), d.skirt ? '#7f1d1d' : '#1f2937', M4(0, -.8, .04)]]);
  const aL = arm(-1), aR = arm(1), lL = d.still ? new THREE.Group() : leg(-1), lR = d.still ? new THREE.Group() : leg(1); aL.rotation.z = -.05; aR.rotation.z = .05;
  const hb = new THREE.Mesh(new THREE.BoxGeometry(.8, 1.9 * sc, .8), new THREE.MeshBasicMaterial({ visible: false })); hb.position.y = .95 * sc; root.add(hb);
  return { root, body, head, aL, aR, lL, lR, hb };
}
function buildNPCs(g) {
  // 0 號：西邊改走 x＝−11 的斑馬線過馬路——x < −12.6 的大街留給計程車，車子不會穿過居民
  const ROUTES = [[[-62, -11.7], [62, -11.7], [62, 11.8], [-62, 11.8], [-11, 11.8], [-11, -11.7]], [[-14, PLAZA.z - 1], [0, PLAZA.z - 14.5], [14, PLAZA.z - 1], [0, PLAZA.z + 13.5]], [[-44, 34], [44, 34], [44, 18], [-44, 18]]];
  const len = r => r.reduce((a, p, i) => a + Math.hypot(r[(i + 1) % r.length][0] - p[0], r[(i + 1) % r.length][1] - p[1]), 0);
  const at = (route, s) => { const L0 = len(route); s = ((s % L0) + L0) % L0; for (let i = 0; i < route.length; i++) { const a = route[i], b = route[(i + 1) % route.length], d = Math.hypot(b[0] - a[0], b[1] - a[1]); if (s <= d) return [a[0] + (b[0] - a[0]) * s / d, a[1] + (b[1] - a[1]) * s / d, Math.atan2(b[0] - a[0], b[1] - a[1])]; s -= d; } return [route[0][0], route[0][1], 0]; };
  const defs = [...(LOW ? NPC_DEF.filter((d, i) => d.spot || i % 3 !== 2) : NPC_DEF), ...SHOPKEEP.map(d => { const sh = SHOPS[d.shop], x = sh.x + sh.w / 2 - 1.6; return Object.assign({}, d, { spot: [x, -17.7], face: [x, 0] }); })]; // 店員站在櫃台後面（LOW 也全建）
  W.routes = ROUTES; // 給驗收：居民路線不會和計程車道交叉
  W.npcs = defs.map((d, i) => {
    const m = npcMesh(d), n = { d, m, x: 0, z: 0, yaw: 0, ph: rnd(0, 6), stop: 0, talk: 0, walk: 0, hy: 0 };
    if (d.spot) { [n.x, n.z] = d.spot; const f = d.face || [0, PLAZA.z]; n.yaw = n.home = Math.atan2(f[0] - n.x, f[1] - n.z); }
    else { n.route = ROUTES[d.r]; n.s = d.o * len(n.route); n.v = (d.slow ? .75 : d.fast ? 1.45 : 1.1) * (i % 2 ? 1 : -1); [n.x, n.z, n.yaw] = at(n.route, n.s); }
    m.root.position.set(n.x, 0, n.z); m.root.rotation.y = n.yaw; m.hb.userData.npc = n; g.add(m.root); return n;
  });
  const lerpA = (a, b, k) => a + Math.atan2(Math.sin(b - a), Math.cos(b - a)) * k;
  W.anim.push((dt, t) => {
    if (!inCity()) return;
    W.npcs.forEach(n => {
      const px = P.x - CITY.x, pz = P.z - CITY.z, dx = px - n.x, dz = pz - n.z, dist = Math.hypot(dx, dz), m = n.m;
      m.root.visible = n.d.shop ? dist < (LOW ? 20 : 32) && !(n.d.shop === 'arms' && W.armsShut && W.armsShut.on) : dist < 75; if (!m.root.visible) return; // 店員只在附近才畫；武器店開張前不在
      n.talk = Math.max(0, n.talk - dt); const toP = Math.atan2(dx, dz);
      let moving = false;
      if (n.route) {
        // 玩家擋在前面或正在聊天時停下來，轉身面對玩家
        const ahead = dist < 2.4 && Math.cos(toP - n.yaw) > .2;
        if (n.talk > 0 || ahead) { n.yaw = lerpA(n.yaw, toP, Math.min(1, dt * 5)); }
        else if (n.stop > 0) n.stop -= dt;
        else { n.s += n.v * dt; if (Math.random() < dt * .03) n.stop = rnd(1.5, 4); const [x, z, yaw] = at(n.route, n.s); n.x = x; n.z = z; n.yaw = lerpA(n.yaw, yaw + (n.v < 0 ? Math.PI : 0), Math.min(1, dt * 6)); moving = true; }
      } else n.yaw = lerpA(n.yaw, n.talk > 0 || dist < 3.5 ? toP : n.home, Math.min(1, dt * 3));
      // 走路動畫：手腳前後擺、身體上下起伏；停下來時輕輕呼吸
      n.walk += ((moving ? 1 : 0) - n.walk) * Math.min(1, dt * 6); n.ph += dt * (moving ? Math.abs(n.v) * 5.2 : 1.6);
      const sw = Math.sin(n.ph) * .55 * n.walk;
      m.lL.rotation.x = sw; m.lR.rotation.x = -sw; m.aL.rotation.x = -sw * .8; m.aR.rotation.x = sw * .8;
      if (n.d.acc === 'guitar' && !moving) { m.aR.rotation.x = -.9 + Math.sin(t * 9) * .12; m.aL.rotation.x = -1.1; m.aL.rotation.z = .35; }
      if (n.d.id === 'zhang' && !moving && n.talk <= 0) m.aR.rotation.z = .06 + Math.max(0, Math.sin(t * 1.3)) * 1.4;
      m.body.position.y = Math.abs(Math.cos(n.ph)) * .035 * n.walk; m.body.scale.y = (n.d.kid || 1) * (1 + Math.sin(t * 1.8 + n.ph) * .006 * (1 - n.walk));
      // 頭：玩家在 6 公尺內就轉頭看玩家（最多轉 60 度）；聊天時會點頭
      const rel = Math.atan2(Math.sin(toP - n.yaw), Math.cos(toP - n.yaw)), want = dist < 6 ? clamp(rel, -1.05, 1.05) : Math.sin(t * .4 + n.ph) * .25;
      n.hy += (want - n.hy) * Math.min(1, dt * 4); m.head.rotation.y = n.hy; tkHead(n, m, dist, t); // 上下看著你、說話時點頭、揮手與歪頭（talk.js）
      if (n.d.shop) kpAnim(n, t);
      m.root.position.set(n.x, 0, n.z); m.root.rotation.y = n.yaw;
    });
  });
}
/* ---------- 店員：招呼、一句話泡泡（talk.js 的 bark）、小動作 ----------
   進店：門鈴（每間店音色不同）、揮手、第一次來說一句兼教學；之後隨機招呼，每間店 90 秒冷卻。泡泡同一個店員 6 秒內不重複同一句 */
const kpNpc = id => W.npcs && W.npcs.find(n => n.d.shop === id);
function kpSay(id, key, sub = {}) {
  const n = kpNpc(id), L = KP_LINES[id]; if (!n || !L || !n.m.root.visible) return null;
  const pool = key.startsWith('pick:') ? [L.pick[key.slice(5)]] : key.startsWith('pay:') ? [L.pay[key.slice(4)]] : L[key]; if (!pool || !pool[0]) return null;
  const said = n.kpSaid || (n.kpSaid = {}), now = performance.now(), fresh = pool.filter(x => !said[x] || now - said[x] > 6000); if (!fresh.length) return null;
  const raw = fresh[Math.floor(Math.random() * fresh.length)]; said[raw] = now; n.talk = Math.max(n.talk, 2.5); // 說話時轉過來看你
  return bark(npcWho(n), raw.replace('{d}', sub.d != null ? Math.round(sub.d).toLocaleString('en-US') : '').replace('{n}', sub.n || ''), { pin: true, cls: 'kp' }); // 店員在你背後回答：泡泡貼在畫面邊上
}
// 空手對準櫃台或店員按 E：聊一句（錢夠了的「想買」先問）
function kpTalk(id) { const w = Object.keys(S.wish).some(x => wareShop(x) === id && (wareState(...x.split(':')) || {}).can); kpSay(id, w ? 'wish' : 'hi'); const n = kpNpc(id); if (n) npcGest(n, 'nod'); }
// 店員的手：ring（伸手按收銀機）、stamp（左手蓋章）、shake（搖頭，疊在原本的轉頭上）
function kpAnim(n, t) {
  const a = n.kp; if (!a) return; const k = (performance.now() - a.t0) / a.d; if (k >= 1) { n.kp = null; return; } const e = smooth(0, .25, k) * (1 - smooth(.7, 1, k));
  if (a.k === 'ring') n.m.aR.rotation.x = -1.1 * e; else if (a.k === 'stamp') n.m.aL.rotation.x = -.9 - .5 * Math.sin(k * Math.PI); else if (a.k === 'shake') n.m.head.rotation.y += Math.sin(k * PI2 * 3) * .22 * e;
}
function kpDo(id, k, d) { const n = kpNpc(id); if (n && !RM()) n.kp = { k, t0: performance.now(), d }; }
// 店頭的範圍：店寬 ×〔店內 4.6 m＋騎樓 1.6 m〕（pad 往外多算幾公尺）；櫃台前緣中心 2.4 m 內＝在櫃台前
function inShop(id, pad = 0) { const sh = SHOPS[id], x = P.x - CITY.x - sh.x, z = P.z - CITY.z; return Math.abs(x) < sh.w / 2 + pad && z < -12.4 + pad && z > -18.6 - pad; }
function nearCounter(id) { const sh = SHOPS[id]; return Math.hypot(P.x - CITY.x - (sh.x + sh.w / 2 - 2.2), P.z - CITY.z + 16.4) < 2.4; }
const SHOPV = { now: '', gT: {}, inT: 0 };
// 每一格（只在大城市）：所在的店、招呼與門鈴、吊牌重畫、武器店捲門、城市裡飛走的氣球紙盒
function shopStep(dt, t) {
  tagStep(dt); armsShutStep(); cityFlyStep(dt);
  const id = SHOP_IDS.find(s => inShop(s)) || '';
  if (id !== SHOPV.now) { SHOPV.now = id; SHOPV.inT = 0; }
  if (id && !(id === 'arms' && W.armsShut && W.armsShut.on)) {
    SHOPV.inT += dt; const now = performance.now(), sp = Math.hypot(P.vx, P.vz), face = Math.cos(P.yaw) > .45;
    if (SHOPV.inT < 3 && (sp < 1.2 || face) && !GUI.kind && !(now - (SHOPV.gT[id] || -1e9) < 90000)) { SHOPV.gT[id] = now; shopGreet(id); }
  }
}
function shopGreet(id) {
  shopSnd.chime(id); const n = kpNpc(id); if (n) { setTimeout(() => npcGest(n, 'wave'), 250); n.talk = Math.max(n.talk, 2); }
  const first = !S.shopSeen[id], wish = Object.keys(S.wish).some(x => wareShop(x) === id && (wareState(...x.split(':')) || {}).can);
  setTimeout(() => kpSay(id, first ? 'first' : wish ? 'wish' : 'hi'), RM() ? 0 : 300); if (first) { S.shopSeen[id] = 1; save(); }
}
// 武器店開張：捲門 1.6 秒捲上去（嘩啦嘩啦），1.6 秒時碰撞解除，鐵伯出現揮手
function armsShutStep() {
  const A = W.armsShut; if (!A || !A.t0) return; const e = performance.now() - A.t0, rm = RM();
  if (rm) A.m.material.opacity = clamp(1 - e / 300, 0, 1); else A.m.scale.y = Math.max(.06, 1 - .94 * ease3(clamp(e / 1600, 0, 1)));
  if (e >= (rm ? 300 : 1600) && A.on) { A.on = false; armsGone(); }
  if (e >= 1700 && !A.said) { A.said = true; const n = kpNpc('arms'); if (n) { npcGest(n, 'wave'); n.talk = 2.5; } kpSay('arms', 'open'); A.t0 = 0; }
}
// 捲門完全收起：拿掉捲門、碰撞、告示；吊牌重畫、點擊範圍打開
function armsGone() {
  const A = W.armsShut; if (!A) return; A.on = false; if (A.m.parent) dropObj(A.m);
  for (const arr of W.cols.values()) { const i = arr.indexOf(A.col); if (i >= 0) arr.splice(i, 1); }
  W.inter = W.inter.filter(it => it !== A.it); armsInter(true); tagDirty();
}
/* 城市裡的氣球紙盒：結帳墊上綁好氣球 → 升到騎樓上方（1.6 秒）→ 往西邊天空升上去、越飄越小（4.4 秒）。離開城市就直接移除 */
const FLY = [];
function cityFlyStart(pw) {
  const g = new THREE.Group(); g.position.copy(pw); W.scene.add(g);
  const bx = W.flyBox || (W.flyBox = mergeParts([[new THREE.BoxGeometry(.3, .22, .24), '#c8a878', M4(0, .11, 0)], [new THREE.BoxGeometry(.31, .04, .25), '#b45309', M4(0, .14, 0)], [new THREE.BoxGeometry(.04, .225, .245), '#b45309', M4(0, .11, 0)]]));
  const m = new THREE.Mesh(bx, W.flyM || (W.flyM = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: .8 }))); m.userData.shared = true; g.add(m);
  const bal = balloons(LOW ? 2 : 3, .32); bal.position.y = .22; g.add(bal); g.scale.setScalar(.001);
  const f = { g, bal, t: -1, k: 0, p0: pw.clone() }; FLY.push(f); return f;
}
function cityFlyStep(dt) {
  for (let i = FLY.length - 1; i >= 0; i--) {
    const f = FLY[i]; if (!inCity()) { dropObj(f.g); FLY.splice(i, 1); continue; }
    if (f.t < 0) { balloonStep(f.bal, performance.now() / 1000, -1, f.k); f.g.scale.setScalar(Math.max(.001, Math.min(1, f.k * 3))); continue; } // 還在結帳墊上：氣球一顆一顆充氣
    f.t += dt; const t = f.t, p = f.g.position; balloonStep(f.bal, t, -1, 1);
    if (t < 1.6) { const u = ease3(t / 1.6); p.set(f.p0.x, f.p0.y + (3.2 - f.p0.y) * u, f.p0.z + (CITY.z - 12.5 - f.p0.z) * u); }
    else { const u = clamp((t - 1.6) / 4.4, 0, 1); p.set(f.p0.x - 20 * u * u, 3.2 + 26.8 * out3(u), CITY.z - 12.5 + Math.sin(u * 5) * .6); f.g.scale.setScalar(Math.max(.001, (1 - .6 * u) * (t > 5.2 ? 1 - (t - 5.2) / .8 : 1))); }
    if (t > 6) { dropObj(f.g); FLY.splice(i, 1); }
  }
}
// 會說話的店家：準心對到時頭上冒「…」、按 E 開口（talk.js 的 tkWhoOf 依 it.id 查這張表）
const TALK_AT = { cafe: () => cafeWho(), market: () => wangWho(), hospital: () => hospWho(), taxi: () => taxiWho() };
// 咖啡館：老闆在門口招呼（店裡的人看不到，泡泡從門口冒出來）；今天的小訂單用回話卡回答，E 只會選「下次吧」
const cafeWho = () => spotWho('cafe', '咖啡館老闆', [CITY.x - 28, 2.5, CITY.z + PLAZA.z - 3], [CITY.x - 28, 1.7, CITY.z + PLAZA.z - 2.1], { col: '#fde7b0', vo: [.9, 34], bye: '慢走喔～' });
function cafeAct() {
  const day = Math.floor(Date.now() / 864e5); if (S.cafe.d !== day) S.cafe = { d: day, done: false };
  const r = seeded(day * 13 + 5), us = unlockedSpecies(), sp = us[Math.floor(r() * us.length)], reward = Math.round(fair({ sp: sp.id, crisp: .7, dur: 100, deco: [] }, 'shop') * 1.6), who = cafeWho(); drawTV();
  const tv = S.liveBest ? '牆上的電視在播本週直播排行，你最高有 ' + S.liveBest + ' 個人在看喔！' : '牆上的電視每天都在播直播排行，哪天你也會上去的。';
  if (S.cafe.done) return talk(who, ['今天的訂單收到囉，謝謝你！', tv]);
  talk(who, ['歡迎光臨～外面有位子，坐一下吧。', { t: '今天店裡想擺一個「' + sp.name + '」的捏捏，可以賣我一個嗎？我出 ' + fmt(reward) + '。', opt: [
    { t: '交給老闆', sub: '+' + fmt(reward), ok: () => S.stock.some(q => q.sp === sp.id), no: '背包裡沒有' + short(sp.id) + '捏捏', nf: ['沒關係，做好了再拿來就好～'], f: () => cafeDeal(sp, reward, who, tv) },
    { t: '下次吧', e: 1, f: () => ['好喔，今天的訂單都有效～'] }] }]);
}
// 交貨：狀態一次改完並存檔（跟原本一樣）；手往前遞、門口冒一圈捏捏顏色的光點、錢包彈一下，不再 toast
function cafeDeal(sp, reward, who, tv) {
  const h = held(), p = h && h.t === 'prod' && h.p.sp === sp.id ? h.p : S.stock.find(q => q.sp === sp.id); if (!p) return ['咦？捏捏不見了……下次再說吧。'];
  S.stock = S.stock.filter(q => q !== p); addMoney(reward); S.fans += 1; gainXP(6); S.cafe.done = true; sfx.coin(); renderTop(); renderHotbar(true); saveCloud();
  VM.swing = .35; if (W.goo) W.goo.emit(who.mouth(new THREE.Vector3()), 8, sp.color, { size: .04, up: 1.6, speed: .8 }); tkBump('#sMoney');
  return [{ t: '謝謝！擺在櫃台剛剛好。', emo: 'heart' }, tv];
}
// 週末市集：每週六日擺攤，每週輪替一種稀有凝膠，加上一個打折的裝飾零件包
const mktOpenNow = () => { const d = new Date().getDay(); return d === 0 || d === 6; };
function marketOffers() {
  const w = weekNo(), rares = SPECIES.filter(s => s.rar >= 3), sp = rares[w % rares.length], pk = Object.keys(PACKS).filter(k => !S.packs.includes(k))[0];
  const list = [{ id: 'gel', t: sp.name + '凝膠 × 3', d: '本週限定的稀有凝膠（不用去' + ZONES.find(z => z.id === sp.zone).name + '也能拿到）', cost: sp.price * 4, c: sp.color, f: () => { S.gel[sp.id] = (S.gel[sp.id] || 0) + 3; discover(sp.id); } }];
  if (pk) list.push({ id: 'pack', t: PACKS[pk].name + '（市集價 7 折）', d: '市集限定的裝飾零件', cost: Math.round(PACKS[pk].cost * .7), c: '#e2e8f0', f: () => { S.packs.push(pk); } }); // c：買到時從攤子飛進手心的光點顏色
  return list;
}
// 週末市集：王阿姨（攤位後面的居民）招呼；準心對準攤位也是跟她說話。花錢的卡只能按數字或點選，E＝先不用
function wangWho() { const n = W.npcs && W.npcs.find(x => x.d.id === 'wang'), stall = t => !!t && !!t.it && t.it.id === 'market';
  if (!n) return spotWho('market', '王阿姨', [CITY.x + 28, 2.4, CITY.z + PLAZA.z - 4], [CITY.x + 28, 1.4, CITY.z + PLAZA.z - 3.6], { col: '#f97316', bye: '慢走喔，下週見！' }); // 萬一她不在：聲音從攤子出來
  const w = npcWho(n); return w.mk || (w.mk = Object.assign({}, w, { tg: t => w.tg(t) || stall(t) })); }
function marketAct() {
  const who = wangWho();
  if (!mktOpenNow()) return talk(who, ['攤子平日先用布蓋著，阿姨在整理這週的貨。', '星期六、日再來看看喔！']); // 她人就站在攤子後面，所以不說「在家」
  if (S.mkt.w !== weekNo()) S.mkt = { w: weekNo(), got: [] };
  const offers = marketOffers().filter(o => !S.mkt.got.includes(o.id));
  if (!offers.length) return talk(who, ['這週的好貨都被你買走啦！下週再來喔～']);
  talk(who, [{ t: '來來來，看看喔！這週的限定貨～', g: 'wave' }, { t: '每樣限買一次，要哪一樣？', opt: offers.slice(0, 2).map(o => ({ t: o.t.replace('史萊姆', '').split('（')[0], sub: fmt(o.cost), ok: () => S.money >= o.cost && !S.mkt.got.includes(o.id), no: '錢不夠', nf: [{ t: '哎呀，錢包好像不太夠喔～賣掉幾個捏捏再來。', emo: 'sweat' }], f: () => mktBuy(o) })) }], { none: ['慢慢看，不買也沒關係～'] });
}
function mktBuy(o) {
  if (S.mkt.got.includes(o.id) || S.money < o.cost) return [{ t: '哎呀，錢包好像不太夠喔～', emo: 'sweat' }];
  S.money -= o.cost; o.f(); S.mkt.got.push(o.id); sfx.pop(); renderTop(); renderHotbar(true); saveCloud(); tkBump('#sMoney');
  if (W.goo) W.goo.emit(new THREE.Vector3(CITY.x + 28, 1.3, CITY.z + PLAZA.z - 4), o.id === 'gel' ? 9 : 6, o.c || '#e2e8f0', { collect: true }); // 買到的東西從攤子飛進手心（跟採集凝膠同一種光點）
  return [{ t: '好眼光！這可是這週才有的喔。', emo: 'star' }];
}
/* ============================================================
   計程車與月光隧道（第 4 堂）：叫車之後到下車之間的那一段路——沒有卡片、沒有黑幕、沒有字卡，鏡頭一路連續，世界照常在動
   - 叫車：talk.js 的泡泡＋回話卡（taxiAsk）；同時你那一側的後門打開、福伯轉頭看你、車頂燈閃兩下（taxiHail）
   - 上車（board）：鏡頭走到門外、彎腰鑽進去、坐下（從靠花島的左門上來再挪到右座），門「砰」地關上、方向燈、起步
   - 開車（drive）：沿碎石路／大街開進月光隧道，在第 3 盞燈正下方、最暗的那一刻換到另一頭（rideSwap），出洞就是目的地
   - 下車（alight）：靠邊停、右門打開、鏡頭側身挪出去站起來，操作交還；空車自己開回招呼站（taxiStep 的 return）
   ============================================================ */
const TAXI_LEGS = []; // 路段編號（網路與存檔用）：1 V_OUT、2 C_IN、3 C_INF（凍僵）、4 C_OUT、5 V_IN、6 V_PARK、7 C_PARK（空車開回站位）
const TUN_FOG = new THREE.Color('#1b1712'), TUN_HS = new THREE.Color('#ffd9a0'), TUN_HG = new THREE.Color('#2a2420'), CARD_C = new THREE.Color(), RP = {}, RQ = new THREE.Quaternion(), RQ2 = new THREE.Quaternion(), RE = new THREE.Euler(0, 0, 0, 'YXZ'), RO = { y: 0, p: 0 }, RV = new THREE.Vector3(), RV2 = new THREE.Vector3(), AX_Z = new THREE.Vector3(0, 0, 1);
const Q_SEAT = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), -Math.PI / 2); // 鏡頭（往 −z 看）轉成朝車頭（+x）
let TUBES = [];
// 路段：控制點 → Catmull–Rom（每段 14 點）→ 重新取樣（約 0.5 m，最後一點剛好是終點）；速度三遍法：曲率限速 √(aLat/κ) → 加速 → 減速；時間表 T（毫秒）給 legS 反查
function taxiCR(pts, n = 14) { const out = []; for (let i = 0; i < pts.length - 1; i++) { const a = pts[Math.max(0, i - 1)], b = pts[i], c = pts[i + 1], d = pts[Math.min(pts.length - 1, i + 2)]; for (let k = 0; k < n; k++) { const t = k / n, t2 = t * t, t3 = t2 * t; out.push([0, 1].map(j => .5 * (2 * b[j] + (-a[j] + c[j]) * t + (2 * a[j] - 5 * b[j] + 4 * c[j] - d[j]) * t2 + (-a[j] + 3 * b[j] - 3 * c[j] + d[j]) * t3))); } } out.push(pts[pts.length - 1]); return out; }
const taxiArc = (cx, cz, r, f, n = 20) => Array.from({ length: n + 1 }, (_, i) => f(cx, cz, r, i / n * Math.PI));
function taxiLeg(dense, city, cap, o = {}) {
  const acc = [0]; for (let i = 1; i < dense.length; i++) acc.push(acc[i - 1] + Math.hypot(dense[i][0] - dense[i - 1][0], dense[i][1] - dense[i - 1][1]));
  const L = acc[acc.length - 1], n = Math.ceil(L / .5) + 1, st = L / (n - 1), F = () => new Float64Array(n), X = F(), Z = F(), Hd = F(), K0 = F(), Ka = F(), Ks = F(), V = F(), T = F();
  for (let i = 0, j = 0; i < n; i++) { const s = Math.min(L, i * st); while (j < acc.length - 2 && acc[j + 1] < s) j++; const f = (s - acc[j]) / Math.max(1e-9, acc[j + 1] - acc[j]); X[i] = dense[j][0] + (dense[j + 1][0] - dense[j][0]) * f; Z[i] = dense[j][1] + (dense[j + 1][1] - dense[j][1]) * f; }
  X[n - 1] = dense[dense.length - 1][0]; Z[n - 1] = dense[dense.length - 1][1]; // 終點剛好在 u＝15：換邊的那一點不能差一點點
  for (let i = 0; i < n; i++) { const a = Math.max(0, i - 1), b = Math.min(n - 1, i + 1); Hd[i] = Math.atan2(X[b] - X[a], Z[b] - Z[a]); }
  for (let i = 1; i < n - 1; i++) { const d = Math.atan2(X[i + 1] - X[i], Z[i + 1] - Z[i]) - Math.atan2(X[i] - X[i - 1], Z[i] - Z[i - 1]); K0[i] = Math.atan2(Math.sin(d), Math.cos(d)) / st; }
  for (let i = 0; i < n; i++) { let sa = 0, ss = 0, c = 0; for (let j = Math.max(0, i - 6); j <= Math.min(n - 1, i + 6); j++) { sa += Math.abs(K0[j]); ss += K0[j]; c++; } Ka[i] = sa / c; Ks[i] = ss / c; }
  const aL = o.aLat || 6, ac = o.acc || 3.5, de = o.dec || 4;
  for (let i = 0; i < n; i++) V[i] = Math.min(cap(X[i], Z[i]), Ka[i] > 1e-4 ? Math.sqrt(aL / Ka[i]) : 99);
  V[0] = Math.min(V[0], o.v0 || 0); V[n - 1] = Math.min(V[n - 1], o.v1 || 0);
  for (let i = 1; i < n; i++) V[i] = Math.min(V[i], Math.sqrt(V[i - 1] ** 2 + 2 * ac * st));
  for (let i = n - 2; i >= 0; i--) V[i] = Math.min(V[i], Math.sqrt(V[i + 1] ** 2 + 2 * de * st));
  for (let i = 1; i < n; i++) T[i] = T[i - 1] + 2 * st / (Math.max(V[i - 1], .3) + Math.max(V[i], .3)) * 1000;
  return { X, Z, H: Hd, K: Ks, V, T, n, st, L, city, dur: T[n - 1] };
}
function taxiLegs() {
  if (TAXI_LEGS.length) return TAXI_LEGS; const U = TAXI.U, vz = TAXI.V.z, cx = TAXI.C.x, capV = () => 16, capC = x => x < cx ? 16 : 14, cap5 = () => 5, park = { aLat: 3.5, acc: 2, dec: 2.5 }; // 管子裡 16 m/s：出發那段在 u≈10 前加速完、目的地那段 u≈8 之後才煞車，換邊那一點前後都是等速（頭和車身不會點一下）
  const uturn = (x0, z0, r) => taxiArc(x0, z0, r, (a, b, rr, t) => [a + rr * Math.sin(t), b + rr * Math.cos(t)]);
  TAXI_LEGS[1] = taxiLeg(taxiCR([[-19.6, 19], [-19.6, 23], [-18.8, 28], [-18.9, 34.5], [-23.2, 44.4], [-29, 53], [-32.8, 60.5], [-33.75, 66], [-33.75, vz], [-33.75, vz + U / 2], [-33.75, vz + U]]), false, capV, { v1: 16 });
  TAXI_LEGS[2] = taxiLeg(taxiCR([[cx - U, 1.75], [cx - U / 2, 1.75], [cx, 1.75], [-70, 2], [-50, 2.2], [-36, 2.4], [-30, 3.6], [-26, 5.2], [-24, 5.4]]), true, capC, { v0: 16 });
  TAXI_LEGS[3] = taxiLeg([...taxiCR([[cx - U, 1.75], [cx - U / 2, 1.75], [cx, 1.75], [-70, 2], [-50, 2.2], [-34, 2.2], [-26, 2.2], [-22, 2.2]]), ...uturn(-22, -1.6, 3.8).slice(1), ...taxiCR([[-22, -5.4], [-25, -5.4], [-28.5, -5.4]], 6).slice(1)], true, capC, { v0: 16 });
  TAXI_LEGS[4] = taxiLeg(taxiCR([[-28.5, -5.4], [-34, -5.2], [-40, -3.2], [-46, -2.3], [-60, -2.2], [-76, -1.85], [cx, -1.75], [cx - U / 2, -1.75], [cx - U, -1.75]]), true, capC, { v1: 16 });
  TAXI_LEGS[5] = taxiLeg(taxiCR([[-30.25, vz + U], [-30.25, vz + U / 2], [-30.25, vz], [-30.25, 66], [-29.6, 61], [-26.3, 55.5], [-20.3, 46.6], [-15.1, 37.4], [-12.2, 30.5], [-9.4, 25.5], [-8.9, 22.5], [-8.9, 20]]), false, capV, { v0: 16 });
  TAXI_LEGS[6] = taxiLeg([...taxiCR([[-8.9, 20], [-8.9, 18.5], [-8.9, 17]], 4), ...taxiArc(-14.25, 17, 5.35, (a, b, r, t) => [a + r * Math.cos(t), b - r * Math.sin(t)]).slice(1), [-19.6, 18], [-19.6, 19]], false, cap5, park);
  TAXI_LEGS[7] = taxiLeg([...taxiCR([[-24, 5.4], [-22, 5], [-19.5, 4.4]], 6), ...uturn(-19.5, -.5, 4.9).slice(1), ...taxiCR([[-19.5, -5.4], [-24, -5.4], [-28.5, -5.4]], 6).slice(1)], true, cap5, park);
  return TAXI_LEGS;
}
// 路段上第 s 公尺：位置、航向 hd（atan2(dx, dz)；車的 rotation.y＝hd − π/2）、帶正負號的曲率、速度與速度對距離的變化
function legAt(l, s, o = {}) { const f0 = clamp(s / l.st, 0, l.n - 1), i = Math.min(l.n - 2, Math.floor(f0)), f = f0 - i; let dh = l.H[i + 1] - l.H[i]; dh = Math.atan2(Math.sin(dh), Math.cos(dh)); o.x = l.X[i] + (l.X[i + 1] - l.X[i]) * f; o.z = l.Z[i] + (l.Z[i + 1] - l.Z[i]) * f; o.hd = l.H[i] + dh * f; o.k = l.K[i] + (l.K[i + 1] - l.K[i]) * f; o.v = l.V[i] + (l.V[i + 1] - l.V[i]) * f; o.dv = (l.V[i + 1] - l.V[i]) / l.st; o.s = s; return o; }
// 時間（毫秒）→ 第幾公尺：沿時間表二分搜尋
function legS(l, t) { const T = l.T; if (t <= 0) return 0; if (t >= l.dur) return l.L; let a = 0, b = l.n - 1; while (b - a > 1) { const m = (a + b) >> 1; if (T[m] <= t) a = m; else b = m; } return (a + (t - T[a]) / Math.max(1e-9, T[b] - T[a])) * l.st; }

/* ---------- 月光隧道：兩根一模一樣的管子、谷口、城市那頭的洞口與小山 ---------- */
const tubeArc = (m, n = 16) => Array.from({ length: n + 1 }, (_, i) => { const a = i / n * Math.PI; return [(TAXI.HW + m) * Math.cos(a), TAXI.WALL + (TAXI.TOP - TAXI.WALL + m) * Math.sin(a)]; }); // 拱：右（θ＝0）→ 頂 → 左
// 管子（兩頭共用一份）：本地 x＝橫向、y＝上、z＝往山裡的深度 u。斷面每段一個顏色（磁磚、青綠腰帶、混凝土、柏油、白邊線），燈光沿 u 烘進頂點色（牆面亮度起伏 ≤ 15%）；
// 燈在天花板正中、黃色中線每段 3 m 中心對準燈：u∈[0, 30] 對 (u＝15, x＝0) 點對稱（不對稱的東西只能放在 u ≥ 31）。最後 6 m 往黑色漸暗、盡頭封口
function tubeGeo() {
  const T = TAXI, arcN = LOW ? 6 : 12, du = LOW ? 1 : .5, CC = {}, pos = [], cols = [];
  Object.entries({ road: '#3f4450', line: '#e5e7eb', curb: '#8f8a80', walk: '#a8a29e', tile: '#f3ead8', band: '#5fb8a8', conc: '#b9b2a6', mid: '#facc15' }).forEach(([k, v]) => { CC[k] = new THREE.Color(v); });
  const half = [[.08, 0, 3.64, 0, 'road'], [3.64, 0, 3.76, 0, 'line'], [3.76, 0, 3.8, 0, 'road'], [3.8, 0, 3.8, .2, 'curb'], [3.8, .2, 4.4, .2, 'walk'], [4.4, .2, 4.4, 1.1, 'tile'], [4.4, 1.1, 4.4, 1.3, 'band'], [4.4, 1.3, 4.4, 2.2, 'tile'], [4.4, 2.2, 4.4, T.WALL, 'conc']];
  for (let i = 0; i < arcN / 2; i++) { const a0 = i / arcN * Math.PI, a1 = (i + 1) / arcN * Math.PI; half.push([T.HW * Math.cos(a0), T.WALL + (T.TOP - T.WALL) * Math.sin(a0), T.HW * Math.cos(a1), T.WALL + (T.TOP - T.WALL) * Math.sin(a1), 'conc']); }
  const segs = [...half, ...half.map(([x0, y0, x1, y1, c]) => [-x0, y0, -x1, y1, c]), [-.08, 0, .08, 0, 'mid']];
  const lit = u => (.8 + .2 * T.LAMP.reduce((a, lu) => a + Math.exp(-(((u - lu) / 2.2) ** 2)), 0)) * (1 - smooth(30, 36, u)), put = (x, y, z, c, k) => { pos.push(x, y, z); cols.push(c.r * k, c.g * k, c.b * k); };
  for (let u0 = 0; u0 < T.LEN - 1e-6; u0 += du) {
    const u1 = Math.min(T.LEN, u0 + du), k0 = lit(u0), k1 = lit(u1), um = (u0 + u1) / 2 % 6, dash = um > 1.5 && um < 4.5;
    for (const [x0, y0, x1, y1, ck] of segs) { const c = CC[ck === 'mid' && !dash ? 'road' : ck]; put(x0, y0, u0, c, k0); put(x1, y1, u0, c, k0); put(x1, y1, u1, c, k1); put(x0, y0, u0, c, k0); put(x1, y1, u1, c, k1); put(x0, y0, u1, c, k1); }
  }
  const lampC = new THREE.Color('#ffd28a'); T.LAMP.forEach(lu => { const g = new THREE.BoxGeometry(1, .12, .35).toNonIndexed().translate(0, T.TOP - .1, lu), p = g.attributes.position; for (let i = 0; i < p.count; i++) put(p.getX(i), p.getY(i), p.getZ(i), lampC, 1.8 * (1 - smooth(30, 36, lu))); g.dispose(); }); // 燈具
  const rim = [[-T.HW, 0], [T.HW, 0], ...tubeArc(0)], blk = new THREE.Color('#000000'); for (let i = 0; i < rim.length; i++) { const a = rim[i], b = rim[(i + 1) % rim.length]; put(0, T.WALL * .6, T.LEN, blk, 1); put(a[0], a[1], T.LEN, blk, 1); put(b[0], b[1], T.LEN, blk, 1); } // 盡頭封口
  const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); geo.setAttribute('color', new THREE.Float32BufferAttribute(cols, 3)); geo.computeBoundingSphere(); return geo;
}
function tubeShape(m) { const s = new THREE.Shape(); s.moveTo(-(TAXI.HW + m), 0); s.lineTo(TAXI.HW + m, 0); tubeArc(m).forEach(([x, y]) => s.lineTo(x, y)); s.closePath(); return s; }
// 兩根管子（第 0＋3 層：從外面看得到洞口裡面，鏡頭只畫第 3 層時也看得到）＋出口亮光卡（只在第 3 層，不搭車的人永遠看不到）＋谷口；光源也開第 3 層
function buildTunnel() {
  const geo = tubeGeo(), mat = new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.DoubleSide }), cardGeo = new THREE.ShapeGeometry(tubeShape(0));
  mat.onBeforeCompile = sh => { sh.vertexShader = sh.vertexShader.replace('#include <fog_vertex>', '#ifdef USE_FOG\n\tvFogDepth = length( mvPosition.xyz );\n#endif'); }; mat.customProgramCacheKey = () => 'tubeFog'; // 霧用距離、不用深度：轉頭看側後方時，管子深處 14 m 外也是純霧色
  TUBES = [['V', W.scene, TAXI.V, 'forest'], ['C', W.city, TAXI.C, 'coast']].map(([k, par, o, zone]) => {
    const m = new THREE.Mesh(geo, mat); m.position.set(o.x, o.y, o.z); m.rotation.y = Math.atan2(o.dx, o.dz); m.layers.mask = 9; par.add(m);
    const card = new THREE.Mesh(cardGeo, new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0, depthWrite: false, fog: false, toneMapped: false })); card.position.z = .2; card.layers.mask = 8; card.visible = false; card.renderOrder = 3; m.add(card);
    return { k, m, card, o, zone, wx: o.x + (k === 'C' ? CITY.x : 0), wz: o.z + (k === 'C' ? CITY.z : 0) };
  });
  valleyPortal(); W.anim.push(taxiStep);
  W.sun.layers.enable(3); W.hemi.layers.enable(3); // 光源也在第 3 層：鏡頭只畫第 3 層時光源數量不變，材質不會重新編譯
}
// 谷口：暖灰石塊的頭牆（中央 8.6 m 往兩側降到 5 m，順著山坡）、淺色拱框、頂上收邊、往外 30° 的翼牆、兩盞石燈籠與「月光隧道」石匾；洞口裡一道擋板
function valleyPortal() {
  const V = TAXI.V, g = new THREE.Group(); g.position.set(V.x, V.y, V.z); g.rotation.y = Math.atan2(V.dx, V.dz); W.scene.add(g);
  const P0 = [], GL = [], rd = seeded(23), HW = TAXI.HW + .06, AH = TAXI.TOP - TAXI.WALL + .06, B = (w, h, d, c, x, y, z, rz = 0, j = 0) => P0.push([j ? jit(new THREE.BoxGeometry(1, 1, 1), j, rd() * 99 | 0) : new THREE.BoxGeometry(1, 1, 1), c, M4(x, y, z, 0, 0, rz, w, h, d)]);
  const TOP = [[7, 5], [5, 6.6], [2.5, 8.1], [0, 8.6], [-2.5, 8.1], [-5, 6.6], [-7, 5]], topY = x => { const a = Math.abs(x); return a < 2.5 ? 8.6 - .2 * a : a < 5 ? 8.1 - .6 * (a - 2.5) : 6.6 - .8 * (a - 5); };
  const inArch = (x, y, m) => y < TAXI.WALL ? Math.abs(x) < HW + m : (x / (HW + m)) ** 2 + ((y - TAXI.WALL) / (AH + m)) ** 2 < 1;
  // 牆身：拱形缺口的外輪廓擠出 3.2 m 厚（後半段埋進山裡），縫隙看起來像灰縫
  const sh = new THREE.Shape(); sh.moveTo(-7, -.6); sh.lineTo(-HW, -.6); [...tubeArc(.06)].reverse().forEach(([x, y]) => sh.lineTo(x, y)); sh.lineTo(HW, -.6); sh.lineTo(7, -.6); TOP.forEach(([x, y]) => sh.lineTo(x, y)); sh.closePath();
  P0.push([new THREE.ExtrudeGeometry(sh, { depth: 3.2, bevelEnabled: false, curveSegments: 1 }).translate(0, 0, -.4), '#85776a', null]);
  const SC = ['#c6b297', '#b5a185', '#d1bf9f', '#aa977e', '#bfab8e']; // 暖灰石塊（天光偏藍，顏色要比想像的再暖一點）
  for (let r = 0; r < 16; r++) { const y0 = r * .55, y1 = y0 + .5, off = r % 2 ? .55 : 0; // 石塊（交丁砌），拱框與牆頂附近讓開
    for (let x0 = -7 - off; x0 < 7; x0 += 1.1) { const xa = Math.max(-7, x0 + .03), xb = Math.min(7, x0 + 1.07), xc = (xa + xb) / 2; if (xb - xa < .3 || y1 > topY(xc) - .1 || [[xa, y0], [xb, y0], [xa, y1], [xb, y1]].some(([x, y]) => inArch(x, y, .78))) continue; B(xb - xa, .5, .14, SC[rd() * SC.length | 0], xc, y0 + .25, -.47, 0, .07); } }
  for (let i = 0; i < 3; i++) [-1, 1].forEach(s => B(.7, .84, .22, '#efe4cf', s * (HW + .37), i * .87 + .42, -.51, 0, .05)); // 拱框：直牆的部分
  const NA = 11, ax = HW + .37, ay = AH + .37;
  for (let i = 0; i < NA; i++) { const a = (i + .5) / NA * Math.PI, key = i === (NA - 1) / 2; B(key ? 1 : 1.18, key ? .95 : .72, key ? .3 : .22, key ? '#f6ecd8' : '#efe4cf', ax * Math.cos(a), TAXI.WALL + ay * Math.sin(a), key ? -.55 : -.51, Math.atan2(ay * Math.cos(a), -ax * Math.sin(a)), .05); } // 拱框：拱石與拱心石
  for (let i = 0; i < TOP.length - 1; i++) { const [x0, y0] = TOP[i], [x1, y1] = TOP[i + 1]; B(Math.hypot(x1 - x0, y1 - y0) + .25, .32, 3.5, '#ddd0b9', (x0 + x1) / 2, (y0 + y1) / 2 + .1, 1.2, Math.atan2(y1 - y0, x1 - x0)); } // 頂上收邊
  [-1, 1].forEach(s => { const th = s > 0 ? Math.PI / 6 : 5 * Math.PI / 6, dx = Math.cos(th), dz = -Math.sin(th); // 翼牆：往外 30°、6 m 長、高度往外遞減
    [4.6, 3.4, 2.2].forEach((h, j) => { const d = j * 2 + 1, x = s * 7 + dx * d, z = -.4 + dz * d; P0.push([jit(new THREE.BoxGeometry(1, 1, 1), .05, 40 + j + (s > 0 ? 9 : 0)), '#b4a189', M4(x, h / 2 - .3, z, 0, th, 0, 2.05, h + .6, .8)], [new THREE.BoxGeometry(1, 1, 1), '#ddd0b9', M4(x, h + .1, z, 0, th, 0, 2.1, .25, .95)]); addCol({ x: V.x + x, z: V.z + z, r: 1 }); }); });
  [-1, 1].forEach(s => { const x = s * 5.3, z = -2.4; B(.55, .85, .55, '#9a8f80', x, .42, z, 0, .04); [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(([a, b]) => P0.push([new THREE.BoxGeometry(.07, .42, .07), '#8a8072', M4(x + a * .2, 1.06, z + b * .2)])); // 石燈籠（自發光，不加光源）
    P0.push([new THREE.ConeGeometry(.46, .34, 4), '#8a8072', M4(x, 1.45, z, 0, Math.PI / 4, 0)], [sphG(.07, 6, 4), '#8a8072', M4(x, 1.66, z)]); GL.push([new THREE.BoxGeometry(.34, .34, .34), '#ffd28a', M4(x, 1.06, z)]); addCol({ x: V.x + x, z: V.z + z, r: .4 }); });
  const m = new THREE.Mesh(mergeParts(P0), new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: .92, metalness: 0 })); m.castShadow = !LOW; m.receiveShadow = true; g.add(m);
  g.add(new THREE.Mesh(mergeParts(GL), new THREE.MeshBasicMaterial({ vertexColors: true })));
  const tex = artTex(512, 148, (c, w, h) => { const gr = c.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, '#dcd5c6'); gr.addColorStop(1, '#c2b9a8'); c.fillStyle = gr; c.fillRect(0, 0, w, h); c.strokeStyle = '#8c8272'; c.lineWidth = 8; c.strokeRect(6, 6, w - 12, h - 12);
    c.font = '700 92px ' + ART_FONT; c.fillStyle = 'rgba(255,255,255,.6)'; c.fillText('月光隧道', w / 2 + 2, 110, w - 60); c.fillStyle = '#4a4238'; c.fillText('月光隧道', w / 2, 107, w - 60); }); // 石匾：刻字（亮邊＋深色字）
  const pq = mesh(new THREE.PlaneGeometry(3.3, .95), new THREE.MeshStandardMaterial({ map: tex, roughness: .9, metalness: 0 }), 0, 7.25, -.62, g); pq.rotation.y = Math.PI;
  addCol({ box: [V.x - 7.2, V.z - .6, V.x - HW, V.z + 2.8] }); addCol({ box: [V.x + HW, V.z - .6, V.x + 7.2, V.z + 2.8] });
  addCol({ box: [V.x - 4.6, V.z + .6, V.x + 4.6, V.z + 1.2], msg: '隧道很長，用走的會走到天黑——搭計程車吧。' }); // 行人擋板
}
// 城市那頭：大街西端盡頭的擋土牆（爬藤、青綠磁磚拱框、月牙與鐘塔的馬賽克）＋後面的小山（空心的殼，管子在裡面）。從廣場往西看，一直都看得到回家的路
function cityTunnel(g) {
  const C = TAXI.C, w = new THREE.Group(); w.position.set(C.x, 0, C.z); w.rotation.y = Math.atan2(C.dx, C.dz); g.add(w);
  const P0 = [], rd = seeded(41), HW = TAXI.HW + .06, AH = TAXI.TOP - TAXI.WALL + .06, B = (ww, h, d, c, x, y, z, rz = 0, j = 0) => P0.push([j ? jit(new THREE.BoxGeometry(1, 1, 1), j, rd() * 99 | 0) : new THREE.BoxGeometry(1, 1, 1), c, M4(x, y, z, 0, 0, rz, ww, h, d)]);
  const sh = new THREE.Shape(); sh.moveTo(-30, -.6); sh.lineTo(-HW, -.6); [...tubeArc(.06)].reverse().forEach(([x, y]) => sh.lineTo(x, y + C.y)); sh.lineTo(HW, -.6); sh.lineTo(30, -.6); sh.lineTo(30, 12); sh.lineTo(-30, 12); sh.closePath();
  P0.push([new THREE.ExtrudeGeometry(sh, { depth: 1.4, bevelEnabled: false, curveSegments: 1 }).translate(0, 0, -.05), '#a69d8f', null]);
  B(60.6, .45, 1.8, '#cfc7b8', 0, 12.1, .6); for (let x = -27; x <= 27; x += 6) if (Math.abs(x) > 7) B(.7, 12, .3, '#b4ab9c', x, 6, -.15); // 頂上收邊、壁柱
  for (let i = 0; i < 4; i++) [-1, 1].forEach(s => B(.5, .62, .12, i % 2 ? '#5fb8a8' : '#f3ead8', s * (HW + .28), i * .66 + .33 + C.y, -.12)); // 拱框：直牆的磁磚
  const NA = 17; for (let i = 0; i < NA; i++) { const a = (i + .5) / NA * Math.PI; B(.82, .55, .12, i % 2 ? '#5fb8a8' : '#f3ead8', (HW + .28) * Math.cos(a), TAXI.WALL + C.y + (AH + .28) * Math.sin(a), -.12, Math.atan2((AH + .28) * Math.cos(a), -(HW + .28) * Math.sin(a))); } // 拱框：拱上的磁磚
  // 月牙與鐘塔的馬賽克（x 反過來排：這面牆的本地 +x 在看的人左手邊）
  const MOS = ['.....r......', '....rrr..*..', '..y.ggg.....', '.yy.gwg.....', '.y..ggg..*..', '.y..ggg.....', '.yy.ggg.....', '..y.ggg.*...', '...ggggg....'], MC = { '.': '#24427a', r: '#e05a4f', y: '#fde68a', g: '#9aa5b5', w: '#f8fafc', '*': '#fff3b0' };
  B(4.3, 3.36, .1, '#e9e2d2', 0, 8.6, -.1); MOS.forEach((row, r) => [...row].forEach((ch, c) => B(.3, .3, .06, MC[ch], (5.5 - c) * .32, 10.04 - .16 - r * .32, -.17)));
  for (let i = 0; i < (LOW ? 8 : 14); i++) { const x = -28 + rd() * 56; if (Math.abs(x) < 7.5) continue; let y = 12, sx = x; const n = 3 + (rd() * 8 | 0); for (let j = 0; j < n; j++) { sx += (rd() - .5) * .3; P0.push([blobG(.34, i + j), ['#4f8a3e', '#5f9b48', '#3f7a35'][j % 3], M4(sx, y, -.12, 0, j, 0, 1, 1.1, .5)]); y -= .45; } } // 爬藤
  const m = new THREE.Mesh(mergeParts(P0), new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: .9, metalness: 0 })); m.receiveShadow = true; w.add(m);
  // 小山：半橢球（中心 (−140, 0)、半軸 x 60、高 34、z 80），x > −84.2 的頂點壓平到牆面、整片壓平的三角面拿掉（被擋土牆蓋住）；外緣往下裙到 −1 m；顏色依坡度從草綠到岩石
  const sg = new THREE.SphereGeometry(1, LOW ? 22 : 34, LOW ? 8 : 12, 0, PI2, 0, Math.PI / 2).toNonIndexed(), p = sg.attributes.position, keep = [];
  for (let i = 0; i < p.count; i++) { const oy = p.getY(i); let x = p.getX(i) * 60 - 140, y = oy * 34; const z = p.getZ(i) * 80; y = oy < 1e-3 ? -1 : y * (.9 + .2 * vnoise(x * .06, z * .06, 61)); if (x > -84.2) x = -84.2; p.setXYZ(i, x, y, z); }
  for (let i = 0; i < p.count; i += 3) if (!(p.getX(i) >= -84.21 && p.getX(i + 1) >= -84.21 && p.getX(i + 2) >= -84.21)) keep.push(i);
  const pos = new Float32Array(keep.length * 9), col = new Float32Array(keep.length * 9), c1 = new THREE.Color('#7cb35f'), c2 = new THREE.Color('#5e8f4a'), c3 = new THREE.Color('#8d877b'), tc = new THREE.Color();
  keep.forEach((i, k) => { for (let j = 0; j < 3; j++) pos.set([p.getX(i + j), p.getY(i + j), p.getZ(i + j)], k * 9 + j * 3); }); sg.dispose();
  const hg = new THREE.BufferGeometry(); hg.setAttribute('position', new THREE.BufferAttribute(pos, 3)); hg.computeVertexNormals(); const nr = hg.attributes.normal;
  for (let i = 0; i < nr.count; i++) { tc.copy(c2).lerp(c1, hashN(i / 3 | 0, 7, 3)).lerp(c3, smooth(.75, .45, nr.getY(i))); col.set([tc.r, tc.g, tc.b], i * 3); }
  hg.setAttribute('color', new THREE.BufferAttribute(col, 3)); hg.computeBoundingSphere();
  const hill = new THREE.Mesh(hg, new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: .95, metalness: 0 })); hill.receiveShadow = true; g.add(hill);
}
// 開機時把隧道與車內的著色器先編譯好（載入畫面蓋住卡頓）：鏡頭暫時看全部圖層、亮光卡打開
function taxiWarm() {
  const m0 = W.cam.layers.mask; try { W.cam.layers.mask = 15; TUBES.forEach(T => { T.card.visible = true; }); W.r.compile(W.scene, W.cam); } catch (e) { } TUBES.forEach(T => { T.card.visible = false; }); W.cam.layers.mask = m0;
  // 陰影的深度著色器（雙面的樹叢、會隨風擺的植物）只在第一次畫進陰影貼圖時才編譯：從城市出發的話，第一次在月光谷出洞那一格會卡一下。
  // 開機時在兩頭的洞口與下車處各畫一格（compile 不會編譯陰影用的材質；shadowMap.render 不能單獨呼叫），載入畫面蓋著看不到
  if (LOW || !W.sun.castShadow) return; const cp = W.cam.position.clone(), cq = W.cam.quaternion.clone(), cv = W.city.visible;
  try { for (const [x, z, city] of [[TAXI.V.x, TAXI.V.z - 10, false], [-8.9, 20, false], [CITY.x + TAXI.C.x + 10, CITY.z, true], [CITY.x - 24, CITY.z + 5, true]]) {
    cullChunks({ x, z }); W.city.visible = city; const y = city ? 0 : H(x, z); W.sun.target.position.set(x, y, z); W.sun.position.copy(W.sun.target.position).addScaledVector(SUN_D, 66); W.sun.updateMatrixWorld(); W.sun.target.updateMatrixWorld();
    W.cam.position.set(x, y + 1.6, z); W.cam.lookAt(x + 1, y + 1.4, z + 1); W.cam.updateMatrixWorld(); W.r.shadowMap.needsUpdate = true; W.r.render(W.scene, W.cam); } } catch (e) { console.warn(e); }
  W.cam.position.copy(cp); W.cam.quaternion.copy(cq); W.city.visible = cv; cullChunks(P); W.r.shadowMap.needsUpdate = true;
}
// 第一次叫車：目的地那一頭的貼圖排隊，taxiStep 每格上傳一張（出洞那一格不會因為上傳貼圖卡住）
function taxiPrewarm(toCity) {
  if (!W.r.initTexture || (W.twarm = W.twarm || {})[toCity]) return; W.twarm[toCity] = 1; const q = W.taxiWarmQ = W.taxiWarmQ || [], seen = new Set();
  const take = o => { if (!toCity && o === W.city) return false; [].concat(o.material || []).forEach(m => ['map', 'emissiveMap', 'alphaMap', 'roughnessMap'].forEach(k => { const t = m[k]; if (t && t.isTexture && !seen.has(t)) { seen.add(t); q.push(t); } })); return true; };
  const walk = o => { if (take(o)) o.children.forEach(walk); }; walk(toCity ? W.city : W.scene);
}
// 每格（W.anim）：車內與司機掛在玩家那一頭的車上、近遠切換、玻璃、燈箱、門、司機的頭、下車後關門與空車開回站位
function taxiStep(dt, t) {
  if (!W.taxiV || !W.taxiC || !INNER.g || !P) return; const now = performance.now(), cp = W.cam.position, cityP = inCity(TITLE.on || INTRO.on ? cp.x : P.x);
  if (W.taxiWarmQ && W.taxiWarmQ.length) { try { W.r.initTexture(W.taxiWarmQ.shift()); } catch (e) { } }
  for (const cab of [W.taxiV, W.taxiC]) {
    const u = cab.userData, ride = RIDE.on && RIDE.cab === cab, mine = ride || (!RIDE.on && u.city === cityP);
    if (mine && INNER.g.parent !== cab) cab.add(INNER.g);
    if (u.next && now >= u.at) { const k = u.next; u.next = ''; // 下車之後：門在身後關上、0.7 秒後空車開回站位（凍僵時已經停在醫院門口）
      if (k === 'close') { u.doors.forEach(d => { if (d.a1) cabDoor(cab, d.s, false, 250); }); rideSnd.door(false); u.next = 'go'; u.at = now + 700; }
      else { const st = u.city ? TAXI.cStand : TAXI.vStand; if (Math.hypot(cab.position.x - st[0], cab.position.z - st[1]) < .5) cabPark(cab); else { u.st = 'return'; u.leg = TAXI_LEGS[u.city ? 7 : 6]; u.lt = 0; u.it.off = true; } } }
    if (u.st === 'return' && u.leg) { const dx = P.x - u.wx, dz = P.z - u.wz, lx = dx * u.c - dz * u.s, lz = dx * u.s + dz * u.c; // 擋在車頭前 3 m 內：等你走開
      if (!(lx > 1.6 && lx < 4.95 && Math.abs(lz) < 1.2)) u.lt += dt * 1000; if (u.lt >= u.leg.dur) cabPark(cab); else placeCab(cab, legAt(u.leg, legS(u.leg, u.lt), u.p), null); }
    const d = Math.hypot(u.wx - cp.x, u.wz - cp.z); if (!mine || (d > 60 && !ride)) continue;
    const near = ride || d < (LOW ? 12 : 18); INNER.g.visible = near; // 遠了：車內與司機整組藏起來、玻璃不透明
    u.glass.visible = !(ride && RIDE.inside); u.glassM.opacity = LOW || !near ? .85 : .35 + .5 * smooth(14, 18, d);
    const bk = now - u.blink, bl = bk < 400 ? (Math.sin(bk / 400 * Math.PI * 4) > 0 ? .9 : -.6) : 0; u.signM.emissiveIntensity = Math.max(.05, ((ride ? .25 : .9) + bl) * (1 + DN.night)); // 空車亮、有人暗；叫車時閃兩下
    u.doors.forEach(dr => { if (dr.a !== dr.a1 && now >= dr.t0) { const q = clamp((now - dr.t0) / dr.d, 0, 1); dr.a = dr.a0 + (dr.a1 - dr.a0) * out3(q); dr.g.rotation.y = dr.s * dr.a * 1.2217; } });
    if (near) taxiDriver(cab, dt, t, now);
  }
}
// 司機的頭：叫車、說話、上下車時轉向你（±.6）並點頭；開車時看前方、偶爾瞄一下後照鏡；到站揮手
function taxiDriver(cab, dt, t, now) {
  const fu = INNER.fu, u = cab.userData, R = RIDE, ride = R.on && R.cab === cab, talking = TK.on && TK.who && TK.who.id === 'taxi', cp = W.cam.position; let want = 0;
  if (ride ? R.ph !== 'drive' || now < R.talkT : u.hail || talking || Math.hypot(P.x - u.wx, P.z - u.wz) < 6) { fu.head.getWorldPosition(RV); RV2.copy(cp).sub(RV); const lx = RV2.x * u.c - RV2.z * u.s, lz = RV2.x * u.s + RV2.z * u.c; want = clamp(Math.atan2(-lz, lx), -.6, .6); }
  else if (ride && R.fz == null) { if (now > INNER.mir) INNER.mir = now + 6000 + Math.random() * 7000; if (INNER.mir - now < 600) want = -.25; } // 瞄後照鏡的時間記在 INNER（跟著司機換邊，不會因為換車頭一轉）；測試停住時間時不瞄
  fu.head.rotation.y += (want - fu.head.rotation.y) * Math.min(1, dt * 5); fu.head.rotation.x = talking || (ride && now < R.talkT) ? Math.sin(t * 6) * .06 : 0;
  const wv = (now - u.wave) / 1000; fu.aR.rotation.z = wv >= 0 && wv < 1 ? 1.2 * Math.sin(Math.PI * wv) : .05;
}
// 叫車（talk 開始／結束）：你那一側的後門打開、福伯轉頭看你、車頂燈閃兩下；走開或「再逛逛」就關門
function taxiHail(on) {
  const cab = inCity() ? W.taxiC : W.taxiV; if (!cab || RIDE.on) return; const u = cab.userData; if (u.st !== 'park') return;
  u.hail = on; if (on) { const s = cabSide(cab); u.blink = performance.now(); cabDoor(cab, s, true, 320, 300); setTimeout(() => { if (u.hail) rideSnd.door(true); }, 300); taxiPrewarm(!u.city); }
  else u.doors.forEach(d => { if (d.a1) cabDoor(cab, d.s, false, 350); });
}
// 司機（talk.js 的說話者）：泡泡錨在頭上、尾巴指著嘴；每格重算，車在動也跟得上。叫車時也是他（taxiWho）
function driverWho() {
  return INNER.who || (INNER.who = { id: 'taxi', k: 'say', name: '福伯', role: '計程車司機', col: '#fde047', vo: [.85, 30], r: 8, bye: '要搭車再叫我～',
    at: v => INNER.fu.head.getWorldPosition(v).add(RV2.set(0, .62, 0)), mouth: v => INNER.fu.head.localToWorld(v.set(0, .1, .17)),
    xz: () => { const e = INNER.fu.head.matrixWorld.elements; return [e[12], e[14]]; }, tg: t => !!t && !!t.it && t.it.id === 'taxi' });
}
const taxiWho = () => driverWho();
const RIDE_SAY = { sit: '坐穩囉～', sitF: '暖氣開最大囉，撐一下～', fast: '好咧，抓穩囉！', city: '到囉，慢慢逛～', home: '到家囉，路上小心。', hosp: '醫院到了，快進去吧！', wait: '到囉，慢慢來～' };
function rideSay(k) { const R = RIDE; if (R.said[k] || typeof bark !== 'function') return; R.said[k] = 1; if (bark(driverWho(), RIDE_SAY[k])) R.talkT = performance.now() + 900 + 90 * [...RIDE_SAY[k]].length; }
// 叫車：司機的泡泡＋回話卡（E＝上車：免費、可反悔）；同時開門、轉頭。對話系統還沒載入時 E 直接上車，不會有確認卡片
function taxiAsk() {
  if (typeof talk !== 'function') return taxiRide();
  const toCity = !inCity(), who = taxiWho(), q = S.frozen ? (toCity ? '哎呀，你在發抖耶！我載你去城裡的醫院吧？' : '還是要回月光谷？') : toCity ? '要去大城市嗎？' : '要回月光谷了嗎？';
  const pre = [...(S.frozen && !toCity ? ['醫院就在路的北邊喔，先去看醫生吧。'] : []), ...(toCity && !W.taxiN ? ['城裡有機械行、器材行跟生活百貨，買機器都在那邊。'] : [])];
  if (talk(who, [...pre, { t: q, opt: [{ t: '上車', e: 1, f: () => { W.taxiN = (W.taxiN || 0) + 1; tkEnd('ride', true); taxiRide(); } }, { t: '再逛逛', f: () => { taxiHail(false); return ['好喔，要搭車再叫我～']; } }] }], { end: why => { if (why !== 'ride') taxiHail(false); } })) taxiHail(true); // 再逛逛：福伯回話的同時就把門關上
}
function taxiRide() { rideStart(inCity() ? 'c2v' : 'v2c'); }

/* ---------- 搭車本體 ---------- */
// 上下車的曲線（車的本地座標，車停著）：位置 p＝[{ t, p }]，切線用前後兩點的時間差算（Hermite，起點終點速度 0）；朝向 q＝[{ t, y, p }]（車的本地 yaw／pitch）另外一組，
// 每段 ease3、yaw 走最短的那一邊。朝向只用 yaw＋pitch 組出來，側傾永遠是 0；位置要繞過開著的門，朝向卻不必跟著每個轉折轉：走過去的那一段只轉一次、轉得慢
function rideKnots(k) { const n = k.length; k.forEach((a, i) => { a.m = new THREE.Vector3(); if (i > 0 && i < n - 1) a.m.subVectors(k[i + 1].p, k[i - 1].p).divideScalar(k[i + 1].t - k[i - 1].t); }); return k; }
function rideCurve(cv, t, op, oo) {
  const P0 = cv.p, n = P0.length, Q = cv.q, m = Q.length;
  if (t <= P0[0].t) op.copy(P0[0].p); else if (t >= P0[n - 1].t) op.copy(P0[n - 1].p);
  else { let i = 0; while (i < n - 2 && t > P0[i + 1].t) i++; const a = P0[i], b = P0[i + 1], h = b.t - a.t, s = (t - a.t) / h, s2 = s * s, s3 = s2 * s; op.copy(a.p).multiplyScalar(2 * s3 - 3 * s2 + 1).addScaledVector(a.m, (s3 - 2 * s2 + s) * h).addScaledVector(b.p, 3 * s2 - 2 * s3).addScaledVector(b.m, (s3 - s2) * h); }
  if (t <= Q[0].t) { oo.y = Q[0].y; oo.p = Q[0].p; } else if (t >= Q[m - 1].t) { oo.y = Q[m - 1].y; oo.p = Q[m - 1].p; } else { let i = 0; while (i < m - 2 && t > Q[i + 1].t) i++; const a = Q[i], b = Q[i + 1], e = ease3((t - a.t) / (b.t - a.t)); oo.y = a.y + wrapA(b.y - a.y) * e; oo.p = a.p + (b.p - a.p) * e; }
}
const rideQ = (lp, ly) => Q_SEAT.clone().multiply(new THREE.Quaternion().setFromEuler(new THREE.Euler(lp, ly, 0, 'YXZ'))); // 坐在車裡往前看、再轉 ly（正＝往左）、俯仰 lp（車的本地朝向）
const seatO = (lp, ly) => ({ y: ly - Math.PI / 2, p: lp }), lookO = (a, b) => ({ y: Math.atan2(a.x - b.x, a.z - b.z), p: Math.atan2(b.y - a.y, Math.hypot(b.x - a.x, b.z - a.z)) }); // 同上，寫成車的本地 yaw／pitch；從 a 看向 b
const mixO = (a, b, k) => ({ y: a.y + wrapA(b.y - a.y) * k, p: a.p + (b.p - a.p) * k }), distO = (a, b) => Math.hypot(wrapA(b.y - a.y), b.p - a.p);
// 上車：鏡頭走到門外 D、彎腰到門檻 M、坐下 E（左門上來再挪到右座）。起點在門前（開著的門擋路）或車頭：先往外再繞到門後；在車尾：先橫移到門那一側
function rideBoardCurve(cab, s, rm) {
  const T = TAXI, V3 = (x, y, z) => new THREE.Vector3(x, y, z), inv = new THREE.Matrix4().copy(cab.matrixWorld).invert(), p0 = W.cam.position.clone().applyMatrix4(inv), e0 = new THREE.Euler().setFromQuaternion(cab.getWorldQuaternion(new THREE.Quaternion()).invert().multiply(W.cam.quaternion), 'YXZ'), o0 = { y: e0.y, p: e0.x };
  const D = V3(T.D[0], T.D[1], s * T.D[2]), M = V3(T.M[0], rm ? T.E[1] : T.M[1], s * T.M[2]), Es = V3(T.E[0], T.E[1], s * T.E[2]), ER = V3(...T.E), way = [];
  if (p0.x > -.3) { if (Math.abs(p0.z) < 2.3) way.push(V3(Math.max(p0.x, -.2), 1.56, s * 2.4)); way.push(V3(-1.05, 1.56, s * 2.4)); } else if (p0.x < -2 || Math.abs(p0.z) < .95) way.push(V3(Math.max(p0.x, -2.4), 1.56, s * 1.8));
  const pts = [...way, D], oIn = lookO(D, Es), oSeat = seatO(-.05, s * .1); let len = 0, prev = p0; pts.forEach(q => { len += Math.hypot(q.x - prev.x, q.z - prev.z); prev = q; });
  const T1 = rm ? 300 : clamp(Math.max(len * 120, distO(o0, oIn) * 260), 420, 900), dl = rm ? 0 : T1 - 420, kp = [{ t: 0, p: p0 }], kq = [{ t: 0, ...o0 }, { t: T1, ...oIn }]; let acc = 0; prev = p0; // 轉頭角度大（背對車門）就走慢一點
  way.forEach(q => { acc += Math.hypot(q.x - prev.x, q.z - prev.z); prev = q; kp.push({ t: T1 * acc / Math.max(.01, len), p: q }); });
  if (rm) { kp.push({ t: 300, p: D }, { t: 600, p: M }, { t: 900, p: ER }); kq.push({ t: 600, ...mixO(oIn, oSeat, .5) }, { t: 900, ...seatO(-.05, .1) }); return { p: rideKnots(kp), q: kq, o0, end: 900, dl: 0 }; } // 減少動態：直線三段、不彎腰不挪座、不回彈
  kp.push({ t: T1, p: D }, { t: 850 + dl, p: M }, { t: 1250 + dl, p: Es }); kq.push({ t: 850 + dl, ...mixO(oIn, oSeat, .6) }, { t: 1250 + dl, ...oSeat });
  if (s < 0) { kp.push({ t: 1550 + dl, p: V3(T.E[0], T.E[1] - .03, 0) }, { t: 1800 + dl, p: ER }); kq.push({ t: 1550 + dl, ...seatO(-.05, 0) }, { t: 1800 + dl, ...seatO(-.05, .1) }); } // 從左門上來：屁股往右座挪過去（中段下沉 3 cm）
  return { p: rideKnots(kp), q: kq, o0, end: (s < 0 ? 1900 : 1450) + dl, dl };
}
// 下車：右座 → 門檻 → 門外 → 站立點（最後一點換算自世界座標：交還操作那一刻剛好就是玩家的眼睛、朝最後的 yaw、俯仰 −.05）
function rideAlightCurve(cab, st, rm) {
  const T = TAXI, V3 = (x, y, z) => new THREE.Vector3(x, y, z), inv = new THREE.Matrix4().copy(cab.matrixWorld).invert(), pS = V3(st.x, st.y + 1.62, st.z).applyMatrix4(inv), oS = { y: wrapA(st.yaw - cab.rotation.y), p: -.05 }, oOut = seatO(-.12, -1.25), tt = rm ? [100, 320, 490, 650] : [250, 600, 820, 1050];
  return { p: rideKnots([{ t: tt[0], p: RIDE.lpos.clone() }, { t: tt[1], p: V3(T.M[0], rm ? T.E[1] : T.M[1], T.M[2]) }, { t: tt[2], p: V3(...T.D) }, { t: tt[3], p: pS }]), q: [{ t: tt[0], y: RIDE.cy, p: RIDE.cp }, { t: tt[1], ...oOut }, { t: tt[2], ...mixO(oOut, oS, .5) }, { t: tt[3], ...oS }] };
}
// 下車站立點：月光谷在花島東側（看得到出生點）；城市在咖啡館前的人行道（面向目前的目標，沒有就面向廣場）；凍僵時在醫院門口、面向醫院
function rideOutPt(cab) {
  const T = TAXI, aim = (x, z, tx, tz) => Math.atan2(-(tx - x), -(tz - z));
  if (!cab.userData.city) { const [x, z] = T.vOut; return { x, z, y: H(x, z), yaw: aim(x, z, T.vLook[0], T.vLook[1]) }; }
  const fz = !!RIDE.legs && RIDE.legs[1] === TAXI_LEGS[3], [lx, lz] = fz ? T.cOutF : T.cOut, x = CITY.x + lx, z = CITY.z + lz; let tx = CITY.x + (fz ? T.cHosp : T.cLook)[0], tz = CITY.z + (fz ? T.cHosp : T.cLook)[1];
  if (!fz) { const o = objective(); if (o && o.x != null && o.n !== '計程車招呼站' && inCity(o.x)) { tx = o.x; tz = o.z; } }
  return { x, z, y: 0, yaw: aim(x, z, tx, tz) };
}
// 從選單直接坐進車裡時的「安全站位」：招呼站那台車右門外
function rideSafe(cab) { const u = cab.userData, lz = u.city ? 2.15 : 1.85; return { x: u.wx - .75 * u.c + lz * u.s, z: u.wz + .75 * u.s + lz * u.c, yaw: P.yaw }; }
function rideStart(dir, o = {}) {
  if (RIDE.on || !W.ready || !P || TITLE.on || INTRO.on) return false; const LG = taxiLegs(), R = RIDE, v2c = dir === 'v2c', cab = v2c ? W.taxiV : W.taxiC, u = cab.userData, rm = RM(), seated = !!o.seated, now = performance.now();
  if (u.st !== 'park') cabPark(cab); // 空車還在開回站位：直接放回站位（從選單回家時，人在筆記本後面看不到）
  if (TK.on) tkEnd('ride', true); if (L.on) L.on = false; // 直播中走去搭車：保險再關一次
  const s = seated ? 1 : cabSide(cab), st = u.city ? TAXI.cStand : TAXI.vStand; cab.add(INNER.g); INNER.g.visible = true; u.st = 'ride'; u.hail = false; u.it.off = true; u.it.wp = null;
  u.doors.forEach(d => { if (d.s !== s && d.a1) cabDoor(cab, d.s, false); }); W.sun.layers.enable(3); W.hemi.layers.enable(3); // 山洞組若重設光源圖層也不會壞
  Object.assign(R, { on: true, dir, ph: 'board', t: 0, t0: now, ei: 0, legs: v2c ? [LG[1], S.frozen ? LG[3] : LG[2]] : [LG[4], LG[5]], li: 0, rate: rm ? 1.5 : 1, cab, side: s, ly: .1, lp: -.05, k: 0, u: -99, ue: -99, f0: null, frozen: !!S.frozen, tq: [], said: {}, out: false, snap: 0, held: false, shut: seated, inside: seated, ffT: 0, wt: 0, bnc: -1e9, talkT: 0, v: 0, a: 0, alat: 0, s: 0, jn: -1, jt: -1e9, npcN: 0,
    park: { x: st[0], z: st[1], hd: st[2] + Math.PI / 2 }, sus: { y: cab.position.y, vy: 0, p: cab.rotation.z, vp: 0, r: cab.rotation.x, vr: 0 }, head: { x: 0, vx: 0, z: 0, vz: 0, p: 0, vp: 0, r: 0, vr: 0 },
    safe: seated ? rideSafe(cab) : { x: P.x, z: P.z, yaw: P.yaw }, log: R.logOn ? [] : null, lpos: new THREE.Vector3(...TAXI.E), lquat: rideQ(-.05, .1) });
  R.hk.clear(); KEYS.clear(); IN.hold = IN.holdE = false; IN.jx = IN.jy = 0; if (IN.joy) { IN.joy = null; $('#joyKnob').style.transform = ''; $('#joyBase').classList.remove('on'); }
  P.vx = P.vz = 0; P.running = P.sneak = false; P.eye = 1.62; R.lastYaw = P.yaw; document.body.classList.add('riding'); rideUI(true);
  const e = []; if (seated) { R.cv = null; R.tb = 1450; R.t = 1440; e.push([1440, () => { rideSnd.start(); rideSnd.blink(1); rideSay(R.frozen ? 'sitF' : 'sit'); }]); }
  else {
    const c = rideBoardCurve(cab, s, rm), dl = c.dl, Lf = s < 0, tm = x => rm ? x * 900 / ((Lf ? 1900 : 1450) + dl) : x; R.cv = c; R.tb = c.end; R.cy = c.o0.y; R.cp = c.o0.p; R.lquat.setFromEuler(RE.set(R.cp, R.cy, 0, 'YXZ'));
    if (!u.doors[s < 0 ? 0 : 1].a1) e.push([0, () => { cabDoor(cab, s, true, rm ? 200 : 300); rideSnd.door(true); }]); // 叫車時沒開門（例如對話系統沒載入）：現在開
    e.push([tm(1150 + dl), () => cabDoor(cab, s, false, rm ? 150 : 290)], [tm(1420 + dl), () => { rideSnd.door(false); R.shut = true; }], [tm(1250 + dl), () => { rideSnd.seat(false); rideSnd.start(); if (!Lf && !rm) R.bnc = performance.now(); }]);
    if (Lf) e.push([tm(1300 + dl), () => rideSnd.seat(true)], [tm(1650 + dl), () => { if (!rm) R.bnc = performance.now(); }]);
    e.push([tm((Lf ? 1500 : 1300) + dl), () => rideSay(R.frozen ? 'sitF' : 'sit')], [tm((Lf ? 1700 : 1250) + dl), () => rideSnd.blink(2)]);
  }
  R.evs = e.sort((a, b) => a[0] - b[0]); save(); return true;
}
function rideDriveEv() {
  const R = RIDE, T = R.legs[0].dur + R.legs[1].dur;
  return [[0, rideHint], [T - 1700, () => rideSnd.blink(2)], [T - 1300, () => rideSay(R.dir === 'c2v' ? 'home' : R.frozen ? 'hosp' : 'city')]];
}
function rideEv() { const R = RIDE; while (R.on && R.evs && R.ei < R.evs.length && R.t >= R.evs[R.ei][0]) { const f = R.evs[R.ei++][1]; try { f(); } catch (e) { console.error(e); } } }
function rideStep(dt) {
  const R = RIDE; if (!R.on) return; const now = performance.now(), rm = RM();
  // 開快一點：上車之後才按下、按住 0.25 秒以上的空白鍵／E／F／Enter、滑鼠左鍵、快轉圓鈕或在畫面上按住不動；點一下不算。管子裡最多 2 倍
  let held = false; R.hk.forEach(t0 => { if (now - t0 >= 250) held = true; });
  if ((IN.hold && IN.hT > R.t0 && now - IN.hT >= 250) || (R.ffT && now - R.ffT >= 250) || (IN.look && IN.look.moved < 12 && IN.look.t > R.t0 && now - IN.look.t >= 250)) held = true;
  if (GUI.kind || mOpen) held = false; if (held && !R.held && R.ph === 'drive') rideSay('fast'); R.held = held;
  const tgt = held ? (R.k > .5 ? 2 : 3) : rm ? 1.5 : 1; R.rate += (tgt - R.rate) * (1 - Math.exp(-(tgt > R.rate ? 14 : 12) * Math.min(dt, .1)));
  const stop = R.ph === 'drive' && rideNpcAhead(); // 保險：車前 6 m 內有居民就停（路線不交叉，應該永遠不會發生）
  if (R.fz != null) R.t = R.fz; else if (!stop) R.t += dt * 1000 * (R.ph === 'drive' ? R.rate : clamp(R.rate / (rm ? 1.5 : 1), 1, 2)); // 上下車：沒按住就是原速（減少動態的 1.5 倍只給開車），按住最多 2 倍
  let swapped = false;
  if (R.ph === 'board') { rideEv(); if (R.t >= R.tb) { R.ph = 'drive'; R.t = R.fz != null ? R.t : R.t - R.tb; R.ei = 0; R.evs = rideDriveEv(); } }
  if (R.ph === 'drive') { const T1 = R.legs[0].dur, T2 = R.legs[1].dur; if (R.li === 0 && R.t >= T1) { rideSwap(); swapped = true; } rideEv(); if (R.t >= T1 + T2) { R.t = T1 + T2; R.park = legAt(R.legs[1], R.legs[1].L, {}); if (GUI.kind || mOpen) { R.ph = 'wait'; R.wt = 0; } else rideAlight(); } }
  if (R.ph === 'wait' && !GUI.kind && !mOpen) { if (!R.wt) { R.wt = now; rideSay('wait'); } else if (now - R.wt > 120) rideAlight(); } // 到站時介面開著：停好怠速等你闔上，闔上後福伯說一句再開門（1.3 秒內交還操作）
  if (R.ph === 'alight') { rideEv(); if (!R.on) return; }
  const cab = R.cab;
  if (R.ph === 'drive') { const T1 = R.legs[0].dur, l = R.legs[R.li], p = legAt(l, legS(l, R.li ? R.t - T1 : R.t), RP), v = p.v * R.rate; R.v = v; R.a = rm ? 0 : v * p.dv * R.rate; R.alat = rm ? 0 : -v * v * p.k; R.s = p.s; placeCab(cab, p, R.sus, dt, R.a, R.alat); }
  else { R.v = R.a = R.alat = 0; placeCab(cab, R.park, R.sus, dt, 0, 0); }
  rideCam(dt);
  if (swapped) { W.quietZone = true; cullChunks(P); landmarkStep(); DRS.skip = 2; }
  if (R.ph === 'drive' && !cab.userData.city && (R.sN = (R.sN || 0) + 1) % 4 === 0) rideSlimes(cab);
  rideEnv(dt); rideSnd.step(R.v, R.k, !cab.userData.city && R.ue < 0, R.held);
  if (R.log) R.log.push([+now.toFixed(1), R.ph, R.li, +R.t.toFixed(1), +W.cam.position.x.toFixed(4), +W.cam.position.y.toFixed(4), +W.cam.position.z.toFixed(4), +P.yaw.toFixed(5), +R.u.toFixed(4), W.cam.layers.mask, +R.rate.toFixed(3), W.r.info.programs.length]);
}
// 換邊（同一格內做完再畫）：出發那台放回站位、車內與司機搬到目的地那台、人換到另一根管子的 u＝15（鏡頭只畫第 3 層、兩頭點對稱，看不出來）
function rideSwap() {
  const R = RIDE, from = R.cab, to = from === W.taxiV ? W.taxiC : W.taxiV, tu = to.userData;
  cabPark(from); if (tu.st !== 'park') cabPark(to); tu.st = 'ride'; tu.hail = false; tu.it.off = true; tu.glass.visible = false; // 目的地那台的玻璃這一格就藏起來
  to.add(INNER.g); R.cab = to; R.li = 1; R.jn = -1; R.sus.y += (tu.city ? TAXI.C.y : TAXI.V.y) - (tu.city ? TAXI.V.y : TAXI.C.y); // 管子地板高度不同：彈簧只保留相對的起伏
  R.safe = rideOutPt(to); R.snap = 2;
}
function rideAlight() {
  const R = RIDE, cab = R.cab, rm = RM(); R.ph = 'alight'; R.t = 0; R.ei = 0; R.cy = R.ly - Math.PI / 2; R.cp = R.lp + R.head.p; R.park = legAt(R.legs[1], R.legs[1].L, {}); R.stand = rideOutPt(cab); R.cv = rideAlightCurve(cab, R.stand, rm); cab.userData.wave = performance.now();
  R.evs = [[0, () => rideSnd.lock()], [rm ? 80 : 150, () => { cabDoor(cab, 1, true, rm ? 200 : 300); rideSnd.door(true); R.shut = false; }], [rm ? 650 : 1050, rideEnd]];
}
// 鏡頭：座位（頭部延遲＋路面震動）或上下車的曲線；轉頭的輸入收進相對車身的 ly、lp，P 一直跟著鏡頭（陰影、網路、存檔都直接能用）
function rideCam(dt) {
  const R = RIDE, cab = R.cab, cam = W.cam, rm = RM(), lp = R.lpos, lq = R.lquat, now = performance.now(), seat = R.ph === 'drive' || R.ph === 'wait' || (R.ph === 'board' && !R.cv);
  let dy = P.yaw - R.lastYaw; dy = Math.atan2(Math.sin(dy), Math.cos(dy));
  if (seat) {
    if (!GUI.kind) { R.ly = clamp(R.ly + dy, -1.9, 1.9); R.lp = clamp(P.pitch, -.6, .45); }
    const h = R.head, k = Math.min(dt, .05), z = rm ? 0 : 1, tr = clamp(.007 * R.alat, -.04 - R.sus.r, .04 - R.sus.r) * z;
    [['x', clamp(-.0055 * R.a, -.025, .025) * z], ['z', clamp(-.0045 * R.alat, -.025, .025) * z], ['p', clamp(.006 * R.a, -.03, .03) * z], ['r', tr]].forEach(([q, tg]) => { const vq = 'v' + q; h[vq] += (49 * (tg - h[q]) - 9.8 * h[vq]) * k; h[q] += h[vq] * k; });
    const city = cab.userData.city, tub = R.ue > 0, tv = R.fz != null ? R.fz / 1000 : W.t, amp = rm ? 0 : (tub || city ? .0007 : .0018) * Math.min(1, R.v / 8); // 路面震動：碎石 1.8 mm、柏油與管子 0.7 mm（17＋23 Hz）
    let vib = amp * (.6 * Math.sin(tv * 106.8) + .4 * Math.sin(tv * 144.5 + 1.3)); if (!rm && R.v < .5) vib += .0005 * Math.sin(tv * 163.4); // 怠速 26 Hz
    if (!rm && R.ph === 'drive' && (tub || city)) { const j = Math.floor(R.s / 12) * 1000 + Math.floor((R.s - 2.5) / 12); if (j !== R.jn) { if (R.jn !== -1) R.jt = now; R.jn = j; } } // 伸縮縫：每 12 m 一道，前後輪各咚一下
    const jk = (now - R.jt) / 70, bk = (now - R.bnc) / 320; if (jk < 1) vib += .003 * Math.sin(Math.PI * jk); if (bk < 1) vib -= .015 * Math.sin(Math.PI * bk) * (1 - bk); // 座椅回彈 1.5 cm
    lp.set(TAXI.E[0] + h.x, TAXI.E[1] + vib, TAXI.E[2] + h.z); lq.copy(Q_SEAT).multiply(RQ2.setFromEuler(RE.set(R.lp + h.p, R.ly, h.r, 'YXZ')));
  } else if (R.cv) { rideCurve(R.cv, R.t, lp, RO); let dy = wrapA(RO.y - R.cy), dp = RO.p - R.cp; const d = Math.hypot(dy, dp), mx = 6.5 * Math.min(dt, .05); if (d > mx) { dy *= mx / d; dp *= mx / d; } R.cy += dy; R.cp += dp; lq.setFromEuler(RE.set(R.cp, R.cy, 0, 'YXZ')); } // 上下車：朝向每格最多轉 6.5 rad/s（原本看著另一邊的窗外也不會一格轉過頭）、不側傾
  cab.updateMatrixWorld(true); cam.position.copy(lp).applyMatrix4(cab.matrixWorld); cab.getWorldQuaternion(RQ); cam.quaternion.copy(RQ).multiply(lq);
  if (S.frozen) { cam.position.x += Math.sin(W.t * 47) * .0056; cam.position.y += Math.cos(W.t * 53) * .0056; if (!rm) cam.quaternion.multiply(RQ2.setFromAxisAngle(AX_Z, Math.sin(W.t * 41) * .0048)); } // 凍僵：車上照樣發抖，只剩走路時的 40%（減少動態時不側傾）
  const fov = (W.fov0 || 72) + (R.ph === 'drive' && !rm ? 3 * clamp((R.rate - 1) / 2, 0, 1) : 0); if (Math.abs(cam.fov - fov) > .02) { cam.fov += (fov - cam.fov) * Math.min(1, dt * 6); cam.updateProjectionMatrix(); }
  RV2.set(0, 0, -1).applyQuaternion(cam.quaternion); const wy = Math.atan2(-RV2.x, -RV2.z);
  P.x = cam.position.x; P.z = cam.position.z; P.y = cam.position.y - P.eye; P.camY = P.y; P.yaw = R.lastYaw = wy; P.pitch = seat ? R.lp : Math.asin(clamp(RV2.y, -1, 1)); P.vx = P.vz = P.vy = 0; P.ground = true;
  R.inside = Math.abs(lp.z) < .8 && lp.x > -1.25 && lp.x < .85;
}
// 史萊姆讓路：車前 6 m、左右 2.2 m 內的嚇一跳冒「!」（牠們本來就會往遠離 P 的方向逃）
function rideSlimes(cab) { const u = cab.userData; for (const s of W.slimes) { const dx = s.x - u.wx, dz = s.z - u.wz; if (dx * dx + dz * dz > 144) continue; const lx = dx * u.c - dz * u.s, lz = dx * u.s + dz * u.c; if (lx > 0 && lx < 7.95 && Math.abs(lz) < 2.2) { s.flee = Math.max(s.flee || 0, 1.2); if (!emoteOn(s)) emote(s, 'bang', .9); } } }
function rideNpcAhead() { const u = RIDE.cab.userData; if (!u.city || !W.npcs) return false; for (const n of W.npcs) { const dx = CITY.x + n.x - u.wx, dz = CITY.z + n.z - u.wz, lx = dx * u.c - dz * u.s, lz = dx * u.s + dz * u.c; if (lx > 1.5 && lx < 7.95 && Math.abs(lz) < 1.2) { RIDE.npcN++; return true; } } return false; }
// 出口亮光卡的顏色：那一頭的霧色目標（月光谷＝森林、城市＝海岸，各自套黃昏／夜晚），不讀正在漸變的 scene.fog
function tubeCardColor(zone) { return CARD_C.set(ZONE3D[zone].fog).lerp(DNC.duskFog, DN.dusk * .55).lerp(DNC.dawnFog, DN.dawn * .45).lerp(DNC.fog, DN.night * .9).multiplyScalar(1.4); }
// 隧道環境（rideStep 最後；envStep／caveEnv 已經先跑完，這裡寫的值會蓋過去）：圖層、球形霧、光、曝光、出口亮光卡
function rideEnv(dt) {
  const R = RIDE, cp = W.cam.position, now = performance.now(), T = TUBES[inCity(cp.x) ? 1 : 0], u = (cp.x - T.wx) * T.o.dx + (cp.z - T.wz) * T.o.dz, k = smooth(-4, 8, u), dest = R.li === 1, rm = RM();
  const cu = R.cab.userData, Tc = TUBES[cu.city ? 1 : 0], ue = (cu.wx - Tc.wx) * Tc.o.dx + (cu.wz - Tc.wz) * Tc.o.dz;
  if (!dest && R.ph === 'drive' && R.ue < 0 && ue >= 0) rideSnd.whoosh(); R.u = u; R.k = k; R.ue = ue; // 鑽進洞口：風切
  // 圖層：鏡頭進管子 6 m 之後只畫第 3 層（天空、文字精靈、粒子、地形、別的玩家一律不畫）；手上拿出來的筆記本也補上第 3 層
  W.cam.layers.mask = u > TAXI.DEEP ? 8 : 9; if ((R.lyN = (R.lyN || 0) + 1) % 6 === 0) W.cam.children.forEach(ch => ch.traverse(o => o.layers.enable(3)));
  const deep = u > TAXI.DEEP; if (deep === W.r.shadowMap.autoUpdate) { W.r.shadowMap.autoUpdate = !deep; if (!deep) W.r.shadowMap.needsUpdate = true; } // 深處不重畫陰影貼圖（不改 castShadow，材質不會重新編譯）
  const f = W.scene.fog;
  if (k > .001) {
    if (!R.f0) R.f0 = [f.near, f.far]; f.color.copy(ENVC[0]).lerp(TUN_FOG, k); W.scene.background.copy(f.color); f.near = R.f0[0] + (1.5 - R.f0[0]) * k; f.far = R.f0[1] + (14 - R.f0[1]) * k;
    W.sun.intensity *= 1 - k; W.hemi.color.lerp(TUN_HS, k); W.hemi.groundColor.lerp(TUN_HG, k); W.hemi.intensity += (.55 - W.hemi.intensity) * k;
    let pulse = .5; if (!rm && R.rate < 1.3) { pulse = 0; for (const lu of TAXI.LAMP) pulse += Math.exp(-(((u - lu) / 1.6) ** 2)); pulse = Math.min(1, pulse); } W.hemi.intensity *= 1 + .08 * (pulse - .5) * k; // 車內燈光輕掃 ±4%（減少動態、開快一點時不掃）
  } else if (R.f0) { f.near = R.f0[0]; R.f0 = null; applyQuality(); }
  CAB_M.body.envMapIntensity = 1 - .85 * k; // 車身的環境反射：隧道裡變暗（不換環境貼圖，避免重新編譯）
  if (k > .5 && !R.out) W.envT = now; // 深處不重新烘焙天空環境光：換邊前後車身反射的是同一張；出洞那一格再放行（曝光正在閃，看不出來）
  if (R.snap > 0 && --R.snap === 0) { W.sky.material.uniforms.bot.value.copy(ENVC[0]); W.sky.material.uniforms.top.value.copy(ENVC[1]); W.sun.color.copy(ENVC[2]); } // 換邊後天空直接換成這一頭的顏色（深處看不到天空）
  // 曝光：管子裡眼睛適應黑暗、快到出口越來越亮；衝出洞口那一格「豁然開朗」，之後交給 caveEnv 每格往 1 拉
  if (dest && !R.out && u < 0 && R.ph === 'drive') { R.out = true; CV.flash = rm ? .6 : 1; rideSnd.whoosh(); W.envT = now - 900; if (cu.city && !(S.seenZone && S.seenZone.city) && typeof caveReveal === 'function') { caveReveal('大城市', '穿過月光隧道，大街就在眼前'); (S.seenZone = S.seenZone || {}).city = true; } } // 天空環境光 0.6 秒後才重新烘焙（不擠在出洞那一格）
  if (k > .001 && !R.out) { const rem = dest ? ue : 2 * TAXI.U - ue; W.r.toneMappingExposure = 1 - .1 * k + .35 * smooth(14, 2, rem) * k; }
  for (const X of TUBES) { let a = 0; if (X === T) a = smooth(14, 5, u) * (1 - smooth(3.5, .8, u)); X.card.visible = a > .003; if (X.card.visible) { X.card.material.opacity = a; X.card.material.color.copy(tubeCardColor(X.zone)); } } // 出口亮光卡
  DRS.good = 0; // 隧道裡畫得少：不要趁機升解析度，出洞那一格會掉幀
}
function rideEnd() {
  const R = RIDE, st = R.stand, cab = R.cab, u = cab.userData; if (!R.on) return;
  R.on = false; R.ph = ''; document.body.classList.remove('riding'); document.body.classList.add('ride-done'); setTimeout(() => document.body.classList.remove('ride-done'), 450); rideUI(false); // HUD 0.3 秒淡回
  P.x = st.x; P.z = st.z; P.y = G(st.x, st.z); P.camY = P.y; P.eye = 1.62; P.vx = P.vz = P.vy = 0; P.yaw = st.yaw; P.pitch = -.05; P.roll = 0; P.dip = P.dipV = 0; P.ground = true; W.camAway = true;
  W.cam.layers.mask = 1; W.r.shadowMap.autoUpdate = true; W.r.shadowMap.needsUpdate = true; CAB_M.body.envMapIntensity = 1; TUBES.forEach(T => { T.card.visible = false; }); KEYS.clear(); R.hk.clear(); IN.hold = IN.holdE = false;
  if (R.f0) { W.scene.fog.near = R.f0[0]; R.f0 = null; applyQuality(); }
  rideSnd.stop(); S.rideN = (S.rideN || 0) + 1; u.st = 'stop'; u.next = 'close'; u.at = performance.now() + 50; save();
  R.tq.splice(0).forEach((m, i) => setTimeout(() => toast(m), 500 + i * 600)); // 搭車中排隊的訊息：下車後每 600 ms 補一則
}
// 搭車中回主選單、切換存檔：人放回安全的站位、兩台車回站位、霧光曝光圖層還原
function rideAbort() {
  const R = RIDE; if (!R.on) return; const sf = R.safe || { x: 0, z: 16, yaw: 0 };
  R.on = false; R.ph = ''; document.body.classList.remove('riding'); rideSnd.stop(); rideUI(false); [W.taxiV, W.taxiC].forEach(c => { if (c) cabPark(c); });
  P.x = sf.x; P.z = sf.z; P.yaw = sf.yaw; P.y = G(P.x, P.z); P.camY = P.y; P.vx = P.vz = 0; P.pitch = -.05; W.camAway = false; R.tq = [];
  W.cam.layers.mask = 1; if (R.f0) { W.scene.fog.near = R.f0[0]; R.f0 = null; applyQuality(); } W.r.toneMappingExposure = 1; W.r.shadowMap.autoUpdate = true; W.r.shadowMap.needsUpdate = true; CAB_M.body.envMapIntensity = 1; W.envT = 0; TUBES.forEach(T => { T.card.visible = false; });
  KEYS.clear(); R.hk.clear(); if (W.cam.fov !== W.fov0) { W.cam.fov = W.fov0; W.cam.updateProjectionMatrix(); }
}
// 觸控的 快轉圓鈕（按住開快一點）與桌機的提示字（前 3 趟）：建在 body，同 #introSkip 的作法（dom.html 不用改）
function rideUI(on) {
  let ff = document.getElementById('rideFF');
  if (!ff) {
    ff = document.createElement('button'); ff.id = 'rideFF'; ff.type = 'button'; ff.setAttribute('aria-label', '按住開快一點'); ff.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 6.5l8 5.5-8 5.5zM12 6.5l8 5.5-8 5.5z"/></svg>';
    ff.addEventListener('pointerdown', e => { e.preventDefault(); e.stopPropagation(); RIDE.ffT = performance.now(); }); ['pointerup', 'pointercancel', 'pointerleave'].forEach(k => ff.addEventListener(k, () => { RIDE.ffT = 0; })); ff.addEventListener('contextmenu', e => e.preventDefault());
    document.body.appendChild(ff); const h = document.createElement('div'); h.id = 'rideHint'; h.textContent = '按住 空白鍵：開快一點'; document.body.appendChild(h);
  }
  if (!on) { RIDE.ffT = 0; const h = document.getElementById('rideHint'); if (h) h.classList.remove('on'); }
}
function rideHint() { if (TOUCH || (S.rideN || 0) >= 3) return; const h = document.getElementById('rideHint'); if (!h) return; h.classList.add('on'); clearTimeout(h._t); h._t = setTimeout(() => h.classList.remove('on'), 4000); }
// 搭車的聲音：引擎（兩個鋸齒波＋低通）、路面（循環雜訊＋帶通，隧道裡悶一點、轟一點）常駐；開關門、坐下、方向燈、門鎖、進出洞口的風切是一次性的
const rideSnd = {
  n: null,
  start() { if (this.n || !S.sound) return; try { const ac = audio(), t = ac.currentTime, g = ac.createGain(), lp = ac.createBiquadFilter(), o1 = ac.createOscillator(), o2 = ac.createOscillator(), rs = ac.createBufferSource(), bp = ac.createBiquadFilter(), rl = ac.createBiquadFilter(), rg = ac.createGain();
    g.gain.value = 0; lp.type = 'lowpass'; lp.Q.value = .8; lp.frequency.value = 220; o1.type = o2.type = 'sawtooth'; o1.frequency.value = 46; o2.frequency.value = 72; o1.connect(lp); o2.connect(lp); lp.connect(g); g.connect(master);
    rs.buffer = NB; rs.loop = true; bp.type = 'bandpass'; bp.Q.value = .7; bp.frequency.value = 300; rl.type = 'lowpass'; rl.frequency.value = 8000; rg.gain.value = 0; rs.connect(bp); bp.connect(rl); rl.connect(rg); rg.connect(master);
    o1.start(t); o2.start(t); rs.start(t); this.n = { g, lp, o1, o2, rs, bp, rl, rg }; } catch (e) { this.n = null; } },
  step(v, k, gravel, fast) {
    const n = this.n; if (!n || !AC) return; const t = AC.currentTime, on = S.sound ? 1 : 0, f1 = (46 + 3.1 * v) * (fast ? 1.25 : 1), idle = v < .5 ? 1 + .2 * Math.sin(t * 56.5) : 1; // 怠速 9 Hz、20% 顫音
    n.o1.frequency.setTargetAtTime(f1, t, .05); n.o2.frequency.setTargetAtTime(f1 * 1.5 + 3, t, .05); n.lp.frequency.setTargetAtTime(220 + 18 * v, t, .05); n.g.gain.setTargetAtTime(on * (.014 + .0006 * v) * idle, t, .03);
    n.bp.frequency.setTargetAtTime((300 + 25 * v) * (gravel ? 1.2 : 1), t, .05); n.rl.frequency.setTargetAtTime(8000 - 6800 * k, t, .08); n.rg.gain.setTargetAtTime(on * (.003 + .001 * v) * (gravel ? 1.4 : 1) * (1 + .6 * k), t, .05);
  },
  stop() { const n = this.n; if (!n) return; this.n = null; try { const t = AC.currentTime; n.g.gain.setTargetAtTime(0, t, .2); n.rg.gain.setTargetAtTime(0, t, .2); setTimeout(() => { try { n.o1.stop(); n.o2.stop(); n.rs.stop(); n.g.disconnect(); n.rg.disconnect(); } catch (e) { } }, 900); } catch (e) { } },
  fx(f) { if (!S.sound || !AC || AC.state !== 'running') return; try { f(AC, AC.currentTime); } catch (e) { } },
  door(open) { this.fx((ac, t) => { if (open) { noise(ac, t, .025, 1800, 1.5, .05, 'bandpass'); sweep(900, 1300, t + .02, .12, .015, 'triangle'); } else { noise(ac, t, .09, 160, .8, .12, 'lowpass'); noise(ac, t, .03, 1400, 1, .04, 'bandpass'); } }); },
  seat(slide) { this.fx((ac, t) => { noise(ac, t, .12, 300, .8, .04, 'lowpass'); if (slide) { noise(ac, t + .05, .12, 1800, 1.2, .02, 'bandpass'); noise(ac, t + .25, .12, 1800, 1.2, .02, 'bandpass'); } }); },
  blink(n = 2) { this.fx((ac, t) => { for (let i = 0; i < n; i++) { tone(1900, t + i * .625, .012, .02, 'triangle'); tone(1400, t + i * .625 + .31, .012, .02, 'triangle'); } }); },
  lock() { this.fx((ac, t) => noise(ac, t, .03, 2400, 2, .04, 'bandpass')); },
  whoosh() { this.fx((ac, t) => { noise(ac, t, .7, 600, .8, .05, 'bandpass', .8); noise(ac, t + .1, .6, 1800, 1.2, .025, 'bandpass', 1.3); }); },
};
// 月光谷、山洞的「回到中央平地」：筆記本還擋在眼前的那一刻換位置（不跳 toast），模糊多留一下（下一輪改成穿越機式的低空滑翔）
function homeStamp() {
  closeGui(); const gm = $('#game'); if (!LOW) gm.classList.add('gblur');
  setTimeout(() => { P.x = 0; P.z = 16; P.yaw = 0; P.pitch = -.05; P.y = G(0, 16); P.camY = P.y; P.vx = P.vz = P.vy = 0; CV.scanNow = 1; W.camAway = false; }, HC.fade + 30);
  setTimeout(() => gm.classList.remove('gblur'), HC.fade + 280);
}
/* ---------- 商店 ---------- */
function renderShop(kind) { ui('shop'); } // 畫面改由 React 負責（components/stations/）
/* ---------- 手作台 ---------- */
const BN = { busy: false };
function renderBench() { if (!M.sp || !unlockedSpecies().some(s => s.id === M.sp)) M.sp = (unlockedSpecies().find(s => (S.gel[s.id] || 0) >= 2) || unlockedSpecies()[0]).id; ui('bench'); } // 畫面改由 React 負責（components/stations/）
function benchMake() {
  if (BN.busy) return; const sp = M.sp; if (!sp || (S.gel[sp] || 0) < 2) return toast('凝膠不足（需要 2 份）'); if (S.stock.length >= cap()) return toast('庫存已滿');
  S.gel[sp] -= 2; BN.busy = true; renderBench(); sfx.squish(1); [360, 760, 1150].forEach((ms, i) => setTimeout(() => { sfx.crunch(.75 + i * .2, .95); sfx.squish(.5, 1 + i * .08); }, ms)); const bar = $('#benchBar'); if (bar) { bar.style.transition = 'width 1.4s linear'; requestAnimationFrame(() => requestAnimationFrame(() => bar.style.width = '100%')); }
  setTimeout(() => { BN.busy = false; const p = makeProduct(sp, .15, true); S.stock.push(p); gainXP(3); sfx.pop(); toast(`做好了一個粗製${short(sp)}捏捏（售價 ¥10）`); saveCloud(); if (!S.tutDone) setTimeout(finishTutorial, 450); renderHotbar(true); renderQuest(); if (tab === 'bench') renderBench(); }, 1450);
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
function renderMapGame() { ui('mapg'); } // 畫面改由 React 負責（components/stations/）
/* ---------- 石碑面板（熔岩柱謎題） ---------- */
function renderRiddle() { ui('riddle'); } // 畫面改由 React 負責（components/stations/）
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
      if (!IN.joy && !RIDE.on && x < innerWidth * .45 && y > innerHeight * .4) { IN.joy = { id: t.identifier, x0: x, y0: y }; jb.style.left = (x - 60) + 'px'; jb.style.top = (y - 60) + 'px'; jb.classList.add('on'); } // 搭車中不建搖桿：整個畫面都是轉頭／按住開快一點
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
const VM = { g: null, key: '', swing: 0, sq: 0 };
/* 第一人稱的手：卡通風格的工坊師傅手（低多邊形）。四指＋拇指、手腕、工作服袖口
   5 種手勢：空手、托凝膠、握捏捏、伸手採集、用力擠壓；切換時約 0.1 秒過渡 */
const VM_POSE = {
  empty: { x: .01, y: -.03, z: .03, rx: -.2, ry: .25, rz: -.7, c: .42, t: .35, sp: .06 },
  gel: { x: 0, y: 0, z: 0, rx: .12, ry: .18, rz: -.12, c: 1.12, t: .85, sp: .02 },
  prod: { x: 0, y: .005, z: 0, rx: .14, ry: .18, rz: -.12, c: 1.25, t: .95, sp: 0 },
  reach: { x: -.03, y: .04, z: -.08, rx: -.62, ry: .3, rz: -.3, c: .1, t: .08, sp: .16 },
  squeeze: { x: -.035, y: .03, z: -.12, rx: -.5, ry: .3, rz: -.3, c: 1.32, t: 1.05, sp: 0 },
  hold: { x: 0, y: 0, z: 0, rx: .1, ry: .1, rz: -.1, c: .9, t: .7, sp: .02 }, // 托著筆記本、手機、手帳的下緣
  fan: { x: -.05, y: .06, z: -.03, rx: -.35, ry: .05, rz: -.25, c: .55, t: .55, sp: .12 }, // 舉著回話卡（talk.js）
  pay: { x: -.02, y: .03, z: -.06, rx: -.25, ry: .25, rz: -.2, c: .55, t: .5, sp: .06 }, // 掌心朝前、托著零錢包遞出硬幣（店裡結帳）
  coins: { x: -.03, y: .05, z: -.04, rx: .35, ry: .2, rz: -.15, c: .45, t: .4, sp: .08 }, // 掌心朝上攤開零錢包（錢不夠）
  offer: { x: -.05, y: .06, z: -.1, rx: -.9, ry: .35, rz: -.6, c: .3, t: .3, sp: .05 }, // 手腕往前讓店員戴吸取器
};
function initViewModel() {
  if (W.cam.parent !== W.scene) W.scene.add(W.cam);
  const g = VM.g = new THREE.Group(); W.cam.add(g);
  const lp = o => new THREE.MeshStandardMaterial(Object.assign({ flatShading: true, roughness: .7 }, o));
  const skin = lp({ color: '#f2c29b' }), skinD = lp({ color: '#e0a77e' }), sleeve = lp({ color: '#2f7f9e', roughness: .85 }), cuff = lp({ color: '#e9dcc0', roughness: .9 }), stitch = lp({ color: '#f59e0b' }), nail = lp({ color: '#fbe3d0', roughness: .4 });
  const arm = VM.arm = new THREE.Group(); arm.rotation.set(-.3, .3, .12); g.add(arm);
  // 前臂（工作服袖子）、袖口、手腕：沿著從手往畫面右下方延伸的方向
  const fd = new THREE.Vector3(.3, -.55, .78).normalize(), up = new THREE.Vector3(0, 1, 0);
  const along = (m, d) => { m.position.copy(fd).multiplyScalar(d); m.quaternion.setFromUnitVectors(up, fd); arm.add(m); return m; };
  along(new THREE.Mesh(new THREE.CylinderGeometry(.072, .085, .9, 7), sleeve), .62);
  along(new THREE.Mesh(new THREE.CylinderGeometry(.078, .078, .07, 7), cuff), .17);
  along(new THREE.Mesh(new THREE.CylinderGeometry(.08, .08, .012, 7), stitch), .145);
  along(new THREE.Mesh(new THREE.CylinderGeometry(.043, .05, .1, 7), skin), .1);
  // 手掌（以手腕為支點轉動）
  const hand = VM.hand = new THREE.Group(); hand.scale.setScalar(1.2); arm.add(hand);
  const palm = mesh(new THREE.BoxGeometry(.13, .045, .13), skin, 0, 0, -.035, hand); palm.scale.set(1, 1, 1);
  mesh(new THREE.BoxGeometry(.12, .04, .05), skinD, 0, -.004, .035, hand); // 掌根
  VM.palm = palm;
  // 手指：每根兩節，指尖有指甲；彎曲角度由手勢決定
  const F = [[.046, .043, .036, .9], [.016, .05, .041, 1], [-.016, .047, .038, .96], [-.045, .038, .031, .85]]; // 右手掌心朝上：拇指在右、小指在左
  VM.fingers = F.map(([x, l1, l2, r]) => {
    const k1 = new THREE.Group(); k1.position.set(x, .004, -.1); hand.add(k1);
    const s1 = mesh(new THREE.CapsuleGeometry(.0165 * r, l1, 2, 6), skin, 0, 0, -l1 / 2, k1); s1.rotation.x = Math.PI / 2;
    const k2 = new THREE.Group(); k2.position.z = -l1; k1.add(k2);
    const s2 = mesh(new THREE.CapsuleGeometry(.015 * r, l2, 2, 6), skin, 0, 0, -l2 / 2, k2); s2.rotation.x = Math.PI / 2;
    mesh(new THREE.BoxGeometry(.018 * r, .006, .016), nail, 0, -.013 * r, -l2 + .002, k2); // 指甲長在手背（掌心的另一面）
    return { k1, k2, x };
  });
  // 拇指：從掌側伸出，往掌心內收
  const tb = new THREE.Group(); tb.position.set(.068, -.002, -.02); tb.rotation.y = -.9; hand.add(tb);
  const tk = new THREE.Group(); tb.add(tk);
  mesh(new THREE.CapsuleGeometry(.02, .04, 2, 6), skin, 0, 0, -.025, tk).rotation.x = Math.PI / 2;
  const tk2 = new THREE.Group(); tk2.position.z = -.05; tk.add(tk2);
  mesh(new THREE.CapsuleGeometry(.017, .032, 2, 6), skin, 0, 0, -.018, tk2).rotation.x = Math.PI / 2;
  mesh(new THREE.BoxGeometry(.02, .006, .017), nail, 0, -.015, -.034, tk2);
  VM.thumb = { tk, tk2 };
  // 手上拿的東西放在掌心
  VM.hold = new THREE.Group(); VM.hold.position.set(0, .05, -.075); hand.add(VM.hold);
  VM.J = makeJelly(6, true); VM.J.ov.visible = false; VM.J.group.scale.setScalar(.05); VM.J.group.position.y = -.005; VM.hold.add(VM.J.group);
  VM.gel = mesh(new THREE.SphereGeometry(.05, 20, 14), new THREE.MeshPhysicalMaterial({ color: '#6ee7a8', roughness: .1, clearcoat: 1, transparent: true, opacity: .9 }), 0, 0, 0, VM.hold); VM.gel.scale.set(1, .72, 1);
  // 採集吸取器：裝在手腕上的小裝置，指示燈數量 = 等級
  const gad = VM.gad = new THREE.Group(); gad.position.copy(fd).multiplyScalar(.27).add(new THREE.Vector3(0, .075, 0)); gad.quaternion.setFromUnitVectors(up, fd); gad.scale.setScalar(.6); arm.add(gad);
  mesh(new THREE.BoxGeometry(.1, .06, .085), lp({ color: '#334155', metalness: .6, roughness: .35 }), 0, 0, 0, gad); mesh(new THREE.CylinderGeometry(.022, .03, .05, 8), lp({ color: '#94a3b8', metalness: .8 }), 0, .045, -.02, gad);
  VM.gadL = [0, 1, 2, 3].map(i => mesh(new THREE.BoxGeometry(.014, .012, .014), new THREE.MeshBasicMaterial({ color: '#22d3ee' }), -.03 + i * .02, .032, .03, gad));
  VM.p = Object.assign({}, VM_POSE.empty); VM.sq = 0; VM.holdK = 0;
  g.traverse(o => { if (o.isMesh) { o.castShadow = false; o.receiveShadow = false; o.frustumCulled = false; } });
  g.visible = false;
}
function heldKey() { const it = held(); return it ? (it.t === 'prod' ? 'p' : 'g') + SPECIES.indexOf(SP[it.t === 'prod' ? it.p.sp : it.sp]) : ''; }
function upgradeFx(dt) {
  // 跑鞋：奔跑時畫面邊緣出現速度線，等級越高越明顯
  const fast = S.up.boots > 0 && P.running && Math.hypot(P.vx, P.vz) > 5 && !GUI.kind, sl = $('#speedl'); if (sl) sl.style.opacity = fast ? (.12 + .07 * S.up.boots).toFixed(2) : '0';
  // 養殖槽裡的凝膠輕輕晃動
  if (W.musJ) W.musJ.forEach(J => { if (J.group.visible) J.group.rotation.y += dt * .5; });
  // 展示中的作品持續吸引參觀者：越酥脆越多
  if (S.show.length) S.fans += dt * S.show.reduce((a, p) => a + effCrisp(p), 0) * .004;
  if (W.upG) W.upG.children.forEach(o => { if (o.userData.bob != null) o.scale.y = 1 + Math.sin(W.t * 1.6 + o.userData.bob) * .06; });
}
// 手指、拇指、手腕依手勢參數擺好
function vmPose(p) {
  VM.fingers.forEach((f, i) => { const c = p.c * (1 + (i - 1.5) * .05); f.k1.rotation.x = c * .95; f.k2.rotation.x = c * 1.15; f.k1.rotation.y = (f.x * 8) * p.sp; });
  VM.thumb.tk.rotation.x = p.t * .5; VM.thumb.tk.rotation.y = p.t * .55; VM.thumb.tk2.rotation.x = p.t * .9;
  VM.arm.position.set(p.x, p.y, p.z); VM.hand.rotation.set(p.rx, p.ry, p.rz);
}
/* ---------- 手持道具：Esc 的筆記本、直播的手機、背包的手帳（GX 的 held 模式） ----------
   以 2D 介面的像素為單位建模、整組再縮放成公尺：停在眼前時投影剛好和 2D 介面（#gwin）重合，2D 才淡入接手。
   面向鏡頭的那一面用不受光的材質畫成和 2D 一樣的顏色（拿到眼前的過程中從環境亮度漸漸亮到原色），交接時看不出接縫。 */
const hv1 = new THREE.Vector3(), hv2 = new THREE.Vector3();
const NBP = { head: 70, line0: 99, gap: 28, margin: 52 }; // 筆記本內頁：頁首線、第一條橫線、行距、紅色邊線（窄螢幕 30）；和 stations.css 的筆記本 .gwin 對齊
function rrShape(w, h, r) { const s = new THREE.Shape(), x = -w / 2, y = -h / 2; s.moveTo(x + r, y); s.lineTo(x + w - r, y); s.quadraticCurveTo(x + w, y, x + w, y + r); s.lineTo(x + w, y + h - r); s.quadraticCurveTo(x + w, y + h, x + w - r, y + h); s.lineTo(x + r, y + h); s.quadraticCurveTo(x, y + h, x, y + h - r); s.lineTo(x, y + r); s.quadraticCurveTo(x, y, x + r, y); return s; }
function heldModel(kind, R) {
  const w = Math.round(R.w), h = Math.round(R.h), two = kind === 'inv' && innerWidth > 760, key = kind + w + 'x' + h + (two ? 'd' : '');
  if (VM.pm && VM.pm.key === key) return VM.pm;
  if (!VM.prop) { VM.prop = new THREE.Group(); W.cam.add(VM.prop); }
  if (VM.pm) { VM.prop.remove(VM.pm.root); VM.pm.root.traverse(o => { if (o.isMesh) { o.geometry.dispose(); [].concat(o.material).forEach(m => { if (m.map) m.map.dispose(); m.dispose(); }); } }); }
  const root = new THREE.Group(), lit = [], fade = [], mx = LOW ? 760 : 1150;
  // 用 2D 介面的像素座標畫貼圖（畫布依解析度上限縮放）
  const tex = (draw, cw = w, ch = h) => { const f = Math.min(1.5, mx / Math.max(cw, ch)); return artTex(Math.round(cw * f), Math.round(ch * f), g => { g.save(); g.scale(f, f); draw(g, cw, ch); g.restore(); }); };
  const face = (map, o) => { const m = new THREE.MeshBasicMaterial(Object.assign({ map, fog: false, toneMapped: false }, o)); lit.push(m); return m; };
  const mat = (c, o) => new THREE.MeshStandardMaterial(Object.assign({ color: c, roughness: .8, fog: false }, o));
  const rr = (g, x, y, ww, hh, r) => { g.beginPath(); if (g.roundRect) g.roundRect(x, y, ww, hh, r); else g.rect(x, y, ww, hh); };
  const pm = { key, kind, root, D: .42, grip: [w * .3, -h / 2 - 4, 8], hs: 1.5, open: () => { } };
  if (kind === 'pause') {
    // 筆記本：上方線圈，青綠色封面往上翻開；內頁的橫線、紅色邊線和 app/stations.css 的 .gwin 一致
    const page = tex((g, w, h) => {
      g.fillStyle = '#fffdf6'; g.fillRect(0, 0, w, h);
      g.fillStyle = 'rgba(122,160,204,.3)'; for (let y = NBP.line0; y < h - 6; y += NBP.gap) g.fillRect(0, y, w, 1);
      g.fillStyle = 'rgba(239,68,68,.32)'; g.fillRect(innerWidth <= 600 ? 30 : NBP.margin, 0, 2, h); g.fillStyle = 'rgba(239,68,68,.2)'; g.fillRect(0, NBP.head, w, 2);
    });
    const cover = tex((g, w, h) => {
      const gr = g.createLinearGradient(0, 0, w, h); gr.addColorStop(0, '#2f8f8f'); gr.addColorStop(1, '#1d6670'); g.fillStyle = gr; g.fillRect(0, 0, w, h);
      g.globalAlpha = .07; g.fillStyle = '#fff'; for (let i = 0; i < 120; i++) g.fillRect((i * 137) % w, (i * 71) % h, 1 + i % 2, 30 + (i % 7) * 14); g.globalAlpha = 1;
      const lw = Math.min(w * .6, 400), lh = Math.min(h * .28, 150), lx = (w - lw) / 2, ly = h * .28;
      g.fillStyle = '#fffaf0'; rr(g, lx, ly, lw, lh, 14); g.fill(); g.strokeStyle = '#d6c49b'; g.lineWidth = 3; g.stroke();
      g.fillStyle = '#e8b4a0'; g.fillRect(lx + 22, ly + lh * .66, lw - 44, 2);
      g.fillStyle = '#2b2118'; g.font = `700 ${Math.round(lh * .34)}px ${ART_FONT}`; g.fillText('史萊姆工坊', w / 2, ly + lh * .55);
      g.fillStyle = '#7b6a52'; g.font = `700 ${Math.round(lh * .16)}px ${ART_FONT}`; g.fillText('月光谷', w / 2, ly + lh * .88);
      const r = Math.min(w, h) * .085, cx = w - r * 2.4, cy = h - r * 2.2; // 史萊姆貼紙
      g.fillStyle = '#fff'; g.beginPath(); g.ellipse(cx, cy, r * 1.25, r * 1.12, 0, 0, PI2); g.fill();
      g.fillStyle = '#6ee7b7'; g.beginPath(); g.ellipse(cx, cy + r * .08, r, r * .86, 0, 0, PI2); g.fill();
      g.fillStyle = '#1f2937'; [-1, 1].forEach(sd => { g.beginPath(); g.ellipse(cx + sd * r * .32, cy - r * .02, r * .1, r * .14, 0, 0, PI2); g.fill(); });
      g.strokeStyle = '#1f2937'; g.lineWidth = r * .07; g.beginPath(); g.arc(cx, cy + r * .18, r * .2, .2, Math.PI - .2); g.stroke();
      g.save(); g.translate(w * .16, h * .09); g.rotate(-.32); g.fillStyle = 'rgba(251,191,36,.78)'; g.fillRect(-70, -15, 140, 30); g.restore(); // 紙膠帶
    });
    const edge = mat('#efe6cf'), cm = [mat('#1d6670'), face(cover, { transparent: true }), mat('#e9dfc6', { transparent: true })];
    mesh(new THREE.BoxGeometry(w, h, 14), [edge, edge, edge, edge, face(page), mat('#c9b48a')], 0, 0, -7, root);
    const ring = new THREE.TorusGeometry(8, 1.9, 6, 18), rm = new THREE.MeshBasicMaterial({ color: '#9aa3b2', fog: false, toneMapped: false }); // 線圈和 2D 的 .st-rings 同色
    for (let i = 0; i < 12; i++) { const m = mesh(ring, rm, -w / 2 + 26.5 + i * (w - 53) / 11, h / 2 + 1, -5, root); m.rotation.y = Math.PI / 2; m.scale.set(1, 1.4, 1); }
    const pv = new THREE.Group(); pv.position.set(0, h / 2 + 3, 3); root.add(pv);
    mesh(new THREE.BoxGeometry(w + 6, h + 6, 3), [cm[0], cm[0], cm[0], cm[0], cm[1], cm[2]], 0, -(h + 6) / 2, -1.5, pv);
    fade.push(cm[1], cm[2]); cm[0].transparent = true; fade.push(cm[0]);
    pm.open = o => { pv.rotation.x = -o * Math.PI * 1.02; const a = 1 - smooth(.42, .78, o); fade.forEach(m => m.opacity = a); pv.visible = a > .01; }; // 封面翻過頭頂就淡掉
  } else if (kind === 'live') {
    // 手機：黑色邊框＋金屬側框（同 2D 的 border 與 box-shadow），螢幕亮起時是直播 app 的啟動畫面
    pm.D = .4; pm.grip = [w * .2, -h / 2 - 6, 8]; pm.hs = 2;
    const body = new THREE.Mesh(new THREE.ExtrudeGeometry(rrShape(w + 8, h + 8, 52), { depth: 16, bevelEnabled: false, curveSegments: 8 }), [mat('#0a0c10', { roughness: .4, metalness: .2 }), mat('#3b404c', { metalness: .75, roughness: .3 })]);
    body.position.z = -16; root.add(body);
    const sw = w - 22, sh = h - 22, sg = new THREE.ShapeGeometry(rrShape(sw, sh, 37), 8), uv = sg.attributes.uv, ps = sg.attributes.position;
    for (let i = 0; i < uv.count; i++) uv.setXY(i, (ps.getX(i) + sw / 2) / sw, (ps.getY(i) + sh / 2) / sh);
    const scr = new THREE.MeshBasicMaterial({ fog: false, toneMapped: false, map: tex((g, w, h) => {
      g.fillStyle = '#0c1018'; g.fillRect(0, 0, w, h);
      g.fillStyle = '#f1f5f9'; g.font = '700 13.5px Inter,system-ui,sans-serif'; g.textAlign = 'left'; const d = new Date(); g.fillText(`${d.getHours()}:${String(d.getMinutes()).padStart(2, '0')}`, 24, 29);
      g.fillStyle = '#000'; rr(g, w / 2 - 54, 8, 108, 30, 15); g.fill();
      g.fillStyle = '#e2e8f0'; [4, 6, 8, 11].forEach((hh, i) => g.fillRect(w - 66 + i * 5, 30 - hh, 3, hh)); g.strokeStyle = '#e2e8f0'; g.lineWidth = 1.5; g.strokeRect(w - 44, 19.5, 22, 10); g.fillRect(w - 42, 21.5, 13, 6);
      const cx = w / 2, cy = h * .42, r = Math.min(w, h) * .13, gr = g.createLinearGradient(cx - r, cy - r, cx + r, cy + r); gr.addColorStop(0, '#f472b6'); gr.addColorStop(1, '#fbbf24');
      g.fillStyle = gr; g.beginPath(); g.arc(cx, cy, r, 0, PI2); g.fill(); g.fillStyle = '#fff'; g.beginPath(); g.moveTo(cx - r * .28, cy - r * .4); g.lineTo(cx + r * .45, cy); g.lineTo(cx - r * .28, cy + r * .4); g.fill();
      g.textAlign = 'center'; g.fillStyle = '#f8fafc'; g.font = `900 ${Math.round(r * .42)}px Inter,system-ui,sans-serif`; g.fillText('SQUISH LIVE', cx, cy + r * 1.75);
    }, sw, sh) });
    mesh(sg, scr, 0, 0, .6, root);
    const bm = mat('#2d323c', { metalness: .6, roughness: .4 });
    [[-1, 120, 34], [-1, 170, 58], [1, 150, 80]].forEach(([sd, t, l]) => mesh(new THREE.BoxGeometry(5, l, 8), bm, sd * (w / 2 + 6), h / 2 - t - l / 2, -8, root));
    pm.open = o => scr.color.setScalar(o * o); // 螢幕亮起
  } else {
    // 工坊手帳：皮革書皮的書本，封面繞書脊往左翻開，內側就是左頁（手機直向只有一頁，封面翻到畫面外）
    pm.D = .44; const pw = two ? w / 2 : w, sp = two ? 0 : -w / 2; pm.grip = [sp + pw * .62, -h / 2 - 14, 8]; pm.hs = 1.45;
    // 紙：和 2D 手帳的 .gwin 一樣的徑向漸層，兩頁時中間有書脊陰影；皮革邊：同 2D 的 box-shadow（#6b3f22 9px＋深色細邊）
    const spread = g => {
      g.save(); g.translate(w * .3, h * .15); g.scale(w * 1.2, h * .9); const gr = g.createRadialGradient(0, 0, 0, 0, 0, 1); gr.addColorStop(0, '#fffcf2'); gr.addColorStop(.65, '#f5ead0'); gr.addColorStop(1, '#ead9b3'); g.fillStyle = gr; g.fillRect(-1, -1, 2, 2); g.restore();
      if (two) { const s = g.createLinearGradient(w / 2 - 34, 0, w / 2 + 34, 0); s.addColorStop(0, 'rgba(92,61,26,0)'); s.addColorStop(.35, 'rgba(92,61,26,.08)'); s.addColorStop(.5, 'rgba(92,61,26,.25)'); s.addColorStop(.65, 'rgba(92,61,26,.08)'); s.addColorStop(1, 'rgba(92,61,26,0)'); g.fillStyle = s; g.fillRect(w / 2 - 34, 0, 68, h); }
    };
    const hide = (g, W2, H2) => { g.fillStyle = '#6b3f22'; g.fillRect(0, 0, W2, H2); g.strokeStyle = '#3a1f0e'; g.lineWidth = 4; g.strokeRect(2, 2, W2 - 4, H2 - 4); };
    const cov = tex((g, w, h) => {
      g.save(); g.translate(w * .4, h * .3); g.scale(w * .9, h * .7); const gr = g.createRadialGradient(0, 0, 0, 0, 0, 1.25); gr.addColorStop(0, '#8a5530'); gr.addColorStop(.56, '#5e361b'); gr.addColorStop(1, '#43240f'); g.fillStyle = gr; g.fillRect(-2, -2, 4, 4); g.restore();
      g.strokeStyle = 'rgba(214,167,100,.35)'; g.lineWidth = 1.5; g.strokeRect(7, 7, w - 14, h - 14);
      g.fillStyle = '#e8c58a'; g.font = '800 26px "Noto Serif TC","Songti TC",serif'; if ('letterSpacing' in g) g.letterSpacing = '8px'; g.shadowColor = 'rgba(0,0,0,.6)'; g.shadowOffsetY = 1; g.fillText('工坊手帳', w / 2 + 4, h / 2 + 9);
    }, pw + 12, h + 24);
    // 封面內側＝左頁（外緣與上下留皮革邊）；右頁＝書本身；封底在右頁後面、四邊多出 12px 皮革
    const innerT = tex((g, W2, H2) => { hide(g, W2, H2); g.save(); g.beginPath(); g.rect(12, 12, pw, h); g.clip(); g.translate(12, 12); spread(g); g.restore(); }, pw + 12, h + 24);
    const pageT = tex(g => { g.translate(two ? -pw : 0, 0); spread(g); }, pw, h), backT = tex(hide, pw + 12, h + 24);
    const leather = mat('#5e361b', { roughness: .7 }), edge = mat('#efe2c2'), inner = face(innerT, { transparent: !two }), outer = face(cov, { transparent: !two }), lth = two ? leather : mat('#5e361b', { roughness: .7, transparent: true });
    mesh(new THREE.BoxGeometry(pw, h, 16), [edge, edge, edge, edge, face(pageT), leather], sp + pw / 2, 0, -8, root);
    mesh(new THREE.BoxGeometry(pw + 12, h + 24, 4), [leather, leather, leather, leather, face(backT), leather], sp + pw / 2 + 6, 0, -3, root); // 封底（貼近頁面，透視縮小才不會吃掉皮革邊）
    mesh(new THREE.BoxGeometry(14, 52, 1), new THREE.MeshBasicMaterial({ color: '#b91c1c', fog: false, toneMapped: false }), sp + 53, -h / 2 - 32, -21, root); // 書籤緞帶（同 2D 的 .st-ribbon）
    const pv = new THREE.Group(); pv.position.x = sp; root.add(pv);
    mesh(new THREE.BoxGeometry(pw + 12, h + 24, 4), [lth, lth, lth, lth, outer, inner], pw / 2 + 6, 0, 0, pv);
    pm.open = o => { pv.rotation.y = -o * Math.PI; pv.position.z = 2 - 4 * o; if (!two) { const a = 1 - smooth(.6, .95, o); [inner, outer, lth].forEach(m => m.opacity = a); pv.visible = a > .01; } };
  }
  root.traverse(o => { if (o.isMesh) { o.frustumCulled = false; o.castShadow = o.receiveShadow = false; } });
  VM.prop.add(root); const op = pm.open;
  pm.open = (o, s) => { op(o); const a = 1 - .45 * (DN.night || 0), c = a + (1 - a) * s; lit.forEach(m => m.color.setScalar(c)); };
  return VM.pm = pm;
}
function heldStep(dt) {
  if (GX.mode !== 'held' || TITLE.on || !GX.R || !HELD[GX.kind]) { if (VM.prop) VM.prop.visible = false; return false; }
  const e = gxE(), op = GX.dir > 0, R = GX.R, cam = W.cam, pm = heldModel(GX.kind, R);
  // o＝封面翻開／螢幕亮起、hk＝手托著道具（0＝放到畫面外）
  let s, z, o, hk, vis; // s＝畫面上的位置（1＝介面的位置）、z＝距離（1＝停在眼前）
  if (op) { const t = clamp(e / HT.raise, 0, 1); s = out3(t); z = ease3(t); o = ease3(clamp((e - HT.open0) / (HT.open1 - HT.open0), 0, 1)); vis = e < HT.done + 30; hk = 1 - ease3(clamp((e - HT.done) / (HT.end - HT.done), 0, 1)); }
  else { const u = clamp((e - HC.down0) / (HC.end - HC.down0), 0, 1), c = GX.c0 || [1, 1, 1, 0]; s = c[0] * (1 - in3(u)); z = c[1] * (1 - out3(u)); o = c[2] * (1 - ease3(clamp((e - HC.close0) / (HC.close1 - HC.close0), 0, 1))); vis = e < HC.end; hk = c[3] ? 1 : ease3(clamp(e / HC.up, 0, 1)); }
  if (op) GX.last = [s, z, o]; VM.prop.visible = vis;
  // 最後的位置：平面正對鏡頭、離眼睛 D 公尺，投影剛好是介面矩形 R。
  // 起點：遠一點、在畫面右下方、斜躺在手上（看得到手拿著它）；先舉到畫面中間，再拉近到眼前
  const th = Math.tan(cam.fov * Math.PI / 360), vw = innerWidth, vh = innerHeight, D = pm.D, k = 2 * D * th / vh, hh = D * th, hw = hh * cam.aspect;
  const r = 1 - s, d = D * (2.1 - 1.1 * z); // 拿起時畫面上的位置先到、距離後到；收起時先拉遠再放下
  const nx = .42 + ((R.x + R.w / 2) / vw * 2 - 1 - .42) * s, ny = -.62 + (1 - (R.y + R.h / 2) / vh * 2 + .62) * s;
  pm.root.scale.setScalar(k); pm.root.position.set(nx * d * th * cam.aspect, ny * d * th + Math.sin(s * Math.PI) * hh * .06, -d);
  pm.root.rotation.set(-.95 * r, -.5 * r, .22 * r);
  pm.open(o, z);
  VM.g.visible = hk > .01; if (!VM.g.visible) return true;
  propGrip(pm.root, pm.grip, k, pm.hs, R.h, hk, hh, dt);
  return true;
}
// 手：托住道具的下緣（跟道具一起轉），每一格反算手臂的位置讓手掌剛好在握點上（grip＝道具上的像素座標、k＝每像素幾公尺）；hk＝0 時往下放到畫面外。
// 手持道具（heldStep）與店裡拿起來看的吊牌卡（wareStep）共用
function propGrip(root, grip, k, hs, Rh, hk, hh, dt) {
  const T = VM_POSE.hold, kk = 1 - Math.exp(-dt * 24); for (const n in T) VM.p[n] += (T[n] - VM.p[n]) * kk; vmPose(VM.p);
  VM.holdK = 0; VM.hold.scale.setScalar(.001); VM.J.group.visible = VM.gel.visible = false; VM.key = '';
  VM.g.scale.setScalar(clamp(Rh * k * hs, .3, 1.1)); VM.g.quaternion.copy(root.quaternion); VM.g.position.set(0, 0, 0);
  VM.g.updateMatrix(); VM.arm.updateMatrix(); VM.hand.updateMatrix(); VM.palm.updateMatrix();
  hv1.set(0, 0, 0).applyMatrix4(VM.palm.matrix).applyMatrix4(VM.hand.matrix).applyMatrix4(VM.arm.matrix).applyMatrix4(VM.g.matrix);
  hv2.set(...grip).multiplyScalar(k).applyQuaternion(root.quaternion).add(root.position);
  VM.g.position.copy(hv2).sub(hv1); VM.g.position.y -= (1 - hk) * hh * 1.3;
}
/* ---------- 在店裡買東西：拿起來看 → 帶到櫃台 → 結帳（WARE） ----------
   手上的吊牌卡跟 heldModel 一樣以像素為單位建模：停好時投影剛好是 WARE.R（wareRect），字畫在卡片上（不交給 DOM、沒有按鈕）；
   鏡頭永遠是玩家自己的眼睛（W.camAway 一直是 false）、GUI.kind 一直是 null，世界照常全速在動，拿著可以走、可以轉頭。
   飛行的起點／終點是世界座標（吊牌、結帳墊）時，每格換到鏡頭座標再內插：玩家轉頭時，東西還是從架上飛出來 */
const WT = { take: 380, ready: 450, back: 300, put: 320, purse: 200, coin0: 300, gap: 60, fly: 220, charge: 520, ring: 600, shrink: 640, stamp: 880, give: 1120, launch: 1240, say: 1300, pocket: 1420, end: 1760, poor: 1500, refuse: 650 };
const WARE = { h: null, R: null, g: null, fz: null, pose: '', gadN: null, mode: '' };
const wareE = () => WARE.fz != null ? WARE.fz : performance.now() - WARE.h.t0; // 測試時設 WARE.fz 把畫面停在某一刻（同 GX.fz）
const wv1 = new THREE.Vector3(), wv2 = new THREE.Vector3(), wq1 = new THREE.Quaternion(), wq2 = new THREE.Quaternion(), WQ_FLAT = new THREE.Quaternion().setFromEuler(new THREE.Euler(-Math.PI / 2, 0, 0));
const wE = new THREE.Euler(); // 每格重用（拿著商品時不產生垃圾）
const wPose = () => ({ p: new THREE.Vector3(), q: new THREE.Quaternion(), s: 1 });
function wareInit() {
  if (WARE.g) return; const g = WARE.g = new THREE.Group(); W.cam.add(g); g.visible = false;
  WARE.root = new THREE.Group(); g.add(WARE.root);
  WARE.cmat = new THREE.MeshBasicMaterial({ toneMapped: false, fog: false, transparent: true, depthTest: false, depthWrite: false }); // 貼牆走也不會被牆吃掉
  WARE.card = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), WARE.cmat); WARE.card.renderOrder = 20; WARE.root.add(WARE.card);
  WARE.mmat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: .55, metalness: .05, fog: false, transparent: true });
  WARE.mini = new THREE.Mesh(new THREE.BufferGeometry(), WARE.mmat); WARE.mini.renderOrder = 21; g.add(WARE.mini);
  WARE.bag = new THREE.Mesh(mergeParts([[new THREE.BoxGeometry(1, .82, .82), '#c8a878'], [new THREE.BoxGeometry(1.02, .12, .84), '#dc2626'], [new THREE.BoxGeometry(.12, .84, .84), '#dc2626'], [new THREE.TorusGeometry(.13, .045, 4, 10), '#dc2626', M4(-.1, .48, 0, 0, 0, .5)], [new THREE.TorusGeometry(.13, .045, 4, 10), '#dc2626', M4(.1, .48, 0, 0, 0, -.5)]]), WARE.mmat);
  WARE.bag.renderOrder = 22; g.add(WARE.bag); WARE.bag.visible = false;
  g.traverse(o => { if (o.isMesh) { o.frustumCulled = false; o.castShadow = o.receiveShadow = false; } });
  // 硬幣（金、銀）：世界座標，跳進收銀台的托盤
  const cg = new THREE.CylinderGeometry(.028, .028, .008, LOW ? 10 : 16); WARE.coins = new THREE.InstancedMesh(cg, new THREE.MeshStandardMaterial({ roughness: .3, metalness: .7 }), 6); WARE.coins.frustumCulled = false; WARE.coins.visible = false; WARE.coins.count = 6;
  for (let i = 0; i < 6; i++) WARE.coins.setColorAt(i, new THREE.Color(i % 3 === 1 ? '#cbd5e1' : '#fbbf24')); W.scene.add(WARE.coins);
}
// 史萊姆零錢包：壓扁的綠色二十面體、兩顆黑眼睛、拉鍊畫成笑臉（一個網格，平常縮到看不見）
function purseInit() {
  if (VM.purse) return;
  const geo = mergeParts([[new THREE.IcosahedronGeometry(.06, 1), '#4ade80', M4(0, 0, 0, 0, 0, 0, 1.15, .72, .95)], [new THREE.SphereGeometry(.009, 6, 4), '#111827', M4(-.02, .016, .052)], [new THREE.SphereGeometry(.009, 6, 4), '#111827', M4(.02, .016, .052)], [new THREE.TorusGeometry(.024, .005, 4, 10, Math.PI), '#166534', M4(0, -.004, .054, 0, 0, Math.PI)], [new THREE.BoxGeometry(.012, .016, .01), '#fbbf24', M4(.03, -.012, .05)]]);
  VM.purse = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: .35, flatShading: true })); VM.purse.position.set(0, .07, -.08); VM.purse.scale.setScalar(.001); VM.purse.castShadow = false; VM.purse.frustumCulled = false; VM.hand.add(VM.purse);
}
/* 卡片在畫面上的矩形（CSS px）：桌機＝準心右側（再不行左側）；觸控直向＝準心上方（再不行下方）；觸控橫向＝左上（再不行正上方）。
   避開 HUD（各外擴 8 px），全部撞到就縮成 .85 再試，最小寬 260 */
function wareRect() {
  const vw = innerWidth, vh = innerHeight, port = vh > vw, w0 = port ? Math.min(vw - 32, 420) : clamp(.3 * vw, 320, 440);
  const obs = ['#compass', '#topbtns', '#stats', '#bottom', '#log', '#btnAct', '#btnJump', '#btnRun', '#btnSneak', '#warm'].map(s => $(s)).filter(e => e && e.offsetParent !== null).map(e => { const r = e.getBoundingClientRect(); return { x: r.left - 8, y: r.top - 8, w: r.width + 16, h: r.height + 16 }; }).filter(r => r.w > 16 && r.h > 16);
  const lg = $('#log'); if (lg) { const r = lg.getBoundingClientRect(); if (r.width) obs.push({ x: r.left - 8, y: r.top - 8, w: r.width + 16, h: Math.max(r.height, 90) + 16 }); } // 訊息列平常是空的：預留兩則的高度
  let top = 44; ['#stats', '#compass', '#cmpDeg', '#topbtns'].forEach(q => { const e = $(q); if (e && e.offsetParent !== null) { const r = e.getBoundingClientRect(); if (r.height && r.bottom < vh * .4) top = Math.max(top, r.bottom + 10); } }); // 觸控：卡片放在上排 HUD 的下面
  const hit = (x, y, w, h) => x < 8 || y < 8 || x + w > vw - 8 || y + h > vh - 8 || obs.some(o => x < o.x + o.w && x + w > o.x && y < o.y + o.h && y + h > o.y);
  let last = null;
  for (let sc = 1; ; sc *= .85) {
    const w = Math.max(260, Math.round(w0 * sc)), h = Math.round(w * .62);
    const C = TOUCH ? (port ? [[(vw - w) / 2, Math.max(top, vh / 2 - h - 64)], [(vw - w) / 2, vh / 2 + 64]] : [[12, top], [(vw - w) / 2, top], [vw - w - 12, top]]) : [[vw / 2 + 150, vh / 2 - h * .4], [vw / 2 - 150 - w, vh / 2 - h * .4], [vw / 2 + 60, vh / 2 - h - 40]];
    for (const [x, y] of C) { const r = { x: Math.round(x), y: Math.round(y), w, h }; if (!hit(r.x, r.y, w, h)) return r; if (!last) last = r; }
    if (w <= 260) { const [x, y] = C[0]; return { x: Math.round(x), y: Math.round(y), w, h }; }
  }
}
// 卡片停好的位置（鏡頭座標）：平面正對鏡頭、離眼睛 D 公尺，投影剛好是矩形 R；s＝每像素幾公尺
function wRead(R, out, D = .42) {
  const cam = W.cam, th = Math.tan(cam.fov * Math.PI / 360), vw = innerWidth, vh = innerHeight, nx = (R.x + R.w / 2) / vw * 2 - 1, ny = 1 - (R.y + R.h / 2) / vh * 2;
  out.p.set(nx * D * th * cam.aspect, ny * D * th, -D); out.q.identity(); out.s = 2 * D * th / vh; return out;
}
// 世界裡的一個姿勢（吊牌、結帳墊）換到鏡頭座標；sw＝在世界裡的寬度（公尺）
function wWorld(p, q, sw, R, out) { out.p.copy(p); W.cam.worldToLocal(out.p); out.q.copy(W.cam.quaternion).invert().multiply(q); out.s = sw / R.w; return out; }
function wLerp(a, b, up, uq, us, out) { out.p.lerpVectors(a.p, b.p, up); out.q.slerpQuaternions(a.q, b.q, uq); out.s = a.s + (b.s - a.s) * us; return out; }
function wCopy(a, out) { out.p.copy(a.p); out.q.copy(a.q); out.s = a.s; return out; }
// 縮小模型在卡片上的位置：左 36% 那一格（卡片的像素座標），慢慢轉
function wMiniOn(c, R, spin, out) { out.p.set(-R.w / 2 + R.w * .18, -R.h * .04, 0).multiplyScalar(c.s).applyQuaternion(c.q).add(c.p); const f = Math.max(.5, 1 - 40 * c.s / Math.max(.05, -out.p.z)); out.p.multiplyScalar(f); out.q.copy(c.q).multiply(wq1.setFromEuler(wE.set(.32, spin, 0))); out.s = R.h * .52 * c.s * f; return out; } // 往鏡頭拉近一點（沿著視線，畫面上的位置不變）
const WP = { a: wPose(), b: wPose(), c: wPose(), m: wPose(), n: wPose(), t: wPose() };
/* ---------- 吊牌卡的畫布：名稱、價格、等級、兩行短說明、去向；結帳後重畫成送貨單 ---------- */
function wareCard(h, mode) {
  const R = WARE.R, f = Math.min(LOW ? 1.5 : 2, devicePixelRatio || 1), cw = Math.round(R.w * f), ch = Math.round(R.h * f);
  if (!WARE.cv || Math.abs(WARE.cv.width - cw) > cw * .1 || Math.abs(WARE.cv.height - ch) > ch * .1) { if (WARE.tx) WARE.tx.dispose(); WARE.cv = document.createElement('canvas'); WARE.cv.width = cw; WARE.cv.height = ch; WARE.tx = new THREE.CanvasTexture(WARE.cv); WARE.tx.colorSpace = THREE.SRGBColorSpace; WARE.tx.anisotropy = 4; WARE.cmat.map = WARE.tx; WARE.cmat.needsUpdate = true; }
  const cv = WARE.cv, g = cv.getContext('2d'), w = R.w, H = R.h, st = h.st; g.setTransform(cv.width / w, 0, 0, cv.height / H, 0, 0); g.clearRect(0, 0, w, H); g.textAlign = 'left'; g.textBaseline = 'alphabetic';
  const x0 = w * .38, mw = w * .58, F = (wt, px, fam) => wt + ' ' + Math.round(px) + 'px ' + (fam || ART_FONT), hand = '"Slime Hand",' + ART_FONT;
  if (mode === 'slip') { // 送貨單：淺綠格線、已付款章、三顆氣球
    g.fillStyle = '#ecfdf5'; rrect(g, 3, 3, w - 6, H - 6, 12); g.fill(); g.strokeStyle = '#86efac'; g.lineWidth = 1; for (let y = H * .3; y < H - 8; y += H * .12) { g.beginPath(); g.moveTo(12, y); g.lineTo(w - 12, y); g.stroke(); } g.strokeStyle = '#16a34a'; g.lineWidth = 3; rrect(g, 3, 3, w - 6, H - 6, 12); g.stroke();
    g.fillStyle = '#14532d'; g.font = F('700', Math.max(22, H * .13)); g.fillText('送貨單', 20, H * .22, w * .5);
    g.font = F('400', Math.max(16, H * .08), hand); g.fillStyle = '#166534'; g.fillText('月光谷・' + (S.name || '你') + '的工坊', 20, H * .45, w - 40); g.fillStyle = '#2b1b0e'; g.font = F('700', Math.max(20, H * .11)); g.fillText(st.name + ' ×1', 20, H * .66, w * .62);
    g.font = F('400', Math.max(15, H * .07), hand); g.fillStyle = '#166534'; g.fillText('回到中央平地就降落', 20, H * .86, w * .6);
    ['#86efac', '#fda4af', '#fde047'].forEach((c, i) => { const bx = w * .66 + i * w * .07, by = H * .24 + (i % 2) * 6; g.strokeStyle = '#94a3b8'; g.lineWidth = 1.5; g.beginPath(); g.moveTo(bx, by + 12); g.lineTo(w * .73, H * .42); g.stroke(); g.fillStyle = c; g.beginPath(); g.ellipse(bx, by, 11, 10, 0, 0, PI2); g.fill(); g.fillStyle = '#1f2937'; g.fillRect(bx - 4, by - 2, 2, 3); g.fillRect(bx + 2, by - 2, 2, 3); });
    inkStamp(g, w * .82, H * .7, Math.min(H * .2, 46), '已付款'); WARE.tx.needsUpdate = true; return;
  }
  g.fillStyle = '#f1e4c6'; rrect(g, 3, 3, w - 6, H - 6, 14); g.fill(); g.strokeStyle = '#b89a6a'; g.lineWidth = 3; g.stroke();
  g.fillStyle = '#7a5a3a'; g.beginPath(); g.arc(22, 22, 7, 0, PI2); g.fill(); g.strokeStyle = '#fafaf9'; g.lineWidth = 2.5; g.beginPath(); g.moveTo(22, 22); g.quadraticCurveTo(10, 8, 2, 2); g.stroke();
  const sg = g.createRadialGradient(w * .18, H * .8, 2, w * .18, H * .8, w * .15); sg.addColorStop(0, 'rgba(90,60,30,.32)'); sg.addColorStop(1, 'rgba(90,60,30,0)'); g.fillStyle = sg; g.beginPath(); g.ellipse(w * .18, H * .8, w * .15, H * .07, 0, 0, PI2); g.fill(); // 縮小模型的影子
  const done = st.why === 'has' || st.why === 'max', fN = Math.max(22, H * .13), fP = Math.max(26, H * .17), fD = Math.max(15, H * .075), fG = Math.max(15, H * .065);
  g.fillStyle = '#2b1b0e'; g.font = F('700', fN); g.fillText(st.name, x0, H * .22, mw);
  let y = H * .22 + fP * 1.05;
  if (!done) { g.fillStyle = '#8a2a12'; g.font = F('700', fP); g.fillText(fmt(st.cost), x0, y, mw * .55); }
  if (st.t === 'up') { const lx = x0 + mw * .58, dr = Math.max(3.5, H * .016); g.fillStyle = '#7c5a2a'; g.font = F('400', fD, hand); g.fillText(done ? 'Lv ' + st.lv : 'Lv ' + st.lv + ' → ' + (st.lv + 1), lx, y - fP * .42, mw * .42); for (let i = 0; i < st.max; i++) { g.fillStyle = i < st.lv ? '#b45309' : 'rgba(120,90,50,.3)'; g.beginPath(); g.arc(lx + dr + i * dr * 3, y - fP * .02, dr, 0, PI2); g.fill(); } }
  y += fD * 1.5; const note = st.why === 'poor' ? '還差 ' + fmt(st.d) : st.why === 'need' ? '要先有' + st.need : '';
  if (note) { g.fillStyle = '#9a3412'; g.font = F('400', fD * 1.1, hand); g.fillText(note, x0, y, mw); y += fD * 1.45; }
  g.fillStyle = '#2b1b0e'; g.font = F('400', fD, hand); const desc = wareDesc(st.id), lines = []; let cur = '';
  for (const c of [...desc]) { if (g.measureText(cur + c).width > mw && cur) { lines.push(cur); cur = c; } else cur += c; } if (cur) lines.push(cur);
  lines.slice(0, 2).forEach((l, i) => g.fillText(l, x0, y + i * fD * 1.3, mw)); y += Math.min(2, lines.length) * fD * 1.3;
  g.fillStyle = '#6b4f2a'; g.font = F('400', fG, hand); g.fillText(done ? (st.why === 'max' ? '已經是最高級了' : '你已經有了') : { ship: '氣球宅配到工坊・回到中央平地就降落', bag: '包好帶走・馬上就有效', wear: '可以當場穿上' }[st.go], x0, Math.max(y + fG * .4, H - 16), mw);
  if (done) inkStamp(g, x0 + mw * .62, H * .42, Math.min(H * .19, 44), st.why === 'max' ? '滿級' : '已購買');
  if (S.wish[st.id]) heartMark(g, w - 26, 26, 12);
  WARE.tx.needsUpdate = true;
}
const wareSig = h => [h.st.why, Math.round(h.st.d / 10), h.st.lv, S.wish[h.wid] ? 1 : 0].join();
/* ---------- 動詞 ---------- */
// E／點擊的入口（doAct 最前面轉過來）：空手對準商品＝拿起來看、對準櫃台或店員＝聊一句；拿著時依位置決定結帳、換拿、放回或請你到櫃台
function wareAct(t, tap) {
  const h = WARE.h, kp = t && t.type === 'npc' && t.n.d.shop ? t.n.d.shop : null;
  if (!h) { if (t && t.type === 'ware') return wareTake(t.it); if (t && t.type === 'counter') return kpTalk(t.it.shop); if (kp) return kpTalk(kp); if (t) doActAt(t); return; }
  if (h.ph !== 'read') return; // 拿起後 450 ms 內、結帳與錢不夠演出中：不收（防誤買）
  if (t && t.type === 'ware' && t.it !== h.it) { wareBack(true); return wareTake(t.it); } // 換拿
  const atC = !!t && ((t.type === 'counter' && t.it.shop === h.shop) || kp === h.shop), home = !!t && t.type === 'ware';
  if (tap && !atC && !home) return; // 觸控：只認點到的東西（點天空、地板、牆壁什麼都不做）
  const st = h.st = wareState(h.t, h.k); if (!st.can) return st.why === 'poor' ? warePoor(st) : wareRefuse(st); // 買不了：放回，原因由店員說（錢不夠先攤零錢）
  if (home) return wareBack(); // 對準原位：放回
  if (atC || nearCounter(h.shop)) return warePay(st);
  kpSay(h.shop, 'far'); const n = kpNpc(h.shop); if (n) npcGest(n, 'wave'); // 離櫃台遠：店員招手，不結帳
}
function wareTake(it) {
  if (WARE.h || GUI.kind || !inCity()) return; wareInit(); purseInit();
  const st = wareState(it.t, it.k); if (!st) return; WARE.R = wareRect();
  WARE.h = { it, wid: it.wid, t: it.t, k: it.k, shop: it.shop, st, ph: 'take', t0: performance.now(), low: 0, mvT: 0, stT: 0, spin: 0, sig: '', sigT: 0, said: 0, from: wPose(), mf: wPose() };
  wareCard(WARE.h, 'card'); WARE.h.sig = wareSig(WARE.h); WARE.mini.geometry = wareMini(it.wid).geo; WARE.mode = '';
  tagDirty(it.wid); TAG.t = 1; shopSnd.take(); document.body.classList.add('ware');
}
// 放回：now＝立即（開介面、換快捷列、換拿、離開城市）；結帳與錢不夠演出中只有 now 會直接結束
function wareBack(now, say) {
  const h = WARE.h; if (!h) return;
  if (now || RM()) { if (RM() && !now && (h.ph === 'read' || h.ph === 'take')) { h.ph = 'back'; h.t0 = performance.now(); h.rm = 1; return; } return wareEnd(); }
  if (h.ph !== 'read' && h.ph !== 'take') return;
  wCopy(WP.c.s ? WP.c : wRead(WARE.R, WP.c), h.from); h.ph = 'back'; h.t0 = performance.now(); if (say) kpSay(h.shop, 'back');
}
function warePay(st) { const h = WARE.h; wCopy(WP.c, h.from); wCopy(WP.m, h.mf); h.ph = 'pay'; h.t0 = performance.now(); h.st = st; h.ev = {}; h.cost = st.cost; h.go = st.go; h.n = clamp(Math.round(st.cost / 150), 2, 5); h.lv0 = S.up.net; }
function warePoor(st) { const h = WARE.h; h.ph = 'poor'; h.t0 = performance.now(); h.st = st; h.ev = {}; h.n = clamp(Math.round(S.money / st.cost * 5), 0, 3); }
function wareRefuse(st) { const h = WARE.h; h.ph = 'refuse'; h.t0 = performance.now(); h.st = st; h.ev = {}; }
function wareEnd() {
  const h = WARE.h; if (!h) return; WARE.h = null; WARE.pose = ''; WARE.gadN = null; if (WARE.g) WARE.g.visible = false; if (WARE.coins) WARE.coins.visible = false; if (VM.purse) VM.purse.scale.setScalar(.001);
  WARE.cmat.opacity = 1; WARE.mmat.opacity = 1; tagDirty(h.wid); TAG.t = 1; VM.key = ''; document.body.classList.remove('ware'); setHTML($('#prompt'), '');
  if (h.fly && h.fly.t < 0) { h.fly.t = 0; h.fly.k = 1; } // 演出被打斷（開介面）：綁好氣球的紙盒照樣飛走
  if (h.go === 'wear' && h.k === 'coat' && h.ev && h.ev.charged) W.pendT = performance.now();
  const b = $('#btnAct'); if (b && b.dataset.mode) b.dataset.mode = '';
}
// #prompt：拿著時一律寫出這一下會做什麼
function wareLabel(t) {
  const h = WARE.h; if (!h || h.ph !== 'read') return ''; const E = TOUCH ? '' : '<kbd>E</kbd>', Q = TOUCH ? '' : '　<kbd>Q</kbd>放回', st = h.st;
  if (t && t.type === 'ware' && t.it !== h.it) return E + '換拿　' + esc(t.it.name);
  if (t && t.type === 'ware') return E + '放回';
  if (!st.can) return TOUCH ? '點原位放回' : E + '放回';
  const atC = !!t && ((t.type === 'counter' && t.it.shop === h.shop) || (t.type === 'npc' && t.n.d.shop === h.shop));
  if (atC || nearCounter(h.shop)) return TOUCH ? '點櫃台結帳・點原位放回' : E + '結帳 ' + fmt(st.cost) + Q;
  return TOUCH ? '帶到櫃台結帳・點原位放回' : '帶到櫃台結帳' + Q;
}
// 結帳墊、收銀台托盤的世界座標
const wMat = (id, v) => { const sh = SHOPS[id]; return v.set(CITY.x + sh.x + sh.w / 2 - 2.1, 1.03, CITY.z - 14 - 2.62); };
const wTray = (id, v) => { const sh = SHOPS[id]; return v.set(CITY.x + sh.x + sh.w / 2 - .95, 1.04, CITY.z - 14 - 2.5); };
/* ---------- 每一格（viewModelStep 開頭）：依時間軸推進。回傳 true＝手拿著卡片（手交給 propGrip），false＝手照平常的擺法（WARE.pose 指定手勢） ---------- */
function wareStep(dt) {
  const h = WARE.h; WARE.pose = '';
  if (!h) { if (WARE.g && WARE.g.visible) WARE.g.visible = false; return false; }
  if (!inCity() || RIDE.on || TITLE.on || W.lost) { wareBack(true); return false; } // 離開城市（搭車、傳送）：立刻放回
  if (h.ph === 'read' && !inShop(h.shop, 1.6)) { wareBack(false, true); } // 拿著走出店頭：東西飛回原位，店員「先幫你放回去囉」
  const cam = W.cam; cam.updateMatrixWorld(); const e = wareE(), rm = RM(), R = WARE.R, tg = h.it.tag, A = WP.a, B = WP.b, C = WP.c, Mn = WP.m;
  WARE.g.visible = true; h.spin += dt * .6; const now = performance.now();
  if (now - h.sigT > 500) { h.sigT = now; if (h.ph === 'read' || h.ph === 'take') { h.st = wareState(h.t, h.k); const sg = wareSig(h); if (sg !== h.sig) { h.sig = sg; wareCard(h, 'card'); } } } // 拿著時錢變了（網站成交）：.5 秒內更新
  wRead(R, B); const pal = () => wWorld(tg.p, tg.q, tg.w, R, A); let grip = false, hk = 1, cOp = 1, mOp = 1, show = true, mini = true;
  const lowPose = out => { const RL = { w: R.w * .7, h: R.h * .7 }; RL.x = innerWidth - RL.w - 24; RL.y = innerHeight - RL.h * .78; return wRead(RL, out); };
  if (h.ph === 'take') {
    const u = clamp(e / WT.take, 0, 1); if (rm) { wCopy(B, C); cOp = clamp(e / 150, 0, 1); } else { pal(); wLerp(A, B, out3(u), ease3(u), ease3(u), C); if (e > WT.take) C.s *= 1 + .04 * Math.sin(Math.PI * clamp((e - WT.take) / 70, 0, 1)); C.q.multiply(wq2.setFromEuler(wE.set(0, 0, .05 * Math.sin(u * Math.PI)))); }
    grip = true; hk = rm ? 1 : ease3(clamp(e / 300, 0, 1));
    wMiniOn(C, R, h.spin, Mn); if (!rm && u < 1) { wv1.copy(tg.p); cam.worldToLocal(wv1); Mn.p.lerpVectors(wv1, Mn.p, out3(u)); Mn.s *= .4 + .6 * u; }
    if (e >= 200 && !h.said) { h.said = 1; kpSay(h.shop, 'pick:' + h.wid); wareAria(h.st); }
    if (e >= WT.ready) h.ph = 'read';
  } else if (h.ph === 'read') {
    const sp = Math.hypot(P.vx, P.vz); if (sp > .6) { h.mvT += dt; h.stT = 0; } else { h.stT += dt; h.mvT = 0; } // 走動時放低到右下角，停下來又舉起
    const want = h.mvT > .15 ? 1 : h.stT > .2 ? 0 : h.low; h.low = rm ? want : want > h.low ? Math.min(want, h.low + dt / .22) : Math.max(want, h.low - dt / .26);
    if (h.low > 0) { lowPose(A); wLerp(B, A, ease3(h.low), 1, ease3(h.low), C); } else wCopy(B, C); grip = true; wMiniOn(C, R, h.spin, Mn);
  } else if (h.ph === 'back') {
    const u = clamp(e / WT.back, 0, 1); grip = true;
    if (h.rm) { wCopy(B, C); cOp = mOp = 1 - clamp(e / 150, 0, 1); wMiniOn(C, R, h.spin, Mn); if (e >= 150) return wareEnd(), shopSnd.put(), false; }
    else { pal(); wLerp(h.from, A, out3(u), ease3(u), ease3(u), C); wMiniOn(C, R, h.spin, Mn); wv1.copy(tg.p); cam.worldToLocal(wv1); Mn.p.lerp(wv1, in3(u)); Mn.s *= 1 - .6 * u; hk = 1 - ease3(clamp((e - 150) / 150, 0, 1)); if (e >= WT.back) { shopSnd.put(); wareEnd(); return false; } }
  } else if (h.ph === 'pay') { grip = warePayStep(h, e, rm, R, B, C, Mn); hk = WARE.hk; cOp = WARE.cOp; mOp = WARE.mOp; mini = WARE.miniOn; if (!WARE.h) return false; }
  else if (h.ph === 'poor') { grip = warePoorStep(h, e, rm, R, B, C, Mn); hk = WARE.hk; cOp = WARE.cOp; mOp = WARE.mOp; if (!WARE.h) return false; }
  else if (h.ph === 'refuse') {
    if (!h.ev.say) { h.ev.say = 1; kpSay(h.shop, h.st.why, { n: h.st.need }); } grip = true;
    if (e < 250) { wCopy(B, C); wMiniOn(C, R, h.spin, Mn); wCopy(C, h.from); } else { const u = clamp((e - 250) / 300, 0, 1); pal(); wLerp(h.from, A, out3(u), ease3(u), ease3(u), C); wMiniOn(C, R, h.spin, Mn); wv1.copy(tg.p); cam.worldToLocal(wv1); Mn.p.lerp(wv1, in3(u)); Mn.s *= 1 - .6 * u; hk = 1 - ease3(clamp((e - 400) / 150, 0, 1)); }
    if (e >= WT.refuse) { shopSnd.put(); wareEnd(); return false; }
  }
  if (!WARE.h) return false;
  // 擺好卡片與縮小模型；亮度跟著夜晚暗一點
  const r = WARE.root; r.position.copy(C.p); r.quaternion.copy(C.q); r.scale.setScalar(C.s); WARE.card.scale.set(R.w, R.h, 1); WARE.card.visible = show && cOp > .01;
  const nl = 1 - .2 * (DN.night || 0); WARE.cmat.color.setScalar(nl); WARE.cmat.opacity = cOp; WARE.mmat.opacity = mOp;
  const mi = wareMini(h.wid); WARE.mini.visible = mini && mOp > .01; WARE.mini.position.copy(Mn.p); WARE.mini.quaternion.copy(Mn.q); WARE.mini.scale.setScalar(Math.max(1e-4, Mn.s / mi.r));
  if (WARE.bag.visible) { WARE.bag.position.copy(WARE.mini.position); WARE.bag.quaternion.copy(WARE.mini.quaternion); }
  // #btnAct 的圖示：可以結帳＝硬幣、買不了＝↩
  const b = $('#btnAct'), md = h.ph !== 'read' ? '' : !h.st.can ? 'back' : nearCounter(h.shop) || (TARGET && ((TARGET.type === 'counter' && TARGET.it.shop === h.shop) || (TARGET.type === 'npc' && TARGET.n.d.shop === h.shop))) ? 'pay' : ''; if (b && b.dataset.mode !== md) b.dataset.mode = md;
  if (!grip) return false;
  VM.g.visible = hk > .01 && !GUI.kind; if (!VM.g.visible) return true;
  propGrip(r, [R.w * .32, -R.h / 2 - 6, 8], C.s, 1.5, R.h, hk, .42 * Math.tan(cam.fov * Math.PI / 360), dt);
  return true;
}
// 結帳（1760 ms，第 3 節）：放上櫃台 → 零錢包 → 硬幣一枚枚跳進托盤（第一枚落下那一刻扣錢）→ 收銀機叮 → 蓋章、送貨單／紙包 → 交回手上 → 收進背包
function warePayStep(h, e, rm, R, B, C, Mn) {
  const ev = h.ev, sh = h.shop, at = ms => { if (e >= ms && !ev[ms]) { ev[ms] = 1; return true; } return false; };
  WARE.hk = 1; WARE.cOp = 1; WARE.mOp = 1; WARE.miniOn = true; let grip = false;
  if (rm) { // 減少動態：0 扣錢＋硬幣聲＋浮字、200 卡片直接換成送貨單或紙包、450 泡泡、600 淡出結束
    if (at(0)) wareCharge(h); if (at(200)) wareDone(h, true); if (at(450)) kpSay(sh, 'pay:' + h.go);
    wCopy(B, C); wMiniOn(C, R, h.spin, Mn); grip = true; WARE.cOp = WARE.mOp = 1 - clamp((e - 450) / 150, 0, 1); WARE.miniOn = h.go === 'bag';
    if (e >= 600) { wareEnd(); return false; } return grip;
  }
  const mat = wMat(sh, wv2), flatQ = WQ_FLAT;
  if (e < WT.give) { // 0–320：卡片平躺飛到結帳墊、縮小模型站在墊子左邊
    const u = clamp(e / WT.put, 0, 1); wWorld(mat, flatQ, .5, R, WP.t); wLerp(h.from, WP.t, out3(u), ease3(u), ease3(u), C);
    wv1.copy(mat).add(tmpV.set(-.36, .1, 0)); wWorld(wv1, wq2.setFromEuler(wE.set(0, h.spin, 0)), .2, R, WP.n); WP.n.s = .22; wLerp(h.mf, WP.n, out3(u), ease3(u), ease3(u), Mn); // 縮小模型站在墊子左邊（世界裡直立、慢慢轉），大小 22 公分
    grip = e < WT.purse; WARE.hk = 1 - ease3(clamp(e / WT.purse, 0, 1)); if (e >= WT.stamp && h.go !== 'bag') { WARE.miniOn = h.go === 'wear' ? e < WT.stamp + 240 : false; WARE.mOp = h.go === 'wear' ? 1 - clamp((e - WT.stamp) / 240, 0, 1) : 1; }
    if (h.go !== 'ship' && e >= WT.stamp) WARE.cOp = 1 - clamp((e - WT.stamp) / 200, 0, 1); // 紙包／穿上：卡片淡出
  }
  if (at(WT.purse)) { shopSnd.purse(); }
  if (e >= WT.purse && e < WT.stamp) { WARE.pose = 'pay'; const k = e < WT.shrink ? out3(clamp((e - WT.purse) / 100, 0, 1)) : 1 - clamp((e - WT.shrink) / 120, 0, 1); VM.purse.scale.setScalar(Math.max(.001, k)); VM.purse.rotation.set(0, 0, 0); }
  else VM.purse.scale.setScalar(.001);
  if (at(120)) kpDo(sh, 'ring', 300); if (at(WT.put - 20)) shopSnd.put();
  wareCoinsPay(h, e);
  if (at(WT.charge)) wareCharge(h);
  if (at(WT.ring)) shopSnd.till();
  if (at(WT.stamp)) { shopSnd.stamp(); kpDo(sh, 'stamp', 240); wareDone(h, false); }
  if (h.go === 'ship' && h.fly && e < WT.launch) h.fly.k = clamp((e - WT.stamp) / (WT.give - WT.stamp), 0, 1);
  if (h.go === 'ship' && h.fly && at(WT.launch)) { h.fly.t = 0; h.fly.k = 1; shopSnd.flyAway(); }
  if (at(WT.say)) kpSay(sh, 'pay:' + h.go);
  if (h.go === 'bag' && e >= WT.stamp && e < WT.give) { const k = out3(clamp((e - WT.stamp) / 240, 0, 1)), mi = wareMini(h.wid); WARE.bag.visible = true; WARE.bag.scale.setScalar(Math.max(1e-4, Mn.s * 1.15 * k / 1)); }
  if (e >= WT.give) { // 1120–1420：送貨單（或紙包）交回手上；1420–1760：縮小飛進右上角的「背包」按鈕
    const mineBag = h.go === 'bag', u = clamp((e - WT.give) / (WT.pocket - WT.give), 0, 1), v = clamp((e - WT.pocket) / (WT.end - WT.pocket), 0, 1);
    if (!h.ev.g0) { h.ev.g0 = 1; wCopy(C.s ? C : B, h.from); wCopy(Mn, h.mf); }
    const hand = wRead({ x: R.x + R.w * .1, y: R.y + R.h * .2, w: R.w * .8, h: R.h * .8 }, WP.t), bag = $('#topbtns [data-act="inv"]'), br = bag ? bag.getBoundingClientRect() : { left: innerWidth - 60, top: 10, width: 40, height: 40 };
    const tgt = wRead({ x: br.left + br.width / 2 - R.w * .06, y: br.top + br.height / 2 - R.h * .06, w: R.w * .12, h: R.h * .12 }, WP.n);
    if (h.go === 'ship') { wLerp(h.from, hand, out3(u), ease3(u), ease3(u), C); if (v > 0) wLerp(hand, tgt, in3(v), ease3(v), ease3(v), C); WARE.cOp = 1 - smooth(.6, 1, v); WARE.miniOn = false; grip = v < .7; WARE.hk = v > 0 ? 1 - ease3(clamp((v - .15) / .5, 0, 1)) : ease3(u); } // 手托著送貨單，單子飛走時才放下
    else if (mineBag) { wMiniOn(hand, R, h.spin, WP.c); wLerp(h.mf, WP.c, out3(u), ease3(u), ease3(u), Mn); if (v > 0) { wMiniOn(tgt, R, h.spin, WP.t); wLerp(Mn, WP.t, in3(v), 1, in3(v), Mn); } WARE.cOp = 0; WARE.mOp = 1 - smooth(.6, 1, v); WARE.bag.visible = true; WARE.bag.scale.setScalar(Math.max(1e-4, Mn.s * 1.15)); wCopy(hand, C); grip = v < .7; WARE.hk = v > 0 ? 1 - ease3(clamp((v - .15) / .5, 0, 1)) : ease3(u); }
    else { WARE.cOp = 0; WARE.miniOn = false; wCopy(hand, C); }
    if (h.go === 'wear' && h.k === 'net') WARE.pose = e < WT.end ? 'offer' : '';
    if (at(WT.end - 60) && h.go !== 'wear') { shopSnd.pocket(); const b = $('#topbtns [data-act="inv"]'); if (b) { b.classList.remove('got'); void b.offsetWidth; b.classList.add('got'); setTimeout(() => b.classList.remove('got'), 600); } }
  }
  if (h.go === 'wear' && h.k === 'net' && e >= WT.stamp && e < WT.end) { WARE.pose = 'offer'; const n = h.lv0 + Math.min(S.up.net - h.lv0, Math.floor((e - WT.stamp - 200) / 160) + 1); if (n !== WARE.gadN) { WARE.gadN = Math.max(h.lv0, n); if (n > h.lv0) sfx.tick && sfx.tick(); } } // 吸取器：手腕往前，燈一顆顆亮到新等級
  if (e >= WT.end) { WARE.bag.visible = false; wareEnd(); return false; }
  return grip;
}
// 螢幕報讀器：名稱、價格、說明（卡片是 3D 畫布，DOM 裡沒有字）
function wareAria(st, paid) { const e = $('#says'); if (!e) return; e.textContent = paid ? '已付款 ' + fmt(st.cost) + '，' + st.name : st.name + '，' + (st.why === 'has' ? '已購買' : st.why === 'max' ? '滿級' : fmt(st.cost) + (st.why === 'poor' ? '，還差 ' + fmt(st.d) : st.why === 'need' ? '，要先有' + st.need : '')) + '，' + wareDesc(st.id); }
// 扣錢（第一枚硬幣落進托盤那一刻）：之後不能取消，走開、關掉頁面也已經存檔
function wareCharge(h) {
  if (h.ev.charged) return; const go = purchase(h.t, h.k, 'city'); if (!go) { wareEnd(); return; } h.ev.charged = 1; h.go = go; wareAria(h.st, true);
  const p = wTray(h.shop, new THREE.Vector3()).add(tmpV.set(0, .35, 0)); fx3(p, '−' + fmt(h.cost), '#fde047', 'big');
  const m = $('#sMoney'); if (m) { m.classList.remove('pay'); void m.offsetWidth; m.classList.add('pay'); setTimeout(() => m.classList.remove('pay'), 700); }
}
// 蓋章那一刻：送貨單（綁氣球的紙盒）／包紙／穿上
function wareDone(h, rm) {
  if (h.go === 'ship') { wareCard(h, 'slip'); if (!rm) { h.fly = cityFlyStart(wMat(h.shop, new THREE.Vector3()).add(tmpV.set(-.36, 0, 0))); shopSnd.inflate(); setTimeout(() => shopSnd.inflate(), 120); setTimeout(() => shopSnd.inflate(), 240); } else shopSnd.flyAway(); }
  else if (h.go === 'bag') { shopSnd.wrap(); WARE.bag.visible = true; WARE.bag.scale.setScalar(1e-4); }
  else { const k = h.k; if (k === 'coat') shopSnd.coat(); else if (k === 'boots') { P.dipV -= 1.6; sfx.step('city', .8); setTimeout(() => sfx.step('city', .8), 150); } else if (k === 'net') WARE.gadN = h.lv0; }
}
// 硬幣：從零錢包沿弧線跳進托盤（叮、叮、叮，一枚比一枚高）
function wareCoinsPay(h, e) {
  const C = WARE.coins, n = h.n; if (e < WT.coin0 || e > WT.stamp) { C.visible = false; return; } C.visible = true; C.count = n;
  if (!h.ev.p0) { h.ev.p0 = VM.purse.getWorldPosition(new THREE.Vector3()); h.ev.tr = wTray(h.shop, new THREE.Vector3()); }
  const m = tmpM4 || (tmpM4 = new THREE.Matrix4()), p0 = h.ev.p0, p1 = h.ev.tr, v = new THREE.Vector3(), q = new THREE.Quaternion(), sc = new THREE.Vector3(1, 1, 1);
  for (let i = 0; i < n; i++) { const t0 = WT.coin0 + i * WT.gap, u = clamp((e - t0) / WT.fly, 0, 1); if (u >= 1 && !h.ev['c' + i]) { h.ev['c' + i] = 1; shopSnd.coin(i); }
    v.lerpVectors(p0, p1, u).add(tmpV.set((i - n / 2) * .03 * u, Math.sin(u * Math.PI) * .25 + (u >= 1 ? i * .009 : 0), 0)); q.setFromEuler(wE.set(u * 6, 0, u * 2)); sc.setScalar(e < t0 ? .001 : 1); m.compose(v, q, sc); C.setMatrixAt(i, m); }
  C.instanceMatrix.needsUpdate = true;
}
// 錢不夠（1500 ms）：攤開零錢包抖三下、只掉出幾枚硬幣和一小團灰塵；店員搖頭、說差多少、吊牌貼一顆 ♡，東西飛回原位
function warePoorStep(h, e, rm, R, B, C, Mn) {
  const ev = h.ev, at = ms => { if (e >= ms && !ev[ms]) { ev[ms] = 1; return true; } return false; }; WARE.hk = 1; WARE.cOp = 1; WARE.mOp = 1;
  const wish = () => { const id = h.wid, n = S.wish[id] || 0; S.wish[id] = n + 1; const ks = Object.keys(S.wish); if (ks.length > 3) delete S.wish[ks.find(k => k !== id)]; save(); kpSay(h.shop, n ? 'poor2' : 'poor', { d: h.st.d }); h.st = wareState(h.t, h.k); wareCard(h, 'card'); };
  if (rm) { if (at(0)) wish(); wCopy(B, C); wMiniOn(C, R, h.spin, Mn); WARE.cOp = WARE.mOp = 1 - clamp((e - 250) / 150, 0, 1); if (e >= 400) { wareEnd(); return false; } return true; }
  let grip = false;
  if (e < 1000) { wCopy(B, C); wMiniOn(C, R, h.spin, Mn); if (e < 120) grip = true; else WARE.pose = 'coins'; wCopy(C, h.from); }
  const k = e < 800 ? out3(clamp((e - 60) / 160, 0, 1)) : 1 - clamp((e - 800) / 200, 0, 1); VM.purse.scale.setScalar(Math.max(.001, e < 1000 ? k : 0)); VM.purse.rotation.z = e > 250 && e < 750 ? Math.sin((e - 250) / 500 * Math.PI * 6) * .35 : 0;
  if (at(60)) shopSnd.purse(); [250, 420, 590].forEach(ms => { if (at(ms)) shopSnd.shake(); });
  if (at(300)) kpDo(h.shop, 'shake', 600); if (at(400)) wish();
  if (at(500)) { shopSnd.dust(); const p = VM.purse.getWorldPosition(new THREE.Vector3()); if (W.goo) W.goo.emit(p, 6, '#9ca3af', { gy: P.y + .02, up: .4, speed: .5, size: .03 }); ev.p0 = p; }
  // 只掉出 n 枚：從零錢包往下掉到地上
  const Cn = WARE.coins; if (e >= 500 && e < 1000 && h.n > 0) { Cn.visible = true; Cn.count = h.n; const m = tmpM4 || (tmpM4 = new THREE.Matrix4()), v = new THREE.Vector3(), q = new THREE.Quaternion(), sc = new THREE.Vector3(); for (let i = 0; i < h.n; i++) { const tt = (e - 500) / 1000, y = Math.max(P.y + .01, ev.p0.y - 4.9 * tt * tt); v.set(ev.p0.x + (i - 1) * .05, y, ev.p0.z + i * .02); q.setFromEuler(wE.set(y > P.y + .02 ? tt * 9 : Math.PI / 2, 0, 0)); sc.setScalar(e < 800 ? 1 : 1 - (e - 800) / 200); m.compose(v, q, sc); Cn.setMatrixAt(i, m); } Cn.instanceMatrix.needsUpdate = true; } else Cn.visible = false;
  if (e >= 1000) { const u = clamp((e - 1000) / 300, 0, 1); wWorld(h.it.tag.p, h.it.tag.q, h.it.tag.w, R, WP.a); wLerp(h.from, WP.a, out3(u), ease3(u), ease3(u), C); wMiniOn(C, R, h.spin, Mn); wv1.copy(h.it.tag.p); W.cam.worldToLocal(wv1); Mn.p.lerp(wv1, in3(u)); Mn.s *= 1 - .6 * u; grip = true; WARE.hk = 1 - ease3(clamp((e - 1150) / 150, 0, 1)); if (e >= 1300) { WARE.cOp = WARE.mOp = 0; } }
  if (at(1300)) { shopSnd.heart(); shopSnd.put(); }
  if (e >= WT.poor) { wareEnd(); return false; }
  return grip;
}
function viewModelStep(dt) {
  if (!VM.g) initViewModel();
  if (heldStep(dt)) return; // 正在拿起／收回手持道具：手跟著道具走
  if (wareStep(dt)) return; // 店裡拿起來看的吊牌卡：手拿著卡片（結帳、錢不夠時手改成掏零錢包，WARE.pose）
  const show = !GUI.kind && !TITLE.on && !W.camAway && !INTRO.on && !RIDE.on; VM.g.visible = show; if (!show) { VM.key = ''; return; } // 搭車中手先藏起來（下一輪放在膝上）
  const it = held(), key = it ? (it.t === 'prod' ? 'p' + it.p.id : 'g' + it.sp) : '';
  if (key !== VM.key) { VM.key = key; VM.swing = Math.max(VM.swing, .3); if (it) { const sp = SP[it.t === 'prod' ? it.p.sp : it.sp]; if (it.t === 'prod') { jellyColors(VM.J, sp); jellyCut(VM.J, it.p); } else VM.gel.material.color.set(sp.color); } }
  VM.swing = Math.max(0, VM.swing - dt * 2.2); VM.sq = Math.max(0, VM.sq - dt);
  // 選擇手勢：擠壓 > 對準史萊姆時伸手 > 拿著的東西 > 空手
  const aimSlime = TARGET && TARGET.type === 'slime', tp = tkPose() || WARE.pose, pose = tp || (VM.sq > 0 ? 'squeeze' : aimSlime ? 'reach' : it ? (it.t === 'prod' ? 'prod' : 'gel') : 'empty'); // 對話：舉著回話卡＝fan、讀手上的紙＝hold
  const T = VM_POSE[pose], k = 1 - Math.exp(-dt * 32); for (const n in T) VM.p[n] += (T[n] - VM.p[n]) * k; const p = VM.p;
  // 伸手或擠壓時，手上的東西先收進掌心（縮小），避免手指張開時穿模
  const keep = it && !tp && pose !== 'reach' && pose !== 'squeeze' ? 1 : 0; VM.holdK += (keep - VM.holdK) * k;
  VM.J.group.visible = !!it && it.t === 'prod' && VM.holdK > .03; VM.gel.visible = !!it && it.t === 'gel' && VM.holdK > .03; VM.hold.scale.setScalar(Math.max(.001, VM.holdK));
  vmPose(p);
  const gn = WARE.gadN != null ? WARE.gadN : S.up.net; VM.gad.visible = gn > 0; VM.gadL.forEach((m, i) => m.visible = i < gn); // 剛買吸取器：燈一顆顆亮到新等級（wareStep）
  // 依畫面比例固定在右下角；直向手機放大並移到下方偏右
  const d = .78, hh = Math.tan(W.cam.fov * Math.PI / 360) * d, hw = hh * W.cam.aspect, port = W.cam.aspect < .9;
  const sc = port ? hh * 1.45 : hh * 1.32, ax = port ? hw * .36 : hw * .44, ay = port ? -hh * .56 : -hh * .5;
  const mv = P.ground ? clamp(Math.hypot(P.vx, P.vz) / 4.3, 0, 1.4) : 0;
  const bx = Math.sin(P.bob * .5) * .012 * mv, by = Math.abs(Math.cos(P.bob * .5)) * .014 * mv, sw = Math.sin(VM.swing / .35 * Math.PI) * (pose === 'squeeze' ? .3 : 1);
  // 手上的凝膠會隨走路、揮動與吸收凝膠而 Q 彈晃動
  VM.jv = (VM.jv || 0) + ((-(VM.j || 0)) * 220 - (VM.jv || 0) * 9) * dt + (by * 40 + sw * 4) * dt; VM.j = clamp((VM.j || 0) + VM.jv * dt, -.35, .35);
  const grip = pose === 'squeeze' ? 0 : p.c * .06; // 手指握緊時凝膠被壓扁一點
  VM.g.scale.setScalar(sc); VM.g.position.set(ax + bx, ay - by - sw * .04 - (P.sneak ? .03 : 0), -d + sw * .03); VM.g.rotation.set(sw * .35, 0, -sw * .15 + P.roll * 2);
  VM.J.group.rotation.y += dt * .5; VM.gel.rotation.y += dt * .5; VM.gel.scale.set((1 - VM.j * .5) * (1 - grip), .72 * (1 + VM.j) * (1 + grip * .6), (1 - VM.j * .5) * (1 - grip));
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
let lastT = performance.now(), secAcc = 0, webAcc = 0, trendAcc = 0, saveAcc = 0, hudN = 0, pickN = 0;
const tmpC = new THREE.Color(), tmpC2 = new THREE.Color(), tmpV = new THREE.Vector3(), tmpM = new THREE.Matrix4();
const ENVC = [0, 1, 2, 3, 4].map(() => new THREE.Color());
const SUN_D = new THREE.Vector3(30, 55, 22).normalize(), SUN_R = new THREE.Vector3().crossVectors(SUN_D, new THREE.Vector3(0, 1, 0)).normalize(), SUN_U = new THREE.Vector3().crossVectors(SUN_R, SUN_D).normalize();
const SH_EXT = 34, SH_RES = 2048, shC = new THREE.Vector3();
function envStep(dt) {
  if (W.bumpU && W.bumpU.value.z > 0) W.bumpU.value.z = Math.max(0, W.bumpU.value.z - dt * .9);
  const EP = (INTRO.on || TITLE.on) && INTRO.env || P, w = biomeW(EP.x, EP.z), [fog, top, sun, hs, hg] = ENVC.map(c => c.setRGB(0, 0, 0)); // 標題與開場：天色、陰影跟著鏡頭（caves.js 的 INTRO.env）
  BIOMES.forEach((b, i) => { const Z = ZONE3D[b]; fog.add(tmpC.set(Z.fog).multiplyScalar(w[i])); top.add(tmpC.set(Z.top).multiplyScalar(w[i])); sun.add(tmpC.set(Z.sun).multiplyScalar(w[i])); hs.add(tmpC.set(Z.hemiS).multiplyScalar(w[i])); hg.add(tmpC.set(Z.hemiG).multiplyScalar(w[i])); });
  dnUpdate(); const nN = DN.night;
  fog.lerp(DNC.duskFog, DN.dusk * .55).lerp(DNC.dawnFog, DN.dawn * .45).lerp(DNC.fog, nN * .9); top.lerp(DNC.duskTop, DN.dusk * .6).lerp(DNC.dawnTop, DN.dawn * .5).lerp(DNC.top, nN * .95);
  sun.lerp(DNC.duskSun, (DN.dusk + DN.dawn) * .7).lerp(DNC.sun, nN); hs.lerp(DNC.hs, nN * .85); hg.lerp(DNC.hg, nN * .8);
  const k = Math.min(1, dt * 2); W.scene.fog.color.lerp(fog, k); W.scene.background.copy(W.scene.fog.color); W.sky.material.uniforms.bot.value.lerp(fog, k); W.sky.material.uniforms.top.value.lerp(top, k);
  W.sun.color.lerp(sun, k); W.hemi.color.lerp(hs, k); W.hemi.groundColor.lerp(hg, k); W.sun.intensity = (2.6 - w[2] * .9) * (1 - .72 * DN.night) * (1 - .25 * (DN.dusk + DN.dawn)); W.hemi.intensity = .55 * (1 - .35 * DN.night); skyEnv(); nightLights();
  W.sky.position.copy(W.cam.position);
  // 陰影範圍往視線前方偏移（身後的陰影用不到），並對齊陰影貼圖的像素格：走動時陰影邊緣不再閃爍、游移
  const fx = EP.x - Math.sin(EP.yaw) * 10, fz = EP.z - Math.cos(EP.yaw) * 10, tx = SH_EXT * 2 / SH_RES;
  shC.set(fx, EP.y, fz); const a = Math.round(shC.dot(SUN_R) / tx) * tx, b = Math.round(shC.dot(SUN_U) / tx) * tx, c = shC.dot(SUN_D);
  shC.copy(SUN_R).multiplyScalar(a).addScaledVector(SUN_U, b).addScaledVector(SUN_D, c);
  W.sun.target.position.copy(shC); W.sun.position.copy(shC).addScaledVector(SUN_D, 66);
  const zid = CV.c ? W.zoneNow : inCity() ? 'city' : domBiome(P.x, P.z); if (zid !== W.zoneNow) { const prev = W.zoneNow; W.zoneNow = zid; volcanoHint(zid); if (prev && !W.quietZone) toast(zid === 'city' ? '抵達大城市' : `進入${ZONES.find(z => z.id === zid).name}`); W.quietZone = false; if (S.zones.includes(zid)) (S.seenZone = S.seenZone || {})[zid] = true; }
  caveEnv(dt);
}
// 距離剔除：超出霧距的道具區塊不繪製（大城市時整片山谷都不畫）
const LOD_D = LOW ? 30 : 50, SHADOW_D = 52; // 50m 涵蓋整個陰影範圍（含視線前方偏移），遠角的樹也有陰影
function cullChunks(at = P) {
  const fogFar = (W.scene.fog ? W.scene.fog.far : 260) + 12, city = inCity(at.x);
  for (const c of W.chunks) {
    const u = c.userData, dx = Math.max(u.x0 - at.x, 0, at.x - u.x1), dz = Math.max(u.z0 - at.z, 0, at.z - u.z1), d = Math.hypot(dx, dz);
    c.visible = !city && d < Math.min(u.far * (W.vegFar || 1), fogFar); if (u.pair) u.pair.visible = c.visible; if (!c.visible) continue;
    if (u.pair) lodSplit(c, at, d < LOD_D);
    else c.castShadow = u.shadow && d < SHADOW_D; // 只有陰影範圍附近的區塊才進陰影貼圖
  }
}
/* ---------- 雪原體溫：每次進入雪原有 10 分鐘，歸零就凍僵（發抖、減速），要到大城市的醫院看醫生 ---------- */
const inSnowZone = () => !!P && P.x < -56 * K && !inCity(P.x) && !CV.c;
let warmSig = '';
function warmStep(dt) {
  const inS = inSnowZone();
  if (W.inSnow == null) { W.inSnow = inS; if (inS && !S.frozen && !(S.warm > 0)) S.warm = WARM_MAX; }
  else if (inS !== W.inSnow) { W.inSnow = inS; if (inS && !S.frozen) { S.warm = WARM_MAX; W.warm1 = false; toast('進入雪原：體溫條（畫面左側）有 10 分鐘，歸零就會凍僵'); } }
  if (inS && !S.frozen) {
    S.warm = Math.max(0, S.warm - dt);
    if (S.warm <= 60 && !W.warm1) { W.warm1 = true; toast('體溫只剩 1 分鐘！快離開雪原'); }
    if (S.warm <= 0) { S.frozen = true; objSig = ''; sfx.squish && sfx.squish(1, .7); saveCloud(); modal('<h2>你凍僵了！</h2><p>身體不停發抖，走路也變慢了。</p><p>到<b>大城市的醫院</b>看醫生就會立刻痊癒，診療費 <b>¥20</b>（搭出生點左邊的計程車）。</p>'); }
  }
  let el = document.getElementById('warm'); if (!el) { el = document.createElement('div'); el.id = 'warm'; el.innerHTML = '<b>體溫</b><div class="wbar"><i></i></div><span></span>'; (document.getElementById('hud') || document.body).appendChild(el); }
  const show = (inS || S.frozen) && !TITLE.on, pct = S.frozen ? 0 : S.warm / WARM_MAX, sec = Math.ceil(S.warm), sig = show + '|' + pct.toFixed(2) + '|' + sec + '|' + S.frozen;
  if (sig === warmSig) return; warmSig = sig; el.hidden = !show; if (!show) return;
  el.classList.toggle('low', !S.frozen && pct < .25); el.classList.toggle('frozen', S.frozen);
  el.querySelector('i').style.height = pct * 100 + '%'; el.querySelector('span').textContent = S.frozen ? '凍僵了' : Math.floor(sec / 60) + ':' + String(sec % 60).padStart(2, '0');
}
// 醫院：護理師在門口（聲音從門口出來）；「看醫生」要花錢，只能按數字或點選，E＝等一下
const hospWho = () => spotWho('hospital', '護理師', [CITY.x - 34, 2.7, CITY.z - 12.6], [CITY.x - 34, 1.6, CITY.z - 13.9], { col: '#99f6e4', vo: [1.15, 32], bye: '保重身體喔！' });
function hospitalAct() {
  const who = hospWho();
  if (!S.frozen) return talk(who, ['你看起來很健康喔！', '從雪原回來覺得冷，再過來找我們。']);
  talk(who, [{ t: '你凍得在發抖！看診要 ' + fmt(HOSPITAL_FEE) + '，現在看嗎？', emo: 'sweat', opt: [
    { t: '看醫生', sub: fmt(HOSPITAL_FEE), ok: () => S.money >= HOSPITAL_FEE, no: '錢不夠', nf: ['先賣掉幾個捏捏再來，我們等你。'], f: hospCure },
    { t: '等一下', e: 1, f: () => ['不要拖太久喔，凍僵很難受的。'] }] }]);
}
function hospCure() {
  if (!S.frozen || S.money < HOSPITAL_FEE) return ['你已經不抖了，好好休息喔。'];
  S.money -= HOSPITAL_FEE; S.frozen = false; S.warm = WARM_MAX; objSig = ''; warmSig = ''; sfx.level(); renderTop(); saveCloud(); tkBump('#sMoney');
  return [{ t: '來，熱茶和毛毯……好多了吧？', emo: 'heart' }, '下次進雪原一樣有 10 分鐘的體溫，記得保暖喔。'];
}
/* 畫質：自動／高／低。自動時 FPS 連續 5 秒低於 28 就依序關掉粒子、減少遠景植被、縮短霧距（解析度原本就會自動調整） */
const QL = { lvl: 0, lowT: 0, frames: 0, acc: 0, noParts: false };
function applyQuality(reset) {
  if (reset) QL.lvl = S.quality === 'low' ? 3 : 0;
  QL.noParts = QL.lvl >= 1; W.vegFar = QL.lvl >= 2 ? .6 : 1;
  if (W.scene && W.scene.fog) W.scene.fog.far = (LOW ? 170 : 260) * (QL.lvl >= 3 ? .75 : 1);
}
function qualityStep(dt) {
  QL.frames++; QL.acc += dt; if (QL.acc < 1) return; const fps = QL.frames / QL.acc; QL.frames = 0; QL.acc = 0;
  if (S.quality !== 'auto') return;
  if (fps < 28) { if (++QL.lowT >= 5 && QL.lvl < 3) { QL.lvl++; QL.lowT = 0; applyQuality(); toast('畫面有點卡，已自動降低畫質（' + ['', '關閉飄浮粒子', '減少遠景植被', '縮短可視距離'][QL.lvl] + '）'); } } else QL.lowT = 0;
}
function worldStep(dt) {
  musicStep(dt); ambStep(dt); qualityStep(dt); if (!TITLE.on && (W.clkN = (W.clkN || 0) + 1) % 10 === 0) renderClock();
  W.t += dt; W.wind.value = W.t; if (!GUI.kind && !INTRO.on && !RIDE.on) playerStep(dt); if (!INTRO.on) warmStep(GUI.kind && GUI.kind !== 'line' ? 0 : dt); // 介面開著時世界照樣在動，但雪原體溫不倒數；開場期間也不倒數
  if (++W.cullN % 8 === 0 || W.cullN === 1) cullChunks(INTRO.on ? W.cam.position : P);
  giantStep(); if (COOP.on && Date.now() - COOP.last > 8000) coopHide();
  deliverStep(dt); shipStep(dt); if ((W.phN = (W.phN || 0) + 1) % 30 === 0) photoCheck();
  const hs = W.hitstop > 0; if (hs) W.hitstop -= dt; slimeStep(hs ? dt * .06 : dt, W.t); lineStep(dt); W.anim.forEach(f => f(dt, W.t)); envStep(dt); if (INTRO.on) introStep(dt); else if (RIDE.on) rideStep(dt); else cameraStep(dt); viewModelStep(dt); avatarsStep(dt); // 搭計程車：鏡頭交給 rideStep（在 envStep／caveEnv 之後，隧道的霧、光、曝光會蓋過去）
  if ((W.propN = (W.propN || 0) + 1) % 20 === 0) refreshProps(); stageStep(); upgradeFx(dt);
  if (W.goo) { const got = W.goo.update(dt, VM.palm && VM.g.visible ? VM.palm.getWorldPosition(tmpV) : W.cam.localToWorld(tmpV.set(.3, -.26, -.72))); if (got) { VM.jv = (VM.jv || 0) + 2.5 * got; VM.swing = Math.max(VM.swing, .12); if (performance.now() - (W.colT || 0) > 90) { W.colT = performance.now(); sfx.collect(); } } }
  for (const s of W.labels) { s.getWorldPosition(tmpV); const o = GUI.kind === 'line' ? 0 : (s.userData.keep ? 1 : smooth(2.4, 5, tmpV.distanceTo(W.cam.position))); s.material.opacity = o; s.visible = o > .02; }
  renderCoach();
  // 準心對到會說話的對象時，改由他頭上的「…」提示，畫面中央不顯示文字（talk.js 的 tkLabel）
  if (!GUI.kind && !RIDE.on && ++pickN % 3 === 0) { TARGET = pickAt(0, 0); const lbl = WARE.h ? wareLabel(TARGET) : tkLabel(TARGET); setHTML($('#prompt'), lbl); $('#cross').classList.toggle('on', !!TARGET); renderRing(); }
  else if (GUI.kind || RIDE.on) { setHTML($('#prompt'), ''); if (TARGET) { TARGET = null; renderRing(); } }
  // 按住互動鍵連續捏（節奏較慢，想拿「完美節奏」要自己抓拍點）
  if ((IN.hold || IN.holdE) && !GUI.kind && !TK.on && !RIDE.on) { IN.holdT -= dt; if (IN.holdT <= 0) { IN.holdT = .55; if (TARGET && TARGET.type === 'slime') act(); } }
  if (W.sneakUI !== !!P.sneak) { W.sneakUI = !!P.sneak; $('#vig').classList.toggle('on', W.sneakUI); $('#btnSneak').classList.toggle('on', W.sneakUI); if (W.sneakUI && !S.tipSneak) { S.tipSneak = true; toast('潛行中：腳步變輕，怕生的稀有史萊姆比較不會發現你'); } }
  W.r.render(W.scene, W.cam);
}
function loop(now) {
  const dt = clamp((now - lastT) / 1000, 0, .1); lastT = Math.max(lastT, now);
  trendAcc += dt; if (trendAcc > 90) { trendAcc = 0; pickTrend(); }
  if (S.up.farm > 0) { if (!S.farmT) S.farmT = Date.now(); else if (Date.now() - S.farmT >= FARM_MS) farmCollect(1); }
  webAcc += dt; if (webAcc >= 4) { webAcc = 0; const r = webTick(); if (r) { toast(`網站成交 +${fmt(r.price)}　${'★'.repeat(r.stars)}`); renderTop(); if (tab === 'web') renderWeb(); } }
  branchTick(dt); updateLive(dt);
  secAcc += dt; saveAcc += dt;
  if (secAcc >= 1) { secAcc = 0; checkBranch(); renderTop(); renderXP(); renderObjective(); renderHotbar(); renderNetChip(); if (tab === 'live' && NET.on) renderLiveOthersOnly(); const ae = document.activeElement; if (!(ae && ae.tagName === 'INPUT') && tab === 'branch') renderBranch(); if (PANEL[tab]) renderShop(tab); }
  if (saveAcc > 5) { saveAcc = 0; save(); }
  try {
    const g = GUI.kind;
    if (W.lost) { /* 顯示資源遺失期間暫停繪製，恢復後自動繼續 */ }
    else if (W.ready && TITLE.on) { titleStep(dt); drsStep(dt); }
    else if (W.ready && (!g || g === 'line' || gxBusy() || RIDE.on)) { worldStep(dt); renderCompass(); drsStep(dt); bgAcc = 0; } // 搭車中窗外一直在動：介面開著也全速重畫
    else if (W.ready) {
      // 介面開著：世界照樣在背後動、照樣有聲音，只是降低重繪頻率省電（玩家不能移動、準心不互動由 worldStep 依 GUI.kind 判斷）。
      // 降頻時不讓畫質自動調整與動態解析度把它誤判成掉幀
      bgAcc += dt; if (bgAcc >= (LOW ? .05 : .033)) { worldStep(Math.min(bgAcc, .1)); bgAcc = 0; QL.frames = QL.acc = 0; } DRS.acc = DRS.n = 0;
    }
    gxStep();
    if (W.ready) { waypointStep(); tkStep(dt); } // 對話泡泡、一句話、準心的「…」：世界畫完之後把說話的人投影到畫面上（talk.js）
    else DRS.acc = DRS.n = 0;
    if (M.active) makeTick(dt);
    if (tab === 'decor') decorSt.step(dt);
    else if (tab === 'live') { liveSt.step(dt); if (!L.watch) { $('#hypeBar').style.width = L.hype + '%'; $('#liveViewers').textContent = Math.round(L.viewers) + ' 觀眾'; } if (++hudN % 15 === 0) updateLiveHUD(); }
    else if (tab === 'branch' && S.branch === 'factory') facStep(dt);
  } catch (err) { console.error(err); }
  requestAnimationFrame(loop);
}
/* 養殖槽：每 30 分鐘自動收集一批凝膠（每級 4 份）；離線最多補 4 批 */
const FARM_MS = 30 * 60 * 1000;
function farmCollect(cycles, quiet) {
  if (!(S.up.farm > 0) || cycles < 1) return 0; const us = unlockedSpecies(), n = cycles * 4 * S.up.farm;
  for (let i = 0; i < n; i++) { const sp = pick(us); S.gel[sp.id] = (S.gel[sp.id] || 0) + 1; discover(sp.id); }
  S.farmT += cycles * FARM_MS; if (Date.now() - S.farmT >= FARM_MS) S.farmT = Date.now();
  if (!quiet) { toast(`養殖槽自動收集了 ${n} 份凝膠`); sfx.pop && sfx.pop(); }
  renderHotbar(true); if (tab === 'make' && !M.active) renderMake(); save(); return n;
}
const farmLeft = () => S.up.farm > 0 && S.farmT ? Math.max(0, Math.ceil((S.farmT + FARM_MS - Date.now()) / 1000)) : 0;
function offlineCatchUp() {
  if (S.up.farm > 0 && S.farmT) { const c = Math.min(4, Math.floor((Date.now() - S.farmT) / FARM_MS)); if (c > 0) { const n = farmCollect(c, true); setTimeout(() => toast(`離線期間養殖槽收集了 ${n} 份凝膠`), 1400); } }
  const el = Math.min((Date.now() - S.last) / 1000, 1800); if (el < 8 || !S.web.length) return;
  let gain = 0, n = 0; for (let i = 0; i < Math.floor(el / 4); i++) { const before = S.earned; if (webTick()) { gain += S.earned - before; n++; } }
  if (n) setTimeout(() => toast(`離線期間網站賣出 ${n} 件，+${fmt(gain)}`), 800);
}

/* ---------- 給 React 介面用（components/stations/）----------
   已改成 React 的分頁：這裡不再組 HTML，只發出 slime:ui 通知重繪；React 的按鈕一樣帶 data-act，點擊仍由上面的 click 處理。
   React 透過 window.SlimeGame 讀遊戲狀態與計算函式，所以價格、需求、訂單等規則只有這裡一份。 */
function ui(name) { window.dispatchEvent(new CustomEvent('slime:ui', { detail: name })); }
window.SlimeGame = {
  get S() { return S; }, get M() { return M; }, get BN() { return BN; }, get NET() { return NET; }, get trend() { return trend; },
  get invSel() { return invSel; }, get tab() { return tab; }, get kind() { return GUI.kind; }, likeT: () => W.likeT || {},
  get title() { return TITLE; }, get inCity() { return !!P && inCity(); }, get riding() { return RIDE.on; }, saveCount: () => savesInfo().length, MAX_SAVES, hasSave: () => !!lsGet(SAVE_KEY) && S.seen, fmtTime, SENS_N, XP_LV,
  MG, STEPS, MKEY, ownAny, TOUCH,
  get L() { return L; }, get D() { return D; }, get decorSel() { return { p: decorSt.p, sel: decorSt.sel }; }, BRANCHES,
  branchReady, contractItems, shopItem, shopPrice,
  AVATARS, avatarSVG, SP, SPECIES, ZONES, RAR, DN, DN_PHASE, creditsHTML, PHOTO_EVT, REPAIRS, UPS, OWN, PACKS, DECO, CUTS, TIER, GOAL, SHOP_UPS, QUEST, PILLAR, TABLET_TXT, WEEK_MS, CH,
  fmt, cap, slots, upCost, effCrisp, fair, rating, priceOf, weeklyOrders, wkItems, weekNo, invItems, short, farmLeft, fmtSec,
  unlockedSpecies, tierOf, defPrice, demand, speedTxt, xpLevel, decoBonus,
  qState, nextQuest: () => nextQuest(), questReady: k => questReady(k), madeIn, pillarClues, pSp, pillarExtra, hintBlock, tideStepsHTML, cluesDone, mapImage, enter: ENTER,
  wareState, get ship() { return S.ship; }, // 商品狀態（城市與網購共用的規則）、還沒演的到貨（手帳的「宅配中」）
  eggs: eggList, // 月光谷的小秘密：[{ id, name, hint, found }]（手帳的探索日誌）
};

/* ---------- 啟動 ---------- */
offlineCatchUp(); trend.sp = pick(trendPool()).id; renderTop();
if (initWorld()) { renderHotbar(true); renderXP(); renderObjective(); renderQuest(); $('#startHint').innerHTML = '<b>點擊畫面開始</b><br>WASD 移動 · 滑鼠環顧 · E 互動'; }
window.dispatchEvent(new Event('slime:ready')); // 通知 React 收起載入畫面（components/LoginGate.tsx）
addEventListener('beforeunload', save); addEventListener('pagehide', () => { save(); cloud('leave'); if (NET.on) netLeave(true); });
let hiddenAt = 0;
document.addEventListener('visibilitychange', () => {
  if (document.hidden) { hiddenAt = Date.now(); save(); cloud('leave'); return; }
  if (!hiddenAt) return; const el = Math.min((Date.now() - hiddenAt) / 1000, 1800); hiddenAt = 0; lastT = performance.now(); DRS.skip = 2; DRS.acc = DRS.n = 0; if (el < 8 || !S.web.length) return;
  let gain = 0, n = 0; for (let i = 0; i < Math.floor(el / 4) && S.web.length; i++) { const r = webTick(); if (r) { gain += r.price; n++; } }
  if (n) { toast(`離開期間網站賣出 ${n} 件，+${fmt(gain)}`); sfx.coin(); renderTop(); renderHotbar(); }
});
let autoStart = false; try { autoStart = !!sessionStorage.getItem('squish_autostart'); sessionStorage.removeItem('squish_autostart'); } catch (e) { }
if (autoStart) startPlay(); else showTitle();
requestAnimationFrame(loop);
