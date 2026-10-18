import type { LeaderboardEntry } from '../services/leaderboard';
import { el, scoreFormat } from './dom';

/** Renders a ranked list; `highlight` marks the current player's row. */
export function renderLeaderboard(
  list: HTMLOListElement,
  entries: LeaderboardEntry[],
  highlight?: LeaderboardEntry,
): void {
  list.replaceChildren();
  if (entries.length === 0) {
    list.append(el('li', 'board__empty', 'Bugün henüz skor yok — ilk sen ol!'));
    return;
  }
  entries.forEach((e, i) => {
    const row = el('li', 'board__row');
    if (highlight && e.ts === highlight.ts && e.name === highlight.name) row.classList.add('is-me');
    row.append(
      el('span', 'board__rank', String(i + 1)),
      el('span', 'board__name', e.name),
      el('span', 'board__score', scoreFormat.format(e.score)),
    );
    list.append(row);
  });
}
