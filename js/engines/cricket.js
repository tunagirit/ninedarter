// Cricket engine: Cricket / Tactics / Fullboard, optional penalty (cut-throat) scoring, solo or teams.
// Targets: numbers, 25 (bull/house), 'D' (any double) and 'T' (any treble).
import { botCricketVisit } from '../bot.js';
import { sidesOf } from '../teams.js';

const range = (a, b) => Array.from({ length: a - b + 1 }, (_, i) => a - i);
export const VARIANTS = {
  cricket: [...range(20, 15), 25],
  tactics: [...range(20, 1), 'D', 'T', 25],
  fullboard: range(20, 1),
  akyaka: [...range(20, 15), 25], // sequential: only the next unclosed target counts, no points
};
export const NUMBERS = VARIANTS.cricket;

/* config = { mode: 'cricket'|'tactics'|'fullboard', cutthroat: bool, legsToWin, rounds (0 = unlimited), players, teams? } */
export const targetsOf = (config) => VARIANTS[config.mode || 'cricket'];
const isCut = (config) => config.mode !== 'akyaka' && (!!config.cutthroat || config.variant === 'cutthroat');
/** Akyaka: the next target this side still has to close (in order). */
export const nextTarget = (s, side) => s.targets.find((x) => s.marks[side][x] < 3);

function newLeg(s) {
  s.marks = Array.from({ length: s.n }, () => Object.fromEntries(s.targets.map((x) => [x, 0])));
  s.points = Array(s.n).fill(0);
  s.visits = [];
}

export function compute(config, actions) {
  const sides = sidesOf(config);
  const n = sides.length;
  const s = { n, sides, mode: config.mode || 'cricket', seq: config.mode === 'akyaka', targets: targetsOf(config), numbers: targetsOf(config), cut: isCut(config), legsWon: Array(n).fill(0), turns: Array(n).fill(0), legStarter: 0, side: 0, current: sides[0][0], leg: 1, legs: [], finished: false, winner: null, event: null, legOver: false };
  newLeg(s);
  for (const a of actions) applyVisit(s, config, a);
  return s;
}

const closedAll = (s, side) => s.targets.every((x) => s.marks[side][x] >= 3);

function legWinner(s) {
  for (let side = 0; side < s.n; side++) {
    if (!closedAll(s, side)) continue;
    const others = s.points.filter((_, i) => i !== side);
    if (s.cut ? others.every((o) => s.points[side] <= o) : others.every((o) => s.points[side] >= o)) return side;
  }
  return -1;
}

/** Apply `hits` marks on target `key` for `side`, worth `val` per extra mark. Returns counted marks. */
function mark(s, side, key, hits, val) {
  if (!(key in s.marks[side]) || hits <= 0) return 0;
  if (s.seq) {
    // Akyaka: only the next target in order counts; extra hits are wasted, there is no scoring
    if (key !== nextTarget(s, side)) return 0;
    const add = Math.min(hits, 3 - s.marks[side][key]);
    s.marks[side][key] += add;
    return add;
  }
  const cur = s.marks[side][key];
  const closeHits = Math.min(hits, Math.max(0, 3 - cur));
  const extra = hits - closeHits;
  s.marks[side][key] = Math.min(3, cur + hits);
  let counted = closeHits;
  if (extra > 0) {
    const open = [];
    for (let o = 0; o < s.n; o++) if (o !== side && s.marks[o][key] < 3) open.push(o);
    if (open.length) {
      counted += extra;
      if (s.cut) for (const o of open) s.points[o] += extra * val;
      else s.points[side] += extra * val;
    }
  }
  return counted;
}

function applyDart(s, side, d) {
  if (!d.n) return 0;
  let c = mark(s, side, d.n, d.m, d.n === 25 ? 25 : d.n);
  if (d.n !== 25 && d.m === 2) c += mark(s, side, 'D', 1, d.n * 2);
  if (d.n !== 25 && d.m === 3) c += mark(s, side, 'T', 1, d.n * 3);
  return c;
}

function applyVisit(s, config, a) {
  if (s.finished) return;
  const side = s.side, p = s.current;
  let marks = 0, used = 0, w = -1;
  for (const d of a.darts) {
    used++;
    marks += applyDart(s, side, d);
    w = legWinner(s);
    if (w >= 0) break;
  }
  s.visits.push({ p, s: side, darts: a.darts.slice(0, used), marks, dartsUsed: used });
  s.turns[side]++;
  s.event = null;
  if (w < 0 && config.rounds > 0) {
    const roundsDone = Math.floor(s.visits.length / s.n);
    if (s.visits.length % s.n === 0 && roundsDone >= config.rounds) {
      const progress = (i) => s.targets.reduce((a, x) => a + s.marks[i][x], 0);
      const sorted = s.points.map((pt, i) => [s.seq ? progress(i) : pt, i]).sort((x, y) => (s.cut ? x[0] - y[0] : y[0] - x[0]));
      w = sorted[0][1];
    }
  }
  if (w >= 0) {
    s.legs.push({ leg: s.leg, winner: w, visits: s.visits });
    s.legsWon[w]++;
    s.event = { type: 'leg', side: w, p };
    if (s.legsWon[w] >= config.legsToWin) { s.finished = true; s.winner = w; s.event = { type: 'match', side: w, p }; s.visits = []; return; }
    s.leg++;
    s.legStarter = (s.legStarter + 1) % s.n;
    s.side = s.legStarter;
    newLeg(s);
  } else s.side = (side + 1) % s.n;
  s.current = s.sides[s.side][s.turns[s.side] % s.sides[s.side].length];
}

/** Preview state for a partial visit (used by bots and live UI). */
export function preview(config, actions, partialDarts) {
  const s = compute(config, actions);
  if (!partialDarts.length) return s;
  const tmp = { ...s, marks: structuredClone(s.marks), points: [...s.points] };
  let legOver = false;
  for (const d of partialDarts) { applyDart(tmp, s.side, d); if (legWinner(tmp) >= 0) { legOver = true; break; } }
  return { ...tmp, legOver };
}

export function botAction(s, config, actions) {
  const pl = config.players[s.current];
  if (!pl.bot || s.finished) return null;
  return { darts: botCricketVisit(s, s.side, pl.bot, (partial) => preview(config, actions, partial)) };
}

export function stats(s, config) {
  const all = [...s.legs.flatMap((l) => l.visits), ...s.visits];
  return config.players.map((_, p) => {
    const mySide = s.sides.findIndex((sd) => sd.includes(p));
    let marks = 0, darts = 0, rounds = 0, t = 0, high = 0;
    for (const v of all) if (v.p === p) { marks += v.marks; darts += v.dartsUsed; rounds++; if (v.marks >= 5) t++; if (v.marks > high) high = v.marks; }
    return { marks, darts, rounds, mpr: rounds ? marks / rounds : 0, fivePlus: t, highMarks: high, legsWon: s.legsWon[mySide] };
  });
}
