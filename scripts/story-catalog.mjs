/**
 * Which entries of the game manifest are stories we publish.
 *
 * Exclude the retired rendering fixture from older manifests.
 */
const FIXTURE_IDS = new Set(['live2dtest']);

export function isStory(game) {
  return Boolean(game?.id) && !FIXTURE_IDS.has(game.id);
}

export function selectStories(games = []) {
  return games.filter((game) => isStory(game) && game.path && game.name);
}
