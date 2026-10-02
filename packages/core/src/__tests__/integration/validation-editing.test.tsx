/**
 * Which tokens validation treats as edited: those added or changed by the
 * transactions it validates, and those the user edited since entering the token
 * they are in. Where focus is does not make a token edited.
 */
import { act, cleanup, render, waitFor } from '@testing-library/react';
import type { Editor } from '@tiptap/core';
import type { Transaction } from '@tiptap/pm/state';
import { createRef, type RefObject } from 'react';
import { afterEach, describe, expect, it } from 'vitest';
import {
  TokenizedSearchInput,
  type TokenizedSearchInputRef,
} from '../../editor/tokenized-search-input';
import { getEditorContext } from '../../extensions/editor-context';
import { programEntry, setTokenFocus } from '../../plugins/token-focus-plugin';
import { applyTokenAction } from '../../tokens/filter-token/token-actions';
import type { QuerySnapshotFilterToken, ValidationRule } from '../../types';
import { findTokenById } from '../../utils/find-token';
import { generateTokenId } from '../../utils/token-id';
import { Unique } from '../../validation/presets';
import { priorityField, statusField } from '../fixtures/fields';

afterEach(() => {
  cleanup();
});

const fields = [statusField, priorityField];

async function renderWithRules(defaultValue: string, rules: ValidationRule[]) {
  const ref = createRef<TokenizedSearchInputRef>();
  render(
    <TokenizedSearchInput
      ref={ref}
      fields={fields}
      defaultValue={defaultValue}
      validation={{ rules }}
    />
  );
  await waitFor(() => expect(ref.current?.getEditor()).not.toBeNull());
  const editor = ref.current?.getEditor();
  if (!editor) throw new Error('editor not created');
  return { ref: ref as RefObject<TokenizedSearchInputRef>, editor };
}

function filterTokens(ref: RefObject<TokenizedSearchInputRef>): QuerySnapshotFilterToken[] {
  return (ref.current?.getSnapshot().segments ?? []).filter(
    (segment): segment is QuerySnapshotFilterToken => segment.type === 'filter'
  );
}

function tokenPos(editor: Editor, id: string): number {
  const found = findTokenById(editor.state.doc, id);
  if (!found) throw new Error(`token ${id} not found`);
  return found.pos;
}

function lastTokenId(editor: Editor): string {
  let id = '';
  editor.state.doc.descendants((node) => {
    if (node.type.name === 'filterToken') id = node.attrs.id;
  });
  return id;
}

function focusToken(editor: Editor, id: string | null) {
  const tr = editor.state.tr;
  setTokenFocus(tr, id === null ? null : { id, entry: programEntry() });
  editor.view.dispatch(tr);
}

/** Puts the user in the token at `pos` of `tr` and dispatches `tr`. */
function dispatchFocusingTokenAt(editor: Editor, tr: Transaction, pos: number) {
  setTokenFocus(tr, { id: String(tr.doc.nodeAt(pos)?.attrs.id), entry: programEntry() });
  editor.view.dispatch(tr);
}

/** A transaction that inserts a status token (with an id, as the editor creates them) at `pos`. */
function insertStatus(editor: Editor, pos: number, value: string) {
  const { filterToken } = editor.state.schema.nodes;
  const tr = editor.state.tr;
  tr.insert(
    pos,
    filterToken.create({ id: generateTokenId(), key: 'status', operator: 'is', value })
  );
  return tr;
}

describe('Unique with onDuplicate reject', () => {
  const rejecting = () => [Unique.rule('key', { onDuplicate: 'reject' })];

  it('deletes a duplicate that was just added', async () => {
    const { ref, editor } = await renderWithRules('status:is:active', rejecting());

    act(() => {
      editor.view.dispatch(insertStatus(editor, editor.state.doc.content.size - 1, 'inactive'));
    });

    await waitFor(() => expect(filterTokens(ref).map((t) => t.value)).toEqual(['active']));
  });

  it('deletes a duplicate typed into a token once the user leaves it', async () => {
    const { ref, editor } = await renderWithRules('status:is:active', rejecting());
    const end = editor.state.doc.content.size - 1;

    // A token is created empty with the user in it, and they type a value.
    act(() => {
      const tr = insertStatus(editor, end, '');
      dispatchFocusingTokenAt(editor, tr, end);
    });
    const typed = { id: lastTokenId(editor) };
    act(() => {
      const tr = editor.state.tr;
      applyTokenAction(
        tr,
        typed.id,
        { type: 'setValue', value: 'inactive' },
        getEditorContext(editor)
      );
      editor.view.dispatch(tr);
    });
    expect(filterTokens(ref)).toHaveLength(2);

    act(() => focusToken(editor, null));

    await waitFor(() => expect(filterTokens(ref).map((t) => t.value)).toEqual(['active']));
  });

  it('keeps an existing duplicate that is only clicked and then blurred', async () => {
    const { ref, editor } = await renderWithRules('status:is:active', rejecting());
    const end = editor.state.doc.content.size - 1;
    act(() => {
      const tr = insertStatus(editor, end, '');
      dispatchFocusingTokenAt(editor, tr, end);
    });
    const typed = { id: lastTokenId(editor) };
    act(() => {
      const tr = editor.state.tr;
      applyTokenAction(
        tr,
        typed.id,
        { type: 'setValue', value: 'inactive' },
        getEditorContext(editor)
      );
      editor.view.dispatch(tr);
    });
    act(() => focusToken(editor, null));
    await waitFor(() => expect(filterTokens(ref)).toHaveLength(1));

    // Undo brings the rejected duplicate back; undoing never deletes.
    act(() => {
      editor.commands.undo();
    });
    await waitFor(() => expect(filterTokens(ref).length).toBeGreaterThan(1));
    const values = filterTokens(ref).map((t) => t.value);

    // Entering a token and leaving it again edits neither.
    act(() => focusToken(editor, filterTokens(ref)[0].id));
    act(() => focusToken(editor, null));

    expect(filterTokens(ref).map((t) => t.value)).toEqual(values);
  });

  it('deletes the added duplicate when an edit before the focused token shifts positions', async () => {
    const { ref, editor } = await renderWithRules('status:is:active priority:is:high', rejecting());
    const [status, priority] = filterTokens(ref);
    act(() => focusToken(editor, priority.id));

    // One transaction inserts a duplicate before the status token, which moves it onto
    // the position the focused priority token had, and blurs the priority token.
    act(() => {
      const tr = insertStatus(editor, tokenPos(editor, status.id), 'inactive');
      setTokenFocus(tr, null);
      editor.view.dispatch(tr);
    });

    await waitFor(() => expect(filterTokens(ref).map((t) => t.value)).toEqual(['active', 'high']));
    expect(filterTokens(ref)[0].id).toBe(status.id);
  });
});
