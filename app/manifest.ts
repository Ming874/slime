// 網站資訊（加入主畫面時的名稱、顏色、圖示）
import type { MetadataRoute } from 'next';

export const dynamic = 'force-static';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: '史萊姆捏捏工坊',
    short_name: '捏捏工坊',
    description: '走進月光谷，採集、加工、直播你的酥脆捏捏',
    start_url: '/',
    display: 'fullscreen',
    orientation: 'any',
    background_color: '#0a0e14',
    theme_color: '#0a0e14',
    icons: [
      { src: '/icon.svg', type: 'image/svg+xml', sizes: 'any' },
      { src: '/apple-icon', type: 'image/png', sizes: '180x180' },
    ],
  };
}
