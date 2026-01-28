import { TokenizedSearchInput } from '@kuruwic/tokenized-search-input';
import type { FieldDefinition, QuerySnapshot } from '@kuruwic/tokenized-search-input/utils';
import type { Story } from '@ladle/react';
import { Calendar, Flag, Search, Tag } from 'lucide-react';
import { useState } from 'react';
import { ResultDisplay } from './_shared';

const stringOperatorFields: FieldDefinition[] = [
  {
    key: 'title',
    label: 'Title',
    type: 'string',
    operators: ['is', 'is_not', 'contains', 'starts_with', 'ends_with'],
    allowSpaces: true,
    icon: <Search className="w-full h-full" />,
  },
];

export const StringOperators: Story = () => {
  const [result, setResult] = useState<QuerySnapshot | null>(null);
  return (
    <div className="p-4">
      <h3 className="text-lg font-medium mb-2">String Operators</h3>
      <p className="text-sm text-gray-600 mb-4">
        String fields support: is, is_not, contains, starts_with, ends_with.
      </p>
      <TokenizedSearchInput
        fields={stringOperatorFields}
        onSubmit={setResult}
        placeholder="Try different operators..."
        clearable
      />
      <ResultDisplay result={result} />
      <div className="mt-3 p-3 bg-blue-50 rounded text-xs text-blue-800">
        <strong>Operators:</strong>
        <ul className="mt-1 list-disc list-inside">
          <li>
            <code>is</code> - Exact match
          </li>
          <li>
            <code>is_not</code> - Not equal
          </li>
          <li>
            <code>contains</code> - Contains substring
          </li>
          <li>
            <code>starts_with</code> - Starts with prefix
          </li>
          <li>
            <code>ends_with</code> - Ends with suffix
          </li>
        </ul>
      </div>
    </div>
  );
};

const comparisonFields: FieldDefinition[] = [
  {
    key: 'created',
    label: 'Created',
    type: 'date',
    operators: ['gt', 'lt', 'gte', 'lte'],
    icon: <Calendar className="w-full h-full" />,
  },
];

export const ComparisonOperators: Story = () => {
  const [result, setResult] = useState<QuerySnapshot | null>(null);
  return (
    <div className="p-4">
      <h3 className="text-lg font-medium mb-2">Comparison Operators</h3>
      <p className="text-sm text-gray-600 mb-4">
        Date fields support: gt (greater than), lt (less than), gte (greater or equal), lte (less or
        equal).
      </p>
      <TokenizedSearchInput
        fields={comparisonFields}
        onSubmit={setResult}
        placeholder="Select date comparisons..."
        clearable
      />
      <ResultDisplay result={result} />
      <div className="mt-3 p-3 bg-green-50 rounded text-xs text-green-800">
        <strong>Operators:</strong>
        <ul className="mt-1 list-disc list-inside">
          <li>
            <code>gt</code> - Greater than (&gt;)
          </li>
          <li>
            <code>lt</code> - Less than (&lt;)
          </li>
          <li>
            <code>gte</code> - Greater or equal (&gt;=)
          </li>
          <li>
            <code>lte</code> - Less or equal (&lt;=)
          </li>
        </ul>
      </div>
    </div>
  );
};

const customOperatorFields: FieldDefinition[] = [
  {
    key: 'tag',
    label: 'Tag',
    type: 'string',
    operators: ['includes', 'excludes', 'matches'],
    icon: <Tag className="w-full h-full" />,
  },
];

export const CustomOperators: Story = () => {
  const [result, setResult] = useState<QuerySnapshot | null>(null);
  return (
    <div className="p-4">
      <h3 className="text-lg font-medium mb-2">Custom Operators</h3>
      <p className="text-sm text-gray-600 mb-4">
        You can define any operator string. Custom operators work just like built-in ones.
      </p>
      <TokenizedSearchInput
        fields={customOperatorFields}
        onSubmit={setResult}
        placeholder="Try custom operators..."
        clearable
      />
      <ResultDisplay result={result} />
      <div className="mt-3 p-3 bg-purple-50 rounded text-xs text-purple-800">
        <strong>Custom operators:</strong> includes, excludes, matches
      </div>
    </div>
  );
};

const labeledOperatorFields: FieldDefinition[] = [
  {
    key: 'created',
    label: 'Created',
    type: 'date',
    operators: ['gt', 'lt', 'gte', 'lte'],
    icon: <Calendar className="w-full h-full" />,
    operatorLabels: {
      gt: { display: 'after', select: 'is after' },
      lt: { display: 'before', select: 'is before' },
      gte: { display: 'from', select: 'is on or after' },
      lte: { display: 'until', select: 'is on or before' },
    },
  },
];

export const OperatorLabels: Story = () => {
  const [result, setResult] = useState<QuerySnapshot | null>(null);
  return (
    <div className="p-4">
      <h3 className="text-lg font-medium mb-2">Custom Operator Labels</h3>
      <p className="text-sm text-gray-600 mb-4">
        Use operatorLabels to show user-friendly text instead of technical operator names.
      </p>
      <TokenizedSearchInput
        fields={labeledOperatorFields}
        onSubmit={setResult}
        placeholder="See friendly operator names..."
        clearable
      />
      <ResultDisplay result={result} />
      <div className="mt-3 p-3 bg-yellow-50 rounded text-xs text-yellow-800">
        <strong>Label types:</strong>
        <ul className="mt-1 list-disc list-inside">
          <li>
            <code>display</code> - Shown in the token (e.g., "after")
          </li>
          <li>
            <code>select</code> - Shown in the dropdown (e.g., "is after")
          </li>
        </ul>
      </div>
    </div>
  );
};

const singleOperatorFields: FieldDefinition[] = [
  {
    key: 'tag',
    label: 'Tag',
    type: 'enum',
    operators: ['is'],
    enumValues: ['react', 'typescript', 'javascript'],
    icon: <Tag className="w-full h-full" />,
    hideSingleOperator: true,
  },
  {
    key: 'status',
    label: 'Status',
    type: 'enum',
    operators: ['is', 'is_not'],
    enumValues: ['active', 'inactive'],
    icon: <Flag className="w-full h-full" />,
    hideSingleOperator: true,
  },
];

export const HideSingleOperator: Story = () => {
  const [result, setResult] = useState<QuerySnapshot | null>(null);
  return (
    <div className="p-4">
      <h3 className="text-lg font-medium mb-2">Hide Single Operator</h3>
      <p className="text-sm text-gray-600 mb-4">
        When hideSingleOperator is true, fields with only one operator hide the operator display.
      </p>
      <TokenizedSearchInput
        fields={singleOperatorFields}
        defaultValue="tag:is:react status:is:active"
        onSubmit={setResult}
        placeholder="Compare operator visibility..."
        clearable
      />
      <ResultDisplay result={result} />
      <div className="mt-3 p-3 bg-orange-50 rounded text-xs text-orange-800">
        <strong>Compare:</strong>
        <ul className="mt-1 list-disc list-inside">
          <li>Tag (1 operator) → "Tag: react" (operator hidden)</li>
          <li>Status (2 operators) → "Status is active" (operator shown)</li>
        </ul>
      </div>
    </div>
  );
};

export default {
  title: 'Core / Operators',
};
