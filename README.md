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

    // Optional
    icon: <TagIcon />, // Icon shown in token
    tokenLabelDisplay: "hidden", // 'auto' | 'icon-only' | 'hidden'
    hideSingleOperator: true, // Hide operator when only one available
    immutable: false, // Prevent inline editing (delete only)
    allowSpaces: false, // Allow spaces in value without quotes
    operatorLabels: {
      // Custom operator display labels
      is: { display: "=", select: "equals" },
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

## Props

### Core Props

| Prop            | Type                                        | Default       | Description                               |
| --------------- | ------------------------------------------- | ------------- | ----------------------------------------- |
| `fields`        | `FieldDefinition[]`                         | required      | Array of field definitions                |
| `defaultValue`  | `string`                                    | `''`          | Initial query string                      |
| `placeholder`   | `string`                                    | `'Search...'` | Placeholder text                          |
| `onSubmit`      | `(snapshot: QuerySnapshot) => void`         | -             | Called when submit is triggered           |
| `onChange`      | `(snapshot: QuerySnapshot) => void`         | -             | Called when content changes               |
| `onTokenCreate` | `(token: QuerySnapshotFilterToken) => void` | -             | Called when a new filter token is created |
| `onTokenDelete` | `(tokenId: string) => void`                 | -             | Called when a filter token is deleted     |
| `onTokenUpdate` | `(token: QuerySnapshotFilterToken) => void` | -             | Called when a filter token is updated     |
| `onBlur`        | `(snapshot: QuerySnapshot) => void`         | -             | Called when the input loses focus         |
| `onFocus`       | `(snapshot: QuerySnapshot) => void`         | -             | Called when the input gains focus         |
| `onClear`       | `() => void`                                | -             | Called when the clear button is clicked   |
| `disabled`      | `boolean`                                   | `false`       | Disable the input                         |
| `className`     | `string`                                    | -             | Custom class for container                |
| `freeTextMode`  | `'none' \| 'plain' \| 'tokenize'`           | `'plain'`     | How to handle free text input             |

### Display Props

| Prop            | Type         | Default | Description                                             |
| --------------- | ------------ | ------- | ------------------------------------------------------- |
| `clearable`     | `boolean`    | `false` | Show clear button                                       |
| `className`     | `string`     | -       | Custom class for root container (merged with `classNames.root`) |
| `classNames`    | `ClassNames` | -       | Custom classes for component parts (see below)          |
| `singleLine`    | `boolean`    | `false` | Single line with horizontal scroll                      |
| `expandOnFocus` | `boolean`    | `false` | Collapse to single line when unfocused, expand on focus |

#### `classNames` - Component Part Styling

```tsx
classNames={{
  root?: string,              // Root container
  input?: string,             // Editor content area
  placeholder?: string,       // Placeholder text
  clearButton?: string,       // Clear button
  token?: string,             // Token wrapper
  tokenLabel?: string,        // Token field label
  tokenOperator?: string,     // Token operator
  tokenValue?: string,        // Token value
  tokenDeleteButton?: string, // Token delete button
  dropdown?: string,          // Suggestion dropdown
  suggestionItem?: string,    // Suggestion item
  fieldCategory?: string,     // Field category header
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

  // Helpers
  createToggleSelectHandler, // Create toggle selection handler for custom suggestions
} from "@kuruwic/tokenized-search-input/utils";
```

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

### Toggle Selection Example

```tsx
import { createToggleSelectHandler } from "@kuruwic/tokenized-search-input/utils";

const customSuggestion = {
  suggest: ({ query }) => [...],
  // Toggle behavior: insert if not exists, delete if exists
  onSelect: createToggleSelectHandler({
    matchBy: (token, suggested) =>
      token.key === suggested.key && token.value === suggested.value,
  }),
};
```

## Requirements

- React 18 or 19

## License

MIT
