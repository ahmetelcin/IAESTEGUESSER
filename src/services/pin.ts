export type PinResult = 'ok' | 'wrong' | 'locked' | 'unconfigured';

export interface PinGate {
  readonly configured: boolean;
  /** Timestamp (ms) until which every attempt is refused; 0 when not locked. */
  readonly lockedUntil: number;
  check(input: string, now?: number): PinResult;
}

const MAX_WRONG = 5;
const LOCK_MS = 30_000;

/**
 * Keeps passers-by out of the admin panel. The PIN ships inside the page, so this is a
 * deterrent at the stand, not real security.
 */
export function createPinGate(pin: string | undefined): PinGate {
  const configured = typeof pin === 'string' && /^\d{4}$/.test(pin);
  let wrong = 0;
  let lockedUntil = 0;

  return {
    configured,
    get lockedUntil() {
      return lockedUntil;
    },
    check(input, now = Date.now()) {
      if (!configured) return 'unconfigured';
      if (now < lockedUntil) return 'locked';
      if (input === pin) {
        wrong = 0;
        lockedUntil = 0;
        return 'ok';
      }
      wrong++;
      if (wrong >= MAX_WRONG) {
        wrong = 0;
        lockedUntil = now + LOCK_MS;
        return 'locked';
      }
      return 'wrong';
    },
  };
}
