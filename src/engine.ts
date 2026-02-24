import { useVNStore } from './store';
import { parseGameYaml } from './parser';
import type { GameData } from './types';

const AUTOSAVE_KEY = 'vn-engine-autosave';

let waitTimer: number | undefined;
let typeTimer: number | undefined;
let effectTimer: number | undefined;
let bgmAudio: HTMLAudioElement | undefined;

function clearTimers() {
  if (waitTimer) {
    window.clearTimeout(waitTimer);
    waitTimer = undefined;
  }
  if (typeTimer) {
    window.clearInterval(typeTimer);
    typeTimer = undefined;
  }
  if (effectTimer) {
    window.clearTimeout(effectTimer);
    effectTimer = undefined;
  }
}

function resolveAsset(baseUrl: string, path: string): string {
  try {
    return new URL(path, baseUrl).toString();
  } catch {
    return path;
  }
}

function parseInlineSpeed(text: string): { speed?: number; text: string } {
  const match = text.match(/<speed=(\d+)>([\s\S]*?)<\/speed>/i);
  if (!match) {
    return { text };
  }
  return {
    speed: Number(match[1]),
    text: text.replace(/<speed=\d+>([\s\S]*?)<\/speed>/gi, '$1'),
  };
}

function getSpeakerName(game: GameData, id?: string) {
  if (!id) {
    return undefined;
  }
  return id;
}

function saveProgress(sceneId: string, actionIndex: number) {
  localStorage.setItem(AUTOSAVE_KEY, JSON.stringify({ sceneId, actionIndex }));
}

function loadProgress(): { sceneId: string; actionIndex: number } | undefined {
  const raw = localStorage.getItem(AUTOSAVE_KEY);
  if (!raw) {
    return undefined;
  }
  try {
    return JSON.parse(raw) as { sceneId: string; actionIndex: number };
  } catch {
    return undefined;
  }
}

function playMusic(url?: string) {
  if (!url) {
    if (bgmAudio) {
      bgmAudio.pause();
      bgmAudio = undefined;
    }
    return;
  }
  if (bgmAudio?.src === url) {
    return;
  }
  if (bgmAudio) {
    bgmAudio.pause();
  }
  bgmAudio = new Audio(url);
  bgmAudio.loop = true;
  bgmAudio.volume = 0.6;
  void bgmAudio.play().catch(() => undefined);
}

function playSound(url: string) {
  const audio = new Audio(url);
  audio.volume = 0.8;
  void audio.play().catch(() => undefined);
}

function incrementCursor() {
  const state = useVNStore.getState();
  useVNStore.getState().setCursor(state.currentSceneId, state.actionIndex + 1);
  if (state.game?.settings.autoSave) {
    saveProgress(state.currentSceneId, state.actionIndex + 1);
  }
}

function setCursor(sceneId: string, actionIndex: number) {
  useVNStore.getState().setCursor(sceneId, actionIndex);
  if (useVNStore.getState().game?.settings.autoSave) {
    saveProgress(sceneId, actionIndex);
  }
}

function typeDialog(text: string, speed: number, onDone: () => void) {
  if (text.length === 0) {
    useVNStore.getState().setDialog({ typing: false, visibleText: '' });
    onDone();
    return;
  }
  const cps = Math.max(1, speed);
  let idx = 0;
  useVNStore.getState().setDialog({ typing: true, visibleText: '' });
  typeTimer = window.setInterval(() => {
    idx += 1;
    useVNStore.getState().setDialog({ visibleText: text.slice(0, idx) });
    if (idx >= text.length) {
      if (typeTimer) {
        window.clearInterval(typeTimer);
        typeTimer = undefined;
      }
      useVNStore.getState().setDialog({ typing: false, visibleText: text });
      onDone();
    }
  }, Math.max(16, Math.floor(1000 / cps)));
}

