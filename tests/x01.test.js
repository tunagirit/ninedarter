// X01 puan motoru testleri — çalıştır: npm test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { compute, roundsDone } from '../js/engines/x01.js';

const P = (n) => Array.from({ length: n }, (_, i) => ({ id: 'p' + i, name: 'P' + i }));
const cfg = (o = {}) => ({ start: 501, in: 'straight', out: 'double', legsToWin: 1, players: P(2), ...o });
const T = (n) => ({ n, m: 3 }), D = (n) => ({ n, m: 2 }), S = (n) => ({ n, m: 1 });
const MISS = { n: 0, m: 1 };

test('9 darter: 180 + 180 + T20 T19 D12 bacağı kazanır', () => {
  const s = compute(cfg(), [{ darts: [T(20), T(20), T(20)] }, { darts: [MISS, MISS, MISS] }, { darts: [T(20), T(20), T(20)] }, { darts: [MISS, MISS, MISS] }, { darts: [T(20), T(19), D(12)] }]);
  assert.equal(s.finished, true);
  assert.equal(s.winner, 0);
  assert.equal(s.legs[0].visits.filter((v) => v.s === 0).reduce((a, v) => a + v.dartsUsed, 0), 9);
});

test('kalan puanı aşan atış bust olur, kalan değişmez', () => {
  const s = compute(cfg({ start: 32 }), [{ darts: [T(20), MISS, MISS] }]);
  assert.equal(s.remaining[0], 32);
  assert.equal(s.visits[0].bust, true);
  assert.equal(s.side, 1);
});

test('double out: 1 bırakmak bust, tek ile bitirmek bust', () => {
  assert.equal(compute(cfg({ start: 21 }), [{ darts: [S(20)] }]).visits[0].bust, true);
  assert.equal(compute(cfg({ start: 20 }), [{ darts: [S(20)] }]).visits[0].bust, true);
  assert.equal(compute(cfg({ start: 20 }), [{ darts: [D(10)] }]).finished, true);
});

test('straight out: tek ile bitirilebilir', () => {
  const s = compute(cfg({ start: 20, out: 'straight' }), [{ darts: [S(20)] }]);
  assert.equal(s.finished, true);
});

test('double in: double gelmeden atılan oklar sayılmaz', () => {
  const s = compute(cfg({ in: 'double' }), [{ darts: [T(20), D(10), S(20)] }]);
  assert.equal(s.remaining[0], 501 - 20 - 20);
  assert.equal(s.opened[0], true);
});

test('puan girişi: skor girilerek bitiş ve bust', () => {
  const a = compute(cfg({ start: 100 }), [{ score: 100, dartsUsed: 2 }]);
  assert.equal(a.finished, true);
  const b = compute(cfg({ start: 100 }), [{ score: 99 }]);
  assert.equal(b.visits[0].bust, true);
  assert.equal(b.remaining[0], 100);
});

test('bacaklar: başlayan sırayla değişir, legsToWin olunca maç biter', () => {
  const c = cfg({ start: 40, legsToWin: 2 });
  let s = compute(c, [{ darts: [D(20)] }]);
  assert.equal(s.legsWon[0], 1);
  assert.equal(s.side, 1, 'ikinci bacağı diğer oyuncu başlar');
  s = compute(c, [{ darts: [D(20)] }, { darts: [MISS] }, { darts: [D(20)] }]);
  assert.equal(s.finished, true);
  assert.equal(s.winner, 0);
});

test('setler: set kazanılınca bacak sayısı sıfırlanır', () => {
  const c = cfg({ start: 40, sets: true, setsToWin: 2, legsToWin: 1 });
  const s = compute(c, [{ darts: [D(20)] }]);
  assert.equal(s.setsWon[0], 1);
  assert.equal(s.legsWon[0], 0);
  assert.equal(s.set, 2);
});

test('tur sınırı: bitiş olmazsa bull-off, iç bull dış bull\'u yener', () => {
  const c = cfg({ rounds: 1 });
  let s = compute(c, [{ darts: [MISS] }, { darts: [MISS] }]);
  assert.equal(roundsDone(s), 1);
  assert.ok(s.bulloff, 'bull-off başlamalı');
  s = compute(c, [{ darts: [MISS] }, { darts: [MISS] }, { bull: 25 }, { bull: 50 }]);
  assert.equal(s.finished, true);
  assert.equal(s.winner, 1);
});

test('bull-off berabere biterse tekrar atılır', () => {
  const s = compute(cfg({ rounds: 1 }), [{ darts: [MISS] }, { darts: [MISS] }, { bull: 25 }, { bull: 25 }]);
  assert.equal(s.finished, false);
  assert.equal(s.bulloff.round, 2);
});

test('takımlar: takım içinde atıcı sırayla döner', () => {
  const c = cfg({ players: P(4), teams: [[0, 2], [1, 3]] });
  const s = compute(c, [{ darts: [MISS] }, { darts: [MISS] }]);
  assert.equal(s.current, 2, 'takım 1\'in ikinci oyuncusu');
});
