// Shared UI primitives in the M3 Expressive style.
import { html, useState, useEffect, useRef } from '../vendor/preact-htm.js';
import { getState } from './store.js';

export const Icon = ({ n, fill, size, cls = '' }) =>
  html`<span class=${'msr ' + (fill ? 'fill ' : '') + cls} style=${size ? `font-size:${size}px` : ''} aria-hidden="true">${n}</span>`;

// ---------- Expressive shapes (polar curves) ----------
const SHAPE_DEF = { cookie: [9, 0.075], flower: [8, 0.13], clover: [4, 0.2], sunny: [8, 0.09], burst: [12, 0.065], pill: [2, 0.12], gem: [5, 0.1], puffy: [6, 0.09], circle: [1, 0] };
const pathCache = {};
export function shapePath(name = 'cookie') {
  if (pathCache[name]) return pathCache[name];
  const [k, a] = SHAPE_DEF[name] || SHAPE_DEF.cookie;
  const r0 = 50 / (1 + a);
  let d = '';
  const N = 144;
  for (let i = 0; i <= N; i++) {
    const t = (i / N) * Math.PI * 2;
    const r = r0 * (1 + a * Math.cos(k * t));
    const x = 50 + r * Math.sin(t), y = 50 - r * Math.cos(t);
    d += (i ? 'L' : 'M') + x.toFixed(2) + ' ' + y.toFixed(2);
  }
  return (pathCache[name] = d + 'Z');
}
export const Shape = ({ name, cls = '', style = '' }) =>
  html`<svg class=${cls} style=${style} viewBox="0 0 100 100" aria-hidden="true"><path d=${shapePath(name)} fill="currentColor" /></svg>`;

