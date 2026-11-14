import { styleStartupHtml } from './startup-presentation.mjs';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { isStory } from './story-catalog.mjs';

const DEFAULT_SITE_ORIGIN = 'https://yavn.vercel.app';
const SEO_BLOCK_PATTERN = /<!-- yavn:seo:start -->[\s\S]*?<!-- yavn:seo:end -->/;

function normalizeText(value) {
  if (typeof value !== 'string') {
    return undefined;
  }
  const normalized = value.trim();
  return normalized.length > 0 ? normalized : undefined;
}

function normalizeSiteOrigin(value) {
  const candidate = normalizeText(value) ?? DEFAULT_SITE_ORIGIN;
  try {
    const url = new URL(candidate);
    if (url.protocol !== 'https:' && url.protocol !== 'http:') {
      return DEFAULT_SITE_ORIGIN;
    }
    return url.origin;
  } catch {
    return DEFAULT_SITE_ORIGIN;
  }
}

function resolveAbsoluteUrl(rawValue, siteOrigin, fallbackPath) {
  const value = normalizeText(rawValue) ?? fallbackPath;
  try {
    const url = new URL(value, `${siteOrigin}/`);
    return url.protocol === 'https:' || url.protocol === 'http:'
      ? url.toString()
      : new URL(fallbackPath, `${siteOrigin}/`).toString();
  } catch {
    return new URL(fallbackPath, `${siteOrigin}/`).toString();
  }
}

function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function escapeJsonForHtml(value) {
  return JSON.stringify(value, null, 2)
    .replaceAll('<', '\\u003c')
    .replaceAll('>', '\\u003e')
    .replaceAll('&', '\\u0026');
}

function normalizeList(...values) {
  const result = [];
  for (const value of values) {
    if (!Array.isArray(value)) {
      continue;
    }
    for (const item of value) {
      const normalized = normalizeText(item);
      if (normalized && !result.includes(normalized)) {
        result.push(normalized);
      }
    }
  }
  return result;
}

function resolveImageMimeType(imageUrl) {
  let pathname;
  try {
    pathname = new URL(imageUrl).pathname.toLowerCase();
  } catch {
    return undefined;
  }
  if (pathname.endsWith('.jpg') || pathname.endsWith('.jpeg')) {
    return 'image/jpeg';
  }
  if (pathname.endsWith('.png')) {
    return 'image/png';
  }
  if (pathname.endsWith('.webp')) {
    return 'image/webp';
  }
  if (pathname.endsWith('.avif')) {
    return 'image/avif';
  }
  return undefined;
}

function assertSafeGameId(value) {
  const id = normalizeText(value);
  if (!id || id === '.' || id === '..' || id.includes('/') || id.includes('\\') || id.includes('\0')) {
    throw new Error(`Invalid game id for SEO page generation: ${String(value)}`);
  }
  return id;
}

