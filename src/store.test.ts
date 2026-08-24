import { beforeEach, describe, expect, it } from 'vitest';
import { useVNStore } from './store';
import type { CharacterSlot, StageCameraState } from './types';

const imageCharacter = (id: string): CharacterSlot => ({
  id,
  kind: 'image',
  source: `/characters/${id}.webp`,
  placement: 'stage-bottom',
  framing: { name: 'full', scale: 1, x: 0, y: 0 },
  calibration: { scale: 1, x: 0, y: 0, spacing: 1 },
  enterEffect: 'fadeIn',
  enterLayout: 'push',
  enterDuration: 240,
  enterEasing: 'ease-out',
  enterDelay: 0,
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

  it('does not replace an unchanged character slot and restart its presentation', () => {
    const ran = imageCharacter('란');
    const store = useVNStore.getState();

    store.setCharacter('center', ran);
    const firstCharacters = useVNStore.getState().characters;
    store.setCharacter('center', imageCharacter('란'));

    expect(useVNStore.getState().characters).toBe(firstCharacters);
  });

  it('updates a staged character when only its asset placement changes', () => {
    const conan = imageCharacter('코난');
    const store = useVNStore.getState();

    store.setCharacter('center', conan);
    const firstCharacters = useVNStore.getState().characters;
    store.setCharacter('center', { ...conan, placement: 'prompt-top' });

    expect(useVNStore.getState().characters).not.toBe(firstCharacters);
    expect(useVNStore.getState().characters.center?.placement).toBe('prompt-top');
  });

  it('updates a staged character when only its next entrance transition changes', () => {
    const conan = imageCharacter('코난');
    const store = useVNStore.getState();

    store.setCharacter('center', conan);
    const firstCharacters = useVNStore.getState().characters;
    store.setCharacter('center', {
      ...conan,
      enterEffect: 'slideLeft',
      enterLayout: 'cut',
      enterDuration: 420,
    });

    expect(useVNStore.getState().characters).not.toBe(firstCharacters);
    expect(useVNStore.getState().characters.center).toMatchObject({
      enterEffect: 'slideLeft',
      enterLayout: 'cut',
      enterDuration: 420,
    });
  });

  it('keeps repeated cast membership, speaker focus, and camera directives referentially stable', () => {
    const store = useVNStore.getState();
    const mediumCamera: StageCameraState = {
      shot: 'medium',
      target: 'group',
      transition: 'push',
      duration: 520,
    };

    store.setVisibleCharacters(['덕만', '진평왕']);
    store.promoteSpeaker('덕만');
    store.setCamera(mediumCamera);
    const firstState = useVNStore.getState();

    firstState.setVisibleCharacters(['덕만', '진평왕', '덕만']);
    firstState.promoteSpeaker('덕만');
    firstState.setCamera({ ...mediumCamera });

    const repeatedState = useVNStore.getState();
    expect(repeatedState.visibleCharacterIds).toBe(firstState.visibleCharacterIds);
    expect(repeatedState.speakerOrder).toBe(firstState.speakerOrder);
    expect(repeatedState.camera).toBe(firstState.camera);
  });
});
