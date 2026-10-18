import type { Location } from '../../data/maps';
import { MODE_RULES, type ModeRules } from '../../game/modes';
import { createPanorama, type Panorama } from '../../services/mapillary';
import { el } from '../dom';
import { createControls } from '../hud/controls';
import { createMiniMap, type MiniMap } from '../hud/miniMap';
import { createStatusBar, type StatusBar } from '../hud/statusBar';

const ZOOM_STEP = 0.5;

export interface RoundScreen {
  readonly panorama: Panorama;
  readonly miniMap: MiniMap;
  readonly statusBar: StatusBar;
  load(location: Location): Promise<void>;
  /**
   * Starts loading the next round while the result screen covers the viewer,
   * so the following `load` of the same location is instant.
   */
  preload(location: Location): void;
  resetView(): void;
  zoom(direction: 1 | -1): void;
  /** Rules for the current game's mode; applied on every `load`. */
  setRules(rules: ModeRules): void;
  readonly rules: ModeRules;
}

export function createRoundScreen(
  root: HTMLElement,
  token: string,
  onGuess: () => void,
): RoundScreen {
  const screen = el('section', 'screen screen--round');
  const viewerEl = el('div', 'round__viewer');
  const hud = el('div', 'hud');
  screen.append(viewerEl, hud);
  root.append(screen);

  const panorama = createPanorama(viewerEl, token);
  let startImageId: string | null = null;
  let preloading: { imageId: string; done: Promise<void> } | null = null;
  let rules: ModeRules = MODE_RULES.moving;

  const resetView = () => {
    if (!rules.move && !rules.pan) return;
    if (startImageId) void panorama.reset(startImageId).catch(() => {});
  };
  const zoom = (direction: 1 | -1) => {
    if (rules.zoom) void panorama.zoomBy(direction * ZOOM_STEP);
  };

  const controls = createControls(hud, {
    onReset: resetView,
    onZoomIn: () => zoom(1),
    onZoomOut: () => zoom(-1),
  });
  panorama.onBearing((deg) => controls.setBearing(deg));

  const statusBar = createStatusBar(hud);
  const miniMap = createMiniMap(hud, onGuess);

  return {
    panorama,
    miniMap,
    statusBar,
    async load(location) {
      miniMap.reset();
      panorama.setAutoRotate(false);
      panorama.setRules(rules);
      controls.setRules(rules);
      const pending = preloading?.imageId === location.imageId ? preloading.done : null;
      preloading = null;
      await (pending ?? panorama.show(location.imageId));
      startImageId = location.imageId;
    },
    preload(location) {
      const done = panorama.show(location.imageId);
      done.catch(() => {}); // surfaced again by load()
      preloading = { imageId: location.imageId, done };
    },
    resetView,
    zoom,
    setRules(next) {
      rules = next;
    },
    get rules() {
      return rules;
    },
  };
}
