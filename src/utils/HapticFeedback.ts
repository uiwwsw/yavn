/**
 * 햅틱 피드백 유틸리티
 * 모바일 기기에서 진동 피드백 제공
 */

type VibrationPattern = 'light' | 'medium' | 'heavy' | 'success' | 'warning' | 'error';

const VIBRATION_PATTERNS: Record<VibrationPattern, number | number[]> = {
    light: 10,
    medium: 20,
    heavy: 30,
    success: [10, 50, 10],
    warning: [10, 50, 10, 50, 10],
    error: [30, 50, 30],
};

/**
 * 햅틱 피드백 실행
 */
export function vibrate(pattern: VibrationPattern): void {
    // Vibration API 지원 여부 확인
    if (!navigator.vibrate) {
        return;
    }

    const vibrationPattern = VIBRATION_PATTERNS[pattern];
    navigator.vibrate(vibrationPattern);
}

/**
 * 진동 중지
 */
export function cancelVibration(): void {
    if (!navigator.vibrate) {
        return;
    }

    navigator.vibrate(0);
}

/**
 * 햅틱 피드백 지원 여부 확인
 */
export function isHapticSupported(): boolean {
    return 'vibrate' in navigator;
}
