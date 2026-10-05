import { describe, expect, it, vi } from 'vitest';
import { userEvent } from 'vitest/browser';
import {
  afterLastToken,
  beforeFirstToken,
  caretLocation,
  centreOf,
  editingTokenIndex,
  expectCaretBetween,
  gapBetween,
  holdCaretSteady,
  type MountedEditor,
  mountEditor,
  paintedCaret,
  pressUntil,
  tokenElements,
} from './harness';

const TWO_TOKENS = 'status:is:open owner:is:bob';

/** Longer than one blink cycle of the caret in Chromium (1 s) and WebKit (about 1.06 s). */
const BLINK_CYCLE_MS = 1200;

const caretIsBetween = (m: MountedEditor, tokensBefore: number) => () => {
  const caret = caretLocation(m);
  return document.activeElement === m.pm && caret.collapsed && caret.tokensBefore === tokensBefore;
};

export function registerCaretCases(): void {
  describe('caret', () => {
    it('stays painted without blinking while it is checked', async () => {
      const m = await mountEditor(TWO_TOKENS);
      await userEvent.click(m.pm, { position: afterLastToken(m) });
      const release = await holdCaretSteady(m);
      try {
        await vi.waitFor(async () => expect(await paintedCaret(m)).not.toBeNull(), {
          timeout: 2500,
          interval: 80,
        });
        const start = performance.now();
        while (performance.now() - start < BLINK_CYCLE_MS) {
          expect(await paintedCaret(m)).not.toBeNull();
        }
      } finally {
        await release();
      }
    });

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
