import type { CustomSuggestionConfig, QuerySnapshot } from '@kuruwic/tokenized-search-input';
import { TokenizedSearchInput } from '@kuruwic/tokenized-search-input';
import { createToggleSelectHandler, Unique } from '@kuruwic/tokenized-search-input/utils';
import { useCallback, useMemo, useRef, useState } from 'react';
import { COUNTRY_CODE } from '../code-samples';
import { CodeBlock } from '../components/code-block';
import { CopyButton } from '../components/copy-button';
import { Readout } from '../components/readout';
import { useEditorSnapshot } from '../components/use-editor-snapshot';
import {
  deserializeCountryText,
  type FetchCountriesParams,
  fetchCountries,
  serializeCountryToken,
} from '../countries';
import { countrySuggestion, useCountryResolver } from '../country-field';
import { COUNTRY_FIELDS } from '../fields';

const PASTE_SAMPLE = 'Japan, Germany, br';
const LOG_LIMIT = 6;

type RequestKind = 'search' | 'next page' | 'resolve';
type RequestEntry = {
  id: number;
  kind: RequestKind;
  detail: string;
  result: string | null;
  ms: number | null;
};

const BEHAVIORS = [
  {
    name: 'Debounced search',
    how: 'Type “ger” quickly. One request goes out after you pause for 150 ms.',
  },
  {
    name: 'Pages of ten',
    how: 'Clear the query and scroll to the end of the list. The next page loads in place.',
  },
  {
    name: 'Toggle selection',
    how: 'Choose a country that is already selected to remove it.',
  },
  {
    name: 'Stored IDs resolve to labels',
    how: 'The editor starts with country:is:jp. The flag and name arrive from the resolver.',
  },
  {
    name: 'Paste names or codes',
    how: 'Copy the sample below and paste it into the editor.',
  },
  {
    name: 'Copy as labels',
    how: 'Select tokens and copy. You get “Japan”, not country:is:jp.',
  },
  {
    name: 'Fixed values',
    how: 'Country tokens are immutable. Remove one and pick again instead of editing it.',
  },
] as const;

function describeRequest(kind: RequestKind, params: FetchCountriesParams) {
  if (kind === 'resolve') return (params.values ?? []).join(', ');
  const query = params.query ? `“${params.query}”` : 'all';
  return kind === 'next page' ? `${query} from ${params.offset}` : query;
}

export function AsyncSection() {
  const { ref, snapshot, setSnapshot } = useEditorSnapshot();
  const [requests, setRequests] = useState<RequestEntry[]>([]);
  const nextId = useRef(0);

  const tracked = useCallback(async (kind: RequestKind, params: FetchCountriesParams) => {
    nextId.current += 1;
    const id = nextId.current;
    const started = performance.now();
    setRequests((current) =>
      [
        { id, kind, detail: describeRequest(kind, params), result: null, ms: null },
        ...current,
      ].slice(0, LOG_LIMIT)
    );
    const response = await fetchCountries(params);
    const ms = Math.round(performance.now() - started);
    const result =
      kind === 'resolve'
        ? `${response.countries.length} resolved`
        : `${response.countries.length} of ${response.total}`;
    setRequests((current) =>
      current.map((entry) => (entry.id === id ? { ...entry, result, ms } : entry))
    );
    return response;
  }, []);

  const { resolveTokens } = useCountryResolver(ref, (params) => tracked('resolve', params));

  const custom = useMemo<CustomSuggestionConfig>(() => {
    const selectedIn = (tokens: ReadonlyArray<{ key: string; value: string }>) =>
      new Set(tokens.filter((token) => token.key === 'country').map((token) => token.value));
    return {
      displayMode: 'replace',
      debounceMs: 150,
      maxSuggestions: 10,
      suggest: async ({ query, existingTokens }) => {
        const selected = selectedIn(existingTokens);
        const result = await tracked('search', { query: query.trim(), offset: 0, limit: 10 });
        return {
          suggestions: result.countries.map((c) => countrySuggestion(c, selected.has(c.value))),
          hasMore: result.hasMore,
        };
      },
      loadMore: async ({ query, existingTokens, offset, limit }) => {
        const selected = selectedIn(existingTokens);
        const result = await tracked('next page', { query: query.trim(), offset, limit });
        return {
          suggestions: result.countries.map((c) => countrySuggestion(c, selected.has(c.value))),
          hasMore: result.hasMore,
        };
      },
      onSelect: createToggleSelectHandler(),
    };
  }, [tracked]);

  const onChange = (next: QuerySnapshot) => {
    setSnapshot(next);
    void resolveTokens();
  };

  return (
    <section className="section async" id="async" aria-labelledby="async-title">
      <header className="section__head">
        <h2 className="section__title" id="async-title">
          Values that live on a server
        </h2>
        <p className="section__lede">
          A country picker backed by a slow, paginated API. The request log shows what the editor
          asks for and when.
        </p>
      </header>

      <div className="async__body">
        <div className="async__work">
          <div className="editor">
            <TokenizedSearchInput
              ref={ref}
              fields={COUNTRY_FIELDS}
              defaultValue="country:is:jp"
              freeTextMode="none"
              suggestions={{ field: { disabled: true }, custom }}
              validation={{ rules: [Unique.rule('exact')] }}
              serialization={{
                serializeToken: serializeCountryToken,
                deserializeText: deserializeCountryText,
              }}
              onChange={onChange}
              placeholder="Search countries by name or code"
              clearable
            />
          </div>

          <section className="requests" aria-labelledby="requests-title">
            <h3 className="aside-title" id="requests-title">
              Request log
            </h3>
            {requests.length === 0 ? (
              <p className="requests__empty">Focus the editor to send the first request.</p>
            ) : (
              <ol className="requests__list">
                {requests.map((entry) => (
                  <li key={entry.id} data-pending={entry.result === null ? 'true' : undefined}>
                    <span className="requests__kind">{entry.kind}</span>
                    <span className="requests__detail">{entry.detail}</span>
                    <span className="requests__result">
                      {entry.result === null ? 'waiting' : `${entry.result}, ${entry.ms} ms`}
                    </span>
                  </li>
                ))}
              </ol>
            )}
          </section>

          <Readout snapshot={snapshot} empty="Select a country to see its stored code." />
        </div>

        <div className="async__notes">
          <h3 className="aside-title">What to try</h3>
          <dl className="behaviors">
            {BEHAVIORS.map((behavior) => (
              <div key={behavior.name}>
                <dt>{behavior.name}</dt>
                <dd>{behavior.how}</dd>
              </div>
            ))}
          </dl>
          <div className="paste-sample">
            <code>{PASTE_SAMPLE}</code>
            <CopyButton text={PASTE_SAMPLE} label="Copy paste sample">
              Copy sample
            </CopyButton>
          </div>
        </div>
      </div>

      <details className="disclosure">
        <summary>Show the configuration</summary>
        <CodeBlock code={COUNTRY_CODE} label="CountryPicker.tsx" />
      </details>
    </section>
  );
}
