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
      b1_home: '침대||책상 위||수리용 단말||가방을 메고 나간다',
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
    expect(heard(run.shown, '신호등이 돌아왔으면 집 전화도 신호가 갈까')).toBe(true);
    expect(heard(run.shown, '그러다 누가 유리를 깼다')).toBe(true);
    expect(heard(run.shown, '경찰 사이렌은 첫날 밤에 제일 많았다')).toBe(true);
    expect(heard(run.shown, '확인될 때까지 모시겠습니다')).toBe(true);
    expect(heard(run.shown, '응답 없음. 빈집으로 기록합니다')).toBe(true);
    expect(heard(run.shown, '저건 계단을 올라와서 문을 두드린다')).toBe(true);
    const knock = run.shown.findIndex((text) => text.includes('빈집으로 기록합니다'));
    const leftHome = run.shown.findIndex((text) => text.includes('사흘이면 온다고 했다. 사흘이 지났다'));
    const found = run.shown.findIndex((text) => text.includes('문을 두드리던 것과 같은 모델이다'));
    expect(knock).toBeGreaterThan(-1);
    expect(leftHome).toBeGreaterThan(knock);
    expect(found).toBeGreaterThan(leftHome);
    // So the robot in the alley is checked before it is touched, and he keeps a hand on the power.
    expect(heard(run.shown, '열까지 센다. 안 움직인다. 스물까지 센다')).toBe(true);
    expect(heard(run.shown, '내 손목을 잡으면 그대로 뜯는다')).toBe(true);
    expect(heard(run.shown, '오늘이 열사흘째야')).toBe(true);
    // The three things he looked at on the third morning come back in chapter 3.
    expect(heard(run.shown, '집에 두고 온 게임기는 엄마가 사 준 거야')).toBe(true);
    expect(heard(run.shown, '아빠가 그냥 안 받는 거면 좋겠어')).toBe(true);
    expect(heard(run.shown, '천장에 하루 스피커 자국')).toBe(true);
    // Chapter 2 asked "믿어도 됨?" and got "아니." Chapter 4 answers it the other way.
    expect(heard(run.shown, '이번엔 어')).toBe(true);
    expect(heard(run.shown, '대답 안 해 줬어')).toBe(false);
    expect(heard(run.shown, '그럼 나한테 하는 말도 욕임?')).toBe(true);
    expect(heard(run.shown, '그거 좋은 뜻이라며.')).toBe(false);
    expect(heard(run.shown, '켜지기 전 건 모름.')).toBe(true);
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
      b1_home: '가방을 메고 나간다',
      b2_register: '아무 일도 없다고 한다',
      b3_snack: '복숭아를 내일로 남겨 둔다',
      b3_drone: '{{android_name}} 뒤에 숨는다',
      b3_promise: '대답을 내일로 미룬다',
      b4_save: '슬롯을 비워 둔다',
    });
    finished(run);
    expect(heard(run.shown, '대답 안 해 줬어')).toBe(true);
    expect(heard(run.shown, '…가자. 멀리 안 갈 거니까.')).toBe(true);
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
      b1_home: '가방을 메고 나간다',
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
    expect(heard(run.shown, '내가 정리를 덜 한 거고')).toBe(true);
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

