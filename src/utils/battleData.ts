import characterData from '$/characters.json';
import { BattleCharacterDefinition, BattleStats } from '#/novelTypes';

const defaultSkill = {
  id: 'basic-attack',
  name: '기본 공격',
  description: '적을 검으로 베어낸다.',
  power: 6,
  type: 'attack' as const,
};

interface CharacterLibraryFile {
  library: BattleCharacterDefinition[];
}

const characterLibrary = characterData as CharacterLibraryFile;

export const CHARACTER_LIBRARY: Record<string, BattleCharacterDefinition> = Object.fromEntries(
  characterLibrary.library.map((character) => [character.name, character]),
);

export const getCharacterDefinition = (name: string): BattleCharacterDefinition =>
  CHARACTER_LIBRARY[name] ?? {
    name,
    stats: {
      maxHp: 90,
      attack: 14,
      defense: 8,
      speed: 8,
    },
    skills: [defaultSkill],
  };

export const getDefaultPartyStats = () =>
  Object.fromEntries(
    Object.values(CHARACTER_LIBRARY).map((character) => [character.name, { ...character.stats }]),
  );

export const getPartyDefinitions = (names?: string[], statOverrides?: Record<string, BattleStats>) => {
  const party = names ?? [];
  return party.map((member) => {
    const definition = getCharacterDefinition(member);
    const override = statOverrides?.[member];
    return override ? { ...definition, stats: { ...override } } : definition;
  });
};
