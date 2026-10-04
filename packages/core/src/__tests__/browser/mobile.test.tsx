import { describe, expect, it } from 'vitest';
import { commands, userEvent } from 'vitest/browser';
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

registerCaretCases();
registerPointerCases();

function centreOf(element: Element | undefined, m: { pm: HTMLElement }): { x: number; y: number } {
  const rect = element?.getBoundingClientRect();
  if (!rect) throw new Error('no element to tap');
  const box = m.pm.getBoundingClientRect();
  return { x: rect.left + rect.width / 2 - box.left, y: rect.top + rect.height / 2 - box.top };
}

describe('mobile touch', () => {
  it('puts the caret in the gap when the centre of the gap between two tokens is tapped', async () => {
    const m = await mountEditor(TWO_TOKENS);
    await commands.tapEditor(gapBetween(m, 0));

    await expectCaretBetween(m, { tokensBefore: 1, tokensAfter: 1 });
    await userEvent.keyboard('tap');
    expect(m.value()).toBe('status:is:open tap owner:is:bob');
  });

  it('puts the caret in the gap when the gap is tapped next to the delete button before it', async () => {
    const m = await mountEditor(TWO_TOKENS);
    const gap = gapBetween(m, 0);
    await commands.tapEditor({ x: gap.x - 2, y: gap.y });

    await expectCaretBetween(m, { tokensBefore: 1, tokensAfter: 1 });
    expect(m.value()).toBe(TWO_TOKENS);
  });

  it('puts the caret in the gap when the gap is tapped next to the token after it', async () => {
    const m = await mountEditor(TWO_TOKENS);
    const gap = gapBetween(m, 0);
    await commands.tapEditor({ x: gap.x + 2, y: gap.y });

    await expectCaretBetween(m, { tokensBefore: 1, tokensAfter: 1 });
    expect(editingTokenIndex(m)).toBe(-1);
  });

  it('removes a token when its delete button is tapped', async () => {
    const m = await mountEditor(TWO_TOKENS);
    const button = tokenElements(m)[0]?.querySelector('.tsi-token-delete') ?? undefined;
    await commands.tapEditor(centreOf(button, m));

    expect(m.value()).toBe('owner:is:bob');
    expect(tokenElements(m)).toHaveLength(1);
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
