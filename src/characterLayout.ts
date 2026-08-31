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
  depthClass: 'is-neutral' | 'is-camera-focus' | 'is-camera-listener';
};

export type CharacterStagePlacement = {
  anchorX: string;
  offsetX: '0%' | '-50%' | '-100%';
};

export type CharacterStageRenderPlacement = CharacterStagePlacement & {
  mobileAnchorX: string;
  duoSide?: 'left' | 'right';
  facingScale: 1 | -1;
};

const POSITION_ORDER: readonly Position[] = ['left', 'center', 'right'];

function formatLayoutNumber(value: number): string {
  return Number(value.toFixed(2)).toString();
}

function resolveEnsembleGap(mode: 'duo' | 'trio', spacing: number): string {
  const safeSpacing = Math.max(0.75, Math.min(1.25, spacing));
  const fluidCqw = 25 * safeSpacing;
  const maximumPx = 260 * safeSpacing;
  return `min(${formatLayoutNumber(fluidCqw)}cqw, ${formatLayoutNumber(maximumPx)}px)`;
}

function negateStageDistance(distance: string): string {
  return `calc(0px - ${distance})`;
}

export function resolveCharacterStageSpacing(spacings: readonly number[]): number {
  if (spacings.length <= 1) return 1;
  const safeSpacings = spacings.map((spacing) => Math.max(0.75, Math.min(1.25, spacing)));
  return safeSpacings.reduce((total, spacing) => total + spacing, 0) / safeSpacings.length;
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

/**
 * Moves a directed camera target to the stage centre before the camera scale is
 * applied. Returning a translation instead of changing transform-origin keeps
 * same-scale target changes animatable and prevents an actor from snapping
 * between the left and right sides of a close shot.
 */
export function resolveCharacterCameraPanX(
  position: Position,
  layout: CharacterStageLayout,
  spacing = 1,
): string {
  if (Object.keys(layout.characterIdByPosition).length <= 1) {
    return '0cqw';
  }

  const duoSide = layout.mode === 'duo' ? layout.duoSideByPosition[position] : undefined;
  const ensembleSide = duoSide ?? (layout.mode === 'trio' && position !== 'center' ? position : undefined);
  if (ensembleSide) {
    const gap = resolveEnsembleGap(layout.mode === 'duo' ? 'duo' : 'trio', spacing);
    return ensembleSide === 'left' ? gap : negateStageDistance(gap);
  }

  if (position === 'left') return '25cqw';
  if (position === 'right') return '-25cqw';
  return '0cqw';
}

export function resolveMobileCharacterCameraPanX(
  position: Position,
  layout: CharacterStageLayout,
): string {
  const anchor = resolveMobileCharacterStageAnchor(position, layout);
  if (anchor === '25cqw') return '25cqw';
  if (anchor === '75cqw') return '-25cqw';
  return '0cqw';
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

export function resolveCharacterFocusPresentation(
  isFocused: boolean,
  hasFocusedCharacter: boolean,
): CharacterFocusPresentation {
  if (!hasFocusedCharacter) {
    return { depthClass: 'is-neutral' };
  }

  if (isFocused) {
    return { depthClass: 'is-camera-focus' };
  }

  return { depthClass: 'is-camera-listener' };
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

export function resolveCharacterStageRenderPlacement(
  position: Position,
  layout: CharacterStageLayout,
  spacing: number,
  nativeFacing: CharacterFacing | undefined,
): CharacterStageRenderPlacement {
  const duoSide = layout.duoSideByPosition[position];
  const characterCount = Object.keys(layout.characterIdByPosition).length;
  return {
    ...resolveCharacterStagePlacement(position, layout, spacing),
    mobileAnchorX: resolveMobileCharacterStageAnchor(position, layout),
    duoSide,
    facingScale: resolveCharacterFacingScale(
      nativeFacing,
      characterCount === 1 ? 'center' : position,
      duoSide,
    ),
  };
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
