import type { FieldDefinition } from '@kuruwic/tokenized-search-input';
import { TokenizedSearchInput } from '@kuruwic/tokenized-search-input';
import { Flag, Tag } from 'lucide-react';
import { useMemo, useState } from 'react';
import { CodeBlock } from '../../components/code-block';
import { ExampleDetails, VariantSwitch } from './example';

type DisplayId = 'auto' | 'icon-only' | 'hidden';

const DISPLAYS: Array<{ id: DisplayId; label: string; description: string; value: string }> = [
  {
    id: 'auto',
    label: 'auto',
    description: 'Icon and label text. This is the default.',
    value: 'status:is:active priority:is:high',
  },
  {
    id: 'icon-only',
    label: 'icon-only',
    description: 'Icon without label text. A field without an icon falls back to its label.',
    value: 'status:is:active priority:is:high',
  },
  {
    id: 'hidden',
    label: 'hidden',
    description: 'Only the value, which suits tag-like fields. Pair it with hideSingleOperator.',
    value: 'tag:is:react tag:is:typescript',
  },
];

const createFields = (display: DisplayId): FieldDefinition[] =>
  display === 'hidden'
    ? [
        {
          key: 'tag',
          label: 'Tag',
          type: 'enum',
          operators: ['is'],
          enumValues: ['react', 'typescript', 'javascript', 'vue'],
          icon: <Tag className="h-full w-full" />,
          tokenLabelDisplay: 'hidden',
          hideSingleOperator: true,
        },
      ]
    : [
        {
          key: 'status',
          label: 'Status',
          type: 'enum',
          operators: ['is', 'is_not'],
          enumValues: ['active', 'inactive', 'pending'],
          icon: <Tag className="h-full w-full" />,
          tokenLabelDisplay: display,
        },
        {
          key: 'priority',
          label: 'Priority',
          type: 'enum',
          operators: ['is'],
          enumValues: ['high', 'medium', 'low'],
          icon: <Flag className="h-full w-full" />,
          tokenLabelDisplay: display,
        },
      ];

export function TokenDisplayExample() {
  const [displayId, setDisplayId] = useState<DisplayId>('icon-only');
  const display = DISPLAYS.find((item) => item.id === displayId) ?? DISPLAYS[0];
  const fields = useMemo(() => createFields(display.id), [display.id]);
  return (
    <ExampleDetails
      title="Token display"
      summary="Choose how a token shows its field with tokenLabelDisplay."
    >
      <VariantSwitch
        legend="tokenLabelDisplay"
        options={DISPLAYS}
        value={displayId}
        onChange={setDisplayId}
      />
      <p className="example-note">{display.description}</p>
      <div className="demo-surface">
        <TokenizedSearchInput
          key={display.id}
          fields={fields}
          defaultValue={display.value}
          placeholder="Select a field…"
          clearable
        />
      </div>
      <CodeBlock
        code={`const field = {\n  key: '${display.id === 'hidden' ? 'tag' : 'status'}',\n  tokenLabelDisplay: '${display.id}',\n  // …\n};`}
        label="field.tsx"
      />
      <p className="example-note">
        Tokens can also carry <code>startContent</code> and an <code>immutable</code> field flag;
        the country selector above uses both.
      </p>
    </ExampleDetails>
  );
}
