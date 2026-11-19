import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const config = JSON.parse(readFileSync(new URL('../vercel.json', import.meta.url), 'utf8'));
const manifest = JSON.parse(readFileSync(new URL('../public/game-list/index.json', import.meta.url), 'utf8'));
const origin = 'https://yavn.movvcorp.duckdns.org';

// Use the raw regular-expression catch-all supported by Vercel rewrites. A :path*
// parameter excludes a final slash when Vercel compiles it in strict mode, so the
// library could load while every published game's canonical URL returned 404.
const catchAll = config.rewrites.find(rule => rule.source === '/(.*)');
const paths = [
  '/', '/en/', '/create/', '/en/create/',
  '/assets/index-example.js', '/game-list/index.json', '/version.json', '/sw.js',
  ...manifest.games.flatMap(game => [
    game.path, game.path.replace(/\/$/, ''), `/en${game.path}`,
    `${game.path}config.yaml`, `${game.path}0.yaml`,
  ]),
];

describe('Vercel external proxy', () => {
  it.each(paths)('preserves the entire requested path: %s', pathname => {
    expect(catchAll, 'The proxy must capture slashes as well as path segments').toBeDefined();
    const match = new RegExp(`^${catchAll.source}$`);
    expect(match.test(pathname)).toBe(true);
    expect(pathname.replace(match, catchAll.destination)).toBe(`${origin}${pathname}`);
  });

  it('keeps slash normalization at the origin to avoid redirect loops', () => {
    expect(config.trailingSlash).toBeUndefined();
    expect(config.redirects ?? []).toEqual([]);
  });
});
