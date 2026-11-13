import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { handleAdvance, loadGameFromUrl, setScenePresentationPaused, setSkipReadActive } from './engine';
import { parseBaseYaml, parseChapterYaml, parseConfigYaml, resolveChapterGame } from './parser';
import { useVNStore } from './store';

// `move` (characters closing in on / lunging at / backing away from each other) and
// `place` (a time/place caption that never waits for input).

const documents: Record<string, string> = {
  'config.yaml': 'title: Blocking\nversion: "1"\ntextSpeed: 30\nautoSave: false\nclickToInstant: true\nendings:\n  done:\n    title: 끝\n',
  'base.yaml': `assets:
  characters:
    a:
      base: a.png
      name: 에이
    b:
      base: b.png
      name: 비
state:
  who: "지수"
`,
  '0.yaml': `script: [{scene: start}]
scenes:
  start:
    actions:
      - place: "토요일 오전 · {{who}}네 집"
      - char: { id: a, position: left }
      - char: { id: b, position: right }
      - move: { id: b, toward: a, style: lunge, wait: true }
      - say: { char: b, with: [a], text: "가까이." }
      - move: { id: a, toward: b, style: retreat }
      - say: { char: a, with: [b], text: "물러서." }
      - move: { id: a, style: flinch, toward: b }
      - say: { char: a, with: [b], text: "움찔." }
      - move: { id: b, style: reset }
      - move: { id: a, toward: camera }
      - say: { char: a, with: [b], text: "카메라로." }
      - ending: done
`,
};

describe('stage blocking schema', () => {
  const config = parseConfigYaml(documents['config.yaml'], 'config.yaml').data!;
  const base = parseBaseYaml(documents['base.yaml'], 'base.yaml').data!;

  it('accepts move and place actions', () => {
    const chapter = parseChapterYaml(documents['0.yaml'], '0.yaml');
    expect(chapter.error).toBeUndefined();
    expect(resolveChapterGame({ config, bases: [base], chapter: chapter.data! }).error).toBeUndefined();
  });

  it('rejects unknown characters, self-targets and unknown styles', () => {
    const resolve = (yaml: string) => {
      const chapter = parseChapterYaml(yaml, '0.yaml');
      return chapter.error ?? resolveChapterGame({ config, bases: [base], chapter: chapter.data! }).error;
    };
    expect(resolve(documents['0.yaml'].replace('toward: a, style: lunge', 'toward: ghost, style: lunge'))?.message).toContain("moves missing character 'ghost'");
    expect(resolve(documents['0.yaml'].replace('id: b, toward: a', 'id: b, toward: b'))?.message).toContain('move target must differ');
    expect(resolve(documents['0.yaml'].replace('style: lunge', 'style: dance'))).toBeTruthy();
  });

  it('adds the stance offset to the character transform and keeps reduced motion still', () => {
    const styles = readFileSync(fileURLToPath(new URL('./styles.css', import.meta.url)), 'utf8');
    expect(styles).toContain('+ var(--char-stance-x, 0cqw))');
    expect(styles).toContain('scale: calc(var(--char-scale) * var(--char-stance-scale, 1));');
    expect(styles).toMatch(/prefers-reduced-motion: reduce\)[\s\S]*?\.char\.stance-lunge[\s\S]*?--character-position-duration: 0ms;/);
  });
});

describe('stage blocking playback', () => {
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
      if (path.endsWith('.png')) return new Response(new Uint8Array([137, 80, 78, 71]), { status: 200 });
      return new Response(documents[path] ?? '', { status: documents[path] ? 200 : 404 });
    }));
    setScenePresentationPaused(false);
  });

  afterEach(() => {
    setSkipReadActive(false);
    vi.clearAllTimers();
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  const next = async () => {
    handleAdvance(true);
    await vi.advanceTimersByTimeAsync(800);
  };

  it('moves characters toward and away from each other and shows the place caption', async () => {
    void loadGameFromUrl('http://test/blocking/');
    await vi.advanceTimersByTimeAsync(3000);
    let state = useVNStore.getState();
    expect(state.placeCaption?.text).toBe('토요일 오전 · 지수네 집');
    expect(state.dialog.fullText).toBe('가까이.');
    // b stands on the right, so lunging at a (left) moves it toward screen left.
    expect(state.characterStances.b).toMatchObject({ style: 'lunge', x: -13, scale: 1.09 });

    await next();
    state = useVNStore.getState();
    expect(state.dialog.fullText).toBe('물러서.');
    // a (left) backs away from b (right): further left.
    expect(state.characterStances.a).toMatchObject({ style: 'retreat', x: -7 });

    await next();
    state = useVNStore.getState();
    expect(state.dialog.fullText).toBe('움찔.');
    // A flinch is a jolt that returns to the stance it interrupted.
    expect(state.characterStances.a).toMatchObject({ style: 'retreat', x: -7 });

    await next();
    state = useVNStore.getState();
    expect(state.dialog.fullText).toBe('카메라로.');
    expect(state.characterStances.b).toBeUndefined();
    expect(state.characterStances.a).toMatchObject({ style: 'approach', x: 0, scale: 1.12 });

    await next();
    expect(useVNStore.getState().resolvedEndingId).toBe('done');
  });
});
