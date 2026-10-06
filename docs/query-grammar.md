# Query grammar

A query is the string form of the tokens in the search input. `serializeDocToQuery` and
`createQuerySnapshot().text` write it, and `parseQueryToDoc` reads it. One tokenizer (`packages/core/src/serializer/tokenize.ts`) cuts a query into segments, and one function,
`quote`, writes text that needs quotes. A query that cannot be read as written is not
changed; it is reported in the `diagnostics` of the result.

The [README](../README.md) shows how to use these functions and the props that read and write queries.

## Segments

A query is a sequence of segments separated by spaces. Only a space (U+0020) separates
segments; a tab, a carriage return, a newline, a non-breaking space and any other Unicode
space are ordinary characters of a segment. In this document, _whitespace_ means a space, a
tab, a carriage return or a newline; the other Unicode spaces are not whitespace. The query as
written has no spaces at its start or end, and keeps any other character there, such as an
ideographic space at the end of a value.

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

`quote(text, { always })` is the one place that decides how text is quoted. A value or free
text is quoted when it holds any whitespace character (a space, a tab, a carriage return or
a newline), a quote or a backslash. Only a space separates segments, but any whitespace is
quoted so that the text reads back as one value wherever it is pasted.

Free text is also quoted when the editor would otherwise read it as a filter: when its key,
the text before the first delimiter, is a field of the editor, or any identifier when an
`unknownFields` template is set, and a value follows. `serializeDocToQuery` and
`createQuerySnapshot` take `fields` and `unknownFields` for this and the editor passes its
own. Free text such as `http://example.com` or `10:30` stays as written, because no field
matches its key. Without `fields`, free text is only quoted for the reasons above.

`always` quotes text that would not need it, which is how free text that was typed in quotes
keeps them. Inside the quotes `"` is written as `\"` and `\` as `\\`.

Free text that is only whitespace is dropped when a query is read, so it is not written.

A newline inside a quoted value is part of the value, but the browser's plain-text paste
does not keep it: pasting `name:is:"a<newline>b"` into the editor turns the newline into
what the paste handler makes of line breaks. Use `setValue`, the `defaultValue` or the
value prop to load such a value.

## Operators

A word after the key is read as the operator when the field of the key allows it. A word the
field does not allow is still read as the operator when it is a default operator or an
operator of the `unknownFields` template; the operators of other fields do not count.

- The field allows it: it is the operator of the token.
- The field does not allow it, as in `status:contains:foo` on a field without `contains`: it
  is still the operator of the token, so what was written is kept. The token is listed in
  `diagnostics.unknownOperators`, and the `unknown-operator` validation rule marks it
  invalid. The token shows its operator and offers the operators of the field, so it can be
  repaired. A field can switch the rule off with `validation: { 'unknown-operator': false }`,
  and the `unknownFields` template can do the same for every field it makes.
- It is none of these, as in `time:10:30` or `status:matches:x`: it belongs to the value, and
  the operator is the first one of the field. Only a word that looks like an operator counts
  as an unknown operator, because `key:word:rest` is also the shorthand of a value that holds
  the delimiter.

A word with an empty key, such as `::x` or `:foo`, is never a filter.

A filter typed in the editor reads the same way. Typing the key and the delimiter starts a
token whose value takes the keys typed next; when the delimiter ends a word that would be
read as the operator, that word becomes the operator of the token and the keys after it go
to the value, so typing `status:is_not:active` gives the token that pasting it gives. Only
the word right after the key is read this way, and only while the token has the first
operator of its field: a word typed after an operator, after another operator was chosen
from the token's operator list, or at the start of a value the token already had stays in
the value.

## Unknown fields

A key that matches no field stays free text. With an `unknownFields` template it becomes a
filter whose operators come from the template, all default operators when it names none.

`diagnostics.unknownFields` lists the keys of segments that start as `key<d>` and match no
field, each once, but only keys that look like names: they start with a letter or an
underscore and hold letters, digits, `_`, `.` and `-`. `10:30` reports nothing, while
`http://example.com` reports `http`.

## Diagnostics

`parseQueryToDoc` returns `{ doc, diagnostics }`; `ParsedQuery` and `ParseDiagnostics` are
exported from the utils entry:

```ts
interface ParseDiagnostics {
  incompleteQuote: boolean;
  unknownFields: string[]; // each key once
  unknownOperators: { key: string; operator: string }[]; // each pair once
}
```
