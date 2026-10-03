import type { Editor } from '@tiptap/react';
import { type RefObject, useCallback } from 'react';
import {
  closeSuggestion,
  isSuggestionOpen,
  type SuggestionState,
  suggestionKey,
} from '../../plugins/suggestion-plugin';
import { interactionBoundary } from '../suggestion-type';
import { type DismissReason, useDismissManager } from '../use-dismiss-manager';

/** Closes the open suggestion when the user presses or moves focus outside its boundary. */
export function useSuggestionDismissal(
  editor: Editor,
  suggestionState: SuggestionState | undefined,
  containerRef: RefObject<HTMLElement | null>,
  suggestionRef: RefObject<HTMLElement | null>,
  getValueInput: () => HTMLInputElement | null
): void {
  const type = suggestionState?.type ?? null;

  const isInside = useCallback(
    (el: Element | null): boolean => {
      if (!el) return false;
      if (suggestionRef.current?.contains(el)) return true;
      if (interactionBoundary(suggestionKey.getState(editor.state)?.type ?? null) === 'container') {
        return containerRef.current?.contains(el) === true;
      }
      return getValueInput()?.contains(el) === true;
    },
    [editor, containerRef, suggestionRef, getValueInput]
  );

  // The suggestion is read again when the handler runs: it may have changed since the
  // handler was attached, and a focus change only closes one that belongs to a token.
  const dismiss = useCallback(
    (reason: DismissReason): boolean => {
      const current = suggestionKey.getState(editor.state)?.type ?? null;
      if (current === null) return false;
      if (reason === 'focus-outside' && interactionBoundary(current) === 'container') return false;

      const tr = editor.state.tr;
      closeSuggestion(tr);
      editor.view.dispatch(tr);
      return true;
    },
    [editor]
  );

  useDismissManager(isSuggestionOpen(suggestionState), type, isInside, dismiss);
}
