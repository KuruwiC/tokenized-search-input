/**
 * Shared test field fixtures for consistent testing across all test files.
 *
 * These field definitions cover the common use cases:
 * - Enum fields with multiple values
 * - String fields for free-form input
 * - Fields with single/multiple operators
 * - Dot-notation keys for nested structures
 * - Fields with special validation settings
 */
import type { FieldDefinition } from '../../types';

// ============================================================
// Individual Field Definitions
// ============================================================

/**
 * Basic enum field with multiple values.
 * Used for testing standard filter token creation.
 */
export const statusField: FieldDefinition = {
  key: 'status',
  label: 'Status',
  type: 'enum',
  category: 'Basic',
  operators: ['is', 'is_not'],
  enumValues: ['active', 'inactive', 'pending'],
};

/**
 * Another enum field for multi-token tests.
 * Has multiple operators for operator dropdown testing.
 */
export const priorityField: FieldDefinition = {
  key: 'priority',
  label: 'Priority',
  type: 'enum',
  category: 'Basic',
  operators: ['is', 'is_not'],
  enumValues: ['high', 'medium', 'low'],
};

/**
 * Priority field with additional operators.
 * Use this when testing operator selection UI.
 */
export const priorityFieldWithManyOperators: FieldDefinition = {
  key: 'priority',
  label: 'Priority',
  type: 'enum',
  category: 'Basic',
  operators: ['is', 'is_not', 'contains'],
  enumValues: ['high', 'medium', 'low'],
};

/**
 * String field for free-form input tests.
 */
export const assigneeField: FieldDefinition = {
  key: 'assignee',
  label: 'Assignee',
  type: 'string',
  category: 'User',
  operators: ['is', 'contains'],
};

/**
 * Dot-notation field for nested key tests.
 */
export const userEmailField: FieldDefinition = {
  key: 'user.email',
  label: 'User Email',
  type: 'string',
  category: 'User',
  operators: ['is', 'contains', 'not_contains'],
};

/**
 * Field with single operator.
 * Should not render operator dropdown.
 */
export const nameField: FieldDefinition = {
  key: 'name',
  label: 'Name',
  type: 'string',
  category: 'Basic',
  operators: ['is'],
};

/**
 * Tag field that explicitly allows duplicates.
 * Used for validation rule override testing.
 */
export const tagField: FieldDefinition = {
  key: 'tag',
  label: 'Tag',
  type: 'string',
  operators: ['is'],
  validation: {
    'unique-key': false,
  },
};

/**
 * Tag field with hidden operator display.
 * Used for testing hideSingleOperator feature.
 */
export const tagFieldWithHiddenOperator: FieldDefinition = {
  key: 'tag',
  label: 'Tag',
  type: 'enum',
  operators: ['is'],
  enumValues: ['react', 'vue', 'angular'],
  tokenLabelDisplay: 'hidden',
  hideSingleOperator: true,
};

/**
 * Category field with hidden label.
 * Has multiple operators so hideSingleOperator has no effect.
 */
export const categoryFieldWithMultipleOperators: FieldDefinition = {
  key: 'category',
  label: 'Category',
  type: 'enum',
  operators: ['is', 'is_not'],
  enumValues: ['frontend', 'backend', 'devops'],
  hideSingleOperator: true, // Has no effect because multiple operators exist
};

// ============================================================
// Pre-composed Field Sets
// ============================================================

/**
 * Basic field set with two enum fields.
 * Most commonly used for simple tests.
 */
export const basicFields: FieldDefinition[] = [statusField, priorityField];

/**
 * Extended field set including string fields.
 * Used for tests requiring different field types.
 */
export const extendedFields: FieldDefinition[] = [statusField, priorityField, assigneeField];

/**
 * Field set with dot-notation key.
 * Used for serializer and parser tests.
 */
export const fieldsWithDotNotation: FieldDefinition[] = [
  statusField,
  userEmailField,
  priorityField,
];

/**
 * Field set including single-operator field.
 * Used for operator dropdown visibility tests.
 */
export const fieldsWithSingleOperator: FieldDefinition[] = [
  statusField,
  priorityFieldWithManyOperators,
  nameField,
];

/**
 * Field set including tag field that allows duplicates.
 * Used for validation system tests.
 */
export const fieldsWithValidationOverride: FieldDefinition[] = [
  statusField,
  priorityField,
  tagField,
];

/**
 * Field set for testing hideSingleOperator feature.
 * Includes fields with and without hidden operator.
 */
export const fieldsWithHiddenOperator: FieldDefinition[] = [
  statusField,
  tagFieldWithHiddenOperator,
  categoryFieldWithMultipleOperators,
];

/**
 * Comprehensive field set for general testing.
 * Includes all common field types.
 */
export const allFields: FieldDefinition[] = [
  statusField,
  priorityField,
  assigneeField,
  userEmailField,
  nameField,
  tagField,
  tagFieldWithHiddenOperator,
  categoryFieldWithMultipleOperators,
];

// ============================================================
// Date Fields
// ============================================================

/**
 * Date field for testing date picker.
 */
export const dateField: FieldDefinition = {
  key: 'created',
  label: 'Created',
  type: 'date',
  operators: ['gt', 'lt'],
};

/**
 * Datetime field for testing datetime picker.
 */
export const datetimeField: FieldDefinition = {
  key: 'updated',
  label: 'Updated',
  type: 'datetime',
  operators: ['gt', 'lt'],
};

/**
 * Field set including date fields.
 * Used for date picker integration tests.
 */
export const fieldsWithDate: FieldDefinition[] = [statusField, dateField, datetimeField];
