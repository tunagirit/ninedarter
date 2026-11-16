import { html, useState, useEffect, useMemo, useRef } from '../../vendor/preact-htm.js';
import { useStore, update } from '../store.js';
import { t } from '../i18n.js';
import { Icon, IconBtn, Btn, Seg, Avatar, Wavy, Shape, openDialog, snack, haptic, confetti, fmt1 } from '../ui.js';
import { pushAction, undo, go, abandonMatch } from '../match.js';
import * as X01 from '../engines/x01.js';
import * as CR from '../engines/cricket.js';
import { atc as ATC, bobs as BOBS, checkout as CK, c121 as C121, doubles as DBL, shanghai as SHA } from '../engines/training.js';
import { sideName, isTeamGame } from '../teams.js';
import { isValidVisitScore, minCheckoutDarts, checkoutRoute, evaluateDarts, dartLabel } from '../darts.js';
import { callScore, callRequire, speak } from '../voice.js';
import { modeName } from './common.js';
import { StatsTable } from './statstable.js';

export function Game() {
  const st = useStore();
  const a = st.active;
  if (!a) return null;
  if (a.type === 'x01') return html`<${X01Game} a=${a} />`;
  if (a.type === 'cricket') return html`<${CricketGame} a=${a} />`;
  if (a.type === 'atc') return html`<${AtcGame} a=${a} />`;
  if (a.type === 'bobs27') return html`<${BobsGame} a=${a} />`;
  if (a.type === 'checkout') return html`<${CheckoutGame} a=${a} />`;
  if (a.type === 'c121') return html`<${C121Game} a=${a} />`;
  if (a.type === 'doubles') return html`<${DoublesGame} a=${a} />`;
  if (a.type === 'shanghai') return html`<${ShanghaiGame} a=${a} />`;
  return null;
}

// ---------- shared pieces ----------
async function exitDialog() {
  const r = await openDialog((close) => html`
    <div class="icon-head"><${Icon} n="pause_circle" size=${32} /></div>
    <div class="headline-s" style="text-align:center">${t('game.pauseTitle')}</div>
    <div class="body-m muted" style="text-align:center">${t('game.pauseText')}</div>
    <div class="stack s">
      <${Btn} kind="filled" icon="play_arrow" onClick=${() => close('stay')}>${t('common.continue')}<//>
      <${Btn} kind="tonal" icon="home" onClick=${() => close('later')}>${t('game.later')}<//>
      <${Btn} kind="danger" icon="delete" onClick=${() => close('abandon')}>${t('game.abandon')}<//>
    </div>`);
  if (r === 'later') go('#/');
  if (r === 'abandon') { abandonMatch(); go('#/'); }
}

function GameTop({ a, sub, children }) {
  return html`<div class="game-top">
    <${IconBtn} icon="close" title=${t('common.close')} onClick=${exitDialog} />
    <div class="info"><div class="title-m">${modeName(a.type, a.config)}</div>${sub && html`<div class="body-s muted">${sub}</div>`}</div>
    <${IconBtn} icon="undo" title=${t('game.undo')} disabled=${!a.actions.length} onClick=${() => { haptic(15); if (undo()) snack(t('game.undone')); }} />
    ${children}
  </div>`;
}

function useBot(a, s, makeAction) {
  const speed = useStore().settings.botSpeed;
  const pl = a.config.players[s.current];
  useEffect(() => {
    if (!pl?.bot || s.finished) return;
    const id = setTimeout(() => { const act = makeAction(); if (act) afterPush(a, pushAction(act)); }, speed);
    return () => clearTimeout(id);
  }, [a.actions.length, s.current, s.finished]);
}

function lastVisit(ns) {
  if (ns.event && ns.legs?.length) return ns.legs[ns.legs.length - 1].visits.at(-1);
  return ns.visits?.at(-1);
}

function afterPush(a, ns) {
  if (!ns) return;
  const pl = a.config.players;
  if (a.type === 'x01') {
    const v = lastVisit(ns);
    if (v) callScore(v.score, { bust: v.bust, checkout: v.checkout });
    if (!ns.event && !ns.finished) {
      const rem = ns.remaining[ns.side];
      if (rem <= 170 && checkoutRoute(rem, 3, a.config.out) && !pl[ns.current].bot) callRequire(rem);
    }
  }
  if (ns.event) {
    const name = sideName(a.config, ns.event.side ?? ns.event.p);
    if (ns.event.type === 'match') { confetti(); if (a.type !== 'x01') speak(t('game.matchWon', { name })); }
    else { snack(t(ns.event.type === 'set' ? 'game.setWon' : 'game.legWon', { name })); haptic(40); }
  }
}

