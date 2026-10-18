// Visit and download counters, kept by Abacus (a free counter service: it stores only numbers,
// never anything about the resume or the person). Fails quietly when offline or blocked.
const BASE = 'https://abacus.jasoncameron.dev';
const NS = import.meta.env.PROD ? 'rizzume-pankqx' : 'rizzume-dev';

async function call(kind, key) {
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 5000);
    const res = await fetch(`${BASE}/${kind}/${NS}/${key}`, { signal: ctrl.signal, cache: 'no-store' });
    clearTimeout(t);
    if (!res.ok) return null;
    const j = await res.json();
    return typeof j.value === 'number' ? j.value : null;
  } catch {
    return null;
  }
}

let visitsP = null;
// One visit per browser session; later page views in the same session only read the number.
export function countVisit() {
  if (visitsP) return visitsP;
  let seen = false;
  try { seen = sessionStorage.getItem('rz-visit') === '1'; sessionStorage.setItem('rz-visit', '1'); } catch {}
  visitsP = call(seen ? 'get' : 'hit', 'visits');
  return visitsP;
}
export const getDownloads = () => call('get', 'pdfs').then((v) => v ?? 0);
export const countDownload = () => call('hit', 'pdfs');

// Rolling-digit counter ("odometer") that animates up to a number.
export function odometer(el, value) {
  const s = Math.max(0, Math.round(value)).toLocaleString('en-IN');
  el.setAttribute('aria-label', s);
  el.innerHTML = [...s]
    .map((ch) =>
      /\d/.test(ch)
        ? `<span class="odo-d" aria-hidden="true"><span class="odo-col" style="--n:${ch}">${'0123456789'.split('').map((d) => `<i>${d}</i>`).join('')}</span></span>`
        : `<span class="odo-sep" aria-hidden="true">${ch}</span>`
    )
    .join('');
  requestAnimationFrame(() => requestAnimationFrame(() => el.classList.add('roll')));
}
