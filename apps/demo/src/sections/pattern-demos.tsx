import type {
  CustomSuggestion,
  CustomSuggestionConfig,
  QuerySnapshot,
} from '@kuruwic/tokenized-search-input';
import { TokenizedSearchInput } from '@kuruwic/tokenized-search-input';
import { MaxCount, Unique } from '@kuruwic/tokenized-search-input/utils';
import { useState } from 'react';
import { Presets } from '../components/presets';
import { Readout } from '../components/readout';
import { useEditorSnapshot } from '../components/use-editor-snapshot';
import { CLASSIFIER_FIELDS, createSearchFields, TAG_FIELDS, TAGS } from '../fields';

/** Each demo receives its configuration code to show beside the output. */
type PatternDemoProps = { children: React.ReactNode };

const STATUS_ONLY = createSearchFields().slice(0, 1);

export function DynamicFieldsDemo({ children }: PatternDemoProps) {
  const { ref, snapshot, setSnapshot, load } = useEditorSnapshot();
  return (
    <div className="demo">
      <div className="editor">
        <TokenizedSearchInput
          ref={ref}
          fields={STATUS_ONLY}
          defaultValue="status:is:active customer_tier:is:gold"
          unknownFields={{ operators: ['is', 'contains', 'gt', 'lt'] }}
          onChange={setSnapshot}
          placeholder="Try custom:value or age:gt:18"
          clearable
        />
      </div>
      <Presets
        legend="Load an example"
        presets={[
          { label: 'Known and custom', query: 'status:is:active customer_tier:is:gold' },
          { label: 'Custom operator', query: 'age:gt:18' },
        ]}
        onSelect={load}
      />
      <div className="demo__split">
        {children}
        <Readout
          snapshot={snapshot}
          empty="Only status is declared. Type any other key:value pair and it still parses."
        />
      </div>
    </div>
  );
}

type FreeTextMode = 'none' | 'plain' | 'tokenize';

const FREE_TEXT_MODES: ReadonlyArray<{ mode: FreeTextMode; result: string; placeholder: string }> =
  [
    {
      mode: 'none',
      result: 'Words outside filter syntax are dropped from the submitted query.',
      placeholder: 'Only structured filters are kept',
    },
    {
      mode: 'plain',
      result: 'The phrase stays as one editable plain-text segment.',
      placeholder: 'Text stays as text',
    },
    {
      mode: 'tokenize',
      result: 'Each word becomes its own free-text token.',
      placeholder: 'Words become tokens',
    },
  ];

export function FreeTextDemo({ children }: PatternDemoProps) {
  const [mode, setMode] = useState<FreeTextMode>('tokenize');
  const [snapshot, setSnapshot] = useState<QuerySnapshot | null>(null);
  const active = FREE_TEXT_MODES.find((item) => item.mode === mode) ?? FREE_TEXT_MODES[2];

  return (
    <div className="demo">
      <fieldset className="switch switch--wide">
        <legend className="sr-only">freeTextMode</legend>
        {FREE_TEXT_MODES.map((item) => (
          <button
            type="button"
            key={item.mode}
            aria-pressed={mode === item.mode}
            onClick={() => {
              setMode(item.mode);
              setSnapshot(null);
            }}
          >
            <code>"{item.mode}"</code>
          </button>
        ))}
      </fieldset>
      <div className="editor">
        <TokenizedSearchInput
          key={mode}
          fields={TAG_FIELDS}
          defaultValue="roadmap draft"
          freeTextMode={mode}
          onChange={setSnapshot}
          placeholder={active.placeholder}
          clearable
        />
      </div>
      <p className="demo__note">{active.result}</p>
      <div className="demo__split">
        {children}
        <Readout snapshot={snapshot} empty={`Edit the phrase to see how "${mode}" reports it.`} />
      </div>
    </div>
  );
}

const tagSuggestions: CustomSuggestionConfig = {
  displayMode: 'replace',
  suggest: ({ query }) =>
    TAGS.filter((tag) => tag.toLowerCase().includes(query.toLowerCase())).map((tag) => ({
      tokens: [
        { key: 'tag', operator: 'is' as const, value: tag.toLowerCase(), displayValue: tag },
      ],
      label: tag,
    })),
};

const TAG_RULES = [Unique.rule('exact'), MaxCount.rule('*', 3)];

