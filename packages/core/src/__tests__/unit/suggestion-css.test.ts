import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const css = readFileSync(resolve(__dirname, '../../index.css'), 'utf8');

/** The declarations of the rule whose whole selector is `.selector`. */
function declarationsOf(selector: string): string {
  for (const rule of css.split('}')) {
    const [head, body] = rule.split('{');
    const selectorText = head.replace(/\/\*[\s\S]*?\*\//g, '').trim();
    if (selectorText === `:where(.${selector})`) return body;
  }
  throw new Error(`no rule for .${selector}`);
}

describe('custom suggestion option', () => {
  it('does not take the centred, spaced layout of a field option', () => {
    const declarations = declarationsOf('tsi-custom-suggestion-item');

    expect(declarations).toMatch(/align-items:\s*stretch/);
    expect(declarations).toMatch(/gap:\s*0/);
  });
});
