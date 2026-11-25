'use client';
/* 暫停選單＝手寫筆記本的一頁。按 Esc 時第一人稱的手把筆記本拿到眼前翻開（game.js 的 heldStep），這一頁的字才浮現；
   線圈、橫線、邊線與日期章在 StationLayer.tsx 與 app/stations.css，這一頁的排版在 app/menus.css。
   左欄：回到遊戲（便利貼）、待辦（儲存、說明、回中央平地）、多人房間；右欄：我的資料（頭像、暱稱、雲端存檔）、設定（音效、靈敏度、音量、畫質）、開發者工具。
   按鈕帶 data-act 由 game.js 處理；暱稱輸入框 #acctName 給 game.js 讀。膠帶、印章、塗鴉只放在留白處，不蓋到任何字。 */
import Icon from '@/components/admin/Icon';
import { useState } from 'react';
import { G } from './game';

export default function Pause() {
  const g = G(), S = g.S, C = window.SlimeCloud, user = C?.user, status = C?.status() || '';
  const sync = /失敗|連不上|失效/.test(status) ? 'err' : /上傳|秒內|等待/.test(status) ? 'wait' : 'ok';
  const net = g.NET as typeof g.NET & { room?: string; host?: boolean };
  const [pick, setPick] = useState(false), av = g.AVATARS?.find((a) => a.id === S.avatar) || g.AVATARS?.[0];
  const q = S.quality || 'auto';

  return (
    <div className="rx-pause">
      <div className="rx-pcol">
        <button type="button" className="rx-resume" data-act="closeGui">
          <Icon name="play" /><b>回到遊戲</b><kbd>Esc</kbd>
        </button>

        <h3 className="nb-h">待辦</h3>
        <div className="nb-list">
          <button type="button" data-act="saveNow"><Icon name="save" /><b>儲存遊戲</b><small>上次 {g.fmtTime(S.last)}</small></button>
          <button type="button" data-act="help"><Icon name="keyboard" /><b>操作說明</b><small>鍵盤與觸控</small></button>
          <button type="button" data-act="home" disabled={!!g.riding}><Icon name="home" /><b>{g.inCity ? '搭計程車回月光谷' : '回到中央平地'}</b><small>{g.riding ? '已經在車上了' : g.inCity ? '直接坐進招呼站的車' : '回到入口'}</small></button>
          {user?.admin && <a href="/admin" target="_blank" rel="noopener"><Icon name="shield" /><b>管理後台</b><small>允許名單與玩家</small></a>}
        </div>

        {net.on && (
          <section className="rx-room nb-card">
            <div className="rx-room-hd"><b>多人房間 {net.room}</b>{net.host && <span className="tag">你是房主</span>}</div>
            <p className="rx-dim">把房間代碼分享給朋友，就能一起玩。</p>
            <ul>
              {[...net.players.values()].map((p, i) => (
                <li key={i}><i className="rx-dot" style={{ background: p.color || '#22d3ee' }} />{p.name || '玩家'}{(p as { live?: { on?: boolean } }).live?.on && <span className="tag">直播中</span>}</li>
              ))}
            </ul>
            <button type="button" className="nb-btn red" data-act="netLeave">離開房間</button>
          </section>
        )}
      </div>

      <div className="rx-pcol">
        {user && (
          <>
            <h3 className="nb-h">我的資料</h3>
            <section className="rx-acct">
              <button type="button" className={`rx-avatar slime${pick ? ' on' : ''}`} onClick={() => setPick(!pick)} aria-expanded={pick} aria-label="更換頭像" title="點一下更換頭像">
                <span dangerouslySetInnerHTML={{ __html: g.avatarSVG?.(S.avatar || 'mint') || '' }} /><i className="rx-av-edit" aria-hidden="true">換</i>
              </button>
              <div className="rx-acct-main">
                <div className="rx-name-edit">
                  <span className="nb-lbl" aria-hidden="true">暱稱</span>
                  <input id="acctName" key={user.name} defaultValue={user.name} maxLength={12} aria-label="暱稱" autoComplete="off" />
                  <button type="button" className="nb-btn" data-act="acctName">改暱稱</button>
                </div>
                <div className={`rx-sync ${sync}`}><Icon name={sync === 'err' ? 'cloudOff' : 'cloud'} />{status}</div>
              </div>
            </section>
            {pick && g.AVATARS && (
              <section className="rx-avpick" aria-label="選擇頭像">
                <div className="rx-avpick-hd"><b>選一個史萊姆頭像</b><small>目前：{av?.n}史萊姆</small></div>
                <div className="rx-avpick-grid">
                  {g.AVATARS.map((a) => (
                    <button key={a.id} type="button" data-act="avatar" data-k={a.id} className={a.id === (S.avatar || 'mint') ? 'on' : ''} aria-label={a.n + '史萊姆'} aria-pressed={a.id === (S.avatar || 'mint')}>
                      <span dangerouslySetInnerHTML={{ __html: g.avatarSVG?.(a.id) || '' }} /><small>{a.n}</small>
                    </button>
                  ))}
                </div>
              </section>
            )}
          </>
        )}

        <h3 className="nb-h">設定</h3>
        <section className="nb-set" aria-label="音效、靈敏度、音量與畫質">
          <button type="button" data-act="sound" className={`nb-row${S.sound ? ' on' : ''}`} aria-pressed={!!S.sound}>
            <i className="nb-check" aria-hidden="true" /><b>音效</b><small>{S.sound ? '開啟' : '關閉'}</small>
          </button>
          <button type="button" data-act="sens" className="nb-row">
            <b>滑鼠靈敏度</b>
            <span className="rx-pips3" aria-hidden="true">{g.SENS_N.map((n, i) => <i key={n} className={i <= S.sens ? 'on' : ''} />)}</span>
            <small>{g.SENS_N[S.sens]}（點一下切換）</small>
          </button>
          <label className="nb-row"><b>音樂</b><input type="range" min={0} max={100} step={5} defaultValue={Math.round((S.vol?.music ?? .6) * 100)} data-vol="music" aria-label="音樂音量" /></label>
          <label className="nb-row"><b>音效音量</b><input type="range" min={0} max={100} step={5} defaultValue={Math.round((S.vol?.sfx ?? .9) * 100)} data-vol="sfx" aria-label="音效音量" /></label>
          <div className="rx-qual nb-row" role="group" aria-label="畫質"><b>畫質</b>{(['auto', 'high', 'low'] as const).map((k) => (
            <button key={k} type="button" data-act="quality" data-k={k} className={q === k ? 'on' : ''} aria-pressed={q === k}>{{ auto: '自動', high: '高', low: '低' }[k]}</button>
          ))}</div>
          {g.creditsHTML?.() ? <div className="rx-credits" dangerouslySetInnerHTML={{ __html: g.creditsHTML() }} /> : null}
        </section>

        {user?.dev && (
          <section className="rx-dev nb-sticky" aria-label="開發者工具">
            <div className="rx-room-hd"><b>開發者工具</b><span className="tag">測試用</span></div>
            <p className="rx-dim">已解鎖 {g.ZONES.filter((z) => S.zones.includes(z.id)).map((z) => z.name).join('、')}（{S.zones.length}/{g.ZONES.length}）</p>
            <button type="button" className="nb-btn" data-act="devZones" disabled={S.zones.length >= g.ZONES.length && !!S.own.coat}>
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
