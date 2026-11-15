/**
 * Keep rendering fixtures out of the deployed build.
 *
 * live2dtest is the official Live2D sample. It exists so a rendering change can be checked
 * against something authored by the people who wrote the runtime, which means it has to stay
 * in the repository and be servable by `npm run dev`. It does not have to be uploaded on every
 * deployment: it is 6.2MB of textures and motion data, a quarter of the whole build output, and
 * Vercel keeps every deployment until the storage policy collects it.
 *
 * So the fixture ships to the dev server and stops at the build: this removes its files from
 * dist and its entry from the deployed manifest. Nothing under public/ changes, so the fixture
 * is still one `npm run dev` away.
 *
 * Which ids count as fixtures is story-catalog's call, not this script's.
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
