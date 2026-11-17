// Tiny persistent store (localStorage) with subscribe + preact hook.
import { useState, useEffect } from '../vendor/preact-htm.js';
import { uid } from './darts.js';

const KEY = 'ninedarter:v1';

const defaults = () => ({
  version: 2,
  settings: {
    theme: 'system', hue: 285,
    lang: (navigator.language || 'en').toLowerCase().startsWith('tr') ? 'tr' : 'en',
    caller: true, callerVoice: '', vibrate: true, askDoubles: true, hints: true, inputMode: 'keypad', botSpeed: 900, uiScale: 'medium',
  },
  // the person using this device ("me"); linked to an account after sign-in
  profile: { localId: uid(), name: '', photo: null, hue: 285, shape: 'cookie', linked: false },
  players: [], // offline player database
  matches: [],
  active: null,
  lastSetup: {},
  account: null, // {uid, email, username, avatar}
  friends: [], friendReqs: [], inbox: { convs: [], unread: 0 },
  cloud: {},
});

function load() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return defaults();
    const d = JSON.parse(raw);
    const def = defaults();
    return { ...def, ...d, settings: { ...def.settings, ...(d.settings || {}) }, profile: { ...def.profile, ...(d.profile || {}) }, cloud: {} };
  } catch { return defaults(); }
}

let state = load();
// v1.0.2: start with an empty offline player list (older builds left stale local players behind)
if ((state.version || 1) < 2) { state = { ...state, version: 2, players: [], lastSetup: {} }; }
try { localStorage.setItem(KEY, JSON.stringify(state)); } catch {}

/** The local user as a game participant. */
export function mePlayer(s = state) {
  const p = s.profile;
  const name = s.account ? s.account.displayName || s.account.username : p.name || (s.settings.lang === 'tr' ? 'Ben' : 'Me');
  return { id: s.account?.uid || p.localId, name, hue: p.hue, shape: p.shape, photo: s.account?.avatar || p.photo || null, kind: 'me' };
}
export const friendPlayer = (f) => ({ id: f.id, name: f.name, hue: Math.round((parseInt(f.id.slice(0, 2), 16) || [...f.id].reduce((a, ch) => a + ch.charCodeAt(0), 0)) * 1.4) % 360, shape: 'flower', photo: f.photo || null, kind: 'friend' });
export const offlinePlayer = (p) => ({ id: p.id, name: p.name, hue: p.hue, shape: p.shape, photo: p.photo || null, kind: 'offline' });
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
