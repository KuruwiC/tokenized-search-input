import { describe, expect, it, vi } from 'vitest';
import type { FieldDefinition } from '../../index';
import { programEntry } from '../../plugins/token-focus';
import { enterToken } from '../../tokens/enter-token';
import {
  editLastToken,
  finishAnimations,
  type MountedEditor,
  mountEditorAround,
  pressUntil,
} from './harness';

// Two fields and two operators make the label and the operator interactive parts.
const fields: FieldDefinition[] = [
  { key: 'status', label: 'Status', type: 'string', operators: ['is', 'is_not'] },
  { key: 'owner', label: 'Owner', type: 'string', operators: ['is', 'is_not'] },
  { key: 'lock', label: 'Lock', type: 'string', operators: ['is'], immutable: true },
];

const THEMES = {
  default: { variables: {}, radius: '8px' },
  'large-radius': {
    variables: { '--tsi-radius': '16px', '--tsi-radius-inner': '6px' },
    radius: '16px',
  },
  pill: { variables: { '--tsi-radius': '9999px' }, radius: '9999px' },
} as const;

const SHAPES: Record<string, Record<string, string>> = {
  ...Object.fromEntries(Object.entries(THEMES).map(([theme, { variables }]) => [theme, variables])),
  'large-token': { '--tsi-token-size': '2rem' },
  'thick-border': { '--tsi-radius': '16px', '--tsi-token-border-width': '2px' },
};

const PARTS = {
  label: { selector: '.tsi-token-label-combobox', key: '{ArrowLeft}' },
  operator: { selector: '.tsi-token-operator--interactive', key: '{ArrowLeft}' },
  delete: { selector: '.tsi-token-delete', key: '{ArrowRight}' },
} as const;

const END_SIDES = { label: 'left', delete: 'right' } as const;

type Corner = 'TopLeft' | 'TopRight' | 'BottomRight' | 'BottomLeft';
const CORNERS: Corner[] = ['TopLeft', 'TopRight', 'BottomRight', 'BottomLeft'];
const SIDE_CORNERS: Record<'left' | 'right', readonly Corner[]> = {
  left: ['TopLeft', 'BottomLeft'],
  right: ['TopRight', 'BottomRight'],
};

/**
 * Radii as drawn: radii that add up to more than a side scale every corner by one factor
 * (CSS Backgrounds 3, §5.5). Corners are read as circular, the only kind this stylesheet draws.
 */
function usedRadius(element: Element): (corner: Corner) => number {
  const style = getComputedStyle(element);
  const { width, height } = element.getBoundingClientRect();
  const r = (corner: Corner) => Number.parseFloat(style[`border${corner}Radius`]);
  const factor = Math.min(
    1,
    width / (r('TopLeft') + r('TopRight')),
    width / (r('BottomLeft') + r('BottomRight')),
    height / (r('TopLeft') + r('BottomLeft')),
    height / (r('TopRight') + r('BottomRight'))
  );
  return (corner) => r(corner) * factor;
}

async function focusPart(
  m: MountedEditor,
  name: keyof typeof PARTS
): Promise<{ part: HTMLElement; token: HTMLElement }> {
  const { selector, key } = PARTS[name];
  await editLastToken(m);
  await pressUntil(key, () => document.activeElement?.matches(selector) ?? false);
  const part = m.pm.querySelector<HTMLElement>(selector);
  const token = part?.closest<HTMLElement>('.tsi-token');
  if (!part || !token) throw new Error(`no ${name} part in a token`);
  return { part, token };
}

function expectFillsInsideBorder(part: Element, token: HTMLElement): void {
  const border = Number.parseFloat(getComputedStyle(token).borderTopWidth);
  const tokenBox = token.getBoundingClientRect();
  const partBox = part.getBoundingClientRect();
  expect(partBox.top, `top of ${part.className}`).toBeCloseTo(tokenBox.top + border, 1);
  expect(partBox.bottom, `bottom of ${part.className}`).toBeCloseTo(tokenBox.bottom - border, 1);
}

/**
 * The part fills the token's corners on `side` inside the border, rounded to the token's
 * radius less its border width.
 */
function expectConcentric(part: HTMLElement, token: HTMLElement, side: 'left' | 'right'): void {
  const border = Number.parseFloat(getComputedStyle(token).borderTopWidth);
  const tokenBox = token.getBoundingClientRect();
  const partBox = part.getBoundingClientRect();
  expectFillsInsideBorder(part, token);
  expect(partBox[side], `${side} edge`).toBeCloseTo(
    side === 'left' ? tokenBox.left + border : tokenBox.right - border,
    1
  );

  const tokenRadius = usedRadius(token);
  const partRadius = usedRadius(part);
  for (const corner of CORNERS) {
    const expected = SIDE_CORNERS[side].includes(corner)
      ? Math.max(0, tokenRadius(corner) - border)
      : 0;
    expect(partRadius(corner), corner).toBeCloseTo(expected, 1);
  }
}

