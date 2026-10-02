import type { Editor } from '@tiptap/react';
import { type RefObject, useCallback } from 'react';
import {
  closeSuggestion,
  isSuggestionOpen,
  type SuggestionState,
  suggestionKey,
} from '../../plugins/suggestion-plugin';
import { interactionBoundary } from '../suggestion-type';
import { useDismissManager } from '../use-dismiss-manager';

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
      if (interactionBoundary(type) === 'container') {
        return containerRef.current?.contains(el) === true;
      }
      return getValueInput()?.contains(el) === true;
    },
    [type, containerRef, suggestionRef, getValueInput]
  );

  // Re-check current state to avoid race conditions
  const dismiss = useCallback((): boolean => {
    if (!suggestionKey.getState(editor.state)?.type) return false;

    const tr = editor.state.tr;
    closeSuggestion(tr);
    tr.setMeta('addToHistory', false);
    editor.view.dispatch(tr);
    return true;
  }, [editor]);

  useDismissManager(isSuggestionOpen(suggestionState), type, isInside, dismiss);
}
