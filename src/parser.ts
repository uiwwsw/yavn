import { load, YAMLException } from 'js-yaml';
import { ZodError } from 'zod';
import { baseLayerSchema, chapterSchema, configSchema, gameSchema } from './schema';
import type { ConditionNode, GameData, RouteVarValue, VNError } from './types';

type ConfigYamlData = {
  title: string;
  author?: GameData['meta']['author'];
  version?: string;
  textSpeed: number;
  autoSave: boolean;
  clickToInstant: boolean;
  endings?: GameData['endings'];
  endingRules?: GameData['endingRules'];
  defaultEnding?: GameData['defaultEnding'];
};

type LayerAssets = {
  backgrounds?: GameData['assets']['backgrounds'];
  characters?: GameData['assets']['characters'];
  music?: GameData['assets']['music'];
  sfx?: GameData['assets']['sfx'];
};

type LayerYamlData = {
  assets?: LayerAssets;
  state?: Record<string, RouteVarValue>;
};

type ChapterYamlData = LayerYamlData & {
  script: GameData['script'];
  scenes: GameData['scenes'];
};

export type ParsedConfigYaml = {
  sourcePath: string;
  sourceDir: string;
  data: ConfigYamlData;
};

export type ParsedBaseYaml = {
  sourcePath: string;
  sourceDir: string;
  data: LayerYamlData;
};

export type ParsedChapterYaml = {
  sourcePath: string;
  sourceDir: string;
  data: ChapterYamlData;
};

type ResolveChapterInput = {
  config: ParsedConfigYaml;
  bases: ParsedBaseYaml[];
  chapter: ParsedChapterYaml;
};

const LEGACY_TOP_LEVEL_KEYS = ['meta', 'settings'] as const;
const CONFIG_ONLY_KEYS = [
  'title',
  'author',
  'version',
  'textSpeed',
  'autoSave',
  'clickToInstant',
  'endings',
  'endingRules',
  'defaultEnding',
] as const;

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

function normalizePath(rawPath: string): string {
  return rawPath.replace(/\\/g, '/');
}

function collapsePathDots(path: string): string {
  const normalized = normalizePath(path);
  const parts = normalized.split('/');
  const stack: string[] = [];
  for (const part of parts) {
    if (!part || part === '.') {
      continue;
    }
    if (part === '..') {
      if (stack.length > 0) {
        stack.pop();
      }
      continue;
    }
    stack.push(part);
  }
  return stack.join('/');
}

function normalizeSourcePath(sourcePath: string): string {
  const normalized = normalizePath(sourcePath).replace(/^\.\//, '');
  return normalized.length > 0 ? normalized : 'unknown.yaml';
}

function getSourceDir(sourcePath: string): string {
  const normalized = normalizeSourcePath(sourcePath);
  const idx = normalized.lastIndexOf('/');
  if (idx < 0) {
    return '';
  }
  return normalized.slice(0, idx + 1);
}

function isExternalPath(path: string): boolean {
  return /^(blob:|data:|https?:|[a-z][a-z0-9+.-]*:)/i.test(path);
}

function canonicalizeDeclaredPath(path: string, sourceDir: string): string | undefined {
  const trimmed = path.trim();
  if (!trimmed) {
    return undefined;
  }
  if (isExternalPath(trimmed)) {
    return trimmed;
  }
  const normalized = normalizePath(trimmed);
  const joined = normalized.startsWith('/') ? normalized.slice(1) : `${sourceDir}${normalized}`;
  const collapsed = collapsePathDots(joined);
  return collapsed.length > 0 ? collapsed : undefined;
}

function parseYamlRoot(raw: string): { value?: Record<string, unknown>; error?: VNError } {
  try {
    const parsed = load(raw);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return { error: { message: 'YAML root must be an object map' } };
    }
    return { value: parsed as Record<string, unknown> };
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
    return {
      error: {
        message: err instanceof Error ? err.message : 'Unknown parse error',
      },
    };
  }
}

function mapZodError(error: ZodError, sourcePath?: string): VNError {
  const issue = error.issues[0];
  const prefix = sourcePath ? `${sourcePath}: ` : '';
  return {
    message: `${prefix}Schema validation failed at ${issue.path.join('.') || 'root'}: ${issue.message}`,
    details: error.issues.map((v) => `${v.path.join('.') || 'root'}: ${v.message}`).join(' | '),
  };
}

