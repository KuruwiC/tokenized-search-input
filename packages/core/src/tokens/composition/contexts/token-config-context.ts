import type { Node as ProseMirrorNode } from '@tiptap/pm/model';
import type { Editor } from '@tiptap/react';
import { createContext, useContext } from 'react';

/**
 * Static configuration context for Token components.
 * Contains rarely-changing values to minimize re-renders.
 */
export interface TokenConfigContextValue {
  editor: Editor;
  getPos: () => number | undefined;
  node: ProseMirrorNode;
  updateAttributes: (attrs: Record<string, unknown>) => void;
  deleteToken: () => void;
}

export const TokenConfigContext = createContext<TokenConfigContextValue | null>(null);

export function useTokenConfig(): TokenConfigContextValue {
  const context = useContext(TokenConfigContext);
  if (!context) {
    throw new Error('useTokenConfig must be used within a Token component');
  }
  return context;
}
