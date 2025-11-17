import { useCallback, useEffect, useMemo, useState } from 'react';
import { BattleConfig, BattleEnemyConfig, BattleSkill, BattleStats } from '#/novelTypes';
import { getPartyDefinitions } from '#/battleData';

interface BattleProps {
  config: BattleConfig;
  onComplete: (result: 'win' | 'lose') => void;
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

const getNextAlive = (characters: CharacterState[], afterIndex = -1) => {
  for (let i = afterIndex + 1; i < characters.length; i += 1) {
    if (characters[i].hp > 0) return i;
  }
  return -1;
};

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

const Battle = ({ config, onComplete }: BattleProps) => {
  const partyDefinitions = useMemo(() => getPartyDefinitions(config.party), [config.party]);
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
  const [phase, setPhase] = useState<'player' | 'enemy'>('player');
  const [activePlayerIndex, setActivePlayerIndex] = useState<number | null>(() =>
    getNextAlive(
      partyDefinitions.map((character) => ({
        name: character.name,
        stats: character.stats,
        skills: character.skills,
        hp: character.stats.maxHp,
      } as CharacterState)),
    ),
  );
  const { log, pushLog, reset: resetLog } = useBattleLog(config.encounter ?? `${config.enemy.name} 이(가) 나타났다!`);

  useEffect(() => {
    const nextPlayers = partyDefinitions.map((character) => ({
      name: character.name,
      stats: character.stats,
      skills: character.skills,
      hp: character.stats.maxHp,
      guard: undefined,
      evade: undefined,
    }));
    setPlayers(nextPlayers);
    setEnemy({ ...config.enemy, hp: config.enemy.stats.maxHp });
    setPhase('player');
    setActivePlayerIndex(getNextAlive(nextPlayers));
    resetLog(config.encounter ?? `${config.enemy.name} 이(가) 나타났다!`);
  }, [config, config.enemy, config.encounter, partyDefinitions, resetLog]);

  const activePlayer = activePlayerIndex !== null && activePlayerIndex >= 0 ? players[activePlayerIndex] : undefined;

  const advancePlayerTurn = useCallback(
    (nextPlayers: CharacterState[]) => {
      const nextIndex = activePlayerIndex === null ? getNextAlive(nextPlayers) : getNextAlive(nextPlayers, activePlayerIndex);
      if (nextIndex === -1) {
        setPhase('enemy');
        setActivePlayerIndex(null);
        return;
      }
      setActivePlayerIndex(nextIndex);
    },
    [activePlayerIndex],
  );

  const calculateDamage = useCallback(
    (attackerAttack: number, skillPower: number, targetDefense: number) => Math.max(1, attackerAttack + skillPower - targetDefense),
    [],
  );

  const handlePlayerSkill = useCallback(
    (skill: BattleSkill) => {
      if (!activePlayer || activePlayerIndex === null || phase !== 'player') return;

      if (skill.type === 'heal') {
        let updated: CharacterState[] = [];
        setPlayers((prev) => {
          updated = prev.map((character, index) => {
            if (index !== activePlayerIndex) return character;
            const nextHp = clamp(character.hp + skill.power, 0, character.stats.maxHp);
            if (nextHp !== character.hp) {
              pushLog(`${character.name}이 ${skill.name}으로 ${nextHp - character.hp} 회복!`);
            }
            return { ...character, hp: nextHp };
          });
          return updated;
        });
        advancePlayerTurn(updated);
        return;
      }

      if (skill.type === 'defend') {
        let updated: CharacterState[] = [];
        setPlayers((prev) => {
          updated = prev.map((character, index) =>
            index === activePlayerIndex ? { ...character, guard: skill.power } : character,
          );
          return updated;
        });
        pushLog(`${activePlayer.name}이 ${skill.name}으로 방어 태세를 갖췄습니다.`);
        advancePlayerTurn(updated);
        return;
      }

      if (skill.type === 'evade') {
        let updated: CharacterState[] = [];
        setPlayers((prev) => {
          updated = prev.map((character, index) =>
            index === activePlayerIndex ? { ...character, evade: skill.power } : character,
          );
          return updated;
        });
        pushLog(`${activePlayer.name}이 ${skill.name}으로 회피를 준비합니다.`);
        advancePlayerTurn(updated);
        return;
      }

      setEnemy((prev) => {
        const damage = calculateDamage(activePlayer.stats.attack, skill.power, prev.stats.defense);
        const nextHp = clamp(prev.hp - damage, 0, prev.stats.maxHp);
        pushLog(`${activePlayer.name}의 ${skill.name}! ${prev.name}에게 ${damage} 피해.`);
        return { ...prev, hp: nextHp };
      });
      advancePlayerTurn(players);
    },
    [activePlayer, activePlayerIndex, phase, advancePlayerTurn, pushLog, calculateDamage, players],
  );

  useEffect(() => {
    if (phase !== 'enemy') return;
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
        setPhase('player');
        setActivePlayerIndex(getNextAlive(players));
        return;
      }

      let detailText = '';
      let updated: CharacterState[] = [];
      setPlayers((prev) => {
        const alive = prev.filter((character) => character.hp > 0);
        if (!alive.length) {
          detailText = '공격할 대상이 없습니다.';
          updated = prev;
          return prev;
        }
        const target = alive[Math.floor(Math.random() * alive.length)];
        const targetIndex = prev.findIndex((character) => character.name === target.name);

        updated = prev.map((character, index) => {
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

        return updated;
      });
      pushLog(`${enemy.name}의 ${skill.name}! ${detailText}`.trim());
      setPhase('player');
      setActivePlayerIndex(getNextAlive(updated));
    }, 650);

    return () => window.clearTimeout(timeout);
  }, [phase, enemy, players, pushLog, calculateDamage]);

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
    <div className="relative flex h-full flex-col overflow-hidden bg-gradient-to-b from-slate-950 via-[#0a1321] to-slate-950 text-white">
      <div className="pointer-events-none absolute inset-0 opacity-60">
        <div className="h-full w-full bg-[radial-gradient(circle_at_top,_rgba(52,211,153,0.18),_transparent_55%)]" />
      </div>
      <div className="relative z-10 grid h-full grid-rows-[auto,1fr,auto] gap-4 p-4">
        <header className="flex items-center justify-between rounded-2xl border border-white/10 bg-black/40 px-4 py-3 backdrop-blur">
          <div>
            <p className="text-[11px] uppercase tracking-[0.4em] text-emerald-300">전투 개시</p>
            <h2 className="text-xl font-semibold md:text-2xl">{config.description ?? '시스템 교란체를 포착했습니다.'}</h2>
            <p className="text-xs text-slate-300 md:text-sm">
              {phase === 'player' ? '각 전사가 순서대로 명령을 기다립니다.' : '적이 움직입니다. 방어 태세를 유지하세요.'}
            </p>
          </div>
          <div className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-right text-xs uppercase tracking-[0.3em] text-emerald-200">
            {phase === 'player' ? 'Player Turn' : 'Enemy Turn'}
          </div>
        </header>

