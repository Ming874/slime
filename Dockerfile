# 網站＋伺服器：Caddy 提供網站檔案，把 /api/ 轉給同一個容器裡的 Node（Google 登入、雲端存檔；資料庫在 volume /data）。
# Mac 叢集用 Zeabur 的 dockerfile 建置器建這個映像（不經 railpack），不必從 GitHub Releases 下載任何東西。
FROM caddy:2.11-alpine AS caddy

FROM node:24-alpine
RUN apk add --no-cache su-exec

# 映像裡的 caddy 帶 cap_net_bind_service；Pod 設了 allowPrivilegeEscalation=false，
# 一般使用者執行帶 file capability 的程式可能被拒。8080 不需要這個權限，重新複製一份去掉它。
COPY --from=caddy /usr/bin/caddy /tmp/caddy
RUN cp /tmp/caddy /usr/bin/caddy && rm -f /tmp/caddy && chmod 0755 /usr/bin/caddy

COPY Caddyfile /etc/caddy/Caddyfile
COPY server/server.js /app/server/server.js
COPY start.sh /app/start.sh
# 網站檔案只放公開的檔案：伺服器程式、設定檔不會被當成網站檔案提供
COPY index.html gate.js game.js style.css privacy.html admin.html admin.js /srv/
COPY vendor /srv/vendor

# 版本號自動化：把 index.html 裡的 ?v=dev 換成網站檔案內容的雜湊（前 12 碼，不含 index.html 本身）。
# 檔案一改網址就跟著換，Cloudflare／瀏覽器不會再給舊版；沒改則沿用快取。部署時不必再手動改版本號。
# 若沒換成功（例如 index.html 的 ?v=dev 被改掉），建置直接失敗，不會上線沒帶版本號的頁面。
RUN cd /srv \
 && V=$(find . -type f ! -name index.html | sort | xargs sha256sum | sha256sum | cut -c1-12) \
 && sed -i "s/?v=dev\"/?v=$V\"/g" index.html \
 && grep -q "gate.js?v=$V\"" index.html \
 && grep -q "style.css?v=$V\"" index.html \
 && ! grep -q '?v=dev"' index.html \
 && echo "site version: $V"

# PORT：Caddy 對外的埠；API_PORT：Node 只聽 127.0.0.1，外面連不到。
# GOOGLE_CLIENT_ID、GOOGLE_CLIENT_SECRET、ADMIN_EMAILS 在 Zeabur 介面設定（不要寫在這裡）
ENV PORT=8080 API_PORT=8081 DATA_DIR=/data PUBLIC_URL=https://slime.iosoftware.ai NODE_ENV=production \
    XDG_CONFIG_HOME=/tmp/caddy/config XDG_DATA_HOME=/tmp/caddy/data
EXPOSE 8080
CMD ["/app/start.sh"]
