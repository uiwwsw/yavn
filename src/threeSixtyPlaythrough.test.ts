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

const OPEN = '곳간을 연다. 우리 것에서 한 집에 닷 되씩.';
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
// Which star the dark is asked for first. Once a life is lived its star goes out, so a route
// names only its opening and the explore menu hands back whatever is left after that.
const STAR_1894 = '엿을 기다린 아이';
const STAR_1988 = '새벽마다 오던 사람';
const WINTER_JAR = '독이 비지 않았더라면.';
const WINTER_OUT = '그날 나가지 않았더라면.';

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
      let index = options.findIndex((option) => option.text === wanted);
      // The first dark hands back the winter one piece at a time; its menu repeats until the
      // pieces are found. Take whatever is still there until the route's option shows up.
      if (index < 0 && state.choiceGate.presentation === 'explore') index = 0;
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
  it('runs the chain in the order the dark is asked for, and looks back at the end', async () => {
    await start();
    const { state, picked, shown } = await play({
      star: STAR_1894,
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
      l5_leftover: '쉰여섯 해가 두고 간 것을 본다.',
      v4: BESIDE,
      w_remember: '울음',
      v_end: WINTER_OUT,
      l5_look: '돌아본다.',
    });
    expect(state.isFinished, picked.join('\n')).toBe(true);
    // The dark opens on a feeling, not on information, and the first thing the player does is
    // say who they miss without being told who that is.
    expect(heard(shown, '손을 뻗어 본다. 벽이 안 닿는다. 바닥도.')).toBe(true);
    expect(heard(shown, '이 느낌에 이름이 있었다')).toBe(true);
    expect(heard(shown, '보고 싶다.')).toBe(true);
    expect(heard(shown, '누가.')).toBe(true);
    // The first life is free: nothing has been handed down to it yet.
    expect(heard(shown, '웃을 때 왼쪽 눈이 먼저 감긴다')).toBe(true);
    // Each dark is a trial with nobody else in it.
    expect(heard(shown, '어디서 나는지 찾다가 그만둔다. 내 안에서 난다')).toBe(true);
    expect(heard(shown, '묻는 쪽과 답하는 쪽이 같아서 끝나지 않는다')).toBe(true);
    // What one life holds is what the next life cannot do, and it never knows why.
    expect(heard(shown, '나온 말은 그게 아니다')).toBe(true);
    expect(heard(shown, '손은 침대 난간을 잡고 있다')).toBe(true);
    expect(heard(shown, '가방끈이 어깨에 걸려 있다')).toBe(true);
    // The fifth dark hears the earlier lives back as testimony, then one more thing arrives:
    // the winter that was never judged, because the first time around it could not be.
    expect(heard(shown, '바구미는 체로 치면 된다')).toBe(true);
    expect(heard(shown, '같은 점은 없어. 360도 어디에도')).toBe(true);
    expect(heard(shown, '하나가 더 온다')).toBe(true);
    expect(heard(shown, '1809년')).toBe(true);
    expect(heard(shown, '울지 않는 걸 괜찮다고 쳤다')).toBe(true);
    // The storehouse is half somebody else's rice, so refusing is a fact before it is a excuse,
    // and the taffy is asked for three times: in the yard, in the fever, and at the end.
    expect(heard(shown, '맡은 쌀에 손대면 그날로 끝이다')).toBe(true);
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
    expect(heard(shown, '어디서 봤는지 말을 못 하겠다. 본 적이 없으니까')).toBe(true);
    // The ward is where the person finds out, because a ward is a place with time left in it.
    expect(heard(shown, '삼십에서 사십이면 열에 서넛이다')).toBe(true);
    expect(heard(shown, '둘이 다르다는 걸 이제 안다')).toBe(true);
    expect(heard(shown, '안 되는 쪽이 하필 내가 제일 하고 싶었던 쪽이라는 거다')).toBe(true);
    expect(heard(shown, '누가 고르는 것 같다. 나 말고')).toBe(true);
    expect(heard(shown, '아무한테도 안 했다. 열일곱이 할 수 있는 건 그 정도다')).toBe(true);
    // And it carries into its own trial, which gets one step further than the others.
    expect(heard(shown, '지금 보니 고르는 쪽도 나다')).toBe(true);
    // The editor can read the turn-back point in four hundred other people and not in herself.
    expect(heard(shown, '먼저 내려놓는 쪽이 덜 미안하다는 걸')).toBe(true);
    expect(heard(shown, '거기다. 열 번 중에 열 번 다 거기서 돌아간다')).toBe(true);
    expect(heard(shown, '쓰는 것도 됐고 지우는 것도 됐다. 안 되는 건 보내는 것 하나다')).toBe(true);
    expect(heard(shown, '하나만 안 되는 게 우연일 수가 있나')).toBe(true);
    // The fourth face knows her first, and says what is standing behind her when she looks back.
    expect(heard(shown, '아줌마, 어디서 봤는데')).toBe(true);
    expect(heard(shown, '사람 있었어. 근데 얼굴은 안 보여. 맨날 거기 서 있어')).toBe(true);
    // And the winter names who kept coming back, after the lives are done and before the last
    // thing is taken: one soul, four faces, each one further away than the last.
    expect(heard(shown, '넷 다 웃을 때 왼쪽 눈이 먼저 감겼다')).toBe(true);
    expect(heard(shown, '딸이었다가, 아들이었다가, 옆 침대였다가, 모르는 사람이었다')).toBe(true);
    expect(heard(shown, '덮어 두고 나간 아이다')).toBe(true);
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
      v1: '어디에도 매이지 말았어야 했다.',
      l2_heart: CONFESS,
      l2_mother: SLIP_OUT,
      v2: '아무도 믿지 말았어야 했다.',
      l3_open: AFRAID,
      l3_out: JACKET,
      v3: '더 살고 싶었다.',
      l4_mark: "'어두웠다'에 줄을 긋는다.",
      l4_munho: '녹음기를 끄지 않고 듣고만 있는다.',
      l4_sign: WALK,
      l5_leftover: '열일곱 해가 두고 간 것을 본다.',
      v4: BESIDE,
      w_remember: '울음',
      v_end: WINTER_OUT,
    });
    expect(state.isFinished, picked.join('\n')).toBe(true);
    // Shutting the gate is what the daughter defends him for, out at the gate, where he hears it.
    expect(heard(shown, '우리 아버지 그런 사람 아니에요')).toBe(true);
    expect(heard(shown, '목록에 이미 있는 숫자다')).toBe(true);
    expect(heard(shown, '같은 점이 두 번이다')).toBe(true);
    expect(state.routeVars).toMatchObject({ l1_end: 'kept', t_kin: true, v_end: 'kin' });
    expect(state.resolvedEndingId).toBe('circle');
  }, 120000);

  it('starts somewhere else when a different star is the one that is missed', async () => {
    await start();
    const { state, picked, shown } = await play({
      star: STAR_1988,
      l3_open: '"괜찮대요. 가게 가 보세요."',
      l3_out: '"누나 혼자 가요. 엄마가 여섯 시에 와요."',
      v3: '더 살고 싶었다.',
      l1_rice: OPEN,
      l1_leave: STAY,
      v1: '어디에도 매이지 말았어야 했다.',
      l2_heart: CONFESS,
      l2_mother: CARRY,
      v2: '아무도 믿지 말았어야 했다.',
      l4_mark: "'가다가 돌아봤다'에 줄을 긋는다.",
      l4_munho: '녹음기를 끄지 않고 듣고만 있는다.',
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
    expect(heard(shown, '1988년 구월')).toBe(true);
    expect(heard(shown, '바구미는 체로 치면 된다')).toBe(true);
    // The ward is free because nothing has been handed down to it yet, and after it the chain
    // still runs: 더 살고 싶었다 shuts the storehouse, 매이지 말았어야 shuts the train.
    expect(heard(shown, '손목이 돌아가지 않는다')).toBe(true);
    expect(heard(shown, '열면 안 된다는 생각이 어디서 오는지 모르겠다')).toBe(true);
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
      v1_stop: '없다. 여기 있는다.',
    });
    expect(picked).toContain('v1_stop=없다. 여기 있는다.');
    expect(state.resolvedEndingId).toBe('still');
  }, 120000);
});
