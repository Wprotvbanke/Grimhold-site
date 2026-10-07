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

  // ---------- «Что уже в игре»: свёрнуто — первый ряд и полряда второго ----------
  var fold = document.getElementById('nowFold');
  var foldBody = document.getElementById('nowBody');
  var foldToggle = document.getElementById('nowToggle');
  if (fold && foldBody && foldToggle) {
    var cards = foldBody.querySelectorAll('.card');
    // Свёрнутая высота — по карточкам: верх второго ряда и половина его карточки.
    var collapsed = function () {
      if (cards.length < 2) return foldBody.scrollHeight;
      var top = cards[0].offsetTop;
      for (var i = 1; i < cards.length; i++) {
        if (cards[i].offsetTop > top + 2) return cards[i].offsetTop + cards[i].offsetHeight / 2;
      }
      return foldBody.scrollHeight;
    };
    var paintFold = function () {
      var open = fold.dataset.open === 'true';
      var low = collapsed();
      var full = foldBody.scrollHeight;
      var needed = full > low + 40;
      foldToggle.hidden = !needed;
      fold.classList.toggle('flat', !needed);
      foldBody.style.maxHeight = (open || !needed ? full : low) + 'px';
    };
    foldToggle.addEventListener('click', function () {
      var open = fold.dataset.open !== 'true';
      fold.dataset.open = String(open);
      foldToggle.setAttribute('aria-expanded', String(open));
      paintFold();
      // Свернул далеко внизу — вернуть к началу раздела, а не оставить в пустоте.
      if (!open && fold.getBoundingClientRect().top < 0) {
        document.getElementById('now').scrollIntoView({ block: 'start' });
      }
    });
    window.addEventListener('resize', paintFold);
    // Высоту карточек меняют шрифты — пересчитать, когда приедут.
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(paintFold);
    paintFold();
  }

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
