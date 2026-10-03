import type { Node as ProseMirrorNode } from '@tiptap/pm/model';
import { type EditorState, Plugin, PluginKey, type Transaction } from '@tiptap/pm/state';
import { Mapping } from '@tiptap/pm/transform';
import { Decoration, DecorationSet } from '@tiptap/pm/view';
import { isToken } from '../utils/node-predicates';
import { generateTokenId } from '../utils/token-id';
import {
  getTokenMetaWrites,
  isContentReset,
  type TokenMeta,
  type TokenMetaPatch,
  type TokenValidation,
} from './shared/meta';

/**
 * Per-token state that is not part of the query: validation results and display
 * data, keyed by token id.
 *
 * Undo history restores only the document, so this state is a cache that can be
 * rebuilt from the document and the configuration. The validation plugin
 * recomputes `validation` on every document change. `display` entries of tokens
 * that left the document are kept while the editor lives, so a token restored by
 * undo or redo shows its display again. Only a transaction marked as a content
 * reset discards every entry.
 *
 * All id-keyed state relies on token ids being unique within the document. The
 * plugin keeps that invariant by giving a fresh id to any token whose id is
 * missing or held by another token. A token that already had the id before the
 * change keeps it, so a copy inserted before its original never takes the
 * original's id and the state keyed by it.
 */
export interface TokenMetaPluginState {
  entries: ReadonlyMap<string, TokenMeta>;
  decorations: DecorationSet;
}

/** Decoration spec key that carries a token's validation to its node view. */
const TOKEN_VALIDATION_SPEC = 'tokenValidation';

export const tokenMetaKey = new PluginKey<TokenMetaPluginState>('tokenMeta');

export function getTokenMeta(state: EditorState, id: string): TokenMeta | undefined {
  return tokenMetaKey.getState(state)?.entries.get(id);
}

/** Id of the element that describes a token's validation message. */
export function getValidationDescriptionId(tokenId: string): string {
  return `tsi-token-validation-${tokenId}`;
}

export function getDecorationValidation(
  decorations: readonly Decoration[]
): TokenValidation | undefined {
  for (const decoration of decorations) {
    const validation = (decoration.spec as Record<string, unknown>)[TOKEN_VALIDATION_SPEC];
    if (validation) return validation as TokenValidation;
  }
  return undefined;
}

function applyPatch(current: TokenMeta | undefined, patch: TokenMetaPatch): TokenMeta {
  const next: TokenMeta = { ...current };
  if ('validation' in patch) {
    if (patch.validation === undefined) delete next.validation;
    else next.validation = patch.validation;
  }
  if ('display' in patch) {
    if (patch.display === undefined) delete next.display;
    else next.display = patch.display;
  }
  return next;
}

function applyWrites(
  entries: ReadonlyMap<string, TokenMeta>,
  tr: Transaction
): ReadonlyMap<string, TokenMeta> {
  const writes = getTokenMetaWrites(tr);
  if (writes.length === 0) return entries;
  const next = new Map(entries);
  for (const { id, patch } of writes) {
    const meta = applyPatch(next.get(id), patch);
    if (meta.validation === undefined && meta.display === undefined) next.delete(id);
    else next.set(id, meta);
  }
  return next;
}

function buildDecorations(
  doc: ProseMirrorNode,
  entries: ReadonlyMap<string, TokenMeta>
): DecorationSet {
  const decorations: Decoration[] = [];
  doc.descendants((node, pos) => {
    if (!isToken(node)) return true;
    const validation = entries.get(node.attrs.id)?.validation;
    if (validation) {
      decorations.push(
        Decoration.node(
          pos,
          pos + node.nodeSize,
          {
            'data-invalid': 'true',
            'data-invalid-reason': validation.reason,
            'aria-describedby': getValidationDescriptionId(node.attrs.id),
          },
          { [TOKEN_VALIDATION_SPEC]: validation }
        )
      );
    }
    return false;
  });
  return DecorationSet.create(doc, decorations);
}

function tokenIdAt(doc: ProseMirrorNode, pos: number): unknown {
  if (pos < 0 || pos >= doc.content.size) return undefined;
  const node = doc.nodeAt(pos);
  return node && isToken(node) ? node.attrs.id : undefined;
}

/**
 * Where each id that existed before the transactions now lives: the position its
 * token maps to, if a token with that id is still there. That occurrence keeps the
 * id; copies inserted anywhere else get a fresh one.
 */
function mapExistingIds(
  transactions: readonly Transaction[],
  oldState: EditorState,
  newState: EditorState
): Map<string, number> {
  const mapping = new Mapping();
  for (const tr of transactions) mapping.appendMapping(tr.mapping);

  const owners = new Map<string, number>();
  oldState.doc.descendants((node, pos) => {
    if (!isToken(node)) return true;
    const id: unknown = node.attrs.id;
    if (typeof id === 'string' && id !== '' && !owners.has(id)) {
      const mapped = mapping.mapResult(pos, 1);
      if (!mapped.deleted && tokenIdAt(newState.doc, mapped.pos) === id) {
        owners.set(id, mapped.pos);
      }
    }
    return false;
  });
  return owners;
}

/**
 * Gives a fresh id to every token whose id is missing or belongs to another token:
 * the one the id was on before, or else the first in document order.
 */
function reissueDuplicateIds(
  transactions: readonly Transaction[],
  oldState: EditorState,
  newState: EditorState
): Transaction | null {
  const owners = mapExistingIds(transactions, oldState, newState);
  const seen = new Set<string>();
  let tr: Transaction | null = null;
  newState.doc.descendants((node, pos) => {
    if (!isToken(node)) return true;
    const id: unknown = node.attrs.id;
    if (typeof id === 'string' && id !== '' && !seen.has(id)) {
      const owner = owners.get(id);
      if (owner === undefined || owner === pos) {
        seen.add(id);
        return false;
      }
    }
    tr ??= newState.tr;
    tr.setNodeAttribute(pos, 'id', generateTokenId());
    return false;
  });
  return tr;
}

export function createTokenMetaPlugin(): Plugin<TokenMetaPluginState> {
  return new Plugin<TokenMetaPluginState>({
    key: tokenMetaKey,
    state: {
      init(_config, state): TokenMetaPluginState {
        const entries = new Map<string, TokenMeta>();
        return { entries, decorations: buildDecorations(state.doc, entries) };
      },
      apply(tr, value, _oldState, newState): TokenMetaPluginState {
        const base = isContentReset(tr) ? new Map<string, TokenMeta>() : value.entries;
        const entries = applyWrites(base, tr);
        if (entries === value.entries && !tr.docChanged) return value;
        return { entries, decorations: buildDecorations(newState.doc, entries) };
      },
    },
    appendTransaction(transactions, oldState, newState) {
      if (!transactions.some((tr) => tr.docChanged)) return null;
      return reissueDuplicateIds(transactions, oldState, newState);
    },
    props: {
      decorations(state) {
        return tokenMetaKey.getState(state)?.decorations;
      },
    },
  });
}
