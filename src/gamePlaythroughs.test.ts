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
  const CHEAP = '"아저씨, B버튼 뻑뻑한 거 그거 주세요."';

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
      b1_haru: '"종이야. 글자 찍힌 종이. 세 겹으로 싸면 안 깨져."',
      b1_home: '침대||책상 위||켜진 채로 둔 모니터||가방을 메고 나간다',
      b2_parts: '계산대 밑 건전지||게임기 CPU||가슴 화면 단자||스위치를 올린다',
      b2_register: '"응. 세상 망했어. 너랑 나 빼고 다."',
      b3_snack: '"3.5는 무슨." 반쪽까지 집어 먹는다',
      b3_drone: '{{android_name}} 등 뒤에 납작 붙는다',
      b3_promise: '손가락을 건다. "혼자는 무슨. 끝까지 2P로 가."',
      b4_save: '새끼손가락 약속 — "끝까지 2P로"',
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
      b2_register: '"전혀. 너나 걱정해, 고물."',
      b3_snack: '"넣어 둬. 내일 먹게." 뚜껑을 닫는다',
      b3_drone: '냅다 반대쪽으로 튄다',
      b3_promise: '"…자. 내일 얘기해." 촛불을 분다',
      b4_save: '빈 슬롯으로 둔다. 가볍게 다녀오라고',
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
      e0_studio: '렌즈를 보면서 "없어. 진짜 없어."',
      e0_junseong: '잔을 받는다. "한 잔만이요."',
      e0_erase: '신발을 손에 들고 나간다',
      e1_rumor: '"ㅋㅋ 군대 어디냐고 나도 물어봄"',
      h1_send: '보낸다',
      e1_harin: '손사래를 친다. "됐어 됐어, 둘이 들어."',
      e2_dig: '노트북을 덮고 지수한테 "150장"이라고 보낸다',
      e2_threat: '층수 표시만 본다',
      e3_room: '서류를 우편함에 넣고 나온다',
      e2_search: '노트북을 덮는다',
      e2_photo: '엄지를 떼고 사진첩을 닫는다',
      e3_clinic: '번호표 버튼을 누른다',
      e2_jisu: '"다 말할게. 듣고 나서 네가 정해."',
      e3_final: '사진첩 맨 아래, 놀이터 사진을 연다',
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
      e0_studio: '"…카드값 좀 밀린 거?"',
      e0_junseong: '폰 화면을 흔들어 보인다. "저 대리 불러 놨어요."',
      e0_erase: '메시지||사진||위치 기록||신발을 손에 들고 나간다',
      e1_rumor: '읽기만 하고 폰을 엎어 둔다',
      h1_send: '한 글자씩 지운다',
      e1_harin: '웃으면서 묻는다. "근데 민재야, 나한텐 왜 안 보냈어?"',
      e2_dig: '노트북을 덮고 지수한테 "150장"이라고 보낸다',
      e2_threat: '층수 표시만 본다',
      e3_room: '약국 봉투||식탁 위 서류||냉장고 달력||서류를 우편함에 넣고 나온다',
      e2_search: '검색창||사진첩||노트북을 덮는다',
      e2_photo: '삭제를 누르고 최근 삭제된 항목까지 비운다',
      e3_clinic: '모자를 눌러쓰고 자동문 쪽으로 돌아선다',
      e2_jisu: '"은행. 대출 서류 하나 빠졌대서."',
      e3_final: "설정에서 '모든 콘텐츠 및 설정 지우기'를 누른다",
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
      t0_kwang: '"확인해 드릴게요." 뜯은 하나만 빼고 환불한다',
      t0_mail: '"상혁아, 우편 왔어." 문을 두 번 두드린다',
      t1_bow: '고개를 숙인다. 한 번 더 숙인다',
      t1_look: '번호표 기계||연필꽂이||다음 단계로',
      t1_say: '"혼자 다 드시지도 못하는 걸 왜 사세요."',
      t1_pencil: '연필을 쥔다',
      t2_sh: '"오늘 하루만 하지 마. 그거."',
      t2_where: '"지하 주차장이라고만 들었습니다."',
      t2_tamper: '아무것도 건드리지 않고 로그아웃한다',
      t3_tell: '"레플라에서 찔렀습니다." 그대로 말한다',
      t3_room: '벽에 붙은 그래프||책상 위 출입 카드||"이게 어떻게 돌아가는 건데요."',
      t3_door: '상혁이 어머니께 전화한다',
      t4_room: '모니터||벽 콘센트||책상 서랍||모니터 앞에 앉는다',
      t4_end: '전원선을 뽑는다',
    });
    finished(run);
    expect(heard(run.shown, '혼자 다 먹지도 못하면서 왜 사느냐고')).toBe(true);
    expect(heard(run.shown, '그 말이 맞아. 내가 혼자 다 못 먹어')).toBe(true);
    expect(heard(run.shown, '환청은 보통 이렇게 안 적힙니다')).toBe(true);
    // 상혁 opens the door a crack for someone who has been looking after him.
    expect(heard(run.shown, '밥 고맙다. 네 차례 아니었잖아')).toBe(true);
  });

  it('소리만 질렀고 상혁을 안 챙겼으면 돌아오는 것도 그만큼이다', async () => {
    await start('tutorial');
    const run = await play({
      t0_coupon: '"경준이 주세요. 저는 괜찮아요."',
      t0_kwang: '"고객님, 뒤에 기다리시는 분이 계셔서요. 목소리만 조금…"',
      t0_mail: '상혁이 방문 밑으로 밀어 넣는다',
      t1_bow: '"죄송합니다. 여기까지만 하겠습니다, 고객님."',
      t1_look: '번호표 기계||연필꽂이||다음 단계로',
      t1_say: '"소리 지르지 마세요."',
      t1_pencil: '연필을 쥔다',
      t2_sh: '모른 척하고 신발을 신는다',
      t2_where: '"단톡방을 안 봐서요. 잘 모릅니다."',
      t2_tamper: '고객의 소리 용지||연필꽂이||CCTV 모니터||로그아웃한다',
      t3_tell: '"모르겠습니다. 죄송합니다."',
      t3_room: '"이게 어떻게 돌아가는 건데요."',
      t3_door: '"상혁아, 나 잠깐 어디 좀 다녀올게."',
      t4_room: '모니터 앞에 앉는다',
      t4_end: '모니터를 끄고 나간다. 내일 오픈 근무다',
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
    o0_case: '"일당은 없는 거죠?" 봉투를 가져온다',
    o1_show: '"선생님, 제 것도 보시겠습니까." 화면을 돌린다',
    o2_sera: '"올려 주는 게 아니라 틀렸다고 쓰는 거야. 쓸게."',
    o2_deal: '"하나만 묻겠습니다. 배동식 씨도 오버플로입니까."',
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
