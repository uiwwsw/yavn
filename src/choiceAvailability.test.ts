import { describe, expect, it } from 'vitest';
import { resolveAvailableChoiceOptions, resolveVisibleTimeoutOptionIndex } from './engine';
import type { ChoiceOption } from './types';

const options: ChoiceOption[] = [
  { text: 'Always visible' },
  {
    text: 'State-gated',
    when: { var: 'insight', op: 'gte', value: 2 },
  },
  {
    text: 'Inventory-gated',
    when: { var: 'royal_record', op: 'eq', value: true },
  },
];

describe('conditional choice availability', () => {
  it('keeps authored order while hiding failed conditions', () => {
    const available = resolveAvailableChoiceOptions(options, { insight: 2 }, { royal_record: false });

    expect(available.map(({ option }) => option.text)).toEqual(['Always visible', 'State-gated']);
    expect(available.map(({ authoredIndex }) => authoredIndex)).toEqual([0, 1]);
  });

  it('can unlock an option from inventory state', () => {
    const available = resolveAvailableChoiceOptions(options, { insight: 0 }, { royal_record: true });

    expect(available.map(({ option }) => option.text)).toEqual(['Always visible', 'Inventory-gated']);
  });

  it('maps an authored timeout target to its visible index and safely falls back', () => {
    const available = resolveAvailableChoiceOptions(options, { insight: 0 }, { royal_record: true });

    expect(resolveVisibleTimeoutOptionIndex(available, 2)).toBe(1);
    expect(resolveVisibleTimeoutOptionIndex(available, 1)).toBe(0);
  });
});
