import { Extension } from '@tiptap/core';
import type { Node as ProseMirrorNode } from '@tiptap/pm/model';
import { type EditorState, Plugin, PluginKey, type Transaction } from '@tiptap/pm/state';
import { getEditorContext } from '../../extensions/editor-context';
import { isValidationCheckRequested, type TokenValidation } from '../shared/meta';
import { getTokenFocusMeta, getTokenFocusState } from '../token-focus-plugin';
import { tokenMetaKey } from '../token-meta-plugin';
import { createImplicitRules } from './implicit-rules';
import { applyPlan, planValidation } from './run';

/**
 * The focus session in progress: the token the user is in and the document from
 * when they entered it.
 */
interface FocusSession {
  tokenId: string | null;
  editBase: ProseMirrorNode | null;
}

export const validationKey = new PluginKey<FocusSession>('validation');

const NO_SESSION: FocusSession = { tokenId: null, editBase: null };

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

/** The session the user was in before `state`, if the token is still the one focused there. */
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
            if (!focus) return session;
            const tokenId = tokenIdAt(tr.doc, focus.focusedPos);
            if (tokenId === null) return NO_SESSION;
            return tokenId === session.tokenId ? session : { tokenId, editBase: oldState.doc };
          },
        },

        appendTransaction(transactions, oldState, newState) {
          const forceCheck = transactions.some(isValidationCheckRequested);
          const focusChanged = transactions.some((tr) => getTokenFocusMeta(tr) !== undefined);
          const docChanged = transactions.some((tr) => tr.docChanged);
          if (!forceCheck && !focusChanged && !docChanged) return null;

          const editorContext = getEditorContext(editor);
          const plan = planValidation(oldState.doc, newState.doc, {
            fields: editorContext.fields,
            rules: editorContext.validation?.rules ?? [],
            implicitRules: createImplicitRules(editorContext),
            focusedTokenId: focusedTokenId(newState),
            editBase: sessionAt(oldState).editBase,
            forceCheck,
            isHistoryOperation: transactions.some(isHistoryTransaction),
            recorded: recordedValidations(newState),
          });

          const tr = newState.tr;
          return applyPlan(tr, plan) ? tr : null;
        },
      }),
    ];
  },
});
