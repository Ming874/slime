/* 工作站內容用的插圖（SVG）：史萊姆、凝膠、捏捏（依切法變形）、未發現的輪廓，以及型錄商品插圖。 */
import { useId } from 'react';

// 把顏色往白色（t>0）或黑色（t<0）混
export function mix(hex: string, t: number) {
  const h = hex.replace('#', ''), n = (i: number) => parseInt(h.slice(i, i + 2), 16);
  const to = t >= 0 ? 255 : 0, w = Math.abs(t);
  return `rgb(${[0, 2, 4].map((i) => Math.round(n(i) + (to - n(i)) * w)).join(',')})`;
}

type Kind = 'slime' | 'gel' | 'prod' | 'ghost' | 'lock';
const PROD_SHAPE: Record<string, string> = {
  star: 'M32 8 L38.5 23.5 L55 24.5 L42 35 L46.5 51 L32 42 L17.5 51 L22 35 L9 24.5 L25.5 23.5 Z',
  heart: 'M32 52 C16 41 9 32 9 23.5 C9 16 15 11 21.5 11 C26 11 30 13.5 32 18 C34 13.5 38 11 42.5 11 C49 11 55 16 55 23.5 C55 32 48 41 32 52 Z',
  thin: 'M8 35 C8 29 19 25 32 25 C45 25 56 29 56 35 C56 41 45 45 32 45 C19 45 8 41 8 35 Z',
  thick: 'M14 18 Q14 12 20 12 L44 12 Q50 12 50 18 L52 44 Q52 52 44 52 L20 52 Q12 52 12 44 Z',
};

