import type { Node as ProseMirrorNode } from '@tiptap/pm/model';
import type { EditorState, Transaction } from '@tiptap/pm/state';
import { Plugin, PluginKey } from '@tiptap/pm/state';
import type { EnumValue, FieldDefinition } from '../../types';
import { findTokenById } from '../../utils/find-token';
import { isFilterToken, isToken } from '../../utils/node-predicates';
import { getSuggestionQueryUpdate } from '../shared/meta';
import { getTokenFocusMeta } from '../token-focus/state';
import { suggestionEntries } from './entries';
import { createResetState } from './state-helpers';
import type { SetSuggestionMeta, SuggestionAnchor, SuggestionMeta, SuggestionState } from './types';
import { initialSuggestionState, isCloseMeta } from './types';
import { matchValueSuggestions } from './value-items';

export const suggestionKey = new PluginKey<SuggestionState>('suggestion');

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

        // Field and custom suggestions belong to plain text, so they close when a token gains focus.
        if (
          tokenFocusMeta !== undefined &&
          tokenFocusMeta.focused !== null &&
          (value.type === 'field' || value.type === 'custom' || value.type === 'fieldWithCustom')
        ) {
          return createResetState(value);
        }

        // Value, date and datetime suggestions belong to a token, so they close when token focus clears.
        if (
          tokenFocusMeta?.focused === null &&
          (value.type === 'value' || value.type === 'date' || value.type === 'datetime')
        ) {
          return createResetState(value);
        }

        // A suggestion lives as long as what it is anchored to. This covers a token deleted
        // with Backspace, where no blur event fires.
        if (tr.docChanged && value.anchor !== null && value.type !== null) {
          const anchor = followAnchor(value, value.anchor, tr);
          if (anchor === null) {
            return createResetState(value);
          }
          if (anchor !== value.anchor) {
            value = { ...value, anchor };
          }
        }

        // The query of value suggestions is the value of their token, whichever
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

        const newType = meta.type ?? value.type;
        // A suggestion that is closed or dismissed keeps none of the custom suggestions it had
        const newDismissed = meta.dismissed ?? value.dismissed;
        const closed = newType === null || newDismissed;
        const newItems = meta.items ?? value.items;
        const newCustomItems = closed ? [] : (meta.customItems ?? value.customItems);
        const newCustomDisplayMode = closed
          ? null
          : meta.customDisplayMode !== undefined
            ? meta.customDisplayMode
            : value.customDisplayMode;

        const totalItems = suggestionEntries({
          type: newType,
          items: newItems,
          customItems: newCustomItems,
          customDisplayMode: newCustomDisplayMode,
        }).length;
        let newActiveIndex = meta.activeIndex ?? value.activeIndex;
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
          custom: closed ? initialSuggestionState.custom : (meta.custom ?? value.custom),
          activeIndex: newActiveIndex,
          isLoading: meta.isLoading ?? value.isLoading,
          anchor: meta.anchor !== undefined ? meta.anchor : value.anchor,
          dateValue: meta.dateValue !== undefined ? meta.dateValue : value.dateValue,
          isUTC: meta.isUTC ?? value.isUTC,
          includeTime: meta.includeTime ?? value.includeTime,
          dismissed: newDismissed,
          customDisplayMode: newCustomDisplayMode,
        };
      },
    },
  });
}
