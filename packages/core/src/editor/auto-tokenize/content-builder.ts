import type { SerializedToken } from '../../serializer';
import { createFilterTokenAttrs } from '../../tokens/filter-token/create-attrs';
import type { FieldDefinition, FreeTextMode } from '../../types';
import { getFreeTextStrategy } from './free-text-strategy';
import type { ContentItem } from './types';

export function buildTokenContent(
  token: SerializedToken,
  fields: FieldDefinition[],
  freeTextMode: FreeTextMode
): ContentItem | null {
  if (token.type === 'filter') {
    return {
      type: 'filterToken',
      attrs: createFilterTokenAttrs({
        key: token.key,
        operator: token.operator,
        value: token.value,
        fields,
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
  fields: FieldDefinition[],
  freeTextMode: FreeTextMode
): ContentItem[] {
  const content: ContentItem[] = [];

  for (const token of tokens) {
    const item = buildTokenContent(token, fields, freeTextMode);
    if (item) {
      content.push(item);
    }
  }

  return content;
}
