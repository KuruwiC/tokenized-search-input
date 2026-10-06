import type { FieldDefinition } from '../../../types';
import { defaultMatcher } from '../../../utils/matcher';

export interface SortOptions {
  /** Input query for filtering */
  inputQuery?: string;
}

/**
 * Calculate field compatibility score.
 * Higher score = more compatible.
 */
function getFieldScore(field: FieldDefinition, currentField: FieldDefinition | undefined): number {
  if (!currentField) return 50;

  let score = 0;

  if (field.type === currentField.type) {
    score += 100;
    if (field.type === 'enum' && currentField.type === 'enum') {
      const fieldValues = new Set(field.enumValues || []);
      const currentValues = new Set(currentField.enumValues || []);
      const intersection = new Set([...fieldValues].filter((v) => currentValues.has(v)));
      const union = new Set([...fieldValues, ...currentValues]);
      if (union.size > 0) {
        score += Math.round((intersection.size / union.size) * 50);
      }
    }
  }

  return score;
}

/**
 * Check if field matches query using the default matcher.
 * Returns the best score from matching against label or key.
 */
function getMatchScore(field: FieldDefinition, query: string): number {
  if (!query) return 100; // No query means match all
  const labelScore = defaultMatcher(query, field.label);
  const keyScore = defaultMatcher(query, field.key);
  return Math.max(labelScore, keyScore);
}

export function getSortedFields(
  currentField: FieldDefinition | undefined,
  allFields: readonly FieldDefinition[],
  options: SortOptions = {}
): FieldDefinition[] {
  const { inputQuery = '' } = options;

  const filtered = allFields.filter((f) => getMatchScore(f, inputQuery) > 0);

  return filtered.sort((a, b) => {
    const compatScoreA = getFieldScore(a, currentField);
    const compatScoreB = getFieldScore(b, currentField);

    if (compatScoreB !== compatScoreA) return compatScoreB - compatScoreA;

    if (inputQuery) {
      const matchScoreA = getMatchScore(a, inputQuery);
      const matchScoreB = getMatchScore(b, inputQuery);
      if (matchScoreB !== matchScoreA) return matchScoreB - matchScoreA;
    }

    return a.label.localeCompare(b.label);
  });
}
