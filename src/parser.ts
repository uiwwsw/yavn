import { load, YAMLException } from 'js-yaml';
import { ZodError } from 'zod';
import { gameSchema } from './schema';
import type { GameData, VNError } from './types';

function parseSpeakerRef(raw: string): { id?: string; emotion?: string; invalid: boolean } {
  const trimmed = raw.trim();
  if (!trimmed) {
    return { invalid: true };
  }
  const parts = trimmed.split('.');
  if (parts.length > 2 || parts.some((part) => part.length === 0)) {
    return { invalid: true };
  }
  return {
    id: parts[0],
    emotion: parts[1],
    invalid: false,
  };
}

export function parseGameYaml(raw: string): { data?: GameData; error?: VNError } {
  try {
    const parsed = load(raw);
    const data = gameSchema.parse(parsed) as GameData;

    const scriptSceneIds = new Set(data.script.map((entry) => entry.scene));
    for (const sceneId of scriptSceneIds) {
      if (!data.scenes[sceneId]) {
        return { error: { message: `script references missing scene: ${sceneId}` } };
      }
    }

    const validateCharacterRef = (sceneId: string, fieldLabel: string, value: string): VNError | undefined => {
      const speaker = parseSpeakerRef(value);
      if (speaker.invalid || !speaker.id) {
        return {
          message: `scene '${sceneId}' has invalid ${fieldLabel} '${value}' (use 'characterId' or 'characterId.emotion')`,
        };
      }
      const charDef = data.assets.characters[speaker.id];
      if (!charDef) {
        return {
          message: `scene '${sceneId}' uses missing speaker character '${speaker.id}' in ${fieldLabel}`,
        };
      }
      if (speaker.emotion && !charDef.emotions?.[speaker.emotion]) {
        return {
          message: `scene '${sceneId}' uses missing emotion '${speaker.emotion}' for speaker '${speaker.id}' in ${fieldLabel}`,
        };
      }
      return undefined;
    };

    for (const [sceneId, scene] of Object.entries(data.scenes)) {
      for (const action of scene.actions) {
        if ('goto' in action && !data.scenes[action.goto]) {
          return {
            error: {
              message: `scene '${sceneId}' has goto to missing scene '${action.goto}'`,
            },
          };
        }
        if ('bg' in action && !data.assets.backgrounds[action.bg]) {
          return {
            error: {
              message: `scene '${sceneId}' uses missing background '${action.bg}'`,
            },
          };
        }
        if ('sticker' in action && !data.assets.backgrounds[action.sticker.image]) {
          return {
            error: {
              message: `scene '${sceneId}' uses missing sticker image '${action.sticker.image}'`,
            },
          };
        }
        if ('music' in action && !data.assets.music[action.music]) {
          return {
            error: {
              message: `scene '${sceneId}' uses missing music '${action.music}'`,
            },
          };
        }
        if ('sound' in action && !data.assets.sfx[action.sound]) {
          return {
            error: {
              message: `scene '${sceneId}' uses missing sfx '${action.sound}'`,
            },
          };
        }
        if ('char' in action && !data.assets.characters[action.char.id]) {
          return {
            error: {
              message: `scene '${sceneId}' uses missing character '${action.char.id}'`,
            },
          };
        }
        if ('say' in action && action.say.char) {
          const error = validateCharacterRef(sceneId, 'say.char', action.say.char);
          if (error) {
            return { error };
          }
        }
        if ('say' in action && Array.isArray(action.say.with)) {
          for (const [index, withChar] of action.say.with.entries()) {
            const error = validateCharacterRef(sceneId, `say.with[${index}]`, withChar);
            if (error) {
              return { error };
            }
          }
        }
      }
    }

    return { data };
  } catch (err) {
    if (err instanceof YAMLException) {
      return {
        error: {
          message: err.reason || 'Invalid YAML',
          line: err.mark?.line !== undefined ? err.mark.line + 1 : undefined,
          column: err.mark?.column !== undefined ? err.mark.column + 1 : undefined,
          details: err.message,
        },
      };
    }
    if (err instanceof ZodError) {
      const issue = err.issues[0];
      return {
        error: {
          message: `Schema validation failed at ${issue.path.join('.') || 'root'}: ${issue.message}`,
          details: err.issues.map((v) => `${v.path.join('.') || 'root'}: ${v.message}`).join(' | '),
        },
      };
    }
    return {
      error: {
        message: err instanceof Error ? err.message : 'Unknown parse error',
      },
    };
  }
}
