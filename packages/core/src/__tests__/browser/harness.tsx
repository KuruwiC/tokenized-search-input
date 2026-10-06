import '../../index.css';
import { cleanup, render } from '@testing-library/react';
import type { Editor } from '@tiptap/core';
import { createRef, type RefObject } from 'react';
import { afterEach, expect, onTestFinished } from 'vitest';
import { commands, page, server, userEvent } from 'vitest/browser';
import {
  type FieldDefinition,
  TokenizedSearchInput,
  type TokenizedSearchInputProps,
  type TokenizedSearchInputRef,
} from '../../index';
import { programEntry } from '../../plugins/token-focus';
import { enterToken } from '../../tokens/enter-token';

afterEach(cleanup);

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

/**
 * How long a wait for a state goes on: it gives up only once it has taken `frames` samples
 * and the last of them began `ms` after the first. A loaded machine can take seconds over
 * one frame, so a time budget alone can run out before the page has had a chance to change.
 */
export interface WaitBounds {
  frames: number;
  ms: number;
}

export function waitIsOver(bounds: WaitBounds, frames: number, elapsedMs: number): boolean {
  return frames >= bounds.frames && elapsedMs >= bounds.ms;
}

/** `check` throws until the state is reached; the wait gives up with its last error. */
async function waitAcrossFrames<T>(
  check: () => T | Promise<T>,
  next: () => Promise<void>,
  bounds: WaitBounds
): Promise<T> {
  const start = performance.now();
  for (let frames = 1; ; frames += 1) {
    const elapsedMs = performance.now() - start;
    try {
      return await check();
    } catch (error) {
      if (!waitIsOver(bounds, frames, elapsedMs)) {
        await next();
        continue;
      }
      if (error instanceof Error) {
        error.message += ` (${frames} frames over ${Math.round(performance.now() - start)} ms)`;
      }
      throw error;
    }
  }
}

/**
 * A second, in rendered frames (60 at 60 Hz) as well as in time: the first focus of an
 * editable can keep WebKit on Linux from rendering a frame for 1.5 s.
 */
const RENDERED_STATE: WaitBounds = { frames: 60, ms: 1000 };

export function waitForFrames<T>(check: () => T | Promise<T>): Promise<T> {
  return waitAcrossFrames(check, settle, RENDERED_STATE);
}

/** Adds a stylesheet after the library's for the rest of the test. */
export function addStyleSheet(css: string): void {
  const style = document.createElement('style');
  style.textContent = css;
  document.head.append(style);
  onTestFinished(() => style.remove());
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
  await waitForFrames(() => {
    expect(container.querySelectorAll('.tsi-token')).toHaveLength(expectedTokens);
  });
  await finishAnimations();
  const editor = ref.current?.getEditor();
  if (!editor) throw new Error('editor handle is unavailable');
  return { ref, editor, pm, value: () => ref.current?.getValue() ?? '' };
}

export interface Around {
  width?: string;
  variables?: Record<string, string>;
  attributes?: Record<string, string>;
}

export interface MountedAround extends MountedEditor {
  /** The element around the input, where a page sets its theme. */
  wrapper: HTMLElement;
  container: HTMLElement;
  input: HTMLElement;
}

/**
 * Mounts the editor and sets a width, CSS variables or attributes on the element around it,
 * where a page sets them, rather than on :root.
 */
export async function mountEditorAround(
  defaultValue: string,
  props: Partial<TokenizedSearchInputProps>,
  { width, variables = {}, attributes = {} }: Around
): Promise<MountedAround> {
  const m = await mountEditor(defaultValue, props);
  const wrapper = m.pm.closest('.tsi-root')?.parentElement;
  const container = m.pm.closest<HTMLElement>('.tsi-container');
  const input = m.pm.closest<HTMLElement>('.tsi-input');
  if (!wrapper || !container || !input) throw new Error('editor did not render');
  if (width) wrapper.style.width = width;
  for (const [name, value] of Object.entries(variables)) wrapper.style.setProperty(name, value);
  for (const [name, value] of Object.entries(attributes)) wrapper.setAttribute(name, value);
  await finishAnimations();
  return { ...m, wrapper, container, input };
}