        <div className="grid flex-1 grid-rows-2 gap-4 lg:grid-rows-1 lg:grid-cols-[1.1fr,0.9fr]">
          <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-black/50 shadow-inner shadow-emerald-500/20">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(16,185,129,0.08),transparent_35%),radial-gradient(circle_at_80%_10%,rgba(239,68,68,0.08),transparent_30%)]" />
            <div className="relative flex h-full flex-col gap-4 p-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-[11px] uppercase tracking-[0.4em] text-slate-400">Enemy</p>
                  <h3 className="text-xl font-semibold md:text-2xl">{enemy.name}</h3>
                  <p className="text-xs text-slate-300 md:text-sm">{config.encounter ?? '앞을 가로막는 존재가 나타났다.'}</p>
                </div>
                <div className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-right text-[11px] uppercase tracking-[0.3em] text-slate-300">
                  SPD {enemy.stats.speed}
                </div>
              </div>
              <div className="space-y-2">
                <div className="h-3 rounded-full bg-white/10">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-rose-500 to-orange-400"
                    style={{ width: `${enemyHpPercent}%` }}
                  />
                </div>
                <p className="text-sm text-slate-200">
                  HP {enemy.hp} / {enemy.stats.maxHp}
                </p>
              </div>
              <dl className="grid grid-cols-3 gap-2 text-xs uppercase text-slate-300">
                <div className="rounded-lg border border-white/10 bg-white/5 p-2 text-center">
                  <dt className="text-[10px] tracking-[0.35em] text-slate-500">ATK</dt>
                  <dd className="text-lg font-semibold text-white">{enemy.stats.attack}</dd>
                </div>
                <div className="rounded-lg border border-white/10 bg-white/5 p-2 text-center">
                  <dt className="text-[10px] tracking-[0.35em] text-slate-500">DEF</dt>
                  <dd className="text-lg font-semibold text-white">{enemy.stats.defense}</dd>
                </div>
                <div className="rounded-lg border border-white/10 bg-white/5 p-2 text-center">
                  <dt className="text-[10px] tracking-[0.35em] text-slate-500">SPD</dt>
                  <dd className="text-lg font-semibold text-white">{enemy.stats.speed}</dd>
                </div>
              </dl>
              <div className="mt-auto rounded-xl border border-white/5 bg-black/40 p-3 text-xs text-slate-200">
                <p className="text-[10px] uppercase tracking-[0.35em] text-slate-500">예상 스킬</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {enemySkillList.map((skill) => (
                    <span key={skill.id} className="rounded-full border border-white/10 bg-white/10 px-2.5 py-1 text-[11px]">
                      {skill.name}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </div>

          <div className="grid grid-rows-[1fr,auto] gap-3 rounded-2xl border border-white/10 bg-black/40 p-4 text-sm">
            <div>
              <p className="text-[11px] uppercase tracking-[0.3em] text-slate-400">Battle Log</p>
              <ul className="mt-2 space-y-2 font-mono text-emerald-100">
                {log.map((entry, index) => (
                  <li key={`${entry}-${index}`} className="rounded-lg border border-white/5 bg-black/50 px-3 py-2 text-left text-xs tracking-tight">
                    {entry}
                  </li>
                ))}
              </ul>
            </div>
            <div className="flex items-center justify-between text-[11px] text-slate-300">
              <span>턴 순서</span>
              <div className="flex flex-wrap gap-1">
                {players
                  .map((player, index) => ({ player, index }))
                  .filter(({ player }) => player.hp > 0)
                  .map(({ player, index }) => (
                    <span
                      key={player.name}
                      className={`rounded-full px-2 py-1 text-[11px] ${index === activePlayerIndex && phase === 'player' ? 'bg-emerald-500/30 text-white' : 'bg-white/10 text-slate-200'}`}
                    >
                      {player.name}
                    </span>
                  ))}
              </div>
            </div>
          </div>
        </div>

        <div className="grid gap-3 rounded-2xl border border-white/10 bg-black/45 p-4 text-sm lg:grid-cols-[1.1fr,0.9fr]">
          <div className="rounded-xl border border-white/5 bg-slate-950/80 p-4">
            <p className="text-[11px] uppercase tracking-[0.3em] text-slate-400">Command</p>
            {activePlayer ? (
              <>
                <p className="mt-1 text-sm text-white">
                  {activePlayer.name} <span className="text-emerald-300">행동 대기</span>
                </p>
                <div className="mt-3 grid grid-cols-2 gap-2 md:grid-cols-3">
                  {activePlayer.skills.map((skill) => (
                    <button
                      key={skill.id}
                      className="group flex flex-col rounded-lg border border-white/10 bg-gradient-to-br from-slate-900 to-slate-800 px-3 py-2 text-left text-xs transition hover:border-emerald-400 hover:from-slate-800 hover:to-slate-700 disabled:cursor-not-allowed disabled:opacity-50"
                      disabled={phase !== 'player' || enemy.hp <= 0}
                      onClick={() => handlePlayerSkill(skill)}
                    >
                      <div className="flex items-center justify-between text-sm font-semibold">
                        <span className="truncate">{skill.name}</span>
                        <span className="text-[10px] text-emerald-200">{SKILL_TYPE_LABELS[skill.type]}</span>
                      </div>
                      <p className="mt-1 line-clamp-2 text-[11px] text-slate-300">{skill.description}</p>
                    </button>
                  ))}
                </div>
              </>
            ) : (
              <p className="mt-3 text-slate-300">행동 가능한 캐릭터가 없습니다.</p>
            )}
          </div>
          <div className="rounded-xl border border-white/5 bg-slate-950/70 p-4">
            <p className="text-[11px] uppercase tracking-[0.3em] text-slate-400">Party</p>
            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              {players.map((character, index) => {
                const percent = Math.round((character.hp / character.stats.maxHp) * 100);
                const isActive = index === activePlayerIndex && phase === 'player';
                return (
                  <div
                    key={character.name}
                    className={`rounded-xl border bg-black/40 p-3 transition ${isActive ? 'border-emerald-400 shadow-inner shadow-emerald-400/40' : 'border-white/10'}`}
                  >
                    <div className="flex items-center justify-between text-sm font-semibold">
                      <span className="flex items-center gap-2">
                        <span className={`h-2 w-2 rounded-full ${character.hp > 0 ? 'bg-emerald-400' : 'bg-slate-500'}`} />
                        {character.name}
                      </span>
                      <span className="text-xs text-slate-300">
                        HP {character.hp} / {character.stats.maxHp}
                      </span>
                    </div>
                    <div className="mt-2 h-2 rounded-full bg-white/10">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-emerald-400 to-sky-400"
                        style={{ width: `${percent}%` }}
                      />
                    </div>
                    <dl className="mt-3 grid grid-cols-3 gap-2 text-[11px] text-slate-300">
                      <div className="text-center">
                        <dt className="text-[9px] uppercase tracking-[0.25em] text-slate-500">ATK</dt>
                        <dd className="text-sm font-semibold">{character.stats.attack}</dd>
                      </div>
                      <div className="text-center">
                        <dt className="text-[9px] uppercase tracking-[0.25em] text-slate-500">DEF</dt>
                        <dd className="text-sm font-semibold">{character.stats.defense}</dd>
                      </div>
                      <div className="text-center">
                        <dt className="text-[9px] uppercase tracking-[0.25em] text-slate-500">SPD</dt>
                        <dd className="text-sm font-semibold">{character.stats.speed}</dd>
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
                      <div className="mt-1 flex flex-wrap gap-1">
                        {character.skills.map((skill) => (
                          <span key={skill.id} className="rounded-full bg-white/10 px-2 py-0.5 text-white/80">
                            {skill.name}
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
      </div>
    </div>
  );
};

export default Battle;
