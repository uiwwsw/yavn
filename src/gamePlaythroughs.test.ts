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

// Runs 8비트 심장 end to end through the real engine, twice each,
// down the two sides of the branches that decide what the player hears later. 무원 and 360 have
// their own playthrough tests; this file covers the one that had none.
//
// What it is really guarding: every one of these games carries lines that only appear when an
// earlier flag was set. Those lines are easy to orphan — a renamed flag or a reordered scene
// silently drops them and nothing else fails. So each run asserts both that its own lines are
// heard and that the other side's are not.

const publicRoot = fileURLToPath(new URL('../public/', import.meta.url));

const serve = (path: string): string | undefined => {
  try {
    const source = readFileSync(`${publicRoot}${path.replace(/^\//, '')}`, 'utf8');
    // There is no renderer to finish transitions. Keep authored caption suppression.
    return path.endsWith('.yaml')
      ? source.replace(/- bg: \{ id: ([a-z_]+)[^}]*\}/g, (action, id) =>
        action.includes('label: false') ? `- bg: { id: ${id}, wait: false, label: false }` : `- bg: ${id}`)
      : source;
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

  it('restores a save from the old shopping scene without resuming at an unrelated line', async () => {
    localStorage.setItem('vn-engine-autosave:game:8bit-heart', JSON.stringify({
      gameTitle: '8비트 심장',
      gameVersion: '1.6.0',
      savedAt: new Date().toISOString(),
      chapterIndex: 0,
      chapterPath: './0.yaml',
      sceneId: 'shopping',
      actionIndex: 48,
      routeVars: {},
      inventory: {},
      routeHistory: [],
      storyLog: [],
    }));
    await start('8bit-heart');
    expect(useVNStore.getState()).toMatchObject({ currentSceneId: 'shopping_night', chapterIndex: 1 });
    const purchase = await play({}, state => state.choiceGate.key === 'b0_buy');
    expect(purchase.state.choiceGate.options.map(option => option.text)).toEqual(['HYPERLINK X를 산다', CHEAP]);
    expect(heard(purchase.shown, '자동으로 업데이트돼요')).toBe(true);
    expect(heard(purchase.shown, '와이파이도 계정도 필요 없어')).toBe(true);
  });

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

    const notice = await play(route, state => state.dialog.fullText.includes('현관에 신문지로 싼 물건이 놓였어요'));
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
      b1_home: '침대||책상 위||수리용 단말||다용도실 문을 연다',
      b2_register: '밖에서 무슨 일이 있었는지 말한다',
      b2_parts: '비상 가방||주머니 속 게임기||가슴 화면||전원을 넣는다',
      b3_snack: '내 몫의 복숭아를 다 먹는다',
      b3_drone: '{{android_name}} 뒤에 숨는다',
      b3_promise: '끝까지 함께하겠다고 약속한다',
      b4_save: '새끼손가락 약속',
      b4_hold: '손바닥을 바지에 닦고 앉는다',
    });
    finished(run);
    expect(run.state.resolvedEndingId).toBe('saved_together');
    expect(run.state.routeVars).toMatchObject({ b_battery: true, b_cpu: true, b_screen: true });
    expect(heard(run.shown, '세 겹. 기록했습니다')).toBe(true);
    expect(heard(run.shown, '걔가 마지막으로 배운 게 신문지 세 겹')).toBe(true);
    // The stop is not the whole disaster. The father says three days on the landline, the block
    // comes apart while Yunjae waits, and a household robot knocks on his door.
    expect(heard(run.shown, '걸어서라도 온다고 한다. 사흘이면 온다고')).toBe(true);
    // The reset is the departure board going dark over the waiting hall.
    expect(heard(run.shown, '전광판의 광고가 꺼진다')).toBe(true);
    expect(heard(run.shown, '그러다 누가 유리를 깼다')).toBe(true);
    expect(heard(run.shown, '경찰 사이렌은 첫날 밤에 제일 많았다')).toBe(true);
    expect(heard(run.shown, '확인될 때까지 모시겠습니다')).toBe(true);
    expect(heard(run.shown, '응답 없음. 빈집으로 기록합니다')).toBe(true);
    expect(heard(run.shown, '저건 계단을 올라와서 문을 두드린다')).toBe(true);
    // The android is not a stranger found in an alley. It is the first Haru, the body his mother
    // brought home, standing dead in the utility room since its support ended.
    expect(heard(run.shown, '다용도실에 제 옛날 몸이 있잖아요')).toBe(true);
    const knock = run.shown.findIndex((text) => text.includes('빈집으로 기록합니다'));
    const waited = run.shown.findIndex((text) => text.includes('오늘이 닷새째다'));
    const body = run.shown.findIndex((text) => text.includes('하루. 엄마가 들여놓은 하루다'));
    const raid = run.shown.findIndex((text) => text.includes('기계는 부숴. 꺼져 있어도 부숴'));
    const transplant = run.shown.findIndex((text) => text.includes('게임기 칩을 하루 머리에 누른다'));
    const stands = run.shown.findIndex((text) => text.includes('그 불빛 앞으로 하루가 일어선다'));
    const hello = run.shown.findIndex((text) => text === '1P 감지.');
    expect(knock).toBeGreaterThan(-1);
    expect([knock, waited, body, raid, transplant, stands, hello]).toEqual(
      [knock, waited, body, raid, transplant, stands, hello].slice().sort((a, b) => a - b));
    expect(heard(run.shown, '서울역 지하에 코어 관제실이 있대')).toBe(true);
    expect(heard(run.shown, '1번 — 윤재 (7) · 2054.04.02 등록')).toBe(true);
    expect(heard(run.shown, '…가정용이다.')).toBe(true);
    // He does not talk himself out of it. There is no muttering about whether 8 KB can work.
    expect(heard(run.shown, '이 칩으로 그게 되나')).toBe(false);
    expect(heard(run.shown, '미쳤어. 게임기 칩으로')).toBe(false);
    expect(heard(run.shown, '내 손목을 잡으면 그대로 뜯는다')).toBe(true);
    expect(heard(run.shown, '1번 — 윤재 (16)')).toBe(true);
    expect(heard(run.shown, '서울역. 철길 따라감. — 윤재')).toBe(true);
    // The journey runs south along the line, and the body does what the head cannot.
    expect(heard(run.shown, '1호선 선로를 따라 남쪽으로 걸었다')).toBe(true);
    expect(heard(run.shown, '문짝을 두 손으로 벌렸다')).toBe(true);
    expect(heard(run.shown, '네 몸도 엄마가 들여놓은 거야')).toBe(true);
    expect(heard(run.shown, '오늘이 여드레째야')).toBe(true);
    expect(heard(run.shown, '서울역 지하. 코어 관제실이 거기 있대')).toBe(true);
    // He leaves the same arrow on the line his father will walk, and the father reads all of it.
    expect(heard(run.shown, '서울역 → — 윤재')).toBe(true);
    expect(heard(run.shown, '기둥에 쓴 것도 봤다. 셔터에 쓴 것도.')).toBe(true);
    // The three things he looked at on the fifth day come back in chapter 3.
    expect(heard(run.shown, '집에 두고 온 게임기도 엄마가 사 준 거야')).toBe(true);
    expect(heard(run.shown, '그냥 안 받는 거면 좋겠어')).toBe(true);
    expect(heard(run.shown, '천장에 하루 스피커 자국')).toBe(true);
    expect(heard(run.shown, '결제자 서정은')).toBe(true);
    // Chapter 2 asked "믿어도 됨?" and got "아니." Chapter 4 answers it the other way.
    expect(heard(run.shown, '이번엔 어')).toBe(true);
    expect(heard(run.shown, '대답 안 해 줬어')).toBe(false);
    // The rules are made on the first night by the tracks, fourteen of them before the door.
    expect(heard(run.shown, '네가 처음 알려 준 너 사용법이라서')).toBe(true);
    expect(heard(run.shown, '그 새벽 복도를 걸어간 것도 흰 몸통에 긴 팔이었다')).toBe(true);
    expect(heard(run.shown, '규칙 14.')).toBe(true);
    expect(heard(run.shown, '규칙대로 자는 얼굴 안 봤음')).toBe(true);
    expect(heard(run.shown, '카드에 같이 들어갔나 봄')).toBe(false);
    // The robot never names a feeling and never has 'see you later' explained to it.
    expect(heard(run.shown, '기분이라는 게 있는 줄 몰랐음')).toBe(false);
    expect(heard(run.shown, '이거 농담이었구나')).toBe(false);
    expect(heard(run.shown, '같은 말임?')).toBe(false);
    expect(heard(run.shown, "1번 · '다녀올게' → 귀환 · 4분 12초")).toBe(true);
    // The body his mother bought checks the knee before anything else. Nobody explains it.
    expect(heard(run.shown, 'ROM · 보호 대상 넘어짐 → 무릎 확인')).toBe(true);
    // The constitution is the table of contents; losing it to the drone is what the promise answers.
    expect(heard(run.shown, '헌법 칸 비니까 다른 칸도 못 찾음')).toBe(true);
    expect(heard(run.shown, 'SCAN: 인간 1 감지. 추적 개시.')).toBe(true);
    expect(heard(run.shown, '이름 로딩 실패')).toBe(true);
    expect(heard(run.shown, '칩 떼기 4분 전')).toBe(true);
    expect(heard(run.shown, '미련 없는 사람은 점수를 카드에 안 옮김')).toBe(false);
    // The wait is a night in the hall, and the father arrives inside it.
    expect(heard(run.shown, '밤 11시')).toBe(true);
    expect(heard(run.shown, '새벽 3시')).toBe(true);
    expect(heard(run.shown, '이어폰 · 연결 없음')).toBe(true);
    expect(heard(run.shown, '문짝 봤다. 철길 따라왔다.')).toBe(true);
    expect(heard(run.shown, '…아니. 안 먹었어.')).toBe(true);
    expect(heard(run.shown, '참치마요. 찬밥이다.')).toBe(true);
    expect(heard(run.shown, '…다녀온다고 했어.')).toBe(true);
    expect(heard(run.shown, '…너도 밥은 먹었냐.')).toBe(true);
    expect(heard(run.shown, '질문. 2P임?')).toBe(true);
    expect(heard(run.shown, '가면서 알려 준다고 했음')).toBe(false);
    // The promise brings the index back. What it pointed at, Yunjae has to tell.
    expect(heard(run.shown, 'RAM 07 · 비었음')).toBe(true);
    expect(heard(run.shown, 'RAM 11 · 비었음')).toBe(true);
    expect(heard(run.shown, '나한테 물어봐. 내가 그때 옆에 있었어.')).toBe(true);
    expect(heard(run.shown, '그래도 내 몫은 있음.')).toBe(true);
    expect(heard(run.shown, '하나가 생각나니까 다른 것도 났음')).toBe(false);
    // Seven peach pieces are divided equally before each side receives its portion.
    expect(heard(run.shown, '조각 일곱 개')).toBe(true);
    // Hiding behind the robot is a body pressed into one arm's length, not a menu result.
    expect(heard(run.shown, '건전지 묶음이 광대뼈에 닿는다')).toBe(true);
    expect(heard(run.shown, '그 새벽 현관에서처럼 두 손으로 입을 막는다')).toBe(true);
    expect(run.shown).toContain('3.5.');
    expect(heard(run.shown, '기억 1건 저장 완료')).toBe(true);
  });

  it('아무 말도 못 하고 집도 안 보면 그 자리들이 비어 있다', async () => {
    await start('8bit-heart');
    const run = await play({
      b0_buy: CHEAP,
      b1_haru: '말이 안 나온다',
      b1_home: '다용도실 문을 연다',
      b2_register: '아무 일도 없다고 한다',
      b2_parts: '비상 가방||주머니 속 게임기||가슴 화면||전원을 넣는다',
      b3_snack: '복숭아를 내일로 남겨 둔다',
      b3_drone: '{{android_name}} 뒤에 숨는다',
      b3_promise: '대답을 내일로 미룬다',
      b4_save: '최고 점수를 남긴다',
      b4_hold: '손바닥을 바지에 닦고 앉는다',
    });
    finished(run);
    expect(heard(run.shown, '대답 안 해 줬어')).toBe(true);
    expect(heard(run.shown, '천을 다시 덮지 않고 문을 닫는다')).toBe(true);
    expect(heard(run.shown, '고물한테 거짓말한 사람')).toBe(true);
    // Wiped, it ties his shoe before it knows him, and still carries the line his mother registered.
    expect(heard(run.shown, 'ROM · 보호 대상 신발 끈 → 묶기')).toBe(true);
    expect(heard(run.shown, '윤재가 가슴 화면의 7에 엄지를 댄다')).toBe(true);
    expect(heard(run.shown, '다 지워졌는데 엄마가 적은 줄은 남았다')).toBe(false);
    expect(heard(run.shown, '세 겹. 기록했습니다')).toBe(false);
    expect(heard(run.shown, '집에 두고 온 게임기도 엄마가 사 준 거야')).toBe(false);
    expect(heard(run.shown, '이번엔 어')).toBe(false);
    // The 'twice' rule is born on the first night; the lie he told at home was a single '진짜'.
    expect(heard(run.shown, "집에서 '진짜'는 한 번이었음.")).toBe(true);
    expect(heard(run.shown, '오늘이 그 내일임.')).toBe(true);
    expect(heard(run.shown, '윤재가 그제야 새끼손가락을 내민다.')).toBe(true);
    // Keeping the score keeps the score: nothing is deleted, and the wiped robot finds it.
    expect(heard(run.shown, '새 기억을 넣으면 최고 점수는 지워진다')).toBe(true);
    expect(heard(run.shown, 'HI-SCORE 0999990 — 삭제됨')).toBe(false);
    expect(heard(run.shown, '기존 데이터 유지 · 읽기 전용 잠금')).toBe(true);
    expect(heard(run.shown, '기억 1건 저장 완료')).toBe(false);
    expect(heard(run.shown, '…혼자 깨면 재미없어.')).toBe(true);
    expect(heard(run.shown, '나한테 물어봐. 내가 그때 옆에 있었어.')).toBe(true);
    expect(heard(run.shown, '그래도 내 몫은 있음.')).toBe(false);
    expect(run.state.resolvedEndingId).toBe('new_game');
    // Father arrives at Seoul Station
    expect(heard(run.shown, '문짝 봤다. 철길 따라왔다.')).toBe(true);
    expect(heard(run.shown, '…아니. 안 먹었어.')).toBe(true);
    expect(heard(run.shown, '…너도 밥은 먹었냐.')).toBe(true);
    expect(heard(run.shown, '질문. 이 사람, 위험해?')).toBe(true);
    const rebootLines = run.state.storyLog.flatMap(entry =>
      entry.kind === 'dialogue' && entry.sceneId === 'b4_return_new' ? [entry.text] : []);
    const rescan = rebootLines.findIndex(text => text.includes('가방에서 설명서를 꺼내'));
    expect(rescan).toBeGreaterThan(-1);
    expect(rebootLines.findIndex(text => text.includes('설명서엔'))).toBeGreaterThan(rescan);
    expect(heard(run.shown, '아껴 둔 복숭아도 오늘 아침에 다 먹었고')).toBe(true);
  });

  it('running from the drone is a death that returns to the alley', async () => {
    await start('8bit-heart');
    const run = await play({
      b0_buy: CHEAP,
      b1_haru: '신문지가 뭔지 설명한다',
      b1_home: '다용도실 문을 연다',
      b2_register: '밖에서 무슨 일이 있었는지 말한다',
      b2_parts: '비상 가방||주머니 속 게임기||가슴 화면||전원을 넣는다',
      b3_snack: '내 몫의 복숭아를 다 먹는다',
      b3_drone: '반대쪽으로 달아난다',
    });
    expect(run.state.error).toBeUndefined();
    expect(run.state.isFinished).toBeFalsy();
    expect(run.state.gameOver).toMatchObject({ title: '네 번째 훑기' });
    expect(heard(run.shown, '가운데가 두 조각으로 갈라져 있다')).toBe(true);
    expect(heard(run.shown, '문짝 봤다')).toBe(false);
  });

  it('reaching through the door at three loses the robot, and the card goes home in a pocket', async () => {
    await start('8bit-heart');
    const run = await play({
      b0_buy: CHEAP,
      b1_haru: '신문지가 뭔지 설명한다',
      b1_home: '다용도실 문을 연다',
      b2_register: '밖에서 무슨 일이 있었는지 말한다',
      b2_parts: '비상 가방||주머니 속 게임기||가슴 화면||전원을 넣는다',
      b3_snack: '내 몫의 복숭아를 다 먹는다',
      b3_drone: '{{android_name}} 뒤에 숨는다',
      b3_promise: '끝까지 함께하겠다고 약속한다',
      b4_save: '새끼손가락 약속',
      b4_hold: '틈으로 손을 넣는다',
    });
    finished(run);
    expect(run.state.resolvedEndingId).toBe('no_response');
    // The rule was shown at the door before the night began.
    expect(heard(run.shown, '문턱 넘어서 닿으면 나는 1번 물건.')).toBe(true);
    expect(heard(run.shown, '개체 B 재분류: 개체 A의 장치')).toBe(true);
    // The reset still happens; the father still comes; the robot does not.
    expect(heard(run.shown, '현장 재가동 버튼 눌림')).toBe(true);
    expect(heard(run.shown, '문짝 봤다. 철길 따라왔다.')).toBe(true);
    expect(heard(run.shown, '…다녀온다고 했어.')).toBe(false);
    expect(heard(run.shown, '오른손 검지가 아직 버튼 위에 있다')).toBe(true);
    expect(heard(run.shown, 'SAVE SLOT 1 · 새끼손가락')).toBe(true);
    expect(heard(run.shown, '설명서 열두 쪽이 세상 전부인 줄 알았어')).toBe(true);
    expect(heard(run.shown, '돌아왔어.')).toBe(false);
  });

  it('reaches off_screen when fleeing without saving', async () => {
    await start('8bit-heart');
    const run = await play({
      b0_buy: CHEAP,
      b1_haru: '신문지가 뭔지 설명한다',
      b1_home: '다용도실 문을 연다',
      b2_register: '밖에서 무슨 일이 있었는지 말한다',
      b2_parts: '비상 가방||주머니 속 게임기||가슴 화면||전원을 넣는다',
      b3_snack: '내 몫의 복숭아를 다 먹는다',
      b3_drone: '{{android_name}} 뒤에 숨는다',
      b3_promise: '끝까지 함께하겠다고 약속한다',
      b4_save: '저장을 그만두고 도망친다',
    });
    finished(run);
    expect(run.state.resolvedEndingId).toBe('off_screen');
    // Leaving the station is leaving the place the father was told to come to.
    expect(heard(run.shown, '문짝 봤다')).toBe(false);
    expect(heard(run.shown, '거기까지 쓰자 매직이 더 나오지 않는다')).toBe(true);
    expect(heard(run.shown, '길 건너 아파트 입구에서 가정 도우미 하나가')).toBe(true);
    expect(heard(run.shown, '한 30초 걸려')).toBe(true);
    expect(heard(run.shown, '밤 11시 · 서울역 대합실')).toBe(false);
  });
});
