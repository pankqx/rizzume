import './styles/resume.css';
import './styles/app.css';
import * as store from './store.js';
import { renderLanding } from './views/landing.js';
import { renderLibrary } from './views/library.js';
import { renderEditor } from './views/editor.js';

store.load();
applyTheme();

export function applyTheme() {
  const t = store.settings().theme;
  if (t === 'auto') document.documentElement.removeAttribute('data-theme');
  else document.documentElement.dataset.theme = t;
}

let cleanup = null;
async function route() {
  cleanup?.();
  cleanup = null;
  const app = document.getElementById('app');
  const hash = location.hash.replace(/^#\/?/, '');
  const [view, id] = hash.split('/');
  window.scrollTo(0, 0);
  if (view === 'edit' && store.get(id)) cleanup = renderEditor(app, id);
  else if (view === 'resumes') cleanup = renderLibrary(app);
  else cleanup = renderLanding(app);
}
addEventListener('hashchange', route);

// Boot: set the wordmark letter by letter, once per session.
async function boot() {
  const el = document.getElementById('boot');
  let seen = false;
  try { seen = sessionStorage.getItem('rz-boot') === '1'; sessionStorage.setItem('rz-boot', '1'); } catch {}
  const fontsReady = Promise.all([
    document.fonts.load('400 40px "LM Display"'),
    document.fonts.load('400 10pt "LM Roman"'),
    document.fonts.load('700 10pt "LM Roman"'),
    document.fonts.load('italic 400 10pt "LM Roman"'),
  ]).catch(() => {});
  if (!seen && !matchMedia('(prefers-reduced-motion: reduce)').matches) {
    const word = el.querySelector('.boot-word');
    await document.fonts.load('400 40px "LM Display"').catch(() => {});
    word.innerHTML = [...'Rizzume'].map((c, i) => `<span style="animation-delay:${i * 70}ms">${c}</span>`).join('') + '<span class="caret"></span>';
    await Promise.all([fontsReady, new Promise((r) => setTimeout(r, 900))]);
  } else await fontsReady;
  await route();
  el.classList.add('done');
  setTimeout(() => el.remove(), 600);
}
boot();

if ('serviceWorker' in navigator && import.meta.env.PROD) {
  addEventListener('load', () => navigator.serviceWorker.register('./sw.js').catch(() => {}));
}
