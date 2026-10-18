export interface IdleWatcher {
  /** Call on any user activity; restarts the countdown. */
  poke(): void;
  stop(): void;
}

/** Calls `onIdle` once after `timeoutMs` without a `poke()`. */
export function createIdleWatcher(timeoutMs: number, onIdle: () => void): IdleWatcher {
  let handle: ReturnType<typeof setTimeout> | undefined;
  const stop = () => {
    if (handle !== undefined) clearTimeout(handle);
    handle = undefined;
  };
  return {
    poke() {
      stop();
      handle = setTimeout(() => {
        handle = undefined;
        onIdle();
      }, timeoutMs);
    },
    stop,
  };
}
