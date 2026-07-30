import type { Position } from './types';

export type CharacterStageLayout = {
  mode: 'default' | 'duo';
  duoSideByPosition: Partial<Record<Position, 'left' | 'right'>>;
};

const POSITION_ORDER: readonly Position[] = ['left', 'center', 'right'];

export function buildImageCharacterRenderKey(position: Position, characterId: string): string {
  return `${position}-${characterId}`;
}

export function resolveCharacterStageLayout(visiblePositions: readonly Position[]): CharacterStageLayout {
  const visibleSet = new Set(visiblePositions);
  const orderedPositions = POSITION_ORDER.filter((position) => visibleSet.has(position));

  if (orderedPositions.length !== 2) {
    return {
      mode: 'default',
      duoSideByPosition: {},
    };
  }

  return {
    mode: 'duo',
    duoSideByPosition: {
      [orderedPositions[0]]: 'left',
      [orderedPositions[1]]: 'right',
    },
  };
}
