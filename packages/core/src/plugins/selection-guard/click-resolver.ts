import type { Node as ProseMirrorNode, ResolvedPos } from '@tiptap/pm/model';
import type { Transaction } from '@tiptap/pm/state';
import { insertSpacer } from '../../spacer';
import { isGenericInlineContent, isSpacer, isToken } from '../../utils/node-predicates';

export interface SpacerClickResolution {
  targetPos: number;
  spacerInserted: boolean;
}

interface BoundaryContext {
  $pos: ResolvedPos;
  nodeBefore: ProseMirrorNode | null;
  nodeAfter: ProseMirrorNode | null;
  beforeIsSpacer: boolean;
  afterIsSpacer: boolean;
}

export function resolveSpacerClickTarget(
  doc: ProseMirrorNode,
  pos: number,
  tr: Transaction | null,
  options: { allowSpacerInsertion: boolean }
): SpacerClickResolution | null {
  try {
    const $pos = doc.resolve(pos);
    const nodeBefore = $pos.nodeBefore;
    const nodeAfter = $pos.nodeAfter;

    const beforeIsSpacer = nodeBefore !== null && isSpacer(nodeBefore);
    const afterIsSpacer = nodeAfter !== null && isSpacer(nodeAfter);

    if (!beforeIsSpacer && !afterIsSpacer) {
      return null;
    }

    const ctx: BoundaryContext = {
      $pos,
      nodeBefore,
      nodeAfter,
      beforeIsSpacer,
      afterIsSpacer,
    };

    return resolveFromContext(doc, pos, tr, ctx, options);
  } catch {
    return null;
  }
}

function resolveFromContext(
  doc: ProseMirrorNode,
  pos: number,
  tr: Transaction | null,
  ctx: BoundaryContext,
  options: { allowSpacerInsertion: boolean }
): SpacerClickResolution {
  const { $pos, nodeBefore, nodeAfter, beforeIsSpacer, afterIsSpacer } = ctx;

  // Case 1: Between two spacers - stay at current position
  if (beforeIsSpacer && afterIsSpacer) {
    return { targetPos: pos, spacerInserted: false };
  }

  // Case 2: Spacer is before the position
  if (beforeIsSpacer && nodeBefore) {
    return resolveSpacerBefore(doc, pos, tr, $pos, nodeBefore, nodeAfter, options);
  }

  // Case 3: Spacer is after the position
  if (afterIsSpacer && nodeAfter) {
    return resolveSpacerAfter(doc, pos, tr, $pos, nodeBefore, nodeAfter, options);
  }

  // Fallback: stay at current position
  return { targetPos: pos, spacerInserted: false };
}

function resolveSpacerBefore(
  doc: ProseMirrorNode,
  pos: number,
  tr: Transaction | null,
  $pos: ResolvedPos,
  nodeBefore: ProseMirrorNode,
  nodeAfter: ProseMirrorNode | null,
  options: { allowSpacerInsertion: boolean }
): SpacerClickResolution {
  const beforeSpacerPos = pos - nodeBefore.nodeSize;

  try {
    const $beforeSpacer = doc.resolve(beforeSpacerPos);
    const nodeBeforeSpacer = $beforeSpacer.nodeBefore;

    // Token before the spacer
    if (nodeBeforeSpacer && isToken(nodeBeforeSpacer)) {
      // Check what's after the current position
      if (nodeAfter && isSpacer(nodeAfter)) {
        // [token][spacer]|[spacer] - between token and next spacer
        return { targetPos: pos, spacerInserted: false };
      }

      if (!nodeAfter || nodeAfter.type.name === 'paragraph') {
        // [token][spacer]| at end - move to paragraph end
        return { targetPos: $pos.end(), spacerInserted: false };
      }

      if (isToken(nodeAfter) && options.allowSpacerInsertion && tr) {
        // [token][spacer]|[token] - insert spacer between tokens
        insertSpacer(tr, doc.type.schema, pos);
        return { targetPos: pos, spacerInserted: true };
      }

      // Generic inline content (text, etc.) after click position - stay at click position
      if (nodeAfter && isGenericInlineContent(nodeAfter)) {
        return { targetPos: pos, spacerInserted: false };
      }

      // Other cases: move to paragraph end
      return { targetPos: $pos.end(), spacerInserted: false };
    }

    // No node before spacer (at paragraph start)
    if (!nodeBeforeSpacer) {
      return { targetPos: $pos.start(), spacerInserted: false };
    }

    // Generic inline content before spacer - stay at click position
    if (isGenericInlineContent(nodeBeforeSpacer)) {
      return { targetPos: pos, spacerInserted: false };
    }

    // Something else before spacer - move before the spacer
    return { targetPos: pos - nodeBefore.nodeSize, spacerInserted: false };
  } catch {
    // Position resolution failed - fall back to current position
    return { targetPos: pos, spacerInserted: false };
  }
}

