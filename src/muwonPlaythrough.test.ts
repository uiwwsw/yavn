import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { handleAdvance, loadGameFromUrl, setScenePresentationPaused, setSkipReadActive, submitChoiceOption } from './engine';
import { useVNStore } from './store';
// The engine imports the YAML parser lazily. Load it up front so the first game load
// does not wait on real module transformation while fake timers are advanced.
import './parser';

// Plays 무원 from the first line to an ending through the real engine, choosing options by
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

type Route = Record<string, string | string[]>;

const best: Route = {
  c1_cause: '목이 졸린 뒤 우물에 던져졌다',
  c1_accuse: '오라비의 손을 확인한다',
  c2_yeogeum: '감청 실을 보여 준다',
  c2_rescue: '막쇠를 끌어낸다',
  c2_poison: '닭에게 밥을 먹여 독을 확인한다',
  c3_deal: '거래를 거절하고 판관에게 간다',
  c3_r1: '상처 탁본',
  c3_r2: '닭 실험 기록',
  c3_r3: '덕구의 손',
  c4_match: '주머니 주문서',
  c4_time: '오늘 낮, 오차를 함께 적는다',
  c4_ambush: '얼음 더미를 밀어 넘어뜨린다',
  c4_servant: '곤장은 안 된다고 한다',
  t2: '주머니 주문서',
  t3_doorway: '약재실 문간의 의관',
  t4_time: '윤길의 시장',
  t5_margin: '언해 맨 뒷장',
};

async function play(route: Route, maxSteps = 5000) {
  const picked: string[] = [];
  const seen = new Set<string>();
  for (let step = 0; step < maxSteps; step += 1) {
    const state = useVNStore.getState();
    if (state.error) throw new Error(`engine error: ${state.error.message}`);
    if (state.isFinished || state.gameOver) break;
    expect(state.inputGate.active).toBe(false);
    if (state.dialog.fullText) seen.add(state.dialog.fullText);
    if (state.choiceGate.active && !state.busy) {
      const key = state.choiceGate.key ?? '';
      const options = state.choiceGate.options;
      const plan = route[key];
      const wanted = Array.isArray(plan) ? plan.find((text) => options.some((option) => option.text === text)) : plan;
      // Investigation boards cycle through unexplored targets; take the first that is shown.
      const index = wanted === undefined ? 0 : options.findIndex((option) => option.text === wanted);
      if (index < 0) throw new Error(`option "${wanted}" not offered at ${key}: ${options.map((o) => o.text).join(' | ')}`);
      picked.push(`${key}=${options[index].text}`);
      submitChoiceOption(index, true);
    } else {
      handleAdvance(true);
    }
    await vi.advanceTimersByTimeAsync(400);
  }
  return { state: useVNStore.getState(), picked, seen: Array.from(seen) };
}

