'use client';
/* 工作站分頁內容（React）：game/dom.html 裡 data-rx 的位置用 portal 畫進去。
   game.js 要重繪某個分頁時發出 slime:ui（例如 'inv'），這裡只重繪那一個分頁。 */
import { memo, useEffect, useState, type ComponentType } from 'react';
import { createPortal, flushSync } from 'react-dom';
import Inventory from './Inventory';
import Codex from './Codex';
import Shop from './Shop';
import { WebStore, Weekly } from './WebStore';
import { Museum, Visit } from './Museum';
import Bench from './Bench';
import { MapGame } from './Ancient';
import Title from './Title';
import Pause from './Pause';
import Admin from './Admin';
import NoteMap from './NoteMap';
import Make from './Make';
import { LiveOthers, LiveStock, LivePrice, LiveRcpt } from './Live';
import Paper from './Paper';
import { DecorStock, DecoTools } from './Decor';
import Branch from './Branch';

const PANELS: Record<string, ComponentType> = {
  title: Title, pause: Pause, admin: Admin, map: NoteMap, paper: Paper, liveRcpt: LiveRcpt, make: Make, liveOthers: LiveOthers, liveStock: LiveStock, livePrice: LivePrice, decorStock: DecorStock, decoTools: DecoTools, branch: Branch, inv: Inventory, codex: Codex, shop: Shop, web: WebStore, weekly: Weekly, museum: Museum, visit: Visit, bench: Bench, mapg: MapGame,
};

// 一個分頁分成好幾塊畫的（中間夾著 game.js 自己更新的畫布）：game.js 通知一次，整組一起重繪
const GROUPS: Record<string, string[]> = { live: ['liveOthers', 'liveStock', 'livePrice', 'liveRcpt'], decor: ['decorStock', 'decoTools'] };

// v 每次重繪都會變，讓 memo 只在這個分頁收到通知時才重畫
const Panel = memo(function Panel({ C }: { C: ComponentType; v: number }) {
  return <C />;
});

export default function Panels() {
  const [mounts, setMounts] = useState<Record<string, HTMLElement>>({});
  const [ver, setVer] = useState<Record<string, number>>({});

  useEffect(() => {
    const m: Record<string, HTMLElement> = {};
    document.querySelectorAll<HTMLElement>('[data-rx]').forEach((el) => { m[el.dataset.rx!] = el; });
    setMounts(m);
    const on = (e: Event) => {
      const k = (e as CustomEvent<string>).detail;
      if (!window.SlimeGame) return;
      // 同步畫完：game.js 有些地方重繪後馬上就讀畫面上的元素（例如手作台進度條、多人頁的輸入框）
      const keys = GROUPS[k] || [k];
      flushSync(() => setVer((v) => { const n = { ...v }; for (const key of keys) n[key] = (n[key] || 0) + 1; return n; }));
    };
    addEventListener('slime:ui', on);
    return () => removeEventListener('slime:ui', on);
  }, []);

  return (
    <>
      {Object.entries(PANELS).map(([k, C]) => (mounts[k] && ver[k] ? createPortal(<Panel C={C} v={ver[k]} />, mounts[k], k) : null))}
    </>
  );
}
