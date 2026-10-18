import 'leaflet/dist/leaflet.css';
import './styles/tokens.css';
import './styles/base.css';
import './styles/shared.css';
import './styles/hud.css';
import './styles/controls.css';
import './styles/result.css';
import './styles/menu.css';
import './styles/summary.css';
import './styles/admin.css';
import './styles/board.css';

import { ADMIN_PIN, ATTRACT_TIMEOUT_MS, MAPILLARY_TOKEN, MAX_LOAD_ATTEMPTS } from './config';
import { MAPS, MAP_INFO, type Location } from './data/maps';
import type { LatLng } from './game/geo';
import { createIdleWatcher } from './game/idle';
import { MODE_LABELS, MODE_RULES, type Mode } from './game/modes';
import { createSession, type Session } from './game/session';
import { createStateMachine } from './game/state';
import { createTimer } from './game/timer';
import { createLeaderboard } from './services/leaderboard';
import { createPinGate } from './services/pin';
import { createSettings } from './services/settings';
import { createAdminPanel } from './ui/screens/admin';
import { createCreditsScreen } from './ui/screens/credits';
import { createLeaderboardScreen } from './ui/screens/leaderboard';
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
  const settings = createSettings();
  let session: Session | null = null;
  let playerName = '';
  let mode: Mode = 'moving';
  let menuLocation: Location | null = null;

  const round = createRoundScreen(app, MAPILLARY_TOKEN, guess);
  const result = createResultScreen(app, next);
  const summary = createSummaryScreen(app, newPlayer);
  const menu = createMenuScreen(app, {
    onPlay: play,
    onLeaderboard: () => openSubScreen('leaderboard'),
    onCredits: () => openSubScreen('credits'),
  });
  const board = createLeaderboardScreen(app, leaderboard, backToMenu);
  const credits = createCreditsScreen(app, backToMenu);
  const admin = createAdminPanel(app, {
    settings,
    leaderboard,
    pin: createPinGate(ADMIN_PIN),
    onChange: () => board.refresh(),
  });

  function openSubScreen(screen: 'leaderboard' | 'credits') {
    if (state.current !== 'menu') return;
    state.transition(screen);
    if (screen === 'leaderboard') board.show({ ...menu.picks, period: 'today' });
    else credits.show();
  }

  function backToMenu() {
    if (state.current !== 'leaderboard' && state.current !== 'credits') return;
    state.transition('menu');
    menu.resume();
  }

  const timer = createTimer({
    onTick: (s) => round.statusBar.setTime(s),
    // Time's up: submit the pin if there is one, otherwise the round scores 0.
    onExpire: () => finishRound(round.miniMap.guess),
  });

  function enterMenu() {
    menu.show();
    const pool = MAPS.world;
    menuLocation = pool[Math.floor(Math.random() * pool.length)];
    round.panorama.setRules({ move: false, pan: false, zoom: false });
    round.panorama
      .show(menuLocation.imageId)
      .then(() => {
        if (state.current === 'menu') round.panorama.setAutoRotate(true);
      })
      .catch((err) => console.warn('Menu panorama failed to load', err));
  }

  function play(choice: MenuChoice) {
    if (state.current !== 'menu') return;
    const { rounds } = settings.get();
    playerName = choice.name;
    mode = choice.mode;
    round.setRules(MODE_RULES[mode]);
    round.miniMap.setHome(MAP_INFO[choice.mapId].center, MAP_INFO[choice.mapId].zoom);
    session = createSession({
      pool: MAPS[choice.mapId],
      rounds,
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
        // The game may have been abandoned (attract mode) while this was loading.
        if (session !== s) return;
        round.statusBar.update({ round: s.roundNumber, totalRounds: s.totalRounds, score: s.totalScore });
        state.transition('round');
        timer.start(settings.get().roundSeconds);
        return;
      } catch (err) {
        if (session !== s) return;
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
    const rank = leaderboard.add({
      name: playerName,
      score: s.totalScore,
      mapId: s.mapId,
      mode,
      rounds: s.totalRounds,
    });
    const today = leaderboard.board({ mode, mapId: s.mapId, period: 'today' });
    state.transition('summary');
    summary.show({
      name: playerName,
      results: s.results,
      totalScore: s.totalScore,
      rank,
      boardLabel: `${MAP_INFO[s.mapId].label} · ${MODE_LABELS[mode]}`,
      board: today,
      me: rank !== null ? today[rank - 1] : undefined,
    });
  }

  function newPlayer() {
    if (state.current !== 'summary') return;
    session = null;
    state.transition('menu');
    enterMenu();
  }

  // ── Attract mode: an abandoned game goes back to the rotating menu ──
  const idle = createIdleWatcher(ATTRACT_TIMEOUT_MS, () => {
    if (admin.isOpen) return idle.poke();
    timer.stop();
    session = null; // an unfinished game is dropped, not scored
    if (state.current !== 'menu') state.transition('menu');
    // Also refreshes an idle menu: clears a half-typed name, shows a new place.
    enterMenu();
    idle.poke();
  });
  for (const type of ['pointerdown', 'pointermove', 'keydown', 'wheel', 'touchstart'] as const) {
    window.addEventListener(type, () => idle.poke(), { passive: true, capture: true });
  }
  idle.poke();

  // ── Keyboard ──
  window.addEventListener('keydown', (e) => {
    // Staff shortcut (ADMIN_SHORTCUT) works everywhere, even while typing a name.
    // Not Ctrl+Shift+A: Chrome reserves that for tab search.
    if (e.ctrlKey && e.shiftKey && e.code === 'F8') {
      e.preventDefault();
      admin.toggle();
      return;
    }
    if (admin.isOpen) {
      if (e.code === 'Escape') admin.close();
      return;
    }

    // Before the text-field check: focus may still sit in the (now hidden) name field.
    if (e.code === 'Escape' && (state.current === 'leaderboard' || state.current === 'credits')) {
      backToMenu();
      return;
    }

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

  // Fallback when the shortcut is awkward (laptop Fn keys, kiosk keyboards): open with #admin.
  const openAdminFromHash = () => {
    if (location.hash === '#admin' && !admin.isOpen) admin.open();
  };
  window.addEventListener('hashchange', openAdminFromHash);

  enterMenu();
  openAdminFromHash();
}
