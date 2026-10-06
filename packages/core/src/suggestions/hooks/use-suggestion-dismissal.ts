import type { Editor } from '@tiptap/core';
import { type RefObject, useCallback } from 'react';
import {
  dispatchDismissSuggestion,
  isSuggestionOpen,
  type SuggestionState,
  suggestionKey,
} from '../../plugins/suggestion';
import { interactionBoundary } from '../interaction-boundary';
import { type DismissReason, useDismissManager } from './use-dismiss-manager';

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

      dispatchDismissSuggestion(editor.view);
      return true;
    },
    [editor]
  );

  useDismissManager(isSuggestionOpen(suggestionState), type, isInside, dismiss);
}
