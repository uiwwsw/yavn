import { useVNStore } from './store';
import type { Action, GameData } from './types';

export const DEFAULT_PROMPT_HEIGHT_PX = 170;
export const MIN_PROMPT_HEIGHT_PX = 120;
export const MAX_PROMPT_HEIGHT_PX = 600;

export type PromptHeightResolution = {
  isPromptAction: boolean;
  promptHeight?: number;
};

type PromptSizedActionBody = {
  promptHeight?: number;
};

type PromptLayoutGame = GameData & {
  ui?: GameData['ui'] & {
    promptHeight?: number;
  };
};

function normalizePromptHeight(value: unknown): number | undefined {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return undefined;
  }
  return Math.min(MAX_PROMPT_HEIGHT_PX, Math.max(MIN_PROMPT_HEIGHT_PX, Math.round(value)));
}

export function resolvePromptActionHeight(action: Action | undefined): PromptHeightResolution {
  if (!action || typeof action !== 'object') {
    return { isPromptAction: false };
  }
  const candidate = action as unknown as {
    say?: PromptSizedActionBody;
    choice?: PromptSizedActionBody;
    input?: PromptSizedActionBody;
  };
  const body = candidate.say ?? candidate.choice ?? candidate.input;
  if (!body) {
    return { isPromptAction: false };
  }
  return {
    isPromptAction: true,
    promptHeight: normalizePromptHeight(body.promptHeight),
  };
}

export function resolveGamePromptHeight(game: GameData | undefined): number {
  const configured = normalizePromptHeight((game as PromptLayoutGame | undefined)?.ui?.promptHeight);
  return configured ?? DEFAULT_PROMPT_HEIGHT_PX;
}

function getCurrentPromptAction(game: GameData | undefined, sceneId: string, actionIndex: number): Action | undefined {
  return game?.scenes[sceneId]?.actions[actionIndex];
}

function applyPromptHeight(height: number): void {
  if (typeof document === 'undefined') {
    return;
  }
  document.documentElement.style.setProperty('--yavn-prompt-height', `${height}px`);
}

export function initializePromptLayout(): () => void {
  let previousGame = useVNStore.getState().game;
  let appliedHeight = -1;

  const syncPromptHeight = () => {
    const state = useVNStore.getState();
    const gameChanged = state.game !== previousGame;
    previousGame = state.game;
    const actionResolution = resolvePromptActionHeight(
      getCurrentPromptAction(state.game, state.currentSceneId, state.actionIndex),
    );

    // Presentation-only actions can sit between prompts. Keep the previous prompt
    // height through those actions so waits/effects do not introduce a visible shift.
    if (!gameChanged && !actionResolution.isPromptAction) {
      return;
    }

    const nextHeight = actionResolution.promptHeight ?? resolveGamePromptHeight(state.game);
    if (nextHeight === appliedHeight) {
      return;
    }
    appliedHeight = nextHeight;
    applyPromptHeight(nextHeight);
  };

  applyPromptHeight(resolveGamePromptHeight(previousGame));
  appliedHeight = resolveGamePromptHeight(previousGame);
  return useVNStore.subscribe(syncPromptHeight);
}
