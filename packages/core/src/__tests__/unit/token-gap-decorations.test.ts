import { type Node as ProseMirrorNode, Schema } from '@tiptap/pm/model';
import { EditorState, TextSelection } from '@tiptap/pm/state';
import { type DecorationSet, EditorView } from '@tiptap/pm/view';
import { describe, expect, it, vi } from 'vitest';
import {
  createTokenGapPlugin,
  gapPosAtCoords,
  tokenGapKey,
} from '../../plugins/token-gap-decorations';

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
  const set = tokenGapKey.getState(state)?.set;
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

  it('anchors the end of text before a token and leaves the start of text after one to the text', () => {
    const state = stateOf(paragraph(schema.text('foo'), token('a'), schema.text('bar')));

    expect(gapsOf(state)).toEqual([{ pos: 4, key: 'gap:4:after-text' }]);
  });

  it('anchors both sides of a token that follows text', () => {
    const state = stateOf(paragraph(schema.text('foo'), token('a')));

    expect(gapsOf(state)).toEqual([
      { pos: 4, key: 'gap:4:after-text' },
      { pos: 5, key: 'gap:5' },
    ]);
  });

  it('marks the anchor after text, whose hit area covers only the token side', () => {
    const view = new EditorView(document.createElement('div'), {
      state: stateOf(paragraph(token('a'), schema.text('foo'), token('b'))),
    });
    try {
      const anchors = [...view.dom.querySelectorAll('._tsi-token-gap')];
      expect(
        anchors.map((anchor) => anchor.classList.contains('_tsi-token-gap--after-text'))
      ).toEqual([false, true, false]);
    } finally {
      view.destroy();
    }
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
      { pos: 3, key: 'gap:3:after-text' },
      { pos: 4, key: 'gap:4' },
    ]);
  });

  it('keeps the same set when only the selection changes', () => {
    const state = stateOf(paragraph(token('a'), token('b')));
    const next = state.apply(state.tr.setSelection(TextSelection.create(state.doc, 2)));

    expect(decorationsOf(next)).toBe(decorationsOf(state));
  });

  it('drops the widgets beside the text being composed and maps the others', () => {
    const compose = (state: EditorState, text: string, pos: number) =>
      gapsOf(state.apply(state.tr.insertText(text, pos).setMeta('composition', 1)));
    const tokens = stateOf(paragraph(token('a'), token('b')));
    const textBeforeToken = stateOf(paragraph(schema.text('foo'), token('a')));

    expect(compose(tokens, 'x', 1)).toEqual([
      { pos: 3, key: 'gap:2' },
      { pos: 4, key: 'gap:3' },
    ]);
    expect(compose(tokens, 'x', 2)).toEqual([
      { pos: 1, key: 'gap:1' },
      { pos: 4, key: 'gap:3' },
    ]);
    expect(compose(tokens, 'status', 3)).toEqual([
      { pos: 1, key: 'gap:1' },
      { pos: 2, key: 'gap:2' },
    ]);
    expect(compose(textBeforeToken, 'x', 4)).toEqual([{ pos: 6, key: 'gap:5' }]);
  });

  it('rebuilds the widgets once the view is no longer composing', () => {
    const view = new EditorView(document.createElement('div'), {
      state: stateOf(paragraph(token('a'), token('b'))),
    });
    try {
      view.dispatch(view.state.tr.insertText('x', 2).setMeta('composition', 1));

      expect(gapsOf(view.state)).toEqual([
        { pos: 1, key: 'gap:1' },
        { pos: 3, key: 'gap:3:after-text' },
        { pos: 4, key: 'gap:4' },
      ]);
    } finally {
      view.destroy();
    }
  });

  it('reads the gap under the pointer from the root the editor is in, a shadow root included', () => {
    const host = document.createElement('div');
    document.body.append(host);
    const shadow = host.attachShadow({ mode: 'open' });
    const mount = document.createElement('div');
    shadow.append(mount);
    const view = new EditorView(mount, { state: stateOf(paragraph(token('a'), token('b'))) });
    try {
      const gap = view.dom.querySelectorAll('._tsi-token-gap')[1];
      // The document hit-tests to the shadow host; only the shadow root sees the gap.
      vi.spyOn(document, 'elementFromPoint').mockReturnValue(host);
      Object.assign(shadow, { elementFromPoint: () => gap });

      expect(gapPosAtCoords(view, { left: 0, top: 0 })).toBe(2);
    } finally {
      view.destroy();
      host.remove();
      vi.restoreAllMocks();
    }
  });
});
