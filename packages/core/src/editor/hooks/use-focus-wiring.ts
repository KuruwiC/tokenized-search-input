import type { Editor } from '@tiptap/core';
import { type RefObject, useEffect } from 'react';
import { getSerializeOptions } from '../../extensions/editor-context';
import { clearDismissed, dismissSuggestion, getSuggestionState } from '../../plugins/suggestion';
import { createQuerySnapshot } from '../../serializer';
import { interactionBoundary } from '../../suggestions/interaction-boundary';
import type { QuerySnapshot } from '../../types';
import { isWithinSearchInput, isWithinSuggestion } from '../../utils/dom-focus';

export interface UseFocusWiringOptions {
  editor: Editor | null;
  containerRef: RefObject<HTMLElement | null>;
  onFocus: ((snapshot: QuerySnapshot) => void) | undefined;
  onBlur: ((snapshot: QuerySnapshot) => void) | undefined;
  updateSuggestions: () => void;
  updateCustomSuggestions: () => void;
}

/** Elements a press focuses by itself. */
const FOCUSABLE = 'input, textarea, select, button, a[href], [tabindex], [contenteditable="true"]';

/**
 * Wires focus entering and leaving the whole container (onFocus, onBlur and the
 * suggestion dismissal that goes with them) and dismisses suggestions on pointer
 * presses outside it. Whether focus entered or left is decided only by where it moves:
 * from or to an element outside the container and its suggestion overlay. A press in
 * the overlay that does not land on a focusable control keeps focus where it is, so
 * focus does not fall back to the document there.
 */
export function useFocusWiring({
  editor,
  containerRef,
  onFocus,
  onBlur,
  updateSuggestions,
  updateCustomSuggestions,
}: UseFocusWiringOptions): void {
  // Handle focus/blur at container level using focusout (bubbles from all children)
  // This catches blur from both ProseMirror and token value inputs
  // Reference: https://danburzo.ro/focus-within/
  useEffect(() => {
    if (!editor || editor.isDestroyed) return;
    const container = containerRef.current;
    if (!container) return;

    const handleContainerFocusOut = (e: FocusEvent) => {
      if (isWithinSearchInput(container, e.relatedTarget)) return;

      editor.commands.finalizeInput();

      if (onBlur) {
        const snapshot = createQuerySnapshot(editor.state, getSerializeOptions(editor));
        onBlur(snapshot);
      }

      // A suggestion that belongs to a token is closed through the token, not by focus
      // leaving the editor.
      const type = getSuggestionState(editor.state)?.type;
      if (type && interactionBoundary(type) === 'value-input') return;
      const tr = editor.state.tr;
      dismissSuggestion(tr);
      editor.view.dispatch(tr);
    };

    const handleContainerFocusIn = (e: FocusEvent) => {
      if (isWithinSearchInput(container, e.relatedTarget)) return;

      if (onFocus) {
        const snapshot = createQuerySnapshot(editor.state, getSerializeOptions(editor));
        onFocus(snapshot);
      }

      const tr = editor.state.tr;
      clearDismissed(tr);
      editor.view.dispatch(tr);
      updateSuggestions();
      updateCustomSuggestions();
    };

    const keepFocusOnSuggestionPress = (e: MouseEvent) => {
      const target = e.target;
      if (!(target instanceof Element) || !isWithinSuggestion(target)) return;
      if (target.closest(FOCUSABLE)) return;
      e.preventDefault();
    };

    container.addEventListener('focusout', handleContainerFocusOut);
    container.addEventListener('focusin', handleContainerFocusIn);
    container.addEventListener('mousedown', keepFocusOnSuggestionPress);

    return () => {
      container.removeEventListener('focusout', handleContainerFocusOut);
      container.removeEventListener('focusin', handleContainerFocusIn);
      container.removeEventListener('mousedown', keepFocusOnSuggestionPress);
    };
  }, [editor, containerRef, updateSuggestions, updateCustomSuggestions, onBlur, onFocus]);

  useEffect(() => {
    if (!editor || editor.isDestroyed) return;

    const handlePointerDown = (e: PointerEvent) => {
      const target = e.target as Node;
      if (containerRef.current?.contains(target)) return;

      const tr = editor.state.tr;
      dismissSuggestion(tr);
      editor.view.dispatch(tr);
    };

    document.addEventListener('pointerdown', handlePointerDown, true);

    return () => {
      document.removeEventListener('pointerdown', handlePointerDown, true);
    };
  }, [editor, containerRef]);
}
