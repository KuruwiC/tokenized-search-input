import type { Editor } from '@tiptap/react';
import { useIsomorphicLayoutEffect } from '../hooks/use-isomorphic-layout-effect';
import { usePluginState } from '../hooks/use-plugin-state';
import { suggestionKey } from '../plugins/suggestion-plugin';

interface SuggestionAriaProps {
  editor: Editor;
  listboxId: string;
  optionIdPrefix: string;
}

/**
 * The only writer of `aria-haspopup`, `aria-expanded`, `aria-controls` and
 * `aria-activedescendant`. Subscribing here keeps the input's root from re-rendering
 * with the suggestion state; the other attributes go through `editorProps`.
 */
export const SuggestionAria: React.FC<SuggestionAriaProps> = ({
  editor,
  listboxId,
  optionIdPrefix,
}) => {
  const suggestionState = usePluginState(editor, suggestionKey);
  const isOpen = !!suggestionState && suggestionState.type !== null && !suggestionState.dismissed;
  const type = suggestionState?.type;
  const activeIndex = suggestionState?.activeIndex ?? -1;

  useIsomorphicLayoutEffect(() => {
    // A destroyed editor has no view; useEditor re-renders with a fresh one.
    if (editor.isDestroyed) return;
    const input = editor.view.dom;
    const popupRole = type === 'date' || type === 'datetime' ? 'dialog' : 'listbox';
    input.setAttribute('aria-haspopup', popupRole);
    input.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
    if (isOpen) {
      input.setAttribute('aria-controls', listboxId);
    } else {
      input.removeAttribute('aria-controls');
    }
    if (isOpen && popupRole === 'listbox' && activeIndex >= 0) {
      input.setAttribute('aria-activedescendant', `${optionIdPrefix}-${activeIndex}`);
    } else {
      input.removeAttribute('aria-activedescendant');
    }
  }, [editor, isOpen, type, activeIndex, listboxId, optionIdPrefix]);

  return null;
};
