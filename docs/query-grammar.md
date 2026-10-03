# Query grammar

A query is the string form of the tokens in the search input. `serializeDocToQuery` and
`createQuerySnapshot().text` write it, and `parseQueryToDoc` and `parseQueryString` read
it. One tokenizer (`serializer/tokenize.ts`) cuts a query into segments, and one function,
`quote`, writes text that needs quotes. A query that cannot be read as written is not
changed; it is reported in the `diagnostics` of the result.

## Segments

A query is a sequence of segments separated by spaces. Only a space (U+0020) separates
segments; a tab, a carriage return, a newline and a non-breaking space are ordinary
characters of a segment.

A segment is one of:

| Segment | Example | Read as |
| --- | --- | --- |
| Filter | `status:is:active` | key, operator and value |
| Filter without an operator | `status:active` | key and value, with the first operator of the field |
| Free text | `hello` | free text |
| Quoted free text | `"hello world"` | free text |

`<d>` stands for the delimiter, `:` by default, a single character fixed when the editor is
created. A filter is `key<d>operator<d>value`. Anything else is free text, and what happens
to free text depends on `freeTextMode`: `tokenize` makes a token of it, `plain` keeps it as
text, `none` drops it.

A segment that starts with a quote is quoted free text and ends at its closing quote. Any
other segment runs until a space outside quotes.

## Quotes

A filter value and free text can be wrapped in `"`. Inside quotes:

- `\"` stands for `"` and `\\` stands for `\`. These are the only escapes.
- A backslash before any other character stays a backslash, so `"a\nb"` is the four
  characters `a`, `\`, `n` and `b`.
- Newlines and tabs stand for themselves.
- A space does not end the segment, and the delimiter does not split it.

A quote can also open inside a segment, as in `name:is:"john smith"`. Characters after the
closing quote belong to the same segment, and `"a b"c` as a value reads as `a bc`. A quote
that is never closed runs to the end of the query and is reported as `incompleteQuote`.

### Writing

`quote(text, { always, segmentDelimiter })` is the one place that decides. A value or free text
is quoted when it holds any whitespace character, and only a space separates segments. Text is
quoted when it contains

- whitespace: a space, a tab, a carriage return or a newline,
- a quote or a backslash, or
- for text that stands as a segment of its own, a key followed by the delimiter at its start,
  such as `foo:bar`, which would read as a filter.

`always` quotes text that would not need it, which is how free text that was typed in quotes
keeps them. Inside the quotes `"` is written as `\"` and `\` as `\\`.

## Operators

A word after the key is read as the operator when it is one of the names the editor knows:
the default operators and every operator a field or the `unknownFields` template declares.

- The field allows it: it is the operator of the token.
- The field does not allow it, as in `status:contains:foo` on a field without `contains`: it
  is still the operator of the token, so what was written is kept. The token is listed in
  `diagnostics.unknownOperators`, and the `unknown-operator` validation rule marks it
  invalid. A field can switch the rule off with `validation: { 'unknown-operator': false }`.
- It is not a known name, as in `time:10:30` or `status:matches:x`: it belongs to the value, and
  the operator is the first one of the field. Only a word that looks like an operator counts as
  an unknown operator, because `key:word:rest` is also the shorthand of a value that holds the
  delimiter.

## Unknown fields

A key that matches no field stays free text, and is listed in `diagnostics.unknownFields`.
With an `unknownFields` template it becomes a filter whose operators come from the template,
all default operators when it names none.

## Diagnostics

`parseQueryString` returns `{ tokens, diagnostics }` and `parseQueryToDoc` returns
`{ doc, diagnostics }`:

```ts
interface ParseDiagnostics {
  incompleteQuote: boolean;
  unknownFields: string[]; // each key once
  unknownOperators: { key: string; operator: string }[]; // each pair once
}
```
