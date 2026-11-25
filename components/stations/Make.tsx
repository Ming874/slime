'use client';
/* 加工產線（機器控制面板）。
   - 待機：選凝膠、選切法、啟動產線、上一個成品的評等卡、機器等級。
     加工個性（game.js 的 QUIRK）：凝膠按鈕角上掛的小牌子（不撐寬按鈕）＋奶奶貼在面板上的便條（運轉中只留小牌子，不把量表擠出面板）；
     熟練代工：啟動那一排裡的「代工記憶」10 盞燈，亮滿了「交給機器」就出現在「啟動產線」旁邊（不另外佔一排、不用往下捲才找得到）。
   - 運轉中：三道工序的燈號、操作說明、小遊戲。小遊戲裡每格畫面會動的元素（#mgNeedle、#mgTime、#mgTgt、#mgKnob、
     #cutDots 的刀痕）由 game.js 直接更新，這裡只負責擺出來。按鈕帶 data-act／data-mg，由 game.js 處理。 */
import { G, pct, prodName, type Product } from './game';
import { Pips, SlimeArt } from './Art';

// rsp＝這一輪開工時鎖定的種類（手作台換凝膠不影響）；lit＝剛學會的那一種（代工記憶的燈一盞一盞亮起來）
type MakeState = {
  sp: string | null; rsp?: string | null; lit?: string | null; active: boolean; auto?: boolean; step: number; phase: string; cut: string | null; steps: number[];
  scores: (number | null)[]; coop: { name: string } | null; last: Product | null;
  g: { marks: number[]; hit: (number | null)[]; combo?: number; lastQ?: number; cuts?: number; lo: number; hi: number; v?: number } | null;
};
// 加工個性：m＝哪一台（0 切片、1 裹糖、2 乾燥）、tag＝小牌子、t＝奶奶的便條
type Quirk = { m: number; tag: string; t: string; jump?: number }; // jump：極光的乾燥目標會變色（操作說明不能再說「黃色」）
type MakeGame = { M: MakeState; MG: { name: string; how: string; key: string }[]; STEPS: string[]; MKEY: string[]; ownAny: () => boolean; TOUCH: boolean; QUIRK: Record<string, Quirk>; MASTER_N: number; AUTO_T: number };

const grade = (q: number) => (q > 0.9 ? 'pf' : q > 0.6 ? 'ok' : q > 0.3 ? 'meh' : 'bad');
const GRADE_TXT: Record<string, string> = { pf: '完美', ok: '很好', meh: '有點歪', bad: '失手' };

export default function Make() {
  const g = G(), x = g as unknown as MakeGame, M = x.M;
  return <div className={`rx-make${M.active ? ' run' : ''}`}>{M.active && M.g ? (M.auto ? <Auto /> : <Running />) : <Idle />}</div>;
}

// 奶奶貼在控制面板上的便條（手寫字）：這種史萊姆在哪一台機器上不一樣；那台還沒買就補一句「等你有了…就知道」
function QuirkNote({ sp }: { sp: string }) {
  const g = G(), x = g as unknown as MakeGame, q = x.QUIRK[sp];
  if (!q) return null;
  const k = x.MKEY[q.m], own = g.S.own[k];
  return (
    <div className="rx-quirk">
      <i className="rx-quirk-tape" aria-hidden="true" />
      <p><b>{g.short(sp)}・{x.STEPS[q.m]}</b>{q.t}{!own && <span className="rx-quirk-off">等你有了{g.UPS[k].name.replace('升級', '')}就知道了。</span>}</p>
      <em>— 奶奶</em>
    </div>
  );
}

