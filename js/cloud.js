// Account system on Supabase: auth (email + username + password), password reset,
// avatar upload, match sync and friends. Everything degrades gracefully when not configured/offline.
import { SUPABASE_URL, SUPABASE_ANON_KEY } from './config.js';
import { getState, update } from './store.js';

export const cloudEnabled = () => !!(SUPABASE_URL && SUPABASE_ANON_KEY);
export const isUuid = (s) => typeof s === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s);
export const USERNAME_RE = /^[A-Za-z0-9_.]{3,20}$/;
const SITE = () => location.origin + location.pathname;

let client = null, loading = null;
function loadScript(src) {
  return new Promise((res, rej) => { const s = document.createElement('script'); s.src = src; s.onload = res; s.onerror = rej; document.head.appendChild(s); });
}
export async function sb() {
  if (!cloudEnabled()) throw new Error('not-configured');
  if (client) return client;
  if (!loading) loading = (async () => {
    if (!window.supabase) await loadScript(new URL('../vendor/supabase.js', import.meta.url).href);
    client = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true, flowType: 'implicit', storageKey: 'ninedarter-auth' } });
    return client;
  })();
  return loading;
}

const setCloud = (patch) => update((s) => { s.cloud = { ...s.cloud, ...patch }; });

// ---------- lifecycle ----------
export async function initCloud() {
  if (!cloudEnabled()) return;
  const hadAuthHash = /access_token=|error_description=|type=recovery/.test(location.hash);
  try {
    const c = await sb();
    c.auth.onAuthStateChange((event, session) => {
      if (event === 'PASSWORD_RECOVERY') setCloud({ recovery: true });
      if (event === 'SIGNED_OUT') {
        // Back to a clean guest: no account identity, no saved players on this device
        update((s) => {
          s.account = null; s.friends = []; s.friendReqs = []; s.players = []; s.lastSetup = {};
          s.profile = { localId: 'g' + Math.random().toString(36).slice(2, 12), name: '', photo: null, hue: 285, shape: 'cookie', linked: false };
        });
      }
      if ((event === 'SIGNED_IN' || event === 'INITIAL_SESSION') && session) setTimeout(() => loadAccount(session.user), 0);
    });
    if (hadAuthHash) {
      const err = new URLSearchParams(location.hash.slice(1)).get('error_description');
      if (err) setCloud({ lastError: err });
      setTimeout(() => { history.replaceState(null, '', SITE() + '#/profile'); dispatchEvent(new HashChangeEvent('hashchange')); }, 50);
    }
  } catch (e) { setCloud({ lastError: String(e.message || e) }); }
}

async function loadAccount(user) {
  const c = await sb();
  const { data: prof } = await c.from('profiles').select('*').eq('id', user.id).maybeSingle();
  const acc = { uid: user.id, email: user.email, username: prof?.username || user.user_metadata?.username || 'player', avatar: prof?.avatar_url || null };
  update((s) => {
    s.account = acc;
    // Link the local "me" identity to this account (first time only) and migrate local history.
    const p = s.profile;
    if (!p.linked && p.localId !== acc.uid) {
      const old = p.localId;
      const swap = (pl) => (pl.id === old ? { ...pl, id: acc.uid, name: acc.username, kind: 'me' } : pl);
      s.matches = s.matches.map((m) => (m.players.some((x) => x.id === old) ? { ...m, players: m.players.map(swap), winner: m.winner === old ? acc.uid : m.winner, synced: false } : m));
      if (s.active) s.active = { ...s.active, config: { ...s.active.config, players: s.active.config.players.map(swap) } };
      for (const k of Object.keys(s.lastSetup)) s.lastSetup[k] = { ...s.lastSetup[k], players: (s.lastSetup[k].players || []).map(swap) };
    }
    s.profile = { ...p, localId: acc.uid, linked: true, name: acc.username, photo: acc.avatar || p.photo };
  });
  syncAll().catch(() => {});
}

export async function syncAll() {
  if (!getState().account) return;
  setCloud({ syncing: true });
  try { await Promise.all([syncMatches(), loadFriends()]); setCloud({ syncing: false, lastSync: Date.now(), lastError: null }); }
  catch (e) { setCloud({ syncing: false, lastError: String(e.message || e) }); }
}

