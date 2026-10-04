# Tokenized Search Input

A React component for building advanced search interfaces with tokenized filters, autocomplete suggestions, and date pickers. Built on [TipTap](https://tiptap.dev/) and [ProseMirror](https://prosemirror.net/).

![Demo](https://github.com/user-attachments/assets/29e203d5-2b68-45c8-8c0f-5b901e5ade9d)

**[Live Demo](https://kuruwic.github.io/tokenized-search-input/)**

## Features

- **Tokenized filters** — Create structured filter tokens like `status:is:active`
- **Multiple field types** — String, enum, date, and datetime
- **Autocomplete suggestions** — Field and value suggestions with custom logic support
- **Inline editing** — Click to edit any part of a token
- **Validation** — Built-in rules for uniqueness, max count, patterns, and custom validation, with a message on every invalid token
- **Date/time pickers** — Built-in pickers with typed `DateTimeValue`s, customizable format and locale
- **Copy & paste** — Smart clipboard handling with customizable serialization
- **Keyboard navigation** — Full keyboard support for accessibility
- **Dark mode** — Follows the system preference, and CSS variables for theming

## Installation

> **Note:** This package is not yet published to npm. Install directly from GitHub releases.

```bash
# pnpm (recommended)
pnpm add https://github.com/KuruwiC/tokenized-search-input/releases/download/v0.1.1/kuruwic-tokenized-search-input-0.1.1.tgz

# npm
npm install https://github.com/KuruwiC/tokenized-search-input/releases/download/v0.1.1/kuruwic-tokenized-search-input-0.1.1.tgz

# yarn
yarn add https://github.com/KuruwiC/tokenized-search-input/releases/download/v0.1.1/kuruwic-tokenized-search-input-0.1.1.tgz
```

Or add directly to your `package.json`:

```json
{
  "dependencies": {
    "@kuruwic/tokenized-search-input": "https://github.com/KuruwiC/tokenized-search-input/releases/download/v0.1.1/kuruwic-tokenized-search-input-0.1.1.tgz"
  }
}
```

The package has three entry points: `@kuruwic/tokenized-search-input` (the component, hooks, pickers and every public type), `@kuruwic/tokenized-search-input/utils` (pure functions: matchers, validation rules, serialization and date helpers) and `@kuruwic/tokenized-search-input/styles` (the default CSS). It needs Node.js 20 or later to install and build.

## Quick Start

<!-- example -->
```tsx
import {
  type FieldDefinition,
  type QuerySnapshot,
  TokenizedSearchInput,
} from "@kuruwic/tokenized-search-input";
import "@kuruwic/tokenized-search-input/styles";

const fields: FieldDefinition[] = [
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

export function App() {
  const handleSearch = (snapshot: QuerySnapshot) => {
    console.log("Segments:", snapshot.segments);
    console.log("Text:", snapshot.text);
  };

  return <TokenizedSearchInput fields={fields} onSubmit={handleSearch} placeholder="Search..." />;
}
```

Every public type is exported from the root entry, so `import type { FieldDefinition } from '@kuruwic/tokenized-search-input'` works without reaching into the package.

### Query syntax

The input and its callbacks use one string form for a query. A query is a list of segments separated by spaces:

| Segment | Example | Read as |
| --- | --- | --- |
| Filter | `status:is:active` | key, operator and value |
| Filter without an operator | `status:active` | key and value, with the first operator of the field |
| Free text | `hello` | free text (see `freeTextMode`) |
| Quoted | `title:contains:"hello world"`, `"hello world"` | a value or free text that holds spaces |

Inside quotes `\"` stands for `"` and `\\` for `\`. A filter whose operator the field does not allow keeps that operator and is marked invalid. The full grammar, including how free text that looks like a filter is quoted and which diagnostics `parseQueryToDoc` reports, is in [docs/query-grammar.md](docs/query-grammar.md).

## Field Configuration

<!-- example -->
```tsx
import type { FieldDefinition } from "@kuruwic/tokenized-search-input";

function TagIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="12" cy="12" r="8" fill="currentColor" />
    </svg>
  );
}

export const fields: FieldDefinition[] = [
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

    // Optional - Per-rule validation override
    validation: {
      "field-validate": false, // Disable a rule for this field (see Validation)
    },
  },
];
```

`validate` returns `true` when the value is valid, and `false` or a message otherwise. It runs as the implicit `field-validate` rule, so it marks tokens invalid even when the `validation` prop is not set.

### Field Types

| Type       | Description                                                          |
| ---------- | -------------------------------------------------------------------- |
| `string`   | Free-form text input                                                 |
| `enum`     | Predefined values with autocomplete. Requires `enumValues`           |
| `date`     | Date picker with optional `formatConfig` and `renderPicker`          |
| `datetime` | Date and time picker with optional `formatConfig` and `renderPicker` |

For an `enum` field with static `enumValues`, the token stores the `value` of the option, whether the user typed the value, the label, or either in another case. `enumValues` may be omitted when custom suggestions provide the values (see [Custom Suggestions](#custom-suggestions)); the token then keeps the value as written.

### Custom Date Picker

For `date` and `datetime` fields, you can provide a custom picker component:

<!-- example -->
```tsx
import type { DatePickerRenderProps, FieldDefinition } from "@kuruwic/tokenized-search-input";

function MyDatePicker({ value, onChange, onClose }: DatePickerRenderProps) {
  return (
    <input
      type="date"
      value={value?.date ?? ""}
      onChange={(event) => onChange(event.target.value ? { date: event.target.value } : null)}
      onBlur={onClose}
    />
  );
}

