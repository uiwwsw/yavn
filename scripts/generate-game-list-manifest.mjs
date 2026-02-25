import { mkdir, readdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

const workspaceRoot = process.cwd();
const gameListDir = path.join(workspaceRoot, 'public', 'game-list');
const outputPath = path.join(gameListDir, 'index.json');

const toTitle = (slug) =>
  slug
    .split(/[-_\s]+/)
    .filter(Boolean)
    .map((token) => token.charAt(0).toUpperCase() + token.slice(1))
    .join(' ');

async function collectGameFolders() {
  await mkdir(gameListDir, { recursive: true });
  const entries = await readdir(gameListDir, { withFileTypes: true });
  const folders = entries.filter((entry) => entry.isDirectory());

  const games = [];
  for (const folder of folders) {
    const gameDirPath = path.join(gameListDir, folder.name);
    const files = await readdir(gameDirPath, { withFileTypes: true });
    const hasYaml = files.some((file) => file.isFile() && /\.ya?ml$/i.test(file.name));
    if (!hasYaml) {
      continue;
    }
    games.push({
      id: folder.name,
      name: toTitle(folder.name),
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
