export function pickRandomCarouselIndex(itemCount: number, randomValue: number = Math.random()): number {
  if (!Number.isFinite(itemCount) || itemCount <= 0) {
    return -1;
  }

  const normalizedValue = Number.isFinite(randomValue)
    ? Math.min(Math.max(randomValue, 0), 0.999999999)
    : 0;
  return Math.floor(normalizedValue * Math.floor(itemCount));
}

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
