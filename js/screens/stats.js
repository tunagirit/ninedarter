import { html, useState } from '../../vendor/preact-htm.js';
import { useStore } from '../store.js';
import { t } from '../i18n.js';
import { Seg, Avatar, EmptyState, Btn, fmt1, fmtPct } from '../ui.js';
import { go } from '../match.js';
import { TopBar } from './common.js';

function playerMatches(matches, pid, types) {
  return matches.filter((m) => types.includes(m.type) && m.players.some((p) => p.id === pid))
    .map((m) => ({ m, i: m.players.findIndex((p) => p.id === pid) }))
    .map(({ m, i }) => ({ m, s: m.stats[i] }))
    .reverse(); // chronological
}

export function aggregateX01(matches, pid) {
  const list = playerMatches(matches, pid, ['x01']);
  const a = { n: list.length, wins: 0, multi: 0, points: 0, darts: 0, f9p: 0, f9d: 0, t180: 0, t140: 0, t100: 0, t60: 0, dbl: 0, co: 0, hiCo: 0, best: null, high: 0, series: [] };
  for (const { m, s } of list) {
    if (m.players.length > 1) { a.multi++; if (m.winner === pid) a.wins++; }
    a.points += s.points; a.darts += s.darts; a.f9p += s.f9points; a.f9d += s.f9darts;
    a.t180 += s.t180; a.t140 += s.t140; a.t100 += s.t100; a.t60 += s.t60; a.dbl += s.dblDarts; a.co += s.checkouts;
    a.hiCo = Math.max(a.hiCo, s.hiCo); a.high = Math.max(a.high, s.high);
    if (s.bestLeg != null && (a.best == null || s.bestLeg < a.best)) a.best = s.bestLeg;
    a.series.push(s.avg);
  }
  a.avg = a.darts ? (a.points / a.darts) * 3 : 0;
  a.f9 = a.f9d ? (a.f9p / a.f9d) * 3 : 0;
  a.coPct = a.dbl ? (a.co / a.dbl) * 100 : 0;
  return a;
}

function Chart({ data, label }) {
  if (data.length < 2) return html`<div class="body-m muted" style="padding:24px;text-align:center">${t('stats.needMore')}</div>`;
  const W = 600, H = 200, P = 28;
  const d = data.slice(-30);
  const max = Math.ceil(Math.max(...d) / 10) * 10 || 10, min = Math.max(0, Math.floor(Math.min(...d) / 10) * 10 - 10);
  const x = (i) => P + (i / (d.length - 1)) * (W - P - 8);
  const y = (v) => 8 + (1 - (v - min) / (max - min || 1)) * (H - 28);
  const pts = d.map((v, i) => `${x(i).toFixed(1)},${y(v).toFixed(1)}`);
  const ticks = [min, (min + max) / 2, max];
  return html`<svg class="chart" viewBox=${`0 0 ${W} ${H}`} preserveAspectRatio="none" role="img" aria-label=${label}>
    ${ticks.map((v) => html`<line class="grid-l" x1=${P} x2=${W} y1=${y(v)} y2=${y(v)} /><text x="0" y=${y(v) + 4}>${Math.round(v)}</text>`)}
    <polygon class="area" points=${`${x(0)},${H - 20} ${pts.join(' ')} ${x(d.length - 1)},${H - 20}`} />
    <polyline class="ln" points=${pts.join(' ')} />
    ${d.map((v, i) => html`<circle class="dot" cx=${x(i)} cy=${y(v)} r="4"><title>${fmt1(v)}</title></circle>`)}
  </svg>`;
}

const Tile = ({ k, v, hero }) => html`<div class=${'tile' + (hero ? ' hero-tile' : '')}><span class="k">${k}</span><span class="v">${v}</span></div>`;

