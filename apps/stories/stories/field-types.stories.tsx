import { TokenizedSearchInput } from '@kuruwic/tokenized-search-input';
import type { FieldDefinition, QuerySnapshot } from '@kuruwic/tokenized-search-input/utils';
import type { Story } from '@ladle/react';
import { Calendar, Clock, Flag, Search, Tag, User } from 'lucide-react';
import { useState } from 'react';
import { ResultDisplay } from './_shared';

const stringFields: FieldDefinition[] = [
  {
    key: 'title',
    label: 'Title',
    type: 'string',
    operators: ['is', 'contains', 'starts_with', 'ends_with'],
    allowSpaces: true,
    icon: <Search className="w-full h-full" />,
  },
  {
    key: 'email',
    label: 'Email',
    type: 'string',
    operators: ['is', 'contains'],
    icon: <User className="w-full h-full" />,
  },
];

export const StringField: Story = () => {
  const [result, setResult] = useState<QuerySnapshot | null>(null);
  return (
    <div className="p-4">
      <h3 className="text-lg font-medium mb-2">String Fields</h3>
      <p className="text-sm text-gray-600 mb-4">
        String fields accept free text input. Use <code>allowSpaces: true</code> to allow spaces in
        values (wrap with quotes).
      </p>
      <TokenizedSearchInput
        fields={stringFields}
        onSubmit={setResult}
        placeholder='Try: title:contains:"hello world"'
        clearable
      />
      <ResultDisplay result={result} />
      <div className="mt-3 p-3 bg-blue-50 rounded text-xs text-blue-800">
        <strong>Tip:</strong> Use quotes to include spaces in values, e.g., title:contains:"hello
        world"
      </div>
    </div>
  );
};

const enumFields: FieldDefinition[] = [
  {
    key: 'status',
    label: 'Status',
    type: 'enum',
    operators: ['is', 'is_not'],
    enumValues: [
      { value: 'active', label: 'Active' },
      { value: 'inactive', label: 'Inactive' },
      { value: 'pending', label: 'Pending' },
      { value: 'archived', label: 'Archived' },
    ],
    icon: <Tag className="w-full h-full" />,
  },
  {
    key: 'priority',
    label: 'Priority',
    type: 'enum',
    operators: ['is', 'is_not'],
    enumValues: [
      { value: 'critical', label: 'Critical' },
      { value: 'high', label: 'High' },
      { value: 'medium', label: 'Medium' },
      { value: 'low', label: 'Low' },
    ],
    icon: <Flag className="w-full h-full" />,
  },
];

export const EnumField: Story = () => {
  const [result, setResult] = useState<QuerySnapshot | null>(null);
  return (
    <div className="p-4">
      <h3 className="text-lg font-medium mb-2">Enum Fields</h3>
      <p className="text-sm text-gray-600 mb-4">
        Enum fields provide predefined values in a dropdown. Values can be simple strings or objects
        with value/label.
      </p>
      <TokenizedSearchInput
        fields={enumFields}
        onSubmit={setResult}
        placeholder="Select a status or priority..."
        clearable
      />
      <ResultDisplay result={result} />
    </div>
  );
};

const dateFields: FieldDefinition[] = [
  {
    key: 'created',
    label: 'Created',
    type: 'date',
    operators: ['gt', 'lt', 'gte', 'lte'],
    icon: <Calendar className="w-full h-full" />,
    operatorLabels: {
      gt: { display: 'after', select: 'after' },
      lt: { display: 'before', select: 'before' },
      gte: { display: 'from', select: 'from' },
      lte: { display: 'until', select: 'until' },
    },
  },
];

export const DateField: Story = () => {
  const [result, setResult] = useState<QuerySnapshot | null>(null);
  return (
    <div className="p-4">
      <h3 className="text-lg font-medium mb-2">Date Fields</h3>
      <p className="text-sm text-gray-600 mb-4">
        Date fields show a date picker. Use operatorLabels to customize how operators are displayed.
      </p>
      <TokenizedSearchInput
        fields={dateFields}
        onSubmit={setResult}
        placeholder="Select a date range..."
        clearable
      />
      <ResultDisplay result={result} />
      <div className="mt-3 p-3 bg-green-50 rounded text-xs text-green-800">
        <strong>Note:</strong> Operators are shown as "after", "before", "from", "until" instead of
        gt, lt, gte, lte.
      </div>
    </div>
  );
};

const dateTimeFields: FieldDefinition[] = [
  {
    key: 'updated',
    label: 'Updated',
    type: 'datetime',
    operators: ['gt', 'lt'],
    icon: <Clock className="w-full h-full" />,
    operatorLabels: {
      gt: { display: 'after', select: 'after' },
      lt: { display: 'before', select: 'before' },
    },
  },
];

export const DateTimeField: Story = () => {
  const [result, setResult] = useState<QuerySnapshot | null>(null);
  return (
    <div className="p-4">
      <h3 className="text-lg font-medium mb-2">DateTime Fields</h3>
      <p className="text-sm text-gray-600 mb-4">
        DateTime fields include both date and time selection.
      </p>
      <TokenizedSearchInput
        fields={dateTimeFields}
        onSubmit={setResult}
        placeholder="Select a date and time..."
        clearable
      />
      <ResultDisplay result={result} />
    </div>
  );
};

const allFields: FieldDefinition[] = [
  ...stringFields,
  ...enumFields,
  ...dateFields,
  ...dateTimeFields,
];

export const MixedFields: Story = () => {
  const [result, setResult] = useState<QuerySnapshot | null>(null);
  return (
    <div className="p-4">
      <h3 className="text-lg font-medium mb-2">Mixed Field Types</h3>
      <p className="text-sm text-gray-600 mb-4">
        Combining all field types in a single input for complex filtering.
      </p>
      <TokenizedSearchInput
        fields={allFields}
        onSubmit={setResult}
        placeholder="Filter by any field..."
        clearable
      />
      <ResultDisplay result={result} />
      <div className="mt-3 p-3 bg-gray-50 rounded text-xs text-gray-700">
        <strong>Available fields:</strong>
        <ul className="mt-1 list-disc list-inside">
          <li>title, email (string)</li>
          <li>status, priority (enum)</li>
          <li>created (date)</li>
          <li>updated (datetime)</li>
        </ul>
      </div>
    </div>
  );
};

export default {
  title: 'Core / Field Types',
};
