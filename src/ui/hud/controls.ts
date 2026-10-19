import type { ModeRules } from '../../game/modes';
import { el } from '../dom';

export interface Controls {
  setBearing(degrees: number): void;
  /** Hides buttons the current mode doesn't allow. */
  setRules(rules: ModeRules): void;
  setSound(enabled: boolean): void;
}

export function createControls(
  parent: HTMLElement,
  actions: { onReset: () => void; onZoomIn: () => void; onZoomOut: () => void; onSound: () => void },
): Controls {
  const root = el('div', 'controls');

  const compass = el('div', 'hud-panel compass');
  compass.title = 'Pusula';
  const dial = el('div', 'compass__dial');
  dial.innerHTML =
    '<span class="compass__n">K</span><span class="compass__needle"></span>';
  compass.append(dial);

  const button = (cls: string, label: string, title: string, onClick: () => void) => {
    const b = el('button', `hud-panel controls__btn ${cls}`, label);
    b.type = 'button';
    b.title = title;
    b.addEventListener('click', onClick);
    return b;
  };

  const stack = el('div', 'controls__stack');
  const resetBtn = button('controls__reset', '⟲', 'Başlangıca dön (R)', actions.onReset);
  const zoomIn = button('controls__zoom', '+', 'Yakınlaştır (+)', actions.onZoomIn);
  const zoomOut = button('controls__zoom', '−', 'Uzaklaştır (−)', actions.onZoomOut);
  const soundBtn = button('controls__sound', '🔊', 'Ses', actions.onSound);
  stack.append(resetBtn, zoomIn, zoomOut, soundBtn);

  root.append(compass, stack);
  parent.append(root);

  return {
    setRules({ move, pan, zoom }) {
      // Reset is useful after walking or turning; NMPZ allows neither.
      resetBtn.hidden = !move && !pan;
      zoomIn.hidden = zoomOut.hidden = !zoom;
    },
    setSound(enabled) {
      soundBtn.textContent = enabled ? '🔊' : '🔇';
      soundBtn.title = enabled ? 'Sesi kapat' : 'Sesi aç';
    },
    setBearing(degrees) {
      // Rotate the dial opposite to the view so "K" (north) keeps pointing north.
      dial.style.transform = `rotate(${-degrees}deg)`;
    },
  };
}
