import { describe, expect, it } from 'vitest';
import { userEvent } from 'vitest/browser';
import { registerCaretCases } from './caret-cases';
import {
  afterLastToken,
  BLINK_CYCLE_MS,
  CARET_SEARCH,
  caretHoldIsSteady,
  holdCaretSteady,
  mountEditor,
  paintedCaret,
  waitForPaintedCaret,
  waitIsOver,
} from './harness';

const TWO_TOKENS = 'status:is:open owner:is:bob';

registerCaretCases();

// The caret checks of every engine rely on holdCaretSteady; whether a phone viewport is
// emulated does not change how it stops the blinking, so this runs on the desktop projects.
describe('the caret hold of the harness', () => {
  it('shows the caret before a caret check gives up, and in every frame where it stops the blinking', async () => {
    const m = await mountEditor(TWO_TOKENS);
    await userEvent.click(m.pm, { position: afterLastToken(m) });
    const release = await holdCaretSteady(m);
    try {
      await waitForPaintedCaret(m);
      const start = performance.now();
      let lastPainted = start;
      let framesSincePainted = 0;
      while (performance.now() - start < 2 * BLINK_CYCLE_MS) {
        const taken = performance.now();
        const painted = await paintedCaret(m);
        if (caretHoldIsSteady) expect(painted).not.toBeNull();
        if (painted) {
          lastPainted = performance.now();
          framesSincePainted = 0;
        } else {
          framesSincePainted += 1;
          expect(
            waitIsOver(CARET_SEARCH, framesSincePainted, taken - lastPainted),
            `no caret is painted in ${framesSincePainted} frames over ${Math.round(taken - lastPainted)} ms`
          ).toBe(false);
        }
      }
    } finally {
      await release();
    }
  });
});
