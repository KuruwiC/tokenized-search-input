import type { Node as ProseMirrorNode } from '@tiptap/pm/model';
import type { EditorState, Transaction } from '@tiptap/pm/state';
import type { EditorContextStorage } from '../../extensions/editor-context';
import type { ValidationToken } from '../../types';
import { isFilterToken, isFreeTextToken } from '../../utils/node-predicates';
import { ensureTokenId } from '../../utils/token-id';
import { getTokenFocusMeta, getTokenFocusState } from '../token-focus-plugin';
import type { ShouldRunResult, ValidationSnapshot } from './types';
import { runValidation } from './validation-runner';

export const FORCE_VALIDATION_CHECK = 'forceValidationCheck';

export function collectTokens(doc: ProseMirrorNode): ValidationToken[] {
  const tokens: ValidationToken[] = [];

  doc.descendants((node, pos) => {
    if (isFilterToken(node)) {
      const { id, key, operator, value } = node.attrs;
      const valueStr = String(value ?? '');
      tokens.push({
        id: ensureTokenId(id),
        type: 'filter',
        pos,
        key: key || '',
        operator: operator || 'is',
        value: valueStr,
        rawValue: valueStr,
      });
    } else if (isFreeTextToken(node)) {
      const { id, value } = node.attrs;
      const valueStr = String(value ?? '');
      tokens.push({
        id: ensureTokenId(id),
        type: 'freeText',
        pos,
        key: '',
        operator: '',
        value: valueStr,
        rawValue: valueStr,
      });
    }
    return true;
  });

  return tokens;
}

export function shouldRun(
  transactions: readonly Transaction[],
  validationKey: import('@tiptap/pm/state').PluginKey
): ShouldRunResult {
  // Skip if this is our own transaction
  if (transactions.some((tr) => tr.getMeta(validationKey))) {
    return { run: false, forceCheck: false, isHistoryOperation: false };
  }

  // Check if force check is requested
  const forceCheck = transactions.some((tr) => tr.getMeta(FORCE_VALIDATION_CHECK));

  // Check if this is a history operation (undo/redo)
  const isHistoryOperation = transactions.some((tr) => {
    const historyMeta = tr.getMeta('history$');
    return !!(historyMeta && (historyMeta as { redo?: boolean }).redo !== undefined);
  });

  // Check if token focus changed
  const tokenFocusChanged = transactions.some((tr) => getTokenFocusMeta(tr) !== undefined);

  // Check if document changed
  const docChanged = transactions.some((tr) => tr.docChanged);

  // Run if: force check OR focus changed OR document changed
  const run = forceCheck || tokenFocusChanged || docChanged;

  return { run, forceCheck, isHistoryOperation };
}

export function buildSnapshot(
  oldState: EditorState,
  newState: EditorState,
  editorContext: EditorContextStorage,
  forceCheck: boolean,
  isHistoryOperation: boolean
): ValidationSnapshot | null {
  const { fields, validation } = editorContext;

  // If validation is disabled, return null
  if (!validation || !validation.rules || validation.rules.length === 0) {
    return null;
  }

  // Collect all filter tokens from both states
  const oldTokens = collectTokens(oldState.doc);
  const tokens = collectTokens(newState.doc);
  if (tokens.length === 0) {
    return null;
  }

  // Compute newTokenIds by comparing old and new state
  // For history operations (undo/redo), don't mark restored tokens as "new"
  // This prevents validation from re-triggering deletions on undone tokens
  const oldTokenIds = new Set(oldTokens.map((t) => t.id));
  const newTokenIds = isHistoryOperation
    ? new Set<string>()
    : new Set(tokens.filter((t) => !oldTokenIds.has(t.id)).map((t) => t.id));

  // Compute modifiedTokenIds (same ID but key, operator, OR value changed)
  // For history operations (undo/redo), don't mark restored tokens as "modified"
  const oldTokenMap = new Map(oldTokens.map((t) => [t.id, t]));
  const modifiedTokenIds = isHistoryOperation
    ? new Set<string>()
    : new Set(
        tokens
          .filter((t) => {
            const old = oldTokenMap.get(t.id);
            if (!old) return false;
            return old.key !== t.key || old.operator !== t.operator || old.value !== t.value;
          })
          .map((t) => t.id)
      );

  // Derive focus state from old and new states (needed for editing detection)
  const oldFocusState = getTokenFocusState(oldState);
  const newFocusState = getTokenFocusState(newState);
  const previousPos = oldFocusState?.focusedPos ?? null;
  const currentPos = newFocusState?.focusedPos ?? null;
  const focus = { currentPos, previousPos };

  // Build editingTokenIds: newTokenIds ∪ modifiedTokenIds ∪ focus-based tokens
  // This centralizes "what is being edited" determination for strategies to use
  let editingTokenIds: Set<string>;
  if (forceCheck && newTokenIds.size === 0 && modifiedTokenIds.size === 0 && tokens.length > 0) {
    // All tokens are editing on forceCheck with no detected changes (e.g., initial load)
    editingTokenIds = new Set(tokens.map((t) => t.id));
  } else {
    editingTokenIds = new Set([...newTokenIds, ...modifiedTokenIds]);

    // Enrich with focus-based editing: the token being edited should be considered editing
    // This ensures strategies work correctly on blur when no doc diff exists
    if (currentPos !== null) {
      const focusedToken = tokens.find((t) => t.pos === currentPos);
      if (focusedToken) editingTokenIds.add(focusedToken.id);
    }
    if (previousPos !== null) {
      const blurredToken = tokens.find((t) => t.pos === previousPos);
      if (blurredToken) editingTokenIds.add(blurredToken.id);
    }
  }
  const violations = runValidation(tokens, fields, validation, editingTokenIds);

  return {
    tokens,
    focus,
    newTokenIds,
    modifiedTokenIds,
    editingTokenIds,
    violations,
    forceCheck,
    isHistoryOperation,
    fields,
    validation,
  };
}
