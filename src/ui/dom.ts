export function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  className?: string,
  text?: string,
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

export function animateNumber(
  node: HTMLElement,
  to: number,
  durationMs: number,
  format: (n: number) => string = (n) => String(Math.round(n)),
): void {
  const start = performance.now();
  const step = (now: number) => {
    const t = Math.min(1, (now - start) / durationMs);
    const eased = 1 - (1 - t) ** 3;
    node.textContent = format(to * eased);
    if (t < 1) requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
}

export const scoreFormat = new Intl.NumberFormat('tr-TR', { maximumFractionDigits: 0 });
