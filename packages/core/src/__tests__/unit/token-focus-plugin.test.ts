import { EditorState } from '@tiptap/pm/state';
import { describe, expect, it } from 'vitest';
import {
  createTokenFocusPlugin,
  getTokenFocusState,
  setTokenFocus,
} from '../../plugins/token-focus-plugin';
import { blockSchema as schema } from '../fixtures';

function createEditorState() {
  return EditorState.create({
    schema,
    plugins: [createTokenFocusPlugin()],
  });
}

describe('TokenFocusPlugin', () => {
  describe('initial state', () => {
    it('initializes with null focus position', () => {
      const state = createEditorState();
      const focusState = getTokenFocusState(state);

      expect(focusState).toEqual({
        focusedPos: null,
        cursorPosition: 'end',
        mode: null,
      });
    });
  });

  describe('setTokenFocus', () => {
    it('sets focused position', () => {
      const state = createEditorState();
      const tr = setTokenFocus(state.tr, { focusedPos: 5 });
      const newState = state.apply(tr);
      const focusState = getTokenFocusState(newState);

      expect(focusState?.focusedPos).toBe(5);
    });

    it('sets cursor position with focus', () => {
      const state = createEditorState();
      const tr = setTokenFocus(state.tr, { focusedPos: 5, cursorPosition: 'start' });
      const newState = state.apply(tr);
      const focusState = getTokenFocusState(newState);

      expect(focusState).toEqual({
        focusedPos: 5,
        cursorPosition: 'start',
        mode: 'editing',
      });
    });

    it('defaults cursor position to end', () => {
      const state = createEditorState();
      const tr = setTokenFocus(state.tr, { focusedPos: 5 });
      const newState = state.apply(tr);
      const focusState = getTokenFocusState(newState);

      expect(focusState?.cursorPosition).toBe('end');
    });

    it('clears focus when setting focusedPos to null', () => {
      const state = createEditorState();

      // First set focus
      const tr1 = setTokenFocus(state.tr, { focusedPos: 5 });
      const state1 = state.apply(tr1);

      // Then clear focus
      const tr2 = setTokenFocus(state1.tr, { focusedPos: null });
      const state2 = state1.apply(tr2);
      const focusState = getTokenFocusState(state2);

      expect(focusState?.focusedPos).toBe(null);
    });
  });

  describe('transaction without meta', () => {
    it('clears focus when position has no valid token node', () => {
      const state = createEditorState();

      // Set focus to position that has no token node
      const tr1 = setTokenFocus(state.tr, { focusedPos: 5, cursorPosition: 'start' });
      const state1 = state.apply(tr1);

      // Apply a transaction without meta - should clear invalid focus
      const tr2 = state1.tr;
      const state2 = state1.apply(tr2);
      const focusState = getTokenFocusState(state2);

      // Focus should be cleared since position 5 has no token node
      expect(focusState).toEqual({
        focusedPos: null,
        cursorPosition: 'end',
        mode: null,
      });
    });

    it('preserves focus state when position has a valid token node', () => {
      // Create a state with a filterToken node
      const stateWithToken = EditorState.create({
        doc: schema.node('doc', null, [
          schema.node('paragraph', null, [
            schema.node('filterToken', { key: 'status', operator: 'is', value: 'active' }),
          ]),
        ]),
        plugins: [createTokenFocusPlugin()],
      });

      // Set focus to the token position (position 1 is inside paragraph, where token starts)
      const tr1 = setTokenFocus(stateWithToken.tr, { focusedPos: 1, cursorPosition: 'start' });
      const state1 = stateWithToken.apply(tr1);

      // Apply a transaction without meta
      const tr2 = state1.tr;
      const state2 = state1.apply(tr2);
      const focusState = getTokenFocusState(state2);

      // Focus should be preserved since there's a valid token at position 1
      expect(focusState).toEqual({
        focusedPos: 1,
        cursorPosition: 'start',
        mode: 'editing',
      });
    });
  });
});
