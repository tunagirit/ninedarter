import { html, useState } from '../../vendor/preact-htm.js';
import { useStore } from '../store.js';
import { t } from '../i18n.js';
import { Icon, Btn, Seg, Avatar, Shape, confirmDialog, EmptyState, fmt1 } from '../ui.js';
import { rematch, deleteMatch, go } from '../match.js';
import { modeName, TopBar } from './common.js';
import { StatsTable } from './statstable.js';
import { RecentItem } from './home.js';
import * as X01 from '../engines/x01.js';
import { doubles as DBL } from '../engines/training.js';
import { sidesOf, sideName, winnerNames } from '../teams.js';

export function Result({ id }) {
  const st = useStore();
  const m = st.matches.find((x) => x.id === id);
  if (!m) return html`<${TopBar} title=${t('nav.history')} back="#/history" /><${EmptyState} icon="search_off" title=${t('result.notFound')} />`;
  const winners = m.winners ? m.players.filter((p) => m.winners.includes(p.id)) : m.players.filter((p) => p.id === m.winner);
  const winner = winners[0];
  const sides = sidesOf(m.config);
  const legScore = sides.map((sd) => m.stats[sd[0]]?.legsWon ?? 0);
  const multi = m.players.length > 1;
  const mins = Math.max(1, Math.round((m.ended - m.date) / 60000));
  let legs = null;
  if (m.type === 'x01' && m.actions) {
    const s = X01.compute(m.config, m.actions);
    legs = s.legs;
  }
  const summary = () => {
    const s0 = m.stats[0];
    if (m.type === 'x01') return `⌀ ${fmt1(m.stats[m.players.indexOf(winner)]?.avg ?? s0.avg)}`;
    if (m.type === 'cricket') { const v = m.stats[m.players.indexOf(winner)]?.mpr ?? s0.mpr; return v == null ? '' : `MPR ${fmt1(v)}`; }
    if (m.type === 'atc') return `${s0.darts} ${t('stats.dartsShort')}`;
    if (m.type === 'bobs27') return `${t('stats.score')} ${s0.score}`;
    if (m.type === 'checkout') return `${s0.hits}/${s0.attempts}`;
    if (m.type === 'c121') return `${t('stats.best')} ${s0.best || '–'}`;
    if (m.type === 'doubles') return `${t('stats.hits')} ${m.stats[m.players.indexOf(winner)]?.hits ?? s0.hits}`;
    if (m.type === 'shanghai') return `${t('stats.score')} ${m.stats[m.players.indexOf(winner)]?.score ?? s0.score}`;
    return '';
  };
  const del = async () => {
    if (await confirmDialog({ title: t('result.deleteQ'), text: t('result.deleteText'), ok: t('common.delete'), cancel: t('common.cancel'), danger: true, icon: 'delete' })) { deleteMatch(m.id); go('#/history'); }
  };
  return html`<div class="screen-enter stack">
    <${TopBar} title=${modeName(m.type, m.config)} back="#/history">
      <a class="btn icon-btn" href="#/" title=${t('nav.play')}><${Icon} n="home" /></a>
    <//>
    <div class="winner">
      <${Shape} name="burst" cls="burst" />
      ${multi && winner ? html`<div class="row" style="justify-content:center;gap:4px">${winners.map((w) => html`<${Avatar} p=${w} size=${winners.length > 1 ? 'l' : 'xl'} spin />`)}</div>
        <div class="label-l">${t('result.winner')}${m.winners ? ' · ' + sideName(m.config, sides.findIndex((sd) => sd.some((i) => m.winners.includes(m.players[i].id)))) : ''}</div>
        <div class="display-m">${winnerNames(m)}</div>` : m.tie ? html`<div class="row" style="justify-content:center;gap:4px">${m.players.map((w) => html`<${Avatar} p=${w} size="l" />`)}</div><div class="display-m">${t('result.draw')}</div>` : html`<div style="width:96px;height:96px;display:grid;place-items:center;position:relative"><${Shape} name="cookie" style="position:absolute;inset:0;color:var(--tertiary);opacity:.3" /><${Icon} n="emoji_events" size=${48} fill /></div>
        <div class="display-m">${t('result.done')}</div>`}
      <div class="title-l">${summary()}</div>
      ${(m.type === 'x01' || m.type === 'cricket') && multi && !m.config.sets && sides.length > 1 && html`<div class="headline-m num">${legScore.join(' – ')}</div>`}
      <div class="body-m">${new Date(m.date).toLocaleString()} · ${mins} ${t('result.min')}</div>
    </div>
    <div class="row wrap" style="justify-content:center">
      <${Btn} kind="filled" size="m" icon="replay" onClick=${() => rematch(m)}>${t('result.rematch')}<//>
      <${Btn} kind="tonal" size="m" icon="home" onClick=${() => go('#/')}>${t('nav.play')}<//>
      <${Btn} kind="outlined" size="m" icon="delete" onClick=${del}>${t('common.delete')}<//>
    </div>
    <h2 class="title-m section-title" style="margin-bottom:0">${t('result.stats')}</h2>
    <${StatsTable} type=${m.type} players=${m.players} stats=${m.stats} />
    ${m.type === 'doubles' && m.actions && html`<h2 class="title-m section-title" style="margin-bottom:0">${t('result.doublesMap')}</h2><${DoublesMap} m=${m} />`}
    ${legs && legs.length > 0 && html`
      <h2 class="title-m section-title" style="margin-bottom:0">${t('result.avgChart')}</h2>
      <div class="card"><${AvgChart} m=${m} legs=${legs} sides=${sides} /></div>
      <h2 class="title-m section-title" style="margin-bottom:0">${t('result.legSummary')}</h2>
      <${LegTable} m=${m} legs=${legs} sides=${sides} />`}
  </div>`;
}

