import type { Position } from './types';

export type VisibleCharacterStageEntry = {
  id: string;
  position: Position;
};

export type CharacterStageLayout = {
  mode: 'default' | 'duo';
  duoSideByPosition: Partial<Record<Position, 'left' | 'right'>>;
  characterIdByPosition: Partial<Record<Position, string>>;
};

const POSITION_ORDER: readonly Position[] = ['left', 'center', 'right'];

export function buildImageCharacterRenderKey(position: Position, characterId: string): string {
  return `${position}-${characterId}`;
}

export function resolveCharacterStageLayout(
  visibleCharacters: readonly VisibleCharacterStageEntry[],
  previousLayout?: CharacterStageLayout,
): CharacterStageLayout {
  const visibleByPosition = new Map(
    visibleCharacters.map((character) => [character.position, character] as const),
  );
  const orderedCharacters = POSITION_ORDER.flatMap((position) => {
    const character = visibleByPosition.get(position);
    return character ? [character] : [];
  });

  if (orderedCharacters.length === 2) {
    const [leftCharacter, rightCharacter] = orderedCharacters;
    return {
      mode: 'duo',
      duoSideByPosition: {
        [leftCharacter.position]: 'left',
        [rightCharacter.position]: 'right',
      },
      characterIdByPosition: {
        [leftCharacter.position]: leftCharacter.id,
        [rightCharacter.position]: rightCharacter.id,
      },
    };
  }

  if (orderedCharacters.length === 1 && previousLayout?.mode === 'duo') {
    const [survivor] = orderedCharacters;
    const previousSide = previousLayout.duoSideByPosition[survivor.position];
    const isSameCharacter = previousLayout.characterIdByPosition[survivor.position] === survivor.id;

    if (previousSide && isSameCharacter) {
      return {
        mode: 'duo',
        duoSideByPosition: {
          [survivor.position]: previousSide,
        },
        characterIdByPosition: {
          [survivor.position]: survivor.id,
        },
      };
    }
  }

  return {
    mode: 'default',
    duoSideByPosition: {},
    characterIdByPosition: {},
  };
}
