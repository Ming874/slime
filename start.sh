#!/bin/sh
# 一個容器跑兩個程式：Node（/api/：Google 登入、雲端存檔）與 Caddy（網站檔案、轉發 /api/）。
# 任一個結束就把另一個也停掉、容器結束，交給平台重新啟動。
mkdir -p "$DATA_DIR"
# volume 掛上來時擁有者常是 root：先把擁有者改成 node（uid 1000），兩個程式都以一般使用者執行
if [ "$(id -u)" = 0 ]; then chown -R node:node "$DATA_DIR"; AS="su-exec node"; else AS=""; fi

PORT="${API_PORT:-8081}" $AS node --disable-warning=ExperimentalWarning /app/server/server.js &
NODE=$!
$AS caddy run --config /etc/caddy/Caddyfile --adapter caddyfile &
CADDY=$!

trap 'kill -TERM $NODE $CADDY 2>/dev/null' TERM INT
while kill -0 $NODE 2>/dev/null && kill -0 $CADDY 2>/dev/null; do sleep 1; done
kill -TERM $NODE $CADDY 2>/dev/null
wait
exit 1
