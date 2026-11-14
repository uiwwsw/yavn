/**
 * Which entries of the game manifest are stories we publish.
 *
 * live2dtest exists so a rendering change can be checked against the official Live2D sample;
 * it is a fixture, not a work. The 404 page, the sitemap and the per-game SEO head all have
 * to agree about that, so the rule lives here instead of being spelled out three times.
 */
const FIXTURE_IDS = new Set(['live2dtest']);

export function isStory(game) {
  return Boolean(game?.id) && !FIXTURE_IDS.has(game.id);
}

export function selectStories(games = []) {
  return games.filter((game) => isStory(game) && game.path && game.name);
}
