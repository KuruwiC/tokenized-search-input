import type { QuerySnapshot, QuerySnapshotFilterToken } from '../types';
import { getFilterTokens } from './query-snapshot';

export type TokenEvent =
  | { type: 'create'; token: QuerySnapshotFilterToken }
  | { type: 'delete'; tokenId: string }
  | { type: 'update'; token: QuerySnapshotFilterToken };

export const diffSnapshots = (prev: QuerySnapshot, next: QuerySnapshot): TokenEvent[] => {
  const prevTokens = getFilterTokens(prev);
  const nextTokens = getFilterTokens(next);

  const prevIds = new Set(prevTokens.map((t) => t.id));
  const nextIds = new Set(nextTokens.map((t) => t.id));

  const prevTokenMap = new Map(prevTokens.map((t) => [t.id, t]));
  const nextTokenMap = new Map(nextTokens.map((t) => [t.id, t]));

  const events: TokenEvent[] = [];

  // Detect created tokens
  for (const id of nextIds) {
    const token = nextTokenMap.get(id);
    if (!prevIds.has(id) && token) {
      events.push({ type: 'create', token });
    }
  }

  // Detect deleted tokens
  for (const id of prevIds) {
    if (!nextIds.has(id)) {
      events.push({ type: 'delete', tokenId: id });
    }
  }

  // Detect updated tokens
  for (const id of nextIds) {
    const prevToken = prevTokenMap.get(id);
    const nextToken = nextTokenMap.get(id);
    if (prevToken && nextToken) {
      if (prevToken.value !== nextToken.value || prevToken.operator !== nextToken.operator) {
        events.push({ type: 'update', token: nextToken });
      }
    }
  }

  return events;
};

export interface TokenEventHandlers {
  onTokenCreate?: (token: QuerySnapshotFilterToken) => void;
  onTokenDelete?: (tokenId: string) => void;
  onTokenUpdate?: (token: QuerySnapshotFilterToken) => void;
}

export const notifyTokenObservers = (events: TokenEvent[], handlers: TokenEventHandlers): void => {
  for (const event of events) {
    switch (event.type) {
      case 'create':
        handlers.onTokenCreate?.(event.token);
        break;
      case 'delete':
        handlers.onTokenDelete?.(event.tokenId);
        break;
      case 'update':
        handlers.onTokenUpdate?.(event.token);
        break;
    }
  }
};
