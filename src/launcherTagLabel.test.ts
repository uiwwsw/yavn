import { describe, expect, it } from 'vitest';
import { launcherTagLabel } from './App';

describe('launcher tag labels', () => {
  it('uses the game label on Korean screens and readable words elsewhere', () => {
    const labels = { 'political-thriller': '정치 스릴러' };
    expect(launcherTagLabel('political-thriller', labels, 'ko')).toBe('정치 스릴러');
    expect(launcherTagLabel('political-thriller', labels, 'en')).toBe('Political thriller');
    expect(launcherTagLabel('short-story', undefined, 'ko')).toBe('Short story');
    expect(launcherTagLabel('역사극', undefined, 'ko')).toBe('역사극');
  });
});
