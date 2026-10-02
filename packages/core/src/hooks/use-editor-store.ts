import type { Editor } from '@tiptap/core';
import type { EditorState } from '@tiptap/pm/state';
import { useRef, useSyncExternalStore } from 'react';
import type { TokenMeta } from '../plugins/shared/meta';
import { getFocusedToken, type TokenFocusEntry } from '../plugins/token-focus-plugin';
import { getTokenMeta } from '../plugins/token-meta-plugin';

interface EditorStore {
  subscribe: (listener: () => void) => () => void;
}

const stores = new WeakMap<Editor, EditorStore>();

/** One store per editor, listening to the editor once however many components read from it. */
function getEditorStore(editor: Editor): EditorStore {
  const existing = stores.get(editor);
  if (existing) return existing;

  const listeners = new Set<() => void>();
  const notify = () => {
    for (const listener of listeners) listener();
  };
  const store: EditorStore = {
    subscribe: (listener) => {
      if (listeners.size === 0) editor.on('transaction', notify);
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
        if (listeners.size === 0) editor.off('transaction', notify);
      };
    },
  };
  stores.set(editor, store);
  return store;
}

/**
 * Reads a value derived from the editor state, re-rendering only when the selected
 * value changes under `isEqual`.
 */
export function useEditorSelector<T>(
  editor: Editor,
  selector: (state: EditorState) => T,
  isEqual: (a: T, b: T) => boolean = Object.is
): T {
  const store = getEditorStore(editor);
  const cache = useRef<{
    state: EditorState;
    selector: (state: EditorState) => T;
    value: T;
  } | null>(null);

  const getSnapshot = (): T => {
    const { state } = editor;
    const cached = cache.current;
    if (cached?.state === state && cached.selector === selector) return cached.value;
    const value = selector(state);
    const stable = cached && isEqual(cached.value, value) ? cached.value : value;
    cache.current = { state, selector, value: stable };
    return stable;
  };

  return useSyncExternalStore(store.subscribe, getSnapshot, getSnapshot);
}

export function useTokenMeta(editor: Editor, id: string): TokenMeta | undefined {
  return useEditorSelector(editor, (state) => getTokenMeta(state, id));
}

/**
 * How focus entered the token `id` while it is the focused token, otherwise null. A
 * token re-renders only when focus enters or leaves it, not when it moves elsewhere.
 */
export function useTokenFocus(editor: Editor, id: string): TokenFocusEntry | null {
  return useEditorSelector(editor, (state) => {
    const focused = getFocusedToken(state);
    return focused?.id === id ? focused.entry : null;
  });
}
