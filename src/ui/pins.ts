import L from 'leaflet';

const pin = (variant: 'guess' | 'actual') =>
  L.divIcon({
    className: `pin pin--${variant}`,
    html: '<span class="pin__dot"></span>',
    iconSize: [22, 22],
    iconAnchor: [11, 11],
  });

export const guessIcon = pin('guess');
export const actualIcon = pin('actual');