function resolveSpacerAfter(
  doc: ProseMirrorNode,
  pos: number,
  tr: Transaction | null,
  $pos: ResolvedPos,
  nodeBefore: ProseMirrorNode | null,
  nodeAfter: ProseMirrorNode,
  options: { allowSpacerInsertion: boolean }
): SpacerClickResolution {
  const afterSpacerPos = pos + nodeAfter.nodeSize;

  try {
    const $afterSpacer = doc.resolve(afterSpacerPos);
    const nodeAfterSpacer = $afterSpacer.nodeAfter;

    // Token after the spacer
    if (nodeAfterSpacer && isToken(nodeAfterSpacer)) {
      // Check what's before the current position
      if (nodeBefore && isSpacer(nodeBefore)) {
        // [spacer]|[spacer][token] - between spacers
        return { targetPos: pos, spacerInserted: false };
      }

      if (!nodeBefore) {
        // |[spacer][token] at start - move to paragraph start
        return { targetPos: $pos.start(), spacerInserted: false };
      }

      if (isToken(nodeBefore) && options.allowSpacerInsertion && tr) {
        // [token]|[spacer][token] - insert spacer between tokens
        insertSpacer(tr, doc.type.schema, pos);
        return { targetPos: pos, spacerInserted: true };
      }

      // Generic inline content (text, etc.) before click position - stay at click position
      if (nodeBefore && isGenericInlineContent(nodeBefore)) {
        return { targetPos: pos, spacerInserted: false };
      }

      // Other cases: move to paragraph start
      return { targetPos: $pos.start(), spacerInserted: false };
    }

    // No node after spacer (at paragraph end)
    if (!nodeAfterSpacer) {
      return { targetPos: $pos.end(), spacerInserted: false };
    }

    // Generic inline content after spacer - stay at click position
    if (isGenericInlineContent(nodeAfterSpacer)) {
      return { targetPos: pos, spacerInserted: false };
    }

    // Something else after spacer - move after the spacer
    return { targetPos: pos + nodeAfter.nodeSize, spacerInserted: false };
  } catch {
    // Position resolution failed - fall back to current position
    return { targetPos: pos, spacerInserted: false };
  }
}

/**
 * Selection direction determines token inclusion:
 * - Forward (anchor <= clickPos): Include clicked token by using its end
 * - Backward (anchor > clickPos): Include clicked token by using its start
 */
export function calculateShiftClickHead(
  doc: ProseMirrorNode,
  clickPos: number,
  anchor: number,
  clickedOnToken: boolean
): number | null {
  try {
    const $pos = doc.resolve(clickPos);
    const nodeBefore = $pos.nodeBefore;
    const nodeAfter = $pos.nodeAfter;

    const beforeIsSpacer = nodeBefore && isSpacer(nodeBefore);
    const afterIsSpacer = nodeAfter && isSpacer(nodeAfter);
    const beforeIsToken = nodeBefore && isToken(nodeBefore);
    const afterIsToken = nodeAfter && isToken(nodeAfter);

    // Not on spacer or token boundary - let ProseMirror handle
    if (!beforeIsSpacer && !afterIsSpacer && !beforeIsToken && !afterIsToken) {
      return null;
    }

    // Only include adjacent token if the user clicked on a token
    if (clickedOnToken) {
      // Forward selection: include token after click position
      if (anchor <= clickPos && afterIsToken && nodeAfter) {
        return clickPos + nodeAfter.nodeSize;
      }
      // Backward selection: include token before click position
      if (anchor > clickPos && beforeIsToken && nodeBefore) {
        return clickPos - nodeBefore.nodeSize;
      }
    }

    // Clicked on spacer, or no token to include
    return clickPos;
  } catch {
    return null;
  }
}
