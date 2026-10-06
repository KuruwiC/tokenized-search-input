import type { Editor } from '@tiptap/core';

const heldWritesByEditor = new WeakMap<Editor, () => void>();

/**
 * Registers how to apply the writes the input held because `editor` could not take them
 * yet. Every change scheduled for `editor` applies them first, so it reads their content
 * whichever effect scheduled it.
 */
export function setHeldWrites(editor: Editor, applyHeldWrites: () => void): void {
  heldWritesByEditor.set(editor, applyHeldWrites);
}

/**
 * Runs `change` on `editor` once the current JavaScript task has finished, which is after
 * React's commit when an effect schedules it. Changes run in the order they are scheduled,
 * each after the writes held for the editor (see `setHeldWrites`), and a change scheduled
 * for an editor that is destroyed by then does not run.
 *
 * Effects that change the document go through here. A document change can create token
 * views, and Tiptap renders a new view with `flushSync`, which React refuses inside its
 * commit. Effects that only notify the plugins and views, without changing the document,
 * dispatch directly.
 */
export function scheduleDocumentChange(editor: Editor, change: () => void): void {
  queueMicrotask(() => {
    if (editor.isDestroyed) return;
    heldWritesByEditor.get(editor)?.();
    change();
  });
}
