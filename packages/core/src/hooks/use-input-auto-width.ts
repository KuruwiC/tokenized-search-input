import { useCallback, useState } from 'react';
import { useIsomorphicLayoutEffect } from './use-isomorphic-layout-effect';

/**
 * Hook to calculate input width based on content.
 * Provides cross-browser support for auto-sizing inputs,
 * as `field-sizing: content` is not supported in Firefox.
 *
 * Returns [width, measureCallback] - call measureCallback when input mounts
 */
export function useInputAutoWidth(
  inputRef: React.RefObject<HTMLInputElement | null>,
  value: string,
  placeholder: string = '...'
): [number | undefined, () => void] {
  const [width, setWidth] = useState<number | undefined>(undefined);

  const measureWidth = useCallback(() => {
    const input = inputRef.current;
    if (!input) return;

    const text = value || placeholder;

    const span = document.createElement('span');
    span.style.cssText = 'position:absolute;visibility:hidden;white-space:pre;';

    const computedStyle = window.getComputedStyle(input);
    span.style.font = computedStyle.font;
    span.style.fontSize = computedStyle.fontSize;
    span.style.fontFamily = computedStyle.fontFamily;
    span.style.fontWeight = computedStyle.fontWeight;
    span.style.letterSpacing = computedStyle.letterSpacing;

    span.textContent = text;
    document.body.appendChild(span);

    const measuredWidth = span.offsetWidth;
    document.body.removeChild(span);

    // Add buffer for cursor and font rendering differences
    const CURSOR_BUFFER = 4;
    setWidth(measuredWidth + CURSOR_BUFFER);
  }, [inputRef, value, placeholder]);

  useIsomorphicLayoutEffect(() => {
    measureWidth();
  }, [measureWidth]);

  return [width, measureWidth];
}
