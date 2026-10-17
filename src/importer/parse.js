// Rebuild a structured resume from extracted lines. Rule-based and offline.
import { blankResume, newSection, blankEntry, bullet, uid } from '../model.js';

const HEADINGS = [
  ['profile', /^(professional |career |personal )?(summary|profile|objective|about( me)?|overview|introduction)$/],
  ['skills', /^((technical|key|core|relevant|it|computer|software) )?(skills?|competenc(y|ies)|technolog(y|ies)|tech stack|tools( (and|&) technologies)?|expertise|skill set|proficienc(y|ies))( (and|&) (tools|technologies|interests))?$/],
  ['experience', /^((professional|work|relevant|industry|internship) )?(experience|employment( history)?|work history|internships?|career history)$/],
  ['projects', /^((academic|personal|key|featured|selected|major|notable|technical) )?projects?( (and|&) (work|publications))?$/],
  ['education', /^(education(al)?( (background|qualifications?|details))?|academic( (background|qualifications?|details|history))?|qualifications?)$/],
  ['certifications', /^(certifications?|certificates?|licen[cs]es?( (and|&) certifications?)?|courses?( (and|&) certifications?)?|trainings?|workshops?|certifications? (and|&) (workshops|courses|trainings?|achievements))$/],
  ['achievements', /^(achievements?|awards?( (and|&) (achievements|honou?rs))?|honou?rs( (and|&) awards)?|accomplishments?|recognitions?)$/],
  ['leadership', /^(leadership( (and|&) (community|activities|involvement))?|extra[- ]?curricular( activities)?|activities|volunteer(ing)?( experience)?|positions? of responsibility|community( involvement)?|co[- ]curricular( activities)?)$/],
  ['additional', /^(additional( information)?|interests|hobbies( (and|&) interests)?|languages( known)?|other|others|miscellaneous|personal (details|information)|soft skills|strengths)$/],
  ['skip', /^(declaration|references?( available)?( on request)?|signature)$/],
];
const MONTH = '(jan(uary)?|feb(ruary)?|mar(ch)?|apr(il)?|may|june?|july?|aug(ust)?|sep(t(ember)?)?|oct(ober)?|nov(ember)?|dec(ember)?)';
const ONE = `(${MONTH}\\.?,?\\s*'?\\d{2,4}|\\d{1,2}/\\d{2,4}|(19|20)\\d{2})`;
const DATE_RE = new RegExp(`\\(?\\s*${ONE}(\\s*(-|–|—|to|till|until)\\s*(${ONE}|present|current|now|ongoing|today|date))?\\s*\\)?`, 'i');
const DATE_TAIL = new RegExp(`[\\s,|·–—-]*${DATE_RE.source}\\s*$`, 'i');
const GRADE_RE = /\b(c?gpa|cpi|sgpa|percentage|score|grade)\b\s*[:\-–]?\s*[\d.]+(\s*\/\s*\d+)?|\b\d{2}(\.\d+)?\s*%/i;

const norm = (t) => t.toLowerCase().replace(/[^a-z& ]/g, ' ').replace(/\s+/g, ' ').trim();

function headingType(line, ctx) {
  const t = line.text.trim();
  if (line.right || t.length > 48 || line.bullet) return null;
  const n = norm(t);
  if (!n) return null;
  for (const [type, re] of HEADINGS) if (re.test(n)) return type;
  const words = n.split(' ').length;
  const looksHeading = line.heading || ((t === t.toUpperCase() && /[A-Z]{3}/.test(t)) || (line.bold && line.size > ctx.body * 1.08)) && words <= 5 && !/[.,]$/.test(t);
  return looksHeading ? 'custom' : null;
}