// ---------- X01 match end: leg summary + average chart ----------
const sideLabel = (m, sides, i) => (m.config.teams ? sideName(m.config, i) : m.players[sides[i][0]]?.name || '');
const SIDE_HUES = (m, sides) => sides.map((sd) => m.players[sd[0]]?.hue ?? 285);

/** One row per leg: winner, darts and checkout of the winner, and every side's leg average / points left. */
function LegTable({ m, legs, sides }) {
  return html`<div class="table-wrap"><table class="stats leg-table">
    <thead><tr><th>${t('game.leg')}</th><th>${t('result.winner')}</th><th>${t('stats.darts')}</th><th>Checkout</th>
      ${sides.map((_, i) => html`<th>⌀ ${sideLabel(m, sides, i)}</th>`)}</tr></thead>
    <tbody>${legs.map((l, k) => {
      const darts = l.visits.filter((v) => v.s === l.winner).reduce((a, v) => a + v.dartsUsed, 0);
      const last = l.visits.at(-1);
      const co = l.bulloff ? t('game.bulloff') : last?.checkout ? last.score : '–';
      return html`<tr>
        <td class="num">${m.config.sets ? `${l.set}.${l.leg}` : k + 1}</td>
        <td><span class="row" style="gap:6px;justify-content:flex-start"><${Avatar} p=${m.players[sides[l.winner][0]]} /><span class="ellipsis">${sideLabel(m, sides, l.winner)}</span></span></td>
        <td class="num">${darts}${darts <= 15 && !l.bulloff ? html` <span class="badge win">${darts <= 9 ? '9!' : darts <= 12 ? '12' : '15'}</span>` : ''}</td>
        <td class="num">${co}</td>
        ${sides.map((_, i) => {
          let pts = 0, d = 0;
          for (const v of l.visits) if (v.s === i) { pts += v.score; d += v.dartsUsed; }
          return html`<td class=${'num' + (i === l.winner ? ' best' : '')}>${d ? fmt1((pts / d) * 3) : '–'}</td>`;
        })}
      </tr>`;
    })}</tbody>
  </table></div>`;
}

