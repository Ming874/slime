/* game.js 的 window.SlimeGame：遊戲狀態與計算函式（定義在 public/game/game.js 的「給 React 介面用」）。
   規則（價格、需求、訂單…）只有 game.js 一份，這裡只讀不改；要改資料就讓按鈕帶 data-act，由 game.js 的點擊處理。 */

export type Species = { id: string; name: string; zone: string; color: string; color2?: string; rar: number; price: number; night?: boolean };
export type Deco = { k: string };
export type Product = { id: number; sp: string; crisp: number; dur: number; deco: Deco[]; cut?: string; cq?: number; wonky?: boolean; crude?: boolean; played?: boolean };
// 成品的等級章（game.js 的 GRADES）：看做好時的酥脆（p.crisp，捏過也不變），m＝售價倍率
export type Grade = { g: 'S' | 'A' | 'B' | 'C'; min: number; m: number };
export type InvItem = { t: 'gel'; sp: string; n: number } | { t: 'prod'; p: Product };
export type Order = { id: number; sp: string; cut: string | null; n: number; min: number; reward: number; fans: number };
export type Review = { s: number; who: string; t: string; sp: string };
export type State = {
  money: number; fans: number; earned: number; xp: number; gel: Record<string, number>; stock: Product[]; web: Product[]; show: Product[];
  zones: string[]; packs: string[]; up: Record<string, number>; own: Record<string, boolean>; codex: Record<string, { made: number }>;
  ship?: Ship[]; wish?: Record<string, number>; shopSeen?: Record<string, number>;
  reviews: Review[]; hb: number; done: boolean; wk: { w: number; done: number[] }; name?: string; last: number; sound: boolean; sens: number; vol?: { music: number; sfx: number }; quality?: string; avatar?: string;
};
type Up = { name: string; desc: string; max: number; mach?: number; need?: string };
type Own = { name: string; cost: number; shop: string; desc: string };

