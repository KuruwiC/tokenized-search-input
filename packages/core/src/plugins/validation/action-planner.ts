import type { Node as ProseMirrorNode } from '@tiptap/pm/model';
import { shouldDeleteNow } from './deletion-planner';
import type { TokenAction, ValidationPlan, ValidationSnapshot } from './types';

export function buildPlan(snap: ValidationSnapshot, doc: ProseMirrorNode): ValidationPlan {
  const actions: TokenAction[] = [];
  const pendingDeletes = new Set<number>();
  const invalidPositions = new Set<number>();

  const deleteNow = shouldDeleteNow(snap);

  // Delete orphaned empty tokens (left over from undo or cancelled creation)
  // These are empty tokens that are NOT currently being edited (not focused or just-blurred)
  // This runs independently of deleteNow - orphaned empty tokens should always be cleaned up
  // Note: These deletions are marked as isOrphanedEmpty so they are excluded from history
  if (!snap.isHistoryOperation) {
    for (const token of snap.tokens) {
      // Skip if token has a value
      if (token.value) continue;
      // Skip if this is the currently focused token (being edited)
      if (token.pos === snap.focus.currentPos) continue;
      // Skip if this was just blurred (might still be in the process of being filled)
      if (token.pos === snap.focus.previousPos) continue;
      // Skip if this is a newly created token (still in creation flow)
      if (snap.newTokenIds.has(token.id)) continue;

      const node = doc.nodeAt(token.pos);
      if (node) {
        actions.push({
          type: 'delete',
          pos: token.pos,
          nodeSize: node.nodeSize,
          isOrphanedEmpty: true,
        });
        pendingDeletes.add(token.pos);
      }
    }
  }

  // Collect delete actions from violations
  for (const violation of snap.violations) {
    if (violation.action !== 'delete') continue;
    if (!deleteNow) continue;

    for (const target of violation.targets) {
      if (pendingDeletes.has(target.pos)) continue;

      // Never delete the currently focused token (the token being created/edited)
      if (target.pos === snap.focus.currentPos) continue;

      const node = doc.nodeAt(target.pos);
      if (node) {
        actions.push({ type: 'delete', pos: target.pos, nodeSize: node.nodeSize });
        pendingDeletes.add(target.pos);
      }
    }
  }

  // Third pass: collect invalid positions for marking
  for (const violation of snap.violations) {
    for (const target of violation.targets) {
      invalidPositions.add(target.pos);
    }
  }

  // Fourth pass: mark/clear actions
  for (const token of snap.tokens) {
    if (pendingDeletes.has(token.pos)) continue;

    const isInvalid = invalidPositions.has(token.pos);

    if (isInvalid) {
      // Find the violation for this token to get the reason
      const violation = snap.violations.find((v) => v.targets.some((t) => t.pos === token.pos));
      actions.push({ type: 'mark', pos: token.pos, reason: violation?.reason });
    } else {
      // Clear mark if previously marked
      const node = doc.nodeAt(token.pos);
      if (node?.attrs?.invalid) {
        actions.push({ type: 'clear', pos: token.pos });
      }
    }
  }

  return { actions };
}
