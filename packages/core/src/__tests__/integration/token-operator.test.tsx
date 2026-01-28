/**
 * Integration tests for TokenOperator component.
 *
 * Tests for the TokenOperator component rendering and basic behavior.
 * Note: Portal-based dropdown tests are limited due to test environment constraints.
 */
import { cleanup, render, waitFor } from '@testing-library/react';
import { createRef } from 'react';
import { afterEach, describe, expect, it } from 'vitest';
import {
  TokenizedSearchInput,
  type TokenizedSearchInputRef,
} from '../../editor/tokenized-search-input';
import { fieldsWithSingleOperator } from '../fixtures';
import { getInternalEditor } from '../helpers/get-editor';

const testFields = fieldsWithSingleOperator;

afterEach(() => {
  cleanup();
});

describe('TokenOperator - Integration Tests', () => {
  describe('Single operator field', () => {
    it('does not render operator dropdown for single operator field', async () => {
      const ref = createRef<TokenizedSearchInputRef>();

      render(<TokenizedSearchInput ref={ref} fields={testFields} defaultValue="name:is:test" />);

      await waitFor(() => {
        expect(ref.current).not.toBeNull();
      });

      const editor = getInternalEditor(ref.current);
      expect(editor).not.toBeNull();
      if (!editor) return;

      // Find the name token
      let tokenPos: number | null = null;
      editor.state.doc.descendants((node, pos) => {
        if (node.type.name === 'filterToken' && node.attrs.key === 'name') {
          tokenPos = pos;
          return false;
        }
        return true;
      });

      expect(tokenPos).not.toBeNull();
      if (tokenPos === null) return;

      // Focus the token (operator block returns null for single operator)
      editor.commands.focusFilterToken(tokenPos, 'end');

      // Wait for React to update
      await new Promise((resolve) => setTimeout(resolve, 100));

      // For single operator fields, no operator listbox with "Operators" label should exist
      // Note: Other listboxes (like suggestions) may be present
      const operatorListbox = document.querySelector('[aria-label="Select operator"]');
      expect(operatorListbox).toBeNull();
    });
  });

  describe('Multi-operator field', () => {
    it('renders dropdown trigger for multi-operator field when focused', async () => {
      const ref = createRef<TokenizedSearchInputRef>();

      render(
        <TokenizedSearchInput ref={ref} fields={testFields} defaultValue="status:is:active" />
      );

      await waitFor(() => {
        expect(ref.current).not.toBeNull();
      });

      const editor = getInternalEditor(ref.current);
      expect(editor).not.toBeNull();
      if (!editor) return;

      // Find the status token
      let tokenPos: number | null = null;
      editor.state.doc.descendants((node, pos) => {
        if (node.type.name === 'filterToken' && node.attrs.key === 'status') {
          tokenPos = pos;
          return false;
        }
        return true;
      });

      expect(tokenPos).not.toBeNull();
      if (tokenPos === null) return;

      // Focus the token
      editor.commands.focusFilterToken(tokenPos, 'end');

      await waitFor(() => {
        const trigger = document.querySelector('[aria-haspopup="listbox"]');
        expect(trigger).not.toBeNull();
      });
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
