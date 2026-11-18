// Training games: Around the Clock, Bob's 27, Checkout practice.
import { rng, BOGEY, checkoutRoute } from '../darts.js';

// ---------------- Around the Clock ----------------
export const atc = {
  targets(config) {
    const t = Array.from({ length: 20 }, (_, i) => i + 1);
    if (config.bull) t.push(25);
    return t;
  },
  compute(config, actions) {
    const n = config.players.length;
    const targets = atc.targets(config);
    const s = { n, targets, pos: Array(n).fill(0), darts: Array(n).fill(0), hits: Array(n).fill(0), current: 0, visits: [], finished: false, winner: null, event: null };
    for (const a of actions) {
      if (s.finished) break;
      const p = s.current;
      let used = 0;
      for (const h of a.hits) {
        used++; s.darts[p]++;
        // h: false (miss), true (hit = 1 step) or 1/2/3 steps (single / double / treble with config.skip)
        const step = h === true ? 1 : Math.max(0, Math.min(3, +h || 0));
        if (step) { s.hits[p]++; s.pos[p] = Math.min(targets.length, s.pos[p] + step); }
        if (s.pos[p] >= targets.length) break;
      }
      s.visits.push({ p, hits: a.hits.slice(0, used) });
      if (s.pos[p] >= targets.length) { s.finished = true; s.winner = p; s.event = { type: 'match', side: p, p }; break; }
      s.current = (p + 1) % n;
    }
    return s;
  },
  stats(s, config) {
    return config.players.map((_, p) => ({ darts: s.darts[p], hits: s.hits[p], hitPct: s.darts[p] ? (s.hits[p] / s.darts[p]) * 100 : 0, progress: s.pos[p], total: s.targets.length, done: s.pos[p] >= s.targets.length }));
  },
};

// ---------------- Bob's 27 ----------------
export const bobs = {
  targets: [...Array.from({ length: 20 }, (_, i) => i + 1), 25],
  compute(config, actions) {
    const n = config.players.length;
    const s = { n, targets: bobs.targets, score: Array(n).fill(27), round: Array(n).fill(0), out: Array(n).fill(false), hits: Array(n).fill(0), current: 0, visits: [], finished: false, winner: null, event: null };
    const active = (p) => !s.out[p] && s.round[p] < bobs.targets.length;
    for (const a of actions) {
      if (s.finished) break;
      const p = s.current;
      const tgt = bobs.targets[s.round[p]];
      const val = tgt === 25 ? 50 : tgt * 2;
      const delta = a.hits > 0 ? a.hits * val : -val;
      s.score[p] += delta; s.hits[p] += a.hits;
      s.visits.push({ p, target: tgt, hits: a.hits, delta });
      s.round[p]++;
      if (config.outAtZero ? s.score[p] <= 0 : s.score[p] < 0) s.out[p] = true;
      // next active player
      let next = -1;
      for (let k = 1; k <= n; k++) { const c = (p + k) % n; if (active(c)) { next = c; break; } }
      if (next < 0) {
        s.finished = true;
        let best = 0;
        for (let i = 1; i < n; i++) if ((s.out[i] ? -1e9 + s.round[i] : s.score[i]) > (s.out[best] ? -1e9 + s.round[best] : s.score[best])) best = i;
        s.winner = best; s.event = { type: 'match', side: best, p: best };
      } else s.current = next;
    }
    return s;
  },
  stats(s, config) {
    return config.players.map((_, p) => ({ score: s.score[p], out: s.out[p], rounds: s.round[p], hits: s.hits[p], darts: s.round[p] * 3, hitPct: s.round[p] ? (s.hits[p] / (s.round[p] * 3)) * 100 : 0 }));
  },
};

// ---------------- 121 Checkout ----------------
// Start on 121 with 9 darts (3 visits) to check out on a double. Success: next target +1. Miss: target -1 (never below the start).
export const c121 = {
  compute(config, actions) {
    const start = config.start || 121;
    const s = { n: 1, target: start, best: 0, results: [], current: 0, finished: false, winner: 0, event: null };
    for (const a of actions) {
      if (s.finished) break;
      s.results.push({ target: s.target, ok: a.ok, darts: a.ok ? a.darts : 9 });
      if (a.ok) { s.best = Math.max(s.best, s.target); s.target++; } else s.target = config.failReset === 'start' ? start : Math.max(start, s.target - 1);
      if (s.results.length >= config.rounds) { s.finished = true; s.event = { type: 'match', side: 0 }; }
    }
    return s;
  },
  stats(s) {
    const ok = s.results.filter((r) => r.ok);
    return [{ attempts: s.results.length, hits: ok.length, pct: s.results.length ? (ok.length / s.results.length) * 100 : 0, best: s.best, avgDarts: ok.length ? ok.reduce((a, r) => a + r.darts, 0) / ok.length : 0, final: s.target }];
  },
};

