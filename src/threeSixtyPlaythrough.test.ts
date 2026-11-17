import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { getChoiceRecoverySummary, handleAdvance, loadGameFromUrl, setScenePresentationPaused, setSkipReadActive, submitChoiceOption } from './engine';
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

const OPEN = '곳간을 열고 쌀을 나눈다.';
const SHUT = '대문을 잠근다.';
const GO = '마포에 간다.';
const STAY = '봉구를 보내고 남는다.';
const RECEIPT = '거래 조건만 이야기한다.';
const CONFESS = '기호가 함께 가자는 이유를 묻는다.';
const CARRY = '어머니를 모시고 간다.';
const SLIP_OUT = '쌀값을 두고 영호와 떠난다.';
const AFRAID = '엄마에게 무섭다고 말한다.';
const JACKET = '잠바를 받는다.';
const SIGN = '서명한다.';
const WALK = '서명을 거절한다.';
const BESIDE = '곁에 남지 못한 후회';
// Which star the dark is asked for first. Once a life is lived its star goes out, so a route
// names only its opening and the explore menu hands back whatever is left after that.
const STAR_1894 = '깨 붙은 엿';
const STAR_1952 = '부두의 고무신';
const STAR_1988 = '갈치 가시';
const OPENING: Route = { where_am_i: '모르겠음', first_light: '손을 뻗는다.' };
const WINTER_JAR = '비어 버린 쌀독';
const WINTER_OUT = '집을 나선 후회';

