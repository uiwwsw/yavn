import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const appSource = readFileSync(fileURLToPath(new URL('./App.tsx', import.meta.url)), 'utf8');
const styles = readFileSync(fileURLToPath(new URL('./styles.css', import.meta.url)), 'utf8');

describe('dialogue presentation channels', () => {
  it('renders authored channel labels and channel-specific dialog classes', () => {
    expect(appSource).toContain("record: '기록'");
    expect(appSource).toContain("system: '시스템'");
    expect(appSource).toContain('channel-${dialog.channel}');
    expect(styles).toContain('.dialog-box.channel-record');
    expect(styles).toContain('.dialog-box.channel-system');
    expect(styles).toContain('.dialog-channel-label');
  });
});
