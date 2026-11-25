'use strict';
/* ============================================================
   世界裡的對話：誰在說話，字就從誰身上冒出來；你的回答拿在自己手上。
   - 不開 #modal、不解鎖滑鼠、世界不停、鏡頭不被拉走：泡泡是 #hud 裡的 DOM，每格把說話的人（世界座標）投影成畫面位置，
     跟 #wp、fx3、faceTrack 同一套「3D 只負責在哪裡、讀和按交給 DOM」的作法。字跟著裝置解析度（不受動態解析度影響），
     泡泡本身 0 次繪製呼叫（只有居民說話時那張嘴 1 次）。
   - 三個頻道：主泡泡 TK（正在進行的對話，佔 E／1／2；沒有對話時兼做準心的「…」提示）、
     回話卡 TK.cards（最多 2 張，拿在第一人稱的手上）、一句話 BK（道別、店員招呼、自己的想法雲；最多 2 個，不佔按鍵）。
   - E 永遠不花錢：只有標 e:1 的免費、可反悔選項能用 E 選；花錢、交出東西一定要按數字或點卡。
   - 這個檔案在 game.js 之前載入（同 caves.js）：最上層只放資料與函式，用到的 game.js 全域（S、W、P、TARGET、GUI…）都在函式被呼叫時才讀。
   - 新增一個說話者＝寫一個 who＋一組拍子：talk(who, beats, o)。這裡不寫任何店名或座標（店家的 who 在 game.js）。
   ============================================================ */

/* ---------- 資料 ---------- */
// 時間軸（毫秒）：彈出、打字、回話卡、收起……
const TKT = { pop: 160, popUp: 110, popFade: 90, type0: 90, swap: 140, swapType: 70, cap: 1300, g0: 200, gRev: 250, ask: 150, arm: 350, rise: 200, rise2: 40, fly: 220, wait: 240, drop: 140, out: 160, outQ: 100, rm: 120, unfold: 200, hint: 120, hintOut: 100, hintGap: 600, nudge: 320, stamp: 400 };
// 主泡泡的狀態。st：type（打字中）→ read（整頁出現）→ ask（回話卡舉著）→ fly（卡片飛出去）→ wait（對方點頭）
const TK = { on: false, who: null, mw: null, q: [], i: -1, pg: [''], pi: 0, st: '', t0: 0, p0: 0, tt: 0, ch: 0, vc: 0, vt: 0, doneT: 0, ty: false, sch: [], chs: [], txs: [],
  n: 0, max: 0, more: null, none: null, end: null, egg: '', byed: false, dmin: 0, d: 0, fade: 1, a: null, cards: null, cg: [], armT: 0, guardT: 0, idle: 0, waitT: 0, syncT: 0, after: null,
  el: null, pl: '', plBad: 0, placed: false, x: 0, y: 0, w: 0, h: 0, bx: 0, by: 0, bw: 0, bh: 0, fs: 17, s: 1, tbase: null, safe: null, safeN: 0,
  hk: '', hw: null, hT: 0, hs: 0, endT: -1e9, stampTxt: '', nightN: 0, fz: null };
