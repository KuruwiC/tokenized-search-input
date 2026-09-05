import type { TokenizedSearchInputRef } from '@kuruwic/tokenized-search-input';
import { TokenizedSearchInput, useAsyncTokenResolver } from '@kuruwic/tokenized-search-input';
import type {
  CustomSuggestion,
  CustomSuggestionConfig,
  FieldDefinition,
  ParsedToken,
  QuerySnapshot,
} from '@kuruwic/tokenized-search-input/utils';
import { createToggleSelectHandler, MaxCount, Unique } from '@kuruwic/tokenized-search-input/utils';
import {
  Calendar,
  Check,
  Clock,
  Copy,
  FileText,
  Flag,
  Globe,
  Loader2,
  Moon,
  Search,
  Sun,
  Tag,
  User,
} from 'lucide-react';
import { Highlight, type Language, themes } from 'prism-react-renderer';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ALL_COUNTRIES, type Country, fetchCountries } from './countries';

const REPOSITORY_URL = 'https://github.com/KuruwiC/tokenized-search-input';

const createSearchFields = (): FieldDefinition[] => [
  {
    key: 'status',
    label: 'Status',
    type: 'enum',
    operators: ['is'],
    enumValues: ['active', 'inactive', 'pending'],
    icon: <Tag className="h-full w-full" />,
  },
  {
    key: 'priority',
    label: 'Priority',
    type: 'enum',
    operators: ['is', 'is_not'],
    enumValues: ['high', 'medium', 'low'],
    icon: <Flag className="h-full w-full" />,
  },
  {
    key: 'title',
    label: 'Title',
    type: 'string',
    operators: ['contains', 'starts_with', 'ends_with'],
    allowSpaces: true,
    icon: <Search className="h-full w-full" />,
  },
  {
    key: 'created',
    label: 'Created',
    type: 'date',
    operators: ['gt', 'lt', 'gte', 'lte'],
    icon: <Calendar className="h-full w-full" />,
    operatorLabels: {
      gt: { display: 'after', select: 'after' },
      lt: { display: 'before', select: 'before' },
      gte: { display: 'from', select: 'from' },
      lte: { display: 'until', select: 'until' },
    },
  },
  {
    key: 'updated',
    label: 'Updated',
    type: 'datetime',
    operators: ['gt', 'lt'],
    icon: <Clock className="h-full w-full" />,
  },
];

const TAG_FIELDS: FieldDefinition[] = [
  {
    key: 'tag',
    label: 'Tag',
    type: 'string',
    operators: ['is'],
    tokenLabelDisplay: 'hidden',
    hideSingleOperator: true,
    icon: <Tag className="h-full w-full" />,
  },
];

const COUNTRY_FIELDS: FieldDefinition[] = [
  {
    key: 'country',
    label: 'Country',
    type: 'string',
    operators: ['is'],
    tokenLabelDisplay: 'hidden',
    hideSingleOperator: true,
    immutable: true,
    icon: <Globe className="h-full w-full" />,
  },
];

const CLASSIFIER_FIELDS: FieldDefinition[] = [
  {
    key: 'assignee',
    label: 'Assignee',
    type: 'string',
    operators: ['is'],
    icon: <User className="h-full w-full" />,
  },
  {
    key: 'requester',
    label: 'Requester',
    type: 'string',
    operators: ['is'],
    icon: <User className="h-full w-full" />,
  },
  {
    key: 'email',
    label: 'Email',
    type: 'string',
    operators: ['is'],
    icon: <User className="h-full w-full" />,
  },
  {
    key: 'title',
    label: 'Title',
    type: 'string',
    operators: ['contains'],
    allowSpaces: true,
    icon: <FileText className="h-full w-full" />,
  },
];

const TAGS = [
  'React',
  'TypeScript',
  'JavaScript',
  'Node.js',
  'Next.js',
  'Vue',
  'Svelte',
  'CSS',
  'Rust',
  'Go',
];

const BASIC_CODE = `import { TokenizedSearchInput } from '@kuruwic/tokenized-search-input';
import '@kuruwic/tokenized-search-input/styles';

const fields = [
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
      onSubmit={(query) => fetchIssues(query.text)}
      placeholder="Filter issues…"
      clearable
    />
  );
}`;

const UNKNOWN_FIELDS_CODE = `<TokenizedSearchInput
  fields={fields}
  unknownFields={{
    allow: true,
    operators: ['is', 'contains', 'gt', 'lt'],
  }}
/>

// custom:value    → custom:is:value
// age:gt:18       → age:gt:18`;

