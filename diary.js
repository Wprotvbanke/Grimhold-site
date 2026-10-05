/*
 * Дневник разработки — книга знаний из игры: та же модель, вылет, обложка,
 * раскрытие и листание. `book3d/book3d.js` — её сжатая сборка (собирается
 * в закрытом репозитории игры), рядом — текстуры, звуки и снимки обложки.
 *
 * Записи — `diary/*.md` в разметке книги игры; новая запись — новый файл
 * и строка в `diary/book.json`. Книга раскрывается на письме автора.
 *
 * Книге нужен WebGPU. Без него (Firefox, старый Safari) то же письмо
 * открывается простым листом пергамента — из тех же файлов.
 */
/** Поднять, когда пересобрана книга: иначе браузер возьмёт прежнюю из кеша. */
const BUILD = '1005b';

const root = document.documentElement;
const tome = document.getElementById('tome');
const openButton = document.getElementById('diaryOpen');
const letter = document.getElementById('letter');
const sheet = document.getElementById('letterSheet');
const lang = () => (root.dataset.lang === 'en' ? 'en' : 'ru');

let reader = null;
let loading = null;

/** Книга из игры — или `null`, если WebGPU нет или книга не поднялась. */
function load() {
  loading ??= (async () => {
    if (!navigator.gpu) return null;
    const book = await import(`./book3d/book3d.js?v=${BUILD}`);
    if (!(await book.webGpuReady())) return null;
    const made = await book.createDiary({ diary: 'diary/', lang, closed });
    await made.prepare();
    return made;
  })().catch((error) => {
    console.warn('Дневник без книги:', error);
    return null;
  });
  void loading.then((made) => made || plainOnly());
  return loading;
}

/** Книги не будет — подпись под кнопкой говорит правду. */
function plainOnly() {
  document.getElementById('diaryNote').innerHTML =
    '<span lang="ru">Браузер без WebGPU — дневник откроется простым листом. Книга из игры — в свежем Chrome, Edge или Яндекс Браузере.</span>' +
    '<span lang="en">This browser has no WebGPU, so the diary opens as a plain sheet. The book from the game needs a recent Chrome or Edge.</span>';
}

function closed() {
  tome.classList.remove('away');
  root.classList.remove('reading');
  openButton.focus({ preventScroll: true });
}

async function open() {
  if (reader?.visible) return;
  openButton.setAttribute('aria-busy', 'true');
  const made = await load();
  openButton.removeAttribute('aria-busy');
  if (!made) return openLetter();
  reader = made;
  const from = tome.getBoundingClientRect();
  tome.classList.add('away');
  root.classList.add('reading');
  await made.open(from);
}

tome.addEventListener('click', open);
openButton.addEventListener('click', open);
window.addEventListener('keydown', (event) => {
  if (reader?.visible && reader.handleKey(event)) event.preventDefault();
});

// Книга готовится заранее — когда дневник подходит к экрану: тогда она
// вылетает в миг щелчка, а не после загрузки.
const nearby = new IntersectionObserver((entries) => {
  if (!entries.some((entry) => entry.isIntersecting)) return;
  nearby.disconnect();
  void load();
}, { rootMargin: '600px 0px' });
nearby.observe(document.getElementById('diary'));
['pointerenter', 'focus'].forEach((type) => openButton.addEventListener(type, () => void load(), { once: true }));

// ---------------- письмо листом — без WebGPU ----------------

/** Глава в разметке книги игры: шапка `title: English | Русский`, `@en`/`@ru`, абзацы, `>` приписки, `***` черта. */
function parseChapter(source) {
  const lines = source.replace(/\r\n/g, '\n').split('\n');
  const chapter = { kind: 'chapter', title: { en: '', ru: '' }, body: { en: [], ru: [] } };
  let at = 0;
  if (lines[0]?.trim() === '---') {
    at = 1;
    while (at < lines.length && lines[at].trim() !== '---') {
      const [key, ...rest] = lines[at].split(':');
      const value = rest.join(':').trim();
      if (key.trim() === 'title') {
        const [en, ru] = value.split('|').map((part) => part.trim());
        chapter.title = { en, ru: ru || en };
      }
      if (key.trim() === 'kind' && value === 'preface') chapter.kind = 'preface';
      at++;
    }
    at++;
  }
  const raw = { en: [], ru: [] };
  let current = null;
  for (; at < lines.length; at++) {
    const marker = /^@(en|ru)\s*$/.exec(lines[at].trim());
    if (marker) current = marker[1];
    else if (current) raw[current].push(lines[at]);
  }
  for (const key of ['en', 'ru']) {
    const blocks = chapter.body[key];
    let buffer = [];
    let note = false;
    const flush = () => {
      const text = buffer.join(' ').replace(/\s+/g, ' ').trim();
      if (text) blocks.push({ kind: note ? 'note' : 'p', text });
      buffer = [];
    };
    for (const rawLine of raw[key]) {
      const line = rawLine.trim();
      if (line === '') { flush(); continue; }
      if (line === '***') { flush(); blocks.push({ kind: 'rule' }); continue; }
      const isNote = line.startsWith('>');
      if (buffer.length > 0 && isNote !== note) flush();
      note = isNote;
      buffer.push(isNote ? line.replace(/^>\s?/, '') : line);
    }
    flush();
  }
  return chapter;
}

/** Текст с `*курсивом*` — узлами, без разметки из файла. */
function runs(element, text) {
  const parts = text.split('*');
  const paired = parts.length % 2 === 1;
  parts.forEach((part, index) => {
    if (paired && index % 2 === 1) {
      const em = document.createElement('em');
      em.textContent = part;
      element.append(em);
    } else {
      element.append(!paired && index > 0 ? `*${part}` : part);
    }
  });
  return element;
}

let letterReady = null;
function fillLetter() {
  letterReady ??= (async () => {
    const get = async (file) => (await fetch(`diary/${file}`, { cache: 'no-cache' })).text();
    const book = JSON.parse(await get('book.json'));
    const chapters = (await Promise.all(book.chapters.map(get))).map(parseChapter).filter((chapter) => chapter.kind === 'chapter');
    for (const key of ['ru', 'en']) {
      for (const chapter of chapters) {
        const article = document.createElement('article');
        article.lang = key;
        const kicker = document.createElement('p');
        kicker.className = 'kicker';
        kicker.textContent = book.title[key].subtitle;
        const heading = document.createElement('h3');
        heading.textContent = chapter.title[key];
        article.append(kicker, heading);
        for (const block of chapter.body[key]) {
          if (block.kind === 'rule') article.append(document.createElement('hr'));
          else {
            const paragraph = runs(document.createElement('p'), block.text);
            if (block.kind === 'note') paragraph.className = 'note';
            article.append(paragraph);
          }
        }
        sheet.append(article);
      }
    }
  })();
  return letterReady;
}

async function openLetter() {
  try {
    await fillLetter();
  } catch (error) {
    letterReady = null;
    console.warn('Дневник не загрузился:', error);
    return;
  }
  sheet.scrollTop = 0;
  letter.showModal();
}

document.getElementById('letterClose').addEventListener('click', () => letter.close());
letter.addEventListener('click', (event) => {
  if (event.target === letter) letter.close();
});
