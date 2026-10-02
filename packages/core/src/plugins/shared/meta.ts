/**
 * Typed transaction meta shared between plugins and the code that dispatches to them.
 *
 * Each meta has one setter and one reader so its key and payload shape live in a
 * single place.
 */

import type { Transaction } from '@tiptap/pm/state';
import type { ReactNode } from 'react';

/** The validation outcome of one token: the rule that failed, its reason code, and an optional message. */
export interface TokenValidation {
  ruleId: string;
  reason: string;
  message?: string;
}

/** How a token presents its value. Not part of the query. */
export interface TokenDisplayContent {
  displayValue?: string;
  startContent?: ReactNode;
  endContent?: ReactNode;
}

/**
 * Display content together with the key and value it was resolved for. It
 * describes the token only while the token still has that key and value, so an
 * edit makes it inapplicable and undoing the edit makes it apply again.
 */
export interface TokenDisplayMeta extends TokenDisplayContent {
  forKey: string;
  forValue: string;
}

/** The display content that describes a token with the given key and value, if any. */
export function getApplicableDisplay(
  display: TokenDisplayMeta | undefined,
  key: string,
  value: string
): TokenDisplayMeta | undefined {
  return display && display.forKey === key && display.forValue === value ? display : undefined;
}

/** Per-token state derived from or attached to the document, keyed by token id. */
export interface TokenMeta {
  validation?: TokenValidation;
  display?: TokenDisplayMeta;
}

/**
 * A change to one token's meta. A member that is present replaces the stored one,
 * and `undefined` removes it; an absent member is left unchanged.
 */
export interface TokenMetaPatch {
  validation?: TokenValidation | undefined;
  display?: TokenDisplayMeta | undefined;
}

export interface TokenMetaWrite {
  id: string;
  patch: TokenMetaPatch;
}

const TOKEN_META = 'tokenMeta';
const CONTENT_RESET = 'contentReset';
const FORCE_VALIDATION_CHECK = 'forceValidationCheck';
const CONTENT_ENTERED = 'contentEntered';
const PROGRAMMATIC_EDIT = 'programmaticEdit';
const SUGGESTION_QUERY = 'suggestionQuery';

/**
 * Records a change to a token's meta on the transaction. Writes on one
 * transaction apply in the order they were made.
 */
export function setTokenMeta(tr: Transaction, id: string, patch: TokenMetaPatch): Transaction {
  const writes: TokenMetaWrite[] = tr.getMeta(TOKEN_META) ?? [];
  return tr.setMeta(TOKEN_META, [...writes, { id, patch }]);
}

export function getTokenMetaWrites(tr: Transaction): readonly TokenMetaWrite[] {
  return tr.getMeta(TOKEN_META) ?? [];
}

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
  return tr.setMeta(FORCE_VALIDATION_CHECK, true);
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

export function isValidationCheckRequested(tr: Transaction): boolean {
  return tr.getMeta(FORCE_VALIDATION_CHECK) === true;
}

/**
 * Marks the transaction as the user typing into the token with the given id. The
 * suggestion plugin then shows that token's value suggestions, even if they were
 * dismissed; their query always follows the token's value.
 */
export function updateSuggestionQuery(tr: Transaction, tokenId: string): Transaction {
  return tr.setMeta(SUGGESTION_QUERY, tokenId);
}

/** The id of the token the user typed into on this transaction, if any. */
export function getSuggestionQueryUpdate(tr: Transaction): string | undefined {
  return tr.getMeta(SUGGESTION_QUERY);
}
