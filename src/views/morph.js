// Landing set-piece: an ugly "Word" resume whose every line lifts off and flies into a typeset page as you scroll.
import { sampleResume } from '../model.js';
import { sheetEl } from '../render.js';
import { fit } from '../fit.js';
import { esc } from '../ui.js';

const PAGE_W = 793.7, PAGE_H = 1122.5;

const OLD_HEAD = {
  profile: 'CAREER OBJECTIVE:',
  skills: 'TECHNICAL SKILLS :-',
  experience: 'WORK EXPERIENCE',
  projects: 'ACADEMIC PROJECTS',
  education: 'EDUCATIONAL QUALIFICATION',
  certifications: 'CERTIFICATIONS',
  additional: 'HOBBIES & INTERESTS',
};
const OLD_TEXT = 'To obtain a challenging position in a reputed organization where I can utilize my skills and knowledge for the growth of the organization as well as myself.';
const WORSE = [
  [/^Built 14 REST endpoints/, 'Responsible for making 14 REST endpoints'],
  [/^Wrote integration tests/, 'Worked on integration tests'],
  [/^Designed and shipped/, 'Helped in designing'],
];

// The old document is generated from the same data, piece for piece, in the same order as the new sheet.
function oldDoc(r) {
  const p = r.personal;
  const name = p.name.toLowerCase().replace(/(^|\s)\S/g, (c) => c.toUpperCase());
  let html = `<div class="o-name" data-piece>${esc(name)}</div>
    <div class="o-title" data-piece>${esc(p.title.replace(' | ', ' - '))}</div>
    <div class="o-contacts"><span data-piece>Email : ${esc(p.email)}</span><span class="o-sep"> | </span><span data-piece>Mob : ${esc(p.phone)}</span><span class="o-sep"> | </span><span data-piece>${esc('www.linkedin.com/in/' + p.linkedin)}</span><span class="o-sep"> | </span><span data-piece>${esc('github.com/' + p.github)}</span></div>`;
  for (const s of r.sections) {
    if (!s.visible) continue;
    html += `<div class="o-h" data-piece>${esc(OLD_HEAD[s.type] || s.title.toUpperCase())}</div>`;
    if (s.kind === 'text') html += `<p class="o-p" data-piece>${esc(OLD_TEXT)}</p>`;
    if (s.kind === 'lines') s.rows.forEach((x) => (html += `<div class="o-line" data-piece>&#10146;&nbsp; ${esc(x.label)} - ${esc(x.value)}</div>`));
    if (s.kind === 'entries')
      s.items.forEach((it) => {
        if (s.layout === 'school') {
          html += `<div class="o-row" data-piece><b>${esc(it.subtitle)}</b>&emsp;&emsp;(${esc(it.right)})</div><div class="o-sub" data-piece>${esc(it.title)} , ${esc(it.subRight.replace('CGPA: ', 'CGPA - '))}</div>`;
        } else if (s.layout === 'compact') {
          html += `<div class="o-row o-cmp" data-piece>&#9679; ${esc(it.title)} from ${esc(it.detail)} in the year ${esc(it.right)}</div>`;
        } else {
          html += `<div class="o-row" data-piece><b>${esc(it.title.replace(' — ', ', '))}</b>&emsp;&emsp;&emsp;${esc(it.right.replace('Code', ''))}</div>`;
        }
        it.bullets.forEach((b) => {
          let t = b.text;
          for (const [re, w] of WORSE) t = t.replace(re, w);
          html += `<div class="o-li" data-piece><span>o</span>${esc(t)}</div>`;
        });
      });
  }
  html += `<div class="o-foot">Page 1 of 2</div>`;
  return html;
}

const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
const ease = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const smooth = (a, b, x) => { const t = clamp((x - a) / (b - a)); return t * t * (3 - 2 * t); };

