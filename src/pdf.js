// Vector PDF export. We lay the resume out in the browser, then copy every word, rule,
// icon and link to a PDF at the exact position the browser put it. The result is real,
// selectable text (ATS-friendly) that looks identical to the screen.
import { PDFDocument, rgb, PDFString, PDFName } from 'pdf-lib';
import fontkit from '@pdf-lib/fontkit';
import { sheetEl } from './render.js';
import { fit, AVAIL_H } from './fit.js';
import { FA } from './icons.js';
import { fileBase, saveBlob } from './files.js';

const F = (f) => new URL(`./fonts/${f}`, import.meta.url).href;
const FONT_FILES = {
  'LM Roman|400|normal': F('lmroman10-regular.ttf'),
  'LM Roman|700|normal': F('lmroman10-bold.ttf'),
  'LM Roman|400|italic': F('lmroman10-italic.ttf'),
  'LM Roman|700|italic': F('lmroman10-bolditalic.ttf'),
  'LM Roman Caps|400|normal': F('lmromancaps10-regular.ttf'),
  'Plex Sans|400|normal': F('plexsans-400-normal.ttf'),
  'Plex Sans|700|normal': F('plexsans-700-normal.ttf'),
  'Plex Sans|400|italic': F('plexsans-400-italic.ttf'),
  'Plex Sans|700|italic': F('plexsans-700-italic.ttf'),
};
const bytesCache = {};
const getBytes = async (url) => (bytesCache[url] ||= fetch(url).then((r) => r.arrayBuffer()));

const PT = 0.75; // px -> pt
const PAGE_W = 595.28, PAGE_H = 841.89, MARGIN_PX = 48;

