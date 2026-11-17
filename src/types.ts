import type { UiTemplateId } from './uiTemplates';
import type { CharacterMotion } from './characterEmotes';

export type { CharacterMotion } from './characterEmotes';

export type { UiTemplateId } from './uiTemplates';

export type Position = 'left' | 'center' | 'right';
export type CharacterLayoutMode = 'auto' | 'fixed';
export type CharacterFacing = 'left' | 'right' | 'front';
export type CharacterPlacement = 'stage-bottom' | 'prompt-top' | 'offstage';
export type CharacterEnterEffect =
  | 'none'
  | 'fadeIn'
  | 'wipeLeft'
  | 'scaleIn'
  | 'popIn'
  | 'slideUp'
  | 'slideDown'
  | 'slideLeft'
  | 'slideRight'
  | 'wipeCenterX'
  | 'wipeCenterY'
  | 'blurIn'
  | 'rotateIn';
export type CharacterEnterLayout = 'cut' | 'push';
export type CharacterEnterOptions = {
  effect?: CharacterEnterEffect;
  layout?: CharacterEnterLayout;
  duration?: number;
  easing?: string;
  delay?: number;
};
export type StickerAnchorX = 'left' | 'center' | 'right';
export type StickerAnchorY = 'top' | 'center' | 'bottom';
export type StickerLength = number | string;
export type DialogueDelivery =
  | 'neutral'
  | 'calm'
  | 'nervous'
  | 'angry'
  | 'whisper'
  | 'shout'
  | 'sad'
  | 'deduction';
export type DialogueChannel = 'dialogue' | 'narration' | 'record' | 'system' | 'thought' | 'action' | 'message' | 'card';

export type CharacterFramingPreset = {
  scale: number;
  cropBottom?: number;
  x?: number;
  y?: number;
};

export type CharacterCalibration = {
  scale?: number;
  x?: number;
  y?: number;
  spacing?: number;
};

export type CameraShot = 'wide' | 'medium' | 'close' | 'reaction';
export type CameraTransition = 'cut' | 'push' | 'pan';

export type CameraDirective = {
  shot: CameraShot;
  target?: 'group' | 'speaker' | string;
  transition?: CameraTransition;
  duration?: number;
};

export type StageCameraState = {
  shot: CameraShot;
  target: 'group' | string;
  transition: CameraTransition;
  duration: number;
};

export type CharacterAssetDefinition = {
  base: string;
  emotions?: Record<string, string>;
  facing?: CharacterFacing;
  placement?: CharacterPlacement;
  defaultDelivery?: DialogueDelivery;
  defaultFraming?: string;
  framings?: Record<string, CharacterFramingPreset>;
  calibration?: CharacterCalibration;
  /** Display name for the speaker label; may contain {{variable}} placeholders. Defaults to the id. */
  name?: string;
  /** Emotion → body-language motion played when a line switches the character to that emotion. */
  emotionMotions?: Record<string, CharacterMotion>;
};

export type CharacterFramingState = {
  name: string;
  cropBottom?: number;
  scale: number;
  x: number;
  y: number;
};
export type StickerEnterEffect =
  | 'none'
  | 'fadeIn'
  | 'wipeLeft'
  | 'scaleIn'
  | 'popIn'
  | 'slideUp'
  | 'slideDown'
  | 'slideLeft'
  | 'slideRight'
  | 'wipeCenterX'
  | 'wipeCenterY'
  | 'blurIn'
  | 'rotateIn';

export type StickerEnterOptions = {
  effect?: StickerEnterEffect;
  easing?: string;
  delay?: number;
};
export type StickerLeaveEffect = 'none' | 'fadeOut' | 'wipeLeft' | 'wipeRight';

export type StickerLeaveOptions = {
  effect?: StickerLeaveEffect;
  easing?: string;
  delay?: number;
};

export type ScreenEffectOptions = {
  name: string;
  wait?: boolean;
};

