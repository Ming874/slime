'use strict';
/* 登入碼驗證：只比對 SHA-256 雜湊，原始碼不會出現在程式中。 */
(function () {
  const HASHES = [
    'd64f96e1d080b113720b368496531f23210119e6b4792371a1c768fbbad42cea',
    '9b255f8035d74faadca38b4c7b3e325347b99d316362f2d6b6a1cc91a887b08e',
    '892b77a206ee2d984bd93ff6b98d96552a769ef65741539b72c22e879dab06dd',
    'e0b592ab20bda7f16241764641aa76d44639ac05cdca9d3cac0a66f09cf7d2dc',
    '4a55edc081f9e58a961065ed3b9432b3f18a8d6afcbd1cf5e7582b7094efea20',
    '1d4cce33ab87735bdef45ade673dc64c90d527bd67955f4fb0f90ef0c3e0511e',
  ];
  const KEY = 'slime_auth_v1';
  async function sha(s) {
    const b = await crypto.subtle.digest('SHA-256', new TextEncoder().encode('slime-squish:' + s));
    return [...new Uint8Array(b)].map(x => x.toString(16).padStart(2, '0')).join('');
  }
  function start() { const s = document.createElement('script'); s.src = 'game.js'; document.body.appendChild(s); }
  async function ok(code) { try { return HASHES.includes(await sha(code.trim())); } catch (e) { return false; } }

  (async () => {
    let saved = null; try { saved = localStorage.getItem(KEY); } catch (e) { }
    if (saved && await ok(saved)) return start();
    const box = document.getElementById('login'); box.hidden = false;
    const inp = document.getElementById('loginCode'), msg = document.getElementById('loginMsg');
    const go = async () => {
      const v = inp.value;
      if (await ok(v)) { try { localStorage.setItem(KEY, v.trim()); } catch (e) { } box.hidden = true; start(); }
      else { msg.textContent = '登入碼錯誤，請再試一次'; inp.select(); }
    };
    document.getElementById('loginBtn').onclick = go;
    inp.addEventListener('keydown', e => { if (e.key === 'Enter') go(); });
    inp.focus();
  })();
})();
