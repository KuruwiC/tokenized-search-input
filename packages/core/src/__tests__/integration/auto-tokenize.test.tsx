/**
 * Integration tests for auto-tokenization.
 *
 * Tests for the auto-tokenization behavior with the full editor context.
 */
import { act, cleanup, render, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { Editor } from '@tiptap/core';
import { TextSelection } from '@tiptap/pm/state';
import { createRef } from 'react';
import { afterEach, describe, expect, it } from 'vitest';
import { tryAutoTokenize } from '../../editor/auto-tokenize';
import { TokenizedSearchInput } from '../../editor/tokenized-search-input';
import type { TokenizedSearchInputRef } from '../../editor/tokenized-search-input.types';
import { getFocusContext } from '../../extensions/editor-context';
import { enterTokenIn, getFocusedTokenId, programEntry } from '../../plugins/token-focus';
import { findTokenById } from '../../utils/find-token';
import { extendedFields } from '../fixtures';
import { getInternalEditor, waitForEditor } from '../helpers/get-editor';
import { mountInput } from '../helpers/mount-input';

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
      const result = tryAutoTokenize(editor, ':');

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

    it('returns false for unknown field when unknownFields is not provided', async () => {
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

      const result = tryAutoTokenize(editor, ':');

      // Should not create token for unknown field
      expect(result).toBe(false);
    });

    it('creates filter token for unknown field when unknownFields is provided', async () => {
      const ref = createRef<TokenizedSearchInputRef>();
      const user = userEvent.setup();

      render(<TokenizedSearchInput ref={ref} fields={testFields} unknownFields={{}} />);

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

      const result = tryAutoTokenize(editor, ':');

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

      render(<TokenizedSearchInput ref={ref} fields={testFields} freeTextMode="plain" />);

      await waitFor(() => {
        expect(ref.current).not.toBeNull();
      });

      const editor = getInternalEditor(ref.current);
      expect(editor).not.toBeNull();
      if (!editor) return;

      // Typed one character per transaction, the text stays plain until a trigger reads it
      for (const char of 'status:is:active') {
        editor.view.dispatch(editor.state.tr.insertText(char));
      }
      expect(editor.state.doc.textContent).toBe('status:is:active');

      expect(tryAutoTokenize(editor, 'Enter')).toBe(true);

      const tokens: unknown[] = [];
      editor.state.doc.descendants((node) => {
        if (node.type.name === 'filterToken') tokens.push(node.attrs);
        return true;
      });
      expect(tokens).toEqual([
        expect.objectContaining({ key: 'status', operator: 'is', value: 'active' }),
      ]);
      expect(ref.current?.getValue()).toBe('status:is:active');
    });
  });

  describe('Enter', () => {
    it('reads the word before it as plain text in tokenize mode, leaving it to the submit', async () => {
      const { editor } = await mountInput('', { fields: testFields, freeTextMode: 'tokenize' });
      for (const char of 'hello') {
        editor.view.dispatch(editor.state.tr.insertText(char));
      }

      expect(tryAutoTokenize(editor, 'Enter')).toBe(false);
      expect(editor.state.doc.textContent).toBe('hello');
      expect(document.querySelectorAll('.node-freeTextToken')).toHaveLength(0);

      // Any other key that ends the word reads it in the configured mode.
      act(() => {
        expect(tryAutoTokenize(editor, 'Tab')).toBe(true);
      });
      expect(editor.state.doc.textContent).toBe('');
      expect(document.querySelectorAll('.node-freeTextToken')).toHaveLength(1);
    });
  });

  describe('a paste that completes a word', () => {
    it.each([
      ['the word before it', 'sta', 4, 'tus:is:active'],
      ['the word after it', 'ive', 1, 'status:is:act'],
    ])('is tokenized together with %s', async (_where, text, pos, pasted) => {
      const { editor, value } = await mountInput(text, { fields: testFields });

      act(() => {
        editor.commands.setTextSelection(pos);
        editor.view.pasteText(pasted, new Event('paste') as ClipboardEvent);
      });

      expect(value()).toBe('status:is:active');
      expect(editor.state.doc.textContent).toBe('');
    });
  });

  describe('Tokenize behavior', () => {
    it('tokenizes every filter of text inserted in one step', async () => {
      const ref = createRef<TokenizedSearchInputRef>();

      render(<TokenizedSearchInput ref={ref} fields={testFields} />);

      await waitFor(() => {
        expect(ref.current).not.toBeNull();
      });

      const editor = getInternalEditor(ref.current);
      expect(editor).not.toBeNull();
      if (!editor) return;

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

      // Single-character typing stays plain text until a trigger
      await waitFor(() => {
        expect(editor.state.doc.textContent).toBe('h');
      });
      const types: string[] = [];
      editor.state.doc.descendants((node) => {
        types.push(node.isText ? `text:${node.text}` : node.type.name);
        return true;
      });
      expect(types).toEqual(['paragraph', 'text:h']);
    });
  });

  describe('finalizing input', () => {
    async function mountTokenize(defaultValue: string) {
      const ref = createRef<TokenizedSearchInputRef>();
      render(
        <TokenizedSearchInput
          ref={ref}
          fields={testFields}
          freeTextMode="tokenize"
          defaultValue={defaultValue}
        />
      );
      const editor = await waitForEditor(ref);
      return { ref, editor };
    }

    function typeAt(editor: Editor, pos: number, text: string): void {
      [...text].forEach((char, index) => {
        editor.view.dispatch(editor.state.tr.insertText(char, pos + index));
      });
    }

    it('tokenizes text the caret has moved away from', async () => {
      const { ref, editor } = await mountTokenize('status:is:active');
      typeAt(editor, editor.state.doc.content.size - 1, 'abc');
      editor.view.dispatch(editor.state.tr.setSelection(TextSelection.create(editor.state.doc, 1)));

      editor.commands.finalizeInput();

      const types: string[] = [];
      editor.state.doc.descendants((node) => {
        types.push(node.isText ? `text:${node.text}` : node.type.name);
        return true;
      });
      expect(types).toEqual(['paragraph', 'filterToken', 'freeTextToken']);
      expect(ref.current?.getValue()).toBe('status:is:active abc');
    });

    it('leaves the document alone when nothing is left to tokenize', async () => {
      const { editor } = await mountTokenize('status:is:active foo');
      const before = editor.state.doc;

      editor.commands.finalizeInput();

      expect(editor.state.doc.eq(before)).toBe(true);
    });
  });

  describe('a filter without a value', () => {
    it.each(['plain', 'tokenize'] as const)('stays text on Space in %s mode', async (mode) => {
      const ref = createRef<TokenizedSearchInputRef>();
      render(<TokenizedSearchInput ref={ref} fields={testFields} freeTextMode={mode} />);
      const editor = await waitForEditor(ref);
      for (const char of 'status:is:') {
        editor.view.dispatch(editor.state.tr.insertText(char));
      }

      const result = tryAutoTokenize(editor, ' ');

      expect(result).toBe(false);
      expect(editor.state.doc.firstChild?.childCount).toBe(1);
      expect(editor.state.doc.textContent).toBe('status:is:');
    });
  });

  describe('a token between an unclosed quote and the caret', () => {
    it('ends the quote, so the word after the token still tokenizes', async () => {
      const { editor } = await mountInput('status:is:active');
      editor.commands.insertContentAt(1, '"abc ');
      editor.commands.setTextSelection(editor.state.doc.content.size - 1);
      editor.commands.insertContent(' priority');

      expect(tryAutoTokenize(editor, ':')).toBe(true);
      const keys: string[] = [];
      editor.state.doc.descendants((node) => {
        if (node.type.name === 'filterToken') keys.push(node.attrs.key);
      });
      expect(keys).toEqual(['status', 'priority']);
    });
  });

  describe('empty tokens of the same field elsewhere', () => {
    it('focuses the token the delimiter inserts', async () => {
      const { editor } = await mountInput('');
      const { schema } = editor.state;
      const emptyStatus = (id: string) =>
        schema.nodes.filterToken.create({ id, key: 'status', operator: 'is', value: '' });
      const tr = editor.state.tr;
      tr.insert(1, [schema.text('status '), emptyStatus('first'), emptyStatus('second')]);
      tr.setSelection(TextSelection.create(tr.doc, 1 + 'status'.length));
      enterTokenIn(tr, getFocusContext(editor), 'second', programEntry('end'));
      editor.view.dispatch(tr);

      expect(tryAutoTokenize(editor, ':')).toBe(true);

      const focusedId = getFocusedTokenId(editor.state);
      expect(focusedId).not.toBe('first');
      expect(focusedId).not.toBe('second');
      const focused = focusedId === null ? undefined : findTokenById(editor.state.doc, focusedId);
      expect(focused?.node.attrs).toMatchObject({ key: 'status', value: '' });
    });
  });

  describe('Document structure', () => {
    it('puts only the token in the paragraph, with no separator nodes around it', async () => {
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

      expect(nodeTypes).toEqual(['paragraph', 'filterToken']);
    });
  });
});
