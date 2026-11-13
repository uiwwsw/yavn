import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  deleteSaveSlot,
  getChoiceRecoverySummary,
  getSaveSlotSummaries,
  getStoryMap,
  loadChoiceRecovery,
  loadGameFromUrl,
  loadSaveSlot,
  loadUrlStartScreenPreview,
  replayStoryMapNode,
  saveCurrentProgress,
  setScenePresentationPaused,
  submitChoiceOption,
} from './engine';
import { storyNodeId } from './storyMap';
import { useVNStore } from './store';
import './parser';

const config = (version: string) => `title: Versions\nversion: "${version}"\ntextSpeed: 30\nclickToInstant: true\n`;
const story = `chapterTitle: Night Station
script: [{scene: start}, {scene: hall}, {scene: pit}, {scene: trap}, {scene: roof}]
scenes:
  start:
    actions:
      - say: {char: mina, text: Pick a door.}
      - choice:
          key: first
          prompt: Which door?
          options:
            - {text: Left, goto: hall, add: {trust: 1}}
            - {text: Jump, gameOver: {title: Fell}}
  hall:
    actions:
      - get: lamp
      - choice:
          key: second
          prompt: Go on?
          options:
            - {text: Down, goto: pit, add: {trust: 5}}
            - {text: Up, goto: roof}
            - {text: Wait, goto: trap}
  pit:
    actions:
      - say: {text: The floor gives way.}
      - gameOver: {title: Pit}
  trap:
    actions:
      - gameOver: {title: Trap, recoverToChoice: first}
  roof:
    actions:
      - say: {text: Fresh air.}
`;
let files: Record<string, string> = {};
const SAVE_KEY = 'vn-engine-autosave:path:%2Fv';
const startChoice = storyNodeId('./0.yaml', 'start', 1);
const hallChoice = storyNodeId('./0.yaml', 'hall', 1);

async function settle<T>(promise: Promise<T>): Promise<T> {
  await vi.advanceTimersByTimeAsync(2500);
  return promise;
}
beforeEach(() => {
  vi.useFakeTimers();
  files = { 'config.yaml': config('1'), 'base.yaml': 'assets:\n  characters:\n    mina: {base: mina.png, name: Mina}\nstate: {trust: 0}\ninventory: {lamp: {name: Lamp}}\n', '0.yaml': story };
  const values = new Map<string, string>();
  vi.stubGlobal('localStorage', {
    getItem: (k: string) => values.get(k) ?? null,
    setItem: (k: string, v: string) => values.set(k, v),
    removeItem: (k: string) => values.delete(k),
  });
  vi.stubGlobal('window', globalThis);
  vi.stubGlobal('location', { origin: 'http://test', href: 'http://test/' });
  vi.stubGlobal('document', { querySelectorAll: () => [], visibilityState: 'visible' });
  vi.stubGlobal('navigator', { hardwareConcurrency: 2, connection: { saveData: true } });
  vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => setTimeout(() => callback(performance.now()), 16));
  vi.stubGlobal('cancelAnimationFrame', (timer: number) => clearTimeout(timer));
  vi.stubGlobal('Audio', class { volume = 0; play() { return Promise.resolve(); } pause() {} addEventListener() {} });
  vi.stubGlobal('fetch', vi.fn(async (url: string) => {
    const path = new URL(url).pathname.split('/').pop()!;
    // Character art is preloaded in the background; answer it so no rejection outlives a test.
    if (/\.(png|svg|webp)$/.test(path)) return new Response(new Uint8Array([137, 80, 78, 71]), { status: 200 });
    return new Response(files[path] ?? '', { status: files[path] ? 200 : 404, headers: { 'content-type': 'text/yaml' } });
  }));
  setScenePresentationPaused(false);
});
afterEach(() => { vi.clearAllTimers(); vi.useRealTimers(); vi.unstubAllGlobals(); });

