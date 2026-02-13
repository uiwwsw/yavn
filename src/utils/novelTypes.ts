export type VisualAnimation =
  | 'fade-in'
  | 'fade-out'
  | 'fade-in-slow'
  | 'fade-out-slow'
  | 'shake'
  | 'shake-hard'
  | 'flash'
  | 'float'
  | 'pulse'
  | 'impact'
  | 'slide-in-left'
  | 'slide-in-right'
  | 'slide-out-left'
  | 'slide-out-right'
  | 'move-left-right'
  | 'zoom-in'
  | 'zoom-out'
  | 'none';

export type VisualLayout =
  | 'sticker'   // Legacy: small icon at bottom
  | 'center'    // Centered in the screen (e.g., items, artifacts)
  | 'fit'       // Object-fit contain within the screen (e.g., character portraits)
  | 'stretch'   // Full screen (100vw/100vh)
  | 'root'      // Matches the #root game container exactly (Default for new visuals)
  | 'fixed';    // Fixed position (requires custom style)

export interface VisualConfig {
  asset: string;
  animation?: VisualAnimation;
  layout?: VisualLayout;
  duration?: number;
  delay?: number;
  style?: React.CSSProperties;
  className?: string;
  wait?: boolean; // Wait for animation to finish?
}

export interface Asset {
  image?: string;
  audio?: string;
  music?: string;
  video?: string;
  animation?: VisualAnimation;
  style?: React.CSSProperties;
  className?: string;
}

export type Assets = Record<string, Asset>;

export interface SentenceEntry {
  duration?: number;
  message: string;
  asset?: string | string[]; // Deprecated, use visuals for complex cases but keep for simpler ones
  visuals?: VisualConfig[];
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

// ============ 새로운 타입 정의 ============

// 게임 설정
export interface GameSettings {
  textSpeed: number;        // 0.5 ~ 2.0
  bgmVolume: number;        // 0.0 ~ 1.0
  sfxVolume: number;        // 0.0 ~ 1.0
  autoSpeed: number;        // 1000 ~ 5000 (ms)
  skipMode: 'unread' | 'all';
  displayMode: 'window' | 'fullscreen';
  hapticFeedback: boolean;
}

// 저장 데이터
export interface SaveData {
  slot: number;
  timestamp: number;
  level: number;
  chapterIndex: number;
  sentenceIndex: number;
  screenshot?: string;      // base64 thumbnail
  playTime: number;
  chapterTitle: string;
  characterName?: string;
  placeName?: string;
}

// 게임 전체 상태
export interface GameState {
  settings: GameSettings;
  saves: SaveData[];
  unlockedCGs: string[];
  playTime: number;
  readSentences: Set<string>;
  currentSave?: SaveData;
}

// 백로그 항목
export interface BacklogEntry {
  id: string;
  character: string;
  text: string;
  timestamp: number;
}

// 유틸리티 타입
export type DeepPartial<T> = { [P in keyof T]?: DeepPartial<T[P]> };
export type Nullable<T> = T | null;
