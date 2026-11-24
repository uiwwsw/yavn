import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { load } from 'js-yaml';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { handleAdvance, loadGameFromUrl, setScenePresentationPaused, setSkipReadActive, submitChoiceOption, submitInputAnswer } from './engine';
import { parseBaseYaml, parseChapterYaml, parseConfigYaml, resolveChapterGame } from './parser';
import { useVNStore } from './store';

// ERASE and 8비트 심장 are built from the owner's stories. These tests pin
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
  { id: 'erase', chapters: 5, endings: ['erase_loop', 'side_seat', 'two_names', 'unfinished', 'walked_past'] },
  { id: '8bit-heart', chapters: 5, endings: ['new_game', 'no_response', 'off_screen', 'saved_together'] },
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
      ...Object.values(asRecord(assets.sfx)),
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

it('keeps the android’s manual and promise quotations intact', () => {
  const robotLines = [2, 3, 4].flatMap((chapter) =>
    collectKey(load(read('8bit-heart', `${chapter}.yaml`)), 'say')
      .map(asRecord)
      .filter(({ char }) => typeof char === 'string' && char.split('.')[0] === '로봇')
      .map(({ text }) => String(text)));
  expect(robotLines.filter((line) => (line.match(/'/g)?.length ?? 0) % 2)).toEqual([]);
  expect(robotLines).toEqual(expect.arrayContaining([
    expect.stringContaining("'처음 켜면 이름을 입력하세요.'"),
    "'2P는 컨트롤러를 따로 구입하세요.'",
    "'추운 곳에서는 건전지가 빨리 닳습니다.'",
    "'전원을 끄기 전에 반드시 저장하세요.'",
    "'끝까지 2P.'",
  ]));
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
    ['side_seat', { e2_listen: '그 사람 얘기를 더 해 달라고 한다', e5_final: '사진관으로 간다' }],
    ['erase_loop', { e5_final: '3층으로 올라간다' }],
    ['two_names', { e2_jisu: '사실대로 말한다', e4_tell: '전부 말한다', e5_final: '지수에게 전화한다' }],
    ['unfinished', { e2_jisu: '앨범 얘기만 했다고 한다', e4_tell: '아무 일도 없다고 한다', e5_final: '지수에게 전화한다' }],
    ['walked_past', { e1_photo: '사진을 지운다', e2_listen: '앨범만 받고 일어난다' }],
  ] as Array<[string, Route]>)('ERASE reaches %s', async (ending, route) => {
    await start('erase');
    const state = await play(route);
    expect(state.gameOver).toBeUndefined();
    expect(state.resolvedEndingId).toBe(ending);
  }, 60000);

  const loyal: Route = {
    b0_buy: '중고 게임기를 산다',
    b2_register: '밖에서 무슨 일이 있었는지 말한다',
    b3_snack: '내 몫의 복숭아를 다 먹는다',
    b3_drone: '{{android_name}} 뒤에 숨는다',
    b3_promise: '끝까지 함께하겠다고 약속한다',
  };
  it.each([
    ['saved_together', { ...loyal, b4_save: '새끼손가락 약속' }],
    ['new_game', { ...loyal, b4_save: '슬롯을 비워 둔다' }],
    ['off_screen', { ...loyal, b4_save: '저장을 그만두고 도망친다' }],
  ] as Array<[string, Route]>)('8비트 심장 reaches %s', async (ending, route) => {
    await start('8bit-heart');
    const state = await play(route, '비트');
    expect(state.gameOver).toBeUndefined();
    expect(state.routeVars.android_name).toBe('비트');
    expect(state.resolvedEndingId).toBe(ending);
  }, 60000);

  it('8비트 심장 fails recoverably when the smart console is bought', async () => {
    await start('8bit-heart');
    const state = await play({ b0_buy: 'HYPERLINK X를 산다' });
    expect(state.gameOver?.title).toBe('너무 똑똑했던 기기');
    const lines = state.storyLog.flatMap(entry => 'text' in entry ? [entry.text] : []);
    expect(lines.some(text => text.includes('뉴스를 종이에 찍은 거야'))).toBe(true);
    expect(lines.some(text => /B버튼\? 아직 뻑뻑해|세 겹 싸 줬어/.test(text))).toBe(false);
  }, 60000);


});
