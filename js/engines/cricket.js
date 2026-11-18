// Cricket engine: Cricket / Tactics / Fullboard / Akyaka with selectable scoring, solo or teams.
// Targets: numbers, 25 (bull), 'D' (double bed), 'T' (treble bed), 'H' (house = bullseye area).
import { botCricketVisit, botBullOff } from '../bot.js';
import { sidesOf } from '../teams.js';

const range = (a, b) => Array.from({ length: a - b + 1 }, (_, i) => a - i);
export const VARIANTS = {
  cricket: [...range(20, 15), 25],
  tactics: range(20, 10), // numbers only; a double adds 2 marks, a treble 3
  fullboard: [...range(20, 10), 'D', 'T', 'H'], // a double/treble on an active number is either number marks or 1 bed mark (player's choice); H: outer bull 1, inner bull 2
  akyaka: [...range(20, 15), 25], // sequential: only the next unclosed target counts, no points
};
export const NUMBERS = VARIANTS.cricket;

/* config = { mode: 'cricket'|'tactics'|'fullboard'|'akyaka', scoring, no1011, legsToWin, rounds (0 = unlimited), players, teams? }
   scoring (v1.0.5 offers three):
     none    = no penalty, first to close everything wins
     penalty = extra marks on a target you closed are penalty points for opponents who still have it open (lowest wins)
     master  = like penalty, but only doubles/trebles write penalty (a single never does): 2 marks on 20 + T20 = 40 penalty
   legacy (older matches): points = extra hits score for yourself (highest wins) · double = penalty ×2
   v1.0.8: config.selfScore = true (all new matches) -> penalty / master marks score for YOU instead (DartCounter style):
     close everything AND have at least as many points as every opponent to win; highest score wins.
   Round limit: when `rounds` complete without a winner the leg is decided by a bull-off
   (each side throws one dart at the bull, inner bull 50 > outer bull 25 > miss; a tie at the top throws again). */
export const SCORINGS = ['penalty', 'master', 'none'];
export const targetsOf = (config) => {
  const t = VARIANTS[config.mode || 'cricket'];
  return (config.mode === 'fullboard' || config.mode === 'tactics') && config.no1011 ? t.filter((x) => x !== 10 && x !== 11) : t;
};
export const scoringOf = (config) => {
  if (config.mode === 'akyaka') return 'none';
  if (config.scoring) return config.scoring;
  return config.cutthroat || config.variant === 'cutthroat' ? 'penalty' : 'points';
};
/** Fullboard: does a double/treble on number n need the number-or-bed choice? */
export const needsBedChoice = (s, d) => s.mode === 'fullboard' && d.m >= 2 && d.n !== 25 && d.n > 0 && d.n in s.marks[0];
/** Akyaka: the next target this side still has to close (in order). */
export const nextTarget = (s, side) => s.targets.find((x) => s.marks[side][x] < 3);

function newLeg(s) {
  s.marks = Array.from({ length: s.n }, () => Object.fromEntries(s.targets.map((x) => [x, 0])));
  s.points = Array(s.n).fill(0);
  s.visits = [];
  s.bulloff = null;
}

export function compute(config, actions) {
  const sides = sidesOf(config);
  const n = sides.length;
  const scoring = scoringOf(config);
  const s = { n, sides, mode: config.mode || 'cricket', seq: config.mode === 'akyaka', scoring, targets: targetsOf(config), numbers: targetsOf(config), cut: !config.selfScore && (scoring === 'penalty' || scoring === 'double' || scoring === 'master'), master: scoring === 'master', mult: scoring === 'double' ? 2 : 1, legsWon: Array(n).fill(0), turns: Array(n).fill(0), legStarter: (config.first || 0) % n, side: (config.first || 0) % n, current: sides[(config.first || 0) % n][0], leg: 1, legs: [], finished: false, winner: null, event: null, legOver: false, bulloff: null };
  newLeg(s);
  for (const a of actions) applyVisit(s, config, a);
  return s;
}

const closedAll = (s, side) => s.targets.every((x) => s.marks[side][x] >= 3);
/** Rounds completed in the current leg. */
export const roundsDone = (s) => Math.floor(s.visits.length / s.n);

function legWinner(s) {
  for (let side = 0; side < s.n; side++) {
    if (!closedAll(s, side)) continue;
    if (s.scoring === 'none') return side;
    const others = s.points.filter((_, i) => i !== side);
    if (s.cut ? others.every((o) => s.points[side] <= o) : others.every((o) => s.points[side] >= o)) return side;
  }
  return -1;
}

