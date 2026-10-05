/**
 * Zero-width widgets after the caret at positions next to tokens keep the caret painted
 * where text would go in. They have no document positions; the visual spacing between
 * tokens comes from CSS.
 *
 * Between two tokens, or between a token and the paragraph edge, there is no text to sit
 * in, and browsers draw no caret there on their own. Chromium and WebKit paint a caret
 * between two non-editable boxes at the start edge of the box after it, so it is painted
 * at the widget, in the middle of the spacing, rather than at the edge of the next token,
 * whose margin is part of that spacing.
 *
 * At the end of text before a token, the end of the text and the start of the token are
 * one DOM position, and where the row wraps between them Chromium paints the caret at the
 * start of the next row. No line break comes before a zero-width space, so the widget keeps
 * the caret on the text's row. Text after a token holds the caret on its own row.
 *
 * The widgets are also what a point next to a token hit-tests to: each one's hit area (a
 * CSS pseudo-element) covers the spacing beside it, and a press on it is resolved to the
 * widget's position (see {@link gapPosAtCoords}).
 *
 * While an input method is composing, no widget stands beside the text being composed:
 * ProseMirror redraws a widget there, and the hack nodes after one that ends the paragraph,
 * on every update of the composition, and WebKit on iOS abandons a commit that lands on such
 * a redraw. The other widgets are only mapped, and the set is rebuilt once the view has
 * finished composing.
 */

import { Extension } from '@tiptap/core';
import type { Node as ProseMirrorNode } from '@tiptap/pm/model';
import { Plugin, PluginKey, type Transaction } from '@tiptap/pm/state';
import { Decoration, DecorationSet, type EditorView } from '@tiptap/pm/view';
import { isCompositionTransaction } from './shared/meta';

const ZERO_WIDTH_SPACE = '​';
const GAP_CLASS = '_tsi-token-gap';
const AFTER_TEXT_CLASS = '_tsi-token-gap--after-text';

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

interface TokenGap {
  pos: number;
  afterText: boolean;
}

function findTokenGaps(doc: ProseMirrorNode): TokenGap[] {
  const gaps: TokenGap[] = [];
  doc.descendants((block, blockPos) => {
    if (!block.isTextblock) return true;
    let before: ProseMirrorNode | null = null;
    let pos = blockPos + 1;
    const visit = (after: ProseMirrorNode | null) => {
      if (isInlineAtom(after) || (isInlineAtom(before) && after?.isText !== true)) {
        gaps.push({ pos, afterText: before?.isText === true });
      }
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

function renderGap(afterText: boolean): HTMLElement {
  const anchor = document.createElement('span');
  anchor.className = afterText ? `${GAP_CLASS} ${AFTER_TEXT_CLASS}` : GAP_CLASS;
  anchor.textContent = ZERO_WIDTH_SPACE;
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
  // The root the editor is in: inside a shadow root the document hit-tests to the host.
  const element = view.root.elementFromPoint(coords.left, coords.top);
  const gap = element?.closest(`.${GAP_CLASS}`);
  if (!gap || !view.dom.contains(gap)) return null;
  return view.posAtDOM(gap, 0);
}

function buildGapDecorations(doc: ProseMirrorNode): DecorationSet {
  return DecorationSet.create(
    doc,
    findTokenGaps(doc).map(({ pos, afterText }) =>
      Decoration.widget(pos, () => renderGap(afterText), {
        side: 1,
        key: afterText ? `gap:${pos}:after-text` : `gap:${pos}`,
      })
    )
  );
}

function withoutWidgetsBesideChanges(set: DecorationSet, tr: Transaction): DecorationSet {
  const beside: Decoration[] = [];
  tr.mapping.maps.forEach((map, index) => {
    const rest = tr.mapping.slice(index + 1);
    map.forEach((_oldStart, _oldEnd, newStart, newEnd) => {
      beside.push(...set.find(rest.map(newStart, -1), rest.map(newEnd, 1)));
    });
  });
  return set.remove(beside);
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
          if (!tr.docChanged) return value;
          return {
            set: withoutWidgetsBesideChanges(value.set.map(tr.mapping, tr.doc), tr),
            stale: true,
          };
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
