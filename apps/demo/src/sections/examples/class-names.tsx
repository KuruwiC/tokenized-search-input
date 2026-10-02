import type { FieldDefinition } from '@kuruwic/tokenized-search-input';
import { TokenizedSearchInput } from '@kuruwic/tokenized-search-input';
import { Calendar, Flag, Tag, User } from 'lucide-react';
import { useMemo, useState } from 'react';
import { CodeBlock } from '../../components';
import { createSearchFields } from '../../fields';
import { ExampleDetails, VariantSwitch } from './example';

type PresetId = 'tokens' | 'hover' | 'root' | 'dropdown';

const CATEGORIZED_FIELDS: FieldDefinition[] = [
  {
    key: 'status',
    label: 'Status',
    type: 'enum',
    category: 'Filters',
    operators: ['is', 'is_not'],
    enumValues: ['active', 'inactive', 'pending'],
    icon: <Tag className="h-full w-full" />,
  },
  {
    key: 'priority',
    label: 'Priority',
    type: 'enum',
    category: 'Filters',
    operators: ['is', 'is_not'],
    enumValues: ['high', 'medium', 'low'],
    icon: <Flag className="h-full w-full" />,
  },
  {
    key: 'assignee',
    label: 'Assignee',
    type: 'string',
    category: 'People',
    operators: ['is', 'contains'],
    icon: <User className="h-full w-full" />,
  },
  {
    key: 'created',
    label: 'Created',
    type: 'date',
    category: 'Dates',
    operators: ['gt', 'lt'],
    icon: <Calendar className="h-full w-full" />,
  },
];

const PRESETS: Array<{
  id: PresetId;
  label: string;
  placeholder: string;
  defaultValue: string;
  classNames: Record<string, string>;
}> = [
  {
    id: 'tokens',
    label: 'Token slots',
    placeholder: 'Indigo tokens via classNames…',
    defaultValue: 'status:is:active priority:is:high',
    classNames: {
      token: 'border border-indigo-200 bg-indigo-50',
      tokenLabel: 'font-semibold text-indigo-700',
      tokenOperator: 'text-indigo-500',
      tokenValue: 'bg-indigo-100/50',
      tokenDeleteButton: 'text-indigo-400 hover:text-indigo-600 hover:bg-indigo-200',
    },
  },
  {
    id: 'hover',
    label: 'Hover',
    placeholder: 'Hover over the tokens…',
    defaultValue: 'status:is:active priority:is:high',
    classNames: {
      token: 'hover:shadow-lg hover:border-green-400 transition-shadow',
      tokenLabel: 'hover:text-green-600',
      tokenDeleteButton: 'hover:bg-green-100 hover:text-green-700',
    },
  },
  {
    id: 'root',
    label: 'Root and input',
    placeholder: 'Narrow, centered root with a ring…',
    defaultValue: 'status:is:active',
    classNames: {
      root: 'mx-auto max-w-md rounded-lg shadow-lg ring-1 ring-purple-300',
      input: 'text-purple-700',
      placeholder: 'text-purple-300',
    },
  },
  {
    id: 'dropdown',
    label: 'Dropdown',
    placeholder: 'Type to open the styled dropdown…',
    defaultValue: '',
    classNames: {
      dropdown: 'border-2 border-purple-200 rounded-xl',
      suggestionItem: 'hover:bg-purple-100',
      fieldCategory: 'text-purple-600 font-bold',
    },
  },
];

const toSnippet = (classNames: Record<string, string>) =>
  `<TokenizedSearchInput\n  classNames={{\n${Object.entries(classNames)
    .map(([slot, value]) => `    ${slot}: '${value}',`)
    .join('\n')}\n  }}\n/>`;

export function ClassNamesExample() {
  const [presetId, setPresetId] = useState<PresetId>('tokens');
  const basicFields = useMemo(createSearchFields, []);
  const preset = PRESETS.find((item) => item.id === presetId) ?? PRESETS[0];
  return (
    <ExampleDetails
      title="classNames"
      summary="Attach utility classes to individual slots: root (the outer element, for size, spacing and outline), input, token parts, and dropdown parts."
    >
      <VariantSwitch
        legend="Slot group"
        options={PRESETS}
        value={presetId}
        onChange={setPresetId}
      />
      <div className="demo-surface">
        <TokenizedSearchInput
          key={preset.id}
          fields={preset.id === 'dropdown' ? CATEGORIZED_FIELDS : basicFields}
          defaultValue={preset.defaultValue}
          classNames={preset.classNames}
          placeholder={preset.placeholder}
        />
      </div>
      <CodeBlock code={toSnippet(preset.classNames)} label="classNames.tsx" />
      <p className="example-note">
        Slots: <code>root</code>, <code>input</code>, <code>placeholder</code>,{' '}
        <code>clearButton</code>, <code>startAdornment</code>, <code>endAdornment</code>,{' '}
        <code>token</code>, <code>tokenLabel</code>, <code>tokenOperator</code>,{' '}
        <code>tokenValue</code>, <code>tokenDeleteButton</code>, <code>dropdown</code>,{' '}
        <code>operatorDropdown</code>, <code>operatorDropdownItem</code>,{' '}
        <code>suggestionItem</code>, <code>suggestionItemHint</code>,{' '}
        <code>suggestionItemDescription</code>, <code>suggestionItemIcon</code>,{' '}
        <code>fieldCategory</code>, <code>divider</code>.
      </p>
    </ExampleDetails>
  );
}
