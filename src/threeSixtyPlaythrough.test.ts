import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { handleAdvance, loadGameFromUrl, setScenePresentationPaused, setSkipReadActive, submitChoiceOption } from './engine';
import { useVNStore } from './store';
// The engine imports the YAML parser lazily. Load it up front so the first game load
// does not wait on real module transformation while fake timers are advanced.
import './parser';

// Lives 360 from the first dark to an ending through the real engine, choosing options by
// choice key. Background transitions are served in their non-waiting short form because
// there is no renderer here to report that a dissolve finished; everything else is the
// shipped YAML.
const publicRoot = fileURLToPath(new URL('../public/', import.meta.url));
const serve = (path: string): string | undefined => {
  try {
    const source = readFileSync(`${publicRoot}${path.replace(/^\//, '')}`, 'utf8');
    return path.endsWith('.yaml') ? source.replace(/- bg: \{ id: ([a-z_]+)[^}]*\}/g, '- bg: $1') : source;
  } catch {
    return undefined;
  }
};

type Route = Record<string, string>;

const OPEN = '곳간을 연다. 한 집에 닷 되씩, 가을에 받는다.';
const SHUT = '문을 닫아건다. 값은 더 오른다.';
const GO = '마포에 올라간다. 사흘이면 돌아온다.';
const STAY = '봉구를 대신 보내고 곁에 남는다.';
const RECEIPT = '돈 얘기만 한다. 삼백오십만 원, 영수증에 도장까지 받는다.';
const CONFESS = '돈보다 먼저 묻는다. 같이 가자는 게 점방인지, 나인지.';
const CARRY = '어머이를 일으킨다. 업고라도 같이 간다고 한다.';
const SLIP_OUT = '머리맡에 쌀 한 말 값을 놓고 나온다.';
const AFRAID = '"엄마, 나 무서워."';
const JACKET = '잠바를 받는다.';
const SIGN = '서명한다. 원본은 방송국이 갖는다.';
const WALK = '서명하지 않는다. 증언자들을 한 명씩 다시 찾아간다.';
const BESIDE = '곁에 있었어야 했다.';

// The store keeps only the last MAX_STORY_LOG_ENTRIES lines, and a full run of 360 says more
// than that, so the lines from the early lives are gone by the time an ending resolves. Collect
// every line as it is shown instead; that is also closer to what the player saw.
async function play(route: Route, maxSteps = 4000) {
  const picked: string[] = [];
  const shown: string[] = [];
  const collect = (state: ReturnType<typeof useVNStore.getState>) => {
    for (const entry of state.storyLog) if ('text' in entry && !shown.includes(entry.text)) shown.push(entry.text);
  };
  for (let step = 0; step < maxSteps; step += 1) {
    const state = useVNStore.getState();
    collect(state);
    if (state.error) throw new Error(`engine error: ${state.error.message}`);
    if (state.isFinished || state.gameOver) break;
    if (state.choiceGate.active && !state.busy) {
      const key = state.choiceGate.key ?? '';
      const options = state.choiceGate.options;
      const wanted = route[key];
      if (wanted === undefined) throw new Error(`no route for ${key}: ${options.map((o) => o.text).join(' | ')}`);
      const index = options.findIndex((option) => option.text === wanted);
      if (index < 0) throw new Error(`option "${wanted}" not offered at ${key}: ${options.map((o) => o.text).join(' | ')}`);
      picked.push(`${key}=${options[index].text}`);
      submitChoiceOption(index, true);
    } else {
      handleAdvance(true);
    }
    await vi.advanceTimersByTimeAsync(400);
  }
  collect(useVNStore.getState());
  return { state: useVNStore.getState(), picked, shown };
}

const heard = (shown: string[], fragment: string): boolean => shown.some((text) => text.includes(fragment));

beforeEach(() => {
  vi.useFakeTimers();
  const values = new Map<string, string>();
  vi.stubGlobal('localStorage', { getItem: (k: string) => values.get(k) ?? null, setItem: (k: string, v: string) => values.set(k, v), removeItem: (k: string) => values.delete(k) });
  vi.stubGlobal('window', globalThis);
  vi.stubGlobal('location', { origin: 'http://test', href: 'http://test/game-list/360/' });
  vi.stubGlobal('document', { querySelectorAll: () => [], visibilityState: 'visible' });
  vi.stubGlobal('navigator', { hardwareConcurrency: 2, connection: { saveData: true } });
  vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => setTimeout(() => callback(performance.now()), 16));
  vi.stubGlobal('cancelAnimationFrame', (timer: number) => clearTimeout(timer));
  vi.stubGlobal('Audio', class { volume = 0; play() { return Promise.resolve(); } pause() {} addEventListener() {} });
  vi.stubGlobal('fetch', vi.fn(async (url: string) => {
    const body = serve(new URL(url).pathname);
    return new Response(body ?? '', { status: body === undefined ? 404 : 200 });
  }));
  setScenePresentationPaused(false);
});

