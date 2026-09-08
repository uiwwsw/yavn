import type { StartSceneConfig } from './types';

export const DEFAULT_START_SCENE: StartSceneConfig = {
  layout: 'split', motion: 'drift', duration: 24000, parallax: 12,
  particles: 'dust', intensity: 0.55, fog: true, light: 'breathe', layers: [],
  transition: { type: 'fade', duration: 1000 },
};

/** Shared by config parsing and URL previews; never mutates author data. */
export function mapStartSceneAssets(
  scene: StartSceneConfig | undefined,
  resolve: (path: string) => string,
): StartSceneConfig | undefined {
  if (!scene) return undefined;
  return {
    ...scene,
    video: scene.video ? resolve(scene.video) : undefined,
    layers: scene.layers.map((layer) => ({ ...layer, image: resolve(layer.image) })),
  };
}

export function collectStartSceneAssets(scene: StartSceneConfig | undefined): string[] {
  return [...new Set([scene?.video, ...(scene?.layers.map((layer) => layer.image) ?? [])]
    .filter((source): source is string => Boolean(source)))];
}

/** Stable particles avoid random jumps on a title/menu rerender. */
export function createTitleParticles(count: number) {
  let seed = 137;
  const random = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
  return Array.from({ length: Math.max(0, Math.min(100, Math.floor(count))) }, () => ({
    x: random(), y: random(), depth: .25 + random() * .75,
    speed: .02 + random() * .065, phase: random() * Math.PI * 2,
    size: .7 + random() * 1.8,
  }));
}
