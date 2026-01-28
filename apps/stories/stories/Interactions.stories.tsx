import type { TokenizedSearchInputRef } from '@kuruwic/tokenized-search-input';
import { TokenizedSearchInput } from '@kuruwic/tokenized-search-input';
import type {
  CustomSuggestionConfig,
  QuerySnapshot,
  QuerySnapshotFilterToken,
  QuerySnapshotFreeTextToken,
} from '@kuruwic/tokenized-search-input/utils';
import type { Story } from '@ladle/react';
import { useCallback, useMemo, useRef, useState } from 'react';
import {
  AVAILABLE_TAGS,
  DATE_FIELDS,
  ResultDisplay,
  TAG_FIELD,
  TOKEN_DISPLAY_FIELDS,
} from './_shared';

const basicFields = TOKEN_DISPLAY_FIELDS.auto;

export const OnChangeCallback: Story = () => {
  const [result, setResult] = useState<QuerySnapshot | null>(null);
  const [serialized, setSerialized] = useState<string>('');
  const [changeCount, setChangeCount] = useState(0);

  const handleChange = useCallback((snapshot: QuerySnapshot) => {
    setSerialized(snapshot.text);
    setChangeCount((c) => c + 1);
  }, []);

  return (
    <div className="p-4">
      <h3 className="text-lg font-medium mb-2">onChange Callback</h3>
      <p className="text-sm text-gray-600 mb-4">
        The onChange callback fires on every change, providing a QuerySnapshot with tokens and
        serialized text.
      </p>
      <TokenizedSearchInput
        fields={basicFields}
        onChange={handleChange}
        onSubmit={setResult}
        placeholder="Type to see onChange..."
      />
      <div className="mt-4 space-y-2">
        <div className="p-3 bg-blue-50 rounded text-sm">
          <p className="text-blue-800 mb-1">
            <strong>Change count:</strong> {changeCount}
          </p>
          <p className="text-blue-800 mb-1">
            <strong>Serialized value:</strong>
          </p>
          <code className="text-xs bg-white px-2 py-1 rounded block overflow-auto">
            {serialized || '(empty)'}
          </code>
        </div>
      </div>
      <ResultDisplay result={result} />
    </div>
  );
};

export const RefMethods: Story = () => {
  const inputRef = useRef<TokenizedSearchInputRef>(null);
  const [value, setValue] = useState<string>('');
  const [searchQuery, setQuerySnapshot] = useState<QuerySnapshot | null>(null);

  const handleGetValue = () => {
    const v = inputRef.current?.getValue() ?? '';
    setValue(v);
  };

  const handleGetSnapshot = () => {
    const q = inputRef.current?.getSnapshot() ?? null;
    setQuerySnapshot(q);
  };

  const handleSetValue = () => {
    inputRef.current?.setValue('status:is:active priority:is:high');
  };

  const handleFocus = () => {
    inputRef.current?.focus();
  };

  const handleClear = () => {
    inputRef.current?.clear();
  };

  const handleSubmit = () => {
    inputRef.current?.submit();
  };

  return (
    <div className="p-4">
      <h3 className="text-lg font-medium mb-2">Ref Methods</h3>
      <p className="text-sm text-gray-600 mb-4">
        Use ref methods to programmatically control the input.
      </p>
      <TokenizedSearchInput
        ref={inputRef}
        fields={basicFields}
        onSubmit={setQuerySnapshot}
        placeholder="Use buttons below to control..."
      />
      <div className="mt-4 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={handleGetValue}
          className="px-3 py-1.5 text-sm bg-gray-100 hover:bg-gray-200 rounded"
        >
          getValue()
        </button>
        <button
          type="button"
          onClick={handleGetSnapshot}
          className="px-3 py-1.5 text-sm bg-gray-100 hover:bg-gray-200 rounded"
        >
          getSnapshot()
        </button>
        <button
          type="button"
          onClick={handleSetValue}
          className="px-3 py-1.5 text-sm bg-blue-100 hover:bg-blue-200 text-blue-800 rounded"
        >
          setValue(...)
        </button>
        <button
          type="button"
          onClick={handleFocus}
          className="px-3 py-1.5 text-sm bg-green-100 hover:bg-green-200 text-green-800 rounded"
        >
          focus()
        </button>
        <button
          type="button"
          onClick={handleClear}
          className="px-3 py-1.5 text-sm bg-yellow-100 hover:bg-yellow-200 text-yellow-800 rounded"
        >
          clear()
        </button>
        <button
          type="button"
          onClick={handleSubmit}
          className="px-3 py-1.5 text-sm bg-purple-100 hover:bg-purple-200 text-purple-800 rounded"
        >
          submit()
        </button>
      </div>
      {value && (
        <div className="mt-4 p-3 bg-gray-100 rounded text-sm">
          <p className="text-gray-600 mb-1">getValue() result:</p>
          <code className="text-xs">{value}</code>
        </div>
      )}
      {searchQuery && (
        <div className="mt-4 p-3 bg-gray-100 rounded text-sm">
          <p className="text-gray-600 mb-1">getSnapshot() result:</p>
          <pre className="text-xs overflow-auto">{JSON.stringify(searchQuery, null, 2)}</pre>
        </div>
      )}
    </div>
  );
};

