import type { TokenizedSearchInputRef } from '@kuruwic/tokenized-search-input';
import { TokenizedSearchInput, useAsyncTokenResolver } from '@kuruwic/tokenized-search-input';
import type {
  CustomSuggestionConfig,
  FieldDefinition,
  ParsedToken,
  QuerySnapshot,
} from '@kuruwic/tokenized-search-input/utils';
import type { Story } from '@ladle/react';
import { Globe, Loader2 } from 'lucide-react';
import { useCallback, useRef, useState } from 'react';
import { COUNTRIES_MEDIUM, type Country, delay } from './_shared';

const countryFields: FieldDefinition[] = [
  {
    key: 'country',
    label: 'Country',
    type: 'string',
    operators: ['is'],
    icon: <Globe className="w-full h-full" />,
    tokenLabelDisplay: 'hidden',
    hideSingleOperator: true,
  },
];

export const SerializeToken: Story = () => {
  const [result, setResult] = useState<QuerySnapshot | null>(null);
  const [copiedText, setCopiedText] = useState<string>('');
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

  const customSuggestion: CustomSuggestionConfig = {
    displayMode: 'replace',
    suggest: ({ query }) => {
      const filtered = COUNTRIES_MEDIUM.filter(
        (c) =>
          c.name.toLowerCase().includes(query.toLowerCase()) ||
          c.code.toLowerCase().includes(query.toLowerCase())
      );
      return filtered.map((country) => ({
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
      }));
    },
  };

  const serializeToken = useCallback((token: { key: string; value: string }) => {
    if (token.key === 'country') {
      const country = COUNTRIES_MEDIUM.find((c) => c.code === token.value);
      return country?.name ?? null;
    }
    return null;
  }, []);

  const handleCopy = async () => {
    const text = await navigator.clipboard.readText();
    setCopiedText(text);
  };

  const filterSegments = result?.segments.filter((t) => t.type === 'filter') ?? [];

  return (
    <div className="p-4">
      <h3 className="text-lg font-medium mb-2">Serialize Token (Copy)</h3>
      <p className="text-sm text-gray-600 mb-4">
        Custom copy format: copies "Japan" instead of "country:is:jp". Select tokens and press
        Cmd/Ctrl+C.
      </p>
      <TokenizedSearchInput
        ref={inputRef}
        fields={countryFields}
        freeTextMode="none"
        onChange={resolveTokens}
        onSubmit={setResult}
        placeholder="Select countries, then copy..."
        suggestions={{ field: { disabled: true }, custom: customSuggestion }}
        serialization={{ serializeToken }}
      />
      <div className="mt-4 flex gap-2">
        <button
          type="button"
          onClick={handleCopy}
          className="px-3 py-1.5 text-sm bg-blue-100 hover:bg-blue-200 text-blue-800 rounded"
        >
          Read Clipboard
        </button>
      </div>
      {copiedText && (
        <div className="mt-3 p-3 bg-green-50 rounded text-sm">
          <p className="text-green-800 mb-1">
            <strong>Clipboard content:</strong>
          </p>
          <code className="text-xs bg-white px-2 py-1 rounded block">{copiedText}</code>
        </div>
      )}
      {filterSegments.length > 0 && (
        <div className="mt-3 p-3 bg-blue-50 rounded text-xs text-blue-800">
          <strong>Tip:</strong> Select a token with the cursor, then press Cmd/Ctrl+C. The copied
          text will be the country name, not the internal format.
        </div>
      )}
    </div>
  );
};

