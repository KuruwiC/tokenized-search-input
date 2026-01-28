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
    // timeRequired: false (default) - Shows "Include time" checkbox
  },
];

export const DateTimeField: Story = () => {
  const [result, setResult] = useState<QuerySnapshot | null>(null);
  return (
    <div className="p-4">
      <h3 className="text-lg font-medium mb-2">DateTime Fields</h3>
      <p className="text-sm text-gray-600 mb-4">
        DateTime fields include both date and time selection. By default, an "Include time" checkbox
        allows users to choose between date-only or date+time values.
      </p>
      <TokenizedSearchInput
        fields={dateTimeFields}
        onSubmit={setResult}
        placeholder="Select a date and time..."
        clearable
      />
      <ResultDisplay result={result} />
      <div className="mt-3 p-3 bg-blue-50 rounded text-xs text-blue-800">
        <strong>Tip:</strong> Check "Include time" in the picker to add time component to the value.
      </div>
    </div>
  );
};

const dateTimeRequiredFields: FieldDefinition[] = [
  {
    key: 'scheduled',
    label: 'Scheduled At',
    type: 'datetime',
    operators: ['is', 'gt', 'lt'],
    icon: <Clock className="w-full h-full" />,
    operatorLabels: {
      is: { display: 'at', select: 'at' },
      gt: { display: 'after', select: 'after' },
      lt: { display: 'before', select: 'before' },
    },
    timeRequired: true,
  },
];

export const DateTimeTimeRequired: Story = () => {
  const [result, setResult] = useState<QuerySnapshot | null>(null);
  return (
    <div className="p-4">
      <h3 className="text-lg font-medium mb-2">DateTime with Time Required</h3>
      <p className="text-sm text-gray-600 mb-4">
        When <code>timeRequired: true</code>, time input is always enabled and the "Include time"
        checkbox is hidden. Date-only values are normalized to datetime format.
      </p>
      <TokenizedSearchInput
        fields={dateTimeRequiredFields}
        onSubmit={setResult}
        placeholder="Select a scheduled time..."
        clearable
      />
      <ResultDisplay result={result} />
      <div className="mt-3 p-3 bg-amber-50 rounded text-xs text-amber-800">
        <strong>Note:</strong> Time input is always active. No checkbox to toggle time on/off.
      </div>
    </div>
  );
};

const customFormatDateFields: FieldDefinition[] = [
  {
    key: 'due',
    label: 'Due Date',
    type: 'date',
    operators: ['is', 'gt', 'lt'],
    icon: <Calendar className="w-full h-full" />,
    formatConfig: {
      // Custom format: Display as "Jan 15, 2024" instead of "2024-01-15"
      format: (isoValue: string) => {
        const date = new Date(isoValue);
        return date.toLocaleDateString('en-US', {
          month: 'short',
          day: 'numeric',
          year: 'numeric',
        });
      },
    },
  },
  {
    key: 'birthday',
    label: 'Birthday',
    type: 'date',
    operators: ['is'],
    icon: <Calendar className="w-full h-full" />,
    formatConfig: {
      // Custom parse: Accept "MM/DD/YYYY" format
      parse: (input: string) => {
        const match = input.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
        if (match) {
          const [, month, day, year] = match;
          return `${year}-${month?.padStart(2, '0')}-${day?.padStart(2, '0')}`;
        }
        return null;
      },
      // Custom format: Display as "MM/DD/YYYY"
      format: (isoValue: string) => {
        const [year, month, day] = isoValue.split('-');
        return `${month}/${day}/${year}`;
      },
    },
  },
];

export const CustomDateFormat: Story = () => {
  const [result, setResult] = useState<QuerySnapshot | null>(null);
  return (
    <div className="p-4">
      <h3 className="text-lg font-medium mb-2">Custom Date Format</h3>
      <p className="text-sm text-gray-600 mb-4">
        Use <code>formatConfig</code> to customize how dates are parsed and displayed.
      </p>
      <TokenizedSearchInput
        fields={customFormatDateFields}
        onSubmit={setResult}
        placeholder="Try: due:is or birthday:is"
        clearable
      />
      <ResultDisplay result={result} />
      <div className="mt-3 p-3 bg-purple-50 rounded text-xs text-purple-800">
        <strong>Custom formats:</strong>
        <ul className="mt-1 list-disc list-inside">
          <li>
            <strong>Due Date:</strong> Displays as "Jan 15, 2024"
          </li>
          <li>
            <strong>Birthday:</strong> Accepts and displays "MM/DD/YYYY" format (try typing
            "01/15/2024")
          </li>
        </ul>
      </div>
    </div>
  );
};

const customFormatDateTimeFields: FieldDefinition[] = [
  {
    key: 'appointment',
    label: 'Appointment',
    type: 'datetime',
    operators: ['is', 'gt', 'lt'],
    icon: <Clock className="w-full h-full" />,
    formatConfig: {
      // Custom format: Display as "Jan 15, 2024 at 2:30 PM" or "Jan 15, 2024" for date-only
      format: (isoValue: string) => {
        const date = new Date(isoValue);
        const dateStr = date.toLocaleDateString('en-US', {
          month: 'short',
          day: 'numeric',
          year: 'numeric',
        });
        // Date-only values (yyyy-MM-dd) should display without time
        const isDateOnly = /^\d{4}-\d{2}-\d{2}$/.test(isoValue.trim());
        if (isDateOnly) {
          return dateStr;
        }
        const timeStr = date.toLocaleTimeString('en-US', {
          hour: 'numeric',
          minute: '2-digit',
          hour12: true,
        });
        return `${dateStr} at ${timeStr}`;
      },
    },
  },
];

export const CustomDateTimeFormat: Story = () => {
  const [result, setResult] = useState<QuerySnapshot | null>(null);
  return (
    <div className="p-4">
      <h3 className="text-lg font-medium mb-2">Custom DateTime Format</h3>
      <p className="text-sm text-gray-600 mb-4">
        DateTime fields can also use <code>formatConfig</code> for custom display.
      </p>
      <TokenizedSearchInput
        fields={customFormatDateTimeFields}
        onSubmit={setResult}
        placeholder="Select an appointment time..."
        clearable
      />
      <ResultDisplay result={result} />
      <div className="mt-3 p-3 bg-indigo-50 rounded text-xs text-indigo-800">
        <strong>Note:</strong> The appointment displays as "Jan 15, 2024 at 2:30 PM" (with time) or
        "Jan 15, 2024" (date only) instead of the default ISO format.
      </div>
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
