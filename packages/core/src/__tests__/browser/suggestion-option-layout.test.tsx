import { describe, expect, it } from 'vitest';
import { userEvent } from 'vitest/browser';
import type { CustomSuggestion } from '../../index';
import { finishAnimations, focusEditor, mountEditor, waitForFrames } from './harness';

const custom: CustomSuggestion = {
  label: 'Open issues',
  description: 'Every issue that is still open',
  tokens: [{ key: 'status', operator: 'is', value: 'open' }],
};

async function openFieldAndCustomOptions(): Promise<{ field: HTMLElement; custom: HTMLElement }> {
  const m = await mountEditor('', {
    suggestions: {
      custom: {
        debounceMs: 0,
        displayMode: 'append',
        suggest: ({ query }) => (query ? [custom] : []),
      },
    },
  });
  await focusEditor(m, 'end');
  await userEvent.keyboard('s');
  const options = await waitForFrames(() => {
    const field = document.querySelector<HTMLElement>(
      '.tsi-suggestion-item:not(.tsi-custom-suggestion-item)'
    );
    const customOption = document.querySelector<HTMLElement>('.tsi-custom-suggestion-item');
    if (!field || !customOption) throw new Error('field and custom options are not both shown');
    return { field, custom: customOption };
  });
  await finishAnimations();
  return options;
}

describe('suggestion option layout', () => {
  it('stacks the label and description of a custom option instead of spacing them in a centred row', async () => {
    const options = await openFieldAndCustomOptions();
    const field = getComputedStyle(options.field);
    const customStyle = getComputedStyle(options.custom);

    expect(field.flexDirection).toBe('row');
    expect(field.alignItems).toBe('center');
    expect(field.columnGap).toBe('8px');

    expect(customStyle.flexDirection).toBe('column');
    expect(customStyle.alignItems).toBe('stretch');
    expect(customStyle.rowGap).toBe('0px');

    const label = options.custom.querySelector('.tsi-custom-suggestion-item__label');
    const description = options.custom.querySelector('.tsi-custom-suggestion-item__description');
    if (!label || !description) throw new Error('custom option has no label or description');
    const labelBox = label.getBoundingClientRect();
    const descriptionBox = description.getBoundingClientRect();
    expect(descriptionBox.top).toBe(labelBox.bottom);
    expect(descriptionBox.left).toBe(labelBox.left);
  });
});
