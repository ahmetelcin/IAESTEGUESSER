import { TransitionMode, Viewer } from 'mapillary-js';
import 'mapillary-js/dist/mapillary.css';
import type { ModeRules } from '../game/modes';

const MAX_ZOOM = 3;
/** Full turns per second for the menu background rotation. */
const AUTO_ROTATE_SPEED = 1 / 120;
const LOAD_TIMEOUT_MS = 15_000;

export interface Panorama {
  /** Jumps to a new panorama without a cross-city transition animation. */
  show(imageId: string): Promise<void>;
  /** Moves back to `imageId` (if the player walked away) and resets heading and zoom. */
  reset(imageId: string): Promise<void>;
  zoomBy(delta: number): Promise<void>;
  onBearing(listener: (degrees: number) => void): void;
  setAutoRotate(on: boolean): void;
  /** Applies a mode: movement arrows/keys, drag to look around, scroll/pinch zoom. */
  setRules(rules: ModeRules): void;
  resize(): void;
}

/** Creates the single Mapillary viewer used for the whole session. */
export function createPanorama(container: HTMLElement, accessToken: string): Panorama {
  const viewer = new Viewer({
    accessToken,
    container,
    component: {
      // Attribution stays on (required by Mapillary).
      attribution: true,
      cover: false,
      bearing: false,
      sequence: false,
      zoom: false, // replaced by our HUD buttons
      // Our own +/- shortcuts handle zoom; Mapillary's would double it.
      keyboard: { keyZoom: false, keyPlay: false, keySequenceNavigation: false },
    },
  });

  // Anti-cheat: the attribution stays visible (Mapillary requires it), but its links open
  // the image page on mapillary.com, which shows the location. Block every way to follow them.
  const blockLinks = (e: Event) => {
    if ((e.target as Element | null)?.closest?.('a')) {
      e.preventDefault();
      e.stopPropagation();
    }
  };
  for (const type of ['click', 'auxclick', 'contextmenu'] as const) container.addEventListener(type, blockLinks, true);
  container.addEventListener('contextmenu', (e) => e.preventDefault());

  let currentId: string | null = null;
  viewer.on('image', (e) => {
    currentId = e.image?.id ?? currentId;
  });

  let rotateFrame = 0;
  let rotating = false;

  async function rotateLoop() {
    const [x0, y] = await viewer.getCenter();
    let x = x0;
    let last = performance.now();
    const step = (now: number) => {
      if (!rotating) return;
      x = (x + ((now - last) / 1000) * AUTO_ROTATE_SPEED) % 1;
      last = now;
      viewer.setCenter([x, y]);
      rotateFrame = requestAnimationFrame(step);
    };
    rotateFrame = requestAnimationFrame(step);
  }

  async function show(imageId: string) {
    viewer.setTransitionMode(TransitionMode.Instantaneous);
    try {
      // moveTo can stay pending forever on a bad image or a stalled API; give up so the
      // caller can try another location instead of leaving the stand on a spinner.
      let timer: ReturnType<typeof setTimeout> | undefined;
      const timeout = new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new Error(`moveTo timed out: ${imageId}`)), LOAD_TIMEOUT_MS);
      });
      try {
        await Promise.race([viewer.moveTo(imageId), timeout]);
      } finally {
        clearTimeout(timer);
      }
      currentId = imageId;
    } finally {
      viewer.setTransitionMode(TransitionMode.Default);
    }
  }

  return {
    show,
    async reset(imageId) {
      if (currentId !== imageId) await show(imageId);
      viewer.setZoom(0);
      viewer.setCenter([0.5, 0.5]);
    },
    async zoomBy(delta) {
      const z = await viewer.getZoom();
      viewer.setZoom(Math.max(0, Math.min(MAX_ZOOM, z + delta)));
    },
    onBearing(listener) {
      viewer.on('bearing', (e) => listener(e.bearing));
    },
    setAutoRotate(on) {
      if (on === rotating) return;
      rotating = on;
      cancelAnimationFrame(rotateFrame);
      if (on) void rotateLoop();
    },
    setRules({ move, pan, zoom }) {
      const toggle = (name: Parameters<Viewer['activateComponent']>[0], on: boolean) =>
        on ? viewer.activateComponent(name) : viewer.deactivateComponent(name);
      toggle('direction', move);
      toggle('keyboard', move);
      // Prefetching neighbouring images only matters when the player can walk to them.
      toggle('cache', move);
      // The pointer component handles both drag-to-look and scroll/pinch zoom.
      toggle('pointer', pan || zoom);
    },
    resize() {
      viewer.resize();
    },
  };
}
