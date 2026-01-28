import { type MutableRefObject, useEffect, useRef } from 'react';

/**
 * Scroll an element into view with 'nearest' block alignment.
 * Safe to call with null/undefined elements.
 */
export function scrollIntoViewNearest(element: HTMLElement | null | undefined): void {
  element?.scrollIntoView({ block: 'nearest' });
}

/**
 * Hook to manage refs for a list of items and scroll the active item into view.
 *
 * @param activeIndex - The currently active item index (-1 for none)
 * @returns A ref Map to be used with list items
 *
 * @example
 * ```tsx
 * const itemRefs = useScrollActiveIntoView(activeIndex);
 *
 * return items.map((item, index) => (
 *   <div ref={(el) => { if (el) itemRefs.current.set(index, el); }}>
 *     {item.label}
 *   </div>
 * ));
 * ```
 */
export function useScrollActiveIntoView<T extends HTMLElement = HTMLElement>(
  activeIndex: number
): MutableRefObject<Map<number, T>> {
  const itemRefs = useRef<Map<number, T>>(new Map());

  useEffect(() => {
    if (activeIndex >= 0) {
      scrollIntoViewNearest(itemRefs.current.get(activeIndex));
    }
  }, [activeIndex]);

  return itemRefs;
}