export function resolveGameSeo(game, options = {}) {
  const siteOrigin = normalizeSiteOrigin(options.siteOrigin);
  const id = assertSafeGameId(game?.id);
  const english = game?.languages?.[0]?.split('-')[0] === 'en';
  const title = normalizeText(game?.seo?.title) ?? normalizeText(game?.name) ?? id;
  const description =
    normalizeText(game?.seo?.description) ??
    normalizeText(game?.summary) ??
    (english ? `Play ${title} in your browser.` : `${title}을(를) 브라우저에서 플레이하세요.`);
  const descriptionEn = normalizeText(game?.seo?.descriptionEn) ?? normalizeText(game?.summaryEn);
  // The same game is served under two addresses, one per interface language. They are
  // alternates of each other, so each page names both and the pair shares a story.
  const interfaceLanguage = options.interfaceLanguage === 'en' ? 'en' : 'ko';
  const fallbackPath = `/game-list/${encodeURIComponent(id)}/`;
  const koUrl = resolveAbsoluteUrl(normalizeText(game?.path) ?? fallbackPath, siteOrigin, fallbackPath);
  const enUrl = `${siteOrigin}/en${new URL(koUrl).pathname}`;
  const canonicalUrl = interfaceLanguage === 'en' ? enUrl : koUrl;
  const imageUrl = resolveAbsoluteUrl(
    game?.seo?.image ?? game?.thumbnail,
    siteOrigin,
    '/favicon.svg',
  );
  const imageAlt = normalizeText(game?.seo?.imageAlt) ?? (english ? `${title} cover image` : `${title} 대표 이미지`);
  const keywords = normalizeList(game?.seo?.keywords, game?.tags, [title, english ? 'visual novel game' : '비주얼노벨 게임']);
  const author = normalizeText(game?.author);

  return {
    id,
    title,
    interfaceLanguage,
    description: interfaceLanguage === 'en' ? descriptionEn ?? description : description,
    descriptionKo: description,
    descriptionEn,
    canonicalUrl,
    koUrl,
    enUrl,
    imageUrl,
    imageAlt,
    keywords,
    author,
    imageMimeType: resolveImageMimeType(imageUrl),
    jsonLd: {
      '@context': 'https://schema.org',
      '@type': 'VideoGame',
      name: title,
      description: interfaceLanguage === 'en' ? descriptionEn ?? description : description,
      url: canonicalUrl,
      image: imageUrl,
      ...(Array.isArray(game?.languages) && game.languages.length ? { inLanguage: game.languages } : {}),
      isAccessibleForFree: true,
      playMode: 'SinglePlayer',
      ...(author
        ? {
            author: {
              '@type': 'Person',
              name: author,
            },
          }
        : {}),
      isPartOf: {
        '@type': 'WebSite',
        name: '야븐엔진 (YAVN)',
        url: `${siteOrigin}/`,
      },
      potentialAction: {
        '@type': 'PlayAction',
        target: canonicalUrl,
      },
    },
  };
}

export function buildGameSeoBlock(game, options = {}) {
  const seo = resolveGameSeo(game, options);
  const imageTypeTag = seo.imageMimeType
    ? `\n    <meta property="og:image:type" content="${escapeHtml(seo.imageMimeType)}" />`
    : '';
  const authorTag = seo.author
    ? `\n    <meta name="author" content="${escapeHtml(seo.author)}" />`
    : '';

  return `<!-- yavn:seo:start -->
    <meta name="theme-color" content="#14111b" />
    <meta name="description" content="${escapeHtml(seo.description)}" />
    <meta name="keywords" content="${escapeHtml(seo.keywords.join(', '))}" />${authorTag}
    <meta name="application-name" content="${escapeHtml(seo.title)}" />
    <meta name="robots" content="${isStory(game) ? 'index,follow,max-image-preview:large' : 'noindex,follow'}" />
    <link rel="canonical" href="${escapeHtml(seo.canonicalUrl)}" />
    <link rel="alternate" hreflang="ko" href="${escapeHtml(seo.koUrl)}" />
    <link rel="alternate" hreflang="en" href="${escapeHtml(seo.enUrl)}" />
    <link rel="alternate" hreflang="x-default" href="${escapeHtml(seo.enUrl)}" />
    <meta property="og:type" content="website" />
    <meta property="og:url" content="${escapeHtml(seo.canonicalUrl)}" />
    <meta property="og:site_name" content="야븐엔진 (YAVN)" />
    <meta property="og:title" content="${escapeHtml(seo.title)}" />
    <meta property="og:description" content="${escapeHtml(seo.description)}" />
    <meta property="og:locale" content="${seo.interfaceLanguage === 'en' ? 'en_US' : 'ko_KR'}" />
    <meta property="og:locale:alternate" content="${seo.interfaceLanguage === 'en' ? 'ko_KR' : 'en_US'}" />
    <meta property="og:image" content="${escapeHtml(seo.imageUrl)}" />
    <meta property="og:image:secure_url" content="${escapeHtml(seo.imageUrl)}" />${imageTypeTag}
    <meta property="og:image:alt" content="${escapeHtml(seo.imageAlt)}" />
    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:title" content="${escapeHtml(seo.title)}" />
    <meta name="twitter:description" content="${escapeHtml(seo.description)}" />
    <meta name="twitter:image" content="${escapeHtml(seo.imageUrl)}" />
    <meta name="twitter:image:alt" content="${escapeHtml(seo.imageAlt)}" />
    <title>${escapeHtml(seo.title)}</title>
    <script id="yavn-dynamic-jsonld" type="application/ld+json">
${escapeJsonForHtml(seo.jsonLd)
  .split('\n')
  .map((line) => `      ${line}`)
  .join('\n')}
    </script>
    <!-- yavn:seo:end -->`;
}

