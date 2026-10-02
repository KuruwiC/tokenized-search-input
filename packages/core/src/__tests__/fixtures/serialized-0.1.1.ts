/**
 * Serializer output of version 0.1.1, kept to check that later versions parse the same
 * queries into the same tokens and write them back as the same strings.
 *
 * Generated, not written by hand: each case is what the 0.1.1 `parseQueryToDoc` made of
 * `input` with `fields` and `options` (the separator nodes that version put around tokens left out of `tokens`), and what its
 * `serializeDocToQuery` wrote for that document. `unknownFieldOperators` stands for the
 * 0.1.1 options `allowUnknownFields: true` and `unknownFieldOperators`.
 */
import type { FieldDefinition } from '../../types';

export interface SerializedCaseOptions {
  freeTextMode?: 'plain' | 'tokenize';
  delimiter?: string;
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
  tokens: SerializedToken[];
  serialized: string;
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
    tokens: [],
    serialized: '',
  },
  {
    name: 'filter with the is operator',
    input: 'status:is:active',
    options: {},
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
    },
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
    },
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
];