export const dueDate: FieldDefinition = {
  key: "due_date",
  label: "Due Date",
  type: "date",
  operators: ["is", "gt", "lt"],
  renderPicker: (props) => <MyDatePicker {...props} />,
};
```

To use one picker for every `date` or `datetime` field, pass it to the `pickers` prop instead (see [`pickers`](#pickers---date-picker-configuration)). The default pickers `DefaultDatePicker`, `DefaultDateTimePicker` and `TimePicker` are exported from the root entry.

**DatePickerRenderProps:**

| Prop | Type | Description |
|------|------|-------------|
| `value` | `DateTimeValue \| null` | Current value (reflects keyboard input in realtime) |
| `onChange` | `(value: DateTimeValue \| null) => void` | Called when a date or time is selected |
| `onClose` | `() => void` | Called when picker should close |
| `fieldDef` | `DateFieldDefinition` | Field configuration (includes minDate, maxDate, etc.) |
| `restoreFocus` | `() => void` | Restore focus to token input after selection |
| `defaultMonth` | `Date` | Initial calendar month hint |
| `confirmedValue` | `DateTimeValue \| null` | Last committed value (before current input changes) |

`DateTimeValue` is `{ date: 'yyyy-MM-dd'; time?: 'HH:mm[:ss[.S..SSSSSSSSS]]'; offset?: 'Z' | '±HH:MM' }`. `date` and `time` are the reading in the value's own `offset`, so a picker keeps the offset of `value` when it writes a changed value. The type is exported from the root entry, and `parseDateTimeValue`, `formatDateTimeValue`, `toInstant` and `fromInstant` are exported from `@kuruwic/tokenized-search-input/utils`.

**DateTimePickerRenderProps** extends DatePickerRenderProps with:

| Prop | Type | Description |
|------|------|-------------|
| `timeControls` | `DateTimeTimeControls` | Time controls for UTC mode and include time toggle |

**DateTimeTimeControls:**

| Prop | Type | Description |
|------|------|-------------|
| `isUTC` | `boolean` | Whether the value is in UTC |
| `onUTCChange` | `(isUTC: boolean) => void` | Toggle UTC mode: the same moment is written in UTC or in the local offset |
| `includeTime` | `boolean` | Whether the value includes a time (only when `timeRequired` is false) |
| `onIncludeTimeChange` | `(includeTime: boolean) => void` | Toggle include time: midnight is added to the date, or the time is removed |

### Date/DateTime Field Options

For `date` and `datetime` fields, additional configuration options are available:

<!-- example -->
```tsx
import type { FieldDefinition } from "@kuruwic/tokenized-search-input";

export const dueDate: FieldDefinition = {
  key: "due_date",
  label: "Due Date",
  type: "date",
  operators: ["is", "gt", "lt"],
  // Date constraints
  minDate: new Date("2024-01-01"), // Date object or ISO string; days are compared, not times
  maxDate: new Date("2024-12-31"),
  disabledDates: (date) => date.getDay() === 0, // Disable Sundays
  // Picker customization
  closeButtonLabel: "Done", // Custom close button label (defaults to check icon)
};
```

For `datetime` fields, additional time options:

<!-- example -->
```tsx
import type { FieldDefinition } from "@kuruwic/tokenized-search-input";

export const scheduledAt: FieldDefinition = {
  key: "scheduled_at",
  label: "Scheduled At",
  type: "datetime",
  operators: ["gt", "lt"],
  timeRequired: false, // false (default): Show "Include time" checkbox, allow date-only values
  // true: Time is always required, date-only values are normalized to datetime
};
```

Values are read in one format: `yyyy-MM-dd` for a date, and `yyyy-MM-dd` or `yyyy-MM-ddTHH:mm[:ss[.S..SSSSSSSSS]][Z|±HH:MM]` (a space may replace the `T`) for a datetime. Partial input such as `2024` and dates that do not exist such as `2024-02-31` are rejected, and every `date` and `datetime` field marks such a value as invalid; turn that off for a field with `validation: { 'date-value': false }`. A field can read other formats with `formatConfig.parse`, which returns a `DateTimeValue` or `null`, and show values with `formatConfig.format`, which receives one:

<!-- example -->
```tsx
import type { FieldDefinition } from "@kuruwic/tokenized-search-input";
import { fromInstant } from "@kuruwic/tokenized-search-input/utils";

export const createdAt: FieldDefinition = {
  key: "created_at",
  label: "Created At",
  type: "datetime",
  operators: ["gt", "lt"],
  formatConfig: {
    // Read a Unix timestamp in seconds as a UTC date-time
    parse: (input) => {
      const seconds = Number(input);
      return Number.isInteger(seconds) ? fromInstant(new Date(seconds * 1000), "Z") : null;
    },
    format: (value) => `${value.date} ${value.time ?? ""}`.trim(),
  },
};
```

A value is stored in one canonical form: `T` between the date and the time, and the offset with a colon (`2024-03-05T14:30:00+09:00`). It is shown in its own offset, so the time zone of the environment never changes what a token says.

### Operators

The `operators` array accepts any string values. The library provides defaults (`is`, `is_not`, `contains`, `not_contains`, `starts_with`, `ends_with`, `gt`, `lt`, `gte`, `lte`; exported as `DEFAULT_OPERATORS`, with display labels in `DEFAULT_OPERATOR_LABELS`) but you can use custom operators that match your API. A token whose operator is not one of its field's `operators` is marked invalid by the implicit `unknown-operator` rule.

## Validation

<!-- example -->
```tsx
import { type FieldDefinition, TokenizedSearchInput } from "@kuruwic/tokenized-search-input";
import {
  MaxCount,
  RequireEnum,
  RequirePattern,
  Unique,
  createFieldRule,
  createRule,
} from "@kuruwic/tokenized-search-input/utils";

