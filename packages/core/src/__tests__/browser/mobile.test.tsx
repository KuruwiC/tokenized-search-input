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

/** A point `inset` pixels inside the left or right edge of an element, at its middle height. */
function insideEdge(
  element: Element | undefined,
  m: { pm: HTMLElement },
  edge: 'left' | 'right',
  inset: number
): { x: number; y: number } {
  const rect = element?.getBoundingClientRect();
  if (!rect) throw new Error('no element to tap');
  const box = m.pm.getBoundingClientRect();
  const x = edge === 'left' ? rect.left + inset : rect.right - inset;
  return { x: x - box.left, y: rect.top + rect.height / 2 - box.top };
}

const deleteButtonOf = (m: Parameters<typeof tokenElements>[0], index: number) =>
  tokenElements(m)[index]?.querySelector('.tsi-token-delete') ?? undefined;

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
    await commands.tapEditor(centreOf(deleteButtonOf(m, 0), m));

    expect(m.value()).toBe('owner:is:bob');
    expect(tokenElements(m)).toHaveLength(1);
  });

  it('keeps the caret where it is when text is entered inside a token value', async () => {
    const m = await mountEditor(TWO_TOKENS);
    const value = tokenElements(m)[1]?.querySelector('.tsi-token-value') ?? undefined;
    await commands.tapEditor(centreOf(value, m));
    expect(editingTokenIndex(m)).toBe(1);
    const input = document.activeElement;
    if (!(input instanceof HTMLInputElement)) throw new Error('the value input has no focus');
    input.setSelectionRange(1, 1);

    await commands.insertText('x');
    await commands.insertText('y');
    expect(input.value).toBe('bxyob');
    expect(input.selectionStart).toBe(3);
    expect(m.value()).toBe('status:is:open owner:is:bxyob');
  });

  for (const inset of [1, 3]) {
    it(`enters the token after the gap when a tap lands ${inset}px inside its left edge`, async () => {
      const m = await mountEditor(TWO_TOKENS);
      await commands.tapEditor(insideEdge(tokenElements(m)[1], m, 'left', inset));

      expect(editingTokenIndex(m)).toBe(1);
      expect(m.value()).toBe(TWO_TOKENS);
    });
  }

  it('removes the token before the gap when a tap lands on its delete button 3px inside its right edge', async () => {
    const m = await mountEditor(TWO_TOKENS);
    const point = insideEdge(tokenElements(m)[0], m, 'right', 3);
    const box = m.pm.getBoundingClientRect();
    const element = document.elementFromPoint(point.x + box.left, point.y + box.top);
    expect(deleteButtonOf(m, 0)?.contains(element)).toBe(true);
    await commands.tapEditor(point);

    expect(m.value()).toBe('owner:is:bob');
  });

  for (const edge of ['left', 'right'] as const) {
    it(`removes the token when its delete button is tapped just inside the button's ${edge} edge`, async () => {
      const m = await mountEditor(TWO_TOKENS);
      await commands.tapEditor(insideEdge(deleteButtonOf(m, 0), m, edge, 1));

      expect(m.value()).toBe('owner:is:bob');
    });
  }

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
