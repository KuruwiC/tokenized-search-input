import type { Editor } from '@tiptap/core';
import { type RefObject, useEffect, useRef, useState } from 'react';
import type { SuggestionType } from '../plugins/suggestion';
import { useIsomorphicLayoutEffect } from './use-isomorphic-layout-effect';

export interface SuggestionPosition {
  left: number;
  /**
   * The offset below the top of the container when the container expands on focus and
   * has focus, else undefined: the suggestion then sits under the whole of the input.
   */
  top: number | undefined;
}

/**
 * Calculate suggestion box position based on cursor/anchor position.
 *
 * For field suggestions: position aligns with cursor position
 * For value suggestions: position aligns with token left edge
 *
 * When overflow would occur, shifts left to stay within container.
 *
 * Measured after every commit, since the width of the suggestion and the height of the
 * input change without the anchor moving, and while a suggestion is open, whenever
 * something in the container scrolls (the anchor moves with a single-line input) or the
 * container resizes (the room for the suggestion changes).
 */
export function useSuggestionPosition(
  editor: Editor | null,
  anchorPos: number | null,
  suggestionType: SuggestionType,
  containerRef: RefObject<HTMLElement | null>,
  suggestionRef: RefObject<HTMLElement | null>,
  expandOnFocus: boolean
): SuggestionPosition | null {
  const [position, setPosition] = useState<SuggestionPosition | null>(null);
  const measureRef = useRef<() => void>(() => {});

  const measure = (): void => {
    const place = (next: SuggestionPosition | null) =>
      setPosition((current) =>
        current?.left === next?.left && current?.top === next?.top ? current : next
      );

    if (!editor || anchorPos === null || !suggestionType || !containerRef.current) {
      place(null);
      return;
    }

    const container = containerRef.current;
    const containerRect = container.getBoundingClientRect();

    let coords: { left: number; right: number; top: number; bottom: number };
    try {
      coords = editor.view.coordsAtPos(anchorPos);
    } catch {
      // Position might be invalid after document changes
      place(null);
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

    // Focus within the container is what the expanded layout follows in CSS
    const expanded = expandOnFocus && container.matches(':focus-within');
    const top = expanded ? container.querySelector('.tsi-input')?.scrollHeight : undefined;

    place({ left, top });
  };

  useIsomorphicLayoutEffect(() => {
    measureRef.current = measure;
    measure();
  });

  const open = editor !== null && anchorPos !== null && Boolean(suggestionType);
  useEffect(() => {
    const container = containerRef.current;
    if (!open || !container) return;
    const remeasure = () => measureRef.current();
    // Scroll events do not bubble; capturing them on the container sees every scroller in it.
    container.addEventListener('scroll', remeasure, { capture: true, passive: true });
    const observer = new ResizeObserver(remeasure);
    observer.observe(container);
    return () => {
      container.removeEventListener('scroll', remeasure, { capture: true });
      observer.disconnect();
    };
  }, [open, containerRef]);

  return position;
}
