import { describe, expect, it } from 'vitest';
import {
  addStyleSheet,
  copied,
  finishAnimations,
  type MountedEditor,
  mountWrapped,
  tokenElements,
} from './harness';

describe('the caret anchors next to tokens', () => {
  const HIDE_ANCHORS = '.ProseMirror ._tsi-token-gap { display: none; }';
  const tokenBoxes = (m: MountedEditor) =>
    tokenElements(m).map((token) => {
      const { left, top } = token.getBoundingClientRect();
      return { left: Math.round(left * 10) / 10, top: Math.round(top * 10) / 10 };
    });

  async function expectLayoutWithoutAnchors(m: MountedEditor): Promise<void> {
    const shown = tokenBoxes(m);
    addStyleSheet(HIDE_ANCHORS);
    await finishAnimations();
    expect(tokenBoxes(m)).toEqual(shown);
  }

  it.each([
    ['text before a wrapped token', 'status:is:active ab owner:is:bob', {}],
    ['a word wrapped after a token', 'status:is:active abcdefghijkl', {}],
    ['text between tokens on one row', 'status:is:active ab owner:is:bob', { singleLine: true }],
  ] as const)('leave the tokens where they are with %s', async (_, value, props) => {
    const m = await mountWrapped(value, props);
    await expectLayoutWithoutAnchors(m);
  });

  it('stay out of the copied text and the value', async () => {
    const m = await mountWrapped('status:is:active ab owner:is:bob');
    m.editor.chain().focus().selectAll().run();

    expect(copied(m)).toBe('status:is:active ab owner:is:bob');
    expect(m.value()).toBe('status:is:active ab owner:is:bob');
  });
});
