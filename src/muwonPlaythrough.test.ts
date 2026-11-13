import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { handleAdvance, loadGameFromUrl, setScenePresentationPaused, setSkipReadActive, submitChoiceOption, submitInputAnswer } from './engine';
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

type Route = Record<string, string>;

const best: Route = {
  c1_cause: '목이 졸린 뒤 우물에 던져졌다',
  c1_accuse: '오라비의 손을 보여 달라고 한다',
  c2_yeogeum: '손톱 밑에서 나온 감청 실을 보여 준다',
  c2_rescue: '막쇠의 허리띠를 잡아 끌어낸다',
  c2_poison: '입에 밥을 물렸다가 닭에게 먹여 본다',
  c3_deal: '거절하고 판관 앞에서 따지자고 한다',
  c3_r1: '상처 탁본 — 폭이 한 치',
  c3_r2: '닭 실험 기록 — 불 전에 독',
  c3_r3: '덕구는 왼손을 못 쓴다 — 상처는 왼손잡이의 것',
  c4_ambush: '기울어진 얼음 더미를 밀어 넘어뜨린다',
  t1: '분이의 시장 — 거품 없음, 목의 손자국',
  t2: '주머니 주문서 — 붉은 표식',
  t3: '닭 실험 기록 — 불 전에 독',
  t4: '전의감 도장 — 깨진 모서리',
  t_final: '의관 한명재',
};

async function play(route: Route, maxSteps = 3000) {
  const picked: string[] = [];
  for (let step = 0; step < maxSteps; step += 1) {
    const state = useVNStore.getState();
    if (state.error) throw new Error(`engine error: ${state.error.message}`);
    if (state.isFinished || state.gameOver) break;
    if (state.inputGate.active && !state.busy) {
      submitInputAnswer(route.__name ?? '');
    } else if (state.choiceGate.active && !state.busy) {
      const key = state.choiceGate.key ?? '';
      const options = state.choiceGate.options;
      const wanted = route[key];
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
  return { state: useVNStore.getState(), picked };
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
  it('reaches the true ending when everyone is saved and every proof lands', async () => {
    await start();
    const { state, picked } = await play(best);
    expect(state.gameOver, picked.join('\n')).toBeUndefined();
    expect(state.isFinished).toBe(true);
    expect(state.routeVars).toMatchObject({ truth: 4, deokgu_saved: true, makssoe_alive: true, player_name: '서연' });
    expect(state.resolvedEndingId).toBe('muwon');
  }, 60000);

  it('reaches the late ending when Makssoe was hurt saving the ledger', async () => {
    await start();
    const { state } = await play({ ...best, __name: '하나', c2_rescue: '장부 궤짝을 끌어낸다' });
    expect(state.routeVars.player_name).toBe('하나');
    expect(state.storyLog.some((entry) => 'text' in entry && entry.text.includes('하나는 품에서'))).toBe(true);
    expect(state.routeVars).toMatchObject({ truth: 4, makssoe_hurt: true, makssoe_alive: false });
    expect(state.resolvedEndingId).toBe('late_muwon');
  }, 60000);

  it('covers the ledger when the trial collapses', async () => {
    await start();
    const { state } = await play({
      ...best,
      t1: '은비녀 — 검게 변하지 않았다',
      t1_retry: '주머니 주문서 — 감청 주머니 삼백',
      t2: '상처 탁본 — 폭 한 치',
      t2_retry: '가짜 청심원 — 속이 석회',
      t3: '감청 실 — 비단전 물건',
    });
    expect(state.resolvedEndingId).toBe('covered_ledger');
  }, 60000);

  it('ends in silence when the officer’s deal is accepted', async () => {
    await start();
    const { state } = await play({ ...best, c3_deal: '거래를 받아들인다' });
    expect(state.routeVars).toMatchObject({ struck_deal: true });
    expect(state.resolvedEndingId).toBe('price_of_silence');
  }, 60000);

  it('fails with a recoverable game over when the brother is handed over', async () => {
    await start();
    const { state } = await play({ ...best, c1_accuse: '오라비를 포도청에 넘긴다' });
    expect(state.gameOver?.title).toBe('곤장 아래의 자백');
  }, 60000);
});
