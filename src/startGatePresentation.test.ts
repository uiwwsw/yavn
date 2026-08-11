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
    expect(styles).toMatch(/\.start-gate-frame\s*\{[\s\S]*?border: 1px solid var\(--start-gate-frame-color\)/);
    expect(styles).toMatch(/\.start-gate\.is-launching \.start-gate-content\s*\{[\s\S]*?opacity: 0/);
  });

  it('keeps the start gate visible when reduced motion is requested', () => {
    expect(styles).toMatch(
      /@media \(prefers-reduced-motion: reduce\)[\s\S]*?\.start-gate-title-block,[\s\S]*?\.start-gate-actions\s*\{[\s\S]*?opacity: 1/,
    );
  });
});
