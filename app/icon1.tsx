// 瀏覽器分頁圖示（32×32 PNG，給不支援 SVG favicon 的瀏覽器（例如 Safari）），建置時由 next/og 畫出來：透明底＋青色史萊姆
import { ImageResponse } from 'next/og';

export const size = { width: 32, height: 32 };
export const contentType = 'image/png';
export const dynamic = 'force-static';

export default function Icon() {
  return new ImageResponse(
    (
      <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'transparent' }}>
        <svg width="32" height="32" viewBox="0 0 64 64">
          <defs>
            <radialGradient id="g" cx="35%" cy="28%" r="82%">
              <stop offset="0" stopColor="#cffafe" />
              <stop offset=".5" stopColor="#22d3ee" />
              <stop offset="1" stopColor="#0e7490" />
            </radialGradient>
          </defs>
          <path d="M5 46C5 23 17 7 32 7s27 16 27 39c0 10-8 13-27 13S5 56 5 46z" fill="url(#g)" />
          <ellipse cx="20" cy="19" rx="7.5" ry="3.8" fill="#fff" opacity=".75" transform="rotate(-28 20 19)" />
          <ellipse cx="23.5" cy="37" rx="3.6" ry="4.8" fill="#0b1020" />
          <ellipse cx="40.5" cy="37" rx="3.6" ry="4.8" fill="#0b1020" />
          <circle cx="24.8" cy="35.3" r="1.3" fill="#fff" />
          <circle cx="41.8" cy="35.3" r="1.3" fill="#fff" />
          <ellipse cx="16" cy="44" rx="4" ry="2.2" fill="#fb7185" opacity=".5" />
          <ellipse cx="48" cy="44" rx="4" ry="2.2" fill="#fb7185" opacity=".5" />
          <path d="M27.5 46q4.5 4.5 9 0" stroke="#0b1020" strokeWidth="2.6" fill="none" strokeLinecap="round" />
        </svg>
      </div>
    ),
    size,
  );
}
