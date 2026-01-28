'use client';

/**
 * Internal/Advanced APIs
 *
 * WARNING: These APIs are unstable and may change without notice.
 * Use at your own risk. They are primarily intended for:
 * - Testing and debugging
 * - Advanced customization scenarios
 * - Building custom extensions
 *
 * For stable public APIs, import from the main entry point instead:
 * ```typescript
 * import { TokenizedSearchInput } from '@kuruwic/tokenized-search-input';
 * ```
 */

// ============================================
// Plugins (TipTap/ProseMirror internals)
// ============================================

export {
  type CustomDisplayMode,
  closeSuggestion,
  createSuggestionPlugin,
  getSuggestionState,
  openCustomSuggestion,
  openDateSuggestion,
  openDateTimeSuggestion,
  openFieldSuggestion,
  openFieldWithCustomSuggestion,
  openValueSuggestion,
  type SuggestionState,
  type SuggestionType,
  setSuggestionLoading,
  updateSuggestionActiveIndex,
  updateSuggestionDateValue,
  updateSuggestionQuery,
} from './plugins/suggestion-plugin';

export {
  type CursorPosition,
  createTokenFocusPlugin,
  getTokenFocusState,
  setTokenFocus,
  type TokenFocusPluginState,
  type TokenMode,
} from './plugins/token-focus-plugin';

// ============================================
// Token Nodes (ProseMirror node types)
// ============================================

export { FilterTokenNode } from './tokens/filter-token/filter-token-node';
export { FreeTextTokenNode } from './tokens/free-text-token/free-text-token-node';

// ============================================
// Extensions (TipTap extensions)
// ============================================

export { ClipboardSerializer } from './extensions/clipboard-serializer';
export { TokenNavigation } from './extensions/token-navigation';

// ============================================
// Suggestion internals
// ============================================

export {
  DISMISS_POLICIES,
  type DismissPolicy,
  type DismissReason,
  getDismissPolicy,
  shouldDismiss,
} from './suggestions/dismiss-policy';
export {
  createBoundary,
  type InteractionBoundary,
} from './suggestions/interaction-boundary';
export { useDismissManager } from './suggestions/use-dismiss-manager';

// ============================================
// Suggestion List Components
// ============================================

export { CustomSuggestionList } from './suggestions/custom-suggestion-list';
export { FieldSuggestionList } from './suggestions/field-suggestion-list';
export { SuggestionOverlay } from './suggestions/suggestion-overlay';
export { ValueSuggestionList } from './suggestions/value-suggestion-list';

// ============================================
// Date Picker Internals
// ============================================

export {
  getDateDisplayValue,
  getDateInternalValue,
  getDateTimeDisplayValue,
  getDateTimeInternalValue,
  isUTCValue,
  parseISOToDate,
  supportsUTCMode,
} from './pickers/date-format';

export {
  type DateTimeNavigationResult,
  parseDateForNavigation,
  parseDateTimeForNavigation,
} from './pickers/navigation-parsers';

// ============================================
// Hooks
// ============================================

export { useInputAutoWidth } from './hooks/use-input-auto-width';

// ============================================
// Editor access utilities
// ============================================

import type { Editor } from '@tiptap/core';
import type { TokenizedSearchInputRef } from './editor/tokenized-search-input';

/**
 * Extended ref interface that includes internal editor access.
 * This interface is not part of the public API.
 */
interface TokenizedSearchInputRefWithEditor extends TokenizedSearchInputRef {
  /** @internal Internal access to the TipTap editor instance */
  _getInternalEditor: () => Editor | null;
}

/**
 * Gets the internal TipTap editor from a TokenizedSearchInputRef.
 *
 * WARNING: This is an internal API and may change without notice.
 * The editor instance is an implementation detail. Only use for:
 * - Testing and debugging
 * - Advanced customization scenarios
 *
 * @param ref - The ref to the TokenizedSearchInput component
 * @returns The TipTap Editor instance, or null if not available
 */
export function getInternalEditor(ref: TokenizedSearchInputRef | null): Editor | null {
  if (!ref) return null;
  const refWithEditor = ref as TokenizedSearchInputRefWithEditor;
  if (typeof refWithEditor._getInternalEditor === 'function') {
    return refWithEditor._getInternalEditor();
  }
  return null;
}
