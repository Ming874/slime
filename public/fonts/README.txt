這個資料夾的字型都是霞鶩文楷 TC（LXGW WenKai TC）的子集。
作者：LXGW 與 LXGW WenKai Project Authors（https://github.com/lxgw/LxgwWenkaiTC）
授權：SIL Open Font License 1.1，全文見 OFL-LXGW-WenKai-TC.txt（散布時要附上）

signs.woff2：粗體的子集，只含木頭告示牌用到的字（取得方式：Google Fonts css2 的 text= 子集，family=LXGW+WenKai+TC:wght@700，v1.330）。
            重新產生時 text= 放原本檔案裡的字＋程式裡 artText(...) 的字串用到的字，原本的字才不會掉。
hand.woff2：Regular v1.530 的子集，含遊戲畫面（原始碼）裡出現的所有字，給手寫風格的介面用（筆記本、區名大字、對話泡泡等；talk.js 也在掃描範圍內），
            CSS 的字型名稱是 "Slime Hand"（app/game.css）。改了介面文字之後用 scripts/hand-font.py 重新產生。
