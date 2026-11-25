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

const optionsWithRequires: ChoiceOption[] = [
  { text: 'Basic option' },
  {
    text: 'Locked option',
    requires: { var: 'key', op: 'eq', value: true },
    lockedText: '열려 있지 않음',
  },
  {
    text: 'Another option',
  },
];

describe('conditional choice availability', () => {
  it('keeps authored order while hiding failed conditions', () => {
    const result = resolveAvailableChoiceOptions(options, { insight: 2 }, { royal_record: false });

    expect(result.options.map(({ option }) => option.text)).toEqual(['Always visible', 'State-gated']);
    expect(result.options.map(({ authoredIndex }) => authoredIndex)).toEqual([0, 1]);
  });

  it('can unlock an option from inventory state', () => {
    const result = resolveAvailableChoiceOptions(options, { insight: 0 }, { royal_record: true });

    expect(result.options.map(({ option }) => option.text)).toEqual(['Always visible', 'Inventory-gated']);
  });

  it('maps an authored timeout target to its visible index and safely falls back', () => {
    const result = resolveAvailableChoiceOptions(options, { insight: 0 }, { royal_record: true });

    expect(resolveVisibleTimeoutOptionIndex(result.options, 2)).toBe(1);
    expect(resolveVisibleTimeoutOptionIndex(result.options, 1)).toBe(0);
  });
});

describe('locked choice options with requires', () => {
  it('shows locked options and tracks them in lockedOptionIndexes', () => {
    const result = resolveAvailableChoiceOptions(optionsWithRequires, { key: false }, {});

    // All options should be visible (when condition passes)
    expect(result.options.map(({ option }) => option.text)).toEqual(['Basic option', 'Locked option', 'Another option']);
    expect(result.lockedOptionIndexes).toEqual([1]);
  });

  it('unlocks an option when requires condition is met', () => {
    const result = resolveAvailableChoiceOptions(optionsWithRequires, { key: true }, {});

    expect(result.options.map(({ option }) => option.text)).toEqual(['Basic option', 'Locked option', 'Another option']);
    expect(result.lockedOptionIndexes).toEqual([]);
  });

  it('marks options as locked when requires is not met', () => {
    const result = resolveAvailableChoiceOptions(optionsWithRequires, { key: false }, {});

    const lockedOption = result.options[1];
    expect(lockedOption.locked).toBe(true);
  });

  it('marks options as not locked when requires is met', () => {
    const result = resolveAvailableChoiceOptions(optionsWithRequires, { key: true }, {});

    const unlockedOption = result.options[1];
    expect(unlockedOption.locked).toBe(false);
  });
});
