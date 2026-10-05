import { describe, expect, it, onTestFinished } from 'vitest';
import { userEvent } from 'vitest/browser';
import type { FieldDefinition } from '../../index';
import {
  addStyleSheet,
  afterLastToken,
  editLastToken,
  finishAnimations,
  type MountedEditor,
  mountEditor,
  tokenElements,
} from './harness';

/** Ordinary application CSS: element selectors, unlayered, loaded after the library. */
const APP_CSS = `
  :focus-visible { outline: 2px solid #2563eb; outline-offset: 2px; }
  p { margin: 0 0 1rem; }
  button { padding: .5rem 1rem; border: 1px solid #ccc; border-radius: 6px; background: #f3f4f6; }
  ul { padding-left: 1.5rem; list-style: disc; }
  input { padding: .5rem; border: 1px solid #ccc; }
`;

/** Universal resets, unlayered: a common `margin` reset and the border reset of Tailwind v3. */
const UNIVERSAL_RESET_CSS = `
  * { margin: 0; }
  *, ::before, ::after { border-width: 0; border-style: solid; }
`;

const QUERY = 'status:is:open owner:is:me';

// Two operators and two fields make the operator and the label interactive parts.
const fields: FieldDefinition[] = [
  { key: 'status', label: 'Status', type: 'string', operators: ['is', 'is_not'] },
  { key: 'owner', label: 'Owner', type: 'string', operators: ['is', 'is_not'] },
];

const BOX_PROPERTIES = [
  'padding',
  'margin',
  'border',
  'border-radius',
  'background-color',
  'line-height',
] as const;

function boxOf(element: Element): Record<string, string> {
  const style = getComputedStyle(element);
  return Object.fromEntries(BOX_PROPERTIES.map((name) => [name, style.getPropertyValue(name)]));
}

function part(m: MountedEditor, selector: string): HTMLElement {
  const element = m.pm.querySelector<HTMLElement>(selector);
  if (!element) throw new Error(`no ${selector} in the editor`);
  return element;
}

function container(m: MountedEditor): HTMLElement {
  const element = m.pm.closest<HTMLElement>('.tsi-container');
  if (!element) throw new Error('no editor container');
  return element;
}

/** The space between the two tokens, the borders and the height of the editor. */
function layoutOf(m: MountedEditor): Record<string, string | number> {
  const [first, second] = tokenElements(m);
  if (!first || !second) throw new Error('two tokens expected');
  return {
    gap: second.getBoundingClientRect().left - first.getBoundingClientRect().right,
    containerBorder: getComputedStyle(container(m)).borderTopWidth,
    tokenBorder: getComputedStyle(first).borderTopWidth,
    height: container(m).getBoundingClientRect().height,
  };
}

describe('the editor under application CSS', () => {
  it('keeps the layout and the box of its own parts', async () => {
    const m = await mountEditor(QUERY, { fields });
    // Editing the last token turns its operator and label into buttons
    await editLastToken(m);
    const height = container(m).getBoundingClientRect().height;
    const deleteBox = boxOf(part(m, '.tsi-token-delete'));
    const operatorBox = boxOf(part(m, '.tsi-token-operator--interactive'));
    const inputBox = boxOf(part(m, '.tsi-token-value__input'));

    addStyleSheet(APP_CSS);
    await finishAnimations();

    expect(container(m).getBoundingClientRect().height).toBe(height);
    expect(boxOf(part(m, '.tsi-token-delete'))).toEqual(deleteBox);
    expect(boxOf(part(m, '.tsi-token-operator--interactive'))).toEqual(operatorBox);
    expect(boxOf(part(m, '.tsi-token-value__input'))).toEqual(inputBox);
  });

  it('shows only its own focus indicator while the editor has focus', async () => {
    const m = await mountEditor(QUERY, { fields });
    await userEvent.click(m.pm, { position: afterLastToken(m) });
    expect(document.activeElement).toBe(m.pm);
    await finishAnimations();
    const focusedBorder = getComputedStyle(container(m)).borderTopColor;

    addStyleSheet(APP_CSS);
    await finishAnimations();

    expect(getComputedStyle(m.pm).outlineStyle).toBe('none');
    expect(getComputedStyle(container(m)).borderTopColor).toBe(focusedBorder);
  });

  it('lets a classNames class and a rule in a later layer restyle its parts', async () => {
    addStyleSheet(`
      ${APP_CSS}
      .app-delete { padding-right: 11px; }
      @layer utilities { .u-delete-bg { background-color: rgb(10, 20, 30); } }
    `);
    const m = await mountEditor(QUERY, {
      fields,
      classNames: { tokenDeleteButton: 'app-delete u-delete-bg' },
    });

    const style = getComputedStyle(part(m, '.tsi-token-delete'));
    expect(style.paddingRight).toBe('11px');
    expect(style.backgroundColor).toBe('rgb(10, 20, 30)');
  });

  it('keeps the space between tokens and the borders under universal resets', async () => {
    const m = await mountEditor(QUERY, { fields });
    const layout = layoutOf(m);

    addStyleSheet(UNIVERSAL_RESET_CSS);
    await finishAnimations();

    expect(layoutOf(m)).toEqual(layout);
  });

  it('leaves elements outside the editor to the application CSS', async () => {
    addStyleSheet(APP_CSS);
    await mountEditor(QUERY, { fields });
    const outside = document.createElement('button');
    outside.textContent = 'Outside';
    document.body.append(outside);
    onTestFinished(() => outside.remove());

    const style = getComputedStyle(outside);
    expect(style.paddingTop).toBe('8px');
    expect(style.paddingLeft).toBe('16px');
    expect(style.borderTopWidth).toBe('1px');
    expect(style.backgroundColor).toBe('rgb(243, 244, 246)');
  });
});
