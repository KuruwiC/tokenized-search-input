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

/** Resolves once every running CSS animation (the token insert animation) has finished. */
export async function waitForAnimations(): Promise<void> {
  await vi.waitFor(() => expect(document.getAnimations()).toHaveLength(0));
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
  await waitForAnimations();
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
 */
async function movePointerOffEditor(): Promise<void> {
  await userEvent.hover(document.documentElement, {
    position: { x: window.innerWidth - 1, y: window.innerHeight - 1 },
  });
}

/**
 * `Range.getClientRects()` is empty for a caret at an element boundary even though the
 * browser draws it, so this compares a frame with `caret-color: transparent` against
 * frames with an opaque caret. The caret blinks, so frames are sampled until one differs.
 */
export async function expectCaretPainted(m: MountedEditor): Promise<void> {
  await movePointerOffEditor();
  await waitForAnimations();
  expect(document.activeElement).toBe(m.pm);
  const previous = m.pm.style.caretColor;
  try {
    m.pm.style.caretColor = 'transparent';
    await settle();
    const hidden = await frame(m.pm);
    expect(await frame(m.pm), 'baseline frame is stable').toBe(hidden);
    m.pm.style.caretColor = 'red';
    await vi.waitFor(
      async () => {
        expect(await frame(m.pm)).not.toBe(hidden);
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
  await expectCaretPainted(m);
}

/** Arrow keys step through a token's own controls before leaving it, so crossing takes several presses. */
export async function pressUntil(key: string, reached: () => boolean, limit = 20): Promise<number> {
  for (let presses = 1; presses <= limit; presses += 1) {
    await userEvent.keyboard(key);
    if (reached()) return presses;
  }
  throw new Error(`${key} did not reach the target within ${limit} presses`);
}
