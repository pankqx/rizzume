// Turn a resume file into a flat list of "lines" with just enough layout to rebuild structure:
// { text, right, size, bold, x, bullet, heading }
import { unzipSync, strFromU8 } from 'fflate';

const BULLET_RE = /^\s*([•●▪■◦○◆◇➢➤►▸‣⁃∙·\-–*\u0080-\u009f\uf000-\uf0ff\ufffd]|o(?=\s)|\d{1,2}[.)](?=\s))\s*/;

export async function extractLines(file) {
  const name = file.name.toLowerCase();
  if (name.endsWith('.pdf') || file.type === 'application/pdf') return fromPdf(await file.arrayBuffer());
  if (name.endsWith('.docx')) return fromDocx(await file.arrayBuffer());
  if (name.endsWith('.tex')) return fromTex(await file.text());
  if (name.endsWith('.doc')) throw new Error('Old .doc files can’t be read in the browser. Save it as .docx or PDF and try again.');
  return fromText(await file.text());
}

export function markBullet(line) {
  const m = line.text.match(BULLET_RE);
  if (m && line.text.length > m[0].length + 2) {
    line.bullet = true;
    line.text = line.text.slice(m[0].length);
  }
  return line;
}

// ---------------------------------------------------------------- PDF
async function fromPdf(buf) {
  const pdfjs = await import('pdfjs-dist');
  const workerUrl = (await import('pdfjs-dist/build/pdf.worker.min.mjs?url')).default;
  pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;
  const doc = await pdfjs.getDocument({ data: new Uint8Array(buf), isEvalSupported: false }).promise;
  const out = [];
  let yOffset = 0;
  for (let pn = 1; pn <= Math.min(doc.numPages, 4); pn++) {
    const page = await doc.getPage(pn);
    const vp = page.getViewport({ scale: 1 });
    await page.getOperatorList(); // loads fonts so their real names (e.g. CMBX10, Arial-BoldMT) are known
    const tc = await page.getTextContent();
    const fontBold = {};
    for (const [k, st] of Object.entries(tc.styles)) fontBold[k] = /bold|black|heavy|semibold|demi|bx/i.test(st.fontFamily || '');
    // Font names often only carry weight in the embedded font object.
    for (const it of tc.items) {
      if (it.fontName && fontBold[it.fontName] === false) {
        try { const f = page.commonObjs.get(it.fontName); if (f?.name && /bold|black|heavy|semibold|demi|cmbx|bx\d/i.test(f.name)) fontBold[it.fontName] = true; } catch {}
      }
    }
    const items = tc.items
      .filter((it) => it.str !== undefined && (it.str.trim() || it.hasEOL))
      .map((it) => ({ s: it.str, x: it.transform[4], y: vp.height - it.transform[5], w: it.width, h: Math.abs(it.transform[3]) || it.height, bold: !!fontBold[it.fontName] }))
      .filter((it) => it.s.trim());
    items.sort((a, b) => a.y - b.y || a.x - b.x);
    const rows = [];
    for (const it of items) {
      const row = rows.find((r) => Math.abs(r.y - it.y) < Math.max(2, it.h * 0.45));
      if (row) row.items.push(it);
      else rows.push({ y: it.y, items: [it] });
    }
    rows.sort((a, b) => a.y - b.y);
    for (const row of rows) {
      row.items.sort((a, b) => a.x - b.x);
      const size = Math.max(...row.items.map((i) => i.h));
      const segs = [];
      let cur = null;
      for (const it of row.items) {
        const gap = cur ? it.x - (cur.x + cur.w) : 0;
        if (cur && gap > size * 2.2) { segs.push(cur); cur = null; }
        if (!cur) cur = { text: it.s, x: it.x, w: it.w, bold: it.bold, boldChars: it.bold ? it.s.length : 0, chars: it.s.length };
        else {
          const space = gap > size * 0.12 && !/\s$/.test(cur.text) && !/^\s/.test(it.s) ? ' ' : '';
          cur.text += space + it.s;
          cur.w = it.x + it.w - cur.x;
          cur.chars += it.s.length;
          cur.boldChars += it.bold ? it.s.length : 0;
        }
      }
      if (cur) segs.push(cur);
      const tidy = (t) => t.replace(/\s+/g, ' ').trim();
      const left = segs[0];
      const rest = segs.slice(1).map((s) => tidy(s.text)).filter(Boolean);
      const line = {
        text: tidy(left.text),
        right: rest.join(' '),
        size: +size.toFixed(2),
        bold: left.boldChars / Math.max(1, left.chars) > 0.6,
        x: +left.x.toFixed(1),
        y: row.y + yOffset,
        page: pn,
      };
      // Bullet glyph drawn as its own item ("•" then text): merge.
      if (/^[•●▪■◦○➢➤►‣∙·–\-\u0080-\u009f\uf000-\uf0ff]$/.test(line.text) && rest.length) { line.text = rest.shift(); line.right = rest.join(' '); line.bullet = true; }
      if (!line.text) continue;
      out.push(line.bullet ? line : markBullet(line));
    }
    yOffset += vp.height;
  }
  return normalizeIndents(out);
}