export function findDate(s) {
  const m = s.match(DATE_TAIL) || s.match(DATE_RE);
  if (!m) return null;
  return { date: m[0].replace(/^[\s,|·–—(-]+|[\s)]+$/g, '').replace(/\s*(-|–|—|to)\s*/i, ' – ').replace(/\s+/g, ' '), rest: (s.slice(0, m.index) + s.slice(m.index + m[0].length)).replace(/[\s,|·–—(-]+$/, '').replace(/\(\s*\)/, '').trim() };
}

const pretty = (s) => s.replace(/\s+/g, ' ').trim();
// Join a wrapped line, undoing end-of-line hyphenation ("Collab-" + "oration").
const join = (a, b, sep = ' ') => (/\p{Ll}-$/u.test(a) && /^\p{Ll}/u.test(b) ? a.slice(0, -1) + b : a + sep + b);
const cap = (s) => (s === s.toUpperCase() && /[A-Z]{3}/.test(s) ? s.toLowerCase().replace(/(^|[\s(&/-])\p{L}/gu, (c) => c.toUpperCase()) : s);

export function parseResume(lines, fileName = 'Imported resume') {
  const r = blankResume(fileName.replace(/\.[^.]+$/, '').replace(/[_-]+/g, ' ').trim() || 'Imported resume');
  r.sections = [];
  r.style.autoFit = true;
  const report = { contacts: [], sections: [], unsorted: 0 };
  if (!lines.length) return { resume: r, report };

  const sizes = lines.map((l) => l.size).sort((a, b) => a - b);
  const ctx = { body: sizes[Math.floor(sizes.length / 2)] || 10 };
  const all = lines.map((l) => [l.text, l.right].filter(Boolean).join(' ')).join('\n');

  // ---- contacts
  const p = r.personal;
  const email = all.match(/[\w.+-]+@[\w-]+(\.[\w-]+)+/);
  if (email) p.email = email[0];
  const li = all.match(/linkedin\.com\/in\/([\w-]+)/i);
  if (li) p.linkedin = li[1];
  const gh = all.match(/github\.com\/([\w-]+)(?![\w-]*\/[\w-])/i) || all.match(/github\.com\/([\w-]+)/i);
  if (gh) p.github = gh[1];
  const phone = all.match(/(\+\d{1,3}[\s-]?)?(\(?\d{2,5}\)?[\s-]?){2,4}\d{2,5}/g)?.find((x) => x.replace(/\D/g, '').length >= 10 && x.replace(/\D/g, '').length <= 13 && !/^(19|20)\d{2}/.test(x.trim()));
  if (phone) p.phone = phone.trim();
  const headText = lines.slice(0, 8).map((l) => [l.text, l.right].join(' ')).join(' ');
  const site = headText.match(/\b((https?:\/\/)?(www\.)?[\w-]{2,}\.(dev|io|me|in|com|site|app|xyz|tech|page|net|org)(\/[\w./-]*)?)\b/gi)?.find((u) => !/linkedin|github|gmail|yahoo|outlook|hotmail|email/i.test(u) && !u.includes('@'));
  if (site) p.website = site.replace(/^https?:\/\//, '').replace(/\/$/, '');
  report.contacts = ['email', 'phone', 'linkedin', 'github', 'website'].filter((k) => p[k]);

  const isContact = (t) => /@|linkedin|github\.com|https?:|www\./i.test(t) || (t.replace(/\D/g, '').length >= 10 && t.replace(/[\d\s+()|-]/g, '').length < 8);

  // ---- header: everything before the first heading
  let i = 0;
  const firstHead = lines.findIndex((l) => { const t = headingType(l, ctx); return t && t !== 'custom'; });
  const headEnd = firstHead < 0 ? Math.min(4, lines.length) : firstHead;
  const head = lines.slice(0, headEnd);
  const nameLine = [...head].filter((l) => !isContact(l.text) && /\p{L}/u.test(l.text) && l.text.split(/\s+/).length <= 5 && l.text.length <= 40).sort((a, b) => b.size - a.size)[0];
  if (nameLine) p.name = nameLine.text.replace(/[|,].*$/, '').trim();
  const titleLine = head.find((l) => l !== nameLine && !isContact(l.text) && l.text.length > 3 && l.text.length < 110 && head.indexOf(l) > head.indexOf(nameLine));
  if (titleLine) p.title = titleLine.text.replace(/\s*[|•·]\s*$/, '');
  const segs = head.filter((l) => l !== nameLine && l !== titleLine).flatMap((l) => [l.text, l.right]).join(' | ').split(/\s*[|•·]\s*/);
  p.location = segs.find((x) => /^[A-Z][\p{L} .]+,\s*[A-Z][\p{L} .]+$/u.test(x.trim()) && x.length < 40) || '';
  i = headEnd;

  // ---- sections
  let sec = null;
  let entry = null;
  let lastBulletX = null;
  const unsorted = [];
  const startSection = (type, title) => {
    const s = newSection(type === 'custom' ? 'custom' : type);
    s.title = cap(title).replace(/[:\-–]+\s*$/, '').trim();
    if (s.kind === 'entries') s.items = [];
    if (s.kind === 'lines') s.rows = [];
    r.sections.push(s);
    sec = s; entry = null; lastBulletX = null;
  };
  const addEntry = (patch) => { entry = { ...blankEntry('compact'), bullets: [], ...patch, id: uid() }; sec.items.push(entry); lastBulletX = null; return entry; };

  for (; i < lines.length; i++) {
    const l = { ...lines[i] };
    const ht = headingType(l, ctx);
    if (ht === 'skip') { sec = { kind: 'skip' }; continue; }
    if (ht) { startSection(ht, l.text); continue; }
    if (!sec) { unsorted.push(l.text); continue; }
    if (sec.kind === 'skip') continue;
    const full = [l.text, l.right].filter(Boolean).join(' ');

    if (sec.kind === 'text') {
      sec.text = pretty(sec.text ? join(sec.text, full) : full);
      continue;
    }

    if (sec.kind === 'lines') {
      const m = full.match(/^([^:–—]{2,40}?)\s*[:–—]\s+(.+)$/) || full.match(/^([A-Za-z &/+#.]{2,30}?)\s+-\s+(.+)$/);
      const prev = sec.rows[sec.rows.length - 1];
      if (m && !(prev && /^[a-z]/.test(full))) sec.rows.push({ id: uid(), label: pretty(m[1]), value: pretty(m[2]) });
      else if (prev) prev.value = pretty(join(prev.value, full, l.bullet && !prev.label ? ', ' : ' '));
      else sec.rows.push({ id: uid(), label: sec.type === 'skills' ? 'Skills' : '', value: pretty(full) });
      continue;
    }

    // ---- entries
    const layout = sec.layout;
    // Continuation of a wrapped bullet (PDFs break lines physically).
    if (!l.bullet && entry?.bullets.length && lastBulletX !== null && l.x > lastBulletX + 2 && !l.right && !l.bold) {
      const b = entry.bullets[entry.bullets.length - 1];
      b.text = pretty(join(b.text, l.text));
      continue;
    }
    if (l.bullet) {
      if (!entry) addEntry({ bulletsOnly: true });
      if (layout === 'compact') {
        const titled = sec.items.some((x) => x.title && !x.bulletsOnly);
        const listStyle = !titled || sec.items.every((x) => x.fromBullet);
        if (listStyle) {
          const d = findDate(full);
          const [title, detail] = (d ? d.rest : full).split(/\s+[—–-]\s+|\s+from\s+/);
          if (entry.bulletsOnly && !entry.bullets.length) sec.items.pop();
          addEntry({ title: pretty(title), detail: pretty(detail || ''), right: d?.date || '', fromBullet: true });
          continue;
        }
        if (!entry.bulletsOnly) addEntry({ bulletsOnly: true });
      }
      entry.bullets.push(bullet(pretty(full)));
      lastBulletX = l.x;
      continue;
    }

    const rightDate = l.right ? findDate(l.right) : null;
    const d = rightDate ? { date: rightDate.date, rest: l.text } : findDate(full);
    const grade = full.match(GRADE_RE);

    if (layout === 'school') {
      if (entry && !entry.subtitle && !(d && entry.right) && (!d || !entry.right) && entry.title && !l.bold) {
        const base = l.right && !rightDate ? l.text : full;
        entry.subtitle = pretty((grade ? base.replace(grade[0], '') : d && !l.right ? d.rest : base).replace(/[,|–-]\s*$/, ''));
        entry.subRight = grade ? pretty(grade[0]) : l.right && !rightDate ? pretty(l.right) : '';
        if (d && !entry.right) entry.right = d.date;
        continue;
      }
      if (entry && grade && !entry.subRight && full.length < 40) { entry.subRight = pretty(grade[0]); continue; }
      const title = pretty((d ? d.rest : full).replace(grade?.[0] || '§', ''));
      addEntry({ title, right: d?.date || '', subRight: grade ? pretty(grade[0]) : '' });
      continue;
    }
    if (layout === 'compact') {
      const [title, detail] = (d ? d.rest : full).split(/\s+[—–]\s+|\s+-\s+|\s+from\s+|\s+by\s+/);
      addEntry({ title: pretty(title), detail: pretty(detail || ''), right: d?.date || '' });
      continue;
    }
    // role layout: experience, projects, leadership, custom
    const looksTitle = d || l.bold || l.right || !entry || entry.bullets.length;
    if (looksTitle && !(entry && !entry.bullets.length && !d && !l.bold && entry.title)) {
      const right = d?.date || (l.right && !findDate(l.right) ? '' : '');
      const linkish = /^(code|github|link|demo|live)$/i.test(l.right || '');
      addEntry({ title: pretty(d ? d.rest : l.text), right: right || (linkish ? l.right : ''), url: linkish && p.github ? `https://github.com/${p.github}` : '' });
      continue;
    }
    // Second line of a role header ("Company, City" or "Role"), before any bullets.
    if (entry && !entry.bullets.length) {
      const extra = pretty(d ? d.rest : full);
      if (d && !entry.right) entry.right = d.date;
      if (extra) entry.title = entry.title ? `${entry.title} — ${extra}` : extra;
      continue;
    }
    unsorted.push(full);
  }

  // ---- tidy
  r.sections = r.sections.filter((s) => s.kind !== 'skip').filter((s) => (s.kind === 'text' ? s.text : s.kind === 'lines' ? s.rows.length : s.items.length));
  for (const s of r.sections) {
    if (s.kind === 'entries') for (const e of s.items) { delete e.fromBullet; e.title = e.title.replace(/\s*[|•·,]\s*$/, ''); if (s.type === 'projects' && !e.right && e.url) e.right = 'Code'; }
    if (s.kind === 'lines' && s.type !== 'skills' && s.rows.every((x) => !x.label)) s.rows.forEach((x) => (x.label = 'Details'));
    report.sections.push({ title: s.title, kind: s.kind, count: s.kind === 'text' ? 1 : s.kind === 'lines' ? s.rows.length : s.items.length, bullets: s.kind === 'entries' ? s.items.reduce((a, e) => a + e.bullets.length, 0) : 0 });
  }
  if (unsorted.filter((x) => !isContact(x) && x !== p.name && x !== p.title && x !== p.location).length) {
    const left = unsorted.filter((x) => !isContact(x) && x !== p.name && x !== p.title && x !== p.location);
    const s = newSection('custom');
    s.title = 'Unsorted from import';
    s.visible = false;
    s.items = [{ ...blankEntry('role'), title: '', bulletsOnly: true, bullets: left.map((t) => bullet(t)) }];
    r.sections.push(s);
    report.unsorted = left.length;
  }
  if (!r.sections.length) r.sections = blankResume().sections;
  if (p.name) r.name = `${cap(p.name)} — Imported`;
  return { resume: r, report };
}
