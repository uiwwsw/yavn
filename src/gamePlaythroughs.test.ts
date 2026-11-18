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
import { resolvePlayerCharacterId, resolvePlayerName } from './textVariables';
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

  it('shows the overnight cut before the secondhand console is picked up', async () => {
    await start('8bit-heart');
    const route = { b0_buy: CHEAP };
    const night = await play(route, state => state.dialog.fullText.includes('잔액은 읽지 말고.'));
    expect(night.state.inventory.console_cheap).toBeFalsy();
    expect(heard(night.shown, '2063년 밤 11시')).toBe(true);
    expect(heard(night.shown, '내일 아침에 둘게요')).toBe(true);

    const morning = await play(route, state => state.effect === 'darken' || state.dialog.fullText === '다음 날 아침');
    expect(morning.state.dialog.fullText).toBe('다음 날 아침');
    expect(morning.state.dialog.channel).toBe('card');
    expect(morning.state.inventory.console_cheap).toBeFalsy();
    expect(morning.shown).not.toContain('55,000원입니다.');

    const notice = await play(route, state => state.dialog.fullText.includes('현관에 뭔가 놓였습니다'));
    expect(notice.state.inventory.console_cheap).toBeFalsy();

    const unpacked = await play(route, state => state.dialog.fullText === '신문지가 뭔가요?');
    expect(unpacked.state.inventory.console_cheap).toBe(true);
  });

  it('looks up a shipped protagonist from the viewpoint name', async () => {
    await start('8bit-heart');
    const { game, currentSceneId, routeVars } = useVNStore.getState();
    const name = resolvePlayerName(game, currentSceneId, routeVars);
    expect(name).toBe('윤재');
    expect(resolvePlayerCharacterId(game, name, routeVars)).toBe('윤재');
  });

  it('shows the repair sequence through ordinary text advance', async () => {
    await start('8bit-heart');
    const beats = [
      ['윤재가 전원 버튼을 눌렀다.', 'console_old.svg'],
      ['윤재가 뒷덮개를 열어 건전지를 뺐다 끼운다.', 'console_old.svg'],
      ['아직 꺼져 있어요.', 'console_old.svg'],
      ['줄이 하나 떴어요.', 'console_old_line.svg'],
      ['됐… 아. 줄도 꺼졌어.', 'console_old.svg'],
    ];
    for (const [text, image] of beats) {
      const { state } = await play({}, state => state.dialog.fullText.startsWith(text));
      expect(state.dialog.fullText.startsWith(text)).toBe(true);
      expect(state.dialog.continueLabel).toBeUndefined();
      expect(state.stickers.s0_broken?.source).toContain('/' + image);
    }
  });

  it('하루의 마지막 질문에 대답하면 4장에서 로봇을 믿는다고 말한다', async () => {
    await start('8bit-heart');
    const run = await play({
      b0_buy: CHEAP,
      b1_haru: '신문지가 뭔지 설명한다',
      b1_home: '침대||책상 위||켜진 모니터||가방을 메고 나간다',
      b2_register: '밖에서 무슨 일이 있었는지 말한다',
      b3_snack: '내 몫의 복숭아를 다 먹는다',
      b3_drone: '{{android_name}} 뒤에 숨는다',
      b3_promise: '끝까지 함께하겠다고 약속한다',
      b4_save: '새끼손가락 약속',
    });
    finished(run);
    expect(run.state.routeVars).toMatchObject({ b_battery: true, b_cpu: true, b_screen: true });
    expect(heard(run.shown, '세 겹. 기록했습니다')).toBe(true);
    expect(heard(run.shown, '걔가 마지막으로 배운 게 신문지 세 겹')).toBe(true);
    // The three things he looked at on the third morning come back in chapter 3.
    expect(heard(run.shown, '나간 쪽이 게임기 사 줬어')).toBe(true);
    expect(heard(run.shown, '스물여덟 번 다 똑같은 말 나왔어')).toBe(true);
    expect(heard(run.shown, '천장에 하루 스피커 자국')).toBe(true);
    // Chapter 2 asked "믿어도 됨?" and got "아니." Chapter 4 answers it the other way.
    expect(heard(run.shown, '이번엔 어')).toBe(true);
    expect(heard(run.shown, '대답 안 해 줬어')).toBe(false);
    // Seven peach pieces are divided equally before each side receives its portion.
    expect(heard(run.shown, '조각 일곱 개')).toBe(true);
    expect(run.shown).toContain('3.5.');
    expect(heard(run.shown, '기억 1건 저장 완료')).toBe(true);
    expect(heard(run.shown, '슬롯 비어 있음')).toBe(false);
  });

  it('아무 말도 못 하고 집도 안 보면 그 자리들이 비어 있다', async () => {
    await start('8bit-heart');
    const run = await play({
      b0_buy: CHEAP,
      b1_haru: '입을 연다',
      b1_home: '가방을 메고 나간다',
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
    const warning = run.shown.findIndex(text => text.includes('재가동하려면 최고 점수를 지워야 한다'));
    expect(warning).toBeGreaterThan(-1);
    expect(run.shown.findIndex(text => text.includes('HI-SCORE 0999990 — 삭제됨'))).toBeGreaterThan(warning);
    expect(heard(run.shown, '슬롯 비어 있음')).toBe(true);
    expect(heard(run.shown, '기억 1건 저장 완료')).toBe(false);
    expect(heard(run.shown, '아껴 둔 복숭아도 다음 날 아침에 다 먹었고')).toBe(true);
  });
});

