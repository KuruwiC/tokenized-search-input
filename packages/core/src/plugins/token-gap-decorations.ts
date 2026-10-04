/**
 * A caret between two tokens, or between a token and the paragraph edge, has no text to
 * sit in, and browsers do not draw a caret at such a position on their own. Each of these
 * positions gets a zero-width widget that gives the caret something to stand beside. The
 * widgets have no document positions; the visual spacing between tokens comes from CSS.
 *
 * The widgets are also what a press between two tokens lands on: each one's hit area
 * (a CSS pseudo-element) covers the spacing on both sides of it, and a press on it is
 * resolved to the widget's position (see {@link gapPosAtCoords}).
 *
 * While an input method is composing, the widgets are only mapped: rebuilding them could
 * remove the one beside the text being composed and disturb the composition. They are
 * rebuilt once the view has finished composing.
 */

import { Extension } from '@tiptap/core';
import type { Node as ProseMirrorNode } from '@tiptap/pm/model';
import { Plugin, PluginKey } from '@tiptap/pm/state';
import { Decoration, DecorationSet, type EditorView } from '@tiptap/pm/view';
import { isCompositionTransaction } from './shared/meta';

const ZERO_WIDTH_SPACE = '​';
const GAP_CLASS = '_tsi-token-gap';

interface TokenGapState {
  set: DecorationSet;
  /** The set was mapped through a composition and has not been rebuilt since. */
  stale: boolean;
}

const REBUILD = 'rebuild';

export const tokenGapKey = new PluginKey<TokenGapState>('tokenGap');

function isInlineAtom(node: ProseMirrorNode | null): boolean {
  return node?.isInline === true && !node.isText;
}

/** Positions inside textblocks where neither neighbour is text and at least one is an atom. */
function findTokenGaps(doc: ProseMirrorNode): number[] {
  const gaps: number[] = [];
  doc.descendants((block, blockPos) => {
    if (!block.isTextblock) return true;
    let before: ProseMirrorNode | null = null;
    let pos = blockPos + 1;
    const visit = (after: ProseMirrorNode | null) => {
      const bothSidesFree =
        (before === null || isInlineAtom(before)) && (after === null || isInlineAtom(after));
      if (bothSidesFree && (isInlineAtom(before) || isInlineAtom(after))) gaps.push(pos);
    };
    block.forEach((child) => {
      visit(child);
      before = child;
      pos += child.nodeSize;
    });
    visit(null);
    return false;
  });
  return gaps;
}

function respondToPresses(): void {}

function renderGap(): HTMLElement {
  const anchor = document.createElement('span');
  anchor.className = GAP_CLASS;
  anchor.textContent = ZERO_WIDTH_SPACE;
  // Chromium moves a tap to the nearest element that listens for mouse presses, and the
  // editor around the gap is not a candidate because it contains the tokens' controls.
  // Without a listener of its own, a tap in the gap would go to the delete button of the
  // token before it or into the token after it. The press itself is handled by the
  // selection guard on the editor.
  anchor.addEventListener('mousedown', respondToPresses, { passive: true });
  return anchor;
}

/**
 * The position of the gap widget under the pointer, or null when the pointer is not over
 * one. Browsers do not resolve a point over a non-editable widget to its position
 * (WebKit gives the start of the paragraph), so the position is read from the widget.
 */
export function gapPosAtCoords(
  view: EditorView,
  coords: { left: number; top: number }
): number | null {
  const element = view.dom.ownerDocument.elementFromPoint(coords.left, coords.top);
  const gap = element?.closest(`.${GAP_CLASS}`);
  if (!gap || !view.dom.contains(gap)) return null;
  return view.posAtDOM(gap, 0);
}

function buildGapDecorations(doc: ProseMirrorNode): DecorationSet {
  return DecorationSet.create(
    doc,
    findTokenGaps(doc).map((pos) =>
      Decoration.widget(pos, renderGap, { side: -1, key: `gap:${pos}` })
    )
  );
}

function rebuildAfterComposition(view: EditorView): void {
  if (view.composing || !tokenGapKey.getState(view.state)?.stale) return;
  view.dispatch(view.state.tr.setMeta(tokenGapKey, REBUILD));
}

export function createTokenGapPlugin(): Plugin<TokenGapState> {
  return new Plugin<TokenGapState>({
    key: tokenGapKey,
    state: {
      init: (_, state) => ({ set: buildGapDecorations(state.doc), stale: false }),
      apply: (tr, value) => {
        if (isCompositionTransaction(tr)) {
          return tr.docChanged ? { set: value.set.map(tr.mapping, tr.doc), stale: true } : value;
        }
        if (tr.docChanged || tr.getMeta(tokenGapKey) === REBUILD) {
          return { set: buildGapDecorations(tr.doc), stale: false };
        }
        return value;
      },
    },
    view: (view) => {
      rebuildAfterComposition(view);
      return { update: rebuildAfterComposition };
    },
    props: {
      decorations: (state) => tokenGapKey.getState(state)?.set,
    },
  });
}

export const TokenGapExtension = Extension.create({
  name: 'tokenGap',

  addProseMirrorPlugins() {
    return [createTokenGapPlugin()];
  },
});
