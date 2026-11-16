// X01 engine with solo and team play. State is derived by replaying an action log -> undo is trivial.
// Scores, legs and sets belong to sides (a player or a team); visits are attributed to the thrower.
import { evaluateDarts } from '../darts.js';
import { botX01Visit } from '../bot.js';
import { sidesOf } from '../teams.js';

/*
config = {
  start: 501, in: 'straight'|'double'|'master', out: 'double'|'straight'|'master',
  sets: false, setsToWin: 1, legsToWin: 3, // legsToWin = legs per set when sets=true
  players: [{id, name, hue, shape, bot?: level}], teams?: [[playerIdx...], ...]
}
action = { darts?: [{n,m}], score?: number, dartsUsed?: 1..3, dbl?: 0..3 }
*/

export function compute(config, actions) {
  const sides = sidesOf(config);
  const n = sides.length;
  const rules = { in: config.in, out: config.out };
  const s = {
    n, sides, rules,
    remaining: Array(n).fill(config.start),
    opened: Array(n).fill(config.in === 'straight'),
    legsWon: Array(n).fill(0),
    setsWon: Array(n).fill(0),
    totalLegsWon: Array(n).fill(0),
    turns: Array(n).fill(0), // visits thrown by each side (drives rotation inside a team)
    legStarter: 0, setStarter: 0, side: 0, current: sides[0][0],
    set: 1, leg: 1,
    visits: [], legs: [],
    finished: false, winner: null, event: null,
  };
  for (const a of actions) applyVisit(s, config, a);
  return s;
}

const thrower = (s, side) => s.sides[side][s.turns[side] % s.sides[side].length];

function applyVisit(s, config, a) {
  if (s.finished) return;
  const side = s.side, p = s.current;
  const before = s.remaining[side];
  let v;
  if (a.darts) {
    const ev = evaluateDarts(before, a.darts, s.rules, s.opened[side]);
    s.opened[side] = ev.opened;
    v = { p, s: side, before, score: ev.score, bust: ev.bust, checkout: ev.checkout, dartsUsed: ev.dartsUsed, dbl: ev.dbl, darts: a.darts };
  } else {
    const sc = a.score;
    const after = before - sc;
    const bust = after < 0 || (after === 1 && s.rules.out !== 'straight');
    const checkout = !bust && after === 0;
    if (sc > 0) s.opened[side] = true;
    const dbl = a.dbl ?? (checkout ? 1 : 0);
    v = { p, s: side, before, score: bust ? 0 : sc, raw: sc, bust, checkout, dartsUsed: checkout ? (a.dartsUsed || 3) : 3, dbl };
  }
  s.visits.push(v);
  s.turns[side]++;
  s.event = null;
  if (!v.bust) s.remaining[side] = before - v.score;
  if (v.checkout) {
    s.legs.push({ set: s.set, leg: s.leg, winner: side, starter: s.legStarter, visits: s.visits });
    s.legsWon[side]++; s.totalLegsWon[side]++;
    s.event = { type: 'leg', side, p };
    let newSet = false;
    if (config.sets) {
      if (s.legsWon[side] >= config.legsToWin) {
        s.setsWon[side]++; s.event = { type: 'set', side, p }; newSet = true;
        if (s.setsWon[side] >= config.setsToWin) return finish(s, side, p);
      }
    } else if (s.legsWon[side] >= config.legsToWin) return finish(s, side, p);
    if (newSet) {
      s.legsWon = Array(s.n).fill(0);
      s.set++; s.leg = 1;
      s.setStarter = (s.setStarter + 1) % s.n;
      s.legStarter = s.setStarter;
    } else {
      s.leg++;
      s.legStarter = (s.legStarter + 1) % s.n;
    }
    s.side = s.legStarter;
    s.remaining = Array(s.n).fill(config.start);
    s.opened = Array(s.n).fill(config.in === 'straight');
    s.visits = [];
  } else {
    s.side = (side + 1) % s.n;
  }
  s.current = thrower(s, s.side);
}

function finish(s, side, p) {
  s.finished = true; s.winner = side; s.event = { type: 'match', side, p };
  s.visits = []; // last leg is archived in s.legs
}

export function botAction(s, config) {
  const pl = config.players[s.current];
  if (!pl.bot || s.finished) return null;
  return { darts: botX01Visit(s.remaining[s.side], s.rules, s.opened[s.side], pl.bot) };
}

/** Per-player statistics for the whole match (by thrower). */
export function stats(s, config) {
  const allLegs = [...s.legs, ...(s.visits.length ? [{ visits: s.visits, winner: null }] : [])];
  return config.players.map((_, p) => {
    const mySide = s.sides.findIndex((sd) => sd.includes(p));
    const st = { points: 0, darts: 0, f9points: 0, f9darts: 0, t180: 0, t140: 0, t100: 0, t60: 0, high: 0, hiCo: 0, checkouts: 0, dblDarts: 0, bestLeg: null, legsWon: s.totalLegsWon[mySide], busts: 0, visits: 0 };
    for (const leg of allLegs) {
      let k = 0, legDarts = 0;
      for (const v of leg.visits) {
        if (v.s === mySide) legDarts += v.dartsUsed;
        if (v.p !== p) continue;
        st.points += v.score; st.darts += v.dartsUsed; st.visits++;
        if (k < 3) { st.f9points += v.score; st.f9darts += v.dartsUsed; }
        k++;
        const sc = v.score;
        if (sc === 180) st.t180++; else if (sc >= 140) st.t140++; else if (sc >= 100) st.t100++; else if (sc >= 60) st.t60++;
        if (sc > st.high) st.high = sc;
        if (v.bust) st.busts++;
        st.dblDarts += v.dbl || 0;
        if (v.checkout) { st.checkouts++; if (v.score > st.hiCo) st.hiCo = v.score; }
      }
      if (leg.winner === mySide && st.visits && (st.bestLeg === null || legDarts < st.bestLeg)) st.bestLeg = legDarts;
    }
    st.avg = st.darts ? (st.points / st.darts) * 3 : 0;
    st.f9avg = st.f9darts ? (st.f9points / st.f9darts) * 3 : 0;
    st.coPct = st.dblDarts ? (st.checkouts / st.dblDarts) * 100 : 0;
    return st;
  });
}

/** Current-leg average / darts for a side */
export function sideAvg(s, side) {
  let pts = 0, d = 0;
  for (const v of s.visits) if (v.s === side) { pts += v.score; d += v.dartsUsed; }
  return d ? (pts / d) * 3 : 0;
}
export function sideDarts(s, side) {
  let d = 0; for (const v of s.visits) if (v.s === side) d += v.dartsUsed; return d;
}
/** Match average for a side across all visits */
export function sideMatchAvg(s, side) {
  let pts = 0, d = 0;
  for (const leg of [...s.legs, { visits: s.visits }]) for (const v of leg.visits) if (v.s === side) { pts += v.score; d += v.dartsUsed; }
  return d ? (pts / d) * 3 : 0;
}
