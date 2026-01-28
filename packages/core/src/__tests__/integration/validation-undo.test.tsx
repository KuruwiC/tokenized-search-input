/**
 * Integration tests for validation undo behavior with Unique.replace strategy.
 * Tests that token replacement via validation is undoable as a single operation.
 */
import { cleanup, render, waitFor } from '@testing-library/react';
import { createRef } from 'react';
import { afterEach, describe, expect, it } from 'vitest';
import {
  TokenizedSearchInput,
  type TokenizedSearchInputRef,
} from '../../editor/tokenized-search-input';
import type { FieldDefinition } from '../../types';
import { Unique } from '../../validation/presets';
import { getInternalEditor } from '../helpers/get-editor';

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

describe('Validation undo with Unique.replace', () => {
  it('replaces earlier token with later one using Unique.replace', async () => {
    const ref = createRef<TokenizedSearchInputRef>();

    render(
      <TokenizedSearchInput
        fields={testFields}
        validation={{ rules: [Unique.rule('key', Unique.replace)] }}
        ref={ref}
      />
    );

    await waitFor(() => {
      expect(ref.current).not.toBeNull();
    });

    // Set two status tokens - the first should be replaced by the second
    ref.current?.setValue('status:is:active status:is:inactive');

    await waitFor(
      () => {
        const tokens = document.querySelectorAll('.node-filterToken');
        expect(tokens.length).toBe(1);
      },
      { timeout: 3000 }
    );

    // Only the second (inactive) should remain
    await waitFor(() => {
      const token = document.querySelector('.node-filterToken');
      expect(token?.textContent).toContain('inactive');
    });
  });

  it('preserves unrelated tokens during replacement', async () => {
    const ref = createRef<TokenizedSearchInputRef>();

    render(
      <TokenizedSearchInput
        fields={testFields}
        validation={{ rules: [Unique.rule('key', Unique.replace)] }}
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

    // Priority and the later status should remain
    const value = ref.current?.getValue();
    expect(value).toContain('priority:is:high');
    expect(value).toContain('status:is:inactive');
    expect(value).not.toMatch(/status:is:active(?!\s*status:is:inactive)/);
  });

  it('handles undo of setValue operation with Unique.replace', async () => {
    const ref = createRef<TokenizedSearchInputRef>();

    render(
      <TokenizedSearchInput
        fields={testFields}
        defaultValue="status:is:active"
        validation={{ rules: [Unique.rule('key', Unique.replace)] }}
        ref={ref}
      />
    );

    // Wait for initial token
    await waitFor(() => {
      const tokens = document.querySelectorAll('.node-filterToken');
      expect(tokens.length).toBe(1);
      expect(tokens[0]?.textContent).toContain('active');
    });

    const editorRef = ref.current;
    if (!editorRef) return;

    const editor = getInternalEditor(editorRef);
    expect(editor).not.toBeNull();
    if (!editor) return;

    // Now replace it with a different status token (simulating user adding new token)
    editorRef.setValue('status:is:inactive');

    await waitFor(() => {
      const tokens = document.querySelectorAll('.node-filterToken');
      expect(tokens.length).toBe(1);
      expect(tokens[0]?.textContent).toContain('inactive');
    });

    // Undo should restore the previous value
    editor.commands.undo();

    await waitFor(() => {
      const tokens = document.querySelectorAll('.node-filterToken');
      expect(tokens.length).toBe(1);
      expect(tokens[0]?.textContent).toContain('active');
    });
  });

  it('deletes all but the last token with 3+ duplicates', async () => {
    const ref = createRef<TokenizedSearchInputRef>();

    render(
      <TokenizedSearchInput
        fields={testFields}
        validation={{ rules: [Unique.rule('key', Unique.replace)] }}
        ref={ref}
      />
    );

    await waitFor(() => {
      expect(ref.current).not.toBeNull();
    });

    ref.current?.setValue('status:is:active status:is:inactive status:is:pending');

    await waitFor(
      () => {
        const tokens = document.querySelectorAll('.node-filterToken');
        expect(tokens.length).toBe(1);
      },
      { timeout: 3000 }
    );

    // Only the last (pending) should remain
    const token = document.querySelector('.node-filterToken');
    expect(token?.textContent).toContain('pending');
  });
});
