/**
 * Integration tests for the check every date and datetime field gets: a value the date
 * parser rejects marks the token, without any validate function on the field. Which values
 * the parser accepts is covered in unit/validation-implicit-rules.test.ts; these tests
 * cover that the rule runs in the editor and that a field can turn it off.
 */
import { cleanup, render, waitFor } from '@testing-library/react';
import { createRef } from 'react';
import { afterEach, describe, expect, it } from 'vitest';
import { TokenizedSearchInput } from '../../editor/tokenized-search-input';
import type { TokenizedSearchInputRef } from '../../editor/tokenized-search-input.types';
import type { FieldDefinition } from '../../types';
import { dateField, datetimeField, statusField } from '../fixtures/fields';
import { filterTokens, invalidTokenCount } from '../helpers/token-queries';

afterEach(() => {
  cleanup();
});

const tokenCount = () => document.querySelectorAll('.node-filterToken').length;

async function expectCounts(total: number, invalid: number) {
  await waitFor(() => expect(tokenCount()).toBe(total));
  await waitFor(() => expect(invalidTokenCount()).toBe(invalid));
}

describe('implicit date validation in the editor', () => {
  it('marks the dates the parser rejects and leaves the accepted ones unmarked', async () => {
    const ref = createRef<TokenizedSearchInputRef>();
    render(
      <TokenizedSearchInput
        ref={ref}
        fields={[statusField, dateField, datetimeField]}
        defaultValue={[
          // Partial or non-existent: marked
          'created:gt:2024',
          'created:lt:2024-02-31',
          // A complete date, and a datetime with an offset or milliseconds: accepted
          'created:gt:2024-03-05',
          'updated:gt:2024-03-05T14:30:00+0900',
          'updated:lt:2024-03-05T14:30:45.123Z',
        ].join(' ')}
      />
    );
    await expectCounts(5, 2);
    expect(
      filterTokens(ref).map((token) => [
        `${token.key}:${token.operator}:${token.value}`,
        token.invalid === true,
      ])
    ).toEqual([
      ['created:gt:2024', true],
      ['created:lt:2024-02-31', true],
      ['created:gt:2024-03-05', false],
      ['updated:gt:2024-03-05T14:30:00+0900', false],
      ['updated:lt:2024-03-05T14:30:45.123Z', false],
    ]);
  });

  it('can be turned off for a field like any rule', async () => {
    const lenient: FieldDefinition = { ...dateField, validation: { 'date-value': false } };
    render(<TokenizedSearchInput fields={[statusField, lenient]} defaultValue="created:gt:2024" />);
    await expectCounts(1, 0);
  });
});
