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

/**
 * Tests for Spacer Invariant maintenance.
 *
 * INVARIANT: Every token must have a spacer on both sides.
 * Document structure: [spacer][token1][spacer][spacer][token2][spacer]
 */
describe('Spacer Invariant', () => {
  describe('Missing spacer repair', () => {
    it('restores spacer when deleted programmatically', async () => {
      const ref = createRef<TokenizedSearchInputRef>();
      const onChange = vi.fn();

      render(
        <TokenizedSearchInput
          ref={ref}
          fields={testFields}
          defaultValue="status:is:active"
          onChange={onChange}
        />
      );

      await waitFor(() => {
        expect(ref.current).not.toBeNull();
      });

      const editor = getInternalEditor(ref.current);
      expect(editor).not.toBeNull();
      if (!editor) return;

      // Find a spacer position
      let spacerPos: number | null = null;
      editor.state.doc.descendants((node, pos) => {
        if (node.type.name === 'spacer' && spacerPos === null) {
          spacerPos = pos;
        }
        return true;
      });

      expect(spacerPos).not.toBeNull();
      if (spacerPos === null) return;

      // Delete the spacer
      const spacerNode = editor.state.doc.nodeAt(spacerPos);
      expect(spacerNode).not.toBeNull();
      if (!spacerNode) return;

      editor.commands.deleteRange({
        from: spacerPos,
        to: spacerPos + spacerNode.nodeSize,
      });

      // Wait for appendTransaction to repair
      await waitFor(() => {
        // Verify that tokens still have adjacent spacers
        let hasTokenWithoutSpacer = false;
        editor.state.doc.descendants((node, pos) => {
          if (node.type.name === 'filterToken') {
            const $pos = editor.state.doc.resolve(pos);
            const $endPos = editor.state.doc.resolve(pos + node.nodeSize);
            const before = $pos.nodeBefore;
            const after = $endPos.nodeAfter;

            if (
              !before ||
              before.type.name !== 'spacer' ||
              !after ||
              after.type.name !== 'spacer'
            ) {
              hasTokenWithoutSpacer = true;
            }
          }
          return true;
        });

        // Spacer invariant should be maintained
        expect(hasTokenWithoutSpacer).toBe(false);
      });
    });

    it('maintains spacer structure with multiple tokens', async () => {
      const ref = createRef<TokenizedSearchInputRef>();
      const onChange = vi.fn();

      render(
        <TokenizedSearchInput
          ref={ref}
          fields={testFields}
          defaultValue="status:is:active priority:is:high"
          onChange={onChange}
        />
      );

      await waitFor(() => {
        expect(ref.current).not.toBeNull();
      });

      const editor = getInternalEditor(ref.current);
      expect(editor).not.toBeNull();
      if (!editor) return;

      // Count spacers and tokens
      const nodeTypes: string[] = [];
      editor.state.doc.descendants((node) => {
        nodeTypes.push(node.type.name);
        return true;
      });

      const tokenCount = nodeTypes.filter((n) => n === 'filterToken').length;
      const spacerCount = nodeTypes.filter((n) => n === 'spacer').length;

      // With 2 tokens, we need 4 spacers (each token has its own spacer on both sides)
      // Structure: [spacer][token1][spacer][spacer][token2][spacer]
      expect(tokenCount).toBe(2);
      expect(spacerCount).toBe(4);
    });
  });

  describe('Orphaned spacer cleanup', () => {
    it('removes spacers when token is deleted', async () => {
      const ref = createRef<TokenizedSearchInputRef>();
      const onChange = vi.fn();

      render(
        <TokenizedSearchInput
          ref={ref}
          fields={testFields}
          defaultValue="status:is:active"
          onChange={onChange}
        />
      );

      await waitFor(() => {
        expect(ref.current).not.toBeNull();
      });

      const editor = getInternalEditor(ref.current);
      expect(editor).not.toBeNull();
      if (!editor) return;

      // Find token position
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

      // Delete only the token (not spacers)
      editor.commands.deleteRange({
        from: tokenPos,
        to: tokenPos + tokenSize,
      });

      // Wait for appendTransaction to clean up orphaned spacers
      await waitFor(() => {
        let orphanedSpacerCount = 0;
        editor.state.doc.descendants((node, pos) => {
          if (node.type.name === 'spacer') {
            const $pos = editor.state.doc.resolve(pos);
            const $endPos = editor.state.doc.resolve(pos + node.nodeSize);
            const before = $pos.nodeBefore;
            const after = $endPos.nodeAfter;

            const hasAdjacentToken =
              (before &&
                (before.type.name === 'filterToken' || before.type.name === 'freeTextToken')) ||
              (after && (after.type.name === 'filterToken' || after.type.name === 'freeTextToken'));

            if (!hasAdjacentToken) {
              orphanedSpacerCount++;
            }
          }
          return true;
        });

        // All orphaned spacers should be cleaned up
        expect(orphanedSpacerCount).toBe(0);
      });
    });
  });

  describe('Adjacent text node repair', () => {
    it('replaces orphaned spacer with space when between text nodes', async () => {
      const ref = createRef<TokenizedSearchInputRef>();
      const onChange = vi.fn();

      // Start with: text [spacer] [token] [spacer] text
      render(
        <TokenizedSearchInput
          ref={ref}
          fields={testFields}
          defaultValue="hello status:is:active world"
          onChange={onChange}
        />
      );

      await waitFor(() => {
        expect(ref.current).not.toBeNull();
      });

      const editor = getInternalEditor(ref.current);
      expect(editor).not.toBeNull();
      if (!editor) return;

      // Find token position
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

      // Delete only the token (NOT the spacers)
      // This leaves orphaned spacers which should be replaced with space
      editor.commands.deleteRange({ from: tokenPos, to: tokenPos + tokenSize });

      // Wait for appendTransaction to clean up orphaned spacers
      // Spacers between text nodes should be replaced with space
      await waitFor(() => {
        const value = ref.current?.getValue();
        expect(value).toBe('hello world');
      });
    });

    it('maintains space between text nodes after token deletion', async () => {
      const ref = createRef<TokenizedSearchInputRef>();

      // Document with text nodes on both sides of token
      render(
        <TokenizedSearchInput
          ref={ref}
          fields={testFields}
          defaultValue="foo status:is:active bar"
        />
      );

      await waitFor(() => {
        expect(ref.current).not.toBeNull();
      });

      const editor = getInternalEditor(ref.current);
      if (!editor) return;

      // Find and delete only the token (NOT the spacers)
      let tokenPos: number | null = null;
      let tokenSize = 0;
      editor.state.doc.descendants((node, pos) => {
        if (node.type.name === 'filterToken' && tokenPos === null) {
          tokenPos = pos;
          tokenSize = node.nodeSize;
        }
        return true;
      });

      if (tokenPos === null) return;

      // Delete only the token
      editor.commands.deleteRange({ from: tokenPos, to: tokenPos + tokenSize });

      await waitFor(() => {
        const value = ref.current?.getValue();
        expect(value).toBe('foo bar');
      });
    });

    it('does not insert double space when text already ends with space', async () => {
      const ref = createRef<TokenizedSearchInputRef>();

      // Document where text already has trailing space
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
      if (!editor) return;

      // Find token position
      let tokenPos: number | null = null;
      let tokenSize = 0;
      editor.state.doc.descendants((node, pos) => {
        if (node.type.name === 'filterToken' && tokenPos === null) {
          tokenPos = pos;
          tokenSize = node.nodeSize;
        }
        return true;
      });

      if (tokenPos === null) return;

      // Delete only the token
      editor.commands.deleteRange({ from: tokenPos, to: tokenPos + tokenSize });

      await waitFor(() => {
        const value = ref.current?.getValue();
        // Should have single space, not double
        expect(value).toBe('hello world');
        expect(value).not.toContain('  ');
      });
    });
  });
});
