// Match lifecycle: start, push actions, undo, finish & archive.
import { getState, update } from './store.js';
import * as x01 from './engines/x01.js';
import * as cricket from './engines/cricket.js';
import { atc, bobs, checkout } from './engines/training.js';
import { uid } from './darts.js';

export const ENGINES = {
  x01: { compute: x01.compute, stats: x01.stats, bot: x01.botAction },
  cricket: { compute: cricket.compute, stats: cricket.stats, bot: cricket.botAction },
  atc: { compute: atc.compute, stats: atc.stats },
  bobs27: { compute: bobs.compute, stats: bobs.stats },
  checkout: { compute: checkout.compute, stats: checkout.stats },
};

export const go = (hash) => { location.hash = hash; };

export function startMatch(type, config) {
  update((s) => { s.active = { id: uid(), type, config, actions: [], started: Date.now() }; s.lastSetup[type] = config; });
  go('#/game');
}

export function computeActive(active = getState().active) {
  if (!active) return null;
  return ENGINES[active.type].compute(active.config, active.actions);
}

/** Append an action; returns the new state. Archives the match when finished. */
export function pushAction(action) {
  const a = getState().active;
  if (!a) return null;
  const actions = [...a.actions, action];
  const st = ENGINES[a.type].compute(a.config, actions);
  update((s) => { s.active = { ...a, actions }; });
  if (st.finished) finishMatch(st);
  return st;
}

export function undo() {
  const a = getState().active;
  if (!a || !a.actions.length) return false;
  const actions = [...a.actions];
  const eng = ENGINES[a.type];
  actions.pop();
  // also roll back bot visits so the human gets their turn back
  while (actions.length) {
    const s = eng.compute(a.config, actions);
    if (a.config.players[s.current]?.bot) actions.pop(); else break;
  }
  update((s) => { s.active = { ...a, actions }; });
  return true;
}

function finishMatch(st) {
  const a = getState().active;
  const stats = ENGINES[a.type].stats(st, a.config);
  const rec = {
    id: a.id, type: a.type, date: a.started, ended: Date.now(), config: a.config, actions: a.actions,
    players: a.config.players, winner: a.config.players[st.winner]?.id ?? null, stats,
  };
  update((s) => { s.matches = [rec, ...s.matches.filter((m) => m.id !== rec.id)]; s.active = null; });
  setTimeout(() => go('#/result/' + rec.id), 650);
}

export function abandonMatch() {
  update((s) => { s.active = null; });
}

export function rematch(rec) {
  const cfg = structuredClone(rec.config);
  // rotate the starting player
  if (cfg.players.length > 1) cfg.players.push(cfg.players.shift());
  if (rec.type === 'checkout') cfg.seed = Math.floor(Math.random() * 1e9);
  startMatch(rec.type, cfg);
}

export function deleteMatch(id) {
  update((s) => { s.matches = s.matches.filter((m) => m.id !== id); });
}

export function playerFromBot(level) {
  return { id: 'bot-' + level + '-' + uid(), name: 'Bot ' + level, bot: level, hue: 200 + level * 8, shape: 'gem' };
}
