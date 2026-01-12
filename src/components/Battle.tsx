import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from 'react';

import SceneControls from '@/SceneControls';

import { BattleConfig, BattleEnemyConfig, BattleSkill, BattleStats } from '#/novelTypes';
import { getPartyDefinitions } from '#/battleData';

interface BattleProps {
  config: BattleConfig;
  auto: boolean;
  onAutoChange: (next: boolean) => void;
  pass: boolean;
  onPassChange: (next: boolean) => void;
  onComplete: (result: 'win' | 'lose') => void;
  onExitToTitle: () => void;
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

type Phase = 'player' | 'enemy';

type LogEffect = 'push' | 'none';

interface PendingLog {
  id: number;
  text: string;
  effect: LogEffect;
}

interface LogLine extends PendingLog {}

const MAX_BUFFER_LINES = 240;
const CHAR_DELAY_MS = 26;
const LINE_GAP_DELAY_MS = 180;

const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));

const getNextAlive = (characters: CharacterState[], afterIndex = -1) => {
  for (let i = afterIndex + 1; i < characters.length; i += 1) {
    if (characters[i].hp > 0) return i;
  }
  return -1;
};

const calculateDamage = (attackerAttack: number, skillPower: number, targetDefense: number) =>
  Math.max(1, attackerAttack + skillPower - targetDefense);

const pickSkill = (skills: BattleSkill[] | undefined) => {
  if (!skills || skills.length === 0) {
    return { id: 'enemy-strike', name: '글리치 스트라이크', description: '', power: 6, type: 'attack' as const };
  }
  return skills[Math.floor(Math.random() * skills.length)];
};

const BASIC_ATTACK_SKILL: BattleSkill = {
  id: 'basic-attack',
  name: '일반 공격',
  description: '적을 공격한다.',
  power: 6,
  type: 'attack',
};

const pickSignatureSkill = (skills: BattleSkill[]) =>
  skills.find((skill) => skill.type === 'attack' || skill.type === 'heal') ?? skills[0];

