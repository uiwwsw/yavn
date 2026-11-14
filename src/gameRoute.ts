/**
 * A game has one address for its content and two for its readers.
 *
 * /game-list/<id>/ serves the Korean interface and /en/game-list/<id>/ the English one, but
 * they are the same work: the same YAML, the same autosave, the same endings already found.
 * Everything that keys off the address therefore goes through here, so an English reader
 * never ends up with a second, empty save file for a game they are halfway through.
 *
 * The story itself is not translated by either address. The interface language is chrome.
 */
const GAME_ROUTE_PATTERN = /^(?:\/en)?\/game-list\/([^/]+)\/?$/;

export type GameRoute = {
  id: string;
  /** The interface language the address asks for, not the language the story is written in. */
  uiLanguage: 'ko' | 'en';
};

export function parseGameRoute(pathname: string): GameRoute | undefined {
  const match = pathname.match(GAME_ROUTE_PATTERN);
  if (!match) {
    return undefined;
  }
  return { id: decodeURIComponent(match[1]), uiLanguage: pathname.startsWith('/en/') ? 'en' : 'ko' };
}

/** Where the engine fetches a game from: one address per game, whatever the reader sees. */
export function gameContentPath(id: string): string {
  return `/game-list/${encodeURIComponent(id)}/`;
}

/** Where a reader is sent: the same game, in the interface language they are already using. */
export function gameReaderPath(contentPath: string, language: 'ko' | 'en'): string {
  return language === 'en' ? `/en${contentPath}` : contentPath;
}
