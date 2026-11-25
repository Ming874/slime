# 產生 public/fonts/hand.woff2：霞鶩文楷 TC（LXGW WenKai TC）Regular 的子集，只含遊戲畫面會出現的字。
# 改了介面文字（出現新的字）之後重跑一次：
#   1. 下載字型：https://github.com/lxgw/LxgwWenkaiTC/releases （LXGWWenKaiTC-Regular.ttf，SIL OFL 1.1）
#   2. pip install fonttools brotli
#   3. python3 scripts/hand-font.py <LXGWWenKaiTC-Regular.ttf 的路徑>
import pathlib, sys
from fontTools import subset

root = pathlib.Path(__file__).resolve().parent.parent
src = sys.argv[1] if len(sys.argv) > 1 else 'LXGWWenKaiTC-Regular.ttf'
files = sorted((root / 'public/game').glob('*.js')) + [root / 'game/dom.html', root / 'server/server.js']  # public/game 底下所有的遊戲程式（含 talk.js、region-*.js）
for d in ['components', 'app', 'lib']:
    files += [p for p in (root / d).rglob('*') if p.suffix in ('.tsx', '.ts', '.css') and p.is_file()]
chars = set(chr(c) for c in range(0x20, 0x7f))  # 完整 ASCII
chars |= set(chr(c) for c in range(0x3000, 0x3040))  # 全形標點
chars |= set(chr(c) for c in range(0xff01, 0xff5f))  # 全形英數與標點
chars |= set('¥·×÷…—–‘’“”•★☆♪♫♥♡→←↑↓✓✔✗✕○●◎△▲▼◆◇□■※～')
for f in files:
    try:
        chars |= set(ch for ch in f.read_text(encoding='utf-8') if ord(ch) > 0x7f and not 0xd800 <= ord(ch) <= 0xdfff and ch != '﻿')
    except Exception:
        pass
opts = subset.Options(); opts.flavor = 'woff2'; opts.layout_features = ['*']; opts.hinting = False
font = subset.load_font(src, opts); sub = subset.Subsetter(opts); sub.populate(text=''.join(chars)); sub.subset(font)
out = root / 'public/fonts/hand.woff2'; subset.save_font(font, str(out), opts)
print(f'{len(chars)} 個字 → {out}（{out.stat().st_size // 1024} KB）')
