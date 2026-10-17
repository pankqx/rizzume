// Local-only persistence. Everything lives in this browser; nothing is uploaded.
import { normalize } from './model.js';

const KEY = 'rizzume:v1';
let state = { resumes: {}, settings: { theme: 'auto', marks: true } };

function safeGet() {
  try {
    return JSON.parse(localStorage.getItem(KEY) || 'null');
  } catch {
    return null;
  }
}
function safeSet() {
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
    return true;
  } catch {
    return false;
  }
}

// Older builds used a different sample person; rename it wherever it was saved.
function migrateSample(r) {
  const p = r.personal;
  if (/^ananya rao$/i.test(p.name.trim())) {
    p.name = 'PRISHA PANKAJ';
    if (/ananya/i.test(p.email)) p.email = 'prisha.pankaj@email.com';
    for (const k of ['linkedin', 'github']) if (/ananya/i.test(p[k])) p[k] = 'prishapankaj';
    for (const s of r.sections) if (s.items) for (const e of s.items) if (/ananya/i.test(e.url)) e.url = e.url.replace(/ananyarao/gi, 'prishapankaj');
    if (/ananya/i.test(r.name)) r.name = r.name.replace(/ananya rao/gi, 'Prisha Pankaj');
  }
  return r;
}

export function load() {
  const s = safeGet();
  if (s && s.resumes) {
    state = { ...state, ...s, settings: { ...state.settings, ...(s.settings || {}) } };
    for (const id in state.resumes) state.resumes[id] = migrateSample(normalize(state.resumes[id]));
  }
  return state;
}

export const settings = () => state.settings;
export function setSetting(k, v) {
  state.settings[k] = v;
  safeSet();
}

export function list() {
  return Object.values(state.resumes).sort((a, b) => b.updatedAt - a.updatedAt);
}
export const get = (id) => state.resumes[id];

export function put(r, { touch = true } = {}) {
  if (touch) r.updatedAt = Date.now();
  state.resumes[r.id] = r;
  return safeSet();
}
export function remove(id) {
  delete state.resumes[id];
  safeSet();
}

// ---------- Undo history (per open resume, in memory) ----------
export function history(initial) {
  const stack = [JSON.stringify(initial)];
  let i = 0;
  return {
    push(r) {
      const s = JSON.stringify(r);
      if (s === stack[i]) return false;
      stack.splice(i + 1);
      stack.push(s);
      if (stack.length > 200) stack.shift();
      i = stack.length - 1;
      return true;
    },
    undo() {
      if (i === 0) return null;
      return JSON.parse(stack[--i]);
    },
    redo() {
      if (i >= stack.length - 1) return null;
      return JSON.parse(stack[++i]);
    },
    get canUndo() {
      return i > 0;
    },
    get canRedo() {
      return i < stack.length - 1;
    },
  };
}
