(function () {
  'use strict';

  var root = document.documentElement;
  var lang = function () { return root.dataset.lang === 'en' ? 'en' : 'ru'; };

  // ---------- язык ----------
  var langButtons = document.querySelectorAll('[data-set-lang]');
  function setLang(next) {
    root.dataset.lang = next;
    root.lang = next;
    langButtons.forEach(function (button) { button.setAttribute('aria-pressed', String(button.dataset.setLang === next)); });
    try { localStorage.setItem('grimhold-site-lang', next); } catch (e) { /* без памяти */ }
    paintFeedback();
  }
  langButtons.forEach(function (button) {
    button.addEventListener('click', function () { setLang(button.dataset.setLang); });
  });

  // ---------- главы ролика ----------
  var video = document.getElementById('video');
  var chapters = Array.prototype.slice.call(document.querySelectorAll('#chapters button'));
  chapters.forEach(function (button) {
    button.addEventListener('click', function () {
      var at = Number(button.dataset.at);
      var go = function () {
        video.currentTime = at;
        video.play().catch(function () { /* без звука браузер может не пустить — кнопка «плей» под рукой */ });
      };
      if (video.readyState >= 1) go();
      else {
        video.preload = 'auto';
        video.addEventListener('loadedmetadata', go, { once: true });
        video.load();
      }
      video.scrollIntoView({ behavior: 'smooth', block: 'center' });
    });
  });
  video.addEventListener('timeupdate', function () {
    var now = video.currentTime;
    var current = null;
    chapters.forEach(function (button) { if (Number(button.dataset.at) <= now + 0.2) current = button; });
    chapters.forEach(function (button) { button.classList.toggle('on', button === current); });
  });

  // ---------- кадры крупно ----------
  var view = document.getElementById('view');
  var viewImage = document.getElementById('viewImage');
  var viewCaption = document.getElementById('viewCaption');
  document.querySelectorAll('[data-view]').forEach(function (button) {
    button.addEventListener('click', function () {
      var image = button.querySelector('img');
      viewImage.src = button.dataset.view;
      viewImage.alt = image ? image.alt : '';
      viewCaption.textContent = image ? image.alt : '';
      view.showModal();
    });
  });
  view.addEventListener('click', function () { view.close(); });

  // ---------- отзыв ----------
  var dialog = document.getElementById('feedback');
  var form = document.getElementById('feedbackForm');
  var text = document.getElementById('feedbackText');
  var status = document.getElementById('feedbackStatus');
  var count = document.getElementById('feedbackCount');
  var sendButton = document.getElementById('feedbackSend');
  var kinds = Array.prototype.slice.call(dialog.querySelectorAll('[data-kind]'));
  var kind = 'idea';
  var sending = false;
  var closeTimer = 0;

  var HINTS = {
    idea: { ru: 'Что бы вы добавили в игру или изменили в ней?', en: 'What would you add to the game or change in it?' },
    bug: { ru: 'Что случилось и где? Что вы делали перед этим?', en: 'What happened and where? What were you doing just before?' },
    other: { ru: 'Всё, что хотите сказать.', en: 'Anything you want to say.' },
  };

  function paintFeedback() {
    kinds.forEach(function (button) { button.setAttribute('aria-pressed', String(button.dataset.kind === kind)); });
    text.placeholder = HINTS[kind][lang()];
    count.textContent = text.value.length + ' / 2000';
    sendButton.disabled = sending || text.value.trim().length < 5;
  }
  function say(message, tone) {
    status.textContent = message;
    status.className = tone || '';
  }

  kinds.forEach(function (button) {
    button.addEventListener('click', function () {
      kind = button.dataset.kind;
      paintFeedback();
      text.focus();
    });
  });
  text.addEventListener('input', paintFeedback);
  document.querySelectorAll('[data-open-feedback]').forEach(function (button) {
    button.addEventListener('click', function () {
      clearTimeout(closeTimer);
      if (!sending) say('');
      paintFeedback();
      dialog.showModal();
      text.focus();
    });
  });
  document.getElementById('feedbackClose').addEventListener('click', function () { dialog.close(); });

  form.addEventListener('submit', function (event) {
    event.preventDefault();
    var body = text.value.trim();
    if (sending || body.length < 5) return;
    sending = true;
    paintFeedback();
    say(lang() === 'ru' ? 'Отправляю…' : 'Sending…');
    window.GrimholdFeedback.send(kind, body).then(function (result) {
      sending = false;
      say(result.message[lang()] || result.message.ru, result.ok ? 'ok' : 'bad');
      if (result.ok) {
        text.value = '';
        closeTimer = setTimeout(function () { dialog.close(); }, 2600);
      }
      paintFeedback();
    });
  });

  setLang(lang());
})();
