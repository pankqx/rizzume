// Resume data model. Content is plain data, never markup, so nothing can "break".

export const uid = () => Math.random().toString(36).slice(2, 10);

export const SECTION_PRESETS = {
  profile: { kind: 'text', title: 'Profile' },
  skills: { kind: 'lines', title: 'Technical Skills' },
  experience: { kind: 'entries', layout: 'role', title: 'Experience' },
  projects: { kind: 'entries', layout: 'role', title: 'Featured Projects' },
  education: { kind: 'entries', layout: 'school', title: 'Education' },
  certifications: { kind: 'entries', layout: 'compact', title: 'Certifications & Workshops' },
  leadership: { kind: 'entries', layout: 'role', title: 'Leadership & Community', tight: true },
  achievements: { kind: 'entries', layout: 'compact', title: 'Achievements' },
  additional: { kind: 'lines', title: 'Additional' },
  custom: { kind: 'entries', layout: 'role', title: 'New Section' },
};

export const bullet = (text = '') => ({ id: uid(), text });

export function blankEntry(layout = 'role') {
  const e = { id: uid(), title: '', detail: '', right: '', subtitle: '', subRight: '', url: '', bullets: [] };
  if (layout === 'role') e.bullets = [bullet()];
  return e;
}

export function newSection(type) {
  const p = SECTION_PRESETS[type] || SECTION_PRESETS.custom;
  const s = { id: uid(), type, kind: p.kind, title: p.title, visible: true };
  if (p.kind === 'text') s.text = '';
  if (p.kind === 'lines') s.rows = [{ id: uid(), label: '', value: '' }];
  if (p.kind === 'entries') {
    s.layout = p.layout;
    s.tight = !!p.tight;
    s.items = [blankEntry(p.layout)];
  }
  return s;
}

export const defaultStyle = () => ({ autoFit: true, fontSize: 10, spacing: 1, accent: 'ink' });

export function blankResume(name = 'Untitled resume') {
  return {
    id: uid(),
    name,
    target: '',
    template: 'classic',
    style: defaultStyle(),
    createdAt: Date.now(),
    updatedAt: Date.now(),
    personal: { name: '', title: '', email: '', phone: '', linkedin: '', github: '', website: '', location: '' },
    sections: ['profile', 'skills', 'experience', 'projects', 'education', 'certifications'].map(newSection),
  };
}

