import { describe, expect, it, onTestFinished } from 'vitest';
import { userEvent } from 'vitest/browser';
import type { FieldDefinition } from '../../index';
import {
  addStyleSheet,
  editLastToken,
  type MountedEditor,
  mountEditor,
  pressUntil,
  tokenElements,
} from './harness';

const fields: FieldDefinition[] = [
  { key: 'status', label: 'Status', type: 'string', operators: ['is'] },
  { key: 'owner', label: 'Owner', type: 'string', operators: ['is'] },
];

/** A font whose letters are twice as wide at weight 900 as at its default weight. */
const VARIABLE_FONT = 'TSI Variable Width';

async function loadVariableFont(): Promise<void> {
  const url = new URL('./fixtures/variable-width.ttf', import.meta.url).href;
  const face = new FontFace(VARIABLE_FONT, `url(${url})`, { weight: '400 900' });
  await face.load();
  document.fonts.add(face);
  onTestFinished(() => {
    document.fonts.delete(face);
  });
}

interface Case {
  name: string;
  css: string;
  font?: boolean;
}

const CASES: Case[] = [
  { name: 'the default style', css: '' },
  { name: 'letter spacing', css: '.tsi-token { letter-spacing: 0.08em; }' },
  {
    name: 'variation settings of a variable font',
    css: `.tsi-token { font-family: '${VARIABLE_FONT}'; font-variation-settings: 'wght' 900; }`,
    font: true,
  },
  { name: 'uppercase text', css: '.tsi-token { text-transform: uppercase; }' },
];

/** Text properties the token sets that its inputs have to render with. */
const TEXT_PROPERTIES = [
  'font-family',
  'font-size',
  'font-weight',
  'font-stretch',
  'font-feature-settings',
  'font-variation-settings',
  'letter-spacing',
  'word-spacing',
  'text-transform',
] as const;

function textStyleOf(element: Element): Record<string, string> {
  const style = getComputedStyle(element);
  return Object.fromEntries(TEXT_PROPERTIES.map((name) => [name, style.getPropertyValue(name)]));
}

function focusedInput(): HTMLInputElement {
  const input = document.activeElement;
  if (!(input instanceof HTMLInputElement)) throw new Error('no token input holds focus');
  return input;
}

/**
 * The whole text shows: nothing scrolls out of view with the caret at either end. The caret
 * is put back where it was.
 */
function expectFits(input: HTMLInputElement): void {
  const { selectionStart, selectionEnd } = input;
  input.setSelectionRange(0, 0);
  expect(input.scrollLeft).toBe(0);
  input.setSelectionRange(input.value.length, input.value.length);
  expect(input.scrollWidth).toBeLessThanOrEqual(input.clientWidth);
  expect(input.scrollLeft).toBe(0);
  input.setSelectionRange(selectionStart, selectionEnd);
}

async function prepare(c: Case): Promise<void> {
  if (c.font) await loadVariableFont();
  if (c.css) addStyleSheet(c.css);
}

async function editLastValue(m: MountedEditor): Promise<HTMLInputElement> {
  await editLastToken(m);
  const input = focusedInput();
  expect(input.matches('.tsi-token-value__input')).toBe(true);
  return input;
}

async function editLastLabel(m: MountedEditor): Promise<HTMLInputElement> {
  await editLastValue(m);
  await pressUntil('{ArrowLeft}', () =>
    Boolean(document.activeElement?.matches('.tsi-token-label-combobox'))
  );
  await userEvent.keyboard('{Enter}');
  const input = focusedInput();
  expect(input.matches('.tsi-token-label-combobox__input')).toBe(true);
  return input;
}

describe('the value input of a token being edited', () => {
  for (const c of CASES) {
    it(`shows the whole value with ${c.name}`, async () => {
      await prepare(c);
      const m = await mountEditor('status:is:active', { fields });
      const input = await editLastValue(m);

      expect(input.value).toBe('active');
      expect(textStyleOf(input)).toEqual(textStyleOf(tokenElements(m)[0] ?? m.pm));
      expectFits(input);
    });
  }

  it('is as wide for the placeholder of an empty value as for the same text typed', async () => {
    const m = await mountEditor('status:is:ab', { fields });
    const input = await editLastValue(m);
    await userEvent.keyboard('{Backspace}{Backspace}');
    expect(input.value).toBe('');
    expect(input.placeholder).toBe('...');
    const placeholderWidth = input.getBoundingClientRect().width;

    await userEvent.keyboard('...');
    expect(input.value).toBe('...');
    expectFits(input);
    expect(input.getBoundingClientRect().width).toBe(placeholderWidth);
  });

  it('grows and shrinks with the typed text', async () => {
    const m = await mountEditor('status:is:active', { fields });
    const input = await editLastValue(m);
    const before = input.getBoundingClientRect().width;

    await userEvent.keyboard('wide');
    expect(input.getBoundingClientRect().width).toBeGreaterThan(before);
    expectFits(input);

    await userEvent.keyboard('{Backspace}'.repeat(4));
    expect(input.getBoundingClientRect().width).toBe(before);
  });

  it('keeps fitting when the token font loads after editing started', async () => {
    addStyleSheet(
      `.tsi-token { font-family: '${VARIABLE_FONT}'; font-variation-settings: 'wght' 900; }`
    );
    const m = await mountEditor('status:is:active', { fields });
    const input = await editLastValue(m);
    const before = input.getBoundingClientRect().width;

    await loadVariableFont();
    await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));

    expect(input.getBoundingClientRect().width).toBeGreaterThan(before);
    expectFits(input);
  });

  it('adds no width to a token that is not being edited', async () => {
    const m = await mountEditor('status:is:active', { fields });
    const value = m.pm.querySelector<HTMLElement>('.tsi-token-value');
    const display = value?.querySelector<HTMLElement>('.tsi-token-value__display');
    if (!value || !display) throw new Error('no value display');
    const style = getComputedStyle(value);
    const padding = Number.parseFloat(style.paddingLeft) + Number.parseFloat(style.paddingRight);

    expect(value.getBoundingClientRect().width).toBeCloseTo(
      display.getBoundingClientRect().width + padding,
      1
    );
  });
});

describe('the label input of a token being edited', () => {
  for (const c of CASES) {
    it(`shows the whole label with ${c.name}`, async () => {
      await prepare(c);
      const m = await mountEditor('status:is:active', { fields, unknownFields: {} });
      const input = await editLastLabel(m);

      expect(input.value).toBe('Status');
      expect(textStyleOf(input)).toEqual(textStyleOf(tokenElements(m)[0] ?? m.pm));
      expectFits(input);
    });
  }

  it('keeps a minimum width when the label is cleared', async () => {
    const m = await mountEditor('status:is:active', { fields, unknownFields: {} });
    const input = await editLastLabel(m);
    await userEvent.keyboard('{Backspace}');

    expect(input.value).toBe('');
    expect(input.getBoundingClientRect().width).toBeGreaterThanOrEqual(20);
  });
});
