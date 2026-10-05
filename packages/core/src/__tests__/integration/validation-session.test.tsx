/**
 * How validation follows edits across undo, focus, configuration changes and token
 * creation: what counts as edited, what a deletion leaves behind, and what undo
 * restores. A token is edited when the transactions being validated add or change it, or
 * when the user edited it since entering the token they are in; where focus is does not
 * make a token edited.
 */
import { act, cleanup, render, waitFor } from '@testing-library/react';
import type { Editor } from '@tiptap/core';
import type { Transaction } from '@tiptap/pm/state';
import { createRef, type RefObject, useState } from 'react';
import { afterEach, describe, expect, it } from 'vitest';
import {
  TokenizedSearchInput,
  type TokenizedSearchInputRef,
} from '../../editor/tokenized-search-input';
import { getEditorContext, getFocusContext } from '../../extensions/editor-context';
import { enterTokenIn, leaveFocusedTokenIn, programEntry } from '../../plugins/token-focus';
import { getTokenMeta } from '../../plugins/token-meta-plugin';
import { applyTokenAction } from '../../tokens/filter-token/token-actions';
import type { FieldDefinition, ValidationRule } from '../../types';
import { findTokenById } from '../../utils/find-token';
import { generateTokenId } from '../../utils/token-id';
import { MaxCount, Unique } from '../../validation/presets';
import { priorityField, statusField } from '../fixtures/fields';
import { filterTokens } from '../helpers/token-queries';

afterEach(() => {
  cleanup();
});

const fields = [statusField, priorityField];
const rejectKey = () => Unique.rule('key', { onDuplicate: 'reject' });

async function renderEditor(
  defaultValue: string,
  rules: ValidationRule[],
  props: Partial<React.ComponentProps<typeof TokenizedSearchInput>> = {}
) {
  const ref = createRef<TokenizedSearchInputRef>();
  render(
    <TokenizedSearchInput
      ref={ref}
      fields={fields}
      defaultValue={defaultValue}
      validation={{ rules }}
      {...props}
    />
  );
  await waitFor(() => expect(ref.current?.getEditor()).not.toBeNull());
  const editor = ref.current?.getEditor();
  if (!editor) throw new Error('editor not created');
  return { ref: ref as RefObject<TokenizedSearchInputRef>, editor };
}

const values = (ref: RefObject<TokenizedSearchInputRef>) => filterTokens(ref).map((t) => t.value);

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
  const ctx = getFocusContext(editor);
  if (id === null) leaveFocusedTokenIn(tr, ctx);
  else enterTokenIn(tr, ctx, id, programEntry());
  editor.view.dispatch(tr);
}

/** Puts the user in the token at `pos` of `tr` and dispatches `tr`. */
function dispatchFocusingTokenAt(editor: Editor, tr: Transaction, pos: number) {
  enterTokenIn(tr, getFocusContext(editor), String(tr.doc.nodeAt(pos)?.attrs.id), programEntry());
  editor.view.dispatch(tr);
}

function setValue(editor: Editor, id: string, value: string) {
  const tr = editor.state.tr;
  applyTokenAction(tr, id, { type: 'setValue', value }, getEditorContext(editor));
  editor.view.dispatch(tr);
}

function insertToken(editor: Editor, pos: number, key: string, value: string) {
  const { filterToken } = editor.state.schema.nodes;
  const tr = editor.state.tr;
  tr.insert(pos, filterToken.create({ id: generateTokenId(), key, operator: 'is', value }));
  return tr;
}

/** Creates an empty status token with the user in it, types `typed` into it and leaves it. */
function typeStatusAndLeave(editor: Editor, typed: string[]) {
  const end = editor.state.doc.content.size - 1;
  act(() => {
    dispatchFocusingTokenAt(editor, insertToken(editor, end, 'status', ''), end);
  });
  const id = lastTokenId(editor);
  for (const value of typed) act(() => setValue(editor, id, value));
  act(() => focusToken(editor, null));
}

const settle = () => new Promise((resolve) => setTimeout(resolve, 30));

/** A rule that records which tokens each validation pass treated as edited. */
function recordingRule(passes: string[][]): ValidationRule {
  return {
    id: 'recording',
    validate: (ctx) => {
      passes.push([...ctx.editingTokenIds]);
      return [];
    },
  };
}

