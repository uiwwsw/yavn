import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  handleAdvance,
  loadGameFromUrl,
  loadSaveSlot,
  saveCurrentProgress,
  setScenePresentationPaused,
  setSkipReadActive,
  submitChoiceOption,
  submitInputAnswer,
} from './engine';
import { useVNStore } from './store';
// The engine imports the YAML parser lazily. Load it up front so the first game load does not
// wait on real module transformation while fake timers are advanced.
import './parser';

// Runs 8비트 심장 · ERASE · 튜토리얼 · 오버플로 end to end through the real engine, twice each,
// down the two sides of the branches that decide what the player hears later. 무원 and 360 have
// their own playthrough tests; this file covers the four that had none.
//
// What it is really guarding: every one of these games carries lines that only appear when an
// earlier flag was set. Those lines are easy to orphan — a renamed flag or a reordered scene
// silently drops them and nothing else fails. So each run asserts both that its own lines are
// heard and that the other side's are not.

const publicRoot = fileURLToPath(new URL('../public/', import.meta.url));

const serve = (path: string): string | undefined => {
  try {
    const source = readFileSync(`${publicRoot}${path.replace(/^\//, '')}`, 'utf8');
    // Background transitions are served in their non-waiting short form: there is no renderer
    // here to report that a dissolve finished. Everything else is the shipped YAML.
    return path.endsWith('.yaml') ? source.replace(/- bg: \{ id: ([a-z_]+)[^}]*\}/g, '- bg: $1') : source;
  } catch {
    return undefined;
  }
};

/**
 * One entry per choice key. A value may list several picks for a menu that repeats —
 * an exploration screen — separated by `||`, taken in whatever order the menu still offers them.
 */
type Route = Record<string, string>;

type Run = {
  shown: string[];
  picked: string[];
  state: ReturnType<typeof useVNStore.getState>;
};

async function play(route: Route, stopAt?: (state: Run['state']) => boolean): Promise<Run> {
  const picked: string[] = [];
  const shown: string[] = [];
  const remaining: Route = { ...route };

  const collect = (state: ReturnType<typeof useVNStore.getState>): void => {
    for (const entry of state.storyLog) {
      if ('text' in entry && !shown.includes(entry.text)) shown.push(entry.text);
    }
    // A forgiven choice answers in the dialog box without writing to the story log.
    const transient = state.dialog?.fullText;
    if (transient && !shown.includes(transient)) shown.push(transient);
  };

  for (let step = 0; step < 9000; step += 1) {
    const state = useVNStore.getState();
    collect(state);
    if (state.error) throw new Error(`engine error: ${state.error.message}`);
    if (state.isFinished || state.gameOver || stopAt?.(state)) break;

    if (state.inputGate.active && !state.busy) {
      submitInputAnswer(remaining.__input ?? state.inputGate.defaultValue ?? '');
      await vi.advanceTimersByTimeAsync(400);
      continue;
    }

    if (state.choiceGate.active && !state.busy) {
      const key = state.choiceGate.key ?? '';
      const options = state.choiceGate.options;
      const queued = remaining[key];
      if (queued === undefined) {
        throw new Error(`no route for ${key}: ${options.map((option) => option.text).join(' | ')}`);
      }
      const wants = queued.split('||');
      let index = -1;
      let chosen = '';
      for (const candidate of wants) {
        const at = options.findIndex((option) => option.text === candidate);
        if (at >= 0) {
          index = at;
          chosen = candidate;
          break;
        }
      }
      if (index < 0 && state.choiceGate.presentation === 'explore') {
        // An exploration menu whose way out is still locked behind unspent hotspots.
        // Take one and come back; the route only has to name the option it cares about.
        index = 0;
      } else if (index < 0) {
        throw new Error(`no offered option for ${key}: want ${queued}, got ${options.map((option) => option.text).join(' | ')}`);
      } else if (wants.length > 1) {
        const rest = wants.filter((candidate) => candidate !== chosen);
        remaining[key] = rest.length > 0 ? rest.join('||') : chosen;
      }
      picked.push(`${key}=${options[index].text}`);
      // skipForgiveOnce: a route names the option it means, so take it the first time.
      submitChoiceOption(index, true);
    } else {
      handleAdvance(true);
    }
    await vi.advanceTimersByTimeAsync(400);
  }

  collect(useVNStore.getState());
  return { shown, picked, state: useVNStore.getState() };
}

