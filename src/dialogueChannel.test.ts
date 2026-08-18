import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const appSource = readFileSync(fileURLToPath(new URL('./App.tsx', import.meta.url)), 'utf8');
const styles = readFileSync(fileURLToPath(new URL('./styles.css', import.meta.url)), 'utf8');

const relativeLuminance = (hex: string) => {
  const [red, green, blue] = [1, 3, 5]
    .map((offset) => Number.parseInt(hex.slice(offset, offset + 2), 16) / 255)
    .map((channel) => channel <= 0.04045
      ? channel / 12.92
      : ((channel + 0.055) / 1.055) ** 2.4);
  return (0.2126 * red) + (0.7152 * green) + (0.0722 * blue);
};

const contrastRatio = (foreground: string, background: string) => {
  const lightness = [relativeLuminance(foreground), relativeLuminance(background)]
    .sort((left, right) => right - left);
  return (lightness[0] + 0.05) / (lightness[1] + 0.05);
};

describe('dialogue presentation channels', () => {
  it('renders authored channel labels and channel-specific dialog classes', () => {
    expect(appSource).toContain('narration: undefined');
    expect(appSource).toContain("record: '기록'");
    expect(appSource).toContain("system: '시스템'");
    expect(appSource).toContain('channel-${dialog.channel}');
    expect(styles).toContain('.dialog-box.channel-record');
    expect(styles).toContain('.dialog-box.channel-system');
    expect(styles).toContain('.dialog-channel-label');
  });

  it('keeps every prose channel on a dedicated high-contrast surface', () => {
    expect(styles).toContain('--ui-narration-bg:');
    expect(styles).toContain('--ui-record-bg:');
    expect(styles).toContain('--ui-system-bg:');
    expect(styles).toMatch(/\.dialog-box\.channel-narration\s*\{[\s\S]*?background: var\(--ui-narration-bg\);/);
    expect(styles).toMatch(/\.dialog-box\.channel-record\s*\{[\s\S]*?background: var\(--ui-record-bg\);/);
    expect(styles).toMatch(/\.dialog-box\.channel-system\s*\{[\s\S]*?background: var\(--ui-system-bg\);/);
    expect(styles).not.toMatch(/color-mix\(in srgb,\s*var\(--ui-dialog-bg\)/);
    expect(styles).toContain('linear-gradient(158deg, #fbefd8, #f3dfba)');
    expect(styles).toContain('linear-gradient(158deg, #f8e8c9, #edcf9c)');
    expect(styles).toContain('linear-gradient(158deg, #f7ecd8, #ead4ae)');
  });

  it('keeps prose body and channel labels above AA contrast', () => {
    const palettes = [
      { text: '#fff6e6', label: '#ffdba1', surfaces: ['#120d0a', '#2a1c12', '#211915'] },
      { text: '#eaf9ff', label: '#6ff7ff', surfaces: ['#041328', '#08263e', '#09283a'] },
      { text: '#2f1f12', label: '#6a4016', surfaces: ['#f3dfba', '#edcf9c', '#ead4ae'] },
    ];

    palettes.forEach(({ text, label, surfaces }) => {
      expect(styles).toContain(text);
      expect(styles).toContain(label);
      surfaces.forEach((surface) => {
        expect(styles).toContain(surface);
        expect(contrastRatio(text, surface)).toBeGreaterThanOrEqual(7);
        expect(contrastRatio(label, surface)).toBeGreaterThanOrEqual(4.5);
      });
    });
  });
});
