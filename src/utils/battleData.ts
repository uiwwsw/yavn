import { BattleCharacterDefinition } from '#/novelTypes';

const defaultSkill = {
  id: 'basic-attack',
  name: '기본 공격',
  description: '적을 검으로 베어낸다.',
  power: 6,
  type: 'attack' as const,
};

export const CHARACTER_LIBRARY: Record<string, BattleCharacterDefinition> = {
  매튜: {
    name: '매튜',
    stats: {
      maxHp: 120,
      attack: 18,
      defense: 8,
      speed: 10,
    },
    skills: [
      {
        id: 'overclock-strike',
        name: '오버클럭 스트라이크',
        description: '코드를 과열시켜 강력한 일격을 날립니다.',
        power: 12,
        type: 'attack',
      },
      {
        id: 'refactor-shield',
        name: '리팩터 쉴드',
        description: '불완전한 코드를 정리하며 체력을 회복합니다.',
        power: 10,
        type: 'heal',
      },
    ],
  },
  세라: {
    name: '세라',
    stats: {
      maxHp: 100,
      attack: 16,
      defense: 10,
      speed: 12,
    },
    skills: [
      {
        id: 'data-pierce',
        name: '데이터 피어스',
        description: '날카로운 데이터 창으로 방어를 무시하고 찌릅니다.',
        power: 10,
        type: 'attack',
      },
      {
        id: 'restore-routine',
        name: '리스토어 루틴',
        description: '아군의 손상을 빠르게 복구합니다.',
        power: 8,
        type: 'heal',
      },
    ],
  },
  루크: {
    name: '루크',
    stats: {
      maxHp: 140,
      attack: 14,
      defense: 12,
      speed: 8,
    },
    skills: [
      {
        id: 'firewall-bash',
        name: '파이어월 배시',
        description: '강력한 방패로 적을 밀쳐 피해를 줍니다.',
        power: 9,
        type: 'attack',
      },
      {
        id: 'system-recover',
        name: '시스템 리커버리',
        description: '방어막을 두르고 체력을 소량 회복합니다.',
        power: 6,
        type: 'heal',
      },
    ],
  },
};

export const DEFAULT_PARTY = ['매튜'];

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

export const getPartyDefinitions = (names?: string[]) => {
  const party = names && names.length > 0 ? names : DEFAULT_PARTY;
  return party.map((member) => getCharacterDefinition(member));
};