function firstIncludedKey<T extends readonly string[]>(obj: Record<string, unknown>, keys: T): T[number] | undefined {
  return keys.find((key) => hasOwn(obj, key));
}

function canonicalizeLayerAssets(
  assets: LayerAssets | undefined,
  sourceDir: string,
  sourcePath: string,
): { data?: GameData['assets']; error?: VNError } {
  if (!assets) {
    return { data: undefined };
  }

  const result: GameData['assets'] = {
    backgrounds: {},
    characters: {},
    music: {},
    sfx: {},
  };

  for (const [key, value] of Object.entries(assets.backgrounds ?? {})) {
    const normalized = canonicalizeDeclaredPath(value, sourceDir);
    if (!normalized) {
      return {
        error: {
          message: `${sourcePath}: assets.backgrounds.${key} has invalid path '${value}'`,
        },
      };
    }
    result.backgrounds[key] = normalized;
  }

  for (const [charKey, charDef] of Object.entries(assets.characters ?? {})) {
    const base = canonicalizeDeclaredPath(charDef.base, sourceDir);
    if (!base) {
      return {
        error: {
          message: `${sourcePath}: assets.characters.${charKey}.base has invalid path '${charDef.base}'`,
        },
      };
    }
    const emotions: Record<string, string> = {};
    for (const [emoKey, emoPath] of Object.entries(charDef.emotions ?? {})) {
      const normalized = canonicalizeDeclaredPath(emoPath, sourceDir);
      if (!normalized) {
        return {
          error: {
            message: `${sourcePath}: assets.characters.${charKey}.emotions.${emoKey} has invalid path '${emoPath}'`,
          },
        };
      }
      emotions[emoKey] = normalized;
    }
    result.characters[charKey] = {
      base,
      ...(Object.keys(emotions).length > 0 ? { emotions } : {}),
    };
  }

  for (const [key, value] of Object.entries(assets.music ?? {})) {
    const normalized = canonicalizeDeclaredPath(value, sourceDir);
    if (!normalized) {
      return {
        error: {
          message: `${sourcePath}: assets.music.${key} has invalid path '${value}'`,
        },
      };
    }
    result.music[key] = normalized;
  }

  for (const [key, value] of Object.entries(assets.sfx ?? {})) {
    const normalized = canonicalizeDeclaredPath(value, sourceDir);
    if (!normalized) {
      return {
        error: {
          message: `${sourcePath}: assets.sfx.${key} has invalid path '${value}'`,
        },
      };
    }
    result.sfx[key] = normalized;
  }

  if (
    Object.keys(result.backgrounds).length === 0 &&
    Object.keys(result.characters).length === 0 &&
    Object.keys(result.music).length === 0 &&
    Object.keys(result.sfx).length === 0
  ) {
    return { data: undefined };
  }

  return { data: result };
}

function canonicalizeSceneVideoPaths(
  scenes: GameData['scenes'],
  sourceDir: string,
  sourcePath: string,
): { data?: GameData['scenes']; error?: VNError } {
  const cloned = structuredClone(scenes);
  for (const [sceneId, scene] of Object.entries(cloned)) {
    for (const [actionIndex, action] of scene.actions.entries()) {
      if (!('video' in action)) {
        continue;
      }
      const normalized = canonicalizeDeclaredPath(action.video.src, sourceDir);
      if (!normalized) {
        return {
          error: {
            message: `${sourcePath}: scenes.${sceneId}.actions[${actionIndex}].video.src has invalid path '${action.video.src}'`,
          },
        };
      }
      action.video.src = normalized;
    }
  }
  return { data: cloned };
}

