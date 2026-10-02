import type { TokenizedSearchInputRef } from '@kuruwic/tokenized-search-input';
import { useAsyncTokenResolver } from '@kuruwic/tokenized-search-input';
import { Loader2 } from 'lucide-react';
import type { RefObject } from 'react';
import { type Country, fetchCountries } from './countries';

export const countrySuggestion = (country: Country, selected: boolean) => ({
  tokens: [
    {
      key: 'country',
      operator: 'is' as const,
      value: country.value,
      displayValue: country.label,
      startContent: <span>{country.emoji}</span>,
    },
  ],
  label: `${country.emoji} ${country.label}`,
  confidence: selected ? 1 : 0.9,
  endContent: selected ? <span className="selected-mark">✓</span> : undefined,
});

/** Resolves country tokens that arrive by value, such as pasted codes, into display data. */
export function useCountryResolver(inputRef: RefObject<TokenizedSearchInputRef>) {
  return useAsyncTokenResolver({
    inputRef,
    fieldKey: 'country',
    resolve: async (values) =>
      (await fetchCountries({ values, offset: 0, limit: values.length })).countries,
    getValue: (country) => country.value,
    getDisplayData: (country) => ({
      displayValue: country.label,
      startContent: <span>{country.emoji}</span>,
    }),
    loadingContent: {
      displayValue: 'Loading…',
      startContent: <Loader2 className="h-full w-full animate-spin" />,
    },
  });
}
