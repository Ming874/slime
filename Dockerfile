# 純靜態網頁：Caddy 直接提供 index.html / JS / CSS，沒有建置步驟。
# Mac 叢集用 Zeabur 的 dockerfile 建置器建這個映像（不經 railpack），
# 所以建置時不用從 GitHub Releases 下載 mise，GitHub 下載服務故障時照樣能部署。
FROM caddy:2.11-alpine

# 映像裡的 caddy 帶 cap_net_bind_service；Pod 設了 allowPrivilegeEscalation=false，
# 一般使用者執行帶 file capability 的程式可能被拒。8080 不需要這個權限，重新複製一份去掉它。
# /config、/data 交給 uid 1000，讓 Caddy 以一般使用者執行（與原本 railpack 映像相同）。
RUN cp /usr/bin/caddy /tmp/caddy \
 && mv -f /tmp/caddy /usr/bin/caddy \
 && chmod 0755 /usr/bin/caddy \
 && chown -R 1000:1000 /config /data

COPY Caddyfile /etc/caddy/Caddyfile
COPY . /srv
RUN rm -f /srv/Caddyfile

USER 1000:1000
ENV PORT=8080
EXPOSE 8080
CMD ["caddy", "run", "--config", "/etc/caddy/Caddyfile", "--adapter", "caddyfile"]
