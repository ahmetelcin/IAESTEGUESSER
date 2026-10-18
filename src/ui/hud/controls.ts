import { el } from '../dom';

export interface Controls {
  setBearing(degrees: number): void;
}

export function createControls(
  parent: HTMLElement,
  actions: { onReset: () => void; onZoomIn: () => void; onZoomOut: () => void },
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
  stack.append(
    button('controls__reset', '⟲', 'Başlangıca dön (R)', actions.onReset),
    button('controls__zoom', '+', 'Yakınlaştır (+)', actions.onZoomIn),
    button('controls__zoom', '−', 'Uzaklaştır (−)', actions.onZoomOut),
  );

  root.append(compass, stack);
  parent.append(root);

  return {
    setBearing(degrees) {
      // Rotate the dial opposite to the view so "K" (north) keeps pointing north.
      dial.style.transform = `rotate(${-degrees}deg)`;
    },
  };
}