export function parseConfigYaml(raw: string, sourcePath: string): { data?: ParsedConfigYaml; error?: VNError } {
  const normalizedSourcePath = normalizeSourcePath(sourcePath);
  const parsedRoot = parseYamlRoot(raw);
  if (!parsedRoot.value) {
    if (!parsedRoot.error) {
      return { error: { message: `${normalizedSourcePath}: failed to parse YAML` } };
    }
    return { error: { ...parsedRoot.error, message: `${normalizedSourcePath}: ${parsedRoot.error.message}` } };
  }

  const legacyKey = firstIncludedKey(parsedRoot.value, LEGACY_TOP_LEVEL_KEYS);
  if (legacyKey) {
    return {
      error: {
        message: `${normalizedSourcePath}: legacy top-level key '${legacyKey}' is not allowed in YAML V3 (use flattened config keys).`,
      },
    };
  }

  try {
    const parsed = configSchema.parse(parsedRoot.value) as ConfigYamlData;
    return {
      data: {
        sourcePath: normalizedSourcePath,
        sourceDir: getSourceDir(normalizedSourcePath),
        data: parsed,
      },
    };
  } catch (err) {
    if (err instanceof ZodError) {
      return { error: mapZodError(err, normalizedSourcePath) };
    }
    return { error: { message: err instanceof Error ? err.message : 'Unknown parse error' } };
  }
}

export function parseBaseYaml(raw: string, sourcePath: string): { data?: ParsedBaseYaml; error?: VNError } {
  const normalizedSourcePath = normalizeSourcePath(sourcePath);
  const parsedRoot = parseYamlRoot(raw);
  if (!parsedRoot.value) {
    if (!parsedRoot.error) {
      return { error: { message: `${normalizedSourcePath}: failed to parse YAML` } };
    }
    return { error: { ...parsedRoot.error, message: `${normalizedSourcePath}: ${parsedRoot.error.message}` } };
  }

  if (hasOwn(parsedRoot.value, 'script') || hasOwn(parsedRoot.value, 'scenes')) {
    return {
      error: {
        message: `${normalizedSourcePath}: base.yaml cannot declare script/scenes (only assets and state are allowed).`,
      },
    };
  }

  const legacyKey = firstIncludedKey(parsedRoot.value, LEGACY_TOP_LEVEL_KEYS);
  if (legacyKey) {
    return {
      error: {
        message: `${normalizedSourcePath}: '${legacyKey}' is not allowed in base.yaml.`,
      },
    };
  }

  const configOnly = firstIncludedKey(parsedRoot.value, CONFIG_ONLY_KEYS);
  if (configOnly) {
    return {
      error: {
        message: `${normalizedSourcePath}: '${configOnly}' is config.yaml-only and cannot appear in base.yaml.`,
      },
    };
  }

  try {
    const parsed = baseLayerSchema.parse(parsedRoot.value) as LayerYamlData;
    const sourceDir = getSourceDir(normalizedSourcePath);
    const assetsResult = canonicalizeLayerAssets(parsed.assets, sourceDir, normalizedSourcePath);
    if (assetsResult.error) {
      return { error: assetsResult.error };
    }
    return {
      data: {
        sourcePath: normalizedSourcePath,
        sourceDir,
        data: {
          assets: assetsResult.data,
          state: parsed.state,
        },
      },
    };
  } catch (err) {
    if (err instanceof ZodError) {
      return { error: mapZodError(err, normalizedSourcePath) };
    }
    return { error: { message: err instanceof Error ? err.message : 'Unknown parse error' } };
  }
}

export function parseChapterYaml(raw: string, sourcePath: string): { data?: ParsedChapterYaml; error?: VNError } {
  const normalizedSourcePath = normalizeSourcePath(sourcePath);
  const parsedRoot = parseYamlRoot(raw);
  if (!parsedRoot.value) {
    if (!parsedRoot.error) {
      return { error: { message: `${normalizedSourcePath}: failed to parse YAML` } };
    }
    return { error: { ...parsedRoot.error, message: `${normalizedSourcePath}: ${parsedRoot.error.message}` } };
  }

  const legacyKey = firstIncludedKey(parsedRoot.value, LEGACY_TOP_LEVEL_KEYS);
  if (legacyKey) {
    return {
      error: {
        message: `${normalizedSourcePath}: '${legacyKey}' is not allowed in chapter YAML V3.`,
      },
    };
  }

  const configOnly = firstIncludedKey(parsedRoot.value, CONFIG_ONLY_KEYS);
  if (configOnly) {
    return {
      error: {
        message: `${normalizedSourcePath}: '${configOnly}' is config.yaml-only and cannot appear in chapter YAML.`,
      },
    };
  }

  try {
    const parsed = chapterSchema.parse(parsedRoot.value) as ChapterYamlData;
    const sourceDir = getSourceDir(normalizedSourcePath);
    const assetsResult = canonicalizeLayerAssets(parsed.assets, sourceDir, normalizedSourcePath);
    if (assetsResult.error) {
      return { error: assetsResult.error };
    }
    const scenesResult = canonicalizeSceneVideoPaths(parsed.scenes, sourceDir, normalizedSourcePath);
    if (scenesResult.error) {
      return { error: scenesResult.error };
    }
    return {
      data: {
        sourcePath: normalizedSourcePath,
        sourceDir,
        data: {
          assets: assetsResult.data,
          state: parsed.state,
          script: parsed.script,
          scenes: scenesResult.data ?? parsed.scenes,
        },
      },
    };
  } catch (err) {
    if (err instanceof ZodError) {
      return { error: mapZodError(err, normalizedSourcePath) };
    }
    return { error: { message: err instanceof Error ? err.message : 'Unknown parse error' } };
  }
}

