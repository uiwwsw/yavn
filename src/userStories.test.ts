import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { load } from 'js-yaml';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { handleAdvance, loadGameFromUrl, setScenePresentationPaused, setSkipReadActive, submitChoiceOption, submitInputAnswer } from './engine';
import { parseBaseYaml, parseChapterYaml, parseConfigYaml, resolveChapterGame } from './parser';
import { useVNStore } from './store';

// ERASE, ERASE: 먼저 지운 사람 and 8비트 심장 are built from the owner's stories. These tests pin
// their structure (schema, assets, endings, fair failures) and play each one to every ending
// through the real engine. Background transitions are served in their non-waiting short form
// because there is no renderer here to report that a dissolve finished.

type UnknownRecord = Record<string, unknown>;
const publicRoot = fileURLToPath(new URL('../public/', import.meta.url));
const asRecord = (value: unknown): UnknownRecord =>
  value !== null && typeof value === 'object' && !Array.isArray(value) ? (value as UnknownRecord) : {};
const collectKey = (value: unknown, key: string, result: unknown[] = []): unknown[] => {
  if (Array.isArray(value)) {
    value.forEach((entry) => collectKey(entry, key, result));
    return result;
  }
  const record = asRecord(value);
  if (Object.prototype.hasOwnProperty.call(record, key)) result.push(record[key]);
  Object.values(record).forEach((entry) => collectKey(entry, key, result));
  return result;
};

const games = [
  { id: 'erase', chapters: 4, endings: ['erase_loop', 'kept_photo', 'unfinished'] },
  { id: 'erase-first', chapters: 5, endings: ['erased_name', 'new_life', 'waiting_room'] },
  { id: '8bit-heart', chapters: 5, endings: ['new_game', 'off_screen', 'saved_together'] },
];

const read = (game: string, file: string) => readFileSync(`${publicRoot}game-list/${game}/${file}`, 'utf8');
const assetFile = (game: string, path: string) =>
  path.startsWith('root:/') ? `${publicRoot}${path.slice('root:/'.length)}` : `${publicRoot}game-list/${game}/${path}`;

describe.each(games)('$id structure', ({ id, chapters, endings }) => {
  const files = Array.from({ length: chapters }, (_, index) => `${index}.yaml`);
  const documents = files.map((file) => load(read(id, file)) as UnknownRecord);

  it('resolves every chapter through the production schema', () => {
    const config = parseConfigYaml(read(id, 'config.yaml'), `${id}/config.yaml`);
    const base = parseBaseYaml(read(id, 'base.yaml'), `${id}/base.yaml`);
    expect(config.error ?? base.error).toBeUndefined();
    files.forEach((file) => {
      const chapter = parseChapterYaml(read(id, file), `${id}/${file}`);
      expect(chapter.error, file).toBeUndefined();
      expect(resolveChapterGame({ config: config.data!, bases: [base.data!], chapter: chapter.data! }).error, file).toBeUndefined();
    });
  });

  it('ships every declared asset', () => {
    const baseDoc = load(read(id, 'base.yaml')) as UnknownRecord;
    const assets = asRecord(baseDoc.assets);
    const paths = [
      ...Object.values(asRecord(assets.backgrounds)),
      ...Object.values(asRecord(assets.music)),
      ...collectKey(assets.characters, 'base'),
      ...collectKey(assets.characters, 'emotions').flatMap((entry) => Object.values(asRecord(entry))),
      ...collectKey(baseDoc.inventory, 'image'),
    ].map(String);
    expect(paths.length).toBeGreaterThan(20);
    paths.forEach((path) => expect(existsSync(assetFile(id, path)), path).toBe(true));
  });

  it('wires every ending and lets every failure return to its cause', () => {
    const config = load(read(id, 'config.yaml')) as UnknownRecord;
    expect(Object.keys(asRecord(config.endings)).sort()).toEqual(endings);
    const used = new Set(documents.flatMap((doc) => collectKey(doc, 'ending')).map(String));
    endings.forEach((ending) => expect(used.has(ending), ending).toBe(true));
    const keys = new Set(documents.flatMap((doc) => collectKey(doc, 'choice').map((choice) => String(asRecord(choice).key))));
    documents.flatMap((doc) => collectKey(doc, 'gameOver')).forEach((failure) =>
      expect(keys.has(String(asRecord(failure).recoverToChoice))).toBe(true));
  });
});

type Route = Record<string, string | string[]>;

