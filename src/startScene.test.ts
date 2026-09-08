import { describe, expect, it } from 'vitest';
import { dump } from 'js-yaml';
import { parseConfigYaml } from './parser';
import { collectStartSceneAssets, createTitleParticles, DEFAULT_START_SCENE, mapStartSceneAssets } from './startScene';

const parse = (scene: unknown, path = 'config.yaml') => parseConfigYaml(dump({
  title: 'Title Scene', textSpeed: 38, autoSave: false, clickToInstant: true,
  startScreen: { scene },
}), path);

describe('authored title scenes', () => {
  it('shares renderer defaults with normalized YAML without requiring new fields in old games', () => {
    expect(parse({}).data?.data.startScreen?.scene).toEqual(DEFAULT_START_SCENE);
    expect(parse(undefined).data?.data.startScreen?.scene).toBeUndefined();
    expect(parse(undefined).error).toBeUndefined();
  });

  it('resolves nested config assets and root/remote layers consistently', () => {
    const result = parse({
      video: '../video/loop.webm', layers: [
        { image: 'characters/hero.png', mobile: { y: 84, height: 120 } },
        { image: 'root:/shared/fog.webp', blend: 'screen' },
        { image: 'https://example.com/title.png' },
      ],
    }, 'story/config.yaml');
    expect(result.error).toBeUndefined();
    expect(result.data?.data.startScreen?.scene).toMatchObject({
      video: 'video/loop.webm', layers: [
        { image: 'story/characters/hero.png', x: 50, depth: 1, mobile: { y: 84, height: 120 } },
        { image: 'root:/shared/fog.webp', blend: 'screen' },
        { image: 'https://example.com/title.png' },
      ],
    });
  });

  it.each([
    { duration: 100 }, { parallax: 99 }, { intensity: -1 }, { particles: 'typo' },
    { layers: Array.from({ length: 7 }, () => ({ image: 'hero.png' })) },
    { layers: [{ image: 'hero.png', mobile: { width: 0 } }] },
    { transition: { duration: 10000 } }, { accent: 'red' },
    { layers: [{ image: '.' }] }, { video: './' },
  ])('rejects invalid scene bounds and paths: %j', (scene) => {
    expect(parse(scene).error).toBeDefined();
  });

  it('maps all asset roles without changing the author config or duplicating owned assets', () => {
    const scene = parse({ video: 'loop.webm', layers: [{ image: 'hero.png' }, { image: 'hero.png' }] }).data!.data.startScreen!.scene!;
    const mapped = mapStartSceneAssets(scene, path => `blob:${path}`)!;
    expect(collectStartSceneAssets(mapped)).toEqual(['blob:loop.webm', 'blob:hero.png']);
    expect(scene.layers[0].image).toBe('hero.png');
    expect(scene.video).toBe('loop.webm');
    expect(collectStartSceneAssets(undefined)).toEqual([]);
  });

  it('keeps particles stable through menu updates and bounds rendering work', () => {
    expect(createTitleParticles(20)).toEqual(createTitleParticles(20));
    expect(createTitleParticles(1000)).toHaveLength(100);
    expect(createTitleParticles(-1)).toEqual([]);
  });
});
