import { html, useState, useRef, useEffect } from '../../vendor/preact-htm.js';
import { useStore, update, mePlayer, friendPlayer } from '../store.js';
import { t } from '../i18n.js';
import { Icon, IconBtn, Btn, Seg, Avatar, openDialog, confirmDialog, snack, fmt1, fmtPct } from '../ui.js';
import { go } from '../match.js';
import { TopBar } from './common.js';
import { aggregateX01 } from './stats.js';
import * as cloud from '../cloud.js';

// ---------- small form helpers ----------
function Field({ label, type = 'text', value, onInput, autocomplete, hint, error, onEnter, icon }) {
  const [show, setShow] = useState(false);
  const isPw = type === 'password';
  return html`<label class="field" style="gap:6px">
    <span class="label-l">${label}</span>
    <div class="tf-wrap">
      ${icon && html`<${Icon} n=${icon} cls="tf-icon" />`}
      <input class=${'textfield' + (icon ? ' with-icon' : '') + (error ? ' err' : '')} type=${isPw && !show ? 'password' : isPw ? 'text' : type} value=${value} autocomplete=${autocomplete}
        onInput=${(e) => onInput(e.target.value)} onKeyDown=${(e) => e.key === 'Enter' && onEnter && onEnter()} />
      ${isPw && html`<button type="button" class="btn icon-btn tf-eye" onClick=${() => setShow(!show)} aria-label=${t('auth.showPw')}><${Icon} n=${show ? 'visibility_off' : 'visibility'} /></button>`}
    </div>
    ${(error || hint) && html`<span class=${'body-s ' + (error ? 'err-text' : 'muted')} style="padding-left:4px">${error || hint}</span>`}
  </label>`;
}

const emailOk = (e) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e.trim());

function forgotDialog(initial) {
  return openDialog((close) => {
    const Inner = () => {
      const [email, setEmail] = useState(initial || '');
      const [busy, setBusy] = useState(false);
      const [sent, setSent] = useState(false);
      const [err, setErr] = useState('');
      const send = async () => {
        if (!emailOk(email)) return setErr(t('auth.err.email'));
        setBusy(true); setErr('');
        try { await cloud.sendReset(email.trim()); setSent(true); } catch (e) { setErr(t(cloud.errKey(e))); }
        setBusy(false);
      };
      if (sent) return html`<div class="icon-head"><${Icon} n="mark_email_read" size=${36} /></div>
        <div class="headline-s" style="text-align:center">${t('auth.resetSentTitle')}</div>
        <div class="body-m muted" style="text-align:center">${t('auth.resetSent', { email })}</div>
        <div class="actions"><${Btn} kind="filled" onClick=${() => close()}>${t('common.ok')}<//></div>`;
      return html`<div class="icon-head"><${Icon} n="lock_reset" size=${36} /></div>
        <div class="headline-s" style="text-align:center">${t('auth.forgotTitle')}</div>
        <div class="body-m muted" style="text-align:center">${t('auth.forgotText')}</div>
        <${Field} label=${t('auth.email')} type="email" value=${email} onInput=${setEmail} autocomplete="email" error=${err} onEnter=${send} icon="mail" />
        <div class="actions"><${Btn} kind="text" onClick=${() => close()}>${t('common.cancel')}<//><${Btn} kind="filled" icon="send" disabled=${busy} onClick=${send}>${t('auth.sendLink')}<//></div>`;
    };
    return html`<${Inner} />`;
  });
}

export function newPasswordDialog() {
  return openDialog((close) => {
    const Inner = () => {
      const [pw, setPw] = useState(''); const [pw2, setPw2] = useState('');
      const [err, setErr] = useState(''); const [busy, setBusy] = useState(false);
      const save = async () => {
        if (pw.length < 6) return setErr(t('auth.err.weakPassword'));
        if (pw !== pw2) return setErr(t('auth.err.mismatch'));
        setBusy(true);
        try { await cloud.setNewPassword(pw); snack(t('auth.pwChanged')); close(true); } catch (e) { setErr(t(cloud.errKey(e))); setBusy(false); }
      };
      return html`<div class="icon-head"><${Icon} n="password" size=${36} /></div>
        <div class="headline-s" style="text-align:center">${t('auth.newPwTitle')}</div>
        <${Field} label=${t('auth.newPw')} type="password" value=${pw} onInput=${setPw} autocomplete="new-password" hint=${t('auth.pwHint')} />
        <${Field} label=${t('auth.newPw2')} type="password" value=${pw2} onInput=${setPw2} autocomplete="new-password" error=${err} onEnter=${save} />
        <div class="actions"><${Btn} kind="text" onClick=${() => { cloud.setNewPassword && update((s) => { s.cloud = { ...s.cloud, recovery: false }; }); close(); }}>${t('common.cancel')}<//><${Btn} kind="filled" disabled=${busy} onClick=${save}>${t('common.save')}<//></div>`;
    };
    return html`<${Inner} />`;
  });
}

