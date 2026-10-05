import { describe, expect, it } from 'vitest';
import { isPickerType, type SuggestionType } from '../../plugins/suggestion';
import { interactionBoundary } from '../../suggestions/suggestion-type';

describe('isPickerType', () => {
  it.each<[SuggestionType, boolean]>([
    ['date', true],
    ['datetime', true],
    ['field', false],
    ['value', false],
    ['custom', false],
    ['fieldWithCustom', false],
    [null, false],
  ])('%s -> %s', (type, expected) => {
    expect(isPickerType(type)).toBe(expected);
  });
});

describe('interactionBoundary', () => {
  it.each<[SuggestionType, 'container' | 'value-input']>([
    ['field', 'container'],
    ['custom', 'container'],
    ['fieldWithCustom', 'container'],
    [null, 'container'],
    ['value', 'value-input'],
    ['date', 'value-input'],
    ['datetime', 'value-input'],
  ])('%s -> %s', (type, expected) => {
    expect(interactionBoundary(type)).toBe(expected);
  });
});