// 熟練代工：同一種親手做出 MASTER_N 件 A 級以上，啟動那一排裡的「代工記憶」燈一盞一盞亮起來；亮滿了「交給機器」出現在「啟動產線」旁邊
const masterN = (x: MakeGame, sp: string) => Math.min(x.MASTER_N, G().S.codex[sp]?.a || 0);
function Mastery({ sp, lit }: { sp: string; lit: boolean }) {
  const g = G(), x = g as unknown as MakeGame, n = masterN(x, sp), done = n >= x.MASTER_N;
  return (
    <div className={`rx-master${done ? ' on' : ''}${lit ? ' lit' : ''}`}>
      <b>代工記憶</b>
      <span className="rx-master-leds" aria-label={`${n}/${x.MASTER_N}`}>{Array.from({ length: x.MASTER_N }, (_, i) => <i key={i} className={i < n ? 'on' : ''} style={lit ? ({ '--d': i * 0.07 } as React.CSSProperties) : undefined} />)}</span>
      <small>{done ? `產線記得你做${g.short(sp)}的手法：普通的交給機器 ${x.AUTO_T} 秒做出 B 級，想要 S、A 再自己來。` : `親手做出 A 級以上 ${n}/${x.MASTER_N} 件，產線就學得會，普通的可以交給機器。`}</small>
    </div>
  );
}

// 交給機器的那一輪：三台的燈照樣一台一台亮，只有一條進度（#mgAuto 由 game.js 更新）；可以關掉面板走開，做好了自己放進背包
function Auto() {
  const g = G(), x = g as unknown as MakeGame, M = x.M, S = g.S;
  return (
    <>
      <div className="rx-stages">
        {x.STEPS.map((name, i) => {
          const own = S.own[x.MKEY[i]], done = M.scores[i] != null && i !== M.step;
          return <span key={name} className={`rx-stage${!own ? ' off' : i === M.step ? ' now' : done ? ' done' : ''}`}><i aria-hidden="true" /><b>{i + 1}. {name}</b><small>{!own ? '未安裝' : done ? '好了' : i === M.step ? '機器在做' : '待命'}</small></span>;
        })}
      </div>
      <div className="rx-mk-how"><b>交給機器</b><span>產線照你做{M.rsp ? g.short(M.rsp) : ''}的手法自己動，{x.AUTO_T} 秒做出一個 B 級。可以先去忙別的，做好了會放進背包。</span></div>
      <div className="tbar rx-tbar rx-autobar"><i id="mgAuto" /></div>
    </>
  );
}

