import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { load, dump } from 'js-yaml';

const fields = new Set(['text', 'prompt', 'title', 'chapterTitle', 'continueLabel', 'caption', 'message']);
const read = async path => load(await readFile(path, 'utf8'));
const names = { '어린 덕만': 'Young Deokman', '진평왕': 'King Jinpyeong', '소화': 'Sohwa', '칠숙': 'Chilsuk', };
export function translateChapter(value, translations) {
  if (Array.isArray(value)) return value.map(item => translateChapter(item, translations));
  if (!value || typeof value !== 'object') return value;
  return Object.fromEntries(Object.entries(value).map(([key, item]) => {
    if (fields.has(key) && typeof item === 'string') {
      if (!Object.hasOwn(translations, item)) throw new Error(`Missing English translation for ${key}`);
      return [key, translations[item]];
    }
    return [key, translateChapter(item, translations)];
  }));
}
function rebase(value, game) {
  if (Array.isArray(value)) return value.map(item => rebase(item, game));
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([key, item]) => [names[key] ?? key, rebase(item, game)]));
  if (typeof value !== 'string') return value;
  if (/^\/?assets\//.test(value)) return `root:/game-list/${game}/${value.replace(/^\//, '')}`;
  for (const [ko, en] of Object.entries(names)) {
    if (value === ko || value.startsWith(`${ko}.`)) return value.replace(ko, en);
  }
  return value;
}
const definitions = [
  { game: 'deokman', title: 'Deokman: The Princess Written Dead', summary: 'English chapter one only. Someone has recorded her death before nightfall. Read the evidence, face her father and escape the burning palace with Sohwa.', image: 'assets/bg/title-deokman-v8-fire-v1.webp', subtitle: 'Her father asks her to leave. Her nurse asks her not to let go.', ending: 'A hand beyond the palace walls', message: 'You have reached the end of English chapter one. The remaining eleven chapters are available in the Korean full story. Return to the library to continue in Korean.', background: 'moon_court', music: 'open_sky' },
];
for (const d of definitions) {
  const source = `public/game-list/${d.game}`;
  const target = `public/game-list/english-${d.game}`;
  const translations = JSON.parse(await readFile(`content/localizations/${d.game}-opening.en.json`, 'utf8'));
  const chapter = translateChapter(await read(`${source}/0.yaml`), translations);
  // A preview ends here, without changing any choices or silently entering Korean chapters.
  function closeBoundary(value) {
    if (Array.isArray(value)) return value.map(closeBoundary);
    if (!value || typeof value !== 'object') return value;
    if (value.goto === '/1.yaml') return { ending: 'prologue_end' };
    return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, closeBoundary(item)]));
  }
  const config = await read(`${source}/config.yaml`);
  config.title = d.title;
  config.version = '1.0.0';
  config.seo = { description: d.summary, keywords: ['English visual novel', 'opening chapter', 'Silla historical drama'], image: `/game-list/${d.game}/${d.image}`, imageAlt: 'A princess outside a burning palace' };
  config.startScreen.startButtonText = 'Start English chapter';
  config.startScreen.eyebrow = 'ENGLISH OPENING CHAPTER';
  config.startScreen.subtitle = d.subtitle;
  config.endings = { prologue_end: { title: d.ending, message: d.message, tone: 'hopeful', background: d.background, music: d.music } };
  config.defaultEnding = 'prologue_end';
  delete config.endingRules;
  delete config.legalNotices;
  const base = await read(`${source}/base.yaml`);
  {
    const items = {
      peony_painting: ['Scentless peony painting', 'Flowers without bees or butterflies. A death record was hidden behind the roller.', 'Royal object'],
      death_register: ['Forged death record', 'It records Deokman\'s death tonight while she is still alive. The red seal is missing its bottom-right corner.', 'Forbidden record'],
      peony_token: ['Bronze peony token', 'A worn royal pass with green patina, an open cord loop and a peony design. It can open the north gate, but using it reveals her identity.', 'Identity token'],
    };
    base.inventory = Object.fromEntries(Object.entries(items).map(([id, [name, description, category]]) => [id, { ...base.inventory[id], name, description, category }]));
  }
  const cast = ['어린 덕만', '진평왕', '소화', '칠숙'];
  base.assets.characters = Object.fromEntries(Object.entries(base.assets.characters).filter(([id]) => cast.includes(id)));
  const launcher = { languages: ['en'], summary: d.summary, translations: { en: { summary: d.summary } }, thumbnail: `/game-list/${d.game}/${d.image}`, tags: ['english', 'opening-chapter', 'historical-fiction', 'character-drama'], tagLabels: { english: '영어판', 'opening-chapter': '첫 장', 'historical-fiction': '역사극', 'character-drama': '인물 드라마' } };
  await mkdir(target, { recursive: true });
  for (const [file, value] of Object.entries({ '0.yaml': closeBoundary(chapter), 'base.yaml': base, 'config.yaml': config, 'launcher.yaml': launcher })) {
    await writeFile(`${target}/${file}`, dump(rebase(value, d.game), { lineWidth: -1, noRefs: true, quotingType: '"' }));
  }
}
console.log('Generated the English opening chapter.');
