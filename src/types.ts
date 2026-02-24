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

export type Action =
  | { bg: string }
  | { music: string }
  | { sound: string }
  | CharAction
  | SayAction
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
  image: string;
};

export type VNError = {
  message: string;
  line?: number;
  column?: number;
  details?: string;
};
