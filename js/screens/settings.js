import { html, useState, useEffect } from '../../vendor/preact-htm.js';
import { useStore, update, exportData, importData, resetAll } from '../store.js';
import { t } from '../i18n.js';
import { Icon, Btn, Seg, Switch, Slider, confirmDialog, snack, openDialog } from '../ui.js';
import { availableVoices, speak } from '../voice.js';
import { TopBar } from './common.js';
import { OfflinePlayers } from './players.js';

const HUES = [285, 320, 350, 25, 60, 110, 150, 180, 220, 250];

const Row = ({ icon, title, sub, children }) => html`<div class="setting">
  <${Icon} n=${icon} /><div class="grow"><div class="title-s">${title}</div>${sub && html`<div class="body-s muted">${sub}</div>`}</div>${children}
</div>`;

export function Settings() {
  const st = useStore();
  const s = st.settings;
  const set = (k, v) => update((x) => { x.settings[k] = v; });
  const [voices, setVoices] = useState(availableVoices(s.lang));
  const [canInstall, setCanInstall] = useState(!!window.__installPrompt);
  useEffect(() => { const on = () => setCanInstall(!!window.__installPrompt); addEventListener('nd-installable', on); return () => removeEventListener('nd-installable', on); }, []);
  const standalone = matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
  const install = async () => {
    const p = window.__installPrompt;
    if (p) { p.prompt(); const r = await p.userChoice.catch(() => null); if (r?.outcome === 'accepted') snack(t('install.done')); window.__installPrompt = null; setCanInstall(false); return; }
    const ios = /iphone|ipad|ipod/i.test(navigator.userAgent);
    openDialog((close) => html`<div class="icon-head"><${Icon} n="install_mobile" size=${36} /></div>
      <div class="headline-s" style="text-align:center">${t('install.title')}</div>
      <div class="body-m">${t(ios ? 'install.ios' : 'install.other')}</div>
      <div class="actions"><${Btn} kind="filled" onClick=${() => close()}>${t('common.ok')}<//></div>`);
  };
  useEffect(() => { const id = setTimeout(() => setVoices(availableVoices(s.lang)), 400); return () => clearTimeout(id); }, [s.lang]);

  const doExport = () => {
    const blob = new Blob([exportData()], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `ninedarter-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  };
  const doImport = () => {
    const inp = document.createElement('input');
    inp.type = 'file'; inp.accept = 'application/json,.json';
    inp.onchange = async () => {
      try { importData(await inp.files[0].text()); snack(t('settings.imported')); } catch { snack(t('settings.importFail')); }
    };
    inp.click();
  };
  const doReset = async () => {
    if (await confirmDialog({ title: t('settings.resetQ'), text: t('settings.resetText'), ok: t('settings.reset'), cancel: t('common.cancel'), danger: true, icon: 'warning' })) { resetAll(); snack(t('settings.resetDone')); }
  };

  return html`<div class="screen-enter stack">
    <${TopBar} title=${t('nav.settings')} back=${false} />

    <div class="card primary row install-card">
      <${Icon} n=${standalone ? 'check_circle' : 'install_mobile'} size=${32} />
      <div class="grow"><div class="title-m">${t(standalone ? 'install.installed' : 'install.title')}</div><div class="body-s">${t(standalone ? 'install.installedSub' : 'install.sub')}</div></div>
      ${!standalone && html`<${Btn} kind="filled" icon="download" onClick=${install}>${t('install.btn')}<//>`}
    </div>

    <div class="card stack">
      <div class="title-m">${t('settings.appearance')}</div>
      <${Seg} value=${s.theme} onChange=${(v) => set('theme', v)} options=${[{ value: 'system', label: t('settings.system'), icon: 'brightness_auto' }, { value: 'light', label: t('settings.light'), icon: 'light_mode' }, { value: 'dark', label: t('settings.dark'), icon: 'dark_mode' }]} />
      <div class="field"><span class="label-l">${t('settings.color')}</span>
        <div class="swatches">${HUES.map((h) => html`<button class=${'swatch' + (h === s.hue ? ' on' : '')} style=${`--sh:${h}`} onClick=${() => set('hue', h)} aria-label=${'hue ' + h}>${h === s.hue && html`<${Icon} n="check" />`}</button>`)}</div>
        <${Slider} min=${0} max=${359} value=${s.hue} label=${t('settings.color')} onInput=${(v) => set('hue', v)} />
      </div>
      <div class="field"><span class="label-l">${t('settings.uiScale')}</span><span class="body-s muted">${t('settings.uiScaleSub')}</span>
        <${Seg} value=${s.uiScale || 'medium'} onChange=${(v) => set('uiScale', v)} options=${['small', 'medium', 'large'].map((v) => ({ value: v, label: t('settings.scale.' + v), icon: v === 'small' ? 'text_decrease' : v === 'large' ? 'text_increase' : 'format_size' }))} /></div>
      <div class="field"><span class="label-l">${t('settings.language')}</span>
        <${Seg} value=${s.lang} onChange=${(v) => set('lang', v)} options=${[{ value: 'tr', label: 'Türkçe' }, { value: 'en', label: 'English' }]} /></div>
    </div>

    <div class="title-m section-title" style="margin:8px 4px 0">${t('settings.game')}</div>
    <div class="list">
      <${Row} icon="record_voice_over" title=${t('settings.caller')} sub=${t('settings.callerSub')}><${Switch} checked=${s.caller} onChange=${(v) => { set('caller', v); if (v) setTimeout(() => speak(s.lang === 'tr' ? 'Yüz seksen!' : 'One hundred and eighty!'), 50); }} label=${t('settings.caller')} /><//>
      ${s.caller && voices.length > 1 && html`<div class="setting"><${Icon} n="graphic_eq" /><select class="textfield grow" style="height:44px" value=${s.callerVoice} onChange=${(e) => set('callerVoice', e.target.value)}>
        <option value="">${t('settings.defaultVoice')}</option>${voices.map((v) => html`<option value=${v.name}>${v.name}</option>`)}</select></div>`}
      <${Row} icon="vibration" title=${t('settings.vibrate')}><${Switch} checked=${s.vibrate} onChange=${(v) => set('vibrate', v)} label=${t('settings.vibrate')} /><//>
      <${Row} icon="lightbulb" title=${t('settings.hints')} sub=${t('settings.hintsSub')}><${Switch} checked=${s.hints} onChange=${(v) => set('hints', v)} label=${t('settings.hints')} /><//>
      <${Row} icon="ads_click" title=${t('settings.askDoubles')} sub=${t('settings.askDoublesSub')}><${Switch} checked=${s.askDoubles} onChange=${(v) => set('askDoubles', v)} label=${t('settings.askDoubles')} /><//>
      <div class="setting" style="flex-wrap:wrap"><${Icon} n="dialpad" /><div class="grow title-s">${t('settings.input')}</div>
        <${Seg} size="s" value=${s.inputMode} onChange=${(v) => set('inputMode', v)} options=${[{ value: 'keypad', label: t('settings.keypad') }, { value: 'darts', label: t('settings.perDart') }]} /></div>
      <div class="setting" style="flex-wrap:wrap"><${Icon} n="speed" /><div class="grow title-s">${t('settings.botSpeed')}</div>
        <${Seg} size="s" value=${s.botSpeed} onChange=${(v) => set('botSpeed', v)} options=${[{ value: 1600, label: t('settings.slow') }, { value: 900, label: t('settings.normal') }, { value: 300, label: t('settings.fast') }]} /></div>
    </div>

    <div class="title-m section-title" style="margin:8px 4px 0">${t('settings.offlinePlayers')}</div>
    <div class="body-s muted" style="margin:-4px 4px 0">${t('settings.offlinePlayersSub')}</div>
    <${OfflinePlayers} />

    <div class="title-m section-title" style="margin:8px 4px 0">${t('settings.data')}</div>
    <div class="list">
      <${Row} icon="download" title=${t('settings.export')} sub=${t('settings.exportSub')}><${Btn} kind="tonal" size="s" onClick=${doExport}>${t('settings.exportBtn')}<//><//>
      <${Row} icon="upload" title=${t('settings.import')}><${Btn} kind="tonal" size="s" onClick=${doImport}>${t('settings.importBtn')}<//><//>
      <${Row} icon="delete_forever" title=${t('settings.reset')} sub=${t('settings.resetSub')}><${Btn} kind="danger" size="s" onClick=${doReset}>${t('settings.reset')}<//><//>
    </div>

    <div class="card stack s" style="align-items:center;text-align:center;margin-top:8px">
      <span class="brand-word">nine<b>darter</b></span>
      <span class="body-m muted">v1.0.8b · ${t('settings.about')}</span>
      <a class="btn text s" href="https://github.com/tunagirit/ninedarter" id="gh-link" target="_blank" rel="noopener"><${Icon} n="code" />GitHub</a>
    </div>
  </div>`;
}
