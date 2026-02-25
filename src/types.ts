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

export type InputAction = {
  input: {
    correct: string;
    errors: string[];
  };
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
  | { wait: number }
  | { effect: string }
  | { goto: string };

export type Scene = {
  actions: Action[];
};

export type GameData = {
  meta: {
    title: string;
    author?: string;
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
  correct: string;
  errors: string[];
  attemptCount: number;
};

export type VNError = {
  message: string;
  line?: number;
  column?: number;
  details?: string;
};
