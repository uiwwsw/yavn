#!/usr/bin/env node
// 대사 말투 측정기. docs/DIALOGUE_AI_TONE.ko.md의 판정 기준을 수치로 뽑는다.
//
//   node scripts/dialogue-tone-report.mjs              모든 작품
//   node scripts/dialogue-tone-report.mjs muwon 360    고른 작품만
//   node scripts/dialogue-tone-report.mjs --json       기계가 읽을 형태로
//   node scripts/dialogue-tone-report.mjs --lines muwon  기준을 넘긴 줄을 함께 출력
//
// 이 스크립트는 판정을 돕는 자료만 만든다. 통과·실패를 선언하지 않는다.
// 수치가 기준을 벗어난 줄을 직접 읽고 사람이 판단한다.

import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { load as parseYaml } from 'js-yaml';

const GAME_LIST_DIR = path.join(process.cwd(), 'public', 'game-list');
const SKIPPED_GAMES = new Set(['live2dtest']);

// docs/DIALOGUE_AI_TONE.ko.md가 정한 기준선. 넘기면 그 줄을 읽어 보라는 뜻이다.
// 짧은 발화와 군말은 어느 한쪽으로 몰려도 괜찮으므로 둘을 합친 값만 본다.
const THRESHOLDS = {
  packedRatio: { limit: 0.15, direction: 'max' },
  humanTrace: { limit: 0.2, direction: 'min' },
  speakerRatio: { limit: 1.8, direction: 'min' },
  stageDeviation: { limit: 9, direction: 'min' },
};

