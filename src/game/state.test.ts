import { describe, expect, it, vi } from 'vitest';
import { createStateMachine } from './state';

describe('state machine', () => {
  it('starts in the given state', () => {
    const sm = createStateMachine('loading');
    expect(sm.current).toBe('loading');
  });

  it('runs the single-round loop', () => {
    const sm = createStateMachine('loading');
    sm.transition('round');
    sm.transition('result');
    sm.transition('loading');
    expect(sm.current).toBe('loading');
  });

  it('allows the full game flow', () => {
    const sm = createStateMachine('menu');
    sm.transition('loading');
    sm.transition('round');
    sm.transition('result');
    sm.transition('summary');
    sm.transition('menu');
    expect(sm.current).toBe('menu');
  });

  it('opens the leaderboard and credits from the menu and comes back', () => {
    const sm = createStateMachine('menu');
    sm.transition('leaderboard');
    sm.transition('menu');
    sm.transition('credits');
    sm.transition('menu');
    expect(sm.current).toBe('menu');
  });

  it('does not start a game straight from the leaderboard or credits', () => {
    expect(() => createStateMachine('leaderboard').transition('loading')).toThrow();
    expect(() => createStateMachine('credits').transition('round')).toThrow();
  });

  it('rejects invalid transitions and keeps the state', () => {
    const sm = createStateMachine('loading');
    expect(() => sm.transition('result')).toThrow();
    expect(sm.current).toBe('loading');
  });

  it('notifies subscribers with from/to', () => {
    const sm = createStateMachine('loading');
    const listener = vi.fn();
    const unsubscribe = sm.subscribe(listener);
    sm.transition('round');
    expect(listener).toHaveBeenCalledWith('round', 'loading');
    unsubscribe();
    sm.transition('result');
    expect(listener).toHaveBeenCalledTimes(1);
  });
});
