import { html, useState, useRef } from '../../vendor/preact-htm.js';
import { useStore, update, mePlayer, friendPlayer, offlinePlayer } from '../store.js';
import { t } from '../i18n.js';
import { Icon, IconBtn, Btn, Seg, Switch, Slider, Avatar, snack, openDialog, haptic } from '../ui.js';
import { startMatch, playerFromBot } from '../match.js';
import { BOT_LEVELS, CRICKET_MPR } from '../bot.js';
import { TopBar, Stepper } from './common.js';
import { newOfflinePlayerDialog } from './players.js';
import { cloudEnabled } from '../cloud.js';
import { chooseStarter } from './starter.js';

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

function addPlayersDialog({ st, roster, room, allowBot, type }) {
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
            <div class="row"><${Avatar} p=${playerFromBot(lv)} size="l" /><div class="grow"><div class="title-m">${t('setup.bot')} · ${t('setup.level')} ${lv}</div><div class="body-s muted">${type === 'cricket' ? `~${CRICKET_MPR[lv - 1].toFixed(1)} MPR` : `~${BOT_LEVELS[lv - 1].avg} ${t('stats.avgShort')}`}</div></div></div>
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

export function Setup({ type, preset, picker, onPick, carry }) {
  const st = useStore();
  const last = st.lastSetup[type] || {};
  const maxP = SUPPORTS_TEAMS[type] ? 8 : MAX_PLAYERS[type];
  const [roster, setRoster] = useState(() => {
    const seen = new Set();
    const r = (last.players || []).map((p) => resolve(p, st)).filter((p) => p && (!p.bot || SUPPORTS_BOT[type]) && !seen.has(p.id) && seen.add(p.id));
    const cr = (carry?.current || []).filter((p) => !p.bot || SUPPORTS_BOT[type]);
    if (cr.length) return cr.slice(0, maxP);
    return (r.length ? r : [mePlayer(st)]).slice(0, maxP);
  });

  // X01 options
  const [start, setStart] = useState(last.start || 501);
  const [custom, setCustom] = useState(![301, 501, 701, 1001].includes(last.start || 501));
  const [inR, setIn] = useState(last.in || 'straight');
  const [outR, setOut] = useState(last.out || 'double');
  const [fmt, setFmt] = useState(last.fmt || 'best');
  const [sets, setSets] = useState(!!last.sets);
  const [legs, setLegs] = useState(last.legsN || 3);
  const [setsN, setSetsN] = useState(last.setsN || 3);
  // Cricket
  const [cMode, setCMode] = useState(preset || (type === 'cricket' && last.mode ? last.mode : 'cricket'));
  // v1.0.7: every cricket variant defaults to the penalty mode
  const defScoring = () => 'penalty';
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
  // v1.1.0 practice options
  const [atcSkip, setAtcSkip] = useState(type === 'atc' && !!last.skip);
  const [outAtZero, setOutAtZero] = useState(type === 'bobs27' ? last.outAtZero ?? true : true);
  const [failReset, setFailReset] = useState(type === 'c121' ? last.failReset || 'down' : 'down');
  // Checkout
  const [range, setRange] = useState(last.min ? `${last.min}-${last.max}` : '41-100');
  const [ckRounds, setCkRounds] = useState(last.rounds || 10);

  const total = roster.length;
  if (carry && maxP > 1) carry.current = roster; // the game picker keeps the players when switching games
  const teamIdx = (p, i) => (teamOf[p.id] ?? i % nTeams) % nTeams;
  const toFirst = (n) => (fmt === 'best' ? Math.floor(n / 2) + 1 : n);

  const begin = async () => {
    if (!roster.some((p) => !p.bot)) return snack(t('setup.needPlayer'));
    // keep match records small: only remote photo URLs are stored, local photos are resolved live
    const players = roster.map((p) => ({ id: p.id, name: p.name, hue: p.hue, shape: p.shape, kind: p.kind, ...(p.bot ? { bot: p.bot } : {}), ...(p.photo && /^https?:/.test(p.photo) ? { photo: p.photo } : {}) }));
    let cfg;
    if (type === 'x01') cfg = { players, start, in: inR, out: outR, sets, fmt, legsN: legs, setsN, legsToWin: toFirst(legs), setsToWin: toFirst(setsN), rounds: roundLimitOn ? rounds : 0 };
    else if (type === 'cricket') cfg = { players, mode: cMode, scoring: cMode === 'akyaka' ? 'none' : scoring, no1011: (cMode === 'fullboard' || cMode === 'tactics') && no1011, rounds: 0, legsToWin: cLegs, selfScore: true };
    else if (type === 'atc') cfg = { players, mode: atcMode, bull, skip: atcMode === 'any' && atcSkip };
    else if (type === 'bobs27') cfg = { players, outAtZero };
    else if (type === 'doubles') cfg = { players };
    else if (type === 'c121') cfg = { players: players.slice(0, 1), start: 121, rounds: c121Rounds, failReset };
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
    // X01 / Cricket with 2+ sides: decide who starts (bull-off, coin toss or the listed order)
    if (type === 'x01' || type === 'cricket') {
      const sideIdx = cfg.teams || players.map((_, i) => [i]);
      if (sideIdx.length > 1) {
        const sides = sideIdx.map((tm, k) => ({ name: cfg.teams ? t('team.n', { n: k + 1 }) : roster[tm[0]].name, members: tm.map((i) => roster[i]) }));
        const pick = await chooseStarter(sides);
        if (!pick) return;
        cfg.first = pick.first;
        // the player chosen to throw the bull-off for a team becomes that team's first thrower
        // (swap the two players in the list, so the team slots keep that order next time too)
        if (cfg.teams) cfg.teams.forEach((tm, k) => { const r = pick.reps[k] || 0; if (r) [cfg.players[tm[0]], cfg.players[tm[r]]] = [cfg.players[tm[r]], cfg.players[tm[0]]]; });
      }
    }
    startMatch(type, cfg);
  };

  const shuffle = () => {
    const a = [...roster];
    for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
    if (teamMode) setTeamOf(Object.fromEntries(a.map((p, i) => [p.id, i % nTeams])));
    setRoster(a); snack(t('setup.shuffled'));
  };
  const move = (i, d) => { const a = [...roster]; const j = i + d; if (j < 0 || j >= a.length) return; [a[i], a[j]] = [a[j], a[i]]; setRoster(a); haptic(8); };
  const add = async () => {
    const picked = await addPlayersDialog({ st, roster, room: maxP - roster.length, allowBot: SUPPORTS_BOT[type], type });
    if (!picked?.length) return;
    const fresh = picked.filter((p) => !roster.some((x) => x.id === p.id)).slice(0, maxP - roster.length);
    if (teamMode) {
      // new players join the smallest team
      const m = pinTeams();
      for (const p of fresh) { const counts = Array.from({ length: nTeams }, (_, k) => Object.values(m).filter((v) => v === k).length); m[p.id] = counts.indexOf(Math.min(...counts)); }
      setTeamOf(m);
    }
    setRoster([...roster, ...fresh]);
  };
  // --- team slots ---
  /** Fix every player's team explicitly (so reordering the roster never moves anyone to another team). */
  const pinTeams = (list = roster) => Object.fromEntries(list.map((p, i) => [p.id, teamIdx(p, i)]));
  const teamMembers = (k) => roster.map((p, i) => ({ p, i })).filter(({ p, i }) => teamIdx(p, i) === k);
  /** Move a player to the neighbouring team (joins at the bottom). */
  const moveTeam = (p, d) => {
    const m = pinTeams();
    m[p.id] = Math.max(0, Math.min(nTeams - 1, m[p.id] + d));
    haptic(10);
    setTeamOf(m);
    setRoster([...roster.filter((x) => x.id !== p.id), p]);
  };
  /** Move a player up inside their team (the top player represents the team at the start). */
  const moveInTeam = (i) => {
    const m = pinTeams();
    const k = m[roster[i].id];
    let j = i - 1; while (j >= 0 && m[roster[j].id] !== k) j--;
    if (j < 0) return;
    const a = [...roster]; [a[i], a[j]] = [a[j], a[i]];
    haptic(8); setTeamOf(m); setRoster(a);
  };
  const removeAt = (i) => { const m = pinTeams(); setTeamOf(m); setRoster(roster.filter((_, j) => j !== i)); };
  const changeNTeams = (v) => { const m = pinTeams(); for (const id in m) if (m[id] >= v) m[id] = v - 1; setTeamOf(m); setNTeams(v); };
  const kindLabel = (p) => (p.bot ? (type === 'cricket' ? `${t('setup.level')} ${p.bot} · ~${CRICKET_MPR[p.bot - 1].toFixed(1)} MPR` : `${t('setup.level')} ${p.bot} · ~${BOT_LEVELS[p.bot - 1].avg} ${t('stats.avgShort')}`) : t('kind.' + p.kind));

  const fmtLabel = (n, one, many) => `${n} ${t(n === 1 ? one : many)}`;

  return html`<div class="screen-enter">
    <${TopBar} title=${picker ? t('home.newGame') : type === 'cricket' && cMode === 'akyaka' ? t('cricket.akyaka') : t('mode.' + type)} back="#/" />
    <div class="setup-grid setup-pad">
      <div class="card stack">
        <div class="row between">
          <div class="title-l">${t('setup.players')} <span class="muted title-m">${total}/${maxP}</span></div>
          ${roster.length > 1 && html`<${Btn} kind="text" size="s" icon="shuffle" onClick=${shuffle}>${t('setup.shuffle')}<//>`}
        </div>
        ${SUPPORTS_TEAMS[type] && html`<div class="grid cols-2">
          <${Seg} size="s" value=${teamMode} onChange=${setTeamMode} options=${[{ value: false, label: t('setup.solo'), icon: 'person' }, { value: true, label: t('setup.teams'), icon: 'groups' }]} />
          ${teamMode && html`<${Seg} size="s" value=${nTeams} onChange=${changeNTeams} options=${[2, 3, 4].map((v) => ({ value: v, label: t('setup.nTeams', { n: v }), icon: false }))} />`}
        </div>`}
        ${roster.length > 1 && html`<div class="body-s muted" style="margin-top:-8px">${t(teamMode ? 'setup.teamHint' : 'setup.orderHint')}</div>`}
        ${teamMode && SUPPORTS_TEAMS[type] ? html`<div class=${'team-board n' + nTeams}>
          ${Array.from({ length: nTeams }, (_, k) => { const mem = teamMembers(k); return html`<div class=${'team-col k' + k} key=${'team' + k}>
            <div class="team-head"><span class=${'team-chip k' + k}>${k + 1}</span><span class="title-s grow">${t('team.n', { n: k + 1 })}</span><span class="badge">${mem.length}</span></div>
            ${mem.map(({ p, i }, pos) => html`<div class="team-slot" key=${p.id}>
              <div class="ts-main">
                <${Avatar} p=${p} />
                <div class="grow" style="min-width:0"><div class="title-s ellipsis">${p.name}</div>
                  <div class="kind ellipsis">${pos === 0 ? html`<${Icon} n="flag" size=${14} />${t('setup.teamFirst')}` : html`<${Icon} n=${KIND_ICON[p.bot ? 'bot' : p.kind] || 'person'} size=${14} />${p.bot ? kindLabel(p) : t('kind.' + p.kind)}`}</div></div>
              </div>
              ${p.bot && html`<${Slider} min=${1} max=${BOT_LEVELS.length} value=${p.bot} label=${t('setup.level')} onInput=${(v) => setRoster(roster.map((x, j) => (j === i ? { ...playerFromBot(v), id: x.id } : x)))} />`}
              <div class="ts-btns">
                <${IconBtn} icon="chevron_left" title=${t('setup.prevTeam')} disabled=${k === 0} onClick=${() => moveTeam(p, -1)} />
                <${IconBtn} icon="keyboard_arrow_up" title=${t('setup.moveUp')} disabled=${pos === 0} onClick=${() => moveInTeam(i)} />
                <${IconBtn} icon="close" title=${t('common.remove')} onClick=${() => removeAt(i)} />
                <${IconBtn} icon="chevron_right" title=${t('setup.nextTeam')} disabled=${k === nTeams - 1} onClick=${() => moveTeam(p, 1)} />
              </div>
            </div>`)}
            ${!mem.length && html`<div class="team-empty">${t('setup.teamEmpty')}</div>`}
          </div>`; })}
        </div>` : html`<div class="roster">
          ${roster.map((p, i) => html`<div class="roster-row" key=${p.id}>
            <span class="order">${i + 1}</span>
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
        </div>`}
        ${total < maxP && html`<${Btn} kind="tonal" size="m" cls="block" icon="group_add" onClick=${add}>${t('setup.addPlayers')}<//>`}
      </div>

      <div class="card stack">
        ${picker && html`<div class="field game-pick-field"><span class="label-l">${t('setup.pickGame')}</span>
          <div class="game-pick">${PICK_MAIN.map((g) => html`<button class=${'gp-main ' + g.c + (picker === g.id ? ' on' : '')} onClick=${() => picker !== g.id && onPick(g.id)}>
            <${Icon} n=${g.icon} size=${28} /><span class="title-m">${g.id === 'x01' ? 'X01' : t('mode.' + g.id)}</span>${picker === g.id && html`<${Icon} n="check_circle" size=${20} />`}</button>`)}</div>
          <span class="label-m muted">${t('home.practice')}</span>
          <div class="chips">${PICK_PRACTICE.map((id) => html`<button class=${'chip' + (picker === id ? ' on' : '')} onClick=${() => picker !== id && onPick(id)}>${t('mode.' + id)}</button>`)}</div>
        </div>`}
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
          ${atcMode === 'any' && html`<div class="setting" style="border-radius:var(--r-l)"><${Icon} n="fast_forward" /><div class="grow"><div class="title-s">${t('setup.atcSkip')}</div><div class="body-s muted">${t('setup.atcSkipSub')}</div></div><${Switch} checked=${atcSkip} onChange=${setAtcSkip} label=${t('setup.atcSkip')} /></div>`}
          <div class="body-s muted">${t('mode.atc.long')}</div>
        `}
        ${type === 'bobs27' && html`<div class="body-m">${t('mode.bobs27.long')}</div>
          <div class="setting" style="border-radius:var(--r-l)"><${Icon} n="block" /><div class="grow"><div class="title-s">${t('setup.outAtZero')}</div><div class="body-s muted">${t('setup.outAtZeroSub')}</div></div><${Switch} checked=${outAtZero} onChange=${setOutAtZero} label=${t('setup.outAtZero')} /></div>`}
        ${type === 'doubles' && html`<div class="body-m">${t('mode.doubles.long')}</div>`}
        ${type === 'c121' && html`<div class="field"><span class="label-l">${t('setup.rounds')}</span>
            <${Seg} value=${c121Rounds} onChange=${setC121Rounds} options=${[10, 20, 30].map((v) => ({ value: v, label: String(v), icon: false }))} /></div>
          <div class="field"><span class="label-l">${t('setup.failRule')}</span>
            <${Seg} value=${failReset} onChange=${setFailReset} options=${[{ value: 'down', label: t('setup.failDown') }, { value: 'start', label: t('setup.failStart') }]} /></div>
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

// ---------- New match: choose the game first, then its settings ----------
const PICK_MAIN = [{ id: 'x01', icon: 'sports_score', c: 'c-primary' }, { id: 'cricket', icon: 'grid_view', c: 'c-tertiary' }];
const PICK_PRACTICE = ['c121', 'atc', 'bobs27', 'doubles', 'checkout', 'shanghai', 'akyaka'];

export function PlayHub() {
  const st = useStore();
  const [sel, setSel] = useState(() => (PICK_MAIN.some((g) => g.id === st.settings.lastGame) || PICK_PRACTICE.includes(st.settings.lastGame) ? st.settings.lastGame : 'x01'));
  const carry = useRef(null);
  const pick = (id) => { haptic(10); setSel(id); update((x) => { x.settings.lastGame = id; }); };
  const [type, preset] = sel === 'akyaka' ? ['cricket', 'akyaka'] : [sel, undefined];
  return html`<${Setup} key=${sel} type=${type} preset=${preset} picker=${sel} onPick=${pick} carry=${carry} />`;
}
