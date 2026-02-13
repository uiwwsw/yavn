/**
 * 퀵 세이브/로드 유틸리티
 */

import type { SaveData } from './novelTypes';
import { quickSave as saveToQuickSlot, quickLoad as loadFromQuickSlot } from './SaveManager';

export interface QuickSaveData extends Omit<SaveData, 'slot' | 'timestamp'> { }

/**
 * 퀵 세이브 (F5)
 */
export function performQuickSave(data: QuickSaveData): boolean {
    try {
        saveToQuickSlot(data);
        return true;
    } catch (error) {
        console.error('Quick save failed:', error);
        return false;
    }
}

/**
 * 퀵 로드 (F9)
 */
export function performQuickLoad(): SaveData | null {
    try {
        return loadFromQuickSlot();
    } catch (error) {
        console.error('Quick load failed:', error);
        return null;
    }
}

/**
 * 퀵 세이브 존재 여부 확인
 */
export function hasQuickSave(): boolean {
    const data = loadFromQuickSlot();
    return data !== null;
}