export function SlimeArt({ color = '#94a3b8', color2, kind = 'slime', cut, size = 56, title }: { color?: string; color2?: string; kind?: Kind; cut?: string; size?: number; title?: string }) {
  const id = useId().replace(/[^a-z0-9]/gi, '');
  const top = mix(color, 0.55), low = mix(color, -0.25);
  const fill = color2 ? `url(#g2${id})` : `url(#g${id})`;
  return (
    // 尺寸用 CSS 變數：遊戲的 game.css 把所有 svg 設成 20px，這裡用 .rx-art 蓋過去
    <svg className={`rx-art rx-art-${kind}`} viewBox="0 0 64 64" style={{ '--s': `${size}px` } as React.CSSProperties} role={title ? 'img' : undefined} aria-label={title} aria-hidden={title ? undefined : true}>
      <defs>
        <radialGradient id={`g${id}`} cx="35%" cy="28%" r="80%"><stop offset="0" stopColor={top} /><stop offset=".55" stopColor={color} /><stop offset="1" stopColor={low} /></radialGradient>
        {color2 && <linearGradient id={`g2${id}`} x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor={mix(color, 0.35)} /><stop offset="1" stopColor={color2} /></linearGradient>}
      </defs>
      {kind === 'slime' && (
        <>
          <ellipse cx="32" cy="56" rx="21" ry="3.5" fill="#0003" />
          <path d="M8 44 C8 24 19 10 32 10 C45 10 56 24 56 44 C56 52 49 55 32 55 C15 55 8 52 8 44 Z" fill={fill} />
          <ellipse cx="22" cy="21" rx="7" ry="3.6" fill="#fff" opacity=".65" transform="rotate(-28 22 21)" />
          <ellipse cx="24.5" cy="36" rx="2.6" ry="3.5" fill="#0b1020" /><ellipse cx="39.5" cy="36" rx="2.6" ry="3.5" fill="#0b1020" />
          <circle cx="25.4" cy="34.8" r=".9" fill="#fff" /><circle cx="40.4" cy="34.8" r=".9" fill="#fff" />
          <ellipse cx="18.5" cy="42" rx="3.4" ry="1.8" fill="#fb7185" opacity=".45" /><ellipse cx="45.5" cy="42" rx="3.4" ry="1.8" fill="#fb7185" opacity=".45" />
          <path d="M29 42 Q32 45 35 42" stroke="#0b1020" strokeWidth="1.6" fill="none" strokeLinecap="round" />
        </>
      )}
      {kind === 'gel' && (
        <>
          <ellipse cx="32" cy="57" rx="17" ry="3" fill="#0003" />
          <path d="M32 8 C40 20 52 28 52 40 C52 51 43 57 32 57 C21 57 12 51 12 40 C12 28 24 20 32 8 Z" fill={fill} />
          <ellipse cx="24" cy="33" rx="4.5" ry="7" fill="#fff" opacity=".55" transform="rotate(20 24 33)" />
          <circle cx="38" cy="44" r="2.4" fill="#fff" opacity=".35" /><circle cx="42" cy="37" r="1.4" fill="#fff" opacity=".3" />
        </>
      )}
      {kind === 'prod' && (
        <>
          <ellipse cx="32" cy="58" rx="19" ry="3" fill="#0003" />
          <path d={PROD_SHAPE[cut || ''] || PROD_SHAPE.thick} fill={fill} stroke={mix(color, -0.35)} strokeWidth="1.5" strokeLinejoin="round" />
          <g stroke="#fff" strokeOpacity=".6" strokeWidth="1.3" fill="none" strokeLinecap="round">
            <path d="M22 26 l5 4 l-2 6" /><path d="M40 22 l-3 6 l5 3" /><path d="M30 42 l4 -3 l4 3" />
          </g>
          <g fill="#fff">{[[20, 20], [44, 30], [27, 34], [38, 44], [18, 40]].map(([x, y], i) => <circle key={i} cx={x} cy={y} r=".9" opacity=".85" />)}</g>
        </>
      )}
      {kind === 'ghost' && (
        <>
          <path d="M8 44 C8 24 19 10 32 10 C45 10 56 24 56 44 C56 52 49 55 32 55 C15 55 8 52 8 44 Z" fill="none" stroke="currentColor" strokeWidth="2" strokeDasharray="4 3.5" opacity=".55" />
          <text x="32" y="42" textAnchor="middle" fontSize="20" fontWeight="800" fill="currentColor" opacity=".5">?</text>
        </>
      )}
      {kind === 'lock' && (
        <g fill="none" stroke="currentColor" strokeWidth="2.4" opacity=".5" strokeLinecap="round">
          <rect x="18" y="28" width="28" height="22" rx="4" /><path d="M23 28 v-6 a9 9 0 0 1 18 0 v6" /><path d="M32 37 v5" />
        </g>
      )}
    </svg>
  );
}

