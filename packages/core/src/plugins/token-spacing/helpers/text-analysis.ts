import type { Node as ProseMirrorNode } from '@tiptap/pm/model';
import { isText } from '../../../utils/node-predicates';

/**
 * Find positions where adjacent text nodes need a space separator.
 * This handles the case where token deletion causes text nodes to become adjacent.
 *
 * INVARIANT: Adjacent text nodes must be separated by a space.
 *
 * @returns Array of positions where space should be inserted
 */
export function findAdjacentTextNodes(doc: ProseMirrorNode): number[] {
  const insertPositions: number[] = [];

  doc.descendants((node, pos) => {
    if (node.type.name === 'paragraph') {
      let currentPos = pos + 1;
      let prevWasText = false;
      let prevEndPos = currentPos;
      let prevTextContent = '';

      node.forEach((child) => {
        const isTextNode = isText(child);

        if (isTextNode && prevWasText) {
          const currentTextContent = child.textContent;
          const prevEndsWithSpace = prevTextContent.endsWith(' ');
          const currentStartsWithSpace = currentTextContent.startsWith(' ');

          if (!prevEndsWithSpace && !currentStartsWithSpace) {
            insertPositions.push(prevEndPos);
          }
        }

        prevWasText = isTextNode;
        prevTextContent = isTextNode ? child.textContent : '';
        prevEndPos = currentPos + child.nodeSize;
        currentPos = prevEndPos;
      });

      return false;
    }
    return true;
  });

  return insertPositions;
}
