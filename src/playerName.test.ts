import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { getSaveSlotSummaries, handleAdvance, loadGameFromUrl, loadSaveSlot, saveCurrentProgress, setScenePresentationPaused, setSkipReadActive, submitInputAnswer } from './engine';
import { parseBaseYaml, parseChapterYaml, parseConfigYaml, resolveChapterGame } from './parser';
import { useVNStore } from './store';
import { collectTextVariables, interpolateText } from './textVariables';
// The engine imports the YAML parser lazily; it is already loaded through the import above.

const documents: Record<string, string> = {
  'config.yaml': 'title: Names\nversion: "1"\ntextSpeed: 30\nautoSave: true\nclickToInstant: true\nendings:\n  done:\n    title: "{{player_name}}의 결말"\n',
  'base.yaml': `assets:
  characters:
    hero:
      base: hero.png
      name: "{{player_name}}"
state:
  player_name: "서연"
`,
  '0.yaml': `script: [{scene: start}]
scenes:
  start:
    actions:
      - input:
          prompt: "이름은?"
          saveAs: player_name
          defaultValue: "서연"
          maxLength: 6
      - say: {char: hero, text: "나는 {{player_name}}이다."}
      - ending: done
`,
};

describe('text variables', () => {
  it('fills declared placeholders and leaves unknown ones visible', () => {
    expect(interpolateText('안녕, {{ name }}!', { name: '연' })).toBe('안녕, 연!');
    expect(interpolateText('{{missing}} 그대로', {})).toBe('{{missing}} 그대로');
    expect(collectTextVariables('{{a}} and {{ b_2 }}')).toEqual(['a', 'b_2']);
  });

  it('picks the Korean particle that agrees with the name', () => {
    const say = (name: string, text: string) => interpolateText(text, { name });
    expect(say('서연', '{{name|은}} {{name|를}} {{name|와}} {{name|으로}}')).toBe('서연은 서연을 서연과 서연으로');
    expect(say('하나', '{{name|는}} {{name|이}} {{name|을}} {{name|로}}')).toBe('하나는 하나가 하나를 하나로');
    expect(say('달', '{{name|으로}}')).toBe('달로');
    expect(say('Ann', '{{name|은}}')).toBe('Ann은(는)');
    expect(say('7', '{{name|이}}')).toBe('7이');
    expect(collectTextVariables('{{ name | 은 }}')).toEqual(['name']);
  });

  it('rejects placeholders that name undeclared state', () => {
    const config = parseConfigYaml(documents['config.yaml'], 'config.yaml').data!;
    const base = parseBaseYaml(documents['base.yaml'], 'base.yaml').data!;
    const chapter = parseChapterYaml(documents['0.yaml'].replace('{{player_name}}이다', '{{player}}이다'), '0.yaml').data!;
    const resolved = resolveChapterGame({ config, bases: [base], chapter });
    expect(resolved.error?.message).toContain("unknown variable '{{player}}'");
  });

  it('requires saveAs when input has no correct answer', () => {
    const chapter = parseChapterYaml(documents['0.yaml'].replace('          saveAs: player_name\n', ''), '0.yaml');
    expect(chapter.error?.message).toContain('scenes.start.actions.0');
  });
});

describe('free text name input', () => {
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

  async function begin() {
    void loadGameFromUrl('http://test/names/');
    await vi.advanceTimersByTimeAsync(2500);
    expect(useVNStore.getState().inputGate).toMatchObject({ active: true, correct: undefined, defaultValue: '서연', maxLength: 6 });
  }

  it('stores the typed name and uses it in dialogue and the speaker label', async () => {
    await begin();
    submitInputAnswer('  연   이름이아주긴사람  ');
    await vi.advanceTimersByTimeAsync(1500);
    const state = useVNStore.getState();
    expect(state.routeVars.player_name).toBe('연 이름이아');
    expect(state.dialog.speaker).toBe('연 이름이아');
    expect(state.dialog.fullText).toBe('나는 연 이름이아이다.');
  });

  it('keeps three independent manual save slots', async () => {
    await begin();
    submitInputAnswer('연');
    await vi.advanceTimersByTimeAsync(1500);
    expect(saveCurrentProgress('manual2')).toMatchObject({ slot: 'manual2', exists: true });
    const summaries = Object.fromEntries(getSaveSlotSummaries().map((slot) => [slot.slot, slot.exists]));
    expect(summaries).toMatchObject({ manual: false, manual2: true, manual3: false });
    expect(localStorage.getItem('vn-engine-autosave:path:%2Fnames:manual-2')).toBeTruthy();
    const loading = loadSaveSlot('manual2');
    await vi.advanceTimersByTimeAsync(2500);
    expect(await loading).toBe(true);
    expect(useVNStore.getState().routeVars.player_name).toBe('연');
  });

  it('falls back to the default when the field is left empty', async () => {
    await begin();
    submitInputAnswer('   ');
    await vi.advanceTimersByTimeAsync(1500);
    expect(useVNStore.getState().routeVars.player_name).toBe('서연');
    expect(useVNStore.getState().dialog.fullText).toBe('나는 서연이다.');
    handleAdvance(true);
    await vi.advanceTimersByTimeAsync(1500);
    expect(useVNStore.getState().resolvedEndingId).toBe('done');
  });
});
