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

// Runs 8비트 심장 · ERASE end to end through the real engine, twice each,
// down the two sides of the branches that decide what the player hears later. 무원 and 360 have
// their own playthrough tests; this file covers the two that had none.
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
      b3_snack: '내 몫의 복숭아를 다 먹는다',
      b3_drone: '{{android_name}} 뒤에 숨는다',
      b3_promise: '끝까지 함께하겠다고 약속한다',
      b4_save: '새끼손가락 약속',
    });
    finished(run);
    expect(run.state.routeVars).toMatchObject({ b_battery: true, b_cpu: true, b_screen: true });
    expect(heard(run.shown, '세 겹. 기록했습니다')).toBe(true);
    expect(heard(run.shown, '걔가 마지막으로 배운 게 신문지 세 겹')).toBe(true);
    // The stop is not the whole disaster. The father says three days on the landline, the block
    // comes apart while Yunjae waits, and a household robot knocks on his door.
    expect(heard(run.shown, '걸어서라도 온다고 한다. 사흘이면 온다고')).toBe(true);
    // The reset is also the phone that went dead mid-sentence.
    expect(heard(run.shown, '전광판이 돌아왔으면 집 전화도 신호가 갈까')).toBe(true);
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
    expect(heard(run.shown, '현관 문짝에는 ‘서울역’이라고 써 두고 왔다')).toBe(true);
    // The three things he looked at on the third morning come back in chapter 3.
    expect(heard(run.shown, '집에 두고 온 게임기는 엄마가 사 준 거야')).toBe(true);
    expect(heard(run.shown, '아빠가 그냥 안 받는 거면 좋겠어')).toBe(true);
    expect(heard(run.shown, '천장에 하루 스피커 자국')).toBe(true);
    // Chapter 2 asked "믿어도 됨?" and got "아니." Chapter 4 answers it the other way.
    expect(heard(run.shown, '이번엔 어')).toBe(true);
    expect(heard(run.shown, '대답 안 해 줬어')).toBe(false);
    expect(heard(run.shown, '그럼 나한테 하는 말도 욕임?')).toBe(true);
    expect(heard(run.shown, '그거 좋은 뜻이라며.')).toBe(false);
    // The robot learns the 'twice' rule from Yunjae after boot; a memory card cannot hear.
    expect(heard(run.shown, '네가 처음 알려 준 너 사용법이라서')).toBe(true);
    expect(heard(run.shown, '카드에 같이 들어갔나 봄')).toBe(false);
    expect(heard(run.shown, '미련 없는 사람은 점수를 카드에 안 옮김')).toBe(true);
    // Seven peach pieces are divided equally before each side receives its portion.
    expect(heard(run.shown, '조각 일곱 개')).toBe(true);
    // Hiding behind the robot is a body pressed into one arm's length, not a menu result.
    expect(heard(run.shown, '건전지 묶음이 광대뼈에 닿는다')).toBe(true);
    expect(heard(run.shown, '그 새벽 현관에서처럼 두 손으로 입을 막는다')).toBe(true);
    expect(run.shown).toContain('3.5.');
    expect(heard(run.shown, '기억 1건 저장 완료')).toBe(true);
    expect(heard(run.shown, '슬롯 비어 있음')).toBe(false);
  });

  it('아무 말도 못 하고 집도 안 보면 그 자리들이 비어 있다', async () => {
    await start('8bit-heart');
    const run = await play({
      b0_buy: CHEAP,
      b1_haru: '입을 연다',
      b1_home: '다용도실 문을 연다',
      b2_register: '아무 일도 없다고 한다',
      b3_snack: '복숭아를 내일로 남겨 둔다',
      b3_drone: '{{android_name}} 뒤에 숨는다',
      b3_promise: '대답을 내일로 미룬다',
      b4_save: '슬롯을 비워 둔다',
    });
    finished(run);
    expect(heard(run.shown, '대답 안 해 줬어')).toBe(true);
    expect(heard(run.shown, '천을 다시 덮지 않고 문을 닫는다')).toBe(true);
    expect(heard(run.shown, '고물한테 거짓말한 사람')).toBe(true);
    // Wiped, it still carries the one line his mother registered.
    expect(heard(run.shown, '다 지워졌는데 엄마가 적은 줄은 남았다')).toBe(true);
    expect(heard(run.shown, '세 겹. 기록했습니다')).toBe(false);
    expect(heard(run.shown, '집에 두고 온 게임기는 엄마가 사 준 거야')).toBe(false);
    expect(heard(run.shown, '이번엔 어')).toBe(false);
    expect(heard(run.shown, '그거 좋은 뜻이라며.')).toBe(true);
    expect(heard(run.shown, '그럼 나한테 하는 말도 욕임?')).toBe(false);
    const warning = run.shown.findIndex(text => text.includes('카드를 준비하면 최고 점수는 지워진다'));
    expect(warning).toBeGreaterThan(-1);
    expect(run.shown.findIndex(text => text.includes('HI-SCORE 0999990 — 삭제됨'))).toBeGreaterThan(warning);
    expect(heard(run.shown, '슬롯 비어 있음')).toBe(true);
    expect(heard(run.shown, '기억 1건 저장 완료')).toBe(false);
    expect(run.state.resolvedEndingId).toBe('new_game');
    const rebootLines = run.state.storyLog.flatMap(entry =>
      entry.kind === 'dialogue' && entry.sceneId === 'b4_return_new' ? [entry.text] : []);
    const rescan = rebootLines.findIndex(text => text.includes('가방에서 설명서를 꺼내'));
    expect(rescan).toBeGreaterThan(-1);
    expect(rebootLines.findIndex(text => text.includes('설명서엔'))).toBeGreaterThan(rescan);
    expect(heard(run.shown, '아껴 둔 복숭아도 다음 날 아침에 다 먹었고')).toBe(true);
  });

  it('ends in the alley if Yunjae gives the drone a target', async () => {
    await start('8bit-heart');
    const run = await play({
      b0_buy: CHEAP,
      b1_haru: '신문지가 뭔지 설명한다',
      b1_home: '다용도실 문을 연다',
      b2_register: '밖에서 무슨 일이 있었는지 말한다',
      b3_snack: '내 몫의 복숭아를 다 먹는다',
      b3_drone: '반대쪽으로 달아난다',
    });
    finished(run);
    expect(run.state).toMatchObject({ chapterIndex: 4, resolvedEndingId: 'no_response' });
    expect(heard(run.shown, '가운데가 두 조각으로 갈라져 있다')).toBe(true);
  });
});

