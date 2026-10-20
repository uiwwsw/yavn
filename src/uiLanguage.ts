import messages from './uiMessages.json';
export const uiLanguage: 'ko' | 'en' = typeof window !== 'undefined' &&
  (/^\/en\/?$/.test(window.location.pathname) || new URLSearchParams(window.location.search).get('ui') === 'en') ? 'en' : 'ko';
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
export function gameHref(path: string): string { return uiLanguage === 'en' ? `${path}?ui=en` : path; }
