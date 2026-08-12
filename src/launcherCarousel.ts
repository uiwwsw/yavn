export function wrapCarouselIndex(index: number, itemCount: number): number {
  if (!Number.isFinite(itemCount) || itemCount <= 0) {
    return -1;
  }

  const normalizedCount = Math.floor(itemCount);
  return ((Math.trunc(index) % normalizedCount) + normalizedCount) % normalizedCount;
}

export function buildLauncherDemoSharePath(
  pathname: string,
  search: string,
  gameId: string,
): string {
  const params = new URLSearchParams(search.startsWith('?') ? search.slice(1) : search);
  params.set('demo', gameId);
  const query = params.toString();
  return `${pathname}${query ? `?${query}` : ''}`;
}

export function clearLauncherDemoSharePath(pathname: string, search: string): string {
  const params = new URLSearchParams(search.startsWith('?') ? search.slice(1) : search);
  params.delete('demo');
  const query = params.toString();
  return `${pathname}${query ? `?${query}` : ''}`;
}

export function parseLauncherDemoQuery(search: string): string | null {
  const normalizedSearch = search.startsWith('?') ? search.slice(1) : search;
  const gameId = new URLSearchParams(normalizedSearch).get('demo')?.trim();
  return gameId || null;
}

/** @deprecated Kept only so previously shared #demo links can be migrated. */
export function parseLauncherDemoHash(hash: string): string | null {
  const normalizedHash = hash.startsWith('#') ? hash.slice(1) : hash;
  const params = new URLSearchParams(normalizedHash);
  const gameId = params.get('demo')?.trim();
  return gameId || null;
}

export function normalizeLauncherDemoLocationPath(
  pathname: string,
  search: string,
  hash: string,
  gameIds: string[],
): string | null {
  const searchParams = new URLSearchParams(search.startsWith('?') ? search.slice(1) : search);
  const hashParams = new URLSearchParams(hash.startsWith('#') ? hash.slice(1) : hash);
  const hasQuerySelection = searchParams.has('demo');
  const hasLegacyHashSelection = hashParams.has('demo');
  const queryGameId = parseLauncherDemoQuery(search);
  const legacyHashGameId = parseLauncherDemoHash(hash);
  const validQueryGameId = queryGameId && gameIds.includes(queryGameId) ? queryGameId : null;
  const validLegacyHashGameId = legacyHashGameId && gameIds.includes(legacyHashGameId)
    ? legacyHashGameId
    : null;

  if (hasQuerySelection && !validQueryGameId) {
    searchParams.delete('demo');
  }

  if (hasLegacyHashSelection && !validQueryGameId && validLegacyHashGameId) {
    searchParams.set('demo', validLegacyHashGameId);
  }

  const shouldReplace =
    (hasQuerySelection && !validQueryGameId) ||
    hasLegacyHashSelection;
  if (!shouldReplace) {
    return null;
  }

  const query = searchParams.toString();
  const preservedHash = hasLegacyHashSelection ? '' : hash;
  return `${pathname}${query ? `?${query}` : ''}${preservedHash}`;
}

export function resolveInitialCarouselGameId(
  gameIds: string[],
  currentGameId: string | null,
  search: string,
  hash: string,
  storedGameId: string | null = null,
): string | null {
  if (currentGameId && gameIds.includes(currentGameId)) {
    return currentGameId;
  }

  const requestedGameId = parseLauncherDemoQuery(search) ?? parseLauncherDemoHash(hash);
  if (requestedGameId && gameIds.includes(requestedGameId)) {
    return requestedGameId;
  }

  if (storedGameId && gameIds.includes(storedGameId)) {
    return storedGameId;
  }

  return gameIds[0] ?? null;
}