// ---------------------------------------------------------------- DOCX
function fromDocx(buf) {
  const files = unzipSync(new Uint8Array(buf), { filter: (f) => /^word\/(document|numbering|styles)\.xml$/.test(f.name) });
  const xml = files['word/document.xml'];
  if (!xml) throw new Error('That Word file looks damaged.');
  const dom = new DOMParser().parseFromString(strFromU8(xml), 'application/xml');
  const W = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main';
  const stylesXml = files['word/styles.xml'] ? new DOMParser().parseFromString(strFromU8(files['word/styles.xml']), 'application/xml') : null;
  const headingStyles = new Set();
  if (stylesXml) for (const st of stylesXml.getElementsByTagNameNS(W, 'style')) {
    const id = st.getAttributeNS(W, 'styleId') || '';
    const nm = st.getElementsByTagNameNS(W, 'name')[0]?.getAttributeNS(W, 'val') || '';
    if (/heading|title/i.test(nm) || /heading|title/i.test(id)) headingStyles.add(id);
  }
  const out = [];
  const body = dom.getElementsByTagNameNS(W, 'body')[0];
  // Tables are common in templates; read their paragraphs in order, one cell after another.
  const paras = body.getElementsByTagNameNS(W, 'p');
  for (const p of paras) {
    const pPr = p.getElementsByTagNameNS(W, 'pPr')[0];
    const style = pPr?.getElementsByTagNameNS(W, 'pStyle')[0]?.getAttributeNS(W, 'val') || '';
    const numbered = !!pPr?.getElementsByTagNameNS(W, 'numPr')[0];
    const ind = parseInt(pPr?.getElementsByTagNameNS(W, 'ind')[0]?.getAttributeNS(W, 'left') || '0', 10);
    let parts = [''], boldChars = 0, chars = 0, size = 0;
    for (const r of p.getElementsByTagNameNS(W, 'r')) {
      const rPr = r.getElementsByTagNameNS(W, 'rPr')[0];
      const b = rPr?.getElementsByTagNameNS(W, 'b')[0];
      const bold = !!b && b.getAttributeNS(W, 'val') !== '0' && b.getAttributeNS(W, 'val') !== 'false';
      const sz = parseInt(rPr?.getElementsByTagNameNS(W, 'sz')[0]?.getAttributeNS(W, 'val') || '0', 10) / 2;
      for (const n of r.childNodes) {
        if (n.localName === 't') { parts[parts.length - 1] += n.textContent; chars += n.textContent.length; if (bold) boldChars += n.textContent.length; if (sz) size = Math.max(size, sz); }
        else if (n.localName === 'tab') parts.push('');
        else if (n.localName === 'br') parts.push('\n');
      }
    }
    const textAll = parts.join('\t');
    if (!textAll.replace(/[\t\n]/g, '').trim()) continue;
    // Soft line breaks inside one paragraph become separate lines.
    const segments = parts.map((s) => s.replace(/\s+/g, ' ').trim()).filter((s, i, a) => s || i === 0);
    const nonEmpty = segments.filter(Boolean);
    const line = {
      text: nonEmpty[0] || '',
      right: nonEmpty.slice(1).join(' '),
      size: size || 11,
      bold: boldChars / Math.max(1, chars) > 0.6,
      x: ind / 20,
      heading: headingStyles.has(style) || /heading|title/i.test(style),
      bullet: numbered || /list/i.test(style),
    };
    out.push(line.bullet ? line : markBullet(line));
  }
  return out;
}