export const DeserializeText: Story = () => {
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

  const customSuggestion: CustomSuggestionConfig = {
    displayMode: 'replace',
    suggest: ({ query }) => {
      const filtered = COUNTRIES_MEDIUM.filter(
        (c) =>
          c.name.toLowerCase().includes(query.toLowerCase()) ||
          c.code.toLowerCase().includes(query.toLowerCase())
      );
      return filtered.map((country) => ({
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
      }));
    },
  };

  const deserializeText = useCallback((text: string): ParsedToken[] | null => {
    const tokens: Array<{ type: 'filter'; key: string; operator: 'is'; value: string }> = [];
    let remaining = text.trim();

    const sortedCountries = [...COUNTRIES_MEDIUM].sort((a, b) => b.name.length - a.name.length);

    while (remaining.length > 0) {
      let matched = false;

      for (const country of sortedCountries) {
        const nameLower = country.name.toLowerCase();
        const remainingLower = remaining.toLowerCase();

        if (remainingLower.startsWith(nameLower)) {
          const nextChar = remaining[country.name.length];
          if (!nextChar || /[\s,;]/.test(nextChar)) {
            tokens.push({ type: 'filter', key: 'country', operator: 'is', value: country.code });
            remaining = remaining.slice(country.name.length).replace(/^[\s,;]+/, '');
            matched = true;
            break;
          }
        }
      }

      if (!matched) {
        const spaceIndex = remaining.search(/[\s,;]/);
        if (spaceIndex === -1) break;
        remaining = remaining.slice(spaceIndex).replace(/^[\s,;]+/, '');
      }
    }

    return tokens.length > 0 ? tokens : null;
  }, []);

  const handlePasteExample = () => {
    navigator.clipboard.writeText('Japan, France, Germany');
    inputRef.current?.focus();
  };

  const filterSegments = result?.segments.filter((t) => t.type === 'filter') ?? [];

  return (
    <div className="p-4">
      <h3 className="text-lg font-medium mb-2">Deserialize Text (Paste)</h3>
      <p className="text-sm text-gray-600 mb-4">
        Custom paste parser: recognizes country names and converts them to tokens. Paste "Japan,
        France, Germany" to see it work.
      </p>
      <TokenizedSearchInput
        ref={inputRef}
        fields={countryFields}
        freeTextMode="none"
        onChange={resolveTokens}
        onSubmit={setResult}
        placeholder="Paste country names..."
        suggestions={{ field: { disabled: true }, custom: customSuggestion }}
        serialization={{ deserializeText }}
      />
      <div className="mt-4 flex gap-2">
        <button
          type="button"
          onClick={handlePasteExample}
          className="px-3 py-1.5 text-sm bg-purple-100 hover:bg-purple-200 text-purple-800 rounded"
        >
          Copy "Japan, France, Germany" to clipboard
        </button>
      </div>
      <div className="mt-3 p-3 bg-purple-50 rounded text-xs text-purple-800">
        <strong>Try:</strong> Click the button above, then paste (Cmd/Ctrl+V) into the input. The
        country names will be converted to filter tokens.
      </div>
      {filterSegments.length > 0 && (
        <div className="mt-3 p-3 bg-gray-100 rounded text-sm">
          <p className="text-gray-600 mb-1">Parsed tokens:</p>
          <div className="flex flex-wrap gap-1">
            {filterSegments.map((t) => {
              const country = COUNTRIES_MEDIUM.find((c) => c.code === t.value);
              return (
                <span
                  key={`${t.key}-${t.value}`}
                  className="px-2 py-0.5 bg-green-100 text-green-800 rounded text-xs"
                >
                  {country ? `${country.emoji} ${country.name}` : t.value}
                </span>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};

export const BothCustomized: Story = () => {
  const [result, setResult] = useState<QuerySnapshot | null>(null);
  const inputRef = useRef<TokenizedSearchInputRef>(null);
  const [copiedText, setCopiedText] = useState<string>('');

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

  const customSuggestion: CustomSuggestionConfig = {
    displayMode: 'replace',
    suggest: ({ query }) => {
      const filtered = COUNTRIES_MEDIUM.filter(
        (c) =>
          c.name.toLowerCase().includes(query.toLowerCase()) ||
          c.code.toLowerCase().includes(query.toLowerCase())
      );
      return filtered.map((country) => ({
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
      }));
    },
  };

  const serializeToken = useCallback((token: { key: string; value: string }) => {
    if (token.key === 'country') {
      const country = COUNTRIES_MEDIUM.find((c) => c.code === token.value);
      return country?.name ?? null;
    }
    return null;
  }, []);

  const deserializeText = useCallback((text: string): ParsedToken[] | null => {
    const tokens: Array<{ type: 'filter'; key: string; operator: 'is'; value: string }> = [];
    let remaining = text.trim();

    const sortedCountries = [...COUNTRIES_MEDIUM].sort((a, b) => b.name.length - a.name.length);

    while (remaining.length > 0) {
      let matched = false;

      for (const country of sortedCountries) {
        const nameLower = country.name.toLowerCase();
        const remainingLower = remaining.toLowerCase();

        if (remainingLower.startsWith(nameLower)) {
          const nextChar = remaining[country.name.length];
          if (!nextChar || /[\s,;]/.test(nextChar)) {
            tokens.push({ type: 'filter', key: 'country', operator: 'is', value: country.code });
            remaining = remaining.slice(country.name.length).replace(/^[\s,;]+/, '');
            matched = true;
            break;
          }
        }
      }

      if (!matched) {
        const spaceIndex = remaining.search(/[\s,;]/);
        if (spaceIndex === -1) break;
        remaining = remaining.slice(spaceIndex).replace(/^[\s,;]+/, '');
      }
    }

    return tokens.length > 0 ? tokens : null;
  }, []);

  const handleCopy = async () => {
    const text = await navigator.clipboard.readText();
    setCopiedText(text);
  };

  const handlePasteExample = () => {
    navigator.clipboard.writeText('Japan, France');
    inputRef.current?.focus();
  };

  const filterSegments = result?.segments.filter((t) => t.type === 'filter') ?? [];

  return (
    <div className="p-4">
      <h3 className="text-lg font-medium mb-2">Both Customized (Round-trip)</h3>
      <p className="text-sm text-gray-600 mb-4">
        Full clipboard customization: copy exports country names, paste imports country names. This
        enables round-trip copy/paste between instances or external applications.
      </p>
      <TokenizedSearchInput
        ref={inputRef}
        fields={countryFields}
        freeTextMode="none"
        onChange={resolveTokens}
        onSubmit={setResult}
        placeholder="Select countries, copy, paste..."
        suggestions={{ field: { disabled: true }, custom: customSuggestion }}
        serialization={{ serializeToken, deserializeText }}
      />
      <div className="mt-4 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={handlePasteExample}
          className="px-3 py-1.5 text-sm bg-purple-100 hover:bg-purple-200 text-purple-800 rounded"
        >
          Copy "Japan, France" to clipboard
        </button>
        <button
          type="button"
          onClick={handleCopy}
          className="px-3 py-1.5 text-sm bg-blue-100 hover:bg-blue-200 text-blue-800 rounded"
        >
          Read Clipboard
        </button>
      </div>
      {copiedText && (
        <div className="mt-3 p-3 bg-green-50 rounded text-sm">
          <p className="text-green-800 mb-1">
            <strong>Clipboard content:</strong>
          </p>
          <code className="text-xs bg-white px-2 py-1 rounded block">{copiedText}</code>
        </div>
      )}
      {filterSegments.length > 0 && (
        <div className="mt-3 p-3 bg-gray-100 rounded text-sm">
          <p className="text-gray-600 mb-1">Selected countries:</p>
          <div className="flex flex-wrap gap-1">
            {filterSegments.map((t) => {
              const country = COUNTRIES_MEDIUM.find((c) => c.code === t.value);
              return (
                <span
                  key={`${t.key}-${t.value}`}
                  className="px-2 py-0.5 bg-green-100 text-green-800 rounded text-xs"
                >
                  {country ? `${country.emoji} ${country.name}` : t.value}
                </span>
              );
            })}
          </div>
        </div>
      )}
      <div className="mt-3 p-3 bg-orange-50 rounded text-xs text-orange-800">
        <strong>Round-trip test:</strong>
        <ol className="list-decimal list-inside mt-1 space-y-0.5">
          <li>Select some countries from the dropdown</li>
          <li>Select a token and press Cmd/Ctrl+C</li>
          <li>Click "Read Clipboard" - you'll see country names</li>
          <li>Clear the input and paste - tokens reappear</li>
        </ol>
      </div>
    </div>
  );
};

export default {
  title: 'Features / Clipboard',
};