/** Apply `hits` marks on target `key` for `side`, worth `val` per extra mark; `dm` = the dart's multiplier. Returns counted marks. */
function mark(s, side, key, hits, val, dm = 1) {
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
  // master penalty: a single dart never writes penalty
  if (extra > 0 && s.scoring !== 'none' && !(s.master && dm < 2)) {
    const open = [];
    for (let o = 0; o < s.n; o++) if (o !== side && s.marks[o][key] < 3) open.push(o);
    if (open.length) {
      counted += extra;
      if (s.cut) for (const o of open) s.points[o] += extra * val * s.mult;
      else s.points[side] += extra * val;
    }
  }
  return counted;
}

function applyDart(s, side, d) {
  if (!d.n) return 0;
  if (s.mode === 'fullboard') {
    if (d.n === 25) return mark(s, side, 'H', d.m, 25, d.m); // outer bull 1 mark, inner bull 2 marks
    const active = d.n in s.marks[side];
    if (d.m >= 2 && (d.bed || !active)) return mark(s, side, d.m === 2 ? 'D' : 'T', 1, d.n * d.m, d.m);
    return mark(s, side, d.n, d.m, d.n, d.m);
  }
  if (s.mode === 'tactics') return mark(s, side, d.n, d.m, d.n, d.m);
  let c = mark(s, side, d.n, d.m, d.n === 25 ? 25 : d.n, d.m);
  if (d.n !== 25 && d.m === 2) c += mark(s, side, 'D', 1, d.n * 2, d.m);
  if (d.n !== 25 && d.m === 3) c += mark(s, side, 'T', 1, d.n * 3, d.m);
  if (d.n === 25 && d.m === 2) c += mark(s, side, 'H', 1, 50, d.m);
  return c;
}

/** Bull-off order for the given contenders, starting from the side that started the leg. */
function bulloffOrder(s, contenders) {
  return [...contenders].sort((a, b) => ((a - s.legStarter + s.n) % s.n) - ((b - s.legStarter + s.n) % s.n));
}

function setThrower(s) {
  s.current = s.sides[s.side][s.turns[s.side] % s.sides[s.side].length];
}

function endLeg(s, config, w, p) {
  s.legs.push({ leg: s.leg, winner: w, visits: s.visits, bulloff: s.bulloff?.history || null });
  s.legsWon[w]++;
  s.event = { type: 'leg', side: w, p, bulloff: !!s.bulloff };
  if (s.legsWon[w] >= config.legsToWin) { s.finished = true; s.winner = w; s.event = { type: 'match', side: w, p }; s.visits = []; return; }
  s.leg++;
  s.legStarter = (s.legStarter + 1) % s.n;
  s.side = s.legStarter;
  newLeg(s);
  setThrower(s);
}

function applyBullOff(s, config, a) {
  const b = s.bulloff;
  const v = a.bull === 50 ? 50 : a.bull === 25 ? 25 : 0;
  b.throws[s.side] = v;
  b.history.push({ s: s.side, p: s.current, v, r: b.round });
  s.turns[s.side]++;
  s.event = null;
  const idx = b.order.indexOf(s.side);
  if (idx < b.order.length - 1) { s.side = b.order[idx + 1]; setThrower(s); return; }
  // everyone threw: best dart wins, a tie at the top throws again
  const best = Math.max(...b.order.map((x) => b.throws[x]));
  const top = b.order.filter((x) => b.throws[x] === best);
  if (top.length === 1) return endLeg(s, config, top[0], s.current);
  b.order = bulloffOrder(s, top);
  b.throws = {};
  b.round++;
  s.event = { type: 'bulloffTie' };
  s.side = b.order[0];
  setThrower(s);
}

function applyVisit(s, config, a) {
  if (s.finished) return;
  if (s.bulloff) return applyBullOff(s, config, a);
  if (!a.darts) return;
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
  if (w >= 0) return endLeg(s, config, w, p);
  s.side = (side + 1) % s.n;
  setThrower(s);
  if (config.rounds > 0 && s.visits.length % s.n === 0 && roundsDone(s) >= config.rounds) {
    // round limit reached without a winner -> bull-off decides the leg
    const order = bulloffOrder(s, s.sides.map((_, i) => i));
    s.bulloff = { order, throws: {}, round: 1, history: [] };
    s.event = { type: 'bulloff' };
    s.side = order[0];
    setThrower(s);
  }
}

/** Preview state for a partial visit (used by bots and live UI). */
export function preview(config, actions, partialDarts) {
  const s = compute(config, actions);
  if (!partialDarts.length || s.bulloff) return s;
  const tmp = { ...s, marks: structuredClone(s.marks), points: [...s.points] };
  let legOver = false;
  for (const d of partialDarts) { applyDart(tmp, s.side, d); if (legWinner(tmp) >= 0) { legOver = true; break; } }
  return { ...tmp, legOver };
}

export function botAction(s, config, actions) {
  const pl = config.players[s.current];
  if (!pl.bot || s.finished) return null;
  if (s.bulloff) return { bull: botBullOff(pl.bot) };
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