// ---------- auth ----------
export async function signUp({ email, username, password }) {
  const c = await sb();
  if (!USERNAME_RE.test(username)) throw new Error('username-format');
  const { data: ok, error: e1 } = await c.rpc('username_available', { u: username });
  if (e1) throw e1;
  if (!ok) throw new Error('username-taken');
  const { data, error } = await c.auth.signUp({ email, password, options: { data: { username }, emailRedirectTo: SITE() } });
  if (error) throw error;
  return { needsConfirm: !data.session };
}
export async function signIn({ email, password }) {
  const c = await sb();
  const { error } = await c.auth.signInWithPassword({ email, password });
  if (error) throw error;
}
export async function signOut() { const c = await sb(); await c.auth.signOut(); }
export async function sendReset(email) {
  const c = await sb();
  const { error } = await c.auth.resetPasswordForEmail(email, { redirectTo: SITE() });
  if (error) throw error;
}
export async function setNewPassword(password) {
  const c = await sb();
  const { error } = await c.auth.updateUser({ password });
  if (error) throw error;
  setCloud({ recovery: false });
}
export async function changeUsername(username) {
  if (!USERNAME_RE.test(username)) throw new Error('username-format');
  const c = await sb();
  const acc = getState().account;
  const { data: ok } = await c.rpc('username_available', { u: username });
  if (!ok && username.toLowerCase() !== acc.username.toLowerCase()) throw new Error('username-taken');
  const { error } = await c.from('profiles').update({ username, updated_at: new Date().toISOString() }).eq('id', acc.uid);
  if (error) throw error;
  update((s) => { s.account = { ...s.account, username }; s.profile = { ...s.profile, name: username }; });
}

// ---------- avatar ----------
/** Center-crop + downscale an image file to a square JPEG blob. */
export async function squareImage(file, size = 256) {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = url; });
    const s = Math.min(img.naturalWidth, img.naturalHeight);
    const cv = document.createElement('canvas'); cv.width = cv.height = size;
    cv.getContext('2d').drawImage(img, (img.naturalWidth - s) / 2, (img.naturalHeight - s) / 2, s, s, 0, 0, size, size);
    const blob = await new Promise((res) => cv.toBlob(res, 'image/jpeg', 0.85));
    return { blob, dataUrl: cv.toDataURL('image/jpeg', 0.8) };
  } finally { URL.revokeObjectURL(url); }
}
export async function uploadAvatar(blob) {
  const c = await sb();
  const uid = getState().account.uid;
  const path = `${uid}/avatar-${Date.now()}.jpg`;
  const { error } = await c.storage.from('avatars').upload(path, blob, { contentType: 'image/jpeg', upsert: false });
  if (error) throw error;
  const { data } = c.storage.from('avatars').getPublicUrl(path);
  const { error: e2 } = await c.from('profiles').update({ avatar_url: data.publicUrl, updated_at: new Date().toISOString() }).eq('id', uid);
  if (e2) throw e2;
  update((s) => { s.account = { ...s.account, avatar: data.publicUrl }; s.profile = { ...s.profile, photo: data.publicUrl }; });
  return data.publicUrl;
}
export async function removeAvatar() {
  const c = await sb();
  const uid = getState().account.uid;
  await c.from('profiles').update({ avatar_url: null }).eq('id', uid);
  update((s) => { s.account = { ...s.account, avatar: null }; });
}

// ---------- matches ----------
const toRow = (m, uid) => ({ id: m.id, owner: uid, participants: [...new Set(m.players.map((p) => p.id).filter(isUuid))], type: m.type, data: { ...m, synced: undefined }, played_at: new Date(m.date).toISOString() });

export async function syncMatches() {
  const c = await sb();
  const uid = getState().account?.uid;
  if (!uid) return;
  // upload: my unsynced matches
  const mine = getState().matches.filter((m) => !m.synced && !m.remote && m.players.some((p) => p.id === uid));
  if (mine.length) {
    const { error } = await c.from('matches').upsert(mine.map((m) => toRow(m, uid)), { onConflict: 'id' });
    if (error) throw error;
    const ids = new Set(mine.map((m) => m.id));
    update((s) => { s.matches = s.matches.map((m) => (ids.has(m.id) ? { ...m, synced: true } : m)); });
  }
  // download: matches I took part in on other devices / recorded by friends
  const { data, error } = await c.from('matches').select('id,owner,data').contains('participants', [uid]).order('played_at', { ascending: false }).limit(1000);
  if (error) throw error;
  const have = new Set(getState().matches.map((m) => m.id));
  const fresh = data.filter((r) => !have.has(r.id)).map((r) => ({ ...r.data, synced: true, remote: r.owner !== uid }));
  if (fresh.length) update((s) => { s.matches = [...s.matches, ...fresh].sort((a, b) => b.date - a.date); });
  await pushStats();
}