// A fictional sample used for the landing page and "Start from a sample".
export function sampleResume() {
  const r = blankResume('Sample — Software Developer');
  r.target = 'Software Developer';
  r.personal = {
    name: 'PRISHA PANKAJ',
    title: 'Software Developer | Backend & Cloud',
    email: 'prisha.pankaj@email.com',
    phone: '+91 98450 12345',
    linkedin: 'prishapankaj',
    github: 'prishapankaj',
    website: '',
    location: '',
  };
  const S = (type, patch) => Object.assign(newSection(type), patch);
  const E = (o) => ({ ...blankEntry(), ...o, bullets: (o.bullets || []).map(bullet) });
  r.sections = [
    S('profile', {
      text:
        'Backend-leaning developer who enjoys turning messy requirements into small, dependable services. Comfortable across Python, Node.js and PostgreSQL, with hands-on experience shipping containerised APIs to the cloud. I care about readable code, honest estimates and documentation that the next person can actually use.',
    }),
    S('skills', {
      rows: [
        { id: uid(), label: 'Languages', value: 'Python, JavaScript, TypeScript, Java, SQL' },
        { id: uid(), label: 'Frameworks', value: 'FastAPI, Express, React, Spring Boot' },
        { id: uid(), label: 'Data & Cloud', value: 'PostgreSQL, Redis, MongoDB, Docker, AWS (EC2, S3, Lambda), GitHub Actions' },
        { id: uid(), label: 'Practices', value: 'REST API design, unit testing, code review, Agile sprints' },
      ],
    }),
    S('experience', {
      items: [
        E({
          title: 'Software Engineer Intern — Kestrel Labs',
          right: 'Jan 2026 – Jun 2026',
          bullets: [
            'Built 14 REST endpoints in FastAPI for an inventory service, cutting average response time from 420 ms to 95 ms with Redis caching.',
            'Wrote integration tests that raised coverage from 38% to 81% and caught two billing bugs before release.',
          ],
        }),
        E({
          title: 'Freelance Web Developer — Local Businesses',
          right: '2024 – 2025',
          bullets: [
            'Designed and shipped booking sites for three clinics, handling 1,200+ appointments in the first quarter.',
            'Set up automated backups and uptime alerts, so owners stopped losing data to failed hosting.',
          ],
        }),
      ],
    }),
    S('projects', {
      items: [
        E({
          title: 'Ledgerly — Personal Finance Tracker',
          right: 'Code',
          url: 'https://github.com/prishapankaj',
          bullets: [
            'Full-stack app in React and Express with PostgreSQL, featuring CSV import, budgets and monthly reports.',
            'Deployed with Docker on AWS EC2 behind Nginx; CI pipeline runs tests and lint on every pull request.',
          ],
        }),
        E({
          title: 'Railwatch — Train Delay Notifier',
          right: 'Code',
          url: 'https://github.com/prishapankaj',
          bullets: ['Serverless Python bot on AWS Lambda that alerts 300+ daily commuters on Telegram when their train runs late.'],
        }),
      ],
    }),
    S('education', {
      items: [
        E({ title: 'National Institute of Technology, Surathkal', right: '2022 – 2026', subtitle: 'B.Tech in Computer Science and Engineering', subRight: 'CGPA: 8.4' }),
      ],
    }),
    S('certifications', {
      items: [
        E({ title: 'AWS Certified Cloud Practitioner', detail: 'Amazon Web Services', right: '2025' }),
        E({ title: 'Data Structures and Algorithms', detail: 'NPTEL', right: '2024' }),
      ],
    }),
    S('additional', {
      rows: [
        { id: uid(), label: 'Interests', value: 'Open source · Badminton · Kannada theatre · Travel photography' },
      ],
    }),
  ];
  return r;
}

export function cloneResume(r, patch = {}) {
  const c = JSON.parse(JSON.stringify(r));
  c.id = uid();
  c.createdAt = c.updatedAt = Date.now();
  return Object.assign(c, patch);
}

// Validate/upgrade anything imported from JSON.
export function normalize(raw) {
  const base = blankResume();
  const r = Object.assign(base, raw || {});
  r.id = r.id || uid();
  r.style = Object.assign(defaultStyle(), r.style || {});
  r.personal = Object.assign(blankResume().personal, r.personal || {});
  r.sections = (r.sections || []).map((s) => {
    s.id = s.id || uid();
    if (s.visible === undefined) s.visible = true;
    if (s.kind === 'lines') s.rows = (s.rows || []).map((x) => ({ id: x.id || uid(), label: x.label || '', value: x.value || '' }));
    if (s.kind === 'entries')
      s.items = (s.items || []).map((e) => ({
        ...blankEntry('compact'),
        ...e,
        id: e.id || uid(),
        bullets: (e.bullets || []).map((b) => (typeof b === 'string' ? bullet(b) : { id: b.id || uid(), text: b.text || '' })),
      }));
    if (s.kind === 'text') s.text = s.text || '';
    return s;
  });
  return r;
}

// Path helpers: paths are arrays like ['sections', 2, 'items', 0, 'bullets', 1, 'text']
export function getAt(obj, path) {
  return path.reduce((o, k) => (o == null ? o : o[k]), obj);
}
export function setAt(obj, path, value) {
  const last = path[path.length - 1];
  const parent = getAt(obj, path.slice(0, -1));
  if (parent) parent[last] = value;
}