afterEach(() => {
  setSkipReadActive(false);
  vi.clearAllTimers();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

async function start() {
  void loadGameFromUrl('http://test/game-list/360/');
  await vi.advanceTimersByTimeAsync(3000);
}

describe('360 full playthrough', () => {
  it('refuses the choice each inherited direction cannot make, and remembers when it looks back', async () => {
    await start();
    const { state, picked, shown } = await play({
      v0: '독이 비지 않았더라면.',
      l1_rice: OPEN,
      l1_leave: GO,
      v1: '말을 했어야 했다.',
      l2_heart: RECEIPT,
      l2_mother: CARRY,
      v2: '떠나지 말았어야 했다.',
      l3_open: AFRAID,
      l3_out: JACKET,
      v3: '한 번은 해 볼걸.',
      l4_mark: "'가다가 돌아봤다'에 줄을 긋는다.",
      l4_munho: '"그건 선생님이 모르시는 일이에요."',
      l4_sign: SIGN,
      l5_leftover: '제일 처음 놓고 온 것을 본다.',
      v4: BESIDE,
      l5_look: '돌아본다.',
    });
    expect(state.isFinished, picked.join('\n')).toBe(true);
    // The fifth dark leaks the earlier lives back as unattributed testimony — the thing this life
    // spent its working years transcribing — and the editor recognises it by the detail nobody
    // would invent, then counts the years the four voices add up to.
    expect(heard(shown, '바구미는 체로 치면 된다')).toBe(true);
    expect(heard(shown, '백아흔여섯 해')).toBe(true);
    // It can also look at the thing it put down in the first dark, which has no year attached.
    expect(heard(shown, '223.7. 그날 나가지 않았더라면')).toBe(true);
    // The hoarder cannot open the storehouse, the one who says everything cannot ask for a receipt,
    // the one who stays cannot take the jacket, and the one who dares cannot sit down and sign.
    expect(heard(shown, '손목이 돌아가지 않는다')).toBe(true);
    expect(heard(shown, '나온 말은 그게 아니다')).toBe(true);
    expect(heard(shown, '손은 침대 난간을 잡고 있다')).toBe(true);
    expect(heard(shown, '가방끈이 어깨에 걸려 있다')).toBe(true);
    expect(state.routeVars).toMatchObject({
      v0: 'hold', l1_gave: false, l1_end: 'gone', v1: 'say', l2_told: true, l2_asked: true,
      v2: 'stay', l3_said: true, l3_went: false, v3: 'dare', l4_signed: false, l4_refuted: true, looked_back: true,
    });
    expect(state.resolvedEndingId).toBe('returner');
  }, 120000);

  it('comes full circle when the last thing held is the first thing held', async () => {
    await start();
    const { state, picked, shown } = await play({
      v0: '그날 나가지 않았더라면.',
      l1_rice: OPEN,
      l1_leave: GO,
      v1: '어디에도 매이지 말았어야 했다.',
      l2_heart: RECEIPT,
      l2_mother: CARRY,
      v2: '아무도 믿지 말았어야 했다.',
      l3_open: AFRAID,
      l3_out: JACKET,
      v3: '더 살고 싶었다.',
      l4_mark: "'어두웠다'에 줄을 긋는다.",
      l4_munho: '녹음기를 끄지 않고 듣고만 있는다.',
      l4_sign: WALK,
      l5_leftover: '제일 나중에 놓고 온 것을 본다.',
      v4: BESIDE,
    });
    expect(state.isFinished, picked.join('\n')).toBe(true);
    // Before the last choice the stake is stated: the maths teacher said no point repeats in 360
    // degrees, and this is the one place where that can be tested. Closing the circle says so.
    expect(heard(shown, '같은 점은 없어. 360도 어디에도')).toBe(true);
    expect(heard(shown, '목록에 이미 있는 숫자다')).toBe(true);
    expect(heard(shown, '같은 점이 두 번이다')).toBe(true);
    expect(heard(shown, '발이 넘어가지 않는다')).toBe(true);
    expect(heard(shown, '보따리는 벌써 어깨에 있고')).toBe(true);
    expect(heard(shown, '입이 닫힌다')).toBe(true);
    expect(heard(shown, '손은 펜을 쥐고 있다')).toBe(true);
    expect(state.routeVars).toMatchObject({
      v0: 'kin', l1_gave: true, l1_end: 'poor', v1: 'free', l2_told: false, l2_asked: false,
      v2: 'guard', l3_said: false, l3_went: true, v3: 'live', l4_signed: true, looked_back: false,
      v4: 'kin', deg_last: '223.7',
    });
    expect(state.resolvedEndingId).toBe('circle');
  }, 120000);

  it('goes on to a different point when the last life regrets something else', async () => {
    await start();
    const { state } = await play({
      v0: '독이 비지 않았더라면.',
      l1_rice: SHUT,
      l1_leave: STAY,
      v1: '어디에도 매이지 말았어야 했다.',
      l2_heart: CONFESS,
      l2_mother: SLIP_OUT,
      v2: '아무도 믿지 말았어야 했다.',
      l3_open: '"괜찮대요. 가게 가 보세요."',
      l3_out: '"누나 혼자 가요. 엄마가 여섯 시에 와요."',
      v3: '더 살고 싶었다.',
      l4_mark: "'가다가 돌아봤다'에 줄을 긋는다.",
      l4_munho: '녹음기를 끄지 않고 듣고만 있는다.',
      l4_sign: SIGN,
      l5_leftover: '보지 않는다.',
      v4: BESIDE,
      l5_look: '그대로 간다.',
    });
    expect(state.routeVars).toMatchObject({ v0: 'hold', l1_end: 'kept', l2_told: true, v4: 'kin', deg_last: '223.7' });
    expect(state.resolvedEndingId).toBe('onward');
  }, 120000);

  it('lets a life stay in the dark, after asking once more', async () => {
    await start();
    const { state, picked } = await play({
      v0: '독이 비지 않았더라면.',
      l1_rice: SHUT,
      l1_leave: GO,
      v1: '쥐지 않는다.',
      v1_stop: '없다. 여기 있는다.',
    });
    expect(picked).toContain('v1_stop=없다. 여기 있는다.');
    expect(state.resolvedEndingId).toBe('still');
  }, 120000);
});
