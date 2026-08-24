import { beforeEach, describe, expect, it } from 'vitest';
import {
  exportSaveBackup,
  getAutoSaveEnabled,
  getChoiceRecoverySummary,
  getSaveSlotSummaries,
  importSaveBackup,
  restorePresentationToCursor,
  saveCurrentProgress,
  setAutoSaveEnabled,
  submitChoiceOption,
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
  meta: { title: 'Save Test', version: '1.0.0' },
  settings: { textSpeed: 30, autoSave: true, clickToInstant: true },
  assets: { backgrounds: {}, characters: {}, music: {}, sfx: {} },
  script: [{ scene: 'intro' }],
  scenes: { intro: { actions: [{ say: { text: 'Hello' } }] } },
};

const backgroundGame: GameData = {
  ...game,
  assets: {
    ...game.assets,
    backgrounds: {
      replayed_room: '/bg/replayed-room.webp',
      saved_room: '/bg/saved-room.webp',
    },
  },
  script: [{ scene: 'entry' }],
  scenes: {
    entry: { actions: [] },
    background_scene: {
      actions: [
        { bg: 'saved_room' },
        { say: { text: 'The saved background is visible here.' } },
      ],
    },
    saved_scene: { actions: [{ say: { text: 'Saved here' } }] },
  },
};

