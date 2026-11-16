import { html, useState, useRef, useEffect } from '../../vendor/preact-htm.js';
import { t } from '../i18n.js';
import { Icon, IconBtn, Btn, Avatar, openDialog, haptic } from '../ui.js';
import { addPlayer } from '../store.js';

export function modeName(type, c) {
  if (type === 'x01') {
    const fmt = c.sets ? `${t('setup.firstTo')} ${c.setsToWin} ${t('setup.sets')}` : `${t('setup.firstTo')} ${c.legsToWin} ${t(c.legsToWin === 1 ? 'setup.leg' : 'setup.legs')}`;
    return `${c.start} · ${fmt}${c.teams ? ' · ' + t('setup.teams') : ''}`;
  }
  if (type === 'cricket') return `${t('cricket.' + (c.mode || 'cricket'))}${c.no1011 ? ' · ' + t('setup.no1011Short') : ''}${c.cutthroat || c.variant === 'cutthroat' ? ' · ' + t('setup.penalty') : ''}${c.teams ? ' · ' + t('setup.teams') : ''}`;
  if (type === 'atc') return `${t('mode.atc')}${c.mode !== 'any' ? ' · ' + t('setup.atc.' + c.mode) : ''}`;
  if (type === 'checkout') return `${t('mode.checkout')} · ${c.min}–${c.max}`;
  return t('mode.' + type);
}

export const TopBar = ({ title, back = '#/', children }) => html`<header class="topbar">
  ${back !== false && html`<a class="btn icon-btn" href=${back} title=${t('common.back')} onClick=${(e) => { if (back === 'history') { e.preventDefault(); history.back(); } }}><${Icon} n="arrow_back" /></a>`}
  <div class="title headline-s">${title}</div>${children}
</header>`;

export function Stepper({ value, min = 1, max = 99, onChange, label }) {
  return html`<div class="row" style="gap:8px" role="group" aria-label=${label}>
    <${IconBtn} icon="remove" kind="tonal" onClick=${() => onChange(Math.max(min, value - 1))} disabled=${value <= min} title="-" />
    <div class="headline-m num" style="min-width:48px;text-align:center">${value}</div>
    <${IconBtn} icon="add" kind="tonal" onClick=${() => onChange(Math.min(max, value + 1))} disabled=${value >= max} title="+" />
  </div>`;
}

export function newPlayerDialog() {
  return openDialog((close) => {
    const Inner = () => {
      const [name, setName] = useState('');
      const ref = useRef();
      useEffect(() => { setTimeout(() => ref.current?.focus(), 30); }, []);
      const ok = () => { if (name.trim()) close(addPlayer(name)); };
      return html`<div class="headline-s">${t('players.new')}</div>
        <input class="textfield" ref=${ref} placeholder=${t('players.name')} value=${name} maxlength="24"
          onInput=${(e) => setName(e.target.value)} onKeyDown=${(e) => e.key === 'Enter' && ok()} />
        <div class="actions"><${Btn} kind="text" onClick=${() => close(null)}>${t('common.cancel')}<//><${Btn} kind="filled" onClick=${ok} disabled=${!name.trim()}>${t('common.add')}<//></div>`;
    };
    return html`<${Inner} />`;
  });
}

/** Multi-select player chips; `selected` is an ordered array of ids. */
export function PlayerPicker({ players, selected, onChange, max = 8, single = false }) {
  const toggle = (id) => {
    haptic(8);
    if (single) return onChange([id]);
    if (selected.includes(id)) onChange(selected.filter((x) => x !== id));
    else if (selected.length < max) onChange([...selected, id]);
  };
  return html`<div class="chips">
    ${players.map((p) => {
      const idx = selected.indexOf(p.id);
      return html`<button class=${'chip' + (idx >= 0 ? ' on' : '')} onClick=${() => toggle(p.id)} aria-pressed=${idx >= 0}>
        <${Avatar} p=${p} />${p.name}${idx >= 0 && !single && selected.length > 1 ? html`<span class="badge" style="margin-left:2px">${idx + 1}</span>` : ''}
      </button>`;
    })}
    <button class="chip plain" onClick=${async () => { const p = await newPlayerDialog(); if (p) onChange(single ? [p.id] : [...selected, p.id].slice(0, max)); }}>
      <${Icon} n="person_add" size=${18} />${t('players.add')}
    </button>
  </div>`;
}
