/**
 * Unit tests for useTextWidth: the one measurement of how wide an input has to be.
 */
import { cleanup, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const measuredTexts: string[] = [];
const textContext = {
  font: '',
  letterSpacing: '',
  measureText: (text: string) => {
    measuredTexts.push(text);
    return { width: text.length * 10 };
  },
};
const originalGetContext = HTMLCanvasElement.prototype.getContext;

async function loadHook() {
  vi.resetModules();
  return (await import('../../hooks/use-text-width')).useTextWidth;
}

function createInput(style: Partial<CSSStyleDeclaration> = {}): HTMLInputElement {
  const input = document.createElement('input');
  Object.assign(input.style, style);
  document.body.appendChild(input);
  return input;
}

beforeEach(() => {
  measuredTexts.length = 0;
  Object.defineProperty(HTMLCanvasElement.prototype, 'getContext', {
    configurable: true,
    writable: true,
    value: () => textContext,
  });
});

afterEach(() => {
  cleanup();
  document.body.replaceChildren();
  vi.unstubAllGlobals();
  Object.defineProperty(HTMLCanvasElement.prototype, 'getContext', {
    configurable: true,
    writable: true,
    value: originalGetContext,
  });
});

describe('useTextWidth', () => {
  it('measures the text in the font of the element, with its padding and room for the caret', async () => {
    const useTextWidth = await loadHook();
    const input = createInput({
      fontStyle: 'italic',
      fontWeight: '700',
      fontSize: '16px',
      fontFamily: 'Mono',
      paddingLeft: '4px',
      paddingRight: '2px',
    });

    const { result } = renderHook(() => useTextWidth({ current: input }, 'hello'));

    expect(textContext.font).toBe('italic 700 16px Mono');
    expect(result.current).toBe(50 + 4 + 2 + 4);
  });

  it('measures again when the text changes', async () => {
    const useTextWidth = await loadHook();
    const input = createInput();

    const { result, rerender } = renderHook(({ text }) => useTextWidth({ current: input }, text), {
      initialProps: { text: 'a long enough text' },
    });
    const wide = result.current;
    rerender({ text: 'abcdefghijklmnop' });

    expect(wide).toBe(180 + 4);
    expect(result.current).toBe(160 + 4);
  });

  it('never goes below the minimum width', async () => {
    const useTextWidth = await loadHook();
    const input = createInput();

    const { result } = renderHook(() => useTextWidth({ current: input }, ''));

    expect(result.current).toBe(20);
  });

  it('does not measure while inactive', async () => {
    const useTextWidth = await loadHook();
    const input = createInput();

    const { result } = renderHook(() => useTextWidth({ current: input }, 'hello', false));

    expect(result.current).toBeUndefined();
    expect(measuredTexts).toEqual([]);
  });

  it('leaves the sizing to CSS where field-sizing: content is supported', async () => {
    vi.stubGlobal('CSS', { supports: (property: string) => property === 'field-sizing' });
    const useTextWidth = await loadHook();
    const input = createInput();

    const { result } = renderHook(() => useTextWidth({ current: input }, 'hello'));

    expect(result.current).toBeUndefined();
    expect(measuredTexts).toEqual([]);
  });

  it('has no width to give when the canvas cannot measure', async () => {
    Object.defineProperty(HTMLCanvasElement.prototype, 'getContext', {
      configurable: true,
      writable: true,
      value: () => null,
    });
    const useTextWidth = await loadHook();
    const input = createInput();

    const { result } = renderHook(() => useTextWidth({ current: input }, 'hello'));

    expect(result.current).toBeUndefined();
  });
});
