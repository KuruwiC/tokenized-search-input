import type { TokenizedSearchInputRef } from '@kuruwic/tokenized-search-input';
import { TokenizedSearchInput, useAsyncTokenResolver } from '@kuruwic/tokenized-search-input';
import type { CustomSuggestionConfig, QuerySnapshot } from '@kuruwic/tokenized-search-input/utils';
import { Unique } from '@kuruwic/tokenized-search-input/utils';
import type { Story } from '@ladle/react';
import { Check, Loader2 } from 'lucide-react';
import { useCallback, useRef, useState } from 'react';
import {
  AVAILABLE_TAGS,
  COUNTRIES_LARGE,
  COUNTRIES_MEDIUM,
  COUNTRY_FIELD,
  type Country,
  createCountrySuggestion,
  createDeserializeText,
  delay,
  filterCountries,
  PAGINATED_DEMO_FIELDS,
  ResultDisplay,
  SUGGESTION_DEMO_FIELDS,
  TAG_FIELD,
} from './_shared';

export const BasicCustomSuggestion: Story = () => {
  const [result, setResult] = useState<QuerySnapshot | null>(null);

  const customSuggestion: CustomSuggestionConfig = {
    displayMode: 'replace',
    suggest: ({ query }) => {
      const filtered = AVAILABLE_TAGS.filter((tag) =>
        tag.label.toLowerCase().includes(query.toLowerCase())
      );
      return filtered.map((tag) => ({
        tokens: [
          { key: 'tag', operator: 'is' as const, value: tag.value, displayValue: tag.label },
        ],
        label: tag.label,
      }));
    },
  };

  return (
    <div className="p-4">
      <h3 className="text-lg font-medium mb-2">Basic Custom Suggestion</h3>
      <p className="text-sm text-gray-600 mb-4">
        Custom suggestions replace field suggestions. Type to filter available tags.
      </p>
      <TokenizedSearchInput
        fields={[TAG_FIELD]}
        freeTextMode="none"
        onSubmit={setResult}
        placeholder="Search tags..."
        suggestions={{ field: { disabled: true }, custom: customSuggestion }}
      />
      <ResultDisplay result={result} />
    </div>
  );
};

export const PrependMode: Story = () => {
  const [result, setResult] = useState<QuerySnapshot | null>(null);

  const customSuggestion: CustomSuggestionConfig = {
    displayMode: 'prepend',
    suggest: () => [
      {
        tokens: [{ key: 'assignee', operator: 'is' as const, value: 'me' }],
        label: 'Assigned to me',
        description: 'Custom suggestion (prepended)',
      },
    ],
  };

  return (
    <div className="p-4">
      <h3 className="text-lg font-medium mb-2">Prepend Mode</h3>
      <p className="text-sm text-gray-600 mb-4">
        Custom suggestions appear <strong>above</strong> field suggestions. The custom suggestion
        "Assigned to me" is always shown at the top.
      </p>
      <TokenizedSearchInput
        fields={SUGGESTION_DEMO_FIELDS}
        onSubmit={setResult}
        placeholder="Type to see prepend behavior..."
        suggestions={{ custom: customSuggestion }}
      />
      <ResultDisplay result={result} />
      <div className="mt-3 p-3 bg-blue-50 rounded text-xs text-blue-800">
        <strong>Try:</strong> Type "st" - you'll see "Assigned to me" at the top, followed by field
        suggestion "Status".
      </div>
    </div>
  );
};

export const AppendMode: Story = () => {
  const [result, setResult] = useState<QuerySnapshot | null>(null);

  const customSuggestion: CustomSuggestionConfig = {
    displayMode: 'append',
    suggest: () => [
      {
        tokens: [{ key: 'assignee', operator: 'is' as const, value: 'me' }],
        label: 'Assigned to me',
        description: 'Custom suggestion (appended)',
      },
    ],
  };

  return (
    <div className="p-4">
      <h3 className="text-lg font-medium mb-2">Append Mode</h3>
      <p className="text-sm text-gray-600 mb-4">
        Custom suggestions appear <strong>below</strong> field suggestions. The custom suggestion
        "Assigned to me" is always shown at the bottom.
      </p>
      <TokenizedSearchInput
        fields={SUGGESTION_DEMO_FIELDS}
        onSubmit={setResult}
        placeholder="Type to see append behavior..."
        suggestions={{ custom: customSuggestion }}
      />
      <ResultDisplay result={result} />
      <div className="mt-3 p-3 bg-blue-50 rounded text-xs text-blue-800">
        <strong>Try:</strong> Type "st" - you'll see field suggestion "Status" first, followed by
        "Assigned to me" at the bottom.
      </div>
    </div>
  );
};

