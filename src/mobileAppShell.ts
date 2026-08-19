export const GAME_SHELL_LOCK_CLASS = 'game-shell-locked';

const SCROLLABLE_OVERFLOW_PATTERN = /^(auto|scroll|overlay)$/;

export function findScrollableTouchRegion(target: EventTarget | null): HTMLElement | null {
  let element = target instanceof Element ? target : null;

  while (element && element !== document.documentElement) {
    if (element instanceof HTMLElement) {
      const { overflowY } = window.getComputedStyle(element);
      if (
        SCROLLABLE_OVERFLOW_PATTERN.test(overflowY)
        && element.scrollHeight > element.clientHeight + 1
      ) {
        return element;
      }
    }
    element = element.parentElement;
  }

  return null;
}

export function shouldPreventGameShellOverscroll(
  target: EventTarget | null,
  touchDeltaY: number,
): boolean {
  if (touchDeltaY === 0) {
    return false;
  }

  const scrollRegion = findScrollableTouchRegion(target);
  if (!scrollRegion) {
    return true;
  }

  return shouldPreventScrollBoundary(
    scrollRegion.scrollTop,
    scrollRegion.clientHeight,
    scrollRegion.scrollHeight,
    touchDeltaY,
  );
}

export function shouldPreventScrollBoundary(
  scrollTop: number,
  clientHeight: number,
  scrollHeight: number,
  touchDeltaY: number,
): boolean {
  const isAtTop = scrollTop <= 0;
  const isAtBottom = scrollTop + clientHeight >= scrollHeight - 1;
  return (isAtTop && touchDeltaY > 0) || (isAtBottom && touchDeltaY < 0);
}
