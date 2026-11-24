'use client';
/* 加工產線（機器控制面板）。
   - 待機：選凝膠、選切法、啟動產線、上一個成品的評等卡、機器等級。
   - 運轉中：三道工序的燈號、操作說明、小遊戲。小遊戲裡每格畫面會動的元素（#mgNeedle、#mgTime、#mgTgt、#mgKnob、
     #cutDots 的刀痕）由 game.js 直接更新，這裡只負責擺出來。按鈕帶 data-act／data-mg，由 game.js 處理。 */
import { G, pct, prodName, type Product } from './game';
import { Pips, SlimeArt } from './Art';

type MakeState = {
  sp: string | null; active: boolean; step: number; phase: string; cut: string | null; steps: number[];
  scores: (number | null)[]; coop: { name: string } | null; last: Product | null;
  g: { marks: number[]; hit: (number | null)[]; combo?: number; lastQ?: number; cuts?: number; lo: number; hi: number; v?: number } | null;
};
type MakeGame = { M: MakeState; MG: { name: string; how: string; key: string }[]; STEPS: string[]; MKEY: string[]; ownAny: () => boolean; TOUCH: boolean };

const grade = (q: number) => (q > 0.9 ? 'pf' : q > 0.6 ? 'ok' : q > 0.3 ? 'meh' : 'bad');
const GRADE_TXT: Record<string, string> = { pf: '完美', ok: '很好', meh: '有點歪', bad: '失手' };

export default function Make() {
  const g = G(), x = g as unknown as MakeGame, M = x.M;
  return <div className={`rx-make${M.active ? ' run' : ''}`}>{M.active && M.g ? <Running /> : <Idle />}</div>;
}

function Idle() {
  const g = G(), x = g as unknown as MakeGame, S = g.S, M = x.M, sp = M.sp ? g.SP[M.sp] : null, have = M.sp ? S.gel[M.sp] || 0 : 0;
  const owned = x.MKEY.filter((k) => S.own[k]);
  const why = !x.ownAny() ? '還沒有任何加工機器' : !M.sp ? '先選一種凝膠' : have < 2 ? '凝膠不足（需要 2 份）' : S.stock.length >= g.cap() ? '庫存已滿' : '';
  return (
    <>
      <section className="rx-mk-sec">
        <h4>投入凝膠 <small>每次消耗 2 份</small></h4>
        <div className="rx-gelrow">
          {g.unlockedSpecies().map((s) => {
            const n = S.gel[s.id] || 0;
            return (
              <button key={s.id} type="button" className={`rx-gel${M.sp === s.id ? ' on' : ''}${n < 2 ? ' low' : ''}`} data-act="pickSp" data-id={s.id}>
                <SlimeArt kind="gel" color={s.color} color2={s.color2} size={34} />
                <span><b>{g.short(s.id)}</b><small>凝膠 {n}</small></span>
              </button>
            );
          })}
        </div>
      </section>

      {S.own.slicer && (
        <section className="rx-mk-sec">
          <h4>切法 <small>成品會保留切面，訂單可能指定切法</small></h4>
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
          <small>{owned.length ? `已安裝：${owned.map((k) => g.UPS[k].name.replace('升級', '')).join('、')}。缺少的機器步驟以 0 分計算。` : '尚未購買任何機器，到工作電腦的「網購」購買。'}庫存 {S.stock.length}/{g.cap()}</small>
        </div>
        <button type="button" className="rx-start" data-act="startMake" disabled={!!why} title={why || undefined}>
          <i aria-hidden="true" />{why || '啟動產線'}
        </button>
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

// 上一個成品：評等印章、酥脆度、切面
function Result({ p }: { p: Product }) {
  const g = G(), sp = g.SP[p.sp], c = Math.round(p.crisp * 100), cut = p.cut ? g.CUTS[p.cut] : null, rank = c >= 90 ? 'S' : c >= 70 ? 'A' : c >= 45 ? 'B' : 'C';
  return (
    <div className={`rx-result r${rank}`}>
      <div className="rx-result-art"><SlimeArt kind="prod" color={sp.color} color2={sp.color2} cut={p.cut} size={70} /></div>
      <div className="rx-result-body">
        <b>{prodName(g, p)}・{cut ? `${cut.n}切` : '酥脆'}捏捏</b>
        <div className="rx-result-bar"><span className="rx-bar"><i style={{ width: `${c}%` }} /></span><em>酥脆 {c}%</em></div>
        <small>{p.cut ? `切面${(p.cq || 0) > 0.85 ? '平整發亮' : (p.cq || 0) > 0.5 ? '還算平整' : '有點歪'}・` : ''}已放入背包，可拿到裝飾桌加工或直播販售。</small>
      </div>
      <span className="rx-rank" aria-label={`評等 ${rank}`}>{rank}</span>
    </div>
  );
}

function Running() {
  const g = G(), x = g as unknown as MakeGame, M = x.M, mg = M.g!, step = M.step, S = g.S;
  const C = (M.cut && g.CUTS[M.cut]) || g.CUTS.thick;
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
        <span>{x.MG[step].how}</span>
        {!x.TOUCH && <kbd>{x.MG[step].key}</kbd>}
        {M.phase === 'ready' && <em className="rx-ready">準備…</em>}
      </div>

      {step === 0 && (
        <div className="rx-slice">
          <div className="cutdots rx-cutdots" id="cutDots">
            {mg.marks.map((_, i) => { const h = mg.hit[i]; return <i key={i} className={h == null ? '' : h > 0.85 ? 'pf' : h > 0.3 ? 'ok' : 'bad'} />; })}
          </div>
          <div className="rx-slice-info">
            <span><b style={{ color: C.col }}>{C.n}切</b>・{mg.marks.length} 刀。發光的切割線碰到<b className="rx-laser">紅色雷射</b>時{x.TOUCH ? '在畫面上由上往下滑一刀' : '按空白鍵或點擊畫面'}</span>
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
          <p className="rx-note-line">左右拖曳火力旋鈕{x.TOUCH ? '' : '，或按 ← →'}，跟上黃色的目標溫度。</p>
        </div>
      )}
    </>
  );
}
