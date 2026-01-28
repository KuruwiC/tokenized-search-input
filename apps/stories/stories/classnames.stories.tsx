import { TokenizedSearchInput } from '@kuruwic/tokenized-search-input';
import type { CustomSuggestionConfig, QuerySnapshot } from '@kuruwic/tokenized-search-input/utils';
import type { Story } from '@ladle/react';
import { useState } from 'react';
import { AVAILABLE_TAGS, BASIC_FIELDS, CATEGORIZED_FIELDS, TAG_FIELD } from './_shared';
import { InfoBox, ResultDisplay } from './_shared/components';

// =============================================================================
// Class Names - Slot-based styling with Tailwind classes
// =============================================================================

export const Overview: Story = () => {
  const [result, setResult] = useState<QuerySnapshot | null>(null);

  return (
    <div className="p-4 space-y-6">
      <div>
        <h3 className="text-lg font-medium mb-2">Class Names Overview</h3>
        <p className="text-sm text-gray-600 mb-4">
          The <code>classNames</code> prop allows you to apply custom CSS classes to specific parts
          (slots) of the component. This works well with Tailwind CSS utility classes.
        </p>
      </div>

      <div className="space-y-4">
        <h4 className="font-medium">Default (No Custom Classes)</h4>
        <TokenizedSearchInput
          fields={BASIC_FIELDS}
          defaultValue="status:is:active"
          onSubmit={setResult}
          placeholder="Default styling..."
        />
      </div>

      <ResultDisplay result={result} />

      <InfoBox variant="info">
        <strong>Available Slots:</strong>
        <pre className="mt-2 text-xs overflow-x-auto">
          {`classNames={{
  // Root & Input
  root: "...",             // Main container
  input: "...",            // Text input

  // Token parts
  token: "...",            // Token wrapper
  tokenLabel: "...",       // Label (field name)
  tokenOperator: "...",    // Operator button (is, contains, etc.)
  tokenValue: "...",       // Value input container
  tokenDeleteButton: "...",// Delete (X) button

  // Dropdowns
  dropdown: "...",             // Value/Field suggestion dropdown
  operatorDropdown: "...",     // Operator selection dropdown
  operatorDropdownItem: "...", // Each operator option
  suggestionItem: "...",       // Each suggestion item
  suggestionItemHint: "...",   // Hint/key text in suggestion
  fieldCategory: "...",        // Field category header
}}`}
        </pre>
      </InfoBox>
    </div>
  );
};

export const TokenSlots: Story = () => {
  const [result, setResult] = useState<QuerySnapshot | null>(null);

  return (
    <div className="p-4 space-y-6">
      <div>
        <h3 className="text-lg font-medium mb-2">Token Slot Styling</h3>
        <p className="text-sm text-gray-600 mb-4">
          Apply custom classes to individual token parts.
        </p>
      </div>

      <div className="space-y-4">
        <h4 className="font-medium">Custom Token Label</h4>
        <TokenizedSearchInput
          fields={BASIC_FIELDS}
          defaultValue="status:is:active"
          onSubmit={setResult}
          classNames={{
            tokenLabel: 'font-bold text-purple-700',
          }}
          placeholder="Bold purple label..."
        />
      </div>

      <div className="space-y-4">
        <h4 className="font-medium">Custom Token Value</h4>
        <TokenizedSearchInput
          fields={BASIC_FIELDS}
          defaultValue="status:is:active"
          onSubmit={setResult}
          classNames={{
            tokenValue: 'bg-blue-50',
          }}
          placeholder="Blue background value..."
        />
      </div>

      <div className="space-y-4">
        <h4 className="font-medium">Custom Delete Button</h4>
        <TokenizedSearchInput
          fields={BASIC_FIELDS}
          defaultValue="status:is:active"
          onSubmit={setResult}
          classNames={{
            tokenDeleteButton: 'bg-red-100 hover:bg-red-200 text-red-600',
          }}
          placeholder="Red delete button..."
        />
      </div>

      <div className="space-y-4">
        <h4 className="font-medium">All Token Slots Combined</h4>
        <TokenizedSearchInput
          fields={BASIC_FIELDS}
          defaultValue="status:is:active priority:is:high"
          onSubmit={setResult}
          classNames={{
            token: 'border border-indigo-200 bg-indigo-50',
            tokenLabel: 'font-semibold text-indigo-700',
            tokenOperator: 'text-indigo-500',
            tokenValue: 'bg-indigo-100/50',
            tokenDeleteButton: 'text-indigo-400 hover:text-indigo-600 hover:bg-indigo-200',
          }}
          placeholder="Indigo theme via classNames..."
        />
      </div>

      <ResultDisplay result={result} />
    </div>
  );
};

