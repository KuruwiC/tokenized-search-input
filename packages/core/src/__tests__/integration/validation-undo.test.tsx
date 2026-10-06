/**
 * Integration tests for validation undo behavior of Unique with onDuplicate replace.
 * Tests that token replacement via validation is undoable as a single operation.
 */
import { act, cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createRef } from 'react';
import { afterEach, describe, expect, it } from 'vitest';
import { TokenizedSearchInput } from '../../editor/tokenized-search-input';
import type { TokenizedSearchInputRef } from '../../editor/tokenized-search-input.types';
import type { FieldDefinition } from '../../types';
import { Unique } from '../../validation/presets';
import { waitForEditor } from '../helpers/get-editor';
import { filterTokens } from '../helpers/token-queries';

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

  it('restores the replaced token in one undo step after leaving the new duplicate removed it', async () => {
    const user = userEvent.setup();
    const ref = createRef<TokenizedSearchInputRef>();

    render(
      <div>
        <TokenizedSearchInput
          fields={testFields}
          defaultValue="status:is:active"
          validation={{ rules: [Unique.rule('key', { onDuplicate: 'replace' })] }}
          ref={ref}
        />
        <button type="button">Outside</button>
      </div>
    );

    const editor = await waitForEditor(ref);
    const [original] = filterTokens(ref);
    act(() => {
      editor.commands.focus('end');
    });
    await waitFor(() => expect(editor.isFocused).toBe(true));
    await user.keyboard(' status:');
    await waitFor(() => expect(document.activeElement).toBeInstanceOf(HTMLInputElement));
    await user.keyboard('inactive');
    await user.click(screen.getByRole('button', { name: 'Outside' }));
    await waitFor(() => expect(ref.current?.getValue()).toBe('status:is:inactive'));

    act(() => {
      editor.commands.undo();
    });

    // The typed value stays; only the deletion made on leaving is undone.
    expect(ref.current?.getValue()).toBe('status:is:active status:is:inactive');
    expect(filterTokens(ref)[0]?.id).toBe(original?.id);
  });
});
