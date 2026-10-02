import type { TokenizedSearchInputRef } from '@kuruwic/tokenized-search-input';
import { TokenizedSearchInput } from '@kuruwic/tokenized-search-input';
import type {
  CustomSuggestion,
  CustomSuggestionConfig,
  QuerySnapshot,
} from '@kuruwic/tokenized-search-input/utils';
import { MaxCount, Unique } from '@kuruwic/tokenized-search-input/utils';
import { useMemo, useRef, useState } from 'react';
import { PresetButtons, Snapshot, setDemoValue } from '../components';
import { CLASSIFIER_FIELDS, createSearchFields, TAG_FIELDS, TAGS } from '../fields';

export function UnknownFieldsDemo() {
  const inputRef = useRef<TokenizedSearchInputRef>(null);
  const [snapshot, setSnapshot] = useState<QuerySnapshot | null>(null);
  return (
    <div className="demo-stack">
      <div className="demo-surface">
        <TokenizedSearchInput
          ref={inputRef}
          fields={createSearchFields().slice(0, 1)}
          defaultValue="status:is:active customer_tier:is:gold"
          unknownFields={{ operators: ['is', 'contains', 'gt', 'lt'] }}
          onChange={setSnapshot}
          placeholder="Try custom:value or age:gt:18…"
          clearable
        />
      </div>
      <PresetButtons
        legend="Load an example"
        presets={[
          { label: 'Known + custom', value: 'status:is:active customer_tier:is:gold' },
          { label: 'Custom operator', value: 'age:gt:18' },
        ]}
        onSelect={(value) => setDemoValue(inputRef, value, setSnapshot)}
      />
      <Snapshot value={snapshot} empty="Known and ad-hoc fields share the same query." />
    </div>
  );
}

export function FreeTextDemo() {
  const [mode, setMode] = useState<'none' | 'plain' | 'tokenize'>('tokenize');
  const [snapshot, setSnapshot] = useState<QuerySnapshot | null>(null);
  return (
    <div className="demo-stack">
      <fieldset className="segmented-control">
        <legend className="sr-only">Free text behavior</legend>
        {(['none', 'plain', 'tokenize'] as const).map((item) => (
          <button
            type="button"
            key={item}
            aria-pressed={mode === item}
            onClick={() => {
              setMode(item);
              setSnapshot(null);
            }}
          >
            {item}
          </button>
        ))}
      </fieldset>
      <div className="demo-surface">
        <TokenizedSearchInput
          key={mode}
          fields={TAG_FIELDS}
          defaultValue="roadmap draft"
          freeTextMode={mode}
          onChange={setSnapshot}
          placeholder={
            mode === 'none'
              ? 'Only structured filters…'
              : mode === 'plain'
                ? 'Text stays as text…'
                : 'Words become tokens…'
          }
          clearable
        />
      </div>
      <p className="mode-result">
        {mode === 'none'
          ? 'Unstructured words are ignored when the query is submitted.'
          : mode === 'plain'
            ? 'The phrase remains an editable plaintext segment.'
            : 'Each word becomes a separately editable free-text token.'}
      </p>
      <Snapshot
        value={snapshot}
        empty={`Mode “${mode}” is active. Type a phrase to compare the output.`}
      />
    </div>
  );
}

export function TagsDemo() {
  const inputRef = useRef<TokenizedSearchInputRef>(null);
  const [snapshot, setSnapshot] = useState<QuerySnapshot | null>(null);
  const custom = useMemo<CustomSuggestionConfig>(
    () => ({
      displayMode: 'replace',
      suggest: ({ query }) =>
        TAGS.filter((tag) => tag.toLowerCase().includes(query.toLowerCase())).map((tag) => ({
          tokens: [
            { key: 'tag', operator: 'is' as const, value: tag.toLowerCase(), displayValue: tag },
          ],
          label: tag,
        })),
    }),
    []
  );
  return (
    <div className="demo-stack">
      <div className="rule-strip">
        <span>
          <b>UNIQUE</b> exact token
        </span>
        <span>
          <b>MAX</b> 3 tokens
        </span>
      </div>
      <div className="demo-surface">
        <TokenizedSearchInput
          ref={inputRef}
          fields={TAG_FIELDS}
          defaultValue="tag:is:react tag:is:react"
          freeTextMode="none"
          suggestions={{ field: { disabled: true }, custom }}
          validation={{ rules: [Unique.rule('exact'), MaxCount.rule('*', 3)] }}
          onChange={setSnapshot}
          placeholder="Select up to three tags…"
          clearable
        />
      </div>
      <PresetButtons
        legend="Compare validation states"
        presets={[
          { label: 'Valid', value: 'tag:is:react tag:is:typescript' },
          { label: 'Duplicate', value: 'tag:is:react tag:is:react' },
          { label: 'Over limit', value: 'tag:is:react tag:is:typescript tag:is:css tag:is:rust' },
        ]}
        onSelect={(value) => setDemoValue(inputRef, value, setSnapshot)}
      />
      <Snapshot
        value={snapshot}
        empty="Validation prevents duplicates and limits the selection to three."
      />
    </div>
  );
}

export function ClassifierDemo() {
  const inputRef = useRef<TokenizedSearchInputRef>(null);
  const [snapshot, setSnapshot] = useState<QuerySnapshot | null>(null);
  const custom = useMemo<CustomSuggestionConfig>(
    () => ({
      displayMode: 'prepend',
      suggest: ({ query }) => {
        if (!query.trim()) return [];
        const suggestions: CustomSuggestion[] = [];
        if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(query))
          suggestions.push({
            tokens: [{ key: 'email', operator: 'is', value: query }],
            label: `email: ${query}`,
            description: 'Match an exact email',
          });
        const userIds = /^user#\d+(?:[,\s]+user#\d+)*$/.test(query)
          ? (query.match(/user#\d+/g) ?? [])
          : [];
        if (userIds.length)
          suggestions.push(
            {
              tokens: userIds.map((value) => ({ key: 'assignee', operator: 'is' as const, value })),
              label: `assignee: ${userIds.join(', ')}`,
            },
            {
              tokens: userIds.map((value) => ({
                key: 'requester',
                operator: 'is' as const,
                value,
              })),
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
    }),
    []
  );
  return (
    <div className="demo-stack">
      <dl className="classifier-map">
        <div>
          <dt>Email shape</dt>
          <dd>
            <code>email:is:dev@example.com</code>
          </dd>
        </div>
        <div>
          <dt>user# IDs</dt>
          <dd>
            <code>assignee:is:…</code> or <code>requester:is:…</code>
          </dd>
        </div>
        <div>
          <dt>Anything else</dt>
          <dd>
            <code>title:contains:…</code>
          </dd>
        </div>
      </dl>
      <div className="demo-surface">
        <TokenizedSearchInput
          ref={inputRef}
          fields={CLASSIFIER_FIELDS}
          suggestions={{ custom }}
          onChange={setSnapshot}
          placeholder="Try user#123 or dev@example.com…"
          clearable
        />
      </div>
      <PresetButtons
        legend="Type a shape, then choose the suggested token"
        presets={[
          { label: 'Email', value: 'dev@example.com' },
          { label: 'One user ID', value: 'user#123' },
          { label: 'Multiple IDs', value: 'user#123, user#456' },
          { label: 'Fallback title', value: 'quarterly plan' },
        ]}
        onSelect={(value) => setDemoValue(inputRef, value, setSnapshot)}
      />
      <Snapshot
        value={snapshot}
        empty="The suggestion strategy can classify a value before choosing a field."
      />
    </div>
  );
}
