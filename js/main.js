// ninedarter — app entry: router, navigation, theming.
import { html, render, useState, useEffect } from '../vendor/preact-htm.js';
import { useStore } from './store.js';
import { t } from './i18n.js';
import { Icon, DialogHost, SnackHost } from './ui.js';
import { Home } from './screens/home.js';
import { Setup, PlayHub } from './screens/setup.js';
import { Game } from './screens/game.js';
import { Result } from './screens/results.js';
import { Arena } from './screens/arena.js';
import { Profile, newPasswordDialog } from './screens/profile.js';
import { initCloud } from './cloud.js';
import { Settings } from './screens/settings.js';
import { FriendPage, Messages, Chat, Notifications } from './screens/social.js';

export const VERSION = '1.1.0';

// PWA install prompt (Chrome/Edge/Android); Settings shows an install button when available
window.__installPrompt = null;
addEventListener('beforeinstallprompt', (e) => { e.preventDefault(); window.__installPrompt = e; dispatchEvent(new Event('nd-installable')); });
addEventListener('appinstalled', () => { window.__installPrompt = null; dispatchEvent(new Event('nd-installable')); });

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
  { id: 'arena', icon: 'stadium', key: 'nav.arena' },
  { id: 'settings', icon: 'settings', key: 'nav.settings' },
];

function Nav({ current }) {
  const top = ['play', 'game', 'result', 'messages', 'notifications'].includes(current) ? '' : current === 'friend' || current === 'stats' || current === 'history' ? 'profile' : current;
  return html`<nav class="navbar" aria-label="Main">
    <a class="rail-fab" href="#/play" title=${t('home.newGame')}><${Icon} n="sports_score" /></a>
    ${NAV.map((n) => html`<a class=${'nav-item' + (top === n.id ? ' active' : '')} href=${'#/' + n.id} aria-current=${top === n.id ? 'page' : null}>
      <span class="pill"><${Icon} n=${n.icon} /></span><span class="label-m">${t(n.key)}</span>
    </a>`)}
  </nav>`;
}

/** Settings → Display size: small / medium (default) / large. */
export const UI_SCALES = { small: 0.88, medium: 1, large: 1.14 };
function applyScale(name) {
  const z = UI_SCALES[name] || 1;
  const root = document.documentElement;
  root.style.zoom = z === 1 ? '' : String(z);
  root.style.setProperty('--zoom', z);
}

// iOS Safari only shows :active press states when the page has a touch listener
document.addEventListener('touchstart', () => {}, { passive: true });
// iOS: no pinch-zoom of the app (the Display size setting replaces it)
for (const ev of ['gesturestart', 'gesturechange']) document.addEventListener(ev, (e) => e.preventDefault());

/**
 * Browser/OS chrome colour (iOS home-indicator strip, Android status bar) = the bottom navigation bar colour.
 * Reported as #rrggbb: some browsers (iOS) ignore oklch() here and fall back to the manifest colour.
 */
function syncThemeColor() {
  setTimeout(() => {
    const probe = document.createElement('div');
    probe.style.cssText = 'position:absolute;width:1px;height:1px;opacity:0;pointer-events:none;background:var(--surface-container)';
    document.body.appendChild(probe);
    const css = getComputedStyle(probe).backgroundColor;
    probe.remove();
    let hex = '#f1f0f7';
    try {
      const c = document.createElement('canvas'); c.width = c.height = 1;
      const g = c.getContext('2d'); g.fillStyle = css; g.fillRect(0, 0, 1, 1);
      const [r, gr, b] = g.getImageData(0, 0, 1, 1).data;
      hex = '#' + [r, gr, b].map((v) => v.toString(16).padStart(2, '0')).join('');
    } catch {}
    let meta = document.querySelector('meta[name=theme-color]');
    if (!meta) { meta = document.createElement('meta'); meta.name = 'theme-color'; document.head.appendChild(meta); }
    meta.content = hex;
    document.documentElement.style.backgroundColor = hex; // overscroll/bottom areas match the nav bar
  }, 0);
}

function App() {
  const st = useStore();
  const route = useHash();
  const { theme, hue, lang, uiScale } = st.settings;
  useEffect(() => { if (st.cloud?.recovery) newPasswordDialog(); }, [st.cloud?.recovery]);

  useEffect(() => {
    const root = document.documentElement;
    if (theme === 'system') root.removeAttribute('data-theme'); else root.setAttribute('data-theme', theme);
    root.style.setProperty('--h', hue);
    root.lang = lang;
    applyScale(uiScale);
    syncThemeColor();
    // follow the OS light/dark switch when the theme is "system"
    const mq = matchMedia('(prefers-color-scheme: dark)');
    mq.addEventListener?.('change', syncThemeColor);
    return () => mq.removeEventListener?.('change', syncThemeColor);
  }, [theme, hue, lang, uiScale]);

  const [a, b] = route;
  let screen, full = false;
  switch (a) {
    case 'play': screen = b === 'akyaka' ? html`<${Setup} type="cricket" preset="akyaka" key="akyaka" />` : b ? html`<${Setup} type=${b} key=${b} />` : html`<${PlayHub} />`; break;
    case 'game': full = true; screen = st.active ? html`<${Game} key=${st.active.id} />` : html`<${Home} />`; break;
    case 'result': screen = html`<${Result} id=${b} key=${b} />`; break;
    case 'history': screen = html`<${Profile} tab="history" key="history" />`; break;
    case 'arena': screen = html`<${Arena} />`; break;
    case 'stats': screen = html`<${Profile} tab="stats" pid=${b} key=${'stats' + (b || '')} />`; break;
    case 'players': case 'profile': screen = html`<${Profile} key="profile" />`; break;
    case 'settings': screen = html`<${Settings} />`; break;
    case 'friend': screen = html`<${FriendPage} id=${b} key=${b} />`; break;
    case 'messages': if (b) { full = true; screen = html`<${Chat} id=${b} key=${b} />`; } else screen = html`<${Messages} />`; break;
    case 'notifications': screen = html`<${Notifications} />`; break;
    default: screen = html`<${Home} />`;
  }
  useEffect(() => { document.documentElement.classList.toggle('locked', full && a === 'game'); }, [full, a]);
  return html`<div class=${'shell' + (full ? ' fullscreen' : '')}>
      ${!full && html`<${Nav} current=${a || ''} />`}
      <main class="main">${screen}</main>
    </div>
    <${DialogHost} /><${SnackHost} />`;
}

render(html`<${App} />`, document.getElementById('app'));
initCloud();

if ('serviceWorker' in navigator && location.protocol.startsWith('http')) {
  // When a new version takes over, reload once so the fresh files are used (not on the very first install).
  const hadController = !!navigator.serviceWorker.controller;
  let reloaded = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (!hadController || reloaded || document.querySelector('.scrim')) return;
    reloaded = true;
    location.reload();
  });
  addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js', { updateViaCache: 'none' }).then((reg) => {
      // check for a new version whenever the app comes back to the foreground
      document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') reg.update().catch(() => {}); });
    }).catch(() => {});
  });
}
