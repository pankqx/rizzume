// Auto-fit: tune type size and vertical rhythm so the content fills exactly one A4 page.
import { TEMPLATES } from './render.js';

const PX_PER_PT = 96 / 72;
export const PAGE_H = 841.89 * PX_PER_PT;
export const AVAIL_H = (841.89 - 72) * PX_PER_PT;

function params(u, base) {
  let k, fs;
  if (u <= 0) {
    k = 1 + Math.max(u, -0.5) * 0.6;
    fs = base + Math.min(0, u + 0.5) * 2 * 1.25;
  } else {
    k = 1 + (Math.min(u, 0.6) / 0.6) * 0.35;
    fs = base + (Math.max(0, u - 0.6) / 0.4) * 0.8;
  }
  return { fs: +fs.toFixed(3), k: +k.toFixed(3) };
}

function apply(sheet, p) {
  sheet.style.setProperty('--fs', p.fs);
  sheet.style.setProperty('--k', p.k);
}

const height = (sheet) => sheet.querySelector('.sheet-body').offsetHeight;

export function fit(sheet, r) {
  const base = (TEMPLATES[r.template] || TEMPLATES.classic).base;
  let p;
  if (!r.style.autoFit) {
    p = { fs: r.style.fontSize || base, k: r.style.spacing || 1 };
    apply(sheet, p);
  } else {
    let lo = -1, hi = 1;
    apply(sheet, params(hi, base));
    if (height(sheet) <= AVAIL_H) p = params(hi, base);
    else {
      apply(sheet, params(lo, base));
      if (height(sheet) > AVAIL_H) p = params(lo, base);
      else {
        for (let i = 0; i < 14; i++) {
          const mid = (lo + hi) / 2;
          apply(sheet, params(mid, base));
          if (height(sheet) <= AVAIL_H) lo = mid;
          else hi = mid;
        }
        p = params(lo, base);
      }
    }
    apply(sheet, p);
  }
  const h = height(sheet);
  const overflow = h > AVAIL_H + 0.5;
  sheet.classList.toggle('is-overflow', overflow);
  const pages = Math.max(1, Math.ceil(h / AVAIL_H));
  sheet.style.minHeight = pages * 841.89 + 'pt';
  return { ...p, fill: Math.min(h / AVAIL_H, 9), overflow, pages, extraLines: overflow ? Math.ceil((h - AVAIL_H) / (p.fs * 1.272 * PX_PER_PT)) : 0 };
}
