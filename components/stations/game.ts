/* game.js 的 window.SlimeGame：遊戲狀態與計算函式（定義在 public/game/game.js 的「給 React 介面用」）。
   規則（價格、需求、訂單…）只有 game.js 一份，這裡只讀不改；要改資料就讓按鈕帶 data-act，由 game.js 的點擊處理。 */

export type Species = { id: string; name: string; zone: string; color: string; color2?: string; rar: number; price: number };
export type Deco = { k: string };
export type Product = { id: number; sp: string; crisp: number; dur: number; deco: Deco[]; cut?: string; cq?: number; wonky?: boolean; crude?: boolean; played?: boolean };
export type InvItem = { t: 'gel'; sp: string; n: number } | { t: 'prod'; p: Product };
export type Order = { id: number; sp: string; cut: string | null; n: number; min: number; reward: number; fans: number };
export type Review = { s: number; who: string; t: string; sp: string };
export type State = {
  money: number; fans: number; earned: number; xp: number; gel: Record<string, number>; stock: Product[]; web: Product[]; show: Product[];
  zones: string[]; packs: string[]; up: Record<string, number>; own: Record<string, boolean>; codex: Record<string, { made: number }>;
  reviews: Review[]; hb: number; done: boolean; wk: { w: number; done: number[] }; name?: string; last: number; sound: boolean; sens: number;
};
type Up = { name: string; desc: string; max: number; mach?: number; need?: string };
type Own = { name: string; cost: number; shop: string; desc: string };

export type Game = {
  S: State; M: { sp: string | null }; BN: { busy: boolean }; NET: { on: boolean; me: string; players: Map<string, { name: string; color: string; show?: { sp: string; cut?: string; cr: number }[] }> };
  trend: { sp: string | null }; invSel: number | null; tab: string; kind: string | null; likeT: () => Record<string, number>;
  title: { on: boolean; mp?: boolean }; hasSave: () => boolean; saveCount?: () => number; fmtTime: (t?: number) => string; SENS_N: string[]; XP_LV: number[]; xpLevel: (xp: number) => number;
  SP: Record<string, Species>; SPECIES: Species[]; ZONES: { id: string; name: string; acc: string }[]; RAR: ({ n: string; c: string } | null)[];
  UPS: Record<string, Up>; OWN: Record<string, Own>; PACKS: Record<string, { name: string; cost: number }>;
  DECO: Record<string, { n: string; c: string; pack: string }>; CUTS: Record<string, { n: string; col: string; desc: string }>;
  TIER: { n: string; m: number }[]; GOAL: { species: number; fans: number; earned: number }; SHOP_UPS: Record<string, string[]>;
  QUEST: Record<string, { title: string; hint: string; from: string; need: number }>; PILLAR: string[]; TABLET_TXT: string; WEEK_MS: number;
  fmt: (n: number) => string; cap: () => number; slots: () => number; upCost: (k: string) => number; effCrisp: (p: Product) => number;
  fair: (p: Partial<Product> & { sp: string }, ch: string) => number; rating: () => number; priceOf: (p: Product, ch: string) => number;
  weeklyOrders: () => Order[]; wkItems: (o: Order) => Product[]; weekNo: () => number; invItems: () => InvItem[]; short: (id: string) => string;
  farmLeft: () => number; fmtSec: (s: number) => string; unlockedSpecies: () => Species[]; tierOf: (ch: string, sp: string) => number;
  defPrice: (sp: string, ch: string) => number; demand: (price: number, f: number) => number; speedTxt: (d: number) => string;
  qState: () => { pil: number[]; map: number[]; frags: number[]; notes: number[]; tide: number[]; read: Record<string, boolean> };
  nextQuest: () => string | null; questReady: (k: string) => boolean; madeIn: (zone: string) => number;
  pillarClues: (pil: number[]) => { ok: boolean }[]; pSp: (v: number) => Species; pillarExtra: () => string; hintBlock: (k: string) => string;
  tideStepsHTML: () => string; cluesDone: () => number; mapImage: () => string; enter: () => string;
};

declare global {
  interface Window { SlimeGame?: Game }
}

export const G = () => window.SlimeGame as Game;

// 捏捏的名字：歪歪／粗製＋種類（切法另外標）
export const prodName = (g: Game, p: Product) => `${p.wonky ? '歪歪' : ''}${p.crude ? '粗製' : ''}${g.short(p.sp)}`;
export const pct = (x: number) => `${Math.round(x * 100)}%`;
export const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));
export const stars = (r: number) => '★'.repeat(Math.round(r)) + '☆'.repeat(5 - Math.round(r));
