/**
 * A query can name an operator the field of its key does not allow, such as
 * `status:contains:foo` on a field without `contains`. The token keeps what was written
 * and the validation plugin marks it.
 */
import { cleanup, render, waitFor } from '@testing-library/react';
import { createRef } from 'react';
import { afterEach, describe, expect, it } from 'vitest';
import {
  TokenizedSearchInput,
  type TokenizedSearchInputRef,
} from '../../editor/tokenized-search-input';
import type { FieldDefinition } from '../../types';
import { statusField } from '../fixtures/fields';

afterEach(() => {
  cleanup();
});

const invalidCount = () =>
  document.querySelectorAll('.node-filterToken [data-invalid="true"]').length;

describe('an operator the field does not allow', () => {
  it('stays on the token, which is marked invalid with the reason', async () => {
    const ref = createRef<TokenizedSearchInputRef>();
    render(
      <TokenizedSearchInput ref={ref} fields={[statusField]} defaultValue="status:contains:foo" />
    );

    await waitFor(() => expect(invalidCount()).toBe(1));
    expect(ref.current?.getSnapshot().segments).toMatchObject([
      {
        type: 'filter',
        key: 'status',
        operator: 'contains',
        value: 'foo',
        invalid: true,
        invalidReason: 'unknown-operator',
      },
    ]);
    expect(ref.current?.getSnapshot().text).toBe('status:contains:foo');
  });

  it('does not mark a token whose operator the field allows', async () => {
    render(<TokenizedSearchInput fields={[statusField]} defaultValue="status:is_not:active" />);

    await waitFor(() => expect(document.querySelectorAll('.node-filterToken')).toHaveLength(1));
    expect(invalidCount()).toBe(0);
  });

  it('can be switched off for a field like any rule', async () => {
    const lenient: FieldDefinition = { ...statusField, validation: { 'unknown-operator': false } };
    render(<TokenizedSearchInput fields={[lenient]} defaultValue="status:contains:foo" />);

    await waitFor(() => expect(document.querySelectorAll('.node-filterToken')).toHaveLength(1));
    expect(invalidCount()).toBe(0);
  });
});
