import type { FieldDefinition } from '@kuruwic/tokenized-search-input';
import { TokenizedSearchInput } from '@kuruwic/tokenized-search-input';
import { Calendar, Flag, Search, Tag } from 'lucide-react';
import { useState } from 'react';
import { CodeBlock } from '../../components';
import { ExampleDetails, VariantSwitch } from './example';

type OperatorSetId = 'string' | 'comparison' | 'custom' | 'labels' | 'single';

const OPERATOR_SETS: Array<{
  id: OperatorSetId;
  label: string;
  description: string;
  fields: FieldDefinition[];
  defaultValue?: string;
  code: string;
}> = [
  {
    id: 'string',
    label: 'String',
    description: 'is, is_not, contains, starts_with, and ends_with match text.',
    fields: [
      {
        key: 'title',
        label: 'Title',
        type: 'string',
        operators: ['is', 'is_not', 'contains', 'starts_with', 'ends_with'],
        allowSpaces: true,
        icon: <Search className="h-full w-full" />,
      },
    ],
    code: "operators: ['is', 'is_not', 'contains', 'starts_with', 'ends_with']",
  },
  {
    id: 'comparison',
    label: 'Comparison',
    description: 'Date fields compare with gt, lt, gte, and lte.',
    fields: [
      {
        key: 'created',
        label: 'Created',
        type: 'date',
        operators: ['gt', 'lt', 'gte', 'lte'],
        icon: <Calendar className="h-full w-full" />,
      },
    ],
    code: "operators: ['gt', 'lt', 'gte', 'lte']",
  },
  {
    id: 'custom',
    label: 'Custom',
    description:
      'Any operator string works like a built-in one; your application defines its meaning.',
    fields: [
      {
        key: 'tag',
        label: 'Tag',
        type: 'string',
        operators: ['includes', 'excludes', 'matches'],
        icon: <Tag className="h-full w-full" />,
      },
    ],
    code: "operators: ['includes', 'excludes', 'matches']",
  },
  {
    id: 'labels',
    label: 'Labels',
    description:
      'operatorLabels replaces technical names: display is shown in the token, select in the operator menu.',
    fields: [
      {
        key: 'created',
        label: 'Created',
        type: 'date',
        operators: ['gt', 'lt', 'gte', 'lte'],
        icon: <Calendar className="h-full w-full" />,
        operatorLabels: {
          gt: { display: 'after', select: 'is after' },
          lt: { display: 'before', select: 'is before' },
          gte: { display: 'from', select: 'is on or after' },
          lte: { display: 'until', select: 'is on or before' },
        },
      },
    ],
    code: `operatorLabels: {
  gt: { display: 'after', select: 'is after' },
  lt: { display: 'before', select: 'is before' },
}`,
  },
  {
    id: 'single',
    label: 'Hide single operator',
    description:
      'With hideSingleOperator, a field that has one operator omits it: Tag shows no operator, Status keeps it.',
    fields: [
      {
        key: 'tag',
        label: 'Tag',
        type: 'enum',
        operators: ['is'],
        enumValues: ['react', 'typescript', 'javascript'],
        icon: <Tag className="h-full w-full" />,
        hideSingleOperator: true,
      },
      {
        key: 'status',
        label: 'Status',
        type: 'enum',
        operators: ['is', 'is_not'],
        enumValues: ['active', 'inactive'],
        icon: <Flag className="h-full w-full" />,
        hideSingleOperator: true,
      },
    ],
    defaultValue: 'tag:is:react status:is:active',
    code: 'hideSingleOperator: true',
  },
];

export function OperatorsExample() {
  const [setId, setSetId] = useState<OperatorSetId>('string');
  const set = OPERATOR_SETS.find((item) => item.id === setId) ?? OPERATOR_SETS[0];
  return (
    <ExampleDetails
      title="Operators"
      summary="Each field declares its operators; labels and visibility are configurable."
    >
      <VariantSwitch
        legend="Operator set"
        options={OPERATOR_SETS}
        value={setId}
        onChange={setSetId}
      />
      <p className="example-note">{set.description}</p>
      <div className="demo-surface">
        <TokenizedSearchInput
          key={set.id}
          fields={set.fields}
          defaultValue={set.defaultValue}
          placeholder="Pick a field, then an operator…"
          clearable
        />
      </div>
      <CodeBlock code={set.code} label={`${set.id}.tsx`} />
    </ExampleDetails>
  );
}
