#!/usr/bin/env node
// 작품을 장면 순서대로 읽을 수 있는 대본으로 뽑는다. 통독용이지 자동 판정이 아니다.
//
//   node scripts/export-script.mjs 360 > 360.txt
//
// 분기는 펼쳐서 전부 싣는다. 장면 이름과 들어오는 경로를 같이 적어서
// "여기는 어떻게 오는 데인가"를 읽으면서 알 수 있게 한다.

import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { load as parseYaml } from 'js-yaml';

const game = process.argv[2];
if (!game) {
  console.error('usage: node scripts/export-script.mjs <game-id>');
  process.exit(1);
}
const dir = path.join(process.cwd(), 'public', 'game-list', game);
const chapters = readdirSync(dir)
  .filter((f) => /^\d+\.yaml$/.test(f))
  .sort((a, b) => Number(a.split('.')[0]) - Number(b.split('.')[0]));

const bar = (ch) => '='.repeat(72) + `\n${ch}\n` + '='.repeat(72);

function renderAction(action, out, indent = '') {
  const [key] = Object.keys(action);
  const value = action[key];
  switch (key) {
    case 'say': {
      const who = value.char ?? (value.channel ? `#${value.channel}` : '#narration');
      const when = value.when ? `  <조건: ${JSON.stringify(value.when)}>` : '';
      out.push(`${indent}${who.padEnd(14)} ${value.text.replace(/\n/g, ' ⏎ ')}${when}`);
      if (value.continueLabel) out.push(`${indent}${''.padEnd(14)} [버튼: ${value.continueLabel}]`);
      break;
    }
    case 'choice': {
      out.push(`${indent}-- 선택 (${value.key ?? 'key없음'}) ${value.char ? `[${value.char}]` : ''}`);
      out.push(`${indent}   물음: ${value.prompt}`);
      for (const [i, o] of (value.options ?? []).entries()) {
        const to = o.goto ? ` → ${o.goto}` : o.gameOver ? ` → 게임오버: ${o.gameOver.title}` : '';
        out.push(`${indent}   ${i + 1}) ${o.text}${to}`);
        if (o.forgiveMessage) out.push(`${indent}      (되돌림: ${o.forgiveMessage})`);
      }
      break;
    }
    case 'input':
      out.push(`${indent}-- 입력: ${value.prompt}`);
      for (const e of value.errors ?? []) out.push(`${indent}   (틀림: ${e})`);
      break;
    case 'bg':
      if (typeof value === 'object' && value.place) out.push(`${indent}[때·곳] ${value.place}`);
      break;
    case 'place':
      out.push(`${indent}[때·곳] ${typeof value === 'string' ? value : value.text}`);
      break;
    case 'goto':
      out.push(`${indent}→→ ${value}`);
      break;
    case 'ending':
      out.push(`${indent}★ 결말: ${value}`);
      break;
    default:
      break;
  }
}

for (const file of chapters) {
  const doc = parseYaml(readFileSync(path.join(dir, file), 'utf8'));
  const out = [];
  out.push(bar(`${file}  ${doc.chapterTitle ?? ''}`));
  const scenes = doc.scenes ?? {};
  const order = [...(doc.script ?? []).map((s) => s.scene).filter(Boolean)];
  for (const name of Object.keys(scenes)) if (!order.includes(name)) order.push(name);
  for (const name of order) {
    const scene = scenes[name];
    if (!scene) continue;
    out.push('');
    out.push(`── ${name}${scene.title ? `  「${scene.title}」` : ''}`);
    for (const action of scene.actions ?? []) renderAction(action, out, '   ');
  }
  console.log(out.join('\n'));
  console.log('');
}
