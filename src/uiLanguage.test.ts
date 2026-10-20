import { describe, expect, it } from 'vitest';
import { normalizeGameLanguages, languageLabel } from './uiLanguage';
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