function mergeLayerAssets(target: GameData['assets'], source?: LayerAssets) {
  if (!source) {
    return;
  }
  Object.assign(target.backgrounds, source.backgrounds ?? {});
  Object.assign(target.characters, source.characters ?? {});
  Object.assign(target.music, source.music ?? {});
  Object.assign(target.sfx, source.sfx ?? {});
}

function mergeLayerState(
  targetDefaults: Record<string, RouteVarValue>,
  sourceState: Record<string, RouteVarValue> | undefined,
  sourcePath: string,
  keySource: Map<string, string>,
): VNError | undefined {
  if (!sourceState) {
    return undefined;
  }

  for (const [key, value] of Object.entries(sourceState)) {
    const previous = targetDefaults[key];
    if (hasOwn(targetDefaults as Record<string, unknown>, key) && typeof previous !== typeof value) {
      const previousSource = keySource.get(key) ?? 'unknown';
      return {
        message: `${sourcePath}: state.${key} type '${typeof value}' conflicts with '${typeof previous}' from ${previousSource}.`,
      };
    }
    targetDefaults[key] = value;
    keySource.set(key, sourcePath);
  }

  return undefined;
}

export function resolveChapterGame(input: ResolveChapterInput): { data?: GameData; error?: VNError } {
  const mergedAssets: GameData['assets'] = {
    backgrounds: {},
    characters: {},
    music: {},
    sfx: {},
  };
  const mergedDefaults: Record<string, RouteVarValue> = {};
  const defaultSourceByKey = new Map<string, string>();

  for (const layer of input.bases) {
    mergeLayerAssets(mergedAssets, layer.data.assets);
    const stateError = mergeLayerState(mergedDefaults, layer.data.state, layer.sourcePath, defaultSourceByKey);
    if (stateError) {
      return { error: stateError };
    }
  }

  mergeLayerAssets(mergedAssets, input.chapter.data.assets);
  const chapterStateError = mergeLayerState(
    mergedDefaults,
    input.chapter.data.state,
    input.chapter.sourcePath,
    defaultSourceByKey,
  );
  if (chapterStateError) {
    return { error: chapterStateError };
  }

  const merged: GameData = {
    meta: {
      title: input.config.data.title,
      author: input.config.data.author,
      version: input.config.data.version,
    },
    settings: {
      textSpeed: input.config.data.textSpeed,
      autoSave: input.config.data.autoSave,
      clickToInstant: input.config.data.clickToInstant,
    },
    assets: mergedAssets,
    script: input.chapter.data.script,
    scenes: input.chapter.data.scenes,
    ...(Object.keys(mergedDefaults).length > 0 ? { state: { defaults: mergedDefaults } } : {}),
    ...(input.config.data.endings ? { endings: input.config.data.endings } : {}),
    ...(input.config.data.endingRules ? { endingRules: input.config.data.endingRules } : {}),
    ...(input.config.data.defaultEnding ? { defaultEnding: input.config.data.defaultEnding } : {}),
  };

  return validateGameData(merged);
}

export function validateGameData(data: GameData): { data?: GameData; error?: VNError } {
  try {
    gameSchema.parse(data);

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
    if (err instanceof ZodError) {
      return { error: mapZodError(err) };
    }
    return {
      error: {
        message: err instanceof Error ? err.message : 'Unknown parse error',
      },
    };
  }
}
