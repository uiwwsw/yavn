import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { load as parseYaml } from 'js-yaml';

const workspaceRoot = process.cwd();
const gameListDir = path.join(workspaceRoot, 'public', 'game-list');
const outputPath = path.join(gameListDir, 'index.json');

const toTitle = (slug) =>
  slug
    .split(/[-_\s]+/)
    .filter(Boolean)
    .map((token) => token.charAt(0).toUpperCase() + token.slice(1))
    .join(' ');

const pickRepresentativeYaml = (yamlNames) => {
  const numbered = yamlNames
    .map((name) => {
      const match = name.match(/^(\d+)\.ya?ml$/i);
      return match ? { name, order: Number(match[1]) } : null;
    })
    .filter((value) => value !== null)
    .sort((a, b) => a.order - b.order);
  if (numbered.length > 0) {
    return numbered[0].name;
  }

  const sampleYaml = yamlNames.find((name) => /^sample\.ya?ml$/i.test(name));
  if (sampleYaml) {
    return sampleYaml;
  }

  return [...yamlNames].sort((a, b) => a.localeCompare(b))[0];
};

async function resolveGameDisplayName(gameDirPath, gameId, chapterYamlNames) {
  const configPath = path.join(gameDirPath, 'config.yaml');
  try {
    const configText = await readFile(configPath, 'utf8');
    const config = parseYaml(configText);
    if (config && typeof config === 'object' && typeof config.title === 'string') {
      const title = config.title.trim();
      if (title.length > 0) {
        return title;
      }
    }
  } catch (error) {
    console.warn(`[game-list] Failed to parse ${gameId}/config.yaml:`, error);
  }

  const selectedYaml = pickRepresentativeYaml(chapterYamlNames);
  if (!selectedYaml) {
    return toTitle(gameId);
  }

  try {
    const yamlText = await readFile(path.join(gameDirPath, selectedYaml), 'utf8');
    const parsed = parseYaml(yamlText);
    if (parsed && typeof parsed === 'object') {
      const legacyMeta = parsed.meta;
      if (legacyMeta && typeof legacyMeta === 'object' && typeof legacyMeta.title === 'string') {
        const title = legacyMeta.title.trim();
        if (title.length > 0) {
          return title;
        }
      }
    }
  } catch (error) {
    console.warn(`[game-list] Failed to parse ${gameId}/${selectedYaml}:`, error);
  }

  return toTitle(gameId);
}

async function collectGameFolders() {
  await mkdir(gameListDir, { recursive: true });
  const entries = await readdir(gameListDir, { withFileTypes: true });
  const folders = entries.filter((entry) => entry.isDirectory());

  const games = [];
  for (const folder of folders) {
    const gameDirPath = path.join(gameListDir, folder.name);
    const files = await readdir(gameDirPath, { withFileTypes: true });
    const yamlNames = files.filter((file) => file.isFile() && /\.ya?ml$/i.test(file.name)).map((file) => file.name);
    const chapterYamlNames = yamlNames.filter((name) => !/^(config|base)\.ya?ml$/i.test(name));
    if (chapterYamlNames.length === 0) {
      continue;
    }
    const displayName = await resolveGameDisplayName(gameDirPath, folder.name, chapterYamlNames);
    games.push({
      id: folder.name,
      name: displayName,
      path: `/game-list/${encodeURIComponent(folder.name)}/`,
    });
  }

  games.sort((a, b) => a.name.localeCompare(b.name, 'ko'));
  return games;
}

const games = await collectGameFolders();
const manifest = {
  generatedAt: new Date().toISOString(),
  games,
};

await writeFile(outputPath, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');
console.log(`Generated ${outputPath} with ${games.length} game(s).`);
