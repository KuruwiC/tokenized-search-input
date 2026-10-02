import type { Transaction } from '@tiptap/pm/state';
import type { Editor } from '@tiptap/react';
import { useEffect, useRef } from 'react';

export interface UseSuggestionSchedulingOptions {
  editor: Editor | null;
  updateSuggestions: () => void;
  updateCustomSuggestions: () => void;
  singleLine: boolean;
  expandOnFocus: boolean;
  isInputFocused: boolean;
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
  isInputFocused,
}: UseSuggestionSchedulingOptions): void {
  // Store update functions in refs to avoid useEffect re-execution on function changes
  const updateSuggestionsRef = useRef(updateSuggestions);
  const updateCustomSuggestionsRef = useRef(updateCustomSuggestions);
  useEffect(() => {
    updateSuggestionsRef.current = updateSuggestions;
    updateCustomSuggestionsRef.current = updateCustomSuggestions;
  });

  // RAF ID stored in ref to persist across useEffect dependencies updates
  const rafIdRef = useRef<number | null>(null);

  // Update suggestions on selection/update changes
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

      // Scroll cursor into view in collapsed state only
      if (singleLine || (expandOnFocus && !isInputFocused)) {
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

    const handleTransaction = ({ transaction }: { transaction: Transaction }) => {
      if (transaction.getMeta('exitingToken')) {
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
  }, [editor, singleLine, expandOnFocus, isInputFocused]);
}
