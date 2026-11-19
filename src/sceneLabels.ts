import { backgroundId } from './cinematic';
import type { Action, BackgroundDirective, GameData, Scene } from './types';

/** Read existing author captions without deriving a clock time from the device. */
export function captionContext(text: string): { name?: string; time?: string } {
  const parts = text.split('·').map((part) => part.trim()).filter(Boolean);
  const isTime = (part: string) => /\d\s*[:시년월일]|오전|오후|새벽|아침|점심|저녁|밤|그날|다음\s*날|같은\s*날|잠시\s*뒤|며칠|직후|직전|이튿날|해 질 녘|[월화수목금토일]요일|morning|afternoon|evening|night|\d:\d/i.test(part);
  return {
    name: parts.filter((part) => !isTime(part)).join(' · ') || undefined,
    time: parts.filter(isTime).join(' · ') || undefined,
  };
}

/** Only setup actions may sit between a background and its existing caption. */
export function followingPlace(actions: Action[], index: number): number | undefined {
  for (let i = index + 1; i < actions.length; i += 1) {
    const action = actions[i];
    if ('place' in action) return i;
    if ('music' in action || 'sound' in action || 'char' in action
      || 'camera' in action || 'effect' in action || 'mood' in action) continue;
    return undefined;
  }
  return undefined;
}

export function resolveSceneLabel(
  game: GameData, scene: Pick<Scene, 'time'>, bg: BackgroundDirective, previousTime?: string, legacyText?: string,
): { text?: string; time?: string } {
  const id = backgroundId(bg);
  const metadata = game.assets.backgroundLabels?.[id];
  const definition = typeof metadata === 'string' ? { name: metadata } : metadata || {};
  const options = typeof bg === 'string' ? undefined : bg.label;
  const override = typeof options === 'object' ? options : {};
  const legacy = legacyText ? captionContext(legacyText) : {};
  const time = typeof override.time === 'string' ? override.time
    : legacy.time ?? previousTime ?? scene.time ?? definition.time;
  const enabled = options === false ? false : options === true || typeof options === 'object'
    ? true : game.settings.sceneLabels !== false && metadata !== false;
  if (!enabled) return { time };
  // Preserve authored punctuation and POV text unless a structured override was supplied.
  if (legacyText && typeof options !== 'object') return { text: legacyText, time };
  const name = override.name === false ? undefined : override.name ?? legacy.name
    ?? definition.name ?? id.replace(/[_-]+/g, ' ');
  const displayTime = override.time === false ? undefined : time ?? '시간 미상';
  return { text: [displayTime, name].filter(Boolean).join(' · ') || undefined, time };
}
