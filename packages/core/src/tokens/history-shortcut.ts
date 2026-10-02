const HISTORY_KEYS = new Set(['z', 'y']);
const HISTORY_CODES = new Set(['KeyZ', 'KeyY']);

/**
 * Whether a key press is an undo or redo shortcut (Mod-z, Mod-Shift-z, Mod-y).
 * Token attribute edits are part of the editor's undo history, so these keys
 * belong to the editor even when they are pressed inside a token's input; the
 * editor's keymap decides what the exact combination does.
 */
export function isHistoryShortcut(event: KeyboardEvent): boolean {
  if (event.type !== 'keydown') return false;
  if (!(event.metaKey || event.ctrlKey) || event.altKey) return false;
  return HISTORY_KEYS.has(event.key.toLowerCase()) || HISTORY_CODES.has(event.code);
}