const doubleOpts = (from, to) => Array.from({ length: to - from + 1 }, (_, i) => ({ value: from + i, label: String(from + i), icon: false }));

function checkoutDialog(minD, askDbl) {
  return openDialog((close) => {
    const Inner = () => {
      const [used, setUsed] = useState(minD === 3 ? 3 : minD);
      const [dbl, setDbl] = useState(1);
      return html`<div class="icon-head"><${Icon} n="celebration" size=${32} /></div>
        <div class="headline-s" style="text-align:center">${t('game.checkoutQ')}</div>
        <div class="field"><span class="label-l">${t('game.dartsUsed')}</span><${Seg} value=${used} onChange=${(v) => { setUsed(v); if (dbl > v) setDbl(v); }} options=${doubleOpts(minD, 3)} /></div>
        ${askDbl && html`<div class="field"><span class="label-l">${t('game.dartsAtDouble')}</span><${Seg} value=${dbl} onChange=${setDbl} options=${doubleOpts(1, used)} /></div>`}
        <div class="actions"><${Btn} kind="text" onClick=${() => close(null)}>${t('common.cancel')}<//><${Btn} kind="filled" icon="check" onClick=${() => close({ used, dbl })}>${t('common.ok')}<//></div>`;
    };
    return html`<${Inner} />`;
  });
}

function doubleDialog() {
  return openDialog((close) => html`
    <div class="headline-s">${t('game.dartsAtDoubleQ')}</div>
    <div class="grid" style="grid-template-columns:repeat(4,1fr)">
      ${[0, 1, 2, 3].map((n) => html`<button class="key" onClick=${() => close(n)}>${n}</button>`)}
    </div>
    <div class="actions"><${Btn} kind="text" onClick=${() => close(null)}>${t('common.cancel')}<//></div>`);
}

function DartSlots({ darts, labels }) {
  return html`<div class="dart-slots">${[0, 1, 2].map((i) => html`<div class=${'slot' + (darts[i] !== undefined ? ' filled' : i === darts.length ? ' next' : '')}>${darts[i] !== undefined ? labels(darts[i]) : html`<${Icon} n="arrow_upward" size=${18} />`}</div>`)}</div>`;
}

function useLock() {
  const [locked, setLocked] = useState(false);
  return [locked, (fn, ms = 380) => { setLocked(true); setTimeout(() => { setLocked(false); fn(); }, ms); }];
}

// ====================== X01 ======================
/** Header of a side card: one avatar + name, or the team's members with the current thrower highlighted. */
function SideHead({ config, side, s, activeSide }) {
  const members = s.sides[side].map((i) => ({ i, p: config.players[i] }));
  if (!isTeamGame(config)) {
    const p = members[0].p;
    return html`<${Avatar} p=${p} spin=${activeSide && p.bot} /><span class="title-m grow ellipsis">${p.name}</span>`;
  }
  return html`<div class="grow" style="min-width:0">
    <div class="label-l">${sideName(config, side)}</div>
    <div class="team-members">${members.map(({ i, p }) => html`<span class=${'tm' + (activeSide && i === s.current ? ' on' : '')}><${Avatar} p=${p} spin=${activeSide && i === s.current && p.bot} /><span class="ellipsis">${p.name}</span></span>`)}</div>
  </div>`;
}

