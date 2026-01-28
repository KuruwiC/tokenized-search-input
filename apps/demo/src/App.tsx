import type { TokenizedSearchInputRef } from '@kuruwic/tokenized-search-input';
import { TokenizedSearchInput, useAsyncTokenResolver } from '@kuruwic/tokenized-search-input';
import type {
  CustomSuggestion,
  CustomSuggestionConfig,
  FieldDefinition,
  ParsedToken,
  QuerySnapshot,
  ValidationConfig,
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
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ALL_COUNTRIES, type Country, fetchCountries } from './countries';

// ============================================================================
// Field Definitions
// ============================================================================

// Basic demo fields
const createFields = (): FieldDefinition[] => [
  {
    key: 'status',
    label: 'Status',
    type: 'enum',
    operators: ['is'],
    enumValues: ['active', 'inactive', 'pending'],
    icon: <Tag className="w-full h-full" />,
  },
  {
    key: 'priority',
    label: 'Priority',
    type: 'enum',
    operators: ['is', 'is_not'],
    enumValues: [
      { value: 'high', label: 'High' },
      { value: 'medium', label: 'Medium' },
      { value: 'low', label: 'Low' },
    ],
    icon: <Flag className="w-full h-full" />,
  },
  {
    key: 'title',
    label: 'Title',
    type: 'string',
    operators: ['contains', 'starts_with', 'ends_with'],
    allowSpaces: true,
    icon: <Search className="w-full h-full" />,
  },
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
  },
];

// Simple tags input fields
const SIMPLE_TAGS_FIELDS: FieldDefinition[] = [
  {
    key: 'tag',
    label: 'Tag',
    type: 'string',
    operators: ['is'],
    icon: <Tag className="w-full h-full" />,
    tokenLabelDisplay: 'hidden',
    hideSingleOperator: true,
  },
];

const AVAILABLE_TAGS = [
  { value: 'react', label: 'React' },
  { value: 'typescript', label: 'TypeScript' },
  { value: 'javascript', label: 'JavaScript' },
  { value: 'nodejs', label: 'Node.js' },
  { value: 'nextjs', label: 'Next.js' },
  { value: 'vue', label: 'Vue' },
  { value: 'angular', label: 'Angular' },
  { value: 'svelte', label: 'Svelte' },
  { value: 'css', label: 'CSS' },
  { value: 'tailwind', label: 'Tailwind CSS' },
  { value: 'html', label: 'HTML' },
  { value: 'python', label: 'Python' },
  { value: 'rust', label: 'Rust' },
  { value: 'go', label: 'Go' },
  { value: 'java', label: 'Java' },
  { value: 'csharp', label: 'C#' },
];

// Advanced country selector fields
const COUNTRY_FIELDS: FieldDefinition[] = [
  {
    key: 'country',
    label: 'Country',
    type: 'string',
    operators: ['is'],
    icon: <Globe className="w-full h-full" />,
    tokenLabelDisplay: 'hidden',
    hideSingleOperator: true,
    immutable: true,
  },
];

// Fields for smart value classification demo
const SMART_CLASSIFY_FIELDS: FieldDefinition[] = [
  {
    key: 'assignee',
    label: 'Assignee',
    type: 'string',
    operators: ['is'],
    icon: <User className="w-full h-full" />,
  },
  {
    key: 'requester',
    label: 'Requester',
    type: 'string',
    operators: ['is'],
    icon: <User className="w-full h-full" />,
  },
  {
    key: 'email',
    label: 'Email',
    type: 'string',
    operators: ['is'],
    icon: <User className="w-full h-full" />,
  },
  {
    key: 'title',
    label: 'Title',
    type: 'string',
    operators: ['contains'],
    allowSpaces: true,
    icon: <FileText className="w-full h-full" />,
  },
];

// Auto-tokenize fields for demo
const AUTO_TOKENIZE_FIELDS: FieldDefinition[] = [
  {
    key: 'status',
    label: 'Status',
    type: 'enum',
    operators: ['is', 'is_not'],
    enumValues: ['active', 'inactive', 'pending'],
    icon: <Tag className="w-full h-full" />,
  },
  {
    key: 'priority',
    label: 'Priority',
    type: 'enum',
    operators: ['is'],
    enumValues: ['high', 'medium', 'low'],
    icon: <Flag className="w-full h-full" />,
  },
];

// Simple fields for FreeTextMode demo
const FREE_TEXT_FIELDS: FieldDefinition[] = [
  {
    key: 'tag',
    label: 'Tag',
    type: 'string',
    operators: ['is'],
    icon: <Tag className="w-full h-full" />,
    tokenLabelDisplay: 'hidden',
    hideSingleOperator: true,
  },
];

// ============================================================================
// Validation Configs
// ============================================================================

const simpleTagsValidation: ValidationConfig = {
  rules: [Unique.rule('exact'), MaxCount.rule('*', 3)],
};

const countryValidation: ValidationConfig = {
  rules: [Unique.rule('exact')],
};

// ============================================================================
// Code Examples
// ============================================================================

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
    operators: ['contains', 'starts_with'],
  },
];

function App() {
  const handleSearch = (snapshot) => {
    console.log('Segments:', snapshot.segments);
    console.log('Text:', snapshot.text);
  };

  return (
    <TokenizedSearchInput
      fields={fields}
      onSubmit={handleSearch}
      placeholder="Search..."
    />
  );
}`;

const VALIDATION_CODE = `import { TokenizedSearchInput } from '@kuruwic/tokenized-search-input';
import { Unique, MaxCount, createFieldRule } from '@kuruwic/tokenized-search-input/utils';

const fields = [
  {
    key: 'tag',
    label: 'Tag',
    type: 'enum',
    operators: ['is'],
    enumValues: ['react', 'typescript', 'javascript'],
  },
];

const validation = {
  rules: [
    // Prevent duplicate tokens (default: mark invalid with red highlight)
    Unique.rule('exact'),

    // Auto-delete new duplicates instead of highlighting
    Unique.rule('exact', Unique.reject),

    // Auto-replace existing with new duplicate
    Unique.rule('exact', Unique.replace),

    // Limit total tokens (default: mark excess as invalid)
    MaxCount.rule('*', 5),

    // Validate value format with regex
    // RequirePattern.rule('email', /^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$/),

    // Custom validation: date format (YYYY-MM-DD)
    createFieldRule('date', (value, _allTokens, _operator) => {
      if (!/^\\d{4}-\\d{2}-\\d{2}$/.test(value)) {
        return 'Use YYYY-MM-DD format';
      }
      const [year, month, day] = value.split('-').map(Number);
      const date = new Date(year, month - 1, day);
      if (date.getFullYear() !== year ||
          date.getMonth() !== month - 1 ||
          date.getDate() !== day) {
        return 'Invalid date';
      }
    }),
  ],
};

<TokenizedSearchInput
  fields={fields}
  placeholder="Add tags..."
  validation={{ rules: validation.rules }}
