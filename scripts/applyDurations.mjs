import { promises as fs } from 'fs';
import path from 'path';

const projectRoot = path.resolve(process.cwd());
const publicDir = path.join(projectRoot, 'public');

const assetAdjustments = new Map([
  ['emoji-relaxed', 40],
  ['emoji-smile', 20],
  ['emoji-sunrise', 25],
  ['emoji-leaf', 25],
  ['emoji-sparkle', 25],
  ['emoji-handshake', 15],
  ['emoji-star', 10],
  ['emoji-speech', 0],
  ['emoji-gear', -10],
  ['emoji-bolt', -35],
  ['emoji-fire', -35],
  ['emoji-rocket', -30],
  ['emoji-surprised', -25],
  ['emoji-muscle', -20],
]);

const calmPhrases = [/조용히/u, /천천히/u, /숨을/u, /잠시/u, /느리게/u, /잔잔히/u, /미소/u];
const urgentPhrases = [/빨리/u, /서둘러/u, /지금/u, /당장/u, /어서/u, /가자/u, /돌격/u];

const clamp = (value, min, max) => Math.min(Math.max(value, min), max);

const computeDuration = (message, asset) => {
  if (typeof message !== 'string' || message.length === 0) return 100;

  let duration = 100;
  const assetNames = asset ? (Array.isArray(asset) ? asset : [asset]) : [];
  for (const name of assetNames) {
    duration += assetAdjustments.get(name) ?? 0;
  }

  const trimmed = message.trim();
  const length = [...trimmed].length;

  if (/^\[.*\]$/.test(trimmed)) duration += 60;
  if (/^\(.*\)$/.test(trimmed)) duration += 30;

  const ellipsisMatches = message.match(/…|\.\.\.|\.\.|--/g);
  if (ellipsisMatches) duration += ellipsisMatches.length * 18;

  const exclamationMatches = message.match(/!/g);
  if (exclamationMatches) duration -= exclamationMatches.length * 15;

  const questionMatches = message.match(/\?/g);
  if (questionMatches) duration -= questionMatches.length * 5;

  for (const regex of calmPhrases) {
    if (regex.test(message)) {
      duration += 15;
      break;
    }
  }

  for (const regex of urgentPhrases) {
    if (regex.test(message)) {
      duration -= 15;
      break;
    }
  }

  if (length > 80) duration += 35;
  else if (length > 50) duration += 20;
  else if (length < 12) duration -= 10;
  if (length < 6) duration -= 5;

  if (/[A-Z]{3,}/.test(message)) duration -= 10;

  duration = Math.round(duration / 5) * 5;
  return clamp(duration, 60, 220);
};

const updateSentences = (node) => {
  if (!node || typeof node !== 'object') return node;
  if (!Array.isArray(node.sentences)) return node;

  const updated = node.sentences.map((group) => {
    if (!Array.isArray(group)) return group;
    return group.map((entry) => {
      if (!entry || typeof entry !== 'object') return entry;
      const duration = computeDuration(entry.message, entry.asset);
      return { ...entry, duration };
    });
  });

  return { ...node, sentences: updated };
};

const run = async () => {
  const files = await fs.readdir(publicDir);
  const chapterFiles = files
    .filter((file) => /^chapter\d+\.json$/.test(file))
    .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));

  for (const file of chapterFiles) {
    const fullPath = path.join(publicDir, file);
    const content = await fs.readFile(fullPath, 'utf8');
    const data = JSON.parse(content);
    const updatedData = data.map(updateSentences);
    await fs.writeFile(fullPath, JSON.stringify(updatedData, null, 2) + '\n', 'utf8');
  }
};

run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
