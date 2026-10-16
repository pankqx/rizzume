import * as store from '../store.js';
import { SECTION_PRESETS, newSection, blankEntry, bullet, uid, setAt, getAt } from '../model.js';
import { paintSheet, sheetEl, TEMPLATES, ACCENTS } from '../render.js';
import { fit } from '../fit.js';
import { proofread, matchJD } from '../coach.js';
import { saveBlob, fileBase } from '../files.js';
const downloadPdf = (r) => import('../pdf.js').then((m) => m.downloadPdf(r));
import { toTex } from '../tex.js';
import { ui } from '../icons.js';
import { h, esc, menu, toast, ask } from '../ui.js';
import { tailorCopy, importJsonFile } from './library.js';
import { applyTheme } from '../main.js';

const PAGE_W = 793.7;
const parsePath = (p) => p.split('.').map((k) => (/^\d+$/.test(k) ? +k : k));

export function renderEditor(app, id) {
  let r = store.get(id);
  const hist = store.history(r);
  let tab = 'sections';
  let zoom = 'fit';
  let lastFit = null;
  let notes = [];
  let jdResult = null;
  const timers = {};
  const later = (k, fn, ms) => { clearTimeout(timers[k]); timers[k] = setTimeout(fn, ms); };

  app.innerHTML = `
  <div class="editor">
    <header class="topbar">
      <a class="icon-btn" href="#/resumes" aria-label="All resumes" title="All resumes">${ui('back')}</a>
      <a class="wordmark hide-sm" href="#/" aria-label="Rizzume home">Rizz<i>ume</i></a>
      <input class="doc-name" aria-label="Resume name" spellcheck="false">
      <span class="save-state hide-sm" aria-live="polite"></span>
      <div class="spacer"></div>
      <div class="tb-group">
        <button class="icon-btn" data-undo aria-label="Undo" title="Undo (Ctrl+Z)">${ui('undo')}</button>
        <button class="icon-btn" data-redo aria-label="Redo" title="Redo (Ctrl+Shift+Z)">${ui('redo')}</button>
      </div>
      <span class="sep hide-sm"></span>
      <button class="icon-btn hide-sm" data-theme aria-label="Switch theme" title="Light / dark"></button>
      <button class="icon-btn" data-more aria-label="More options" title="More">${ui('more')}</button>
      <button class="btn ember" data-download>${ui('download', 17)}<span class="hide-sm">Download</span></button>
    </header>
    <div class="workspace">
      <aside class="panel" aria-label="Resume settings">
        <div class="tabs" role="tablist">
          <button class="tab" role="tab" data-tab="sections">${ui('sections', 16)}Sections</button>
          <button class="tab" role="tab" data-tab="design">${ui('design', 16)}Design</button>
          <button class="tab" role="tab" data-tab="check">${ui('pen', 16)}Check<span class="count" hidden></span></button>
        </div>
        <div class="panel-body"></div>
      </aside>
      <div class="desk">
        <div class="desk-inner">
          <div class="page-wrap">
            <div class="marks"></div>
            <div class="gutter" role="toolbar" aria-label="Block tools"></div>
          </div>
        </div>
        <div class="status-pill">
          <div class="meter"><span class="meter-bar"><i></i></span><span class="pct"></span></div>
          <span class="sep"></span>
          <div class="zoom"><button class="icon-btn" data-zout aria-label="Zoom out">${ui('zoomOut', 16)}</button><span></span><button class="icon-btn" data-zin aria-label="Zoom in">${ui('zoomIn', 16)}</button></div>
        </div>
      </div>
    </div>
    <nav class="mobile-tabs">
      <button data-mtab="page" aria-selected="true">${ui('file')}Page</button>
      <button data-mtab="sections">${ui('sections')}Sections</button>
      <button data-mtab="design">${ui('design')}Design</button>
      <button data-mtab="check">${ui('pen')}Check</button>
    </nav>
  </div>`;

  const $ = (s) => app.querySelector(s);
  const wrap = $('.page-wrap'), desk = $('.desk'), panelBody = $('.panel-body'), gutter = $('.gutter'), marksEl = $('.marks');
  const sheet = sheetEl(r, { editable: true });
  wrap.prepend(sheet);
  const nameInput = $('.doc-name');
  nameInput.value = r.name;

  // ---------------- persistence & history ----------------
  const saveState = $('.save-state');
  function save() {
    saveState.innerHTML = 'Saving…';
    later('save', () => {
      const ok = store.put(r);
      saveState.innerHTML = ok ? `${ui('check', 15)}Saved` : 'Not saved — browser storage is full or blocked';
    }, 350);
  }
  function commit({ repaint = true, focus } = {}) {
    hist.push(r);
    syncUndo();
    save();
    if (repaint) paint(focus);
  }
  function syncUndo() {
    $('[data-undo]').disabled = !hist.canUndo;
    $('[data-redo]').disabled = !hist.canRedo;
  }
  function travel(dir) {
    const snap = dir < 0 ? hist.undo() : hist.redo();
    if (!snap) return;
    r = snap;
    store.put(r);
    nameInput.value = r.name;
    syncUndo();
    paint();
    drawPanel();
    saveState.innerHTML = `${ui('check', 15)}Saved`;
  }

  // ---------------- paint & fit ----------------
  function paint(focus) {
    const active = document.activeElement;
    const keep = !focus && active && sheet.contains(active) ? { path: active.dataset.path, caret: caretOffset(active) } : null;
    paintSheet(sheet, r, { editable: true });
    refit();
    const f = focus || keep;
    if (f) focusPath(f.path, f.caret);
    later('marks', updateMarks, 250);
  }
  function refit() {
    lastFit = fit(sheet, r);
    applyZoom();
    const m = $('.status-pill .meter');
    m.classList.toggle('over', lastFit.overflow);
    m.querySelector('i').style.width = Math.min(100, lastFit.fill * 100) + '%';
    m.querySelector('.pct').textContent = lastFit.overflow
      ? `Spills ${lastFit.extraLines} line${lastFit.extraLines > 1 ? 's' : ''} onto page ${lastFit.pages}`
      : `Page ${Math.round(lastFit.fill * 100)}% full`;
    if (tab === 'design') syncDesignReadouts();
  }
  function applyZoom() {
    const avail = desk.clientWidth - (innerWidth < 920 ? 32 : 144);
    const z = zoom === 'fit' ? Math.max(0.3, Math.min(1.15, avail / PAGE_W)) : zoom;
    sheet.style.transform = `scale(${z})`;
    wrap.style.width = PAGE_W * z + 'px';
    wrap.style.height = sheet.offsetHeight * z + 'px';
    wrap.dataset.zoom = z;
    $('.zoom span').textContent = Math.round(z * 100) + '%';
  }
  const curZoom = () => +wrap.dataset.zoom || 1;
  const ro = new ResizeObserver(() => { applyZoom(); later('marks', updateMarks, 100); });
  ro.observe(desk);
  $('[data-zin]').onclick = () => { zoom = Math.min(2, curZoom() + 0.1); applyZoom(); updateMarks(); };
  $('[data-zout]').onclick = () => { zoom = Math.max(0.3, curZoom() - 0.1); applyZoom(); updateMarks(); };
  $('.zoom span').ondblclick = () => { zoom = 'fit'; applyZoom(); updateMarks(); };

  // ---------------- caret helpers ----------------
  function caretOffset(el) {
    const s = getSelection();
    if (!s.rangeCount || !el.contains(s.anchorNode)) return null;
    const rg = s.getRangeAt(0).cloneRange();
    rg.selectNodeContents(el);
    rg.setEnd(s.anchorNode, s.anchorOffset);
    return rg.toString().length;
  }
  function setCaret(el, off) {
    const s = getSelection();
    const rg = document.createRange();
    const t = el.firstChild;
    if (!t) { rg.setStart(el, 0); }
    else { const n = off == null || off === 'end' ? t.length : Math.min(off, t.length); rg.setStart(t, n); }
    rg.collapse(true);
    s.removeAllRanges();
    s.addRange(rg);
  }
  function focusPath(path, caret = 'end', { flash = false, scroll = false } = {}) {
    if (!path) return;
    const el = sheet.querySelector(`[data-path="${path}"]`);
    if (!el) return;
    el.focus({ preventScroll: !scroll });
    setCaret(el, caret);
    if (scroll) el.scrollIntoView({ block: 'center', behavior: 'smooth' });
    if (flash) { el.classList.remove('flash'); void el.offsetWidth; el.classList.add('flash'); }
  }

  // ---------------- inline editing ----------------
  sheet.addEventListener('input', (e) => {
    const el = e.target.closest('[data-path]');
    if (!el) return;
    if (!el.textContent) el.innerHTML = '';
    setAt(r, parsePath(el.dataset.path), el.textContent.replace(/\n/g, ' '));
    save();
    later('hist', () => { hist.push(r); syncUndo(); }, 600);
    requestAnimationFrame(refit);
    later('marks', updateMarks, 500);
    if (jdResult) later('jd', () => { runJD(); }, 600);
  });

  sheet.addEventListener('keydown', (e) => {
    const el = e.target.closest('[data-path]');
    if (!el) return;
    const path = parsePath(el.dataset.path);
    const isBullet = path.includes('bullets');
    const off = caretOffset(el);
    const text = el.textContent;
    if (e.key === 'Enter') {
      e.preventDefault();
      if (isBullet) {
        const list = getAt(r, path.slice(0, -2));
        const bi = path[path.length - 2];
        list[bi].text = text.slice(0, off ?? text.length).trimEnd();
        list.splice(bi + 1, 0, bullet(text.slice(off ?? text.length).trimStart()));
        commit({ focus: { path: [...path.slice(0, -2), bi + 1, 'text'].join('.'), caret: 0 } });
      } else if (path[0] === 'sections' && path[2] === 'rows') {
        const rows = getAt(r, path.slice(0, 3));
        rows.splice(path[3] + 1, 0, { id: uid(), label: '', value: '' });
        commit({ focus: { path: `sections.${path[1]}.rows.${path[3] + 1}.label`, caret: 0 } });
      } else if (path[0] === 'sections' && path[2] === 'items' && path.length === 5) {
        const it = getAt(r, path.slice(0, 4));
        if (!it.bullets.length) it.bullets.push(bullet());
        commit({ focus: { path: `${path.slice(0, 4).join('.')}.bullets.0.text`, caret: 0 } });
      } else moveFocus(el, 1);
      return;
    }
    if (e.key === 'Backspace' && off === 0 && !getSelection().toString()) {
      if (isBullet) {
        const list = getAt(r, path.slice(0, -2));
        const bi = path[path.length - 2];
        if (bi > 0) {
          e.preventDefault();
          const prev = list[bi - 1];
          const at = prev.text.length;
          prev.text = prev.text + (text && prev.text ? ' ' : '') + text;
          list.splice(bi, 1);
          commit({ focus: { path: [...path.slice(0, -2), bi - 1, 'text'].join('.'), caret: at + (text && at ? 1 : 0) } });
        } else if (!text) {
          e.preventDefault();
          list.splice(bi, 1);
          commit({ focus: { path: `${path.slice(0, 4).join('.')}.title` } });
        }
        return;
      }
      if (path[2] === 'rows' && path[4] === 'label') {
        const row = getAt(r, path.slice(0, 4));
        const rows = getAt(r, path.slice(0, 3));
        if (!row.label && !row.value && rows.length > 1) {
          e.preventDefault();
          rows.splice(path[3], 1);
          commit({ focus: { path: `sections.${path[1]}.rows.${Math.max(0, path[3] - 1)}.value` } });
        }
      }
    }
    if ((e.key === 'ArrowDown' && off === text.length) || (e.key === 'ArrowUp' && off === 0)) {
      if (moveFocus(el, e.key === 'ArrowDown' ? 1 : -1)) e.preventDefault();
    }
  });
  function moveFocus(el, dir) {
    const all = [...sheet.querySelectorAll('[data-path]')];
    const next = all[all.indexOf(el) + dir];
    if (!next) return false;
    next.focus({ preventScroll: true });
    setCaret(next, dir > 0 ? 0 : 'end');
    return true;
  }
  sheet.addEventListener('paste', (e) => {
    const el = e.target.closest('[data-path]');
    if (!el) return;
    const txt = e.clipboardData.getData('text/plain');
    const path = parsePath(el.dataset.path);
    const lines = txt.split(/\r?\n/).map((l) => l.replace(/^\s*([•\-*–·]|\d+[.)])\s*/, '').trim()).filter(Boolean);
    if (path.includes('bullets') && lines.length > 1) {
      e.preventDefault();
      const list = getAt(r, path.slice(0, -2));
      const bi = path[path.length - 2];
      const off = caretOffset(el) ?? el.textContent.length;
      const cur = el.textContent;
      list[bi].text = (cur.slice(0, off) + lines[0]).trim();
      const rest = lines.slice(1).map((l) => bullet(l));
      if (cur.slice(off).trim()) rest[rest.length - 1].text += ' ' + cur.slice(off).trim();
      list.splice(bi + 1, 0, ...rest);
      commit({ focus: { path: [...path.slice(0, -2), bi + rest.length, 'text'].join('.') } });
      toast(`Pasted ${lines.length} bullets`);
    } else if (/\n/.test(txt)) {
      e.preventDefault();
      document.execCommand('insertText', false, txt.replace(/\s*\r?\n\s*/g, ' '));
    }
  });

  // ---------------- gutter (block tools) ----------------
  let gTarget = null;
  let gHideT = null;
  function showGutter(block) {
    clearTimeout(gHideT);
    if (block === gTarget) return;
    gTarget = block;
    const z = curZoom();
    const wr = wrap.getBoundingClientRect();
    const br = block.getBoundingClientRect();
    let html = '', label = '';
    if (block.classList.contains('r-entry')) {
      const [si, ii] = block.dataset.entry.split('.').map(Number);
      const s = r.sections[si];
      label = 'Entry';
      html = `${s.layout !== 'school' ? `<button class="icon-btn" data-g="addBullet" title="Add bullet" aria-label="Add bullet">${ui('plus', 16)}</button>` : ''}
        ${s.layout === 'role' || s.layout === 'compact' ? `<button class="icon-btn" data-g="link" title="Link (e.g. GitHub)" aria-label="Add link">${ui('link', 16)}</button>` : ''}
        <button class="icon-btn" data-g="dupItem" title="Duplicate" aria-label="Duplicate entry">${ui('copy', 16)}</button>
        <button class="icon-btn" data-g="upItem" title="Move up" aria-label="Move up" ${ii === 0 ? 'disabled' : ''}>${ui('up', 16)}</button>
        <button class="icon-btn" data-g="downItem" title="Move down" aria-label="Move down" ${ii === s.items.length - 1 ? 'disabled' : ''}>${ui('down', 16)}</button>
        <button class="icon-btn danger" data-g="delItem" title="Delete entry" aria-label="Delete entry">${ui('trash', 16)}</button>`;
      gutter.dataset.si = si; gutter.dataset.ii = ii;
    } else if (block.classList.contains('r-line')) {
      const si = +block.closest('.r-sec').dataset.sec, ri = +block.dataset.row;
      label = 'Line';
      html = `<button class="icon-btn" data-g="addRow" title="Add line" aria-label="Add line">${ui('plus', 16)}</button>
        <button class="icon-btn" data-g="upRow" title="Move up" aria-label="Move up" ${ri === 0 ? 'disabled' : ''}>${ui('up', 16)}</button>
        <button class="icon-btn" data-g="downRow" title="Move down" aria-label="Move down" ${ri === r.sections[si].rows.length - 1 ? 'disabled' : ''}>${ui('down', 16)}</button>
        <button class="icon-btn danger" data-g="delRow" title="Delete line" aria-label="Delete line">${ui('trash', 16)}</button>`;
      gutter.dataset.si = si; gutter.dataset.ri = ri;
    } else if (block.classList.contains('r-h')) {
      const si = +block.closest('.r-sec').dataset.sec;
      const s = r.sections[si];
      label = 'Section';
      html = `${s.kind !== 'text' ? `<button class="icon-btn" data-g="addItem" title="${s.kind === 'lines' ? 'Add line' : 'Add entry'}" aria-label="Add to section">${ui('plus', 16)}</button>` : ''}
        <button class="icon-btn" data-g="upSec" title="Move section up" aria-label="Move section up">${ui('up', 16)}</button>
        <button class="icon-btn" data-g="downSec" title="Move section down" aria-label="Move section down">${ui('down', 16)}</button>
        <button class="icon-btn" data-g="hideSec" title="Hide section" aria-label="Hide section">${ui('eyeOff', 16)}</button>`;
      gutter.dataset.si = si;
    } else return hideGutter(true);
    gutter.innerHTML = html + `<span class="gutter-label">${label}</span>`;
    gutter.style.top = br.top - wr.top - 6 * z + 'px';
    gutter.style.left = -46 + 'px';
    gutter.classList.add('show');
  }
  function hideGutter(now) {
    clearTimeout(gHideT);
    const go = () => { gutter.classList.remove('show'); gTarget = null; };
    if (now) go(); else gHideT = setTimeout(go, 350);
  }
  sheet.addEventListener('pointermove', (e) => {
    if (e.pointerType === 'touch') return;
    const blk = e.target.closest('.r-h') || e.target.closest('.r-line') || e.target.closest('.r-entry');
    if (blk) showGutter(blk);
    else if (!e.target.closest('.r-sec')) hideGutter();
  });
  wrap.addEventListener('pointerleave', () => hideGutter());
  gutter.addEventListener('pointerenter', () => clearTimeout(gHideT));
  gutter.addEventListener('click', (e) => {
    const b = e.target.closest('[data-g]');
    if (!b) return;
    const si = +gutter.dataset.si, ii = +gutter.dataset.ii, ri = +gutter.dataset.ri;
    const s = r.sections[si];
    const act = b.dataset.g;
    const swap = (arr, i, j) => { if (j < 0 || j >= arr.length) return false; [arr[i], arr[j]] = [arr[j], arr[i]]; return true; };
    let focus;
    switch (act) {
      case 'addBullet': s.items[ii].bullets.push(bullet()); s.items[ii].bulletsOnly = s.items[ii].bulletsOnly && true; focus = { path: `sections.${si}.items.${ii}.bullets.${s.items[ii].bullets.length - 1}.text` }; break;
      case 'link': return linkPopover(b, s.items[ii]);
      case 'dupItem': s.items.splice(ii + 1, 0, { ...JSON.parse(JSON.stringify(s.items[ii])), id: uid() }); s.items[ii + 1].bullets.forEach((x) => (x.id = uid())); focus = { path: `sections.${si}.items.${ii + 1}.title` }; break;
      case 'upItem': swap(s.items, ii, ii - 1); break;
      case 'downItem': swap(s.items, ii, ii + 1); break;
      case 'delItem': {
        const gone = s.items.splice(ii, 1)[0];
        commit();
        hideGutter(true);
        toast('Entry deleted', { action: 'Undo', onAction: () => { s.items.splice(ii, 0, gone); commit(); } });
        return;
      }
      case 'addRow': s.rows.splice(ri + 1, 0, { id: uid(), label: '', value: '' }); focus = { path: `sections.${si}.rows.${ri + 1}.label` }; break;
      case 'upRow': swap(s.rows, ri, ri - 1); break;
      case 'downRow': swap(s.rows, ri, ri + 1); break;
      case 'delRow': s.rows.splice(ri, 1); if (!s.rows.length) s.rows.push({ id: uid(), label: '', value: '' }); break;
      case 'addItem': focus = addItem(si); break;
      case 'upSec': swap(r.sections, si, si - 1); break;
      case 'downSec': swap(r.sections, si, si + 1); break;
      case 'hideSec': s.visible = false; toast(`“${s.title}” hidden`, { action: 'Show', onAction: () => { s.visible = true; commit(); drawPanel(); } }); break;
    }
    hideGutter(true);
    commit({ focus });
    if (tab === 'sections') drawPanel();
  });
  function addItem(si) {
    const s = r.sections[si];
    if (s.kind === 'lines') { s.rows.push({ id: uid(), label: '', value: '' }); return { path: `sections.${si}.rows.${s.rows.length - 1}.label` }; }
    if (s.kind === 'entries') {
      const e = blankEntry(s.layout);
      if (s.type === 'projects') e.right = 'Code';
      const firstBulletsOnly = s.items.findIndex((x) => x.bulletsOnly);
      if (firstBulletsOnly >= 0) s.items.splice(firstBulletsOnly, 0, e); else s.items.push(e);
      return { path: `sections.${si}.items.${s.items.indexOf(e)}.title` };
    }
    return { path: `sections.${si}.text` };
  }
  function linkPopover(anchor, item) {
    const pop = h(`<form class="link-pop"><input class="input" placeholder="https://github.com/you/project" value="${esc(item.url)}" aria-label="Link URL"><button class="btn sm primary">Save</button>${item.url ? `<button type="button" class="btn sm ghost" data-rm>Remove</button>` : ''}</form>`);
    const wr = wrap.getBoundingClientRect(), ar = anchor.getBoundingClientRect();
    pop.style.left = ar.right - wr.left + 8 + 'px';
    pop.style.top = ar.top - wr.top - 6 + 'px';
    wrap.appendChild(pop);
    const inp = pop.querySelector('input');
    inp.focus();
    inp.select();
    const close = () => { pop.remove(); document.removeEventListener('pointerdown', outside); };
    const outside = (e) => { if (!pop.contains(e.target)) close(); };
    setTimeout(() => document.addEventListener('pointerdown', outside));
    pop.onsubmit = (e) => {
      e.preventDefault();
      let v = inp.value.trim();
      if (v && !/^https?:\/\//.test(v) && !/^mailto:/.test(v)) v = 'https://' + v;
      item.url = v;
      if (v && !item.right) item.right = /github\.com/.test(v) ? 'Code' : 'Link';
      close();
      commit();
    };
    pop.querySelector('[data-rm]')?.addEventListener('click', () => { item.url = ''; close(); commit(); });
    inp.addEventListener('keydown', (e) => { if (e.key === 'Escape') close(); });
  }

  // ---------------- proof marks ----------------
  function updateMarks() {
    notes = proofread(r, sheet);
    const count = $('.tab .count');
    const real = notes.filter((n) => n.level !== 'info').length;
    count.hidden = !notes.length;
    count.textContent = notes.length;
    count.title = `${real} to fix, ${notes.length - real} suggestions`;
    marksEl.innerHTML = '';
    if (store.settings().marks !== false) {
      const wr = wrap.getBoundingClientRect();
      const byPath = new Map();
      notes.forEach((n, i) => { n.n = i + 1; if (!byPath.has(n.path)) byPath.set(n.path, []); byPath.get(n.path).push(n); });
      for (const [path, list] of byPath) {
        const el = sheet.querySelector(`[data-path="${path}"]`);
        if (!el) continue;
        const er = el.getClientRects()[0] || el.getBoundingClientRect();
        const lvl = list.some((n) => n.level === 'error') ? 'error' : list.some((n) => n.level === 'warn') ? 'warn' : 'info';
        const m = h(`<button class="pmark ${lvl}" aria-label="${esc(list.map((n) => n.msg).join(' '))}">${list[0].n}</button>`);
        m.style.left = wr.width + 14 + 'px';
        m.style.top = er.top - wr.top + 'px';
        m.onclick = (e) => { e.stopPropagation(); showTip(m, list, path); };
        marksEl.appendChild(m);
      }
    }
    if (tab === 'check') drawCheckIssues();
  }
  function showTip(m, list, path) {
    wrap.querySelector('.mark-tip')?.remove();
    wrap.querySelectorAll('.pmark.active').forEach((x) => x.classList.remove('active'));
    m.classList.add('active');
    const tip = h(`<div class="mark-tip">${list.map((n) => `<p>${esc(n.msg)}${n.fix ? `<small>${esc(n.fix)}</small>` : ''}</p>`).join('<hr style="border:0;border-top:1px solid var(--line-2);margin:8px 0">')}</div>`);
    const left = parseFloat(m.style.left);
    tip.style.top = parseFloat(m.style.top) + 28 + 'px';
    tip.style.left = Math.min(left - 230, wrap.clientWidth - 260) + 'px';
    wrap.appendChild(tip);
    focusPath(path, 'end', { flash: true });
    const off = (e) => { if (!tip.contains(e.target) && e.target !== m) { tip.remove(); m.classList.remove('active'); document.removeEventListener('pointerdown', off); } };
    setTimeout(() => document.addEventListener('pointerdown', off));
  }

  // ---------------- job description match ----------------
  function runJD() {
    const jd = r.jd || '';
    jdResult = jd.trim().length > 20 ? matchJD(jd, r) : null;
    highlightHits();
    if (tab === 'check') drawJDResult();
  }
  function highlightHits() {
    if (!window.CSS?.highlights) return;
    CSS.highlights.delete('jd-hit');
    if (!jdResult?.found.length || !r.showHits) return;
    const ranges = [];
    const walker = document.createTreeWalker(sheet, NodeFilter.SHOW_TEXT);
    const res = jdResult.found.map((t) => new RegExp(`(^|[^a-z0-9+#])(${t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})(?=$|[^a-z0-9+#])`, 'gi'));
    for (let n = walker.nextNode(); n; n = walker.nextNode()) {
      for (const re of res) {
        re.lastIndex = 0;
        let m;
        while ((m = re.exec(n.nodeValue))) {
          const st = m.index + m[1].length;
          const rg = new Range();
          rg.setStart(n, st);
          rg.setEnd(n, st + m[2].length);
          ranges.push(rg);
          if (re.lastIndex === m.index) re.lastIndex++;
        }
      }
    }
    CSS.highlights.set('jd-hit', new Highlight(...ranges));
  }

  // ---------------- side panel ----------------
  function drawPanel() {
    app.querySelectorAll('.tab').forEach((t) => t.setAttribute('aria-selected', t.dataset.tab === tab));
    app.querySelectorAll('[data-mtab]').forEach((t) => t.setAttribute('aria-selected', $('.panel').classList.contains('open') ? t.dataset.mtab === tab : t.dataset.mtab === 'page'));
    if (tab === 'sections') drawSections();
    if (tab === 'design') drawDesign();
    if (tab === 'check') drawCheck();
  }
  app.querySelectorAll('.tab').forEach((t) => (t.onclick = () => { tab = t.dataset.tab; drawPanel(); }));
  app.querySelectorAll('[data-mtab]').forEach((t) =>
    (t.onclick = () => {
      const p = $('.panel');
      if (t.dataset.mtab === 'page' || (p.classList.contains('open') && tab === t.dataset.mtab)) p.classList.remove('open');
      else { tab = t.dataset.mtab; p.classList.add('open'); }
      drawPanel();
    })
  );

  function drawSections() {
    const p = r.personal;
    const field = (k, label, ph, prefix) =>
      `<div class="field"><label for="pf-${k}">${label}</label>${prefix ? `<div class="prefix-input"><span>${prefix}</span><input class="input" id="pf-${k}" data-pf="${k}" value="${esc(p[k])}" placeholder="${ph}"></div>` : `<input class="input" id="pf-${k}" data-pf="${k}" value="${esc(p[k])}" placeholder="${ph}">`}</div>`;
    panelBody.innerHTML = `
      <div class="panel-h">Contact</div>
      ${field('name', 'Full name', 'K S Pankaj')}
      ${field('title', 'Headline', 'Software Developer | Full-Stack')}
      ${field('email', 'Email', 'you@email.com')}
      ${field('phone', 'Phone', '+91 98765 43210')}
      ${field('linkedin', 'LinkedIn', 'username', 'linkedin.com/in/')}
      ${field('github', 'GitHub', 'username', 'github.com/')}
      ${field('website', 'Website', 'yoursite.dev')}
      ${field('location', 'Location', 'Bengaluru, India')}
      <div class="panel-h">Sections <button class="btn sm" data-addsec>${ui('plus', 15)} Add</button></div>
      <p class="hint">Drag to reorder. Hidden sections stay saved but leave the page.</p>
      <ul class="sec-list">${r.sections
        .map(
          (s, i) => `<li class="sec-item${s.visible ? '' : ' hidden-sec'}" draggable="true" data-i="${i}">
          <span class="grip" aria-hidden="true">${ui('grip', 16)}</span>
          <span class="sec-name" data-jump="${i}" title="Show on page">${esc(s.title || 'Untitled')}</span>
          <button class="icon-btn" data-vis="${i}" aria-label="${s.visible ? 'Hide' : 'Show'} ${esc(s.title)}" title="${s.visible ? 'Hide' : 'Show'}">${ui(s.visible ? 'eye' : 'eyeOff', 16)}</button>
          <button class="icon-btn" data-smenu="${i}" aria-label="More for ${esc(s.title)}">${ui('more', 16)}</button></li>`
        )
        .join('')}</ul>`;
    panelBody.querySelectorAll('[data-pf]').forEach((inp) =>
      inp.addEventListener('input', () => {
        let v = inp.value;
        if (inp.dataset.pf === 'linkedin') v = v.replace(/^.*linkedin\.com\/in\//i, '').replace(/\/$/, '');
        if (inp.dataset.pf === 'github') v = v.replace(/^.*github\.com\//i, '').replace(/\/$/, '');
        r.personal[inp.dataset.pf] = v;
        paint();
        save();
        later('hist', () => { hist.push(r); syncUndo(); }, 600);
      })
    );
    panelBody.querySelector('[data-addsec]').onclick = (e) => {
      const names = { profile: 'Profile', skills: 'Skills', experience: 'Experience', projects: 'Projects', education: 'Education', certifications: 'Certifications', leadership: 'Leadership', achievements: 'Achievements', additional: 'Additional', custom: 'Custom section' };
      menu(e.currentTarget, Object.keys(SECTION_PRESETS).map((k) => ({
        label: names[k], onClick: () => {
          const s = newSection(k);
          r.sections.push(s);
          commit({ focus: { path: `sections.${r.sections.length - 1}.${s.kind === 'text' ? 'text' : 'title'}`, caret: 'end' } });
          drawSections();
          sheet.querySelector(`[data-sec="${r.sections.length - 1}"]`)?.scrollIntoView({ block: 'center', behavior: 'smooth' });
        },
      })), { align: 'right' });
    };
    panelBody.querySelectorAll('[data-vis]').forEach((b) => (b.onclick = () => { const s = r.sections[+b.dataset.vis]; s.visible = !s.visible; commit(); drawSections(); }));
    panelBody.querySelectorAll('[data-jump]').forEach((b) =>
      (b.onclick = () => {
        const s = r.sections[+b.dataset.jump];
        if (!s.visible) { s.visible = true; commit(); drawSections(); }
        focusPath(`sections.${b.dataset.jump}.title`, 'end', { flash: true, scroll: true });
        $('.panel').classList.remove('open');
      })
    );
    panelBody.querySelectorAll('[data-smenu]').forEach((b) =>
      (b.onclick = () => {
        const i = +b.dataset.smenu, s = r.sections[i];
        menu(b, [
          { label: 'Rename…', icon: ui('design', 16), onClick: async () => { const v = await ask({ title: 'Rename section', fields: [{ name: 't', label: 'Section title', value: s.title }] }); if (v?.t) { s.title = v.t; commit(); drawSections(); } } },
          { label: 'Duplicate', icon: ui('copy', 16), onClick: () => { const c = JSON.parse(JSON.stringify(s)); c.id = uid(); r.sections.splice(i + 1, 0, c); commit(); drawSections(); } },
          ...(s.kind === 'entries' ? [{ label: s.tight ? 'Normal bullet spacing' : 'Tighter bullet spacing', icon: ui('sections', 16), onClick: () => { s.tight = !s.tight; commit(); } }] : []),
          'sep',
          { label: 'Delete section', icon: ui('trash', 16), danger: true, onClick: () => { const gone = r.sections.splice(i, 1)[0]; commit(); drawSections(); toast(`Deleted “${gone.title}”`, { action: 'Undo', onAction: () => { r.sections.splice(i, 0, gone); commit(); drawSections(); } }); } },
        ], { align: 'right' });
      })
    );
    // drag & drop
    let from = null;
    panelBody.querySelectorAll('.sec-item').forEach((li) => {
      li.addEventListener('dragstart', (e) => { from = +li.dataset.i; li.classList.add('dragging'); e.dataTransfer.effectAllowed = 'move'; e.dataTransfer.setData('text/plain', from); });
      li.addEventListener('dragend', () => { li.classList.remove('dragging'); panelBody.querySelectorAll('.sec-item').forEach((x) => x.classList.remove('drop-before', 'drop-after')); });
      li.addEventListener('dragover', (e) => {
        e.preventDefault();
        const rc = li.getBoundingClientRect();
        const after = e.clientY > rc.top + rc.height / 2;
        panelBody.querySelectorAll('.sec-item').forEach((x) => x.classList.remove('drop-before', 'drop-after'));
        li.classList.add(after ? 'drop-after' : 'drop-before');
      });
      li.addEventListener('drop', (e) => {
        e.preventDefault();
        const to = +li.dataset.i;
        const after = li.classList.contains('drop-after');
        if (from == null || from === to) return;
        const [m] = r.sections.splice(from, 1);
        let idx = to + (after ? 1 : 0);
        if (from < idx) idx--;
        r.sections.splice(idx, 0, m);
        commit();
        drawSections();
      });
      li.addEventListener('keydown', (e) => {
        if (!e.altKey || !['ArrowUp', 'ArrowDown'].includes(e.key)) return;
        const i = +li.dataset.i, j = i + (e.key === 'ArrowUp' ? -1 : 1);
        if (j < 0 || j >= r.sections.length) return;
        [r.sections[i], r.sections[j]] = [r.sections[j], r.sections[i]];
        commit(); drawSections();
        panelBody.querySelector(`.sec-item[data-i="${j}"] .icon-btn`)?.focus();
      });
    });
  }

  function drawDesign() {
    const st = r.style;
    panelBody.innerHTML = `
      <div class="panel-h">Template</div>
      <div class="tpl-grid">${Object.entries(TEMPLATES).map(([k, t]) => `<button class="tpl" data-tpl="${k}" aria-pressed="${r.template === k}"><span class="tpl-thumb"></span>${t.name}</button>`).join('')}</div>
      <p class="tpl-note">${esc(TEMPLATES[r.template].note)}</p>
      <div class="panel-h">Fit</div>
      <div class="row-ctl"><label for="af">Fill exactly one page</label><span class="switch"><input type="checkbox" id="af" ${st.autoFit ? 'checked' : ''}><i></i></span></div>
      <p class="hint">${st.autoFit ? 'Type size and spacing adjust on their own as you write.' : 'Set type size and spacing yourself.'}</p>
      <div class="${st.autoFit ? 'disabled-block' : ''}" id="manual">
        <div class="row-ctl"><label for="fs">Type size</label><input type="range" id="fs" min="8.5" max="12" step="0.1"><output id="fs-o"></output></div>
        <div class="row-ctl"><label for="sp">Spacing</label><input type="range" id="sp" min="0.5" max="2" step="0.05"><output id="sp-o"></output></div>
      </div>
      <div class="panel-h">Accent</div>
      <div class="swatches ${r.template === 'modern' ? '' : 'disabled-block'}">${Object.entries(ACCENTS).map(([k, c]) => `<button class="swatch" data-acc="${k}" style="background:${c}" aria-label="${k}" aria-pressed="${st.accent === k}"></button>`).join('')}</div>
      <p class="hint" style="margin-top:8px">${r.template === 'modern' ? 'Used for your name, headings and bullets.' : 'Colour is used by the Modern template. Classic and Compact stay black, like print.'}</p>`;
    panelBody.querySelectorAll('[data-tpl]').forEach((b) => {
      const k = b.dataset.tpl;
      const th = b.querySelector('.tpl-thumb');
      const sh = sheetEl({ ...r, template: k });
      th.appendChild(sh);
      fit(sh, { ...r, template: k });
      requestAnimationFrame(() => (sh.style.transform = `scale(${th.clientWidth / PAGE_W})`));
      b.onclick = () => { r.template = k; commit(); drawDesign(); };
    });
    const af = panelBody.querySelector('#af');
    af.onchange = () => {
      if (!af.checked && lastFit) { st.fontSize = +lastFit.fs.toFixed(1); st.spacing = +lastFit.k.toFixed(2); }
      st.autoFit = af.checked;
      commit();
      drawDesign();
    };
    const fs = panelBody.querySelector('#fs'), sp = panelBody.querySelector('#sp');
    fs.oninput = () => { st.fontSize = +fs.value; refit(); save(); later('hist', () => { hist.push(r); syncUndo(); }, 500); };
    sp.oninput = () => { st.spacing = +sp.value; refit(); save(); later('hist', () => { hist.push(r); syncUndo(); }, 500); };
    panelBody.querySelectorAll('[data-acc]').forEach((b) => (b.onclick = () => { st.accent = b.dataset.acc; commit(); drawDesign(); }));
    syncDesignReadouts();
  }
  function syncDesignReadouts() {
    const fs = panelBody.querySelector('#fs');
    if (!fs || !lastFit) return;
    const sp = panelBody.querySelector('#sp');
    fs.value = lastFit.fs; sp.value = lastFit.k;
    panelBody.querySelector('#fs-o').textContent = lastFit.fs.toFixed(1) + ' pt';
    panelBody.querySelector('#sp-o').textContent = Math.round(lastFit.k * 100) + '%';
  }

  function drawCheck() {
    panelBody.innerHTML = `
      <div class="panel-h">Proofreading</div>
      <div class="row-ctl"><label for="mk">Show marks in the margin</label><span class="switch"><input type="checkbox" id="mk" ${store.settings().marks !== false ? 'checked' : ''}><i></i></span></div>
      <div id="issues"></div>
      <div class="panel-h">Match a job post</div>
      <p class="hint">Paste the job description. Rizzume lists the skills it asks for and which ones your resume already mentions. Nothing is sent anywhere.</p>
      <textarea class="textarea" id="jd" placeholder="Paste the job description here…">${esc(r.jd || '')}</textarea>
      <div id="jdres"></div>`;
    panelBody.querySelector('#mk').onchange = (e) => { store.setSetting('marks', e.target.checked); updateMarks(); };
    const jd = panelBody.querySelector('#jd');
    jd.addEventListener('input', () => { r.jd = jd.value; save(); later('jd', runJD, 300); });
    drawCheckIssues();
    runJD();
  }
  function drawCheckIssues() {
    const box = panelBody.querySelector('#issues');
    if (!box) return;
    if (!notes.length) { box.innerHTML = `<div class="all-clear">${ui('check', 18)}Nothing to fix. Nice and tight.</div>`; return; }
    box.innerHTML = notes.map((n) => `<div class="issue ${n.level}" data-path="${n.path}" tabindex="0" role="button"><span class="mark">${n.n}</span><p>${esc(n.msg)}${n.fix ? `<small>${esc(n.fix)}</small>` : ''}</p></div>`).join('');
    box.querySelectorAll('.issue').forEach((el) => (el.onclick = el.onkeydown = (e) => {
      if (e.type === 'keydown' && e.key !== 'Enter') return;
      $('.panel').classList.remove('open');
      focusPath(el.dataset.path, 'end', { flash: true, scroll: true });
    }));
  }
  function drawJDResult() {
    const box = panelBody.querySelector('#jdres');
    if (!box) return;
    if (!jdResult) { box.innerHTML = ''; return; }
    const { found, missing, score } = jdResult;
    if (!found.length && !missing.length) { box.innerHTML = `<p class="hint" style="margin-top:12px">No familiar skills found in that text yet.</p>`; return; }
    box.innerHTML = `
      <div class="score"><b>${score}%</b><span>of the skills it names are on your resume</span></div>
      <div class="row-ctl"><label for="hl">Highlight matches on the page</label><span class="switch"><input type="checkbox" id="hl" ${r.showHits ? 'checked' : ''}><i></i></span></div>
      ${missing.length ? `<div class="panel-h">Missing <span class="hint" style="margin:0;font-weight:400">Click to add to skills</span></div><div class="chips">${missing.map((t) => `<button class="chip miss" data-add="${esc(t)}">${ui('plus', 12)}${esc(t)}</button>`).join('')}</div>` : ''}
      ${found.length ? `<div class="panel-h">Already there</div><div class="chips">${found.map((t) => `<span class="chip hit">${esc(t)}</span>`).join('')}</div>` : ''}`;
    box.querySelector('#hl').onchange = (e) => { r.showHits = e.target.checked; save(); highlightHits(); };
    box.querySelectorAll('[data-add]').forEach((b) => (b.onclick = () => addSkill(b.dataset.add)));
  }
  function addSkill(term) {
    let si = r.sections.findIndex((s) => s.kind === 'lines' && s.visible && s.type === 'skills');
    if (si < 0) si = r.sections.findIndex((s) => s.kind === 'lines');
    if (si < 0) { r.sections.splice(1, 0, newSection('skills')); si = 1; }
    const s = r.sections[si];
    const pretty = term.replace(/\b[a-z]/g, (c) => c.toUpperCase()).replace(/^(Aws|Gcp|Sql|Api|Css|Html|Crm|Seo|Jwt|Nlp|Llm|Etl|Dsa|Oop|Siem|Soc|Owasp)$/i, (m) => m.toUpperCase());
    let row = s.rows.find((x) => /skill|tool|technolog|framework/i.test(x.label)) || s.rows[0];
    if (!row) { row = { id: uid(), label: 'Skills', value: '' }; s.rows.push(row); }
    row.value = row.value ? row.value.replace(/[\s.]+$/, '') + ', ' + pretty : pretty;
    commit();
    runJD();
    toast(`Added ${pretty} to ${row.label || 'skills'}`, { action: 'Undo', onAction: () => travel(-1) });
  }

  // ---------------- top bar ----------------
  nameInput.addEventListener('input', () => { r.name = nameInput.value; save(); });
  nameInput.addEventListener('change', () => commit({ repaint: false }));
  nameInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') nameInput.blur(); });
  $('[data-undo]').onclick = () => travel(-1);
  $('[data-redo]').onclick = () => travel(1);
  const themeBtn = $('[data-theme]');
  const drawTheme = () => {
    const dark = document.documentElement.dataset.theme === 'dark' || (!document.documentElement.dataset.theme && matchMedia('(prefers-color-scheme: dark)').matches);
    themeBtn.innerHTML = ui(dark ? 'sun' : 'moon');
    return dark;
  };
  drawTheme();
  themeBtn.onclick = () => { store.setSetting('theme', drawTheme() ? 'light' : 'dark'); applyTheme(); drawTheme(); };

  async function doPdf() {
    const ov = h(`<div class="exporting" role="alert" aria-busy="true"><div class="exporting-card"><div class="press"><i></i><i></i><i></i><i></i><i></i><i></i><i></i></div><p>Setting your PDF…</p></div></div>`);
    document.body.appendChild(ov);
    try {
      const [name] = await Promise.all([downloadPdf(r), new Promise((res) => setTimeout(res, 900))]);
      toast(`Downloaded ${name}`);
    } catch (err) {
      console.error(err);
      toast('The PDF couldn’t be made. Try again, or use your browser’s Print → Save as PDF.');
    } finally { ov.remove(); }
  }
  function doTex() { saveBlob(toTex(r), fileBase(r) + '.tex', 'application/x-tex'); toast(`Downloaded ${fileBase(r)}.tex`); }
  function doJson() { saveBlob(JSON.stringify(r, null, 2), fileBase(r) + '.json', 'application/json'); toast('Backup downloaded'); }
  $('[data-download]').onclick = (e) =>
    menu(e.currentTarget, [
      { label: 'PDF', icon: ui('file', 16), kbd: 'Ctrl P', onClick: doPdf },
      { label: 'LaTeX source (.tex)', icon: ui('sections', 16), onClick: doTex },
      { label: 'Backup (.json)', icon: ui('download', 16), onClick: doJson },
    ], { align: 'right' });
  $('[data-more]').onclick = (e) =>
    menu(e.currentTarget, [
      { label: 'Tailor a copy for a job…', icon: ui('copy', 16), onClick: async () => { const c = await tailorCopy(r); if (c) { location.hash = `#/edit/${c.id}`; toast(`Now editing “${c.name}”`); } } },
      { label: 'Import a backup…', icon: ui('upload', 16), onClick: async () => { const n = await importJsonFile(); if (n) location.hash = `#/edit/${n.id}`; } },
      'sep',
      { label: 'Keyboard shortcuts', icon: ui('pen', 16), onClick: shortcuts },
      { label: 'All resumes', icon: ui('back', 16), onClick: () => (location.hash = '#/resumes') },
    ], { align: 'right' });
  function shortcuts() {
    toast('Enter: new bullet · Backspace on empty: remove · Ctrl+Z / Ctrl+Shift+Z: undo, redo · Ctrl+P: PDF', { ms: 7000 });
  }

  const onKey = (e) => {
    const mod = e.ctrlKey || e.metaKey;
    if (!mod) return;
    const k = e.key.toLowerCase();
    if (k === 'z' && !e.shiftKey && !(e.target.matches?.('input, textarea'))) { e.preventDefault(); hist.push(r); travel(-1); }
    else if ((k === 'z' && e.shiftKey) || k === 'y') { if (!e.target.matches?.('input, textarea')) { e.preventDefault(); travel(1); } }
    else if (k === 'p') { e.preventDefault(); doPdf(); }
    else if (k === 's') { e.preventDefault(); store.put(r); toast('Saved. Rizzume saves as you type.'); }
  };
  document.addEventListener('keydown', onKey);

  // ---------------- go ----------------
  const warm = setTimeout(() => import('../pdf.js').catch(() => {}), 2500);
  syncUndo();
  saveState.innerHTML = `${ui('check', 15)}Saved`;
  document.fonts.ready.then(() => { paint(); drawPanel(); if (r.jd) runJD(); });
  paint();
  drawPanel();

  return () => {
    document.removeEventListener('keydown', onKey);
    clearTimeout(warm);
    ro.disconnect();
    Object.values(timers).forEach(clearTimeout);
    if (window.CSS?.highlights) CSS.highlights.delete('jd-hit');
    store.put(r);
  };
}
