import type { ParsedToken } from '@kuruwic/tokenized-search-input/utils';
import type { Country } from './data';

export const delay = (ms: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms));

export function createDeserializeText(countryList: Country[]) {
  return (text: string): ParsedToken[] | null => {
    const tokens: Array<{ type: 'filter'; key: string; operator: 'is'; value: string }> = [];
    const words = text
      .trim()
      .toLowerCase()
      .split(/[\s,;]+/);

    for (const word of words) {
      const country = countryList.find((c) => c.code.toLowerCase() === word);
      if (country) {
        tokens.push({ type: 'filter', key: 'country', operator: 'is', value: country.code });
      }
    }

    return tokens.length > 0 ? tokens : null;
  };
}

export function filterByQuery<T extends { name?: string; label?: string; value?: string }>(
  items: T[],
  query: string
): T[] {
  const q = query.toLowerCase();
  return items.filter((item) => {
    const name = item.name?.toLowerCase() ?? '';
    const label = item.label?.toLowerCase() ?? '';
    const value = item.value?.toLowerCase() ?? '';
    return name.includes(q) || label.includes(q) || value.includes(q);
  });
}

export function filterCountries(countries: Country[], query: string): Country[] {
  const q = query.toLowerCase();
  return countries.filter(
    (c) => c.name.toLowerCase().includes(q) || c.code.toLowerCase().includes(q)
  );
}

export function createCountrySuggestion(country: Country) {
  return {
    tokens: [
      {
        key: 'country',
        operator: 'is' as const,
        value: country.code,
        displayValue: country.name,
        startContent: <span>{country.emoji}</span>,
      },
    ],
    label: `${country.emoji} ${country.name}`,
  };
}
