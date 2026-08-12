import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { handleAdvance, mergeInventoryWithDefaults, mergeRouteVarsWithDefaults } from './engine';
import { useVNStore } from './store';
import type { GameData } from './types';

class MemoryStorage implements Storage {
  private values = new Map<string, string>();

  get length(): number {
    return this.values.size;
  }

  clear(): void {
    this.values.clear();
  }

  getItem(key: string): string | null {
    return this.values.get(key) ?? null;
  }

  key(index: number): string | null {
    return [...this.values.keys()][index] ?? null;
  }

  removeItem(key: string): void {
    this.values.delete(key);
  }

  setItem(key: string, value: string): void {
    this.values.set(key, value);
  }
}

const game: GameData = {
  meta: { title: 'Effect Safety Test' },
  settings: { textSpeed: 30, autoSave: true, clickToInstant: true },
  assets: { backgrounds: {}, characters: {}, music: {}, sfx: {} },
  script: [{ scene: 'intro' }],
  scenes: {
    intro: {
      actions: [
        { effect: { name: 'shake', wait: true } },
        { say: { text: 'The effect has finished.' } },
      ],
    },
  },
};

const unskippableGame: GameData = {
  meta: { title: 'Unskippable Dialogue Test' },
  settings: { textSpeed: 10, autoSave: true, clickToInstant: true },
  assets: { backgrounds: {}, characters: {}, music: {}, sfx: {} },
  script: [{ scene: 'intro' }],
  scenes: {
    intro: {
      actions: [
        { say: { text: 'Read every word.', unskippable: true } },
        { say: { text: 'The next line.' } },
      ],
    },
  },
};

const autoAdvancingUnskippableGame: GameData = {
  meta: { title: 'Auto-advancing Unskippable Dialogue Test' },
  settings: { textSpeed: 1, autoSave: true, clickToInstant: true },
  assets: { backgrounds: {}, characters: {}, music: {}, sfx: {} },
  script: [{ scene: 'intro' }],
  scenes: {
    intro: {
      actions: [
        { say: { text: 'Do not cut this sentence short.', unskippable: true, autoAdvance: 1 } },
        { say: { text: 'The automatic next line.' } },
      ],
    },
  },
};

describe('engine runtime safety', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    Object.defineProperty(globalThis, 'window', {
      configurable: true,
      value: globalThis,
    });
    Object.defineProperty(globalThis, 'localStorage', {
      configurable: true,
      value: new MemoryStorage(),
    });
    Object.defineProperty(globalThis, 'requestAnimationFrame', {
      configurable: true,
      value: (callback: FrameRequestCallback) =>
        setTimeout(() => callback(performance.now()), 16) as unknown as number,
    });
    Object.defineProperty(globalThis, 'cancelAnimationFrame', {
      configurable: true,
      value: (frameId: number) => clearTimeout(frameId),
    });
    useVNStore.getState().resetPresentation();
    useVNStore.getState().setGame(game, '/');
    useVNStore.getState().setCursor('intro', 0);
  });

  afterEach(() => {
    vi.useRealTimers();
    Reflect.deleteProperty(globalThis, 'window');
    Reflect.deleteProperty(globalThis, 'localStorage');
    Reflect.deleteProperty(globalThis, 'requestAnimationFrame');
    Reflect.deleteProperty(globalThis, 'cancelAnimationFrame');
  });

  it('holds input and script progression until a blocking effect completes', () => {
    handleAdvance();

    expect(useVNStore.getState()).toMatchObject({
      actionIndex: 0,
      busy: true,
      effect: 'shake',
      waitingInput: false,
    });

    vi.advanceTimersByTime(280);
    expect(useVNStore.getState()).toMatchObject({
      actionIndex: 1,
      busy: false,
      effect: undefined,
      waitingInput: false,
    });

    vi.advanceTimersByTime(16);
    expect(useVNStore.getState()).toMatchObject({
      actionIndex: 1,
      busy: false,
      waitingInput: true,
    });
    expect(useVNStore.getState().dialog.fullText).toBe('The effect has finished.');
  });

  it('ignores advance input until an unskippable line finishes typing', () => {
    useVNStore.getState().setGame(unskippableGame, '/');
    useVNStore.getState().setCursor('intro', 0);

    handleAdvance();

    expect(useVNStore.getState()).toMatchObject({
      actionIndex: 0,
      waitingInput: true,
      dialog: {
        fullText: 'Read every word.',
        visibleText: '',
        typing: true,
        unskippable: true,
      },
    });

    handleAdvance();

    expect(useVNStore.getState()).toMatchObject({
      actionIndex: 0,
      waitingInput: true,
      dialog: { typing: true, unskippable: true },
    });

    vi.runAllTimers();

    expect(useVNStore.getState()).toMatchObject({
      actionIndex: 0,
      waitingInput: true,
      dialog: {
        visibleText: 'Read every word.',
        typing: false,
        unskippable: false,
      },
    });

    handleAdvance();

    expect(useVNStore.getState()).toMatchObject({
      actionIndex: 1,
      waitingInput: true,
      dialog: { fullText: 'The next line.' },
    });
  });

  it('waits for unskippable typing before an earlier auto-advance can run', () => {
    useVNStore.getState().setGame(autoAdvancingUnskippableGame, '/');
    useVNStore.getState().setCursor('intro', 0);

    handleAdvance();
    vi.advanceTimersByTime(1);

    expect(useVNStore.getState()).toMatchObject({
      actionIndex: 0,
      waitingInput: true,
      dialog: { typing: true, unskippable: true },
    });

    vi.runAllTimers();

    expect(useVNStore.getState()).toMatchObject({
      actionIndex: 1,
      waitingInput: true,
      dialog: { fullText: 'The automatic next line.' },
    });
  });

  it('repairs declared type changes without dropping route state carried across chapters', () => {
    expect(
      mergeRouteVarsWithDefaults(
        { score: 0, stable: 0, route: 'common', cleared: false },
        { score: 'old-type', stable: 'old-type', removed: true },
        { score: 4, route: 'saved', cleared: true },
      ),
    ).toEqual({ score: 4, stable: 0, route: 'saved', cleared: true, removed: true });

    expect(
      mergeInventoryWithDefaults(
        {
          current_clue: { name: 'Current clue' },
          new_clue: { name: 'New clue' },
        },
        { removed_clue: true, current_clue: true },
        { current_clue: false },
      ),
    ).toEqual({ removed_clue: true, current_clue: false, new_clue: false });
  });
});