export type Game = {
  S: State; M: { sp: string | null }; BN: { busy: boolean; gift?: number }; NET: { on: boolean; me: string; players: Map<string, { name: string; color: string; show?: { sp: string; cut?: string; cr: number }[] }> };
  trend: { sp: string | null }; invSel: number | null; tab: string; kind: string | null; likeT: () => Record<string, number>;
  title: { on: boolean; mp?: boolean }; inCity?: boolean; riding?: boolean; rideDir?: string; hasSave: () => boolean; saveCount?: () => number; fmtTime: (t?: number) => string; SENS_N: string[]; XP_LV: number[]; xpLevel: (xp: number) => number;
  SP: Record<string, Species>; SPECIES: Species[]; ZONES: { id: string; name: string; acc: string }[]; RAR: ({ n: string; c: string } | null)[];
  UPS: Record<string, Up>; OWN: Record<string, Own>; PACKS: Record<string, { name: string; cost: number }>;
  DECO: Record<string, { n: string; c: string; pack: string; v: number }>; CUTS: Record<string, { n: string; col: string; desc: string; pm: number }>;
  TOUCH: boolean; GRADES: Grade[]; GOAL: { species: number; fans: number; earned: number }; SHOP_UPS: Record<string, string[]>;
  QUEST: Record<string, { title: string; hint: string; from: string; need: number }>; PILLAR: string[]; TABLET_TXT: string; WEEK_MS: number;
  fmt: (n: number) => string; cap: () => number; slots: () => number; upCost: (k: string) => number; effCrisp: (p: Product) => number;
  fair: (p: Partial<Product> & { sp: string }, ch: string) => number; rating: () => number; priceOf: (p: Product, ch: string) => number;
  weeklyOrders: () => Order[]; wkItems: (o: Order) => Product[]; weekNo: () => number; invItems: () => InvItem[]; short: (id: string) => string;
  farmLeft: () => number; fmtSec: (s: number) => string; unlockedSpecies: () => Species[];
  gradeOf: (p: Partial<Product> & { sp: string }) => Grade; priceWhy: (p: Product, ch: string) => string; packPct: (k: string) => string;
  qState: () => { pil: number[]; map: number[]; frags: number[]; notes: number[]; tide: number[]; read: Record<string, boolean> };
  nextQuest: () => string | null; questReady: (k: string) => boolean; madeIn: (zone: string) => number;
  pillarClues: (pil: number[]) => { ok: boolean }[]; pSp: (v: number) => Species; pillarExtra: () => string; hintBlock: (k: string) => string;
  DN?: { phase: string; night: number; p: number }; DN_PHASE?: Record<string, string>; creditsHTML?: () => string;
  AVATARS?: { id: string; n: string; c: string; d: string }[]; avatarSVG?: (id: string) => string;
  tideStepsHTML: () => string; cluesDone: () => number; mapImage: () => string; enter: () => string;
  eggs?: () => Egg[];
  mapView?: () => MapView; mapDraw?: (c: HTMLCanvasElement) => void; // 筆記本的手繪地圖（public/game/map.js）
  ship?: Ship[]; wareState?: (t: string, k: string) => WareState | null;
  paper?: () => PaperData | null; papers?: () => PaperRow[]; paperAt?: (i: number) => PaperData | null; paperOf?: (id: string) => PaperData | null; rcptView?: (d: Rcpt) => PaperData;
  clip?: () => number; hasPaper?: (id: string) => boolean; postcardImg?: (z: string) => string;
};
// 手上的紙（game.js 的 paperView）：v＝letter／note／postcard／receipt；b＝內文每一行；rev＝字已經寫好；live＝要跑墨水；hint＝右下按鍵提示的透明度
export type Rcpt = { n: number; inc: number; tip: number; fan: number; sec: number; t: number; torn?: number };
export type PaperData = {
  id: string; v: string; name: string; head: string; b: string[]; sig: string; zone: string; zoneName: string; acc: string; gift: boolean; torn?: boolean; d: Rcpt | null;
  who: string; day: string; touch: boolean; rm: boolean; rev: number; flip: number; live: number; hint: number | boolean; seq: number;
};
// 手帳剪貼區的一張（i＝S.papers 的索引，新的在前）
export type PaperRow = { i: number; id: string; v: string; name: string; zone: string; gift: boolean; torn?: boolean; t: number; isNew: boolean };
// 付了錢、還沒演的到貨（氣球木箱）；商品狀態（城市與網購共用的規則）
export type Ship = { k: string; via: 'city' | 'web'; at: number };
export type WareState = { id: string; t: string; k: string; name: string; cost: number; can: boolean; why: '' | 'has' | 'max' | 'need' | 'poor'; d: number; lv: number; max: number; need: string; go: 'ship' | 'bag' | 'wear' };
// 筆記本的手繪地圖（map.js 的 nmView）：x、y 是地圖寬高的百分比；w、h＝地圖範圍（基礎單位，決定長寬比）、cw、ch＝畫布像素；
// seq＝第幾次翻到這一頁；me＝鉛筆圈（rot＝朝向，度）；gate＝谷口「往大城市」的箭頭；lb＝名字預設寫在貼紙哪一邊；labels[].c＝地名可以寫的位置（照順序，NoteMap.tsx 挑不碰到東西的那個）
export type MapPt = { x: number; y: number };
export type MapView = {
  w: number; h: number; cw: number; ch: number; seq: number; pct: number; city: boolean; cave: boolean; touch: boolean;
  me: (MapPt & { rot: number }) | null; gate: MapPt | null; labels: { id: string; t: string; c: MapPt[] }[];
  stickers: (MapPt & { id: string; kind: string; name: string; lb: string })[]; eggs: (MapPt & { id: string; name: string; zone: string })[];
  eggN: number; eggT: number; lmN: number; lmT: number;
};
// 月光谷的小秘密（彩蛋）：id 開頭是區域（forest_／coast_／volcano_／snow_／city_）
export type Egg = { id: string; name: string; hint: string; found: boolean };

declare global {
  interface Window { SlimeGame?: Game }
}

export const G = () => window.SlimeGame as Game;

// 捏捏的名字：歪歪／粗製＋種類（切法另外標）
export const prodName = (g: Game, p: Product) => `${p.wonky ? '歪歪' : ''}${p.crude ? '粗製' : ''}${g.short(p.sp)}`;
export const pct = (x: number) => `${Math.round(x * 100)}%`;
export const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));
export const stars = (r: number) => '★'.repeat(Math.round(r)) + '☆'.repeat(5 - Math.round(r));
