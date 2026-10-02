import { describe, expect, it } from 'vitest';
import { userEvent } from 'vitest/browser';
import {
  afterLastToken,
  beforeFirstToken,
  caretLocation,
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
      const first = tokenElements(m)[0]?.getBoundingClientRect();
      const box = m.pm.getBoundingClientRect();
      if (!first) throw new Error('no token');
      await userEvent.click(m.pm, {
        position: {
          x: first.left + first.width / 2 - box.left,
          y: first.top + first.height / 2 - box.top,
        },
      });
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
      await expectCaretBetween(m, { tokensBefore: 2, tokensAfter: 0 });

      await pressUntil('{ArrowLeft}', caretIsBetween(m, 1));
      await expectCaretBetween(m, { tokensBefore: 1, tokensAfter: 1 });
      await userEvent.keyboard('mid');
      expect(m.value()).toBe('status:is:open mid owner:is:bob');

      await pressUntil('{ArrowLeft}', caretIsBetween(m, 0));
      await expectCaretBetween(m, { tokensBefore: 0, tokensAfter: 2 });
      await userEvent.keyboard('head');
      expect(m.value()).toBe('head status:is:open mid owner:is:bob');
    });

    it('crosses tokens with ArrowRight and types at each stop', async () => {
      const m = await mountEditor(TWO_TOKENS);
      await userEvent.click(m.pm, { position: beforeFirstToken(m) });
      await expectCaretBetween(m, { tokensBefore: 0, tokensAfter: 2 });

      await pressUntil('{ArrowRight}', caretIsBetween(m, 1));
      await expectCaretBetween(m, { tokensBefore: 1, tokensAfter: 1 });
      await userEvent.keyboard('mid');
      expect(m.value()).toBe('status:is:open mid owner:is:bob');

      await pressUntil('{ArrowRight}', caretIsBetween(m, 2));
      await expectCaretBetween(m, { tokensBefore: 2, tokensAfter: 0 });
      await userEvent.keyboard('tail');
      expect(m.value()).toBe('status:is:open mid owner:is:bob tail');
    });
  });
}
