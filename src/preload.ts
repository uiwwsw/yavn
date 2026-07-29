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

export function collectChapterAssetPaths(game: GameData): string[] {
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

  for (const sceneId of orderedSceneIds(game)) {
    for (const action of game.scenes[sceneId]?.actions ?? []) {
      if ('bg' in action) {
        addPath(game.assets.backgrounds[action.bg]);
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
    }
  }

  return [...paths];
}
