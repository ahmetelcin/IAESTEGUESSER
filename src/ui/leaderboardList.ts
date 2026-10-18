import type { LeaderboardEntry } from '../services/leaderboard';
import { el, scoreFormat } from './dom';

const dateFormat = new Intl.DateTimeFormat('tr-TR', { day: '2-digit', month: '2-digit', year: 'numeric' });

/** Renders a ranked list; `highlight` marks the current player's row. */
export function renderLeaderboard(
  list: HTMLOListElement,
  entries: LeaderboardEntry[],
  options: { highlight?: LeaderboardEntry; showDate?: boolean; empty?: string } = {},
): void {
  list.replaceChildren();
  list.classList.toggle('board--dated', !!options.showDate);
  if (entries.length === 0) {
    list.append(el('li', 'board__empty', options.empty ?? 'Henüz skor yok — ilk sen ol!'));
    return;
  }
  entries.forEach((e, i) => {
    const row = el('li', 'board__row');
    if (options.highlight && e.ts === options.highlight.ts && e.name === options.highlight.name) row.classList.add('is-me');
    row.append(el('span', 'board__rank', String(i + 1)), el('span', 'board__name', e.name));
    if (options.showDate) row.append(el('span', 'board__date', dateFormat.format(e.ts)));
    row.append(el('span', 'board__score', scoreFormat.format(e.score)));
    list.append(row);
  });
}
