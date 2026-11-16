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
        if (h) { s.hits[p]++; s.pos[p]++; }
        if (s.pos[p] >= targets.length) break;
      }
      s.visits.push({ p, hits: a.hits.slice(0, used) });
      if (s.pos[p] >= targets.length) { s.finished = true; s.winner = p; s.event = { type: 'match', p }; break; }
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
      if (s.score[p] < 0) s.out[p] = true;
      // next active player
      let next = -1;
      for (let k = 1; k <= n; k++) { const c = (p + k) % n; if (active(c)) { next = c; break; } }
      if (next < 0) {
        s.finished = true;
        let best = 0;
        for (let i = 1; i < n; i++) if ((s.out[i] ? -1e9 + s.round[i] : s.score[i]) > (s.out[best] ? -1e9 + s.round[best] : s.score[best])) best = i;
        s.winner = best; s.event = { type: 'match', p: best };
      } else s.current = next;
    }
    return s;
  },
  stats(s, config) {
    return config.players.map((_, p) => ({ score: s.score[p], out: s.out[p], rounds: s.round[p], hits: s.hits[p], darts: s.round[p] * 3, hitPct: s.round[p] ? (s.hits[p] / (s.round[p] * 3)) * 100 : 0 }));
  },
};

// ---------------- Checkout practice ----------------
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
      if (s.idx >= seq.length) { s.finished = true; s.event = { type: 'match', p: 0 }; }
    }
    return s;
  },
  stats(s) {
    const ok = s.results.filter((r) => r.ok);
    return [{ attempts: s.results.length, hits: ok.length, pct: s.results.length ? (ok.length / s.results.length) * 100 : 0, best: ok.reduce((m, r) => Math.max(m, r.target), 0), points: ok.reduce((m, r) => m + r.target, 0) }];
  },
};
