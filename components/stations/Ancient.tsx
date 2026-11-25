'use client';
/* 古地圖拼圖（羊皮紙上的九塊碎片）。地圖圖片由 game.js 產生（mapImage）。 */
import { G } from './game';

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