const FREE_TEXT_CODE = `<TokenizedSearchInput
  fields={fields}
  freeTextMode="tokenize" // "none" | "plain" | "tokenize"
/>

// none: discard unstructured text on submit
// plain: preserve text beside filter tokens
// tokenize: turn words into free-text tokens`;

const TAGS_CODE = `const tagField = {
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

const CLASSIFIER_CODE = `const custom: CustomSuggestionConfig = {
  displayMode: 'prepend',
  suggest: ({ query }) => {
    if (looksLikeEmail(query)) {
      return [{
        tokens: [{ key: 'email', operator: 'is', value: query }],
        label: \`email: \${query}\`,
      }];
    }

    return [{
      tokens: [{ key: 'title', operator: 'contains', value: query }],
      label: \`title: "\${query}"\`,
    }];
  },
};`;

const COUNTRY_CODE = `const custom: CustomSuggestionConfig = {
  displayMode: 'replace',
  debounceMs: 150,
  suggest: ({ query }) => fetchCountries({ query, offset: 0, limit: 10 }),
  loadMore: ({ query, offset, limit }) => fetchCountries({ query, offset, limit }),
  onSelect: createToggleSelectHandler(),
};

const { resolveTokens } = useAsyncTokenResolver({
  inputRef,
  fieldKey: 'country',
  resolve: fetchCountriesByCode,
  getValue: (country) => country.value,
  getDisplayData: (country) => ({
    displayValue: country.label,
    startContent: <span>{country.emoji}</span>,
  }),
});`;

type CodeBlockProps = { code: string; label: string; language?: Language; collapsed?: boolean };

function CodeBlock({ code, label, language = 'tsx', collapsed = false }: CodeBlockProps) {
  const [copyState, setCopyState] = useState<'idle' | 'copied' | 'failed'>('idle');
  const copy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopyState('copied');
    } catch {
      setCopyState('failed');
    }
    window.setTimeout(() => setCopyState('idle'), 1800);
  }, [code]);

  const block = (
    <figure className="code-window">
      <figcaption className="code-toolbar">
        <span>{label}</span>
        <span className="code-language">{language}</span>
        <button type="button" onClick={copy} className="code-copy">
          {copyState === 'copied' ? <Check aria-hidden="true" /> : <Copy aria-hidden="true" />}
          <span>
            {copyState === 'copied' ? 'Copied' : copyState === 'failed' ? 'Copy failed' : 'Copy'}
          </span>
        </button>
        <span className="sr-only" aria-live="polite">
          {copyState === 'copied'
            ? 'Code copied to clipboard'
            : copyState === 'failed'
              ? 'Code could not be copied'
              : ''}
        </span>
      </figcaption>
      <Highlight theme={themes.vsDark} code={code.trim()} language={language}>
        {({ tokens, getLineProps, getTokenProps }) => (
          <pre className="code-block">
            <code>
              {tokens.map((line, index) => (
                // biome-ignore lint/suspicious/noArrayIndexKey: Highlighted source lines are immutable and can repeat.
                <span {...getLineProps({ line })} className="code-line" key={`${label}-${index}`}>
                  <span className="line-number" aria-hidden="true">
                    {index + 1}
                  </span>
                  <span className="line-content">
                    {line.map((token, tokenIndex) => (
                      // biome-ignore lint/suspicious/noArrayIndexKey: Prism tokens have no stable identifier and never reorder.
                      <span {...getTokenProps({ token })} key={`${label}-${index}-${tokenIndex}`} />
                    ))}
                  </span>
                </span>
              ))}
            </code>
          </pre>
        )}
      </Highlight>
    </figure>
  );
  if (!collapsed) return block;
  return (
    <details className="code-details">
      <summary>Inspect the implementation</summary>
      {block}
    </details>
  );
}

function ThemeToggle() {
  const [isDark, setIsDark] = useState(false);
  useEffect(() => {
    const stored = window.localStorage.getItem('demo-theme');
    const next = stored
      ? stored === 'dark'
      : window.matchMedia('(prefers-color-scheme: dark)').matches;
    setIsDark(next);
    document.documentElement.classList.toggle('dark', next);
  }, []);
  const toggle = useCallback(() => {
    setIsDark((current) => {
      const next = !current;
      document.documentElement.classList.toggle('dark', next);
      window.localStorage.setItem('demo-theme', next ? 'dark' : 'light');
      return next;
    });
  }, []);
  return (
    <button
      type="button"
      onClick={toggle}
      className="icon-button"
      aria-label={isDark ? 'Use light theme' : 'Use dark theme'}
    >
      {isDark ? <Sun aria-hidden="true" /> : <Moon aria-hidden="true" />}
    </button>
  );
}

function Snapshot({ value, empty }: { value: QuerySnapshot | null; empty: string }) {
  const displayValue = value
    ? {
        text: value.text,
        segments: value.segments.map((segment) =>
          segment.type === 'filter'
            ? {
                type: segment.type,
                key: segment.key,
                operator: segment.operator,
                value: segment.value,
                ...(segment.invalid ? { invalid: true, reason: segment.invalidReason } : {}),
              }
            : { type: segment.type, value: segment.value }
        ),
      }
    : null;

  return (
    <div className="snapshot" aria-live="polite">
      <div className="snapshot-label">QUERY SNAPSHOT</div>
      {displayValue ? <pre>{JSON.stringify(displayValue, null, 2)}</pre> : <p>{empty}</p>}
    </div>
  );
}

function SearchWorkbench() {
  const fields = useMemo(createSearchFields, []);
  const inputRef = useRef<TokenizedSearchInputRef>(null);
  const [snapshot, setSnapshot] = useState<QuerySnapshot | null>(null);
  const examples = [
    ['Open work', 'status:is:active priority:is_not:low'],
    ['Recent bugs', 'title:contains:"bug report" created:gt:2026-01-01'],
    ['Updated today', 'updated:gt:2026-09-05T00:00'],
  ] as const;
  const load = (query: string) => {
    inputRef.current?.setValue(query);
    setSnapshot(inputRef.current?.getSnapshot() ?? null);
    inputRef.current?.focus();
  };
  return (
    <div className="workbench-grid">
      <div className="workbench-input">
        <h2 id="playground-title">Build a query, one decision at a time.</h2>
        <p>Pick a field, choose its operator, then enter a value. Every token remains editable.</p>
        <div className="demo-surface focus-surface">
          <TokenizedSearchInput
            ref={inputRef}
            fields={fields}
            onChange={setSnapshot}
            onSubmit={setSnapshot}
            placeholder="Start with status:, priority:, title:…"
            clearable
          />
        </div>
        <fieldset className="example-queries">
          <legend className="sr-only">Example queries</legend>
          {examples.map(([label, query]) => (
            <button type="button" key={label} onClick={() => load(query)}>
              <span>{label}</span>
              <code>{query}</code>
            </button>
          ))}
        </fieldset>
        <p className="keyboard-note">
          <kbd>↑</kbd>
          <kbd>↓</kbd> suggestions · <kbd>Enter</kbd> select · <kbd>Backspace</kbd> edit
        </p>
      </div>
      <Snapshot value={snapshot} empty="The parsed query will appear here as you type." />
    </div>
  );
}

function UnknownFieldsDemo() {
  const [snapshot, setSnapshot] = useState<QuerySnapshot | null>(null);
  return (
    <div className="demo-stack">
      <div className="demo-surface">
        <TokenizedSearchInput
          fields={createSearchFields().slice(0, 1)}
          unknownFields={{ allow: true, operators: ['is', 'contains', 'gt', 'lt'] }}
          onChange={setSnapshot}
          placeholder="Try custom:value or age:gt:18…"
          clearable
        />
      </div>
      <Snapshot value={snapshot} empty="Known and ad-hoc fields share the same query." />
    </div>
  );
}

function FreeTextDemo() {
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
      <Snapshot
        value={snapshot}
        empty={`Mode “${mode}” is active. Type a phrase to compare the output.`}
      />
    </div>
  );
}

function TagsDemo() {
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
      <div className="demo-surface">
        <TokenizedSearchInput
          fields={TAG_FIELDS}
          freeTextMode="none"
          suggestions={{ field: { disabled: true }, custom }}
          validation={{ rules: [Unique.rule('exact'), MaxCount.rule('*', 3)] }}
          onChange={setSnapshot}
          placeholder="Select up to three tags…"
          clearable
        />
      </div>
      <Snapshot
        value={snapshot}
        empty="Validation prevents duplicates and limits the selection to three."
      />
    </div>
  );
}

