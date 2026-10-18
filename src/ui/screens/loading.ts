import { el } from '../dom';

export interface LoadingScreen {
  showError(message: string): void;
}

export function createLoadingScreen(root: HTMLElement): LoadingScreen {
  const screen = el('section', 'screen screen--loading');
  const spinner = el('div', 'loading__spinner');
  const text = el('p', 'loading__text', 'Konum yükleniyor…');
  screen.append(spinner, text);
  root.append(screen);

  return {
    showError(message) {
      root.dataset.state = 'loading';
      spinner.hidden = true;
      text.classList.add('is-error');
      text.textContent = message;
    },
  };
}
