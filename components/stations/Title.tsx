'use client';
/* 主選單：左側是品牌、存檔卡與選單，右側留給背景的 3D 月光谷。
   按鈕帶 data-act（tContinue、tNew、tMulti、mpHost…），由 game.js 處理；多人頁的輸入框 id 給 game.js 讀。 */
import { useEffect } from 'react';
import Icon from '@/components/admin/Icon';
import { G } from './game';
import { SlimeArt } from './Art';

const ago = (t?: number) => {
  if (!t) return '';
  const m = Math.round((Date.now() - t) / 60000);
  return m < 1 ? '剛剛' : m < 60 ? `${m} 分鐘前` : m < 1440 ? `${Math.floor(m / 60)} 小時前` : `${Math.floor(m / 1440)} 天前`;
};

export default function Title() {
  const g = G(), S = g.S, has = g.hasSave(), nSaves = g.saveCount?.() ?? (g.hasSave() ? 1 : 0), mp = g.title.mp, user = window.SlimeCloud?.user;

  // Enter＝繼續遊戲（輸入框裡按 Enter 不算）
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Enter' || !G()?.title.on || G().title.mp || (e.target as HTMLElement).tagName === 'INPUT' || !document.getElementById('modal')?.hidden) return;
      (document.querySelector('[data-rx="title"] [data-act="tContinue"]') as HTMLElement | null)?.click();
    };
    addEventListener('keydown', onKey);
    return () => removeEventListener('keydown', onKey);
  }, []);

  return (
    <div className="rx-title">
      <div className="rx-title-col">
        <header className="rx-brand">
          <div className="rx-mascot"><SlimeArt kind="slime" color="#22d3ee" size={84} /></div>
          <div>
            <h1 className="rx-logo">SQUISH<span>LAB</span></h1>
            <p className="rx-logo-sub">史萊姆捏捏工坊</p>
          </div>
        </header>
        <p className="rx-tagline">親手把史萊姆捏成酥脆療癒的作品，再讓更多人聽見。</p>

        {!mp ? (
          <>
            {has && <SaveCard />}
            <nav className="rx-menu" aria-label="主選單">
              <button type="button" className="rx-mi primary" data-act="tContinue">
                <span className="rx-mi-ic"><Icon name="play" /></span>
                <span className="rx-mi-tx"><b>{has ? '繼續遊戲' : '開始遊戲'}</b><small>{has ? (nSaves > 1 ? `有 ${nSaves} 個存檔，按下後選擇` : `從上次離開的地方繼續 · ${ago(S.last)}`) : '從月光谷的中央平地出發'}</small></span>
                <kbd>Enter</kbd>
              </button>
              <button type="button" className="rx-mi" data-act="tMulti">
                <span className="rx-mi-ic"><Icon name="users" /></span>
                <span className="rx-mi-tx"><b>多人遊戲</b><small>建立或加入房間，和朋友一起捏</small></span>
                <Icon name="chevron" className="rx-mi-go" />
              </button>
              {has && (
                <button type="button" className="rx-mi subtle" data-act="tNew">
                  <span className="rx-mi-ic"><Icon name="plus" /></span>
                  <span className="rx-mi-tx"><b>新遊戲</b><small>{nSaves >= 3 ? '存檔已滿（3/3），需先刪除一個' : `目前進度會另存，最多 3 個存檔（${nSaves}/3）`}</small></span>
                  <Icon name="chevron" className="rx-mi-go" />
                </button>
              )}
            </nav>
            <div className="rx-quick">
              <button type="button" data-act="help"><Icon name="keyboard" />操作說明</button>
              <button type="button" data-act="sound"><Icon name={S.sound ? 'volume' : 'mute'} />音效{S.sound ? '開' : '關'}</button>
              {user?.admin && <a href="/admin" target="_blank" rel="noopener"><Icon name="shield" />管理後台</a>}
            </div>
          </>
        ) : (
          <section className="rx-mp" aria-label="多人遊戲">
            <div className="rx-mp-hd"><b>多人遊戲</b><small>每位玩家保有自己的存檔；位置、世界中的史萊姆與直播會即時同步。</small></div>
            <label className="rx-field"><span>玩家名稱</span><input id="mpName" maxLength={12} placeholder="你的名字" autoComplete="off" defaultValue={S.name || user?.name || ''} /></label>
            <button type="button" className="rx-mi primary" data-act="mpHost">
              <span className="rx-mi-ic"><Icon name="sparkle" /></span>
              <span className="rx-mi-tx"><b>建立房間</b><small>取得一組代碼分享給朋友</small></span>
            </button>
            <div className="rx-or"><span>或加入朋友的房間</span></div>
            <div className="rx-join">
              <input id="mpCode" maxLength={6} placeholder="房間代碼" autoComplete="off" aria-label="房間代碼" />
              <button type="button" className="btn" data-act="mpJoin">加入</button>
            </div>
            <div id="mpStatus" className="rx-mp-status" role="status" />
            <button type="button" className="rx-back" data-act="tBack"><Icon name="back" />返回主選單</button>
          </section>
        )}

        <footer className="rx-title-foot">
          {user && <span className="rx-who"><span className="rx-avatar sm slime" dangerouslySetInnerHTML={{ __html: g.avatarSVG?.(g.S.avatar || 'mint') || '' }} />{user.name}</span>}
          <a href="/privacy" target="_blank" rel="noopener">隱私權政策</a>
          <span>月光谷 · 史萊姆捏捏工坊</span>
        </footer>
      </div>
    </div>
  );
}

// 存檔卡：暱稱、等級、上次遊玩，以及錢、粉絲、已發現區域、設備
function SaveCard() {
  const g = G(), S = g.S, name = S.name || window.SlimeCloud?.user?.name || '工坊主人', lv = g.xpLevel(S.xp); // xpLevel 本身就從 1 起算（和 HUD 經驗條同一個數字）
  const owned = Object.keys(S.own || {}).filter((k) => S.own[k]).length, ownMax = Object.keys(g.OWN).length;
  return (
    <section className="rx-save" aria-label="目前存檔">
      <span className="rx-avatar slime" dangerouslySetInnerHTML={{ __html: g.avatarSVG?.(S.avatar || 'mint') || '' }} />
      <div className="rx-save-main">
        <div className="rx-save-hd"><b>{name}</b><span className="rx-lvl">Lv {lv}</span><small>{ago(S.last)}</small></div>
        <div className="rx-save-stats">
          <span><em>資金</em><b className="gold">{g.fmt(S.money)}</b></span>
          <span><em>粉絲</em><b>{Math.floor(S.fans).toLocaleString()}</b></span>
          <span><em>設備</em><b>{owned}/{ownMax}</b></span>
          <span className="rx-zones" title={`已發現區域 ${S.zones.length}/${g.ZONES.length}`}>
            <em>區域</em>
            <b>{S.zones.length}/{g.ZONES.length}　{g.ZONES.filter((z) => S.zones.includes(z.id)).map((z) => z.name).join('、')}</b>
          </span>
        </div>
      </div>
    </section>
  );
}
