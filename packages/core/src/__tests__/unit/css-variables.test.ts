import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const css = readFileSync(resolve(__dirname, '../../index.css'), 'utf8');

interface Declaration {
  property: string;
  value: string;
}

/** Every `property: value` in a rule block; preludes (selectors, at-rules) end in `{` and are skipped. */
function declarations(source: string): Declaration[] {
  const text = source.replace(/\/\*[\s\S]*?\*\//g, '');
  const result: Declaration[] = [];
  for (const [, fragment = '', end] of text.matchAll(/([^{};]*)([{};])/g)) {
    if (end === '{') continue;
    const colon = fragment.indexOf(':');
    if (colon < 0) continue;
    result.push({
      property: fragment.slice(0, colon).trim(),
      value: fragment.slice(colon + 1).trim(),
    });
  }
  return result;
}

const variablesIn = (value: string) =>
  [...value.matchAll(/var\(\s*(--tsi-[\w-]+)/g)].map(([, name]) => name as string);

/**
 * The `--tsi-*` properties the stylesheet reads: through a `var()` in an ordinary property,
 * or in the value of a custom property that is itself read.
 */
function readVariables(all: Declaration[]): Set<string> {
  const read = new Set<string>();
  for (const { property, value } of all) {
    if (!property.startsWith('--')) for (const name of variablesIn(value)) read.add(name);
  }
  let grew = true;
  while (grew) {
    grew = false;
    for (const { property, value } of all) {
      if (!read.has(property)) continue;
      for (const name of variablesIn(value)) {
        if (!read.has(name)) {
          read.add(name);
          grew = true;
        }
      }
    }
  }
  return read;
}

describe('the --tsi-* variables of the stylesheet', () => {
  it('declares only variables that a rule reads', () => {
    const all = declarations(css);
    const declared = new Set(
      all.map(({ property }) => property).filter((property) => property.startsWith('--tsi-'))
    );
    const read = readVariables(all);

    expect(declared.size).toBeGreaterThan(0);
    expect([...declared].filter((name) => !read.has(name))).toEqual([]);
  });
});