async function play(route: Route, name = '') {
  const seen = new Map<string, number>();
  for (let step = 0; step < 4000; step += 1) {
    const state = useVNStore.getState();
    if (state.error) throw new Error(`engine error: ${state.error.message}`);
    if (state.isFinished || state.gameOver) break;
    if (state.inputGate.active && !state.busy) {
      submitInputAnswer(name);
    } else if (state.choiceGate.active && !state.busy) {
      const key = state.choiceGate.key ?? '';
      const planned = route[key];
      const count = seen.get(key) ?? 0;
      seen.set(key, count + 1);
      const wanted = Array.isArray(planned) ? planned[Math.min(count, planned.length - 1)] : planned;
      const options = state.choiceGate.options;
      const index = wanted === undefined ? 0 : options.findIndex((option) => option.text === wanted);
      if (index < 0) throw new Error(`"${wanted}" not offered at ${key}: ${options.map((o) => o.text).join(' | ')}`);
      submitChoiceOption(index, true);
    } else {
      handleAdvance(true);
    }
    await vi.advanceTimersByTimeAsync(400);
  }
  return useVNStore.getState();
}

describe('owner story playthroughs', () => {
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
      const path = new URL(url).pathname.replace(/^\//, '');
      try {
        const source = readFileSync(`${publicRoot}${path}`, 'utf8');
        const body = path.endsWith('.yaml') ? source.replace(/- bg: \{ id: ([a-z_]+)[^}]*\}/g, '- bg: $1') : source;
        return new Response(body, { status: 200 });
      } catch {
        return new Response('', { status: 404 });
      }
    }));
    setScenePresentationPaused(false);
  });

  afterEach(() => {
    setSkipReadActive(false);
    vi.clearAllTimers();
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  async function start(game: string) {
    void loadGameFromUrl(`http://test/game-list/${game}/`);
    await vi.advanceTimersByTimeAsync(3000);
  }

  it.each([
    ['erase_loop', { e3_final: '다 지운다. 이번에도' }],
    ['kept_photo', { e2_photo: '남겨 둔다', e2_jisu: '"…회사에 일이 좀 있어. 나도 아직 정리가 안 됐어." 일부만 말한다', e3_final: '남겨 둔 아이 사진을 연다' }],
    ['unfinished', { e2_jisu: '"다 말할게. 듣고 나서 정해." 전부 말한다', e3_final: '지수의 마지막 메시지를 연다' }],
  ] as Array<[string, Route]>)('ERASE reaches %s', async (ending, route) => {
    await start('erase');
    const state = await play(route);
    expect(state.gameOver).toBeUndefined();
    expect(state.resolvedEndingId).toBe(ending);
  }, 60000);

  const quiet: Route = { f0_public: '"오늘 처음 봤어요." 웃으며 넘긴다', f1_dig: '노트북을 덮는다', f1_threat: '아무 말 없이 문이 열리길 기다린다' };
  it.each([
    ['waiting_room', { ...quiet, f3_clinic: '번호표를 뽑는다' }],
    ['new_life', { ...quiet, f3_clinic: '돌아선다. 들키는 게 더 무섭다' }],
    ['erased_name', {
      f0_public: '"형, 농담이죠." 선을 긋는다',
      f1_dig: ['준성의 SNS를 처음부터 끝까지 뒤진다', '병원 예약 문자가 보였던 걸 떠올리며 추측한다', '단톡방에 은근히 흘린다', '노트북을 덮는다'],
      f1_threat: '"형도 조심하세요. 세상 좁아요."',
      f3_clinic: '돌아선다. 들키는 게 더 무섭다',
    }],
  ] as Array<[string, Route]>)('ERASE: 먼저 지운 사람 reaches %s', async (ending, route) => {
    await start('erase-first');
    const state = await play(route);
    expect(state.gameOver).toBeUndefined();
    expect(state.resolvedEndingId).toBe(ending);
  }, 60000);

  const loyal: Route = {
    b0_buy: '싸구려 레트로 게임기를 산다',
    b2_register: '"응. 세상이 망했어."',
    b3_snack: '"너는 안 먹잖아." 웃으며 받는다',
    b3_drone: '{{android_name}} 뒤에 숨는다',
    b3_promise: '"같이 가. 약속해. 끝까지 같이." 손가락을 건다',
  };
  it.each([
    ['saved_together', { ...loyal, b4_save: '끝까지 같이 가자던 약속' }],
    ['new_game', { ...loyal, b4_save: '아무것도 옮기지 않는다. 가볍게 보낸다' }],
    ['off_screen', { ...loyal, b4_save: '"가지 마. 같이 도망치자."' }],
  ] as Array<[string, Route]>)('8비트 심장 reaches %s', async (ending, route) => {
    await start('8bit-heart');
    const state = await play(route, '비트');
    expect(state.gameOver).toBeUndefined();
    expect(state.routeVars.android_name).toBe('비트');
    expect(state.resolvedEndingId).toBe(ending);
  }, 60000);

  it('8비트 심장 fails recoverably when the smart console is bought', async () => {
    await start('8bit-heart');
    const state = await play({ b0_buy: '최신 휴대용 기기를 산다' });
    expect(state.gameOver?.title).toBe('너무 똑똑했던 기기');
  }, 60000);
});
