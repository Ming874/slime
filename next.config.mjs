// 正式站：next build 靜態匯出到 out/，由 Caddy 提供；/api/ 由同一個容器裡的 Node 伺服器處理（server/server.js）。
// 本機開發（npm run dev）：next dev 在 8778，/api/ 轉給 scripts/dev.mjs 開的 Node 伺服器。
import { PHASE_DEVELOPMENT_SERVER } from 'next/constants.js';

export default function config(phase) {
  const base = { images: { unoptimized: true }, poweredByHeader: false };
  if (phase !== PHASE_DEVELOPMENT_SERVER) return { ...base, output: 'export' };
  const api = process.env.SLIME_API || 'http://127.0.0.1:8781';
  return { ...base, async rewrites() { return [{ source: '/api/:path*', destination: `${api}/api/:path*` }]; } };
}
