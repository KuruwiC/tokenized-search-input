import { NODE_TYPE_NAMES } from '../../utils/node-predicates';
import type { ContentItem } from './types';

/**
 * Wrap content items with spacers according to the spacer invariant.
 *
 * INVARIANT: Every token node must have its OWN spacer on both sides.
 * Result: [spacer][token1][spacer][spacer][token2][spacer]
 * Each token owns its leading and trailing spacer independently.
 *
 * This is a pure transformation function that always produces the full
 * spacer structure. The caller should not need to provide context about
 * document position.
 *
 * @param content - Array of content items to wrap
 * @returns Content items with spacers added around tokens
 */
export function wrapWithSpacers(content: ContentItem[]): ContentItem[] {
  const finalContent: ContentItem[] = [];
  let lastWasTextNode = false;

  for (const item of content) {
    const isTokenNode =
      item.type === NODE_TYPE_NAMES.filterToken || item.type === NODE_TYPE_NAMES.freeTextToken;
    const isTextNode = item.type === 'text';

    if (isTokenNode) {
      // Each token always gets its own leading spacer
      finalContent.push({ type: 'spacer' });
      finalContent.push(item);
      // Each token always gets its own trailing spacer
      finalContent.push({ type: 'spacer' });
      lastWasTextNode = false;
    } else if (isTextNode) {
      // Add space before consecutive text nodes to prevent merging
      if (lastWasTextNode) {
        finalContent.push({ type: 'text', text: ' ' });
      }
      finalContent.push(item);
      lastWasTextNode = true;
    } else {
      finalContent.push(item);
      lastWasTextNode = false;
    }
  }

  return finalContent;
}
