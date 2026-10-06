import { describe, expect, it } from 'vitest';
import { userEvent } from 'vitest/browser';
import type { FieldDefinition } from '../../index';
import {
  editLastToken,
  finishAnimations,
  focusEditor,
  insideRoundedBox,
  type MountedEditor,
  mountEditorAround,
  pressUntil,
  radiusOf,
  waitForFrames,
} from './harness';

const icon = <span aria-hidden="true">●</span>;

const fields: FieldDefinition[] = [
  { key: 'status', label: 'Status', type: 'string', operators: ['is', 'is_not'], icon },
  { key: 'owner', label: 'Owner', type: 'string', operators: ['is', 'is_not'], icon },
  { key: 'priority', label: 'Priority', type: 'string', operators: ['is'], icon },
  { key: 'project', label: 'Project', type: 'string', operators: ['is'], icon },
  { key: 'created', label: 'Created', type: 'datetime', operators: ['is'], icon },
];

/** A pill-shaped theme, set where pages set it: on an element around the input, not on :root. */
const PILL = { '--tsi-radius': '9999px', '--tsi-radius-inner': '9999px' };

async function openPopover(selector: string): Promise<HTMLElement> {
  return waitForFrames(() => {
    const popover = document.querySelector<HTMLElement>(selector);
    if (!popover) throw new Error(`${selector} is not open`);
    return popover;
  });
}

async function openSuggestions(m: MountedEditor): Promise<HTMLElement> {
  await focusEditor(m, 'end');
  const popover = await openPopover('.tsi-dropdown');
  await waitForFrames(() =>
    expect(popover.querySelectorAll('.tsi-suggestion-item').length).toBeGreaterThan(1)
  );
  await finishAnimations();
  return popover;
}

async function openOperatorDropdown(m: MountedEditor): Promise<HTMLElement> {
  await editLastToken(m);
  await pressUntil('{ArrowLeft}', () =>
    Boolean(document.activeElement?.matches('.tsi-token-operator--interactive'))
  );
  await userEvent.keyboard('{Enter}');
  return openPopover('.tsi-token-operator__dropdown');
}

async function openDatePicker(m: MountedEditor): Promise<HTMLElement> {
  await editLastToken(m);
  return openPopover('.tsi-dropdown--date');
}

/** The corners of what an option shows (icon, label, key), a pixel inside each edge. */
function contentCorners(option: Element): [number, number][] {
  const rects = [...option.children].map((child) => child.getBoundingClientRect());
  const left = Math.min(...rects.map((r) => r.left)) + 1;
  const right = Math.max(...rects.map((r) => r.right)) - 1;
  const top = Math.min(...rects.map((r) => r.top)) + 1;
  const bottom = Math.max(...rects.map((r) => r.bottom)) - 1;
  return [
    [left, top],
    [right, top],
    [left, bottom],
    [right, bottom],
  ];
}

describe('popovers under a pill theme', () => {
  it('keeps the suggestion list a rounded box that shows its first and last options whole', async () => {
    const m = await mountEditorAround('', { fields }, { variables: PILL });
    const popover = await openSuggestions(m);

    const options = [...popover.querySelectorAll('.tsi-suggestion-item')];
    for (const option of [options[0], options[options.length - 1]]) {
      if (!option) throw new Error('no option');
      for (const [x, y] of contentCorners(option)) {
        expect(insideRoundedBox(popover, x, y), `${option.textContent} at ${x},${y}`).toBe(true);
      }
    }
    expect(radiusOf(popover)).toBeLessThanOrEqual(12);
  });

  it('keeps the operator dropdown a rounded box', async () => {
    const m = await mountEditorAround('status:is:open', { fields }, { variables: PILL });
    const popover = await openOperatorDropdown(m);

    expect(radiusOf(popover)).toBeLessThanOrEqual(12);
  });

  it('keeps the date picker a rounded box and its checkboxes square', async () => {
    const m = await mountEditorAround('created:is:2024-01-15', { fields }, { variables: PILL });
    const popover = await openDatePicker(m);

    const checkboxes = popover.querySelectorAll('input[type="checkbox"]');
    expect(checkboxes.length).toBeGreaterThan(0);
    for (const checkbox of checkboxes) expect(radiusOf(checkbox)).toBeLessThanOrEqual(4);
    expect(radiusOf(popover)).toBeLessThanOrEqual(12);
  });
});

describe('the popover radius', () => {
  it('stays at the default radius of the default theme', async () => {
    const m = await mountEditorAround('', { fields }, {});
    const popover = await openSuggestions(m);

    expect(getComputedStyle(popover).borderTopLeftRadius).toBe('8px');
  });

  it('follows a smaller --tsi-radius set around the input', async () => {
    const m = await mountEditorAround('', { fields }, { variables: { '--tsi-radius': '2px' } });
    const popover = await openSuggestions(m);

    expect(getComputedStyle(popover).borderTopLeftRadius).toBe('2px');
  });

  it('follows --tsi-popover-radius set around the input', async () => {
    const m = await mountEditorAround(
      '',
      { fields },
      { variables: { ...PILL, '--tsi-popover-radius': '4px' } }
    );
    const popover = await openSuggestions(m);

    expect(getComputedStyle(popover).borderTopLeftRadius).toBe('4px');
  });
});
