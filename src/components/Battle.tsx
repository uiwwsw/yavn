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
    setLog((prev) => [...prev, entry].slice(-10));
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

  useEffect(() => {
    if (phase !== 'player') return;

    const current =
      activePlayerIndex !== null && activePlayerIndex >= 0 ? players[activePlayerIndex] : undefined;
    if (current && current.hp > 0) return;

    const fallback = getNextAlive(players);
    setActivePlayerIndex(fallback === -1 ? null : fallback);
  }, [phase, players, activePlayerIndex]);

  const advancePlayerTurn = useCallback((nextPlayers: CharacterState[]) => {
    setActivePlayerIndex((current) => {
      const nextIndex = getNextAlive(nextPlayers, current ?? -1);
      if (nextIndex === -1) {
        setPhase('enemy');
        return null;
      }
      return nextIndex;
    });
  }, []);

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
  return (
    <div className="flex h-full items-center justify-center bg-slate-950/95 text-white">
      <div className="w-full max-w-4xl max-h-[94vh] overflow-hidden rounded-xl border border-white/10 bg-slate-900/80 p-3 shadow-2xl">
        <header className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-white/5 bg-slate-900/80 px-3 py-2">
          <div>
            <p className="text-[11px] uppercase tracking-[0.35em] text-emerald-300">전투</p>
            <p className="text-sm font-semibold text-white md:text-base">{config.description ?? '시스템 교란체를 포착했습니다.'}</p>
            <p className="text-[11px] text-slate-300">{config.encounter ?? '앞을 가로막는 존재가 나타났다.'}</p>
          </div>
          <div className="w-full max-w-xs rounded-lg border border-white/10 bg-slate-950/80 px-3 py-2 text-right text-xs">
            <div className="flex items-center justify-between text-[11px] text-slate-400">
              <span>적</span>
              <span className="rounded-full border border-white/10 px-2 py-0.5 text-[10px] uppercase tracking-[0.2em] text-emerald-200">
                {phase === 'player' ? '우리 차례' : '적 차례'}
              </span>
            </div>
            <div className="text-sm font-semibold text-white">{enemy.name}</div>
            <div className="mt-1 h-2 rounded-full bg-white/10">
              <div
                className="h-full rounded-full bg-gradient-to-r from-rose-500 to-orange-400"
                style={{ width: `${enemyHpPercent}%` }}
              />
            </div>
            <div className="mt-1 flex flex-wrap justify-end gap-2 text-[10px] text-slate-400">
              <span>
                HP {enemy.hp} / {enemy.stats.maxHp}
              </span>
              <span>ATK {enemy.stats.attack}</span>
              <span>DEF {enemy.stats.defense}</span>
              <span>SPD {enemy.stats.speed}</span>
            </div>
          </div>
        </header>

        <section className="mt-3 grid gap-3 rounded-lg border border-white/10 bg-slate-950/70 p-3 text-sm md:grid-cols-[1.2fr,0.8fr]">
          <div className="space-y-2">
            <div className="flex items-center justify-between text-[11px] text-slate-300">
              <span className="rounded-full border border-white/10 px-2 py-0.5 text-[10px] uppercase tracking-[0.2em] text-emerald-200">
                {phase === 'player' ? 'Player Turn' : 'Enemy Turn'}
              </span>
              <span className="text-white/80">행동할 아군을 선택하세요.</span>
            </div>
            <div className="grid gap-2 sm:grid-cols-2">
              {players.map((character, index) => {
                const percent = Math.round((character.hp / character.stats.maxHp) * 100);
                const isActive = index === activePlayerIndex && phase === 'player';
                const canAct = isActive && enemy.hp > 0 && character.hp > 0;
                return (
                  <div
                    key={character.name}
                    className={`space-y-2 rounded-lg border bg-black/30 p-3 text-[13px] transition ${isActive ? 'border-emerald-400 shadow-inner shadow-emerald-400/30' : 'border-white/10'} ${isActive ? 'block' : 'hidden sm:block'}`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="flex items-center gap-2 text-sm font-semibold">
                        <span className={`h-2 w-2 rounded-full ${character.hp > 0 ? 'bg-emerald-400' : 'bg-slate-500'}`} />
                        {character.name}
                      </span>
                      <span className="text-[11px] text-slate-300">HP {character.hp} / {character.stats.maxHp}</span>
                    </div>
                    <div className="h-2 rounded-full bg-white/10">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-emerald-400 to-sky-400"
                        style={{ width: `${percent}%` }}
                      />
                    </div>
                    <div className="flex flex-wrap gap-2 text-[11px] text-slate-300">
                      <span>ATK {character.stats.attack}</span>
                      <span>DEF {character.stats.defense}</span>
                      <span>SPD {character.stats.speed}</span>
                      {character.guard && <span className="rounded-full bg-amber-500/20 px-2 py-0.5 text-amber-200">방어 {character.guard}%</span>}
                      {character.evade && <span className="rounded-full bg-sky-500/20 px-2 py-0.5 text-sky-200">회피 {character.evade}%</span>}
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-[11px] md:grid-cols-3">
                      {character.skills.map((skill) => (
                        <button
                          key={skill.id}
                          className={`group flex flex-col rounded-md border border-white/10 bg-gradient-to-br from-slate-900 to-slate-800 px-2 py-1.5 text-left transition ${canAct ? 'hover:border-emerald-400 hover:from-slate-800 hover:to-slate-700' : 'opacity-50'}`}
                          disabled={!canAct}
                          onClick={() => handlePlayerSkill(skill)}
                        >
                          <div className="flex items-center justify-between text-[12px] font-semibold">
                            <span className="truncate">{skill.name}</span>
                            <span className="text-[10px] text-emerald-200">{SKILL_TYPE_LABELS[skill.type]}</span>
                          </div>
                          <p className="mt-0.5 line-clamp-2 text-[11px] text-slate-300">{skill.description}</p>
                        </button>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="flex flex-col rounded-lg border border-white/10 bg-slate-900/70 p-3">
            <p className="text-[11px] uppercase tracking-[0.25em] text-slate-400">전투 로그</p>
            <ul className="mt-2 max-h-64 space-y-1 overflow-y-auto rounded-md border border-white/5 bg-black/30 p-2 font-mono text-emerald-100 sm:max-h-80">
              {log.map((entry, index) => (
                <li key={`${entry}-${index}`} className="rounded bg-white/5 px-2 py-1 text-left text-xs tracking-tight">
                  {entry}
                </li>
              ))}
            </ul>
          </div>
        </section>
      </div>
    </div>
  );
};

export default Battle;
