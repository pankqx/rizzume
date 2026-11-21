// Renders a resume as a real A4 sheet. The same DOM drives the screen, the editor and the PDF.
import { faSvg } from './icons.js';

export const TEMPLATES = {
  classic: { name: 'Classic', note: 'Your LaTeX format, exactly. Serif, rules under headings.', base: 10 },
  modern: { name: 'Modern', note: 'Clean sans-serif with a quiet accent. Reads well on screens.', base: 9.5 },
  compact: { name: 'Compact', note: 'Small caps, centered header, tighter rhythm. Fits more in.', base: 9.5 },
  pankaj: { name: 'Placement', note: 'Your campus-placement LaTeX format: Times, links on the right, education table, declaration.', base: 9.8 },
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

export function renderResume(r, opts = {}) {
  if (r.template === 'pankaj') return renderPlacement(r, opts);
  const { editable = false } = opts;
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
              head = `<div class="r-row"><span class="r-t">${ed(ip + '.title', it.title, 'University or college')}</span><span class="r-r r-b">${right}</span></div>
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

// ---------------------------------------------------------------------------
// Placement template: a point-for-point copy of the hand-written LaTeX resume
// (Times, links stacked on the right, small-caps headings, education table).
// ---------------------------------------------------------------------------
const scHtml = (t = '') =>
  String(t)
    .split(/([a-z]+)/)
    .map((part, i) => (i % 2 ? `<span class="r-sc">${esc(part.toUpperCase())}</span>` : esc(part)))
    .join('');

export const entryLinks = (it) => {
  const list = (it.links || []).filter((l) => l.label || l.url);
  if (list.length) return list;
  if (it.url) return [{ label: /github\.com/.test(it.url) ? 'GitHub' : 'Link', url: it.url }];
  return [];
};

function renderPlacement(r, { editable = false } = {}) {
  const E = editable;
  const ed = (path, value, ph, tag = 'span', cls = '') => {
    if (!E && !value) return '';
    const attrs = E ? ` contenteditable="plaintext-only" spellcheck="true" data-path="${path}" data-ph="${esc(ph)}"` : '';
    return `<${tag} class="${cls}"${attrs}>${esc(value)}</${tag}>`;
  };
  const link = (href, inner) => (!E && href ? `<a href="${esc(href)}">${inner}</a>` : inner);
  const p = r.personal;

  // Header: identity on the left, links stacked on the right.
  const c = contactList(p);
  const pick = (k) => c.find((x) => x.key === k);
  const stack = ['website', 'linkedin', 'github', 'email']
    .map(pick)
    .filter(Boolean)
    .map((x) => `<div class="r-c r-lnk">${link(x.href, `${x.pre ? `<span class="r-pre">${esc(x.pre)}</span>` : ''}${ed('personal.' + x.key, x.val, x.key)}`)}</div>`);
  const tail = ['phone', 'location'].map(pick).filter(Boolean);
  if (tail.length) stack.push(`<div class="r-c">${tail.map((x) => ed('personal.' + x.key, x.val, x.key)).join('<span class="r-bar"> | </span>')}</div>`);
  let html = `<header class="r-head"><div class="r-id">${ed('personal.name', p.name, 'YOUR NAME', 'div', 'r-name')}${ed('personal.title', p.title, 'Software Engineer', 'div', 'r-title')}${ed('personal.tagline', p.tagline, 'What you build, in a few words', 'div', 'r-tag')}</div><div class="r-contact">${stack.join('')}</div></header><div class="r-hr"></div>`;

  r.sections.forEach((s, si) => {
    if (!s.visible) return;
    const sp = `sections.${si}`;
    if (s.type === 'declaration') {
      if (!E && !s.text) return;
      html += `<section class="r-sec r-decl" data-sec="${si}" data-type="declaration"><p class="r-p">${E ? ed(`${sp}.title`, s.title, 'Declaration') : esc(s.title)}${s.title || E ? ': ' : ''}${ed(`${sp}.text`, s.text, 'I declare that the information presented above is true and accurate to the best of my knowledge and belief.')}</p></section>`;
      return;
    }
    let body = '';
    if (s.kind === 'text') {
      body = ed(`${sp}.text`, s.text, 'Two or three lines on who you are, what you build and what you want next.', 'p', 'r-p') || '';
    } else if (s.kind === 'lines') {
      body = s.rows
        .map((row, ri) => {
          if (!E && !row.label && !row.value) return '';
          const lp = `${sp}.rows.${ri}`;
          return `<div class="r-line" data-row="${ri}"><b>${ed(lp + '.label', row.label, 'Label')}:</b> ${ed(lp + '.value', row.value, 'Details…')}</div>`;
        })
        .join('');
    } else if (s.kind === 'entries' && s.layout === 'school') {
      const rows = s.items
        .map((it, ii) => {
          const ip = `${sp}.items.${ii}`;
          if (!E && !it.title && !it.subtitle && !it.subRight && !it.right) return '';
          return `<div class="r-entry r-trow" data-entry="${si}.${ii}"><span>${ed(ip + '.subtitle', it.subtitle, 'Degree')}</span><span>${ed(ip + '.title', it.title, 'Institute')}</span><span>${ed(ip + '.subRight', it.subRight, 'CGPA / %')}</span><span>${ed(ip + '.right', it.right, 'Year')}</span></div>`;
        })
        .join('');
      body = `<div class="r-tbl"><div class="r-trule"></div><div class="r-thead"><b>Degree</b><b>Institute</b><b>CGPA / %</b><b>Year</b></div>${rows}<div class="r-tend"></div></div>`;
    } else if (s.kind === 'entries') {
      const proj = s.type === 'projects';
      body = s.items
        .map((it, ii) => {
          const ip = `${sp}.items.${ii}`;
          let head = '';
          if (!it.bulletsOnly && (E || it.title || it.right || it.subtitle)) {
            const links = entryLinks(it);
            const lk = links.length
              ? ` <span class="r-links">[${links.map((l) => (E || !l.url ? `<span>${esc(l.label)}</span>` : `<a href="${esc(l.url)}">${esc(l.label)}</a>`)).join('<span class="r-bar"> | </span>')}]</span>`
              : '';
            const det = it.detail ? `<span class="r-det"> — ${ed(ip + '.detail', it.detail, '')}</span>` : '';
            head = `<div class="r-row"><span class="r-t">${ed(ip + '.title', it.title, proj ? 'Project: what it is' : 'Organisation')}${det}${lk}</span><span class="r-r">${ed(ip + '.right', it.right, proj ? 'Tech stack' : 'Dates')}</span></div>`;
            if (it.subtitle || it.subRight || (E && !proj && !it.title)) head += `<div class="r-row r-sub"><span>${ed(ip + '.subtitle', it.subtitle, 'Role')}</span><span class="r-r">${ed(ip + '.subRight', it.subRight, 'Place')}</span></div>`;
          }
          const bl = it.bullets
            .map((b, bi) => {
              if (!E && !b.text) return '';
              return `<li data-b="${bi}"><span class="r-bul">•</span>${ed(`${ip}.bullets.${bi}.text`, b.text, 'Start with a verb. Add a number if you can.', 'span', 'r-btext')}</li>`;
            })
            .join('');
          const hasBullets = it.bullets.some((b) => b.text) || (E && it.bullets.length);
          return `<div class="r-entry r-role${it.bulletsOnly ? ' r-only' : ''}" data-entry="${si}.${ii}">${head}${hasBullets ? `<ul class="r-ul">${bl}</ul>` : ''}</div>`;
        })
        .join('');
    }
    const title = E ? ed(sp + '.title', s.title, 'Section title') : scHtml(s.title);
    html += `<section class="r-sec r-k-${s.kind}${s.tight ? ' r-tight' : ''}" data-sec="${si}" data-type="${esc(s.type || '')}"><h2 class="r-h">${title}</h2><div class="r-body">${body}</div></section>`;
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
