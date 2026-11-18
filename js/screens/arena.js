// Arena: tournament mode and online play (coming soon).
import { html } from '../../vendor/preact-htm.js';
import { t } from '../i18n.js';
import { Icon, Shape, snack, haptic } from '../ui.js';
import { TopBar } from './common.js';

const ITEMS = [
  { id: 'tournament', icon: 'emoji_events', shape: 'cookie', c: 'c-primary' },
  { id: 'online', icon: 'public', shape: 'clover', c: 'c-tertiary' },
];

export function Arena() {
  return html`<div class="screen-enter arena-screen">
    <${TopBar} title=${t('nav.arena')} back=${false} />
    <div class="arena-split">
      ${ITEMS.map((it) => html`<button class=${'arena-card ' + it.c} key=${it.id} onClick=${() => { haptic(12); snack(t('arena.soonSnack', { name: t('arena.' + it.id) })); }}>
        <span class="arena-deco"><${Shape} name=${it.shape} /></span>
        <span class="arena-icon"><${Icon} n=${it.icon} size=${56} /></span>
        <span class="arena-title">${t('arena.' + it.id)}</span>
        <span class="arena-sub">${t('arena.' + it.id + '.desc')}</span>
        <span class="arena-soon"><${Icon} n="schedule" size=${18} /> ${t('arena.soon')}</span>
      </button>`)}
    </div>
  </div>`;
}
