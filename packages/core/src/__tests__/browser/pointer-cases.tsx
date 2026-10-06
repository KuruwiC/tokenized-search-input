import { describe, expect, it } from 'vitest';
import { commands, userEvent } from 'vitest/browser';
import {
  afterLastToken,
  beforeFirstToken,
  caretLocation,
  centreOf,
  editingTokenIndex,
  expectCaretBetween,
  gapBetween,
  type MountedEditor,
  mountEditor,
  type Point,
  tokenElements,
} from './harness';

const TWO_TOKENS = 'status:is:open owner:is:bob';
const THREE_TOKENS = 'p:is:1 q:is:2 r:is:3';

/** The cursor shown over a point given relative to the editor. */
function cursorAt(m: MountedEditor, point: Point): string {
  const box = m.pm.getBoundingClientRect();
  const element = document.elementFromPoint(box.left + point.x, box.top + point.y);
  if (!element) throw new Error(`nothing at ${point.x},${point.y}`);
  return getComputedStyle(element).cursor;
}

/** Points in the space beside each token: before the first, between each pair, after the last. */
function spacesBesideTokens(m: MountedEditor): Point[] {
  const box = m.pm.getBoundingClientRect();
  const rects = tokenElements(m).map((token) => token.getBoundingClientRect());
  const at = (x: number, rect: DOMRect) => ({
    x: x - box.left,
    y: rect.top + rect.height / 2 - box.top,
  });
  const first = rects[0];
  const last = rects[rects.length - 1];
  if (!first || !last) throw new Error('no tokens');
  return [
    at(first.left - 2, first),
    ...rects.slice(1).map((_, index) => gapBetween(m, index)),
    at(last.right + 2, last),
  ];
}

function expectRangeOverTokens(m: MountedEditor, tokensSelected: number): void {
  const caret = caretLocation(m);
  expect(caret.collapsed).toBe(false);
  expect(caret.tokensSelected).toBe(tokensSelected);
  expect(window.getSelection()?.isCollapsed).toBe(false);
}

export function registerPointerCases(): void {
  describe('pointer', () => {
    it('shows the text cursor over the space beside each token', async () => {
      const m = await mountEditor(THREE_TOKENS);
      const points = spacesBesideTokens(m);
      expect(points).toHaveLength(4);
      for (const point of points) {
        expect(cursorAt(m, point), `cursor at ${point.x},${point.y}`).toBe('text');
      }
    });

    it('puts the caret in the gap that is clicked while the editor has focus', async () => {
      const m = await mountEditor(TWO_TOKENS);
      await userEvent.click(m.pm, { position: afterLastToken(m) });
      await userEvent.keyboard('{Escape}');
      expect(document.activeElement).toBe(m.pm);

      await userEvent.click(m.pm, { position: gapBetween(m, 0) });
      await expectCaretBetween(m, { tokensBefore: 1, tokensAfter: 1 });
    });

    it('puts the caret in the right gap when there are several', async () => {
      const m = await mountEditor(THREE_TOKENS);
      await userEvent.click(m.pm, { position: gapBetween(m, 1) });
      await expectCaretBetween(m, { tokensBefore: 2, tokensAfter: 1 });

      await userEvent.keyboard('gap');
      expect(m.value()).toBe('p:is:1 q:is:2 gap r:is:3');
    });

    it('enters editing when a token is clicked', async () => {
      const m = await mountEditor(TWO_TOKENS);
      await userEvent.click(m.pm, { position: centreOf(m, tokenElements(m)[1]) });
      expect(editingTokenIndex(m)).toBe(1);
      expect(tokenElements(m)[1]?.contains(document.activeElement)).toBe(true);

      await userEvent.keyboard('z');
      expect(m.value()).toBe('status:is:open owner:is:bobz');

      await userEvent.keyboard('{Escape}');
      expect(editingTokenIndex(m)).toBe(-1);
      await expectCaretBetween(m, { tokensBefore: 2, tokensAfter: 0 });
    });

    it('selects across tokens when dragging from before the first to after the last', async () => {
      const m = await mountEditor(TWO_TOKENS);
      await userEvent.dragAndDrop(m.pm, m.pm, {
        sourcePosition: beforeFirstToken(m),
        targetPosition: afterLastToken(m),
      });
      expectRangeOverTokens(m, 2);

      await userEvent.keyboard('x');
      expect(m.value()).toBe('x');
    });

    it('selects across tokens by dragging after the editor has lost focus once', async () => {
      const m = await mountEditor(TWO_TOKENS);
      await userEvent.click(m.pm, { position: gapBetween(m, 0) });
      const outside = document.createElement('input');
      document.body.appendChild(outside);
      try {
        outside.focus();
        expect(document.activeElement).toBe(outside);

        await userEvent.dragAndDrop(m.pm, m.pm, {
          sourcePosition: beforeFirstToken(m),
          targetPosition: afterLastToken(m),
        });
        expectRangeOverTokens(m, 2);

        await userEvent.keyboard('x');
        expect(m.value()).toBe('x');
      } finally {
        outside.remove();
      }
    });

    it('selects only the tokens a drag covers', async () => {
      const m = await mountEditor(THREE_TOKENS);
      await userEvent.dragAndDrop(m.pm, m.pm, {
        sourcePosition: gapBetween(m, 0),
        targetPosition: afterLastToken(m),
      });
      expectRangeOverTokens(m, 2);

      await userEvent.keyboard('x');
      expect(m.value()).toBe('p:is:1 x');
    });

    it('extends the selection from the caret with Shift+click', async () => {
      const m = await mountEditor(TWO_TOKENS);
      await userEvent.click(m.pm, { position: gapBetween(m, 0) });
      await userEvent.click(m.pm, { position: afterLastToken(m), modifiers: ['Shift'] });
      expectRangeOverTokens(m, 1);

      await userEvent.keyboard('x');
      expect(m.value()).toBe('status:is:open x');
    });

    it('extends the selection backwards with Shift+click', async () => {
      const m = await mountEditor(TWO_TOKENS);
      await userEvent.click(m.pm, { position: gapBetween(m, 0) });
      await userEvent.click(m.pm, { position: beforeFirstToken(m), modifiers: ['Shift'] });
      expectRangeOverTokens(m, 1);

      await userEvent.keyboard('x');
      expect(m.value()).toBe('x owner:is:bob');
    });

    it('replaces a backward Shift+click selection with text inserted in one go', async () => {
      const m = await mountEditor(TWO_TOKENS);
      await userEvent.click(m.pm, { position: gapBetween(m, 0) });
      await userEvent.click(m.pm, { position: beforeFirstToken(m), modifiers: ['Shift'] });
      expectRangeOverTokens(m, 1);

      // An input method commit, an emoji picker or dictation: a beforeinput insertText.
      await commands.insertText('あ');
      expect(m.value()).toBe('あ owner:is:bob');
    });

    it('selects every token with Shift+click from the start to the end', async () => {
      const m = await mountEditor(TWO_TOKENS);
      await userEvent.click(m.pm, { position: beforeFirstToken(m) });
      await userEvent.click(m.pm, { position: afterLastToken(m), modifiers: ['Shift'] });
      expectRangeOverTokens(m, 2);
    });
  });
}
