import { load, YAMLException } from 'js-yaml';
import { ZodError } from 'zod';
import { gameSchema } from './schema';
import type { ConditionNode, GameData, RouteVarValue, VNError } from './types';

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

function isChapterGotoTarget(target: string): boolean {
  const trimmed = target.trim().replace(/\\/g, '/');
  return trimmed.startsWith('./') || trimmed.startsWith('/');
}

function hasParentTraversal(path: string): boolean {
  const normalized = path.replace(/\\/g, '/');
  const body = normalized.replace(/^(\.\/|\/)+/, '');
  return body.split('/').some((segment) => segment === '..');
}

function isUnsupportedRelativeChapterTarget(target: string): boolean {
  const normalized = target.trim().replace(/\\/g, '/');
  if (normalized === '..' || normalized.startsWith('../')) {
    return true;
  }
  if (isChapterGotoTarget(normalized) && hasParentTraversal(normalized)) {
    return true;
  }
  return false;
}

function validateGotoReference(
  sceneId: string,
  fieldLabel: string,
  target: string,
  scenes: GameData['scenes'],
): VNError | undefined {
  if (isUnsupportedRelativeChapterTarget(target)) {
    return {
      message: `scene '${sceneId}' uses unsupported relative chapter path '${target}' in ${fieldLabel} (use './...' or '/...' from root)`,
    };
  }
  if (isChapterGotoTarget(target)) {
    return undefined;
  }
  if (!scenes[target]) {
    return {
      message: `scene '${sceneId}' has ${fieldLabel} to missing scene '${target}'`,
    };
  }
  return undefined;
}

function hasOwn(obj: Record<string, unknown>, key: string): boolean {
  return Object.prototype.hasOwnProperty.call(obj, key);
}

function isScalar(value: RouteVarValue | RouteVarValue[]): value is RouteVarValue {
  return !Array.isArray(value);
}

function validateCondition(
  sceneId: string,
  fieldLabel: string,
  condition: ConditionNode,
  defaults: Record<string, RouteVarValue>,
): VNError | undefined {
  if ('all' in condition) {
    for (let idx = 0; idx < condition.all.length; idx += 1) {
      const error = validateCondition(sceneId, `${fieldLabel}.all[${idx}]`, condition.all[idx], defaults);
      if (error) {
        return error;
      }
    }
    return undefined;
  }

  if ('any' in condition) {
    for (let idx = 0; idx < condition.any.length; idx += 1) {
      const error = validateCondition(sceneId, `${fieldLabel}.any[${idx}]`, condition.any[idx], defaults);
      if (error) {
        return error;
      }
    }
    return undefined;
  }

  if ('not' in condition) {
    return validateCondition(sceneId, `${fieldLabel}.not`, condition.not, defaults);
  }

  if (!hasOwn(defaults, condition.var)) {
    return {
      message: `scene '${sceneId}' uses unknown state variable '${condition.var}' in ${fieldLabel}`,
    };
  }

  const defaultValue = defaults[condition.var];
  const expectedType = typeof defaultValue;
  const value = condition.value;

  if (condition.op === 'in') {
    if (!Array.isArray(value)) {
      return {
        message: `scene '${sceneId}' uses op 'in' with non-array value in ${fieldLabel}`,
      };
    }
    for (const candidate of value) {
      if (typeof candidate !== expectedType) {
        return {
          message: `scene '${sceneId}' has type mismatch in ${fieldLabel}: variable '${condition.var}' is ${expectedType}`,
        };
      }
    }
    return undefined;
  }

  if (!isScalar(value)) {
    return {
      message: `scene '${sceneId}' uses array value with op '${condition.op}' in ${fieldLabel}`,
    };
  }

  if (typeof value !== expectedType) {
    return {
      message: `scene '${sceneId}' has type mismatch in ${fieldLabel}: variable '${condition.var}' is ${expectedType}`,
    };
  }

  if (['gt', 'gte', 'lt', 'lte'].includes(condition.op) && expectedType !== 'number') {
    return {
      message: `scene '${sceneId}' uses numeric comparison op '${condition.op}' for non-number variable '${condition.var}' in ${fieldLabel}`,
    };
  }

  return undefined;
}

function validateSetMap(
  sceneId: string,
  fieldLabel: string,
  setMap: Record<string, RouteVarValue>,
  defaults: Record<string, RouteVarValue>,
): VNError | undefined {
  for (const [key, value] of Object.entries(setMap)) {
    if (!hasOwn(defaults, key)) {
      return {
        message: `scene '${sceneId}' sets unknown state variable '${key}' in ${fieldLabel}`,
      };
    }
    if (typeof value !== typeof defaults[key]) {
      return {
        message: `scene '${sceneId}' has type mismatch for state variable '${key}' in ${fieldLabel}`,
      };
    }
  }
  return undefined;
}

