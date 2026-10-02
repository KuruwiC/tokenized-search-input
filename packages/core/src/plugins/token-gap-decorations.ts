/**
 * Token Gap Decorations
 *
 * A caret between two tokens, or between a token and the paragraph edge, has no text to
 * sit in, and browsers do not draw a caret at such a position on their own. Each of these
 * positions gets a zero-width widget that gives the caret something to stand beside. The
 * widgets have no document positions; the visual spacing between tokens comes from CSS.
 */

import { Extension } from '@tiptap/core';
import type { Node as ProseMirrorNode } from '@tiptap/pm/model';
import { Plugin, PluginKey } from '@tiptap/pm/state';
import { Decoration, DecorationSet } from '@tiptap/pm/view';

const ZERO_WIDTH_SPACE = '​';
const GAP_CLASS = '_tsi-token-gap';

export const tokenGapKey = new PluginKey<DecorationSet>('tokenGap');

function isInlineAtom(node: ProseMirrorNode | null): boolean {
  return node?.isInline === true && !node.isText;
}

/** Positions inside textblocks where neither neighbour is text and at least one is an atom. */
export function findTokenGaps(doc: ProseMirrorNode): number[] {
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

function renderGap(): HTMLElement {
  const anchor = document.createElement('span');
  anchor.className = GAP_CLASS;
  anchor.textContent = ZERO_WIDTH_SPACE;
  return anchor;
}

function buildGapDecorations(doc: ProseMirrorNode): DecorationSet {
  return DecorationSet.create(
    doc,
    findTokenGaps(doc).map((pos) =>
      Decoration.widget(pos, renderGap, { side: -1, key: `gap:${pos}` })
    )
  );
}

export function createTokenGapPlugin(): Plugin<DecorationSet> {
  return new Plugin<DecorationSet>({
    key: tokenGapKey,
    state: {
      init: (_, state) => buildGapDecorations(state.doc),
      apply: (tr, set) => (tr.docChanged ? buildGapDecorations(tr.doc) : set),
    },
    props: {
      decorations: (state) => tokenGapKey.getState(state),
    },
  });
}

export const TokenGapExtension = Extension.create({
  name: 'tokenGap',

  addProseMirrorPlugins() {
    return [createTokenGapPlugin()];
  },
});