export type BackgroundTransitionKind = 'dissolve' | 'fade' | 'wipeLeft' | 'wipeRight' | 'cut';
export type BackgroundDirective = string | {
  id: string;
  transition?: BackgroundTransitionKind;
  duration?: number;
  wait?: boolean;
};
export type BackgroundPresentation = {
  transition: BackgroundTransitionKind;
  duration: number;
  revision: number;
};

export type AttackDirective = {
  attacker: string;
  image?: string;
  target?: string;
  from?: Position;
  style?: 'slash' | 'strike' | 'shot';
  strength?: 'light' | 'heavy';
  anticipation?: number;
  impact?: number;
  recovery?: number;
  approachSound?: string;
  sound?: string;
  caption?: string;
};
export type AttackPresentation = Required<Pick<AttackDirective,
  'attacker' | 'target' | 'from' | 'style' | 'strength' | 'anticipation' | 'impact' | 'recovery'
>> & Pick<AttackDirective, 'caption' | 'image'> & {
  phase: 'anticipation' | 'impact' | 'recovery';
  revision: number;
};

export type StickerPlacement = {
  x?: StickerLength;
  y?: StickerLength;
  width?: StickerLength;
  height?: StickerLength;
  anchorX?: StickerAnchorX;
  anchorY?: StickerAnchorY;
  rotate?: number;
  opacity?: number;
  zIndex?: number;
  enter?: StickerEnterEffect | StickerEnterOptions;
  inputLockMs?: number;
};

export type StickerAction = {
  sticker: {
    id: string;
    image: string;
  } & StickerPlacement;
};

export type ClearStickerTarget =
  | string
  | {
      id: string;
      leave?: StickerLeaveEffect | StickerLeaveOptions;
    };

/**
 * A photo or clip sent in a `channel: message` line.
 *
 * Authored as `media: assets/photo.png` when the defaults are right, or as a map when the
 * kind has to be stated or the picture needs a description. Paths are resolved to real URLs
 * before the line reaches the view, the same way a background or a sticker is.
 */
export type PhoneMediaSource =
  | string
  | {
      src: string;
      /** Inferred from the file extension when it is not stated. */
      kind?: 'image' | 'video';
      alt?: string;
    };

export type PhoneMedia = {
  src: string;
  kind: 'image' | 'video';
  alt?: string;
};

export type SayAction = {
  say: {
    char?: string;
    with?: string[];
    framing?: string;
    camera?: CameraDirective;
    channel?: DialogueChannel;
    continueLabel?: string;
    when?: ConditionNode;
    /** Plays an asset from sfx once when this line appears. */
    sound?: string;
    /** Optional only when the line carries `media`: a photo can be sent without a caption. */
    text?: string;
    delivery?: DialogueDelivery;
    promptHeight?: number;
    wait?: number;
    unskippable?: boolean;
    /** message channel: which side of the chat the bubble sits on. */
    side?: 'me' | 'them';
    /** message channel: a photo or clip sent with the line, or instead of it. */
    media?: PhoneMediaSource;
    /** Erase the line on screen once it has been read (message, record, thought, …). */
    erase?: boolean;
    autoAdvance?: number;
    /** Body-language motion the speaker plays as the line starts. */
    motion?: CharacterMotion;
  };
};

export type CharAction = {
  char: {
    id: string;
    position?: Position | 'auto';
    emotion?: string;
    framing?: string;
    enter?: CharacterEnterEffect | CharacterEnterOptions;
  };
};

export type VideoAction = {
  video: {
    src: string;
    holdToSkipMs?: number;
  };
};

export type RouteVarValue = boolean | number | string;
export type ConditionOperator = 'eq' | 'ne' | 'gt' | 'gte' | 'lt' | 'lte' | 'in';

export type ConditionLeaf = {
  var: string;
  op: ConditionOperator;
  value: RouteVarValue | RouteVarValue[];
};

export type ConditionNode =
  | ConditionLeaf
  | {
      all: ConditionNode[];
    }
  | {
      any: ConditionNode[];
    }
  | {
      not: ConditionNode;
    };

export type StateSetMap = Record<string, RouteVarValue>;
export type StateAddMap = Record<string, number>;

