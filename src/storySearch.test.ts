import { describe, expect, it } from 'vitest';
import { matchesStorySearch } from './storySearch';

describe('story discovery search', () => {
  const fields = ['명탐정 탐정', 'detective', '한국어 Korean', 'v10.8'];
  it('finds words across title, genre and language in any order', () => {
    expect(matchesStorySearch(fields, '한국어 탐정')).toBe(true);
    expect(matchesStorySearch(fields, 'DETECTIVE   탐정')).toBe(true);
    expect(matchesStorySearch(fields, '탐정 English')).toBe(false);
  });
  it('handles full-width input, decomposed Korean and empty queries', () => {
    expect(matchesStorySearch(fields, 'ＫＯＲＥＡＮ　ｖ１０')).toBe(true);
    expect(matchesStorySearch(fields, '탐정'.normalize('NFD'))).toBe(true);
    expect(matchesStorySearch(fields, '  ')).toBe(true);
    expect(matchesStorySearch([], '탐정')).toBe(false);
  });
});
