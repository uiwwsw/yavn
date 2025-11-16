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

const Battle = ({ config, onComplete }: BattleProps) => {
  const partyDefinitions = useMemo(() => getPartyDefinitions(config.party), [config.party]);
  const [players, setPlayers] = useState<CharacterState[]>(() =>
    partyDefinitions.map((character) => ({
      name: character.name,
      stats: character.stats,
      skills: character.skills,
      hp: character.stats.maxHp,
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
      setPlayers((prev) => {
        const alive = prev.filter((character) => character.hp > 0);
        if (!alive.length) return prev;
        const target = alive[Math.floor(Math.random() * alive.length)];
        const targetIndex = prev.findIndex((character) => character.name === target.name);
        const skillList = enemy.skills ?? [{ id: 'enemy-strike', name: '글리치 스트라이크', description: '', power: 6, type: 'attack' }];
        const skill = skillList[Math.floor(Math.random() * skillList.length)];
        const damage = calculateDamage(enemy.stats.attack, skill.power, target.stats.defense);
        pushLog(`${enemy.name}의 ${skill.name}! ${target.name}이 ${damage} 피해.`);
        return prev.map((character, index) =>
          index === targetIndex ? { ...character, hp: clamp(character.hp - damage, 0, character.stats.maxHp) } : character,
        );
      });
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
                  <p className="font-semibold">{skill.name}</p>
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