export function mountMorph(section) {
  const r = sampleResume();
  const stage = section.querySelector('.morph-stage');
  const paper = section.querySelector('.morph-paper');
  const tab = section.querySelector('.morph-file');
  const caps = [...section.querySelectorAll('.morph-cap')];
  const rail = section.querySelector('.morph-rail i');

  const oldLayer = document.createElement('div');
  oldLayer.className = 'olddoc';
  oldLayer.innerHTML = oldDoc(r);
  const newLayer = sheetEl(r);
  newLayer.classList.add('morph-new');
  paper.append(oldLayer, newLayer);
  fit(newLayer, r);

  const olds = [...oldLayer.querySelectorAll('[data-piece]')];
  const news = [...newLayer.querySelectorAll('.r-name, .r-title, .r-c, .r-h, .r-p, .r-line, .r-entry > .r-row, .r-ul > li')];
  const n = Math.min(olds.length, news.length);
  const decor = [...oldLayer.querySelectorAll('.o-sep, .o-foot')];
  let pieces = [];
  let scale = 1;

  function measure() {
    scale = Math.min(0.62, (stage.clientWidth - 8) / PAGE_W, (innerHeight * 0.78) / PAGE_H);
    paper.style.setProperty('--s', scale);
    [...olds, ...news].forEach((e) => (e.style.transform = ''));
    const base = paper.getBoundingClientRect();
    const rel = (e) => { const b = e.getBoundingClientRect(); return { x: (b.left - base.left) / scale, y: (b.top - base.top) / scale, w: b.width / scale, h: b.height / scale }; };
    pieces = [];
    for (let i = 0; i < n; i++) {
      const a = rel(olds[i]), b = rel(news[i]);
      pieces.push({
        o: olds[i], nw: news[i], a, b,
        dx: b.x - a.x, dy: b.y - a.y,
        sx: b.w / Math.max(a.w, 1), sy: b.h / Math.max(a.h, 1),
        rot: (Math.sin(i * 12.9898) * 43758.5453 % 1) * 9 - 4.5,
        delay: 0.14 + (i / n) * 0.42 + (Math.sin(i * 78.233) * 0.5 + 0.5) * 0.04,
      });
    }
    shown = -1;
  }

  let target = 0, shown = -1, raf = 0;
  function read() {
    const rc = section.getBoundingClientRect();
    const span = rc.height - innerHeight;
    target = clamp(-rc.top / Math.max(span, 1));
    if (!raf) raf = requestAnimationFrame(tick);
  }
  function tick() {
    raf = 0;
    const p = shown < 0 ? target : shown + (target - shown) * 0.14;
    shown = Math.abs(target - p) < 0.0005 ? target : p;
    paint(shown);
    if (shown !== target) raf = requestAnimationFrame(tick);
  }
  function paint(p) {
    for (const k of pieces) {
      const e = ease(clamp((p - k.delay) / 0.24));
      const lift = -46 * Math.sin(Math.PI * e);
      const rot = k.rot * Math.sin(Math.PI * e);
      const pop = 1 + 0.06 * Math.sin(Math.PI * e);
      k.o.style.transform = `translate(${k.dx * e}px, ${k.dy * e + lift}px) rotate(${rot}deg) scale(${(1 + (k.sx - 1) * e) * pop}, ${(1 + (k.sy - 1) * e) * pop})`;
      k.o.style.opacity = 1 - smooth(0.25, 0.7, e);
      k.nw.style.transform = `translate(${-k.dx * (1 - e)}px, ${-k.dy * (1 - e) + lift}px) rotate(${rot}deg) scale(${(1 / k.sx + (1 - 1 / k.sx) * e) * pop}, ${(1 / k.sy + (1 - 1 / k.sy) * e) * pop})`;
      k.nw.style.opacity = smooth(0.3, 0.75, e);
      k.nw.style.filter = e > 0 && e < 1 ? `blur(${(1 - e) * 1.2}px)` : '';
    }
    const d = 1 - smooth(0.1, 0.22, p);
    decor.forEach((x) => (x.style.opacity = d));
    const settle = smooth(0.12, 0.78, p);
    paper.style.setProperty('--tilt', `${(-2.6 * (1 - settle)).toFixed(2)}deg`);
    paper.style.setProperty('--paper', settle.toFixed(3));
    section.style.setProperty('--glow', smooth(0.6, 0.9, p).toFixed(3));
    tab.dataset.state = p > 0.62 ? 'new' : 'old';
    const ci = p < 0.2 ? 0 : p < 0.66 ? 1 : 2;
    caps.forEach((c, i) => c.classList.toggle('on', i === ci));
    rail.style.transform = `scaleY(${p})`;
  }

  const ro = new ResizeObserver(() => { measure(); read(); });
  ro.observe(stage);
  addEventListener('scroll', read, { passive: true });
  document.fonts.ready.then(() => { measure(); read(); });
  measure();
  read();
  return () => { ro.disconnect(); removeEventListener('scroll', read); cancelAnimationFrame(raf); };
}

export const morphHTML = `
<section class="morph" aria-label="Before and after">
  <div class="morph-pin">
    <div class="morph-copy">
      <div class="morph-rail" aria-hidden="true"><i></i></div>
      <div class="morph-caps">
        <div class="morph-cap on"><h2>The resume you have.</h2><p>Calibri, shaded headings, an objective from 2009 and a second page nobody reads.</p></div>
        <div class="morph-cap"><h2>Drop it in.</h2><p>Rizzume reads your old PDF or Word file, keeps every word, and resets each line in its proper place.</p></div>
        <div class="morph-cap"><h2>The resume you send.</h2><p>One page, typeset like LaTeX, rules where they belong. Same you, better first impression.</p><button class="btn primary lg morph-cta" data-import>Import my old resume</button></div>
      </div>
    </div>
    <div class="morph-stage" aria-hidden="true">
      <div class="morph-file" data-state="old"><span class="f-old">Resume_final_FINAL(2).docx</span><span class="f-new">Prisha_Pankaj_Resume.pdf</span></div>
      <div class="morph-paper"></div>
    </div>
  </div>
</section>`;
