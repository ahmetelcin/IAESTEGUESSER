import L from 'leaflet';
import { TILE_ATTRIBUTION, TILE_URL } from '../../config';
import { shortestPathTarget } from '../../game/geo';
import { MAX_SCORE, formatDistance } from '../../game/scoring';
import type { RoundResult } from '../../game/session';
import type { LeaderboardEntry } from '../../services/leaderboard';
import { animateNumber, el, scoreFormat } from '../dom';
import { renderLeaderboard } from '../leaderboardList';
import { guessIcon, roundIcon } from '../pins';

export interface SummaryData {
  name: string;
  results: readonly RoundResult[];
  totalScore: number;
  rank: number;
  board: LeaderboardEntry[];
  me: LeaderboardEntry | undefined;
}

export interface SummaryScreen {
  show(data: SummaryData): void;
}

const COUNT_MS = 1500;

export function createSummaryScreen(root: HTMLElement, onNewPlayer: () => void): SummaryScreen {
  const screen = el('section', 'screen screen--summary');
  const mapEl = el('div', 'summary__map');
  const panel = el('div', 'summary__panel');

  const title = el('h2', 'summary__title');
  const totalRow = el('div', 'summary__total-row');
  const totalEl = el('span', 'summary__total', '0');
  const maxEl = el('span', 'summary__max');
  totalRow.append(totalEl, maxEl);

  const bar = el('div', 'progress');
  const barFill = el('div', 'progress__fill');
  bar.append(barFill);

  const rankEl = el('p', 'summary__rank');

  const table = el('table', 'summary__table');
  const head = el('thead');
  head.innerHTML = '<tr><th>Tur</th><th>Şehir</th><th>Mesafe</th><th>Puan</th></tr>';
  const body = el('tbody');
  table.append(head, body);

  const boardTitle = el('h3', 'summary__board-title', 'Günün Liderleri');
  const board = el('ol', 'board board--compact');

  const newBtn = el('button', 'btn btn--primary summary__new', 'YENİ OYUNCU');
  newBtn.type = 'button';
  newBtn.addEventListener('click', onNewPlayer);

  panel.append(title, totalRow, bar, rankEl, table, boardTitle, board, newBtn);
  screen.append(mapEl, panel);
  root.append(screen);

  // minZoom 2: at zoom 1 the world is shorter than the screen and repeats sideways.
  const map = L.map(mapEl, { center: [25, 10], zoom: 2, minZoom: 2, zoomControl: false });
  L.tileLayer(TILE_URL, { attribution: TILE_ATTRIBUTION, maxZoom: 19 }).addTo(map);
  map.attributionControl.setPrefix(false);
  const layers = L.layerGroup().addTo(map);

  return {
    show({ name, results, totalScore, rank, board: entries, me }) {
      layers.clearLayers();
      map.invalidateSize({ pan: false });

      const bounds = L.latLngBounds([]);
      results.forEach((r, i) => {
        const { location, guess } = r;
        if (guess) {
          const target = shortestPathTarget(guess, location);
          L.polyline(
            [
              [guess.lat, guess.lng],
              [target.lat, target.lng],
            ],
            { className: 'result__line', dashArray: '8 10', weight: 3 },
          ).addTo(layers);
          L.marker([guess.lat, guess.lng], { icon: guessIcon, keyboard: false }).addTo(layers);
          L.marker([target.lat, target.lng], { icon: roundIcon(i + 1), keyboard: false }).addTo(layers);
          bounds.extend([guess.lat, guess.lng]).extend([target.lat, target.lng]);
        } else {
          L.marker([location.lat, location.lng], { icon: roundIcon(i + 1), keyboard: false }).addTo(layers);
          bounds.extend([location.lat, location.lng]);
        }
      });
      if (bounds.isValid()) map.fitBounds(bounds, { padding: [50, 50], maxZoom: 6, animate: false });

      const max = results.length * MAX_SCORE;
      title.textContent = `Oyun bitti, ${name}!`;
      maxEl.textContent = `/ ${scoreFormat.format(max)}`;
      animateNumber(totalEl, totalScore, COUNT_MS, (n) => scoreFormat.format(n));
      barFill.style.width = '0%';
      requestAnimationFrame(() => {
        barFill.style.width = `${(totalScore / max) * 100}%`;
      });
      rankEl.innerHTML = `Günün sıralamasında <strong>${rank}.</strong> sıradasın`;

      body.replaceChildren();
      results.forEach((r, i) => {
        const tr = el('tr');
        tr.append(
          el('td', '', String(i + 1)),
          el('td', '', `${r.location.city}, ${r.location.country}`),
          el('td', '', r.km === null ? '—' : formatDistance(r.km)),
          el('td', 'summary__pts', scoreFormat.format(r.score)),
        );
        body.append(tr);
      });

      renderLeaderboard(board, entries, me);
      newBtn.focus({ preventScroll: true });
    },
  };
}
