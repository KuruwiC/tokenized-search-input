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
  DRAG_STATE_CHANGED: 'dragStateChanged',
} as const;

/**
 * Payload for token focus change events.
 */
export interface TokenFocusChangedEvent {
  focusedPos: number | null;
}

/**
 * Payload for drag state change events.
 */
export interface DragStateChangedEvent {
  isDragging: boolean;
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

/**
 * Set drag state changed event on a transaction.
 */
export function setDragStateEvent(tr: Transaction, isDragging: boolean): void {
  tr.setMeta(EDITOR_EVENTS.DRAG_STATE_CHANGED, { isDragging } satisfies DragStateChangedEvent);
}

/**
 * Get drag state changed event from a transaction.
 */
export function getDragStateEvent(tr: Transaction): DragStateChangedEvent | undefined {
  return tr.getMeta(EDITOR_EVENTS.DRAG_STATE_CHANGED);
}