export const StateBasedStyling: Story = () => {
  const [result, setResult] = useState<QuerySnapshot | null>(null);

  return (
    <div className="p-4 space-y-6">
      <div>
        <h3 className="text-lg font-medium mb-2">State-Based Styling</h3>
        <p className="text-sm text-gray-600 mb-4">
          Use Tailwind's <code>data-*</code> variants to style based on component state. Available
          data attributes: <code>data-focused</code>, <code>data-invalid</code>,{' '}
          <code>data-state</code>.
        </p>
      </div>

      <div className="space-y-4">
        <h4 className="font-medium">Focus State Styling</h4>
        <p className="text-sm text-gray-500 mb-2">Click on the token value to see focus styles</p>
        <TokenizedSearchInput
          fields={BASIC_FIELDS}
          defaultValue="status:is:active"
          onSubmit={setResult}
          classNames={{
            tokenValue:
              'data-[focused=true]:bg-blue-100 data-[focused=true]:ring-2 data-[focused=true]:ring-blue-300',
          }}
          placeholder="Focus on token value..."
        />
      </div>

      <div className="space-y-4">
        <h4 className="font-medium">Invalid State Styling</h4>
        <p className="text-sm text-gray-500 mb-2">
          Token with invalid enum value shows validation styling
        </p>
        <TokenizedSearchInput
          fields={[
            {
              key: 'status',
              label: 'Status',
              type: 'enum',
              operators: ['is'],
              enumValues: ['active', 'inactive', 'pending'],
              validate: (value) =>
                ['active', 'inactive', 'pending'].includes(value) || 'Invalid status value',
            },
          ]}
          defaultValue="status:is:invalid_value"
          onSubmit={setResult}
          classNames={{
            token: 'data-[invalid=true]:border-orange-500 data-[invalid=true]:bg-orange-100',
          }}
          placeholder="Try invalid values..."
        />
      </div>

      <div className="space-y-4">
        <h4 className="font-medium">Token Focus State</h4>
        <p className="text-sm text-gray-500 mb-2">
          Click on a token to see focused/unfocused states
        </p>
        <TokenizedSearchInput
          fields={BASIC_FIELDS}
          defaultValue="status:is:active priority:is:high"
          onSubmit={setResult}
          classNames={{
            token:
              'data-[focused=true]:ring-2 data-[focused=true]:ring-purple-400 data-[focused=true]:bg-purple-50',
          }}
          placeholder="Click on tokens..."
        />
      </div>

      <ResultDisplay result={result} />

      <InfoBox variant="info">
        <strong>Available Data Attributes:</strong>
        <pre className="mt-2 text-xs overflow-x-auto">
          {`// Token wrapper (.tsi-token)
data-focused="true|false"  // Token has internal focus
data-invalid="true|false"  // Validation failed
data-state="focused|editing|default"

// Token value (.tsi-token-value)
data-focused="true|false"  // Value input focused

// Token operator (.tsi-token-operator--interactive)
data-state="open|closed"   // Dropdown open/closed
data-editable="true|false" // Can edit`}
        </pre>
      </InfoBox>
    </div>
  );
};

