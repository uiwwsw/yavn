import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { inflateSync } from 'node:zlib';
import { afterEach, describe, expect, it } from 'vitest';
import {
  buildServiceWorkerConfig,
  collectOfflinePacks,
  collectPrecache,
  encodePng,
  rasterizeIcon,
  renderServiceWorker,
  renderWebManifest,
  resolveCacheVersion,
  yavnPwa,
} from './pwa.mjs';
import { renderGameSeoHtml } from './generate-game-seo-pages.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const identity = { build: '0.2.0', commit: 'abc1234', builtAt: '2026-11-13T00:00:00.000Z' };
const temporaryDirectories = [];

afterEach(async () => {
  await Promise.all(temporaryDirectories.splice(0).map((directory) => rm(directory, { recursive: true, force: true })));
});

async function fixturePublicDir() {
  const publicDir = await mkdtemp(path.join(os.tmpdir(), 'yavn-pwa-'));
  temporaryDirectories.push(publicDir);
  const write = async (relative, content) => {
    const target = path.join(publicDir, relative);
    await mkdir(path.dirname(target), { recursive: true });
    await writeFile(target, content);
  };
  await write('game-list/index.json', JSON.stringify({ games: [{ id: 'small', version: '1.2.0' }, { id: 'live2dtest', version: '1.0.0' }] }));
  await write('game-list/small/config.yaml', 'title: small\n');
  await write('game-list/small/0.yaml', 'scenes: []\n');
  await write('game-list/small/assets/bg/a.svg', '<svg/>');
  await write('game-list/small/.DS_Store', 'x');
  await write('game-list/live2dtest/config.yaml', 'title: big\n');
  await write('game-list/live2dtest/assets/model.moc3', Buffer.alloc(4096));
  await write('game-list/no-config/readme.yaml', 'x');
  return publicDir;
}

const bundleFileNames = [
  'index.html',
  'version.json',
  'assets/index-AAAA.js',
  'assets/index-BBBB.css',
  'assets/parser-CCCC.js',
  'assets/StoryAtlas-DDDD.js',
  'assets/Live2DCharacter-EEEE.js',
  'assets/live2dcubismcore.min-FFFF.js',
  'assets/SUITE-Variable-GGGG.woff2',
  'assets/LICENSE-HHHH.',
  'assets/THIRD_PARTY_NOTICES-IIII.md',
];

describe('offline packs', () => {
  it('lists every file of each game with sizes and a content hash, and flags oversize games', async () => {
    const publicDir = await fixturePublicDir();
    const packs = collectOfflinePacks(publicDir, { maxBytes: 1024 });
    expect(packs.map((pack) => pack.id)).toEqual(['live2dtest', 'small']);
    const small = packs.find((pack) => pack.id === 'small');
    expect(small.version).toBe('1.2.0');
    expect(small.files.map((file) => file.path)).toEqual(['0.yaml', 'assets/bg/a.svg', 'config.yaml']);
    expect(small.bytes).toBe(small.files.reduce((sum, file) => sum + file.bytes, 0));
    expect(small.offerable).toBe(true);
    expect(packs.find((pack) => pack.id === 'live2dtest').offerable).toBe(false);

    const before = small.hash;
    await writeFile(path.join(publicDir, 'game-list/small/0.yaml'), 'scenes: [changed]\n');
    expect(collectOfflinePacks(publicDir, { maxBytes: 1024 }).find((pack) => pack.id === 'small').hash).not.toBe(before);
  });
});

describe('service worker config', () => {
  it('precaches the shell and app chunks but never Live2D, notices or game files', () => {
    const precache = collectPrecache(bundleFileNames);
    expect(precache[0]).toBe('/');
    expect(precache).toContain('/assets/index-AAAA.js');
    expect(precache).toContain('/assets/parser-CCCC.js');
    expect(precache).toContain('/assets/SUITE-Variable-GGGG.woff2');
    expect(precache).toContain('/manifest.webmanifest');
    expect(precache).toContain('/icons/icon-192.png');
    expect(precache.some((url) => /live2d/i.test(url))).toBe(false);
    expect(precache.some((url) => url.includes('game-list'))).toBe(false);
    expect(precache).not.toContain('/version.json');
    expect(precache.some((url) => url.endsWith('.md') || url.endsWith('.'))).toBe(false);
  });

  it('uses the commit as cache version and lists only offerable game pages as optional', () => {
    const packs = [{ id: 'small', offerable: true }, { id: 'live2dtest', offerable: false }];
    const config = buildServiceWorkerConfig({ identity, bundleFileNames, packs });
    expect(config.version).toBe('0.2.0-abc1234');
    expect(config.optional).toEqual(['/en/', '/game-list/small/']);
    expect(JSON.stringify(config)).not.toContain('live2dtest');
    expect(resolveCacheVersion({ ...identity, commit: 'dev' }, ['/a'])).toMatch(/^0\.2\.0-dev-[0-9a-f]{8}$/);
  });

  it('bundles the worker into one classic script with the config inlined', async () => {
    const code = await renderServiceWorker(root, { version: 'v-test', precache: ['/', '/assets/x.js'], optional: [], navigationTimeoutMs: 3500 });
    expect(code).toContain('cache v-test');
    expect(code).toContain('/assets/x.js');
    expect(code).toContain('SKIP_WAITING');
    expect(code).not.toMatch(/^\s*import\s/m);
    expect(code).not.toContain('__YAVN_SW_CONFIG__');
  }, 30_000);
});

