export type BootMode = 'launcher' | 'gameList' | 'uploaded';

export type InitialBootPresentation = {
  bootMode: Exclude<BootMode, 'uploaded'>;
  gameBootPending: boolean;
};

export function parseGameIdFromPath(pathValue: string): string | undefined {
  const match = pathValue.match(/^\/game-list\/([^/]+)\/?$/);
  if (!match) {
    return undefined;
  }
  return decodeURIComponent(match[1]);
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
