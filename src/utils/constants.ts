/**
 * 게임 전역 상수 정의
 */

import type { GameSettings } from './novelTypes';

// ============ 키보드 단축키 ============
export const KEYBOARD_SHORTCUTS = {
    NEXT: ['Enter', ' ', 'Space'] as const,
    SKIP: ['Control'] as const,
    AUTO: ['a', 'A'] as const,
    MENU: ['Escape'] as const,
    BACKLOG: ['h', 'H'] as const,
    QUICK_SAVE: ['F5'] as const,
    QUICK_LOAD: ['F9'] as const,
    HIDE_UI: ['Tab'] as const,
} as const;

// ============ 저장 슬롯 ============
export const SAVE_SLOTS = {
    TOTAL: 10,
    AUTO_SAVE_SLOT: 0,
    QUICK_SAVE_SLOT: 1,
    USER_SLOTS_START: 2,
} as const;

export const STORAGE_KEYS = {
    SETTINGS: 'vn_settings',
    SAVES: 'vn_saves',
    UNLOCKED_CGS: 'vn_unlocked_cgs',
    PLAY_TIME: 'vn_play_time',
    READ_SENTENCES: 'vn_read_sentences',
} as const;

// ============ 기본 설정값 ============
export const DEFAULT_SETTINGS: GameSettings = {
    textSpeed: 1.0,
    bgmVolume: 0.3,
    sfxVolume: 0.5,
    autoSpeed: 2000,
    skipMode: 'unread',
    displayMode: 'window',
    hapticFeedback: true,
} as const;

// ============ 애니메이션 설정 ============
export const ANIMATION_DURATION = {
    FADE: 500,
    SLIDE: 300,
    TYPING_MIN: 10,
    TYPING_MAX: 260,
} as const;

// ============ UI 설정 ============
export const UI_CONFIG = {
    CONSOLE_MAX_LINES: 200,
    BACKLOG_MAX_ENTRIES: 500,
    TOUCH_LONG_PRESS_DURATION: 500, // ms
    SWIPE_THRESHOLD: 50, // px
} as const;

// ============ 성능 설정 ============
export const PERFORMANCE = {
    MAX_CONCURRENT_LOADS: 5,
    IMAGE_CACHE_SIZE: 50,
    AUDIO_CACHE_SIZE: 10,
} as const;
