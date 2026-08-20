import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  handleAdvance,
  mergeInventoryWithDefaults,
  mergeRouteVarsWithDefaults,
  resolveChapterPathIndex,
  wasDialoguePresentedAtCursor,
} from './engine';
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

const conditionalDialogueGame: GameData = {
  meta: { title: 'Conditional Dialogue Test' },
  settings: { textSpeed: 30, autoSave: true, clickToInstant: true },
  assets: { backgrounds: {}, characters: {}, music: {}, sfx: {} },
  state: { defaults: { found_clue: false } },
  script: [{ scene: 'intro' }],
  scenes: {
    intro: {
      actions: [
        {
          say: {
            when: { var: 'found_clue', op: 'eq', value: false },
            text: 'This route-only line stays hidden.',
          },
        },
        {
          say: {
            when: { var: 'found_clue', op: 'eq', value: true },
            text: 'The earlier clue changes this conversation.',
          },
        },
      ],
    },
  },
};

const characterPlacementGame: GameData = {
  meta: { title: 'Character Placement Test' },
  settings: { textSpeed: 30, autoSave: true, clickToInstant: true },
  assets: {
    backgrounds: {},
    characters: {
      코난: {
        base: '/characters/conan.webp',
        emotions: { serious: '/characters/conan-serious.webp' },
        placement: 'prompt-top',
      },
      덕만: { base: '/characters/deokman.webp' },
    },
    music: {},
    sfx: {},
  },
  script: [{ scene: 'intro' }],
  scenes: {
    intro: {
      actions: [
        { char: { id: '코난', position: 'left', emotion: 'serious' } },
        { char: { id: '덕만', position: 'right' } },
        { say: { char: '코난', with: ['덕만'], text: 'Two source styles share one stage.' } },
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
    useVNStore.getState().setRouteVars({});
    useVNStore.getState().setGame(game, '/');
    useVNStore.getState().setCursor('intro', 0);
  });

  it('skips false conditional dialogue without logging or pausing on it', () => {
    useVNStore.getState().setGame(conditionalDialogueGame, '/');
    useVNStore.getState().setRouteVars({ found_clue: true });
    useVNStore.getState().setCursor('intro', 0);

    handleAdvance();

    expect(useVNStore.getState()).toMatchObject({
      actionIndex: 1,
      waitingInput: true,
      dialog: { fullText: 'The earlier clue changes this conversation.' },
    });
    expect(useVNStore.getState().storyLog.map((entry) => entry.kind === 'dialogue' ? entry.text : ''))
      .toEqual(['The earlier clue changes this conversation.']);
  });

  afterEach(() => {
    vi.useRealTimers();
    Reflect.deleteProperty(globalThis, 'window');
    Reflect.deleteProperty(globalThis, 'localStorage');
    Reflect.deleteProperty(globalThis, 'requestAnimationFrame');
    Reflect.deleteProperty(globalThis, 'cancelAnimationFrame');
  });

  it('keeps chapter path jumps inside the original prepared sequence', () => {
    const paths = Array.from({ length: 12 }, (_, index) => `./${index}.yaml`);

    expect(resolveChapterPathIndex(paths, '/7.yaml')).toBe(7);
    expect(resolveChapterPathIndex(paths, './11.yaml')).toBe(11);
    expect(resolveChapterPathIndex(paths, '/missing.yaml')).toBe(-1);
  });

  it('recognizes a rendered conditional line by exact chapter cursor and text during restore', () => {
    const storyLog = [{
      kind: 'dialogue' as const,
      channel: 'dialogue' as const,
      text: 'The earlier route changes this conversation.',
      chapterPath: '/2.yaml',
      sceneId: 'reunion',
      actionIndex: 7,
    }];

    expect(wasDialoguePresentedAtCursor(
      storyLog,
      './2.yaml',
      'reunion',
      7,
      'The earlier route changes this conversation.',
    )).toBe(true);
    expect(wasDialoguePresentedAtCursor(
      storyLog,
      './3.yaml',
      'reunion',
      7,
      'The earlier route changes this conversation.',
    )).toBe(false);
    expect(wasDialoguePresentedAtCursor(
      storyLog,
      './2.yaml',
      'reunion',
      7,
      'A revised line at the same cursor.',
    )).toBe(false);
  });

  it('resolves each character asset placement without a game-level layout switch', () => {
    useVNStore.getState().setGame(characterPlacementGame, '/');
    useVNStore.getState().setCursor('intro', 0);

    handleAdvance();

    expect(useVNStore.getState().characters.left?.placement).toBe('prompt-top');
    expect(useVNStore.getState().characters.right?.placement).toBe('stage-bottom');
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
