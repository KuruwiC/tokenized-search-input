import { describe, expect, it, vi } from 'vitest';
import { userEvent } from 'vitest/browser';
import { registerCaretCases } from './caret-cases';
import { afterLastToken, holdCaretSteady, mountEditor, paintedCaret } from './harness';

const TWO_TOKENS = 'status:is:open owner:is:bob';

/** Longer than one blink cycle of the caret in Chromium (1 s) and WebKit (about 1.06 s). */
const BLINK_CYCLE_MS = 1200;

registerCaretCases();

// The caret checks of every engine rely on holdCaretSteady; whether a phone viewport is
// emulated does not change how it stops the blinking, so this runs on the desktop projects.
describe('the caret hold of the harness', () => {
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
});