const Battle = ({ config, auto, onAutoChange, pass, onPassChange, onComplete, onExitToTitle }: BattleProps) => {
  const partyDefinitions = useMemo(() => getPartyDefinitions(config.party), [config.party]);

  const [players, setPlayers] = useState<CharacterState[]>(() =>
    partyDefinitions.map((character) => ({
      name: character.name,
      stats: character.stats,
      skills: character.skills,
      hp: character.stats.maxHp,
    })),
  );

  const [enemy, setEnemy] = useState<EnemyState>(() => ({
    ...config.enemy,
    hp: config.enemy.stats.maxHp,
  }));

  const [phase, setPhase] = useState<Phase>('player');
  const [activePlayerIndex, setActivePlayerIndex] = useState<number>(() => getNextAlive(players));

  const [outcome, setOutcome] = useState<'win' | 'lose' | null>(null);
  const [didStaggerLog, setDidStaggerLog] = useState(false);

  const logIdRef = useRef(0);
  const [lines, setLines] = useState<LogLine[]>([]);
  const [queue, setQueue] = useState<PendingLog[]>([]);
  const [typing, setTyping] = useState<(PendingLog & { index: number }) | null>(null);

  const logViewportRef = useRef<HTMLDivElement | null>(null);
  const stickToBottomRef = useRef(true);
  const passTimeoutRef = useRef<number | null>(null);
  const winCompleteRef = useRef(false);

  const [commandText, setCommandText] = useState('');
  const inputRef = useRef<HTMLInputElement | null>(null);

  const enqueue = useCallback((text: string, effect: LogEffect = 'none') => {
    const id = (logIdRef.current += 1);
    setQueue((prev) => [...prev, { id, text, effect }]);
  }, []);

  const resetTerminal = useCallback(() => {
    logIdRef.current = 0;
    stickToBottomRef.current = true;
    setLines([]);
    setQueue([]);
    setTyping(null);
  }, []);

  const resetBattle = useCallback(() => {
    const nextPlayers = partyDefinitions.map((character) => ({
      name: character.name,
      stats: character.stats,
      skills: character.skills,
      hp: character.stats.maxHp,
    }));

    resetTerminal();
    setPlayers(nextPlayers);
    setEnemy({ ...config.enemy, hp: config.enemy.stats.maxHp });
    setOutcome(null);
    setDidStaggerLog(false);
    setCommandText('');

    const firstAlive = getNextAlive(nextPlayers);
    setActivePlayerIndex(firstAlive);

    const enemyFirst = Math.random() < 0.5;
    setPhase(enemyFirst ? 'enemy' : 'player');

    enqueue('적이 나타났다.');

    const partyLeader = nextPlayers[0]?.name ?? '일행';
    if (enemyFirst) {
      enqueue(`${partyLeader} 일행이 당황했다.`);
    } else {
      enqueue(`${partyLeader}의 차례다.`);
    }
  }, [config.enemy, enqueue, partyDefinitions, resetTerminal]);

  useEffect(() => {
    resetBattle();
  }, [resetBattle]);

  useEffect(() => {
    if (typing) return;
    if (queue.length === 0) return;

    const [next, ...rest] = queue;
    setQueue(rest);
    setTyping({ ...next, index: 0 });
  }, [queue, typing]);

  useEffect(() => {
    if (!typing) return;

    if (typing.index >= typing.text.length) {
      const finished = typing;
      const timeout = window.setTimeout(() => {
        setLines((prev) => {
          const next = [...prev, { id: finished.id, text: finished.text, effect: finished.effect }];
          return next.length > MAX_BUFFER_LINES ? next.slice(next.length - MAX_BUFFER_LINES) : next;
        });
        setTyping(null);
      }, LINE_GAP_DELAY_MS);
      return () => window.clearTimeout(timeout);
    }

    const timeout = window.setTimeout(() => {
      setTyping((prev) => {
        if (!prev) return prev;
        return { ...prev, index: prev.index + 1 };
      });
    }, CHAR_DELAY_MS);

    return () => window.clearTimeout(timeout);
  }, [typing]);

  const protagonistIndex = 0;
  const protagonist = players[protagonistIndex];

  const readyForInput =
    outcome === null && phase === 'player' && queue.length === 0 && typing === null && activePlayerIndex >= 0;


  useEffect(() => {
    if (!readyForInput) return;
    inputRef.current?.focus();
  }, [readyForInput]);

  const typingIndex = typing?.index ?? 0;
  useEffect(() => {
    const el = logViewportRef.current;
    if (!el) return;
    if (!stickToBottomRef.current) return;
    window.requestAnimationFrame(() => {
      el.scrollTop = el.scrollHeight;
    });
  }, [lines, typingIndex]);

  const endAsLose = useCallback(
    (leaderName: string) => {
      if (outcome) return;
      enqueue(`${leaderName}가 쓰러졌다.`);
      enqueue('GAME OVER.');
      setOutcome('lose');
    },
    [enqueue, outcome],
  );

  useEffect(() => {
    if (!protagonist) return;
    if (protagonist.hp > 0) return;
    endAsLose(protagonist.name);
  }, [endAsLose, protagonist]);

  const endAsWin = useCallback(() => {
    if (outcome) return;
    enqueue(`“${enemy.name}”이 쓰러졌다.`);
    enqueue('VICTORY.');
    setOutcome('win');
  }, [enemy.name, enqueue, outcome]);

  useEffect(() => {
    if (enemy.hp > 0) return;
    endAsWin();
  }, [enemy.hp, endAsWin]);

  useEffect(() => {
    if (outcome !== 'win') return;
    if (typing !== null) return;
    if (queue.length !== 0) return;
    if (winCompleteRef.current) return;

    winCompleteRef.current = true;
    const timeout = window.setTimeout(() => {
      onComplete('win');
    }, 520);

    return () => window.clearTimeout(timeout);
  }, [onComplete, outcome, queue.length, typing]);

  const performEnemyTurn = useCallback(() => {
    if (outcome) return;

    const skill = pickSkill(enemy.skills);

    if (skill.type === 'heal') {
      const nextHp = clamp(enemy.hp + skill.power, 0, enemy.stats.maxHp);
      setEnemy((prev) => ({ ...prev, hp: nextHp }));
      enqueue(`“${enemy.name}”이 “${skill.name}”을 했다.`);
      enqueue(`“${enemy.name}”이 회복했다. ${nextHp}/${enemy.stats.maxHp}`);

      const nextIndex = getNextAlive(players);
      setActivePlayerIndex(nextIndex);
      setPhase('player');
      if (nextIndex >= 0) enqueue(`${players[nextIndex].name}의 차례다.`);
      return;
    }

    const aliveTargets = players.filter((character) => character.hp > 0);
    if (aliveTargets.length === 0) {
      enqueue(`“${enemy.name}”이 “${skill.name}”을 했다.`);
      enqueue('공격할 대상이 없다.');
      setPhase('player');
      return;
    }

    const defaultTarget = players[protagonistIndex]?.hp > 0 ? players[protagonistIndex] : undefined;
    const target = defaultTarget ?? aliveTargets[Math.floor(Math.random() * aliveTargets.length)];
    const targetIndex = players.findIndex((character) => character.name === target.name);

    const damage = calculateDamage(enemy.stats.attack, skill.power, target.stats.defense);

    let nextHp = target.hp;
    const updatedPlayers = players.map((character, index) => {
      if (index !== targetIndex) return character;
      nextHp = clamp(character.hp - damage, 0, character.stats.maxHp);
      return { ...character, hp: nextHp };
    });

    setPlayers(updatedPlayers);

    enqueue(`“${enemy.name}”이 “${skill.name}”을 했다.`, 'push');
    enqueue(`“${target.name}”가 피해를 입었다. ${nextHp}/${target.stats.maxHp}`);

    const nextIndex = getNextAlive(updatedPlayers);
    setActivePlayerIndex(nextIndex);
    setPhase('player');
    if (nextIndex >= 0) enqueue(`${updatedPlayers[nextIndex].name}의 차례다.`);
  }, [enemy, enqueue, outcome, players, protagonistIndex]);

  useEffect(() => {
    if (outcome) return;
    if (phase !== 'enemy') return;
    if (typing || queue.length) return;

    const timeout = window.setTimeout(() => {
      performEnemyTurn();
    }, 420);

    return () => window.clearTimeout(timeout);
  }, [outcome, phase, performEnemyTurn, queue.length, typing]);

  const advancePlayerTurn = useCallback(
    (updatedPlayers: CharacterState[]) => {
      const nextIndex = getNextAlive(updatedPlayers, activePlayerIndex);
      if (nextIndex === -1) {
        setPhase('enemy');
        setActivePlayerIndex(getNextAlive(updatedPlayers));
        return;
      }
      setActivePlayerIndex(nextIndex);
      enqueue(`${updatedPlayers[nextIndex].name}의 차례다.`);
    },
    [activePlayerIndex, enqueue],
  );

  const performPlayerSkill = useCallback(
    (action: 'basic' | 'signature') => {
      if (outcome) return;
      if (phase !== 'player') return;
      if (typing || queue.length) return;
      if (activePlayerIndex < 0) return;

      const actor = players[activePlayerIndex];
      if (!actor || actor.hp <= 0) return;

      const signature = pickSignatureSkill(actor.skills);
      const chosen = action === 'basic' ? BASIC_ATTACK_SKILL : signature;
      if (!chosen) {
        enqueue(`${actor.name}는 행동할 수 없다.`);
        advancePlayerTurn(players);
        return;
      }

      if (chosen.type === 'heal') {
        let healedAmount = 0;
        const updatedPlayers = players.map((character, index) => {
          if (index !== activePlayerIndex) return character;
          const nextHp = clamp(character.hp + chosen.power, 0, character.stats.maxHp);
          healedAmount = nextHp - character.hp;
          return { ...character, hp: nextHp };
        });

        setPlayers(updatedPlayers);
        enqueue(`“${actor.name}”가 “${chosen.name}”을 했다.`, 'push');
        enqueue(
          healedAmount > 0
            ? `“${actor.name}”이 ${healedAmount} 회복했다. ${updatedPlayers[activePlayerIndex].hp}/${actor.stats.maxHp}`
            : `“${actor.name}”의 회복은 효과가 없다. ${updatedPlayers[activePlayerIndex].hp}/${actor.stats.maxHp}`,
        );
        advancePlayerTurn(updatedPlayers);
        return;
      }

      if (chosen.type !== 'attack') {
        enqueue(`“${actor.name}”는 지금 “${chosen.name}”을 사용할 수 없다.`);
        advancePlayerTurn(players);
        return;
      }

      const damage = calculateDamage(actor.stats.attack, chosen.power, enemy.stats.defense);
      const nextEnemyHp = clamp(enemy.hp - damage, 0, enemy.stats.maxHp);
      setEnemy((prev) => ({ ...prev, hp: nextEnemyHp }));

      if (action === 'basic') {
        enqueue(`${actor.name}가 일반 공격을 했다.`, 'push');
      } else {
        enqueue(`“${actor.name}”가 “${chosen.name}”을 했다.`, 'push');
      }
      enqueue(`“${enemy.name}”이 ${damage} 피해를 받았다. ${nextEnemyHp}/${enemy.stats.maxHp}`);

      const staggerThreshold = Math.ceil(enemy.stats.maxHp * 0.25);
      if (!didStaggerLog && nextEnemyHp > 0 && nextEnemyHp <= staggerThreshold) {
        setDidStaggerLog(true);
        enqueue(`“${enemy.name}”이 휘청거린다.`);
      }

      if (nextEnemyHp <= 0) {
        return;
      }

      const updatedPlayers = [...players];
      advancePlayerTurn(updatedPlayers);
    },
    [
      activePlayerIndex,
      advancePlayerTurn,
      didStaggerLog,
      enemy.hp,
      enemy.name,
      enemy.stats.defense,
      enemy.stats.maxHp,
      enqueue,
      outcome,
      phase,
      players,
      queue.length,
      typing,
    ],
  );

  const handleCommand = useCallback(
    (raw: string) => {
      const value = raw.trim();
      if (value === '1') {
        performPlayerSkill('basic');
        return;
      }
      if (value === '2') {
        performPlayerSkill('signature');
        return;
      }
      enqueue('알 수 없는 명령이다. 1 또는 2를 입력해라.');
    },
    [enqueue, performPlayerSkill],
  );

  const handleSubmit = useCallback(
    (e: FormEvent) => {
      e.preventDefault();
      if (!readyForInput) return;
      const current = commandText;
      setCommandText('');
      handleCommand(current);
    },
    [commandText, handleCommand, readyForInput],
  );

  const activeActor = activePlayerIndex >= 0 ? players[activePlayerIndex] : undefined;
  const signatureSkill = activeActor ? pickSignatureSkill(activeActor.skills) : undefined;

  useEffect(() => {
    if (passTimeoutRef.current) {
      window.clearTimeout(passTimeoutRef.current);
      passTimeoutRef.current = null;
    }

    if (!pass) return;
    if (!readyForInput) return;

    const shouldUseSignature = Boolean(
      signatureSkill &&
        (signatureSkill.type === 'attack' ||
          (signatureSkill.type === 'heal' && activeActor && activeActor.hp < activeActor.stats.maxHp * 0.7)),
    );

    passTimeoutRef.current = window.setTimeout(() => {
      performPlayerSkill(shouldUseSignature ? 'signature' : 'basic');
    }, 420);

    return () => {
      if (passTimeoutRef.current) {
        window.clearTimeout(passTimeoutRef.current);
        passTimeoutRef.current = null;
      }
    };
  }, [activeActor, pass, performPlayerSkill, readyForInput, signatureSkill]);

  const showOverlay = outcome === 'lose' && typing === null && queue.length === 0;

  return (
    <div className="flex h-full w-full items-center justify-center bg-black">
      <div className="relative flex h-full w-full flex-col overflow-hidden rounded-none border-0 bg-[#0b0b0b] shadow-2xl sm:rounded-xl sm:border sm:border-white/15">
        <div className="relative flex items-center border-b border-white/10 bg-[#1e1e1e] px-2 py-1.5 sm:px-3 sm:py-2">
          <div className="flex items-center gap-2">
            <span className="h-3 w-3 rounded-full bg-[#ff5f57]" />
            <span className="h-3 w-3 rounded-full bg-[#febc2e]" />
            <span className="h-3 w-3 rounded-full bg-[#28c840]" />
          </div>

          <div className="absolute left-1/2 -translate-x-1/2 text-[11px] text-white/70 sm:text-[12px]">Terminal</div>

          <div className="ml-auto flex items-center" onClick={(e) => e.stopPropagation()}>
            <SceneControls auto={auto} onAutoChange={onAutoChange} pass={pass} onPassChange={onPassChange} />
          </div>
        </div>

        <div className="flex flex-1 flex-col overflow-hidden px-3 py-2 font-mono text-[12px] leading-relaxed text-white/90 sm:px-4 sm:py-3 sm:text-[13px]">
          <div

            ref={logViewportRef}
            onScroll={(e) => {
              const el = e.currentTarget;
              stickToBottomRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < 24;
            }}
            className="hide-scrollbar flex-1 overflow-y-auto overflow-x-hidden pr-1"
          >
            <div className="space-y-1">
              {lines.map((line) => (
                <div
                  key={line.id}
                  className={`whitespace-pre-wrap break-words ${line.effect === 'push' ? 'terminal-push' : ''}`}
                >
                  {line.text}
                </div>
              ))}
              {typing && (
                <div
                  className={`whitespace-pre-wrap break-words ${typing.effect === 'push' ? 'terminal-push' : ''}`}
                >
                  {typing.text.slice(0, typing.index)}
                  <span className="terminal-cursor">▍</span>
                </div>
              )}
            </div>
          </div>

          <div className="mt-2 space-y-2 sm:mt-3">
            {readyForInput && (
              <div className="flex flex-wrap items-center gap-2 text-[11px] text-white/80 sm:text-[12px]">
                <button
                  type="button"
                  className="min-w-[5.5rem] flex-1 truncate rounded border border-white/20 bg-white/5 px-2 py-1 hover:bg-white/10"
                  onClick={() => performPlayerSkill('basic')}
                >
                  공격 1
                </button>
                <button
                  type="button"
                  className="min-w-[5.5rem] flex-1 truncate rounded border border-white/20 bg-white/5 px-2 py-1 hover:bg-white/10"
                  onClick={() => performPlayerSkill('signature')}
                >
                  {signatureSkill ? `${signatureSkill.name} 2` : '스킬 2'}
                </button>
              </div>
            )}

            <form onSubmit={handleSubmit} className="flex items-center gap-2">
              <span className="text-emerald-300">&gt;</span>
              <input
                ref={inputRef}
                value={commandText}
                onChange={(e) => setCommandText(e.target.value)}
                disabled={!readyForInput}
                placeholder={readyForInput ? '_....' : ''}
                className="w-full bg-transparent text-white/90 outline-none placeholder:text-white/30 disabled:opacity-50"
              />
            </form>
          </div>
        </div>

        {showOverlay && outcome === 'lose' && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/70 px-4">
            <div className="w-full max-w-sm rounded-lg border border-red-400/40 bg-black/80 p-5 font-mono text-white">
              <div className="text-center">
                <div className="text-[11px] uppercase tracking-[0.35em] text-red-300">System Halted</div>
                <div className="mt-1 text-2xl font-semibold">GAME OVER</div>
              </div>
              <div className="mt-4 space-y-2">
                <button
                  type="button"
                  className="w-full rounded border border-white/20 bg-white/5 px-3 py-2 hover:bg-white/10"
                  onClick={resetBattle}
                >
                  다시 싸우기
                </button>
                <button
                  type="button"
                  className="w-full rounded border border-white/20 bg-white/5 px-3 py-2 hover:bg-white/10"
                  onClick={onExitToTitle}
                >
                  종료
                </button>
              </div>
            </div>
          </div>
        )}

      </div>
    </div>
  );
};

export default Battle;
