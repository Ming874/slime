// 遊戲頁：3D 世界與工作站介面由 game.js 直接操作（game/dom.html 的畫面元件）；進遊戲前的登入、選存檔、載入畫面是 React（LoginGate），
// 工作站的道具外觀與開關動畫（手帳、電腦、手機、機器面板…）也是 React（StationLayer）。
// 建置時（next build，靜態匯出）讀檔：每個 script 網址帶內容雜湊，檔案一改網址就換，Cloudflare／瀏覽器不會給舊版。
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { preload } from 'react-dom';
import LoginGate from '@/components/LoginGate';
import StationLayer from '@/components/StationLayer';
import './game.css';
import './stations.css';

const ROOT = process.cwd();
const versioned = (p: string) => `/${p}?v=${crypto.createHash('sha256').update(fs.readFileSync(path.join(ROOT, 'public', p))).digest('hex').slice(0, 12)}`;

export default function Game() {
  const html = fs.readFileSync(path.join(ROOT, 'game', 'dom.html'), 'utf8');
  const scripts = ['vendor/three.min.js', 'vendor/peerjs.min.js', 'game/game.js'].map(versioned);
  for (const s of scripts) preload(s, { as: 'script' }); // 登入的同時就開始下載
  return (
    <>
      <div id="slime" dangerouslySetInnerHTML={{ __html: html }} />
      <LoginGate scripts={scripts} />
      <StationLayer />
    </>
  );
}
