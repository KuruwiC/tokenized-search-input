import type { TokenizedSearchInputRef } from '@kuruwic/tokenized-search-input';
import { TokenizedSearchInput, useAsyncTokenResolver } from '@kuruwic/tokenized-search-input';
import type {
  CustomSuggestionConfig,
  ParsedToken,
  QuerySnapshot,
} from '@kuruwic/tokenized-search-input/utils';
import { createToggleSelectHandler, Unique } from '@kuruwic/tokenized-search-input/utils';
import { Loader2 } from 'lucide-react';
import { useCallback, useMemo, useRef, useState } from 'react';
import { COUNTRY_CODE } from '../code-samples';
import { CodeBlock, Snapshot } from '../components';
import { ALL_COUNTRIES, type Country, fetchCountries } from '../countries';
import { COUNTRY_FIELDS } from '../fields';

const countrySuggestion = (country: Country, selected: boolean) => ({
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

function CountryDemo() {
  const inputRef = useRef<TokenizedSearchInputRef>(null);
  const [snapshot, setSnapshot] = useState<QuerySnapshot | null>(null);
  const { resolveTokens } = useAsyncTokenResolver({
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
  const serializeToken = useCallback(
    (token: { key: string; value: string }) =>
      token.key === 'country'
        ? (ALL_COUNTRIES.find((country) => country.value === token.value)?.label ?? null)
        : null,
    []
  );
  const deserializeText = useCallback((text: string): ParsedToken[] | null => {
    const tokens: ParsedToken[] = [];
    let remaining = text.trim();
    const candidates = [...ALL_COUNTRIES].sort((a, b) => b.label.length - a.label.length);

    while (remaining) {
      const match = candidates.find((country) => {
        const source = remaining.toLowerCase();
        const label = country.label.toLowerCase();
        const code = country.value.toLowerCase();
        const boundaryAfter = (length: number) =>
          !remaining[length] || /[\s,;]/.test(remaining[length]);
        return (
          (source.startsWith(label) && boundaryAfter(label.length)) ||
          (source.startsWith(code) && boundaryAfter(code.length))
        );
      });

      if (match) {
        tokens.push({ type: 'filter', key: 'country', operator: 'is', value: match.value });
        const consumed = remaining.toLowerCase().startsWith(match.label.toLowerCase())
          ? match.label.length
          : match.value.length;
        remaining = remaining.slice(consumed).replace(/^[\s,;]+/, '');
        continue;
      }

      const boundary = remaining.search(/[\s,;]/);
      if (boundary === -1) break;
      remaining = remaining.slice(boundary).replace(/^[\s,;]+/, '');
    }

    return tokens.length ? tokens : null;
  }, []);
  const custom = useMemo<CustomSuggestionConfig>(
    () => ({
      displayMode: 'replace',
      debounceMs: 150,
      maxSuggestions: 10,
      suggest: async ({ query, existingTokens }) => {
        const selected = new Set(
          existingTokens.filter((token) => token.key === 'country').map((token) => token.value)
        );
        const result = await fetchCountries({ query: query.trim(), offset: 0, limit: 10 });
        return {
          suggestions: result.countries.map((country) =>
            countrySuggestion(country, selected.has(country.value))
          ),
          hasMore: result.hasMore,
        };
      },
      loadMore: async ({ query, existingTokens, offset, limit }) => {
        const selected = new Set(
          existingTokens.filter((token) => token.key === 'country').map((token) => token.value)
        );
        const result = await fetchCountries({ query: query.trim(), offset, limit });
        return {
          suggestions: result.countries.map((country) =>
            countrySuggestion(country, selected.has(country.value))
          ),
          hasMore: result.hasMore,
        };
      },
      onSelect: createToggleSelectHandler(),
    }),
    []
  );
  const change = useCallback(
    (next: QuerySnapshot) => {
      setSnapshot(next);
      void resolveTokens();
    },
    [resolveTokens]
  );
  return (
    <div className="demo-stack country-demo">
      <div className="demo-surface focus-surface">
        <TokenizedSearchInput
          ref={inputRef}
          fields={COUNTRY_FIELDS}
          defaultValue="country:is:jp"
          freeTextMode="none"
          suggestions={{ field: { disabled: true }, custom }}
          validation={{ rules: [Unique.rule('exact')] }}
          serialization={{ serializeToken, deserializeText }}
          onChange={change}
          placeholder="Search countries by name…"
          clearable
        />
      </div>
      <Snapshot value={snapshot} empty="Try Japan, United States, or paste jp,us." />
    </div>
  );
}

export function AsyncSection() {
  return (
    <section className="section async-section" aria-labelledby="async-title">
      <div className="async-copy">
        <h2 id="async-title">Combine async suggestions with paste resolution.</h2>
        <p>
          This country selector combines debounced search, pagination, toggle selection,
          pasted-value resolution, immutable tokens, and custom clipboard text.
        </p>
        <ul className="check-list">
          <li>Fetch and paginate suggestions</li>
          <li>Resolve stored IDs into display data</li>
          <li>Copy labels; paste names or codes</li>
        </ul>
        <CodeBlock code={COUNTRY_CODE} label="CountrySelector.tsx" collapsed />
      </div>
      <CountryDemo />
    </section>
  );
}
