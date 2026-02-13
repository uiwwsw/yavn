/**
 * 저장/불러오기 관리 유틸리티
 */

import type { SaveData } from './novelTypes';
import { STORAGE_KEYS, SAVE_SLOTS } from './constants';

/**
 * 특정 슬롯에 저장
 */
export function saveToSlot(slot: number, data: SaveData): void {
    try {
        const allSaves = getAllSaves();
        const saveWithSlot = { ...data, slot, timestamp: Date.now() };

        // 해당 슬롯의 기존 데이터를 찾아서 교체하거나 추가
        const existingIndex = allSaves.findIndex((s) => s.slot === slot);
        if (existingIndex >= 0) {
            allSaves[existingIndex] = saveWithSlot;
        } else {
            allSaves.push(saveWithSlot);
        }

        localStorage.setItem(STORAGE_KEYS.SAVES, JSON.stringify(allSaves));
    } catch (error) {
        console.error('Failed to save to slot:', error);
        throw new Error('저장에 실패했습니다.');
    }
}

/**
 * 특정 슬롯에서 불러오기
 */
export function loadFromSlot(slot: number): SaveData | null {
    try {
        const allSaves = getAllSaves();
        const save = allSaves.find((s) => s.slot === slot);
        return save || null;
    } catch (error) {
        console.error('Failed to load from slot:', error);
        return null;
    }
}

/**
 * 모든 저장 데이터 가져오기
 */
export function getAllSaves(): SaveData[] {
    try {
        const stored = localStorage.getItem(STORAGE_KEYS.SAVES);
        if (!stored) return [];

        const parsed = JSON.parse(stored);
        return Array.isArray(parsed) ? parsed : [];
    } catch (error) {
        console.error('Failed to get all saves:', error);
        return [];
    }
}

/**
 * 특정 슬롯 삭제
 */
export function deleteSlot(slot: number): void {
    try {
        const allSaves = getAllSaves();
        const filtered = allSaves.filter((s) => s.slot !== slot);
        localStorage.setItem(STORAGE_KEYS.SAVES, JSON.stringify(filtered));
    } catch (error) {
        console.error('Failed to delete slot:', error);
        throw new Error('삭제에 실패했습니다.');
    }
}

/**
 * 자동 저장 (슬롯 0번 사용)
 */
export function autoSave(data: Omit<SaveData, 'slot' | 'timestamp'>): void {
    const saveData: SaveData = {
        ...data,
        slot: SAVE_SLOTS.AUTO_SAVE_SLOT,
        timestamp: Date.now(),
    };
    saveToSlot(SAVE_SLOTS.AUTO_SAVE_SLOT, saveData);
}

/**
 * 퀵 세이브 (슬롯 1번 사용)
 */
export function quickSave(data: Omit<SaveData, 'slot' | 'timestamp'>): void {
    const saveData: SaveData = {
        ...data,
        slot: SAVE_SLOTS.QUICK_SAVE_SLOT,
        timestamp: Date.now(),
    };
    saveToSlot(SAVE_SLOTS.QUICK_SAVE_SLOT, saveData);
}

/**
 * 퀵 로드 (슬롯 1번에서 불러오기)
 */
export function quickLoad(): SaveData | null {
    return loadFromSlot(SAVE_SLOTS.QUICK_SAVE_SLOT);
}

/**
 * 최신 저장 데이터 가져오기
 */
export function getLatestSave(): SaveData | null {
    const allSaves = getAllSaves();
    if (allSaves.length === 0) return null;

    return allSaves.reduce((latest, current) => {
        return current.timestamp > latest.timestamp ? current : latest;
    });
}

/**
 * 사용 가능한 빈 슬롯 번호 가져오기
 */
export function getNextAvailableSlot(): number {
    const allSaves = getAllSaves();
    const usedSlots = new Set(allSaves.map((s) => s.slot));

    for (let i = SAVE_SLOTS.USER_SLOTS_START; i < SAVE_SLOTS.TOTAL; i++) {
        if (!usedSlots.has(i)) {
            return i;
        }
    }

    // 모든 슬롯이 사용 중이면 마지막 슬롯 반환
    return SAVE_SLOTS.TOTAL - 1;
}
