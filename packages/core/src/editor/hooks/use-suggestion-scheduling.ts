import type { Editor } from '@tiptap/core';
import { type RefObject, useEffect, useRef } from 'react';
import { getFocusedToken } from '../../plugins/token-focus';

export interface UseSuggestionSchedulingOptions {
  editor: Editor | null;
  updateSuggestions: () => void;
  updateCustomSuggestions: () => void;
  singleLine: boolean;
  expandOnFocus: boolean;
  containerRef: RefObject<HTMLElement | null>;
}

/**
 * Re-evaluates the suggestions after selection and document changes, one animation
 * frame later so a burst of changes is evaluated once, and keeps the cursor in view
 * while the input is collapsed.
 */
export function useSuggestionScheduling({
  editor,
  updateSuggestions,
  updateCustomSuggestions,
  singleLine,
  expandOnFocus,
  containerRef,
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

    const handleSelectionUpdate = () => {
      debouncedUpdate();

      // Collapsed while focus is outside the container.
      const collapsed = expandOnFocus && !containerRef.current?.matches(':focus-within');
      if (singleLine || collapsed) {
        try {
          const domAtPos = editor.view.domAtPos(editor.state.selection.from);
          // domAtPos.node may be a text node, so get the parent element if needed
          const element =
            domAtPos.node instanceof HTMLElement ? domAtPos.node : domAtPos.node.parentElement;
          element?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
        } catch {
          // Ignore errors when position is not in DOM
        }
      }
    };

    // Leaving a token returns to the text, where other suggestions apply. Focus can end
    // without a transition naming it, when the focused token leaves the document, so the
    // focus before and after each transaction is compared.
    let focusedId = getFocusedToken(editor.state)?.id ?? null;
    const handleTransaction = () => {
      const left = focusedId !== null;
      focusedId = getFocusedToken(editor.state)?.id ?? null;
      if (left && focusedId === null) {
        requestAnimationFrame(() => {
          updateSuggestionsRef.current();
          updateCustomSuggestionsRef.current();
        });
      }
    };

    editor.on('selectionUpdate', handleSelectionUpdate);
    editor.on('update', debouncedUpdate);
    editor.on('transaction', handleTransaction);

    return () => {
      if (rafIdRef.current !== null) {
        cancelAnimationFrame(rafIdRef.current);
        rafIdRef.current = null;
      }
      editor.off('selectionUpdate', handleSelectionUpdate);
      editor.off('update', debouncedUpdate);
      editor.off('transaction', handleTransaction);
    };
  }, [editor, singleLine, expandOnFocus, containerRef]);
}