declare const fields: FieldDefinition[];

export function ValidatedSearch() {
  return (
    <TokenizedSearchInput
      fields={fields}
      validation={{
        rules: [
          // Mark duplicate status filters
          Unique.rule("key-operator"),

          // Limit total tokens
          MaxCount.rule("*", 5),

          // Validate value format; `reject` deletes new invalid tokens instead of marking them
          RequirePattern.rule("email", /^[^\s@]+@[^\s@]+\.[^\s@]+$/, {
            onInvalid: "reject",
            message: "Enter an email address",
          }),

          // Restrict enum fields to predefined values only
          RequireEnum.rule(),

          // Custom validation rule with full control
          createRule("no-deleted-status", (token, ctx) =>
            token.key === "status" && token.value === "deleted"
              ? {
                  ruleId: "no-deleted-status",
                  reason: "forbidden-value",
                  message: 'Cannot use "deleted" status',
                  action: "mark",
                  targets: [{ tokenId: token.id }],
                }
              : null,
          ),

          // Field-specific validation
          createFieldRule("age", (token) => {
            const num = Number.parseInt(token.value, 10);
            if (Number.isNaN(num) || num < 0 || num > 150) {
              return {
                ruleId: "field-rule-age",
                reason: "out-of-range",
                message: "Age must be between 0 and 150",
                action: "mark",
                targets: [{ tokenId: token.id }],
              };
            }
            return null;
          }),
        ],
      }}
    />
  );
}
```

A rule is `{ id, priority?, validate(ctx): Violation[] }`. `createRule(id, check, options?)` builds one from a function that is called as `check(token, ctx)` for every token, with `options.priority` as its only option. `ctx.tokens` holds all tokens, `ctx.isEditing(token)` tells whether the user just added or changed the token (or did so since entering the token they are in), `ctx.before(token)` returns the token as it was before that edit, `ctx.fieldOf(token)` returns its field, and `ctx.focusedTokenId` is the token the user is in. The check returns a violation, an array of violations, or `null`. A violation is `{ ruleId, reason, message?, action, targets }`: `action` is `'mark'` (show the token as invalid) or `'delete'`, and `targets` names the tokens it is about by `tokenId`, which need not include the checked token.

`validation.rules` holds only the rules you add. `FieldDefinition.validate`, the date rule `date-value` and the operator rule `unknown-operator` always apply; switch one off for a field with `validation: { 'rule-id': false }`, or for every unknown field with the same member of the `unknownFields` template.

### Violation messages

A token marked invalid shows the `message` of its violation as its `title` and as a visually hidden description that the token points to with `aria-describedby`, so screen readers announce it. Without a `message` the `reason` is shown. The snapshot reports the same text in `invalid` and `invalidReason` of the token. When a token has several violations, the one from the rule with the highest `priority` is shown.

### Validation Options

Each preset rule takes an option that controls how violations are handled:

| Rule | Option | Description |
|------|--------|-------------|
| `Unique` | `onDuplicate: 'mark'` (default) | Highlight duplicates as invalid |
| | `onDuplicate: 'reject'` | Auto-delete new duplicates |
| | `onDuplicate: 'replace'` | Replace existing with new duplicate |
| `MaxCount` | `onExceed: 'mark'` (default) | Highlight excess tokens as invalid |
| | `onExceed: 'reject'` | Auto-delete new tokens that exceed limit, last first |
| `RequirePattern` | `onInvalid: 'mark'` (default) | Highlight invalid format |
| | `onInvalid: 'reject'` | Auto-delete new invalid tokens |
| `RequireEnum` | `onInvalid: 'mark'` (default) | Highlight invalid enum values |
| | `onInvalid: 'reject'` | Auto-delete new invalid enum values |

`MaxCount`, `RequirePattern` and `RequireEnum` also take `message`, and every preset takes `priority`. Rules reject only tokens that were just added or changed, never one that is only focused, and a change to the `validation` prop only re-marks tokens.

The id of a preset rule is what a field's `validation` override names:

| Rule | Id |
|------|----|
| `Unique.rule(constraint)` | `unique-key`, `unique-key-operator`, `unique-exact` |
| `MaxCount.rule(key, max)` | `max-count-<key>`, `max-count-total` for `'*'` |
| `RequirePattern.rule(key, regex)` | `pattern-<key>` |
| `RequireEnum.rule()` | `enum-value` |
| `createFieldRule(key, check)` | `field-rule-<key>` |
| `FieldDefinition.validate` | `field-validate` |
| Date and datetime values | `date-value` |
| Operators the field does not allow | `unknown-operator` |

### Unique Constraints

The `Unique.rule()` accepts a constraint parameter:

| Constraint | Description |
|------------|-------------|
| `'key'` | Only one token per field key (e.g., one `status` filter) |
| `'key-operator'` | Only one token per field key + operator combination |
| `'exact'` | No duplicate key + operator + value combinations |

<!-- example -->
```tsx
import { Unique } from "@kuruwic/tokenized-search-input/utils";

// Only one status filter allowed
export const oneStatus = Unique.rule("key");

// Allow status:is and status:is_not, but not two status:is
export const oneStatusPerOperator = Unique.rule("key-operator");

// Allow status:is:active and status:is:pending (different values)
export const noExactDuplicates = Unique.rule("exact");
```

`'key'` and `'key-operator'` do not compare free text tokens.

## Custom Suggestions

<!-- example -->
```tsx
import { type FieldDefinition, TokenizedSearchInput } from "@kuruwic/tokenized-search-input";
import { matchers } from "@kuruwic/tokenized-search-input/utils";

