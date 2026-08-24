import type {
  CharacterEnterEffect,
  CharacterEnterOptions,
  CharacterSlot,
} from './types';

export const DEFAULT_CHARACTER_ENTER_EFFECT: CharacterEnterEffect = 'fadeIn';
export const DEFAULT_CHARACTER_ENTER_DURATION_MS = 240;
export const DEFAULT_CHARACTER_ENTER_EASING = 'ease-out';
export const DEFAULT_CHARACTER_ENTER_DELAY_MS = 0;

export function normalizeCharacterEnter(
  enter: CharacterEnterEffect | CharacterEnterOptions | undefined,
): Pick<CharacterSlot, 'enterEffect' | 'enterLayout' | 'enterDuration' | 'enterEasing' | 'enterDelay'> {
  const options = typeof enter === 'string' ? { effect: enter } : enter;
  const effect = options?.effect ?? DEFAULT_CHARACTER_ENTER_EFFECT;
  const fallbackLayout = effect === 'none' ? 'cut' : 'push';
  const fallbackDuration = effect === 'none' ? 0 : DEFAULT_CHARACTER_ENTER_DURATION_MS;
  const duration = typeof options?.duration === 'number' && !Number.isNaN(options.duration)
    ? Math.max(0, Math.min(3000, Math.floor(options.duration)))
    : fallbackDuration;
  const delay = typeof options?.delay === 'number' && !Number.isNaN(options.delay)
    ? Math.max(0, Math.min(5000, Math.floor(options.delay)))
    : DEFAULT_CHARACTER_ENTER_DELAY_MS;
  const easing = typeof options?.easing === 'string' && options.easing.trim().length > 0
    ? options.easing.trim()
    : DEFAULT_CHARACTER_ENTER_EASING;
  return {
    enterEffect: effect,
    enterLayout: options?.layout ?? fallbackLayout,
    enterDuration: duration,
    enterEasing: easing,
    enterDelay: delay,
  };
}
