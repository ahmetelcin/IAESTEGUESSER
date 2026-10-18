import L from 'leaflet';

const pin = (variant: 'guess' | 'actual', label = '') =>
  L.divIcon({
    className: `pin pin--${variant}`,
    html: `<span class="pin__dot">${label}</span>`,
    iconSize: [22, 22],
    iconAnchor: [11, 11],
  });

export const guessIcon = pin('guess');
export const actualIcon = pin('actual');
/** Actual-location pin labelled with its round number (summary map). */
export const roundIcon = (round: number) => pin('actual', String(round));