function Idle() {
  const g = G(), x = g as unknown as MakeGame, S = g.S, M = x.M, sp = M.sp ? g.SP[M.sp] : null, have = M.sp ? S.gel[M.sp] || 0 : 0;
  const owned = x.MKEY.filter((k) => S.own[k]);
  const why = !x.ownAny() ? '還沒有任何加工機器' : !M.sp ? '先選一種凝膠' : have < 2 ? '凝膠不足（需要 2 份）' : S.stock.length >= g.cap() ? '庫存已滿' : '';
  return (
    <>
      <section className="rx-mk-sec">
        <h4>投入凝膠 <small>每次 2 份</small></h4>
        <div className="rx-gelrow">
          {g.unlockedSpecies().map((s) => {
            const n = S.gel[s.id] || 0;
            const q = x.QUIRK[s.id];
            return (
              <button key={s.id} type="button" className={`rx-gel${M.sp === s.id ? ' on' : ''}${n < 2 ? ' low' : ''}`} data-act="pickSp" data-id={s.id}>
                <SlimeArt kind="gel" color={s.color} color2={s.color2} size={34} />
                <span><b>{g.short(s.id)}</b><small>凝膠 {n}</small></span>
                {q && <em className="rx-gel-tag">{q.tag}</em>}
              </button>
            );
          })}
        </div>
        {M.sp && <QuirkNote sp={M.sp} />}
      </section>

      {S.own.slicer && (
        <section className="rx-mk-sec">
          <h4>切法</h4>
          <div className="rx-cutrow">
            {Object.entries(g.CUTS).map(([k, c]) => (
              <button key={k} type="button" className={`rx-cut${(S as unknown as { cut?: string }).cut === k ? ' on' : ''}`} data-act="pickCut" data-k={k} style={{ '--cc': c.col } as React.CSSProperties}>
                <SlimeArt kind="prod" cut={k} color={sp?.color || '#94a3b8'} color2={sp?.color2} size={40} />
                <b>{c.n}</b><small>{c.desc}</small><em>售價 ×{(c as unknown as { pm: number }).pm}</em>
              </button>
            ))}
          </div>
        </section>
      )}

      <div className="rx-mk-go">
        <div className="rx-mk-go-info">
          <b>{sp ? `已選：${sp.name}` : '請先選擇要加工的凝膠'}</b>
          <small>{owned.length ? `已安裝：${owned.map((k) => g.UPS[k].name.replace('升級', '')).join('、')}・` : '還沒有機器，到工作電腦網購。'}庫存 {S.stock.length}/{g.cap()}</small>{/* 缺的機器：下面的工序列寫著「未安裝」、那一步算 0 分 */}
          {M.sp && x.ownAny() && <Mastery sp={M.sp} lit={M.lit === M.sp} />}
        </div>
        <div className="rx-mk-go-btns">
          {M.sp && x.ownAny() && masterN(x, M.sp) >= x.MASTER_N && (
            <button type="button" className="rx-start rx-auto" data-act="autoMake" disabled={!!why} title={why || undefined}>
              <i aria-hidden="true" />交給機器<small>{x.AUTO_T} 秒・B 級</small>
            </button>
          )}
          <button type="button" className="rx-start" data-act="startMake" disabled={!!why} title={why || undefined}>
            <i aria-hidden="true" />{why || '啟動產線'}
          </button>
        </div>
      </div>

      {M.last && <Result p={M.last} />}

      <div className="rx-legend">
        {x.MKEY.map((k, i) => (
          <span key={k} className={S.own[k] ? '' : 'off'}><b>{i + 1}</b>{x.STEPS[i]} · {g.UPS[k].name}<Pips lv={S.up[k] || 0} max={5} /></span>
        ))}
      </div>
    </>
  );
}

// 上一個成品：等級章（S～C，game.js 的 gradeOf：和售價用同一條規則）、酥脆度、切面、蓋了章以後的售價
function Result({ p }: { p: Product }) {
  const g = G(), sp = g.SP[p.sp], c = Math.round(p.crisp * 100), cut = p.cut ? g.CUTS[p.cut] : null, gr = g.gradeOf(p), rank = gr.g;
  return (
    <div className={`rx-result r${rank}`}>
      <div className="rx-result-art"><SlimeArt kind="prod" color={sp.color} color2={sp.color2} cut={p.cut} size={70} /></div>
      <div className="rx-result-body">
        <b>{prodName(g, p)}・{cut ? `${cut.n}切` : '酥脆'}捏捏</b>
        <div className="rx-result-bar"><span className="rx-bar"><i style={{ width: `${c}%` }} /></span><em>酥脆 {c}%</em></div>
        <small className="rx-result-pr"><b>{rank} 級・售價 ×{gr.m}</b>　直播 {g.fmt(g.priceOf(p, 'live'))}・網站 {g.fmt(g.priceOf(p, 'web'))}</small>
        <small>{p.cut ? `切面${(p.cq || 0) > 0.85 ? '平整發亮' : (p.cq || 0) > 0.5 ? '還算平整' : '有點歪'}・` : ''}收進背包了。</small>
      </div>
      <span className="rx-rank" aria-label={`等級 ${rank}，售價 ×${gr.m}`}>{rank}</span>
    </div>
  );
}

