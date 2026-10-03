/**
 * The text a copy puts on the clipboard is the query: it equals what `getValue` returns
 * for the same content.
 */
import { cleanup, render, waitFor } from '@testing-library/react';
import { createRef } from 'react';
import { afterEach, describe, expect, it } from 'vitest';
import {
  TokenizedSearchInput,
  type TokenizedSearchInputRef,
} from '../../editor/tokenized-search-input';
import type { FieldDefinition, FreeTextMode } from '../../types';
import { getInternalEditor } from '../helpers/get-editor';

afterEach(() => {
  cleanup();
});

const fields: FieldDefinition[] = [
  { key: 'name', label: 'Name', type: 'string', operators: ['is', 'contains'] },
];

async function copiedAndValue(defaultValue: string, freeTextMode: FreeTextMode) {
  const ref = createRef<TokenizedSearchInputRef>();
  render(
    <TokenizedSearchInput
      ref={ref}
      fields={fields}
      defaultValue={defaultValue}
      freeTextMode={freeTextMode}
    />
  );
  await waitFor(() => expect(ref.current).not.toBeNull());
  const editor = getInternalEditor(ref.current);
  if (!editor) throw new Error('editor unavailable');
  await waitFor(() => expect(ref.current?.getValue()).not.toBe(''));
  const slice = editor.state.doc.slice(0, editor.state.doc.content.size);
  const copied = editor.view.someProp('clipboardTextSerializer', (fn) => fn(slice, editor.view));
  return { copied, value: ref.current?.getValue() };
}

describe('clipboard text', () => {
  it.each([
    ['spaces inside a quoted phrase in plain text', '"a  b" name:is:x', 'plain'],
    ['a newline inside a value', 'name:is:"x\ny" tail', 'plain'],
    ['free text that would read as a filter', '"name:foo" name:is:x', 'tokenize'],
    ['free text that only looks like a key and value', 'http://x name:is:x', 'tokenize'],
    ['a value that ends in an ideographic space', 'name:is:太郎　', 'plain'],
  ] satisfies [
    string,
    string,
    FreeTextMode,
  ][])('equals the query for %s', async (_label, query, mode) => {
    const { copied, value } = await copiedAndValue(query, mode);

    expect(copied).toBe(value);
  });
});
