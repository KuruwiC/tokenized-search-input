import type { Decoration } from '@tiptap/pm/view';

/**
 * Spec object passed to Decoration.node() for range selection.
 */
export interface RangeSelectedSpec {
  rangeSelected?: boolean;
}

/**
 * Check if any decoration marks this node as range-selected.
 */
export function isRangeSelected(decorations: readonly Decoration[]): boolean {
  return decorations.some((d) => (d.spec as RangeSelectedSpec | undefined)?.rangeSelected === true);
}
