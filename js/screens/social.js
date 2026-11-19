// Social screens: friend detail, messages (inbox + chat) and notifications.
import { html, useState, useEffect, useRef } from '../../vendor/preact-htm.js';
import { useStore, mePlayer, friendPlayer } from '../store.js';
import { t } from '../i18n.js';
import { Icon, IconBtn, Btn, Avatar, confirmDialog, snack, EmptyState, fmt1, fmtPct } from '../ui.js';
import { go } from '../match.js';
import { TopBar } from './common.js';
import { isWinner } from '../teams.js';
import * as cloud from '../cloud.js';
import { Flag, countryName } from '../flags.js';

const lang = () => (useStore().settings.lang === 'tr' ? 'tr-TR' : 'en-GB');
function ago(iso, locale) {
  const d = new Date(iso), now = new Date();
  const sameDay = d.toDateString() === now.toDateString();
  return sameDay ? d.toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' }) : d.toLocaleDateString(locale, { day: 'numeric', month: 'short' });
}

function NeedAccount() {
  return html`<${EmptyState} icon="cloud_off" title=${t('social.needAccount')} text=${t('social.needAccountText')}>
    ${cloud.cloudEnabled() && html`<${Btn} kind="filled" icon="login" onClick=${() => go('#/profile')}>${t('auth.signIn')}<//>`}
  <//>`;
}

// ---------- Friend detail ----------
export function FriendPage({ id }) {
  const st = useStore();
  const loc = lang();
  if (!st.account) return html`<${TopBar} title=${t('friends.title')} back="#/profile" /><${NeedAccount} />`;
  const f = st.friends.find((x) => x.id === id);
  if (!f) return html`<${TopBar} title=${t('friends.title')} back="#/profile" /><${EmptyState} icon="person_off" title=${t('friend.notFound')} />`;
  const s = f.stats || {};
  const me = mePlayer(st);
  // head-to-head from matches we both played
  const shared = st.matches.filter((m) => m.players.some((p) => p.id === me.id) && m.players.some((p) => p.id === id));
  const myWins = shared.filter((m) => isWinner(m, me.id) && !isWinner(m, id)).length;
  const hisWins = shared.filter((m) => isWinner(m, id) && !isWinner(m, me.id)).length;
  const conv = st.inbox?.convs?.find((c) => c.id === id);
  const days = f.since ? Math.max(0, Math.floor((Date.now() - new Date(f.since)) / 86400000)) : null;
  const remove = async () => {
    if (await confirmDialog({ title: t('friends.removeQ', { name: f.name }), ok: t('friends.remove'), cancel: t('common.cancel'), danger: true, icon: 'person_remove' })) {
      await cloud.removeFriend(f.fid).catch(() => {});
      go('#/profile');
    }
  };
  const Tile = ({ k, v, hero }) => html`<div class=${'tile' + (hero ? ' hero-tile' : '')}><span class="k">${k}</span><span class="v">${v}</span></div>`;
  return html`<div class="screen-enter stack">
    <${TopBar} title=${f.name} back="#/profile" />
    <section class="profile-hero">
      <${Avatar} p=${friendPlayer(f)} size="xxl" />
      <div class="display-s">${f.name}</div>
      ${f.country && html`<div class="country-line"><${Flag} code=${f.country} /><span>${countryName(f.country, document.documentElement.lang || 'tr')}</span></div>`}
      ${f.username && f.username !== f.name && html`<div class="body-m">@${f.username}</div>`}
      <div class="row wrap" style="justify-content:center;gap:8px">
        <span class="badge win"><${Icon} n="handshake" size=${14} /> ${f.since ? t('friend.since', { date: new Date(f.since).toLocaleDateString(loc, { day: 'numeric', month: 'long', year: 'numeric' }) }) : t('kind.friend')}</span>
        ${days != null && html`<span class="badge">${t('friend.days', { n: days })}</span>`}
      </div>
      <div class="row wrap" style="justify-content:center">
        <${Btn} kind="filled" size="m" icon="chat" onClick=${() => go('#/messages/' + id)}>${t('friend.message')}${conv?.unread ? html` <span class="count">${conv.unread}</span>` : ''}<//>
        <${Btn} kind="tonal" size="m" icon="sports_score" onClick=${() => go('#/play/x01')}>${t('friend.play')}<//>
      </div>
    </section>

    <h2 class="title-m section-title" style="margin:8px 4px 0">${t('friend.stats')}</h2>
    ${s.matches || s.total ? html`<div class="stat-tiles">
        <${Tile} hero k=${t('stats.avg3')} v=${fmt1(s.avg || 0)} />
        <${Tile} k=${t('stats.first9')} v=${fmt1(s.f9 || 0)} />
        <${Tile} k=${t('stats.coPct')} v=${s.coPct ? fmtPct(s.coPct) : '–'} />
        <${Tile} k=${t('stats.matches')} v=${s.total ?? s.matches ?? 0} />
        <${Tile} k=${t('stats.winPct')} v=${s.multi ? fmtPct((s.wins / s.multi) * 100) : '–'} />
        <${Tile} k="180" v=${s.t180 || 0} />
        <${Tile} k=${t('stats.hiCo')} v=${s.hiCo || '–'} />
        <${Tile} k=${t('stats.bestLeg')} v=${s.best ?? '–'} />
        <${Tile} k="MPR" v=${s.mpr ? fmt1(s.mpr) : '–'} />
      </div>` : html`<div class="card body-m muted" style="text-align:center">${t('friend.noStats')}</div>`}

    <h2 class="title-m section-title" style="margin:8px 4px 0">${t('friend.h2h')}</h2>
    <div class="card h2h">
      <div class="side"><${Avatar} p=${me} size="l" /><span class="ellipsis">${me.name}</span></div>
      <div class="score num">${myWins}<span class="muted"> – </span>${hisWins}</div>
      <div class="side"><${Avatar} p=${friendPlayer(f)} size="l" /><span class="ellipsis">${f.name}</span></div>
    </div>
    <div class="body-s muted" style="text-align:center;margin-top:-8px">${t('friend.sharedN', { n: shared.length })}</div>

    <div><${Btn} kind="text" icon="person_remove" onClick=${remove}>${t('friends.remove')}<//></div>
  </div>`;
}