export function Stats({ pid }) {
  const st = useStore();
  const [type, setType] = useState('x01');
  const players = st.players;
  const sel = players.find((p) => p.id === pid) || players[0];
  if (!sel) return html`<${TopBar} title=${t('nav.stats')} back=${false} /><${EmptyState} icon="monitoring" title=${t('stats.empty')} text=${t('stats.emptyText')}><${Btn} kind="filled" icon="person_add" onClick=${() => go('#/players')}>${t('players.add')}<//><//>`;

  let body;
  if (type === 'x01') {
    const a = aggregateX01(st.matches, sel.id);
    body = a.n ? html`
      <div class="stat-tiles">
        <${Tile} hero k=${t('stats.avg3')} v=${fmt1(a.avg)} />
        <${Tile} k=${t('stats.first9')} v=${fmt1(a.f9)} />
        <${Tile} k=${t('stats.coPct')} v=${a.dbl ? fmtPct(a.coPct) : '–'} />
        <${Tile} k=${t('stats.matches')} v=${a.n} />
        <${Tile} k=${t('stats.winPct')} v=${a.multi ? fmtPct((a.wins / a.multi) * 100) : '–'} />
        <${Tile} k="180" v=${a.t180} />
        <${Tile} k="140+" v=${a.t140} />
        <${Tile} k="100+" v=${a.t100} />
        <${Tile} k=${t('stats.hiCo')} v=${a.hiCo || '–'} />
        <${Tile} k=${t('stats.bestLeg')} v=${a.best ?? '–'} />
        <${Tile} k=${t('stats.high')} v=${a.high} />
      </div>
      <div class="card"><div class="title-m" style="margin-bottom:8px">${t('stats.avgTrend')}</div><${Chart} data=${a.series} label=${t('stats.avgTrend')} /></div>`
      : null;
  } else if (type === 'cricket') {
    const list = playerMatches(st.matches, sel.id, ['cricket']);
    let marks = 0, rounds = 0, wins = 0, multi = 0, five = 0;
    for (const { m, s } of list) { marks += s.marks; rounds += s.rounds; five += s.fivePlus; if (m.players.length > 1) { multi++; if (m.winner === sel.id) wins++; } }
    body = list.length ? html`<div class="stat-tiles">
        <${Tile} hero k=${t('stats.mpr')} v=${fmt1(rounds ? marks / rounds : 0)} />
        <${Tile} k=${t('stats.matches')} v=${list.length} />
        <${Tile} k=${t('stats.winPct')} v=${multi ? fmtPct((wins / multi) * 100) : '–'} />
        <${Tile} k=${t('stats.fivePlus')} v=${five} />
      </div>
      <div class="card"><div class="title-m" style="margin-bottom:8px">MPR</div><${Chart} data=${list.map((x) => x.s.mpr)} label="MPR" /></div>` : null;
  } else {
    const atc = playerMatches(st.matches, sel.id, ['atc']);
    const bob = playerMatches(st.matches, sel.id, ['bobs27']);
    const ck = playerMatches(st.matches, sel.id, ['checkout']);
    const done = atc.filter((x) => x.s.done);
    const ckA = ck.reduce((a, x) => a + x.s.attempts, 0), ckH = ck.reduce((a, x) => a + x.s.hits, 0);
    body = atc.length + bob.length + ck.length ? html`
      <div class="title-m section-title">${t('mode.atc')}</div>
      <div class="stat-tiles"><${Tile} k=${t('stats.played')} v=${atc.length} /><${Tile} k=${t('stats.bestDarts')} v=${done.length ? Math.min(...done.map((x) => x.s.darts)) : '–'} /><${Tile} k=${t('stats.hitPct')} v=${atc.length ? fmtPct(atc.reduce((a, x) => a + x.s.hitPct, 0) / atc.length) : '–'} /></div>
      <div class="title-m section-title">${t('mode.bobs27')}</div>
      <div class="stat-tiles"><${Tile} k=${t('stats.played')} v=${bob.length} /><${Tile} k=${t('stats.bestScore')} v=${bob.length ? Math.max(...bob.map((x) => x.s.score)) : '–'} /><${Tile} k=${t('stats.avgScore')} v=${bob.length ? Math.round(bob.reduce((a, x) => a + x.s.score, 0) / bob.length) : '–'} /></div>
      ${bob.length > 1 && html`<div class="card" style="margin-top:8px"><${Chart} data=${bob.map((x) => x.s.score)} label=${t('mode.bobs27')} /></div>`}
      <div class="title-m section-title">${t('mode.checkout')}</div>
      <div class="stat-tiles"><${Tile} k=${t('stats.successRate')} v=${ckA ? fmtPct((ckH / ckA) * 100) : '–'} /><${Tile} k=${t('stats.attempts')} v=${ckA} /><${Tile} k=${t('stats.bestCo')} v=${ck.length ? Math.max(...ck.map((x) => x.s.best)) || '–' : '–'} /></div>`
      : null;
  }

  return html`<div class="screen-enter stack">
    <${TopBar} title=${t('nav.stats')} back=${false} />
    <div class="chips">${players.map((p) => html`<button class=${'chip' + (p.id === sel.id ? ' on' : '')} onClick=${() => go('#/stats/' + p.id)}><${Avatar} p=${p} />${p.name}</button>`)}</div>
    <${Seg} value=${type} onChange=${setType} options=${[{ value: 'x01', label: 'X01' }, { value: 'cricket', label: t('mode.cricket') }, { value: 'training', label: t('history.training') }]} />
    ${body || html`<${EmptyState} icon="query_stats" title=${t('stats.noData')} text=${t('stats.noDataText')} />`}
  </div>`;
}
