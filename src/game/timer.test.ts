import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createTimer } from './timer';

describe('round timer', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('ticks down once per second and expires once', () => {
    const ticks: number[] = [];
    const onExpire = vi.fn();
    const t = createTimer({ onTick: (s) => ticks.push(s), onExpire });
    t.start(3);
    expect(ticks).toEqual([3]);
    vi.advanceTimersByTime(3000);
    expect(ticks).toEqual([3, 2, 1, 0]);
    expect(onExpire).toHaveBeenCalledTimes(1);
    vi.advanceTimersByTime(5000);
    expect(onExpire).toHaveBeenCalledTimes(1);
  });

  it('stops without expiring', () => {
    const onExpire = vi.fn();
    const t = createTimer({ onTick: () => {}, onExpire });
    t.start(2);
    vi.advanceTimersByTime(1000);
    t.stop();
    vi.advanceTimersByTime(5000);
    expect(onExpire).not.toHaveBeenCalled();
  });

  it('follows the wall clock even when ticks are delayed (throttled tab)', () => {
    const ticks: number[] = [];
    const onExpire = vi.fn();
    const t = createTimer({ onTick: (s) => ticks.push(s), onExpire });
    t.start(10);
    // Jump the clock 7 s ahead without running intermediate ticks, then let one tick fire.
    vi.setSystemTime(Date.now() + 7000);
    vi.advanceTimersToNextTimer();
    expect(ticks.at(-1)).toBeLessThanOrEqual(3);
    vi.setSystemTime(Date.now() + 5000);
    vi.advanceTimersToNextTimer();
    expect(onExpire).toHaveBeenCalledTimes(1);
  });

  it('restarting replaces the previous countdown', () => {
    const onExpire = vi.fn();
    const t = createTimer({ onTick: () => {}, onExpire });
    t.start(2);
    t.start(5);
    vi.advanceTimersByTime(4000);
    expect(onExpire).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1000);
    expect(onExpire).toHaveBeenCalledTimes(1);
  });
});
