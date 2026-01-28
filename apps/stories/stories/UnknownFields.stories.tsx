import { TokenizedSearchInput } from '@kuruwic/tokenized-search-input';
import type { QuerySnapshot } from '@kuruwic/tokenized-search-input/utils';
import type { Story } from '@ladle/react';
import { useState } from 'react';
import { KNOWN_STATUS_FIELD, MIXED_KNOWN_FIELDS, ResultDisplay } from './_shared';

export const BasicUnknownFields: Story = () => {
  const [result, setResult] = useState<QuerySnapshot | null>(null);

  return (
    <div className="p-4">
      <h3 className="text-lg font-medium mb-2">Basic Unknown Fields</h3>
      <p className="text-sm text-gray-600 mb-4">
        With UnknownFields.allow=true, any text matching "field:value" format is tokenized, even if
        the field is not defined. Default operator is "is".
      </p>
      <TokenizedSearchInput
        fields={[KNOWN_STATUS_FIELD]}
        onSubmit={setResult}
        placeholder='Try "custom:value" or "age:25"...'
        unknownFields={{ allow: true }}
      />
      <ResultDisplay result={result} />
      <div className="mt-3 p-3 bg-blue-50 rounded text-xs text-blue-800">
        <strong>Try:</strong>
        <ul className="list-disc list-inside mt-1 space-y-0.5">
          <li>
            <code className="bg-white px-1 rounded">status:active</code> - Known field
          </li>
          <li>
            <code className="bg-white px-1 rounded">custom:myvalue</code> - Unknown field
          </li>
          <li>
            <code className="bg-white px-1 rounded">author:john</code> - Unknown field
          </li>
        </ul>
      </div>
    </div>
  );
};

export const WithOperatorRestriction: Story = () => {
  const [result, setResult] = useState<QuerySnapshot | null>(null);

  return (
    <div className="p-4">
      <h3 className="text-lg font-medium mb-2">With Operator Restriction</h3>
      <p className="text-sm text-gray-600 mb-4">
        UnknownFields.operators limits which operators are allowed for unknown fields. The first
        operator in the array is used as the default.
      </p>
      <TokenizedSearchInput
        fields={[KNOWN_STATUS_FIELD]}
        onSubmit={setResult}
        placeholder='Try "age:gt:18" or "name:contains:john"...'
        unknownFields={{ allow: true, operators: ['is', 'contains', 'gt', 'lt'] }}
      />
      <ResultDisplay result={result} />
      <div className="mt-3 p-3 bg-green-50 rounded text-xs text-green-800">
        <strong>Allowed operators:</strong> is, contains, gt, lt
        <ul className="list-disc list-inside mt-1 space-y-0.5">
          <li>
            <code className="bg-white px-1 rounded">age:gt:18</code> - Greater than
          </li>
          <li>
            <code className="bg-white px-1 rounded">price:lt:100</code> - Less than
          </li>
          <li>
            <code className="bg-white px-1 rounded">name:contains:john</code> - Contains
          </li>
        </ul>
      </div>
    </div>
  );
};

export const HideUnknownSingleOperator: Story = () => {
  const [result, setResult] = useState<QuerySnapshot | null>(null);

  return (
    <div className="p-4">
      <h3 className="text-lg font-medium mb-2">Hide Unknown Field Single Operator</h3>
      <p className="text-sm text-gray-600 mb-4">
        UnknownFields.hideSingleOperator=true hides the operator display when only one operator is
        available. Only applies when operators has a single operator.
      </p>
      <TokenizedSearchInput
        fields={[KNOWN_STATUS_FIELD]}
        onSubmit={setResult}
        placeholder='Try "custom:value"...'
        unknownFields={{ allow: true, operators: ['is'], hideSingleOperator: true }}
      />
      <ResultDisplay result={result} />
      <div className="mt-3 p-3 bg-yellow-50 rounded text-xs text-yellow-800">
        <strong>Note:</strong> The "is" operator is hidden in the token display for unknown fields.
      </div>
    </div>
  );
};

export const MixedKnownUnknown: Story = () => {
  const [result, setResult] = useState<QuerySnapshot | null>(null);

  return (
    <div className="p-4">
      <h3 className="text-lg font-medium mb-2">Mixed Known and Unknown Fields</h3>
      <p className="text-sm text-gray-600 mb-4">
        Combine predefined fields with dynamic unknown fields. Known fields get their full
        configuration (icon, enumValues), unknown fields use defaults.
      </p>
      <TokenizedSearchInput
        fields={MIXED_KNOWN_FIELDS}
        defaultValue="status:is:active custom:hello"
        onSubmit={setResult}
        placeholder="Mix known and unknown fields..."
        unknownFields={{ allow: true, operators: ['is', 'contains', 'gt', 'lt'] }}
      />
      <ResultDisplay result={result} />
      <div className="mt-3 p-3 bg-purple-50 rounded text-xs text-purple-800">
        <strong>Compare:</strong>
        <ul className="list-disc list-inside mt-1 space-y-0.5">
          <li>"Status" has icon and enum values (suggestions)</li>
          <li>"custom" has no icon and accepts any value</li>
        </ul>
      </div>
    </div>
  );
};

export default {
  title: 'Features / Unknown Fields',
};
