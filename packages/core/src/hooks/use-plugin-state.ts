import type { PluginKey } from '@tiptap/pm/state';
import type { Editor } from '@tiptap/react';
import { useEffect, useState } from 'react';

/**
 * Subscribe to ProseMirror plugin state changes in React.
 *
 * This hook provides a clean way to synchronize ProseMirror plugin state
 * with React's rendering cycle without using CustomEvents or refs.
 *
 * @param editor - TipTap editor instance
 * @param pluginKey - ProseMirror plugin key to subscribe to
 * @returns Current plugin state, or undefined if editor/plugin not ready
 */
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
