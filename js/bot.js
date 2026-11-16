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
    const t = cricketTarget(st, me);
    darts.push(throwAt(t, lv.sigma));
  }
  return darts;
}

function cricketTarget(st, me) {
  const nums = st.numbers;
  const aim = (n) => (n === 25 ? { n: 25, m: 2 } : { n, m: 3 });
  const others = st.marks.map((_, i) => i).filter((i) => i !== me);
  const someOpen = (n) => others.some((o) => st.marks[o][n] < 3);
  const oppPts = others.map((o) => st.points[o]);
  const cut = st.variant === 'cutthroat';
  // Behind on points (standard: below the leader; cut-throat: not the lowest) -> score on a number I own.
  const behind = cut ? st.points[me] > Math.min(...oppPts) : st.points[me] < Math.max(...oppPts);
  if (behind) {
    const scoring = nums.find((n) => st.marks[me][n] >= 3 && someOpen(n));
    if (scoring) return aim(scoring);
  }
  // Otherwise close the highest number still live for scoring, then any remaining (dead) number.
  const live = nums.find((n) => st.marks[me][n] < 3 && someOpen(n));
  if (live) return aim(live);
  const rest = nums.find((n) => st.marks[me][n] < 3);
  if (rest) return aim(rest);
  return aim(nums.find((n) => someOpen(n)) || 20);
}

export { dartValue };
