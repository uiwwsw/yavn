import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { dump } from 'js-yaml';
import { completeBackgroundTransition, handleAdvance, restorePresentationToCursor, saveCurrentProgress, setPlayerExperienceSettings, setScenePresentationPaused } from './engine';
import { parseBaseYaml, parseChapterYaml, parseConfigYaml, resolveChapterGame } from './parser';
import { captionContext, followingPlace, resolveSceneLabel } from './sceneLabels';
import { useVNStore } from './store';
import type { Action, GameData, SceneLabelOptions } from './types';

function game(actions: Action[]): GameData {
  return {
    meta: { title: 'Scene label test' },
    settings: { textSpeed: 30, clickToInstant: true },
    assets: { backgrounds: { hall: 'hall.svg', cafe: 'cafe.svg', black: 'black.svg' },
      backgroundLabels: { hall: '병원 복도', cafe: '1층 카페', black: false }, characters: {}, music: {}, sfx: {} },
    script: [{ scene: 'intro' }], scenes: { intro: { time: '오후 3:20', actions } },
  };
}

describe('scene label resolution', () => {
  it('uses reusable metadata and authored story time, with honest fallbacks', () => {
    const g = game([]);
    expect(resolveSceneLabel(g, g.scenes.intro, 'cafe')).toEqual({ text: '오후 3:20 · 1층 카페', time: '오후 3:20' });
    expect(resolveSceneLabel(g, {}, 'hall', '오후 4시').text).toBe('오후 4시 · 병원 복도');
    expect(resolveSceneLabel(g, {}, 'unregistered_bg').text).toBe('시간 미상 · unregistered bg');
  });
  it.each([
    [false, undefined], [{ name: false }, '오후 3:20'], [{ time: false }, '1층 카페'],
    [{ name: false, time: false }, undefined], [{ name: '옥상', time: '밤 11시' }, '밤 11시 · 옥상'],
  ] satisfies [SceneLabelOptions, string | undefined][])('supports per-background overrides %j', (label, text) => {
    const g = game([]);
    expect(resolveSceneLabel(g, g.scenes.intro, { id: 'cafe', label }).text).toBe(text);
  });
  it('can disable defaults globally or per asset and opt back in for one transition', () => {
    const g = game([]);
    expect(resolveSceneLabel(g, {}, 'black').text).toBeUndefined();
    g.settings.sceneLabels = false;
    expect(resolveSceneLabel(g, {}, 'cafe').text).toBeUndefined();
    expect(resolveSceneLabel(g, {}, { id: 'cafe', label: true }, '밤').text).toBe('밤 · 1층 카페');
  });
  it('reuses existing captions only across setup actions, never across dialogue or branches', () => {
    expect(followingPlace([{ bg: 'cafe' }, { music: null }, { place: '잠시 뒤 · 카페' }], 0)).toBe(2);
    expect(followingPlace([{ bg: 'cafe' }, { say: { text: 'First.' } }, { place: '밤 · 카페' }], 0)).toBeUndefined();
    expect(followingPlace([{ bg: 'cafe' }, { goto: 'other' }, { place: '밤 · 카페' }], 0)).toBeUndefined();
    expect(captionContext('2033년 10월 · 오전 7시 42분 · 월계역')).toEqual({ name: '월계역', time: '2033년 10월 · 오전 7시 42분' });
  });
});