export type InventoryItem = {
  name: string;
  description?: string;
  image?: string;
  category?: string;
  order?: number;
};

export type InputRoute = {
  equals: string;
  set?: StateSetMap;
  add?: StateAddMap;
  goto?: string;
};

export type InputAction = {
  input: {
    prompt: string;
    char?: string;
    with?: string[];
    framing?: string;
    camera?: CameraDirective;
    promptHeight?: number;
    /** Omit for free text input (for example a player name); then saveAs is required. */
    correct?: string;
    errors: string[];
    saveAs?: string;
    routes: InputRoute[];
    maxLength?: number;
    defaultValue?: string;
    motion?: CharacterMotion;
  };
};

export type SetAction = {
  set: StateSetMap;
};

export type AddAction = {
  add: StateAddMap;
};

export type GetAction = {
  get: string;
};

export type UseAction = {
  use: string;
};

export type ChoiceOption = {
  text: string;
  /** Original option text used as the saved value after a published label changes. */
  saveText?: string;
  at?: { x: number; y: number };
  when?: ConditionNode;
  set?: StateSetMap;
  add?: StateAddMap;
  goto?: string;
  gameOver?: GameOverDefinition;
  forgiveOnce?: boolean;
  forgiveMessage?: string;
  /**
   * `presentation: 'approach'` only. Each line is one step closer: clicking shows the
   * next line and stays in the choice. The option commits on the click after the last.
   */
  reveal?: string[];
  /** The mood this target raises as it is approached; falls back to the choice's own. */
  mood?: string;
};

export type ChoiceAction = {
  choice: {
    key?: string;
    presentation?: 'dialogue' | 'explore' | 'approach';
    /** Place numbered targets over a cover-fitted background and list checked targets below. */
    investigation?: { width: number; height: number };
    evidence?: string;
    prompt: string;
    /** `approach` only: the mood tone that builds while the player closes in. */
    mood?: string;
    char?: string;
    with?: string[];
    framing?: string;
    camera?: CameraDirective;
    promptHeight?: number;
    forgiveOnceDefault?: boolean;
    forgiveMessage?: string;
    timeoutMs?: number;
    timeoutOptionIndex?: number;
    motion?: CharacterMotion;
    options: ChoiceOption[];
  };
};

export type BranchCase = {
  when: ConditionNode;
  goto: string;
};

export type BranchAction = {
  branch: {
    cases: BranchCase[];
    default?: string;
  };
};

export type EndingAction = {
  ending: string;
};

export type GameOverDefinition = {
  title?: string;
  message?: string;
  recoverToChoice?: string;
};

export type GameOverAction = {
  gameOver: GameOverDefinition;
};

export type CameraAction = {
  camera: CameraDirective;
};

export type Action =
  | { bg: BackgroundDirective }
  | { attack: AttackDirective }
  | StickerAction
  | { clearSticker: ClearStickerTarget }
  | { music: string | null }
  | { sound: string }
  | CameraAction
  | CharAction
  | SayAction
  | VideoAction
  | InputAction
  | SetAction
  | AddAction
  | GetAction
  | UseAction
  | ChoiceAction
  | BranchAction
  | EndingAction
  | GameOverAction
  | { wait: number }
  | { move: CharacterMoveDirective }
  | { emote: CharacterEmoteDirective }
  | { place: string }
  | { effect: string | ScreenEffectOptions }
  | { mood: MoodDirective | 'off' }
  | { goto: string };

/**
 * A feeling the screen holds, instead of the single flash `effect` gives.
 * It stays until the next `mood` or `mood: off`, so it can be raised a step at a
 * time while a scene closes in on something.
 */
export type MoodDirective = {
  /** CSS-safe name of the wash: the game styles `.mood-<tone>` itself. */
  tone: string;
  /** 1 (barely there) to 3 (the screen is that colour). Defaults to 1. */
  level?: number;
  /** A slow tremor under the whole stage. Off by default. */
  tremor?: boolean;
};

export type MoodState = {
  tone: string;
  level: number;
  tremor: boolean;
};

export type Scene = {
  title?: string;
  pov?: string;
  layout?: CharacterLayoutMode;
  actions: Action[];
};

