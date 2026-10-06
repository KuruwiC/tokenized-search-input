/**
 * Integration tests for the accessible name of a token.
 */

import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createRef } from 'react';
import { afterEach, describe, expect, it } from 'vitest';
import { TokenizedSearchInput } from '../../editor/tokenized-search-input';
import type {
  TokenizedSearchInputProps,
  TokenizedSearchInputRef,
} from '../../editor/tokenized-search-input.types';
import type { FieldDefinition } from '../../types';
import { extendedFields } from '../fixtures';
import { waitForEditor } from '../helpers/get-editor';

afterEach(() => {
  cleanup();
});

async function tokenGroupLabels(
  defaultValue: string,
  props: Partial<TokenizedSearchInputProps> = {}
): Promise<(string | null)[]> {
  const ref = createRef<TokenizedSearchInputRef>();
  render(
    <TokenizedSearchInput
      ref={ref}
      fields={extendedFields}
      freeTextMode="tokenize"
      defaultValue={defaultValue}
      {...props}
    />
  );
  await waitForEditor(ref);
  return (await screen.findAllByRole('group')).map((group) => group.getAttribute('aria-label'));
}

describe('Token aria-label', () => {
  it('names a filter token by its key, operator and value and says it can be edited', async () => {
    const [label] = await tokenGroupLabels('status:is:active');

    expect(label).not.toContain('undefined');
    expect(label).toBe('Filter: status is active. Click to edit.');
  });

  it('keeps the name the free text view gives and adds the state', async () => {
    const labels = await tokenGroupLabels('status:is:active keyword');

    expect(labels).toEqual([
      'Filter: status is active. Click to edit.',
      'Free text: keyword. Click to edit.',
    ]);
  });

  it('says the token is being edited while the user is in it', async () => {
    const user = userEvent.setup();
    await tokenGroupLabels('status:is:active');

    await user.click(screen.getByRole('group'));

    await waitFor(() =>
      expect(screen.getByRole('group')).toHaveAttribute(
        'aria-label',
        'Filter: status is active. Editing.'
      )
    );
  });

  it('says the token is disabled when the input is disabled', async () => {
    const [label] = await tokenGroupLabels('status:is:active', { disabled: true });

    expect(label).toBe('Filter: status is active. Disabled.');
  });

  it('says an immutable token can only be deleted', async () => {
    const lockedStatus: FieldDefinition[] = extendedFields.map((field) =>
      field.key === 'status' ? { ...field, immutable: true } : field
    );

    const [label] = await tokenGroupLabels('status:is:active', { fields: lockedStatus });

    expect(label).toBe('Filter: status is active. Immutable. Click X to delete.');
  });
});
