import { Extension } from '@tiptap/core';
import type { Node as ProseMirrorNode } from '@tiptap/pm/model';
import { type EditorState, Plugin, PluginKey, type Transaction } from '@tiptap/pm/state';
import { getEditorContext } from '../../extensions/editor-context';
import {
  isContentEntered,
  isContentReset,
  isProgrammaticEdit,
  isValidationCheckRequested,
  type TokenValidation,
} from '../shared/meta';
import { getTokenFocusMeta, getTokenFocusState } from '../token-focus-plugin';
import { tokenMetaKey } from '../token-meta-plugin';
import { createImplicitRules } from './implicit-rules';
import { applyPlan, type Edits, planValidation, recordEdits } from './run';

/**
 * The focus session in progress: the token the user is in and what they edited
 * since they entered it.
 */
interface FocusSession {
  tokenId: string | null;
  edits: Edits;
}

export const validationKey = new PluginKey<FocusSession>('validation');

const NO_SESSION: FocusSession = { tokenId: null, edits: new Map() };

export { FIELD_VALIDATE_RULE_ID } from './field-validate-rule';
export { collectTokens, type Plan, type ValidationInput } from './run';

function isHistoryTransaction(tr: Transaction): boolean {
  const historyMeta = tr.getMeta('history$') as { redo?: boolean } | undefined;
  return !!historyMeta && historyMeta.redo !== undefined;
}

function tokenIdAt(doc: ProseMirrorNode, pos: number | null | undefined): string | null {
  if (pos === null || pos === undefined) return null;
  return doc.nodeAt(pos)?.attrs.id ?? null;
}

function focusedTokenId(state: EditorState): string | null {
  return tokenIdAt(state.doc, getTokenFocusState(state)?.focusedPos);
}

/** The session the user is in at `state`, if the token is still the one focused there. */
function sessionAt(state: EditorState): FocusSession {
  const session = validationKey.getState(state) ?? NO_SESSION;
  return session.tokenId !== null && session.tokenId === focusedTokenId(state)
    ? session
    : NO_SESSION;
}

function recordedValidations(state: EditorState): Map<string, TokenValidation> {
  const recorded = new Map<string, TokenValidation>();
  for (const [id, meta] of tokenMetaKey.getState(state)?.entries ?? []) {
    if (meta.validation) recorded.set(id, meta.validation);
  }
  return recorded;
}

/**
 * The only writer of token validation. On every document change, focus change or
 * requested check it runs the configured rules and the implicit rules, applies the
 * deletions the configured rules call for, and records each token's validation in
 * token meta. Validation never changes node attributes.
 */
export const ValidationExtension = Extension.create({
  name: 'validation',

  addProseMirrorPlugins() {
    const editor = this.editor;

    return [
      new Plugin<FocusSession>({
        key: validationKey,

        state: {
          init: () => NO_SESSION,
          apply(tr, session, oldState) {
            const focus = getTokenFocusMeta(tr);
            let current = session;
            if (focus) {
              const tokenId = tokenIdAt(tr.doc, focus.focusedPos);
              if (tokenId === null) return NO_SESSION;
              if (tokenId !== session.tokenId) current = { tokenId, edits: new Map() };
            }
            // Only the user's own edits keep a token edited after the transaction.
            const userEdit =
              tr.docChanged &&
              !isHistoryTransaction(tr) &&
              !isProgrammaticEdit(tr) &&
              !isContentReset(tr);
            if (current.tokenId === null || !userEdit) return current;
            const edits = recordEdits(current.edits, oldState.doc, tr.doc);
            return edits === current.edits ? current : { tokenId: current.tokenId, edits };
          },
        },

        appendTransaction(transactions, oldState, newState) {
          const contentEntered = transactions.some(isContentEntered);
          const forceCheck = contentEntered || transactions.some(isValidationCheckRequested);
          const focusChanged = transactions.some((tr) => getTokenFocusMeta(tr) !== undefined);
          const docChanged = transactions.some((tr) => tr.docChanged);
          if (!forceCheck && !focusChanged && !docChanged) return null;

          const editorContext = getEditorContext(editor);
          const plan = planValidation(oldState.doc, newState.doc, {
            source: editorContext,
            rules: editorContext.validation?.rules ?? [],
            implicitRules: createImplicitRules(editorContext),
            focusedTokenId: focusedTokenId(newState),
            sessionEdits: sessionAt(oldState).edits,
            contentEntered,
            isHistoryOperation: transactions.some(isHistoryTransaction),
            recordsHistory: transactions.some(
              (tr) => tr.docChanged && tr.getMeta('addToHistory') !== false
            ),
            recorded: recordedValidations(newState),
          });

          const tr = newState.tr;
          return applyPlan(tr, plan) ? tr : null;
        },
      }),
    ];
  },
});
