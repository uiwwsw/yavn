import { useEffect, useCallback } from 'react';
import { KEYBOARD_SHORTCUTS } from '#/constants';

export interface KeyboardNavigationHandlers {
    onNext?: () => void;
    onSkip?: () => void;
    onAuto?: () => void;
    onMenu?: () => void;
    onBacklog?: () => void;
    onQuickSave?: () => void;
    onQuickLoad?: () => void;
    onHideUI?: () => void;
    onChoice?: (index: number) => void;
}

/**
 * 키보드 단축키를 처리하는 커스텀 훅
 */
export function useKeyboardNavigation(handlers: KeyboardNavigationHandlers, enabled = true) {
    const handleKeyDown = useCallback(
        (e: KeyboardEvent) => {
            if (!enabled) return;

            // 입력 요소에서 타이핑 중이면 단축키 무시
            const target = e.target as HTMLElement;
            if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') {
                return;
            }

            // Enter, Space: 다음
            if ((KEYBOARD_SHORTCUTS.NEXT as readonly string[]).includes(e.key) && handlers.onNext) {
                e.preventDefault();
                handlers.onNext();
            }

            // Control: 스킵
            if (e.ctrlKey && handlers.onSkip) {
                e.preventDefault();
                handlers.onSkip();
            }

            // A: 오토
            if ((KEYBOARD_SHORTCUTS.AUTO as readonly string[]).includes(e.key) && handlers.onAuto) {
                e.preventDefault();
                handlers.onAuto();
            }

            // Escape: 메뉴
            if ((KEYBOARD_SHORTCUTS.MENU as readonly string[]).includes(e.key) && handlers.onMenu) {
                e.preventDefault();
                handlers.onMenu();
            }

            // H: 백로그
            if ((KEYBOARD_SHORTCUTS.BACKLOG as readonly string[]).includes(e.key) && handlers.onBacklog) {
                e.preventDefault();
                handlers.onBacklog();
            }

            // F5: 퀵 세이브
            if ((KEYBOARD_SHORTCUTS.QUICK_SAVE as readonly string[]).includes(e.key) && handlers.onQuickSave) {
                e.preventDefault();
                handlers.onQuickSave();
            }

            // F9: 퀵 로드
            if ((KEYBOARD_SHORTCUTS.QUICK_LOAD as readonly string[]).includes(e.key) && handlers.onQuickLoad) {
                e.preventDefault();
                handlers.onQuickLoad();
            }

            // Tab: UI 숨기기/보이기
            if ((KEYBOARD_SHORTCUTS.HIDE_UI as readonly string[]).includes(e.key) && handlers.onHideUI) {
                e.preventDefault();
                handlers.onHideUI();
            }

            // 숫자 1-9: 선택지 선택
            if (handlers.onChoice && e.key >= '1' && e.key <= '9') {
                e.preventDefault();
                const index = parseInt(e.key) - 1;
                handlers.onChoice(index);
            }
        },
        [handlers, enabled]
    );

    useEffect(() => {
        if (!enabled) return;

        window.addEventListener('keydown', handleKeyDown);
        return () => {
            window.removeEventListener('keydown', handleKeyDown);
        };
    }, [handleKeyDown, enabled]);
}
