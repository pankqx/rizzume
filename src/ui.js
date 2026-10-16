// Small UI kit: toasts, menus, modals, helpers.
export const $ = (sel, root = document) => root.querySelector(sel);
export const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];
export const h = (html) => {
  const t = document.createElement('template');
  t.innerHTML = html.trim();
  return t.content.firstElementChild;
};
export const esc = (s = '') => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

export function toast(msg, { action, onAction, ms = 3200 } = {}) {
  const zone = document.getElementById('toasts');
  const el = h(`<div class="toast"><span>${esc(msg)}</span>${action ? `<button>${esc(action)}</button>` : ''}</div>`);
  if (action) el.querySelector('button').onclick = () => { onAction?.(); close(); };
  zone.appendChild(el);
  let t = setTimeout(close, ms);
  function close() {
    clearTimeout(t);
    el.classList.add('out');
    setTimeout(() => el.remove(), 250);
  }
  return close;
}

let openMenu = null;
export function closeMenu() {
  openMenu?.remove();
  openMenu = null;
}
// items: [{label, icon, kbd, onClick, danger}] | 'sep' | {head}
export function menu(anchor, items, { align = 'left' } = {}) {
  closeMenu();
  const el = document.createElement('div');
  el.className = 'menu';
  el.setAttribute('role', 'menu');
  for (const it of items) {
    if (it === 'sep') { el.appendChild(document.createElement('hr')); continue; }
    if (it.head) { el.appendChild(h(`<div class="menu-head">${esc(it.head)}</div>`)); continue; }
    const b = h(`<button role="menuitem" class="${it.danger ? 'danger' : ''}">${it.icon || ''}<span>${esc(it.label)}</span>${it.kbd ? `<small>${esc(it.kbd)}</small>` : ''}</button>`);
    b.onclick = (e) => { e.stopPropagation(); closeMenu(); it.onClick?.(); };
    el.appendChild(b);
  }
  document.body.appendChild(el);
  const r = anchor.getBoundingClientRect();
  const w = el.offsetWidth, hgt = el.offsetHeight;
  let left = align === 'right' ? r.right - w : r.left;
  left = Math.max(8, Math.min(left, innerWidth - w - 8));
  let top = r.bottom + 6;
  if (top + hgt > innerHeight - 8) top = Math.max(8, r.top - hgt - 6);
  el.style.left = left + 'px';
  el.style.top = top + 'px';
  openMenu = el;
  el.querySelector('button')?.focus({ preventScroll: true });
  el.addEventListener('keydown', (e) => {
    const bs = $$('button', el), i = bs.indexOf(document.activeElement);
    if (e.key === 'ArrowDown') { e.preventDefault(); bs[(i + 1) % bs.length].focus(); }
    if (e.key === 'ArrowUp') { e.preventDefault(); bs[(i - 1 + bs.length) % bs.length].focus(); }
    if (e.key === 'Escape') { closeMenu(); anchor.focus?.(); }
  });
  return el;
}
document.addEventListener('pointerdown', (e) => { if (openMenu && !openMenu.contains(e.target)) closeMenu(); });

export function modal(html, { onMount } = {}) {
  const scrim = h(`<div class="scrim"><div class="modal" role="dialog" aria-modal="true">${html}</div></div>`);
  const close = () => { scrim.remove(); document.removeEventListener('keydown', onKey); };
  const onKey = (e) => { if (e.key === 'Escape') close(); };
  scrim.addEventListener('pointerdown', (e) => { if (e.target === scrim) close(); });
  document.addEventListener('keydown', onKey);
  document.body.appendChild(scrim);
  const m = scrim.firstElementChild;
  onMount?.(m, close);
  (m.querySelector('[autofocus]') || m.querySelector('input, button'))?.focus();
  return close;
}

export function ask({ title, text = '', fields = [], ok = 'Save', danger = false }) {
  return new Promise((resolve) => {
    let done = false;
    const html = `<h2>${esc(title)}</h2>${text ? `<p>${esc(text)}</p>` : ''}<form>${fields
      .map((f, i) => `<div class="field"><label for="f${i}">${esc(f.label)}</label><input class="input" id="f${i}" name="${f.name}" value="${esc(f.value || '')}" placeholder="${esc(f.placeholder || '')}" ${i === 0 ? 'autofocus' : ''}></div>`)
      .join('')}<div class="modal-actions"><button type="button" class="btn ghost" data-cancel>Cancel</button><button class="btn ${danger ? 'ember' : 'primary'}">${esc(ok)}</button></div></form>`;
    const close = modal(html, {
      onMount(m, closeFn) {
        m.querySelector('[data-cancel]').onclick = () => { closeFn(); finish(null); };
        m.querySelector('form').onsubmit = (e) => {
          e.preventDefault();
          const out = {};
          new FormData(e.target).forEach((v, k) => (out[k] = String(v).trim()));
          closeFn();
          finish(out);
        };
      },
    });
    function finish(v) { if (!done) { done = true; resolve(v); } }
    // resolve null if closed by escape/scrim
    const obs = new MutationObserver(() => { if (!document.querySelector('.scrim')) { obs.disconnect(); finish(null); } });
    obs.observe(document.body, { childList: true });
    void close;
  });
}

export function timeAgo(t) {
  const s = (Date.now() - t) / 1000;
  if (s < 60) return 'just now';
  if (s < 3600) return `${Math.floor(s / 60)} min ago`;
  if (s < 86400) return `${Math.floor(s / 3600)} h ago`;
  if (s < 86400 * 7) return `${Math.floor(s / 86400)} d ago`;
  return new Date(t).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
}

export function pickFile(accept) {
  return new Promise((resolve) => {
    const i = document.createElement('input');
    i.type = 'file';
    i.accept = accept;
    i.onchange = () => resolve(i.files[0] || null);
    i.click();
  });
}
