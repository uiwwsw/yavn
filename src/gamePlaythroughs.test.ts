import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  handleAdvance,
  loadGameFromUrl,
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

async function play(route: Route, maxSteps = 9000): Promise<Run> {
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

  for (let step = 0; step < maxSteps; step += 1) {
    const state = useVNStore.getState();
    collect(state);
    if (state.error) throw new Error(`engine error: ${state.error.message}`);
    if (state.isFinished || state.gameOver) break;

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
    await reach('카트리지에 바람을 분다');
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
    expect(heard(run.shown, '뒤는 안 봐')).toBe(true);
    expect(heard(run.shown, '세 겹. 기록했습니다')).toBe(false);
    expect(heard(run.shown, '나간 쪽이 게임기 사 줬어')).toBe(false);
    expect(heard(run.shown, '이번엔 어')).toBe(false);
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
    expect(heard(run.shown, '대화방은 그대로 둔다')).toBe(true);
    expect(heard(run.shown, '뒤 네 자리가 지금 울리는 번호와 같다')).toBe(true);
    expect(heard(run.shown, '폰이 먼저 알아봤네')).toBe(true);
    expect(heard(run.shown, '내가 정리를 덜 한 거고')).toBe(true);
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
      e3_clinic: '병원에서 나간다',
      e2_jisu: '은행에 간다고 둘러댄다',
      e3_final: "휴대폰을 초기화한다",
    });
    finished(run);
    expect(heard(run.shown, '손이 알아서 했다')).toBe(true);
    expect(heard(run.shown, '배운 적이 없는 사람처럼 한다')).toBe(true);
    expect(heard(run.shown, '한 번에 다 지우는 법을 알면서도')).toBe(true);
    expect(heard(run.shown, '뒤 네 자리가 지금 울리는 번호와 같다')).toBe(false);
    expect(heard(run.shown, '관심 없는 애가 지난주에 껴 달라고 했는데')).toBe(false);
  });
});

describe('튜토리얼', () => {
  it('심한 말을 했으면 광철과 112 기록이 그 말을 돌려준다', async () => {
    await start('tutorial');
    const run = await play({
      t0_coupon: '앞치마 주머니에 넣는다',
      t0_kwang: '개봉한 상품을 빼고 환불한다',
      t0_mail: '문을 두드려 우편이 왔다고 알린다',
      t1_bow: '고개를 숙인다',
      t1_look: '번호표 기계||연필꽂이||다음 단계로',
      t1_say: '왜 그렇게 많이 사냐고 쏘아붙인다',
      t1_pencil: '연필을 쥔다',
      t2_sh: '오늘은 레플라에 접속하지 말라고 한다',
      t2_where: '들은 장소만 말한다',
      t2_tamper: '아무것도 건드리지 않고 로그아웃한다',
      t3_tell: '레플라에서 한 일을 털어놓는다',
      t3_room: '벽에 붙은 그래프||책상 위 출입 카드||레플라가 어떻게 작동하는지 묻는다',
      t3_door: '상혁이 어머니께 전화한다',
      t4_room: '모니터||벽 콘센트||책상 서랍||모니터 앞에 앉는다',
      t4_end: '전원선을 뽑는다',
    });
    finished(run);
    expect(run.picked.slice(0, 2).map(entry => entry.split('=')[0])).toEqual(['t0_kwang', 't0_coupon']);
    expect(heard(run.shown, '최초 처리자 정해수')).toBe(true);
    expect(heard(run.shown, '혼자 다 먹지도 못하면서 왜 사느냐고')).toBe(true);
    expect(heard(run.shown, '그 말이 맞아. 내가 혼자 다 못 먹어')).toBe(true);
    expect(heard(run.shown, '환청은 보통 이렇게 안 적힙니다')).toBe(true);
    // 상혁 opens the door a crack for someone who has been looking after him.
    expect(heard(run.shown, '밥 고맙다. 네 차례 아니었잖아')).toBe(true);
  });

  it('소리만 질렀고 상혁을 안 챙겼으면 돌아오는 것도 그만큼이다', async () => {
    await start('tutorial');
    const run = await play({
      t0_coupon: '체험권을 경준에게 양보한다',
      t0_kwang: '목소리를 낮춰 달라고 한다',
      t0_mail: '봉투를 상혁의 방문 밑에 넣는다',
      t1_bow: '응대를 그만둔다',
      t1_look: '번호표 기계||연필꽂이||다음 단계로',
      t1_say: '소리 지르지 말라고 한다',
      t1_pencil: '연필을 쥔다',
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
    expect(heard(run.shown, '지르지 말라고만 해')).toBe(true);
    expect(heard(run.shown, '무슨 말인지는 모르겠고 계속 지르기만 한다')).toBe(true);
    expect(heard(run.shown, '대답이 없다. 의자가 한 번 더 끌린다')).toBe(true);
    expect(heard(run.shown, '혼자 다 먹지도 못하면서')).toBe(false);
    expect(heard(run.shown, '밥 고맙다')).toBe(false);
  });
});

describe('오버플로', () => {
  const base: Route = {
    o0_case: '봉투를 받는다',
    o1_show: '내 판독 결과를 보여 준다',
    o2_sera: '세라의 이의신청을 맡는다',
    o2_deal: '배동식도 오버플로인지 묻는다',
    o3_tell: '노기태에게 전화한다',
    o4_end: '배동식 씨 원본만 검찰에 낸다',
  };

  it('빈손으로 내려가면 동식이 녹음기를 직접 건네고 자백 앞이 달라진다', async () => {
    await start('overflow');
    const run = await play({ ...base, o1_room: '그만 보고 내려간다' });
    finished(run);
    expect(heard(run.shown, '다 보셨습니까. 빠르시네요')).toBe(true);
    expect(heard(run.shown, '창가에 반찬통 있지요')).toBe(true);
    // Chapter 3 lives on those 119 recordings, so the recorder cannot be missed.
    expect(heard(run.shown, '안 보고 가시길래요')).toBe(true);
    expect(heard(run.shown, '그럼 나한테 뭘 물으시는 겁니까')).toBe(true);
    expect(heard(run.shown, '장위동에 다시 가야 한다')).toBe(true);
    expect(heard(run.shown, '달력에 숫자를 적으셨더군요')).toBe(false);
  });

  it('다섯 개를 다 보면 대조할 것을 들고 자백 앞에 선다', async () => {
    await start('overflow');
    const run = await play({
      ...base,
      o1_room: '벽에 붙은 그림||벽걸이 달력||쌓아 둔 약봉지||협탁에 놓인 녹음기||창가에 놓인 도시락통||본 것을 정리하고 내려간다',
    });
    finished(run);
    expect(heard(run.shown, '달력에 숫자를 적으셨더군요')).toBe(true);
    expect(heard(run.shown, '도시락통 보셨지요')).toBe(true);
    expect(heard(run.shown, '집에 오래 계셨네요')).toBe(true);
    expect(heard(run.shown, '반찬통 뚜껑 안쪽, 마지막 줄이 3월 7일')).toBe(true);
    expect(heard(run.shown, '달력 7일 칸을 다시 봐야 한다')).toBe(true);
    expect(heard(run.shown, '안 보고 가시길래요')).toBe(false);
  });
});
