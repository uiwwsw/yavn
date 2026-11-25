import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { handleAdvance, loadGameFromUrl, resetApproachProgress, setScenePresentationPaused, setSkipReadActive, submitChoiceOption } from './engine';
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
const GO = '마포에 가서 정동 약까지 사 온다.';
const STAY = '봉구를 보내고 남는다.';
const RECEIPT = '거래 조건만 이야기한다.';
const CONFESS = '기호가 함께 가자는 이유를 묻는다.';
const CARRY = '어머이를 깨워 같이 가자고 한다.';
const SLIP_OUT = '쌀값을 두고 영호와 떠난다.';
const AFRAID = '엄마에게 무섭다고 말한다.';
const JACKET = '잠바를 받는다.';
const SIGN = '서명한다.';
const WALK = '서명을 거절한다.';
// What the dark offers to hold is named after a memory, and the same words come back in the
// fifth dark beside the number they tilted to.
const SAID = '끝순이한테 끝내 말하지 못한 것';
const WOLMIDO = '열쇠를 풀고 끝순이랑 월미도에 가 보지 못한 것';
const UNCOUNTED = '세어 보지도 않고 전대를 건넨 것';
const LEFT_HER = '어머이를 판잣집에 두고 나온 것';
const TRANSPLANT = '이식 날짜까지 살지 못한 것';
const BRIDGE = '약봉지 속 다리를 걸어 보지 못한 것';
const BESIDE = '유리 너머 엄마 곁에 있지 못한 것';
const ORIGINALS = '녹취 원본을 쥐고 있지 못한 것';
const SAVINGS = '통장에 장례비만큼 쥐고 있지 못한 것';
// Which star the dark is asked for first. Once a life is lived its star goes out, so a route
// names only its opening and the explore menu hands back whatever is left after that.
const STAR_1894 = '마루의 밥상';
const STAR_1952 = '부두의 고무신';
const STAR_1988 = '갈치 가시';
const OPENING: Route = { first_light: '손을 뻗는다.' };
const WINTER_JAR = '독에 좁쌀을 쥐고 있지 못한 것';
const WINTER_BESIDE = '이불 속 아이 곁에 있지 못한 것';
const WINTER_LEAVE = '그 겨울은 두고 간다.';
const WINTER_OPEN_HAND = '손을 편다.';

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

// Opens a run that has already lived the four lives, at the start of a scene in a later chapter.
// The winter is where every ending is decided, and each one is reached from here in seconds.
async function startAt(chapter: number, sceneId: string, routeVars: Record<string, unknown>) {
  localStorage.setItem('vn-engine-autosave:game:360', JSON.stringify({
    gameTitle: '360', gameVersion: '2.0.0', savedAt: new Date().toISOString(),
    chapterIndex: chapter, chapterPath: `${chapter}.yaml`, sceneId, actionIndex: 0,
    backgroundAssetId: 'void_near',
    routeVars: {
      lives_done: 4, lived_1894: true, lived_1952: true, lived_1988: true, lived_2026: true,
      l1_end: 'gone', l2_told: true, l3_said: false, t_say: true, t_guard: true, t_live: true,
      ...routeVars,
    },
    inventory: {}, routeHistory: [], storyLog: [],
  }));
  await start();
}