function Running() {
  const g = G(), x = g as unknown as MakeGame, M = x.M, mg = M.g!, step = M.step, S = g.S;
  const C = (M.cut && g.CUTS[M.cut]) || g.CUTS.thick;
  const q0 = M.rsp ? x.QUIRK[M.rsp] : null, qk = q0 && q0.m === step ? q0 : null, jump = !!qk?.jump; // 這一輪的種類（開工時鎖定）在這一台上的個性
  return (
    <>
      <div className="rx-stages">
        {x.STEPS.map((name, i) => {
          const own = S.own[x.MKEY[i]], sc = M.scores[i], done = sc != null && i !== step;
          return (
            <span key={name} className={`rx-stage${!own ? ' off' : i === step ? ' now' : done ? ' done' : ''}`}>
              <i aria-hidden="true" /><b>{i + 1}. {name}</b><small>{!own ? '未安裝' : done ? `${Math.round((sc || 0) * 100)}%` : i === step ? (M.phase === 'ready' ? '準備' : '運轉中') : '待命'}</small>
            </span>
          );
        })}
      </div>

      <div className="rx-mk-how">
        <b>{g.UPS[x.MKEY[step]].name}</b>
        {qk && <em className="rx-gel-tag" title={qk.t}>{g.short(M.rsp!)}・{qk.tag}</em>}
        {step === 1 && <span>{x.MG[step].how}</span>}{/* 切片、乾燥的說明就寫在小遊戲旁邊，不在這裡再說一次（前 10 分鐘的文字預算 11.1） */}
        {!x.TOUCH && <kbd>{x.MG[step].key}</kbd>}
        {M.phase === 'ready' && <em className="rx-ready">準備…</em>}
      </div>

      {step === 0 && (
        <div className="rx-slice">
          <div className="cutdots rx-cutdots" id="cutDots">
            {mg.marks.map((_, i) => { const h = mg.hit[i]; return <i key={i} className={h == null ? '' : h > 0.85 ? 'pf' : h > 0.3 ? 'ok' : 'bad'} />; })}
          </div>
          <div className="rx-slice-info">
            <span><b style={{ color: C.col }}>{C.n}切</b>・{mg.marks.length} 刀：切割線碰到<b className="rx-laser">紅色雷射</b>時{x.TOUCH ? '由上往下滑一刀' : '下刀'}</span>
            {(mg.combo || 0) >= 2 && <span className="rx-combo" key={`c${mg.combo}`}>{mg.combo} 連斬</span>}
          </div>
          {mg.cuts ? <div className={`rx-gradepop ${mg.lastQ! < 0 ? 'miss' : grade(mg.lastQ!)}`} key={mg.cuts}>{mg.lastQ! < 0 ? '空刀' : GRADE_TXT[grade(mg.lastQ!)]}{mg.lastQ! > 0.6 && <small>{pct(mg.lastQ!)}</small>}</div> : null}
        </div>
      )}

      {step === 1 && (
        <div className="rx-coat">
          <div className="gauge rx-gauge"><div className="gz" style={{ left: `${mg.lo * 100}%`, width: `${(mg.hi - mg.lo) * 100}%` }} /><i className="needle" id="mgNeedle" style={{ left: `${(mg.v ?? .5) * 100}%` }} /></div>
          <div className="tbar rx-tbar"><i id="mgTime" /></div>
          {M.coop
            ? <p className="rx-note-line"><b>{M.coop.name}</b> 正在幫你裹糖，看著滾筒轉吧！</p>
            : <button type="button" className="btn big hold rx-hold" id="mgHold" data-mg="hold">按住加速</button>}
        </div>
      )}

      {step === 2 && (
        <div className="rx-dry">
          <div className="track dry rx-track" id="mgDry"><div className="tgt" id="mgTgt" /><div className="knob" id="mgKnob" style={{ left: '50%' }} /></div>
          <div className="tbar rx-tbar"><i id="mgTime" /></div>
          <p className="rx-note-line">拖曳火力旋鈕，{jump ? `跟上一綠一紫、每 ${qk!.jump} 秒換邊的目標溫度（閃的時候準備換邊）。` : '跟上黃色的目標溫度。'}</p>
        </div>
      )}
    </>
  );
}
