import { describe, expect, it } from 'vitest';
import { userEvent } from 'vitest/browser';
import {
  afterLastToken,
  beforeFirstToken,
  type CaretLocation,
  caretLocation,
  centreOf,
  editingTokenIndex,
  expectCaretBetween,
  gapBetween,
  type MountedEditor,
  mountEditor,
  pressUntil,
  tokenElements,
} from './harness';

const TWO_TOKENS = 'status:is:open owner:is:bob';

const caretIsBetween = (m: MountedEditor, tokensBefore: number) => () => {
  const caret = caretLocation(m);
  return document.activeElement === m.pm && caret.collapsed && caret.tokensBefore === tokensBefore;
};

/** Checks the selection only: the cases for each kind of gap check where the caret is painted. */
function expectCaretAt(
  m: MountedEditor,
  expected: Pick<CaretLocation, 'tokensBefore' | 'tokensAfter' | 'textBefore' | 'textAfter'>
): void {
  expect(document.activeElement).toBe(m.pm);
  expect(caretLocation(m)).toMatchObject({ collapsed: true, ...expected });
}

export function registerCaretCases(): void {
  describe('caret', () => {
    it('sits between two adjacent tokens and types there', async () => {
      const m = await mountEditor(TWO_TOKENS);
      await userEvent.click(m.pm, { position: gapBetween(m, 0) });
      await expectCaretBetween(m, { tokensBefore: 1, tokensAfter: 1 });

      await userEvent.keyboard('hi');
      expect(m.value()).toBe('status:is:open hi owner:is:bob');
      await expectCaretBetween(m, { tokensBefore: 1, tokensAfter: 1 });
    });

    it('sits right after a token when editing of that token is left with Escape', async () => {
      const m = await mountEditor(TWO_TOKENS);
      await userEvent.click(m.pm, { position: centreOf(m, tokenElements(m)[0]) });
      expect(editingTokenIndex(m)).toBe(0);

      await userEvent.keyboard('{Escape}');
      expect(editingTokenIndex(m)).toBe(-1);
      await expectCaretBetween(m, { tokensBefore: 1, tokensAfter: 1 });

      await userEvent.keyboard('x');
      expect(m.value()).toBe('status:is:open x owner:is:bob');
    });

    it('sits after the last token and types there', async () => {
      const m = await mountEditor(TWO_TOKENS);
      await userEvent.click(m.pm, { position: afterLastToken(m) });
      await expectCaretBetween(m, { tokensBefore: 2, tokensAfter: 0 });

      await userEvent.keyboard('tail');
      expect(m.value()).toBe('status:is:open owner:is:bob tail');
      await expectCaretBetween(m, { tokensBefore: 2, tokensAfter: 0 });
    });

    it('sits before the first token and types there', async () => {
      const m = await mountEditor(TWO_TOKENS);
      await userEvent.click(m.pm, { position: beforeFirstToken(m) });
      await expectCaretBetween(m, { tokensBefore: 0, tokensAfter: 2 });

      await userEvent.keyboard('head');
      expect(m.value()).toBe('head status:is:open owner:is:bob');
      await expectCaretBetween(m, { tokensBefore: 0, tokensAfter: 2 });
    });

    it('crosses tokens with ArrowLeft and types at each stop', async () => {
      const m = await mountEditor(TWO_TOKENS);
      await userEvent.click(m.pm, { position: afterLastToken(m) });
      expectCaretAt(m, { tokensBefore: 2, tokensAfter: 0, textBefore: '', textAfter: '' });

      await pressUntil('{ArrowLeft}', caretIsBetween(m, 1));
      await expectCaretBetween(m, { tokensBefore: 1, tokensAfter: 1 });
      expectCaretAt(m, { tokensBefore: 1, tokensAfter: 1, textBefore: '', textAfter: '' });
      await userEvent.keyboard('mid');
      expect(m.value()).toBe('status:is:open mid owner:is:bob');

      await pressUntil('{ArrowLeft}', caretIsBetween(m, 0));
      expectCaretAt(m, { tokensBefore: 0, tokensAfter: 2, textBefore: '', textAfter: 'mid' });
      await userEvent.keyboard('head');
      expect(m.value()).toBe('head status:is:open mid owner:is:bob');
    });

    it('leaves a token being edited with ArrowLeft into the gap before it', async () => {
      const m = await mountEditor(TWO_TOKENS);
      const value = tokenElements(m)[1]?.querySelector('.tsi-token-value');
      await userEvent.click(m.pm, { position: centreOf(m, value) });
      expect(editingTokenIndex(m)).toBe(1);

      await pressUntil('{ArrowLeft}', caretIsBetween(m, 1));
      expect(editingTokenIndex(m)).toBe(-1);
      await expectCaretBetween(m, { tokensBefore: 1, tokensAfter: 1 });
      await userEvent.keyboard('mid');
      expect(m.value()).toBe('status:is:open mid owner:is:bob');
    });

    it('crosses tokens with ArrowRight and types at each stop', async () => {
      const m = await mountEditor(TWO_TOKENS);
      await userEvent.click(m.pm, { position: beforeFirstToken(m) });
      expectCaretAt(m, { tokensBefore: 0, tokensAfter: 2, textBefore: '', textAfter: '' });

      await pressUntil('{ArrowRight}', caretIsBetween(m, 1));
      await expectCaretBetween(m, { tokensBefore: 1, tokensAfter: 1 });
      expectCaretAt(m, { tokensBefore: 1, tokensAfter: 1, textBefore: '', textAfter: '' });
      await userEvent.keyboard('mid');
      expect(m.value()).toBe('status:is:open mid owner:is:bob');

      await pressUntil('{ArrowRight}', caretIsBetween(m, 2));
      expectCaretAt(m, { tokensBefore: 2, tokensAfter: 0, textBefore: 'mid', textAfter: '' });
      await userEvent.keyboard('tail');
      expect(m.value()).toBe('status:is:open mid owner:is:bob tail');
    });
  });
}
