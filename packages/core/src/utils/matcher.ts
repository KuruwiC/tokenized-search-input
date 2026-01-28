import type { Matcher } from '../types';

// ============================================
// Score Constants
// ============================================

const SCORE_EXACT = 100;
const SCORE_PREFIX_BASE = 80;
const SCORE_CASE_BONUS = 5;
const SCORE_CONSECUTIVE_BONUS = 10;
const SCORE_START_BONUS = 15;
const SCORE_BOUNDARY_BONUS = 10;

// ============================================
// Internal Helpers
// ============================================

function isWordBoundary(char: string): boolean {
  return char === '-' || char === '_' || char === ' ';
}

function fuzzyScore(input: string, target: string): number {
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
    score += Math.min(SCORE_CONSECUTIVE_BONUS, consecutiveCount * 3);
  }

  if (matchPositions[0] === 0) {
    score += SCORE_START_BONUS;
  }

  for (const pos of matchPositions) {
    if (pos === 0 || (pos > 0 && isWordBoundary(target[pos - 1]))) {
      score += Math.min(SCORE_BOUNDARY_BONUS, 3);
    }
  }

  let caseMatches = 0;
  for (let i = 0; i < matchPositions.length; i++) {
    if (input[i] === target[matchPositions[i]]) {
      caseMatches++;
    }
  }
  if (caseMatches === input.length) {
    score += SCORE_CASE_BONUS;
  }

  return Math.max(1, Math.min(99, score));
}

// ============================================
// Built-in Matchers (Single Target)
// ============================================

/**
 * Case-sensitive exact match.
 * Returns 100 for exact match, 0 otherwise.
 */
export const exact: Matcher = (input, target) => {
  return input === target ? SCORE_EXACT : 0;
};

/**
 * Case-insensitive exact match.
 * Returns 100 for match, 0 otherwise.
 */
export const caseInsensitive: Matcher = (input, target) => {
  return input.toLowerCase() === target.toLowerCase() ? SCORE_EXACT : 0;
};

/**
 * Case-insensitive prefix match.
 * Returns 80 + case bonus for match, 0 otherwise.
 */
export const prefix: Matcher = (input, target) => {
  const lowerInput = input.toLowerCase();
  const lowerTarget = target.toLowerCase();

  if (!lowerTarget.startsWith(lowerInput)) {
    return 0;
  }

  return SCORE_PREFIX_BASE + (target.startsWith(input) ? SCORE_CASE_BONUS : 0);
};

/**
 * fzf-style fuzzy matcher.
 * Scores based on consecutive matches, start position, word boundaries, and case.
 */
export const fuzzy: Matcher = (input, target) => {
  if (input === target) return SCORE_EXACT;
  if (input.toLowerCase() === target.toLowerCase()) return SCORE_EXACT;
  return fuzzyScore(input, target);
};

// ============================================
// Namespace Export
// ============================================

/**
 * Built-in matchers for filtering suggestions.
 *
 * @example
 * import { matchers } from 'search-input';
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
 * Match input against multiple targets and return the highest score.
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
