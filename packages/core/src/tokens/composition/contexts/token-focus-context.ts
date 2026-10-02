import type { RefObject } from 'react';
import { createContext, useContext } from 'react';

export type CursorPosition = 'start' | 'end';

export interface FocusableElement {
  id: string;
  ref: RefObject<HTMLElement | null>;
  focus: (position?: CursorPosition) => void;
  /** Whether this element can receive focus when entering the token via Backspace/Delete. Default: true */
  entryFocusable?: boolean;
}

export type FocusTarget = 'first' | 'last';
export type FocusDirection = 'next' | 'prev';
export type FocusFilter = 'all' | 'entryFocusable';

export interface NavigateOptions {
  filter?: FocusFilter;
  position?: CursorPosition;
}

export interface FocusRegistry {
  register: (element: FocusableElement) => () => void;

  // New parameterized navigation primitives
  navigateAbsolute: (target: FocusTarget, options?: NavigateOptions) => void;
  navigateRelative: (fromId: string, direction: FocusDirection, options?: NavigateOptions) => void;

  // Convenience wrappers for common navigation patterns
  focusFirst: (position?: CursorPosition) => void;
  focusLast: (position?: CursorPosition) => void;
  focusFirstEntryFocusable: (position?: CursorPosition) => void;
  focusLastEntryFocusable: (position?: CursorPosition) => void;
  focusNext: (fromId: string, position?: CursorPosition) => void;
  focusPrev: (fromId: string) => void;
  focusNextEntryFocusable: (fromId: string) => void;
  focusPrevEntryFocusable: (fromId: string) => void;

  focusById: (id: string, position?: CursorPosition) => boolean;
  getElements: () => FocusableElement[];
}

/**
 * Focus state context for Token components. Whether the token is focused is derived
 * from the editor's token focus; which of its blocks holds DOM focus is the token's own.
 */
export interface TokenFocusContextValue {
  isFocused: boolean;
  focusRegistry: FocusRegistry;
  /** The block that holds DOM focus while the token is focused. */
  currentFocusId: string | null;
  setCurrentFocusId: (id: string | null) => void;
  /** Leaves the token to the right, committing it with `value` when one is given. */
  exitToken: (value?: string) => void;
  /**
   * Dispatch a keyboard event to Token-level handler.
   * Blocks should call this in their onKeyDown to ensure proper event flow.
   */
  dispatchKeyDown: (e: React.KeyboardEvent) => void;
  /** Whether the editor is editable (not disabled) */
  isEditable: boolean;
  /** Whether the token is immutable (confirmed and cannot be edited) */
  immutable: boolean;
}

export const TokenFocusContext = createContext<TokenFocusContextValue | null>(null);

export function useTokenFocusContext(): TokenFocusContextValue {
  const context = useContext(TokenFocusContext);
  if (!context) {
    throw new Error('useTokenFocusContext must be used within a Token component');
  }
  return context;
}