describe('manifest and icons', () => {
  it('describes an installable standalone app', () => {
    const manifest = JSON.parse(renderWebManifest());
    expect(manifest).toMatchObject({ name: '야븐 YAVN', short_name: '야븐', start_url: '/', scope: '/', display: 'standalone', lang: 'ko', theme_color: '#183e36', background_color: '#f7f5ee' });
    expect(manifest.icons.map((icon) => `${icon.sizes} ${icon.purpose}`)).toEqual(['192x192 any', '512x512 any', '512x512 maskable']);
  });

  it('encodes valid RGBA PNGs with a transparent corner only on the rounded icon', () => {
    const png = encodePng(32, 32, rasterizeIcon(32, 'any'));
    expect([...png.subarray(0, 8)]).toEqual([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    expect(png.readUInt32BE(16)).toBe(32);
    const idatStart = png.indexOf('IDAT') + 4;
    const raw = inflateSync(png.subarray(idatStart, idatStart + png.readUInt32BE(idatStart - 8)));
    expect(raw.length).toBe((32 * 4 + 1) * 32);
    expect(rasterizeIcon(32, 'any')[3]).toBe(0);
    expect(rasterizeIcon(32, 'maskable')[3]).toBe(255);
    const center = (16 * 32 + 16) * 4;
    expect(rasterizeIcon(32, 'any')[center + 3]).toBe(255);
  });
});

describe('vite plugin', () => {
  it('emits sw.js, the manifest, icons and one offline.json per game', async () => {
    const publicDir = await fixturePublicDir();
    let seenConfig;
    const plugin = yavnPwa({ identity, root, maxOfflineBytes: 1024, renderWorker: async (_root, config) => { seenConfig = config; return 'self.worker=1'; } });
    plugin.configResolved({ publicDir });
    const emitted = [];
    const bundle = Object.fromEntries(bundleFileNames.map((name) => [name, {}]));
    await plugin.generateBundle.call({ emitFile: (file) => emitted.push(file) }, {}, bundle);
    const names = emitted.map((file) => file.fileName);
    expect(names).toEqual(expect.arrayContaining([
      'sw.js', 'manifest.webmanifest', 'icons/icon-192.png', 'icons/icon-512.png', 'icons/icon-maskable-512.png',
      'icons/apple-touch-icon.png', 'game-list/small/offline.json', 'game-list/live2dtest/offline.json',
    ]));
    expect(seenConfig.precache.some((url) => /live2d/i.test(url))).toBe(false);
    expect(seenConfig.optional).not.toContain('/game-list/live2dtest/');
    const pack = JSON.parse(emitted.find((file) => file.fileName === 'game-list/small/offline.json').source);
    expect(pack.files).toHaveLength(3);
  });
});

describe('index.html', () => {
  it('links the manifest and the iOS home-screen tags outside the SEO block', async () => {
    const html = await readFile(path.join(root, 'index.html'), 'utf8');
    const outsideSeo = html.replace(/<!-- yavn:seo:start -->[\s\S]*?<!-- yavn:seo:end -->/, '');
    expect(outsideSeo).toContain('<link rel="manifest" href="/manifest.webmanifest" />');
    expect(outsideSeo).toContain('<link rel="apple-touch-icon" href="/icons/apple-touch-icon.png" />');
    expect(outsideSeo).toContain('name="apple-mobile-web-app-capable"');
    expect(html).toContain('name="theme-color"');
  });

  it('keeps the PWA tags on every generated game page', async () => {
    const html = await readFile(path.join(root, 'index.html'), 'utf8');
    const page = renderGameSeoHtml(html, { id: 'small', name: 'Small', languages: ['ko'] }, { siteOrigin: 'https://example.com' });
    expect(page).toContain('<link rel="manifest" href="/manifest.webmanifest" />');
    expect(page).toContain('apple-touch-icon');
    expect(page).toContain('name="theme-color"');
  });
});
