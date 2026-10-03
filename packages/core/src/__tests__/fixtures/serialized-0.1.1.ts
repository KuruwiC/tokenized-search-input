/**
 * Serializer output of version 0.1.1, kept to check that later versions parse the strings
 * that version wrote into the same tokens and write the tokens back readably.
 *
 * Every case was produced by running `input` through the `parseQueryToDoc` and
 * `serializeDocToQuery` of tag v0.1.1 with `fields` and `options`; `tokens` is the
 * document that parse made (the separator nodes that version put around tokens are left
 * out) and `serialized` is what its serializer wrote for it. `source` is 'serializer'
 * for an `input` that 0.1.1 itself writes (writing what it parses gives `input` again) and
 * 'typed' for one a person types and 0.1.1 normalizes. `allowUnknownFields` and
 * `unknownFieldOperators` are the 0.1.1 options of those names.
 *
 * `changedCases` hold queries that later versions read differently on purpose; they are
 * checked against the readings in the test, with the reason named here.
 *
 * To check this data against 0.1.1, or to produce a case: `git worktree add <dir> v0.1.1`,
 * `pnpm install --frozen-lockfile`, copy this file to `packages/core/src/__tests__/fixtures/`
 * of the worktree, add the test below as `packages/core/src/__tests__/unit/replay.test.ts`
 * and run it with `pnpm --filter @kuruwic/tokenized-search-input exec vitest run replay`.
 * For a new case, put the `name`, `input` and `options` in the list and copy what the
 * test prints for a mismatch. Remove the worktree afterwards.
 *
 * ```ts
 * import { expect, it } from 'vitest';
 * import { parseQueryToDoc, serializeDocToQuery } from '../../serializer';
 * import { cases, changedCases, fields } from '../fixtures/serialized-0.1.1';
 *
 * const tokensOf = (doc: any) =>
 *   (doc.content?.[0]?.content ?? [])
 *     .filter((node: any) => node.type !== 'spacer')
 *     .map((node: any) =>
 *       node.type === 'filterToken'
 *         ? { type: 'filterToken', ...pick(node.attrs, ['key', 'operator', 'value', 'immutable']) }
 *         : node.type === 'freeTextToken'
 *           ? { type: 'freeTextToken', ...pick(node.attrs, ['value', 'quoted']) }
 *           : { type: 'text', text: node.text }
 *     );
 * const pick = (from: any, keys: string[]) => Object.fromEntries(keys.map((k) => [k, from[k]]));
 *
 * it.each([...cases, ...changedCases])('replays $name', (c) => {
 *   const doc = parseQueryToDoc(c.input, fields, c.options);
 *   const serialized = serializeDocToQuery(doc, { delimiter: c.options.delimiter });
 *   const again = serializeDocToQuery(parseQueryToDoc(serialized, fields, c.options), {
 *     delimiter: c.options.delimiter,
 *   });
 *   expect(tokensOf(doc)).toEqual(c.tokens);
 *   expect(serialized).toBe(c.serialized);
 *   expect(c.source === 'serializer').toBe(serialized === c.input && again === serialized);
 * });
 * ```
 */
import type { FieldDefinition } from '../../types';

export interface SerializedCaseOptions {
  freeTextMode?: 'none' | 'plain' | 'tokenize';
  delimiter?: string;
  allowUnknownFields?: boolean;
  unknownFieldOperators?: [string, ...string[]];
}

export type SerializedToken =
  | { type: 'filterToken'; key: string; operator: string; value: string; immutable: boolean }
  | { type: 'freeTextToken'; value: string; quoted: boolean }
  | { type: 'text'; text: string };

export interface SerializedCase {
  name: string;
  input: string;
  options: SerializedCaseOptions;
  source: 'serializer' | 'typed';
  tokens: SerializedToken[];
  serialized: string;
}

export interface ChangedCase extends SerializedCase {
  reason: string;
}

export const fields: FieldDefinition[] = [
  {
    key: 'status',
    label: 'Status',
    type: 'enum',
    operators: ['is', 'is_not'],
    enumValues: ['active', 'inactive', 'pending'],
  },
  {
    key: 'priority',
    label: 'Priority',
    type: 'enum',
    operators: ['is'],
    enumValues: ['high', 'low'],
  },
  {
    key: 'name',
    label: 'Name',
    type: 'string',
    operators: ['is', 'contains', 'starts_with'],
  },
  {
    key: 'user.email',
    label: 'Email',
    type: 'string',
    operators: ['is', 'contains'],
  },
  {
    key: 'created',
    label: 'Created',
    type: 'date',
    operators: ['is', 'before', 'after'],
  },
  {
    key: 'updated',
    label: 'Updated',
    type: 'datetime',
    operators: ['is', 'before', 'after'],
  },
  {
    key: 'lock',
    label: 'Lock',
    type: 'string',
    operators: ['is'],
    immutable: true,
  },
];

