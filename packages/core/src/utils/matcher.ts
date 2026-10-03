import type { Matcher } from '../types';

// ============================================
// Score Constants
// ============================================

// Scores are worked out in points out of 100 and returned as a fraction of it, so that every
// matcher answers on the same 0..1 scale.
const SCALE = 100;
const SCORE_EXACT = 100;
const SCORE_PREFIX_BASE = 80;
const SCORE_CASE_BONUS = 5;
const SCORE_CONSECUTIVE_BONUS = 10;
const SCORE_START_BONUS = 15;
const SCORE_BOUNDARY_BONUS = 10;
const SCORE_PER_CONSECUTIVE = 3;
const SCORE_PER_BOUNDARY = 3;
// A partial match never reaches the score of an exact one.
const SCORE_FUZZY_MAX = 99;

// ============================================
// Internal Helpers
// ============================================

function isWordBoundary(char: string): boolean {
  return char === '-' || char === '_' || char === ' ';
}

function fuzzyPoints(input: string, target: string): number {
  if (!input) return 0;
  if (!target) return 0;

  const lowerInput = input.toLowerCase();
  const lowerTarget = target.toLowerCase();

  let inputIdx = 0;
  let targetIdx = 0;
  const matchPositions: number[] = [];

  while (inputIdx < lowerInput.length && targetIdx < lowerTarget.length) {
    if (lowerInput[inputIdx] === lowerTarget[targetIdx]) {
      matchPositions.push(targetIdx);
      inputIdx++;
    }
    targetIdx++;
  }

  if (inputIdx < lowerInput.length) {
    return 0;
  }

  let score = Math.round((input.length / target.length) * 50);

  let consecutiveCount = 0;
  for (let i = 1; i < matchPositions.length; i++) {
    if (matchPositions[i] === matchPositions[i - 1] + 1) {
      consecutiveCount++;
    }
  }
  if (consecutiveCount > 0) {
    score += Math.min(SCORE_CONSECUTIVE_BONUS, consecutiveCount * SCORE_PER_CONSECUTIVE);
  }

  if (matchPositions[0] === 0) {
    score += SCORE_START_BONUS;
  }

  const boundaryCount = matchPositions.filter(
    (pos) => pos === 0 || isWordBoundary(target[pos - 1])
  ).length;
  score += Math.min(SCORE_BOUNDARY_BONUS, boundaryCount * SCORE_PER_BOUNDARY);

  let caseMatches = 0;
  for (let i = 0; i < matchPositions.length; i++) {
    if (input[i] === target[matchPositions[i]]) {
      caseMatches++;
    }
  }
  if (caseMatches === input.length) {
    score += SCORE_CASE_BONUS;
  }

  return Math.max(1, Math.min(SCORE_FUZZY_MAX, score));
}

// ============================================
// Built-in Matchers (Single Target)
// ============================================

/**
 * Case-sensitive exact match.
 * Returns 1 for an exact match, 0 otherwise.
 */
export const exact: Matcher = (input, target) => {
  return input === target ? SCORE_EXACT / SCALE : 0;
};

/**
 * Case-insensitive exact match.
 * Returns 1 for a match, 0 otherwise.
 */
export const caseInsensitive: Matcher = (input, target) => {
  return input.toLowerCase() === target.toLowerCase() ? SCORE_EXACT / SCALE : 0;
};

/**
 * Case-insensitive prefix match.
 * Returns 0.8 for a match, or 0.85 when the case matches too; 0 otherwise.
 */
export const prefix: Matcher = (input, target) => {
  const lowerInput = input.toLowerCase();
  const lowerTarget = target.toLowerCase();

  if (!lowerTarget.startsWith(lowerInput)) {
    return 0;
  }

  return (SCORE_PREFIX_BASE + (target.startsWith(input) ? SCORE_CASE_BONUS : 0)) / SCALE;
};

/**
 * fzf-style fuzzy matcher.
 * Returns 1 for an exact match, ignoring case, and 0 when the input is not a subsequence of
 * the target. Otherwise the score is between 0.01 and 0.99: it grows with the share of the
 * target the input covers, consecutive matches (up to 0.1), a match at the start (0.15),
 * matches at word boundaries (up to 0.1) and matching case (0.05).
 */
export const fuzzy: Matcher = (input, target) => {
  if (input.toLowerCase() === target.toLowerCase()) return SCORE_EXACT / SCALE;
  return fuzzyPoints(input, target) / SCALE;
};

// ============================================
// Namespace Export
// ============================================

/**
 * Built-in matchers for filtering suggestions.
 *
 * @example
 * import { matchers } from '@kuruwic/tokenized-search-input/utils';
 *
 * const field: EnumFieldDefinition = {
 *   key: 'status',
 *   type: 'enum',
 *   enumValues: ['active', 'inactive'],
 *   suggestionMatcher: matchers.fuzzy, // default
 * };
 */
export const matchers = {
  exact,
  caseInsensitive,
  prefix,
  fuzzy,
} as const;

/**
 * Default matcher used when suggestionMatcher is not specified.
 */
export const defaultMatcher = fuzzy;

// ============================================
// Helper Functions
// ============================================

/**
 * Match input against multiple targets and return the highest score, on the 0..1 scale of the
 * matcher.
 *
 * @example
 * // Match against both value and label
 * const score = matchBest(matchers.fuzzy, 'act', 'active', 'Active Status');
 */
export function matchBest(matcher: Matcher, input: string, ...targets: string[]): number {
  if (targets.length === 0) return 0;
  const validTargets = targets.filter((t): t is string => t != null);
  if (validTargets.length === 0) return 0;
  return Math.max(...validTargets.map((t) => matcher(input, t)));
}
