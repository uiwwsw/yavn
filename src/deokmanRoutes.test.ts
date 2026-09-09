import { readFileSync } from 'node:fs';
import { load } from 'js-yaml';
import { describe, expect, it } from 'vitest';

// Read the shipped script, not a second hand-written ending formula. Each route
// starts at chapter one and must earn the state and objects used by its ending.
type Raw = Record<string, any>;
const read = (file: string): Raw => load(readFileSync(new URL(`../public/game-list/deokman/${file}.yaml`, import.meta.url), 'utf8')) as Raw;
const chapters = Array.from({ length: 12 }, (_, i) => read(String(i)));
const base = read('base');
const usual: Record<string, string> = {
  c1_peony_observation: 'observe_waterway', c1_answer_king: 'answer_scent', c1_fire_escape: 'escape_waterway',
  c2_identity: 'hidden_inquiry', c2_witness: 'save_witness', c2_checkpoint: 'turn_checkpoint',
  c3_proof: 'proof_memory', c3_sisters_strategy: 'public_sisters', c3_ambush: 'survive_together',
  c4_investigation: 'track_wagons', c4_grain_policy: 'public_distribution', c4_convoy: 'bait_ambush',
  c5_first_reply: 'answer_with_absence', c5_diplomacy: 'equal_exchange', c5_protocol: 'scentless_end',
  c6_find_time: 'calculate_eclipse', c6_eclipse_policy: 'announce_science', c6_eclipse_riot: 'count_down_return',
  c7_confession: 'public_confession', c7_first_power: 'restore_granary', c7_regency: 'open_council',
  c8_first_response: 'public_treatment', c8_public_story: 'sister_testimony', c8_cheonmyeong_fate: 'living_exile',
  c9_vote_strategy: 'negotiated_vote', c9_coup_response: 'split_defense', c9_crown_terms: 'coronation',
  c10_observatory_priority: 'granary_first', c10_knowledge_policy: 'public_calendar', c10_sabotage: 'tower_survives',
  c11_falling_star: 'inspect_kite', c11_bidam_answer: 'honest_letter', c11_rebellion_response: 'split_rebellion',
  c12_bidam_sentence: 'sentence_exile', c12_record_policy: 'records_public', c12_final_decree: 'judge_ending',
};
function play(overrides: Record<string, string> = {}, investigate = false) {
  const vars: Raw = { ...base.state }, inventory = new Set<string>(), inspected = new Set<string>();
  const attempts = new Map<string, number>(), choices: string[] = [];
  let chapter = 0, scene = chapters[0].script[0].scene;
  function matches(c?: Raw): boolean {
    if (!c) return true;
    if (c.all) return c.all.every(matches);
    if (c.any) return c.any.some(matches);
    if (c.not) return !matches(c.not);
    const actual = inventory.has(c.var) ? true : vars[c.var];
    switch (c.op ?? 'eq') {
      case 'eq': return actual === c.value;
      case 'ne': return actual !== c.value;
      case 'gte': return actual >= c.value;
      case 'lte': return actual <= c.value;
      case 'gt': return actual > c.value;
      case 'lt': return actual < c.value;
      default: throw Error(`Unsupported condition ${JSON.stringify(c)}`);
    }
  }
  const mutate = (a: Raw) => {
    if (a.get) inventory.add(typeof a.get === 'string' ? a.get : a.get.id);
    Object.assign(vars, a.set);
    for (const [key, value] of Object.entries(a.add ?? {})) vars[key] = Number(vars[key] ?? 0) + Number(value);
  };
  for (let step = 0; step < 500; step++) {
    const actions: Raw[] = chapters[chapter].scenes[scene]?.actions;
    expect(actions, `${chapter}:${scene}`).toBeDefined();
    let target = '';
    for (const a of actions) {
      if (!matches(a.when)) continue;
      expect(a.gameOver, `unexpected death ${chapter}:${scene}`).toBeUndefined();
      mutate(a);
      if (a.ending) return { ending: a.ending, vars, inventory, inspected, choices };
      if (a.choice) {
        const c = a.choice, options: Raw[] = c.options.filter((o: Raw) => matches(o.when));
        let wanted = overrides[c.key] ?? usual[c.key];
        const desk = options.find(o => /^evidence_(seals|ledger|token|kite)$/.test(o.goto));
        if (investigate && desk && !inspected.has(desk.goto)) {
          inspected.add(desk.goto); wanted = desk.goto;
        }
        if (c.key === 'first_room_look') wanted = !vars.opening_door_heard ? 'first_hear_door' : !vars.opening_name_read ? 'first_read_name' : 'opening_record';
        if (c.presentation === 'explore' && c.key.startsWith('evidence_')) {
          const id = c.key.replace(/_look$/, '');
          wanted = !vars[`${id}_seen_0`] ? `${id}_detail_0` : !vars[`${id}_seen_1`] ? `${id}_detail_1` : `${id}_deduce`;
        } else if (c.key.startsWith('evidence_')) {
          const count = attempts.get(c.key) ?? 0;
          attempts.set(c.key, count + 1);
          // An incorrect comparison must return safely; the second try solves it.
          wanted = `${c.key}_${count === 0 ? 'retry' : 'solved'}`;
        }
        const option = options.find(o => o.goto === wanted);
        expect(option, `${c.key} -> ${wanted}; state ${JSON.stringify(vars)}`).toBeDefined();
        mutate(option!); choices.push(c.key); target = option!.goto; break;
      }
      if (a.branch) { target = a.branch.cases.find((c: Raw) => matches(c.when))?.goto ?? a.branch.default; break; }
      if (a.goto) { target = a.goto; break; }
    }
    expect(target, `stalled ${chapter}:${scene}`).toBeTruthy();
    if (target.startsWith('/')) { chapter = Number(target.match(/\d+/)![0]); scene = chapters[chapter].script[0].scene; }
    else scene = target;
  }
  throw Error('Route failed to terminate');
}