export function Avatar({ p, size = '', spin = false }) {
  if (!p) return null;
  const letter = p.bot ? '' : (p.name || '?').trim().charAt(0).toUpperCase();
  const shape = p.shape || 'cookie';
  const gs = getState();
  const photo = p.photo || (!p.bot && (p.kind === 'me' || p.id === gs.profile?.localId) ? gs.account?.avatar || gs.profile?.photo : null);
  if (photo) {
    const cid = 'av-' + shape;
    return html`<div class=${'avatar photo ' + size + (spin ? ' spin' : '')} style=${`--ph:${p.hue ?? 285}`}>
      <svg viewBox="0 0 100 100" aria-hidden="true"><defs><clipPath id=${cid}><path d=${shapePath(shape)} /></clipPath></defs>
        <path d=${shapePath(shape)} /><image href=${photo}x="0" y="0" width="100" height="100" preserveAspectRatio="xMidYMid slice" clip-path=${`url(#${cid})`} /></svg>
    </div>`;
  }
  return html`<div class=${'avatar ' + size + (spin ? ' spin' : '')} style=${`--ph:${p.hue ?? 285}`}>
    <svg viewBox="0 0 100 100" aria-hidden="true"><path d=${shapePath(shape)} /></svg>
    ${p.bot ? html`<${Icon} n="smart_toy" fill size=${size === 'xl' ? 40 : size === 'l' ? 28 : 20} />` : html`<span>${letter}</span>`}
  </div>`;
}

export const Btn = ({ kind = '', size = '', icon, children, onClick, disabled, cls = '', title, type = 'button' }) =>
  html`<button type=${type} class=${`btn ${kind} ${size} ${cls}`} onClick=${onClick} disabled=${disabled} title=${title} aria-label=${title}>
    ${icon && html`<${Icon} n=${icon} />`}${children}
  </button>`;

export const IconBtn = ({ icon, onClick, kind = '', size = '', title, fill, disabled }) =>
  html`<button class=${`btn icon-btn ${kind} ${size}`} onClick=${onClick} title=${title} aria-label=${title} disabled=${disabled}><${Icon} n=${icon} fill=${fill} /></button>`;

/** Connected button group (single select) */
export function Seg({ value, options, onChange, size = '', wrap = false }) {
  return html`<div class=${'bgroup ' + size + (wrap ? ' wrap' : '')} role="radiogroup">
    ${options.map((o) => html`<button class=${'seg' + (o.value === value ? ' on' : '')} role="radio" aria-checked=${o.value === value} onClick=${() => { haptic(8); onChange(o.value); }}>
      ${o.value === value && o.icon !== false ? html`<${Icon} n=${o.icon || 'check'} size=${18} />` : null}${o.label}
    </button>`)}
  </div>`;
}

export const Switch = ({ checked, onChange, label }) =>
  html`<label class="switch"><input type="checkbox" checked=${checked} aria-label=${label} onChange=${(e) => { haptic(8); onChange(e.target.checked); }} /><span class="track"></span><span class="thumb"></span></label>`;

/**
 * Touch-friendly slider. The whole track is the touch target (tap to jump, drag horizontally anywhere),
 * vertical swipes still scroll the page, and updates are throttled while dragging so heavy handlers
 * (e.g. saving settings) don't make the drag stutter. Keyboard / screen readers keep the native range input.
 */
export function Slider({ min, max, step = 1, value, onInput, label }) {
  const [local, setLocal] = useState(null);
  const drag = useRef(null);
  const shown = local ?? value;
  const pct = ((shown - min) / (max - min)) * 100;

  const valueAt = (el, clientX) => {
    const r = el.getBoundingClientRect();
    const f = Math.min(1, Math.max(0, (clientX - r.left) / r.width));
    const v = Math.round((min + f * (max - min)) / step) * step;
    return Math.min(max, Math.max(min, +v.toFixed(6)));
  };
  const emit = (v, force) => {
    const d = drag.current;
    setLocal(v);
    const now = performance.now();
    if (force || !d || now - d.last > 60) { if (d) d.last = now; onInput(v); }
    else if (d) { clearTimeout(d.t); d.t = setTimeout(() => { d.last = performance.now(); onInput(v); }, 70); }
  };

  const down = (e) => {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    drag.current = { id: e.pointerId, x: e.clientX, y: e.clientY, active: e.pointerType === 'mouse', last: 0, t: 0 };
    if (e.pointerType === 'mouse') { try { e.currentTarget.setPointerCapture(e.pointerId); } catch {} emit(valueAt(e.currentTarget, e.clientX)); }
    e.preventDefault();
  };
  const move = (e) => {
    const d = drag.current;
    if (!d || d.id !== e.pointerId) return;
    if (!d.active) {
      const dx = Math.abs(e.clientX - d.x), dy = Math.abs(e.clientY - d.y);
      if (dy > 8 && dy > dx) { drag.current = null; return; } // vertical swipe: let the page scroll
      if (dx < 4) return;
      d.active = true;
      try { e.currentTarget.setPointerCapture(e.pointerId); } catch {}
    }
    emit(valueAt(e.currentTarget, e.clientX));
  };
  const up = (e) => {
    const d = drag.current;
    if (!d || d.id !== e.pointerId) return;
    clearTimeout(d.t);
    // a tap (no drag) jumps to the tapped position
    onInput(d.active ? valueAt(e.currentTarget, e.clientX) : valueAt(e.currentTarget, d.x));
    drag.current = null;
    setLocal(null);
  };
  const cancel = () => { if (drag.current) clearTimeout(drag.current.t); drag.current = null; setLocal(null); };

  return html`<input class="slider" type="range" min=${min} max=${max} step=${step} value=${shown} aria-label=${label} style=${`--pct:${pct}%`}
    onInput=${(e) => { if (!drag.current) onInput(+e.target.value); }}
    onPointerDown=${down} onPointerMove=${move} onPointerUp=${up} onPointerCancel=${cancel} onLostPointerCapture=${(e) => { if (drag.current?.active) up(e); }} />`;
}

export function Wavy({ value, max }) {
  const w = 300, pct = Math.max(0, Math.min(1, max ? value / max : 0));
  const x = Math.max(6, w * pct);
  const id = useRef('w' + Math.random().toString(36).slice(2)).current;
  let d = 'M2 8';
  for (let i = 2; i <= x + 24; i += 2) d += ` L${i} ${(8 + Math.sin(i / 24 * Math.PI * 2) * 3).toFixed(2)}`;
  return html`<svg class="wavy" viewBox="0 0 ${w} 16" preserveAspectRatio="none" role="progressbar" aria-valuenow=${value} aria-valuemax=${max}>
    <defs><clipPath id=${id}><rect x="0" y="0" width=${x} height="16" /></clipPath></defs>
    <line class="track" x1=${Math.min(w - 2, x + 8)} y1="8" x2=${w - 2} y2="8" />
    <g clip-path=${`url(#${id})`}><path class="ind wave" d=${d} /></g>
  </svg>`;
}

// ---------- Haptics ----------
export function haptic(ms = 10) {
  if (getState().settings.vibrate && navigator.vibrate) try { navigator.vibrate(ms); } catch {}
}

// ---------- Dialogs & snackbar (module level hosts) ----------
let dialogs = [], setDialogs = null;
export function openDialog(render) {
  return new Promise((resolve) => {
    const d = { id: Math.random(), render, resolve };
    dialogs = [...dialogs, d];
    setDialogs && setDialogs(dialogs);
  });
}
function closeDialog(d, val) {
  dialogs = dialogs.filter((x) => x !== d);
  setDialogs && setDialogs(dialogs);
  d.resolve(val);
}
export function DialogHost() {
  const [list, set] = useState(dialogs);
  useEffect(() => { setDialogs = set; return () => { setDialogs = null; }; }, []);
  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape' && dialogs.length) closeDialog(dialogs[dialogs.length - 1], undefined); };
    addEventListener('keydown', onKey); return () => removeEventListener('keydown', onKey);
  }, []);
  return list.map((d) => html`<div key=${d.id} class="scrim" onClick=${(e) => e.target === e.currentTarget && closeDialog(d, undefined)}>
    <div class="dialog" role="dialog" aria-modal="true">${d.render((v) => closeDialog(d, v))}</div>
  </div>`);
}

export function confirmDialog({ title, text, ok, cancel, icon, danger }) {
  return openDialog((close) => html`
    ${icon && html`<div class="icon-head"><${Icon} n=${icon} size=${28} /></div>`}
    <div class="headline-s" style=${icon ? 'text-align:center' : ''}>${title}</div>
    ${text && html`<div class="body-m muted">${text}</div>`}
    <div class="actions">
      <${Btn} kind="text" onClick=${() => close(false)}>${cancel}<//>
      <${Btn} kind=${danger ? 'danger' : 'filled'} onClick=${() => close(true)}>${ok}<//>
    </div>`);
}

let snackSet = null, snackTimer = 0;
export function snack(text, action) {
  clearTimeout(snackTimer);
  snackSet && snackSet({ text, action, k: Math.random() });
  snackTimer = setTimeout(() => snackSet && snackSet(null), action ? 5000 : 2600);
}
export function SnackHost() {
  const [s, set] = useState(null);
  useEffect(() => { snackSet = set; return () => { snackSet = null; }; }, []);
  if (!s) return null;
  return html`<div class="snackbar" key=${s.k} role="status">${s.text}${s.action && html`<button class="btn text xs" style="color:var(--inverse-primary)" onClick=${() => { s.action.fn(); set(null); }}>${s.action.label}</button>`}</div>`;
}

export function confetti() {
  const box = document.createElement('div');
  box.className = 'confetti';
  const h = getState().settings.hue;
  for (let i = 0; i < 70; i++) {
    const c = document.createElement('i');
    const hue = [h, h + 70, h + 180, 90][i % 4];
    c.style.cssText = `left:${Math.random() * 100}%;background:oklch(0.75 0.17 ${hue});animation-delay:${Math.random() * 0.6}s;animation-duration:${1.8 + Math.random() * 1.4}s;border-radius:${i % 3 ? '3px' : '50%'}`;
    box.appendChild(c);
  }
  document.body.appendChild(box);
  setTimeout(() => box.remove(), 4000);
}

export const fmt1 = (x) => (Math.round(x * 100) / 100).toFixed(2);
export const fmtPct = (x) => (Math.round(x * 10) / 10).toFixed(1) + '%';

export function useInterval(fn, ms) {
  const ref = useRef(fn); ref.current = fn;
  useEffect(() => { if (ms == null) return; const id = setInterval(() => ref.current(), ms); return () => clearInterval(id); }, [ms]);
}

export function EmptyState({ icon, title, text, children }) {
  return html`<div class="empty">
    <div style="position:relative;width:120px;height:120px;display:grid;place-items:center">
      <${Shape} name="cookie" style="position:absolute;inset:0;width:100%;height:100%;color:var(--secondary-container)" />
      <${Icon} n=${icon} size=${48} cls="" />
    </div>
    <div class="title-l" style="color:var(--on-surface)">${title}</div>
    ${text && html`<div class="body-m">${text}</div>`}
    ${children}
  </div>`;
}
