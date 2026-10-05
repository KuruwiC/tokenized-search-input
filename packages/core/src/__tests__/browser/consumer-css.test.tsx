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
  pressUntil,
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

/** Descendant rules of a page element that holds the editor, aimed at the page's own inputs and buttons. */
const HOST_CSS = `
  .host input { padding: 9px 12px; border: 1px solid #94a3b8; border-radius: 6px; background: #fff; }
  .host button { padding: 1rem; }
  .host input:focus { outline: 3px solid #2563eb; }
`;

interface Edges {
  top: number;
  right: number;
  bottom: number;
  left: number;
}

/** The box of an element less its borders and, with `padding`, its padding as well. */
function boxWithin(element: Element, padding: boolean): Edges {
  const rect = element.getBoundingClientRect();
  const style = getComputedStyle(element);
  const inset = (side: 'top' | 'right' | 'bottom' | 'left') =>
    Number.parseFloat(style.getPropertyValue(`border-${side}-width`)) +
    (padding ? Number.parseFloat(style.getPropertyValue(`padding-${side}`)) : 0);
  return {
    top: rect.top + inset('top'),
    right: rect.right - inset('right'),
    bottom: rect.bottom - inset('bottom'),
    left: rect.left + inset('left'),
  };
}

const EPSILON = 0.01;

function expectInside(inner: Edges, outer: Edges): void {
  expect(inner.top).toBeGreaterThanOrEqual(outer.top - EPSILON);
  expect(inner.left).toBeGreaterThanOrEqual(outer.left - EPSILON);
  expect(inner.bottom).toBeLessThanOrEqual(outer.bottom + EPSILON);
  expect(inner.right).toBeLessThanOrEqual(outer.right + EPSILON);
}

function lastToken(m: MountedEditor): HTMLElement {
  const tokens = tokenElements(m);
  const token = tokens[tokens.length - 1];
  if (!token) throw new Error('no token');
  return token;
}

function addHostClass(m: MountedEditor): void {
  const host = m.pm.closest('.tsi-root')?.parentElement;
  if (!host) throw new Error('no element holds the editor');
  host.classList.add('host');
}

/**
 * The input sits inside the token's border and shows all of its text: nothing scrolls, and
 * the box its sizing copy gives the text fits inside the input's content box.
 */
function expectTextShows(input: HTMLInputElement, token: HTMLElement): void {
  const tokenInside = boxWithin(token, false);
  expectInside(input.getBoundingClientRect(), tokenInside);
  const content = boxWithin(input, true);
  expectInside(content, tokenInside);
  expect(input.scrollWidth).toBeLessThanOrEqual(input.clientWidth);

  const copy = input.parentElement?.querySelector('[aria-hidden="true"]');
  if (!copy?.firstChild) throw new Error('no sizing copy of the input text');
  const range = document.createRange();
  range.selectNodeContents(copy);
  const text = range.getBoundingClientRect();
  expect(content.right - content.left).toBeGreaterThanOrEqual(text.width - EPSILON);
  expect(content.bottom - content.top).toBeGreaterThanOrEqual(text.height - EPSILON);
}

function focusedInput(): HTMLInputElement {
  const input = document.activeElement;
  if (!(input instanceof HTMLInputElement)) throw new Error('no token input holds focus');
  return input;
}

describe('a token under descendant rules of the element that holds the editor', () => {
  async function mountWithHostCss(): Promise<{ m: MountedEditor; height: number }> {
    const m = await mountEditor(QUERY, { fields, unknownFields: {} });
    const height = lastToken(m).getBoundingClientRect().height;
    addHostClass(m);
    addStyleSheet(HOST_CSS);
    await finishAnimations();
    return { m, height };
  }

  it('keeps its height and its value at rest', async () => {
    const { m, height } = await mountWithHostCss();
    const token = lastToken(m);

    expect(token.getBoundingClientRect().height).toBe(height);
    const tokenInside = boxWithin(token, false);
    for (const input of token.querySelectorAll('input')) {
      expectInside(input.getBoundingClientRect(), tokenInside);
    }
    const text = token.querySelector<HTMLElement>('.tsi-token-value__display-text');
    if (!text) throw new Error('no value text');
    expect(text.scrollWidth).toBeLessThanOrEqual(text.clientWidth);
  });

  it('keeps its height and shows the whole value while the value is edited', async () => {
    const { m, height } = await mountWithHostCss();
    await editLastToken(m);
    await finishAnimations();
    const input = focusedInput();
    expect(input.matches('.tsi-token-value__input')).toBe(true);

    expect(lastToken(m).getBoundingClientRect().height).toBe(height);
    expectTextShows(input, lastToken(m));
  });

  it('keeps its height and shows the whole label while the label is edited', async () => {
    const { m, height } = await mountWithHostCss();
    await editLastToken(m);
    await pressUntil('{ArrowLeft}', () =>
      Boolean(document.activeElement?.matches('.tsi-token-label-combobox'))
    );
    await userEvent.keyboard('{Enter}');
    await finishAnimations();
    const input = focusedInput();
    expect(input.matches('.tsi-token-label-combobox__input')).toBe(true);

    expect(lastToken(m).getBoundingClientRect().height).toBe(height);
    expectTextShows(input, lastToken(m));
  });

  it('takes its size from the --tsi-* variables and its text styles from a classNames class', async () => {
    addStyleSheet(`
      ${HOST_CSS}
      .host { --tsi-token-size: 2rem; --tsi-token-font-size: 1.25rem; }
      .app-value { letter-spacing: 2px; }
    `);
    const m = await mountEditor(QUERY, { fields, classNames: { tokenValue: 'app-value' } });
    addHostClass(m);
    await editLastToken(m);
    await finishAnimations();
    const input = focusedInput();

    expect(lastToken(m).getBoundingClientRect().height).toBe(32);
    expect(getComputedStyle(input).fontSize).toBe('20px');
    expect(getComputedStyle(input).letterSpacing).toBe('2px');
    expectTextShows(input, lastToken(m));
  });
});
