import { describe, expect, it } from 'vitest';
import { server, userEvent } from 'vitest/browser';
import {
  caretLocation,
  expectCaretWithText,
  finishAnimations,
  type MountedEditor,
  mountWrapped,
  paste,
  pressUntil,
  tokenElements,
  WRAP_ROOM,
} from './harness';

const TWO_TOKENS = 'status:is:active owner:is:bob';

/** WebKit on macOS scrolls on End and moves to the end of the row on Cmd+Right. */
const LINE_END =
  server.browser === 'webkit' && server.platform === 'darwin'
    ? '{Meta>}{ArrowRight}{/Meta}'
    : '{End}';

function rowsOf(m: MountedEditor): number {
  return new Set(tokenElements(m).map((token) => Math.round(token.getBoundingClientRect().top)))
    .size;
}

async function placeCaret(m: MountedEditor, pos: number): Promise<void> {
  m.editor.chain().focus().setTextSelection(pos).run();
  await finishAnimations();
  expect(document.activeElement).toBe(m.pm);
}

/** The document positions of the one stretch of text in the editor. */
function textRange(m: MountedEditor): { from: number; to: number } {
  let range: { from: number; to: number } | undefined;
  m.editor.state.doc.descendants((node, pos) => {
    if (node.isText) range = { from: pos, to: pos + node.nodeSize };
  });
  if (!range) throw new Error('no text in the editor');
  return range;
}

const atTextEnd = (m: MountedEditor, text: string) => () => {
  const caret = caretLocation(m);
  return caret.collapsed && caret.textBefore.endsWith(text) && caret.tokensAfter === 1;
};

describe('the caret at the end of text before a token that wrapped to the next row', () => {
  it('is painted after one character typed after the first token', async () => {
    const m = await mountWrapped(TWO_TOKENS);
    expect(rowsOf(m)).toBe(2);
    const first = tokenElements(m)[0]?.getBoundingClientRect();
    if (!first) throw new Error('no first token');
    const box = m.pm.getBoundingClientRect();
    await userEvent.click(m.pm, {
      position: {
        x: first.right + WRAP_ROOM / 2 - box.left,
        y: first.top + first.height / 2 - box.top,
      },
    });

    await userEvent.keyboard('a');
    expect(m.value()).toBe('status:is:active a owner:is:bob');
    await expectCaretWithText(m, -1);
  });

  it('is painted after two characters typed there', async () => {
    const m = await mountWrapped(TWO_TOKENS);
    await placeCaret(m, 2);

    await userEvent.keyboard('ab');
    expect(m.value()).toBe('status:is:active ab owner:is:bob');
    await expectCaretWithText(m, -1);
  });

  it('is painted there when ArrowRight reaches the end of the text', async () => {
    const m = await mountWrapped('status:is:active ab owner:is:bob');
    const text = textRange(m);
    await placeCaret(m, text.from);

    await pressUntil('{ArrowRight}', atTextEnd(m, 'ab'));
    await expectCaretWithText(m, -1);
  });

  it('is painted there when ArrowLeft reaches it from after the wrapped token', async () => {
    const m = await mountWrapped('status:is:active ab owner:is:bob');
    await placeCaret(m, m.editor.state.doc.content.size - 1);

    await pressUntil('{ArrowLeft}', atTextEnd(m, 'ab'));
    await expectCaretWithText(m, -1);
  });

  it('is painted there when the caret moves to the end of the first row', async () => {
    const m = await mountWrapped('status:is:active ab owner:is:bob');
    const text = textRange(m);
    await placeCaret(m, text.from + 1);

    await userEvent.keyboard(LINE_END);
    await expect.poll(atTextEnd(m, 'ab')).toBe(true);
    await expectCaretWithText(m, -1);
  });

  it('is painted there after Backspace removes characters up to it', async () => {
    const m = await mountWrapped('status:is:active abc owner:is:bob');
    const text = textRange(m);
    await placeCaret(m, text.to);

    await userEvent.keyboard('{Backspace}');
    expect(m.value()).toBe('status:is:active ab owner:is:bob');
    await expectCaretWithText(m, -1);
  });

  it('is painted there after deleting a token brings the text next to the wrapped one', async () => {
    const m = await mountWrapped('status:is:active ab owner:is:carol owner:is:bob');
    const text = textRange(m);
    await placeCaret(m, text.to + 1);

    await pressUntil('{Backspace}', () => tokenElements(m).length === 2);
    expect(m.value()).toBe('status:is:active ab owner:is:bob');
    expect(rowsOf(m)).toBe(2);
    await expectCaretWithText(m, -1);
  });

  it('is painted there after text is pasted after the first token', async () => {
    const m = await mountWrapped(TWO_TOKENS);
    await placeCaret(m, 2);

    paste(m, 'ab');
    await finishAnimations();
    expect(m.value()).toBe('status:is:active ab owner:is:bob');
    await expectCaretWithText(m, -1);
  });

  it('is painted there while free text is tokenized', async () => {
    const m = await mountWrapped(TWO_TOKENS, { freeTextMode: 'tokenize' });
    await placeCaret(m, 2);

    await userEvent.keyboard('ab');
    expect(m.value()).toBe('status:is:active ab owner:is:bob');
    await expectCaretWithText(m, -1);
  });
});

describe('the caret at the start of text that wrapped to the row after a token', () => {
  const TOKEN_THEN_WORD = 'status:is:active abcdefghijkl';

  it('is painted before the text', async () => {
    const m = await mountWrapped(TOKEN_THEN_WORD);
    const text = textRange(m);
    const first = tokenElements(m)[0]?.getBoundingClientRect();
    expect(m.editor.view.coordsAtPos(text.from, 1).top).toBeGreaterThanOrEqual(first?.bottom ?? 0);
    await placeCaret(m, text.from);

    await expectCaretWithText(m, 1);
  });

  it('is painted before the text when ArrowLeft reaches its start', async () => {
    const m = await mountWrapped(TOKEN_THEN_WORD);
    const text = textRange(m);
    await placeCaret(m, text.from + 2);

    await userEvent.keyboard('{ArrowLeft}{ArrowLeft}');
    expect(m.editor.state.selection.head).toBe(text.from);
    await expectCaretWithText(m, 1);
  });

  it('is painted after a character typed there', async () => {
    const m = await mountWrapped(TOKEN_THEN_WORD);
    const text = textRange(m);
    await placeCaret(m, text.from);

    await userEvent.keyboard('x');
    expect(m.value()).toBe('status:is:active xabcdefghijkl');
    await expectCaretWithText(m, -1);
  });
});
