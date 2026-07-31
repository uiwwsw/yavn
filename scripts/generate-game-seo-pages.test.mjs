import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import {
  generateGameSeoPages,
  renderGameSeoHtml,
} from './generate-game-seo-pages.mjs';

const temporaryDirectories = [];
const templateHtml = `<!doctype html>
<html lang="ko">
  <head>
    <!-- yavn:seo:start -->
    <title>야븐엔진 (YAVN)</title>
    <!-- yavn:seo:end -->
    <script type="module" src="/assets/app.js"></script>
  </head>
  <body><div id="root"></div></body>
</html>`;

const fixtureGame = {
  id: 'fixture-game',
  name: 'Fixture Game',
  path: '/game-list/fixture-game/',
  author: 'Test Author',
  summary: 'Fallback summary',
  thumbnail: '/game-list/fixture-game/cover.avif',
  tags: ['mystery'],
  seo: {
    title: '폭우의 2번 찻잔',
    description: '사라진 1분과 찻잔의 비밀을 밝히는 추리 게임.',
    keywords: ['추리 게임', '비주얼노벨'],
    image: '/game-list/fixture-game/social.jpg',
    imageAlt: '폭우 속 료칸',
  },
};

afterEach(async () => {
  await Promise.all(
    temporaryDirectories.splice(0).map((directory) =>
      rm(directory, { recursive: true, force: true }),
    ),
  );
});

describe('game-specific SEO page generation', () => {
  it('replaces generic engine metadata with game metadata', () => {
    const rendered = renderGameSeoHtml(templateHtml, fixtureGame, {
      siteOrigin: 'https://example.com',
    });

    expect(rendered).toContain('<title>폭우의 2번 찻잔</title>');
    expect(rendered).toContain(
      '<link rel="canonical" href="https://example.com/game-list/fixture-game/" />',
    );
    expect(rendered).toContain(
      '<meta property="og:title" content="폭우의 2번 찻잔" />',
    );
    expect(rendered).toContain(
      '<meta property="og:image" content="https://example.com/game-list/fixture-game/social.jpg" />',
    );
    expect(rendered).toContain(
      '<meta name="twitter:card" content="summary_large_image" />',
    );
    expect(rendered).toContain(
      '<meta name="twitter:image:alt" content="폭우 속 료칸" />',
    );
    expect(rendered).toContain('"@type": "VideoGame"');
    expect(rendered).not.toContain('<title>야븐엔진 (YAVN)</title>');
  });

  it('escapes HTML and inline JSON-LD values', () => {
    const rendered = renderGameSeoHtml(
      templateHtml,
      {
        ...fixtureGame,
        seo: {
          ...fixtureGame.seo,
          title: '</title><script>alert("x")</script>',
        },
      },
      { siteOrigin: 'https://example.com' },
    );

    expect(rendered).toContain(
      '<title>&lt;/title&gt;&lt;script&gt;alert(&quot;x&quot;)&lt;/script&gt;</title>',
    );
    expect(rendered).toContain('\\u003c/script\\u003e');
    expect(rendered).not.toContain('<script>alert("x")</script>');
  });

  it('writes one static HTML entry for every manifest game', async () => {
    const workspaceRoot = await mkdtemp(path.join(os.tmpdir(), 'yavn-seo-'));
    temporaryDirectories.push(workspaceRoot);
    const distDir = path.join(workspaceRoot, 'dist');
    await mkdir(path.join(distDir, 'game-list'), { recursive: true });
    await writeFile(path.join(distDir, 'index.html'), templateHtml, 'utf8');
    await writeFile(
      path.join(distDir, 'game-list', 'index.json'),
      JSON.stringify({ games: [fixtureGame] }),
      'utf8',
    );

    const result = await generateGameSeoPages({
      workspaceRoot,
      siteOrigin: 'https://example.com/',
    });
    const generated = await readFile(
      path.join(distDir, 'game-list', fixtureGame.id, 'index.html'),
      'utf8',
    );

    expect(result).toEqual({
      outputCount: 1,
      siteOrigin: 'https://example.com',
    });
    expect(generated).toContain('<title>폭우의 2번 찻잔</title>');
    expect(generated).toContain('<script type="module" src="/assets/app.js"></script>');
  });
});
