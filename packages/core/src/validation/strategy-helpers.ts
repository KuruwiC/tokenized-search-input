/**
 * @module validation/strategy-helpers
 *
 * **Advanced API** - These utilities are intended for users implementing
 * custom validation strategies. The API surface may change in minor versions.
 *
 * For most use cases, prefer using the built-in presets:
 * - `Unique` - Enforce uniqueness constraints
 * - `MaxCount` - Limit token counts
 * - `RequirePattern` - Validate against regex patterns
 * - `RequireEnum` - Restrict to enum values
 */

import type { ValidationContext, ValidationToken, Violation } from '../types';

export interface EditStatePartition {
  newOrEditing: ValidationToken[];
  untouched: ValidationToken[];
}

/**
 * Split tokens by edit state.
 * - newOrEditing: tokens that were added or modified in the current operation
 * - untouched: tokens that existed before the current operation
 */
export const splitByEditState = (
  tokens: ValidationToken[],
  ctx: ValidationContext
): EditStatePartition => ({
  newOrEditing: tokens.filter((t) => ctx.isEditing(t)),
  untouched: tokens.filter((t) => !ctx.isEditing(t)),
});

/** Get tokens that were added or modified in the current operation. */
export const getNewOrEditingTokens = (
  tokens: ValidationToken[],
  ctx: ValidationContext
): ValidationToken[] => tokens.filter((t) => ctx.isEditing(t));

/** Get tokens that existed before the current operation. */
export const getUntouchedTokens = (
  tokens: ValidationToken[],
  ctx: ValidationContext
): ValidationToken[] => tokens.filter((t) => !ctx.isEditing(t));

/** Build violation targets from tokens. */
export const buildTargets = (tokens: ValidationToken[]) =>
  tokens.map((t) => ({ tokenId: t.id, pos: t.pos }));

export interface ViolationOptions {
  ruleId: string;
  reason?: string;
  message?: string;
}

/**
 * Create a delete violation for the given tokens.
 * Returns null if targets is empty.
 */
export const createDeleteViolation = (
  targets: ValidationToken[],
  options: ViolationOptions
): Violation | null => {
  if (targets.length === 0) return null;
  return {
    ruleId: options.ruleId,
    reason: options.reason ?? 'custom',
    message: options.message,
    action: 'delete',
    targets: buildTargets(targets),
  };
};

/**
 * Create a mark violation for the given tokens.
 * Returns null if targets is empty.
 */
export const createMarkViolation = (
  targets: ValidationToken[],
  options: ViolationOptions
): Violation | null => {
  if (targets.length === 0) return null;
  return {
    ruleId: options.ruleId,
    reason: options.reason ?? 'custom',
    message: options.message,
    action: 'mark',
    targets: buildTargets(targets),
  };
};