async function boot() {
  await settle(loadGameFromUrl('http://test/v/'));
  expect(useVNStore.getState().error?.message).toBeUndefined();
}
/** From the opening line to the first choice. */
async function reachFirstChoice() {
  await boot();
  const { handleAdvance } = await import('./engine');
  useVNStore.getState().setDialog({ typing: false });
  handleAdvance();
  expect(useVNStore.getState().choiceGate.key).toBe('first');
}
const auto = () => JSON.parse(localStorage.getItem(SAVE_KEY) ?? '{}');

describe('death return', () => {
  it('returns from an indirect death (choice → goto → gameOver) to the causing choice with its state', async () => {
    await reachFirstChoice();
    submitChoiceOption(0);
    expect(useVNStore.getState().choiceGate.key).toBe('second');
    submitChoiceOption(0); // Down → pit → say → gameOver
    const { handleAdvance } = await import('./engine');
    useVNStore.getState().setDialog({ typing: false });
    handleAdvance();
    expect(useVNStore.getState().gameOver?.title).toBe('Pit');
    expect(getChoiceRecoverySummary()).toMatchObject({ sceneId: 'hall', actionIndex: 1, failedChoice: { value: 'Down' } });
    // 이어하기 must never land on the death: the auto slot points at the causing choice.
    expect(auto()).toMatchObject({ sceneId: 'hall', actionIndex: 1, routeVars: { trust: 1 } });

    // The map opens on the causing choice; the death itself is not replayable.
    const map = await getStoryMap();
    expect(map.recovery).toBe(hallChoice);
    const deathId = storyNodeId('./0.yaml', 'pit', 1);
    expect(map.current).toBe(deathId);
    expect(map.visits.find(v => v.id === deathId)?.replayable).toBe(false);
    expect(await replayStoryMapNode(deathId)).toBe(false);

    // Game-over panel primary action.
    expect(await settle(loadChoiceRecovery())).toBe(true);
    expect(useVNStore.getState()).toMatchObject({ currentSceneId: 'hall', actionIndex: 1, gameOver: undefined,
      routeVars: { trust: 1 }, choiceGate: { active: true, key: 'second' } });
    expect(useVNStore.getState().inventory.lamp).toBe(true);
  });

  it('returns from the map to the causing choice after an indirect death', async () => {
    await reachFirstChoice();
    submitChoiceOption(0);
    submitChoiceOption(0);
    const { handleAdvance } = await import('./engine');
    useVNStore.getState().setDialog({ typing: false });
    handleAdvance();
    const map = await getStoryMap();
    expect(map.visits.find(v => v.id === map.recovery)?.replayable).toBe(true);
    expect(await settle(replayStoryMapNode(map.recovery!))).toBe(true);
    expect(useVNStore.getState()).toMatchObject({ currentSceneId: 'hall', gameOver: undefined, routeVars: { trust: 1 } });
  });

  it('marks a direct choice death as not replayable and resumes on the choice', async () => {
    await reachFirstChoice();
    submitChoiceOption(1);
    expect(useVNStore.getState().gameOver?.title).toBe('Fell');
    const map = await getStoryMap();
    expect(map.recovery).toBe(startChoice);
    expect(map.visits.find(v => v.id === `${startChoice}:death:1`)?.replayable).toBe(false);
    expect(auto()).toMatchObject({ sceneId: 'start', actionIndex: 1 });
    await boot(); // 이어하기
    expect(useVNStore.getState().gameOver).toBeUndefined();
    expect(useVNStore.getState().choiceGate).toMatchObject({ active: true, key: 'first' });
  });

  it('keeps the choice trail through a restore so a later recoverToChoice still finds its target', async () => {
    await reachFirstChoice();
    submitChoiceOption(0); // first: Left
    // Restore to the second choice (as a map replay or a load would), then take the trap.
    expect(await settle(replayStoryMapNode(hallChoice))).toBe(true);
    expect(useVNStore.getState().choiceGate.key).toBe('second');
    submitChoiceOption(2); // Wait → trap (recoverToChoice: first)
    expect(useVNStore.getState().gameOver?.title).toBe('Trap');
    expect(getChoiceRecoverySummary()).toMatchObject({ sceneId: 'start', actionIndex: 1, failedChoice: { key: 'first', value: 'Left' } });
    expect(auto()).toMatchObject({ sceneId: 'start', actionIndex: 1, routeVars: { trust: 0 } });
    expect((await getStoryMap()).recovery).toBe(startChoice);
  });

  it('never resumes onto a game over even without any choice to return to', async () => {
    files['0.yaml'] = 'script: [{scene: s}]\nscenes:\n  s:\n    actions:\n      - say: {text: Last words}\n      - gameOver: {title: Sudden}\n';
    await boot();
    const { handleAdvance } = await import('./engine');
    useVNStore.getState().setDialog({ typing: false });
    handleAdvance();
    expect(useVNStore.getState().gameOver?.title).toBe('Sudden');
    expect(auto()).toMatchObject({ sceneId: 's', actionIndex: 0 });
    await boot();
    expect(useVNStore.getState().gameOver).toBeUndefined();
  });
});

