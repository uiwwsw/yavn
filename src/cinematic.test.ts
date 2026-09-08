import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { dump } from 'js-yaml';
import { attackDuration, backgroundId, normalizeAttack, normalizeBackground } from './cinematic';
import { completeBackgroundTransition, handleAdvance, restorePresentationToCursor, saveCurrentProgress, setBgmEnabled, setPlayerExperienceSettings } from './engine';
import { parseBaseYaml, parseChapterYaml, parseConfigYaml, resolveChapterGame } from './parser';
import { collectChapterAssetPaths } from './preload';
import { useVNStore } from './store';
import type { Action, GameData } from './types';
import { imageResources } from './imageResources';

const assets: GameData['assets'] = {
  backgrounds: { hall: 'hall.webp', night: 'night.webp' },
  characters: { guard: { base: 'guard.webp' }, hero: { base: 'hero.webp' } },
  music: { finale: 'finale.wav' }, sfx: { blade: 'blade.wav' },
};
const makeGame = (actions: Action[]): GameData => ({
  meta: { title: 'Cinematic test' },
  assets,
  settings: { textSpeed: 30, autoSave: false, clickToInstant: true },
  script: [{ scene: 'intro' }], scenes: { intro: { actions } },
});
const start = (actions: Action[]) => {
  const game = makeGame(actions);
  useVNStore.getState().setGame(game, '/');
  handleAdvance();
  return game;
};

