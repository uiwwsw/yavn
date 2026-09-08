export const PORTRAIT_DISSOLVE_MS = 180;
export type PortraitFrame = { source: string; ratio: number };
export type PortraitTransition = { current?: PortraitFrame; previous?: PortraitFrame };

/** Finish the current dissolve before accepting the latest prepared expression. */
export function presentPortrait(state: PortraitTransition, prepared: PortraitFrame): PortraitTransition {
  if (state.previous || state.current?.source === prepared.source) return state;
  return { current: prepared, previous: state.current };
}
export function finishPortrait(state: PortraitTransition, source: string): PortraitTransition {
  return state.current?.source === source && state.previous ? { current: state.current } : state;
}
export function portraitSources(state: PortraitTransition, requested: string): string[] {
  return [...new Set([state.previous?.source, state.current?.source, requested].filter((s): s is string => Boolean(s)))];
}
