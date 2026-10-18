import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createIdleWatcher } from './idle';

describe('idle watcher', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('fires once after the timeout without activity', () => {
    const onIdle = vi.fn();
    const w = createIdleWatcher(60_000, onIdle);
    w.poke();
    vi.advanceTimersByTime(59_999);
    expect(onIdle).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(onIdle).toHaveBeenCalledTimes(1);
    vi.advanceTimersByTime(120_000);
    expect(onIdle).toHaveBeenCalledTimes(1);
  });

  it('activity restarts the countdown', () => {
    const onIdle = vi.fn();
    const w = createIdleWatcher(60_000, onIdle);
    w.poke();
    vi.advanceTimersByTime(50_000);
    w.poke();
    vi.advanceTimersByTime(50_000);
    expect(onIdle).not.toHaveBeenCalled();
    vi.advanceTimersByTime(10_000);
    expect(onIdle).toHaveBeenCalledTimes(1);
  });

  it('can be stopped', () => {
    const onIdle = vi.fn();
    const w = createIdleWatcher(1000, onIdle);
    w.poke();
    w.stop();
    vi.advanceTimersByTime(5000);
    expect(onIdle).not.toHaveBeenCalled();
  });
});