function fontKey(cs) {
  let fam = cs.fontFamily.split(',')[0].replace(/["']/g, '').trim();
  if (!Object.keys(FONT_FILES).some((k) => k.startsWith(fam + '|'))) fam = 'LM Roman';
  const w = parseInt(cs.fontWeight, 10) >= 600 ? 700 : 400;
  const st = cs.fontStyle === 'italic' || cs.fontStyle === 'oblique' ? 'italic' : 'normal';
  let key = `${fam}|${w}|${st}`;
  if (!FONT_FILES[key]) key = `${fam}|400|normal`;
  return key;
}

function parseColor(c) {
  const m = c.match(/[\d.]+/g) || [0, 0, 0];
  return rgb(+m[0] / 255, +m[1] / 255, +m[2] / 255);
}

// Where the baseline sits inside a text rect, as a fraction of font size. Measured, not assumed,
// so it is right on every OS.
const baselineCache = {};
function baselineRatio(host, cs) {
  const key = cs.fontFamily + cs.fontWeight + cs.fontStyle;
  if (baselineCache[key]) return baselineCache[key];
  const probe = document.createElement('div');
  probe.style.cssText = `position:absolute;left:0;top:0;white-space:nowrap;font-family:${cs.fontFamily};font-weight:${cs.fontWeight};font-style:${cs.fontStyle};font-size:100px;line-height:3`;
  probe.innerHTML = '<span>Hxg</span><i style="display:inline-block;width:0;height:0"></i>';
  host.appendChild(probe);
  const range = document.createRange();
  range.selectNodeContents(probe.firstChild);
  const top = range.getClientRects()[0].top;
  const base = probe.lastChild.getBoundingClientRect().bottom;
  probe.remove();
  return (baselineCache[key] = (base - top) / 100);
}

export async function buildPdf(resume) {
  // 1. Lay out a clean (non-editable) copy offscreen.
  const host = document.createElement('div');
  host.style.cssText = 'position:fixed;left:-20000px;top:0;pointer-events:none;';
  document.body.appendChild(host);
  const sheet = sheetEl(resume, { editable: false });
  host.appendChild(sheet);
  await document.fonts.ready;
  fit(sheet, resume);
  await new Promise((r) => requestAnimationFrame(r));

  const doc = await PDFDocument.create();
  doc.registerFontkit(fontkit);
  const name = resume.personal.name || 'Resume';
  doc.setTitle(`${name} — Resume`);
  doc.setAuthor(name);
  doc.setCreator('Rizzume');
  doc.setProducer('Rizzume');

  const fonts = {};
  const font = async (key) => (fonts[key] ||= doc.embedFont(await getBytes(FONT_FILES[key]), { subset: false }));

  const S = sheet.getBoundingClientRect();
  const pages = [];
  const pageFor = (topPx) => {
    const i = Math.max(0, Math.floor((topPx - MARGIN_PX) / AVAIL_H));
    while (pages.length <= i) pages.push(doc.addPage([PAGE_W, PAGE_H]));
    return { page: pages[i], shift: i * AVAIL_H };
  };
  pageFor(0);
  const X = (px) => (px - S.left) * PT;

  // 2. Text, word by word.
  const walker = document.createTreeWalker(sheet, NodeFilter.SHOW_TEXT);
  const range = document.createRange();
  const jobs = [];
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    const text = node.nodeValue;
    if (!text.trim()) continue;
    const el = node.parentElement;
    const cs = getComputedStyle(el);
    if (cs.visibility === 'hidden' || cs.display === 'none') continue;
    const sizePx = parseFloat(cs.fontSize);
    const ratio = baselineRatio(host, cs);
    const key = fontKey(cs);
    const color = parseColor(cs.color);
    const upper = cs.textTransform === 'uppercase';
    const re = /\S+/g;
    let m;
    while ((m = re.exec(text))) {
      const start = m.index, end = start + m[0].length;
      range.setStart(node, start);
      range.setEnd(node, end);
      const rects = [...range.getClientRects()].filter((r) => r.width > 0);
      if (!rects.length) continue;
      const trail = /\s/.test(text[end] || '') ? ' ' : '';
      if (rects.length === 1) {
        jobs.push({ str: m[0] + trail, rect: rects[0], key, sizePx, ratio, color, upper });
      } else {
        // Word hyphenated across lines: find the break.
        let cut = start + 1;
        const firstTop = rects[0].top;
        for (let i = start + 1; i < end; i++) {
          range.setStart(node, i);
          range.setEnd(node, i + 1);
          const r = range.getClientRects()[0];
          if (r && Math.abs(r.top - firstTop) > 2) { cut = i; break; }
        }
        const a = text.slice(start, cut), b = text.slice(cut, end);
        jobs.push({ str: a.endsWith('-') ? a : a + '-', rect: rects[0], key, sizePx, ratio, color, upper });
        range.setStart(node, cut); range.setEnd(node, end);
        const rb = [...range.getClientRects()].filter((r) => r.width > 0)[0] || rects[rects.length - 1];
        jobs.push({ str: b + trail, rect: rb, key, sizePx, ratio, color, upper });
      }
    }
  }
  for (const j of jobs) {
    const f = await font(j.key);
    const top = j.rect.top - S.top;
    const { page, shift } = pageFor(top);
    const baseline = top + j.ratio * j.sizePx - shift;
    let str = j.upper ? j.str.toUpperCase() : j.str;
    // Replace glyphs the font lacks so pdf-lib never throws.
    str = [...str].map((ch) => (f.getCharacterSet().includes(ch.codePointAt(0)) ? ch : '?')).join('');
    page.drawText(str, { x: X(j.rect.left), y: PAGE_H - baseline * PT, size: j.sizePx * PT, font: f, color: j.color });
  }

  // 3. Rules (borders), icons and links.
  for (const el of sheet.querySelectorAll('*')) {
    const cs = getComputedStyle(el);
    const bw = parseFloat(cs.borderBottomWidth);
    if (bw > 0 && cs.borderBottomStyle !== 'none') {
      const r = el.getBoundingClientRect();
      const top = r.bottom - S.top - bw;
      const { page, shift } = pageFor(top);
      page.drawRectangle({ x: X(r.left), y: PAGE_H - (top - shift + bw) * PT, width: r.width * PT, height: bw * PT, color: parseColor(cs.borderBottomColor) });
    }
  }
  for (const svg of sheet.querySelectorAll('svg[data-fa]')) {
    const ico = FA[svg.dataset.fa];
    const r = svg.getBoundingClientRect();
    const top = r.top - S.top;
    const { page, shift } = pageFor(top);
    const scale = (r.height / ico.h) * PT;
    page.drawSvgPath(ico.d, { x: X(r.left), y: PAGE_H - (top - shift) * PT, scale, color: parseColor(getComputedStyle(svg).fill) });
  }
  for (const a of sheet.querySelectorAll('a[href]')) {
    for (const r of a.getClientRects()) {
      const top = r.top - S.top;
      const { page, shift } = pageFor(top);
      const y1 = PAGE_H - (top - shift + r.height) * PT, y2 = PAGE_H - (top - shift) * PT;
      const annot = doc.context.obj({
        Type: 'Annot', Subtype: 'Link', Rect: [X(r.left), y1, X(r.right), y2], Border: [0, 0, 0],
        A: { Type: 'Action', S: 'URI', URI: PDFString.of(a.href) },
      });
      page.node.addAnnot(doc.context.register(annot));
    }
  }
  void PDFName;
  host.remove();
  return doc.save();
}

export async function downloadPdf(resume) {
  const bytes = await buildPdf(resume);
  const name = fileBase(resume) + '.pdf';
  saveBlob(bytes, name, 'application/pdf');
  return name;
}
