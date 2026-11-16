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

export function availableVoices(lang) {
  return voices().filter((v) => v.lang.toLowerCase().startsWith(lang));
}

export function speak(text) {
  const st = getState().settings;
  if (!st.caller || !('speechSynthesis' in window)) return;
  try {
    speechSynthesis.cancel();
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
  if (bust) return speak(tr ? 'Bast' : 'Bust');
  if (score === 0) return speak(tr ? 'Sayı yok' : 'No score');
  speak(tr ? (score === 180 ? 'Yüz seksen!' : String(score)) : EN_NUM(score));
}

export function callRequire(rem) {
  const tr = getState().settings.lang === 'tr';
  setTimeout(() => speak(tr ? `${rem} gerekiyor` : `You require ${rem}`), 1200);
}
