import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { load as parseYaml } from 'js-yaml';

const workspaceRoot = process.cwd();
const gameListDir = path.join(workspaceRoot, 'public', 'game-list');
const outputPath = path.join(gameListDir, 'index.json');

const MANIFEST_SCHEMA_VERSION = 2;

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
  const startScreenImage = normalizeText(startScreen?.image);
  const launcherThumbnail = normalizeText(launcher?.thumbnail);

  return {
    name: displayName ?? toTitle(gameId),
    author: resolveAuthorName(config?.author),
    version: normalizeText(config?.version),
    summary: normalizeText(launcher?.summary),
    thumbnail: toGameAssetPath(gameId, launcherThumbnail ?? startScreenImage),
    tags: normalizeTagList(launcher?.tags),
    chapterCount: chapterYamlPaths.length,
  };
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
};

await writeFile(outputPath, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');
console.log(`Generated ${outputPath} with ${games.length} game(s).`);
