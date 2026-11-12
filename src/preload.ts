import { backgroundId } from './cinematic';
import type { GameData } from './types';

function orderedSceneIds(game: GameData): string[] {
  const ids: string[] = [];
  const seen = new Set<string>();
  for (const entry of game.script) {
    if (!seen.has(entry.scene)) {
      seen.add(entry.scene);
      ids.push(entry.scene);
    }
  }
  for (const sceneId of Object.keys(game.scenes)) {
    if (!seen.has(sceneId)) {
      seen.add(sceneId);
      ids.push(sceneId);
    }
  }
  return ids;
}

type SceneAction = GameData['scenes'][string]['actions'][number];

function createAssetCollector(game: GameData) {
  const paths = new Set<string>();
  const addPath = (path?: string) => {
    if (path) {
      paths.add(path);
    }
  };
  const addCharacter = (rawReference?: string) => {
    if (!rawReference) {
      return;
    }
    const [id, emotion] = rawReference.trim().split('.', 2);
    const character = game.assets.characters[id];
    if (!character) {
      return;
    }
    addPath(emotion ? character.emotions?.[emotion] ?? character.base : character.base);
  };
  const addPresentation = (char?: string, withChars?: string[]) => {
    addCharacter(char);
    for (const reference of withChars ?? []) {
      addCharacter(reference);
    }
  };
  const addAction = (action: SceneAction) => {
    if ('bg' in action) {
      addPath(game.assets.backgrounds[backgroundId(action.bg)]);
    } else if ('attack' in action) {
      if (action.attack.image) addPath(game.assets.backgrounds[action.attack.image]);
      addCharacter(action.attack.attacker);
      if (action.attack.target !== 'player') addCharacter(action.attack.target);
    } else if ('sticker' in action) {
      addPath(game.assets.backgrounds[action.sticker.image]);
    } else if ('char' in action) {
      addCharacter(action.char.emotion ? `${action.char.id}.${action.char.emotion}` : action.char.id);
    } else if ('say' in action) {
      addPresentation(action.say.char, action.say.with);
    } else if ('choice' in action) {
      addPresentation(action.choice.char, action.choice.with);
    } else if ('input' in action) {
      addPresentation(action.input.char, action.input.with);
    } else if ('get' in action) {
      addPath(game.inventory?.defaults[action.get]?.image);
    }
  };
  return { paths, addPath, addAction };
}

export function collectChapterAssetPaths(game: GameData): string[] {
  const { paths, addPath, addAction } = createAssetCollector(game);
  for (const sceneId of orderedSceneIds(game)) {
    for (const action of game.scenes[sceneId]?.actions ?? []) {
      addAction(action);
    }
  }

  for (const ending of Object.values(game.endings ?? {})) {
    if (ending.background) addPath(game.assets.backgrounds[ending.background]);
  }
  return [...paths];
}

/**
 * Assets the player sees first: the background in effect at the start position and every
 * asset referenced by the rest of that scene. Chapter loading waits only for these; the
 * remaining chapter assets keep loading in the background after the scene starts.
 */
export function collectStartupAssetPaths(game: GameData, sceneId?: string, actionIndex = 0): string[] {
  const knownScene = Boolean(sceneId && game.scenes[sceneId]);
  const startSceneId = knownScene ? sceneId : game.script[0]?.scene;
  const actions = startSceneId ? game.scenes[startSceneId]?.actions ?? [] : [];
  const startIndex = knownScene ? Math.max(0, Math.min(actionIndex, actions.length)) : 0;
  const { paths, addAction } = createAssetCollector(game);
  for (let index = startIndex - 1; index >= 0; index -= 1) {
    if ('bg' in actions[index]) {
      addAction(actions[index]);
      break;
    }
  }
  const remaining = actions.slice(startIndex);
  for (const action of remaining) {
    addAction(action);
  }
  // Also wait for scenes up to two jumps away (goto, choice options, input routes, branches):
  // openings often pass through a short look-around scene before the cast appears, and the
  // first transitions should not show half-loaded characters.
  const visited = new Set<string>(startSceneId ? [startSceneId] : []);
  let frontier = [...collectGotoTargets(remaining)];
  for (let depth = 0; depth < STARTUP_SCENE_DEPTH && frontier.length > 0; depth += 1) {
    const next: string[] = [];
    for (const target of frontier) {
      if (visited.has(target) || !game.scenes[target]) continue;
      visited.add(target);
      const targetActions = game.scenes[target].actions;
      for (const action of targetActions) {
        addAction(action);
      }
      next.push(...collectGotoTargets(targetActions));
    }
    frontier = next;
  }
  return [...paths];
}

const STARTUP_SCENE_DEPTH = 2;

function collectGotoTargets(value: unknown, targets = new Set<string>()): Set<string> {
  if (Array.isArray(value)) {
    for (const entry of value) collectGotoTargets(entry, targets);
  } else if (value && typeof value === 'object') {
    for (const [key, entry] of Object.entries(value)) {
      if (key === 'goto' && typeof entry === 'string') targets.add(entry);
      else collectGotoTargets(entry, targets);
    }
  }
  return targets;
}
