import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { load as parseYaml } from 'js-yaml';

const workspaceRoot = process.cwd();
const publicDir = path.join(workspaceRoot, 'public');
const gameListDir = path.join(workspaceRoot, 'public', 'game-list');
const outputPath = path.join(gameListDir, 'index.json');
const sitemapPath = path.join(publicDir, 'sitemap.xml');

const MANIFEST_SCHEMA_VERSION = 3;
const MAX_LAUNCHER_SEO_TITLE_PREVIEW = 8;
const DEFAULT_LAUNCHER_SEO_DESCRIPTION =
  '야븐엔진(YAVN)에서 플레이 가능한 비주얼노벨 게임 목록입니다.';
const DEFAULT_SITE_ORIGIN = 'https://yavn.vercel.app';

function normalizeSiteOrigin(value) {
  const normalized = normalizeText(value) ?? DEFAULT_SITE_ORIGIN;
  return normalized.replace(/\/+$/, '');
}

function escapeXml(value) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&apos;');
}

function toAbsoluteSiteUrl(origin, pathValue) {
  return `${origin}${pathValue.startsWith('/') ? pathValue : `/${pathValue}`}`;
}

const toTitle = (slug) =>
  slug
    .split(/[-_\s]+/)
    .filter(Boolean)
    .map((token) => token.charAt(0).toUpperCase() + token.slice(1))
    .join(' ');

const normalizeText = (value) => {
  if (typeof value !== 'string') {
    return undefined;
  }
  const normalized = value.trim();
  return normalized.length > 0 ? normalized : undefined;
};

const isRecord = (value) => Boolean(value) && typeof value === 'object' && !Array.isArray(value);

const normalizeTagList = (value) => {
  if (!Array.isArray(value)) {
    return [];
  }
  const tags = [];
  for (const raw of value) {
    const normalized = normalizeText(raw);
    if (!normalized || tags.includes(normalized)) {
      continue;
    }
    tags.push(normalized);
  }
  return tags;
};

const mergeUniqueTextList = (...values) => {
  const merged = [];
  for (const value of values) {
    if (!Array.isArray(value)) {
      continue;
    }
    for (const raw of value) {
      const normalized = normalizeText(raw);
      if (!normalized || merged.includes(normalized)) {
        continue;
      }
      merged.push(normalized);
    }
  }
  return merged;
};

const isExternalPath = (value) => /^(blob:|data:|https?:|[a-z][a-z0-9+.-]*:)/i.test(value);

