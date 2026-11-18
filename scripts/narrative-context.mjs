#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import yaml from 'js-yaml';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = p => yaml.load(fs.readFileSync(path.join(root, p), 'utf8'));
const args = process.argv.slice(2);
const option = name => { const i = args.indexOf(name); return i < 0 ? undefined : args[i + 1]; };
const ids = fs.readdirSync(path.join(root, 'docs/narrative')).filter(p => p.endsWith('.yaml')).map(p => p.slice(0, -5)).sort();
const errors = [];
const need = (ok, message) => { if (!ok) errors.push(message); };
const manifests = new Map();
for (const id of ids) {
  const data = read(`docs/narrative/${id}.yaml`);
  const base = read(`public/game-list/${id}/base.yaml`);
  const chapters = Array.from({ length: 5 }, (_, n) => read(`public/game-list/${id}/${n}.yaml`));
  const sceneAt = ref => { const [n, ...parts] = ref.split('/'); return chapters[Number(n)]?.scenes?.[parts.join('/')]; };
  const aliases = new Map();
  const voices = new Map();
  need(data.schemaVersion === 1 && data.gameId === id, `${id}: invalid identity`);
  need(Object.keys(data.characters ?? {}).length > 0, `${id}: no characters`);
  need(data.relationships?.length > 0, `${id}: no relationships`);
  need(Object.keys(data.scenes ?? {}).length > 0, `${id}: no scene contexts`);
  for (const [key, card] of Object.entries(data.characters ?? {})) {
    for (const field of ['name', 'role', 'desire', 'fear', 'contradiction', 'dailyLife', 'voice'])
      need(typeof card[field] === 'string' && card[field].trim(), `${id}/${key}: missing ${field}`);
    for (const asset of card.assetIds ?? []) {
      need(Boolean(base.assets.characters[asset]), `${id}/${key}: unknown character asset ${asset}`);
      need(!aliases.has(asset), `${id}: duplicate alias ${asset}`); aliases.set(asset, key);
    }
    for (const voice of card.speakerNames ?? []) { need(!voices.has(voice), `${id}: duplicate voice ${voice}`); voices.set(voice, key); }
  }
  for (const asset of Object.keys(base.assets.characters)) need(aliases.has(asset), `${id}: no card for ${asset}`);
  const relations = new Map();
  for (const relation of data.relationships ?? []) {
    need(!relations.has(relation.id), `${id}: duplicate relationship ${relation.id}`); relations.set(relation.id, relation);
    need(relation.participants?.length === 2 && new Set(relation.participants).size === 2, `${id}/${relation.id}: needs two distinct people`);
    for (const person of relation.participants ?? []) {
      need(Boolean(data.characters[person]), `${id}/${relation.id}: unknown person ${person}`);
      need(Boolean(relation.perspectives?.[person]?.seesOtherAs && relation.perspectives?.[person]?.address), `${id}/${relation.id}: missing perspective ${person}`);
    }
    need(Boolean(relation.history && relation.friction), `${id}/${relation.id}: missing relationship history or conflict`);
  }
  for (const [ref, context] of Object.entries(data.scenes ?? {})) {
    need(Boolean(sceneAt(ref)), `${id}: unknown scene ${ref}`);
    for (const person of [...(context.participants ?? []), ...(context.referenced ?? [])]) need(Boolean(data.characters[person]), `${id}/${ref}: unknown person ${person}`);
    for (const relation of context.relations ?? []) {
      need(relations.has(relation), `${id}/${ref}: unknown relationship ${relation}`);
      for (const person of relations.get(relation)?.participants ?? []) need([...context.participants, ...(context.referenced ?? [])].includes(person), `${id}/${ref}: missing relationship participant ${person}`);
    }
    for (const field of ['before', 'exchange', 'avoid', 'gesture']) need(Boolean(context[field]), `${id}/${ref}: missing ${field}`);
    for (const branch of context.branches ?? []) {
      need(typeof branch.when?.var === 'string' && branch.when.var.length > 0, `${id}/${ref}: missing branch variable`);
      need(['eq', 'gte'].includes(branch.when?.op), `${id}/${ref}: unsupported branch operation`);
      need(Object.hasOwn(branch.when ?? {}, 'value') && typeof branch.fact === 'string' && branch.fact.trim(), `${id}/${ref}: incomplete branch fact`);
    }
    if (context.illustration) need(fs.existsSync(path.join(root, 'public/game-list', id, context.illustration)), `${id}/${ref}: missing illustration`);
  }
  for (const chapter of chapters) for (const scene of Object.values(chapter.scenes)) for (const action of scene.actions) {
    if (action.say?.char) need(aliases.has(action.say.char.split('.')[0]), `${id}: missing speaker card ${action.say.char}`);
    else if (action.say?.speakerName) need(voices.has(action.say.speakerName), `${id}: missing voice card ${action.say.speakerName}`);
  }
  manifests.set(id, { data, chapters, sceneAt, aliases, voices });
}
if (errors.length) { console.error([...new Set(errors)].join('\n')); process.exit(1); }
if (args.includes('--check')) {
  for (const [id, { data }] of manifests) console.log(`${id}: ${Object.keys(data.characters).length} people, ${data.relationships.length} relationships, ${Object.keys(data.scenes).length} scene contexts; references valid`);
} else if (args.includes('--graph')) {
  console.log('# 작품별 인물 관계\n\n작가용 관계도. 화살표는 상대를 보는 시선이며 모든 간선이 실제 대화를 뜻하지는 않는다.\n');
  for (const [id, { data }] of manifests) {
    console.log(`## ${id}\n\n[인물 카드·관계 원본](${id}.yaml)\n\n\`\`\`mermaid\ngraph LR`);
    const names = new Map(Object.keys(data.characters).map((key, i) => [key, `p${i}`]));
    for (const [key, card] of Object.entries(data.characters)) console.log(`  ${names.get(key)}["${card.name.replaceAll('"', '')}"]`);
    for (const r of data.relationships) {
      const [a,b] = r.participants;
      console.log(`  ${names.get(a)} -->|"${r.perspectives[a].seesOtherAs.replaceAll('"', '')}"| ${names.get(b)}`);
      console.log(`  ${names.get(b)} -->|"${r.perspectives[b].seesOtherAs.replaceAll('"', '')}"| ${names.get(a)}`);
    }
    console.log('```' + (id === ids.at(-1) ? '' : '\n'));
  }
} else {
  const id = option('--game'), ref = option('--scene');
  if (!manifests.has(id) || !ref) { console.error('Usage: node scripts/narrative-context.mjs --check | --graph | --game GAME --scene CHAPTER/SCENE [--vars JSON]'); process.exit(1); }
  const { data, sceneAt, aliases, voices } = manifests.get(id);
  const scene = sceneAt(ref); if (!scene) throw new Error(`Unknown scene ${id}/${ref}`);
  const context = data.scenes?.[ref];
  const sourceSpeakers = scene.actions.flatMap(a => a.say ? [aliases.get(a.say.char?.split('.')[0]) ?? voices.get(a.say.speakerName)] : []).filter(Boolean);
  const people = new Set([...(context?.participants ?? []), ...(context?.referenced ?? []), ...sourceSpeakers]);
  const variables = option('--vars') ? JSON.parse(option('--vars')) : {};
  if (!variables || Array.isArray(variables) || typeof variables !== 'object') throw new Error('--vars must be a JSON object');
  const facts = (context?.branches ?? []).map(branch => ({ ...branch, status: !(branch.when.var in variables) ? 'unknown' : (branch.when.op === 'eq' ? variables[branch.when.var] === branch.when.value : branch.when.op === 'gte' ? variables[branch.when.var] >= branch.when.value : false) ? 'applies' : 'does-not-apply' }));
  console.log(JSON.stringify({ gameId: id, scene: ref, authorOnlyFacts: data.authorOnlyFacts, context: context ?? null, branchFacts: facts,
    characters: Object.fromEntries([...people].map(k => [k, data.characters[k]])),
    relationships: data.relationships.filter(r => r.participants.every(p => people.has(p))),
    turns: scene.actions.flatMap((a, index) => a.say ? [{ index, person: aliases.get(a.say.char?.split('.')[0]) ?? voices.get(a.say.speakerName), ...a.say }] : a.choice ? [{ index, choice: a.choice }] : []),
  }, null, 2));
}
