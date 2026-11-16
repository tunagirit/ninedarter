// Cricket engine (standard & cut-throat), replay based.
import { botCricketVisit } from '../bot.js';

export const NUMBERS = [20, 19, 18, 17, 16, 15, 25];

/* config = { variant: 'standard'|'cutthroat', legsToWin: 1, rounds: 0 (unlimited), players } */

function newLeg(s) {
  s.marks = Array.from({ length: s.n }, () => Object.fromEntries(NUMBERS.map((x) => [x, 0])));
  s.points = Array(s.n).fill(0);
  s.visits = [];
}

export function compute(config, actions) {
  const n = config.players.length;
  const s = { n, numbers: NUMBERS, variant: config.variant, legsWon: Array(n).fill(0), legStarter: 0, current: 0, leg: 1, legs: [], finished: false, winner: null, event: null, legOver: false };
  newLeg(s);
  for (const a of actions) applyVisit(s, config, a);
  return s;
}

const closedAll = (s, p) => NUMBERS.every((x) => s.marks[p][x] >= 3);

function legWinner(s, config) {
  for (let p = 0; p < s.n; p++) {
    if (!closedAll(s, p)) continue;
    const others = s.points.filter((_, i) => i !== p);
    if (config.variant === 'cutthroat' ? others.every((o) => s.points[p] <= o) : others.every((o) => s.points[p] >= o)) return p;
  }
  return -1;
}

function applyDart(s, config, p, d) {
  if (!NUMBERS.includes(d.n)) return 0;
  const val = d.n === 25 ? 25 : d.n;
  const cur = s.marks[p][d.n];
  const closeHits = Math.min(d.m, Math.max(0, 3 - cur));
  const extra = d.m - closeHits;
  s.marks[p][d.n] = Math.min(3, cur + d.m);
  let counted = closeHits;
  if (extra > 0) {
    const open = [];
    for (let o = 0; o < s.n; o++) if (o !== p && s.marks[o][d.n] < 3) open.push(o);
    if (open.length) {
      counted += extra;
      if (config.variant === 'cutthroat') for (const o of open) s.points[o] += extra * val;
      else s.points[p] += extra * val;
    }
  }
  return counted;
}

function applyVisit(s, config, a) {
  if (s.finished) return;
  const p = s.current;
  let marks = 0, used = 0, w = -1;
  for (const d of a.darts) {
    used++;
    marks += applyDart(s, config, p, d);
    w = legWinner(s, config);
    if (w >= 0) break;
  }
  s.visits.push({ p, darts: a.darts.slice(0, used), marks, dartsUsed: used });
  s.event = null;
  // round limit
  if (w < 0 && config.rounds > 0) {
    const roundsDone = Math.floor(s.visits.length / s.n);
    if (s.visits.length % s.n === 0 && roundsDone >= config.rounds) {
      const sorted = s.points.map((pt, i) => [pt, i]).sort((x, y) => (config.variant === 'cutthroat' ? x[0] - y[0] : y[0] - x[0]));
      w = sorted[0][1];
    }
  }
  if (w >= 0) {
    s.legs.push({ leg: s.leg, winner: w, visits: s.visits });
    s.legsWon[w]++;
    s.event = { type: 'leg', p: w };
    if (s.legsWon[w] >= config.legsToWin) { s.finished = true; s.winner = w; s.event = { type: 'match', p: w }; s.visits = []; return; }
    s.leg++;
    s.legStarter = (s.legStarter + 1) % s.n;
    s.current = s.legStarter;
    newLeg(s);
  } else s.current = (p + 1) % s.n;
}

/** Preview state for a partial visit (used by bots and live UI). */
export function preview(config, actions, partialDarts) {
  const s = compute(config, actions);
  if (!partialDarts.length) return s;
  const p = s.current;
  const st = structuredClone({ marks: s.marks, points: s.points });
  const tmp = { ...s, marks: st.marks, points: st.points };
  let legOver = false;
  for (const d of partialDarts) { applyDart(tmp, config, p, d); if (legWinner(tmp, config) >= 0) { legOver = true; break; } }
  return { ...tmp, legOver };
}

export function botAction(s, config, actions) {
  const pl = config.players[s.current];
  if (!pl.bot || s.finished) return null;
  const darts = botCricketVisit(s, s.current, pl.bot, (partial) => preview(config, actions, partial));
  return { darts };
}

export function stats(s, config) {
  const all = [...s.legs.flatMap((l) => l.visits), ...s.visits];
  return config.players.map((_, p) => {
    let marks = 0, darts = 0, rounds = 0, t = 0, high = 0;
    for (const v of all) if (v.p === p) { marks += v.marks; darts += v.dartsUsed; rounds++; if (v.marks >= 5) t++; if (v.marks > high) high = v.marks; }
    return { marks, darts, rounds, mpr: rounds ? marks / rounds : 0, fivePlus: t, highMarks: high, legsWon: s.legsWon[p] };
  });
}