function ClassifierDemo() {
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
      <div className="demo-surface">
        <TokenizedSearchInput
          fields={CLASSIFIER_FIELDS}
          suggestions={{ custom }}
          onChange={setSnapshot}
          placeholder="Try user#123 or dev@example.com…"
          clearable
        />
      </div>
      <Snapshot
        value={snapshot}
        empty="The suggestion strategy can classify a value before choosing a field."
      />
    </div>
  );
}

const countrySuggestion = (country: Country, selected: boolean) => ({
  tokens: [
    {
      key: 'country',
      operator: 'is' as const,
      value: country.value,
      displayValue: country.label,
      startContent: <span>{country.emoji}</span>,
    },
  ],
  label: `${country.emoji} ${country.label}`,
  confidence: selected ? 1 : 0.9,
  endContent: selected ? <span className="selected-mark">✓</span> : undefined,
});

function CountryDemo() {
  const inputRef = useRef<TokenizedSearchInputRef>(null);
  const [snapshot, setSnapshot] = useState<QuerySnapshot | null>(null);
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
    loadingContent: {
      displayValue: 'Loading…',
      startContent: <Loader2 className="h-full w-full animate-spin" />,
    },
  });
  const serializeToken = useCallback(
    (token: { key: string; value: string }) =>
      token.key === 'country'
        ? (ALL_COUNTRIES.find((country) => country.value === token.value)?.label ?? null)
        : null,
    []
  );
  const deserializeText = useCallback((text: string): ParsedToken[] | null => {
    const tokens: ParsedToken[] = [];
    let remaining = text.trim();
    const candidates = [...ALL_COUNTRIES].sort((a, b) => b.label.length - a.label.length);

    while (remaining) {
      const match = candidates.find((country) => {
        const source = remaining.toLowerCase();
        const label = country.label.toLowerCase();
        const code = country.value.toLowerCase();
        const boundaryAfter = (length: number) =>
          !remaining[length] || /[\s,;]/.test(remaining[length]);
        return (
          (source.startsWith(label) && boundaryAfter(label.length)) ||
          (source.startsWith(code) && boundaryAfter(code.length))
        );
      });

      if (match) {
        tokens.push({ type: 'filter', key: 'country', operator: 'is', value: match.value });
        const consumed = remaining.toLowerCase().startsWith(match.label.toLowerCase())
          ? match.label.length
          : match.value.length;
        remaining = remaining.slice(consumed).replace(/^[\s,;]+/, '');
        continue;
      }

      const boundary = remaining.search(/[\s,;]/);
      if (boundary === -1) break;
      remaining = remaining.slice(boundary).replace(/^[\s,;]+/, '');
    }

    return tokens.length ? tokens : null;
  }, []);
  const custom = useMemo<CustomSuggestionConfig>(
    () => ({
      displayMode: 'replace',
      debounceMs: 150,
      maxSuggestions: 10,
      suggest: async ({ query, existingTokens }) => {
        const selected = new Set(
          existingTokens.filter((token) => token.key === 'country').map((token) => token.value)
        );
        const result = await fetchCountries({ query: query.trim(), offset: 0, limit: 10 });
        return {
          suggestions: result.countries.map((country) =>
            countrySuggestion(country, selected.has(country.value))
          ),
          hasMore: result.hasMore,
        };
      },
      loadMore: async ({ query, existingTokens, offset, limit }) => {
        const selected = new Set(
          existingTokens.filter((token) => token.key === 'country').map((token) => token.value)
        );
        const result = await fetchCountries({ query: query.trim(), offset, limit });
        return {
          suggestions: result.countries.map((country) =>
            countrySuggestion(country, selected.has(country.value))
          ),
          hasMore: result.hasMore,
        };
      },
      onSelect: createToggleSelectHandler(),
    }),
    []
  );
  const change = useCallback(
    (next: QuerySnapshot) => {
      setSnapshot(next);
      void resolveTokens();
    },
    [resolveTokens]
  );
  return (
    <div className="demo-stack country-demo">
      <div className="demo-surface focus-surface">
        <TokenizedSearchInput
          ref={inputRef}
          fields={COUNTRY_FIELDS}
          freeTextMode="none"
          suggestions={{ field: { disabled: true }, custom }}
          validation={{ rules: [Unique.rule('exact')] }}
          serialization={{ serializeToken, deserializeText }}
          onChange={change}
          placeholder="Search countries by name…"
          clearable
        />
      </div>
      <Snapshot value={snapshot} empty="Try Japan, United States, or paste jp,us." />
    </div>
  );
}

