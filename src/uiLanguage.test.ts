import { describe, expect, it } from 'vitest';
import { normalizeGameLanguages, languageLabel, gameHref, resolveUiLanguage } from './uiLanguage';
describe('declared game languages', () => {
 it('does not infer a story language for missing metadata', () => {
   expect(normalizeGameLanguages(undefined)).toEqual([]);
   expect(normalizeGameLanguages(['ko','en-US','ko','../../','',42])).toEqual(['ko','en-US']);
 });
 it('exposes Korean and English search names without changing the language code', () => {
   expect(languageLabel('ko')).toContain('Korean');
   expect(languageLabel('ko')).toContain('한국어');
   expect(languageLabel('en-US')).toContain('English');
   expect(languageLabel('en-US')).toContain('en-US');
 });
});

it('opens English-only stories with English controls from the Korean library', () => {
 expect(gameHref('/game-list/story/', ['en'])).toBe('/game-list/story/?ui=en');
 expect(gameHref('/game-list/story/', ['ko'])).toBe('/game-list/story/');
});

it('uses a story page declared language while honoring explicit UI selection', () => {
 expect(resolveUiLanguage('/game-list/story/', '', 'en')).toBe('en');
 expect(resolveUiLanguage('/game-list/story/', '?ui=ko', 'en')).toBe('ko');
 expect(resolveUiLanguage('/en/', '', 'ko')).toBe('en');
 expect(resolveUiLanguage('/', '', 'ko')).toBe('ko');
});
