import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { generateNotFoundPage, renderNotFoundHtml } from './generate-not-found.mjs';

// Games that were taken down keep working links: search engines and old bookmarks still point
// at them. Each retired id must redirect somewhere real, and anything else must land on a 404
// page that offers the library instead of the host's bare error page.

const vercel = JSON.parse(await readFile(new URL('../vercel.json', import.meta.url), 'utf8'));
const manifest = JSON.parse(await readFile(new URL('../public/game-list/index.json', import.meta.url), 'utf8'));
const liveGameIds = new Set(manifest.games.map((game) => game.id));

const RETIRED = {
  deokman: '/game-list/muwon/',
  'deokman-v8-preview': '/game-list/muwon/',
  'english-deokman': '/game-list/muwon/',
  'erase-first': '/game-list/erase/',
  conan: '/',
  'conan-demo': '/',
  'conan-midnight-alibi': '/',
  'english-conan': '/',
};

describe('retired game routes', () => {
  const bySource = new Map(vercel.redirects.map((entry) => [entry.source, entry]));

  it.each(Object.entries(RETIRED))('sends /game-list/%s and everything under it to %s', (id, destination) => {
    for (const source of [`/game-list/${id}`, `/game-list/${id}/:path*`]) {
      const redirect = bySource.get(source);
      expect(redirect, source).toBeDefined();
      expect(redirect.destination).toBe(destination);
      expect(redirect.permanent).toBe(true);
    }
  });

  it('never redirects a game that is still published', () => {
    for (const id of Object.keys(RETIRED)) expect(liveGameIds.has(id)).toBe(false);
  });

  it('points every redirect at the library or a game that exists', () => {
    for (const destination of new Set(Object.values(RETIRED))) {
      if (destination === '/') continue;
      const id = destination.replace('/game-list/', '').replace(/\/$/, '');
      expect(liveGameIds.has(id), destination).toBe(true);
    }
  });

  it('keeps a redirect for a retired id ahead of the trailing-slash rules', () => {
    const firstRetired = vercel.redirects.findIndex((entry) => entry.source.startsWith('/game-list/'));
    expect(firstRetired).toBeGreaterThanOrEqual(0);
  });
});

describe('404 page', () => {
  const directories = [];
  afterEach(async () => {
    await Promise.all(directories.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
  });

  it('asks search engines not to index it and offers the library', () => {
    const html = renderNotFoundHtml({ games: [] });
    expect(html).toContain('name="robots" content="noindex,follow"');
    expect(html).toContain('href="/"');
    expect(html).toContain('없는 쪽입니다');
    expect(html).not.toContain('<ul>');
  });

  it('lists the games that are still playable and escapes their text', () => {
    const html = renderNotFoundHtml({
      games: [{ id: 'a', name: '무원 & "한성"', path: '/game-list/muwon/', summary: '<b>검시</b>' }],
      fontUrl: '/assets/SUITE-Variable-abc.woff2',
    });
    expect(html).toContain('href="/game-list/muwon/"');
    expect(html).toContain('무원 &amp; &quot;한성&quot;');
    // Escaping '<' is what keeps a summary from opening a tag.
    expect(html).toContain('&lt;b&gt;검시&lt;/b&gt;'.replaceAll('&gt;', '>'));
    expect(html).not.toContain('<b>검시');
    expect(html).toContain('/assets/SUITE-Variable-abc.woff2');
  });

  it('writes 404.html from the built manifest and leaves out the Live2D sample', async () => {
    const dist = await mkdtemp(path.join(os.tmpdir(), 'yavn-404-'));
    directories.push(dist);
    await mkdir(path.join(dist, 'game-list'), { recursive: true });
    await writeFile(path.join(dist, 'game-list/index.json'), JSON.stringify({
      games: [
        { id: 'muwon', name: '무원', path: '/game-list/muwon/' },
        { id: 'live2dtest', name: 'Live2D', path: '/game-list/live2dtest/' },
      ],
    }));

    const result = await generateNotFoundPage({ distDir: dist });

    expect(result.games).toBe(1);
    const html = await readFile(path.join(dist, '404.html'), 'utf8');
    expect(html).toContain('/game-list/muwon/');
    expect(html).not.toContain('live2dtest');
  });

  it('still writes a usable page when the build has no manifest yet', async () => {
    const dist = await mkdtemp(path.join(os.tmpdir(), 'yavn-404-empty-'));
    directories.push(dist);

    const result = await generateNotFoundPage({ distDir: dist });

    expect(result.games).toBe(0);
    expect(await readFile(path.join(dist, '404.html'), 'utf8')).toContain('이야기 서재로');
  });
});
