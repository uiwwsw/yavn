import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { handleAdvance, loadGameFromUrl, restartFromBeginning, setScenePresentationPaused, setSkipReadActive } from './engine';
import { ReadHistory, readLineKey } from './readHistory';
import { useVNStore } from './store';
// The engine imports the YAML parser lazily. Load it up front so the first game load
// does not wait on real module transformation while fake timers are advanced.
import './parser';

const documents: Record<string, string> = {
  'config.yaml': 'title: Skip\nversion: "1"\ntextSpeed: 30\nautoSave: true\nclickToInstant: true\n',
  '0.yaml': `script: [{scene: start}]
scenes:
  start:
    actions:
      - say: {text: One}
      - say: {text: Two}
      - say: {text: Three}
      - choice:
          prompt: Pick
          options:
            - {text: Left, goto: left}
            - {text: Right, goto: right}
  left:
    actions:
      - say: {text: Left line}
      - say: {text: Left end}
      - gameOver: {title: Left}
  right:
    actions:
      - say: {text: Right line}
      - say: {text: Right end}
      - gameOver: {title: Right}
`,
};

async function settle<T>(value: Promise<T> | T, ms = 2500): Promise<T> {
  await vi.advanceTimersByTimeAsync(ms);
  return value;
}

const text = () => useVNStore.getState().dialog.fullText;

async function advance() {
  handleAdvance(true);
  await vi.advanceTimersByTimeAsync(400);
  if (useVNStore.getState().dialog.typing) {
    handleAdvance(true);
    await vi.advanceTimersByTimeAsync(50);
  }
}

beforeEach(() => {
  vi.useFakeTimers();
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
    return new Response(documents[path] ?? '', { status: documents[path] ? 200 : 404, headers: { 'content-type': 'text/yaml' } });
  }));
  setScenePresentationPaused(false);
});

afterEach(() => {
  setSkipReadActive(false);
  vi.clearAllTimers();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe('ReadHistory', () => {
  it('reports whether a line was read before and persists across loads', () => {
    vi.useRealTimers();
    const history = new ReadHistory();
    history.load('game:read-lines');
    const key = readLineKey('./0.yaml', 'start', 0);
    expect(history.markRead(key)).toBe(false);
    expect(history.markRead(key)).toBe(true);
    history.flush();
    const reloaded = new ReadHistory();
    reloaded.load('game:read-lines');
    expect(reloaded.has(key)).toBe(true);
    expect(reloaded.has(readLineKey('./1.yaml', 'start', 0))).toBe(false);
  });
});

describe('skip read text', () => {
  it('fast-forwards read lines, stops at choices, and stops at the first unread line', async () => {
    await settle(loadGameFromUrl('http://test/skip/'));
    expect(text()).toBe('One');
    await advance();
    await advance();
    expect(text()).toBe('Three');

    await settle(restartFromBeginning());
    expect(text()).toBe('One');
    setSkipReadActive(true);
    await settle(Promise.resolve(), 3000);
    expect(useVNStore.getState().choiceGate.active).toBe(true);
    expect(useVNStore.getState().skipReadActive).toBe(false);

    // A new branch is unread: skipping stops on its first line.
    const { submitChoiceOption } = await import('./engine');
    submitChoiceOption(1);
    await settle(Promise.resolve(), 1500);
    expect(text()).toBe('Right line');
    setSkipReadActive(true);
    await settle(Promise.resolve(), 1500);
    expect(text()).toBe('Right line');
    expect(useVNStore.getState().skipReadActive).toBe(false);
  });
});