// ---------- Messages: inbox ----------
export function Messages() {
  const st = useStore();
  const loc = lang();
  useEffect(() => { if (st.account) cloud.loadInbox().catch(() => {}); }, [st.account?.uid]);
  if (!st.account) return html`<${TopBar} title=${t('nav.messages')} back="#/" /><${NeedAccount} />`;
  const convs = (st.inbox?.convs || []).map((c) => ({ ...c, f: st.friends.find((x) => x.id === c.id) })).filter((c) => c.f);
  const others = st.friends.filter((f) => !convs.some((c) => c.id === f.id));
  return html`<div class="screen-enter stack">
    <${TopBar} title=${t('nav.messages')} back="#/" />
    ${convs.length ? html`<div class="list">${convs.map((c) => html`<button class="list-item conv" key=${c.id} onClick=${() => go('#/messages/' + c.id)}>
        <${Avatar} p=${friendPlayer(c.f)} size="l" />
        <div class="grow" style="min-width:0">
          <div class="row between"><span class=${'title-m ellipsis' + (c.unread ? ' strong' : '')}>${c.f.name}</span><span class="meta">${ago(c.last.created_at, loc)}</span></div>
          <div class="row between"><span class=${'meta ellipsis' + (c.unread ? ' strong' : '')}>${c.last.sender === st.account.uid ? t('msg.you') + ': ' : ''}${c.last.body}</span>${c.unread ? html`<span class="count">${c.unread}</span>` : ''}</div>
        </div>
      </button>`)}</div>`
      : html`<${EmptyState} icon="forum" title=${t('msg.empty')} text=${st.friends.length ? t('msg.emptyText') : t('msg.noFriends')} />`}
    ${others.length > 0 && html`<h2 class="title-m section-title" style="margin:8px 4px 0">${t('msg.newChat')}</h2>
      <div class="chips">${others.map((f) => html`<button class="chip" onClick=${() => go('#/messages/' + f.id)}><${Avatar} p=${friendPlayer(f)} />${f.name}</button>`)}</div>`}
  </div>`;
}

