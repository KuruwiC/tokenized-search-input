import { describe, expect, it } from 'vitest';
import type { FieldDefinition } from '../../index';
import { programEntry } from '../../plugins/token-focus';
import { enterToken } from '../../tokens/enter-token';
import {
  editLastToken,
  finishAnimations,
  type MountedEditor,
  mountEditorAround,
  pressUntil,
  waitForFrames,
} from './harness';

// Two fields and two operators make the label and the operator interactive parts.
const fields: FieldDefinition[] = [
  { key: 'status', label: 'Status', type: 'string', operators: ['is', 'is_not'] },
  { key: 'owner', label: 'Owner', type: 'string', operators: ['is', 'is_not'] },
  { key: 'lock', label: 'Lock', type: 'string', operators: ['is'], immutable: true },
];

type EndPart = 'label' | 'delete';

interface Shape {
  variables: Record<string, string>;
  /** End parts checked against the token's curve, and the token's expected radius and border width. */
  curve?: { ends: readonly EndPart[]; radius: string; borderWidth: string };
}

const SHAPES: Record<string, Shape> = {
  default: {
    variables: {},
    curve: { ends: ['label', 'delete'], radius: '8px', borderWidth: '1px' },
  },
  'large-radius': {
    variables: { '--tsi-radius': '16px', '--tsi-radius-inner': '6px' },
    curve: { ends: ['label', 'delete'], radius: '16px', borderWidth: '1px' },
  },
  pill: {
    variables: { '--tsi-radius': '9999px' },
    curve: { ends: ['label', 'delete'], radius: '9999px', borderWidth: '1px' },
  },
  'large-token': { variables: { '--tsi-token-size': '2rem' } },
  'thick-border': {
    variables: { '--tsi-radius': '16px', '--tsi-token-border-width': '2px' },
    curve: { ends: ['delete'], radius: '16px', borderWidth: '2px' },
  },
};

const PARTS = {
  label: { selector: '.tsi-token-label-combobox', key: '{ArrowLeft}' },
  operator: { selector: '.tsi-token-operator--interactive', key: '{ArrowLeft}' },
  delete: { selector: '.tsi-token-delete', key: '{ArrowRight}' },
} as const;

const END_SIDES: Record<EndPart, 'left' | 'right'> = { label: 'left', delete: 'right' };
const isEndPart = (name: string): name is EndPart => name in END_SIDES;

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

function expectFillsInsideBorder(part: Element, token: HTMLElement, context: string): void {
  const border = Number.parseFloat(getComputedStyle(token).borderTopWidth);
  const tokenBox = token.getBoundingClientRect();
  const partBox = part.getBoundingClientRect();
  const name = `${context}: ${part.className}`;
  expect(partBox.top, `top of ${name}`).toBeCloseTo(tokenBox.top + border, 1);
  expect(partBox.bottom, `bottom of ${name}`).toBeCloseTo(tokenBox.bottom - border, 1);
}

/**
 * The part fills the token's corners on `side` inside the border, rounded to the token's
 * radius less its border width.
 */
function expectConcentric(
  part: HTMLElement,
  token: HTMLElement,
  side: 'left' | 'right',
  context: string
): void {
  const border = Number.parseFloat(getComputedStyle(token).borderTopWidth);
  const tokenBox = token.getBoundingClientRect();
  const partBox = part.getBoundingClientRect();
  expectFillsInsideBorder(part, token, context);
  expect(partBox[side], `${context}: ${side} edge`).toBeCloseTo(
    side === 'left' ? tokenBox.left + border : tokenBox.right - border,
    1
  );

  const tokenRadius = usedRadius(token);
  const partRadius = usedRadius(part);
  for (const corner of CORNERS) {
    const expected = SIDE_CORNERS[side].includes(corner)
      ? Math.max(0, tokenRadius(corner) - border)
      : 0;
    expect(partRadius(corner), `${context}: ${corner} radius`).toBeCloseTo(expected, 1);
  }
}

