import { describe, expect, it } from 'vitest';
import { isStory, selectStories } from './story-catalog.mjs';

describe('what counts as a story', () => {
  it('keeps the works and leaves out the rendering fixture', () => {
    expect(isStory({ id: '360' })).toBe(true);
    expect(isStory({ id: 'live2dtest' })).toBe(false);
    expect(isStory({})).toBe(false);
  });

  it('wants an address and a name before it will list anything', () => {
    expect(selectStories([{ id: '360', path: '/game-list/360/', name: '360' }, { id: '360' }])).toHaveLength(1);
  });
});
