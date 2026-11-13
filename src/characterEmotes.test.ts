import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CHARACTER_MOTION_IDS, CHARACTER_MOTIONS, resolveMotionDuration } from './characterEmotes';
import { handleAdvance, loadGameFromUrl, loadSaveSlot, saveCurrentProgress, setScenePresentationPaused, setSkipReadActive } from './engine';
import { parseBaseYaml, parseChapterYaml, parseConfigYaml, resolveChapterGame } from './parser';
import { useVNStore } from './store';

// `emote` / `say.motion`: body-language presets played in place on a staged character.

const documents: Record<string, string> = {
  'config.yaml': 'title: Emotes\nversion: "1"\ntextSpeed: 30\nautoSave: false\nclickToInstant: true\nendings:\n  done:\n    title: 끝\n',
  'base.yaml': `assets:
  characters:
    a:
      base: a.png
      name: 에이
      emotions:
        calm: a.png
        panic: a-panic.png
      emotionMotions:
        panic: tremble
    b:
      base: b.png
      name: 비
`,
  '0.yaml': `script: [{scene: start}]
scenes:
  start:
    actions:
      - char: { id: a, position: left }
      - char: { id: b, position: right }
      - emote: { id: b, motion: sigh, wait: true }
      - say: { char: b, with: [a], text: "한숨 뒤." }
      - say: { char: a, with: [b], motion: nod, text: "끄덕." }
      - say: { char: a, with: [b], motion: nod, text: "또 끄덕." }
      - say: { char: a.panic, with: [b], text: "떨린다." }
      - say: { char: a.panic, with: [b], text: "계속 떨린다." }
      - emote: { id: b, motion: slump }
      - say: { char: b, with: [a], text: "축." }
      - move: { id: b, style: reset }
      - say: { char: b, with: [a], text: "펴졌다." }
      - ending: done
`,
};

const config = parseConfigYaml(documents['config.yaml'], 'config.yaml').data!;
const base = parseBaseYaml(documents['base.yaml'], 'base.yaml').data!;
const resolve = (chapterYaml: string, baseYaml = documents['base.yaml']) => {
  const chapter = parseChapterYaml(chapterYaml, '0.yaml');
  const layer = parseBaseYaml(baseYaml, 'base.yaml');
  return chapter.error ?? layer.error ?? resolveChapterGame({ config, bases: [layer.data!], chapter: chapter.data! }).error;
};