describe('360 full playthrough', () => {
  it('reveals the first three lives only after approaching the first light', async () => {
    await start();
    const { state, picked, shown } = await play({}, 'star');

    expect(picked).toEqual([
      'first_light=손을 뻗는다.',
      'first_light=손을 뻗는다.',
      'first_light=손을 뻗는다.',
    ]);
    // The first dark opens on the novel's own three beats, and never on a missing body.
    expect(shown.slice(0, 3)).toEqual(['암흑.', '끊임없는 공허함.', '눈을 떴다.']);
    expect(heard(shown, '숨소리')).toBe(false);
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

  it('lets Manseok recognize his body, name and daughter before the granary dispute', async () => {
    await start();
    const { state, shown } = await play({ star: STAR_1894 }, 'l1_rice');
    const beats = [
      '어느 집 마당이지.', '묵직한 열쇠 꾸러미다.', '만석 어른, 어디 편찮으십니까?',
      '어젯밤에도 저 사람과 곳간 쌀을 세었다.', '아버지, 봉구 오라버니 것도 퍼요?',
      '내 뒤에는 아무도 없다.', '내 딸이다.', '오냐. 봉구 것도 퍼라.',
      '덕이 어멈이 화도진 사람 열댓을 데리고 왔습니다.',
    ].map(fragment => shown.findIndex(line => line.includes(fragment)));
    expect(beats.every(index => index >= 0)).toBe(true);
    for (let i = 1; i < beats.length; i += 1) expect(beats[i]).toBeGreaterThan(beats[i - 1]);
    expect(state.storyLog).toContainEqual(expect.objectContaining({
      kind: 'dialogue', speaker: '사내', text: '만석 어른, 어디 편찮으십니까?',
    }));
    expect(state.storyLog).toContainEqual(expect.objectContaining({
      kind: 'dialogue', channel: 'thought', speaker: '만석',
      text: '봉구다. 어젯밤에도 저 사람과 곳간 쌀을 세었다.',
    }));
    expect(state.routeVars).toMatchObject({ lives_done: 1, l1_rice_blocked: false, l1_leave_blocked: false });
    expect(state.choiceGate.options.map(option => option.text)).toEqual([OPEN, SHUT]);
  });

  it('resumes a previous-version yard save at the same line without replaying the arrival', async () => {
    localStorage.setItem('vn-engine-autosave:game:360', JSON.stringify({
      gameTitle: '360', gameVersion: '1.2.1', savedAt: new Date().toISOString(),
      chapterIndex: 0, chapterPath: '0.yaml', sceneId: 'yard', actionIndex: 5,
      backgroundAssetId: 'jemulpo_yard',
      routeVars: { lives_done: 1, lived_1894: true }, inventory: {}, routeHistory: [], storyLog: [],
    }));
    await start();
    const state = useVNStore.getState();
    expect(state).toMatchObject({ currentSceneId: 'yard', actionIndex: 5,
      routeVars: { lives_done: 1, lived_1894: true },
      dialog: { fullText: '주인어른, 덕이 어멈이 화도진 사람 열댓을 데리고 왔습니다.' } });
    expect(state.storyLog.some(entry => entry.sceneId?.startsWith('arrival_1894'))).toBe(false);
  });

  it('finds two dots on the medicine packet after going to see the fireworks together', async () => {
    await start();
    const { state, shown } = await play({ star: STAR_1988, l3_open: AFRAID, l3_out: JACKET }, 'v3');

    expect(state.choiceGate.key).toBe('v3');
    expect(state.routeVars.l3_went).toBe(true);
    expect(heard(shown, '점 두 개가 나란히 찍혀 있다')).toBe(true);
    expect(heard(shown, '그날 누나가 그려 온 불꽃이다')).toBe(false);
  });

  it('does not remember a blocked movement when Minjae chose to stay in the ward', async () => {
    await start();
    const { state, shown } = await play({
      star: STAR_1894,
      l1_rice: SHUT,
      l1_leave: STAY,
      v1: WOLMIDO,
      l2_heart: CONFESS,
      l2_mother: SLIP_OUT,
      v2: UNCOUNTED,
      l3_open: '엄마를 가게로 돌려보낸다.',
      l3_out: '병실에 남는다.',
    }, 'v3');

    expect(state.choiceGate.key).toBe('v3');
    expect(state.routeVars.l3_out_blocked).toBe(false);
    expect(heard(shown, '엄마가 동의서를 들고 서 있던 게 생각난다')).toBe(true);
    expect(heard(shown, '그날 난간을 쥔 손은 아무리 힘을 줘도 펴지지 않았다')).toBe(false);
    expect(heard(shown, '그날 누나가 그려 온 불꽃이다')).toBe(true);
    const bridgePlan = shown.findIndex(text => text.includes('퇴원하면 이 다리 끝까지 걸어 볼 거야'));
    expect(bridgePlan).toBeGreaterThan(-1);
    expect(shown.indexOf('…저도 같이 걸어도 돼요?')).toBeGreaterThan(bridgePlan);
  });

  it('ends in Stillness before any of the lives if the player stays', async () => {
    await start();
    const { state, picked } = await play({ first_light: '그대로 있는다.', first_wait: '여기 남는다.' });

    expect(picked).toEqual(['first_light=그대로 있는다.', 'first_wait=여기 남는다.']);
    expect(state.gameOver).toBeUndefined();
    expect(state.resolvedEndingId).toBe('still');
    expect(state.routeVars.lives_done).toBe(0);
  });

  it('asks once more before the first dark ends the story, like every later dark', async () => {
    await start();
    const { state, picked, shown } = await play({ first_light: '그대로 있는다.', first_wait: '손을 뻗는다.' }, 'star');

    expect(picked).toEqual(['first_light=그대로 있는다.', 'first_wait=손을 뻗는다.']);
    expect(heard(shown, '깜박이는 사이가 숨 쉬는 것과 비슷하다')).toBe(true);
    expect(state.isFinished).toBe(false);
    expect(state.choiceGate.key).toBe('star');
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
    expect(state().dialog.fullText).toBe('소반 위에 밥이 두 그릇이다. 한 자리가 비어 있다.');
    expect(state().routeVars.lives_done).toBe(0);

    submitChoiceOption(0);
    expect(state().choiceGate.approachSwitched).toBe(false);
    submitChoiceOption(0);
    expect(state().choiceGate.active).toBe(false);
    expect(state().routeVars.lives_done).toBe(1);
  });

  it('starts a new streak after a background tap and enters the last star on tap three', async () => {
    localStorage.setItem('vn-engine-autosave:game:360', JSON.stringify({
      gameTitle: '360', gameVersion: '1.4.0', savedAt: new Date().toISOString(),
      chapterIndex: 0, chapterPath: '0.yaml', sceneId: 'stars', actionIndex: 0,
      backgroundAssetId: 'void_light',
      routeVars: { lives_done: 3, lived_1894: true, lived_1952: true, lived_1988: true },
      inventory: {}, routeHistory: [], storyLog: [],
    }));
    await start();
    const state = useVNStore.getState;
    expect(state().choiceGate.options.map(option => option.text)).toEqual(['답장을 못 받은 사람']);
    submitChoiceOption(0);
    submitChoiceOption(0);
    resetApproachProgress();
    expect(state().choiceGate.approachSteps).toEqual([0]);
    expect(state().dialog.fullText).toBe(state().choiceGate.prompt);
    expect(state().mood).toBeUndefined();
    submitChoiceOption(0);
    submitChoiceOption(0);
    expect(state().currentSceneId).toBe('stars');
    expect(state().routeHistory).toHaveLength(0);
    submitChoiceOption(0);
    expect(state().currentSceneId).toBe('go_2026');
    expect(state().routeHistory).toContainEqual(expect.objectContaining({ key: 'star', value: '답장을 못 받은 사람' }));
  });

  it('runs the chain in the order the dark is asked for, and looks back at the end', async () => {
    await start();
    const { state, picked, shown } = await play({
      star: STAR_1894,
      l1_rice: OPEN,
      l1_leave: GO,
      v1: SAID,
      l2_heart: RECEIPT,
      l2_mother: CARRY,
      v2: LEFT_HER,
      l3_open: AFRAID,
      l3_out: JACKET,
      v3: BRIDGE,
      l4_mark: "'가다가 돌아봤다'에 줄을 긋는다.",
      l4_munho: '문호의 말에 반박한다.',
      l4_sign: SIGN,
      l5_leftover: '쉰여섯 해의 기억을 본다.',
      v4: BESIDE,
      w_remember: '울음',
      v_end: WINTER_BESIDE,
      l5_look: '돌아본다.',
    });
    expect(state.isFinished, picked.join('\n')).toBe(true);
    const firstMemory = shown.indexOf('조금 더 다가가자 어둠 속에 희미한 빛들이 보였다.');
    expect(shown.slice(firstMemory, firstMemory + 2)).toEqual([
      '조금 더 다가가자 어둠 속에 희미한 빛들이 보였다.',
      '소반 위에 밥이 두 그릇이다. 한 자리가 비어 있다.',
    ]);
    // The first life is free: nothing has been handed down to it yet.
    expect(heard(shown, '까치발을 해도 모자란다')).toBe(true);
    // The first dark answers in Mansuk's own voice and returns him to his daughter.
    expect(heard(shown, '어디서 나는지 찾다가 그만둔다. 내 안에서 난다')).toBe(true);
    expect(heard(shown, '끝순아, 하고 불러 봤다')).toBe(true);
    // What one life holds is what the next life cannot do, and it never knows why.
    expect(heard(shown, '입을 열자 다른 말이 나왔다')).toBe(true);
    // The moment a held thing shuts a door, its number flashes and the body tilts toward it.
    expect(shown).toContain('118.5°');
    expect(shown).toContain('251.0°');
    expect(shown).toContain('339.4°');
    expect(heard(shown, '정신을 차려 보니 침대 난간을 쥐고 있다')).toBe(true);
    expect(heard(shown, '그날 누나가 그려 온 불꽃이다')).toBe(true);
    const bridgePlan = shown.findIndex(text => text.includes('퇴원하면 이 다리 끝까지 걸어 볼 거야'));
    expect(bridgePlan).toBeGreaterThan(-1);
    expect(shown.indexOf('…저도 같이 걸어도 돼요?')).toBeGreaterThan(bridgePlan);
    expect(heard(shown, '점 두 개가 나란히 찍혀 있다')).toBe(false);
    expect(heard(shown, '가방끈이 어깨에 걸려 있다')).toBe(true);
    // The fifth dark lays each held regret beside what it stopped in the next life, by the
    // same words the dark offered it under. The first life held nothing yet, so it has no pair.
    expect(shown).toContain(`118.5 — ${SAID}`);
    expect(shown).toContain(`307.9 — ${WOLMIDO}`);
    expect(heard(shown, '118.5를 쥐고 간 부두에서는 영수증을 달라는 말이 나오지 않았다')).toBe(true);
    expect(heard(shown, '251.0을 쥐고 간 병실에서는 잠바 대신 난간을 쥐었다')).toBe(true);
    expect(heard(shown, '339.4를 쥐고 간 편집실에서는 펜을 들었는데 가방끈이 어깨에 걸려 있었다')).toBe(true);
    expect(heard(shown, '편집실에서는 일어서려는데')).toBe(false);
    expect(heard(shown, '막힌 적이 없었다')).toBe(false);
    expect(heard(shown, '포구에서는')).toBe(false);
    expect(heard(shown, '박다온(53), 오후 두 시')).toBe(true);
    expect(heard(shown, '그때 온 사람이 마지막이었다')).toBe(false);
    // The fifth dark hears the earlier lives back as testimony, then one more thing arrives:
    // the winter that was never judged, because the first time around it could not be.
    expect(shown).toContain('"아버지는 맨날 다 식은 다음에 오시잖아요."');
    expect(heard(shown, '쌀에 벌레가 났다고 하니 체로 치면')).toBe(false);
    expect(heard(shown, '거래 마쳤다. 약값도 넉넉히 남았어.')).toBe(true);
    // He goes for the medicine as much as for the deal, tucks her in, and comes back with it.
    expect(heard(shown, '제물포에는 그게 끝이랍니다')).toBe(true);
    expect(heard(shown, '그 애 이불을 턱 밑까지 여며 준다')).toBe(true);
    expect(heard(shown, '허리에서 전대 속 약병 두 개가 부딪친다')).toBe(true);
    expect(heard(shown, '약값이며 빚 걱정')).toBe(false);
    expect(heard(shown, '그날 곳간을 열었더라면')).toBe(false);
    expect(heard(shown, '같은 자리는 없을 거라고 생각해요')).toBe(true);
    expect(heard(shown, '하나가 더 온다')).toBe(true);
    expect(heard(shown, '1809년')).toBe(true);
    // Years are never skipped in one cut: each long gap is told back year by year.
    const train = shown.findIndex(text => text.includes('그 기차가 다섯 해만 일찍 놓였더라면'));
    expect(train).toBeGreaterThan(-1);
    expect(train).toBeLessThan(shown.findIndex(text => text.includes('불이나 끄지 마라')));
    expect(heard(shown, '열쇠를 뺏긴 지 열다섯 해')).toBe(false);
    expect(heard(shown, '가락지를 들고 금방에 갔다')).toBe(true);
    expect(heard(shown, '명부에 이름이 있는 걸 보고 운 건 그때가 처음이었다')).toBe(true);
    expect(heard(shown, '이식 날짜는 달력에 동그라미로만 남았다')).toBe(true);
    expect(heard(shown, '마흔세 번째 면회를 예약해 둔 날이었다')).toBe(true);
    expect(heard(shown, '직원이 문을 두드릴 때까지 수화기를 내려놓지 않았다')).toBe(true);
    expect(heard(shown, '다온이가 처음 면회를 왔다. 마흔아홉이었다')).toBe(true);
    expect(heard(shown, '다큐국이 없어졌다')).toBe(false);
    expect(heard(shown, '울지 않는 걸 괜찮다고 쳤다')).toBe(true);
    expect(heard(shown, '귀퉁이 하나 들춰져 있지 않았다')).toBe(true);
    expect(heard(shown, '좁쌀 자루를 내려놓지도 못하고 문턱에 서 있었다')).toBe(true);
    // Deok-i is a person before the granary is a dispute. The daughter's wish to share
    // a meal returns in the illness and in the final memories.
    expect(heard(shown, '맡은 쌀에 손대면 그날로 끝이다')).toBe(true);
    const deokArrival = shown.findIndex((text) => text.includes('어미 등에 업혀 왔더라'));
    expect(deokArrival).toBeGreaterThan(-1);
    expect(deokArrival).toBeLessThan(shown.findIndex((text) => text.includes('쌀값이 또 뛰었습니다')));
    expect(heard(shown, '아버지는 맨날 다 식은 다음에 오시잖아요')).toBe(true);
    expect(heard(shown, '끝순이 앉던 쪽의 숟가락')).toBe(true);
    // The market stall was one seat with two people waiting for it, and the fire asks what the
    // free hand is for. Somebody else answers that question.
    expect(heard(shown, '먼저 낸 사람이 임자지')).toBe(true);
    expect(heard(shown, '비어 있는 손으로 뭘 해야 하는지 알면서 모르는 척한다')).toBe(false);
    expect(heard(shown, '아이 둘은 나왔다. 최 씨는 안 나왔다')).toBe(true);
    expect(heard(shown, '먼저 선 사람이 임자지')).toBe(true);
    expect(heard(shown, '그때는 내가 임자였다')).toBe(false);
    // She hears it at the gate herself; the child is not the one who brings the news.
    expect(heard(shown, '최기호. 그런 통역은 없소.')).toBe(true);
    expect(heard(shown, '도장이야 아무나 파오')).toBe(false);
    expect(heard(shown, '군인 아저씨가 그러는데')).toBe(false);
    expect(heard(shown, '솜이나 사 오너라. 새로 누벼야겠다.')).toBe(true);
    expect(heard(shown, '어머이 이불을 어깨까지 끌어 올려 드렸다')).toBe(true);
    // Nobody comes back. Each person beside the protagonist has a gesture of their own, and no
    // mark repeats from one life to the next.
    expect(heard(shown, '고무신 한 짝은 손에 들고 왔다')).toBe(true);
    expect(heard(shown, '누나 지금 이불에 뭐 그렸어요')).toBe(true);
    expect(heard(shown, '왼쪽 눈')).toBe(false);
    expect(heard(shown, '본 기억은 없는데 저렇게 웃는 얼굴을 전에도 기다린 것 같다')).toBe(false);
    // The ward is where the person finds out, because a ward is a place with time left in it.
    expect(heard(shown, '엄마는 못 들은 사람처럼 수술 날짜를 물었다')).toBe(true);
    expect(heard(shown, '이번엔 내가 입을 다물었다')).toBe(true);
    expect(heard(shown, '그날은 뻗으려는 손이 내 손 같지가 않았다')).toBe(true);
    expect(heard(shown, '누가 고르는 것 같다. 나 말고')).toBe(true);
    expect(heard(shown, '문 쪽을 보다가 이불을 턱 밑까지 끌어 올렸다')).toBe(true);
    // The player hears what Minjae later repeats: she said she would come back.
    expect(heard(shown, '갔다 와서 신을 거야')).toBe(true);
    expect(heard(shown, '깊이 들어갔던 쪽이다')).toBe(true);
    expect(heard(shown, '잠실대교, 1,280미터')).toBe(true);
    expect(heard(shown, '그게 더 무서웠다')).toBe(false);
    // And it carries into its own trial, which gets one step further than the others.
    expect(heard(shown, '지금 보니 고르는 쪽도 나다')).toBe(true);
    // The editor can read the turn-back point in four hundred other people and not in herself.
    expect(heard(shown, '엄마 쪽 수화기가 제자리에 돌아가 있다')).toBe(true);
    const visit = state.storyLog.filter((entry) => entry.kind === 'dialogue').filter((entry) => entry.sceneId === 'glass');
    expect(visit.filter((entry) => entry.speaker === '엄마' && entry.channel === 'dialogue')).toHaveLength(8);
    expect(visit.some((entry) => entry.channel === 'message')).toBe(false);
    expect(heard(shown, '통이 와야 또 담그지')).toBe(true);
    expect(heard(shown, '07:12 다음 주에 가져올게요')).toBe(true);
    expect(heard(shown, '다음 주로 미루는 말은 금방 나온다')).toBe(false);
    expect(heard(shown, '전송에 손을 대자 손가락이 굳는다')).toBe(true);
    expect(heard(shown, '‘토요일에’까지는 남겨 둔다')).toBe(true);
    // The child tells her because she did not cut the child off in this life, not because of an
    // earlier one. Then the child says what is standing behind her when she looks back.
    expect(heard(shown, '저번에 내 말 안 끊은 아줌마다')).toBe(true);
    expect(heard(shown, '어디서 봤는데')).toBe(false);
    expect(heard(shown, '근데 얼굴은 안 보여. 맨날 거기 서 있어')).toBe(true);
    // The winter does not name anyone who came back. Four unlike people stood beside this
    // person, once each; the child was there once too. What repeats is the one who left.
    expect(heard(shown, '저녁을 같이 먹자던 열여섯. 나는 장부를 폈다')).toBe(true);
    expect(heard(shown, '벽 쪽으로 돌아눕던 어머이. 나는 기차를 탔다')).toBe(true);
    expect(heard(shown, '앞치마를 벗고 병실에 들어온 엄마. 나는 입을 다물었다')).toBe(true);
    expect(heard(shown, '수화기를 먼저 내려놓던 엄마. 나는 다음 주에 온다고 했다')).toBe(true);
    expect(heard(shown, '넷은 닮은 데가 없다')).toBe(true);
    expect(heard(shown, '그 아이도 그 겨울에 한 번 있었다')).toBe(true);
    expect(heard(shown, '같은 것은 내 쪽이다')).toBe(false);
    // What the four lives point back to is the hand that tucked the blanket and went out.
    expect(heard(shown, '마포로 나서는 새벽, 딸의 이불을 턱 밑까지 여미던 손')).toBe(true);
    expect(heard(shown, '귀퉁이를 들춰 보고 나간 사람은 없었다')).toBe(true);
    // 다온's own words come back, and what stands behind this person is the blanket.
    expect(heard(shown, '얼굴은 안 보인다고. 맨날 거기 서 있다고')).toBe(true);
    expect(heard(shown, '내가 덮어 놓아서 얼굴이 안 보인다')).toBe(true);
    expect(heard(shown, '눈을 뜨면 곁에 처음 보는 사람이 있다')).toBe(true);
    // The returning child is gone from the script and must not come back.
    expect(heard(shown, '네 번을 만났다')).toBe(false);
    expect(heard(shown, '다시 만나도 못 알아볼')).toBe(false);
    expect(heard(shown, '그 아이는 나를 기억하는데')).toBe(false);
    // Looking back keeps all five, and the child who carries them says the word that was never sent.
    expect(heard(shown, '토요일에 가요.')).toBe(true);
    expect(heard(shown, '엄마, 나 전에 편집실에서 일했어.')).toBe(true);
    expect(heard(shown, '빈 반찬통 하나를 두 손으로 들고 있다')).toBe(true);
    expect(state.routeVars).toMatchObject({
      lives_done: 4, lived_1894: true, lived_1952: true, lived_1988: true, lived_2026: true,
      l1_gave: true, l1_end: 'gone', t_say: true, t_stay: true, t_dare: true,
      t_kin: true, v_end: 'kin', deg_last: '223.7',
      pre_1894: '', pre_1952: 'say', pre_1988: 'stay', pre_2026: 'dare',
    });
    expect(state.resolvedEndingId).toBe('returner');
  }, 120000);

  it('comes full circle when the winter is given the same answer as the life before it', async () => {
    await start();
    const { state, picked, shown } = await play({
      star: STAR_1894,
      l1_rice: SHUT,
      l1_leave: STAY,
      v1: WOLMIDO,
      l2_heart: CONFESS,
      l2_mother: SLIP_OUT,
      v2: UNCOUNTED,
      l3_open: AFRAID,
      l3_out: JACKET,
      v3: TRANSPLANT,
      l4_mark: "'어두웠다'에 줄을 긋는다.",
      l4_munho: '녹음하며 듣는다.',
      l4_sign: WALK,
      l5_leftover: '열일곱 해의 기억을 본다.',
      v4: BESIDE,
      w_remember: '울음',
      v_end: WINTER_BESIDE,
    }, 'v_end');
    expect(state.choiceGate.key).toBe('v_end');
    expect(state.choiceGate.options.map((option) => option.text)).toEqual([WINTER_JAR, WINTER_BESIDE, WINTER_LEAVE, WINTER_OPEN_HAND]);
    const stopped = await play({ v_end: WINTER_OPEN_HAND }, 'v_end_stop');
    expect(stopped.state.choiceGate.key).toBe('v_end_stop');
    const retried = await play({ v_end_stop: '다시 고른다.' }, 'v_end');
    expect(retried.state.choiceGate.key).toBe('v_end');
    const winter = await play({ v_end: WINTER_BESIDE });
    expect(winter.state.isFinished, [...picked, ...winter.picked].join('\n')).toBe(true);
    // Shutting the gate is what the daughter defends him for, out at the gate, where he hears it.
    expect(heard(shown, '우리 아버지 그런 사람 아니에요')).toBe(true);
    expect(heard(shown, '그때 온 사람이 마지막이었다')).toBe(true);
    expect(heard(shown, '배가 선창을 떠날 때 그 애는 한 번도 이쪽을 돌아보지 않았다')).toBe(true);
    expect(heard(shown, '강화로 간 뒤로 그 애는 친정에 한 번도 오지 않았다')).toBe(true);
    expect(heard(shown, '대답 안 하고 나온 그 새벽이 기차 소리에 섞여 왔다')).toBe(true);
    expect(heard(shown, '들어 볼 권한은 출입증과 함께 반납했다')).toBe(true);
    expect(heard(shown, '박다온(53), 오후 두 시')).toBe(false);
    expect(heard(shown, '덕이 이번 겨울에 굶어 죽었대요')).toBe(true);
    expect(heard(shown, '아버지, 진지 거르지 마세요. 장부 보시다가요.')).toBe(true);
    expect(heard(shown, '곳간 가는 새벽마다 딸의 이불을 여미던 손')).toBe(true);
    // A life that was never stopped is shown the door that would have shut.
    expect(heard(shown, '307.9를 쥐고 간 부두에서는 막힌 적이 없었다')).toBe(true);
    expect(heard(shown, "076.3을 쥐고 간 병실에서는 무섭다는 말이 '무'에서 멈췄다")).toBe(true);
    expect(heard(shown, '164.8을 쥐고 간 편집실에서는 일어서려는데 손이 펜을 쥐고 있었다')).toBe(true);
    // Holding the same regret twice there is nothing to let go of, and the child it makes
    // stays off the ice: the same opening as the one-point child, then the shoes come off.
    expect(heard(winter.shown, '김치통 손잡이와 이불 귀퉁이가 한 손에 같이 잡힌다')).toBe(true);
    expect(heard(winter.shown, '목록에 이미 있는 숫자다')).toBe(true);
    expect(heard(winter.shown, '이불 귀퉁이를 들추고 동생 얼굴을 한참 들여다본다')).toBe(true);
    expect(heard(winter.shown, '아이는 신을 벗는다')).toBe(true);
    expect(heard(winter.shown, '신을 마저 신고 나간다')).toBe(false);
    expect(winter.state.routeVars).toMatchObject({ l1_end: 'kept', t_kin: true, v_end: 'kin', pre_1952: 'free', pre_1988: 'guard', pre_2026: 'live' });
    expect(winter.state.resolvedEndingId).toBe('circle');
  }, 120000);

  it('starts somewhere else when a different star is the one that is missed', async () => {
    await start();
    const { state, picked, shown } = await play({
      star: STAR_1988,
      l3_open: '엄마를 가게로 돌려보낸다.',
      l3_out: '병실에 남는다.',
      v3: TRANSPLANT,
      l1_rice: OPEN,
      l1_leave: STAY,
      v1: WOLMIDO,
      l2_heart: CONFESS,
      l2_mother: CARRY,
      v2: UNCOUNTED,
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
    expect(heard(shown, '164.8을 쥐고 간 포구에서는 열쇠를 꽂고도 손목이 돌아가지 않았다')).toBe(true);
    expect(heard(shown, '307.9를 쥐고 간 부두에서는 어머이를 부르는 사이 보따리가 벌써 어깨에 있었다')).toBe(true);
    expect(heard(shown, '076.3을 쥐고 간 편집실에서는 막힌 적이 없었다')).toBe(true);
    // Taking the winter's jar means opening the hand that held the kimchi tub.
    expect(heard(shown, '초록 김치통 손잡이가 빠져나간다')).toBe(true);
    expect(heard(shown, '빈손으로 좁쌀 자루를 쥔다')).toBe(true);
    expect(heard(shown, '한 줌도 꺼내지 않는다')).toBe(true);
    expect(state.routeVars).toMatchObject({ lives_done: 4, t_live: true, v_end: 'hold', v_final: 'hold', deg_last: '041.2' });
    expect(state.resolvedEndingId).toBe('onward');
  }, 120000);

  it('makes the player open the hand that holds the kimchi tub to take the winter jar', async () => {
    await startAt(4, 'last_choice', { l4_signed: true });
    const { state, picked, shown } = await play({ v4: BESIDE, w_remember: '울음', v_end: WINTER_JAR });
    expect(state.isFinished, picked.join('\n')).toBe(true);
    expect(heard(shown, '초록 김치통 손잡이다.')).toBe(true);
    expect(heard(shown, '손가락을 하나씩 편다.')).toBe(true);
    expect(heard(shown, '초록 김치통 손잡이가 빠져나간다')).toBe(true);
    expect(heard(shown, '유리 너머 빈 의자가 먼저 흐려진다')).toBe(true);
    expect(heard(shown, '목록에 이미 있는 숫자다')).toBe(false);
    expect(heard(shown, '041.2°. 어느 해 어느 나라인지는 고를 수 없었다.')).toBe(true);
    expect(heard(shown, '도로 덮는다. 한 줌도 꺼내지 않는다.')).toBe(true);
    expect(heard(shown, '빗장부터 건다')).toBe(false);
    expect(state.routeVars).toMatchObject({ last_taken: 'kin', v_end: 'hold', v_final: 'hold', deg_last: '041.2' });
    expect(state.resolvedEndingId).toBe('onward');
  }, 60000);

  it('lets the winter go unnumbered again, and the one-point child lifts the corner and goes out', async () => {
    await startAt(4, 'last_choice', { l4_signed: true });
    const { state, picked, shown } = await play({ v4: BESIDE, w_remember: '울음', v_end: WINTER_LEAVE });
    expect(state.isFinished, picked.join('\n')).toBe(true);
    expect(heard(shown, '그 겨울은 이번에도 숫자 없이 남는다')).toBe(true);
    expect(heard(shown, '손가락을 하나씩 편다.')).toBe(false);
    expect(heard(shown, '223.7°. 어느 해 어느 나라인지는 고를 수 없었다.')).toBe(true);
    expect(heard(shown, '이불 귀퉁이를 들추고 동생 얼굴을 한참 들여다본다')).toBe(true);
    expect(heard(shown, '덮는다. 신을 마저 신고 나간다.')).toBe(true);
    expect(heard(shown, '깨우지 좀 마라.')).toBe(true);
    expect(heard(shown, '아이는 신을 벗는다')).toBe(false);
    expect(state.routeVars).toMatchObject({ v_end: 'left', v_final: 'kin', deg_last: '223.7' });
    expect(state.resolvedEndingId).toBe('onward');
  }, 60000);

  it('holds the originals and the winter jar in one hand, and that child bars the gate', async () => {
    await startAt(4, 'last_choice', { l4_signed: true });
    const { state, picked, shown } = await play({ v4: ORIGINALS, w_remember: '울음', v_end: WINTER_JAR });
    expect(state.isFinished, picked.join('\n')).toBe(true);
    expect(heard(shown, '녹음기 무게가 손에 남는다')).toBe(true);
    expect(heard(shown, '녹음기와 좁쌀 자루가 한 손에 같이 잡힌다')).toBe(true);
    expect(heard(shown, '041.2. 목록에 이미 있는 숫자다')).toBe(true);
    expect(heard(shown, '아이는 잠들기 전에 쌀독을 들여다본다')).toBe(true);
    expect(heard(shown, '옆집 아이가 대문 앞에 오는 날에는 빗장부터 건다')).toBe(true);
    expect(heard(shown, '한 줌도 꺼내지 않는다')).toBe(false);
    expect(state.resolvedEndingId).toBe('circle');
  }, 60000);

  it('lets the bankbook go for the child under the blanket when the originals were never signed away', async () => {
    await startAt(4, 'stake', { l4_signed: false });
    const { state, picked, shown } = await play({ v4: SAVINGS, w_remember: '울음', v_end: WINTER_BESIDE });
    expect(state.isFinished, picked.join('\n')).toBe(true);
    expect(heard(shown, '다른 하나는 서랍의 통장이다')).toBe(true);
    expect(heard(shown, '통장이 손에서 빠져나간다')).toBe(true);
    expect(heard(shown, '빈손으로 이불 귀퉁이를 쥔다')).toBe(true);
    expect(heard(shown, '덮는다. 신을 마저 신고 나간다.')).toBe(true);
    expect(state.routeVars).toMatchObject({ last_taken: 'hold', v_end: 'kin', v_final: 'kin', deg_last: '223.7' });
    expect(state.resolvedEndingId).toBe('onward');
  }, 60000);

  it('stays by the hearth with a hand on the blanket when the hand opens in the winter', async () => {
    await startAt(4, 'last_choice', { l4_signed: true });
    const { state, picked, shown } = await play({ v4: BESIDE, w_remember: '울음', v_end: WINTER_OPEN_HAND, v_end_stop: '여기 남는다.' });
    expect(state.isFinished, picked.join('\n')).toBe(true);
    expect(heard(shown, '이불 위에 손을 얹는다')).toBe(true);
    expect(state.resolvedEndingId).toBe('still');
  }, 60000);

  it('hears from the gate soldier that a stamp can be cut by anyone when the receipt was taken', async () => {
    await startAt(1, 'gate', { lives_done: 1, lived_1952: true, l2_told: false });
    const { shown } = await play({}, 'l2_mother');
    expect(heard(shown, '그런 통역은 없소')).toBe(true);
    expect(heard(shown, '도장이야 아무나 파오')).toBe(true);
    expect(heard(shown, '날짜, 금액, 이름 석 자. 다 받았는데.')).toBe(true);
    expect(heard(shown, '영호 앞에서도 같이 간다고 했는데')).toBe(false);
  }, 60000);

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
