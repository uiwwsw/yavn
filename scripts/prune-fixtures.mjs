/**
 * Keep rendering fixtures out of the deployed build.
 *
 * Remove rendering fixtures and their manifest entries from the production output.
 */
import { readFile, writeFile, rm, stat } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { isStory } from './story-catalog.mjs';

const distRoot = fileURLToPath(new URL('../dist/', import.meta.url));
const manifestPath = `${distRoot}game-list/index.json`;

const megabytes = (bytes) => `${(bytes / 1024 / 1024).toFixed(1)}MB`;

async function directorySize(path) {
  const { readdir } = await import('node:fs/promises');
  let total = 0;
  const entries = await readdir(path, { withFileTypes: true }).catch(() => []);
  for (const entry of entries) {
    const child = `${path}/${entry.name}`;
    if (entry.isDirectory()) total += await directorySize(child);
    else total += (await stat(child).catch(() => ({ size: 0 }))).size;
  }
  return total;
}

async function main() {
  let manifest;
  try {
    manifest = JSON.parse(await readFile(manifestPath, 'utf8'));
  } catch {
    console.log('No built manifest to prune.');
    return;
  }

  const games = Array.isArray(manifest.games) ? manifest.games : [];
  const fixtures = games.filter((game) => !isStory(game));
  if (fixtures.length === 0) {
    console.log('No fixtures in the manifest; nothing to prune.');
    return;
  }

  let freed = 0;
  for (const fixture of fixtures) {
    const folder = `${distRoot}game-list/${fixture.id}`;
    freed += await directorySize(folder);
    await rm(folder, { recursive: true, force: true });
  }

  manifest.games = games.filter(isStory);
  await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');

  const names = fixtures.map((fixture) => fixture.id).join(', ');
  console.log(`Left ${names} out of the deployment (${megabytes(freed)} smaller).`);
}

await main();