const normalizePathSegment = (rawPath) => rawPath.replace(/\\/g, '/').replace(/^\.?\//, '');

const toGameAssetPath = (gameId, rawPath) => {
  const normalized = normalizeText(rawPath);
  if (!normalized) {
    return undefined;
  }
  if (isExternalPath(normalized) || normalized.startsWith('/')) {
    return normalized;
  }
  return `/game-list/${encodeURIComponent(gameId)}/${normalizePathSegment(normalized)}`;
};

const pickRepresentativeYaml = (yamlPaths) => {
  const numbered = yamlPaths
    .map((name) => {
      const baseName = path.basename(name);
      const match = baseName.match(/^(\d+)\.ya?ml$/i);
      return match ? { name, order: Number(match[1]) } : null;
    })
    .filter((value) => value !== null)
    .sort((a, b) => (a.order !== b.order ? a.order - b.order : a.name.localeCompare(b.name)));
  if (numbered.length > 0) {
    return numbered[0].name;
  }

  const sampleYaml = yamlPaths.find((name) => /^sample\.ya?ml$/i.test(path.basename(name)));
  if (sampleYaml) {
    return sampleYaml;
  }

  return [...yamlPaths].sort((a, b) => a.localeCompare(b))[0];
};

async function collectYamlPaths(targetDirPath, relativeDir = '') {
  const entries = await readdir(targetDirPath, { withFileTypes: true });
  const yamlPaths = [];
  for (const entry of entries) {
    if (entry.isDirectory()) {
      const nestedDir = relativeDir ? `${relativeDir}/${entry.name}` : entry.name;
      const nestedPaths = await collectYamlPaths(path.join(targetDirPath, entry.name), nestedDir);
      yamlPaths.push(...nestedPaths);
      continue;
    }
    if (!entry.isFile() || !/\.ya?ml$/i.test(entry.name)) {
      continue;
    }
    const relativePath = relativeDir ? `${relativeDir}/${entry.name}` : entry.name;
    yamlPaths.push(relativePath);
  }
  return yamlPaths;
}

async function readYamlObject(filePath, logLabel) {
  try {
    const fileText = await readFile(filePath, 'utf8');
    const parsed = parseYaml(fileText);
    return isRecord(parsed) ? parsed : undefined;
  } catch (error) {
    console.warn(`[game-list] Failed to parse ${logLabel}:`, error);
    return undefined;
  }
}

function resolveAuthorName(authorField) {
  if (typeof authorField === 'string') {
    return normalizeText(authorField);
  }
  if (!isRecord(authorField)) {
    return undefined;
  }
  return normalizeText(authorField.name);
}

async function resolveGameMetadata(gameDirPath, gameId, chapterYamlPaths) {
  const configPath = path.join(gameDirPath, 'config.yaml');
  const config = await readYamlObject(configPath, `${gameId}/config.yaml`);
  const launcherPath = path.join(gameDirPath, 'launcher.yaml');
  let launcher;
  try {
    const launcherText = await readFile(launcherPath, 'utf8');
    const parsedLauncher = parseYaml(launcherText);
    if (isRecord(parsedLauncher)) {
      launcher = parsedLauncher;
    }
  } catch (error) {
    if (!(error && typeof error === 'object' && 'code' in error && error.code === 'ENOENT')) {
      console.warn(`[game-list] Failed to parse ${gameId}/launcher.yaml:`, error);
    }
    launcher = undefined;
  }

  let displayName = normalizeText(config?.title);

  if (!displayName) {
    const selectedYaml = pickRepresentativeYaml(chapterYamlPaths);
    if (selectedYaml) {
      const chapter = await readYamlObject(path.join(gameDirPath, selectedYaml), `${gameId}/${selectedYaml}`);
      const legacyMeta = chapter?.meta;
      if (isRecord(legacyMeta)) {
        const legacyTitle = normalizeText(legacyMeta.title);
        if (legacyTitle) {
          displayName = legacyTitle;
        }
      }
    }
  }

  const startScreen = isRecord(config?.startScreen) ? config.startScreen : undefined;
  const seo = isRecord(config?.seo) ? config.seo : undefined;
  const startScreenImage = normalizeText(startScreen?.image);
  const launcherThumbnail = normalizeText(launcher?.thumbnail);
  const seoImage = toGameAssetPath(gameId, normalizeText(seo?.image) ?? launcherThumbnail ?? startScreenImage);
  const seoKeywords = mergeUniqueTextList(normalizeTagList(seo?.keywords), normalizeTagList(launcher?.tags));
  const resolvedName = displayName ?? toTitle(gameId);

  return {
    name: resolvedName,
    author: resolveAuthorName(config?.author),
    version: normalizeText(config?.version),
    summary: normalizeText(launcher?.summary),
    thumbnail: toGameAssetPath(gameId, launcherThumbnail ?? startScreenImage),
    tags: normalizeTagList(launcher?.tags),
    chapterCount: chapterYamlPaths.length,
    seo: {
      title: resolvedName,
      description: normalizeText(seo?.description) ?? normalizeText(launcher?.summary),
      keywords: seoKeywords,
      image: seoImage,
      imageAlt: normalizeText(seo?.imageAlt),
    },
  };
}

function buildLauncherSeoSummary(games) {
  const gameTitles = mergeUniqueTextList(games.map((game) => game.name));
  const preview = gameTitles.slice(0, MAX_LAUNCHER_SEO_TITLE_PREVIEW);
  const overflowCount = Math.max(0, gameTitles.length - preview.length);
  const description =
    preview.length > 0
      ? `야븐엔진(YAVN)에서 플레이 가능한 게임: ${preview.join(', ')}${overflowCount > 0 ? ` 외 ${overflowCount}개` : ''}.`
      : DEFAULT_LAUNCHER_SEO_DESCRIPTION;

  return {
    title: '야븐엔진 (YAVN) 게임 목록',
    description,
    keywords: mergeUniqueTextList(
      gameTitles,
      games.flatMap((game) => game.tags),
      games.flatMap((game) => game.seo?.keywords ?? []),
    ),
    gameTitles,
    gameCount: gameTitles.length,
  };
}

function buildSitemapXml(games, siteOrigin) {
  const rootUrl = toAbsoluteSiteUrl(siteOrigin, '/');
  const gameUrls = mergeUniqueTextList(games.map((game) => game.path)).map((gamePath) =>
    toAbsoluteSiteUrl(siteOrigin, gamePath),
  );
  const entries = [
    { loc: rootUrl, changefreq: 'weekly', priority: '1.0' },
    ...gameUrls.map((loc) => ({ loc, changefreq: 'weekly', priority: '0.8' })),
  ];

  const body = entries
    .map(
      (entry) =>
        `  <url>\n    <loc>${escapeXml(entry.loc)}</loc>\n    <changefreq>${entry.changefreq}</changefreq>\n    <priority>${entry.priority}</priority>\n  </url>`,
    )
    .join('\n');

  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${body}\n</urlset>\n`;
}

async function collectGameFolders() {
  await mkdir(gameListDir, { recursive: true });
  const entries = await readdir(gameListDir, { withFileTypes: true });
  const folders = entries.filter((entry) => entry.isDirectory());

  const games = [];
  for (const folder of folders) {
    const gameDirPath = path.join(gameListDir, folder.name);
    const yamlPaths = await collectYamlPaths(gameDirPath);
    const chapterYamlPaths = yamlPaths.filter((yamlPath) => !/^(config|base|launcher)\.ya?ml$/i.test(path.basename(yamlPath)));
    if (chapterYamlPaths.length === 0) {
      continue;
    }
    const metadata = await resolveGameMetadata(gameDirPath, folder.name, chapterYamlPaths);
    games.push({
      id: folder.name,
      name: metadata.name,
      path: `/game-list/${encodeURIComponent(folder.name)}/`,
      author: metadata.author,
      version: metadata.version,
      summary: metadata.summary,
      thumbnail: metadata.thumbnail,
      tags: metadata.tags,
      chapterCount: metadata.chapterCount,
      seo: metadata.seo,
    });
  }

  games.sort((a, b) => a.name.localeCompare(b.name, 'ko'));
  return games;
}

const games = await collectGameFolders();
const manifest = {
  schemaVersion: MANIFEST_SCHEMA_VERSION,
  generatedAt: new Date().toISOString(),
  games,
  seo: buildLauncherSeoSummary(games),
};
const siteOrigin = normalizeSiteOrigin(process.env.SITE_ORIGIN ?? process.env.SITEMAP_ORIGIN);
const sitemapXml = buildSitemapXml(games, siteOrigin);

await writeFile(outputPath, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');
await writeFile(sitemapPath, sitemapXml, 'utf8');
console.log(`Generated ${outputPath} with ${games.length} game(s).`);
console.log(`Generated ${sitemapPath} with ${games.length + 1} url(s).`);
