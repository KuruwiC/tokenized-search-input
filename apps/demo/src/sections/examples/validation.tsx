import type { FieldDefinition, ValidationRule } from '@kuruwic/tokenized-search-input';
import { TokenizedSearchInput } from '@kuruwic/tokenized-search-input';
import {
  createRule,
  MaxCount,
  RequireEnum,
  RequirePattern,
  Unique,
} from '@kuruwic/tokenized-search-input/utils';
import { Tag, User } from 'lucide-react';
import { useState } from 'react';
import { CodeBlock } from '../../components';
import { TAG_FIELDS } from '../../fields';
import { ExampleDetails, VariantSwitch } from './example';

type RuleId = 'unique' | 'max-count' | 'pattern' | 'enum' | 'custom' | 'combined';

const USER_FIELDS: FieldDefinition[] = [
  {
    key: 'user',
    label: 'User',
    type: 'string',
    operators: ['is'],
    icon: <User className="h-full w-full" />,
  },
];

const STATUS_FIELDS: FieldDefinition[] = [
  {
    key: 'status',
    label: 'Status',
    type: 'enum',
    operators: ['is'],
    enumValues: [
      { value: 'active', label: 'Active' },
      { value: 'inactive', label: 'Inactive' },
      { value: 'pending', label: 'Pending' },
    ],
    icon: <Tag className="h-full w-full" />,
  },
];

const RULES: Array<{
  id: RuleId;
  label: string;
  description: string;
  fields: FieldDefinition[];
  defaultValue?: string;
  placeholder: string;
  rules: ValidationRule[];
  code: string;
}> = [
  {
    id: 'unique',
    label: 'Unique',
    description:
      'Rejects a duplicate token. The constraint is exact, key, or key-operator. Add the same tag twice.',
    fields: TAG_FIELDS,
    placeholder: 'Add tags; duplicates are marked…',
    rules: [Unique.rule('exact')],
    code: "validation={{ rules: [Unique.rule('exact')] }}",
  },
  {
    id: 'max-count',
    label: 'Max count',
    description:
      "Marks every token past the limit. '*' counts all fields; pass a field key to count one field.",
    fields: TAG_FIELDS,
    placeholder: 'Add up to three tags…',
    rules: [MaxCount.rule('*', 3)],
    code: "validation={{ rules: [MaxCount.rule('*', 3)] }}",
  },
  {
    id: 'pattern',
    label: 'Pattern',
    description: 'Only alphanumeric user names pass. Add a value with a dash or a space.',
    fields: USER_FIELDS,
    placeholder: 'Enter alphanumeric user names…',
    rules: [
      RequirePattern.rule('user', /^[a-z0-9]+$/i, undefined, {
        message: 'Only alphanumeric characters allowed',
      }),
    ],
    code: `RequirePattern.rule('user', /^[a-z0-9]+$/i, undefined, {
  message: 'Only alphanumeric characters allowed',
})`,
  },
  {
    id: 'enum',
    label: 'Enum value',
    description:
      'A value outside the field’s enumValues is marked. The second token starts invalid.',
    fields: STATUS_FIELDS,
    defaultValue: 'status:is:active status:is:archived',
    placeholder: 'Only listed statuses are valid…',
    rules: [RequireEnum.rule()],
    code: 'validation={{ rules: [RequireEnum.rule()] }}',
  },
  {
    id: 'custom',
    label: 'Custom rule',
    description:
      'createRule receives each token and returns a message, or null when the token is valid.',
    fields: TAG_FIELDS,
    placeholder: 'Tags need at least three characters…',
    rules: [
      createRule((token) =>
        token.key === 'tag' && token.value.length < 3 ? 'Tag must be at least 3 characters' : null
      ),
    ],
    code: `createRule((token) =>
  token.key === 'tag' && token.value.length < 3
    ? 'Tag must be at least 3 characters'
    : null
)`,
  },
  {
    id: 'combined',
    label: 'Combined',
    description: 'Rules compose: unique tags, five at most.',
    fields: TAG_FIELDS,
    placeholder: 'Add unique tags, five at most…',
    rules: [Unique.rule('exact'), MaxCount.rule('*', 5)],
    code: "validation={{ rules: [Unique.rule('exact'), MaxCount.rule('*', 5)] }}",
  },
];

export function ValidationExample() {
  const [ruleId, setRuleId] = useState<RuleId>('unique');
  const rule = RULES.find((item) => item.id === ruleId) ?? RULES[0];
  return (
    <ExampleDetails
      title="Validation"
      summary="Built-in rules for uniqueness, count, pattern, and enum values, plus createRule for your own."
    >
      <VariantSwitch legend="Rule" options={RULES} value={ruleId} onChange={setRuleId} />
      <p className="example-note">{rule.description}</p>
      <div className="demo-surface">
        <TokenizedSearchInput
          key={rule.id}
          fields={rule.fields}
          defaultValue={rule.defaultValue}
          validation={{ rules: rule.rules }}
          placeholder={rule.placeholder}
          clearable
        />
      </div>
      <CodeBlock code={rule.code} label={`${rule.id}.tsx`} />
    </ExampleDetails>
  );
}