describe('save system', () => {
  beforeEach(() => {
    Object.defineProperty(globalThis, 'localStorage', {
      configurable: true,
      value: new MemoryStorage(),
    });
    useVNStore.getState().resetPresentation();
    useVNStore.getState().setGame(game, '/');
    useVNStore.getState().setCursor('intro', 0);
  });

  it('round-trips a manual save through a portable backup', () => {
    const saved = saveCurrentProgress();
    const backup = exportSaveBackup();

    expect(saved.exists).toBe(true);
    expect(backup?.filename).toContain('Save-Test');
    expect(JSON.parse(backup?.content ?? '{}')).toMatchObject({
      schemaVersion: 2,
      progress: { schemaVersion: 2 },
    });
    expect(getSaveSlotSummaries().find((slot) => slot.slot === 'manual')?.exists).toBe(true);

    localStorage.clear();
    const imported = importSaveBackup(backup?.content ?? '');

    expect(imported.exists).toBe(true);
    expect(imported.sceneId).toBe('intro');
    expect(getSaveSlotSummaries().find((slot) => slot.slot === 'manual')?.exists).toBe(true);
  });

  it('imports an unversioned legacy backup and rewrites its progress as schema v2', () => {
    importSaveBackup(JSON.stringify({
      engine: 'YAVN',
      progress: {
        gameTitle: 'Save Test',
        chapterIndex: 0,
        sceneId: 'intro',
        actionIndex: 0,
      },
    }));

    expect(JSON.parse(localStorage.getItem('vn-engine-autosave:manual') ?? '{}')).toMatchObject({
      schemaVersion: 2,
      sceneId: 'intro',
      routeVars: {},
      inventory: {},
      routeHistory: [],
      storyLog: [],
    });
  });

  it('migrates legacy browser save slots in place when they are first read', () => {
    localStorage.setItem('vn-engine-autosave:manual', JSON.stringify({
      gameTitle: 'Save Test',
      chapterIndex: 0,
      sceneId: 'intro',
      actionIndex: 0,
    }));

    expect(getSaveSlotSummaries().find((slot) => slot.slot === 'manual')?.exists).toBe(true);
    expect(JSON.parse(localStorage.getItem('vn-engine-autosave:manual') ?? '{}')).toMatchObject({
      schemaVersion: 2,
      routeVars: {},
      inventory: {},
      routeHistory: [],
      storyLog: [],
    });
  });

  it('rejects backup envelopes from a newer unsupported schema', () => {
    expect(() => importSaveBackup(JSON.stringify({
      schemaVersion: 999,
      engine: 'YAVN',
      progress: {
        gameTitle: 'Save Test',
        chapterIndex: 0,
        sceneId: 'intro',
        actionIndex: 0,
      },
    }))).toThrow('새로운 버전');
  });

  it('does not downgrade a future browser save slot', () => {
    const future = JSON.stringify({
      schemaVersion: 999,
      gameTitle: 'Save Test',
      chapterIndex: 0,
      sceneId: 'intro',
      actionIndex: 0,
      futureData: 'keep-me',
    });
    localStorage.setItem('vn-engine-autosave:manual', future);

    expect(getSaveSlotSummaries().find((slot) => slot.slot === 'manual')?.exists).toBe(false);
    expect(localStorage.getItem('vn-engine-autosave:manual')).toBe(future);
  });

  it('persists the current background asset id in save data', () => {
    useVNStore.getState().setGame(backgroundGame, '/');
    useVNStore.getState().setCursor('saved_scene', 0);
    useVNStore.getState().setBackground('/bg/saved-room.webp');

    const backup = exportSaveBackup();
    const envelope = JSON.parse(backup?.content ?? '{}') as {
      progress?: { backgroundAssetId?: string };
    };

    expect(envelope.progress?.backgroundAssetId).toBe('saved_room');

    localStorage.clear();
    importSaveBackup(backup?.content ?? '');
    const imported = JSON.parse(localStorage.getItem('vn-engine-autosave:manual') ?? '{}') as {
      backgroundAssetId?: string;
    };
    expect(imported.backgroundAssetId).toBe('saved_room');
  });

  it('uses the saved background snapshot when cursor replay cannot reach the saved scene', () => {
    useVNStore.getState().setGame(backgroundGame, '/');

    restorePresentationToCursor(
      {
        pathKey: './0.yaml',
        name: '0.yaml',
        baseUrl: '/',
        assetOverrides: {},
        loadGame: async () => backgroundGame,
      },
      backgroundGame,
      {
        chapterIndex: 0,
        chapterPath: './0.yaml',
        sceneId: 'saved_scene',
        actionIndex: 0,
        backgroundAssetId: 'saved_room',
        routeVars: {},
        inventory: {},
        routeHistory: [],
        storyLog: [],
      },
    );

    expect(useVNStore.getState().background).toBe('/bg/saved-room.webp');
  });

  it('derives a legacy save background from its story log when cursor replay cannot reach it', () => {
    useVNStore.getState().setGame(backgroundGame, '/');

    restorePresentationToCursor(
      {
        pathKey: './0.yaml',
        name: '0.yaml',
        baseUrl: '/',
        assetOverrides: {},
        loadGame: async () => backgroundGame,
      },
      backgroundGame,
      {
        chapterIndex: 0,
        chapterPath: './0.yaml',
        sceneId: 'saved_scene',
        actionIndex: 0,
        routeVars: {},
        inventory: {},
        routeHistory: [],
        storyLog: [
          {
            kind: 'dialogue',
            text: 'The saved background is visible here.',
            chapterPath: './0.yaml',
            sceneId: 'background_scene',
            actionIndex: 1,
          },
        ],
      },
    );

    expect(useVNStore.getState().background).toBe('/bg/saved-room.webp');
  });

  it('persists the player autosave override and saves immediately when enabled', () => {
    setAutoSaveEnabled(false);
    expect(getAutoSaveEnabled()).toBe(false);

    setAutoSaveEnabled(true);

    expect(getAutoSaveEnabled()).toBe(true);
    expect(getSaveSlotSummaries().find((slot) => slot.slot === 'auto')?.exists).toBe(true);
  });

  it('keeps disabled-autosave choice recovery in memory without leaving a stale persistent point', () => {
    localStorage.setItem(
      'vn-engine-autosave:choice-recovery',
      JSON.stringify({
        gameTitle: 'Save Test',
        chapterIndex: 0,
        sceneId: 'intro',
        actionIndex: 9,
      }),
    );
    setAutoSaveEnabled(false);

    expect(localStorage.getItem('vn-engine-autosave:choice-recovery')).toBeNull();

    useVNStore.getState().setCursor('intro', 3);
    useVNStore.getState().setWaitingInput(true);
    useVNStore.getState().setChoiceGate({
      active: true,
      key: 'session-only',
      prompt: 'Choose',
      options: [{ text: 'Continue' }],
    });
    submitChoiceOption(0);

    expect(getChoiceRecoverySummary()).toMatchObject({
      exists: true,
      sceneId: 'intro',
      actionIndex: 3,
    });
    expect(getChoiceRecoverySummary().failedChoice).toBeUndefined();
    expect(localStorage.getItem('vn-engine-autosave:choice-recovery')).toBeNull();
  });

  it('rejects a backup from a different game', () => {
    const foreign = JSON.stringify({
      engine: 'YAVN',
      progress: {
        gameTitle: 'Other Game',
        chapterIndex: 0,
        sceneId: 'intro',
        actionIndex: 0,
      },
    });

    expect(() => importSaveBackup(foreign)).toThrow('현재 게임과 일치');
  });

  it('enters game over without overwriting the last valid autosave', () => {
    setAutoSaveEnabled(true);
    const savedBeforeFailure = JSON.parse(localStorage.getItem('vn-engine-autosave') ?? '{}') as {
      actionIndex?: number;
    };
    useVNStore.getState().setCursor('intro', 7);
    useVNStore.getState().setWaitingInput(true);
    useVNStore.getState().setChoiceGate({
      active: true,
      key: 'final-choice',
      prompt: 'Choose',
      options: [
        {
          text: 'Wrong',
          set: { failed: true },
          gameOver: { title: 'Failed', message: 'Load a save.' },
        },
      ],
    });

    submitChoiceOption(0);

    expect(useVNStore.getState().gameOver).toEqual({ title: 'Failed', message: 'Load a save.' });
    expect(useVNStore.getState().isFinished).toBe(false);
    expect(useVNStore.getState().routeVars.failed).toBe(true);
    expect(JSON.parse(localStorage.getItem('vn-engine-autosave') ?? '{}')).toMatchObject(savedBeforeFailure);
    expect(getChoiceRecoverySummary()).toMatchObject({
      exists: true,
      sceneId: 'intro',
      actionIndex: 7,
      chapterIndex: 0,
      failedChoice: {
        key: 'final-choice',
        value: 'Wrong',
        optionIndex: 0,
      },
    });
    expect(JSON.parse(localStorage.getItem('vn-engine-autosave:choice-recovery') ?? '{}')).toMatchObject({
      sceneId: 'intro',
      actionIndex: 7,
      routeVars: {},
      routeHistory: [],
      storyLog: [],
      choiceAttempt: {
        key: 'final-choice',
        value: 'Wrong',
        optionIndex: 0,
        ledToGameOver: true,
      },
    });
    expect(exportSaveBackup()).toBeUndefined();
  });

  it('restores the originating choice when a goto branch reaches a standalone game over', () => {
    const branchGame: GameData = {
      ...game,
      state: { defaults: { failed: false } },
      scenes: {
        choice: {
          actions: [
            {
              choice: {
                key: 'danger',
                prompt: 'Choose',
                options: [{ text: 'Wrong turn', set: { failed: true }, goto: 'failure' }],
              },
            },
          ],
        },
        failure: { actions: [{ gameOver: { title: 'Branch failed' } }] },
      },
      script: [{ scene: 'choice' }],
    };
    useVNStore.getState().setGame(branchGame, '/');
    useVNStore.getState().setRouteVars({ failed: false });
    useVNStore.getState().setCursor('choice', 0);
    useVNStore.getState().setWaitingInput(true);
    useVNStore.getState().setChoiceGate({
      active: true,
      key: 'danger',
      prompt: 'Choose',
      options: [{ text: 'Wrong turn', set: { failed: true }, goto: 'failure' }],
    });

    submitChoiceOption(0);

    const recovery = JSON.parse(localStorage.getItem('vn-engine-autosave') ?? '{}') as {
      sceneId?: string;
      actionIndex?: number;
      routeVars?: Record<string, unknown>;
    };
    expect(useVNStore.getState().gameOver?.title).toBe('Branch failed');
    expect(recovery).toMatchObject({ sceneId: 'choice', actionIndex: 0, routeVars: { failed: false } });
    expect(getChoiceRecoverySummary().failedChoice).toEqual({
      key: 'danger',
      value: 'Wrong turn',
      optionIndex: 0,
    });
  });

  it('targets the earlier causal choice when a later choice leads to game over', () => {
    const delayedFailureGame: GameData = {
      ...game,
      scenes: {
        cause: {
          actions: [
            {
              choice: {
                key: 'cause-choice',
                prompt: 'Trust the warning?',
                options: [{ text: 'Ignore it', goto: 'later-choice' }],
              },
            },
          ],
        },
        'later-choice': {
          actions: [
            {
              choice: {
                key: 'last-choice',
                prompt: 'Choose a door',
                options: [{ text: 'Open the door', goto: 'delayed-failure' }],
              },
            },
          ],
        },
        'delayed-failure': {
          actions: [
            {
              gameOver: {
                title: 'The warning returns',
                recoverToChoice: 'cause-choice',
              },
            },
          ],
        },
      },
      script: [{ scene: 'cause' }],
    };
    useVNStore.getState().setGame(delayedFailureGame, '/');
    useVNStore.getState().setCursor('cause', 0);
    useVNStore.getState().setWaitingInput(true);
    useVNStore.getState().setChoiceGate({
      active: true,
      key: 'cause-choice',
      prompt: 'Trust the warning?',
      options: [{ text: 'Ignore it', goto: 'later-choice' }],
    });

    submitChoiceOption(0);
    expect(useVNStore.getState().choiceGate.key).toBe('last-choice');
    submitChoiceOption(0);

    expect(useVNStore.getState().gameOver?.title).toBe('The warning returns');
    expect(getChoiceRecoverySummary()).toMatchObject({
      exists: true,
      sceneId: 'cause',
      actionIndex: 0,
      failedChoice: {
        key: 'cause-choice',
        value: 'Ignore it',
        optionIndex: 0,
      },
    });
  });
});
