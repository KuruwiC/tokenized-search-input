import type { Editor } from '@tiptap/core';
import { useEffect, useState } from 'react';
import { EDITOR_CONTEXT_UPDATED } from '../extensions/editor-context';

/** Re-render a node view when editor context storage changes without doc changes. */
export function useEditorContextUpdate(editor: Editor): number {
  const [version, setVersion] = useState(0);

  useEffect(() => {
    const handleTransaction = ({
      transaction,
    }: {
      transaction: { getMeta: (key: string) => unknown };
    }) => {
      if (transaction.getMeta(EDITOR_CONTEXT_UPDATED)) setVersion((current) => current + 1);
    };
    editor.on('transaction', handleTransaction);
    return () => {
      editor.off('transaction', handleTransaction);
    };
  }, [editor]);

  return version;
}