export const HoverStyles: Story = () => {
  const [result, setResult] = useState<QuerySnapshot | null>(null);

  return (
    <div className="p-4 space-y-6">
      <div>
        <h3 className="text-lg font-medium mb-2">Hover Styles</h3>
        <p className="text-sm text-gray-600 mb-4">
          Use Tailwind's <code>hover:</code> variant for hover effects.
        </p>
      </div>

      <div className="space-y-4">
        <h4 className="font-medium">Token Hover Effect</h4>
        <TokenizedSearchInput
          fields={BASIC_FIELDS}
          defaultValue="status:is:active priority:is:high"
          onSubmit={setResult}
          classNames={{
            token: 'hover:shadow-md hover:border-blue-300 transition-all duration-150',
          }}
          placeholder="Hover over tokens..."
        />
      </div>

      <div className="space-y-4">
        <h4 className="font-medium">Delete Button Hover</h4>
        <TokenizedSearchInput
          fields={BASIC_FIELDS}
          defaultValue="status:is:active priority:is:high"
          onSubmit={setResult}
          classNames={{
            tokenDeleteButton:
              'hover:bg-red-100 hover:text-red-600 hover:scale-110 transition-all duration-150',
          }}
          placeholder="Hover over X button..."
        />
      </div>

      <div className="space-y-4">
        <h4 className="font-medium">Combined Hover States</h4>
        <TokenizedSearchInput
          fields={BASIC_FIELDS}
          defaultValue="status:is:active priority:is:high"
          onSubmit={setResult}
          classNames={{
            token: 'hover:shadow-lg hover:border-green-400 transition-shadow',
            tokenLabel: 'hover:text-green-600',
            tokenDeleteButton: 'hover:bg-green-100 hover:text-green-700',
          }}
          placeholder="Hover effects everywhere..."
        />
      </div>

      <ResultDisplay result={result} />
    </div>
  );
};

export const DropdownStyling: Story = () => {
  const [result, setResult] = useState<QuerySnapshot | null>(null);

  return (
    <div className="p-4 space-y-6">
      <div>
        <h3 className="text-lg font-medium mb-2">Dropdown Styling</h3>
        <p className="text-sm text-gray-600 mb-4">
          Customize the suggestion dropdown, items, and field categories.
        </p>
      </div>

      <div className="space-y-4">
        <h4 className="font-medium">Custom Dropdown</h4>
        <p className="text-sm text-gray-500 mb-2">
          Type to see the styled dropdown with categories
        </p>
        <TokenizedSearchInput
          fields={CATEGORIZED_FIELDS}
          onSubmit={setResult}
          classNames={{
            dropdown: 'border-2 border-purple-200 rounded-xl',
            suggestionItem: 'hover:bg-purple-100',
            fieldCategory: 'text-purple-600 font-bold',
          }}
          placeholder="Type to see dropdown..."
        />
      </div>

      <div className="space-y-4">
        <h4 className="font-medium">Minimal Dropdown</h4>
        <p className="text-sm text-gray-500 mb-2">
          Type to see the minimal dropdown with categories
        </p>
        <TokenizedSearchInput
          fields={CATEGORIZED_FIELDS}
          onSubmit={setResult}
          classNames={{
            dropdown: 'border border-gray-100 shadow-sm rounded-md',
            suggestionItem: 'text-sm',
            fieldCategory: 'text-xs uppercase tracking-wider text-gray-400',
          }}
          placeholder="Type to see minimal dropdown..."
        />
      </div>

      <ResultDisplay result={result} />

      <InfoBox variant="info">
        <strong>Dropdown Slots:</strong>
        <pre className="mt-2 text-xs">
          {`classNames={{
  dropdown: "...",       // Dropdown container
  suggestionItem: "...", // Each suggestion
  fieldCategory: "...",  // Category headers
}}`}
        </pre>
      </InfoBox>
    </div>
  );
};

