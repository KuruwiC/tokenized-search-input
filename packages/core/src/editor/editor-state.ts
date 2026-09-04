import type { Editor } from '@tiptap/core';
import { isToken } from '../utils/node-predicates';

/** Returns whether the editor contains no user-visible text or tokens. */
export function isEditorEmpty(editor: Editor): boolean {
  const { doc } = editor.state;
  if (doc.childCount === 0) return true;
  if (doc.childCount > 1) return false;

  const firstChild = doc.firstChild;
  if (!firstChild) return true;
  if (firstChild.type.name !== 'paragraph') return false;
  if (firstChild.childCount === 0) return true;

  let hasContent = false;
  firstChild.forEach((node) => {
    if (isToken(node) || (node.type.name === 'text' && Boolean(node.text))) {
      hasContent = true;
    }
  });
  return !hasContent;
}
