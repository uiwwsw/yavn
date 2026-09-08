import { describe, expect, it } from 'vitest';
import { normalizeCharacterEnter } from './characterEntrance';

describe('character entrance presentation', () => {
  it('uses a restrained fade with coordinated placement by default', () => {
    expect(normalizeCharacterEnter(undefined)).toEqual({
      enterEffect: 'fadeIn',
      enterLayout: 'push',
      enterDuration: 360,
      enterEasing: 'cubic-bezier(0.22, 0.61, 0.36, 1)',
      enterDelay: 0,
    });
  });

  it('makes the none shorthand an immediate cut', () => {
    expect(normalizeCharacterEnter('none')).toEqual({
      enterEffect: 'none',
      enterLayout: 'cut',
      enterDuration: 0,
      enterEasing: 'cubic-bezier(0.22, 0.61, 0.36, 1)',
      enterDelay: 0,
    });
  });

  it('preserves an authored effect, layout, timing, and easing', () => {
    expect(normalizeCharacterEnter({
      effect: 'slideLeft',
      layout: 'push',
      duration: 520,
      easing: ' cubic-bezier(0.2, 0.72, 0.24, 1) ',
      delay: 80,
    })).toEqual({
      enterEffect: 'slideLeft',
      enterLayout: 'push',
      enterDuration: 520,
      enterEasing: 'cubic-bezier(0.2, 0.72, 0.24, 1)',
      enterDelay: 80,
    });
  });
});
