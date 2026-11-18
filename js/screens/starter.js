// "Who starts?" before a match: closest to the bull, coin toss, or the order as listed.
// Each side is represented by its top player (long-press a player on the bull board to pick another member).
import { html, useState, useRef, useEffect } from '../../vendor/preact-htm.js';
import { t } from '../i18n.js';
import { Icon, Btn, Avatar, openDialog, haptic, confetti } from '../ui.js';
import { BOARD_ORDER, R, gauss } from '../darts.js';
import { botLevel } from '../bot.js';

/**
 * sides: [{ name, members: [player, ...] }, ...] (top player first).
 * Resolves to { first, reps } — the starting side and, per side, the member who threw the bull-off
 * (that member moves to the top of the team) — or null when cancelled.
 */
let busy = false; // a double tap on Start must not open the menu twice
export async function chooseStarter(sides) {
  if (busy) return null;
  busy = true;
  try { return await chooseStarterInner(sides); } finally { busy = false; }
}

async function chooseStarterInner(sides) {
  const plain = (first) => (first == null ? null : { first, reps: sides.map(() => 0) });
  const how = await openDialog((close) => html`
    <div class="icon-head"><${Icon} n="flag" size=${32} /></div>
    <div class="headline-s" style="text-align:center">${t('start.title')}</div>
    <div class="body-m muted" style="text-align:center">${t('start.sub')}</div>
    <div class="start-opts">
      <button class="start-opt" onClick=${() => close('bull')}><span class="ico"><${Icon} n="adjust" size=${30} /></span><span><b>${t('start.bull')}</b><small>${t('start.bullSub')}</small></span></button>
      ${sides.length === 2 && html`<button class="start-opt" onClick=${() => close('coin')}><span class="ico"><${Icon} n="toll" size=${30} /></span><span><b>${t('start.coin')}</b><small>${t('start.coinSub')}</small></span></button>`}
      <button class="start-opt quiet" onClick=${() => close('order')}><span class="ico"><${Icon} n="format_list_numbered" size=${26} /></span><span><b>${t('start.order')}</b><small>${t('start.orderSub', { name: sides[0].name })}</small></span></button>
    </div>
    <div class="actions"><${Btn} kind="text" onClick=${() => close(null)}>${t('common.cancel')}<//></div>`);
  if (!how) return null;
  if (how === 'order') return plain(0);
  if (how === 'coin') return plain(await coinToss(sides));
  return bullOff(sides);
}

// ---------------- Coin toss ----------------
function coinToss(sides) {
  return openDialog((close) => {
    const Inner = () => {
      const [res, setRes] = useState(null); // winning side
      const [spin, setSpin] = useState(0); // total rotation in deg
      const [busy, setBusy] = useState(false);
      const toss = () => {
        if (busy) return;
        const w = Math.random() < 0.5 ? 0 : 1;
        haptic(20);
        setBusy(true); setRes(null);
        // land on face w (0 = front, 1 = back) after several turns
        const base = Math.ceil(spin / 360) * 360 + 360 * 6;
        setSpin(base + (w ? 180 : 0));
        setTimeout(() => { setRes(w); setBusy(false); haptic(40); }, 2300);
      };
      useEffect(() => { const id = setTimeout(toss, 350); return () => clearTimeout(id); }, []);
      const face = (i) => html`<div class=${'coin-face' + (i ? ' back' : '')}>
        <${Avatar} p=${sides[i].members[0]} size="xl" /><span class="coin-name">${sides[i].name}</span></div>`;
      return html`<div class="headline-s" style="text-align:center">${t('start.coin')}</div>
        <div class="coin-stage"><div class=${'coin' + (busy ? ' flying' : '')} style=${`transform: rotateY(${spin}deg)`}>${face(0)}${face(1)}</div><div class=${'coin-shadow' + (busy ? ' flying' : '')}></div></div>
        <div class="coin-result title-l" aria-live="polite">${res == null ? (busy ? t('start.tossing') : '') : t('start.starts', { name: sides[res].name })}</div>
        <div class="actions"><${Btn} kind="text" onClick=${() => close(null)}>${t('common.cancel')}<//>
          <${Btn} kind="tonal" icon="replay" onClick=${toss} disabled=${busy}>${t('start.again')}<//>
          <${Btn} kind="filled" icon="play_arrow" onClick=${() => close(res)} disabled=${res == null}>${t('setup.start')}<//></div>`;
    };
    return html`<${Inner} />`;
  });
}

