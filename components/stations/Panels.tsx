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
import { Riddle, MapGame } from './Ancient';
import Title from './Title';
import Pause from './Pause';
import Make from './Make';

const PANELS: Record<string, ComponentType> = {
  title: Title, pause: Pause, make: Make, inv: Inventory, codex: Codex, shop: Shop, web: WebStore, weekly: Weekly, museum: Museum, visit: Visit, bench: Bench, riddle: Riddle, mapg: MapGame,
};

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
      flushSync(() => setVer((v) => ({ ...v, [k]: (v[k] || 0) + 1 })));
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