/* ---------- 型錄商品插圖 ---------- */
const ICONS: Record<string, React.ReactNode> = {
  slicer: <><path d="M10 40 L40 10 L46 16 L16 46 Z" /><path d="M40 10 L52 6 L50 18" /><circle cx="44" cy="44" r="8" /><path d="M44 33v3M44 52v3M33 44h3M52 44h3" /></>,
  coater: <><ellipse cx="32" cy="18" rx="18" ry="6" /><path d="M14 18v24c0 3.3 8 6 18 6s18-2.7 18-6V18" /><path d="M22 30h.01M30 34h.01M40 28h.01M36 40h.01M24 40h.01" strokeWidth="4" /></>,
  dryer: <><rect x="10" y="16" width="44" height="34" rx="4" /><rect x="16" y="22" width="26" height="22" rx="2" /><circle cx="48" cy="26" r="2" /><circle cx="48" cy="34" r="2" /><path d="M22 10q3 3 0 6M30 10q3 3 0 6M38 10q3 3 0 6" /></>,
  decor: <><path d="M32 8a24 24 0 1 0 0 48c4 0 6-3 4-7s0-7 5-7h6c4 0 8-3 8-8 0-14-10-26-23-26z" /><circle cx="20" cy="30" r="3" /><circle cx="26" cy="19" r="3" /><circle cx="38" cy="17" r="3" /><circle cx="46" cy="27" r="3" /></>,
  live: <><rect x="8" y="22" width="34" height="24" rx="4" /><path d="M42 30l12-7v22l-12-7" /><circle cx="18" cy="16" r="5" /><circle cx="32" cy="16" r="5" /></>,
  coat: <><path d="M22 8l10 6 10-6 12 8-4 14-6-3v29H20V27l-6 3-4-14z" /><path d="M32 14v42M28 26h.01M28 36h.01M28 46h.01" strokeWidth="2.6" /></>,
  sword: <><path d="M44 8h12v12L26 50l-6-6z" /><path d="M14 38l12 12M10 54l8-8M18 42l-6 6 4 4 6-6" /></>,
  net: <><rect x="14" y="30" width="22" height="16" rx="5" /><path d="M36 38h6a10 10 0 0 0 10-10V14" /><path d="M46 14h12M48 8l4 6 4-6" /><path d="M20 30v-6M30 30v-6" /></>,
  cap: <><path d="M10 8v48M54 8v48M10 20h44M10 36h44M10 52h44" /><rect x="16" y="11" width="10" height="9" /><rect x="34" y="27" width="12" height="9" /><rect x="18" y="43" width="8" height="9" /></>,
  shelf: <><rect x="12" y="8" width="40" height="14" rx="2" /><rect x="12" y="25" width="40" height="14" rx="2" /><rect x="12" y="42" width="40" height="14" rx="2" /><path d="M18 15h.01M18 32h.01M18 49h.01M40 15h8M40 32h8M40 49h8" strokeWidth="3" /></>,
  gear: <><circle cx="32" cy="24" r="16" /><circle cx="32" cy="24" r="8" /><path d="M32 40v10M22 56h20M26 50h12" /></>,
  farm: <><path d="M16 10h32v40a6 6 0 0 1-6 6H22a6 6 0 0 1-6-6z" /><path d="M16 26c6 3 10-3 16 0s10 3 16 0" /><circle cx="26" cy="40" r="3" /><circle cx="36" cy="46" r="2" /><circle cx="38" cy="34" r="2.5" /></>,
  boots: <><path d="M14 10h16v22l14 6c6 2.5 10 7 10 12v4H14z" /><path d="M14 46h40M30 32l-6 4M34 34l-6 4" /></>,
  pack: <><path d="M32 6l18 12v28L32 58 14 46V18z" /><path d="M14 18l18 12 18-12M32 30v28" /></>,
};
const ICON_COLOR: Record<string, string> = {
  slicer: '#38bdf8', coater: '#f59e0b', dryer: '#f97316', decor: '#e879f9', live: '#fb7185', coat: '#60a5fa', sword: '#94a3b8',
  net: '#22d3ee', cap: '#a3a3a3', shelf: '#818cf8', gear: '#fde047', farm: '#34d399', boots: '#f472b6',
};

export function ShopArt({ k, packColors }: { k: string; packColors?: string[] }) {
  const isPack = !!packColors;
  const c = isPack ? packColors![0] : ICON_COLOR[k] || '#94a3b8';
  return (
    <span className="rx-shopart" style={{ '--ic': c } as React.CSSProperties}>
      <svg viewBox="0 0 64 64" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round">
        {ICONS[isPack ? 'pack' : k] || ICONS.pack}
      </svg>
      {isPack && <span className="rx-packdots">{packColors!.map((pc, i) => <i key={i} style={{ background: pc }} />)}</span>}
    </span>
  );
}

// 等級刻度
export function Pips({ lv, max }: { lv: number; max: number }) {
  return <span className="rx-pips" aria-label={`等級 ${lv}/${max}`}>{Array.from({ length: max }, (_, i) => <i key={i} className={i < lv ? 'on' : ''} />)}</span>;
}
