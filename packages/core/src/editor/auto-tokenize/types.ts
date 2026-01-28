import type { FreeTextMode } from '../../types';

export interface TextNodeInfo {
  pos: number;
  nodeEnd: number;
  text: string;
  containsCursor: boolean;
}

export interface TokenizeOptions {
  forceCursorText?: boolean;
  freeTextMode?: FreeTextMode;
  allowUnknownFields?: boolean;
  unknownFieldOperators?: readonly string[];
}

export interface ContentItem {
  type: string;
  attrs?: Record<string, unknown>;
  text?: string;
}

// Consolidates multiple refs into a single mutable state object.
export interface TokenizeState {
  lastDocSize: number;
  pendingDebounce: ReturnType<typeof setTimeout> | null;
  isHistoryOperation: boolean;
}

export interface TokenizeEvent {
  sizeChange: number;
  isHistoryOperation: boolean;
}

export interface TokenizeStrategy {
  shouldTokenize(event: TokenizeEvent, freeTextMode: FreeTextMode): boolean;
  getOptions(freeTextMode: FreeTextMode): TokenizeOptions;
  shouldTriggerValidation(): boolean;
  debounceMs: number | null;
}
