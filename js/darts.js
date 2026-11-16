// Core darts logic: board geometry, dart values, checkout routes, visit evaluation.

export const BOARD_ORDER = [20, 1, 18, 4, 13, 6, 10, 15, 2, 17, 3, 19, 7, 16, 8, 11, 14, 9, 12, 5];

// Board radii in mm (standard regulation board)
export const R = { bull: 6.35, outerBull: 15.9, trebleIn: 99, trebleOut: 107, doubleIn: 162, doubleOut: 170 };

export const IMPOSSIBLE_VISITS = new Set([163, 166, 169, 172, 173, 175, 176, 178, 179]);
export const BOGEY = new Set([169, 168, 166, 165, 163, 162, 159]);

/** A dart is {n, m}: n in 0 (miss), 1..20, 25 ; m in 1..3 (bull only 1..2) */
export const dartValue = (d) => (d.n === 0 ? 0 : d.n * d.m);

export function dartLabel(d) {
  if (!d || d.n === 0) return 'Miss';
  if (d.n === 25) return d.m === 2 ? 'Bull' : '25';
  if (d.m === 3) return 'T' + d.n;
  if (d.m === 2) return 'D' + d.n;
  return String(d.n);
}

export function isValidVisitScore(s) {
  return Number.isInteger(s) && s >= 0 && s <= 180 && !IMPOSSIBLE_VISITS.has(s);
}

const isFinishDart = (d, out) =>
  out === 'straight' ? true : out === 'master' ? d.m >= 2 : d.m === 2;

/** Is `rem` finishable with a single dart under the out-rule? */
export function isOneDartFinish(rem, out = 'double') {
  if (out === 'straight') return (rem >= 1 && rem <= 20) || rem === 25 || rem === 50 || (rem <= 60 && (rem % 2 === 0 && rem <= 40 || rem % 3 === 0));
  if (out === 'master') return (rem <= 40 && rem % 2 === 0 && rem > 0) || rem === 50 || (rem <= 60 && rem % 3 === 0 && rem > 0);
  return (rem <= 40 && rem % 2 === 0 && rem > 0) || rem === 50;
}

// ---------- Checkout table ----------
const ALL_DARTS = [];
for (let n = 1; n <= 20; n++) for (let m = 1; m <= 3; m++) ALL_DARTS.push({ n, m });
ALL_DARTS.push({ n: 25, m: 1 }, { n: 25, m: 2 });

const DOUBLE_PREF = [20, 16, 18, 8, 10, 12, 4, 14, 6, 2, 25, 19, 17, 15, 13, 11, 9, 7, 5, 3, 1];

function finishPenalty(d) {
  const rank = DOUBLE_PREF.indexOf(d.n);
  const base = d.m === 2 ? 0 : d.m === 3 ? 6 : 8;
  return base + (rank < 0 ? 10 : rank * 0.7);
}
const TREBLE_PEN = { 20: 1, 19: 1.2, 18: 1.6, 17: 1.9, 16: 2.2, 15: 2.6 };
function setupPenalty(d) {
  if (d.n === 25) return d.m === 2 ? 6 : 3.5;
  if (d.m === 1) return 0.4 + (20 - d.n) * 0.01;
  if (d.m === 3) return TREBLE_PEN[d.n] ?? 3.2 + (15 - d.n) * 0.05;
  return 4.5;
}

const tables = {};
function buildTable(out) {
  // bestSingle[sum] / bestPair[sum] for setup darts
  const bestSingle = new Map();
  for (const d of ALL_DARTS) {
    const v = dartValue(d), p = setupPenalty(d);
    const cur = bestSingle.get(v);
    if (!cur || p < cur.p) bestSingle.set(v, { darts: [d], p });
  }
  const bestPair = new Map();
  for (const a of ALL_DARTS) for (const b of ALL_DARTS) {
    const v = dartValue(a) + dartValue(b);
    const p = setupPenalty(a) + setupPenalty(b);
    const cur = bestPair.get(v);
    // order highest value first, prefer that
    const pair = dartValue(a) >= dartValue(b) ? [a, b] : [b, a];
    if (!cur || p < cur.p) bestPair.set(v, { darts: pair, p });
  }
  const finishers = ALL_DARTS.filter((d) => isFinishDart(d, out));
  // table[k][v] = best route with exactly <= k darts
  const t = { 1: {}, 2: {}, 3: {} };
  for (let v = 2; v <= 180; v++) {
    let b1 = null, b2 = null, b3 = null;
    for (const f of finishers) {
      const fv = dartValue(f), fp = finishPenalty(f);
      const rest = v - fv;
      if (rest === 0) { if (!b1 || fp < b1.p) b1 = { darts: [f], p: fp }; continue; }
      if (rest < 0) continue;
      const s = bestSingle.get(rest);
      if (s && (!b2 || s.p + fp < b2.p)) b2 = { darts: [...s.darts, f], p: s.p + fp };
      const pr = bestPair.get(rest);
      if (pr && (!b3 || pr.p + fp < b3.p)) b3 = { darts: [...pr.darts, f], p: pr.p + fp };
    }
    t[1][v] = b1 ? b1.darts : null;
    t[2][v] = b1 ? b1.darts : b2 ? b2.darts : null;
    t[3][v] = b1 ? b1.darts : b2 ? b2.darts : b3 ? b3.darts : null;
  }
  // Classic chart overrides for double-out where taste matters
  if (out === 'double') {
    const C = (s) => s.split(' ').map(parseLabel);
    const overrides = { 170: 'T20 T20 Bull', 167: 'T20 T19 Bull', 164: 'T20 T18 Bull', 161: 'T20 T17 Bull', 160: 'T20 T20 D20', 100: 'T20 D20', 50: 'Bull', 41: '9 D16', 49: '17 D16', 57: '17 D20', 81: 'T19 D12', 82: 'Bull D16', 62: 'T10 D16', 63: 'T13 D12', 61: 'T15 D8', 87: 'T17 D18', 84: 'T20 D12', 101: 'T17 Bull', 110: 'T20 Bull' };
    for (const [v, r] of Object.entries(overrides)) {
      const route = C(r);
      t[route.length >= 3 ? 3 : route.length === 2 ? 2 : 1][v] = route;
      if (route.length <= 2) t[3][v] = route;
      if (route.length === 1) t[2][v] = route;
    }
  }
  return t;
}