const heard = (shown: string[], fragment: string): boolean => shown.some((text) => text.includes(fragment));

let currentGame = '';

beforeEach(() => {
  vi.useFakeTimers();
  const values = new Map<string, string>();
  vi.stubGlobal('localStorage', {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => values.set(key, value),
    removeItem: (key: string) => values.delete(key),
  });
  vi.stubGlobal('window', globalThis);
  vi.stubGlobal('document', { querySelectorAll: () => [], visibilityState: 'visible' });
  vi.stubGlobal('navigator', { hardwareConcurrency: 2, connection: { saveData: true } });
  vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => setTimeout(() => callback(performance.now()), 16));
  vi.stubGlobal('cancelAnimationFrame', (timer: number) => clearTimeout(timer));
  vi.stubGlobal('Audio', class {
    volume = 0;
    play() { return Promise.resolve(); }
    pause() {}
    addEventListener() {}
  });
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

async function start(id: string): Promise<void> {
  currentGame = id;
  vi.stubGlobal('location', { origin: 'http://test', href: `http://test/game-list/${id}/` });
  void loadGameFromUrl(`http://test/game-list/${id}/`);
  await vi.advanceTimersByTimeAsync(3000);
}

/** Fails with the route that produced it, which is the only way to read these back. */
const finished = (run: Run): void => {
  expect(run.state.error, `${currentGame}\n${run.picked.join('\n')}`).toBeUndefined();
  expect(run.state.isFinished, `${currentGame}\n${run.picked.join('\n')}`).toBe(true);
};

describe('8비트 심장', () => {
  const CHEAP = '중고 게임기를 산다';

  it('opens with four repair actions and only lights the old screen after tapping it', async () => {
    await start('8bit-heart');
    const current = useVNStore.getState;
    const reach = async (label: string) => {
      for (let step = 0; step < 40 && current().dialog.continueLabel !== label; step += 1) {
        handleAdvance(true);
        await vi.advanceTimersByTimeAsync(200);
      }
      expect(current().dialog.continueLabel).toBe(label);
      handleAdvance();
      handleAdvance();
      expect(current().dialog.continueLabel).toBe(label);
    };

    await reach('전원을 켠다');
    expect(current().stickers.s0_broken?.source).toContain('/console_old.svg');
    handleAdvance(true);
    await reach('건전지를 뺐다 끼운다');
    expect(heard(current().storyLog.flatMap(entry => 'text' in entry ? [entry.text] : []), '최신 펌웨어')).toBe(true);
    handleAdvance(true);
    await reach('본체를 툭툭 친다');
    expect(current().stickers.s0_broken?.source).toContain('/console_old.svg');
    handleAdvance(true);
    await reach('카트리지에 입김을 분다');
    expect(current().stickers.s0_broken?.source).toContain('/console_old_line.svg');
    handleAdvance(true);
    await vi.advanceTimersByTimeAsync(800);
    expect(current().stickers.s0_broken?.source).toContain('/console_old.svg');
    expect(current().dialog.fullText).toBe('됐… 아. 줄도 꺼졌어.');
  });

  it('하루의 마지막 질문에 대답하면 4장에서 로봇을 믿는다고 말한다', async () => {
    await start('8bit-heart');
    const run = await play({
      b0_buy: CHEAP,
      b1_haru: '신문지가 뭔지 설명한다',
      b1_home: '침대||책상 위||켜진 모니터||가방을 메고 나간다',
      b2_parts: '계산대 밑 건전지||게임기 CPU||가슴 화면 단자||스위치를 올린다',
      b2_register: '밖에서 무슨 일이 있었는지 말한다',
      b3_snack: '복숭아를 다 먹는다',
      b3_drone: '{{android_name}} 뒤에 숨는다',
      b3_promise: '끝까지 함께하겠다고 약속한다',
      b4_save: '새끼손가락 약속',
    });
    finished(run);
    expect(heard(run.shown, '세 겹. 기록했습니다')).toBe(true);
    expect(heard(run.shown, '걔가 마지막으로 배운 게 신문지 세 겹')).toBe(true);
    // The three things he looked at on the third morning come back in chapter 3.
    expect(heard(run.shown, '나간 쪽이 게임기 사 줬어')).toBe(true);
    expect(heard(run.shown, '스물여덟 번 다 똑같은 말 나왔어')).toBe(true);
    expect(heard(run.shown, '천장에 동그란 자리 같은 거')).toBe(true);
    // Chapter 2 asked "믿어도 됨?" and got "아니." Chapter 4 answers it the other way.
    expect(heard(run.shown, '이번엔 어')).toBe(true);
    expect(heard(run.shown, '대답 안 해 줬어')).toBe(false);
    expect(heard(run.shown, '기억 1건 저장 완료')).toBe(true);
    expect(heard(run.shown, '슬롯 비어 있음')).toBe(false);
  });

  it('아무 말도 못 하고 집도 안 보면 그 자리들이 비어 있다', async () => {
    await start('8bit-heart');
    const run = await play({
      b0_buy: CHEAP,
      b1_haru: '입을 연다',
      b1_home: '가방을 메고 나간다',
      b2_parts: '계산대 밑 건전지||게임기 CPU||가슴 화면 단자||스위치를 올린다',
      b2_register: '아무 일도 없다고 한다',
      b3_snack: '복숭아를 내일로 남겨 둔다',
      b3_drone: '반대쪽으로 달아난다',
      b3_promise: '대답을 내일로 미룬다',
      b4_save: '슬롯을 비워 둔다',
    });
    finished(run);
    expect(heard(run.shown, '대답 안 해 줬어')).toBe(true);
    expect(heard(run.shown, '…셋. 가자.')).toBe(true);
    expect(heard(run.shown, '세 겹. 기록했습니다')).toBe(false);
    expect(heard(run.shown, '나간 쪽이 게임기 사 줬어')).toBe(false);
    expect(heard(run.shown, '이번엔 어')).toBe(false);
    expect(heard(run.shown, '슬롯 비어 있음')).toBe(true);
    expect(heard(run.shown, '기억 1건 저장 완료')).toBe(false);
  });
});

describe('ERASE', () => {
  it('새벽에 아무것도 안 지우면 남은 것이 1·3·4장에서 돌아온다', async () => {
    await start('erase');
    const run = await play({
      e0_studio: '숨기는 게 없다고 한다',
      e0_junseong: '잔을 받는다',
      e0_erase: '방을 나간다',
      e1_rumor: '농담에 맞장구친다',
      h1_send: '보낸다',
      e1_harin: '이어폰을 받지 않는다',
      e2_dig: '검색을 그만두고 지수에게 답장한다',
      e2_threat: '아무 말도 하지 않는다',
      e3_room: '서류를 우편함에 넣고 나온다',
      e2_search: '노트북을 덮는다',
      e2_photo: '사진을 남긴다',
      e3_clinic: '번호표를 뽑는다',
      e2_jisu: '지수에게 전부 말한다',
      e3_final: '놀이터 사진을 연다',
    });
    finished(run);
    expect(heard(run.shown, '번호를 저장하지 않으면 연락처에서는 안 뜬다')).toBe(true);
    expect(heard(run.shown, '뒤 네 자리가 지금 울리는 번호와 같다')).toBe(true);
    expect(heard(run.shown, '폰이 먼저 알아봤네')).toBe(true);
    expect(heard(run.shown, '내가 정리를 덜 한 거고')).toBe(true);
    expect(run.state.storyLog.filter((entry) =>
      entry.kind === 'dialogue' && entry.sceneId === 'search' && entry.text === '안 와?')).toHaveLength(1);
    // 하린 sent the message she usually deletes, so 아진 brings it up eleven years earlier.
    expect(heard(run.shown, '관심 없는 애가 지난주에 껴 달라고 했는데')).toBe(true);
  });

  it('셋 다 지우면 삼 주 전 새벽이 통째로 없다', async () => {
    await start('erase');
    const run = await play({
      e0_studio: '카드값 이야기로 넘긴다',
      e0_junseong: '대리를 불렀다고 한다',
      e0_erase: '메시지||사진||위치 기록||방을 나간다',
      e1_rumor: '답장하지 않는다',
      h1_send: '한 글자씩 지운다',
      e1_harin: '민재에게 왜 안 보냈는지 묻는다',
      e2_dig: '검색을 그만두고 지수에게 답장한다',
      e2_threat: '아무 말도 하지 않는다',
      e3_room: '약국 봉투||식탁 위 서류||냉장고 달력||서류를 우편함에 넣고 나온다',
      e2_search: '검색창||사진첩||노트북을 덮는다',
      e2_photo: '사진을 완전히 삭제한다',
      e3_clinic: '검사받지 않고 나온다',
      e2_jisu: '은행에 간다고 둘러댄다',
      e3_final: "휴대폰을 초기화한다",
    });
    finished(run);
    expect(heard(run.shown, '손이 알아서 했다')).toBe(true);
    expect(heard(run.shown, '방금도 본 곳이다')).toBe(true);
    expect(heard(run.shown, '‘나도’에서 잠깐 멈춘다')).toBe(true);
    expect(heard(run.shown, '뒤 네 자리가 지금 울리는 번호와 같다')).toBe(false);
    expect(heard(run.shown, '관심 없는 애가 지난주에 껴 달라고 했는데')).toBe(false);
  });
});

describe('튜토리얼', () => {
  const honestRoute: Route = {
    t0_coupon: '앞치마 주머니에 넣는다',
    t0_kwang: '개봉한 상품을 빼고 환불한다',
    t0_mail: '문을 두드려 우편이 왔다고 알린다',
    t1_bow: '고개를 숙인다',
    t1_look: '번호표 기계||연필꽂이||다음 단계로',
    t1_say: '왜 그렇게 많이 사냐고 쏘아붙인다',
    t1_pencil: '연필을 든 채 다가간다',
    t2_sh: '오늘은 레플라에 접속하지 말라고 한다',
    t2_where: '들은 장소만 말한다',
    t2_tamper: '아무것도 건드리지 않고 로그아웃한다',
    t3_tell: '레플라에서 한 일을 털어놓는다',
    t3_room: '벽에 붙은 그래프||책상 위 출입 카드||레플라가 어떻게 작동하는지 묻는다',
    t3_door: '상혁이 어머니께 전화한다',
    t4_room: '모니터||벽 콘센트||책상 서랍||모니터 앞에 앉는다',
    t4_end: '전원선을 뽑는다',
  };

  it('심한 말을 했으면 광철과 112 기록이 그 말을 돌려준다', async () => {
    await start('tutorial');
    const run = await play(honestRoute);
    finished(run);
    expect(run.picked.slice(0, 2).map(entry => entry.split('=')[0])).toEqual(['t0_kwang', 't0_coupon']);
    expect(heard(run.shown, '최초 처리자 정해수')).toBe(true);
    expect(heard(run.shown, '혼자 다 먹지도 못하면서 왜 사느냐고')).toBe(true);
    expect(heard(run.shown, '틀린 말은 아니더라. 혼자 그걸 다 먹을 수는 없지')).toBe(true);
    expect(heard(run.shown, '신고할 때 저 말을 그대로 따라 했대요')).toBe(true);
    // 상혁 opens the door a crack for someone who has been looking after him.
    expect(heard(run.shown, '밥 고맙다. 네 차례 아니었잖아')).toBe(true);
  });

  it('cuts the local fan and screen on confirmation and restores a dark, quiet save', async () => {
    await start('tutorial');
    const route = { ...honestRoute, t4_end: '세션 종료 창을 연다', __input: '0001' };
    const before = await play(route, state => state.dialog.continueLabel === '0001번 세션을 종료한다');
    expect(before.state.currentSceneId).toBe('end_close');
    expect(before.state.currentMusic).toContain('/fan_idle.flac');
    expect(before.state.background).toContain('/server_room.svg');

    const after = await play(route, state => state.dialog.fullText.startsWith('모니터가 꺼진다.'));
    expect(after.state.background).toContain('/server_room_off.svg');
    expect(after.state.currentMusic).toBeUndefined();

    expect(saveCurrentProgress().exists).toBe(true);
    const loaded = loadSaveSlot('manual');
    await vi.advanceTimersByTimeAsync(3000);
    expect(await loaded).toBe(true);
    expect(useVNStore.getState()).toMatchObject({
      background: expect.stringContaining('/server_room_off.svg'),
      currentMusic: undefined,
      dialog: { fullText: expect.stringContaining('팬이 느려지다 멎는다.') },
    });

    const end = await play({});
    finished(end);
    expect(heard(end.shown, 'USER 0001 · 세션 종료')).toBe(true);
  }, 60000);

  it('소리만 질렀고 상혁을 안 챙겼으면 돌아오는 것도 그만큼이다', async () => {
    await start('tutorial');
    const run = await play({
      t0_coupon: '체험권을 경준에게 양보한다',
      t0_kwang: '목소리를 낮춰 달라고 한다',
      t0_mail: '봉투를 상혁의 방문 밑에 넣는다',
      t1_bow: '응대를 그만둔다',
      t1_look: '번호표 기계||연필꽂이||다음 단계로',
      t1_say: '소리 지르지 말라고 한다',
      t1_pencil: '연필을 든 채 다가간다',
      t2_sh: '모른 척하고 신발을 신는다',
      t2_where: '단톡방을 못 봤다고 둘러댄다',
      t2_tamper: '고객의 소리 용지||연필꽂이||CCTV 모니터||로그아웃한다',
      t3_tell: '모른다고 답한다',
      t3_room: '레플라가 어떻게 작동하는지 묻는다',
      t3_door: '상혁에게 외출을 알린다',
      t4_room: '모니터 앞에 앉는다',
      t4_end: '모니터를 끄고 나간다',
    });
    finished(run);
    expect(heard(run.shown, '나한테 지르지 말라는 거야')).toBe(true);
    expect(heard(run.shown, '무슨 말인지는 모르겠고 계속 지르기만 한다')).toBe(true);
    expect(heard(run.shown, '대답이 없다. 의자가 한 번 더 끌린다')).toBe(true);
    expect(heard(run.shown, '혼자 다 먹지도 못하면서')).toBe(false);
    expect(heard(run.shown, '밥 고맙다')).toBe(false);
  });
});

describe('오버플로', () => {
  it('keeps Jiwan on stage with the same portrait when he answers the call', async () => {
    await start('overflow');
    const waking = useVNStore.getState();
    const portrait = waking.characters.left?.source;
    expect(waking.dialog.fullText).toContain('출근하던 문지완이 월계역 개찰구 앞에서');
    expect(portrait).toMatch(/\/jiwan\.svg$/);
    expect(waking.visibleCharacterIds).toEqual(['지완']);

    const answers = { o0_call: '전화를 받는다' };
    const incoming = await play(answers, state => state.choiceGate.key === 'o0_call');
    expect(incoming.state.characters.left?.source).toBe(portrait);
    const answer = await play(answers, state => state.currentSceneId === 'take_call');
    expect(answer.state.dialog.fullText).toBe('여보세요, 아버지.');
    expect(answer.state.dialog.speaker).toBe('문지완');
    expect(answer.state.characters.left?.source).toBe(portrait);
    const speaking = await play(answers, state => state.dialog.fullText.startsWith('야, 국 냄비째'));
    expect(speaking.state.dialog.speaker).toBe('아버지 (통화)');
    expect(speaking.state.characters.left?.source).toBe(portrait);
    expect(speaking.state.visibleCharacterIds).toContain('지완');
    expect(speaking.state.currentSceneId).toBe('take_call');
  });

  it('무반응 판정 뒤 여자가 지완을 발견하고, 병실에서만 실제 입력값을 확인한다', async () => {
    await start('overflow');
    const run = await play({
      o0_call: '전화를 받는다',
      o1_trust: '이름을 가리고 기록을 보여준다',
      o1_desk: '시험 출력물을 읽는다||내 렌즈에서 무엇을 확인할지 묻는다',
      o2_father: '겁났다고 말한다',
      o4_end: '기다린 사람들과 함께 이의를 낸다',
    });
    finished(run);
    const beats = [
      '출근하던 문지완이 월계역', '안경 쓴 여자 · 안정 31', '장갑 떨어뜨리셨어요.', '같은 근무조 도겸이',
      '흥분 94', '폭행 신고 18건 → 7건', '못 나가면 셋 세고',
      '정서 반응 01 · 무반응 의심', '아침에 장갑을 주워 준 여자가 앉아 있다',
      '월계역에서 장갑을 주워 줬던 남자다', '01 뜬 분을 봤어요', '아침에 제 장갑 주워 주셨죠?',
      '접수대에 뜬 그 카드, 제가 만든 겁니다',
      '시험 신호 101 → 표시 01', '아까 접수표에서 가리신 이름', '반만 얼리기로 했잖아요',
      '전화 받았는데 반찬집 아주머니였잖아요', '침대 바퀴 앞에 양말이 떨어져 있다', '센서 입력 101 → 표시 01',
      '아버지가 옆에 앉으라 그랬잖아요', '공동 이의신청 접수', '반만 얼렸다',
    ];
    const positions = beats.map((beat) => run.shown.findIndex((text) => text.includes(beat)));
    expect(beats.filter((_, index) => positions[index] < 0)).toEqual([]);
    expect(positions).toEqual([...positions].sort((a, b) => a - b));
    expect(heard(run.shown, '아까 물부터 드렸죠')).toBe(false);
    const introduction = run.state.storyLog.filter((entry) => entry.kind === 'dialogue')
      .filter((entry) => entry.sceneId === 'introduction');
    expect(introduction.slice(0, 5).map((entry) => entry.speaker))
      .toEqual(['안경 쓴 여자', '문지완', '안경 쓴 여자', '문지완', '한수경']);
    expect(introduction[2]?.text).toContain('한수경이에요');
    const call = run.state.storyLog.filter((entry) => entry.kind === 'dialogue').filter((entry) => entry.sceneId === 'take_call');
    expect(call.filter((entry) => entry.channel === 'dialogue').map((entry) => entry.speaker))
      .toEqual(['문지완', '아버지 (통화)', '문지완', '아버지 (통화)', '문지완']);
    expect(call.some((entry) => entry.channel === 'message')).toBe(false);
    expect(run.state.storyLog).toContainEqual(expect.objectContaining({
      sceneId: 'shift', channel: 'action', text: expect.stringContaining('아버지 목소리가 아니다. 반찬집 아주머니다.'),
    }));
  });

  it('통화를 미루면 음성 메시지가 남고 아버지에게 건네는 대답도 늦어진다', async () => {
    await start('overflow');
    const run = await play({
      o0_call: '문자로 답한다',
      o1_trust: '수경의 자료부터 보여달라고 한다',
      o1_desk: '결함 보고서를 읽는다||병동에서 연락이 왔는지 확인한다||시험 출력물을 읽는다||내 렌즈에서 무엇을 확인할지 묻는다',
      o2_father: '물부터 건넨다',
      o4_end: '내 판독과 수경의 설명을 공개한다',
    });
    finished(run);
    expect(heard(run.shown, '지난번 네가 사 온 거 있네')).toBe(true);
    expect(heard(run.shown, '아까 접수표 안 보여 주셔도 괜찮아요')).toBe(true);
    expect(heard(run.shown, '아침에 전화 못 받았죠')).toBe(true);
    expect(heard(run.shown, '아까 물부터 드렸죠. 겁났어요')).toBe(true);
    expect(heard(run.shown, '반만 얼리기로 했잖아요')).toBe(false);
    expect(heard(run.shown, '전화 받았는데 반찬집 아주머니였잖아요')).toBe(false);
    const messages = run.state.storyLog.filter((entry) => entry.kind === 'dialogue')
      .filter((entry) => entry.sceneId === 'text_back' && entry.channel === 'message');
    expect(messages.map((entry) => entry.side)).toEqual(['me', 'them', 'me']);
    expect(run.state.storyLog).toContainEqual(expect.objectContaining({
      sceneId: 'check_phone', speaker: '아버지', channel: 'dialogue', text: expect.stringContaining('작은 통 찾았다'),
    }));
    const broadcast = run.shown.slice(run.shown.findIndex((text) => text.includes('제 이름이랑 제 판독')));
    expect(heard(broadcast, '센서 입력 101 / 렌즈 표시 01')).toBe(true);
    expect(heard(broadcast, '308호')).toBe(false);
  });
});
