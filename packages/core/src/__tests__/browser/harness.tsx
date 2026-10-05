import '../../index.css';
import { cleanup, render } from '@testing-library/react';
import type { Editor } from '@tiptap/core';
import { createRef, type RefObject } from 'react';
import { afterEach, expect, vi } from 'vitest';
import { page, userEvent } from 'vitest/browser';
import {
  type FieldDefinition,
  TokenizedSearchInput,
  type TokenizedSearchInputProps,
  type TokenizedSearchInputRef,
} from '../../index';

/** The `pointerType` of the last press in the current test. */
let lastPressPointerType = '';
document.addEventListener(
  'pointerdown',
  (event) => {
    lastPressPointerType = event.pointerType;
  },
  true
);

afterEach(() => {
  cleanup();
  lastPressPointerType = '';
});

export const fields: FieldDefinition[] = [
  { key: 'status', label: 'Status', type: 'string', operators: ['is'] },
  { key: 'owner', label: 'Owner', type: 'string', operators: ['is'] },
  { key: 'lock', label: 'Lock', type: 'string', operators: ['is'], immutable: true },
  // Short labels keep three tokens on one row of a phone-width editor.
  { key: 'p', label: 'P', type: 'string', operators: ['is'] },
  { key: 'q', label: 'Q', type: 'string', operators: ['is'] },
  { key: 'r', label: 'R', type: 'string', operators: ['is'] },
];

export interface MountedEditor {
  ref: RefObject<TokenizedSearchInputRef | null>;
  editor: Editor;
  pm: HTMLElement;
  value: () => string;
}

const settle = () => new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));

/**
 * Jumps every running CSS animation and transition (the token insert animation, colour
 * transitions) to its end state and waits for that state to be painted. Waiting for them to
 * run out instead depends on the page rendering frames, which a loaded machine can stall for
 * longer than any fixed wait.
 */
export async function finishAnimations(): Promise<void> {
  for (const animation of document.getAnimations()) animation.finish();
  await settle();
}

export async function mountEditor(
  defaultValue: string,
  props: Partial<TokenizedSearchInputProps> = {}
): Promise<MountedEditor> {
  const ref = createRef<TokenizedSearchInputRef>();
  const { container } = render(
    <TokenizedSearchInput ref={ref} fields={fields} defaultValue={defaultValue} {...props} />
  );
  const pm = container.querySelector<HTMLElement>('.ProseMirror');
  if (!pm) throw new Error('editor did not render');
  const expectedTokens = defaultValue.split(' ').filter((part) => part.includes(':')).length;
  await vi.waitFor(() => {
    expect(container.querySelectorAll('.tsi-token')).toHaveLength(expectedTokens);
  });
  await finishAnimations();
  const editor = ref.current?.getEditor();
  if (!editor) throw new Error('editor handle is unavailable');
  return { ref, editor, pm, value: () => ref.current?.getValue() ?? '' };
}

export function tokenElements(m: MountedEditor): HTMLElement[] {
  return [...m.pm.querySelectorAll<HTMLElement>('.tsi-token')];
}

export interface Point {
  x: number;
  y: number;
}

function relativeToEditor(m: MountedEditor, clientX: number, clientY: number): Point {
  const box = m.pm.getBoundingClientRect();
  return { x: clientX - box.left, y: clientY - box.top };
}

/** The centre of `element`, relative to the editor. */
export function centreOf(m: MountedEditor, element: Element | null | undefined): Point {
  const rect = element?.getBoundingClientRect();
  if (!rect) throw new Error('no element to point at');
  return relativeToEditor(m, rect.left + rect.width / 2, rect.top + rect.height / 2);
}

export function gapBetween(m: MountedEditor, index: number): Point {
  const tokens = tokenElements(m);
  const left = tokens[index]?.getBoundingClientRect();
  const right = tokens[index + 1]?.getBoundingClientRect();
  if (!left || !right) throw new Error(`no gap after token ${index}`);
  return relativeToEditor(m, (left.right + right.left) / 2, left.top + left.height / 2);
}

