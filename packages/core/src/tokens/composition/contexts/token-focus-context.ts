import type { RefObject } from 'react';
import { createContext, useContext } from 'react';

export type CursorPosition = 'start' | 'end';

/** A block of a token that can hold DOM focus and handles the keys pressed while it does. */
export interface FocusableBlock {
  id: string;
  element: RefObject<HTMLElement | null>;
  focus: (position?: CursorPosition) => void;
  /**
   * Handles a key pressed while the block holds focus.
   * @returns whether the key was handled; an unhandled one falls to the token's own keys
   */
  handleKey: (e: React.KeyboardEvent) => boolean;
  /** Called when the block is pressed with the pointer: opens a dropdown, removes the token. */
  activate?: () => void;
  /** Whether this block can receive focus when entering the token via Backspace/Delete. Default: true */
  entryFocusable?: boolean;
  /** Whether focus on this block is editing the token: true for the label, operator and value. */
  editsToken: boolean;
}

interface FocusNavigationOptions {
  /** Only blocks that can receive focus when entering the token via Backspace/Delete. */
  entryOnly?: boolean;
  position?: CursorPosition;
}

export interface FocusRegistry {
  register: (block: FocusableBlock) => () => void;
  get: (id: string) => FocusableBlock | undefined;
  /** The first or last block, or undefined when no block is registered. */
  edge: (
    edge: 'first' | 'last',
    options?: Pick<FocusNavigationOptions, 'entryOnly'>
  ) => FocusableBlock | undefined;
  /** Focuses the first or last block. Leaves the focus alone when no block is registered. */
  focusEdge: (edge: 'first' | 'last', options?: FocusNavigationOptions) => void;
  /** Focuses the block next to `fromId`, or leaves the token past the last or first one. */
  focusAdjacent: (
    fromId: string,
    direction: 'next' | 'prev',
    options?: FocusNavigationOptions
  ) => void;
}

/**
 * Focus state context for Token components. Whether the token shows its controls is
 * derived from the editor's token focus and the token's attributes; which of its blocks
 * holds DOM focus is the token's own.
 */
export interface TokenFocusContextValue {
  /**
   * Whether the token is focused and can be changed. Its label, operator and value then
   * show their controls, whichever block holds focus, so focus can move between them. An
   * immutable token that holds focus shows none.
   */
  showsControls: boolean;
  focusRegistry: FocusRegistry;
  /** The block that holds DOM focus while the token is focused. */
  currentFocusId: string | null;
  setCurrentFocusId: (id: string | null) => void;
  /** Leaves the token to the right, committing it with `value` when one is given. */
  exitToken: (value?: string) => void;
  /** Whether the editor is editable (not disabled) */
  isEditable: boolean;
}

export const TokenFocusContext = createContext<TokenFocusContextValue | null>(null);

export function useTokenFocusContext(): TokenFocusContextValue {
  const context = useContext(TokenFocusContext);
  if (!context) {
    throw new Error('useTokenFocusContext must be used within a Token component');
  }
  return context;
}
