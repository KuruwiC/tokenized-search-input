/**
 * Integration tests for token creation flows.
 * These tests verify the complete user journey from input to token creation.
 */
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  TokenizedSearchInput,
  type TokenizedSearchInputRef,
} from '../../editor/tokenized-search-input';
import { extendedFields } from '../fixtures';
import { getInternalEditor } from '../helpers/get-editor';

const testFields = extendedFields;

afterEach(() => {
  cleanup();
});

describe('Token Creation - User Journeys', () => {
  describe('Filter token creation via field suggestion', () => {
    it('creates filter token: click editor → select field → enter value → confirm', async () => {
      const onChange = vi.fn();
      const user = userEvent.setup();
      render(<TokenizedSearchInput fields={testFields} onChange={onChange} />);

      const editor = screen.getByRole('combobox');

      // Step 1: Click editor to show field suggestions
      await user.click(editor);
      await waitFor(() => {
        expect(screen.getByText('Status')).toBeInTheDocument();
      });

      // Step 2: Select field from suggestions
      await user.click(screen.getByText('Status'));
      await waitFor(() => {
        expect(screen.getByPlaceholderText('...')).toBeInTheDocument();
      });

      // Step 3: Enter value
      const valueInput = screen.getByPlaceholderText('...');
      await user.type(valueInput, 'active');

      // Step 4: Confirm with Enter
      await user.keyboard('{Enter}');

      // Verify: Token created with correct value
      await waitFor(() => {
        expect(onChange).toHaveBeenCalledWith(
          expect.objectContaining({ text: expect.stringContaining('status:is:active') })
        );
      });
    });

    it('creates filter token: keyboard only flow with ArrowDown selection', async () => {
      const onChange = vi.fn();
      const user = userEvent.setup();
      render(<TokenizedSearchInput fields={testFields} onChange={onChange} />);

      const editor = screen.getByRole('combobox');

      // Step 1: Focus editor
      await user.click(editor);
      await waitFor(() => {
        expect(screen.getByText('Status')).toBeInTheDocument();
      });

      // Step 2: Navigate to select first item (Status), then to Priority
      await user.keyboard('{ArrowDown}'); // Select Status
      await user.keyboard('{ArrowDown}'); // Navigate to Priority
      await waitFor(() => {
        const priorityItem = screen.getByText('Priority').closest('[role="option"]');
        expect(priorityItem).toHaveAttribute('data-active', 'true');
      });

      // Step 3: Select Priority with Enter
      await user.keyboard('{Enter}');
      await waitFor(() => {
        expect(screen.getByPlaceholderText('...')).toBeInTheDocument();
      });

      // Step 4: Select value from enum suggestions
      await waitFor(() => {
        expect(screen.getByText('high')).toBeInTheDocument();
      });
      await user.click(screen.getByText('high'));

      // Verify: Token created
      await waitFor(() => {
        expect(onChange).toHaveBeenCalledWith(
          expect.objectContaining({ text: expect.stringContaining('priority:is:high') })
        );
      });
    });
  });

  describe('Filter token creation via colon trigger', () => {
    it('creates filter token when typing field:value', async () => {
      const onChange = vi.fn();
      const user = userEvent.setup();
      render(<TokenizedSearchInput fields={testFields} onChange={onChange} />);

      const editor = screen.getByRole('combobox');
      await user.click(editor);

      // Close field suggestions first
      await user.keyboard('{Escape}');
      await waitFor(() => {
        expect(screen.queryByText('Status')).not.toBeInTheDocument();
      });

      // Type field:value and space to confirm
      await user.type(editor, 'status:active ');

      // Verify: Token created
      await waitFor(() => {
        const filterToken = screen.getByRole('group', { name: /Filter: status/i });
        expect(filterToken).toBeInTheDocument();
      });
    });

    it('enters edit mode when typing field: (colon only)', async () => {
      const user = userEvent.setup();
      render(<TokenizedSearchInput fields={testFields} />);

      const editor = screen.getByRole('combobox');
      await user.click(editor);

      // Close field suggestions
      await user.keyboard('{Escape}');

      // Type field name and colon
      await user.type(editor, 'status:');

      // Verify: Enters edit mode with value input
      await waitFor(() => {
        expect(screen.getByPlaceholderText('...')).toBeInTheDocument();
      });
    });

    it('does not create token for unknown field', async () => {
      const user = userEvent.setup();
      render(<TokenizedSearchInput fields={testFields} />);

      const editor = screen.getByRole('combobox');
      await user.click(editor);
      await user.keyboard('{Escape}');

      // Type unknown field
      await user.type(editor, 'unknown:value ');

      // Verify: No filter token created (text remains as plain text)
      expect(screen.queryByRole('group', { name: /Filter: unknown/i })).not.toBeInTheDocument();
    });
  });

  describe('FreeText token creation', () => {
    it('creates free text token on word + space in tokenize mode', async () => {
      const user = userEvent.setup();
      render(<TokenizedSearchInput fields={testFields} freeTextMode="tokenize" />);

      const editor = screen.getByRole('combobox');
      await user.click(editor);
      await user.keyboard('{Escape}');

      // Type a non-field word and space
      await user.type(editor, 'searchterm ');

      // Verify: Free text token created
      await waitFor(() => {
        const freeTextToken = screen.getByRole('group', { name: /Free text: searchterm/i });
        expect(freeTextToken).toBeInTheDocument();
      });
    });

    it('creates quoted free text token when starting with "', async () => {
      const user = userEvent.setup();
      render(<TokenizedSearchInput fields={testFields} freeTextMode="tokenize" />);

      const editor = screen.getByRole('combobox');
      await user.click(editor);
      await user.keyboard('{Escape}');

      // Start quoted text
      await user.type(editor, '"');

      // Verify: Quoted token created
      await waitFor(() => {
        const quotedToken = screen.getByRole('group', { name: /Free text/i });
        // data-quoted attribute is on the inner token element, not the outer wrapper
        const innerToken = quotedToken.querySelector('[data-quoted]');
        expect(innerToken).toHaveAttribute('data-quoted', 'true');
      });
    });

    it('does not include free text in search query when none', async () => {
      const onSubmit = vi.fn();
      const user = userEvent.setup();
      // In none mode, plain text is not tokenized but also not included in search
      render(
        <TokenizedSearchInput
          fields={testFields}
          defaultValue="status:is:active"
          freeTextMode="none"
          onSubmit={onSubmit}
        />
      );

      await waitFor(() => {
        expect(screen.getByText('Status')).toBeInTheDocument();
      });

      // Execute search
      const editor = screen.getByRole('combobox');
      await user.click(editor);
      await user.keyboard('{Escape}');
      await user.keyboard('{Enter}');

      // Verify: Search called with only filter token
      await waitFor(() => {
        expect(onSubmit).toHaveBeenCalled();
        const [snapshot] = onSubmit.mock.calls[0];
        expect(snapshot.segments).toHaveLength(1);
        expect(snapshot.segments[0].type).toBe('filter');
      });
    });
  });

  describe('FreeText token spacing', () => {
    // Note: These tests use editor.commands.insertFreeTextToken directly instead of
    // user.type because JSDOM has issues with contentEditable + spacer nodes.
    // The actual browser behavior works correctly.

    it.each([
      { tokens: ['hello', 'world'], expected: 'hello world' },
      { tokens: ['one', 'two', 'three'], expected: 'one two three' },
    ])('creates $tokens.length consecutive freetext tokens with correct spacing', async ({
      tokens,
      expected,
    }) => {
      const onChange = vi.fn();
      const editorRef = { current: null as TokenizedSearchInputRef | null };
      render(
        <TokenizedSearchInput
          fields={testFields}
          freeTextMode="tokenize"
          onChange={onChange}
          ref={(ref) => {
            editorRef.current = ref;
          }}
        />
      );

      await waitFor(() => {
        expect(editorRef.current).not.toBeNull();
      });

      const editor = getInternalEditor(editorRef.current);
      expect(editor).not.toBeNull();
      if (!editor) return;

      for (const value of tokens) {
        editor.commands.insertFreeTextToken({ value, quoted: false });
        await waitFor(() => {
          expect(
            screen.getByRole('group', { name: new RegExp(`Free text: ${value}`, 'i') })
          ).toBeInTheDocument();
        });
      }

      const lastCall = onChange.mock.calls[onChange.mock.calls.length - 1];
      const snapshot = lastCall[0];

      expect(snapshot.text).toBe(expected);
    });
  });

  describe('Multiple token creation', () => {
    it('loads and displays mixed filter and free text tokens', async () => {
      render(
        <TokenizedSearchInput
          fields={testFields}
          defaultValue="status:is:active searchterm priority:is:high"
          freeTextMode="tokenize"
        />
      );

      // Verify: All tokens exist
      await waitFor(() => {
        expect(screen.getByRole('group', { name: /Filter: status/i })).toBeInTheDocument();
        expect(screen.getByRole('group', { name: /Free text: searchterm/i })).toBeInTheDocument();
        expect(screen.getByRole('group', { name: /Filter: priority/i })).toBeInTheDocument();
      });
    });
  });
});
