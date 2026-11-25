'use strict';
/* ============================================================
   各區的地形多元化與場景細節：每一區一個檔案（region-plain.js、region-coast.js、region-volcano.js、region-snow.js），
   用這裡的登記函式掛進世界，不必改 game.js，各區可以分開做、分開合併。
   - regionTerrain(fn)：fn(x, z, h) → h，基礎單位（世界座標＝基礎單位×K），在 H0 最後、小場景挖池塘與山洞口整平之前套用
   - regionAvoid(fn)：fn(x, z) 回傳 true 時，buildProps 的隨機植被與石頭不放在那裡（世界座標）
   - regionBuild(fn)：建世界時呼叫一次（地形、隨機道具、地標都建好之後；可以用 H、scatter、instances、mergeStatic、addCol、addInter、W.chunks…）
   - regionStep(fn)：每格呼叫 fn(dt, t)（請自己做距離剔除：玩家離太遠就直接 return）
   - regionWalk(fn, box, kind, bot)：玩家走得上去的表面（橋面、踏腳石、平台）。fn(x, z, yFeet) → 這一點的表面高度（世界公尺），不在表面上就回 null；
     box＝[x0, z0, x1, z1]（世界座標）先篩，玩家不在框裡就不呼叫 fn（省略＝每次都呼叫，fn 自己要很快判斷不在）；kind＝站在上面的腳步聲（'wood'、'rock'、'ice'…，省略＝照地面）；
     bot(x, z, top) → 這一點表面的底面高度（橋身的厚度：拱橋、木板橋底下），省略＝實心一直到地面（石頭、台階、平台）。
     玩家腳下（game.js 的 G 帶 yFeet 時）取地形與所有表面中「不高於腳＋0.45 公尺（跨得上的台階，STEP_UP）」的最高者：從橋頭的緩坡或台階走得上去、
     落下來接得住，從橋底下走過去不會被吸上橋面（橋面要比橋下的地面高 0.45 公尺以上）；史萊姆、道具擺放、開場落點照舊只看地形。
     跨不上去的表面是一塊「頂面到底面」的實心：插進身體（腳＋0.45 到腳＋1.7 公尺）的當成牆——走過去會停住（像撞到石頭），跳起來才上得去；
     整塊在頭頂上的（拱橋底下）照樣走過去，跳起來頭會撞到底面。所以拱橋要給 bot：拱腳很厚，頂面比頭高不代表頭沒插進橋身裡。
     橋頭要接得上岸：兩端的表面和岸邊地形差 0.45 以內，或另外登記緩坡、台階（坡度上限約 1.1）。
     橋的位置常常要建好才知道，可以在 regionBuild 裡登記。表面只管高度：欄杆、橋墩照樣用 addCol（c.yr＝[y0, y1] 時只擋腳的高度在這個範圍裡的人，
     例如橋上的欄杆 yr＝[橋面 − 0.3, 99]、橋底下的人照樣走過去）
   - regionWalkStrip(ax, az, bx, bz, hw, yAt, kind, botAt)：最常用的 regionWalk——從 (ax, az) 到 (bx, bz)（世界座標）一條半寬 hw 的直帶子（橋面、棧道），
     yAt(t, s) → 表面高度（t＝0～1 沿著帶子從 a 到 b、s＝離中線的側向距離（公尺，有正負）；回 null＝這一點不在表面上，例如拱橋比 hw 窄的那段），
     botAt(t, s) → 底面高度（省略＝實心），包圍盒自動算。拱橋就是 yAt 給拱的頂面、botAt 給拱的底面
   - regionWalkAt(x, z, r)：(x, z) 或周圍 r 公尺內有沒有可以走的表面——擺花草之類的小東西時避開石階、橋面（花莖不會從石板頂面穿出來）
   這個檔案與各區檔案都在 game.js 之前載入：最上層只登記函式，用到的 game.js 全域都在函式被呼叫時才讀。
   各區檔案請把內容包在 (() => { … })(); 裡，避免和別的檔案撞名。
   ============================================================ */
const REGION = { terrain: [], avoid: [], build: [], step: [], walk: [] };
function regionTerrain(fn) { REGION.terrain.push(fn); }
function regionAvoid(fn) { REGION.avoid.push(fn); }
function regionBuild(fn) { REGION.build.push(fn); }
function regionStep(fn) { REGION.step.push(fn); }
function regionWalk(fn, box, kind, bot) { REGION.walk.push({ fn, box, kind, bot }); }
function regionWalkStrip(ax, az, bx, bz, hw, yAt, kind, botAt) { // 見檔頭：投影到 a→b 上的比例 t 在 0～1、側向在 hw 以內才算在帶子上
  const dx = bx - ax, dz = bz - az, L2 = dx * dx + dz * dz || 1, L = Math.sqrt(L2);
  regionWalk((x, z) => { const px = x - ax, pz = z - az, t = (px * dx + pz * dz) / L2, s = (px * dz - pz * dx) / L; return t < 0 || t > 1 || Math.abs(s) > hw ? null : yAt(t, s); },
    [Math.min(ax, bx) - hw, Math.min(az, bz) - hw, Math.max(ax, bx) + hw, Math.max(az, bz) + hw], kind,
    botAt && ((x, z) => { const px = x - ax, pz = z - az; return botAt((px * dx + pz * dz) / L2, (px * dz - pz * dx) / L); })); // 底面只在頂面有值（點在帶子上）的時候才問
}
function regionWalkAt(x, z, r = 0) { // 見檔頭：中心＋周圍四個點，有一點落在表面上就算
  for (const s of REGION.walk) {
    const b = s.box; if (b && (x < b[0] - r || x > b[2] + r || z < b[1] - r || z > b[3] + r)) continue;
    for (let k = 0; k < (r ? 5 : 1); k++) if (s.fn(k ? x + Math.cos(k * 1.571) * r : x, k ? z + Math.sin(k * 1.571) * r : z) != null) return true;
  }
  return false;
}
function regionShape(x, z, h) { for (const f of REGION.terrain) h = f(x, z, h); return h; }
function regionAvoided(x, z) { for (const f of REGION.avoid) if (f(x, z)) return true; return false; }
function buildRegions() {
  for (const f of REGION.build) { try { f(); } catch (e) { console.error('區域場景建立失敗', e); } } // 一區出錯不影響其他區
  if (REGION.step.length) W.anim.push((dt, t) => { for (const f of REGION.step) f(dt, t); });
}
