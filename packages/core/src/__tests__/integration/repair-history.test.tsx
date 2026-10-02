/**
 * A repair made after an edit belongs to the same undo step as that edit, so undo
 * returns the document the edit started from. A repair that follows no recorded
 * edit, such as removing an empty token the user left, is not recorded. Undo and redo
 * restore a document that already existed, which no repair changes.
 */
import { act, cleanup, render, waitFor } from '@testing-library/react';
import type { Editor, JSONContent } from '@tiptap/core';
import { redoDepth, undoDepth } from '@tiptap/pm/history';
import { TextSelection } from '@tiptap/pm/state';
import { createRef } from 'react';
import { afterEach, describe, expect, it } from 'vitest';
import {
  TokenizedSearchInput,
  type TokenizedSearchInputRef,
} from '../../editor/tokenized-search-input';
import type { ValidationConfig } from '../../types';
import { isToken } from '../../utils/node-predicates';
import { Unique } from '../../validation/presets';
import { basicFields } from '../fixtures';
import { getInternalEditor } from '../helpers/get-editor';

afterEach(cleanup);

async function mount(
  defaultValue: string,
  validation?: ValidationConfig
): Promise<{ editor: Editor; value: () => string }> {
  const ref = createRef<TokenizedSearchInputRef>();
  render(
    <TokenizedSearchInput
      ref={ref}
      fields={basicFields}
      defaultValue={defaultValue}
      validation={validation}
    />
  );
  await waitFor(() => expect(getInternalEditor(ref.current)).not.toBeNull());
  const editor = getInternalEditor(ref.current);
  if (!editor) throw new Error('editor is unavailable');
  return { editor, value: () => ref.current?.getValue() ?? '' };
}

function firstToken(editor: Editor): { pos: number; size: number } {
  let found: { pos: number; size: number } | null = null;
  editor.state.doc.descendants((node, pos) => {
    if (!found && isToken(node)) found = { pos, size: node.nodeSize };
    return !found;
  });
  if (!found) throw new Error('no token');
  return found;
}

function select(editor: Editor, from: number, to = from): void {
  act(() => {
    editor.view.dispatch(
      editor.state.tr.setSelection(TextSelection.create(editor.state.doc, from, to))
    );
  });
}

function selectFirstToken(editor: Editor): void {
  const token = firstToken(editor);
  select(editor, token.pos, token.pos + token.size);
}

function type(editor: Editor, text: string): void {
  act(() => {
    editor.view.dispatch(editor.state.tr.insertText(text));
  });
}

function paste(editor: Editor, text: string): void {
  act(() => {
    editor.view.pasteText(text, new Event('paste') as ClipboardEvent);
  });
}

function undo(editor: Editor): void {
  act(() => {
    editor.commands.undo();
  });
}

function redo(editor: Editor): void {
  act(() => {
    editor.commands.redo();
  });
}

const json = (editor: Editor): JSONContent => editor.state.doc.toJSON();

describe('repairs and the undo history', () => {
  it('undoes typing right before a token back to the document before it', async () => {
    const { editor } = await mount('foo status:is:active');
    const before = json(editor);
    const depth = undoDepth(editor.state);
    select(editor, firstToken(editor).pos);

    type(editor, 'x');
    undo(editor);

    expect(undoDepth(editor.state)).toBe(depth);
    expect(json(editor)).toEqual(before);
  });

  it('records typing over a token and the space it needs as one undo step', async () => {
    const { editor, value } = await mount('foo status:is:active bar');
    const before = json(editor);
    const depth = undoDepth(editor.state);
    selectFirstToken(editor);

    type(editor, 'x');
    expect(value()).toBe('foo x bar');
    expect(undoDepth(editor.state)).toBe(depth + 1);

    undo(editor);
    expect(json(editor)).toEqual(before);
  });

  it('undoes deleting a token between two words without leaving the space it needed', async () => {
    const { editor, value } = await mount('foo status:is:active bar');
    const before = json(editor);
    const token = firstToken(editor);

    act(() => {
      editor.commands.deleteRange({ from: token.pos, to: token.pos + token.size });
    });
    expect(value()).toBe('foo bar');
    const deleted = json(editor);

    undo(editor);
    expect(json(editor)).toEqual(before);

    redo(editor);
    expect(json(editor)).toEqual(deleted);
  });

  it('records a paste and the repairs after it as one undo step', async () => {
    const { editor, value } = await mount('foo status:is:active bar');
    const before = json(editor);
    const depth = undoDepth(editor.state);
    selectFirstToken(editor);

    paste(editor, 'xy');
    expect(value()).toBe('foo xy bar');
    expect(undoDepth(editor.state)).toBe(depth + 1);

    undo(editor);
    expect(json(editor)).toEqual(before);
  });

  it('records a pasted filter, the token it becomes, and a deletion by validation as one undo step', async () => {
    const { editor, value } = await mount('foo status:is:active bar', {
      rules: [Unique.rule('key', { onDuplicate: 'replace' })],
    });
    const before = json(editor);
    const depth = undoDepth(editor.state);
    select(editor, editor.state.doc.content.size - 1);

    paste(editor, ' status:is:inactive');
    expect(value()).toBe('foo bar status:is:inactive');
    expect(undoDepth(editor.state)).toBe(depth + 1);

    undo(editor);
    expect(json(editor)).toEqual(before);
  });

  it('does not record removing an empty token the user left', async () => {
    const { editor, value } = await mount('');
    editor.commands.setContent({
      type: 'doc',
      content: [
        {
          type: 'paragraph',
          content: [
            { type: 'text', text: 'foo' },
            { type: 'filterToken', attrs: { key: 'status', operator: 'is', value: '' } },
            { type: 'text', text: 'bar' },
          ],
        },
      ],
    });
    act(() => {
      editor.commands.focusFilterToken(firstToken(editor).pos, 'end');
    });
    const depth = undoDepth(editor.state);

    act(() => {
      editor.commands.blurFilterToken();
    });

    expect(value()).toBe('foo bar');
    expect(undoDepth(editor.state)).toBe(depth);
  });

  it('undoes a token inserted inside a word back to the exact word, and redoes it', async () => {
    const { editor } = await mount('foobar');
    const before = json(editor);
    act(() => {
      editor.commands.insertContentAt(4, {
        type: 'filterToken',
        attrs: { key: 'status', operator: 'is', value: 'active' },
      });
    });
    const withToken = json(editor);

    undo(editor);
    expect(json(editor)).toEqual(before);
    expect(redoDepth(editor.state)).toBe(1);

    redo(editor);
    expect(json(editor)).toEqual(withToken);
  });
});