type PatternId = 'dynamic' | 'free-text' | 'tags' | 'classifier';
const PATTERNS: Array<{
  id: PatternId;
  label: string;
  title: string;
  description: string;
  code: string;
}> = [
  {
    id: 'dynamic',
    label: 'Dynamic fields',
    title: 'Accept filters you do not know at build time.',
    description:
      'Keep a curated field list while allowing server-defined or user-defined keys with a controlled operator set.',
    code: UNKNOWN_FIELDS_CODE,
  },
  {
    id: 'free-text',
    label: 'Free text',
    title: 'Choose what happens outside filter syntax.',
    description:
      'Discard it, preserve it, or tokenize it. The mode is explicit rather than an accidental parser side effect.',
    code: FREE_TEXT_CODE,
  },
  {
    id: 'tags',
    label: 'Tags + validation',
    title: 'Use the editor as a constrained tag picker.',
    description:
      'Hide structural labels, replace field suggestions, and compose duplicate and count rules.',
    code: TAGS_CODE,
  },
  {
    id: 'classifier',
    label: 'Value classifier',
    title: 'Let typed values suggest their own field.',
    description: 'Recognize an email or user ID and return one or more complete token suggestions.',
    code: CLASSIFIER_CODE,
  },
];

function PatternDemo({ id }: { id: PatternId }) {
  if (id === 'dynamic') return <UnknownFieldsDemo />;
  if (id === 'free-text') return <FreeTextDemo />;
  if (id === 'tags') return <TagsDemo />;
  return <ClassifierDemo />;
}

