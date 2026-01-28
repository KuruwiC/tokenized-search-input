/**
 * @module utils/token-attrs
 *
 * **Advanced API** - Token attribute utilities for history management.
 * These constants and functions are intended for advanced customization scenarios.
 * The API surface may change in minor versions.
 *
 * For most use cases, you don't need to interact with these directly.
 */

import type { Transaction } from '@tiptap/pm/state';

/**
 * Token attribute classification for history management.
 *
 * CORE_ATTRS: Changes to these attributes should be recorded in history.
 * DISPLAY_ATTRS: Changes to these attributes should be excluded from history.
 * VALIDATION_ATTRS: Changes to these attributes should be excluded from history.
 * CONFIG_ATTRS: Changes to these attributes should be excluded from history.
 */

/** Core attributes that affect token identity and search semantics. */
export const CORE_ATTRS = ['id', 'key', 'operator', 'value', 'quoted'] as const;

/** Display attributes for visual presentation only. */
export const DISPLAY_ATTRS = ['displayValue', 'startContent', 'endContent'] as const;

/** Validation state attributes. */
export const VALIDATION_ATTRS = ['invalid', 'invalidReason'] as const;

/** Configuration attributes from field definitions. */
export const CONFIG_ATTRS = ['fieldLabel', 'immutable'] as const;

export type CoreAttr = (typeof CORE_ATTRS)[number];
export type DisplayAttr = (typeof DISPLAY_ATTRS)[number];
export type ValidationAttr = (typeof VALIDATION_ATTRS)[number];
export type ConfigAttr = (typeof CONFIG_ATTRS)[number];

/**
 * Check if attribute changes are display-only (no core attribute changes).
 *
 * @param oldAttrs - The original attributes
 * @param newAttrs - The new attributes after merge
 * @returns true if only non-core attributes changed
 */
export function isDisplayOnlyChange(
  oldAttrs: Record<string, unknown>,
  newAttrs: Record<string, unknown>
): boolean {
  for (const attr of CORE_ATTRS) {
    if (oldAttrs[attr] !== newAttrs[attr]) {
      return false;
    }
  }
  return true;
}

export interface UpdateTokenAttrsOptions {
  /** Override automatic history detection. If not specified, history is auto-detected. */
  addToHistory?: boolean;
}

/**
 * Update token attributes with automatic history management.
 *
 * This function analyzes the attribute changes and automatically determines
 * whether the change should be recorded in history:
 *
 * - **Display-only changes** (displayValue, startContent, endContent, invalid, etc.)
 *   are automatically excluded from history.
 * - **Core attribute changes** (key, operator, value, quoted) are included in history.
 * - **Mixed changes** (both core and display attributes) are included in history.
 *
 * This prevents undo loops when display attributes are updated asynchronously
 * (e.g., loading displayValue after token creation).
 *
 * @param tr - The transaction to update
 * @param pos - The position of the token node
 * @param attrs - The attributes to update (merged with existing attributes)
 * @param options - Optional configuration
 * @returns The transaction (for chaining)
 *
 * @example
 * // Display-only update (automatically excluded from history)
 * updateTokenAttrs(tr, pos, { displayValue: 'Japan', startContent: <Flag /> });
 *
 * @example
 * // Core attribute update (automatically included in history)
 * updateTokenAttrs(tr, pos, { value: 'jp' });
 *
 * @example
 * // Mixed update (included in history because value changed)
 * updateTokenAttrs(tr, pos, { value: 'jp', displayValue: 'Japan' });
 *
 * @example
 * // Force exclude from history even with core attribute changes
 * updateTokenAttrs(tr, pos, { value: 'jp' }, { addToHistory: false });
 */
export function updateTokenAttrs(
  tr: Transaction,
  pos: number,
  attrs: Record<string, unknown>,
  options?: UpdateTokenAttrsOptions
): Transaction {
  const node = tr.doc.nodeAt(pos);
  if (!node) return tr;

  const mergedAttrs = { ...node.attrs, ...attrs };

  // Determine if this should be added to history
  // - If explicitly specified, use that value
  // - Otherwise, auto-detect based on whether core attributes changed
  const shouldAddToHistory = options?.addToHistory ?? !isDisplayOnlyChange(node.attrs, mergedAttrs);

  tr.setNodeMarkup(pos, undefined, mergedAttrs);

  // Handle history flag carefully to avoid conflicts when multiple tokens are updated
  // in a single transaction with mixed core/display changes.
  // - If shouldAddToHistory is true, don't override existing false (let core changes win)
  // - If shouldAddToHistory is false, only set if not already set (undefined)
  if (shouldAddToHistory) {
    // Core attribute changed - ensure history is enabled unless explicitly disabled
    if (tr.getMeta('addToHistory') === false && options?.addToHistory === undefined) {
      // A previous display-only update set false, but now we have core changes
      // Remove the false flag to allow history recording
      tr.setMeta('addToHistory', undefined);
    }
  } else {
    // Display-only change - only set false if not already set
    if (tr.getMeta('addToHistory') === undefined) {
      tr.setMeta('addToHistory', false);
    }
  }

  return tr;
}
