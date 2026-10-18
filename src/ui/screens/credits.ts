import { tallyPhotographers } from '../../data/credits';
import { MAPS } from '../../data/maps';
import { el, scoreFormat } from '../dom';

export interface CreditsScreen {
  show(): void;
}

/** "Görüntü kaynakları": every Mapillary photographer whose images are in the game. */
export function createCreditsScreen(root: HTMLElement, onBack: () => void): CreditsScreen {
  const screen = el('section', 'screen screen--credits');
  const panel = el('div', 'hud-panel credits');

  const header = el('header', 'board-screen__header');
  const back = el('button', 'btn board-screen__back', '← MENÜ');
  back.type = 'button';
  back.addEventListener('click', onBack);
  header.append(el('h2', 'board-screen__title', 'Görüntü kaynakları'), back);

  const photographers = tallyPhotographers(Object.values(MAPS));
  const totalImages = photographers.reduce((n, p) => n + p.images, 0);

  const intro = el('p', 'credits__intro');
  intro.innerHTML =
    'Sokak görüntüleri <strong>Mapillary</strong> topluluğunun katkısıdır ve ' +
    '<strong>CC BY-SA 4.0</strong> lisansıyla kullanılır. Oyundaki ' +
    `${scoreFormat.format(totalImages)} görüntüyü paylaşan ${photographers.length} fotoğrafçıya teşekkürler.`;

  const list = el('ul', 'credits__list');
  for (const p of photographers) {
    const li = el('li', 'credits__item');
    li.append(el('span', 'credits__name', p.name), el('span', 'credits__count', String(p.images)));
    list.append(li);
  }

  const maps = el(
    'p',
    'credits__note',
    'Harita: Esri, HERE, Garmin, USGS ve OpenStreetMap katkıcıları. Tur sırasında fotoğrafçı adı ' +
      'ipucu vermesin diye gizlenir; tahminden sonra sonuç ekranında gösterilir.',
  );

  panel.append(header, intro, list, maps);
  screen.append(panel);
  root.append(screen);

  return {
    show() {
      panel.scrollTop = 0;
      requestAnimationFrame(() => back.focus({ preventScroll: true }));
    },
  };
}