// ---------------- Bull-off on a board ----------------
const VIEW = 238; // the whole board: playing area (170 mm) + number ring
const SEG_COLORS = ['#1d1d1f', '#efe6cf']; // singles: black / cream
const RING_COLORS = ['#d1262f', '#1d8a4c']; // doubles & trebles: red / green
const WIRE = '#c9c2ad';

function arcPath(r1, r2, a1, a2) {
  const p = (r, a) => [Math.sin(a) * r, -Math.cos(a) * r];
  const [x1, y1] = p(r2, a1), [x2, y2] = p(r2, a2), [x3, y3] = p(r1, a2), [x4, y4] = p(r1, a1);
  return `M${x1} ${y1} A${r2} ${r2} 0 0 1 ${x2} ${y2} L${x3} ${y3} A${r1} ${r1} 0 0 0 ${x4} ${y4} Z`;
}

/** Full dartboard (mm, bull at 0,0) with the numbers and ninedarter branding on the outer ring. */
function Board({ marks, onMark }) {
  const ref = useRef(null);
  const segs = [], wires = [], nums = [];
  BOARD_ORDER.forEach((n, i) => {
    const a1 = ((i * 18 - 9) * Math.PI) / 180, a2 = ((i * 18 + 9) * Math.PI) / 180, mid = (i * 18 * Math.PI) / 180;
    const k = i % 2;
    segs.push(html`<path d=${arcPath(R.outerBull, R.trebleIn, a1, a2)} fill=${SEG_COLORS[k]} />`);
    segs.push(html`<path d=${arcPath(R.trebleIn, R.trebleOut, a1, a2)} fill=${RING_COLORS[k]} />`);
    segs.push(html`<path d=${arcPath(R.trebleOut, R.doubleIn, a1, a2)} fill=${SEG_COLORS[k]} />`);
    segs.push(html`<path d=${arcPath(R.doubleIn, R.doubleOut, a1, a2)} fill=${RING_COLORS[k]} />`);
    wires.push(html`<line x1=${Math.sin(a1) * R.outerBull} y1=${-Math.cos(a1) * R.outerBull} x2=${Math.sin(a1) * R.doubleOut} y2=${-Math.cos(a1) * R.doubleOut} />`);
    nums.push(html`<text x=${Math.sin(mid) * 191} y=${-Math.cos(mid) * 191} class="bb-num">${n}</text>`);
  });
  const tap = (e) => {
    const svg = ref.current; if (!svg) return;
    const pt = svg.createSVGPoint(); pt.x = e.clientX; pt.y = e.clientY;
    const p = pt.matrixTransform(svg.getScreenCTM().inverse());
    onMark(p.x, p.y);
  };
  return html`<svg ref=${ref} class="bull-board" viewBox=${`${-VIEW} ${-VIEW} ${VIEW * 2} ${VIEW * 2}`} onPointerDown=${tap} role="img" aria-label=${t('start.boardLabel')}>
    <defs>
      <path id="bb-top" d="M -219 0 A 219 219 0 0 1 219 0" />
      <path id="bb-bottom" d="M -226 0 A 226 226 0 0 0 226 0" />
    </defs>
    <circle r=${VIEW - 2} fill="#141416" stroke="#2c2c30" stroke-width="4" />
    <circle r=${R.doubleOut + 2} fill="#0d0d0e" />
    ${segs}
    <circle r=${R.outerBull} fill=${RING_COLORS[1]} /><circle r=${R.bull} fill=${RING_COLORS[0]} />
    <g stroke=${WIRE} stroke-width="0.8" fill="none" opacity="0.85">${wires}${[R.bull, R.outerBull, R.trebleIn, R.trebleOut, R.doubleIn, R.doubleOut].map((r) => html`<circle r=${r} />`)}</g>
    ${nums}
    <text class="bb-brand"><textPath href="#bb-top" startOffset="50%" text-anchor="middle">ninedarter</textPath></text>
    <text class="bb-brand small"><textPath href="#bb-bottom" startOffset="50%" text-anchor="middle">ninedarter · every dart counts</textPath></text>
    ${marks.map((m) => m && html`<g class="bull-dart" transform=${`translate(${m.x} ${m.y})`} style=${`--ph:${m.hue}`}>
      <circle r="10" class="halo" /><circle r="4.5" class="tip" /><text y="-14" text-anchor="middle">${m.label}</text></g>`)}
  </svg>`;
}