export const AsyncSuggestions: Story = () => {
  const [result, setResult] = useState<QuerySnapshot | null>(null);
  const inputRef = useRef<TokenizedSearchInputRef>(null);

  const { resolveTokens } = useAsyncTokenResolver({
    inputRef,
    fieldKey: 'country',
    resolve: async (values) => {
      await delay(300);
      return COUNTRIES_MEDIUM.filter((c) => values.includes(c.code));
    },
    getValue: (c: Country) => c.code,
    getDisplayData: (c: Country) => ({
      displayValue: c.name,
      startContent: <span>{c.emoji}</span>,
    }),
    loadingContent: {
      displayValue: 'Loading...',
      startContent: <Loader2 className="w-full h-full animate-spin" />,
    },
  });

  const deserializeText = useCallback(createDeserializeText(COUNTRIES_MEDIUM), []);

  const customSuggestion: CustomSuggestionConfig = {
    displayMode: 'replace',
    debounceMs: 300,
    suggest: async ({ query }) => {
      await new Promise((resolve) => setTimeout(resolve, 200));
      const filtered = filterCountries(COUNTRIES_MEDIUM, query);
      return filtered.slice(0, 5).map(createCountrySuggestion);
    },
  };

  return (
    <div className="p-4">
      <h3 className="text-lg font-medium mb-2">Async Suggestions</h3>
      <p className="text-sm text-gray-600 mb-4">
        Suggestions are loaded asynchronously with 300ms debounce. Type a country name (e.g.,
        "japan") or paste country codes (e.g., "jp us") to see async resolution.
      </p>
      <TokenizedSearchInput
        ref={inputRef}
        fields={[COUNTRY_FIELD]}
        freeTextMode="none"
        onChange={resolveTokens}
        onSubmit={setResult}
        placeholder="Search or paste country codes..."
        suggestions={{ field: { disabled: true }, custom: customSuggestion }}
        serialization={{ deserializeText }}
      />
      <ResultDisplay result={result} />
    </div>
  );
};

const PAGE_SIZE = 5;

export const PaginatedSuggestions: Story = () => {
  const [result, setResult] = useState<QuerySnapshot | null>(null);
  const inputRef = useRef<TokenizedSearchInputRef>(null);

  const { resolveTokens } = useAsyncTokenResolver({
    inputRef,
    fieldKey: 'country',
    resolve: async (values) => {
      await delay(300);
      return COUNTRIES_LARGE.filter((c) => values.includes(c.code));
    },
    getValue: (c: Country) => c.code,
    getDisplayData: (c: Country) => ({
      displayValue: c.name,
      startContent: <span>{c.emoji}</span>,
    }),
    loadingContent: {
      displayValue: 'Loading...',
      startContent: <Loader2 className="w-full h-full animate-spin" />,
    },
  });

  const deserializeText = useCallback(createDeserializeText(COUNTRIES_LARGE), []);

  const customSuggestion: CustomSuggestionConfig = {
    displayMode: 'replace',
    debounceMs: 150,
    maxSuggestions: PAGE_SIZE,

    suggest: async ({ query }) => {
      await new Promise((resolve) => setTimeout(resolve, 100));
      const filtered = filterCountries(COUNTRIES_LARGE, query);
      return {
        suggestions: filtered.slice(0, PAGE_SIZE).map(createCountrySuggestion),
        hasMore: filtered.length > PAGE_SIZE,
      };
    },

    loadMore: async ({ query, offset, limit }) => {
      await new Promise((resolve) => setTimeout(resolve, 100));
      const filtered = filterCountries(COUNTRIES_LARGE, query);
      const page = filtered.slice(offset, offset + limit);
      return {
        suggestions: page.map(createCountrySuggestion),
        hasMore: offset + limit < filtered.length,
      };
    },
  };

  return (
    <div className="p-4">
      <h3 className="text-lg font-medium mb-2">
        Paginated Suggestions with Async Value Resolution
      </h3>
      <p className="text-sm text-gray-600 mb-4">
        Type a country name or scroll to load more (40 countries available). Paste country codes
        (e.g., "jp us fr") to see async value resolution with loading state.
      </p>
      <TokenizedSearchInput
        ref={inputRef}
        fields={[COUNTRY_FIELD]}
        freeTextMode="none"
        onChange={resolveTokens}
        onSubmit={setResult}
        placeholder="Search or paste country codes..."
        suggestions={{ field: { disabled: true }, custom: customSuggestion }}
        serialization={{ deserializeText }}
      />
      <ResultDisplay result={result} />
      <div className="mt-3 p-3 bg-blue-50 rounded text-xs text-blue-800">
        <strong>Try:</strong> Copy "jp us fr" and paste it. The codes will show "Loading..." then
        resolve to country names.
      </div>
    </div>
  );
};