export function parseLabel(s) {
  if (s === 'Bull') return { n: 25, m: 2 };
  if (s === '25') return { n: 25, m: 1 };
  if (s[0] === 'T') return { n: +s.slice(1), m: 3 };
  if (s[0] === 'D') return { n: +s.slice(1), m: 2 };
  return { n: +s, m: 1 };
}

/** Best checkout route (array of darts) for `rem` within `dartsLeft` darts, or null. */
export function checkoutRoute(rem, dartsLeft = 3, out = 'double') {
  if (rem < 1 || rem > 180 || dartsLeft < 1) return null;
  if (!tables[out]) tables[out] = buildTable(out);
  return tables[out][Math.min(3, dartsLeft)][rem] || null;
}

export function minCheckoutDarts(rem, out = 'double') {
  for (let k = 1; k <= 3; k++) if (checkoutRoute(rem, k, out)) return k;
  return null;
}

// ---------- Visit evaluation ----------
/**
 * Evaluate darts thrown from `before` remaining.
 * rules: {in, out}. opened: has the player already "doubled in".
 */
export function evaluateDarts(before, darts, rules, opened = true) {
  let rem = before, dbl = 0, isOpened = opened;
  for (let i = 0; i < darts.length; i++) {
    const d = darts[i];
    if (rules.out !== 'straight' && isOneDartFinish(rem, rules.out)) dbl++;
    if (!isOpened) {
      if (rules.in === 'straight' || (rules.in === 'double' && d.m === 2 && d.n) || (rules.in === 'master' && d.m >= 2 && d.n)) isOpened = true;
      else continue;
    }
    const nr = rem - dartValue(d);
    if (nr < 0 || (nr === 1 && rules.out !== 'straight')) return { bust: true, score: 0, dartsUsed: i + 1, dbl, opened: isOpened, checkout: false };
    if (nr === 0) {
      if (isFinishDart(d, rules.out)) return { bust: false, score: before, dartsUsed: i + 1, dbl, opened: isOpened, checkout: true };
      return { bust: true, score: 0, dartsUsed: i + 1, dbl, opened: isOpened, checkout: false };
    }
    rem = nr;
  }
  return { bust: false, score: before - rem, dartsUsed: darts.length, dbl, opened: isOpened, checkout: false };
}

// ---------- Throw simulation (for bots) ----------
export function aimPoint(d) {
  if (!d || d.n === 25 || d.n === 0) return [0, 0];
  const idx = BOARD_ORDER.indexOf(d.n);
  const ang = (idx * 18) * Math.PI / 180;
  const r = d.m === 3 ? 103 : d.m === 2 ? 166 : 135;
  return [Math.sin(ang) * r, Math.cos(ang) * r];
}

export function segmentAt(x, y) {
  const r = Math.hypot(x, y);
  if (r <= R.bull) return { n: 25, m: 2 };
  if (r <= R.outerBull) return { n: 25, m: 1 };
  if (r > R.doubleOut) return { n: 0, m: 1 };
  const ang = ((Math.atan2(x, y) * 180) / Math.PI + 360) % 360;
  const n = BOARD_ORDER[Math.floor(((ang + 9) % 360) / 18)];
  if (r > R.trebleIn && r <= R.trebleOut) return { n, m: 3 };
  if (r > R.doubleIn) return { n, m: 2 };
  return { n, m: 1 };
}

export function gauss() {
  let u = 0, v = 0;
  while (u === 0) u = Math.random();
  while (v === 0) v = Math.random();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

export function throwAt(target, sigma) {
  const [ax, ay] = aimPoint(target);
  return segmentAt(ax + gauss() * sigma, ay + gauss() * sigma);
}

// Seeded RNG (mulberry32) for reproducible training sequences
export function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const uid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);
