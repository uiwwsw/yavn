import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PresentationClock } from './presentationClock';

describe('visible story time', () => {
  let clock: PresentationClock;
  beforeEach(() => {
    vi.useFakeTimers();
    clock = new PresentationClock({ now: () => Date.now(), set: (fn, ms) => Number(setTimeout(fn, ms)), clear: (id) => clearTimeout(id) });
  });
  afterEach(() => vi.useRealTimers());
  it('preserves the remaining choice time across long loading covers', () => {
    const choose = vi.fn(); clock.set(choose, 1000);
    vi.advanceTimersByTime(250); clock.setPaused(true);
    const frozen = clock.now; vi.advanceTimersByTime(12000);
    expect(choose).not.toHaveBeenCalled(); expect(clock.now).toBe(frozen);
    clock.setPaused(false); vi.advanceTimersByTime(749); expect(choose).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1); expect(choose).toHaveBeenCalledTimes(1);
  });
  it('starts a first-scene timer only after the title has uncovered it', () => {
    clock.setPaused(true); const advance = vi.fn(); clock.set(advance, 200);
    vi.advanceTimersByTime(6000); expect(advance).not.toHaveBeenCalled();
    clock.setPaused(false); vi.advanceTimersByTime(199); expect(advance).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1); expect(advance).toHaveBeenCalledOnce();
  });
  it('cancels old attacks and choices even while their clock is paused', () => {
    const stale = vi.fn(); const id = clock.set(stale, 300);
    clock.setPaused(true); clock.clear(id); clock.set(stale, 100); clock.clearAll();
    clock.setPaused(false); vi.runAllTimers(); expect(stale).not.toHaveBeenCalled();
  });
  it('handles repeated pause requests and callbacks that schedule their next phase', () => {
    const impact = vi.fn(); clock.set(() => clock.set(impact, 80), 520);
    vi.advanceTimersByTime(500); clock.setPaused(true); clock.setPaused(true); vi.advanceTimersByTime(9000);
    clock.setPaused(false); clock.setPaused(false); vi.advanceTimersByTime(99); expect(impact).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1); expect(impact).toHaveBeenCalledOnce();
  });
});
