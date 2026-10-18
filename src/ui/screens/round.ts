import type { Location } from '../../data/maps';
import { createPanorama } from '../../services/mapillary';
import { el } from '../dom';
import { createMiniMap, type MiniMap } from '../hud/miniMap';
import { createStatusBar, type StatusBar } from '../hud/statusBar';

export interface RoundScreen {
  readonly miniMap: MiniMap;
  readonly statusBar: StatusBar;
  load(location: Location): Promise<void>;
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
  const statusBar = createStatusBar(hud);
  const miniMap = createMiniMap(hud, onGuess);

  return {
    miniMap,
    statusBar,
    async load(location) {
      miniMap.reset();
      await panorama.show(location.imageId);
    },
  };
}
