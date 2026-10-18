import 'leaflet/dist/leaflet.css';
import './styles/tokens.css';
import './styles/base.css';
import './styles/hud.css';
import './styles/result.css';

import { MAPILLARY_TOKEN, MAX_LOAD_ATTEMPTS } from './config';
import { MAPS, type Location } from './data/maps';
import { haversineKm } from './game/geo';
import { scoreFor, type MapId } from './game/scoring';
import { createStateMachine } from './game/state';
import { createLoadingScreen } from './ui/screens/loading';
import { createResultScreen } from './ui/screens/result';
import { createRoundScreen } from './ui/screens/round';

const app = document.getElementById('app')!;
const MAP_ID: MapId = 'world';
const locations = MAPS[MAP_ID];

const state = createStateMachine('loading');
app.dataset.state = state.current;
state.subscribe((to) => {
  app.dataset.state = to;
});

const loading = createLoadingScreen(app);

if (!MAPILLARY_TOKEN) {
  loading.showError('Mapillary token eksik — .env dosyasına VITE_MAPILLARY_TOKEN ekleyin.');
} else if (locations.length === 0) {
  loading.showError('Lokasyon yok — önce "npm run fetch-panos" çalıştırın.');
} else {
  start();
}

function start() {
  let roundNo = 0;
  let totalScore = 0;
  let current: Location | null = null;

  const round = createRoundScreen(app, MAPILLARY_TOKEN, guess);
  const result = createResultScreen(app, next);

  function pickLocation(): Location {
    const pool = locations.length > 1 ? locations.filter((l) => l !== current) : locations;
    return pool[Math.floor(Math.random() * pool.length)];
  }

  async function loadRound() {
    for (let attempt = 1; attempt <= MAX_LOAD_ATTEMPTS; attempt++) {
      const loc = pickLocation();
      try {
        await round.load(loc);
        current = loc;
        roundNo++;
        round.statusBar.update({ round: roundNo, score: totalScore });
        state.transition('round');
        return;
      } catch (err) {
        console.warn(`Panorama failed to load (${loc.id}, ${loc.imageId})`, err);
      }
    }
    loading.showError('Panorama yüklenemedi. İnternet bağlantısını kontrol edin.');
  }

  function guess() {
    const g = round.miniMap.guess;
    if (state.current !== 'round' || !g || !current) return;
    const km = haversineKm(g, current);
    const score = scoreFor(km, MAP_ID);
    totalScore += score;
    state.transition('result');
    result.show({ guess: g, location: current, km, score });
  }

  function next() {
    if (state.current !== 'result') return;
    state.transition('loading');
    void loadRound();
  }

  window.addEventListener('keydown', (e) => {
    if (e.code !== 'Space') return;
    const t = e.target as HTMLElement | null;
    if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return;
    e.preventDefault();
    if (e.repeat) return;
    if (state.current === 'round') guess();
    else if (state.current === 'result') next();
  });
  // Stop a focused button from also firing its click on Space keyup.
  window.addEventListener('keyup', (e) => {
    if (e.code === 'Space' && (e.target as HTMLElement | null)?.tagName === 'BUTTON') e.preventDefault();
  });

  void loadRound();
}
