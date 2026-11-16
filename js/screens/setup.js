import { html, useState } from '../../vendor/preact-htm.js';
import { useStore, update } from '../store.js';
import { t } from '../i18n.js';
import { Icon, IconBtn, Btn, Seg, Switch, Slider, Avatar, snack } from '../ui.js';
import { startMatch, playerFromBot } from '../match.js';
import { BOT_LEVELS } from '../bot.js';
import { TopBar, Stepper, PlayerPicker } from './common.js';

const SUPPORTS_BOT = { x01: true, cricket: true };
const MAX_PLAYERS = { x01: 8, cricket: 4, atc: 8, bobs27: 8, checkout: 1 };

export function Setup({ type }) {
  const st = useStore();
  const last = st.lastSetup[type] || {};
  const lastHumans = (last.players || []).filter((p) => !p.bot && st.players.some((x) => x.id === p.id)).map((p) => p.id);
  const [sel, setSel] = useState(lastHumans.length ? lastHumans : st.players.slice(0, 1).map((p) => p.id));
  const lastBots = (last.players || []).filter((p) => p.bot).map((p) => p.bot);
  const [bots, setBots] = useState(SUPPORTS_BOT[type] ? lastBots : []);

  // X01 options
  const [start, setStart] = useState(last.start || 501);
  const [custom, setCustom] = useState(![301, 501, 701, 1001].includes(last.start || 501));
  const [inR, setIn] = useState(last.in || 'straight');
  const [outR, setOut] = useState(last.out || 'double');
  const [fmt, setFmt] = useState(last.fmt || 'first');
  const [sets, setSets] = useState(!!last.sets);
  const [legs, setLegs] = useState(last.legsN || 3);
  const [setsN, setSetsN] = useState(last.setsN || 3);
  // Cricket
  const [variant, setVariant] = useState(last.variant || 'standard');
  const [rounds, setRounds] = useState(last.rounds ?? 0);
  const [cLegs, setCLegs] = useState(last.legsToWin || 1);
  // ATC
  const [atcMode, setAtcMode] = useState(last.mode || 'any');
  const [bull, setBull] = useState(last.bull ?? true);
  // Checkout
  const [range, setRange] = useState(last.min ? `${last.min}-${last.max}` : '41-100');
  const [ckRounds, setCkRounds] = useState(last.rounds || 10);

  const maxP = MAX_PLAYERS[type];
  const humans = sel.map((id) => st.players.find((p) => p.id === id)).filter(Boolean);
  const total = humans.length + bots.length;

  const toFirst = (n) => (fmt === 'best' ? Math.floor(n / 2) + 1 : n);

  const begin = () => {
    if (!humans.length) return snack(t('setup.needPlayer'));
    const players = [
      ...humans.map((p) => ({ id: p.id, name: p.name, hue: p.hue, shape: p.shape })),
      ...bots.map((lv) => playerFromBot(lv)),
    ];
    let cfg;
    if (type === 'x01') cfg = { players, start, in: inR, out: outR, sets, fmt, legsN: legs, setsN, legsToWin: toFirst(legs), setsToWin: toFirst(setsN) };
    else if (type === 'cricket') cfg = { players, variant, rounds, legsToWin: cLegs };
    else if (type === 'atc') cfg = { players, mode: atcMode, bull };
    else if (type === 'bobs27') cfg = { players };
    else if (type === 'checkout') { const [min, max] = range.split('-').map(Number); cfg = { players: players.slice(0, 1), min, max, rounds: ckRounds, seed: Math.floor(Math.random() * 1e9) }; }
    startMatch(type, cfg);
  };

  const shuffle = () => {
    const a = [...sel];
    for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
    setSel(a); snack(t('setup.shuffled'));
  };

  const fmtLabel = (n, one, many) => `${n} ${t(n === 1 ? one : many)}`;

  return html`<div class="screen-enter">
    <${TopBar} title=${t('mode.' + type)} back="#/" />
    <div class="setup-grid setup-pad">
      <div class="card stack">
        <div class="row between">
          <div class="title-m">${t('setup.players')} <span class="muted body-m">${total}/${maxP}</span></div>
          ${sel.length > 1 && html`<${Btn} kind="text" size="s" icon="shuffle" onClick=${shuffle}>${t('setup.shuffle')}<//>`}
        </div>
        <${PlayerPicker} players=${st.players} selected=${sel} onChange=${(v) => setSel(v.slice(0, maxP - bots.length))} single=${maxP === 1} max=${maxP - bots.length} />
        ${humans.length > 1 && html`<div class="row wrap" style="gap:6px">${humans.map((p, i) => html`<span class="chip on" style="padding-right:12px"><${Avatar} p=${p} />${i + 1}. ${p.name}</span>`)}</div>`}
        ${SUPPORTS_BOT[type] && html`
          ${bots.map((lv, i) => html`<div class="bot-row">
            <${Avatar} p=${playerFromBot(lv)} />
            <div class="grow stack s" style="gap:2px">
              <div class="row between"><span class="title-s">${t('setup.bot')} · ${t('setup.level')} ${lv}</span><span class="body-s muted">~${BOT_LEVELS[lv - 1].avg} ${t('stats.avgShort')}</span></div>
              ${type === 'x01' || type === 'cricket' ? html`<${Slider} min=${1} max=${BOT_LEVELS.length} value=${lv} label=${t('setup.level')} onInput=${(v) => setBots(bots.map((b, j) => (j === i ? v : b)))} />` : null}
            </div>
            <${IconBtn} icon="close" title=${t('common.remove')} onClick=${() => setBots(bots.filter((_, j) => j !== i))} />
          </div>`)}
          ${total < maxP && html`<div><${Btn} kind="outlined" size="s" icon="smart_toy" onClick=${() => setBots([...bots, 5])}>${t('setup.addBot')}<//></div>`}
        `}
      </div>

      <div class="card stack">
        ${type === 'x01' && html`
          <div class="field"><span class="label-l">${t('setup.startScore')}</span>
            <${Seg} value=${custom ? 'c' : start} onChange=${(v) => { if (v === 'c') setCustom(true); else { setCustom(false); setStart(v); } }}
              options=${[301, 501, 701, 1001].map((v) => ({ value: v, label: String(v), icon: false })).concat([{ value: 'c', label: t('setup.custom'), icon: false }])} />
            ${custom && html`<input class="textfield" type="number" min="2" max="9999" value=${start} onInput=${(e) => setStart(Math.max(2, Math.min(9999, +e.target.value || 501)))} />`}
          </div>
          <div class="grid resp">
            <div class="field"><span class="label-l">${t('setup.in')}</span>
              <${Seg} size="s" value=${inR} onChange=${setIn} options=${['straight', 'double', 'master'].map((v) => ({ value: v, label: t('rule.' + v), icon: false }))} /></div>
            <div class="field"><span class="label-l">${t('setup.out')}</span>
              <${Seg} size="s" value=${outR} onChange=${setOut} options=${['double', 'straight', 'master'].map((v) => ({ value: v, label: t('rule.' + v), icon: false }))} /></div>
          </div>
          <div class="field"><span class="label-l">${t('setup.format')}</span>
            <div class="grid cols-2">
              <${Seg} size="s" value=${fmt} onChange=${setFmt} options=${[{ value: 'first', label: t('setup.firstTo') }, { value: 'best', label: t('setup.bestOf') }]} />
              <${Seg} size="s" value=${sets} onChange=${setSets} options=${[{ value: false, label: 'Leg' }, { value: true, label: 'Set' }]} />
            </div>
          </div>
          <div class="row wrap" style="justify-content:space-around">
            ${sets && html`<div class="stack s" style="align-items:center"><span class="label-l muted">${t('setup.sets')}</span><${Stepper} value=${setsN} max=${25} onChange=${setSetsN} label=${t('setup.sets')} /></div>`}
            <div class="stack s" style="align-items:center"><span class="label-l muted">${sets ? t('setup.legsPerSet') : t('setup.legs')}</span><${Stepper} value=${legs} max=${25} onChange=${setLegs} label=${t('setup.legs')} /></div>
          </div>
          <div class="body-m muted" style="text-align:center">
            ${sets ? `${t('setup.firstTo')} ${fmtLabel(toFirst(setsN), 'setup.set', 'setup.sets')} · ${t('setup.eachSet')} ${fmtLabel(toFirst(legs), 'setup.leg', 'setup.legs')}` : `${t('setup.firstTo')} ${fmtLabel(toFirst(legs), 'setup.leg', 'setup.legs')}`}
          </div>
        `}
        ${type === 'cricket' && html`
          <div class="field"><span class="label-l">${t('setup.variant')}</span>
            <${Seg} value=${variant} onChange=${setVariant} options=${[{ value: 'standard', label: t('setup.standard') }, { value: 'cutthroat', label: t('setup.cutthroat') }]} /></div>
          <div class="field"><span class="label-l">${t('setup.roundLimit')}</span>
            <${Seg} value=${rounds} onChange=${setRounds} options=${[0, 15, 20, 25].map((v) => ({ value: v, label: v ? String(v) : t('setup.none'), icon: false }))} /></div>
          <div class="row between"><span class="label-l muted">${t('setup.firstTo')} (${t('setup.legs')})</span><${Stepper} value=${cLegs} max=${15} onChange=${setCLegs} label=${t('setup.legs')} /></div>
          <div class="body-s muted">${t(variant === 'cutthroat' ? 'setup.cutthroat.desc' : 'setup.standard.desc')}</div>
        `}
        ${type === 'atc' && html`
          <div class="field"><span class="label-l">${t('setup.target')}</span>
            <${Seg} value=${atcMode} onChange=${setAtcMode} options=${['any', 'double', 'treble'].map((v) => ({ value: v, label: t('setup.atc.' + v) }))} /></div>
          <div class="setting" style="border-radius:var(--r-l)"><${Icon} n="radio_button_checked" /><div class="grow">${t('setup.includeBull')}</div><${Switch} checked=${bull} onChange=${setBull} label=${t('setup.includeBull')} /></div>
          <div class="body-s muted">${t('mode.atc.long')}</div>
        `}
        ${type === 'bobs27' && html`<div class="body-m">${t('mode.bobs27.long')}</div>`}
        ${type === 'checkout' && html`
          <div class="field"><span class="label-l">${t('setup.range')}</span>
            <${Seg} wrap value=${range} onChange=${setRange} options=${['2-40', '41-100', '101-130', '131-170', '2-170'].map((v) => ({ value: v, label: v.replace('-', '–'), icon: false }))} /></div>
          <div class="field"><span class="label-l">${t('setup.rounds')}</span>
            <${Seg} value=${ckRounds} onChange=${setCkRounds} options=${[10, 20, 30].map((v) => ({ value: v, label: String(v), icon: false }))} /></div>
          <div class="body-s muted">${t('mode.checkout.long')}</div>
        `}
      </div>
    </div>
    <div class="start-bar"><${Btn} kind="filled" size="l" icon="play_arrow" onClick=${begin}>${t('setup.start')}<//></div>
  </div>`;
}
