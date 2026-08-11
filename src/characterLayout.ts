import type { CharacterFacing, Position } from './types';

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

export function resolveDialogueVisibleCharacterIds(
  stagedCharacterIds: readonly string[],
  speakerId: string | undefined,
  explicitCompanionIds: readonly string[] | undefined,
): string[] {
  const requestedIds = explicitCompanionIds === undefined
    ? stagedCharacterIds
    : [speakerId, ...explicitCompanionIds];

  return Array.from(
    new Set(
      requestedIds.filter((id): id is string => typeof id === 'string' && id.trim().length > 0),
    ),
  );
}

export function buildImageCharacterRenderKey(position: Position, characterId: string): string {
  return `${position}-${characterId}`;
}

export function resolveCharacterFacingScale(
  nativeFacing: CharacterFacing | undefined,
  position: Position,
  duoSide?: 'left' | 'right',
): 1 | -1 {
  if (!nativeFacing || nativeFacing === 'front') {
    return 1;
  }

  const stageSide = duoSide ?? (position === 'center' ? undefined : position);
  if (!stageSide) {
    return 1;
  }
  const desiredFacing = stageSide === 'left' ? 'right' : 'left';
  return nativeFacing === desiredFacing ? 1 : -1;
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
