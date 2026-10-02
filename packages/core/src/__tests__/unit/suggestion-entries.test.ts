import { describe, expect, it } from 'vitest';
import { type SuggestionEntry, suggestionEntries } from '../../plugins/suggestion/entries';
import { initialSuggestionState, type SuggestionState } from '../../plugins/suggestion-plugin';
import type { CustomSuggestion, FieldDefinition } from '../../types';

const field = (key: string, category?: string): FieldDefinition => ({
  key,
  label: key,
  type: 'string',
  operators: ['is'],
  category,
});

const custom = (label: string, value = label): CustomSuggestion => ({
  label,
  tokens: [{ key: 'owner', operator: 'is', value }],
});

const state = (patch: Partial<SuggestionState>): SuggestionState => ({
  ...initialSuggestionState,
  ...patch,
});

function describeEntry(entry: SuggestionEntry): string {
  switch (entry.kind) {
    case 'field':
      return `field:${entry.field.key}`;
    case 'custom':
      return `custom:${entry.suggestion.label}`;
    case 'value':
      return `value:${String(entry.value)}`;
  }
}

const labels = (s: SuggestionState) => suggestionEntries(s).map(describeEntry);

describe('suggestionEntries', () => {
  const fields = [field('a'), field('b', 'People'), field('c'), field('d', 'People')];

  it('lists fields by category, the default category last', () => {
    expect(labels(state({ type: 'field', items: fields }))).toEqual([
      'field:b',
      'field:d',
      'field:a',
      'field:c',
    ]);
  });

  it('lists custom suggestions before or after the fields of a mixed list', () => {
    const base = { type: 'fieldWithCustom', items: fields, customItems: [custom('x')] } as const;

    expect(labels(state({ ...base, customDisplayMode: 'prepend' }))[0]).toBe('custom:x');
    expect(labels(state({ ...base, customDisplayMode: 'append' })).slice(-1)[0]).toBe('custom:x');
  });

  it('lists custom suggestions only for the types that show them', () => {
    const customItems = [custom('x')];

    expect(labels(state({ type: 'field', items: fields, customItems }))).not.toContain('custom:x');
    expect(labels(state({ type: 'custom', customItems }))).toEqual(['custom:x']);
    expect(labels(state({ type: 'value', items: ['p', 'q'], customItems }))).toEqual([
      'value:p',
      'value:q',
    ]);
    expect(labels(state({ type: 'date', customItems }))).toEqual([]);
    expect(labels(state({ type: null, customItems }))).toEqual([]);
  });

  it('gives identical custom suggestions different keys that do not move when more arrive', () => {
    const twice = [custom('x'), custom('x')];
    const keys = suggestionEntries(state({ type: 'custom', customItems: twice })).map((e) => e.key);
    const more = suggestionEntries(
      state({ type: 'custom', customItems: [...twice, custom('y')] })
    ).map((e) => e.key);

    expect(new Set(keys).size).toBe(2);
    expect(more.slice(0, 2)).toEqual(keys);
  });
});