// ---------------- Doubles training ----------------
// 3 darts at each double D1..D20 and Bull, count hits.
export const doubles = {
  targets: [...Array.from({ length: 20 }, (_, i) => i + 1), 25],
  compute(config, actions) {
    const n = config.players.length;
    const T = doubles.targets;
    const s = { n, targets: T, round: Array(n).fill(0), hits: Array(n).fill(0), perTarget: Array.from({ length: n }, () => ({})), current: 0, visits: [], finished: false, winner: null, event: null };
    for (const a of actions) {
      if (s.finished) break;
      const p = s.current;
      const tgt = T[s.round[p]];
      s.hits[p] += a.hits; s.perTarget[p][tgt] = a.hits;
      s.visits.push({ p, target: tgt, hits: a.hits });
      s.round[p]++;
      if (s.round.every((r) => r >= T.length)) {
        s.finished = true;
        const top = Math.max(...s.hits); const leaders = s.hits.filter((h) => h === top).length;
        s.winner = leaders > 1 ? null : s.hits.indexOf(top); s.tie = leaders > 1; // equal hits = draw
        s.event = { type: 'match', side: s.winner };
      } else s.current = (p + 1) % n;
    }
    return s;
  },
  stats(s, config) {
    return config.players.map((_, p) => {
      const pt = s.perTarget[p];
      const best = Object.entries(pt).sort((a, b) => b[1] - a[1])[0];
      return { score: s.hits[p], hits: s.hits[p], darts: s.round[p] * 3, hitPct: s.round[p] ? (s.hits[p] / (s.round[p] * 3)) * 100 : 0, rounds: s.round[p], bestDouble: best && best[1] > 0 ? (best[0] === '25' ? 'Bull' : 'D' + best[0]) : '–' };
    });
  },
};

// ---------------- Shanghai ----------------
// Round r targets number r. Single = r, double = 2r, treble = 3r. Single+double+treble in one round = Shanghai (instant win).
export const shanghai = {
  compute(config, actions) {
    const n = config.players.length;
    const R = config.rounds || 7;
    const s = { n, rounds: R, round: Array(n).fill(0), score: Array(n).fill(0), current: 0, visits: [], finished: false, winner: null, event: null, shanghai: null };
    for (const a of actions) {
      if (s.finished) break;
      const p = s.current;
      const tgt = s.round[p] + 1;
      const ms = a.darts.map((d) => d.m || 0);
      const pts = ms.reduce((x, m) => x + m * tgt, 0);
      s.score[p] += pts;
      const isSh = [1, 2, 3].every((m) => ms.includes(m));
      s.visits.push({ p, target: tgt, ms, pts, shanghai: isSh });
      s.round[p]++;
      if (isSh) { s.finished = true; s.winner = p; s.shanghai = p; s.event = { type: 'match', side: p }; break; }
      if (s.round.every((r) => r >= R)) {
        s.finished = true;
        const top = Math.max(...s.score); const leaders = s.score.filter((x) => x === top).length;
        s.winner = leaders > 1 ? null : s.score.indexOf(top); s.tie = leaders > 1; // equal scores = draw
        s.event = { type: 'match', side: s.winner };
      } else s.current = (p + 1) % n;
    }
    return s;
  },
  stats(s, config) {
    return config.players.map((_, p) => {
      const v = s.visits.filter((x) => x.p === p);
      const darts = v.length * 3;
      const hits = v.reduce((a, x) => a + x.ms.filter((m) => m > 0).length, 0);
      return { score: s.score[p], rounds: v.length, darts, hits, hitPct: darts ? (hits / darts) * 100 : 0, shanghai: s.shanghai === p ? 1 : 0, high: v.reduce((a, x) => Math.max(a, x.pts), 0) };
    });
  },
};

// ---------------- Random checkout practice ----------------
export const checkout = {
  sequence(config) {
    const r = rng(config.seed);
    const out = [];
    while (out.length < config.rounds) {
      const v = config.min + Math.floor(r() * (config.max - config.min + 1));
      if (BOGEY.has(v) || !checkoutRoute(v, 3, 'double')) continue;
      out.push(v);
    }
    return out;
  },
  compute(config, actions) {
    const seq = checkout.sequence(config);
    const s = { n: 1, seq, idx: 0, results: [], current: 0, finished: false, winner: 0, event: null };
    for (const a of actions) {
      if (s.finished) break;
      s.results.push({ target: seq[s.idx], ok: a.ok, darts: a.darts || 3 });
      s.idx++;
      if (s.idx >= seq.length) { s.finished = true; s.event = { type: 'match', side: 0, p: 0 }; }
    }
    return s;
  },
  stats(s) {
    const ok = s.results.filter((r) => r.ok);
    return [{ attempts: s.results.length, hits: ok.length, pct: s.results.length ? (ok.length / s.results.length) * 100 : 0, best: ok.reduce((m, r) => Math.max(m, r.target), 0), points: ok.reduce((m, r) => m + r.target, 0) }];
  },
};