export function afterLastToken(m: MountedEditor): Point {
  const tokens = tokenElements(m);
  const last = tokens[tokens.length - 1]?.getBoundingClientRect();
  if (!last) throw new Error('no tokens');
  const paragraph =
    m.pm.querySelector('p')?.getBoundingClientRect() ?? m.pm.getBoundingClientRect();
  return relativeToEditor(
    m,
    Math.min(last.right + 40, paragraph.right - 4),
    last.top + last.height / 2
  );
}

export function beforeFirstToken(m: MountedEditor): Point {
  const first = tokenElements(m)[0]?.getBoundingClientRect();
  if (!first) throw new Error('no tokens');
  return relativeToEditor(m, first.left - 3, first.top + first.height / 2);
}

export interface CaretLocation {
  /** The selection is a caret (not a range) in the text flow, not inside a token. */
  collapsed: boolean;
  tokensBefore: number;
  tokensAfter: number;
  tokensSelected: number;
  /** Text in the same paragraph before / after the caret, without separators or token chrome. */
  textBefore: string;
  textAfter: string;
}

export function caretLocation(m: MountedEditor): CaretLocation {
  const { selection, doc } = m.editor.state;
  const { $from } = selection;
  let tokensBefore = 0;
  let tokensAfter = 0;
  let tokensSelected = 0;
  doc.descendants((node, pos) => {
    if (node.type.name === 'filterToken') {
      if (pos + node.nodeSize <= selection.from) tokensBefore += 1;
      else if (pos >= selection.to) tokensAfter += 1;
      else if (!selection.empty && pos >= selection.from && pos + node.nodeSize <= selection.to) {
        tokensSelected += 1;
      }
    }
    return true;
  });
  const paragraph = $from.parent;
  const offset = $from.parentOffset;
  const textOf = (from: number, to: number) =>
    paragraph.textBetween(from, to, '', '').replace(/​/g, '');
  return {
    collapsed: selection.empty,
    tokensBefore,
    tokensAfter,
    tokensSelected,
    textBefore: textOf(0, offset),
    textAfter: textOf(offset, paragraph.content.size),
  };
}

async function frame(pm: HTMLElement): Promise<string> {
  return page.screenshot({ element: pm, save: false, base64: true, caret: 'initial' });
}

/**
 * Moves the pointer to the bottom-right corner of the viewport, away from the editor. A
 * pointer left over the editor hovers whatever moves under it: WebKit updates hover on a
 * timer after layout changes, so a token that slides under the pointer (after the token
 * before it is removed) starts its hover transition at an unpredictable moment.
 *
 * After a tap there is no pointer to move away, and moving the mouse would only clear the
 * hover that the tap left on the tapped element until Chromium restores it on a timer.
 */
async function movePointerOffEditor(): Promise<void> {
  if (lastPressPointerType === 'touch') return;
  await userEvent.hover(document.documentElement, {
    position: { x: window.innerWidth - 1, y: window.innerHeight - 1 },
  });
}

interface PaintedRect {
  left: number;
  right: number;
  top: number;
  bottom: number;
}

async function decode(base64: string): Promise<ImageData> {
  const blob = await (await fetch(`data:image/png;base64,${base64}`)).blob();
  const bitmap = await createImageBitmap(blob);
  const canvas = new OffscreenCanvas(bitmap.width, bitmap.height);
  const context = canvas.getContext('2d');
  if (!context) throw new Error('no 2d context to decode a frame');
  context.drawImage(bitmap, 0, 0);
  return context.getImageData(0, 0, bitmap.width, bitmap.height);
}

/**
 * How far a channel has to change for a pixel to count as painted. Chromium re-rasterises
 * anti-aliased edges elsewhere in the editor by a level or two between frames.
 */
const PAINT_DELTA = 48;

/** The client rect of the pixels that clearly differ between two frames, or null. */
async function paintedRect(
  element: HTMLElement,
  before: string,
  after: string
): Promise<PaintedRect | null> {
  const [a, b] = await Promise.all([decode(before), decode(after)]);
  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;
  for (let y = 0; y < a.height; y += 1) {
    for (let x = 0; x < a.width; x += 1) {
      const i = (y * a.width + x) * 4;
      let delta = 0;
      for (let channel = i; channel < i + 3; channel += 1) {
        delta = Math.max(delta, Math.abs((a.data[channel] ?? 0) - (b.data[channel] ?? 0)));
      }
      if (delta >= PAINT_DELTA) {
        minX = Math.min(minX, x);
        maxX = Math.max(maxX, x);
        minY = Math.min(minY, y);
        maxY = Math.max(maxY, y);
      }
    }
  }
  if (maxX < 0) return null;
  const box = element.getBoundingClientRect();
  const scale = a.width / box.width;
  return {
    left: box.left + minX / scale,
    right: box.left + (maxX + 1) / scale,
    top: box.top + minY / scale,
    bottom: box.top + (maxY + 1) / scale,
  };
}