describe('ERASE', () => {
  const directText = '민석이 있는 클럽에 잠깐 갈게. 12시 전엔 들어갈게';
  const briefText = '민석이 잠깐 보자네. 12시 전엔 들어갈게';
  const lateText = '민석이 생일이래. 나갔다 올게. 늦으면 톡할게';

  it('withholds the player portrait until the studio scene', async () => {
    await start('erase');
    const opening = useVNStore.getState();
    const name = resolvePlayerName(opening.game, opening.currentSceneId, opening.routeVars);
    expect(name).toBe('???');
    expect(resolvePlayerCharacterId(opening.game, name, opening.routeVars)).toBeUndefined();
    expect(opening.dialog.continueLabel).toBe('동의서에 서명한다');
    await vi.advanceTimersByTimeAsync(3500);
    handleAdvance();
    expect(useVNStore.getState().dialog.continueLabel).toBe('동의서에 서명한다');

    const { state, shown } = await play({}, state => state.currentSceneId === 'studio');
    expect(heard(shown, '동의서 아래에 이름을 쓴다')).toBe(true);
    expect(shown).toContain('결혼식 4주 전 · 청첩장 촬영');
    expect(heard(shown, '휴대전화는 돌려')).toBe(false);
    const revealed = resolvePlayerName(state.game, state.currentSceneId, state.routeVars);
    expect(revealed).toBe('한도윤');
    expect(resolvePlayerCharacterId(state.game, revealed, state.routeVars)).toBe('도윤');
  });

  it.each([
    [directText, '클럽? ㅇㅋ 술 마시면 대리 불러'],
    [briefText, 'ㅇㅋ 들어올 때 깨우진 마 ㅋㅋ'],
    [lateText, 'ㅇㅋ 늦으면 나 먼저 잘게. 운전은 하지 말고'],
  ])('sends the selected text and receives its matching reply in Jisu’s chat (%s)', async (sent, reply) => {
    await start('erase');
    const route = { e0_studio: '오늘 보낼 수 있다고 한다', e0_jisu_text: sent };
    const { state } = await play(route, state => state.placeCaption?.text === '토요일 00:40 · 클럽');
    const messages = state.storyLog.flatMap(entry =>
      entry.kind === 'dialogue' && entry.channel === 'message' && entry.thread === '지수'
        ? [{ side: entry.side, text: entry.text, avatar: entry.avatar }]
        : []);
    expect(messages).toMatchObject([
      { side: 'me', text: sent },
      { side: 'them', text: reply, avatar: expect.stringContaining('/jisu-profile.svg') },
    ]);
  });

  it('새벽에 아무것도 안 지우면 남은 것이 1·3·4장에서 돌아온다', async () => {
    await start('erase');
    const run = await play({
      e0_studio: '오늘 보낼 수 있다고 한다',
      e0_jisu_text: directText,
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
    const clubConversation = run.shown.filter(line =>
      /담배 하나만 빌릴 수 있어요|그쪽도 몇 번 보셨나 보네요|저 다음 달에 결혼해요|빈 잔 하나 더 있는데/.test(line));
    expect(clubConversation).toEqual([
      '저기, 담배 하나만 빌릴 수 있어요?',
      '그쪽도 몇 번 보셨나 보네요.',
      '저 다음 달에 결혼해요.',
      '그래요. 빈 잔 하나 더 있는데, 따라 드릴까요?',
    ]);
    expect(run.shown).not.toContain('둘 다 웃고 있네.');
    expect(heard(run.shown, '번호를 저장하지 않으면 연락처에서는 안 뜬다')).toBe(true);
    expect(heard(run.shown, '전화가 온 번호도 같은 번호였다')).toBe(true);
    expect(heard(run.shown, '폰이 먼저 알아봤네')).toBe(true);
    expect(heard(run.shown, '내가 정리를 덜 한 거고')).toBe(true);
    expect(run.state.storyLog.filter((entry) =>
      entry.kind === 'dialogue' && entry.sceneId === 'search' && entry.text === '안 와?')).toHaveLength(1);
    // 하린 sent the message she usually deletes, so 아진 brings it up eleven years earlier.
    expect(heard(run.shown, '관심 없는 애가 지난주에 껴 달라고 했는데')).toBe(true);
    expect(run.shown).toContain('나도 봤는데ㅋㅋ 나도 껴줘');
    expect(run.shown).not.toContain('2016년 3월 아래 · 항목 없음');
    expect(run.shown).toContain('청첩장 그 사진 골랐던 날? 나한테 민석이 만나러 간다고 했잖아.');
    const invitation = run.shown.findIndex(line => line.startsWith('식탁 한쪽에 사진관에서 고른 청첩장'));
    expect(invitation).toBeGreaterThan(-1);
    expect(run.shown.indexOf('오늘 어디 갔어? 회사 말고.')).toBeGreaterThan(invitation);
  });

  it('셋 다 지우면 삼 주 전 새벽이 통째로 없다', async () => {
    await start('erase');
    const run = await play({
      e0_studio: '이번 달 카드값을 말한다',
      e0_jisu_text: lateText,
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
      e2_jisu: '은행에 다녀왔다고 둘러댄다',
      e3_final: "휴대폰을 초기화한다",
    });
    finished(run);
    expect(run.shown.indexOf('둘 다 웃고 있네.')).toBeGreaterThan(
      run.shown.indexOf('흔들린 사진 세 장을 넘긴다. 마지막 한 장에서 멈춘다.'),
    );
    expect(run.state.routeVars.e0_photos).toBe(true);
    expect(heard(run.shown, '손이 알아서 했다')).toBe(true);
    expect(heard(run.shown, '방금도 본 곳이다')).toBe(true);
    expect(heard(run.shown, '‘나도’에서 잠깐 멈춘다')).toBe(true);
    expect(run.shown).not.toContain('나도 봤는데ㅋㅋ 나도 껴줘');
    expect(run.shown).toContain('2016년 3월 아래 · 항목 없음');
    expect(heard(run.shown, '전화가 온 번호도 같은 번호였다')).toBe(false);
    expect(heard(run.shown, '관심 없는 애가 지난주에 껴 달라고 했는데')).toBe(false);
    expect(run.state.resolvedEndingId).toBe('erase_loop');
    expect(heard(run.shown, '이번에는 펜을 쥔 손이 떨리지 않는다')).toBe(true);
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
    expect(heard(run.shown, '제 폰으로 찍었어요. 어제 녹화실에서.')).toBe(false);
    // 상혁 opens the door a crack for someone who has been looking after him.
    expect(heard(run.shown, '밥 고맙다. 네 차례 아니었잖아')).toBe(true);
  });

  it('cuts the local fan and screen on confirmation and restores a dark, quiet save', async () => {
    await start('tutorial');
    const route = {
      ...honestRoute,
      t1_pencil: '연필을 내려놓는다',
      t1_pencil_again: '귀 뒤의 밴드를 뗀다',
      t4_end: '세션 종료 창을 연다',
      __input: '0001',
    };
    const before = await play(route, state => state.dialog.continueLabel === '0001번 세션을 종료한다');
    expect(before.state.currentSceneId).toBe('end_close');
    expect(heard(before.shown, '바닥에 닿는다')).toBe(true);
    expect(heard(before.shown, '자동 접속되었습니다')).toBe(true);
    expect(heard(before.shown, '번호표 발급기 · 2031.04.13 00:56')).toBe(true);
    expect(before.state.currentMusic).toContain('/fan_idle.flac');
    expect(before.state.background).toContain('/server_room.svg');

    const after = await play(route, state => state.dialog.fullText.startsWith('모니터가 꺼진다.'));
    expect(after.state.background).toContain('/server_room_off.svg');
    expect(after.state.currentMusic).toBeUndefined();

    await vi.advanceTimersByTimeAsync(1000);
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
    expect(heard(run.shown, '제 폰으로 찍었어요. 어제 녹화실에서.')).toBe(true);
    expect(heard(run.shown, '대답이 없다. 의자가 한 번 더 끌린다')).toBe(true);
    expect(heard(run.shown, '혼자 다 먹지도 못하면서')).toBe(false);
    expect(heard(run.shown, '밥 고맙다')).toBe(false);
  });
});

describe('오버플로', () => {
  it('starts with Jiwan’s call and keeps the same portrait through the conversation', async () => {
    await start('overflow');
    const waking = useVNStore.getState();
    const portrait = waking.characters.left?.source;
    expect(waking.dialog.fullText).toContain('아버지에게 전화가 온다');
    expect(portrait).toMatch(/\/jiwan\.svg$/);
    expect(waking.visibleCharacterIds).toEqual(['지완']);

    const answers = { o0_call: '전화를 받는다' };
    const incoming = await play(answers, state => state.choiceGate.key === 'o0_call');
    expect(incoming.state.characters.left?.source).toBe(portrait);
    const answer = await play(answers, state => state.currentSceneId === 'answered_call');
    expect(answer.state.dialog.fullText).toBe('여보세요, 아버지.');
    expect(answer.state.dialog.speaker).toBe('문지완');
    const speaking = await play(answers, state => state.dialog.fullText.startsWith('야, 국 냄비째'));
    expect(speaking.state.dialog.speaker).toBe('아버지 (통화)');
    expect(speaking.state.characters.left?.source).toBe(portrait);
    const cast = Object.values(speaking.state.characters)
      .filter(slot => slot && slot.placement !== 'offstage' && speaking.state.visibleCharacterIds.includes(slot.id));
    expect(cast.map(slot => slot?.id)).toEqual(['지완']);
  });

  it('takes the first 01 through a second reading, a witnessed complaint and a shared ending', async () => {
    await start('overflow');
    const run = await play({
      o0_call: '전화를 받는다',
      o1_trust: '이름을 가리고 기록을 보여준다',
      o1_desk: '시험 출력물을 읽는다||내 렌즈에서 무엇을 확인할지 묻는다',
      o2_father: '겁났다고 말한다',
      o4_end: '기다린 사람들과 함께 이의를 낸다',
    });
    finished(run);
    expect(run.state.resolvedEndingId).toBe('appeal');
    const beats = [
      '아버지에게 전화가 온다',
      '제 건 반만 얼려요. 아버지도 좀 드시고요',
      '저기요. 장갑 떨어뜨리셨어요.',
      '월계병원이 어느 쪽인지 아세요?',
      '흥분 94 · 역무원 호출',
      '가게 앞에서 쓰러지셨어요',
      '문동식 환자분 아드님이세요?',
      '보호자 면회 확인 · 문지완',
      '이 안내가 뜨면 직원이 같이 들어가야 해서요',
      '잠깐 말씀드려도 괜찮을까요?',
      '한수경이라고 합니다',
      '센서 입력 001 → 표시 01',
      '그때 실제 값은 접수표에 안 남아서',
      '병실에 들어가면 렌즈가 한 번 더 재요',
      '영상 및 음성: 끔',
      '제 거 빼 두셨죠',
      '전화 받았는데 아버지 목소리가 아니어서',
      '보호자 재확인 · 문지완',
      '센서 입력 101 → 표시 01\n화면 판정',
      '두 번 다 제가 본 건 확인서에 적어 드릴게요',
      '99를 넘을 때는 확인도 안 해 놓고 사인했어요',
      '아까 저 앉혀 주셨잖아요',
      '저도 같이 내도 될까요?',
      '공동 이의신청 접수',
      '반만 얼렸다. 나머진 냄비에',
    ];
    const positions = beats.map(beat => run.shown.findIndex(text => text.includes(beat)));
    expect(beats.filter((_, index) => positions[index] < 0)).toEqual([]);
    expect(positions).toEqual([...positions].sort((a, b) => a - b));

    const introduction = run.state.storyLog.filter(entry => entry.kind === 'dialogue')
      .filter(entry => entry.sceneId === 'cafe_introduction');
    expect(introduction.map(entry => entry.speaker)).toEqual(['안경 쓴 여자', '문지완', '한수경']);
    expect(introduction[0]?.text).toContain('한수경이라고 합니다');
    expect(heard(run.shown, '아까 대답 안 했는데')).toBe(false);
  });

  it('connects missed calls and a late admission to the public ending', async () => {
    await start('overflow');
    const run = await play({
      o0_call: '문자로 답한다',
      o1_trust: '수경의 자료부터 보여달라고 한다',
      o1_desk: '결함 보고서를 읽는다||병동에서 연락이 왔는지 확인한다||시험 출력물을 읽는다||내 렌즈에서 무엇을 확인할지 묻는다',
      o2_father: '물부터 건넨다',
      o4_end: '내 판독과 수경의 설명을 공개한다',
    });
    finished(run);
    expect(run.state.resolvedEndingId).toBe('broadcast');
    expect(heard(run.shown, '접수표는 안 주셔도 돼요')).toBe(true);
    expect(heard(run.shown, '아침에 전화 못 받아서 죄송해요')).toBe(true);
    expect(heard(run.shown, '아까 대답 안 했는데… 무서웠어요')).toBe(true);
    expect(heard(run.shown, '제 거 빼 두셨죠')).toBe(false);
    expect(heard(run.shown, '전화 받았는데 아버지 목소리가 아니어서')).toBe(false);
    const messages = run.state.storyLog.filter(entry => entry.kind === 'dialogue')
      .filter(entry => entry.sceneId === 'phone_reply');
    expect(messages.map(entry => entry.side)).toEqual(['me', 'them', 'me']);
    expect(messages.map(entry => entry.thread)).toEqual(['동식_연락처', '동식_연락처', '동식_연락처']);
    expect(run.state.storyLog).toContainEqual(expect.objectContaining({
      sceneId: 'hospital_message', thread: '월계병원',
    }));
    expect(run.state.storyLog).toContainEqual(expect.objectContaining({
      sceneId: 'hospital_message', speaker: '아버지', channel: 'dialogue', text: expect.stringContaining('작은 통 찾았다'),
    }));
    const consent = run.shown.findIndex(text => text.includes('제 기록은 써도 돼요'));
    expect(consent).toBeGreaterThan(-1);
    expect(heard(run.shown.slice(consent), '센서 입력 101 / 렌즈 표시 01')).toBe(true);
    expect(heard(run.shown.slice(consent), '308호')).toBe(false);
  });

  it('shows the old slip next to a withdrawn verdict without inventing a first reading', async () => {
    await start('overflow');
    const run = await play({
      o0_call: '전화를 받는다',
      o1_trust: '이름을 가리고 기록을 보여준다',
      o1_desk: '시험 출력물을 읽는다||내 렌즈에서 무엇을 확인할지 묻는다',
      o2_father: '겁났다고 말한다',
      o4_end: '내 기록의 정정을 신청한다',
    });
    finished(run);
    expect(run.state.resolvedEndingId).toBe('one_file');
    const oldSlip = run.shown.findIndex(text => text.includes('결과지를 나란히 놓는다'));
    expect(oldSlip).toBeGreaterThan(-1);
    expect(run.shown[oldSlip + 1]).toContain('‘무반응 의심’ 판정 철회');
    expect(run.shown[oldSlip + 1]).not.toContain('101');
  });

  it('starts a saved 3.0 chapter at its new opening and preserves prior decisions and evidence', async () => {
    localStorage.setItem('vn-engine-autosave:game:overflow', JSON.stringify({
      gameTitle: '오버플로',
      gameVersion: '3.0.0',
      savedAt: new Date().toISOString(),
      chapterIndex: 2,
      chapterPath: './2.yaml',
      sceneId: 'measure',
      actionIndex: 12,
      routeVars: { picked_up: true, shared_slip: true },
      inventory: { appeal_form: true },
      routeHistory: [],
      storyLog: [],
    }));
    await start('overflow');
    expect(useVNStore.getState()).toMatchObject({
      currentSceneId: 'pair_lens',
      chapterIndex: 3,
      routeVars: { picked_up: true, shared_slip: true },
      inventory: { appeal_form: true },
    });
  });
});