function X01Game({ a }) {
  const st = useStore();
  const set = st.settings;
  const { config } = a;
  const s = useMemo(() => X01.compute(config, a.actions), [a.actions]);
  const mstats = useMemo(() => X01.stats(s, config), [s]);
  const [mode, setMode] = useState(set.inputMode);
  const [entry, setEntry] = useState('');
  const [err, setErr] = useState(false);
  const [pending, setPending] = useState([]);
  const [mult, setMult] = useState(1);
  const [locked, lock] = useLock();
  const cur = s.current;
  const side = s.side;
  const pl = config.players[cur];
  const isBot = !!pl.bot;
  const before = s.remaining[side];

  useBot(a, s, () => X01.botAction(s, config));
  useEffect(() => { setPending([]); setEntry(''); setMult(1); }, [a.actions.length]);

  const fail = () => { setErr(true); haptic(60); setTimeout(() => setErr(false), 400); };
  const submit = (action) => afterPush(a, pushAction(action));

  const ok = async () => {
    if (isBot || s.finished) return;
    const score = entry === '' ? 0 : parseInt(entry, 10);
    if (!isValidVisitScore(score)) return fail();
    const after = before - score;
    haptic(12);
    if (after === 0) {
      const minD = minCheckoutDarts(before, config.out);
      if (!minD) return fail();
      const askDbl = set.askDoubles && config.out !== 'straight';
      let res = { used: 3, dbl: 1 };
      if (minD < 3 || askDbl) { res = await checkoutDialog(minD, askDbl); if (!res) return; }
      submit({ score, dartsUsed: res.used, dbl: askDbl ? res.dbl : 1 });
    } else {
      let dbl = 0;
      if (set.askDoubles && config.out !== 'straight' && before <= 50 && before >= 2 && s.opened[side]) {
        const r = await doubleDialog(); if (r == null) return; dbl = r;
      }
      submit({ score, dbl });
    }
    setEntry('');
  };

  const press = (k) => {
    if (isBot || locked) return;
    haptic(6);
    if (k === 'del') return setEntry(entry.slice(0, -1));
    const next = (entry + k).replace(/^0+(?=\d)/, '');
    if (+next > 180) return fail();
    setEntry(next);
  };

  // keyboard input
  const okRef = useRef(ok); okRef.current = ok;
  const pressRef = useRef(press); pressRef.current = press;
  useEffect(() => {
    const onKey = (e) => {
      if (document.querySelector('.scrim') || mode !== 'keypad') return;
      if (/^[0-9]$/.test(e.key)) pressRef.current(e.key);
      else if (e.key === 'Backspace') pressRef.current('del');
      else if (e.key === 'Enter') okRef.current();
    };
    addEventListener('keydown', onKey); return () => removeEventListener('keydown', onKey);
  }, [mode]);

  // dart-by-dart input
  const ev = pending.length ? evaluateDarts(before, pending, s.rules, s.opened[side]) : null;
  const liveRem = ev && !ev.bust ? before - ev.score : before;
  const addDart = (n) => {
    if (isBot || locked || pending.length >= 3) return;
    haptic(8);
    const d = { n, m: n === 0 ? 1 : n === 25 ? Math.min(mult, 2) : mult };
    const np = [...pending, d];
    setPending(np); setMult(1);
    const e2 = evaluateDarts(before, np, s.rules, s.opened[side]);
    if (e2.bust || e2.checkout || np.length === 3) lock(() => submit({ darts: np }), e2.bust || e2.checkout ? 600 : 350);
  };

  const dartsLeft = mode === 'darts' ? 3 - pending.length : 3;
  const sub = (config.sets ? `${t('game.set')} ${s.set} · ${t('game.leg')} ${s.leg}` : `${t('game.leg')} ${s.leg}`) + (isTeamGame(config) ? ` · ${t('game.throwing', { name: pl.name })}` : '');
  const many = s.n > 2;

  return html`<div class="game">
    <${GameTop} a=${a} sub=${sub}>
      <${IconBtn} icon="leaderboard" title=${t('game.liveStats')} onClick=${() => openDialog((close) => html`<div class="headline-s">${t('game.liveStats')}</div><${StatsTable} type="x01" players=${config.players} stats=${mstats} /><div class="actions"><${Btn} kind="filled" onClick=${() => close()}>${t('common.close')}<//></div>`)} />
      <${IconBtn} icon=${mode === 'keypad' ? 'target' : 'dialpad'} title=${t('game.inputMode')} onClick=${() => { const m = mode === 'keypad' ? 'darts' : 'keypad'; setMode(m); setPending([]); setEntry(''); update((x) => { x.settings.inputMode = m; }); }} />
    <//>
    <div class="game-body">
      <div class=${'players' + (many ? ' many' : '')}>
        ${s.sides.map((_, i) => {
          const active = i === side && !s.finished;
          const rem = active && mode === 'darts' ? liveRem : s.remaining[i];
          const route = active && set.hints && rem <= 170 ? checkoutRoute(rem, dartsLeft, config.out) : null;
          const myVisits = s.visits.filter((v) => v.s === i);
          const lastV = myVisits.at(-1);
          return html`<div class=${'pcard' + (active ? ' active' : '')} key=${'side' + i}>
            <span class="turn-dot"></span>
            <div class="pname"><${SideHead} config=${config} side=${i} s=${s} activeSide=${active} />
              <div class="legs">${config.sets && html`<span class="pip" title=${t('setup.sets')}>${s.setsWon[i]}</span>`}<span class="pip" title=${t('setup.legs')}>${s.legsWon[i]}</span></div>
            </div>
            <div class="rem" key=${rem}><span class="bump" style="display:inline-block">${rem}</span></div>
            <div class="sub"><span>⌀ ${fmt1(X01.sideMatchAvg(s, i))}</span><span>${t('game.dartsN', { n: X01.sideDarts(s, i) })}</span>${lastV && html`<span>${t('game.last')}: ${lastV.bust ? t('game.bust') : lastV.score}</span>`}</div>
            ${route ? html`<div class="hint">${route.map((d) => html`<b>${dartLabel(d)}</b>`)}</div>` : !many && html`<div class="visits">${myVisits.slice(-6).map((v) => html`<span class=${v.bust ? 'bust' : v.score >= 100 ? 'hi' : ''}>${v.bust ? '✕' : v.score}</span>`)}</div>`}
          </div>`;
        })}
      </div>

      <div class=${'input-panel' + (isBot && !s.finished ? ' waiting' : '')}>
        ${isBot && !s.finished ? html`<div class="entry botmsg" style="justify-content:center;gap:12px"><${Avatar} p=${pl} spin /><span class="title-m">${t('game.botThinking', { name: pl.name })}</span></div>` : null}
        ${mode === 'keypad' ? html`
          <div class="entry"><span class=${'value' + (entry === '' ? ' placeholder' : '') + (err ? ' err' : '')}>${entry === '' ? t('game.enterScore') : entry}</span>
            ${entry !== '' && before - +entry >= 0 && html`<span class="body-m muted">→ ${before - +entry}</span>`}
          </div>
          <div class="quick">${[26, 45, 60, 81, 100, 140, 180].map((q) => html`<button onClick=${() => !isBot && setEntry(String(q))}>${q}</button>`)}</div>
          <div class="keypad">
            ${['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((k) => html`<button class="key" onClick=${() => press(k)}>${k}</button>`)}
            <button class="key alt" onClick=${() => press('del')} aria-label=${t('game.delete')}><${Icon} n="backspace" /></button>
            <button class="key" onClick=${() => press('0')}>0</button>
            <button class="key ok" onClick=${ok} aria-label="OK" disabled=${isBot}>${entry === '' ? html`<span class="label-l">${t('game.noScore')}</span>` : html`<${Icon} n="check" size=${32} />`}</button>
          </div>` : html`
          <${DartSlots} darts=${pending} labels=${dartLabel} />
          <${Seg} value=${mult} onChange=${setMult} options=${[{ value: 1, label: t('game.single') }, { value: 2, label: t('game.double') }, { value: 3, label: t('game.treble') }]} />
          <div class=${'dartpad m' + mult}>
            ${Array.from({ length: 20 }, (_, i) => i + 1).map((n) => html`<button class="n" onClick=${() => addDart(n)}>${n}</button>`)}
            <button class="n" onClick=${() => addDart(25)} disabled=${mult === 3}>${mult === 2 ? 'Bull' : '25'}</button>
            <button onClick=${() => addDart(0)}>${t('game.miss')}</button>
            <button class="wide alt" onClick=${() => setPending(pending.slice(0, -1))} disabled=${!pending.length}><${Icon} n="backspace" /></button>
            <button class="go" onClick=${() => pending.length && lock(() => submit({ darts: pending }), 10)} disabled=${!pending.length}><${Icon} n="check" /></button>
          </div>`}
      </div>
    </div>
  </div>`;
}

// ====================== Cricket ======================
function Mark({ n }) {
  if (!n) return null;
  return html`<svg class="mark" viewBox="0 0 28 28" aria-label=${n}>
    <path d="M7 21 L21 7" />${n >= 2 && html`<path d="M7 7 L21 21" />`}${n >= 3 && html`<circle cx="14" cy="14" r="11" />`}
  </svg>`;
}
const keyLabel = (x) => (x === 25 ? 'B' : x);

function CricketGame({ a }) {
  const { config } = a;
  const s = useMemo(() => CR.compute(config, a.actions), [a.actions]);
  const [pending, setPending] = useState([]);
  const [mult, setMult] = useState(1);
  const [locked, lock] = useLock();
  const view = useMemo(() => (pending.length ? CR.preview(config, a.actions, pending) : s), [s, pending]);
  const cur = s.current, side = s.side, pl = config.players[cur];
  const isBot = !!pl.bot;
  useBot(a, s, () => CR.botAction(s, config, a.actions));
  useEffect(() => { setPending([]); setMult(1); }, [a.actions.length]);
  const submit = (darts) => afterPush(a, pushAction({ darts }));

  const addDart = (n) => {
    if (isBot || locked || pending.length >= 3) return;
    haptic(8);
    const d = { n, m: n === 0 ? 1 : n === 25 ? Math.min(mult, 2) : mult };
    const np = [...pending, d];
    setPending(np); setMult(1);
    const pv = CR.preview(config, a.actions, np);
    if (pv.legOver || np.length === 3) lock(() => submit(np), pv.legOver ? 600 : 350);
  };
  const label = (d) => (d.n === 0 ? '–' : d.n === 25 ? (d.m === 2 ? 'DB' : 'B') : (d.m === 3 ? 'T' : d.m === 2 ? 'D' : '') + d.n);
  const n = s.n;
  const targets = s.targets;
  const dead = (x) => (s.seq ? view.marks[side][x] >= 3 : x in view.marks[0] ? view.marks.every((m) => m[x] >= 3) : false);
  const cols = `52px repeat(${n}, minmax(0,1fr))`;
  const compact = targets.length > 8;
  const padNums = targets.filter((x) => typeof x === 'number' && x !== 25).sort((p, q) => (targets.length <= 7 ? q - p : p - q));
  const hasBull = targets.includes(25);
  const throwing = isTeamGame(config) ? ` · ${t('game.throwing', { name: pl.name })}` : '';

  return html`<div class="game">
    <${GameTop} a=${a} sub=${`${t('game.leg')} ${s.leg} · ${t('game.round')} ${Math.floor(s.visits.length / n) + 1}${config.rounds ? '/' + config.rounds : ''}${throwing}`} />
    <div class="game-body">
      <div class=${'cricket' + (compact ? ' compact' : '')}>
        <div class="crow" style=${`grid-template-columns:${cols}`}>
          <div></div>
          ${s.sides.map((members, i) => html`<div class=${'cell head' + (i === side ? ' activecol' : '')}>
            ${isTeamGame(config) ? html`<div class="row" style="gap:2px;justify-content:center">${members.map((pi) => html`<${Avatar} p=${config.players[pi]} spin=${pi === cur && config.players[pi].bot} />`)}</div>`
              : html`<${Avatar} p=${config.players[members[0]]} spin=${i === side && config.players[members[0]].bot} />`}
            <span class="nm">${sideName(config, i)}</span><span class="pts">${s.seq ? `${targets.filter((x) => view.marks[i][x] >= 3).length}/${targets.length}` : view.points[i]}</span>
            ${config.legsToWin > 1 && html`<span class="badge">${s.legsWon[i]}</span>`}
          </div>`)}
        </div>
        ${targets.map((x) => html`<div class="crow" style=${`grid-template-columns:${cols}`}>
          <div class=${'cell num' + (dead(x) ? ' dead' : '') + (s.seq && x === CR.nextTarget(view, side) ? ' next' : '')}>${keyLabel(x)}</div>
          ${s.sides.map((_, i) => html`<div class=${'cell' + (i === side ? ' activecol' : '')}><${Mark} n=${view.marks[i][x]} /></div>`)}
        </div>`)}
      </div>
      <div class="input-panel">
        ${isBot ? html`<div class="entry" style="justify-content:center;gap:12px"><${Avatar} p=${pl} spin /><span class="title-m">${t('game.botThinking', { name: pl.name })}</span></div>` : html`
        <${DartSlots} darts=${pending} labels=${label} />
        <${Seg} value=${mult} onChange=${setMult} options=${[{ value: 1, label: t('game.single') }, { value: 2, label: t('game.double') }, { value: 3, label: t('game.treble') }]} />
        <div class=${'dartpad m' + mult} style=${padNums.length > 6 ? '' : 'grid-template-columns:repeat(4,1fr)'}>
          ${padNums.map((x) => html`<button class=${'n' + (dead(x) ? ' closed' : '')} onClick=${() => addDart(x)}>${x}</button>`)}
          ${hasBull && html`<button class=${'n' + (dead(25) ? ' closed' : '')} onClick=${() => addDart(25)} disabled=${mult === 3}>${mult === 2 ? 'Bull' : '25'}</button>`}
          <button onClick=${() => addDart(0)}>${t('game.miss')}</button>
          <button class=${'alt' + (hasBull ? '' : ' wide')} onClick=${() => setPending(pending.slice(0, -1))} disabled=${!pending.length}><${Icon} n="backspace" /></button>
          <button class="wide go" onClick=${() => lock(() => submit([...pending, ...Array(3 - pending.length).fill({ n: 0, m: 1 })]), 10)}><${Icon} n="check" /> ${pending.length < 3 ? t('game.restMiss') : ''}</button>
        </div>`}
      </div>
    </div>
  </div>`;
}

// ====================== Around the Clock ======================
function targetLabel(n, mode) {
  if (n === 25) return mode === 'double' ? 'Bull' : mode === 'treble' ? 'Bull' : '25';
  return (mode === 'double' ? 'D' : mode === 'treble' ? 'T' : '') + n;
}

function PlayersProgress({ players, cur, value, max, right }) {
  return html`<div class="stack s">${players.map((p, i) => html`<div class=${'pcard' + (i === cur ? ' active' : '')} style="padding:12px 16px" key=${p.id}>
    <div class="pname"><${Avatar} p=${p} /><span class="title-m grow">${p.name}</span><span class="title-l num">${right(i)}</span></div>
    <${Wavy} value=${value(i)} max=${max} />
  </div>`)}</div>`;
}

function AtcGame({ a }) {
  const { config } = a;
  const s = useMemo(() => ATC.compute(config, a.actions), [a.actions]);
  const [pending, setPending] = useState([]);
  const [locked, lock] = useLock();
  useEffect(() => setPending([]), [a.actions.length]);
  const cur = s.current;
  const pos = s.pos[cur] + pending.filter(Boolean).length;
  const tgt = s.targets[Math.min(pos, s.targets.length - 1)];
  const add = (hit) => {
    if (locked || pending.length >= 3) return;
    haptic(hit ? 20 : 8);
    const np = [...pending, hit];
    setPending(np);
    const done = s.pos[cur] + np.filter(Boolean).length >= s.targets.length;
    if (done || np.length === 3) lock(() => afterPush(a, pushAction({ hits: np })), 400);
  };
  return html`<div class="game">
    <${GameTop} a=${a} sub=${t('game.dartsN', { n: s.darts[cur] + pending.length })} />
    <div class="game-body">
      <div class="stack">
        <div class="big-target"><${Shape} name="sunny" cls="deco" /><div class="label-l">${config.players[cur].name} · ${t('game.target')}</div><div class="v">${targetLabel(tgt, config.mode)}</div></div>
        ${config.players.length > 1 && html`<${PlayersProgress} players=${config.players} cur=${cur} value=${(i) => s.pos[i]} max=${s.targets.length} right=${(i) => targetLabel(s.targets[Math.min(s.pos[i], s.targets.length - 1)], config.mode)} />`}
        ${config.players.length === 1 && html`<div class="card"><${Wavy} value=${pos} max=${s.targets.length} /><div class="row between body-m muted" style="margin-top:8px"><span>${pos}/${s.targets.length}</span><span>${t('stats.hitPct')}: ${s.darts[cur] ? Math.round((s.hits[cur] / s.darts[cur]) * 100) : 0}%</span></div></div>`}
      </div>
      <div class="input-panel">
        <${DartSlots} darts=${pending} labels=${(h) => html`<${Icon} n=${h ? 'check' : 'close'} />`} />
        <div class="hit-row">
          <button class="key" style="height:96px;font-size:22px" onClick=${() => add(false)}><span class="row"><${Icon} n="close" /> ${t('game.miss')}</span></button>
          <button class="key ok" style="height:96px;font-size:22px" onClick=${() => add(true)}><span class="row"><${Icon} n="check" /> ${t('game.hit')}</span></button>
        </div>
      </div>
    </div>
  </div>`;
}

// ====================== Bob's 27 ======================
function BobsGame({ a }) {
  const { config } = a;
  const s = useMemo(() => BOBS.compute(config, a.actions), [a.actions]);
  const [locked, lock] = useLock();
  const cur = s.current;
  const tgt = BOBS.targets[s.round[cur]] ?? 25;
  const lab = tgt === 25 ? 'Bull' : 'D' + tgt;
  const go2 = (h) => { if (locked) return; haptic(h ? 20 : 8); lock(() => afterPush(a, pushAction({ hits: h })), 120); };
  return html`<div class="game">
    <${GameTop} a=${a} sub=${`${t('game.round')} ${Math.min(s.round[cur] + 1, 21)}/21`} />
    <div class="game-body">
      <div class="stack">
        <div class="big-target"><${Shape} name="flower" cls="deco" /><div class="label-l">${config.players[cur].name} · ${t('stats.score')} ${s.score[cur]}</div><div class="v">${lab}</div><div class="body-m">±${tgt === 25 ? 50 : tgt * 2}</div></div>
        <${PlayersProgress} players=${config.players} cur=${cur} value=${(i) => s.round[i]} max=${21} right=${(i) => (s.out[i] ? '✕ ' : '') + s.score[i]} />
      </div>
      <div class="input-panel">
        <div class="label-l muted" style="text-align:center">${t('game.hitsQ')}</div>
        <div class="keypad" style="grid-template-columns:repeat(4,1fr)">
          ${[0, 1, 2, 3].map((h) => html`<button class=${'key' + (h ? ' ok' : ' alt')} style="height:88px;font-size:36px" onClick=${() => go2(h)}>${h}</button>`)}
        </div>
      </div>
    </div>
  </div>`;
}

// ====================== Checkout practice ======================
function CheckoutGame({ a }) {
  const { config } = a;
  const s = useMemo(() => CK.compute(config, a.actions), [a.actions]);
  const [locked, lock] = useLock();
  const tgt = s.seq[Math.min(s.idx, s.seq.length - 1)];
  const route = checkoutRoute(tgt, 3, 'double') || [];
  const hits = s.results.filter((r) => r.ok).length;
  const res = (ok, darts) => { if (locked) return; haptic(ok ? 25 : 8); lock(() => afterPush(a, pushAction({ ok, darts })), 120); };
  return html`<div class="game">
    <${GameTop} a=${a} sub=${`${Math.min(s.idx + 1, s.seq.length)}/${s.seq.length} · ✓ ${hits}`} />
    <div class="game-body">
      <div class="stack">
        <div class="big-target"><${Shape} name="burst" cls="deco" /><div class="label-l">${t('game.checkoutThis')}</div><div class="v">${tgt}</div>
          <div class="row" style="justify-content:center;gap:6px">${route.map((d) => html`<span class="badge" style="height:28px;font-size:14px;padding:0 12px">${dartLabel(d)}</span>`)}</div></div>
        <div class="card"><${Wavy} value=${s.idx} max=${s.seq.length} />
          <div class="row wrap" style="gap:6px;margin-top:12px">${s.results.map((r) => html`<span class=${'badge' + (r.ok ? ' win' : '')}>${r.target}</span>`)}</div></div>
      </div>
      <div class="input-panel">
        <div class="label-l muted" style="text-align:center">${t('game.finishedWith')}</div>
        <div class="keypad">
          ${[1, 2, 3].map((d) => html`<button class="key ok" onClick=${() => res(true, d)} disabled=${route.length > d}>${d} <span class="label-l" style="margin-left:4px">${t('stats.dartsShort')}</span></button>`)}
        </div>
        <button class="key alt" onClick=${() => res(false, 3)}><span class="row"><${Icon} n="close" /> ${t('game.missed')}</span></button>
      </div>
    </div>
  </div>`;
}

// ====================== 121 Checkout ======================
function C121Game({ a }) {
  const { config } = a;
  const s = useMemo(() => C121.compute(config, a.actions), [a.actions]);
  const [locked, lock] = useLock();
  const route = checkoutRoute(Math.min(s.target, 170), 3, 'double') || [];
  const res = (ok, darts) => { if (locked) return; haptic(ok ? 25 : 8); lock(() => afterPush(a, pushAction({ ok, darts })), 120); };
  return html`<div class="game">
    <${GameTop} a=${a} sub=${`${Math.min(s.results.length + 1, config.rounds)}/${config.rounds} · ${t('stats.best')} ${s.best || '–'}`} />
    <div class="game-body">
      <div class="stack">
        <div class="big-target"><${Shape} name="burst" cls="deco" /><div class="label-l">${t('game.nineDarts')}</div><div class="v">${s.target}</div>
          <div class="row" style="justify-content:center;gap:6px">${s.target <= 170 && route.map((d) => html`<span class="badge" style="height:28px;font-size:14px;padding:0 12px">${dartLabel(d)}</span>`)}</div></div>
        <div class="card"><${Wavy} value=${s.results.length} max=${config.rounds} />
          <div class="row wrap" style="gap:6px;margin-top:12px">${s.results.map((r) => html`<span class=${'badge' + (r.ok ? ' win' : '')}>${r.target}</span>`)}</div></div>
      </div>
      <div class="input-panel">
        <div class="label-l muted" style="text-align:center">${t('game.finishedVisit')}</div>
        <div class="keypad">
          ${[1, 2, 3].map((v) => html`<button class="key ok" onClick=${() => res(true, v * 3)}>${t('game.visitN', { n: v })}</button>`)}
        </div>
        <button class="key alt" onClick=${() => res(false, 9)}><span class="row"><${Icon} n="close" /> ${t('game.missed')}</span></button>
      </div>
    </div>
  </div>`;
}

// ====================== Doubles training ======================
function DoublesGame({ a }) {
  const { config } = a;
  const s = useMemo(() => DBL.compute(config, a.actions), [a.actions]);
  const [locked, lock] = useLock();
  const cur = s.current;
  const tgt = s.targets[Math.min(s.round[cur], s.targets.length - 1)];
  const go2 = (h) => { if (locked) return; haptic(h ? 20 : 8); lock(() => afterPush(a, pushAction({ hits: h })), 120); };
  return html`<div class="game">
    <${GameTop} a=${a} sub=${`${Math.min(s.round[cur] + 1, 21)}/21`} />
    <div class="game-body">
      <div class="stack">
        <div class="big-target"><${Shape} name="clover" cls="deco" /><div class="label-l">${config.players[cur].name} · ${t('stats.hits')} ${s.hits[cur]}</div><div class="v">${tgt === 25 ? 'Bull' : 'D' + tgt}</div></div>
        <${PlayersProgress} players=${config.players} cur=${cur} value=${(i) => s.round[i]} max=${21} right=${(i) => s.hits[i]} />
      </div>
      <div class="input-panel">
        <div class="label-l muted" style="text-align:center">${t('game.hitsQ')}</div>
        <div class="keypad" style="grid-template-columns:repeat(4,1fr)">
          ${[0, 1, 2, 3].map((h) => html`<button class=${'key' + (h ? ' ok' : ' alt')} style="height:88px;font-size:36px" onClick=${() => go2(h)}>${h}</button>`)}
        </div>
      </div>
    </div>
  </div>`;
}

// ====================== Shanghai ======================
function ShanghaiGame({ a }) {
  const { config } = a;
  const s = useMemo(() => SHA.compute(config, a.actions), [a.actions]);
  const [pending, setPending] = useState([]);
  const [locked, lock] = useLock();
  useEffect(() => setPending([]), [a.actions.length]);
  const cur = s.current;
  const tgt = Math.min(s.round[cur] + 1, s.rounds);
  const add = (m) => {
    if (locked || pending.length >= 3) return;
    haptic(m ? 15 : 8);
    const np = [...pending, { m }];
    setPending(np);
    if (np.length === 3) lock(() => afterPush(a, pushAction({ darts: np })), 400);
  };
  const lab = (d) => (d.m === 0 ? '–' : (d.m === 3 ? 'T' : d.m === 2 ? 'D' : 'S') + tgt);
  const live = pending.reduce((x, d) => x + d.m * tgt, 0);
  return html`<div class="game">
    <${GameTop} a=${a} sub=${`${t('game.round')} ${tgt}/${s.rounds}`} />
    <div class="game-body">
      <div class="stack">
        <div class="big-target"><${Shape} name="sunny" cls="deco" /><div class="label-l">${config.players[cur].name} · ${t('stats.score')} ${s.score[cur] + live}</div><div class="v">${tgt}</div><div class="body-m">${t('game.shanghaiHint')}</div></div>
        <${PlayersProgress} players=${config.players} cur=${cur} value=${(i) => s.round[i]} max=${s.rounds} right=${(i) => s.score[i]} />
      </div>
      <div class="input-panel">
        <${DartSlots} darts=${pending} labels=${lab} />
        <div class="keypad" style="grid-template-columns:repeat(4,1fr)">
          <button class="key alt" onClick=${() => add(0)}>${t('game.miss')}</button>
          <button class="key" onClick=${() => add(1)}>S${tgt}</button>
          <button class="key" style="background:var(--secondary-container);color:var(--on-secondary-container)" onClick=${() => add(2)}>D${tgt}</button>
          <button class="key" style="background:var(--tertiary-container);color:var(--on-tertiary-container)" onClick=${() => add(3)}>T${tgt}</button>
        </div>
        <button class="key alt" style="height:48px" onClick=${() => setPending(pending.slice(0, -1))} disabled=${!pending.length}><${Icon} n="backspace" /></button>
      </div>
    </div>
  </div>`;
}