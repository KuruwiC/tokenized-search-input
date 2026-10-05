import { render } from '@testing-library/react';
import type { Editor } from '@tiptap/core';
import { createRef, type RefObject } from 'react';
import { TokenizedSearchInput } from '../../editor/tokenized-search-input';
import type {
  TokenizedSearchInputProps,
  TokenizedSearchInputRef,
} from '../../editor/tokenized-search-input.types';
import { basicFields } from '../fixtures';
import { waitForEditor } from './get-editor';

export interface MountedInput {
  ref: RefObject<TokenizedSearchInputRef | null>;
  editor: Editor;
  value: () => string;
}

/** Renders the input over `basicFields` and resolves once its editor exists. */
export async function mountInput(
  defaultValue = '',
  props: Partial<TokenizedSearchInputProps> = {}
): Promise<MountedInput> {
  const ref = createRef<TokenizedSearchInputRef>();
  render(
    <TokenizedSearchInput ref={ref} fields={basicFields} defaultValue={defaultValue} {...props} />
  );
  const editor = await waitForEditor(ref);
  return { ref, editor, value: () => ref.current?.getValue() ?? '' };
}
