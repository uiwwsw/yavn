export type Position = 'left' | 'center' | 'right';

export type SayAction = {
  say: {
    char?: string;
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
  | { bgFront: string }
  | { clearBgFront: true }
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
