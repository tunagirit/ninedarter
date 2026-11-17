import { html, useState } from '../../vendor/preact-htm.js';
import { useStore, mePlayer, friendPlayer, offlinePlayer } from '../store.js';
import { t } from '../i18n.js';
import { Icon, IconBtn, Btn, Seg, Switch, Slider, Avatar, snack, openDialog, haptic } from '../ui.js';
import { startMatch, playerFromBot } from '../match.js';
import { BOT_LEVELS, CRICKET_MPR } from '../bot.js';
import { TopBar, Stepper } from './common.js';
import { newOfflinePlayerDialog } from './players.js';
import { cloudEnabled } from '../cloud.js';

const SUPPORTS_BOT = { x01: true, cricket: true };
const MAX_PLAYERS = { x01: 8, cricket: 4, atc: 8, bobs27: 8, checkout: 1, c121: 1, doubles: 8, shanghai: 8 };
const SUPPORTS_TEAMS = { x01: true, cricket: true };
const KIND_ICON = { me: 'person', friend: 'cloud', offline: 'person_outline', bot: 'smart_toy' };

/** Rebuild a roster entry from a saved snapshot, against current data (drops unknown players). */
function resolve(p, st) {
  const me = mePlayer(st);
  if (p.bot) return playerFromBot(p.bot);
  if (p.kind === 'me' || p.id === me.id || p.id === st.profile.localId) return me;
  const off = st.players.find((x) => x.id === p.id);
  if (off) return offlinePlayer(off);
  const fr = st.friends.find((x) => x.id === p.id);
  if (fr) return friendPlayer(fr);
  return null;
}

