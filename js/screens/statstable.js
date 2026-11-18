import { html } from '../../vendor/preact-htm.js';
import { t } from '../i18n.js';
import { Avatar, fmt1, fmtPct } from '../ui.js';

// rows: [labelKey, getter(stat) -> number|null, formatter, higherIsBetter]
const ROWS = {
  x01: [
    ['stats.avg', (s) => s.avg, fmt1, true],
    ['stats.first9', (s) => s.f9avg, fmt1, true],
    ['stats.coPct', (s) => (s.dblDarts ? s.coPct : null), fmtPct, true],
    ['stats.checkouts', (s) => s.checkouts, (v) => v, true],
    ['stats.dblDarts', (s) => s.dblDarts, (v) => v, null],
    ['stats.hiCo', (s) => s.hiCo, (v) => v || '–', true],
    ['stats.bestLeg', (s) => s.bestLeg, (v) => (v == null ? '–' : v + ' ' + t('stats.dartsShort')), false],
    ['stats.high', (s) => s.high, (v) => v, true],
    ['180', (s) => s.t180, (v) => v, true],
    ['140+', (s) => s.t140, (v) => v, true],
    ['100+', (s) => s.t100, (v) => v, true],
    ['60+', (s) => s.t60, (v) => v, true],
    ['stats.darts', (s) => s.darts, (v) => v, null],
    ['stats.busts', (s) => s.busts, (v) => v, null],
  ],
  cricket: [
    ['stats.mpr', (s) => s.mpr, fmt1, true],
    ['stats.marks', (s) => s.marks, (v) => v, true],
    ['stats.fivePlus', (s) => s.fivePlus, (v) => v, true],
    ...[5, 6, 7, 8, 9].map((k) => [['stats.nMarks', { n: k }], (s) => s['m' + k] ?? null, (v) => v, true]),
    ['stats.highMarks', (s) => s.highMarks, (v) => v, true],
    ['stats.rounds', (s) => s.rounds, (v) => v, null],
    ['stats.legsWon', (s) => s.legsWon, (v) => v, true],
  ],
  atc: [
    ['stats.darts', (s) => s.darts, (v) => v, false],
    ['stats.hitPct', (s) => s.hitPct, fmtPct, true],
    ['stats.progress', (s) => s.progress, (v) => v, true],
  ],
  bobs27: [
    ['stats.score', (s) => s.score, (v) => v, true],
    ['stats.hitPct', (s) => s.hitPct, fmtPct, true],
    ['stats.rounds', (s) => s.rounds, (v) => v, true],
  ],
  c121: [
    ['stats.best', (s) => s.best, (v) => v || '–', true],
    ['stats.successRate', (s) => s.pct, fmtPct, true],
    ['stats.checkouts', (s) => s.hits, (v) => v, true],
    ['stats.attempts', (s) => s.attempts, (v) => v, null],
    ['stats.avgDarts', (s) => (s.hits ? s.avgDarts : null), fmt1, false],
  ],
  doubles: [
    ['stats.hits', (s) => s.hits, (v) => v, true],
    ['stats.hitPct', (s) => s.hitPct, fmtPct, true],
    ['stats.bestDouble', (s) => s.bestDouble, (v) => v, null],
    ['stats.darts', (s) => s.darts, (v) => v, null],
  ],
  shanghai: [
    ['stats.score', (s) => s.score, (v) => v, true],
    ['stats.hitPct', (s) => s.hitPct, fmtPct, true],
    ['stats.high', (s) => s.high, (v) => v, true],
    ['Shanghai', (s) => s.shanghai, (v) => (v ? '✓' : '–'), true],
  ],
  checkout: [
    ['stats.successRate', (s) => s.pct, fmtPct, true],
    ['stats.checkouts', (s) => s.hits, (v) => v, true],
    ['stats.attempts', (s) => s.attempts, (v) => v, null],
    ['stats.bestCo', (s) => s.best, (v) => v || '–', true],
  ],
};

export function StatsTable({ type, players, stats }) {
  const rows = ROWS[type] || [];
  return html`<div class="table-wrap"><table class="stats">
    <thead><tr><th></th>${players.map((p) => html`<th><div class="row" style="justify-content:flex-end;gap:8px"><span>${p.name}</span><${Avatar} p=${p} /></div></th>`)}</tr></thead>
    <tbody>${rows.map(([k, get, f, hib]) => {
      const vals = stats.map((s) => get(s));
      const nums = vals.filter((v) => v != null);
      const best = players.length > 1 && hib != null && nums.length ? (hib ? Math.max(...nums) : Math.min(...nums)) : null;
      return html`<tr><td>${Array.isArray(k) ? t(k[0], k[1]) : k.includes('.') ? t(k) : k}</td>${vals.map((v) => html`<td class=${best != null && v === best ? 'best' : ''}>${v == null ? '–' : f(v)}</td>`)}</tr>`;
    })}</tbody>
  </table></div>`;
}
