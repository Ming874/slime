'use strict';
/* 遊玩金鑰驗證：只比對 SHA-256 雜湊，金鑰原文不會出現在程式中。
   在非安全環境（例如以 http://區網IP 開啟）時 crypto.subtle 不可用，改用內建的純 JS SHA-256。 */
(function () {
  const HASHES = [
    'd64f96e1d080b113720b368496531f23210119e6b4792371a1c768fbbad42cea',
    '9b255f8035d74faadca38b4c7b3e325347b99d316362f2d6b6a1cc91a887b08e',
    '892b77a206ee2d984bd93ff6b98d96552a769ef65741539b72c22e879dab06dd',
    'e0b592ab20bda7f16241764641aa76d44639ac05cdca9d3cac0a66f09cf7d2dc',
    '4a55edc081f9e58a961065ed3b9432b3f18a8d6afcbd1cf5e7582b7094efea20',
    '1d4cce33ab87735bdef45ade673dc64c90d527bd67955f4fb0f90ef0c3e0511e',
    'cd4bb9c2eb16849a078bc30cf01b49a0ef0805d27ed397fc5a283187234ec12a',
    '47deb439786bf69e46414d22d9ba59daaa4ce4180dc8b54b5bcc1dc1cb9b7c48',
    '4ecae1779676a65ee0de9849eee3656398db574cb7a35452cfadec7d9b6fef95',
    '5bf1a3e89b146ca244e0b28e1bf8179007ff8149b91b3467aa74374c14470178',
    '00729fcd52cc898aa6d25a41119c8b7fe1eadea7d328d6469e57ad204d276186',
  ];
  const KEY = 'slime_auth_v1', SALT = 'slime-squish:';

  /* ---------- 純 JS SHA-256（備援） ---------- */
  const K = [
    0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
    0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
    0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
    0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
    0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
    0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
    0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
    0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
  ];
  const ror = (x, n) => (x >>> n) | (x << (32 - n));
  function sha256js(str) {
    const bytes = new TextEncoder().encode(str), l = bytes.length, nb = (l + 9 + 63) >> 6;
    const m = new Uint8Array(nb * 64); m.set(bytes); m[l] = 0x80;
    const dv = new DataView(m.buffer), bits = l * 8;
    dv.setUint32(m.length - 8, Math.floor(bits / 4294967296)); dv.setUint32(m.length - 4, bits >>> 0);
    const H = [0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19], W = new Uint32Array(64);
    for (let i = 0; i < nb; i++) {
      for (let t = 0; t < 16; t++) W[t] = dv.getUint32(i * 64 + t * 4);
      for (let t = 16; t < 64; t++) {
        const x = W[t - 15], y = W[t - 2];
        W[t] = (W[t - 16] + (ror(x, 7) ^ ror(x, 18) ^ (x >>> 3)) + W[t - 7] + (ror(y, 17) ^ ror(y, 19) ^ (y >>> 10))) >>> 0;
      }
      let [a, b, c, d, e, f, g, h] = H;
      for (let t = 0; t < 64; t++) {
        const t1 = (h + (ror(e, 6) ^ ror(e, 11) ^ ror(e, 25)) + ((e & f) ^ (~e & g)) + K[t] + W[t]) >>> 0;
        const t2 = ((ror(a, 2) ^ ror(a, 13) ^ ror(a, 22)) + ((a & b) ^ (a & c) ^ (b & c))) >>> 0;
        h = g; g = f; f = e; e = (d + t1) >>> 0; d = c; c = b; b = a; a = (t1 + t2) >>> 0;
      }
      H[0] = (H[0] + a) >>> 0; H[1] = (H[1] + b) >>> 0; H[2] = (H[2] + c) >>> 0; H[3] = (H[3] + d) >>> 0;
      H[4] = (H[4] + e) >>> 0; H[5] = (H[5] + f) >>> 0; H[6] = (H[6] + g) >>> 0; H[7] = (H[7] + h) >>> 0;
    }
    return H.map(x => x.toString(16).padStart(8, '0')).join('');
  }
  window.__sha256js = sha256js; // 供自動化測試比對

  const hex = buf => [...new Uint8Array(buf)].map(x => x.toString(16).padStart(2, '0')).join('');
  async function sha(s) {
    const msg = SALT + s;
    try {
      if (window.isSecureContext !== false && window.crypto && crypto.subtle) return hex(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(msg)));
    } catch (e) { /* 改用備援 */ }
    return sha256js(msg);
  }
  // 先比對原字串，再比對大寫版本（新金鑰不分大小寫，舊金鑰維持原樣）
  async function match(code) {
    const c = String(code || '').trim(); if (!c) return null;
    for (const v of new Set([c, c.toUpperCase()])) { if (HASHES.includes(await sha(v))) return v; }
    return null;
  }

  let started = false;
  function start() {
    if (started) return; started = true;
    const boot = document.getElementById('boot'); if (boot) boot.hidden = false;
    const s = document.createElement('script'); s.src = 'game.js';
    s.onerror = () => { const m = document.getElementById('loginMsg'); if (m) m.textContent = '遊戲載入失敗，請重新整理頁面'; };
    document.body.appendChild(s);
  }

  (async () => {
    let saved = null; try { saved = localStorage.getItem(KEY); } catch (e) { }
    if (saved && await match(saved)) return start();
    const box = document.getElementById('login'), form = document.getElementById('loginForm');
    const inp = document.getElementById('loginCode'), msg = document.getElementById('loginMsg'), card = box.querySelector('.login-card');
    box.hidden = false;
    form.addEventListener('submit', async e => {
      e.preventDefault();
      const btn = document.getElementById('loginBtn'); btn.disabled = true; msg.textContent = '';
      const v = await match(inp.value); btn.disabled = false;
      if (v) {
        try { localStorage.setItem(KEY, v); } catch (e) { }
        box.classList.add('out'); setTimeout(() => { box.hidden = true; box.classList.remove('out'); }, 450);
        start();
      } else {
        msg.textContent = inp.value.trim() ? '金鑰不正確，請再確認一次' : '請輸入遊玩金鑰';
        card.classList.remove('shake'); void card.offsetWidth; card.classList.add('shake'); inp.select();
      }
    });
    const eye = document.getElementById('loginEye');
    if (eye) eye.addEventListener('click', () => { const show = inp.type === 'password'; inp.type = show ? 'text' : 'password'; eye.textContent = show ? '🙈' : '👁'; inp.focus(); });
    setTimeout(() => inp.focus(), 60);
  })();
})();