describe('save slots', () => {
  it('records chapter title, speaker and last line, and deletes a manual slot', async () => {
    await reachFirstChoice();
    const saved = saveCurrentProgress('manual2');
    expect(saved).toMatchObject({ slot: 'manual2', exists: true, chapterTitle: 'Night Station', speaker: 'Mina', line: 'Pick a door.' });
    expect(getSaveSlotSummaries().find(s => s.slot === 'manual2')?.chapterTitle).toBe('Night Station');
    expect(deleteSaveSlot('manual2')).toBe(true);
    expect(getSaveSlotSummaries().find(s => s.slot === 'manual2')?.exists).toBe(false);
  });

  it('resumes the newest save across auto, manual and chapter and reports the same one to the start screen', async () => {
    await reachFirstChoice();
    submitChoiceOption(0);
    vi.setSystemTime(Date.now() + 60_000);
    saveCurrentProgress('manual3'); // at the hall choice, newer than auto
    const later = { ...JSON.parse(localStorage.getItem(`${SAVE_KEY}:manual-3`)!), savedAt: new Date(Date.now() + 120_000).toISOString() };
    localStorage.setItem(`${SAVE_KEY}:manual-3`, JSON.stringify(later));
    const preview = await loadUrlStartScreenPreview('http://test/v/');
    expect(preview.saveStatus).toMatchObject({ status: 'resume', slot: { slot: 'manual3', sceneId: 'hall' } });
    await boot();
    expect(useVNStore.getState().currentSceneId).toBe('hall');
    expect(await settle(loadSaveSlot('auto'))).toBe(true);
  });
});

describe('older-version saves', () => {
  it('continues anyway from the chapter start with variables and items when the saved scene is gone', async () => {
    localStorage.setItem(SAVE_KEY, JSON.stringify({
      gameTitle: 'Versions', gameVersion: '1', savedAt: new Date().toISOString(), chapterIndex: 0, chapterPath: './0.yaml',
      sceneId: 'removed-scene', actionIndex: 4, routeVars: { trust: 7 }, inventory: { lamp: true }, routeHistory: [], storyLog: [],
    }));
    files['config.yaml'] = config('2');
    const preview = await loadUrlStartScreenPreview('http://test/v/');
    expect(preview.saveStatus).toMatchObject({ status: 'older-version', currentVersion: '2', slot: { savedVersion: '1', versionMismatch: true } });
    await boot();
    expect(useVNStore.getState()).toMatchObject({ currentSceneId: 'start', routeVars: { trust: 7 }, gameOver: undefined });
    expect(useVNStore.getState().inventory.lamp).toBe(true);
    expect(useVNStore.getState().resumeNotice).toContain('처음부터');
  });

  it('keeps the story map across a version change and flags it', async () => {
    await reachFirstChoice();
    submitChoiceOption(0);
    files['config.yaml'] = config('2');
    await boot();
    const map = await getStoryMap();
    expect(map.staleVersion).toBe('1');
    expect(map.visits.some(v => v.id === hallChoice)).toBe(true);
    // The cursor still exists in v2, so the old checkpoint stays replayable.
    expect(map.visits.find(v => v.id === startChoice)?.replayable).toBe(true);
  });
});
