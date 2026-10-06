import { describe, expect, it, onTestFinished, vi } from 'vitest';
import { userEvent } from 'vitest/browser';
import type { TokenizedSearchInputProps } from '../../index';
import {
  finishAnimations,
  focusEditor,
  type MountedAround,
  mountEditorAround,
  tokenElements,
} from './harness';

/** Six tokens: several times wider than a 300px box. */
const QUERY = Array.from({ length: 6 }, (_, i) => `status:is:value-${i}`).join(' ');

function mountIn(
  props: Partial<TokenizedSearchInputProps>,
  attributes: Record<string, string> = {}
): Promise<MountedAround> {
  return mountEditorAround(QUERY, props, { width: '300px', attributes });
}

async function blurToOutside(): Promise<void> {
  const outside = document.createElement('button');
  outside.textContent = 'Outside';
  document.body.append(outside);
  onTestFinished(() => outside.remove());
  outside.focus();
  await finishAnimations();
}

function expectInside(m: MountedAround, rect: { left: number; right: number }, what: string): void {
  const box = m.container.getBoundingClientRect();
  expect(rect.left, `${what} left of the box`).toBeGreaterThanOrEqual(box.left);
  expect(rect.right, `${what} right of the box`).toBeLessThanOrEqual(box.right);
}

function caretRect(m: MountedAround): { left: number; right: number } {
  return m.editor.view.coordsAtPos(m.editor.state.selection.head);
}

function horizontalScrollers(m: MountedAround): HTMLElement[] {
  return [m.input, m.pm].filter((element) => element.scrollWidth > element.clientWidth);
}

function lastToken(m: MountedAround): HTMLElement {
  const tokens = tokenElements(m);
  const last = tokens[tokens.length - 1];
  if (!last) throw new Error('no token');
  return last;
}

function tokenOffsets(m: MountedAround): number[] {
  const left = m.container.getBoundingClientRect().left;
  return tokenElements(m).map((token) => Math.round(token.getBoundingClientRect().left - left));
}

describe('a singleLine input wider than its box', () => {
  it('shows the start, follows the caret while focused and returns to the start on blur', async () => {
    const m = await mountIn({ singleLine: true });
    expect(horizontalScrollers(m)).toEqual([m.pm]);
    expect(m.pm.scrollLeft).toBe(0);

    await focusEditor(m, 'end');
    await userEvent.keyboard('abc');
    await finishAnimations();
    expectInside(m, caretRect(m), 'the caret');

    await blurToOutside();
    await expect.poll(() => m.pm.scrollLeft).toBe(0);
  });

  it('keeps a token added at the end in view', async () => {
    const m = await mountIn({ singleLine: true });
    await focusEditor(m, 'end');
    await userEvent.keyboard(' status:is:added{Enter}');
    await vi.waitFor(() => expect(tokenElements(m)).toHaveLength(7));
    await finishAnimations();

    const added = lastToken(m);
    expectInside(m, added.getBoundingClientRect(), 'the added token');
  });

  it('keeps its scroll while focus moves into the value of a token', async () => {
    const m = await mountIn({ singleLine: true });
    await focusEditor(m, 'end');
    await finishAnimations();
    const scrolled = m.pm.scrollLeft;
    expect(scrolled).toBeGreaterThan(0);

    await userEvent.keyboard('{Backspace}');
    await vi.waitFor(() => expect(document.activeElement).toBeInstanceOf(HTMLInputElement));
    await finishAnimations();

    expect(m.pm.scrollLeft).toBeGreaterThan(0);
    const edited = lastToken(m);
    expectInside(m, edited.getBoundingClientRect(), 'the token being edited');
  });

  it('rests at the inline start in a right-to-left page', async () => {
    const m = await mountIn({ singleLine: true }, { dir: 'rtl' });
    expect(m.pm.scrollLeft).toBe(0);

    await focusEditor(m, 'end');
    await userEvent.keyboard('abc');
    await finishAnimations();
    expectInside(m, caretRect(m), 'the caret');

    await blurToOutside();
    await expect.poll(() => m.pm.scrollLeft).toBe(0);
  });
});

describe('a collapsed expandOnFocus input', () => {
  it('is the singleLine presentation', async () => {
    const single = await mountIn({ singleLine: true });
    const collapsed = await mountIn({ expandOnFocus: true });

    expect(horizontalScrollers(collapsed)).toEqual([collapsed.pm]);
    expect(collapsed.container.getBoundingClientRect().height).toBe(
      single.container.getBoundingClientRect().height
    );
    expect(tokenOffsets(collapsed)).toEqual(tokenOffsets(single));
  });

  it('rests like a singleLine input after it was opened, edited and closed', async () => {
    const single = await mountIn({ singleLine: true });
    await focusEditor(single, 'end');
    await userEvent.keyboard('abc');
    await blurToOutside();

    const collapsed = await mountIn({ expandOnFocus: true });
    await focusEditor(collapsed, 'end');
    await userEvent.keyboard('abc');
    await blurToOutside();

    await expect.poll(() => collapsed.pm.scrollLeft).toBe(0);
    await expect.poll(() => collapsed.input.scrollLeft).toBe(0);
    expect(tokenOffsets(collapsed)).toEqual(tokenOffsets(single));
  });
});
