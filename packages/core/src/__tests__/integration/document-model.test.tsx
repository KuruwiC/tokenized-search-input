/**
 * The document holds only what the user entered. Validation results and display
 * data live in per-token state keyed by token id.
 */

import { act, cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { Editor } from '@tiptap/core';
import { closeHistory } from '@tiptap/pm/history';
import { createRef, type RefObject } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  TokenizedSearchInput,
  type TokenizedSearchInputRef,
} from '../../editor/tokenized-search-input';
import { getEditorContext } from '../../extensions/editor-context';
import { useAsyncTokenResolver } from '../../helpers/use-async-token-resolver';
import { requestValidationCheck, setTokenMeta } from '../../plugins/shared/meta';
import { getSuggestionState } from '../../plugins/suggestion';
import { tokenMetaKey } from '../../plugins/token-meta-plugin';
import type {
  FieldDefinition,
  QuerySnapshot,
  QuerySnapshotFilterToken,
  QuerySnapshotFreeTextToken,
  ValidationRule,
} from '../../types';
import { findTokenById } from '../../utils/find-token';

afterEach(() => {
  cleanup();
});

const emailFields: FieldDefinition[] = [
  {
    key: 'email',
    label: 'Email',
    type: 'string',
    operators: ['is'],
    validate: (value) => value.includes('@') || 'Must contain @',
  },
];

const countryFields: FieldDefinition[] = [
  { key: 'country', label: 'Country', type: 'enum', operators: ['is'] },
];

const statusFields: FieldDefinition[] = [
  { key: 'status', label: 'Status', type: 'string', operators: ['is'] },
];

async function renderWithRef(
  fields: FieldDefinition[],
  props: Partial<React.ComponentProps<typeof TokenizedSearchInput>> = {}
): Promise<{ ref: RefObject<TokenizedSearchInputRef>; editor: Editor }> {
  const ref = createRef<TokenizedSearchInputRef>();
  render(<TokenizedSearchInput ref={ref} fields={fields} {...props} />);
  await waitFor(() => expect(ref.current?.getEditor()).not.toBeNull());
  const editor = ref.current?.getEditor();
  if (!editor) throw new Error('editor not created');
  return { ref: ref as RefObject<TokenizedSearchInputRef>, editor };
}

function filterSegments(snapshot: QuerySnapshot): QuerySnapshotFilterToken[] {
  return snapshot.segments.filter((s): s is QuerySnapshotFilterToken => s.type === 'filter');
}

function freeTextSegments(snapshot: QuerySnapshot): QuerySnapshotFreeTextToken[] {
  return snapshot.segments.filter((s): s is QuerySnapshotFreeTextToken => s.type === 'freeText');
}

function tokenGroups(): HTMLElement[] {
  return screen.queryAllByRole('group');
}

function tokenMetaSize(editor: Editor): number | undefined {
  return tokenMetaKey.getState(editor.state)?.entries.size;
}

function pasteHTML(editor: Editor, html: string): void {
  act(() => {
    editor.commands.focus('end');
    editor.view.pasteHTML(html, new Event('paste') as ClipboardEvent);
  });
}

function tokenPos(editor: Editor, id: string): number {
  const found = findTokenById(editor.state.doc, id);
  if (!found) throw new Error(`token ${id} not found`);
  return found.pos;
}

function containsReactElement(value: unknown): boolean {
  if (value === null || typeof value !== 'object') return false;
  if ('$$typeof' in value) return true;
  return Object.values(value).some(containsReactElement);
}

