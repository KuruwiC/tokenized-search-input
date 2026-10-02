import { describe, expect, it } from 'vitest';
import { userEvent } from 'vitest/browser';
import {
  afterLastToken,
  beforeFirstToken,
  caretLocation,
  editingTokenIndex,
  expectCaretBetween,
  gapBetween,
  mountEditor,
} from './harness';

const TWO_TOKENS = 'status:is:open owner:is:bob';

describe('deletion', () => {
  it('removes every token a dragged range covers and leaves a caret that types', async () => {
    const m = await mountEditor(TWO_TOKENS);
    await userEvent.dragAndDrop(m.pm, m.pm, {
      sourcePosition: beforeFirstToken(m),
      targetPosition: afterLastToken(m),
    });
    expect(caretLocation(m).tokensSelected).toBe(2);

    await userEvent.keyboard('{Backspace}');
    expect(m.value()).toBe('');
    await expectCaretBetween(m, { tokensBefore: 0, tokensAfter: 0 });

    await userEvent.keyboard('x');
    expect(m.value()).toBe('x');
  });

  it('removes only the tokens a Shift+click range covers', async () => {
    const m = await mountEditor(TWO_TOKENS);
    await userEvent.click(m.pm, { position: gapBetween(m, 0) });
    await userEvent.click(m.pm, { position: afterLastToken(m), modifiers: ['Shift'] });
    expect(caretLocation(m).tokensSelected).toBe(1);

    await userEvent.keyboard('{Backspace}');
    expect(m.value()).toBe('status:is:open');
    await expectCaretBetween(m, { tokensBefore: 1, tokensAfter: 0 });

    await userEvent.keyboard('x');
    expect(m.value()).toBe('status:is:open x');
  });

  it('opens the token before the caret for editing on the first Backspace instead of removing it', async () => {
    const m = await mountEditor(TWO_TOKENS);
    await userEvent.click(m.pm, { position: afterLastToken(m) });

    await userEvent.keyboard('{Backspace}');
    expect(m.value()).toBe(TWO_TOKENS);
    expect(editingTokenIndex(m)).toBe(1);
  });

  it('removes one character of that token value on the second Backspace', async () => {
    const m = await mountEditor(TWO_TOKENS);
    await userEvent.click(m.pm, { position: afterLastToken(m) });

    await userEvent.keyboard('{Backspace}{Backspace}');
    expect(m.value()).toBe('status:is:open owner:is:bo');
    expect(editingTokenIndex(m)).toBe(1);
  });

  it('selects an immutable token on the first Backspace and removes it on the second', async () => {
    const m = await mountEditor('status:is:open lock:is:x');
    await userEvent.click(m.pm, { position: afterLastToken(m) });
    await expectCaretBetween(m, { tokensBefore: 2, tokensAfter: 0 });

    await userEvent.keyboard('{Backspace}');
    expect(m.value()).toBe('status:is:open lock:is:x');
    expect(caretLocation(m).tokensSelected).toBe(1);

    await userEvent.keyboard('{Backspace}');
    expect(m.value()).toBe('status:is:open');
    await expectCaretBetween(m, { tokensBefore: 1, tokensAfter: 0 });

    await userEvent.keyboard('x');
    expect(m.value()).toBe('status:is:open x');
  });

  it('removes an immutable token that is followed by another token and keeps the caret in front of the rest', async () => {
    const m = await mountEditor('lock:is:x status:is:open');
    await userEvent.click(m.pm, { position: gapBetween(m, 0) });
    await expectCaretBetween(m, { tokensBefore: 1, tokensAfter: 1 });

    await userEvent.keyboard('{Backspace}');
    expect(m.value()).toBe('lock:is:x status:is:open');
    expect(caretLocation(m).tokensSelected).toBe(1);

    await userEvent.keyboard('{Backspace}');
    expect(m.value()).toBe('status:is:open');
    await expectCaretBetween(m, { tokensBefore: 0, tokensAfter: 1 });

    await userEvent.keyboard('x');
    expect(m.value()).toBe('x status:is:open');
  });
});
