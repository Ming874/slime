'use client';
/* 沉浸式工作站：game.js 打開介面時會發出 slime:gui（哪一種道具）、切換分頁時發出 slime:tab。
   這裡把道具的外觀（書皮、書頁、螢幕邊框、手機瀏海、機器鉚釘、捲軸…）用 portal 放進介面視窗 #gwin，
   開關與翻頁的動畫在 app/stations.css。視窗裡的內容仍由 game.js 負責。 */
import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';

type State = { open: boolean; kind: string; prop: string; tab: string; flip: number };

// 各分頁在「電腦」裡的網址、在「型錄」裡的店名
const URLS: Record<string, string> = { web: 'shop.squish.tw/my-store', weekly: 'squish.tw/weekly', eshop: 'buy.squish.tw', branch: 'squish.tw/business', codex: 'wiki.squish.tw/slimes' };
const STORES: Record<string, string> = { mach: '機械行', gear: '器材行', mall: '生活百貨', arms: '武器店' };

export default function StationLayer() {
  const [st, setSt] = useState<State>({ open: false, kind: '', prop: '', tab: '', flip: 0 });
  const [host, setHost] = useState<HTMLElement | null>(null);

  useEffect(() => {
    setHost(document.getElementById('gwin'));
    const onGui = (e: Event) => {
      const d = (e as CustomEvent<{ open: boolean; kind?: string; prop?: string }>).detail;
      setSt((s) => (d.open ? { ...s, open: true, kind: d.kind || '', prop: d.prop || 'card' } : { ...s, open: false }));
    };
    const onTab = (e: Event) => {
      const d = (e as CustomEvent<{ tab: string; flip: boolean }>).detail;
      const gui = document.getElementById('gui');
      if (gui) gui.dataset.tab = d.tab; // 型錄依店家換顏色（stations.css）
      setSt((s) => ({ ...s, tab: d.tab, flip: d.flip ? s.flip + 1 : s.flip }));
    };
    addEventListener('slime:gui', onGui);
    addEventListener('slime:tab', onTab);
    return () => { removeEventListener('slime:gui', onGui); removeEventListener('slime:tab', onTab); };
  }, []);

  if (!host || !st.prop) return null;
  return createPortal(<Decor key={st.prop} {...st} />, host);
}

function owner() {
  try { return window.SlimeCloud?.user?.name || ''; } catch { return ''; }
}
const clock = () => { const d = new Date(); return `${d.getHours()}:${String(d.getMinutes()).padStart(2, '0')}`; };

function Decor({ prop, tab, flip, kind }: State) {
  switch (prop) {
    case 'journal': // 背包＋圖鑑：工坊手帳，皮革書皮翻開，左頁是扉頁，右頁是內容；換分頁時翻頁
      return (
        <>
          <div className="st-left" aria-hidden="true">
            <div className="st-stamp">SQUISH LAB</div>
            <div className="st-book-title">工坊手帳</div>
            <div className="st-owner">{owner() ? `${owner()} 的` : '我的'}採集與收藏紀錄</div>
            <div className="st-doodle"><i /><i /><em /></div>
            <ul className="st-index">
              <li className={tab === 'inv' ? 'on' : ''}>背包・持有物品</li>
              <li className={tab === 'codex' ? 'on' : ''}>圖鑑・發現的史萊姆</li>
            </ul>
            <div className="st-foot">月光谷 · 第一冊</div>
          </div>
          <div className="st-spine" aria-hidden="true" />
          <div className="st-ribbon" aria-hidden="true" />
          <div className="st-cover" aria-hidden="true"><span>工坊手帳</span></div>
          {flip > 0 && <div className="st-flip" key={flip} aria-hidden="true" />}
        </>
      );
    case 'catalog': // 大城市商店：櫃台上的型錄，封面翻開，換店時翻頁
      return (
        <>
          <div className="st-band" data-store={tab} aria-hidden="true"><b>CITY CATALOG</b><span>{STORES[tab] || '大城市'} · 第 {Object.keys(STORES).indexOf(tab) + 1 || 1} 頁</span></div>
          <div className="st-cover" aria-hidden="true"><small>2026 冬季號</small><b>大城市</b><span>型錄 CATALOG</span></div>
          {flip > 0 && <div className="st-flip" key={flip} aria-hidden="true" />}
        </>
      );
    case 'notebook': // 暫停選單：闔起的線圈筆記本往上翻開
      return (
        <>
          <div className="st-rings" aria-hidden="true">{Array.from({ length: 12 }, (_, i) => <i key={i} />)}</div>
          <div className="st-band-v" aria-hidden="true" />
          <div className="st-margin" aria-hidden="true" />
        </>
      );
    case 'monitor': // 工作電腦：螢幕開機，分頁是瀏覽器分頁
      return (
        <>
          <div className="st-url" aria-hidden="true"><i /><span>{URLS[tab] || 'squish.tw'}</span></div>
          <div className="st-glass" aria-hidden="true" />
          <div className="st-boot" aria-hidden="true"><b>SQUISH OS</b></div>
          <div className="st-brand" aria-hidden="true">SQUISH<i /></div>
          <div className="st-stand" aria-hidden="true" />
        </>
      );
    case 'phone': // 直播台：拿起手機
      return (
        <>
          <div className="st-status" aria-hidden="true"><span>{clock()}</span><i className="st-island" /><span className="st-sig"><i /><i /><i /><i /></span><span className="st-bat" /></div>
          <div className="st-home" aria-hidden="true" />
          <div className="st-btn a" aria-hidden="true" /><div className="st-btn b" aria-hidden="true" /><div className="st-btn c" aria-hidden="true" />
        </>
      );
    case 'machine': // 加工產線：控制面板從機器上翻起
      return (
        <>
          <div className="st-hazard" aria-hidden="true" />
          {['tl', 'tr', 'bl', 'br'].map((c) => <i key={c} className={`st-rivet ${c}`} aria-hidden="true" />)}
          <div className="st-leds" aria-hidden="true"><i /><i /><i /></div>
          <div className="st-plate" aria-hidden="true">SQUISH LINE · MK-II</div>
        </>
      );
    case 'mat': // 手作台、裝飾桌：鏡頭俯看桌面上的切割墊
      return (
        <>
          <div className="st-ruler" aria-hidden="true" />
          <div className="st-tool pen" aria-hidden="true" />
          <div className="st-tool knife" aria-hidden="true" />
          <div className="st-label" aria-hidden="true">{kind === 'decor' ? 'DECO MAT' : 'CRAFT MAT'} · A3</div>
        </>
      );
    case 'parchment': // 古地圖石台：羊皮紙從捲軸展開
      return (
        <>
          <div className="st-rod top" aria-hidden="true" />
          <div className="st-rod bottom" aria-hidden="true" />
          <div className="st-compass" aria-hidden="true">N</div>
        </>
      );
    case 'tablet': // 古老的石碑：石板升起、刻紋發光
      return (
        <>
          <div className="st-runes" aria-hidden="true" />
          <div className="st-glyphs" aria-hidden="true">ᚠ ᚢ ᚦ ᚨ ᚱ ᚲ ᚷ ᚹ</div>
          <div className="st-dust" aria-hidden="true" />
        </>
      );
    case 'vitrine': // 展示場：展示櫃的玻璃門往兩旁滑開、聚光燈亮起
      return (
        <>
          <div className="st-light" aria-hidden="true" />
          <div className="st-door l" aria-hidden="true" />
          <div className="st-door r" aria-hidden="true" />
          <div className="st-base" aria-hidden="true">SQUISH MUSEUM</div>
        </>
      );
    default:
      return null;
  }
}