describe('undo and redo', () => {
  it('does not delete a token that undo restored while the user is in another token', async () => {
    const { ref, editor } = await renderEditor('status:is:active priority:is:high', [rejectKey()]);
    typeStatusAndLeave(editor, ['inactive']);
    await waitFor(() => expect(values(ref)).toEqual(['active', 'high']));

    const priority = filterTokens(ref).find((t) => t.key === 'priority');
    if (!priority) throw new Error('priority token missing');
    act(() => focusToken(editor, priority.id));
    act(() => {
      editor.commands.undo();
    });
    await settle();
    expect(values(ref)).toEqual(['active', 'high', 'inactive']);

    act(() => focusToken(editor, null));
    await settle();
    expect(values(ref)).toEqual(['active', 'high', 'inactive']);
  });

  it('does not make a token edited by reverting it while the user is in another token', async () => {
    const passes: string[][] = [];
    const { ref, editor } = await renderEditor('status:is:active priority:is:high', [
      recordingRule(passes),
    ]);
    const [status, priority] = filterTokens(ref);
    act(() => setValue(editor, priority.id, 'low'));
    act(() => focusToken(editor, status.id));
    act(() => {
      editor.commands.undo();
    });
    await settle();
    expect(filterTokens(ref)[1].value).toBe('high');

    passes.length = 0;
    act(() => focusToken(editor, null));
    await settle();
    expect(passes[passes.length - 1]).toEqual([]);
  });

  it('does not keep a token edited that the application updated while the user was in another', async () => {
    const passes: string[][] = [];
    const { ref, editor } = await renderEditor('status:is:active priority:is:high', [
      recordingRule(passes),
    ]);
    const [status, priority] = filterTokens(ref);
    act(() => focusToken(editor, status.id));
    act(() => {
      ref.current?.updateToken(priority.id, { value: 'low' });
    });
    expect(filterTokens(ref)[1].value).toBe('low');

    passes.length = 0;
    act(() => focusToken(editor, null));
    await settle();
    expect(passes[passes.length - 1]).toEqual([]);
  });
});

describe('changing the validation prop', () => {
  function Host({ onRender }: { onRender: (rerender: () => void) => void }) {
    const [count, setCount] = useState(0);
    onRender(() => setCount((n) => n + 1));
    return (
      <div data-count={count}>
        <TokenizedSearchInput
          ref={hostRef}
          fields={fields}
          defaultValue="status:is:active"
          validation={{ rules: [rejectKey()] }}
        />
      </div>
    );
  }
  const hostRef = createRef<TokenizedSearchInputRef>();

  it('does not delete an existing duplicate when the parent renders again', async () => {
    let rerender: () => void = () => {};
    render(
      <Host
        onRender={(fn) => {
          rerender = fn;
        }}
      />
    );
    await waitFor(() => expect(hostRef.current?.getEditor()).not.toBeNull());
    const editor = hostRef.current?.getEditor();
    if (!editor) throw new Error('editor not created');
    const ref = hostRef as RefObject<TokenizedSearchInputRef>;

    typeStatusAndLeave(editor, ['inactive']);
    await waitFor(() => expect(values(ref)).toEqual(['active']));
    act(() => {
      editor.commands.undo();
    });
    await waitFor(() => expect(values(ref)).toEqual(['active', 'inactive']));

    act(() => rerender());
    await settle();
    expect(values(ref)).toEqual(['active', 'inactive']);
  });

  it('treats no token as edited when the rules change', async () => {
    const passes: string[][] = [];
    const { rerender } = render(
      <TokenizedSearchInput
        fields={fields}
        defaultValue="status:is:active priority:is:high"
        validation={{ rules: [recordingRule(passes)] }}
      />
    );
    await settle();
    passes.length = 0;

    rerender(
      <TokenizedSearchInput
        fields={fields}
        defaultValue="status:is:active priority:is:high"
        validation={{ rules: [recordingRule(passes)] }}
      />
    );
    await settle();

    expect(passes.length).toBeGreaterThan(0);
    expect(passes.every((edited) => edited.length === 0)).toBe(true);
  });
});

describe('marks after a deletion', () => {
  it('shows no mark from a rule that the deletion made obsolete', async () => {
    const { ref, editor } = await renderEditor('status:is:active priority:is:high', [
      rejectKey(),
      MaxCount.rule('*', 2),
    ]);
    const priority = filterTokens(ref).find((t) => t.key === 'priority');
    if (!priority) throw new Error('priority token missing');
    const at = tokenPos(editor, priority.id);
    act(() => {
      dispatchFocusingTokenAt(editor, insertToken(editor, at, 'status', ''), at);
    });
    const id = editor.state.doc.nodeAt(at)?.attrs.id as string;
    act(() => setValue(editor, id, 'inactive'));
    act(() => focusToken(editor, null));
    await waitFor(() => expect(values(ref)).toEqual(['active', 'high']));

    const reasons = filterTokens(ref).map(
      (t) => getTokenMeta(editor.state, t.id)?.validation?.reason ?? null
    );
    expect(reasons).toEqual([null, null]);
  });
});

describe('undoing a deletion', () => {
  it('restores the deleted token with the value it had in one step', async () => {
    const { ref, editor } = await renderEditor('status:is:active', [rejectKey()]);

    typeStatusAndLeave(editor, ['i', 'in', 'ina', 'inactive']);
    await waitFor(() => expect(values(ref)).toEqual(['active']));
    act(() => {
      editor.commands.undo();
    });
    await settle();

    expect(values(ref)).toEqual(['active', 'inactive']);
  });
});

