import type { RefObject } from 'react';
import { createContext, useContext } from 'react';

export type EntryDirection = 'from-left' | 'from-right' | null;
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
 * Focus state context for Token components.
 * Updates when focus state or entry direction changes.
 */
export interface TokenFocusContextValue {
  isFocused: boolean;
  setFocus: (focused: boolean) => void;
  entryDirection: EntryDirection;
  focusRegistry: FocusRegistry;
  currentFocusId: string | null;
  setCurrentFocusId: (id: string | null) => void;
  exitToken: () => void;
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
