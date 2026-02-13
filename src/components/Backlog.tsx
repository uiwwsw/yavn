import { useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import type { BacklogEntry } from '#/novelTypes';

interface BacklogProps {
    entries: BacklogEntry[];
    isOpen: boolean;
    onClose: () => void;
}

const Backlog: React.FC<BacklogProps> = ({ entries, isOpen, onClose }) => {
    // ESC 키로 닫기
    const handleKeyDown = useCallback(
        (e: React.KeyboardEvent) => {
            if (e.key === 'Escape') {
                onClose();
            }
        },
        [onClose]
    );

    const sortedEntries = useMemo(() => {
        return [...entries].reverse(); // 최신 항목이 위로 오도록
    }, [entries]);

    if (!isOpen) return null;

    return (
        <AnimatePresence>
            <div
                className="fixed inset-0 z-[9999] flex items-center justify-center p-4"
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
                    className="relative z-10 flex h-[80vh] w-full max-w-3xl flex-col space-y-4 rounded-2xl border border-white/10 bg-gradient-to-br from-slate-900/95 to-slate-950/95 p-8 shadow-2xl backdrop-blur-xl"
                    onClick={(e) => e.stopPropagation()}
                >
                    {/* Header */}
                    <div className="flex items-center justify-between">
                        <h2 className="text-2xl font-bold text-white">대화 기록</h2>
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

                    {/* Content */}
                    <div className="flex-1 space-y-4 overflow-y-auto pr-2">
                        {sortedEntries.length === 0 ? (
                            <div className="flex h-full items-center justify-center">
                                <p className="text-white/30">대화 기록이 없습니다</p>
                            </div>
                        ) : (
                            sortedEntries.map((entry) => (
                                <motion.div
                                    key={entry.id}
                                    initial={{ opacity: 0, y: 10 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    className="rounded-lg border border-white/10 bg-white/5 p-4 backdrop-blur"
                                >
                                    {entry.character && (
                                        <div className="mb-2 flex items-center gap-2">
                                            <span className="text-sm font-semibold text-emerald-400">
                                                {entry.character}
                                            </span>
                                            <span className="h-1 w-1 rounded-full bg-white/30" />
                                            <span className="text-xs text-white/40">
                                                {new Date(entry.timestamp).toLocaleTimeString('ko-KR', {
                                                    hour: '2-digit',
                                                    minute: '2-digit',
                                                })}
                                            </span>
                                        </div>
                                    )}
                                    <p className="whitespace-pre-wrap text-sm leading-relaxed text-white/90">
                                        {entry.text}
                                    </p>
                                </motion.div>
                            ))
                        )}
                    </div>

                    {/* Footer */}
                    <div className="flex justify-between border-t border-white/10 pt-4 text-xs text-white/40">
                        <span>{sortedEntries.length}개의 대화</span>
                        <span>H 키로 백로그 열기</span>
                    </div>
                </motion.div>
            </div>
        </AnimatePresence>
    );
};

export default Backlog;
