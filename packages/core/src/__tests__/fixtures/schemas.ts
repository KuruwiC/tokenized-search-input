/**
 * Shared ProseMirror schemas for testing.
 *
 * These schemas provide consistent node definitions across all test files,
 * reducing duplication and ensuring uniform behavior.
 */
import { Schema } from '@tiptap/pm/model';

/**
 * Minimal inline schema with token support.
 * Use for tests that work with flat document structure (no paragraphs).
 *
 * Document structure: doc > inline* (filterToken, freeTextToken, text)
 */
export const inlineSchema = new Schema({
  nodes: {
    doc: { content: 'inline*' },
    text: { group: 'inline' },
    filterToken: {
      group: 'inline',
      inline: true,
      atom: true,
      attrs: {
        key: { default: '' },
        operator: { default: 'is' },
        value: { default: '' },
      },
    },
    freeTextToken: {
      group: 'inline',
      inline: true,
      atom: true,
      attrs: {
        value: { default: '' },
        quoted: { default: false },
      },
    },
  },
});

/**
 * Block schema with paragraph support.
 * Use for tests that require block-level document structure.
 *
 * Document structure: doc > block+ (paragraph > inline*)
 */
export const blockSchema = new Schema({
  nodes: {
    doc: { content: 'block+' },
    paragraph: { group: 'block', content: 'inline*' },
    text: { group: 'inline' },
    filterToken: {
      group: 'inline',
      inline: true,
      atom: true,
      attrs: {
        id: { default: '' },
        key: { default: '' },
        operator: { default: 'is' },
        value: { default: '' },
        immutable: { default: false },
      },
    },
  },
});

/**
 * Basic block schema without tokens.
 * Use for tests that only need text editing capabilities.
 *
 * Document structure: doc > block+ (paragraph > inline*)
 */
export const basicBlockSchema = new Schema({
  nodes: {
    doc: { content: 'block+' },
    paragraph: { group: 'block', content: 'inline*' },
    text: { group: 'inline' },
  },
});
