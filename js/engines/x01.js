// X01 engine. State is derived by replaying an action log -> undo is trivial.
import { evaluateDarts, isOneDartFinish } from '../darts.js';
import { botX01Visit } from '../bot.js';

/*
config = {
  start: 501, in: 'straight'|'double'|'master', out: 'double'|'straight'|'master',
  sets: false, setsToWin: 1, legsToWin: 3, // legsToWin = legs per set when sets=true
  players: [{id, name, hue, shape, bot?: level}]
}
action = { darts?: [{n,m}], score?: number, dartsUsed?: 1..3, dbl?: 0..3 }
*/

export function compute(config, actions) {
  const n = config.players.length;
  const rules = { in: config.in, out: config.out };
  const s = {
    n, rules,
    remaining: Array(n).fill(config.start),
    opened: Array(n).fill(config.in === 'straight'),
    legsWon: Array(n).fill(0),
    setsWon: Array(n).fill(0),
    totalLegsWon: Array(n).fill(0),
    legStarter: 0, setStarter: 0, current: 0,
    set: 1, leg: 1,
    visits: [], // current leg visits
    legs: [], // finished legs
    finished: false, winner: null,
    event: null, // last notable event {type: 'leg'|'set'|'match', p}
  };
  for (const a of actions) applyVisit(s, config, a);
  return s;
}

function applyVisit(s, config, a) {
  if (s.finished) return;
  const p = s.current;
  const before = s.remaining[p];
  let v;
  if (a.darts) {
    const ev = evaluateDarts(before, a.darts, s.rules, s.opened[p]);
    s.opened[p] = ev.opened;
    v = { p, before, score: ev.score, bust: ev.bust, checkout: ev.checkout, dartsUsed: ev.dartsUsed, dbl: ev.dbl, darts: a.darts };
  } else {
    const sc = a.score;
    const after = before - sc;
    const bust = after < 0 || (after === 1 && s.rules.out !== 'straight');
    const checkout = !bust && after === 0;
    if (sc > 0) s.opened[p] = true;
    const dbl = a.dbl ?? (checkout ? 1 : 0);
    v = { p, before, score: bust ? 0 : sc, raw: sc, bust, checkout, dartsUsed: checkout ? (a.dartsUsed || 3) : 3, dbl };
  }
  s.visits.push(v);
  s.event = null;
  if (!v.bust) s.remaining[p] = before - v.score;
  if (v.checkout) {
    s.legs.push({ set: s.set, leg: s.leg, winner: p, starter: s.legStarter, visits: s.visits });
    s.legsWon[p]++; s.totalLegsWon[p]++;
    s.event = { type: 'leg', p };
    let newSet = false;
    if (config.sets) {
      if (s.legsWon[p] >= config.legsToWin) {
        s.setsWon[p]++; s.event = { type: 'set', p }; newSet = true;
        if (s.setsWon[p] >= config.setsToWin) return finish(s, p);
      }
    } else if (s.legsWon[p] >= config.legsToWin) return finish(s, p);
    // next leg
    if (newSet) {
      s.legsWon = Array(s.n).fill(0);
      s.set++; s.leg = 1;
      s.setStarter = (s.setStarter + 1) % s.n;
      s.legStarter = s.setStarter;
    } else {
      s.leg++;
      s.legStarter = (s.legStarter + 1) % s.n;
    }
    s.current = s.legStarter;
    s.remaining = Array(s.n).fill(config.start);
    s.opened = Array(s.n).fill(config.in === 'straight');
    s.visits = [];
  } else {
    s.current = (p + 1) % s.n;
  }
}

function finish(s, p) {
  s.finished = true; s.winner = p; s.event = { type: 'match', p };
  s.visits = []; // last leg is archived in s.legs
}

/** Whether the keypad UI should ask "darts at double" for this remaining. */
export const shouldAskDouble = (rem, out) => out !== 'straight' && rem <= 50 && isOneDartFinishReachable(rem, out);
function isOneDartFinishReachable(rem, out) {
  // any remaining <= 50 (not 1) where a double could be attempted within the visit
  return rem >= 2 && (out === 'double' || out === 'master');
}

export function botAction(s, config) {
  const pl = config.players[s.current];
  if (!pl.bot || s.finished) return null;
  return { darts: botX01Visit(s.remaining[s.current], s.rules, s.opened[s.current], pl.bot) };
}

/** Per-player statistics for the whole match. */
export function stats(s, config) {
  const allLegs = [...s.legs, ...(s.visits.length ? [{ visits: s.visits, winner: null }] : [])];
  return config.players.map((_, p) => {
    const st = { points: 0, darts: 0, f9points: 0, f9darts: 0, t180: 0, t140: 0, t100: 0, t60: 0, high: 0, hiCo: 0, checkouts: 0, dblDarts: 0, bestLeg: null, legsWon: s.totalLegsWon[p], busts: 0, visits: 0 };
    for (const leg of allLegs) {
      let k = 0, legDarts = 0;
      for (const v of leg.visits) {
        if (v.p !== p) continue;
        st.points += v.score; st.darts += v.dartsUsed; legDarts += v.dartsUsed; st.visits++;
        if (k < 3) { st.f9points += v.score; st.f9darts += v.dartsUsed; }
        k++;
        const sc = v.score;
        if (sc === 180) st.t180++; else if (sc >= 140) st.t140++; else if (sc >= 100) st.t100++; else if (sc >= 60) st.t60++;
        if (sc > st.high) st.high = sc;
        if (v.bust) st.busts++;
        st.dblDarts += v.dbl || 0;
        if (v.checkout) { st.checkouts++; if (v.score > st.hiCo) st.hiCo = v.score; }
      }
      if (leg.winner === p && (st.bestLeg === null || legDarts < st.bestLeg)) st.bestLeg = legDarts;
    }
    st.avg = st.darts ? (st.points / st.darts) * 3 : 0;
    st.f9avg = st.f9darts ? (st.f9points / st.f9darts) * 3 : 0;
    st.coPct = st.dblDarts ? (st.checkouts / st.dblDarts) * 100 : 0;
    return st;
  });
}

/** Current-leg average for a player */
export function legAvg(s, p) {
  let pts = 0, d = 0;
  for (const v of s.visits) if (v.p === p) { pts += v.score; d += v.dartsUsed; }
  return d ? (pts / d) * 3 : 0;
}
export function legDarts(s, p) {
  let d = 0; for (const v of s.visits) if (v.p === p) d += v.dartsUsed; return d;
}
