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

/** Explicit author sizes win; otherwise give interactive prompts room to breathe. */
export function resolveInteractivePromptHeight(game: GameData | undefined, action: Action | undefined, compact: boolean): number {
  const explicit = resolvePromptActionHeight(action).promptHeight
    ?? normalizePromptHeight((game as PromptLayoutGame | undefined)?.ui?.promptHeight);
  if (explicit !== undefined) return explicit;
  if (action && 'choice' in action) {
    if (action.choice.presentation === 'explore') {
      const footerCount = action.choice.options.filter(option => !option.at).length;
      return 132 + Math.min(2, footerCount) * 58;
    }
    const count = action.choice.options.length;
    const rows = compact || count > 4 ? count : Math.ceil(count / 2);
    return 152 + Math.min(4, Math.max(1, rows)) * 64 + (action.choice.timeoutMs ? 36 : 0);
  }
  if (action && 'input' in action) return 220;
  if (action && 'say' in action && action.say.continueLabel) return 210;
  return DEFAULT_PROMPT_HEIGHT_PX;
}

function getCurrentPromptAction(game: GameData | undefined, sceneId: string, actionIndex: number): Action | undefined {
  return game?.scenes[sceneId]?.actions[actionIndex];
}

/**
 * Nothing to read and nothing to answer: a wait, a background change, an actor crossing the
 * stage. The frame steps out for those instead of standing empty. The phone and full-screen
 * cards are places rather than frames, so they stay through the gap between two messages.
 */
export function isPromptVacant(prompt: {
  hidden: boolean; hasText: boolean; choiceActive: boolean; inputActive: boolean; channel: string;
}): boolean {
  return !prompt.hidden && !prompt.hasText && !prompt.choiceActive && !prompt.inputActive
    && prompt.channel !== 'message' && prompt.channel !== 'card';
}

export function resolvePromptActorInset(measuredInset: number, measuredHeight: number, readingHeight: number): number {
  return Math.max(0, measuredInset - Math.max(0, measuredHeight - readingHeight));
}

function applyPromptHeight(height: number, characterHeight = height): void {
  if (typeof document === 'undefined') {
    return;
  }
  document.documentElement.style.setProperty('--yavn-prompt-height', `${height}px`);
  document.documentElement.style.setProperty('--yavn-character-prompt-height', `${characterHeight}px`);
}

export function initializePromptLayout(): () => void {
  let previousGame = useVNStore.getState().game;
  let appliedHeight = -1;
  let appliedCharacterHeight = -1;

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

    const nextHeight = resolveInteractivePromptHeight(state.game,
      getCurrentPromptAction(state.game, state.currentSceneId, state.actionIndex),
      typeof window !== 'undefined' && window.matchMedia('(max-width: 768px)').matches);
    const characterHeight = actionResolution.promptHeight ?? resolveGamePromptHeight(state.game);
    if (nextHeight === appliedHeight && characterHeight === appliedCharacterHeight) {
      return;
    }
    appliedHeight = nextHeight;
    appliedCharacterHeight = characterHeight;
    applyPromptHeight(nextHeight, characterHeight);
  };

  applyPromptHeight(resolveGamePromptHeight(previousGame));
  appliedHeight = resolveGamePromptHeight(previousGame);
  const unsubscribe = useVNStore.subscribe(syncPromptHeight);
  const compact = typeof window !== 'undefined' ? window.matchMedia('(max-width: 768px)') : undefined;
  compact?.addEventListener('change', syncPromptHeight);
  return () => { unsubscribe(); compact?.removeEventListener('change', syncPromptHeight); };
}

/**
 * Where the dialogue box should be scrolled after a text update.
 *
 * A line longer than the box types on out of sight, so while it is typing we follow it down
 * and keep the newest words in view. A new line starts at the top so it reads from the
 * beginning, and a line the reader completed with a click is left where it is, so its opening
 * stays visible and they can scroll at their own pace.
 */
export function resolveDialogueScroll(
  { lineChanged, typing, thread = false }: { lineChanged: boolean; typing: boolean; thread?: boolean },
): 'top' | 'bottom' | 'keep' {
  // Finishing phone typing can add a wrapped line in the same update that clears `typing`.
  // Follow that final height too, so the last bubble stays above the phone's footer.
  if (thread) return 'bottom';
  if (lineChanged) return 'top';
  return typing ? 'bottom' : 'keep';
}
