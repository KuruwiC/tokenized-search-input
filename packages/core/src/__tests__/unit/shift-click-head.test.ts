import type { Node as ProseMirrorNode } from '@tiptap/pm/model';
import { describe, expect, it } from 'vitest';
import { shiftClickHead } from '../../plugins/selection-guard/shift-click-handler';
import { blockSchema as schema } from '../fixtures';

const token = (value: string) => schema.node('filterToken', { key: 'status', value });
const paragraph = (...content: ProseMirrorNode[]) =>
  schema.node('doc', null, [schema.node('paragraph', null, content)]);

/** posAtCoords reports `inside: -1` for a position outside any node. */
const at = (pos: number, inside = -1) => ({ pos, inside });

describe('shiftClickHead', () => {
  // <p>[a][b]</p>: a spans 1..2, b spans 2..3
  const twoTokens = paragraph(token('a'), token('b'));

  it('extends to the clicked gap between two tokens', () => {
    expect(shiftClickHead(twoTokens, at(2), 1)).toBe(2);
    expect(shiftClickHead(twoTokens, at(2), 3)).toBe(2);
  });

  it('extends to the paragraph edges next to a token', () => {
    expect(shiftClickHead(twoTokens, at(3), 2)).toBe(3);
    expect(shiftClickHead(twoTokens, at(1), 2)).toBe(1);
  });

  it('takes a clicked token whole: its end when selecting forward', () => {
    // posAtCoords may report either side of the token it was clicked on
    expect(shiftClickHead(twoTokens, at(2, 2), 1)).toBe(3);
    expect(shiftClickHead(twoTokens, at(3, 2), 1)).toBe(3);
  });

  it('takes a clicked token whole: its start when selecting backward', () => {
    expect(shiftClickHead(twoTokens, at(1, 1), 3)).toBe(1);
    expect(shiftClickHead(twoTokens, at(2, 1), 3)).toBe(1);
  });

  it('leaves clicks within text to the browser', () => {
    const doc = paragraph(schema.text('hello'), token('a'));

    expect(shiftClickHead(doc, at(3, 0), 1)).toBeNull();
  });

  it('handles the position between text and a token itself', () => {
    const doc = paragraph(schema.text('hello'), token('a'));

    expect(shiftClickHead(doc, at(6), 1)).toBe(6);
  });
});