declare const fields: FieldDefinition[];

export function SuggestingSearch() {
  return (
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
          suggest: ({ query }) => [
            {
              tokens: [{ key: "tag", operator: "is", value: query }],
              label: `Add tag: ${query}`,
            },
          ],
        },
      }}
    />
  );
}
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

Closing the suggestions (Escape or blur) discards a pending `suggest` or `loadMore` response: it does not reopen the list, add a page or call `onError`.

Both functions receive `signal`, an `AbortSignal` that is aborted when the suggestions close, when a newer query starts, and when the input unmounts. Pass it to `fetch` (or check it) to cancel work whose result would be discarded. It is never aborted after the returned promise settles, nor when the request runs past `timeoutMs`.

### SuggestedFilterToken

When defining tokens in a `CustomSuggestion`, you can use these properties:

<!-- example -->
```ts
import type { ReactNode } from "react";

interface SuggestedFilterToken {
  key: string; // Field key
  operator: string; // Operator
  value: string; // Token value
  displayValue?: string; // Display label (for dynamic enum values)
  startContent?: ReactNode; // Icon/emoji before label
  endContent?: ReactNode; // Badge/indicator after label
}

export type { SuggestedFilterToken };
```

### Error Handling

Handle errors from async suggestion operations:

<!-- example -->
```tsx
import type { CustomSuggestion, SuggestionsConfig } from "@kuruwic/tokenized-search-input";

declare function fetchSuggestions(
  query: string,
  init: { signal: AbortSignal },
): Promise<CustomSuggestion[]>;

export const suggestions: SuggestionsConfig = {
  custom: {
    suggest: async ({ query, signal }) => fetchSuggestions(query, { signal }),
    onError: (error, context) => {
      console.error(`Suggestion ${context.type} failed:`, error);
      // context.type: 'suggest' | 'loadMore'
      // context.query: query text at time of error
    },
  },
};
```

### Custom Selection Handler

Implement toggle behavior (insert if not exists, delete if exists):

<!-- example -->
```tsx
import type { CustomSuggestion, SuggestionsConfig } from "@kuruwic/tokenized-search-input";
import { createToggleSelectHandler } from "@kuruwic/tokenized-search-input/utils";

declare function suggestTags(query: string): CustomSuggestion[];

// Built-in toggle helper
export const withHelper: SuggestionsConfig = {
  custom: {
    suggest: ({ query }) => suggestTags(query),
    onSelect: createToggleSelectHandler(),
  },
};

// Or custom logic
export const withCustomLogic: SuggestionsConfig = {
  custom: {
    suggest: ({ query }) => suggestTags(query),
    onSelect: (suggestion, { existingTokens, deleteToken }) => {
      const token = suggestion.tokens[0];
      const existing = existingTokens.find(
        (t) => t.key === token.key && t.value === token.value,
      );
      if (existing) {
        deleteToken(existing.id);
        return true; // handled, skip default insert
      }
      return false; // not handled, run default insert
    },
  },
};
```

`deleteToken(id)` takes effect when `onSelect` returns, in the same undo step as the rest of the selection, so the document you read inside `onSelect` still holds the token.

### Pagination

For large datasets, implement pagination with `loadMore`:

<!-- example -->
```tsx
import {
  type CustomSuggestion,
  type FieldDefinition,
  TokenizedSearchInput,
} from "@kuruwic/tokenized-search-input";

declare const fields: FieldDefinition[];
declare function fetchPage(
  query: string,
  offset: number,
  limit: number,
  signal: AbortSignal,
): Promise<{ items: CustomSuggestion[]; hasMore: boolean }>;

export function PagedSearch() {
  return (
    <TokenizedSearchInput
      fields={fields}
      suggestions={{
        custom: {
          suggest: async ({ query, signal }) => {
            const { items, hasMore } = await fetchPage(query, 0, 10, signal);
            return { suggestions: items, hasMore };
          },
          loadMore: async ({ query, offset, limit, signal }) => {
            const { items, hasMore } = await fetchPage(query, offset, limit, signal);
            return { suggestions: items, hasMore };
          },
          maxSuggestions: 10,
        },
      }}
      // Customize pagination labels
      labels={{
        pagination: {
          loading: "Loading...",
          scrollForMore: "Scroll for more",
        },
      }}
    />
  );
}
```

## Props

### Core Props

| Prop            | Type                                        | Default       | Description                               |
| --------------- | ------------------------------------------- | ------------- | ----------------------------------------- |
| `fields`        | `FieldDefinition[]`                         | required      | Array of field definitions                |
| `defaultValue`  | `string`                                    | `''`          | Initial query string, read once at mount. Later changes are ignored and warn in development; use `ref.setValue()` |
| `placeholder`   | `string`                                    | `'Search...'` | Placeholder text                          |
| `onSubmit`       | `(snapshot: QuerySnapshot) => void`         | -             | Called on Enter or `ref.submit()`, with the content as it is after the token being edited is committed |
| `onChange`       | `(snapshot: QuerySnapshot) => void`         | -             | Called when the document changes. Not called when only validation results change, or for `disabled` changes. Initial content is reported once |
| `onTokensChange` | `(snapshot: QuerySnapshot) => void`         | -             | Called when the committed tokens (type, id, key, operator, value) differ from the last report. A token being edited counts in its committed form, and is reported when the user leaves it |
| `onBlur`         | `(snapshot: QuerySnapshot) => void`         | -             | Called when focus leaves the input and its suggestion popup |
| `onFocus`       | `(snapshot: QuerySnapshot) => void`         | -             | Called when focus enters the input        |
| `onClear`       | `() => void`                                | -             | Called when the clear button is clicked or `ref.clear()` is called |
| `disabled`      | `boolean`                                   | `false`       | Disable the input                         |
| `freeTextMode`  | `'none' \| 'plain' \| 'tokenize'`           | `'plain'`     | How to handle free text input: `none` drops it, `plain` keeps it as text, `tokenize` makes tokens of it |

