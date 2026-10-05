import type { Editor } from '@tiptap/core';
import type { PluginKey } from '@tiptap/pm/state';
import { useEditorSelector } from './use-editor-selector';

/** The state of the plugin under `pluginKey`, re-rendering only when that state changes. */
export function usePluginState<T>(editor: Editor, pluginKey: PluginKey<T>): T | undefined {
  return useEditorSelector(editor, (state) => pluginKey.getState(state));
}
