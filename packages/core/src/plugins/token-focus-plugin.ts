import type { Node as ProseMirrorNode } from '@tiptap/pm/model';
import type { EditorState, Transaction } from '@tiptap/pm/state';
import { Plugin, PluginKey } from '@tiptap/pm/state';
import { isToken } from '../utils/node-predicates';
import { setTokenFocusEvent } from './shared/editor-events';

/**
 * Direction when navigating into a token.
 * - 'from-left': Entered from the left side (moving right)
 * - 'from-right': Entered from the right side (moving left)
 */
export type Direction = 'from-left' | 'from-right';

/**
 * Focus policy determining which elements can receive initial focus.
 * - 'all': Navigate through all focusable elements (for ArrowLeft/ArrowRight)
 * - 'entry': Skip to entry-focusable elements only (for Backspace/Delete)
 */
export type FocusPolicy = 'all' | 'entry';

/**
 * Entry direction when navigating into a token.
 * Combines direction with focus policy.
 */
export interface TokenEntry {
  direction: Direction;
  policy: FocusPolicy;
}

/**
 * Cursor position within a token.
 *
 * Token entry (used when navigating into token):
 * - TokenEntry object: { direction, policy } for keyboard navigation
 *
 * Direct positions (used for explicit cursor placement):
 * - 'start': Focus value input at start
 * - 'end': Focus value input at end
 * - number: Focus value input at specific character index
 */
export type CursorPosition = TokenEntry | 'start' | 'end' | number;

/**
 * Type guard to check if cursor position is a TokenEntry.
 */
export function isTokenEntry(position: CursorPosition): position is TokenEntry {
  return typeof position === 'object' && position !== null && 'direction' in position;
}

/**
 * Token interaction mode.
 * - 'editing': Normal editing mode (value input focused)
 */
export type TokenMode = 'editing';

/**
 * Plugin state for tracking which token is focused in the ProseMirror document.
 * This is different from TokenFocusState in token-focus-machine.ts which tracks
 * the UI state machine for a single token component.
 */
export interface TokenFocusPluginState {
  focusedPos: number | null;
  cursorPosition: CursorPosition;
  /** Token interaction mode. null when focusedPos is null. */
  mode: TokenMode | null;
}

export const tokenFocusKey = new PluginKey<TokenFocusPluginState>('tokenFocus');

export interface SetTokenFocusMeta {
  focusedPos: number | null;
  cursorPosition?: CursorPosition;
  /** Token interaction mode. Defaults to 'editing' when focusedPos is not null. */
  mode?: TokenMode;
}

export function setTokenFocus(tr: Transaction, meta: SetTokenFocusMeta): Transaction {
  // Also emit event for decoupled plugin communication
  setTokenFocusEvent(tr, meta.focusedPos);
  return tr.setMeta(tokenFocusKey, meta);
}

export function getTokenFocusState(state: EditorState): TokenFocusPluginState | undefined {
  return tokenFocusKey.getState(state);
}

/**
 * Type guard to check if a value is a valid SetTokenFocusMeta.
 */
function isSetTokenFocusMeta(meta: unknown): meta is SetTokenFocusMeta {
  if (meta === null || typeof meta !== 'object') return false;
  const m = meta as Record<string, unknown>;
  return 'focusedPos' in m && (typeof m.focusedPos === 'number' || m.focusedPos === null);
}

/**
 * Get token focus meta from a transaction with type safety.
 * Uses runtime type guard to validate the meta structure.
 */
export function getTokenFocusMeta(tr: Transaction): SetTokenFocusMeta | undefined {
  const meta = tr.getMeta(tokenFocusKey);
  return isSetTokenFocusMeta(meta) ? meta : undefined;
}

function nodeAtPos(doc: ProseMirrorNode, pos: number): ProseMirrorNode | null {
  return pos >= 0 && pos < doc.content.size ? doc.nodeAt(pos) : null;
}

export function createTokenFocusPlugin(): Plugin<TokenFocusPluginState> {
  return new Plugin<TokenFocusPluginState>({
    key: tokenFocusKey,
    state: {
      init(): TokenFocusPluginState {
        return {
          focusedPos: null,
          cursorPosition: 'end',
          mode: null,
        };
      },
      apply(tr, value, oldState): TokenFocusPluginState {
        const meta = getTokenFocusMeta(tr);
        if (meta) {
          return {
            focusedPos: meta.focusedPos,
            cursorPosition: meta.cursorPosition ?? 'end',
            // mode is null when focusedPos is null, otherwise defaults to 'editing'
            mode: meta.focusedPos === null ? null : (meta.mode ?? 'editing'),
          };
        }

        if (value.focusedPos === null) return value;

        // The focus follows the token it is on. When that token is gone, the focus is
        // dropped: the mapped position may now point at a neighbouring token, which was
        // not the one being edited.
        const focused = nodeAtPos(oldState.doc, value.focusedPos);
        const focusedPos = tr.mapping.map(value.focusedPos);
        const node = nodeAtPos(tr.doc, focusedPos);
        if (!node || !isToken(node) || node.attrs.id !== focused?.attrs.id) {
          return { focusedPos: null, cursorPosition: 'end', mode: null };
        }
        return focusedPos === value.focusedPos ? value : { ...value, focusedPos };
      },
    },
  });
}
