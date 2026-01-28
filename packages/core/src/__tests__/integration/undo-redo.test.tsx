/**
 * Integration tests for undo/redo functionality.
 * Tests TipTap editor history commands through the TokenizedSearchInput ref API.
 */
import { cleanup, render, waitFor } from '@testing-library/react';
import { createRef } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  TokenizedSearchInput,
  type TokenizedSearchInputRef,
} from '../../editor/tokenized-search-input';
import { extendedFields } from '../fixtures';
import { getInternalEditor } from '../helpers/get-editor';

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
});
