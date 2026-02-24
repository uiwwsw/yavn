import JSZip from 'jszip';
import { useVNStore } from './store';
import { parseGameYaml } from './parser';
import type { GameData } from './types';

const AUTOSAVE_KEY = 'vn-engine-autosave';
const EFFECT_DURATIONS: Record<string, number> = {
  shake: 280,
  flash: 350,
  zoom: 420,
  blur: 420,
  darken: 500,
  pulse: 500,
  tilt: 320,
};

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
  const overrides = useVNStore.getState().assetOverrides;
  if (overrides[path]) {
    return overrides[path];
  }
  const normalized = path.replace(/^\.?\//, '');
  if (overrides[normalized]) {
    return overrides[normalized];
  }
  if (/^(blob:|data:|https?:)/i.test(path)) {
    return path;
  }
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
    useVNStore.getState().setForegroundBg(undefined);
    incrementCursor();
    runToNextPause(loopGuard + 1);
    return;
  }

  if ('bgFront' in action) {
    const path = game.assets.backgrounds[action.bgFront];
    useVNStore.getState().setForegroundBg(resolveAsset(state.baseUrl, path));
    incrementCursor();
    runToNextPause(loopGuard + 1);
    return;
  }

  if ('clearBgFront' in action) {
    useVNStore.getState().setForegroundBg(undefined);
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
    const duration = EFFECT_DURATIONS[action.effect] ?? 350;
    effectTimer = window.setTimeout(() => useVNStore.getState().setEffect(undefined), duration);
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
  useVNStore.getState().setGame(result.data, baseUrl, {});

  const save = result.data.settings.autoSave ? loadProgress() : undefined;
  if (save && result.data.scenes[save.sceneId]) {
    useVNStore.getState().setCursor(save.sceneId, save.actionIndex);
  }

  runToNextPause();
}

export async function loadGameFromZip(file: File) {
  clearTimers();
  useVNStore.getState().setError(undefined);
  useVNStore.getState().resetPresentation();
  playMusic(undefined);

  try {
    const zip = await JSZip.loadAsync(file);
    const files = Object.values(zip.files).filter((entry) => !entry.dir);
    const yamlFile =
      files.find((entry) => /(^|\/)sample\.ya?ml$/i.test(entry.name)) ??
      files.find((entry) => /\.ya?ml$/i.test(entry.name));

    if (!yamlFile) {
      useVNStore.getState().setError({ message: 'ZIP 안에서 .yaml 또는 .yml 파일을 찾지 못했습니다.' });
      return;
    }

    const raw = await yamlFile.async('text');
    const parsed = parseGameYaml(raw);
    if (!parsed.data) {
      useVNStore.getState().setError(parsed.error);
      return;
    }

    const yamlDir = yamlFile.name.includes('/') ? yamlFile.name.slice(0, yamlFile.name.lastIndexOf('/') + 1) : '';
    const assetOverrides: Record<string, string> = {};

    for (const entry of files) {
      const relativeToYaml = entry.name.startsWith(yamlDir) ? entry.name.slice(yamlDir.length) : entry.name;
      const blob = await entry.async('blob');
      const blobUrl = URL.createObjectURL(blob);
      assetOverrides[relativeToYaml] = blobUrl;
      assetOverrides[`./${relativeToYaml}`] = blobUrl;
      assetOverrides[entry.name] = blobUrl;
    }

    useVNStore.getState().setGame(parsed.data, window.location.href, assetOverrides);
    runToNextPause();
  } catch (error) {
    useVNStore.getState().setError({
      message: error instanceof Error ? error.message : 'ZIP 처리 중 오류가 발생했습니다.',
    });
  }
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
