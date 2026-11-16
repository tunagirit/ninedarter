import { html, useState } from '../../vendor/preact-htm.js';
import { useStore, update } from '../store.js';
import { t } from '../i18n.js';
import { Icon, Btn, Avatar, openDialog, confirmDialog, EmptyState, snack, fmt1, shapePath } from '../ui.js';
import { go } from '../match.js';
import { TopBar, newPlayerDialog } from './common.js';
import { aggregateX01 } from './stats.js';

const HUES = [262, 300, 330, 0, 20, 45, 80, 150, 175, 200, 230];
const SHAPES = ['cookie', 'flower', 'clover', 'sunny', 'burst', 'pill', 'gem', 'puffy', 'circle'];

function editDialog(p) {
  return openDialog((close) => {
    const Inner = () => {
      const [name, setName] = useState(p.name);
      const [hue, setHue] = useState(p.hue);
      const [shape, setShape] = useState(p.shape || 'cookie');
      const save = () => {
        if (!name.trim()) return;
        update((s) => { s.players = s.players.map((x) => (x.id === p.id ? { ...x, name: name.trim(), hue, shape } : x)); });
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
          <${Btn} kind="text" icon="delete" cls="" onClick=${() => close('delete')}>${t('common.delete')}<//>
          <span class="grow"></span>
          <${Btn} kind="text" onClick=${() => close(false)}>${t('common.cancel')}<//>
          <${Btn} kind="filled" onClick=${save}>${t('common.save')}<//>
        </div>`;
    };
    return html`<${Inner} />`;
  });
}

export function Players() {
  const st = useStore();
  const edit = async (p) => {
    const r = await editDialog(p);
    if (r === 'delete' && (await confirmDialog({ title: t('players.deleteQ', { name: p.name }), text: t('players.deleteText'), ok: t('common.delete'), cancel: t('common.cancel'), danger: true, icon: 'person_remove' }))) {
      update((s) => { s.players = s.players.filter((x) => x.id !== p.id); });
      snack(t('players.deleted'));
    }
  };
  return html`<div class="screen-enter stack">
    <${TopBar} title=${t('nav.players')} back=${false}>
      <${Btn} kind="filled" icon="person_add" onClick=${() => newPlayerDialog()}>${t('players.add')}<//>
    <//>
    ${st.players.length ? html`<div class="list">${st.players.map((p) => {
      const a = aggregateX01(st.matches, p.id);
      return html`<div class="list-item" key=${p.id}>
        <${Avatar} p=${p} size="l" />
        <button class="grow" style="background:none;border:0;text-align:left;cursor:pointer;padding:0" onClick=${() => go('#/stats/' + p.id)}>
          <div class="title-m">${p.name}</div>
          <div class="meta">${a.n ? `⌀ ${fmt1(a.avg)} · ${a.n} ${t('stats.matchesShort')}${a.t180 ? ' · 180×' + a.t180 : ''}` : t('players.noGames')}</div>
        </button>
        <button class="btn icon-btn" title=${t('common.edit')} onClick=${() => edit(p)}><${Icon} n="edit" /></button>
      </div>`;
    })}</div>` : html`<${EmptyState} icon="group_add" title=${t('players.empty')} text=${t('players.emptyText')}><${Btn} kind="filled" size="m" icon="person_add" onClick=${() => newPlayerDialog()}>${t('players.add')}<//><//>`}
  </div>`;
}
