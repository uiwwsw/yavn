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
    expect(styles).toMatch(/\.start-gate-frame\s*\{[\s\S]*?border: 1px solid var\(--start-gate-frame-color\)/);
    expect(styles).toMatch(/\.start-gate\.is-launching \.start-gate-content\s*\{[\s\S]*?opacity: 0/);
  });

  it('keeps actions visible without gating them behind an entrance animation', () => {
    expect(styles).toMatch(/\.start-gate-actions\s*\{[^}]*opacity: 1;[^}]*\}/);
    expect(styles).not.toContain('@keyframes start-gate-actions-in');
    expect(styles).not.toContain('animation-name: start-gate-actions-center-in');
    expect(styles).not.toMatch(/\.start-gate-actions\s*\{[^}]*animation:/);
    expect(styles).toMatch(/\.start-gate-title-block\s*\{[\s\S]*?animation: start-gate-title-in [^;]+ both;/);
    expect(styles).toMatch(/\.start-gate-frame\s*\{[\s\S]*?animation: start-gate-frame-in [^;]+ both;/);
  });

  it('renders a non-interactive surface while a direct game route resolves', () => {
    expect(app).toContain('if (gameBootPending)');
    expect(app).toContain('className="game-route-boot"');
    expect(app).toContain('setGameBootPending(true);');
  });

  it('keeps the start gate visible when reduced motion is requested', () => {
    expect(styles).toMatch(
      /@media \(prefers-reduced-motion: reduce\)[\s\S]*?\.start-gate-title-block,[\s\S]*?\.start-gate-actions\s*\{[\s\S]*?opacity: 1/,
    );
  });
});