### Display Props

| Prop                | Type         | Default | Description                                                       |
| ------------------- | ------------ | ------- | ----------------------------------------------------------------- |
| `clearable`         | `boolean`    | `false` | Show clear button                                                 |
| `className`         | `string`     | -       | Custom class for the outermost `tsi-root` element (merged with `classNames.root`) |
| `classNames`        | `ClassNames` | -       | Custom classes for component parts (see below)                    |
| `singleLine`        | `boolean`    | `false` | Single line with horizontal scroll                                |
| `expandOnFocus`     | `boolean`    | `false` | Collapse to single line when unfocused, expand on focus           |
| `startAdornment`    | `ReactNode`  | -       | Element to render at the start of the input (e.g., search icon)   |
| `endAdornment`      | `ReactNode`  | -       | Element to render at the end of the input (before clear button)   |
| `immediatelyRender` | `boolean`    | `true`  | Render editor immediately. Set to `false` for SSR (e.g., Next.js) |

#### `classNames` - Component Part Styling

<!-- example -->
```tsx
import type { ClassNames } from "@kuruwic/tokenized-search-input";

export const classNames: ClassNames = {
  // Root-level
  root: "", // Outermost element (size, spacing, layout)
  container: "", // Visible box inside the root (border, background, radius)
  input: "", // Editor content area
  placeholder: "", // Placeholder text
  clearButton: "", // Clear button
  startAdornment: "", // Start adornment container
  endAdornment: "", // End adornment container
  // Token
  token: "", // Token wrapper
  tokenLabel: "", // Token field label
  tokenOperator: "", // Token operator
  tokenValue: "", // Token value
  tokenDeleteButton: "", // Token delete button
  // Suggestions
  dropdown: "", // Suggestion dropdown
  operatorDropdown: "", // Operator dropdown
  operatorDropdownItem: "", // Operator dropdown item
  suggestionItem: "", // Suggestion item
  suggestionItemHint: "", // Suggestion item hint text
  suggestionItemDescription: "", // Suggestion item description
  suggestionItemIcon: "", // Suggestion item icon
  fieldCategory: "", // Field category header
  divider: "", // Divider between custom and field suggestions
};
```

`className` and `classNames.root` can be used together; they are merged onto the outermost `tsi-root` element whether or not `expandOnFocus` is set. Style the visible box (border, background, radius, shadow) with `classNames.container`, which goes on the `tsi-container` element inside the root; with `expandOnFocus` that box leaves the flow on focus while the root keeps its place.

### Configuration Props (Grouped)

Related settings are grouped into object props for better organization:

#### `suggestions` - Suggestion Configuration

<!-- example -->
```tsx
import type { SuggestionsConfig } from "@kuruwic/tokenized-search-input";
import { matchers } from "@kuruwic/tokenized-search-input/utils";

export const suggestions: SuggestionsConfig = {
  field: {
    disabled: false, // Disable field autocomplete
    matcher: matchers.prefix, // Custom matcher for field suggestions
  },
  value: {
    disabled: false, // Disable value autocomplete for enum fields
  },
  custom: {
    // Custom suggestion configuration (see Custom Suggestions)
    suggest: () => [],
  },
};
```

#### `validation` - Validation Configuration

<!-- example -->
```tsx
import type { ValidationConfig } from "@kuruwic/tokenized-search-input";
import { MaxCount } from "@kuruwic/tokenized-search-input/utils";

export const validation: ValidationConfig = {
  rules: [MaxCount.rule("*", 10)], // Rules to run in addition to the ones that always apply
};
```

#### `unknownFields` - Unknown Field Configuration

Keys that no field in `fields` defines stay plain text. Passing `unknownFields` is what turns them into tokens; the object is a template that shapes the field resolved for every such key:

<!-- example -->
```tsx
import type { UnknownFieldTemplate } from "@kuruwic/tokenized-search-input";

export const unknownFields: UnknownFieldTemplate = {
  operators: ["is", "contains", "gt", "lt"], // Operators for unknown fields; the first is used for `key:value`. Defaults to every default operator
  hideSingleOperator: false, // Hide operator when only one available
  allowSpaces: false, // Allow spaces in value without quotes
  validate: (value) => value.length <= 100 || "Value is too long", // Validate the value of an unknown field
  validation: { "unknown-operator": false }, // Per-rule overrides, as on a field
};
```

Pass `unknownFields={{}}` to accept every key with the defaults. A token whose field is later removed from `fields` is kept as an unknown field and keeps its own operator.

#### `initialDelimiter` - Token Delimiter

<!-- example -->
```tsx
import { type FieldDefinition, TokenizedSearchInput } from "@kuruwic/tokenized-search-input";

declare const fields: FieldDefinition[];

export const slashDelimited = <TokenizedSearchInput fields={fields} initialDelimiter="/" />;
```

Token delimiter (default `':'`). Affects parsing (input/paste) and serialization (output/copy). Example: `'status:is:active'` with delimiter `':'`. The `initial` prefix indicates this value cannot be changed after component mount.

#### `serialization` - Clipboard Serialization Configuration

