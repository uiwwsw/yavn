import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { load } from 'js-yaml';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { handleAdvance, loadGameFromUrl, setScenePresentationPaused, setSkipReadActive, submitChoiceOption, submitInputAnswer } from './engine';
import { parseBaseYaml, parseChapterYaml, parseConfigYaml, resolveChapterGame } from './parser';
import { useVNStore } from './store';

// ERASE, 8비트 심장, 튜토리얼 and 오버플로 are built from the owner's stories. These tests pin
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
  { id: 'erase', chapters: 5, endings: ['erase_loop', 'erased_name', 'kept_photo', 'unfinished'] },
  { id: 'tutorial', chapters: 5, endings: ['disconnected', 'session_closed', 'still_online'] },
  { id: '8bit-heart', chapters: 5, endings: ['new_game', 'off_screen', 'saved_together'] },
  { id: 'overflow', chapters: 5, endings: ['appeal', 'broadcast', 'one_file', 'sealed'] },
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

  const eraseAll = "설정에서 '모든 콘텐츠 및 설정 지우기'를 누른다";
  it.each([
    ['erase_loop', { e3_final: eraseAll }],
    ['erased_name', {
      e1_rumor: '"그런 농담 하지 마요. 팀장님 좀 이상한 사람 같던데"',
      e2_dig: ['단톡방에 "팀장님 전 회사에서 왜 나왔는지 아는 사람?"', '노트북을 덮고 지수한테 "150장"이라고 보낸다'],
      e2_threat: '"형도 조심해요. 세상 좁아요."',
      e3_final: eraseAll,
    }],
    ['kept_photo', {
      e2_photo: '엄지를 떼고 사진첩을 닫는다',
      e3_clinic: '번호표 버튼을 누른다',
      e2_jisu: '"회사에 나랑 엮인 소문이 좀 있어. 정리되면 말할게."',
      e3_final: '사진첩 맨 아래, 놀이터 사진을 연다',
    }],
    ['unfinished', { e2_jisu: '"다 말할게. 듣고 나서 네가 정해."', e3_final: '지수한테 온 메시지 네 개를 연다' }],
  ] as Array<[string, Route]>)('ERASE reaches %s', async (ending, route) => {
    await start('erase');
    const state = await play(route);
    expect(state.gameOver).toBeUndefined();
    expect(state.resolvedEndingId).toBe(ending);
  }, 60000);

  const loyal: Route = {
    b0_buy: '"아저씨, B버튼 뻑뻑한 거 그거 주세요."',
    b2_register: '"응. 세상 망했어. 너랑 나 빼고 다."',
    b3_snack: '"3.5는 무슨." 반쪽까지 집어 먹는다',
    b3_drone: '{{android_name}} 등 뒤에 납작 붙는다',
    b3_promise: '손가락을 건다. "혼자는 무슨. 끝까지 2P로 가."',
  };
  it.each([
    ['saved_together', { ...loyal, b4_save: '새끼손가락 약속 — "끝까지 2P로"' }],
    ['new_game', { ...loyal, b4_save: '빈 슬롯으로 둔다. 가볍게 다녀오라고' }],
    ['off_screen', { ...loyal, b4_save: '"안 해. 저장 안 해. 그냥 튀자."' }],
  ] as Array<[string, Route]>)('8비트 심장 reaches %s', async (ending, route) => {
    await start('8bit-heart');
    const state = await play(route, '비트');
    expect(state.gameOver).toBeUndefined();
    expect(state.routeVars.android_name).toBe('비트');
    expect(state.resolvedEndingId).toBe(ending);
  }, 60000);

  it('8비트 심장 fails recoverably when the smart console is bought', async () => {
    await start('8bit-heart');
    const state = await play({ b0_buy: 'HYPERLINK X 결제. 미래의 내가 갚는다' });
    expect(state.gameOver?.title).toBe('너무 똑똑했던 기기');
  }, 60000);

  it.each([
    ['disconnected', { t4_end: '전원선을 뽑는다' }, ''],
    ['still_online', { t4_end: '모니터를 끄고 나간다. 내일 오픈 근무다' }, ''],
    ['session_closed', {
      t1_pencil: '연필을 내려놓는다',
      t1_pencil_again: '귀 뒤의 밴드를 뗀다',
      t2_sh: '"오늘 하루만 하지 마. 그거."',
      t2_tamper: '아무것도 건드리지 않고 로그아웃한다',
      t3_tell: '"레플라에서 찔렀습니다." 그대로 말한다',
      t3_door: '상혁이 어머니께 전화한다',
      t4_end: '세션 종료 창을 연다',
    }, '0001'],
  ] as Array<[string, Route, string]>)('튜토리얼 reaches %s', async (ending, route, typed) => {
    await start('tutorial');
    const state = await play(route, typed);
    expect(state.gameOver).toBeUndefined();
    expect(state.resolvedEndingId).toBe(ending);
  }, 60000);

  it('튜토리얼 fails recoverably when he names a pillar only the simulation showed', async () => {
    await start('tutorial');
    const state = await play({ t2_where: '"C-14 기둥 쪽… 아닌가요?"' });
    expect(state.gameOver?.title).toBe('아무도 말하지 않은 번호');
  }, 60000);
  // 오버플로's investigation board cycles through whatever is still unexplored, so the route
  // leaves o1_room unset and the player takes the first option still on offer each time.
  const overflowBase: Route = {
    o0_case: '"일당은 없는 거죠?" 봉투를 가져온다',
    o1_show: '"선생님, 제 것도 보시겠습니까." 화면을 돌린다',
    o2_sera: '"올려 주는 게 아니라 틀렸다고 쓰는 거야. 쓸게."',
    o2_deal: '"하나만 묻겠습니다. 배동식 씨도 오버플로입니까."',
    o3_tell: '노기태에게 전화한다',
  };
  it.each([
    ['broadcast', { ...overflowBase, o4_end: '9시 생방송에 나간다. 내 수치부터 띄운다' }],
    ['one_file', { ...overflowBase, o4_end: '배동식 씨 원본만 검찰에 낸다' }],
    ['sealed', {
      ...overflowBase,
      o0_case: '"경위님, 저 이거 하면 뭐가 남습니까."',
      o0_case_again: '"7페이지까지만 보겠습니다."',
      o1_show: '수첩에 날짜만 적는다',
      o2_sera: '"다른 사무소 소개해 줄게. 내가 쓰면 네가 손해야."',
      o2_deal: '"할머니 건은 따로 합니다." 종이를 밀어 놓는다',
      o3_tell: '가방에 넣고 집으로 간다',
      o4_end: '합의서에 날짜를 적어 보낸다',
    }],
    ['appeal', {
      ...overflowBase,
      o0_case: '"한 번만 보고 돌려 드릴게요."',
      o1_show: '"이십 년이면 대단한 겁니다."',
      o2_sera: '"그 서류 누가 요구했어? 병원이야, 시어머니야?"',
      o3_tell: '세라에게 먼저 말한다',
      o4_end: '이의신청서를 쓴다. 이번엔 내 것 말고 전부',
    }],
  ] as Array<[string, Route]>)('오버플로 reaches %s', async (ending, route) => {
    await start('overflow');
    const state = await play(route);
    expect(state.gameOver).toBeUndefined();
    expect(state.resolvedEndingId).toBe(ending);
  }, 60000);

  it('오버플로 fails recoverably when he signs the confidentiality deal', async () => {
    await start('overflow');
    const state = await play({ ...overflowBase, o2_deal: '서명한다' });
    expect(state.gameOver?.title).toBe('서류 한 장');
  }, 60000);

  it('오버플로 fails recoverably when he uses the account that is not his', async () => {
    await start('overflow');
    const state = await play({ ...overflowBase, o4_end: '한수경의 계정으로 자정 전에 내부망에 들어간다' });
    expect(state.gameOver?.title).toBe('남의 계정');
  }, 60000);

  it('오버플로 refuses the case first and still gets there through the second ask', async () => {
    await start('overflow');
    const state = await play({
      ...overflowBase,
      o0_case: '"경위님, 저 이거 하면 뭐가 남습니까."',
      o0_case_again: '"안 합니다. 이의신청서나 쓸게요."',
      o4_end: '배동식 씨 원본만 검찰에 낸다',
    });
    expect(state.gameOver).toBeUndefined();
    expect(state.resolvedEndingId).toBe('one_file');
  }, 60000);
});
