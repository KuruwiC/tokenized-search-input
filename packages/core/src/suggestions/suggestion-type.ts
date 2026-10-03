import type { SuggestionType } from '../plugins/suggestion';

/** Whether the suggestion is a date or date-time picker, which only an explicit choice closes. */
export const isPickerType = (type: SuggestionType): boolean =>
  type === 'date' || type === 'datetime';

/**
 * What counts as inside a suggestion when deciding whether an interaction leaves it:
 * - container: the editor and the suggestion list, for suggestions typed into the text
 * - value-input: the value input of the token and the suggestion, for suggestions that
 *   belong to a token, which close when focus moves anywhere else
 */
export type InteractionBoundary = 'container' | 'value-input';

export const interactionBoundary = (type: SuggestionType): InteractionBoundary =>
  type === 'value' || isPickerType(type) ? 'value-input' : 'container';