export default function App() {
  const [pattern, setPattern] = useState<PatternId>('dynamic');
  const active = PATTERNS.find((item) => item.id === pattern) ?? PATTERNS[0];
  return (
    <div className="site-shell">
      <a className="skip-link" href="#main-content">
        Skip to content
      </a>
      <header className="site-header">
        <a className="brand" href="#top" aria-label="Tokenized Search Input home">
          <span className="brand-mark" aria-hidden="true">
            t:
          </span>
          <span>tokenized-search-input</span>
          <span className="version">v0.1.1</span>
        </a>
        <nav aria-label="Primary navigation">
          <a href="#playground">Playground</a>
          <a href="#patterns">Patterns</a>
          <a href="#reference">Reference</a>
        </nav>
        <div className="header-actions">
          <a className="text-link" href={REPOSITORY_URL}>
            GitHub
          </a>
          <ThemeToggle />
        </div>
      </header>

      <main id="main-content">
        <section className="hero" id="top" aria-labelledby="hero-title">
          <div className="hero-copy">
            <h1 id="hero-title">Turn typed queries into editable, typed filters.</h1>
            <p>
              Autocomplete, parsing, validation, async data, and clipboard behavior in one
              composable input. Start with the query language your product already uses.
            </p>
            <div className="hero-actions">
              <a className="primary-action" href="#playground">
                Try the editor <span aria-hidden="true">↓</span>
              </a>
              <a className="secondary-action" href={`${REPOSITORY_URL}#readme`}>
                Read the API
              </a>
            </div>
          </div>
          <aside className="grammar" aria-label="Query grammar">
            <div className="grammar-label">QUERY GRAMMAR</div>
            <code>
              <span>field</span>:<span>operator</span>:<span>value</span>
            </code>
            <ol>
              <li>
                <b>01</b> Select a field
              </li>
              <li>
                <b>02</b> Narrow the operation
              </li>
              <li>
                <b>03</b> Keep the result editable
              </li>
            </ol>
          </aside>
        </section>
        <ul className="fact-strip" aria-label="Compatibility summary">
          <li>
            <b>React</b> 18 and 19
          </li>
          <li>
            <b>Input</b> keyboard + paste
          </li>
          <li>
            <b>Output</b> text + typed segments
          </li>
          <li>
            <b>License</b> MIT
          </li>
        </ul>

        <section
          className="section workbench-section"
          id="playground"
          aria-labelledby="playground-title"
        >
          <SearchWorkbench />
        </section>

        <section className="section quick-start" aria-labelledby="quick-start-title">
          <div className="section-intro narrow-intro">
            <h2 id="quick-start-title">Install, define fields, listen for a snapshot.</h2>
            <p>
              The component owns editing mechanics. Your application owns the vocabulary and what
              the submitted query means.
            </p>
            <CodeBlock
              code="pnpm add https://github.com/KuruwiC/tokenized-search-input/releases/download/v0.1.1/kuruwic-tokenized-search-input-0.1.1.tgz"
              label="Install"
              language="bash"
            />
          </div>
          <CodeBlock code={BASIC_CODE} label="IssueSearch.tsx" />
        </section>

        <section
          className="section patterns-section"
          id="patterns"
          aria-labelledby="patterns-title"
        >
          <div className="section-intro">
            <h2 id="patterns-title">One editor, four different product jobs.</h2>
            <p>
              Switch examples to compare configuration and interaction without scrolling through
              four isolated mini-sites.
            </p>
          </div>
          <div className="pattern-tabs" role="tablist" aria-label="Demo patterns">
            {PATTERNS.map((item, index) => (
              <button
                type="button"
                role="tab"
                id={`tab-${item.id}`}
                aria-controls={`panel-${item.id}`}
                aria-selected={pattern === item.id}
                tabIndex={pattern === item.id ? 0 : -1}
                onClick={() => setPattern(item.id)}
                onKeyDown={(event) => {
                  if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
                  event.preventDefault();
                  const current = PATTERNS.findIndex((candidate) => candidate.id === pattern);
                  const next =
                    event.key === 'Home'
                      ? 0
                      : event.key === 'End'
                        ? PATTERNS.length - 1
                        : (current + (event.key === 'ArrowRight' ? 1 : -1) + PATTERNS.length) %
                          PATTERNS.length;
                  const nextPattern = PATTERNS[next];
                  setPattern(nextPattern.id);
                  window.requestAnimationFrame(() =>
                    document.getElementById(`tab-${nextPattern.id}`)?.focus()
                  );
                }}
                key={item.id}
              >
                <span>{String(index + 1).padStart(2, '0')}</span>
                {item.label}
              </button>
            ))}
          </div>
          <div
            className="pattern-panel"
            role="tabpanel"
            id={`panel-${active.id}`}
            aria-labelledby={`tab-${active.id}`}
          >
            <div className="pattern-copy">
              <h3>{active.title}</h3>
              <p>{active.description}</p>
              <CodeBlock code={active.code} label={`${active.label}.tsx`} collapsed />
            </div>
            <PatternDemo id={active.id} />
          </div>
        </section>

        <section className="section async-section" aria-labelledby="async-title">
          <div className="async-copy">
            <h2 id="async-title">Wire async suggestions from fetch to paste.</h2>
            <p>
              This country selector combines debounced search, pagination, toggle selection,
              pasted-value resolution, immutable tokens, and custom clipboard text.
            </p>
            <ul className="check-list">
              <li>Fetch and paginate suggestions</li>
              <li>Resolve stored IDs into display data</li>
              <li>Copy labels; paste names or codes</li>
            </ul>
            <CodeBlock code={COUNTRY_CODE} label="CountrySelector.tsx" collapsed />
          </div>
          <CountryDemo />
        </section>

        <section
          className="section reference-section"
          id="reference"
          aria-labelledby="reference-title"
        >
          <div className="section-intro">
            <h2 id="reference-title">Coverage, with a path to the full API.</h2>
          </div>
          <table className="capability-table">
            <caption className="sr-only">Library capabilities</caption>
            <thead>
              <tr className="capability-head">
                <th scope="col">Concern</th>
                <th scope="col">Built-in model</th>
                <th scope="col">Extension point</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <th scope="row">Fields</th>
                <td>string, enum, date, datetime</td>
                <td>
                  <code>FieldDefinition</code>
                </td>
              </tr>
              <tr>
                <th scope="row">Parsing</th>
                <td>operators, quotes, free text</td>
                <td>
                  <code>unknownFields</code>
                </td>
              </tr>
              <tr>
                <th scope="row">Suggestions</th>
                <td>field, operator, value</td>
                <td>
                  <code>suggest / loadMore</code>
                </td>
              </tr>
              <tr>
                <th scope="row">Validation</th>
                <td>unique and max count rules</td>
                <td>
                  <code>validation.rules</code>
                </td>
              </tr>
              <tr>
                <th scope="row">Clipboard</th>
                <td>copy and paste token text</td>
                <td>
                  <code>serialization</code>
                </td>
              </tr>
              <tr>
                <th scope="row">Control</th>
                <td>value, focus, clear, submit</td>
                <td>
                  <code>TokenizedSearchInputRef</code>
                </td>
              </tr>
            </tbody>
          </table>
          <p className="reference-note">
            The README remains the source of truth for prop signatures and migration notes.{' '}
            <a href={`${REPOSITORY_URL}#readme`}>Open the full reference →</a>
          </p>
        </section>
      </main>

      <footer className="site-footer">
        <span>tokenized-search-input · MIT</span>
        <span>React 18–19 · TypeScript</span>
        <a href={REPOSITORY_URL}>Source on GitHub</a>
      </footer>
    </div>
  );
}