export type AuthorContactObject = {
  label?: string;
  value: string;
  href?: string;
};

export type AuthorContact = string | AuthorContactObject;

export type AuthorMetaObject = {
  name?: string;
  contacts?: AuthorContact[];
};

export type EndingDefinition = {
  title: string;
  message?: string;
  epilogue?: string;
  background?: string;
  music?: string;
  tone?: 'hopeful' | 'tragic' | 'mystery';
};

export type EndingRule = {
  when: ConditionNode;
  ending: string;
};

export type GameSeoMeta = {
  description?: string;
  keywords?: string[];
  image?: string;
  imageAlt?: string;
};

export type LegalNoticeLink = {
  label: string;
  href: string;
};

export type LegalNotice = {
  id: string;
  title: string;
  text: string;
  copyright?: string;
  links?: LegalNoticeLink[];
};

export type StartButtonPosition = 'auto' | 'bottom-center' | 'bottom-left' | 'bottom-right' | 'center';

export type StartSceneLayer = {
  image: string;
  x: number;
  y: number;
  width: number;
  height: number;
  depth: number;
  opacity: number;
  fit: 'contain' | 'cover';
  blend: 'normal' | 'screen' | 'multiply';
  motion: 'none' | 'float' | 'sway';
  mobile?: { x?: number; y?: number; width?: number; height?: number; opacity?: number };
};

export type StartSceneConfig = {
  layout: 'split' | 'centered';
  motion: 'none' | 'drift' | 'push';
  duration: number;
  parallax: number;
  particles: 'none' | 'dust' | 'embers' | 'rain' | 'snow' | 'fireflies';
  intensity: number;
  fog: boolean;
  light: 'none' | 'breathe' | 'lightning';
  accent?: string;
  video?: string;
  layers: StartSceneLayer[];
  transition: { type: 'fade' | 'iris' | 'curtain'; duration: number };
};

export type StartScreenConfig = {
  enabled: boolean;
  image?: string;
  imagePosition?: string;
  mobileImagePosition?: string;
  music?: string;
  showTitle: boolean;
  titleColor?: string;
  eyebrow?: string;
  subtitle?: string;
  scene?: StartSceneConfig;
  startButtonText: string;
  buttonPosition: StartButtonPosition;
};

export type EndingScreenConfig = {
  image?: string;
};

export type UiConfig = {
  template: UiTemplateId;
  promptHeight?: number;
  messagePortrait?: string;
};

export type GameData = {
  meta: {
    title: string;
    author?: string | AuthorMetaObject;
    version?: string;
    seo?: GameSeoMeta;
    legalNotices?: LegalNotice[];
  };
  settings: {
    textSpeed: number;
    /** Deprecated: autosave is always on. Still accepted so older configs parse. */
    autoSave?: boolean;
    clickToInstant: boolean;
  };
  assets: {
    backgrounds: Record<string, string>;
    characters: Record<string, CharacterAssetDefinition>;
    music: Record<string, string>;
    sfx: Record<string, string>;
  };
  state?: {
    defaults: Record<string, RouteVarValue>;
  };
  inventory?: {
    defaults: Record<string, InventoryItem>;
  };
  endings?: Record<string, EndingDefinition>;
  endingRules?: EndingRule[];
  defaultEnding?: string;
  startScreen?: StartScreenConfig;
  endingScreen?: EndingScreenConfig;
  ui?: UiConfig;
  chapterTitle?: string;
  pov?: string;
  script: Array<{ scene: string }>;
  scenes: Record<string, Scene>;
};

export type CharacterMoveStyle = 'approach' | 'lunge' | 'retreat' | 'flinch' | 'exit' | 'reset';

/** Stage blocking: one character closes in on, lunges at or backs away from another (or the camera). */
export type CharacterMoveDirective = {
  id: string;
  style?: CharacterMoveStyle;
  /** Another character id, or 'camera'. Omitted: toward the middle of the stage. */
  toward?: string;
  /** Hold the next action until the motion lands. */
  wait?: boolean;
};

