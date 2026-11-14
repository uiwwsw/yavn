import { describe, expect, it } from 'vitest';
import { renderSitemap, selectIndexableGames } from './generate-sitemap.mjs';

const stories = [
  { id: '360', path: '/game-list/360/', name: '360' },
  { id: 'live2dtest', path: '/game-list/live2dtest/', name: 'Live2D 테스트' },
];

describe('selectIndexableGames', () => {
  it('leaves the rendering fixture out of the index', () => {
    expect(selectIndexableGames(stories).map((game) => game.id)).toEqual(['360']);
  });

  it('drops entries with no address to point at', () => {
    expect(selectIndexableGames([{ id: 'draft' }])).toEqual([]);
  });
});

describe('renderSitemap', () => {
  const xml = renderSitemap({ games: selectIndexableGames(stories), origin: 'https://example.test' });

  it('lists both languages of every translated page', () => {
    for (const loc of ['/', '/en/', '/create/', '/en/create/']) {
      expect(xml).toContain(`<loc>https://example.test${loc}</loc>`);
    }
  });

  it('names the whole language set on each translated page', () => {
    const koHome = xml.slice(xml.indexOf('<loc>https://example.test/</loc>'));
    expect(koHome).toContain('<xhtml:link rel="alternate" hreflang="en" href="https://example.test/en/"/>');
    expect(koHome).toContain('<xhtml:link rel="alternate" hreflang="x-default" href="https://example.test/en/"/>');
  });

  it('declares the xhtml namespace the alternates need', () => {
    expect(xml).toContain('xmlns:xhtml="http://www.w3.org/1999/xhtml"');
  });

  it('indexes the stories and nothing else', () => {
    expect(xml).toContain('<loc>https://example.test/game-list/360/</loc>');
    expect(xml).not.toContain('live2dtest');
  });
});
