/**
 * Pasted text is read as a query in place: only what turns into tokens changes, and
 * the caret stays at the end of what was pasted.
 */
import { act, cleanup, render, waitFor } from '@testing-library/react';
import type { Editor } from '@tiptap/core';
import { TextSelection } from '@tiptap/pm/state';
import { createRef } from 'react';
import { afterEach, describe, expect, it } from 'vitest';
import {
  TokenizedSearchInput,
  type TokenizedSearchInputRef,
} from '../../editor/tokenized-search-input';
import type { FreeTextMode } from '../../types';
import { isToken } from '../../utils/node-predicates';
import { basicFields } from '../fixtures';
import { getInternalEditor } from '../helpers/get-editor';

afterEach(cleanup);

async function mount(
  defaultValue: string,
  freeTextMode: FreeTextMode = 'plain'
): Promise<{ editor: Editor; value: () => string }> {
  const ref = createRef<TokenizedSearchInputRef>();
  render(
    <TokenizedSearchInput
      ref={ref}
      fields={basicFields}
      defaultValue={defaultValue}
      freeTextMode={freeTextMode}
    />
  );
  await waitFor(() => expect(getInternalEditor(ref.current)).not.toBeNull());
  const editor = getInternalEditor(ref.current);
  if (!editor) throw new Error('editor is unavailable');
  return { editor, value: () => ref.current?.getValue() ?? '' };
}

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
    const { editor } = await mount('hello world');

    // After "hello ".
    const steps = pasteAt(editor, 7, 'big ');

    expect(editor.state.doc.firstChild?.textContent).toBe('hello big world');
    expect(editor.state.selection.from).toBe(11);
    expect(steps).toBe(1);
  });

  it('becomes a token in place, with the caret right after it', async () => {
    const { editor, value } = await mount('hello world');

    const steps = pasteAt(editor, 7, 'status:is:active ');

    expect(value()).toBe('hello status:is:active world');
    expect(editor.state.doc.firstChild?.textContent).toBe('hello world');
    expect(editor.state.selection.from).toBe(tokenEnd(editor));
    expect(steps).toBe(2);
  });

  it('leaves the text before and after the token untouched', async () => {
    const { editor, value } = await mount('abc');

    const steps = pasteAt(editor, 4, ' def status:is:active ghi');

    expect(value()).toBe('abc def status:is:active ghi');
    expect(editor.state.doc.firstChild?.textContent).toBe('abc defghi');
    expect(editor.state.selection.from).toBe(editor.state.doc.content.size - 1);
    expect(steps).toBe(2);
  });

  it('becomes a free text token in tokenize mode, with the caret after it', async () => {
    const { editor, value } = await mount('', 'tokenize');

    pasteAt(editor, 1, 'foo');

    expect(value()).toBe('foo');
    expect(editor.state.doc.firstChild?.textContent).toBe('');
    expect(editor.state.selection.from).toBe(tokenEnd(editor));
  });
});
