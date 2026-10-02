import { type Node as ProseMirrorNode, Schema } from '@tiptap/pm/model';
import { describe, expect, it } from 'vitest';
import { nearestValidCaret } from '../../utils/caret';

const schema = new Schema({
  nodes: {
    doc: { content: 'block+' },
    paragraph: { group: 'block', content: 'inline*' },
    text: { group: 'inline' },
    token: { group: 'inline', inline: true, atom: true },
    /** An atom with content of its own, so positions inside it exist. */
    chip: { group: 'inline', inline: true, atom: true, content: 'text*' },
  },
});

const token = () => schema.node('token');
const doc = (...paragraphs: ProseMirrorNode[][]) =>
  schema.node(
    'doc',
    null,
    paragraphs.map((content) => schema.node('paragraph', null, content))
  );

describe('nearestValidCaret', () => {
  it('keeps every position between and around adjacent tokens', () => {
    const d = doc([token(), token()]);

    for (const pos of [1, 2, 3]) {
      expect(nearestValidCaret(d, pos, 1)).toBe(pos);
      expect(nearestValidCaret(d, pos, -1)).toBe(pos);
    }
  });

  it('keeps positions inside text', () => {
    const d = doc([schema.text('foo'), token()]);

    expect(nearestValidCaret(d, 2, 1)).toBe(2);
  });

  it('moves a position inside an atom to the side it was heading for', () => {
    // <p>a<chip>xy</chip>b</p>: the chip spans 2..6, its content 3..5
    const d = doc([
      schema.text('a'),
      schema.node('chip', null, [schema.text('xy')]),
      schema.text('b'),
    ]);

    expect(nearestValidCaret(d, 4, 1)).toBe(6);
    expect(nearestValidCaret(d, 4, -1)).toBe(2);
  });

  it('moves a position between blocks into the nearest paragraph in the given direction', () => {
    const d = doc([schema.text('ab')], [schema.text('cd')]);

    expect(nearestValidCaret(d, 4, 1)).toBe(5);
    expect(nearestValidCaret(d, 4, -1)).toBe(3);
  });

  it('falls back to the other direction at the edges of the document', () => {
    const d = doc([token()]);

    expect(nearestValidCaret(d, 0, -1)).toBe(1);
    expect(nearestValidCaret(d, d.content.size, 1)).toBe(2);
  });

  it('clamps positions outside the document', () => {
    const d = doc([token()]);

    expect(nearestValidCaret(d, -5, -1)).toBe(1);
    expect(nearestValidCaret(d, 99, 1)).toBe(2);
  });
});
