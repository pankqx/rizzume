// Import an old resume: pick or drop a file, watch it being read, review what was found, open it.
import { extractLines } from './extract.js';
import { parseResume } from './parse.js';
import * as store from '../store.js';
import { sheetEl } from '../render.js';
import { fit } from '../fit.js';
import { ui } from '../icons.js';
import { h, esc, pickFile, toast } from '../ui.js';

export const IMPORT_ACCEPT = '.pdf,.docx,.txt,.tex,.md,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain';
const wait = (ms) => new Promise((r) => setTimeout(r, matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : ms));

export function openImport(file) {
  const scrim = h(`<div class="scrim imp-scrim"><div class="modal imp" role="dialog" aria-modal="true" aria-labelledby="imp-h">
    <button class="icon-btn imp-x" aria-label="Close">${ui('close')}</button>
    <div class="imp-left">
      <h2 id="imp-h">Bring your old resume</h2>
      <p class="imp-sub">PDF, Word (.docx), LaTeX or plain text. It’s read right here in your browser and never uploaded.</p>
      <label class="drop" tabindex="0">
        <input type="file" accept="${IMPORT_ACCEPT}" hidden>
        <span class="drop-ico">${ui('upload', 26)}</span>
        <b>Drop your file here</b>
        <span>or click to choose one</span>
      </label>
      <ol class="imp-steps" hidden></ol>
      <div class="imp-actions" hidden>
        <button class="btn ghost" data-again>Try another file</button>
        <button class="btn primary" data-open>Open in editor</button>
      </div>
    </div>
    <div class="imp-right"><div class="imp-paper"><div class="imp-ghost">${'<i></i>'.repeat(14)}</div></div></div>
  </div></div>`);
  document.body.appendChild(scrim);
  const m = scrim.firstElementChild;
  const drop = m.querySelector('.drop'), input = drop.querySelector('input');
  const steps = m.querySelector('.imp-steps'), actions = m.querySelector('.imp-actions');
  const paper = m.querySelector('.imp-paper');
  let result = null;

  const close = () => { scrim.classList.add('closing'); setTimeout(() => scrim.remove(), 180); document.removeEventListener('keydown', onKey); };
  const onKey = (e) => { if (e.key === 'Escape') close(); };
  document.addEventListener('keydown', onKey);
  scrim.addEventListener('pointerdown', (e) => { if (e.target === scrim) close(); });
  m.querySelector('.imp-x').onclick = close;
  drop.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); input.click(); } });
  input.onchange = () => input.files[0] && run(input.files[0]);
  ['dragenter', 'dragover'].forEach((ev) => m.addEventListener(ev, (e) => { e.preventDefault(); drop.classList.add('over'); }));
  ['dragleave', 'drop'].forEach((ev) => m.addEventListener(ev, (e) => { e.preventDefault(); if (ev === 'dragleave' && m.contains(e.relatedTarget)) return; drop.classList.remove('over'); }));
  m.addEventListener('drop', (e) => { const f = e.dataTransfer.files[0]; if (f) run(f); });
  m.querySelector('[data-again]').onclick = () => { reset(); input.value = ''; input.click(); };
  m.querySelector('[data-open]').onclick = () => {
    if (!result) return;
    store.put(result.resume);
    close();
    location.hash = `#/edit/${result.resume.id}`;
    toast('Imported. Check each section, then download.');
  };

  function reset() {
    result = null;
    drop.hidden = false;
    steps.hidden = true;
    steps.innerHTML = '';
    actions.hidden = true;
    paper.classList.remove('ready', 'reading');
    paper.querySelector('.sheet')?.remove();
  }
  function step(html, state = 'run') {
    const li = h(`<li class="${state}"><span class="tick">${state === 'done' ? ui('check', 14) : state === 'warn' ? '!' : ''}</span><span>${html}</span></li>`);
    steps.appendChild(li);
    return {
      done(text) { li.className = 'done'; li.querySelector('.tick').innerHTML = ui('check', 14); if (text) li.lastChild.innerHTML = text; },
      fail(text) { li.className = 'warn'; li.querySelector('.tick').textContent = '!'; li.lastChild.innerHTML = text; },
    };
  }

  async function run(f) {
    reset();
    drop.hidden = true;
    steps.hidden = false;
    paper.classList.add('reading');
    const s1 = step(`Reading <b>${esc(f.name)}</b>…`);
    let lines;
    try {
      [lines] = await Promise.all([extractLines(f), wait(500)]);
    } catch (err) {
      console.error(err);
      s1.fail(esc(err.message?.includes('.doc') ? err.message : 'That file couldn’t be read. Try a PDF or .docx export of it.'));
      actions.hidden = false;
      m.querySelector('[data-open]').hidden = true;
      paper.classList.remove('reading');
      return;
    }
    if (lines.length < 3) {
      s1.fail('No text found. If it’s a scanned image, export it again as a text PDF or Word file.');
      actions.hidden = false;
      m.querySelector('[data-open]').hidden = true;
      paper.classList.remove('reading');
      return;
    }
    s1.done(`Read <b>${lines.length}</b> lines from ${esc(f.name)}`);
    const { resume, report } = parseResume(lines, f.name);
    result = { resume, report };
    const p = resume.personal;
    await wait(260);
    const s2 = step('Looking for your name…');
    await wait(320);
    p.name ? s2.done(`Name: <b>${esc(p.name)}</b>`) : s2.fail('Couldn’t spot your name. You can type it on the page.');
    await wait(200);
    const labels = { email: 'email', phone: 'phone', linkedin: 'LinkedIn', github: 'GitHub', website: 'website' };
    const s3 = step('Finding contact details…');
    await wait(300);
    report.contacts.length ? s3.done(`Contact: ${report.contacts.map((k) => labels[k]).join(', ')}`) : s3.fail('No contact details found.');
    for (const s of report.sections) {
      await wait(170);
      const what = s.kind === 'text' ? 'paragraph' : s.kind === 'lines' ? `${s.count} line${s.count > 1 ? 's' : ''}` : `${s.count} entr${s.count > 1 ? 'ies' : 'y'}${s.bullets ? `, ${s.bullets} bullet${s.bullets > 1 ? 's' : ''}` : ''}`;
      step(`<b>${esc(s.title)}</b> · ${what}`, 'done');
    }
    if (report.unsorted) { await wait(170); step(`${report.unsorted} line${report.unsorted > 1 ? 's' : ''} didn’t fit a section. They’re kept in a hidden “Unsorted from import” section.`, 'warn'); }
    await wait(260);
    // Typeset preview
    const sh = sheetEl(resume);
    paper.appendChild(sh);
    fit(sh, resume);
    sh.style.zoom = paper.clientWidth / 793.7;
    paper.classList.remove('reading');
    paper.classList.add('ready');
    actions.hidden = false;
    m.querySelector('[data-open]').hidden = false;
    m.querySelector('[data-open]').focus();
  }

  if (file) run(file);
  else setTimeout(() => drop.focus(), 60);
  return close;
}

export async function chooseAndImport() {
  const f = await pickFile(IMPORT_ACCEPT);
  if (f) openImport(f);
}
