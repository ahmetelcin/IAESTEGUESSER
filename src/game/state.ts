export type GameState = 'menu' | 'loading' | 'round' | 'result' | 'summary' | 'leaderboard' | 'credits';

const TRANSITIONS: Record<GameState, readonly GameState[]> = {
  menu: ['loading', 'leaderboard', 'credits'],
  loading: ['round', 'menu'],
  round: ['result', 'menu'],
  result: ['loading', 'summary', 'menu'],
  summary: ['menu', 'loading'],
  leaderboard: ['menu'],
  credits: ['menu'],
};

type Listener = (to: GameState, from: GameState) => void;

export interface StateMachine {
  readonly current: GameState;
  canTransition(to: GameState): boolean;
  transition(to: GameState): void;
  subscribe(listener: Listener): () => void;
}

export function createStateMachine(initial: GameState): StateMachine {
  let current = initial;
  const listeners = new Set<Listener>();

  return {
    get current() {
      return current;
    },
    canTransition(to) {
      return TRANSITIONS[current].includes(to);
    },
    transition(to) {
      if (!TRANSITIONS[current].includes(to)) {
        throw new Error(`Invalid transition: ${current} -> ${to}`);
      }
      const from = current;
      current = to;
      listeners.forEach((l) => l(to, from));
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}
