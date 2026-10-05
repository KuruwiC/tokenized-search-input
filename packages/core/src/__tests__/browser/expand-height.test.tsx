import { describe, expect, it } from 'vitest';
import type { TokenizedSearchInputProps } from '../../index';
import {
  finishAnimations,
  focusEditor,
  type MountedAround,
  mountEditorAround,
  tokenElements,
} from './harness';

/** Enough tokens for six rows in a 260px box with 2rem tokens. */
const SIX_ROWS = Array.from({ length: 6 }, (_, i) => `status:is:value-number-${i}`).join(' ');

/** Sizes set where pages set them: on an element around the input, not on :root. */
const LARGE = { '--tsi-token-size': '2rem' };

function mountIn(
  variables: Record<string, string>,
  props: Partial<TokenizedSearchInputProps>
): Promise<MountedAround> {
  return mountEditorAround(SIX_ROWS, props, { width: '260px', variables });
}

async function expand(m: MountedAround): Promise<void> {
  await focusEditor(m, 'start');
  await finishAnimations();
}

function rows(tokens: HTMLElement[]): number {
  return new Set(tokens.map((token) => Math.round(token.getBoundingClientRect().top))).size;
}

/** The rows whose tokens the box shows whole, and whether any token is cut at an edge. */
function visibleRows(m: MountedAround, box: HTMLElement): { whole: number; cut: number } {
  const edge = box.getBoundingClientRect();
  const whole: HTMLElement[] = [];
  const cut: HTMLElement[] = [];
  for (const token of tokenElements(m)) {
    const r = token.getBoundingClientRect();
    if (r.top >= edge.top - 0.5 && r.bottom <= edge.bottom + 0.5) whole.push(token);
    else if (r.bottom > edge.top && r.top < edge.bottom) cut.push(token);
  }
  return { whole: rows(whole), cut: rows(cut) };
}

describe('an expandOnFocus box with larger tokens set around it', () => {
  it('shows --tsi-expand-max-lines whole rows when it opens and scrolls the rest', async () => {
    const m = await mountIn(LARGE, { expandOnFocus: true });
    await expand(m);
    expect(rows(tokenElements(m))).toBe(6);

    expect(visibleRows(m, m.input).whole).toBe(4);
    expect(m.input.scrollHeight).toBeGreaterThan(m.input.clientHeight);
  });

  it('shows as many rows as --tsi-expand-max-lines set around it', async () => {
    const m = await mountIn({ ...LARGE, '--tsi-expand-max-lines': '2' }, { expandOnFocus: true });
    await expand(m);

    expect(visibleRows(m, m.input).whole).toBe(2);
  });

  it('shows one whole row while collapsed', async () => {
    const m = await mountIn(LARGE, { expandOnFocus: true });

    expect(visibleRows(m, m.container)).toEqual({ whole: 1, cut: 0 });
  });
});

describe('a singleLine box with larger tokens set around it', () => {
  it('shows its row whole', async () => {
    const m = await mountIn(LARGE, { singleLine: true });

    expect(visibleRows(m, m.container)).toEqual({ whole: 1, cut: 0 });
  });
});

describe('the default theme', () => {
  it('keeps the height of a collapsed expandOnFocus box and a singleLine box', async () => {
    const collapsed = await mountIn({}, { expandOnFocus: true });
    expect(collapsed.container.getBoundingClientRect().height).toBe(46);
    const single = await mountIn({}, { singleLine: true });
    expect(single.container.getBoundingClientRect().height).toBe(46);
  });

  it('shows four whole rows when an expandOnFocus box opens', async () => {
    const m = await mountIn({}, { expandOnFocus: true });
    await expand(m);

    expect(visibleRows(m, m.input).whole).toBe(4);
  });
});
