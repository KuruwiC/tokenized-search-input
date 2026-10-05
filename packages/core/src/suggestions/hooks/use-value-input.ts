import type { Editor } from '@tiptap/core';
import { useCallback } from 'react';
import { suggestionKey } from '../../plugins/suggestion';
import { findValueInput } from '../../utils/dom-focus';
import { findTokenById } from '../../utils/find-token';

/**
 * The value input of the token the suggestion is anchored to, which is where a value,
 * date or datetime suggestion is operated from. Null when the suggestion belongs to the
 * typed text rather than a token. Read from the current state: positions and elements
 * change under a suggestion that stays open.
 */
export function findSuggestionValueInput(editor: Editor): HTMLInputElement | null {
  const anchor = suggestionKey.getState(editor.state)?.anchor ?? null;
  if (anchor === null || !('tokenId' in anchor)) return null;
  const found = findTokenById(editor.state.doc, anchor.tokenId);
  if (!found) return null;
  const dom = editor.view.nodeDOM(found.pos);
  return dom instanceof HTMLElement ? findValueInput(dom) : null;
}

/**
 * The value input of the token a suggestion belongs to, and a way to give it focus again,
 * for instance after a picker control took it.
 */
export function useValueInput(editor: Editor): {
  getValueInput: () => HTMLInputElement | null;
  restoreFocus: () => void;
} {
  const getValueInput = useCallback(() => findSuggestionValueInput(editor), [editor]);

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