/**
 * `Range.getClientRects()` is empty for a caret at an element boundary even though the
 * browser draws it, so this compares a frame with `caret-color: transparent` against
 * frames with an opaque caret. The caret blinks, so frames are sampled until one differs.
 * Returns where the caret was painted.
 */
export async function expectCaretPainted(m: MountedEditor): Promise<PaintedRect> {
  await movePointerOffEditor();
  await finishAnimations();
  expect(document.activeElement).toBe(m.pm);
  const previous = m.pm.style.caretColor;
  try {
    m.pm.style.caretColor = 'transparent';
    await settle();
    const hidden = await frame(m.pm);
    expect(
      await paintedRect(m.pm, hidden, await frame(m.pm)),
      'baseline frame is stable'
    ).toBeNull();
    m.pm.style.caretColor = 'red';
    return await vi.waitFor(
      async () => {
        const painted = await paintedRect(m.pm, hidden, await frame(m.pm));
        if (painted === null) throw new Error('no caret is painted');
        return painted;
      },
      { timeout: 2500, interval: 80 }
    );
  } finally {
    m.pm.style.caretColor = previous;
  }
}

export function editingTokenIndex(m: MountedEditor): number {
  return tokenElements(m).findIndex((token) => token.dataset.focused === 'true');
}

export async function expectCaretBetween(
  m: MountedEditor,
  expected: { tokensBefore: number; tokensAfter: number }
): Promise<void> {
  expect(document.activeElement).toBe(m.pm);
  const caret = caretLocation(m);
  expect(caret.collapsed).toBe(true);
  expect({ tokensBefore: caret.tokensBefore, tokensAfter: caret.tokensAfter }).toEqual(expected);
  const painted = await expectCaretPainted(m);
  expectPaintedBesideTokens(m, painted, expected.tokensBefore);
}

const sameRow = (a: PaintedRect, b: DOMRect) => a.top < b.bottom && a.bottom > b.top;

/**
 * The caret is painted on no token, and on the row of a neighbouring token it is painted
 * on that token's side: after the token before it, before the token after it.
 */
function expectPaintedBesideTokens(
  m: MountedEditor,
  painted: PaintedRect,
  tokensBefore: number
): void {
  const rects = tokenElements(m).map((token) => token.getBoundingClientRect());
  const show = (rect: PaintedRect | DOMRect) =>
    `[${rect.left.toFixed(1)}..${rect.right.toFixed(1)}] x [${rect.top.toFixed(1)}..${rect.bottom.toFixed(1)}]`;
  const where = `caret painted at ${show(painted)}; tokens at ${rects.map(show).join(', ')}`;
  rects.forEach((rect, index) => {
    const overlaps =
      sameRow(painted, rect) && painted.left < rect.right && painted.right > rect.left;
    expect(overlaps, `caret overlaps token ${index}: ${where}`).toBe(false);
  });
  const before = rects[tokensBefore - 1];
  if (before && sameRow(painted, before)) {
    expect(
      painted.left,
      `caret is not after token ${tokensBefore - 1}: ${where}`
    ).toBeGreaterThanOrEqual(before.right);
  }
  const after = rects[tokensBefore];
  if (after && sameRow(painted, after)) {
    expect(
      painted.right,
      `caret is not before token ${tokensBefore}: ${where}`
    ).toBeLessThanOrEqual(after.left);
  }
}

/** Arrow keys step through a token's own controls before leaving it, so crossing takes several presses. */
export async function pressUntil(key: string, reached: () => boolean, limit = 20): Promise<number> {
  for (let presses = 1; presses <= limit; presses += 1) {
    await userEvent.keyboard(key);
    if (reached()) return presses;
  }
  throw new Error(`${key} did not reach the target within ${limit} presses`);
}