/** Running 3-dart average of every side, visit by visit, across the whole match (leg changes marked). */
function AvgChart({ m, legs, sides }) {
  const series = sides.map(() => []);
  const tot = sides.map(() => ({ p: 0, d: 0 }));
  const breaks = [];
  legs.forEach((l, k) => {
    if (k) breaks.push(Math.max(...series.map((s) => s.length)));
    for (const v of l.visits) { const a = tot[v.s]; if (!a) continue; a.p += v.score; a.d += v.dartsUsed; series[v.s].push((a.p / a.d) * 3); }
  });
  const len = Math.max(...series.map((s) => s.length));
  if (len < 2) return html`<div class="body-m muted" style="padding:16px;text-align:center">${t('stats.needMore')}</div>`;
  const all = series.flat();
  const max = Math.ceil(Math.max(...all) / 10) * 10 || 10, min = Math.max(0, Math.floor(Math.min(...all) / 10) * 10 - 10);
  const W = 600, H = 220, P = 30;
  const x = (i) => P + (i / (len - 1)) * (W - P - 10);
  const y = (v) => 10 + (1 - (v - min) / (max - min || 1)) * (H - 34);
  const hues = SIDE_HUES(m, sides);
  return html`<svg class="chart avg-chart" viewBox=${`0 0 ${W} ${H}`} preserveAspectRatio="none" role="img" aria-label=${t('result.avgChart')}>
    ${[min, (min + max) / 2, max].map((v) => html`<line class="grid-l" x1=${P} x2=${W} y1=${y(v)} y2=${y(v)} /><text x="0" y=${y(v) + 4}>${Math.round(v)}</text>`)}
    ${breaks.map((b) => html`<line class="leg-break" x1=${x(b - 0.5)} x2=${x(b - 0.5)} y1="6" y2=${H - 22} />`)}
    ${series.map((s, i) => s.length > 1 && html`<polyline class="ln" style=${`stroke:oklch(0.68 0.16 ${hues[i]})`} points=${s.map((v, k) => `${x(k).toFixed(1)},${y(v).toFixed(1)}`).join(' ')} />`)}
  </svg>
  <div class="chart-legend">${sides.map((_, i) => html`<span><i style=${`background:oklch(0.68 0.16 ${hues[i]})`}></i>${sideLabel(m, sides, i)} · ${fmt1(series[i].at(-1) || 0)}</span>`)}</div>`;
}

export function History({ embedded } = {}) {
  const st = useStore();
  const [f, setF] = useState('all');
  const list = st.matches.filter((m) => f === 'all' || (f === 'training' ? ['atc', 'bobs27', 'checkout', 'c121', 'doubles', 'shanghai'].includes(m.type) : m.type === f));
  return html`<div class=${embedded ? 'stack' : 'screen-enter stack'}>
    ${!embedded && html`<${TopBar} title=${t('nav.history')} back=${false} />`}
    <${Seg} size="s" value=${f} onChange=${setF} options=${[{ value: 'all', label: t('history.all') }, { value: 'x01', label: 'X01' }, { value: 'cricket', label: t('mode.cricket') }, { value: 'training', label: t('history.training') }]} />
    ${list.length ? html`<div class="list">${list.map((m) => html`<${RecentItem} m=${m} key=${m.id} />`)}</div>`
      : html`<${EmptyState} icon="history" title=${t('history.empty')} text=${t('history.emptyText')}><${Btn} kind="filled" icon="play_arrow" onClick=${() => go('#/play')}>${t('home.newGame')}<//><//>`}
  </div>`;
}

/** Doubles training: hits on every double (0–3 of 3 darts), strongest to weakest at a glance. */
function DoublesMap({ m }) {
  const s = DBL.compute(m.config, m.actions);
  return html`<div class="stack s">${m.players.map((p, i) => {
    const pt = s.perTarget[i] || {};
    const thrown = s.targets.filter((x) => x in pt);
    const best = thrown.filter((x) => pt[x] === Math.max(...thrown.map((y) => pt[y])) && pt[x] > 0);
    const worst = thrown.filter((x) => pt[x] === 0);
    const lab = (x) => (x === 25 ? 'Bull' : 'D' + x);
    return html`<div class="card">
      ${m.players.length > 1 && html`<div class="row" style="gap:8px;margin-bottom:8px"><${Avatar} p=${p} /><span class="title-s">${p.name}</span></div>`}
      <div class="dbl-map">${s.targets.map((x) => html`<div class=${'dbl-cell h' + (x in pt ? pt[x] : 'x')} title=${lab(x)}><span>${lab(x)}</span><b>${x in pt ? pt[x] : '–'}</b></div>`)}</div>
      <div class="body-s muted" style="margin-top:8px">${best.length ? `${t('result.bestDoubles')}: ${best.map(lab).join(', ')}` : ''}${worst.length ? ` · ${t('result.zeroDoubles')}: ${worst.map(lab).join(', ')}` : ''}</div>
    </div>`;
  })}</div>`;
}
