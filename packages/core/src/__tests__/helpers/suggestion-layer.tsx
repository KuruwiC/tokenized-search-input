import { render, waitFor } from '@testing-library/react';
import type { Editor } from '@tiptap/core';
import { createRef, type RefObject } from 'react';
import { expect, vi } from 'vitest';
import {
  TokenizedSearchInput,
  type TokenizedSearchInputRef,
} from '../../editor/tokenized-search-input';
import type { CustomSuggestion, FieldDefinition } from '../../types';

export const fields: FieldDefinition[] = [
  { key: 'status', label: 'Status', type: 'enum', operators: ['is'], enumValues: ['a', 'b'] },
  { key: 'owner', label: 'Owner', type: 'string', operators: ['is'] },
  { key: 'team', label: 'Team', type: 'string', operators: ['is'], category: 'People' },
];

export const customOptions: CustomSuggestion[] = [
  { label: 'First', tokens: [{ key: 'owner', operator: 'is', value: 'first' }] },
  { label: 'Second', tokens: [{ key: 'owner', operator: 'is', value: 'second' }] },
];

export async function renderInput(
  props: Partial<React.ComponentProps<typeof TokenizedSearchInput>> = {}
): Promise<{ ref: RefObject<TokenizedSearchInputRef>; editor: Editor }> {
  const ref = createRef<TokenizedSearchInputRef>();
  render(<TokenizedSearchInput ref={ref} fields={fields} {...props} />);
  await waitFor(() => expect(ref.current?.getEditor()).not.toBeNull());
  const editor = ref.current?.getEditor();
  if (!editor) throw new Error('editor not created');
  return { ref: ref as RefObject<TokenizedSearchInputRef>, editor };
}

export function activeDescendant(element: HTMLElement): HTMLElement {
  const id = element.getAttribute('aria-activedescendant');
  const option = id ? document.getElementById(id) : null;
  if (!option) throw new Error(`aria-activedescendant ${id} does not name an element`);
  return option;
}

/** Custom suggestions named `names`, each inserting an owner token of that name. */
export const page = (names: string[]): CustomSuggestion[] =>
  names.map((label) => ({ label, tokens: [{ key: 'owner', operator: 'is', value: label }] }));

/**
 * Replaces IntersectionObserver with one that reports nothing until the returned function
 * is called, which reports every observed element as visible.
 */
export function observeIntersections(): () => void {
  const observed = new Set<IntersectionObserverCallback>();
  class ControlledObserver {
    private readonly callback: IntersectionObserverCallback;
    constructor(callback: IntersectionObserverCallback) {
      this.callback = callback;
    }
    observe() {
      observed.add(this.callback);
    }
    unobserve() {}
    disconnect() {
      observed.delete(this.callback);
    }
    takeRecords() {
      return [];
    }
  }
  vi.stubGlobal('IntersectionObserver', ControlledObserver);
  return () => {
    for (const callback of [...observed]) {
      callback([{ isIntersecting: true } as IntersectionObserverEntry], {} as IntersectionObserver);
    }
  };
}