// 군말·간투사. 사람 말에는 있고 AI 대사에는 없다.
const FILLER = /(^|[\s"'“”…,.!?])(어|음|아|야|자|뭐|좀|막|참|에이|어휴|아휴|흠|글쎄|저기|있잖|그게|그니까|그러니까|하여튼|암튼|아니|네네|예예)([\s,.…?!"'“”]|$)/;

function listGames() {
  return readdirSync(GAME_LIST_DIR, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && !SKIPPED_GAMES.has(entry.name))
    .map((entry) => entry.name)
    .sort();
}

function collectTexts(game) {
  const dir = path.join(GAME_LIST_DIR, game);
  const files = readdirSync(dir).filter((name) => name.endsWith('.yaml')).sort();
  const lines = [];

  const push = (file, kind, speaker, text) => {
    if (typeof text === 'string' && text.trim()) lines.push({ file, kind, speaker, text });
  };

  const walk = (node, file) => {
    if (node === null || typeof node !== 'object') return;
    if (Array.isArray(node)) {
      node.forEach((child) => walk(child, file));
      return;
    }
    for (const [key, value] of Object.entries(node)) {
      if (key === 'say' && value && typeof value === 'object') {
        push(file, 'say', value.char ?? `#${value.channel ?? 'narration'}`, value.text);
        push(file, 'continueLabel', '-', value.continueLabel);
        continue;
      }
      if (key === 'choice' && value && typeof value === 'object') {
        push(file, 'choicePrompt', value.char ?? '#narration', value.prompt);
        for (const option of value.options ?? []) {
          push(file, 'option', '-', option.text);
          push(file, 'forgive', '-', option.forgiveMessage);
          push(file, 'gameOver', '-', option.gameOver?.message);
        }
        push(file, 'forgive', '-', value.forgiveMessage);
        continue;
      }
      if (key === 'input' && value && typeof value === 'object') {
        push(file, 'inputPrompt', value.char ?? '#narration', value.prompt);
        for (const error of value.errors ?? []) push(file, 'inputError', '-', error);
        continue;
      }
      walk(value, file);
    }
  };

  for (const file of files) {
    walk(parseYaml(readFileSync(path.join(dir, file), 'utf8')), `${game}/${file}`);
  }
  return lines;
}

const sentenceCount = (text) => (text.replace(/\n/g, ' ').match(/[.?!](\s|$)/g) ?? []).length || 1;
const isCharacter = (line) => !line.speaker.startsWith('#') && line.speaker !== '-';
const baseName = (speaker) => speaker.replace(/\..*$/, '');
const mean = (values) => values.reduce((sum, value) => sum + value, 0) / values.length;

function measure(game) {
  const lines = collectTexts(game);
  const bubbles = lines.filter((line) => line.kind === 'say' || line.kind === 'choicePrompt');
  const spoken = bubbles.filter(isCharacter);
  const stage = bubbles.filter((line) => /^#(action|narration|thought)/.test(line.speaker));

  const bySpeaker = new Map();
  for (const line of spoken) {
    const name = baseName(line.speaker);
    if (!bySpeaker.has(name)) bySpeaker.set(name, []);
    bySpeaker.get(name).push(line.text.length);
  }
  const speakerMeans = [...bySpeaker.entries()]
    .filter(([, lengths]) => lengths.length >= 10)
    .map(([name, lengths]) => ({ name, count: lengths.length, mean: mean(lengths) }))
    .sort((a, b) => a.mean - b.mean);

  const stageLengths = stage.map((line) => line.text.length);
  const stageMean = stageLengths.length ? mean(stageLengths) : 0;

  const packed = bubbles.filter((line) => sentenceCount(line.text) >= 3);
  const short = spoken.filter((line) => line.text.length <= 8);
  const filler = spoken.filter((line) => FILLER.test(line.text));

  return {
    game,
    totals: { lines: lines.length, bubbles: bubbles.length, spoken: spoken.length, stage: stage.length },
    packedRatio: bubbles.length ? packed.length / bubbles.length : 0,
    shortRatio: spoken.length ? short.length / spoken.length : 0,
    fillerRatio: spoken.length ? filler.length / spoken.length : 0,
    humanTrace: spoken.length ? (short.length + filler.length) / spoken.length : 0,
    speakerRatio: speakerMeans.length >= 2 ? speakerMeans.at(-1).mean / speakerMeans[0].mean : 1,
    bubbleMean: spoken.length ? mean(spoken.map((line) => line.text.length)) : 0,
    stageMean,
    stageDeviation: stageLengths.length
      ? Math.sqrt(mean(stageLengths.map((length) => (length - stageMean) ** 2)))
      : 0,
    speakerMeans,
    samples: { packed, short, filler },
  };
}

function flag(key, value) {
  const rule = THRESHOLDS[key];
  if (!rule) return ' ';
  const off = rule.direction === 'max' ? value > rule.limit : value < rule.limit;
  return off ? '!' : ' ';
}

const pct = (value) => `${(value * 100).toFixed(0)}%`;
const pad = (value, width) => String(value).padStart(width);

function printTable(reports) {
  const rows = [
    ['대사·지문 총수', (r) => pad(r.totals.lines, 6), null],
    ['인물 발화 수', (r) => pad(r.totals.spoken, 6), null],
    ['발화당 평균 글자', (r) => pad(r.bubbleMean.toFixed(1), 6), null],
    ['완결문 3개↑ 말풍선', (r) => pad(pct(r.packedRatio), 5) + flag('packedRatio', r.packedRatio), '15% 이하'],
    ['8자 이하 발화', (r) => pad(pct(r.shortRatio), 6), null],
    ['군말 포함 발화', (r) => pad(pct(r.fillerRatio), 6), null],
    ['└ 사람 흔적 합', (r) => pad(pct(r.humanTrace), 5) + flag('humanTrace', r.humanTrace), '20% 이상'],
    ['화자 길이 배수', (r) => pad(`${r.speakerRatio.toFixed(2)}배`, 5) + flag('speakerRatio', r.speakerRatio), '1.8배 이상'],
    ['지문 길이 σ', (r) => pad(r.stageDeviation.toFixed(1), 5) + flag('stageDeviation', r.stageDeviation), 'σ 9 이상'],
  ];
  const nameWidth = Math.max(...rows.map(([label]) => label.length)) + 2;
  const header = ' '.repeat(nameWidth) + reports.map((r) => pad(r.game, 13)).join('') + '   기준';
  console.log(header);
  console.log('-'.repeat(header.length));
  for (const [label, render, rule] of rows) {
    const cells = reports.map((r) => pad(render(r), 13)).join('');
    console.log(label.padEnd(nameWidth) + cells + (rule ? `   ${rule}` : ''));
  }
  console.log('\n! 가 붙은 칸은 기준을 벗어났다는 뜻이다. 그 줄을 직접 읽어 보라는 신호이고, 자동 판정이 아니다.');
}

function printLines(report) {
  const sections = [
    ['완결문 3개 이상 — 한 말풍선에 너무 많이 담았다', report.samples.packed],
    ['8자 이하 — 짧은 받아치기 (많아야 좋다)', report.samples.short],
  ];
  for (const [title, lines] of sections) {
    console.log(`\n### [${report.game}] ${title} · ${lines.length}건`);
    for (const line of lines) console.log(`  ${line.file} ${line.speaker}: ${line.text.replace(/\n/g, ' / ')}`);
  }
  console.log(`\n### [${report.game}] 화자별 평균 발화 길이 (10회 이상)`);
  for (const speaker of report.speakerMeans) {
    console.log(`  ${speaker.name.padEnd(12)} n=${pad(speaker.count, 4)}  평균 ${speaker.mean.toFixed(1)}자`);
  }
}

const args = process.argv.slice(2);
const asJson = args.includes('--json');
const withLines = args.includes('--lines');
const requested = args.filter((arg) => !arg.startsWith('--'));
const games = requested.length ? requested : listGames();
const reports = games.map(measure);

if (asJson) {
  console.log(JSON.stringify(reports.map(({ samples, ...rest }) => rest), null, 2));
} else {
  printTable(reports);
  if (withLines) reports.forEach(printLines);
}
