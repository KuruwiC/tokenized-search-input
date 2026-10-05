import type { Editor } from '@tiptap/core';
import { useEffect, useRef } from 'react';
import { getFocusedTokenId } from '../../plugins/token-focus';

export interface UseSuggestionSchedulingOptions {
  editor: Editor | null;
  updateSuggestions: () => void;
  updateCustomSuggestions: () => void;
}

/**
 * Re-evaluates the suggestions after selection and document changes, one animation
 * frame later so a burst of changes is evaluated once.
 */
export function useSuggestionScheduling({
  editor,
  updateSuggestions,
  updateCustomSuggestions,
}: UseSuggestionSchedulingOptions): void {
  // Store update functions in refs to avoid useEffect re-execution on function changes
  const updateSuggestionsRef = useRef(updateSuggestions);
  const updateCustomSuggestionsRef = useRef(updateCustomSuggestions);
  useEffect(() => {
    updateSuggestionsRef.current = updateSuggestions;
    updateCustomSuggestionsRef.current = updateCustomSuggestions;
  });

  const rafIdRef = useRef<number | null>(null);

  useEffect(() => {
    if (!editor || editor.isDestroyed) return;

    const debouncedUpdate = () => {
      if (rafIdRef.current !== null) {
        cancelAnimationFrame(rafIdRef.current);
      }
      rafIdRef.current = requestAnimationFrame(() => {
        updateSuggestionsRef.current();
        updateCustomSuggestionsRef.current();
        rafIdRef.current = null;
      });
    };

    // Leaving a token returns to the text, where other suggestions apply. Focus can end
    // without a transition naming it, when the focused token leaves the document, so the
    // focus before and after each transaction is compared.
    let focusedId = getFocusedTokenId(editor.state);
    const handleTransaction = () => {
      const left = focusedId !== null;
      focusedId = getFocusedTokenId(editor.state);
      if (left && focusedId === null) {
        requestAnimationFrame(() => {
          updateSuggestionsRef.current();
          updateCustomSuggestionsRef.current();
        });
      }
    };

    editor.on('selectionUpdate', debouncedUpdate);
    editor.on('update', debouncedUpdate);
    editor.on('transaction', handleTransaction);

    return () => {
      if (rafIdRef.current !== null) {
        cancelAnimationFrame(rafIdRef.current);
        rafIdRef.current = null;
      }
      editor.off('selectionUpdate', debouncedUpdate);
      editor.off('update', debouncedUpdate);
      editor.off('transaction', handleTransaction);
    };
  }, [editor]);
}
