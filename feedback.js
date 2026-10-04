/*
 * Отзыв со страницы — в общую систему тикетов игры.
 *
 * Страница открывает то же соединение, что и экран входа игры, получает
 * задачу «докажи работу», решает её (около секунды в браузере) и шлёт
 * тикет: вид, текст и что за браузер. Ведущий видит его в меню игры,
 * во вкладке «Тикеты». Ничего, кроме этого, страница серверу не шлёт.
 */
(function () {
  'use strict';

  var SERVER = 'wss://grimhold-online.lumihub.dev/ws';
  // Проверка на своей машине: `?server=ws://localhost:8093` — только локальный адрес.
  var local = new URLSearchParams(location.search).get('server');
  if (local && /^ws:\/\/(localhost|127\.0\.0\.1):\d+$/.test(local)) SERVER = local;
  var WAIT_MS = 30000;

  // SHA-256 своими руками: crypto.subtle асинхронный, и на сотни тысяч
  // попыток его накладные расходы съедают всё время. Та же функция, что
  // проверяет сервер.
  var K = new Uint32Array([
    0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
    0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
    0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
    0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
    0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
    0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
    0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
    0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
  ]);
  var W = new Uint32Array(64);

  function sha256Words(text) {
    var bytes = new TextEncoder().encode(text);
    var total = ((bytes.length + 9 + 63) >> 6) << 6;
    var buffer = new Uint8Array(total);
    buffer.set(bytes);
    buffer[bytes.length] = 0x80;
    var view = new DataView(buffer.buffer);
    var bits = bytes.length * 8;
    view.setUint32(total - 8, Math.floor(bits / 0x100000000));
    view.setUint32(total - 4, bits >>> 0);
    var h = new Uint32Array([0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19]);
    for (var offset = 0; offset < total; offset += 64) {
      for (var i = 0; i < 16; i++) W[i] = view.getUint32(offset + i * 4);
      for (i = 16; i < 64; i++) {
        var x = W[i - 15];
        var y = W[i - 2];
        var s0 = ((x >>> 7) | (x << 25)) ^ ((x >>> 18) | (x << 14)) ^ (x >>> 3);
        var s1 = ((y >>> 17) | (y << 15)) ^ ((y >>> 19) | (y << 13)) ^ (y >>> 10);
        W[i] = (W[i - 16] + s0 + W[i - 7] + s1) | 0;
      }
      var a = h[0], b = h[1], c = h[2], d = h[3], e = h[4], f = h[5], g = h[6], k = h[7];
      for (i = 0; i < 64; i++) {
        var S1 = ((e >>> 6) | (e << 26)) ^ ((e >>> 11) | (e << 21)) ^ ((e >>> 25) | (e << 7));
        var ch = (e & f) ^ (~e & g);
        var t1 = (k + S1 + ch + K[i] + W[i]) | 0;
        var S0 = ((a >>> 2) | (a << 30)) ^ ((a >>> 13) | (a << 19)) ^ ((a >>> 22) | (a << 10));
        var maj = (a & b) ^ (a & c) ^ (b & c);
        var t2 = (S0 + maj) | 0;
        k = g; g = f; f = e; e = (d + t1) | 0; d = c; c = b; b = a; a = (t1 + t2) | 0;
      }
      h[0] += a; h[1] += b; h[2] += c; h[3] += d; h[4] += e; h[5] += f; h[6] += g; h[7] += k;
    }
    return h;
  }

  function leadingZeroBits(words) {
    var bits = 0;
    for (var i = 0; i < words.length; i++) {
      if (words[i] === 0) { bits += 32; continue; }
      return bits + Math.clz32(words[i]);
    }
    return bits;
  }

  /** Решить задачу порциями: между ними страница рисует и отвечает. */
  function solve(seed, bits) {
    return new Promise(function (resolve) {
      var nonce = 0;
      (function chunk() {
        var end = nonce + 20000;
        for (; nonce < end; nonce++) {
          if (leadingZeroBits(sha256Words(seed + ':' + nonce)) >= bits) return resolve(nonce);
        }
        setTimeout(chunk, 0);
      })();
    });
  }

  /**
   * Отправить отзыв. Ответ — `{ ok, message: { en, ru } }` от сервера
   * или своя строка, если связи нет.
   */
  function send(kind, text) {
    return new Promise(function (resolve) {
      var settled = false;
      var socket;
      var finish = function (result) {
        if (settled) return;
        settled = true;
        try { socket.close(); } catch (error) { /* уже закрыт */ }
        resolve(result);
      };
      var noLink = {
        ok: false,
        message: { en: 'No connection to the game server. Try again in a minute.', ru: 'Нет связи с сервером игры. Попробуйте через минуту.' },
      };
      setTimeout(function () { finish(noLink); }, WAIT_MS);
      try {
        socket = new WebSocket(SERVER);
      } catch (error) {
        return finish(noLink);
      }
      socket.addEventListener('error', function () { finish(noLink); });
      socket.addEventListener('message', function (event) {
        var message;
        try { message = JSON.parse(event.data); } catch (error) { return; }
        if (message.t === 'challenge' && !socket.asked) {
          socket.asked = true;
          solve(message.seed, message.bits).then(function (nonce) {
            var env = 'Сайт · ' + navigator.userAgent.replace(/\s+/g, ' ').slice(0, 180) + ' · ' + innerWidth + '×' + innerHeight;
            socket.send(JSON.stringify({ t: 'ticket', kind: kind, text: text, env: env, seed: message.seed, nonce: nonce }));
          });
        } else if (message.t === 'ticketDone') {
          finish({ ok: message.ok, message: message.message });
        }
      });
    });
  }

  window.GrimholdFeedback = { send: send };
})();
