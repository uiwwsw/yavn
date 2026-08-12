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

export type CharacterStagePlacement = {
  anchorX: string;
  offsetX: '0%' | '-50%' | '-100%';
};

const POSITION_ORDER: readonly Position[] = ['left', 'center', 'right'];

function formatLayoutNumber(value: number): string {
  return Number(value.toFixed(2)).toString();
}

function resolveEnsembleGap(mode: 'duo' | 'trio', spacing: number): string {
  const safeSpacing = Math.max(0.75, Math.min(1.25, spacing));
  const fluidCqw = 25 * safeSpacing;
  const maximumPx = 320 * safeSpacing;
  return `min(${formatLayoutNumber(fluidCqw)}cqw, ${formatLayoutNumber(maximumPx)}px)`;
}

/**
 * Keeps desktop ensembles visually grouped instead of assigning the whole viewport in thirds.
 * `spacing` lets unusually narrow or wide transparent assets tune their maximum breathing room.
 */
export function resolveCharacterStagePlacement(
  position: Position,
  layout: CharacterStageLayout,
  spacing = 1,
): CharacterStagePlacement {
  const isSolo = Object.keys(layout.characterIdByPosition).length === 1;
  if (isSolo) {
    return { anchorX: '50cqw', offsetX: '-50%' };
  }

  const duoSide = layout.mode === 'duo' ? layout.duoSideByPosition[position] : undefined;
  const ensembleSide = duoSide ?? (layout.mode === 'trio' && position !== 'center' ? position : undefined);

  if (ensembleSide) {
    const gap = resolveEnsembleGap(layout.mode === 'duo' ? 'duo' : 'trio', spacing);
    return ensembleSide === 'left'
      ? {
          anchorX: `calc(50cqw - ${gap})`,
          offsetX: '-50%',
        }
      : {
          anchorX: `calc(50cqw + ${gap})`,
          offsetX: '-50%',
        };
  }

  if (position === 'left') {
    return { anchorX: '25cqw', offsetX: '-50%' };
  }
  if (position === 'right') {
    return { anchorX: '75cqw', offsetX: '-50%' };
  }
  return { anchorX: '50cqw', offsetX: '-50%' };
}

export function resolveMobileCharacterStageAnchor(
  position: Position,
  layout: CharacterStageLayout,
): string {
  if (Object.keys(layout.characterIdByPosition).length === 1) {
    return '50cqw';
  }
  if (layout.mode === 'duo') {
    const side = layout.duoSideByPosition[position];
    if (side === 'left') return '25cqw';
    if (side === 'right') return '75cqw';
  }
  if (layout.mode === 'trio') {
    if (position === 'left') return '25cqw';
    if (position === 'right') return '75cqw';
  }
  if (position === 'left') return '25cqw';
  if (position === 'right') return '75cqw';
  return '50cqw';
}

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
      scaleMultiplier: 1,
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
  _previousLayout?: CharacterStageLayout,
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

  return {
    mode: 'default',
    duoSideByPosition: {},
    characterIdByPosition: Object.fromEntries(
      orderedCharacters.map((character) => [character.position, character.id]),
    ),
  };
}
