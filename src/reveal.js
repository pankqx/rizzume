// The reveal: a spotlit, full-screen presentation of the finished page before it is downloaded.
import { sheetEl } from './render.js';
import { fit } from './fit.js';
import { ui } from './icons.js';
import { esc } from './ui.js';

const PAGE_W = 793.7, PAGE_H = 1122.5;

export function openReveal(r, { onPdf, onTex, onJson, onTailor } = {}) {
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const el = document.createElement('div');
  el.className = 'reveal';
  el.setAttribute('role', 'dialog');
  el.setAttribute('aria-modal', 'true');
  el.setAttribute('aria-label', 'Preview your resume');
  const name = (r.personal.name || 'Your resume').trim();
  const pretty = name === name.toUpperCase() ? name.toLowerCase().replace(/(^|\s)\S/g, (c) => c.toUpperCase()) : name;
  el.innerHTML = `
    <div class="reveal-light" aria-hidden="true"></div>
    <div class="reveal-grain" aria-hidden="true"></div>
    <button class="reveal-close" aria-label="Back to editing">${ui('close', 20)}</button>
    <div class="reveal-scene">
      <div class="reveal-tilt">
        <div class="reveal-paper"><div class="reveal-sheen" aria-hidden="true"></div></div>
        <div class="reveal-floor" aria-hidden="true"></div>
      </div>
    </div>
    <div class="reveal-caption">
      <h2 class="reveal-name">${esc(pretty)}</h2>
      <p class="reveal-meta"></p>
      <div class="reveal-actions">
        <button class="reveal-dl" data-pdf><span class="reveal-dl-label">${ui('download', 18)}Download PDF</span><i class="reveal-dl-bar"></i></button>
        <button class="reveal-ghost" data-back>Keep editing</button>
      </div>
      <p class="reveal-alt">Also as <button data-tex>LaTeX</button> or a <button data-json>backup file</button></p>
    </div>`;
  document.body.appendChild(el);
  document.documentElement.classList.add('is-revealing');

  // The page itself — a clean, non-editable render, fitted exactly like the PDF.
  const paper = el.querySelector('.reveal-paper');
  const sheet = sheetEl(r);
  paper.prepend(sheet);
  const res = fit(sheet, r);
  const meta = el.querySelector('.reveal-meta');
  meta.textContent = res.overflow
    ? `${res.pages} pages · ${res.fs.toFixed(1)} pt — consider trimming to one`
    : `One page · ${res.fs.toFixed(1)} pt · ready to send`;

  const size = () => {
    const capH = innerWidth < 700 ? 230 : 200;
    const s = Math.min((innerHeight - capH - 48) / PAGE_H, (innerWidth - 40) / PAGE_W, 0.9);
    el.style.setProperty('--ps', s);
    sheet.style.transform = `scale(${s})`;
  };
  size();
  addEventListener('resize', size);

  // Tilt toward the pointer; the light follows.
  const tilt = el.querySelector('.reveal-tilt');
  let raf = 0, tx = 0, ty = 0, cx = 0, cy = 0;
  const move = (x, y) => { tx = x; ty = y; if (!raf) raf = requestAnimationFrame(step); };
  function step() {
    raf = 0;
    cx += (tx - cx) * 0.12;
    cy += (ty - cy) * 0.12;
    tilt.style.setProperty('--rx', (-cy * 7).toFixed(2) + 'deg');
    tilt.style.setProperty('--ry', (cx * 9).toFixed(2) + 'deg');
    el.style.setProperty('--lx', (50 + cx * 18).toFixed(1) + '%');
    el.style.setProperty('--ly', (30 + cy * 12).toFixed(1) + '%');
    if (Math.abs(tx - cx) > 0.001 || Math.abs(ty - cy) > 0.001) raf = requestAnimationFrame(step);
  }
  const onMove = (e) => move((e.clientX / innerWidth - 0.5) * 2, (e.clientY / innerHeight - 0.5) * 2);
  const onOrient = (e) => { if (e.gamma != null) move(Math.max(-1, Math.min(1, e.gamma / 25)), Math.max(-1, Math.min(1, (e.beta - 45) / 25))); };
  if (!reduce) {
    el.addEventListener('pointermove', onMove);
    addEventListener('deviceorientation', onOrient);
  }

  requestAnimationFrame(() => requestAnimationFrame(() => el.classList.add('in')));

  const close = () => {
    el.classList.remove('in');
    el.classList.add('out');
    removeEventListener('resize', size);
    removeEventListener('deviceorientation', onOrient);
    document.removeEventListener('keydown', onKey);
    document.documentElement.classList.remove('is-revealing');
    setTimeout(() => el.remove(), reduce ? 0 : 480);
  };
  const onKey = (e) => { if (e.key === 'Escape') close(); };
  document.addEventListener('keydown', onKey);
  el.querySelector('.reveal-close').onclick = close;
  el.querySelector('[data-back]').onclick = close;
  el.querySelector('[data-tex]').onclick = () => onTex?.();
  el.querySelector('[data-json]').onclick = () => onJson?.();

  const dl = el.querySelector('[data-pdf]');
  dl.onclick = async () => {
    if (dl.classList.contains('busy')) return;
    dl.classList.add('busy');
    dl.querySelector('.reveal-dl-label').innerHTML = 'Setting type…';
    try {
      const [file] = await Promise.all([onPdf(), new Promise((res) => setTimeout(res, reduce ? 0 : 1100))]);
      dl.classList.remove('busy');
      dl.classList.add('done');
      dl.querySelector('.reveal-dl-label').innerHTML = `${ui('check', 18)}Downloaded`;
      el.classList.add('sent');
      const alt = el.querySelector('.reveal-alt');
      alt.innerHTML = `Saved as ${esc(file)}. Applying somewhere else? <button data-tailor>Tailor a copy</button>`;
      alt.querySelector('[data-tailor]').onclick = () => { close(); onTailor?.(); };
    } catch (err) {
      console.error(err);
      dl.classList.remove('busy');
      dl.querySelector('.reveal-dl-label').innerHTML = `${ui('download', 18)}Try again`;
    }
  };
  setTimeout(() => dl.focus({ preventScroll: true }), 50);
  return close;
}
