import type { Node as ProseMirrorNode } from '@tiptap/pm/model';
import type { EditorState, Transaction } from '@tiptap/pm/state';
import { Plugin, PluginKey } from '@tiptap/pm/state';
import { findTokenById } from '../../utils/find-token';

/**
 * How focus entered a token, which decides the block of the token that receives DOM
 * focus.
 * - `source`: what moved the focus into the token
 * - `position`: where the caret goes in that block. A keyboard entry at the start
 *   comes from the left, one at the end from the right
 * - `target`: `'entry'` is the block on the side the focus came in from, every block
 *   counted; `'all'` is the block that edits the token as a whole, its first
 *   entry-focusable block, or its last one for a keyboard entry from the right
 */
export interface TokenFocusEntry {
  source: 'click' | 'keyboard' | 'program';
  position: 'start' | 'end';
  target: 'entry' | 'all';
}

/** The entry of focus that code moves into a token: the token is edited as a whole. */
export function programEntry(position: TokenFocusEntry['position'] = 'end'): TokenFocusEntry {
  return { source: 'program', position, target: 'all' };
}

export interface FocusedToken {
  id: string;
  entry: TokenFocusEntry;
}

/**
 * The single owner of which token is being edited. Everything else (the token
 * components, the suggestions, validation) derives from it.
 */
export interface TokenFocusPluginState {
  focused: FocusedToken | null;
}

const tokenFocusKey = new PluginKey<TokenFocusPluginState>('tokenFocus');

const NO_FOCUS: TokenFocusPluginState = { focused: null };

/**
 * Whether the token `id` can receive focus in `doc`, which only takes it being in the
 * document: every token has a block that can hold focus, and an immutable token has only
 * its delete button.
 */
export function canFocusToken(doc: ProseMirrorNode, id: string): boolean {
  return findTokenById(doc, id) !== null;
}

/**
 * Writes the token focus. Only the focus transitions call it: they do the work that
 * leaving and entering a token takes in the same transaction. A token that cannot
 * receive focus does not get it.
 *
 * @returns whether the focus was set
 */
export function setTokenFocus(tr: Transaction, focused: FocusedToken | null): boolean {
  if (focused !== null && !canFocusToken(tr.doc, focused.id)) return false;
  tr.setMeta(tokenFocusKey, { focused } satisfies TokenFocusPluginState);
  return true;
}

export function getFocusedToken(state: EditorState): FocusedToken | null {
  return tokenFocusKey.getState(state)?.focused ?? null;
}

export function getFocusedTokenId(state: EditorState): string | null {
  return getFocusedToken(state)?.id ?? null;
}

export function getTokenFocusMeta(tr: Transaction): TokenFocusPluginState | undefined {
  return tr.getMeta(tokenFocusKey) as TokenFocusPluginState | undefined;
}

export function createTokenFocusPlugin(): Plugin<TokenFocusPluginState> {
  return new Plugin<TokenFocusPluginState>({
    key: tokenFocusKey,
    state: {
      init: () => NO_FOCUS,
      apply(tr, value): TokenFocusPluginState {
        const next = getTokenFocusMeta(tr) ?? value;
        // The focus names a token, so it holds through any edit until that token leaves
        // the document.
        if (next.focused !== null && tr.docChanged && !canFocusToken(tr.doc, next.focused.id)) {
          return NO_FOCUS;
        }
        return next;
      },
    },
  });
}
