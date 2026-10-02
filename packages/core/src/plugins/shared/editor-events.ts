/**
 * Shared Editor Events
 *
 * Transaction Meta-based communication between plugins.
 * This provides a decoupled way for plugins to communicate state changes.
 */

import type { Transaction } from '@tiptap/pm/state';

/**
 * Event types for plugin communication.
 */
export const EDITOR_EVENTS = {
  TOKEN_FOCUS_CHANGED: 'tokenFocusChanged',
} as const;

/**
 * Payload for token focus change events.
 */
export interface TokenFocusChangedEvent {
  focusedPos: number | null;
}

/**
 * Set token focus changed event on a transaction.
 */
export function setTokenFocusEvent(tr: Transaction, focusedPos: number | null): void {
  tr.setMeta(EDITOR_EVENTS.TOKEN_FOCUS_CHANGED, { focusedPos } satisfies TokenFocusChangedEvent);
}

/**
 * Get token focus changed event from a transaction.
 */
export function getTokenFocusEvent(tr: Transaction): TokenFocusChangedEvent | undefined {
  return tr.getMeta(EDITOR_EVENTS.TOKEN_FOCUS_CHANGED);
}