describe('cinematic execution and cancellation', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.stubGlobal('window', globalThis);
    vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => setTimeout(() => cb(performance.now()), 16));
    vi.stubGlobal('cancelAnimationFrame', clearTimeout);
    vi.stubGlobal('localStorage', { getItem: () => null, setItem: () => undefined, removeItem: () => undefined });
    useVNStore.getState().resetPresentation();
    setPlayerExperienceSettings({ autoPlayEnabled: false, sfxVolume: 0 });
  });
  afterEach(() => {
    imageResources.clear();
    useVNStore.getState().resetPresentation();
    vi.clearAllTimers();
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('waits for a decoded transition acknowledgement and rejects stale/duplicate completions', () => {
    start([{ bg: { id: 'hall', transition: 'fade', duration: 900 } },
      { bg: { id: 'night', transition: 'wipeLeft' } }, { say: { text: 'Arrived.' } }]);
    const first = useVNStore.getState().backgroundPresentation.revision;
    vi.advanceTimersByTime(1000);
    handleAdvance();
    expect(useVNStore.getState()).toMatchObject({ busy: true, actionIndex: 0 });
    expect(saveCurrentProgress().exists).toBe(false);
    completeBackgroundTransition(first);
    const second = useVNStore.getState().backgroundPresentation.revision;
    expect(second).toBeGreaterThan(first);
    completeBackgroundTransition(first);
    expect(useVNStore.getState()).toMatchObject({ busy: true, actionIndex: 1 });
    completeBackgroundTransition(second);
    completeBackgroundTransition(second);
    expect(useVNStore.getState()).toMatchObject({ busy: false, actionIndex: 2, dialog: { fullText: 'Arrived.' } });
  });

  it('does not stall on repeated backgrounds and preserves legacy nonblocking shorthand', () => {
    start([{ bg: 'hall' }, { bg: { id: 'hall', transition: 'fade' } }, { say: { text: 'Same room.' } }]);
    expect(useVNStore.getState()).toMatchObject({ busy: false, actionIndex: 2, dialog: { fullText: 'Same room.' } });
  });

  it('releases a failed transition without running the next line', () => {
    start([{ bg: { id: 'hall' } }, { say: { text: 'Never before the background.' } }]);
    completeBackgroundTransition(useVNStore.getState().backgroundPresentation.revision, false);
    expect(useVNStore.getState()).toMatchObject({ busy: false, actionIndex: 0 });
    expect(useVNStore.getState().error?.message).toContain('배경');
    handleAdvance();
    expect(useVNStore.getState().actionIndex).toBe(0);
    expect(useVNStore.getState().dialog.fullText).toBe('');
  });

  it('times out an unmounted or unresponsive background renderer', () => {
    start([{ bg: { id: 'hall', duration: 900 } }, { say: { text: 'Not ready.' } }]);
    vi.advanceTimersByTime(13900);
    expect(useVNStore.getState()).toMatchObject({ busy: false, actionIndex: 0 });
    expect(useVNStore.getState().error).toBeDefined();
  });

  it('cannot apply a previous game background completion to a replacement game', () => {
    start([{ bg: { id: 'hall' } }]);
    const oldRevision = useVNStore.getState().backgroundPresentation.revision;
    start([{ say: { text: 'New session.' } }]);
    completeBackgroundTransition(oldRevision);
    expect(useVNStore.getState()).toMatchObject({ actionIndex: 0, dialog: { fullText: 'New session.' } });
  });

  it('coordinates actors, impact and recovery while repeated input cannot skip the hit', () => {
    start([{ attack: { attacker: 'guard', target: 'hero', anticipation: 500, impact: 120, recovery: 600 } },
      { say: { text: 'The blade has passed.' } }]);
    const state = useVNStore.getState();
    expect(state.visibleCharacterIds).toEqual(['hero', 'guard']);
    expect(state.attack?.phase).toBe('anticipation');
    handleAdvance();
    vi.advanceTimersByTime(499);
    expect(useVNStore.getState().actionIndex).toBe(0);
    vi.advanceTimersByTime(1);
    expect(useVNStore.getState().attack?.phase).toBe('impact');
    handleAdvance();
    vi.advanceTimersByTime(120);
    expect(useVNStore.getState().attack?.phase).toBe('recovery');
    vi.advanceTimersByTime(599);
    expect(useVNStore.getState().busy).toBe(true);
    vi.advanceTimersByTime(1);
    expect(useVNStore.getState()).toMatchObject({ busy: false, attack: undefined, actionIndex: 1,
      dialog: { fullText: 'The blade has passed.' } });
  });

  it('starts consecutive identical attacks independently and reaches game over only after recovery', () => {
    const attack = { attacker: 'guard', anticipation: 100, impact: 80, recovery: 100 };
    start([{ attack }, { attack }, { gameOver: { title: 'Defeated' } }]);
    const first = useVNStore.getState().attack?.revision;
    vi.advanceTimersByTime(280);
    expect(useVNStore.getState().attack?.revision).not.toBe(first);
    expect(useVNStore.getState().gameOver).toBeUndefined();
    vi.advanceTimersByTime(280);
    expect(useVNStore.getState()).toMatchObject({ gameOver: { title: 'Defeated' }, attack: undefined, busy: false });
  });

  it('allows an already leaving prop to finish while the attack starts', () => {
    start([
      { sticker: { id: 'letter', image: 'hall' } },
      { clearSticker: { id: 'letter', leave: 'fadeOut' } },
      { attack: { attacker: 'guard' } },
      { say: { text: 'The letter is gone.' } },
    ]);
    expect(useVNStore.getState().stickers.letter?.leaving).toBe(true);
    vi.advanceTimersByTime(220);
    expect(useVNStore.getState().stickers.letter).toBeUndefined();
    expect(useVNStore.getState().attack?.phase).toBe('anticipation');
  });

  it('does not resume an old attack after a different game replaces it', () => {
    start([{ attack: { attacker: 'guard' } }, { gameOver: {} }]);
    start([{ say: { text: 'A different story.' } }]);
    vi.advanceTimersByTime(5000);
    expect(useVNStore.getState()).toMatchObject({ attack: undefined, gameOver: undefined, actionIndex: 0,
      dialog: { fullText: 'A different story.' } });
  });

  it('waits for a cut-in decode before starting impact timing', async () => {
    let decode!: () => void;
    vi.stubGlobal('Image', class {
      src = ''; complete = true; naturalWidth = 100; naturalHeight = 100;
      removeAttribute() {}
      decode = () => new Promise<void>((resolve) => { decode = resolve; });
    });
    start([{ attack: { attacker: 'guard', image: 'hall', anticipation: 500 } }, { say: { text: 'After.' } }]);
    await vi.advanceTimersByTimeAsync(1000);
    expect(useVNStore.getState()).toMatchObject({ busy: true, attack: undefined, actionIndex: 0 });
    decode();
    await vi.advanceTimersByTimeAsync(0);
    expect(useVNStore.getState().attack).toMatchObject({ phase: 'anticipation', image: 'hall.webp' });
    await vi.advanceTimersByTimeAsync(500);
    expect(useVNStore.getState().attack?.phase).toBe('impact');
  });

  it('falls back to actors if optional cut-in decoding never finishes', async () => {
    vi.stubGlobal('Image', class {
      src = ''; complete = true; naturalWidth = 100; naturalHeight = 100;
      removeAttribute() {}
      decode = () => new Promise<void>(() => undefined);
    });
    start([{ attack: { attacker: 'guard', image: 'hall' } }, { say: { text: 'After.' } }]);
    await vi.advanceTimersByTimeAsync(12000);
    expect(useVNStore.getState().attack).toMatchObject({ phase: 'anticipation', image: undefined });
    await vi.advanceTimersByTimeAsync(1300);
    expect(useVNStore.getState()).toMatchObject({ busy: false, actionIndex: 1 });
  });

  it('ignores a cut-in decode that finishes after another game is loaded', async () => {
    let decode!: () => void;
    vi.stubGlobal('Image', class {
      src = ''; complete = true; naturalWidth = 100; naturalHeight = 100;
      removeAttribute() {}
      decode = () => new Promise<void>((resolve) => { decode = resolve; });
    });
    start([{ attack: { attacker: 'guard', image: 'hall' } }, { gameOver: {} }]);
    await vi.advanceTimersByTimeAsync(1);
    start([{ say: { text: 'Another story.' } }]);
    decode();
    await vi.advanceTimersByTimeAsync(5000);
    expect(useVNStore.getState()).toMatchObject({ attack: undefined, gameOver: undefined, busy: false,
      dialog: { fullText: 'Another story.' } });
  });

  it('respects the SFX mixer for approach/impact and stops in-flight sounds when muted', async () => {
    const sounds: { url: string; volume: number; pause: ReturnType<typeof vi.fn> }[] = [];
    vi.stubGlobal('Audio', class {
      volume = 0;
      pause = vi.fn();
      play = () => Promise.resolve();
      constructor(public url: string) { sounds.push(this); }
    });
    setPlayerExperienceSettings({ sfxVolume: 0.4 });
    start([{ attack: { attacker: 'guard', sound: 'blade', anticipation: 500 } }, { say: { text: 'After.' } }]);
    expect(sounds).toHaveLength(1);
    expect(sounds[0].volume).toBe(0.4);
    await vi.advanceTimersByTimeAsync(500);
    expect(sounds).toHaveLength(2);
    expect(sounds[1]).toMatchObject({ url: 'blade.wav', volume: 0.4 });
    setPlayerExperienceSettings({ sfxVolume: 0 });
    expect(sounds.every((sound) => sound.pause.mock.calls.length > 0)).toBe(true);
  });

  it('keeps BGM volume valid when the first frame timestamp predates fade setup', async () => {
    const frames: FrameRequestCallback[] = [];
    const volumes: number[] = [];
    vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => frames.push(callback));
    vi.stubGlobal('Audio', class {
      private level = 1;
      get volume() { return this.level; }
      set volume(value: number) {
        if (value < 0 || value > 1) throw new RangeError('Invalid audio volume');
        this.level = value; volumes.push(value);
      }
      play = () => Promise.resolve();
      pause = () => {};
    });
    setBgmEnabled(true);
    setPlayerExperienceSettings({ bgmVolume: 0.7 });
    start([{ music: 'finale' }, { say: { text: 'A warmed scene.' } }]);
    await Promise.resolve();
    expect(() => frames.splice(0).forEach(frame => frame(performance.now() - 50))).not.toThrow();
    expect(volumes.length).toBeGreaterThan(1);
    expect(volumes.every(value => value >= 0 && value <= 1)).toBe(true);
    setBgmEnabled(false);
  });

  it('restores object backgrounds and actor staging without replaying the attack', () => {
    const game = makeGame([{ bg: { id: 'hall' } }, { attack: { attacker: 'guard', target: 'hero' } }, { say: { text: 'After.' } }]);
    useVNStore.getState().setGame(game, '/');
    restorePresentationToCursor({ name: '0.yaml', pathKey: '0.yaml', baseUrl: '/', assetOverrides: {}, loadGame: async () => game }, game, {
      gameTitle: game.meta.title, chapterIndex: 0, chapterPath: '0.yaml', sceneId: 'intro', actionIndex: 2,
      routeVars: {}, inventory: {}, routeHistory: [], storyLog: [],
    });
    expect(useVNStore.getState()).toMatchObject({ background: 'hall.webp', attack: undefined, busy: false });
    expect(useVNStore.getState().visibleCharacterIds).toEqual(['hero', 'guard']);
  });
});

