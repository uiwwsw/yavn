import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { shouldPreventScrollBoundary } from './mobileAppShell';

const readSource = (path: string) =>
  readFileSync(fileURLToPath(new URL(path, import.meta.url)), 'utf8');

const appSource = readSource('./App.tsx');
const styles = readSource('./styles.css');

describe('mobile app shell', () => {
  it('locks the document only while a start gate or game surface is active', () => {
    expect(appSource).toContain("const gameShellLocked = bootMode !== 'launcher' || Boolean(startGate)");
    expect(appSource).toContain('document.documentElement.classList.toggle(GAME_SHELL_LOCK_CLASS, gameShellLocked)');
    expect(appSource).toContain('document.body.classList.toggle(GAME_SHELL_LOCK_CLASS, gameShellLocked)');
    expect(styles).toMatch(
      /body\.game-shell-locked\s*\{[\s\S]*?position: fixed;[\s\S]*?inset: 0;/,
    );
    expect(styles).toMatch(
      /html\.game-shell-locked,[\s\S]*?overscroll-behavior: none;/,
    );
  });

  it('blocks iOS boundary bounce while preserving real internal scrolling', () => {
    expect(shouldPreventScrollBoundary(0, 300, 800, 18)).toBe(true);
    expect(shouldPreventScrollBoundary(180, 300, 800, 18)).toBe(false);
    expect(shouldPreventScrollBoundary(500, 300, 800, -18)).toBe(true);
    expect(shouldPreventScrollBoundary(180, 300, 800, -18)).toBe(false);
    expect(appSource).toContain("document.addEventListener('touchmove', preventPinchZoomAndShellOverscroll, { passive: false })");
    expect(styles).toMatch(
      /\.dialog-content-scroll,[\s\S]*?-webkit-overflow-scrolling: touch;[\s\S]*?touch-action: pan-y;/,
    );
  });

  it('uses the dynamic viewport and removes mobile tap flash from game controls', () => {
    expect(styles).toMatch(
      /body\.game-shell-locked \.start-gate,[\s\S]*?height: 100dvh;[\s\S]*?overscroll-behavior: none;/,
    );
    expect(styles).toMatch(
      /body\.game-shell-locked button,[\s\S]*?touch-action: manipulation;[\s\S]*?-webkit-tap-highlight-color: transparent;/,
    );
  });
});
