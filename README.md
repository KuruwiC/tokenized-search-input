# Tokenized Search Input

A React component for building advanced search interfaces with tokenized filters, autocomplete suggestions, and date pickers. Built on [TipTap](https://tiptap.dev/) and [ProseMirror](https://prosemirror.net/).

![Demo](https://github.com/user-attachments/assets/29e203d5-2b68-45c8-8c0f-5b901e5ade9d)

**[Live Demo](https://kuruwic.github.io/tokenized-search-input/)**

## Features

- **Tokenized filters** — Create structured filter tokens like `status:is:active`
- **Multiple field types** — String, enum, date, and datetime
- **Autocomplete suggestions** — Field and value suggestions with custom logic support
- **Inline editing** — Click to edit any part of a token
- **Validation** — Built-in rules for uniqueness, max count, patterns, and custom validation
- **Date/time pickers** — Built-in pickers with customizable format and locale
- **Copy & paste** — Smart clipboard handling with customizable serialization
- **Keyboard navigation** — Full keyboard support for accessibility
- **Dark mode** — CSS variables for easy theming

## Installation

> **Note:** This package is not yet published to npm. Install directly from GitHub releases.

```bash
# pnpm (recommended)
pnpm add https://github.com/KuruwiC/tokenized-search-input/releases/download/v0.1.0/kuruwic-tokenized-search-input-0.1.0.tgz

# npm
npm install https://github.com/KuruwiC/tokenized-search-input/releases/download/v0.1.0/kuruwic-tokenized-search-input-0.1.0.tgz

# yarn
yarn add https://github.com/KuruwiC/tokenized-search-input/releases/download/v0.1.0/kuruwic-tokenized-search-input-0.1.0.tgz
```

Or add directly to your `package.json`:

```json
{
  "dependencies": {
    "@kuruwic/tokenized-search-input": "https://github.com/KuruwiC/tokenized-search-input/releases/download/v0.1.0/kuruwic-tokenized-search-input-0.1.0.tgz"
  }
}
```

## Quick Start

```tsx
import { TokenizedSearchInput } from "@kuruwic/tokenized-search-input";
import "@kuruwic/tokenized-search-input/styles";

const fields = [
  {
    key: "status",
    label: "Status",
    type: "enum",
    operators: ["is", "is_not"],
    enumValues: ["active", "inactive", "pending"],
  },
  {
    key: "title",
    label: "Title",
    type: "string",
    operators: ["contains", "starts_with"],
  },
];

function App() {
  const handleSearch = (snapshot) => {
    console.log("Segments:", snapshot.segments);
    console.log("Text:", snapshot.text);
  };

  return <TokenizedSearchInput fields={fields} onSubmit={handleSearch} placeholder="Search..." />;
}
```

## Field Configuration

```tsx
import type { FieldDefinition } from "@kuruwic/tokenized-search-input/utils";

const fields: FieldDefinition[] = [
  {
    // Required
    key: "status", // Unique identifier for the field
    label: "Status", // Display name in suggestions
    type: "enum", // 'string' | 'enum' | 'date' | 'datetime'
    operators: ["is", "is_not"], // Operators for this field (first is default)

    // Type-specific (enum)
    enumValues: ["active", "inactive", "pending"],

    // Optional - Display
    icon: <TagIcon />, // Icon shown in token
    hint: <span>Hint text</span>, // Hint shown in suggestions
    tokenLabelDisplay: "hidden", // 'auto' | 'icon-only' | 'hidden'
    hideSingleOperator: true, // Hide operator when only one available
    immutable: false, // Prevent inline editing (delete only)
    allowSpaces: false, // Allow spaces in value without quotes
    operatorLabels: {
      // Custom operator display labels
      is: { display: "=", select: "equals" },
    },
    category: "Filters", // Group fields in suggestions dropdown

    // Optional - Value handling
    validate: (value) => value.length > 0 || "Value required", // Field-level validation
    sanitize: (value) => value.trim(), // Transform value before saving
    getValues: async (query) => fetchValues(query), // Async value suggestions

    // Optional - Per-rule validation override
    validation: {
      "unique-key": false, // Disable specific rule for this field
    },
  },
];
```

### Field Types

| Type       | Description                                                          |
| ---------- | -------------------------------------------------------------------- |
| `string`   | Free-form text input                                                 |
| `enum`     | Predefined values with autocomplete. Requires `enumValues`           |
| `date`     | Date picker with optional `formatConfig` and `renderPicker`          |
| `datetime` | Date and time picker with optional `formatConfig` and `renderPicker` |

### Custom Date Picker

For `date` and `datetime` fields, you can provide a custom picker component:

```tsx
{
  key: 'due_date',
  label: 'Due Date',
  type: 'date',
  operators: ['is', 'gt', 'lt'],
  renderPicker: (props) => <MyCustomDatePicker {...props} />,
}
```

**DatePickerRenderProps:**

| Prop | Type | Description |
|------|------|-------------|
| `value` | `Date \| null` | Current date value (reflects keyboard input in realtime) |
| `onChange` | `(date: Date \| null) => void` | Called when date is selected |
| `onClose` | `() => void` | Called when picker should close |
| `fieldDef` | `DateFieldDefinition` | Field configuration (includes minDate, maxDate, etc.) |
| `restoreFocus` | `() => void` | Restore focus to token input after selection |
| `defaultMonth` | `Date` | Initial calendar month hint |
| `confirmedValue` | `Date \| null` | Last committed value (before current input changes) |

**DateTimePickerRenderProps** extends DatePickerRenderProps with:

| Prop | Type | Description |
|------|------|-------------|
| `timeControls` | `DateTimeTimeControls` | Time controls for UTC mode and include time toggle |

**DateTimeTimeControls:**

| Prop | Type | Description |
|------|------|-------------|
| `isUTC` | `boolean` | Current UTC mode state |
| `onUTCChange` | `(isUTC: boolean) => void` | Toggle UTC mode |
| `includeTime` | `boolean` | Current include time state (only when `timeRequired` is false) |
| `onIncludeTimeChange` | `(includeTime: boolean) => void` | Toggle include time |

### Date/DateTime Field Options

For `date` and `datetime` fields, additional configuration options are available:

```tsx
{
  key: 'due_date',
  label: 'Due Date',
  type: 'date',
  operators: ['is', 'gt', 'lt'],
  // Date constraints
  minDate: new Date('2024-01-01'),        // Date object or ISO string
  maxDate: new Date('2024-12-31'),
  disabledDates: (date) => date.getDay() === 0, // Disable Sundays
  // Picker customization
  closeButtonLabel: 'Done',               // Custom close button label (defaults to check icon)
}
```

For `datetime` fields, additional time options:

```tsx
{
  key: 'scheduled_at',
  label: 'Scheduled At',
  type: 'datetime',
  operators: ['gt', 'lt'],
  timeOptions: {
    hour24: false,  // Use 12-hour format with AM/PM (default: true)
  },
  timeRequired: false,  // false (default): Show "Include time" checkbox, allow date-only values
                        // true: Time is always required, date-only values are normalized to datetime
}
```

### Operators

The `operators` array accepts any string values. The library provides defaults (`is`, `is_not`, `contains`, `gt`, `lt`, etc.) but you can use custom operators that match your API.

## Validation

```tsx
import { TokenizedSearchInput } from "@kuruwic/tokenized-search-input";
import {
  Unique,
  MaxCount,
  RequirePattern,
  RequireEnum,
  createRule,
  createFieldRule,
} from "@kuruwic/tokenized-search-input/utils";

<TokenizedSearchInput
  fields={fields}
  validation={{
    rules: [
      // Prevent duplicate tokens
      Unique.rule("exact"),

      // Limit total tokens
      MaxCount.rule("*", 5),

      // Auto-delete new duplicates instead of highlighting
      Unique.rule("exact", Unique.reject),

      // Validate value format
      RequirePattern.rule("email", /^[^\s@]+@[^\s@]+\.[^\s@]+$/),

      // Restrict enum fields to predefined values only
      RequireEnum.rule(),

      // Custom validation rule with full control
      createRule(
        (token, allTokens, currentIndex) => {
          if (token.key === "status" && token.value === "deleted") {
            return 'Cannot use "deleted" status';
          }
        },
        { id: "no-deleted-status" },
      ),

      // Field-specific validation (also receives allTokens and operator)
      createFieldRule("age", (value, allTokens, operator) => {
        const num = parseInt(value, 10);
        if (isNaN(num) || num < 0 || num > 150) {
          return "Age must be between 0 and 150";
        }
      }),
    ],
  }}
/>;
```

### Validation Strategies

Each validation rule supports strategies that control how violations are handled:

| Rule | Strategy | Description |
|------|----------|-------------|
| `Unique` | `Unique.mark` (default) | Highlight duplicates as invalid |
| | `Unique.reject` | Auto-delete new duplicates |
| | `Unique.replace` | Replace existing with new duplicate |
| `MaxCount` | `MaxCount.mark` (default) | Highlight excess tokens as invalid |
| | `MaxCount.reject` | Auto-delete tokens that exceed limit |
| `RequirePattern` | `RequirePattern.mark` (default) | Highlight invalid format |
| | `RequirePattern.reject` | Auto-delete invalid tokens |
| `RequireEnum` | `RequireEnum.mark` (default) | Highlight invalid enum values |
| | `RequireEnum.reject` | Auto-delete invalid enum values |

### Unique Constraints

The `Unique.rule()` accepts a constraint parameter:

| Constraint | Description |
|------------|-------------|
| `'key'` | Only one token per field key (e.g., one `status` filter) |
| `'key-operator'` | Only one token per field key + operator combination |
| `'exact'` | No duplicate key + operator + value combinations |

```tsx
// Only one status filter allowed
Unique.rule("key");

// Allow status:is and status:is_not, but not two status:is
Unique.rule("key-operator");

// Allow status:is:active and status:is:pending (different values)
Unique.rule("exact");
```

## Custom Suggestions

```tsx
import { TokenizedSearchInput } from "@kuruwic/tokenized-search-input";
import { matchers } from "@kuruwic/tokenized-search-input/utils";

<TokenizedSearchInput
  fields={fields}
  suggestions={{
    // Field name suggestion settings
    field: {
      disabled: false, // Disable field autocomplete
      matcher: matchers.fuzzy, // Custom matcher (also: matchers.prefix, matchers.exact, matchers.caseInsensitive)
    },
    // Value suggestion settings
    value: {
      disabled: false, // Disable value autocomplete for enum fields
    },
    // Custom suggestion configuration
    custom: {
      // 'replace' - Replace field suggestions (default)
      // 'prepend' - Show above field suggestions
      // 'append'  - Show below field suggestions
      displayMode: "replace",
      suggest: ({ query, existingTokens }) => {
        return [
          {
            tokens: [{ key: "tag", operator: "is", value: query }],
            label: `Add tag: ${query}`,
          },
        ];
      },
    },
  }}
/>
```

### CustomSuggestionConfig Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `suggest` | `(ctx: SuggestContext) => SuggestFnReturn` | required | Generate suggestions from input text |
| `loadMore` | `(ctx: SuggestContextWithPagination) => Promise<CustomSuggestionResult>` | - | Load more suggestions for pagination |
| `displayMode` | `'replace' \| 'prepend' \| 'append'` | `'replace'` | Display mode relative to field suggestions |
| `debounceMs` | `number` | `150` | Debounce delay in milliseconds |
| `maxSuggestions` | `number` | `5` | Maximum number of suggestions to display |
| `timeoutMs` | `number` | `5000` | Timeout for suggestion requests in milliseconds |
| `onError` | `(error: Error, ctx: SuggestionErrorContext) => void` | - | Error handler for suggestion failures |
| `onSelect` | `(suggestion: CustomSuggestion, ctx: CustomSuggestionSelectContext) => boolean` | - | Custom selection handler |

### SuggestedFilterToken

When defining tokens in a `CustomSuggestion`, you can use these properties:

```typescript
interface SuggestedFilterToken {
  key: string;           // Field key
  operator: string;      // Operator
  value: string;         // Token value
  displayValue?: string; // Display label (for dynamic enum values)
  startContent?: ReactNode; // Icon/emoji before label
  endContent?: ReactNode;   // Badge/indicator after label
}
```

### Error Handling

Handle errors from async suggestion operations:

```tsx
suggestions={{
  custom: {
    suggest: async ({ query }) => fetchSuggestions(query),
    onError: (error, context) => {
      console.error(`Suggestion ${context.type} failed:`, error);
      // context.type: 'suggest' | 'loadMore'
      // context.query: query text at time of error
    },
  },
}}
```

### Custom Selection Handler

Implement toggle behavior (insert if not exists, delete if exists):

```tsx
import { createToggleSelectHandler } from "@kuruwic/tokenized-search-input/utils";

suggestions={{
  custom: {
    suggest: ({ query }) => [...],
    // Built-in toggle helper
    onSelect: createToggleSelectHandler(),

    // Or custom logic
    onSelect: (suggestion, { existingTokens, deleteToken }) => {
      const token = suggestion.tokens[0];
      const existing = existingTokens.find(
        t => t.key === token.key && t.value === token.value
      );
      if (existing) {
        deleteToken(existing.id);
        return true; // handled, skip default insert
      }
      return false; // not handled, run default insert
    },
  },
}}
```

### Pagination

For large datasets, implement pagination with `loadMore`:

```tsx
suggestions={{
  custom: {
    suggest: async ({ query }) => {
      const { items, hasMore } = await fetchPage(query, 0, 10);
      return { suggestions: items, hasMore };
    },
    loadMore: async ({ query, offset, limit }) => {
      const { items, hasMore } = await fetchPage(query, offset, limit);
      return { suggestions: items, hasMore };
    },
    maxSuggestions: 10,
  },
}}

// Customize pagination labels
<TokenizedSearchInput
  labels={{
    pagination: {
      loading: "Loading...",
      scrollForMore: "Scroll for more",
    },
  }}
/>
```

## Props

### Core Props

| Prop            | Type                                        | Default       | Description                               |
| --------------- | ------------------------------------------- | ------------- | ----------------------------------------- |
| `fields`        | `FieldDefinition[]`                         | required      | Array of field definitions                |
| `defaultValue`  | `string`                                    | `''`          | Initial query string                      |
| `placeholder`   | `string`                                    | `'Search...'` | Placeholder text                          |
| `onSubmit`       | `(snapshot: QuerySnapshot) => void`         | -             | Called when submit is triggered           |
| `onChange`       | `(snapshot: QuerySnapshot) => void`         | -             | Called when content changes               |
| `onTokensChange` | `(snapshot: QuerySnapshot) => void`         | -             | Called when non-focused tokens change     |
| `onBlur`         | `(snapshot: QuerySnapshot) => void`         | -             | Called when the input loses focus         |
| `onFocus`       | `(snapshot: QuerySnapshot) => void`         | -             | Called when the input gains focus         |
| `onClear`       | `() => void`                                | -             | Called when the clear button is clicked   |
| `disabled`      | `boolean`                                   | `false`       | Disable the input                         |
| `className`     | `string`                                    | -             | Custom class for container                |
| `freeTextMode`  | `'none' \| 'plain' \| 'tokenize'`           | `'plain'`     | How to handle free text input             |

### Display Props

| Prop                | Type         | Default | Description                                                       |
| ------------------- | ------------ | ------- | ----------------------------------------------------------------- |
| `clearable`         | `boolean`    | `false` | Show clear button                                                 |
| `className`         | `string`     | -       | Custom class for root container (merged with `classNames.root`)   |
| `classNames`        | `ClassNames` | -       | Custom classes for component parts (see below)                    |
| `singleLine`        | `boolean`    | `false` | Single line with horizontal scroll                                |
| `expandOnFocus`     | `boolean`    | `false` | Collapse to single line when unfocused, expand on focus           |
| `startAdornment`    | `ReactNode`  | -       | Element to render at the start of the input (e.g., search icon)   |
| `endAdornment`      | `ReactNode`  | -       | Element to render at the end of the input (before clear button)   |
| `immediatelyRender` | `boolean`    | `true`  | Render editor immediately. Set to `false` for SSR (e.g., Next.js) |

#### `classNames` - Component Part Styling

```tsx
classNames={{
  // Root-level
  root?: string,                      // Root container
  input?: string,                     // Editor content area
  placeholder?: string,               // Placeholder text
  clearButton?: string,               // Clear button
  startAdornment?: string,            // Start adornment container
  endAdornment?: string,              // End adornment container
  // Token
  token?: string,                     // Token wrapper
  tokenLabel?: string,                // Token field label
  tokenOperator?: string,             // Token operator
  tokenValue?: string,                // Token value
  tokenDeleteButton?: string,         // Token delete button
  // Suggestions
  dropdown?: string,                  // Suggestion dropdown
  operatorDropdown?: string,          // Operator dropdown
  operatorDropdownItem?: string,      // Operator dropdown item
  suggestionItem?: string,            // Suggestion item
  suggestionItemHint?: string,        // Suggestion item hint text
  suggestionItemDescription?: string, // Suggestion item description
  suggestionItemIcon?: string,        // Suggestion item icon
  fieldCategory?: string,             // Field category header
  divider?: string,                   // Divider between custom and field suggestions
}}
```

Both `className` and `classNames.root` can be used together - they are merged.

### Configuration Props (Grouped)

Related settings are grouped into object props for better organization:

#### `suggestions` - Suggestion Configuration

```tsx
suggestions={{
  field?: {
    disabled?: boolean,         // Disable field autocomplete
    matcher?: Matcher,          // Custom matcher for field suggestions
  },
  value?: {
    disabled?: boolean,         // Disable value autocomplete for enum fields
  },
  custom?: CustomSuggestionConfig,  // Custom suggestion configuration
}}
```

#### `validation` - Validation Configuration

```tsx
validation={{
  rules?: ValidationRule[],     // Array of validation rules
}}
```

#### `unknownFields` - Unknown Field Configuration

```tsx
unknownFields={{
  allow?: boolean,              // Allow fields not in the fields array
  operators?: (DefaultOperator | string)[],  // Operators allowed for unknown fields
  hideSingleOperator?: boolean, // Hide operator when only one available
}}
```

#### `initialDelimiter` - Token Delimiter

```tsx
initialDelimiter?: string  // Token delimiter (frozen after mount, default: ':')
```

Affects parsing (input/paste) and serialization (output/copy). Example: `'status:is:active'` with delimiter `':'`. The `initial` prefix indicates this value cannot be changed after component mount.

#### `serialization` - Clipboard Serialization Configuration

```tsx
serialization={{
  serializeToken?: (token) => string | null,  // Custom copy format
  deserializeText?: (text) => ParsedToken[] | null,  // Custom paste parser
}}
```

#### `labels` - Label Configuration (i18n)

```tsx
labels={{
  operators?: OperatorLabels,   // Custom operator display labels
  pagination?: PaginationLabels, // Custom pagination labels
}}
```

#### `pickers` - Date Picker Configuration

```tsx
pickers={{
  renderDate?: (props: DatePickerRenderProps) => ReactNode,
  renderDateTime?: (props: DateTimePickerRenderProps) => ReactNode,
}}
```

## Ref Methods

```tsx
const ref = useRef<TokenizedSearchInputRef>(null);

// Available methods
ref.current.setValue(value); // Set query string
ref.current.getValue(); // Get current query string
ref.current.getSnapshot(); // Get current QuerySnapshot
ref.current.focus(); // Focus the input
ref.current.clear(); // Clear all content
ref.current.submit(); // Trigger submit
```

## Styling

The component uses CSS variables for theming. Import the default styles:

```tsx
import "@kuruwic/tokenized-search-input/styles";
```

### CSS Variables

All styles are customizable via `--tsi-*` CSS variables. Override them in your CSS:

```css
:root {
  /* Colors */
  --tsi-background: hsl(0 0% 100%);
  --tsi-foreground: hsl(0 0% 3.9%);
  --tsi-muted: hsl(0 0% 96.1%);
  --tsi-muted-foreground: hsl(0 0% 45.1%);
  --tsi-muted-darker: hsl(0 0% 83.1%);
  --tsi-border: hsl(0 0% 89.8%);
  --tsi-border-hover: hsl(0 0% 63.9%);
  --tsi-border-focus: hsl(0 0% 9%);
  --tsi-primary: hsl(0 0% 9%);
  --tsi-primary-muted: hsl(0 0% 96.1%);
  --tsi-primary-muted-foreground: hsl(0 0% 9%);
  --tsi-secondary: hsl(0 0% 45.1%);
  --tsi-destructive: hsl(0 84.2% 60.2%);
  --tsi-destructive-muted: hsl(0 84.2% 97%);
  --tsi-selection: hsl(0 0% 65%);
  --tsi-selection-foreground: hsl(0 0% 9%);

  /* Sizing */
  --tsi-font-size: 1rem;
  --tsi-padding-x: 0.75rem;
  --tsi-padding-y: 0.5rem;
  --tsi-min-height: 2.75rem;
  --tsi-token-size: 1.5rem;
  --tsi-token-font-size: 1rem;
  --tsi-token-icon-size: 0.875rem;
  --tsi-token-spacer-width: 0.25rem;
  --tsi-token-gap-y: 0.25rem;
  --tsi-radius: 0.5rem;
  --tsi-radius-inner: 0.25rem;
  --tsi-border-width: 1px;

  /* Focus ring */
  --tsi-ring-width: 0px;
  --tsi-ring-color: hsl(0 0% 9%);
  --tsi-ring-offset: 0px;
  --tsi-ring-offset-color: hsl(0 0% 100%);

  /* Misc */
  --tsi-shadow: 0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1);
  --tsi-z-dropdown: 50;
  --tsi-expand-max-lines: 4;
}
```

### Dark Mode

Apply dark mode by setting variables under a `.dark` class (or any selector):

```css
.dark {
  --tsi-background: hsl(0 0% 3.9%);
  --tsi-foreground: hsl(0 0% 98%);
  --tsi-muted: hsl(0 0% 14.9%);
  --tsi-muted-foreground: hsl(0 0% 63.9%);
  --tsi-muted-darker: hsl(0 0% 26%);
  --tsi-border: hsl(0 0% 14.9%);
  --tsi-border-hover: hsl(0 0% 45.1%);
  --tsi-border-focus: hsl(0 0% 98%);
  --tsi-ring-color: hsl(0 0% 98%);
  --tsi-ring-offset-color: hsl(0 0% 3.9%);
  --tsi-primary: hsl(0 0% 98%);
  --tsi-primary-muted: hsl(0 0% 14.9%);
  --tsi-primary-muted-foreground: hsl(0 0% 98%);
  --tsi-secondary: hsl(0 0% 63.9%);
  --tsi-destructive: hsl(0 62.8% 50.6%);
  --tsi-destructive-muted: hsl(0 63% 15%);
  --tsi-selection: hsl(0 0% 40%);
  --tsi-selection-foreground: hsl(0 0% 98%);
}
```

### Tailwind CSS Integration

Component styles use `:where()` for zero specificity and CSS layers, allowing Tailwind utilities to override defaults seamlessly.

**Tailwind v4:**

```css
@import "tailwindcss";
@import "@kuruwic/tokenized-search-input/styles";
```

**Tailwind v3 (with PostCSS):**

```css
@tailwind base;
@tailwind components;
@tailwind utilities;

@import "@kuruwic/tokenized-search-input/styles";
```

Then use `classNames` to apply Tailwind utilities:

```tsx
<TokenizedSearchInput
  fields={fields}
  className="shadow-lg"
  classNames={{
    input: "bg-slate-50",
    token: "bg-indigo-100 border-indigo-300",
    dropdown: "shadow-2xl",
  }}
/>
```

## Utilities

The library exports several utility functions for advanced use cases:

```tsx
// UI hooks (client-side only)
import { useAsyncTokenResolver } from "@kuruwic/tokenized-search-input";

// Utilities and helpers (server-safe)
import {
  // Matchers for field/value filtering
  matchers,              // { fuzzy, prefix, exact, caseInsensitive }
  defaultMatcher,        // Default matcher (fuzzy)
  matchBest,             // Get best match score from multiple targets

  // Label resolution utilities
  labelResolvers,        // { caseInsensitive, exact }
  defaultLabelResolver,  // Default resolver (caseInsensitive)
  resolveLabel,          // Resolve input to field key
  resolveLabelToField,   // Resolve input to FieldDefinition

  // Enum value utilities
  filterEnumValues,      // Filter enum values by query
  enumResolvers,         // { exact, caseInsensitive }
  defaultEnumResolver,   // Default enum resolver (caseInsensitive)
  getEnumValue,          // Extract value from EnumValue
  getEnumLabel,          // Extract label from EnumValue
  getEnumIcon,           // Extract icon from EnumValue
  isEnumValueWithLabel,  // Type guard for EnumValueWithLabel
  resolveEnumValue,      // Resolve enum value with options

  // Generic filtering
  filterItems,           // Filter any items with custom target extraction

  // Query Snapshot helpers
  EMPTY_SNAPSHOT,        // Empty snapshot constant { segments: [], text: '' }
  getFilterTokens,       // Extract filter tokens from snapshot
  getFreeTextTokens,     // Extract free text tokens from snapshot
  getPlainText,          // Extract plain text segments concatenated

  // Helpers
  createToggleSelectHandler, // Create toggle selection handler for custom suggestions
} from "@kuruwic/tokenized-search-input/utils";
```

### Query Snapshot Helpers

Extract specific segments from a `QuerySnapshot`:

```tsx
import {
  EMPTY_SNAPSHOT,
  getFilterTokens,
  getFreeTextTokens,
  getPlainText,
} from "@kuruwic/tokenized-search-input/utils";

// Get only filter tokens from snapshot
const filters = getFilterTokens(snapshot);
// [{ type: 'filter', key: 'status', operator: 'is', value: 'active', ... }]

// Get only free text tokens (when freeTextMode='tokenize')
const freeTexts = getFreeTextTokens(snapshot);
// [{ type: 'freeText', value: 'search term', ... }]

// Get plain text segments concatenated (when freeTextMode='plain')
const plainText = getPlainText(snapshot);
// "search term"

// Empty snapshot constant for initialization
const empty = EMPTY_SNAPSHOT; // { segments: [], text: '' }
```

### useAsyncTokenResolver

A hook for resolving display values asynchronously for pasted or deserialized tokens. When tokens are created from pasted text, they often only have a raw `value` but no `displayValue` or icons. This hook provides a convenient way to fetch and update display data.

**Resolution Conditions**: Tokens are resolved when:

- `displayValue` is not set
- Token is confirmed (not being edited)

This prevents display updates during active editing which would disrupt user input.

```tsx
import { useAsyncTokenResolver } from "@kuruwic/tokenized-search-input";

const inputRef = useRef<TokenizedSearchInputRef>(null);

const { resolveTokens } = useAsyncTokenResolver({
  inputRef,
  fieldKey: 'country',
  resolve: async (values) => {
    // Fetch data for the given values
    const { countries } = await fetchCountries({ values });
    return countries;
  },
  getValue: (c) => c.value,  // Extract original value for matching
  getDisplayData: (c) => ({
    displayValue: c.label,
    startContent: <span>{c.emoji}</span>,
  }),
  // Optional: Show loading state while resolving
  loadingContent: {
    displayValue: 'Loading...',
    startContent: <Loader2 className="animate-spin" />,
  },
  // Optional: What to do if value is not found ('delete' | 'keep', default: 'delete')
  onNotFound: 'delete',
});

// Trigger resolution on change
<TokenizedSearchInput ref={inputRef} onChange={resolveTokens} />;
```

**Options:**

| Option | Type | Required | Description |
|--------|------|----------|-------------|
| `inputRef` | `RefObject<TokenizedSearchInputRef>` | Yes | Ref to the input component |
| `fieldKey` | `string` | Yes | Field key to resolve (e.g., 'country') |
| `resolve` | `(values: string[]) => Promise<T[]>` | Yes | Fetch data for given values |
| `getValue` | `(item: T) => string` | Yes | Extract original value from resolved item |
| `getDisplayData` | `(item: T) => ResolvedTokenData` | Yes | Convert item to display data |
| `loadingContent` | `{ displayValue?, startContent? }` | No | Content to show while loading |
| `onNotFound` | `'delete' \| 'keep'` | No | Action when value not found (default: `'delete'`) |

### Matchers

A `Matcher` scores how well a user's input matches a target string: `(input: string, target: string) => number`

| Score | Meaning |
|-------|---------|
| `0` | No match |
| `1-99` | Partial match (higher = better) |
| `100` | Exact match |

Built-in matchers:

| Matcher | Description |
|---------|-------------|
| `fuzzy` (default) | fzf-style fuzzy matching |
| `prefix` | Prefix matching |
| `exact` | Case-sensitive exact match |
| `caseInsensitive` | Case-insensitive exact match |

Use `suggestionMatcher` in a field definition to customize:

```tsx
const field = {
  key: 'status',
  type: 'enum',
  enumValues: ['active', 'inactive'],
  suggestionMatcher: matchers.prefix,
};
```

### Enum Resolvers

An `EnumValueResolver` determines which enum value the user's input resolves to. Unlike matchers (used for suggestion filtering), resolvers are used to **confirm** a value when the user finishes typing.

Built-in resolvers:

| Resolver | Description |
|----------|-------------|
| `caseInsensitive` (default) | Case-insensitive match against both value and label |
| `exact` | Case-sensitive match against both value and label |

Both built-in resolvers match user input against **value** and **label**, returning the internal value on match. This enables label-to-value resolution when using `{ value, label }` enum definitions:

```tsx
const field = {
  key: 'country',
  type: 'enum',
  enumValues: [
    { value: 'us', label: 'United States' },
    { value: 'jp', label: 'Japan' },
  ],
  // Default (caseInsensitive): "japan" → "jp", "JP" → "jp"
  // With exact: "Japan" → "jp", "japan" → no match
};
```

Use `valueResolver` in a field definition to customize:

```tsx
const field = {
  key: 'status',
  type: 'enum',
  enumValues: ['active', 'inactive'],
  valueResolver: enumResolvers.exact,
};
```

### Label Resolvers

A `LabelResolver` determines how user input is matched to field definitions when resolving field names:

```tsx
import { labelResolvers, resolveLabel, resolveLabelToField } from "@kuruwic/tokenized-search-input/utils";

// Resolve input to field key
resolveLabel(fields, 'Status')     // → 'status' (case-insensitive match)
resolveLabel(fields, 'STATUS')     // → 'status'
resolveLabel(fields, 'unknown')    // → 'unknown' (no match, returns original)

// Get full field definition
const field = resolveLabelToField(fields, 'Status');
if (field) {
  console.log(field.operators); // ['is', 'is_not']
}

// Use case-sensitive matching
resolveLabel(fields, 'Status', { resolver: labelResolvers.exact })
```

Built-in resolvers:

| Resolver | Description |
|----------|-------------|
| `caseInsensitive` (default) | Case-insensitive exact match |
| `exact` | Case-sensitive exact match |

### Toggle Selection Example

```tsx
import { createToggleSelectHandler } from "@kuruwic/tokenized-search-input/utils";

const customSuggestion = {
  suggest: ({ query }) => [...],
  // Toggle behavior: insert if not exists, delete if exists
  onSelect: createToggleSelectHandler(), // Default: match by key and value
};

// Match by value only (for single-field scenarios)
const singleFieldSuggestion = {
  suggest: ({ query }) => [...],
  onSelect: createToggleSelectHandler({ match: 'value' }),
};
```

## Requirements

- React 18 or 19

## License

MIT