export const cases: SerializedCase[] = [
  {
    name: 'empty query',
    input: '',
    options: {},
    source: 'serializer',
    tokens: [],
    serialized: '',
  },
  {
    name: 'filter with the is operator',
    input: 'status:is:active',
    options: {},
    source: 'serializer',
    tokens: [
      {
        type: 'filterToken',
        key: 'status',
        operator: 'is',
        value: 'active',
        immutable: false,
      },
    ],
    serialized: 'status:is:active',
  },
  {
    name: 'filter with the is_not operator',
    input: 'status:is_not:inactive',
    options: {},
    source: 'serializer',
    tokens: [
      {
        type: 'filterToken',
        key: 'status',
        operator: 'is_not',
        value: 'inactive',
        immutable: false,
      },
    ],
    serialized: 'status:is_not:inactive',
  },
  {
    name: 'filter in the key:value shorthand',
    input: 'status:active',
    options: {},
    source: 'typed',
    tokens: [
      {
        type: 'filterToken',
        key: 'status',
        operator: 'is',
        value: 'active',
        immutable: false,
      },
    ],
    serialized: 'status:is:active',
  },
  {
    name: 'filter with contains',
    input: 'name:contains:bob',
    options: {},
    source: 'serializer',
    tokens: [
      {
        type: 'filterToken',
        key: 'name',
        operator: 'contains',
        value: 'bob',
        immutable: false,
      },
    ],
    serialized: 'name:contains:bob',
  },
  {
    name: 'filter with starts_with',
    input: 'name:starts_with:al',
    options: {},
    source: 'serializer',
    tokens: [
      {
        type: 'filterToken',
        key: 'name',
        operator: 'starts_with',
        value: 'al',
        immutable: false,
      },
    ],
    serialized: 'name:starts_with:al',
  },
  {
    name: 'dotted key',
    input: 'user.email:contains:example.com',
    options: {},
    source: 'serializer',
    tokens: [
      {
        type: 'filterToken',
        key: 'user.email',
        operator: 'contains',
        value: 'example.com',
        immutable: false,
      },
    ],
    serialized: 'user.email:contains:example.com',
  },
  {
    name: 'quoted value with spaces',
    input: 'name:is:"john smith"',
    options: {},
    source: 'serializer',
    tokens: [
      {
        type: 'filterToken',
        key: 'name',
        operator: 'is',
        value: 'john smith',
        immutable: false,
      },
    ],
    serialized: 'name:is:"john smith"',
  },
  {
    name: 'quoted value with a colon',
    input: 'name:is:"a:b"',
    options: {},
    source: 'typed',
    tokens: [
      {
        type: 'filterToken',
        key: 'name',
        operator: 'is',
        value: 'a:b',
        immutable: false,
      },
    ],
    serialized: 'name:is:a:b',
  },
  {
    name: 'quoted value with escaped quotes',
    input: 'name:is:"say \\"hi\\""',
    options: {},
    source: 'serializer',
    tokens: [
      {
        type: 'filterToken',
        key: 'name',
        operator: 'is',
        value: 'say "hi"',
        immutable: false,
      },
    ],
    serialized: 'name:is:"say \\"hi\\""',
  },
  {
    name: 'quoted value with escaped backslashes',
    input: 'name:is:"C:\\\\temp"',
    options: {},
    source: 'serializer',
    tokens: [
      {
        type: 'filterToken',
        key: 'name',
        operator: 'is',
        value: 'C:\\temp',
        immutable: false,
      },
    ],
    serialized: 'name:is:"C:\\\\temp"',
  },
  {
    name: 'empty value',
    input: 'name:is:',
    options: {},
    source: 'serializer',
    tokens: [
      {
        type: 'text',
        text: 'name:is:',
      },
    ],
    serialized: 'name:is:',
  },
  {
    name: 'empty quoted value',
    input: 'name:is:""',
    options: {},
    source: 'serializer',
    tokens: [
      {
        type: 'text',
        text: 'name:is:""',
      },
    ],
    serialized: 'name:is:""',
  },
  {
    name: 'date value',
    input: 'created:after:2024-01-15',
    options: {},
    source: 'serializer',
    tokens: [
      {
        type: 'filterToken',
        key: 'created',
        operator: 'after',
        value: '2024-01-15',
        immutable: false,
      },
    ],
    serialized: 'created:after:2024-01-15',
  },
  {
    name: 'datetime value',
    input: 'updated:before:2024-01-15T10:30',
    options: {},
    source: 'serializer',
    tokens: [
      {
        type: 'filterToken',
        key: 'updated',
        operator: 'before',
        value: '2024-01-15T10:30',
        immutable: false,
      },
    ],
    serialized: 'updated:before:2024-01-15T10:30',
  },
  {
    name: 'immutable field',
    input: 'lock:is:x',
    options: {},
    source: 'serializer',
    tokens: [
      {
        type: 'filterToken',
        key: 'lock',
        operator: 'is',
        value: 'x',
        immutable: true,
      },
    ],
    serialized: 'lock:is:x',
  },
  {
    name: 'multiple tokens',
    input: 'status:is:active priority:is:high name:contains:bob',
    options: {},
    source: 'serializer',
    tokens: [
      {
        type: 'filterToken',
        key: 'status',
        operator: 'is',
        value: 'active',
        immutable: false,
      },
      {
        type: 'filterToken',
        key: 'priority',
        operator: 'is',
        value: 'high',
        immutable: false,
      },
      {
        type: 'filterToken',
        key: 'name',
        operator: 'contains',
        value: 'bob',
        immutable: false,
      },
    ],
    serialized: 'status:is:active priority:is:high name:contains:bob',
  },
  {
    name: 'plain free text',
    input: 'hello world',
    options: {},
    source: 'serializer',
    tokens: [
      {
        type: 'text',
        text: 'hello',
      },
      {
        type: 'text',
        text: ' ',
      },
      {
        type: 'text',
        text: 'world',
      },
    ],
    serialized: 'hello world',
  },
  {
    name: 'free text around tokens',
    input: 'foo status:is:active bar baz',
    options: {},
    source: 'serializer',
    tokens: [
      {
        type: 'text',
        text: 'foo',
      },
      {
        type: 'filterToken',
        key: 'status',
        operator: 'is',
        value: 'active',
        immutable: false,
      },
      {
        type: 'text',
        text: 'bar',
      },
      {
        type: 'text',
        text: ' ',
      },
      {
        type: 'text',
        text: 'baz',
      },
    ],
    serialized: 'foo status:is:active bar baz',
  },
  {
    name: 'quoted free text in plain mode',
    input: '"hello world"',
    options: {},
    source: 'serializer',
    tokens: [
      {
        type: 'text',
        text: '"hello world"',
      },
    ],
    serialized: '"hello world"',
  },
  {
    name: 'quoted free text in tokenize mode',
    input: '"hello world" status:is:active',
    options: {
      freeTextMode: 'tokenize',
    },
    source: 'serializer',
    tokens: [
      {
        type: 'freeTextToken',
        value: 'hello world',
        quoted: true,
      },
      {
        type: 'filterToken',
        key: 'status',
        operator: 'is',
        value: 'active',
        immutable: false,
      },
    ],
    serialized: '"hello world" status:is:active',
  },
  {
    name: 'unquoted free text in tokenize mode',
    input: 'alpha status:is:active beta',
    options: {
      freeTextMode: 'tokenize',
    },
    source: 'serializer',
    tokens: [
      {
        type: 'freeTextToken',
        value: 'alpha',
        quoted: false,
      },
      {
        type: 'filterToken',
        key: 'status',
        operator: 'is',
        value: 'active',
        immutable: false,
      },
      {
        type: 'freeTextToken',
        value: 'beta',
        quoted: false,
      },
    ],
    serialized: 'alpha status:is:active beta',
  },
  {
    name: 'free text with escaped quotes in tokenize mode',
    input: '"say \\"hello\\""',
    options: {
      freeTextMode: 'tokenize',
    },
    source: 'serializer',
    tokens: [
      {
        type: 'freeTextToken',
        value: 'say "hello"',
        quoted: true,
      },
    ],
    serialized: '"say \\"hello\\""',
  },
  {
    name: 'unknown field without unknown field support',
    input: 'custom:value',
    options: {},
    source: 'serializer',
    tokens: [
      {
        type: 'text',
        text: 'custom:value',
      },
    ],
    serialized: 'custom:value',
  },
  {
    name: 'unknown field with unknown field support',
    input: 'custom:value other:is:x',
    options: {
      unknownFieldOperators: ['is', 'contains'],
      allowUnknownFields: true,
    },
    source: 'typed',
    tokens: [
      {
        type: 'filterToken',
        key: 'custom',
        operator: 'is',
        value: 'value',
        immutable: false,
      },
      {
        type: 'filterToken',
        key: 'other',
        operator: 'is',
        value: 'x',
        immutable: false,
      },
    ],
    serialized: 'custom:is:value other:is:x',
  },
  {
    name: 'unknown field with a listed operator',
    input: 'custom:contains:abc',
    options: {
      unknownFieldOperators: ['is', 'contains'],
      allowUnknownFields: true,
    },
    source: 'serializer',
    tokens: [
      {
        type: 'filterToken',
        key: 'custom',
        operator: 'contains',
        value: 'abc',
        immutable: false,
      },
    ],
    serialized: 'custom:contains:abc',
  },
  {
    name: 'unknown operator on a known field',
    input: 'status:matches:active',
    options: {},
    source: 'typed',
    tokens: [
      {
        type: 'filterToken',
        key: 'status',
        operator: 'is',
        value: 'matches:active',
        immutable: false,
      },
    ],
    serialized: 'status:is:matches:active',
  },
  {
    name: 'custom delimiter',
    input: 'status=is=active name=contains=bob',
    options: {
      delimiter: '=',
    },
    source: 'serializer',
    tokens: [
      {
        type: 'filterToken',
        key: 'status',
        operator: 'is',
        value: 'active',
        immutable: false,
      },
      {
        type: 'filterToken',
        key: 'name',
        operator: 'contains',
        value: 'bob',
        immutable: false,
      },
    ],
    serialized: 'status=is=active name=contains=bob',
  },
  {
    name: 'extra whitespace between parts',
    input: '  status:is:active    hello   ',
    options: {},
    source: 'typed',
    tokens: [
      {
        type: 'filterToken',
        key: 'status',
        operator: 'is',
        value: 'active',
        immutable: false,
      },
      {
        type: 'text',
        text: 'hello',
      },
    ],
    serialized: 'status:is:active hello',
  },
  {
    name: 'repeated filter',
    input: 'status:is:active status:is:pending',
    options: {},
    source: 'serializer',
    tokens: [
      {
        type: 'filterToken',
        key: 'status',
        operator: 'is',
        value: 'active',
        immutable: false,
      },
      {
        type: 'filterToken',
        key: 'status',
        operator: 'is',
        value: 'pending',
        immutable: false,
      },
    ],
    serialized: 'status:is:active status:is:pending',
  },
  {
    name: 'quoted value with spaces and escaped quotes',
    input: 'name:is:"a b \\"c\\""',
    options: {},
    source: 'serializer',
    tokens: [
      {
        type: 'filterToken',
        key: 'name',
        operator: 'is',
        value: 'a b "c"',
        immutable: false,
      },
    ],
    serialized: 'name:is:"a b \\"c\\""',
  },
  {
    name: 'quoted value ending in a backslash',
    input: 'name:is:"a\\\\"',
    options: {},
    source: 'serializer',
    tokens: [
      {
        type: 'filterToken',
        key: 'name',
        operator: 'is',
        value: 'a\\',
        immutable: false,
      },
    ],
    serialized: 'name:is:"a\\\\"',
  },
  {
    name: 'quoted value with a backslash and no space',
    input: 'name:is:"a\\\\b"',
    options: {},
    source: 'serializer',
    tokens: [
      {
        type: 'filterToken',
        key: 'name',
        operator: 'is',
        value: 'a\\b',
        immutable: false,
      },
    ],
    serialized: 'name:is:"a\\\\b"',
  },
  {
    name: 'value with an equals sign',
    input: 'name:is:a=b',
    options: {},
    source: 'serializer',
    tokens: [
      {
        type: 'filterToken',
        key: 'name',
        operator: 'is',
        value: 'a=b',
        immutable: false,
      },
    ],
    serialized: 'name:is:a=b',
  },
  {
    name: 'value that looks like an operator',
    input: 'name:is:contains:foo',
    options: {},
    source: 'serializer',
    tokens: [
      {
        type: 'filterToken',
        key: 'name',
        operator: 'is',
        value: 'contains:foo',
        immutable: false,
      },
    ],
    serialized: 'name:is:contains:foo',
  },
  {
    name: 'value that repeats the operator',
    input: 'name:is:is:x',
    options: {},
    source: 'serializer',
    tokens: [
      {
        type: 'filterToken',
        key: 'name',
        operator: 'is',
        value: 'is:x',
        immutable: false,
      },
    ],
    serialized: 'name:is:is:x',
  },
  {
    name: 'value with non-ASCII text',
    input: 'name:is:東京',
    options: {},
    source: 'serializer',
    tokens: [
      {
        type: 'filterToken',
        key: 'name',
        operator: 'is',
        value: '東京',
        immutable: false,
      },
    ],
    serialized: 'name:is:東京',
  },
  {
    name: 'value with a non-breaking space',
    input: 'name:is:a b',
    options: {},
    source: 'serializer',
    tokens: [
      {
        type: 'filterToken',
        key: 'name',
        operator: 'is',
        value: 'a b',
        immutable: false,
      },
    ],
    serialized: 'name:is:a b',
  },
  {
    name: 'value with a raw tab',
    input: 'name:is:a\tb',
    options: {},
    source: 'serializer',
    tokens: [
      {
        type: 'filterToken',
        key: 'name',
        operator: 'is',
        value: 'a\tb',
        immutable: false,
      },
    ],
    serialized: 'name:is:a\tb',
  },
  {
    name: 'value with a raw newline',
    input: 'name:is:a\nb',
    options: {},
    source: 'serializer',
    tokens: [
      {
        type: 'filterToken',
        key: 'name',
        operator: 'is',
        value: 'a\nb',
        immutable: false,
      },
    ],
    serialized: 'name:is:a\nb',
  },
  {
    name: 'value with a raw carriage return',
    input: 'name:is:a\rb',
    options: {},
    source: 'serializer',
    tokens: [
      {
        type: 'filterToken',
        key: 'name',
        operator: 'is',
        value: 'a\rb',
        immutable: false,
      },
    ],
    serialized: 'name:is:a\rb',
  },
  {
    name: 'enum value in another case',
    input: 'status:is:ACTIVE',
    options: {},
    source: 'typed',
    tokens: [
      {
        type: 'filterToken',
        key: 'status',
        operator: 'is',
        value: 'active',
        immutable: false,
      },
    ],
    serialized: 'status:is:active',
  },
  {
    name: 'enum value in the shorthand with another case',
    input: 'status:Pending',
    options: {},
    source: 'typed',
    tokens: [
      {
        type: 'filterToken',
        key: 'status',
        operator: 'is',
        value: 'pending',
        immutable: false,
      },
    ],
    serialized: 'status:is:pending',
  },
  {
    name: 'incomplete quote in a value',
    input: 'name:is:"john',
    options: {},
    source: 'typed',
    tokens: [
      {
        type: 'filterToken',
        key: 'name',
        operator: 'is',
        value: 'john',
        immutable: false,
      },
    ],
    serialized: 'name:is:john',
  },
  {
    name: 'quoted value followed by text',
    input: 'name:is:"a b" tail',
    options: {},
    source: 'serializer',
    tokens: [
      {
        type: 'filterToken',
        key: 'name',
        operator: 'is',
        value: 'a b',
        immutable: false,
      },
      {
        type: 'text',
        text: 'tail',
      },
    ],
    serialized: 'name:is:"a b" tail',
  },
  {
    name: 'quoted value followed by a character',
    input: 'name:is:"a b"c',
    options: {},
    source: 'typed',
    tokens: [
      {
        type: 'filterToken',
        key: 'name',
        operator: 'is',
        value: 'a bc',
        immutable: false,
      },
    ],
    serialized: 'name:is:"a bc"',
  },
  {
    name: 'two quoted values',
    input: 'name:is:"a b" user.email:is:"c d"',
    options: {},
    source: 'serializer',
    tokens: [
      {
        type: 'filterToken',
        key: 'name',
        operator: 'is',
        value: 'a b',
        immutable: false,
      },
      {
        type: 'filterToken',
        key: 'user.email',
        operator: 'is',
        value: 'c d',
        immutable: false,
      },
    ],
    serialized: 'name:is:"a b" user.email:is:"c d"',
  },
  {
    name: 'equals delimiter with a quoted value',
    input: 'name=is="john smith"',
    options: {
      delimiter: '=',
    },
    source: 'serializer',
    tokens: [
      {
        type: 'filterToken',
        key: 'name',
        operator: 'is',
        value: 'john smith',
        immutable: false,
      },
    ],
    serialized: 'name=is="john smith"',
  },
  {
    name: 'equals delimiter with the delimiter in quotes',
    input: 'name=is="a=b"',
    options: {
      delimiter: '=',
    },
    source: 'typed',
    tokens: [
      {
        type: 'filterToken',
        key: 'name',
        operator: 'is',
        value: 'a=b',
        immutable: false,
      },
    ],
    serialized: 'name=is=a=b',
  },
  {
    name: 'equals delimiter with the delimiter in the value',
    input: 'name=is=a=b',
    options: {
      delimiter: '=',
    },
    source: 'serializer',
    tokens: [
      {
        type: 'filterToken',
        key: 'name',
        operator: 'is',
        value: 'a=b',
        immutable: false,
      },
    ],
    serialized: 'name=is=a=b',
  },
  {
    name: 'equals delimiter with a colon in the value',
    input: 'name=is=a:b',
    options: {
      delimiter: '=',
    },
    source: 'serializer',
    tokens: [
      {
        type: 'filterToken',
        key: 'name',
        operator: 'is',
        value: 'a:b',
        immutable: false,
      },
    ],
    serialized: 'name=is=a:b',
  },
  {
    name: 'equals delimiter with a backslash',
    input: 'name=is="a=\\\\b"',
    options: {
      delimiter: '=',
    },
    source: 'serializer',
    tokens: [
      {
        type: 'filterToken',
        key: 'name',
        operator: 'is',
        value: 'a=\\b',
        immutable: false,
      },
    ],
    serialized: 'name=is="a=\\\\b"',
  },
  {
    name: 'equals delimiter with a date',
    input: 'created=after=2024-01-15',
    options: {
      delimiter: '=',
    },
    source: 'serializer',
    tokens: [
      {
        type: 'filterToken',
        key: 'created',
        operator: 'after',
        value: '2024-01-15',
        immutable: false,
      },
    ],
    serialized: 'created=after=2024-01-15',
  },
  {
    name: 'equals delimiter with a datetime',
    input: 'updated=before=2024-01-15T10:30',
    options: {
      delimiter: '=',
    },
    source: 'serializer',
    tokens: [
      {
        type: 'filterToken',
        key: 'updated',
        operator: 'before',
        value: '2024-01-15T10:30',
        immutable: false,
      },
    ],
    serialized: 'updated=before=2024-01-15T10:30',
  },
  {
    name: 'equals delimiter with an enum shorthand',
    input: 'status=pending',
    options: {
      delimiter: '=',
    },
    source: 'typed',
    tokens: [
      {
        type: 'filterToken',
        key: 'status',
        operator: 'is',
        value: 'pending',
        immutable: false,
      },
    ],
    serialized: 'status=is=pending',
  },
  {
    name: 'equals delimiter with an empty value',
    input: 'name=is=',
    options: {
      delimiter: '=',
    },
    source: 'serializer',
    tokens: [
      {
        type: 'text',
        text: 'name=is=',
      },
    ],
    serialized: 'name=is=',
  },
  {
    name: 'colon filter text under the equals delimiter',
    input: 'status:is:active',
    options: {
      delimiter: '=',
    },
    source: 'serializer',
    tokens: [
      {
        type: 'text',
        text: 'status:is:active',
      },
    ],
    serialized: 'status:is:active',
  },
  {
    name: 'equals delimiter with tokenize mode',
    input: 'status=is=active hello',
    options: {
      delimiter: '=',
      freeTextMode: 'tokenize',
    },
    source: 'serializer',
    tokens: [
      {
        type: 'filterToken',
        key: 'status',
        operator: 'is',
        value: 'active',
        immutable: false,
      },
      {
        type: 'freeTextToken',
        value: 'hello',
        quoted: false,
      },
    ],
    serialized: 'status=is=active hello',
  },
  {
    name: 'free text two words in plain mode',
    input: 'hello world',
    options: {
      freeTextMode: 'plain',
    },
    source: 'serializer',
    tokens: [
      {
        type: 'text',
        text: 'hello',
      },
      {
        type: 'text',
        text: ' ',
      },
      {
        type: 'text',
        text: 'world',
      },
    ],
    serialized: 'hello world',
  },
  {
    name: 'free text two words in tokenize mode',
    input: 'hello world',
    options: {
      freeTextMode: 'tokenize',
    },
    source: 'serializer',
    tokens: [
      {
        type: 'freeTextToken',
        value: 'hello',
        quoted: false,
      },
      {
        type: 'freeTextToken',
        value: 'world',
        quoted: false,
      },
    ],
    serialized: 'hello world',
  },
  {
    name: 'free text two words in none mode',
    input: 'hello world',
    options: {
      freeTextMode: 'none',
    },
    source: 'typed',
    tokens: [],
    serialized: '',
  },
  {
    name: 'free text quoted phrase in plain mode',
    input: '"hello world"',
    options: {
      freeTextMode: 'plain',
    },
    source: 'serializer',
    tokens: [
      {
        type: 'text',
        text: '"hello world"',
      },
    ],
    serialized: '"hello world"',
  },
  {
    name: 'free text quoted phrase in tokenize mode',
    input: '"hello world"',
    options: {
      freeTextMode: 'tokenize',
    },
    source: 'serializer',
    tokens: [
      {
        type: 'freeTextToken',
        value: 'hello world',
        quoted: true,
      },
    ],
    serialized: '"hello world"',
  },
  {
    name: 'free text quoted phrase in none mode',
    input: '"hello world"',
    options: {
      freeTextMode: 'none',
    },
    source: 'typed',
    tokens: [],
    serialized: '',
  },
  {
    name: 'free text quoted phrase with escaped quotes in plain mode',
    input: '"say \\"hi\\""',
    options: {
      freeTextMode: 'plain',
    },
    source: 'serializer',
    tokens: [
      {
        type: 'text',
        text: '"say \\"hi\\""',
      },
    ],
    serialized: '"say \\"hi\\""',
  },
  {
    name: 'free text quoted phrase with escaped quotes in tokenize mode',
    input: '"say \\"hi\\""',
    options: {
      freeTextMode: 'tokenize',
    },
    source: 'serializer',
    tokens: [
      {
        type: 'freeTextToken',
        value: 'say "hi"',
        quoted: true,
      },
    ],
    serialized: '"say \\"hi\\""',
  },
  {
    name: 'free text quoted phrase with a backslash in plain mode',
    input: '"C:\\\\temp"',
    options: {
      freeTextMode: 'plain',
    },
    source: 'serializer',
    tokens: [
      {
        type: 'text',
        text: '"C:\\\\temp"',
      },
    ],
    serialized: '"C:\\\\temp"',
  },
  {
    name: 'free text quoted phrase with a backslash in tokenize mode',
    input: '"C:\\\\temp"',
    options: {
      freeTextMode: 'tokenize',
    },
    source: 'serializer',
    tokens: [
      {
        type: 'freeTextToken',
        value: 'C:\\temp',
        quoted: true,
      },
    ],
    serialized: '"C:\\\\temp"',
  },
  {
    name: 'free text word with a backslash and an n in plain mode',
    input: 'a\\nb',
    options: {
      freeTextMode: 'plain',
    },
    source: 'serializer',
    tokens: [
      {
        type: 'text',
        text: 'a\\nb',
      },
    ],
    serialized: 'a\\nb',
  },
  {
    name: 'free text quoted phrase with a backslash and an n in plain mode',
    input: '"a\\nb"',
    options: {
      freeTextMode: 'plain',
    },
    source: 'typed',
    tokens: [
      {
        type: 'text',
        text: '"a\\\\nb"',
      },
    ],
    serialized: '"a\\\\nb"',
  },
  {
    name: 'free text quoted phrase with a backslash and an n in tokenize mode',
    input: '"a\\nb"',
    options: {
      freeTextMode: 'tokenize',
    },
    source: 'typed',
    tokens: [
      {
        type: 'freeTextToken',
        value: 'a\\nb',
        quoted: true,
      },
    ],
    serialized: '"a\\\\nb"',
  },
  {
    name: 'free text key and value that match no field in plain mode',
    input: 'foo:bar',
    options: {
      freeTextMode: 'plain',
    },
    source: 'serializer',
    tokens: [
      {
        type: 'text',
        text: 'foo:bar',
      },
    ],
    serialized: 'foo:bar',
  },
  {
    name: 'free text key and value that match no field in none mode',
    input: 'foo:bar',
    options: {
      freeTextMode: 'none',
    },
    source: 'typed',
    tokens: [],
    serialized: '',
  },
  {
    name: 'free text phrase with an open quote in plain mode',
    input: '"hello world',
    options: {
      freeTextMode: 'plain',
    },
    source: 'typed',
    tokens: [
      {
        type: 'text',
        text: '"hello world"',
      },
    ],
    serialized: '"hello world"',
  },
  {
    name: 'free text phrase with an open quote in tokenize mode',
    input: '"hello world',
    options: {
      freeTextMode: 'tokenize',
    },
    source: 'typed',
    tokens: [
      {
        type: 'freeTextToken',
        value: 'hello world',
        quoted: true,
      },
    ],
    serialized: '"hello world"',
  },
  {
    name: 'free text with a character after a quote in tokenize mode',
    input: '"a b"c',
    options: {
      freeTextMode: 'tokenize',
    },
    source: 'typed',
    tokens: [
      {
        type: 'freeTextToken',
        value: 'a b',
        quoted: true,
      },
      {
        type: 'freeTextToken',
        value: 'c',
        quoted: false,
      },
    ],
    serialized: '"a b" c',
  },
  {
    name: 'segments separated by a tab',
    input: 'status:is:active\tname:is:x',
    options: {},
    source: 'serializer',
    tokens: [
      {
        type: 'filterToken',
        key: 'status',
        operator: 'is',
        value: 'active\tname:is:x',
        immutable: false,
      },
    ],
    serialized: 'status:is:active\tname:is:x',
  },
  {
    name: 'free text mixed with filters in none mode',
    input: 'foo status:is:active bar',
    options: {
      freeTextMode: 'none',
    },
    source: 'typed',
    tokens: [
      {
        type: 'filterToken',
        key: 'status',
        operator: 'is',
        value: 'active',
        immutable: false,
      },
    ],
    serialized: 'status:is:active',
  },
  {
    name: 'unknown field accepting every operator',
    input: 'custom:contains:abc',
    options: {
      allowUnknownFields: true,
    },
    source: 'serializer',
    tokens: [
      {
        type: 'filterToken',
        key: 'custom',
        operator: 'contains',
        value: 'abc',
        immutable: false,
      },
    ],
    serialized: 'custom:contains:abc',
  },
  {
    name: 'unknown field with a quoted value',
    input: 'custom:is:"a b"',
    options: {
      allowUnknownFields: true,
    },
    source: 'serializer',
    tokens: [
      {
        type: 'filterToken',
        key: 'custom',
        operator: 'is',
        value: 'a b',
        immutable: false,
      },
    ],
    serialized: 'custom:is:"a b"',
  },
  {
    name: 'unknown field with an unlisted word after the key',
    input: 'custom:foo:bar',
    options: {
      allowUnknownFields: true,
    },
    source: 'typed',
    tokens: [
      {
        type: 'filterToken',
        key: 'custom',
        operator: 'is',
        value: 'foo:bar',
        immutable: false,
      },
    ],
    serialized: 'custom:is:foo:bar',
  },
  {
    name: 'unknown field in tokenize mode',
    input: 'custom:value alpha',
    options: {
      allowUnknownFields: true,
      freeTextMode: 'tokenize',
    },
    source: 'typed',
    tokens: [
      {
        type: 'filterToken',
        key: 'custom',
        operator: 'is',
        value: 'value',
        immutable: false,
      },
      {
        type: 'freeTextToken',
        value: 'alpha',
        quoted: false,
      },
    ],
    serialized: 'custom:is:value alpha',
  },
  {
    name: 'unknown field with a dotted key',
    input: 'a.b:is:x',
    options: {
      allowUnknownFields: true,
    },
    source: 'serializer',
    tokens: [
      {
        type: 'filterToken',
        key: 'a.b',
        operator: 'is',
        value: 'x',
        immutable: false,
      },
    ],
    serialized: 'a.b:is:x',
  },
  {
    name: 'unknown field with the equals delimiter',
    input: 'custom=gt=5',
    options: {
      allowUnknownFields: true,
      delimiter: '=',
    },
    source: 'serializer',
    tokens: [
      {
        type: 'filterToken',
        key: 'custom',
        operator: 'gt',
        value: '5',
        immutable: false,
      },
    ],
    serialized: 'custom=gt=5',
  },
  {
    name: 'unknown field value with escaped quotes',
    input: 'custom:is:"say \\"hi\\""',
    options: {
      allowUnknownFields: true,
    },
    source: 'serializer',
    tokens: [
      {
        type: 'filterToken',
        key: 'custom',
        operator: 'is',
        value: 'say "hi"',
        immutable: false,
      },
    ],
    serialized: 'custom:is:"say \\"hi\\""',
  },
  {
    name: 'unknown field value that looks like an operator',
    input: 'custom:is:gt:5',
    options: {
      allowUnknownFields: true,
      unknownFieldOperators: ['is', 'contains'],
    },
    source: 'serializer',
    tokens: [
      {
        type: 'filterToken',
        key: 'custom',
        operator: 'is',
        value: 'gt:5',
        immutable: false,
      },
    ],
    serialized: 'custom:is:gt:5',
  },
  {
    name: 'unknown field with no support in none mode',
    input: 'custom:is:x status:is:active',
    options: {
      freeTextMode: 'none',
    },
    source: 'typed',
    tokens: [
      {
        type: 'filterToken',
        key: 'status',
        operator: 'is',
        value: 'active',
        immutable: false,
      },
    ],
    serialized: 'status:is:active',
  },
  {
    name: 'unknown field with no support and the equals delimiter',
    input: 'custom=is=x',
    options: {
      delimiter: '=',
    },
    source: 'serializer',
    tokens: [
      {
        type: 'text',
        text: 'custom=is=x',
      },
    ],
    serialized: 'custom=is=x',
  },
];

