import type {
  FieldDefinition,
  ValidationConfig,
  ValidationContext,
  ValidationToken,
  Violation,
} from '../../types';

function isRuleDisabled(ruleId: string, field: FieldDefinition | undefined): boolean {
  if (!field?.validation) return false;
  return field.validation[ruleId] === false;
}

function buildTokenFieldMap(
  tokens: ValidationToken[],
  fields: FieldDefinition[]
): Map<number, FieldDefinition | undefined> {
  const map = new Map<number, FieldDefinition | undefined>();
  for (const token of tokens) {
    map.set(
      token.pos,
      fields.find((f) => f.key === token.key)
    );
  }
  return map;
}

function applyFieldOverrides(
  violations: Violation[],
  tokenFieldMap: Map<number, FieldDefinition | undefined>
): Violation[] {
  const result: Violation[] = [];

  for (const violation of violations) {
    const filteredTargets = violation.targets.filter((target) => {
      const field = tokenFieldMap.get(target.pos);
      return !isRuleDisabled(violation.ruleId, field);
    });

    if (filteredTargets.length > 0) {
      result.push({
        ...violation,
        targets: filteredTargets,
      });
    }
  }

  return result;
}

export function runValidation(
  tokens: ValidationToken[],
  fields: FieldDefinition[],
  config: ValidationConfig,
  editingTokenIds: Set<string>
): Violation[] {
  const violations: Violation[] = [];
  const rules = config.rules ?? [];

  // Sort rules by priority (higher first)
  const sortedRules = [...rules].sort((a, b) => (b.priority ?? 0) - (a.priority ?? 0));

  // Build token-to-field map for field override checks
  const tokenFieldMap = buildTokenFieldMap(tokens, fields);

  // Build context for validators
  const context: ValidationContext = {
    tokens,
    fields,
    editingTokenIds,
    isEditing: (token: ValidationToken) => editingTokenIds.has(token.id),
  };

  // Run each rule
  for (const rule of sortedRules) {
    try {
      const result = rule.validate(context);
      for (const violation of result) {
        violations.push(violation);
      }
    } catch (error) {
      console.warn(`Validation rule "${rule.id}" threw an error and was skipped:`, error);
    }
  }

  // Apply field-level overrides to filter violations
  return applyFieldOverrides(violations, tokenFieldMap);
}
