import type { Editor } from '@tiptap/react';
import { type RefObject, useCallback } from 'react';
import {
  findFocusedFilterToken,
  findValueInput,
  getContainingFilterToken,
} from '../../utils/dom-focus';

/**
 * The value input of the token a suggestion belongs to, and a way to give it focus again,
 * for instance after a picker control took it.
 */
export function useValueInput(
  editor: Editor,
  containerRef: RefObject<HTMLElement | null>,
  anchorPos: number | null
): { getValueInput: () => HTMLInputElement | null; restoreFocus: () => void } {
  // Resolved when asked for, not when rendered: positions and elements change under it
  const getValueInput = useCallback((): HTMLInputElement | null => {
    let token = findFocusedFilterToken(containerRef.current);
    if (!token && anchorPos !== null) {
      try {
        const { node } = editor.view.domAtPos(anchorPos);
        token = getContainingFilterToken(
          node.nodeType === Node.ELEMENT_NODE ? (node as Element) : node.parentElement
        );
      } catch {
        return null;
      }
    }
    return findValueInput(token);
  }, [containerRef, anchorPos, editor]);

  const restoreFocus = useCallback(() => {
    requestAnimationFrame(() => {
      const input = getValueInput();
      if (!input) return;
      input.focus();
      const end = input.value.length;
      input.setSelectionRange(end, end);
      // Show the caret at the end, and the input itself on a narrow viewport
      input.scrollLeft = input.scrollWidth;
      input.scrollIntoView({ block: 'nearest', inline: 'nearest' });
    });
  }, [getValueInput]);

  return { getValueInput, restoreFocus };
}
