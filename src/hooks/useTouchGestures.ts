import { useEffect, useCallback, useRef } from 'react';
import { UI_CONFIG } from '#/constants';

export interface TouchGestureHandlers {
    onTap?: () => void;
    onSwipeLeft?: () => void;
    onSwipeRight?: () => void;
    onSwipeUp?: () => void;
    onSwipeDown?: () => void;
    onLongPress?: () => void;
}

interface TouchPoint {
    x: number;
    y: number;
    time: number;
}

/**
 * 터치 제스처를 감지하는 커스텀 훅
 */
export function useTouchGestures(
    elementRef: React.RefObject<HTMLElement>,
    handlers: TouchGestureHandlers,
    enabled = true
) {
    const touchStart = useRef<TouchPoint | null>(null);
    const longPressTimer = useRef<number | null>(null);

    const handleTouchStart = useCallback(
        (e: TouchEvent) => {
            if (!enabled) return;

            const touch = e.touches[0];
            touchStart.current = {
                x: touch.clientX,
                y: touch.clientY,
                time: Date.now(),
            };

            // 롱프레스 타이머 시작
            if (handlers.onLongPress) {
                longPressTimer.current = window.setTimeout(() => {
                    if (handlers.onLongPress) {
                        handlers.onLongPress();
                        touchStart.current = null; // 롱프레스 후 다른 제스처 방지
                    }
                }, UI_CONFIG.TOUCH_LONG_PRESS_DURATION);
            }
        },
        [handlers, enabled]
    );

    const handleTouchEnd = useCallback(
        (e: TouchEvent) => {
            if (!enabled || !touchStart.current) return;

            // 롱프레스 타이머 취소
            if (longPressTimer.current) {
                clearTimeout(longPressTimer.current);
                longPressTimer.current = null;
            }

            const touch = e.changedTouches[0];
            const deltaX = touch.clientX - touchStart.current.x;
            const deltaY = touch.clientY - touchStart.current.y;
            const deltaTime = Date.now() - touchStart.current.time;

            // 거리와 시간 계산
            const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);
            const isSwipe = distance > UI_CONFIG.SWIPE_THRESHOLD;

            if (!isSwipe) {
                // 탭
                if (handlers.onTap && deltaTime < 300) {
                    handlers.onTap();
                }
            } else {
                // 스와이프 방향 결정
                const absX = Math.abs(deltaX);
                const absY = Math.abs(deltaY);

                if (absX > absY) {
                    // 좌우 스와이프
                    if (deltaX > 0 && handlers.onSwipeRight) {
                        handlers.onSwipeRight();
                    } else if (deltaX < 0 && handlers.onSwipeLeft) {
                        handlers.onSwipeLeft();
                    }
                } else {
                    // 상하 스와이프
                    if (deltaY > 0 && handlers.onSwipeDown) {
                        handlers.onSwipeDown();
                    } else if (deltaY < 0 && handlers.onSwipeUp) {
                        handlers.onSwipeUp();
                    }
                }
            }

            touchStart.current = null;
        },
        [handlers, enabled]
    );

    const handleTouchMove = useCallback(() => {
        // 터치 이동 시 롱프레스 취소
        if (longPressTimer.current) {
            clearTimeout(longPressTimer.current);
            longPressTimer.current = null;
        }
    }, []);

    useEffect(() => {
        const element = elementRef.current;
        if (!element || !enabled) return;

        element.addEventListener('touchstart', handleTouchStart);
        element.addEventListener('touchend', handleTouchEnd);
        element.addEventListener('touchmove', handleTouchMove);

        return () => {
            element.removeEventListener('touchstart', handleTouchStart);
            element.removeEventListener('touchend', handleTouchEnd);
            element.removeEventListener('touchmove', handleTouchMove);

            if (longPressTimer.current) {
                clearTimeout(longPressTimer.current);
            }
        };
    }, [elementRef, handleTouchStart, handleTouchEnd, handleTouchMove, enabled]);
}
