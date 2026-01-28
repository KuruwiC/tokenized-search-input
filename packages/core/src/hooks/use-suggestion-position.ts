import type { Editor } from '@tiptap/core';
import { type RefObject, useState } from 'react';
import type { SuggestionType } from '../plugins/suggestion-plugin';
import { useIsomorphicLayoutEffect } from './use-isomorphic-layout-effect';

export interface SuggestionPosition {
  left: number;
}

/**
 * Calculate suggestion box position based on cursor/anchor position.
 *
 * For field suggestions: position aligns with cursor position
 * For value suggestions: position aligns with token left edge
 *
 * When overflow would occur, shifts left to stay within container.
 */
export function useSuggestionPosition(
  editor: Editor | null,
  anchorPos: number | null,
  suggestionType: SuggestionType,
  containerRef: RefObject<HTMLElement | null>,
  suggestionRef: RefObject<HTMLElement | null>
): SuggestionPosition | null {
  const [position, setPosition] = useState<SuggestionPosition | null>(null);

  useIsomorphicLayoutEffect(() => {
    if (!editor || anchorPos === null || !suggestionType || !containerRef.current) {
      setPosition(null);
      return;
    }

    const container = containerRef.current;
    const containerRect = container.getBoundingClientRect();

    let coords: { left: number; right: number; top: number; bottom: number };
    try {
      coords = editor.view.coordsAtPos(anchorPos);
    } catch {
      // Position might be invalid after document changes
      setPosition(null);
      return;
    }

    // coordsAtPos returns screen coordinates that already account for all CSS layout
    // (including padding from start adornment), so we only need to convert to container-relative
    let left = coords.left - containerRect.left;

    if (suggestionRef.current) {
      const suggestionWidth = suggestionRef.current.offsetWidth;
      const maxLeft = containerRect.width - suggestionWidth;
      left = Math.max(0, Math.min(left, maxLeft));
    }

    setPosition({ left });
  }, [editor, anchorPos, suggestionType, containerRef, suggestionRef]);

  return position;
}
