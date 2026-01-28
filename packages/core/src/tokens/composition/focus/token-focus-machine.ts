/**
 * Token Focus State Machine
 *
 * Consolidates the 4 separate state variables from token.tsx into a single
 * discriminated union type managed by a reducer. This provides:
 * - Explicit state transitions
 * - Type-safe state access
 * - Predictable effect ordering
 *
 * State diagram:
 *   inactive -> pending-entry -> active -> exiting -> inactive
 *                    ^            |
 *                    |            v
 *                    +--- (direct transition possible)
 */

import type { CursorPosition, EntryDirection } from '../contexts';

export type FocusType = 'first' | 'last' | 'entry-first' | 'entry-last';

export interface KeyboardTokenEntry {
  direction: 'from-left' | 'from-right';
  policy: 'entry' | 'all';
}

export interface ClickTokenEntry {
  type: 'click';
}

export type TokenEntry = KeyboardTokenEntry | ClickTokenEntry;

function isKeyboardEntry(entry: TokenEntry): entry is KeyboardTokenEntry {
  return 'direction' in entry;
}

/**
 * UI state machine state for a single token component.
 * This is different from TokenFocusPluginState in token-focus-plugin.ts which tracks
 * the focused token position in the ProseMirror document.
 */
export type TokenComponentState =
  | { status: 'inactive' }
  | {
      status: 'pending-entry';
      focusType: FocusType;
      position: CursorPosition;
      direction: EntryDirection;
    }
  | {
      status: 'active';
      focusId: string;
      direction: EntryDirection;
    }
  | {
      status: 'exiting';
      exitDirection: 'left' | 'right';
    };

export type TokenFocusAction =
  | { type: 'PLUGIN_FOCUS_GAINED'; entry: TokenEntry }
  | { type: 'PENDING_FOCUS_EXECUTED'; focusId: string }
  | { type: 'CHILD_FOCUSED'; id: string }
  | { type: 'PLUGIN_FOCUS_LOST' }
  | { type: 'EXIT_REQUESTED'; direction: 'left' | 'right' }
  | { type: 'EXIT_COMPLETED' }
  | { type: 'EDITOR_DISABLED' };

export function createInitialState(): TokenComponentState {
  return { status: 'inactive' };
}

// Determines focus type and position based on entry information
function determineFocusFromEntry(entry: TokenEntry): {
  focusType: FocusType;
  position: CursorPosition;
  direction: EntryDirection;
} {
  if (!isKeyboardEntry(entry)) {
    return {
      focusType: 'entry-first',
      position: 'end',
      direction: null,
    };
  }

  const { direction, policy } = entry;
  if (direction === 'from-left') {
    return {
      focusType: policy === 'entry' ? 'entry-first' : 'first',
      position: 'start',
      direction: 'from-left',
    };
  } else {
    return {
      focusType: policy === 'entry' ? 'entry-last' : 'last',
      position: 'end',
      direction: 'from-right',
    };
  }
}

// Pure reducer function for token focus state transitions
export function tokenFocusReducer(
  state: TokenComponentState,
  action: TokenFocusAction
): TokenComponentState {
  switch (action.type) {
    case 'PLUGIN_FOCUS_GAINED': {
      // Only process if currently inactive
      if (state.status !== 'inactive') {
        return state;
      }

      const { focusType, position, direction } = determineFocusFromEntry(action.entry);
      return {
        status: 'pending-entry',
        focusType,
        position,
        direction,
      };
    }

    case 'PENDING_FOCUS_EXECUTED': {
      // Only valid from pending-entry state
      if (state.status !== 'pending-entry') {
        return state;
      }

      return {
        status: 'active',
        focusId: action.focusId,
        direction: state.direction,
      };
    }

    case 'CHILD_FOCUSED': {
      // Can transition from pending-entry or update active state
      if (state.status === 'pending-entry') {
        return {
          status: 'active',
          focusId: action.id,
          direction: state.direction,
        };
      }

      if (state.status === 'active') {
        return {
          ...state,
          focusId: action.id,
        };
      }

      return state;
    }

    case 'PLUGIN_FOCUS_LOST': {
      // Always transition to inactive (except from exiting)
      if (state.status === 'exiting') {
        return state;
      }
      return { status: 'inactive' };
    }

    case 'EXIT_REQUESTED': {
      // Only valid from active or pending-entry states
      if (state.status === 'active' || state.status === 'pending-entry') {
        return {
          status: 'exiting',
          exitDirection: action.direction,
        };
      }
      return state;
    }

    case 'EXIT_COMPLETED': {
      // Only valid from exiting state
      if (state.status !== 'exiting') {
        return state;
      }
      return { status: 'inactive' };
    }

    case 'EDITOR_DISABLED': {
      // Always transition to inactive
      return { status: 'inactive' };
    }

    default: {
      // Exhaustive check - void prevents unused variable warning
      const exhaustiveCheck: never = action;
      void exhaustiveCheck;
      return state;
    }
  }
}

export function isFocused(state: TokenComponentState): boolean {
  return state.status === 'active' || state.status === 'pending-entry';
}

export function getCurrentFocusId(state: TokenComponentState): string | null {
  if (state.status === 'active') {
    return state.focusId;
  }
  return null;
}

export function getEntryDirection(state: TokenComponentState): EntryDirection {
  if (state.status === 'active' || state.status === 'pending-entry') {
    return state.direction;
  }
  return null;
}

export function getPendingFocus(
  state: TokenComponentState
): { type: FocusType; position: CursorPosition } | null {
  if (state.status === 'pending-entry') {
    return {
      type: state.focusType,
      position: state.position,
    };
  }
  return null;
}

export function getExitDirection(state: TokenComponentState): 'left' | 'right' | null {
  if (state.status === 'exiting') {
    return state.exitDirection;
  }
  return null;
}

/**
 * Execute pending focus by dispatching to the appropriate focus registry method.
 *
 * Uses a mapping object instead of if-else chain for cleaner code.
 */
export function executePendingFocus(
  focusRegistry: {
    focusFirst: (position?: CursorPosition) => void;
    focusLast: (position?: CursorPosition) => void;
    focusFirstEntryFocusable: (position?: CursorPosition) => void;
    focusLastEntryFocusable: (position?: CursorPosition) => void;
  },
  pendingFocus: { type: FocusType; position: CursorPosition }
): void {
  const executors: Record<FocusType, (pos?: CursorPosition) => void> = {
    first: focusRegistry.focusFirst,
    last: focusRegistry.focusLast,
    'entry-first': focusRegistry.focusFirstEntryFocusable,
    'entry-last': focusRegistry.focusLastEntryFocusable,
  };
  executors[pendingFocus.type](pendingFocus.position);
}
