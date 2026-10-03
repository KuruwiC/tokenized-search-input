import type { Editor } from '@tiptap/core';
import type { PluginKey } from '@tiptap/pm/state';
import { useEffect, useState } from 'react';

/** The state of the plugin under `pluginKey`, re-read after every transaction; `undefined` without an editor or plugin. */
export function usePluginState<T>(editor: Editor | null, pluginKey: PluginKey<T>): T | undefined {
  const [state, setState] = useState<T | undefined>(() => {
    if (!editor) return undefined;
    return pluginKey.getState(editor.state);
  });

  useEffect(() => {
    if (!editor) {
      setState(undefined);
      return;
    }

    const initialState = pluginKey.getState(editor.state);
    setState(initialState);

    const handleTransaction = () => {
      const newState = pluginKey.getState(editor.state);
      setState(newState);
    };

    editor.on('transaction', handleTransaction);

    return () => {
      editor.off('transaction', handleTransaction);
    };
  }, [editor, pluginKey]);

  return state;
}
