import { describe, expect, it } from 'vitest';
import { userEvent } from 'vitest/browser';
import type { FieldDefinition } from '../../index';
import {
  editLastToken,
  focusedValueInput,
  type MountedEditor,
  mountEditor,
  shownValue,
} from './harness';

const fields: FieldDefinition[] = [
  { key: 'status', label: 'Status', type: 'string', operators: ['is', 'is_not'] },
  { key: 'assignee', label: 'Assignee', type: 'string', operators: ['is', 'contains'] },
];

function filters(m: MountedEditor) {
  return (m.ref.current?.getSnapshot().segments ?? []).map((segment) =>
    segment.type === 'filter'
      ? { key: segment.key, operator: segment.operator, value: segment.value }
      : segment
  );
}

async function typeIntoEmpty(text: string): Promise<MountedEditor> {
  const m = await mountEditor('', { fields });
  await userEvent.click(m.pm);
  await userEvent.keyboard(text);
  return m;
}

describe('typing a filter key by key', () => {
  it('takes the word after the key as the operator', async () => {
    const m = await typeIntoEmpty('status:is_not:active ');
    expect(filters(m)).toEqual([{ key: 'status', operator: 'is_not', value: 'active' }]);
    expect(m.value()).toBe('status:is_not:active');
  });

  it('keeps a value that holds the delimiter', async () => {
    const m = await typeIntoEmpty('assignee:10:30 ');
    expect(filters(m)).toEqual([{ key: 'assignee', operator: 'is', value: '10:30' }]);
  });

  it('keeps the caret in the value, which takes the keys typed after the operator', async () => {
    const m = await typeIntoEmpty('assignee:contains:');
    expect(focusedValueInput()).toHaveAccessibleName('Value for assignee filter');
    expect(shownValue()).toBe('|');

    await userEvent.keyboard('bob');
    expect(shownValue()).toBe('bob|');
    await userEvent.keyboard(' ');
    expect(filters(m)).toEqual([{ key: 'assignee', operator: 'contains', value: 'bob' }]);
  });

  it('keeps the caret before the value when the operator is typed in front of it', async () => {
    const m = await typeIntoEmpty('status:act');
    await userEvent.keyboard('{ArrowLeft}{ArrowLeft}{ArrowLeft}');
    expect(shownValue()).toBe('|act');

    await userEvent.keyboard('is_not:');
    expect(shownValue()).toBe('|act');
    await userEvent.keyboard('in');
    expect(shownValue()).toBe('in|act');

    await userEvent.keyboard('{End} ');
    expect(filters(m)).toEqual([{ key: 'status', operator: 'is_not', value: 'inact' }]);
  });
});

describe('typing inside a value that holds the delimiter', () => {
  it('keeps the caret where the keys go in a typed value', async () => {
    const m = await typeIntoEmpty('assignee:10:30');
    await userEvent.keyboard('{ArrowLeft}{ArrowLeft}');
    expect(shownValue()).toBe('10:|30');

    await userEvent.keyboard('45');
    expect(shownValue()).toBe('10:45|30');
    await userEvent.keyboard('{Delete}{Delete}');
    expect(shownValue()).toBe('10:45|');

    await userEvent.keyboard(' ');
    expect(filters(m)).toEqual([{ key: 'assignee', operator: 'is', value: '10:45' }]);
  });

  it('keeps the caret after a delimiter typed inside a typed value', async () => {
    const m = await typeIntoEmpty('assignee:1030');
    await userEvent.keyboard('{ArrowLeft}{ArrowLeft}:');
    expect(shownValue()).toBe('10:|30');

    await userEvent.keyboard('{End} ');
    expect(filters(m)).toEqual([{ key: 'assignee', operator: 'is', value: '10:30' }]);
  });

  it('keeps the caret where the keys go in a value the query gave', async () => {
    const m = await mountEditor('assignee:is:10:30', { fields });
    await editLastToken(m);
    await userEvent.keyboard('{ArrowLeft}{ArrowLeft}{Backspace}');
    expect(shownValue()).toBe('10|30');

    await userEvent.keyboard(':');
    expect(shownValue()).toBe('10:|30');
    await userEvent.keyboard('{ArrowLeft}{ArrowLeft}{ArrowLeft}contains:');
    expect(shownValue()).toBe('contains:|10:30');

    await userEvent.keyboard('{End} ');
    expect(filters(m)).toEqual([{ key: 'assignee', operator: 'is', value: 'contains:10:30' }]);
  });
});