<!-- example -->
```tsx
import type { SerializationConfig } from "@kuruwic/tokenized-search-input";

export const serialization: SerializationConfig = {
  // Custom copy format; return null to use the default
  serializeToken: (token) => (token.key === "tag" ? `#${token.value}` : null),
  // Custom paste parser; return null to use the default parser
  deserializeText: (text) =>
    text.startsWith("#") ? [{ type: "filter", key: "tag", operator: "is", value: text.slice(1) }] : null,
};
```

#### `labels` - Label Configuration (i18n)

<!-- example -->
```tsx
import type { LabelsConfig } from "@kuruwic/tokenized-search-input";

export const labels: LabelsConfig = {
  operators: { is: "=", is_not: { display: "≠", select: "is not" } }, // Custom operator display labels
  pagination: { loading: "Loading...", scrollForMore: "Scroll for more" }, // Custom pagination labels
};
```

#### `pickers` - Date Picker Configuration

<!-- example -->
```tsx
import type { PickersConfig } from "@kuruwic/tokenized-search-input";
import { DefaultDatePicker } from "@kuruwic/tokenized-search-input";

export const pickers: PickersConfig = {
  renderDate: (props) => <DefaultDatePicker {...props} />,
  renderDateTime: (props) => <p>{props.value?.date ?? "No date"}</p>,
};
```

## Ref Methods

<!-- example -->
```tsx
import { useRef } from "react";
import {
  type FieldDefinition,
  TokenizedSearchInput,
  type TokenizedSearchInputRef,
} from "@kuruwic/tokenized-search-input";
import { getFilterTokens } from "@kuruwic/tokenized-search-input/utils";

declare const fields: FieldDefinition[];

export function Controlled() {
  const ref = useRef<TokenizedSearchInputRef>(null);

  const markFirstTokenActive = () => {
    const first = ref.current && getFilterTokens(ref.current.getSnapshot())[0];
    if (!first) return;
    ref.current?.updateToken(first.id, { operator: "is", value: "active" }); // An ordinary edit: fires onChange, can be undone
    ref.current?.setTokenDisplay(first.id, { displayValue: "Active" }); // Display only: no onChange
  };

  return (
    <>
      <TokenizedSearchInput ref={ref} fields={fields} />
      <button type="button" onClick={() => ref.current?.setValue("status:is:active")}>
        Active only
      </button>
      <button type="button" onClick={markFirstTokenActive}>
        Mark first token active
      </button>
    </>
  );
}
```

| Method | Description |
|--------|-------------|
| `setValue(value)` | Replace the content with a query string. With `defaultValue`, the only way to provide a query |
| `getValue()` | The current query string |
| `getSnapshot()` | The current `QuerySnapshot`, with the stable id of every token |
| `focus()` | Focus the input |
| `clear()` | Clear all content, and call `onClear` |
| `submit()` | Commit the token being edited, then trigger `onSubmit` with the same snapshot as Enter |
| `updateToken(id, patch)` | Change the `operator` and/or `value` of a filter token. An ordinary edit: it fires `onChange` and can be undone |
| `deleteToken(id)` | Remove a token |
| `setTokenDisplay(id, display)` | Set `displayValue`, `startContent` and `endContent` of a filter token without changing the query or firing `onChange` |
| `getEditor()` | The underlying TipTap `Editor`, or `null` before it exists |

Ids come from `getSnapshot()`; an unknown id is ignored. Display data is not part of the document: it stays with the token id, applies while the token keeps the key and value it had when it was set (so undoing an edit brings it back), and is discarded by `setValue` and `clear`. The `TokenPatch` and `TokenDisplay` types describe the arguments.

`getEditor()` is for reading and debugging. The editor's internals are outside semver, and writing through it directly (raw node attributes or `setContent`) is unsupported because it bypasses the undo policy of token edits and the per-token state. `setValue`, `clear`, `updateToken`, `deleteToken` and `setTokenDisplay` are the supported ways to change content. Calls made while the editor is being recreated (for example when a Suspense boundary settles late) are kept in call order and applied to the new editor.

## Styling

The component uses CSS variables for theming. Import the default styles:

<!-- example -->
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
  --tsi-token-gap: 0.25rem;
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

`--tsi-token-gap` is the space between tokens, set as the margin of each token. Overrides of the color variables on `:root` only reach the light palette: while the system prefers dark, the dark palette is selected by `:root:not([data-theme="light"])`, which wins over `:root`. Override colors for the dark palette under that selector (inside `@media (prefers-color-scheme: dark)`) and under `.dark, [data-theme="dark"]`, or pin the page to the light palette with `data-theme="light"`.

### Dark Mode

The dark palette applies automatically when the system prefers a dark color scheme (`prefers-color-scheme: dark`), unless an ancestor sets `data-theme="light"`. Set `data-theme="dark"` on an ancestor or a `.dark` class to force it. To follow your own theme switch, set `data-theme` to `dark` or `light`; the system preference then no longer matters. Or override the variables under any selector:

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

Component styles use `:where()` and CSS layers, so Tailwind utilities can override defaults without increasing selector specificity.

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

<!-- example -->
```tsx
import { type FieldDefinition, TokenizedSearchInput } from "@kuruwic/tokenized-search-input";

declare const fields: FieldDefinition[];

