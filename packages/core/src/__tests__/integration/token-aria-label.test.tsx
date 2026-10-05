/**
 * Integration tests for the accessible name of a token.
 */

import { cleanup, render } from '@testing-library/react';
import { createRef } from 'react';
import { afterEach, describe, expect, it } from 'vitest';
import {
  TokenizedSearchInput,
  type TokenizedSearchInputRef,
} from '../../editor/tokenized-search-input';
import { Token } from '../../tokens/composition/token';
import { extendedFields } from '../fixtures';
import { waitForEditor } from '../helpers/get-editor';

afterEach(() => {
  cleanup();
});

describe('Token aria-label', () => {
  it('is built from the field label and value when none is given', async () => {
    const ref = createRef<TokenizedSearchInputRef>();
    render(
      <TokenizedSearchInput ref={ref} fields={extendedFields} defaultValue="status:is:active" />
    );
    const editor = await waitForEditor(ref);
    const node = editor?.state.doc.firstChild?.firstChild;
    if (!editor || !node) throw new Error('token not found');

    const { container } = render(
      <Token editor={editor} getPos={() => 1} node={node} deleteNode={() => {}}>
        <span>content</span>
      </Token>
    );

    const label = container.querySelector('[role="group"]')?.getAttribute('aria-label');
    expect(label).not.toContain('undefined');
    expect(label).toBe('Status: active. Click to edit.');
  });

  it('keeps the name a view gives and adds the state', async () => {
    const ref = createRef<TokenizedSearchInputRef>();
    render(
      <TokenizedSearchInput ref={ref} fields={extendedFields} defaultValue="status:is:active" />
    );
    const editor = await waitForEditor(ref);
    const node = editor?.state.doc.firstChild?.firstChild;
    if (!editor || !node) throw new Error('token not found');

    const { container } = render(
      <Token editor={editor} getPos={() => 1} node={node} deleteNode={() => {}} ariaLabel="Named">
        <span>content</span>
      </Token>
    );

    expect(container.querySelector('[role="group"]')).toHaveAttribute(
      'aria-label',
      'Named. Click to edit.'
    );
  });
});
