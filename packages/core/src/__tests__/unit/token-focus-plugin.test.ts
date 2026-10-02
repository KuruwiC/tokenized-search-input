import { EditorState } from '@tiptap/pm/state';
import { describe, expect, it } from 'vitest';
import {
  createTokenFocusPlugin,
  getFocusedToken,
  programEntry,
  setTokenFocus,
  type TokenFocusEntry,
} from '../../plugins/token-focus/state';
import { blockSchema as schema } from '../fixtures';

const token = (id: string, immutable = false) =>
  schema.node('filterToken', { id, key: 'status', value: id, immutable });

function createState(): EditorState {
  return EditorState.create({
    doc: schema.node('doc', null, [
      schema.node('paragraph', null, [token('a'), token('b'), token('locked', true)]),
    ]),
    plugins: [createTokenFocusPlugin()],
  });
}

function focus(state: EditorState, id: string, entry: TokenFocusEntry = programEntry()) {
  const tr = state.tr;
  const set = setTokenFocus(tr, { id, entry });
  return { set, state: state.apply(tr) };
}

describe('TokenFocusPlugin', () => {
  it('starts with no token focused', () => {
    expect(getFocusedToken(createState())).toBeNull();
  });

  describe('setTokenFocus', () => {
    it('focuses the token with the given id and keeps how focus entered it', () => {
      const entry: TokenFocusEntry = { source: 'keyboard', position: 'start', target: 'entry' };
      const { set, state } = focus(createState(), 'b', entry);

      expect(set).toBe(true);
      expect(getFocusedToken(state)).toEqual({ id: 'b', entry });
    });

    it('refuses a token that is not in the document', () => {
      const { set, state } = focus(createState(), 'missing');

      expect(set).toBe(false);
      expect(getFocusedToken(state)).toBeNull();
    });

    it('refuses an immutable token', () => {
      const { set, state } = focus(createState(), 'locked');

      expect(set).toBe(false);
      expect(getFocusedToken(state)).toBeNull();
    });

    it('clears the focus with null', () => {
      const focused = focus(createState(), 'a').state;
      const tr = focused.tr;
      setTokenFocus(tr, null);

      expect(getFocusedToken(focused.apply(tr))).toBeNull();
    });
  });

  describe('following the focused token through edits', () => {
    it('drops the focus when the focused token is deleted, rather than passing it on', () => {
      const { state } = focus(createState(), 'a');
      const next = state.apply(state.tr.delete(1, 2));

      expect(next.doc.nodeAt(1)?.attrs.id).toBe('b');
      expect(getFocusedToken(next)).toBeNull();
    });

    it('keeps the focus when the focused token is edited', () => {
      const { state } = focus(createState(), 'a');
      const next = state.apply(
        state.tr.setNodeMarkup(1, undefined, { ...state.doc.nodeAt(1)?.attrs, value: 'x' })
      );

      expect(getFocusedToken(next)?.id).toBe('a');
    });

    it('drops the focus when the focused token becomes immutable', () => {
      const { state } = focus(createState(), 'a');
      const next = state.apply(
        state.tr.setNodeMarkup(1, undefined, { ...state.doc.nodeAt(1)?.attrs, immutable: true })
      );

      expect(getFocusedToken(next)).toBeNull();
    });

    it('keeps the focus on the token when content before it changes', () => {
      const { state } = focus(createState(), 'b');
      const next = state.apply(state.tr.insertText('hi', 1));

      expect(getFocusedToken(next)).toBe(getFocusedToken(state));
    });
  });
});