describe('ERASE', () => {
  const directText = '민석이 있는 클럽에 잠깐 갈게. 12시 전엔 들어갈게';
  const briefText = '민석이 잠깐 보자네. 12시 전엔 들어갈게';
  const lateText = '민석이 생일이래. 나갔다 올게. 늦으면 톡할게';
  const studioChoice = { e0_studio: '오늘 보낼 수 있다고 한다' };

  it('withholds the player portrait until the studio scene', async () => {
    await start('erase');
    const opening = useVNStore.getState();
    const name = resolvePlayerName(opening.game, opening.currentSceneId, opening.routeVars);
    expect(name).toBe('???');
    expect(resolvePlayerCharacterId(opening.game, name, opening.routeVars)).toBeUndefined();
    expect(opening.dialog).toMatchObject({ continueLabel: '동의서에 서명한다', continueAt: { x: 54, y: 66 } });
    await vi.advanceTimersByTimeAsync(3500);
    handleAdvance();
    expect(useVNStore.getState().dialog.continueLabel).toBe('동의서에 서명한다');

    const { state, shown } = await play({}, state => state.currentSceneId === 'studio');
    expect(heard(shown, '동의서에 이름을 쓰고 끝에 작은 점을 찍는다')).toBe(true);
    expect(shown).toContain('결혼식 4주 전 · 청첩장 촬영');
    expect(heard(shown, '휴대전화는 돌려')).toBe(false);
    const revealed = resolvePlayerName(state.game, state.currentSceneId, state.routeVars);
    expect(revealed).toBe('한도윤');
    expect(resolvePlayerCharacterId(state.game, revealed, state.routeVars)).toBe('도윤');
  });

  it.each([
    [briefText, '알았어. 열두 시 넘으면 나 먼저 잘 거야. 들어올 때 깨우진 마.'],
    [lateText, '생일이야? 그럼 잘 놀다 와. 늦으면 나 먼저 잘게. 운전은 하지 말고.'],
  ])('talks to Jisu at home before leaving, then texts her from the club (%s)', async (spoken, reply) => {
    await start('erase');
    const route = { ...studioChoice, e0_jisu_text: spoken, e0_junseong: '잔을 받는다' };
    const answer = await play(route, state => state.dialog.fullText === spoken);
    expect(answer.state.background).toContain('/couple_home.svg');
    expect(answer.state.dialog).toMatchObject({ channel: 'dialogue', speakerId: '도윤' });
    expect(answer.state.visibleCharacterIds).toEqual(expect.arrayContaining(['도윤', '지수']));
    const response = await play(route, state => state.dialog.fullText === reply);
    expect(response.state.dialog).toMatchObject({ channel: 'dialogue', speakerId: '지수' });
    expect(response.state.visibleCharacterIds).toEqual(expect.arrayContaining(['도윤', '지수']));
    const club = await play(route, state => state.dialog.fullText === '좀 늦을듯 먼저 자');
    expect(club.state.background).toContain('/club.svg');
    expect(club.state.dialog).toMatchObject({ channel: 'message', side: 'me' });
    expect(heard(club.shown, '현관문이 닫힌다')).toBe(true);
    expect(club.state.visibleCharacterIds).not.toContain('지수');
    const messages = club.state.storyLog.filter(entry =>
      entry.kind === 'dialogue' && entry.channel === 'message' && entry.thread === '지수');
    expect(messages).toMatchObject([{ side: 'me', text: '좀 늦을듯 먼저 자' }]);
  });

  it('stays home after telling Jisu where the invitation is for', async () => {
    await start('erase');
    const run = await play({ ...studioChoice, e0_jisu_text: directText });
    finished(run);
    expect(run.state).toMatchObject({ chapterIndex: 1, resolvedEndingId: 'stayed_home' });
    expect(run.shown).toContain(directText);
    expect(run.shown).toContain('오늘은 집에 있을게. 다음에 보자.');
    expect(heard(run.shown, '담배 하나만 빌릴 수 있어요?')).toBe(false);
  });

  it('returns home when Doyun takes the designated driver', async () => {
    await start('erase');
    const run = await play({
      ...studioChoice, e0_jisu_text: lateText, e0_junseong: '대리를 불렀다고 한다',
    });
    finished(run);
    expect(run.state).toMatchObject({ chapterIndex: 1, resolvedEndingId: 'came_home' });
    expect(run.state.background).toContain('/couple_home.svg');
    expect(run.shown).toContain('늦어서 미안. 대리 잡혔어. 지금 집에 가.');
    expect(heard(run.shown, '호출 · 취소됨')).toBe(false);
  });

  it.each([
    [briefText, '청첩장 그 사진 골랐던 날? 나한테 민석이 만나러 간다고 했잖아.'],
    [lateText, '민석이 생일이라며. 그래서 늦는다는 톡에도 더 안 물어본 거야.'],
  ])('새벽에 아무것도 안 지우면 남은 것이 1·3·4장에서 돌아온다 (%s)', async (excuse, recall) => {
    await start('erase');
    const run = await play({
      e0_studio: '오늘 보낼 수 있다고 한다',
      e0_jisu_text: excuse,
      e0_junseong: '잔을 받는다',
      e0_erase: '방을 나간다',
      e1_rumor: '농담에 맞장구친다',
      e1_awake: '왜 가만히 있었느냐고 묻는다',
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
    // The one thing he asks the man himself is remembered on the roof as the only one.
    expect(heard(run.shown, '인사하면 더 빨리 가실 것 같았어요')).toBe(true);
    expect(heard(run.shown, '직접 물어본 건 야근하던 날 한 번이다')).toBe(true);
    expect(heard(run.shown, '직접 물어본 건 하나도 없다')).toBe(false);
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
    // The friend he was waiting for leaves first, and the morning has someone else's order in it.
    expect(heard(run.shown, '친구 올 때까지만이라고 했다. 그 친구가 갔다')).toBe(true);
    expect(heard(run.shown, '내가 개는 모양이 아니다')).toBe(true);
    expect(heard(run.shown, '민재는 그걸 그대로 믿었다')).toBe(true);
    expect(heard(run.shown, '길에서 마주쳐도 그냥 지나가실 거예요')).toBe(true);
    expect(heard(run.shown, '폰이 먼저 알아봤네')).toBe(true);
    expect(heard(run.shown, '3주 전 새벽 것 중에 안 지운 게 남아 있다')).toBe(true);
    expect(run.state.storyLog.filter((entry) =>
      entry.kind === 'dialogue' && entry.sceneId === 'search' && entry.text === '안 와?')).toHaveLength(1);
    // 하린 sent the message she usually deletes, so 아진 brings it up eleven years earlier.
    expect(heard(run.shown, '관심 없는 애가 지난주에 껴 달라고 했는데')).toBe(true);
    expect(run.shown).toContain('나도 듣고 있는데ㅋㅋ 나도 껴줘');
    // The class chat she never opened is the same demand 도윤 gets from his team eleven years on.
    expect(run.shown).toContain('@한도윤 해명하세요');
    expect(run.shown).toContain('@유하린 해명하세요ㅋㅋ');
    expect(run.shown.indexOf('@유하린 해명하세요ㅋㅋ')).toBeGreaterThan(run.shown.indexOf('@한도윤 해명하세요'));
    expect(heard(run.shown, '금요일에는 학교에 안 갔다')).toBe(true);
    expect(run.shown).not.toContain('2016년 3월 아래 · 항목 없음');
    expect(run.shown).toContain(recall);
    const invitation = run.shown.findIndex(line => line.startsWith('식탁 한쪽에 사진관에서 고른 청첩장'));
    expect(invitation).toBeGreaterThan(-1);
    expect(run.shown.indexOf('오늘 어디 갔어? 회사 말고.')).toBeGreaterThan(invitation);
  });

  it('셋 다 지우면 삼 주 전 새벽이 통째로 없다', async () => {
    await start('erase');
    const run = await play({
      e0_studio: '이번 달 카드값을 말한다',
      e0_jisu_text: lateText,
      e0_junseong: '잔을 받는다',
      e0_erase: '메시지||사진||위치 기록||방을 나간다',
      e1_rumor: '답장하지 않는다',
      e1_awake: '모니터로 눈을 돌린다',
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
    expect(heard(run.shown, '인사하면 더 빨리 가실 것 같았어요')).toBe(false);
    expect(heard(run.shown, '그 사람한테 직접 물어본 건 하나도 없다')).toBe(true);
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