function validateAddMap(
  sceneId: string,
  fieldLabel: string,
  addMap: Record<string, number>,
  defaults: Record<string, RouteVarValue>,
): VNError | undefined {
  for (const key of Object.keys(addMap)) {
    if (!hasOwn(defaults, key)) {
      return {
        message: `scene '${sceneId}' adds unknown state variable '${key}' in ${fieldLabel}`,
      };
    }
    if (typeof defaults[key] !== 'number') {
      return {
        message: `scene '${sceneId}' can only use add on number variable '${key}' in ${fieldLabel}`,
      };
    }
  }
  return undefined;
}

export function parseGameYaml(raw: string): { data?: GameData; error?: VNError } {
  try {
    const parsed = load(raw);
    const data = gameSchema.parse(parsed) as GameData;
    const defaults = data.state?.defaults ?? {};

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

    if (data.defaultEnding && !data.endings?.[data.defaultEnding]) {
      return {
        error: {
          message: `defaultEnding '${data.defaultEnding}' is not defined in endings`,
        },
      };
    }

    if (data.endingRules) {
      for (const [index, rule] of data.endingRules.entries()) {
        if (!data.endings?.[rule.ending]) {
          return {
            error: {
              message: `endingRules[${index}] references missing ending '${rule.ending}'`,
            },
          };
        }
        const error = validateCondition('global', `endingRules[${index}].when`, rule.when, defaults);
        if (error) {
          return { error };
        }
      }
    }

    for (const [sceneId, scene] of Object.entries(data.scenes)) {
      for (const [actionIndex, action] of scene.actions.entries()) {
        if ('goto' in action) {
          const gotoError = validateGotoReference(sceneId, 'goto', action.goto, data.scenes);
          if (gotoError) {
            return { error: gotoError };
          }
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

        if ('set' in action) {
          const error = validateSetMap(sceneId, `actions[${actionIndex}].set`, action.set, defaults);
          if (error) {
            return { error };
          }
        }

        if ('add' in action) {
          const error = validateAddMap(sceneId, `actions[${actionIndex}].add`, action.add, defaults);
          if (error) {
            return { error };
          }
        }

        if ('choice' in action) {
          for (const [optionIndex, option] of action.choice.options.entries()) {
            if (option.goto) {
              const gotoError = validateGotoReference(
                sceneId,
                `choice.options[${optionIndex}].goto`,
                option.goto,
                data.scenes,
              );
              if (gotoError) {
                return { error: gotoError };
              }
            }
            if (option.set) {
              const error = validateSetMap(
                sceneId,
                `actions[${actionIndex}].choice.options[${optionIndex}].set`,
                option.set,
                defaults,
              );
              if (error) {
                return { error };
              }
            }
            if (option.add) {
              const error = validateAddMap(
                sceneId,
                `actions[${actionIndex}].choice.options[${optionIndex}].add`,
                option.add,
                defaults,
              );
              if (error) {
                return { error };
              }
            }
          }
        }

        if ('branch' in action) {
          for (const [caseIndex, branchCase] of action.branch.cases.entries()) {
            const gotoError = validateGotoReference(
              sceneId,
              `branch.cases[${caseIndex}].goto`,
              branchCase.goto,
              data.scenes,
            );
            if (gotoError) {
              return { error: gotoError };
            }
            const error = validateCondition(
              sceneId,
              `actions[${actionIndex}].branch.cases[${caseIndex}].when`,
              branchCase.when,
              defaults,
            );
            if (error) {
              return { error };
            }
          }
          if (action.branch.default) {
            const gotoError = validateGotoReference(sceneId, 'branch.default', action.branch.default, data.scenes);
            if (gotoError) {
              return { error: gotoError };
            }
          }
        }

        if ('input' in action) {
          if (action.input.saveAs) {
            if (!hasOwn(defaults, action.input.saveAs)) {
              return {
                error: {
                  message: `scene '${sceneId}' uses unknown input.saveAs variable '${action.input.saveAs}'`,
                },
              };
            }
            if (typeof defaults[action.input.saveAs] !== 'string') {
              return {
                error: {
                  message: `scene '${sceneId}' input.saveAs '${action.input.saveAs}' must target a string variable`,
                },
              };
            }
          }
          for (const [routeIndex, route] of action.input.routes.entries()) {
            if (route.goto) {
              const gotoError = validateGotoReference(
                sceneId,
                `input.routes[${routeIndex}].goto`,
                route.goto,
                data.scenes,
              );
              if (gotoError) {
                return { error: gotoError };
              }
            }
            if (route.set) {
              const error = validateSetMap(sceneId, `actions[${actionIndex}].input.routes[${routeIndex}].set`, route.set, defaults);
              if (error) {
                return { error };
              }
            }
            if (route.add) {
              const error = validateAddMap(sceneId, `actions[${actionIndex}].input.routes[${routeIndex}].add`, route.add, defaults);
              if (error) {
                return { error };
              }
            }
          }
        }

        if ('ending' in action && !data.endings?.[action.ending]) {
          return {
            error: {
              message: `scene '${sceneId}' references missing ending '${action.ending}'`,
            },
          };
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
