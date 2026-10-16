import * as store from '../store.js';
import { blankResume, sampleResume, cloneResume, normalize } from '../model.js';
import { sheetEl } from '../render.js';
import { fit } from '../fit.js';
import { ui } from '../icons.js';
import { h, esc, menu, modal, ask, toast, timeAgo, pickFile } from '../ui.js';
import { saveBlob } from '../pdf.js';

export async function importJsonFile() {
  const f = await pickFile('.json,application/json');
  if (!f) return null;
  try {
    const data = JSON.parse(await f.text());
    const list = Array.isArray(data) ? data : data.resumes ? data.resumes : [data];
    let last = null;
    for (const raw of list) {
      const r = normalize(raw);
      if (store.get(r.id)) r.id = cloneResume(r).id;
      store.put(r);
      last = r;
    }
    toast(list.length > 1 ? `Imported ${list.length} resumes` : `Imported “${last.name}”`);
    return last;
  } catch {
    toast('That file isn’t a Rizzume backup (.json).');
    return null;
  }
}

export function newResumeDialog() {
  modal(
    `<h2>New resume</h2><p>Start from scratch, from the sample, or from a backup file.</p>
    <div class="choice-grid">
      <button class="choice" data-c="blank">${ui('file', 22)}<div><b>Blank page</b><span>The usual sections, ready to fill in.</span></div></button>
      <button class="choice" data-c="sample">${ui('pen', 22)}<div><b>Start from the sample</b><span>A finished example to edit over.</span></div></button>
      <button class="choice" data-c="import">${ui('upload', 22)}<div><b>Import a backup</b><span>A .json file exported from Rizzume.</span></div></button>
    </div>`,
    {
      onMount(m, close) {
        m.querySelectorAll('[data-c]').forEach((b) =>
          (b.onclick = async () => {
            close();
            let r;
            if (b.dataset.c === 'blank') r = blankResume('Untitled resume');
            if (b.dataset.c === 'sample') r = cloneResume(sampleResume(), { name: 'Sample — Software Developer' });
            if (b.dataset.c === 'import') r = await importJsonFile();
            if (!r) return;
            store.put(r);
            location.hash = `#/edit/${r.id}`;
          })
        );
      },
    }
  );
}

export async function tailorCopy(r) {
  const v = await ask({
    title: 'Tailor a copy',
    text: 'Make a copy of this resume for a specific job. The original stays as it is.',
    fields: [
      { name: 'name', label: 'Name this copy', value: `${r.name.replace(/ — .*$/, '')} — ` , placeholder: 'e.g. Backend — Razorpay' },
      { name: 'target', label: 'Role you’re applying for', value: r.target, placeholder: 'e.g. Backend Developer Intern' },
    ],
    ok: 'Make copy',
  });
  if (!v) return null;
  const c = cloneResume(r, { name: v.name || r.name + ' (copy)', target: v.target });
  store.put(c);
  return c;
}

export function exportAll() {
  const data = { app: 'rizzume', version: 1, exportedAt: new Date().toISOString(), resumes: store.list() };
  saveBlob(JSON.stringify(data, null, 2), `rizzume-backup-${new Date().toISOString().slice(0, 10)}.json`, 'application/json');
}

export function renderLibrary(app) {
  const draw = () => {
    const list = store.list();
    app.innerHTML = `
    <nav class="nav">
      <a class="wordmark" href="#/" aria-label="Rizzume home">Rizz<i>ume</i></a>
      <div class="nav-actions">
        <button class="btn ghost" data-import>${ui('upload', 16)}<span class="hide-sm">Import</span></button>
        ${list.length ? `<button class="btn ghost" data-backup>${ui('download', 16)}<span class="hide-sm">Back up all</span></button>` : ''}
        <button class="btn primary" data-new>${ui('plus', 16)} New resume</button>
      </div>
    </nav>
    <main class="library">
      <div class="lib-head"><div><h1>Your resumes</h1><p>${list.length ? `${list.length} saved in this browser. Make a tailored copy for every role you apply to.` : 'Nothing here yet. Start with a blank page or the sample.'}</p></div></div>
      <div class="lib-grid" id="grid"><button class="card-new" data-new><span>${ui('plus', 26)}New resume</span></button></div>
    </main>`;
    const grid = app.querySelector('#grid');
    for (const r of list) {
      const card = h(`<div class="card">
        <a class="card-thumb" href="#/edit/${r.id}" aria-label="Open ${esc(r.name)}"></a>
        <div class="card-meta"><div><h3>${esc(r.name)}</h3><p>${r.target ? esc(r.target) + ' · ' : ''}Edited ${timeAgo(r.updatedAt)}</p></div>
        <button class="icon-btn" aria-label="More for ${esc(r.name)}">${ui('more')}</button></div></div>`);
      grid.appendChild(card);
      const thumb = card.querySelector('.card-thumb');
      const sh = sheetEl(r);
      thumb.appendChild(sh);
      fit(sh, r);
      const scale = () => (sh.style.transform = `scale(${thumb.clientWidth / 793.7})`);
      scale();
      new ResizeObserver(scale).observe(thumb);
      card.querySelector('.icon-btn').onclick = (e) =>
        menu(e.currentTarget, [
          { label: 'Open', icon: ui('pen', 16), onClick: () => (location.hash = `#/edit/${r.id}`) },
          { label: 'Tailor a copy…', icon: ui('copy', 16), onClick: async () => { const c = await tailorCopy(r); if (c) { toast(`Made “${c.name}”`); draw(); } } },
          { label: 'Rename…', icon: ui('design', 16), onClick: async () => { const v = await ask({ title: 'Rename', fields: [{ name: 'name', label: 'Name', value: r.name }] }); if (v?.name) { r.name = v.name; store.put(r); draw(); } } },
          { label: 'Download backup (.json)', icon: ui('download', 16), onClick: () => saveBlob(JSON.stringify(r, null, 2), `${r.name.replace(/[^\w]+/g, '_')}.json`, 'application/json') },
          'sep',
          {
            label: 'Delete',
            icon: ui('trash', 16),
            danger: true,
            onClick: () => {
              const snap = JSON.parse(JSON.stringify(r));
              store.remove(r.id);
              draw();
              toast(`Deleted “${r.name}”`, { action: 'Undo', onAction: () => { store.put(snap, { touch: false }); draw(); }, ms: 6000 });
            },
          },
        ], { align: 'right' });
    }
    app.querySelectorAll('[data-new]').forEach((b) => (b.onclick = newResumeDialog));
    app.querySelector('[data-import]').onclick = async () => { if (await importJsonFile()) draw(); };
    const bk = app.querySelector('[data-backup]');
    if (bk) bk.onclick = exportAll;
    if (!list.length && !draw.prompted) { draw.prompted = true; newResumeDialog(); }
  };
  draw();
}
