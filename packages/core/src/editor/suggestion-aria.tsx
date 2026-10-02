import type { Editor } from '@tiptap/react';
import { useRef } from 'react';
import { useIsomorphicLayoutEffect } from '../hooks/use-isomorphic-layout-effect';
import { usePluginState } from '../hooks/use-plugin-state';
import {
  isSuggestionOpen,
  resolveAnchorPos,
  type SuggestionState,
  suggestionKey,
} from '../plugins/suggestion-plugin';
import { isPickerType } from '../suggestions/suggestion-type';
import { findValueInput } from '../utils/dom-focus';

interface SuggestionAriaProps {
  editor: Editor;
  listboxId: string;
  optionIdPrefix: string;
}

interface ComboboxRelations {
  isOpen: boolean;
  popup: 'listbox' | 'dialog';
  controls: string;
  activeDescendant: string | undefined;
}

function write(element: HTMLElement, relations: ComboboxRelations): void {
  element.setAttribute('aria-haspopup', relations.popup);
  element.setAttribute('aria-expanded', relations.isOpen ? 'true' : 'false');
  const set = (name: string, value: string | undefined) => {
    if (value === undefined) element.removeAttribute(name);
    else element.setAttribute(name, value);
  };
  set('aria-controls', relations.isOpen ? relations.controls : undefined);
  set('aria-activedescendant', relations.isOpen ? relations.activeDescendant : undefined);
}

/** A suggestion of a token is operated from the value input of that token. */
function findTokenValueInput(
  editor: Editor,
  state: SuggestionState | undefined
): HTMLInputElement | null {
  if (!state) return null;
  const pos = resolveAnchorPos(editor.state.doc, state.anchor);
  if (pos === null) return null;
  const dom = editor.view.nodeDOM(pos);
  return dom instanceof HTMLElement ? findValueInput(dom) : null;
}

/**
 * The only writer of `aria-haspopup`, `aria-expanded`, `aria-controls` and
 * `aria-activedescendant` for the suggestion lists, on the element that holds focus: the
 * editor while the text is typed, the value input of the token while a value or a picker
 * is shown. That input is a combobox for as long as its suggestion is open, and the editor
 * then reads as closed. Subscribing here keeps the input's root from re-rendering with the
 * suggestion state; the other attributes go through `editorProps`.
 */
export const SuggestionAria: React.FC<SuggestionAriaProps> = ({
  editor,
  listboxId,
  optionIdPrefix,
}) => {
  const suggestionState = usePluginState(editor, suggestionKey);
  const ownedInput = useRef<HTMLInputElement | null>(null);

  const release = () => {
    const input = ownedInput.current;
    if (!input) return;
    for (const name of [
      'role',
      'aria-haspopup',
      'aria-expanded',
      'aria-controls',
      'aria-activedescendant',
    ]) {
      input.removeAttribute(name);
    }
    ownedInput.current = null;
  };

  useIsomorphicLayoutEffect(() => {
    // A destroyed editor has no view; useEditor re-renders with a fresh one.
    if (editor.isDestroyed) return;

    const type = suggestionState?.type ?? null;
    // Open only while the overlay has something to show
    const isOpen = isSuggestionOpen(suggestionState);
    const activeIndex = suggestionState?.activeIndex ?? -1;
    const popup = isPickerType(type) ? 'dialog' : 'listbox';
    const relations: ComboboxRelations = {
      isOpen,
      popup,
      controls: listboxId,
      activeDescendant:
        popup === 'listbox' && activeIndex >= 0 ? `${optionIdPrefix}-${activeIndex}` : undefined,
    };

    const belongsToToken = isOpen && (type === 'value' || isPickerType(type));
    const input = belongsToToken ? findTokenValueInput(editor, suggestionState) : null;
    if (ownedInput.current !== input) release();

    if (input) {
      ownedInput.current = input;
      input.setAttribute('role', 'combobox');
      write(input, relations);
      write(editor.view.dom, { ...relations, isOpen: false });
    } else {
      write(editor.view.dom, relations);
    }
  }, [editor, suggestionState, listboxId, optionIdPrefix]);

  useIsomorphicLayoutEffect(() => release, []);

  return null;
};
