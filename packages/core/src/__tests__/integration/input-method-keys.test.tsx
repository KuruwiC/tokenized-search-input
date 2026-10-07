/**
 * Integration tests for the keys an input method takes while the editor, not a token, has
 * focus: their keydown reports the composition (isComposing) or names no key of its own
 * (keyCode 229), and the editor leaves them to the input method.
 */

import { act, cleanup, fireEvent } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { getFocusedTokenId } from '../../plugins/token-focus';
import { type MountedInput, mountInput } from '../helpers/mount-input';

afterEach(() => {
  cleanup();
});

const inputMethodKeys = [
  ['isComposing', { isComposing: true }],
  ['keyCode 229', { keyCode: 229 }],
] as const;

const plainKeys = { Enter: 13, Tab: 9, Backspace: 8, ArrowLeft: 37 } as const;

/** One character per transaction, as keystrokes put text in; a paste would be read at once. */
function typeText(m: MountedInput, text: string): void {
  act(() => {
    m.editor.commands.focus('end');
    for (const char of text) m.editor.view.dispatch(m.editor.state.tr.insertText(char));
  });
}

function pressInEditor(m: MountedInput, key: keyof typeof plainKeys, init: object): boolean {
  let notPrevented = false;
  act(() => {
    notPrevented = fireEvent.keyDown(m.editor.view.dom, { key, ...init });
  });
  return notPrevented;
}

async function afterToken(props: Parameters<typeof mountInput>[1] = {}): Promise<MountedInput> {
  const m = await mountInput('status:is:active', props);
  act(() => {
    m.editor.commands.focus('end');
  });
  return m;
}

describe.each(inputMethodKeys)('a key an input method takes (%s)', (_name, init) => {
  it('Enter does not submit', async () => {
    const onSubmit = vi.fn();
    const m = await afterToken({ onSubmit });

    expect(pressInEditor(m, 'Enter', init)).toBe(true);
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('Tab does not end the word', async () => {
    const m = await mountInput('', { freeTextMode: 'tokenize' });
    typeText(m, 'foo');

    expect(pressInEditor(m, 'Tab', init)).toBe(true);
    expect(m.editor.state.doc.textContent).toBe('foo');
  });

  it.each([
    'Backspace',
    'ArrowLeft',
  ] as const)('%s leaves the token before the caret', async (key) => {
    const m = await afterToken();
    const { doc, selection } = m.editor.state;

    expect(pressInEditor(m, key, init)).toBe(true);
    expect(m.editor.state.doc.eq(doc)).toBe(true);
    expect(m.editor.state.selection.eq(selection)).toBe(true);
    expect(getFocusedTokenId(m.editor.state)).toBeNull();
  });
});

describe('the same keys typed on a keyboard', () => {
  it('Enter submits', async () => {
    const onSubmit = vi.fn();
    const m = await afterToken({ onSubmit });

    pressInEditor(m, 'Enter', { keyCode: plainKeys.Enter });
    expect(onSubmit).toHaveBeenCalledTimes(1);
  });

  it('Tab ends the word', async () => {
    const m = await mountInput('', { freeTextMode: 'tokenize' });
    typeText(m, 'foo');

    pressInEditor(m, 'Tab', { keyCode: plainKeys.Tab });
    expect(m.editor.state.doc.textContent).toBe('');
  });

  it.each([
    'Backspace',
    'ArrowLeft',
  ] as const)('%s reaches the token before the caret', async (key) => {
    const m = await afterToken();
    const { doc, selection } = m.editor.state;

    expect(pressInEditor(m, key, { keyCode: plainKeys[key] })).toBe(false);
    const changed =
      !m.editor.state.doc.eq(doc) ||
      !m.editor.state.selection.eq(selection) ||
      getFocusedTokenId(m.editor.state) !== null;
    expect(changed).toBe(true);
  });
});
