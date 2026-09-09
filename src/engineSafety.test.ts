import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  handleAdvance,
  mergeInventoryWithDefaults,
  mergeRouteVarsWithDefaults,
  resolveChapterPathIndex,
  setPlayerAutoPlayPaused,
  setPlayerExperienceSettings,
  setScenePresentationPaused,
  submitChoiceOption,
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

const fastTypingGame: GameData = {
  meta: { title: 'Frame-aligned Typing Test' },
  settings: { textSpeed: 1000, autoSave: true, clickToInstant: true },
  assets: { backgrounds: {}, characters: {}, music: {}, sfx: {} },
  script: [{ scene: 'intro' }],
  scenes: {
    intro: {
      actions: [{ say: { text: 'abcdefghij' } }],
    },
  },
};

const playerAutoPlayGame: GameData = {
  meta: { title: 'Player Auto Mode Test' },
  settings: { textSpeed: 1000, autoSave: true, clickToInstant: true },
  assets: { backgrounds: {}, characters: {}, music: {}, sfx: {} },
  script: [{ scene: 'intro' }],
  scenes: {
    intro: {
      actions: [
        { say: { text: 'A' } },
        { choice: { prompt: 'Choose', options: [{ text: 'Stay here' }] } },
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
    let animationFrameTimestamp = performance.now();
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
        setTimeout(() => {
          animationFrameTimestamp += 16;
          callback(animationFrameTimestamp);
        }, 16) as unknown as number,
    });
    Object.defineProperty(globalThis, 'cancelAnimationFrame', {
      configurable: true,
      value: (frameId: number) => clearTimeout(frameId),
    });
    useVNStore.getState().resetPresentation();
    useVNStore.getState().setRouteVars({});
    useVNStore.getState().setGame(game, '/');
    useVNStore.getState().setCursor('intro', 0);
    setPlayerAutoPlayPaused(false);
    setPlayerExperienceSettings({
      autoPlayEnabled: false,
      autoPlayDelayMs: 800,
      textSpeedRate: 1,
      effectLevel: 'full',
    });
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

  it('requires a deliberate action after typing and pauses AUTO until the player acts', () => {
    useVNStore.getState().setGame({ ...game, scenes: { intro: { actions: [
      { say: { channel: 'thought', text: 'A noise behind the door.', continueLabel: 'Open the door' } },
      { say: { channel: 'action', text: 'Cold air rushes in.' } },
      { choice: { prompt: 'Which way?', options: [{ text: 'Left' }] } },
    ] } } }, '/');
    setPlayerExperienceSettings({ autoPlayEnabled: true, autoPlayDelayMs: 800 });
    handleAdvance();
    handleAdvance(true); // A click during typing only reveals the text.
    expect(useVNStore.getState()).toMatchObject({ actionIndex: 0, dialog: { typing: false } });
    vi.advanceTimersByTime(5000);
    handleAdvance();
    expect(useVNStore.getState().actionIndex).toBe(0);
    setScenePresentationPaused(true);
    handleAdvance(true);
    expect(useVNStore.getState().actionIndex).toBe(0);
    setScenePresentationPaused(false);
    handleAdvance(true);
    expect(useVNStore.getState()).toMatchObject({ actionIndex: 1, dialog: { continueLabel: undefined, channel: 'action' } });
    handleAdvance();
    vi.advanceTimersByTime(1000);
    expect(useVNStore.getState().choiceGate.active).toBe(true);
  });

  it('uses thought ownership without marking it as spoken dialogue', () => {
    useVNStore.getState().setGame({ ...characterPlacementGame, scenes: { intro: { actions: [
      { say: { char: '코난', channel: 'thought', with: [], text: 'I should listen first.' } },
    ] } } }, '/');
    handleAdvance();
    expect(useVNStore.getState().dialog).toMatchObject({ channel: 'thought', speakerId: undefined });
    expect(useVNStore.getState().storyLog.at(-1)).toMatchObject({ channel: 'thought' });
  });

  it('keeps exploration observations in route state and unlocks deduction after both', () => {
    const seen = (key: string) => ({ var: key, op: 'eq' as const, value: true });
    useVNStore.getState().setGame({ ...game, scenes: {
      intro: { actions: [{ choice: { key: 'desk', presentation: 'explore', with: [], prompt: 'Look closer.', options: [
        { text: 'Letter', at: { x: 25, y: 50 }, set: { letter: true }, goto: 'intro' },
        { text: 'Seal', at: { x: 75, y: 50 }, set: { seal: true }, goto: 'intro' },
        { text: 'Compare', when: { all: [seen('letter'), seen('seal')] }, goto: 'solved' },
      ] } }] },
      solved: { actions: [{ say: { text: 'The missing corner matches.' } }] },
    } }, '/');
    useVNStore.getState().setVisibleCharacters(['a']);
    handleAdvance();
    expect(useVNStore.getState().visibleCharacterIds).toEqual([]);
    expect(useVNStore.getState().choiceGate).toMatchObject({ presentation: 'explore' });
    expect(useVNStore.getState().choiceGate.options).toHaveLength(2);
    submitChoiceOption(1);
    expect(useVNStore.getState().choiceGate.options).toHaveLength(2);
    submitChoiceOption(0);
    expect(useVNStore.getState().choiceGate.options).toHaveLength(3);
    submitChoiceOption(2);
    expect(useVNStore.getState()).toMatchObject({ routeVars: { letter: true, seal: true }, currentSceneId: 'solved' });
  });

  afterEach(() => {
    setScenePresentationPaused(false);
    setPlayerExperienceSettings({ autoPlayEnabled: false });
    setPlayerAutoPlayPaused(false);
    vi.useRealTimers();
    Reflect.deleteProperty(globalThis, 'window');
    Reflect.deleteProperty(globalThis, 'localStorage');
    Reflect.deleteProperty(globalThis, 'requestAnimationFrame');
    Reflect.deleteProperty(globalThis, 'cancelAnimationFrame');
  });

  it('holds a waiting screen effect and rejects advance input while the scene is covered', () => {
    handleAdvance();
    setScenePresentationPaused(true);
    handleAdvance();
    vi.advanceTimersByTime(2000);
    expect(useVNStore.getState()).toMatchObject({ actionIndex: 0, busy: true, effect: 'shake' });
    setScenePresentationPaused(false);
    vi.advanceTimersByTime(700);
    expect(useVNStore.getState()).toMatchObject({
      actionIndex: 1, busy: false, effect: undefined, dialog: { fullText: 'The effect has finished.' },
    });
  });

  it('preserves the full choice countdown and blocks submissions behind a presentation cover', () => {
    useVNStore.getState().setGame({ ...game, scenes: { intro: { actions: [
      { choice: { prompt: 'Wait for the scene.', timeoutMs: 1000, options: [{ text: 'Continue' }] } },
      { say: { text: 'Countdown complete.' } },
    ] } } }, '/');
    useVNStore.getState().setCursor('intro', 0);
    handleAdvance();
    setScenePresentationPaused(true);
    submitChoiceOption(0);
    vi.advanceTimersByTime(5000);
    expect(useVNStore.getState().choiceGate.active).toBe(true);
    setScenePresentationPaused(false);
    vi.advanceTimersByTime(500);
    expect(useVNStore.getState().choiceGate.active).toBe(true);
    vi.advanceTimersByTime(510);
    expect(useVNStore.getState()).toMatchObject({
      choiceGate: { active: false }, dialog: { fullText: 'Countdown complete.' },
    });
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

  it('coalesces fast typing into one store update per animation frame', () => {
    useVNStore.getState().setGame(fastTypingGame, '/');
    useVNStore.getState().setCursor('intro', 0);
    const delayedFrameTimestamp = performance.now() + 64;
    Object.defineProperty(globalThis, 'requestAnimationFrame', {
      configurable: true,
      value: (callback: FrameRequestCallback) =>
        setTimeout(() => callback(delayedFrameTimestamp), 16) as unknown as number,
    });
    let previousVisibleText = '';
    let visibleTextUpdateCount = 0;
    const unsubscribe = useVNStore.subscribe((state) => {
      if (state.dialog.visibleText === previousVisibleText) {
        return;
      }
      previousVisibleText = state.dialog.visibleText;
      visibleTextUpdateCount += 1;
    });

    handleAdvance();
    vi.advanceTimersByTime(16);
    unsubscribe();

    expect(useVNStore.getState().dialog.visibleText.length).toBeGreaterThan(1);
    expect(visibleTextUpdateCount).toBe(1);
  });

  it('auto-advances only completed dialogue and stops at a choice gate', () => {
    useVNStore.getState().setGame(playerAutoPlayGame, '/');
    useVNStore.getState().setCursor('intro', 0);
    setPlayerExperienceSettings({ autoPlayEnabled: true, autoPlayDelayMs: 800 });

    handleAdvance();
    for (let frame = 0; frame < 10 && useVNStore.getState().dialog.typing; frame += 1) {
      vi.advanceTimersByTime(16);
    }
    expect(useVNStore.getState()).toMatchObject({
      actionIndex: 0,
      waitingInput: true,
      dialog: { visibleText: 'A', typing: false },
    });

    vi.advanceTimersByTime(799);
    expect(useVNStore.getState().actionIndex).toBe(0);
    vi.advanceTimersByTime(1);

    expect(useVNStore.getState()).toMatchObject({
      actionIndex: 1,
      waitingInput: true,
      choiceGate: { active: true, prompt: 'Choose' },
    });
    vi.advanceTimersByTime(5000);
    expect(useVNStore.getState()).toMatchObject({
      actionIndex: 1,
      choiceGate: { active: true },
    });
  });

  it('pauses player auto mode while a system overlay is open', () => {
    useVNStore.getState().setGame(playerAutoPlayGame, '/');
    useVNStore.getState().setCursor('intro', 0);
    setPlayerExperienceSettings({ autoPlayEnabled: true, autoPlayDelayMs: 800 });

    handleAdvance();
    vi.advanceTimersByTime(16);
    setPlayerAutoPlayPaused(true);
    vi.advanceTimersByTime(2000);
    expect(useVNStore.getState().actionIndex).toBe(0);

    setPlayerAutoPlayPaused(false);
    vi.advanceTimersByTime(800);
    expect(useVNStore.getState()).toMatchObject({
      actionIndex: 1,
      choiceGate: { active: true },
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
