import { uiLanguage } from './uiLanguage';

export type BuildIdentity = { build: string; commit: string; builtAt: string };

declare const __YAVN_BUILD__: BuildIdentity | undefined;

const FALLBACK_BUILD: BuildIdentity = { build: '0.0.0', commit: 'dev', builtAt: '' };

/** Identity of the bundle that is running right now (injected by the Vite plugin). */
export const BUILD_INFO: BuildIdentity =
  typeof __YAVN_BUILD__ !== 'undefined' && __YAVN_BUILD__ ? __YAVN_BUILD__ : FALLBACK_BUILD;

/** "앱 v0.2.0 · 1a2b3c4" */
export function formatAppVersion(info: BuildIdentity = BUILD_INFO): string {
  return `${uiLanguage === 'en' ? 'App' : '앱'} v${info.build} · ${info.commit}`;
}

/** "작품 v1.0.0" — the content version from the game's config.yaml. */
export function formatContentVersion(version: string | undefined): string | undefined {
  const normalized = version?.trim();
  if (!normalized) return undefined;
  return `${uiLanguage === 'en' ? 'Story' : '작품'} v${normalized}`;
}
