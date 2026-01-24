export interface Asset {
  image?: string;
  audio?: string;
  music?: string;
}

export type Assets = Record<string, Asset>;

export interface SentenceEntry {
  duration?: number;
  message: string;
  asset?: string | string[];
}

export type SentenceData = string | SentenceEntry | SentenceEntry[];

export interface ChoiceDestination {
  chapter?: number;
  sentence?: number;
  id?: string;
}

export interface ChoiceOption {
  text: string;
  goTo?: ChoiceDestination;
}

export interface ChoiceNode {
  prompt?: string;
  choices: ChoiceOption[];
}

export type ChapterSentence = SentenceData | ChoiceNode;

export interface BattleStats {
  maxHp: number;
  attack: number;
  defense: number;
  speed: number;
}

export type BattleSkillType = 'attack' | 'heal' | 'defend' | 'evade';

export interface BattleSkill {
  id: string;
  name: string;
  description: string;
  power: number;
  type: BattleSkillType;
}

export interface BattleCharacterDefinition {
  name: string;
  stats: BattleStats;
  skills: BattleSkill[];
}

export interface BattleEnemyConfig {
  name: string;
  stats: BattleStats;
  skills?: BattleSkill[];
}

export interface MusicConfig {
  situational?: string;
  overrideLocation?: boolean;
  fadeDuration?: number;
}

export interface BattleConfig {
  description?: string;
  encounter?: string;
  enemy: BattleEnemyConfig;
  party: string[];
}

export interface Chapter {
  id?: string;
  changePosition?: true;
  sentences: ChapterSentence[];
  character: string;
  place: string;
  next?: ChoiceDestination;
  battle?: BattleConfig;
  music?: MusicConfig;
}

export type MusicPriority = 'situational' | 'location' | 'chapter';

export interface MusicState {
  current: string | null;
  priority: MusicPriority;
  isPlaying: boolean;
  volume: number;
}

export const isChoiceNode = (value: ChapterSentence | undefined): value is ChoiceNode => {
  if (!value) return false;
  if (typeof value !== 'object') return false;
  return 'choices' in value && Array.isArray((value as ChoiceNode).choices);
};