describe('automatic captions in the engine', () => {
  let storage: Map<string, string>;
  beforeEach(() => {
    vi.useFakeTimers();
    vi.stubGlobal('window', globalThis);
    vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => setTimeout(() => callback(performance.now()), 16));
    vi.stubGlobal('cancelAnimationFrame', clearTimeout);
    storage = new Map();
    vi.stubGlobal('localStorage', { getItem: (key: string) => storage.get(key) ?? null,
      setItem: (key: string, value: string) => storage.set(key, value), removeItem: (key: string) => storage.delete(key) });
    useVNStore.getState().resetPresentation();
    setPlayerExperienceSettings({ autoPlayEnabled: false, sfxVolume: 0 });
  });
  afterEach(() => {
    setScenePresentationPaused(false);
    useVNStore.getState().resetPresentation();
    vi.clearAllTimers(); vi.useRealTimers(); vi.unstubAllGlobals();
  });
  const start = (g: GameData) => { useVNStore.getState().setGame(g, '/'); handleAdvance(); };
  const ready = () => completeBackgroundTransition(useVNStore.getState().backgroundPresentation.revision);

  it('shows an uncaptioned cafe automatically after decode, without blocking dialogue, then dismisses it', () => {
    start(game([{ bg: { id: 'cafe' } }, { say: { text: 'Coffee.' } }]));
    expect(useVNStore.getState().placeCaption).toBeUndefined();
    ready();
    expect(useVNStore.getState()).toMatchObject({ busy: false, actionIndex: 1,
      placeCaption: { text: '오후 3:20 · 1층 카페', automatic: true, centered: false }, dialog: { fullText: 'Coffee.' } });
    vi.advanceTimersByTime(2600);
    expect(useVNStore.getState().placeCaption).toBeUndefined();
  });
  it('promotes an adjacent old HUD caption once and preserves existing action indices', () => {
    start(game([{ bg: { id: 'cafe' } }, { place: '잠시 뒤 · 월계병원 1층 카페' }, { say: { text: 'Coffee.' } }]));
    ready();
    expect(useVNStore.getState()).toMatchObject({ actionIndex: 2, sceneTime: '잠시 뒤',
      placeCaption: { text: '잠시 뒤 · 월계병원 1층 카페', automatic: true } });
  });
  it('preserves explicit centered captions and their 1.5 second hold', () => {
    start(game([{ bg: { id: 'cafe' } }, { place: { text: '밤 · 카페', presentation: 'center' } }, { say: { text: 'After.' } }]));
    ready();
    expect(useVNStore.getState()).toMatchObject({ busy: true, placeCaption: { text: '밤 · 카페', centered: true } });
    vi.advanceTimersByTime(1500);
    expect(useVNStore.getState()).toMatchObject({ busy: false, actionIndex: 2, dialog: { fullText: 'After.' } });
    expect(useVNStore.getState().placeCaption).toBeUndefined();
  });
  it('hides adjacent legacy labels when explicitly suppressed, but retains the story time', () => {
    start(game([{ bg: { id: 'cafe', label: false } }, { place: '밤 11시 · 카페' }, { say: { text: 'Hidden.' } }]));
    ready();
    expect(useVNStore.getState()).toMatchObject({ actionIndex: 2, sceneTime: '밤 11시' });
    expect(useVNStore.getState().placeCaption).toBeUndefined();
  });
  it('inherits a changed time within a scene and applies the next scene time on entry', () => {
    const g = game([{ bg: { id: 'hall', label: { time: '밤 11시' }, wait: false } },
      { bg: 'cafe' }, { say: { text: 'Late.' } }, { goto: 'morning' }]);
    g.scenes.morning = { time: '다음 날 아침', actions: [{ bg: 'hall' }, { say: { text: 'Morning.' } }] };
    start(g);
    expect(useVNStore.getState().placeCaption?.text).toBe('밤 11시 · 1층 카페');
    handleAdvance(); handleAdvance();
    expect(useVNStore.getState()).toMatchObject({ currentSceneId: 'morning', sceneTime: '다음 날 아침',
      placeCaption: { text: '다음 날 아침 · 병원 복도' } });
  });
  it('pauses caption lifetime while menus or chapter loading cover the story', () => {
    start(game([{ bg: 'cafe' }, { say: { text: 'Coffee.' } }]));
    setScenePresentationPaused(true);
    vi.advanceTimersByTime(10000);
    expect(useVNStore.getState().placeCaption?.automatic).toBe(true);
    setScenePresentationPaused(false);
    vi.advanceTimersByTime(2600);
    expect(useVNStore.getState().placeCaption).toBeUndefined();
  });
  it('does not retrigger for the same image, and an earlier timeout cannot clear a newer caption', () => {
    const g = game([{ bg: 'hall' }, { say: { text: 'Hall.' } }, { bg: 'cafe' }, { bg: 'cafe' }, { say: { text: 'Cafe.' } }]);
    start(g);
    vi.advanceTimersByTime(1500);
    useVNStore.getState().setCursor('intro', 2);
    handleAdvance();
    const caption = useVNStore.getState().placeCaption;
    expect(caption?.text).toBe('오후 3:20 · 1층 카페');
    expect(caption?.automatic).toBe(true);
    vi.advanceTimersByTime(1200);
    expect(useVNStore.getState().placeCaption).toBe(caption);
  });
  it('does not show a label after a failed decode or leak story time into a replacement game', () => {
    start(game([{ bg: { id: 'cafe' } }, { say: { text: 'Never.' } }]));
    completeBackgroundTransition(useVNStore.getState().backgroundPresentation.revision, false);
    expect(useVNStore.getState().placeCaption).toBeUndefined();
    useVNStore.getState().setSceneTime('밤');
    useVNStore.getState().setGame(game([{ say: { text: 'New.' } }]), '/');
    expect(useVNStore.getState().sceneTime).toBe('오후 3:20');
  });
  it('saves story time and restores new and old saves without replaying captions', () => {
    const g = game([{ bg: 'cafe' }, { place: '밤 11시 · 카페' }, { say: { text: 'Saved.' } }]);
    start(g);
    saveCurrentProgress();
    expect([...storage.values()].some(value => value.includes('"sceneTime":"밤 11시"'))).toBe(true);
    const chapter = { name: '0.yaml', pathKey: '0.yaml', baseUrl: '/', assetOverrides: {}, loadGame: async () => g };
    const resume = { chapterIndex: 0, sceneId: 'intro', actionIndex: 2, routeVars: {}, inventory: {}, routeHistory: [], storyLog: [] };
    for (const snapshot of [undefined, '오후 8시']) {
      useVNStore.getState().setGame(g, '/');
      restorePresentationToCursor(chapter, g, { ...resume, sceneTime: snapshot });
      expect(useVNStore.getState().sceneTime).toBe(snapshot ?? '밤 11시');
      expect(useVNStore.getState().placeCaption).toBeUndefined();
    }
  });
});

