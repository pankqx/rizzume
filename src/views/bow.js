// A tiny toy: pull back a paper arrow, let go, and it unfolds into a resume on the target.
const NS = 'http://www.w3.org/2000/svg';
const REST = { x: 150, y: 200 };
const TARGET = { x: 760, y: 186, r: 78 };
const GROUND = 336;
const LEN = 170;

export const bowHTML = `
<section class="band bowband" aria-label="A small game">
  <div class="bow-copy">
    <h2>Aim. Release. Hired.</h2>
    <p>Pull the paper arrow back and let go. A good resume flies straight.</p>
    <p class="bow-status" aria-live="polite">&nbsp;</p>
    <button class="btn" data-again hidden>Shoot again</button>
  </div>
  <div class="bow-stage" id="bow" tabindex="0" role="application" aria-label="Bow and paper arrow. Drag the arrow back and release, or press Space to shoot.">
    <svg viewBox="0 0 900 380" preserveAspectRatio="xMidYMid meet">
      <defs>
        <filter id="pshadow" x="-30%" y="-30%" width="160%" height="160%"><feDropShadow dx="0" dy="3" stdDeviation="4" flood-opacity=".22"/></filter>
      </defs>
      <line class="ground" x1="20" y1="${GROUND}" x2="880" y2="${GROUND}"/>
      <g class="target">
        <line x1="${TARGET.x - 34}" y1="${GROUND}" x2="${TARGET.x - 6}" y2="${TARGET.y + 40}"/>
        <line x1="${TARGET.x + 34}" y1="${GROUND}" x2="${TARGET.x + 6}" y2="${TARGET.y + 40}"/>
        <circle cx="${TARGET.x}" cy="${TARGET.y}" r="${TARGET.r}" class="ring r1"/>
        <circle cx="${TARGET.x}" cy="${TARGET.y}" r="${TARGET.r * 0.72}" class="ring r2"/>
        <circle cx="${TARGET.x}" cy="${TARGET.y}" r="${TARGET.r * 0.44}" class="ring r3"/>
        <circle cx="${TARGET.x}" cy="${TARGET.y}" r="${TARGET.r * 0.18}" class="ring r4"/>
        <text x="${TARGET.x}" y="${TARGET.y + TARGET.r + 26}" text-anchor="middle" class="target-label">your next job</text>
      </g>
      <path class="bow" d="M 140 66 Q 232 200 140 334"/>
      <path class="string" d="M 140 66 L 140 200 L 140 334"/>
      <g class="arrow">
        <polygon class="fletch" points="-6,-2 -26,-16 -14,-2"/>
        <polygon class="fletch" points="-6,2 -26,16 -14,2"/>
        <rect class="shaft" x="-14" y="-5" width="${LEN - 10}" height="10" rx="1"/>
        <line class="fold" x1="-10" y1="0" x2="${LEN - 26}" y2="0"/>
        <polygon class="tip" points="${LEN - 26},-9 ${LEN},0 ${LEN - 26},9"/>
        <line class="fold" x1="${LEN - 26}" y1="-9" x2="${LEN - 26}" y2="9"/>
      </g>
      <text class="hint" x="${REST.x - 50}" y="${REST.y - 40}">← pull</text>
      <g class="page" opacity="0"></g>
      <g class="confetti"></g>
    </svg>
  </div>
</section>`;

