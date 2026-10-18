import L from 'leaflet';
import { TILE_ATTRIBUTION, TILE_URL } from '../../config';
import type { LatLng } from '../../game/geo';
import { el } from '../dom';
import { guessIcon } from '../pins';

type Size = 's' | 'm' | 'l';
const SIZES: { id: Size; label: string; title: string }[] = [
  { id: 's', label: 'K', title: 'Küçük' },
  { id: 'm', label: 'O', title: 'Orta' },
  { id: 'l', label: 'B', title: 'Büyük' },
];
const COLLAPSE_DELAY_MS = 350;

export interface MiniMap {
  /** Normalized guess (longitude wrapped to [-180, 180)), or null. */
  readonly guess: LatLng | null;
  reset(): void;
  /** Starting view for the current map (world, a country, a city). */
  setHome(center: [number, number], zoom: number): void;
  /** Keyboard shortcut (M): expand or collapse without hovering. */
  toggle(): void;
}

export function createMiniMap(
  parent: HTMLElement,
  onGuess: () => void,
): MiniMap {
  const root = el('div', 'minimap size-m');
  const toolbar = el('div', 'minimap__toolbar');
  const mapEl = el('div', 'minimap__map');
  const guessBtn = el('button', 'btn btn--primary minimap__guess', 'TAHMİN ET');
  guessBtn.type = 'button';
  guessBtn.disabled = true;

  const sizeBtns = SIZES.map(({ id, label, title }) => {
    const b = el('button', 'minimap__tool', label);
    b.type = 'button';
    b.title = title;
    b.addEventListener('click', () => setSize(id));
    return { id, b };
  });
  const pinBtn = el('button', 'minimap__tool minimap__pin-toggle', '📌');
  pinBtn.type = 'button';
  pinBtn.title = 'Sabitle';
  toolbar.append(...sizeBtns.map((s) => s.b), pinBtn);
  root.append(toolbar, mapEl, guessBtn);
  parent.append(root);

  const map = L.map(mapEl, {
    center: [25, 10],
    zoom: 1,
    minZoom: 1,
    worldCopyJump: true,
    zoomControl: false,
    attributionControl: true,
  });
  L.tileLayer(TILE_URL, { attribution: TILE_ATTRIBUTION, maxZoom: 19 }).addTo(map);
  map.attributionControl.setPrefix(false);

  // Keep Leaflet in sync while the container animates between sizes.
  new ResizeObserver(() => map.invalidateSize({ pan: false })).observe(mapEl);

  let home: { center: [number, number]; zoom: number } = { center: [25, 10], zoom: 1 };
  let marker: L.Marker | null = null;
  let guess: LatLng | null = null;
  let pinned = false;
  let collapseTimer: number | undefined;

  function setSize(size: Size) {
    root.classList.remove('size-s', 'size-m', 'size-l');
    root.classList.add(`size-${size}`);
    sizeBtns.forEach(({ id, b }) => b.classList.toggle('is-active', id === size));
  }
  setSize('m');

  const expand = () => {
    window.clearTimeout(collapseTimer);
    root.classList.add('is-expanded');
  };
  const collapse = () => {
    if (pinned) return;
    collapseTimer = window.setTimeout(() => root.classList.remove('is-expanded'), COLLAPSE_DELAY_MS);
  };
  root.addEventListener('mouseenter', expand);
  root.addEventListener('mouseleave', collapse);

  pinBtn.addEventListener('click', () => {
    pinned = !pinned;
    pinBtn.classList.toggle('is-active', pinned);
    root.classList.toggle('is-pinned', pinned);
    if (pinned) expand();
  });

  map.on('click', (e: L.LeafletMouseEvent) => {
    // Show the pin where the user clicked (may be on a world copy), store the wrapped value.
    const wrapped = e.latlng.wrap();
    guess = { lat: wrapped.lat, lng: wrapped.lng };
    if (marker) marker.setLatLng(e.latlng);
    else marker = L.marker(e.latlng, { icon: guessIcon, keyboard: false }).addTo(map);
    guessBtn.disabled = false;
  });

  guessBtn.addEventListener('click', () => {
    if (guess) onGuess();
  });

  return {
    get guess() {
      return guess;
    },
    toggle() {
      window.clearTimeout(collapseTimer);
      if (root.classList.contains('is-expanded') && !pinned) root.classList.remove('is-expanded');
      else root.classList.add('is-expanded');
    },
    setHome(center, zoom) {
      home = { center, zoom };
    },
    reset() {
      marker?.remove();
      marker = null;
      guess = null;
      guessBtn.disabled = true;
      map.setView(home.center, home.zoom, { animate: false });
      if (!pinned) root.classList.remove('is-expanded');
    },
  };
}
