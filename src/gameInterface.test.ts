import { describe, expect, it } from 'vitest';
import { resolveTabDestination } from './gameInterface';

describe('game menu keyboard navigation', () => {
  it('wraps both horizontal and vertical menu navigation', () => {
    expect(resolveTabDestination('ArrowRight', 2, 3)).toBe(0);
    expect(resolveTabDestination('ArrowDown', 2, 3)).toBe(0);
    expect(resolveTabDestination('ArrowLeft', 0, 3)).toBe(2);
    expect(resolveTabDestination('ArrowUp', 0, 3)).toBe(2);
  });
  it('supports Home and End without stealing other keys', () => {
    expect(resolveTabDestination('Home', 1, 3)).toBe(0);
    expect(resolveTabDestination('End', 1, 3)).toBe(2);
    expect(resolveTabDestination('Tab', 1, 3)).toBeUndefined();
    expect(resolveTabDestination('Escape', 1, 3)).toBeUndefined();
  });
  it('handles an empty or single-tab menu', () => {
    expect(resolveTabDestination('ArrowRight', 0, 0)).toBeUndefined();
    expect(resolveTabDestination('ArrowLeft', 0, 1)).toBe(0);
  });
});
