'use client';
/* 暫停選單（筆記本）：大大的「回到遊戲」、帳號與雲端存檔狀態、功能格（儲存、說明、回中央平地、音效、靈敏度）、
   多人房間、回主選單。按鈕帶 data-act 由 game.js 處理；暱稱輸入框 #acctName 給 game.js 讀。 */
import Icon from '@/components/admin/Icon';
import { useState } from 'react';
import { G } from './game';

export default function Pause() {
  const g = G(), S = g.S, C = window.SlimeCloud, user = C?.user, status = C?.status() || '';
  const sync = /失敗|連不上|失效/.test(status) ? 'err' : /上傳|秒內|等待/.test(status) ? 'wait' : 'ok';
  const net = g.NET as typeof g.NET & { room?: string; host?: boolean };
  const [pick, setPick] = useState(false), av = g.AVATARS?.find((a) => a.id === S.avatar) || g.AVATARS?.[0];

  return (
    <div className="rx-pause">
      <button type="button" className="rx-resume" data-act="closeGui">
        <Icon name="play" /><b>回到遊戲</b><kbd>Esc</kbd>
      </button>

      <div className="rx-pcol">
      {user && (
        <section className="rx-acct">
          <button type="button" className={`rx-avatar slime${pick ? ' on' : ''}`} onClick={() => setPick(!pick)} aria-label="更換頭像" title="點一下更換頭像">
            <span dangerouslySetInnerHTML={{ __html: g.avatarSVG?.(S.avatar || 'mint') || '' }} /><i className="rx-av-edit" aria-hidden="true">換</i>
          </button>
          <div className="rx-acct-main">
            <div className="rx-name-edit">
              <input id="acctName" key={user.name} defaultValue={user.name} maxLength={12} aria-label="暱稱" autoComplete="off" />
              <button type="button" className="btn sm ghost" data-act="acctName">改暱稱</button>
            </div>
            <div className={`rx-sync ${sync}`}><Icon name={sync === 'err' ? 'cloudOff' : 'cloud'} />{status}</div>
          </div>
        </section>
      )}

      {user && pick && g.AVATARS && (
        <section className="rx-avpick" aria-label="選擇頭像">
          <div className="rx-avpick-hd"><b>選擇你的史萊姆頭像</b><small>目前：{av?.n}史萊姆</small></div>
          <div className="rx-avpick-grid">
            {g.AVATARS.map((a) => (
              <button key={a.id} type="button" data-act="avatar" data-k={a.id} className={a.id === (S.avatar || 'mint') ? 'on' : ''} aria-label={a.n + '史萊姆'}>
                <span dangerouslySetInnerHTML={{ __html: g.avatarSVG?.(a.id) || "" }} /><small>{a.n}</small>
              </button>
            ))}
          </div>
        </section>
      )}

      {net.on && (
        <section className="rx-room">
          <div className="rx-room-hd"><b>多人房間 {net.room}</b>{net.host && <span className="tag">你是房主</span>}</div>
          <p className="rx-dim">把房間代碼分享給朋友，就能一起玩。</p>
          <ul>
            {[...net.players.values()].map((p, i) => (
              <li key={i}><i className="rx-dot" style={{ background: p.color || '#22d3ee' }} />{p.name || '玩家'}{(p as { live?: { on?: boolean } }).live?.on && <span className="tag">直播中</span>}</li>
            ))}
          </ul>
          <button type="button" className="btn sm red" data-act="netLeave">離開房間</button>
        </section>
      )}

      </div>

      <div className="rx-pcol">
      <div className="rx-grid">
        <button type="button" data-act="saveNow"><Icon name="save" /><b>儲存遊戲</b><small>上次 {g.fmtTime(S.last)}</small></button>
        <button type="button" data-act="help"><Icon name="keyboard" /><b>操作說明</b><small>鍵盤與觸控</small></button>
        <button type="button" data-act="home"><Icon name="home" /><b>回到中央平地</b><small>傳送到入口</small></button>
        <button type="button" data-act="sound" className={S.sound ? 'on' : ''}>
          <Icon name={S.sound ? 'volume' : 'mute'} /><b>音效</b><small>{S.sound ? '開啟' : '關閉'}</small><span className="rx-switch" aria-hidden="true" />
        </button>
        <button type="button" data-act="sens">
          <Icon name="sliders" /><b>滑鼠靈敏度</b><small>{g.SENS_N[S.sens]}（點一下切換）</small>
          <span className="rx-pips3" aria-hidden="true">{g.SENS_N.map((n, i) => <i key={n} className={i <= S.sens ? 'on' : ''} />)}</span>
        </button>
        {user?.admin && <a href="/admin" target="_blank" rel="noopener"><Icon name="shield" /><b>管理後台</b><small>允許名單與玩家</small></a>}
      </div>

      <section className="rx-audio" aria-label="音量與畫質">
        <label><span>音樂</span><input type="range" min={0} max={100} step={5} defaultValue={Math.round((S.vol?.music ?? .6) * 100)} data-vol="music" aria-label="音樂音量" /></label>
        <label><span>音效</span><input type="range" min={0} max={100} step={5} defaultValue={Math.round((S.vol?.sfx ?? .9) * 100)} data-vol="sfx" aria-label="音效音量" /></label>
        <div className="rx-qual"><span>畫質</span>{(['auto', 'high', 'low'] as const).map((k) => (
          <button key={k} type="button" data-act="quality" data-k={k} className={(S.quality || 'auto') === k ? 'on' : ''}>{{ auto: '自動', high: '高', low: '低' }[k]}</button>
        ))}</div>
        {g.creditsHTML?.() ? <div className="rx-credits" dangerouslySetInnerHTML={{ __html: g.creditsHTML() }} /> : null}
      </section>

      {user?.dev && (
        <section className="rx-dev" aria-label="開發者工具">
          <div className="rx-room-hd"><b>開發者工具</b><span className="tag">測試用</span></div>
          <p className="rx-dim">已解鎖 {g.ZONES.filter((z) => S.zones.includes(z.id)).map((z) => z.name).join('、')}（{S.zones.length}/{g.ZONES.length}）</p>
          <button type="button" className="btn sm" data-act="devZones" disabled={S.zones.length >= g.ZONES.length && !!S.own.coat}>
            {S.zones.length >= g.ZONES.length && S.own.coat ? '全部地圖都已解鎖' : '解鎖全部地圖（含保暖衣）'}
          </button>
        </section>
      )}

      </div>

      <footer className="rx-pfoot">
      <button type="button" className="rx-quit" data-act="toTitle"><Icon name="exit" />儲存並回到主選單</button>
      <div className="rx-pause-links">
        <span>按 Esc、切換畫面、開關介面時都會自動儲存</span>
        <span>
          {user && <><button type="button" data-act="logout">登出</button>·<button type="button" data-act="delMe">刪除我的資料</button>·</>}
          <a href="/privacy" target="_blank" rel="noopener">隱私權政策</a>
        </span>
      </div>
      </footer>
    </div>
  );
}
