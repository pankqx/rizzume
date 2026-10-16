// Proofreading: rule-based, offline, explainable. Each finding points at a path in the resume.

const WEAK = ['helped', 'help', 'worked', 'work', 'responsible', 'assisted', 'assist', 'did', 'made', 'handled', 'involved', 'participated', 'tasked', 'was', 'were', 'tried', 'got', 'used', 'utilized', 'learned', 'learnt'];
const STRONG = 'Built, Led, Designed, Shipped, Reduced, Automated, Launched, Improved, Owned, Migrated';

export function proofread(r, sheet) {
  const notes = [];
  const add = (path, level, msg, fix) => notes.push({ path, level, msg, fix });
  const p = r.personal;
  if (!p.name) add('personal.name', 'error', 'Add your name.');
  if (!p.email) add('personal.name', 'warn', 'Add an email so recruiters can reach you.', 'Fill it in under Sections → Contact.');
  if (p.email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(p.email)) add('personal.email', 'error', 'This email doesn’t look valid.');

  r.sections.forEach((s, si) => {
    if (!s.visible) return;
    if (s.kind === 'text' && s.text) {
      if (/\b(I|my|me)\b/.test(s.text) && s.type === 'profile') add(`sections.${si}.text`, 'info', 'Resumes usually drop “I” and “my”.', 'Start with what you are: “Backend developer who…”.');
      const words = s.text.trim().split(/\s+/).length;
      if (words > 85) add(`sections.${si}.text`, 'warn', `Profile is ${words} words. Recruiters skim; aim for 40–70.`);
    }
    if (s.kind !== 'entries') return;
    s.items.forEach((it, ii) => {
      const firstVerbs = {};
      it.bullets.forEach((b, bi) => {
        const path = `sections.${si}.items.${ii}.bullets.${bi}.text`;
        const t = b.text.trim();
        if (!t) return;
        const first = (t.match(/^[A-Za-z]+/) || [''])[0].toLowerCase();
        if (WEAK.includes(first)) add(path, 'warn', `“${t.split(/\s/)[0]}” is a weak opener.`, `Lead with what you did: ${STRONG}.`);
        if (/responsible for/i.test(t)) add(path, 'warn', '“Responsible for” describes a duty, not a result.', 'Say what changed because of you.');
        if (/\b(I|my)\b/.test(t)) add(path, 'info', 'Drop “I” and “my” in bullets.');
        if (['experience', 'projects'].includes(s.type) && !/\d/.test(t)) add(path, 'info', 'No number here.', 'Add scale or impact: users, %, ms, ₹, hours saved, team size.');
        if (first && firstVerbs[first] !== undefined) add(path, 'info', `Two bullets start with “${first}”. Vary the verb.`);
        firstVerbs[first] = bi;
        if (/\s{2,}|\s[,.]/.test(t)) add(path, 'info', 'Stray spaces before punctuation.');
      });
    });
  });

  // Layout checks that need the rendered page: orphan words and 3+ line bullets.
  if (sheet) {
    const range = document.createRange();
    sheet.querySelectorAll('.r-btext, .r-p').forEach((el) => {
      const path = el.dataset.path;
      if (!path || !el.textContent.trim()) return;
      range.selectNodeContents(el);
      const rects = [...range.getClientRects()].filter((x) => x.width > 1);
      const lines = [];
      for (const rc of rects) {
        const l = lines.find((x) => Math.abs(x.top - rc.top) < 3);
        if (l) { l.left = Math.min(l.left, rc.left); l.right = Math.max(l.right, rc.right); }
        else lines.push({ top: rc.top, left: rc.left, right: rc.right });
      }
      if (lines.length > 1) {
        const full = Math.max(...lines.map((l) => l.right - l.left));
        const last = lines[lines.length - 1];
        if ((last.right - last.left) / full < 0.14) add(path, 'info', 'A word or two dangles on the last line.', 'Trim a few words to save a whole line.');
      }
      if (el.classList.contains('r-btext') && lines.length > 2) add(path, 'warn', `This bullet runs ${lines.length} lines.`, 'Keep bullets to two lines.');
    });
  }
  return notes;
}

// ---------------- Job description match ----------------
const WORDS = `python java javascript typescript kotlin swift golang rust c++ c# php ruby scala sql nosql bash
html css sass tailwind react angular vue svelte next.js node.js express nestjs django flask fastapi .net asp.net laravel
android ios flutter mvvm firebase postgresql mysql mongodb redis sqlite oracle cassandra elasticsearch dynamodb
aws azure gcp docker kubernetes terraform ansible jenkins ci/cd linux nginx serverless lambda ec2 s3
git github gitlab jira agile scrum rest graphql grpc microservices api websocket oauth jwt
nlp tensorflow pytorch scikit-learn pandas numpy llm langchain excel tableau statistics dsa oop selenium jest pytest
cybersecurity networking tcp/ip siem soc owasp cryptography communication presentation leadership teamwork negotiation sales crm
salesforce zoho hubspot marketing seo kafka rabbitmq spark hadoop etl figma`.split(/\s+/);

const PHRASES = [
  'spring boot', 'react native', 'jetpack compose', 'google cloud', 'github actions', 'machine learning', 'deep learning', 'computer vision',
  'generative ai', 'prompt engineering', 'data analysis', 'power bi', 'data structures', 'algorithms', 'system design', 'design patterns', 'unit testing',
  'penetration testing', 'problem solving', 'stakeholder management', 'client handling', 'business development', 'lead generation', 'cold calling',
  'content writing', 'customer success', 'rest api', 'object oriented', 'version control', 'data visualization', 'cloud computing',
];
const VOCAB = [...new Set([...PHRASES, ...WORDS])];

const has = (hay, term) => {
  const e = term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`(^|[^a-z0-9+#])${e}($|[^a-z0-9+#])`, 'i').test(hay);
};

export function resumeText(r) {
  const out = [r.personal.title];
  r.sections.forEach((s) => {
    if (!s.visible) return;
    out.push(s.title);
    if (s.kind === 'text') out.push(s.text);
    if (s.kind === 'lines') s.rows.forEach((x) => out.push(x.label, x.value));
    if (s.kind === 'entries') s.items.forEach((it) => out.push(it.title, it.detail, it.subtitle, ...it.bullets.map((b) => b.text)));
  });
  return out.join('\n');
}

export function matchJD(jd, r) {
  const text = resumeText(r);
  const found = [], missing = [];
  for (const t of VOCAB) {
    if (!has(jd, t)) continue;
    (has(text, t) ? found : missing).push(t);
  }
  // Drop single words already covered by a found/missing phrase.
  const prune = (arr) => arr.filter((t) => !arr.some((o) => o !== t && o.includes(' ') && o.split(' ').includes(t)));
  const f = prune(found), m = prune(missing);
  const score = f.length + m.length ? Math.round((f.length / (f.length + m.length)) * 100) : 0;
  return { found: f, missing: m, score };
}
