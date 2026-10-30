import messages from './uiMessages.json';
export function resolveUiLanguage(pathname: string, search: string, documentLanguage = 'ko'): 'ko' | 'en' {
  const requested = new URLSearchParams(search).get('ui');
  if (requested === 'ko' || requested === 'en') return requested;
  return /^\/en\/?$/.test(pathname) || documentLanguage === 'en' ? 'en' : 'ko';
}
export const uiLanguage: 'ko' | 'en' = typeof window === 'undefined' ? 'ko' : resolveUiLanguage(
  window.location.pathname, window.location.search, document.documentElement.lang,
);
export function t(text: string): string {
  return uiLanguage === 'en' ? (messages as Record<string, string>)[text] ?? text : text;
}
export const gameLanguageNames: Record<string, string> = {ko: '한국어 · Korean', en: 'English · 영어', ja: '日本語 · 일본어 · Japanese', zh: '中文 · 중국어 · Chinese'};
export function languageLabel(code: string): string {
  return gameLanguageNames[code] ?? (gameLanguageNames[code.split('-')[0]] ? `${gameLanguageNames[code.split('-')[0]]} (${code})` : code);
}
export function normalizeGameLanguages(value: unknown): string[] {
  return Array.isArray(value) ? [...new Set(value.filter((code): code is string => typeof code === 'string' && /^[a-z]{2,3}(?:-[A-Za-z0-9]{2,8})*$/.test(code)))] : [];
}
export function gameHref(path: string, languages: readonly string[] = []): string {
  const englishOnly = languages.length === 1 && languages[0] === 'en';
  return uiLanguage === 'en' || englishOnly ? `${path}?ui=en` : path;
}
