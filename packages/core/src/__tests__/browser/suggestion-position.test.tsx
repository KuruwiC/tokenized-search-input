import { render } from '@testing-library/react';
import type { Editor } from '@tiptap/core';
import { createRef } from 'react';
import { describe, expect, it } from 'vitest';
import { userEvent } from 'vitest/browser';
import { TokenizedSearchInput, type TokenizedSearchInputRef } from '../../index';
import { resolveAnchorPos, suggestionKey } from '../../plugins/suggestion';
import { fields, waitForFrames } from './harness';

const WORDS = Array.from({ length: 30 }, () => 'lorem').join(' ');

interface OpenSuggestion {
  frame: HTMLElement;
  container: HTMLElement;
  pm: HTMLElement;
  overlay: () => HTMLElement;
  /** Where the suggestion belongs: under its anchor, held inside the container. */
  expectedLeft: () => number;
}

function anchorLeft(editor: Editor, container: HTMLElement): number {
  const pos = resolveAnchorPos(
    editor.state.doc,
    suggestionKey.getState(editor.state)?.anchor ?? null
  );
  if (pos === null) throw new Error('the suggestion has no anchor');
  return editor.view.coordsAtPos(pos).left - container.getBoundingClientRect().left;
}

/**
 * A single-line editor 500px wide whose text overflows it, with the field suggestions
 * open for `st` typed after the third word: far enough from both edges that a 60px scroll
 * moves the suggestion without the container's edges holding it back.
 */
async function openSuggestionInScrollingInput(): Promise<OpenSuggestion> {
  const ref = createRef<TokenizedSearchInputRef>();
  const rendered = render(
    <div data-testid="frame" style={{ width: '500px' }}>
      <TokenizedSearchInput ref={ref} fields={fields} defaultValue={WORDS} singleLine />
    </div>
  );
  const frame = rendered.container.querySelector<HTMLElement>('[data-testid="frame"]');
  const container = rendered.container.querySelector<HTMLElement>('.tsi-container');
  const pm = rendered.container.querySelector<HTMLElement>('.ProseMirror');
  const editor = ref.current?.getEditor();
  if (!frame || !container || !pm || !editor) throw new Error('editor did not render');
  expect(pm.scrollWidth).toBeGreaterThan(pm.clientWidth);

  const afterThirdWord = 1 + 'lorem '.length * 2 + 'lorem'.length;
  editor.commands.focus();
  editor.commands.setTextSelection(afterThirdWord);
  pm.scrollLeft = 0;
  await userEvent.keyboard(' st');

  const overlay = () => {
    const element = document.querySelector<HTMLElement>('[data-suggestion-root]');
    if (!element) throw new Error('no suggestion is open');
    return element;
  };
  await waitForFrames(() => overlay());
  const expectedLeft = () => {
    const maxLeft = container.getBoundingClientRect().width - overlay().offsetWidth;
    return Math.max(0, Math.min(anchorLeft(editor, container), maxLeft));
  };
  pm.scrollLeft = 0;
  await waitForFrames(() => expect(overlayLeft(overlay())).toBeCloseTo(expectedLeft(), 0));
  return { frame, container, pm, overlay, expectedLeft };
}

function overlayLeft(element: HTMLElement): number {
  return Number.parseFloat(element.style.left);
}

describe('suggestion position', () => {
  it('follows its anchor when the single-line input scrolls', async () => {
    const { pm, overlay, expectedLeft } = await openSuggestionInScrollingInput();
    const before = overlayLeft(overlay());

    pm.scrollLeft = 60;

    await waitForFrames(() => expect(overlayLeft(overlay())).toBeLessThan(before - 30));
    expect(overlayLeft(overlay())).toBeCloseTo(expectedLeft(), 0);
  });

  it('stays within the container when the container narrows', async () => {
    const { frame, container, overlay, expectedLeft } = await openSuggestionInScrollingInput();
    const before = overlayLeft(overlay());

    frame.style.width = '320px';

    await waitForFrames(() => expect(overlayLeft(overlay())).toBeLessThan(before));
    expect(overlayLeft(overlay())).toBeLessThanOrEqual(
      container.getBoundingClientRect().width - overlay().offsetWidth
    );
    expect(overlayLeft(overlay())).toBeCloseTo(expectedLeft(), 0);
  });
});
