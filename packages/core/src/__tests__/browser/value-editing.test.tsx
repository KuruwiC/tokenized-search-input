import { describe, expect, it } from 'vitest';
import { commands, userEvent } from 'vitest/browser';
import {
  afterLastToken,
  editingTokenIndex,
  expectCaretBetween,
  type MountedEditor,
  mountEditor,
  tokenElements,
} from './harness';

const QUERY = 'status:is:open owner:is:value';

function valueInput(): HTMLInputElement {
  const input = document.activeElement;
  if (!(input instanceof HTMLInputElement)) throw new Error('no token input holds focus');
  return input;
}

/** The value text and the caret in it, as `val|ue`, or `v[al]ue` for a selection. */
function shown(): string {
  const { value, selectionStart, selectionEnd } = valueInput();
  const start = selectionStart ?? 0;
  const end = selectionEnd ?? 0;
  if (start === end) return `${value.slice(0, start)}|${value.slice(start)}`;
  return `${value.slice(0, start)}[${value.slice(start, end)}]${value.slice(end)}`;
}

/** Enters the value of the last token from the caret after it, with the caret at its end. */
async function editLastValue(m: MountedEditor): Promise<void> {
  await userEvent.click(m.pm, { position: afterLastToken(m) });
  await userEvent.keyboard('{Backspace}');
  expect(editingTokenIndex(m)).toBe(1);
  expect(shown()).toBe('value|');
}

describe('editing a token value', () => {
  it('removes the character after the caret on each Delete and the token once the value is empty', async () => {
    const m = await mountEditor(QUERY);
    await editLastValue(m);
    await userEvent.keyboard('{ArrowLeft}'.repeat(5));
    expect(shown()).toBe('|value');

    for (const expected of ['|alue', '|lue', '|ue', '|e', '|']) {
      await userEvent.keyboard('{Delete}');
      expect(shown()).toBe(expected);
      expect(editingTokenIndex(m)).toBe(1);
    }
    expect(tokenElements(m)).toHaveLength(2);

    await userEvent.keyboard('{Delete}');
    expect(m.value()).toBe('status:is:open');
    await expectCaretBetween(m, { tokensBefore: 1, tokensAfter: 0 });
  });

  it('removes the character before the caret on each Backspace and the token once the value is empty', async () => {
    const m = await mountEditor(QUERY);
    await editLastValue(m);

    for (const expected of ['valu|', 'val|', 'va|', 'v|', '|']) {
      await userEvent.keyboard('{Backspace}');
      expect(shown()).toBe(expected);
      expect(editingTokenIndex(m)).toBe(1);
    }

    await userEvent.keyboard('{Backspace}');
    expect(m.value()).toBe('status:is:open');
    await expectCaretBetween(m, { tokensBefore: 1, tokensAfter: 0 });
  });

  it('keeps the caret where it is while typing inside the value', async () => {
    const m = await mountEditor(QUERY);
    await editLastValue(m);
    await userEvent.keyboard('{ArrowLeft}{ArrowLeft}');
    expect(shown()).toBe('val|ue');

    await userEvent.keyboard('x');
    expect(shown()).toBe('valx|ue');
    await userEvent.keyboard('y');
    expect(shown()).toBe('valxy|ue');
    expect(m.value()).toBe('status:is:open owner:is:valxyue');
  });

  it('keeps the caret where it is on Backspace and Delete inside the value', async () => {
    const m = await mountEditor(QUERY);
    await editLastValue(m);
    await userEvent.keyboard('{ArrowLeft}{ArrowLeft}{ArrowLeft}');
    expect(shown()).toBe('va|lue');

    await userEvent.keyboard('{Backspace}');
    expect(shown()).toBe('v|lue');
    await userEvent.keyboard('{Delete}');
    expect(shown()).toBe('v|ue');
    await userEvent.keyboard('{Backspace}');
    expect(shown()).toBe('|ue');
    expect(m.value()).toBe('status:is:open owner:is:ue');
  });

  it('removes only the selected characters on Delete and Backspace with a selection', async () => {
    const m = await mountEditor(QUERY);
    await editLastValue(m);
    await userEvent.keyboard('{ArrowLeft}{Shift>}{ArrowLeft}{ArrowLeft}{/Shift}');
    expect(shown()).toBe('va[lu]e');

    await userEvent.keyboard('{Delete}');
    expect(shown()).toBe('va|e');

    await userEvent.keyboard('{Shift>}{ArrowLeft}{/Shift}');
    expect(shown()).toBe('v[a]e');
    await userEvent.keyboard('{Backspace}');
    expect(shown()).toBe('v|e');
    expect(editingTokenIndex(m)).toBe(1);
    expect(m.value()).toBe('status:is:open owner:is:ve');
  });

  it('replaces the selected characters with typed text and keeps the caret after it', async () => {
    const m = await mountEditor(QUERY);
    await editLastValue(m);
    await userEvent.keyboard('{ArrowLeft}{Shift>}{ArrowLeft}{ArrowLeft}{/Shift}');

    await userEvent.keyboard('x');
    expect(shown()).toBe('vax|e');
    await userEvent.keyboard('y');
    expect(shown()).toBe('vaxy|e');
  });

  it('keeps the caret after text an input method commits inside the value', async () => {
    const m = await mountEditor(QUERY);
    await editLastValue(m);
    await userEvent.keyboard('{ArrowLeft}{ArrowLeft}');

    await commands.insertText('日本');
    expect(shown()).toBe('val日本|ue');
    await userEvent.keyboard('x');
    expect(shown()).toBe('val日本x|ue');
  });

  it('shows a value the document changes while the value is edited', async () => {
    const m = await mountEditor(QUERY);
    await editLastValue(m);
    await userEvent.keyboard('{ArrowLeft}{ArrowLeft}x');
    expect(shown()).toBe('valx|ue');

    await userEvent.keyboard('{ControlOrMeta>}z{/ControlOrMeta}');
    expect(valueInput().value).toBe('value');
    expect(m.value()).toBe(QUERY);
  });
});
