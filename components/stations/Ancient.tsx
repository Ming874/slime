'use client';
/* 古老的石碑（刻文、四座熔岩柱的晶石插槽、線索）與古地圖拼圖（羊皮紙上的九塊碎片）。
   線索與提示的內容由 game.js 產生（含提示按鈕的 data-act），這裡照樣放進來。 */
import { G } from './game';

export function Riddle() {
  const g = G(), q = g.qState(), n = g.pillarClues(q.pil).filter((c) => c.ok).length;
  return (
    <div className="rx-riddle">
      <blockquote className="rx-verse" dangerouslySetInnerHTML={{ __html: g.TABLET_TXT }} />
      <p className="rx-note-line">這四條線索已經整理成清單。回到柱子前，對準熔岩柱{g.enter()}，切換頂端晶石的史萊姆種類；柱子上方會顯示名稱，左上角的目標欄會即時告訴你哪些線索已經滿足。面向北方時，最左邊是第 1 根。</p>
      <div className="rx-sockets">
        {q.pil.map((v, i) => {
          const s = g.pSp(v);
          return (
            <div key={i} className="rx-socket" style={{ '--sc': s.color } as React.CSSProperties}>
              <small>第 {i + 1} 根</small><span className="rx-crystal" aria-hidden="true" /><b>{g.short(g.PILLAR[v])}</b>
            </div>
          );
        })}
      </div>
      <div className="rx-clues">
        <div>已滿足 <b>{n}/4</b> 條線索</div>
        <div dangerouslySetInnerHTML={{ __html: g.pillarExtra() }} />
      </div>
      <div dangerouslySetInnerHTML={{ __html: g.hintBlock('pillar') }} />
    </div>
  );
}

export function MapGame() {
  const g = G(), q = g.qState();
  return (
    <div className="rx-mapg">
      <p className="rx-note-line">點擊地圖碎片可以旋轉 90°。把九塊碎片都轉回正確的方向（文字要是正的、河流與路徑要連起來），地圖就會重新拼合。</p>
      <div className="mapgrid" style={{ '--mapimg': `url(${g.mapImage()})` } as React.CSSProperties}>
        {q.map.map((r, i) => (
          <button key={i} type="button" className="mtile" data-act="mapRot" data-i={i} aria-label={`碎片 ${i + 1}`}
            style={{ backgroundPosition: `${(i % 3) * 50}% ${Math.floor(i / 3) * 50}%`, transform: `rotate(${r * 90}deg)` }} />
        ))}
      </div>
    </div>
  );
}
