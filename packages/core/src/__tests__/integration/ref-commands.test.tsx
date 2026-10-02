import { act, render, waitFor } from '@testing-library/react';
import { createRef, type RefObject } from 'react';
import { describe, expect, it } from 'vitest';
import {
  TokenizedSearchInput,
  type TokenizedSearchInputRef,
} from '../../editor/tokenized-search-input';
import type { QuerySnapshotFilterToken } from '../../types';
import { extendedFields } from '../fixtures';

const DEFAULT_VALUE = 'status:is:active assignee:is:john';

async function renderInput(defaultValue = DEFAULT_VALUE) {
  const ref = createRef<TokenizedSearchInputRef>();
  render(<TokenizedSearchInput ref={ref} fields={extendedFields} defaultValue={defaultValue} />);
  await waitFor(() => expect(ref.current?.getEditor()).not.toBeNull());
  return ref as RefObject<TokenizedSearchInputRef>;
}

function filterTokens(ref: RefObject<TokenizedSearchInputRef>): QuerySnapshotFilterToken[] {
  return (ref.current?.getSnapshot().segments ?? []).filter(
    (segment): segment is QuerySnapshotFilterToken => segment.type === 'filter'
  );
}

function tokenAttrs(ref: RefObject<TokenizedSearchInputRef>, id: string) {
  let attrs: Record<string, unknown> | null = null;
  ref.current?.getEditor()?.state.doc.descendants((node) => {
    if (node.type.name === 'filterToken' && node.attrs.id === id) {
      attrs = node.attrs;
      return false;
    }
    return true;
  });
  return attrs as Record<string, unknown> | null;
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

    it('applies value and operator together and confirms the token', async () => {
      const ref = await renderInput();
      const [, assignee] = filterTokens(ref);

      act(() => {
        ref.current?.updateToken(assignee.id, { operator: 'contains', value: 'jo' });
      });

      expect(ref.current?.getValue()).toBe('status:is:active assignee:contains:jo');
      expect(tokenAttrs(ref, assignee.id)?.confirmed).toBe(true);
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
    it('sets display attributes without changing the serialized query', async () => {
      const ref = await renderInput();
      const [status] = filterTokens(ref);

      act(() => {
        ref.current?.setTokenDisplay(status.id, { displayValue: 'Active!', startContent: 'icon' });
      });

      expect(tokenAttrs(ref, status.id)).toMatchObject({
        displayValue: 'Active!',
        startContent: 'icon',
      });
      expect(ref.current?.getValue()).toBe(DEFAULT_VALUE);
    });

    it('clears a display attribute with null and leaves omitted attributes alone', async () => {
      const ref = await renderInput();
      const [status] = filterTokens(ref);

      act(() => {
        ref.current?.setTokenDisplay(status.id, { displayValue: 'Active!', startContent: 'icon' });
      });
      act(() => {
        ref.current?.setTokenDisplay(status.id, { displayValue: null });
      });

      expect(tokenAttrs(ref, status.id)).toMatchObject({
        displayValue: null,
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

    it('accepts setTokenDisplay without changing the query', async () => {
      const ref = await renderDestroyed();
      const [status] = filterTokens(ref);

      ref.current?.setTokenDisplay(status.id, { displayValue: 'Active!' });

      expect(ref.current?.getValue()).toBe(DEFAULT_VALUE);
    });
  });
});
