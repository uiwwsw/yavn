import { ChangeEvent } from 'react';
import { CHARACTER_LIBRARY, getDefaultPartyStats } from '#/battleData';
import { BattleStats, BattleSkillType } from '#/novelTypes';

interface PartySetupProps {
  value: Record<string, BattleStats>;
  onChange: (name: string, stats: BattleStats) => void;
  onReset?: () => void;
}

type StatKey = keyof BattleStats;

const STAT_FIELDS: { key: StatKey; label: string; min: number; max: number; step?: number }[] = [
  { key: 'maxHp', label: '체력', min: 60, max: 260, step: 10 },
  { key: 'attack', label: '공격', min: 6, max: 40 },
  { key: 'defense', label: '방어', min: 4, max: 30 },
  { key: 'speed', label: '속도', min: 4, max: 30 },
];

const SKILL_TYPE_LABELS: Record<BattleSkillType, string> = {
  attack: '공격',
  heal: '회복',
  defend: '방어',
  evade: '회피',
};

const PartySetup = ({ value, onChange, onReset }: PartySetupProps) => {
  const handleInputChange = (name: string, key: StatKey) => (event: ChangeEvent<HTMLInputElement>) => {
    const nextValue = Number(event.target.value);
    const nextStats = {
      ...(value[name] ?? getDefaultPartyStats()[name]),
      [key]: nextValue,
    } as BattleStats;
    onChange(name, nextStats);
  };

  return (
    <section className="rounded-3xl border border-white/15 bg-black/40 p-5 text-white">
      <header className="mb-4 space-y-1">
        <p className="text-xs uppercase tracking-widest text-emerald-200">팀 세팅</p>
        <h2 className="text-2xl font-semibold">전투 전 스탯을 배분하세요</h2>
        <p className="text-sm text-slate-300">
          각 캐릭터마다 체력, 공격, 방어, 속도를 조정하고 어떤 스킬을 사용할지 확인할 수 있습니다. 설정값은 자동으로
          저장되며 전투에 그대로 반영됩니다.
        </p>
      </header>
      <div className="space-y-6">
        {Object.values(CHARACTER_LIBRARY).map((character) => {
          const stats = value[character.name] ?? character.stats;
          return (
            <div key={character.name} className="rounded-2xl border border-white/10 bg-white/5 p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="text-sm uppercase tracking-widest text-slate-400">{character.name}</p>
                  <p className="text-xl font-semibold">{character.name} 능력치</p>
                </div>
                <div className="text-xs text-slate-400">총 스킬 {character.skills.length}개</div>
              </div>
              <div className="mt-3 grid gap-3 md:grid-cols-2">
                {STAT_FIELDS.map((field) => (
                  <label key={field.key} className="flex flex-col gap-1 text-sm text-slate-200">
                    <span>
                      {field.label}
                      <span className="ml-2 text-xs text-slate-400">({field.min}~{field.max})</span>
                    </span>
                    <input
                      type="number"
                      min={field.min}
                      max={field.max}
                      step={field.step ?? 1}
                      value={stats[field.key]}
                      onChange={handleInputChange(character.name, field.key)}
                      className="rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-white focus:border-emerald-300 focus:outline-none"
                    />
                  </label>
                ))}
              </div>
              <div className="mt-4 rounded-xl border border-white/5 bg-slate-900/40 p-3 text-sm text-slate-200">
                <p className="text-xs uppercase tracking-widest text-slate-400">보유 스킬</p>
                <ul className="mt-2 space-y-2">
                  {character.skills.map((skill) => (
                    <li key={skill.id} className="rounded-lg bg-black/30 p-3">
                      <div className="flex items-center justify-between text-sm">
                        <span className="font-semibold text-white">{skill.name}</span>
                        <span className="text-xs text-emerald-200">{SKILL_TYPE_LABELS[skill.type]}</span>
                      </div>
                      <p className="text-xs text-slate-300">{skill.description}</p>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          );
        })}
      </div>
      {onReset && (
        <div className="mt-5 text-right">
          <button
            type="button"
            className="rounded-full border border-white/20 px-4 py-2 text-sm font-semibold text-white transition hover:border-emerald-300 hover:text-emerald-200"
            onClick={onReset}
          >
            기본값으로 되돌리기
          </button>
        </div>
      )}
    </section>
  );
};

export default PartySetup;
