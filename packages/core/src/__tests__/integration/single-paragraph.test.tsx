/**
 * The document holds exactly one paragraph. Content that arrives with several is
 * joined into it at the paste boundary, each paragraph break becoming a space.
 */
import { act, cleanup } from '@testing-library/react';
import type { Editor } from '@tiptap/core';
import { afterEach, describe, expect, it } from 'vitest';
import { mountInput } from '../helpers/mount-input';

afterEach(cleanup);

function paste(editor: Editor, run: (event: ClipboardEvent) => void): void {
  act(() => {
    editor.commands.focus('end');
    run(new Event('paste') as ClipboardEvent);
  });
}

describe('single paragraph document', () => {
  it('rejects a document with a second paragraph in its schema', async () => {
    const { editor } = await mountInput();
    const { doc, paragraph } = editor.schema.nodes;

    expect(() => doc.create(null, [paragraph.create(), paragraph.create()]).check()).toThrow();
  });

  it('joins pasted HTML paragraphs with a space at each boundary', async () => {
    const { editor } = await mountInput();

    paste(editor, (event) => editor.view.pasteHTML('<p>foo</p><p>bar</p><p>baz</p>', event));

    expect(editor.state.doc.childCount).toBe(1);
    expect(editor.state.doc.firstChild?.textContent).toBe('foo bar baz');
  });

  it('joins pasted lines of plain text with a space', async () => {
    const { editor } = await mountInput();

    paste(editor, (event) => editor.view.pasteText('foo\nbar', event));

    expect(editor.state.doc.childCount).toBe(1);
    expect(editor.state.doc.firstChild?.textContent).toBe('foo bar');
  });

  it('keeps a filter on its own line apart from the next line when it becomes a token', async () => {
    const { editor, value } = await mountInput();

    paste(editor, (event) => editor.view.pasteHTML('<p>status:is:active</p><p>foo</p>', event));

    expect(editor.state.doc.childCount).toBe(1);
    expect(value()).toBe('status:is:active foo');
  });
});
