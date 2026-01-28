import { TokenizedSearchInput } from '@kuruwic/tokenized-search-input';
import type { FieldDefinition, QuerySnapshot } from '@kuruwic/tokenized-search-input/utils';
import type { Story } from '@ladle/react';
import { FileText, Globe, Tag } from 'lucide-react';
import { useState } from 'react';
import { ResultDisplay } from './_shared';

const basicFields: FieldDefinition[] = [
  {
    key: 'tag',
    label: 'Tag',
    type: 'string',
    operators: ['is'],
    icon: <Tag className="w-full h-full" />,
  },
  {
    key: 'status',
    label: 'Status',
    type: 'enum',
    operators: ['is'],
    enumValues: ['active', 'inactive'],
    icon: <Globe className="w-full h-full" />,
  },
];

export const LongText: Story = () => {
  const [result, setResult] = useState<QuerySnapshot | null>(null);
  const longValue = 'this-is-a-very-long-tag-value-that-might-cause-layout-issues-in-the-ui';
  return (
    <div className="p-4">
      <h3 className="text-lg font-medium mb-2">Long Text Values</h3>
      <p className="text-sm text-gray-600 mb-4">
        Testing how the component handles very long text values.
      </p>
      <TokenizedSearchInput
        fields={basicFields}
        defaultValue={`tag:is:${longValue}`}
        onSubmit={setResult}
        placeholder="Long text handling..."
      />
      <ResultDisplay result={result} />
    </div>
  );
};

export const ManyTokens: Story = () => {
  const [result, setResult] = useState<QuerySnapshot | null>(null);
  const manyTags = Array.from({ length: 10 }, (_, i) => `tag:is:tag${i + 1}`).join(' ');
  return (
    <div className="p-4">
      <h3 className="text-lg font-medium mb-2">Many Tokens</h3>
      <p className="text-sm text-gray-600 mb-4">
        Testing with 10 tokens. The input should scroll horizontally.
      </p>
      <TokenizedSearchInput
        fields={basicFields}
        defaultValue={manyTags}
        onSubmit={setResult}
        placeholder="Many tokens..."
      />
      <ResultDisplay result={result} />
    </div>
  );
};

const manyEnumFields: FieldDefinition[] = [
  {
    key: 'country',
    label: 'Country',
    type: 'enum',
    operators: ['is'],
    enumValues: [
      'Afghanistan',
      'Albania',
      'Algeria',
      'Argentina',
      'Australia',
      'Austria',
      'Belgium',
      'Brazil',
      'Canada',
      'Chile',
      'China',
      'Colombia',
      'Denmark',
      'Egypt',
      'Finland',
      'France',
      'Germany',
      'Greece',
      'India',
      'Indonesia',
      'Ireland',
      'Italy',
      'Japan',
      'Kenya',
      'Mexico',
      'Netherlands',
      'New Zealand',
      'Norway',
      'Poland',
      'Portugal',
      'Russia',
      'South Africa',
      'South Korea',
      'Spain',
      'Sweden',
      'Switzerland',
      'Thailand',
      'Turkey',
      'United Kingdom',
      'United States',
    ],
    icon: <Globe className="w-full h-full" />,
  },
];

export const LargeEnumList: Story = () => {
  const [result, setResult] = useState<QuerySnapshot | null>(null);
  return (
    <div className="p-4">
      <h3 className="text-lg font-medium mb-2">Large Enum List</h3>
      <p className="text-sm text-gray-600 mb-4">
        40 countries in the dropdown. Should be scrollable.
      </p>
      <TokenizedSearchInput
        fields={manyEnumFields}
        onSubmit={setResult}
        placeholder="Select a country..."
      />
      <ResultDisplay result={result} />
    </div>
  );
};

const fieldsWithSpaces: FieldDefinition[] = [
  {
    key: 'title',
    label: 'Title',
    type: 'string',
    operators: ['contains', 'is'],
    allowSpaces: true,
    icon: <FileText className="w-full h-full" />,
  },
];

export const ValuesWithSpaces: Story = () => {
  const [result, setResult] = useState<QuerySnapshot | null>(null);
  return (
    <div className="p-4">
      <h3 className="text-lg font-medium mb-2">Values with Spaces</h3>
      <p className="text-sm text-gray-600 mb-4">
        Title field allows spaces in values. Type a phrase and press Enter.
      </p>
      <TokenizedSearchInput
        fields={fieldsWithSpaces}
        defaultValue='title:contains:"hello world"'
        onSubmit={setResult}
        placeholder="Enter title with spaces..."
      />
      <ResultDisplay result={result} />
    </div>
  );
};

export const EmptyFields: Story = () => {
  return (
    <div className="p-4">
      <h3 className="text-lg font-medium mb-2">Empty Fields Array</h3>
      <p className="text-sm text-gray-600 mb-4">
        No fields defined. The input should still work for free text.
      </p>
      <TokenizedSearchInput
        fields={[]}
        freeTextMode="plain"
        placeholder="No fields, free text only..."
      />
    </div>
  );
};

const specialCharFields: FieldDefinition[] = [
  {
    key: 'query',
    label: 'Query',
    type: 'string',
    operators: ['is', 'contains'],
    icon: <Tag className="w-full h-full" />,
  },
];

export const SpecialCharacters: Story = () => {
  const [result, setResult] = useState<QuerySnapshot | null>(null);
  return (
    <div className="p-4">
      <h3 className="text-lg font-medium mb-2">Special Characters</h3>
      <p className="text-sm text-gray-600 mb-4">
        Testing with special characters: colons, quotes, brackets, etc.
      </p>
      <TokenizedSearchInput
        fields={specialCharFields}
        defaultValue='query:is:"test:value" query:contains:[bracket]'
        onSubmit={setResult}
        placeholder="Special characters..."
      />
      <ResultDisplay result={result} />
    </div>
  );
};

export default {
  title: 'Advanced / Edge Cases',
};