describe('the end part of a token with keyboard focus', () => {
  for (const [theme, { variables, radius }] of Object.entries(THEMES)) {
    for (const name of Object.keys(END_SIDES) as (keyof typeof END_SIDES)[]) {
      it(`follows the curve inside the token's border: ${name} part, ${theme} theme`, async () => {
        const m = await mountEditorAround('status:is:open', { fields }, { variables });
        const { part, token } = await focusPart(m, name);

        expect(getComputedStyle(part).outlineStyle).not.toBe('none');
        expectConcentric(part, token, END_SIDES[name]);
        expect(getComputedStyle(token).borderTopLeftRadius).toBe(radius);
        expect(getComputedStyle(token).borderTopWidth).toBe('1px');
      });
    }
  }

  it('follows a token border width set around the input', async () => {
    const m = await mountEditorAround(
      'status:is:open',
      { fields },
      { variables: { '--tsi-radius': '16px', '--tsi-token-border-width': '2px' } }
    );
    const { part, token } = await focusPart(m, 'delete');

    expect(getComputedStyle(token).borderTopWidth).toBe('2px');
    expectConcentric(part, token, 'right');
  });
});

/** Each run of text and each input of the token sits inside its border, centred in its height. */
function expectTextCentred(token: HTMLElement): void {
  const border = Number.parseFloat(getComputedStyle(token).borderTopWidth);
  const tokenBox = token.getBoundingClientRect();
  const centre = (tokenBox.top + tokenBox.bottom) / 2;
  const boxes: [string, DOMRect][] = [...token.querySelectorAll('input')].map((input) => [
    'input',
    input.getBoundingClientRect(),
  ]);
  const walker = document.createTreeWalker(token, NodeFilter.SHOW_TEXT);
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    if (!node.textContent?.trim()) continue;
    const range = document.createRange();
    range.selectNodeContents(node);
    boxes.push([`text "${node.textContent}"`, range.getBoundingClientRect()]);
  }
  for (const [name, box] of boxes) {
    expect(box.top, `top of ${name}`).toBeGreaterThanOrEqual(tokenBox.top + border - 0.05);
    expect(box.bottom, `bottom of ${name}`).toBeLessThanOrEqual(tokenBox.bottom - border + 0.05);
    expect((box.top + box.bottom) / 2, `centre of ${name}`).toBeCloseTo(centre, 0);
  }
}

function expectPartsFillTokens(m: MountedEditor): void {
  for (const token of m.pm.querySelectorAll<HTMLElement>('.tsi-token')) {
    for (const part of token.children) expectFillsInsideBorder(part, token);
    expectTextCentred(token);
  }
}

/** A filter token, an immutable one and a plain and a quoted free-text token after them. */
async function mountEveryKindOfToken(variables: Record<string, string>): Promise<MountedEditor> {
  const m = await mountEditorAround(
    'status:is:open lock:is:fixed',
    { fields, freeTextMode: 'tokenize' },
    { variables }
  );
  m.editor.commands.insertContentAt(m.editor.state.doc.content.size - 1, [
    { type: 'text', text: ' ' },
    { type: 'freeTextToken', attrs: { value: 'ab' } },
    { type: 'text', text: ' ' },
    { type: 'freeTextToken', attrs: { value: 'c d', quoted: true } },
  ]);
  await vi.waitFor(() => expect(m.pm.querySelectorAll('.tsi-token')).toHaveLength(4));
  await finishAnimations();
  return m;
}

function tokenIds(m: MountedEditor, type: string): string[] {
  const ids: string[] = [];
  m.editor.state.doc.descendants((node) => {
    if (node.type.name === type) ids.push(String(node.attrs.id));
  });
  return ids;
}

describe('every part of a token', () => {
  for (const [shape, variables] of Object.entries(SHAPES)) {
    it(`fills the token's height inside its border: tokens at rest, ${shape} theme`, async () => {
      const m = await mountEveryKindOfToken(variables);

      expectPartsFillTokens(m);
    });

    it(`fills the token's height inside its border: tokens being edited, ${shape} theme`, async () => {
      const m = await mountEveryKindOfToken(variables);
      const [filter] = tokenIds(m, 'filterToken');
      const [, quoted] = tokenIds(m, 'freeTextToken');
      if (!filter || !quoted) throw new Error('no tokens to edit');

      for (const id of [filter, quoted]) {
        enterToken(m.editor, id, programEntry());
        await vi.waitFor(() => expect(document.activeElement).toBeInstanceOf(HTMLInputElement));
        await finishAnimations();
        expectPartsFillTokens(m);
      }
    });

    for (const name of Object.keys(PARTS) as (keyof typeof PARTS)[]) {
      it(`keeps its keyboard focus outline inside the border: ${name} part, ${shape} theme`, async () => {
        const m = await mountEditorAround('status:is:open', { fields }, { variables });
        const { part, token } = await focusPart(m, name);

        const style = getComputedStyle(part);
        expect(style.outlineStyle).not.toBe('none');
        expect(
          Number.parseFloat(style.outlineOffset) + Number.parseFloat(style.outlineWidth)
        ).toBeLessThanOrEqual(0);
        expectFillsInsideBorder(part, token);
      });
    }
  }
});
