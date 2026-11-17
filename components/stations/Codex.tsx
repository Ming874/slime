'use client';
/* 圖鑑：手帳裡是一頁頁的標本紀錄（依區域分組，貼著照片、蓋上稀有度印章、用正字記數）；
   在工作電腦裡則像百科網站。上方是終局目標「夢想清單」。 */
import { G, clamp } from './game';
import { SlimeArt } from './Art';

export default function Codex() {
  const g = G(), S = g.S;
  const made = g.SPECIES.filter((s) => (S.codex[s.id]?.made || 0) > 0).length;
  const goals: [string, number, number][] = [['製作過所有種類', made, g.GOAL.species], ['粉絲數', Math.floor(S.fans), g.GOAL.fans], ['累積營收', Math.floor(S.earned), g.GOAL.earned]];
  const ok = goals.every(([, v, m]) => v >= m);
  const found = g.SPECIES.filter((s) => S.codex[s.id]).length;
  return (
    <div className="rx-codex">
      <section className="rx-dream">
        <div className="rx-dream-hd"><b>夢想清單</b><span>開設「夢想捏捏博物館」</span></div>
        <p className="rx-note-line">探索月光谷的所有區域，讓全世界都聽見史萊姆的酥脆聲。</p>
        <ul>
          {goals.map(([label, v, m]) => (
            <li key={label} className={v >= m ? 'done' : ''}>
              <i className="rx-check" aria-hidden="true" />
              <span>{label}</span>
              <em>{v.toLocaleString()} / {m.toLocaleString()}</em>
              <span className="rx-bar"><i style={{ width: `${clamp((v / m) * 100, 0, 100)}%` }} /></span>
            </li>
          ))}
        </ul>
        <button className="btn" data-act="finish" disabled={!ok || S.done}>{S.done ? '夢想已達成' : '完成夢想'}</button>
      </section>

      <div className="rx-codex-hd"><h3>史萊姆圖鑑</h3><span>已發現 {found}/{g.SPECIES.length}</span></div>
      {g.ZONES.map((z) => {
        const open = S.zones.includes(z.id);
        return (
          <section className={`rx-zone${open ? '' : ' closed'}`} key={z.id} style={{ '--zc': z.acc } as React.CSSProperties}>
            <h4><i aria-hidden="true" />{z.name}{!open && <small>尚未開放</small>}</h4>
            <div className="rx-specs">
              {g.SPECIES.filter((s) => s.zone === z.id).map((s) => {
                const c = S.codex[s.id], rar = g.RAR[s.rar]!;
                return (
                  <article key={s.id} className={`rx-spec ${c ? 'found' : open ? 'unseen' : 'locked'}`}>
                    <div className="rx-spec-pic">
                      {c ? <SlimeArt kind="slime" color={s.color} color2={s.color2} size={78} title={s.name} /> : <SlimeArt kind={open ? 'ghost' : 'lock'} size={64} />}
                    </div>
                    <div className="rx-spec-info">
                      <b>{c ? s.name : '？？？'}</b>
                      <span className="rx-rar" style={{ '--rc': rar.c } as React.CSSProperties}>{rar.n}</span>
                      <small>{c ? `已製作 ${c.made} 個` : open ? `在${z.name}還沒遇過` : '區域尚未開放'}</small>
                      {c && c.made > 0 && <Tally n={c.made} />}
                    </div>
                    {c && <span className="rx-seal" aria-hidden="true">收錄</span>}
                  </article>
                );
              })}
            </div>
          </section>
        );
      })}
    </div>
  );
}

// 正字記數（每 5 個一組，最多畫 4 組）
function Tally({ n }: { n: number }) {
  const groups = Math.min(4, Math.ceil(n / 5));
  return (
    <span className="rx-tally" aria-label={`已製作 ${n} 個`}>
      {Array.from({ length: groups }, (_, i) => <i key={i} data-n={Math.min(5, n - i * 5)} />)}
      {n > 20 && <em>+{n - 20}</em>}
    </span>
  );
}
