import { type Content, Extension } from '@tiptap/core';
import type { EditorState, Transaction } from '@tiptap/pm/state';
import type { TokenDisplay, TokenPatch } from '../editor/tokenized-search-input.types';
import {
  getApplicableDisplay,
  markContentReset,
  markProgrammaticEdit,
  setTokenMeta,
  type TokenDisplayContent,
} from '../plugins/shared/meta';
import { getTokenMeta } from '../plugins/token-meta-plugin';
import { applyTokenAction } from '../tokens/filter-token/token-actions';
import { findTokenById } from '../utils/find-token';
import { isFilterToken } from '../utils/node-predicates';
import type { FieldResolutionSource } from '../utils/resolve-field';
import { getEditorContext } from './editor-context';

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    tokenCommands: {
      /** Changes the operator and value of a filter token. Recorded in the undo history. */
      updateToken: (id: string, patch: TokenPatch) => ReturnType;
      /** Removes a token. Recorded in the undo history. */
      deleteToken: (id: string) => ReturnType;
      /** Replaces the whole content, discarding every token's meta. */
      replaceContent: (content: Content) => ReturnType;
      /**
       * Sets how a filter token presents its current value. Not part of the query or
       * the undo history; it applies while the token keeps its current key and value.
       */
      setTokenDisplay: (id: string, display: TokenDisplay) => ReturnType;
    };
  }
}

/** Applies a `TokenPatch` to the filter token with the given id. */
export function applyTokenPatch(
  tr: Transaction,
  id: string,
  patch: TokenPatch,
  source: FieldResolutionSource
): boolean {
  const found = findTokenById(tr.doc, id);
  if (!found || !isFilterToken(found.node)) return false;
  markProgrammaticEdit(tr);
  if (patch.operator !== undefined) {
    applyTokenAction(tr, id, { type: 'setOperator', operator: patch.operator }, source);
  }
  if (patch.value !== undefined) {
    applyTokenAction(tr, id, { type: 'setValue', value: patch.value }, source);
  }
  return true;
}

export function deleteTokenById(tr: Transaction, id: string): boolean {
  const found = findTokenById(tr.doc, id);
  if (!found) return false;
  tr.delete(found.pos, found.pos + found.node.nodeSize);
  return true;
}

/** Merges a `TokenDisplay` into the current display: omitted members stay, `null` clears one. */
function mergeTokenDisplay(
  current: TokenDisplayContent | undefined,
  display: TokenDisplay
): TokenDisplayContent | undefined {
  const next: TokenDisplayContent = {};
  if (current?.displayValue !== undefined) next.displayValue = current.displayValue;
  if (current?.startContent !== undefined) next.startContent = current.startContent;
  if (current?.endContent !== undefined) next.endContent = current.endContent;
  if (display.displayValue === null) delete next.displayValue;
  else if (display.displayValue !== undefined) next.displayValue = display.displayValue;
  if (display.startContent === null) delete next.startContent;
  else if (display.startContent !== undefined) next.startContent = display.startContent;
  if (display.endContent === null) delete next.endContent;
  else if (display.endContent !== undefined) next.endContent = display.endContent;
  return Object.keys(next).length > 0 ? next : undefined;
}

/** The key and value a display describes. */
export interface DisplayBinding {
  key: string;
  value: string;
}

/**
 * Sets the display of a filter token for `binding`, by default the token's current
 * key and value.
 */
export function setTokenDisplayById(
  state: EditorState,
  tr: Transaction,
  id: string,
  display: TokenDisplay,
  binding?: DisplayBinding
): boolean {
  const found = findTokenById(tr.doc, id);
  if (!found || !isFilterToken(found.node)) return false;
  const { key, value } = binding ?? found.node.attrs;
  // Display left from another value of this token does not carry over.
  const current = getApplicableDisplay(getTokenMeta(state, id)?.display, key, value);
  const merged = mergeTokenDisplay(current, display);
  setTokenMeta(tr, id, { display: merged && { ...merged, forKey: key, forValue: value } });
  return true;
}

/**
 * The supported way to change tokens from outside the editor. Writing through the
 * editor directly bypasses the history policy of `applyTokenAction` and the token
 * id invariant.
 */
export const TokenCommandsExtension = Extension.create({
  name: 'tokenCommands',

  addCommands() {
    const editor = this.editor;
    return {
      replaceContent:
        (content) =>
        ({ tr, commands }) => {
          markContentReset(tr);
          return commands.setContent(content);
        },
      updateToken:
        (id, patch) =>
        ({ tr }) =>
          applyTokenPatch(tr, id, patch, getEditorContext(editor)),
      deleteToken:
        (id) =>
        ({ tr }) =>
          deleteTokenById(tr, id),
      setTokenDisplay:
        (id, display) =>
        ({ state, tr }) =>
          setTokenDisplayById(state, tr, id, display),
    };
  },
});
