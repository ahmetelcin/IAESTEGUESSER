import { el, scoreFormat } from '../dom';

export interface StatusBar {
  update(info: { round: number; totalRounds?: number; score: number }): void;
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
  time.wrap.hidden = true; // timer arrives in phase 2
  parent.append(root);

  return {
    update(info) {
      round.value.textContent = info.totalRounds
        ? `${info.round} / ${info.totalRounds}`
        : String(info.round);
      score.value.textContent = scoreFormat.format(info.score);
    },
  };
}
