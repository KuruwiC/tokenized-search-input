import { describe, expect, it } from 'vitest';
import { commands, server, userEvent } from 'vitest/browser';
import { registerCaretCases } from './caret-cases';
import {
  afterLastToken,
  editingTokenIndex,
  expectCaretBetween,
  gapBetween,
  mountEditor,
  tokenElements,
} from './harness';
import { registerPointerCases } from './pointer-cases';

const TWO_TOKENS = 'status:is:open owner:is:bob';

describe('mobile environment', () => {
  it('runs with a phone viewport, a mobile user agent and touch input', () => {
    expect(navigator.userAgent).toMatch(/Android|iPhone/);
    expect(window.innerWidth).toBeLessThanOrEqual(480);
    expect(window.matchMedia('(pointer: coarse)').matches).toBe(true);
  });
});

// The desktop expectations hold unchanged on a phone-sized viewport.
registerCaretCases();
registerPointerCases();

/*
 * Chromium retargets a touch that lands within a few pixels of a token control onto that
 * control, so the 8px gap between two tokens cannot be tapped there: a tap left of the gap
 * centre hits the delete button of the token before it, and a tap on or right of the centre
 * enters editing of the token after it. WebKit delivers the tap to the gap.
 */
const touchIsRetargeted = () => server.browser === 'chromium';

describe('mobile touch', () => {
  it('handles a tap on the centre of the gap between two tokens', async () => {
    const m = await mountEditor(TWO_TOKENS);
    await commands.tapEditor(gapBetween(m, 0));

    if (touchIsRetargeted()) {
      expect(editingTokenIndex(m)).toBe(1);
      expect(m.value()).toBe(TWO_TOKENS);
      return;
    }
    await expectCaretBetween(m, { tokensBefore: 1, tokensAfter: 1 });
    await userEvent.keyboard('tap');
    expect(m.value()).toBe('status:is:open tap owner:is:bob');
  });

  it('handles a tap just left of the centre of the gap', async () => {
    const m = await mountEditor(TWO_TOKENS);
    const gap = gapBetween(m, 0);
    await commands.tapEditor({ x: gap.x - 2, y: gap.y });

    if (touchIsRetargeted()) {
      expect(m.value()).toBe('owner:is:bob');
      expect(tokenElements(m)).toHaveLength(1);
      return;
    }
    await expectCaretBetween(m, { tokensBefore: 1, tokensAfter: 1 });
    expect(m.value()).toBe(TWO_TOKENS);
  });

  it('puts the caret after the last token when the empty row is tapped', async () => {
    const m = await mountEditor(TWO_TOKENS);
    await commands.tapEditor(afterLastToken(m));
    await expectCaretBetween(m, { tokensBefore: 2, tokensAfter: 0 });

    await userEvent.keyboard('tap');
    expect(m.value()).toBe('status:is:open owner:is:bob tap');
  });

  it('places the caret between tokens on a wrapped second row', async () => {
    const tokens = [
      'status:is:open',
      'owner:is:bob',
      'lock:is:x',
      'status:is:closed',
      'owner:is:alice',
    ];
    const m = await mountEditor(tokens.join(' '));
    const tops = tokenElements(m).map((token) => Math.round(token.getBoundingClientRect().top));
    const firstRow = Math.min(...tops);
    expect(Math.max(...tops)).toBeGreaterThan(firstRow);

    // The last pair of neighbours that share a row below the first one.
    let index = -1;
    tops.forEach((top, i) => {
      if (top > firstRow && tops[i + 1] === top) index = i;
    });
    expect(index).toBeGreaterThan(-1);
    await userEvent.click(m.pm, { position: gapBetween(m, index) });
    await expectCaretBetween(m, {
      tokensBefore: index + 1,
      tokensAfter: tokens.length - index - 1,
    });

    await userEvent.keyboard('wrap');
    expect(m.value()).toBe(
      [...tokens.slice(0, index + 1), 'wrap', ...tokens.slice(index + 1)].join(' ')
    );
  });
});
