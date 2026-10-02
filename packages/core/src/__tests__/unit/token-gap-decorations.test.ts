import { type Node as ProseMirrorNode, Schema } from '@tiptap/pm/model';
import { EditorState, TextSelection } from '@tiptap/pm/state';
import { type DecorationSet, EditorView } from '@tiptap/pm/view';
import { describe, expect, it } from 'vitest';
import { createTokenGapPlugin, tokenGapKey } from '../../plugins/token-gap-decorations';

const schema = new Schema({
  nodes: {
    doc: { content: 'paragraph' },
    paragraph: { content: 'inline*', toDOM: () => ['p', 0] },
    text: { group: 'inline' },
    filterToken: {
      group: 'inline',
      inline: true,
      atom: true,
      attrs: { key: { default: '' }, value: { default: '' } },
      toDOM: () => ['span', { contenteditable: 'false' }],
    },
  },
});

const token = (value: string) => schema.node('filterToken', { key: 'status', value });
const paragraph = (...content: ProseMirrorNode[]) =>
  schema.node('doc', null, [schema.node('paragraph', null, content)]);

function stateOf(doc: ProseMirrorNode): EditorState {
  return EditorState.create({ doc, plugins: [createTokenGapPlugin()] });
}

function decorationsOf(state: EditorState): DecorationSet {
  const set = tokenGapKey.getState(state);
  if (!set) throw new Error('no decoration set');
  return set;
}

function gapsOf(state: EditorState): { pos: number; key: string | undefined }[] {
  return decorationsOf(state)
    .find()
    .map((decoration) => ({
      pos: decoration.from,
      key: (decoration.spec as { key?: string }).key,
    }));
}

describe('token gap decorations', () => {
  it('anchors the paragraph start, the boundary between two tokens and the paragraph end', () => {
    const state = stateOf(paragraph(token('a'), token('b')));

    expect(gapsOf(state)).toEqual([
      { pos: 1, key: 'gap:1' },
      { pos: 2, key: 'gap:2' },
      { pos: 3, key: 'gap:3' },
    ]);
  });

  it('leaves positions next to text alone, since the text anchors the caret there', () => {
    const state = stateOf(paragraph(schema.text('foo'), token('a'), schema.text('bar')));

    expect(gapsOf(state)).toEqual([]);
  });

  it('anchors only the token side of a paragraph that mixes text and tokens', () => {
    const state = stateOf(paragraph(schema.text('foo'), token('a')));

    expect(gapsOf(state)).toEqual([{ pos: 5, key: 'gap:5' }]);
  });

  it('adds nothing to an empty paragraph or to plain text', () => {
    expect(gapsOf(stateOf(paragraph()))).toEqual([]);
    expect(gapsOf(stateOf(paragraph(schema.text('foo'))))).toEqual([]);
  });

  it('renders each anchor as a zero-width space the caret can sit beside', () => {
    const view = new EditorView(document.createElement('div'), {
      state: stateOf(paragraph(token('a'), token('b'))),
    });
    try {
      const anchors = [...view.dom.querySelectorAll('._tsi-token-gap')];
      expect(anchors.map((anchor) => anchor.textContent)).toEqual(['​', '​', '​']);
    } finally {
      view.destroy();
    }
  });

  it('follows the document when text fills a gap', () => {
    const state = stateOf(paragraph(token('a'), token('b')));
    const next = state.apply(state.tr.insertText('x', 2));

    expect(gapsOf(next)).toEqual([
      { pos: 1, key: 'gap:1' },
      { pos: 4, key: 'gap:4' },
    ]);
  });

  it('keeps the same set when only the selection changes', () => {
    const state = stateOf(paragraph(token('a'), token('b')));
    const next = state.apply(state.tr.setSelection(TextSelection.create(state.doc, 2)));

    expect(decorationsOf(next)).toBe(decorationsOf(state));
  });
});
