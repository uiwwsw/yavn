export type PlaybackMotionTempo = 'normal' | 'catch-up';

export const RAPID_MANUAL_ADVANCE_INTERVAL_MS = 620;
export const CATCH_UP_TEMPO_RELEASE_MS = 700;
export const QUEUED_MANUAL_ADVANCE_MAX_AGE_MS = 1600;
export const CATCH_UP_MOTION_DURATION_MS = 140;
export const CATCH_UP_EXIT_FADE_DURATION_MS = 90;
export const CATCH_UP_LAYOUT_SETTLE_MS = 190;
export const CATCH_UP_MOTION_EASING = 'cubic-bezier(0.16, 1, 0.3, 1)';

export type AdaptiveMotionTiming = {
  duration: number;
  delay: number;
};

export function isRapidManualAdvance(
  previousAdvanceAt: number | undefined,
  currentAdvanceAt: number,
): boolean {
  if (
    previousAdvanceAt === undefined
    || !Number.isFinite(previousAdvanceAt)
    || !Number.isFinite(currentAdvanceAt)
  ) {
    return false;
  }
  const interval = currentAdvanceAt - previousAdvanceAt;
  return interval >= 0 && interval <= RAPID_MANUAL_ADVANCE_INTERVAL_MS;
}

export function isQueuedManualAdvanceFresh(
  queuedAt: number | null,
  currentAt: number,
): boolean {
  if (queuedAt === null || !Number.isFinite(queuedAt) || !Number.isFinite(currentAt)) {
    return false;
  }
  const age = currentAt - queuedAt;
  return age >= 0 && age <= QUEUED_MANUAL_ADVANCE_MAX_AGE_MS;
}

export function resolveAdaptiveMotionTiming(
  duration: number,
  delay: number,
  tempo: PlaybackMotionTempo,
): AdaptiveMotionTiming {
  const normalizedDuration = Math.max(0, Math.floor(duration));
  const normalizedDelay = Math.max(0, Math.floor(delay));
  if (tempo === 'normal') {
    return { duration: normalizedDuration, delay: normalizedDelay };
  }
  return {
    duration: Math.min(normalizedDuration, CATCH_UP_MOTION_DURATION_MS),
    delay: 0,
  };
}

export function resolveAdaptiveMotionEasing(
  easing: string,
  tempo: PlaybackMotionTempo,
): string {
  return tempo === 'catch-up' ? CATCH_UP_MOTION_EASING : easing;
}

export function resolveAdaptiveExitFadeDuration(
  duration: number,
  tempo: PlaybackMotionTempo,
): number {
  const normalizedDuration = Math.max(0, Math.floor(duration));
  return tempo === 'catch-up'
    ? Math.min(normalizedDuration, CATCH_UP_EXIT_FADE_DURATION_MS)
    : normalizedDuration;
}

export function resolveAdaptiveLayoutSettleDuration(
  duration: number,
  tempo: PlaybackMotionTempo,
): number {
  const normalizedDuration = Math.max(0, Math.floor(duration));
  return tempo === 'catch-up'
    ? Math.min(normalizedDuration, CATCH_UP_LAYOUT_SETTLE_MS)
    : normalizedDuration;
}