export const ContainerAndInput: Story = () => {
  const [result, setResult] = useState<QuerySnapshot | null>(null);

  return (
    <div className="p-4 space-y-6">
      <div>
        <h3 className="text-lg font-medium mb-2">Container & Input Styling</h3>
        <p className="text-sm text-gray-600 mb-4">Style the main container and text input areas.</p>
      </div>

      <div className="space-y-4">
        <h4 className="font-medium">Custom Container</h4>
        <TokenizedSearchInput
          fields={BASIC_FIELDS}
          defaultValue="status:is:active"
          onSubmit={setResult}
          classNames={{
            root: 'border-2 border-blue-400 rounded-xl shadow-lg',
          }}
          placeholder="Custom container..."
        />
      </div>

      <div className="space-y-4">
        <h4 className="font-medium">Custom Input</h4>
        <TokenizedSearchInput
          fields={BASIC_FIELDS}
          onSubmit={setResult}
          classNames={{
            input: 'text-lg font-medium',
            placeholder: 'text-purple-300',
          }}
          placeholder="Custom input styling..."
        />
      </div>

      <div className="space-y-4">
        <h4 className="font-medium">Combined</h4>
        <TokenizedSearchInput
          fields={BASIC_FIELDS}
          defaultValue="status:is:active"
          onSubmit={setResult}
          classNames={{
            root: 'bg-gradient-to-r from-blue-50 to-purple-50 border-0 shadow-inner',
            input: 'text-purple-700',
            placeholder: 'text-purple-300',
          }}
          placeholder="Gradient background..."
        />
      </div>

      <ResultDisplay result={result} />
    </div>
  );
};

