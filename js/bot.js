// CPU opponents. Each level maps to a throwing spread (mm, std-dev) calibrated to an approximate 3-dart average.
import { checkoutRoute, evaluateDarts, throwAt, dartValue } from './darts.js';

export const BOT_LEVELS = [
  // sigma: scoring spread (mm), dsig: spread on doubles/bull, avg: simulated 501 3-dart average (120 legs each)
  { level: 1, sigma: 70, dsig: 14, avg: 25 },
  { level: 2, sigma: 48, dsig: 13, avg: 31 },
  { level: 3, sigma: 33, dsig: 11, avg: 38 },
  { level: 4, sigma: 24, dsig: 9, avg: 44 },
  { level: 5, sigma: 18, dsig: 8, avg: 54 },
  { level: 6, sigma: 15, dsig: 7, avg: 62 },
  { level: 7, sigma: 12.5, dsig: 6.5, avg: 69 },
  { level: 8, sigma: 10.5, dsig: 6, avg: 78 },
  { level: 9, sigma: 9, dsig: 5.5, avg: 87 },
  { level: 10, sigma: 7, dsig: 4.8, avg: 97 },
  { level: 11, sigma: 6, dsig: 4.2, avg: 107 },
];
// Cricket bots throw with a slightly wider spread so marks-per-round stays realistic (world class ≈ 4 MPR).
export const CRICKET_SPREAD = 1.3;
// Approximate Cricket marks-per-round for each level (simulated, bot vs same level)
export const CRICKET_MPR = [0.5, 0.75, 1.2, 1.5, 1.9, 2.2, 2.5, 3.1, 3.5, 4.2, 4.6];

export const botLevel = (level) => BOT_LEVELS.find((l) => l.level === level) || BOT_LEVELS[4];
export const botSigma = (level) => botLevel(level).sigma;
// Finishing darts (doubles / bull) use a tighter spread so weak bots still close legs in reasonable time.
const sigmaFor = (lv, target) => (target.m === 2 || target.n === 25 ? lv.dsig : lv.sigma);

const PREF_DOUBLES = [20, 16, 18, 8, 10, 12, 4, 14, 6, 2];

function x01Target(rem, dartsLeft, rules, opened) {
  if (!opened && rules.in !== 'straight') return { n: 20, m: 2 };
  if (rem <= 180) {
    const route = checkoutRoute(rem, dartsLeft, rules.out);
    if (route) return route[0];
  }
  if (rules.out === 'straight') return { n: 20, m: 3 };
  if (rem <= 60) {
    for (const d of PREF_DOUBLES) {
      const s = rem - 2 * d;
      if (s >= 1 && s <= 20) return { n: s, m: 1 };
    }
    if (rem > 40) return { n: rem - 40 <= 20 ? rem - 40 : 20, m: 1 };
  }
  if (rem - 60 >= 2 && rem - 60 !== 1) return { n: 20, m: 3 };
  if (rem - 57 >= 2) return { n: 19, m: 3 };
  return { n: 20, m: 1 };
}

/** Simulate a full X01 visit for a bot. Returns darts array. */
export function botX01Visit(rem, rules, opened, level) {
  const lv = botLevel(level);
  const darts = [];
  let r = rem, op = opened;
  for (let i = 0; i < 3; i++) {
    const target = x01Target(r, 3 - i, rules, op);
    const d = throwAt(target, sigmaFor(lv, target));
    darts.push(d);
    const ev = evaluateDarts(rem, darts, rules, opened);
    if (ev.bust || ev.checkout) break;
    r = rem - ev.score;
    op = ev.opened;
  }
  return darts;
}

/** Cricket target choice. state: {marks, points}, me index, numbers list. */
export function botCricketVisit(cr, me, level, simulate) {
  const lv = botLevel(level);
  const darts = [];
  for (let i = 0; i < 3; i++) {
    const st = simulate(darts); // state after darts so far
    if (st.legOver) break;
    const target = cricketKey(st, me);
    const t = aimFor(st, me, target);
    const d = throwAt(t, lv.sigma * CRICKET_SPREAD);
    // Fullboard: a double/treble on an active number goes to the bed when the number itself is already closed
    if (st.mode === 'fullboard' && d.m >= 2 && d.n !== 25 && d.n in st.marks[me]) {
      const bed = d.m === 2 ? 'D' : 'T';
      d.bed = st.marks[me][d.n] >= 3 ? st.marks[me][bed] < 3 : (t.n === d.n && t.m === d.m && target === bed);
    }
    darts.push(d);
  }
  return darts;
}

function aimFor(st, me, key) {
  const nums = st.numbers.filter((x) => typeof x === 'number' && x !== 25);
  // Fullboard: aim the bed at a number I already closed so the dart is booked on the bed;
  // other modes: aim at a number I still need so one dart counts twice.
  const bedNumber = () => (st.mode === 'fullboard' ? nums.find((x) => st.marks[me][x] >= 3) : nums.find((x) => st.marks[me][x] < 3)) || 20;
  if (key === 25 || key === 'H') return { n: 25, m: 2 };
  if (key === 'D') return { n: bedNumber(), m: 2 };
  if (key === 'T') return { n: bedNumber(), m: 3 };
  return { n: key, m: 3 };
}

/** Which target the bot goes for next. */
function cricketKey(st, me) {
  const keys = st.numbers;
  const others = st.marks.map((_, i) => i).filter((i) => i !== me);
  const someOpen = (k) => others.some((o) => st.marks[o][k] < 3);
  if (st.seq) return keys.find((x) => st.marks[me][x] < 3) ?? 25;
  const oppPts = others.map((o) => st.points[o]);
  const cut = !!st.cut;
  // Behind on points (classic: below the leader; penalty: not the lowest) -> score on a target I own.
  const behind = st.scoring !== 'none' && (cut ? st.points[me] > Math.min(...oppPts) : st.points[me] < Math.max(...oppPts));
  if (behind) {
    const scoring = keys.find((k) => st.marks[me][k] >= 3 && someOpen(k));
    if (scoring !== undefined) return scoring;
  }
  // Otherwise close the highest target still live, then any remaining (dead) one.
  const live = keys.find((k) => st.marks[me][k] < 3 && someOpen(k));
  if (live !== undefined) return live;
  const rest = keys.find((k) => st.marks[me][k] < 3);
  if (rest !== undefined) return rest;
  return keys.find((k) => someOpen(k)) ?? 20;
}
export { dartValue };

/** Bull-off dart for a bot: 50 (inner bull), 25 (outer bull) or 0. */
export function botBullOff(level) {
  const d = throwAt({ n: 25, m: 2 }, botLevel(level).dsig * 1.6);
  return d.n === 25 ? (d.m === 2 ? 50 : 25) : 0;
}
