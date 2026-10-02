import type { Editor } from '@tiptap/react';
import { type RefObject, useEffect, useRef } from 'react';
import { getEditorContext } from '../../extensions/editor-context';
import {
  clearDismissed,
  dismissSuggestion,
  getSuggestionState,
} from '../../plugins/suggestion-plugin';
import { createQuerySnapshot } from '../../serializer';
import { getDismissPolicy } from '../../suggestions/dismiss-policy';
import type { QuerySnapshot } from '../../types';
import { isWithinSuggestion } from '../../utils/dom-focus';

export interface UseFocusWiringOptions {
  editor: Editor | null;
  containerRef: RefObject<HTMLElement | null>;
  onFocus: ((snapshot: QuerySnapshot) => void) | undefined;
  onBlur: ((snapshot: QuerySnapshot) => void) | undefined;
  updateSuggestions: () => void;
  updateCustomSuggestions: () => void;
}

/**
 * Wires focus entering and leaving the whole container (onFocus, onBlur and the
 * suggestion dismissal that goes with them) and dismisses suggestions on pointer
 * presses outside it. Whether focus entered or left is decided only by where it moves:
 * from or to an element outside the container and its suggestion overlay.
 */
export function useFocusWiring({
  editor,
  containerRef,
  onFocus,
  onBlur,
  updateSuggestions,
  updateCustomSuggestions,
}: UseFocusWiringOptions): void {
  const pointerDownInSuggestionRef = useRef(false);

  // Handle focus/blur at container level using focusout (bubbles from all children)
  // This catches blur from both ProseMirror and token value inputs
  // Reference: https://danburzo.ro/focus-within/
  useEffect(() => {
    if (!editor || editor.isDestroyed) return;
    const container = containerRef.current;
    if (!container) return;

    // The suggestion overlay may render outside the container; it is still part of it.
    const isInside = (target: EventTarget | null): boolean =>
      target instanceof Element && (container.contains(target) || isWithinSuggestion(target));

    const handleContainerFocusOut = (e: FocusEvent) => {
      // Skip if pointerdown was in suggestion (user is clicking a suggestion item)
      if (pointerDownInSuggestionRef.current) {
        pointerDownInSuggestionRef.current = false;
        return;
      }
      if (isInside(e.relatedTarget)) return;

      editor.commands.finalizeInput();

      if (onBlur) {
        const snapshot = createQuerySnapshot(editor.state, {
          delimiter: getEditorContext(editor).delimiter,
        });
        onBlur(snapshot);
      }

      // The suggestion's policy decides whether it closes when focus leaves.
      const type = getSuggestionState(editor.state)?.type;
      if (type && !getDismissPolicy(type).dismissOnBlur) return;
      const tr = editor.state.tr;
      dismissSuggestion(tr);
      tr.setMeta('addToHistory', false);
      editor.view.dispatch(tr);
    };

    const handleContainerFocusIn = (e: FocusEvent) => {
      if (isInside(e.relatedTarget)) return;

      if (onFocus) {
        const snapshot = createQuerySnapshot(editor.state, {
          delimiter: getEditorContext(editor).delimiter,
        });
        onFocus(snapshot);
      }

      const tr = editor.state.tr;
      clearDismissed(tr);
      tr.setMeta('addToHistory', false);
      editor.view.dispatch(tr);
      updateSuggestions();
      updateCustomSuggestions();
    };

    container.addEventListener('focusout', handleContainerFocusOut);
    container.addEventListener('focusin', handleContainerFocusIn);

    return () => {
      container.removeEventListener('focusout', handleContainerFocusOut);
      container.removeEventListener('focusin', handleContainerFocusIn);
    };
  }, [editor, containerRef, updateSuggestions, updateCustomSuggestions, onBlur, onFocus]);

  useEffect(() => {
    if (!editor || editor.isDestroyed) return;

    const handlePointerDown = (e: PointerEvent) => {
      const target = e.target as Node;

      const suggestionRoot = containerRef.current?.querySelector('[data-suggestion-root]');
      if (suggestionRoot?.contains(target)) {
        pointerDownInSuggestionRef.current = true;
        return;
      }

      if (containerRef.current?.contains(target)) {
        return;
      }

      const tr = editor.state.tr;
      dismissSuggestion(tr);
      tr.setMeta('addToHistory', false);
      editor.view.dispatch(tr);
    };

    document.addEventListener('pointerdown', handlePointerDown, true);

    return () => {
      document.removeEventListener('pointerdown', handlePointerDown, true);
    };
  }, [editor, containerRef]);
}