// ---------- auth card ----------
function AuthCard() {
  const [mode, setMode] = useState('in');
  const [email, setEmail] = useState('');
  const [username, setUsername] = useState('');
  const [pw, setPw] = useState('');
  const [pw2, setPw2] = useState('');
  const [err, setErr] = useState({});
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(null);

  const submit = async () => {
    const e = {};
    if (!emailOk(email)) e.email = t('auth.err.email');
    if (mode === 'up') {
      if (!cloud.USERNAME_RE.test(username)) e.username = t('auth.err.usernameFormat');
      if (pw.length < 6) e.pw = t('auth.err.weakPassword');
      else if (pw !== pw2) e.pw2 = t('auth.err.mismatch');
    } else if (!pw) e.pw = t('auth.err.required');
    setErr(e);
    if (Object.keys(e).length) return;
    setBusy(true);
    try {
      if (mode === 'up') {
        const r = await cloud.signUp({ email: email.trim(), username: username.trim(), password: pw });
        if (r.needsConfirm) setDone(email.trim()); else snack(t('auth.welcome', { name: username }));
      } else { await cloud.signIn({ email: email.trim(), password: pw }); snack(t('auth.signedIn')); }
    } catch (ex) {
      const k = cloud.errKey(ex);
      setErr(k.includes('username') ? { username: t(k) } : k === 'auth.err.email' || k === 'auth.err.emailTaken' ? { email: t(k) } : { form: t(k) });
    }
    setBusy(false);
  };

  if (done) return html`<div class="card stack" style="align-items:center;text-align:center">
    <${Icon} n="mark_email_unread" size=${40} />
    <div class="title-l">${t('auth.confirmTitle')}</div>
    <div class="body-m muted">${t('auth.confirmText', { email: done })}</div>
    <${Btn} kind="tonal" onClick=${() => { setDone(null); setMode('in'); }}>${t('auth.toSignIn')}<//>
  </div>`;

  return html`<div class="card stack">
    <div class="row"><${Icon} n="cloud_sync" /><div class="grow"><div class="title-m">${t('auth.cardTitle')}</div><div class="body-s muted">${t('auth.cardText')}</div></div></div>
    <${Seg} value=${mode} onChange=${(m) => { setMode(m); setErr({}); }} options=${[{ value: 'in', label: t('auth.signIn') }, { value: 'up', label: t('auth.signUp') }]} />
    <${Field} label=${t('auth.email')} type="email" value=${email} onInput=${setEmail} autocomplete="email" error=${err.email} icon="mail" />
    ${mode === 'up' && html`<${Field} label=${t('auth.username')} value=${username} onInput=${(v) => setUsername(v.replace(/\s/g, ''))} autocomplete="username" error=${err.username} hint=${t('auth.usernameHint')} icon="alternate_email" />`}
    <${Field} label=${t('auth.password')} type="password" value=${pw} onInput=${setPw} autocomplete=${mode === 'up' ? 'new-password' : 'current-password'} error=${err.pw} hint=${mode === 'up' ? t('auth.pwHint') : ''} onEnter=${mode === 'in' ? submit : null} icon="lock" />
    ${mode === 'up' && html`<${Field} label=${t('auth.password2')} type="password" value=${pw2} onInput=${setPw2} autocomplete="new-password" error=${err.pw2} onEnter=${submit} icon="lock" />`}
    ${err.form && html`<div class="err-box"><${Icon} n="error" />${err.form}</div>`}
    <${Btn} kind="filled" size="m" cls="block" icon=${mode === 'up' ? 'person_add' : 'login'} disabled=${busy} onClick=${submit}>${busy ? t('auth.wait') : mode === 'up' ? t('auth.createAccount') : t('auth.signIn')}<//>
    ${mode === 'in' && html`<${Btn} kind="text" cls="block" onClick=${() => forgotDialog(email)}>${t('auth.forgot')}<//>`}
  </div>`;
}

// ---------- friends ----------
function Friends() {
  const st = useStore();
  const [q, setQ] = useState('');
  const [busy, setBusy] = useState(false);
  const add = async () => {
    const name = q.trim();
    if (!name) return;
    if (name.toLowerCase() === st.account.username.toLowerCase()) return snack(t('friends.self'));
    setBusy(true);
    try {
      const u = await cloud.findUser(name);
      if (!u) snack(t('friends.notFound', { name }));
      else if (st.friends.some((f) => f.id === u.id) || st.friendReqs.some((f) => f.id === u.id)) snack(t('friends.err.exists'));
      else { await cloud.sendFriendRequest(u.id); snack(t('friends.sent', { name: u.username })); setQ(''); }
    } catch (e) { snack(t(cloud.errKey(e))); }
    setBusy(false);
  };
  const incoming = st.friendReqs.filter((r) => r.incoming);
  const outgoing = st.friendReqs.filter((r) => !r.incoming);
  return html`<div class="card stack">
    <div class="row between"><div class="title-m">${t('friends.title')} <span class="muted body-m">${st.friends.length}</span></div>
      <${IconBtn} icon="refresh" title=${t('profile.sync')} onClick=${() => cloud.loadFriends().catch(() => {})} /></div>
    <div class="row" style="gap:8px">
      <div class="tf-wrap grow"><${Icon} n="person_search" cls="tf-icon" /><input class="textfield with-icon" placeholder=${t('friends.searchPh')} value=${q} onInput=${(e) => setQ(e.target.value.replace(/\s/g, ''))} onKeyDown=${(e) => e.key === 'Enter' && add()} /></div>
      <${Btn} kind="filled" icon="person_add" disabled=${busy || !q.trim()} onClick=${add}>${t('common.add')}<//>
    </div>
    ${incoming.length > 0 && html`<div class="label-l muted">${t('friends.incoming')}</div>
      <div class="list">${incoming.map((f) => html`<div class="list-item" style="cursor:default">
        <${Avatar} p=${friendPlayer(f)} /><div class="grow title-s">${f.name}</div>
        <${Btn} kind="filled" size="s" onClick=${() => cloud.acceptFriend(f.fid).then(() => snack(t('friends.accepted', { name: f.name }))).catch((e) => snack(t(cloud.errKey(e))))}>${t('friends.accept')}<//>
        <${IconBtn} icon="close" title=${t('friends.decline')} onClick=${() => cloud.removeFriend(f.fid).catch(() => {})} />
      </div>`)}</div>`}
    ${st.friends.length ? html`<div class="list">${st.friends.map((f) => html`<div class="list-item" style="cursor:default">
        <${Avatar} p=${friendPlayer(f)} size="l" />
        <div class="grow"><div class="title-m">${f.name}</div>
          <div class="meta">${f.stats?.matches ? `⌀ ${fmt1(f.stats.avg || 0)} · ${f.stats.matches} ${t('stats.matchesShort')}${f.stats.t180 ? ' · 180×' + f.stats.t180 : ''}` : t('players.noGames')}</div></div>
        <${IconBtn} icon="person_remove" title=${t('friends.remove')} onClick=${async () => { if (await confirmDialog({ title: t('friends.removeQ', { name: f.name }), ok: t('friends.remove'), cancel: t('common.cancel'), danger: true })) cloud.removeFriend(f.fid).catch(() => {}); }} />
      </div>`)}</div>` : html`<div class="body-m muted" style="text-align:center;padding:8px">${t('friends.empty')}</div>`}
    ${outgoing.length > 0 && html`<div class="body-s muted">${t('friends.pending')}: ${outgoing.map((f) => f.name).join(', ')}</div>`}
  </div>`;
}

// ---------- profile screen ----------
export function Profile() {
  const st = useStore();
  const me = mePlayer(st);
  const acc = st.account;
  const fileRef = useRef();
  const [nameEdit, setNameEdit] = useState(null);

  useEffect(() => { if (acc) cloud.loadFriends().catch(() => {}); }, [acc?.uid]);

  const pickPhoto = async (e) => {
    const f = e.target.files[0]; e.target.value = '';
    if (!f) return;
    try {
      const { blob, dataUrl } = await cloud.squareImage(f);
      update((s) => { s.profile = { ...s.profile, photo: dataUrl }; });
      if (acc) { await cloud.uploadAvatar(blob); }
      snack(t('profile.photoSaved'));
    } catch (ex) { snack(t(cloud.errKey(ex))); }
  };
  const removePhoto = async () => {
    update((s) => { s.profile = { ...s.profile, photo: null }; });
    if (acc) await cloud.removeAvatar().catch(() => {});
  };
  const saveName = async () => {
    const v = (nameEdit || '').trim();
    if (!v) return setNameEdit(null);
    try {
      if (acc) await cloud.changeUsername(v);
      else update((s) => { s.profile = { ...s.profile, name: v }; });
      setNameEdit(null);
    } catch (e) { snack(t(cloud.errKey(e))); }
  };

  const a = aggregateX01(st.matches, me.id);
  const c = st.cloud || {};

  return html`<div class="screen-enter stack">
    <${TopBar} title=${t('nav.profile')} back=${false}>
      ${acc && html`<${IconBtn} icon=${c.syncing ? 'sync' : 'cloud_done'} title=${t('profile.sync')} onClick=${() => cloud.syncAll().then(() => snack(t('profile.synced')))} />`}
    <//>

    <section class="profile-hero">
      <div class="avatar-edit">
        <${Avatar} p=${me} size="xxl" />
        <button class="btn icon-btn filled m cam" title=${t('profile.changePhoto')} onClick=${() => fileRef.current.click()}><${Icon} n="photo_camera" /></button>
        <input type="file" accept="image/*" ref=${fileRef} hidden onChange=${pickPhoto} />
      </div>
      ${nameEdit != null ? html`<div class="row" style="gap:8px;width:min(320px,100%)">
          <input class="textfield" value=${nameEdit} maxlength="20" onInput=${(e) => setNameEdit(e.target.value)} onKeyDown=${(e) => e.key === 'Enter' && saveName()} />
          <${IconBtn} icon="check" kind="filled" title=${t('common.save')} onClick=${saveName} /></div>`
        : html`<button class="name-btn" onClick=${() => setNameEdit(acc ? acc.username : st.profile.name || '')}><span class="display-s">${me.name}</span><${Icon} n="edit" size=${20} /></button>`}
      <div class="row wrap" style="justify-content:center;gap:8px">
        ${acc ? html`<span class="badge win"><${Icon} n="verified" size=${14} /> ${t('profile.online')}</span><span class="body-m">${acc.email}</span>`
          : html`<span class="badge"><${Icon} n="cloud_off" size=${14} /> ${t('profile.offline')}</span>`}
      </div>
      ${me.photo && html`<${Btn} kind="text" size="s" icon="hide_image" onClick=${removePhoto}>${t('profile.removePhoto')}<//>`}
    </section>

    <div class="stat-tiles">
      <div class="tile hero-tile"><span class="k">${t('stats.avg3')}</span><span class="v">${fmt1(a.avg)}</span></div>
      <div class="tile"><span class="k">${t('stats.first9')}</span><span class="v">${fmt1(a.f9)}</span></div>
      <div class="tile"><span class="k">${t('stats.coPct')}</span><span class="v">${a.dbl ? fmtPct(a.coPct) : '–'}</span></div>
      <div class="tile"><span class="k">${t('stats.matches')}</span><span class="v">${a.n}</span></div>
      <div class="tile"><span class="k">180</span><span class="v">${a.t180}</span></div>
      <div class="tile"><span class="k">${t('stats.hiCo')}</span><span class="v">${a.hiCo || '–'}</span></div>
    </div>
    <${Btn} kind="tonal" icon="monitoring" onClick=${() => go('#/stats/' + me.id)}>${t('profile.allStats')}<//>

    ${!cloud.cloudEnabled() ? html`<div class="card row"><${Icon} n="cloud_off" /><div class="grow body-m">${t('profile.noCloud')}</div></div>`
      : acc ? html`
        <${Friends} />
        <div class="list">
          <div class="setting"><${Icon} n="sync" /><div class="grow"><div class="title-s">${t('profile.sync')}</div><div class="body-s muted">${c.lastSync ? t('profile.lastSync', { t: new Date(c.lastSync).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) }) : '–'}${c.lastError ? ' · ' + t('auth.err.network') : ''}</div></div>
            <${Btn} kind="tonal" size="s" disabled=${c.syncing} onClick=${() => cloud.syncAll().then(() => snack(t('profile.synced')))}>${t('profile.syncNow')}<//></div>
          <div class="setting"><${Icon} n="password" /><div class="grow title-s">${t('profile.changePw')}</div><${Btn} kind="tonal" size="s" onClick=${() => newPasswordDialog()}>${t('common.edit')}<//></div>
          <div class="setting"><${Icon} n="logout" /><div class="grow title-s">${t('profile.signOut')}</div><${Btn} kind="danger" size="s" onClick=${async () => { if (await confirmDialog({ title: t('profile.signOutQ'), text: t('profile.signOutText'), ok: t('profile.signOut'), cancel: t('common.cancel') })) { await cloud.signOut(); snack(t('profile.signedOut')); } }}>${t('profile.signOut')}<//></div>
        </div>` : html`<${AuthCard} />`}
  </div>`;
}