/** Publish a small stats summary on my profile so friends can see it. */
async function pushStats() {
  const { aggregateX01 } = await import('./screens/stats.js');
  const st = getState(); const uid = st.account.uid;
  const a = aggregateX01(st.matches, uid);
  const stats = { avg: +a.avg.toFixed(2), f9: +a.f9.toFixed(2), coPct: +a.coPct.toFixed(1), matches: a.n, wins: a.wins, t180: a.t180, hiCo: a.hiCo, best: a.best };
  const c = await sb();
  await c.from('profiles').update({ stats }).eq('id', uid);
}

export async function deleteRemoteMatch(id) {
  if (!getState().account) return;
  const c = await sb();
  await c.from('matches').delete().eq('id', id);
}

// ---------- friends ----------
export async function loadFriends() {
  const c = await sb();
  const uid = getState().account?.uid;
  if (!uid) return;
  const { data: rows, error } = await c.from('friendships').select('*');
  if (error) throw error;
  const otherIds = [...new Set(rows.map((r) => (r.requester === uid ? r.addressee : r.requester)))];
  let profs = [];
  if (otherIds.length) {
    const { data, error: e2 } = await c.from('profiles').select('id,username,avatar_url,stats').in('id', otherIds);
    if (e2) throw e2;
    profs = data;
  }
  const P = Object.fromEntries(profs.map((p) => [p.id, { id: p.id, name: p.username, photo: p.avatar_url, stats: p.stats || {} }]));
  const other = (r) => (r.requester === uid ? r.addressee : r.requester);
  update((s) => {
    s.friends = rows.filter((r) => r.status === 'accepted' && P[other(r)]).map((r) => ({ ...P[other(r)], fid: r.id }));
    s.friendReqs = rows.filter((r) => r.status === 'pending' && P[other(r)]).map((r) => ({ ...P[other(r)], fid: r.id, incoming: r.addressee === uid }));
  });
}
export async function findUser(username) {
  const c = await sb();
  const { data, error } = await c.from('profiles').select('id,username,avatar_url').ilike('username', username.replace(/[%_]/g, (m) => '\\' + m)).limit(1);
  if (error) throw error;
  return data[0] || null;
}
export async function sendFriendRequest(id) {
  const c = await sb();
  const { error } = await c.from('friendships').insert({ requester: getState().account.uid, addressee: id });
  if (error) throw error;
  await loadFriends();
}
export async function acceptFriend(fid) {
  const c = await sb();
  const { error } = await c.from('friendships').update({ status: 'accepted' }).eq('id', fid);
  if (error) throw error;
  await loadFriends();
}
export async function removeFriend(fid) {
  const c = await sb();
  const { error } = await c.from('friendships').delete().eq('id', fid);
  if (error) throw error;
  await loadFriends();
}

/** Map Supabase / internal errors to i18n keys. */
export function errKey(e) {
  const m = String(e?.message || e || '').toLowerCase();
  if (m.includes('username-format')) return 'auth.err.usernameFormat';
  if (m.includes('username-taken')) return 'auth.err.usernameTaken';
  if (m.includes('invalid login')) return 'auth.err.invalidLogin';
  if (m.includes('email not confirmed')) return 'auth.err.notConfirmed';
  if (m.includes('already registered') || m.includes('already been registered')) return 'auth.err.emailTaken';
  if (m.includes('password') && (m.includes('at least') || m.includes('characters') || m.includes('weak'))) return 'auth.err.weakPassword';
  if (m.includes('rate limit') || m.includes('security purposes')) return 'auth.err.rateLimit';
  if (m.includes('valid email') || m.includes('invalid email')) return 'auth.err.email';
  if (m.includes('failed to fetch') || m.includes('network')) return 'auth.err.network';
  if (m.includes('duplicate key') && m.includes('friend')) return 'friends.err.exists';
  return 'auth.err.generic';
}