function curvedEndsClause(ends: readonly EndPart[] | undefined): string {
  if (!ends) return '';
  return `; the ${ends.join(' and ')} ${ends.length > 1 ? 'parts follow' : 'part follows'} the curve inside it`;
}

describe('a token part with keyboard focus, each part focused in turn', () => {
  for (const [shape, { variables, curve }] of Object.entries(SHAPES)) {
    it(`keeps its outline inside the token's border${curvedEndsClause(curve?.ends)}: ${shape} theme`, async () => {
      const m = await mountEditorAround('status:is:open', { fields }, { variables });

      for (const name of Object.keys(PARTS) as (keyof typeof PARTS)[]) {
        const context = `${name} part`;
        const { part, token } = await focusPart(m, name);
        const style = getComputedStyle(part);
        expect(style.outlineStyle, `${context}: outline style`).not.toBe('none');
        expect(
          Number.parseFloat(style.outlineOffset) + Number.parseFloat(style.outlineWidth),
          `${context}: outline offset plus width`
        ).toBeLessThanOrEqual(0);
        expectFillsInsideBorder(part, token, context);

        if (curve && isEndPart(name) && curve.ends.includes(name)) {
          expectConcentric(part, token, END_SIDES[name], context);
          expect(getComputedStyle(token).borderTopLeftRadius, `${context}: token radius`).toBe(
            curve.radius
          );
          expect(getComputedStyle(token).borderTopWidth, `${context}: token border width`).toBe(
            curve.borderWidth
          );
        }
      }
    });
  }
});

/** Each run of text and each input of the token sits inside its border, centred in its height. */
function expectTextCentred(token: HTMLElement, context: string): void {
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
  for (const [boxName, box] of boxes) {
    const name = `${context}: ${boxName}`;
    expect(box.top, `top of ${name}`).toBeGreaterThanOrEqual(tokenBox.top + border - 0.05);
    expect(box.bottom, `bottom of ${name}`).toBeLessThanOrEqual(tokenBox.bottom - border + 0.05);
    // Leading is split above and below the text in whole pixels, so an odd leading leaves it
    // half a pixel off centre: Linux renders Times New Roman as Liberation Serif, whose 17px
    // of ascent and descent leave 5px of leading in a 22px line.
    expect(Math.abs((box.top + box.bottom) / 2 - centre), `centre of ${name}`).toBeLessThanOrEqual(
      0.5
    );
  }
}

/** The tokens {@link mountEveryKindOfToken} mounts, in order. */
const EVERY_KIND = ['filter', 'immutable', 'free-text', 'quoted free-text'] as const;

function expectPartsFillTokens(m: MountedEditor, state: string): void {
  for (const [index, token] of m.pm.querySelectorAll<HTMLElement>('.tsi-token').entries()) {
    const context = `${state}, ${EVERY_KIND[index]} token`;
    for (const part of token.children) expectFillsInsideBorder(part, token, context);
    expectTextCentred(token, context);
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
  await waitForFrames(() => expect(m.pm.querySelectorAll('.tsi-token')).toHaveLength(4));
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
  for (const [shape, { variables }] of Object.entries(SHAPES)) {
    it(`fills the token's height inside its border, at rest and while a filter and a quoted token are edited: ${shape} theme`, async () => {
      const m = await mountEveryKindOfToken(variables);
      expectPartsFillTokens(m, 'at rest');

      const [filter] = tokenIds(m, 'filterToken');
      const [, quoted] = tokenIds(m, 'freeTextToken');
      if (!filter || !quoted) throw new Error('no tokens to edit');
      for (const [kind, id] of [
        ['filter', filter],
        ['quoted', quoted],
      ] as const) {
        enterToken(m.editor, id, programEntry());
        await waitForFrames(() => expect(document.activeElement).toBeInstanceOf(HTMLInputElement));
        await finishAnimations();
        expectPartsFillTokens(m, `${kind} token being edited`);
      }
    });
  }
});