/** Narrows the editor so that its first row holds the first token and `room` pixels after it. */
async function wrapAfterFirstToken(m: MountedAround, room: number): Promise<void> {
  const paragraph = m.pm.querySelector('p');
  const node = tokenElements(m)[0]?.closest('.tsi-token-node');
  if (!paragraph || !node) throw new Error('no first token to wrap after');
  const line = paragraph.getBoundingClientRect();
  const nodeRight =
    node.getBoundingClientRect().right + Number.parseFloat(getComputedStyle(node).marginRight);
  const slack = m.wrapper.getBoundingClientRect().width - line.width;
  m.wrapper.style.width = `${nodeRight + room - line.left + slack}px`;
  await finishAnimations();
}

/** Two or three characters fit in it, a token does not. */
export const WRAP_ROOM = 60;

/** Mounts the editor narrowed so that only the first token and {@link WRAP_ROOM} fit on its first row. */
export async function mountWrapped(
  value: string,
  props: Partial<TokenizedSearchInputProps> = {}
): Promise<MountedAround> {
  const m = await mountEditorAround(value, props, {});
  await wrapAfterFirstToken(m, WRAP_ROOM);
  return m;
}

/**
 * Tiptap's focus command focuses the view in the next animation frame, so a test that moves
 * focus elsewhere before that frame has it taken back. When the editor gains focus,
 * ProseMirror sets a 20 ms timer that writes its selection to the DOM again, undoing a native
 * caret move (End, an arrow key) that it has not read yet. Animation frame callbacks and
 * timers of the same delay run in the order they are requested, so both have run once ours
 * have.
 */
async function editorFocusSettled(m: MountedEditor): Promise<void> {
  await settle();
  await new Promise((resolve) => setTimeout(resolve, 20));
  expect(document.activeElement).toBe(m.pm);
}

export async function focusEditor(m: MountedEditor, position: 'start' | 'end'): Promise<void> {
  m.editor.commands.focus(position);
  await editorFocusSettled(m);
}

export async function placeCaret(m: MountedEditor, pos: number): Promise<void> {
  m.editor.chain().focus().setTextSelection(pos).run();
  await editorFocusSettled(m);
  await finishAnimations();
}

/**
 * Edits the last token the way code enters a token, with the caret at the end of its value.
 * The styling tests set up editing without a pointer press, so they do not depend on where
 * an engine puts the caret on a click.
 */
export async function editLastToken(m: MountedEditor): Promise<void> {
  let id: string | undefined;
  m.editor.state.doc.descendants((node) => {
    if (node.type.name === 'filterToken') id = String(node.attrs.id);
  });
  if (!id) throw new Error('no filter token to edit');
  enterToken(m.editor, id, programEntry());
  await waitForFrames(() => expect(document.activeElement).toBeInstanceOf(HTMLInputElement));
}

export function focusedValueInput(): HTMLInputElement {
  const input = document.activeElement;
  if (!(input instanceof HTMLInputElement)) throw new Error('no token input holds focus');
  return input;
}

/** The value text and the caret in it, as `val|ue`, or `v[al]ue` for a selection. */
export function shownValue(): string {
  const { value, selectionStart, selectionEnd } = focusedValueInput();
  const start = selectionStart ?? 0;
  const end = selectionEnd ?? 0;
  if (start === end) return `${value.slice(0, start)}|${value.slice(start)}`;
  return `${value.slice(0, start)}[${value.slice(start, end)}]${value.slice(end)}`;
}

export function radiusOf(element: Element): number {
  return Number.parseFloat(getComputedStyle(element).borderTopLeftRadius);
}

/**
 * Whether a point lies inside the rounded box of `element`, `inset` pixels in from its border
 * box (its border width, for the area that clips its content). Radii larger than half a side
 * are scaled down as CSS does, so a 9999px radius draws a stadium.
 */
