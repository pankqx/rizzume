import { sampleResume, cloneResume, bullet } from '../model.js';
import { sheetEl } from '../render.js';
import { fit } from '../fit.js';
import * as store from '../store.js';
import { ui } from '../icons.js';
import { mountMorph, morphHTML } from './morph.js';
import { openImport } from '../importer/ui.js';
import { mountBow, bowHTML } from './bow.js';
import { countVisit, getDownloads, odometer } from '../counter.js';

export function openSample() {
  const r = cloneResume(sampleResume(), { name: 'Sample — Software Developer' });
  store.put(r);
  location.hash = `#/edit/${r.id}`;
}

export function renderLanding(app) {
  const hasResumes = store.list().length > 0;
  app.innerHTML = `
  <div class="landing">
    <nav class="nav">
      <a class="wordmark" href="#/" aria-label="Rizzume home">Rizz<i>ume</i></a>
      <div class="nav-actions">
        ${hasResumes ? `<a class="btn ghost" href="#/resumes">Your resumes</a>` : ''}
        <a class="btn primary" href="#/resumes" data-start>Start building</a>
      </div>
    </nav>

    <header class="hero">
      <div>
        <h1 class="h1-reveal"><span><i>Resumes</i></span> <span><i>with rizz.</i></span></h1>
        <p class="lede fade-in" style="--d:.55s">Write straight onto the page. Rizzume sets it in the same type as LaTeX, keeps it to one tidy page, and hands you a real PDF. No account, no upload, works offline.</p>
        <div class="hero-cta fade-in" style="--d:.7s">
          <a class="btn primary lg" href="#/resumes" data-start>Start building</a>
          <button class="btn lg" data-import>${ui('upload', 18)} Import my old resume</button>
        </div>
        <p class="hero-note fade-in" style="--d:.85s">Free and open source. Your resumes never leave this browser. <button class="linkish" data-sample>Or open the sample</button></p>
      </div>
      <div class="hero-stage" aria-hidden="true"><div class="stage-sheet" id="stage"></div></div>
    </header>

    ${morphHTML}

    <section class="band">
      <h2>From blank page to PDF in three moves.</h2>
      <p>No forms to fill in, no preview to squint at. The page you edit is the page you send.</p>
      <div class="steps">
        <div class="step"><b>1</b><h3>Write on the page</h3><p>Click any line and type. Enter adds a bullet; Backspace on an empty one removes it.</p></div>
        <div class="step"><b>2</b><h3>Tailor a copy per job</h3><p>Duplicate your base resume, paste the job post, and see which of its skills you haven't mentioned yet.</p></div>
        <div class="step"><b>3</b><h3>Download</h3><p>A vector PDF with selectable text that applicant tracking systems can read. Or take the .tex to Overleaf.</p></div>
      </div>
    </section>

    <section class="band fitdemo">
      <div class="fitdemo-stage"><div class="fitdemo-sheet" id="fitdemo"></div><div class="fit-bubble" id="fitbubble" hidden aria-live="polite"><pre class="face"></pre><span class="line"></span></div></div>
      <div>
        <h2>One page. Every time.</h2>
        <p style="color:var(--ink-2);font-size:17px;max-width:32em;margin:0">Add a line and everything tightens a hair. Remove one and it breathes out. Rizzume tunes type size and spacing so the page is always full and never spills onto a second.</p>
        <div class="fitdemo-controls">
          <button class="btn" data-add>${ui('plus', 16)} Add a bullet</button>
          <button class="btn" data-remove>${ui('trash', 16)} Remove one</button>
        </div>
        <div class="meter" id="fitmeter"><span>Page</span><span class="meter-bar"><i></i></span><span class="pct">100%</span></div>
      </div>
    </section>

    ${bowHTML}

    <section class="band">
      <h2>Small things that make it feel finished.</h2>
      <div class="features" style="margin-top:36px">
        <div class="feature"><h3>${ui('pen')}Proof marks</h3><p>Weak verbs, missing numbers and one-word last lines get circled in the margin, the way an editor would.</p></div>
        <div class="feature"><h3>${ui('search')}Job match</h3><p>Paste a job post to see which of its skills your resume already mentions, and add the missing ones in a click.</p></div>
        <div class="feature"><h3>${ui('copy')}A copy per role</h3><p>Keep one base resume and a tailored copy for every application, all in one place.</p></div>
        <div class="feature"><h3>${ui('file')}LaTeX export</h3><p>Download a .tex file in the same structure as a hand-written LaTeX resume. Compiles on Overleaf as-is.</p></div>
        <div class="feature"><h3>${ui('download')}Works offline</h3><p>Install it from the browser and it runs without internet. Fonts and all.</p></div>
        <div class="feature"><h3>${ui('user')}Private by design</h3><p>Everything is saved in this browser. Nothing is uploaded. Back up to a file whenever you like.</p></div>
      </div>
    </section>

    <section class="band closing">
      <h2>Your next resume is ten minutes away.</h2>
      <div class="hero-cta" style="margin-top:28px"><a class="btn primary lg" href="#/resumes" data-start>Start building</a></div>
    </section>

    <footer class="footer">
      <span>Rizzume. Made by K S Pankaj.</span>
      <span class="stats" hidden><span class="stat"><b class="odo" data-odo="visits"></b> visits</span><span class="stat"><b class="odo" data-odo="pdfs"></b> resumes downloaded</span></span>
      <span><a href="https://github.com/pankqx/rizzume" target="_blank" rel="noopener">Source on GitHub</a></span>
    </footer>
  </div>`;

  app.querySelectorAll('[data-sample]').forEach((b) => (b.onclick = openSample));
  app.querySelectorAll('[data-import]').forEach((b) => (b.onclick = () => openImport()));

  // ---- Hero: the page sets itself, then an editor's mark fixes a weak verb ----
  const demo = sampleResume();
  const exp = demo.sections.find((s) => s.type === 'experience');
  exp.items[0].bullets[0].text = exp.items[0].bullets[0].text.replace(/^Built/, 'Worked on');
  const stage = app.querySelector('#stage');
  const heroScale = Math.min(0.5, (stage.parentElement.clientWidth - 8) / 793.7);
  stage.style.setProperty('--s', heroScale);
  const sheet = sheetEl(demo);
  stage.appendChild(sheet);
  fit(sheet, demo);
  const blocks = sheet.querySelectorAll('.r-head, .r-sec');
  blocks.forEach((b, i) => (b.style.animationDelay = `${250 + i * 140}ms`));
  requestAnimationFrame(() => stage.classList.add('run'));
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const timers = [];
  timers.push(
    setTimeout(() => {
      const target = sheet.querySelector('.r-k-entries .r-btext');
      if (!target) return;
      const node = target.firstChild;
      const range = document.createRange();
      range.setStart(node, 0);
      range.setEnd(node, 'Worked on'.length);
      const r = range.getBoundingClientRect(), s = stage.getBoundingClientRect();
      const x = r.left - s.left - 6, y = r.top - s.top - 4, w = r.width + 12, hh = r.height + 8;
      const mark = document.createElement('div');
      mark.className = 'proof-demo';
      mark.style.cssText = `left:${x}px;top:${y}px;width:${w}px;height:${hh}px`;
      mark.style.setProperty('--x', 0);
      mark.innerHTML = `<svg width="${w}" height="${hh}"><path d="M${w * 0.52},${1} C${w * 1.08},${-1} ${w * 1.05},${hh + 2} ${w * 0.5},${hh} C${-w * 0.06},${hh - 1} ${-w * 0.04},${0} ${w * 0.62},${3}"/></svg><span class="proof-tag" style="left:-34px;top:-4px">Built</span>`;
      stage.appendChild(mark);
      requestAnimationFrame(() => mark.classList.add('on'));
      timers.push(
        setTimeout(() => {
          node.nodeValue = node.nodeValue.replace(/^Worked on/, 'Built');
          mark.style.transition = 'opacity .4s';
          mark.style.opacity = '0';
          setTimeout(() => mark.remove(), 450);
        }, reduce ? 400 : 2200)
      );
    }, reduce ? 50 : 250 + blocks.length * 140 + 900)
  );

  // ---- Fit demo ----
  const fd = sampleResume();
  const fdHost = app.querySelector('#fitdemo');
  fdHost.style.setProperty('--s', Math.min(0.4, (fdHost.parentElement.clientWidth - 32) / 793.7));
  const fdSheet = sheetEl(fd);
  fdHost.appendChild(fdSheet);
  const meter = app.querySelector('#fitmeter');
  const proj = fd.sections.find((s) => s.type === 'projects');
  const extra = [
    'Added offline caching with a service worker so the app loads in under a second on slow networks.',
    'Wrote a migration script that moved 40,000 rows from MySQL to PostgreSQL with zero downtime.',
    'Mentored two juniors through their first pull requests and code reviews.',
    'Cut the Docker image from 1.2 GB to 180 MB with multi-stage builds.',
    'Documented the API with OpenAPI so the mobile team could integrate without meetings.',
  ];
  let added = 0;
  let shown = 0;
  const pct = meter.querySelector('.pct');
  // Count the percentage up/down instead of jumping.
  const tweenPct = (to, fs) => {
    const from = shown;
    const t0 = performance.now();
    const step = (t) => {
      const k = Math.min(1, (t - t0) / 450);
      shown = from + (to - from) * (1 - Math.pow(1 - k, 3));
      pct.textContent = `${Math.round(shown)}% full · ${fs.toFixed(1)} pt`;
      if (k < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  };
  const refit = () => {
    const res = fit(fdSheet, fd);
    meter.querySelector('i').style.width = Math.min(100, res.fill * 100) + '%';
    tweenPct(Math.min(100, res.fill * 100), res.fs);
    return res;
  };
  const repaint = () => {
    const fresh = sheetEl(fd);
    fdSheet.replaceChildren(...fresh.childNodes);
    return refit();
  };
  const pulse = (cls) => { fdHost.classList.remove('squeeze', 'breathe', 'shake'); void fdHost.offsetWidth; fdHost.classList.add(cls); };
  refit();

  // When the page is truly full, the page talks back in ASCII instead of spilling onto a second sheet.
  const bubble = app.querySelector('#fitbubble');
  const FULL = [
    ['(╯°□°)╯︵ ┻━┻', 'no room left. trim, don’t cram.'],
    ['¯\\_(ツ)_/¯', 'one page is one page.'],
    ['[■■■■■■■■■■] 100%', 'recruiters skim. keep it tight.'],
    ['(•_•)  ( •_•)>⌐■-■  (⌐■_■)', 'cool resumes fit on one page.'],
    ['ʕ•ᴥ•ʔ', 'even the bear says: cut a bullet.'],
  ];
  let fullI = 0, typing = 0;
  const say = ([face, line]) => {
    clearInterval(typing);
    bubble.hidden = false;
    bubble.classList.remove('pop'); void bubble.offsetWidth; bubble.classList.add('pop');
    const faceEl = bubble.querySelector('.face'), lineEl = bubble.querySelector('.line');
    faceEl.textContent = face;
    lineEl.textContent = '';
    let i = 0;
    typing = setInterval(() => { lineEl.textContent = line.slice(0, ++i); if (i >= line.length) clearInterval(typing); }, 28);
    clearTimeout(say.t);
    say.t = setTimeout(() => (bubble.hidden = true), 4200);
  };
  const addBtn = app.querySelector('[data-add]');
  addBtn.onclick = () => {
    const item = proj.items[added % proj.items.length];
    const b = bullet(extra[added % extra.length]);
    item.bullets.push(b);
    const res = repaint();
    if (res.overflow) {
      item.bullets.pop();
      repaint();
      pulse('shake');
      say(FULL[fullI++ % FULL.length]);
      return;
    }
    added++;
    pulse('squeeze');
    // highlight the line that just arrived
    const items = [...fdSheet.querySelectorAll('.r-ul li')];
    const li = items.find((x) => x.textContent.includes(b.text.slice(0, 30)));
    li?.classList.add('just-added');
  };
  app.querySelector('[data-remove]').onclick = () => {
    for (const s of fd.sections) if (s.kind === 'entries') for (const it of [...s.items].reverse()) if (it.bullets.length > 1) { it.bullets.pop(); added = Math.max(0, added - 1); bubble.hidden = true; repaint(); pulse('breathe'); return; }
    say(['(._.)', 'nothing left to cut here.']);
  };

  mountBow(app.querySelector('#bow'));

  // Visit / download counters roll in when the footer comes into view.
  const stats = app.querySelector('.stats');
  Promise.all([countVisit(), getDownloads()]).then(([v, d]) => {
    if (v == null) return;
    stats.hidden = false;
    const io = new IntersectionObserver((es) => {
      if (!es.some((e) => e.isIntersecting)) return;
      io.disconnect();
      odometer(stats.querySelector('[data-odo="visits"]'), v);
      odometer(stats.querySelector('[data-odo="pdfs"]'), d);
    });
    io.observe(stats);
  });

  const unmorph = mountMorph(app.querySelector('.morph'));
  return () => { timers.forEach(clearTimeout); unmorph(); };
}