function bullOff(sides) {
  return openDialog((close) => {
    const Inner = () => {
      const [reps, setReps] = useState(sides.map(() => 0)); // member index representing each side
      const [marks, setMarks] = useState(sides.map(() => null)); // {x, y} in mm (svg coords, y down)
      const [active, setActive] = useState(0);
      const [picking, setPicking] = useState(null); // side whose thrower is being changed
      const press = useRef(null);
      const player = (i) => sides[i].members[reps[i]];
      const dist = (m) => (m ? Math.hypot(m.x, m.y) : null);
      const nextOpen = (ms, from) => { for (let k = 1; k <= sides.length; k++) { const j = (from + k) % sides.length; if (!ms[j]) return j; } return from; };

      const mark = (x, y) => {
        if (picking != null) return;
        haptic(15);
        const ms = marks.map((m, i) => (i === active ? { x, y } : m));
        setMarks(ms);
        setActive(nextOpen(ms, active));
      };
      // bots throw their own dart at the bull
      useEffect(() => {
        const p = player(active);
        if (!p?.bot || marks[active]) return;
        const id = setTimeout(() => { const s = botLevel(p.bot).dsig * 1.6; mark(gauss() * s, gauss() * s); }, 700);
        return () => clearTimeout(id);
      }, [active, marks, reps]);

      const done = marks.every(Boolean);
      const ds = marks.map(dist);
      const best = done ? Math.min(...ds) : null;
      const winners = done ? ds.map((d, i) => (Math.abs(d - best) < 0.05 ? i : -1)).filter((i) => i >= 0) : [];
      const winner = winners.length === 1 ? winners[0] : null;
      useEffect(() => { if (winner != null) { haptic(40); confetti(); } }, [winner]);
      const retie = () => { setMarks(marks.map((m, i) => (winners.includes(i) ? null : m))); setActive(winners[0]); };

      // long press a player to choose another member of that side
      const down = (i) => { press.current = setTimeout(() => { press.current = 'long'; if (sides[i].members.length > 1) { haptic(25); setPicking(i); } }, 450); };
      const up = (i) => { const long = press.current === 'long'; clearTimeout(press.current); press.current = null; if (!long) { setPicking(null); setActive(i); haptic(8); } };

      const chip = (i) => {
        const p = player(i), d = ds[i];
        return html`<button class=${'bull-chip' + (i === active && !done ? ' on' : '') + (winner === i ? ' win' : '')}
            onPointerDown=${() => down(i)} onPointerUp=${() => up(i)} onPointerLeave=${() => { if (press.current && press.current !== 'long') clearTimeout(press.current); }} onContextMenu=${(e) => e.preventDefault()}>
          <${Avatar} p=${p} />
          <span class="bc-text"><span class="bc-name ellipsis">${p.name}</span>${sides[i].name !== p.name && html`<span class="bc-side ellipsis">${sides[i].name}</span>`}</span>
          <span class="bc-dist">${d == null ? (i === active ? t('start.tapBoard') : '–') : `${d.toFixed(1)} mm`}</span>
        </button>`;
      };
      const teamGame = sides.some((sd) => sd.members.length > 1);
      return html`<div class="headline-s">${t('start.bull')}</div>${teamGame && html`<div class="body-s muted" style="margin-top:-10px">${t('start.holdHint')}</div>`}
        <div class=${'bull-chips n' + sides.length}>${sides.map((_, i) => chip(i))}</div>
        ${picking != null && html`<div class="bull-pick">
          <span class="label-l">${t('start.pickThrower', { side: sides[picking].name })}</span>
          <div class="row wrap" style="gap:6px">${sides[picking].members.map((m, k) => html`<button class=${'chip' + (k === reps[picking] ? ' on' : '')} onClick=${() => { setReps(reps.map((r, i) => (i === picking ? k : r))); setActive(picking); setPicking(null); }}><${Avatar} p=${m} />${m.name}</button>`)}</div>
        </div>`}
        <${Board} marks=${marks.map((m, i) => m && { ...m, hue: player(i).hue ?? 285, label: player(i).name.slice(0, 1).toUpperCase() })} onMark=${mark} />
        <div class="coin-result title-m" aria-live="polite">${!done ? t('start.throwFor', { name: player(active).name }) : winner != null ? t('start.starts', { name: sides[winner].name }) : t('start.tie')}</div>
        <div class="actions"><${Btn} kind="text" onClick=${() => close(null)}>${t('common.cancel')}<//>
          ${marks.some(Boolean) && html`<${Btn} kind="tonal" icon="replay" onClick=${() => (done && winner == null ? retie() : (setMarks(sides.map(() => null)), setActive(0)))}>${done && winner == null ? t('start.throwAgain') : t('start.reset')}<//>`}
          <${Btn} kind="filled" icon="play_arrow" onClick=${() => close({ first: winner, reps })} disabled=${winner == null}>${t('setup.start')}<//></div>`;
    };
    return html`<${Inner} />`;
  });
}
