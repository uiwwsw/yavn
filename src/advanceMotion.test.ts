import { describe, expect, it } from 'vitest';
import {
  CATCH_UP_EXIT_FADE_DURATION_MS,
  CATCH_UP_LAYOUT_SETTLE_MS,
  CATCH_UP_MOTION_DURATION_MS,
  CATCH_UP_MOTION_EASING,
  QUEUED_MANUAL_ADVANCE_MAX_AGE_MS,
  RAPID_MANUAL_ADVANCE_INTERVAL_MS,
  isRapidManualAdvance,
  isQueuedManualAdvanceFresh,
  resolveAdaptiveExitFadeDuration,
  resolveAdaptiveLayoutSettleDuration,
  resolveAdaptiveMotionEasing,
  resolveAdaptiveMotionTiming,
} from './advanceMotion';

describe('manual advance motion tempo', () => {
  it('enters catch-up only for consecutive manual advances', () => {
    expect(isRapidManualAdvance(undefined, 1000)).toBe(false);
    expect(isRapidManualAdvance(1000, 1000 + RAPID_MANUAL_ADVANCE_INTERVAL_MS)).toBe(true);
    expect(isRapidManualAdvance(1000, 1001 + RAPID_MANUAL_ADVANCE_INTERVAL_MS)).toBe(false);
    expect(isRapidManualAdvance(1000, 999)).toBe(false);
  });

  it('keeps authored timing in normal playback', () => {
    expect(resolveAdaptiveMotionTiming(520, 80, 'normal')).toEqual({
      duration: 520,
      delay: 80,
    });
    expect(resolveAdaptiveMotionEasing('linear', 'normal')).toBe('linear');
    expect(resolveAdaptiveExitFadeDuration(180, 'normal')).toBe(180);
    expect(resolveAdaptiveLayoutSettleDuration(420, 'normal')).toBe(420);
  });

  it('expires a queued lock input instead of replaying a stale click much later', () => {
    expect(isQueuedManualAdvanceFresh(null, 1000)).toBe(false);
    expect(isQueuedManualAdvanceFresh(1000, 1000 + QUEUED_MANUAL_ADVANCE_MAX_AGE_MS)).toBe(true);
    expect(isQueuedManualAdvanceFresh(1000, 1001 + QUEUED_MANUAL_ADVANCE_MAX_AGE_MS)).toBe(false);
    expect(isQueuedManualAdvanceFresh(1000, 999)).toBe(false);
  });

  it('removes delay and caps interrupted motion without turning it into a cut', () => {
    expect(resolveAdaptiveMotionTiming(520, 80, 'catch-up')).toEqual({
      duration: CATCH_UP_MOTION_DURATION_MS,
      delay: 0,
    });
    expect(resolveAdaptiveMotionTiming(90, 40, 'catch-up')).toEqual({
      duration: 90,
      delay: 0,
    });
    expect(resolveAdaptiveMotionEasing('linear', 'catch-up')).toBe(CATCH_UP_MOTION_EASING);
    expect(resolveAdaptiveExitFadeDuration(180, 'catch-up')).toBe(CATCH_UP_EXIT_FADE_DURATION_MS);
    expect(resolveAdaptiveLayoutSettleDuration(420, 'catch-up')).toBe(CATCH_UP_LAYOUT_SETTLE_MS);
  });
});
