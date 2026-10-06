import { describe, expect, it } from 'vitest';
import { commands, userEvent } from 'vitest/browser';
import {
  afterLastToken,
  editingTokenIndex,
  expectCaretBetween,
  focusedValueInput,
  type MountedEditor,
  mountEditor,
  shownValue,
  tokenElements,
} from './harness';

const QUERY = 'status:is:open owner:is:value';

/** Enters the value of the last token from the caret after it, with the caret at its end. */
async function editLastValue(m: MountedEditor): Promise<void> {
  await userEvent.click(m.pm, { position: afterLastToken(m) });
  await userEvent.keyboard('{Backspace}');
  expect(editingTokenIndex(m)).toBe(1);
  expect(shownValue()).toBe('value|');
}

describe('editing a token value', () => {
  it('removes the character after the caret on each Delete and the token once the value is empty', async () => {
    const m = await mountEditor(QUERY);
    await editLastValue(m);
    await userEvent.keyboard('{ArrowLeft}'.repeat(5));
    expect(shownValue()).toBe('|value');

    for (const expected of ['|alue', '|lue', '|ue', '|e', '|']) {
      await userEvent.keyboard('{Delete}');
      expect(shownValue()).toBe(expected);
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
      expect(shownValue()).toBe(expected);
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
    expect(shownValue()).toBe('val|ue');

    await userEvent.keyboard('x');
    expect(shownValue()).toBe('valx|ue');
    await userEvent.keyboard('y');
    expect(shownValue()).toBe('valxy|ue');
    expect(m.value()).toBe('status:is:open owner:is:valxyue');
  });

  it('keeps the caret where it is on Backspace and Delete inside the value', async () => {
    const m = await mountEditor(QUERY);
    await editLastValue(m);
    await userEvent.keyboard('{ArrowLeft}{ArrowLeft}{ArrowLeft}');
    expect(shownValue()).toBe('va|lue');

    await userEvent.keyboard('{Backspace}');
    expect(shownValue()).toBe('v|lue');
    await userEvent.keyboard('{Delete}');
    expect(shownValue()).toBe('v|ue');
    await userEvent.keyboard('{Backspace}');
    expect(shownValue()).toBe('|ue');
    expect(m.value()).toBe('status:is:open owner:is:ue');
  });

  it('removes only the selected characters on Delete and Backspace with a selection', async () => {
    const m = await mountEditor(QUERY);
    await editLastValue(m);
    await userEvent.keyboard('{ArrowLeft}{Shift>}{ArrowLeft}{ArrowLeft}{/Shift}');
    expect(shownValue()).toBe('va[lu]e');

    await userEvent.keyboard('{Delete}');
    expect(shownValue()).toBe('va|e');

    await userEvent.keyboard('{Shift>}{ArrowLeft}{/Shift}');
    expect(shownValue()).toBe('v[a]e');
    await userEvent.keyboard('{Backspace}');
    expect(shownValue()).toBe('v|e');
    expect(editingTokenIndex(m)).toBe(1);
    expect(m.value()).toBe('status:is:open owner:is:ve');
  });

  it('replaces the selected characters with typed text and keeps the caret after it', async () => {
    const m = await mountEditor(QUERY);
    await editLastValue(m);
    await userEvent.keyboard('{ArrowLeft}{Shift>}{ArrowLeft}{ArrowLeft}{/Shift}');

    await userEvent.keyboard('x');
    expect(shownValue()).toBe('vax|e');
    await userEvent.keyboard('y');
    expect(shownValue()).toBe('vaxy|e');
  });

  it('keeps the caret after text an input method commits inside the value', async () => {
    const m = await mountEditor(QUERY);
    await editLastValue(m);
    await userEvent.keyboard('{ArrowLeft}{ArrowLeft}');

    await commands.insertText('日本');
    expect(shownValue()).toBe('val日本|ue');
    await userEvent.keyboard('x');
    expect(shownValue()).toBe('val日本x|ue');
  });

  it('shows a value the document changes while the value is edited', async () => {
    const m = await mountEditor(QUERY);
    await editLastValue(m);
    await userEvent.keyboard('{ArrowLeft}{ArrowLeft}x');
    expect(shownValue()).toBe('valx|ue');

    await userEvent.keyboard('{ControlOrMeta>}z{/ControlOrMeta}');
    expect(focusedValueInput().value).toBe('value');
    expect(m.value()).toBe(QUERY);
  });

  it('keeps the caret where it was when undo restores the value', async () => {
    const m = await mountEditor(QUERY);
    await editLastValue(m);
    await userEvent.keyboard('{ArrowLeft}{ArrowLeft}');
    // One insertion, so one undo step takes the text back out however long typing would take.
    await commands.insertText('xy');
    expect(shownValue()).toBe('valxy|ue');

    await userEvent.keyboard('{ControlOrMeta>}z{/ControlOrMeta}');
    expect(shownValue()).toBe('val|ue');
  });

  it('keeps the caret in place when the typed text becomes an enum label', async () => {
    const m = await mountEditor('', {
      fields: [
        {
          key: 'state',
          label: 'State',
          type: 'enum',
          operators: ['is'],
          enumValues: [{ value: 'in_progress', label: 'In progress' }],
        },
      ],
    });
    await userEvent.click(m.pm);
    await userEvent.keyboard('state:in_progess');
    await userEvent.keyboard('{ArrowLeft}{ArrowLeft}{ArrowLeft}');
    expect(shownValue()).toBe('in_prog|ess');

    await userEvent.keyboard('r');
    expect(shownValue()).toBe('In progr|ess');
  });
});
