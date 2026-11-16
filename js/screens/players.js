// Offline player database (managed from Settings, selectable before a game).
import { html, useState, useRef, useEffect } from '../../vendor/preact-htm.js';
import { useStore, update, addPlayer, getState } from '../store.js';
import { t } from '../i18n.js';
import { Icon, IconBtn, Btn, Avatar, openDialog, confirmDialog, snack, fmt1, shapePath } from '../ui.js';
import { aggregateX01 } from './stats.js';

const HUES = [285, 320, 350, 20, 45, 80, 150, 175, 200, 235, 260];
const SHAPES = ['cookie', 'flower', 'clover', 'sunny', 'burst', 'pill', 'gem', 'puffy', 'circle'];

export function editPlayerDialog(p) {
  return openDialog((close) => {
    const Inner = () => {
      const [name, setName] = useState(p.name);
      const [hue, setHue] = useState(p.hue);
      const [shape, setShape] = useState(p.shape || 'cookie');
      const save = () => {
        const n = name.trim();
        if (!n) return;
        if (n.toLowerCase() !== p.name.toLowerCase() && dupName(n)) return snack(t('players.dup', { name: n }));
        update((s) => { s.players = s.players.map((x) => (x.id === p.id ? { ...x, name: n, hue, shape } : x)); });
        close(true);
      };
      return html`<div class="row" style="justify-content:center"><${Avatar} p=${{ name, hue, shape }} size="xl" /></div>
        <input class="textfield" value=${name} maxlength="24" onInput=${(e) => setName(e.target.value)} placeholder=${t('players.name')} onKeyDown=${(e) => e.key === 'Enter' && save()} />
        <div class="field"><span class="label-l">${t('players.color')}</span>
          <div class="swatches">${HUES.map((h) => html`<button class=${'swatch' + (h === hue ? ' on' : '')} style=${`--sh:${h}`} onClick=${() => setHue(h)} aria-label=${'hue ' + h}></button>`)}</div></div>
        <div class="field"><span class="label-l">${t('players.shape')}</span>
          <div class="swatches">${SHAPES.map((sh) => html`<button class=${'swatch' + (sh === shape ? ' on' : '')} style=${`--sh:${hue};background:transparent;color:oklch(0.6 0.15 ${hue})`} onClick=${() => setShape(sh)} aria-label=${sh}>
            <svg viewBox="0 0 100 100" width="40" height="40"><path d=${shapePath(sh)} fill="currentColor" /></svg></button>`)}</div></div>
        <div class="actions">
          <${Btn} kind="text" icon="delete" onClick=${() => close('delete')}>${t('common.delete')}<//>
          <span class="grow"></span>
          <${Btn} kind="text" onClick=${() => close(false)}>${t('common.cancel')}<//>
          <${Btn} kind="filled" onClick=${save}>${t('common.save')}<//>
        </div>`;
    };
    return html`<${Inner} />`;
  });
}

export const dupName = (name) => getState().players.some((x) => x.name.trim().toLowerCase() === name.trim().toLowerCase());

/** Ask for a name and add an offline player. Resolves to the new (or existing same-named) player. */
export function newOfflinePlayerDialog() {
  return openDialog((close) => {
    const Inner = () => {
      const [name, setName] = useState('');
      const ref = useRef();
      useEffect(() => { setTimeout(() => ref.current?.focus(), 30); }, []);
      const ok = () => {
        const n = name.trim();
        if (!n) return;
        const existing = getState().players.find((x) => x.name.trim().toLowerCase() === n.toLowerCase());
        close(existing || addPlayer(n));
      };
      return html`<div class="headline-s">${t('players.new')}</div>
        <div class="body-m muted">${t('players.newText')}</div>
        <input class="textfield" ref=${ref} placeholder=${t('players.name')} value=${name} maxlength="24"
          onInput=${(e) => setName(e.target.value)} onKeyDown=${(e) => e.key === 'Enter' && ok()} />
        ${name.trim() && dupName(name) && html`<div class="body-s muted">${t('players.existsHint')}</div>`}
        <div class="actions"><${Btn} kind="text" onClick=${() => close(null)}>${t('common.cancel')}<//><${Btn} kind="filled" onClick=${ok} disabled=${!name.trim()}>${dupName(name) ? t('players.select') : t('common.add')}<//></div>`;
    };
    return html`<${Inner} />`;
  });
}

export function OfflinePlayers() {
  const st = useStore();
  const edit = async (p) => {
    const r = await editPlayerDialog(p);
    if (r === 'delete' && (await confirmDialog({ title: t('players.deleteQ', { name: p.name }), text: t('players.deleteText'), ok: t('common.delete'), cancel: t('common.cancel'), danger: true, icon: 'person_remove' }))) {
      update((s) => { s.players = s.players.filter((x) => x.id !== p.id); });
      snack(t('players.deleted'));
    }
  };
  return html`<div class="stack s">
    ${st.players.length ? html`<div class="list">${st.players.map((p) => {
      const a = aggregateX01(st.matches, p.id);
      return html`<div class="list-item" key=${p.id} onClick=${() => edit(p)}>
        <${Avatar} p=${p} />
        <div class="grow"><div class="title-s">${p.name}</div>
          <div class="meta">${a.n ? `⌀ ${fmt1(a.avg)} · ${a.n} ${t('stats.matchesShort')}` : t('players.noGames')}</div></div>
        <${Icon} n="edit" />
      </div>`;
    })}</div>` : html`<div class="body-m muted" style="padding:8px 4px">${t('players.emptyDb')}</div>`}
    <div><${Btn} kind="tonal" icon="person_add" onClick=${() => newOfflinePlayerDialog()}>${t('players.add')}<//></div>
  </div>`;
}

export { IconBtn };
