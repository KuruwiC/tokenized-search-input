/**
 * Suggestion Plugin
 *
 * ProseMirror plugin for managing suggestion state in the editor.
 */

import type { Node as ProseMirrorNode } from '@tiptap/pm/model';
import type { EditorState, Transaction } from '@tiptap/pm/state';
import { Plugin, PluginKey } from '@tiptap/pm/state';
import type { EnumValue, FieldDefinition } from '../../types';
import { findTokenById } from '../../utils/find-token';
import { isFilterToken, isToken } from '../../utils/node-predicates';
import { getSuggestionQueryUpdate } from '../shared/meta';
import { getTokenFocusMeta } from '../token-focus-plugin';
import { createResetState } from './state-helpers';
import type {
  CloseSuggestionMeta,
  SetSuggestionMeta,
  SuggestionAnchor,
  SuggestionMeta,
  SuggestionState,
} from './types';
import { initialSuggestionState } from './types';
import { matchValueSuggestions } from './value-items';

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

export interface SuggestionPluginOptions {
  /**
   * The definition of a field. The query of value suggestions is the value of the
   * token they are anchored to, and their items are derived from it through this.
   */
  resolveField?: (key: string) => FieldDefinition | undefined;
}

interface DerivedValueSuggestion {
  fieldKey: string;
  query: string;
  items: EnumValue[];
}

function deriveValueSuggestion(
  doc: ProseMirrorNode,
  tokenId: string,
  resolveField: SuggestionPluginOptions['resolveField']
): DerivedValueSuggestion | undefined {
  const found = findTokenById(doc, tokenId);
  if (!found || !isFilterToken(found.node)) return undefined;
  const fieldKey = String(found.node.attrs.key ?? '');
  const query = String(found.node.attrs.value ?? '');
  return { fieldKey, query, items: matchValueSuggestions(resolveField?.(fieldKey), query) };
}

/** Shows the value suggestions of the token the user typed into. */
function typedValueSuggestionMeta(
  tr: Transaction,
  resolveField: SuggestionPluginOptions['resolveField']
): SetSuggestionMeta | undefined {
  const tokenId = getSuggestionQueryUpdate(tr);
  if (tokenId === undefined) return undefined;
  const derived = deriveValueSuggestion(tr.doc, tokenId, resolveField);
  if (!derived) return undefined;
  return {
    type: 'value',
    ...derived,
    activeIndex: -1,
    isLoading: false,
    anchor: { tokenId },
    dismissed: false,
  };
}

export function getSuggestionState(state: EditorState): SuggestionState | undefined {
  return suggestionKey.getState(state);
}

export function createSuggestionPlugin(
  options: SuggestionPluginOptions = {}
): Plugin<SuggestionState> {
  const { resolveField } = options;
  return new Plugin<SuggestionState>({
    key: suggestionKey,
    state: {
      init(): SuggestionState {
        return { ...initialSuggestionState };
      },
      apply(tr, value): SuggestionState {
        const tokenFocusMeta = getTokenFocusMeta(tr);

        // Rule: Field/custom suggestions are only valid in plain text areas, not inside tokens.
        // When a token gains focus, automatically close any open field, custom, or fieldWithCustom suggestion.
        if (
          tokenFocusMeta !== undefined &&
          tokenFocusMeta.focused !== null &&
          (value.type === 'field' || value.type === 'custom' || value.type === 'fieldWithCustom')
        ) {
          return createResetState(value);
        }

        // Rule: Value/date/datetime suggestions are only valid inside tokens.
        // When token focus is cleared, automatically close any open value suggestion.
        if (
          tokenFocusMeta?.focused === null &&
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

        // Rule: The query of value suggestions is the value of their token, whichever
        // transaction changed it (typing, undo/redo, a ref call, normalization).
        if (
          tr.docChanged &&
          value.type === 'value' &&
          value.anchor !== null &&
          'tokenId' in value.anchor
        ) {
          const derived = deriveValueSuggestion(tr.doc, value.anchor.tokenId, resolveField);
          if (derived && derived.query !== value.query) {
            value = { ...value, query: derived.query, items: derived.items, activeIndex: -1 };
          }
        }

        const meta =
          (tr.getMeta(suggestionKey) as SuggestionMeta | undefined) ??
          typedValueSuggestionMeta(tr, resolveField);
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
