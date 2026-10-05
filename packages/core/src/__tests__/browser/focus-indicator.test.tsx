import { describe, expect, it, onTestFinished, vi } from 'vitest';
import { userEvent } from 'vitest/browser';
import type { FieldDefinition } from '../../index';
import { editLastToken, type MountedEditor, mountEditor, pressUntil } from './harness';

// Two operators and two fields make the operator and the label interactive parts.
const fields: FieldDefinition[] = [
  { key: 'status', label: 'Status', type: 'string', operators: ['is', 'is_not'] },
  { key: 'owner', label: 'Owner', type: 'string', operators: ['is', 'is_not'] },
  { key: 'lock', label: 'Lock', type: 'string', operators: ['is'], immutable: true },
];

const PARTS = {
  label: '.tsi-token-label-combobox',
  operator: '.tsi-token-operator--interactive',
  delete: '.tsi-token-delete',
} as const;

type Rgb = [number, number, number, number];

const canvas = new OffscreenCanvas(1, 1);
const context = canvas.getContext('2d', { willReadFrequently: true });

/** Any CSS colour as sRGB channels 0–255 and alpha 0–1, by painting it. */
function rgba(color: string): Rgb {
  if (!context) throw new Error('no 2d context to read colours');
  context.clearRect(0, 0, 1, 1);
  context.fillStyle = color;
  context.fillRect(0, 0, 1, 1);
  const [r = 0, g = 0, b = 0, a = 0] = context.getImageData(0, 0, 1, 1).data;
  return [r, g, b, a / 255];
}

function luminance([r, g, b]: Rgb): number {
  const channel = (value: number) => {
    const c = value / 255;
    return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}

function contrast(a: Rgb, b: Rgb): number {
  const [light, dark] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return ((light ?? 0) + 0.05) / ((dark ?? 0) + 0.05);
}

/** The background painted behind `element`: its own, or the nearest ancestor's. */
function backgroundBehind(element: Element | null): Rgb {
  for (let node = element; node; node = node.parentElement) {
    const color = rgba(getComputedStyle(node).backgroundColor);
    if (color[3] > 0) return color;
  }
  return [255, 255, 255, 1];
}

function part(m: MountedEditor, name: keyof typeof PARTS): HTMLElement {
  const element = m.pm.querySelector<HTMLElement>(PARTS[name]);
  if (!element) throw new Error(`no ${name} part in the editor`);
  return element;
}

/** Keyboard focus on each part of the last token, from its value. */
async function focusPart(m: MountedEditor, name: keyof typeof PARTS): Promise<HTMLElement> {
  await editLastToken(m);
  const key = name === 'delete' ? '{ArrowRight}' : '{ArrowLeft}';
  await pressUntil(key, () => document.activeElement?.matches(PARTS[name]) ?? false);
  return part(m, name);
}

interface Indicator {
  style: string;
  width: number;
  /** Contrast with the background inside the part and with the token around it. */
  contrast: number;
}

function indicatorOf(element: HTMLElement): Indicator {
  const style = getComputedStyle(element);
  const color = rgba(style.outlineColor);
  const token = element.closest('.tsi-token');
  return {
    style: style.outlineStyle,
    width: Number.parseFloat(style.outlineWidth),
    contrast: Math.min(
      contrast(color, backgroundBehind(element)),
      contrast(color, backgroundBehind(token))
    ),
  };
}

function applyTheme(theme: 'light' | 'dark'): void {
  document.documentElement.dataset.theme = theme;
  onTestFinished(() => {
    delete document.documentElement.dataset.theme;
  });
}

describe('keyboard focus on a token part', () => {
  for (const theme of ['light', 'dark'] as const) {
    for (const name of Object.keys(PARTS) as (keyof typeof PARTS)[]) {
      it(`shows an indicator with 3:1 contrast on the ${name} in the ${theme} theme`, async () => {
        applyTheme(theme);
        const m = await mountEditor('status:is:open', { fields });
        const element = await focusPart(m, name);

        const indicator = indicatorOf(element);
        expect(indicator.style).not.toBe('none');
        expect(indicator.width).toBeGreaterThanOrEqual(2);
        expect(indicator.contrast).toBeGreaterThanOrEqual(3);
      });
    }
  }
});

describe('a pointer press on a token part', () => {
  for (const name of ['label', 'operator'] as const) {
    it(`shows no focus indicator on the ${name}`, async () => {
      const m = await mountEditor('status:is:open', { fields });
      await userEvent.click(m.pm.querySelector('.tsi-token-value') ?? m.pm);
      await userEvent.click(part(m, name));

      expect(getComputedStyle(part(m, name)).outlineStyle).toBe('none');
    });
  }

  it('shows no focus indicator on the operator a pressed label option moves focus to', async () => {
    const m = await mountEditor('status:is:open', { fields });
    await userEvent.click(m.pm.querySelector('.tsi-token-value') ?? m.pm);
    await userEvent.click(part(m, 'label'));
    const owner = await vi.waitFor(() => {
      const option = [...document.querySelectorAll('[role="option"]')].find((o) =>
        o.textContent?.includes('Owner')
      );
      if (!option) throw new Error('the label options are not open');
      return option;
    });
    await userEvent.click(owner);

    await vi.waitFor(() => expect(document.activeElement).toBe(part(m, 'operator')));
    expect(getComputedStyle(part(m, 'operator')).outlineStyle).toBe('none');
  });

  it('shows no focus indicator on the delete button an immutable token focuses', async () => {
    const m = await mountEditor('lock:is:fixed', { fields });
    await userEvent.click(m.pm.querySelector('.tsi-token') ?? m.pm);

    expect(document.activeElement).toBe(part(m, 'delete'));
    expect(getComputedStyle(part(m, 'delete')).outlineStyle).toBe('none');
  });
});
