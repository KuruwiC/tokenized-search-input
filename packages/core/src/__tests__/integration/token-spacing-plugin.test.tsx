/**
 * Integration tests for token-spacing-plugin.ts
 *
 * Tests spacer behavior and token cleanup with full editor context.
 * Note: enforceSelectionInvariant algorithm is tested in unit/selection-invariant.test.ts
 */
import { cleanup, render, waitFor } from '@testing-library/react';
import { createRef } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  TokenizedSearchInput,
  type TokenizedSearchInputRef,
} from '../../editor/tokenized-search-input';
import { basicFields } from '../fixtures';
import { getInternalEditor } from '../helpers/get-editor';

const testFields = basicFields;

afterEach(() => {
  cleanup();
});

describe('TokenSpacingExtension - Integration Tests', () => {
  describe('Empty token cleanup', () => {
    it('deletes empty filter token when focus moves away', async () => {
      const ref = createRef<TokenizedSearchInputRef>();
      const onChange = vi.fn();

      render(<TokenizedSearchInput ref={ref} fields={testFields} onChange={onChange} />);

      await waitFor(() => {
        expect(ref.current).not.toBeNull();
      });

      const editor = getInternalEditor(ref.current);
      expect(editor).not.toBeNull();
      if (!editor) return;

      // Insert an empty filter token
      editor.commands.insertFilterToken({
        key: 'status',
        operator: 'is',
        value: '',
        fieldLabel: 'Status',
      });

      // Find the inserted token and focus it
      let tokenPos: number | null = null;
      await waitFor(() => {
        editor.state.doc.descendants((node, pos) => {
          if (node.type.name === 'filterToken' && !node.attrs.value && tokenPos === null) {
            tokenPos = pos;
          }
          return true;
        });
        expect(tokenPos).not.toBeNull();
      });

      // Focus the empty token explicitly
      if (tokenPos !== null) {
        editor.commands.focusFilterToken(tokenPos, 'end');
      }

      await waitFor(() => {
        let hasEmptyToken = false;
        editor.state.doc.descendants((node) => {
          if (node.type.name === 'filterToken' && !node.attrs.value) {
            hasEmptyToken = true;
          }
          return true;
        });
        expect(hasEmptyToken).toBe(true);
      });

      // Clear token focus using blurFilterToken command
      editor.commands.blurFilterToken();

      // Wait for empty token to be cleaned up
      await waitFor(() => {
        let hasFilterToken = false;
        editor.state.doc.descendants((node) => {
          if (node.type.name === 'filterToken') {
            hasFilterToken = true;
          }
          return true;
        });
        // Empty token should be removed
        expect(hasFilterToken).toBe(false);
      });
    });

    it('preserves non-empty token when focus moves away', async () => {
      const ref = createRef<TokenizedSearchInputRef>();

      render(
        <TokenizedSearchInput ref={ref} fields={testFields} defaultValue="status:is:active" />
      );

      await waitFor(() => {
        expect(ref.current).not.toBeNull();
      });

      const editor = getInternalEditor(ref.current);
      expect(editor).not.toBeNull();
      if (!editor) return;

      // Verify token exists with value
      let tokenPos: number | null = null;
      editor.state.doc.descendants((node, pos) => {
        if (node.type.name === 'filterToken' && tokenPos === null) {
          tokenPos = pos;
        }
        return true;
      });

      expect(tokenPos).not.toBeNull();

      // Focus the token
      if (tokenPos !== null) {
        editor.commands.focusFilterToken(tokenPos, 'end');
      }

      // Wait for focus
      await waitFor(() => {
        let hasFilterToken = false;
        editor.state.doc.descendants((node) => {
          if (node.type.name === 'filterToken' && node.attrs.value === 'active') {
            hasFilterToken = true;
          }
          return true;
        });
        expect(hasFilterToken).toBe(true);
      });

      // Clear token focus using blurFilterToken command
      editor.commands.blurFilterToken();

      // Token should still exist (it has a value)
      await waitFor(() => {
        let hasFilterToken = false;
        editor.state.doc.descendants((node) => {
          if (node.type.name === 'filterToken' && node.attrs.value === 'active') {
            hasFilterToken = true;
          }
          return true;
        });
        expect(hasFilterToken).toBe(true);
      });
    });

    it('replaces empty token with space when text exists on both sides', async () => {
      const ref = createRef<TokenizedSearchInputRef>();

      // Start with text on both sides of token
      render(
        <TokenizedSearchInput
          ref={ref}
          fields={testFields}
          defaultValue="hello status:is:active world"
        />
      );

      await waitFor(() => {
        expect(ref.current).not.toBeNull();
      });

      const editor = getInternalEditor(ref.current);
      expect(editor).not.toBeNull();
      if (!editor) return;

      // Find the token
      let tokenPos: number | null = null;
      let tokenSize = 0;
      editor.state.doc.descendants((node, pos) => {
        if (node.type.name === 'filterToken' && tokenPos === null) {
          tokenPos = pos;
          tokenSize = node.nodeSize;
        }
        return true;
      });

      expect(tokenPos).not.toBeNull();
      if (tokenPos === null) return;

      // Delete only the token (not spacers) - this simulates token removal
      // The spacer cleanup should replace orphaned spacers with space when between text
      editor.commands.deleteRange({ from: tokenPos, to: tokenPos + tokenSize });

      // Wait for cleanup - spacers between text should be replaced with space
      await waitFor(() => {
        const value = ref.current?.getValue();
        // After token removal, text should be preserved with space separator
        expect(value).toBe('hello world');
      });
    });
  });

  describe('Edge cases', () => {
    it('skips processing during IME composition', async () => {
      const ref = createRef<TokenizedSearchInputRef>();

      render(
        <TokenizedSearchInput ref={ref} fields={testFields} defaultValue="status:is:active" />
      );

      await waitFor(() => {
        expect(ref.current).not.toBeNull();
      });

      const editor = getInternalEditor(ref.current);
      expect(editor).not.toBeNull();
      if (!editor) return;

      // Simulate IME composition by setting meta
      const tr = editor.state.tr;
      tr.setMeta('composition', true);
      editor.view.dispatch(tr);

      // Token should still exist (not affected by cleanup during composition)
      let hasToken = false;
      editor.state.doc.descendants((node) => {
        if (node.type.name === 'filterToken') {
          hasToken = true;
        }
        return true;
      });

      expect(hasToken).toBe(true);
    });
  });
});
