import { describe, expect, it } from 'vitest';
import { cdp, userEvent } from 'vitest/browser';
import type { FieldDefinition, TokenizedSearchInputProps } from '../../index';
import {
  afterLastToken,
  editLastToken,
  focusedValueInput,
  gapBetween,
  type MountedEditor,
  mountEditor,
  paste,
  pressUntil,
  shownValue,
  tokenElements,
  waitForFrames,
} from './harness';

/*
 * Text an input method puts in the document, driven through the DevTools Input domain, so this
 * file runs in Chromium only. `imeSetComposition` updates the pre-edit text and `insertText`
 * commits it; `insertText` outside a composition inserts text with no key event, as Android
 * keyboards and Safari right after a composition do. A composition starts with the keydown an
 * input method reports for the key it takes: key "Unidentified", keyCode 229.
 */

const fields: FieldDefinition[] = [
  { key: 'status', label: 'Status', type: 'string', operators: ['is', 'is_not'] },
];

async function mount(props: Partial<TokenizedSearchInputProps> = {}): Promise<MountedEditor> {
  const m = await mountEditor('', { fields, ...props });
  await userEvent.click(m.pm);
  return m;
}

async function keyEvent(type: 'rawKeyDown' | 'keyUp', key: string, keyCode: number) {
  await cdp().send('Input.dispatchKeyEvent', { type, key, windowsVirtualKeyCode: keyCode });
}

async function preedit(text: string): Promise<void> {
  await cdp().send('Input.imeSetComposition', {
    text,
    selectionStart: text.length,
    selectionEnd: text.length,
  });
}

/** Pre-edits each of `steps` and commits the last. */
async function compose(...steps: string[]): Promise<void> {
  await keyEvent('rawKeyDown', 'Unidentified', 229);
  for (const step of steps) await preedit(step);
  await keyEvent('keyUp', 'Unidentified', 229);
  await insertText(steps[steps.length - 1]);
}

/** Text inserted with no key event, or the commit of a composition in progress. */
async function insertText(text: string): Promise<void> {
  await cdp().send('Input.insertText', { text });
}

function textOutsideTokens(m: MountedEditor): string {
  return m.editor.state.doc.textContent;
}