export const PaginatedPrepend: Story = () => {
  const [result, setResult] = useState<QuerySnapshot | null>(null);

  const customSuggestion: CustomSuggestionConfig = {
    displayMode: 'prepend',
    debounceMs: 150,
    maxSuggestions: PAGE_SIZE,

    suggest: async ({ query }) => {
      await new Promise((resolve) => setTimeout(resolve, 100));
      const filtered = filterCountries(COUNTRIES_LARGE, query);
      return {
        suggestions: filtered.slice(0, PAGE_SIZE).map(createCountrySuggestion),
        hasMore: filtered.length > PAGE_SIZE,
      };
    },

    loadMore: async ({ query, offset, limit }) => {
      await new Promise((resolve) => setTimeout(resolve, 100));
      const filtered = filterCountries(COUNTRIES_LARGE, query);
      const page = filtered.slice(offset, offset + limit);
      return {
        suggestions: page.map(createCountrySuggestion),
        hasMore: offset + limit < filtered.length,
      };
    },
  };

  return (
    <div className="p-4">
      <h3 className="text-lg font-medium mb-2">Paginated Prepend Mode</h3>
      <p className="text-sm text-gray-600 mb-4">
        Paginated custom suggestions appear <strong>above</strong> field suggestions. Scroll to load
        more countries.
      </p>
      <TokenizedSearchInput
        fields={PAGINATED_DEMO_FIELDS}
        onSubmit={setResult}
        placeholder="Type to see paginated prepend..."
        suggestions={{ custom: customSuggestion }}
      />
      <ResultDisplay result={result} />
      <div className="mt-3 p-3 bg-blue-50 rounded text-xs text-blue-800">
        <strong>Try:</strong> Type "a" - paginated country suggestions appear at the top, followed
        by field suggestion "Assignee" at the bottom. Scroll to load more countries.
      </div>
    </div>
  );
};

export const PaginatedAppend: Story = () => {
  const [result, setResult] = useState<QuerySnapshot | null>(null);

  const customSuggestion: CustomSuggestionConfig = {
    displayMode: 'append',
    debounceMs: 150,
    maxSuggestions: PAGE_SIZE,

    suggest: async ({ query }) => {
      await new Promise((resolve) => setTimeout(resolve, 100));
      const filtered = filterCountries(COUNTRIES_LARGE, query);
      return {
        suggestions: filtered.slice(0, PAGE_SIZE).map(createCountrySuggestion),
        hasMore: filtered.length > PAGE_SIZE,
      };
    },

    loadMore: async ({ query, offset, limit }) => {
      await new Promise((resolve) => setTimeout(resolve, 100));
      const filtered = filterCountries(COUNTRIES_LARGE, query);
      const page = filtered.slice(offset, offset + limit);
      return {
        suggestions: page.map(createCountrySuggestion),
        hasMore: offset + limit < filtered.length,
      };
    },
  };

  return (
    <div className="p-4">
      <h3 className="text-lg font-medium mb-2">Paginated Append Mode</h3>
      <p className="text-sm text-gray-600 mb-4">
        Field suggestions appear first, followed by paginated custom suggestions. Scroll to load
        more countries.
      </p>
      <TokenizedSearchInput
        fields={PAGINATED_DEMO_FIELDS}
        onSubmit={setResult}
        placeholder="Type to see paginated append..."
        suggestions={{ custom: customSuggestion }}
      />
      <ResultDisplay result={result} />
      <div className="mt-3 p-3 bg-blue-50 rounded text-xs text-blue-800">
        <strong>Try:</strong> Type "a" - field suggestion "Assignee" appears first, then paginated
        country suggestions are appended below. Scroll to load more countries.
      </div>
    </div>
  );
};

