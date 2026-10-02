import type {
  CustomSuggestionConfig,
  QuerySnapshot,
  TokenizedSearchInputRef,
} from '@kuruwic/tokenized-search-input';
import { TokenizedSearchInput } from '@kuruwic/tokenized-search-input';
import { createToggleSelectHandler, Unique } from '@kuruwic/tokenized-search-input/utils';
import { useCallback, useMemo, useRef, useState } from 'react';
import { COUNTRY_CODE } from '../code-samples';
import { CodeBlock, Snapshot } from '../components';
import { deserializeCountryText, fetchCountries, serializeCountryToken } from '../countries';
import { countrySuggestion, useCountryResolver } from '../country-field';
import { COUNTRY_FIELDS } from '../fields';

function CountryDemo() {
  const inputRef = useRef<TokenizedSearchInputRef>(null);
  const [snapshot, setSnapshot] = useState<QuerySnapshot | null>(null);
  const { resolveTokens } = useCountryResolver(inputRef);
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
          serialization={{
            serializeToken: serializeCountryToken,
            deserializeText: deserializeCountryText,
          }}
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