const endings: Array<[string, Record<string, string>]> = [
  ['stars_belong_to_people', {}],
  ['merciful_queen', { c12_final_decree: 'bad_divided_guardians' }],
  ['iron_queen', { c12_bidam_sentence: 'sentence_execution', c12_final_decree: 'bad_strong_crown' }],
  ['borrowed_crown', { c9_crown_terms: 'bad_nobles_audit', c12_final_decree: 'bad_divided_guardians' }],
  ['empty_observatory', { c10_knowledge_policy: 'bidam_network' }],
  ['bidams_regent', { c6_eclipse_policy: 'stage_miracle', c10_knowledge_policy: 'bidam_network', c12_bidam_sentence: 'sentence_restored' }],
  ['sisters_shadow', { c8_cheonmyeong_fate: 'hidden_alive' }],
  ['recordless_peace', { c12_record_policy: 'records_burned' }],
  ['nameless_queen', { c12_bidam_sentence: 'sentence_execution', c12_record_policy: 'records_sealed', c12_final_decree: 'bad_divided_guardians' }],
  ['fallen_star', {
    c4_investigation: 'surround_warehouse', c4_grain_policy: 'grain_bargain', c5_diplomacy: 'secret_trade',
    c6_eclipse_policy: 'keep_secret', c7_confession: 'inherit_blame', c7_first_power: 'restore_records',
    c10_observatory_priority: 'stars_first', c11_rebellion_response: 'starve_command', c12_record_policy: 'records_sealed', c12_final_decree: 'bad_divided_guardians',
  }],
];
describe('Deokman complete playable routes', () => {
  it.each(['observe_absence', 'observe_back'])('keeps the escape available after %s', (observation) => {
    const result = play({ c1_peony_observation: observation });
    expect(result.vars.observed_left_waterway).toBe(true);
    expect(result.ending).toBe('stars_belong_to_people');
  });
  it.each(endings)('reaches %s through decisions earned across all twelve chapters', (ending, decisions) => {
    const result = play(decisions);
    expect(result.ending, JSON.stringify(result.vars)).toBe(ending);
  });
  it('retries all four comparisons without death or reward farming, collects twelve objects, and earns the hidden ending', () => {
    const result = play({}, true);
    expect(result.ending).toBe('hidden_constellation');
    expect(result.inspected.size).toBe(4);
    expect(result.inventory).toEqual(new Set(Object.keys(base.inventory)));
    for (const key of ['seals_linked', 'grain_verified', 'token_verified', 'kite_verified']) expect(result.vars[key]).toBe(true);
    // Investigating adds knowledge flags, never repeatable support/insight points.
    const ordinary = play();
    for (const key of ['people_support', 'insight', 'evidence', 'bidam_trust']) expect(result.vars[key]).toBe(ordinary.vars[key]);
  });
});