export const tailwindSearch = (
  <TokenizedSearchInput
    fields={fields}
    classNames={{
      container: "shadow-lg",
      input: "bg-slate-50",
      token: "bg-indigo-100 border-indigo-300",
      dropdown: "shadow-2xl",
    }}
  />
);
```

## Utilities

Pure functions live in `@kuruwic/tokenized-search-input/utils` and are safe to use on the server. Hooks and components are exported from the root entry. The complete list of what `/utils` exports:

| Group | Exports |
|-------|---------|
| Matching | `matchers`, `defaultMatcher`, `matchBest`, `filterItems`, type `FilterItemsOptions` |
| Label resolution | `labelResolvers`, `defaultLabelResolver`, `resolveLabel`, `resolveLabelToField`, type `ResolveLabelOptions` |
| Enum values | `enumResolvers`, `defaultEnumResolver`, `filterEnumValues`, `getEnumValue`, `getEnumLabel`, `getEnumIcon`, `isEnumValueWithLabel`, `resolveEnumValue`, types `FilterEnumValuesOptions`, `ResolveEnumValueOptions` |
| Operator labels | `getOperatorDisplayLabel`, `getOperatorSelectLabel` |
| Validation | `Unique`, `MaxCount`, `RequirePattern`, `RequireEnum`, `createRule`, `createFieldRule`, types `UniqueConstraint`, `UniqueOptions`, `DuplicateStrategy`, `MaxCountOptions`, `RequirePatternOptions`, `RequireEnumOptions` |
| Date and time | `parseDateTimeValue`, `formatDateTimeValue`, `toInstant`, `fromInstant`, `isDateField`, `isDateTimeField`, `isDateOrDateTimeField`, `validateDateValue`, `validateDateTimeValue`, `DEFAULT_DATE_VALUE_FORMAT`, types `DateTimeValue`, `DateTimeOffset`, `ParseResult` |
| Serialization | `serializeDocToQuery`, `parseQueryToDoc`, `createQuerySnapshot`, types `SerializeDocOptions`, `SerializedToken`, `CreateQuerySnapshotOptions`, `ParseOptions`, `ParsedQuery`, `ParseDiagnostics` |
| Query snapshot | `EMPTY_SNAPSHOT`, `getFilterTokens`, `getFreeTextTokens`, `getPlainText` |
| Suggestions | `createToggleSelectHandler`, type `ToggleSelectOptions` |

### Query Snapshot Helpers

Extract specific segments from a `QuerySnapshot`:

<!-- example -->
```tsx
import type { QuerySnapshot } from "@kuruwic/tokenized-search-input";
import {
  EMPTY_SNAPSHOT,
  getFilterTokens,
  getFreeTextTokens,
  getPlainText,
} from "@kuruwic/tokenized-search-input/utils";

declare const snapshot: QuerySnapshot;

// Get only filter tokens from snapshot
export const filters = getFilterTokens(snapshot);
// [{ id, type: 'filter', key: 'status', operator: 'is', value: 'active', ... }]

// Get only free text tokens (when freeTextMode='tokenize')
export const freeTexts = getFreeTextTokens(snapshot);
// [{ id, type: 'freeText', value: 'search term', ... }]

// Get plain text segments concatenated (when freeTextMode='plain')
export const plainText = getPlainText(snapshot);
// "search term"

// Empty snapshot constant for initialization
export const empty = EMPTY_SNAPSHOT; // { segments: [], text: '' }
```

A filter or free text token the validation rules mark invalid carries `invalid` and `invalidReason` in the snapshot.

### Serialization

`parseQueryToDoc` turns a query string into an editor document and reports what it could not read as written. `serializeDocToQuery` writes a document back:

<!-- example -->
```tsx
import type { FieldDefinition } from "@kuruwic/tokenized-search-input";
import { parseQueryToDoc, serializeDocToQuery } from "@kuruwic/tokenized-search-input/utils";

declare const fields: FieldDefinition[];

const { doc, diagnostics } = parseQueryToDoc('status:is:active "two words"', fields, {
  freeTextMode: "tokenize",
});
// diagnostics: { incompleteQuote: false, unknownFields: [], unknownOperators: [] }

export const query = serializeDocToQuery(doc, { fields });
```

Pass the same `fields` and `unknownFields` the editor uses so that free text that would read back as a filter is quoted. See [docs/query-grammar.md](docs/query-grammar.md) for the grammar.

### useAsyncTokenResolver

A hook for resolving display values asynchronously for pasted or deserialized tokens. When tokens are created from pasted text, they often only have a raw `value` but no `displayValue` or icons. This hook provides a convenient way to fetch and update display data. It writes through `setTokenDisplay` and `deleteToken`.

**Resolution Conditions**: Tokens are resolved when:

- `displayValue` is not set
- Token is confirmed (not being edited)

This prevents display updates during active editing which would disrupt user input.

<!-- example -->
```tsx
import { useRef } from "react";
import {
  type FieldDefinition,
  TokenizedSearchInput,
  type TokenizedSearchInputRef,
  useAsyncTokenResolver,
} from "@kuruwic/tokenized-search-input";

declare const fields: FieldDefinition[];
declare function fetchCountries(request: {
  values: string[];
}): Promise<{ countries: { value: string; label: string; emoji: string }[] }>;
declare function reportResolutionError(error: unknown, values: string[]): void;

