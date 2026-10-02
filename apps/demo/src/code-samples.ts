export const BASIC_CODE = `import { type FieldDefinition, TokenizedSearchInput } from '@kuruwic/tokenized-search-input';
import '@kuruwic/tokenized-search-input/styles';

const fields: FieldDefinition[] = [
  {
    key: 'status',
    label: 'Status',
    type: 'enum',
    operators: ['is', 'is_not'],
    enumValues: ['active', 'inactive', 'pending'],
  },
  {
    key: 'title',
    label: 'Title',
    type: 'string',
    operators: ['contains'],
    allowSpaces: true,
  },
];

export function IssueSearch() {
  return (
    <TokenizedSearchInput
      fields={fields}
      onSubmit={({ text }) => console.log(text)}
      placeholder="Filter issues…"
      clearable
    />
  );
}`;

export const UNKNOWN_FIELDS_CODE = `<TokenizedSearchInput
  fields={fields}
  unknownFields={{
    operators: ['is', 'contains', 'gt', 'lt'],
  }}
/>

// custom:value    → custom:is:value
// age:gt:18       → age:gt:18`;

export const FREE_TEXT_CODE = `<TokenizedSearchInput
  fields={fields}
  freeTextMode="tokenize" // "none" | "plain" | "tokenize"
/>

// none: discard unstructured text on submit
// plain: preserve text beside filter tokens
// tokenize: turn words into free-text tokens`;

export const TAGS_CODE = `const tagField = {
  key: 'tag',
  label: 'Tag',
  type: 'string',
  operators: ['is'],
  tokenLabelDisplay: 'hidden',
  hideSingleOperator: true,
};

<TokenizedSearchInput
  fields={[tagField]}
  freeTextMode="none"
  suggestions={{ field: { disabled: true }, custom }}
  validation={{ rules: [Unique.rule('exact'), MaxCount.rule('*', 3)] }}
/>`;

export const CLASSIFIER_CODE = `const custom: CustomSuggestionConfig = {
  displayMode: 'prepend',
  suggest: ({ query }) => {
    if (/^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$/.test(query)) {
      return [{
        tokens: [{ key: 'email', operator: 'is', value: query }],
        label: \`email: \${query}\`,
      }];
    }

    const userIds = /^user#\\d+(?:[,\\s]+user#\\d+)*$/.test(query)
      ? query.match(/user#\\d+/g) ?? []
      : [];

    if (userIds.length) {
      return [
        {
          tokens: userIds.map(value => ({
            key: 'assignee', operator: 'is', value,
          })),
          label: \`assignee: \${userIds.join(', ')}\`,
        },
        {
          tokens: userIds.map(value => ({
            key: 'requester', operator: 'is', value,
          })),
          label: \`requester: \${userIds.join(', ')}\`,
        },
      ];
    }

    return [{
      tokens: [{ key: 'title', operator: 'contains', value: query }],
      label: \`title: "\${query}"\`,
    }];
  },
};`;

export const COUNTRY_CODE = `const toSuggestion = (country: Country) => ({
  tokens: [{
    key: 'country',
    operator: 'is' as const,
    value: country.value,
    displayValue: country.label,
    startContent: <span>{country.emoji}</span>,
  }],
  label: \`\${country.emoji} \${country.label}\`,
});

const custom: CustomSuggestionConfig = {
  displayMode: 'replace',
  debounceMs: 150,
  suggest: async ({ query }) => {
    const { countries, hasMore } = await fetchCountries({
      query, offset: 0, limit: 10,
    });
    return { suggestions: countries.map(toSuggestion), hasMore };
  },
  loadMore: async ({ query, offset, limit }) => {
    const { countries, hasMore } = await fetchCountries({ query, offset, limit });
    return { suggestions: countries.map(toSuggestion), hasMore };
  },
  onSelect: createToggleSelectHandler(),
};

const { resolveTokens } = useAsyncTokenResolver({
  inputRef,
  fieldKey: 'country',
  resolve: async (values) =>
    (await fetchCountries({ values, offset: 0, limit: values.length })).countries,
  getValue: (country) => country.value,
  getDisplayData: (country) => ({
    displayValue: country.label,
    startContent: <span>{country.emoji}</span>,
  }),
});

const onChange = (snapshot: QuerySnapshot) => {
  setSnapshot(snapshot);
  void resolveTokens();
};`;
