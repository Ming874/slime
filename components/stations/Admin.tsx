'use client';
/* 管理員控制台（筆記本的「管理員」分頁，只有管理員帳號看得到）：資金與經驗、時間、傳送、解鎖、補給、FPS。
   按鈕帶 data-act="adm" data-k="指令"，由 game.js 的 admAct() 處理；只改自己的存檔。 */
import { G } from './game';

export default function Admin() {
  const g = G(), S = g.S, user = window.SlimeCloud?.user;
  if (!user?.admin) return <p className="rx-dim">只有管理員帳號可以使用控制台。</p>;
  const lv = g.xpLevel(S.xp), dn = g.DN, tp = g.ADM_TP || {};
  const B = ({ k, children, hint }: { k: string; children: React.ReactNode; hint?: string }) => (
    <button type="button" className="rx-adm-btn" data-act="adm" data-k={k} title={hint}>{children}</button>
  );
  return (
    <div className="rx-admin">
      <div className="rx-adm-hd"><b>管理員控制台</b><span className="tag">只改你自己的存檔</span></div>
      <div className="rx-adm-stat">
        <span><em>資金</em><b>{g.fmt(S.money)}</b></span><span><em>粉絲</em><b>{Math.floor(S.fans)}</b></span>
        <span><em>等級</em><b>Lv {lv}</b></span><span><em>時段</em><b>{dn ? g.DN_PHASE?.[dn.phase] : '—'}</b></span>
      </div>
      <section><h4>資金與經驗</h4><div className="rx-adm-row">
        <B k="money:1000">資金 +1,000</B><B k="money:10000">資金 +10,000</B><B k="fans:100">粉絲 +100</B><B k="lv">升一級</B>
      </div></section>
      <section><h4>時間</h4><div className="rx-adm-row">
        <B k="time:day">白天</B><B k="time:dusk">黃昏</B><B k="time:night">夜晚</B><B k="time:dawn">黎明</B><B k="time:real">回到真實時間</B>
      </div></section>
      <section><h4>傳送</h4><div className="rx-adm-row">
        {Object.entries(tp).map(([k, v]) => <B key={k} k={`tp:${k}`}>{(v as [string])[0]}</B>)}
      </div></section>
      <section><h4>解鎖與補給</h4><div className="rx-adm-row">
        <B k="zones" hint="四個區域、能量門、山洞與保暖衣">解鎖全部區域</B><B k="own">取得全部設備</B><B k="gel">凝膠每種 +10</B><B k="warm">體溫回滿</B><B k="slimes">附近生成 5 隻史萊姆</B>
      </div></section>
      <section><h4>檢查</h4><div className="rx-adm-row"><B k="fps">顯示／隱藏 FPS</B></div></section>
    </div>
  );
}
