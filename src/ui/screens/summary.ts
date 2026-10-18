import L from 'leaflet';
import { TILE_ATTRIBUTION, TILE_URL } from '../../config';
import { fitLongitudes, shortestPathTarget } from '../../game/geo';
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
  /** Rank on today's board for this mode and map; null when the game isn't ranked. */
  rank: number | null;
  /** e.g. "IAESTE Dünya · Hareketli" */
  boardLabel: string;
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

  // Fractional zoom so fitBounds can use the exact level that shows every pin.
  const map = L.map(mapEl, {
    center: [25, 10],
    zoom: 2,
    zoomSnap: 0.1,
    zoomControl: false,
  });
  L.tileLayer(TILE_URL, { attribution: TILE_ATTRIBUTION, maxZoom: 19 }).addTo(map);
  map.attributionControl.setPrefix(false);
  const layers = L.layerGroup().addTo(map);

  return {
    show({ name, results, totalScore, rank, boardLabel, board: entries, me }) {
      layers.clearLayers();
      map.invalidateSize({ pan: false });

      // Never zoom out so far that the world is shorter than the map (grey bands).
      map.setMinZoom(Math.ceil(Math.log2(mapEl.clientHeight / 256) * 10) / 10);

      // Place all points in the narrowest longitude window (antimeridian-aware). Lines take
      // the short way when that stays inside the window; otherwise they use the window copy,
      // so every pin is guaranteed to be on screen.
      const lngs = fitLongitudes(results.flatMap((r) => (r.guess ? [r.guess.lng, r.location.lng] : [r.location.lng])));
      const west = Math.min(...lngs);
      const east = Math.max(...lngs);
      const bounds = L.latLngBounds([]);
      let k = 0;
      results.forEach((r, i) => {
        const { location, guess } = r;
        if (guess) {
          const g = { lat: guess.lat, lng: lngs[k] };
          const short = shortestPathTarget(g, location);
          const target =
            short.lng >= west && short.lng <= east ? short : { lat: location.lat, lng: lngs[k + 1] };
          k += 2;
          L.polyline(
            [
              [g.lat, g.lng],
              [target.lat, target.lng],
            ],
            { className: 'result__line', dashArray: '8 10', weight: 3 },
          ).addTo(layers);
          L.marker([g.lat, g.lng], { icon: guessIcon, keyboard: false }).addTo(layers);
          L.marker([target.lat, target.lng], { icon: roundIcon(i + 1), keyboard: false }).addTo(layers);
          bounds.extend([g.lat, g.lng]).extend([target.lat, target.lng]);
        } else {
          const lng = lngs[k++];
          L.marker([location.lat, lng], { icon: roundIcon(i + 1), keyboard: false }).addTo(layers);
          bounds.extend([location.lat, lng]);
        }
      });
      if (bounds.isValid()) map.fitBounds(bounds, { padding: [60, 60], maxZoom: 15, animate: false });

      const max = results.length * MAX_SCORE;
      title.textContent = `Oyun bitti, ${name}!`;
      maxEl.textContent = `/ ${scoreFormat.format(max)}`;
      animateNumber(totalEl, totalScore, COUNT_MS, (n) => scoreFormat.format(n));
      barFill.style.width = '0%';
      requestAnimationFrame(() => {
        barFill.style.width = `${(totalScore / max) * 100}%`;
      });
      if (rank === null) rankEl.textContent = 'Bu oyun sıralamaya girmez (sadece 5 turluk oyunlar sıralanır).';
      else rankEl.innerHTML = `Günün sıralamasında <strong>${rank}.</strong> sıradasın`;
      boardTitle.textContent = `Günün liderleri — ${boardLabel}`;

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

      renderLeaderboard(board, entries, { highlight: me, empty: 'Bugün bu tabloda henüz skor yok.' });
      newBtn.focus({ preventScroll: true });
    },
  };
}
