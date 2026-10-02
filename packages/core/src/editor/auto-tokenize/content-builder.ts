import type { SerializedToken } from '../../serializer';
import { createFilterTokenAttrs } from '../../tokens/filter-token/create-attrs';
import type { FreeTextMode } from '../../types';
import type { FieldResolutionSource } from '../../utils/resolve-field';
import { getFreeTextStrategy } from './free-text-strategy';
import type { ContentItem } from './types';

export function buildTokenContent(
  token: SerializedToken,
  source: FieldResolutionSource,
  freeTextMode: FreeTextMode
): ContentItem | null {
  if (token.type === 'filter') {
    return {
      type: 'filterToken',
      attrs: createFilterTokenAttrs({
        key: token.key,
        operator: token.operator,
        value: token.value,
        source,
      }),
    };
  }

  if (token.type === 'freeText' && token.value.trim()) {
    const strategy = getFreeTextStrategy(freeTextMode);
    const docContent = strategy.toDocContent(token);
    if (docContent) {
      return docContent as ContentItem;
    }
  }

  return null;
}

export function buildContentFromTokens(
  tokens: SerializedToken[],
  source: FieldResolutionSource,
  freeTextMode: FreeTextMode
): ContentItem[] {
  const content: ContentItem[] = [];

  for (const token of tokens) {
    const item = buildTokenContent(token, source, freeTextMode);
    if (!item) continue;
    // Two plain-text words would otherwise merge into one text node.
    if (item.type === 'text' && content[content.length - 1]?.type === 'text') {
      content.push({ type: 'text', text: ' ' });
    }
    content.push(item);
  }

  return content;
}
