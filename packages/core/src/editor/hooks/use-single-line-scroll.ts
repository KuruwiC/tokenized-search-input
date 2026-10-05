import type { Editor } from '@tiptap/core';
import { type RefObject, useEffect } from 'react';
import { getFocusedTokenId } from '../../plugins/token-focus';
import { isWithinSearchInput } from '../../utils/dom-focus';
import { findTokenById } from '../../utils/find-token';

export interface UseSingleLineScrollOptions {
  editor: Editor | null;
  containerRef: RefObject<HTMLElement | null>;
  /** singleLine, or expandOnFocus, which shows one line while collapsed. */
  enabled: boolean;
}

interface InlineExtent {
  left: number;
  right: number;
}

/** What has to stay in view: the token being edited, otherwise the caret. */
function extentToKeepInView(editor: Editor): InlineExtent | null {
  const { state, view } = editor;
  const tokenId = getFocusedTokenId(state);
  if (tokenId === null) return view.coordsAtPos(state.selection.head);
  const token = findTokenById(state.doc, tokenId);
  const element = token ? view.nodeDOM(token.pos) : null;
  return element instanceof HTMLElement ? element.getBoundingClientRect() : null;
}

/**
 * Scrolls `scroller` sideways by the least amount that brings `extent` inside its padding,
 * its start edge first when it is wider than the box.
 */
function scrollIntoInlineView(scroller: HTMLElement, extent: InlineExtent): void {
  const style = getComputedStyle(scroller);
  const left = scroller.getBoundingClientRect().left + scroller.clientLeft;
  const start = left + Number.parseFloat(style.paddingLeft);
  const end = left + scroller.clientWidth - Number.parseFloat(style.paddingRight);
  let delta = 0;
  if (extent.right > end) delta = extent.right - end;
  if (extent.left - delta < start) delta = extent.left - start;
  if (delta !== 0) scroller.scrollLeft += delta;
}

/**
 * Owns the sideways scroll of the one-line presentation, as an `<input>` does: it starts at
 * the inline start, follows the caret or the token being edited while focus is anywhere in
 * the input, and returns to the inline start when focus leaves the input.
 */
export function useSingleLineScroll({
  editor,
  containerRef,
  enabled,
}: UseSingleLineScrollOptions): void {
  useEffect(() => {
    if (!enabled || !editor || editor.isDestroyed) return;
    const container = containerRef.current;
    if (!container) return;
    const scroller = editor.view.dom;

    // A collapsing expandOnFocus input becomes a scroller again after focus left, and an
    // engine may bring back the scroll it had before it opened, so the rest state is
    // applied again when the size changes.
    const settle = () => {
      if (editor.isDestroyed) return;
      if (!isWithinSearchInput(container, document.activeElement)) {
        scroller.scrollLeft = 0;
        return;
      }
      if (scroller.scrollWidth <= scroller.clientWidth) return;
      const extent = extentToKeepInView(editor);
      if (extent) scrollIntoInlineView(scroller, extent);
    };

    // Tokens are drawn after the transaction that adds them, so the line is watched for
    // the width they take as well as the selection and the document. An environment
    // without ResizeObserver (jsdom, for one) settles on those changes only.
    const sizes = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(settle);
    const watchSizes = () => {
      if (!sizes) return;
      sizes.disconnect();
      sizes.observe(scroller);
      if (scroller.firstElementChild) sizes.observe(scroller.firstElementChild);
    };
    const handleUpdate = () => {
      watchSizes();
      settle();
    };

    const returnToStart = (e: FocusEvent) => {
      if (!isWithinSearchInput(container, e.relatedTarget)) scroller.scrollLeft = 0;
    };

    watchSizes();
    editor.on('selectionUpdate', settle);
    editor.on('update', handleUpdate);
    container.addEventListener('focusin', settle);
    container.addEventListener('focusout', returnToStart);
    return () => {
      sizes?.disconnect();
      editor.off('selectionUpdate', settle);
      editor.off('update', handleUpdate);
      container.removeEventListener('focusin', settle);
      container.removeEventListener('focusout', returnToStart);
    };
  }, [editor, containerRef, enabled]);
}