describe('scene label YAML contract', () => {
  it('merges reusable metadata and rejects invalid background references', () => {
    const config = parseConfigYaml('title: Labels\ntextSpeed: 30\nclickToInstant: true\nsceneLabels: false', 'config.yaml').data!;
    const base = parseBaseYaml(dump({ assets: game([]).assets }), 'base.yaml').data!;
    const chapter = parseChapterYaml(dump({ assets: { backgroundLabels: { cafe: { name: '다락 카페', time: '오후 2시' } } },
      script: [{ scene: 'intro' }], scenes: game([{ bg: { id: 'cafe', label: { time: false } } }]).scenes }), '0.yaml').data!;
    const result = resolveChapterGame({ config, bases: [base], chapter });
    expect(result.error).toBeUndefined();
    expect(result.data?.settings.sceneLabels).toBe(false);
    expect(result.data?.assets.backgroundLabels).toMatchObject({ hall: '병원 복도', cafe: { name: '다락 카페' } });
    expect(result.data?.scenes.intro.time).toBe('오후 3:20');
    base.data.assets!.backgroundLabels = { missing: '잘못된 배경' };
    expect(resolveChapterGame({ config, bases: [base], chapter }).error?.message).toContain('unknown background');
  });
  it.each([{ name: true }, { time: 123 }, { names: 'typo' }])('rejects invalid label options %j', label => {
    expect(parseChapterYaml(dump({ script: [{ scene: 'intro' }], scenes: { intro: { actions: [{ bg: { id: 'cafe', label } }] } } }), '0.yaml').error).toBeDefined();
  });
});