function addPlayersDialog({ st, roster, room, allowBot }) {
  return openDialog((close) => {
    const Inner = () => {
      const s = useStore();
      const [picked, setPicked] = useState([]);
      const [tab, setTab] = useState(s.friends.length ? 'friends' : 'offline');
      const [lv, setLv] = useState(5);
      const me = mePlayer(s);
      const taken = new Set([...roster, ...picked].map((p) => p.id));
      const left = room - picked.length;
      const pick = (p) => { if (left <= 0) return snack(t('setup.full')); haptic(10); setPicked([...picked, p]); };
      const unpick = (id) => setPicked(picked.filter((p) => p.id !== id));
      const Row = ({ p, sub }) => {
        const on = picked.some((x) => x.id === p.id);
        return html`<button class=${'pick-row' + (on ? ' on' : '')} onClick=${() => (on ? unpick(p.id) : pick(p))}>
          <${Avatar} p=${p} size="l" /><div class="grow"><div class="title-m">${p.name}</div>${sub && html`<div class="body-s muted">${sub}</div>`}</div>
          <span class="pick-check"><${Icon} n=${on ? 'check' : 'add'} /></span>
        </button>`;
      };
      const offline = s.players.map(offlinePlayer).filter((p) => !roster.some((r) => r.id === p.id));
      const friends = s.friends.map(friendPlayer).filter((p) => !roster.some((r) => r.id === p.id));
      const tabs = [
        { value: 'friends', label: t('setup.tabFriends'), icon: 'cloud' },
        { value: 'offline', label: t('setup.tabOffline'), icon: 'person_outline' },
        ...(allowBot ? [{ value: 'bot', label: t('setup.bot'), icon: 'smart_toy' }] : []),
      ];
      return html`<div class="row between"><div class="headline-s">${t('setup.addPlayers')}</div><span class="badge">${t('setup.slotsLeft', { n: left })}</span></div>
        ${!roster.some((r) => r.id === me.id) && html`<${Row} p=${me} sub=${t('kind.me')} />`}
        <${Seg} value=${tab} onChange=${setTab} options=${tabs} />
        <div class="pick-list">
          ${tab === 'friends' && (s.account ? (friends.length ? friends.map((p) => html`<${Row} p=${p} sub=${p.id && s.friends.find((f) => f.id === p.id)?.stats?.avg ? '⌀ ' + s.friends.find((f) => f.id === p.id).stats.avg.toFixed(2) : t('kind.friend')} />`)
              : html`<div class="pick-empty">${t('setup.noFriends')}<${Btn} kind="text" size="s" onClick=${() => { close(picked); location.hash = '#/profile'; }}>${t('nav.profile')}<//></div>`)
            : html`<div class="pick-empty">${cloudEnabled() ? t('setup.signInForFriends') : t('profile.noCloud')}${cloudEnabled() && html`<${Btn} kind="tonal" size="s" icon="login" onClick=${() => { close(picked); location.hash = '#/profile'; }}>${t('auth.signIn')}<//>`}</div>`)}
          ${tab === 'offline' && html`
            ${offline.map((p) => html`<${Row} p=${p} sub=${t('kind.offline')} />`)}
            <button class="pick-row add" onClick=${async () => { const p = await newOfflinePlayerDialog(); if (p && !taken.has(p.id)) pick(offlinePlayer(p)); }}>
              <div class="avatar l" style="--ph:285"><${Icon} n="person_add" size=${28} /></div><div class="grow title-m">${t('players.newOffline')}</div></button>`}
          ${tab === 'bot' && html`<div class="card high stack">
            <div class="row"><${Avatar} p=${playerFromBot(lv)} size="l" /><div class="grow"><div class="title-m">${t('setup.bot')} · ${t('setup.level')} ${lv}</div><div class="body-s muted">~${BOT_LEVELS[lv - 1].avg} ${t('stats.avgShort')}</div></div></div>
            <${Slider} min=${1} max=${BOT_LEVELS.length} value=${lv} label=${t('setup.level')} onInput=${setLv} />
            <${Btn} kind="tonal" icon="add" onClick=${() => pick(playerFromBot(lv))}>${t('setup.addBot')}<//>
            ${picked.filter((p) => p.bot).length > 0 && html`<div class="body-s muted">${t('setup.botsPicked', { n: picked.filter((p) => p.bot).length })}</div>`}
          </div>`}
        </div>
        <div class="actions"><${Btn} kind="text" onClick=${() => close([])}>${t('common.cancel')}<//><${Btn} kind="filled" icon="check" onClick=${() => close(picked)} disabled=${!picked.length}>${picked.length ? t('setup.addN', { n: picked.length }) : t('common.add')}<//></div>`;
    };
    return html`<${Inner} />`;
  });
}