describe('튜토리얼', () => {
  const honestRoute: Route = {
    t0_coupon: '앞치마 주머니에 넣는다',
    t0_kwang: '개봉한 상품을 빼고 환불한다',
    t0_mail: '문을 두드려 우편이 왔다고 알린다',
    t1_bow: '고개를 숙인다',
    t1_look: '번호표 기계||연필꽂이||다음 단계로',
    t1_say: '왜 그렇게 많이 사냐고 쏘아붙인다',
    t1_day_pencil: '연필을 연필꽂이에 꽂는다',
    t1_pencil: '연필을 든 채 다가간다',
    t2_sh: '오늘은 레플라에 접속하지 말라고 한다',
    t2_where: '들은 장소만 말한다',
    t2_tamper: '아무것도 건드리지 않고 로그아웃한다',
    t3_tell: '레플라에서 한 일을 털어놓는다',
    t3_room: '벽에 붙은 그래프||책상 위 출입 카드||레플라가 어떻게 작동하는지 묻는다',
    t3_door: '상혁의 어머니에게 연락한다',
    t4_room: '모니터||벽 콘센트||책상 서랍||모니터 앞에 앉는다',
    t4_end: '전원선을 뽑는다',
  };

  it('심한 말을 했으면 광철과 112 기록이 그 말을 돌려준다', async () => {
    await start('tutorial');
    expect(useVNStore.getState().background).toContain('/cs_desk_wait.svg');
    const called = await play(honestRoute, state => state.dialog.fullText.startsWith('띵동 — 027번 고객님'));
    expect(called.state.background).toContain('/cs_desk.svg');
    expect(called.state.placeCaption?.automatic).not.toBe(true);
    const run = await play(honestRoute);
    finished(run);
    expect(run.picked.slice(0, 2).map(entry => entry.split('=')[0])).toEqual(['t0_kwang', 't0_coupon']);
    expect(heard(run.shown, '최초 처리자 정해수')).toBe(true);
    expect(heard(run.shown, '혼자 다 먹지도 못하면서 왜 사느냐고')).toBe(true);
    expect(heard(run.shown, '틀린 말은 아니더라. 혼자 그걸 다 먹을 수는 없지')).toBe(true);
    // By day the man asked him to put the pencil down and he did; the lot at night asks the opposite.
    expect(heard(run.shown, '빈 손을 둘 데가 없어 창구 모서리를 잡는다')).toBe(true);
    expect(heard(run.shown, '내려놓았다. 여기서는 손에 쥔 걸 써 보라고 한다')).toBe(true);
    expect(heard(run.shown, '손가락이 벌써 이 굵기로 굽어 있다')).toBe(false);
    expect(heard(run.shown, '신고할 때 저 말을 그대로 따라 했대요')).toBe(true);
    expect(heard(run.shown, '제 폰으로 찍었어요. 어제 녹화실에서.')).toBe(false);
    // 상혁 opens the door a crack for someone who has been looking after him.
    expect(heard(run.shown, '밥 고맙다. 네 차례 아니었잖아')).toBe(true);
    expect(heard(run.shown, '시연용 밴드 대여란에 이름을 썼다')).toBe(true);
    expect(heard(run.shown, '퇴근 전에 둘째 서랍을 다시 열었다')).toBe(false);
    expect(heard(run.shown, '어. 1270. 바꾸려다 말았어.')).toBe(true);
    expect(run.state.storyLog.some(entry => entry.kind === 'dialogue' && entry.channel === 'message' && entry.thread === '상혁 어머니')).toBe(true);
  });

  it('ends only the selected user session and preserves the other connections on save restore', async () => {
    await start('tutorial');
    const route = {
      ...honestRoute,
      t1_pencil: '연필을 내려놓는다',
      t1_pencil_again: '연필을 든 채 다가간다',
      t4_end: '세션 종료 창을 연다',
      __input: '0001',
    };
    const before = await play(route, state => state.dialog.continueLabel === '0001번 세션을 종료한다');
    expect(before.state.currentSceneId).toBe('end_close');
    expect(heard(before.shown, '바닥에 닿는다')).toBe(true);
    expect(heard(before.shown, '튜토리얼 3/5 완료')).toBe(true);
    expect(heard(before.shown, '번호표 발급기 · 2031.04.13 00:56')).toBe(true);
    expect(before.state.currentMusic).toContain('/fan_idle.flac');
    expect(before.state.background).toContain('/server_room.svg');

    const after = await play(route, state => state.dialog.fullText.startsWith('화면에서 내 번호가 사라진다.'));
    expect(after.state.background).toContain('/server_room.svg');
    expect(after.state.currentMusic).toContain('/fan_idle.flac');

    await vi.advanceTimersByTimeAsync(1000);
    expect(saveCurrentProgress().exists).toBe(true);
    const loaded = loadSaveSlot('manual');
    await vi.advanceTimersByTimeAsync(3000);
    expect(await loaded).toBe(true);
    expect(useVNStore.getState()).toMatchObject({
      background: expect.stringContaining('/server_room.svg'),
      currentMusic: expect.stringContaining('/fan_idle.flac'),
      dialog: { fullText: expect.stringContaining('팬은 계속 돈다.') },
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
      t1_day_pencil: '연필을 쥔 채 듣는다',
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
    expect(heard(run.shown, '엄지가 연필 옆면을 누르고 있다')).toBe(true);
    expect(heard(run.shown, '손가락이 벌써 이 굵기로 굽어 있다')).toBe(true);
    expect(heard(run.shown, '여기서는 손에 쥔 걸 써 보라고 한다')).toBe(false);
    // Step 3 is not a blank menu choice. The lot is exact where only he would know and hollow
    // elsewhere, the man does what the real one did not, and that is what makes it feel safe.
    const beats = [
      '손톱 밑에 흑연이 묻는다',
      '무게가 없다. 내려놓아도 소리가 안 난다',
      '목은 진짜로 따갑다',
      '광철의 윤곽선 안쪽에 점퍼 색이 차기 시작했다',
      '번호판 칸이 비어 있다',
      '윤곽선뿐이던 얼굴에 색이 찬다',
      '뚜껑을 따서 해수 신발 위에 붓는다',
      '너희 팀장이',
      '이건 그 사람이 아니다',
      '한 번만. 여기서 한 번 해 보고 끄면 된다',
      '심 쪽이 앞을 보는 건 처음이다',
      '그 안쪽에서 무언가 버틴다',
      '…자네가 왜.',
      '손을 빼자 부러진 심이 보인다',
      '발등에서 드링크 냄새가 난다',
    ];
    const at = beats.map(beat => run.shown.findIndex(text => text.includes(beat)));
    expect(beats.filter((_, index) => at[index] < 0)).toEqual([]);
    expect(at).toEqual([...at].sort((a, b) => a - b));
    expect(heard(run.shown, '무슨 말인지는 모르겠고 계속 지르기만 한다')).toBe(true);
    expect(heard(run.shown, '제 폰으로 찍었어요. 어제 녹화실에서.')).toBe(true);
    expect(heard(run.shown, '대답이 없다. 의자가 한 번 더 끌린다')).toBe(true);
    expect(heard(run.shown, '혼자 다 먹지도 못하면서')).toBe(false);
    expect(heard(run.shown, '밥 고맙다')).toBe(false);
    expect(heard(run.shown, '퇴근 전에 둘째 서랍을 다시 열었다')).toBe(true);
    expect(heard(run.shown, '시연용 밴드 대여란에 이름을 썼다')).toBe(false);
  });

  it.each([false, true])('lets Haesu stop the demo by taking off the band (timeout: %s)', async (timeout) => {
    await start('tutorial');
    const route = {
      ...honestRoute,
      t1_pencil: '연필을 내려놓는다',
      t1_pencil_again: '귀 뒤의 밴드를 뗀다',
    };
    if (timeout) {
      await play(route, state => state.choiceGate.active && state.choiceGate.key === 't1_pencil');
      await vi.advanceTimersByTimeAsync(9500);
    }
    const run = await play(route);
    finished(run);
    expect(run.state).toMatchObject({ chapterIndex: 2, resolvedEndingId: 'demo_left' });
    expect(heard(run.shown, '배터리를 빼고 밴드를')).toBe(true);
    expect(heard(run.shown, '튜토리얼 3/5 완료')).toBe(false);
  });
});

describe('오버플로', () => {
  it('starts with Jiwan’s call and keeps the same portrait through the conversation', async () => {
    await start('overflow');
    // The world comes first: what the lens is, and that it has not been wrong in eight years.
    expect(useVNStore.getState().dialog.fullText).toContain('한신뉴로라는 회사가 안경 하나를 내놓았다');
    const waking = (await play({}, state => state.dialog.fullText.includes('아버지에게 전화가 온다'))).state;
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
      o0_door: '지금 대답하고 있지 않느냐고 묻는다',
      o1_trust: '이름을 가리고 기록을 보여준다',
      o1_desk: '시험 출력물을 읽는다||내 렌즈에서 무엇을 확인할지 묻는다',
      o2_pair_lens: '내 렌즈 연결 허용',
      o2_father: '겁났다고 말한다',
      o2_evidence: '지금 여기서 다시 재 달라고 한다',
      o3_sugyeong: '아침에 역에서 병원을 물은 것도 그래서였는지 묻는다',
      o4_end: '기다린 사람들과 함께 이의를 낸다',
    });
    finished(run);
    expect(run.state.resolvedEndingId).toBe('appeal');
    const beats = [
      // Eight years in which nobody found the lens wrong, before anything happens to Jiwan.
      '한신뉴로라는 회사가 안경 하나를 내놓았다',
      '남자 옆에 뜬 숫자는 97이었다',
      '딸 앞에서 61을 띄웠다',
      '렌즈가 재는 것은 얼굴이다',
      '현장 판독 오류 0건 · 8년 연속',
      '틀리지 않는 것과 싸우는 법을 나는 모른다',
      '낮은 숫자가 뜨면 문이 닫힌다',
      '아버지에게 전화가 온다',
      '제 건 반만 얼려요. 아버지도 좀 드시고요',
      '저기요. 장갑 떨어뜨리셨어요.',
      '월계병원이 어느 쪽인지 아세요?',
      '흥분 94 · 역무원 호출',
      '가게 앞에서 쓰러지셨어요',
      '문동식 환자분 아드님이세요?',
      '지금 입을 열면 소리가 갈라진다',
      '병동 문은 보호자 렌즈를 한 번 읽고 열려요',
      '이불 밖으로 맨발 하나가 나와 있다',
      '보호자 면회 확인 · 문지완',
      '그러면 지금 나는 아무렇지도 않은 사람이다',
      '저요? 저 지금 대답하고 있잖아요',
      '그날 그분 렌즈가 01이었고요',
      '이 안내가 뜨면 직원이 같이 들어가야 해서요',
      '잠깐 말씀드려도 괜찮을까요?',
      '없어요. 아직은요.',
      '한수경이라고 합니다',
      '센서 입력 001 → 표시 01',
      '왼쪽은 001, 101. 오른쪽은 둘 다 01이네요.',
      // The answer below is only an answer if the question is still asked.
      '그럼 저는 1이에요, 101이에요?',
      '그때 실제 값은 접수표에 안 남아서',
      // The overflow is offered as the hopeful explanation, not as the answer.
      '…넘쳐서 1이 됐다.',
      '병실에 들어가면 렌즈가 한 번 더 재요',
      '그러면 내일은 혼자 들어가요?',
      '그건 병원이 정해요',
      '그게 있으면 나는 아무렇지 않은 사람이 아니게 된다',
      '아버님 모습이나 목소리는 저장 안 해요',
      '제 거 빼 두셨죠',
      '전화 받았는데 아버지 목소리가 아니어서',
      '보호자 재확인 · 문지완',
      // The reading at the bedside is not a truncated 101. The machine was right.
      '센서 입력 001 → 표시 01\n화면 판정',
      '잘린 자리가 없어요. 들어온 값이 1이에요.',
      '그럼 기계는 안 틀린 거네요',
      '틀린 건 저예요',
      '20:31:40 · 문지완의 렌즈',
      '손은 떨고 계시네요',
      '거기는 아무것도 안 움직였어요',
      '본 사람이 있어요. 문 앞에 간호사님요',
      '두 번 다 제가 본 건 확인서에 적어 드릴게요',
      // What he said at the door is on the nurse's statement, word for word.
      '그 말도 들은 대로 적을게요',
      '적는 칸이 없어서 여백에 써요',
      // Never wrong, because nobody went back to ask the people who read zero.
      '0이 뜬 사람한테는 아무도 안 가요',
      '맞았다고 확인한 0은 팔 년 동안 그 한 건이에요',
      '그럼 안 틀린 게 아니라 안 물어본 거네요',
      '버그이기를 바랐어요',
      '그때도 저 같은 사람 기다리러 가던 길이었어요?',
      '장갑은 고마웠어요. 그건 따로예요.',
      '사람도 넘치면 0부터 다시 세요?',
      '그건 제가 검증한 적이 없어요',
      '오른쪽 얼굴이 움직이지 않는 사람의 숫자다',
      '아까 저 앉혀 주셨잖아요',
      '나는 3이란다',
      '합쳐서 4냐',
      '낼 걸 내러 왔어요',
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
    expect(run.shown.some(text => text.includes('문지완의 렌즈') && text.includes('101'))).toBe(false);
    expect(heard(run.shown, '그럼 언제 들어갈 수 있어요')).toBe(false);
  });

  it('connects missed calls and a late admission to the public ending', async () => {
    await start('overflow');
    const run = await play({
      o0_call: '문자로 답한다',
      o0_door: '셋을 세고 언제 들어갈 수 있는지 묻는다',
      o3_sugyeong: '아무 말 없이 출력물을 끌어온다',
      o1_trust: '수경의 자료부터 보여달라고 한다',
      o1_desk: '결함 보고서를 읽는다||병동에서 연락이 왔는지 확인한다||시험 출력물을 읽는다||내 렌즈에서 무엇을 확인할지 묻는다',
      o2_pair_lens: '내 렌즈 연결 허용',
      o2_father: '물부터 건넨다',
      o2_evidence: '출력물을 접어 주머니에 넣는다',
      o4_end: '내 판독과 수경의 설명을 공개한다',
    });
    finished(run);
    expect(run.state.resolvedEndingId).toBe('broadcast');
    expect(heard(run.shown, '접수표는 안 주셔도 돼요')).toBe(true);
    // He counted at the door instead of protesting, and that is what the nurse saw.
    expect(heard(run.shown, '셋까지 세는데 숨이 두 번 끊긴다')).toBe(true);
    expect(heard(run.shown, '…그럼 언제 들어갈 수 있어요.')).toBe(true);
    expect(heard(run.shown, '저요? 저 지금 대답하고 있잖아요')).toBe(false);
    expect(heard(run.shown, '한참 있다가 면회 시간부터 물으셨어요')).toBe(true);
    expect(heard(run.shown, '그 말도 들은 대로 적을게요')).toBe(false);
    expect(heard(run.shown, '장갑은 고마웠어요')).toBe(false);
    expect(heard(run.shown, '낼 걸 내러 왔어요')).toBe(false);
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
    expect(heard(run.shown.slice(consent), '센서 입력 001 / 렌즈 표시 01')).toBe(true);
    expect(heard(run.shown.slice(consent), '낮게 뜬 판독은 맞았는지 확인한 적이 없습니다')).toBe(true);
    expect(heard(run.shown.slice(consent), '두 번 재서 두 번 다 1이었어요')).toBe(true);
    expect(heard(run.shown, '모서리가 안 맞는다')).toBe(true);
    expect(heard(run.shown, '20:31:40')).toBe(false);
    expect(heard(run.shown.slice(consent), '308호')).toBe(false);
  });

  it('shows the old slip next to a withdrawn verdict without inventing a first reading', async () => {
    await start('overflow');
    const run = await play({
      o0_call: '전화를 받는다',
      o1_trust: '이름을 가리고 기록을 보여준다',
      o1_desk: '시험 출력물을 읽는다||내 렌즈에서 무엇을 확인할지 묻는다',
      o2_pair_lens: '내 렌즈 연결 허용',
      o2_father: '겁났다고 말한다',
      o2_evidence: '지금 여기서 다시 재 달라고 한다',
      o0_door: '지금 대답하고 있지 않느냐고 묻는다',
      o3_sugyeong: '아무 말 없이 출력물을 끌어온다',
      o4_end: '내 기록의 정정을 신청한다',
    });
    finished(run);
    expect(run.state.resolvedEndingId).toBe('one_file');
    expect(heard(run.shown, '20:31:40 · 문지완의 렌즈\n센서 입력 001 → 표시 01')).toBe(true);
    const oldSlip = run.shown.findIndex(text => text.includes('결과지를 나란히 놓고'));
    expect(oldSlip).toBeGreaterThan(-1);
    expect(run.shown[oldSlip + 1]).toContain('‘무반응 의심’ 판정 철회');
    // The number stays. What a person saw is attached next to it.
    expect(run.shown[oldSlip + 1]).toContain('수치 01 유지');
    expect(heard(run.shown, '그 옆에 제가 본 게 붙었어요')).toBe(true);
    expect(run.shown[oldSlip + 1]).not.toContain('101');
  });

  it('lets Jiwan visit without recording a new sensor reading', async () => {
    await start('overflow');
    const run = await play({
      o0_call: '전화를 받는다',
      o1_trust: '이름을 가리고 기록을 보여준다',
      o1_desk: '시험 출력물을 읽는다||내 렌즈에서 무엇을 확인할지 묻는다',
      o2_pair_lens: '연결하지 않고 아버지를 뵙는다',
      o0_door: '셋을 세고 언제 들어갈 수 있는지 묻는다',
    });
    finished(run);
    expect(run.state).toMatchObject({ chapterIndex: 3, resolvedEndingId: 'visiting_hours' });
    expect(run.state.inventory.raw_print).toBeFalsy();
    expect(heard(run.shown, '정서 반응 01 · 무반응 의심')).toBe(true);
    expect(heard(run.shown, '센서 입력 001 → 표시 01\n화면 판정')).toBe(false);
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
