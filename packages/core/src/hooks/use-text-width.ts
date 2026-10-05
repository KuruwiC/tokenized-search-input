import { type RefObject, useState } from 'react';
import { useIsomorphicLayoutEffect } from './use-isomorphic-layout-effect';

const MIN_WIDTH = 20;
/** Room that keeps the caret and the last glyph from being clipped. */
const CARET_ROOM = 4;

let measureContext: CanvasRenderingContext2D | null | undefined;

function getMeasureContext(): CanvasRenderingContext2D | null {
  if (measureContext === undefined) {
    measureContext = document.createElement('canvas').getContext('2d');
  }
  return measureContext;
}

let fieldSizing: boolean | undefined;

function sizesToContent(): boolean {
  if (fieldSizing === undefined) {
    fieldSizing =
      typeof CSS !== 'undefined' &&
      typeof CSS.supports === 'function' &&
      CSS.supports('field-sizing', 'content');
  }
  return fieldSizing;
}

/** Reads the font from `element` so the width follows whatever style the consumer gives it. */
function measureInputWidth(element: HTMLElement, text: string): number | null {
  const context = getMeasureContext();
  if (!context) return null;

  const style = window.getComputedStyle(element);
  context.font = `${style.fontStyle} ${style.fontWeight} ${style.fontSize} ${style.fontFamily}`;
  context.letterSpacing = style.letterSpacing;
  const padding = Number.parseFloat(style.paddingLeft) + Number.parseFloat(style.paddingRight);
  return Math.ceil(context.measureText(text).width + (padding || 0) + CARET_ROOM);
}

/**
 * The width, in pixels, an input needs to show `text` without scrolling. Where CSS
 * `field-sizing: content` sizes inputs, nothing is measured and the result is undefined:
 * the stylesheet does the sizing. Measuring only runs while `active`, that is, while the
 * input is shown.
 */
export function useTextWidth(
  ref: RefObject<HTMLElement | null>,
  text: string,
  active = true
): number | undefined {
  const [width, setWidth] = useState<number>();

  useIsomorphicLayoutEffect(() => {
    if (!active || sizesToContent()) return;
    const element = ref.current;
    if (!element) return;
    const measured = measureInputWidth(element, text);
    setWidth(measured === null ? undefined : Math.max(MIN_WIDTH, measured));
  }, [ref, text, active]);

  return sizesToContent() ? undefined : width;
}
