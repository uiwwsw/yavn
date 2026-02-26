export type Position = 'left' | 'center' | 'right';
export type StickerAnchorX = 'left' | 'center' | 'right';
export type StickerAnchorY = 'top' | 'center' | 'bottom';
export type StickerLength = number | string;
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
  duration?: number;
  easing?: string;
  delay?: number;
};
export type StickerLeaveEffect = 'none' | 'fadeOut' | 'wipeLeft' | 'wipeRight';

export type StickerLeaveOptions = {
  effect?: StickerLeaveEffect;
  duration?: number;
  easing?: string;
  delay?: number;
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

export type SayAction = {
  say: {
    char?: string;
    with?: string[];
    text: string;
  };
};

export type CharAction = {
  char: {
    id: string;
    position: Position;
    emotion?: string;
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
    correct: string;
    errors: string[];
    saveAs?: string;
    routes: InputRoute[];
  };
};

export type SetAction = {
  set: StateSetMap;
};

export type AddAction = {
  add: StateAddMap;
};

export type ChoiceOption = {
  text: string;
  set?: StateSetMap;
  add?: StateAddMap;
  goto?: string;
  forgiveOnce?: boolean;
  forgiveMessage?: string;
};

export type ChoiceAction = {
  choice: {
    key?: string;
    prompt: string;
    char?: string;
    with?: string[];
    forgiveOnceDefault?: boolean;
    forgiveMessage?: string;
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

export type Action =
  | { bg: string }
  | StickerAction
  | { clearSticker: ClearStickerTarget }
  | { music: string }
  | { sound: string }
  | CharAction
  | SayAction
  | VideoAction
  | InputAction
  | SetAction
  | AddAction
  | ChoiceAction
  | BranchAction
  | EndingAction
  | { wait: number }
  | { effect: string }
  | { goto: string };

export type Scene = {
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
};

export type EndingRule = {
  when: ConditionNode;
  ending: string;
};

export type GameData = {
  meta: {
    title: string;
    author?: string | AuthorMetaObject;
    version?: string;
  };
  settings: {
    textSpeed: number;
    autoSave: boolean;
    clickToInstant: boolean;
  };
  assets: {
    backgrounds: Record<string, string>;
    characters: Record<
      string,
      {
        base: string;
        emotions?: Record<string, string>;
      }
    >;
    music: Record<string, string>;
    sfx: Record<string, string>;
  };
  state?: {
    defaults: Record<string, RouteVarValue>;
  };
  endings?: Record<string, EndingDefinition>;
  endingRules?: EndingRule[];
  defaultEnding?: string;
  script: Array<{ scene: string }>;
  scenes: Record<string, Scene>;
};

export type CharacterSlot = {
  id: string;
  kind: 'image' | 'live2d';
  source: string;
  emotion?: string;
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
  correct: string;
  errors: string[];
  attemptCount: number;
  saveAs?: string;
  routes: InputRoute[];
};

export type ChoiceGateState = {
  active: boolean;
  key: string;
  prompt: string;
  forgiveOnceDefault: boolean;
  forgiveMessage?: string;
  forgivenOptionIndexes: number[];
  options: ChoiceOption[];
};

export type RouteHistoryEntry = {
  kind: 'choice' | 'input';
  key: string;
  value: string;
  sceneId: string;
  actionIndex: number;
};

export type VNError = {
  message: string;
  line?: number;
  column?: number;
  details?: string;
};
