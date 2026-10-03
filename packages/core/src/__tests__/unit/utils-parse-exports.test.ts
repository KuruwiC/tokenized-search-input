import { describe, expect, it } from 'vitest';
import { type ParseDiagnostics, type ParsedQuery, parseQueryToDoc } from '../../utils';

describe('the parse result as the utils entry exports it', () => {
  it('carries the document and its diagnostics', () => {
    const parsed: ParsedQuery = parseQueryToDoc('"open', []);
    const diagnostics: ParseDiagnostics = parsed.diagnostics;

    expect(parsed.doc.type).toBe('doc');
    expect(diagnostics).toEqual({ incompleteQuote: true, unknownFields: [], unknownOperators: [] });
  });
});
