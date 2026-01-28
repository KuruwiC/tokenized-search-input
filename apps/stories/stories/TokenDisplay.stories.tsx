import type { TokenizedSearchInputRef } from '@kuruwic/tokenized-search-input';
import { TokenizedSearchInput, useAsyncTokenResolver } from '@kuruwic/tokenized-search-input';
import type { CustomSuggestionConfig, QuerySnapshot } from '@kuruwic/tokenized-search-input/utils';
import type { Story } from '@ladle/react';
import { Loader2 } from 'lucide-react';
import { useCallback, useRef, useState } from 'react';
import {
  COUNTRIES_SMALL,
  COUNTRY_FIELD,
  type Country,
  createCountrySuggestion,
  createDeserializeText,
  delay,
  filterCountries,
  IMMUTABLE_COUNTRY_FIELD,
  ResultDisplay,
  TOKEN_DISPLAY_FIELDS,
} from './_shared';

export const TokenLabelDisplayAuto: Story = () => {
  const [result, setResult] = useState<QuerySnapshot | null>(null);

  return (
    <div className="p-4">
      <h3 className="text-lg font-medium mb-2">Token Label Display: auto (default)</h3>
      <p className="text-sm text-gray-600 mb-4">
        Shows icon + label text. This is the default behavior.
      </p>
      <TokenizedSearchInput
        fields={TOKEN_DISPLAY_FIELDS.auto}
        defaultValue="status:is:active priority:is:high"
        onSubmit={setResult}
        placeholder="Select a field..."
      />
      <ResultDisplay result={result} />
    </div>
  );
};

export const TokenLabelDisplayIconOnly: Story = () => {
  const [result, setResult] = useState<QuerySnapshot | null>(null);

  return (
    <div className="p-4">
      <h3 className="text-lg font-medium mb-2">Token Label Display: icon-only</h3>
      <p className="text-sm text-gray-600 mb-4">
        Shows only the icon without label text. Useful for compact displays.
      </p>
      <TokenizedSearchInput
        fields={TOKEN_DISPLAY_FIELDS.iconOnly}
        defaultValue="status:is:active priority:is:high"
        onSubmit={setResult}
        placeholder="Select a field..."
      />
      <ResultDisplay result={result} />
      <div className="mt-3 p-3 bg-blue-50 rounded text-xs text-blue-800">
        <strong>Note:</strong> If no icon is defined, the label text is shown as fallback.
      </div>
    </div>
  );
};

export const TokenLabelDisplayHidden: Story = () => {
  const [result, setResult] = useState<QuerySnapshot | null>(null);

  return (
    <div className="p-4">
      <h3 className="text-lg font-medium mb-2">Token Label Display: hidden</h3>
      <p className="text-sm text-gray-600 mb-4">
        Hides the field label completely. Shows only the value. Ideal for tag inputs.
      </p>
      <TokenizedSearchInput
        fields={TOKEN_DISPLAY_FIELDS.hidden}
        defaultValue="tag:is:react tag:is:typescript"
        onSubmit={setResult}
        placeholder="Add tags..."
      />
      <ResultDisplay result={result} />
    </div>
  );
};

export const WithStartContent: Story = () => {
  const [result, setResult] = useState<QuerySnapshot | null>(null);
  const inputRef = useRef<TokenizedSearchInputRef>(null);

  const { resolveTokens } = useAsyncTokenResolver({
    inputRef,
    fieldKey: 'country',
    resolve: async (values) => {
      await delay(300);
      return COUNTRIES_SMALL.filter((c) => values.includes(c.code));
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

  const deserializeText = useCallback(createDeserializeText(COUNTRIES_SMALL), []);

  const customSuggestion: CustomSuggestionConfig = {
    displayMode: 'replace',
    suggest: ({ query }) => {
      const filtered = filterCountries(COUNTRIES_SMALL, query);
      return filtered.map(createCountrySuggestion);
    },
  };

  return (
    <div className="p-4">
      <h3 className="text-lg font-medium mb-2">With Start Content</h3>
      <p className="text-sm text-gray-600 mb-4">
        Tokens can display custom content (icons, emojis) before the label using startContent. Paste
        country codes (e.g., "jp us") to see async resolution.
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
      <div className="mt-3 p-3 bg-green-50 rounded text-xs text-green-800">
        <strong>Note:</strong> Each token displays a flag emoji before the country name.
      </div>
    </div>
  );
};

export const ImmutableTokens: Story = () => {
  const [result, setResult] = useState<QuerySnapshot | null>(null);
  const inputRef = useRef<TokenizedSearchInputRef>(null);

  const { resolveTokens } = useAsyncTokenResolver({
    inputRef,
    fieldKey: 'country',
    resolve: async (values) => {
      await delay(300);
      return COUNTRIES_SMALL.filter((c) => values.includes(c.code));
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

  const deserializeText = useCallback(createDeserializeText(COUNTRIES_SMALL), []);

  const customSuggestion: CustomSuggestionConfig = {
    displayMode: 'replace',
    suggest: ({ query }) => {
      const filtered = filterCountries(COUNTRIES_SMALL, query);
      return filtered.map(createCountrySuggestion);
    },
  };

  return (
    <div className="p-4">
      <h3 className="text-lg font-medium mb-2">Immutable Tokens</h3>
      <p className="text-sm text-gray-600 mb-4">
        With immutable: true, tokens cannot be edited inline. They can only be deleted using the X
        button or by pressing Backspace twice. Paste country codes to test.
      </p>
      <TokenizedSearchInput
        ref={inputRef}
        fields={[IMMUTABLE_COUNTRY_FIELD]}
        freeTextMode="none"
        onChange={resolveTokens}
        onSubmit={setResult}
        placeholder="Select or paste country codes..."
        suggestions={{ field: { disabled: true }, custom: customSuggestion }}
        serialization={{ deserializeText }}
      />
      <ResultDisplay result={result} />
      <div className="mt-3 p-3 bg-orange-50 rounded text-xs text-orange-800">
        <strong>Try:</strong> Click on a token's value - it won't become editable. Use the X button
        or Backspace to delete.
      </div>
    </div>
  );
};

export default {
  title: 'Customization / Display Options',
};