export const ClearButton: Story = () => {
  const [result, setResult] = useState<QuerySnapshot | null>(null);
  const [clearable, setClearable] = useState(true);

  return (
    <div className="p-4">
      <h3 className="text-lg font-medium mb-2">Clear Button</h3>
      <p className="text-sm text-gray-600 mb-4">
        Toggle the clear button visibility with the clearable prop.
      </p>
      <div className="mb-4">
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={clearable}
            onChange={(e) => setClearable(e.target.checked)}
            className="rounded"
          />
          clearable
        </label>
      </div>
      <TokenizedSearchInput
        fields={basicFields}
        clearable={clearable}
        defaultValue="status:is:active"
        onSubmit={setResult}
        placeholder="Add content and see clear button..."
      />
      <ResultDisplay result={result} />
      <div className="mt-3 p-3 bg-gray-50 rounded text-xs text-gray-600">
        <strong>Note:</strong> The clear button appears when there is content and clearable=true.
        You can also customize its appearance with clearButtonClassName.
      </div>
    </div>
  );
};

export const SuggestionsControl: Story = () => {
  const [result, setResult] = useState<QuerySnapshot | null>(null);
  const [fieldDisabled, setFieldDisabled] = useState(false);
  const [valueDisabled, setValueDisabled] = useState(false);

  return (
    <div className="p-4">
      <h3 className="text-lg font-medium mb-2">Suggestions Control</h3>
      <p className="text-sm text-gray-600 mb-4">
        Control field and value suggestions independently.
      </p>
      <div className="mb-4 flex gap-4">
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={fieldDisabled}
            onChange={(e) => setFieldDisabled(e.target.checked)}
            className="rounded"
          />
          suggestions.field.disabled
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={valueDisabled}
            onChange={(e) => setValueDisabled(e.target.checked)}
            className="rounded"
          />
          suggestions.value.disabled
        </label>
      </div>
      <TokenizedSearchInput
        key={`${fieldDisabled}-${valueDisabled}`}
        fields={basicFields}
        onSubmit={setResult}
        placeholder="Toggle suggestions above..."
        suggestions={{ field: { disabled: fieldDisabled }, value: { disabled: valueDisabled } }}
      />
      <ResultDisplay result={result} />
      <div className="mt-3 p-3 bg-blue-50 rounded text-xs text-blue-800 space-y-1">
        <p>
          <strong>suggestions.field.disabled:</strong> Hides field name autocomplete when typing
        </p>
        <p>
          <strong>suggestions.value.disabled:</strong> Hides value autocomplete for enum fields
        </p>
      </div>
    </div>
  );
};

export const FocusCallbacks: Story = () => {
  const [focusCount, setFocusCount] = useState(0);
  const [blurCount, setBlurCount] = useState(0);
  const [lastBlurSnapshot, setLastBlurSnapshot] = useState<QuerySnapshot | null>(null);

  return (
    <div className="p-4">
      <h3 className="text-lg font-medium mb-2">onFocus / onBlur Callbacks</h3>
      <p className="text-sm text-gray-600 mb-4">
        Track focus and blur events with QuerySnapshot. Useful for triggering search on blur.
      </p>
      <TokenizedSearchInput
        fields={basicFields}
        defaultValue="status:is:active"
        onFocus={() => setFocusCount((c) => c + 1)}
        onBlur={(snapshot) => {
          setBlurCount((c) => c + 1);
          setLastBlurSnapshot(snapshot);
        }}
        placeholder="Click in and out to see events..."
      />
      <div className="mt-4 p-3 bg-blue-50 rounded text-sm space-y-1">
        <p className="text-blue-800">
          <strong>Focus count:</strong> {focusCount}
        </p>
        <p className="text-blue-800">
          <strong>Blur count:</strong> {blurCount}
        </p>
        {lastBlurSnapshot && (
          <p className="text-blue-800">
            <strong>Last blur value:</strong> {lastBlurSnapshot.text || '(empty)'}
          </p>
        )}
      </div>
      <div className="mt-3 p-3 bg-gray-50 rounded text-xs text-gray-600">
        <strong>Use case:</strong> Execute search when focus leaves the input (common UX pattern).
      </div>
    </div>
  );
};

