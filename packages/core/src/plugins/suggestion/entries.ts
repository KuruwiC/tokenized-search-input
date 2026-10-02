import type { CustomSuggestion, EnumValue, FieldDefinition } from '../../types';
import { getEnumValue } from '../../utils/enum-value';
import type { SuggestionState } from './types';

export const DEFAULT_CATEGORY = 'Other';

interface EntryBase {
  /** Identifies the entry among the entries of the list, and stays with it as others come. */
  readonly key: string;
}

export type SuggestionEntry =
  | (EntryBase & {
      readonly kind: 'field';
      readonly field: FieldDefinition;
      readonly category: string;
    })
  | (EntryBase & { readonly kind: 'custom'; readonly suggestion: CustomSuggestion })
  | (EntryBase & { readonly kind: 'value'; readonly value: EnumValue });

type EntryDraft =
  | { kind: 'field'; field: FieldDefinition; category: string; key: string }
  | { kind: 'custom'; suggestion: CustomSuggestion; key: string }
  | { kind: 'value'; value: EnumValue; key: string };

/**
 * Fields by category: categories in order of first appearance, the default one last.
 */
function fieldsByCategory(fields: readonly FieldDefinition[]): Array<[string, FieldDefinition[]]> {
  const categories = new Map<string, FieldDefinition[]>();
  for (const field of fields) {
    const category = field.category || DEFAULT_CATEGORY;
    const members = categories.get(category);
    if (members) members.push(field);
    else categories.set(category, [field]);
  }
  const other = categories.get(DEFAULT_CATEGORY);
  if (other) {
    categories.delete(DEFAULT_CATEGORY);
    categories.set(DEFAULT_CATEGORY, other);
  }
  return [...categories];
}

function customKey(suggestion: CustomSuggestion): string {
  const tokens = suggestion.tokens.map((t) => [t.key, t.operator, t.value].join('\u0000'));
  return ['custom', suggestion.label, ...tokens].join('\u0001');
}

/** Tells apart entries that would share a key by their order among those that do. */
function withUniqueKeys(drafts: EntryDraft[]): SuggestionEntry[] {
  const seen = new Map<string, number>();
  return drafts.map((draft) => {
    const occurrence = seen.get(draft.key) ?? 0;
    seen.set(draft.key, occurrence + 1);
    return occurrence === 0 ? draft : { ...draft, key: `${draft.key}#${occurrence}` };
  });
}

/**
 * The options of the open suggestion in the order they are shown. An index into it is the
 * active index; the keys, the arrows, Enter and the list all read it.
 */
export function suggestionEntries(
  state: Pick<SuggestionState, 'type' | 'items' | 'customItems' | 'customDisplayMode'>
): SuggestionEntry[] {
  const { type, items, customItems, customDisplayMode } = state;

  const fieldEntries = (): EntryDraft[] =>
    fieldsByCategory(items as readonly FieldDefinition[]).flatMap(([category, members]) =>
      members.map(
        (field): EntryDraft => ({ kind: 'field', field, category, key: `field:${field.key}` })
      )
    );
  const customEntries = (): EntryDraft[] =>
    customItems.map(
      (suggestion): EntryDraft => ({ kind: 'custom', suggestion, key: customKey(suggestion) })
    );

  switch (type) {
    case 'field':
      return withUniqueKeys(fieldEntries());
    case 'custom':
      return withUniqueKeys(customEntries());
    case 'fieldWithCustom':
      return withUniqueKeys(
        customDisplayMode === 'prepend'
          ? [...customEntries(), ...fieldEntries()]
          : [...fieldEntries(), ...customEntries()]
      );
    case 'value':
      return withUniqueKeys(
        (items as readonly EnumValue[]).map(
          (value): EntryDraft => ({
            kind: 'value',
            value,
            key: `value:${getEnumValue(value)}`,
          })
        )
      );
    default:
      return [];
  }
}
