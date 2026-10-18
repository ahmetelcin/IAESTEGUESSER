import { MAP_INFO } from '../../data/maps';
import { MODE_LABELS, type Mode } from '../../game/modes';
import type { MapId } from '../../game/scoring';
import { RANKED_ROUNDS, type BoardFilter, type Leaderboard, type Period } from '../../services/leaderboard';
import { el } from '../dom';
import { renderLeaderboard } from '../leaderboardList';

const LIST_LENGTH = 20;

export interface LeaderboardScreen {
  /** Opens on the given board (usually the menu's current map and mode, today). */
  show(filter: BoardFilter): void;
  /** Re-reads the scores (e.g. after the admin cleared them). */
  refresh(): void;
}

function tabs<T extends string>(label: string, options: [T, string][], onPick: (v: T) => void) {
  const group = el('div', 'tabs');
  group.setAttribute('role', 'tablist');
  group.setAttribute('aria-label', label);
  const buttons = options.map(([value, text]) => {
    const b = el('button', 'tabs__tab', text);
    b.type = 'button';
    b.setAttribute('role', 'tab');
    b.dataset.value = value;
    b.addEventListener('click', () => onPick(value));
    return b;
  });
  group.append(...buttons);
  return {
    group,
    select(value: T) {
      for (const b of buttons) {
        const on = b.dataset.value === value;
        b.classList.toggle('is-active', on);
        b.setAttribute('aria-selected', String(on));
      }
    },
  };
}

export function createLeaderboardScreen(
  root: HTMLElement,
  leaderboard: Leaderboard,
  onBack: () => void,
): LeaderboardScreen {
  const screen = el('section', 'screen screen--board');
  const panel = el('div', 'hud-panel board-screen');

  const header = el('header', 'board-screen__header');
  const back = el('button', 'btn board-screen__back', '← MENÜ');
  back.type = 'button';
  back.addEventListener('click', onBack);
  header.append(el('h2', 'board-screen__title', 'Liderlik tablosu'), back);

  let filter: BoardFilter = { mode: 'moving', mapId: 'world', period: 'today' };
  const set = (changes: Partial<BoardFilter>) => {
    filter = { ...filter, ...changes };
    render();
  };

  const period = tabs<Period>('Dönem', [['today', 'Bugün'], ['all', 'Tüm zamanlar']], (v) => set({ period: v }));
  const map = tabs<MapId>(
    'Harita',
    (Object.keys(MAP_INFO) as MapId[]).map((id) => [id, MAP_INFO[id].label]),
    (v) => set({ mapId: v }),
  );
  const mode = tabs<Mode>(
    'Mod',
    (Object.keys(MODE_LABELS) as Mode[]).map((m) => [m, MODE_LABELS[m]]),
    (v) => set({ mode: v }),
  );
  const filters = el('div', 'board-screen__filters');
  filters.append(period.group, map.group, mode.group);

  const list = el('ol', 'board board--large');
  const note = el('p', 'board-screen__note', `Sıralamaya sadece ${RANKED_ROUNDS} turluk oyunlar girer.`);

  panel.append(header, filters, list, note);
  screen.append(panel);
  root.append(screen);

  function render() {
    period.select(filter.period);
    map.select(filter.mapId);
    mode.select(filter.mode);
    renderLeaderboard(list, leaderboard.board(filter, new Date(), LIST_LENGTH), {
      showDate: filter.period === 'all',
      empty: filter.period === 'today' ? 'Bugün bu tabloda henüz skor yok.' : 'Bu tabloda henüz skor yok.',
    });
  }

  return {
    show(initial) {
      filter = initial;
      render();
      requestAnimationFrame(() => back.focus({ preventScroll: true }));
    },
    refresh: render,
  };
}
