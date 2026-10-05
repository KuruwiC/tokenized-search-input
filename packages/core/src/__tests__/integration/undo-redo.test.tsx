/**
 * Integration tests for undo/redo functionality.
 * Tests TipTap editor history commands through the TokenizedSearchInput ref API.
 */
import { act, cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { Editor } from '@tiptap/core';
import { closeHistory } from '@tiptap/pm/history';
import { createRef } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { TokenizedSearchInput } from '../../editor/tokenized-search-input';
import type { TokenizedSearchInputRef } from '../../editor/tokenized-search-input.types';
import type { FieldDefinition } from '../../types';
import { extendedFields } from '../fixtures';
import { getInternalEditor, waitForEditor } from '../helpers/get-editor';

afterEach(() => {
  cleanup();
});

describe('Undo/Redo', () => {
  it('undoes setValue with undo command', async () => {
    const onChange = vi.fn();
    const ref = createRef<TokenizedSearchInputRef>();

    render(<TokenizedSearchInput fields={extendedFields} onChange={onChange} ref={ref} />);

    await waitFor(() => {
      expect(ref.current).not.toBeNull();
    });

    const editorRef = ref.current;
    expect(editorRef).not.toBeNull();
    if (!editorRef) return;

    // Set a value programmatically
    editorRef.setValue('status:is:active');

    await waitFor(() => {
      expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ text: 'status:is:active' }));
    });

    const editor = getInternalEditor(editorRef);
    expect(editor).not.toBeNull();
    if (!editor) return;

    // Undo should revert to empty
    editor.commands.undo();

    await waitFor(() => {
      expect(onChange).toHaveBeenLastCalledWith(expect.objectContaining({ text: '' }));
    });
  });

  it('redoes undone setValue with redo command', async () => {
    const onChange = vi.fn();
    const ref = createRef<TokenizedSearchInputRef>();

    render(<TokenizedSearchInput fields={extendedFields} onChange={onChange} ref={ref} />);

    await waitFor(() => {
      expect(ref.current).not.toBeNull();
    });

    const editorRef = ref.current;
    expect(editorRef).not.toBeNull();
    if (!editorRef) return;

    // Set a value programmatically
    editorRef.setValue('status:is:active');

    await waitFor(() => {
      expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ text: 'status:is:active' }));
    });

    const editor = getInternalEditor(editorRef);
    expect(editor).not.toBeNull();
    if (!editor) return;

    // Undo
    editor.commands.undo();

    await waitFor(() => {
      expect(onChange).toHaveBeenLastCalledWith(expect.objectContaining({ text: '' }));
    });

    // Redo should restore the value
    editor.commands.redo();

    await waitFor(() => {
      expect(onChange).toHaveBeenLastCalledWith(
        expect.objectContaining({ text: 'status:is:active' })
      );
    });
  });
  describe('inside a token', () => {
    const tagFields: FieldDefinition[] = [
      { key: 'tag', label: 'Tag', type: 'string', operators: ['is'] },
    ];

    async function renderTagInput(defaultValue?: string) {
      const ref = createRef<TokenizedSearchInputRef>();
      render(<TokenizedSearchInput ref={ref} fields={tagFields} defaultValue={defaultValue} />);
      const editor = await waitForEditor(ref);
      return { ref, editor };
    }

    /** Ends the current undo step, as a pause in typing would. */
    function endUndoStep(editor: Editor): void {
      act(() => {
        editor.view.dispatch(closeHistory(editor.state.tr));
      });
    }

    const token = () => screen.getByRole('group', { name: /Filter: tag/i });

    /** The values of the filter tokens in the document, including empty ones. */
    function filterTokenValues(editor: Editor): string[] {
      const values: string[] = [];
      editor.state.doc.descendants((node) => {
        if (node.type.name === 'filterToken') values.push(String(node.attrs.value));
      });
      return values;
    }

    it('undoes and redoes the last value change of a confirmed token from its input', async () => {
      const user = userEvent.setup();
      const { ref, editor } = await renderTagInput('tag:is:react');

      await user.click(token());
      await user.type(await screen.findByPlaceholderText('...'), 'x');
      await user.keyboard('{Tab}');
      expect(ref.current?.getValue()).toBe('tag:is:reactx');
      endUndoStep(editor);

      await user.click(token());
      await screen.findByPlaceholderText('...');
      await user.keyboard('{Control>}z{/Control}');
      expect(ref.current?.getValue()).toBe('tag:is:react');

      await user.keyboard('{Control>}{Shift>}z{/Shift}{/Control}');
      expect(ref.current?.getValue()).toBe('tag:is:reactx');

      await user.keyboard('{Control>}z{/Control}');
      await user.keyboard('{Control>}y{/Control}');
      expect(ref.current?.getValue()).toBe('tag:is:reactx');
    });

    it('undoes and redoes the last value change of a free text token from its input', async () => {
      const user = userEvent.setup();
      const ref = createRef<TokenizedSearchInputRef>();
      render(
        <TokenizedSearchInput
          ref={ref}
          fields={tagFields}
          freeTextMode="tokenize"
          defaultValue="hello"
        />
      );
      const editor = await waitForEditor(ref);
      const freeText = () => screen.getByRole('group', { name: /Free text/i });

      await user.click(await screen.findByRole('group', { name: /Free text/i }));
      await user.type(await screen.findByLabelText('Free text value'), 'x');
      await user.keyboard('{Tab}');
      expect(ref.current?.getValue()).toBe('hellox');
      endUndoStep(editor);

      await user.click(freeText());
      await screen.findByLabelText('Free text value');
      await user.keyboard('{Control>}z{/Control}');
      expect(ref.current?.getValue()).toBe('hello');

      await user.keyboard('{Control>}{Shift>}z{/Shift}{/Control}');
      expect(ref.current?.getValue()).toBe('hellox');
    });

    it('keeps a token emptied by undo when there is nothing left to undo', async () => {
      const user = userEvent.setup();
      const { ref, editor } = await renderTagInput();

      await user.click(screen.getByRole('combobox'));
      await user.click(await screen.findByRole('option', { name: /Tag/ }));
      endUndoStep(editor);
      await user.type(await screen.findByPlaceholderText('...'), 'abc');
      await user.keyboard('{Tab}');
      expect(ref.current?.getValue()).toBe('tag:is:abc');
      endUndoStep(editor);

      await user.click(token());
      await screen.findByPlaceholderText('...');
      await user.keyboard('{Control>}z{/Control}');
      expect(filterTokenValues(editor)).toEqual(['']);

      // Undo again on the empty input; the token must not be deleted in its place.
      await user.keyboard('{Control>}z{/Control}');
      await new Promise((resolve) => setTimeout(resolve, 100));
      expect(filterTokenValues(editor)).toEqual(['']);

      await user.keyboard('{Control>}{Shift>}z{/Shift}{/Control}');
      expect(ref.current?.getValue()).toBe('tag:is:abc');
    });
  });
});
