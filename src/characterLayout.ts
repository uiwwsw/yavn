import type { CharacterFacing, Position } from './types';

export type VisibleCharacterStageEntry = {
  id: string;
  position: Position;
};

export type CharacterStageLayout = {
  mode: 'default' | 'duo' | 'trio';
  duoSideByPosition: Partial<Record<Position, 'left' | 'right'>>;
  characterIdByPosition: Partial<Record<Position, string>>;
};

export type CharacterFocusPresentation = {
  brightness: number;
  scaleMultiplier: number;
  depthClass: 'is-neutral' | 'is-speaker' | 'is-listener';
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

export function buildImageCharacterRenderKey(characterId: string): string {
  return `character-${characterId}`;
}

export function resolveCharacterFramingScale(
  framingScale: number,
  visibleCharacterCount: number,
): number {
  const crowdFactor = visibleCharacterCount >= 3 ? 0.62 : visibleCharacterCount === 2 ? 0.82 : 1;
  return 1 + (framingScale - 1) * crowdFactor;
}

export function resolveCharacterFocusPresentation(
  visibleCharacterCount: number,
  order: number,
  isSpeaker: boolean,
  hasFocusedSpeaker: boolean,
): CharacterFocusPresentation {
  if (!hasFocusedSpeaker) {
    return { brightness: 1, scaleMultiplier: 1, depthClass: 'is-neutral' };
  }

  if (isSpeaker) {
    return {
      brightness: 1,
      scaleMultiplier: visibleCharacterCount >= 3 ? 1.035 : visibleCharacterCount === 2 ? 1.02 : 1,
      depthClass: 'is-speaker',
    };
  }

  const brightness = visibleCharacterCount >= 3
    ? (order <= 2 ? 0.76 : 0.64)
    : 0.78;
  return { brightness, scaleMultiplier: 1, depthClass: 'is-listener' };
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

  if (orderedCharacters.length >= 3) {
    return {
      mode: 'trio',
      duoSideByPosition: {},
      characterIdByPosition: Object.fromEntries(
        orderedCharacters.map((character) => [character.position, character.id]),
      ),
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
