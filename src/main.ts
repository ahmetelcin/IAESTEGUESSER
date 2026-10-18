import 'leaflet/dist/leaflet.css';
import './styles/tokens.css';
import './styles/base.css';
import './styles/shared.css';
import './styles/hud.css';
import './styles/controls.css';
import './styles/result.css';
import './styles/menu.css';
import './styles/summary.css';

import { MAPILLARY_TOKEN, MAX_LOAD_ATTEMPTS, ROUNDS_PER_GAME, ROUND_SECONDS } from './config';
import { MAPS, MAP_INFO, type Location } from './data/maps';
import type { LatLng } from './game/geo';
import { createSession, type Session } from './game/session';
import { createStateMachine } from './game/state';
import { createTimer } from './game/timer';
import { createLeaderboard } from './services/leaderboard';
import { createLoadingScreen } from './ui/screens/loading';
import { createMenuScreen, type MenuChoice } from './ui/screens/menu';
import { createResultScreen } from './ui/screens/result';
import { createRoundScreen } from './ui/screens/round';
import { createSummaryScreen } from './ui/screens/summary';

const app = document.getElementById('app')!;

const state = createStateMachine('menu');
app.dataset.state = state.current;
state.subscribe((to) => {
  app.dataset.state = to;
});

const loading = createLoadingScreen(app);

if (!MAPILLARY_TOKEN) {
  loading.showError('Mapillary token eksik — .env dosyasına VITE_MAPILLARY_TOKEN ekleyin.');
} else if (MAPS.world.length === 0) {
  loading.showError('Lokasyon yok — önce "npm run curate" çalıştırın.');
} else {
  start();
}

function start() {
  const leaderboard = createLeaderboard();
  let session: Session | null = null;
  let playerName = '';
  let menuLocation: Location | null = null;

  const round = createRoundScreen(app, MAPILLARY_TOKEN, guess);
  const result = createResultScreen(app, next);
  const summary = createSummaryScreen(app, newPlayer);
  const menu = createMenuScreen(app, play);

  const timer = createTimer({
    onTick: (s) => round.statusBar.setTime(s),
    // Time's up: submit the pin if there is one, otherwise the round scores 0.
    onExpire: () => finishRound(round.miniMap.guess),
  });

  function enterMenu() {
    menu.show(leaderboard.today());
    const pool = MAPS.world;
    menuLocation = pool[Math.floor(Math.random() * pool.length)];
    round.panorama.setNavigation(false);
    round.panorama
      .show(menuLocation.imageId)
      .then(() => {
        if (state.current === 'menu') round.panorama.setAutoRotate(true);
      })
      .catch((err) => console.warn('Menu panorama failed to load', err));
  }

  function play(choice: MenuChoice) {
    if (state.current !== 'menu') return;
    playerName = choice.name;
    round.miniMap.setHome(MAP_INFO[choice.mapId].center, MAP_INFO[choice.mapId].zoom);
    session = createSession({
      pool: MAPS[choice.mapId],
      rounds: ROUNDS_PER_GAME,
      mapId: choice.mapId,
      exclude: menuLocation?.id,
    });
    state.transition('loading');
    void loadRound();
  }

  async function loadRound() {
    const s = session!;
    for (let attempt = 1; attempt <= MAX_LOAD_ATTEMPTS; attempt++) {
      try {
        await round.load(s.current);
        round.statusBar.update({ round: s.roundNumber, totalRounds: s.totalRounds, score: s.totalScore });
        state.transition('round');
        timer.start(ROUND_SECONDS);
        return;
      } catch (err) {
        console.warn(`Panorama failed to load (${s.current.id}, ${s.current.imageId})`, err);
        if (!s.replaceCurrent()) break;
      }
    }
    loading.showError('Panorama yüklenemedi. İnternet bağlantısını kontrol edip sayfayı yenileyin.');
  }

  function guess() {
    const g = round.miniMap.guess;
    if (state.current === 'round' && g) finishRound(g);
  }

  function finishRound(g: LatLng | null) {
    if (state.current !== 'round' || !session) return;
    timer.stop();
    const r = session.submit(g);
    round.statusBar.update({
      round: session.roundNumber,
      totalRounds: session.totalRounds,
      score: session.totalScore,
    });
    state.transition('result');
    result.show(r, session.isLastRound);
    if (session.upcoming) round.preload(session.upcoming);
  }

  function next() {
    if (state.current !== 'result' || !session) return;
    if (session.isLastRound) {
      showSummary(session);
      return;
    }
    session.next();
    state.transition('loading');
    void loadRound();
  }

  function showSummary(s: Session) {
    const rank = leaderboard.add({ name: playerName, score: s.totalScore, mapId: s.mapId });
    const board = leaderboard.today();
    state.transition('summary');
    summary.show({
      name: playerName,
      results: s.results,
      totalScore: s.totalScore,
      rank,
      board,
      me: board[rank - 1],
    });
  }

  function newPlayer() {
    if (state.current !== 'summary') return;
    session = null;
    state.transition('menu');
    enterMenu();
  }

  window.addEventListener('keydown', (e) => {
    const t = e.target as HTMLElement | null;
    if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return;
    if (e.ctrlKey || e.metaKey || e.altKey) return;

    if (e.code === 'Space') {
      e.preventDefault();
      if (e.repeat) return;
      if (state.current === 'round') guess();
      else if (state.current === 'result') next();
      return;
    }
    if (state.current !== 'round') return;

    if (e.code === 'KeyR') round.resetView();
    else if (e.code === 'KeyM') round.miniMap.toggle();
    else if (e.key === '+' || e.key === '=' || e.code === 'NumpadAdd') round.zoom(1);
    else if (e.key === '-' || e.key === '_' || e.code === 'NumpadSubtract') round.zoom(-1);
    else return;
    e.preventDefault();
  });
  // Stop a focused button from also firing its click on Space keyup.
  window.addEventListener('keyup', (e) => {
    if (e.code === 'Space' && (e.target as HTMLElement | null)?.tagName === 'BUTTON') e.preventDefault();
  });

  enterMenu();
}
