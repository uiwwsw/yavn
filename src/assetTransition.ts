import type { StickerSlot } from './types';

export const BACKGROUND_CROSSFADE_DURATION_MS = 360;

export type BackgroundTransitionState = {
  current?: string;
  previous?: string;
  revision: number;
};

export const EMPTY_BACKGROUND_TRANSITION: BackgroundTransitionState = {
  current: undefined,
  previous: undefined,
  revision: 0,
};

/**
 * Promotes an already decoded background while retaining the last painted
 * frame underneath it. Repeating the same source is deliberately inert so a
 * restored cursor or repeated `bg` action cannot restart the transition.
 */
export function commitPreparedBackground(
  state: BackgroundTransitionState,
  source: string,
): BackgroundTransitionState {
  if (state.current === source) {
    return state;
  }
  return {
    current: source,
    previous: state.current,
    revision: state.revision + 1,
  };
}

export function finishBackgroundTransition(
  state: BackgroundTransitionState,
  source: string,
): BackgroundTransitionState {
  if (state.current !== source || state.previous === undefined) {
    return state;
  }
  return {
    ...state,
    previous: undefined,
  };
}

export function collectBackgroundLayerSources(
  state: BackgroundTransitionState,
  requested?: string,
): string[] {
  return [...new Set([state.previous, state.current, requested].filter(
    (source): source is string => Boolean(source),
  ))];
}

type StickerLeavePresentation = Pick<
  StickerSlot,
  'leaveEffect' | 'leaveDuration' | 'leaveEasing' | 'leaveDelay'
>;

/** Keeps the measured sticker instance mounted while its leave class changes. */
export function beginStickerLeave(
  sticker: StickerSlot,
  leave: StickerLeavePresentation,
): StickerSlot {
  return {
    ...sticker,
    ...leave,
    leaving: true,
  };
}
