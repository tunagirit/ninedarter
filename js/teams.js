// Sides: a side is a single player or a team. config.teams = [[playerIdx, ...], ...] (optional).
import { t } from './i18n.js';

export const sidesOf = (config) => config.teams || config.players.map((_, i) => [i]);
export const isTeamGame = (config) => !!config.teams;
export const sideName = (config, s) => (config.teams ? t('team.n', { n: s + 1 }) : config.players[s]?.name || '');
export const sideOfPlayer = (config, p) => sidesOf(config).findIndex((side) => side.includes(p));

/** Did player `pid` win match record `m`? Works for solo and team games. */
export const isWinner = (m, pid) => (m.winners ? m.winners.includes(pid) : m.winner === pid);
export const winnerNames = (m) => {
  if (m.winners) return m.players.filter((p) => m.winners.includes(p.id)).map((p) => p.name).join(' & ');
  return m.players.find((p) => p.id === m.winner)?.name || '';
};
