import { html } from '../../vendor/preact-htm.js';
import { useStore, mePlayer, friendPlayer } from '../store.js';
import { t } from '../i18n.js';
import { Icon, Btn, Shape, Avatar, confirmDialog } from '../ui.js';
import { computeActive, go, abandonMatch, startMatch } from '../match.js';
import { modeName } from './common.js';
import { winnerNames } from '../teams.js';
import { aggregateX01 } from './stats.js';
import { useSocialCounts } from './social.js';
import { cloudEnabled } from '../cloud.js';
import { fmt1 } from '../ui.js';

const greetingKey = () => { const h = new Date().getHours(); return h < 5 ? 'home.hi.night' : h < 12 ? 'home.hi.morning' : h < 18 ? 'home.hi.day' : h < 22 ? 'home.hi.evening' : 'home.hi.night'; };

/** Small sparkline of the last match averages. */
function Spark({ data }) {
  if (data.length < 2) return null;
  const d = data.slice(-8), W = 120, H = 34, max = Math.max(...d), min = Math.min(...d);
  const x = (i) => (i / (d.length - 1)) * (W - 6) + 3, y = (v) => H - 4 - ((v - min) / (max - min || 1)) * (H - 8);
  const pts = d.map((v, i) => `${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(' ');
  return html`<svg class="spark" viewBox=${`0 0 ${W} ${H}`} preserveAspectRatio="none" aria-hidden="true"><polyline points=${pts} /><circle cx=${x(d.length - 1)} cy=${y(d.at(-1))} r="3.5" /></svg>`;
}

function Welcome() {
  const st = useStore();
  const me = mePlayer(st);
  const a = aggregateX01(st.matches, me.id);
  const played = st.matches.filter((m) => m.players.some((p) => p.id === me.id)).length;
  const online = st.friends.slice(0, 4);
  return html`<section class="welcome">
    <button class="welcome-head" onClick=${() => go('#/profile')}>
      <${Avatar} p=${me} size="l" />
      <div class="grow" style="min-width:0">
        <div class="label-m muted">${t(greetingKey())}</div>
        <div class="title-l ellipsis">${me.name}</div>
        ${st.account ? html`<div class="body-s muted ellipsis">@${st.account.username}</div>` : html`<div class="body-s muted">${t('profile.offline')}</div>`}
      </div>
    </button>
    <div class="welcome-stats">
      <div><span class="v num">${a.n ? fmt1(a.avg) : '–'}</span><span class="k">${t('stats.avgShort')}</span></div>
      <div><span class="v num">${played}</span><span class="k">${t('stats.matchesShort')}</span></div>
      <div><span class="v num">${a.t180}</span><span class="k">180</span></div>
    </div>
    <${Spark} data=${a.series} />
    ${st.account ? (online.length ? html`<button class="welcome-friends" onClick=${() => go('#/profile')}>
          <div class="stackav">${online.map((f) => html`<${Avatar} p=${friendPlayer(f)} />`)}</div>
          <span class="body-s">${t('home.friendsN', { n: st.friends.length })}</span></button>`
        : html`<button class="welcome-cta" onClick=${() => go('#/profile')}><${Icon} n="person_add" size=${18} />${t('home.addFriends')}</button>`)
      : cloudEnabled() && html`<button class="welcome-cta" onClick=${() => go('#/profile')}><${Icon} n="login" size=${18} />${t('home.signInCta')}</button>`}
  </section>`;
}

const BadgeBtn = ({ href, icon, n, title }) => html`<a class="btn icon-btn badge-btn" href=${href} title=${title} aria-label=${title}><${Icon} n=${icon} fill=${n > 0} />${n > 0 && html`<span class="dot-badge">${n > 9 ? '9+' : n}</span>`}</a>`;

const GAMES = [
  { id: 'x01', icon: 'sports_score', shape: 'cookie', c: 'c-primary' },
  { id: 'cricket', icon: 'grid_view', shape: 'clover', c: 'c-tertiary' },
];
const PRACTICE = [
  { id: 'c121', icon: 'trending_up', shape: 'gem', c: 'c-primary' },
  { id: 'atc', icon: 'schedule', shape: 'sunny', c: 'c-secondary' },
  { id: 'bobs27', icon: 'adjust', shape: 'flower', c: 'c-success' },
  { id: 'doubles', icon: 'filter_2', shape: 'puffy', c: 'c-tertiary' },
  { id: 'checkout', icon: 'shuffle', shape: 'burst', c: 'c-error' },
  { id: 'shanghai', icon: 'stacks', shape: 'clover', c: 'c-secondary' },
  { id: 'akyaka', icon: 'format_list_numbered', shape: 'flower', c: 'c-tertiary' },
];
const MODES = [...GAMES, ...PRACTICE];
const ModeCard = ({ m, small }) => html`<button class=${'mode-card ' + m.c + (small ? ' small' : '')} onClick=${() => go('#/play/' + m.id)}>
  <div class="shape"><${Shape} name=${m.shape} /><${Icon} n=${m.icon} fill /></div>
  <div class="title-l">${t('mode.' + m.id)}</div>
  <div class="desc">${t('mode.' + m.id + '.desc')}</div>
  <span class="go"><${Icon} n="arrow_outward" /></span>
</button>`;

export function Home() {
  const st = useStore();
  const active = st.active;
  const s = active ? computeActive(active) : null;
  const counts = useSocialCounts();

  const quick = (start) => {
    const last = st.lastSetup.x01;
    if (!last) return go('#/play/x01');
    startMatch('x01', { ...last, start, first: 0 });
  };
  // quick Cricket: reuse the last Cricket setup (players, mode, scoring) or open the Cricket setup
  const quickCricket = () => {
    const last = st.lastSetup.cricket;
    if (!last) return go('#/play/cricket');
    // v1.0.5 keeps three penalty modes: older 'double' / 'points' setups become penalty / none
    const scoring = last.scoring === 'double' ? 'penalty' : last.scoring === 'points' ? 'none' : last.scoring || (last.cutthroat || last.variant === 'cutthroat' ? 'penalty' : 'none');
    startMatch('cricket', { ...last, scoring, rounds: 0, first: 0, selfScore: true }); // v1.0.5c: the round limit belongs to X01
  };

  return html`<div class="screen-enter">
    <header class="topbar">
      <div class="brand grow"><span class="brand-word">nine<b>darter</b></span></div>
      ${st.account && html`<${BadgeBtn} href="#/messages" icon="chat" n=${counts.unread} title=${t('nav.messages')} />`}
      <${BadgeBtn} href="#/notifications" icon="notifications" n=${counts.total} title=${t('nav.notifications')} />
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

    <div class="hero-row">
    <section class="hero">
      <${Shape} name="cookie" cls="deco" />
      <${Shape} name="flower" cls="deco2" />
      <div class="label-l" style="opacity:.8">${t('home.kicker')}</div>
      <h1>${t('home.title')}</h1>
      <div class="row wrap">
        <${Btn} kind="filled" size="m" icon="play_arrow" onClick=${() => go('#/play')}>${t('home.newGame')}<//>
        <${Btn} kind="tonal" size="m" onClick=${() => quick(501)}>501<//>
        <${Btn} kind="tonal" size="m" onClick=${quickCricket}>${t('mode.cricket')}<//>
      </div>
    </section>
    <${Welcome} />
    </div>

    <h2 class="title-m section-title"><${Icon} n="sports_score" size=${20} /> ${t('home.games')}</h2>
    <div class="grid auto games">${GAMES.map((m) => html`<${ModeCard} m=${m} />`)}</div>
    <h2 class="title-m section-title"><${Icon} n="fitness_center" size=${20} /> ${t('home.practice')}</h2>
    <div class="grid auto practice">${PRACTICE.map((m) => html`<${ModeCard} m=${m} small />`)}</div>

    ${st.matches.length > 0 && html`
      <h2 class="title-m section-title">${t('home.recent')}</h2>
      <div class="list">
        ${st.matches.slice(0, 3).map((m) => html`<${RecentItem} m=${m} />`)}
      </div>`}
  </div>`;
}

export function RecentItem({ m }) {
  const w = winnerNames(m);
  const d = new Date(m.date);
  return html`<button class="list-item" onClick=${() => go('#/result/' + m.id)}>
    <div class="lead"><${Icon} n=${MODES.find((x) => x.id === m.type)?.icon || 'sports_score'} /></div>
    <div class="grow">
      <div class="title-s">${modeName(m.type, m.config)}</div>
      <div class="meta">${m.players.map((p) => p.name).join(' · ')}</div>
    </div>
    <div style="text-align:right">
      ${w && m.players.length > 1 && html`<div class="badge win">${w}</div>`}
      <div class="meta">${d.toLocaleDateString()} ${d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
    </div>
  </button>`;
}

export { MODES };