// ---------- Messages: chat ----------
export function Chat({ id }) {
  const st = useStore();
  const loc = lang();
  const [msgs, setMsgs] = useState(null);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const endRef = useRef();
  const f = st.friends.find((x) => x.id === id);
  const uid = st.account?.uid;

  const refresh = async () => {
    try {
      const list = await cloud.loadThread(id);
      setMsgs(list);
      if (list.some((m) => m.recipient === uid && !m.read_at)) cloud.markRead(id).catch(() => {});
    } catch { setMsgs((m) => m || []); }
  };
  useEffect(() => {
    if (!uid || !f) return;
    refresh();
    const iv = setInterval(() => document.visibilityState === 'visible' && refresh(), 5000);
    return () => clearInterval(iv);
  }, [uid, id, !!f]);
  useEffect(() => { endRef.current?.scrollIntoView({ block: 'end' }); }, [msgs?.length]);

  if (!st.account) return html`<${TopBar} title=${t('nav.messages')} back="#/messages" /><${NeedAccount} />`;
  if (!f) return html`<${TopBar} title=${t('nav.messages')} back="#/messages" /><${EmptyState} icon="person_off" title=${t('friend.notFound')} />`;

  const send = async () => {
    const body = text.trim();
    if (!body || busy) return;
    setBusy(true);
    try {
      const m = await cloud.sendMessage(id, body);
      if (m) setMsgs((list) => [...(list || []), m]);
      setText('');
    } catch (e) { snack(t(cloud.errKey(e))); }
    setBusy(false);
  };

  let lastDay = '';
  return html`<div class="chat">
    <header class="topbar chat-top">
      <a class="btn icon-btn" href="#/messages" title=${t('common.back')}><${Icon} n="arrow_back" /></a>
      <button class="chat-peer" onClick=${() => go('#/friend/' + id)}><${Avatar} p=${friendPlayer(f)} /><span class="title-m ellipsis">${f.name}</span></button>
    </header>
    <div class="chat-body">
      ${msgs == null ? html`<div class="body-m muted" style="text-align:center;padding:24px">${t('auth.wait')}</div>`
        : !msgs.length ? html`<div class="chat-empty"><${Avatar} p=${friendPlayer(f)} size="xl" /><div class="body-m muted">${t('msg.start', { name: f.name })}</div></div>`
        : msgs.map((m) => {
          const day = new Date(m.created_at).toLocaleDateString(loc, { day: 'numeric', month: 'long' });
          const sep = day !== lastDay ? ((lastDay = day), html`<div class="day-sep">${day}</div>`) : null;
          const mine = m.sender === uid;
          return html`${sep}<div class=${'bubble' + (mine ? ' mine' : '')} key=${m.id}>
            <span>${m.body}</span><span class="time">${new Date(m.created_at).toLocaleTimeString(loc, { hour: '2-digit', minute: '2-digit' })}${mine && m.read_at ? html` <${Icon} n="done_all" size=${14} />` : ''}</span>
          </div>`;
        })}
      <div ref=${endRef}></div>
    </div>
    <div class="chat-input">
      <textarea class="textfield" rows="1" maxlength="1000" placeholder=${t('msg.placeholder')} value=${text}
        onInput=${(e) => setText(e.target.value)} onKeyDown=${(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } }}></textarea>
      <${IconBtn} icon="send" kind="filled" size="m" title=${t('msg.send')} disabled=${!text.trim() || busy} onClick=${send} />
    </div>
  </div>`;
}

// ---------- Notifications ----------
export function Notifications() {
  const st = useStore();
  const loc = lang();
  useEffect(() => { if (st.account) { cloud.loadFriends().catch(() => {}); cloud.loadInbox().catch(() => {}); } }, [st.account?.uid]);
  if (!st.account) return html`<${TopBar} title=${t('nav.notifications')} back="#/" /><${NeedAccount} />`;
  const reqs = st.friendReqs.filter((r) => r.incoming);
  const unread = (st.inbox?.convs || []).filter((c) => c.unread).map((c) => ({ ...c, f: st.friends.find((x) => x.id === c.id) })).filter((c) => c.f);
  return html`<div class="screen-enter stack">
    <${TopBar} title=${t('nav.notifications')} back="#/" />
    ${!reqs.length && !unread.length && html`<${EmptyState} icon="notifications_off" title=${t('notif.empty')} text=${t('notif.emptyText')} />`}
    ${reqs.length > 0 && html`<h2 class="title-m section-title" style="margin:8px 4px 0">${t('friends.incoming')}</h2>
      <div class="list">${reqs.map((r) => html`<div class="list-item" style="cursor:default" key=${r.fid}>
        <${Avatar} p=${friendPlayer(r)} size="l" />
        <div class="grow"><div class="title-s">${r.name}</div><div class="meta">${t('notif.wantsFriend')}${r.at ? ' · ' + ago(r.at, loc) : ''}</div></div>
        <${Btn} kind="filled" size="s" onClick=${() => cloud.acceptFriend(r.fid).then(() => snack(t('friends.accepted', { name: r.name }))).catch((e) => snack(t(cloud.errKey(e))))}>${t('friends.accept')}<//>
        <${IconBtn} icon="close" title=${t('friends.decline')} onClick=${() => cloud.removeFriend(r.fid).catch(() => {})} />
      </div>`)}</div>`}
    ${unread.length > 0 && html`<h2 class="title-m section-title" style="margin:8px 4px 0">${t('notif.messages')}</h2>
      <div class="list">${unread.map((c) => html`<button class="list-item" key=${c.id} onClick=${() => go('#/messages/' + c.id)}>
        <${Avatar} p=${friendPlayer(c.f)} size="l" />
        <div class="grow" style="min-width:0"><div class="title-s">${t('notif.newMessages', { name: c.f.name, n: c.unread })}</div><div class="meta ellipsis">${c.last.body}</div></div>
        <span class="meta">${ago(c.last.created_at, loc)}</span>
      </button>`)}</div>`}
  </div>`;
}

/** Badge counts for the top bar. */
export function useSocialCounts() {
  const st = useStore();
  const reqs = st.account ? st.friendReqs.filter((r) => r.incoming).length : 0;
  const unread = st.account ? st.inbox?.unread || 0 : 0;
  return { reqs, unread, total: reqs + unread };
}
