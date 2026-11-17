'use client';
/* 直播台（手機）：其他玩家正在直播、選上台的捏捏、直播定價。
   舞台畫布、LIVE 標誌、觀眾數、人氣條、彈幕、斗內、聊天仍由 game.js 每格畫面更新（game/dom.html 的 #liveWrap、#chat）。 */
import { G } from './game';
import { Empty, PriceTiers, ProdTile } from './Items';

type LiveGame = { L: { on: boolean; stageId: number | null; watch: { id: string } | null } };

export function LiveOthers() {
  const g = G(), L = (g as unknown as LiveGame).L;
  if (!g.NET.on) return null;
  const others = [...g.NET.players.entries()].filter(([id, p]) => id !== g.NET.me && (p as { live?: { on?: boolean } }).live?.on);
  if (!others.length) return null;
  return (
    <div className="rx-liveothers">
      <span className="rx-live-dot" aria-hidden="true" />其他玩家正在直播
      <div className="rx-liveothers-row">
        {others.map(([id, p]) => {
          const lv = (p as { live?: { viewers?: number } }).live;
          return (
            <button key={id} type="button" className={`rx-streamer${L.watch?.id === id ? ' on' : ''}`} data-act="watch" data-id={id}>
              <span className="rx-avatar sm" style={{ background: p.color }}>{[...(p.name || '玩')][0]}</span>
              <b>{p.name}</b><small>{lv?.viewers || 0} 觀眾</small>
            </button>
          );
        })}
      </div>
    </div>
  );
}

export function LiveStock() {
  const g = G(), S = g.S, L = (g as unknown as LiveGame).L;
  return (
    <div className="rx-livestock">
      <div className="rx-livestock-hd"><b>上台的捏捏</b><small>點一下換一個上台</small></div>
      {S.stock.length
        ? <div className="rx-strip">{S.stock.map((p) => <ProdTile key={p.id} p={p} act="stageSel" sel={L.stageId === p.id} extra={`直播售價 ${g.fmt(g.priceOf(p, 'live'))}`} />)}</div>
        : <Empty>背包裡沒有捏捏，先到加工產線做一個。</Empty>}
    </div>
  );
}

export function LivePrice() {
  return <PriceTiers ch="live" />;
}