describe('Unique with onDuplicate reject', () => {
  it('deletes a duplicate that was just added', async () => {
    const { ref, editor } = await renderEditor('status:is:active', [rejectKey()]);

    act(() => {
      editor.view.dispatch(
        insertToken(editor, editor.state.doc.content.size - 1, 'status', 'inactive')
      );
    });

    await waitFor(() => expect(filterTokens(ref).map((t) => t.value)).toEqual(['active']));
  });

  it('deletes a duplicate typed into a token once the user leaves it', async () => {
    const { ref, editor } = await renderEditor('status:is:active', [rejectKey()]);
    const end = editor.state.doc.content.size - 1;

    // A token is created empty with the user in it, and they type a value.
    act(() => {
      const tr = insertToken(editor, end, 'status', '');
      dispatchFocusingTokenAt(editor, tr, end);
    });
    const typed = { id: lastTokenId(editor) };
    act(() => setValue(editor, typed.id, 'inactive'));
    expect(filterTokens(ref)).toHaveLength(2);

    act(() => focusToken(editor, null));

    await waitFor(() => expect(filterTokens(ref).map((t) => t.value)).toEqual(['active']));
  });

  it('keeps an existing duplicate that is only clicked and then blurred', async () => {
    const { ref, editor } = await renderEditor('status:is:active', [rejectKey()]);
    const end = editor.state.doc.content.size - 1;
    act(() => {
      const tr = insertToken(editor, end, 'status', '');
      dispatchFocusingTokenAt(editor, tr, end);
    });
    const typed = { id: lastTokenId(editor) };
    act(() => setValue(editor, typed.id, 'inactive'));
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
    const { ref, editor } = await renderEditor('status:is:active priority:is:high', [rejectKey()]);
    const [status, priority] = filterTokens(ref);
    act(() => focusToken(editor, priority.id));

    // One transaction inserts a duplicate before the status token, which moves it onto
    // the position the focused priority token had, and blurs the priority token.
    act(() => {
      const tr = insertToken(editor, tokenPos(editor, status.id), 'status', 'inactive');
      leaveFocusedTokenIn(tr, getFocusContext(editor));
      editor.view.dispatch(tr);
    });

    await waitFor(() => expect(filterTokens(ref).map((t) => t.value)).toEqual(['active', 'high']));
    expect(filterTokens(ref)[0].id).toBe(status.id);
  });
});

describe('Unique reject and an edit that does not change what is compared', () => {
  it('keeps an existing duplicate whose value changed under the key constraint', async () => {
    const { ref, editor } = await renderEditor('status:is:active', [rejectKey()]);
    typeStatusAndLeave(editor, ['inactive']);
    await waitFor(() => expect(values(ref)).toEqual(['active']));
    act(() => {
      editor.commands.undo();
    });
    await waitFor(() => expect(values(ref)).toEqual(['active', 'inactive']));

    const duplicate = filterTokens(ref)[1];
    act(() => focusToken(editor, duplicate.id));
    act(() => setValue(editor, duplicate.id, 'pending'));
    act(() => focusToken(editor, null));
    await settle();

    expect(values(ref)).toEqual(['active', 'pending']);
  });

  it('deletes an existing token that was edited to duplicate another', async () => {
    const { ref, editor } = await renderEditor('status:is:active priority:is:high', [rejectKey()]);
    const priority = filterTokens(ref)[1];
    act(() => focusToken(editor, priority.id));
    act(() =>
      editor.view.dispatch(
        (() => {
          const tr = editor.state.tr;
          tr.setNodeMarkup(tokenPos(editor, priority.id), undefined, {
            ...editor.state.doc.nodeAt(tokenPos(editor, priority.id))?.attrs,
            key: 'status',
            value: 'pending',
          });
          return tr;
        })()
      )
    );
    act(() => focusToken(editor, null));

    await waitFor(() => expect(values(ref)).toEqual(['active']));
  });
});

describe('MaxCount with onExceed reject', () => {
  it('keeps the first tokens and deletes the last ones when all of them are new', async () => {
    const { ref } = await renderEditor('status:is:active priority:is:high status:is:pending', [
      MaxCount.rule('*', 2, { onExceed: 'reject' }),
    ]);
    await waitFor(() => expect(values(ref)).toEqual(['active', 'high']));
  });
});

describe('the field a token belongs to', () => {
  it('resolves the field of a key that only the unknown field template defines', async () => {
    const seen: Array<FieldDefinition | null> = [];
    const rule: ValidationRule = {
      id: 'field-probe',
      validate: (ctx) => {
        for (const token of ctx.tokens) seen.push(ctx.fieldOf(token));
        return [];
      },
    };
    await renderEditor('mystery:is:x', [rule], { unknownFields: {} });
    await waitFor(() => expect(seen.length).toBeGreaterThan(0));

    expect(seen[seen.length - 1]).toMatchObject({ key: 'mystery', type: 'string' });
  });
});
