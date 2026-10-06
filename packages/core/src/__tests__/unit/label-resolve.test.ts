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

  it('returns undefined when the resolver matches no field, even for input equal to a key', () => {
    const labelOnly = (ctx: { query: string; field: { key: string; label: string } }) =>
      ctx.query === ctx.field.label ? ctx.field.key : null;
    expect(resolveLabelToField(fields, 'status', { resolver: labelOnly })).toBeUndefined();
    expect(resolveLabelToField(fields, 'status', { resolver: () => null })).toBeUndefined();
    expect(resolveLabelToField(fields, 'Status', { resolver: labelOnly })?.key).toBe('status');
  });

  it('returns undefined when the resolver names a key no field has', () => {
    expect(resolveLabelToField(fields, 'status', { resolver: () => 'missing' })).toBeUndefined();
  });
});

describe('resolveLabel when the resolver matches no field', () => {
  it('returns the input as written', () => {
    expect(resolveLabel(fields, 'status', { resolver: () => null })).toBe('status');
  });
});

describe('a field whose key equals the input', () => {
  const authorFields: FieldDefinition[] = [
    { key: 'reporter', label: 'Author', type: 'string', operators: ['is'] },
    { key: 'author', label: 'Writer', type: 'string', operators: ['is'] },
  ];

  it('is tried first, before an earlier field whose label the resolver accepts', () => {
    expect(resolveLabel(authorFields, 'author')).toBe('author');
    expect(resolveLabelToField(authorFields, 'author')?.key).toBe('author');
    expect(resolveLabel(authorFields, 'author', { resolver: labelResolvers.exact })).toBe('author');
  });

  it('is tried first with a custom resolver that also accepts an earlier label', () => {
    const prefix = (ctx: { query: string; field: { key: string; label: string } }) => {
      const q = ctx.query.toLowerCase();
      return ctx.field.key.startsWith(q) || ctx.field.label.toLowerCase().startsWith(q)
        ? ctx.field.key
        : null;
    };
    const assignFields: FieldDefinition[] = [
      { key: 'owner', label: 'Assignee', type: 'string', operators: ['is'] },
      { key: 'assignee', label: 'Assigned to', type: 'string', operators: ['is'] },
    ];
    expect(resolveLabel(assignFields, 'assignee', { resolver: prefix })).toBe('assignee');
    // A prefix of a key equals no key, so the fields are tried in order
    expect(resolveLabel(assignFields, 'assig', { resolver: prefix })).toBe('owner');
  });

  it('still has to be accepted by the resolver', () => {
    const labelOnly = (ctx: { query: string; field: { key: string; label: string } }) =>
      ctx.query.toLowerCase() === ctx.field.label.toLowerCase() ? ctx.field.key : null;
    expect(resolveLabel(authorFields, 'author', { resolver: labelOnly })).toBe('reporter');
  });
});

describe('input that equals no key', () => {
  const authorFields: FieldDefinition[] = [
    { key: 'reporter', label: 'Author', type: 'string', operators: ['is'] },
    { key: 'author', label: 'Writer', type: 'string', operators: ['is'] },
  ];

  it('is resolved by field order, so a looser key match loses to an earlier label', () => {
    expect(resolveLabel(authorFields, 'AUTHOR')).toBe('reporter');
    expect(resolveLabel(authorFields, 'Author')).toBe('reporter');
    expect(resolveLabel(authorFields, 'Writer')).toBe('author');
  });

  it('is offered to the resolver with the fields as given', () => {
    const seen: { key: string; label: string }[] = [];
    const labelPrefix = (ctx: { query: string; field: { key: string; label: string } }) => {
      seen.push(ctx.field);
      return ctx.query.startsWith(ctx.field.label) ? ctx.field.key : null;
    };
    expect(resolveLabel(authorFields, 'Zed', { resolver: labelPrefix })).toBe('Zed');
    expect(resolveLabelToField(authorFields, 'Zed', { resolver: labelPrefix })).toBeUndefined();
    expect(resolveLabel(authorFields, 'Writers', { resolver: labelPrefix })).toBe('author');
    expect(seen.length).toBeGreaterThan(0);
    const given = authorFields.map(({ key, label }) => ({ key, label }));
    for (const field of seen) expect(given).toContainEqual(field);
  });
});
