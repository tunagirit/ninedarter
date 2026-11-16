// ninedarter — app entry: router, navigation, theming.
import { html, render, useState, useEffect } from '../vendor/preact-htm.js';
import { useStore } from './store.js';
import { t } from './i18n.js';
import { Icon, DialogHost, SnackHost } from './ui.js';
import { Home } from './screens/home.js';
import { Setup } from './screens/setup.js';
import { Game } from './screens/game.js';
import { Result, History } from './screens/results.js';
import { Stats } from './screens/stats.js';
import { Profile, newPasswordDialog } from './screens/profile.js';
import { initCloud } from './cloud.js';
import { Settings } from './screens/settings.js';

export const VERSION = '1.0.1';

function useHash() {
  const get = () => (location.hash.replace(/^#\/?/, '') || '').split('/').filter(Boolean);
  const [r, set] = useState(get());
  useEffect(() => {
    const on = () => { set(get()); window.scrollTo({ top: 0 }); };
    addEventListener('hashchange', on);
    return () => removeEventListener('hashchange', on);
  }, []);
  return r;
}

const NAV = [
  { id: '', icon: 'target', key: 'nav.play' },
  { id: 'profile', icon: 'account_circle', key: 'nav.profile' },
  { id: 'stats', icon: 'monitoring', key: 'nav.stats' },
  { id: 'history', icon: 'history', key: 'nav.history' },
  { id: 'settings', icon: 'settings', key: 'nav.settings' },
];

function Nav({ current }) {
  const top = ['play', 'game', 'result'].includes(current) ? '' : current;
  return html`<nav class="navbar" aria-label="Main">
    <a class="rail-fab" href="#/play/x01" title=${t('home.quick')}><${Icon} n="sports_score" /></a>
    ${NAV.map((n) => html`<a class=${'nav-item' + (top === n.id ? ' active' : '')} href=${'#/' + n.id} aria-current=${top === n.id ? 'page' : null}>
      <span class="pill"><${Icon} n=${n.icon} /></span><span class="label-m">${t(n.key)}</span>
    </a>`)}
  </nav>`;
}

function App() {
  const st = useStore();
  const route = useHash();
  const { theme, hue, lang } = st.settings;
  useEffect(() => { if (st.cloud?.recovery) newPasswordDialog(); }, [st.cloud?.recovery]);

  useEffect(() => {
    const root = document.documentElement;
    if (theme === 'system') root.removeAttribute('data-theme'); else root.setAttribute('data-theme', theme);
    root.style.setProperty('--h', hue);
    root.lang = lang;
    const meta = document.querySelector('meta[name=theme-color]');
    if (meta) meta.content = getComputedStyle(document.body).backgroundColor;
  }, [theme, hue, lang]);

  const [a, b] = route;
  let screen, full = false;
  switch (a) {
    case 'play': screen = html`<${Setup} type=${b || 'x01'} key=${b} />`; break;
    case 'game': full = true; screen = st.active ? html`<${Game} key=${st.active.id} />` : html`<${Home} />`; break;
    case 'result': screen = html`<${Result} id=${b} key=${b} />`; break;
    case 'history': screen = html`<${History} />`; break;
    case 'stats': screen = html`<${Stats} pid=${b} />`; break;
    case 'players': case 'profile': screen = html`<${Profile} />`; break;
    case 'settings': screen = html`<${Settings} />`; break;
    default: screen = html`<${Home} />`;
  }
  return html`<div class=${'shell' + (full ? ' fullscreen' : '')}>
      ${!full && html`<${Nav} current=${a || ''} />`}
      <main class="main">${screen}</main>
    </div>
    <${DialogHost} /><${SnackHost} />`;
}

render(html`<${App} />`, document.getElementById('app'));
initCloud();

if ('serviceWorker' in navigator && location.protocol.startsWith('http')) {
  addEventListener('load', () => navigator.serviceWorker.register('./sw.js').catch(() => {}));
}
