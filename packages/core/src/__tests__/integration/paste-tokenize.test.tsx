/**
 * Pasted text is read as a query in place: only what turns into tokens changes, and
 * the caret stays at the end of what was pasted.
 */
import { act, cleanup } from '@testing-library/react';
import type { Editor } from '@tiptap/core';
import { TextSelection } from '@tiptap/pm/state';
import { afterEach, describe, expect, it } from 'vitest';
import { isToken } from '../../utils/node-predicates';
import { mountInput } from '../helpers/mount-input';

afterEach(cleanup);

/** Pastes `text` at `pos` and returns the number of steps the paste and its follow-ups made. */
function pasteAt(editor: Editor, pos: number, text: string): number {
  let steps = 0;
  const count = ({
    transaction,
    appendedTransactions,
  }: {
    transaction: { steps: readonly unknown[] };
    appendedTransactions: readonly { steps: readonly unknown[] }[];
  }) => {
    steps += transaction.steps.length;
    for (const appended of appendedTransactions) steps += appended.steps.length;
  };
  act(() => {
    editor.view.dispatch(editor.state.tr.setSelection(TextSelection.create(editor.state.doc, pos)));
  });
  editor.on('transaction', count);
  act(() => {
    editor.view.pasteText(text, new Event('paste') as ClipboardEvent);
  });
  editor.off('transaction', count);
  return steps;
}

function tokenEnd(editor: Editor): number {
  let end = -1;
  editor.state.doc.descendants((node, pos) => {
    if (isToken(node)) end = pos + node.nodeSize;
    return true;
  });
  return end;
}

describe('pasted text', () => {
  it('stays in place with the caret after it when nothing in it is a token', async () => {
    const { editor } = await mountInput('hello world');

    // After "hello ".
    const steps = pasteAt(editor, 7, 'big ');

    expect(editor.state.doc.firstChild?.textContent).toBe('hello big world');
    expect(editor.state.selection.from).toBe(11);
    expect(steps).toBe(1);
  });

  it('becomes a token in place, with the caret right after it', async () => {
    const { editor, value } = await mountInput('hello world');

    const steps = pasteAt(editor, 7, 'status:is:active ');

    expect(value()).toBe('hello status:is:active world');
    expect(editor.state.doc.firstChild?.textContent).toBe('hello world');
    expect(editor.state.selection.from).toBe(tokenEnd(editor));
    expect(steps).toBe(2);
  });

  it('leaves the text before and after the token untouched', async () => {
    const { editor, value } = await mountInput('abc');

    const steps = pasteAt(editor, 4, ' def status:is:active ghi');

    expect(value()).toBe('abc def status:is:active ghi');
    expect(editor.state.doc.firstChild?.textContent).toBe('abc defghi');
    expect(editor.state.selection.from).toBe(editor.state.doc.content.size - 1);
    expect(steps).toBe(2);
  });

  it('becomes a free text token in tokenize mode, with the caret after it', async () => {
    const { editor, value } = await mountInput('', { freeTextMode: 'tokenize' });

    pasteAt(editor, 1, 'foo');

    expect(value()).toBe('foo');
    expect(editor.state.doc.firstChild?.textContent).toBe('');
    expect(editor.state.selection.from).toBe(tokenEnd(editor));
  });
});