export const OnClearCallback: Story = () => {
  const [clearCount, setClearCount] = useState(0);

  return (
    <div className="p-4">
      <h3 className="text-lg font-medium mb-2">onClear Callback</h3>
      <p className="text-sm text-gray-600 mb-4">
        Detect when the clear button is clicked. Useful for syncing external state.
      </p>
      <TokenizedSearchInput
        fields={basicFields}
        defaultValue="status:is:active priority:is:high"
        clearable
        onClear={() => setClearCount((c) => c + 1)}
        placeholder="Add content then clear..."
      />
      <div className="mt-4 p-3 bg-yellow-50 rounded text-sm">
        <p className="text-yellow-800">
          <strong>Clear button clicked:</strong> {clearCount} times
        </p>
      </div>
      <div className="mt-3 p-3 bg-gray-50 rounded text-xs text-gray-600">
        <strong>Use case:</strong> Reset URL parameters or external state when filters are cleared.
      </div>
    </div>
  );
};

type ComparableToken = QuerySnapshotFilterToken | QuerySnapshotFreeTextToken;

interface TokenChangeEvent {
  timestamp: Date;
  tokens: ComparableToken[];
}

export const OnTokensChange: Story = () => {
  const [events, setEvents] = useState<TokenChangeEvent[]>([]);
  const [changeCount, setChangeCount] = useState(0);

  const handleTokensChange = useCallback((snapshot: QuerySnapshot) => {
    const tokens = snapshot.segments.filter(
      (seg): seg is ComparableToken => seg.type === 'filter' || seg.type === 'freeText'
    );
    setEvents((prev) => [{ timestamp: new Date(), tokens }, ...prev.slice(0, 9)]);
    setChangeCount((c) => c + 1);
  }, []);

  // Custom suggestions prepended to field suggestions
  const customSuggestion: CustomSuggestionConfig = useMemo(
    () => ({
      displayMode: 'prepend',
      suggest: ({ query }) => {
        const filtered = AVAILABLE_TAGS.filter((tag) =>
          tag.label.toLowerCase().includes(query.toLowerCase())
        );
        return filtered.slice(0, 3).map((tag) => ({
          tokens: [
            { key: 'tag', operator: 'is' as const, value: tag.value, displayValue: tag.label },
          ],
          label: `Tag: ${tag.label}`,
          description: 'Custom suggestion',
        }));
      },
    }),
    []
  );

  return (
    <div className="p-4">
      <h3 className="text-lg font-medium mb-2">onTokensChange Callback</h3>
      <p className="text-sm text-gray-600 mb-4">
        Fires when non-focused tokens change. While editing a token, changes to that token don't
        trigger this callback until you click away or move to another token.
      </p>
      <TokenizedSearchInput
        fields={[...basicFields, TAG_FIELD, ...DATE_FIELDS]}
        onTokensChange={handleTokensChange}
        placeholder="Type to see field + custom suggestions..."
        suggestions={{ custom: customSuggestion }}
      />
      <div className="mt-4 p-3 bg-green-50 rounded text-sm">
        <p className="text-green-800 mb-2">
          <strong>Change count:</strong> {changeCount}
        </p>
        <div className="text-green-800 text-xs">
          <strong>Recent events:</strong>
          {events.length === 0 ? (
            <p className="mt-1 text-gray-500 italic">No events yet</p>
          ) : (
            <ul className="mt-1 space-y-1 max-h-40 overflow-y-auto">
              {events.map((event) => (
                <li key={event.timestamp.getTime()} className="p-1 bg-white rounded">
                  <span className="text-gray-400">{event.timestamp.toLocaleTimeString()}</span>{' '}
                  <span className="font-mono">
                    {event.tokens.length === 0
                      ? '(empty)'
                      : event.tokens
                          .map((t) =>
                            t.type === 'filter'
                              ? `${t.key}:${t.operator}:${t.value}`
                              : `"${t.value}"`
                          )
                          .join(', ')}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
      <div className="mt-3 p-3 bg-blue-50 rounded text-xs text-blue-800 space-y-1">
        <p>
          <strong>Try this:</strong>
        </p>
        <ol className="list-decimal list-inside space-y-0.5">
          <li>
            <strong>Field suggestion:</strong> Type "status" → select field → select value → click
            away → fires
          </li>
          <li>
            <strong>Custom suggestion:</strong> Type to see "Tag: ..." suggestions at top → click →
            fires immediately
          </li>
          <li>
            <strong>Date picker:</strong> Type "created" → select field → pick a date → click
            checkmark → fires
          </li>
          <li>
            <strong>DateTime picker:</strong> Type "updated" → select field → pick date/time → click
            checkmark → fires
          </li>
          <li>Click into a token value and edit → No event fires</li>
          <li>Click away → onTokensChange fires with the updated value</li>
          <li>Delete the token → onTokensChange fires</li>
        </ol>
      </div>
    </div>
  );
};

export default {
  title: 'API / Ref Methods',
};
