import { TransitionMode, Viewer } from 'mapillary-js';
import 'mapillary-js/dist/mapillary.css';

export interface Panorama {
  /** Jumps to a new panorama without a cross-city transition animation. */
  show(imageId: string): Promise<void>;
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
    },
  });

  return {
    async show(imageId) {
      viewer.setTransitionMode(TransitionMode.Instantaneous);
      try {
        await viewer.moveTo(imageId);
      } finally {
        viewer.setTransitionMode(TransitionMode.Default);
      }
    },
    resize() {
      viewer.resize();
    },
  };
}