const LANGUAGE_NAMES = { ko: '한국어 · Korean', en: 'English', ja: '日本語 · Japanese', zh: '中文 · Chinese' };

export function renderGameSeoHtml(templateHtml, game, options = {}) {
  if (!SEO_BLOCK_PATTERN.test(templateHtml)) {
    throw new Error('Built index.html is missing the YAVN SEO marker block.');
  }
  const english = options.interfaceLanguage === 'en';
  const id = assertSafeGameId(game?.id);
  const contentPath = normalizeText(game?.path) ?? `/game-list/${encodeURIComponent(id)}/`;
  // The interface language, not the story's. A Korean story read in English is still Korean,
  // which is why the summary in the other language keeps its own lang attribute below.
  const pageLanguage = english ? 'en' : game.languages?.[0] ?? 'ko';
  const summaryKo = normalizeText(game?.summary) ?? normalizeText(game?.seo?.description) ?? '';
  const summaryEn = normalizeText(game?.summaryEn);
  const languages = (Array.isArray(game?.languages) ? game.languages : [])
    .map((code) => LANGUAGE_NAMES[code] ?? code)
    .join(', ');

  const lead = english ? summaryEn ?? summaryKo : summaryKo;
  const secondary = english ? (summaryEn ? summaryKo : undefined) : summaryEn;
  const secondaryLang = english ? 'ko' : 'en';
  const shell = `<main><a href="${english ? '/en/' : '/'}">YAVN</a><h1>${escapeHtml(game.name ?? id)}</h1><p>${escapeHtml(lead)}</p>${
    secondary ? `<p lang="${secondaryLang}">${escapeHtml(secondary)}</p>` : ''
  }<p>${english ? 'Game languages' : '지원 언어 / Game languages'}: ${escapeHtml(languages || 'Not specified')}</p><p><a href="${
    english ? escapeHtml(contentPath) : `/en${escapeHtml(contentPath)}`
  }" lang="${english ? 'ko' : 'en'}">${english ? '한국어' : 'English'}</a></p></main>`;

  return styleStartupHtml(
    templateHtml
      .replace(/<html lang="[^"]*">/, `<html lang="${escapeHtml(pageLanguage)}">`)
      .replace(SEO_BLOCK_PATTERN, buildGameSeoBlock(game, options))
      .replace('<div id="root"></div>', `<div id="root">${shell}</div>`),
    options.fontUrl,
  );
}

export async function generateGameSeoPages(options = {}) {
  const workspaceRoot = options.workspaceRoot ?? process.cwd();
  const distDir = options.distDir ?? path.join(workspaceRoot, 'dist');
  const templatePath = path.join(distDir, 'index.html');
  const manifestPath = path.join(distDir, 'game-list', 'index.json');
  const siteOrigin = normalizeSiteOrigin(
    options.siteOrigin ?? process.env.SITE_ORIGIN ?? process.env.SITEMAP_ORIGIN,
  );
  const [templateHtml, manifestText] = await Promise.all([
    readFile(templatePath, 'utf8'),
    readFile(manifestPath, 'utf8'),
  ]);
  const manifest = JSON.parse(manifestText);
  const games = Array.isArray(manifest?.games) ? manifest.games : [];

  for (const game of games) {
    const id = assertSafeGameId(game?.id);
    for (const interfaceLanguage of ['ko', 'en']) {
      const outputDir =
        interfaceLanguage === 'en'
          ? path.join(distDir, 'en', 'game-list', id)
          : path.join(distDir, 'game-list', id);
      await mkdir(outputDir, { recursive: true });
      await writeFile(
        path.join(outputDir, 'index.html'),
        renderGameSeoHtml(templateHtml, game, { siteOrigin, interfaceLanguage }),
        'utf8',
      );
    }
  }

  return {
    outputCount: games.length * 2,
    siteOrigin,
  };
}

const invokedPath = process.argv[1] ? pathToFileURL(path.resolve(process.argv[1])).href : undefined;
if (invokedPath === import.meta.url) {
  const result = await generateGameSeoPages();
  console.log(`Generated ${result.outputCount} game-specific SEO page(s) for ${result.siteOrigin}.`);
}
