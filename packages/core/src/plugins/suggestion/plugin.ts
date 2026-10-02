/**
 * Suggestion Plugin
 *
 * ProseMirror plugin for managing suggestion state in the editor.
 */

import type { EditorState, Transaction } from '@tiptap/pm/state';
import { Plugin, PluginKey } from '@tiptap/pm/state';
import { findTokenById } from '../../utils/find-token';
import { isToken } from '../../utils/node-predicates';
import { getTokenFocusEvent } from '../shared/editor-events';
import { getTokenFocusMeta } from '../token-focus-plugin';
import { createResetState } from './state-helpers';
import type {
  CloseSuggestionMeta,
  SuggestionAnchor,
  SuggestionMeta,
  SuggestionState,
} from './types';
import { initialSuggestionState } from './types';

export const suggestionKey = new PluginKey<SuggestionState>('suggestion');

function isCloseMeta(meta: SuggestionMeta): meta is CloseSuggestionMeta {
  return 'close' in meta && meta.close === true;
}

/**
 * The anchor of an open suggestion after a document change, or null when what it
 * was anchored to is gone. A token anchor holds while a token with that id and
 * the suggestion's field is in the document, whatever happened to its attributes.
 */
function followAnchor(
  value: SuggestionState,
  anchor: SuggestionAnchor,
  tr: Transaction
): SuggestionAnchor | null {
  if ('tokenId' in anchor) {
    const found = findTokenById(tr.doc, anchor.tokenId);
    if (!found) return null;
    if (value.fieldKey !== null && found.node.attrs.key !== value.fieldKey) return null;
    return anchor;
  }

  const mapResult = tr.mapping.mapResult(anchor.pos);
  if (mapResult.deleted) return null;
  const node = tr.doc.nodeAt(mapResult.pos);
  if (!node || !isToken(node)) return null;
  return mapResult.pos === anchor.pos ? anchor : { pos: mapResult.pos };
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

        // Rule: A suggestion lives as long as what it is anchored to. This also covers
        // token deletion (e.g., Backspace), where no blur event fires.
        if (tr.docChanged && value.anchor !== null && value.type !== null) {
          const anchor = followAnchor(value, value.anchor, tr);
          if (anchor === null) {
            return createResetState(value);
          }
          if (anchor !== value.anchor) {
            value = { ...value, anchor };
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
          anchor: meta.anchor !== undefined ? meta.anchor : value.anchor,
          dateValue: meta.dateValue !== undefined ? meta.dateValue : value.dateValue,
          dismissed: meta.dismissed ?? value.dismissed,
          customDisplayMode:
            meta.customDisplayMode !== undefined ? meta.customDisplayMode : value.customDisplayMode,
        };
      },
    },
  });
}
