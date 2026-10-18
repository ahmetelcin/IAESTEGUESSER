import { ROUNDS_PER_GAME } from '../../config';
import { MAP_INFO, isPlayable } from '../../data/maps';
import type { Mode } from '../../game/modes';
import type { MapId } from '../../game/scoring';
import { el } from '../dom';

export interface MenuChoice {
  name: string;
  mapId: MapId;
  mode: Mode;
}

export interface MenuScreen {
  /** Fresh menu for a new player (clears the name). */
  show(): void;
  /** Back from a sub-screen: keeps the typed name and picks. */
  resume(): void;
  /** Currently picked map and mode (the leaderboard opens on them). */
  readonly picks: { mapId: MapId; mode: Mode };
}

interface Option<T extends string> {
  value: T;
  label: string;
  hint?: string;
  soon?: boolean;
}

const MAP_OPTIONS: Option<MapId>[] = (Object.keys(MAP_INFO) as MapId[]).map((value) => ({
  value,
  label: MAP_INFO[value].label,
  soon: !isPlayable(value, ROUNDS_PER_GAME),
}));

const MODE_OPTIONS: Option<Mode>[] = [
  { value: 'moving', label: 'Hareketli', hint: 'Sokaklarda gezin' },
  { value: 'no-move', label: 'Hareketsiz', hint: 'Yerinde dön' },
  { value: 'nmpz', label: 'NMPZ', hint: 'Hareket, dönme, zoom yok' },
];

export const NAME_MAX_LENGTH = 16;

function segmented<T extends string>(title: string, options: Option<T>[], onChange: (v: T) => void) {
  const group = el('fieldset', 'menu__group');
  group.append(el('legend', 'menu__label', title));
  const row = el('div', 'segmented');
  const buttons = options.map((o, i) => {
    const b = el('button', 'segmented__opt');
    b.type = 'button';
    b.append(el('span', 'segmented__title', o.label));
    if (o.hint) b.append(el('span', 'segmented__hint', o.hint));
    if (o.soon) {
      b.disabled = true;
      b.append(el('span', 'badge', 'Yakında'));
    }
    b.classList.toggle('is-active', i === 0);
    b.setAttribute('aria-pressed', String(i === 0));
    b.addEventListener('click', () => {
      buttons.forEach((x) => {
        x.classList.toggle('is-active', x === b);
        x.setAttribute('aria-pressed', String(x === b));
      });
      onChange(o.value);
    });
    return b;
  });
  row.append(...buttons);
  group.append(row);
  return group;
}

export function createMenuScreen(
  root: HTMLElement,
  actions: { onPlay: (choice: MenuChoice) => void; onLeaderboard: () => void; onCredits: () => void },
): MenuScreen {
  const screen = el('section', 'screen screen--menu');
  const main = el('div', 'menu__main');

  const brand = el('header', 'menu__brand');
  brand.append(
    el('span', 'menu__kicker', 'IAESTE'),
    el('h1', 'menu__title', 'Stajyer Nerede?'),
    el('p', 'menu__tagline', 'Sokağa bak, haritada bul. Stajın nerede olurdu?'),
  );

  const form = el('form', 'hud-panel menu__form');
  form.noValidate = true;

  const nameGroup = el('label', 'menu__group');
  nameGroup.append(el('span', 'menu__label', 'Adın'));
  const nameInput = el('input', 'menu__input');
  nameInput.type = 'text';
  nameInput.placeholder = 'Adını yaz';
  nameInput.maxLength = NAME_MAX_LENGTH;
  nameInput.autocomplete = 'off';
  nameInput.spellcheck = false;
  nameGroup.append(nameInput);

  let mapId: MapId = 'world';
  let mode: Mode = 'moving';
  const mapGroup = segmented('Harita', MAP_OPTIONS, (v) => (mapId = v));
  const modeGroup = segmented('Mod', MODE_OPTIONS, (v) => (mode = v));

  const playBtn = el('button', 'btn btn--primary menu__play', 'OYNA');
  playBtn.type = 'submit';
  playBtn.disabled = true;

  form.append(nameGroup, mapGroup, modeGroup, playBtn);

  const links = el('nav', 'menu__links');
  const link = (text: string, onClick: () => void) => {
    const b = el('button', 'btn menu__link', text);
    b.type = 'button';
    b.addEventListener('click', onClick);
    return b;
  };
  links.append(link('🏆 LİDERLİK TABLOSU', actions.onLeaderboard), link('📷 GÖRÜNTÜ KAYNAKLARI', actions.onCredits));
  main.append(brand, form, links);

  screen.append(main);
  root.append(screen);

  const cleanName = () => nameInput.value.trim().replace(/\s+/g, ' ');
  nameInput.addEventListener('input', () => {
    playBtn.disabled = cleanName().length === 0;
  });
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const name = cleanName();
    if (!name) {
      nameInput.focus();
      return;
    }
    actions.onPlay({ name, mapId, mode });
  });

  return {
    get picks() {
      return { mapId, mode };
    },
    resume() {
      requestAnimationFrame(() => nameInput.focus({ preventScroll: true }));
    },
    show() {
      nameInput.value = '';
      playBtn.disabled = true;
      // Wait a frame so the screen is visible before focusing.
      requestAnimationFrame(() => nameInput.focus({ preventScroll: true }));
    },
  };
}
