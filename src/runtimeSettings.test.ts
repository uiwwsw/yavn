import { describe, expect, it } from 'vitest';
import {
  DEFAULT_RUNTIME_GAME_SETTINGS,
  migrateRuntimeGameSettings,
  RUNTIME_GAME_SETTINGS_SCHEMA_VERSION,
} from './runtimeSettings';

describe('runtime settings migration', () => {
  it('migrates legacy per-game preferences to the current schema without losing values', () => {
    const migrated = migrateRuntimeGameSettings({
      bgmEnabled: false,
      autoSaveEnabled: false,
      inventoryView: 'catalog',
      inventorySort: 'name',
      inventoryCategory: '인물',
    });

    expect(migrated.sourceVersion).toBe(0);
    expect(migrated.needsPersist).toBe(true);
    expect(migrated.settings).toMatchObject({
      schemaVersion: RUNTIME_GAME_SETTINGS_SCHEMA_VERSION,
      bgmEnabled: false,
      autoSaveEnabled: false,
      inventoryView: 'catalog',
      inventorySort: 'name',
      inventoryCategory: '인물',
      autoPlayEnabled: false,
      textSpeedRate: 1,
      effectLevel: 'full',
      bgmVolume: 0.6,
      sfxVolume: 0.8,
    });
  });

  it('normalizes unsafe values and clamps player audio levels', () => {
    const migrated = migrateRuntimeGameSettings({
      schemaVersion: 1,
      bgmVolume: 4,
      sfxVolume: -1,
      textSpeedRate: 99,
      autoPlayDelayMs: 10,
      effectLevel: 'extreme',
      inventoryCategory: '  사건  ',
    });

    expect(migrated.settings).toMatchObject({
      bgmVolume: 1,
      sfxVolume: 0,
      textSpeedRate: DEFAULT_RUNTIME_GAME_SETTINGS.textSpeedRate,
      autoPlayDelayMs: DEFAULT_RUNTIME_GAME_SETTINGS.autoPlayDelayMs,
      effectLevel: DEFAULT_RUNTIME_GAME_SETTINGS.effectLevel,
      inventoryCategory: '사건',
    });
  });

  it('reads known values from a future payload without downgrading its storage record', () => {
    const migrated = migrateRuntimeGameSettings({
      schemaVersion: RUNTIME_GAME_SETTINGS_SCHEMA_VERSION + 1,
      autoPlayEnabled: true,
      effectLevel: 'reduced',
      futurePreference: 'keep-me',
    });

    expect(migrated.settings.autoPlayEnabled).toBe(true);
    expect(migrated.settings.effectLevel).toBe('reduced');
    expect(migrated.needsPersist).toBe(false);
  });
});