export const AppendWithMultipleSuggestions: Story = () => {
  const [result, setResult] = useState<QuerySnapshot | null>(null);

  const customSuggestion: CustomSuggestionConfig = {
    displayMode: 'append',
    suggest: ({ query }) => {
      if (!query.trim()) return [];
      const filtered = filterCountries(COUNTRIES_MEDIUM, query);
      return filtered.slice(0, 3).map((country) => ({
        ...createCountrySuggestion(country),
        description: 'Country suggestion (appended)',
      }));
    },
  };

  return (
    <div className="p-4">
      <h3 className="text-lg font-medium mb-2">Append Mode with Multiple Suggestions</h3>
      <p className="text-sm text-gray-600 mb-4">
        Field suggestions appear first, followed by multiple custom country suggestions. Custom
        suggestions are filtered by query.
      </p>
      <TokenizedSearchInput
        fields={SUGGESTION_DEMO_FIELDS}
        onSubmit={setResult}
        placeholder="Type to search..."
        suggestions={{ custom: customSuggestion }}
      />
      <ResultDisplay result={result} />
      <div className="mt-3 p-3 bg-blue-50 rounded text-xs text-blue-800">
        <strong>Try:</strong> Type "a" - field suggestion "Assignee" appears first, then country
        suggestions (Australia, Argentina, etc.) are appended below.
      </div>
    </div>
  );
};

export const ToggleSelection: Story = () => {
  const [result, setResult] = useState<QuerySnapshot | null>(null);

  const customSuggestion: CustomSuggestionConfig = {
    displayMode: 'replace',
    suggest: ({ query, existingTokens }) => {
      const selectedValues = new Set(existingTokens.map((t) => t.value));

      const filtered = AVAILABLE_TAGS.filter((tag) =>
        tag.label.toLowerCase().includes(query.toLowerCase())
      );

      return filtered.map((tag) => ({
        tokens: [
          { key: 'tag', operator: 'is' as const, value: tag.value, displayValue: tag.label },
        ],
        label: tag.label,
        endContent: selectedValues.has(tag.value) ? (
          <Check className="w-4 h-4 text-blue-500" />
        ) : undefined,
      }));
    },
    onSelect: (suggestion, { existingTokens, deleteToken }) => {
      const token = suggestion.tokens[0];
      if (!token) return false;

      const existing = existingTokens.find((t) => t.key === token.key && t.value === token.value);
      if (existing) {
        deleteToken(existing.id);
        return true;
      }
      return false;
    },
  };

  const filterSegments = result?.segments.filter((t) => t.type === 'filter') ?? [];

  return (
    <div className="p-4">
      <h3 className="text-lg font-medium mb-2">Toggle Selection</h3>
      <p className="text-sm text-gray-600 mb-4">
        Click to select, click again to deselect. Selected items show a checkmark.
      </p>
      <TokenizedSearchInput
        fields={[TAG_FIELD]}
        freeTextMode="none"
        onSubmit={setResult}
        placeholder="Toggle tags..."
        suggestions={{ field: { disabled: true }, custom: customSuggestion }}
        validation={{ rules: [Unique.rule('exact')] }}
      />
      {filterSegments.length > 0 && (
        <div className="mt-4 p-3 bg-blue-50 rounded text-sm">
          <p className="text-blue-800 mb-1">Selected tags:</p>
          <div className="flex flex-wrap gap-1">
            {filterSegments.map((t) => {
              const tag = AVAILABLE_TAGS.find((tag) => tag.value === t.value);
              return (
                <span
                  key={`${t.key}-${t.value}`}
                  className="px-2 py-0.5 bg-blue-100 text-blue-800 rounded text-xs"
                >
                  {tag?.label ?? t.value}
                </span>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};

export default {
  title: 'Features / Suggestions',
};
