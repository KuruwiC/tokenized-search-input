import type { TokenizedSearchInputRef } from '@kuruwic/tokenized-search-input';
import { TokenizedSearchInput } from '@kuruwic/tokenized-search-input';
import type { FreeTextMode, QuerySnapshot } from '@kuruwic/tokenized-search-input/utils';
import { MaxCount, Unique } from '@kuruwic/tokenized-search-input/utils';
import type { Story, StoryDefault } from '@ladle/react';
import { useRef, useState } from 'react';
import { ALL_FIELDS, RefMethodsPanel, SnapshotViewer } from './_shared';

interface PlaygroundProps {
  disabled: boolean;
  clearable: boolean;
  singleLine: boolean;
  expandOnFocus: boolean;
  freeTextMode: FreeTextMode;
  allowUnknownFields: boolean;
  fieldSuggestionsDisabled: boolean;
  valueSuggestionsDisabled: boolean;
  enableValidation: boolean;
  placeholder: string;
  defaultValue: string;
}

export const Playground: Story<PlaygroundProps> = ({
  disabled,
  clearable,
  singleLine,
  expandOnFocus,
  freeTextMode,
  allowUnknownFields,
  fieldSuggestionsDisabled,
  valueSuggestionsDisabled,
  enableValidation,
  placeholder,
  defaultValue,
}) => {
  const inputRef = useRef<TokenizedSearchInputRef>(null);
  const [snapshot, setSnapshot] = useState<QuerySnapshot | null>(null);
  const [showRefMethods, setShowRefMethods] = useState(true);
  const [showSnapshot, setShowSnapshot] = useState(true);

  const handleChange = (s: QuerySnapshot) => {
    setSnapshot(s);
  };

  const handleSubmit = (s: QuerySnapshot) => {
    setSnapshot(s);
  };

  return (
    <div className="p-4 space-y-6">
      <div>
        <h3 className="text-lg font-medium mb-2">Playground</h3>
        <p className="text-sm text-gray-600 mb-4">
          Use the controls panel to adjust props and test the component interactively.
        </p>
      </div>

      <div
        className="relative"
        style={expandOnFocus ? { minHeight: 'calc(1.375rem + 0.5rem * 2 + 2px)' } : undefined}
      >
        <TokenizedSearchInput
          ref={inputRef}
          key={`${disabled}-${singleLine}-${expandOnFocus}-${freeTextMode}-${allowUnknownFields}`}
          fields={ALL_FIELDS}
          disabled={disabled}
          clearable={clearable}
          singleLine={singleLine}
          expandOnFocus={expandOnFocus}
          freeTextMode={freeTextMode}
          placeholder={placeholder}
          defaultValue={defaultValue}
          onChange={handleChange}
          onSubmit={handleSubmit}
          unknownFields={{ allow: allowUnknownFields }}
          suggestions={{
            field: { disabled: fieldSuggestionsDisabled },
            value: { disabled: valueSuggestionsDisabled },
          }}
          validation={
            enableValidation ? { rules: [Unique.rule('exact'), MaxCount.rule('*', 10)] } : undefined
          }
        />
      </div>

      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => setShowRefMethods(!showRefMethods)}
          className={`px-3 py-1.5 text-sm rounded ${
            showRefMethods ? 'bg-blue-500 text-white' : 'bg-gray-200'
          }`}
        >
          Ref Methods Panel
        </button>
        <button
          type="button"
          onClick={() => setShowSnapshot(!showSnapshot)}
          className={`px-3 py-1.5 text-sm rounded ${
            showSnapshot ? 'bg-blue-500 text-white' : 'bg-gray-200'
          }`}
        >
          Snapshot Viewer
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {showRefMethods && (
          <div>
            <h4 className="text-sm font-medium text-gray-600 mb-2">Ref Methods</h4>
            <RefMethodsPanel inputRef={inputRef} />
          </div>
        )}

        {showSnapshot && (
          <div>
            <h4 className="text-sm font-medium text-gray-600 mb-2">QuerySnapshot (Real-time)</h4>
            <SnapshotViewer snapshot={snapshot} />
          </div>
        )}
      </div>

      <div className="p-4 bg-gray-50 rounded-lg text-sm">
        <h4 className="font-medium text-gray-700 mb-2">Available Fields</h4>
        <ul className="grid grid-cols-2 md:grid-cols-3 gap-2 text-xs">
          {ALL_FIELDS.map((field) => (
            <li key={field.key} className="flex items-center gap-2">
              <span className="w-4 h-4 flex items-center justify-center text-gray-500">
                {field.icon}
              </span>
              <span className="font-medium">{field.label}</span>
              <span className="text-gray-400">({field.type})</span>
            </li>
          ))}
        </ul>
      </div>

      <div className="p-4 bg-yellow-50 rounded-lg text-sm text-yellow-800">
        <strong>Tips:</strong>
        <ul className="list-disc list-inside mt-1 space-y-1">
          <li>Type a field name (e.g., "status") to see field suggestions</li>
          <li>
            Use <code>field:operator:value</code> format (e.g., "status:is:active")
          </li>
          <li>Enable "allowUnknownFields" to accept any field name</li>
          <li>Enable "enableValidation" to prevent duplicates and limit to 10 tokens</li>
        </ul>
      </div>
    </div>
  );
};

Playground.args = {
  disabled: false,
  clearable: true,
  singleLine: false,
  expandOnFocus: false,
  freeTextMode: 'plain',
  allowUnknownFields: false,
  fieldSuggestionsDisabled: false,
  valueSuggestionsDisabled: false,
  enableValidation: false,
  placeholder: 'Search...',
  defaultValue: '',
};

Playground.argTypes = {
  disabled: {
    control: { type: 'boolean' },
    description: 'Disable the input',
  },
  clearable: {
    control: { type: 'boolean' },
    description: 'Show clear button when there is content',
  },
  singleLine: {
    control: { type: 'boolean' },
    description: 'Single line mode with horizontal scrolling',
  },
  expandOnFocus: {
    control: { type: 'boolean' },
    description: 'Expand as overlay when focused (single line when blurred)',
  },
  freeTextMode: {
    control: { type: 'select' },
    options: ['none', 'plain', 'tokenize'],
    description:
      'How to handle free text: none (discard), plain (keep), tokenize (convert to tags)',
  },
  allowUnknownFields: {
    control: { type: 'boolean' },
    description: 'Allow fields not defined in the fields array',
  },
  fieldSuggestionsDisabled: {
    control: { type: 'boolean' },
    description: 'Disable field name suggestions',
  },
  valueSuggestionsDisabled: {
    control: { type: 'boolean' },
    description: 'Disable value suggestions for enum fields',
  },
  enableValidation: {
    control: { type: 'boolean' },
    description: 'Enable validation (unique + max 10 tokens)',
  },
  placeholder: {
    control: { type: 'text' },
    description: 'Placeholder text',
  },
  defaultValue: {
    control: { type: 'text' },
    description: 'Initial value (e.g., "status:is:active priority:is:high")',
  },
};

export default {
  title: 'Playground',
} satisfies StoryDefault;
