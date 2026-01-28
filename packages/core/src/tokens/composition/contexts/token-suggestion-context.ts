import { createContext, useContext } from 'react';

export type TokenSuggestionType = 'field' | 'value' | null;

/**
 * Suggestion state context for Token components.
 * Updates when suggestion popup state changes.
 */
export interface TokenSuggestionContextValue {
  isOpen: boolean;
  type: TokenSuggestionType;
  open: (type: Exclude<TokenSuggestionType, null>) => void;
  close: () => void;
}

export const TokenSuggestionContext = createContext<TokenSuggestionContextValue | null>(null);

export function useTokenSuggestion(): TokenSuggestionContextValue | null {
  return useContext(TokenSuggestionContext);
}

export function useTokenSuggestionRequired(): TokenSuggestionContextValue {
  const context = useContext(TokenSuggestionContext);
  if (!context) {
    throw new Error(
      'useTokenSuggestionRequired must be used within a Token with suggestion support'
    );
  }
  return context;
}