export function CountrySearch() {
  const inputRef = useRef<TokenizedSearchInputRef>(null);

  const { resolveTokens } = useAsyncTokenResolver({
    inputRef,
    fieldKey: "country",
    resolve: async (values) => {
      // Fetch data for the given values
      const { countries } = await fetchCountries({ values });
      return countries;
    },
    getValue: (c) => c.value, // Extract original value for matching
    getDisplayData: (c) => ({
      displayValue: c.label,
      startContent: <span>{c.emoji}</span>,
    }),
    // Optional: Show loading state while resolving
    loadingContent: {
      displayValue: "Loading...",
      startContent: <span aria-hidden="true">…</span>,
    },
    // Optional: What to do if value is not found ('delete' | 'keep', default: 'delete')
    onNotFound: "delete",
    // Optional: Handle resolver failures. Loading decoration is restored automatically.
    onError: (error, values) => reportResolutionError(error, values),
  });

  // Trigger resolution on change
  return <TokenizedSearchInput ref={inputRef} fields={fields} onChange={resolveTokens} />;
}
```

**Options:**

| Option | Type | Required | Description |
|--------|------|----------|-------------|
| `inputRef` | `RefObject<TokenizedSearchInputRef \| null>` | Yes | Ref to the input component |
| `fieldKey` | `string` | Yes | Field key to resolve (e.g., 'country') |
| `resolve` | `(values: string[]) => Promise<T[]>` | Yes | Fetch data for given values |
| `getValue` | `(item: T) => string` | Yes | Extract original value from resolved item |
| `getDisplayData` | `(item: T) => ResolvedTokenData` | Yes | Convert item to display data |
| `loadingContent` | `{ displayValue?, startContent? }` | No | Content to show while loading |
| `onNotFound` | `'delete' \| 'keep'` | No | Action when value not found (default: `'delete'`) |
| `onError` | `(error: unknown, values: string[]) => void` | No | Called when resolution fails; the rejection is handled and loading decoration is restored |

### Matchers

A `Matcher` scores how well a user's input matches a target string: `(input: string, target: string) => number`

| Score | Meaning |
|-------|---------|
| `0` | No match |
| `0 < score < 1` | Partial match (higher = better) |
| `1` | Exact match |

Scores run from 0 to 1 for every matcher, built-in or custom. A custom matcher that returns a larger number, such as a score out of 100, makes every item look like an exact match.

Built-in matchers:

| Matcher | Description |
|---------|-------------|
| `fuzzy` (default) | fzf-style fuzzy matching. 1 for an exact match, between 0.01 and 0.99 for a partial one |
| `prefix` | Prefix matching. 0.8, or 0.85 when the case matches too |
| `exact` | Case-sensitive exact match. 1 or 0 |
| `caseInsensitive` | Case-insensitive exact match. 1 or 0 |

Use `suggestionMatcher` in a field definition to customize:

<!-- example -->
```tsx
import type { FieldDefinition, Matcher } from "@kuruwic/tokenized-search-input";
import { filterItems, matchers } from "@kuruwic/tokenized-search-input/utils";

export const status: FieldDefinition = {
  key: "status",
  label: "Status",
  type: "enum",
  operators: ["is"],
  enumValues: ["active", "inactive"],
  suggestionMatcher: matchers.prefix,
};

// A custom matcher returns 0 for no match and up to 1 for an exact match
export const containsWord: Matcher = (input, target) =>
  target.toLowerCase().includes(input.toLowerCase()) ? 0.5 : 0;

// filterItems sorts by score; `minScore` is on the same 0 to 1 scale and an item scored 0 never matches
export const matches = filterItems(["active", "inactive"], "act", (item) => [item], {
  matcher: containsWord,
  minScore: 0.4,
});
```

### Enum Resolvers

An `EnumValueResolver` determines which enum value the user's input resolves to. Unlike matchers (used for suggestion filtering), resolvers are used to **confirm** a value when the user finishes typing.

Built-in resolvers:

| Resolver | Description |
|----------|-------------|
| `caseInsensitive` (default) | Case-insensitive match against both value and label |
| `exact` | Case-sensitive match against both value and label |

Both built-in resolvers match user input against the value and the label, returning the internal value on match. This enables label-to-value resolution when using `{ value, label }` enum definitions:

<!-- example -->
```tsx
import type { FieldDefinition } from "@kuruwic/tokenized-search-input";
import { enumResolvers } from "@kuruwic/tokenized-search-input/utils";

export const country: FieldDefinition = {
  key: "country",
  label: "Country",
  type: "enum",
  operators: ["is"],
  enumValues: [
    { value: "us", label: "United States" },
    { value: "jp", label: "Japan" },
  ],
  // Default (caseInsensitive): "japan" → "jp", "JP" → "jp"
  // With exact: "Japan" → "jp", "japan" → no match
  valueResolver: enumResolvers.exact,
};
```

### Label Resolvers

A `LabelResolver` determines how user input is matched to field definitions when resolving field names:

<!-- example -->
```tsx
import type { FieldDefinition } from "@kuruwic/tokenized-search-input";
import {
  labelResolvers,
  resolveLabel,
  resolveLabelToField,
} from "@kuruwic/tokenized-search-input/utils";

declare const fields: FieldDefinition[];

// Resolve input to field key
resolveLabel(fields, "Status"); // → 'status' (case-insensitive match)
resolveLabel(fields, "STATUS"); // → 'status'
resolveLabel(fields, "unknown"); // → 'unknown' (no match, returns original)

// Get full field definition
export const field = resolveLabelToField(fields, "Status");
if (field) {
  console.log(field.operators); // ['is', 'is_not']
}

// Use case-sensitive matching
resolveLabel(fields, "Status", { resolver: labelResolvers.exact });
```

Built-in resolvers:

| Resolver | Description |
|----------|-------------|
| `caseInsensitive` (default) | Case-insensitive exact match |
| `exact` | Case-sensitive exact match |

### Toggle Selection Example

<!-- example -->
```tsx
import type { CustomSuggestionConfig } from "@kuruwic/tokenized-search-input";
import { createToggleSelectHandler } from "@kuruwic/tokenized-search-input/utils";

// Toggle behavior: insert if not exists, delete if exists
export const customSuggestion: CustomSuggestionConfig = {
  suggest: () => [],
  onSelect: createToggleSelectHandler(), // Default: match by key and value
};

// Match by value only (for single-field scenarios)
export const singleFieldSuggestion: CustomSuggestionConfig = {
  suggest: () => [],
  onSelect: createToggleSelectHandler({ match: "value" }),
};
```

## Requirements

- React 18 or 19
- Node.js 20 or later

## License

MIT
