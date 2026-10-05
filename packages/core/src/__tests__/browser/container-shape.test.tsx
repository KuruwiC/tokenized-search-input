import { describe, expect, it } from 'vitest';
import {
  finishAnimations,
  focusEditor,
  insideRoundedBox,
  type MountedEditor,
  mountEditorAround,
  radiusOf,
  tokenElements,
} from './harness';

/** Enough tokens to wrap onto three or more lines in a 260px box. */
const WRAPPING = Array.from({ length: 8 }, (_, i) => `status:is:value${i}`).join(' ');

/** A pill-shaped theme, set where pages set it: on an element around the input, not on :root. */
const PILL = { '--tsi-radius': '9999px', '--tsi-radius-inner': '9999px' };

/** Half the height of the box on one line: its minimum height and its two borders. */
function halfSingleLineHeight(container: HTMLElement): number {
  const probe = document.createElement('div');
  probe.style.height = 'var(--tsi-min-height)';
  container.append(probe);
  const minHeight = probe.getBoundingClientRect().height;
  probe.remove();
  return minHeight / 2 + Number.parseFloat(getComputedStyle(container).borderTopWidth);
}

function lines(m: MountedEditor): number {
  return new Set(tokenElements(m).map((token) => Math.round(token.getBoundingClientRect().top)))
    .size;
}

/** Every corner of every token lies inside the area the box clips its content to. */
function expectTokensInside(m: MountedEditor, container: HTMLElement): void {
  const border = Number.parseFloat(getComputedStyle(container).borderTopWidth);
  for (const token of tokenElements(m)) {
    const r = token.getBoundingClientRect();
    for (const [x, y] of [
      [r.left + 0.5, r.top + 0.5],
      [r.right - 0.5, r.top + 0.5],
      [r.left + 0.5, r.bottom - 0.5],
      [r.right - 0.5, r.bottom - 0.5],
    ] as const) {
      expect(
        insideRoundedBox(container, x, y, border),
        `${token.textContent} corner at ${x},${y}`
      ).toBe(true);
    }
  }
}

describe('the editor box under a pill theme', () => {
  it('stays a rounded box that clips no token when the tokens wrap', async () => {
    const m = await mountEditorAround(WRAPPING, {}, { width: '260px', variables: PILL });
    const { container } = m;
    expect(lines(m)).toBeGreaterThanOrEqual(3);

    expectTokensInside(m, container);
    expect(radiusOf(container)).toBeLessThanOrEqual(halfSingleLineHeight(container));
  });

  it('is a full pill on one line', async () => {
    const m = await mountEditorAround('status:is:open', {}, { width: '600px', variables: PILL });
    const { container } = m;
    const height = container.getBoundingClientRect().height;

    expect(height).toBe(halfSingleLineHeight(container) * 2);
    expect(radiusOf(container)).toBe(height / 2);
  });

  it('keeps the same bound when an expandOnFocus box opens over its wrapped tokens', async () => {
    const m = await mountEditorAround(
      WRAPPING,
      { expandOnFocus: true },
      { width: '260px', variables: PILL }
    );
    const { container } = m;
    await focusEditor(m, 'end');
    await finishAnimations();
    expect(lines(m)).toBeGreaterThanOrEqual(3);

    expect(radiusOf(container)).toBeLessThanOrEqual(halfSingleLineHeight(container));
  });

  it('still draws the tokens as pills', async () => {
    const m = await mountEditorAround(WRAPPING, {}, { width: '260px', variables: PILL });

    for (const token of tokenElements(m)) expect(radiusOf(token)).toBe(9999);
  });
});

describe('the editor box radius', () => {
  it('stays at the radius of the default theme', async () => {
    const m = await mountEditorAround(WRAPPING, {}, { width: '260px' });

    expect(getComputedStyle(m.container).borderTopLeftRadius).toBe('8px');
  });
});
