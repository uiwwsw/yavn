import { useState, useCallback, useEffect } from 'react';
import { motion } from 'framer-motion';
import type { SaveData } from '#/novelTypes';
import { getAllSaves, saveToSlot, deleteSlot } from '#/SaveManager';
import { SAVE_SLOTS } from '#/constants';

interface SaveSlotsProps {
    mode: 'save' | 'load';
    currentData?: Omit<SaveData, 'slot' | 'timestamp'>;
    onSave?: (slot: number) => void;
    onLoad?: (data: SaveData) => void;
    onClose: () => void;
}

const SaveSlots: React.FC<SaveSlotsProps> = ({ mode, currentData, onSave, onLoad, onClose }) => {
    const [saves, setSaves] = useState<SaveData[]>([]);
    const [selectedSlot, setSelectedSlot] = useState<number | null>(null);

    // 저장 데이터 로드
    useEffect(() => {
        setSaves(getAllSaves());
    }, []);

    const handleSlotClick = useCallback(
        (slot: number) => {
            if (mode === 'save') {
                setSelectedSlot(slot);
            } else {
                // 로드 모드
                const save = saves.find((s) => s.slot === slot);
                if (save && onLoad) {
                    onLoad(save);
                    onClose();
                }
            }
        },
        [mode, saves, onLoad, onClose]
    );

    const handleSaveConfirm = useCallback(() => {
        if (selectedSlot === null || !currentData) return;

        const saveData: SaveData = {
            ...currentData,
            slot: selectedSlot,
            timestamp: Date.now(),
        };

        saveToSlot(selectedSlot, saveData);
        setSaves(getAllSaves());

        if (onSave) {
            onSave(selectedSlot);
        }

        onClose();
    }, [selectedSlot, currentData, onSave, onClose]);

    const handleDelete = useCallback(
        (slot: number, e: React.MouseEvent) => {
            e.stopPropagation();

            if (confirm('이 저장 데이터를 삭제하시겠습니까?')) {
                deleteSlot(slot);
                setSaves(getAllSaves());
            }
        },
        []
    );

    const formatDate = (timestamp: number) => {
        const date = new Date(timestamp);
        return date.toLocaleString('ko-KR', {
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
        });
    };

    const formatPlayTime = (seconds: number) => {
        const hours = Math.floor(seconds / 3600);
        const minutes = Math.floor((seconds % 3600) / 60);
        return `${hours}시간 ${minutes}분`;
    };

    const renderSlot = (slot: number) => {
        const save = saves.find((s) => s.slot === slot);
        const isSelected = selectedSlot === slot;
        const isEmpty = !save;
        const isAutoSave = slot === SAVE_SLOTS.AUTO_SAVE_SLOT;
        const isQuickSave = slot === SAVE_SLOTS.QUICK_SAVE_SLOT;

        let slotLabel = `슬롯 ${slot}`;
        if (isAutoSave) slotLabel = '자동 저장';
        if (isQuickSave) slotLabel = '퀵 세이브';

        return (
            <motion.button
                key={slot}
                onClick={() => handleSlotClick(slot)}
                className={`group relative flex w-full flex-col overflow-hidden rounded-xl border p-4 text-left transition-all ${isSelected
                    ? 'border-emerald-500 bg-emerald-500/20 shadow-lg shadow-emerald-500/20'
                    : isEmpty
                        ? 'border-white/10 bg-white/5 hover:border-white/20 hover:bg-white/10'
                        : 'border-white/20 bg-white/10 hover:border-white/30 hover:bg-white/15'
                    }`}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
            >
                {/* Slot Header */}
                <div className="flex items-center justify-between">
                    <span className={`text-sm font-semibold ${isEmpty ? 'text-white/50' : 'text-white'}`}>
                        {slotLabel}
                    </span>

                    {!isEmpty && !isAutoSave && mode === 'save' && (
                        <button
                            onClick={(e) => handleDelete(slot, e)}
                            className="rounded p-1 text-white/40 transition-colors hover:bg-red-500/20 hover:text-red-400"
                            aria-label="삭제"
                        >
                            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    strokeWidth={2}
                                    d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                                />
                            </svg>
                        </button>
                    )}
                </div>

                {/* Slot Content */}
                {isEmpty ? (
                    <div className="mt-4 text-center">
                        <p className="text-xs text-white/30">비어있음</p>
                    </div>
                ) : (
                    <div className="mt-3 space-y-2">
                        {save.screenshot && (
                            <div className="aspect-video overflow-hidden rounded-lg bg-black/30">
                                <img
                                    src={save.screenshot}
                                    alt="저장 화면"
                                    className="h-full w-full object-cover"
                                />
                            </div>
                        )}
                        <div className="space-y-1">
                            <p className="text-sm font-medium text-white">{save.chapterTitle || `챕터 ${save.level + 1}`}</p>
                            {save.characterName && (
                                <p className="text-xs text-white/60">
                                    {save.characterName} • {save.placeName || '알 수 없는 장소'}
                                </p>
                            )}
                            <p className="text-xs text-white/40">{formatDate(save.timestamp)}</p>
                            <p className="text-xs text-white/40">플레이 타임: {formatPlayTime(save.playTime)}</p>
                        </div>
                    </div>
                )}
            </motion.button>
        );
    };

    return (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
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
                className="relative z-10 w-full max-w-4xl space-y-6 rounded-2xl border border-white/10 bg-gradient-to-br from-slate-900/95 to-slate-950/95 p-8 shadow-2xl backdrop-blur-xl"
                onClick={(e) => e.stopPropagation()}
            >
                {/* Header */}
                <div className="flex items-center justify-between">
                    <h2 className="text-2xl font-bold text-white">
                        {mode === 'save' ? '저장하기' : '불러오기'}
                    </h2>
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

                {/* Slots Grid */}
                <div className="grid max-h-[60vh] gap-4 overflow-y-auto pr-2 sm:grid-cols-2 lg:grid-cols-3">
                    {Array.from({ length: SAVE_SLOTS.TOTAL }, (_, i) => i).map(renderSlot)}
                </div>

                {/* Footer */}
                {mode === 'save' && selectedSlot !== null && (
                    <div className="flex justify-end gap-3 border-t border-white/10 pt-4">
                        <button
                            onClick={onClose}
                            className="rounded-lg border border-white/20 bg-white/5 px-6 py-2.5 font-medium text-white transition-all hover:bg-white/10 active:scale-95"
                        >
                            취소
                        </button>
                        <button
                            onClick={handleSaveConfirm}
                            className="rounded-lg border border-emerald-500/50 bg-emerald-500/20 px-6 py-2.5 font-medium text-emerald-400 transition-all hover:bg-emerald-500/30 active:scale-95"
                        >
                            저장
                        </button>
                    </div>
                )}
            </motion.div>
        </div>
    );
};

export default SaveSlots;
