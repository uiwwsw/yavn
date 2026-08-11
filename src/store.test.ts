import { beforeEach, describe, expect, it } from 'vitest';
import { useVNStore } from './store';
import type { CharacterSlot } from './types';

const imageCharacter = (id: string): CharacterSlot => ({
  id,
  kind: 'image',
  source: `/characters/${id}.webp`,
  framing: { name: 'full', scale: 1, x: 0, y: 0 },
  calibration: { scale: 1, x: 0, y: 0 },
});

describe('character slots', () => {
  beforeEach(() => {
    useVNStore.getState().resetPresentation();
  });

  it('moves a character instead of leaving the same id in two positions', () => {
    const ran = imageCharacter('란');
    const conan = imageCharacter('코난');
    const store = useVNStore.getState();

    store.setCharacter('center', ran);
    store.setCharacter('right', conan);
    store.setCharacter('left', ran);
    store.setCharacter('center', conan);

    expect(useVNStore.getState().characters).toEqual({
      left: ran,
      center: conan,
    });
  });

  it('keeps different characters in their authored slots', () => {
    const ran = imageCharacter('란');
    const conan = imageCharacter('코난');
    const store = useVNStore.getState();

    store.setCharacter('left', ran);
    store.setCharacter('right', conan);

    expect(useVNStore.getState().characters).toEqual({
      left: ran,
      right: conan,
    });
  });
});