export const CompleteCustomTheme: Story = () => {
  const [result, setResult] = useState<QuerySnapshot | null>(null);

  const customSuggestion: CustomSuggestionConfig = {
    displayMode: 'append',
    suggest: ({ query }) => {
      const filtered = AVAILABLE_TAGS.filter((tag) =>
        tag.label.toLowerCase().includes(query.toLowerCase())
      );
      return filtered.map((tag) => ({
        tokens: [
          { key: 'tag', operator: 'is' as const, value: tag.value, displayValue: tag.label },
        ],
        label: tag.label,
        description: `Tag: ${tag.value}`,
      }));
    },
  };

  const fieldsWithTag = [...BASIC_FIELDS, TAG_FIELD];

  return (
    <div className="p-4 space-y-6">
      <div>
        <h3 className="text-lg font-medium mb-2">Complete Custom Theme</h3>
        <p className="text-sm text-gray-600 mb-4">
          Example of a fully customized component using all available classNames slots. Type to see
          custom suggestions with label and description.
        </p>
      </div>

      <div className="space-y-4">
        <h4 className="font-medium">Ocean Theme</h4>
        <TokenizedSearchInput
          fields={fieldsWithTag}
          defaultValue="status:is:active priority:is:high"
          onSubmit={setResult}
          suggestions={{ custom: customSuggestion }}
          classNames={{
            root: 'bg-slate-900 border-slate-700 rounded-xl',
            input: 'text-white placeholder:text-slate-400',
            token:
              'bg-sky-900 border-sky-700 data-[focused=true]:ring-2 data-[focused=true]:ring-sky-400 data-[range-selected=true]:bg-sky-700',
            tokenLabel: 'text-sky-300 font-medium',
            tokenOperator: 'text-sky-400 hover:text-sky-200 focus:bg-sky-800',
            tokenValue: 'text-sky-100 data-[focused=true]:bg-sky-800',
            tokenDeleteButton: 'text-sky-400 hover:text-white hover:bg-sky-700 focus:bg-sky-800',
            dropdown: 'bg-slate-900 border-slate-700 text-slate-200',
            operatorDropdown: 'bg-slate-900 border-slate-700 text-slate-200',
            operatorDropdownItem:
              'text-slate-200 hover:bg-slate-800 data-[active=true]:bg-slate-800',
            suggestionItem: 'text-slate-200 hover:bg-slate-800 data-[active=true]:bg-slate-800',
            suggestionItemHint: 'text-slate-400',
            suggestionItemDescription: 'text-slate-400',
            suggestionItemIcon: 'text-sky-400',
            fieldCategory: 'text-sky-400',
            divider: 'border-slate-700',
          }}
          placeholder="Type to see custom suggestions..."
        />
      </div>

      <div className="space-y-4">
        <h4 className="font-medium">Forest Theme</h4>
        <TokenizedSearchInput
          fields={fieldsWithTag}
          defaultValue="status:is:active priority:is:high"
          onSubmit={setResult}
          suggestions={{ custom: customSuggestion }}
          classNames={{
            root: 'bg-emerald-950 border-emerald-800 rounded-lg',
            input: 'text-emerald-100 placeholder:text-emerald-600',
            token:
              'bg-emerald-900 border-emerald-700 data-[focused=true]:ring-2 data-[focused=true]:ring-emerald-400 data-[range-selected=true]:bg-emerald-700',
            tokenLabel: 'text-emerald-300 font-semibold',
            tokenOperator: 'text-emerald-400 hover:text-emerald-200 focus:bg-emerald-800',
            tokenValue: 'text-emerald-100 data-[focused=true]:bg-emerald-800',
            tokenDeleteButton:
              'text-emerald-500 hover:text-emerald-200 hover:bg-emerald-700 focus:bg-emerald-800',
            dropdown: 'bg-emerald-950 border-emerald-800 text-emerald-200',
            operatorDropdown: 'bg-emerald-950 border-emerald-800 text-emerald-200',
            operatorDropdownItem:
              'text-emerald-200 hover:bg-emerald-900 data-[active=true]:bg-emerald-900',
            suggestionItem:
              'text-emerald-200 hover:bg-emerald-900 data-[active=true]:bg-emerald-900',
            suggestionItemHint: 'text-emerald-500',
            suggestionItemDescription: 'text-emerald-500',
            suggestionItemIcon: 'text-emerald-400',
            fieldCategory: 'text-emerald-400',
            divider: 'border-emerald-700',
          }}
          placeholder="Type to see custom suggestions..."
        />
      </div>

      <div className="space-y-4">
        <h4 className="font-medium">Sunset Theme</h4>
        <TokenizedSearchInput
          fields={fieldsWithTag}
          defaultValue="status:is:active priority:is:high"
          onSubmit={setResult}
          suggestions={{ custom: customSuggestion }}
          classNames={{
            root: 'bg-gradient-to-r from-orange-50 to-rose-50 border-orange-200 rounded-2xl',
            input: 'text-orange-900 placeholder:text-orange-400',
            token:
              'bg-gradient-to-r from-orange-100 to-rose-100 border-orange-300 data-[focused=true]:ring-2 data-[focused=true]:ring-orange-400 data-[range-selected=true]:bg-none data-[range-selected=true]:bg-orange-300',
            tokenLabel: 'text-orange-700 font-bold',
            tokenOperator: 'text-rose-500 hover:text-rose-700 focus:bg-orange-200',
            tokenValue: 'data-[focused=true]:bg-orange-100',
            tokenDeleteButton:
              'text-rose-400 hover:text-rose-600 hover:bg-rose-100 focus:bg-orange-200',
            dropdown: 'bg-gradient-to-b from-orange-50 to-rose-50 border-orange-200',
            operatorDropdown: 'bg-gradient-to-b from-orange-50 to-rose-50 border-orange-200',
            operatorDropdownItem:
              'text-orange-800 hover:bg-orange-100 data-[active=true]:bg-orange-100',
            suggestionItem: 'text-orange-800 hover:bg-orange-100 data-[active=true]:bg-orange-100',
            suggestionItemHint: 'text-orange-500',
            suggestionItemDescription: 'text-orange-500',
            suggestionItemIcon: 'text-rose-500',
            fieldCategory: 'text-rose-600',
            divider: 'border-orange-200',
          }}
          placeholder="Type to see custom suggestions..."
        />
      </div>

      <ResultDisplay result={result} />
    </div>
  );
};

export default {
  title: 'Customization / Class Names',
};
