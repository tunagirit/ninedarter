import { html } from '../../vendor/preact-htm.js';
import { useStore } from '../store.js';
import { t } from '../i18n.js';
import { Icon, Btn, Shape, Avatar, confirmDialog } from '../ui.js';
import { computeActive, go, abandonMatch, startMatch } from '../match.js';
import { modeName } from './common.js';

const MODES = [
  { id: 'x01', icon: 'sports_score', shape: 'cookie', c: 'c-primary' },
  { id: 'cricket', icon: 'grid_view', shape: 'clover', c: 'c-tertiary' },
  { id: 'atc', icon: 'schedule', shape: 'sunny', c: 'c-secondary' },
  { id: 'bobs27', icon: 'adjust', shape: 'flower', c: 'c-success' },
  { id: 'checkout', icon: 'flag', shape: 'burst', c: 'c-error' },
];

export function Home() {
  const st = useStore();
  const active = st.active;
  const s = active ? computeActive(active) : null;

  const quick = (start) => {
    const last = st.lastSetup.x01;
    if (!last) return go('#/play/x01');
    startMatch('x01', { ...last, start });
  };

  return html`<div class="screen-enter">
    <header class="topbar">
      <div class="brand grow"><span class="brand-word">nine<b>darter</b></span></div>
      <a class="btn icon-btn" href="#/settings" title=${t('nav.settings')}><${Icon} n="tune" /></a>
    </header>

    ${active && html`<div class="card tertiary row" style="margin-bottom:16px;border-radius:var(--r-2xl)">
      <div class="grow stack s">
        <div class="label-l">${t('home.resume')}</div>
        <div class="title-l">${modeName(active.type, active.config)}</div>
        <div class="row" style="gap:6px">${active.config.players.map((p) => html`<${Avatar} p=${p} />`)}
          <span class="body-m" style="margin-left:6px">${active.type === 'x01' && s ? s.remaining.join(' · ') : ''}</span></div>
      </div>
      <div class="stack s">
        <${Btn} kind="filled" icon="play_arrow" onClick=${() => go('#/game')}>${t('common.continue')}<//>
        <${Btn} kind="text" size="s" onClick=${async () => { if (await confirmDialog({ title: t('game.abandonQ'), text: t('game.abandonText'), ok: t('game.abandon'), cancel: t('common.cancel'), danger: true, icon: 'delete' })) abandonMatch(); }}>${t('game.abandon')}<//>
      </div>
    </div>`}

    <section class="hero">
      <${Shape} name="cookie" cls="deco" />
      <${Shape} name="flower" cls="deco2" />
      <div class="label-l" style="opacity:.8">${t('home.kicker')}</div>
      <h1>${t('home.title')}</h1>
      <div class="row wrap">
        <${Btn} kind="filled" size="m" icon="play_arrow" onClick=${() => go('#/play/x01')}>${t('home.newGame')}<//>
        ${[501, 301].map((n) => html`<${Btn} kind="tonal" size="m" onClick=${() => quick(n)}>${n}<//>`)}
      </div>
    </section>

    <h2 class="title-m section-title">${t('home.modes')}</h2>
    <div class="grid auto">
      ${MODES.map((m) => html`<button class=${'mode-card ' + m.c} onClick=${() => go('#/play/' + m.id)}>
        <div class="shape"><${Shape} name=${m.shape} /><${Icon} n=${m.icon} fill /></div>
        <div class="title-l">${t('mode.' + m.id)}</div>
        <div class="desc">${t('mode.' + m.id + '.desc')}</div>
        <span class="go"><${Icon} n="arrow_outward" /></span>
      </button>`)}
    </div>

    ${st.matches.length > 0 && html`
      <h2 class="title-m section-title">${t('home.recent')}</h2>
      <div class="list">
        ${st.matches.slice(0, 3).map((m) => html`<${RecentItem} m=${m} />`)}
      </div>`}
  </div>`;
}

export function RecentItem({ m }) {
  const w = m.players.find((p) => p.id === m.winner);
  const d = new Date(m.date);
  return html`<button class="list-item" onClick=${() => go('#/result/' + m.id)}>
    <div class="lead"><${Icon} n=${MODES.find((x) => x.id === m.type)?.icon || 'sports_score'} /></div>
    <div class="grow">
      <div class="title-s">${modeName(m.type, m.config)}</div>
      <div class="meta">${m.players.map((p) => p.name).join(' · ')}</div>
    </div>
    <div style="text-align:right">
      ${w && m.players.length > 1 && html`<div class="badge win">${w.name}</div>`}
      <div class="meta">${d.toLocaleDateString()} ${d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
    </div>
  </button>`;
}

export { MODES };