beforeEach(() => {
  vi.useFakeTimers();
  const values = new Map<string, string>();
  vi.stubGlobal('localStorage', { getItem: (k: string) => values.get(k) ?? null, setItem: (k: string, v: string) => values.set(k, v), removeItem: (k: string) => values.delete(k) });
  vi.stubGlobal('window', globalThis);
  vi.stubGlobal('location', { origin: 'http://test', href: 'http://test/game-list/muwon/' });
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
  void loadGameFromUrl('http://test/game-list/muwon/');
  await vi.advanceTimersByTimeAsync(3000);
}

describe('무원 full playthrough', () => {
  const order = (seen: string[], ...needles: string[]) => needles.map((needle) => seen.findIndex((text) => text.includes(needle)));

  it('reaches the true ending when everyone is saved and every proof lands', async () => {
    await start();
    const { state, picked, seen } = await play(best);
    expect(state.gameOver, picked.join('\n')).toBeUndefined();
    // Her first body and the dark of the ice house are written out, not skipped.
    expect(seen.some((text) => text.includes('식은 손을 이렇게 오래 쥐어 본 적이 없다'))).toBe(true);
    expect(seen.some((text) => text.includes('등불을 낮추니 붉다'))).toBe(true);
    // Looking at the brother's hands before he was bound comes back two chapters later.
    expect(seen.some((text) => text.includes('제 손등부터 봐 준 사람은 의녀뿐이었다고'))).toBe(true);
    // The folded back page is asked about at the well, half-remembered at the fire, read on
    // the night of 9/29, and only then laid before the court, where the old record names him.
    const [folded, planted, margin, record] = order(seen, '뒷장은 왜 접어 뒀수', '어디서 본 말이다', '주머니는 남빛. 약 냄새 없음. 둘 다 그 밤을 넘기지 못함', '검험 전의감 의관 한명재');
    expect(folded).toBeGreaterThan(-1);
    expect(planted).toBeGreaterThan(folded);
    expect(margin).toBeGreaterThan(planted);
    expect(record).toBeGreaterThan(margin);
    // The doubled 冤 is asked about on the first night and answered at the last dawn.
    const [asked, answered] = order(seen, '저 글자는 왜 두 번 썼수', '그 두 번 쓴 글자는 이제 알았수');
    expect(asked).toBeGreaterThan(-1);
    expect(answered).toBeGreaterThan(asked);
    // Makssoe asks how his name looks, finds it in her first line, then on the accusation.
    const [slip, firstLine, accusation] = order(seen, '내 이름은 어떻게 생겼수', '이거하고 같네', '이거네. 이건 알아');
    expect(slip).toBeGreaterThan(-1);
    expect(firstLine).toBeGreaterThan(slip);
    expect(accusation).toBeGreaterThan(firstLine);
    // The child from the clinic bed is back on screen, and her pouch reaches the court.
    expect(seen.some((text) => text.includes('열이 내린다. 점순이 손을'))).toBe(true);
    expect(seen.some((text) => text.includes('이 주머니는 그 아이 어미 것입니다'))).toBe(true);
    expect(seen.some((text) => text.includes('본 사람 입으로 듣는 것이 옳소'))).toBe(true);
    expect(seen.some((text) => text.includes('의녀 송씨에게 씌운 죄는 지운다'))).toBe(true);
    expect(state.isFinished).toBe(true);
    expect(state.routeVars).toMatchObject({
      truth: 4, trust_dowon: 3, deokgu_saved: true, makssoe_alive: true, servant_beaten: false, ledger_whole: false, player_name: '서연',
    });
    expect(state.resolvedEndingId).toBe('muwon');
  }, 90000);

  it('reaches the late ending when Makssoe was hurt saving the ledger, and the ledger carries the trial', async () => {
    await start();
    const { state, seen } = await play({ ...best, c2_rescue: '장부 궤짝을 끌어낸다', c2_yeogeum: '어젯밤 어디 있었는지 다그친다' });
    // The chest path keeps a whole page that the Makssoe path never sees.
    expect(seen.some((text) => text.includes('구월 열아흐레 받음'))).toBe(true);
    // He is treated on the night of 9/24, then dies asking about the line with his name.
    expect(seen.some((text) => text.includes('그 궤짝은 무사하우'))).toBe(true);
    expect(seen.some((text) => text.includes('거기 내 이름 적었수'))).toBe(true);
    // Yeogeum shut her mouth, so the ledger has to stand in for her at the trial.
    expect(seen.some((text) => text.includes('셈은 하고 왔어요'))).toBe(false);
    expect(seen.some((text) => text.includes('박씨는 그 도장에서 약을 받았구나'))).toBe(true);
    expect(seen.some((text) => text.includes('문설주에 기대는 사람은 없다'))).toBe(true);
    expect(state.routeVars).toMatchObject({ truth: 4, makssoe_hurt: true, makssoe_alive: false, ledger_whole: true, trust_yeogeum: 0 });
    expect(state.resolvedEndingId).toBe('late_muwon');
  }, 90000);

  it('loses the apothecary link when Makssoe is pulled out and Yeogeum was pressed', async () => {
    await start();
    const { state, seen } = await play({ ...best, c2_yeogeum: '어젯밤 어디 있었는지 다그친다' });
    // The moment she closes up is on screen in chapter 2, and her absence is on screen at the trial.
    expect(seen.some((text) => text.includes('여금이 문간에서 한 번 돌아본다'))).toBe(true);
    expect(seen.some((text) => text.includes('구월 열아흐레 받음'))).toBe(false);
    expect(seen.some((text) => text.includes('여금은 오지 않았다'))).toBe(true);
    expect(state.routeVars).toMatchObject({ truth: 3, makssoe_alive: true, ledger_whole: false, trust_yeogeum: 0 });
    expect(state.resolvedEndingId).toBe('covered_ledger');
  }, 90000);

  it('lets the judge sit back when trust was never earned', async () => {
    await start();
    const { state, seen } = await play({ ...best, c1_accuse: '실의 출처를 조사한다', c4_time: '오늘 낮이라고 못 박는다' });
    expect(seen.some((text) => text.includes('이름은 적었으나, 그 이상은 장담하지 못하겠소'))).toBe(true);
    expect(seen.some((text) => text.includes('본 사람 입으로 듣는 것이 옳소'))).toBe(false);
    expect(seen.some((text) => text.includes('얼음 속 송장을 시진까지 안다는 말은 쓰지 않는다'))).toBe(true);
    expect(state.routeVars).toMatchObject({ trust_dowon: 1, time_fixed: true, credibility: 2, truth: 4 });
    expect(state.resolvedEndingId).toBe('muwon');
  }, 90000);

  it('halves the verdict when the servant is handed to the rod', async () => {
    await start();
    const { state, seen } = await play({ ...best, c4_servant: '하인을 포도청에 넘긴다' });
    expect(seen.some((text) => text.includes('반 환씩 먹인 두 집 아이는 살았다'))).toBe(true);
    expect(seen.some((text) => text.includes('곤장 아래 받은 자복이라 채택되지 않았다'))).toBe(true);
    expect(seen.some((text) => text.includes('하인, 이름 모름. 왼손잡이. 곤장 열 대에 자복'))).toBe(true);
    expect(state.routeVars).toMatchObject({ servant_beaten: true, truth: 4 });
    expect(state.resolvedEndingId).toBe('half_verdict');
  }, 90000);

  it('shows the brother being released and only compares the stamps after both have been found', async () => {
    await start();
    const { state, picked, seen } = await play({
      ...best,
      c1_accuse: '실의 출처를 조사한다',
      c4_storeroom: ['짚 아래 상자', '출납부', '막쇠를 찾는다'],
    });
    expect(state.isFinished).toBe(true);
    expect(state.routeVars.c1_brother).toBe(false);
    expect(seen.some((text) => text.includes('제 손등부터 봐 준 사람은 의녀뿐이었다고'))).toBe(false);
    const release = seen.findIndex((text) => text.includes('그 사내를 놓아주시오'));
    expect(release).toBeGreaterThanOrEqual(0);
    expect(seen.findIndex((text) => text.includes('다시 데려가오'))).toBeGreaterThan(release);
    expect(picked.filter((choice) => choice.startsWith('c4_storeroom='))).toEqual([
      'c4_storeroom=짚 아래 상자',
      'c4_storeroom=출납부',
      'c4_storeroom=막쇠를 찾는다',
    ]);
    const chest = seen.findIndex((text) => text.includes('상자 뚜껑에 붉은 도장이 찍혀 있다'));
    const ledger = seen.findIndex((text) => text.includes('받은 사람 이름 대신 붉은 도장'));
    const comparison = seen.findIndex((text) => text.includes('출납부와 상자의 도장을'));
    expect(chest).toBeGreaterThanOrEqual(0);
    expect(ledger).toBeGreaterThan(chest);
    expect(comparison).toBeGreaterThan(ledger);
    // Without the brother's hands the judge still vouches: a clean confrontation and an honest time of death.
    expect(state.routeVars.trust_dowon).toBe(2);
  }, 90000);

  it('covers the ledger when the trial collapses', async () => {
    await start();
    const { state } = await play({
      ...best,
      t2: '감청 실',
      t2_retry: '가짜 청심원',
      t3_doorway: '닭 실험 기록',
    });
    expect(state.routeVars.credibility).toBe(0);
    expect(state.resolvedEndingId).toBe('covered_ledger');
  }, 90000);

  it('closes the case before the icehouse investigation if the confrontation fails', async () => {
    await start();
    const { state, seen } = await play({ ...best, c3_r1: '은비녀' });
    const scheduled = seen.findIndex((text) => text.includes('처결은 9월 26일'));
    const after = seen.findIndex((text) => text.includes('처결이 끝난 시신을 거두는 건 오작인이다'));
    expect(scheduled).toBeGreaterThanOrEqual(0);
    expect(after).toBeGreaterThan(scheduled);
    expect(seen.some((text) => text.includes('짐꾼 덕구. 왼손으로는 낫을 쥐지 못함'))).toBe(true);
    expect(seen.some((text) => text.includes('서빙고지기가 한성부 문을 두드렸다'))).toBe(false);
    expect(state).toMatchObject({ chapterIndex: 3, resolvedEndingId: 'forced_confession' });
  }, 90000);

  it('ends in silence when the officer’s deal is accepted, with the margin folded shut again', async () => {
    await start();
    const { state, seen } = await play({ ...best, c3_deal: '거래를 받아들인다' });
    expect(seen.some((text) => text.includes('주머니는 남빛. 약 냄새 없음'))).toBe(true);
    expect(seen.some((text) => text.includes('그 장을 다시 접는다'))).toBe(true);
    expect(state.routeVars).toMatchObject({ struck_deal: true });
    expect(state.resolvedEndingId).toBe('price_of_silence');
  }, 90000);

  it('fails with a recoverable game over when the brother is handed over', async () => {
    await start();
    const { state } = await play({ ...best, c1_accuse: '오라비를 포도청에 넘긴다' });
    expect(state.gameOver?.title).toBe('곤장 아래의 자백');
  }, 90000);
});
