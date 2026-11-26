import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { handleAdvance, loadGameFromUrl, setScenePresentationPaused, setSkipReadActive } from './engine';
import { parseBaseYaml, parseChapterYaml, parseConfigYaml, resolveChapterGame } from './parser';
import { useVNStore } from './store';

// `move` (characters closing in on / lunging at / backing away from each other) and
// `place` (a time/place caption in the HUD or between scenes).

const documents: Record<string, string> = {
  'config.yaml': 'title: Blocking\nversion: "1"\ntextSpeed: 30\nautoSave: false\nclickToInstant: true\nendings:\n  done:\n    title: 끝\n',
  'base.yaml': `assets:
  backgrounds:
    office: office.png
    hall: hall.png
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
      - move: { id: b, toward: a, style: exit }
      - say: { char: a, text: "나갔다." }
      - char: { id: b, position: right }
      - say: { char: b, with: [a], text: "다시 왔다." }
      - ending: done
`,
  'captions.yaml': `script: [{scene: start}]
scenes:
  start:
    actions:
      - char: { id: a, position: left }
      - say: { channel: message, char: a, with: [], text: "집에서 보낸 문자." }
      - bg: { id: office, transition: cut, wait: false, place: "월요일 아침 · 회사" }
      - say: { channel: message, text: "회사에서 온 문자." }
      - place: { text: "그날 밤 · {{who}}네 집", presentation: center }
      - say: { text: "다시 집." }
      - ending: done
`,
  'cast.yaml': `script: [{scene: start}]
scenes:
  start:
    actions:
      - char: { id: a, position: left }
      - char: { id: b, position: right }
      - say: { char: a, with: [b], text: "첫 방." }
      - bg: { id: office, transition: cut, wait: false }
      - say: { char: a, text: "새 방." }
      - say: { text: "내레이션도 옛 사람을 부르지 않는다." }
      - say: { char: a, with: [b], text: "둘 다." }
      - bg: { id: hall, transition: cut, wait: false, keepCast: true }
      - say: { char: a, text: "같은 사람들, 다른 각도." }
      - bg: { id: hall, transition: cut, wait: false }
      - say: { char: a, text: "같은 그림." }
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
      const pathname = new URL(url).pathname;
      const path = pathname === '/captions/0.yaml' ? 'captions.yaml' : pathname === '/cast/0.yaml' ? 'cast.yaml' : pathname.split('/').pop()!;
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

  it('shows centered locations between messages and pauses their timer under covered playback', async () => {
    void loadGameFromUrl('http://test/captions/');
    await vi.advanceTimersByTimeAsync(3000);
    expect(useVNStore.getState().dialog.fullText).toBe('집에서 보낸 문자.');
    expect(useVNStore.getState().visibleCharacterIds).toEqual(['a']);

    await next();
    expect(useVNStore.getState()).toMatchObject({
      background: 'http://test/captions/office.png',
      placeCaption: { text: '월요일 아침 · 회사', centered: true },
      dialog: { fullText: '' },
      visibleCharacterIds: [],
    });

    setScenePresentationPaused(true);
    await vi.advanceTimersByTimeAsync(2000);
    expect(useVNStore.getState().placeCaption?.centered).toBe(true);
    setScenePresentationPaused(false);
    await vi.advanceTimersByTimeAsync(1500);
    expect(useVNStore.getState().placeCaption).toBeUndefined();
    expect(useVNStore.getState().dialog.fullText).toBe('회사에서 온 문자.');

    await next();
    expect(useVNStore.getState().placeCaption).toMatchObject({ text: '그날 밤 · 지수네 집', centered: true });
    await vi.advanceTimersByTimeAsync(1500);
    expect(useVNStore.getState().dialog.fullText).toBe('다시 집.');
  });

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
    state = useVNStore.getState();
    expect(state.dialog.fullText).toBe('나갔다.');
    // b (right) leaves a (left): off the right edge.
    expect(state.characterStances.b).toMatchObject({ style: 'exit', x: 60 });

    // Placing b again is a fresh entrance; the walk-off must not leave b past the edge.
    await next();
    state = useVNStore.getState();
    expect(state.dialog.fullText).toBe('다시 왔다.');
    expect(state.characterStances.b).toBeUndefined();

    await next();
    expect(useVNStore.getState().resolvedEndingId).toBe('done');
  });

  it('sends the visible cast out with the old place unless keepCast is set', async () => {
    void loadGameFromUrl('http://test/cast/');
    await vi.advanceTimersByTimeAsync(3000);
    expect(useVNStore.getState().dialog.fullText).toBe('첫 방.');
    expect([...useVNStore.getState().visibleCharacterIds].sort()).toEqual(['a', 'b']);

    // A new place: whoever stood in the old one leaves with it; only the next line's cast comes back.
    await next();
    let state = useVNStore.getState();
    expect(state.background).toBe('http://test/cast/office.png');
    expect(state.dialog.fullText).toBe('새 방.');
    expect(state.visibleCharacterIds).toEqual(['a']);

    await next();
    expect(useVNStore.getState().dialog.fullText).toBe('내레이션도 옛 사람을 부르지 않는다.');
    expect(useVNStore.getState().visibleCharacterIds).toEqual(['a']);

    await next();
    expect([...useVNStore.getState().visibleCharacterIds].sort()).toEqual(['a', 'b']);

    // Same room, another angle: the cast stays.
    await next();
    state = useVNStore.getState();
    expect(state.background).toBe('http://test/cast/hall.png');
    expect(state.dialog.fullText).toBe('같은 사람들, 다른 각도.');
    expect([...state.visibleCharacterIds].sort()).toEqual(['a', 'b']);

    // Naming the picture already on screen changes nothing.
    await next();
    state = useVNStore.getState();
    expect(state.dialog.fullText).toBe('같은 그림.');
    expect([...state.visibleCharacterIds].sort()).toEqual(['a', 'b']);
  });
});