export const changedCases: ChangedCase[] = [
  {
    name: 'quoted value with a newline',
    input: 'name:is:"a\nb"',
    options: {},
    source: 'typed',
    tokens: [
      {
        type: 'filterToken',
        key: 'name',
        operator: 'is',
        value: 'a\nb',
        immutable: false,
      },
    ],
    serialized: 'name:is:a\nb',
    reason: 'a value with a newline is written in quotes, 0.1.1 wrote it bare',
  },
  {
    name: 'quoted value with a backslash and an n',
    input: 'name:is:"a\\nb"',
    options: {},
    source: 'typed',
    tokens: [
      {
        type: 'filterToken',
        key: 'name',
        operator: 'is',
        value: 'a\nb',
        immutable: false,
      },
    ],
    serialized: 'name:is:a\nb',
    reason: 'inside quotes a backslash and an n are two characters, 0.1.1 read them as a newline',
  },
  {
    name: 'quoted value with a backslash and a t',
    input: 'name:is:"a\\tb"',
    options: {},
    source: 'typed',
    tokens: [
      {
        type: 'filterToken',
        key: 'name',
        operator: 'is',
        value: 'a\tb',
        immutable: false,
      },
    ],
    serialized: 'name:is:a\tb',
    reason: 'inside quotes a backslash and a t are two characters, 0.1.1 read them as a tab',
  },
  {
    name: 'free text word with a backslash and an n in tokenize mode',
    input: 'a\\nb',
    options: {
      freeTextMode: 'tokenize',
    },
    source: 'serializer',
    tokens: [
      {
        type: 'freeTextToken',
        value: 'a\\nb',
        quoted: false,
      },
    ],
    serialized: 'a\\nb',
    reason: 'free text with a backslash is written in quotes, 0.1.1 wrote it bare',
  },
  {
    name: 'free text key and value that match no field in tokenize mode',
    input: 'foo:bar',
    options: {
      freeTextMode: 'tokenize',
    },
    source: 'serializer',
    tokens: [
      {
        type: 'freeTextToken',
        value: 'foo:bar',
        quoted: false,
      },
    ],
    serialized: 'foo:bar',
    reason:
      'free text that starts as a key and a delimiter is written in quotes, 0.1.1 wrote it bare',
  },
  {
    name: 'free text with a quote inside a word in tokenize mode',
    input: 'ab"c d"e',
    options: {
      freeTextMode: 'tokenize',
    },
    source: 'serializer',
    tokens: [
      {
        type: 'freeTextToken',
        value: 'ab"c d"e',
        quoted: false,
      },
    ],
    serialized: 'ab"c d"e',
    reason: 'free text with a quote is written in quotes, 0.1.1 wrote it bare',
  },
  {
    name: 'free text with a raw tab in tokenize mode',
    input: 'a\tb',
    options: {
      freeTextMode: 'tokenize',
    },
    source: 'serializer',
    tokens: [
      {
        type: 'freeTextToken',
        value: 'a\tb',
        quoted: false,
      },
    ],
    serialized: 'a\tb',
    reason: 'free text with whitespace is written in quotes, 0.1.1 wrote it bare',
  },
  {
    name: 'unknown field with no support in tokenize mode',
    input: 'custom:is:x',
    options: {
      freeTextMode: 'tokenize',
    },
    source: 'serializer',
    tokens: [
      {
        type: 'freeTextToken',
        value: 'custom:is:x',
        quoted: false,
      },
    ],
    serialized: 'custom:is:x',
    reason:
      'free text that starts as a key and a delimiter is written in quotes, 0.1.1 wrote it bare',
  },
  {
    name: 'operator of another field after a known key',
    input: 'status:contains:foo',
    options: {},
    source: 'typed',
    tokens: [
      {
        type: 'filterToken',
        key: 'status',
        operator: 'is',
        value: 'contains:foo',
        immutable: false,
      },
    ],
    serialized: 'status:is:contains:foo',
    reason: 'status does not allow contains, so the operator stays on the token',
  },
  {
    name: 'operator the unknown field template lacks',
    input: 'custom:gt:5',
    options: {
      allowUnknownFields: true,
      unknownFieldOperators: ['is', 'contains'],
    },
    source: 'typed',
    tokens: [
      {
        type: 'filterToken',
        key: 'custom',
        operator: 'is',
        value: 'gt:5',
        immutable: false,
      },
    ],
    serialized: 'custom:is:gt:5',
    reason: 'the template does not list gt, so the operator stays on the token',
  },
];
