import type { ValidationToken } from '../../types';
import type { DeletionContext, ValidationSnapshot } from './types';

function isCreationInProgress(snap: ValidationSnapshot): boolean {
  if (snap.focus.currentPos !== null) return true;

  // Empty token without focus indicates mid-insertion state
  if (snap.focus.currentPos === null && snap.focus.previousPos === null) {
    return snap.tokens.some((t) => !t.value);
  }

  return false;
}

/**
 * Determines if a token's value has been confirmed (finalized).
 *
 * Value is confirmed when:
 * 1. Blur occurs (user moved focus away from token)
 * 2. A new token has been created with a value (e.g., suggestion selection)
 *
 * Note: modifiedTokenIds is intentionally NOT used here because it includes
 * manual typing changes (character by character), which would cause premature
 * deletion of existing tokens while the user is still typing.
 */
function isValueConfirmed(snap: ValidationSnapshot): boolean {
  // Blur: value is confirmed when editing ends
  if (snap.focus.previousPos !== null && snap.focus.currentPos === null) {
    return true;
  }

  // Suggestion selection: new token with value (while still focused)
  if (snap.focus.currentPos !== null) {
    const focusedToken = snap.tokens.find((t) => t.pos === snap.focus.currentPos);
    if (focusedToken && snap.newTokenIds.has(focusedToken.id) && focusedToken.value) {
      return true;
    }
  }

  return false;
}

interface TokenPositionsByKey {
  newTokenByKey: Map<string, number>;
  firstOccurrenceByKey: Map<string, number>;
}

// "New" token priority: focused > just-blurred > empty-value > last (forceCheck)
function computeTokenPositionsByKey(snap: ValidationSnapshot): TokenPositionsByKey {
  const newTokenByKey = new Map<string, number>();
  const firstOccurrenceByKey = new Map<string, number>();

  const tokensByKey = new Map<string, ValidationToken[]>();
  for (const token of snap.tokens) {
    const existing = tokensByKey.get(token.key) ?? [];
    existing.push(token);
    tokensByKey.set(token.key, existing);
  }

  for (const [key, tokens] of tokensByKey) {
    if (tokens.length > 0) {
      firstOccurrenceByKey.set(key, tokens[0].pos);
    }

    let newTokenPos: number | null = null;

    if (snap.focus.currentPos !== null) {
      const focused = tokens.find((t) => t.pos === snap.focus.currentPos);
      if (focused) newTokenPos = focused.pos;
    } else if (snap.focus.previousPos !== null) {
      const blurred = tokens.find((t) => t.pos === snap.focus.previousPos);
      if (blurred) newTokenPos = blurred.pos;
    }

    if (newTokenPos === null) {
      const empty = tokens.find((t) => !t.value);
      if (empty) newTokenPos = empty.pos;
    }

    if (newTokenPos === null && snap.forceCheck && tokens.length > 0) {
      newTokenPos = tokens[tokens.length - 1].pos;
    }

    if (newTokenPos !== null) {
      newTokenByKey.set(key, newTokenPos);
    }
  }

  return { newTokenByKey, firstOccurrenceByKey };
}

export function shouldDeleteNow(snap: ValidationSnapshot): boolean {
  // History operations (undo/redo): only delete empty tokens, not validation-based deletions
  // This prevents undo from immediately re-deleting tokens that were just restored
  if (snap.isHistoryOperation) return false;

  // Force check (e.g., initial load): delete if no creation in progress
  if (snap.forceCheck) return !isCreationInProgress(snap);

  // Delete when value is confirmed (blur or suggestion selection)
  return isValueConfirmed(snap);
}

export function buildDeletionContext(snap: ValidationSnapshot): DeletionContext {
  const { newTokenByKey, firstOccurrenceByKey } = computeTokenPositionsByKey(snap);
  return {
    creationInProgress: isCreationInProgress(snap),
    newTokenByKey,
    firstOccurrenceByKey,
  };
}

export function isNewToken(snap: ValidationSnapshot, token: ValidationToken): boolean {
  if (snap.focus.currentPos !== null) return token.pos === snap.focus.currentPos;
  if (snap.focus.previousPos !== null) return token.pos === snap.focus.previousPos;
  return !token.value;
}