describe('Document model', () => {
  describe('field validate without validation rules', () => {
    it('reports the token invalid in the snapshot and in the view', async () => {
      const onChange = vi.fn<(snapshot: QuerySnapshot) => void>();
      const { ref } = await renderWithRef(emailFields, {
        defaultValue: 'email:is:bad',
        onChange,
      });

      await waitFor(() => {
        expect(document.querySelectorAll('.node-filterToken [data-invalid="true"]')).toHaveLength(
          1
        );
      });
      const [token] = filterSegments(ref.current?.getSnapshot() ?? { segments: [], text: '' });
      expect(token).toMatchObject({ invalid: true });
      expect(token.invalidReason).toBeTruthy();

      act(() => {
        ref.current?.setValue('email:is:also-bad');
      });
      const last = onChange.mock.lastCall?.[0];
      expect(last && filterSegments(last)[0]).toMatchObject({ invalid: true });
    });
  });

  describe('validation message', () => {
    it('exposes the message through title and aria-describedby', async () => {
      const shortRule: ValidationRule = {
        id: 'min-length',
        validate: (ctx) =>
          ctx.tokens
            .filter((t) => t.value.length < 3)
            .map((t) => ({
              ruleId: 'min-length',
              reason: 'too-short',
              message: 'Value is too short',
              action: 'mark' as const,
              targets: [{ tokenId: t.id }],
            })),
      };
      await renderWithRef(statusFields, {
        defaultValue: 'status:is:ab',
        validation: { rules: [shortRule] },
      });

      await waitFor(() => {
        const [group] = tokenGroups();
        expect(group).toHaveAttribute('title', 'Value is too short');
      });
      const [group] = tokenGroups();
      const describedBy = group.getAttribute('aria-describedby');
      expect(describedBy).toBeTruthy();
      expect(document.getElementById(describedBy ?? '')).toHaveTextContent('Value is too short');
    });
  });

  describe('dynamic enum token', () => {
    it('edits the value, never the display label', async () => {
      const user = userEvent.setup();
      const { ref } = await renderWithRef(countryFields, { defaultValue: 'country:is:jp' });
      const [token] = filterSegments(ref.current?.getSnapshot() ?? { segments: [], text: '' });

      act(() => {
        ref.current?.setTokenDisplay(token.id, { displayValue: 'Japan' });
      });
      await waitFor(() => expect(screen.getByText('Japan')).toBeInTheDocument());

      await user.click(screen.getByRole('group', { name: /Filter: country/i }));
      const input = await screen.findByPlaceholderText('...');
      await user.type(input, 'x');

      expect(ref.current?.getValue()).toBe('country:is:jpx');
    });
  });

  describe('token id uniqueness', () => {
    it('gives every pasted filter and free text token its own id and state', async () => {
      const markFirst = { id: '' };
      const rule: ValidationRule = {
        id: 'mark-first',
        validate: (ctx) =>
          ctx.tokens
            .filter((t) => t.id === markFirst.id)
            .map((t) => ({
              ruleId: 'mark-first',
              reason: 'marked',
              action: 'mark' as const,
              targets: [{ tokenId: t.id }],
            })),
      };
      const { ref, editor } = await renderWithRef(statusFields, {
        freeTextMode: 'tokenize',
        validation: { rules: [rule] },
      });
      const html =
        '<span data-filter-token data-token-id="copied" data-key="status" data-operator="is" data-value="active"></span>' +
        '<span data-free-text-token data-token-id="copied-text" data-value="hello"></span>';

      pasteHTML(editor, html);
      pasteHTML(editor, html);

      const snapshot = ref.current?.getSnapshot() ?? { segments: [], text: '' };
      const filters = filterSegments(snapshot);
      const freeTexts = freeTextSegments(snapshot);
      expect(filters).toHaveLength(2);
      expect(freeTexts).toHaveLength(2);
      const ids = [...filters, ...freeTexts].map((t) => t.id);
      expect(new Set(ids).size).toBe(4);
      expect(ids).not.toContain('copied');
      expect(ids).not.toContain('copied-text');

      act(() => {
        ref.current?.setTokenDisplay(filters[0].id, { displayValue: 'Shown once' });
      });
      expect(await screen.findAllByText('Shown once')).toHaveLength(1);

      markFirst.id = filters[0].id;
      act(() => {
        editor.view.dispatch(requestValidationCheck(editor.state.tr));
      });
      const invalid = filterSegments(ref.current?.getSnapshot() ?? { segments: [], text: '' }).map(
        (t) => t.invalid === true
      );
      expect(invalid).toEqual([true, false]);
    });

    it('keeps a value suggestion with the pasted token it was opened for', async () => {
      const user = userEvent.setup();
      const enumFields: FieldDefinition[] = [
        {
          key: 'status',
          label: 'Status',
          type: 'enum',
          operators: ['is'],
          enumValues: ['active', 'inactive'],
        },
      ];
      const { ref, editor } = await renderWithRef(enumFields);
      const html =
        '<span data-filter-token data-token-id="copied" data-key="status" data-operator="is" data-value="active"></span>';

      pasteHTML(editor, html);
      pasteHTML(editor, html);
      const [first, second] = filterSegments(
        ref.current?.getSnapshot() ?? { segments: [], text: '' }
      );

      await waitFor(() => expect(tokenGroups()).toHaveLength(2));
      await user.click(tokenGroups()[0]);
      await screen.findByRole('listbox');
      expect(getSuggestionState(editor.state)?.anchor).toEqual({ tokenId: first.id });

      act(() => {
        ref.current?.deleteToken(first.id);
      });

      expect(getSuggestionState(editor.state)?.type).toBeNull();
      expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
      expect(filterSegments(ref.current?.getSnapshot() ?? { segments: [], text: '' })).toEqual([
        expect.objectContaining({ id: second.id }),
      ]);
    });

    it('closes a date picker whose pasted token is removed instead of moving it to the other one', async () => {
      const user = userEvent.setup();
      const dateFields: FieldDefinition[] = [
        { key: 'created', label: 'Created', type: 'date', operators: ['gt'] },
      ];
      const { ref, editor } = await renderWithRef(dateFields);
      const html =
        '<span data-filter-token data-token-id="copied" data-key="created" data-operator="gt" data-value="2024-01-01"></span>';

      pasteHTML(editor, html);
      pasteHTML(editor, html);
      const [first, second] = filterSegments(
        ref.current?.getSnapshot() ?? { segments: [], text: '' }
      );

      await waitFor(() => expect(tokenGroups()).toHaveLength(2));
      await user.click(tokenGroups()[0]);
      await screen.findByRole('dialog');

      // Remove the first token and everything up to the second one, so the second
      // token now starts where the first one did. The transaction is applied, not
      // dispatched: what follows it (focus moving by position) is not about the anchor.
      const next = editor.state.apply(
        editor.state.tr.delete(tokenPos(editor, first.id), tokenPos(editor, second.id))
      );

      expect(getSuggestionState(next)?.type).toBeNull();
      expect(getSuggestionState(next)?.anchor).toBeNull();
    });

    it('re-issues an id that a content insert duplicates', async () => {
      const { ref, editor } = await renderWithRef(statusFields, {
        defaultValue: 'status:is:active',
      });
      const [token] = filterSegments(ref.current?.getSnapshot() ?? { segments: [], text: '' });

      act(() => {
        editor.commands.insertContentAt(editor.state.doc.content.size - 1, {
          type: 'filterToken',
          attrs: { id: token.id, key: 'status', operator: 'is', value: 'other' },
        });
      });

      const ids = filterSegments(ref.current?.getSnapshot() ?? { segments: [], text: '' }).map(
        (t) => t.id
      );
      expect(ids).toHaveLength(2);
      expect(ids[0]).toBe(token.id);
      expect(new Set(ids).size).toBe(2);
    });

    it('keeps the id on the original when a copy is inserted before it', async () => {
      const { ref, editor } = await renderWithRef(statusFields, {
        defaultValue: 'status:is:active',
      });
      const [token] = filterSegments(ref.current?.getSnapshot() ?? { segments: [], text: '' });
      act(() => {
        ref.current?.setTokenDisplay(token.id, { displayValue: 'Original' });
      });

      act(() => {
        editor.commands.insertContentAt(1, {
          type: 'filterToken',
          attrs: { id: token.id, key: 'status', operator: 'is', value: 'copy' },
        });
      });

      const tokens = filterSegments(ref.current?.getSnapshot() ?? { segments: [], text: '' });
      expect(tokens.map((t) => t.value)).toEqual(['copy', 'active']);
      expect(tokens[1].id).toBe(token.id);
      expect(tokens[0].id).not.toBe(token.id);
      await waitFor(() =>
        expect(
          screen.getByRole('group', { name: /Filter: status is Original/i })
        ).toBeInTheDocument()
      );
    });
  });

  describe('display data across content resets and history', () => {
    interface Country {
      value: string;
      label: string;
    }

    function ResolverHarness({
      inputRef,
      resolve,
      defaultValue,
    }: {
      inputRef: RefObject<TokenizedSearchInputRef>;
      resolve: (values: string[]) => Promise<Country[]>;
      defaultValue: string;
    }) {
      const { resolveTokens } = useAsyncTokenResolver({
        inputRef,
        fieldKey: 'country',
        resolve,
        getValue: (country) => country.value,
        getDisplayData: (country) => ({ displayValue: country.label }),
      });
      return (
        <TokenizedSearchInput
          ref={inputRef}
          fields={countryFields}
          defaultValue={defaultValue}
          onChange={() => {
            void resolveTokens();
          }}
        />
      );
    }

    const labels: Record<string, string> = { jp: 'Japan', us: 'United States' };
    const lookup = (values: string[]) =>
      Promise.resolve(values.map((value) => ({ value, label: labels[value] ?? value })));

    it('empties token meta on setValue and clear, and re-resolves a token restored by undo', async () => {
      const inputRef = createRef<TokenizedSearchInputRef>();
      const resolve = vi.fn(lookup);
      render(
        <ResolverHarness
          inputRef={inputRef as RefObject<TokenizedSearchInputRef>}
          resolve={resolve}
          defaultValue="country:is:jp"
        />
      );
      await waitFor(() => expect(inputRef.current?.getEditor()).not.toBeNull());
      await waitFor(() => expect(screen.getByText('Japan')).toBeInTheDocument());
      const editor = inputRef.current?.getEditor();
      if (!editor) throw new Error('editor not created');

      act(() => {
        inputRef.current?.setValue('country:is:us');
      });
      expect(tokenMetaSize(editor)).toBe(0);
      await waitFor(() => expect(screen.getByText('United States')).toBeInTheDocument());

      const callsBeforeUndo = resolve.mock.calls.length;
      act(() => {
        editor.commands.undo();
      });
      await waitFor(() => expect(screen.getByText('Japan')).toBeInTheDocument());
      expect(resolve.mock.calls.length).toBeGreaterThan(callsBeforeUndo);

      act(() => {
        inputRef.current?.clear();
      });
      expect(tokenMetaSize(editor)).toBe(0);
    });

    it('restores the display of a deleted token on undo and drops it on redo', async () => {
      const inputRef = createRef<TokenizedSearchInputRef>();
      const resolve = vi
        .fn<(values: string[]) => Promise<Country[]>>()
        .mockImplementationOnce(lookup)
        .mockImplementation(() => new Promise(() => {}));
      render(
        <ResolverHarness
          inputRef={inputRef as RefObject<TokenizedSearchInputRef>}
          resolve={resolve}
          defaultValue="country:is:jp"
        />
      );
      await waitFor(() => expect(inputRef.current?.getEditor()).not.toBeNull());
      await waitFor(() => expect(screen.getByText('Japan')).toBeInTheDocument());
      const editor = inputRef.current?.getEditor();
      if (!editor) throw new Error('editor not created');
      const [token] = filterSegments(inputRef.current?.getSnapshot() ?? { segments: [], text: '' });

      act(() => {
        inputRef.current?.deleteToken(token.id);
      });
      expect(screen.queryByText('Japan')).not.toBeInTheDocument();

      act(() => {
        editor.commands.undo();
      });
      expect(await screen.findByText('Japan')).toBeInTheDocument();

      act(() => {
        editor.commands.redo();
      });
      await waitFor(() => expect(screen.queryByText('Japan')).not.toBeInTheDocument());
    });
  });

  describe('display data and the value it describes', () => {
    it('shows a custom suggestion display again when undo restores the value', async () => {
      const user = userEvent.setup();
      const tagFields: FieldDefinition[] = [
        { key: 'tag', label: 'Tag', type: 'string', operators: ['is'] },
      ];
      const { ref, editor } = await renderWithRef(tagFields, {
        suggestions: {
          custom: {
            displayMode: 'replace',
            debounceMs: 0,
            suggest: () => [
              {
                label: 'React tag',
                tokens: [{ key: 'tag', operator: 'is', value: 'react', displayValue: 'React' }],
              },
            ],
          },
        },
      });

      await user.click(screen.getByRole('combobox'));
      act(() => {
        editor.commands.insertContent('rea');
      });
      await user.click(await screen.findByRole('option', { name: /React tag/ }));
      const token = () => screen.getByRole('group', { name: /Filter: tag/i });
      await waitFor(() => expect(token()).toHaveTextContent('React'));
      // Keep the insertion and the edit in separate undo steps, as a pause between them would.
      act(() => {
        editor.view.dispatch(closeHistory(editor.state.tr));
      });

      await user.click(token());
      await user.type(await screen.findByPlaceholderText('...'), 'x');
      await user.keyboard('{Tab}');
      expect(ref.current?.getValue()).toBe('tag:is:reactx');
      await waitFor(() => expect(token()).not.toHaveTextContent('React'));

      act(() => {
        editor.commands.undo();
      });
      expect(ref.current?.getValue()).toBe('tag:is:react');
      await waitFor(() => expect(token()).toHaveTextContent('React'));
    });
  });

  describe('content replacement', () => {
    it('discards token meta when the clear button empties the input', async () => {
      const user = userEvent.setup();
      const { ref, editor } = await renderWithRef(statusFields, {
        defaultValue: 'status:is:active',
        clearable: true,
      });
      const [token] = filterSegments(ref.current?.getSnapshot() ?? { segments: [], text: '' });
      act(() => {
        ref.current?.setTokenDisplay(token.id, { displayValue: 'Shown active' });
      });

      await user.click(screen.getByRole('button', { name: 'Clear search' }));

      expect(ref.current?.getValue()).toBe('');
      expect(tokenMetaSize(editor)).toBe(0);
    });

    it('keeps token ids and meta when a free text mode change re-reads the content', async () => {
      const ref = createRef<TokenizedSearchInputRef>();
      const onTokensChange = vi.fn<(snapshot: QuerySnapshot) => void>();
      const { rerender } = render(
        <TokenizedSearchInput
          ref={ref}
          fields={statusFields}
          defaultValue="status:is:active"
          onTokensChange={onTokensChange}
        />
      );
      await waitFor(() => expect(ref.current?.getEditor()).not.toBeNull());
      const editor = ref.current?.getEditor();
      if (!editor) throw new Error('editor not created');
      const [token] = filterSegments(ref.current?.getSnapshot() ?? { segments: [], text: '' });
      act(() => {
        ref.current?.setTokenDisplay(token.id, { displayValue: 'Shown active' });
      });
      await waitFor(() => expect(onTokensChange).toHaveBeenCalled());
      onTokensChange.mockClear();

      rerender(
        <TokenizedSearchInput
          ref={ref}
          fields={statusFields}
          defaultValue="status:is:active"
          freeTextMode="tokenize"
          onTokensChange={onTokensChange}
        />
      );

      await waitFor(() => expect(getEditorContext(editor).freeTextMode).toBe('tokenize'));
      const [kept] = filterSegments(ref.current?.getSnapshot() ?? { segments: [], text: '' });
      expect(kept.id).toBe(token.id);
      expect(tokenMetaSize(editor)).toBe(1);
      expect(onTokensChange).not.toHaveBeenCalled();
    });

    it('turns free text tokens back into text and keeps filter token ids', async () => {
      const ref = createRef<TokenizedSearchInputRef>();
      const element = (freeTextMode: 'plain' | 'tokenize') => (
        <TokenizedSearchInput
          ref={ref}
          fields={statusFields}
          defaultValue='status:is:active hello "big world"'
          freeTextMode={freeTextMode}
        />
      );
      const { rerender } = render(element('tokenize'));
      await waitFor(() => expect(ref.current?.getEditor()).not.toBeNull());
      const read = () => ref.current?.getSnapshot() ?? { segments: [], text: '' };
      expect(freeTextSegments(read())).toHaveLength(2);
      const [token] = filterSegments(read());

      rerender(element('plain'));

      await waitFor(() => expect(freeTextSegments(read())).toHaveLength(0));
      expect(filterSegments(read())[0]?.id).toBe(token.id);
      expect(ref.current?.getValue()).toBe('status:is:active hello "big world"');
    });

    it('binds a display held while the editor is destroyed to the value at call time', async () => {
      const ref = createRef<TokenizedSearchInputRef>();
      const element = () => (
        <TokenizedSearchInput ref={ref} fields={statusFields} defaultValue="status:is:active" />
      );
      const { rerender } = render(element());
      await waitFor(() => expect(ref.current?.getEditor()).not.toBeNull());
      const [token] = filterSegments(ref.current?.getSnapshot() ?? { segments: [], text: '' });
      const destroyed = ref.current?.getEditor();
      destroyed?.destroy();

      ref.current?.setTokenDisplay(token.id, { displayValue: 'Shown active' });
      ref.current?.updateToken(token.id, { value: 'inactive' });
      rerender(element());

      await waitFor(() => {
        const live = ref.current?.getEditor();
        expect(live && live !== destroyed && !live.isDestroyed).toBe(true);
        expect(ref.current?.getValue()).toBe('status:is:inactive');
      });
      expect(screen.queryByText('Shown active')).not.toBeInTheDocument();
    });

    it('replays handle calls made while the editor is destroyed in call order', async () => {
      const ref = createRef<TokenizedSearchInputRef>();
      const calls: string[] = [];
      const element = () => (
        <TokenizedSearchInput
          ref={ref}
          fields={statusFields}
          defaultValue="status:is:active"
          onSubmit={(snapshot) => calls.push(`submit:${snapshot.text}`)}
          onClear={() => calls.push('clear')}
        />
      );
      const { rerender } = render(element());
      await waitFor(() => expect(ref.current?.getEditor()).not.toBeNull());
      const destroyed = ref.current?.getEditor();
      destroyed?.destroy();

      ref.current?.submit();
      ref.current?.clear();
      ref.current?.submit();
      expect(calls).toEqual([]);
      rerender(element());

      await waitFor(() => {
        const live = ref.current?.getEditor();
        expect(live && live !== destroyed && !live.isDestroyed).toBe(true);
        expect(calls).toEqual(['submit:status:is:active', 'clear', 'submit:']);
      });
    });
  });

  describe('free text validation in the snapshot', () => {
    it('reports invalid free text tokens like filter tokens', async () => {
      const rule: ValidationRule = {
        id: 'no-free-text',
        validate: (ctx) =>
          ctx.tokens
            .filter((t) => t.type === 'freeText')
            .map((t) => ({
              ruleId: 'no-free-text',
              reason: 'free-text-not-allowed',
              action: 'mark' as const,
              targets: [{ tokenId: t.id }],
            })),
      };
      const { ref } = await renderWithRef(statusFields, {
        defaultValue: '"free text"',
        freeTextMode: 'tokenize',
        validation: { rules: [rule] },
      });

      await waitFor(() =>
        expect(document.querySelectorAll('.node-freeTextToken [data-invalid="true"]')).toHaveLength(
          1
        )
      );
      const [segment] = freeTextSegments(ref.current?.getSnapshot() ?? { segments: [], text: '' });
      expect(segment).toMatchObject({ invalid: true, invalidReason: 'free-text-not-allowed' });
    });
  });

  describe('onTokensChange on blur', () => {
    it('reports validation that changed without a document change', async () => {
      const user = userEvent.setup();
      const onTokensChange = vi.fn<(snapshot: QuerySnapshot) => void>();
      const flag = { on: false };
      const rule: ValidationRule = {
        id: 'flagged',
        validate: (ctx) =>
          flag.on
            ? ctx.tokens.map((t) => ({
                ruleId: 'flagged',
                reason: 'flagged',
                action: 'mark' as const,
                targets: [{ tokenId: t.id }],
              }))
            : [],
      };
      const { editor } = await renderWithRef(statusFields, {
        defaultValue: 'status:is:ok',
        validation: { rules: [rule] },
        onTokensChange,
      });

      await user.click(screen.getByRole('group', { name: /Filter: status/i }));
      await user.type(await screen.findByPlaceholderText('...'), 'x');
      flag.on = true;
      act(() => {
        editor.view.dispatch(requestValidationCheck(editor.state.tr));
      });
      await user.keyboard('{Tab}');

      await waitFor(() => expect(onTokensChange).toHaveBeenCalled());
      const last = onTokensChange.mock.lastCall?.[0];
      expect(last && filterSegments(last)[0]).toMatchObject({
        value: 'okx',
        invalid: true,
        invalidReason: 'flagged',
      });
    });
  });

  describe('meta-only transactions', () => {
    it('re-renders the token for a validation or display change without a document change', async () => {
      const { ref, editor } = await renderWithRef(statusFields, {
        defaultValue: 'status:is:active',
      });
      const [token] = filterSegments(ref.current?.getSnapshot() ?? { segments: [], text: '' });
      const doc = editor.state.doc;

      act(() => {
        editor.view.dispatch(
          setTokenMeta(editor.state.tr, token.id, {
            validation: { ruleId: 'external', reason: 'flagged' },
          })
        );
      });
      expect(editor.state.doc).toBe(doc);
      await waitFor(() =>
        expect(document.querySelectorAll('.node-filterToken [data-invalid="true"]')).toHaveLength(1)
      );

      act(() => {
        editor.view.dispatch(
          setTokenMeta(editor.state.tr, token.id, {
            display: { forKey: 'status', forValue: 'active', displayValue: 'Shown' },
          })
        );
      });
      expect(editor.state.doc).toBe(doc);
      expect(await screen.findByText('Shown')).toBeInTheDocument();
    });
  });

  describe('document content', () => {
    it('keeps only entered facts in node attributes and React elements out of getJSON', async () => {
      const { ref, editor } = await renderWithRef(statusFields, {
        defaultValue: 'status:is:active "free text"',
        freeTextMode: 'tokenize',
      });
      const [token] = filterSegments(ref.current?.getSnapshot() ?? { segments: [], text: '' });

      act(() => {
        ref.current?.setTokenDisplay(token.id, {
          displayValue: 'Active',
          startContent: <span>icon</span>,
        });
      });

      expect(Object.keys(editor.schema.nodes.filterToken.spec.attrs ?? {}).sort()).toEqual([
        'id',
        'immutable',
        'key',
        'operator',
        'value',
      ]);
      expect(Object.keys(editor.schema.nodes.freeTextToken.spec.attrs ?? {}).sort()).toEqual([
        'id',
        'quoted',
        'value',
      ]);
      const json = editor.getJSON();
      expect(containsReactElement(json)).toBe(false);
      expect(JSON.stringify(json)).not.toContain('Active');
    });
  });
});
