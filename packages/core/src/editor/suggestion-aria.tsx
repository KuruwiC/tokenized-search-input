import type { Editor } from '@tiptap/react';
import { useIsomorphicLayoutEffect } from '../hooks/use-isomorphic-layout-effect';
import { usePluginState } from '../hooks/use-plugin-state';
import { suggestionKey } from '../plugins/suggestion-plugin';

interface SuggestionAriaProps {
  editor: Editor;
  /** Id of the suggestion popup, referenced by `aria-controls`. */
  listboxId: string;
  /** Prefix of the option ids, referenced by `aria-activedescendant`. */
  optionIdPrefix: string;
}

/**
 * The only writer of the combobox relationships on the contenteditable element:
 * `aria-haspopup`, `aria-expanded`, `aria-controls` and `aria-activedescendant`.
 * They are derived from the suggestion state, and subscribing here keeps the
 * input's root from re-rendering with it. The attributes that do not depend on
 * the suggestion state go through the editor's `editorProps`.
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
