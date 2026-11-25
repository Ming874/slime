'use strict';
/* ============================================================
   各區的地形多元化與場景細節：每一區一個檔案（region-plain.js、region-coast.js、region-volcano.js、region-snow.js），
   用這裡的登記函式掛進世界，不必改 game.js，各區可以分開做、分開合併。
   - regionTerrain(fn)：fn(x, z, h) → h，基礎單位（世界座標＝基礎單位×K），在 H0 最後、小場景挖池塘與山洞口整平之前套用
   - regionAvoid(fn)：fn(x, z) 回傳 true 時，buildProps 的隨機植被與石頭不放在那裡（世界座標）
   - regionBuild(fn)：建世界時呼叫一次（地形、隨機道具、地標都建好之後；可以用 H、scatter、instances、mergeStatic、addCol、addInter、W.chunks…）
   - regionStep(fn)：每格呼叫 fn(dt, t)（請自己做距離剔除：玩家離太遠就直接 return）
   這個檔案與各區檔案都在 game.js 之前載入：最上層只登記函式，用到的 game.js 全域都在函式被呼叫時才讀。
   各區檔案請把內容包在 (() => { … })(); 裡，避免和別的檔案撞名。
   ============================================================ */
const REGION = { terrain: [], avoid: [], build: [], step: [] };
function regionTerrain(fn) { REGION.terrain.push(fn); }
function regionAvoid(fn) { REGION.avoid.push(fn); }
function regionBuild(fn) { REGION.build.push(fn); }
function regionStep(fn) { REGION.step.push(fn); }
function regionShape(x, z, h) { for (const f of REGION.terrain) h = f(x, z, h); return h; }
function regionAvoided(x, z) { for (const f of REGION.avoid) if (f(x, z)) return true; return false; }
function buildRegions() {
  for (const f of REGION.build) { try { f(); } catch (e) { console.error('區域場景建立失敗', e); } } // 一區出錯不影響其他區
  if (REGION.step.length) W.anim.push((dt, t) => { for (const f of REGION.step) f(dt, t); });
}