export function insideRoundedBox(element: Element, x: number, y: number, inset = 0): boolean {
  const outer = element.getBoundingClientRect();
  const box = {
    left: outer.left + inset,
    right: outer.right - inset,
    top: outer.top + inset,
    bottom: outer.bottom - inset,
  };
  const scale = Math.min(
    1,
    outer.width / 2 / radiusOf(element),
    outer.height / 2 / radiusOf(element)
  );
  const radius = Math.max(0, radiusOf(element) * scale - inset);
  if (x < box.left || x > box.right || y < box.top || y > box.bottom) return false;
  const cx = Math.min(Math.max(x, box.left + radius), box.right - radius);
  const cy = Math.min(Math.max(y, box.top + radius), box.bottom - radius);
  return Math.hypot(x - cx, y - cy) <= radius;
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

/** A caret colour that nothing else in the editor is painted in. */
const CARET_COLOR = 'rgb(255, 0, 255)';
const isCaretPixel = (r: number, g: number, b: number) => r > 200 && g < 80 && b > 200;

/** The client rect of the caret-coloured pixels in a frame of `element`, or null. */
async function caretRectIn(element: HTMLElement, shot: string): Promise<PaintedRect | null> {
  const image = await decode(shot);
  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;
  for (let y = 0; y < image.height; y += 1) {
    for (let x = 0; x < image.width; x += 1) {
      const i = (y * image.width + x) * 4;
      if (isCaretPixel(image.data[i] ?? 0, image.data[i + 1] ?? 0, image.data[i + 2] ?? 0)) {
        minX = Math.min(minX, x);
        maxX = Math.max(maxX, x);
        minY = Math.min(minY, y);
        maxY = Math.max(maxY, y);
      }
    }
  }
  if (maxX < 0) return null;
  const box = element.getBoundingClientRect();
  const scale = image.width / box.width;
  return {
    left: box.left + minX / scale,
    right: box.left + (maxX + 1) / scale,
    top: box.top + minY / scale,
    bottom: box.top + (maxY + 1) / scale,
  };
}

/** Where the caret is painted in the current frame of the editor, or null. */
export async function paintedCaret(m: MountedEditor): Promise<PaintedRect | null> {
  return caretRectIn(m.pm, await frame(m.pm));
}

/**
 * Longer than one blink cycle of the caret in Chromium (1 s) and WebKit on macOS (about
 * 1.06 s), and as long as one in WebKit on Linux (600 ms on, 600 ms off).
 */
export const BLINK_CYCLE_MS = 1200;

const FRAME_INTERVAL_MS = 80;

/**
 * Ten frames {@link FRAME_INTERVAL_MS} apart span 720 ms, more than the 600 ms a caret blinks
 * off for in WebKit on Linux. Where frames come further apart than the caret stays on, each
 * finds a blinking caret with about even odds, so all ten miss it once in a thousand searches.
 * A blink cycle of quick frames finds a blinking caret, or a held one shown again at its next
 * blink.
 */
export const CARET_SEARCH: WaitBounds = { frames: 10, ms: BLINK_CYCLE_MS };

export function waitForPaintedCaret(m: MountedEditor): Promise<PaintedRect> {
  return waitAcrossFrames(
    async () => {
      const painted = await paintedCaret(m);
      if (!painted) throw new Error('no caret is painted');
      return painted;
    },
    () => new Promise((resolve) => setTimeout(resolve, FRAME_INTERVAL_MS)),
    CARET_SEARCH
  );
}

/**
 * Whether {@link holdCaretSteady} stops the blinking. WebKit on Linux (WPE and GTK) blinks its
 * caret with SimpleCaretAnimator, which recomputes its suspension from the system blink
 * setting on every blink and so drops the suspension a mouse press sets; WebKit on macOS
 * blinks it with OpacityCaretAnimator, which keeps it. The user agent of WebKit on Linux
 * claims a Mac, so the platform comes from the test server.
 */
export const caretHoldIsSteady =
  CSS.supports('caret-animation', 'manual') || server.platform === 'darwin';

/** Events of the press that holds the caret steady in WebKit, kept from the page. */
const HOLD_EVENTS = ['pointerdown', 'mousedown', 'pointerup', 'mouseup', 'click'] as const;

function swallowHoldEvent(event: Event): void {
  event.stopImmediatePropagation();
  // Keeps the press from moving focus or the selection out of the editor.
  if (event.type === 'mousedown') event.preventDefault();
}

/**
 * Keeps the caret of the focused editor from blinking until the returned function is
 * called, and paints it in {@link CARET_COLOR}. A blinking caret is missing from every
 * frame taken in its off phase, and how many frames fit in a time budget depends on how
 * busy the machine is.
 *
 * Chromium stops the blinking with `caret-animation: manual`. WebKit does not support that
 * property, but on macOS stops blinking off while a mouse button is held down, so the primary
 * button is held in the bottom-right corner of the viewport, away from the editor, with
 * its events kept from the page. Held there, the caret is shown again at its next blink
 * and then stays.
 */
export async function holdCaretSteady(m: MountedEditor): Promise<() => Promise<void>> {
  const style = m.pm.style;
  const previousColor = style.caretColor;
  style.caretColor = CARET_COLOR;
  if (CSS.supports('caret-animation', 'manual')) {
    style.setProperty('caret-animation', 'manual');
    await settle();
    return async () => {
      style.removeProperty('caret-animation');
      style.caretColor = previousColor;
    };
  }
  for (const type of HOLD_EVENTS) window.addEventListener(type, swallowHoldEvent, true);
  await userEvent.hover(document.documentElement, {
    position: { x: window.innerWidth - 1, y: window.innerHeight - 1 },
  });
  await commands.pressMouse();
  return async () => {
    await commands.releaseMouse();
    await settle();
    for (const type of HOLD_EVENTS) window.removeEventListener(type, swallowHoldEvent, true);
    style.caretColor = previousColor;
  };
}

/**
 * `Range.getClientRects()` is empty for a caret at an element boundary even though the
 * browser draws it, so the caret is found in a frame of the editor by its colour.
 * Returns where the caret was painted.
 */
export async function expectCaretPainted(m: MountedEditor): Promise<PaintedRect> {
  await finishAnimations();
  expect(document.activeElement).toBe(m.pm);
  const release = await holdCaretSteady(m);
  try {
    return await waitForPaintedCaret(m);
  } finally {
    await release();
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

/**
 * The caret is painted on the row of the text on its `side` (-1: the character before it,
 * 1: the character after it) and at that character's edge.
 */
export async function expectCaretWithText(m: MountedEditor, side: -1 | 1): Promise<void> {
  const { head } = m.editor.state.selection;
  const text = m.editor.view.coordsAtPos(head, side);
  const painted = await expectCaretPainted(m);
  const where = `caret painted at [${painted.left.toFixed(1)}..${painted.right.toFixed(1)}] x [${painted.top.toFixed(1)}..${painted.bottom.toFixed(1)}], text edge at ${text.left.toFixed(1)} x [${text.top.toFixed(1)}..${text.bottom.toFixed(1)}]`;
  expect(
    painted.top < text.bottom && painted.bottom > text.top,
    `not on the text's row: ${where}`
  ).toBe(true);
  expect(
    Math.abs(painted.left - text.left),
    `not at the text's edge: ${where}`
  ).toBeLessThanOrEqual(3);
}

/** Firefox leaves out a clipboardData given to the ClipboardEvent constructor. */
function clipboardEvent(type: 'copy' | 'paste', data: DataTransfer): Event {
  const event = new Event(type, { bubbles: true, cancelable: true });
  Object.defineProperty(event, 'clipboardData', { value: data });
  return event;
}

export function paste(m: MountedEditor, text: string): void {
  const data = new DataTransfer();
  data.setData('text/plain', text);
  m.pm.dispatchEvent(clipboardEvent('paste', data));
}

export function copied(m: MountedEditor): string {
  const data = new DataTransfer();
  m.pm.dispatchEvent(clipboardEvent('copy', data));
  return data.getData('text/plain');
}

/** Arrow keys step through a token's own controls before leaving it, so crossing takes several presses. */
export async function pressUntil(key: string, reached: () => boolean, limit = 20): Promise<number> {
  for (let presses = 1; presses <= limit; presses += 1) {
    await userEvent.keyboard(key);
    if (reached()) return presses;
  }
  throw new Error(`${key} did not reach the target within ${limit} presses`);
}
