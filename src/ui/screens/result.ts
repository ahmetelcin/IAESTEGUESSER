import L from 'leaflet';
import { TILE_ATTRIBUTION, TILE_URL } from '../../config';
import { placeName } from '../../data/cityMaps';
import { shortestPathTarget, type LatLng } from '../../game/geo';
import { MAX_SCORE, formatDistance } from '../../game/scoring';
import type { RoundResult } from '../../game/session';
import { animateNumber, el, scoreFormat } from '../dom';
import { actualIcon, guessIcon } from '../pins';

export interface ResultScreen {
  show(result: RoundResult, isLastRound: boolean): void;
}

const LINE_MS = 900;
const COUNT_MS = 1200;

export function createResultScreen(root: HTMLElement, onNext: () => void): ResultScreen {
  const screen = el('section', 'screen screen--result');
  const mapEl = el('div', 'result__map');
  const panel = el('div', 'result__panel');

  const scoreEl = el('div', 'result__score', '0');
  const scoreUnit = el('span', 'result__score-unit', 'puan');
  const scoreRow = el('div', 'result__score-row');
  scoreRow.append(scoreEl, scoreUnit);

  const bar = el('div', 'progress');
  const barFill = el('div', 'progress__fill');
  bar.append(barFill);

  const distanceEl = el('p', 'result__distance');
  const placeEl = el('p', 'result__place');
  const iaesteEl = el('p', 'result__iaeste', 'Bu ülkede IAESTE stajı var — standımızda sor');
  // The photographer is hidden during the round (their username can give the place away).
  const creditEl = el('p', 'result__credit');
  const nextBtn = el('button', 'btn btn--primary result__next', 'SONRAKİ TUR');
  nextBtn.type = 'button';
  nextBtn.addEventListener('click', onNext);

  panel.append(scoreRow, bar, distanceEl, placeEl, iaesteEl, nextBtn);
  // Bottom-left corner of the map, opposite the tile attribution.
  const mapWrap = el('div', 'result__map-wrap');
  mapWrap.append(mapEl, creditEl);
  screen.append(mapWrap, panel);
  root.append(screen);

  // minZoom 2: at zoom 1 the world is shorter than the screen and repeats sideways.
  const map = L.map(mapEl, { center: [25, 10], zoom: 2, minZoom: 2, zoomControl: false });
  L.tileLayer(TILE_URL, { attribution: TILE_ATTRIBUTION, maxZoom: 19 }).addTo(map);
  map.attributionControl.setPrefix(false);
  const layers = L.layerGroup().addTo(map);

  let lineFrame = 0;

  function drawLine(from: LatLng, to: LatLng) {
    const line = L.polyline([[from.lat, from.lng]], {
      className: 'result__line',
      dashArray: '8 10',
      weight: 3,
    }).addTo(layers);
    const start = performance.now();
    const step = (now: number) => {
      const t = Math.min(1, (now - start) / LINE_MS);
      const e = 1 - (1 - t) ** 3;
      line.setLatLngs([
        [from.lat, from.lng],
        [from.lat + (to.lat - from.lat) * e, from.lng + (to.lng - from.lng) * e],
      ]);
      if (t < 1) lineFrame = requestAnimationFrame(step);
      else L.marker([to.lat, to.lng], { icon: actualIcon, keyboard: false }).addTo(layers);
    };
    lineFrame = requestAnimationFrame(step);
  }

  return {
    show({ guess, location, km, score }, isLastRound) {
      cancelAnimationFrame(lineFrame);
      layers.clearLayers();

      // The screen was display:none until now; let Leaflet measure it first.
      map.invalidateSize({ pan: false });
      if (guess) {
        const target = shortestPathTarget(guess, location);
        L.marker([guess.lat, guess.lng], { icon: guessIcon, keyboard: false }).addTo(layers);
        map.fitBounds(L.latLngBounds([guess.lat, guess.lng], [target.lat, target.lng]), {
          padding: [60, 60],
          maxZoom: 14,
          animate: false,
        });
        drawLine(guess, target);
      } else {
        L.marker([location.lat, location.lng], { icon: actualIcon, keyboard: false }).addTo(layers);
        map.setView([location.lat, location.lng], 4, { animate: false });
      }

      animateNumber(scoreEl, score, COUNT_MS, (n) => scoreFormat.format(n));
      barFill.style.width = '0%';
      requestAnimationFrame(() => {
        barFill.style.width = `${(score / MAX_SCORE) * 100}%`;
      });
      if (km === null) distanceEl.textContent = 'Süre doldu — tahmin yapılmadı';
      else distanceEl.innerHTML = `Tahminin <strong>${formatDistance(km)}</strong> uzakta`;
      placeEl.textContent = placeName(location);
      creditEl.textContent = `Görüntü: ${location.creator ?? 'Mapillary katkıcısı'} · Mapillary · CC BY-SA`;
      nextBtn.textContent = isLastRound ? 'SONUÇLARI GÖR' : 'SONRAKİ TUR';
      nextBtn.focus({ preventScroll: true });
    },
  };
}
