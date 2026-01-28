import { describe, expect, it } from 'vitest';
import type { FieldDefinition } from '../../types';
import {
  defaultLabelResolver,
  labelResolvers,
  resolveLabel,
  resolveLabelToField,
} from '../../utils/label-resolve';

const fields: FieldDefinition[] = [
  { key: 'status', label: 'Status', type: 'string', operators: ['is'] },
  { key: 'priority', label: 'Priority', type: 'string', operators: ['is'] },
  { key: 'assignee', label: 'Assigned To', type: 'string', operators: ['is'] },
];

describe('labelResolvers', () => {
  describe('caseInsensitive', () => {
    it('matches key case-insensitively', () => {
      const result = labelResolvers.caseInsensitive({
        query: 'STATUS',
        field: { key: 'status', label: 'Status' },
      });
      expect(result).toBe('status');
    });

    it('matches label case-insensitively', () => {
      const result = labelResolvers.caseInsensitive({
        query: 'ASSIGNED TO',
        field: { key: 'assignee', label: 'Assigned To' },
      });
      expect(result).toBe('assignee');
    });

    it('returns null when no match', () => {
      const result = labelResolvers.caseInsensitive({
        query: 'unknown',
        field: { key: 'status', label: 'Status' },
      });
      expect(result).toBeNull();
    });
  });

  describe('exact', () => {
    it('matches key exactly', () => {
      const result = labelResolvers.exact({
        query: 'status',
        field: { key: 'status', label: 'Status' },
      });
      expect(result).toBe('status');
    });

    it('matches label exactly', () => {
      const result = labelResolvers.exact({
        query: 'Status',
        field: { key: 'status', label: 'Status' },
      });
      expect(result).toBe('status');
    });

    it('returns null when case does not match', () => {
      const result = labelResolvers.exact({
        query: 'STATUS',
        field: { key: 'status', label: 'Status' },
      });
      expect(result).toBeNull();
    });
  });
});

describe('defaultLabelResolver', () => {
  it('is caseInsensitive', () => {
    expect(defaultLabelResolver).toBe(labelResolvers.caseInsensitive);
  });
});

describe('resolveLabel', () => {
  it('resolves input to field key (case-insensitive)', () => {
    const result = resolveLabel(fields, 'STATUS');
    expect(result).toBe('status');
  });

  it('resolves label to field key', () => {
    const result = resolveLabel(fields, 'Assigned To');
    expect(result).toBe('assignee');
  });

  it('returns original input when no match', () => {
    const result = resolveLabel(fields, 'unknown');
    expect(result).toBe('unknown');
  });

  it('returns empty string for empty input', () => {
    const result = resolveLabel(fields, '');
    expect(result).toBe('');
  });

  it('returns original input when fields is empty', () => {
    const result = resolveLabel([], 'status');
    expect(result).toBe('status');
  });

  it('uses custom resolver when provided', () => {
    const result = resolveLabel(fields, 'STATUS', {
      resolver: labelResolvers.exact,
    });
    // exact resolver should not match because case is different
    expect(result).toBe('STATUS');
  });

  it('finds first matching field', () => {
    const duplicateFields: FieldDefinition[] = [
      { key: 'status1', label: 'Status', type: 'string', operators: ['is'] },
      { key: 'status2', label: 'Status', type: 'string', operators: ['is'] },
    ];
    const result = resolveLabel(duplicateFields, 'Status');
    expect(result).toBe('status1');
  });
});

describe('resolveLabelToField', () => {
  it('returns matching FieldDefinition', () => {
    const result = resolveLabelToField(fields, 'status');
    expect(result).toBeDefined();
    expect(result?.key).toBe('status');
    expect(result?.label).toBe('Status');
  });

  it('returns undefined when no match', () => {
    const result = resolveLabelToField(fields, 'unknown');
    expect(result).toBeUndefined();
  });

  it('matches by label', () => {
    const result = resolveLabelToField(fields, 'Assigned To');
    expect(result).toBeDefined();
    expect(result?.key).toBe('assignee');
  });

  it('matches case-insensitively', () => {
    const result = resolveLabelToField(fields, 'PRIORITY');
    expect(result).toBeDefined();
    expect(result?.key).toBe('priority');
  });
});
