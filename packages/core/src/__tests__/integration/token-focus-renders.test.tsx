/**
 * A focus move re-renders only the token focus leaves and the token it enters.
 * Token renders are counted by wrapping the Token component.
 */
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createRef } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  TokenizedSearchInput,
  type TokenizedSearchInputRef,
} from '../../editor/tokenized-search-input';
import { extendedFields } from '../fixtures';
import { waitForEditor } from '../helpers/get-editor';
import { filterTokens } from '../helpers/token-queries';

const renderedTokenIds = vi.hoisted(() => [] as string[]);

vi.mock('../../tokens/composition/token', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../tokens/composition/token')>();
  const CountedToken = (props: Parameters<typeof actual.Token>[0]) => {
    renderedTokenIds.push(String(props.node.attrs.id));
    return actual.Token(props);
  };
  return { ...actual, Token: Object.assign(CountedToken, actual.Token) };
});

afterEach(() => {
  cleanup();
});

function valueInputOf(name: RegExp): HTMLInputElement | null {
  return screen.getByRole('group', { name }).querySelector('input');
}

describe('Token focus renders', () => {
  it('re-renders only the token focus leaves and the token it enters', async () => {
    const user = userEvent.setup();
    const ref = createRef<TokenizedSearchInputRef>();
    render(
      <TokenizedSearchInput
        ref={ref}
        fields={extendedFields}
        defaultValue="status:is:active priority:is:high assignee:is:john"
      />
    );
    await waitForEditor(ref);
    const [status, priority] = filterTokens(ref);

    await user.click(screen.getByRole('group', { name: /status/i }));
    await waitFor(() => expect(document.activeElement).toBe(valueInputOf(/status/i)));

    renderedTokenIds.length = 0;
    await user.click(screen.getByRole('group', { name: /priority/i }));
    await waitFor(() => expect(document.activeElement).toBe(valueInputOf(/priority/i)));

    expect(new Set(renderedTokenIds)).toEqual(new Set([status.id, priority.id]));
  });
});
