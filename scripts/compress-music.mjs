// Turns every freshly generated music WAV into FLAC and drops the WAV.
//
// The score generators (scripts/generate-*-score*.py) write 22.05 kHz mono WAV,
// about 1 MB per 24-second loop. Every Vercel deployment keeps its own copy of
// whatever sits in public/, so those megabytes are paid for once per deploy, not
// once. FLAC is lossless and gapless — the engine loops these tracks with
// `audio.loop = true`, so a lossy codec's encoder padding would put an audible
// hole in the music every 24 seconds — and it still cuts the files by ~68%.
//
// SFX stay WAV on purpose: they are already small and they fire repeatedly.
//
// Needs macOS `afconvert`. Run it after regenerating any score:
//   node scripts/compress-music.mjs

import { execFileSync } from 'node:child_process';
import { readdirSync, statSync, rmSync } from 'node:fs';
import path from 'node:path';

const gameListDir = path.join(process.cwd(), 'public', 'game-list');

function musicWavs() {
  const found = [];
  for (const game of readdirSync(gameListDir)) {
    const musicDir = path.join(gameListDir, game, 'assets', 'music');
    let entries;
    try {
      entries = readdirSync(musicDir);
    } catch {
      continue;
    }
    for (const name of entries) {
      if (name.toLowerCase().endsWith('.wav')) found.push(path.join(musicDir, name));
    }
  }
  return found;
}

const wavs = musicWavs();
if (wavs.length === 0) {
  console.log('[compress-music] No music WAV left to convert.');
  process.exit(0);
}

try {
  execFileSync('afconvert', ['--help'], { stdio: 'ignore' });
} catch {
  console.error('[compress-music] `afconvert` is missing. It ships with macOS; run this on a Mac.');
  process.exit(1);
}

let before = 0;
let after = 0;
for (const wav of wavs) {
  const flac = wav.replace(/\.wav$/i, '.flac');
  execFileSync('afconvert', ['-f', 'flac', '-d', 'flac', wav, flac], { stdio: 'inherit' });
  before += statSync(wav).size;
  after += statSync(flac).size;
  rmSync(wav);
  console.log(`[compress-music] ${path.relative(process.cwd(), flac)}`);
}

const mb = (bytes) => `${(bytes / 1024 / 1024).toFixed(2)} MB`;
console.log(`[compress-music] ${wavs.length} files · ${mb(before)} → ${mb(after)}`);
