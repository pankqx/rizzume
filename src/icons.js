import fa from './fa-icons.json';

// Font Awesome 5 Free icons (CC BY 4.0) — the same set the LaTeX fontawesome5 package uses.
export const FA = fa;

export function faSvg(name, cls = 'r-ico') {
  const i = FA[name];
  if (!i) return '';
  return `<svg class="${cls}" data-fa="${name}" viewBox="0 0 ${i.w} ${i.h}" aria-hidden="true"><path d="${i.d}"/></svg>`;
}

// UI icons: 20px grid, 1.6 stroke, drawn for Rizzume.
const P = {
  plus: '<path d="M10 4v12M4 10h12"/>',
  trash: '<path d="M4 6h12M8 6V4h4v2M6 6l1 10h6l1-10"/>',
  copy: '<rect x="7" y="7" width="9" height="9" rx="1.5"/><path d="M13 7V5.5A1.5 1.5 0 0 0 11.5 4h-6A1.5 1.5 0 0 0 4 5.5v6A1.5 1.5 0 0 0 5.5 13H7"/>',
  up: '<path d="M10 15V5M5.5 9.5 10 5l4.5 4.5"/>',
  down: '<path d="M10 5v10M5.5 10.5 10 15l4.5-4.5"/>',
  eye: '<path d="M2.5 10s2.8-5 7.5-5 7.5 5 7.5 5-2.8 5-7.5 5-7.5-5-7.5-5Z"/><circle cx="10" cy="10" r="2.2"/>',
  eyeOff: '<path d="M3 3l14 14M8.3 5.2A7.7 7.7 0 0 1 10 5c4.7 0 7.5 5 7.5 5a13 13 0 0 1-2.2 2.8M12 14.6a6.5 6.5 0 0 1-2 .4c-4.7 0-7.5-5-7.5-5a13 13 0 0 1 3.1-3.5"/>',
  grip: '<circle cx="7.5" cy="5" r="1"/><circle cx="12.5" cy="5" r="1"/><circle cx="7.5" cy="10" r="1"/><circle cx="12.5" cy="10" r="1"/><circle cx="7.5" cy="15" r="1"/><circle cx="12.5" cy="15" r="1"/>',
  undo: '<path d="M7 8H13a3.5 3.5 0 0 1 0 7H9"/><path d="M9.5 5 6.5 8l3 3"/>',
  redo: '<path d="M13 8H7a3.5 3.5 0 0 0 0 7h4"/><path d="M10.5 5l3 3-3 3"/>',
  download: '<path d="M10 3.5v9M6 9l4 4 4-4M4 16.5h12"/>',
  link: '<path d="M8.5 11.5l3-3M9 6l1.3-1.3a3 3 0 0 1 4.2 4.2L13.2 10M11 14l-1.3 1.3a3 3 0 0 1-4.2-4.2L6.8 10"/>',
  check: '<path d="M4.5 10.5 8 14l7.5-8"/>',
  close: '<path d="M5 5l10 10M15 5 5 15"/>',
  back: '<path d="M12 4.5 6.5 10l5.5 5.5"/>',
  sun: '<circle cx="10" cy="10" r="3.2"/><path d="M10 2.5v1.7M10 15.8v1.7M2.5 10h1.7M15.8 10h1.7M4.7 4.7l1.2 1.2M14.1 14.1l1.2 1.2M4.7 15.3l1.2-1.2M14.1 5.9l1.2-1.2"/>',
  moon: '<path d="M15.5 12.5A6 6 0 0 1 7.5 4.5a6 6 0 1 0 8 8Z"/>',
  more: '<circle cx="5" cy="10" r="1.1"/><circle cx="10" cy="10" r="1.1"/><circle cx="15" cy="10" r="1.1"/>',
  file: '<path d="M5.5 2.5h6l3.5 3.5v11.5h-9.5Z"/><path d="M11.5 2.5V6H15"/>',
  upload: '<path d="M10 13V4M6 7.5 10 3.5l4 4M4 16.5h12"/>',
  search: '<circle cx="9" cy="9" r="5"/><path d="M13 13l3.5 3.5"/>',
  sections: '<path d="M4 5h12M4 10h12M4 15h8"/>',
  design: '<path d="M4 16l3.5-1 8-8a1.8 1.8 0 0 0-2.5-2.5l-8 8Z"/><path d="M11.5 6l2.5 2.5"/>',
  pen: '<path d="M13.5 3.5l3 3L8 15H5v-3Z"/>',
  zoomIn: '<circle cx="9" cy="9" r="5"/><path d="M13 13l3.5 3.5M7 9h4M9 7v4"/>',
  zoomOut: '<circle cx="9" cy="9" r="5"/><path d="M13 13l3.5 3.5M7 9h4"/>',
  user: '<circle cx="10" cy="7" r="3"/><path d="M4.5 16.5a5.5 5.5 0 0 1 11 0"/>',
};

export function ui(name, size = 18) {
  return `<svg class="ui-ico" width="${size}" height="${size}" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${P[name] || ''}</svg>`;
}