describe('cinematic authoring contract', () => {
  const resolve = (action: Action, ending: object = {}) => {
    const config = parseConfigYaml(dump({ title: 'Test', textSpeed: 30, autoSave: false, clickToInstant: true, endings: { dawn: { title: 'Dawn', ...ending } } }), 'config.yaml');
    const base = parseBaseYaml(dump({ assets }), 'base.yaml');
    const chapter = parseChapterYaml(dump({ script: [{ scene: 'intro' }], scenes: { intro: { actions: [action] } } }), '0.yaml');
    if (!config.data || !base.data || !chapter.data) return { error: config.error ?? base.error ?? chapter.error };
    return resolveChapterGame({ config: config.data, bases: [base.data], chapter: chapter.data });
  };
  it('normalizes backward-compatible defaults and cut timing', () => {
    expect(backgroundId('hall')).toBe('hall');
    expect(normalizeBackground('hall')).toEqual({ transition: 'dissolve', duration: 620, wait: false });
    expect(normalizeBackground({ id: 'hall', transition: 'cut', duration: 900 })).toEqual({ transition: 'cut', duration: 0, wait: true });
    expect(attackDuration(normalizeAttack({ attacker: 'guard' }, 1))).toBe(1300);
  });
  it('resolves attack, outcome and transition asset references through the production parser', () => {
    expect(resolve({ attack: { attacker: 'guard', target: 'hero', sound: 'blade' } },
      { background: 'night', music: 'finale', epilogue: 'The door stayed open.', tone: 'hopeful' }).error).toBeUndefined();
    expect(resolve({ bg: { id: 'night', transition: 'wipeRight', wait: false } }).error).toBeUndefined();
  });
  it.each([
    { attack: { attacker: 'missing' } },
    { attack: { attacker: 'guard', target: 'missing' } },
    { attack: { attacker: 'guard', target: 'guard' } },
    { attack: { attacker: 'guard', sound: 'missing' } },
    { attack: { attacker: 'guard', image: 'missing' } },
    { attack: { attacker: 'guard', anticipation: -1 } },
    { bg: { id: 'missing' } },
    { bg: { id: 'hall', duration: 99999 } },
  ] satisfies Action[])('rejects invalid cinematic input %j', (action) => {
    expect(resolve(action).error).toBeDefined();
  });
  it('validates ending assets and preloads both combatants and ending artwork', () => {
    expect(resolve({ ending: 'dawn' }, { background: 'missing' }).error).toBeDefined();
    expect(resolve({ ending: 'dawn' }, { music: 'missing' }).error).toBeDefined();
    const game = makeGame([{ bg: { id: 'hall' } }, { attack: { attacker: 'guard', target: 'hero' } }]);
    game.endings = { dawn: { title: 'Dawn', background: 'night' } };
    expect(collectChapterAssetPaths(game)).toEqual(['hall.webp', 'guard.webp', 'hero.webp', 'night.webp']);
  });
});