function runToNextPause(loopGuard = 0) {
  if (loopGuard > 1000) {
    useVNStore.getState().setError({ message: 'Infinite loop detected in script execution' });
    return;
  }

  const state = useVNStore.getState();
  const game = state.game;
  if (!game) {
    return;
  }

  const scene = game.scenes[state.currentSceneId];
  if (!scene) {
    useVNStore.getState().setError({ message: `Scene not found: ${state.currentSceneId}` });
    return;
  }

  const action = scene.actions[state.actionIndex];
  if (!action) {
    const sceneOrder = game.script.map((entry) => entry.scene);
    const idx = sceneOrder.indexOf(state.currentSceneId);
    const nextScene = sceneOrder[idx + 1];
    if (nextScene) {
      setCursor(nextScene, 0);
      runToNextPause(loopGuard + 1);
      return;
    }
    useVNStore.getState().setFinished(true);
    useVNStore.getState().setWaitingInput(false);
    return;
  }

  if ('bg' in action) {
    const path = game.assets.backgrounds[action.bg];
    useVNStore.getState().setBackground(resolveAsset(state.baseUrl, path));
    incrementCursor();
    runToNextPause(loopGuard + 1);
    return;
  }

  if ('music' in action) {
    const path = game.assets.music[action.music];
    const url = resolveAsset(state.baseUrl, path);
    useVNStore.getState().setMusic(url);
    playMusic(url);
    incrementCursor();
    runToNextPause(loopGuard + 1);
    return;
  }

  if ('sound' in action) {
    const path = game.assets.sfx[action.sound];
    playSound(resolveAsset(state.baseUrl, path));
    incrementCursor();
    runToNextPause(loopGuard + 1);
    return;
  }

  if ('char' in action) {
    const charDef = game.assets.characters[action.char.id];
    const imagePath = action.char.emotion
      ? charDef.emotions?.[action.char.emotion] ?? charDef.base
      : charDef.base;
    useVNStore
      .getState()
      .setCharacter(action.char.position, { id: action.char.id, image: resolveAsset(state.baseUrl, imagePath) });
    incrementCursor();
    runToNextPause(loopGuard + 1);
    return;
  }

  if ('effect' in action) {
    useVNStore.getState().setEffect(action.effect);
    effectTimer = window.setTimeout(() => useVNStore.getState().setEffect(undefined), 350);
    incrementCursor();
    runToNextPause(loopGuard + 1);
    return;
  }

  if ('goto' in action) {
    setCursor(action.goto, 0);
    runToNextPause(loopGuard + 1);
    return;
  }

  if ('wait' in action) {
    useVNStore.getState().setBusy(true);
    waitTimer = window.setTimeout(() => {
      useVNStore.getState().setBusy(false);
      incrementCursor();
      runToNextPause(loopGuard + 1);
    }, action.wait);
    return;
  }

  if ('say' in action) {
    const parsed = parseInlineSpeed(action.say.text);
    const textSpeed = parsed.speed ?? game.settings.textSpeed;
    useVNStore.getState().setWaitingInput(true);
    useVNStore.getState().setDialog({
      speaker: getSpeakerName(game, action.say.char),
      fullText: parsed.text,
      visibleText: '',
      typing: true,
    });
    typeDialog(parsed.text, textSpeed, () => undefined);
    return;
  }
}

export async function loadGameFromUrl(url: string) {
  clearTimers();
  useVNStore.getState().setError(undefined);
  useVNStore.getState().resetPresentation();
  playMusic(undefined);

  const response = await fetch(url);
  if (!response.ok) {
    useVNStore.getState().setError({ message: `Failed to load yaml: ${response.status}` });
    return;
  }

  const raw = await response.text();
  const result = parseGameYaml(raw);
  if (!result.data) {
    useVNStore.getState().setError(result.error);
    return;
  }

  const baseUrl = new URL('.', new URL(url, window.location.origin)).toString();
  useVNStore.getState().setGame(result.data, baseUrl);

  const save = result.data.settings.autoSave ? loadProgress() : undefined;
  if (save && result.data.scenes[save.sceneId]) {
    useVNStore.getState().setCursor(save.sceneId, save.actionIndex);
  }

  runToNextPause();
}

export function handleAdvance() {
  const state = useVNStore.getState();
  if (!state.game || state.busy || state.isFinished) {
    return;
  }

  if (state.waitingInput) {
    if (state.dialog.typing && state.game.settings.clickToInstant) {
      if (typeTimer) {
        window.clearInterval(typeTimer);
        typeTimer = undefined;
      }
      useVNStore.getState().setDialog({ typing: false, visibleText: state.dialog.fullText });
      return;
    }
    useVNStore.getState().setWaitingInput(false);
    useVNStore.getState().setDialog({ speaker: undefined, fullText: '', visibleText: '', typing: false });
    incrementCursor();
    runToNextPause();
    return;
  }

  // Fallback: if state got out of sync, continue interpreter on user input.
  runToNextPause();
}
