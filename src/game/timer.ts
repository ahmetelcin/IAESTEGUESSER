export interface Timer {
  start(seconds: number): void;
  stop(): void;
}

/** Checked more often than once a second so the display never lags a full second. */
const TICK_MS = 250;

/**
 * Countdown measured against a fixed deadline, so delayed or throttled ticks
 * (background tab, heavy WebGL frames) can't make it drift behind real time.
 */
export function createTimer(handlers: {
  onTick: (secondsLeft: number) => void;
  onExpire: () => void;
}): Timer {
  let handle: ReturnType<typeof setInterval> | undefined;

  const stop = () => {
    if (handle !== undefined) clearInterval(handle);
    handle = undefined;
  };

  return {
    start(seconds) {
      stop();
      const deadline = Date.now() + seconds * 1000;
      let shown = seconds;
      handlers.onTick(shown);
      handle = setInterval(() => {
        const left = Math.max(0, Math.ceil((deadline - Date.now()) / 1000));
        if (left !== shown) {
          shown = left;
          handlers.onTick(left);
        }
        if (left === 0) {
          stop();
          handlers.onExpire();
        }
      }, TICK_MS);
    },
    stop,
  };
}
