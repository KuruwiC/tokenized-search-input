/**
 * Suggestion Plugin
 *
 * ProseMirror plugin for managing suggestion state in the editor.
 */

import type { EditorState } from '@tiptap/pm/state';
import { Plugin, PluginKey } from '@tiptap/pm/state';
import { isToken } from '../../utils/node-predicates';
import { getTokenFocusEvent } from '../shared/editor-events';
import { getTokenFocusMeta } from '../token-focus-plugin';
import { createResetState } from './state-helpers';
import type { CloseSuggestionMeta, SuggestionMeta, SuggestionState } from './types';
import { initialSuggestionState } from './types';

export const suggestionKey = new PluginKey<SuggestionState>('suggestion');

function isCloseMeta(meta: SuggestionMeta): meta is CloseSuggestionMeta {
  return 'close' in meta && meta.close === true;
}

export function getSuggestionState(state: EditorState): SuggestionState | undefined {
  return suggestionKey.getState(state);
}

export function createSuggestionPlugin(): Plugin<SuggestionState> {
  return new Plugin<SuggestionState>({
    key: suggestionKey,
    state: {
      init(): SuggestionState {
        return { ...initialSuggestionState };
      },
      apply(tr, value): SuggestionState {
        // Get token focus state from Meta (preferred) or fallback to direct Meta access
        const tokenFocusEvent = getTokenFocusEvent(tr);
        const tokenFocusMeta = tokenFocusEvent ?? getTokenFocusMeta(tr);

        // Rule: Field/custom suggestions are only valid in plain text areas, not inside tokens.
        // When a token gains focus, automatically close any open field, custom, or fieldWithCustom suggestion.
        if (
          tokenFocusMeta?.focusedPos != null &&
          (value.type === 'field' || value.type === 'custom' || value.type === 'fieldWithCustom')
        ) {
          return createResetState(value);
        }

        // Rule: Value/date/datetime suggestions are only valid inside tokens.
        // When token focus is cleared, automatically close any open value suggestion.
        if (
          tokenFocusMeta?.focusedPos === null &&
          (value.type === 'value' || value.type === 'date' || value.type === 'datetime')
        ) {
          return createResetState(value);
        }

        // Rule: When document changes and we have an active suggestion with anchorPos,
        // validate that the anchor still points to a valid token.
        // This handles token deletion (e.g., Backspace) where blur events don't fire.
        if (tr.docChanged && value.anchorPos !== null && value.type !== null) {
          const mapResult = tr.mapping.mapResult(value.anchorPos);

          // For date/datetime pickers, check if a token still exists at the position.
          // setNodeMarkup marks the position as "deleted" even though the node is just updated,
          // so we can't rely on mapResult.deleted for these picker types.
          if (value.type === 'date' || value.type === 'datetime') {
            const mappedPos = mapResult.pos;
            try {
              const node = tr.doc.nodeAt(mappedPos);
              // If no token exists at the position, close the picker
              if (!node || !isToken(node)) {
                return createResetState(value);
              }
              // Update anchorPos if it shifted
              if (mappedPos !== value.anchorPos) {
                value = { ...value, anchorPos: mappedPos };
              }
            } catch {
              // Position resolution failed - close picker
              return createResetState(value);
            }
          } else {
            // For field/value suggestions, use mapResult.deleted check
            if (mapResult.deleted) {
              return createResetState(value);
            }
            // Check if a valid token exists at the mapped position
            const mappedPos = mapResult.pos;
            try {
              const node = tr.doc.nodeAt(mappedPos);
              if (!node || !isToken(node)) {
                return createResetState(value);
              }

              // For value suggestions, verify the token's fieldKey matches
              if (value.type === 'value' && value.fieldKey !== null) {
                const tokenFieldKey = node.attrs?.key;
                if (tokenFieldKey !== value.fieldKey) {
                  return createResetState(value);
                }
              }

              // Update anchorPos if it shifted due to document changes
              if (mappedPos !== value.anchorPos) {
                value = { ...value, anchorPos: mappedPos };
              }
            } catch {
              // Position resolution failed - close suggestion
              return createResetState(value);
            }
          }
        }

        const meta = tr.getMeta(suggestionKey) as SuggestionMeta | undefined;
        if (!meta) {
          return value;
        }

        if (isCloseMeta(meta)) {
          return createResetState(value);
        }

        const newItems = meta.items ?? value.items;
        const newCustomItems = meta.customItems ?? value.customItems;
        let newActiveIndex = meta.activeIndex ?? value.activeIndex;

        // Determine total item count based on suggestion type
        const newType = meta.type ?? value.type;
        let totalItems: number;
        if (newType === 'custom') {
          totalItems = newCustomItems.length;
        } else if (newType === 'fieldWithCustom') {
          totalItems = newItems.length + newCustomItems.length;
        } else {
          totalItems = newItems.length;
        }

        if (totalItems === 0) {
          newActiveIndex = -1;
        } else if (newActiveIndex >= totalItems) {
          newActiveIndex = totalItems - 1;
        } else if (newActiveIndex < -1) {
          newActiveIndex = -1;
        }

        return {
          type: newType,
          fieldKey: meta.fieldKey !== undefined ? meta.fieldKey : value.fieldKey,
          query: meta.query ?? value.query,
          items: newItems,
          customItems: newCustomItems,
          activeIndex: newActiveIndex,
          isLoading: meta.isLoading ?? value.isLoading,
          anchorPos: meta.anchorPos !== undefined ? meta.anchorPos : value.anchorPos,
          dateValue: meta.dateValue !== undefined ? meta.dateValue : value.dateValue,
          fieldSuggestionsDisabled: meta.fieldSuggestionsDisabled ?? value.fieldSuggestionsDisabled,
          valueSuggestionsDisabled: meta.valueSuggestionsDisabled ?? value.valueSuggestionsDisabled,
          dismissed: meta.dismissed ?? value.dismissed,
          customDisplayMode:
            meta.customDisplayMode !== undefined ? meta.customDisplayMode : value.customDisplayMode,
        };
      },
    },
  });
}
