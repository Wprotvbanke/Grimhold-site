/*
 * Дневник разработки — книга рядом с роликом, в духе книги знаний игры.
 *
 * Страницы — блоки `<article class="pg">` в шаблонах `#diary-ru` и
 * `#diary-en` (index.html): дописать запись — дописать блок туда, и книга
 * сама станет толще. Разворот — две страницы, на узком экране — одна.
 * Лист переворачивается щелчком по странице, стрелками под книгой,
 * клавишами ← → и свайпом; шуршит, как в игре.
 */
(function () {
  'use strict';

  var root = document.documentElement;
  var spread = document.getElementById('spread');
  var left = document.getElementById('pageLeft');
  var right = document.getElementById('pageRight');
  var turn = document.getElementById('turn');
  var front = turn.querySelector('.front');
  var back = turn.querySelector('.back');
  var where = document.getElementById('bookWhere');
  var prevButton = document.getElementById('bookPrev');
  var nextButton = document.getElementById('bookNext');
  var narrow = matchMedia('(max-width: 760px)');
  var still = matchMedia('(prefers-reduced-motion: reduce)');
  var FLIP_MS = 700;

  var pages = [];
  /** Первая видимая страница: левая разворота или единственная на узком экране. */
  var at = 0;
  var busy = false;

  var SOUNDS = ['book/bookFlip1.ogg', 'book/bookFlip2.ogg', 'book/bookFlip3.ogg'];
  function rustle() {
    try {
      var sound = new Audio(SOUNDS[Math.floor(Math.random() * SOUNDS.length)]);
      sound.volume = 0.35;
      sound.play().catch(function () { /* без звука — не беда */ });
    } catch (error) { /* браузер без звука */ }
  }

  function lang() { return root.dataset.lang === 'en' ? 'en' : 'ru'; }

  function load() {
    var template = document.getElementById('diary-' + lang());
    pages = Array.prototype.slice.call(template.content.querySelectorAll('.pg'));
  }

  /** Положить страницу в место: её копию и номер внизу (у титула номера нет). */
  function fill(slot, index) {
    slot.replaceChildren();
    slot.lang = lang();
    var page = pages[index];
    slot.classList.toggle('blank', !page);
    if (!page) return;
    var copy = page.cloneNode(true);
    if (!copy.classList.contains('title')) {
      var number = document.createElement('span');
      number.className = 'num';
      number.textContent = String(index);
      copy.append(number);
    }
    slot.append(copy);
  }

  function render() {
    if (narrow.matches) {
      fill(right, at);
      left.replaceChildren();
      where.textContent = (at + 1) + ' / ' + pages.length;
    } else {
      fill(left, at);
      fill(right, at + 1);
      where.textContent = (at + 1) + '–' + Math.min(at + 2, pages.length) + ' / ' + pages.length;
    }
    var step = narrow.matches ? 1 : 2;
    prevButton.disabled = at <= 0;
    nextButton.disabled = at + step >= pages.length;
  }

  /** Перевернуть лист: `kind` — fwd (вперёд), bwd (назад над левой), unturn (назад на узком). */
  function flip(kind, frontIndex, backIndex, under, done) {
    busy = true;
    rustle();
    fill(front, frontIndex);
    fill(back, backIndex);
    if (under) under();
    if (still.matches) {
      done();
      busy = false;
      return;
    }
    turn.className = 'turn ' + kind;
    // Перезапуск анимации: класс снят и поставлен через кадр.
    requestAnimationFrame(function () {
      turn.classList.add('go');
      setTimeout(function () {
        done();
        turn.className = 'turn';
        busy = false;
      }, FLIP_MS);
    });
  }

  function next() {
    if (busy) return;
    if (narrow.matches) {
      if (at + 1 >= pages.length) return;
      flip('fwd', at, -1, function () { fill(right, at + 1); }, function () { at += 1; render(); });
    } else {
      if (at + 2 >= pages.length) return;
      flip('fwd', at + 1, at + 2, function () { fill(right, at + 3); }, function () { at += 2; render(); });
    }
  }

  function prev() {
    if (busy) return;
    if (narrow.matches) {
      if (at <= 0) return;
      flip('unturn', at - 1, -1, null, function () { at -= 1; render(); });
    } else {
      if (at <= 0) return;
      flip('bwd', at, at - 1, function () { fill(left, at - 2); }, function () { at -= 2; render(); });
    }
  }

  /** Свайп кончается и щелчком по странице — второй раз не листать. */
  var swiped = false;
  right.addEventListener('click', function () { if (swiped) { swiped = false; return; } next(); });
  left.addEventListener('click', function () { if (swiped) { swiped = false; return; } prev(); });
  // Страницы — блоки с ролью кнопки (в <button> Chrome не перерисовывал
  // содержимое с контейнерными единицами): Enter и пробел — как щелчок.
  [left, right].forEach(function (slot) {
    slot.addEventListener('keydown', function (event) {
      if (event.key !== 'Enter' && event.key !== ' ') return;
      event.preventDefault();
      if (slot === right) next();
      else prev();
    });
  });
  nextButton.addEventListener('click', next);
  prevButton.addEventListener('click', prev);

  // Клавиши — когда книга в руках (фокус в ней) или просто на экране.
  document.addEventListener('keydown', function (event) {
    if (document.querySelector('dialog[open]')) return;
    if (event.target instanceof HTMLTextAreaElement || event.target instanceof HTMLInputElement) return;
    var box = spread.getBoundingClientRect();
    if (box.bottom < 0 || box.top > innerHeight) return;
    if (event.key === 'ArrowRight') next();
    else if (event.key === 'ArrowLeft') prev();
  });

  // Свайп пальцем.
  var startX = null;
  spread.addEventListener('pointerdown', function (event) { startX = event.clientX; });
  spread.addEventListener('pointerup', function (event) {
    if (startX === null) return;
    var dx = event.clientX - startX;
    startX = null;
    if (Math.abs(dx) < 40) return;
    swiped = true;
    setTimeout(function () { swiped = false; }, 400);
    if (dx < 0) next();
    else prev();
  });

  // Сменился язык — та же глава на другом языке.
  new MutationObserver(function () {
    load();
    at = Math.min(at, pages.length - 1);
    if (!narrow.matches) at -= at % 2;
    render();
  }).observe(root, { attributes: true, attributeFilter: ['data-lang'] });

  // Узкий экран ↔ разворот: на развороте слева всегда чётная.
  narrow.addEventListener('change', function relayout() {
    // Посреди переворота — дождаться его конца, иначе разворот сбросится под листом.
    if (busy) return setTimeout(relayout, FLIP_MS);
    if (!narrow.matches) at -= at % 2;
    render();
  });

  load();
  // Открыта на начале письма: на развороте это титул и первая страница,
  // на узком экране — сразу первая страница письма.
  if (narrow.matches) at = 1;
  render();
})();
