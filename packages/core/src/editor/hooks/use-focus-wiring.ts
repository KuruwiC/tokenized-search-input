import type { Editor } from '@tiptap/react';
import { type RefObject, useEffect, useRef, useState } from 'react';
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
 * presses outside it. Returns whether focus is currently inside the container.
 */
export function useFocusWiring({
  editor,
  containerRef,
  onFocus,
  onBlur,
  updateSuggestions,
  updateCustomSuggestions,
}: UseFocusWiringOptions): boolean {
  const [isInputFocused, setIsInputFocused] = useState(false);
  const pointerDownInSuggestionRef = useRef(false);

  // Handle focus/blur at container level using focusout (bubbles from all children)
  // This catches blur from both ProseMirror and token value inputs
  // Reference: https://danburzo.ro/focus-within/
  useEffect(() => {
    if (!editor || editor.isDestroyed) return;
    const container = containerRef.current;
    if (!container) return;

    const handleContainerFocusOut = (e: FocusEvent) => {
      // Skip if pointerdown was in suggestion (user is clicking a suggestion item)
      if (pointerDownInSuggestionRef.current) {
        pointerDownInSuggestionRef.current = false;
        return;
      }

      const relatedTarget = e.relatedTarget as Element | null;

      // If focus is moving within the container, not a real blur
      if (relatedTarget && container.contains(relatedTarget)) {
        return;
      }

      // If focus is moving to suggestion overlay (outside container but part of UI)
      if (isWithinSuggestion(relatedTarget)) {
        return;
      }

      // Check if current suggestion type should dismiss on blur
      const suggestionState = getSuggestionState(editor.state);
      if (suggestionState?.type) {
        const policy = getDismissPolicy(suggestionState.type);
        if (!policy.dismissOnBlur) {
          return;
        }
      }

      // Focus is leaving the container - process blur
      setIsInputFocused(false);
      editor.commands.finalizeInput();

      if (onBlur) {
        const snapshot = createQuerySnapshot(editor.getJSON(), {
          delimiter: getEditorContext(editor).delimiter,
        });
        onBlur(snapshot);
      }

      const tr = editor.state.tr;
      dismissSuggestion(tr);
      tr.setMeta('addToHistory', false);
      editor.view.dispatch(tr);
    };

    const handleContainerFocusIn = () => {
      // Only trigger on first focus into the container
      if (isInputFocused) return;

      setIsInputFocused(true);

      if (onFocus) {
        const snapshot = createQuerySnapshot(editor.getJSON(), {
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
  }, [
    editor,
    containerRef,
    updateSuggestions,
    updateCustomSuggestions,
    onBlur,
    onFocus,
    isInputFocused,
  ]);

  // Handle outside clicks to dismiss suggestions
  useEffect(() => {
    if (!editor || editor.isDestroyed) return;

    const handlePointerDown = (e: PointerEvent) => {
      const target = e.target as Node;

      // Check if click is inside this editor's suggestion overlay
      const suggestionRoot = containerRef.current?.querySelector('[data-suggestion-root]');
      if (suggestionRoot?.contains(target)) {
        pointerDownInSuggestionRef.current = true;
        return;
      }

      // Check if click is inside editor container
      if (containerRef.current?.contains(target)) {
        return;
      }

      // Click is outside - dismiss suggestions
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

  return isInputFocused;
}
