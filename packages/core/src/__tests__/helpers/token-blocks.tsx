import { render, within } from '@testing-library/react';
import type userEvent from '@testing-library/user-event';
import type { Editor } from '@tiptap/core';
import { createRef, type RefObject } from 'react';
import { expect } from 'vitest';
import {
  TokenizedSearchInput,
  type TokenizedSearchInputRef,
} from '../../editor/tokenized-search-input';
import { getFocusedToken } from '../../plugins/token-focus';
import type { FieldDefinition } from '../../types';
import { extendedFields } from '../fixtures';
import { waitForEditor } from './get-editor';

export async function renderInput(
  defaultValue: string,
  props: { fields?: FieldDefinition[]; unknownFields?: Record<string, never> } = {}
) {
  const ref = createRef<TokenizedSearchInputRef>();
  render(
    <TokenizedSearchInput
      ref={ref}
      fields={props.fields ?? extendedFields}
      unknownFields={props.unknownFields}
      defaultValue={defaultValue}
    />
  );
  const editor = await waitForEditor(ref);
  return { ref: ref as RefObject<TokenizedSearchInputRef>, editor };
}

export function tokenOf(ref: RefObject<TokenizedSearchInputRef>) {
  return ref.current?.getSnapshot().segments[0];
}

export function focusedTokenId(editor: Editor): string | undefined {
  return getFocusedToken(editor.state)?.id;
}

/**
 * Edits the token and walks left from its value to the block labelled `blockLabel`:
 * one step to the operator, two to the label.
 */
export async function focusBlock(
  user: ReturnType<typeof userEvent.setup>,
  group: HTMLElement,
  blockLabel: 'Select operator' | 'Select field'
): Promise<HTMLElement> {
  await user.click(group);
  const block = await within(group).findByLabelText(blockLabel);
  await user.keyboard('{Home}');
  await user.keyboard(blockLabel === 'Select operator' ? '{ArrowLeft}' : '{ArrowLeft}{ArrowLeft}');
  expect(block).toHaveFocus();
  return block;
}