export function mountBow(stage) {
  if (!stage) return;
  const svg = stage.querySelector('svg');
  const arrow = svg.querySelector('.arrow');
  const string = svg.querySelector('.string');
  const page = svg.querySelector('.page');
  const confetti = svg.querySelector('.confetti');
  const hint = svg.querySelector('.hint');
  const band = stage.closest('.bowband');
  const status = band.querySelector('.bow-status');
  const again = band.querySelector('[data-again]');
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  let state = 'idle'; // idle | drawing | flying | done
  let pull = 0, angle = 0, raf = 0;

  const toSvg = (e) => {
    const pt = svg.createSVGPoint();
    pt.x = e.clientX; pt.y = e.clientY;
    return pt.matrixTransform(svg.getScreenCTM().inverse());
  };
  const nock = () => ({ x: REST.x - pull * Math.cos(angle), y: REST.y - pull * Math.sin(angle) });
  function drawAt(x, y, a) {
    arrow.setAttribute('transform', `translate(${x} ${y}) rotate(${(a * 180) / Math.PI})`);
  }
  function drawString() {
    const n = nock();
    string.setAttribute('d', `M 140 66 L ${n.x - 10} ${n.y} L 140 334`);
  }
  function rest() {
    pull = 0; angle = 0;
    drawAt(REST.x - 10, REST.y, 0);
    drawString();
  }
  rest();

  function setStatus(t) { status.textContent = t; }

  // ---- drawing back
  stage.addEventListener('pointerdown', (e) => {
    if (state === 'flying') return;
    if (state === 'done') reset();
    state = 'drawing';
    stage.setPointerCapture(e.pointerId);
    hint.classList.add('gone');
    stage.classList.add('drawing');
    move(e);
  });
  stage.addEventListener('pointermove', (e) => { if (state === 'drawing') move(e); });
  function move(e) {
    const p = toSvg(e);
    const dx = REST.x - p.x, dy = REST.y - p.y;
    pull = Math.max(0, Math.min(120, Math.hypot(dx, dy) - 10));
    angle = Math.max(-0.75, Math.min(0.35, Math.atan2(dy, Math.max(dx, 1))));
    const n = nock();
    drawAt(n.x - 10, n.y, angle);
    drawString();
    stage.style.setProperty('--tension', (pull / 120).toFixed(2));
  }
  stage.addEventListener('pointerup', release);
  stage.addEventListener('pointercancel', () => { if (state === 'drawing') { state = 'idle'; rest(); stage.classList.remove('drawing'); } });
  stage.addEventListener('keydown', (e) => {
    if (e.key !== ' ' && e.key !== 'Enter') return;
    e.preventDefault();
    if (state === 'flying') return;
    if (state === 'done') reset();
    hint.classList.add('gone');
    pull = 96; angle = -0.2;
    state = 'drawing';
    release();
  });

  function release() {
    if (state !== 'drawing') return;
    stage.classList.remove('drawing');
    if (pull < 8) { state = 'idle'; rest(); return; }
    state = 'flying';
    const speed = 5 + pull * 0.155;
    let vx = speed * Math.cos(angle), vy = speed * Math.sin(angle);
    let { x, y } = nock();
    x -= 10;
    // string snaps back
    pull = 0; drawString();
    let last = performance.now();
    const g = 0.17;
    const tick = (now) => {
      const dt = Math.min(2.5, (now - last) / 16.67);
      last = now;
      vy += g * dt;
      x += vx * dt; y += vy * dt;
      const a = Math.atan2(vy, vx);
      const tipX = x + LEN * Math.cos(a), tipY = y + LEN * Math.sin(a);
      drawAt(x, y, a);
      if (tipX >= TARGET.x - 4 && Math.abs(tipY - TARGET.y) <= TARGET.r) return hit(tipY - TARGET.y, a);
      if (tipY >= GROUND) return miss(tipX, a);
      if (tipX > 920 || tipY < -200) return miss(1000, a);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
  }

  function miss(x, a) {
    state = 'done';
    if (x > 900) setStatus('Flew right past. Too much fluff, not enough aim.');
    else if (x < TARGET.x - 260) setStatus('Fell short. Pull harder — recruiters are far away.');
    else setStatus('So close. Add a number to that last bullet and try again.');
    arrow.classList.add('stuck');
    again.hidden = false;
    void a;
  }

  function hit(dy, a) {
    state = 'done';
    const d = Math.abs(dy) / TARGET.r;
    const ring = d < 0.18 ? 0 : d < 0.44 ? 1 : d < 0.72 ? 2 : 3;
    setStatus(['Bullseye. Offer letter incoming.', 'Great shot. Shortlisted.', 'On target. Now tailor it for the next one.', 'Just made it. Tighten those bullets.'][ring]);
    stage.classList.add('thud');
    setTimeout(() => stage.classList.remove('thud'), 300);
    setTimeout(() => unfold(TARGET.x - 6, TARGET.y + dy * 0.6, a), reduce ? 0 : 260);
    again.hidden = false;
  }

  // The arrow opens up into a one-page resume, then gets stamped.
  function unfold(cx, cy, a) {
    arrow.setAttribute('opacity', '0');
    const W = 118, H = 160;
    page.innerHTML = `
      <g class="pg" filter="url(#pshadow)">
        <rect x="${-W / 2}" y="${-H / 2}" width="${W}" height="${H}" rx="2" class="sheetrect"/>
        <rect x="${-W / 2 + 12}" y="${-H / 2 + 14}" width="54" height="7" class="ink"/>
        <rect x="${-W / 2 + 12}" y="${-H / 2 + 25}" width="38" height="3" class="soft"/>
        ${[44, 74, 108].map((y, i) => `<rect x="${-W / 2 + 12}" y="${-H / 2 + y}" width="${i === 1 ? 30 : 36}" height="4" class="ink"/><line x1="${-W / 2 + 12}" y1="${-H / 2 + y + 7}" x2="${W / 2 - 12}" y2="${-H / 2 + y + 7}" class="rule"/>`).join('')}
        ${[54, 59, 64, 84, 89, 94, 99, 118, 123, 128, 140, 145].map((y, i) => `<line x1="${-W / 2 + 12}" y1="${-H / 2 + y}" x2="${W / 2 - 12 - ((i * 17) % 30)}" y2="${-H / 2 + y}" class="txt" style="--i:${i}"/>`).join('')}
      </g>
      <g class="stamp" transform="translate(${W / 2 - 22} ${H / 2 - 30})"><g class="stamp-in"><rect x="-38" y="-14" width="76" height="28" rx="3"/><text x="0" y="6" text-anchor="middle">HIRED</text></g></g>`;
    page.setAttribute('opacity', '1');
    const t0 = performance.now(), dur = reduce ? 1 : 620;
    const from = (a * 180) / Math.PI;
    const step = (now) => {
      const t = Math.min(1, (now - t0) / dur);
      const e = 1 - Math.pow(1 - t, 3);
      const sx = 1.45 - 0.45 * e, sy = 0.06 + 0.94 * e, rot = from + (-4 - from) * e;
      page.setAttribute('transform', `translate(${cx} ${cy}) rotate(${rot}) scale(${sx} ${sy})`);
      if (t < 1) requestAnimationFrame(step);
      else { page.classList.add('open'); burst(cx, cy); }
    };
    requestAnimationFrame(step);
  }

  function burst(cx, cy) {
    if (reduce) return;
    const colors = ['#e2531f', '#1c1b19', '#d9d3c7', '#ffe58a'];
    const bits = Array.from({ length: 22 }, (_, i) => {
      const r = document.createElementNS(NS, 'rect');
      r.setAttribute('width', 6); r.setAttribute('height', 9);
      r.setAttribute('fill', colors[i % colors.length]);
      confetti.appendChild(r);
      const ang = -Math.PI / 2 + (Math.random() - 0.5) * 2.6;
      return { r, x: cx, y: cy - 40, vx: Math.cos(ang) * (2 + Math.random() * 4), vy: Math.sin(ang) * (3 + Math.random() * 4), rot: Math.random() * 360, vr: (Math.random() - 0.5) * 20 };
    });
    let n = 0;
    const step = () => {
      n++;
      for (const b of bits) {
        b.vy += 0.18; b.x += b.vx; b.y += b.vy; b.rot += b.vr;
        b.r.setAttribute('transform', `translate(${b.x} ${b.y}) rotate(${b.rot})`);
        b.r.setAttribute('opacity', Math.max(0, 1 - n / 80));
      }
      if (n < 80) requestAnimationFrame(step); else confetti.innerHTML = '';
    };
    requestAnimationFrame(step);
  }

  function reset() {
    cancelAnimationFrame(raf);
    state = 'idle';
    page.setAttribute('opacity', '0');
    page.classList.remove('open');
    page.innerHTML = '';
    confetti.innerHTML = '';
    arrow.removeAttribute('opacity');
    arrow.classList.remove('stuck');
    again.hidden = true;
    setStatus(' ');
    rest();
  }
  again.onclick = () => { reset(); stage.focus({ preventScroll: true }); };
}