/** Lets a reading scheduled after the last event run before a check that nothing changed. */
function afterPendingReads(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

async function expectEditingEmptyToken(m: MountedEditor): Promise<void> {
  await waitForFrames(() => {
    expect(tokenElements(m)).toHaveLength(1);
    expect(shownValue()).toBe('|');
  });
  expect(textOutsideTokens(m)).toBe('');
}

async function expectPlainText(m: MountedEditor, text: string): Promise<void> {
  await afterPendingReads();
  expect(tokenElements(m)).toHaveLength(0);
  expect(m.value()).toBe(text);
  expect(document.activeElement).toBe(m.pm);
}

describe('the delimiter from an input method', () => {
  it('starts a token when the key and the delimiter are committed in one composition', async () => {
    const m = await mount();
    await compose('s', 'st', 'sta', 'stat', 'statu', 'status', 'status:');
    await expectEditingEmptyToken(m);
  });

  it('leaves the pre-edit text alone until the composition is committed', async () => {
    const m = await mount();
    await keyEvent('rawKeyDown', 'Unidentified', 229);
    await preedit('status:');
    await afterPendingReads();
    expect(tokenElements(m)).toHaveLength(0);
    expect(document.activeElement).toBe(m.pm);

    await insertText('status:');
    await expectEditingEmptyToken(m);
  });

  for (const keyCode of [229, 186]) {
    it(`starts a token when the delimiter is a composition of its own after a keydown with keyCode ${keyCode}`, async () => {
      const m = await mount();
      await compose('s', 'st', 'status');
      await afterPendingReads();
      expect(tokenElements(m)).toHaveLength(0);

      // The keydown of the key arrives before the input method composes its text.
      await keyEvent('rawKeyDown', ':', keyCode);
      await preedit(':');
      await keyEvent('keyUp', ':', keyCode);
      await insertText(':');
      await expectEditingEmptyToken(m);
    });
  }

  it('starts a token when the delimiter is inserted with no keydown', async () => {
    const m = await mount();
    await userEvent.keyboard('status');
    await insertText(':');
    await expectEditingEmptyToken(m);
  });

  it('starts a token when the delimiter is inserted right after a composition ends', async () => {
    const m = await mount();
    await compose('s', 'status');
    await insertText(':');
    await expectEditingEmptyToken(m);
  });

  it('takes the rest of the filter in the token once it started', async () => {
    const m = await mount();
    await compose('s', 'status', 'status:');
    await expectEditingEmptyToken(m);

    await compose(
      'i',
      'is',
      'is_',
      'is_n',
      'is_no',
      'is_not',
      'is_not:',
      'is_not:a',
      'is_not:active'
    );
    await userEvent.keyboard(' ');
    expect(m.value()).toBe('status:is_not:active');
  });

  it('leaves a word that names no field as text', async () => {
    const m = await mount();
    await compose('に', 'にほ', 'にほん', '日本:');
    await expectPlainText(m, '日本:');
  });

  it('leaves a full-width colon as text', async () => {
    const m = await mount();
    await compose('s', 'status', 'status：');
    await expectPlainText(m, 'status：');
  });

  it('leaves a delimiter inside an open quote as text', async () => {
    const m = await mount();
    await userEvent.keyboard('"a ');
    await compose('s', 'status:');
    await expectPlainText(m, '"a status:');
  });
});

describe('a space from an input method', () => {
  it('ends a word committed with the space in one composition', async () => {
    const m = await mount({ freeTextMode: 'tokenize' });
    await compose('f', 'fo', 'foo', 'foo ');
    await waitForFrames(() => expect(tokenElements(m)).toHaveLength(1));
    expect(m.value()).toBe('foo');
    expect(textOutsideTokens(m)).toBe('');
  });

  it('ends a word when it is inserted with no keydown', async () => {
    const m = await mount({ freeTextMode: 'tokenize' });
    await compose('f', 'foo');
    await insertText(' ');
    await waitForFrames(() => expect(tokenElements(m)).toHaveLength(1));
    expect(m.value()).toBe('foo');
  });

  it('reads a whole filter committed with the space', async () => {
    const m = await mount();
    await keyEvent('rawKeyDown', 'Unidentified', 229);
    await preedit('status:is_not:active ');
    await keyEvent('keyUp', 'Unidentified', 229);
    await insertText('status:is_not:active ');
    await waitForFrames(() => expect(tokenElements(m)).toHaveLength(1));
    expect(m.value()).toBe('status:is_not:active');
  });

  it('leaves Japanese words as text in tokenize mode until a space ends them', async () => {
    const m = await mount({ freeTextMode: 'tokenize' });
    await compose('か', 'かな');
    await expectPlainText(m, 'かな');
    await insertText(' ');
    await waitForFrames(() => expect(tokenElements(m)).toHaveLength(1));
    expect(m.value()).toBe('かな');
  });

  it('leaves an ideographic space as text', async () => {
    const m = await mount({ freeTextMode: 'tokenize' });
    await compose('か', 'かな', 'かな　');
    await expectPlainText(m, 'かな　');
  });
});

describe('a quote from an input method', () => {
  it('starts a quoted free text token when committed at a word boundary', async () => {
    const m = await mount({ freeTextMode: 'tokenize' });
    await compose('"');
    await waitForFrames(() => {
      expect(tokenElements(m)).toHaveLength(1);
      expect(shownValue()).toBe('|');
    });
    expect(textOutsideTokens(m)).toBe('');
  });

  it('starts a quoted free text token when inserted with no keydown', async () => {
    const m = await mount({ freeTextMode: 'tokenize' });
    await insertText('"');
    await waitForFrames(() => {
      expect(tokenElements(m)).toHaveLength(1);
      expect(shownValue()).toBe('|');
    });
  });

  it('leaves a curly quote as text', async () => {
    const m = await mount({ freeTextMode: 'tokenize' });
    await compose('“');
    await expectPlainText(m, '“');
  });
});

describe('composing into the value of a token', () => {
  async function editingStatus(): Promise<MountedEditor> {
    const m = await mount();
    await userEvent.keyboard('status:');
    expect(shownValue()).toBe('|');
    return m;
  }

  it('reads the operator once, from the committed text', async () => {
    const m = await editingStatus();
    await compose('i', 'is', 'is:', 'is:a', 'is:active');
    expect(shownValue()).toBe('active|');
    await userEvent.keyboard(' ');
    expect(m.value()).toBe('status:is:active');
  });

  it('keeps the pre-edit text in the input while composing', async () => {
    const m = await editingStatus();
    await keyEvent('rawKeyDown', 'Unidentified', 229);
    for (const step of ['i', 'is', 'is_not', 'is_not:']) await preedit(step);
    expect(shownValue()).toBe('is_not:|');
    await keyEvent('keyUp', 'Unidentified', 229);
    await insertText('is_not:');
    expect(shownValue()).toBe('|');
    await userEvent.keyboard('open ');
    expect(m.value()).toBe('status:is_not:open');
  });

  it('reads the operator from text inserted with no keydown', async () => {
    const m = await editingStatus();
    await insertText('is_not:');
    expect(shownValue()).toBe('|');
    await insertText('open');
    await userEvent.keyboard(' ');
    expect(m.value()).toBe('status:is_not:open');
  });

  it('keeps kana with a delimiter in the value', async () => {
    const m = await editingStatus();
    await compose('か', 'かな', 'かな:');
    expect(shownValue()).toBe('かな:|');
    await userEvent.keyboard(' ');
    expect(m.value()).toBe('status:is:かな:');
  });
});

describe('composing into the label of a token', () => {
  const labelFields: FieldDefinition[] = [
    { key: 'status', label: 'Status', type: 'string', operators: ['is'] },
    { key: 'owner', label: 'Owner', type: 'string', operators: ['is'] },
  ];

  /** Opens the label input of the token `owner:is:bob`, its text selected to be typed over. */
  async function editingLabel(): Promise<{ m: MountedEditor; input: HTMLInputElement }> {
    const m = await mountEditor('owner:is:bob', { fields: labelFields, unknownFields: {} });
    await editLastToken(m);
    await userEvent.keyboard('{Home}');
    await pressUntil(
      '{ArrowLeft}',
      () => document.activeElement?.getAttribute('aria-label') === 'Select field'
    );
    await userEvent.keyboard('{Enter}');
    const input = await waitForFrames(() => {
      const shown = focusedValueInput();
      expect(shown.getAttribute('aria-label')).toBe('Select field');
      return shown;
    });
    expect(input.value).toBe('Owner');
    return { m, input };
  }

  for (const composed of ['status:', 'sta tus']) {
    it(`keeps "${composed}" as composed and takes the field it names once committed`, async () => {
      const { m, input } = await editingLabel();
      await keyEvent('rawKeyDown', 'Unidentified', 229);
      for (let length = 1; length <= composed.length; length++) {
        await preedit(composed.slice(0, length));
        expect(input.value).toBe(composed.slice(0, length));
      }
      await keyEvent('keyUp', 'Unidentified', 229);
      await insertText(composed);
      await waitForFrames(() => expect(input.value).toBe('status'));

      await userEvent.keyboard('{Enter}');
      expect(m.value()).toBe('status:is:bob');
    });
  }

  it('drops the delimiter and spaces from text typed key by key', async () => {
    const { m, input } = await editingLabel();
    await userEvent.keyboard('sta tus:');
    expect(input.value).toBe('status');

    await userEvent.keyboard('{Enter}');
    expect(m.value()).toBe('status:is:bob');
  });

  it('drops the delimiter from text inserted with no keydown', async () => {
    const { m, input } = await editingLabel();
    await insertText('status:');
    expect(input.value).toBe('status');

    await userEvent.keyboard('{Enter}');
    expect(m.value()).toBe('status:is:bob');
  });
});

describe('input that does not come from a typed trigger', () => {
  it('reads a paste as before', async () => {
    const m = await mount();
    paste(m, 'status:is_not:open status:');
    await waitForFrames(() => expect(tokenElements(m)).toHaveLength(1));
    expect(m.value()).toBe('status:is_not:open status:');
  });

  it('undoes a token started by a composition as it undoes one started by a keystroke', async () => {
    const typed = await mount();
    await userEvent.keyboard('status:');
    await userEvent.keyboard('{Control>}z{/Control}');
    await afterPendingReads();
    const afterTypedUndo = { value: typed.value(), tokens: tokenElements(typed).length };
    typed.editor.destroy();

    const composed = await mount();
    await compose('s', 'status', 'status:');
    await expectEditingEmptyToken(composed);
    await userEvent.keyboard('{Control>}z{/Control}');
    await afterPendingReads();
    expect({ value: composed.value(), tokens: tokenElements(composed).length }).toEqual(
      afterTypedUndo
    );
  });
});

describe('the document beside the text being composed', () => {
  /**
   * The elements added to or removed from the editor while a composition under way is updated.
   * The first pre-edit, which takes the widget beside the caret away, is not counted.
   */
  async function redrawnWhileComposing(m: MountedEditor): Promise<string[]> {
    await preedit('s');
    const records: MutationRecord[] = [];
    const observer = new MutationObserver((batch) => records.push(...batch));
    observer.observe(m.pm, { childList: true, subtree: true });
    for (const step of ['st', 'sta']) await preedit(step);
    records.push(...observer.takeRecords());
    observer.disconnect();
    await insertText('sta');
    return records
      .flatMap((record) => [...record.addedNodes, ...record.removedNodes])
      .filter((node): node is Element => node instanceof Element)
      .map((element) => `${element.tagName}.${element.className}`);
  }

  it('stays in place while text is composed after the last token', async () => {
    const m = await mountEditor('status:is:a status:is:b', { fields });
    await userEvent.click(m.pm, { position: afterLastToken(m) });

    expect(await redrawnWhileComposing(m)).toEqual([]);
    expect(m.value()).toBe('status:is:a status:is:b sta');
  });

  it('stays in place while text is composed between two tokens', async () => {
    const m = await mountEditor('status:is:a status:is:b', { fields });
    await userEvent.click(m.pm, { position: gapBetween(m, 0) });

    expect(await redrawnWhileComposing(m)).toEqual([]);
    expect(m.value()).toBe('status:is:a sta status:is:b');
  });
});
