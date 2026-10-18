import { SETTINGS_LIMITS, type Settings, type SettingsStore } from '../../services/settings';
import { dayKey, leaderboardCsv, type Leaderboard } from '../../services/leaderboard';
import type { PinGate } from '../../services/pin';
import { el } from '../dom';

/** Shown in the panel; keep in sync with the keydown check in main.ts. */
export const ADMIN_SHORTCUT = 'Ctrl+Shift+F8';

export interface AdminPanel {
  readonly isOpen: boolean;
  open(): void;
  close(): void;
  toggle(): void;
}

/** Staff-only overlay (Ctrl+Shift+F8 or #admin, behind a PIN): stand settings and scores. */
export function createAdminPanel(
  root: HTMLElement,
  deps: { settings: SettingsStore; leaderboard: Leaderboard; pin: PinGate; onChange: () => void },
): AdminPanel {
  const overlay = el('div', 'admin');
  overlay.hidden = true;
  const panel = el('div', 'hud-panel admin__panel');
  panel.setAttribute('role', 'dialog');
  panel.setAttribute('aria-label', 'Yönetim paneli');

  const header = el('header', 'admin__header');
  const closeBtn = el('button', 'admin__close', '×');
  closeBtn.type = 'button';
  closeBtn.title = 'Kapat (Esc)';
  header.append(el('h2', 'admin__title', 'Yönetim paneli'), closeBtn);

  // ── Settings ──
  const form = el('form', 'admin__section');
  form.noValidate = true;
  const numberField = (label: string, key: keyof Settings, unit: string) => {
    const wrap = el('label', 'admin__field');
    const input = el('input', 'admin__input');
    input.type = 'number';
    const [min, max] = SETTINGS_LIMITS[key];
    input.min = String(min);
    input.max = String(max);
    input.step = '1';
    wrap.append(el('span', 'admin__label', label), input, el('span', 'admin__unit', `${unit} (${min}–${max})`));
    return { wrap, input };
  };
  const rounds = numberField('Tur sayısı', 'rounds', 'tur');
  const seconds = numberField('Tur süresi', 'roundSeconds', 'sn');
  const saveBtn = el('button', 'btn btn--primary', 'KAYDET');
  saveBtn.type = 'submit';
  const status = el('span', 'admin__status');
  status.setAttribute('aria-live', 'polite');
  const formRow = el('div', 'admin__row');
  formRow.append(saveBtn, status);
  form.append(el('h3', 'admin__subtitle', 'Oyun'), rounds.wrap, seconds.wrap, formRow);

  // ── Scores ──
  const scores = el('section', 'admin__section');
  const count = el('p', 'admin__count');
  const csvBtn = el('button', 'btn admin__btn', 'CSV İNDİR');
  csvBtn.type = 'button';
  const clearBtn = el('button', 'btn admin__btn admin__btn--danger', 'SKORLARI SİL');
  clearBtn.type = 'button';
  const confirmRow = el('div', 'admin__confirm');
  confirmRow.hidden = true;
  const confirmYes = el('button', 'btn admin__btn admin__btn--danger', 'EVET, SİL');
  confirmYes.type = 'button';
  const confirmNo = el('button', 'btn admin__btn', 'VAZGEÇ');
  confirmNo.type = 'button';
  confirmRow.append(el('span', '', 'Tüm skorlar kalıcı olarak silinsin mi?'), confirmYes, confirmNo);
  const scoreRow = el('div', 'admin__row');
  scoreRow.append(csvBtn, clearBtn);
  scores.append(el('h3', 'admin__subtitle', 'Skorlar'), count, scoreRow, confirmRow);

  const hint = el('p', 'admin__hint', `Kısayol: ${ADMIN_SHORTCUT} · Kapat: Esc`);

  // ── PIN step (every time the panel opens) ──
  const lock = el('form', 'admin__section admin__lock');
  lock.noValidate = true;
  const pinInput = el('input', 'admin__input admin__pin');
  pinInput.type = 'password';
  pinInput.inputMode = 'numeric';
  pinInput.maxLength = 4;
  pinInput.autocomplete = 'off';
  pinInput.setAttribute('aria-label', 'PIN');
  const pinMsg = el('p', 'admin__pin-msg');
  pinMsg.setAttribute('aria-live', 'polite');
  lock.append(el('h3', 'admin__subtitle', 'PIN'), pinInput, pinMsg);
  const content = el('div', 'admin__content');
  content.append(form, scores);

  panel.append(header, lock, content, hint);

  const unlock = (on: boolean) => {
    lock.hidden = on;
    content.hidden = !on;
  };
  const tryPin = () => {
    const result = deps.pin.check(pinInput.value);
    if (result === 'ok') {
      unlock(true);
      refresh();
      rounds.input.focus();
      return;
    }
    pinInput.value = '';
    if (result === 'wrong') pinMsg.textContent = 'Hatalı PIN.';
    else if (result === 'locked') {
      const secs = Math.max(1, Math.ceil((deps.pin.lockedUntil - Date.now()) / 1000));
      pinMsg.textContent = `Çok fazla hatalı deneme — ${secs} sn bekleyin.`;
    }
  };
  pinInput.addEventListener('input', () => {
    pinInput.value = pinInput.value.replace(/\D/g, '');
    if (pinInput.value.length === 4) tryPin();
  });
  lock.addEventListener('submit', (e) => {
    e.preventDefault();
    tryPin();
  });
  overlay.append(panel);
  root.append(overlay);

  let statusTimer: number | undefined;
  const flash = (text: string) => {
    status.textContent = text;
    window.clearTimeout(statusTimer);
    statusTimer = window.setTimeout(() => (status.textContent = ''), 2500);
  };

  function refresh() {
    const s = deps.settings.get();
    rounds.input.value = String(s.rounds);
    seconds.input.value = String(s.roundSeconds);
    const total = deps.leaderboard.all().length;
    count.textContent = total === 0 ? 'Kayıtlı skor yok.' : `${total} kayıtlı skor.`;
    csvBtn.disabled = clearBtn.disabled = total === 0;
    confirmRow.hidden = true;
    scoreRow.hidden = false;
  }

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const saved = deps.settings.set({
      rounds: rounds.input.valueAsNumber,
      roundSeconds: seconds.input.valueAsNumber,
    });
    rounds.input.value = String(saved.rounds);
    seconds.input.value = String(saved.roundSeconds);
    flash('Kaydedildi — sonraki oyundan itibaren geçerli.');
    deps.onChange();
  });

  csvBtn.addEventListener('click', () => {
    const blob = new Blob([leaderboardCsv(deps.leaderboard.all())], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = el('a');
    a.href = url;
    a.download = `stajyer-nerede-skorlar-${dayKey(new Date())}.csv`;
    document.body.append(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  });

  clearBtn.addEventListener('click', () => {
    scoreRow.hidden = true;
    confirmRow.hidden = false;
    confirmNo.focus();
  });
  confirmNo.addEventListener('click', refresh);
  confirmYes.addEventListener('click', () => {
    deps.leaderboard.clear();
    refresh();
    count.textContent = 'Skorlar silindi.';
    deps.onChange();
  });

  const api: AdminPanel = {
    get isOpen() {
      return !overlay.hidden;
    },
    open() {
      unlock(false);
      pinInput.value = '';
      pinInput.disabled = !deps.pin.configured;
      pinMsg.textContent = deps.pin.configured
        ? '4 haneli PIN’i girin.'
        : 'PIN tanımlı değil — .env dosyasına 4 haneli VITE_ADMIN_PIN ekleyip yeniden derleyin.';
      overlay.hidden = false;
      // Next frame, so it runs after any focus a screen queued the same way (menu's name field).
      requestAnimationFrame(() => pinInput.focus());
    },
    close() {
      overlay.hidden = true;
      if (location.hash === '#admin') history.replaceState(null, '', location.pathname + location.search);
    },
    toggle() {
      if (api.isOpen) api.close();
      else api.open();
    },
  };

  closeBtn.addEventListener('click', () => api.close());
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) api.close();
  });
  return api;
}
