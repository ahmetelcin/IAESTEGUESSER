import qrcode from 'qrcode-generator';

/** QR code for a URL as inline SVG (generated locally, so it works offline on the stand). */
export function qrSvg(url: string): string {
  const qr = qrcode(0, 'M');
  qr.addData(url);
  qr.make();
  return qr.createSvgTag({ cellSize: 4, margin: 2, scalable: true });
}