// ---------------------------------------------------------------- LaTeX (incl. the old resume engine)
function fromTex(src) {
  let s = src.replace(/(^|[^\\])%.*$/gm, '$1');
  s = s.replace(/\\begin\{comment\}[\s\S]*?\\end\{comment\}/g, '');
  const docStart = s.indexOf('\\begin{document}');
  // Resume-engine data files keep content inside \newcommand bodies — keep those, drop the preamble otherwise.
  if (docStart >= 0) s = s.slice(docStart);
  s = s.replace(/\\(re)?newcommand\{\\\w+\}(\[\d\])?\{/g, '\n{');
  s = s.replace(/\\section\*?\{([^}]*)\}/g, '\n§H§$1\n');
  s = s.replace(/\\(fa[A-Za-z]+\*?)(\\ )?/g, '');
  s = s.replace(/\\href\{[^}]*\}\{([^}]*)\}/g, '$1');
  s = s.replace(/\\resumeEntryTitle\{([^}]*)\}\{([^}]*)\}/g, '\n$1 \\hfill $2\n');
  s = s.replace(/\\resumeEntry\{([^}]*)\}\{([^}]*)\}\{([^}]*)\}\{([^}]*)\}/g, '\n$1 \\hfill $2\n$3 \\hfill $4\n');
  s = s.replace(/\\item\s*/g, '\n§B§');
  s = s.replace(/\\(textbf|textit|emph|underline|small|large|Large|textsc|mbox)\{([^}]*)\}/g, '$2');
  s = s.replace(/\\\\(\[[^\]]*\])?/g, '\n');
  s = s.replace(/\\(fa[A-Za-z]+\*?|vspace\{[^}]*\}|hspace\{[^}]*\}|noindent|centering|raggedright|raggedleft|selectfont|bfseries|itshape|small|large|Large|huge|LARGE|fontsize\{[^}]*\}\{[^}]*\})/g, '');
  s = s.replace(/\\(begin|end)\{[^}]*\}(\[[^\]]*\])?(\{[^}]*\})*/g, '\n');
  s = s.replace(/\\(&|%|\$|#|_)/g, '$1').replace(/~/g, ' ').replace(/---/g, '—').replace(/--/g, '–').replace(/\\ /g, ' ');
  s = s.replace(/\\textbar\{?\}?/g, '|').replace(/\\(input|usepackage|documentclass)(\[[^\]]*\])?\{[^}]*\}/g, '');
  s = s.replace(/\\[a-zA-Z]+\*?/g, (m) => (m === '\\hfill' ? '§R§' : ''));
  s = s.replace(/[{}]/g, '');
  const out = [];
  for (let raw of s.split('\n')) {
    raw = raw.replace(/\s+/g, ' ').trim();
    if (!raw) continue;
    const heading = raw.startsWith('§H§');
    const bullet = raw.startsWith('§B§');
    raw = raw.replace(/^§[HB]§/, '');
    const [l, ...r] = raw.split('§R§');
    out.push({ text: l.trim(), right: r.join(' ').trim(), size: heading ? 12 : 10, bold: heading, heading, bullet, x: bullet ? 12 : 0 });
  }
  return out.filter((l) => l.text || l.right);
}

// ---------------------------------------------------------------- plain text
function fromText(src) {
  return src.split(/\r?\n/).map((t) => {
    const parts = t.split(/\t+| {4,}/).map((x) => x.trim()).filter(Boolean);
    return markBullet({ text: parts[0] || '', right: parts.slice(1).join(' '), size: 10, bold: false, x: (t.match(/^\s*/)[0].length) * 3 });
  }).filter((l) => l.text);
}

function normalizeIndents(lines) {
  const body = lines.map((l) => l.x);
  const min = Math.min(...body);
  lines.forEach((l) => (l.x = +(l.x - min).toFixed(1)));
  return lines;
}
