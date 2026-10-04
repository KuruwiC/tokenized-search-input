import type { Editor } from '@tiptap/core';

/**
 * Runs `change` on `editor` once the current JavaScript task has finished, which is after
 * React's commit when an effect schedules it. Changes run in the order they are scheduled,
 * and a change scheduled for an editor that is destroyed by then does not run.
 *
 * Effects that change the document go through here. A document change can create token
 * views, and Tiptap renders a new view with `flushSync`, which React refuses inside its
 * commit. Effects that only notify the plugins and views, without changing the document,
 * dispatch directly.
 */
export function scheduleDocumentChange(editor: Editor, change: () => void): void {
  queueMicrotask(() => {
    if (!editor.isDestroyed) change();
  });
}
