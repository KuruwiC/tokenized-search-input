/**
 * Typed transaction meta shared between plugins and the code that dispatches to them.
 *
 * Each meta has one setter and one reader so its key and payload shape live in a
 * single place.
 */

import { isHistoryTransaction as isHistoryStateTransaction } from '@tiptap/pm/history';
import type { Transaction } from '@tiptap/pm/state';

const CONTENT_RESET = 'contentReset';
const VALIDATION_CHECK_REQUESTED = 'validationCheckRequested';
const CONTENT_ENTERED = 'contentEntered';
const PROGRAMMATIC_EDIT = 'programmaticEdit';
const TOKEN_VALUE_TYPED = 'tokenValueTyped';
const CONTEXT_UPDATED = 'editorContextUpdated';
const SUBMITTED = 'querySubmitted';
const CLEARED = 'queryCleared';
const AUTO_TOKENIZED = 'autoTokenized';
const DOCUMENT_REPAIRED = 'documentRepaired';
const TEXT_SANITIZED = 'freeTextSanitized';

// Keys owned by ProseMirror and its history plugin. They are named here and nowhere else.
const ADD_TO_HISTORY = 'addToHistory';
const COMPOSITION = 'composition';
const APPENDED_TRANSACTION = 'appendedTransaction';

/**
 * Marks the transaction as replacing the whole content, which discards every
 * token's meta. Attached by `setValue` and `clear` on the ref.
 */
export function markContentReset(tr: Transaction): Transaction {
  return tr.setMeta(CONTENT_RESET, true);
}

export function isContentReset(tr: Transaction): boolean {
  return tr.getMeta(CONTENT_RESET) === true;
}

/**
 * Asks the validation plugin to validate every token even when the document did not
 * change. No token counts as edited, so a check only marks.
 */
export function requestValidationCheck(tr: Transaction): Transaction {
  return tr.setMeta(VALIDATION_CHECK_REQUESTED, true);
}

export function isValidationCheckRequested(tr: Transaction): boolean {
  return tr.getMeta(VALIDATION_CHECK_REQUESTED) === true;
}

/**
 * Tells the validation plugin that the whole content was just entered, as the initial
 * content is. Every token then counts as edited.
 */
export function markContentEntered(tr: Transaction): Transaction {
  return tr.setMeta(CONTENT_ENTERED, true);
}

export function isContentEntered(tr: Transaction): boolean {
  return tr.getMeta(CONTENT_ENTERED) === true;
}

/**
 * Marks the transaction as a change the application made through the ref, not one
 * the user made. Validation still sees the change, but does not keep the token
 * edited once the user leaves the token they are in.
 */
export function markProgrammaticEdit(tr: Transaction): Transaction {
  return tr.setMeta(PROGRAMMATIC_EDIT, true);
}

export function isProgrammaticEdit(tr: Transaction): boolean {
  return tr.getMeta(PROGRAMMATIC_EDIT) === true;
}

/**
 * Whether the transaction is an undo or redo. It restores a document that existed
 * before, rather than editing one.
 */
export function isHistoryTransaction(tr: Transaction): boolean {
  return isHistoryStateTransaction(tr);
}

/**
 * Keeps the transaction out of the undo history. Only a transaction with steps needs
 * it: the history does not record one that changes nothing but the selection or meta.
 */
export function withoutHistory(tr: Transaction): Transaction {
  return tr.setMeta(ADD_TO_HISTORY, false);
}

/**
 * Records the transaction's steps in the undo history, over a `withoutHistory` made
 * earlier on the same transaction.
 */
export function recordInHistory(tr: Transaction): Transaction {
  return tr.setMeta(ADD_TO_HISTORY, true);
}

/** Whether the transaction changes the document in a way undo reverts. */
export function isRecordedInHistory(tr: Transaction): boolean {
  return tr.docChanged && tr.getMeta(ADD_TO_HISTORY) !== false;
}

/** Whether the transaction is part of an IME composition. */
export function isCompositionTransaction(tr: Transaction): boolean {
  return tr.getMeta(COMPOSITION) !== undefined;
}

/** The dispatched transaction that a plugin appended `tr` after, or `tr` itself when it was dispatched. */
export function getDispatchedTransaction(tr: Transaction): Transaction {
  return (tr.getMeta(APPENDED_TRANSACTION) as Transaction | undefined) ?? tr;
}

/**
 * Marks the transaction as the user typing into the token with the given id. The
 * suggestion plugin then shows that token's value suggestions, even if they were
 * dismissed; their query always follows the token's value.
 */
export function markTokenValueTyped(tr: Transaction, tokenId: string): Transaction {
  return tr.setMeta(TOKEN_VALUE_TYPED, tokenId);
}

export function getTokenValueTypedId(tr: Transaction): string | undefined {
  return tr.getMeta(TOKEN_VALUE_TYPED);
}

/**
 * Marks the transaction as a change to the editor's configuration, which node views
 * render from, with no change to the document.
 */
export function markContextUpdated(tr: Transaction): Transaction {
  return tr.setMeta(CONTEXT_UPDATED, true);
}

export function isContextUpdated(tr: Transaction): boolean {
  return tr.getMeta(CONTEXT_UPDATED) === true;
}

export function markSubmitted(tr: Transaction): Transaction {
  return tr.setMeta(SUBMITTED, true);
}

export function isSubmitted(tr: Transaction): boolean {
  return tr.getMeta(SUBMITTED) === true;
}

export function markCleared(tr: Transaction): Transaction {
  return tr.setMeta(CLEARED, true);
}

export function isCleared(tr: Transaction): boolean {
  return tr.getMeta(CLEARED) === true;
}

/**
 * Marks the transaction as already tokenized, so the auto-tokenize plugin leaves the
 * text it touched alone.
 */
export function markAutoTokenized(tr: Transaction): Transaction {
  return tr.setMeta(AUTO_TOKENIZED, true);
}

export function isAutoTokenized(tr: Transaction): boolean {
  return tr.getMeta(AUTO_TOKENIZED) === true;
}

export function markDocumentRepaired(tr: Transaction): Transaction {
  return tr.setMeta(DOCUMENT_REPAIRED, true);
}

export function isDocumentRepaired(tr: Transaction): boolean {
  return tr.getMeta(DOCUMENT_REPAIRED) === true;
}

export function markTextSanitized(tr: Transaction): Transaction {
  return tr.setMeta(TEXT_SANITIZED, true);
}

export function isTextSanitized(tr: Transaction): boolean {
  return tr.getMeta(TEXT_SANITIZED) === true;
}
