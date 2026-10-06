/**
 * Integration tests for what closes an open suggestion.
 */
import { act, cleanup, fireEvent, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { Editor } from '@tiptap/core';
import { afterEach, describe, expect, it, onTestFinished, vi } from 'vitest';
import { getSuggestionState, openFieldSuggestion } from '../../plugins/suggestion';
import { customOptions, fields, renderInput } from '../helpers/suggestion-layer';

afterEach(() => {
  vi.unstubAllGlobals();
  cleanup();
});

/**
 * Keeps animation frames from running until `run` is called, so that a re-evaluation the
 * editor scheduled can be made to run after a later key.
 */
function holdAnimationFrames(): { run: () => void } {
  const held = new Map<number, FrameRequestCallback>();
  let nextId = 1;
  vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
    const id = nextId++;
    held.set(id, callback);
    return id;
  });
  vi.stubGlobal('cancelAnimationFrame', (id: number) => {
    held.delete(id);
  });
  return {
    run: () => {
      vi.unstubAllGlobals();
      const callbacks = [...held.values()];
      held.clear();
      act(() => {
        for (const callback of callbacks) callback(performance.now());
      });
    },
  };
}

describe('dismissal of a suggestion', () => {
  it('does not close a list of fields for a focus change meant for a value suggestion', async () => {
    const user = userEvent.setup();
    const { editor } = await renderInput({ defaultValue: 'status:is:a' });
    await user.click(screen.getByRole('group', { name: /Filter: status/i }));
    await screen.findByRole('listbox');
    expect(getSuggestionState(editor.state)?.type).toBe('value');
    const outside = document.createElement('button');
    document.body.append(outside);
    onTestFinished(() => outside.remove());

    // The handlers of the value suggestion are still attached when the type changes
    editor.view.dispatch(openFieldSuggestion(editor.state.tr, fields, '', 1));
    fireEvent.focusIn(outside);

    expect(getSuggestionState(editor.state)?.type).toBe('field');
    await act(async () => {});
  });

  it('closes a value suggestion when focus moves outside it', async () => {
    const user = userEvent.setup();
    const { editor } = await renderInput({ defaultValue: 'status:is:a' });
    await user.click(screen.getByRole('group', { name: /Filter: status/i }));
    await screen.findByRole('listbox');
    const outside = document.createElement('button');
    document.body.append(outside);
    onTestFinished(() => outside.remove());

    act(() => {
      fireEvent.focusIn(outside);
    });

    await waitFor(() => expect(getSuggestionState(editor.state)?.type).toBeNull());
  });

  describe('focusing the input again after a dismissal', () => {
    function outsideButton() {
      const outside = document.createElement('button');
      outside.textContent = 'Outside';
      document.body.append(outside);
      onTestFinished(() => outside.remove());
      return outside;
    }

    it('shows the field suggestions again', async () => {
      const user = userEvent.setup();
      const { editor } = await renderInput();
      const combobox = screen.getByRole('combobox');
      await user.click(combobox);
      await screen.findByRole('option', { name: /Status/ });

      await user.click(outsideButton());
      await waitFor(() => expect(screen.queryByRole('listbox')).not.toBeInTheDocument());
      expect(getSuggestionState(editor.state)?.dismissed).toBe(true);

      act(() => {
        combobox.focus();
      });

      expect(await screen.findByRole('option', { name: /Status/ })).toBeInTheDocument();
      expect(getSuggestionState(editor.state)?.dismissed).toBe(false);
    });

    it('asks for the custom suggestions again and shows them', async () => {
      const user = userEvent.setup();
      const suggest = vi.fn(() => customOptions);
      await renderInput({
        suggestions: { custom: { displayMode: 'replace', debounceMs: 0, suggest } },
      });
      const combobox = screen.getByRole('combobox');
      await user.click(combobox);
      await screen.findByRole('option', { name: /First/ });
      const calls = suggest.mock.calls.length;

      await user.click(outsideButton());
      await waitFor(() => expect(screen.queryByRole('listbox')).not.toBeInTheDocument());

      act(() => {
        combobox.focus();
      });

      expect(await screen.findByRole('option', { name: /First/ })).toBeInTheDocument();
      expect(suggest.mock.calls.length).toBeGreaterThan(calls);
    });
  });

  describe('a list the user closed while a re-evaluation was pending', () => {
    function moveCaret(editor: Editor) {
      const end = editor.state.doc.content.size - 1;
      const before = editor.state.selection.from;
      act(() => {
        editor.commands.setTextSelection(before === end ? end - 1 : end);
      });
      expect(editor.state.selection.from).not.toBe(before);
    }

    async function closeWithFrameHeld(
      key: string,
      props: Parameters<typeof renderInput>[0] = {},
      option: RegExp = /Status/
    ) {
      const user = userEvent.setup();
      const rendered = await renderInput({ defaultValue: 'owner:is:x ', ...props });
      await user.click(screen.getByRole('combobox'));
      await screen.findByRole('option', { name: option });
      const frames = holdAnimationFrames();
      moveCaret(rendered.editor);
      expect(screen.getByRole('listbox')).toBeInTheDocument();

      await user.keyboard(key);

      expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
      return { user, frames, ...rendered };
    }

    it('stays closed after Escape', async () => {
      const { frames } = await closeWithFrameHeld('{Escape}');

      frames.run();

      expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
    });

    it('stays closed after an Enter with no entry active', async () => {
      const { frames } = await closeWithFrameHeld('{Enter}');

      frames.run();

      expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
    });

    it('opens again on the next key typed', async () => {
      const { user, frames } = await closeWithFrameHeld('{Escape}');
      frames.run();

      await user.keyboard('s');

      expect(await screen.findByRole('option', { name: /Status/ })).toBeInTheDocument();
    });

    it('opens again when the caret moves', async () => {
      const { editor, frames } = await closeWithFrameHeld('{Escape}');
      frames.run();

      moveCaret(editor);

      expect(await screen.findByRole('option', { name: /Status/ })).toBeInTheDocument();
    });

    it('does not ask for custom suggestions for it', async () => {
      const suggest = vi.fn(() => customOptions);
      const { frames } = await closeWithFrameHeld(
        '{Escape}',
        { suggestions: { custom: { displayMode: 'replace', debounceMs: 0, suggest } } },
        /First/
      );
      const calls = suggest.mock.calls.length;

      frames.run();
      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 0));
      });

      expect(suggest.mock.calls.length).toBe(calls);
      expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
    });
  });
});
