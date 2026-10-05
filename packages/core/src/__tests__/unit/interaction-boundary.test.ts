import { describe, expect, it } from 'vitest';
import type { SuggestionType } from '../../plugins/suggestion';
import { interactionBoundary } from '../../suggestions/interaction-boundary';

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
