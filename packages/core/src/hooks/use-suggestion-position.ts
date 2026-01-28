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
    // Get paddingLeft from .ProseMirror element since padding is applied there
    const proseMirrorEl = container.querySelector('.ProseMirror');
    const proseMirrorStyle = proseMirrorEl ? getComputedStyle(proseMirrorEl) : null;
    const paddingLeft = proseMirrorStyle ? parseFloat(proseMirrorStyle.paddingLeft) || 0 : 0;

    let coords: { left: number; right: number; top: number; bottom: number };
    try {
      coords = editor.view.coordsAtPos(anchorPos);
    } catch {
      // Position might be invalid after document changes
      setPosition(null);
      return;
    }

    let left = coords.left - containerRect.left - paddingLeft;

    if (suggestionRef.current) {
      const suggestionWidth = suggestionRef.current.offsetWidth;
      const maxLeft = containerRect.width - suggestionWidth - paddingLeft;
      left = Math.max(0, Math.min(left, maxLeft));
    }

    setPosition({ left });
  }, [editor, anchorPos, suggestionType, containerRef, suggestionRef]);

  return position;
}