const BK = { list: [], safe: null, safeN: 0 }; // 一句話（道別、店員、想法雲）
const tkV = new THREE.Vector3(), tkV2 = new THREE.Vector3(), tkV3 = new THREE.Vector3();
const PA = { x: 0, y: 0, z: 0 }, PM = { x: 0, y: 0, z: 0 }, PH = { x: 0, y: 0, z: 0 }; // 投影結果：泡泡錨點、嘴、手掌
const tkNow = () => TK.fz != null ? TK.fz : performance.now(); // 測試時設 TK.fz 把時間停住（同 GX.fz）
const SELF = { id: 'self', k: 'self', name: '' }; // 自己的心裡話：畫面下方的想法雲
const GEST = { wave: 1000, nod: 520, tilt: 900, hop: 640 }; // 居民的小動作長度
// 居民話題 → 動作、貼紙、彩蛋（npcLine 回傳的 k）
const NPC_FX = { hi: { g: 'wave' }, 'c:night': { emo: 'zz' }, 'c:late': { emo: 'zz' }, 'c:live': { emo: 'heart' }, 'c:fans': { emo: 'heart' }, 'f:x': { emo: 'heart' }, 'c:frozen': { emo: 'sweat' }, 'c:pg': { emo: 'sweat' }, 'c:rich': { emo: 'star' }, 'c:mkt': { emo: 'note' }, 'f:hi': { emo: 'bang', g: 'hop', egg: 'city_fan' } };
const EMO_URL = {}; // 貼紙：emoTex 的畫布轉成 dataURL，每種只轉一次
const TK_MUTE = /[\s，、。！？；：…～「」『』（）—·・,.!?;:~()'"\-]/; // 打字時不出聲的字
const TK_C = [['ar', 0, 0], ['al', 0, 0], ['r', 0, 0], ['l', 0, 0]], TK_CK = [['c', 0, 0], ...TK_C]; // 泡泡的四個候選位置（右上、左上、頭的右邊、頭的左邊）；告示牌的便條先試正上方
const tkLen = s => [...String(s == null ? '' : s)].length;
const tkB = b => typeof b === 'string' ? { t: b } : Object.assign({}, b); // 一拍：'字串' 或 { t, emo, g, sig, egg, opt, last }

/* ---------- 聲音：都走 master（跟著音效音量），關掉音效就全部安靜 ---------- */
function tkPlay(f) { if (!S || !S.sound) return; try { const ac = audio(); f(ac, ac.currentTime); } catch (e) { } }
const tkSnd = {
  pop: (k = 1) => tkPlay((ac, t) => { noise(ac, t, .04, 2200, 1.2, .05 * k, 'bandpass'); tone(880, t, .05, .02 * k, 'triangle'); }),
  blip: (p = 1) => tkPlay((ac, t) => { tone(560 * p * (.96 + Math.random() * .08), t, .035, .01, 'triangle'); noise(ac, t, .02, 1800 * p, 2, .004, 'bandpass'); }),
  paper: () => tkPlay((ac, t) => noise(ac, t, .08, 2600, .8, .03, 'bandpass')),
  fwip: () => tkPlay((ac, t) => { sweep(1400, 600, t, .08, .03, 'triangle'); noise(ac, t, .06, 2600, 1, .04, 'bandpass'); }),
  no: () => tkPlay((ac, t) => tone(240, t, .2, .035, 'triangle')),
  stamp: () => tkPlay((ac, t) => { tone(140, t, .07, .06); noise(ac, t, .06, 300, .8, .08, 'lowpass'); }),
};

/* ---------- 說話的人（who） ----------
   k：say（居民、店家：打字、有尾巴、有說話聲）｜note（告示牌、紙條、信：整頁出現、翻紙聲、沒有尾巴）｜self（自己的想法雲，只用在一句話）
   at(v)／mouth(v)：泡泡錨點與尾巴尖（世界座標，寫進 v）；null＝拿在手上。xz()、r：量距離的位置、離開多遠一定結束。
   vo：[音高, 每字毫秒]。tg(t)：準心目標是不是他（E＝繼續，還是先收起再去做別的事） */
function npcWho(n) {
  if (n.who) return n.who; const d = n.d, m = n.m, kid = d.kid || 1;
  return n.who = { id: 'npc:' + d.id, k: 'say', name: d.name, role: d.role, col: d.tag || d.top, n, kid,
    at: v => m.root.localToWorld(v.set(0, 2.05 * kid, 0)), mouth: v => m.head.localToWorld(v.set(0, .085, .17)),
    xz: () => { const e = m.root.matrixWorld.elements; return [e[12], e[14]]; }, r: 8.5,
    vo: [kid < 1 ? 1.35 : d.slow ? .8 : 1, d.slow ? 46 : d.fast ? 25 : 32], bye: d.bye || '下次見～', tg: t => !!t && t.type === 'npc' && t.n === n };
}
// 店門口、車窗、攤位：兩個固定的世界座標（泡泡錨點、嘴）
function spotWho(id, name, at, mouth, o = {}) {
  return Object.assign({ id, k: 'say', name, role: '', col: '#e2e8f0', at: v => v.set(at[0], at[1], at[2]), mouth: v => v.set(mouth[0], mouth[1], mouth[2]), xz: () => [mouth[0], mouth[2]], r: 8, vo: [1, 32], bye: '', tg: t => !!t && !!t.it && t.it.id === id }, o);
}
// 告示牌：木牌上方攤開一張牛皮紙便條（名牌是告示牌的標題與顏色）
function signWho(it, I) {
  const p = it.hit.getWorldPosition(new THREE.Vector3()), at = v => v.set(p.x, p.y + 1.15, p.z);
  return { id: 'sign:' + it.id, k: 'note', kraft: true, name: I.t, col: I.c, at, mouth: at, xz: () => [p.x, p.z], r: 7, tg: t => !!t && t.it === it };
}
// 拿在手上讀的紙（紙條、信）：跟著第一人稱的手，可以邊走邊讀。o.src＝紙是從哪個東西拿出來的（準心還對著它時 E＝翻頁／收起，不會收起又馬上重新打開）
function noteWho(name, o = {}) { return Object.assign({ id: 'note:' + name, k: 'note', hand: true, name, col: '#fde68a', at: null, mouth: null, xz: null, r: Infinity, tg: t => !!o.src && !!t && t.it === o.src }, o); }

/* ---------- 文字：切頁、筆色、打字時間表 ---------- */
// 先照「｜」硬切 → 切句 → 貪心裝進頁（一般 30 字、紙 40 字，窄螢幕少一點；問句一律 40 字＝最多 3 行）→ 單句太長從最靠近中間的逗號切 → 還太長才硬切
function tkSplit(s, note) {
  const narrow = innerWidth < 420, max = note === 'ask' ? 40 : note ? (narrow ? 30 : 40) : (narrow ? 24 : 30), out = [];
  const cut = x => {
    const a = [...x]; if (a.length <= max) return [x]; let b = -1;
    a.forEach((c, i) => { if ('，、：'.includes(c) && i < a.length - 1 && (b < 0 || Math.abs(i + 1 - a.length / 2) < Math.abs(b + 1 - a.length / 2))) b = i; });
    let k = b >= 0 ? b + 1 : max; if (b < 0 && '，。、！？；」』）…～'.includes(a[k])) k++; // 硬切時標點跟著前一頁（避頭）
    if (k >= a.length) return [x]; return [...cut(a.slice(0, k).join('')), ...cut(a.slice(k).join(''))];
  };
  String(s == null ? '' : s).split('｜').forEach(part => {
    let ss = part.match(/[^。！？；…～]*(?:…+|[。！？；～]+)[」』）]?|[^。！？；…～]+$/g) || [part]; if (ss.join('') !== part) ss = [part];
    let cur = ''; ss.flatMap(cut).forEach(x => { if (cur && tkLen(cur + x) > max) { out.push(cur); cur = x; } else cur += x; }); if (cur) out.push(cur);
  });
  return out.length ? out : [''];
}
// 筆色：「」裡的名字與 ¥ 金額（含前面的 +）
function tkPen(a) {
  const out = a.map(() => false); let q = 0;
  for (let k = 0; k < a.length; k++) {
    const c = a[k]; if (c === '「') { q++; continue; } if (c === '」') { q = Math.max(0, q - 1); continue; } if (q) out[k] = true;
    if (c === '¥') { if (k > 0 && a[k - 1] === '+') out[k - 1] = true; out[k] = true; while (k + 1 < a.length && /[\d,]/.test(a[k + 1])) out[++k] = true; }
  }
  return out;
}
const tkRich = s => { const a = [...String(s)], p = tkPen(a); return a.map((c, k) => p[k] ? '<b class="p">' + esc(c) + '</b>' : esc(c)).join(''); };
// 每個字出現的時間：每字 ms，逗號、句號、刪節號、波浪號後面多停一下；整頁超過上限就等比例加快
function tkSched(a, ms, cap) {
  const t = []; let acc = 0;
  a.forEach(c => { t.push(acc); acc += ms; if ('，、'.includes(c)) acc += 110; else if ('。！？；'.includes(c)) acc += 220; else if (c === '…') acc += 160; else if (c === '～') acc += 120; });
  const last = t.length ? t[t.length - 1] : 0, k = last > cap ? cap / last : 1; return k < 1 ? t.map(v => v * k) : t;
}

/* ---------- DOM：第一次用到時建在 #hud 裡（dom.html 不用改） ---------- */
function tkInit() {
  if (TK.root) return true; const hud = document.getElementById('hud'); if (!hud) return false;
  const r = TK.root = document.createElement('div'); r.id = 'talk'; if (LOW) r.classList.add('low');
  r.innerHTML = '<div class="tkw" hidden><div class="tki"><span class="nm"><b></b><span></span><small></small></span><img class="emo" alt="" hidden>'
    + '<div class="tb say" role="status" aria-live="polite" aria-atomic="true"></div><svg class="tkt" aria-hidden="true"><path/></svg><div class="tip" hidden></div></div></div><div class="tkc" hidden></div><div class="tkb"></div>';
  hud.appendChild(r);
  const q = s => r.querySelector(s); Object.assign(TK, { el: q('.tkw'), ki: q('.tki'), tb: q('.tb'), nm: q('.nm'), nmA: q('.nm b'), nmT: q('.nm span'), nmS: q('.nm small'), emo: q('.emo'), path: q('.tkt path'), tip: q('.tip'), cEl: q('.tkc'), bEl: q('.tkb') });
  // 視窗縮放、手機轉向：重量安全區與泡泡大小；手寫字型載入完成後也重量一次（先用備用字畫）
  addEventListener('resize', () => { TK.safeN = BK.safeN = 0; tkMeasure(); BK.list.forEach(tkBkMeasure); if (TK.cards) tkCardsMeasure(); });
  try { document.fonts.load('400 18px "Slime Hand"', '月').then(() => { tkMeasure(); BK.list.forEach(tkBkMeasure); }).catch(() => { }); } catch (e) { }
  addEventListener('pointerup', () => { TK.pd = null; }); // 在卡片外面放開：清掉「按下的是哪張卡」（卡片自己的 pointerup 先跑，而且會擋住冒泡）
  return true;
}
// 每頁只量一次大小（offsetWidth 不含 transform）
function tkMeasure() {
  if (!TK.el || TK.el.hidden) return; const k = TK.ki, b = TK.tb;
  TK.w = k.offsetWidth; TK.h = k.offsetHeight; TK.bx = b.offsetLeft; TK.by = b.offsetTop; TK.bw = b.offsetWidth; TK.bh = b.offsetHeight; TK.fs = parseFloat(getComputedStyle(b).fontSize) || 17;
}

/* ---------- 流程 ---------- */
// 開口：beats＝一組拍子；o：{ more()（再聊一句，居民）, max, none（E 先不用時對方說的話）, end(why), egg }。回傳有沒有開始
function talk(who, beats, o = {}) {
  if (!who || !W.ready || TITLE.on || INTRO.on || GUI.kind || mOpen || !tkInit()) return false;
  const now = tkNow(), fromHint = !!TK.hs && TK.mw && TK.mw.id === who.id; // 提示「…」正顯示同一個人：從同一個位置撐開
  if (TK.on) tkEnd('switch', true);
  Object.assign(TK, { on: true, who, mw: who, q: (beats || []).map(tkB), i: -1, n: 0, max: o.max || 0, more: o.more || null, none: o.none || null, end: o.end || null, egg: o.egg || '',
    byed: false, st: 'type', t0: now, guardT: now + TKT.g0, idle: 0, after: null, stampTxt: '', hs: 0, hk: '', hw: null, fade: 1, safeN: 0 });
  const p = who.xz && who.xz(); TK.dmin = TK.d = p ? Math.hypot(p[0] - P.x, p[1] - P.z) : 0;
  if (!fromHint) { TK.placed = false; TK.pl = ''; TK.plBad = 0; TK.tbase = null; }
  const el = TK.el; el.hidden = false; el.className = 'tkw' + (who.k === 'note' ? ' paper' : ''); TK.offOn = false;
  TK.nmT.textContent = who.name || ''; TK.nmS.textContent = who.role || ''; TK.nmA.textContent = ''; TK.nm.style.setProperty('--c', who.col || '#e2e8f0');
  document.body.classList.add('talk');
  if (who.n) who.n.talk = Math.max(who.n.talk || 0, 2); // 居民停下、轉身面對你
  if (who.k !== 'note') tkSnd.pop();
  tkBeat(); if (!TK.on) return true;
  tkAnimStart(who.k === 'note' ? 'unfold' : 'in', who.k === 'note' ? TKT.unfold : TKT.pop);
  return true;
}
// 下一拍；拍子用完時居民再聊一句（未滿 max 句），再說道別句；店家、紙直接收起
function tkBeat() {
  const who = TK.who; TK.i++;
  if (TK.i >= TK.q.length) {
    if (TK.more && TK.n < TK.max) TK.q.push(tkB(TK.more()));
    else if (TK.more && who.n && who.bye && !TK.byed) TK.q.push({ t: who.bye, g: 'wave', last: 1 });
    else return tkEnd('done');
  }
  const b = TK.q[TK.i]; if (b.last) TK.byed = true; else TK.n++;
  TK.pg = tkSplit(b.t, b.opt ? 'ask' : who.k === 'note'); TK.nfb = null; // 問句的一頁長一點（最多 3 行）：選卡時整個問題都還看得到
  if (who.n) npcGest(who.n, tkGest(b, who));
  tkPage(0, TK.i > 0, b);
}
// 動作怎麼來：拍子寫的 g → 句尾（「？」歪頭、「！」點頭，小孩跳一下）
function tkGest(b, who) {
  if (b.g) return b.g; const c = String(b.t || '').replace(/[」』）\s]+$/, '').slice(-1);
  return c === '？' ? 'tilt' : c === '！' ? (who.kid < 1 ? 'hop' : 'nod') : '';
}
// 畫一頁：每個字一個 <i>（還沒打出來的字透明，所以泡泡大小與換行一開始就固定）
function tkPage(i, swap, b) {
  b = b || TK.q[TK.i] || { t: '' }; const who = TK.who, now = tkNow(), note = who.k === 'note', last = i === TK.pg.length - 1, a = [...(TK.pg[i] || '')], pen = tkPen(a);
  TK.pi = i; TK.p0 = now; TK.idle = 0; TK.ch = 0; TK.vc = 0; TK.vt = -1e9; TK.chs = a;
  let h = '<span class="tx">' + a.map((c, k) => (pen[k] ? '<i class="p">' : '<i>') + esc(c) + '</i>').join('') + '</span>';
  if (b.sig && last) h += '<span class="sig">' + esc(b.sig) + '</span>';
  const nx = (b.opt && last) || TK.st === 'ask' ? '' : tkNx(b, last, who); if (nx) h += '<span class="nx">' + nx + '</span>'; // 卡片舉著時 E 是「先不用」，泡泡上不放「E ▼」
  if (TK.stampTxt) h += '<span class="tks still">' + esc(TK.stampTxt) + '</span>';
  TK.tb.className = 'tb ' + (note ? 'note ' + (who.kraft ? 'kraft' : 'hand') : 'say'); TK.tb.innerHTML = h; TK.txs = TK.tb.firstChild.children;
  if (b.emo) { TK.emo.src = EMO_URL[b.emo] || (EMO_URL[b.emo] = emoTex(b.emo).image.toDataURL()); TK.emo.hidden = false; } else TK.emo.hidden = true;
  TK.el.classList.toggle('nm1', note || (TK.i === 0 && i === 0)); // 名牌：對話第一頁、每張紙每頁（貼邊時一定有）
  const tip = who.k === 'say' && (S.tipTalk || 0) < 2; TK.el.classList.toggle('tip1', tip); TK.tip.hidden = !tip; if (tip) TK.tip.textContent = TOUCH ? '點畫面繼續・走開就結束' : 'E 繼續・走開就結束'; TK.tipW = 0;
  tkMeasure();
  const o = swap ? TKT.swapType : TKT.type0; TK.tt = now + o; TK.sch = tkSched(a, who.vo ? who.vo[1] : 32, TKT.cap - o - 20); TK.ty = true; if (TK.st !== 'ask') TK.st = 'type'; // 從開口算起 1300ms 內一定打完
  if (swap) tkAnimStart('swap', TKT.swap);
  if (note) tkSnd.paper();
  if (note || RM() || !a.length) tkReveal(now); // 紙與減少動態：整頁一次出現
}
// 右下角的小膠囊：居民還能再聊＝「E 再聊」，紙的最後一頁＝「E 收起」，其他＝「E ▼」；觸控只有「▼」
function tkNx(b, last, who) {
  if (b.last) return ''; if (TOUCH) return '▼';
  if (who.k === 'note') return last ? 'E 收起' : 'E ▼';
  return last && TK.i === TK.q.length - 1 && TK.more && TK.n < TK.max ? 'E 再聊' : 'E ▼';
}
function tkType(now) {
  const e = now - TK.tt, s = TK.sch, n = s.length, vo = TK.who.vo ? TK.who.vo[0] : 1; let k = TK.ch;
  while (k < n && s[k] <= e) { TK.txs[k].classList.add('on'); if (!TK_MUTE.test(TK.chs[k]) && TK.vc++ % 2 === 0 && now - TK.vt >= 75) { TK.vt = now; tkSnd.blip(vo); } k++; } // 每 2 個字一聲嗶，標點不出聲
  TK.ch = k; if (k >= n) tkDone(now);
}
function tkReveal(now) { const x = TK.txs; for (let k = TK.ch; k < x.length; k++) x[k].classList.add('on'); TK.ch = x.length; tkDone(now); }
function tkDone(now) { TK.ty = false; TK.doneT = now; if (TK.st === 'type') TK.st = 'read'; TK.tb.classList.add('done'); if (TK.who && TK.who.n) TK.who.n.say = 0; }
function tkNext() { TK.idle = 0; if (TK.pi < TK.pg.length - 1) return tkPage(TK.pi + 1, true); tkBeat(); }
// E／點畫面：回傳 true＝對話吃掉了這次按鍵。準心對著說話的人或什麼都沒對準＝繼續；對著別的東西＝先安靜收起，再照常互動
function tkKey(t, tap) {
  if (!TK.on) return false; const now = tkNow(), who = TK.who, mine = !t || (!!who.tg && who.tg(t));
  if (!mine) { if (tap && TK.cards) { tkNudge(); return true; } tkEnd('switch', true); return false; } // 觸控：卡片舉著時點別處只晃一下，不會誤選
  if (now < TK.guardT || TK.st === 'fly' || TK.st === 'wait') return true; // 開口後 200ms、跳完整頁後 250ms、卡片飛出去的路上：不算
  if (TK.ty) { tkReveal(now); TK.guardT = now + TKT.gRev; return true; } // 打字中＝整頁出現
  if (TK.cards) { if (now < TK.armT) return true; if (tap) { tkNudge(); return true; } tkPick(TK.cards.findIndex(c => c.o.e)); return true; } // E 只選免費、可反悔的選項；沒有就是「先不用」
  const b = TK.q[TK.i]; if (b && b.opt && TK.pi === TK.pg.length - 1) { tkAsk(b.opt); return true; }
  tkNext(); return true;
}
function tkRead(dt, now) {
  const b = TK.q[TK.i] || {}, last = TK.pi === TK.pg.length - 1;
  if (b.opt && last) { if (now - TK.doneT >= TKT.ask) tkAsk(b.opt); return; } // 問句打完 150ms 後手舉起回話卡
  TK.idle += dt; // 閒置用 dt 累加：分頁切走再回來不會一回來就收掉
  if (b.last && last) { if (TK.idle > clamp(1.2 + .09 * TK.chs.length, 1.6, 3)) tkEnd('done'); return; } // 道別句讀完自己收起
  if (TK.idle > (TK.who.k === 'note' ? 25 : 14)) tkEnd('idle');
}
// 收起：why＝done／walk（走開）／switch（換人或做別的事）／quiet（開介面、彈窗、主選單、說話的人不見了）／idle／ride…
function tkEnd(why, fast) {
  if (!TK.on) return; const who = TK.who, n = who.n, end = TK.end, now = tkNow();
  TK.on = false; TK.st = ''; TK.after = null; TK.ty = false; TK.end = null; TK.endT = now; TK.hs = 0; TK.hk = ''; TK.hw = null; TK.stampTxt = '';
  tkCardsHide(); document.body.classList.remove('talk');
  tkAnimStart('out', fast ? TKT.outQ : TKT.out);
  if (n) { n.talk = 1.5; n.say = 0; } // 再看你 1.5 秒才走
  if (why === 'walk' && !TK.byed && who.bye) { bark(who, who.bye, { quiet: 1 }); if (n) npcGest(n, 'wave'); }
  if (who.k === 'say' && S) S.tipTalk = Math.min(9, (S.tipTalk || 0) + 1);
  tkMouth(0);
  if (end) { try { end(why); } catch (e) { console.error(e); } }
}
// 每格（loop，在世界畫完之後）
function tkStep(dt) {
  if (!TK.root && !TARGET) return; // 還沒有任何對話：準心沒對著東西就什麼都不做
  const now = tkNow();
  if (BK.list.length) barkStep(dt, now);
  if (TK.on) {
    const who = TK.who, n = who.n;
    if (GUI.kind || mOpen || TITLE.on || INTRO.on || (n && !(n.m.root.visible && inCity()))) tkEnd('quiet', true);
    else if (who.xz) {
      const p = who.xz(), d = TK.d = Math.hypot(p[0] - P.x, p[1] - P.z); TK.dmin = Math.min(TK.dmin, d);
      const edge = clamp(TK.dmin + 1.8, 3.2, who.r || 8); // 走開＝再見：比對話中最近時再遠 1.8 公尺（側移繞著走不會結束）
      if (d > edge) tkEnd('walk'); else TK.fade = 1 - .45 * smooth(edge - 1, edge, d); // 快到邊界時泡泡變淡
    }
  }
  if (TK.on) {
    const n = TK.who.n; if (n) { n.talk = Math.max(n.talk, 1.2); n.say = TK.ty ? 1 : 0; }
    if (TK.ty) tkType(now);
    if (TK.st === 'read') tkRead(dt, now);
    else if (TK.st === 'ask') {
      TK.idle += dt; if (now - TK.syncT >= 1000) { TK.syncT = now; tkCardsSync(); } // 錢、庫存在選卡期間變了：每秒重算
      if (TK.idle > 20) { tkCardsHide(); TK.q.splice(TK.i + 1, Infinity, { t: '慢慢想，不急～', last: 1 }); TK.st = 'read'; tkBeat(); }
    } else if ((TK.st === 'fly' || TK.st === 'wait') && now >= TK.waitT && TK.after) { const f = TK.after; TK.after = null; f(); }
  } else tkHint(now);
  if (TK.mw) tkPlace(dt, now);
  if (TK.cg.length) tkCards(dt, now);
  tkMouth(W.t);
  if (TK.root && ++TK.nightN % 30 === 1) TK.root.style.setProperty('--night', Math.max(DN.night || 0, CV.k || 0).toFixed(2)); // 夜裡、山洞深處：紙跟著環境暗一點
}

/* ---------- 擺位：字永遠完整、不擋 HUD ---------- */
// 世界座標 → 畫面像素；o.z＝在鏡頭前的距離，在背後時鏡像（同 waypointStep）
function tkProj(v, o) {
  const cam = W.cam; tkV2.copy(v).applyMatrix4(cam.matrixWorldInverse); let z = -tkV2.z; if (Math.abs(z) < 1e-4) z = -1e-4; o.z = z; tkV2.applyMatrix4(cam.projectionMatrix);
  let x = (tkV2.x * .5 + .5) * innerWidth, y = (-tkV2.y * .5 + .5) * innerHeight; if (z <= 0) { x = innerWidth - x; y = innerHeight - y; }
  o.x = x; o.y = y; return o;
}
// 安全區：上緣在錢、指南針、右上按鈕下面，下緣在快捷列上面；障礙：準心、有字的訊息、教學、體溫、觸控的搖桿區與按鈕群
function tkSafe() {
  const vw = innerWidth, vh = innerHeight, R = id => { const e = document.getElementById(id); if (!e || e.hidden) return null; const r = e.getBoundingClientRect(); return r.width > 0 && r.height > 0 ? r : null; };
  let t = 12; for (const id of ['stats', 'compass', 'topbtns']) { const r = R(id); if (r && r.bottom < vh * .5) t = Math.max(t, r.bottom + 8); }
  const bt = R('bottom'), obs = [{ x: vw / 2 - 22, y: vh / 2 - 22, w: 44, h: 44 }], add = r => { if (r) obs.push({ x: r.left, y: r.top, w: r.width, h: r.height }); };
  const lg = document.getElementById('log'); if (lg && lg.children.length) add(R('log'));
  if (!document.body.classList.contains('talk')) add(R('coach')); add(R('warm')); // 教學提示在對話中是淡出的（talk.css），不用讓
  { const r = R('cmpDeg'); if (r) obs.push({ x: r.left, y: r.top, w: r.width, h: r.height, soft: 2 }); } // 指南針下面的角度小牌：盡量不蓋到
  if (!document.body.classList.contains('talk')) { const r = R('objective'); if (r) obs.push({ x: r.left, y: r.top, w: r.width, h: r.height, soft: 2 }); } // 目標面板（對話中會淡出）：最先讓步的障礙
  { const r = R('prompt'), pw = Math.max(r ? r.width : 0, 180), py = r ? r.top : vh / 2 + 24; obs[0] = { x: vw / 2 - Math.max(22, pw / 2), y: vh / 2 - 22, w: Math.max(44, pw), h: Math.max(44, py + (r ? r.height : 30) - (vh / 2 - 22)) }; } // 準心連同下面那一行提示（「E 放回」「E 結帳」）：空著時也先留 180 px 寬，提示一出現泡泡不用跳開
  if (TOUCH) { // 觸控：搖桿區與按鈕群是「軟」障礙（盡量讓開；橫向手機實在放不下時，只避開真正的按鈕）
    ['btnAct', 'btnJump', 'btnRun', 'btnSneak'].forEach(id => { const r = R(id); if (r) obs.push({ x: r.left, y: r.top, w: r.width, h: r.height, btn: 1 }); }); // btn：一句話的尾巴也停在按鈕前面
    const sl = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--slot')) || 40; obs.push({ x: 0, y: vh * .4, w: vw * .45, h: vh * .6, soft: 1 }, { x: vw - 200, y: vh - sl - 240, w: 200, h: sl + 240, soft: 1 }); }
  return { l: 12, t, r: vw - 12, b: Math.max(t + 40, bt ? bt.top - 10 : vh - 12), obs };
}
function tkHit(x, y, w, h, obs) { for (const o of obs) if (x < o.x + o.w + 4 && x + w > o.x - 4 && y < o.y + o.h + 4 && y + h > o.y - 4) return o; return null; }
// 被障礙擋住：往障礙的上、下、左、右找最近的空位；都不行再粗略掃一遍；還是不行就只避開硬障礙（HUD、真正的按鈕）再找一次；回傳 null＝放不下
const tkDrop = (obs, k) => obs.filter(o => (o.soft || 0) < k); // k＝3 全部、2 不管目標面板、1 只剩硬障礙
function tkFit(x, y, w, h, sf, obs = sf.obs) { let n = -1; for (const k of [3, 2, 1]) { const ob = tkDrop(obs, k); if (ob.length === n) continue; n = ob.length; const r = tkFit1(x, y, w, h, sf, ob); if (r) return r; } return null; }
function tkFit1(x, y, w, h, sf, obs) {
  const ok = (a, b) => a >= sf.l - .5 && b >= sf.t - .5 && a + w <= sf.r + .5 && b + h <= sf.b + .5 && !tkHit(a, b, w, h, obs);
  if (ok(x, y)) return [x, y]; let best = null, bd = 1e9;
  const tryAt = (a, b) => { a = clamp(a, sf.l, Math.max(sf.l, sf.r - w)); b = clamp(b, sf.t, Math.max(sf.t, sf.b - h)); if (ok(a, b)) { const d = Math.abs(a - x) + Math.abs(b - y); if (d < bd) { bd = d; best = [a, b]; } } };
  for (const o of obs) { tryAt(x, o.y - h - 6); tryAt(x, o.y + o.h + 6); tryAt(o.x - w - 6, y); tryAt(o.x + o.w + 6, y); }
  if (!best) for (let i = 0; i <= 6; i++) for (let j = 0; j <= 8; j++) tryAt(sf.l + (sf.r - sf.l - w) * i / 6, sf.t + (sf.b - sf.t - h) * j / 8);
  return best;
}
function tkCand(A, M, bw, bh, s, mid) {
  if (mid) { TK_CK[0][1] = A.x - bw / 2; TK_CK[0][2] = A.y - bh - 8; }
  const C = TK_C; C[0][1] = A.x - 28 * s; C[0][2] = A.y - bh - 8; C[1][1] = A.x - bw + 28 * s; C[1][2] = A.y - bh - 8;
  C[2][1] = M.x + 44 * s; C[2][2] = M.y - .6 * bh; C[3][1] = M.x - bw - 44 * s; C[3][2] = M.y - .6 * bh; return mid ? TK_CK : C;
}
// 從四個候選挑第一個整塊在安全區裡、不碰障礙的；目前的位置還可以就不換，失效超過 250ms 才換（居民轉身、走動時泡泡不會左右亂跳）
// tp＝嘴巴在畫面上的位置（一句話的泡泡才給）：尾巴會穿過畫面上另一個泡泡（obs 裡 bub 的）的位置也不要，換下一個候選
function tkChoose(o, C, sf, bw, bh, now, obs = sf.obs, tp) {
  const bs = tp ? obs.filter(q => q.bub) : null, tailOK = c => !bs || !bs.length || tkSeg(clamp(tp.x, c[1] + 22, c[1] + bw - 22), clamp(tp.y, c[2], c[2] + bh), tp.x, tp.y, bs, 4) >= 1;
  const fits = c => c[1] >= sf.l && c[2] >= sf.t && c[1] + bw <= sf.r && c[2] + bh <= sf.b && !tkHit(c[1], c[2], bw, bh, obs) && tailOK(c);
  const cur = o.pl && C.find(c => c[0] === o.pl);
  if (cur && fits(cur)) { o.plBad = 0; return [cur[1], cur[2]]; }
  if (cur) {
    const x = clamp(cur[1], sf.l, Math.max(sf.l, sf.r - bw)), y = clamp(cur[2], sf.t, Math.max(sf.t, sf.b - bh)); if (!o.plBad) o.plBad = now;
    if (now - o.plBad < 250 && !tkHit(x, y, bw, bh, obs)) return [x, y];
  }
  o.plBad = 0; const c = C.find(fits); if (c) { o.pl = c[0]; return [c[1], c[2]]; }
  o.pl = C[0][0]; const x = clamp(C[0][1], sf.l, Math.max(sf.l, sf.r - bw)), y = clamp(C[0][2], sf.t, Math.max(sf.t, sf.b - bh)); return tkFit(x, y, bw, bh, sf, obs) || [x, y]; // 都不行：把第一個（右上）夾進安全區
}
// 貼邊：說話的人在鏡頭後面或畫面外，從畫面中心往他的方向找安全區邊上的點（同 waypointStep 的 kx／ky）
function tkPin(A, sf, bw, bh, obs = sf.obs) {
  const cx = innerWidth / 2, cy = innerHeight / 2; let dx = A.x - cx, dy = A.y - cy; if (Math.abs(dx) + Math.abs(dy) < 1) dy = 1;
  if (A.z < .05) dy = Math.max(Math.abs(dy), innerHeight * .25); // 在你背後：貼在下緣或左右（名牌標「↓」＝在你後面），不要貼到上面
  const l = sf.l + bw / 2, r = Math.max(l, sf.r - bw / 2), t = sf.t + bh / 2, b = Math.max(t, sf.b - bh / 2);
  const kx = dx > 0 ? (r - cx) / dx : dx < 0 ? (l - cx) / dx : 1e9, ky = dy > 0 ? (b - cy) / dy : dy < 0 ? (t - cy) / dy : 1e9, k = Math.max(0, Math.min(kx, ky));
  let x = clamp(cx + dx * k, l, r) - bw / 2, y = clamp(cy + dy * k, t, b) - bh / 2; let f = tkFit(x, y, bw, bh, sf, obs);
  const wrong = p => Math.abs(dx) > Math.abs(dy) && Math.sign(p[0] + bw / 2 - cx) !== Math.sign(dx); // 名牌寫「→」泡泡卻跑到左邊：先放寬小障礙，盡量留在他那一側
  if (f && wrong(f)) { const g = tkFit(x, y, bw, bh, sf, tkDrop(obs, 2)); if (g && !wrong(g)) f = g; }
  if (f) { x = f[0]; y = f[1]; }
  const L = Math.hypot(dx, dy); return [x, y, dx / L, dy / L];
}
// 手掌在畫面上的位置（手看不到時用右下角的固定點）
function tkHandPt(o) {
  if (VM.g && VM.g.visible && VM.palm) { VM.palm.getWorldPosition(tkV3); tkProj(tkV3, o); if (o.z > 0) return o; }
  o.x = innerWidth * .72; o.y = innerHeight * .74; o.z = 1; return o;
}
// 拿在手上的紙：桌機跟著手掌（紙的右下角在手掌左上方 36px）；觸控置中，從快捷列上方往上找第一個不碰拇指的位置
function tkHandSpot(sf, bw, bh) {
  if (!TOUCH) { const h = tkHandPt(PH), x = clamp(h.x - 36 - bw, sf.l, Math.max(sf.l, sf.r - bw)), y = clamp(h.y - 36 - bh, sf.t, Math.max(sf.t, sf.b - bh)); return tkFit(x, y, bw, bh, sf) || [x, y]; }
  const x = clamp((innerWidth - bw) / 2, sf.l, Math.max(sf.l, sf.r - bw)); for (let y = sf.b - bh; y >= sf.t; y -= 12) if (!tkHit(x, y, bw, bh, sf.obs)) return [x, y]; return tkFit(x, sf.t, bw, bh, sf) || [x, sf.t];
}
// 主泡泡（對話或提示）的位置、大小、透明度與尾巴。每格只寫 transform、opacity 與尾巴的 path
function tkPlace(dt, now) {
  const who = TK.mw, el = TK.el; if (!who || !el || el.hidden) return;
  const A = tkAV(TK.a, now); if (A && A[3]) { const k = TK.a.k; TK.a = null; if (k === 'out') { el.hidden = true; TK.mw = null; TK.ki.style.transform = ''; TK.kiT = ''; TK.trs = ''; return; } }
  if (--TK.safeN <= 0 || !TK.safe) { TK.safeN = 30; TK.safe = tkSafe(); }
  const sf = TK.safe; let s = 1;
  if (who.xz) { const p = who.xz(); s = clamp(2.6 / Math.max(.3, Math.hypot(p[0] - P.x, p[1] - P.z)), .9, 1.06); } // 近一點字大一點，遠一點小一點
  s = Math.max(s, 15.5 / (TK.fs || 17)); TK.s = s; // 實際字級最小 15.5px
  const bw = TK.w * s, bh = TK.h * s; let x, y, off = false, dir = null;
  if (who.at) {
    who.at(tkV); tkProj(tkV, PA); who.mouth(tkV); tkProj(tkV, PM);
    off = PA.z < .05 || PA.x < -40 || PA.x > innerWidth + 40 || PA.y < -40 || PA.y > innerHeight + 40;
    const obs = TK.cards && TK.crect ? sf.obs.concat([TK.crect]) : sf.obs; // 回話卡舉著時也要讓開
    if (off) { const r = tkPin(PA, sf, bw, bh, obs); x = r[0]; y = r[1]; dir = [r[2], r[3]]; } else [x, y] = tkChoose(TK, tkCand(PA, PM, bw, bh, s, who.kraft), sf, bw, bh, now, obs);
  } else [x, y] = tkHandSpot(sf, bw, bh);
  if (!TK.placed || Math.abs(x - TK.x) > 160 || Math.abs(y - TK.y) > 160) { TK.x = x; TK.y = y; TK.placed = true; } // 快速轉頭：直接跳過去
  else { const k = 1 - Math.exp(-18 * dt); TK.x += (x - TK.x) * k; TK.y += (y - TK.y) * k; }
  const tr = 'translate3d(' + TK.x.toFixed(1) + 'px,' + TK.y.toFixed(1) + 'px,0) scale(' + s.toFixed(3) + ')'; if (tr !== TK.trs) { TK.trs = tr; el.style.transform = tr; }
  const op = ((A ? A[2] : 1) * (TK.on ? TK.fade : 1)).toFixed(3); if (op !== TK.ops) { TK.ops = op; el.style.opacity = op; }
  const kt = A ? 'scale(' + A[0].toFixed(3) + ',' + A[1].toFixed(3) + ')' : ''; if (kt !== TK.kiT) { TK.kiT = kt; TK.ki.style.transform = kt; }
  if (off !== TK.offOn) { TK.offOn = off; el.classList.toggle('off', off); }
  const ar = off ? (Math.abs(dir[0]) >= Math.abs(dir[1]) ? (dir[0] < 0 ? '←' : '→') : (dir[1] < 0 ? '↑' : '↓')) : ''; if (ar !== TK.nmA.textContent) TK.nmA.textContent = ar; // 貼邊時名牌標方向：「← 美美」
  let d = '';
  if (who.at && who.k === 'say') {
    let tx, ty; if (off) { const cx = TK.bx + TK.bw / 2, cy = TK.by + TK.bh / 2, k = Math.min(TK.bw / 2 / Math.max(1e-3, Math.abs(dir[0])), TK.bh / 2 / Math.max(1e-3, Math.abs(dir[1]))); tx = cx + dir[0] * (k + 30); ty = cy + dir[1] * (k + 30); }
    else { tx = (PM.x - TK.x) / s; ty = (PM.y - TK.y) / s; }
    const tl = tkTail(TK, tx, ty, off, TK.hs && !TK.on ? 48 : 110 * Math.max(1, innerHeight / 800)); if (tl) { d = tl.d; TK.tbase = [tl.bx, tl.by]; } // 提示「…」的尾巴短一點，不要劃過說話的人的臉；大螢幕上人比較大，尾巴上限跟著放長
    tkTipSide(tl, s);
  }
  if (d !== TK.pd2) { TK.pd2 = d; TK.path.setAttribute('d', d); }
}
// 泡泡底下的操作提示（前兩次對話）：尾巴從底邊往下伸時會劃過置中的字，改放到尾巴根部的另一側（尾巴往左斜就放右邊），夾在畫面內
function tkTipSide(tl, s) {
  const tp = TK.tip; if (!tp || tp.hidden) return; let lf = '';
  if (tl && tl.down) {
    const w = TK.tipW || (TK.tipW = tp.offsetWidth), right = tl.vx < -.2 || (tl.vx <= .2 && tl.bx < TK.bx + TK.bw / 2);
    lf = clamp(right ? tl.bx + 16 : tl.bx - 16 - w, (6 - TK.x) / s, (innerWidth - 6 - TK.x) / s - w).toFixed(0) + 'px';
  }
  if (lf !== TK.tipL) { TK.tipL = lf; tp.style.left = lf; tp.classList.toggle('side', !!lf); }
}
// 線段 (x0,y0)→(x1,y1) 第一次碰到矩形群 bs（外擴 m px：尾巴是往一側彎的弧線）的位置（0～1；沒碰到＝1）
function tkSeg(x0, y0, x1, y1, bs, m = 3) {
  let best = 1; const dx = x1 - x0, dy = y1 - y0;
  for (const o of bs) { let t0 = 0, t1 = 1; const ok = [[-dx, x0 - (o.x - m)], [dx, o.x + o.w + m - x0], [-dy, y0 - (o.y - m)], [dy, o.y + o.h + m - y0]].every(([p, q]) => { if (Math.abs(p) < 1e-9) return q >= 0; const r = q / p; if (p < 0) { if (r > t1) return false; if (r > t0) t0 = r; } else { if (r < t0) return false; if (r < t1) t1 = r; } return true; }); if (ok && t0 < best) best = t0; }
  return best;
}
// 泡泡 b 擺在 (x, y)、縮放 s；(tx, ty)＝尾巴要指的點（泡泡本身的座標）。尾巴會穿過已經擺好的泡泡本體 boxes：縮短到它前面，太短就不畫
function tkTailCap(b, x, y, s, tx, ty, pin, max, boxes) {
  const tl = tkTail(b, tx, ty, pin, max); if (!tl || !boxes.length) return tl;
  const bx = x + tl.bx * s, by = y + tl.by * s, gx = x + tx * s, gy = y + ty * s, L0 = Math.hypot(gx - bx, gy - by); if (L0 < 1) return tl;
  const w0 = (pin ? Math.min(24, max) : Math.min(max, L0 / s - 12)) * s, k = tkSeg(bx, by, bx + (gx - bx) / L0 * w0, by + (gy - by) / L0 * w0, boxes, 8); if (k >= 1) return tl;
  const m2 = (w0 * k - 4) / s; return m2 >= 8 ? tkTail(b, tx, ty, pin, m2) : null;
}
// 尾巴：紙色＋墨線的彎尖角，底寬 20px、最長 110px、尖端離嘴 12px；底邊伸進泡泡裡，用紙色蓋住接縫。pin＝貼邊時的小楔形
function tkTail(L, tx, ty, pin, max = 110) {
  const x0 = L.bx, y0 = L.by, w = L.bw, h = L.bh; let bx, by, nx = 1, ny = 0;
  if (ty > y0 + h - 6 && tx > x0 - 40 && tx < x0 + w + 40) { bx = clamp(tx, x0 + 22, x0 + w - 22); by = y0 + h - 3; }
  else if (tx < x0) { bx = x0 + 3; by = clamp(ty, y0 + 14, y0 + h - 14); nx = 0; ny = 1; }
  else if (tx > x0 + w) { bx = x0 + w - 3; by = clamp(ty, y0 + 14, y0 + h - 14); nx = 0; ny = 1; }
  else if (ty < y0) { bx = clamp(tx, x0 + 22, x0 + w - 22); by = y0 + 3; }
  else if (ty > y0 + h - 6) { bx = clamp(tx, x0 + 22, x0 + w - 22); by = y0 + h - 3; }
  else return null;
  let vx = tx - bx, vy = ty - by; const len = Math.hypot(vx, vy); if (len < 10) return null; vx /= len; vy /= len;
  const want = pin ? Math.min(24, max) : Math.min(max, len - 12); if (want < 8) return null;
  const ex = bx + vx * want, ey = by + vy * want, hw = pin ? 9 : 10, ax = bx - nx * hw, ay = by - ny * hw, cx = bx + nx * hw, cy = by + ny * hw, px = -vy * want * .16, py = vx * want * .16, f = v => v.toFixed(1);
  return { d: 'M' + f(ax) + ' ' + f(ay) + 'Q' + f((ax + ex) / 2 + px) + ' ' + f((ay + ey) / 2 + py) + ' ' + f(ex) + ' ' + f(ey) + 'Q' + f((cx + ex) / 2 + px * .4) + ' ' + f((cy + ey) / 2 + py * .4) + ' ' + f(cx) + ' ' + f(cy), bx, by, vx, down: ny === 0 && vy > 0 };
}
// 泡泡的彈出、換句、收起：套在內層 .tki，transform-origin 在尾巴根部（看起來是從嘴邊長出來）。用 tkNow 算，TK.fz 停得住
function tkAnimStart(k, d) {
  const rm = RM(); if (rm && k === 'swap') return; TK.a = { k, t0: tkNow(), d: rm ? TKT.rm : d, rm };
  TK.ki.style.transformOrigin = k === 'unfold' ? '50% 15px' : TK.tbase ? TK.tbase[0].toFixed(1) + 'px ' + TK.tbase[1].toFixed(1) + 'px' : '30% 100%';
}
function tkAV(a, now) { // → [scaleX, scaleY, opacity, 結束了沒]
  if (!a) return null; const e = Math.max(0, now - a.t0), k = clamp(e / a.d, 0, 1), done = k >= 1;
  if (a.rm) return [1, 1, a.k === 'out' ? 1 - k : k, done]; // 減少動態：只淡入淡出
  if (a.k === 'in') { const s = e < TKT.popUp ? .55 + .49 * (1 - (1 - e / TKT.popUp) ** 2) : 1.04 - .04 * clamp((e - TKT.popUp) / (a.d - TKT.popUp), 0, 1); return [s, s, clamp(e / TKT.popFade, 0, 1), done]; }
  if (a.k === 'unfold') { const u = 1 - (1 - k) ** 3; return [1, .2 + .8 * u, clamp(e / 80, 0, 1), done]; } // 紙攤開
  if (a.k === 'swap') { const sy = e < 70 ? 1 - .06 * (e / 70) : .94 + .06 * clamp((e - 70) / 70, 0, 1); return [1, sy, 1, done]; }
  const s = 1 - .45 * k; return [s, s, 1 - k, done]; // out：縮回尾巴根部
}

/* ---------- 回話卡：拿在手上，最多 2 張 ---------- */
function tkAsk(list) {
  if (TK.cards || !TK.on) return; const now = tkNow(), c = TK.cEl; TK.cg.forEach(x => x.el.remove()); TK.cg = [];
  TK.st = 'ask'; TK.idle = 0; TK.syncT = now; TK.armT = now + TKT.arm; c.innerHTML = ''; c.hidden = false; c.style.transform = '';
  const row = document.createElement('div'); row.className = 'row'; c.appendChild(row); const L = list.slice(0, 2), hasE = L.some(o => o.e);
  TK.cards = L.map((o, i) => {
    const b = document.createElement('button'); b.type = 'button'; b.tabIndex = -1; b.className = 'tcard' + (o.e ? ' e' : '');
    b.innerHTML = '<span class="k">' + (o.e ? 'E' : i + 1) + '</span><span class="t"></span><small></small>';
    // 同一張卡上按下、放開才算選（按著拖到外面放開＝不選）；卡片吃掉觸控，不會啟動搖桿
    b.addEventListener('pointerdown', e => { e.preventDefault(); e.stopPropagation(); TK.pd = { i, id: e.pointerId }; try { b.releasePointerCapture(e.pointerId); } catch (_) { } });
    b.addEventListener('pointerup', e => { e.stopPropagation(); const p = TK.pd; TK.pd = null; const r = b.getBoundingClientRect(); if (p && p.i === i && p.id === e.pointerId && e.clientX >= r.left && e.clientX <= r.right && e.clientY >= r.top && e.clientY <= r.bottom) tkPick(i); });
    b.addEventListener('click', e => { e.preventDefault(); e.stopPropagation(); });
    row.appendChild(b); const card = { o, el: b, i, n: L.length, t0: now + i * TKT.rise2, ok: null, fly: 0, drop: 0, nud: 0, fx: 0, fy: 0 }; TK.cg.push(card); return card;
  });
  if (!hasE) { const n = document.createElement('div'); n.className = 'tkn'; n.textContent = TOUCH ? '走開＝先不用' : 'E 先不用'; c.appendChild(n); }
  tkCardsSync(); tkCardsMeasure(); tkCards(0, now);
}
function tkCardsMeasure() { const c = TK.cEl; TK.cw = c.offsetWidth; TK.chh = c.offsetHeight; TK.safeN = 0; if (TOUCH) { const r = c.getBoundingClientRect(); TK.crect = { x: r.left, y: r.top, w: r.width, h: r.height }; } } // 觸控的卡片位置由 CSS 決定：量一次就好
// 每秒重算一次能不能選（網站成交進帳時，卡片從虛線變回可選）
function tkCardsSync() {
  if (!TK.cards) return;
  TK.cards.forEach(c => { let ok = true; try { ok = !c.o.ok || !!c.o.ok(); } catch (e) { ok = false; } if (ok === c.ok) return; c.ok = ok; c.el.classList.toggle('off', !ok); c.el.querySelector('.t').textContent = c.o.t; const sm = c.el.querySelector('small'); sm.textContent = ok ? (c.o.sub || '') : [c.o.sub, c.o.no].filter(Boolean).join('・'); sm.hidden = !sm.textContent; });
}
const tkBack = k => { const c1 = 1.70158, c3 = c1 + 1; return 1 + c3 * (k - 1) ** 3 + c1 * (k - 1) ** 2; };
// 卡片的位置與動畫（桌機：整組跟著手掌、排成小扇形；觸控：位置交給 CSS，這裡只做動畫）
function tkCards(dt, now) {
  const L = TK.cg, rm = RM(), fan = !TOUCH && !rm;
  if (TK.cards && !TOUCH) {
    const sf = TK.safe || (TK.safe = tkSafe()), gw = TK.cw || 0, gh = TK.chh || 0; let gx, gy;
    if (rm) { gx = sf.r - gw - 60; gy = sf.b - gh; } else { const h = tkHandPt(PH); gx = h.x + 40 - gw; gy = h.y - 24 - gh; } // 卡片群右下角在手掌右下一點：看起來是手舉著卡
    gx = clamp(gx, 12, Math.max(12, innerWidth - 12 - gw)); gy = clamp(gy, sf.t, Math.max(sf.t, sf.b - gh));
    const tr = 'translate3d(' + gx.toFixed(1) + 'px,' + gy.toFixed(1) + 'px,0)'; if (tr !== TK.cTr) { TK.cTr = tr; TK.cEl.style.transform = tr; } TK.crect = { x: gx, y: gy, w: gw, h: gh };
  }
  for (let j = L.length - 1; j >= 0; j--) {
    const c = L[j], m = c.i - (c.n - 1) / 2; let x = 0, y = fan ? Math.abs(m) * 6 : 0, r = fan ? m * 8 - 3 : 0, s = 1, op = 1; const kr = clamp((now - c.t0) / TKT.rise, 0, 1);
    if (rm) op = clamp((now - c.t0) / TKT.rm, 0, 1); else { const e = tkBack(kr); s = .4 + .6 * e; r = -20 + (r + 20) * e; y += (1 - e) * 28; op = clamp(kr * 3, 0, 1); } // 從掌心升起
    if (c.nud) { const k = (now - c.nud) / TKT.nudge; if (k >= 1) c.nud = 0; else if (!rm) x += Math.sin(k * Math.PI * 4) * 7 * (1 - k); } // 晃一下
    if (c.fly) { const k = clamp((now - c.fly) / TKT.fly, 0, 1), e = k * k * (3 - 2 * k); if (rm) op = 1 - k; else { x += c.fx * e; y += c.fy * e; r += 12 * k; s *= 1 - .4 * k; op = 1 - k * k; } if (k >= 1) { c.el.remove(); L.splice(j, 1); continue; } } // 飛向對方的泡泡
    else if (c.drop) { const k = clamp((now - c.drop) / TKT.drop, 0, 1); op *= 1 - k; if (!rm) y += 36 * k; if (k >= 1) { c.el.remove(); L.splice(j, 1); continue; } } // 落回手裡
    const tr = rm ? '' : 'translate3d(' + x.toFixed(1) + 'px,' + y.toFixed(1) + 'px,0) rotate(' + r.toFixed(2) + 'deg) scale(' + s.toFixed(3) + ')'; if (c.tr !== tr) { c.tr = tr; c.el.style.transform = tr; }
    const os = op.toFixed(3); if (c.os !== os) { c.os = os; c.el.style.opacity = os; }
  }
  if (!L.length && !TK.cards) { TK.cEl.hidden = true; TK.cEl.innerHTML = ''; TK.cTr = ''; }
}
// 選卡：-1＝先不用；不能選＝晃一下、對方說 nf 那句、卡片留在手上；可以選＝卡片飛出去，飛完（220ms）才執行 f()
function tkPick(i) {
  if (!TK.on || TK.st !== 'ask' || !TK.cards) return; const now = tkNow(); if (now < TK.armT) return; TK.idle = 0;
  if (i < 0) { tkCardsHide(); const nb = TK.none ? [].concat(TK.none).map(tkB) : []; if (!nb.length) return tkEnd('done'); nb[nb.length - 1].last = 1; TK.q.splice(TK.i + 1, Infinity, ...nb); TK.st = 'read'; return tkBeat(); }
  const c = TK.cards[i]; if (!c || c.fly) return;
  let ok = true; try { ok = !c.o.ok || !!c.o.ok(); } catch (e) { ok = false; } // 選的那一刻再確認一次
  if (!ok) { c.ok = null; tkCardsSync(); c.nud = now; tkSnd.no(); if (c.o.nf && c.o.nf.length) { const b = tkB(c.o.nf[0]); TK.pg = tkSplit(b.t, false); TK.nfb = b; tkPage(0, true, b); if (TK.who.n) npcGest(TK.who.n, tkGest(b, TK.who)); } return; }
  tkSnd.fwip(); const r = c.el.getBoundingClientRect(), tb = TK.tbase || [TK.bx + TK.bw / 2, TK.by + TK.bh]; c.fx = TK.x + tb[0] * TK.s - (r.left + r.width / 2); c.fy = TK.y + tb[1] * TK.s - (r.top + r.height / 2); c.fly = now;
  TK.cards.forEach(o => { if (o !== c) o.drop = now; }); const n = TK.cEl.querySelector('.tkn'); if (n) n.remove();
  TK.st = 'fly'; TK.waitT = now + TKT.fly;
  TK.after = () => { // 途中走開、開介面：TK.after 被清掉，什麼都不做——不會只做一半
    TK.cards = null; let res; try { res = c.o.f ? c.o.f() : undefined; } catch (e) { console.error(e); }
    if (!TK.on) return; // f 自己收起了（例如計程車）
    if (Array.isArray(res) && res.length) { TK.q.splice(TK.i + 1, Infinity, ...res.map(tkB)); TK.st = 'wait'; TK.waitT = tkNow() + TKT.wait; if (TK.who.n) npcGest(TK.who.n, 'nod'); TK.after = () => { TK.st = 'read'; tkBeat(); }; }
    else tkEnd('done');
  };
}
function tkNudge() { const now = tkNow(); (TK.cards || []).forEach(c => { if (!c.fly) c.nud = now; }); }
function tkCardsHide() { const now = tkNow(); TK.cg.forEach(c => { if (!c.fly && !c.drop) c.drop = now; }); TK.cards = null; const n = TK.cEl && TK.cEl.querySelector('.tkn'); if (n) n.remove(); }
// 第一人稱的手：舉著回話卡＝fan、讀手上的紙＝hold（這兩種時手上拿的東西縮進掌心）
function tkPose() { return TK.cards && (TK.st === 'ask' || TK.st === 'fly') ? 'fan' : TK.on && TK.who && TK.who.k === 'note' && !TK.who.at ? 'hold' : ''; }

/* ---------- 一句話、想法雲、章 ---------- */
// 不佔按鍵的一句話：最多 2 個，新的擠掉最舊的。o：{ egg（章要蓋在這裡）, stamp（直接附章）, quiet（不出聲）, pin（說話的人在畫面外時貼在邊上，不消失：店員在你背後回答） }
function bark(who, text, o = {}) {
  if (!who || !text || !W.ready || TITLE.on || GUI.kind || !tkInit()) return null; // 介面開著、主選單：直接丟掉
  const now = tkNow(), self = who.k === 'self'; if (!self) BK.list.filter(b => b.who === who).forEach(tkBkKill); // 同一個人一次只說一句：新的一句換掉他上一句（兩個泡泡疊在一起時，後一句的尾巴會穿過前一句的字）
  while (BK.list.length >= 2) tkBkKill(BK.list[0]);
  const el = document.createElement('div'); el.className = 'bkw' + (self ? ' self' : '') + (o.cls ? ' ' + o.cls : ''); // o.cls：店員的一句話字大一點（app/game.css）
  el.innerHTML = '<div class="tki"><div class="tb ' + (self ? 'self' : 'bark') + '">' + tkRich(text) + '</div>' + (self ? '' : '<svg class="tkt" aria-hidden="true"><path/></svg>') + '</div>'; el.style.opacity = '0'; el.firstChild.style.transformOrigin = self ? '50% 100%' : '30% 100%';
  TK.bEl.appendChild(el);
  const n = tkLen(text), b = { who, el, ki: el.firstChild, tb: el.querySelector('.tb'), path: el.querySelector('path'), t0: now, egg: o.egg || '', pin: !!o.pin, pl: '', plBad: 0, placed: false, x: 0, y: 0, s: 1,
    dur: self ? clamp(1800 + 100 * n, 2400, 6000) + (o.egg || o.stamp ? 800 : 0) : clamp(1200 + 100 * n, 1600, 4200) };
  tkBkMeasure(b); BK.list.push(b); BK.safeN = 0;
  if (o.stamp) setTimeout(() => { if (BK.list.includes(b)) tkStampOn(b, o.stamp); }, TKT.stamp);
  if (!self && !o.quiet) tkSnd.pop(.6);
  return b;
}
function tkBkMeasure(b) { b.w = b.ki.offsetWidth; b.h = b.ki.offsetHeight; b.bx = b.tb.offsetLeft; b.by = b.tb.offsetTop; b.bw = b.tb.offsetWidth; b.bh = b.tb.offsetHeight; }
function tkBkKill(b) { const i = BK.list.indexOf(b); if (i >= 0) BK.list.splice(i, 1); b.el.remove(); }
function barkStep(dt, now) {
  if (--BK.safeN <= 0 || !BK.safe) { BK.safeN = 30; BK.safe = tkSafe(); } const sf = BK.safe, vw = innerWidth, vh = innerHeight, rm = RM();
  const obs = sf.obs.slice(); if (TK.mw && TK.el && !TK.el.hidden) obs.push({ x: TK.x, y: TK.y, w: TK.w * TK.s, h: TK.h * TK.s }); if (TK.cards && TK.crect) obs.push(TK.crect);
  if (typeof WARE !== 'undefined' && WARE.h && WARE.R) obs.push(WARE.R); // 店裡拿在手上的吊牌卡（game.js）：泡泡讓開
  const boxes = TK.mw && TK.el && !TK.el.hidden ? [{ x: TK.x + TK.bx * TK.s, y: TK.y + TK.by * TK.s, w: TK.bw * TK.s, h: TK.bh * TK.s }] : []; // 對話泡泡的本體（一句話的尾巴不穿過它的字）
  let stack = sf.b; // 想法雲：疊在快捷列上方中間，新的在上面
  for (const b of BK.list.slice()) {
    const e = now - b.t0; if (e > b.dur + 220 || GUI.kind || TITLE.on) { tkBkKill(b); continue; }
    let op = e > b.dur ? 1 - (e - b.dur) / 220 : rm ? clamp(e / TKT.rm, 0, 1) : clamp(e / TKT.popFade, 0, 1), sc = rm || e >= TKT.pop ? 1 : e < TKT.popUp ? .55 + .49 * (e / TKT.popUp) : 1.04 - .04 * ((e - TKT.popUp) / (TKT.pop - TKT.popUp)), x, y;
    if (b.who.k === 'self') {
      x = clamp((vw - b.w) / 2, sf.l, Math.max(sf.l, sf.r - b.w));
      const up = ob => { let yy = Math.min(stack, sf.b) - b.h; for (let g = 0; g < 8; g++) { const o = tkHit(x, yy, b.w, b.h, ob); if (!o) break; yy = o.y - b.h - 6; } return yy; }; // 碰到主泡泡、訊息、拇指區就往上推
      y = up(obs); if (y < sf.t) y = up(tkDrop(obs, 2)); if (y < sf.t) y = up(tkDrop(obs, 1)); // 放不下：先不管目標面板，再不行只讓開真正的按鈕
      y = Math.max(sf.t, y); stack = y - 6; b.x = x; b.y = y; b.box = op > 0 ? { x, y, w: b.w, h: b.h } : null;
    } else {
      const w = b.who; if (!w.at) { tkBkKill(b); continue; }
      w.at(tkV); tkProj(tkV, PA); w.mouth(tkV); tkProj(tkV, PM); const p = w.xz ? w.xz() : null, dist = p ? Math.hypot(p[0] - P.x, p[1] - P.z) : 0;
      const off = PA.z < .05 || PA.x < 0 || PA.x > vw || PA.y < 0 || PA.y > vh; let dir = null;
      if ((off && !b.pin) || dist > 12) op = 0; // 說話的人不在畫面內或太遠：不顯示（pin：貼在畫面邊上，尾巴指向他那一側）
      const s = b.s = clamp(2.6 / Math.max(.3, dist), .9, 1.06), bw = b.w * s, bh = b.h * s;
      if (off && b.pin) { const r = tkPin(PA, sf, bw, bh, obs); x = r[0]; y = r[1]; dir = [r[2], r[3]]; } else [x, y] = tkChoose(b, tkCand(PA, PM, bw, bh, s), sf, bw, bh, now, obs, PM);
      if (!b.placed || Math.abs(x - b.x) > 160 || Math.abs(y - b.y) > 160) { b.x = x; b.y = y; b.placed = true; } else { const k = 1 - Math.exp(-18 * dt); b.x += (x - b.x) * k; b.y += (y - b.y) * k; }
      x = b.x; y = b.y; if (op > 0) obs.push({ x, y, w: bw, h: bh, bub: 1 }); // 後面的一句話讓開這一句（兩個店員的泡泡、貼邊時不疊在一起）
      if (dir) { const cx = b.bx + b.bw / 2, cy = b.by + b.bh / 2, k = Math.min(b.bw / 2 / Math.max(1e-3, Math.abs(dir[0])), b.bh / 2 / Math.max(1e-3, Math.abs(dir[1]))); b.tq = [x, y, s, cx + dir[0] * (k + 30), cy + dir[1] * (k + 30), true, 24]; }
      else b.tq = [x, y, s, (PM.x - x) / s, (PM.y - y) / s, false, 110 * Math.max(1, vh / 800)];
      b.box = op > 0 ? { x: x + b.bx * s, y: y + b.by * s, w: b.bw * s, h: b.bh * s } : null;
    }
    const tr = 'translate3d(' + x.toFixed(1) + 'px,' + y.toFixed(1) + 'px,0) scale(' + b.s.toFixed(3) + ')'; if (tr !== b.tr) { b.tr = tr; b.el.style.transform = tr; }
    const kt = sc !== 1 ? 'scale(' + sc.toFixed(3) + ')' : ''; if (kt !== b.kt) { b.kt = kt; b.ki.style.transform = kt; } // 彈出：從尾巴那一側長出來
    const os = op.toFixed(3); if (os !== b.os) { b.os = os; b.el.style.opacity = os; }
  }
  // 尾巴等全部的泡泡都擺好才畫：不穿過任何另一個泡泡（或對話泡泡）的字——前面的泡泡尾巴也不會伸進後面那一個底下
  for (const b of BK.list) {
    if (!b.path) continue; let d = '';
    if (b.tq) { const q = b.tq, bs = boxes.concat(BK.list.filter(o => o !== b && o.box).map(o => o.box), sf.obs.filter(o => o.btn)), tl = tkTailCap(b, q[0], q[1], q[2], q[3], q[4], q[5], q[6], bs); if (tl) d = tl.d; b.tq = null; }
    if (d !== b.pd) { b.pd = d; b.path.setAttribute('d', d); }
  }
}
// 彩蛋的章「✦ 小秘密 n/28」：蓋在旁白的想法雲、正在讀的紙或說話的人的泡泡上（400ms 後蓋下去）；都沒有就冒一朵只有一行的想法雲
function tkStamp(id, txt, name) {
  setTimeout(() => { // 等目前這段程式跑完（例如 Leo 認出你之後馬上開口）再找要蓋在哪裡
    const host = tkStampHost(id);
    if (host) setTimeout(() => { const h = tkStampHost(id); if (h) tkStampOn(h, txt); }, TKT.stamp);
    else bark(SELF, '發現小秘密「' + name + '」', { egg: id, stamp: txt });
  }, 0);
}
function tkStampHost(id) { if (TK.on && (TK.egg === id || (TK.q[TK.i] && TK.q[TK.i].egg === id))) return TK; return BK.list.find(b => b.egg === id) || null; }
function tkStampOn(h, txt) {
  if (h === TK) { if (TK.stampTxt === txt) return; TK.stampTxt = txt; } else if (h.tb.querySelector('.tks')) return;
  const e = document.createElement('span'); e.className = 'tks'; e.textContent = txt; h.tb.appendChild(e); tkSnd.stamp();
}
// 錢包彈一下（交貨、買東西、看醫生）
function tkBump(sel) { const e = document.querySelector(sel); if (!e || RM()) return; e.classList.remove('tk-bump'); requestAnimationFrame(() => e.classList.add('tk-bump')); e.addEventListener('animationend', () => e.classList.remove('tk-bump'), { once: true }); }

/* ---------- 居民的小動作：頭、嘴、揮手、點頭、歪頭、跳一下 ---------- */
function npcGest(n, k) { if (!k || !GEST[k]) return; if (k === 'hop' && RM()) k = 'nod'; n.g = { k, t0: W.t, d: GEST[k] / 1000 }; }
// 每格（buildNPCs 的 W.anim，走路姿勢之後）：6 公尺內上下看著你（小孩抬頭、大人微低頭），說話時輕輕點頭，再疊上小動作
function tkHead(n, m, dist, t) {
  const kid = n.d.kid || 1, dt = Math.min(.1, Math.max(0, t - (n.tht == null ? t : n.tht))); n.tht = t;
  const want = dist < 6 ? clamp(-Math.atan2(W.cam.position.y - 1.72 * kid, Math.max(.6, dist)), -.38, .22) : 0; n.hx = (n.hx || 0) + (want - (n.hx || 0)) * Math.min(1, dt * 4);
  let rx = n.hx + (n.say ? Math.sin(t * 9) * .04 : 0), rz = 0, wave = false; const g = n.g;
  if (g) {
    const k = (t - g.t0) / g.d; if (k >= 1 || k < 0) n.g = null;
    else { const e = smooth(0, .2, k) * (1 - smooth(.75, 1, k));
      if (g.k === 'wave') { m.aR.rotation.z = .05 + 2.5 * e + Math.sin(t * 13) * .28 * e; wave = true; }
      else if (g.k === 'nod') rx += Math.sin(PI2 * k) * .14;
      else if (g.k === 'tilt') rz = .16 * e;
      else if (g.k === 'hop') m.body.position.y += Math.max(0, Math.sin(PI2 * k)) * (kid < 1 ? .12 : .06); }
  }
  if (!wave && n.talk > 0) m.aR.rotation.z += (.05 - m.aR.rotation.z) * Math.min(1, dt * 6); // 對話中沒有動作時右手放下（張警官敬禮到一半被叫住也會放下）
  m.head.rotation.x = rx; m.head.rotation.z = rz;
}
// 居民的一句話 → 一拍（動作、貼紙、彩蛋）
function npcBeat(n, l) { const fx = NPC_FX[l.k] || {}; return { t: l.t, k: l.k, g: fx.g, emo: fx.emo, egg: fx.egg }; }
// 嘴：全城一塊深紅小方塊，只在打字時掛在說話的人臉上開合（多 1 次繪製呼叫）
function tkMouth(t) {
  const n = TK.on && TK.ty && TK.who && TK.who.n, M0 = TK.mouth;
  if (!n) { if (M0 && M0.visible) M0.visible = false; return; }
  if (!M0) { TK.mouth = new THREE.Mesh(mergeParts([[new THREE.BoxGeometry(.06, .03, .006), '#5a1a1a']]), W.npcMat); TK.mouth.position.set(0, .085, .1695); }
  const mo = TK.mouth; if (mo.parent !== n.m.head) n.m.head.add(mo); mo.visible = true; mo.scale.y = .6 + .9 * Math.abs(Math.sin(t * 17));
}

/* ---------- 準心對到會說話的對象：他頭上先冒一個「…」（取代畫面中央的提示文字） ---------- */
function tkWhoOf(t) {
  if (!t) return null; const key = t.n || t.it; if (!key) return null;
  if (TK.wk === key && TK.wn-- > 0) return TK.wv; let w = null; // 以目標物件當快取鍵，每 30 次重算一次（計程車要看你站在哪一側）
  if (t.type === 'npc') w = t.n.d.shop && typeof WARE !== 'undefined' && WARE.h ? null : npcWho(t.n); // 拿著商品對準店員：提示交給 wareLabel（E 結帳） else if (t.type === 'station' && typeof TALK_AT !== 'undefined' && TALK_AT[t.it.id]) w = TALK_AT[t.it.id]();
  TK.wk = key; TK.wv = w; TK.wn = 30; return w;
}
const tkSeen = w => { w.at(tkV); tkProj(tkV, PA); return PA.z > .05 && PA.x >= 0 && PA.x <= innerWidth && PA.y >= 0 && PA.y <= innerHeight; };
function tkHint(now) {
  const t = TARGET, ok = !!t && W.ready && !GUI.kind && !TITLE.on && !INTRO.on && !mOpen && now - TK.endT > TKT.hintGap, w = ok ? tkWhoOf(t) : null;
  if (w && w.at && tkSeen(w)) {
    if (TK.hk !== w.id) { if (TK.hs) { TK.hs = 0; tkAnimStart('out', TKT.hintOut); } TK.hk = w.id; TK.hT = now; } // 換了對象：舊的提示先淡出
    TK.hw = w; if (TK.hs) TK.mw = w; // 同一個對象重算過（計程車：你繞到另一側）：提示跟著換位置
    if (!TK.hs && now - TK.hT >= TKT.hint && !(TK.a && TK.a.k === 'out') && tkInit()) tkHintShow(w, now);
  } else if (TK.hk) { TK.hk = ''; TK.hw = null; if (TK.hs) { TK.hs = 0; tkAnimStart('out', TKT.hintOut); } }
}
function tkHintShow(w) {
  const el = TK.el; TK.mw = w; TK.hs = 1; el.hidden = false; el.className = 'tkw hint'; TK.offOn = false;
  TK.nmT.textContent = w.name || ''; TK.nmS.textContent = ''; TK.nmA.textContent = ''; TK.nm.style.setProperty('--c', w.col || '#e2e8f0');
  TK.tb.className = 'tb say'; TK.tb.innerHTML = '<span class="dots">…</span>' + (TOUCH ? '' : '<kbd class="hk">E</kbd>'); TK.emo.hidden = true; TK.tip.hidden = true;
  tkMeasure(); TK.placed = false; TK.pl = ''; TK.plBad = 0; TK.tbase = null; TK.safeN = 0; tkAnimStart('in', TKT.pop);
}
// 畫面中央的提示文字：對話中對著說話的人或空地不顯示；準心對到會說話的對象、他頭上冒「…」時也不顯示；其他照舊
function tkLabel(t) {
  if (TK.on) return !t || (TK.who.tg && TK.who.tg(t)) ? '' : targetLabel(t);
  const w = t && W.ready ? tkWhoOf(t) : null; if (w && w.at && tkSeen(w)) return ''; return targetLabel(t);
}
