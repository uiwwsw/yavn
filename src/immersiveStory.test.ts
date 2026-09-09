import { describe, expect, it } from 'vitest';
import { actionSchema } from './schema';
import { resolveInteractivePromptHeight } from './promptLayout';
import type { Action } from './types';

describe('authored protagonist interaction', () => {
  it('accepts speech ownership, explicit action, and spatial choices without changing legacy defaults', () => {
    expect(actionSchema.parse({ say: { text: 'Hello.' } })).toEqual({ say: { text: 'Hello.' } });
    expect(actionSchema.safeParse({ say: { channel: 'thought', char: 'hero', text: 'Who is there?', continueLabel: 'Listen' } }).success).toBe(true);
    expect(actionSchema.safeParse({ say: { channel: 'action', text: 'The wood is cold.' } }).success).toBe(true);
    expect(actionSchema.safeParse({ choice: { presentation: 'explore', prompt: 'Look around.', options: [
      { text: 'Door', at: { x: 0, y: 100 } }, { text: 'Leave' },
    ] } }).success).toBe(true);
  });

  it('rejects unreachable action confirmation and invalid spatial coordinates', () => {
    expect(actionSchema.safeParse({ say: { text: 'Ready?', continueLabel: 'Go', autoAdvance: 500 } }).success).toBe(false);
    expect(actionSchema.safeParse({ say: { text: 'Ready?', continueLabel: '   ' } }).success).toBe(false);
    for (const [presentation, options] of [
      [undefined, [{ text: 'Door', at: { x: 20, y: 40 } }]],
      ['explore', [{ text: 'Door' }]],
      ['explore', [{ text: 'Door', at: { x: -1, y: 40 } }]],
      ['explore', [{ text: 'Door', at: { x: 20, y: 101 } }]],
    ]) expect(actionSchema.safeParse({ choice: { presentation, prompt: 'Look.', options } }).success).toBe(false);
  });

  it('reserves footer space for contextual actions while preserving authored prompt height', () => {
    const exploration: Action = { choice: { presentation: 'explore', prompt: 'Look.', options: [
      { text: 'Door', at: { x: 25, y: 50 } }, { text: 'Window', at: { x: 75, y: 50 } }, { text: 'Leave' },
    ] } };
    expect(resolveInteractivePromptHeight(undefined, exploration, true)).toBe(190);
    expect(resolveInteractivePromptHeight(undefined, { say: { text: 'Listen.', continueLabel: 'Open' } }, true)).toBe(210);
    expect(resolveInteractivePromptHeight(undefined, { say: { text: 'Listen.', continueLabel: 'Open', promptHeight: 260 } }, true)).toBe(260);
  });
});
