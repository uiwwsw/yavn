import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import type { GameSettings } from '#/novelTypes';
import { DEFAULT_SETTINGS, STORAGE_KEYS } from '#/constants';

interface SettingsContextValue {
    settings: GameSettings;
    updateSettings: (updates: Partial<GameSettings>) => void;
    resetSettings: () => void;
}

const SettingsContext = createContext<SettingsContextValue | undefined>(undefined);

export const useSettings = () => {
    const context = useContext(SettingsContext);
    if (!context) {
        throw new Error('useSettings must be used within SettingsProvider');
    }
    return context;
};

interface SettingsProviderProps {
    children: ReactNode;
}

export const SettingsProvider: React.FC<SettingsProviderProps> = ({ children }) => {
    const [settings, setSettings] = useState<GameSettings>(() => {
        // LocalStorage에서 설정 로드
        try {
            const stored = localStorage.getItem(STORAGE_KEYS.SETTINGS);
            if (stored) {
                const parsed = JSON.parse(stored);
                // 기본값과 병합하여 누락된 필드 방지
                return { ...DEFAULT_SETTINGS, ...parsed };
            }
        } catch (error) {
            console.error('Failed to load settings:', error);
        }
        return DEFAULT_SETTINGS;
    });

    // 설정 변경 시 LocalStorage에 저장
    useEffect(() => {
        try {
            localStorage.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify(settings));
        } catch (error) {
            console.error('Failed to save settings:', error);
        }
    }, [settings]);

    const updateSettings = useCallback((updates: Partial<GameSettings>) => {
        setSettings((prev) => ({ ...prev, ...updates }));
    }, []);

    const resetSettings = useCallback(() => {
        setSettings(DEFAULT_SETTINGS);
    }, []);

    const value: SettingsContextValue = {
        settings,
        updateSettings,
        resetSettings,
    };

    return <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>;
};
