import { el, scoreFormat } from '../dom';

/** Seconds left at which the timer turns red and blinks. */
const WARNING_SECONDS = 10;

export interface StatusBar {
  update(info: { round: number; totalRounds: number; score: number }): void;
  setTime(secondsLeft: number): void;
}

export function formatClock(seconds: number): string {
  const s = Math.max(0, seconds);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

export function createStatusBar(parent: HTMLElement): StatusBar {
  const root = el('div', 'hud-panel status-bar');
  const item = (label: string) => {
    const wrap = el('div', 'status-bar__item');
    const value = el('span', 'status-bar__value', '–');
    wrap.append(el('span', 'status-bar__label', label), value);
    root.append(wrap);
    return { wrap, value };
  };
  const round = item('Tur');
  const score = item('Puan');
  const time = item('Süre');
  parent.append(root);

  return {
    update(info) {
      round.value.textContent = `${info.round} / ${info.totalRounds}`;
      score.value.textContent = scoreFormat.format(info.score);
    },
    setTime(secondsLeft) {
      time.value.textContent = formatClock(secondsLeft);
      time.wrap.classList.toggle('is-warning', secondsLeft <= WARNING_SECONDS);
    },
  };
}
