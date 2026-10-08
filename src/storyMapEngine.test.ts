import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { getStoryMap, loadGameFromUrl, loadGameFromZip, replayStoryMapNode, restartFromBeginning, setAutoSaveEnabled, setScenePresentationPaused, submitChoiceOption } from './engine';
import { storyNodeId, visibleStoryChapter } from './storyMap';
import { useVNStore } from './store';
const documents: Record<string, string> = {
  'config.yaml': 'title: Journey\nversion: "1"\ntextSpeed: 30\nautoSave: true\nclickToInstant: true\n',
  'base.yaml': 'state: {trust: 0, hidden: false}\ninventory: {seal: {name: Seal}}\n',
  '0.yaml': `chapterTitle: First
script: [{scene: start}]
scenes:
  start:
    actions:
      - choice:
          prompt: Choose
          options:
            - {text: Hidden, when: {var: hidden, op: eq, value: true}, gameOver: {title: Hidden death}}
            - {text: Fall, gameOver: {title: Fell}}
            - {text: Live, goto: safe, add: {trust: 1}}
  safe:
    actions:
      - get: seal
      - choice:
          prompt: Next
          options: [{text: Next, goto: './1'}]
`,
  '1.yaml': `chapterTitle: Second
script: [{scene: next}]
scenes:
  next:
    actions:
      - choice:
          prompt: Finish
          options: [{text: End, gameOver: {title: Ended}}]
`,
};
let fixtureDocuments = { ...documents };
const startId = storyNodeId('./0.yaml', 'start', 0);
async function settle<T>(promise: Promise<T>): Promise<T> {
  await vi.advanceTimersByTimeAsync(2500);
  return promise;
}
beforeEach(() => {
  vi.useFakeTimers();
  fixtureDocuments = { ...documents };
  const values = new Map<string, string>();
  vi.stubGlobal('localStorage', { getItem: (k: string) => values.get(k) ?? null, setItem: (k: string, v: string) => values.set(k, v), removeItem: (k: string) => values.delete(k) });
  vi.stubGlobal('window', globalThis);
  vi.stubGlobal('location', { origin: 'http://test', href: 'http://test/' });
  vi.stubGlobal('document', { querySelectorAll: () => [], visibilityState: 'visible' });
  vi.stubGlobal('navigator', { hardwareConcurrency: 2, connection: { saveData: true } });
  vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => setTimeout(() => callback(performance.now()), 16));
  vi.stubGlobal('cancelAnimationFrame', (timer: number) => clearTimeout(timer));
  vi.stubGlobal('Audio', class { volume = 0; play() { return Promise.resolve(); } pause() {} addEventListener() {} });
  vi.stubGlobal('fetch', vi.fn(async (url: string) => {
    const path = new URL(url).pathname.split('/').pop()!;
    return new Response(fixtureDocuments[path] ?? '', { status: fixtureDocuments[path] ? 200 : 404, headers: { 'content-type': 'text/yaml' } });
  }));
  setScenePresentationPaused(false);
});
afterEach(() => { setScenePresentationPaused(false); vi.clearAllTimers(); vi.useRealTimers(); vi.unstubAllGlobals(); });
describe('persistent story map replay', () => {
  it('enables earlier scenes for a living player resuming a pre-map save across chapters', async () => {
    const history = [
      { kind: 'choice', key: 'start:0', value: 'Live', chapterPath: './0.yaml', sceneId: 'start', actionIndex: 0 },
      { kind: 'choice', key: 'safe:1', value: 'Next', chapterPath: './0.yaml', sceneId: 'safe', actionIndex: 1 },
    ];
    localStorage.setItem('vn-engine-autosave:path:%2Fjourney', JSON.stringify({
      gameTitle: 'Journey', gameVersion: '1', chapterIndex: 1, chapterPath: './1.yaml', sceneId: 'next', actionIndex: 0,
      routeVars: { trust: 1, hidden: false }, inventory: { seal: true }, routeHistory: history,
      storyLog: history.map(entry => ({ ...entry, prompt: 'Choose' })),
    }));
    await settle(loadGameFromUrl('http://test/journey/'));
    expect(useVNStore.getState().gameOver).toBeUndefined();
    setScenePresentationPaused(true); // The map pauses the game even while the player is alive.
    const before = useVNStore.getState();
    const map = await getStoryMap();
    expect(useVNStore.getState()).toBe(before);
    expect(map.visits).toContainEqual({ id: storyNodeId('./0.yaml', 'safe', 0), replayable: true });
    expect(map.visits).toContainEqual({ id: startId, replayable: true });
    expect(map.visits.some(v => v.id.endsWith(':death:0') || v.id.endsWith(':death:1'))).toBe(false);
    expect(await settle(replayStoryMapNode(startId))).toBe(true);
    expect(useVNStore.getState()).toMatchObject({ currentSceneId: 'start', gameOver: undefined,
      routeVars: { trust: 0, hidden: false }, inventory: { seal: false }, routeHistory: [], choiceGate: { active: true } });
  });
  it('reconstructs a living mid-dialogue save before its first decision without a checkpoint', async () => {
    fixtureDocuments['0.yaml'] = `script: [{scene: start}]
scenes:
  start:
    actions:
      - add: {trust: 2}
      - say: {text: Still alive}
      - choice: {prompt: Next, options: [{text: Stay}]}
`;
    localStorage.setItem('vn-engine-autosave:path:%2Fjourney', JSON.stringify({
      gameTitle: 'Journey', gameVersion: '1', chapterIndex: 0, chapterPath: './0.yaml', sceneId: 'start', actionIndex: 1,
      routeVars: { trust: 2, hidden: false }, inventory: { seal: false }, routeHistory: [],
      storyLog: [{ kind: 'dialogue', text: 'Still alive', chapterPath: './0.yaml', sceneId: 'start', actionIndex: 1 }],
    }));
    await settle(loadGameFromUrl('http://test/journey/'));
    const map = await getStoryMap();
    expect(map.visits).toContainEqual({ id: startId, replayable: true });
    expect(await settle(replayStoryMapNode(startId))).toBe(true);
    expect(useVNStore.getState().routeVars.trust).toBe(2); // The earlier add must not run twice.
    expect(useVNStore.getState().gameOver).toBeUndefined();
  });
  it('uses chronological choices when an old save has revisited the same decision', async () => {
    fixtureDocuments['0.yaml'] = documents['0.yaml'].replace(
      '- {text: Fall, gameOver: {title: Fell}}', '- {text: Again, goto: start, add: {trust: 1}}');
    const history = ['Again', 'Again', 'Live'].map(value => ({ kind: 'choice', key: 'start:0', value,
      chapterPath: './0.yaml', sceneId: 'start', actionIndex: 0 }));
    localStorage.setItem('vn-engine-autosave:path:%2Fjourney', JSON.stringify({
      gameTitle: 'Journey', gameVersion: '1', chapterIndex: 0, chapterPath: './0.yaml', sceneId: 'safe', actionIndex: 1,
      routeVars: { trust: 3, hidden: false }, inventory: { seal: true }, routeHistory: history,
      storyLog: history.map(entry => ({ ...entry, prompt: 'Choose' })),
    }));
    await settle(loadGameFromUrl('http://test/journey/'));
    expect((await getStoryMap()).visits).toContainEqual({ id: startId, replayable: true });
    expect(await settle(replayStoryMapNode(startId))).toBe(true);
    expect(useVNStore.getState().routeVars.trust).toBe(2);
    expect(useVNStore.getState().routeHistory.map(h => h.value)).toEqual(['Again', 'Again']);
  });
  it('does not invent an earlier route when legacy history disagrees with the saved state', async () => {
    localStorage.setItem('vn-engine-autosave:path:%2Fjourney', JSON.stringify({
      gameTitle: 'Journey', gameVersion: '1', chapterIndex: 0, chapterPath: './0.yaml', sceneId: 'safe', actionIndex: 1,
      routeVars: { trust: 99, hidden: false }, inventory: { seal: true }, routeHistory: [],
      storyLog: [{ kind: 'dialogue', text: 'Old scene', chapterPath: './0.yaml', sceneId: 'start', actionIndex: 0 }],
    }));
    await settle(loadGameFromUrl('http://test/journey/'));
    expect((await getStoryMap()).visits).toContainEqual({ id: startId, replayable: false });
    expect(await replayStoryMapNode(startId)).toBe(false);
    expect(useVNStore.getState().routeVars.trust).toBe(99);
  });

  it('records a filtered direct death correctly and restores state without future items or variables', async () => {
    await settle(loadGameFromUrl('http://test/journey/'));
    expect(useVNStore.getState().error).toBeUndefined();
    expect(useVNStore.getState().choiceGate.options).toHaveLength(2);
    submitChoiceOption(0);
    let map = await getStoryMap();
    expect(map.current).toBe(`${startId}:death:1`);
    expect(map.visits.some(v => v.id === `${startId}:death:0`)).toBe(false);
    expect(await settle(replayStoryMapNode(startId))).toBe(true);
    submitChoiceOption(1);
    expect(useVNStore.getState().routeVars.trust).toBe(1);
    expect(useVNStore.getState().inventory.seal).toBe(true);
    useVNStore.getState().patchRouteVars({ future: true });
    expect(await settle(replayStoryMapNode(startId))).toBe(true);
    expect(useVNStore.getState().routeVars).toEqual({ trust: 0, hidden: false });
    expect(useVNStore.getState().inventory.seal).toBe(false);
    map = await getStoryMap();
    expect(map.visits.some(v => v.id === storyNodeId('./0.yaml', 'safe', 1))).toBe(true);
    expect(await replayStoryMapNode(storyNodeId('./1.yaml', 'next', 0))).toBe(false);
  });
  it('preserves exploration through restart/reload and isolates different games', async () => {
    await settle(loadGameFromUrl('http://test/journey/'));
    submitChoiceOption(0);
    await settle(restartFromBeginning());
    expect((await getStoryMap()).visits.some(v => v.id === `${startId}:death:1`)).toBe(true);
    await settle(loadGameFromUrl('http://test/journey/'));
    expect((await getStoryMap()).visits.some(v => v.id === `${startId}:death:1`)).toBe(true);
    await settle(loadGameFromUrl('http://test/other/'));
    expect((await getStoryMap()).visits.some(v => v.id === `${startId}:death:1`)).toBe(false);
  });
  it('reads all chapter graphs without running future actions and connects chapter gateways', async () => {
    await settle(loadGameFromUrl('http://test/journey/'));
    const before = useVNStore.getState().routeVars;
    const map = await getStoryMap();
    expect(map.chapters).toHaveLength(2);
    expect(useVNStore.getState().routeVars).toBe(before);
    expect(map.chapters[0].edges.some(e => e.to === storyNodeId('./1.yaml', 'next', 0))).toBe(true);
    expect(visibleStoryChapter(map.chapters[1], map.visits, map.travelled).nodes).toHaveLength(0);
  });
  it('returns across chapter boundaries with the earlier inventory and keeps both chapters discovered', async () => {
    await settle(loadGameFromUrl('http://test/journey/'));
    submitChoiceOption(1);
    submitChoiceOption(0);
    await vi.advanceTimersByTimeAsync(2500);
    expect(useVNStore.getState().currentSceneId).toBe('next');
    expect(useVNStore.getState().inventory.seal).toBe(true);
    expect(await settle(replayStoryMapNode(startId))).toBe(true);
    expect(useVNStore.getState().inventory.seal).toBe(false);
    const map = await getStoryMap();
    expect(map.current).toBe(startId);
    expect(map.visits.some(v => v.id === storyNodeId('./1.yaml', 'next', 0))).toBe(true);
  });
  it('uses the same map and replay behavior for uploaded ZIP games', async () => {
    vi.useRealTimers();
    vi.stubGlobal('FileReader', class {
      result?: ArrayBuffer;
      onload?: (event: { target: unknown }) => void;
      onerror?: (error: unknown) => void;
      readAsArrayBuffer(blob: Blob) { void blob.arrayBuffer().then(result => {
        this.result = result; this.onload?.({ target: this });
      }).catch(error => this.onerror?.(error)); }
    });
    const { default: JSZip } = await import('jszip');
    const zip = new JSZip();
    Object.entries(documents).forEach(([path, content]) => zip.file(path, content));
    const bytes = await zip.generateAsync({ type: 'arraybuffer' });
    await loadGameFromZip(new File([bytes], 'journey.zip'));
    expect(useVNStore.getState().error).toBeUndefined();
    submitChoiceOption(0);
    const map = await getStoryMap();
    expect(map.chapters).toHaveLength(2);
    expect(map.current).toBe(`${startId}:death:1`);
    expect(await replayStoryMapNode(startId)).toBe(true);
  });
  it('survives storage quota failures without losing in-memory checkpoints', async () => {
    await settle(loadGameFromUrl('http://test/journey/'));
    vi.spyOn(localStorage, 'setItem').mockImplementation(() => { throw new Error('quota'); });
    submitChoiceOption(0);
    expect((await getStoryMap()).persistent).toBe(false);
    expect(await settle(replayStoryMapNode(startId))).toBe(true);
  });
  it('keeps session replay usable when automatic saving is disabled', async () => {
    await settle(loadGameFromUrl('http://test/journey/'));
    setAutoSaveEnabled(false);
    submitChoiceOption(0);
    expect((await getStoryMap()).persistent).toBe(false);
    expect(await settle(replayStoryMapNode(startId))).toBe(true);
  });
});
