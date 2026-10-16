// Renders a resume as a real A4 sheet. The same DOM drives the screen, the editor and the PDF.
import { faSvg } from './icons.js';

export const TEMPLATES = {
  classic: { name: 'Classic', note: 'Your LaTeX format, exactly. Serif, rules under headings.', base: 10 },
  modern: { name: 'Modern', note: 'Clean sans-serif with a quiet accent. Reads well on screens.', base: 9.5 },
  compact: { name: 'Compact', note: 'Small caps, centered header, tighter rhythm. Fits more in.', base: 9.5 },
};

export const ACCENTS = {
  ink: '#1a1a1a',
  navy: '#1f3a5f',
  forest: '#24543d',
  ember: '#b8461b',
  plum: '#5b2a5e',
};

const esc = (s = '') => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

export function contactList(p) {
  const out = [];
  if (p.email) out.push({ key: 'email', icon: 'envelope', pre: '', val: p.email, href: 'mailto:' + p.email });
  if (p.phone) out.push({ key: 'phone', icon: 'phone', pre: '', val: p.phone, href: 'tel:' + p.phone.replace(/[^+\d]/g, '') });
  if (p.linkedin) out.push({ key: 'linkedin', icon: 'linkedin', pre: 'linkedin.com/in/', val: p.linkedin, href: 'https://linkedin.com/in/' + p.linkedin });
  if (p.github) out.push({ key: 'github', icon: 'github', pre: 'github.com/', val: p.github, href: 'https://github.com/' + p.github });
  if (p.website) out.push({ key: 'website', icon: 'globe', pre: '', val: p.website, href: /^https?:/.test(p.website) ? p.website : 'https://' + p.website });
  if (p.location) out.push({ key: 'location', icon: 'mapPin', pre: '', val: p.location, href: '' });
  return out;
}

export function renderResume(r, { editable = false } = {}) {
  const E = editable;
  const ed = (path, value, ph, tag = 'span', cls = '') => {
    if (!E && !value) return '';
    const attrs = E ? ` contenteditable="plaintext-only" spellcheck="true" data-path="${path}" data-ph="${esc(ph)}"` : '';
    return `<${tag} class="${cls}"${attrs}>${esc(value)}</${tag}>`;
  };
  const link = (href, inner) => (!E && href ? `<a href="${esc(href)}">${inner}</a>` : inner);

  const p = r.personal;
  const contacts = contactList(p)
    .map((c) => {
      const text = `${c.pre ? `<span class="r-pre">${esc(c.pre)}</span>` : ''}${ed('personal.' + c.key, c.val, c.key, 'span')}`;
      return `<div class="r-c">${faSvg(c.icon)}<span class="r-sp"> </span>${link(c.href, text)}</div>`;
    })
    .join('');

  let html = `<header class="r-head"><div class="r-id">${ed('personal.name', p.name, 'YOUR NAME', 'div', 'r-name')}${ed(
    'personal.title',
    p.title,
    'Role you want | What you bring',
    'div',
    'r-title'
  )}</div><div class="r-contact">${contacts}</div></header>`;

  r.sections.forEach((s, si) => {
    if (!s.visible) return;
    const sp = `sections.${si}`;
    let body = '';
    if (s.kind === 'text') {
      body = ed(`${sp}.text`, s.text, 'Two or three lines on who you are, what you build and what you want next.', 'p', 'r-p') || '';
    } else if (s.kind === 'lines') {
      body = s.rows
        .map((row, ri) => {
          if (!E && !row.label && !row.value) return '';
          const lp = `${sp}.rows.${ri}`;
          return `<div class="r-line" data-row="${ri}"><b>${ed(lp + '.label', row.label, 'Label')}:</b> ${ed(lp + '.value', row.value, 'Python, Git, Docker…')}</div>`;
        })
        .join('');
    } else if (s.kind === 'entries') {
      body = s.items
        .map((it, ii) => {
          const ip = `${sp}.items.${ii}`;
          const L = s.layout;
          const hasHead = !it.bulletsOnly && (E || it.title || it.right || it.detail || it.subtitle);
          let head = '';
          const icon = it.url ? faSvg(/github\.com/.test(it.url) ? 'github' : 'link') + '<span class="r-sp"> </span>' : '';
          const right = it.right || E ? link(it.url, `${icon}${ed(ip + '.right', it.right, L === 'role' ? 'Date' : 'Year')}`) : '';
          if (hasHead) {
            if (L === 'school') {
              head = `<div class="r-row"><span class="r-t">${ed(ip + '.title', it.title, 'University or college')}</span><span class="r-r r-it">${right}</span></div>
              <div class="r-row r-sub"><span>${ed(ip + '.subtitle', it.subtitle, 'Degree and major')}</span><span class="r-r r-b">${ed(ip + '.subRight', it.subRight, 'CGPA / %')}</span></div>`;
            } else if (L === 'compact') {
              const det = it.detail || E ? `<span class="r-det"> — ${ed(ip + '.detail', it.detail, 'Issuer')}</span>` : '';
              head = `<div class="r-row r-cmp"><span class="r-t">${ed(ip + '.title', it.title, 'Certificate or award')}${det}</span><span class="r-r">${right}</span></div>`;
            } else {
              const det = it.detail ? ` — ${ed(ip + '.detail', it.detail, '')}` : '';
              head = `<div class="r-row"><span class="r-t">${ed(ip + '.title', it.title, 'Role — Company')}${det}</span><span class="r-r r-b">${right}</span></div>`;
            }
          }
          const bl = it.bullets
            .map((b, bi) => {
              if (!E && !b.text) return '';
              return `<li data-b="${bi}"><span class="r-bul">•</span>${ed(`${ip}.bullets.${bi}.text`, b.text, 'Start with a verb. Add a number if you can.', 'span', 'r-btext')}</li>`;
            })
            .join('');
          const hasBullets = it.bullets.some((b) => b.text) || (E && it.bullets.length);
          return `<div class="r-entry r-${L}${it.bulletsOnly ? ' r-only' : ''}" data-entry="${si}.${ii}">${head}${hasBullets ? `<ul class="r-ul">${bl}</ul>` : ''}</div>`;
        })
        .join('');
    }
    html += `<section class="r-sec r-k-${s.kind}${s.tight ? ' r-tight' : ''}" data-sec="${si}"><h2 class="r-h">${ed(sp + '.title', s.title, 'Section title')}</h2><div class="r-body">${body}</div></section>`;
  });
  return html;
}

// Build or update a sheet element.
export function sheetEl(r, opts = {}) {
  const el = document.createElement('article');
  el.className = 'sheet';
  el.lang = 'en';
  paintSheet(el, r, opts);
  return el;
}

export function paintSheet(el, r, opts = {}) {
  el.className = `sheet tpl-${r.template}${opts.editable ? ' is-edit' : ''}`;
  el.style.setProperty('--accent', ACCENTS[r.style.accent] || ACCENTS.ink);
  el.innerHTML = `<div class="sheet-body">${renderResume(r, opts)}</div>`;
}
