/**
 * A token separates the words on either side of it, so removing it must not merge them.
 * Range deletion with Backspace/Delete is covered in range-deletion.test.tsx.
 */
import { act, cleanup, render, waitFor } from '@testing-library/react';
import type { Editor, JSONContent } from '@tiptap/core';
import { TextSelection } from '@tiptap/pm/state';
import { createRef } from 'react';
import { afterEach, describe, expect, it } from 'vitest';
import {
  TokenizedSearchInput,
  type TokenizedSearchInputRef,
} from '../../editor/tokenized-search-input';
import { isToken } from '../../utils/node-predicates';
import { basicFields } from '../fixtures';
import { getInternalEditor } from '../helpers/get-editor';

afterEach(cleanup);

interface Mounted {
  ref: React.RefObject<TokenizedSearchInputRef | null>;
  editor: Editor;
  value: () => string;
}

async function mount(defaultValue: string): Promise<Mounted> {
  const ref = createRef<TokenizedSearchInputRef>();
  render(<TokenizedSearchInput ref={ref} fields={basicFields} defaultValue={defaultValue} />);
  await waitFor(() => expect(getInternalEditor(ref.current)).not.toBeNull());
  const editor = getInternalEditor(ref.current);
  if (!editor) throw new Error('editor is unavailable');
  return { ref, editor, value: () => ref.current?.getValue() ?? '' };
}

function firstToken(editor: Editor): { pos: number; size: number; id: string } {
  let found: { pos: number; size: number; id: string } | null = null;
  editor.state.doc.descendants((node, pos) => {
    if (!found && isToken(node)) found = { pos, size: node.nodeSize, id: String(node.attrs.id) };
    return !found;
  });
  if (!found) throw new Error('no token');
  return found;
}

const paragraphText = (editor: Editor) => editor.state.doc.firstChild?.textContent;

describe('word boundary left by a removed token', () => {
  it('keeps the words apart when the token between them is deleted', async () => {
    const { editor, value } = await mount('hello status:is:active world');
    const token = firstToken(editor);

    editor.commands.deleteRange({ from: token.pos, to: token.pos + token.size });

    expect(value()).toBe('hello world');
    expect(paragraphText(editor)).toBe('hello world');
  });

  it('keeps the words apart when the token is deleted by id', async () => {
    const { ref, editor, value } = await mount('foo status:is:active bar');

    act(() => {
      ref.current?.deleteToken(firstToken(editor).id);
    });

    expect(value()).toBe('foo bar');
  });

  it('keeps the typed text apart from the words around a token it replaced', async () => {
    const { editor, value } = await mount('foo status:is:active bar');
    const token = firstToken(editor);
    editor.view.dispatch(
      editor.state.tr.setSelection(
        TextSelection.create(editor.state.doc, token.pos, token.pos + token.size)
      )
    );

    editor.view.dispatch(editor.state.tr.insertText('x'));

    expect(value()).toBe('foo x bar');
    expect(paragraphText(editor)).toBe('foo x bar');
  });

  it('joins the words when the deleted range starts and ends inside them', async () => {
    const { editor } = await mount('foo status:is:active bar');
    const token = firstToken(editor);

    editor.commands.deleteRange({ from: token.pos - 1, to: token.pos + token.size + 1 });

    expect(paragraphText(editor)).toBe('foar');
  });

  it('puts typed text inside the words when the replaced range starts and ends inside them', async () => {
    const { editor } = await mount('foo status:is:active bar');
    const token = firstToken(editor);
    editor.view.dispatch(
      editor.state.tr.setSelection(
        TextSelection.create(editor.state.doc, token.pos - 1, token.pos + token.size + 1)
      )
    );

    editor.view.dispatch(editor.state.tr.insertText('X'));

    expect(paragraphText(editor)).toBe('foXar');
  });

  it('adds no space where a side already ends in whitespace', async () => {
    const { editor } = await mount('');
    const content: JSONContent = {
      type: 'doc',
      content: [
        {
          type: 'paragraph',
          content: [
            { type: 'text', text: 'foo ' },
            { type: 'filterToken', attrs: { key: 'status', operator: 'is', value: 'active' } },
            { type: 'text', text: 'bar' },
          ],
        },
      ],
    };
    editor.commands.setContent(content);
    const token = firstToken(editor);

    editor.commands.deleteRange({ from: token.pos, to: token.pos + token.size });

    expect(paragraphText(editor)).toBe('foo bar');
  });

  it('adds no space where the token stood at the edge of the paragraph', async () => {
    const { editor, value } = await mount('status:is:active bar');
    const token = firstToken(editor);

    editor.commands.deleteRange({ from: token.pos, to: token.pos + token.size });

    expect(value()).toBe('bar');
    expect(paragraphText(editor)).toBe('bar');
  });
});
