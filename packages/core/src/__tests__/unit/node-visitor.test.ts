import type { JSONContent } from '@tiptap/core';
import { describe, expect, it, vi } from 'vitest';
import { type NodeVisitor, visitDocument } from '../../utils/node-visitor';

describe('NodeVisitor', () => {
  describe('visitDocument', () => {
    it('visits filterToken nodes', () => {
      const doc: JSONContent = {
        type: 'doc',
        content: [
          {
            type: 'paragraph',
            content: [
              {
                type: 'filterToken',
                attrs: { key: 'status', operator: 'is', value: 'active' },
              },
            ],
          },
        ],
      };

      const filterTokenHandler = vi.fn();
      const visitor: NodeVisitor<null> = {
        filterToken: filterTokenHandler,
      };

      visitDocument(doc, visitor, null);

      expect(filterTokenHandler).toHaveBeenCalledTimes(1);
      expect(filterTokenHandler).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'filterToken',
          attrs: { key: 'status', operator: 'is', value: 'active' },
        }),
        null
      );
    });

    it('visits freeTextToken nodes', () => {
      const doc: JSONContent = {
        type: 'doc',
        content: [
          {
            type: 'paragraph',
            content: [
              {
                type: 'freeTextToken',
                attrs: { value: 'searchterm', quoted: false },
              },
            ],
          },
        ],
      };

      const freeTextTokenHandler = vi.fn();
      const visitor: NodeVisitor<null> = {
        freeTextToken: freeTextTokenHandler,
      };

      visitDocument(doc, visitor, null);

      expect(freeTextTokenHandler).toHaveBeenCalledTimes(1);
      expect(freeTextTokenHandler).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'freeTextToken',
          attrs: { value: 'searchterm', quoted: false },
        }),
        null
      );
    });

    it('visits text nodes', () => {
      const doc: JSONContent = {
        type: 'doc',
        content: [
          {
            type: 'paragraph',
            content: [
              {
                type: 'text',
                text: 'hello world',
              },
            ],
          },
        ],
      };

      const textHandler = vi.fn();
      const visitor: NodeVisitor<null> = {
        text: textHandler,
      };

      visitDocument(doc, visitor, null);

      expect(textHandler).toHaveBeenCalledTimes(1);
      expect(textHandler).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'text',
          text: 'hello world',
        }),
        null
      );
    });

    it('visits multiple nodes in order', () => {
      const doc: JSONContent = {
        type: 'doc',
        content: [
          {
            type: 'paragraph',
            content: [
              { type: 'filterToken', attrs: { key: 'status', operator: 'is', value: 'active' } },
              { type: 'text', text: ' ' },
              { type: 'freeTextToken', attrs: { value: 'searchterm', quoted: false } },
            ],
          },
        ],
      };

      const callOrder: string[] = [];
      const visitor: NodeVisitor<null> = {
        filterToken: () => callOrder.push('filterToken'),
        text: () => callOrder.push('text'),
        freeTextToken: () => callOrder.push('freeTextToken'),
      };

      visitDocument(doc, visitor, null);

      expect(callOrder).toEqual(['filterToken', 'text', 'freeTextToken']);
    });

    it('passes context to visitor methods', () => {
      const doc: JSONContent = {
        type: 'doc',
        content: [
          {
            type: 'paragraph',
            content: [
              { type: 'filterToken', attrs: { key: 'status', operator: 'is', value: 'active' } },
            ],
          },
        ],
      };

      interface Context {
        parts: string[];
      }

      const context: Context = { parts: [] };
      const visitor: NodeVisitor<Context> = {
        filterToken: (node, ctx) => {
          ctx.parts.push(`${node.attrs?.key}:${node.attrs?.value}`);
        },
      };

      visitDocument(doc, visitor, context);

      expect(context.parts).toEqual(['status:active']);
    });

    it('calls paragraph handler with visitChildren callback', () => {
      const doc: JSONContent = {
        type: 'doc',
        content: [
          {
            type: 'paragraph',
            content: [{ type: 'text', text: 'hello' }],
          },
        ],
      };

      const paragraphHandler = vi.fn((_node, _ctx, visitChildren) => {
        visitChildren();
      });
      const textHandler = vi.fn();

      const visitor: NodeVisitor<null> = {
        paragraph: paragraphHandler,
        text: textHandler,
      };

      visitDocument(doc, visitor, null);

      expect(paragraphHandler).toHaveBeenCalledTimes(1);
      expect(textHandler).toHaveBeenCalledTimes(1);
    });

    it('does not visit children if visitChildren is not called', () => {
      const doc: JSONContent = {
        type: 'doc',
        content: [
          {
            type: 'paragraph',
            content: [{ type: 'text', text: 'hello' }],
          },
        ],
      };

      const paragraphHandler = vi.fn(() => {
        // Intentionally not calling visitChildren
      });
      const textHandler = vi.fn();

      const visitor: NodeVisitor<null> = {
        paragraph: paragraphHandler,
        text: textHandler,
      };

      visitDocument(doc, visitor, null);

      expect(paragraphHandler).toHaveBeenCalledTimes(1);
      expect(textHandler).not.toHaveBeenCalled();
    });

    it('handles empty document', () => {
      const doc: JSONContent = {
        type: 'doc',
        content: [],
      };

      const filterTokenHandler = vi.fn();
      const visitor: NodeVisitor<null> = {
        filterToken: filterTokenHandler,
      };

      visitDocument(doc, visitor, null);

      expect(filterTokenHandler).not.toHaveBeenCalled();
    });

    it('handles nested paragraphs', () => {
      const doc: JSONContent = {
        type: 'doc',
        content: [
          {
            type: 'paragraph',
            content: [{ type: 'filterToken', attrs: { key: 'a' } }],
          },
          {
            type: 'paragraph',
            content: [{ type: 'filterToken', attrs: { key: 'b' } }],
          },
        ],
      };

      const keys: string[] = [];
      const visitor: NodeVisitor<null> = {
        filterToken: (node) => keys.push(node.attrs?.key as string),
      };

      visitDocument(doc, visitor, null);

      expect(keys).toEqual(['a', 'b']);
    });

    it('calls default handler for unknown node types', () => {
      const doc: JSONContent = {
        type: 'doc',
        content: [
          {
            type: 'paragraph',
            content: [{ type: 'unknownNode', attrs: { foo: 'bar' } }],
          },
        ],
      };

      const defaultHandler = vi.fn();
      const visitor: NodeVisitor<null> = {
        default: defaultHandler,
      };

      visitDocument(doc, visitor, null);

      expect(defaultHandler).toHaveBeenCalledTimes(1);
      expect(defaultHandler).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'unknownNode' }),
        null
      );
    });
  });
});
