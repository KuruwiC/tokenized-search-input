/**
 * Integration tests for validation undo behavior of Unique with onDuplicate replace.
 * Tests that token replacement via validation is undoable as a single operation.
 */
import { act, cleanup, render, waitFor } from '@testing-library/react';
import { createRef } from 'react';
import { afterEach, describe, expect, it } from 'vitest';
import { TokenizedSearchInput } from '../../editor/tokenized-search-input';
import type { TokenizedSearchInputRef } from '../../editor/tokenized-search-input.types';
import type { FieldDefinition } from '../../types';
import { Unique } from '../../validation/presets';
import { waitForEditor } from '../helpers/get-editor';

const testFields: FieldDefinition[] = [
  {
    key: 'status',
    label: 'Status',
    type: 'enum',
    operators: ['is'],
    enumValues: ['active', 'inactive', 'pending'],
  },
  {
    key: 'priority',
    label: 'Priority',
    type: 'enum',
    operators: ['is'],
    enumValues: ['high', 'medium', 'low'],
  },
];

afterEach(() => {
  cleanup();
});

describe('Validation undo with onDuplicate replace', () => {
  it('preserves unrelated tokens during replacement', async () => {
    const ref = createRef<TokenizedSearchInputRef>();

    render(
      <TokenizedSearchInput
        fields={testFields}
        validation={{ rules: [Unique.rule('key', { onDuplicate: 'replace' })] }}
        ref={ref}
      />
    );

    await waitFor(() => {
      expect(ref.current).not.toBeNull();
    });

    // Set priority + duplicate status tokens - only status duplicates should be resolved
    ref.current?.setValue('priority:is:high status:is:active status:is:inactive');

    await waitFor(
      () => {
        const tokens = document.querySelectorAll('.node-filterToken');
        expect(tokens.length).toBe(2);
      },
      { timeout: 3000 }
    );

    expect(ref.current?.getValue()).toBe('priority:is:high status:is:inactive');
  });

  it('restores the replaced token in one undo step after a pasted duplicate replaced it', async () => {
    const ref = createRef<TokenizedSearchInputRef>();

    render(
      <TokenizedSearchInput
        fields={testFields}
        defaultValue="status:is:active"
        validation={{ rules: [Unique.rule('key', { onDuplicate: 'replace' })] }}
        ref={ref}
      />
    );

    const editor = await waitForEditor(ref);
    act(() => {
      editor.commands.setTextSelection(editor.state.doc.content.size - 1);
      editor.view.pasteText('status:is:inactive', new Event('paste') as ClipboardEvent);
    });
    await waitFor(() => expect(ref.current?.getValue()).toBe('status:is:inactive'));

    act(() => {
      editor.commands.undo();
    });

    expect(ref.current?.getValue()).toBe('status:is:active');
  });
});
