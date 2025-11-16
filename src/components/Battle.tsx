import { useCallback, useEffect, useMemo, useState } from 'react';
import { BattleConfig, BattleEnemyConfig, BattleSkill, BattleStats } from '#/novelTypes';
import { getPartyDefinitions } from '#/battleData';

interface BattleProps {
  config: BattleConfig;
  onComplete: (result: 'win' | 'lose') => void;
  partyStats?: Record<string, BattleStats>;
}

interface CharacterState {
  name: string;
  hp: number;
  stats: BattleStats;
  skills: BattleSkill[];
  guard?: number;
  evade?: number;
}

interface EnemyState extends BattleEnemyConfig {
  hp: number;
}

const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));

const useBattleLog = (initial: string) => {
  const [log, setLog] = useState<string[]>([initial]);
  const pushLog = useCallback((entry: string) => {
    setLog((prev) => [...prev, entry].slice(-6));
  }, []);
  const reset = useCallback((message: string) => setLog([message]), []);
  return { log, pushLog, reset } as const;
};

const SKILL_TYPE_LABELS: Record<BattleSkill['type'], string> = {
  attack: '공격',
  heal: '회복',
  defend: '방어',
  evade: '회피',
};

const Battle = ({ config, onComplete, partyStats }: BattleProps) => {
  const partyDefinitions = useMemo(() => getPartyDefinitions(config.party, partyStats), [config.party, partyStats]);
  const [players, setPlayers] = useState<CharacterState[]>(() =>
    partyDefinitions.map((character) => ({
      name: character.name,
      stats: character.stats,
      skills: character.skills,
      hp: character.stats.maxHp,
      guard: undefined,
      evade: undefined,
    })),
  );
  const [enemy, setEnemy] = useState<EnemyState>({
    ...config.enemy,
    hp: config.enemy.stats.maxHp,
  });
  const [turn, setTurn] = useState<'player' | 'enemy'>('player');
  const { log, pushLog, reset: resetLog } = useBattleLog(config.encounter ?? `${config.enemy.name} 이(가) 나타났다!`);

  useEffect(() => {
    setPlayers(
      partyDefinitions.map((character) => ({
        name: character.name,
        stats: character.stats,
        skills: character.skills,
        hp: character.stats.maxHp,
        guard: undefined,
        evade: undefined,
      })),
    );
    setEnemy({ ...config.enemy, hp: config.enemy.stats.maxHp });
    setTurn('player');
    resetLog(config.encounter ?? `${config.enemy.name} 이(가) 나타났다!`);
  }, [config, config.enemy, config.encounter, partyDefinitions, resetLog]);

  const activePlayerIndex = useMemo(() => players.findIndex((character) => character.hp > 0), [players]);
  const activePlayer = activePlayerIndex >= 0 ? players[activePlayerIndex] : undefined;

  const calculateDamage = useCallback(
    (attackerAttack: number, skillPower: number, targetDefense: number) => Math.max(1, attackerAttack + skillPower - targetDefense),
    [],
  );

  const handlePlayerSkill = useCallback(
    (skill: BattleSkill) => {
      if (!activePlayer || turn !== 'player') return;

      if (skill.type === 'heal') {
        setPlayers((prev) =>
          prev.map((character, index) => {
            if (index !== activePlayerIndex) return character;
            const nextHp = clamp(character.hp + skill.power, 0, character.stats.maxHp);
            if (nextHp !== character.hp) {
              pushLog(`${character.name}이 ${skill.name}으로 ${nextHp - character.hp} 회복!`);
            }
            return { ...character, hp: nextHp };
          }),
        );
        setTurn('enemy');
        return;
      }

      if (skill.type === 'defend') {
        setPlayers((prev) =>
          prev.map((character, index) =>
            index === activePlayerIndex ? { ...character, guard: skill.power } : character,
          ),
        );
        pushLog(`${activePlayer.name}이 ${skill.name}으로 방어 태세를 갖췄습니다.`);
        setTurn('enemy');
        return;
      }

      if (skill.type === 'evade') {
        setPlayers((prev) =>
          prev.map((character, index) =>
            index === activePlayerIndex ? { ...character, evade: skill.power } : character,
          ),
        );
        pushLog(`${activePlayer.name}이 ${skill.name}으로 회피를 준비합니다.`);
        setTurn('enemy');
        return;
      }

      setEnemy((prev) => {
        const damage = calculateDamage(activePlayer.stats.attack, skill.power, prev.stats.defense);
        const nextHp = clamp(prev.hp - damage, 0, prev.stats.maxHp);
        pushLog(`${activePlayer.name}의 ${skill.name}! ${prev.name}에게 ${damage} 피해.`);
        return { ...prev, hp: nextHp };
      });
      setTurn('enemy');
    },
    [activePlayer, turn, activePlayerIndex, pushLog, calculateDamage],
  );

  useEffect(() => {
    if (turn !== 'enemy') return;
    if (enemy.hp <= 0) return;

    const timeout = window.setTimeout(() => {
      const skillList = enemy.skills ?? [
        { id: 'enemy-strike', name: '글리치 스트라이크', description: '', power: 6, type: 'attack' as const },
      ];
      const skill = skillList[Math.floor(Math.random() * skillList.length)];

      if (skill.type === 'heal') {
        let healed = 0;
        setEnemy((prevEnemy) => {
          const nextHp = clamp(prevEnemy.hp + skill.power, 0, prevEnemy.stats.maxHp);
          healed = nextHp - prevEnemy.hp;
          return { ...prevEnemy, hp: nextHp };
        });
        pushLog(`${enemy.name}의 ${skill.name}! ${healed > 0 ? `${enemy.name}이 ${healed} 회복했다.` : '효과가 없다.'}`);
        setTurn('player');
        return;
      }

      let detailText = '';
      setPlayers((prev) => {
        const alive = prev.filter((character) => character.hp > 0);
        if (!alive.length) {
          detailText = '공격할 대상이 없습니다.';
          return prev;
        }
        const target = alive[Math.floor(Math.random() * alive.length)];
        const targetIndex = prev.findIndex((character) => character.name === target.name);

        return prev.map((character, index) => {
          if (index !== targetIndex) return character;
          const messages: string[] = [];
          let damage = calculateDamage(enemy.stats.attack, skill.power, character.stats.defense);
          let guardValue = character.guard;
          let evadeValue = character.evade;

          if (evadeValue) {
            const success = Math.random() * 100 < evadeValue;
            messages.push(success ? `${character.name}이 회피에 성공했다!` : `${character.name}의 회피 시도가 실패했다.`);
            if (success) {
              damage = 0;
            }
            evadeValue = undefined;
          }

          if (damage > 0 && guardValue) {
            const reduced = Math.max(1, Math.round(damage * (1 - guardValue / 100)));
            if (reduced !== damage) {
              messages.push(`${character.name}이 방어 태세로 피해를 ${damage - reduced} 감소시켰다.`);
            }
            damage = reduced;
            guardValue = undefined;
          }

          if (damage > 0) {
            messages.push(`${character.name}이 ${damage} 피해를 입었다.`);
          }

          detailText = messages.join(' ') || `${character.name}에게 영향이 없다.`;

          return {
            ...character,
            guard: guardValue,
            evade: evadeValue,
            hp: clamp(character.hp - damage, 0, character.stats.maxHp),
          };
        });
      });
      pushLog(`${enemy.name}의 ${skill.name}! ${detailText}`.trim());
      setTurn('player');
    }, 650);

    return () => window.clearTimeout(timeout);
  }, [turn, enemy, pushLog, calculateDamage]);

  useEffect(() => {
    if (enemy.hp > 0) return;
    const timeout = window.setTimeout(() => onComplete('win'), 600);
    return () => window.clearTimeout(timeout);
  }, [enemy.hp, onComplete]);

  useEffect(() => {
    if (players.some((character) => character.hp > 0)) return;
    const timeout = window.setTimeout(() => onComplete('lose'), 600);
    return () => window.clearTimeout(timeout);
  }, [players, onComplete]);

  const enemyHpPercent = Math.round((enemy.hp / enemy.stats.maxHp) * 100);
  const enemySkillList = useMemo<BattleSkill[]>(
    () =>
      enemy.skills ?? [
        { id: 'enemy-strike', name: '글리치 스트라이크', description: '예측 불가능한 기본 공격.', power: 6, type: 'attack' },
      ],
    [enemy.skills],
  );

  return (
    <div className="flex h-full flex-col justify-between bg-slate-950 text-white">
      <div className="flex flex-1 flex-col gap-4 p-6">
        <div>
          <p className="text-xs uppercase tracking-[0.35em] text-emerald-300">Battle</p>
          <h2 className="text-2xl font-semibold">{config.description ?? '시스템 교란체를 포착했습니다.'}</h2>
          <p className="text-sm text-slate-300">
            {turn === 'player' ? '스킬을 선택하여 공격하세요.' : '적의 행동을 기다리는 중입니다.'}
          </p>
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
            <p className="text-xs uppercase text-slate-400">Enemy</p>
            <h3 className="text-xl font-semibold">{enemy.name}</h3>
            <div className="mt-3 h-3 rounded-full bg-white/10">
              <div
                className="h-full rounded-full bg-red-400"
                style={{ width: `${enemyHpPercent}%` }}
              />
            </div>
            <p className="mt-2 text-sm text-slate-300">HP {enemy.hp} / {enemy.stats.maxHp}</p>
            <div className="mt-3 grid grid-cols-2 gap-2 text-xs text-slate-300">
              <div className="flex items-center justify-between">
                <span>공격</span>
                <span>{enemy.stats.attack}</span>
              </div>
              <div className="flex items-center justify-between">
                <span>방어</span>
                <span>{enemy.stats.defense}</span>
              </div>
              <div className="flex items-center justify-between">
                <span>속도</span>
                <span>{enemy.stats.speed}</span>
              </div>
            </div>
            <div className="mt-4 rounded-2xl border border-white/5 bg-black/20 p-3 text-sm text-slate-200">
              <p className="text-xs uppercase text-slate-400">스킬</p>
              <ul className="mt-2 space-y-2 text-xs text-slate-300">
                {enemySkillList.map((skill) => (
                  <li key={skill.id} className="rounded-xl bg-slate-900/40 p-3">
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-white">{skill.name}</span>
                      <span className="text-[11px] text-emerald-200">{SKILL_TYPE_LABELS[skill.type]}</span>
                    </div>
                    <p className="text-[11px] text-slate-400">{skill.description}</p>
                  </li>
                ))}
              </ul>
            </div>
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
            <p className="text-xs uppercase text-slate-400">Party</p>
            <div className="mt-2 flex flex-col gap-3">
              {players.map((character) => {
                const percent = Math.round((character.hp / character.stats.maxHp) * 100);
                return (
                  <div key={character.name} className="rounded-xl border border-white/5 bg-slate-900/60 p-3">
                    <div className="flex items-center justify-between">
                      <span className="font-semibold">{character.name}</span>
                      <span className="text-sm text-slate-300">
                        HP {character.hp} / {character.stats.maxHp}
                      </span>
                    </div>
                    <div className="mt-2 h-2 rounded-full bg-white/10">
                      <div
                        className="h-full rounded-full bg-emerald-400"
                        style={{ width: `${percent}%` }}
                      />
                    </div>
                    <dl className="mt-3 grid grid-cols-2 gap-2 text-[11px] text-slate-300">
                      <div className="flex items-center justify-between">
                        <dt>공격</dt>
                        <dd>{character.stats.attack}</dd>
                      </div>
                      <div className="flex items-center justify-between">
                        <dt>방어</dt>
                        <dd>{character.stats.defense}</dd>
                      </div>
                      <div className="flex items-center justify-between">
                        <dt>속도</dt>
                        <dd>{character.stats.speed}</dd>
                      </div>
                    </dl>
                    {(character.guard || character.evade) && (
                      <div className="mt-2 flex flex-wrap gap-2 text-[11px]">
                        {character.guard && (
                          <span className="rounded-full bg-amber-500/20 px-2 py-0.5 text-amber-200">방어 {character.guard}%</span>
                        )}
                        {character.evade && (
                          <span className="rounded-full bg-sky-500/20 px-2 py-0.5 text-sky-200">회피 {character.evade}%</span>
                        )}
                      </div>
                    )}
                    <div className="mt-3 text-[11px] text-slate-300">
                      <p className="text-[10px] uppercase tracking-widest text-slate-500">보유 스킬</p>
                      <div className="mt-1 flex flex-wrap gap-2">
                        {character.skills.map((skill) => (
                          <span key={skill.id} className="rounded-full bg-white/10 px-2 py-1 text-white/80">
                            {skill.name} ({SKILL_TYPE_LABELS[skill.type]})
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
        <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
          <p className="text-xs uppercase text-slate-400">Active Skills</p>
          {activePlayer ? (
            <div className="mt-3 grid gap-3 md:grid-cols-2">
              {activePlayer.skills.map((skill) => (
                <button
                  key={skill.id}
                  className="rounded-xl border border-white/10 bg-slate-900/70 px-4 py-3 text-left text-sm transition hover:border-emerald-300 hover:bg-emerald-500/10 disabled:cursor-not-allowed disabled:opacity-60"
                  disabled={turn !== 'player' || enemy.hp <= 0}
                  onClick={() => handlePlayerSkill(skill)}
                >
                  <div className="flex items-center justify-between gap-2">
                    <p className="font-semibold">{skill.name}</p>
                    <span className="text-[11px] text-emerald-200">{SKILL_TYPE_LABELS[skill.type]}</span>
                  </div>
                  <p className="text-xs text-slate-300">{skill.description}</p>
                </button>
              ))}
            </div>
          ) : (
            <p className="mt-3 text-sm text-slate-300">행동 가능한 캐릭터가 없습니다.</p>
          )}
        </div>
        <div className="rounded-2xl border border-white/10 bg-black/30 p-4">
          <p className="text-xs uppercase text-slate-400">Battle Log</p>
          <ul className="mt-2 space-y-1 text-sm text-slate-200">
            {log.map((entry, index) => (
              <li key={`${entry}-${index}`}>{entry}</li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
};

export default Battle;
