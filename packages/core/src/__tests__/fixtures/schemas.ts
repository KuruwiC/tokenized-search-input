/**
 * Shared ProseMirror schemas for testing.
 *
 * These schemas provide consistent node definitions across all test files,
 * reducing duplication and ensuring uniform behavior.
 */
import { Schema } from '@tiptap/pm/model';

/**
 * Minimal inline schema with spacer and token support.
 * Use for tests that work with flat document structure (no paragraphs).
 *
 * Document structure: doc > inline* (spacer, filterToken, freeTextToken, text)
 */
export const inlineSchema = new Schema({
  nodes: {
    doc: { content: 'inline*' },
    text: { group: 'inline' },
    spacer: {
      group: 'inline',
      inline: true,
      atom: true,
      selectable: false,
    },
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
        key: { default: '' },
        operator: { default: 'is' },
        value: { default: '' },
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
