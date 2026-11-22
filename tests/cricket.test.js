// Cricket puan motoru testleri — çalıştır: npm test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { compute, targetsOf, nextTarget } from '../js/engines/cricket.js';

const P = (n) => Array.from({ length: n }, (_, i) => ({ id: 'p' + i, name: 'P' + i }));
const cfg = (o = {}) => ({ mode: 'cricket', scoring: 'none', legsToWin: 1, players: P(2), ...o });
const T = (n) => ({ n, m: 3 }), S = (n) => ({ n, m: 1 });
const BULL = { n: 25, m: 1 }, DBULL = { n: 25, m: 2 }, MISS = { n: 0, m: 1 };
const PASS = { darts: [MISS, MISS, MISS] };

/** Her hedefi trebleyla kapatan ziyaretler (rakip arada boş atar). */
const closeAll = () => [{ darts: [T(20), T(19), T(18)] }, PASS, { darts: [T(17), T(16), T(15)] }, PASS, { darts: [BULL, DBULL] }];

test('hedefler: cricket 20–15 + bull, tactics 20–10', () => {
  assert.deepEqual(targetsOf({ mode: 'cricket' }), [20, 19, 18, 17, 16, 15, 25]);
  assert.deepEqual(targetsOf({ mode: 'tactics' }), [20, 19, 18, 17, 16, 15, 14, 13, 12, 11, 10]);
  assert.ok(!targetsOf({ mode: 'tactics', no1011: true }).includes(10));
});

test('puansız: her şeyi ilk kapatan kazanır, kazanan okta ziyaret biter', () => {
  const s = compute(cfg(), closeAll());
  assert.equal(s.finished, true);
  assert.equal(s.winner, 0);
  assert.equal(s.legs[0].visits.at(-1).dartsUsed, 2);
});

test('işaretler 3\'te kapanır, fazlası puansızda boşa gider', () => {
  const s = compute(cfg(), [{ darts: [T(20), S(20), S(20)] }]);
  assert.equal(s.marks[0][20], 3);
  assert.deepEqual(s.points, [0, 0]);
});

test('ceza (cut-throat): kapalı hedefe fazla vuruş, hedefi açık rakibe ceza yazar', () => {
  const s = compute(cfg({ scoring: 'penalty' }), [{ darts: [T(20), T(20)] }]);
  assert.equal(s.points[1], 60);
  assert.equal(s.points[0], 0);
});

test('ceza: rakip de kapattıysa puan yazılmaz', () => {
  const s = compute(cfg({ scoring: 'penalty' }), [{ darts: [T(20)] }, { darts: [T(20)] }, { darts: [T(20)] }]);
  assert.deepEqual(s.points, [0, 0]);
});

test('master: tek atış ceza yazmaz, double/treble yazar', () => {
  const s = compute(cfg({ scoring: 'master' }), [{ darts: [T(20), S(20), T(20)] }]);
  assert.equal(s.points[1], 60);
});

test('selfScore: fazla vuruş kendi puanına yazılır', () => {
  const s = compute(cfg({ scoring: 'penalty', selfScore: true }), [{ darts: [T(20), T(20)] }]);
  assert.equal(s.points[0], 60);
  assert.equal(s.points[1], 0);
});

test('cut-throat: hepsini kapatan, puanı daha yüksekse kazanamaz', () => {
  // P1 önce 20'yi kapatıp P0'a ceza yazdırır; P0 sonra hepsini kapatsa da cezası fazla olduğu için kazanamaz
  const s = compute(cfg({ scoring: 'penalty' }), [PASS, { darts: [T(20), T(20), MISS] }, ...closeAll()]);
  assert.equal(s.points[0], 60);
  assert.equal(s.finished, false);
});

test('akyaka: yalnızca sıradaki hedef sayılır', () => {
  const s = compute(cfg({ mode: 'akyaka' }), [{ darts: [T(19), T(20), S(19)] }]);
  assert.equal(s.marks[0][19], 1, '20 kapanmadan önceki 19 sayılmaz, sonraki sayılır');
  assert.equal(s.marks[0][20], 3);
  assert.equal(nextTarget(s, 0), 19);
});

test('tur sınırı: kazanan yoksa bull-off ile karar verilir', () => {
  const s = compute(cfg({ rounds: 1 }), [PASS, PASS, { bull: 0 }, { bull: 50 }]);
  assert.equal(s.finished, true);
  assert.equal(s.winner, 1);
});
