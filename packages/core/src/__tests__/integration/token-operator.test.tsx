/**
 * Integration tests for TokenOperator component.
 *
 * Tests for the TokenOperator component rendering and basic behavior.
 * Note: Portal-based dropdown tests are limited due to test environment constraints.
 */
import { act, cleanup, render, screen, waitFor, within } from '@testing-library/react';
import { createRef } from 'react';
import { afterEach, describe, expect, it } from 'vitest';
import { TokenizedSearchInput } from '../../editor/tokenized-search-input';
import type { TokenizedSearchInputRef } from '../../editor/tokenized-search-input.types';
import { getFocusedToken } from '../../plugins/token-focus';
import { fieldsWithSingleOperator } from '../fixtures';
import { getInternalEditor, waitForEditor } from '../helpers/get-editor';
import { filterTokens } from '../helpers/token-queries';

const testFields = fieldsWithSingleOperator;

afterEach(() => {
  cleanup();
});

describe('TokenOperator - Integration Tests', () => {
  describe('Single operator field', () => {
    it('does not render operator dropdown for single operator field', async () => {
      const ref = createRef<TokenizedSearchInputRef>();
      render(<TokenizedSearchInput ref={ref} fields={testFields} defaultValue="name:is:test" />);
      const editor = await waitForEditor(ref);
      const [token] = filterTokens(ref);
      if (!token) throw new Error('filter token not found');

      act(() => {
        editor.commands.focusFilterToken(token.id, 'end');
      });

      await waitFor(() => expect(getFocusedToken(editor.state)?.id).toBe(token.id));
      const group = screen.getByRole('group', { name: /Filter: name/i });
      expect(within(group).queryByRole('combobox', { name: 'Select operator' })).toBeNull();
      expect(group.querySelector('.tsi-token-operator')).toHaveTextContent('is');
    });
  });

  describe('Token attributes', () => {
    it('parses and stores all token attributes correctly from defaultValue', async () => {
      const ref = createRef<TokenizedSearchInputRef>();

      render(
        <TokenizedSearchInput
          ref={ref}
          fields={testFields}
          defaultValue="status:is_not:active priority:contains:high"
        />
      );

      await waitFor(() => {
        expect(ref.current).not.toBeNull();
      });

      const editor = getInternalEditor(ref.current);
      expect(editor).not.toBeNull();
      if (!editor) return;

      // Collect all token attributes
      const tokens: Array<{ key: string; operator: string; value: string }> = [];
      editor.state.doc.descendants((node) => {
        if (node.type.name === 'filterToken') {
          tokens.push({
            key: node.attrs.key,
            operator: node.attrs.operator,
            value: node.attrs.value,
          });
        }
        return true;
      });

      expect(tokens).toHaveLength(2);
      expect(tokens[0]).toEqual({ key: 'status', operator: 'is_not', value: 'active' });
      expect(tokens[1]).toEqual({ key: 'priority', operator: 'contains', value: 'high' });
    });
  });

  describe('Serialization', () => {
    it('getValue returns correct format with operator', async () => {
      const ref = createRef<TokenizedSearchInputRef>();

      render(
        <TokenizedSearchInput ref={ref} fields={testFields} defaultValue="status:is_not:active" />
      );

      await waitFor(() => {
        expect(ref.current).not.toBeNull();
      });

      const value = ref.current?.getValue();
      expect(value).toBe('status:is_not:active');
    });

    it('getValue returns correct format with contains operator', async () => {
      const ref = createRef<TokenizedSearchInputRef>();

      render(
        <TokenizedSearchInput ref={ref} fields={testFields} defaultValue="priority:contains:high" />
      );

      await waitFor(() => {
        expect(ref.current).not.toBeNull();
      });

      const value = ref.current?.getValue();
      expect(value).toBe('priority:contains:high');
    });

    it('getValue returns correct format for multiple tokens', async () => {
      const ref = createRef<TokenizedSearchInputRef>();

      render(
        <TokenizedSearchInput
          ref={ref}
          fields={testFields}
          defaultValue="status:is:active priority:is_not:low"
        />
      );

      await waitFor(() => {
        expect(ref.current).not.toBeNull();
      });

      const value = ref.current?.getValue();
      expect(value).toBe('status:is:active priority:is_not:low');
    });
  });
});