export function TagsDemo({ children }: PatternDemoProps) {
  const { ref, snapshot, setSnapshot, load } = useEditorSnapshot();
  return (
    <div className="demo">
      <div className="editor">
        <TokenizedSearchInput
          ref={ref}
          fields={TAG_FIELDS}
          defaultValue="tag:is:react tag:is:react"
          freeTextMode="none"
          suggestions={{ field: { disabled: true }, custom: tagSuggestions }}
          validation={{ rules: TAG_RULES }}
          onChange={setSnapshot}
          placeholder="Pick up to three tags"
          clearable
        />
      </div>
      <Presets
        legend="Compare validation states"
        presets={[
          { label: 'Valid', query: 'tag:is:react tag:is:typescript' },
          { label: 'Duplicate', query: 'tag:is:react tag:is:react' },
          {
            label: 'Over the limit',
            query: 'tag:is:react tag:is:typescript tag:is:css tag:is:rust',
          },
        ]}
        onSelect={load}
      />
      <div className="demo__split">
        {children}
        <Readout
          snapshot={snapshot}
          empty="Pick a tag. Duplicates and a fourth tag are rejected."
        />
      </div>
    </div>
  );
}

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const USER_IDS = /^user#\d+(?:[,\s]+user#\d+)*$/;

const classifierSuggestions: CustomSuggestionConfig = {
  displayMode: 'prepend',
  suggest: ({ query }) => {
    if (!query.trim()) return [];
    const suggestions: CustomSuggestion[] = [];
    if (EMAIL.test(query))
      suggestions.push({
        tokens: [{ key: 'email', operator: 'is', value: query }],
        label: `email: ${query}`,
        description: 'Match an exact email',
      });
    const userIds = USER_IDS.test(query) ? (query.match(/user#\d+/g) ?? []) : [];
    if (userIds.length)
      suggestions.push(
        {
          tokens: userIds.map((value) => ({ key: 'assignee', operator: 'is' as const, value })),
          label: `assignee: ${userIds.join(', ')}`,
        },
        {
          tokens: userIds.map((value) => ({ key: 'requester', operator: 'is' as const, value })),
          label: `requester: ${userIds.join(', ')}`,
        }
      );
    if (!suggestions.length)
      suggestions.push({
        tokens: [{ key: 'title', operator: 'contains', value: query }],
        label: `title: “${query}”`,
        description: 'Search within titles',
      });
    return suggestions;
  },
};

const CLASSIFIER_RULES = [
  { shape: 'dev@example.com', becomes: ['email', 'is', 'dev@example.com'] },
  { shape: 'user#123', becomes: ['assignee or requester', 'is', 'user#123'] },
  { shape: 'anything else', becomes: ['title', 'contains', '…'] },
] as const;

export function ClassifierDemo({ children }: PatternDemoProps) {
  const { ref, snapshot, setSnapshot, load } = useEditorSnapshot();
  return (
    <div className="demo">
      <table className="mapping">
        <caption className="sr-only">How typed text is classified</caption>
        <thead>
          <tr>
            <th scope="col">You type</th>
            <th scope="col">Suggested token</th>
          </tr>
        </thead>
        <tbody>
          {CLASSIFIER_RULES.map((rule) => (
            <tr key={rule.shape}>
              <td>
                <code>{rule.shape}</code>
              </td>
              <td>
                <code className="grammar">
                  <span className="g-field">{rule.becomes[0]}</span>:
                  <span className="g-op">{rule.becomes[1]}</span>:
                  <span className="g-value">{rule.becomes[2]}</span>
                </code>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="editor">
        <TokenizedSearchInput
          ref={ref}
          fields={CLASSIFIER_FIELDS}
          suggestions={{ custom: classifierSuggestions }}
          onChange={setSnapshot}
          placeholder="Try user#123 or dev@example.com"
          clearable
        />
      </div>
      <Presets
        legend="Load text, then pick a suggestion"
        presets={[
          { label: 'Email', query: 'dev@example.com' },
          { label: 'One user ID', query: 'user#123' },
          { label: 'Several IDs', query: 'user#123, user#456' },
          { label: 'Anything else', query: 'quarterly plan' },
        ]}
        onSelect={load}
      />
      <div className="demo__split">
        {children}
        <Readout
          snapshot={snapshot}
          empty="Nothing is tokenized until you choose a suggestion. Plain text shows here first."
        />
      </div>
    </div>
  );
}
