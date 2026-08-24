export const RUNTIME_GAME_SETTINGS_SCHEMA_VERSION = 2 as const;

export const INVENTORY_VIEW_VALUES = ['bag', 'catalog'] as const;
export const INVENTORY_SORT_VALUES = ['order', 'name'] as const;
export const TEXT_SPEED_RATE_VALUES = [0.75, 1, 1.5, 2] as const;
export const AUTO_PLAY_DELAY_VALUES = [800, 1400, 2200] as const;
export const EFFECT_LEVEL_VALUES = ['full', 'reduced', 'minimal'] as const;

export type InventoryViewPreference = (typeof INVENTORY_VIEW_VALUES)[number];
export type InventorySortPreference = (typeof INVENTORY_SORT_VALUES)[number];
export type TextSpeedRate = (typeof TEXT_SPEED_RATE_VALUES)[number];
export type AutoPlayDelay = (typeof AUTO_PLAY_DELAY_VALUES)[number];
export type PlayerEffectLevel = (typeof EFFECT_LEVEL_VALUES)[number];

export type RuntimeGameSettings = {
  schemaVersion: typeof RUNTIME_GAME_SETTINGS_SCHEMA_VERSION;
  bgmEnabled: boolean;
  bgmVolume: number;
  sfxVolume: number;
  autoSaveEnabled?: boolean;
  autoPlayEnabled: boolean;
  autoPlayDelayMs: AutoPlayDelay;
  textSpeedRate: TextSpeedRate;
  effectLevel: PlayerEffectLevel;
  inventoryView: InventoryViewPreference;
  inventorySort: InventorySortPreference;
  inventoryCategory: string;
};

export type RuntimeSettingsMigration = {
  settings: RuntimeGameSettings;
  needsPersist: boolean;
  sourceVersion: number;
};

export const DEFAULT_RUNTIME_GAME_SETTINGS: RuntimeGameSettings = {
  schemaVersion: RUNTIME_GAME_SETTINGS_SCHEMA_VERSION,
  bgmEnabled: true,
  bgmVolume: 0.6,
  sfxVolume: 0.8,
  autoSaveEnabled: undefined,
  autoPlayEnabled: false,
  autoPlayDelayMs: 1400,
  textSpeedRate: 1,
  effectLevel: 'full',
  inventoryView: 'bag',
  inventorySort: 'order',
  inventoryCategory: '',
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function normalizeChoice<T extends string | number>(
  raw: unknown,
  values: readonly T[],
  fallback: T,
): T {
  return values.includes(raw as T) ? (raw as T) : fallback;
}

function normalizeVolume(raw: unknown, fallback: number): number {
  if (typeof raw !== 'number' || !Number.isFinite(raw)) {
    return fallback;
  }
  return Math.round(Math.max(0, Math.min(1, raw)) * 100) / 100;
}

function normalizeCategory(raw: unknown): string {
  return typeof raw === 'string' ? raw.trim() : '';
}

export function migrateRuntimeGameSettings(raw: unknown): RuntimeSettingsMigration {
  const record = isRecord(raw) ? raw : {};
  const rawVersion = typeof record.schemaVersion === 'number' && Number.isInteger(record.schemaVersion)
    ? Math.max(0, record.schemaVersion)
    : 0;
  const defaults = DEFAULT_RUNTIME_GAME_SETTINGS;
  const settings: RuntimeGameSettings = {
    schemaVersion: RUNTIME_GAME_SETTINGS_SCHEMA_VERSION,
    bgmEnabled: typeof record.bgmEnabled === 'boolean' ? record.bgmEnabled : defaults.bgmEnabled,
    bgmVolume: normalizeVolume(record.bgmVolume, defaults.bgmVolume),
    sfxVolume: normalizeVolume(record.sfxVolume, defaults.sfxVolume),
    autoSaveEnabled:
      typeof record.autoSaveEnabled === 'boolean' ? record.autoSaveEnabled : defaults.autoSaveEnabled,
    autoPlayEnabled:
      typeof record.autoPlayEnabled === 'boolean' ? record.autoPlayEnabled : defaults.autoPlayEnabled,
    autoPlayDelayMs: normalizeChoice(
      record.autoPlayDelayMs,
      AUTO_PLAY_DELAY_VALUES,
      defaults.autoPlayDelayMs,
    ),
    textSpeedRate: normalizeChoice(
      record.textSpeedRate,
      TEXT_SPEED_RATE_VALUES,
      defaults.textSpeedRate,
    ),
    effectLevel: normalizeChoice(record.effectLevel, EFFECT_LEVEL_VALUES, defaults.effectLevel),
    inventoryView: normalizeChoice(
      record.inventoryView,
      INVENTORY_VIEW_VALUES,
      defaults.inventoryView,
    ),
    inventorySort: normalizeChoice(
      record.inventorySort,
      INVENTORY_SORT_VALUES,
      defaults.inventorySort,
    ),
    inventoryCategory: normalizeCategory(record.inventoryCategory),
  };

  // A newer runtime owns its payload. Use the values we understand for this
  // session, but never downgrade unknown future data in localStorage.
  if (rawVersion > RUNTIME_GAME_SETTINGS_SCHEMA_VERSION) {
    return { settings, needsPersist: false, sourceVersion: rawVersion };
  }

  return {
    settings,
    needsPersist: JSON.stringify(record) !== JSON.stringify(settings),
    sourceVersion: rawVersion,
  };
}
