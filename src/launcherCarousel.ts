export function wrapCarouselIndex(index: number, itemCount: number): number {
  if (!Number.isFinite(itemCount) || itemCount <= 0) {
    return -1;
  }

  const normalizedCount = Math.floor(itemCount);
  return ((Math.trunc(index) % normalizedCount) + normalizedCount) % normalizedCount;
}

export function buildLauncherDemoHash(gameId: string): string {
  return `#demo=${encodeURIComponent(gameId)}`;
}

export function parseLauncherDemoHash(hash: string): string | null {
  const normalizedHash = hash.startsWith('#') ? hash.slice(1) : hash;
  const params = new URLSearchParams(normalizedHash);
  const gameId = params.get('demo')?.trim();
  return gameId || null;
}

export function resolveInitialCarouselGameId(
  gameIds: string[],
  currentGameId: string | null,
  hash: string,
): string | null {
  if (currentGameId && gameIds.includes(currentGameId)) {
    return currentGameId;
  }

  const hashGameId = parseLauncherDemoHash(hash);
  if (hashGameId && gameIds.includes(hashGameId)) {
    return hashGameId;
  }

  return gameIds[0] ?? null;
}
