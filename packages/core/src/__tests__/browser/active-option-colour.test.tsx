import { describe, expect, it, vi } from 'vitest';
import { userEvent } from 'vitest/browser';
import type { CustomSuggestion, FieldDefinition, TokenizedSearchInputProps } from '../../index';
import {
  type Around,
  editLastToken,
  finishAnimations,
  focusEditor,
  type MountedAround,
  mountEditorAround,
  pressUntil,
} from './harness';

const fields: FieldDefinition[] = [
  { key: 'status', label: 'Status', type: 'string', operators: ['is', 'is_not'] },
  { key: 'owner', label: 'Owner', type: 'string', operators: ['is', 'is_not'] },
  { key: 'priority', label: 'Priority', type: 'string', operators: ['is'] },
];

const custom: CustomSuggestion = {
  label: 'Open issues',
  description: 'Every issue that is still open',
  tokens: [{ key: 'status', operator: 'is', value: 'open' }],
};

const props: Partial<TokenizedSearchInputProps> = {
  fields,
  suggestions: {
    custom: {
      debounceMs: 0,
      displayMode: 'append',
      suggest: ({ query }) => (query ? [custom] : []),
    },
  },
};

/** An accent theme, set where pages set it: on an element around the input, not on :root. */
const ACCENT = {
  '--tsi-primary-muted': 'rgb(237, 233, 254)',
  '--tsi-primary-muted-foreground': 'rgb(91, 33, 182)',
};

const active = (selector: string) =>
  document.querySelector<HTMLElement>(`${selector}[data-active="true"]`);

async function activeOption(selector: string): Promise<HTMLElement> {
  const option = await vi.waitFor(() => {
    const found = active(selector);
    if (!found) throw new Error(`no active ${selector}`);
    return found;
  });
  await finishAnimations();
  return option;
}

async function openList(selector: string): Promise<HTMLElement> {
  await vi.waitFor(() => expect(document.querySelector(selector)).not.toBeNull());
  if (!active(selector)) await userEvent.keyboard('{ArrowDown}');
  return activeOption(selector);
}

async function fieldOption(m: MountedAround): Promise<HTMLElement> {
  await focusEditor(m, 'end');
  return openList('.tsi-suggestion-item:not(.tsi-custom-suggestion-item)');
}

async function customOption(m: MountedAround): Promise<HTMLElement> {
  await focusEditor(m, 'end');
  await userEvent.keyboard('s');
  await vi.waitFor(() =>
    expect(document.querySelector('.tsi-custom-suggestion-item')).not.toBeNull()
  );
  await pressUntil('{ArrowDown}', () => active('.tsi-custom-suggestion-item') !== null);
  return activeOption('.tsi-custom-suggestion-item');
}

async function operatorOption(m: MountedAround): Promise<HTMLElement> {
  await editLastToken(m);
  await pressUntil('{ArrowLeft}', () =>
    Boolean(document.activeElement?.matches('.tsi-token-operator--interactive'))
  );
  await userEvent.keyboard('{Enter}');
  return openList('.tsi-token-operator__option');
}

async function labelOption(m: MountedAround): Promise<HTMLElement> {
  await editLastToken(m);
  await pressUntil('{ArrowLeft}', () =>
    Boolean(document.activeElement?.matches('.tsi-token-label-combobox'))
  );
  await userEvent.keyboard('{Enter}');
  return openList('.tsi-token-label-combobox__option');
}

const lists: Array<{
  name: string;
  value: string;
  open: (m: MountedAround) => Promise<HTMLElement>;
}> = [
  { name: 'the field suggestion list', value: '', open: fieldOption },
  { name: 'a custom suggestion list', value: '', open: customOption },
  { name: 'the operator dropdown', value: 'status:is:open', open: operatorOption },
  { name: 'the label combobox', value: 'status:is:open', open: labelOption },
];

async function colours(
  list: (typeof lists)[number],
  around: Around
): Promise<{ background: string; color: string }> {
  const m = await mountEditorAround(list.value, props, around);
  const option = await list.open(m);
  const style = getComputedStyle(option);
  return { background: style.backgroundColor, color: style.color };
}

describe('the active option', () => {
  for (const list of lists) {
    it(`takes the primary muted colours set around the input in ${list.name}`, async () => {
      expect(await colours(list, { variables: ACCENT })).toEqual({
        background: ACCENT['--tsi-primary-muted'],
        color: ACCENT['--tsi-primary-muted-foreground'],
      });
    });

    it(`keeps its light default colours in ${list.name}`, async () => {
      expect(await colours(list, {})).toEqual({
        background: 'rgb(245, 245, 245)',
        color: 'rgb(10, 10, 10)',
      });
    });

    it(`keeps its dark default colours in ${list.name}`, async () => {
      expect(await colours(list, { attributes: { 'data-theme': 'dark' } })).toEqual({
        background: 'rgb(38, 38, 38)',
        color: 'rgb(250, 250, 250)',
      });
    });
  }
});
