// Score caller using the Web Speech API.
import { getState } from './store.js';

const EN_NUM = (n) => {
  if (n === 180) return 'One hundred and eighty!';
  return String(n);
};

let voicesCache = [];
function voices() {
  if (!('speechSynthesis' in window)) return [];
  if (!voicesCache.length) voicesCache = speechSynthesis.getVoices();
  return voicesCache;
}
if ('speechSynthesis' in window) speechSynthesis.onvoiceschanged = () => { voicesCache = speechSynthesis.getVoices(); };

// v1.1.1: let the calls mix with music the player has running in the background.
// iOS 16.4+ (Audio Session API): "ambient" = mix with other audio instead of taking the audio session.
try { if (navigator.audioSession) navigator.audioSession.type = 'ambient'; } catch {}

/** settings.callerLevel: 'all' | 'big' (only 100+, checkouts, bust, game shot) | 'off'. Old setting `caller: false` = off. */
const level = (st) => (st.caller === false ? 'off' : st.callerLevel || 'all');

export function availableVoices(lang) {
  return voices().filter((v) => v.lang.toLowerCase().startsWith(lang));
}

export function speak(text) {
  const st = getState().settings;
  if (level(st) === 'off' || !('speechSynthesis' in window)) return;
  try {
    if (speechSynthesis.speaking || speechSynthesis.pending) speechSynthesis.cancel(); // only stop our own previous call
    const u = new SpeechSynthesisUtterance(text);
    const lang = st.lang === 'tr' ? 'tr-TR' : 'en-GB';
    u.lang = lang;
    const v = voices().find((x) => x.name === st.callerVoice) || availableVoices(st.lang)[0];
    if (v) u.voice = v;
    u.rate = 1.02; u.pitch = 1;
    speechSynthesis.speak(u);
  } catch {}
}

export function callScore(score, { bust, checkout, remaining } = {}) {
  const tr = getState().settings.lang === 'tr';
  if (checkout) return speak(tr ? 'Oyun bitti!' : 'Game shot!');
  if (level(getState().settings) === 'big' && !bust && score < 100) return; // "big moments" only
  if (bust) return speak(tr ? 'Bast' : 'Bust');
  if (score === 0) return speak(tr ? 'Sayı yok' : 'No score');
  speak(tr ? (score === 180 ? 'Yüz seksen!' : String(score)) : EN_NUM(score));
}

export function callRequire(rem) {
  if (level(getState().settings) !== 'all') return;
  const tr = getState().settings.lang === 'tr';
  setTimeout(() => speak(tr ? `${rem} gerekiyor` : `You require ${rem}`), 1200);
}