export function Setup({ type, preset }) {
  const st = useStore();
  const last = st.lastSetup[type] || {};
  const maxP = SUPPORTS_TEAMS[type] ? 8 : MAX_PLAYERS[type];
  const [roster, setRoster] = useState(() => {
    const seen = new Set();
    const r = (last.players || []).map((p) => resolve(p, st)).filter((p) => p && (!p.bot || SUPPORTS_BOT[type]) && !seen.has(p.id) && seen.add(p.id));
    return (r.length ? r : [mePlayer(st)]).slice(0, maxP);
  });

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
  const [cMode, setCMode] = useState(preset || (type === 'cricket' && last.mode ? last.mode : 'cricket'));
  // default penalty mode per cricket variant: Fullboard/Tactics penalised, Cricket without penalty
  const defScoring = (m) => (m === 'fullboard' || m === 'tactics' ? 'penalty' : 'none');
  // v1.0.5: three penalty modes; older 'double' / 'points' setups fall back to penalty / none
  const [scoring, setScoring] = useState(() => { const sc = last.scoring === 'double' ? 'penalty' : last.scoring === 'points' ? 'none' : last.scoring; return sc || (last.cutthroat || last.variant === 'cutthroat' ? 'penalty' : defScoring(preset || last.mode)); });
  const [no1011, setNo1011] = useState(!!last.no1011);
  // Teams
  const [teamMode, setTeamMode] = useState(!!(SUPPORTS_TEAMS[type] && last.teams));
  const [nTeams, setNTeams] = useState(last.teams?.length || 2);
  const [teamOf, setTeamOf] = useState(() => { const m = {}; (last.teams || []).forEach((tm, k) => tm.forEach((pi) => { const id = last.players?.[pi]?.id; if (id) m[id] = k; })); return m; });
  // 121 / Shanghai
  const [c121Rounds, setC121Rounds] = useState(type === 'c121' ? last.rounds || 10 : 10);
  const [shRounds, setShRounds] = useState(type === 'shanghai' ? last.rounds || 7 : 7);
  // X01 round limit (switch): when on, a bull-off decides a leg nobody checked out within the limit
  const [roundLimitOn, setRoundLimitOn] = useState(type === 'x01' && last.rounds > 0);
  const [rounds, setRounds] = useState(type === 'x01' && last.rounds > 0 ? last.rounds : 20);
  const [cLegs, setCLegs] = useState(last.legsToWin || 1);
  // ATC
  const [atcMode, setAtcMode] = useState(last.mode || 'any');
  const [bull, setBull] = useState(last.bull ?? true);
  // Checkout
  const [range, setRange] = useState(last.min ? `${last.min}-${last.max}` : '41-100');
  const [ckRounds, setCkRounds] = useState(last.rounds || 10);

  const total = roster.length;
  const teamIdx = (p, i) => (teamOf[p.id] ?? i % nTeams) % nTeams;
  const toFirst = (n) => (fmt === 'best' ? Math.floor(n / 2) + 1 : n);

  const begin = () => {
    if (!roster.some((p) => !p.bot)) return snack(t('setup.needPlayer'));
    // keep match records small: only remote photo URLs are stored, local photos are resolved live
    const players = roster.map((p) => ({ id: p.id, name: p.name, hue: p.hue, shape: p.shape, kind: p.kind, ...(p.bot ? { bot: p.bot } : {}), ...(p.photo && /^https?:/.test(p.photo) ? { photo: p.photo } : {}) }));
    let cfg;
    if (type === 'x01') cfg = { players, start, in: inR, out: outR, sets, fmt, legsN: legs, setsN, legsToWin: toFirst(legs), setsToWin: toFirst(setsN), rounds: roundLimitOn ? rounds : 0 };
    else if (type === 'cricket') cfg = { players, mode: cMode, scoring: cMode === 'akyaka' ? 'none' : scoring, no1011: (cMode === 'fullboard' || cMode === 'tactics') && no1011, rounds: 0, legsToWin: cLegs };
    else if (type === 'atc') cfg = { players, mode: atcMode, bull };
    else if (type === 'bobs27' || type === 'doubles') cfg = { players };
    else if (type === 'c121') cfg = { players: players.slice(0, 1), start: 121, rounds: c121Rounds };
    else if (type === 'shanghai') cfg = { players, rounds: shRounds };
    else if (type === 'checkout') { const [min, max] = range.split('-').map(Number); cfg = { players: players.slice(0, 1), min, max, rounds: ckRounds, seed: Math.floor(Math.random() * 1e9) }; }
    if (type === 'cricket' && !teamMode && players.length > MAX_PLAYERS.cricket) return snack(t('setup.tooMany', { n: MAX_PLAYERS.cricket }));
    if (teamMode && SUPPORTS_TEAMS[type]) {
      const teams = Array.from({ length: nTeams }, () => []);
      roster.forEach((p, i) => teams[teamIdx(p, i)].push(i));
      const filled = teams.filter((tm) => tm.length);
      if (filled.length < 2) return snack(t('setup.needTeams'));
      cfg.teams = filled;
    }
    startMatch(type, cfg);
  };

  const shuffle = () => {
    const a = [...roster];
    for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
    setRoster(a); snack(t('setup.shuffled'));
  };
  const move = (i, d) => { const a = [...roster]; const j = i + d; if (j < 0 || j >= a.length) return; [a[i], a[j]] = [a[j], a[i]]; setRoster(a); haptic(8); };
  const add = async () => {
    const picked = await addPlayersDialog({ st, roster, room: maxP - roster.length, allowBot: SUPPORTS_BOT[type] });
    if (picked?.length) setRoster((r) => [...r, ...picked.filter((p) => !r.some((x) => x.id === p.id))].slice(0, maxP));
  };
  const kindLabel = (p) => (p.bot ? (type === 'cricket' ? `${t('setup.level')} ${p.bot} · ~${CRICKET_MPR[p.bot - 1].toFixed(1)} MPR` : `${t('setup.level')} ${p.bot} · ~${BOT_LEVELS[p.bot - 1].avg} ${t('stats.avgShort')}`) : t('kind.' + p.kind));

  const fmtLabel = (n, one, many) => `${n} ${t(n === 1 ? one : many)}`;

  return html`<div class="screen-enter">
    <${TopBar} title=${type === 'cricket' && cMode === 'akyaka' ? t('cricket.akyaka') : t('mode.' + type)} back="#/" />
    <div class="setup-grid setup-pad">
      <div class="card stack">
        <div class="row between">
          <div class="title-l">${t('setup.players')} <span class="muted title-m">${total}/${maxP}</span></div>
          ${roster.length > 1 && html`<${Btn} kind="text" size="s" icon="shuffle" onClick=${shuffle}>${t('setup.shuffle')}<//>`}
        </div>
        ${SUPPORTS_TEAMS[type] && html`<div class="grid cols-2">
          <${Seg} size="s" value=${teamMode} onChange=${setTeamMode} options=${[{ value: false, label: t('setup.solo'), icon: 'person' }, { value: true, label: t('setup.teams'), icon: 'groups' }]} />
          ${teamMode && html`<${Seg} size="s" value=${nTeams} onChange=${setNTeams} options=${[2, 3, 4].map((v) => ({ value: v, label: t('setup.nTeams', { n: v }), icon: false }))} />`}
        </div>`}
        ${roster.length > 1 && html`<div class="body-s muted" style="margin-top:-8px">${t(teamMode ? 'setup.teamHint' : 'setup.orderHint')}</div>`}
        <div class="roster">
          ${roster.map((p, i) => html`<div class="roster-row" key=${p.id}>
            ${teamMode && SUPPORTS_TEAMS[type] ? html`<button class=${'team-chip k' + teamIdx(p, i)} title=${t('setup.changeTeam')} onClick=${() => { haptic(8); setTeamOf({ ...teamOf, [p.id]: (teamIdx(p, i) + 1) % nTeams }); }}>${teamIdx(p, i) + 1}</button>` : html`<span class="order">${i + 1}</span>`}
            <${Avatar} p=${p} size="l" />
            <div class="grow" style="min-width:0">
              <div class="title-m ellipsis">${p.name}</div>
              <div class="kind"><${Icon} n=${KIND_ICON[p.bot ? 'bot' : p.kind] || 'person'} size=${16} />${kindLabel(p)}</div>
              ${p.bot && html`<${Slider} min=${1} max=${BOT_LEVELS.length} value=${p.bot} label=${t('setup.level')} onInput=${(v) => setRoster(roster.map((x, j) => (j === i ? { ...playerFromBot(v), id: x.id } : x)))} />`}
            </div>
            ${roster.length > 1 && html`<div class="col-btns">
              <${IconBtn} icon="keyboard_arrow_up" title=${t('setup.moveUp')} disabled=${i === 0} onClick=${() => move(i, -1)} />
              <${IconBtn} icon="keyboard_arrow_down" title=${t('setup.moveDown')} disabled=${i === roster.length - 1} onClick=${() => move(i, 1)} />
            </div>`}
            <${IconBtn} icon="close" title=${t('common.remove')} onClick=${() => setRoster(roster.filter((_, j) => j !== i))} />
          </div>`)}
          ${!roster.length && html`<div class="body-m muted" style="text-align:center;padding:16px">${t('setup.needPlayer')}</div>`}
        </div>
        ${total < maxP && html`<${Btn} kind="tonal" size="m" cls="block" icon="group_add" onClick=${add}>${t('setup.addPlayers')}<//>`}
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
          <div class="setting" style="border-radius:var(--r-l)"><${Icon} n="timer" /><div class="grow"><div class="title-s">${t('setup.roundLimit')}</div><div class="body-s muted">${t('setup.roundLimitSub')}</div></div><${Switch} checked=${roundLimitOn} onChange=${setRoundLimitOn} label=${t('setup.roundLimit')} /></div>
          ${roundLimitOn && html`<${Seg} value=${rounds} onChange=${setRounds} options=${[10, 15, 20, 25].map((v) => ({ value: v, label: t('setup.roundsN', { n: v }), icon: false }))} />`}
        `}
        ${type === 'cricket' && html`
          <div class="field"><span class="label-l">${t('setup.game')}</span>
            <${Seg} value=${cMode} onChange=${(m) => { setCMode(m); if (!last.scoring) setScoring(defScoring(m)); }} wrap options=${['cricket', 'tactics', 'fullboard', 'akyaka'].map((v) => ({ value: v, label: t('cricket.' + v) }))} /></div>
          <div class="body-s muted">${t('cricket.' + cMode + '.desc')}</div>
          ${(cMode === 'fullboard' || cMode === 'tactics') && html`<div class="setting" style="border-radius:var(--r-l)"><${Icon} n="filter_list_off" /><div class="grow"><div class="title-s">${t('setup.no1011')}</div><div class="body-s muted">${t('setup.no1011Sub')}</div></div><${Switch} checked=${no1011} onChange=${setNo1011} label=${t('setup.no1011')} /></div>`}
          ${cMode !== 'akyaka' && html`<div class="field"><span class="label-l">${t('setup.scoring')}</span>
            <${Seg} wrap value=${scoring} onChange=${setScoring} options=${['none', 'penalty', 'master'].map((v) => ({ value: v, label: t('scoring.' + v) }))} />
            <div class="body-s muted">${t('scoring.' + scoring + '.desc')}</div></div>`}
          <div class="row between"><span class="label-l muted">${t('setup.firstTo')} (${t('setup.legs')})</span><${Stepper} value=${cLegs} max=${15} onChange=${setCLegs} label=${t('setup.legs')} /></div>

        `}
        ${type === 'atc' && html`
          <div class="field"><span class="label-l">${t('setup.target')}</span>
            <${Seg} value=${atcMode} onChange=${setAtcMode} options=${['any', 'double', 'treble'].map((v) => ({ value: v, label: t('setup.atc.' + v) }))} /></div>
          <div class="setting" style="border-radius:var(--r-l)"><${Icon} n="radio_button_checked" /><div class="grow">${t('setup.includeBull')}</div><${Switch} checked=${bull} onChange=${setBull} label=${t('setup.includeBull')} /></div>
          <div class="body-s muted">${t('mode.atc.long')}</div>
        `}
        ${type === 'bobs27' && html`<div class="body-m">${t('mode.bobs27.long')}</div>`}
        ${type === 'doubles' && html`<div class="body-m">${t('mode.doubles.long')}</div>`}
        ${type === 'c121' && html`<div class="field"><span class="label-l">${t('setup.rounds')}</span>
            <${Seg} value=${c121Rounds} onChange=${setC121Rounds} options=${[10, 20, 30].map((v) => ({ value: v, label: String(v), icon: false }))} /></div>
          <div class="body-m">${t('mode.c121.long')}</div>`}
        ${type === 'shanghai' && html`<div class="field"><span class="label-l">${t('setup.rounds')}</span>
            <${Seg} value=${shRounds} onChange=${setShRounds} options=${[{ value: 7, label: '1–7', icon: false }, { value: 20, label: '1–20', icon: false }]} /></div>
          <div class="body-m">${t('mode.shanghai.long')}</div>`}
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
