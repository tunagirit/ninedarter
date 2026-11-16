import { html, useState } from '../../vendor/preact-htm.js';
import { useStore } from '../store.js';
import { t } from '../i18n.js';
import { Icon, Btn, Seg, Avatar, Shape, confirmDialog, EmptyState, fmt1 } from '../ui.js';
import { rematch, deleteMatch, go } from '../match.js';
import { modeName, TopBar } from './common.js';
import { StatsTable } from './statstable.js';
import { RecentItem } from './home.js';
import * as X01 from '../engines/x01.js';

export function Result({ id }) {
  const st = useStore();
  const m = st.matches.find((x) => x.id === id);
  if (!m) return html`<${TopBar} title=${t('nav.history')} back="#/history" /><${EmptyState} icon="search_off" title=${t('result.notFound')} />`;
  const winner = m.players.find((p) => p.id === m.winner);
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
    if (m.type === 'cricket') return `MPR ${fmt1(m.stats[m.players.indexOf(winner)]?.mpr ?? s0.mpr)}`;
    if (m.type === 'atc') return `${s0.darts} ${t('stats.dartsShort')}`;
    if (m.type === 'bobs27') return `${t('stats.score')} ${s0.score}`;
    if (m.type === 'checkout') return `${s0.hits}/${s0.attempts}`;
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
      ${multi && winner ? html`<${Avatar} p=${winner} size="xl" spin />
        <div class="label-l">${t('result.winner')}</div>
        <div class="display-m">${winner.name}</div>` : html`<div style="width:96px;height:96px;display:grid;place-items:center;position:relative"><${Shape} name="cookie" style="position:absolute;inset:0;color:var(--tertiary);opacity:.3" /><${Icon} n="emoji_events" size=${48} fill /></div>
        <div class="display-m">${t('result.done')}</div>`}
      <div class="title-l">${summary()}</div>
      ${m.type === 'x01' && multi && html`<div class="headline-m num">${m.players.map((p, i) => (m.config.sets ? null : m.stats[i].legsWon)).filter((x) => x != null).join(' – ')}</div>`}
      <div class="body-m">${new Date(m.date).toLocaleString()} · ${mins} ${t('result.min')}</div>
    </div>
    <div class="row wrap" style="justify-content:center">
      <${Btn} kind="filled" size="m" icon="replay" onClick=${() => rematch(m)}>${t('result.rematch')}<//>
      <${Btn} kind="tonal" size="m" icon="home" onClick=${() => go('#/')}>${t('nav.play')}<//>
      <${Btn} kind="outlined" size="m" icon="delete" onClick=${del}>${t('common.delete')}<//>
    </div>
    <h2 class="title-m section-title" style="margin-bottom:0">${t('result.stats')}</h2>
    <${StatsTable} type=${m.type} players=${m.players} stats=${m.stats} />
    ${legs && legs.length > 0 && html`
      <h2 class="title-m section-title" style="margin-bottom:0">${t('result.legs')}</h2>
      <div class="list">${legs.map((l, i) => {
        const w = m.players[l.winner];
        const darts = l.visits.filter((v) => v.p === l.winner).reduce((a, v) => a + v.dartsUsed, 0);
        const co = l.visits.at(-1);
        return html`<div class="list-item" style="cursor:default">
          <div class="lead num">${i + 1}</div>
          <div class="grow"><div class="title-s">${w.name}</div><div class="meta">${m.config.sets ? `${t('game.set')} ${l.set} · ` : ''}${t('game.dartsN', { n: darts })} · ${t('stats.checkout')} ${co.score}</div></div>
          <${Avatar} p=${w} />
        </div>`;
      })}</div>`}
  </div>`;
}

export function History() {
  const st = useStore();
  const [f, setF] = useState('all');
  const list = st.matches.filter((m) => f === 'all' || (f === 'training' ? ['atc', 'bobs27', 'checkout'].includes(m.type) : m.type === f));
  return html`<div class="screen-enter stack">
    <${TopBar} title=${t('nav.history')} back=${false} />
    <${Seg} size="s" value=${f} onChange=${setF} options=${[{ value: 'all', label: t('history.all') }, { value: 'x01', label: 'X01' }, { value: 'cricket', label: t('mode.cricket') }, { value: 'training', label: t('history.training') }]} />
    ${list.length ? html`<div class="list">${list.map((m) => html`<${RecentItem} m=${m} key=${m.id} />`)}</div>`
      : html`<${EmptyState} icon="history" title=${t('history.empty')} text=${t('history.emptyText')}><${Btn} kind="filled" icon="play_arrow" onClick=${() => go('#/play/x01')}>${t('home.newGame')}<//><//>`}
  </div>`;
}
