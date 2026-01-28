import { TokenizedSearchInput } from '@kuruwic/tokenized-search-input';
import type { QuerySnapshot } from '@kuruwic/tokenized-search-input/utils';
import type { Story } from '@ladle/react';
import { useState } from 'react';
import { BASIC_FIELDS, ResultDisplay } from './_shared';

export const Basic: Story = () => {
  const [result, setResult] = useState<QuerySnapshot | null>(null);
  return (
    <div className="p-4">
      <h3 className="text-lg font-medium mb-2">Basic Usage</h3>
      <p className="text-sm text-gray-600 mb-4">
        A simple search input with status, priority, and assignee fields.
      </p>
      <TokenizedSearchInput
        fields={BASIC_FIELDS}
        onSubmit={setResult}
        placeholder="Search..."
        clearable
      />
      <ResultDisplay result={result} />
    </div>
  );
};

export const WithInitialValue: Story = () => {
  const [result, setResult] = useState<QuerySnapshot | null>(null);
  return (
    <div className="p-4">
      <h3 className="text-lg font-medium mb-2">With Initial Value</h3>
      <p className="text-sm text-gray-600 mb-4">
        Pre-populated with filter tokens using the defaultValue prop.
      </p>
      <TokenizedSearchInput
        fields={BASIC_FIELDS}
        defaultValue="status:is:active priority:is:high"
        onSubmit={setResult}
        placeholder="Search..."
        clearable
      />
      <ResultDisplay result={result} />
    </div>
  );
};

export const Disabled: Story = () => {
  return (
    <div className="p-4">
      <h3 className="text-lg font-medium mb-2">Disabled State</h3>
      <p className="text-sm text-gray-600 mb-4">The input is disabled and cannot be edited.</p>
      <TokenizedSearchInput
        fields={BASIC_FIELDS}
        defaultValue="status:is:active"
        disabled
        placeholder="This input is disabled"
        clearable
      />
    </div>
  );
};

export const Clearable: Story = () => {
  const [result, setResult] = useState<QuerySnapshot | null>(null);
  return (
    <div className="p-4">
      <h3 className="text-lg font-medium mb-2">Clearable</h3>
      <p className="text-sm text-gray-600 mb-4">
        Shows a clear button when there is content. Click the X to clear all.
      </p>
      <TokenizedSearchInput
        fields={BASIC_FIELDS}
        defaultValue="status:is:active priority:is:high"
        onSubmit={setResult}
        placeholder="Add filters then clear..."
        clearable
      />
      <ResultDisplay result={result} />
    </div>
  );
};

export const SingleLine: Story = () => {
  const [result, setResult] = useState<QuerySnapshot | null>(null);
  return (
    <div className="p-4">
      <h3 className="text-lg font-medium mb-2">Single Line Mode</h3>
      <p className="text-sm text-gray-600 mb-4">
        Tokens scroll horizontally instead of wrapping to multiple lines.
      </p>
      <TokenizedSearchInput
        fields={BASIC_FIELDS}
        defaultValue="status:is:active priority:is:high status:is:pending assignee:contains:john"
        onSubmit={setResult}
        placeholder="Tokens scroll horizontally..."
        singleLine
        clearable
      />
      <ResultDisplay result={result} />
    </div>
  );
};

export const ExpandOnFocus: Story = () => {
  const [result, setResult] = useState<QuerySnapshot | null>(null);
  return (
    <div className="p-4">
      <h3 className="text-lg font-medium mb-2">Expand on Focus</h3>
      <p className="text-sm text-gray-600 mb-4">
        Collapsed to single line when unfocused, expands as an overlay when focused.
      </p>
      <div className="relative" style={{ minHeight: 'calc(1.375rem + 0.5rem * 2 + 2px)' }}>
        <TokenizedSearchInput
          fields={BASIC_FIELDS}
          defaultValue="status:is:active priority:is:high status:is:pending assignee:contains:john priority:is:low"
          onSubmit={setResult}
          placeholder="Click to expand..."
          expandOnFocus
          clearable
        />
      </div>
      <div className="mt-4 p-4 bg-blue-50 border border-blue-200 rounded">
        <p className="text-blue-800">
          This content is below the input. The expanded input overlays without pushing layout.
        </p>
      </div>
      <ResultDisplay result={result} />
    </div>
  );
};

export default {
  title: 'Getting Started',
};
