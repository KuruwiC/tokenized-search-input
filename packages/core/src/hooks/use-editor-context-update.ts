import type { Editor } from '@tiptap/core';
import type { Transaction } from '@tiptap/pm/state';
import { useEffect, useState } from 'react';
import { isContextUpdated } from '../plugins/shared/meta';

/** Re-render a node view when editor context storage changes without doc changes. */
export function useEditorContextUpdate(editor: Editor): number {
  const [version, setVersion] = useState(0);

  useEffect(() => {
    const handleTransaction = ({ transaction }: { transaction: Transaction }) => {
      if (isContextUpdated(transaction)) setVersion((current) => current + 1);
    };
    editor.on('transaction', handleTransaction);
    return () => {
      editor.off('transaction', handleTransaction);
    };
  }, [editor]);

  return version;
}
