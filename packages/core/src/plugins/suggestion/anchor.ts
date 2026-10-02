import type { Node as ProseMirrorNode } from '@tiptap/pm/model';
import { findTokenById } from '../../utils/find-token';
import type { SuggestionAnchor } from './types';

export function tokenAnchor(tokenId: string | null): SuggestionAnchor | null {
  return tokenId === null ? null : { tokenId };
}

export function positionAnchor(pos: number | null): SuggestionAnchor | null {
  return pos === null ? null : { pos };
}

/** The position an anchor points at in the document: the start of its token, or its position. */
export function resolveAnchorPos(
  doc: ProseMirrorNode,
  anchor: SuggestionAnchor | null
): number | null {
  if (anchor === null) return null;
  if ('tokenId' in anchor) return findTokenById(doc, anchor.tokenId)?.pos ?? null;
  return anchor.pos;
}

export function isAnchoredToToken(anchor: SuggestionAnchor | null, tokenId: string): boolean {
  return anchor !== null && 'tokenId' in anchor && anchor.tokenId === tokenId;
}
