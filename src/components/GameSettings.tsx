import { useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useSettings } from '../contexts/SettingsContext';

interface GameSettingsProps {
    isOpen: boolean;
    onClose: () => void;
}

const GameSettings: React.FC<GameSettingsProps> = ({ isOpen, onClose }) => {
    const { settings, updateSettings, resetSettings } = useSettings();

    const handleTextSpeedChange = (value: number) => {
        updateSettings({ textSpeed: value });
    };

    const handleBgmVolumeChange = (value: number) => {
        updateSettings({ bgmVolume: value });
    };

    const handleSfxVolumeChange = (value: number) => {
        updateSettings({ sfxVolume: value });
    };

    const handleAutoSpeedChange = (value: number) => {
        updateSettings({ autoSpeed: value });
    };

    const handleSkipModeChange = (mode: 'unread' | 'all') => {
        updateSettings({ skipMode: mode });
    };

    const handleHapticToggle = () => {
        updateSettings({ hapticFeedback: !settings.hapticFeedback });
    };

    const handleReset = useCallback(() => {
        if (confirm('모든 설정을 초기화하시겠습니까?')) {
            resetSettings();
        }
    }, [resetSettings]);

    // ESC 키로 닫기
    const handleKeyDown = useCallback(
        (e: React.KeyboardEvent) => {
            if (e.key === 'Escape') {
                onClose();
            }
        },
        [onClose]
    );

    if (!isOpen) return null;

    return (
        <AnimatePresence>
            <div
                className="fixed inset-0 z-[9999] flex items-center justify-center"
                onKeyDown={handleKeyDown}
            >
                {/* Backdrop */}
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="absolute inset-0 bg-black/70 backdrop-blur-sm"
                    onClick={onClose}
                />

                {/* Modal */}
                <motion.div
                    initial={{ opacity: 0, scale: 0.9, y: 20 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.9, y: 20 }}
                    transition={{ type: 'spring', damping: 25, stiffness: 300 }}
                    className="relative z-10 w-full max-w-md space-y-6 rounded-2xl border border-white/10 bg-gradient-to-br from-slate-900/95 to-slate-950/95 p-8 shadow-2xl backdrop-blur-xl"
                    onClick={(e) => e.stopPropagation()}
                >
                    {/* Header */}
                    <div className="flex items-center justify-between">
                        <h2 className="text-2xl font-bold text-white">설정</h2>
                        <button
                            onClick={onClose}
                            className="rounded-lg p-2 text-white/60 transition-colors hover:bg-white/10 hover:text-white"
                            aria-label="닫기"
                        >
                            <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                        </button>
                    </div>

                    <div className="space-y-6">
                        {/* 텍스트 속도 */}
                        <div className="space-y-2">
                            <label className="flex items-center justify-between text-sm font-medium text-white">
                                <span>텍스트 속도</span>
                                <span className="text-emerald-400">{settings.textSpeed.toFixed(1)}x</span>
                            </label>
                            <input
                                type="range"
                                min="0.5"
                                max="2"
                                step="0.1"
                                value={settings.textSpeed}
                                onChange={(e) => handleTextSpeedChange(parseFloat(e.target.value))}
                                className="w-full accent-emerald-500"
                            />
                            <div className="flex justify-between text-xs text-white/50">
                                <span>느림</span>
                                <span>빠름</span>
                            </div>
                        </div>

                        {/* BGM 볼륨 */}
                        <div className="space-y-2">
                            <label className="flex items-center justify-between text-sm font-medium text-white">
                                <span>배경 음악</span>
                                <span className="text-emerald-400">{Math.round(settings.bgmVolume * 100)}%</span>
                            </label>
                            <input
                                type="range"
                                min="0"
                                max="1"
                                step="0.05"
                                value={settings.bgmVolume}
                                onChange={(e) => handleBgmVolumeChange(parseFloat(e.target.value))}
                                className="w-full accent-emerald-500"
                            />
                        </div>

                        {/* 효과음 볼륨 */}
                        <div className="space-y-2">
                            <label className="flex items-center justify-between text-sm font-medium text-white">
                                <span>효과음</span>
                                <span className="text-emerald-400">{Math.round(settings.sfxVolume * 100)}%</span>
                            </label>
                            <input
                                type="range"
                                min="0"
                                max="1"
                                step="0.05"
                                value={settings.sfxVolume}
                                onChange={(e) => handleSfxVolumeChange(parseFloat(e.target.value))}
                                className="w-full accent-emerald-500"
                            />
                        </div>

                        {/* 자동 진행 속도 */}
                        <div className="space-y-2">
                            <label className="flex items-center justify-between text-sm font-medium text-white">
                                <span>자동 진행 속도</span>
                                <span className="text-emerald-400">{(settings.autoSpeed / 1000).toFixed(1)}초</span>
                            </label>
                            <input
                                type="range"
                                min="1000"
                                max="5000"
                                step="100"
                                value={settings.autoSpeed}
                                onChange={(e) => handleAutoSpeedChange(parseInt(e.target.value))}
                                className="w-full accent-emerald-500"
                            />
                            <div className="flex justify-between text-xs text-white/50">
                                <span>빠름</span>
                                <span>느림</span>
                            </div>
                        </div>

                        {/* 스킵 모드 */}
                        <div className="space-y-2">
                            <label className="text-sm font-medium text-white">스킵 모드</label>
                            <div className="flex gap-2">
                                <button
                                    onClick={() => handleSkipModeChange('unread')}
                                    className={`flex-1 rounded-lg border px-4 py-2 text-sm font-medium transition-all ${settings.skipMode === 'unread'
                                        ? 'border-emerald-500 bg-emerald-500/20 text-emerald-400'
                                        : 'border-white/20 bg-white/5 text-white/70 hover:bg-white/10'
                                        }`}
                                >
                                    읽은 텍스트
                                </button>
                                <button
                                    onClick={() => handleSkipModeChange('all')}
                                    className={`flex-1 rounded-lg border px-4 py-2 text-sm font-medium transition-all ${settings.skipMode === 'all'
                                        ? 'border-emerald-500 bg-emerald-500/20 text-emerald-400'
                                        : 'border-white/20 bg-white/5 text-white/70 hover:bg-white/10'
                                        }`}
                                >
                                    모든 텍스트
                                </button>
                            </div>
                        </div>

                        {/* 햅틱 피드백 */}
                        <div className="flex items-center justify-between">
                            <label className="text-sm font-medium text-white">햅틱 피드백</label>
                            <button
                                onClick={handleHapticToggle}
                                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${settings.hapticFeedback ? 'bg-emerald-500' : 'bg-white/20'
                                    }`}
                            >
                                <span
                                    className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${settings.hapticFeedback ? 'translate-x-6' : 'translate-x-1'
                                        }`}
                                />
                            </button>
                        </div>
                    </div>

                    {/* Footer Buttons */}
                    <div className="flex gap-3 pt-4">
                        <button
                            onClick={handleReset}
                            className="flex-1 rounded-lg border border-white/20 bg-white/5 px-6 py-2.5 font-medium text-white transition-all hover:bg-white/10 active:scale-95"
                        >
                            초기화
                        </button>
                        <button
                            onClick={onClose}
                            className="flex-1 rounded-lg border border-emerald-500/50 bg-emerald-500/20 px-6 py-2.5 font-medium text-emerald-400 transition-all hover:bg-emerald-500/30 active:scale-95"
                        >
                            확인
                        </button>
                    </div>
                </motion.div>
            </div>
        </AnimatePresence>
    );
};

export default GameSettings;