/>`;

const ENUM_FIELD_CODE = `// Enum field with value suggestions
const fields = [
  {
    key: 'priority',
    label: 'Priority',
    type: 'enum',
    operators: ['is', 'is_not'],
    enumValues: [
      { value: 'high', label: 'High' },
      { value: 'medium', label: 'Medium' },
      { value: 'low', label: 'Low' },
    ],
    icon: <Flag className="w-full h-full" />,
    // Custom operator labels for i18n
    operatorLabels: {
      is: { display: '=', select: 'equals' },
      is_not: { display: '≠', select: 'not equals' },
    },
    // Hide field label in token: shows "High" instead of "Priority: High"
    tokenLabelDisplay: 'hidden',
  },
];`;

const DATE_FIELD_CODE = `// Date/DateTime fields with custom operators and format
const fields = [
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
    formatConfig: {
      // Custom parse: accept "MM/DD/YYYY" input and convert to ISO
      parse: (input) => {
        const match = input.match(/^(\\d{1,2})\\/(\\d{1,2})\\/(\\d{4})$/);
        if (match) {
          const [, month, day, year] = match;
          return \`\${year}-\${month.padStart(2, '0')}-\${day.padStart(2, '0')}\`;
        }
        return null; // fallback to default ISO parsing
      },
      // Custom format: display as "Jan 15, 2024" (receives ISO string)
      format: (isoValue) => {
        const date = new Date(isoValue);
        return date.toLocaleDateString('en-US', {
          month: 'short', day: 'numeric', year: 'numeric'
        });
      },
    },
    // Custom date picker (optional) - per-field customization
    renderPicker: (props) => <MyCustomDatePicker {...props} />,
  },
  {
    key: 'updated',
    label: 'Updated',
    type: 'datetime',
    operators: ['gt', 'lt'],
    formatConfig: {
      // Custom format: display as "YYYY/MM/DD HH:mm" (receives ISO string)
      format: (isoValue) => {
        const date = new Date(isoValue);
        return \`\${date.getFullYear()}/\${String(date.getMonth()+1).padStart(2,'0')}/\${String(date.getDate()).padStart(2,'0')} \${String(date.getHours()).padStart(2,'0')}:\${String(date.getMinutes()).padStart(2,'0')}\`;
      },
    },
    // Custom datetime picker (optional) - per-field customization
    renderPicker: (props) => <MyCustomDateTimePicker {...props} />,
  },
];`;

const OPERATOR_BEHAVIOR_CODE = `// Default operator auto-completion
// When only field:value is entered, the first operator in the array is used
const fields = [
  {
    key: 'priority',
    label: 'Priority',
    type: 'enum',
    // First operator 'is' is used as default
    operators: ['is', 'is_not'],  // priority:high → priority:is:high
    enumValues: ['high', 'medium', 'low'],
  },
  {
    key: 'age',
    label: 'Age',
    type: 'string',
    // First operator 'gt' is used as default
    operators: ['gt', 'lt', 'gte', 'lte'],  // age:18 → age:gt:18
  },
];

// Hide operator display
const singleOperatorField = {
  key: 'tag',
  label: 'Tag',
  type: 'enum',
  operators: ['is'],
  enumValues: ['react', 'vue', 'angular'],
  // Hide operator in token display (default: shown)
  hideSingleOperator: true,
};`;

const UNKNOWN_FIELDS_CODE = `// Allow dynamic fields not predefined in the fields array
<TokenizedSearchInput
  fields={fields}
  unknownFields={{ allow: true, operators: ['is', 'contains', 'gt', 'lt'] }}
/>

// With UnknownFields.allow={true}:
// - "custom:value" → creates filter token with key="custom", operator="is", value="value"
// - "custom:contains:value" → creates filter token with operator="contains"
// - The first operator in the operators array is used as default
// - Useful for user-defined or dynamic filter keys`;

const SMART_CLASSIFY_CODE = `// Classify input values and suggest appropriate fields
const customSuggestion: CustomSuggestionConfig = {
  displayMode: 'prepend',
  suggest: ({ query }) => {
    if (!query.trim()) return [];
    const suggestions = [];

    // Email pattern → suggest email field
    if (/^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$/.test(query)) {
      suggestions.push({
        tokens: [{ key: 'email', operator: 'is', value: query }],
        label: \`email: \${query}\`,
        description: 'Search by email',
      });
    }

    // User ID pattern (user#123) → suggest assignee or requester
    const userIds = query.match(/user#\\d+/g);
    if (userIds) {
      suggestions.push({
        tokens: userIds.map(id => ({ key: 'assignee', operator: 'is', value: id })),
        label: \`assignee: \${userIds.join(', ')}\`,
        description: \`Add \${userIds.length} assignee filter(s)\`,
      });
      suggestions.push({
        tokens: userIds.map(id => ({ key: 'requester', operator: 'is', value: id })),
        label: \`requester: \${userIds.join(', ')}\`,
        description: \`Add \${userIds.length} requester filter(s)\`,
      });
    }

    // Fallback → suggest title search
    if (suggestions.length === 0) {
      suggestions.push({
        tokens: [{ key: 'title', operator: 'contains', value: query }],
        label: \`title: "\${query}"\`,
        description: 'Search in title',
      });
    }

    return suggestions;
  },
};`;

const CLIPBOARD_CODE = `// Customize copy/paste behavior for tokens
<TokenizedSearchInput
  fields={fields}
  serialization={{
    // Custom format when copying (e.g., "Japan" instead of "country:is:jp")
    serializeToken: (token) => {
      if (token.key === 'country') {
        const country = countries.find(c => c.value === token.value);
        return country?.label ?? token.value;
      }
      return null; // use default format
    },
    // Parse custom formats when pasting
    // Return null to fallback to standard format (e.g., "country:is:jp")
    deserializeText: (text) => {
      const tokens = matchCountryNames(text); // your custom matching logic
      return tokens.length > 0 ? tokens : null;
    },
  }}
/>`;

const SIMPLE_TAGS_CODE = `import { TokenizedSearchInput } from '@kuruwic/tokenized-search-input';
import { Unique, MaxCount } from '@kuruwic/tokenized-search-input/utils';
import type { CustomSuggestionConfig, FieldDefinition } from '@kuruwic/tokenized-search-input/utils';

const TAG_FIELDS: FieldDefinition[] = [{
  key: 'tag',
  label: 'Tag',
  type: 'string',
  operators: ['is'],
  tokenLabelDisplay: 'hidden',
  hideSingleOperator: true,
}];

const AVAILABLE_TAGS = ['React', 'TypeScript', 'JavaScript', 'CSS', 'HTML'];

const customSuggestion: CustomSuggestionConfig = {
  displayMode: 'replace',
  suggest: ({ query }) => {
    const filtered = AVAILABLE_TAGS.filter(tag =>
      tag.toLowerCase().includes(query.toLowerCase())
    );
    return filtered.map(tag => ({
      tokens: [{ key: 'tag', operator: 'is', value: tag.toLowerCase(), displayValue: tag }],
      label: tag,
    }));
  },
};

<TokenizedSearchInput
  fields={TAG_FIELDS}
  freeTextMode="none"
  placeholder="Add tags..."
  suggestions={{ field: { disabled: true }, custom: customSuggestion }}
  validation={{ rules: [Unique.rule('exact'), MaxCount.rule('*', 5)] }}
/>`;

const ADVANCED_COUNTRY_CODE = `import {
  TokenizedSearchInput,
  useAsyncTokenResolver,
} from '@kuruwic/tokenized-search-input';
import {
  createToggleSelectHandler,
  Unique,
} from '@kuruwic/tokenized-search-input/utils';
import type { CustomSuggestionConfig, FieldDefinition } from '@kuruwic/tokenized-search-input/utils';

// Field definition with immutable tokens (prevents inline editing)
const COUNTRY_FIELDS: FieldDefinition[] = [{
  key: 'country',
  label: 'Country',
  type: 'string',
  operators: ['is'],
  tokenLabelDisplay: 'hidden',
  hideSingleOperator: true,
  immutable: true,
}];

function CountrySelector() {
  const inputRef = useRef<TokenizedSearchInputRef>(null);

  // Resolve displayValue and startContent for pasted tokens
  const { resolveTokens } = useAsyncTokenResolver({
    inputRef,
    fieldKey: 'country',
    resolve: async (values) => {
      const { countries } = await fetchCountries({ values, offset: 0, limit: values.length });
      return countries;
    },
    getValue: (c) => c.value,
    getDisplayData: (c) => ({
      displayValue: c.label,
      startContent: <span>{c.emoji}</span>,
    }),
    loadingContent: {
      displayValue: 'Loading...',
      startContent: <Loader2 className="animate-spin" />,
    },
  });

  const customSuggestion: CustomSuggestionConfig = useMemo(() => ({
    displayMode: 'replace',
    debounceMs: 150,

    suggest: async ({ query, existingTokens }) => {
      const selectedValues = new Set(existingTokens.map(t => t.value));
      const result = await fetchCountries({ query, offset: 0, limit: 10 });

      return {
        suggestions: result.countries.map(c => ({
          tokens: [{
            key: 'country',
            operator: 'is',
            value: c.value,
            displayValue: c.label,
            startContent: <span>{c.emoji}</span>,
          }],
          label: \`\${c.emoji} \${c.label}\`,
          endContent: selectedValues.has(c.value) ? <Check /> : undefined,
        })),
        hasMore: result.hasMore,
      };
    },

    loadMore: async ({ query, offset, limit, existingTokens }) => {
      // Pagination support - same mapping as suggest
      const selectedValues = new Set(existingTokens.map(t => t.value));
      const result = await fetchCountries({ query, offset, limit });
      return {
        suggestions: result.countries.map(c => ({ /* same mapping */ })),
        hasMore: result.hasMore,
      };
    },

    // Toggle behavior: click again to deselect
    onSelect: createToggleSelectHandler(),
  }), []);

  return (
    <TokenizedSearchInput
      ref={inputRef}
      fields={COUNTRY_FIELDS}
      freeTextMode="none"
      onChange={resolveTokens}
      placeholder="Search countries..."
      suggestions={{ field: { disabled: true }, custom: customSuggestion }}
      validation={{ rules: [Unique.rule('exact')] }}
      serialization={{ serializeToken, deserializeText }}
    />
  );
}`;

// ============================================================================
// Utility Components
// ============================================================================

function CodeBlock({ code }: { code: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(async () => {
    await navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [code]);

  return (
    <div className="relative">
      <pre className="code-block">
        <code>{code}</code>
      </pre>
      <button
        type="button"
        onClick={handleCopy}
        className="copy-button"
        aria-label={copied ? 'Copied!' : 'Copy code'}
      >
        {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
      </button>
    </div>
  );
}

function ThemeToggle() {
  const [isDark, setIsDark] = useState(false);

  useEffect(() => {
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    setIsDark(prefersDark);
    document.documentElement.classList.toggle('dark', prefersDark);
  }, []);

  const toggleTheme = useCallback(() => {
    setIsDark((prev) => {
      const next = !prev;
      document.documentElement.classList.toggle('dark', next);
      return next;
    });
  }, []);

  return (
    <button
      type="button"
      onClick={toggleTheme}
      className="p-2 rounded-lg bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
      aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
    >
      {isDark ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
    </button>
  );
}

// ============================================================================
// Demo Components
// ============================================================================

function SmartClassifyDemo() {
  const [result, setResult] = useState<QuerySnapshot | null>(null);

  const customSuggestion: CustomSuggestionConfig = useMemo(
    () => ({
      displayMode: 'prepend',
      suggest: ({ query }) => {
        if (!query.trim()) return [];
        const suggestions: CustomSuggestion[] = [];

        // Email pattern → suggest email field
        if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(query)) {
          suggestions.push({
            tokens: [{ key: 'email', operator: 'is', value: query }],
            label: `email: ${query}`,
            description: 'Search by email',
          });
        }

        // User ID pattern (user#123, user#456) → suggest assignee or requester
        // User ID pattern: query must be ONLY user IDs (no other text)
        // e.g., "user#123" or "user#123, user#456" but NOT "aaa user#123"
        const userIdOnlyPattern = /^user#\d+(?:[,\s]+user#\d+)*$/;
        if (userIdOnlyPattern.test(query)) {
          const userIds = query.match(/user#\d+/g) ?? [];
          suggestions.push({
            tokens: userIds.map((id) => ({ key: 'assignee', operator: 'is' as const, value: id })),
            label: `assignee: ${userIds.join(', ')}`,
            description: `Add ${userIds.length} assignee filter(s)`,
          });
          suggestions.push({
            tokens: userIds.map((id) => ({ key: 'requester', operator: 'is' as const, value: id })),
            label: `requester: ${userIds.join(', ')}`,
            description: `Add ${userIds.length} requester filter(s)`,
          });
        }

        // Fallback → suggest title search
        if (suggestions.length === 0) {
          suggestions.push({
            tokens: [{ key: 'title', operator: 'contains', value: query }],
            label: `title: "${query}"`,
            description: 'Search in title',
          });
        }

        return suggestions;
      },
    }),
    []
  );

  const filterSegments = result?.segments.filter((t) => t.type === 'filter') ?? [];

  return (
    <div className="space-y-4">
      <div className="demo-preview">
        <TokenizedSearchInput
          fields={SMART_CLASSIFY_FIELDS}
          onSubmit={setResult}
          placeholder="Try: user#123, user#456 or test@example.com or any text..."
          clearable
          suggestions={{ custom: customSuggestion }}
        />
      </div>
      {filterSegments.length > 0 && (
        <div className="p-3 bg-gray-100 dark:bg-gray-800 rounded-lg">
          <p className="text-xs text-gray-500 mb-1">Search tokens:</p>
          <pre className="text-xs overflow-auto">{JSON.stringify(filterSegments, null, 2)}</pre>
        </div>
      )}
    </div>
  );
}

function AutoTokenizeDemo() {
  const [result, setResult] = useState<QuerySnapshot | null>(null);

  const filterSegments = result?.segments.filter((t) => t.type === 'filter') ?? [];

  return (
    <div className="space-y-4">
      <div className="demo-preview">
        <TokenizedSearchInput
          fields={AUTO_TOKENIZE_FIELDS}
          onSubmit={setResult}
          placeholder="Type 'status:' or 'status:is:active'..."
          clearable
        />
      </div>
      <div className="text-xs text-gray-500 space-y-1">
        <p>
          <strong>Immediate Triggers:</strong>
        </p>
        <ul className="list-disc list-inside ml-2 space-y-0.5">
          <li>
            <code className="bg-gray-100 dark:bg-gray-800 px-1 rounded">:</code> after field name →
            creates token immediately
          </li>
          <li>
            <code className="bg-gray-100 dark:bg-gray-800 px-1 rounded">Space</code> or{' '}
            <code className="bg-gray-100 dark:bg-gray-800 px-1 rounded">Enter</code> → tokenizes
            immediately
          </li>
          <li>
            <code className="bg-gray-100 dark:bg-gray-800 px-1 rounded">Paste</code> → tokenizes all
            content immediately
          </li>
        </ul>
      </div>
      {filterSegments.length > 0 && (
        <div className="p-3 bg-gray-100 dark:bg-gray-800 rounded-lg">
          <p className="text-xs text-gray-500 mb-1">Segments:</p>
          <pre className="text-xs overflow-auto">{JSON.stringify(filterSegments, null, 2)}</pre>
        </div>
      )}
    </div>
  );
}

// Basic fields for unknown fields demo
const UNKNOWN_FIELDS_DEMO_FIELDS: FieldDefinition[] = [
  {
    key: 'status',
    label: 'Status',
    type: 'enum',
    operators: ['is'],
    enumValues: ['active', 'inactive', 'pending'],
    icon: <Tag className="w-full h-full" />,
  },
];

function UnknownFieldsDemo() {
  const [result, setResult] = useState<QuerySnapshot | null>(null);

  const filterSegments = result?.segments.filter((t) => t.type === 'filter') ?? [];

  return (
    <div className="space-y-4">
      <div className="demo-preview">
        <TokenizedSearchInput
          fields={UNKNOWN_FIELDS_DEMO_FIELDS}
          onSubmit={setResult}
          placeholder="Try 'status:active' or 'custom:value' or 'age:gt:18'..."
          clearable
          unknownFields={{ allow: true, operators: ['is', 'contains', 'gt', 'lt'] }}
        />
      </div>
      <div className="text-xs text-gray-500 space-y-1">
        <p>
          <strong>Try:</strong>
        </p>
        <ul className="list-disc list-inside ml-2 space-y-0.5">
          <li>
            <code className="bg-gray-100 dark:bg-gray-800 px-1 rounded">status:active</code> — Known
            field
          </li>
          <li>
            <code className="bg-gray-100 dark:bg-gray-800 px-1 rounded">custom:value</code> —
            Unknown field with default operator
          </li>
          <li>
            <code className="bg-gray-100 dark:bg-gray-800 px-1 rounded">age:gt:18</code> — Unknown
            field with explicit operator
          </li>
        </ul>
      </div>
      {filterSegments.length > 0 && (
        <div className="p-3 bg-gray-100 dark:bg-gray-800 rounded-lg">
          <p className="text-xs text-gray-500 mb-1">Segments:</p>
          <pre className="text-xs overflow-auto">{JSON.stringify(filterSegments, null, 2)}</pre>
        </div>
      )}
    </div>
  );
}

function FreeTextModeDemo() {
  const [mode, setMode] = useState<'none' | 'plain' | 'tokenize'>('tokenize');
  const [result, setResult] = useState<QuerySnapshot | null>(null);

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        {(['none', 'plain', 'tokenize'] as const).map((m) => (
          <button
            key={m}
            type="button"
            onClick={() => setMode(m)}
            className={`px-3 py-1.5 text-sm rounded-lg transition-colors ${
              mode === m
                ? 'bg-blue-500 text-white'
                : 'bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700'
            }`}
          >
            {m}
          </button>
        ))}
      </div>

      <div className="demo-preview">
        <TokenizedSearchInput
          key={mode}
          fields={FREE_TEXT_FIELDS}
          freeTextMode={mode}
          onSubmit={setResult}
          placeholder={
            mode === 'none'
              ? 'Only structured tokens allowed...'
              : mode === 'plain'
                ? 'Free text is preserved as-is...'
                : 'Free text converts to tags on space/enter...'
          }
          clearable
        />
      </div>

      <div className="grid gap-3 sm:grid-cols-3 text-xs">
        <div
          className={`p-3 rounded-lg border ${mode === 'none' ? 'border-blue-500 bg-blue-50 dark:bg-blue-950' : 'border-gray-200 dark:border-gray-700'}`}
        >
          <p className="font-medium mb-1">none</p>
          <p className="text-gray-600 dark:text-gray-400">
            Free text is discarded on submit. Only structured tokens are kept.
          </p>
        </div>
        <div
          className={`p-3 rounded-lg border ${mode === 'plain' ? 'border-blue-500 bg-blue-50 dark:bg-blue-950' : 'border-gray-200 dark:border-gray-700'}`}
        >
          <p className="font-medium mb-1">plain</p>
          <p className="text-gray-600 dark:text-gray-400">
            Free text is preserved as plain text alongside tokens.
          </p>
        </div>
        <div
          className={`p-3 rounded-lg border ${mode === 'tokenize' ? 'border-blue-500 bg-blue-50 dark:bg-blue-950' : 'border-gray-200 dark:border-gray-700'}`}
        >
          <p className="font-medium mb-1">tokenize</p>
          <p className="text-gray-600 dark:text-gray-400">
            Free text becomes visual tags when you press space or enter.
          </p>
        </div>
      </div>

      {result && (
        <div className="p-3 bg-gray-100 dark:bg-gray-800 rounded-lg">
          <p className="text-xs text-gray-500 mb-1">Result:</p>
          <pre className="text-xs overflow-auto">{JSON.stringify(result, null, 2)}</pre>
        </div>
      )}
    </div>
  );
}

function SimpleTagsInputDemo() {
  const [result, setResult] = useState<QuerySnapshot | null>(null);

  const customSuggestion: CustomSuggestionConfig = useMemo(
    () => ({
      displayMode: 'replace',
      suggest: ({ query }) => {
        const filtered = AVAILABLE_TAGS.filter((tag) =>
          tag.label.toLowerCase().includes(query.toLowerCase())
        );
        return filtered.map((tag) => ({
          tokens: [
            { key: 'tag', operator: 'is' as const, value: tag.value, displayValue: tag.label },
          ],
          label: tag.label,
        }));
      },
    }),
    []
  );

  const filterSegments = result?.segments.filter((t) => t.type === 'filter') ?? [];

  return (
    <div className="space-y-4">
      <div className="demo-preview">
        <TokenizedSearchInput
          fields={SIMPLE_TAGS_FIELDS}
          freeTextMode="none"
          onSubmit={setResult}
          placeholder="Add tags (max 3, no duplicates)..."
          clearable
          suggestions={{ field: { disabled: true }, custom: customSuggestion }}
          validation={{ rules: simpleTagsValidation.rules }}
        />
      </div>
      {filterSegments.length > 0 && (
        <div className="p-3 bg-gray-100 dark:bg-gray-800 rounded-lg">
          <p className="text-xs text-gray-500 mb-1">Selected tags:</p>
          <div className="flex flex-wrap gap-1">
            {filterSegments.map((t) => {
              const tag = AVAILABLE_TAGS.find((tag) => tag.value === t.value);
              return (
                <span
                  key={`${t.key}-${t.value}`}
                  className="text-sm px-2 py-0.5 bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 rounded"
                >
                  {tag?.label ?? t.value}
                </span>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

// Convert Country to suggestion with toggle indicator
const countryToSuggestion = (country: Country, isSelected: boolean) => ({
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
  confidence: isSelected ? 1.0 : 0.9,
  endContent: isSelected ? <span className="text-tsi-primary">✓</span> : undefined,
});

const PAGE_SIZE = 10;

function AdvancedCountrySelectorDemo() {
  const [result, setResult] = useState<QuerySnapshot | null>(null);
  const inputRef = useRef<TokenizedSearchInputRef>(null);

  // Resolve displayValue and startContent for pasted tokens
  const { resolveTokens } = useAsyncTokenResolver({
    inputRef,
    fieldKey: 'country',
    resolve: async (values) => {
      const { countries } = await fetchCountries({ values, offset: 0, limit: values.length });
      return countries;
    },
    getValue: (c) => c.value,
    getDisplayData: (c) => ({
      displayValue: c.label,
      startContent: <span>{c.emoji}</span>,
    }),
    loadingContent: {
      displayValue: 'Loading...',
      startContent: <Loader2 className="w-full h-full animate-spin" />,
    },
  });

  const serializeToken = useCallback((token: { key: string; value: string }) => {
    if (token.key === 'country') {
      const country = ALL_COUNTRIES.find((c) => c.value === token.value);
      return country?.label ?? null;
    }
    return null;
  }, []);

  // Custom deserialize: parse country names/codes from pasted text
  const deserializeText = useCallback((text: string): ParsedToken[] | null => {
    const tokens: Array<{ type: 'filter'; key: string; operator: 'is'; value: string }> = [];
    let remaining = text.trim();

    // Sort countries by label length (longest first) to match multi-word names first
    const sortedCountries = [...ALL_COUNTRIES].sort((a, b) => b.label.length - a.label.length);

    while (remaining.length > 0) {
      let matched = false;

      for (const country of sortedCountries) {
        const labelLower = country.label.toLowerCase();
        const remainingLower = remaining.toLowerCase();

        if (remainingLower.startsWith(labelLower)) {
          const nextChar = remaining[country.label.length];
          if (!nextChar || /[\s,;]/.test(nextChar)) {
            tokens.push({ type: 'filter', key: 'country', operator: 'is', value: country.value });
            remaining = remaining.slice(country.label.length).replace(/^[\s,;]+/, '');
            matched = true;
            break;
          }
        }

        const codeLower = country.value.toLowerCase();
        if (remainingLower.startsWith(codeLower)) {
          const nextChar = remaining[country.value.length];
          if (!nextChar || /[\s,;]/.test(nextChar)) {
            tokens.push({ type: 'filter', key: 'country', operator: 'is', value: country.value });
            remaining = remaining.slice(country.value.length).replace(/^[\s,;]+/, '');
            matched = true;
            break;
          }
        }
      }

      if (!matched) {
        const spaceIndex = remaining.search(/[\s,;]/);
        if (spaceIndex === -1) {
          break;
        }
        remaining = remaining.slice(spaceIndex).replace(/^[\s,;]+/, '');
      }
    }

    return tokens.length > 0 ? tokens : null;
  }, []);

  const customSuggestion: CustomSuggestionConfig = useMemo(
    () => ({
      displayMode: 'replace',
      debounceMs: 150,
      maxSuggestions: PAGE_SIZE,

      suggest: async ({ query, existingTokens }) => {
        const selectedValues = new Set(
          existingTokens.filter((t) => t.key === 'country').map((t) => t.value)
        );

        const fetchResult = await fetchCountries({
          query: query.trim(),
          offset: 0,
          limit: PAGE_SIZE,
        });

        return {
          suggestions: fetchResult.countries.map((c) =>
            countryToSuggestion(c, selectedValues.has(c.value))
          ),
          hasMore: fetchResult.hasMore,
        };
      },

      loadMore: async ({ query, existingTokens, offset, limit }) => {
        const selectedValues = new Set(
          existingTokens.filter((t) => t.key === 'country').map((t) => t.value)
        );

        const fetchResult = await fetchCountries({
          query: query.trim(),
          offset,
          limit,
        });

        return {
          suggestions: fetchResult.countries.map((c) =>
            countryToSuggestion(c, selectedValues.has(c.value))
          ),
          hasMore: fetchResult.hasMore,
        };
      },

      onSelect: createToggleSelectHandler(),
    }),
    []
  );

  const filterSegments = result?.segments.filter((t) => t.type === 'filter') ?? [];

  return (
    <div className="space-y-4">
      <div className="demo-preview">
        <TokenizedSearchInput
          ref={inputRef}
          fields={COUNTRY_FIELDS}
          freeTextMode="none"
          onChange={resolveTokens}
          onSubmit={setResult}
          placeholder="Search and select countries..."
          clearable
          suggestions={{ field: { disabled: true }, custom: customSuggestion }}
          validation={countryValidation}
          serialization={{ serializeToken, deserializeText }}
        />
      </div>
      {filterSegments.length > 0 && (
        <div className="p-3 bg-gray-100 dark:bg-gray-800 rounded-lg">
          <p className="text-xs text-gray-500 mb-1">Selected countries:</p>
          <div className="flex flex-wrap gap-1">
            {filterSegments.map((t) => {
              const country = ALL_COUNTRIES.find((c) => c.value === t.value);
              return (
                <span
                  key={`${t.key}-${t.value}`}
                  className="text-sm px-2 py-0.5 bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200 rounded"
                >
                  {country ? `${country.emoji} ${country.label}` : t.value}
                </span>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================================================
// Main App
// ============================================================================

export default function App() {
  const fields = useMemo(() => createFields(), []);
  const [searchResult, setSearchResult] = useState<QuerySnapshot | null>(null);

  const handleSearch = useCallback((query: QuerySnapshot) => {
    setSearchResult(query);
  }, []);

  return (
    <div className="min-h-screen">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-white/80 dark:bg-gray-950/80 backdrop-blur-sm border-b border-gray-200 dark:border-gray-800">
        <div className="max-w-4xl mx-auto px-6 py-4 flex items-center justify-between">
          <h1 className="text-lg font-semibold">Tokenized Search Input</h1>
          <div className="flex items-center gap-3">
            <a
              href="https://github.com/KuruwiC/tokenized-search-input"
              target="_blank"
              rel="noopener noreferrer"
              className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
            >
              <svg
                className="w-5 h-5"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                role="img"
                aria-labelledby="github-icon-title"
              >
                <title id="github-icon-title">GitHub</title>
                <path d="M15 22v-4a4.8 4.8 0 0 0-1-3.5c3 0 6-2 6-5.5.08-1.25-.27-2.48-1-3.5.28-1.15.28-2.35 0-3.5 0 0-1 0-3 1.5-2.64-.5-5.36-.5-8 0C6 2 5 2 5 2c-.3 1.15-.3 2.35 0 3.5A5.403 5.403 0 0 0 4 9c0 3.5 3 5.5 6 5.5-.39.49-.68 1.05-.85 1.65-.17.6-.22 1.23-.15 1.85v4" />
                <path d="M9 18c-4.51 2-5-2-7-2" />
              </svg>
            </a>
            <ThemeToggle />
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-6">
        {/* Hero Section */}
        <section className="demo-section">
          <div className="text-center mb-8">
            <h2 className="text-3xl font-semibold mb-3">Tokenized Search Input</h2>
            <p className="text-gray-600 dark:text-gray-400 max-w-2xl mx-auto">
              A reusable React component for building advanced search interfaces with tokenized
              filters, autocomplete suggestions, and date pickers.
            </p>
          </div>

          <div className="demo-preview mb-6">
            <TokenizedSearchInput
              fields={fields}
              onSubmit={handleSearch}
              placeholder="Try typing 'status:' or click to see suggestions..."
              clearable
            />
          </div>

          {searchResult && (
            <div className="mt-4 p-4 bg-gray-100 dark:bg-gray-800 rounded-lg">
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">Query snapshot:</p>
              <pre className="text-sm font-mono overflow-auto">
                {JSON.stringify(searchResult, null, 2)}
              </pre>
            </div>
          )}
        </section>

        {/* Installation */}
        <section className="demo-section">
          <h2 className="text-2xl font-semibold mb-4">Installation</h2>
          <CodeBlock
            code={`# pnpm (recommended)
pnpm add https://github.com/KuruwiC/tokenized-search-input/releases/download/v0.1.0/kuruwic-tokenized-search-input-0.1.0.tgz

# npm
npm install https://github.com/KuruwiC/tokenized-search-input/releases/download/v0.1.0/kuruwic-tokenized-search-input-0.1.0.tgz

# yarn
yarn add https://github.com/KuruwiC/tokenized-search-input/releases/download/v0.1.0/kuruwic-tokenized-search-input-0.1.0.tgz`}
          />
        </section>

        {/* Basic Usage */}
        <section className="demo-section">
          <h2 className="text-2xl font-semibold mb-4">Basic Usage</h2>
          <p className="text-gray-600 dark:text-gray-400 mb-4">
            Define your fields and pass them to the component. Each field can have different types
            (string, enum, date, datetime) and operators.
          </p>
          <CodeBlock code={BASIC_CODE} />
        </section>

        {/* Validation */}
        <section className="demo-section">
          <h2 className="text-2xl font-semibold mb-4">Validation</h2>
          <p className="text-gray-600 dark:text-gray-400 mb-6">
            Enforce constraints on tokens with built-in validation rules. Invalid tokens are
            highlighted in red.
          </p>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 mb-6">
            <div className="p-4 border border-gray-200 dark:border-gray-700 rounded-lg">
              <h3 className="font-medium mb-2">Unique.rule(constraint)</h3>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Prevent duplicates.{' '}
                <code className="text-xs bg-gray-100 dark:bg-gray-800 px-1 rounded">
                  &apos;exact&apos;
                </code>{' '}
                <code className="text-xs bg-gray-100 dark:bg-gray-800 px-1 rounded">
                  &apos;key&apos;
                </code>{' '}
                <code className="text-xs bg-gray-100 dark:bg-gray-800 px-1 rounded">
                  &apos;key-operator&apos;
                </code>
              </p>
            </div>
            <div className="p-4 border border-gray-200 dark:border-gray-700 rounded-lg">
              <h3 className="font-medium mb-2">MaxCount.rule(field, n)</h3>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Limit token count. Use{' '}
                <code className="text-xs bg-gray-100 dark:bg-gray-800 px-1 rounded">
                  &apos;*&apos;
                </code>{' '}
                for all fields.
              </p>
            </div>
            <div className="p-4 border border-gray-200 dark:border-gray-700 rounded-lg">
              <h3 className="font-medium mb-2">RequirePattern.rule(field, regex)</h3>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Validate value format with regex.
              </p>
            </div>
            <div className="p-4 border border-gray-200 dark:border-gray-700 rounded-lg">
              <h3 className="font-medium mb-2">createFieldRule()</h3>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Custom validation logic for a specific field.
              </p>
            </div>
          </div>

          <div className="mb-6 p-4 bg-gray-50 dark:bg-gray-900 rounded-lg">
            <h3 className="font-medium mb-2">Handling Duplicates</h3>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
              Choose how to handle duplicate tokens:
            </p>
            <div className="grid gap-2 sm:grid-cols-3">
              <div className="text-sm">
                <code className="text-xs bg-gray-100 dark:bg-gray-800 px-1 rounded">
                  Unique.mark
                </code>
                <span className="text-gray-500 ml-2">— Error highlight (default)</span>
              </div>
              <div className="text-sm">
                <code className="text-xs bg-gray-100 dark:bg-gray-800 px-1 rounded">
                  Unique.reject
                </code>
                <span className="text-gray-500 ml-2">— Silently ignored</span>
              </div>
              <div className="text-sm">
                <code className="text-xs bg-gray-100 dark:bg-gray-800 px-1 rounded">
                  Unique.replace
                </code>
                <span className="text-gray-500 ml-2">— Overwrites previous</span>
              </div>
            </div>
          </div>

          <CodeBlock code={VALIDATION_CODE} />
        </section>

        {/* Field Types */}
        <section className="demo-section">
          <h2 className="text-2xl font-semibold mb-4">Field Types</h2>
          <p className="text-gray-600 dark:text-gray-400 mb-6">
            The component supports multiple field types. Each type determines the UI and input
            behavior, while <strong>operators are freely definable</strong> for any field type. The
            library provides{' '}
            <code className="text-xs bg-gray-100 dark:bg-gray-800 px-1 rounded">
              DEFAULT_OPERATORS
            </code>{' '}
            with pre-defined labels, but you can use any string as an operator.
          </p>

          {/* String */}
          <div className="mb-8">
            <h3 className="text-xl font-medium mb-2">String</h3>
            <p className="text-gray-600 dark:text-gray-400 mb-4">
              Free-form text input. Use{' '}
              <code className="text-xs bg-gray-100 dark:bg-gray-800 px-1 rounded">
                allowSpaces: true
              </code>{' '}
              for fields that need spaces without quotes.
            </p>
          </div>

          {/* Enum */}
          <div className="mb-8">
            <h3 className="text-xl font-medium mb-2">Enum</h3>
            <p className="text-gray-600 dark:text-gray-400 mb-4">
              Predefined values with autocomplete suggestions. Customize with{' '}
              <code className="text-xs bg-gray-100 dark:bg-gray-800 px-1 rounded">
                operatorLabels
              </code>{' '}
              for i18n and{' '}
              <code className="text-xs bg-gray-100 dark:bg-gray-800 px-1 rounded">
                tokenLabelDisplay
              </code>{' '}
              to control token appearance.
            </p>
            <p className="text-sm text-gray-500 mb-4">
              <strong>Note:</strong> Users can enter values not in{' '}
              <code className="text-xs bg-gray-100 dark:bg-gray-800 px-1 rounded">enumValues</code>.
              Use{' '}
              <code className="text-xs bg-gray-100 dark:bg-gray-800 px-1 rounded">
                RequireEnum.rule()
              </code>{' '}
              to restrict input to predefined values only.
            </p>
            <CodeBlock code={ENUM_FIELD_CODE} />
          </div>

          {/* Date / DateTime */}
          <div>
            <h3 className="text-xl font-medium mb-2">Date / DateTime</h3>
            <p className="text-gray-600 dark:text-gray-400 mb-4">
              Built-in date and time pickers. You can replace the default pickers with custom
              components using{' '}
              <code className="text-xs bg-gray-100 dark:bg-gray-800 px-1 rounded">
                pickers.renderDate
              </code>{' '}
              and{' '}
              <code className="text-xs bg-gray-100 dark:bg-gray-800 px-1 rounded">
                pickers.renderDateTime
              </code>{' '}
              props on the component, or per-field{' '}
              <code className="text-xs bg-gray-100 dark:bg-gray-800 px-1 rounded">
                renderPicker
              </code>{' '}
              in field definitions.
            </p>
            <CodeBlock code={DATE_FIELD_CODE} />
          </div>
        </section>

        {/* Operator Behavior */}
        <section className="demo-section">
          <h2 className="text-2xl font-semibold mb-4">Operator Behavior</h2>
          <p className="text-gray-600 dark:text-gray-400 mb-6">
            Operators control how filter values are matched. The component provides smart defaults
            and display options.
          </p>

          <div className="grid gap-4 sm:grid-cols-2 mb-6">
            <div className="p-4 border border-gray-200 dark:border-gray-700 rounded-lg">
              <h3 className="font-medium mb-2">Default Operator</h3>
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
                When entering{' '}
                <code className="text-xs bg-gray-100 dark:bg-gray-800 px-1 rounded">
                  field:value
                </code>{' '}
                without an operator, the first operator in the{' '}
                <code className="text-xs bg-gray-100 dark:bg-gray-800 px-1 rounded">operators</code>{' '}
                array is used.
              </p>
              <p className="text-xs text-gray-500">
                <code className="bg-gray-100 dark:bg-gray-800 px-1 rounded">priority:high</code> →{' '}
                <code className="bg-gray-100 dark:bg-gray-800 px-1 rounded">priority:is:high</code>
              </p>
            </div>
            <div className="p-4 border border-gray-200 dark:border-gray-700 rounded-lg">
              <h3 className="font-medium mb-2">Hide Operator</h3>
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
                By default, operators are always shown. Use{' '}
                <code className="text-xs bg-gray-100 dark:bg-gray-800 px-1 rounded">
                  hideSingleOperator: true
                </code>{' '}
                to hide the operator in the token display.
              </p>
              <p className="text-xs text-gray-500">Useful for simplified token appearance</p>
            </div>
          </div>

          <CodeBlock code={OPERATOR_BEHAVIOR_CODE} />
        </section>

        {/* Unknown Fields */}
        <section className="demo-section">
          <h2 className="text-2xl font-semibold mb-4">Unknown Fields</h2>
          <p className="text-gray-600 dark:text-gray-400 mb-6">
            Allow users to create filter tokens with field keys that are not predefined in the{' '}
            <code className="text-xs bg-gray-100 dark:bg-gray-800 px-1 rounded">fields</code> array.
          </p>

          <div className="grid gap-4 sm:grid-cols-2 mb-6">
            <div className="p-4 border border-gray-200 dark:border-gray-700 rounded-lg">
              <h3 className="font-medium mb-2">unknownFields.allow</h3>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                When <code className="text-xs bg-gray-100 dark:bg-gray-800 px-1 rounded">true</code>
                , any text matching{' '}
                <code className="text-xs bg-gray-100 dark:bg-gray-800 px-1 rounded">
                  field:value
                </code>{' '}
                or{' '}
                <code className="text-xs bg-gray-100 dark:bg-gray-800 px-1 rounded">
                  field:operator:value
                </code>{' '}
                format will be tokenized, even if the field is not defined.
              </p>
            </div>
            <div className="p-4 border border-gray-200 dark:border-gray-700 rounded-lg">
              <h3 className="font-medium mb-2">unknownFields.operators</h3>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Restrict which operators are allowed for unknown fields. The first operator in the
                array is used as the default when only{' '}
                <code className="text-xs bg-gray-100 dark:bg-gray-800 px-1 rounded">
                  field:value
                </code>{' '}
                is entered.
              </p>
            </div>
          </div>

          <UnknownFieldsDemo />

          <div className="mt-6">
            <CodeBlock code={UNKNOWN_FIELDS_CODE} />
          </div>
        </section>

        {/* Text to Token Conversion */}
        <section className="demo-section">
          <h2 className="text-2xl font-semibold mb-4">Text to Token Conversion</h2>
          <p className="text-gray-600 dark:text-gray-400 mb-6">
            Understanding when and how text is converted to tokens.
          </p>

          {/* Tokenization Triggers */}
          <div className="mb-8">
            <h3 className="text-xl font-medium mb-2">Tokenization Triggers</h3>
            <p className="text-gray-600 dark:text-gray-400 mb-4">
              Filter patterns are tokenized immediately when you type delimiters or paste content.
            </p>
            <AutoTokenizeDemo />
          </div>

          {/* Free Text Mode */}
          <div className="mb-8">
            <h3 className="text-xl font-medium mb-2">Free Text Mode</h3>
            <p className="text-gray-600 dark:text-gray-400 mb-4">
              Control how non-filter text is handled with the{' '}
              <code className="text-xs bg-gray-100 dark:bg-gray-800 px-1 rounded">
                freeTextMode
              </code>{' '}
              prop.
            </p>
            <FreeTextModeDemo />
          </div>

          {/* Quoted Free Text */}
          <div>
            <h3 className="text-xl font-medium mb-2">Quoted Free Text</h3>
            <p className="text-gray-600 dark:text-gray-400 mb-4">
              In <code className="text-xs bg-gray-100 dark:bg-gray-800 px-1 rounded">tokenize</code>{' '}
              mode, typing{' '}
              <code className="text-xs bg-gray-100 dark:bg-gray-800 px-1 rounded">&quot;</code>{' '}
              creates a quoted free text token that preserves spaces and special characters.
            </p>
            <div className="p-4 border border-gray-200 dark:border-gray-700 rounded-lg">
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
                Type{' '}
                <code className="bg-gray-100 dark:bg-gray-800 px-1 rounded">
                  &quot;hello world&quot;
                </code>{' '}
                and press Space:
              </p>
              <p className="text-sm text-gray-500">
                → Creates a single free text token with value{' '}
                <code className="bg-gray-100 dark:bg-gray-800 px-1 rounded">
                  &quot;hello world&quot;
                </code>
              </p>
            </div>
          </div>
        </section>

        {/* Quoted Filter Values */}
        <section className="demo-section">
          <h2 className="text-2xl font-semibold mb-4">Quoted Filter Values</h2>
          <p className="text-gray-600 dark:text-gray-400 mb-4">
            Wrap filter values in double quotes to include spaces or special characters.
          </p>
          <div className="grid gap-4 sm:grid-cols-2 mb-4">
            <div className="p-4 border border-gray-200 dark:border-gray-700 rounded-lg">
              <h4 className="font-medium text-sm mb-2">Without quotes</h4>
              <p className="text-xs text-gray-600 dark:text-gray-400 mb-2">
                <code className="bg-gray-100 dark:bg-gray-800 px-1 rounded">
                  title:contains:hello world
                </code>
              </p>
              <p className="text-xs text-gray-500">
                → Tokenized at space:{' '}
                <code className="bg-gray-100 dark:bg-gray-800 px-1 rounded">
                  title:contains:hello
                </code>{' '}
                + free text <code className="bg-gray-100 dark:bg-gray-800 px-1 rounded">world</code>
              </p>
            </div>
            <div className="p-4 border border-gray-200 dark:border-gray-700 rounded-lg">
              <h4 className="font-medium text-sm mb-2">With quotes</h4>
              <p className="text-xs text-gray-600 dark:text-gray-400 mb-2">
                <code className="bg-gray-100 dark:bg-gray-800 px-1 rounded">
                  title:contains:&quot;hello world&quot;
                </code>
              </p>
              <p className="text-xs text-gray-500">
                → Single filter token with value:{' '}
                <code className="bg-gray-100 dark:bg-gray-800 px-1 rounded">
                  &quot;hello world&quot;
                </code>
              </p>
            </div>
          </div>
          <p className="text-xs text-gray-500">
            <strong>Tip:</strong> Use{' '}
            <code className="bg-gray-100 dark:bg-gray-800 px-1 rounded">allowSpaces: true</code> in
            field definition to allow space input without quotes.
          </p>
        </section>

        {/* Token Editing */}
        <section className="demo-section">
          <h2 className="text-2xl font-semibold mb-4">Token Editing</h2>
          <p className="text-gray-600 dark:text-gray-400 mb-4">
            Tokens are fully editable inline. Click on any part of a token to modify it.
          </p>
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="p-4 border border-gray-200 dark:border-gray-700 rounded-lg">
              <h4 className="font-medium text-sm mb-2">Keyboard Navigation</h4>
              <p className="text-xs text-gray-600 dark:text-gray-400">
                <kbd className="px-1 bg-gray-100 dark:bg-gray-800 rounded text-xs">←</kbd>{' '}
                <kbd className="px-1 bg-gray-100 dark:bg-gray-800 rounded text-xs">→</kbd> between
                tokens,{' '}
                <kbd className="px-1 bg-gray-100 dark:bg-gray-800 rounded text-xs">Backspace</kbd>{' '}
                to delete
              </p>
            </div>
            <div className="p-4 border border-gray-200 dark:border-gray-700 rounded-lg">
              <h4 className="font-medium text-sm mb-2">Inline Editing</h4>
              <p className="text-xs text-gray-600 dark:text-gray-400">
                Click value to edit, click operator to change
              </p>
            </div>
            <div className="p-4 border border-gray-200 dark:border-gray-700 rounded-lg">
              <h4 className="font-medium text-sm mb-2">Immutable Tokens</h4>
              <p className="text-xs text-gray-600 dark:text-gray-400">
                Set{' '}
                <code className="bg-gray-100 dark:bg-gray-800 px-1 rounded text-xs">
                  immutable: true
                </code>{' '}
                in field definition to prevent editing
              </p>
            </div>
          </div>
        </section>

        {/* Custom Suggestions */}
        <section className="demo-section">
          <h2 className="text-2xl font-semibold mb-4">Custom Suggestions</h2>
          <p className="text-gray-600 dark:text-gray-400 mb-6">
            Implement custom suggestion logic with the{' '}
            <code className="text-xs bg-gray-100 dark:bg-gray-800 px-1 rounded">
              suggestions.custom
            </code>{' '}
            prop. The{' '}
            <code className="text-xs bg-gray-100 dark:bg-gray-800 px-1 rounded">suggest</code>{' '}
            function receives the current query and returns suggestions to display.
          </p>

          <div>
            <h3 className="text-lg font-medium mb-2">Example: Smart Value Classification</h3>
            <p className="text-gray-600 dark:text-gray-400 mb-4">
              Match input patterns (email, user ID, etc.) and suggest the appropriate field. Try
              typing{' '}
              <code className="text-xs bg-gray-100 dark:bg-gray-800 px-1 rounded">
                user#123, user#456
              </code>
              ,{' '}
              <code className="text-xs bg-gray-100 dark:bg-gray-800 px-1 rounded">
                test@example.com
              </code>
              , or any text.
            </p>
            <SmartClassifyDemo />
            <div className="mt-4">
              <CodeBlock code={SMART_CLASSIFY_CODE} />
            </div>
          </div>
        </section>

        {/* Clipboard Customization */}
        <section className="demo-section">
          <h2 className="text-2xl font-semibold mb-4">Clipboard Customization</h2>
          <p className="text-gray-600 dark:text-gray-400 mb-6">
            Customize how tokens are serialized when copying and how text is parsed when pasting.
          </p>

          <div className="grid gap-4 sm:grid-cols-2 mb-6">
            <div className="p-4 border border-gray-200 dark:border-gray-700 rounded-lg">
              <h3 className="font-medium mb-2">serializeToken</h3>
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
                Custom format when copying tokens to clipboard.
              </p>
              <code className="text-xs bg-gray-100 dark:bg-gray-800 px-2 py-1 rounded block">
                {`(token) => "Japan" // instead of "country:is:jp"`}
              </code>
            </div>
            <div className="p-4 border border-gray-200 dark:border-gray-700 rounded-lg">
              <h3 className="font-medium mb-2">deserializeText</h3>
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
                Parse custom formats when pasting text.
              </p>
              <code className="text-xs bg-gray-100 dark:bg-gray-800 px-2 py-1 rounded block">
                {`(text) => [{ key: 'country', ... }]`}
              </code>
            </div>
          </div>

          <CodeBlock code={CLIPBOARD_CODE} />
        </section>

        {/* Alternative Usage */}
        <section className="demo-section">
          <h2 className="text-2xl font-semibold mb-4">Alternative Usage</h2>
          <p className="text-gray-600 dark:text-gray-400 mb-6">
            While designed for search filters, the component can be adapted for other use cases.
          </p>

          {/* Simple Tags Input */}
          <div className="mb-10">
            <h3 className="text-xl font-medium mb-2">Simple Tags Input</h3>
            <p className="text-gray-600 dark:text-gray-400 mb-4">
              A minimal tags input using{' '}
              <code className="text-xs bg-gray-100 dark:bg-gray-800 px-1 rounded">
                suggestions.field.disabled
              </code>{' '}
              with{' '}
              <code className="text-xs bg-gray-100 dark:bg-gray-800 px-1 rounded">
                suggestions.custom
              </code>
              ,{' '}
              <code className="text-xs bg-gray-100 dark:bg-gray-800 px-1 rounded">
                tokenLabelDisplay: &apos;hidden&apos;
              </code>
              , and{' '}
              <code className="text-xs bg-gray-100 dark:bg-gray-800 px-1 rounded">
                hideSingleOperator: true
              </code>
              .
            </p>
            <SimpleTagsInputDemo />
            <div className="mt-4">
              <CodeBlock code={SIMPLE_TAGS_CODE} />
            </div>
          </div>

          {/* Advanced Country Selector */}
          <div>
            <h3 className="text-xl font-medium mb-2">Advanced: Async Country Selector</h3>
            <p className="text-gray-600 dark:text-gray-400 mb-4">
              A fully-featured example demonstrating async data fetching, pagination, toggle
              selection, icons (
              <code className="text-xs bg-gray-100 dark:bg-gray-800 px-1 rounded">
                startContent
              </code>
              ), immutable tokens, and clipboard customization.
            </p>

            <div className="mb-4 p-4 bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 rounded-lg">
              <h4 className="font-medium text-sm mb-2">Features demonstrated:</h4>
              <ul className="text-xs text-gray-700 dark:text-gray-300 space-y-1 list-disc list-inside">
                <li>
                  <code className="bg-white dark:bg-gray-900 px-1 rounded">immutable: true</code> -
                  Prevents inline value editing
                </li>
                <li>
                  <code className="bg-white dark:bg-gray-900 px-1 rounded">startContent</code> -
                  Display icon (flag emoji) before label
                </li>
                <li>
                  <code className="bg-white dark:bg-gray-900 px-1 rounded">endContent</code> - Show
                  checkmark for selected items
                </li>
                <li>
                  <code className="bg-white dark:bg-gray-900 px-1 rounded">onSelect</code> - Toggle
                  behavior (click to select/deselect)
                </li>
                <li>
                  <code className="bg-white dark:bg-gray-900 px-1 rounded">loadMore</code> -
                  Infinite scroll pagination
                </li>
                <li>
                  <code className="bg-white dark:bg-gray-900 px-1 rounded">serializeToken</code> /{' '}
                  <code className="bg-white dark:bg-gray-900 px-1 rounded">deserializeText</code> -
                  Clipboard customization
                </li>
                <li>
                  <code className="bg-white dark:bg-gray-900 px-1 rounded">resolveTokens</code> -
                  Async resolution for pasted tokens
                </li>
              </ul>
            </div>

            <AdvancedCountrySelectorDemo />
            <div className="mt-4">
              <CodeBlock code={ADVANCED_COUNTRY_CODE} />
            </div>
          </div>
        </section>

        {/* Documentation Link */}
        <section className="demo-section">
          <h2 className="text-2xl font-semibold mb-4">Documentation</h2>
          <p className="text-gray-600 dark:text-gray-300">
            For complete API reference, props documentation, and usage examples, see the{' '}
            <a
              href="https://github.com/KuruwiC/tokenized-search-input#readme"
              className="text-blue-600 dark:text-blue-400 underline hover:no-underline"
            >
              README on GitHub
            </a>
            .
          </p>
        </section>

        {/* Footer */}
        <footer className="py-8 text-center text-sm text-gray-500 dark:text-gray-400">
          <p>
            MIT License.{' '}
            <a
              href="https://github.com/KuruwiC/tokenized-search-input"
              className="underline hover:text-gray-700 dark:hover:text-gray-300"
            >
              View on GitHub
            </a>
          </p>
        </footer>
      </main>
    </div>
  );
}
