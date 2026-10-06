/**
 * Integration tests for the accessible name of a token.
 */

import { cleanup, render, screen } from '@testing-library/react';
import { createRef } from 'react';
import { afterEach, describe, expect, it } from 'vitest';
import { TokenizedSearchInput } from '../../editor/tokenized-search-input';
import type { TokenizedSearchInputRef } from '../../editor/tokenized-search-input.types';
import { extendedFields } from '../fixtures';
import { waitForEditor } from '../helpers/get-editor';

afterEach(() => {
  cleanup();
});

async function tokenGroupLabels(defaultValue: string): Promise<(string | null)[]> {
  const ref = createRef<TokenizedSearchInputRef>();
  render(
    <TokenizedSearchInput
      ref={ref}
      fields={extendedFields}
      freeTextMode="tokenize"
      defaultValue={defaultValue}
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
});
