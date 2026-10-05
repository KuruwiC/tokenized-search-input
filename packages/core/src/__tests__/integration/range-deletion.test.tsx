import { cleanup, fireEvent } from '@testing-library/react';
import type { Editor } from '@tiptap/core';
import { TextSelection } from '@tiptap/pm/state';
import { afterEach, describe, expect, it } from 'vitest';
import { isToken } from '../../utils/node-predicates';
import { mountInput } from '../helpers/mount-input';

afterEach(cleanup);

function tokenRanges(editor: Editor): { from: number; to: number }[] {
  const ranges: { from: number; to: number }[] = [];
  editor.state.doc.descendants((node, pos) => {
    if (isToken(node)) ranges.push({ from: pos, to: pos + node.nodeSize });
    return true;
  });
  return ranges;
}

function selectTokens(editor: Editor): void {
  const ranges = tokenRanges(editor);
  const first = ranges[0];
  const last = ranges[ranges.length - 1];
  if (!first || !last) throw new Error('no tokens');
  editor.view.dispatch(
    editor.state.tr.setSelection(TextSelection.create(editor.state.doc, first.from, last.to))
  );
}

describe('range deletion', () => {
  it.each([
    'Backspace',
    'Delete',
  ])('removes every selected token with %s and keeps the surrounding words apart', async (key) => {
    const { editor, value } = await mountInput('foo status:is:active priority:is:high bar');
    selectTokens(editor);

    fireEvent.keyDown(editor.view.dom, { key });

    expect(tokenRanges(editor)).toEqual([]);
    expect(value()).toBe('foo bar');
    const paragraph = editor.state.doc.firstChild;
    expect(paragraph?.childCount).toBe(1);
    expect(paragraph?.textContent).toBe('foo bar');
  });

  it('leaves an empty paragraph when the selected tokens were all there was', async () => {
    const { editor, value } = await mountInput('status:is:active priority:is:high');
    selectTokens(editor);

    fireEvent.keyDown(editor.view.dom, { key: 'Backspace' });

    expect(value()).toBe('');
    expect(editor.state.doc.firstChild?.childCount).toBe(0);
  });
});
