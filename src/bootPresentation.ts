import { parseGameRoute } from './gameRoute';

export type BootMode = 'launcher' | 'gameList' | 'uploaded';

export type InitialBootPresentation = {
  bootMode: Exclude<BootMode, 'uploaded'>;
  gameBootPending: boolean;
};

export function parseGameIdFromPath(pathValue: string): string | undefined {
  return parseGameRoute(pathValue)?.id;
}

export function resolveInitialBootPresentation(pathValue: string): InitialBootPresentation {
  const opensGameDirectly = Boolean(parseGameIdFromPath(pathValue));
  return {
    bootMode: opensGameDirectly ? 'gameList' : 'launcher',
    gameBootPending: opensGameDirectly,
  };
}

export function shouldShowGameRouteBoot(gameBootPending: boolean, hasGame: boolean): boolean {
  return gameBootPending && !hasGame;
}