// The store keeps only the last MAX_STORY_LOG_ENTRIES lines, and a full run of 360 says more
// than that, so the lines from the early lives are gone by the time an ending resolves. Collect
// every line as it is shown instead; that is also closer to what the player saw.
async function play(route: Route, stopAtChoice?: string) {
  const picked: string[] = [];
  const shown: string[] = [];
  const collect = (state: ReturnType<typeof useVNStore.getState>) => {
    for (const entry of state.storyLog) if ('text' in entry && !shown.includes(entry.text)) shown.push(entry.text);
  };
  for (let step = 0; step < 4000; step += 1) {
    const state = useVNStore.getState();
    collect(state);
    if (state.error) throw new Error(`engine error: ${state.error.message}`);
    if (state.isFinished || state.gameOver) break;
    if (state.choiceGate.active && !state.busy) {
      const key = state.choiceGate.key ?? '';
      if (key && key === stopAtChoice) break;
      const options = state.choiceGate.options;
      const wanted = route[key] ?? OPENING[key];
      if (wanted === undefined) throw new Error(`no route for ${key}: ${options.map((o) => o.text).join(' | ')}`);
      let index = options.findIndex((option) => option.text === wanted);
      // The first dark hands back the winter one piece at a time; its menu repeats until the
      // pieces are found, and the star menu drops each life once it has been lived. Take
      // whatever is still there until the route's option shows up.
      if (index < 0 && (state.choiceGate.presentation === 'explore' || state.choiceGate.presentation === 'approach')) index = 0;
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
  it('reveals the first three lives only after approaching the first light', async () => {
    await start();
    const { state, picked, shown } = await play({ where_am_i: '천국' }, 'star');

    expect(picked).toEqual([
      'where_am_i=천국',
      'first_light=손을 뻗는다.',
      'first_light=손을 뻗는다.',
      'first_light=손을 뻗는다.',
    ]);
    expect(heard(shown, '숨을 쉬어 보는데, 내 숨소리도 들리지 않는다.')).toBe(true);
    expect(heard(shown, '어둠 속에 희미한 빛들이 보였다.')).toBe(true);
    expect(state.choiceGate.key).toBe('star');
    expect(state.choiceGate.options.map((option) => option.text)).toEqual([STAR_1894, STAR_1952, STAR_1988]);
    expect(state.routeVars.lives_done).toBe(0);
  });

  it('names the next player only after the light and keeps that name for their thoughts', async () => {
    await start();
    const { state, shown } = await play({ star: STAR_1952 }, 'l2_heart');
    const arrival = shown.findIndex(line => line.includes('부두 사람들이 한꺼번에 바다 쪽을 봤다.'));
    const card = shown.indexOf('1952년 12월\n부산\n내 이름은 순임.');
    expect(arrival).toBeGreaterThan(-1);
    expect(card).toBeGreaterThan(arrival);
    expect(state.game?.pov).toBe('순임');
    expect(state.storyLog).toContainEqual(expect.objectContaining({
      kind: 'dialogue', channel: 'thought', speaker: '순임',
    }));
  });

  it('finds two dots on the medicine packet after going to see the fireworks together', async () => {
    await start();
    const { state, shown } = await play({ star: STAR_1988, l3_open: AFRAID, l3_out: JACKET }, 'v3');

    expect(state.choiceGate.key).toBe('v3');
    expect(state.routeVars.l3_went).toBe(true);
    expect(heard(shown, '점 두 개가 나란히 찍혀 있다')).toBe(true);
    expect(heard(shown, '그날 누나가 그려 온 불꽃이다')).toBe(false);
  });

  it('ends the run at the first light when the player stays and offers that choice again', async () => {
    await start();
    const { state, picked } = await play({ where_am_i: '지옥', first_light: '그대로 있는다.' });

    expect(picked).toEqual(['where_am_i=지옥', 'first_light=그대로 있는다.']);
    expect(state.gameOver?.message).toBe('한참 뒤, 빛이 꺼졌다.');
    expect(state.resolvedEndingId).toBeUndefined();
    expect(state.routeVars.lives_done).toBe(0);
    expect(getChoiceRecoverySummary()?.failedChoice?.key).toBe('first_light');
  });

  it('loses the previous star’s progress, even when it was ready to enter', async () => {
    await start();
    await play({}, 'star');
    const state = useVNStore.getState;

    submitChoiceOption(0);
    submitChoiceOption(0);
    expect(state().choiceGate.approachSteps).toEqual([2, 0, 0]);

    submitChoiceOption(1);
    expect(state().choiceGate.approachSteps).toEqual([0, 1, 0]);
    expect(state().choiceGate.approachSwitched).toBe(true);
    expect(state().dialog.fullText).toContain('한쪽 고무신은 뒤축이 다 닳았다.');
    expect(state().mood).toMatchObject({ tone: 'cold', level: 1 });

    submitChoiceOption(0);
    expect(state().choiceGate.approachSteps).toEqual([1, 0, 0]);
    expect(state().dialog.fullText).toBe('종이가 눅눅하다. 깨가 붙어 있다.');
    expect(state().routeVars.lives_done).toBe(0);

    submitChoiceOption(0);
    expect(state().choiceGate.approachSwitched).toBe(false);
    submitChoiceOption(0);
    expect(state().choiceGate.active).toBe(false);
    expect(state().routeVars.lives_done).toBe(1);
  });

  it('runs the chain in the order the dark is asked for, and looks back at the end', async () => {
    await start();
    const { state, picked, shown } = await play({
      star: STAR_1894,
      l1_rice: OPEN,
      l1_leave: GO,
      v1: '하지 못한 말',
      l2_heart: RECEIPT,
      l2_mother: CARRY,
      v2: '떠난 후회',
      l3_open: AFRAID,
      l3_out: JACKET,
      v3: '해 보지 못한 후회',
      l4_mark: "'가다가 돌아봤다'에 줄을 긋는다.",
      l4_munho: '문호의 말에 반박한다.',
      l4_sign: SIGN,
      l5_leftover: '쉰여섯 해의 기억을 본다.',
      v4: BESIDE,
      w_remember: '울음',
      v_end: WINTER_OUT,
      l5_look: '돌아본다.',
    });
    expect(state.isFinished, picked.join('\n')).toBe(true);
    const firstMemory = shown.indexOf('조금 더 다가가자 어둠 속에 희미한 빛들이 보였다.');
    expect(shown.slice(firstMemory, firstMemory + 2)).toEqual([
      '조금 더 다가가자 어둠 속에 희미한 빛들이 보였다.',
      '종이가 눅눅하다. 깨가 붙어 있다.',
    ]);
    // The first life is free: nothing has been handed down to it yet.
    expect(heard(shown, '웃을 때 왼쪽 눈이 먼저 감긴다')).toBe(true);
    // The first dark answers in Mansuk's own voice and returns him to his daughter.
    expect(heard(shown, '어디서 나는지 찾다가 그만둔다. 내 안에서 난다')).toBe(true);
    expect(heard(shown, '끝순아, 하고 불러 봤다')).toBe(true);
    // What one life holds is what the next life cannot do, and it never knows why.
    expect(heard(shown, '입을 열자 다른 말이 나왔다')).toBe(true);
    expect(heard(shown, '정신을 차려 보니 침대 난간을 쥐고 있다')).toBe(true);
    expect(heard(shown, '그날 누나가 그려 온 불꽃이다')).toBe(true);
    expect(heard(shown, '점 두 개가 나란히 찍혀 있다')).toBe(false);
    expect(heard(shown, '가방끈이 어깨에 걸려 있다')).toBe(true);
    expect(heard(shown, '박다온(53), 오후 두 시')).toBe(true);
    expect(heard(shown, '그때 온 사람이 마지막이었다')).toBe(false);
    // The fifth dark hears the earlier lives back as testimony, then one more thing arrives:
    // the winter that was never judged, because the first time around it could not be.
    expect(shown).toContain('"여든 먹어도 엿은 엿이죠."');
    expect(heard(shown, '바구미 슨 삼백 섬을 그해 가을까지')).toBe(false);
    expect(heard(shown, '사천삼백여든 냥이다')).toBe(true);
    expect(heard(shown, '그날 곳간을 열었더라면')).toBe(false);
    expect(heard(shown, '같은 점은 없어. 360도 어디에도')).toBe(true);
    expect(heard(shown, '하나가 더 온다')).toBe(true);
    expect(heard(shown, '1809년')).toBe(true);
    expect(heard(shown, '울지 않는 걸 괜찮다고 쳤다')).toBe(true);
    // The yard introduces Deok-i before the price of rice. The taffy comes back in the fever
    // and at the end.
    expect(heard(shown, '맡은 쌀에 손대면 그날로 끝이다')).toBe(true);
    const deokArrival = shown.findIndex((text) => text.includes('어미 등에 업혀 왔더라'));
    expect(deokArrival).toBeGreaterThan(-1);
    expect(deokArrival).toBeLessThan(shown.findIndex((text) => text.includes('쌀이 열흘 새')));
    expect(heard(shown, '여든 먹어도 엿은 엿이죠')).toBe(true);
    expect(heard(shown, '종이가 눅눅하다')).toBe(true);
    // The market stall was one seat with two people waiting for it, and the fire asks what the
    // free hand is for. Somebody else answers that question.
    expect(heard(shown, '먼저 낸 사람이 임자지')).toBe(true);
    expect(heard(shown, '비어 있는 손으로 뭘 해야 하는지 알면서 모르는 척한다')).toBe(true);
    expect(heard(shown, '아이 둘은 나왔다. 최 씨는 안 나왔다')).toBe(true);
    expect(heard(shown, '그때는 내가 임자였다')).toBe(true);
    // The habit belongs to one soul across all five lives, and in this one it is the son's.
    expect(heard(shown, '웃을 때 왼쪽 눈이 먼저 감긴다. 제 아비도 그랬다던데')).toBe(true);
    expect(heard(shown, '본 기억은 없는데 저렇게 웃는 얼굴을 전에도 기다린 것 같다')).toBe(true);
    // The ward is where the person finds out, because a ward is a place with time left in it.
    expect(heard(shown, '삼십에서 사십. 우리 반 마흔 명이면 열둘에서 열여섯')).toBe(true);
    expect(heard(shown, '이번엔 내가 입을 다물었다')).toBe(true);
    expect(heard(shown, '그날은 뻗으려는 손이 내 손 같지가 않았다')).toBe(true);
    expect(heard(shown, '누가 고르는 것 같다. 나 말고')).toBe(true);
    expect(heard(shown, '문 쪽을 보다가 이불을 턱 밑까지 끌어 올렸다')).toBe(true);
    // And it carries into its own trial, which gets one step further than the others.
    expect(heard(shown, '지금 보니 고르는 쪽도 나다')).toBe(true);
    // The editor can read the turn-back point in four hundred other people and not in herself.
    expect(heard(shown, '엄마 쪽 수화기가 제자리에 돌아가 있다')).toBe(true);
    const visit = state.storyLog.filter((entry) => entry.kind === 'dialogue').filter((entry) => entry.sceneId === 'glass');
    expect(visit.filter((entry) => entry.speaker === '엄마' && entry.channel === 'dialogue')).toHaveLength(6);
    expect(visit.some((entry) => entry.channel === 'message')).toBe(false);
    expect(heard(shown, '거기다. 열 번 중에 열 번 다 거기서 돌아간다')).toBe(true);
    expect(heard(shown, '전송에 손을 대자 손가락이 굳는다')).toBe(true);
    expect(heard(shown, '‘토요일에’까지는 남겨 둔다')).toBe(true);
    // The fourth face knows her first, and says what is standing behind her when she looks back.
    expect(heard(shown, '아줌마, 어디서 봤는데')).toBe(true);
    expect(heard(shown, '근데 얼굴은 안 보여. 맨날 거기 서 있어')).toBe(true);
    // And the winter names who kept coming back, after the lives are done and before the last
    // thing is taken: one soul, four faces, each one further away than the last.
    expect(heard(shown, '넷 다 웃을 때 왼쪽 눈이 먼저 감겼다')).toBe(true);
    expect(heard(shown, '딸이었다가, 아들이었다가, 옆 침대였다가, 모르는 사람이었다')).toBe(true);
    expect(heard(shown, '이불을 덮어 주고 집에 두고 나간 아이였다')).toBe(true);
    expect(heard(shown, '따라온 것이 아니다. 먼저 와 있었다')).toBe(true);
    expect(heard(shown, '얼굴이 안 보이는 쪽이 나였다')).toBe(true);
    expect(state.routeVars).toMatchObject({
      lives_done: 4, lived_1894: true, lived_1952: true, lived_1988: true, lived_2026: true,
      l1_gave: true, l1_end: 'gone', t_say: true, t_stay: true, t_dare: true,
      t_kin: true, v_end: 'kin', deg_last: '223.7',
    });
    expect(state.resolvedEndingId).toBe('returner');
  }, 120000);

  it('comes full circle when the winter is given the same answer as the life before it', async () => {
    await start();
    const { state, picked, shown } = await play({
      star: STAR_1894,
      l1_rice: SHUT,
      l1_leave: STAY,
      v1: '자유롭게 살고 싶었던 마음',
      l2_heart: CONFESS,
      l2_mother: SLIP_OUT,
      v2: '사람을 믿은 후회',
      l3_open: AFRAID,
      l3_out: JACKET,
      v3: '더 살고 싶었던 마음',
      l4_mark: "'어두웠다'에 줄을 긋는다.",
      l4_munho: '녹음하며 듣는다.',
      l4_sign: WALK,
      l5_leftover: '열일곱 해의 기억을 본다.',
      v4: BESIDE,
      w_remember: '울음',
      v_end: WINTER_OUT,
    }, 'v_end');
    expect(state.choiceGate.key).toBe('v_end');
    const stopped = await play({ v_end: '쥐지 않는다.' }, 'v_end_stop');
    expect(stopped.state.choiceGate.key).toBe('v_end_stop');
    const retried = await play({ v_end_stop: '다시 고른다.' }, 'v_end');
    expect(retried.state.choiceGate.key).toBe('v_end');
    const winter = await play({ v_end: WINTER_OUT });
    expect(winter.state.isFinished, [...picked, ...winter.picked].join('\n')).toBe(true);
    // Shutting the gate is what the daughter defends him for, out at the gate, where he hears it.
    expect(heard(shown, '우리 아버지 그런 사람 아니에요')).toBe(true);
    expect(heard(shown, '그때 온 사람이 마지막이었다')).toBe(true);
    expect(heard(shown, '박다온(53), 오후 두 시')).toBe(false);
    expect(heard(winter.shown, '목록에 이미 있는 숫자다')).toBe(true);
    expect(heard(winter.shown, '같은 점이 두 번이다')).toBe(true);
    expect(winter.state.routeVars).toMatchObject({ l1_end: 'kept', t_kin: true, v_end: 'kin' });
    expect(winter.state.resolvedEndingId).toBe('circle');
  }, 120000);

  it('starts somewhere else when a different star is the one that is missed', async () => {
    await start();
    const { state, picked, shown } = await play({
      star: STAR_1988,
      l3_open: '엄마를 가게로 돌려보낸다.',
      l3_out: '병실에 남는다.',
      v3: '더 살고 싶었던 마음',
      l1_rice: OPEN,
      l1_leave: STAY,
      v1: '자유롭게 살고 싶었던 마음',
      l2_heart: CONFESS,
      l2_mother: CARRY,
      v2: '사람을 믿은 후회',
      l4_mark: "'가다가 돌아봤다'에 줄을 긋는다.",
      l4_munho: '녹음하며 듣는다.',
      l4_sign: SIGN,
      l5_leftover: '보지 않는다.',
      v4: BESIDE,
      w_remember: '울음',
      v_end: WINTER_JAR,
      l5_look: '그대로 간다.',
    });
    expect(state.isFinished, picked.join('\n')).toBe(true);
    // The ward comes first here, so the storehouse is a later life and the editor is still last:
    // only that life can hear the other four back.
    expect(heard(shown, '1988년 9월')).toBe(true);
    expect(heard(shown, '바구미는 체로 치면 된다')).toBe(true);
    // The ward is free because nothing has been handed down to it yet, and after it the chain
    // still runs: 더 살고 싶었다 shuts the storehouse, 매이지 말았어야 shuts the train.
    expect(heard(shown, '손목이 돌아가지 않는다')).toBe(true);
    expect(heard(shown, '열쇠를 돌리려는데 쥔 손에 힘만 더 들어간다')).toBe(true);
    expect(heard(shown, '보따리는 벌써 어깨에 있고')).toBe(true);
    expect(state.routeVars).toMatchObject({ lives_done: 4, t_live: true, v_end: 'hold', deg_last: '041.2' });
    expect(state.resolvedEndingId).toBe('onward');
  }, 120000);

  it('lets a life stay in the dark, after asking once more', async () => {
    await start();
    const { state, picked } = await play({
      star: STAR_1894,
      l1_rice: SHUT,
      l1_leave: GO,
      v1: '쥐지 않는다.',
      v1_stop: '여기 남는다.',
    });
    expect(picked).toContain('v1_stop=여기 남는다.');
    expect(state.resolvedEndingId).toBe('still');
  }, 120000);
});
