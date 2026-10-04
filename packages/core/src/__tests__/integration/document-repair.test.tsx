/**
 * Integration tests for the document repair plugin.
 *
 * Tests token cleanup and the word boundary a removed token leaves, with full editor context.
 */
import { act, cleanup, render, waitFor } from '@testing-library/react';
import type { Editor } from '@tiptap/core';
import { closeHistory } from '@tiptap/pm/history';
import { createRef } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  TokenizedSearchInput,
  type TokenizedSearchInputRef,
} from '../../editor/tokenized-search-input';
import type { ValidationConfig, ValidationRule } from '../../types';
import { Unique } from '../../validation/presets';
import { basicFields } from '../fixtures';
import { getInternalEditor } from '../helpers/get-editor';

const testFields = basicFields;

afterEach(() => {
  cleanup();
});

describe('DocumentRepairExtension - Integration Tests', () => {
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
      });

      // Find the inserted token and focus it
      let tokenId: string | null = null;
      await waitFor(() => {
        editor.state.doc.descendants((node) => {
          if (node.type.name === 'filterToken' && !node.attrs.value && tokenId === null) {
            tokenId = String(node.attrs.id);
          }
          return true;
        });
        expect(tokenId).not.toBeNull();
      });

      // Focus the empty token explicitly
      if (tokenId !== null) {
        editor.commands.focusFilterToken(tokenId, 'end');
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

      // Leave the token without moving the caret
      if (tokenId !== null) editor.commands.leaveToken(tokenId, 'none');

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
      let tokenId: string | null = null;
      editor.state.doc.descendants((node) => {
        if (node.type.name === 'filterToken' && tokenId === null) {
          tokenId = String(node.attrs.id);
        }
        return true;
      });

      expect(tokenId).not.toBeNull();

      // Focus the token
      if (tokenId !== null) {
        editor.commands.focusFilterToken(tokenId, 'end');
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

      // Leave the token without moving the caret
      if (tokenId !== null) editor.commands.leaveToken(tokenId, 'none');

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

    it('keeps an empty token the user is still in when an edit moves it, and removes the one left', async () => {
      const ref = createRef<TokenizedSearchInputRef>();
      render(<TokenizedSearchInput ref={ref} fields={testFields} />);
      await waitFor(() => expect(getInternalEditor(ref.current)).not.toBeNull());
      const editor = getInternalEditor(ref.current);
      if (!editor) return;
      const empty = (id: string) => ({
        type: 'filterToken',
        attrs: { id, key: 'status', operator: 'is', value: '' },
      });
      editor.commands.setContent({
        type: 'doc',
        content: [{ type: 'paragraph', content: [empty('left'), empty('focused')] }],
      });
      act(() => {
        editor.commands.focusFilterToken('focused', 'end');
      });

      act(() => {
        editor.commands.insertContentAt(1, 'x');
      });

      const ids: string[] = [];
      editor.state.doc.descendants((node) => {
        if (node.type.name === 'filterToken') ids.push(String(node.attrs.id));
        return true;
      });
      expect(ids).toEqual(['focused']);
    });

    it('leaves a space where a token between two words is removed', async () => {
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

      editor.commands.deleteRange({ from: tokenPos, to: tokenPos + tokenSize });

      await waitFor(() => {
        const value = ref.current?.getValue();
        // After token removal, text should be preserved with space separator
        expect(value).toBe('hello world');
      });
    });
  });

  describe.each<[string, ValidationConfig | undefined]>([
    ['without validation rules', undefined],
    ['with validation rules', { rules: [Unique.rule('key')] }],
  ])('Empty tokens nobody is in, %s', (_name, validation) => {
    function tokenIds(editor: Editor): string[] {
      const ids: string[] = [];
      editor.state.doc.descendants((node) => {
        if (node.type.name === 'filterToken') ids.push(String(node.attrs.id));
        return true;
      });
      return ids;
    }

    async function mountWithEmptyToken(): Promise<Editor> {
      const ref = createRef<TokenizedSearchInputRef>();
      render(<TokenizedSearchInput ref={ref} fields={testFields} validation={validation} />);
      await waitFor(() => expect(getInternalEditor(ref.current)).not.toBeNull());
      const editor = getInternalEditor(ref.current);
      if (!editor) throw new Error('editor is unavailable');
      act(() => {
        editor.commands.setContent({
          type: 'doc',
          content: [
            {
              type: 'paragraph',
              content: [
                { type: 'text', text: 'foo ' },
                {
                  type: 'filterToken',
                  attrs: { id: 'empty', key: 'status', operator: 'is', value: '' },
                },
                {
                  type: 'filterToken',
                  attrs: { id: 'full', key: 'priority', operator: 'is', value: 'high' },
                },
              ],
            },
          ],
        });
      });
      return editor;
    }

    it('keeps an empty token in the change that adds it', async () => {
      const editor = await mountWithEmptyToken();

      expect(tokenIds(editor)).toEqual(['empty', 'full']);
    });

    it('removes an empty token nobody is in with the next edit, in the same undo step', async () => {
      const editor = await mountWithEmptyToken();
      act(() => {
        editor.view.dispatch(closeHistory(editor.state.tr));
      });
      const before = editor.getJSON();

      act(() => {
        editor.commands.insertContentAt(1, 'x');
      });

      expect(tokenIds(editor)).toEqual(['full']);

      act(() => {
        editor.commands.undo();
      });

      expect(editor.getJSON()).toEqual(before);
    });
  });

  describe('An empty token added in a dispatch that a rule also changes', () => {
    it('keeps the added token when a delete rule removes another one in the same dispatch', async () => {
      const deleteDoomed: ValidationRule = {
        id: 'delete-doomed',
        validate: (ctx) =>
          ctx.tokens
            .filter((token) => token.value === 'doomed')
            .map((token) => ({
              ruleId: 'delete-doomed',
              reason: 'doomed',
              action: 'delete' as const,
              targets: [{ tokenId: token.id }],
            })),
      };
      const ref = createRef<TokenizedSearchInputRef>();
      render(
        <TokenizedSearchInput
          ref={ref}
          fields={testFields}
          defaultValue="status:is:active"
          validation={{ rules: [deleteDoomed] }}
        />
      );
      await waitFor(() => expect(getInternalEditor(ref.current)).not.toBeNull());
      const editor = getInternalEditor(ref.current);
      if (!editor) throw new Error('editor is unavailable');
      const existing = editor.state.doc.nodeAt(1);
      if (!existing) throw new Error('no token');

      act(() => {
        const tr = editor.state.tr;
        tr.setNodeMarkup(1, undefined, { ...existing.attrs, value: 'doomed' });
        tr.insert(
          tr.doc.content.size - 1,
          editor.schema.nodes.filterToken.create({
            id: 'added',
            key: 'status',
            operator: 'is',
            value: '',
          })
        );
        editor.view.dispatch(tr);
      });

      const ids: string[] = [];
      editor.state.doc.descendants((node) => {
        if (node.type.name === 'filterToken') ids.push(String(node.attrs.id));
        return true;
      });
      expect(ids).toEqual(['added']);
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
