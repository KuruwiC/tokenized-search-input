import type { Node as ProseMirrorNode } from '@tiptap/pm/model';
import type { TextNodeInfo } from './types';

export function collectTokenizableTextNodes(
  doc: ProseMirrorNode,
  cursorPos: number,
  forceCursorText: boolean
): TextNodeInfo[] {
  const textNodes: TextNodeInfo[] = [];

  doc.descendants((node, pos) => {
    if (!node.isText || !node.text) return true;

    const text = node.text.trim();
    if (!text) return true;

    const nodeEnd = pos + node.nodeSize;
    const containsCursor = cursorPos > pos && cursorPos <= nodeEnd;

    // Skip text node containing cursor unless forced (paste/bulk insert)
    if (containsCursor && !forceCursorText) return true;

    textNodes.push({
      pos,
      nodeEnd,
      text: node.text,
      containsCursor,
    });

    return true;
  });

  return textNodes;
}
