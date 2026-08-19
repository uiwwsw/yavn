import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const app = readFileSync(fileURLToPath(new URL('./App.tsx', import.meta.url)), 'utf8');
const styles = readFileSync(fileURLToPath(new URL('./styles.css', import.meta.url)), 'utf8');

describe('start gate presentation', () => {
  it('renders a themed atmospheric frame and an explicit launch state', () => {
    expect(app).toContain('start-gate-atmosphere');
    expect(app).toContain("startGateLaunching ? ' is-launching' : ''");
    expect(app).toContain('aria-busy={startGateLaunching}');
    expect(app).toContain("'--start-gate-title-color': startGate.titleColor");
    expect(app).toContain("'--start-gate-image-position': startGate.imagePosition");
    expect(app).toContain("'--start-gate-mobile-image-position': startGate.mobileImagePosition");
    expect(styles).toContain('object-position: var(--start-gate-image-position, center)');
    expect(styles).toContain('var(--start-gate-mobile-image-position, var(--start-gate-image-position, center))');
    expect(styles).toMatch(/\.start-gate-frame\s*\{[\s\S]*?border: 1px solid var\(--start-gate-frame-color\)/);
    expect(styles).toMatch(/\.start-gate\.is-launching \.start-gate-content\s*\{[\s\S]*?opacity: 0/);
    expect(app).not.toContain("startGateLaunching ? '이야기를 여는 중'");
    expect(styles).toMatch(/\.start-gate\.is-launching \.start-gate-button-load,[\s\S]*?visibility: hidden/);
  });

  it('keeps the game start-screen return action available for URL and ZIP games', () => {
    expect(app).toContain('const uploadedGameFileRef = useRef<File | null>(null)');
    expect(app).toContain('Boolean(startScreenReturnGameId || uploadedGameFileRef.current)');
    expect(app).toContain("'게임 시작 화면으로 가기'");
    expect(app).toContain('const preview = await loadZipStartScreenPreview(uploadedGameFile)');
  });

  it('introduces the title, frame, and actions with restrained opacity motion', () => {
    expect(styles).toMatch(/\.start-gate-actions\s*\{[^}]*opacity: 0;[^}]*animation: start-gate-actions-in 520ms 260ms ease-out both;/);
    expect(styles).toMatch(/@keyframes start-gate-actions-in\s*\{[\s\S]*?from \{ opacity: 0; \}[\s\S]*?to \{ opacity: 1; \}/);
    expect(styles).not.toContain('animation-name: start-gate-actions-center-in');
    expect(styles).toMatch(/\.start-gate-title-block\s*\{[\s\S]*?animation: start-gate-title-in [^;]+ both;/);
    expect(styles).toMatch(/\.start-gate-frame\s*\{[\s\S]*?animation: start-gate-frame-in [^;]+ both;/);
    expect(styles).not.toContain('@keyframes start-gate-grain-shift');
  });

  it('avoids viewport-measured button flights and launches through one short black crossfade', () => {
    expect(app).not.toContain('startGateActionsRef');
    expect(app).not.toContain('target.getBoundingClientRect()');
    expect(app).not.toContain('offscreenDistances');
    expect(app).not.toContain('START_GATE_ACTION_FAILSAFE_BUFFER_MS');
    expect(app).toContain('<div className={actionClass}>');
    expect(app).toContain('window.setTimeout(resolve, 220)');
    expect(styles).toMatch(/\.start-gate::after\s*\{[\s\S]*?background: #080709;[\s\S]*?transition: opacity 220ms ease-out;/);
    expect(styles).toMatch(/\.start-gate\.is-launching::after\s*\{[\s\S]*?opacity: 1;/);
    expect(styles).not.toContain('@keyframes start-gate-launch-mark');
  });

  it('renders a non-interactive surface only until direct-route game data can mount', () => {
    expect(app).toContain('if (shouldShowGameRouteBoot(gameBootPending, Boolean(game)))');
    expect(app).toContain('className="game-route-boot"');
    expect(app).toContain('setGameBootPending(true);');
  });

  it('keeps the start gate visible when reduced motion is requested', () => {
    expect(styles).toMatch(
      /@media \(prefers-reduced-motion: reduce\)[\s\S]*?\.start-gate-title-block,[\s\S]*?\.start-gate-actions\s*\{[\s\S]*?opacity: 1/,
    );
  });

  it('keeps long titles readable over bright artwork on mobile', () => {
    expect(styles).toMatch(
      /\.start-gate-title-block\s*\{[\s\S]*?background: var\(--start-gate-title-surface\);[\s\S]*?backdrop-filter: blur\(9px\)/,
    );
    expect(styles).toMatch(
      /\.start-gate-title-block h1\s*\{[\s\S]*?word-break: keep-all;[\s\S]*?overflow-wrap: anywhere;/,
    );
    expect(styles).toMatch(
      /@media \(max-width: 768px\)[\s\S]*?\.start-gate-title-block h1\s*\{[\s\S]*?font-size: clamp\(1\.72rem, 8\.4vw, 2\.72rem\);/,
    );
  });
});
