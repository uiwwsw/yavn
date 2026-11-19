import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const config = JSON.parse(readFileSync(new URL('../vercel.json', import.meta.url), 'utf8'));
const manifest = JSON.parse(readFileSync(new URL('../public/game-list/index.json', import.meta.url), 'utf8'));

// Exercise both published URL forms against the configured named-capture routes.
// The explicit final-slash cases guard the game-wide 404 regression.
function rewrite(pathname) {
  for (const rule of config.rewrites) {
    const pattern = rule.source.replace(/:([A-Za-z]\w*)\(([^)]+)\)/g, '(?<$1>$2)');
    const match = new RegExp(`^${pattern}$`).exec(pathname);
    if (match) return rule.destination.replace(/:([A-Za-z]\w*)/g, (_, key) => match.groups?.[key] ?? '');
  }
  return undefined;
}

describe('Vercel production hosting', () => {
  it('builds the current checkout and publishes its output directly', () => {
    expect(config).toMatchObject({ framework: 'vite',
      installCommand: 'corepack pnpm install --frozen-lockfile',
      buildCommand: 'corepack pnpm run build', outputDirectory: 'dist' });
    for (const rule of config.rewrites) expect(rule.destination.startsWith('/')).toBe(true);
  });

  it('deploys main without accumulating automatic branch previews', () => {
    expect(config.git.deploymentEnabled).toEqual({ '**': false, '*': false, main: true });
  });

  it.each(manifest.games.flatMap(game => [
    [game.path, `${game.path}index.html`],
    [game.path.replace(/\/$/, ''), `${game.path}index.html`],
    [`/en${game.path}`, `/en${game.path}index.html`],
    [`/en${game.path.replace(/\/$/, '')}`, `/en${game.path}index.html`],
  ]))('serves the generated game page for %s', (pathname, destination) => {
    expect(rewrite(pathname)).toBe(destination);
  });

  it.each(['/en/', '/create/', '/en/create/'])('serves the generated guide or library: %s', pathname => {
    expect(rewrite(pathname)).toBe(`${pathname}index.html`);
  });

  it.each([
    '/', '/assets/index-example.js', '/game-list/index.json', '/version.json', '/sw.js',
    '/manifest.webmanifest',
    ...manifest.games.flatMap(game => [
      `${game.path}config.yaml`, `${game.path}0.yaml`, `${game.path}offline.json`,
      `${game.path}assets/bg/cafe.svg`,
    ]),
  ])('leaves static resources and the home page to the output filesystem: %s', pathname => {
    expect(rewrite(pathname)).toBeUndefined();
  });

  it.each([
    ['deokman', '/game-list/muwon/'], ['deokman-v8-preview', '/game-list/muwon/'],
    ['english-deokman', '/game-list/muwon/'], ['erase-first', '/game-list/erase/'],
    ['conan', '/'], ['conan-demo', '/'], ['conan-midnight-alibi', '/'], ['english-conan', '/'],
  ])('preserves retired game links: %s', (id, destination) => {
    for (const suffix of ['', '/', '/:path*']) {
      expect(config.redirects).toContainEqual({ source: `/game-list/${id}${suffix}`, destination, permanent: true });
    }
  });

  it('keeps updates fresh and allows the existing service worker to retain its scope', () => {
    const headers = path => config.headers.find(rule => rule.source === path)?.headers;
    expect(headers('/version.json')).toContainEqual({ key: 'Cache-Control', value: 'no-cache, no-store, must-revalidate' });
    for (const path of ['/game-list/index.json', '/game-list/:gameId/offline.json', '/sw.js']) {
      expect(headers(path)).toContainEqual({ key: 'Cache-Control', value: 'no-cache' });
    }
    expect(headers('/sw.js')).toContainEqual({ key: 'Service-Worker-Allowed', value: '/' });
    expect(headers('/(.*)')).toContainEqual({ key: 'X-Content-Type-Options', value: 'nosniff' });
  });
});
