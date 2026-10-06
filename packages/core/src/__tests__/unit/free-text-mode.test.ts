import type { JSONContent } from '@tiptap/core';
import { getSchema } from '@tiptap/core';
import Paragraph from '@tiptap/extension-paragraph';
import Text from '@tiptap/extension-text';
import type { Node as ProseMirrorNode } from '@tiptap/pm/model';
import { EditorState } from '@tiptap/pm/state';
import { describe, expect, it } from 'vitest';
import { applyFreeTextMode } from '../../editor/free-text-mode';
import { createEditorContext } from '../../extensions/editor-context';
import { SingleParagraphDocument } from '../../extensions/single-paragraph-document';
import { parseQueryToDoc, serializeDocToQuery } from '../../serializer';
import { FilterTokenNode } from '../../tokens/filter-token/filter-token-node';
import { FreeTextTokenNode } from '../../tokens/free-text-token/free-text-token-node';
import type { FreeTextMode } from '../../types';
import { basicFields } from '../fixtures';

const schema = getSchema([
  SingleParagraphDocument,
  Paragraph,
  Text,
  FilterTokenNode,
  FreeTextTokenNode,
]);

const QUERY = 'status:is:active hello "big world"';

function switchMode(from: FreeTextMode, to: FreeTextMode) {
  const doc = schema.nodeFromJSON(parseQueryToDoc(QUERY, basicFields, { freeTextMode: from }).doc);
  const { tr } = EditorState.create({ doc });
  applyFreeTextMode(tr, createEditorContext({ fields: basicFields, freeTextMode: to }));
  return { before: doc, after: tr.doc };
}

function children(doc: ProseMirrorNode) {
  const nodes: { type: string; id?: string; text?: string }[] = [];
  doc.descendants((node) => {
    if (!node.isInline) return true;
    nodes.push({ type: node.type.name, id: node.attrs.id, text: node.text });
    return false;
  });
  return nodes;
}

describe('applyFreeTextMode', () => {
  it('turns free text into free text tokens and keeps the filter token for tokenize', () => {
    const { before, after } = switchMode('plain', 'tokenize');

    expect(children(after).map((node) => node.type)).toEqual([
      'filterToken',
      'freeTextToken',
      'freeTextToken',
    ]);
    expect(children(after)[0]?.id).toBe(children(before)[0]?.id);
    expect(serializeDocToQuery(after.toJSON())).toBe(QUERY);
  });

  it('turns free text tokens into one run of text and keeps the filter token for plain', () => {
    const { before, after } = switchMode('tokenize', 'plain');

    expect(children(after)).toEqual([
      { type: 'filterToken', id: children(before)[0]?.id, text: undefined },
      { type: 'text', id: undefined, text: 'hello "big world"' },
    ]);
    expect(serializeDocToQuery(after.toJSON())).toBe(QUERY);
  });

  it('removes free text and keeps the filter token for none', () => {
    for (const from of ['plain', 'tokenize'] as const) {
      const { before, after } = switchMode(from, 'none');

      expect(children(after)).toEqual([
        { type: 'filterToken', id: children(before)[0]?.id, text: undefined },
      ]);
    }
  });

  describe('turning free text tokens into text', () => {
    function toPlain(content: JSONContent[]) {
      const doc = schema.nodeFromJSON({ type: 'doc', content: [{ type: 'paragraph', content }] });
      const { tr } = EditorState.create({ doc });
      applyFreeTextMode(tr, createEditorContext({ fields: basicFields, freeTextMode: 'plain' }));
      return children(tr.doc);
    }
    const freeText = (id: string, value: string, quoted = false): JSONContent => ({
      type: 'freeTextToken',
      attrs: { id, value, quoted },
    });

    it('puts a space between the text of the token and text right next to it', () => {
      expect(
        toPlain([
          { type: 'text', text: 'foo' },
          freeText('a', 'bar'),
          { type: 'text', text: 'baz' },
        ])
      ).toEqual([{ type: 'text', id: undefined, text: 'foo bar baz' }]);
    });

    it('adds no space where the text next to the token already has one', () => {
      expect(
        toPlain([
          { type: 'text', text: 'foo ' },
          freeText('a', 'bar'),
          { type: 'text', text: ' baz' },
        ])
      ).toEqual([{ type: 'text', id: undefined, text: 'foo bar baz' }]);
    });

    it('deletes an empty free text token and keeps an empty quoted one as its quotes', () => {
      expect(toPlain([{ type: 'text', text: 'foo ' }, freeText('a', '')])).toEqual([
        { type: 'text', id: undefined, text: 'foo ' },
      ]);
      expect(toPlain([{ type: 'text', text: 'foo ' }, freeText('a', '', true)])).toEqual([
        { type: 'text', id: undefined, text: 'foo ""' },
      ]);
    });
  });
});