describe('emote schema', () => {
  it('accepts emote actions, inline motions and emotionMotions', () => {
    const chapter = parseChapterYaml(documents['0.yaml'], '0.yaml').data!;
    expect(resolveChapterGame({ config, bases: [base], chapter }).data?.assets.characters.a.emotionMotions)
      .toEqual({ panic: 'tremble' });
    expect(resolve(documents['0.yaml'])).toBeUndefined();
    expect(resolve(documents['0.yaml'].replace('motion: sigh, wait: true', 'motion: laugh, repeat: 3'))).toBeUndefined();
  });

  it('rejects unknown motions, characters, repeats and speakerless inline motions', () => {
    expect(resolve(documents['0.yaml'].replace('motion: sigh', 'motion: dance'))?.message)
      .toContain("unknown motion 'dance'");
    expect(resolve(documents['0.yaml'].replace('motion: nod, text: "끄덕."', 'motion: wiggle, text: "끄덕."'))?.message)
      .toContain('say.motion: unknown motion');
    expect(resolve(documents['0.yaml'].replace('id: b, motion: sigh', 'id: ghost, motion: sigh'))?.message)
      .toContain("emote uses missing character 'ghost'");
    expect(resolve(documents['0.yaml'].replace('wait: true', 'repeat: 4'))).toBeTruthy();
    expect(resolve(documents['0.yaml'].replace('- emote: { id: b, motion: slump }', '- emote: { id: b }'))?.message)
      .toContain("unknown motion 'undefined'");
    expect(resolve(documents['0.yaml'].replace('say: { char: a, with: [b], motion: nod', 'say: { motion: nod'))?.message)
      .toContain('say.motion');
    expect(resolve(documents['0.yaml'], documents['base.yaml'].replace('panic: tremble', 'angry: stomp'))?.message)
      .toContain("emotionMotions uses missing emotion 'angry'");
    expect(resolve(documents['0.yaml'], documents['base.yaml'].replace('panic: tremble', 'panic: wobble'))).toBeTruthy();
  });

  it('defines every preset with a duration and keyframes, holds only slump and droop, and stays still under reduced motion', () => {
    const css = readFileSync(fileURLToPath(new URL('./characterEmotes.css', import.meta.url)), 'utf8');
    expect(CHARACTER_MOTION_IDS.length).toBeGreaterThanOrEqual(16);
    for (const id of CHARACTER_MOTION_IDS) {
      expect(CHARACTER_MOTIONS[id].duration).toBeGreaterThan(0);
      expect(css).toContain(`.character-emote[data-motion='${id}']`);
    }
    expect(CHARACTER_MOTION_IDS.filter((id) => CHARACTER_MOTIONS[id].hold)).toEqual(['slump', 'droop']);
    expect(resolveMotionDuration('laugh', 3)).toBe(CHARACTER_MOTIONS.laugh.duration * 3);
    expect(resolveMotionDuration('slump', 3)).toBe(CHARACTER_MOTIONS.slump.duration);
    // The motion layer never animates the actor's translate/scale/facing transform.
    expect(css).not.toMatch(/\.char[\s.{[]/);
    expect(css).toMatch(/prefers-reduced-motion: reduce\)[\s\S]*?transform: none !important;[\s\S]*?animation: emoteReducedPulse/);
    expect(css).toContain(".app[data-story-paused='true'] .character-emote");
  });
});

describe('emote playback', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    const values = new Map<string, string>();
    vi.stubGlobal('localStorage', {
      getItem: (k: string) => values.get(k) ?? null, setItem: (k: string, v: string) => values.set(k, v),
      removeItem: (k: string) => values.delete(k), key: (i: number) => [...values.keys()][i] ?? null,
      get length() { return values.size; }, clear: () => values.clear(),
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
      if (path.endsWith('.png')) return new Response(new Uint8Array([137, 80, 78, 71]), { status: 200 });
      return new Response(documents[path] ?? '', { status: documents[path] ? 200 : 404 });
    }));
    setScenePresentationPaused(false);
  });

  afterEach(() => {
    setSkipReadActive(false);
    setScenePresentationPaused(false);
    vi.clearAllTimers();
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  // Let the current line finish typing, then advance and look right after the next line starts.
  const next = async () => {
    await vi.advanceTimersByTimeAsync(800);
    handleAdvance(true);
    await vi.advanceTimersByTimeAsync(20);
  };
  const motionOf = (id: string) => useVNStore.getState().characterMotions[id];
  const boot = async () => {
    void loadGameFromUrl('http://test/emotes/');
    // The sigh starts behind the loading cover; story time (and the motion) runs once it lifts.
    for (let i = 0; i < 400; i += 1) {
      const state = useVNStore.getState();
      if (state.characterMotions.b && !state.chapterLoading) break;
      await vi.advanceTimersByTimeAsync(20);
    }
  };

  it('holds the next action until a waited emote ends, and pauses with the story clock', async () => {
    await boot();
    expect(useVNStore.getState().error).toBeUndefined();
    expect(motionOf('b')).toMatchObject({ motion: 'sigh', repeat: 1 });
    expect(useVNStore.getState().dialog.fullText).not.toBe('한숨 뒤.');
    setScenePresentationPaused(true);
    await vi.advanceTimersByTimeAsync(CHARACTER_MOTIONS.sigh.duration * 2);
    expect(useVNStore.getState().dialog.fullText).not.toBe('한숨 뒤.');
    setScenePresentationPaused(false);
    await vi.advanceTimersByTimeAsync(CHARACTER_MOTIONS.sigh.duration + 50);
    expect(useVNStore.getState().dialog.fullText).toBe('한숨 뒤.');
    // A one-shot clears itself so a remounted actor never replays it.
    expect(motionOf('b')).toBeUndefined();
  });

  it('plays inline motions on the speaker, replays a repeated motion and maps emotions to motions', async () => {
    await boot();
    await vi.advanceTimersByTimeAsync(CHARACTER_MOTIONS.sigh.duration + 50);
    await next();
    expect(useVNStore.getState().dialog.fullText).toBe('끄덕.');
    const first = motionOf('a');
    expect(first).toMatchObject({ motion: 'nod' });

    await next();
    expect(useVNStore.getState().dialog.fullText).toBe('또 끄덕.');
    expect(motionOf('a')?.motion).toBe('nod');
    expect(motionOf('a')!.revision).toBeGreaterThan(first!.revision);

    await next();
    expect(useVNStore.getState().dialog.fullText).toBe('떨린다.');
    expect(motionOf('a')?.motion).toBe('tremble');
    await vi.advanceTimersByTimeAsync(CHARACTER_MOTIONS.tremble.duration);
    expect(motionOf('a')).toBeUndefined();

    // Staying in the same emotion does not trigger it again.
    await next();
    expect(useVNStore.getState().dialog.fullText).toBe('계속 떨린다.');
    expect(motionOf('a')).toBeUndefined();

    await next();
    expect(useVNStore.getState().dialog.fullText).toBe('축.');
    expect(motionOf('b')).toMatchObject({ motion: 'slump' });
    await vi.advanceTimersByTimeAsync(CHARACTER_MOTIONS.slump.duration);
    expect(motionOf('b')).toMatchObject({ motion: 'slump', settled: true });

    await next();
    expect(useVNStore.getState().dialog.fullText).toBe('펴졌다.');
    expect(motionOf('b')).toBeUndefined();
  });

  it('does not stall skip mode on a waited emote', async () => {
    const original = documents['0.yaml'];
    documents['0.yaml'] = `script: [{scene: start}]
scenes:
  start:
    actions:
      - char: { id: a, position: left }
      - char: { id: b, position: right }
      - say: { char: a, text: "하나." }
      - emote: { id: b, motion: sob, wait: true }
      - say: { char: b, text: "둘." }
      - goto: start
`;
    try {
      void loadGameFromUrl('http://test/emotes-skip/');
      for (let i = 0; i < 400 && useVNStore.getState().dialog.fullText !== '하나.'; i += 1) await vi.advanceTimersByTimeAsync(20);
      await next();
      // First time through, the waited sob holds the next line.
      expect(useVNStore.getState().busy).toBe(true);
      await vi.advanceTimersByTimeAsync(CHARACTER_MOTIONS.sob.duration + 50);
      expect(useVNStore.getState().dialog.fullText).toBe('둘.');
      await next();
      expect(useVNStore.getState().dialog.fullText).toBe('하나.');

      // Both lines are read now: skipping runs straight past the waited sob.
      setSkipReadActive(true);
      let reachedSecond = false;
      for (let i = 0; i < 20 && !reachedSecond; i += 1) {
        await vi.advanceTimersByTimeAsync(20);
        reachedSecond = useVNStore.getState().dialog.fullText === '둘.';
      }
      expect(reachedSecond).toBe(true);
      expect(motionOf('b')?.motion).toBe('sob');
    } finally {
      setSkipReadActive(false);
      documents['0.yaml'] = original;
    }
  });

  it('does not replay motions when a save is restored', async () => {
    await boot();
    await vi.advanceTimersByTimeAsync(CHARACTER_MOTIONS.sigh.duration + 50);
    await next();
    expect(useVNStore.getState().dialog.fullText).toBe('끄덕.');
    saveCurrentProgress('manual');
    await vi.advanceTimersByTimeAsync(1000);
    expect(motionOf('a')).toBeUndefined();

    void loadSaveSlot('manual');
    for (let i = 0; i < 100 && useVNStore.getState().dialog.fullText !== '끄덕.'; i += 1) await vi.advanceTimersByTimeAsync(20);
    expect(useVNStore.getState().dialog.fullText).toBe('끄덕.');
    expect(useVNStore.getState().characterMotions).toEqual({});

    // Play continues normally after the restored line.
    await next();
    expect(motionOf('a')?.motion).toBe('nod');
  });
});