/** Persistent offset a `move` leaves on a character until `reset` or the next chapter. */
export type CharacterStance = {
  x: number;
  scale: number;
  style: CharacterMoveStyle;
  revision: number;
};

/** Body language: a short in-place motion (nod, sigh, tremble …) on a staged character. */
export type CharacterEmoteDirective = {
  id: string;
  motion: CharacterMotion;
  /** 1–3 plays; ignored by motions that hold their end pose. */
  repeat?: number;
  /** Hold the next action until the motion ends. */
  wait?: boolean;
};

/** The motion a character is playing (or holding). `revision` replays the same motion. */
export type CharacterMotionState = {
  motion: CharacterMotion;
  repeat: number;
  revision: number;
  /** A holding motion has finished: show its end pose without animating again. */
  settled?: boolean;
};

/** Short time/place caption shown in the HUD; it fades on its own and never waits for input. */
export type PlaceCaption = {
  text: string;
  revision: number;
};

export type CharacterSlot = {
  id: string;
  kind: 'image' | 'live2d';
  source: string;
  emotion?: string;
  facing?: CharacterFacing;
  placement: CharacterPlacement;
  framing: CharacterFramingState;
  calibration: Required<CharacterCalibration>;
  enterEffect: CharacterEnterEffect;
  enterLayout: CharacterEnterLayout;
  enterDuration: number;
  enterEasing: string;
  enterDelay: number;
};

export type StickerSlot = {
  id: string;
  source: string;
  x: string;
  y: string;
  width?: string;
  height?: string;
  anchorX: StickerAnchorX;
  anchorY: StickerAnchorY;
  rotate: number;
  opacity: number;
  zIndex: number;
  enterEffect: StickerEnterEffect;
  enterDuration: number;
  enterEasing: string;
  enterDelay: number;
  leaveEffect: StickerLeaveEffect;
  leaveDuration: number;
  leaveEasing: string;
  leaveDelay: number;
  leaving: boolean;
  renderKey: number;
};

export type VideoCutsceneState = {
  active: boolean;
  src?: string;
  youtubeId?: string;
  holdToSkipMs: number;
  guideVisible: boolean;
  skipProgress: number;
};

export type InputGateState = {
  active: boolean;
  prompt: string;
  correct?: string;
  maxLength?: number;
  defaultValue?: string;
  errors: string[];
  attemptCount: number;
  saveAs?: string;
  routes: InputRoute[];
};

export type ChoiceGateState = {
  active: boolean;
  presentation: 'dialogue' | 'explore' | 'approach';
  investigation?: { width: number; height: number; targets: ChoiceOption[] };
  evidence?: string;
  key: string;
  prompt: string;
  forgiveOnceDefault: boolean;
  forgiveMessage?: string;
  forgivenOptionIndexes: number[];
  timeoutMs?: number;
  timeoutOptionIndex?: number;
  /** `approach` only: progress is zero for every option except the current target. */
  approachSteps: number[];
  approachSwitched?: boolean;
  /** `approach` only: the tone raised while approaching, unless a target names its own. */
  mood?: string;
  options: ChoiceOption[];
};

export type RouteHistoryEntry = {
  kind: 'choice' | 'input';
  key: string;
  value: string;
  chapterPath?: string;
  sceneId: string;
  actionIndex: number;
};

export type StoryLogEntry =
  | {
      kind: 'dialogue';
      speaker?: string;
      channel?: DialogueChannel;
      /** message channel only: which side of the thread this bubble sat on. */
      side?: 'me' | 'them';
      /** message channel only: the speaker's profile picture, already resolved to a URL. */
      avatar?: string;
      /** message channel only: the photo or clip this message carried. */
      media?: PhoneMedia;
      text: string;
      chapterPath?: string;
      sceneId: string;
      actionIndex: number;
    }
  | {
      kind: 'choice' | 'input';
      prompt: string;
      value: string;
      chapterPath?: string;
      sceneId: string;
      actionIndex: number;
    };

export type VNError = {
  message: string;
  line?: number;
  column?: number;
  details?: string;
};
