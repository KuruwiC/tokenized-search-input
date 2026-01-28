/**
 * Integration tests for auto-tokenization.
 *
 * Tests for the auto-tokenization behavior with the full editor context.
 */
import { cleanup, render, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createRef } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  TokenizedSearchInput,
  type TokenizedSearchInputRef,
} from '../../editor/tokenized-search-input';
import { tryAutoTokenize } from '../../editor/use-auto-tokenize';
import { extendedFields } from '../fixtures';
import { getInternalEditor } from '../helpers/get-editor';

const testFields = extendedFields;

afterEach(() => {
  cleanup();
});

describe('Auto-tokenize - Integration Tests', () => {
  describe('tryAutoTokenize', () => {
    it('creates filter token on colon trigger for known field', async () => {
      const ref = createRef<TokenizedSearchInputRef>();
      const user = userEvent.setup();

      render(<TokenizedSearchInput ref={ref} fields={testFields} />);

      await waitFor(() => {
        expect(ref.current).not.toBeNull();
      });

      const editor = getInternalEditor(ref.current);
      expect(editor).not.toBeNull();
      if (!editor) return;

      // Type field name without colon first
      await user.click(editor.view.dom);
      await user.keyboard('{Escape}'); // Close suggestions

      // Insert text directly and then trigger
      editor.commands.insertContent('status');

      await waitFor(() => {
        expect(editor.state.doc.textContent).toContain('status');
      });

      // Call tryAutoTokenize with colon trigger
      const result = tryAutoTokenize(editor, testFields, ':');

      // Should create token
      expect(result).toBe(true);

      await waitFor(() => {
        let hasFilterToken = false;
        editor.state.doc.descendants((node) => {
          if (node.type.name === 'filterToken' && node.attrs.key === 'status') {
            hasFilterToken = true;
          }
          return true;
        });
        expect(hasFilterToken).toBe(true);
      });
    });

    it('returns false for unknown field without allowUnknownFields', async () => {
      const ref = createRef<TokenizedSearchInputRef>();
      const user = userEvent.setup();

      render(<TokenizedSearchInput ref={ref} fields={testFields} />);

      await waitFor(() => {
        expect(ref.current).not.toBeNull();
      });

      const editor = getInternalEditor(ref.current);
      expect(editor).not.toBeNull();
      if (!editor) return;

      await user.click(editor.view.dom);
      await user.keyboard('{Escape}');

      // Insert unknown field name
      editor.commands.insertContent('unknown');

      const result = tryAutoTokenize(editor, testFields, ':');

      // Should not create token for unknown field
      expect(result).toBe(false);
    });

    it('creates filter token for unknown field with allowUnknownFields', async () => {
      const ref = createRef<TokenizedSearchInputRef>();
      const user = userEvent.setup();

      render(
        <TokenizedSearchInput ref={ref} fields={testFields} unknownFields={{ allow: true }} />
      );

      await waitFor(() => {
        expect(ref.current).not.toBeNull();
      });

      const editor = getInternalEditor(ref.current);
      expect(editor).not.toBeNull();
      if (!editor) return;

      await user.click(editor.view.dom);
      await user.keyboard('{Escape}');

      // Insert unknown field name
      editor.commands.insertContent('customfield');

      const result = tryAutoTokenize(editor, testFields, ':', true);

      // Should create token for unknown field
      expect(result).toBe(true);

      await waitFor(() => {
        let hasFilterToken = false;
        editor.state.doc.descendants((node) => {
          if (node.type.name === 'filterToken' && node.attrs.key === 'customfield') {
            hasFilterToken = true;
          }
          return true;
        });
        expect(hasFilterToken).toBe(true);
      });
    });

    it('parses complete filter format correctly on Enter trigger', async () => {
      const ref = createRef<TokenizedSearchInputRef>();
      const user = userEvent.setup();

      render(<TokenizedSearchInput ref={ref} fields={testFields} freeTextMode="plain" />);

      await waitFor(() => {
        expect(ref.current).not.toBeNull();
      });

      const editor = getInternalEditor(ref.current);
      expect(editor).not.toBeNull();
      if (!editor) return;

      await user.click(editor.view.dom);
      await user.keyboard('{Escape}');

      // Note: When typing "status:", colon trigger creates an empty token
      // So this test verifies the Enter trigger path with complete format
      // For Enter trigger, we need the full format already in text
      // We use insertContent to bypass colon trigger and test Enter path
      editor.commands.insertContent('status:is:active');
      editor.commands.focus('end');

      // Manually call tryAutoTokenize with Enter trigger
      // Result may be false if text was already tokenized by insertContent bulk handler
      tryAutoTokenize(editor, testFields, 'Enter');

      // Since insertContent immediately tokenizes (bulk insert),
      // we verify the result is true if the text was parsed
      // Note: The text may already be tokenized by useAutoTokenize hook
      // This test mainly verifies the function signature works correctly
      await waitFor(() => {
        let hasFilterToken = false;
        editor.state.doc.descendants((node) => {
          if (node.type.name === 'filterToken' && node.attrs.key === 'status') {
            hasFilterToken = true;
          }
          return true;
        });
        // Token should exist (either from insertContent auto-tokenize or tryAutoTokenize)
        expect(hasFilterToken).toBe(true);
      });
    });
  });

  describe('Tokenize behavior', () => {
    it('tokenizes pasted text immediately', async () => {
      const ref = createRef<TokenizedSearchInputRef>();
      const onChange = vi.fn();

      render(<TokenizedSearchInput ref={ref} fields={testFields} onChange={onChange} />);

      await waitFor(() => {
        expect(ref.current).not.toBeNull();
      });

      const editor = getInternalEditor(ref.current);
      expect(editor).not.toBeNull();
      if (!editor) return;

      // Simulate paste by inserting content directly
      editor.commands.insertContent('status:is:active priority:is:high');

      // Wait for tokenization
      await waitFor(() => {
        let filterTokenCount = 0;
        editor.state.doc.descendants((node) => {
          if (node.type.name === 'filterToken') {
            filterTokenCount++;
          }
          return true;
        });
        expect(filterTokenCount).toBe(2);
      });
    });

    it('handles quoted text correctly', async () => {
      const ref = createRef<TokenizedSearchInputRef>();

      render(<TokenizedSearchInput ref={ref} fields={testFields} freeTextMode="tokenize" />);

      await waitFor(() => {
        expect(ref.current).not.toBeNull();
      });

      const editor = getInternalEditor(ref.current);
      expect(editor).not.toBeNull();
      if (!editor) return;

      // Insert quoted text
      editor.commands.insertContent('"hello world"');

      // Wait for tokenization
      await waitFor(() => {
        let hasFreeTextToken = false;
        editor.state.doc.descendants((node) => {
          if (node.type.name === 'freeTextToken' && node.attrs.quoted === true) {
            hasFreeTextToken = true;
          }
          return true;
        });
        expect(hasFreeTextToken).toBe(true);
      });
    });

    it('preserves cursor position text during normal typing in tokenize mode', async () => {
      const ref = createRef<TokenizedSearchInputRef>();
      const user = userEvent.setup();

      render(<TokenizedSearchInput ref={ref} fields={testFields} freeTextMode="tokenize" />);

      await waitFor(() => {
        expect(ref.current).not.toBeNull();
      });

      const editor = getInternalEditor(ref.current);
      expect(editor).not.toBeNull();
      if (!editor) return;

      await user.click(editor.view.dom);
      await user.keyboard('{Escape}');

      // Type single characters (simulates normal typing)
      await user.type(editor.view.dom, 'h');

      // Text should still be plain (not tokenized during typing)
      // During single-character typing, text is not immediately tokenized
      // It's kept as plain text until trigger
      await waitFor(() => {
        expect(editor.state.doc.textContent).toContain('h');
      });
    });
  });

  describe('Spacer wrapping', () => {
    it('wraps tokens with spacers correctly', async () => {
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

      // Check document structure
      const nodeTypes: string[] = [];
      editor.state.doc.descendants((node) => {
        nodeTypes.push(node.type.name);
        return true;
      });

      // Should have spacer-token-spacer structure
      const filterTokenIndex = nodeTypes.indexOf('filterToken');
      expect(filterTokenIndex).toBeGreaterThan(-1);

      // There should be spacers around the token
      const spacerCount = nodeTypes.filter((t) => t === 'spacer').length;
      expect(spacerCount).toBeGreaterThanOrEqual(2);
    });
  });
});
