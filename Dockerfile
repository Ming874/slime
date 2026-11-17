# 網站＋伺服器：Next.js（React）靜態匯出的網站由 Caddy 提供，/api/ 轉給同一個容器裡的 Node（Google 登入、雲端存檔；資料庫在 volume /data）。
# Mac 叢集用 Zeabur 的 dockerfile 建置器建這個映像（不經 railpack），不必從 GitHub Releases 下載任何東西。
FROM node:24-alpine AS build
WORKDIR /src
ENV NEXT_TELEMETRY_DISABLED=1
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund
COPY next.config.mjs tsconfig.json ./
COPY app ./app
COPY components ./components
COPY lib ./lib
COPY game ./game
COPY public ./public
# 靜態匯出到 out/：React 的 js／css 檔名帶內容雜湊；game.js、three.js 等的網址由 app/page.tsx 帶上內容雜湊
RUN npm run build

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
# 網站檔案只有 next build 的結果：伺服器程式、設定檔不會被當成網站檔案提供
COPY --from=build /src/out /srv

# PORT：Caddy 對外的埠；API_PORT：Node 只聽 127.0.0.1，外面連不到。
# GOOGLE_CLIENT_ID、GOOGLE_CLIENT_SECRET、ADMIN_EMAILS 在 Zeabur 介面設定（不要寫在這裡）
ENV PORT=8080 API_PORT=8081 DATA_DIR=/data PUBLIC_URL=https://slime.iosoftware.ai NODE_ENV=production \
    XDG_CONFIG_HOME=/tmp/caddy/config XDG_DATA_HOME=/tmp/caddy/data
EXPOSE 8080
CMD ["/app/start.sh"]
