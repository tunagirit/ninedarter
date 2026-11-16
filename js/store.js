// Tiny persistent store (localStorage) with subscribe + preact hook.
import { useState, useEffect } from '../vendor/preact-htm.js';
import { uid } from './darts.js';

const KEY = 'ninedarter:v1';

const defaults = () => ({
  version: 1,
  settings: {
    theme: 'system', hue: 285,
    lang: (navigator.language || 'en').toLowerCase().startsWith('tr') ? 'tr' : 'en',
    caller: true, callerVoice: '', vibrate: true, askDoubles: true, hints: true, inputMode: 'keypad', botSpeed: 900,
  },
  players: [],
  matches: [],
  active: null,
  lastSetup: {},
});

function load() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return defaults();
    const d = JSON.parse(raw);
    const def = defaults();
    return { ...def, ...d, settings: { ...def.settings, ...(d.settings || {}) } };
  } catch { return defaults(); }
}

let state = load();
const subs = new Set();

function save() {
  try { localStorage.setItem(KEY, JSON.stringify(state)); }
  catch (e) {
    // Storage full: trim oldest matches' action logs and retry
    if (state.matches.length > 50) {
      state.matches.slice(50).forEach((m) => { delete m.actions; });
      try { localStorage.setItem(KEY, JSON.stringify(state)); } catch {}
    }
  }
}

export const getState = () => state;

/** Mutate a shallow copy of the state, persist and notify. */
export function update(fn) {
  const next = { ...state, settings: { ...state.settings }, players: [...state.players], matches: [...state.matches], lastSetup: { ...state.lastSetup } };
  fn(next);
  state = next;
  save();
  subs.forEach((s) => s(state));
}

export function subscribe(fn) { subs.add(fn); return () => subs.delete(fn); }

export function useStore() {
  const [, force] = useState(0);
  useEffect(() => subscribe(() => force((x) => x + 1)), []);
  return state;
}

// ---------- helpers ----------
const SHAPES = ['cookie', 'flower', 'clover', 'sunny', 'burst', 'pill', 'gem', 'puffy'];
export function addPlayer(name) {
  const used = new Set(state.players.map((p) => p.hue));
  const hues = [262, 20, 150, 330, 200, 80, 290, 45, 175, 0];
  const hue = hues.find((h) => !used.has(h)) ?? Math.floor(Math.random() * 360);
  const p = { id: uid(), name: name.trim(), hue, shape: SHAPES[state.players.length % SHAPES.length], created: Date.now() };
  update((s) => { s.players.push(p); });
  return p;
}

export function exportData() {
  return JSON.stringify(state, null, 1);
}
export function importData(json) {
  const d = JSON.parse(json);
  if (!d || !Array.isArray(d.players) || !Array.isArray(d.matches)) throw new Error('invalid');
  update((s) => { Object.assign(s, defaults(), d, { settings: { ...defaults().settings, ...d.settings } }); });
}
export function resetAll() {
  state = defaults(); save(); subs.forEach((s) => s(state));
}
