import { act, render, screen, waitFor } from '@testing-library/react';
import { createRef, type RefObject } from 'react';
import { describe, expect, it } from 'vitest';
import { TokenizedSearchInput } from '../../editor/tokenized-search-input';
import type { TokenizedSearchInputRef } from '../../editor/tokenized-search-input.types';
import { getFocusedToken } from '../../plugins/token-focus';
import { getTokenMeta } from '../../plugins/token-meta-plugin';
import { extendedFields } from '../fixtures';
import { waitForEditor } from '../helpers/get-editor';
import { filterTokens } from '../helpers/token-queries';

const DEFAULT_VALUE = 'status:is:active assignee:is:john';

async function renderInput(defaultValue = DEFAULT_VALUE) {
  const ref = createRef<TokenizedSearchInputRef>();
  render(<TokenizedSearchInput ref={ref} fields={extendedFields} defaultValue={defaultValue} />);
  await waitForEditor(ref);
  return ref as RefObject<TokenizedSearchInputRef>;
}

function tokenDisplay(ref: RefObject<TokenizedSearchInputRef>, id: string) {
  const editor = ref.current?.getEditor();
  return editor ? getTokenMeta(editor.state, id)?.display : undefined;
}

describe('TokenizedSearchInputRef', () => {
  describe('getEditor', () => {
    it('returns the live editor for read access', async () => {
      const ref = await renderInput();

      const editor = ref.current?.getEditor();

      expect(editor).not.toBeNull();
      expect(editor?.isDestroyed).toBe(false);
      expect(editor?.getJSON().type).toBe('doc');
    });
  });

  describe('focus', () => {
    it('focuses the editor', async () => {
      const ref = await renderInput();
      expect(screen.getByRole('combobox')).not.toHaveFocus();

      act(() => {
        ref.current?.focus();
      });

      await waitFor(() => expect(screen.getByRole('combobox')).toHaveFocus());
      expect(ref.current?.getEditor()?.isFocused).toBe(true);
    });
  });

  describe('updateToken', () => {
    it('changes the value of the token with the given id and keeps the id', async () => {
      const ref = await renderInput();
      const [status] = filterTokens(ref);

      act(() => {
        ref.current?.updateToken(status.id, { value: 'inactive' });
      });

      expect(ref.current?.getValue()).toBe('status:is:inactive assignee:is:john');
      expect(filterTokens(ref)[0]).toMatchObject({ id: status.id, value: 'inactive' });
    });

    it('changes the operator of the token with the given id', async () => {
      const ref = await renderInput();
      const [status] = filterTokens(ref);

      act(() => {
        ref.current?.updateToken(status.id, { operator: 'is_not' });
      });

      expect(ref.current?.getValue()).toBe('status:is_not:active assignee:is:john');
    });

    it('applies value and operator together and leaves the token unfocused', async () => {
      const ref = await renderInput();
      const [, assignee] = filterTokens(ref);

      act(() => {
        ref.current?.updateToken(assignee.id, { operator: 'contains', value: 'jo' });
      });

      expect(ref.current?.getValue()).toBe('status:is:active assignee:contains:jo');
      const editor = ref.current?.getEditor();
      expect(editor && getFocusedToken(editor.state)).toBeNull();
    });

    it('is undoable as a regular edit', async () => {
      const ref = await renderInput();
      const [status] = filterTokens(ref);

      act(() => {
        ref.current?.updateToken(status.id, { value: 'inactive' });
      });
      act(() => {
        ref.current?.getEditor()?.commands.undo();
      });

      expect(ref.current?.getValue()).toBe('status:is:active assignee:is:john');
    });

    it('ignores an unknown id', async () => {
      const ref = await renderInput();

      act(() => {
        ref.current?.updateToken('missing-id', { value: 'inactive' });
      });

      expect(ref.current?.getValue()).toBe(DEFAULT_VALUE);
    });
  });

  describe('deleteToken', () => {
    it('removes only the token with the given id', async () => {
      const ref = await renderInput();
      const [status] = filterTokens(ref);

      act(() => {
        ref.current?.deleteToken(status.id);
      });

      expect(ref.current?.getValue()).toBe('assignee:is:john');
      expect(filterTokens(ref)).toHaveLength(1);
    });

    it('ignores an unknown id', async () => {
      const ref = await renderInput();

      act(() => {
        ref.current?.deleteToken('missing-id');
      });

      expect(ref.current?.getValue()).toBe(DEFAULT_VALUE);
    });
  });

  describe('setTokenDisplay', () => {
    it('sets display data without changing the serialized query', async () => {
      const ref = await renderInput();
      const [status] = filterTokens(ref);

      act(() => {
        ref.current?.setTokenDisplay(status.id, { displayValue: 'Active!', startContent: 'icon' });
      });

      expect(tokenDisplay(ref, status.id)).toEqual({
        forKey: 'status',
        forValue: 'active',
        displayValue: 'Active!',
        startContent: 'icon',
      });
      expect(ref.current?.getValue()).toBe(DEFAULT_VALUE);
    });

    it('clears a display member with null and leaves omitted members alone', async () => {
      const ref = await renderInput();
      const [status] = filterTokens(ref);

      act(() => {
        ref.current?.setTokenDisplay(status.id, { displayValue: 'Active!', startContent: 'icon' });
      });
      act(() => {
        ref.current?.setTokenDisplay(status.id, { displayValue: null });
      });

      expect(tokenDisplay(ref, status.id)).toEqual({
        forKey: 'status',
        forValue: 'active',
        startContent: 'icon',
      });
    });

    it('does not enter the undo history', async () => {
      const ref = await renderInput();
      const [status] = filterTokens(ref);

      act(() => {
        ref.current?.updateToken(status.id, { value: 'inactive' });
      });
      act(() => {
        ref.current?.setTokenDisplay(status.id, { displayValue: 'Inactive!' });
      });
      act(() => {
        ref.current?.getEditor()?.commands.undo();
      });

      expect(ref.current?.getValue()).toBe(DEFAULT_VALUE);
    });
  });

  describe('while the editor is destroyed', () => {
    // A late Suspense commit leaves the handle holding a destroyed editor until
    // useEditor re-renders. Writes made then are held as a pending document that
    // reads see immediately.
    async function renderDestroyed() {
      const ref = await renderInput();
      ref.current?.getEditor()?.destroy();
      return ref;
    }

    it('holds updateToken as the pending document', async () => {
      const ref = await renderDestroyed();
      const [status] = filterTokens(ref);

      ref.current?.updateToken(status.id, { operator: 'is_not', value: 'inactive' });

      expect(ref.current?.getValue()).toBe('status:is_not:inactive assignee:is:john');
      expect(filterTokens(ref)[0]).toMatchObject({ id: status.id, value: 'inactive' });
    });

    it('holds deleteToken as the pending document', async () => {
      const ref = await renderDestroyed();
      const [status] = filterTokens(ref);

      ref.current?.deleteToken(status.id);

      expect(ref.current?.getValue()).toBe('assignee:is:john');
    });

    it('chains token writes on top of a pending setValue', async () => {
      const ref = await renderDestroyed();

      ref.current?.setValue('status:is:pending');
      const [pending] = filterTokens(ref);
      ref.current?.updateToken(pending.id, { value: 'active' });

      expect(ref.current?.getValue()).toBe('status:is:active');
    });

    it('holds focus and focuses the editor that replaces the destroyed one', async () => {
      const ref = createRef<TokenizedSearchInputRef>();
      const element = () => (
        <TokenizedSearchInput ref={ref} fields={extendedFields} defaultValue={DEFAULT_VALUE} />
      );
      const { rerender } = render(element());
      const destroyed = await waitForEditor(ref);
      destroyed.destroy();

      act(() => {
        ref.current?.focus();
      });

      expect(document.activeElement).toBe(document.body);
      rerender(element());
      await waitFor(() => {
        const live = ref.current?.getEditor();
        expect(live && live !== destroyed && !live.isDestroyed).toBe(true);
      });
      await waitFor(() => expect(screen.getByRole('combobox')).toHaveFocus());
      expect(ref.current?.getEditor()?.isFocused).toBe(true);
    });

    it('accepts setTokenDisplay without changing the query', async () => {
      const ref = createRef<TokenizedSearchInputRef>();
      const element = () => (
        <TokenizedSearchInput ref={ref} fields={extendedFields} defaultValue={DEFAULT_VALUE} />
      );
      const { rerender } = render(element());
      const destroyed = await waitForEditor(ref);
      const [status] = filterTokens(ref);
      destroyed.destroy();

      ref.current?.setTokenDisplay(status.id, { displayValue: 'Active!' });

      expect(ref.current?.getValue()).toBe(DEFAULT_VALUE);
      rerender(element());
      await waitFor(() => {
        const live = ref.current?.getEditor();
        expect(live && live !== destroyed && !live.isDestroyed).toBe(true);
      });
      expect(tokenDisplay(ref as RefObject<TokenizedSearchInputRef>, status.id)).toMatchObject({
        displayValue: 'Active!',
      });
      expect(await screen.findByText('Active!')).toBeInTheDocument();
      expect(ref.current?.getValue()).toBe(DEFAULT_VALUE);
    });
  });
});
